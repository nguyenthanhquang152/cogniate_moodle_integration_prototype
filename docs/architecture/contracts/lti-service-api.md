# Contract: LTI service (LTIAAS-compatible)

Status: T0 round 2. Owner: Architect. Scope and promises: [ADR-003](../adr/ADR-003-ltiaas-compatibility-scope.md). Security rules: [`../security.md`](../security.md).

Provenance: paths, header schemes and field names follow the **public** LTIAAS API reference (names only). Only the Architect read that reference (clean-room process, ADR-001). Behaviour follows the 1EdTech specs (LTI 1.3 Core, Security Framework 1.0, Deep Linking 2.0, AGS 2.0, NRPS 2.0, Dynamic Registration 1.0) and Moodle 5.2. The text is ours. Author and QA work from this file, not from the LTIAAS docs.

Base URL: `PUBLIC_LTI_URL` (dev `https://lti.cogniate.test`).

## 0. Endpoints and tasks

| Endpoint | Task |
| --- | --- |
| `GET|POST /lti/login/{toolAccountId}`, `POST /lti/launch/{toolAccountId}`, `GET /lti/keys/{toolAccountId}`, `GET /healthz` | T2a |
| `GET /api/idtoken`, platforms `GET`, `POST`, `GET /:id`, `PATCH /:id` | T2a |
| `POST /api/deeplinking`, `GET /api/lineitems`, `GET /api/lineitems/:id`, `GET` and `POST /api/lineitems/:id/scores`, service keys | T3a |
| `GET /lti/register/{toolAccountId}`, `GET /api/registrations/:id`, `POST /api/registrations/:id/complete` | T3b |
| `POST /api/deeplinking/form`, `POST /api/deeplinking/message`, `POST /api/lineitems`, `PUT` and `DELETE /api/lineitems/:id`, `GET /api/memberships`, `DELETE /api/platforms/:id`, OAuth2 stubs | T3c |

---

## 1. Conventions

### 1.1 Tool accounts

One tool account = one LTI tool (LTIAAS: one account). The prototype has `cogniate` and the test account `qa-second`. Settings (bootstrap CLI, §7):

| Setting | Value for `cogniate` |
| --- | --- |
| `launchUrl` | `{PUBLIC_APP_URL}/tool/launch` |
| `deepLinkingUrl` | `{PUBLIC_APP_URL}/tool/deep-link` |
| `registrationUrl` | `{PUBLIC_APP_URL}/tool/register` |
| `name` | `Cogniate` |

### 1.2 Authorization header

Scheme names are case-insensitive. The credential is split at the **first** `:`.

```text
Authorization: LTIK-AUTH-V2 <API_KEY>:<LTIK>
Authorization: SERVICE-AUTH-V1 <API_KEY>:<SERVICE_KEY>
Authorization: Bearer <API_KEY>
```

- `API_KEY`: our format `ltis_` + 43 base64url characters (no `:`). See §8.
- `LTIK`, `SERVICE_KEY`: opaque 43-character base64url strings.
- The API key and the ltik or service key must belong to the same tool account.

| Endpoint group | LTIK-AUTH-V2 | SERVICE-AUTH-V1 | Bearer |
| --- | --- | --- | --- |
| `/api/idtoken` | yes | — | — |
| `/api/deeplinking*` | yes | — | — |
| `/api/lineitems*` | yes | yes | — |
| `/api/memberships` | yes | yes | — |
| `/api/registrations/*` | — | — | yes |
| `/api/platforms*` | — | — | yes |

### 1.3 Error body and codes

```json
{ "status": 401, "error": "Unauthorized", "details": { "message": "INVALID_LTIK_AUTH_AUTHORIZATION_HEADER", "description": "Invalid or expired ltik." } }
```

`error` = HTTP reason phrase. `details.message` = stable code. `description` can change. No error contains a token, key or stack trace. 5xx errors put the trace id in `description`.

