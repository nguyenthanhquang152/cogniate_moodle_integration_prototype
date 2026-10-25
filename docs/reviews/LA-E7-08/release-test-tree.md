Verdict: PASS after documented QA dependency setup; initial setup error retained
Round: 1

# LA release test tree

This report records the release test assembly for task `task_561809365873`. No product source was read and no Docker command was run.

- Source A: integration `f0b29ecd0ff6c09d5a8afd7af0ff36cb994f2fa5` (later than required `58b81bb2`).
- Source B: `la-final-test-3`, `794f649c3ebacf1a1b3ac599cffffe338dd7373d`, from `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-3`; tests tree `b202c3ee3ef21f6caa7e3a11ec5c8a6daf7aac86`.
- `git diff --stat 794f649c f0b29ecd0ff6c09d5a8afd7af0ff36cb994f2fa5 -- tests` lists **49 files**: **15 A** and **34 B**. Each file comes from exactly one source. No assertion was rewritten for this assembly.
- Evidence directory: `/Users/quangnguyen/cogniate-qa-runs/LA/RELEASE/test-tree-20261025T050300Z`. It contains the original stat, dispatcher diff and retained-run clone comparisons.
- Approval basis: LA-E0-04 (LD-1) [Reviewer-A][ld1-a] and [Reviewer-B][ld1-b], with [QA round 4][ld1-qa]; the LD-9 r1–r8 records and reviews below; the LA-IC lists in [LA-ADR-04 D8][ic-list] and [golden expected records][golden-lists]; the [LA-E0-04 runner-guard approval][guard]; and [LD-32][lead-rules] for the integration dispatcher. The release selections have [Reviewer-A][release-a] and [Reviewer-B][release-b] approval. The deferred row “LD-1 K0 location” explains the planned merge; it is not an approval.

## Scope and approval records

This table covers the **49-file `tests/` difference between the tested gate tree `794f649c` and integration `f0b29ecd`**. It is not the full main-versus-B/C (`78971b03`) test delta. To trace the frozen-test delta, read the [LD-1 overlay review][ld1-b], LD-9 r1–r8 below, and the LA-IC lists: [LA-ADR-04 D8][ic-list], [LA-IC-01][ic01], [LA-IC-04][ic04], [LA-IC-14][ic14], and the LA-IC-06/-09/-22/-23 records named in the rows. LA-IC-04's three NRPS changes are in its `ld9.frozenTestsTouched` list, not an r1–r8 addendum; [LA-E3-07 Reviewer-A][nrps-a] and [Reviewer-B][nrps-b] approve that task.

The wider test delta also includes the [runner guards][guard], the [TEST-STRATEGY §1.2 task selector][selector] (the LA task lookup and parsing change, as well as the later [LD-32 K1 selector][lead-rules]), and additive simulator modules from LA-E7-02 ([A][sim-a], [B][sim-b]) and LA-E7-05 ([A][sim5-a], [B][sim5-b]). New LA suites live under `tests/ltiaas/` and `tests/e2e/ltiaas/`, as the [test strategy][selector] defines. Files already equal in the two source trees do not appear in this table.

| LD-9 record | Approved scope and round | Approval records |
| --- | --- | --- |
| [r1][r1] | WE-F2 / LA-IC-22 log field, WE-F3 / LA-IC-14 registration URL, WE-F5 migration path; patch round 2, source procedure round 3 | [A][r1-a], [B][r1-b] |
| [r2, round 2][r2] | WE-F6 / LA-IC-06 platform-storage login | [A][r2-a], [B][r2-b] |
| [r3, round 1][r3] | WE-F7 / LA-IC-23 Moodle steps data source; WE-F8 legacy publish labels | [A][r3-a], [B][r3-b] |
| [r4, round 1][r4] | WE-F10 `seenPages` wait; WE-F11 publish-dialog loading wait | [A][r4-a], [B][r4-b] |
| [r5, round 3][r5] | LD-1 card oracle and LD-24 migration ledger checks | LA-E0-04 round 4: [A][ld1-a], [B][ld1-b] |
| [r6, round 2][r6] | Bound Docker client identity and evidence correction | [A][r6-a], [B][r6-b] |
| [r7, round 1][r7] | WE-F13 T8 asynchronous option wait | [A][r7-a], [B][r7-b] |
| [r8][r8] and [GATE-RUN-PLAN §10][gate-plan] | B/C merge, gate sources and D3/D4 procedure; final review round 3 | [A][r8-a], [B][r8-b] |

