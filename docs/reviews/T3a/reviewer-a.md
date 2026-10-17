Verdict: APPROVE
Round: 1

# Reviewer-A: T3a review (lens: "Is it right and is it safe?")

Scope:

- `git diff b99b87e a0a753d -- . ':!docs' ':!tests'`: service keys, the platform token client, the Deep Linking response, AGS scores and line item reads, the single-flight JWKS change, the shared errors and crypto, and the `app.ts` split.
- Spec: `tasks/T3a.md`, contract §3.2–§3.6 and §4, `security.md` §2.3, §8 and §9, ADR-010.

Method:

- I read all the code.
- I tested the real `service-url.ts` with crafted line item URLs. The probe script was in `services/lti-service/` for about one second, so that its imports resolve, and then I deleted it.
- On the live Moodle I checked how nginx treats encoded slashes, with harmless public `GET` requests only.
- Read-only: the `service_key` table (SQLite opened with `mode=ro`) and `infra/.logs/lti-service.jsonl`.
- I did not read `reviewer-b.md`.

**Note for the Lead:** the Author's live stack runs the working tree, which already holds T3b work in progress. During my checks, `lti-service` crashed (`main.ts` cannot load `src/http/routes/registration.ts`; "Failed running 'src/main.ts'"), and every `lti.cogniate.test` request now gets 502. This is not a T3a defect: QA tests the T3a commit on its own stack. My DB and log checks were done before the crash.

Counts: 0 BLOCKER, 0 MAJOR, 1 MINOR, 3 NIT.

## Verified

| Area | Result |
| --- | --- |
| **Service keys** | The key is `HMAC-SHA256(subkey, len:field|…)`, where `subkey = HMAC(LTI_MASTER_KEY, "cogniate-lti/service-key/v1")`. This separates it from the AES use of the master key, and the length-prefixed fields cannot be confused with each other. The same scope always gives the same key, a new platform id gives a new key, and nobody can compute a key without the master key. Only the SHA-256 is stored. Live: the `service_key` table has a 64-hex `key_hash` and no key column (2 rows). The lookup needs the hash **and** the API key's account **and** `revoked_at IS NULL`, so a key with another account's API key gets 401 (AC-T3-18). A revoked key is never issued again. A deep-linking launch (no resource link) gets no key. |
| **SERVICE-AUTH-V1** | The header is split at the first `:` (shared parser). The API key and the service key are both found by hash lookup, so no JS string compare runs on a secret. A constant-time compare is not needed for hashes of 256-bit keys. |
| **Deep Linking JWT** (security §2.3) | `iss` = client id, `aud` = platform issuer, a fresh random `nonce`, `deployment_id` from the launch, `message_type = LtiDeepLinkingResponse`, `version = 1.3.0`, `content_items` as sent (only the default `url` may be added), the `…/lti-dl/claim/data` claim echoed when the request had it, and `msg`, `log`, `errormsg`, `errorlog` up to 2000 characters. It is signed with the active RS256 key (`kid` = thumbprint), with `iat = now − 30 s` and `exp = now + 300 s`. `target` = the **signed** `deep_link_return_url`. Items are checked: 1 to 20, `accept_multiple`, `accept_types`, string `custom` values, `scoreMaximum` above 0, and `ltiResourceLink.url` must be exactly our launch URL. A resource-link ltik gets 403. |
| **Token client** (RFC 7523) | `grant_type=client_credentials`, `client_assertion_type=…jwt-bearer`, and an assertion with `iss = sub = client_id`, `aud` = token endpoint, a random `jti`, `iat − 30 s` and `exp + 300 s`. Each call asks for **one** scope only (the minimum). The cache key is (platform id, sorted scope set), and an entry is used until 60 s before it expires. It is single-flight per key, and a failed shared fetch rejects all waiters once and is cleared in `finally`. Tokens are never logged. |
| **AGS client** | The order in every call is: URL rule (no outbound call for a foreign URL), scope of the launch or key, token, then one request. `/scores` and `/results` are added to the path, and the query (`type_id`) is kept. The URL rule needs the same origin, a path equal to the claim path or continuing it after `/`, and every claim query parameter exactly once with the same value. `type_id` therefore binds the tool. |
| **Score clock** | In memory, per (platform, line item URL, user), at least 1 s apart, with a floor of the start time + 2 s (my T0 NIT A-T0-23). |
| **Error mapping** | 409 → `PLATFORM_CONFLICT`. 400 and 404 → `PLATFORM_REJECTED_REQUEST`, with a short platform text (control characters removed, at most 200 characters, HTML-escaped). Other statuses → `PLATFORM_ERROR`. A timeout → `PLATFORM_TIMEOUT`. No token appears in a description. |
| **Single-flight JWKS** (A-T2b-01) | `fetchInto` catches every error and resolves `false`, and never rejects, so waiters are not poisoned. After the shared fetch, a waiter uses either the new keys or the still-valid cached keys, or it fails for this call only (`jwks_unavailable` or `jwks_fetch_failed`). The one-attempt-per-minute rule is unchanged. |
| **Refactor** (`app.ts` split, shared errors and crypto) | `routes/protocol.ts` keeps `302`/`303` with `Cache-Control: no-store`, `Referrer-Policy: no-referrer` and the state cookie. Error pages keep `ERROR_PAGE_HEADERS`. `maxParamLength` is set for the encoded line item id. |
| **Logs** | Live: 24 `platform_token` events and 37 `outbound_request` events. No API key, JWT, `Bearer` string or 43-character token. All 348 strings of 32 hex characters are `trace_id` values, so no Moodle access token is logged. |

