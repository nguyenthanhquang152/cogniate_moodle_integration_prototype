Verdict: APPROVE
Round: 3

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

## Round 2

Reviewed 2026-10-24, Codex GPT-6-Astra xhigh, against QA `44907ced`, integration `ab8e8938`, and plan LD-31. **CHANGES_REQUESTED: 0 BLOCKER, 2 MAJOR, 1 MINOR, 0 NIT.** The rebuilt source trees and revised concurrency schedule are approved. The execution examples still contain two reproducible failures. Live baseline and double-run acceptance remain pending.

### B-LA-E7-08-LD9-R8-01 — MAJOR — OPEN: the wave input still does not match the pinned producer

**File:line:** `tests/ltiaas/GATE-RUN-PLAN.md:1089`, `:1100`, `:1103` (D4 inherits the same instructions at `:1126`).

**Problem / evidence:** The overlay flags, removal of `--channels`, and producer-run ordering are corrected. However, the example writes an object `{waveId, sources: [{id, kind, path}]}`. The pinned `writeWaveEvidence()` requires an **array of `{suite, file}` entries** and reads complete host `summary.json` files. Passing the documented object to that pure function throws `wave spec: a non-empty array is required`. Converting only the outer object to an array would still fail: the field names and `vitest` / `t7` / `playwright` kinds are wrong, and the selected container reports do not contain the required host phases, run identity and aggregate results. In the live runner this validation occurs after stack setup.

The paths also do not follow the documented producer commands: core runners write under `$SRC_FINAL_3/tests/host/artifacts/<run-id>/`, while T7 writes under `$SRC_FINAL_3/tests/e2e/artifacts/runs/<run-id>/`. `--workdir` changes the product clone location, not either artifact root. No collection step creates the example's `$REGATEDIR/artifacts/`. The section also uses `REGATEDIR`, source variables and `BASELINE_3_SHA` without an initialization block. Finally, the walk's existing `wave-spec-r8.json` references T7 **qalead-la-66**, not the stated 56; that existing array passes the real producer for all three suites.

**Suggested fix:** Define the variables once and select each completed run's actual `summary.json`: T3b from 131, T7 from 130, T8 from 137 for D3; 154, 153, 160 for D4. Write `[{"suite":"T3b","file":".../summary.json"}, ...]`, keep `LA_WAVE_ID` in the environment, and check the manifest with the pure producer before starting the kit stack. Use the existing working r8 manifest as the format reference. Correct the walk's T7 source number.

### B-LA-E7-08-LD9-R8-03 — MAJOR — The normalization example empties every copied golden document

**File:line:** `tests/ltiaas/GATE-RUN-PLAN.md:1073`.

**Problem / evidence:** In `open(p,"w").write(open(p).read().replace(...))`, Python opens the write target and truncates it before evaluating the read argument. On disposable copies of the pinned golden files, the exact expression exits 0 but changes all four files from non-empty JSON to **0 bytes**. The following compare exits **2**, `Unexpected end of JSON input`. The original capture survives because the plan copies it first, but D3 cannot complete its golden comparison using this command.

**Suggested fix:** Read each file completely before opening it for writing, for example `text = p.read_text(); p.write_text(text.replace(":9473", ":9643"))` using `pathlib.Path`. Check that all four outputs still parse and that only the intended port values changed. Smoke-test this command on disposable documents; no live rerun is needed to verify the correction.

### B-LA-E7-08-LD9-R8-02 — MINOR — OPEN: correct the remaining drill identifiers

**File:line:** `tests/ltiaas/GATE-RUN-PLAN.md:1013`.

**Problem / evidence:** The separate continuity and backup rows now identify the right drill, lane and 10/10 count. The new full drill SHA `5603861829dd7da4cfaf98ebfb7323b45063e7df` is not a commit, and `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E5-24-r2/` does not exist. The cited QA report and git resolve the real commit to **`5603861886909667a03d2aaf7843a9b17a4020ed`** and the artifact directory to **`/Users/quangnguyen/cogniate-qa-runs/LA/LA-E5-24/r2/artifacts/qa-e2e-la-drill-r2-56038618-2026-10-23T20-36-36-947Z/`**.

**Suggested fix:** Copy those exact identifiers from the cited record. The carry rationale and absence of executable infrastructure changes remain accepted; no repeat drill is requested.

### Verified source and scheduling scope

- Fresh `git clone --no-hardlinks` copies of **each** published source are under `/tmp/reviewer-b-ld9-r8-r2-tofad1og/{baseline,candidate,candidate-d4}`. Published sources and private tracked files are clean. Baseline is `1ae6716b` directly atop `d854183f`; both candidates are `794f649c` directly atop `57b6a78c`. All three have **zero non-test diff** from their stated product pins, and each new top commit changes only `tests/ltiaas/golden/**`.
- All three golden trees equal **`1909e58f79e5214e7bb349a92811255391aa191c`**, independently matched to `d1603f4d`. Both candidate kit trees remain **`d7e50b5dea56382f849b213f006b73bcf5eb71aa`**. D3 and D4 full trees are identical (`847a3e0b232f569e4dc91e2013f9e1aac99ec3f9`). The r8 patch is unchanged at 3,366 bytes and its recorded SHA-256; reverse apply-check passes. The earlier frozen-test parity audit therefore remains valid.
- Four host selftest files pass **37/37 on each of the three clones**. Golden K0 passes **12/12 on both candidate clones**. An extra baseline golden K0 check gives **10/12**, because its two candidate-only checks require `tests/sim/hosts.json` and `tests/ltiaas/k0/contract.test.ts`, absent from the pre-LA product. The plan claims 12/12 only for the candidate; this does not invalidate the baseline's stored golden tree or the scheduled R1 suites. No dependencies were installed in integration.
- LD-31 is represented correctly: one active Moodle workload, at most two LA stacks, exactly two listed SIM/Moodle overlaps, solo M2/K2 windows after other teardown, and solo reruns retained as flake findings. D3's kit follows 130/131/137 and D4's follows 153/154/160. The critical-path arithmetic is **94 + 148 = 242 minutes remaining**, **266.4 minutes cumulative** including the listed completed/pre-R1 slots. The ancillary active-duration total should be **330.4**, not 332, when summed from the displayed row estimates; this does not affect the critical path.
- Read the six-channel walk Round 3 and K2 Round 6 QA context. The new source-only changes do not invalidate their recorded 234/234 and 12/12 outcomes. They do not supply the pending R1/D3/D4 evidence.

