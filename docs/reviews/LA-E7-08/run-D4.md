# Re-gate full run D4 on final SHA `4f10c5fd`

Verdict: PASS for the required functional gate, with failed attempts and host environment findings retained
Round: D4 (`LD-25`, `LD-29`, amended `LD-31`, `LD-32`)
Product SHA: `4f10c5fd9ca4dd0a5f636b34d7454e0db7b6849c`
Test SHA: `la-final-test-3`, `794f649c3ebacf1a1b3ac599cffffe338dd7373d`

## 1. Context and source verification

The Antigravity lead QA 2 session started phase R3-A. Codex GPT-6-Astra xhigh took over both runs at `2026-10-24T20:24:24Z`. The replacement task is `task_958b3033d726`, dispatch `ctx_75c048ff32cd`.

D4 uses `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-3-d4`. Its tracked files are clean and its non-test diff against the product SHA is empty. D3 and D4 have the same tests tree `b202c3ee3ef21f6caa7e3a11ec5c8a6daf7aac86`, golden tree `1909e58f79e5214e7bb349a92811255391aa191c`, and kit tree `d7e50b5dea56382f849b213f006b73bcf5eb71aa`.

D4 uses SIM port `9643`, subnet `172.22.0.0/16`, and Moodle port `9563`, subnet `172.25.0.0/16`. Evidence roots: `RUN-D4/`, the source clone's `tests/host/artifacts/` and `tests/e2e/artifacts/runs/`, and `REGATE/conductor-20261024T202424Z/`, all under `/Users/quangnguyen/cogniate-qa-runs/LA/`.

## 2. Findings and execution changes

- `qalead-la-151-4f10c5fd-2026-10-24T19-34-33-425Z` has 394/394 M1 cases PASS, but the host summary is 399 PASS and 1 FAIL. `M3-ISOLATION` reports five changed containers and four removed volumes from D3 `qalead-la-130` during planned overlap #1. This is a finding. It is not D4's accepted M1 run and is never relabelled PASS.
- The Lead authorized `qalead-la-162` as a solo M1 rerun on the same source, port and subnet. The Lead also moved D3 M1 `qalead-la-140` to solo. All remaining stacks run sequentially. A solo global-state difference limited to named `sto-*` resources is an environment note under TEST-STRATEGY §5.4; any changed LA resource requires escalation.

The solo recovery `qalead-la-162-4f10c5fd-2026-10-24T20-41-29-861Z` completed at `21:05:11.175Z`. All 394 M1 cases passed. The raw host result remains 399 PASS and 1 FAIL (`M3-ISOLATION`). The watcher observed only `qalead-la-162` as an LA project. Teardown left no owned container, volume or network. All 32 protected volume inspect records are unchanged.

The four changed foreign containers were `sto-it-ops-mq-9b357110a0f0`, `sto-it-ops-pg-ab563c98fbdd`, `sto-it-pg-298b51ea9203` and `sto-it-mq-c710b030c711`. Docker events bind each changed anonymous volume to its foreign owner:

| Changed volume | Foreign container |
| --- | --- |
| `5da50ef392866053b2158bcfd67234618a7946cbcfc0dfae21904224c8e7c0d6` | `sto-it-mq-c710b030c711` |
| `c71fee17f4906459c581258183b490c5059395b9a0e6d40963bf5749cfae380e` | `sto-it-pg-298b51ea9203` |
| `a1e08346bd1eb5d469f7da7d216e1b712ec78b22eb95503528ef8e61e122cb25` | `sto-it-ops-pg-ab563c98fbdd` |
| `6d9e9f09eca1cfd0337d7f0025b2721f33f4c03219ab9c6d7ef1fda33407dbc3` | `sto-it-ops-mq-9b357110a0f0` |

This is a TEST-STRATEGY §5.4 environment note under the Lead ruling in `msg_9224d6e3c3af`. It is separate from the rejected LA-overlap finding in `151`. Evidence: `qalead-la-162-isolation-audit.json`, `qalead-la-162-volume-events.json`, `qalead-la-162-foreign-volume-map.json`, and `qalead-la-162-after-protected-check.json` in the conductor record directory.

M2 `qalead-la-152-4f10c5fd-2026-10-24T20-38-16-340Z` passed 64/64 cases, with raw host result 70 PASS / 1 FAIL (`M3-06-M2`: volumes 34→35, containers 2→3). The changed foreign containers were `sto-it-mq-012a22f4da82`, `sto-it-pg-a24697a7a22e` and `sto-it-mq-71c411c1e86f`. It ran alone, left zero owned resources, and preserved all 32 protected records. This is a §5.4 environment note; the raw FAIL is retained. See the 152 isolation and Docker boundary records.

