Verdict: APPROVE
Round: 1

# LA-E5-13 — Reviewer-A

## Round 1

Reviewed 2026-10-24 against the task spec, LA-ADR-07 D1 and the route contracts. The route-level isolation evidence supports AC-01/02/03/05; the six frozen isolation ACs have later, separately identified live evidence. One non-blocking coverage claim needs correction.

### Finding

**A-LA-E5-13-01 — MINOR — The Brightspace fixture is silently omitted despite the QA claim.**

- **Location:** `tests/ltiaas/tasks-qa/LA-E5-13/two-tenant-isolation.k1sim.test.ts:183`; `docs/reviews/LA-E5-13/qa.md:22`, `:32`.
- **Problem/evidence:** Discovery reads an array or `.providers`, but `GET /app-api/lms-providers` returns `{lms: [...]}`. The same expression exists in the executed `clone-9` source. Applying it to the surviving candidate G1 provider DTO selects zero entries, although `.lms` has five. Brightspace's connection is never created. The test exercises four connection variants in three channels, not the claimed Brightspace/all-five coverage. Route-level ACs remain supported by the other fixtures; the spec does not demand a separate run of every route for every channel.
- **Suggested fix:** Read `.lms`, assert the required channel exists, and fail if its fixture is absent. Correct the QA coverage wording and identify the additional run when it is made. Lead should record this MINOR if deferred.

### Acceptance and result accounting

| AC | Assessment |
| --- | --- |
| 01 | PASS for the tested routes: foreign IDs get 404, app/LTI outbound events and sink/simulator calls remain empty, and B's connections/publications remain usable. Source assertions are substantive, not just status-title checks. Channel claim qualified above. |
| 02 | PASS: cross-library single and multi-pick refusals, foreign-origin cancellation refusal, unchanged activities, no return form/service calls, and B's successful subsequent pick. |
| 03 | PASS: wrong account with correct origin/value gives INVALID_STATE with the exact storage detail and no redirect; the same check then succeeds for its owner. |
| 05 | PASS for built routes: foreign platform revocation refused, own-account foreign scopes revoke zero keys, original account can still submit a score. Unbuilt tenant audit/account and cut health/verify routes remain named N/A; their 404s are not evidence of implemented routes. |
| 06 | PASS from the later frozen-suite records: AC-T2-18 and AC-T4-16/29/34 on `8fadb828`; AC-T7-08/09 on final `a8bbac53`. These are not a passing result for the earlier SIM surrogate. |

The saved `qalead-la-9` run has **4 passing / 1 failed** Vitest cases; `SUITE`, `AC-T2-18` and its AC-06 roll-up are FAIL. The failed surrogate reports `seed.json has no "ltiSeed"`. The current suite removed that live-Moodle seed dependency, but no rerun of that replacement is claimed here. Later frozen-suite passes supply AC-06 independently. No failed row is converted to PASS.

Host verification in the private clone: existing K0 **3/3 PASS**; an isolated harness executes the actual AC-03 callback with controlled responses, **4/4 PASS** (good control plus rejection of cross-account acceptance, wrong `storage_origin` reason and consumption of the owner's check). This demonstrates that the security assertions detect those wrong behaviours without network or stack access. K0's source-presence checks alone are not treated as live proof.

### Paths read

Repository: task `qa.md`; `tests/ltiaas/tasks-qa/LA-E5-13/{two-tenant-isolation.k0.test.ts,two-tenant-isolation.k1sim.test.ts,vitest.config.mts}`. Raw root `/Users/quangnguyen/cogniate-qa-runs/LA/`:

- `LA-E5-13/r2/runner/tests/host/artifacts/qalead-la-9-fd146062-2026-10-23T15-07-00-088Z/summary.json` and `container-LA-E5-13/vitest-results.json`.
- `LA-E5-13/r2/clone-9/tests/ltiaas/tasks-qa/LA-E5-13/two-tenant-isolation.k1sim.test.ts` (discovery expression).
- `SLOT8/artifacts/qalead-la-31-8fadb828-2026-10-23T21-38-23-889Z/summary.json`; `SLOT8/artifacts/qalead-la-33-8fadb828-2026-10-23T21-49-06-848Z/summary.json`.
- `SLOT3F/artifacts/qalead-la-66-a8bbac53-2026-10-24T05-56-45-538Z/summary.json` (17 PASS, 1 demo SKIP; B4/B5/B6 isolation rows PASS).
- `LA-E7-08/slot3b-80133d6b/golden-capture-80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5/G1.json` (public provider shape).

Host logs: `/tmp/la-reviewer-a-ctx-ec3c53d42903-evidence/{e513-k0.log,e513-oracle.log,raw-audit.txt,supplemental-audit.txt}`. Reproducer: `/tmp/la-reviewer-a-ctx-ec3c53d42903/reviewer-isolation-oracle.test.ts` and `reviewer-vitest.config.mts`. Only assigned Reviewer-A reports changed in integration; no stack, product, frozen-test or other-reviewer file was changed.