| HTTP | `details.message` | When |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | Body or query fails validation. `description` names the field. |
| 400 | `INVALID_LINE_ITEM_ID` | `:lineItemId` fails the URL rule (§3.4) |
| 400 | `INVALID_URL_PARAMETER` | The `url` query fails the URL rule |
| 400 | `INVALID_CONTENT_ITEM` | A content item breaks a rule (§3.2) |
| 400 | `UNSUPPORTED_AUTH_METHOD` | Platform `authConfig.method` is not `JWK_SET` |
| 400 | `PLATFORM_URL_NOT_ON_ISSUER_ORIGIN` | A platform endpoint is not on the issuer origin |
| 401 | `INVALID_AUTHORIZATION_HEADER` | No header, unknown scheme, or a scheme that this endpoint does not accept |
| 401 | `INVALID_LTIK_AUTH_AUTHORIZATION_HEADER` | LTIK-AUTH-V2: bad API key, bad or expired ltik, account mismatch, or no `:`. Bearer: bad API key ("Invalid API key"). |
| 401 | `INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER` | SERVICE-AUTH-V1: bad API key, unknown or revoked service key, account mismatch, or no `:` |
| 403 | `SERVICE_NOT_AVAILABLE` | Deep Linking, AGS or NRPS is not in this launch, or the scope is missing |
| 403 | `PLATFORM_NOT_ACTIVE` | Inactive platform |
| 404 | `NOT_FOUND` | Unknown route or resource |
| 404 | `UNREGISTERED_PLATFORM` | Unknown platform id |
| 404 | `REGISTRATION_NOT_FOUND` | Unknown or expired registration session |
| 409 | `REGISTRATION_ALREADY_COMPLETED` | `complete` called twice |
| 409 | `REGISTRATION_UPDATE_NOT_ALLOWED` | Update without the matching `updatePlatformId` (§3.8) |
| 409 | `PLATFORM_ALREADY_EXISTS` | Same tool account + issuer + client id |
| 409 | `PLATFORM_CONFLICT` | The platform answered 409 |
| 400, 404 | `PLATFORM_REJECTED_REQUEST` | The platform answered 400 or 404. Same status. `description` has the platform status and a short, escaped message. |
| 501 | `NOT_IMPLEMENTED` | OAuth2 stubs |
| 502 | `PLATFORM_ERROR` | The platform answered 401, 403 or 5xx, or bad data |
| 504 | `PLATFORM_TIMEOUT` | No answer in 5 s |
| 500 | `INTERNAL_ERROR` | Bug |

HTML pages of the protocol endpoints use the codes in [`../security.md`](../security.md) §2.1 and §2.2, and show the code, the trace id and one action line.

### 1.4 Other rules

- JSON: `Content-Type: application/json`, UTF-8, max 256 KB.
- `:lineItemId` = the line item URL, encoded with `encodeURIComponent`.
- Times: ISO 8601 UTC with milliseconds.
- Trace id: every response has `X-Trace-Id`. A valid incoming `X-Trace-Id` (`^[A-Za-z0-9-]{16,64}$`) is reused.

---

## 2. Protocol endpoints (Moodle and the browser)

### 2.1 `GET|POST /lti/login/{toolAccountId}` — OIDC login initiation (T2a)

Input: `iss`, `login_hint`, `target_link_uri` (required); `lti_message_hint`, `client_id`, `lti_deployment_id`. Rules: security §2.1.

Success `302`:

```text
Location: {platform auth endpoint}?scope=openid&response_type=id_token&response_mode=form_post&prompt=none
  &client_id=..&redirect_uri={PUBLIC_LTI_URL}/lti/launch/{toolAccountId}&login_hint=..&lti_message_hint=..&state=..&nonce=..
Set-Cookie: __Host-lti_state_<8 chars>=<state>; Path=/; Max-Age=600; Secure; HttpOnly; SameSite=None; Partitioned
Cache-Control: no-store
Referrer-Policy: no-referrer
```

### 2.2 `POST /lti/launch/{toolAccountId}` — redirect URI (T2a)

