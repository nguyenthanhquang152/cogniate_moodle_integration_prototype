Verdict: PENDING host verification
Round: 1

# LA release test tree

This report records the release test assembly for task `task_561809365873`. No product source was read and no Docker command was run.

- Source A: integration `f0b29ecd0ff6c09d5a8afd7af0ff36cb994f2fa5` (later than required `58b81bb2`).
- Source B: `la-final-test-3`, `794f649c3ebacf1a1b3ac599cffffe338dd7373d`, from `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-3`; tests tree `b202c3ee3ef21f6caa7e3a11ec5c8a6daf7aac86`.
- `git diff --stat 794f649c f0b29ecd0ff6c09d5a8afd7af0ff36cb994f2fa5 -- tests` lists **49 files**: **15 A** and **34 B**. Each file comes from exactly one source. No assertion was rewritten for this assembly.
- Evidence directory: `/Users/quangnguyen/cogniate-qa-runs/LA/RELEASE/test-tree-20261025T050300Z`. It contains the original stat, dispatcher diff and retained-run clone comparisons.
- Approval basis: LD-1 deferred row “LD-1 K0 location”, LD-9 addenda r1–r8 (r8 round 3), and LD-32 for the integration dispatcher.

## Evidence keys

D3/D4 summary paths use `/Users/quangnguyen/cogniate-qa-runs/LA/RUN-D3/artifacts/<full-run-id>/summary.json` and `RUN-D4/artifacts/<full-run-id>/summary.json`. These entries identify the executed suite or the frozen source containing the file. A documentation/config/type file is not a separate executable assertion. Unused runner branches are not claimed as new live coverage.

- **M1:** D3 `qalead-la-140-4f10c5fd-2026-10-24T21-07-50-922Z`; D4 `qalead-la-162-4f10c5fd-2026-10-24T20-41-29-861Z` (394 functional cases each).
- **M2:** D3 `qalead-la-138-4f10c5fd-2026-10-24T20-34-52-623Z`; D4 `qalead-la-152-4f10c5fd-2026-10-24T20-38-16-340Z` (64 functional cases each).
- **T7:** D3 `qalead-la-130-4f10c5fd-2026-10-24T19-31-11-287Z`; D4 `qalead-la-153-4f10c5fd-2026-10-24T21-33-32-449Z` (three passes each).
- **T4b:** D3 `qalead-la-134-4f10c5fd-2026-10-24T19-53-27-991Z`; D4 `qalead-la-157-4f10c5fd-2026-10-24T21-55-12-922Z`.
- **T5:** D3 `qalead-la-135-4f10c5fd-2026-10-24T19-59-20-067Z`; D4 `qalead-la-163-4f10c5fd-2026-10-24T22-18-06-366Z` (authorized recovery).
- **T6:** D3 `qalead-la-142-4f10c5fd-2026-10-24T20-27-15-669Z`; D4 `qalead-la-159-4f10c5fd-2026-10-24T22-35-26-435Z`.
- **T8:** D3 `qalead-la-137-4f10c5fd-2026-10-24T20-17-38-466Z`; D4 `qalead-la-160-4f10c5fd-2026-10-24T22-43-01-494Z`.
- **K1:** D3 `qalead-la-144-99338e52-2026-10-24T22-52-13-211Z`; D4 `qalead-la-161-99338e52-2026-10-24T22-59-28-828Z` (195 ledger rows and 196 Vitest tests each).
- **E404:** `qa3-la-e404-r1-48c01495-2026-10-24T15-09-38-141Z`; raw summary under `/Users/quangnguyen/cogniate-qa-runs/LA/qa3-la-e404-r1/artifacts/`.
- **E513:** `qa3-la-e513-r2-4064df6d-2026-10-24T15-43-19-547Z`; raw summary under `/Users/quangnguyen/cogniate-qa-runs/LA/qa3-la-e513-r2/clone/tests/host/artifacts/`.
- **E604:** Host K0 in the `qa3-la-e404-r1` clone: `/Users/quangnguyen/cogniate-qa-runs/LA/qa3-la-e404-r1/logs/e6-04-k0-final-pass.log` (4/4 PASS); no Docker run ID.
- **Carry:** Slot 3F `qalead-la-61-a8bbac53-2026-10-24T05-33-10-379Z` and `qalead-la-62-a8bbac53-2026-10-24T05-38-09-094Z` (12/6 manifest cases), carried under plan §10(c).
- **Host:** Approved gate source and r8 host checks ([r8 §6](./ld9-addendum-r8.md)); release host checks below. No new Docker execution is claimed.

