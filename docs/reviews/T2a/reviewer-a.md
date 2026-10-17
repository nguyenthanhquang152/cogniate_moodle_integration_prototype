Verdict: APPROVE
Round: 1

# Reviewer-A: T2a review (lens: "Is it right and is it safe?")

Scope:

- `git diff 04f0a3c 7bfbbb1 -- . ':!docs' ':!tests'`: `services/lti-service/**`, `packages/shared/src/outbound.ts`, and the infra scripts.
- Spec: `tasks/T2a.md`, `security.md` §2, §3, §8, §9, contract §1–§3.1, §3.9, §5.
- The diff also has `apps/player-spike/**` (the T5 spike). That is not part of T2a, and I did not review it.

Method:

- I read all the code. I mapped each check to `security.md` §2.2, and checked them against LTI 1.3 Core and the 1EdTech Security Framework §5.1.3.
- I tested the real `outbound.ts` with my own scripts in temp folders: the blocked-range function, a fake transport, and a local `node:https` server.
- I made read-only HTTP checks on the Author's stack: JWKS, error pages, 405, an `error` field with a script, a bad ltik. None of these calls makes a state row.
- I scanned `infra/.logs/lti-service.jsonl`.
- I did not read `reviewer-b.md`.

Counts: 0 BLOCKER, 0 MAJOR, 2 MINOR, 3 NIT.

## The launch checks against the specs (all correct)

| security §2.2 | Code | Result |
| --- | --- | --- |
| 1 + 3 state exists, single use | `consumeState`: one `UPDATE … WHERE used_at IS NULL AND expires_at > ? AND tool_account_id = ? RETURNING …` | Correct and atomic. A parallel second POST gets no row. The state is used up also when a later check fails. |
| 2 state cookie | `check2Cookie`: exact name `__Host-lti_state_<8>`, `safeEqual` | Correct. `STATE_COOKIE_MISSING` is distinct from `INVALID_STATE`. |
| 4 compact JWS, RS256, kid | regex with 3 non-empty parts, `alg === 'RS256'`, `kid` | Correct. `none` fails (empty signature), and so does `HS256`. |
| 5 iss, aud, azp | string or string-array `aud`; `azp` required when there is more than one `aud` | Correct (see A-T2a-03 for one SHOULD). |
| 6 signature | `compactVerify(…, createLocalJWKSet, {algorithms:['RS256']})` | Correct. `compactVerify` (not `jwtVerify`) adds no jose time rule, so check 7 alone decides the time. The payload that is checked is the same verified string. |
| 7 exp, iat | `exp > now − 60`, `iat < now + 60`, both must be numbers | Correct. `nbf` is not checked, which the spec allows. |
| 8 nonce | `safeEqual` with the state's nonce | Correct. It is single use through the single-use state. |
| 9 deployment | in `platform.deploymentIds` | Correct. |
| 10 version, message type | `1.3.0`; resource link or deep linking | Correct. |
| 11 claims | `sub` not empty, `roles` is a string array (it may be empty, as the spec allows), `target_link_uri`, `resource_link.id` or `deep_link_return_url` | Correct. |
| 12 target | equal to the state's target **and** the same origin and exact path `/lti/launch/{account}` (no fragment, no user info) | Correct. The login does the same check. So a learner cannot edit the login form to change the signed target. |

Other points that I verified:

- **Login (§2.1).** It looks up the platform by (account, iss, client_id). Without `client_id`, it fails when more than one platform matches. It checks deployment and target. State and nonce are 32 random bytes each (`randomToken`).
- **Cookie (security §3).** `Path=/; Max-Age=600; Secure; HttpOnly; SameSite=None; Partitioned`, no `Domain`. The clear cookie keeps `Partitioned`, which is needed to delete it in the same partition.
- **ltik.** 32 random bytes; only the SHA-256 hash is stored. The lookup includes the tool account and the expiry, so another account's key gets 401 (AC-T2-18). The TTL is a registered knob.
- **API key.**
  - `ltis_` + 43 characters, format-checked. Only the SHA-256 hash is stored, with `UNIQUE`.
  - The lookup is a hash lookup, so no JS string compare runs on the secret. A constant-time compare is not needed for a hash of a 256-bit key.
  - The key file is written with `umask 077` (live: mode 600).
