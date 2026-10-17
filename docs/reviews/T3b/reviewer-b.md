Verdict: APPROVE
Round: 1

# T3b review — Reviewer-B (lens: "Can a human team own it?")

Scope: `git diff 47d55c3 7d9f2c7 -- . ':!docs' ':!tests'` (33 files). Spec: `tasks/T3b.md`, LTI contract §2.4, §3.8, security §2.4, §2.5, ADR-009.

| Check | Result |
| --- | --- |
| `npm run check` (HEAD `8c1f8b7`, contains `7d9f2c7`) | Pass: 32 test files, 421 tests (HEAD also has QA syncs; the Lead's clean worktree had 416) |

| Severity | Count | Ids |
| --- | --- | --- |
| BLOCKER | 0 | — |
| MAJOR | 0 | — |
| MINOR | 2 | B-T3b-01, B-T3b-02 |
| NIT | 1 | B-T3b-03 |

## My T3a items

| Id | Status | Evidence |
| --- | --- | --- |
| B-T3a-01 | **Resolved** (one small rest in B-T3b-03) | `http/routes/README.md` (5 lines) says where each route group goes, including `compat.ts` for T3c, and that route files only parse, authorize and call `lti/`, `platform/`, `store/`. All groups now take `RouteContext`, including `services.ts`. `serviceKeyForLaunch` moved to `lti/service-keys.ts`. The registration group uses zod. |
| B-T3a-02 | **Resolved** | The API code table is `api-errors.ts` in both services (lti-service `src/api-errors.ts`, cogniate-app `src/app/api-errors.ts`), plus `http/error-page.ts`, `platform/error-mapping.ts`. The old shared `errorBody` is gone (the health server uses `apiErrorBody`). `loginUri` is now used for `initiate_login_uri`. |
| B-T3a-03 | **Resolved** | `platform/error-mapping.ts` has no `escapeHtml`. Platform messages in JSON are only cut and cleaned. |

## Lead's focus questions

- **Readability of the registration flow:** Good.
  - The header of `http/routes/registration.ts` lists the three endpoints.
  - `GET /lti/register/:account` reads top to bottom: account, query (zod), `fetchConfiguration`, `readToken` (verified with the platform JWKS), session, `registration_started`, 303 to the app with `registrationId` and the pass-through parameters only.
  - `complete` reads top to bottom too: body (zod), session, status, update rule (security §2.5, before anything goes to Moodle), atomic `claimRegistrationSession`, request, POST, parse, create or update, `completeRegistrationSession`, `registration_completed`. On any error it calls `releaseRegistrationSession` (the admin can try again).
  - The rules are pure functions in `lti/registration.ts` (`parseOpenIdConfiguration`, `operationFromToken`, `buildRegistrationRequest`, `parseRegistrationResponse`, `registrationView`), each with its security or ADR reference.
- **Error pages for the Moodle admin:** The pages use their own heading ("The registration did not work") and show one action line, the code and the trace id. Three new codes (`INVALID_OPENID_CONFIGURATION`, `ISSUER_MISMATCH`, `FETCH_FAILED`) have registration-specific actions. Some reused codes still speak to a launch user (B-T3b-01).
- **Migration 003:** Clear. The header states its purpose, the expiry and the 24 h retention, and that the token is encrypted. CHECK constraints guard `operation` and `status` (`open`, `completing`, `completed`), and there is an index on `created_at` for the cleanup.
- **Tests for the update and new paths:**
  - `http/routes/registration.test.ts` covers: new (303 with `registrationId` and `ref` only, GET view, complete, second complete → 409); update allowed only with `updatePlatformId = existingPlatformId`, with refused updates sending nothing to Moodle (`registration_rejected` counted); an update of a tool this account does not have; error pages (unknown account, private IP, http, issuer mismatch, frameable by https origins); bad, expired or wrong-scope token; platform refusal → 502, then a later retry works; session expiry.
  - `lti/registration.test.ts` covers the configuration rules, operation detection, the request for each privacy level, and the answer parsing.
  - One branch has no test (B-T3b-02).
- **Routes README:** Short, correct and useful. It is the first thing a developer needs ("where does my route go?").

---

## Findings

### B-T3b-01 — MINOR — Some registration error pages tell the Moodle admin to "ask your Moodle admin"

- **Location:** `services/lti-service/src/http/routes/registration.ts` (`page(code, detail)` passes only `heading`); `src/lti/codes.ts` `PROTOCOL_ERRORS` actions of `UNKNOWN_TOOL_ACCOUNT`, `INVALID_REQUEST`, `FETCH_FAILED`.
- **Problem:** The registration frame is seen by the Moodle admin who pasted the registration URL, but some pages reuse the action text written for a learner or teacher launch. So the one next action does not fit the reader.
- **Evidence:**
  - `UNKNOWN_TOOL_ACCOUNT` (a wrong or old registration URL) shows "Ask your Moodle admin to check the tool settings." The reader is that admin, and the problem is the URL from Cogniate.
  - `INVALID_REQUEST` shows the generic "Start again from Moodle. If it happens again, give the trace id to your Cogniate admin."
  - `FETCH_FAILED` shows "Check that the Moodle site can be reached". It does not say that *Cogniate* must reach the site from the internet over https on port 443, which is the usual cause for a private or VPN-only Moodle.
- **Suggested fix:** Add a small registration action map (like `COOKIE_HELP`), and pass it as `help` with the registration heading. Examples:
  - `UNKNOWN_TOOL_ACCOUNT` → "This registration URL is not valid. Copy it again in Cogniate (Integrations > Moodle > Connect) and paste it in Moodle (Manage tools > Add LTI Advantage)."
  - `FETCH_FAILED` → "Cogniate cannot reach this Moodle site. The site must be reachable from the internet over https (port 443). Check the firewall, then start the registration again."
  - `INVALID_REQUEST` → "Start the registration again from Moodle (Manage tools)."

### B-T3b-02 — MINOR — A "new" registration that finds an existing platform updates it, without a test, a comment or a correct log

- **Location:** `services/lti-service/src/http/routes/registration.ts` lines 201–205 (`catch (err) { if (!(err instanceof PlatformExistsError)) throw err; … applyRegistrationUpdate(…same.id…) }`) and line 209 (`registration_completed {operation: session.operation}`).
- **Problem:** When Moodle answers a *new* registration with an issuer and client id that this account already has, the code quietly changes that existing platform: name, endpoints, active flag, deployment. The log then says `operation: "new"`.
- **Evidence:**
  - No test in `registration.test.ts` reaches this branch. A search for `PlatformExists`, "same client" or "exists" finds only the `REGISTRATION_ALREADY_COMPLETED` and update-path tests.
  - The branch changes data, so a reader needs to know *when* Moodle does this and *why* an update is right.
- **Suggested fix:**
  1. Add a one-line comment with the reason (the case and the security §2.5 rule that allows it).
  2. Add one route test: an existing platform, then a new registration with the same client id → the same platform id, with updated values.
  3. Log what happened, for example `registration_completed {operation: "new", matched_existing: true}`, and add the field to contract §5.

### B-T3b-03 — NIT — Small consistency rests

- **Location and fix:**
  - `http/routes/services.ts` still parses queries with hand-written `optText` and `optLimit`, while `registration.ts` and `platforms.ts` use zod. This is the rest of B-T3a-01: one zod schema per query.
  - `http/routes/registration.ts` line 23 imports `invalid` from `./platforms.ts`, so one route file depends on another. Move `invalid()` to a small shared helper (for example `http/validation.ts`).
  - `registration_rejected` logs `{code, detail}` on the page side but only `{code}` on the API side. Use the same fields, and include `detail` (a safe reason) on both.
