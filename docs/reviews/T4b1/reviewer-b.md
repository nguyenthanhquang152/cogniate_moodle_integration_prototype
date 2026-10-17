Verdict: APPROVE
Round: 1

# T4b1 review — Reviewer-B (lens: "Can a human team own it?")

Scope: `git diff 6f03a80 1ec7cde -- . ':!docs' ':!tests'` (29 files). Spec: `tasks/T4b1.md`, app contract §4–§6 and §12, security §2.5, §5, §6, ADR-008, ADR-009.

| Check | Result |
| --- | --- |
| `npm run check` (HEAD `692b34b`, contains `1ec7cde`) | Pass: 33 test files, 444 tests (the Lead's clean worktree: 439) |

| Severity | Count | Ids |
| --- | --- | --- |
| BLOCKER | 0 | — |
| MAJOR | 0 | — |
| MINOR | 1 | B-T4b1-01 |
| NIT | 1 | B-T4b1-02 |

## My T3b items

| Id | Status | Evidence |
| --- | --- | --- |
| B-T3b-01 | **Resolved** | lti-service `REGISTRATION_HELP` has admin texts for `UNKNOWN_TOOL_ACCOUNT` (copy the URL again in Cogniate, then paste it in Manage tools), `INVALID_REQUEST`, `FETCH_FAILED` ("reachable from the internet over https (port 443). Check the firewall …"), `INVALID_OPENID_CONFIGURATION` and `ISSUER_MISMATCH`. The page passes it as `help` with the registration heading. |
| B-T3b-02 | **Resolved** | A "new" registration that returns a known client id now logs `registration_completed {operation: "update"}`, with a test (`registration.test.ts`, +59 lines). |
| B-T3b-03 | **Resolved** | `http/validation.ts` (`invalid()`) is shared by the route groups. `services.ts` uses zod (`LineItemsQuery`, `ScoresQuery`). `registration_rejected` logs `{code, detail}` on both sides. |

## Lead's focus questions

- **cogniate-app layout vs ADR-008 and the import fence:**
  - The folders are `app/` (portal API: connections, publications), `domain/` (repositories: connections, publications; plus the LTI client), `tool-pages/` (`page.ts`, `register.ts`), `content-host/`, `cli/`. This matches ADR-008.
  - `content-host/` did not change, so the fence still holds (it was proven in T4a).
  - One naming point: the LTI client is an outbound client, not a repository (B-T4b1-02).
- **Tool page text for the Moodle admin:** Good.
  - `REGISTER_ERRORS` in `tool-pages/register.ts` is one table with a status and one action sentence for each code. The sentences are STE and speak to the admin: "This registration link expired. In Cogniate, open the connection and make a new registration URL."; "Go back in Moodle and choose Register as a new tool.".
  - The confirm page shows the site, the Moodle version, the library, the tool name and the privacy sentence, with one "Connect" button.
  - Two texts can be better (B-T4b1-01, B-T4b1-02).
- **Typed LTI client (`domain/lti-client.ts`):** Readable and safe. It reads the API key file at each use (with a clear `NO_API_KEY` message: "Run npm run seed"), sends `X-Trace-Id`, goes through the guarded outbound client, and turns every non-2xx into `LtiServiceError {status, code, description, reason}`. The method names match the contract endpoints.
- **Tests for connect and publish:** `app/connect.test.ts` has one test for each AC:
  - AC-T4-07, -08, -09, -10, -12/-14, -30, -33, -34;
  - an LTI service failure → `REGISTRATION_FAILED`, and the ref still works afterwards;
  - `MOODLE_TOOL_MAY_EXIST` with the clean-up text;
  - a platform that belongs to another connection → neither connection changes;
  - `PUT platform` only while pending;
  - the header builder and `isUpdateAllowed`.

  The test names say the rule.
- **Migration 002:** Clear. CHECK constraints guard `method`, `status` and publication `status`. `lti_platform_id UNIQUE` gives "a platform belongs to one connection only". `ref_token_hash UNIQUE` (single use) and the encrypted ref (to show the URL again) are commented. `UNIQUE (connection_id, course_id)` gives one publication for each connection and course.
- **How a developer sees the connection state when something fails:** Partly (B-T4b1-01).

---

## Findings

### B-T4b1-01 — MINOR — A failed connect leaves no cause in the app log or in the connection

- **Location:** `services/cogniate-app/src/tool-pages/register.ts` (`fail()` logs `registration_confirm_rejected {code}` only; the `catch` maps every `LtiServiceError` to `REGISTRATION_FAILED`); the Connection JSON (app contract §4, `connectionJson`); `REGISTER_ERRORS.REGISTRATION_FAILED` ("The connection failed. Go back to Moodle and try again.").
- **Problem:** When "Connect" fails, the admin sees "The connection failed", and the Cogniate user sees the connection still `pending`. The app log has only `code: REGISTRATION_FAILED`. The cause is lost on the app side, for example Moodle refused the registration (`PLATFORM_ERROR` with `domain_targetlinkuri_mismatch`), the LTI service timed out, or the API key was wrong.
- **Evidence:**
  - `LtiServiceError` carries `status`, `code` and `reason`, but `fail()` does not log them.
  - The connection row has no "last attempt" field.
  - A developer can find the cause only by taking the trace id from the admin's screenshot and searching `lti-service.jsonl` (the client does send `X-Trace-Id`, which is good).
- **Suggested fix:**
  1. Log a safe `detail` in `registration_confirm_rejected`, for example `lti_status=502 lti_code=PLATFORM_ERROR lti_reason=tool_may_exist` (codes only, never the description), and add the field to app contract §12.
  2. Store the last failed attempt on the connection (`last_error_code`, `last_error_at`, `last_trace_id`), and return it as `lastError` in the Connection JSON, so the T6 wizard can show "The last attempt failed at 10:42 (trace id …)".
  3. Give `REGISTRATION_FAILED` one more sentence: "If it fails again, give the trace id to your Cogniate contact."

### B-T4b1-02 — NIT — Small text, duplication and naming points

- **Location and fix:**
  - `tool-pages/register.ts` "done" page: `<h1>Done</h1><p>Done. Go back to Moodle and activate the tool.</p>` says "Done" twice and names only one of the three admin steps of ADR-009. Write `<h1>Connected</h1>` and "Go back to Moodle. In Manage tools, activate 'Cogniate (<library>)', then edit it: Default launch container = New window." The dialog closes at once, so this is low impact.
  - The "Moodle may have kept a Pending tool" clean-up text exists twice with different words: lti-service `TOOL_MAY_EXIST_TEXT` and cogniate-app `REGISTER_ERRORS.MOODLE_TOOL_MAY_EXIST`. The admin sees the app page, so keep that text as the source and make the LTI description match.
  - `escapeHtml` now has a copy in `services/lti-service/src/http/error-page.ts` and in `services/cogniate-app/src/tool-pages/page.ts`. Move it to the shared `server` module.
  - `domain/lti-client.ts` is a client of another service, not a repository. Use `src/clients/lti-client.ts`, or name "service clients" in the ADR-008 `domain/` row.
  - `createPlatform(body: Record<string, unknown>)` is the only untyped method, and the client casts each answer (`json as T`). A small zod parse of the fields that the app reads would catch contract drift between the two services early.
