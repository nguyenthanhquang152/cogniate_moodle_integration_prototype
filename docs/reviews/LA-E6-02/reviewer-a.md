Verdict: CHANGES_REQUESTED
Round: 3

## Round 1

Reviewer: Codex GPT-6-Astra xhigh, lens A. Reviewed `1a12864a`, `4d3f95da`, `16385c3d`, `d3bd5bf3`, `abbbfb3c`, `2df3212f`, `42a33fcd` and `1af1bfe8`, as merged in **`195930c1`**, against LA-E6-02, LA-ADR-08 D5 / BD-A2-100, app API delta §3.7, data model §5a and plan §6.1. Blind review; no Reviewer-B file read.

**0 BLOCKER, 0 MAJOR, 2 MINOR, 0 NIT.** The two MINORs are safe to defer and should be tracked under the charter's deferred-findings rule.

### Findings

**A-LA-E6-02-01 (MINOR): the unexpected-answer guard accepts malformed nested values that crash the panel.**

- Where: `apps/portal/src/connect/ConnectionHealth.tsx:29-31,72`.
- Problem: `isHealth` checks only that `dispatch` and `keys` are objects and `events` is an array, then treats the full answer as validated.
- Evidence: a private Testing Library probe supplies otherwise usable dispatch/key fields with `events: [null]`. The guard accepts it, rendering throws on `event.at`, and the parent error boundary takes over instead of showing “The connection health is not available.” This is a malformed-response robustness gap in `1af1bfe8`; the current server's normal response does not produce it.
- Suggested fix: validate the nested fields consumed by rendering, including each event and React child value, before accepting the answer. Add a malformed nested-answer case that expects the existing unavailable state.

**A-LA-E6-02-02 (MINOR): the retention test does not independently pin the required 30 days.**

- Where: `services/cogniate-app/src/domain/connection-events.test.ts:55-69`.
- Problem: the test derives both its old and boundary timestamps from the production `CONNECTION_EVENT_TTL_MS` constant.
- Evidence: changing production retention from 30 to 31 days leaves all five committed connection-event tests green. An independent private probe using a literal 30-day boundary passes on the reviewed code and fails on that mutant. Production currently implements the correct 30-day policy.
- Suggested fix: construct the boundary from the specification's 30 days, or explicitly assert the constant equals `30 * 86_400_000`; retain checks immediately before and exactly at that boundary and through the retention job.

### Correctness and scope

The route checks `getConnection(db, library.id, id)` before the JWKS read and returns 404 for another library. Event reads include both library and connection ids; dispatch queries are constrained to that already-authorized connection's placements. The answer omits stored trace ids and reporter descriptions. The current LTI check path converts upstream failures to short detail codes before the writer stores them. No new LMS-specific branch or public secret field was found.

Insert and 100-row trimming share one transaction. A private trigger-induced trim failure rolls the insert back and preserves all original 100 rows. The retention job deletes expired events; exact 30-day boundary behavior is correct. The migration test applies 016 after all other migrations, including 017 and 018, preserves every old connection field, and initializes `artifact_key_kid` to NULL.

The key-state null/true/false rules, `nextKid: null`, newest-first event projection, dispatch counts and code parsing match BD-A2-100. The public tool-key read is cached for 60 seconds; health makes no LMS request. Both warnings and the collapsed section are covered by portal tests, without `role="alert"`. The named RQ-2 changes stay within their granted mount, retention and test-adjustment scope; no frozen assertion file changed.

### Verification and remaining gates

Fresh private clone `/tmp/la-review-a-2ff3c9eff814`, detached at `195930c1`, own install; `node_modules/.vitest-cache` cleared before every Vitest run. **55/55 focused tests** pass across health, events, check, domain migration, retention, audit and the portal panel. **4/4 private probes** confirm rollback, output projection/library filtering, the malformed-response finding and the independent retention boundary. Mutation checks fail as expected for an incorrect row cap, omitted artifact column, reversed stale-key warning and removed backlog warning; the 31-day mutant survives the committed test and fails the independent probe. All private source mutations were restored.

UNIT AC-06/07/08 have focused tests; the independent policy assertion above would strengthen AC-06. AC-01 remains pending LA-E6-06, and AC-02/03 remain pending LA-E6-05. K1-SIM ACs and M2/T6 regression remain QA gates; host tests are not live-stack evidence. Disconnect/suspend writers are explicitly deferred by BD-A2-100.

No Docker, stack or host stack runner was used. Only this review file was changed in integration; no commit was made.

## Round 2

Reviewed `f9e7961b`, merged as **`52a89e2d`**, against the same task and BD-A2-100 rules. **APPROVE: 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT open in lens A.** Both round-1 findings are closed; no new finding.

