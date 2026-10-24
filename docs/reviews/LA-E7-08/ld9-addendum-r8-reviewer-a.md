Verdict: CHANGES_REQUESTED
Round: 2

## Round 1

Reviewer-A: Codex GPT-6-Astra xhigh, 2026-10-24. Lens: “Is it right and is it safe?” Reviewed QA `d736abb6` / `c55e9d05`, integrated at `2da33750`, against LD-1, LD-9, LD-25, LD-29, LD-30, the earlier approved Reviewer-A addenda, and the E0-02 / E7-08 / E7-09 gate requirements. **0 BLOCKER, 2 MAJOR, 0 MINOR, 0 NIT findings in this report.** The r8 patch and frozen source overlays are approved; the combined re-gate plan needs the two corrections below before it is executable as written.

### A-LA-E7-08-LD9-R8-01 — MAJOR — The pinned golden source cannot perform the promised version 2 capture

**Location:** `tests/ltiaas/GATE-RUN-PLAN.md:981` (`qalead-la-150`) and `:993` (`qalead-la-138`); source table at `:935`.

**Problem:** D3 and D4 promise G1–G4 golden version 2, including the missing Moodle flow, but both pin a test tree that still contains version 1. Slot R0 names only the moving `la-qa` source. The plan has no step that freezes the corrected golden producer and expected changes, then installs those same bytes for both final runs.

**Evidence:** In both gate clones, `57b6a78c:tests/ltiaas/golden/capture.golden.ts:1` declares version 1; lines 9–10 defer Moodle G2/G3 to version 2; the channel loop at lines 223–233 contains only Blackboard and Canvas. `run-golden.mjs:93` also writes `goldenVersion: 1`. This is the source gap already identified in A-LA-E0-03-01, now bound into the D3/D4 plan. A new R0 capture from another tree does not update these frozen candidate sources.

**Suggested fix:** Make the approved E0-03 version 2 fix a prerequisite for the golden rows. Pin its producer, normalizer, comparator and expected-delta tree, and specify the same test content for R0, D3 and D4, with the appropriate product SHA in each run. Either regenerate the gate tags and repeat their tree proofs, or name a separate immutable golden overlay and its installation commands. Keep this prerequisite pending until that pin exists; do not credit version 1 as the planned version 2 comparison.

### A-LA-E7-08-LD9-R8-02 — MAJOR — The concurrent SIM rows also start Moodle

**Location:** `tests/ltiaas/GATE-RUN-PLAN.md:944`, `:948`, `:981` and `:1002`.

**Problem:** The 226-minute schedule treats SIM runs as consuming no Moodle container, but the pinned runners start and seed the full stack. Thus the proposed overlaps do not satisfy §10(b)'s explicit rule that a Moodle container stack is never started while another is up.

**Evidence:** The pinned golden runner calls `stack:up` and `seed` at `tests/ltiaas/golden/run-golden.mjs:44` and `:45`; M1, M2, K1 and K2 do the same. `infra/scripts/stack-up.sh:77` runs unrestricted `dc up -d --wait`; `infra/compose.yaml:79` declares Moodle without a Compose profile; `infra/scripts/seed.sh:14` requires running Moodle and then provisions it. The earlier D2 golden summary (`RUN-D2/artifacts/qalead-la-92-a8bbac53-2026-10-24T10-30-37-065Z/summary.json`) independently records Moodle in both H1 service lists. Therefore R0/R1, R2/R1-Moodle and D3/D4 overlaps can each have two Moodle containers. Distinct ports and subnets do not prevent this.

**Suggested fix:** Reconcile the process rule with the actual runner behavior before booking these overlaps. Under the stated one-container rule, serialize these stack lifetimes, including startup, seed and teardown, and revise the critical path (the listed active durations sum to 332 minutes). If the Lead means one active Moodle test workload while a SIM stack has an idle seeded Moodle container, record that narrower process decision explicitly and state the permitted overlap; it is not what §10(b) currently says. A genuinely Moodle-free SIM runner would need separate implementation and verification, not just a lane label.

