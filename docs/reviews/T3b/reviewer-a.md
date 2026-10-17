Verdict: APPROVE
Round: 1

# Reviewer-A: T3b review (lens: "Is it right and is it safe?")

Scope:

- `git diff 47d55c3 7d9f2c7 -- . ':!docs' ':!tests'`: dynamic registration (`lti/registration.ts`, `http/routes/registration.ts`, `store/registrations.ts`, migration 003), the "update" rule, the A-T3a-01 fix (`hasPathTrick`), and the score timestamp limit.
- Spec: `tasks/T3b.md`, contract §2.4, §3.4, §3.6 and §3.8, `security.md` §2.4, §2.5 and §8, ADR-009.

Method:

- I read all the code, and checked Moodle 5.2.4 `registration_helper::validate_registration_token`.
- I probed the real `isAllowedServiceUrl` with 13 paths. The probe script was in `services/lti-service/` for about one second, so that its imports resolve, and then I deleted it.
- Read-only live checks:
  - the `/lti/register/unknown` error page;
  - an SSRF configuration URL (it is refused before any session is made);
  - the `registration_session` table (SQLite `mode=ro`);
  - the log.
- I did not read `reviewer-b.md`.

Counts: 0 BLOCKER, 0 MAJOR, 1 MINOR, 2 NIT.

## Verified

