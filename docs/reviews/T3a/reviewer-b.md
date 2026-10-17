Verdict: APPROVE
Round: 1

# T3a review — Reviewer-B (lens: "Can a human team own it?")

Scope: `git diff b99b87e a0a753d -- . ':!docs' ':!tests'` (62 files). Spec: `tasks/T3a.md`, LTI contract §1.3, §3.2–§3.6, §4, ADR-008.

| Check | Result |
| --- | --- |
| `npm run check` (HEAD `7226b5c`, contains `a0a753d`) | Pass: 30 test files, 387 tests |
| Dead-export scan (exported names with no user outside their own file, tests included as users) | 31 names. Almost all are constants or helpers that their own file uses (fine). Real leftovers: B-T3a-02. |

| Severity | Count | Ids |
| --- | --- | --- |
| BLOCKER | 0 | — |
| MAJOR | 0 | — |
| MINOR | 1 | B-T3a-01 |
| NIT | 2 | B-T3a-02, B-T3a-03 |

## My carried items

| Id | Status | Evidence |
| --- | --- | --- |
| B-T2a-01 (split `http/app.ts`) | **Resolved**, follow-up B-T3a-01 | `http/app.ts` is setup only (100 lines: hooks, error handler, health, `RouteContext`), and its header names the groups. Routes are in `http/routes/{protocol,idtoken,services,platforms}.ts`. `lti/platform-rules.ts` (`checkPlatformUrls`, unit-tested) and `store/tool-keys.ts` exist. |
| B-T2b-02 (generic shared errors) | **Resolved** | `@cogniate/shared` has `defineErrorTable`, `ApiErrorBase` (with `details` for extra fields) and `apiErrorBody`. lti-service has `src/api-errors.ts` (`API_ERRORS`, contract §1.3), and cogniate-app has `src/app/errors.ts` (`APP_API_ERRORS`). `REJECT_INFO` moved to `cogniate-app/src/app/reject-info.ts` with a "every code has an entry" test. |
| B-T4a-01 (one copy of infra code) | **Resolved** | lti-service `crypto.ts` keeps only `newApiKey` and imports the rest from shared. cogniate-app `domain/db.ts` calls `openSqlite` and re-exports `transaction` and `MigrationChangedError`. `readCookie` comes from shared in `session.ts`. |
| B-T2b-01 (profile export) | **Resolved** | `lib.sh` keeps the effective profile in `ACTIVE_STACK_PROFILE` and never sets `STACK_PROFILE`. `demo.sh` runs `STACK_PROFILE=default stack-up.sh`. The hint says "run 'unset STACK_PROFILE' first" when the shell has it. |

## Lead's focus questions

- **Is the new layout easy to navigate?** Yes, mostly.
  - One route group is one file. Each route file starts with the contract sections it serves.
  - `lti/` holds protocol logic (`deep-linking.ts`, `service-url.ts`, `tool-jwt.ts`, `platform-rules.ts`), `platform/` holds outbound clients, and `store/` holds repositories.
  - The file does not say where T3b and T3c routes go, and one route group uses another convention (B-T3a-01).
- **Are the `platform/` modules readable and tested?** Yes.
  - `ags.ts` states the order of every call in its header: URL rule, then scope, then token, then one request.
  - `token-client.ts` caches in memory per (platform, scope set) until 60 s before expiry, shares parallel calls, and logs `platform_token {cache}`.
  - `score-clock.ts` (1 s apart, floor = start + 2 s) and `errors.ts` (409 → `PLATFORM_CONFLICT`, 400/404 → `PLATFORM_REJECTED_REQUEST`, timeout → `PLATFORM_TIMEOUT`) are small and commented.
  - `platform.test.ts` tests each rule, including "a foreign line item URL … with NO outbound request (not even a token)" and "parallel callers share one token request".
  - `service-url.test.ts`, `service-keys.test.ts` and `deep-linking.test.ts` (fake clock: `exp − iat = 330`) are table-driven and clear.
