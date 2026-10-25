Verdict: APPROVE
Round: 2

# LA release test tree — Reviewer-B

Reviewer-B: Claude Opus 5.5, xhigh, new session. Lens B: "Can a human team own it?"

- Item: the release test tree (LA-H28, plan §6.2).
- Integration commit: `52a9d8b4` (QA la-qa `5821ab31` + `b7dbd771`).
- Diff: `git diff 0bf4e1de 52a9d8b4 -- tests docs/reviews/LA-E7-08/release-test-tree.md`.
- Release tests tree: `023ecdab70eea5fa689f6da736b6fb236f32b64c`.
- Gate tree: `794f649c` (tests tree `b202c3ee`). I fetched it from `~/cogniate-qa-runs/LA/GATE/src-final-3` into my clone.

**Result:** 0 BLOCKER, 0 MAJOR, 4 MINOR, 4 NIT.

The tree is correct. Every byte, hash and host check that I could test passes. The MINOR findings are about traceability. In three rows, the table names the wrong approval record. The table does not say what it leaves out. A deferred row is now stale. Two r8 MINOR findings were never fixed or deferred. Each fix is a doc edit. No fix changes a test byte. I recommend that the Lead or QA fix B-LA-REL-01 to -04 before the merge to main. The fixes are cheap, and main is the place where a maintainer will read these records.

How I checked: I made a private `git clone --no-hardlinks` of the integration worktree at `52a9d8b4`: `~/cogniate-qa-runs/LA/RELEASE/reviewer-b-20261025T053347Z/clone`. In the integration worktree I ran only read-only commands. I did not run Docker. A fail-closed `docker` stub was first on `PATH` for all host runs, and it recorded 0 calls. I did not commit. I did not open Reviewer-A's file.

## Checks

| # | Check | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Each category-B file is byte-identical to `794f649c` | PASS | All 34 B rows: the blob at `52a9d8b4` = the blob at `794f649c` = the table hash. My script compared every row of the table. |
| 2 | Each category-A file equals the tested integration version; `run-api.mjs` differs from the gate only by the K1 lines | PASS | All 15 A rows: the blob at `52a9d8b4` = the blob at `0bf4e1de` = the table hash, and no A file equals the gate blob. With `git hash-object`, the 13 `tasks-qa` files match the retained run clones `qa3-la-e404-r1/clone` (E404, E604) and `qa3-la-e513-r2/clone` (E513), and `run-api.mjs` matches `REGATE/kit-src-99338e52`. `git diff 794f649c 52a9d8b4 -- tests/acceptance/run-api.mjs` has one hunk: 3 lines out, 4 lines in. The new lines change behaviour only when `QA_TASK` contains `K1` or `LA-E7-06`. For every frozen M1/T2–T8 value, `k1` is false, and `la` and `config` get the same values as in the gate file. The release blob `5ee913e0` is also the `4f10c5fd` blob: the gate overlay `5ee0ebd0` had replaced it with the pre-K1 blob `6d0aef65` (LD-32). |
| 3 | No other tests/ change; product diff against `4f10c5fd` outside docs/ and tests/ = 0 | PASS | `git diff --name-only 0bf4e1de 52a9d8b4` = the 34 B files + `release-test-tree.md`, nothing else. `git diff --name-only 794f649c 0bf4e1de -- tests` = the 49 table files exactly. Tests are unchanged from `f0b29ecd` to `0bf4e1de`. `git diff 4f10c5fd 52a9d8b4 -- . ':!docs' ':!tests' \| wc -l` → **0**. `git diff --stat 4f10c5fd 794f649c -- . ':!docs' ':!tests'` → empty, so D3/D4 ran product `4f10c5fd`. Kit tree `d7e50b5d` and golden tree `1909e58f` are equal in the release tree, the gate and `99338e52`. |
| 4 | Host checks in my clone | PASS | Node 24.21.0, npm 11.19.0. See the next table. |
| 5 | Each frozen-test change traces to an approved record | PASS, with wrong labels (B-LA-REL-01) | Against the B/C baseline (`4f10c5fd` and `78971b03`), the release tree changes 30 frozen files in tests/acceptance, tests/e2e and tests/host. All 30 are B rows. r8 §1–§2 (Reviewer-A and Reviewer-B APPROVE, round 3) names each of them. The NRPS hunks trace to the LA-IC-04 list (`tests/ltiaas/golden/expected/LA-IC-04.json` `ld9.frozenTestsTouched[0..2]`), not to the records that the table names. The LD-1 files trace to `docs/reviews/LA-E0-04/` (A and B APPROVE, QA PASS round 4) and r5. The qalead guard traces to r8 §1.2, §2.2 and §2.4. r4 WE-F10/WE-F11, r6 `BOUND_IDENTITY` and r7 WE-F13 match their rows. |
| 6 | Lens B: can a maintainer see why main's frozen tests differ from the B/C baseline? | Partly | The table is clear about the 49-file integration↔gate delta, and its proof method (blob hashes, retained clones, the dispatcher proof) is good. But it does not cover the full main↔B/C delta (B-LA-REL-03), it names three records wrongly (B-LA-REL-01), and the deferred row still tells the opposite story (B-LA-REL-02). |