Input: `id_token`, `state` (or `error`, `error_description`, `state`). Rules and error codes: security §2.2.

Success `303 See Other`:

| Message type | Location |
| --- | --- |
| `LtiResourceLinkRequest` | `{launchUrl}?{query of target_link_uri}&ltik={ltik}` |
| `LtiDeepLinkingRequest` | `{deepLinkingUrl}?{query of target_link_uri}&ltik={ltik}` |

A `ltik` parameter inside `target_link_uri` is dropped. Headers: `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, state cookie `Max-Age=0`. The copied query is for compatibility only. Tools must read the signed `launch.target` instead.

`GET /lti/launch/{toolAccountId}` → `405`.

### 2.3 `GET /lti/keys/{toolAccountId}` — tool JWKS (T2a)

`200 application/json`, `Cache-Control: public, max-age=300`:

```json
{ "keys": [ { "kty": "RSA", "kid": "<kid>", "alg": "RS256", "use": "sig", "n": "...", "e": "AQAB" } ] }
```

The active key (and, if rotation is used, retired keys for 30 days). Never `d`, `p`, `q`, `dp`, `dq`, `qi`. Unknown account → `404`.

### 2.4 `GET /lti/register/{toolAccountId}` — dynamic registration start (T3b)

| Query | Required | Meaning |
| --- | --- | --- |
| `openid_configuration` | yes | Platform configuration URL |
| `registration_token` | no (Moodle sends it) | Bearer token for the registration endpoint |
| `privacyLevel` | no | `public`, `name_only`, `email_only`, `anonymous` (default `anonymous`) |
| any other | no | Passed through to the tool (for example `ref`) |

Steps: fetch the configuration with the guarded client (with `Authorization: Bearer <registration_token>` if present); apply security §2.4; read `operation` from the token (security §2.5); store a registration session (expires with the token, ≤ 1 h); `303` to `{registrationUrl}?registrationId={id}&{passthrough}`. Failure: `400` HTML page (`INVALID_OPENID_CONFIGURATION`, `ISSUER_MISMATCH`, `FETCH_FAILED`).

### 2.5 `GET /healthz` (T1)

`200 {"status":"ok","service":"lti-service","profile":"default","knobs":[]}`. `knobs` lists active test knobs (`tasks/README.md`). `profile` is `acceptance` in that compose profile (local-stack §3).

---

## 3. API endpoints

### 3.1 `GET /api/idtoken` — LTIK-AUTH-V2 (T2a)

Query: `raw=true` gives the validated raw claims.

`200` (values are examples; `platform.*` values come from Moodle and are not fixed):

```json
{
  "ltiVersion": "1.3.0",
  "user": { "id": "5", "roles": ["http://purl.imsglobal.org/vocab/lis/v2/membership#Learner"] },
  "platform": {
    "id": "plt_...", "url": "https://moodle.test", "clientId": "<moodle client id>",
    "deploymentId": "1", "name": "moodle", "guid": "<32-char hash>",
    "productFamilyCode": "moodle", "version": "<moodle version>", "description": "<site name>", "contactEmail": ""
  },
  "launch": {
    "type": "LtiResourceLinkRequest",
    "target": "https://lti.cogniate.test/lti/launch/cogniate?resource=pub_8Jk2",
    "context": { "id": "2", "label": "COGNIATE-DEV-101", "title": "<course full name>", "type": ["CourseSection"] },
    "resourceLink": { "id": "3", "title": "<activity name>", "description": "" },
    "presentation": { "locale": "en", "documentTarget": "window", "document_target": "window", "returnUrl": "https://moodle.test/mod/lti/return.php?...", "width": 0, "height": 0 },
    "custom": {}
  },
  "services": {
    "deepLinking": { "available": false },
    "namesAndRoles": { "available": true },
    "assignmentAndGrades": { "available": true, "lineItemId": "https://moodle.test/mod/lti/services.php/2/lineitems/7/lineitem?type_id=1" },
    "serviceKey": "..."
  }
}
```

| Field | Source (`lti/` = `https://purl.imsglobal.org/spec/lti/claim/`) |
| --- | --- |
| `ltiVersion` | `lti/version` |
| `user.id`, `user.roles` | `sub`, `lti/roles` |
| `user.email`, `name`, `givenName`, `familyName` | `email`, `name`, `given_name`, `family_name`. Omitted when absent. |
| `platform.id` | our platform id |
| `platform.url`, `clientId`, `deploymentId` | `iss`, `aud` (or `azp`), `lti/deployment_id` |
| `platform.name`, `guid`, `productFamilyCode`, `version`, `description`, `contactEmail` | `lti/tool_platform` fields. Registration name if absent. |
| `launch.type`, `launch.target` | `lti/message_type`, `lti/target_link_uri` |
| `launch.context` | `lti/context` (`id`, `label`, `title`, `type`) |
| `launch.resourceLink` | `lti/resource_link`. Omitted for deep linking (no resource link exists yet). |
| `launch.presentation` | `lti/launch_presentation`. `document_target` is returned as `documentTarget` **and** `document_target`. `return_url` → `returnUrl`. |
| `launch.custom` | `lti/custom`, `{}` when absent |
| `launch.deepLinkingSettings` (addition) | deep linking settings: `acceptTypes`, `acceptMultiple`, `acceptPresentationDocumentTargets`, `autoCreate`, `title`, `text` |
| `services.deepLinking.available` | message type is `LtiDeepLinkingRequest` |
| `services.namesAndRoles.available` | NRPS claim present |
| `services.assignmentAndGrades.available`, `lineItemId` | AGS claim present; its `lineitem` |
| `services.serviceKey` | when AGS or NRPS is available (T3a). Stable per (platform, deployment, context, resource link). |

