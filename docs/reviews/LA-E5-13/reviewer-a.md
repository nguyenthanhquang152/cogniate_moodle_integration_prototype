Verdict: APPROVE
Round: 2

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

## Round 2

Reviewer: Codex GPT-6-Astra xhigh, 2026-10-24. Reviewed `0a9a2a2d` and `894e9421`, merged at `6fa8586b`, using the task diff from `cdee5d83`, the task spec, LA-ADR-07 D1 and the Round 1 evidence. **APPROVE: 0 new BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.** No finding remains open in this review.

### Findings closed

| Finding | Evidence |
| --- | --- |
| A-LA-E5-13-01; the same envelope defect reported as B-LA-E5-13-01 | Closed. Setup now requires the contracted `.lms` envelope, all five built channels and their methods. Brightspace's manual and dynamic fixtures are unconditional; seven fixtures are required before probing. Repeated the Round 1 experiment on all three provider envelopes in the saved G1 capture: the old expression returns zero entries; the new parser returns all five channels, including Brightspace. K0 rejects `.providers`-only, empty, missing-Brightspace and missing-method payloads, and incomplete fixture lists. An independent harness running the actual AC01 callback rejects an HTTP 200 leak on Brightspace's tool-configuration route. |
| B-LA-E5-13-02, as described in the dispatch and QA fix report | Closed. AC01 captures seven connection and two publication DTOs in B's session before A's calls, then reads them again and compares the stored fields and complete raw DTOs. It does not rely on `status !== 'disabled'`. The actual callback rejects the reported registered-to-pending/site-URL mutation even when all foreign requests return 404. Separate probes also reject a nested platform client-id change, an extra raw DTO field change and a publication activity-count change. The unchanged-state control passes. |

### Independent host verification

- Made `/tmp/la-reviewer-a-ctx-91455ef1684d` with `git clone --no-hardlinks`, pinned to `6fa8586b`, and installed its own dependencies. Cleared that clone's exact Vitest cache before each invocation. The committed K0 suite passes **6/6**; the task TypeScript check exits zero.
- Private harnesses execute the actual suite callbacks with controlled responses and no network. AC01 gives **6/6**: the good control exercises 100 API probes plus two portal backing calls; each of the five bad-response/state cases above fails the callback. The Round 1 AC03 harness, adapted only for the new imports and artifact writer, gives **4/4**: correct account refusal followed by owner redemption passes; cross-account acceptance, the wrong `storage_origin` reason and consuming the owner's check are rejected.
- The new K0 checks exercise the parser and state comparator with both positive and negative inputs. They are substantive regression controls; the unchanged source-presence checks alone are not treated as live evidence. The task has no UNIT-tagged ACs.

### Live evidence and limits

Read both saved `qa3-la-e513-r2` runs at `4064df6d`: the `15:39:19.099Z` and `15:43:19.547Z` summaries and Vitest JSON each show **5 passed, 0 failed, 0 skipped**, with SUITE and teardown PASS. The second run also contains the five AC JSON artifacts. Its AC01 artifact records five channels, seven fixtures, 91 connection probes (26 Brightspace), 100 API probes, zero response failures, zero app/LTI outbound events and `victimComparison: { ok: true, diffs: [] }`. The callback also asserts zero sink and simulator service calls. AC03 records the exact unknown/used/expired refusal and the owner's subsequent 303; AC05 records foreign revoke 404, zero cross-scope revocations and the owner's successful 204 score submission.

Compared all seven suite files in the executed clone against this review's source: byte-for-byte agreement, subtree `55d797d16a8fd39f32e019512b08172318f288f7`. The runner's `4064df6d` has no product-path changes from `4f10c5fd`; the suite overlay and artifact-writer fallback are disclosed. The first run lacks the per-AC JSON files; the second run supplies them. This is no longer the earlier failed seed-dependent SIM run.

The new AC06 callback passes its SIM isolation surrogates, including the added deployment probe. It does **not** rerun the six original frozen cases unchanged at `4f10c5fd`; their earlier, separately identified passes and the pending final re-gate remain distinct evidence. No all-suite final gate approval is implied. Cut/unbuilt routes remain named N/A rather than being certified by their 404s.

The two fix commits change only this task's QA suite, README and QA report. No product, frozen E2E test, core LMS path or other lane's implementation changed. No Reviewer-B file was opened.

Host logs and real-envelope results: `/tmp/la-reviewer-a-ctx-91455ef1684d-evidence/` (`k0.log`, `reviewer-probes.log`, `typecheck.log`, `real-envelope-probe.json`). Private reproducers: `reviewer-ac01.test.ts`, `reviewer-isolation-oracle.test.ts` and `reviewer-vitest.config.mts` in that clone. Raw live root: `/Users/quangnguyen/cogniate-qa-runs/LA/qa3-la-e513-r2/clone/tests/host/artifacts/`. No Docker, stack, host stack runner or commit was run; only this review file changed in integration.