### Approved source and assertion checks

- The patch is exactly **3,366 bytes**, SHA-256 **`ddf3f1c3ff38c2e805fa0fdf668f7c0a05efe1dbb76a54c1d102b02c01e3c514`**, and byte-equals `git diff 5ee0ebd0 57b6a78c`. It applies cleanly to `5ee0ebd0`; the resulting entire `tests/` tree equals `57b6a78c`. Reverse applicability also passes on `baseline-3`.
- Complete-file comparisons of all five overlaps retain the B/C changes. T8 keeps the B/C `(Moodle, ` prefix and adds the approved r7 exact-count wait; T6 retains both the r4 loading wait and B/C's `Dev Moodle` wait. The XSS/keyboard file is byte-identical to B/C final. M1 retains the kill-mode handler; T7 retains `isCloneEnvSecret`; only their approved QA project guards change. No additional assertion is removed or weakened.
- All nine B/C-only files match `78971b03` in both source trees. All non-overlapping frozen LA changes match `la-final-test-2`; the LD-1/r5 helpers and tests also match. The baseline/candidate frozen-suite difference is exactly the twelve listed LA-IC / LD-24 files. Baseline keeps the old Canvas dynamic-registration and Moodle NRPS expectations, with only the applicable open-world/race/identity changes.
- `src-baseline-3` is `d854183f`, with test tree **`eb750ef19509e0dd38a2c5635939fb4756113f26`**. Both `src-final-3` and `src-final-3-d4` are `57b6a78c`, with identical test tree **`4a540ae14cead274d921e7e8f21d5896a1c8ca63`** and kit tree **`d7e50b5dea56382f849b213f006b73bcf5eb71aa`**. All three have zero non-test diff from their product pins, no tracked working-tree diff, and no untracked test source. This satisfies LD-25 parity for the presently pinned suites, subject to the golden correction above.
- The run list includes the D1/D2 suites, each legacy group, T7 ×3 in each final run, five-channel K1 in both D3/D4, the six-channel walk run and K2. Baseline R1 explicitly records per-group results/durations and app/LTI rates for M1, T7 and the legacy groups. Golden rows require every difference to name an LA-IC or B/C commit. The carry-forward rationale for migration, snapshot and key drills is sound at the executable-code level; `infra/README.md` does change, so the last row's literal claim of an empty `infra/` diff should be read as no executable infrastructure change. The listed 226-minute arithmetic is correct only for the proposed overlap, which finding R8-02 challenges.

### Host verification and boundary

Fresh private clones: `/tmp/la-review-a-e1e451fa43ee` and `/tmp/la-review-a-e1e451fa43ee-baseline`, both made with `git clone --no-hardlinks`. Existing dependencies were copied into the first clone; no install was run.

- Host self-tests: **37/37 PASS on each source** (candidate 2.33 s; baseline 2.54 s), with fake subprocess/Docker adapters only.
- LD-1 node tests: **46/46 PASS**.
- M2 harness-only: **6/6 PASS**, typecheck PASS, all **64** cases discovered, T7 selection unchanged. The addendum's `4/4` count excludes the two additional imported self-tests; it does not affect acceptance.
- K2 harness-only: **7/7 PASS**, typecheck PASS, **12 K2 + 2 R2-sim** cases discovered and legacy selections preserved. The first attempt lacked the root workspace dependencies; after copying them, the complete harness passed.
- An independent adaptation of the B/C kill-mode self-test uses `qalead-la-r8-selfcheck`: **PASS** with r8. Restoring only the old project guard makes it **FAIL**, proving that the combined handler supports the scheduled prefix while retaining the refusal checks. The product source was restored afterward.

