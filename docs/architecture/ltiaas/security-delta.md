# Security delta (milestone LA)

Status: **Proposed** (P2 design, Architect-2 A2, 2026-10-22). Base: [security model](../security.md) ("§n" below = its sections). Decisions: [LA-ADR-05](adr/LA-ADR-05-lti-advantage-completeness.md), [LA-ADR-06](adr/LA-ADR-06-service-operability.md), [LA-ADR-07](adr/LA-ADR-07-security-and-tenancy.md), [LA-ADR-08](adr/LA-ADR-08-onboarding-and-connection-health.md); kernel rules of A1 in [LA-ADR-01](adr/LA-ADR-01-channel-kernel.md) and [LA-ADR-02](adr/LA-ADR-02-generic-lti-channel.md). Wire details: [LTI service API delta](contracts/lti-service-api-delta.md).

How to read: each row is one change to one section of `security.md`. "Keep" means the base rule stays as it is. The P6 conformance task merges these rows into `security.md` after the build (owner: the Architect of the breakdown). Priority: Must, Should, Could (plan v1 §3).

## §1 Trust boundaries

| Change | Detail | Source | Priority |
| --- | --- | --- | --- |
| New zone: operator listener | `127.0.0.1:4110` inside the LTI service container. Trusts an operator key only. Not routed by the proxy. The `acceptance` test profile binds it on the stack network for QA; `production` refuses a non-loopback bind. | LA-ADR-06 D3, D12 | Must |
| New zone: key ring | A read-only `0600` file in the LTI service container (and later the app). Trusted for key material only. Never in a backup of the databases; escrow apart. Never visible to the `e2e` test container (§10, visibility rule). | LA-ADR-06 D6, D14 | Must |
| New zone: platform storage frame | A window of the platform on its OIDC auth origin (Canvas: `post_message_forwarding` on `sso.canvaslms.com`). Our pages trust only replies from that origin with the right `message_id`. | LA-ADR-05 D1 | Must |
| New zone: channel folders | Repo code, reviewed. Loaded at start by folder discovery; a broken folder stops the start. No runtime plugin path. | LA-ADR-01 D1, D4; LA-ADR-07 T1 | Must |

## §2 LTI messages