### 3.2 Deep Linking — LTIK-AUTH-V2

`POST /api/deeplinking` (T3a) and the alias `POST /api/deeplinking/message` (T3c):

```json
{
  "contentItems": [ { "type": "ltiResourceLink", "title": "...", "url": "https://lti.cogniate.test/lti/launch/cogniate?resource=pub_8Jk2", "lineItem": { "scoreMaximum": 100, "label": "...", "resourceId": "pub_8Jk2", "tag": "cogniate-score" } } ],
  "options": { "message": "Course added", "log": "", "errMessage": "", "errLog": "" }
}
```

`200 { "message": "<signed JWT>", "target": "<deep_link_return_url>" }`. The tool posts `message` as form field `JWT` to `target`.

`POST /api/deeplinking/form` (T3c): same request. `200 { "form": "<form id=\"lti_dl_submit\" style=\"display:none\" action=\"{target}\" method=\"POST\"><input type=\"hidden\" name=\"JWT\" value=\"{message}\"/></form><script>document.getElementById(\"lti_dl_submit\").submit()</script>" }` (values HTML-escaped).

Content item fields (Deep Linking 2.0): `type` (`ltiResourceLink`, `link`, `file`, `html`, `image`), `url`, `title`, `text`, `icon`, `thumbnail`, `embed`, `window`, `iframe`, `custom` (string values), `lineItem` (`label`, `scoreMaximum`, `resourceId`, `tag`, `gradesReleased`), `available`, `submission`, `expiresAt`, `html`, `width`, `height`.

Rules (`400 INVALID_CONTENT_ITEM`):

- 1 to 20 items. If `acceptMultiple` is false, exactly 1.
- `type` must be in `accept_types`.
- `ltiResourceLink.url`: if missing, the service sets `{PUBLIC_LTI_URL}/lti/launch/{toolAccountId}` (the only field it may add). If present, it must start with that value.
- `lineItem.scoreMaximum` > 0. `custom` values are strings.
- The JWT `content_items` equal the request items, plus only the default `url` above.
- JWT claims: security §2.3.
- Not a deep-linking launch → `403 SERVICE_NOT_AVAILABLE`.

### 3.3 Service keys (T3a)