**WE-F14 (D4 T5b AC-T5-30, solo):** `qalead-la-158-4f10c5fd-2026-10-24T22-00-35-103Z` remains FAIL. The AC-T5-30 outage-order test failed at `tests/acceptance/T5b/3-outage.spec.ts:92`: expected the 100-point sync status to contain `sent`; the immediate snapshot contained `pending`, tries 3, with the previous `502 PLATFORM_ERROR`. The preceding Moodle-grade assertion passed with 100. The final no-zero-sent assertion was not reached. The test took about 50.8 s. The relevant Moodle stop/start commands exited 0 in 1966/654 ms.

The trace-derived assertion times are `22:08:02.647596Z` for Moodle 100 and `22:08:02.655770Z` for the failed sync-status assertion. The same sync has a `score_sync` event with status `sent` at `22:08:02.670Z`, about 14 ms later. This is a timing correlation between grade visibility and the sync-state snapshot; the precision does not prove an exact causal clock interval. No wrong Moodle grade or lower-score order result was observed. Saved evidence: `158-AC-T5-30-live-trace/trace.zip`, `158-AC-T5-30-trace-errors.json`, `158-target-sync-events.json`, `158-stop-start-service-events.json` and `158-timing-audit.json` in the conductor directory, plus the complete 158 artifact folder.

Lead message `msg_aafbba130845` authorized one unchanged solo T5a/T5b rerun after cleanup. Recovery `qalead-la-163-4f10c5fd-2026-10-24T22-18-06-366Z` passed all 59 entries and 48 unique IDs, including AC-T5-30. D4 uses 163 for T5a/T5b. Run 158 is never relabelled PASS. This is separate from WE-F12 (P5). Both invocations and the explicit FAIL-to-PASS comparison remain in the records. `WE-F14-test-hashes.json` verifies that the outage spec, T5 helper and host runner are byte-identical in baseline-3, candidate-3, D3 135, D4 158 and recovery 163.


## 3. Complete run table

Start time comes from each full run ID; end time is the original summary write time. Wall time includes setup and teardown. The failed overlap invocation is included and excluded from accepted M1 evidence.