[r8 §1.2][r8] labels `31-canvas-grants` as LA-IC-09 and `run-api.mjs` as LA-IC-22. The correct records are [LA-IC-04][ic04] and the [TEST-STRATEGY §1.2 selector][selector] / [LD-32][lead-rules]. The corrected row mappings below also replace r8's wrong NRPS labels and its extra LA-IC-04 label on `21-canvas-protocol`; the historical r8 record is unchanged.

## Evidence keys

D3/D4 summary paths use `/Users/quangnguyen/cogniate-qa-runs/LA/RUN-D3/artifacts/<full-run-id>/summary.json` and `RUN-D4/artifacts/<full-run-id>/summary.json`. These entries identify the executed suite or the frozen source containing the file. A documentation/config/type file is not a separate executable assertion. Unused runner branches are not claimed as new live coverage.

- **M1:** D3 `qalead-la-140-4f10c5fd-2026-10-24T21-07-50-922Z`; D4 `qalead-la-162-4f10c5fd-2026-10-24T20-41-29-861Z` (394 functional cases each).
- **M2:** D3 `qalead-la-138-4f10c5fd-2026-10-24T20-34-52-623Z`; D4 `qalead-la-152-4f10c5fd-2026-10-24T20-38-16-340Z` (64 functional cases each).
- **T7:** D3 `qalead-la-130-4f10c5fd-2026-10-24T19-31-11-287Z`; D4 `qalead-la-153-4f10c5fd-2026-10-24T21-33-32-449Z` (three runs each; each run has 17 PASS and 1 expected demo SKIP).
- **T4b:** D3 `qalead-la-134-4f10c5fd-2026-10-24T19-53-27-991Z`; D4 `qalead-la-157-4f10c5fd-2026-10-24T21-55-12-922Z`.
- **T5:** D3 `qalead-la-135-4f10c5fd-2026-10-24T19-59-20-067Z`; D4 `qalead-la-163-4f10c5fd-2026-10-24T22-18-06-366Z` (authorized recovery).
- **T6:** D3 `qalead-la-142-4f10c5fd-2026-10-24T20-27-15-669Z`; D4 `qalead-la-159-4f10c5fd-2026-10-24T22-35-26-435Z`.
- **T8:** D3 `qalead-la-137-4f10c5fd-2026-10-24T20-17-38-466Z`; D4 `qalead-la-160-4f10c5fd-2026-10-24T22-43-01-494Z`.
- **K1:** D3 `qalead-la-144-99338e52-2026-10-24T22-52-13-211Z`; D4 `qalead-la-161-99338e52-2026-10-24T22-59-28-828Z` (195 ledger rows and 196 Vitest tests each).
- **E404:** `qa3-la-e404-r1-48c01495-2026-10-24T15-09-38-141Z`; raw summary under `/Users/quangnguyen/cogniate-qa-runs/LA/qa3-la-e404-r1/artifacts/`.
- **E513:** `qa3-la-e513-r2-4064df6d-2026-10-24T15-43-19-547Z`; raw summary under `/Users/quangnguyen/cogniate-qa-runs/LA/qa3-la-e513-r2/clone/tests/host/artifacts/`.
- **E604:** Host K0 in the `qa3-la-e404-r1` clone: `/Users/quangnguyen/cogniate-qa-runs/LA/qa3-la-e404-r1/logs/e6-04-k0-final-pass.log` (4/4 PASS); no Docker run ID.
- **Carry:** Slot 3F `qalead-la-61-a8bbac53-2026-10-24T05-33-10-379Z` and `qalead-la-62-a8bbac53-2026-10-24T05-38-09-094Z` (12/6 manifest cases), carried under plan §10(c).
- **Host:** Approved gate source and r8 host checks ([r8 §3.2](./ld9-addendum-r8.md)); release host checks below. No new Docker execution is claimed.

All 13 category-A task files match their retained run-clone files byte for byte (`task-clone-parity.json`). The integration dispatcher matches both retained kit clones. The table uses Git blob hashes, not worktree timestamps.

