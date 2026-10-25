# R4: Service operability, security and LTIAAS-compatibility audit

Researcher R4, milestone LA, 2026-10-22. Evidence SHA: worktree `HEAD` `9fcfd72`. The product code, `infra/**`, `docs/architecture/**` and `docs/human_review/**` are identical to the base `00977f8` (`git diff --stat 00977f8 HEAD` on those paths is empty).

## Summary

1. The LTI protocol core is strong. The SSRF guard, the secret redaction, hashed tokens, account-scoped queries and the durable score outbox are already production-shaped. Do not redesign them.
2. The operations layer is prototype-shaped. There is no rate limiting, no metrics, no audit log, no tenant deletion and no admin API above one tool account.
3. Multi-tenancy is only half built. Every tool account sends its launches to the Cogniate app (`PUBLIC_APP_URL`). A second tool tenant cannot get its own launch URL.
4. The key lifecycle is weak. One API key per account has no overlap at rotation. The signing key rotation has no publish-first step and no test (A-T0-16). The JWKS retention measures from the key create time, not from the retire time (a contract defect). The master key has no version, so it cannot rotate.
5. The storage is one SQLite file per service on one host. ADR-012 is a local Docker Desktop lock workaround: its design is accepted, but its implementation and runtime gates are open. It is not a production design.
6. All repository code is synchronous `node:sqlite`. A Postgres port changes every caller. The LTI service keeps its SQL in 8 store files, so its port is small.
7. The score worker runs in the web process and sends rows one at a time. One slow platform delays every tenant. A second worker instance is not safe.
8. The LTIAAS-shaped surface of inputs §3 exists. The only missing behaviour is the OAuth2 endpoints (`501` stubs). The other differences are documented in contract §8.
9. The table in §3 rates 17 areas: 3 BLOCKER, 26 MAJOR, 23 MINOR for a paid multi-tenant service. §4 ranks 15 must-fix items for v1. §5 lists what belongs to LG.
10. A human must first decide who the v1 tenant is (new LA-H7): only Cogniate libraries, or external tool vendors (the LTIAAS model). That answer changes the severity of T-1, T-2 and T-3.

## 1. Scope, method and severity

Scope: the files of brief LA-R4. I read the code and the docs. I did not run a stack, tests or `npm`. I did not read the LTIAAS documentation or `.research_cache/**` (clean-room, ADR-001; only the Architect read that reference, ADR-003 line 7). The LTIAAS comparison in §3.17 uses only `docs/research/inputs.md` §3 and our contract.

Severity for a **paid multi-tenant service** (base charter §5, adapted):

| Level | Meaning here |
| --- | --- |
| BLOCKER | The service cannot go live for paying tenants: a security hole, data loss, no recovery from a likely incident, or a second tenant cannot use it. |
| MAJOR | It works for one tenant now. It fails at scale or in a likely incident, or an operator cannot run it safely. |
| MINOR | Worth a fix. Safe to defer. |

Tenancy assumption. The table rates the **LTIAAS model**: a tenant is a tool account, and a tool vendor pays for it. The mark **(C1: x)** gives the severity for the other model, C1: v1 serves only the tool account `cogniate`, and the tenants are Cogniate libraries inside the app. See LA-H7 in §6.

Epic codes come from `docs/team/ltiaas/plan.md` §3. E5 is "Service operability and security". LG is "Production platform".

## 2. What is already production-shaped (keep it)

| Control | Evidence |
| --- | --- |
| Guarded outbound client: https only, no redirects, 5 s timeout, 1 MB limit, the IP check inside the connection lookup (DNS rebinding safe), one log event per attempt | `packages/shared/src/outbound.ts:1-12`, `:35-43`, `:148`; `security.md:194-202` |
| Secret redaction by key name and by value pattern in every log line | `packages/shared/src/logger.ts:44-59`, `:106-117` |
| Only hashes of the API key, ltik and service key are stored | `services/lti-service/src/store/accounts.ts:29-33`, `store/launches.ts:27-36`, `store/service-keys.ts:52-53` |
| Every LTI service lookup includes `tool_account_id`. A credential of account A cannot read account B. | `services/lti-service/src/http/auth.ts:64-76`; `security.md:188` |
| Single-use OIDC state in one SQL statement | `services/lti-service/src/store/states.ts:28-38` |
| Durable score outbox with a "send started" marker, delivery uncertainty, a 24 h retry window and a best-result rule | `services/cogniate-app/src/domain/score-syncs.ts:80-137`; migrations `005`, `007`, `010` |
| Migration checksums: an edited applied migration stops the start | `packages/shared/src/migrations.ts:51-65` |
| Strict config: https origins only; `LTI_API_URL` refused outside `acceptance` | `packages/shared/src/config.ts:25-43`; `services/cogniate-app/src/config.ts:36-49` |
| One stable error body `{ status, error, details: { message, description } }` | `packages/shared/src/errors.ts:24-34` |
| Platform JWKS cache with single-flight, 10 min refresh and 24 h maximum age | `services/lti-service/src/lti/jwks.ts:5-10`, `:45-121` |

## 3. Area table

Ids: area letter + number. Evidence paths are relative to the repo root. "lti" = `services/lti-service/src`, "app" = `services/cogniate-app/src`, "shared" = `packages/shared/src`.

### 3.1 Tenancy and tool accounts

