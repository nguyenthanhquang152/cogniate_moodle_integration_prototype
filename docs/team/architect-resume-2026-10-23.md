# Architect continuation after the session limit

This Lead brief supersedes the historical Stage 1 and runtime directions in task `task_f301484bd6be`.
Use Claude Opus 5.5, xhigh. Do not repeat completed work.
The previous dispatch `ctx_422d7f0f0928` hit its session limit at 2026-10-22 19:37:09 UTC.
The Lead stopped that exact dispatch after reading the explicit transcript event. Its files and evidence remain intact.

## Scope and ownership

Work in this integration checkout on `nguyenthanhquang152/lti-multi-lms`.
Read the charter, current phase plan and current remaining-work checkpoint.
Act as Architect and planner. No subworkers, commits, pushes, Docker, browser, installs or runtime commands.
Append only to `docs/reviews/M3/t6-09-failure-plan.md` and `docs/reviews/M4/architect-conformance.md`.
Preserve the full current prefixes: plan 45,418 bytes, SHA-256 `30482dc238068868f3948647270dc1e46b6422f9eadf06f8be1032a4338b4ae0`;
conformance 44,211 bytes, SHA-256 `2fb3f06139c93111dbee8afbd63aea16b1f7427e69512211ba4a9a1a11dfc628`.
Do not edit product code, tests, guides, team files or sealed evidence. Leave untracked `pnpm-workspace.yaml` untouched.
New private directories use 0700; files use 0600; scripts use 0700.

## Immediate task: one consolidated failure assessment

Canvas SIM round 2 failed one case, `M1-37.canvas.s-dead`: expected HTTP 409, actual HTTP 200.
The other 257 functional cases passed. Round 1 passed all 258 cases.
Product remains C6 `4008afb92fe983d52db33442e060210b929966c8`.
Tests remain C8 `5561e8f72a83de36a68877c6b26ffc8288ade735`, tree `65eaefab31ec6800fca06aee50e5e25c95713f8a`.
C8 equals C6 outside docs and tests. There is no new product change.
E-R5 is invalidated for further acceptance. No retry, M2, T7 or test/product edit is granted.

Verify the failure against primary logs and the round-1 control. Separate facts from inference.
Common QA suspects a test-harness defect: `stack:restart` sends SIGTERM; the two-second graceful drain lets a held outbound PATCH reach its five-second timeout; the live handler clears its lease before exit. The later retry then returns 200.
Check this hypothesis and all related dead-handler helper uses in one bounded assessment. Do not change product shutdown to satisfy a faulty setup.
Propose the minimal necessary repair, exact owner and paths, preserved assertions, and sufficient revalidation.
Explain which accepted evidence is independent of any repair and may remain accepted. Do not prescribe broad reruns without a dependency.
Do not grant or start execution. Send the held append's hashes and the concise recommendation to Lead.
The independent Gemini session `ctx_806443ba13cd` is also assessing the frozen failure; coordinate through Lead.

## Exact primary evidence

V4 is `/Users/quangnguyen/cogniate-qa-runs/qa-common-c6-v4-20261022T1554Z`.
Round 2 phase is `V4/c8-clean-src/source/tests/host/artifacts/qa-multi-r1-4008afb9-2026-10-22T19-23-57-487Z`.
Round 1 phase is the sibling `qa-multi-r1-4008afb9-2026-10-22T18-54-44-439Z`.
Replace V4 with its absolute path; it is notation, not an environment variable.

Round 2 bindings:

- `summary.json`: `e5fc12fcaa5edd0dfa096d546bd228a94bd3bd1e2620cfc206b4ab56f29d2259`.
- `evidence/sim/m1-vitest-results.json`: `eb76dfb2bd00b386807b92bb64edc5da5953042051d2c22b1f59ce9e1a8384f9`.
- `service-logs/cogniate-app.jsonl`: 742,608 bytes, `f434ec12060082fa2e3ef772f4cf4c7036d25a27d29487977276531ab1e2ca20`.
- `evidence/sim/M1-37.canvas.s-dead.json`: 126,126 bytes, `c3e14462e41af42e0e75a45606b3911b9a68cec808c49d4b6a8424510b9c75dc`.
- V4 `evidence-index-canvas-sim-c6-r2.tsv`: 68 entries, 9,667 bytes, `4f6e27a14fe9c933d3b7970120e1c963868325baa612124716248c258a536522`. Lead verified every entry.
- V4 `canvas-sim-c6-r2/REPORT-CANVAS-SIM-C6-R2-FAIL.md`: 5,153 bytes, `4c7bfdac9912710252694945caad7aabec1d22dff21c1c2a8327ed56577463f3`.

Common QA's chronology to verify: grant attempt 19:34:23.188; S3 held PATCH after 19:34:23.240; SIGTERM 19:34:27.024; outbound timeout and lease clearing 19:34:28.246, HTTP 502 at 19:34:28.248; recreated app 19:34:32.246; retry 19:34:34.833–.859 returns 200.
Relevant source pointers: `tests/acceptance/M1/canvas/51-canvas-races.test.ts:303`, `packages/shared/src/http.ts:48`, `services/cogniate-app/src/app/redemption.ts:172`.
The report is committed at `9d88e0e`. Common QA's task settled FAILED and its terminal was released (retained external terminal); it is not active.

## Accepted and pending evidence

Legacy remains accepted under E-R4 (`26797fd`): all 12 groups, 304 raw results and 251 as the sum of unique IDs within each subrun. No reason to repeat it has been established.
Round 1: 258 functional PASS, W4/cleanup/scans PASS; index 67 entries SHA `4626b76287976982384df48149660693da8720f7f73a19832f1a11b117e49620`.
Independent round-1 extra evidence was corrected and committed at `09510c8`. The original wrong artifact is preserved and excluded.
Corrected artifact is `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-5561e8f-c8R3Prep/judge/round1/s11-6-round1-reconciliation-v2.json`, 100,538 bytes, SHA `900167a0c942da01596ca64d69e346ffc19e63d2a00a9d9c3795c8a061c0c110`.
Lead verified all cited primary records, identifiers and trace timings. Do not redo that completed reconciliation without a concrete inconsistency.

All 32 protected full volume records remained unchanged in both rounds. Round 2 W4/cleanup/scans passed.
Savoy's full-window confirmations remain pending: round 1 18:52:27.803–19:11:33.353 UTC; round 2 19:21:20.320–19:38:24.055 UTC.
Its only reported round-1 block is 19:01:14–19:01:33, containers `sto-go-1792695689-77379` and `sto-it-0680bf005a3e`, no build/network.
No round-2 block is reported; the sampler saw none. Neither fact substitutes for the pending full-window confirmation.
No link between foreign work and this test failure is established. Do not infer exclusivity.

## Later conformance

Final conformance stays pending until Lead supplies accepted complete runtime and the approved evidence route.
M2 and T7 have never run on C8. Draft runtime grants are obsolete.
Reuse completed source conformance and reviews. Do not restart a broad audit.
Preserve all 32 real-LMS rows as UNVERIFIED, local Canvas as DEFERRED, and all existing residual findings, Q19–Q22 and D1–D12.
No enterprise-readiness or certification claim. No push or main merge.
After the interim plan, remain available in the same dispatch for the real final handoff; do not send worker_done early.
If a provider limit stops progress, report it explicitly when possible. End the final task with exactly one worker_done and an explicit outcome.