## Source selection for all 49 files

| File | Source (A or B) | Blob hash | Tested evidence (run IDs above) | Reason |
| --- | --- | --- | --- | --- |
| `tests/acceptance/M1/canvas/11-canvas-platforms.test.ts` | B | `22f05527de198464e44836ee425d1c633b2cea93` | M1 | [LD-1][ld1-b] open-world providers; [LA-IC-14][ic14] dynamic registration, with [r1 round 2][r1] WE-F3 URL correction. |
| `tests/acceptance/M1/canvas/21-canvas-protocol.test.ts` | B | `36a3ffa818b0721a722996c71438bfdff06b74e3` | M1 | LA-IC-06 platform-storage login returns 200; [r2 round 2][r2]. No NRPS change. |
| `tests/acceptance/M1/canvas/31-canvas-grants.test.ts` | B | `9ee312128498870b83d842275d9fdca74cddd430` | M1 | [LA-IC-04][ic04] `frozenTestsTouched`: remove NRPS from the Canvas JSON scopes; [LA-E3-07 A][nrps-a] / [B][nrps-b]. |
| `tests/acceptance/M1/common/00-profiles.test.ts` | B | `542ca5d3110e74eb1baddc1d903e262426cc1221` | M1 | [LD-1][ld1-b] open-world profiles and [r5 round 3][r5] oracle; [LA-IC-04][ic04] `frozenTestsTouched` changes the Moodle NRPS row. |
| `tests/acceptance/M1/common/90-simulation-gates.test.ts` | B | `a3041351e9ad69bb928bcc1abd96bc031712994a` | M1 | [LD-1][ld1-b] row 8 open-world profile gate; final [LA-E0-04 round 4 approval][ld1-a]. |
| `tests/acceptance/M1/common/99-logs.test.ts` | B | `955fc5494a1a7ed4b2ed98bedc62364172b3a066` | M1 | LA-IC-22 `tool_account_id` event field; [r1 round 2][r1] WE-F2. |
| `tests/acceptance/T4b1/1-connect.spec.ts` | B | `d847f3da411010fa5f4d1f4c9f243ee8149ebdf4` | T4b | [LA-IC-04][ic04] `frozenTestsTouched`: Moodle NRPS row becomes “Do not use this service”; [LA-E3-07 A][nrps-a] / [B][nrps-b]. |
| `tests/acceptance/T5b/1-html.spec.ts` | B | `2cee578308a11e3924fc16293293abd4665bb10d` | T5 | [r4 round 1][r4] WE-F10 `seenPages` wait (BD-A1-116); assertions stay unchanged. |
| `tests/acceptance/T6/2-connect.spec.ts` | B | `7c9a07b05e50f28f866a429e2099077356d59ce5` | T6 | LA-IC-23 Moodle steps data source; [r3 round 1][r3] WE-F7, hunk 3. No B/C merge or scope change in this file. |
| `tests/acceptance/T6/3-courses.spec.ts` | B | `fb420df9a159f6218ad750a3c2c1f904e0266821` | T6 | [r3][r3] WE-F8 publish label and [r4][r4] WE-F11 loading wait; [r8 §2.5][r8] combines them with B/C `e1a057be` / `620c03d0`. |
| `tests/acceptance/T8/2-shell.spec.ts` | B | `567d1d36d1f670a488c1763ebf0717c8969266dc` | T8 | [r3][r3] WE-F8 labels and [r7][r7] WE-F13 option wait; [r8 §2.1][r8] combines them with B/C `e1a057be` / `620c03d0`. |
| `tests/acceptance/lib/open-world.d.mts` | B | `d0f6d052bc73fc76cae07582ae84240436635cde` | M1 / M2 / Host | [LD-1][ld1-b] shared oracle/types and [r5 round 3][r5] card and ledger fixes; [LA-E0-04 round 4 approval][ld1-a]. |
| `tests/acceptance/lib/open-world.mjs` | B | `8d4c7232fd7432219d90c281983ce544781c1210` | M1 / M2 / Host | [LD-1][ld1-b] shared oracle/types and [r5 round 3][r5] card and ledger fixes; [LA-E0-04 round 4 approval][ld1-a]. |
| `tests/acceptance/lib/portal.ts` | B | `4d2efbac94a7909fc983c3b1d469bdf29d952f5d` | T4b / T6 / T8 | LA-IC-23 Moodle steps data source; [r3 round 1][r3] WE-F7, hunk 2. Assertions stay unchanged. |
| `tests/acceptance/run-api.mjs` | A | `5ee913e0ceb7e6b6d0d5629163a562bd7f922b50` | K1 | [TEST-STRATEGY §1.2][selector] / [LD-32][lead-rules] K1 dispatcher; all bytes outside its one dispatch hunk equal the gate. |
| `tests/e2e/M2/01-cards.m2.ts` | B | `7bcdc2e4d61f9ea798d7d30d4a8da4058be944c4` | M2 | [LD-1][ld1-b] row 6; [r5 round 3][r5] card identity, completeness and loading oracle, approved in [LA-E0-04 round 4][ld1-a]. |
| `tests/e2e/host/run-m2.mjs` | B | `8c282de84f967c59550c19efd90cb75f7e34891b` | M2 / Host | [LD-1][ld1-b] row 2 simulation-profile gate and discovery overlay; final [LA-E0-04 round 4 approval][ld1-a]. |
| `tests/e2e/host/run-t7.mjs` | B | `90168e3d2655eb29dd56e15fa14b35868c8fb864` | T7 | [LA-E0-04 qalead guard][guard]; [r8 §2.4][r8] combines it with B/C `97b68af4` secret scanning. |
| `tests/e2e/lib/steps.ts` | B | `edd890e052b67312426275fc391afcf96a93a278` | T7 | LA-IC-23 Moodle steps data source; [r3 round 1][r3] WE-F7, hunk 1. No scope change. |
| `tests/host/core.mjs` | B | `20eb59aee1017842a4e40a0a85740b7ce488a56f` | M1 / M2 / T5 / T8 | [LA-E0-04 runner-prefix approval][guard] (AC-LA-E7-08-05); permit the qalead-la project prefix. |
| `tests/host/host-control.mjs` | B | `ebfa698561b28f94f00f1ebc298dafad1751c33b` | M1 / T5 | [LA-E0-04 runner-prefix approval][guard] (AC-LA-E7-08-05); permit the qalead-la project prefix. |
| `tests/host/m1-control.mjs` | B | `435b9a9e2600e24bddb2d3561a8c9cf61118eed1` | M1 / Host | [LA-E0-04 qalead guard][guard]; [r8 §2.2][r8] combines it with B/C `9eb504f5` restart control. |
| `tests/host/m1-migration.mjs` | B | `128d2452b102cce8935820e415c51505edea328f` | Carry / Host | [LA-E0-04 H21][guard] candidate ledger; [r1][r1] WE-F5 path fix; [LD-24][lead-rules] / [r5 round 3][r5] historical-prefix and snapshot-upgrade oracle. |
| `tests/host/p5-fixture.mjs` | B | `87258c90d8ec9af3d13292cce4caebd56a932a49` | T5 | [LA-E0-04 runner-prefix approval][guard] (AC-LA-E7-08-05); permit the qalead-la project prefix. |
| `tests/host/run-m1.mjs` | B | `28795049bf69286fb2f587568c0d546f5784138b` | M1 | [LD-1][ld1-b] row 3 open-world default-profile gate and discovery overlay; final [LA-E0-04 round 4 approval][ld1-a]. |
| `tests/host/run-t1.mjs` | B | `a626ec99a813582a8795bfdada9ee23a5bfcc0ab` | Host | [LA-E0-04 runner-prefix approval][guard]; no T1 acceptance invocation in D3/D4. |
| `tests/host/run-t5.mjs` | B | `878c88d888655a7ddcc1330262d8ade2159c457c` | T5 / T6 | [LA-E0-04 runner-prefix approval][guard] (AC-LA-E7-08-05); permit the qalead-la project prefix. |
| `tests/host/storage-docker.mjs` | B | `e2a15d865ccfa1965b9dabc2a60dfb36b49849af` | M1 / Host | [r6 round 2][r6] Docker 29.9.2 / Compose 5.6.1 bound identity; [LA-E0-04 prefix guard][guard]. |
| `tests/host/storage-docker.selftest.mjs` | B | `d9977b53b55f16fc9489724527439b2e0d7a8782` | Host | [r6 round 2][r6] bound-identity self-test constants. |
| `tests/host/storage-fixture-script.mjs` | B | `075d26aa47876147b419448619aad45c2d20d756` | T5 / Host | [LA-ADR-04 D8 / LA-IC-09][ic-list] `record_dispatch` fixture; [LA-E0-04 H29 approval][guard] under LD-6, with failed-row checks retained. |
| `tests/host/storage-handoff.mjs` | B | `8dd9d507f76c5b3cffc5068d04da98fe1b1c4846` | Host | [LA-E0-04 runner-prefix approval][guard]; retain the tested storage harness version. |
| `tests/ltiaas/GATE-RUN-PLAN.md` | A | `253cb297bfe2c288cb917e09c143ad7b10aea92c` | M1 / M2 / T7 / K1 | [r8 round 3 A][r8-a] / [B][r8-b] procedure and [LD-32][lead-rules] kit source; post-gate evidence corrections retained and [release A][release-a] / [B][release-b] approved. This is a plan, not executable code. |
| `tests/ltiaas/k0/ld1/open-world.test.mjs` | B | `d2fa1bcfd10dd7babafbe15ab8f3270bd165a127` | Host | [r5 round 3][r5] LD-1 DOM and ledger probes read the shipped overlay; [LA-E0-04 round 4 A][ld1-a] / [B][ld1-b]. |
| `tests/ltiaas/k0/ld1/open-world.test.ts` | B | `aed9af8e1670f878a8b082452381115fa02d467a` | Host | [r5 round 3][r5] LD-1 DOM and ledger probes read the shipped overlay; [LA-E0-04 round 4 A][ld1-a] / [B][ld1-b]. |
| `tests/ltiaas/lib/open-world.d.mts` | B | `d0f6d052bc73fc76cae07582ae84240436635cde` | M1 / M2 / Host | [LD-1][ld1-b] shared oracle/types and [r5 round 3][r5] card and ledger fixes; [LA-E0-04 round 4 approval][ld1-a]. |
| `tests/ltiaas/lib/open-world.mjs` | B | `8d4c7232fd7432219d90c281983ce544781c1210` | M1 / M2 / Host | [LD-1][ld1-b] shared oracle/types and [r5 round 3][r5] card and ledger fixes; [LA-E0-04 round 4 approval][ld1-a]. |
| `tests/ltiaas/tasks-qa/LA-E4-04/README.md` | A | `7ef83ee2424a0848125c111098bdf4ad012f2b3f` | E404 | LA-E4-04 [A][e404-a] / [B][e404-b] and [QA][e404-qa]; preserve the independently tested suite and README/config, with an exact retained-run clone match. |
| `tests/ltiaas/tasks-qa/LA-E4-04/progress-no-dispatch.k1sim.test.ts` | A | `627314fb83420f8908c02a89f4bbf91259fdb640` | E404 | LA-E4-04 [A][e404-a] / [B][e404-b] and [QA][e404-qa]; preserve the independently tested suite and README/config, with an exact retained-run clone match. |
| `tests/ltiaas/tasks-qa/LA-E4-04/run-sim.mjs` | A | `448fd7992e93ab92756a48abaed3217cee2a223a` | E404 | LA-E4-04 [A][e404-a] / [B][e404-b] and [QA][e404-qa]; preserve the independently tested suite and README/config, with an exact retained-run clone match. |
| `tests/ltiaas/tasks-qa/LA-E4-04/tsconfig.json` | A | `fcfa4441433ecddc8b20f00f199c0493c3313fae` | E404 | LA-E4-04 [A][e404-a] / [B][e404-b] and [QA][e404-qa]; preserve the independently tested suite and README/config, with an exact retained-run clone match. |
| `tests/ltiaas/tasks-qa/LA-E4-04/vitest.config.mts` | A | `a7f3116d9337c502027dad060d9547a6a7f552e2` | E404 | LA-E4-04 [A][e404-a] / [B][e404-b] and [QA][e404-qa]; preserve the independently tested suite and README/config, with an exact retained-run clone match. |
| `tests/ltiaas/tasks-qa/LA-E5-13/README.md` | A | `04ee867479d8b4547abb06ee1db0b6df7dad4bb2` | E513 | LA-E5-13 [A][e513-a] / [B][e513-b] and [QA][e513-qa]; preserve the independently tested suite and README/config, with an exact retained-run clone match. |
| `tests/ltiaas/tasks-qa/LA-E5-13/oracle.ts` | A | `665c4c44db9208903f3de77ac0c9cc8313431028` | E513 | LA-E5-13 [A][e513-a] / [B][e513-b] and [QA][e513-qa]; preserve the independently tested suite and README/config, with an exact retained-run clone match. |
| `tests/ltiaas/tasks-qa/LA-E5-13/two-tenant-isolation.k0.test.ts` | A | `068fcd2c7a888524e93f3b180a9ffff1f8329b00` | E513 | LA-E5-13 [A][e513-a] / [B][e513-b] and [QA][e513-qa]; preserve the independently tested suite and README/config, with an exact retained-run clone match. |
| `tests/ltiaas/tasks-qa/LA-E5-13/two-tenant-isolation.k1sim.test.ts` | A | `cec2459e4db6b1a78b132d0e105e2290436ed3e9` | E513 | LA-E5-13 [A][e513-a] / [B][e513-b] and [QA][e513-qa]; preserve the independently tested suite and README/config, with an exact retained-run clone match. |
| `tests/ltiaas/tasks-qa/LA-E6-04/README.md` | A | `d693b449ceb82569c96b3a76b5b1dcc569f20f9b` | E604 | LA-E6-04 [A][e604-a] / [B][e604-b] and [QA][e604-qa]; preserve the independently tested suite and README/config, with an exact retained-run clone match. |
| `tests/ltiaas/tasks-qa/LA-E6-04/connection-check.k0.test.ts` | A | `47d8cb313f9c263ae99b12bd2247be8c2ca13841` | E604 | LA-E6-04 [A][e604-a] / [B][e604-b] and [QA][e604-qa]; preserve the independently tested suite and README/config, with an exact retained-run clone match. |
| `tests/ltiaas/tasks-qa/LA-E6-04/tsconfig.json` | A | `fcfa4441433ecddc8b20f00f199c0493c3313fae` | E604 | LA-E6-04 [A][e604-a] / [B][e604-b] and [QA][e604-qa]; preserve the independently tested suite and README/config, with an exact retained-run clone match. |
| `tests/ltiaas/tasks-qa/LA-E6-04/vitest.config.mts` | A | `cb37fd642cc2a296b1a048164ab217bd53321c63` | E604 | LA-E6-04 [A][e604-a] / [B][e604-b] and [QA][e604-qa]; preserve the independently tested suite and README/config, with an exact retained-run clone match. |