### Host checks (my clone, 2026-10-25 UTC)

| Command | Exit | Result | QA's count |
| --- | --- | --- | --- |
| `npm ci` | 0 | installed | same |
| `npm run check` | 0 | lint and typecheck clean; unit 204 files, 3,324 PASS, 5 SKIP; infra 255/255; K0 3 files, 151/151 (it includes `tests/ltiaas/k0/ld1/open-world.test.ts`); F1 0 hits; F5 6 rules, 0 hits | same |
| `LA_LEVEL=k0 npx --no-install vitest run --config tests/ltiaas/kit/vitest.config.mts` | 0 | 33/33 | same |
| `node --test tests/ltiaas/golden/golden.k0.test.mjs` | 0 | 12/12 | same |
| `node --test tests/ltiaas/k0/ld1/open-world.test.mjs` | 0 | 46/46, 0 skip | same |
| `node --test tests/host/*.selftest.mjs` (15 files) | 0 | 155/155, 0 skip, 0 cancelled (05:36:57–05:48:42) | 155/155 |
| Extra: `LA_LEVEL=k0 npx --no-install vitest run --config tests/ltiaas/tasks-qa/LA-E5-13/vitest.config.mts` | 0 | 6/6 | not in QA's list |
| Extra: `npx --no-install vitest run --config tests/ltiaas/tasks-qa/LA-E6-04/vitest.config.mts` | 0 | 4/4 | not in QA's list |
| `git status --porcelain` after all checks | — | empty | empty |
| Docker stub call log | — | absent (0 calls) | — |

The two extra rows show that the category-A K0 task suites still pass on the release tree, next to the new B files. Logs: `~/cogniate-qa-runs/LA/RELEASE/reviewer-b-20261025T053347Z/logs/`.

I did not repeat the M2/K2 discovery checks. They need `npm ci --prefix tests`, and they are not in this dispatch's check list. QA's record of the first ENOENT stop and the second run after setup is honest and easy to follow.

## Findings

### B-LA-REL-01 — MINOR — Three frozen-test rows name the wrong approval record

**File:line:** `docs/reviews/LA-E7-08/release-test-tree.md:40`, `:41`, `:44`. Also `:46`, `:51`, `:56` for the word "scope". The source of the labels is `docs/reviews/LA-E7-08/ld9-addendum-r8.md:68-71`.

**Problem:** The table names LA-IC-23 or no record for the three NRPS frozen-test changes. The record that approves them is LA-IC-04.