| Suite / project | Full run ID | UTC start–end | Wall time | Recorded counts | Disposition |
| --- | --- | --- | --- | --- | --- |
| Golden G1–G4 / `qalead-la-150` | `qalead-la-150-4f10c5fd-2026-10-24T19-32-16-170Z` | 2026-10-24 19:32:16.170Z–19:34:15.943Z | 119.774 s / 2.00 min | Entries: 9 PASS; unique IDs: 8 PASS; golden compare: 297 approved differences, 0 unexplained, 0 missing | PASS |
| M1 sim (overlap finding) / `qalead-la-151` | `qalead-la-151-4f10c5fd-2026-10-24T19-34-33-425Z` | 2026-10-24 19:34:33.425Z–19:58:58.128Z | 1464.704 s / 24.41 min | Entries: 399 PASS, 1 FAIL; unique IDs: 399 PASS, 1 FAIL; cases 394 PASS / 394 | FAIL finding under planned overlap #1; excluded from accepted M1 evidence; recovered solo in 162. |
| M2 / `qalead-la-152` | `qalead-la-152-4f10c5fd-2026-10-24T20-38-16-340Z` | 2026-10-24 20:38:16.340Z–20:41:12.792Z | 176.452 s / 2.94 min | Entries: 70 PASS, 1 FAIL; unique IDs: 70 PASS, 1 FAIL; cases 64 PASS / 64 | Functional cases PASS; raw host FAIL retained as named foreign-resource environment note (§5.4). |
| M1 sim (solo recovery) / `qalead-la-162` | `qalead-la-162-4f10c5fd-2026-10-24T20-41-29-861Z` | 2026-10-24 20:41:29.861Z–21:05:11.175Z | 1421.314 s / 23.69 min | Entries: 399 PASS, 1 FAIL; unique IDs: 399 PASS, 1 FAIL; cases 394 PASS / 394 | Functional cases PASS; raw host FAIL retained as named foreign-resource environment note (§5.4). |
| T7 × 3 / `qalead-la-153` | `qalead-la-153-4f10c5fd-2026-10-24T21-33-32-449Z` | 2026-10-24 21:33:32.449Z–21:42:34.646Z | 542.198 s / 9.04 min | Host steps 8/8 OK; run 1: 17 PASS, 0 FAIL, 1 SKIP, 176 s (reset 39 s); run 2: 17 PASS, 0 FAIL, 1 SKIP, 180 s (reset 41 s); run 3: 17 PASS, 0 FAIL, 1 SKIP, 178 s (reset 41 s) | PASS |
| T2a, T2b, T3a, T3b / `qalead-la-154` | `qalead-la-154-4f10c5fd-2026-10-24T21-42-54-517Z` | 2026-10-24 21:42:54.517Z–21:51:21.809Z | 507.293 s / 8.45 min | Entries: 76 PASS; unique IDs: 64 PASS | PASS |
| T3c / `qalead-la-155` | `qalead-la-155-4f10c5fd-2026-10-24T21-51-35-350Z` | 2026-10-24 21:51:35.350Z–21:53:29.264Z | 113.915 s / 1.90 min | Entries: 28 PASS; unique IDs: 28 PASS | PASS |
| T4a / `qalead-la-156` | `qalead-la-156-4f10c5fd-2026-10-24T21-53-34-038Z` | 2026-10-24 21:53:34.038Z–21:55:09.211Z | 95.174 s / 1.59 min | Entries: 19 PASS; unique IDs: 15 PASS | PASS |
| T4b1, T4b2 / `qalead-la-157` | `qalead-la-157-4f10c5fd-2026-10-24T21-55-12-922Z` | 2026-10-24 21:55:12.922Z–22:00:30.177Z | 317.256 s / 5.29 min | Entries: 48 PASS; unique IDs: 40 PASS | PASS |
| T5a, T5b / `qalead-la-158` | `qalead-la-158-4f10c5fd-2026-10-24T22-00-35-103Z` | 2026-10-24 22:00:35.103Z–22:17:48.864Z | 1033.761 s / 17.23 min | Entries: 57 PASS, 2 FAIL; unique IDs: 46 PASS, 2 FAIL | FAIL; AC-T5-30 status timing finding (WE-F14); excluded from accepted evidence, recovered solo in 163. |
| T5a, T5b solo recovery (WE-F14) / `qalead-la-163` | `qalead-la-163-4f10c5fd-2026-10-24T22-18-06-366Z` | 2026-10-24 22:18:06.366Z–22:35:11.597Z | 1025.232 s / 17.09 min | Entries: 59 PASS; unique IDs: 48 PASS | PASS |
| T5a, T6 / `qalead-la-159` | `qalead-la-159-4f10c5fd-2026-10-24T22-35-26-435Z` | 2026-10-24 22:35:26.435Z–22:42:41.431Z | 434.996 s / 7.25 min | Entries: 53 PASS; unique IDs: 46 PASS | PASS |
| T8 / `qalead-la-160` | `qalead-la-160-4f10c5fd-2026-10-24T22-43-01-494Z` | 2026-10-24 22:43:01.494Z–22:52:01.794Z | 540.301 s / 9.01 min | Entries: 36 PASS; unique IDs: 23 PASS | PASS |
| Five-channel K1-SIM / `qalead-la-161` | `qalead-la-161-99338e52-2026-10-24T22-59-28-828Z` | 2026-10-24 22:59:28.828Z–23:06:20.635Z | 411.808 s / 6.86 min | Entries: 10 PASS; unique IDs: 10 PASS; kit details in the five-channel ledger below | PASS |

## 4. Frozen suite comparison and golden differences

Both golden captures pass 9/9 entries and 8/8 unique IDs. Their normalized-output secret scans pass: D3 scanned 184 values and D4 scanned 185, with zero hits in each. Each baseline-3 comparison has **297 approved differences, zero unexplained differences and zero missing expected changes**. G1 has 279 changes, G3 has 15, G4 has 3, and G2 has none. The expected files are LA-IC-01 (275), LA-IC-04 (3), LA-IC-12 (3), LA-IC-14 (13), LA-IC-15 (2) and LA-IC-16 (1). The D3 and D4 change maps, including before/after values, match after D3 URL-port normalization from 9473 to 9643 on a separate copy. The original capture stays unchanged. This is an approved change set, not equality to the baseline.