## Dispatcher proof

`git diff 794f649c f0b29ecd -- tests/acceptance/run-api.mjs` has one hunk: four added lines replace three lines. It adds the K1 / LA-E7-06 selector, excludes that selector from the generic LA lookup, applies the same single-suite guard, and selects the kit config. Replacing only those four lines with the three gate lines reproduces the full gate file byte for byte. No other byte differs.

The selected blob is `5ee913e0ceb7e6b6d0d5629163a562bd7f922b50`, identical at `99338e52` and in the actual 144/161 run clones. For every frozen M1/T2–T8 invocation, the K1 selector is false; the gate's M1/default config selection and all remaining execution code are unchanged. Mixed-suite rejection remains in place.

## Fresh-clone verification

Reconciled test commit: **`5821ab31cac9a98652a6c3ff7d59fbdfdb7df578`**. Tests tree: **`023ecdab70eea5fa689f6da736b6fb236f32b64c`**. The verification report commit changes only this document; it does not change the checked tests tree.

Fresh clone: `/Users/quangnguyen/cogniate-qa-runs/LA/RELEASE/test-tree-20261025T050300Z/clone`. Created with `git clone --no-hardlinks --no-checkout`, then detached at the reconciled commit. Node `24.21.0`; npm `11.19.0`. All times below are UTC on **2026-10-25**. `check-results.json` in the evidence directory records exact argument lists, environment overrides, start/end times and exit codes. All host tests use local or mocked operations; no Docker or live provider check was run.