Artifacts: `tree-audit.json`, `host-checks.json`, the six `*-host.log` / `*-golden.log` files, `golden-command-probe.json`, `wave-command-probe.mjs`, `wave-command-probe.log`, and `final-checks.json` in the private directory above. Baseline reconciliation is [LA-E0-02 Round 3](../LA-E0-02/reviewer-b.md). No Docker, stack-starting runner, live HTTP, commit, or other reviewer's file was used. Only the two assigned Reviewer-B reports were edited in integration.

## Round 3

Reviewed 2026-10-24 UTC at QA `a456ca03` / integration `61e3ca97`, limited to the dispatched diff from `1c89e1ca`. **APPROVE: 0 BLOCKER, 0 MAJOR, 1 MINOR, 0 NIT.** B-LA-E7-08-LD9-R8-01, -02 and -03 close. The §10 commands are ready for D3/D4; the minor evidence-table correction below does not hold execution. Approval of the source trees and LD-31 schedule carries forward. This is not live gate acceptance.

| Prior finding | Closure evidence |
| --- | --- |
| **-03, golden normalization** | Ran the exact new Python snippet on private copies of the real candidate capture. A `9643 → 9473 → 9643` round trip preserves all four files byte-for-byte. Compare exits 0 with **297 explained differences, 0 unexplained, 0 expected missing**. Empty, malformed and missing-file inputs each fail; one unexplained field makes compare exit 1. |
| **-01, wave inputs** | Variables are initialized; the manifest uses an array of `{suite, file}` entries and the actual host/e2e summary roots. Ran the exact D3 manifest-generation and pure preflight shell block, and its documented D4 substitutions, against private mock artifact folders containing unchanged real prior summaries. Each produces three PASS results; changing T8's aggregate to FAIL makes each preflight exit 1. QA's negative log also retains the old object-schema rejection and unsupported `--channels` rejection. Readiness remains after 130/131/137 for D3 and 153/154/160 for D4. The walk correctly names T7 run 66. |
| **-02, drill identifiers** | The corrected full commit resolves; the old value fails. The corrected artifact exists, its summary identifies `5603861886909667a03d2aaf7843a9b17a4020ed`, and all 10 aggregate rows pass. The walk's corrected full commit and kit-source commit also resolve. |

Read all 18 positive/negative logs for groups 00–08 under `/Users/quangnguyen/cogniate-qa-runs/LA/REGATE/dry-run-r2/logs/`. They cover source identity, CLI parsing, saved coverage/results, rate extraction, golden comparison, wave production and walk construction. Independently repeated **21 CLI `--help` checks with the documented selection flags** in the prior private clones: all exit 0. These are host command checks against prior evidence, not proof of a new live run. The published heads remain `1ae6716b` / `794f649c`, golden tree remains `1909e58f`, and all three source copies have the same storage identity helper SHA-256 `bc9ecc8b5c8374ac3d73f6a1accc60af7b5d508763424f32ea9a15b38852b1c5` with CLI 29.9.2 / Compose 5.6.1. No source or frozen-test implementation changed in this round; no UNIT AC needs new coverage.

### B-LA-E7-08-LD9-R8-04 — MINOR — Align the dry-run matrix with its cited logs

**File:line:** `tests/ltiaas/GATE-RUN-PLAN.md:1227`, `:1228`, `:1232`.

**Problem / evidence:** The matrix adds details that its logs do not show. Group 01's negative used **`--phase bad-phase`**, not `--sha deadbeef`; its positive prints **admin perMinute 395**, not 399, and does not print the claimed 394-row coverage check. Group 00's negative log records the invalid SHA only, not the separate old-path check. Group 05's positive records G1–G4 sizes **104,405 / 48,309 / 65,331 / 27,278 bytes**, not the four sizes in the table. The relevant positive and negative behaviors are present, and the independent command probes above pass, so this is an evidence-description correction.

**Suggested fix:** Derive the row details from the named logs, or link the additional saved check if it exists. Keep the logs as recorded. No stack rerun is needed.

Independent artifacts: `/tmp/reviewer-b-ld9-r8-r3-g5mxlvp3/` contains `normalizer.py`, `golden-checks.json`, positive/negative compare logs, `wave-{d3,d4}-host.sh`, `wave-checks.json`, the four wave logs, `remaining-checks.json` and 21 CLI logs. Only disposable copies were mutated. [LA-E0-02 Round 4](../LA-E0-02/reviewer-b.md) closes the knob-duration correction but retains the pending baseline finding. No Docker, stack-starting runner, install, commit or other reviewer's file was used; only the two assigned reports were edited in integration.