Issued in `GET /api/idtoken` when AGS or NRPS is available. One key per (platform, deployment, context, resource link): a later launch of the same activity by any user returns the same key and refreshes the stored claims. Revoked when the platform is deleted.

### 3.4 Line item URL rule (all `/api/lineitems*`, `/api/memberships?url=`)

The service takes the AGS claim (or NRPS claim) of the launch or service key. A line item id or `url` query is valid only if:

1. its origin = the origin of the claim URL (`lineitems`, or `context_memberships_url`),
2. its path starts with the claim URL path, and
3. every query parameter of the claim URL is present with the same value (Moodle: `type_id`).

Otherwise `400 INVALID_LINE_ITEM_ID` (or `INVALID_URL_PARAMETER`), and **no** outbound request is made. Scores URL = line item URL with `/scores` added to the path, before the query. Results use `/results`.

### 3.5 Line items — LTIK-AUTH-V2 or SERVICE-AUTH-V1

Line item: `id` (URL, platform-set), `label` (required on write), `scoreMaximum` (> 0, required on write), `resourceLinkId`, `resourceId`, `tag`, `startDateTime`, `endDateTime`, `gradesReleased`.

| Method and path | Task | Request | Success | Platform call |
| --- | --- | --- | --- | --- |
| `GET /api/lineitems` | T3a | query `resourceLinkId`, `resourceId`, `tag`, `limit` (≥ 1), `url` | `200 { lineItems, next?, prev?, first?, last? }` | `GET lineitems` (paging from `Link`; `url` replaces all other params; `resourceLinkId` → AGS `resource_link_id`) |
| `GET /api/lineitems/:lineItemId` | T3a | — | `200` line item | `GET {id}` |
| `POST /api/lineitems` | T3c | line item without `id` | `201` line item | `POST lineitems` |
| `PUT /api/lineitems/:lineItemId` | T3c | full line item | `201` line item | `PUT {id}` |
| `DELETE /api/lineitems/:lineItemId` | T3c | — | `204` | `DELETE {id}` |

Write operations need the AGS `lineitem` scope. With only `lineitem.readonly`: `403 SERVICE_NOT_AVAILABLE`.

### 3.6 Scores — LTIK-AUTH-V2 or SERVICE-AUTH-V1 (T3a)

`POST /api/lineitems/:lineItemId/scores`:

| Field | Rule |
| --- | --- |
| `userId` | required, LTI `sub` |
| `activityProgress` | required: `Initialized`, `Started`, `InProgress`, `Submitted`, `Completed` (`Initiated` accepted as an alias of `Initialized`) |
| `gradingProgress` | required: `FullyGraded`, `Pending`, `PendingManual`, `Failed`, `NotReady` |
| `scoreGiven` | optional, ≥ 0, needs `scoreMaximum` |
| `scoreMaximum` | > 0, required with `scoreGiven` |
| `comment` | optional |
| `timestamp` (addition) | optional ISO 8601 |

The service sends `application/vnd.ims.lis.v1.score+json` with `timestamp` ≥ last + 1 s per (platform, line item, user). The clock is in memory; at start its floor is the start time + 2 s, so scores sent just before a restart do not cause a 409 after it. A `timestamp` in the request is used as given (QA uses this to make a `conflict`, AC-T5-31). `204` on success. Platform 409 → `409 PLATFORM_CONFLICT`.

`GET /api/lineitems/:lineItemId/scores` — query `userId`, `limit`, `url`. Platform call: AGS results. `200 { "scores": [ { "id", "userId", "scoreOf", "timestamp", "resultScore", "resultMaximum", "comment" } ], "next"?, "prev"?, "first"?, "last"? }`.

Scope: POST needs `score`, GET needs `result.readonly`. Else `403 SERVICE_NOT_AVAILABLE`.

### 3.7 `GET /api/memberships` — LTIK-AUTH-V2 or SERVICE-AUTH-V1 (T3c)