- **Are the two services consistent after the shared-module move?** Yes for the mechanisms: the same error base and body, the same migration runner, crypto and cookie reader, and the same trace-id and `http_request` hooks. The file names still differ (B-T3a-02).
- **Dead code left by the refactor:** a few small leftovers (B-T3a-02).

---

## Findings

### B-T3a-01 — MINOR — The route groups do not share one convention, and the file does not say where T3b and T3c routes go

- **Location:** `services/lti-service/src/http/app.ts` line 97 (`registerServiceRoutes(app, { db, urls, masterKey, ags, now, authenticate })`); `http/routes/services.ts` (`ServiceRoutesDeps`, `serviceKeyForLaunch`, hand-written `optText` and `optLimit`, `traceOf` cast); `http/routes/idtoken.ts` (`import { serviceKeyForLaunch } from './services.ts'`); `http/routes/platforms.ts` (zod schemas).
- **Problem:** A developer who adds a route finds two patterns.
  - Three groups take `RouteContext`. `services.ts` takes its own `ServiceRoutesDeps`, with a separate `authenticate` and a cast to read `traceId`.
  - Domain logic (`serviceKeyForLaunch`) lives in a route file, and another route file imports it.
  - Query validation is hand-written in `services.ts` but uses zod in `platforms.ts`.
- **Evidence:**
  - The header of `app.ts` lists the four groups, but not the homes of T3b (registrations, `/lti/register/:account`) and T3c (`/api/deeplinking/form`, line item writes, memberships, OAuth stubs).
  - `services.ts` will roughly double in T3c.
- **Suggested fix:**
  1. All groups take `RouteContext`. A test can build one with the testkit.
  2. Move `serviceKeyForLaunch` to `store/service-keys.ts` (or `lti/service-keys.ts`).
  3. Use zod for query and body parsing in `services.ts`, as `platforms.ts` does.
  4. Name the future homes in the `app.ts` header: T3b → `routes/registrations.ts` (and `/lti/register` in `protocol.ts`); T3c → split `services.ts` into `routes/deep-linking.ts`, `routes/line-items.ts` and `routes/memberships.ts`.

### B-T3a-02 — NIT — Small leftovers and naming after the refactor

- **Location and fix:**
  - `services/lti-service/src/platform/errors.ts` line 7 has its own `escapeHtml`, but `http/errors.ts` already exports one. Import it.
  - `packages/shared/src/http.ts` still has `errorBody` and `ErrorBody` (used only by the T1 `createHealthServer`), next to the new `apiErrorBody` and `ApiErrorBody` in `errors.ts`. Let the health server use `apiErrorBody`, and delete the old helper and type.
  - `services/lti-service/src/lti/target.ts` `loginUri` has no user yet. Keep it only if T3b uses it in the registration request (`initiate_login_uri`). Otherwise delete it.
  - File names for the same job differ: lti-service `src/api-errors.ts` vs cogniate-app `src/app/errors.ts` (the API code table). lti-service also has `http/errors.ts` (HTML error pages) and `platform/errors.ts` (platform → API mapping). Suggested names: `api-errors.ts` in both services, `http/error-page.ts`, `platform/error-mapping.ts`.

### B-T3a-03 — NIT — Platform messages are HTML-escaped inside JSON descriptions

- **Location:** `services/lti-service/src/platform/errors.ts` `shortPlatformMessage` (it returns `escapeHtml(text)`), used in the `PLATFORM_REJECTED_REQUEST` description.
- **Problem:** A JSON description is data, not HTML. The portal (React) escapes again when it renders, and the score sync stores the description as `lastError`, so a Moodle message such as "grade < 0" appears as `grade &lt; 0` to the user.
- **Suggested fix:** In JSON, keep only the control-character removal and the 200-character cut, and escape at render time (React does this already). Change the "short, escaped platform message" test to match.
