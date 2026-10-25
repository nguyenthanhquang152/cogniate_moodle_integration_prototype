Verdict: APPROVE
Round: 2

# LA release test tree: Reviewer-A (lens "Is it right and is it safe?")

- Reviewer: Reviewer-A, Claude Code Opus 5.5 xhigh, fresh session (LA-H28). Blind review: I did not open `reviewer-b.md`.
- Item: integration `52a9d8b4` (la-qa `5821ab31` + `b7dbd771`). Diff: `git diff 0bf4e1de 52a9d8b4 -- tests docs/reviews/LA-E7-08/release-test-tree.md` (34 tests files and the table). Release tests tree `023ecdab70eea5fa689f6da736b6fb236f32b64c`.
- Gate: `la-final-test-3` `794f649c` (tests tree `b202c3ee`), fetched from `~/cogniate-qa-runs/LA/GATE/src-final-3`. `src-final-3-d4` has the same commit and root tree `847a3e0b`.
- Private clone: `~/cogniate-qa-runs/LA/RELEASE-REVIEW/reviewer-a-20261025T053341Z/clone` (`git clone --no-hardlinks`, detached at `52a9d8b4`). Logs: `../logs/`.
- Safety: no Docker. A fail-closed `docker` stub was first on `PATH` for all checks; it recorded 0 calls. I changed no file except this review. I did not commit.

## Summary

**0 BLOCKER, 0 MAJOR, 2 MINOR, 3 NIT.**

The release tests tree is right. Each of the 34 category-B files has the gate blob. Each of the 15 category-A files has the integration blob that was tested. No other `tests/` file changes. The product diff against `4f10c5fd` outside `docs/` and `tests/` is 0 lines. All host checks pass in my clone. Every frozen-test change traces to an approved record. The `run-api.mjs` dispatcher hunk cannot change a frozen-suite run.

The findings are about the records, not the tree. The table names the wrong `LA-IC` for 7 rows, and its approval basis omits the LA-IC lists (A-LA-REL-01). After this merge, the deferred row "LD-1 K0 location" is false on main (A-LA-REL-02). Both are cheap to fix. I recommend that the Lead fixes them before the publish to main, but they do not block.

## Checks

| # | Check | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Category B = gate | PASS | For each of the 34 B paths, `git rev-parse 52a9d8b4:<path>` = `git rev-parse 794f649c:<path>` (34/34). All 49 table hashes equal the actual blobs at `52a9d8b4` (49/49). No post-gate integration change is lost: at `0bf4e1de` all 34 B paths had the `4f10c5fd` frozen version (32 same blob; `tests/acceptance/lib/open-world.{mjs,d.mts}` absent in both). |
| 2 | Category A = tested integration version | PASS | 15/15 A blobs at `52a9d8b4` = `0bf4e1de` (= `f0b29ecd`; `git diff f0b29ecd 0bf4e1de -- tests` is empty). `git hash-object` on the retained run clones: the 5 E404 and 4 E604 files = `qa3-la-e404-r1/clone`; the 7 E513 files = `qa3-la-e513-r2/clone` (16/16 equal, which includes 3 E513 files that the gate already had). `run-api.mjs` blob `5ee913e0` = `4f10c5fd` = `99338e52` = `REGATE/kit-src-99338e52` (the K1 clone of runs 144 and 161). See A-LA-REL-03 for the product SHA of the E404/E604 evidence. |
| 2a | Dispatcher only | PASS | `git diff 794f649c 52a9d8b4 -- tests/acceptance/run-api.mjs`: one hunk, lines 10–13. When `QA_TASK` has neither `K1` nor `LA-E7-06`, `k1` is `false`. Then `la = !k1 && find(…)` gives the same value as the gate `find(…)` (`undefined` or the task id), `(k1 \|\| la) && …` is the gate guard, and `config` takes the gate branch. No frozen M1, T2–T8 or M2 invocation uses `K1` or `LA-E7-06`. The M1 mixed-suite throw at line 9 runs first and is unchanged. So the frozen suites run the D3/D4 code. |
| 3 | No other change | PASS | `git diff --name-only 794f649c 52a9d8b4 -- tests` = exactly the 15 A files. `git diff --name-only 0bf4e1de 52a9d8b4` = the 34 B files + the table. `git diff 4f10c5fd 52a9d8b4 -- . ':!docs' ':!tests' \| wc -l` = 0. Same for `0bf4e1de..52a9d8b4` and for `794f649c..52a9d8b4` = 0. `tests/package.json` and `tests/package-lock.json` do not change. |
| 4 | Host checks in my clone | PASS | See the table below. |
| 5 | Each frozen change traces to an approved record | PASS | See "Traceability" below. The approvals exist for every changed hunk. The table cites some of them wrongly (A-LA-REL-01). |
| 6 | Lens B: can a maintainer see why main differs from B/C | PASS with findings | The table explains each file. The table labels (A-LA-REL-01) and the deferred row (A-LA-REL-02) need a fix. |