Query: `role` (a short name such as `Learner` or a full role URI, passed to NRPS as is), `limit`, `resourceLinkId` (→ NRPS `rlid`), `url` (rule §3.4). `200 { "id", "context": { "id", "label", "title" }, "members": [ { "userId", "roles", "status" } ], "next"? }`. `email`, `name`, `givenName`, `familyName`, `picture` only when the platform sends them. No NRPS claim → `403 SERVICE_NOT_AVAILABLE`.

### 3.8 Dynamic registration — Bearer (T3b)

`GET /api/registrations/:registrationId` (`raw=true` adds `raw` = platform configuration):

```json
{
  "url": "https://moodle.test", "familyCode": "moodle", "version": "5.2.4 (Build: 20261005)",
  "supportedScopes": ["https://purl.imsglobal.org/spec/lti-ags/scope/score", "..."],
  "supportedMessages": [ { "type": "LtiResourceLinkRequest" }, { "type": "LtiDeepLinkingRequest", "placements": ["ContentArea"] } ],
  "privacyLevel": "anonymous",
  "operation": "new",
  "existingPlatformId": null
}
```

`operation` and `existingPlatformId` are additions (security §2.5).

`POST /api/registrations/:registrationId/complete`:

| Field | Default |
| --- | --- |
| `platformName` | `product_family_code` + host |
| `autoActivate` | `true` (our platform `active`; Moodle still shows the tool as Pending) |
| `messages` | `[{ "type": "LtiDeepLinkingRequest", "placements": ["ContentArea"] }]` |
| `privacyLevel` | from §2.4, else `anonymous` |
| `updatePlatformId` (addition) | required when `operation = update`; must equal `existingPlatformId` |

The service sends the registration request of [ADR-009](../adr/ADR-009-moodle-connection-methods.md) with `Authorization: Bearer <registration_token>`, then stores or updates the platform (issuer, client id, endpoints, deployment id from the response). `200 { "html": "<script>(window.opener || window.parent).postMessage({subject:'org.imsglobal.lti.close'}, '*');</script>", "platformId": "plt_..." }`.

Errors: `401`, `404 REGISTRATION_NOT_FOUND`, `409 REGISTRATION_ALREADY_COMPLETED`, `409 REGISTRATION_UPDATE_NOT_ALLOWED` (nothing sent to Moodle), `502 PLATFORM_ERROR` (Moodle rejected; `description` has its code, for example `domain_targetlinkuri_mismatch`).

### 3.9 Platforms (admin) — Bearer

Platform: `id`, `url` (issuer), `clientId`, `name`, `authenticationEndpoint`, `accesstokenEndpoint`, `authConfig { method: "JWK_SET", key: <JWKS URL> }`, `publicKey` (PEM of the **tool** key; see §8), `active`, `deploymentIds` (addition), `productFamilyCode` (addition).

| Method and path | Task | Request | Success |
| --- | --- | --- | --- |
| `GET /api/platforms` | T2a | query `id`, `url`, `clientId` | `200 { "platforms": [...] }` |
| `POST /api/platforms` | T2a | `url`, `clientId`, `name`, `authenticationEndpoint`, `accesstokenEndpoint`, `authConfig`, `deploymentIds` (≥ 1), `active?` | `201`. `409 PLATFORM_ALREADY_EXISTS`. `400 PLATFORM_URL_NOT_ON_ISSUER_ORIGIN`. |
| `GET /api/platforms/:id` | T2a | — | `200`, `404 UNREGISTERED_PLATFORM` |
| `PATCH /api/platforms/:id` | T2a | `name`, `active`, `deploymentIds` | `200` |
| `DELETE /api/platforms/:id` | T3c | — | `204`. Revokes its ltiks and service keys. |

All URLs are https. An account sees only its own platforms. Another account may register the same issuer + client id; that record is never used for launches of the first account, because login URLs carry the account.

### 3.10 OAuth2 stubs (T3c)

`POST /api/oauth/:platformId/access_token` and `.../access_token/refresh` (our paths): `501 NOT_IMPLEMENTED`.

---

## 4. Platform calls (inside the service)