Raw comparisons: `RUN-D3/logs/qalead-la-139-golden-compare.txt` and `RUN-D4/logs/qalead-la-150-compare.txt`. The [per-test-ID table](./per-test-id-D3-D4.md) lists all 297 response paths with their LA-IC file, all 753 group-scoped frozen IDs, the 18 carried migration/snapshot IDs, and both baseline T8 attempts. It preserves every unequal outcome. The original baseline comparison has five unequal IDs: M1 M3-ISOLATION, M2 M3-06-M2, and T8 AC-T8-03, AC-T8-07 and SUITE. The M3 rows are host findings, separate from the 394 M1 and 64 M2 functional cases.

The authorized solo baseline retry `qalead-la-170-78971b03-2026-10-24T23-06-37-809Z` passed AC-T8-03/07 and SUITE. Under TEST-STRATEGY §2.6 and Lead message `msg_b0e9e22a424c`, original run 129 is a **baseline flake finding**, never relabelled PASS. The accepted retry outcomes match D3 and D4; the original FAIL-to-PASS differences remain visible.

Retry time: `2026-10-24T23:06:37.782927+00:00`–`2026-10-24T23:15:27.136251+00:00`; 36 PASS / 0 FAIL entries, 23 PASS / 0 FAIL unique IDs; runner exit 0. Source is unchanged `src-baseline-3` at `1ae6716b`, product `78971b03`, on `9543` / `172.21.0.0/16`. Exact command and Docker records: `qalead-la-170-invocation.json` and `qalead-la-170-before/after-*` in the conductor directory. Raw artifacts: `/Users/quangnguyen/cogniate-qa-runs/LA/REGATE/baseline-t8-retry/artifacts/qalead-la-170-78971b03-2026-10-24T23-06-37-809Z`.

## 5. Five-channel kit and final criteria

Both frozen candidate sources remain at `794f649c3ebacf1a1b3ac599cffffe338dd7373d` (`la-final-test-3`), with clean tracked files and zero non-test diff against product `4f10c5fd9ca4dd0a5f636b34d7454e0db7b6849c`. D3 source: `GATE/src-final-3`; D4 source: `GATE/src-final-3-d4`. The tests tree is `b202c3ee3ef21f6caa7e3a11ec5c8a6daf7aac86`; golden tree is `1909e58f79e5214e7bb349a92811255391aa191c`; kit tree is `d7e50b5dea56382f849b213f006b73bcf5eb71aa`.

LD-32 changes only the kit execution source. Both kits use one fresh clone, `REGATE/kit-src-99338e52`, at `99338e52db0a1f0e1512954482320d45a53e2d8f`. Its product diff against `4f10c5fd` outside tests/docs is empty. Its kit tree is the same `d7e50b5d`. The committed `tests/acceptance/run-api.mjs` SHA-256 is `438b8cc1cc9afc95abb37aa51c26edc8eee661a98a47bfcf4979d01be4e31100`. The gate kit runner is byte-identical to this source's kit runner; SHA-256 `17a9f34b64a27456d7676596364098a199a44585c9cee746fac9a535f7c45eb7`. It uses the already approved gate host harness for the `qalead-la-*` prefix. No gate, frozen test, kit or product source was edited. Proofs: `source-audit.json`, `LD32-kit-source-proof.json`, both kit invocation records and `final-source-audit.json` in the conductor directory.

`qalead-la-161-99338e52-2026-10-24T22-59-28-828Z`: **10/10 host entries and 10/10 unique IDs PASS; 195/195 ledger rows PASS; 196/196 Vitest tests PASS**. The extra Vitest test checks the overall pass rule. Kit run ID: `kit-run-1792882827314-5nq2wx`. There are zero failed, missing, duplicate, retried, skipped or stale rows, zero illegal N/A rows, and zero capability coverage or negative-guard gaps.

| Channel / global checks | Executed ledger rows | Result |
| --- | --- | --- |
| `moodle` | 37/37 | PASS |
| `canvas` | 38/38 | PASS |
| `blackboard` | 39/39 | PASS |
| `lti-generic` | 39/39 | PASS |
| `brightspace` | 39/39 | PASS |
| `GLOBAL` | 3/3 | PASS |

The three global rows are `GLOBAL:K1-LAUNCH:L-FAULTS, GLOBAL:K1-NRPS:N2, GLOBAL:K-HYG:H1`. They are included in 195, not added again. The ledger is not 39 executed tests per channel. `C1` equality, legal N/A handling, `coveredBy`, positive capabilities, negative guards and `K-HYG` pass under the unchanged kit pass rule.