### Host checks (Node 24.21.0, npm 11.19.0, 2026-10-25 UTC)

| Command | Exit | Result | Log |
| --- | --- | --- | --- |
| `npm ci` | 0 | dependencies installed | `npm-ci.log` |
| `npm run check` | 0 | lint and typecheck PASS; unit 204 files, 3,324 PASS, 5 SKIP; infra 255/255; K0 151/151 (includes the LD-1 TypeScript suite); F1 0 hits; F5 6 rules, 0 hits | `npm-check.log` |
| `LA_LEVEL=k0 npx --no-install vitest run --config tests/ltiaas/kit/vitest.config.mts` | 0 | 33/33 PASS | `kit-k0.log` |
| `node --test tests/ltiaas/golden/golden.k0.test.mjs` | 0 | 12/12 PASS | `golden-k0.log` |
| `node --test tests/ltiaas/k0/ld1/open-world.test.mjs` | 0 | 46/46 PASS | `ld1-node.log` |
| `npx --no-install vitest run --config tests/ltiaas/k0/vitest.config.mts tests/ltiaas/k0/ld1` | 0 | 46/46 PASS | `ld1-ts.log` |
| `npx --no-install vitest run --config tests/ltiaas/tasks-qa/LA-E6-04/vitest.config.mts` (extra) | 0 | 4/4 PASS on the release tree | `e604-k0.log` |
| `LA_LEVEL=k0 npx --no-install vitest run --config tests/ltiaas/tasks-qa/LA-E5-13/vitest.config.mts` (extra) | 0 | 6/6 PASS on the release tree | `e513-k0.log` |
| `node --test tests/host/*.selftest.mjs` (15 files) | 0 | 155/155 PASS, 0 skips (05:37:49–05:49:25, about 696 s) | `host-selftests.log` |
| `npm ci --prefix tests` (extra, infra/README.md:324) | 0 | QA project installed; `tests/package-lock.json` blob still `e7d47cf7` | `npm-ci-tests.log` |
| `node tests/e2e/host/run-m2.mjs --harness-only` (extra) | 0 | 6/6 self-tests; 64 M2 browser cases discovered; T7 selection unchanged | `m2-harness.log` |
| `node tests/e2e/ltiaas/run-k2.mjs --harness-only` (extra) | 0 | 7/7 self-tests; 12 K2 + 2 R2-sim cases discovered; T7, M2, T6, T5a/T8 selections unchanged | `k2-harness.log` |

After all checks, `git status --porcelain` in the clone is empty, and the Docker stub log does not exist (0 calls).

### Traceability (check 5)

The chain of approved gate sources:

1. `la-final-test-1` `85ddf973`: LD-1 round 3 overlay and addenda r1–r5. LA-E0-04 Round 4 verified it live (`docs/reviews/LA-E0-04/qa.md:10`; reviewer-a and reviewer-b APPROVE, Round 4).
2. `la-final-test-2` `68b2e909` = (1) + r6 + r7. `git diff --stat 85ddf973 68b2e909 -- tests` changes only `tests/host/storage-docker.mjs`, `tests/host/storage-docker.selftest.mjs` (r6) and `tests/acceptance/T8/2-shell.spec.ts` (r7).
3. `la-final-test-3` `794f649c` = `4f10c5fd` + the (2) overlay + r8 (+ golden v2, LD-30 kit).

Result for the 34 B files:

- 30 B files have the same blob as `la-final-test-2`.
- The other 4 files (`T6/3-courses.spec.ts`, `T8/2-shell.spec.ts`, `e2e/host/run-t7.mjs`, `host/m1-control.mjs`) are the r8 combination. I applied `~/cogniate-qa-runs/LA/ld9-addendum-r8/ld9-addendum-r8.patch` (SHA-256 `ddf3f1c3…c514`, the same as the r8 record) to the 4 `4f10c5fd` files. All 4 results equal the release blobs.

| Change (hunk) | Files | Approved record |
| --- | --- | --- |
| LD-1 open-world rewrite | `M1/common/00-profiles` (rows 1–2), `90-simulation-gates`, `canvas/11-canvas-platforms` (row 7), `acceptance/lib/open-world.*`, `ltiaas/lib/open-world.*`, `M2/01-cards`, `e2e/host/run-m2.mjs`, `host/run-m1.mjs`, `k0/ld1/*` | LA-E0-04 R1–R4; r5 (BD-A1-119) |
| LA-IC-04 NRPS scope removal | `canvas/31-canvas-grants:114-119`, `common/00-profiles:104`, `T4b1/1-connect:118` (release-tree lines; the LA-IC-04 record cites the integration lines of its time) | `tests/ltiaas/golden/expected/LA-IC-04.json` `ld9.frozenTestsTouched` (exactly these 3); LA-E3-07 reviewer-a/b APPROVE; `golden.k0.test.mjs:456-461` pins the list |
| LA-IC-06 platform-storage login `200` | `canvas/21-canvas-protocol` (M1-08) | r2 |
| LA-IC-09 `record_dispatch` | `host/storage-fixture-script.mjs` | LA-ADR-04 LA-IC-09; r8 §1.2 |
| LA-IC-14 Canvas dynamic registration | `canvas/11-canvas-platforms` (M1-15) | `LA-IC-14.json` (3 entries); r1 WE-F3 |
| LA-IC-22 `tool_account_id` | `common/99-logs` | r1 WE-F2 |
| LA-IC-23 Moodle steps source | `acceptance/lib/portal.ts`, `e2e/lib/steps.ts`, `T6/2-connect` (AC-T6-12) | LA-ADR-04 LA-IC-23 list; r3 |
| r1 WE-F5, LD-24 migration ledger | `host/m1-migration.mjs` | r1; r5 |
| r4 `seenPages` wait | `T5b/1-html` | r4 |
| r6 bound Docker identity | `host/storage-docker.mjs`, `.selftest.mjs` | r6 |
| r3/r4/r7/r8 locator and wait fixes | `T6/3-courses`, `T8/2-shell` | r3, r4, r7, r8 |
| `qalead` project-prefix guard | `host/core`, `host-control`, `p5-fixture`, `run-t1`, `run-t5`, `storage-docker`, `storage-handoff`, `m1-control`, `e2e/host/run-t7` | LA-E0-04 reviewer-b H17–H30 (AC-LA-E7-08-05); r8 for `m1-control` and `run-t7` |

All of these records have a final APPROVE from both reviewers (r5 through the LA-E0-04 rounds).

### Safety notes (no finding)

