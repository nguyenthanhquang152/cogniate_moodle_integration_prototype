# Contract: LTI service (LTIAAS-compatible)

Status: T0 round 2; M0 multi-LMS additions in §9 (2026-10-20). Owner: Architect. Scope and promises: [ADR-003](../adr/ADR-003-ltiaas-compatibility-scope.md). Security rules: [`../security.md`](../security.md).

Provenance: paths, header schemes and field names follow the **public** LTIAAS API reference (names only). Only the Architect read that reference (clean-room process, ADR-001). Behaviour follows the 1EdTech specs (LTI 1.3 Core, Security Framework 1.0, Deep Linking 2.0, AGS 2.0, NRPS 2.0, Dynamic Registration 1.0), Moodle 5.2 and, for §9, the Canvas and Blackboard documentation listed in [`../../research/multi-lms.md`](../../research/multi-lms.md). The text is ours. Author and QA work from this file, not from the LTIAAS docs.

Base URL: `PUBLIC_LTI_URL` (dev `https://lti.cogniate.test`).

## 0. Endpoints and tasks

| Endpoint | Task |
| --- | --- |
| `GET|POST /lti/login/{toolAccountId}`, `POST /lti/launch/{toolAccountId}`, `GET /lti/keys/{toolAccountId}`, `GET /healthz` | T2a |
| `GET /api/idtoken`, platforms `GET`, `POST`, `GET /:id`, `PATCH /:id` | T2a |
| `POST /api/deeplinking`, `GET /api/lineitems`, `GET /api/lineitems/:id`, `GET` and `POST /api/lineitems/:id/scores`, service keys | T3a |
| `GET /lti/register/{toolAccountId}`, `GET /api/registrations/:id`, `POST /api/registrations/:id/complete` | T3b |
| `POST /api/deeplinking/form`, `POST /api/deeplinking/message`, `POST /api/lineitems`, `PUT` and `DELETE /api/lineitems/:id`, `GET /api/memberships`, `DELETE /api/platforms/:id`, OAuth2 stubs | T3c |
| SDK tolerances (§1.4 leading `//` and double-encoded `:lineItemId`, §3.1 `services.outcomes`, §3.2 `url: null` and `custom: null`, §3.6 `user_id` and `comment: null`) | T3c round 3 |
| Provider profiles, reserved issuers, site origins, `GET /api/providers`, deployment endpoints, check 13, claim allowlist, binding generation, `lti:shared-platform` CLI (§9) | M1 |

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
| `/api/platforms*` (also `…/deployments*`, §9.5, §9.6) | — | — | yes |
| `/api/providers` (§9.3) | — | — | yes |

### 1.3 Error body and codes

```json
{ "status": 401, "error": "Unauthorized", "details": { "message": "INVALID_LTIK_AUTH_AUTHORIZATION_HEADER", "description": "Invalid or expired ltik." } }
```

`error` = HTTP reason phrase. `details.message` = stable code. `description` can change. No error contains a token, key or stack trace. 5xx errors put the trace id in `description`.

| HTTP | `details.message` | When |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | Body or query fails validation. `description` names the field. A body larger than 256 KB gives `413` with this code. |
| 400 | `INVALID_LINE_ITEM_ID` | `:lineItemId` fails the URL rule (§3.4) |
| 400 | `INVALID_URL_PARAMETER` | The `url` query fails the URL rule |
| 400 | `INVALID_CONTENT_ITEM` | A content item breaks a rule (§3.2) |
| 400 | `INVALID_DEEP_LINK_RETURN_URL` | The launch's `deep_link_return_url` is not https on the platform issuer origin (§3.2, A-T3c-01). M1: on the site origin of the launch deployment (§9.10). |
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
| 400, 404, 422 | `PLATFORM_REJECTED_REQUEST` | The platform answered 400, 404 or (M1) 422. Same status. `description` has the platform status and a short message as plain data; every page or client that shows it escapes it (B-T3a-03). |
| 501 | `NOT_IMPLEMENTED` | OAuth2 stubs |
| 502 | `PLATFORM_ERROR` | The platform answered 401, 403 or 5xx, or bad data. Also a `400` from the platform **token endpoint** (for example `invalid_client`): the tool cannot fix the request, so it is a platform-side error, not `PLATFORM_REJECTED_REQUEST` (confirmed in T3a QA). |
| 504 | `PLATFORM_TIMEOUT` | No answer in 5 s |
| 500 | `INTERNAL_ERROR` | Bug |

Multi-LMS codes (`UNKNOWN_PROFILE`, `ISSUER_RESERVED`, `INVALID_SITE_URL`, `PLATFORM_URL_NOT_IN_PROFILE`, `DEPLOYMENT_NOT_ACTIVE`, `UNKNOWN_DEPLOYMENT`, `SHARED_PLATFORM_EXISTS`, `SHARED_PLATFORM_DEPLOYMENTS`, `SHARED_PLATFORM_IN_USE`, `DEPLOYMENT_ALREADY_EXISTS`): §9.2.

HTML pages of the protocol endpoints use the codes in [`../security.md`](../security.md) §2.1 and §2.2, and show the code, the trace id and one action line.

### 1.4 Other rules

- JSON: `Content-Type: application/json`, UTF-8, max 256 KB.
- `:lineItemId` = the line item URL, encoded with `encodeURIComponent`. Decoding (Lead decision, T3c round 3): the router decodes the value once as usual. If the result starts with `https%3A%2F%2F` (any letter case), the service decodes it **exactly once more** (the `ltiaas` SDK encodes an already encoded id). There are never more than two decodes. The line item URL rule (§3.4) then runs, unchanged, on the final value.
- A run of slashes at the very **start** of the request path is treated as one (`//api/idtoken` = `/api/idtoken`; the `ltiaas` SDK sends it). Nothing else in the path changes. This does not touch the line item URL rule (§3.4), which works on the decoded `:lineItemId` value, not on the request path; an encoded line item id has no raw `/`.
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

`GET /lti/launch/{toolAccountId}` (any method except `POST`) → `405` HTML page `METHOD_NOT_ALLOWED`, header `Allow: POST`.

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