| Command | Start–end (UTC) | Wall time | Exit | Result | Log relative to evidence directory |
| --- | --- | --- | --- | --- | --- |
| `npm ci` | 05:05:04.641–05:05:06.607 | 1.966 s | 0 | PASS; root dependencies installed. | `logs/npm-ci.log` |
| `npm run check` | 05:05:06.607–05:06:46.643 | 100.036 s | 0 | PASS: lint and typecheck; 204 unit files, 3,324 tests PASS and 5 SKIP; 255 infra tests PASS; 151 K0 tests PASS, including the LD-1 TypeScript suite; F1 0 hits; F5 6 rules, 0 hits. | `logs/npm-check.log` |
| `LA_LEVEL=k0 npx --no-install vitest run --config tests/ltiaas/kit/vitest.config.mts` | 05:06:46.644–05:06:47.887 | 1.243 s | 0 | 33/33 PASS. | `logs/kit-k0.log` |
| `node --test tests/ltiaas/golden/golden.k0.test.mjs` | 05:06:47.888–05:06:48.542 | 0.655 s | 0 | 12/12 PASS. | `logs/golden-k0.log` |
| `node --test tests/host/*.selftest.mjs` (all 15 files) | 05:06:48.543–05:18:14.555 | 686.012 s | 0 | 155/155 PASS; 0 skips. | `logs/host-selftests.log` |
| `node --test tests/ltiaas/k0/ld1/open-world.test.mjs` | 05:18:14.556–05:18:14.644 | 0.089 s | 0 | 46/46 PASS; 0 skips. | `logs/ld1-node.log` |
| `node tests/e2e/host/run-m2.mjs --harness-only` (initial) | 05:18:14.645–05:18:16.489 | 1.844 s | 1 | STOP: 6/6 preliminary tests PASS, then Playwright ENOENT before discovery; retained exit 1. | `logs/m2-harness.log` |
| `npm ci --prefix tests` | 05:19:53.642–05:19:54.710 | 1.068 s | 0 | PASS; separate QA project installed under Lead authorization; lockfile unchanged. | `logs/npm-ci-tests.log` |
| `node tests/e2e/host/run-m2.mjs --harness-only` (after setup) | 05:19:54.711–05:19:57.868 | 3.157 s | 0 | PASS: 6/6 self-tests; all 64 M2 browser cases discovered; T7 selection unchanged. | `logs/m2-harness-after-setup.log` |
| `node tests/e2e/ltiaas/run-k2.mjs --harness-only` | 05:19:57.868–05:20:02.668 | 4.800 s | 0 | PASS: 7/7 self-tests; 12 K2 cases plus 2 R2-sim cases discovered; T7/M2/T6/T5a/T8 selections unchanged. | `logs/k2-harness.log` |