| Id | Current state (evidence) | Gap | Severity | Suggested fix | Epic |
| --- | --- | --- | --- | --- | --- |
| T-1 | The account URLs are built from `PUBLIC_APP_URL`: `/tool/launch`, `/tool/deep-link`, `/tool/register` (lti `store/accounts.ts:45-47`). The launch redirects to `account.launchUrl` (lti `lti/launch.ts:122`). | A second tool tenant cannot receive its own launches. Every account sends its learners to the Cogniate app. | BLOCKER (C1: MINOR) | Store per-account `launchUrl`, `deepLinkingUrl`, `registrationUrl`. Validate https, no user info, no fragment. Set them through the admin API (A-1). | E5 |
| T-2 | A tool account is made only by a CLI inside the container (lti `cli/bootstrap.ts:1-30`). The table has no status column (lti `db/migrations/001_init.sql:2-10`). | No list, no suspend, no delete of a tenant. No self-serve or operator API. | MAJOR (C1: MINOR) | Add `status` (`active`, `suspended`, `closed`) and `closed_at`. A suspended account fails login, launch and API calls. Manage it through A-1. | E5 |
| T-3 | One Blackboard Developer Portal application per host name. Only one tool account per LTI host can use the `blackboard` profile (`docs/architecture/adr/ADR-011-multi-lms.md:94`, D-6 at `:431`; `docs/architecture/open-questions.md:29`, Q20). | The path-per-account model (contract §8 D1) does not scale to many Blackboard tenants. | MAJOR (C1: MINOR) | Decide the host model in LA-H7: one host per tool account (for example `{account}.lti.cogniate.ai`, like the LTIAAS subdomain model in D1), or a shared Blackboard app for all tenants. Make the routing key (host or path) one module. | E5 design; hosting in LG |
| T-4 | No limit or quota per account (no code; see L-1). | One tenant can use all of the single SQLite writer and all outbound capacity. | MAJOR | Per-account quotas: requests per minute per class, platforms, deployments, open registration sessions. | E5 |
| T-5 | Isolation is in application code only. Option A "Tenant isolation: in application code" and "Production fit: No" (`docs/architecture/adr/ADR-006-storage.md:16-17`). | No database-level defence if a query forgets the tenant id. | MINOR | Keep the "tenant id is a required argument" rule (ADR-006 line 26). Add a lint or test that every store query names `tool_account_id`. Use Postgres row-level security later. | E5 lint; RLS in LG |

### 3.2 Admin API for tool accounts, platforms and deployments

| Id | Current state (evidence) | Gap | Severity | Suggested fix | Epic |
| --- | --- | --- | --- | --- | --- |
| A-1 | Platforms and deployments have a Bearer API (lti `http/routes/platforms.ts:151-301`). Accounts, keys and shared platforms have only container CLIs (lti `cli/bootstrap.ts`, `cli/shared-platform.ts:47-64`). App operator commands are "not reachable over HTTP" (app `cli/grant.ts:5`). | No operator (super-admin) API and no operator identity. A shell in the container is the admin interface. | MAJOR | An operator API on an internal listener or behind SSO, with its own credential type. Endpoints: accounts CRUD and status, API keys, signing keys, audit read. Paths are ours (contract §8 D5 style). | E5 |
| A-2 | The Bearer API key of a tenant is the only credential. The same key does launches (`/api/idtoken` uses it with the ltik) and admin writes such as `DELETE /api/platforms/:id` (lti `http/auth.ts:64-67`; `http/routes/platforms.ts:193-209`). | A leaked tool back-end key can delete every platform of the tenant. | MAJOR | API key scopes, for example `launch` (LTIK and SERVICE schemes) and `admin` (Bearer admin routes). A key without the scope gets `403`. Default for old keys: both scopes. | E5 |
| A-3 | `GET /api/platforms` returns all rows and loads the deployments row by row (lti `store/platforms.ts:122-131`). | No paging; N+1 queries for a large tenant. | MINOR | Add `limit` and a cursor (our addition). Load deployments in one query. | E5 |
| A-4 | Admin writes have no conditional write, except the binding refs (contract §9.15). | Two admins can overwrite each other. | MINOR | Optional `If-Match` with a row version on `PATCH`. | E5 (Could) |

### 3.3 API keys and service keys

| Id | Current state (evidence) | Gap | Severity | Suggested fix | Epic |
| --- | --- | --- | --- | --- | --- |
| K-1 | One `api_key_hash` column per account (lti `db/migrations/001_init.sql:5`). `--rotate-api-key` replaces it at once (lti `store/accounts.ts:59-62`). The app reads the key file at each use (app `clients/lti-client.ts:3`), so it follows a rotation. | No overlap: the old key stops at the same moment. No expiry, no "last used", no revoke without a new key, no label, no event in the log (lti `cli/bootstrap.ts` has no logger). | MAJOR | An `api_key` table: id, prefix, hash, label, scopes (A-2), created, expires, last used, revoked. Up to 2 active keys per account during a rotation. Issue, list and revoke through A-1. Log and audit each change. | E5 |
| K-2 | Service keys have no expiry (`docs/architecture/adr/ADR-003-ltiaas-compatibility-scope.md:39`, P6). The only revoke is the cascade of a platform delete (lti `store/platforms.ts:222-229`). `revokeServiceKeys` exists but no code calls it (lti `store/service-keys.ts:85-88`). | No way to revoke one leaked key, or the keys of one deployment or one course. A leaked service key and API key can write grades for every activity of the course (`docs/human_review/deferred.md:22`, A-T3a-04). | MAJOR | Admin endpoints to revoke keys by platform, deployment or context. Re-issue through a generation bump (the §9.14 mechanism). Decide A-T3a-04: limit writes to the key's own line items. | E5 |
| K-3 | The service key value is an HMAC of the scope under a subkey of `LTI_MASTER_KEY` (lti `store/service-keys.ts:24-38`). | The value depends on the master key. A master key change gives new values at the next launch (inferred from `issueServiceKey`, lines 50-67). | MINOR | Derive service keys from a dedicated, versioned key of the key provider (M-1). Store the key version with the row. | E5 |
| K-4 | API keys are SHA-256 hashed 256-bit random values (lti `crypto.ts:6-9`; shared `crypto.ts:4-6`). | None for high-entropy keys. | — | Keep. Do not add a slow hash; it adds cost and no safety for random keys. | — |

### 3.4 Tool signing keys and JWKS rotation (A-T0-16)