Steps: fetch the configuration with the guarded client (with `Authorization: Bearer <registration_token>` if present); apply security §2.4; read `operation` from the token (security §2.5); store a registration session (expires with the token, ≤ 1 h); `303` to `{registrationUrl}?registrationId={id}&{passthrough}`. Failure: `404` HTML page `UNKNOWN_TOOL_ACCOUNT` for an unknown `{toolAccountId}`; `400` HTML page (`INVALID_OPENID_CONFIGURATION`, `ISSUER_MISMATCH`, `FETCH_FAILED`) otherwise.

### 2.5 `GET /healthz` (T1)

`200 {"status":"ok","service":"lti-service","profile":"default","outbound_allowlist":["moodle.test"],"knobs":[],"simulation_profiles":[]}` (`simulation_profiles`: M1, §9.13). `knobs` lists active test knobs (`tasks/README.md`). `profile` is `acceptance` in that compose profile (local-stack §3), and `outbound_allowlist` then also has `qa-platform.test` and `evil.test`.

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
| `services.outcomes` (addition) | always `{ "available": false }`: we offer no LTI 1.1 Basic Outcomes API. Not in the public reference; added because the `ltiaas` SDK needs the key. Not mapped from AGS (AGS is `assignmentAndGrades`). |
| `platform.siteUrl`, `platform.profile` (additions, M1) | site origin of the launch deployment and the platform profile (§9.9) |

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

`custom: null` on a content item (the `ltiaas` SDK sends `null`) becomes `custom: {}` in the signed JWT. Moodle treats an empty `custom` like no `custom` (conformance F4, Lead decision: spec follows the code).

Content item fields (Deep Linking 2.0): `type` (`ltiResourceLink`, `link`, `file`, `html`, `image`), `url`, `title`, `text`, `icon`, `thumbnail`, `embed`, `window`, `iframe`, `custom` (string values), `lineItem` (`label`, `scoreMaximum`, `resourceId`, `tag`, `gradesReleased`), `available`, `submission`, `expiresAt`, `html`, `width`, `height`.

Rules (`400 INVALID_CONTENT_ITEM`):

- 1 to 20 items. If `acceptMultiple` is false, exactly 1.
- `type` must be in `accept_types`.
- `ltiResourceLink.url`: optional (Deep Linking 2.0). If missing or `null`, the service sets `{PUBLIC_LTI_URL}/lti/launch/{toolAccountId}` (the only field it may add; such a link has no `resource` query). If present, it must start with that value.
- `lineItem.scoreMaximum` > 0. `custom` values are strings.
- The JWT `content_items` equal the request items, plus only the default `url` above and `custom: {}` for `custom: null`.
- The launch's `deep_link_return_url` must be an https URL on the platform issuer origin (M1: the site origin of the launch deployment, §9.10); else `400 INVALID_DEEP_LINK_RETURN_URL` and no JWT is signed (all three deep-linking endpoints; A-T3c-01).
- JWT claims: security §2.3.
- Not a deep-linking launch → `403 SERVICE_NOT_AVAILABLE`.

### 3.3 Service keys (T3a)

Issued in `GET /api/idtoken` when AGS or NRPS is available. One key per (platform, deployment, context, resource link): a later launch of the same activity by any user returns the same key and refreshes the stored claims. Revoked when the platform is deleted.

### 3.4 Line item URL rule (all `/api/lineitems*`, `/api/memberships?url=`)

The service takes the AGS claim (or NRPS claim) of the launch or service key. A line item id or `url` query is valid only if:

1. its origin = the origin of the claim URL (`lineitems`, or `context_memberships_url`),
2. its path starts with the claim URL path, and
3. every query parameter of the claim URL is present with the same value (Moodle: `type_id`), and
4. the path of the final value (after the §1.4 decoding) has no `%2F`, `%5C`, `%2E` or `%25` (any letter case), no backslash, and no `.` or `..` segment (A-T3a-01). A triple-encoded id is refused (`400 INVALID_LINE_ITEM_ID`): the decoding never gives a valid line item URL for it.

Otherwise `400 INVALID_LINE_ITEM_ID` (or `INVALID_URL_PARAMETER`), and **no** outbound request is made. Scores URL = line item URL with `/scores` added to the path, before the query. Results use `/results`.

### 3.5 Line items — LTIK-AUTH-V2 or SERVICE-AUTH-V1

Line item: `id` (URL, platform-set), `label` (required on write), `scoreMaximum` (> 0, required on write), `resourceLinkId`, `resourceId`, `tag`, `startDateTime`, `endDateTime`, `gradesReleased`.

Empty optional metadata (AGS 2.0 §3.2.10–3.2.13): for `resourceLinkId`, `resourceId`, `tag`, `startDateTime` and `endDateTime`, "no value" may be absent, `""` or `null`. In a request, the service accepts all three as "no value". In a response, it returns `""` as `""` and returns `null` as an absent field (conformance F6), so a tool must treat absent, `""` and `null` the same.

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
| `comment` | optional; `null` is the same as no comment (the `ltiaas` SDK sends `null`) |
| `timestamp` (addition) | optional ISO 8601, at most now + 15 min, else `400 INVALID_REQUEST` (field `timestamp`). The limit bounds how far a tool can push Moodle's grade time ahead (later scores get 409 until then). |

The service sends `application/vnd.ims.lis.v1.score+json` with `timestamp` ≥ last + 1 s per (platform, line item, user). The clock is in memory; at start its floor is the start time + 2 s, so scores sent just before a restart do not cause a 409 after it. A `timestamp` in the request is used as given (QA uses this to make a `conflict`, AC-T5-31). `204` on success. Platform 409 → `409 PLATFORM_CONFLICT`.

`GET /api/lineitems/:lineItemId/scores` — query `userId` (alias `user_id`, as the `ltiaas` SDK sends it; both with different values → `400 INVALID_REQUEST`), `limit`, `url`. Platform call: AGS results. `200 { "scores": [ { "id", "userId", "scoreOf", "timestamp", "resultScore", "resultMaximum", "comment" } ], "next"?, "prev"?, "first"?, "last"? }`.