- **A-LA-E6-02-01 closed:** the guard checks the nested fields used by rendering, rejects null events and object-valued React children, and sends malformed answers to the existing unavailable state. Eleven malformed-answer cases and the complete-answer control pass. Restoring the old shallow guard makes all eleven malformed-answer cases fail.
- **A-LA-E6-02-02 closed:** the tests independently pin 100 rows and 30 days, use literal policy boundaries, and retain direct and job-driven expiration checks. The previously surviving 31-day mutant now fails the committed test.

The backlog help uses the same capability/status condition as `ConnectionCheck`; it names only the displayed connection name and available grade-error code/time, with no trace-id instruction. The added real-route inline export test checks current, stale and cleared artifact-key states after the LA-E6-05 writer landed. These are host checks; live signing-key activation and the remaining K1-SIM/regression gates stay with QA.

Verification: fresh private clone `/tmp/la-review-a-068ab3a02a44` at `52a89e2d`, own install, Vitest cache cleared before every run. **39/39 tests pass** across the three changed test files; both targeted mutants fail for the intended assertions, and private source changes were restored. The four-file diff respects ownership, adds no LMS-specific core branch and changes no frozen assertion. No Docker, stack, other reviewer's file or commit; only this review file changed in integration.

## Round 3

Reviewer: Codex GPT-6-Astra xhigh, lens "Is it right and is it safe?" Date: 2026-10-23. Reviewed `ea47dc56` (merge `e40a6d41`), the earlier lens-A rounds, task spec, LA-ADR-08 D5, BD-A2-101 and the new BD-A2-102 ruling. **CHANGES_REQUESTED: 1 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT open.** The coordinator's 12:32Z follow-up requested this review of the dispatched commit; the next fix is not included.

### A-LA-E6-02-03 — BLOCKER — Opening or switching Key JSON records an artifact that the user has not taken

**File:** `packages/channels/canvas/portal/CanvasKeyJson.tsx:14` (mounts the fetching effect in `CanvasConfiguration.tsx:17`).

**Problem:** opening the section immediately exports the default key URL form, and changing the checkbox exports the selected form. This changes the recorded artifact key before either Copy JSON or Download JSON is selected, hiding a real stale-key condition on the next health read. BD-A2-102 explicitly rejects this behavior.

**Evidence:** three private component probes each expect no export and fail with one request: opening calls `/app-api/connections/con_canvas/canvas-configuration`; selecting inline calls the same path with `?jwk=inline`; switching back calls the URL form. None clicks Copy or Download. The passing real-route health test independently confirms that a URL export changes a stale `artifactKeyKid` to `null` and `artifactKeyCurrent` from `false` to `null`. The extension handler records the response's key at `services/cogniate-app/src/kernel/extensions.ts:111`; the health warning appears only on `false`. The committed panel test currently expects the premature request, so it does not protect the new requirement.

**Suggested fix:** implement BD-A2-102 in the registered/connected panel: opening and mode selection make no export request; only Copy or Download fetches the selected artifact and uses that response. Add regressions for both non-export actions and both explicit export actions. Keep the pending wizard unchanged. The remaining distinction between an artifact taken and an artifact pasted into the LMS is the documented design limit.

### Other results and verification

- Registered and connected status handling, and hiding the warning on pending/disabled connections, match BD-A2-102. The new help text matches BD-A2-101. Both Round 1 findings remain closed.
- The six-file diff stays in P's portal ownership. No forbidden route, API, frozen assertion or LMS-specific core branch changed. The closed panel adds no Copy/Download controls; manual-flow DOM hashes pass. M2/T6 selector inspection finds no collision; live regression remains QA work.
- Fresh private clone `/tmp/la-reviewer-a-ctx-0594e86b4a7b`, pinned to `95bde90b43078d2e204bbb35f3336a8b87cf38f7`, own `npm ci`, Vitest cache cleared before every run: **113/113 public tests pass** across Canvas, shell, health, events and migration (UNIT AC-06/07/08). All **3 private probes fail** for A-LA-E6-02-03.
- Removing the panel fails **3** committed tests; removing the active-status warning guard fails **1**. Restored portal tests: **92/92**. Portal and channel-portal typechecks, targeted lint, F1 (**0 hits**) and F5 (**6 rules, 0 hits**) pass.

Private probes are saved under `/tmp/la-reviewer-a-ctx-0594e86b4a7b-probes`; logs use the same prefix. Mutations were restored and probes removed from the clone. I changed only this review file in integration; no Docker, stack, commit or other reviewer's file was used. The explicit-export fix and Round 4 verification remain required; K1-SIM and live regression remain QA work.
