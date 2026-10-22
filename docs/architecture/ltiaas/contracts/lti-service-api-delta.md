# Contract delta: LTI service API (milestone LA)

Status: **Proposed** (P2 design, Architect-2 A2, 2026-10-22). Base: [LTI service contract](../../contracts/lti-service-api.md) (sections "§n" below are its sections). Scope and promises: [ADR-003](../../adr/ADR-003-ltiaas-compatibility-scope.md) P1–P7 stay. Decisions: [LA-ADR-05](../adr/LA-ADR-05-lti-advantage-completeness.md) (E3), [LA-ADR-06](../adr/LA-ADR-06-service-operability.md) (E5), [LA-ADR-07](../adr/LA-ADR-07-security-and-tenancy.md), [LA-ADR-08](../adr/LA-ADR-08-onboarding-and-connection-health.md) (E6), and the E1/E2 wire items of A1 ([LA-ADR-01 D6](../adr/LA-ADR-01-channel-kernel.md#d6-lti-profiles-in-the-lti-service), [LA-ADR-02 D2, D5](../adr/LA-ADR-02-generic-lti-channel.md#d2-profile-traits-added-in-e2)).

Rules for every row:

- **Additions only** on the LTIAAS-shaped surface: new optional request fields, new response fields, new codes with the same error body, new optional headers. No existing field changes name or meaning (ADR-003 P2–P4).
- New paths are "paths are ours" rows (§8 D4/D5 style).
- A request without the new fields behaves as in the base contract, except the three intended behaviour changes in §9.
- Priority marks: **Must**, **Should**, **Could** (plan v1 §3).

## 0. Change index

| # | Area | Change | Epic | Priority | Decision |
| --- | --- | --- | --- | --- | --- |
| C1 | All routes | Rate limits; `429 RATE_LIMITED` with `Retry-After` | E5 | Must | LA-ADR-06 D1 |
| C2 | Tool accounts | Status; per-account tool URLs; account resolver | E5 | Must | LA-ADR-06 D2 |
| C3 | Auth | API key scopes `launch`, `admin`; `403 API_KEY_SCOPE_MISSING`; two active keys | E5 | Must | LA-ADR-06 D5 |
| C4 | New listener | Operator API `/operator/v1/*`, scheme `OPERATOR-AUTH-V1` | E5 | Must | LA-ADR-06 D3 |
| C5 | Audit | One audit event per admin call; `GET /operator/v1/audit` (Must); `GET /api/audit` (Should) | E5 | Must / Should | LA-ADR-06 D4 |
| C6 | `GET /lti/keys/:account` | `active`, then `next`, then `retired` keys; retention from `retired_at` | E5 | Must | LA-ADR-06 D7 |
| C7 | Login, launch | Platform storage launch: login page, `POST /lti/launch/:account/storage-check` | E3 | Must | LA-ADR-05 D1 |
| C8 | `GET /api/idtoken` | `deepLinkingSettings.acceptLineItem`, `acceptMediaTypes`; service key without context | E3 | Must | LA-ADR-05 D2, D3 |
| C9 | Deep Linking | Empty `contentItems`; `accept_lineitem` rule; per-type fields (Should) | E3 | Must / Should | LA-ADR-05 D3 |
| C10 | Registration | `complete.scopes` (D-8); `complete.profile`, DR rule per profile, `grantedScopes`, `clientAssertionAud`; origin binding (I-SELF): `endpointsOnIssuerOrigin`, staged `complete` with `bindingRef`, answer `active` (E2) | E3, E2 | Must | LA-ADR-05 D4; LA-ADR-02 D2, D5 |
| C11 | `GET /api/providers` | Field `channel` per profile | E1 | Must | LA-ADR-01 D6 |
| C12 | Platform errors | `429 PLATFORM_RATE_LIMITED` with `Retry-After` and `details.retryAfter` | E4/E5 | Must | LA-ADR-03 D7; LA-ADR-06 |
| C13 | Account state | `403 TOOL_ACCOUNT_SUSPENDED` | E5 | Must | LA-ADR-06 D2 |
| C14 | Health | `/readyz`; minimal `/healthz` in the production profile; `/metrics` (internal) | E5 | Should | LA-ADR-06 D10 |
| C15 | Service keys | `POST /api/service-keys/revoke`; re-issue epoch; write scope | E5 | Should | LA-ADR-06 D8 |
| C16 | Idempotency | `Idempotency-Key` on three `POST` routes | E5 | Should | LA-ADR-06 D9 |
| C17 | Scores | `submission`, `scoringUserId`, URL-keyed members | E3 | Should | LA-ADR-05 D9 |
| C18 | Connection check | `POST /api/platforms/:id/check` | E6 | Could | LA-ADR-08 D4 |
| C19 | Small gaps | `scoreGiven: null`; NRPS `service_versions`; `trustedAudiences` | E3 | Could | LA-ADR-05 D10 |
| C20 | `POST /api/platforms` | Rules for the admin-value profiles `lti-generic` and `brightspace`: issuer with a path, reserved issuers and hosts, endpoints on other https origins only in a staged create (origin binding) | E2 | Must | LA-ADR-02 D2, D3, D6 |
| C21 | `GET /api/providers` | Trait fields `endpoints`, `issuerKind`, `endpointOrigins` per profile | E2 | Must | LA-ADR-02 D2 |

## 1. Conventions (changes to §1)

### 1.1 Tool accounts (§1.1)

New account fields (operator API only; never in `/api/*` answers except `GET /api/account`, Should):

| Field | Type | Default | Rule |
| --- | --- | --- | --- |
| `status` | `active` \| `suspended` \| `closed` | `active` | §1.5 |
| `launchUrl`, `deepLinkingUrl`, `registrationUrl` | https URL | from `PUBLIC_APP_URL` (`cogniate`, unchanged) | https; no user info; no fragment; ≤ 2,048 characters; host not the `PUBLIC_LTI_URL` or `PUBLIC_CONTENT_URL` host |
| `publicBaseUrl` | https origin or `null` | `null` (path mode) | Reserved for host mode (LG). LA refuses a non-null value with `400 INVALID_REQUEST` (field `publicBaseUrl`). |
| `limits` | object or `null` | `null` | per-class `{ ratePerMinute, burst }`, classes of §1.4 |
| `claimPolicy` | object or `null` | `null` = `passthrough`, only on accounts from before the column (a stored legacy marker, never an input: `null` in `POST` or `PATCH` gives `400 INVALID_REQUEST`, BD-A2-26); new accounts default to `allowlist` with every `keep` off | LA-ADR-05 D7 |
| `serviceKeyWriteScope` | `context` \| `resource-link` | `context` | Should, C15 |

Protocol URLs come from one account resolver: in path mode `{PUBLIC_LTI_URL}/lti/{login|launch|keys|register}/{accountId}` (today's values).

### 1.2 Authorization header (§1.2)

| Endpoint group | LTIK-AUTH-V2 | SERVICE-AUTH-V1 | Bearer | Needed API key scope |
| --- | --- | --- | --- | --- |
| `/api/idtoken`, `/api/deeplinking*` | yes | — | — | `launch` |
| `/api/lineitems*`, `/api/memberships` | yes | yes | — | `launch` |
| `/api/registrations/*`, `/api/platforms*`, `/api/providers` | — | — | yes | `admin` |
| `/api/service-keys/revoke`, `/api/audit`, `/api/account` (Should) | — | — | yes | `admin` |

- A valid API key without the needed scope: `403 API_KEY_SCOPE_MISSING` (the error body names the scope in `description`).
- An expired or revoked API key: the same `401` code as an unknown key (no hint).
- Operator listener only: `Authorization: OPERATOR-AUTH-V1 <OPERATOR_KEY>`, key format `ltio_` + 43 base64url characters. A tool account API key there, or an operator key on `/api/*`, is an unknown credential (`401`).

### 1.3 New error codes (§1.3)

Same body `{ status, error, details: { message, description } }`. Where marked, `details` has one more field.

| HTTP | `details.message` | When | Priority |
| --- | --- | --- | --- |
| 429 | `RATE_LIMITED` | A hard rate-limit bucket is empty (§1.4). Header `Retry-After` and `details.retryAfter` (the same whole seconds, 1–3,600; §1.6 rule). | Must |
| 429 | `PLATFORM_RATE_LIMITED` | The platform answered `429`, or `403` with a body that contains `Rate Limit Exceeded` (Canvas throttling, R4 B-3). Header `Retry-After` and `details.retryAfter` (seconds; §1.6 rule): the platform's `Retry-After` (seconds or HTTP date), clamped to 1–3,600; 60 when absent or not readable. `description` is a fixed text ("The platform asked us to wait before another request."); no platform body, header or status text goes into the answer. Before LA this was `502 PLATFORM_ERROR`. | Must |
| 403 | `TOOL_ACCOUNT_SUSPENDED` | The account of the API key is `suspended` (checked after authentication) | Must |
| 403 | `API_KEY_SCOPE_MISSING` | §1.2 | Must |
| 403 | `SERVICE_KEY_SCOPE` | A SERVICE-AUTH-V1 write outside the key's resource link when the account has `serviceKeyWriteScope: resource-link` | Should |
| 409 | `API_KEY_LIMIT` | A third active API key | Must |
| 409 | `ACCOUNT_ALREADY_EXISTS` | `POST /operator/v1/accounts` with an id that exists | Must |
| 409 | `ACCOUNT_CLOSED` | An operator write that adds, enables or changes anything on a `closed` account (LA-ADR-06 D2 "Operator writes on a closed account"). Writes that only remove access (revokes, retire immediate) and reads stay allowed. | Must |
| 409 | `SIGNING_KEY_NEXT_EXISTS` | A second `next` signing key. `details`: `kid` and `publishedAt` of the waiting key (BD-A2-23) | Must |
| 409 | `SIGNING_KEY_NOT_PUBLISHED_LONG_ENOUGH` | Activation before the publish lead time, without `force`. `details`: `kid`, `activatableAt` (ISO 8601: `publishedAt` + lead time) | Must |
| 409 | `SIGNING_KEY_ACTIVE` | `retire` of the active key. `details`: `kid` | Must |
| 409 | `SIGNING_KEY_WRONG_STATE` | A signing-key transition that the key's state does not allow: `activate` of a key that is not `next`; `retire` of a `removed` key (LA-ADR-06 D7). Only this meaning: "the account has no active key" is not an error (BD-A2-24, §3). `details`: `kid`, `keyStatus` (the key's current state; not `status`, which is the HTTP status of the body) | Must |
| 409 | `IDEMPOTENCY_IN_PROGRESS` | A request with the same `Idempotency-Key` still runs | Should |
| 422 | `IDEMPOTENCY_KEY_REUSED` | The same `Idempotency-Key` with another body | Should |
| 401 | `INVALID_OPERATOR_AUTHORIZATION_HEADER` | Operator listener: no header, another scheme, an unknown, expired or revoked operator key | Must |
| 503 | `NOT_READY` | `/readyz` and the operator API when the key provider or the database is not ready; `details.reasons` (list of short codes) | Should |

New protocol page codes (security §2.1, §2.2 page rules: code, trace id, one action line):

| Code | Status | Where | Action line |
| --- | --- | --- | --- |
| `RATE_LIMITED` | 429 | login, launch, storage check, registration start | "Too many requests. Wait one minute, then open the activity again from {LMS}." |
| `TOOL_ACCOUNT_SUSPENDED` | 403 | login, launch, registration start | "This Cogniate tool is switched off. Ask your Cogniate admin." |
| `REGISTRATION_SESSION_LIMIT` | 409 | registration start | "Too many registrations are open. Wait one hour, or finish the open registration in {LMS}." |

### 1.4 Rate-limit classes (new)

| Class | Routes | Key |
| --- | --- | --- |
| `protocol` (hard), `protocol_account` (soft: log and alert, never `429`) | `GET|POST /lti/login/:account`, `POST /lti/launch/:account`, `POST /lti/launch/:account/storage-check` | client address (IPv6: /64); tool account |
| `registration` (hard), `registration_account` (soft) | `GET /lti/register/:account` | client address; tool account. Plus at most 10 open sessions per client address and tool account (`registrationSessionsPerAddress`) |
| `keys` | `GET /lti/keys/:account` | client address |
| `api` | `/api/idtoken`, `/api/deeplinking*`, `/api/lineitems*`, `/api/memberships` | API key id |
| `admin` | every Bearer route | API key id |
| `auth_failure` | a `401` because the API key or operator key fails: every `401` before the key is proven valid (missing, malformed, a scheme the route does not accept, unknown, expired, revoked, a closed account's key). An ltik or service key `401` under a valid API key spends no bucket. | client address |
| `operator` | `/operator/v1/*` | operator key id |

Default limits: [LA-ADR-06 D1](../adr/LA-ADR-06-service-operability.md#d1-rate-limits-must). An operator changes them per account (`PATCH /operator/v1/accounts/:id {limits}`) or globally for every class (`PATCH /operator/v1/rate-limits`, §3). `/healthz`, `/readyz`, `/metrics` are never limited. The client address uses `X-Forwarded-For` only from `TRUSTED_PROXY_CIDRS`.

### 1.5 Account status (new)

| Status | Login, launch, storage check, registration start | `/api/*` | `GET /lti/keys/:account` |
| --- | --- | --- | --- |
| `active` | as before | as before | as before |
| `suspended` | `403` page `TOOL_ACCOUNT_SUSPENDED`; no state row | `403 TOOL_ACCOUNT_SUSPENDED` | served |
| `closed` | `404` page `UNKNOWN_TOOL_ACCOUNT` | `401` (keys revoked at close) | `404` |

### 1.6 Headers (new, optional for clients)

| Header | Direction | Rule |
| --- | --- | --- |
| `Retry-After` | answer | with `429 RATE_LIMITED` and `429 PLATFORM_RATE_LIMITED`. **One rule** (BD-A2-16): every API error whose `details` carry `retryAfter` gets the header; header and `details.retryAfter` are the same integer, 1–3,600 seconds (one normalizer; a value that is not a number gives 60). A `429` protocol HTML page (`RATE_LIMITED`) gets the header only. |
| `Idempotency-Key` | request | Should; §4.9 |

## 2. Protocol endpoints (changes to §2)

### 2.1 `GET|POST /lti/login/{toolAccountId}` (§2.1)

New optional input `lti_storage_target` (query or form body; ≤ 64 characters; `[A-Za-z0-9_-]` or `_parent`).

| Case | Answer |
| --- | --- |
| The platform profile has `platformStorage: null`, or it is `from-login` and the login has no `lti_storage_target` | `302` exactly as §2.1 |
| The profile has `platformStorage` and a target exists (the parameter, or the profile's fixed frame name) | `200 text/html` login page. Headers: `Set-Cookie` (the same state cookie as §2.1), `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, CSP `default-src 'none'; script-src 'nonce-…'; frame-ancestors https:; form-action 'none'; base-uri 'none'`. The page reads its values from one escaped JSON block, sends `lti.put_data` (key `cog_state_<d>`, `<d>` = the first hex digit of the state hash) to the storage origin, waits ≤ 1.5 s, then navigates to the auth URL. The auth URL equals the `Location` that the `302` would have. |

Rate limit: class `protocol`. Suspended account: §1.5.

### 2.2 `POST /lti/launch/{toolAccountId}` (§2.2) and the new storage check

| Case | Answer |
| --- | --- |
| State cookie present | as §2.2 |
| Cookie missing, state record without storage target | as §2.2 (`STATE_COOKIE_MISSING` page) |
| Cookie missing, state record with storage target | checks 1, 3, then 4–14 and the claim policy, as §2.2. Then `200 text/html` storage-check page (CSP as §2.1 row 2, but `form-action 'self'`; `Referrer-Policy: same-origin`). No ltik yet. |

New: `POST /lti/launch/{toolAccountId}/storage-check` (form `check`, `value`):

| Result | Answer |
| --- | --- |
| `Origin` is not the origin of `PUBLIC_LTI_URL` | `400` page `INVALID_STATE`, detail `storage_origin`; the check stays unused |
| Check row unknown, used or older than 120 s | `400` page `INVALID_STATE`; log `launch_check_failed {check: "storage", code: "INVALID_STATE", detail: "storage_check_unknown_used_or_expired"}` |
| `value` empty | `400` page `STATE_COOKIE_MISSING` with the storage help text ([LA-ADR-05 D1 rule 8](../adr/LA-ADR-05-lti-advantage-completeness.md#d1-platform-storage-launch-must-d-4)) |
| `SHA-256(value)` ≠ the state hash | `400` page `INVALID_STATE`, detail `storage_mismatch` |
| Match | `303` to the tool exactly as §2.2 (ltik, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`); log `launch_accepted {platform_id, message_type, binding: "storage"}` |

`GET` (any method except `POST`) on the storage-check path: `405 METHOD_NOT_ALLOWED`, `Allow: POST`.

### 2.3 `GET /lti/keys/{toolAccountId}` (§2.3)

The key list is: the `active` key first, then the `next` key, then `retired` keys while `now < retired_at + 30 days`. The first key is always the active key (the app's inline Canvas export reads it). `Cache-Control: public, max-age=300` stays. A `closed` account: `404`.

### 2.4 `GET /lti/register/{toolAccountId}` (§2.4)

- Rate limits `registration` and `registration_account` (soft); at most 10 open sessions per client address and tool account (`409` page `REGISTRATION_SESSION_LIMIT`, no outbound fetch).
- E2 (A1, [LA-ADR-02 D5](../adr/LA-ADR-02-generic-lti-channel.md#d5-generic-dynamic-registration-fixes-must)): the start page applies the loosest Dynamic Registration rule of any profile (`path-prefix` issuer rule; Moodle JWT or opaque Bearer token). `complete` applies the exact rule of the chosen profile (§4.5).

### 2.5 `GET /healthz` (§2.5) and `GET /readyz` (new, Should)

- `/healthz`: unchanged in the `default` and `acceptance` profiles. In the `production` profile: `200 {"status":"ok","service":"lti-service"}` only.
- `/readyz` (public listener and operator listener): `200 {"status":"ready"}` or `503 {"status":"not_ready"}`; the operator listener answer adds `reasons` (`database`, `migrations`, `key_version_missing`).
- `/metrics` (operator listener only): OpenMetrics text ([operability §4](../operability.md)).

### 2.6 `POST /api/platforms/:id/check` (new, Could)

Bearer, `admin` scope. Body `{ "deploymentId"?: string }`. It fetches the platform JWKS and requests one token with one granted AGS scope; it reads no course data and returns no token.

```json
{ "checkedAt": "2026-11-02T08:15:00.000Z",
  "jwks": { "ok": true, "keys": 2 },
  "token": { "ok": false, "detail": "invalid_client" },
  "platform": { "active": true, "deploymentActive": true },
  "limits": null }
```

`token.detail` values: `invalid_client`, `invalid_scope`, `http_<status>`, or an outbound reason (security §9). `limits` is `"shared-application"` for a shared platform. One check per platform and deployment per minute (`429 RATE_LIMITED`). Log `platform_check {platform_id, jwks, token}`. The check runs only for an **active** platform and deployment (else `403 PLATFORM_NOT_ACTIVE` or `403 DEPLOYMENT_NOT_ACTIVE`, base codes): so a client assertion goes only to a token endpoint that the binding proved (issuer origin) or that an operator grant approved (A-LAD-01).

## 3. Operator API (new; paths are ours)

Listener `OPERATOR_HOST:OPERATOR_PORT` (default `127.0.0.1:4110`; the `acceptance` compose profile binds `0.0.0.0` so that the `e2e` container reaches `http://lti-service:4110`); not routed by the proxy in any profile. Auth §1.2. Same error body. Every non-`GET` call writes one audit event (§5); `GET /operator/v1/audit` writes `audit.read`.

| Method and path | Request | Success | Priority |
| --- | --- | --- | --- |
| `GET /operator/v1/accounts` | query `status`, `cursor`, `limit` (≤ 100) | `200 { accounts: [Account], next? }` | Must |
| `POST /operator/v1/accounts` | `{ id, name, launchUrl, deepLinkingUrl, registrationUrl, limits?, claimPolicy? }` | `201 Account`. `409 ACCOUNT_ALREADY_EXISTS`. Also makes the first `active` signing key, in the same transaction as the account (no publish lead time; one `account.create` audit event with `details.kid`; LA-ADR-06 D7 "First key"). No API key (use the next row); the frozen column `tool_account.api_key_hash` gets the hash of an unusable random value (LA-ADR-06 D5). | Must |
| `GET /operator/v1/accounts/:id` | — | `200 Account` | Must |
| `PATCH /operator/v1/accounts/:id` | any of `name`, tool URLs, `status`, `limits`, `claimPolicy`, `serviceKeyWriteScope` | `200 Account`. `status: closed` is final (`409 ACCOUNT_CLOSED` for a later change). | Must |
| `GET /operator/v1/rate-limits` | — | `200 { classes: { <class>: { ratePerMinute, burst, source } }, registrationSessionsPerAddress: <integer>, registrationSessionsSource }`; `source` and `registrationSessionsSource` = `operator`, `env` or `default` | Must |
| `PATCH /operator/v1/rate-limits` | `{ classes?: { <class>: { ratePerMinute, burst } \| null }, registrationSessionsPerAddress?: <integer 1–1,000> \| null }` (`null` removes the operator value; BD-A2-18) | `200` as `GET`. Applies at once; stored in `service_setting` (key `rate_limits`, one row). Unknown class, unknown top-level field, a rate or burst below 1, or a cap outside 1–1,000: `400 INVALID_REQUEST` with the field. | Must |
| `GET /operator/v1/accounts/:id/api-keys` | — | `200 { apiKeys: [{ id, prefix, label, scopes, createdAt, createdBy, expiresAt, lastUsedAt, revokedAt }] }`. `prefix` is `null` for a key from the migration backfill (label `bootstrap`, `createdBy` `system:bootstrap`); key ids are opaque (LA-ADR-06 D5 "Backfill values"). | Must |
| `POST /operator/v1/accounts/:id/api-keys` | `{ label, scopes: ["launch","admin"], expiresAt? }` | `201 { id, apiKey, prefix, label, scopes, expiresAt }`; `apiKey` is shown only here. `409 API_KEY_LIMIT`. `expiresAt` outside 1 hour to 2 years from now: `400 INVALID_REQUEST` (field `expiresAt`). `409 ACCOUNT_CLOSED` on a closed account. | Must |
| `POST /operator/v1/accounts/:id/api-keys/:keyId/revoke` | — | `200` key metadata with `revokedAt` Idempotent: a revoked key, also on a closed account, gives `200` and keeps the first `revokedAt`. | Must |
| `GET /operator/v1/accounts/:id/signing-keys` | — | `200 { signingKeys: [{ kid, status, publishedAt, activatedAt, retiredAt, removedAt }] }` (public data only) | Must |
| `POST /operator/v1/accounts/:id/signing-keys` | — | `201 { kid, status: "next", publishedAt }`. `409 SIGNING_KEY_NEXT_EXISTS`. On an account with **no** `active` key (a recovery case; normal paths always keep one): `201 { kid, status: "active", publishedAt }`, active at once with no publish lead time, because nothing can sign before (BD-A2-24). | Must |
| `POST /operator/v1/accounts/:id/signing-keys/:kid/activate` | `{ force?: boolean }` | `200 { kid, status: "active", activatedAt, retired: <old kid> \| null }` (`null` when no key was active). `409 SIGNING_KEY_NOT_PUBLISHED_LONG_ENOUGH`. `409 SIGNING_KEY_WRONG_STATE` when the key is not `next`. | Must |
| `POST /operator/v1/accounts/:id/signing-keys/:kid/retire` | `{ immediate: true }` (only valid value in LA) | `200 { kid, status: "removed" }` for a `retired` or a `next` key. `409 SIGNING_KEY_ACTIVE`. `409 SIGNING_KEY_WRONG_STATE` for a `removed` key. Without `immediate: true`: `400 INVALID_REQUEST` (field `immediate`), with the text 'retire needs {"immediate": true} (removes the key at once). A key becomes retired when the next key is activated.' | Must |
| `POST /operator/v1/accounts/:id/shared-platforms` | `{ profile, clientId, name? }` | `201` platform, or `200` for the same client id (the rules of §9.12 CLI). `409 SHARED_PLATFORM_EXISTS` for another client id. | Must |
| `GET /operator/v1/key-provider` | — | `200 { kind, activeVersion, versions: [{ id, state, sealedCount, derivedCount }] }` | Must |
| `POST /operator/v1/key-provider/rewrap` | — | `202 { job: "key-rewrap", traceId }` (runs the on-demand job) | Must |
| `GET /operator/v1/audit` | query `toolAccountId`, `action`, `actorId`, `since`, `until`, `cursor`, `limit` (≤ 500) | `200 { events: [AuditEvent], next? }`, newest first | Must |
| `GET /operator/v1/operator-keys` | — | `200 { operatorKeys: [{ id, operator, createdAt, expiresAt, lastUsedAt, revokedAt }] }` | Must |
| `POST /operator/v1/operator-keys` | `{ operator, expiresAt? }` | `201 { id, operatorKey, operator, expiresAt }` (shown once). Default 90 days; `expiresAt` outside 1 hour to 1 year from now: `400 INVALID_REQUEST` (field `expiresAt`). | Must |
| `POST /operator/v1/operator-keys/:id/revoke` | — | `200` (an operator cannot revoke the key of its own request: `409 OPERATOR_KEY_IN_USE`) | Must |
| `POST /operator/v1/accounts/:id/service-keys/revoke` | `{ platformId, deploymentId?, contextId?, resourceLinkId? }` | `200 { revoked: <n> }` | Should |
| `GET /operator/v1/jobs` | — | `200 { jobs: [{ name, everyMs, lastRunAt, lastResult }] }` | Should |
| `POST /operator/v1/jobs/:name/run` | — | `202 { job, traceId }`, or `409 JOB_RUNNING` (`skipped_lease`) | Should |

`Account` = the fields of §1.1 plus `id`, `name`, `createdAt`, `statusChangedAt`, `protocolUrls { login, launch, keys, register }`. It never contains a key.

`AuditEvent` = `{ id, ts, actor: { type, id }, toolAccountId, action, target: { type, id }, result, code, traceId, clientIp, details }` (LA-ADR-06 D4).

Unknown ids: on every `/operator/v1/accounts/:id/…` path, an unknown account `:id`, or a sub-resource id (`:kid`, `:keyId`) that does not exist or belongs to another account, gives `404 NOT_FOUND`. A state conflict gives `409` with its own code, never `400`; `400 INVALID_REQUEST` is for the body and query only (build decisions A2 BD-A2-06).

CLI mapping (same commands, same output lines; the CLIs call the API above):

| CLI | Calls |
| --- | --- |
| `lti:operator init --name <n>` | none: the only direct database write (first operator key) |
| `lti:bootstrap --account --name [--rotate-api-key] [--rotate-signing-key]` | `POST` or `PATCH /operator/v1/accounts`; `POST …/api-keys` (with `--rotate-api-key`: then revoke every other key); `POST …/signing-keys` + `activate {force: true}` (with `--rotate-signing-key`; when a `next` key exists, first `POST …/signing-keys/<next kid>/retire {immediate: true}`; LA-ADR-06 D7 "CLI") |
| `lti:shared-platform` | `POST /operator/v1/accounts/:id/shared-platforms` |

## 4. Tenant API (changes to §3 and §9)

### 4.1 `GET /api/idtoken` (§3.1)

| Field | Change | Priority |
| --- | --- | --- |
| `launch.deepLinkingSettings.acceptLineItem`, `acceptMediaTypes` | additions, from `accept_lineitem`, `accept_media_types` | Must |
| `services.serviceKey` | also for a resource link launch without a context (key scope with context `""`) | Must |
| `launch.custom`, raw claims | follow the claim policy (`{}` and absent when removed) | Should |
| `platform.channel` | — (not added; the channel is on `GET /api/providers`) | — |

### 4.2 Deep Linking (§3.2)

| Rule | Change | Priority |
| --- | --- | --- |
| Item count | 0 to 20 items; `accept_multiple: false` allows 0 or 1. `contentItems: []` signs a response with `content_items: []`. | Must |
| `accept_lineitem: false` | an item with `lineItem` → `400 INVALID_CONTENT_ITEM` ("the platform does not accept line items") | Must |
| Per type | `link`, `file`, `image`: https `url` required; `html`: string `html` required; else `400 INVALID_CONTENT_ITEM` with the index | Should |

### 4.3 Scores (§3.6)

| Field | Change | Priority |
| --- | --- | --- |
| `submission` | optional `{ startedAt?, submittedAt? }` (ISO 8601), sent as given | Should |
| `scoringUserId` | optional string, sent as given; also returned by scores `GET` | Should |
| URL-keyed members | members whose key is an absolute https URL (≤ 8, each ≤ 4 KB JSON) are sent as given; results return them | Should |
| `scoreGiven: null` | same as absent | Could |

Platform `429` (or Canvas throttling `403`): `429 PLATFORM_RATE_LIMITED` (§1.3) on every `/api/lineitems*` and `/api/memberships` call, and on the token request behind them.

### 4.4 `GET /api/memberships` (§3.7)

Unchanged (D-8 keeps the endpoint). Could: a claim whose `service_versions` exists and has no `2.0` → `403 SERVICE_NOT_AVAILABLE`.

### 4.5 Dynamic Registration (§3.8)

`POST /api/registrations/:registrationId/complete` new optional fields:

| Field | Rule | Priority |
| --- | --- | --- |
| `scopes` | a non-empty subset of the five scopes of ADR-009; sent as the registration request `scope`. Absent = the five scopes (as today). The Cogniate app sends its channel's `registration.scopes` (the four AGS scopes, LA-ADR-05 D4). A scope that the platform does not list in `scopes_supported` → `400 INVALID_REQUEST` (field `scopes`) before anything is sent (LA-ADR-02 D5 item 5). | Must |
| `profile` | the profile of the connection's channel (A1, LA-ADR-02 D5): `complete` applies that profile's Dynamic Registration rule before it sends anything. Absent = `standard`. | Must (E2) |

| `bindingRef` | the connection's binding ref. Required when the profile's Dynamic Registration can be staged (every `any-https` profile, and the Canvas profiles of LA-ADR-05 D6); the service uses it only for a staged platform (base §9.15) | Must (E2) |

The stored platform gets `grantedScopes` (the scope of the registration response) and, when the configuration has `authorization_server`, `clientAssertionAud` (LA-ADR-02 D5 items 4 and 7). Token requests ask only for granted scopes.

**Origin binding (A-LAD-01, Must; I-SELF of [LA-ADR-02 D2a](../adr/LA-ADR-02-generic-lti-channel.md#d2a-self-invariant-must-reviewer-a-a-lad-01), D5 item 10).** The issuer host vouches only for its own origin. So a platform that `complete` makes **active** keeps the auth, token, JWKS and registration endpoints and the client assertion audience (`authorization_server`, when present) on the issuer origin, as today (`services/lti-service/src/lti/registration.ts:60-69`):

- `GET /api/registrations/:registrationId` adds `endpointsOnIssuerOrigin: boolean` (`true` when I-SELF holds for the configuration), so the app can tell the user before `complete` that an operator approval will be needed.
- `complete` checks I-SELF for the chosen profile before it sends anything. Holds: the platform is created as today (`autoActivate`, default `true`). Fails: the platform is created **inactive** with the request's `bindingRef` (a staged registration, base §9.15), whatever `autoActivate` says; a missing `bindingRef` gives `400 INVALID_REQUEST` (field `bindingRef`), and nothing is sent or stored.
- The answer adds `active: boolean`; a staged registration logs `registration_completed {operation, staged: true}`. The app then changes the connection's authority from `self` to `operatorGrant` (A1, LA-ADR-02 D5 item 10), and only the grant redemption activates the platform (`PATCH /api/platforms/:id {active: true, ifBindingRef, bindingRef}`), as for Canvas DR ([LA-ADR-05 D6](../adr/LA-ADR-05-lti-advantage-completeness.md#d6-canvas-dynamic-registration-should-d-1)).
- The configuration endpoints also follow §4.6.1 rules 1 to 3 (reserved hosts and issuers).
- Fixed-endpoint profiles keep their own rule (`issuerRule: profile`): their endpoints must equal the profile values, and the platform is always staged (LA-ADR-05 D6).

### 4.6 Platforms (§3.9, §9.4)

| Field | Change | Priority |
| --- | --- | --- |
| `clientAssertionAud` | optional admin value on create and in answers (A1, LA-ADR-02 D2). An **active** platform of an admin-value profile has it empty or equal to the token URL (§4.6.1 rule 7) | Must (E2) |
| `grantedScopes` | answer field; `null` for old rows (= every requested scope) | Must (E2) |
| `trustedAudiences` | optional list of extra `aud` values that launch check 5 allows; default `[]` | Could |
| `Idempotency-Key` | on `POST /api/platforms` and `POST /api/platforms/:id/deployments` (§4.9) | Should |

Every successful or refused platform and deployment write makes one audit event (§5).

#### 4.6.1 `POST /api/platforms` for the admin-value profiles `lti-generic` and `brightspace` (E2, Must)

A1 decides the rules ([LA-ADR-02 D2, D3, D6](../adr/LA-ADR-02-generic-lti-channel.md#d2-profile-traits-added-in-e2)); this row is the wire form. It adds rows to the per-profile table of base §9.4. The rule set comes from the profile traits (`endpoints: admin`, `issuerKind: per-tenant`, `endpointOrigins: any-https`), not from the profile id, so a later admin-value profile with the same traits gets the same rules.

| Profile traits | Required | Optional | Rules |
| --- | --- | --- | --- |
| `endpoints: admin`, `endpointOrigins: issuer` (`standard`) | as §3.9 | as §9.4 | **Unchanged** (security §2.4): every endpoint on the issuer origin, else `400 PLATFORM_URL_NOT_ON_ISSUER_ORIGIN`; reserved issuer → `400 ISSUER_RESERVED`. |
| `endpoints: admin`, `endpointOrigins: any-https` (`lti-generic`, `brightspace`) | `profile`, `url` (issuer), `clientId`, `name`, `authenticationEndpoint`, `accesstokenEndpoint`, `authConfig` (`JWK_SET`), `deploymentIds` (≥ 1) | `clientAssertionAud` (1–2,048 characters; §4.6), `active` (`false` = staged create, §9.15), `bindingRef` | See the rule list below. `siteUrl` and `serviceUrl` must be absent (`400 INVALID_REQUEST`, field name): the site origin is the issuer origin. |

Rules for `endpointOrigins: any-https`:

1. **Issuer.** `url` is https with no user info, no query and no fragment. It **may have a path** (for example `https://lms.school.edu/sakai`). Its origin, in canonical form, passes site rules 1–3 (ADR-011 §6: rule 1 applies to the origin only), and its host is not a fixed host of any loaded profile. Else `400 INVALID_SITE_URL`, `details.field = "url"`, `details.rule`.
2. **Endpoints.** `authenticationEndpoint`, `accesstokenEndpoint` and `authConfig.key` are https URLs with no user info and no fragment. In a **staged** create (rule 7) they may be on any origin (for example the D2L token host `auth.brightspace.com`). The host of each URL passes site rules 2–3, and it is **not a fixed host or a fixed-issuer host of any loaded profile**, with any port (for example `sso.canvaslms.com`, `canvas.instructure.com`, `developer.blackboard.com`, `blackboard.com`; A-LAD-01). Else `400 PLATFORM_URL_NOT_IN_PROFILE` with `description` naming the field and the rule (`rule 2`, `rule 3` or `reserved host`).
3. **Reserved issuers.** The issuer origin must not be a reserved issuer origin: `400 ISSUER_RESERVED`, as for `standard`. The reserved set is the set of fixed issuer values (an https URL, not a `{siteUrl}` template and not `null`) of every loaded profile, from profile data (LA-ADR-01 D6; if A1 keeps the trait `issuerKind`, a load check makes it agree with the issuer value, B-LAD-14). For the baseline it equals the list of base §9.1 (the `.sim.test` issuers only when simulations are on).
4. **Later calls.** The service never fetches the URLs at create. Every later call (JWKS, token, AGS) goes through the guarded client (security §9; site rule 6).
5. **Check order** (as base §9.4): body schema, `UNKNOWN_PROFILE`, `UNSUPPORTED_AUTH_METHOD`, rule 2 (`PLATFORM_URL_NOT_IN_PROFILE`), rule 3 (`ISSUER_RESERVED`), rule 1 (`INVALID_SITE_URL`), rule 7 (`PLATFORM_URL_NOT_ON_ISSUER_ORIGIN`), `PLATFORM_ALREADY_EXISTS`.
6. **Answer.** As base §9.4. `siteUrl` and `serviceUrl` are `null`; the site origin of every deployment is the issuer origin. The create logs `platform_created {platform_id, profile}`.
7. **Origin binding (A-LAD-01; I-SELF, LA-ADR-02 D2a).** An **active** create (`active` absent or `true`) needs `authenticationEndpoint`, `accesstokenEndpoint` and `authConfig.key` on the issuer origin, and `clientAssertionAud` absent or equal to `accesstokenEndpoint`. Else `400 PLATFORM_URL_NOT_ON_ISSUER_ORIGIN` (`description` names the field). Values off the issuer origin need a staged create (`active: false` with a `bindingRef`); the app activates the platform only after an operator grant that binds every admin value (LA-ADR-02 D6). This service does not check the grant; the `ifBindingRef` condition of the activation ties it to the app's committed grant (base §9.15). At `complete` (§4.5) the service does not refuse: it stages the platform instead (LA-ADR-02 D5 item 10).

The Cogniate app maps `PLATFORM_URL_NOT_IN_PROFILE` to `422 INVALID_PLATFORM_VALUES` with the field name, and `INVALID_SITE_URL` to `422 INVALID_SITE_URL` ([app API delta §3.4](cogniate-app-api-delta.md#34-put-app-apiconnectionsidplatform)). The operator grant binds every admin value (LA-ADR-02 D6); this service does not check grants (base §9 note).

### 4.7 `GET /api/providers` (§9.3)

Each profile entry gets `channel` (the id of the channel whose folder holds the profile, LA-ADR-01 D6). `lms` stays frozen: its value comes from the profile field `wireLms` (LA-ADR-01 D6, Q-LAD-17), so the baseline profiles keep `canvas`, `blackboard` and `null`; a profile without `wireLms` (every new profile) shows its channel id. Order unchanged for the baseline profiles. Tests must not compare `label` (unchanged rule).

E2 (Must, [LA-ADR-02 D2](../adr/LA-ADR-02-generic-lti-channel.md#d2-profile-traits-added-in-e2)) adds three trait fields to every entry. The app reads `endpoints` to choose the values that a grant binds (LA-ADR-02 D6).

| Field | Values | `standard` | Canvas cloud profiles, `canvas-sim-cloud` | `canvas-self-hosted` | `blackboard`, `blackboard-sim` | `lti-generic`, `brightspace` |
| --- | --- | --- | --- | --- | --- | --- |
| `endpoints` | `admin` \| `fixed` | `admin` | `fixed` | `fixed` | `fixed` | `admin` |
| `issuerKind` | `per-tenant` \| `fixed` | `per-tenant` | `fixed` | `per-tenant` | `fixed` | `per-tenant` |
| `endpointOrigins` | `issuer` \| `any-https` \| `null` (fixed profiles) | `issuer` | `null` | `null` | `null` | `any-https` |

New entries for `lti-generic` and `brightspace` have the base field shape with `issuer`, `authenticationEndpoint`, `accesstokenEndpoint` and `jwksUrl` `null` (admin values, like `standard`), `siteUrlOn: null`, `serviceUrl: false`, `sharing: "exclusive"`, `sharedPlatform: null`. They come after the baseline real profiles and before the simulation profiles (LA-ADR-01 D4 order rule). The golden `GET /api/providers` of the baseline profiles differs only by the additive fields `channel` (E1) and the three trait fields (E2-K); LA-IC-01 names all four ([LA-ADR-04 D8](../adr/LA-ADR-04-refactor-and-migration.md#d8-intended-behaviour-changes-ids-la-ic-nn)).

### 4.8 New tenant routes (Should)

| Method and path | Auth | Request | Success |
| --- | --- | --- | --- |
| `POST /api/service-keys/revoke` | Bearer `admin` | `{ platformId, deploymentId?, contextId?, resourceLinkId? }` | `200 { revoked: <n> }`. The next launch of a revoked scope gets a new key value (epoch + 1). |
| `GET /api/audit` | Bearer `admin` | query as §3 audit, own account only | `200 { events, next? }` |
| `GET /api/account` | Bearer `admin` | — | `200 { id, name, status, protocolUrls, launchUrl, deepLinkingUrl, registrationUrl }` |

### 4.9 `Idempotency-Key` (Should)

On `POST /api/lineitems`, `POST /api/platforms`, `POST /api/platforms/:id/deployments`: 1–64 characters `[A-Za-z0-9_-]`. For 24 hours per tool account: the same key with the same body (SHA-256) gives the stored status and body and makes no platform call; another body gives `422 IDEMPOTENCY_KEY_REUSED`; a running request gives `409 IDEMPOTENCY_IN_PROGRESS`.

## 5. Audit actions (new)

One event per authenticated, non-`GET` admin or operator call (`ok` or `refused` with the code). The breakdown tests each row (LA-ADR-06 AP-06-14).

| Route | `action` | `target.type` |
| --- | --- | --- |
| `POST /api/platforms` | `platform.create` | `platform` |
| `PATCH /api/platforms/:id` | `platform.update` | `platform` |
| `DELETE /api/platforms/:id` | `platform.delete` | `platform` |
| `POST /api/platforms/:id/deployments` | `deployment.create` | `deployment` |
| `PATCH /api/platforms/:id/deployments/:deploymentId` | `deployment.update` | `deployment` |
| `POST /api/registrations/:id/complete` | `registration.complete` | `registration` |
| `POST /api/service-keys/revoke` (Should) | `service_key.revoke` | `platform` |
| `POST /api/platforms/:id/check` (Could) | `platform.check` | `platform` |
| `POST`, `PATCH /operator/v1/accounts[/:id]` | `account.create`, `account.update` (`account.status` when `status` really changes, decided inside the change transaction; a refused `PATCH` is `account.update` with the request fields in `details`; BD-A2-29) | `account` |
| `POST …/api-keys`, `…/revoke` | `api_key.issue`, `api_key.revoke` | `api_key` |
| `POST …/signing-keys`, `…/activate`, `…/retire` | `signing_key.create`, `signing_key.activate` (`details.forced`), `signing_key.retire` | `signing_key` |
| `POST …/shared-platforms` | `platform.create_shared` | `platform` |
| `POST /operator/v1/key-provider/rewrap` | `key_provider.rewrap` (one more event at the job end with counts) | `key_provider` |
| `PATCH /operator/v1/rate-limits` | `settings.rate_limits` | `settings` |
| `POST`, `…/revoke /operator/v1/operator-keys` | `operator_key.issue`, `operator_key.revoke` | `operator_key` |
| `POST /operator/v1/jobs/:name/run` (Should) | `job.run` | `job` |
| `GET /operator/v1/audit` | `audit.read` | `audit` |
| `lti:operator init` | `operator_key.issue` (actor `system:bootstrap`) | `operator_key` |

## 6. Log events (additions to §5 and §9.11)

| Event | Level | Fields | When |
| --- | --- | --- | --- |
| `rate_limited` | warn | `class`, `key_kind`, `tool_account_id`?, `client_ip`? (address classes only), `retry_after_s` | at most once per bucket per minute |
| `rate_limit_soft` | warn | `class`, `tool_account_id` | a soft class above its rate; at most once per minute |
| `platform_rate_limited` | warn | `platform_id`, `status`, `retry_after_s` | a platform `429` or throttling `403` |
| `account_status_changed` | info | `tool_account_id`, `status` | operator change |
| `api_key_issued`, `api_key_revoked` | info | `tool_account_id`, `api_key_id` | operator change |
| `signing_key_changed` | info | `tool_account_id`, `kid`, `status` | create, activate, retire, remove |
| `key_provider_not_ready` | error | `version` | start or readiness |
| `key_open_failed` | error | `table` | a sealed value does not open |
| `job_run` | info | `job`, `ms`, `result`, `counts` | every job run (LA-ADR-03 D7) |
| `platform_check` | info | `platform_id`, `jwks`, `token` | §2.6 |
| `config_refused` | error | `reason` | production profile start refusal |

Changed: `http_request`, `api_auth_failed` (when the path names the account), `login_rejected`, `launch_check_failed`, `launch_accepted` get `tool_account_id` when it is known. `launch_check_failed` gets `check: "storage"`. `launch_accepted` gets `binding: "cookie" | "storage"`. `launch_claims_minimized` can appear for every profile (claim policy). No field holds a secret, a token or personal data.

## 7. Data retention (additions to §6)

| Data | Retention |
| --- | --- |
| `storage_check` rows | 10 minutes |
| `audit_event` rows | `AUDIT_RETENTION_DAYS` (default 400; LA-H4) |
| `idempotency_record` rows | 24 hours |
| Closed account data | `closedRetentionDays` (default 30; LA-H4), then the `account-purge` job (Should) |
| Removed signing keys | the private part is zeroed when the key becomes `removed`; the public part stays for audit |

## 8. Differences from the public LTIAAS API (new rows for §8)

| # | Topic | Public LTIAAS docs | Ours |
| --- | --- | --- | --- |
| D22 | Rate limits | Not in our copy of the public reference | `429 RATE_LIMITED` with `Retry-After` on every route class (§1.4) |
| D23 | Platform throttling | — | `429 PLATFORM_RATE_LIMITED` with `Retry-After` and `details.retryAfter`; before LA, `502 PLATFORM_ERROR` |
| D24 | API key scopes and lifecycle | One API key per account (dashboard) | Scopes `launch` and `admin`, two active keys, expiry, revoke through our operator API; `403 API_KEY_SCOPE_MISSING` |
| D25 | Operator API | Dashboard (out of scope, ADR-003) | Our internal operator API `/operator/v1/*` with its own credential; paths are ours |
| D26 | Account status | — | `403 TOOL_ACCOUNT_SUSPENDED` |
| D27 | Tool JWKS | — | `active`, `next`, `retired` keys; retention 30 days from retirement |
| D28 | Platform storage launch | — | A login page instead of `302` when the profile has platform storage and a target exists; `POST /lti/launch/:account/storage-check` (paths are ours) |
| D29 | Deep Linking additions | — | Empty `contentItems` allowed; `accept_lineitem` enforced; `acceptLineItem`, `acceptMediaTypes` in the token |
| D30 | Registration `scopes` and `profile` | — | Optional `complete` fields; platform `grantedScopes`, `clientAssertionAud` |
| D31 | Service key revoke and audit read (Should) | — | `POST /api/service-keys/revoke`, `GET /api/audit`, `GET /api/account` (paths are ours) |
| D32 | `Idempotency-Key` (Should) | — | Optional header on three `POST` routes |
| D33 | `GET /api/providers` `channel` and traits | — (our addition, §9.3) | Fields `channel`, `endpoints`, `issuerKind`, `endpointOrigins`; `lms` frozen |
| D34 | Score extras (Should) | — | `submission`, `scoringUserId`, URL-keyed members passed through |
| D35 | Platform URL rules per profile | Platform `url` and endpoints are admin values (no origin rule in our copy of the public reference) | An **active** admin-value platform keeps its endpoints and the assertion audience on the issuer origin (`PLATFORM_URL_NOT_ON_ISSUER_ORIGIN`). Admin-value profiles with `endpointOrigins: any-https` (`lti-generic`, `brightspace`) accept an issuer with a path and endpoints on other https origins only in a staged create (`active: false`, then activation after an operator grant); reserved issuers and fixed hosts of any profile are refused (§4.5, §4.6.1). |

The release claim stays the ADR-003 wording until Q1 / LA-H2.

## 9. Compatibility

Intended behaviour changes (each with an id of LA-ADR-04 D8 and its reviewed test-change list, plan LD-9):

| Change | Id | Who sees it | Note |
| --- | --- | --- | --- |
| `429` above the limits | LA-IC-10 | every client | The defaults are far above test traffic; QA records the T7 request rate (LA-ADR-06 §5, §6). |
| Platform `429` and throttling `403` become `429 PLATFORM_RATE_LIMITED` (was `502 PLATFORM_ERROR`) | LA-IC-11 | tool back ends | The Cogniate outbox maps it to `throttled` (LA-ADR-03 D7). Today's worker retries every status that is not 2xx, 400, 403, 404, 409 or 422 (`packages/tracking/src/outcome.ts:107-115`), so a worker from before E4 also retries a `429`, as it retried the `502`. |
| The Cogniate channels ask for four scopes, not five (D-8) | LA-IC-04 | new Moodle, Canvas, Blackboard installs | `complete.scopes`; existing installs keep their grants. |
| Login page instead of `302` when the profile has platform storage and a target exists | LA-IC-06 | platforms that send `lti_storage_target` (Canvas, from E3) | Moodle: no change. |
| Empty `contentItems` allowed; `accept_lineitem: false` enforced; `acceptLineItem`, `acceptMediaTypes` in the token | LA-IC-12 | tool back ends | LA-ADR-05 §5. |
| Service key for a launch without a context | LA-IC-05 | tool back ends | Addition: `services.serviceKey` now present where it was absent. |
| Origin binding (I-SELF): an active admin-value platform keeps its endpoints and assertion audience on the issuer origin; off-origin values only in a staged create or a staged registration | none (new profiles only) | `lti-generic`, `brightspace` | No baseline change: `standard` already keeps every endpoint on the issuer origin, and Moodle sends every configuration value on its own origin (security §2.4). |

Unchanged for clients that send no new field: every path, field and code of the base contract; the `302` login for Moodle; the ltik and service key formats; generation-0 service key values; `/healthz` in the `default` and `acceptance` profiles.

Test notes: the closed lists of the base contract (§1.3 code table, §5 event table) grow; QA's open-world rewrite of LD-1 covers code and event lists. The golden `GET /api/providers` (LA-ADR-04) differs only by `channel` (E1) and the three trait fields of §4.7 (E2-K).