**Setup finding retained:** The initial M2 command stopped at `tests/e2e/host/run-m2.mjs:45:10` with `spawn /Users/quangnguyen/cogniate-qa-runs/LA/RELEASE/test-tree-20261025T050300Z/clone/tests/node_modules/.bin/playwright ENOENT` (`-1 !== 0`). K2 did not start in that attempt. Escalation `msg_1ca14f2edf31` reported it. The Lead's `msg_e1236eacbff1` identified the documented separate QA project setup in `infra/README.md:324` and authorized `npm ci --prefix tests`, followed by the two discovery checks. The first M2 result remains exit 1; the after-setup result is a separate invocation. No test was changed to obtain PASS.

For a new clone, install both dependency projects before discovery: `npm ci` and `npm ci --prefix tests`. The tests lockfile stayed byte-identical across the install and discovery checks:

- `tests/package-lock.json` Git blob: `e7d47cf7dce533086046df3d62d7fea903f3bb8d`.
- SHA-256 before and after: `213718dd93bffd95041508dcfdc655f19201b3192d5f7d13b494b7e1d69356bc`.
- Proof: `tests-lock-proof.json`; final clone status is empty in `final-clone-state.json`.

## Final source proof

`git diff 5821ab31cac9a98652a6c3ff7d59fbdfdb7df578 794f649c3ebacf1a1b3ac599cffffe338dd7373d -- tests` contains **exactly the 15 category-A files** in the selection table. All **34 category-B files** have the gate blob hash. All **49 selected files** have their chosen A/B hash in the reconciled commit. `source-proof.json` records each comparison; `reconciled-gate-stat.txt` records the remaining delta.

