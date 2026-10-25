Verdict: PASS (AC-LA-E0-01-01..05, including AC-04 check and D3/D4 golden comparisons on 4f10c5fd)
Round: 2

# LA-E0-01 Base intake: QA verification

## Round 2 (Wave-end B/C Final Merge `4f10c5fd`, 2026-10-25)

Tester: QA-3 (Orca task `task_2d0fa086666e`, dispatch `ctx_bf364ab8043c`), 2026-10-25. Spec: `docs/architecture/ltiaas/tasks/LA-E0-01.md`. Reviews addressed: `docs/reviews/LA-E0-01/reviewer-a.md` (`A-LA-E0-01-01`) and `docs/reviews/LA-E0-01/reviewer-b.md` (`B-LA-E0-01-01`).

Independence: QA-3 ran all git checks, fresh `git clone --no-hardlinks`, `npm ci`, and `npm run check` independently in a private run directory (`~/cogniate-qa-runs/LA/LA-E0-01/r2/`). QA-3 did not read product source.

| Item | Value |
| --- | --- |
| Wave-end merge SHA | `4f10c5fd9ca4dd0a5f636b34d7454e0db7b6849c` (`Merge: 86bdc24c 78971b03`, `LA-H10` (a), `LA-H27`, `LD-29`) |
| Merge parents | First parent (LA pre-merge tip): `86bdc24c727a5e324704f2d10eb25e694d9924d7`<br>Second parent (B/C final `main` tip): `78971b0300ab171029e8ce94dbba30db37b23dea` |
| Old merge base (`G-BASE`) | `bd368ff39fb4c533fc105e7c5ee81a59e618d99a` (`git merge-base 86bdc24c727a5e324704f2d10eb25e694d9924d7 78971b0300ab171029e8ce94dbba30db37b23dea`) |
| Clean merge-tree proof | `git merge-tree --write-tree 86bdc24c727a5e324704f2d10eb25e694d9924d7 78971b0300ab171029e8ce94dbba30db37b23dea` = `ac052ca5222d01e31b9f9e31e95f146285c952bb` = `4f10c5fd^{tree}` (clean merge result, 0 conflicts, 0 hand edits) |
| Clone | `~/cogniate-qa-runs/LA/LA-E0-01/r2/src`: `git clone --no-hardlinks --no-checkout . "$SRC"`, `checkout --detach 4f10c5fd9ca4dd0a5f636b34d7454e0db7b6849c`, push URL disabled |
| Artifacts (`umask 077`) | `~/cogniate-qa-runs/LA/LA-E0-01/r2/`: `ac04-ac05-git.txt`, `npm-ci.log`, `check.log`, `timing.txt`, `status-after.txt` |