Scope: POST needs `score`, GET needs `result.readonly`. Else `403 SERVICE_NOT_AVAILABLE`.

### 3.7 `GET /api/memberships` — LTIK-AUTH-V2 or SERVICE-AUTH-V1 (T3c)

Query: `role` (a short name such as `Learner` or a full role URI, passed to NRPS as is), `limit`, `resourceLinkId` (→ NRPS `rlid`), `url` (rule §3.4). `200 { "id", "context": { "id", "label", "title" }, "members": [ { "userId", "roles", "status" } ], "next"? }`. The service **never** returns member personal fields (`email`, `name`, `givenName`, `familyName`, `picture`), even when the platform sends them: learners are anonymous by default (Q3, prototype). No NRPS claim → `403 SERVICE_NOT_AVAILABLE`.

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
| `updatePlatformId` (addition) | required when `operation = update`; must equal `existingPlatformId`. (The Cogniate app never sends it in the prototype; it refuses every update, security §2.5.) |

The service sends the registration request of [ADR-009](../adr/ADR-009-moodle-connection-methods.md) with `Authorization: Bearer <registration_token>`, then stores or updates the platform (issuer, client id, endpoints, deployment id from the response). If a `new` registration returns a client id that this tool account already has for that issuer, the service updates that platform (same `platformId`) and logs `registration_completed {operation: "update"}` (Lead decision). `200 { "html": "<script>(window.opener || window.parent).postMessage({subject:'org.imsglobal.lti.close'}, '*');</script>", "platformId": "plt_..." }`.

Errors: `401`, `404 REGISTRATION_NOT_FOUND`, `409 REGISTRATION_ALREADY_COMPLETED`, `409 REGISTRATION_UPDATE_NOT_ALLOWED` (nothing sent to Moodle), `502 PLATFORM_ERROR` (Moodle rejected; `description` has its code, for example `domain_targetlinkuri_mismatch`).

### 3.9 Platforms (admin) — Bearer

Platform: `id`, `url` (issuer), `clientId`, `name`, `authenticationEndpoint`, `accesstokenEndpoint`, `authConfig { method: "JWK_SET", key: <JWKS URL> }`, `publicKey` (PEM of the **tool** key; see §8), `active`, `deploymentIds` (addition), `productFamilyCode` (addition).

| Method and path | Task | Request | Success |
| --- | --- | --- | --- |
| `GET /api/platforms` | T2a | query `id`, `url`, `clientId` | `200 { "platforms": [...] }` |
| `POST /api/platforms` | T2a (profiles: M1, §9.4) | `url`, `clientId`, `name`, `authenticationEndpoint`, `accesstokenEndpoint`, `authConfig`, `deploymentIds` (≥ 1), `active?`; M1: `profile?`, `siteUrl?` | `201`. `409 PLATFORM_ALREADY_EXISTS`. `400 PLATFORM_URL_NOT_ON_ISSUER_ORIGIN`. Profile rules and codes: §9.4. |
| `GET /api/platforms/:id` | T2a | — | `200`, `404 UNREGISTERED_PLATFORM` |
| `PATCH /api/platforms/:id` | T2a | `name`, `active`, `deploymentIds` | `200` |
| `DELETE /api/platforms/:id` | T3c | — | `204`. Revokes its ltiks and service keys. |

All URLs are https. An account sees only its own platforms. Another account may register the same issuer + client id; that record is never used for launches of the first account, because login URLs carry the account.

### 3.10 OAuth2 stubs (T3c)

`POST /api/oauth/:platformId/access_token` and `.../access_token/refresh` (our paths). Auth: `Bearer <API_KEY>` (ADR-003); a missing or wrong header gives the `401` of §1.3 first. With a valid key: always `501 NOT_IMPLEMENTED` (the platform id is not looked up).

---

## 4. Platform calls (inside the service)

| Call | Detail |
| --- | --- |
| Access token | `POST {accesstokenEndpoint}`: `grant_type=client_credentials`, `client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer`, `client_assertion` (security §2.3), `scope`. Cached **in memory** per (platform, scope set) until 60 s before expiry. |
| Platform JWKS | Guarded client + `createLocalJWKSet`, 10 min refresh age, refetch on unknown `kid` at most once per minute. On a failed refresh, cached keys stay usable up to 24 h after the last good fetch (security §2.4). |
| Timeouts, redirects | 5 s. No redirects. One retry after `network_error` for GET only (two attempts, two events). |

## 5. Log events

Every event: `ts`, `level`, `service: "lti-service"`, `event`, `trace_id` (lifecycle events: the per-process boot trace id). No secret in any field. File: `infra/.logs/lti-service.jsonl`.

| Event | Level | Fields | When |
| --- | --- | --- | --- |
| `service_started` | info | `node`, `port`, `public_url`, `profile`, `outbound_allowlist`, `knobs` | start |
| `test_knob_active` | warn | `name`, `value` | start, per knob |
| `http_request` | info | `method`, `path` (no query), `status`, `ms` | every request except `GET /healthz` (not in the JSON log file; stdout may keep it at `debug`, B-T1-04) |
| `outbound_request` | info | `host`, `method`, `status`, `ms` | every outbound attempt that got an accepted HTTP response |
| `outbound_blocked` | warn | `host`, `method`, `reason` | every outbound attempt without an accepted response: policy `not_https`, `private_ip`, `redirect`, `too_large`; failure `dns_error`, `timeout`, `network_error` (security §9) |
| `login_rejected` | warn | `code` | login failure |
| `launch_check_failed` | warn | `check` (1–12, `oidc_error` or `platform_active`), `code`, `detail` | launch failure. `detail` is a short safe reason, never a token, claim value or key: for example `skew_s=73` (check 7), `kid_unknown`, `jwks_fetch_failed`, `jwks_unavailable` (check 6), `alg=HS256` (check 4), `missing=resource_link` (check 11). |
| `launch_accepted` | info | `platform_id`, `message_type` | launch success |
| `api_auth_failed` | warn | `scheme`, `code` | 401 on `/api/*` |
| `platform_token` | info | `platform_id`, `cache` (`hit` or `miss`) | each token use |
| `registration_started` | info | `registration_id`, `operation` | §2.4 |
| `registration_completed` | info | `platform_id`, `operation` | §3.8 success |
| `registration_rejected` | warn | `code` | §2.4 or §3.8 failure |
| `internal_error` | error | `method`, `path` (no query), `error` (the error class name only) | a bug; response `500 INTERNAL_ERROR` with the trace id. No error message with data and no stack trace in the JSON file. |
| `retention_cleanup` | info | `table`, `deleted` | cleanup job (data-model §2.1) |
| `platform_deleted` | info | `platform_id` | `DELETE /api/platforms/:id` succeeded |
| `service_stopping` | info | — | stop |