- **Platforms API.** https only. The auth, token and JWKS URLs must be on the issuer origin. `JWK_SET` only. Every lookup includes the tool account.
- **Error pages.**
  - The code, the action text and the OIDC error text are HTML-escaped.
  - Live headers: `default-src 'none'; style-src 'self'; frame-ancestors https:; form-action 'none'`, `Referrer-Policy: same-origin`, `Cache-Control: no-store`, no `Set-Cookie`, no `Location`. This is as resolved in A-T0-20.
  - A POST with an unknown state and `error=<script>…` gives `INVALID_STATE`, with no script in the page.
- **JWKS.**
  - Live: the keys have only `alg`, `e`, `kid`, `kty`, `n` and `use`. An unknown account gets 404.
  - The cache is 10 min per URL. An unknown `kid` causes one refetch, at most once per minute.
  - A bad signature with a known `kid` causes no refetch, so tokens cannot force fetches.
- **Logs.**
  - Live: 27 lines and 0 hits for the two API keys. There are no JWT-like strings, no `ltis_` strings and no 43-character tokens.
  - `trace_id` is on every line. `http_request` paths go through `redactPath`.
  - `internal_error` logs only the error name.
- **T1 side items.**
  - A-T1-08 is resolved: the host cases now use `https://` (port 443).
  - A-T1-09 is resolved: `require_own_project` is in `gen-env` and `stack:reset`, and a reset without `.env` needs an explicit project name.
  - B-T1-12 (a new `.env` needs Docker) is fine.
  - The new `infra/.data/lti-service` folder has mode 700 (live).

## The SSRF guard: `node:https` `lookup` instead of an undici `Agent`

**I accept it as equivalent** for the guard in security §9:

- The socket connects to the addresses that the guarded `lookup` returns, so there is no second resolution.
- Every address of the answer is checked, also with `all: true` (Node's happy-eyeballs path).
- IP literals do not go through `lookup`, so the code checks them first. The WHATWG URL parser already turns `0x7f.1` and `2130706433` into `127.0.0.1`.
- A pooled keep-alive socket is keyed by host, and the allowlist decision is also by host, so pooling cannot bypass the check.
- My tests (real module): all spec ranges block, including `::ffff:127.0.0.1`, `::ffff:7f00:1`, `64:ff9b::7f00:1` and `100.64.0.1`. `8.8.8.8` and `::ffff:8.8.8.8` pass.

Conditions, for the Architect:

- Change the wording of §9 to "the lookup that the connection uses (the `node:https` `lookup` option, or undici `connect.lookup`)".
- Keep environment proxies off for this client (A-T2a-04).

## Answers to the Author's open contract questions

1. **`network_error` reason.** Add it to the §9 reason list (connection refused or reset, TLS failure). It is a real and different outcome. Mapping it to an existing reason would mislead.
2. **`PLATFORM_NOT_ACTIVE` at launch.** Keep it. A platform can be switched off in the 10 min between login and launch. Document it in §2.2 as a check after check 1 (the state's platform must exist and be active). Its status is 403, which is outside the "400 or 401" sentence of §2.2, so update that sentence too.
3. **`METHOD_NOT_ALLOWED`.** Add the code to contract §2.2 (`GET /lti/launch/{id}` → 405 page with `Allow: POST`). It is correct live.
4. **`node:https` lookup.** Equivalent: see the section above.

---

## MINOR

### A-T2a-01 — MINOR — A redirect or a too-large answer logs two `outbound_blocked` events

- **Location:** `packages/shared/src/outbound.ts:167-210` (`blocked()`, `fail()`, the timer).
- **Problem:** The 5 s timer is not cleared on the redirect, too-large and response-error paths, and `blocked()` logs before it checks `settled`. So one call logs a second, wrong event later. Security §9 says "Every call logs exactly one event".
- **Evidence:**
  - Real `node:https` against a local server, with a 0.8 s timeout:
    - one 302 logged `["outbound_blocked:redirect","outbound_blocked:timeout"]`;
    - one oversized body logged `["outbound_blocked:too_large","outbound_blocked:timeout"]`.
  - With a transport that resets on destroy, the second event was `network_error`.
  - The unit tests do not wait for the timer, so they miss this.
  - QA and humans read these events as evidence (for example T3b's `outbound_blocked {reason: redirect}`). A later `timeout` line for the same host is misleading.
- **Fix:**
  - Clear the timer inside `fail()` and at every terminal path.
  - Log in `fail()` only when the call was not settled yet. Do not log in `blocked()`.
  - Add a test with fake timers that asserts exactly one event for each reason.

### A-T2a-02 — MINOR — Check 6 is the only network step in the launch, and a JWKS fetch error has no fallback to the cached keys

- **Location:** `services/lti-service/src/lti/jwks.ts:26-36`.
- **Problem:** After 10 minutes the cache is stale. If the platform JWKS fetch then fails (timeout, 5xx, or a short Moodle restart), every launch fails with `INVALID_SIGNATURE`, even though the cached keys are still valid.
- **Evidence:**
  - `verify()` calls `fetchJwks()` when `now − fetchedAt > CACHE_MS`, and the fetch error goes up as a signature failure.
  - Moodle rotates its platform key rarely.
  - The error page says "Start again from Moodle", which does not help while the fetch keeps failing.
  - This is availability, not a hole. I rate it MINOR because it is on the launch path.
- **Fix:**
  - When the refresh fails, verify with the stale cached keys (for example up to 24 h old). Log `outbound_blocked` or `outbound_request` as now.
  - Map a JWKS fetch failure with no usable cache to its own code (for example `PLATFORM_KEYS_UNAVAILABLE`, with "Moodle did not answer; try again in a minute"), not `INVALID_SIGNATURE`.

## NIT

### A-T2a-03 — NIT — With one `aud`, an `azp` with another value is accepted

- **Location:** `services/lti-service/src/lti/checks.ts:101-107`.
- **Problem:** Security Framework §5.1.3 says: "If an azp Claim is present, the Tool SHOULD verify that its client_id is the Claim's value". The code checks `azp` only when there is more than one `aud`.
- **Fix:** When `azp` is present, require `azp === client_id`, whatever the number of `aud` values. Add one unit test.

### A-T2a-04 — NIT — Guard hardening outside the spec list

- **Location:** `packages/shared/src/outbound.ts` (ranges, agent); `security.md` §9.
- **Problem and fix:**
  - Some IPv6 forms that embed an IPv4 address pass: IPv4-compatible `::a.b.c.d` (`::/96`, my test: `::127.0.0.1` allowed), 6to4 `2002::/16`, and the old site-local `fec0::/10`. The spec list does not have them either. They are not reachable in our IPv4-only containers. Block them for defence in depth, and add them to §9.
  - Give the client its own `https.Agent`, and never let Node's environment proxy support (`NODE_USE_ENV_PROXY`) apply to it. With a proxy, `lookup` would check the proxy's IP and not the target.
  - The "DNS rebinding" unit test uses one answer with a public and a private address. Also assert that the resolver is called exactly once for each connection. That is the property that stops rebinding.

### A-T2a-05 — NIT — The bootstrap wrapper puts the new API key on a command line

- **Location:** `infra/scripts/lti-bootstrap.sh:26-27` (`node -e '…' "$out"`, where `$out` holds `apiKey`).
- **Problem:** For a moment the key is visible to other local users in the process list (`ps`).
- **Fix:** Pipe `$out` to `node` on stdin, or parse it with `jq` from stdin.