Wave ID `la-final-wave-4f10c5fd-d4` binds this kit to its own T3b, T7 and T8 outputs. See `REGATE/wave-spec-d4.json`, `d4-wave-preflight.json`, and the kit's `kit-run/wave/` and `wave-evidence.json`. The kit summary and execution ledger are in `/Users/quangnguyen/cogniate-qa-runs/LA/RUN-D4/artifacts/qalead-la-161-99338e52-2026-10-24T22-59-28-828Z/kit-run/`.

LD-32 command: `COMPOSE_PROJECT_NAME=qalead-la-161 PUBLIC_PORT=9643 STACK_SUBNET=172.22.0.0/16 LA_WAVE_ID=la-final-wave-4f10c5fd-d4 LA_K1_WAVE_SPEC=/Users/quangnguyen/cogniate-qa-runs/LA/REGATE/wave-spec-d4.json COURSE_FIXTURES_DIR=/Users/quangnguyen/cogniate-qa-runs/LA/GATE/course-fixtures node /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-3/tests/ltiaas/kit/run-k1sim.mjs --sha 99338e52db0a1f0e1512954482320d45a53e2d8f --source /Users/quangnguyen/cogniate-qa-runs/LA/REGATE/kit-src-99338e52 --workdir /Users/quangnguyen/cogniate-qa-runs/LA/REGATE/qalead-la-161-k1sim`. No `--replace-tests` and no `LA_K1_KIT_FROM` were used. The invocation record contains the pre-run grep and all source hashes.

The two candidate kit ledgers have the same 195 case IDs and PASS outcomes. D4 wave inputs are its own T3b 154, T7 153 and T8 160 runs. No D3 wave result substitutes for D4 coverage. D3 kit 141's assembly failure is recorded in [QA §14](./qa.md#14-re-gate-run-d3-on-4f10c5fd); LD-32 applies to both accepted kits.