- The `qalead` guards add one QA-owned prefix. They keep the anchor and the lane character class, so a non-QA compose project is still refused (`core.mjs:76`, `storage-docker.mjs:106`, `storage-handoff.mjs:13`).
- `storage-fixture-script.mjs:389-394` puts a table name into SQL, but the name comes only from a fixed list (`record_dispatch`, `score_sync`, `score_syncs`). The `failed`-status check and the `DELETE … AND status='failed'` stay.
- `portal.ts` and `steps.ts` evaluate the repo's own `packages/channels/moodle/manifest.ts` with `vm.runInNewContext`. The input is a tracked repo file in a test helper. It is not untrusted input.

## Findings

### A-LA-REL-01 (MINOR): the table names the wrong LA-IC for 7 rows, and its approval basis omits the LA-IC lists

- **Where:** `docs/reviews/LA-E7-08/release-test-tree.md:12`, `:39`, `:40`, `:41`, `:44`, `:46`, `:51`, `:56`.
- **Problem:** A maintainer who follows the cited ids to find why a frozen assertion changed on main lands on the wrong record for 7 rows.
- **Evidence:**
  - `:44` T4b1/1-connect says "LA-IC-23". The only hunk is `nrps` → `'Do not use this service'`. That is LA-IC-04 (`LA-IC-04.json` `frozenTestsTouched` names `T4b1/1-connect.spec.ts:96-124`). LA-IC-23 is the Moodle steps file move (`docs/architecture/ltiaas/adr/LA-ADR-04-refactor-and-migration.md:154`), and that record names no T4b1 file.
  - `:41` 00-profiles says "LA-IC-23 NRPS value". The NRPS value (release-tree line 104) is LA-IC-04 (the record cites `00-profiles.test.ts:115-130`, before the LD-1 rewrite moved it).
  - `:40` 31-canvas-grants says only "candidate grant assertions". The only hunk removes `contextmembership.readonly` from `SCOPES`, which is LA-IC-04. r8 §1.2 (`ld9-addendum-r8.md:68`) labels this file LA-IC-09, which is also wrong.
  - `:39` 21-canvas-protocol says "LA-IC-04/06". The hunk is the platform-storage `200` login (LA-IC-06, r2). It has no NRPS change.
  - `:46` T6/2-connect says "LA-IC-23 scope assertions and B/C merge". The hunk changes only the steps data source (`readMoodleSteps`). `git diff bd368ff 78971b03 -- tests/acceptance/T6/2-connect.spec.ts` is empty, so B/C did not touch it.
  - `:51` portal.ts ("assertions and scopes") and `:56` steps.ts ("scope values"): both hunks only move the steps source to `packages/channels/moodle/portal/moodle-steps.json` + `manifest.ts` (LA-IC-23). Neither has a scope.
  - `:12` gives the approval basis as "LD-1 deferred row …, LD-9 addenda r1–r8 …, LD-32". A deferred row is not an approval. The basis omits the LD-1 review (`docs/reviews/LA-E0-04/`) and the LA-IC lists (LA-IC-04 via LA-E3-07, LA-IC-14.json). The LA-IC-04 NRPS hunks are not in any r1–r8 addendum.
- **Suggested fix:** Edit only the table text (no tests change). Use the ids in the traceability table above: `:39` → LA-IC-06 (r2); `:40`, `:41` (NRPS part), `:44` → LA-IC-04 (`tests/ltiaas/golden/expected/LA-IC-04.json`, LA-E3-07); `:46`, `:51`, `:56` → "LA-IC-23 Moodle steps data source (r3)", and remove "B/C merge" from `:46`. Change `:12` to: "LD-1 review `docs/reviews/LA-E0-04/`; LD-9 addenda r1–r8 and their reviews; the LA-IC lists LA-IC-04, -06, -09, -14, -22, -23; the `qalead` guard (LA-E0-04 reviewer-b, AC-LA-E7-08-05); LD-32". Add one sentence: "r8 §1.2 labels `31-canvas-grants` LA-IC-09 and `run-api.mjs` LA-IC-22; the correct records are LA-IC-04 and LD-32."

### A-LA-REL-02 (MINOR): after this merge, the deferred row "LD-1 K0 location" is false on main