## 6. Data retention (prototype)

OIDC state 10 min. Launch 24 h after the ltik expires. Service keys until the platform is deleted. Registration sessions 24 h. A cleanup job deletes expired rows at start and every 10 min (data-model §2.1).

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
| D10 | Additions | — | `launch.deepLinkingSettings`, `services.outcomes` (`available: false`), `deploymentIds`, `productFamilyCode`, `operation`, `existingPlatformId`, `updatePlatformId`, score `timestamp`, both `documentTarget` spellings |
| D11 | OAuth2 endpoints | Documented | `501` stubs |
| D12 | Tested LMS | Many | Moodle 5.2 live. Canvas and Blackboard: signed simulations only (`SIM`); live status in the M3 live matrix. |
| D13 | Member personal fields in `/api/memberships` | Returned when the LMS sends them | Never returned (anonymous by default, Q3) |
| D15 | Raw (unencoded) line item ids from the `ltiaas` 0.0.4 SDK | `lineItemID` is URL-encoded | A raw line item URL in the path (with `/` and its own `?type_id=…`) does not match the route (`404 NOT_FOUND`); it cannot be told apart from our route and query. A double-encoded id (the SDK called with an encoded id) **is** accepted by the two-decode rule (§1.4). |
| D14 | Tolerances for the `ltiaas` 0.0.4 SDK | — | Leading `//` in the path, `user_id` as an alias of `userId` on scores GET, a content item `url` or `custom` of `null`, a score `comment` of `null`, a double-encoded line item id (§1.4). They widen what we accept; they change no answer for a request that already followed the reference. |
| D16 | Provider profiles | — | Platforms have `profile` (default `standard`). Profiles other than `standard` derive issuer and endpoints from fixed values (§9.1). |
| D17 | Site and service origins | Platform `url` is the LMS | `url` stays the issuer. `siteUrl` (platform and deployment), Canvas `serviceUrl`, and `platform.siteUrl` / `platform.serviceUrl` in `/api/idtoken` give the LMS page and service origins (§9). |
| D18 | Deployments | `deploymentIds` only | Additions: `deployments` with `siteUrl` and `active`, `POST` and `PATCH` deployment endpoints, `GET /api/providers`, shared platforms (§9.4–§9.6). |
| D19 | Claims of Canvas and Blackboard profiles | Passed through | Only an allowlist is stored (§9.8). `/api/idtoken` (also `raw=true`) never shows other claims; `launch.custom` is `{}`. |
| D20 | Binding generations and binding refs | — | Keys and ltiks of an older binding generation of a shared deployment stop working (§9.14). Platforms and deployments can carry a binding ref, and changes can be conditional on it (§9.15). A conditional `PATCH` must write a new ref (rotation). `POST …/deployments` accepts `active: false` (staged create). |
| D21 | Signed product family and canonical origins | — | Launch check 14 refuses a Canvas- or Blackboard-signed launch on a non-matching profile, before any claim is stored (§9.7). Site, service and self-hosted issuer URLs are stored and answered in canonical origin form (§9.1). |

---


## 9. Multi-LMS additions (M1)

Design: [ADR-011](../adr/ADR-011-multi-lms.md). Security rules: [`../security.md`](../security.md) §12. Binding approval (operator grants) lives in the Cogniate app, not here (app contract §4.7, §4.8); the LTI service trusts its API key holder, as today. Every item is an addition, or applies only to profiles other than `standard`. A request without the new fields behaves as in §1 to §8. The `standard` profile is today's behaviour, except the reserved issuer rule (§9.4).

### 9.1 Provider profiles