| Criterion | Final result on `4f10c5fd` | Evidence |
| --- | --- | --- |
| AC-LA-E7-08-01 | PASS functional comparison; raw host findings retained | D3 M1 140 and D4 solo M1 162: 394/394 each. D3 M2 138 and D4 M2 152: 64/64 each. Per-ID outcomes match the baseline for every functional case. Named foreign-resource M3 FAIL rows remain in the reports. D4 overlap 151 is excluded. |
| AC-LA-E7-08-02 | PASS under LD-32 | D3 kit 144 and D4 kit 161: 195/195 ledger rows each, 196/196 Vitest tests each, all five channels pass the unchanged pass rule. Both use the same committed kit and dispatcher source with zero product diff. |
| AC-LA-E7-08-03 | PASS | D3 139 and D4 150: 297 differences each, all approved by named LA-IC expected files; zero unexplained or missing changes. |
| AC-LA-E7-08-04 | PASS functional checks, carried under §10(c) | Migration: 12/12 manifest cases per side; snapshot-upgrade: 6/6 per side. Combined SIM U1 `qalead-la-13-80133d6b-2026-10-23T17-11-52-676Z`: 43 entries (37 PASS, 6 INFO), 17 PASS aggregate IDs. Live U1/U2 `qa-e2e-la-s8b-r1-a7bd110e-2026-10-24T01-31-21-479Z`: 16/16 PASS entries and IDs. Pilot drill `qa-e2e-la-drill-r2-56038618-2026-10-23T20-36-36-947Z`: 10/10 PASS entries and IDs. Full source SHAs, raw paths, baseline M3 FAIL rows and unchanged-file proofs are in [§14.6](./qa.md#146-carried-checks-and-frozenstorage-audits). These are earlier executions, not new D3/D4 runs. |
| AC-LA-E7-08-05 | PASS with approved LD-32 assembly exception | Frozen-source diff contains the approved LD-1, LA-IC, runner and additive simulator changes, with LD-9 addendum r8 round 3 approval by both reviewers. Baseline-3 to candidate has the 12 approved overlay files; five B/C-overlapping files match. Gate sources are unchanged. The kit uses its committed integration dispatcher under LD-32. |
| AC-LA-E7-08-06 | PASS | Diff from exact G-BASE `bd368ff39fb4c533fc105e7c5ee81a59e618d99a` to `4f10c5fd` is empty for stack-data, storage-compat and the storage command sources. |

GATE-RUN-PLAN §10(c) carries the earlier migration, snapshot-upgrade, combined SIM U1, live U1/U2 and pilot backup/restore checks. The corrected U1 evidence is below. These are earlier executions, not new baseline-3, D3 or D4 runs.

| Carried check | Full executed run ID | Source SHA | Raw evidence (absolute path) | Verified count |
| --- | --- | --- | --- | --- |
| Combined SIM U1, both services | `qalead-la-13-80133d6b-2026-10-23T17-11-52-676Z` | Build `80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5`; product matches `02f5d4200e3f27d5eca9530a5aa39840124156ed` | `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-08/slot3b-80133d6b/artifacts/qalead-la-13-80133d6b-2026-10-23T17-11-52-676Z/summary.json` | 43 entries: 37 PASS, 6 INFO, 0 FAIL; 17/17 aggregate IDs PASS. |
| Slot 8b live Moodle U1/U2 | `qa-e2e-la-s8b-r1-a7bd110e-2026-10-24T01-31-21-479Z` | Test build `a7bd110e9c6d504c69a6c0608cbdeef80feff942`; product `8fadb828088ffe1b4db02179ab0fa3ab2388a12a` | `/Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/la-qa/tests/host/artifacts/qa-e2e-la-s8b-r1-a7bd110e-2026-10-24T01-31-21-479Z/summary.json` | 16/16 entries and 16/16 aggregate IDs PASS. |

The combined SIM count includes host and repeated phase entries; it is not a count for two separate service runs. The live count includes preparation, restart, host and continuity rows. [QA §14.6](./qa.md#146-carried-checks-and-frozenstorage-audits) lists the full migration, snapshot and backup run IDs, raw paths, source SHAs and unchanged-file proofs. It also retains the Slot 7 migration/snapshot `M3-ISOLATION` FAIL rows separately from the 12/6 passing functional cases. `carried-diff-proofs.json` and `ac06-G-BASE-proof.json` are in `/Users/quangnguyen/cogniate-qa-runs/LA/REGATE/conductor-20261024T202424Z/`.

The frozen audit is in `ac05-G-BASE-frozen-diff.txt` and its command record. Approved B/C commits included by the final merge are `206ad2b9`, `911219b0`, `97b68af4`, `9eb504f5`, `5561e8f7`, `620c03d0`, `4008afb9`, `958ee5c1`, `f1852601`, `e1a057be` and `fd87bf75` (`bc-merged-commit-list.txt`). This is a file/diff audit; QA did not read product source. The approved test changes are specified in LD-9 addendum r8, round 3, and the earlier addenda.

## 6. Docker boundary and concurrency

The conductor's Docker grant began `2026-10-24T20:24:24Z` and ends `2026-10-25T01:24:24Z`. The final boundary was captured at `2026-10-24T23:16:02.982354+00:00`. All **32/32 protected volume inspect records are unchanged** from takeover and the inherited D3/D4 records. Final inspection found no owned LA container, volume, network or build resource. The before/after records use `umask 077`. Non-LA resources, including `sto-*`, were not changed by this work.

The conductor's ps watcher covers `2026-10-24T20:24:56.080998+00:00`–`2026-10-24T23:15:57.409840+00:00` with 1016 samples. It observed at most one LA project, including build containers attributed to their owner. The independent event file covers `2026-10-24T20:24:56.081787+00:00`–`2026-10-24T23:16:01.860664+00:00` with 99251 events. These are host observations, not a claim that every external event was caused by QA. The 10-second ps samples are supplemented by events and per-run boundary records. M2 runs 138 and 152 ran alone; no other LA stack was starting, seeding or tearing down. Planned overlap #2 was cancelled. All post-takeover workloads stayed sequential.

**Evidence limitation:** no D3 event capture exists for the first approximately 42 seconds of run 130 (`19:31:11.287Z–19:31:53Z`). The inherited D3 event file is empty. Before/after state and protected-volume inspects bound that window. The inherited D4 shared-host watcher covers from `19:31:53Z`; the conductor's independent watchers start at `20:24:56Z`. No event coverage is claimed for the missing window. The Lead accepted this limit in `msg_bc11f7f5fdba`.

The conductor stopped its own watchers and the two orphan D4 watchers after final state capture. `watcher-stop.json` records each verified PID, last record and stop time. `watcher-audit.json`, `final-protected-check.json`, `final-owned-resources.json` and the per-run `*-before/after-*` records are in `/Users/quangnguyen/cogniate-qa-runs/LA/REGATE/conductor-20261024T202424Z/`.