- **Where:** `docs/team/ltiaas/deferred.md:98`; also `tests/ltiaas/golden/expected/LA-IC-01.json:323-330`.
- **Problem:** The row says that the LD-1 overlay "live[s] only in la-qa and the gate sources; integration keeps the frozen baseline files". Its status is "after the milestone-end gate". At `52a9d8b4` the overlay is in integration. A maintainer on main who reads this row gets the opposite of the truth (check 6).
- **Evidence:** `52a9d8b4` has the gate blobs for all LD-1 files (check 1). The release commit does not change `deferred.md`. Likewise, the 7 `LA-IC-01.json` `frozenTestsTouched` entries still say "Pending on integration at 195930c1 … lands at the wave-end gate". The golden tree must stay equal to the gate (`1909e58f`), and `golden.k0.test.mjs:512` asserts that text. So that record cannot change in this release.
- **Suggested fix:** The Lead closes the row: "Done in `52a9d8b4` (release tests tree `023ecdab`; `docs/reviews/LA-E7-08/release-test-tree.md`)." The release table adds one sentence: "The LA-IC-01 `Pending on integration` entries landed in `52a9d8b4`; the golden record keeps the gate text because the golden tree is frozen at the gate."

### A-LA-REL-03 (NIT): the E404 and E604 evidence keys do not name their product SHA

- **Where:** `docs/reviews/LA-E7-08/release-test-tree.md:26`, `:28`.
- **Problem:** E404 (K1-SIM) and E604 (K0) ran on integration `48c01495`, product `a8bbac53`. That is before the B/C merge, not the final product `4f10c5fd`. The key gives the run id but does not say this.
- **Evidence:** `docs/reviews/LA-E4-04/qa.md:5` and `docs/reviews/LA-E6-04/qa.md:5`. `git diff --stat a8bbac53 4f10c5fd -- . ':!docs' ':!tests'` changes only `README.md`, `infra/README.md` and `apps/player/src/html/tracker.ts` (+ its unit test). E404 sends its commits by HTTP (`progress-no-dispatch.k1sim.test.ts:31`) and starts no browser, so the browser tracker change cannot reach its assertion. I re-ran E604 K0 (4/4) and E513 K0 (6/6) on the release tree. E404 K1-SIM needs Docker, so I did not re-run it. The risk is low.
- **Suggested fix:** Add "(product `a8bbac53`; the only product delta to `4f10c5fd` is the browser HTML tracker and two READMEs)" to the E404 and E604 keys.

### A-LA-REL-04 (NIT): three frozen runners keep the old prefix text next to their new guards

- **Where:** `tests/host/run-t1.mjs:94`, `tests/e2e/host/run-t7.mjs:9`, `:65`, `tests/host/storage-docker.mjs:106`.
- **Problem:** The guards now accept `qalead-…`, but the error text still says "must start with \"qa-\"", "\"qa-e2e\"" or "a qa- lane".
- **Evidence:** the `qalead` hunks in check 5. `core.mjs:77` updated its message, so the four other messages are inconsistent.
- **Suggested fix:** Do not change these in this release (they are approved frozen bytes). Add a deferred row: fix the text at the next LD-9 edit of these files (LG).

### A-LA-REL-05 (NIT): the table's verdict line is not in the charter form

- **Where:** `docs/reviews/LA-E7-08/release-test-tree.md:1`.
- **Problem:** "Verdict: PASS after documented QA dependency setup; initial setup error retained" is not `Verdict: PASS | FAIL` (charter §6). A script or a reader that looks for the verdict token gets a long string.
- **Suggested fix:** Use `Verdict: PASS`, and keep the setup note in the "Fresh-clone verification" section, where it already is.

## What I did not do

- I did not run Docker, so I did not re-run any K1-SIM, M1, M2, T7 or kit suite. I relied on the D3/D4 run ids for them.
- I did not re-verify each hunk of the large LD-1 files (`open-world.*`, `k0/ld1/*`) line by line. I proved that they equal `la-final-test-1`, which LA-E0-04 Round 4 approved and verified live.