| Call | Detail |
| --- | --- |
| Access token | `POST {accesstokenEndpoint}`: `grant_type=client_credentials`, `client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer`, `client_assertion` (security §2.3), `scope`. Cached **in memory** per (platform, scope set) until 60 s before expiry. |
| Platform JWKS | Guarded client + `createLocalJWKSet`, 10 min cache, refetch on unknown `kid` at most once per minute |
| Timeouts, redirects | 5 s. No redirects. One retry on network error for GET only. |

## 5. Log events

Every event: `ts`, `level`, `service: "lti-service"`, `event`, `trace_id` (lifecycle events: the per-process boot trace id). No secret in any field. File: `infra/.logs/lti-service.jsonl`.

| Event | Level | Fields | When |
| --- | --- | --- | --- |
| `service_started` | info | `node`, `port`, `public_url`, `profile`, `outbound_allowlist`, `knobs` | start |
| `test_knob_active` | warn | `name`, `value` | start, per knob |
| `http_request` | info | `method`, `path` (no query), `status`, `ms` | every request |
| `outbound_request` | info | `host`, `method`, `status`, `ms` | every outbound call that was sent |
| `outbound_blocked` | warn | `host`, `reason` | every outbound call that the guard stopped |
| `login_rejected` | warn | `code` | login failure |
| `launch_check_failed` | warn | `check` (1–12 or `oidc_error`), `code` | launch failure |
| `launch_accepted` | info | `platform_id`, `message_type` | launch success |
| `api_auth_failed` | warn | `scheme`, `code` | 401 on `/api/*` |
| `platform_token` | info | `platform_id`, `cache` (`hit` or `miss`) | each token use |
| `registration_started` | info | `registration_id`, `operation` | §2.4 |
| `registration_completed` | info | `platform_id`, `operation` | §3.8 success |
| `registration_rejected` | warn | `code` | §2.4 or §3.8 failure |
| `service_stopping` | info | — | stop |

## 6. Data retention (prototype)

OIDC state 10 min. Launch 24 h after the ltik expires. Service keys until the platform is deleted. Registration sessions 24 h.

## 7. Bootstrap CLI

```sh
npm run lti:bootstrap -w services/lti-service -- --account cogniate --name "Cogniate" [--rotate-api-key] [--rotate-signing-key]
```

The URLs come from `PUBLIC_APP_URL`. The command makes the account and its key if missing. It prints the API key once and writes `infra/.secrets/lti-api-key.<account>` (mode 600). `--rotate-signing-key` is optional in the prototype.

## 8. Differences from the public LTIAAS API

A tool written against the public LTIAAS API works after two changes (base URL, API key), **except** for the items below.

| # | Topic | Public LTIAAS docs | Ours |
| --- | --- | --- | --- |
| D1 | Account selection | One subdomain per account | One host. Protocol URLs carry the tool account id (`/lti/login/{id}` …). The API is the same. |
| D2 | API key format | Example is a UUID | `ltis_` + 43 characters |
| D3 | ltik and service key format | Examples look like JWTs | Opaque random strings |
| D4 | Registration paths | Our copy shows no path | `/api/registrations/:id` and `/complete` are our paths |
| D5 | Platform admin paths | Our copy shows no path | `/api/platforms*` are our paths |
| D6 | `privacyLevel` default | `public` | `anonymous` |
| D7 | `authConfig.method` | `JWK_SET`, `JWK_KEY`, `RSA_KEY` | `JWK_SET` only |
| D8 | `publicKey` in a platform | "Platform public key" | The tool public key for that platform |
| D9 | `launch.resourceLink` | Marked required | Omitted for deep-linking launches |
| D10 | Additions | — | `launch.deepLinkingSettings`, `deploymentIds`, `productFamilyCode`, `operation`, `existingPlatformId`, `updatePlatformId`, score `timestamp`, both `documentTarget` spellings |
| D11 | OAuth2 endpoints | Documented | `501` stubs |
| D12 | Tested LMS | Many | Moodle 5.2 only |