Evidence: `source-audit.json`, `combined-files.json`, `reviewer-patch-check.log`, `reviewer-host-selftests.log`, `reviewer-open-world.log`, `reviewer-m2-harness.log`, `reviewer-k2-harness-retry.log`, and the two `reviewer-qalead-*.log` files in the first clone; baseline patch/self-test logs in the second. E0-02 reconciliation is reviewed separately in `docs/reviews/LA-E0-02/reviewer-a.md` Round 2.

No Docker, stack, stack-starting host runner, live acceptance run or commit. No Reviewer-B file or probe was opened. Only the two assigned Reviewer-A reports were changed in integration; all live re-gate and baseline-3 acceptance remains pending.

## Round 2

Reviewer-A: Codex GPT-6-Astra xhigh, 2026-10-24. Reviewed QA `44907ced`, integrated at `ab8e8938`, including the scoped diff from `eefa1c9c`, the rebuilt gate sources, LD-31, and the revised §10 commands. **CHANGES_REQUESTED: 0 new BLOCKER, 2 new MAJOR, 1 new MINOR, 0 NIT.** Both Round 1 findings are closed. The source pins and revised schedule are approved; the invocation defects below must be corrected before the plan can run as written.

### Round 1 closure and source checks

- **A-LA-E7-08-LD9-R8-01 — CLOSED.** Baseline `1ae6716b7353becc0f053b46fb65e0ba86ff7873` and both candidate sources `794f649c3ebacf1a1b3ac599cffffe338dd7373d` contain the same golden tree **`1909e58f79e5214e7bb349a92811255391aa191c`**, equal to approved QA `d1603f4d`. This includes version 2 and the 17 added expected changes reviewed in E0-03 Round 2. Relative to the previously reviewed gate sources, only `tests/ltiaas/golden/**` changes. The r8 patch, B/C assertions and kit remain unchanged.
- Baseline test tree is **`da790a4b2d75d0ebf1a27ee0de0fbe7c772291fa`**. Both candidate test trees are **`b202c3ee3ef21f6caa7e3a11ec5c8a6daf7aac86`**; their kit tree remains **`d7e50b5dea56382f849b213f006b73bcf5eb71aa`**. All three gate sources have zero non-test diff from their respective product pins, no tracked working-tree diff and no untracked test source.
- **A-LA-E7-08-LD9-R8-02 — CLOSED.** LD-31 explicitly permits an idle seeded Moodle container in the overlapping SIM stack. The revised schedule permits only one active Moodle workload and at most two LA stacks; M2/K2 run alone, including other stacks' startup and teardown. An overlap failure must be rerun alone and recorded as a flake. D3/D4 K1 follow their own completed Moodle waves. The remaining R1 plus R3 critical path is **94 + 148 = 242 minutes** under the stated estimates.
- The carried E5-24 drill is now correctly distinguished from E7-09 encryption continuity: **10/10** drill rows (6 ACs and 4 host gates), rather than 36. Its full identifiers still need the minor correction below.

### A-LA-E7-08-LD9-R8-03 — MAJOR — Golden normalization truncates all four JSON files

**Location:** `tests/ltiaas/GATE-RUN-PLAN.md:1073`.

**Problem:** The copy-and-normalize command evaluates `open(p,"w")` before `open(p).read()`. Opening for write truncates each copied golden file, so the comparison receives empty files and cannot run.

**Evidence:** Executing the documented expression on private copies of the approved G1–G4 files changes their sizes from **48,123 / 48,309 / 61,862 / 27,257 bytes to zero**. The pinned comparator exits **2**, `Unexpected end of JSON input`. A control that reads each file before opening it for write preserves valid JSON and exits **0**, with zero differences. Original capture files were not changed.

**Suggested fix:** Read each file into a variable before writing its normalized content, or write to a separate destination. Check the exact replacement command on copies, parse all four outputs, and run the comparator control before using it for D3/D4.

### A-LA-E7-08-LD9-R8-04 — MAJOR — The K1 wave example does not match the pinned producer or its output paths

**Location:** `tests/ltiaas/GATE-RUN-PLAN.md:1092`, `:1100` and `:1103`.