**Evidence:**
- The release changes these three frozen assertions against the B/C baseline. `31-canvas-grants.test.ts` removes `…/lti-nrps/scope/contextmembership.readonly` from the Canvas `SCOPES`. `00-profiles.test.ts` and `T4b1/1-connect.spec.ts` change Moodle row 13 `nrps` to `'Do not use this service'`.
- `docs/architecture/ltiaas/adr/LA-ADR-04-refactor-and-migration.md:135` defines LA-IC-04 as "No NRPS scope in any channel … M1 Canvas JSON rows, T4b1 and T7 tool-row checks". `:140` defines LA-IC-09 as the P5 fixture `record_dispatch` change. `:154` defines LA-IC-23 as the move of the Moodle steps data.
- `tests/ltiaas/golden/expected/LA-IC-04.json` `ld9.frozenTestsTouched[0..2]` names exactly these three hunks. `tests/ltiaas/GATE-RUN-PLAN.md:11` also says "the 3 approved LA-IC-04 frozen-test updates".
- The table says: row 40 "Approved candidate grant assertions retained from the gate" (no record); row 41 "LA-IC-23 NRPS value"; row 44 "Approved candidate scope assertions (LA-IC-23)". r8 labels `31-canvas-grants` as LA-IC-09 (`:68`), and `00-profiles` and `T4b1` as LA-IC-23 (`:69`, `:71`). The table copied these labels.
- Rows 46, 51 and 56 (`T6/2-connect.spec.ts`, `lib/portal.ts`, `e2e/lib/steps.ts`) say "scope". Their hunks are the LA-IC-23 steps data source (`readMoodleSteps()` / `readSteps()` read `packages/channels/moodle/portal/moodle-steps.json` and the manifest's `texts.adminSteps`). They do not change scopes.

A maintainer who follows row 41 or 44 to LA-IC-23 finds the Moodle steps data, not NRPS. This table will be the index on main, so the labels matter.

**Suggested fix (QA, doc only):** Rows 40, 41, 44: give the reason as "LA-IC-04 (no NRPS scope; `tests/ltiaas/golden/expected/LA-IC-04.json` `frozenTestsTouched`)". Keep the LD-1 and r5 parts of row 41. Rows 46, 51, 56: change "scope" to "Moodle steps data source (LA-IC-23)". Add one sentence: "r8 §1.2 labels 31-canvas-grants as LA-IC-09 and run-api.mjs as LA-IC-22. The correct records are LA-IC-04 and the TEST-STRATEGY §1.2 selector." r8 is an approved record, so leave it unchanged.

### B-LA-REL-02 — MINOR — The deferred row "LD-1 K0 location" is still open, and it is now false

**File:line:** `docs/team/ltiaas/deferred.md:98`. Also `docs/reviews/LA-E7-08/release-test-tree.md:12`.

**Problem:** The row says that the overlay files "live only in la-qa and the gate sources; integration keeps the frozen baseline files". It also says "merge the overlay into integration after the milestone gate". `52a9d8b4` did this merge, but the row has no "Closed" note. On main, the row will contradict the tree.

**Evidence:**
- Other closed rows use the "Closed: fixed by … (integration …)" form (for example the A-LA-E8-02-01 row). This row has no such note.
- The other half of the row ("make the ld1 K0 tests skip … on a tree without the overlay") is now moot. Main carries both copies of the oracle. The tests also fall back to `tests/ltiaas/lib/open-world.mjs` when `tests/acceptance/lib/open-world.mjs` is absent (`tests/ltiaas/k0/ld1/open-world.test.ts:17-19`, `open-world.test.mjs:17`).
- Release table line 12 gives this deferred row as the "Approval basis". A deferred row is a plan, not an approval. The LD-1 approval is `docs/reviews/LA-E0-04/reviewer-a.md` and `reviewer-b.md` (APPROVE), plus `qa.md` round 4.

**Suggested fix:** The Lead closes the row in the integration step. For example: "Closed: overlay merged at 52a9d8b4 (release test tree; docs/reviews/LA-E7-08/release-test-tree.md). The skip part is moot because main carries the overlay." QA changes line 12 to name the LA-E0-04 reviews as the LD-1 approval and the deferred row as the reason for the merge.

### B-LA-REL-03 — MINOR — The table does not state its scope, and it does not link the records

**File:line:** `docs/reviews/LA-E7-08/release-test-tree.md:10-12`, `:34`, `:52`.

**Problem:** The table explains the 49-file delta between integration and the gate. But a maintainer on main will compare main with the B/C baseline. The table does not say that this is a different set. It also gives no path to the approval records.

**Evidence:**
- `git diff --name-status 78971b03 52a9d8b4 -- tests ':!tests/ltiaas' ':!tests/e2e/ltiaas'` lists 44 files. 31 are in the table: the 30 B frozen files and `run-api.mjs`.
- The other 13 are `tests/sim/**`. They are additive simulator modules from LA-E7-02 and LA-E7-05 (`f83a00e2` … `6606b653`). TEST-STRATEGY §4.3 item 4 allows them. The table does not name them.
- Row 52 explains only the K1 hunk of `run-api.mjs`. Against `78971b03`, main also gets the LA task-config lookup and the `.trim()` change in `QA_TASK` parsing (`666eb183`; `tests/ltiaas/TEST-STRATEGY.md:62`; `docs/architecture/ltiaas/epics.md:615`).
- Line 12 says "LD-9 addenda r1–r8" without the file names. r8 itself points to a file that does not exist (B-LA-REL-06).

**Suggested fix (QA, doc only):** Add a short "Read this first" paragraph before the table:

> main's frozen tests differ from B/C main `78971b03` for five reasons:
> (1) the LD-1 open-world overlay (`docs/reviews/LA-E0-04/`, r5);
> (2) the LD-9 addenda r1–r8 (`docs/reviews/LA-E7-08/ld9-addendum-r1.md` … `-r8.md` and their reviews);
> (3) the LA-IC test-change lists (LA-ADR-04 D8; `tests/ltiaas/golden/expected/LA-IC-*.json`);
> (4) runner changes with no assertion change (the qalead guard; the `run-api.mjs` task selector, TEST-STRATEGY §1.2);
> (5) the additive simulator modules in `tests/sim/**` (LA-E7-02, LA-E7-05).
> This table covers only the 49 files where integration differed from the gate.

### B-LA-REL-04 — MINOR — Two r8 round-3 MINOR findings are still open in a category-A file, and deferred.md has no row for them

**File:line:** `tests/ltiaas/GATE-RUN-PLAN.md:1239`, `:1240`, `:1244`. Also `docs/team/ltiaas/deferred.md`.

**Problem:** Reviewer-B's B-LA-E7-08-LD9-R8-04 and Reviewer-A's A-LA-E7-08-LD9-R8-06 (r8 round 3) found that three dry-run matrix cells do not match the cited logs. The integration version of the file that goes to main still has the wrong values. Charter-LA §5 says that MINOR findings go to deferred.md, but neither finding is there.

**Evidence:**
- Line 1240 still says `launch.perMinute=28`, `lti.admin.perMinute=399` and "`run-m1.mjs --sha deadbeef` throws". Both reviewers read 25/395 and `--phase bad-phase` in the saved logs.
- Line 1244 still says `106,073 B`, `53,070 B`, `59,628 B`, `28,601 B`. The logs say 104,405 / 48,309 / 65,331 / 27,278.
- Line 1239 still names the old-path negative check that Reviewer-B could not find in the group-00 log.
- `grep -F "R8-04" docs/team/ltiaas/deferred.md` and `grep -F "R8-06"` both find nothing. `GATE-RUN-PLAN.md:1157` mentions "A-LA-E7-08-LD9-R8-04", but that is the round-2 MAJOR (K1 wave input) with the same number. So the ids collide.

**Suggested fix:** Either QA corrects the three cells from the named logs (the file is a plan, not executable code, so no test byte changes), or the Lead adds a deferred row. The row should name both ids, B-LA-E7-08-LD9-R8-04 (round 3) and A-LA-E7-08-LD9-R8-06, owner QA, "next GATE-RUN-PLAN edit / LG". It should also say that the round-2 A-LA-E7-08-LD9-R8-04 is a different finding.

### B-LA-REL-05 — NIT — The verdict line does not follow charter §6

**File:line:** `docs/reviews/LA-E7-08/release-test-tree.md:1`.

**Problem:** The line is "Verdict: PASS after documented QA dependency setup; initial setup error retained". Charter §6 asks for `Verdict: PASS | FAIL`. A strict parser or a `grep -x` fails on this line.

**Suggested fix:** Write `Verdict: PASS` and put the qualifier on a note line after `Round: 1`.

### B-LA-REL-06 — NIT — r8 cites an addendum file that never existed

**File:line:** `docs/reviews/LA-E7-08/ld9-addendum-r8.md:12`.

**Problem:** The "Prior Addenda" list names `docs/reviews/LA-E7-08/ld9-addendum.md` (r1–r4). `git log --all -- docs/reviews/LA-E7-08/ld9-addendum.md` is empty. The real files are `ld9-addendum-r1.md` … `-r4.md`.

**Suggested fix:** The release table links the eight real file names (part of B-LA-REL-03). QA can correct r8's link in a later doc round.

### B-LA-REL-07 — NIT (LG) — The QA project guard has 12 copies in 9 frozen runner files, with 5 regex forms and stale messages

**File:line:** `tests/host/core.mjs:76`, `m1-control.mjs:17`, `storage-docker.mjs:106` (`^(?:qa[234]?|qalead)-[a-z0-9-]+$`); `storage-handoff.mjs:13` (the same with `-st$`); `host-control.mjs:27,33`, `p5-fixture.mjs:13`, `run-t5.mjs:104,120,126` (`^(?:qa|qalead)-`); `run-t1.mjs:93` (`^(?:qa|qalead)-[a-z0-9-]+$`); `tests/e2e/host/run-t7.mjs:64` (`^(?:qa-e2e|qalead-la)`).

**Problem:** One rule ("QA runs only on its own compose project") has several different forms. For example, `core.mjs` accepts a `qa2-` project, but `host-control.mjs` rejects it with code 9. `run-t1.mjs:94` still says `must start with "qa-"`, and `storage-docker.mjs:106` says "only in a qa- lane", but both now accept `qalead-`.

**Suggested fix (LG, with an LD-9 entry because these files are frozen runners):** Export one `isQaProject(name)` and one message from `tests/host/core.mjs`, and call it at every site.

### B-LA-REL-08 — NIT (LG) — Two frozen helpers evaluate `manifest.ts` with a regex and `vm`

**File:line:** `tests/acceptance/lib/portal.ts:121-142`, `tests/e2e/lib/steps.ts:29-41`.

**Problem:** Both helpers copy the same steps. They remove `import type` lines and `satisfies X` with regexes, then run `packages/channels/moodle/manifest.ts` with `vm.runInNewContext`. A normal product edit to the manifest can break frozen T6/T7 with a `SyntaxError` and not an assertion message. Examples are a value import, `as const`, or an `import type` that spans more than one line.

**Suggested fix (LG):** Use one shared helper. Or let the product publish the composed steps as JSON, so the tests read data and not TypeScript source.

## What is good

- The source rule is simple and easy to check: each file comes from exactly one source, byte for byte, with blob hashes. I could check all 49 rows with one script.
- The dispatcher proof is exact, and it is correct.
- QA kept the first M2 ENOENT failure as a failure. It recorded the authorized `npm ci --prefix tests` step separately, and it gives the two-install setup for a new clone.
- Row 63 (`run-t1.mjs`) says that D3/D4 had no T1 invocation, and it does not claim coverage for it.

## Round 2

Reviewer-B: Claude Opus 5.5, xhigh, same session, new dispatch. Scope: the table fix only. I reviewed QA la-qa `091c35c7` (integration `ef315afb`) and the Lead's deferred.md commit `9f31e7bf`, with `git diff 7ad8d1a2 ef315afb -- docs/reviews/LA-E7-08/release-test-tree.md docs/team/ltiaas/deferred.md`. I worked host only, in the same private clone, and fetched the new commits into it. I ran no Docker, made no commit, and did not open Reviewer-A's file.

**Result:** APPROVE. 0 BLOCKER, 0 MAJOR, 0 MINOR open; 2 new NIT. B-LA-REL-01, -02 and -03 are closed. I accept the deferral of B-LA-REL-04 and of the round-1 NITs.

### Tree and scope checks

| Check | Result | Evidence |
| --- | --- | --- |
| Tests tree unchanged | PASS | `git rev-parse ef315afb:tests` and `877a2717:tests` (current HEAD) = `023ecdab70eea5fa689f6da736b6fb236f32b64c`. |
| No file under tests/ changed | PASS | `git diff --name-only 52a9d8b4 877a2717` lists only docs/ files. `7ad8d1a2..ef315afb` changes 3 files: the table, deferred.md and the brief `QA-RG-release-f1.md`. |
| Product diff against `4f10c5fd` | PASS | `git diff 4f10c5fd 877a2717 -- . ':!docs' ':!tests' \| wc -l` → 0. |
| Host checks | Carried over | The tests tree and the product are byte-identical to round 1, so the round-1 host results still apply. I did not repeat them. |
| Links | PASS | A script resolved all 52 reference definitions in the new table at `ef315afb` (file and GitHub heading anchor). All files exist and all anchors match. No reference is undefined or unused. I checked that `[release-a]` exists, but I did not read it. |

### Closure of round-1 findings

- **B-LA-REL-01 — CLOSED.**
  - Rows 59, 60 and 63 (`31-canvas-grants`, `00-profiles`, `T4b1/1-connect`) now cite LA-IC-04 `frozenTestsTouched`. This matches `tests/ltiaas/golden/expected/LA-IC-04.json` items [0..2] and LA-ADR-04:135. The rows also link LA-E3-07 A and B (both `Verdict: APPROVE`, round 1). LA-E0-04 Reviewer-B "Decisions by part" also approves the same hunks H04, H07 and H10.
  - Rows 65, 70 and 75 (`T6/2-connect`, `lib/portal.ts`, `e2e/lib/steps.ts`) now say "LA-IC-23 Moodle steps data source", and the r3 hunks are right. ld9-addendum-r3.md:339-341 gives hunk 1 = `steps.ts`, hunk 2 = `portal.ts` and hunk 3 = `T6/2-connect.spec.ts`.
  - The row 65 claim "No B/C merge" is correct: r8 §2 lists only five overlap files, and this file is not one of them.
  - Row 58 (`21-canvas-protocol`) now says "LA-IC-06 … r2 round 2. No NRPS change". `git diff 4f10c5fd ef315afb` on that file shows only the platform-storage login change (200 with `lti-storage-data`, then the authorize form post). This matches r2 (`M1-08.canvas.login-redirect`). The round-1 label "LA-IC-04/06" was wrong, and this round corrects it.
  - The paragraph at line 31 records r8's wrong labels and leaves the historical r8 unchanged.
- **B-LA-REL-03 — CLOSED.**
  - The new "Scope and approval records" section says that the table covers only the 49-file gate↔integration delta, and that it is not the main↔B/C delta.
  - It names the other parts of the delta with links: the runner guards, the TEST-STRATEGY §1.2 selector including the task lookup and the parsing change, LD-32, and the simulator modules from LA-E7-02 and LA-E7-05. All four of those reviews say APPROVE.
  - The LD-9 record table gives the round of each addendum, and each round matches the verdict header of its review files: r1 round 3, r2 round 2, r3 round 1, r4 round 1, r5 via LA-E0-04 round 4 (A and B APPROVE), r6 round 2, r7 round 1 and r8 round 3.
  - The LA-IC-01 link is correct: `LA-IC-01.json` `frozenTestsTouched` names the LD-1 files.
  - The row records also check out:
    - `[guard]` → LA-E0-04 Reviewer-B "Decisions by part". It approves H17–20, H22 and H25–28, H30 for all 9 guard files, H21 (`m1-migration.mjs`) and H29 (`storage-fixture-script.mjs`, LD-6 / LA-IC-09).
    - LD-1 rows 2, 3, 6 and 8 map to `run-m2.mjs`, `run-m1.mjs`, `01-cards.m2.ts` and `90-simulation-gates.test.ts`, as TEST-STRATEGY §4.3 says.
    - The task-suite rows link LA-E4-04, LA-E5-13 and LA-E6-04. All of those reviews say APPROVE, and each qa.md says PASS.
- **B-LA-REL-02 — CLOSED by the Lead.** `deferred.md:98` now ends "Closed: … merged into integration as the reviewed release test tree (52a9d8b4, tests tree 023ecdab; …)". The table line 12 now says that the deferred row "explains the planned merge; it is not an approval", and it names LA-E0-04 A, B and QA as the LD-1 approval.
- **B-LA-REL-04 — DEFERRED, and I accept it.** The deferred row's reason is sound: the plan is part of the reviewed release tests tree, so nobody edits it before the merge. The row names the r8 round-3 sections of both reviewers, and that is enough to tell this finding apart from the round-2 A-LA-E7-08-LD9-R8-04.
- **B-LA-REL-05..08 — DEFERRED to LG, and I accept it.** All four appear in the "LA-RELEASE NITs" row.

### New findings

#### B-LA-REL-09 — NIT — The two new deferred rows are cut off from the table

**File:line:** `docs/team/ltiaas/deferred.md:109-111`.

**Problem:** A blank line (109) stands between the WE-F14 row and the two new rows. In GitHub Markdown, a table ends at a blank line. Rows without a header and a delimiter row show as plain text with visible `|` characters. The file also has no newline at the end.

**Suggested fix (Lead):** Delete line 109, and end the file with a newline.

#### B-LA-REL-10 — NIT — The table has no note that it changed after the review

**File:line:** `docs/reviews/LA-E7-08/release-test-tree.md:1-2`.

**Problem:** The header still says `Round: 1`, and the file has no note that QA corrected the record mappings after the release review (la-qa `091c35c7`, for A-LA-REL-01 and B-LA-REL-01/-03). The old rows exist only in git history (`7ad8d1a2`). Line 31 mentions "corrected row mappings", but only as a correction of r8.

**Suggested fix (QA, LG or the next edit of this file):** Add one line, for example "Round 2 (091c35c7): record mappings and scope corrected for A-LA-REL-01 and B-LA-REL-01/-03; no tests/ byte changed." Or update the `Round:` line.