The profile table is [ADR-011 §6](../adr/ADR-011-multi-lms.md#6-provider-trust-profiles). Templates in values: `{siteUrl}` (the platform or deployment site URL, an origin without a trailing `/`), `{serviceUrl}` (Canvas: the platform service URL, default `{siteUrl}`), `{clientId}` (encoded with `encodeURIComponent`).

| Profile | Sharing | `siteUrl` lives on | Issuer and endpoints |
| --- | --- | --- | --- |
| `standard` | exclusive | — (site = issuer origin) | admin values, rules of security §2.4; issuer not reserved |
| `canvas-cloud-production`, `canvas-cloud-beta`, `canvas-cloud-test` | exclusive | platform (also `serviceUrl`) | fixed; token endpoint from `{serviceUrl}` |
| `canvas-self-hosted` | exclusive | platform (also `serviceUrl`) | issuer = `{siteUrl}`; fixed auth and JWKS paths on that origin; token endpoint from `{serviceUrl}` |
| `blackboard` | shared | each deployment | fixed; JWKS from `{clientId}` |
| `blackboard-sim`, `canvas-sim-cloud` | as their copies | as their copies | fixed `.sim.test` values; only when §9.13 says they are on |

A profile id that is unknown, or a simulation profile while simulations are off: `400 UNKNOWN_PROFILE`. A stored platform whose profile is unknown at run time (a simulation profile row while simulations are off) is treated as inactive: login and launch give `PLATFORM_NOT_ACTIVE`, API calls `403 PLATFORM_NOT_ACTIVE`; `GET /api/platforms` still lists it.

**Canonical origin.** Every `siteUrl`, `serviceUrl` and `canvas-self-hosted` issuer is converted before validation, storage and comparison: scheme and host to lower case, host to ASCII (punycode), a trailing `/` removed, port `443` removed. A path other than `/`, a query, a fragment, user info or another scheme is refused (`INVALID_SITE_URL`, rule 1). Answers always show the canonical form. Example: `HTTPS://School.Example.EDU:443/` → `https://school.example.edu`.

**Product families** (check 14): `canvas` for the Canvas profiles, `blackboardlearn` for the Blackboard profiles, none for `standard`. The comparison ignores case.

**Reserved issuer origins:** `https://blackboard.com`, `https://canvas.instructure.com`, `https://canvas.beta.instructure.com`, `https://canvas.test.instructure.com`, and, when simulations are on, `https://blackboard.sim.test` and `https://canvas.sim.test`.

### 9.2 New error codes

| HTTP | `details.message` | When |
| --- | --- | --- |
| 400 | `UNKNOWN_PROFILE` | §9.1 |
| 400 | `ISSUER_RESERVED` | A `standard` platform (`POST /api/platforms`, or `complete` of a dynamic registration) whose issuer origin is a reserved issuer origin (§9.1). Nothing is stored and nothing is sent to the platform. |
| 400 | `INVALID_SITE_URL` | A `siteUrl` breaks a site rule ([ADR-011 §6](../adr/ADR-011-multi-lms.md#6-provider-trust-profiles)). `description` names the rule (`rule 1` to `rule 5`). |
| 400 | `PLATFORM_URL_NOT_IN_PROFILE` | A sent `url`, `authenticationEndpoint`, `accesstokenEndpoint` or `authConfig.key` is not the exact profile value. `description` names the field. |
| 403 | `DEPLOYMENT_NOT_ACTIVE` | A ltik or service key of a deployment with `active: false` (checked after `PLATFORM_NOT_ACTIVE`) |
| 404 | `UNKNOWN_DEPLOYMENT` | `PATCH …/deployments/:deploymentId` for an id that the platform does not have |
| 409 | `SHARED_PLATFORM_EXISTS` | `POST /api/platforms` with a shared profile when the account already has a platform with that profile (any `active` value) |
| 409 | `SHARED_PLATFORM_DEPLOYMENTS` | `PATCH /api/platforms/:id` with `deploymentIds` on a shared platform |
| 409 | `SHARED_PLATFORM_IN_USE` | `DELETE /api/platforms/:id` on a shared platform that has an active deployment |
| 409 | `DEPLOYMENT_ALREADY_EXISTS` | `POST …/deployments` with an id that the platform has (active or not) |
| 409 | `BINDING_REF_MISMATCH` | A conditional change (`ifBindingRef`, §9.15) whose expected binding ref is not the stored one. Nothing changes. |

The `DELETE /api/platforms/:id` endpoint (§3.9) is also the LTI step of the operator release (app contract §4.9): it removes the platform with its deployments, launches and service keys, so the issuer and client id become free.

Protocol error pages (security §2.1, §2.2) get two codes. `{LMS}` is the LMS name of the platform profile (security §12).

| Code | Status | Action line |
| --- | --- | --- |
| `DEPLOYMENT_NOT_ACTIVE` | 403 | `The connection to this {LMS} site is switched off. Ask your Cogniate admin to check the connection in the Cogniate portal.` |
| `PROVIDER_PROFILE_MISMATCH` | 400 | `This {LMS} site is connected to Cogniate in the wrong way. Ask your Cogniate admin to connect it as {LMS} in the Cogniate portal.` (`{LMS}` = the LMS of the signed product family) |
| `SERVICE_ORIGIN_MISMATCH` | 400 | `The {LMS} address in this launch is not the address saved in Cogniate. Ask your Cogniate admin to check the site URL.` |

The dynamic registration start page (§2.4) gets the page codes `ISSUER_RESERVED` (400): `This address belongs to a hosted LMS. Connect it as Canvas or Blackboard in the Cogniate portal.`, and `PROVIDER_PROFILE_MISMATCH` (400), when the platform configuration (`https://purl.imsglobal.org/spec/lti-platform-configuration`) has `product_family_code` `canvas` or `BlackboardLearn` (any case): `This is a {LMS} site. Connect it as {LMS} in the Cogniate portal.` Nothing is stored and no registration session starts.

### 9.3 `GET /api/providers` — Bearer

`200`:

```json
{
  "profiles": [
    { "id": "standard", "lms": null, "label": "Standard LTI 1.3 platform", "sharing": "exclusive",
      "issuer": null, "authenticationEndpoint": null, "accesstokenEndpoint": null, "jwksUrl": null,
      "siteUrlOn": null, "serviceUrl": false, "simulation": false, "sharedPlatform": null },
    { "id": "canvas-cloud-production", "lms": "canvas", "label": "Canvas, Instructure-hosted (production)", "sharing": "exclusive",
      "issuer": "https://canvas.instructure.com",
      "authenticationEndpoint": "https://sso.canvaslms.com/api/lti/authorize_redirect",
      "accesstokenEndpoint": "{serviceUrl}/login/oauth2/token",
      "jwksUrl": "https://sso.canvaslms.com/api/lti/security/jwks",
      "siteUrlOn": "platform", "serviceUrl": true, "simulation": false, "sharedPlatform": null },
    { "id": "canvas-self-hosted", "lms": "canvas", "label": "Canvas, self-hosted", "sharing": "exclusive",
      "issuer": "{siteUrl}", "authenticationEndpoint": "{siteUrl}/api/lti/authorize_redirect",
      "accesstokenEndpoint": "{serviceUrl}/login/oauth2/token", "jwksUrl": "{siteUrl}/api/lti/security/jwks",
      "siteUrlOn": "platform", "serviceUrl": true, "simulation": false, "sharedPlatform": null },
    { "id": "blackboard", "lms": "blackboard", "label": "Blackboard Learn", "sharing": "shared",
      "issuer": "https://blackboard.com",
      "authenticationEndpoint": "https://developer.blackboard.com/api/v1/gateway/oidcauth",
      "accesstokenEndpoint": "https://developer.blackboard.com/api/v1/gateway/oauth2/jwttoken",
      "jwksUrl": "https://developer.blackboard.com/api/v1/management/applications/{clientId}/jwks.json",
      "siteUrlOn": "deployment", "serviceUrl": false, "simulation": false,
      "sharedPlatform": { "id": "plt_...", "clientId": "<Application ID>", "active": true } }
  ]
}
```

Order: `standard`, `canvas-cloud-production`, `canvas-cloud-beta`, `canvas-cloud-test`, `canvas-self-hosted`, `blackboard`, then `blackboard-sim` and `canvas-sim-cloud` when they are on. The beta and test entries follow the production entry with their ADR-011 §6 values. `serviceUrl: true` marks the Canvas profiles (a separate service URL is allowed); it is `false` for the others. `sharedPlatform` is `null` for exclusive profiles, and `null` for a shared profile without a platform in this account. `label` is human text and can change; tests must not compare it.

### 9.4 Platforms: fields and rules

A platform `id` is random and is **never reused**: a platform that is deleted and created again (also with the same issuer and client id) always gets a new id (B-M1-03 design, app contract §4.7.1 "V limit").

New fields in every platform answer (§3.9):

| Field | Value |
| --- | --- |
| `profile` | profile id |
| `siteUrl` | platform site URL (Canvas profiles), else `null` |
| `serviceUrl` | platform service URL (Canvas profiles; equals `siteUrl` when not sent), else `null` |
| `bindingRef` | the platform's binding ref (§9.15), else `null` |
| `deployments` | `[{ "deploymentId", "siteUrl", "active", "bindingGeneration", "bindingRef" }]`, all deployments, sorted by `deploymentId`. `siteUrl` is the **resolved** site origin. |
| `deploymentIds` | unchanged name; lists the **active** deployments only |

Site origin of a deployment = deployment `siteUrl`, else platform `siteUrl`, else the origin of `url` (issuer). Service origin = platform `serviceUrl`, else the site origin.

`POST /api/platforms` per profile (new optional request fields `profile`, `siteUrl`, `serviceUrl`, `bindingRef`). The existing optional `active` (default `true`) works for every profile except the shared ones; `active: false` stores an inactive platform (staging, §9.15): login, launch and API calls give `PLATFORM_NOT_ACTIVE` until a `PATCH` activates it.

| Profile | Required | Optional, must equal the profile value if sent | Other rules |
| --- | --- | --- | --- |
| absent or `standard` | as §3.9 | — | `siteUrl` and `serviceUrl` must be absent (`400 INVALID_REQUEST`, field name). Reserved issuer origin → `400 ISSUER_RESERVED`. |
| `canvas-cloud-*`, `canvas-sim-cloud` | `clientId`, `name`, `siteUrl`, `deploymentIds` (≥ 1) | `serviceUrl` (default `siteUrl`); `url`, `authenticationEndpoint`, `accesstokenEndpoint`, `authConfig` (`method` `JWK_SET`) must equal the filled profile values | Site rules 1 to 4 for `siteUrl` and `serviceUrl`. The service stores the filled profile values. |
| `canvas-self-hosted` | same | same (issuer = `siteUrl`) | Site rules 1 to 5 for both values. |
| `blackboard`, `blackboard-sim` | `clientId`, `name` | same, without `serviceUrl` | `deploymentIds` absent or `[]` (`400 INVALID_REQUEST` otherwise). `siteUrl` and `serviceUrl` absent. `409 SHARED_PLATFORM_EXISTS` before any other conflict check. |

Check order: body schema, `UNKNOWN_PROFILE`, `UNSUPPORTED_AUTH_METHOD`, `PLATFORM_URL_NOT_IN_PROFILE` (or the §2.4 rules for `standard`), `ISSUER_RESERVED`, `INVALID_SITE_URL`, `SHARED_PLATFORM_EXISTS`, `PLATFORM_ALREADY_EXISTS`. A non-`standard` create logs `platform_created {platform_id, profile}`.

`PATCH /api/platforms/:id`:

- `deploymentIds` on a shared platform → `409 SHARED_PLATFORM_DEPLOYMENTS`.
- On other platforms `deploymentIds` is a **diff**: listed ids that exist keep their row (site, generation) and become active; new ids get new rows (active, generation 0, site from the platform); ids that are not listed are deleted. (Today's delete-and-insert gives the same result for `standard`, whose rows have no extra values.)
- `active` and `name` work on every platform. New optional fields `bindingRef` (set) and `ifBindingRef` (condition) follow §9.15: a request with `ifBindingRef` must also send a new `bindingRef` (rotation). The Cogniate app never sends `PATCH` or `DELETE` to a shared platform (ADR-011 §4 rule 4).

`DELETE /api/platforms/:id` on a shared platform with an active deployment → `409 SHARED_PLATFORM_IN_USE`. `DELETE /api/platforms/:id?ifBindingRef=<ref>` deletes only if the platform's binding ref equals `<ref>` (§9.15).

`GET /api/platforms` gets the query filter `profile`. The filters `url`, `clientId` and `profile` compare **exactly** with the stored values (no canonicalization in the filter). Issuers of Canvas profiles are stored as the fixed profile value, and a `canvas-self-hosted` issuer in canonical origin form, so a caller that sends the canonical issuer finds the record. `url` plus `clientId` finds at most one platform of the account (unique key).

### 9.5 `POST /api/platforms/:id/deployments` — Bearer

Request: `{ "deploymentId": "<1-255 printable ASCII, no space>", "siteUrl"?: "<https origin>", "active"?: boolean, "bindingRef"?: "<1-64 characters [A-Za-z0-9_-]>" }`. `active` defaults to `true`; `active: false` stores an inactive row (staging, §9.15). A `deploymentId` outside its alphabet (for example with a space) → `400 INVALID_REQUEST`, field `deploymentId`, nothing stored.

| Platform profile | `siteUrl` | New row |
| --- | --- | --- |
| `standard` | must be absent | `active` as sent, generation 0 |
| Canvas profiles | absent, or equal to the platform `siteUrl` (`400 INVALID_SITE_URL` otherwise) | `active` as sent, generation 0 |
| shared profiles | required; site rules 1 to 4 | `active: true` → active, **generation 1**; `active: false` → inactive, generation 0 (its first activation gives 1) |

`201 { "deploymentId", "siteUrl", "active", "bindingGeneration", "bindingRef" }` (`siteUrl` resolved). `409 DEPLOYMENT_ALREADY_EXISTS`. `404 UNREGISTERED_PLATFORM`. Logs `deployment_added {platform_id, deployment_id}`.

### 9.6 `PATCH /api/platforms/:id/deployments/:deploymentId` — Bearer

`:deploymentId` is encoded with `encodeURIComponent`. Request: `{ "active"?: boolean, "siteUrl"?: "<https origin>", "bindingRef"?: "<ref>", "ifBindingRef"?: "<ref>" or null }`, at least one of `active` and `bindingRef`. `ifBindingRef` makes the whole change conditional and needs a new `bindingRef` (§9.15).

| Change | Rule |
| --- | --- |
| `active: false` | Allowed on every platform. The generation does not change. |
| `active: true` on an inactive deployment of a shared platform | A **new binding**: generation + 1. `siteUrl` may be sent (site rules 1 to 4) and replaces the old site. |
| `active: true` with a new `bindingRef` on an **active** deployment of a shared platform (an adoption, §9.15) | A **new binding**: generation + 1. `siteUrl` may be sent (site rules 1 to 4) and replaces the old site. Keys and ltiks of the old generation stop working. |
| `active: true` on an inactive deployment of another platform | Active again; generation unchanged. |
| `active: true` without `bindingRef` on an active deployment, or on an active deployment of another platform | No change to `active` or the generation (`200`). `siteUrl` is not allowed here. |
| `siteUrl` in any other case | `400 INVALID_REQUEST`, field `siteUrl` |

`200 { "deploymentId", "siteUrl", "active", "bindingGeneration", "bindingRef" }`. `404 UNKNOWN_DEPLOYMENT`, `404 UNREGISTERED_PLATFORM`, `409 BINDING_REF_MISMATCH`. Logs `deployment_updated {platform_id, deployment_id, active, binding_generation}`.

### 9.7 Login and launch changes

Every platform (exclusive and shared):

- Login rule 3: a sent `lti_deployment_id` must be known (`UNKNOWN_DEPLOYMENT`) and active (`DEPLOYMENT_NOT_ACTIVE`). The state record keeps it.
- Check 9: the token `deployment_id` must be known (`UNKNOWN_DEPLOYMENT`, detail `deployment_unknown`), equal to the stored login value if there is one (`UNKNOWN_DEPLOYMENT`, detail `deployment_differs_from_login`), and active (`DEPLOYMENT_NOT_ACTIVE`, detail `deployment_inactive`).
- There is no exception for an unknown or inactive deployment of a shared platform. A Learn site whose deployment is not bound yet gets `UNKNOWN_DEPLOYMENT`.

Check 13 (new, after 12; profiles other than `standard`; security §2.2): every present URL claim is https and has no user info; AGS `lineitems`, AGS `lineitem` and NRPS `context_memberships_url` are on the **service origin**; `deep_link_return_url` is on the **site origin**. Failure: code `SERVICE_ORIGIN_MISMATCH`, detail `claim=<name> host=<origin>`, where `<name>` is `ags_lineitems`, `ags_lineitem`, `nrps` or `dl_return`, and `<origin>` is the canonical origin of the failing claim URL (an origin is neither a secret nor personal data). A claim URL that does not parse gives `host=invalid`.

Check 14 (new, after 13, **every** profile including `standard`): read the signed `https://purl.imsglobal.org/spec/lti/claim/tool_platform` member `product_family_code`. If it equals `canvas` (any case), the platform profile must be a Canvas profile; if it equals `blackboardlearn` (any case), the profile must be a Blackboard profile. Else: code `PROVIDER_PROFILE_MISMATCH`, detail `family=canvas` or `family=blackboardlearn`. Any other value and a missing claim pass. The check runs before the claim allowlist and before storage, so a refused launch stores no claims.

After check 14: the claim allowlist (§9.8), then the launch is stored with its site origin, service origin and the deployment's current binding generation. The redirect to the tool is unchanged (§2.2).

### 9.8 Claim allowlist

Profiles `canvas-*`, `blackboard`, `blackboard-sim`. The list of kept claims and members is in [ADR-011 §9](../adr/ADR-011-multi-lms.md#9-privacy-identity-and-grades). The stored claims have nothing else. When the service removes at least one claim or member, it logs `launch_claims_minimized {platform_id, claims}`: a sorted list of removed top-level claim names, and `<claim name>#<member>` for a removed member of a kept claim. No values.

### 9.9 `GET /api/idtoken` additions

| Field | Value |
| --- | --- |
| `platform.siteUrl` | site origin of the launch deployment (§9.4). For `standard`: the issuer origin. |
| `platform.serviceUrl` | service origin of the launch deployment (§9.4); equals `platform.siteUrl` except for a Canvas platform with another service URL |
| `platform.profile` | profile id |

### 9.10 Deep Linking and platform calls

- The Deep Linking return URL must be https on the **site origin** of the launch (was: issuer origin; the same value for `standard`). Else `400 INVALID_DEEP_LINK_RETURN_URL`.
- `target` (and the `/form` action) is the `deep_link_return_url` claim exactly as received, also its query. Canvas carries its `data` value there (research F-CV-21). The response JWT has a `data` claim only when the request had `deep_linking_settings.data`.
- The line item URL rule (§3.4) is unchanged; its claim URLs already passed check 13, so service calls go only to the service origin.
- Profiles with `deepLinkingResponseSub` add `sub` = client id to the response JWT.
- Profiles with `clientAssertionAudArray` send the client assertion `aud` as a one-item array.
- The access token cache key stays (platform, scope set). Each call asks only for the one scope that it needs (score, line item read or write, results read, memberships), as today. For a shared platform one token serves all deployments; service URLs reach it only after check 13 and the §3.4 rule. A bound Learn host still receives the gateway token (ADR-011 R-M-14).

### 9.11 Log events (additions to §5)

| Event | Level | Fields | When |
| --- | --- | --- | --- |
| `platform_created` | info | `platform_id`, `profile` | §9.4, profiles other than `standard` |
| `deployment_added` | info | `platform_id`, `deployment_id` | §9.5 |
| `deployment_updated` | info | `platform_id`, `deployment_id`, `active`, `binding_generation` | §9.6 |
| `launch_claims_minimized` | info | `platform_id`, `claims` | §9.8 |

`launch_check_failed` gets checks `13` and `14` and the new details of check 9. A deployment id is an identifier, not a secret.

### 9.12 CLI: shared platform

```sh
npm run lti:shared-platform -w services/lti-service -- --account cogniate --profile blackboard --client-id <Application ID> [--name "Cogniate"]
```

Makes the shared platform if it does not exist and prints its id. If it exists with the same client id, it prints the id and changes nothing (exit 0). If a shared platform with another client id exists, it exits 1 and prints one line that says so. It prints no secret. The existing seed CLI (`register-platform`) works only on `standard` platforms.

### 9.13 Simulation profiles and `/healthz`

The simulation profiles are on only when both are true: the service profile is `acceptance`, and `LTI_PROVIDER_SIMULATION=on`. The `acceptance` compose profile sets both; nothing else does. `/healthz` and `service_started` get the field `simulation_profiles`: `[]` by default, `["blackboard-sim", "canvas-sim-cloud"]` when on. This is not a test knob: `knobs` stays `[]`.

### 9.14 Binding generation, service keys and ltiks

| Rule | Detail |
| --- | --- |
| Values | `deployment.binding_generation`: 0 for every existing row and for exclusive platforms; 1 for a new active shared deployment and 0 for a new inactive one (§9.5); + 1 for each new binding (§9.6: an activation, or an adoption of an active row). |
| Key derivation | Unchanged when the generation is 0 (existing Moodle keys keep their exact value). When it is above 0, the generation is part of the HMAC input, so each binding has other key values. |
| Issue | On a launch, the service key row of (platform, deployment, context, resource link) gets the current generation. A row with an older generation gets a new key value (the old value stops working at once). |
| Service key check | The key's generation must equal the deployment's generation (else `401 INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER`), and the deployment must be active (else `403 DEPLOYMENT_NOT_ACTIVE`). |
| Ltik check | A launch's generation must equal the deployment's generation (else `401 INVALID_LTIK_AUTH_AUTHORIZATION_HEADER`), and the deployment must be active (else `403 DEPLOYMENT_NOT_ACTIVE`). |
| Revocation | `DELETE /api/platforms/:id` still revokes. A deployment disconnect does not revoke; it uses `active` and the generation. |

### 9.15 Binding refs (fencing for app recovery)

A binding ref is an opaque value (1 to 64 characters, `[A-Za-z0-9_-]`) that the API caller stores on a platform (exclusive profiles) or on a deployment (all profiles). The Cogniate app writes a new random ref for each of its writes and records it first (app contract §4.7.1). The LTI service does not interpret a ref; it only stores it, returns it, and compares it.

| Rule | Detail |
| --- | --- |
| Set | `bindingRef` in `POST /api/platforms`, `POST …/deployments`, `PATCH /api/platforms/:id` and `PATCH …/deployments/:deploymentId` sets the stored value. |
| Condition | `ifBindingRef` in a `PATCH` body, or the `ifBindingRef` query of `DELETE /api/platforms/:id`, makes the whole request conditional: it applies only if the stored value equals the given value (`null` = "no value stored"). Else `409 BINDING_REF_MISMATCH` and nothing changes. |
| Rotation | A `PATCH` with `ifBindingRef` must also send `bindingRef`, and that value must differ from `ifBindingRef`. Else `400 INVALID_REQUEST`, field `bindingRef`, and nothing changes (this check comes before the condition). So every successful conditional `PATCH` changes the stored value. A conditional `DELETE` removes the record. |
| Atomicity | The comparison with the **current** stored value and the change run in one database transaction of the LTI service. So two conditional requests of the same record are serialized, and of two requests that expect the same current value, only the first one that runs can succeed; the second one then sees the changed value and gets `409 BINDING_REF_MISMATCH`, whatever mix of `active`, `siteUrl` and `bindingRef` it sends. |
| Staging | A create with `active: false` (§9.4, §9.5) stores an inactive record with its ref. Only a later conditional `PATCH {active: true, bindingRef: <new>, ifBindingRef: <the create ref>}` activates it. A create has no condition: it succeeds only if no record with the same unique key exists (`409 PLATFORM_ALREADY_EXISTS` or `409 DEPLOYMENT_ALREADY_EXISTS` otherwise, nothing changes). |
| Limit | The service compares with the current value only; it keeps no history of old values. It cannot prove that a value was never stored before: a caller with the API key can write `r1`, then `r2`, then `r1` again, or make an unconditional change, and an old request that expects `r1` then succeeds. It also does not know which caller is current or approved. The no-stale-write guarantee therefore comes from the **caller's protocol**. The Cogniate app writes each ref once, as a new random value that it never reuses, and records it before the call. It changes Canvas and Blackboard records only with conditional requests (app contract §4.7.1, I3). Other API key holders (the operator with raw API calls) are outside this guarantee. The app decides which values it may expect and which deployments have authority (app contract §6.1). |
| Compatibility | A request without `ifBindingRef` behaves as before (unconditional). Old rows have `null`. Moodle calls of the app send no ref and no condition. |

Use by the app (app contract §4.7.1, §4.9): every create of a Canvas or Blackboard record is inactive; every activation, adoption, switch-off and delete is conditional on a ref that the app read, and every conditional `PATCH` writes a new random ref that the app never reuses. Because no ref value returns, a delayed app request fails with `409 BINDING_REF_MISMATCH` instead of changing a record that another app request changed after it was sent.
