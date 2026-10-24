Verdict: CHANGES_REQUESTED
Round: 1

# LA-E5-13 — Reviewer-B

## Round 1

Reviewed 2026-10-24 at `4e6a41f3`, against the task spec, LA-ADR-07 D1 and the app/LTI API contracts. **0 BLOCKER; 2 MAJOR; 0 MINOR or NIT.** Findings concern QA coverage and false-green oracles, not demonstrated production tenancy defects.

### B-LA-E5-13-01 — MAJOR — Brightspace is silently omitted from the reported route matrix

**Location:** `tests/ltiaas/tasks-qa/LA-E5-13/two-tenant-isolation.k1sim.test.ts:183` and `:222`; `docs/reviews/LA-E5-13/qa.md:23`.

**Problem:** Fixture discovery reads `json.providers`, while the public response contains `json.lms`, so the Brightspace connection and its route probes never run.

**Evidence:** The saved candidate G1 `acceptance.lmsProviders` has a `lms` array containing Brightspace. Feeding that actual response into the suite's unchanged setup and AC-01 callback creates only the two generic pending fixtures, checks 61 matrix routes, and makes zero Brightspace requests. A mock server that would leak Brightspace data with HTTP 200 still passes; changing only the envelope reader to include `.lms` makes the same leak fail and creates the missing 13 matrix rows. The original test correctly rejects an HTTP 200 leak on a covered Blackboard route. Thus the report's Brightspace PASS claim is not supported by its runner PASS.

**Suggested fix:** Read the contracted response field, assert the expected built channel/fixture is present, and record the exercised channel/method ids so an empty list cannot silently remove coverage. Add a host regression for this response envelope, then run the corrected matrix and update QA evidence.

### B-LA-E5-13-02 — MAJOR — “Unchanged” does not compare the victim's state

**Location:** `tests/ltiaas/tasks-qa/LA-E5-13/two-tenant-isolation.k1sim.test.ts:337`.

**Problem:** The post-check only requires connection HTTP 200 and status other than `disabled`, or publication status `available`; changes to the victim's stored fields can pass.

**Evidence:** In the host oracle probe, A's requests all return the required 404 and emit no outbound event, but B's existing Blackboard connection changes from `registered` to `pending` and its `siteUrl` changes. AC-01 still passes. The task's pass rule is no changed row as observed through the public API, and QA expressly claims unchanged library B state. A future cross-tenant write followed by an error response would escape this check.

**Suggested fix:** Capture B's connection/publication DTOs before the foreign calls and compare their relevant persisted fields afterward (including binding/configuration, state and activity counts). Keep the outbound checks. Include a negative control that changes a protected B field while returning 404.

### Acceptance and raw accounting

| AC | Review result |
| --- | --- |
| 01 | Refusal and zero-outbound assertions are present; two coverage/oracle gaps above. |
| 02 | Single/multi-select refusal, atomic activity-count checks, foreign-origin cancel and B's surviving picker control are asserted; raw case PASS. |
| 03 | Correct-origin foreign-account check must return the exact storage detail without redirect, then the same token must redeem on its owner; raw case PASS. |
| 05 | Foreign platform/scoped revocation, no leaked platform id and successful score submission before/after are checked; raw case PASS. Tenant audit/account reads are explicitly unbuilt, rather than credited as existing endpoint coverage. |
| 06 | The old SIM summary has `SUITE`, `AC-T2-18` and `AC-LA-E5-13-06` FAIL because its seed lacks `ltiSeed`; it is not a clean suite PASS. The later, separately cited frozen live cases do pass: T2-18, T4-16/29/34 and T7-08/09. That later evidence supports the current row. |

Raw paths read, under `/Users/quangnguyen/cogniate-qa-runs/LA/`:

- `LA-E5-13/r2/qalead-la-9-e513.log` and `qalead-la-9-e513-r2.log`.
- `LA-E5-13/r2/runner/tests/host/artifacts/qalead-la-9-fd146062-2026-10-23T15-07-00-088Z/summary.json` (14 PASS / 3 FAIL entries, with duplicated case accounting; the four relevant distinct cases pass).
- `SLOT8/artifacts/qalead-la-31-8fadb828-2026-10-23T21-38-23-889Z/summary.json` and `qalead-la-33-8fadb828-2026-10-23T21-49-06-848Z/summary.json`.
- `SLOT3F/artifacts/qalead-la-66-a8bbac53-2026-10-24T05-56-45-538Z/summary.json` and `run1/tests.json` (B4/B5/B6 PASS; demo SKIP retained).
- `LA-E7-08/slot3b-80133d6b/golden-capture-80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5-port9443/G1.json` for the real provider-response envelope.

Host checks in fresh private clone `/private/tmp/la-closeout-review-b-_nb5xdcj/repo`, own dependencies and cleared Vitest cache: **K0 3/3 PASS**. The reviewer probe executes the source's actual setup and AC-01 callbacks with mock HTTP responses and normal assertions; it is an oracle test, not a live service test. Its valid control passes, covered-route leak fails, omitted-Brightspace leak and changed-B-state cases pass incorrectly, and the envelope-only fix rejects the Brightspace leak. Artifacts: `/private/tmp/la-closeout-review-b-_nb5xdcj/isolation-k0.log`, `isolation-oracle-probe.cjs`, `isolation-oracle-probe.json`, `isolation-oracle-probe.log`. No Docker/stack, product edits or commits; no Reviewer-A report read.
