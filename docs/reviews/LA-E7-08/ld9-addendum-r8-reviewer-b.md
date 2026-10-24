Verdict: CHANGES_REQUESTED
Round: 1

# LD-9 addendum r8 and LD-29 re-gate — Reviewer-B

Reviewed 2026-10-24 at integration `2da33750` (QA `d736abb6` + `c55e9d05`), against LA-E7-08, LA-E7-09, LA-E0-02, the earlier addenda and my reviews, and plan LD-9/LD-25/LD-29/LD-30. **0 BLOCKER, 1 MAJOR, 1 MINOR, 0 NIT.** The four-hunk patch and the prepared source trees are approved. The run plan needs the correction below before it is a reliable execution handoff. Live acceptance remains pending.

## B-LA-E7-08-LD9-R8-01 — MAJOR — Bind the kit runs to the reviewed tests and their wave inputs

**File:line:** `tests/ltiaas/GATE-RUN-PLAN.md:971`, `:984`, `:996` (also the generic `--test-sha` heading at `:932`).

**Problem:** The plan names the right gate tree, but its kit invocations do not select that tree or supply the required wave evidence. The walkthrough invocation also uses an unsupported option. These details matter because the runners clone the product SHA; invoking a runner from the gate checkout alone does not select its in-container tests.

**Evidence:** In the pinned candidate, `node tests/ltiaas/kit/run-k1sim.mjs --channels ... --help` exits with `ERR_PARSE_ARGS_UNKNOWN_OPTION` before any run. The runner always discovers all fixtures. `4f10c5fd:tests/ltiaas/kit` is `8ad870fa`, while the approved gate tree is `d7e50b5d`. `core.mjs:247` copies the controller's tests only with `--replace-tests` when the product already has tests; `overlayKit()` alternatively needs `LA_K1_KIT_FROM`. Neither selection is in the new kit rows. `LA_WAVE_ID` and `LA_K1_WAVE_SPEC` are also required, but §10 does not identify their source reports or dependencies. D4's kit is scheduled before D4's T3b/T7/T8 runs, so an operator must know which completed runs may supply it. The core-based kit and legacy runners do not accept the table's generic `--test-sha` flag; M1/M2 have their own handling.

**Suggested fix:** Add one runner-specific invocation block per family, with the product pin, test source/overlay mechanism and recorded tree check. Remove `--channels`; prepare the six-fixture overlay explicitly. Name the kit wave manifests, producer runs and required readiness order for D3, D4 and the walk. A link to an existing exact command is sufficient if its pins and inputs are updated. No product or oracle change is requested.

## B-LA-E7-08-LD9-R8-02 — MINOR — Correct the carried backup-drill evidence

**File:line:** `tests/ltiaas/GATE-RUN-PLAN.md:998`.

**Problem / evidence:** The row labels `qa-e2e-la-moodle-r3` as an LA-E5-24 Moodle drill with 36/36 PASS. LA-E5-24's report instead records a K1-SIM backup/restore drill, `qa-e2e-la-drill-r2` on `56038618`, with 10/10 AC/host rows (`docs/reviews/LA-E5-24/qa.md:96`). The row's claimed empty diff across `infra/` also includes `infra/README.md`; the executable code is unchanged. The carry rationale is reasonable, but the evidence identity is wrong.

**Suggested fix:** Separate encryption continuity from backup/restore, cite each actual run and count, and state that the executable paths are unchanged. This does not itself require another drill.

## Source and host verification

- The 3,366-byte patch hash matches `ddf3f1c3ff38c2e805fa0fdf668f7c0a05efe1dbb76a54c1d102b02c01e3c514`. It applies to `4f10c5fd`; applying it reproduces all five combined files in `57b6a78c` exactly. Reverse checking passes too. T6 retains B/C's connection-ready assertion plus r4's loading wait; T8 retains the Moodle prefix plus r7's unique-option wait. The B/C restart and secret-filter changes remain intact; the accessibility file needs no extra patch.
- All nine B/C-only test files are byte-identical in both new gate trees. All 31 non-overlapping files from the old 36-file overlay retain their approved content. Baseline-3 contains only the applicable overlay changes; its Canvas methods remain manual-only. The two trees differ in exactly the 12 documented candidate-only frozen-test paths.
- Published source directories are clean at the stated commits. Baseline `d854183f` directly follows `78971b03`; candidate `57b6a78c` follows `5ee0ebd0` on `4f10c5fd`. Both have **zero non-test diff**. D3 and D4 have identical tree `124ceb02b30d8fa93bb6827ebfc6edf9e041e81b`; kit tree is exactly `d7e50b5dea56382f849b213f006b73bcf5eb71aa`.
- Private clones: `/tmp/reviewer-b-ld9-r8-qa4kpgty/{baseline,candidate}`. The four named host self-test files pass **37/37 on each**. M2 harness-only passes on each (**6 self-tests**, 64 cases discovered, typecheck and T7 isolation). Candidate open-world checks pass **46/46**; K2 harness-only passes **7/7**, discovering 12 K2 and two R2-sim cases with the frozen selections preserved. Tracked private files are restored and clean.
- The planned run set covers both full legacy/M1/M2 runs, golden comparison, both five-channel kits, the six-channel walk and K2. The stated phases keep at most two LA stacks and one Moodle stack, with distinct concurrent ports/subnets; unchanged migration and key/restore executable paths support carrying earlier task evidence. The baseline rows include each missing legacy group and its app/LTI rate extraction. Their results are still pending.

Artifacts: `/tmp/reviewer-b-ld9-r8-qa4kpgty/{tree-audit,overlay-provenance,patch-checks,kit-command-checks,carry-scope}.json` and the `baseline-*.log` / `candidate-*.log` host logs. The separate baseline reconciliation review is [LA-E0-02 Round 2](../LA-E0-02/reviewer-b.md). No Docker, stack, live HTTP or commit; no other reviewer's file read. Only the two assigned review files were edited in integration.