---

## MINOR

### A-T3a-01 — MINOR — The line item URL rule accepts encoded `/` and `\`, and Moodle's nginx turns them into a path into another course

- **Location:** `services/lti-service/src/lti/service-url.ts:11-25` (`isAllowedServiceUrl`).
- **Problem:** The rule compares WHATWG-parsed paths, where `%2F` and `%5C` are ordinary characters. Moodle's nginx decodes them and resolves `..` before PHP reads `PATH_INFO`. So a line item URL can pass the "inside the claim path" test and still reach another course of the same tool.
- **Evidence:**
  - Live Moodle: `/theme/image.php/boost/core/1/i/nosuchdir%2F..%2Fedit` → 200 with the same 529-byte `edit` icon as `/i/edit`.
  - With the claim `https://moodle.test/mod/lti/services.php/2/lineitems?type_id=1`:
    - `…/2/lineitems/x%2F..%2F..%2F..%2F3%2Flineitems%2F9%2Flineitem?type_id=1` → **ALLOWED**;
    - `…/2/lineitems/x%5C..%5C..%5C3/…` → **ALLOWED**;
    - plain `../` and `%2e%2e/` → blocked (the URL parser resolves them).
  - `lineItemSubUrl` keeps the encoding (`…%2Flineitem/scores?type_id=1`), and nginx resolves it to course 3's scores.
  - The query rule still forces the same `type_id`, and the token is the same platform's, so other tools and other tenants stay blocked. A caller needs the API key.
  - But the course binding (security §8, the intent of AC-T3-16) can be bypassed. The same function will also check the NRPS `url` in T3c (member data).
- **Fix:**
  - Reject a candidate whose path has `%2F`, `%5C` or `%2E` (any case), `\`, or `;`.
  - Or decode the path once, reject if the result has `%`, `\`, `/./` or `/../`, and then compare.
  - Add unit tests with the two strings above, and add the `%2F` variant to AC-T3-16.

## NIT

### A-T3a-02 — NIT — A client `timestamp` on a score has no upper bound

- **Location:** `services/lti-service/src/platform/score-clock.ts:17-21`; `platform/ags.ts:96-99`.
- **Problem:** A future `timestamp` (for example the year 3000) is sent as given, and it also moves our clock for that key. Moodle stores it as the grade time, so every later score for that learner and line item gets 409, until a teacher acts.
- **Evidence:** Only the API key holder (the app) can send `timestamp`, so this is a robustness point, not a hole.
- **Fix:** Reject a `timestamp` more than 60 s in the future (`INVALID_REQUEST`, field `timestamp`).

### A-T3a-03 — NIT — Token cache details

- **Location:** `services/lti-service/src/platform/token-client.ts:53-76`.
- **Problem:**
  1. A caller that waits for an in-flight token request logs `platform_token {cache:"hit"}`, also when the shared request then fails. QA counts these events (AC-T3-22, AC-T3-24).
  2. `expires_in` has no upper limit, so a broken platform answer can pin a token for days.
- **Fix:** Log `cache:"wait"` (or nothing) for waiters, and only after success. Cap the cached life at, for example, 3600 s (Moodle's value).

### A-T3a-04 — NIT — A service key reaches every line item of its course and tool, not only its own activity

- **Location:** `lti/service-url.ts` `agsBaseUrl` (the context `lineitems` URL); contract §3.4.
- **Problem:** This is as the contract defines it, and it matches the AGS rights of the tool. But a service key that leaked together with the API key can write grades for **all** activities of that course, not only its own.
- **Fix (decision for the Architect):** For `SERVICE-AUTH-V1` score writes, allow only the key's own `lineitem` URL (or line items whose `resourceLinkId` is the key's resource link), and keep the context-wide reads. No change is needed for the prototype if the Architect accepts the context scope.