## Round 2

- Item: QA's record fix (la-qa `091c35c7`, integration `ef315afb`) and the Lead's deferred-row close (`9f31e7bf`). Diff: `git diff 7ad8d1a2 ef315afb -- docs/reviews/LA-E7-08/release-test-tree.md docs/team/ltiaas/deferred.md`. Host only; no Docker; no commit. I changed only this file.
- Result: **0 BLOCKER, 0 MAJOR, 0 MINOR open; 1 new NIT.** A-LA-REL-01 and A-LA-REL-02 are closed.

### Tree unchanged

| Check | Result | Evidence |
| --- | --- | --- |
| Tests tree | PASS | `git rev-parse ef315afb:tests` = `877a2717:tests` = `023ecdab70eea5fa689f6da736b6fb236f32b64c`. |
| No `tests/` change | PASS | `git diff --name-only 7ad8d1a2 ef315afb -- tests` is empty. `52a9d8b4..877a2717` changes only `docs/` (the table, `deferred.md`, the two release reviews and three briefs). |
| No product change | PASS | `git diff 4f10c5fd ef315afb -- . ':!docs' ':!tests' \| wc -l` = 0. |

### Links

I resolved every reference definition in the new table at `ef315afb` with a script (`git show <rev>:<path>`, then the GitHub heading slugs of the target). All 51 targets exist. All 15 anchors exist (`#round-2`, `#round-3`, `#round-4`, `#decisions-by-part`, `#d8-intended-behaviour-changes-ids-la-ic-nn`, `#12-who-writes-what-and-file-ownership`). No reference is undefined. Script: `~/cogniate-qa-runs/LA/RELEASE-REVIEW/reviewer-a-20261025T053341Z/bin/linkcheck.mjs`.

### Each changed row against its record

