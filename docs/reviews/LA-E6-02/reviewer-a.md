Verdict: APPROVE
Round: 1

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