| Section | Change | Source | Priority |
| --- | --- | --- | --- |
| §2.1 Login | Before rule 1: the rate-limit classes `protocol` and `protocol_account`; a `suspended` account gives the page `TOOL_ACCOUNT_SUSPENDED` and no state row. New rule 6: when the profile has `platformStorage` and a storage target exists, the answer is the login page (`200`) with `lti.put_data`, not the `302`; the state record keeps the target and the storage origin. The cookie is set in both cases. | LA-ADR-05 D1; LA-ADR-06 D1, D2 | Must |
| §2.2 Launch | Check 2 gets an alternative: **check 2s (storage check)**. When the cookie is missing and the state record has a storage target, checks 4–14 and the claim policy run first; then the storage-check page; then `POST /lti/launch/{account}/storage-check` checks `Origin` = our LTI origin and compares `SHA-256(value)` with the state hash (constant time), single use, 120 s. The storage key is `cog_state_<d>` (16 keys at most); request values reach the login page only through an escaped JSON block (A-LAD-09). No ltik before check 2s passes. New log values: `check: "storage"`, details `storage_mismatch`, `storage_check_unknown_used_or_expired`; `launch_accepted {binding}`. | LA-ADR-05 D1 | Must |
| §2.2 Launch, check 5 | Could: refuse `aud` values other than the client id and the platform's `trustedAudiences`. | LA-ADR-05 D10; LA-ADR-07 D8 | Could |
| §2.2 Launch, check 11 | Keep. A launch without `context` is valid; a missing `sub` is still refused (documented deviation, LTI Core allows anonymous launches). | LA-ADR-05 D2 | Must |
| §2.2 "Other launch cases" | `STATE_COOKIE_MISSING` gets a storage help text when the storage check got no value. | LA-ADR-05 D1 rule 8 | Must |
| §2.3 JWTs that we sign | "One active RSA 2048 key per tool account … Rotation is optional" becomes: signing key states `next` (published, never signs), `active` (exactly one; signs every tool JWT), `retired` (published 30 days from `retired_at`), `removed` (private part zeroed). Activation waits for the publish lead time (default 24 h) unless `force` (audited). | LA-ADR-06 D7 | Must |
| §2.4 Platform URLs | Keep the `standard` rules. Add the **origin binding** invariant I-SELF (A-LAD-01; A1's rule text in LA-ADR-02 D2a and D5 item 10; LA-ADR-07 rule A6): for a `self` binding, the auth, token, JWKS and registration endpoints and the client assertion audience are on the issuer origin. The issuer host vouches only for its own origin. A value off the issuer origin, or a separate audience, needs an operator grant (or a fixed value of a named profile together with a grant). The LTI service enforces it: an **active** `POST /api/platforms` that breaks it gets `400 PLATFORM_URL_NOT_ON_ISSUER_ORIGIN`, and a `complete` that breaks it creates the platform **inactive** with the connection's binding ref (a staged registration); the app then switches the connection to `operatorGrant`, and only the grant redemption activates it. `brightspace` DR is always staged (its token host is off the issuer origin). The Moodle configuration URL must be the issuer plus `/mod/lti/openid-configuration.php` (trait `configurationPath`, LA-ADR-02 D2a). For `any-https` profiles (`lti-generic`, `brightspace`): the issuer may have a path; its origin passes site rules 1–3; no admin value is a fixed host or a fixed-issuer host of any loaded profile; reserved issuers are refused; every later call uses the guarded client ([contract delta §4.5, §4.6.1](contracts/lti-service-api-delta.md#461-post-apiplatforms-for-the-admin-value-profiles-lti-generic-and-brightspace-e2-must)). Canvas Dynamic Registration (Should): the configuration issuer equals the Canvas profile issuer; every endpoint equals the filled profile value; the platform is always staged with a grant. | LA-ADR-02 D2, D5; LA-ADR-05 D6; LA-ADR-07 A6 | Must (E2) / Should |
| §2.5 Dynamic registration update | Keep. | — | — |
| §2.6 Platform ownership | Keep for `self` methods. Add: authority rules A1–A6 of LA-ADR-07 D2 (a channel chooses only a kernel strategy; typed values need `operatorGrant`; shared platforms never `self`; a `self` binding keeps every endpoint and the audience on the issuer origin). The registry load enforces A3 and A4 (LA-ADR-01 D4 load check 6; the Moodle manual method is the one frozen legacy exception). | LA-ADR-07 D2; LA-ADR-01 D4 | Must |

## §3 Cookies and launch container

| Change | Detail | Source | Priority |
| --- | --- | --- | --- |
| Platform storage fallback | The state cookie stays (`__Host-lti_state_…; SameSite=None; Partitioned`). Where the profile has platform storage, the state is also put in the platform storage, so a blocked cookie no longer stops the launch. Moodle 5.2 sends no storage target: the NOTE about Deep Linking in Safari (Q16, R4) stays true for Moodle. | LA-ADR-05 D1 | Must |
| No new cookie | LA adds no cookie on any host. | — | Must |

## §4 Launch handoff

| Rule | Change | Source | Priority |
| --- | --- | --- | --- |
| Binding | The placement key (A1: connection, deployment, context id, resource link id) allows context id `""` for a launch without a context. | LA-ADR-05 D2; LA-ADR-03 D2 | Must |
| Picker POST | Multi-select (only with `content.multiple` and `acceptMultiple`): every posted publication is checked against the picker's connection and `available` status; 1 to 20 ids. | LA-ADR-05 D3 | Must |
| Picker cancel (new) | `POST /tool/picker/{pickerId}/cancel`: the same checks as the picker POST (exists, unused, unexpired, `Origin`); it signs an empty Deep Linking response and marks the picker used. | LA-ADR-05 D3 | Must |
| Verified admin launch (new, Could) | A Deep Linking launch with a signed institution or system administrator role on an `awaiting_admin_launch` connection shows a one-time code page; no picker, no attempt. | LA-ADR-08 D3 | Could |

## §5 Page headers

New rows:

| Response | `Content-Security-Policy` (main parts) | `Referrer-Policy` | Priority |
| --- | --- | --- | --- |
| LTI service login page (platform storage) | `default-src 'none'; script-src 'nonce-…'; frame-ancestors https:; form-action 'none'; base-uri 'none'` | `no-referrer` | Must |
| LTI service storage-check page | `default-src 'none'; script-src 'nonce-…'; frame-ancestors https:; form-action 'self'; base-uri 'none'` | `same-origin` (its form POST must carry our `Origin`) | Must |
| `POST /tool/picker/{id}/cancel` auto-submit | as `POST /tool/picker/{id}` auto-submit | `same-origin` | Must |
| `PLACEMENT_NOT_GRADED` page | as the other `/tool/*` error pages | `same-origin` | Must |
| Admin code page (Could) | as `GET /tool/picker/{id}`, with `form-action 'none'` | `same-origin` | Could |

The two LTI service pages have no form fields that a framing page can read and no button, like the error pages. `frame-ancestors https:` is needed because the platform is known but its page origin is not proven before the launch.

## §6 CSRF

| Endpoint group | Rule | Source | Priority |
| --- | --- | --- | --- |
| Operator API `/operator/v1/*` | No cookies. `OPERATOR-AUTH-V1` header only. No CORS. Loopback listener. | LA-ADR-06 D3 | Must |
| `POST /tool/picker/{id}/cancel` | As the picker POST: `Origin` = `PUBLIC_APP_URL`, else `403` and no change. | LA-ADR-05 D3 | Must |
| `POST /lti/launch/{account}/storage-check` | No ambient credentials: the check value (single use, 120 s, hash stored) is the authorization. `Origin` must be the origin of `PUBLIC_LTI_URL` (the page sends `Referrer-Policy: same-origin`); else `400 INVALID_STATE` (`storage_origin`) and the check stays unused (A-LAD-09; residual R-LA-6). | LA-ADR-05 D1 | Must |
| Portal `POST …/check`, `POST …/verify` (Could) | As every portal API write: session cookie and `Origin`. | LA-ADR-08 | Could |

## §7 Untrusted package content

Keep. LA changes nothing here.

## §8 Tenant isolation

| Change | Detail | Source | Priority |
| --- | --- | --- | --- |
| Tool account status | `suspended` stops login, launch and API calls (`403 TOOL_ACCOUNT_SUSPENDED`); `closed` revokes every key. | LA-ADR-06 D2 | Must |
| Per-account tool URLs | Set only by an operator; https; no user info or fragment; not our own LTI or content host. | LA-ADR-06 D2 | Must |
| API key scopes | `launch` and `admin`. A leaked launch-side key cannot change platforms. | LA-ADR-06 D5 | Must |
| Four tenancy layers | Tool account, library, connection, deployment, with the rules of LA-ADR-07 D1; channel code gets a bound port context, never a database handle. | LA-ADR-07 D1; LA-ADR-01 import rules | Must |
| Two-tenant tests | Author unit fixtures for every app port with tenant data and every new LTI service repository; QA black-box checks per new route (LA-ADR-07 AP-07-01, AP-07-02). | LA-ADR-07 D1 | Must |
| Service key write scope | Account setting `resource-link`: a service key writes only its own resource link's line items (A-T3a-04). | LA-ADR-06 D8; LA-ADR-07 D7 | Should |
| Service key revoke | Revoke by platform, deployment, context or resource link; the next launch gets a new value (epoch). | LA-ADR-06 D8 | Should |

## §9 Outbound requests

| Change | Detail | Source | Priority |
| --- | --- | --- | --- |
| Platform throttling | A platform `429`, or `403` with `Rate Limit Exceeded`, maps to `429 PLATFORM_RATE_LIMITED` with `Retry-After` (clamped 1–3,600 s). No automatic retry inside the LTI service. | contract delta §1.3 | Must |
| Platform access token | The required outcome "the platform access token goes only to platform URLs" (§8) now has a precondition: a client assertion is signed and sent only for an **active** platform, whose token endpoint and audience the binding proved (issuer origin for `self`) or an operator grant bound (A-LAD-01; LA-ADR-07 rule A6). A staged platform makes no token request. | LA-ADR-07 A6; contract delta §4.6.1 rule 7 | Must |
| Connection check | `POST /api/platforms/:id/check` calls only the stored JWKS URL and token endpoint of that platform, through the guarded client, and only when the platform and the deployment are active (A-LAD-01); one call per minute per platform and deployment. | LA-ADR-08 D4 | Could |
| Keep | The guarded client rules (https only, no redirects, 5 s, 1 MB, IP check in the lookup). | — | — |

## §10 Keys and secrets

Replaced and new rows of the table:

| Secret | Made by | Stored | Production |
| --- | --- | --- | --- |
| Tool RSA key | operator API (`POST …/signing-keys`); the bootstrap CLI is a client | `tool_key`, states `next` / `active` / `retired` / `removed`; private part sealed by the key provider (associated data = table, column, account, kid) | cloud KMS key provider (LG), 90-day rotation |
| API key | operator API, shown once | `api_key`: SHA-256 hash, scopes, expiry, last use, revoke; at most 2 active per account | same; secret manager on the tool side |
| Operator key (new) | `lti:operator init` (first), then the operator API | `operator_key`: SHA-256 hash, operator name, 90-day expiry | SSO for operators (LG) |
| Master keys → key ring | `gen-env` (dev) | `LTI_KEYRING_FILE` (versions; one active) or `LTI_MASTER_KEY(_FILE)` as version `legacy`; every sealed value names its version | cloud KMS (LG) |
| Service key | first launch of a resource link | hash only; derivation version (`legacy` = today's HMAC) and issue epoch; revocable (Should) | same |
| Storage check value (new) | launch, 32 random bytes | SHA-256 hash only, 120 s, single use | same |
| Verification code (new, Could) | admin launch, 80 bits | SHA-256 hash only, 30 min, single use, 5 tries | same |
| Connection secret (new port, LB/LF) | portal or operator | sealed per (library, connection, purpose); never returned | same |
| Idempotency record (Should) | API | stored answer body, 24 h, per tool account | same |

**Visibility rule for the test container (A-T1-03 extension, Must).** Build ratification 2026-10-22 ([build decisions A2](build-decisions-A2.md) BD-A2-03; finding A-LA-E5-08-03, fixed by lane S1).

| Rule | Detail |
| --- | --- |
| Base (A-T1-03, T1) | The `e2e` container reads the repo read only. It sees only QA's own credentials: the public copy of `.env`, the public certificates, and `infra/.secrets` read only (`seed.json`, the API key files, the operator key file). It sees no master key and no private TLS key. |
| Key material is hidden | The `e2e` container runs as root, so file mode `0600` does not protect a file in a visible folder. An empty tmpfs covers `/repo/infra/.secrets/lti` in the `e2e` service (`infra/compose.yaml`), on top of the read-only `infra/.secrets` bind. So the key ring is never visible there. |
| Mount point first | The host folder `infra/.secrets/lti` (mode `0700`) must exist before `docker compose up`: `stack-up.sh` and `prepare_e2e` (`infra/scripts/lib.sh`) make it. The read-only parent bind cannot make the mount point, so a missing folder stops the `e2e` start (fail closed). The fix is to make the folder, never to remove the tmpfs line. |
| Test rings | QA writes a test key ring only from its host clone (tasks README form (a)), never from the `e2e` container. |
| New key material | A new key ring or master-key file (for example the app key ring of LA-E5-22, the `*_FILE` secrets of LA-E5-21) goes into a folder that the `e2e` container does not see: `infra/.secrets/lti/` for the LTI service, or a new folder with its own empty tmpfs in the `e2e` service. Each hidden folder has a check in `infra/scripts/compose-e2e-secrets.test.mjs` (`npm run test:infra`). |
| Visible on purpose | The operator key file stays visible: QA calls the operator listener with it in the `acceptance` profile (LA-ADR-06 D3, AC-LA-E5-01-01). It is a credential of a test stack, like the API key files. |

## §11 Privacy and logs

| Change | Detail | Source | Priority |
| --- | --- | --- | --- |
| Claim policy | A tool account `claimPolicy` (`allowlist` or `passthrough`, `keep` groups) on top of the profile `privacyFloor`. New accounts default to `allowlist`. `cogniate` moves to `allowlist` in E3 (D-9). | LA-ADR-05 D7; LA-ADR-02 D2 | Should |
| Tenant id in logs | `tool_account_id` and `platform_id` in request and launch events when known. | LA-ADR-06 D10 | Should |
| Client address | Only in `rate_limited` (IP classes) and in audit events. Retention: LA-H4. | LA-ADR-06 D1, D4 | Must |
| Audit log | Append-only table per service; no key, token or note text; `note_present` only. | LA-ADR-06 D4; LA-ADR-07 D5 | Must |
| Redaction | The logger list (`packages/shared/src/logger.ts:46-59`) already covers names that end with `key`, `secret`, `token`. Add the exact field names `verificationCode` and `storageValue`. Do not add a `code` suffix rule: error codes use the field `code`. The operator key prefix `ltio_` gets a value pattern like `ltis_` (`logger.ts:58`). | LA-ADR-05 D1; LA-ADR-06 D3; LA-ADR-08 D3 | Must |

## §12 Multi-LMS

| Change | Detail | Source | Priority |
| --- | --- | --- | --- |
| Fixed profiles | Keep; profiles move into channel folders (A1). A profile change is still an architecture change with a QA criterion. | LA-ADR-01 D6 | Must |
| Signed product family | Check 14 becomes generic, with two guard levels (LA-ADR-01 D6, B-LAD-04): `launch` (Canvas, Blackboard: a launch of their family on another profile is refused; same refused set as M1) and `registration` (new channels: refused at Dynamic Registration and at create; a launch on a Moodle `standard` platform, the typed-value `self` path of `MANUAL_SELF_LEGACY_CHANNELS`, is refused before any claim is stored (A-LAD-19); on every other platform a launch only logs `family_guard_mismatch`, so a new named channel never breaks live `lti-generic` connections of its LMS). | LA-ADR-01 D6 | Must |
| Binding approval | Keep for `operatorGrant` methods. Authority rules A1–A6 (LA-ADR-07 D2) for every channel. The manual methods of `lti-generic` and `brightspace` use `operatorGrant` and bind every admin value. | LA-ADR-07 D2; LA-ADR-02 D3, D6 | Must |
| Grant evidence | Fields `--evidence-channel`, `--evidence-ref` (required in the production profile); `--operator`. Stored in the app audit event `details` (no note text), not in the grant row. | LA-ADR-07 D4, D5 | Must |
| Verified admin launch | Reserved third strategy; Canvas and generic only; Blackboard stays operator-only. | LA-ADR-08 D2, D3 | Could |

## New §13 Rate limits (Must)

Token buckets per class and key, in memory, bounded map; classes and defaults in [LA-ADR-06 D1](adr/LA-ADR-06-service-operability.md#d1-rate-limits-must). Operators change limits per account or globally through the operator API (audited). `X-Forwarded-For` only from `TRUSTED_PROXY_CIDRS` (compose: the `proxy` service only). Only a failed API key or operator key spends the `auth_failure` bucket of the address; an ltik or service key `401` under a valid API key spends nothing (A-LAD-02). The account-wide protocol and registration classes are soft: log and alert, never `429` (A-LAD-07, R-LA-5). IPv6 addresses count by /64. At most 10 open registration sessions per client address and tool account (a setting).

## New §14 Operator API and audit (Must)

Loopback listener, own credential, one audit event per call, append-only storage, `audit.read` for reads of the audit log. Details: [LA-ADR-06 D3, D4](adr/LA-ADR-06-service-operability.md#d3-operator-api-must).

## New §15 Production profile (Should)

`STACK_PROFILE=production` refuses to start with an active test knob, simulation profiles on, a non-empty private-host allowlist, a master key in the environment, no trusted proxy list, or an operator listener on a non-loopback address. `/healthz` shows only `status` and `service`. [LA-ADR-06 D12](adr/LA-ADR-06-service-operability.md#d12-production-profile-and-secrets-from-files-should).

## Residual risks (additions for `open-questions.md`, through the Lead)

| Id | Risk | Why accepted | Where |
| --- | --- | --- | --- |
| R-LA-1 | Moodle manual connect stays `self` (first come, first served with typed values). | No behaviour change; LA-H23 decides a stronger rule. | LA-ADR-07 D2 |
| R-LA-2 | App operator identity is self-asserted by a person with shell access. | Accountable now; SSO in LG. | LA-ADR-07 D4 |
| R-LA-3 | Rate limits are per process. | One instance in LA and the pilot. | LA-ADR-06 D1 |
| R-LA-4 | The storage path stores minimized, signed claims for up to 120 s before the browser binding is proven. | No ltik and no tool access before check 2s; deleted after 10 min. | LA-ADR-05 D1 |
| R-LA-5 | The account-wide protocol and registration limits are soft (log and alert only). | A hard account bucket lets any sender block every library; per-address limits stay hard; WAF in LG. | LA-ADR-06 D1 |
| R-LA-6 | A person who starts a login can carry the storage check to a second browser that they control. | The `Origin` rule stops foreign sites; the rest is the class of residual R2. | LA-ADR-05 D1 |
| R-LA-7 | On a generic LMS host, a person who can serve a configuration file and a registration endpoint under an issuer path can register that path for their own library. | I-SELF keeps every token request on that host; Moodle needs its fixed configuration path. | LA-ADR-02 D2a; LA-ADR-07 T25 |
| R-LA-8 | The `e2e` hide rule is a deny list on the `infra/.secrets` bind: a new secret file put straight into `infra/.secrets/` is visible to the `e2e` container until it gets a hidden folder. | Only dev and acceptance stacks have the `e2e` service; the infra test checks every hidden folder; the §10 rule "New key material" names the place for new keys. | §10 visibility rule |
| R4 (update) | Teacher Deep Linking in Safari | Solved for platforms with platform storage (Canvas first); still open for Moodle 5.2 (no storage target). | LA-ADR-05 D1 |