| Row | New reason | Record check | Result |
| --- | --- | --- | --- |
| Approval basis (`:12`) | LA-E0-04 A/B/QA; LD-9 r1–r8; LA-IC lists; runner guard; LD-32. The deferred row "is not an approval" | Matches the round-1 traceability table | PASS |
| LD-9 record table (`:21-29`) | rounds: r1 patch r2 / procedure r3, r2 r2, r3 r1, r4 r1, r5 r3 (LA-E0-04 R4), r6 r2, r7 r1, r8 r3 | Same as the verdict and round headers of the 14 addendum review files and LA-E0-04 | PASS |
| r8 note (`:31`) | r8 §1.2 wrongly labels `31-canvas-grants` LA-IC-09, `run-api.mjs` LA-IC-22, and adds LA-IC-04 to `21-canvas-protocol`; r8 stays unchanged | `ld9-addendum-r8.md:68`, `:74` and the §1.2 list | PASS |
| `11-canvas-platforms` | LD-1; LA-IC-14; r1 round 2 WE-F3 | `LA-IC-14.json` (3 entries); r1 WE-F3 | PASS |
| `21-canvas-protocol` | LA-IC-06; r2 round 2; no NRPS change | r2 `M1-08.canvas.login-redirect`; hunk has no scope | PASS |
| `31-canvas-grants` | LA-IC-04 `frozenTestsTouched`; LA-E3-07 A/B | `LA-IC-04.json`; LA-E3-07 A and B APPROVE | PASS |
| `00-profiles` | LD-1, r5, LA-IC-04 NRPS row | `LA-IC-04.json` entry 2; LA-IC-01 rows 1–2 | PASS |
| `90-simulation-gates` | LD-1 row 8 | `LA-IC-01.json` entry 2 ("LD-1 row 8") | PASS |
| `99-logs` | LA-IC-22; r1 round 2 WE-F2 | r1 WE-F2 | PASS |
| `T4b1/1-connect` | LA-IC-04 | `LA-IC-04.json` entry 3 | PASS |
| `T5b/1-html` | r4 WE-F10 (BD-A1-116) | `ld9-addendum-r4.md:1`, `:7` | PASS |
| `T6/2-connect`, `portal.ts`, `steps.ts` | LA-IC-23; r3 WE-F7 hunks 3, 2, 1; no scope or B/C change | `ld9-addendum-r3.md:339-341` (hunk 1 `steps.ts`, hunk 2 `portal.ts`, hunk 3 `2-connect`) | PASS |
| `T6/3-courses`, `T8/2-shell` | r3 WE-F8 + r4 WE-F11 / r7 WE-F13; r8 §2.5 / §2.1 | `ld9-addendum-r3.md:342`, `:344`; r4; r7; r8 §2.1, §2.5 | PASS |
| `acceptance/lib/open-world.*`, `ltiaas/lib/open-world.*`, `k0/ld1/*` | LD-1 + r5; LA-E0-04 R4 | same as round 1 | PASS |
| `01-cards`, `run-m2`, `run-m1` | LD-1 rows 6, 2, 3 | `LA-IC-01.json` entries 6, 5, 4 | PASS |
| `run-t7`, `m1-control` | runner guard; r8 §2.4 / §2.2 | LA-E0-04 reviewer-b H17–H30; r8 | PASS |
| `core`, `host-control`, `p5-fixture`, `run-t1`, `run-t5`, `storage-handoff` | LA-E0-04 runner-prefix approval (AC-LA-E7-08-05) | `LA-E0-04/reviewer-b.md:24` | PASS |
| `m1-migration` | LA-E0-04 H21; r1 WE-F5; LD-24 / r5 | `LA-E0-04/reviewer-b.md:25` (H21) | PASS |
| `storage-docker(.selftest)` | r6 round 2; prefix guard | r6 | PASS |
| `storage-fixture-script` | LA-IC-09; LA-E0-04 H29 under LD-6 | `LA-E0-04/reviewer-b.md:23` (H29) | PASS |
| `run-api.mjs`, `GATE-RUN-PLAN.md` | TEST-STRATEGY §1.2 selector / LD-32; r8 round 3 | `TEST-STRATEGY.md:62`; plan LD-32 | PASS |
| 13 `tasks-qa` rows | LA-E4-04, LA-E5-13, LA-E6-04 A/B and QA | A and B APPROVE in all three tasks; QA PASS in all three | PASS |

The blob hash column did not change. The scope paragraph (`:16-18`) now says that the table covers the 49-file gate-to-integration delta, not the full main-versus-B/C delta, and points to the records for the rest. This answers the lens-B question of round 1.

### Round-1 findings

| Id | Status | Evidence |
| --- | --- | --- |
| A-LA-REL-01 (MINOR) | **Closed** | All 7 rows and the approval basis are correct (table above). |
| A-LA-REL-02 (MINOR) | **Closed** | `deferred.md:98` now says "Closed: … merged into integration as the reviewed release test tree (52a9d8b4, tests tree 023ecdab …)". The optional sentence about the `LA-IC-01.json` "Pending on integration" entries is not in the table. That is acceptable: the closed row tells a reader that the overlay landed, and the golden record must keep the gate text. |
| A-LA-REL-03..05 (NIT) | Deferred to LG | `deferred.md:111` |

### A-LA-REL-06 (NIT): the two new deferred rows are outside the table

- **Where:** `docs/team/ltiaas/deferred.md:109-111`.
- **Problem:** A blank line (`:109`) ends the table, so rows `:110` (B-LA-REL-04) and `:111` (LA-RELEASE NITs) have no header row. Markdown shows them as plain text with `|` characters, not as table rows. The file also has no newline at the end.
- **Evidence:** `git show ef315afb:docs/team/ltiaas/deferred.md | sed -n 108,111p`; the last byte of the file is `|`.
- **Suggested fix:** The Lead removes the blank line `:109` and adds a final newline. This is not blocking.