| Id | Current state (evidence) | Gap | Severity | Suggested fix | Epic |
| --- | --- | --- | --- | --- | --- |
| J-1 | `--rotate-signing-key` makes a new key, retires the old one and signs with the new key at once (lti `store/tool-keys.ts:13-28`). The JWKS has `Cache-Control: public, max-age=300` (lti `http/routes/protocol.ts:14-17`). Canvas does not refresh an inline key (`docs/guides/operator.md:211`). | No "publish first" step. 1EdTech recommends that the new key is in the key set before use, and that the old key stays for an overlap period ([Security Framework 1.0 §6.4](https://www.imsglobal.org/spec/security/v1p0/)). A platform with a cached key set can refuse client assertions and Deep Linking responses for up to 5 min. | MAJOR | Key states `next` → `active` → `retired`. Publish `next` for at least 24 h (more than every known cache), then activate it. Schedule rotation (the 90-day policy, `docs/architecture/security.md:209`). List the inline-key Canvas connections before activation. | E5 |
| J-2 | The JWKS keeps a retired key only if `now - created_at < 30 days` (lti `store/tool-keys.ts:30-37`). The contract says "retired keys for 30 days" (`docs/architecture/contracts/lti-service-api.md:148`). | Defect against the contract: a key older than 30 days leaves the JWKS at the moment it retires. With 90-day rotation, the overlap is always zero. | MINOR | Add `retired_at`. Filter on it. Add a migration that sets `retired_at` for old retired rows. | E5 |
| J-3 | No test covers rotation (`docs/human_review/deferred.md:21`, A-T0-16). The guide marks the steps `[Not verified by QA]` and `[L-C14 UNVERIFIED]` (`docs/guides/operator.md:209-219`). The rotation CLI writes `lti.db` while the service runs. | Rotation is an untested production procedure. | MAJOR | Acceptance tests: (1) `next` key in JWKS before use, (2) signatures switch at activation, (3) retired key stays 30 days after `retired_at`, (4) a launch and a score pass during rotation on the simulator. Move rotation from the CLI to A-1. | E5 + E7 |

### 3.5 Master key and KMS

| Id | Current state (evidence) | Gap | Severity | Suggested fix | Epic |
| --- | --- | --- | --- | --- | --- |
| M-1 | One 32-byte key per service from an env variable (lti `config.ts:22-23`; app `config.ts:30-33`; `infra/compose.yaml:128`, `:162`; `infra/scripts/gen-env.sh:18`). It encrypts tool private keys and registration tokens with AES-256-GCM. The blob is `iv | tag | ciphertext` with no key id (shared `crypto.ts:24-37`). | No key version, so the master key cannot rotate without a re-encrypt tool. A lost key loses every tool private key. A leaked `.env` exposes all tenants. `security.md:218` asks for a KMS in production. | MAJOR (BLOCKER for go-live) | A `KeyProvider` port: `encrypt`, `decrypt`, `hmac`, each with a key version. Envelope encryption: one data key per row or per account, wrapped by a key-encryption key. A version prefix in every blob. A re-wrap job. A local provider (from a file) for dev and the simulator. | E5 port and local provider; cloud KMS adapter in LG |
| M-2 | AES-GCM uses no associated data (shared `crypto.ts:25-29`). | A database writer can move an encrypted private key from one account row to another, and it still decrypts. | MINOR | Bind each blob to `table|row id|tool_account_id` as AAD. | E5 (with M-1) |
| M-3 | The same master key is the AES key and the root of the service-key HMAC (lti `store/service-keys.ts:33`). | Weak key separation. | MINOR | Derive per-purpose subkeys (HKDF) in the key provider. | E5 (with M-1) |

### 3.6 Storage, ADR-012 status and the path to Postgres

| Id | Current state (evidence) | Gap | Severity | Suggested fix | Epic |
| --- | --- | --- | --- | --- | --- |
| S-1 | One SQLite file per service, WAL, one writer, `busy_timeout` 5000 (shared `migrations.ts:72-83`). ADR-006 says "Production fit: No" and "Production moves to Postgres with row-level security" (`docs/architecture/adr/ADR-006-storage.md:17`, `:36`). | One host, one writer, no high availability, no online backup. | BLOCKER for go-live; does not block LA build | Keep SQLite for dev and the simulator. Build the storage port in LA (S-2). Postgres engine in LG unless LA-H5 says LA. | E5 port; LG engine |
| S-2 | Every store call is synchronous (`DatabaseSync`, shared `migrations.ts:7`). The LTI service has 47 `prepare`/`exec` sites in 8 store files; the app has 155 sites in 16 files (count: `grep 'db\.prepare(\|db\.exec('`, tests excluded). | A Postgres driver is asynchronous. The change touches every caller, and the app spreads SQL over 16 files. | MAJOR | In LA, make the repository interfaces async and keep the SQLite adapter behind them. Start with the LTI service (SQL only in `store/`). Add a SQL lint for non-portable syntax: 18 product lines use `RETURNING`, `ON CONFLICT`, `X''`, `rowid`, `INSERT OR`, `julianday` or `strftime`; `X''`, `rowid` and the date functions do not port as they are. | E5 (LTI service); E4 (app records) |
| S-3 | ADR-012 status: "Accepted for implementation (design only), revision 3.3"; revisions 3.4 to 3.7 are proposed, not accepted (`docs/architecture/adr/ADR-012-sqlite-volume-storage.md:3`). "Implementation and all runtime checks are still open" (`docs/human_review/decisions-needed.md:131`). Its scope is one measured Docker Desktop host (ADR-012 §1, lines 30-36). | ADR-012 solves a local bind-mount lock fault. It does not give HA, online backup or multi-host safety. | MINOR (as a production concern) | Freeze ADR-012 as a dev-stack rule. Do not extend it into the production design. Keep LA QA rounds away from it (see R5). | E0 note; LG replaces it |
| S-4 | In memory, not in tables: platform access tokens, the score clock, the platform JWKS cache (ADR-006 line 29; lti `main.ts:22-24`; lti `platform/score-clock.ts:10-12`; lti `lti/jwks.ts:45-46`). | A second LTI service instance has its own score clock. Two instances can send out-of-order score timestamps, and Moodle answers `409` (ADR-010). | MAJOR (for HA) | Persist the last score timestamp per (platform, line item, user), or route one key to one instance. Share or accept duplicate token and JWKS caches. | LG (HA); E5 records the rule |
| S-5 | `node:sqlite` is "Stability 1.2 - Release candidate" in the Node v24.22.1 docs ([Node 24 sqlite docs](https://nodejs.org/docs/latest-v24.x/api/sqlite.html)). The image is `node:24.22.0-alpine3.24` (`infra/compose.yaml:16`). | Not a stable API. Acceptable for dev. | MINOR | Keep for dev. Production uses Postgres (S-1). | LG |
| S-6 | Package files are on local disk (ADR-006 line 30). | One host for content; no CDN; no signed URLs. | MAJOR (app side) | Object storage with signed URLs (ADR-006 line 36). | LG |

### 3.7 Background jobs, the score-sync outbox and retries

| Id | Current state (evidence) | Gap | Severity | Suggested fix | Epic |
| --- | --- | --- | --- | --- | --- |
| B-1 | The worker runs inside the app web process (app `main.ts:35`, `:46`). It polls every 2 s and sends due rows one by one, 20 per batch (app `worker/score-sync.ts:106-117`, `:133`). Each LTI service call can wait for a platform token (5 s) and a score POST (5 s). | Head-of-line blocking: one slow or down platform delays the scores of every library and every tenant. | MAJOR | Bounded parallelism with fairness per connection or platform (round robin). A separate worker process (same code). Per-platform concurrency limit. | E4 |
| B-2 | The claim of a row is `send_started_at` in a conditional update (app `domain/score-syncs.ts:85-93`). At start, recovery marks **every** row with `send_started_at` as uncertain (app `domain/score-syncs.ts:95-106`). | No owner and no lease expiry. A second worker that starts marks the first worker's live sends as interrupted. Scale-out and HA are not safe. | MAJOR | A lease: `lease_owner`, `lease_until`. Recovery takes only expired leases. Make this part of the generic outbox. | E4 |
| B-3 | Retry policy: 5 s, 30 s, 2 min, 10 min, 30 min, then hourly, for 24 h; 400, 403, 404 and 422 fail at once (`packages/tracking/src/outcome.ts:102-115`). Platform statuses other than 400, 404, 409 and 422 become `PLATFORM_ERROR` (lti `platform/error-mapping.ts:14-25`). | `429` and `Retry-After` are not used. No circuit breaker per platform. Canvas throttles per token with `403 Forbidden (Rate Limit Exceeded)` and sometimes `429` ([Canvas throttling](https://developerdocs.instructure.com/services/canvas/basics/file.throttling)); whether AGS calls share that quota is UNVERIFIED. | MINOR | Map platform `429` (and the Canvas throttle body) to a new `PLATFORM_RATE_LIMITED` with `Retry-After`. The worker honours it. A per-platform breaker after N failures. | E5 (service), E4 (worker) |
| B-4 | The app calls the LTI service with the default 5 s timeout (app `clients/lti-client.ts:186-202`; shared `outbound.ts:148`). The LTI service can use 5 s for the token and 5 s for the score. | The app can time out while the score still reaches the platform. This makes more `delivery_uncertain` rows and confirmation sends. | MINOR | App timeout for score calls above the service budget (for example 12 s), or a service budget below 5 s. Write the budget in the contract. | E5 |
| B-5 | Line-item lookup failures retry every 5 s (`docs/human_review/deferred.md:30`, A-T9-C01). | Extra load on a failing platform. | MINOR | Count preparation retries with the same backoff. | E4 |
| B-6 | Retention runs on an in-process timer in each service (shared `retention.ts:14-29`). Rotation and re-wrap jobs do not exist. | No job runner shape for scheduled work (rotation J-1, re-wrap M-1, purge D-1). | MINOR | One small job runner interface: named jobs, schedule, single-run lock, a log line per run, metrics (O-1). | E5 |

### 3.8 Idempotency

| Id | Current state (evidence) | Gap | Severity | Suggested fix | Epic |
| --- | --- | --- | --- | --- | --- |
| I-1 | No `Idempotency-Key` support anywhere (grep: no match). `POST /api/lineitems` sends `POST lineitems` to the platform (lti `http/routes/compat.ts:38`; contract §3.5). | A tool that retries after a timeout makes a second gradebook column. | MAJOR | Optional `Idempotency-Key` header (an addition, contract §8 D10 style) on `POST /api/lineitems`, `POST /api/platforms`, `POST /api/platforms/:id/deployments`. Keep the key, a body hash and the answer 24 h per account. | E5 |
| I-2 | Score POSTs replace the learner's result. The service sets a later timestamp each time (contract §3.6). Duplicate platforms give `409 PLATFORM_ALREADY_EXISTS`, and the seed CLI handles it (lti `cli/register-platform.ts:26-49`). `complete` twice gives `409 REGISTRATION_ALREADY_COMPLETED`. | Safe for one instance. See S-4 for two instances. | — | Keep. | — |

### 3.9 Rate limiting and abuse control

| Id | Current state (evidence) | Gap | Severity | Suggested fix | Epic |
| --- | --- | --- | --- | --- | --- |
| L-1 | No rate limit in `services/**`, `packages/**`, `apps/**` or the proxy (grep for limiter, `429`, throttle: no match in product code; `infra/proxy/Caddyfile:1-49`). The error table has no `429` code (lti `api-errors.ts:10-47`). Unauthenticated endpoints that cost work: `GET /lti/register/:account` fetches any public https URL and stores a session (lti `http/routes/registration.ts:115-155`); `GET|POST /lti/login/:account` writes a state row when `iss` and `client_id` are known (lti `store/states.ts:16-21`), and these ids are not secrets (`security.md:256`). | A public multi-tenant API with no limit. Abuse can fill the single SQLite writer, use the outbound client as a fetch relay, and harm every tenant ([OWASP API4:2023](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption)). | BLOCKER | Two layers. Edge: per-IP limits at the proxy or ingress. Service: token buckets per account and per route class (protocol, API read, API write, admin), and per IP for unauthenticated routes. New code `429 RATE_LIMITED` with `Retry-After` (an addition). Limit open registration sessions per account. Set Fastify `trustProxy` only for the proxy address; today it is unset (lti `http/app.ts:67-71`). | E5 |
| L-2 | `GET /healthz` is public through the proxy, which sends every path (`infra/proxy/Caddyfile:30-33`). It shows the profile, active test knobs and the outbound allowlist (lti `http/app.ts:110-113`). | Information for an attacker. | MINOR | Public health returns only `status`. Details go to an internal port or the operator API. | E5 |
| L-3 | Test knobs work in every profile and only log a warning (shared `knobs.ts:1-8`). `LTIK_TTL_SECONDS` allows up to 30 days (shared `knobs.ts:35-39`). | A production stack can run with a test knob. | MINOR | A `production` profile refuses any active knob and the simulation profiles at start. | E5 |
| L-4 | Body limit 256 KB and parameter limit 2048 (lti `http/app.ts:61-62`). Outbound limits 5 s and 1 MB (`security.md:196`). | None. | — | Keep. | — |

### 3.10 Observability: logs, metrics, traces, health, alerts

| Id | Current state (evidence) | Gap | Severity | Suggested fix | Epic |
| --- | --- | --- | --- | --- | --- |
| O-1 | No metrics: no counters, histograms or `/metrics` (grep for prometheus, opentelemetry, statsd: no match). | An operator cannot see launch failure rates, latency, queue depth or outbound errors. | MAJOR | An OpenMetrics endpoint on an internal port. Minimum set: requests by route class, status and account; latency histogram; `launch_check_failed` by check; outbound by host and reason; token cache hit or miss; JWKS fetch failures by platform; score-sync rows by status and oldest pending age; retention deletes. | E5 |
| O-2 | `http_request` has method, path, status and time, but no account (lti `http/app.ts:80-85`). `api_auth_failed` has scheme and code only (lti `http/app.ts:102-103`). | No tenant attribution: nobody can answer "which tenant has errors?". | MAJOR | Add `tool_account_id` after authentication or path resolution, and `platform_id` where known. These are not secrets. | E5 |
| O-3 | Each service appends to `<LOG_DIR>/<service>.jsonl` with no rotation (shared `logger.ts:131-134`). | The file grows without limit on a long-running host. | MINOR | Production: stdout only, to a log pipeline. Dev: size rotation. | E5 (switch); LG (pipeline) |
| O-4 | `/healthz` is liveness only. It does not read the database (lti `http/app.ts:110-113`). | No readiness signal. A load balancer sends traffic to a service with a broken database. | MINOR | `/readyz`: database ping, migrations applied, key provider ready. | E5 |
| O-5 | `X-Trace-Id` goes from the app to the LTI service and comes back (app `clients/lti-client.ts:202`; lti `http/app.ts:75-79`). | No spans and no W3C `traceparent`. | MINOR | Accept `traceparent` as an alias later. OpenTelemetry in LG. | LG |
| O-6 | No alert rules and no SLO. Q11 recommends 99.95 % (`docs/architecture/open-questions.md:19`). `stack:doctor` does not check certificate expiry (`docs/human_review/deferred.md`, "T8 readiness 1+2"). | Nobody is told when launches or score syncs fail. | MAJOR | Define SLOs and alert rules in the LA operability design: 5xx ratio, launch failure ratio per platform, oldest pending score sync above 1 h, `failed` score syncs per hour, JWKS failures per platform, certificate and key age. The paging tool is LG. | E5 design; LG on-call |

### 3.11 Audit log

| Id | Current state (evidence) | Gap | Severity | Suggested fix | Epic |
| --- | --- | --- | --- | --- | --- |
| AU-1 | No audit store. Admin events are ordinary log lines, and some are missing: `platform_created` only for profiles other than `standard` (lti `http/routes/platforms.ts:177`); `PATCH /api/platforms/:id` (activate, deactivate, deployment list) writes no event (lti `http/routes/platforms.ts:211-231`); the bootstrap CLI (account create, API key and signing key rotation) writes no event (lti `cli/bootstrap.ts:23-30`). App operator events have a trace id but no operator identity (app `app/operator.ts:108`, `:124`, `:163`). | No answer to "who changed this tenant's platform or key, and when". A paid service needs this for support, security review and disputes. | MAJOR | An append-only `audit_event` table: time, actor type and id (API key id, operator id, system), `tool_account_id`, action, target, result, trace id, client IP. Write it in the same transaction as the change. A tenant read endpoint (our path) and an operator export. Define retention (for example 1 year). | E5 |

### 3.12 Data retention and deletion (privacy)

| Id | Current state (evidence) | Gap | Severity | Suggested fix | Epic |
| --- | --- | --- | --- | --- | --- |
| D-1 | The LTI service never deletes platforms or service keys in its cleanup (lti `store/retention.ts:1-5`). There is no tool account delete (T-2). The app never deletes attempts, resource links, score syncs, publications or connections (app `domain/retention.ts:6`). No erase by learner `sub` exists (grep: no `DELETE FROM attempt` or `score_sync`). | No tenant offboarding and no learner erasure. A paid service needs both for its data processing agreement and for [GDPR Art. 17](https://gdpr-info.eu/art-17-gdpr/). | MAJOR | Tenant offboarding: suspend, export, purge after N days. Learner erase by (platform, `sub`) in both services. Configurable retention for attempts and score syncs per tenant. A human decides the periods (with Q3 / LA-H4). | E5 (LTI service); E4 (app records) |
| D-2 | `launch.claims` stores the full validated claim set (lti `store/launches.ts:33-38`) for 24 h after the 24 h ltik (contract §6). Only Canvas and Blackboard use the claim allowlist (contract §9.8). Moodle minimization is D-9 (plan E3). | If a Moodle admin shares name and email, the service stores them for up to 48 h. | MINOR | Apply the allowlist to every profile (D-9), with a tenant opt-in for personal claims. | E3 |
| D-3 | Logs hold no learner ids (grep for `user_sub` or `sub` in log calls: no match). | None. | — | Keep. | — |

### 3.13 Backup and restore

| Id | Current state (evidence) | Gap | Severity | Suggested fix | Epic |
| --- | --- | --- | --- | --- | --- |
| BR-1 | A backup is complete only when "both services were positively stopped" (`docs/architecture/adr/ADR-012-sqlite-volume-storage.md:349`). Backup, restore, import and quarantine all need both services stopped (ADR-012 line 329). The backup holds encrypted rows but no `.env` and no private key (ADR-012 line 364). | Every backup is downtime. No schedule, no off-site copy, no RPO or RTO, no defined key escrow. A restore without the matching master key gives undecryptable tool keys. | MAJOR (BLOCKER for go-live) | Define RPO and RTO. If SQLite stays for a pilot: an online copy with the SQLite backup API or `VACUUM INTO`, on a schedule, encrypted, off-site. Escrow the master key version (M-1) with the backup record. A restore drill per release. Production: managed Postgres with point-in-time recovery. | E5 (RPO/RTO, escrow, drill); LG (managed backup) |

### 3.14 Configuration and secrets

| Id | Current state (evidence) | Gap | Severity | Suggested fix | Epic |
| --- | --- | --- | --- | --- | --- |
| C-1 | `gen-env` writes all secrets to one `.env` file, mode 600 (`infra/scripts/gen-env.sh:10-11`, `:47-67`). Compose passes the master keys as environment variables (`infra/compose.yaml:128`, `:162`). The app's API key is a read-only file mount, read at each use (`infra/compose.yaml:204`). | Env values leak through `docker inspect`, process listings of children and crash reports. | MAJOR | Read every secret from a file (`*_FILE` names), like the API key file. In production, the files come from a secret manager. | E5 (file loading); LG (manager) |
| C-2 | No `production` profile. `security.md:201` says the production allowlist is empty, but no code enforces it. | A production start can carry dev settings. | MINOR | A fail-closed `production` profile: no knobs (L-3), no simulation profiles, empty private-host allowlist, public CA trust only. | E5 |
| C-3 | The LTI service requires `PUBLIC_MOODLE_URL` through `loadPublicUrls` (lti `config.ts:26`; shared `config.ts:43`), but the LTI service code does not read `urls.moodle` (grep). | A multi-LMS service has no single Moodle. | MINOR | Let each service load only the URLs it uses. | E1 |

### 3.15 Deployment topology: TLS, hosts, cookies, CORS

| Id | Current state (evidence) | Gap | Severity | Suggested fix | Epic |
| --- | --- | --- | --- | --- | --- |
| DT-1 | Only the local stack exists (ADR-005; `infra/compose.yaml:1-7`). Services run TypeScript from the host source with `node --watch` (`infra/compose.yaml:124`, `:157`) and a host `node_modules` mount (`infra/compose.yaml:25-26`). TLS uses a dev CA and static files; `auto_https off` (`infra/proxy/Caddyfile:2-6`, `:17`). | No production image, no production manifest, no rollout or rollback path. | MAJOR | A production image per service: multi-stage, `npm ci --omit=dev`, non-root user, read-only root file system, digest-pinned base. Run without `--watch`. Hosting, ingress and the public CA are LG. | E5 (image); LG (hosting) |
| DT-2 | No `Strict-Transport-Security` header on any host (grep: no match). | Browsers can try `http` first on the LTI and app hosts. | MINOR | HSTS at the production edge for the LTI, app and content hosts. | LG |
| DT-3 | Cookies: one `__Host-` state cookie, `SameSite=None; Partitioned` (`security.md:110`). No CORS on `/api/*` (`security.md:162`). | Correct for server-to-server use. | — | Keep. Do not add CORS to `/api/*`. | — |
| DT-4 | All libraries share one content origin (`security.md:176`, R5; Q10). | One library's package code shares browser storage with others. | MAJOR (app side) | One content subdomain per tenant (Q10). | LG |
| DT-5 | One host serves all tool accounts by path (contract §8 D1). | See T-3 (Blackboard needs one host per application). | see T-3 | Decide in LA-H7. | E5 design |

### 3.16 Dependency and supply-chain posture

| Id | Current state (evidence) | Gap | Severity | Suggested fix | Epic |
| --- | --- | --- | --- | --- | --- |
| SC-1 | Good base: exact versions (`services/lti-service/package.json`: `fastify` 5.12.7, `jose` 6.2.12, `zod` 4.6.7, `@fastify/formbody` 9.0.1); `package-lock.json` v3 with 333 entries, about 89 not marked dev; only `fsevents` has install scripts (my count from the lockfile). No CI exists (no `.github/`); `npm run check` runs only by hand (root `package.json` scripts). | No automatic vulnerability scan, licence check, SBOM or secret scan. A vulnerable dependency stays until a human looks. | MAJOR | A CI job: `npm ci --ignore-scripts`, `npm run check`, a vulnerability scan (for example `npm audit` or OSV), an SBOM (CycloneDX), a secret scan, and an update policy (Renovate or Dependabot). | E7 (CI); E5 (policy) |
| SC-2 | Base images use tags, not digests (`infra/compose.yaml:16`, `:40`). Only the e2e image is digest-pinned (`infra/e2e/Dockerfile:2`). The QA install runs lifecycle scripts (`docs/human_review/deferred.md:20`, A-T1-03). | A changed tag changes the runtime without review. | MINOR | Pin digests in production images (DT-1). Use `--ignore-scripts` everywhere. | E5 |
| SC-3 | I did not run `npm audit` (it sends the lockfile to an external service, base charter §7). | Current vulnerability state: UNVERIFIED. | — | Run the scan in the first CI job. | E7 |

### 3.17 LTIAAS-compatible API surface (shape only)

Source: `docs/research/inputs.md:35-42` (§3) and our contract. "Exists" = the path, method and header scheme of inputs §3 are routed. Differences are in contract §8 (`docs/architecture/contracts/lti-service-api.md:402-428`).

| inputs §3 item | Our route (evidence) | Status | Difference (contract §8) |
| --- | --- | --- | --- |
| `Authorization: LTIK-AUTH-V2 <API_KEY>:<LTIK>` | lti `http/auth.ts:17`, `:23-35` | Exists | API key format `ltis_` + 43 characters (D2). The ltik is opaque, not JWT-like (D3). 24 h life (knob default, shared `knobs.ts:35-39`). |
| `Authorization: SERVICE-AUTH-V1 <API_KEY>:<SERVICE_KEY>` | lti `http/auth.ts:69-73` | Exists | Opaque key (D3). No expiry (P6). |
| `Authorization: Bearer <API_KEY>` | lti `http/auth.ts:65-67` | Exists | A bad key gives `INVALID_LTIK_AUTH_AUTHORIZATION_HEADER` (ADR-003 line 61). |
| `GET /api/idtoken` | lti `http/routes/idtoken.ts:10` | Exists | Shape `{ ltiVersion, user, platform, launch, services }` (contract §3.1). `launch.resourceLink` is omitted for Deep Linking (D9). Additions (D10, D17). |
| `GET /api/memberships` | lti `http/routes/compat.ts:51` | Differs | Personal fields are never returned (D13). |
| `GET`, `POST /api/lineitems` | lti `http/routes/services.ts:37`; `compat.ts:38` | Exists | No idempotency (I-1). |
| `GET`, `PUT`, `DELETE /api/lineitems/:lineItemId` | lti `http/routes/services.ts:42`; `compat.ts:42`, `:46` | Exists | A raw, unencoded id gives `404` (D15). A double-encoded id is accepted (D14). |
| `GET`, `POST /api/lineitems/:lineItemId/scores` | lti `http/routes/services.ts:47`, `:54` | Exists | `user_id` alias and optional `timestamp` (D10, D14). |
| `POST /api/deeplinking/form` | lti `http/routes/compat.ts:34` | Exists | — |
| `POST /api/deeplinking/message` | lti `http/routes/compat.ts:33` | Exists | Also `POST /api/deeplinking` (lti `http/routes/services.ts:32`). |
| `GET /api/registrations/:id` | lti `http/routes/registration.ts:171` | Exists | Path is ours (D4). Additions `operation`, `existingPlatformId`. `privacyLevel` default `anonymous` (D6). |
| `POST /api/registrations/:id/complete` | lti `http/routes/registration.ts:178` | Exists | Path is ours (D4). Addition `updatePlatformId`. |
| OAuth2 token endpoints | lti `http/routes/compat.ts:64-70` | **Missing behaviour** | `501 NOT_IMPLEMENTED` stubs at our paths (D11). |
| Admin `platforms` endpoints | lti `http/routes/platforms.ts:151-231` | Exists | Paths are ours (D5). `authConfig.method` `JWK_SET` only (D7). `publicKey` is the tool key (D8). Additions D16 to D21 (profiles, site URLs, deployments, binding refs). |
| Error shape `{ status, error, details: { message, description } }` | shared `errors.ts:24-34`; lti `http/app.ts:87-97` | Exists | `description` is not stable (ADR-003 P4). |
| Account selection | Path segment `/lti/*/{toolAccountId}` | Differs | LTIAAS uses one subdomain per account (D1). See T-3. |

Rules for the v1 additions in this report. They must keep ADR-003 P1 to P5 (`docs/architecture/adr/ADR-003-ltiaas-compatibility-scope.md:34-38`):

- New codes (`RATE_LIMITED` 429, `PLATFORM_RATE_LIMITED`) use the same error body.
- New headers (`Idempotency-Key`, `Retry-After`) are optional for the client.
- New admin paths (API keys, audit, operator) are "paths are ours" rows in contract §8.
- No existing field changes name or meaning.

UNVERIFIED: any LTIAAS endpoint that is not in inputs §3. I did not read the LTIAAS reference (clean-room). The compatibility claim still needs the legal answer Q1 (plan LA-H2).

Severity of the surface gaps: OAuth2 stubs MINOR (only a tenant that needs LTIAAS-specific Canvas OAuth). D15 raw ids MINOR. D1 account selection: rated in T-3.

### 3.18 Count

| Severity | Count (LTIAAS model) | Ids |
| --- | --- | --- |
| BLOCKER | 3 | T-1, S-1 (for go-live), L-1 |
| MAJOR | 26 | T-2, T-3, T-4, A-1, A-2, K-1, K-2, J-1, J-3, M-1, S-2, S-4, S-6, B-1, B-2, I-1, O-1, O-2, O-6, AU-1, D-1, BR-1, C-1, DT-1, DT-4, SC-1 |
| MINOR | 23 | T-5, A-3, A-4, K-3, J-2, M-2, M-3, S-3, S-5, B-3, B-4, B-5, B-6, L-2, L-3, O-3, O-4, O-5, D-2, C-2, C-3, DT-2, SC-2 |

NOTE: M-1 and BR-1 are MAJOR for the LA build, but BLOCKER for go-live: without them there is no key recovery and no tested restore. S-6 and DT-4 are on the app side. Rows marked "—" (K-4, I-2, L-4, D-3, DT-3, SC-3) are not findings.

## 4. Must fix for v1 (ranked, 15)

Rank = severity first, then what other items need first. "v1" = LA's "LTI as a service v1, production-shaped". The cloud parts stay in LG (§5).

| # | Item | Ids | Why this rank | Epic |
| --- | --- | --- | --- | --- |
| 1 | Rate limits and abuse control: edge per-IP limits, per-account and per-route-class buckets, `429 RATE_LIMITED`, limits on unauthenticated registration and login, `trustProxy` for the proxy only. | L-1, T-4 | The only open security BLOCKER. Every self-serve item (E6) depends on it. | E5 |
| 2 | Tenancy model decision (LA-H7), then per-account tool URLs and account status. | T-1, T-2, T-3 | A second tenant cannot use the service today. The host model (path or subdomain) shapes every URL. | E5 |
| 3 | Operator admin API with its own credential, for accounts, keys and signing keys; CLIs become thin clients of it. | A-1 | Items 4, 5, 6 and 7 need an API, not a container shell. | E5 |
| 4 | Append-only audit log for every admin and operator change, with actor and tenant. | AU-1 | A paid service must answer "who changed what". Cheap if it lands with item 3. | E5 |
| 5 | API key lifecycle: key table, scopes (`launch`, `admin`), two active keys during rotation, revoke, expiry, last used. | K-1, A-2 | A leaked back-end key today is a full admin key with no safe rotation. | E5 |
| 6 | `KeyProvider` port with versioned envelope encryption, AAD and per-purpose subkeys; local file provider. | M-1, M-2, M-3, K-3 | Master key rotation and KMS need a version in every blob. Later items store new secrets. | E5 |
| 7 | Signing key lifecycle `next` → `active` → `retired` with `retired_at`, scheduled rotation, and the A-T0-16 acceptance test on the simulator. | J-1, J-2, J-3 | The 90-day policy cannot run safely today, and the contract promise is broken. | E5, E7 |
| 8 | Async storage port: async repository interfaces, the SQLite adapter behind them, a SQL portability lint; Postgres decision LA-H5. | S-1, S-2, S-3 | Makes the LG Postgres move a new adapter, not a rewrite. The LTI service part is small (8 store files). | E5 (LTI service), E4 (app) |
| 9 | Backup and restore for the pilot: RPO and RTO, scheduled online backup, master key escrow, a restore drill. | BR-1 | The only recovery path today needs downtime and has no key escrow. | E5 |
| 10 | Metrics endpoint and alert rules with SLOs. | O-1, O-6 | No operator can see a failing tenant today. | E5 |
| 11 | Tenant id in logs, readiness endpoint, minimal public health. | O-2, O-4, L-2 | Needed for item 10 and for support. Small. | E5 |
| 12 | Generic outbox with leases, fairness per platform and bounded parallelism; honour platform `429` and `Retry-After`. | B-1, B-2, B-3, B-5 | One slow platform delays every tenant. A second worker is unsafe. | E4 (with E5 for the `429` mapping) |
| 13 | Service key revoke and re-issue (by platform, deployment, context); decide A-T3a-04. | K-2 | A leaked service key cannot be stopped without deleting the platform. | E5 |
| 14 | `Idempotency-Key` on `POST` line items, platforms and deployments. | I-1 | Retries by tenant tools make duplicate gradebook columns. | E5 |
| 15 | Production profile and supply chain: secrets from files, fail-closed `production` profile (no knobs, no simulation), production image, CI with scan, SBOM and digest pins. | C-1, C-2, L-3, DT-1, SC-1, SC-2 | Without it a production start can carry dev settings, and no one sees a vulnerable dependency. | E5, E7 |

Not in the 15, but in scope: tenant offboarding and learner erase (D-1) depend on the privacy decisions LA-H4 and Q3. If the product owner wants v1 to be sellable to EU tenants, move D-1 above item 13.

## 5. What belongs to LG instead

| LG item | Why not LA | LA prerequisite |
| --- | --- | --- |
| Postgres engine, row-level security, data migration from SQLite | LA's goal is the channel kernel; the engine needs hosting decisions (Q11). Unless LA-H5 decides otherwise. | Item 8 (async port, SQL lint) |
| Cloud KMS adapter and a secret manager | Needs a cloud account and region (Q11). The team may not sign up. | Item 6 (`KeyProvider`), item 15 (file secrets) |
| High availability: several LTI service instances, a persisted score clock, shared token and JWKS caches; a separate worker deployment and a queue | Needs the Postgres engine and hosting. | Items 8 and 12 (lease outbox), S-4 rule |
| Managed backup with point-in-time recovery, off-site copies, a DR region | Needs managed hosting. | Item 9 (RPO, RTO, escrow, drill) |
| Hosting: ingress, WAF, DDoS edge, public CA, HSTS, per-tenant subdomains if LA-H7 picks them, one Blackboard application per host | Needs a domain, a cloud and legal ownership (Q20). | Item 2 (host model in one module) |
| Object storage with signed URLs; one content subdomain per tenant | App side; needs a domain (Q10). | — |
| OpenTelemetry tracing, a log pipeline, paging and on-call | Needs a vendor choice. | Items 10 and 11 |
| Billing, metering and a self-serve signup dashboard | Product and pricing decisions (Q6); ADR-003 puts the dashboard out of scope. | Item 3 (operator API), item 4 (audit) |
| OAuth2 endpoints (D11) | Only for a tenant that needs LTIAAS-specific Canvas OAuth. | — |
| ADR-012 replacement in production | ADR-012 is a dev-stack lock workaround (S-3). | — |

## 6. Decisions for humans (new or sharpened)

| Id | Decision | Recommendation | Needed by |
| --- | --- | --- | --- |
| LA-H7 (new) | Who is the v1 tenant: only Cogniate libraries (C1), or external tool vendors (LTIAAS model)? If vendors: one host per tool account or one path per account? | Build the LTIAAS-model controls in E5 (items 1 to 7 cost little more than the C1 versions, inferred), but sell only C1 in v1. Choose one host per tool account for the vendor model, because Blackboard allows one application per host (D-6, Q20) and LTIAAS uses one subdomain per account (D1). | E5 design |
| LA-H5 (sharpened) | Postgres in LA or LG | LG for the engine. LA delivers the async storage port (item 8). Reason: the LTI service part is small, the app part touches 16 files, and the engine needs Q11 answers. | E5 design |
| LA-H8 (new) | RPO, RTO and the SLO for the pilot | RPO 1 h and RTO 4 h for a pilot on SQLite; 99.95 % stays the production target (Q11). | Item 9 |
| LA-H4 (sharpened) | Retention periods for attempts, score syncs, launches and audit events; the erase scope for one learner | Attempts and score syncs: contract length plus 90 days; audit events: 1 year; erase by (platform, `sub`) in both services. | D-1 |

## 7. Recommendations for the LA plan

1. Add **LA-H7** (tenancy model and host model) to plan §6 and ask it before the E5 design closes. It changes the severity of T-1, T-2 and T-3, and it decides DT-5. → **E5**
2. Give **E5** these Must items, in this order: rate limits (§4 #1), per-account URLs and account status (#2), operator API (#3), audit log (#4), API key lifecycle (#5), `KeyProvider` (#6), signing key lifecycle (#7). Each needs an acceptance-level test on the simulator. → **E5**
3. Give **E5** these Should items: backup and restore for the pilot (#9), metrics and alerts (#10), tenant ids and readiness (#11), service key revoke (#13), `Idempotency-Key` (#14), production profile (#15 without CI). → **E5**
4. Close **A-T0-16** inside E5 #7 with four tests: `next` key published before use, signing switch at activation, 30-day retention from `retired_at`, and a launch plus a score during rotation. Fix the `created_at` filter (J-2) as part of it. → **E5**, tests in **E7**
5. Put the outbox lease, per-platform fairness, bounded parallelism and the platform `429` handling into the **E4** generic outbox acceptance criteria. Do not build a second worker instance before the lease exists. → **E4**
6. Record **LA-H5** as "engine in LG; async storage port in LA". Start the port in the LTI service (8 store files), then the app records with E4. Add a SQL portability lint. → **E5**, **E4**, engine **LG**
7. Freeze **ADR-012** as a dev-stack rule. Do not use it as a production storage design, and do not let new LA tasks depend on its open runtime gates (see R5). → **E0**
8. Add an operations section to the **E7** conformance kit: `429` with `Retry-After`, an audit event for every admin route, an idempotent replay, readiness on a broken database, and the fail-closed `production` profile. → **E7**
9. Add the first **CI job** to E7: `npm ci --ignore-scripts`, `npm run check`, a vulnerability scan, an SBOM, a secret scan, digest pins. It also gives R5's "0 core files" check a place to run. → **E7**
10. Extend contract §8 with new rows (D22 and later) for every v1 addition: `RATE_LIMITED`, `PLATFORM_RATE_LIMITED`, `Idempotency-Key`, `Retry-After`, API key and audit paths. Keep ADR-003 P1 to P5. The release claim still waits for Q1 (LA-H2). → **E5**, **E8**
11. Make **E6** self-serve onboarding depend on E5 #1 (rate limits) and #4 (audit). The operator grant (D-3) must stay until both exist. → **E6**
12. Remove the `PUBLIC_MOODLE_URL` requirement from the LTI service config as part of "core without LMS names". → **E1**
13. Write the operator runbook in **E8**: API key and signing key rotation, master key re-wrap, backup and restore drill, tenant suspend and offboarding, incident first steps (which metric, which log event). → **E8**
14. Put tenant offboarding and learner erase (D-1) in E5 (LTI service) and E4 (app records) after LA-H4. If EU tenants are in the pilot, rank it above E5 #13. → **E5**, **E4**
15. Open backlog milestone **LG** with the §5 table as its first scope list: Postgres, KMS adapter, secret manager, HA, managed backup, hosting and edge, object storage, tracing and on-call, billing, OAuth2. → **LG**