| Area | Result |
| --- | --- |
| **Configuration fetch (SSRF)** | The `openid_configuration` URL goes through the guarded outbound client. `issuer` must equal the origin of the configuration URL. The authorization, token, JWKS and **registration** endpoints must be https on that origin. Live: `openid_configuration=https://169.254.169.254/x` → `400 FETCH_FAILED`, with the log `outbound_blocked {host: 169.254.169.254, reason: private_ip}` and `registration_rejected`. No session was made. |
| **Registration token** | Verified with the platform JWKS from the checked configuration (`keys.verify`: guarded fetch, RS256 only, single-flight). `exp` is checked with 60 s skew. Moodle's token has no `iss` or `aud` (`{sub, scope, iat, exp}`), so there is nothing more to check. The operation comes only from `scope` (`reg` → new; `reg-update` with `sub` → update). Any other scope is refused. Single use is enforced by Moodle: `validate_registration_token` throws `token_already_used` when a tool with that client id exists. The token is not in the 303 to the app (AC-T3-01). It is stored AES-256-GCM encrypted: live, the column is a BLOB with no plaintext `eyJ`. |
| **"Update" rule (security §2.5): can library B take over library A's tool?** | No, not at the LTI-service level. `existingPlatformId` comes from (account, **issuer of the checked configuration**, deployment id = token `sub`). A foreign platform therefore cannot name another issuer's platform. `complete` with `operation = update` needs `updatePlatformId === existingPlatformId`, and that platform must be in the same account. Otherwise it returns `409 REGISTRATION_UPDATE_NOT_ALLOWED` **before** the session is claimed and before anything is sent to Moodle. All libraries share the `cogniate` account, so the last rule ("only the same connection") must be in the app (T4b1, contract §6 `UPDATE_NOT_ALLOWED`). That is as designed, and Reviewer-A will check it in T4b1. |
| **Session lifetime and retry** | `expiresAt = min(token exp, now + 1 h)`, and an expired session is `REGISTRATION_NOT_FOUND`. `complete` claims the session atomically (`open → completing`): a parallel second call → `409 REGISTRATION_ALREADY_COMPLETED`. A failure releases it (`completing → open`) for a retry. See A-T3b-01 for the case where Moodle already created the tool. |
| **Tool configuration sent** (ADR-009) | `application_type: web`, `response_types: [id_token]`, `grant_types: [implicit, client_credentials]`, `token_endpoint_auth_method: private_key_jwt`. Login, redirect and JWKS URLs carry the account. AGS `lineitem`, `lineitem.readonly`, `result.readonly` and `score`, plus NRPS. `domain` = the LTI host, and `target_link_uri` = the launch URL. A Deep Linking message targets the launch URL. `claims` = `["iss","sub"]` for `anonymous`, which is the default when neither the query nor the body names a level. Live: both completed sessions (`new`, `update`) have `privacy_level = anonymous`. |
| **Pass-through parameters** | Strings only, at most 20 of them, key ≤ 64 and value ≤ 512 characters. `openid_configuration`, `registration_token` and `privacyLevel` are never passed on. |
| **Error pages** | Live: `/lti/register/unknown` → HTTP 404, `data-error-code="UNKNOWN_TOOL_ACCOUNT"`, CSP `… frame-ancestors https:; form-action 'none'` (AC-T3-28). |
| **A-T3a-01 fix** (`hasPathTrick`, contract §3.4 rule 4) | It checks the **raw** path before URL parsing. `%2F`, `%5C`, `%2E` and `%25` (any case) and `\` are refused, and so are `.` or `..` segments, raw or after up to three decodes. A broken escape is refused. My probe: allowed `/7/lineitem` and a `%2F` in the query only. Blocked `x%2F..%2F..%2F3/…`, `%252F`, `%25252F`, `%2e%2e`, `.%2e`, `%2E.`, `%5c`, `\`, `/./`, and overlong `%C0%AF`. Resolved. |
| **Score timestamp** (AC-T3-30) | A client `timestamp` later than now + 15 min → `INVALID_REQUEST` (field `timestamp`) before any outbound call. This resolves my A-T3a-02. |
| **Logs** | No JWT-like string, no `registration_token=`, and the registration events carry only safe `detail` words. |

---

## MINOR

### A-T3b-01 — MINOR — After Moodle created the tool, a failed `complete` can never succeed on retry

- **Location:** `services/lti-service/src/http/routes/registration.ts:162-215` (`releaseRegistrationSession` on every error).
- **Problem:** If the registration POST reached Moodle and Moodle created the tool, but our side then failed, the session goes back to `open`. Examples: a timeout, a lost connection, or an answer we cannot parse. Every retry sends the same registration token again, and Moodle refuses it, so the admin keeps getting `PLATFORM_ERROR` and Moodle keeps an orphan **Pending** tool with our URLs.
- **Evidence:** Moodle `registration_helper.php:381-385`: for `scope = reg`, `if (!empty($DB->get_record('lti_types', array('clientid' => $clientid)))) throw new registration_exception("token_already_used", 401);`. The outbound client allows 5 s, and Moodle's registration endpoint can take longer on a busy site.
- **Fix:**
  - After an attempt that **may** have reached Moodle (timeout, network error, unreadable 2xx answer), mark the session `unknown` instead of `open`, with a clear `PLATFORM_ERROR` text: "Moodle may have created the tool. In Manage tools, delete the Pending 'Cogniate (…)' tool, then start again with a new registration URL."
  - Map a Moodle `401 token_already_used` answer to the same text.
  - Keep `open` only for answers where Moodle certainly did nothing: a refused connection, or a 4xx from Moodle's checks.

## NIT

### A-T3b-02 — NIT — A "new" registration that returns an existing client id silently updates that platform

- **Location:** `services/lti-service/src/http/routes/registration.ts:195-205` (the `PlatformExistsError` fallback to `applyRegistrationUpdate`).
- **Problem:** On `operation = new`, a platform answer with a client id that we already have for the same issuer updates that platform without `updatePlatformId`. Moodle always issues a new client id, so only a misbehaving platform reaches this path. But the rule "nothing changes an existing platform without `updatePlatformId`" (security §2.5) is not kept here.
- **Fix:** Answer `502 PLATFORM_ERROR` ("the platform returned the client id of an existing registration") and do not update.

### A-T3b-03 — NIT — Two small hardening points

- **Location:** `registration.ts` `CompleteBody.messages[].target_link_uri`; `store/registrations.ts` `completeRegistrationSession`.
- **Problem and fix:**
  1. A `messages[].target_link_uri` from the `complete` body is sent to Moodle unchecked. Moodle only checks the domain, so a path of another account (for example `/lti/launch/qa-second`) would pass. Require `isOwnLaunchTarget(…, accountId)`, or drop the field.
  2. The encrypted registration token stays in the row for 24 h after completion. Set `registration_token_encrypted = NULL` in `completeRegistrationSession`, because the token is single use.