### Round 2 Acceptance Criteria Summary

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| `AC-LA-E0-01-01` | **PASS** | `E0-01-DOC-1` | See Round 1 below | Unchanged from Round 1 (`ac01-git.txt`). |
| `AC-LA-E0-01-02` | **PASS** | `E0-01-DOC-2` | See Round 1 below | Unchanged from Round 1 (`ac02-message.txt`). |
| `AC-LA-E0-01-03` | **PASS** | `E0-01-K0-1` | See Round 1 below | Unchanged from Round 1 (`check.log`). |
| `AC-LA-E0-01-04` (Part 1: `npm run check` at `4f10c5fd`) | **PASS** | `E0-01-K0-2` | `npm ci && npm run check` in fresh `git clone --no-hardlinks` at `4f10c5fd9ca4dd0a5f636b34d7454e0db7b6849c` | Both commands exit `0` (`npm ci` `3 s`, `npm run check` `98 s`). Unit: `204` files, **`3,324` passed**, `5` skipped (`3,329`); Infra (`node --test`): **`255` passed**, `0` failed (`23` suites); K0: `3` files, **`149` passed**; **F1: `0` hits**; **F5: `6` rules, `0` hits**. `r2/check.log` |
| `AC-LA-E0-01-04` (Part 2: golden compare & B/C commit attribution) | **PASS (Golden v2 dry run and D3/D4 re-gate)** | `E0-01-K1SIM-1` | `node tests/ltiaas/golden/compare.mjs --base tests/ltiaas/golden/78971b0300ab171029e8ce94dbba30db37b23dea --candidate /Users/quangnguyen/cogniate-qa-runs/LA/LA-E0-03-r2/golden-cand-4f10c5fd --expected LA-IC-01,LA-IC-03,LA-IC-04,LA-IC-12,LA-IC-13,LA-IC-14,LA-IC-15,LA-IC-16,LA-IC-17,LA-IC-18,LA-IC-19,LA-IC-20,LA-IC-21` | • **Golden v2 dry run (`docs/reviews/LA-E0-03/qa.md` Round 6 §2–§3):** candidate `qalead-la-112` (`4f10c5fd`) vs re-captured baseline `qalead-la-110` (`78971b03`): **`EQUAL: 297 differences (0 not explained), 0 expected changes missing`** (`21 ms`, `LA-E0-03-r2/logs/compare-4f10c5fd-vs-78971b03.txt`).<br>• **B/C product commit attribution:** Only `4008afb92fe983d52db33442e060210b929966c8` (`apps/player/src/html/tracker.ts`, `tracker.test.ts`) touches `apps services packages` in `bd368ff..78971b03`, and **`0` golden fields changed because of it** (`diff(1b17261b v1, 78971b03 v2)` has `0` changes on any v1 path, matching A1 conformance round 3 `docs/architecture/ltiaas/conformance-A1.md:13`).<br>• **D3/D4 re-gate:** `qalead-la-139-4f10c5fd-2026-10-24T21-05-44-903Z` and `qalead-la-150-4f10c5fd-2026-10-24T19-32-16-170Z` each report **297 differences, 0 unexplained, 0 missing** against baseline-3; every difference names its LA-IC expected file. None is attributed to B/C tracker commit `4008afb9`. See §3 and the [per-path table](../LA-E7-08/per-test-id-D3-D4.md#golden-v2-response-differences). |
| `AC-LA-E0-01-05` | **PASS** | `E0-01-DOC-3` | `git diff --name-only bd368ff39fb4c533fc105e7c5ee81a59e618d99a 4f10c5fd9ca4dd0a5f636b34d7454e0db7b6849c -- services/cogniate-app/src/providers/ services/lti-service/src/profiles/standard.ts services/lti-service/src/profiles/canvas.ts services/lti-service/src/profiles/blackboard.ts` (plus `--name-status`, `--diff-filter=ACMR`, diff from `86bdc24c`, and `git ls-tree`) | **No new or remaining file** under `services/cogniate-app/src/providers/` or `services/lti-service/src/profiles/{standard,canvas,blackboard}.ts` at `4f10c5fd` (`0` added/modified/copied/renamed files; all `11` old files remain deleted `D`). `r2/ac04-ac05-git.txt` |

---

### 1. `AC-LA-E0-01-05` — Moved-File Audit After Wave-End Merge `4f10c5fd`

- **Commands and exact outputs (`~/cogniate-qa-runs/LA/LA-E0-01/r2/ac04-ac05-git.txt`):**
  1. **Diff against `<old merge base>` (`G-BASE` `bd368ff39fb4c533fc105e7c5ee81a59e618d99a`, `git merge-base 86bdc24c 78971b03`) and intake `1b17261be97c4701b928fa9dc2fa74c6d23028f6`:**
     ```sh
     git diff --name-only bd368ff39fb4c533fc105e7c5ee81a59e618d99a 4f10c5fd9ca4dd0a5f636b34d7454e0db7b6849c -- \
       services/cogniate-app/src/providers/ \
       services/lti-service/src/profiles/standard.ts \
       services/lti-service/src/profiles/canvas.ts \
       services/lti-service/src/profiles/blackboard.ts
     ```
     With `--name-status`, all 11 paths are deletions (`D`) from `LA-E1-05` and `LA-E1-07`:
     ```text
     D	services/cogniate-app/src/providers/blackboard.ts
     D	services/cogniate-app/src/providers/canvas.test.ts
     D	services/cogniate-app/src/providers/canvas.ts
     D	services/cogniate-app/src/providers/common.ts
     D	services/cogniate-app/src/providers/index.ts
     D	services/cogniate-app/src/providers/moodle.ts
     D	services/cogniate-app/src/providers/templates.ts
     D	services/cogniate-app/src/providers/types.ts
     D	services/lti-service/src/profiles/blackboard.ts
     D	services/lti-service/src/profiles/canvas.ts
     D	services/lti-service/src/profiles/standard.ts
     ```
     Filtering for non-deleted files (`--diff-filter=ACMR`):
     ```sh
     git diff --diff-filter=ACMR --name-only bd368ff39fb4c533fc105e7c5ee81a59e618d99a 4f10c5fd9ca4dd0a5f636b34d7454e0db7b6849c -- \
       services/cogniate-app/src/providers/ \
       services/lti-service/src/profiles/standard.ts \
       services/lti-service/src/profiles/canvas.ts \
       services/lti-service/src/profiles/blackboard.ts
     # (0 lines, 0 bytes)
     ```
  2. **Diff against the pre-merge LA parent (`4f10c5fd^1` = `86bdc24c727a5e324704f2d10eb25e694d9924d7`) and tree check at `4f10c5fd`:**
     ```sh
     git diff --name-only 86bdc24c727a5e324704f2d10eb25e694d9924d7 4f10c5fd9ca4dd0a5f636b34d7454e0db7b6849c -- \
       services/cogniate-app/src/providers/ \
       services/lti-service/src/profiles/standard.ts \
       services/lti-service/src/profiles/canvas.ts \
       services/lti-service/src/profiles/blackboard.ts
     # (0 lines, 0 bytes)

     git ls-tree -r --name-only 4f10c5fd9ca4dd0a5f636b34d7454e0db7b6849c -- \
       services/cogniate-app/src/providers/ \
       services/lti-service/src/profiles/standard.ts \
       services/lti-service/src/profiles/canvas.ts \
       services/lti-service/src/profiles/blackboard.ts
     # (0 lines, 0 bytes)
     ```
  3. **B/C range check on the moved paths (`bd368ff..78971b03`):**
     ```sh
     git diff --name-only bd368ff39fb4c533fc105e7c5ee81a59e618d99a 78971b0300ab171029e8ce94dbba30db37b23dea -- \
       services/cogniate-app/src/providers/ \
       services/lti-service/src/profiles/standard.ts \
       services/lti-service/src/profiles/canvas.ts \
       services/lti-service/src/profiles/blackboard.ts
     # (0 lines, 0 bytes — B/C touched none of these moved files after G-BASE)
     ```

---

### 2. `AC-LA-E0-01-04` Part 1 — `npm run check` at `4f10c5fd`

Executed in a fresh `git clone --no-hardlinks` (`~/cogniate-qa-runs/LA/LA-E0-01/r2/src` at `4f10c5fd9ca4dd0a5f636b34d7454e0db7b6849c`):

| Check | R5 (spec) | Intake `1b17261` (Round 1) | Wave-end merge `4f10c5fd` (Round 2) |
| --- | --- | --- | --- |
| `lint` + `typecheck` | PASS | PASS | **PASS** (exit `0`) |
| `test:unit` (Vitest) | `70` files; `1,123` passed, `5` skipped (`1,128`) | `70` files; `1,123` passed, `5` skipped (`1,128`) | **`204` files; `3,324` passed, `5` skipped (`3,329`)** (same `5` course-fixture skips; +`2,201` unit tests from LA epics E1–E6 and B/C `4008afb9` `tracker.test.ts`) |
| `test:infra` (`node --test`) | `111` tests, `14` suites | `111` tests, `14` suites (`111` pass, `0` fail) | **`255` tests, `23` suites (`255` pass, `0` fail, `0` skipped)** (+`144` infra tests from LA and ADR-012) |
| `test:k0` (`tests/ltiaas/k0/vitest.config.mts`) | — | — | **`3` files; `149` passed (`149`)** |
| `fitness:lms-names` (F1) | — | — | **`F1 PASS: 0 files with hits, 0 hits`** |
| `fitness:rules` (F5) | — | — | **`F5 PASS: 6 rules (`audit-event-delete`, `channel-sql-tables`, `connection-lms`, `no-score-sync`, `protocol-urls`, `sql-portability`), `0` hits`** |
| Time & working tree | `69 s` | `npm ci` `2 s`; `npm run check` `78 s`; status empty | **`npm ci` `3 s`; `npm run check` `98 s`**; `git status --short` empty (`0` bytes) |

The QA-3 counts match the Lead's trial check recorded in the `4f10c5fd` merge commit message (`3324 unit, K0 149, F1 0, F5 0`).

---

### 3. `AC-LA-E0-01-04` Part 2 — Golden Compare at `4f10c5fd` and B/C Product Commit Attribution

- **B/C Commits Touching Product Code (`git log bd368ff..78971b03 -- apps services packages`):**
  ```text
  commit 4008afb92fe983d52db33442e060210b929966c8
  Author: quang <nguyenthanhquang.cse@gmail.com>
  Date:   Thu Oct 22 20:14:59 2026 +0700

      M3 (wip, R1): attach HTML tracker when child documents parse

   apps/player/src/html/tracker.test.ts | 169 ++++++++++++++++++++++++++++++++++-
   apps/player/src/html/tracker.ts      |  77 +++++++++++++---
   2 files changed, 229 insertions(+), 17 deletions(-)
  ```
  - Only **`4008afb92fe983d52db33442e060210b929966c8`** touches `apps`, `services`, or `packages` between `G-BASE` (`bd368ff39fb4c533fc105e7c5ee81a59e618d99a`) and `main` (`78971b0300ab171029e8ce94dbba30db37b23dea`). (The other non-doc B/C commits in `86bdc24c..4f10c5fd` touch only `README.md`, `infra/README.md`, and `tests/{acceptance,e2e,host}/**`; see `r2/ac04-ac05-git.txt`.)
- **Did Any Golden Field Change Because of `4008afb9`?**
  - **No (`0` golden fields changed because of `4008afb9`).** As expected in A1 conformance round 3 (`docs/architecture/ltiaas/conformance-A1.md:13`, `"G3 and G4 (API and DR pages): none"` because the HTML tracker runs only in the browser player), and as proven in `docs/reviews/LA-E0-03/qa.md` Round 6 §1 (`"100% Golden v1 Path & <id:n> Preservation"`), comparing the original `G-BASE` capture (`tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6/`) against the re-captured baseline (`tests/ltiaas/golden/78971b0300ab171029e8ce94dbba30db37b23dea/`) after port alignment reports **zero changes on any v1 path** (only the newly added Golden v2 Moodle keys `G1.connections.moodle-{connected,disabled,registered}`, `G2.moodle`, `G3.moodle`, and `G4.moodle`).
- **Golden v2 Dry-Run Compare (`4f10c5fd` against `78971b03`, cited from `docs/reviews/LA-E0-03/qa.md` Round 6 §2–§3):**
  - Baseline capture (`qalead-la-110` on `78971b0300ab171029e8ce94dbba30db37b23dea`): stored in `tests/ltiaas/golden/78971b0300ab171029e8ce94dbba30db37b23dea/` (repeatability vs `qalead-la-111`: `EQUAL: 0 differences`, `4 ms`).
  - Candidate capture (`qalead-la-112` on `4f10c5fd9ca4dd0a5f636b34d7454e0db7b6849c`): `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E0-03-r2/golden-cand-4f10c5fd`.
  - Compare command and output (`/Users/quangnguyen/cogniate-qa-runs/LA/LA-E0-03-r2/logs/compare-4f10c5fd-vs-78971b03.txt`):
    ```sh
    node tests/ltiaas/golden/compare.mjs \
      --base tests/ltiaas/golden/78971b0300ab171029e8ce94dbba30db37b23dea \
      --candidate /Users/quangnguyen/cogniate-qa-runs/LA/LA-E0-03-r2/golden-cand-4f10c5fd \
      --expected LA-IC-01,LA-IC-03,LA-IC-04,LA-IC-12,LA-IC-13,LA-IC-14,LA-IC-15,LA-IC-16,LA-IC-17,LA-IC-18,LA-IC-19,LA-IC-20,LA-IC-21
    # EQUAL: 297 differences (0 not explained), 0 expected changes missing; expected-delta files: LA-IC-01, LA-IC-03, LA-IC-04, LA-IC-12, LA-IC-13, LA-IC-14, LA-IC-15, LA-IC-16, LA-IC-17, LA-IC-18, LA-IC-19, LA-IC-20, LA-IC-21; 21 ms
    ```
    All `297` differences are LA expected deltas (`275` `LA-IC-01`, `3` `LA-IC-04`, `3` `LA-IC-12`, `13` `LA-IC-14`, `2` `LA-IC-15`, `1` `LA-IC-16`); `0` unexplained differences and `0` differences from B/C commits.
- **Re-gate D3/D4 golden comparisons (`LD-29`): PASS.** Both use product `4f10c5fd`, frozen source `794f649c`, and the golden v2 baseline on `78971b03` pinned in baseline-3 `1ae6716b`. Each capture passed 9/9 entries and 8/8 unique IDs.

| Run | Full capture run ID | Comparison against baseline-3 | Raw comparison log |
| --- | --- | --- | --- |
| D3 | `qalead-la-139-4f10c5fd-2026-10-24T21-05-44-903Z` | **297 differences, 0 unexplained, 0 missing** | `RUN-D3/logs/qalead-la-139-golden-compare.txt` |
| D4 | `qalead-la-150-4f10c5fd-2026-10-24T19-32-16-170Z` | **297 differences, 0 unexplained, 0 missing** | `RUN-D4/logs/qalead-la-150-compare.txt` |

The log paths are under `/Users/quangnguyen/cogniate-qa-runs/LA/`. The D3 comparison normalizes URL ports from 9473 to 9643 on a separate copy; its raw capture is unchanged. The D3 and D4 difference maps, including before/after values, match. These are approved changes, not byte equality with the baseline.

Every response-path difference is named in the [per-test-ID and golden-path table](../LA-E7-08/per-test-id-D3-D4.md#golden-v2-response-differences): LA-IC-01 (275), LA-IC-04 (3), LA-IC-12 (3), LA-IC-14 (13), LA-IC-15 (2) and LA-IC-16 (1). **Zero differences are attributed to B/C tracker commit `4008afb9`.** That commit is present in both baseline `78971b03` and candidate `4f10c5fd`; all 297 observed changes have LA-IC attribution. This agrees with the earlier v1-path preservation proof above. Source and attribution proof: `REGATE/conductor-20261024T202424Z/bc4008-golden-attribution.json` and `golden-comparison-audit.json`.

**AC-LA-E0-01-04: PASS.** Part 1 retains the check result above. Part 2 is complete with both final golden comparisons; no further Docker run was needed for this record.


---

## Round 1 (Original Intake `1b17261`, 2026-10-22)

Tester: QA-3 (Orca task `task_5394ed2915f5`, dispatch `ctx_a8bd71d6aab9`), 2026-10-22. Spec: `docs/architecture/ltiaas/tasks/LA-E0-01.md` at `c804e98` (AC-01 excludes `tests/ltiaas/**`, Lead clarification).

Independence: the Lead made this git-only intake commit. QA-3 checked it with its own commands. QA-3 did not read product source, Author notes or reviewer files.

| Item | Value |
| --- | --- |
| Intake SHA | `1b17261be97c4701b928fa9dc2fa74c6d23028f6` on `quang/ltiaas-milestone` (merge of `f1f5a55` and G-BASE) |
| G-BASE | `bd368ff39fb4c533fc105e7c5ee81a59e618d99a` (`nguyenthanhquang152/lti-multi-lms` HEAD, also at the time of this check) |
| LA-H10, merge mode | frozen candidate, `wave-end` |
| Lane and slot | none (no Docker) |
| Clone | `~/cogniate-qa-runs/LA/LA-E0-01/r1/src`: `git clone --no-hardlinks --no-checkout`, `checkout --detach <intake SHA>`, push URL disabled |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/LA-E0-01/r1/` (umask 077): `ac01-git.txt`, `ac02-message.txt`, `npm-ci.log`, `check.log`, `skipped-attribution.log`, `timing.txt`, `status-after.txt` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E0-01-01 | PASS | E0-01-DOC-1 | `git merge-base --is-ancestor bd368ff 1b17261`; `git diff bd368ff 1b17261 -- services packages apps infra tests ':(exclude)tests/ltiaas/**' package.json package-lock.json` | Exit 0. The diff is 0 bytes. Without the exclude, the only path is `A tests/ltiaas/TEST-STRATEGY.md`. `ac01-git.txt` |
| AC-LA-E0-01-02 | PASS | E0-01-DOC-2 | `git log -1 --format=%B 1b17261` | Line 3 names `bd368ff39fb4c533fc105e7c5ee81a59e618d99a`. Line 4: "LA-H10 answer: frozen candidate". Line 5: "Merge mode: wave-end". `ac02-message.txt` |
| AC-LA-E0-01-03 | PASS | E0-01-K0-1 | `npm ci`, then `npm run check`, in the clean clone | Both commands exit 0. Counts below. `npm-ci.log`, `check.log` |
| AC-LA-E0-01-04 | pending: wave-end merge (end of B1) | — | — | — |
| AC-LA-E0-01-05 | pending: wave-end merge (after LA-E1-05 and LA-E1-07) | — | — | — |

### AC-03 counts

| Count | R5 (spec) | Intake `1b17261` |
| --- | --- | --- |
| Vitest | 70 files; 1,123 passed, 5 skipped (1,128) | 70 files; 1,123 passed, 5 skipped (1,128) |
| Skipped tests | 5 course-fixture tests | The same 5: `packages/package-inspector/src/inspect.test.ts` (3) and `services/cogniate-app/src/app/app.test.ts` (2). The course zips are git-ignored and not in the clone (`skipped-attribution.log`, a verbose run of these two files). |
| Infra (`node --test`) | 111 | 111 tests, 14 suites: 111 pass, 0 fail, 0 skipped |
| Time | 69 s | `npm ci` 2 s (warm cache); `npm run check` 78 s |

The counts are equal to R5. Other facts: 115 `FSTDEP022` warning lines (R5 also has 115); `git status --short` in the clone is empty after the run. Note: R5 §3 records these counts at `9fcfd72`, but the spec text says `aaa823b`. The counts are the same, so this has no effect.

## Other checks (not ACs)

- The intake tree `d48fcb4` is equal to `git merge-tree --write-tree f1f5a55 bd368ff`. So the intake commit is a clean merge result with no conflict and no hand edit (spec "May edit": merge result only).
- G-BASE product code equals `9f8ac62`. `9f8ac62` is an ancestor of `bd368ff`, and `git diff 9f8ac62 bd368ff -- services packages apps package.json package-lock.json` is empty.
- The full `bd368ff..1b17261` diff has LA documents only: `docs/architecture/ltiaas` (119 files), `docs/team/ltiaas` (22), `docs/research/ltiaas` (6), `docs/reviews/LA-DESIGN` (3), `docs/reviews/LA-BREAKDOWN` (3), and `tests/ltiaas/TEST-STRATEGY.md`.

## Regression

R0: the AC-03 run. No new suite in this task. The measured time of the existing check is 78 s.