**Problem:** The plan creates a `{waveId,sources}` object with `{id,kind,path}` entries and points to raw Vitest/Playwright results. The pinned producer requires an array of `{suite,file}` entries naming complete host/e2e summaries. The documented artifact root is also not where the invoked runners write their results. Consequently both planned K1 runs fail to bind their Moodle evidence.

**Evidence:** `tests/ltiaas/kit/run-k1sim.mjs:189` passes the parsed file directly to `writeWaveEvidence`; `lib/wave-producer.mjs:171` rejects the documented object with **`wave spec: a non-empty array is required`**. Independently judging its three entries gives **`unsupported suite undefined`**. The producer requires `host-summary` for T3b/T8 and `e2e-summary` for T7, including run identity and complete result accounting; the proposed `vitest`, `t7` and `playwright` kinds do not match. A control using the existing approved array of summary paths passes all three producer checks. This is a format control only, not acceptance of those historical runs for D3/D4.

`tests/host/core.mjs:86` writes T3b/T8 artifacts under the source's `tests/host/artifacts/<runId>/`; `tests/e2e/host/run-t7.mjs:75` writes T7 under `tests/e2e/artifacts/runs/<runId>/`. `--workdir` changes the product clone, not these roots. No step copies these results to the example's `$REGATEDIR/artifacts` directory. K1 performs setup before parsing the spec, so the malformed input would waste a live stack run.

**Suggested fix:** Use an array with `suite: "T3b"`, `"T7"`, `"T8"` and `file` pointing to each completed runner's **`summary.json`**, with the correct source artifact roots or an explicit archival step. Keep `LA_WAVE_ID` in the environment. Bind D3 to `131/130/137` and D4 to `154/153/160`, verify each summary's product SHA and run identity, and preflight the exact generated file through the pure producer before launching K1.

### A-LA-E7-08-LD9-R8-05 — MINOR — The carried drill row gives a nonexistent full commit and artifact root

**Location:** `tests/ltiaas/GATE-RUN-PLAN.md:1013`.

**Problem and evidence:** The row gives `5603861829dd7da4cfaf98ebfb7323b45063e7df` and `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E5-24-r2/`; neither exists in the reviewed repository/filesystem. The cited `docs/reviews/LA-E5-24/qa.md:90` instead names commit **`5603861886909667a03d2aaf7843a9b17a4020ed`** and the existing directory **`/Users/quangnguyen/cogniate-qa-runs/LA/LA-E5-24/r2/artifacts/qa-e2e-la-drill-r2-56038618-2026-10-23T20-36-36-947Z/`**. Its 10/10 result is correctly cited; this is a traceability error, not a rejection of carrying that evidence.

**Suggested fix:** Copy the full SHA and artifact root from the cited drill report.

### Round 2 verification and boundary

Fresh private `git clone --no-hardlinks` copies: `/tmp/la-review-a-6fc243f34f57-final` and `/tmp/la-review-a-6fc243f34f57-baseline`. The four pure host self-test files pass **37/37 on each source**. Candidate golden K0 passes **12/12**. An extra baseline golden K0 attempt gives **10 PASS / 2 FAIL** because its legacy tree lacks the candidate-only `tests/sim/hosts.json` and `tests/ltiaas/k0/contract.test.ts` references; the plan claims 12/12 only for the candidate, and does not schedule that baseline K0 check. This is not credited as a baseline pass.

Evidence in the final private clone: `source-audit-r2.json`, `reviewer-golden-command-probe.json`, `reviewer-wave-probe.json`, `reviewer-plan-probe.mjs`, `reviewer-host.log` and `reviewer-golden.log`; baseline test logs are in its private clone. E0-02 raw-result reconciliation is recorded separately in Reviewer-A Round 3. No Docker, stack, stack-starting host runner, dependency installation or commit; no Reviewer-B file or probe was opened. Only the two assigned review files were changed in integration. Live R1/D3/D4 results remain pending.
