Verdict: APPROVE
Round: 1

# T4b2 review — Reviewer-B (lens: "Can a human team own it?")

Scope: `git diff cded5ea 4c6a04d -- . ':!docs' ':!tests'` (24 files). Spec: `tasks/T4b2.md`, app contract §5, §6, §12, security §4, §5, §6, §7, data-model §2.

| Check | Result |
| --- | --- |
| `npm run check` (HEAD contains `4c6a04d`) | Pass: 34 test files, 478 tests (the Lead's clean worktree: 473) |

| Severity | Count | Ids |
| --- | --- | --- |
| BLOCKER | 0 | — |
| MAJOR | 0 | — |
| MINOR | 2 | B-T4b2-01, B-T4b2-02 |
| NIT | 1 | B-T4b2-03 |

## Lead's focus questions

- **Can a developer follow a teacher's pick and a learner's launch?** Yes. Each file starts with a header that states the flow and its contract and security sections.
  - **Teacher:**
    - `GET /tool/deep-link` (`tool-pages/launch.ts`): single use → `GET /api/idtoken` → message type → role → connection → picker session (ltik encrypted) → 303.
    - `GET /tool/picker/:id` (`tool-pages/picker.ts`): a radio list of this connection's available publications.
    - `POST`: picker open → `Origin` → publication again (security §4) → atomic `claimPicker` → `POST /api/deeplinking` with exactly one content item → auto-submit to Moodle. On a failure it calls `releasePicker`, so the teacher can try again.
  - **Learner:** `GET /tool/launch`: single use → ID token → resource-link launch → `platform.id` → connection → publication **from the signed target only** (`publicationFromTarget`) → one transaction (resource link upsert with rebind, attempt, play session, `markLaunched`) → `launch_accepted` → 303 to `/play/{id}` or `/play/{id}/embedded`.
  - Both handoffs share `handoff()` (steps 1 and 2).
- **One place for launch rules?** Mostly: the pure rules are in `tool-pages/launch-rules.ts`, and each has a unit test. But the attempt rule and the attempt model sit in `domain/launch.ts`, outside the content-host fence (B-T4b2-02).
- **Error pages for teachers and learners:** Good.
  - There is one table for each page group: `LAUNCH_ERRORS` (status, heading, action) and `PICKER_ERRORS`. Each page shows a code, a trace id and one `data-error-action` sentence, in STE and for the right reader. Examples: learner "Ask your teacher to select the course again in the activity settings."; teacher "Only a teacher can select a Cogniate course. Ask a teacher of this Moodle course."; "This course list expired. In Moodle, use Select content again.".
  - The empty picker says what to do: "Publish a course in Cogniate, then use Select content again."
  - One action is misleading, and some paths log no event (B-T4b2-01).
- **Test quality (`tool-pages/launch.test.ts`):** Good.
  - Every test is named by its AC (AC-T4-15 to -32), plus the pure rules (role, signed target, "Back to Moodle", attempt choice after a rebind, header builder).
  - The tests check the important negatives: the app `resource` query is ignored (AC-T4-23); single use (AC-T4-24); no Deep Linking call for a foreign or withdrawn publication (AC-T4-26) or a bad `Origin` (AC-T4-22); TTL knobs; escaping (AC-T4-28).
  - AC-T4-32 checks four events, not every error code (B-T4b2-01).
- **Naming:** Clear. `useHandoff`, `claimPicker` / `releasePicker`, `publicationOfConnection`, `upsertResourceLink` (with `rebound`), `chooseAttempt`, `runtimeTokenFor`, `handoffRedirectHeaders`. Migration 004 is commented column by column (handoff, resource link, picker, attempt, play session).
- **Seed script (`npm run seed:lti-activity`):** Good UX. It has `--help` (taken from its header), a check for each argument with an example in the message ("--course must be a course short name, for example COGNIATE-DEV-101"), idempotency by activity name, values passed to PHP as separate arguments, and one JSON output line.

---

## Findings

### B-T4b2-01 — MINOR — Some tool-page errors log no rejection event, and one shows a misleading action

- **Location:**
  - `services/cogniate-app/src/tool-pages/launch.ts` `handoff()`: `if (err instanceof LtiServiceError) return { sent: page(req, reply, 'LTI_SERVICE_ERROR') }` with no log.
  - `tool-pages/picker.ts`: `fail(…, 'PICKER_NOT_FOUND')`, the Deep Linking failure `fail(…, 'LTI_SERVICE_ERROR')`, and the return-origin mismatch `fail(…, 'LTI_SERVICE_ERROR')`. All three pass no `reason`, so no `picker_rejected`.
  - `tool-pages/launch.test.ts` AC-T4-32 test.
- **Problem:**
  - On these paths the app log has only the `http_request` line (status 502 or 404). No event says why, and the LTI service's status and code are not logged. `register.ts` already logs `ltiErrorFields(err)` since B-T4b1-01, so the tool pages now behave in two ways.
  - A Deep Linking answer whose return URL is not on the Moodle origin shows "Cogniate cannot reach its LTI service now. Try again in a minute.". That is wrong: a retry will not help.
- **Evidence:**
  - The AC-T4-32 test has four cases (`launch_rejected`, `handoff_rejected`, `picker_rejected`, `deep_link_rejected`). It covers none of the paths above, so its title ("every tool page error … the trace id is in its log event") claims more than it proves.
  - Strictly, AC-T4-32 asks for a matching event for *every* tool page error. QA or Reviewer-A may read this as an AC gap.
- **Suggested fix:**
  1. Log the event on each path, with `...ltiErrorFields(err)` where an `LtiServiceError` exists: `launch_rejected {reason: "lti_service_error"}`, `deep_link_rejected {reason: "lti_service_error"}`, `picker_rejected {reason: "lti_service_error" | "return_url_mismatch" | "not_found"}`. Add the reasons to app contract §12.
  2. Give the return-origin case its own code, for example `RETURN_URL_MISMATCH`, with the action "In Moodle, use Select content again. If it happens again, give the trace id to your Moodle administrator."
  3. Make AC-T4-32 table-driven: for every code of `LAUNCH_ERRORS` and `PICKER_ERRORS` (and the play page), one page with `data-error-action` and exactly one event with its trace id.

### B-T4b2-02 — MINOR — The attempt model and rule are outside the content-host fence, and the pure launch rules are in two folders

- **Location:** `services/cogniate-app/src/domain/launch.ts` (`Outcome`, `Attempt`, `continuesNewest`, `chooseAttempt`, attempt queries, next to handoff, resource link and play session code); `src/tool-pages/launch-rules.ts` (`hasStaffRole`, `publicationFromTarget`, `safeReturnUrl`, `httpsOrigin`, `runtimeTokenFor`); `eslint.config.js` line 44 (content-host may import only `../domain/attempts*`).
- **Problem:**
  - T5a's content host must read and update attempts (commit → outcome → score sync). The fence allows `domain/attempts*` only, so the code T5a needs is in a module that content-host may not import. T5a will have to move it under time pressure, or someone will widen the fence.
  - Separately, a reader looks for "launch rules" in two places: pure rules in `tool-pages/` (but `hasStaffRole` is a domain rule that the picker and the preview flag also use), and the attempt rule in `domain/`.
- **Evidence:**
  - `continuesNewest` is a pure rule (data-model §2), but it lives in the database module.
  - `play.ts` imports `Outcome` from `domain/launch.ts`.
- **Suggested fix (now, before T5a):**
  1. Make `domain/attempts.ts` with `Outcome`, `Attempt`, `continuesNewest`, `chooseAttempt` and the attempt queries. Keep `domain/launch.ts` for the handoff, resource links, play sessions and stats.
  2. Move `tool-pages/launch-rules.ts` to `domain/launch-rules.ts`, so all pure launch rules have one home that both tool pages and domain code may import.

### B-T4b2-03 — NIT — One reused code hides the real reason

- **Location:** `services/cogniate-app/src/tool-pages/launch.ts` line 100 (`if (token.launch.type !== 'LtiResourceLinkRequest' || !resourceLink || !context) return reject('INVALID_LTIK', 'invalid_ltik')`).
- **Problem:** A valid deep-linking ltik on `/tool/launch` (or a launch without a resource link or context) is logged and shown as `INVALID_LTIK` / `invalid_ltik`, the same as a forged or expired ltik. A developer cannot tell a routing mistake from a bad token.
- **Suggested fix:** Use its own reason, for example `launch_rejected {reason: "not_resource_link"}` (contract §12). Keep the page text "Open the activity again in Moodle".