The kit tree remains `d7e50b5dea56382f849b213f006b73bcf5eb71aa`; the golden tree remains `1909e58f79e5214e7bb349a92811255391aa191c`. Both equal the gate. The diff from source A to the reconciled commit is empty outside tests/docs. The fresh clone has empty `git status --porcelain` output after all checks. This result is ready for independent review and Lead integration; it does not publish or change main.

[ld1-a]: ../LA-E0-04/reviewer-a.md#round-4
[ld1-b]: ../LA-E0-04/reviewer-b.md#round-4
[ld1-qa]: ../LA-E0-04/qa.md
[guard]: ../LA-E0-04/reviewer-b.md#decisions-by-part
[ic-list]: ../../architecture/ltiaas/adr/LA-ADR-04-refactor-and-migration.md#d8-intended-behaviour-changes-ids-la-ic-nn
[golden-lists]: ../../../tests/ltiaas/golden/expected/
[lead-rules]: ../../team/ltiaas/plan.md
[release-a]: ../LA-RELEASE/reviewer-a.md
[release-b]: ../LA-RELEASE/reviewer-b.md
[selector]: ../../../tests/ltiaas/TEST-STRATEGY.md#12-who-writes-what-and-file-ownership
[gate-plan]: ../../../tests/ltiaas/GATE-RUN-PLAN.md
[nrps-a]: ../LA-E3-07/reviewer-a.md
[nrps-b]: ../LA-E3-07/reviewer-b.md
[sim-a]: ../LA-E7-02/reviewer-a.md
[sim-b]: ../LA-E7-02/reviewer-b.md
[sim5-a]: ../LA-E7-05/reviewer-a.md
[sim5-b]: ../LA-E7-05/reviewer-b.md
[ic01]: ../../../tests/ltiaas/golden/expected/LA-IC-01.json
[ic04]: ../../../tests/ltiaas/golden/expected/LA-IC-04.json
[ic14]: ../../../tests/ltiaas/golden/expected/LA-IC-14.json
[r1]: ./ld9-addendum-r1.md#round-2
[r1-a]: ./ld9-addendum-r1-reviewer-a.md#round-3
[r1-b]: ./ld9-addendum-r1-reviewer-b.md#round-3
[r2]: ./ld9-addendum-r2.md#round-2
[r2-a]: ./ld9-addendum-r2-reviewer-a.md#round-2
[r2-b]: ./ld9-addendum-r2-reviewer-b.md#round-2
[r3]: ./ld9-addendum-r3.md
[r3-a]: ./ld9-addendum-r3-reviewer-a.md
[r3-b]: ./ld9-addendum-r3-reviewer-b.md
[r4]: ./ld9-addendum-r4.md
[r4-a]: ./ld9-addendum-r4-reviewer-a.md
[r4-b]: ./ld9-addendum-r4-reviewer-b.md
[r5]: ./ld9-addendum-r5.md
[r6]: ./ld9-addendum-r6.md#round-2
[r6-a]: ./ld9-addendum-r6-reviewer-a.md#round-2
[r6-b]: ./ld9-addendum-r6-reviewer-b.md#round-2
[r7]: ./ld9-addendum-r7.md
[r7-a]: ./ld9-addendum-r7-reviewer-a.md
[r7-b]: ./ld9-addendum-r7-reviewer-b.md
[r8]: ./ld9-addendum-r8.md
[r8-a]: ./ld9-addendum-r8-reviewer-a.md#round-3
[r8-b]: ./ld9-addendum-r8-reviewer-b.md#round-3
[e404-a]: ../LA-E4-04/reviewer-a.md
[e404-b]: ../LA-E4-04/reviewer-b.md
[e404-qa]: ../LA-E4-04/qa.md
[e513-a]: ../LA-E5-13/reviewer-a.md
[e513-b]: ../LA-E5-13/reviewer-b.md
[e513-qa]: ../LA-E5-13/qa.md
[e604-a]: ../LA-E6-04/reviewer-a.md
[e604-b]: ../LA-E6-04/reviewer-b.md
[e604-qa]: ../LA-E6-04/qa.md