All 13 category-A task files match their retained run-clone files byte for byte (`task-clone-parity.json`). The integration dispatcher matches both retained kit clones. The table uses Git blob hashes, not worktree timestamps.

## Source selection for all 49 files

| File | Source (A or B) | Blob hash | Tested evidence (run IDs above) | Reason |
| --- | --- | --- | --- | --- |
| `tests/acceptance/M1/canvas/11-canvas-platforms.test.ts` | B | `22f05527de198464e44836ee425d1c633b2cea93` | M1 / M2 | LD-1 open-world profiles and approved LA-IC-14 registration assertions. |
| `tests/acceptance/M1/canvas/21-canvas-protocol.test.ts` | B | `36a3ffa818b0721a722996c71438bfdff06b74e3` | M1 | Approved LA-IC-04/06 protocol assertions. |
| `tests/acceptance/M1/canvas/31-canvas-grants.test.ts` | B | `9ee312128498870b83d842275d9fdca74cddd430` | M1 | Approved candidate grant assertions retained from the gate. |
| `tests/acceptance/M1/common/00-profiles.test.ts` | B | `542ca5d3110e74eb1baddc1d903e262426cc1221` | M1 | LD-1 open-world profiles, r5 oracle and LA-IC-23 NRPS value. |
| `tests/acceptance/M1/common/90-simulation-gates.test.ts` | B | `a3041351e9ad69bb928bcc1abd96bc031712994a` | M1 | LD-1 open-world channel/profile gate. |
| `tests/acceptance/M1/common/99-logs.test.ts` | B | `955fc5494a1a7ed4b2ed98bedc62364172b3a066` | M1 | Approved LA-IC-22 event assertions. |
| `tests/acceptance/T4b1/1-connect.spec.ts` | B | `d847f3da411010fa5f4d1f4c9f243ee8149ebdf4` | T4b | Approved candidate scope assertions (LA-IC-23). |
| `tests/acceptance/T5b/1-html.spec.ts` | B | `2cee578308a11e3924fc16293293abd4665bb10d` | T5 | r4 seenPages wait; keep the approved frozen-test timing fix. |
| `tests/acceptance/T6/2-connect.spec.ts` | B | `7c9a07b05e50f28f866a429e2099077356d59ce5` | T6 | Approved LA-IC-23 scope assertions and B/C merge. |
| `tests/acceptance/T6/3-courses.spec.ts` | B | `fb420df9a159f6218ad750a3c2c1f904e0266821` | T6 | Combined r8 B/C and LA legacy course checks. |
| `tests/acceptance/T8/2-shell.spec.ts` | B | `567d1d36d1f670a488c1763ebf0717c8969266dc` | T8 | Combined B/C changes and r7 asynchronous option wait. |
| `tests/acceptance/lib/open-world.d.mts` | B | `d0f6d052bc73fc76cae07582ae84240436635cde` | M1 / M2 / Host | LD-1 round 3 open-world oracle/types; restore the exact gate bytes. |
| `tests/acceptance/lib/open-world.mjs` | B | `8d4c7232fd7432219d90c281983ce544781c1210` | M1 / M2 / Host | LD-1 round 3 open-world oracle/types; restore the exact gate bytes. |
| `tests/acceptance/lib/portal.ts` | B | `4d2efbac94a7909fc983c3b1d469bdf29d952f5d` | T4b / T6 / T8 | Approved portal helper assertions and scopes. |
| `tests/acceptance/run-api.mjs` | A | `5ee913e0ceb7e6b6d0d5629163a562bd7f922b50` | K1 | LD-32 K1 dispatcher; all bytes outside its one dispatch hunk equal the gate. |
| `tests/e2e/M2/01-cards.m2.ts` | B | `7bcdc2e4d61f9ea798d7d30d4a8da4058be944c4` | M2 | LD-1 round 3 card identity, completeness and loading oracle. |
| `tests/e2e/host/run-m2.mjs` | B | `8c282de84f967c59550c19efd90cb75f7e34891b` | M2 / Host | LD-1 discovery and runner overlay used by the M2 gate. |
| `tests/e2e/host/run-t7.mjs` | B | `90168e3d2655eb29dd56e15fa14b35868c8fb864` | T7 | Approved qalead prefix and B/C secret-scan merge. |
| `tests/e2e/lib/steps.ts` | B | `edd890e052b67312426275fc391afcf96a93a278` | T7 | Approved LA-IC-23 scope values in browser steps. |
| `tests/host/core.mjs` | B | `20eb59aee1017842a4e40a0a85740b7ce488a56f` | M1 / M2 / T5 / T8 | Approved qalead-la project-prefix guard. |
| `tests/host/host-control.mjs` | B | `ebfa698561b28f94f00f1ebc298dafad1751c33b` | M1 / T5 | Approved qalead-la project-prefix guard. |
| `tests/host/m1-control.mjs` | B | `435b9a9e2600e24bddb2d3561a8c9cf61118eed1` | M1 / Host | Combined qalead guard and B/C restart control. |
| `tests/host/m1-migration.mjs` | B | `128d2452b102cce8935820e415c51505edea328f` | Carry / Host | LD-24 migration ledgers and approved snapshot-upgrade oracle. |
| `tests/host/p5-fixture.mjs` | B | `87258c90d8ec9af3d13292cce4caebd56a932a49` | T5 | Approved qalead-la fixture guard. |
| `tests/host/run-m1.mjs` | B | `28795049bf69286fb2f587568c0d546f5784138b` | M1 | LD-1 open-world M1 discovery and runner overlay. |
| `tests/host/run-t1.mjs` | B | `a626ec99a813582a8795bfdada9ee23a5bfcc0ab` | Host | Approved runner-prefix bytes in the frozen tree; no T1 acceptance invocation in D3/D4. |
| `tests/host/run-t5.mjs` | B | `878c88d888655a7ddcc1330262d8ade2159c457c` | T5 / T6 | Approved prefix and legacy runner helpers. |
| `tests/host/storage-docker.mjs` | B | `e2a15d865ccfa1965b9dabc2a60dfb36b49849af` | M1 / Host | r6 Docker 29.9.2 / Compose 5.6.1 bound identity and qalead guard. |
| `tests/host/storage-docker.selftest.mjs` | B | `d9977b53b55f16fc9489724527439b2e0d7a8782` | Host | r6 bound-identity self-test constants. |
| `tests/host/storage-fixture-script.mjs` | B | `075d26aa47876147b419448619aad45c2d20d756` | T5 / Host | Approved LA-IC-09 record_dispatch fixture and storage checks. |
| `tests/host/storage-handoff.mjs` | B | `8dd9d507f76c5b3cffc5068d04da98fe1b1c4846` | Host | Approved runner-prefix guard; retain the tested storage harness version. |
| `tests/ltiaas/GATE-RUN-PLAN.md` | A | `253cb297bfe2c288cb917e09c143ad7b10aea92c` | M1 / M2 / T7 / K1 | Evidence and scheduling document, not executable test code; preserve post-gate corrections and LD-32. |
| `tests/ltiaas/k0/ld1/open-world.test.mjs` | B | `d2fa1bcfd10dd7babafbe15ab8f3270bd165a127` | Host | LD-1 round 3 oracle reads the shipped overlay; restore the gate version. |
| `tests/ltiaas/k0/ld1/open-world.test.ts` | B | `aed9af8e1670f878a8b082452381115fa02d467a` | Host | LD-1 round 3 oracle reads the shipped overlay; restore the gate version. |
| `tests/ltiaas/lib/open-world.d.mts` | B | `d0f6d052bc73fc76cae07582ae84240436635cde` | M1 / M2 / Host | LD-1 round 3 open-world oracle/types; restore the exact gate bytes. |
| `tests/ltiaas/lib/open-world.mjs` | B | `8d4c7232fd7432219d90c281983ce544781c1210` | M1 / M2 / Host | LD-1 round 3 open-world oracle/types; restore the exact gate bytes. |
| `tests/ltiaas/tasks-qa/LA-E4-04/README.md` | A | `7ef83ee2424a0848125c111098bdf4ad012f2b3f` | E404 | Preserve independently tested task suite and its README/config; exact match to the retained run clone. |
| `tests/ltiaas/tasks-qa/LA-E4-04/progress-no-dispatch.k1sim.test.ts` | A | `627314fb83420f8908c02a89f4bbf91259fdb640` | E404 | Preserve independently tested task suite and its README/config; exact match to the retained run clone. |
| `tests/ltiaas/tasks-qa/LA-E4-04/run-sim.mjs` | A | `448fd7992e93ab92756a48abaed3217cee2a223a` | E404 | Preserve independently tested task suite and its README/config; exact match to the retained run clone. |
| `tests/ltiaas/tasks-qa/LA-E4-04/tsconfig.json` | A | `fcfa4441433ecddc8b20f00f199c0493c3313fae` | E404 | Preserve independently tested task suite and its README/config; exact match to the retained run clone. |
| `tests/ltiaas/tasks-qa/LA-E4-04/vitest.config.mts` | A | `a7f3116d9337c502027dad060d9547a6a7f552e2` | E404 | Preserve independently tested task suite and its README/config; exact match to the retained run clone. |
| `tests/ltiaas/tasks-qa/LA-E5-13/README.md` | A | `04ee867479d8b4547abb06ee1db0b6df7dad4bb2` | E513 | Preserve independently tested task suite and its README/config; exact match to the retained run clone. |
| `tests/ltiaas/tasks-qa/LA-E5-13/oracle.ts` | A | `665c4c44db9208903f3de77ac0c9cc8313431028` | E513 | Preserve independently tested task suite and its README/config; exact match to the retained run clone. |
| `tests/ltiaas/tasks-qa/LA-E5-13/two-tenant-isolation.k0.test.ts` | A | `068fcd2c7a888524e93f3b180a9ffff1f8329b00` | E513 | Preserve independently tested task suite and its README/config; exact match to the retained run clone. |
| `tests/ltiaas/tasks-qa/LA-E5-13/two-tenant-isolation.k1sim.test.ts` | A | `cec2459e4db6b1a78b132d0e105e2290436ed3e9` | E513 | Preserve independently tested task suite and its README/config; exact match to the retained run clone. |
| `tests/ltiaas/tasks-qa/LA-E6-04/README.md` | A | `d693b449ceb82569c96b3a76b5b1dcc569f20f9b` | E604 | Preserve independently tested task suite and its README/config; exact match to the retained run clone. |
| `tests/ltiaas/tasks-qa/LA-E6-04/connection-check.k0.test.ts` | A | `47d8cb313f9c263ae99b12bd2247be8c2ca13841` | E604 | Preserve independently tested task suite and its README/config; exact match to the retained run clone. |
| `tests/ltiaas/tasks-qa/LA-E6-04/tsconfig.json` | A | `fcfa4441433ecddc8b20f00f199c0493c3313fae` | E604 | Preserve independently tested task suite and its README/config; exact match to the retained run clone. |
| `tests/ltiaas/tasks-qa/LA-E6-04/vitest.config.mts` | A | `cb37fd642cc2a296b1a048164ab217bd53321c63` | E604 | Preserve independently tested task suite and its README/config; exact match to the retained run clone. |

## Dispatcher proof

`git diff 794f649c f0b29ecd -- tests/acceptance/run-api.mjs` has one hunk: four added lines replace three lines. It adds the K1 / LA-E7-06 selector, excludes that selector from the generic LA lookup, applies the same single-suite guard, and selects the kit config. Replacing only those four lines with the three gate lines reproduces the full gate file byte for byte. No other byte differs.

The selected blob is `5ee913e0ceb7e6b6d0d5629163a562bd7f922b50`, identical at `99338e52` and in the actual 144/161 run clones. For every frozen M1/T2–T8 invocation, the K1 selector is false; the gate's M1/default config selection and all remaining execution code are unchanged. Mixed-suite rejection remains in place.

## Fresh-clone verification

Pending. Commit this exact assembly, then use a fresh `git clone --no-hardlinks` and `npm ci` before the required checks. Record the reconciled commit, tests tree, logs, exit codes and counts here. A failed check stops the task; it does not authorize a test change.
