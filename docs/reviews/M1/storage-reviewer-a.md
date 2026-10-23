# M1 storage implementation review — Reviewer-A

Verdict: **CHANGES_REQUESTED**

Round: 1

| Item | Value |
|---|---|
| Reviewer | Reviewer-A (Claude Code, Opus 5.5 xhigh) |
| Date | 2026-10-21 |
| Task / dispatch | `task_5580d3cb79c5` / `ctx_94a0f5776563` |
| Candidate (exact source) | `f8a869bc6990d966b669352bedd8ec528adb4c08` |
| Diff base | `8138097889f87359d5055bb1d79766b5ed842f92` |
| Contract | `89be93cc9e24f74c2b32ce72180ad4c706d000f7` (ADR-012 revision 3.3, `docs/architecture/tasks/M1.md`, `docs/architecture/tasks/M3.md`) |
| Lens | Correctness, security and data integrity |
| Runtime credit | **None.** This is a static source review. |

This is the planned review of the storage **implementation**. It is not the M0 design review in `docs/reviews/M0/storage-reviewer-a.md`.

## 1. Summary

The implementation follows the accepted design closely. The privilege drop, the operation lock, the journaled restore, the recovery table, quarantine and the old-build override agree with ADR-012 revision 3.3 in every place that I traced.

One MAJOR finding blocks approval:

- **A-SI-01.** Many refusals write their code only as stderr text. The contract (M1.md:224) says that "Refuses `<code>`" means exit 1 **and the code in the JSON output**. The QA oracle checks exactly this. So 10 planned QA rows (12 checks) will fail on correct behavior.

One MINOR finding and one NIT can be deferred.

## 2. Inputs and independence

- I reviewed the exact candidate in an isolated detached clone (`/tmp/rva-f8a869b`, `HEAD` = `f8a869bc6990d966b669352bedd8ec528adb4c08`).
- I read the diff from `8138097`, the accepted contract, the Author hand-over in `.tmp/author-handoff/task_3b908985fd0b/`, and the QA preparation (`049da68`, follow-up `8a66a33`) in `tests/host/` and `docs/reviews/M1/qa.md`.
- I did not read the Reviewer-B report or any draft from another reviewer.
- I ran no Docker, runtime or product commands. I did not run the unit tests. The Lead's clean-clone root check (1086 unit tests and 62 infra tests at `f8a869b`, host only) is the Lead's evidence, not mine.
- I changed only this file.

## 3. Findings

| ID | Severity | Status | File:line | Short statement |
|---|---|---|---|---|
| A-SI-01 | MAJOR | **Required** | `infra/scripts/stack-data.mjs:817`, `infra/scripts/lib.sh:343`, `infra/scripts/lib.sh:398`, `infra/scripts/stack-data.sh:112`, `infra/scripts/storage-compat.sh:56` | Refusal codes are only in stderr text, not in JSON output |
| A-SI-02 | MINOR | Deferral possible | `infra/scripts/stack-data.mjs:519-523` | `recover` reads an unparseable journal as absent (R0 or R1, not R6) |
| A-SI-03 | NIT | Deferral possible | `infra/scripts/storage-oplock.sh:321-323` | Any child-process failure is reported as "Docker does not answer… Nothing was changed." |

## 4. Required fix

### A-SI-01 (MAJOR): refusal codes are not in JSON output

**Contract.** `docs/architecture/tasks/M1.md:224`:

> "Refuses `<code>`" means: exit 1, the code in the `storage_preflight` (or the command's) JSON output, and nothing changes.

**QA oracle.** `tests/host/storage-oracle.mjs:37-40` (`assertRefuses`) requires exit 1 **and** `namesCode(jsonLines(stdout, stderr), code)`. `jsonLines` (`storage-oracle.mjs:22-28`) accepts only lines that start with `{` and parse as JSON. A plain-text line never counts.

**Implementation.** These paths exit 1 with the correct behavior, but write the code only as text:

1. `infra/scripts/stack-data.mjs:817`. The `Refused` catch in `main` prints `err.message` to stderr and returns 1. It drops `err.code`, which the `Refused` class carries (`stack-data.mjs:39-41`). This path covers:
   - `import_target_not_fresh` (`stack-data.mjs:652`, `:663`);
   - `restore_target_state` (`:659`);
   - `pair_mismatch` (`:667`);
   - `import_needs_legacy_backup` (`:653`) and `restore_needs_volume_backup` (`:662`);
   - `backup_source_not_ok:<state>` (`:602`);
   - `legacy_hot_journal` and the other legacy-backup refusals (`:136`);
   - `manifest_invalid` and `manifest_incomplete` from `validate` (`:169-186`).
2. `infra/scripts/lib.sh:343`. `prepare_content_folders` echoes `content_path_unsafe` as text.
3. `infra/scripts/lib.sh:398`. `old_layout_check` echoes `old_layout_container` as text. It runs both in `stack:up` (through `legacy_scan`, `lib.sh:407`) and in the legacy backup (`stack-data.sh:50`).
4. `infra/scripts/stack-data.sh:112`. Quarantine step 3 echoes `volume_in_use` as text.
5. `infra/scripts/storage-compat.sh:56`. The old-build path uses `die` with `content_path_unsafe` as text. No QA row that I found checks this path, but the same rule applies.

**Paths that are already correct** (for comparison):

- The operation-lock refusals write `storage_lock_refused` with `reason` as JSON on stdout (`storage-oplock.sh:63-71`, `:313-317`).
- The legacy scan writes `storage_legacy_scan` with `code` as JSON (`stack-data.mjs:746`, the decision from `legacyDecide`, `:100-127`).
- The preflight writes `storage_preflight` lines.
- The content check writes `storage_content_check` with `result: content_missing` through `logTo` (`stack-data.mjs:485`, `:587-592`).

**Effect on the planned QA rows** (`tests/host/storage-rows.mjs`). Each row below calls `assertRefuses` or `refusal()` (or `namesCode` on `res.lines`) with a code from the list above. Each will fail on the correct exit and the correct no-change result:

| QA row | Line | Code |
|---|---|---|
| `d-content-folder` | 562 | `content_path_unsafe` |
| `h-open-journal` (drill accumulator) | 1142 | `backup_source_not_ok:journal_open` |
| `g-damaged` (incomplete-manifest case) | 696 | `manifest_incomplete` |
| `g-quarantine-in-use` | 790 | `volume_in_use` |
| `h-target-state` | 846, 848 | `restore_target_state`, `import_target_not_fresh` |
| `e-hot-journal` (legacy backup half) | 869 | `legacy_hot_journal` |
| `e-old-layout` (`stack:up` and legacy backup) | 878, 881 | `old_layout_container` |
| `h-pair-mismatch` | 902 | `pair_mismatch` |
| `e-import-nonfresh` | 984 | `import_target_not_fresh` |
| `h-old-manifest` (restore half) | 992 | `import_target_not_fresh` |

This is not only a test-harness problem. The contract defines the refusal as a JSON fact, so that an operator tool or a test can read it without parsing English text. The Author hand-over does not show a control for this rule. The unit tests in `services/lti-service/src/cli/stack-data.test.ts` check the exit code and the stderr text, so they cannot see the gap.

**Required behavior.**

- On every refusal path above, write one JSON line (stdout or stderr) that names the exact code as a string value. Examples: `{"event":"storage_refused","command":"restore","code":"pair_mismatch"}`, or a `reason` field as the lock helper does. For `backup_source_not_ok`, keep the `code:detail` form (`backup_source_not_ok:journal_open`), which `namesCode` accepts.
- Keep the exit code (1), the human text and the no-change result as they are now.
- In `stack-data.mjs`, the smallest fix is in the `Refused` catch at `:817`: when `err.code` is set, write the JSON line before the text. Make sure every `Refused` that the contract names has a code. Some `Refused` calls have no code (for example `:133`, `:134`, `:137`). Check them against the contract code list.
- In the three shell scripts, write the JSON line next to the existing `echo`. A `printf '{"event":"storage_refused","code":"%s"}\n'` with a fixed code is enough; do not put paths or names into the JSON without escaping.
- Add one unit or infra test per path family that parses the JSON line and finds the code.

## 5. Minor deferrals

### A-SI-02 (MINOR): `recover` reads an unparseable journal as absent

**Code.** `infra/scripts/stack-data.mjs:519-523`:

```js
const lj = lti && !lti.invalid && journalOf({ journal: { present: true, ok: true, value: lti } });
const aj = app && !app.invalid && journalOf({ journal: { present: true, ok: true, value: app } });
const { row } = classifyJournals(lti === null ? null : lj, app === null ? null : aj);
```

`readJournal` (`stack-data.mjs:246-250`) returns `{ invalid: true }` for a journal that does not parse. Then `lj` (or `aj`) becomes `false`, not `{ invalid: true }`. `classifyJournals` (`infra/scripts/sqlite-lock-probe.mjs:114-128`) returns R6 only for `?.invalid`. For `false`, it uses `terminal(false) === true`, so it reads the journal as absent.

**Failure scenarios.**

- lti `committed` (or `rolled_back`) and an unparseable app journal: row R0, exit 0, "nothing to recover".
- Both journals unparseable: row R0, exit 0.
- lti `prepared` and an unparseable app journal: row R1. `cancel('lti', …)` changes the lti volume (it removes the staging and writes the lti journal), and exit 1 says "the targets equal the state before (verified)".

The contract (§8, R6) says: change nothing, exit 2.

A journal file that parses to a falsy JSON value (`null`, `false`, `0`, `""`) has the same problem. `readJournal` returns `null` for the literal `null`, so recover treats the file as absent.

**Why MINOR.** The start gate stays safe. `evaluateState` reads the same file as `journal_inconsistent`, so `stack:up` refuses. The R1 change touches only the staging of a prepared operation, not the live database files. But recover reports success on an R6 state, which misleads the operator, and in the R1 case it changes a volume where the contract says change nothing.

**Test gap.** The R5/R6 test (`services/lti-service/src/cli/stack-data.test.ts:440-452`) breaks the app journal while the lti journal is in a non-terminal swap state. That case falls through to the final `return { row: 'R6' }` by chance. It does not cover a terminal or `prepared` lti journal.

**Suggested fix.** Pass `{ invalid: true }` to `classifyJournals` for any present journal that does not parse or does not validate. For example, `const lj = lti === null ? null : (lti.invalid ? lti : journalOf(…))`, and the same for app. Treat a present file that parses to a non-object as invalid. Add tests: lti `committed` with a broken app journal, lti `prepared` with a broken app journal, and both broken. Each must give exit 2 and no change.

### A-SI-03 (NIT): misleading text for a failed child process

`infra/scripts/storage-oplock.sh:321-323` maps every non-`Refusal` error that has `status` or `signal` to "Docker does not answer… Nothing was changed." But this also includes a `docker rm` that Docker refuses in the A6 loop (`:138-142`). By then the lock was reclaimed (A5, `:127-130`), `storage_lock_acquired` was written, and earlier inactive storage containers may already have been removed. So the text can be wrong about the cause and about "nothing". Exit 1 and the lock release (`:145`) are correct. **Suggestion:** add `err.message` (or the failed command) to the text, and say "No data was changed".

## 6. Verified (static, against the contract)

I traced each item below to code. These are source facts only. They are not runtime proof.

### Named volumes and content binds

- `ltidb` and `appdb` are named volumes (`infra/compose.yaml:482-483`).
- The content folders are nested long-syntax binds with `create_host_path: false` (`compose.yaml:190`, `:195`, `:401`, `:422`, `:428`, `:434`).
- `prepare_content_folders` (`lib.sh:338-354`) refuses a symbolic link, a non-directory or a folder of another owner before any container starts. Only the refusal output is wrong (A-SI-01).

### Root-only preparation and privilege drop

- The `storage-preflight` and `maintenance` services run as `0:0` with `network_mode: none`, `restart: "no"`, the `storage` profile and the `org.cogniate.storage` labels (`compose.yaml:357-373`, `:378-404`).
- `prepareFolder` (`sqlite-lock-probe.mjs:249-278`) does only the §4 root steps: the volume root chown and chmod 0700, and mountpoints that are created or fixed only when they are empty and owned by root.
- `dropPrivilege` (`sqlite-lock-probe.mjs:238-243`) calls setgroups, then setgid, then setuid, in the correct order.
- In `check` mode, the order is read → gate → prepare → drop → leftovers → state → probe → init. All writes after the preparation happen as the host user.
- The report mode writes `storage_report_identity` after the drop and before the last summary line (`sqlite-lock-probe.mjs:548`). This agrees with the contract reading.

### WAL lock preflight

- The holder child (`sqlite-lock-probe.mjs:283-301`) opens WAL, runs `BEGIN IMMEDIATE`, and answers `PING` with `PONG inTransaction=1`.
- The parent requires extended errcode 5 at `timeout: 0` (`:380`) and `PONG inTransaction=1` (`:382`). Any other result is `probe_error`.
- The `COMMIT` release is the positive control. `cleanLeftovers` (`:401-413`) removes only `.lock-probe-*` scratch.

### Operation lock and child/group behavior

- The lock record holds `pid`, `pidStart` (from `LC_ALL=C ps -o lstart=`, `storage-oplock.sh:28`) and `pgid`.
- `recordLive` (`:39`) is "owner live OR another process in the group". `groupMembers` (`:34-38`) excludes the helper's own pid.
- A1–A6 are as in §7 (`:86-160`): re-entry refuses (`:112`), a live owner refuses with `operation_in_progress` (`:113-116`), and a takeover is a rename to `stale-<runId>` (`:127-130`). A5 refuses `storage_writer_active` for an active storage container (`:123-124`). A6 removes only inactive ones (`:138-142`).
- The bash wrapper passes `--pid "$$"` and sets `trap … EXIT` release with `exit 130` and `exit 143` for INT and TERM (`storage-oplock.sh:351-355`).
- `start_build_runner` (`lib.sh:289`) starts the runner in its own job group (`set -m`), so a background build does not keep the lock group live.

### Fail-closed guards and order

The guard is first and the lock is second in every changing command:

| Script | Guard, lock and check order |
|---|---|
| `stack-up.sh` | guard `:12`, lock `:13`, content `:34`, legacy scan `:59`, preflight `:61`; a `mark-started` failure exits 1 (`:90`) |
| `stack-restart.sh` | guard `:13`, lock `:14`, content `:33`, preflight `:34` |
| `stack-reset.sh` | guard `:13`, lock `:14` |
| `stack-data.sh` | guard `:30`, lock `:31`, `require_services_stopped` `:32` |
| `qa-suite.sh`, `e2e-reset.sh` | guard only (`:15`, `:13`); their inner `stack-up.sh` and `stack-reset.sh` runs take the lock (§7) |

The §6 ordered table in `evaluateState` (`sqlite-lock-probe.mjs:136-193`) puts rows 1–18 in the contract order. The journal rows come before the unknown-entry, mountpoint, owner and identity rows.

### Paired identities, journals and recovery

- The restore is lti first, through prepared → staged → swapping → swapped → committed.
- `checkedMove` (`stack-data.mjs:261-275`) verifies the source bytes and requires that the target is absent.
- The R3 rollback order (after-files out before before-files back) is as in §8. Unknown bytes give `rollback_failed`.
- R4 completes the commit only after `verifyAfter` (`:536-545`).
- The drills (`--stop-after`, `--pause-after`) need `STORAGE_DRILL=1` (`stack-data.mjs:288-293`).
- `classifyJournals` itself maps `{ invalid: true }` to R6 correctly. Only the caller loses the flag (A-SI-02).

### Backup, import, restore and quarantine

- `volumeBackup` refuses unless the state is `OK` (`stack-data.mjs:602`). The volumes mount read-only for a backup (`stack-data.sh:59`, `compose.yaml:392-393`). A service change during the backup writes `INCOMPLETE` (`stack-data.sh:63-65`).
- `volumeRestore` (`stack-data.mjs:630-688`) applies the contract precedence: backup validation (`:631`) → target state (`:652`, `:659`) → source kind (`:653`, `:662-663`) → pair rule (`:667`).
- The content check runs on the staged app database before any swap (`:484-486`). A missing package cancels the restore with no target change.
- Quarantine copies first and removes a volume only after `volume_in_use` is checked (`stack-data.sh`, steps 1–5). Unknown entries are preserved in the copy (`quarantineCopy`, `stack-data.mjs:691`).

### Option C unit-fixture clarification

- `services/lti-service/src/cli/stack-data.test.ts` has 214 `expect` calls. All 30 `expect` calls from `8138097` are still present and keep their meaning: 27 are verbatim, and 3 add only `--source legacy`.
- The old bind-writing `restore` export (`8138097:infra/scripts/stack-data.mjs:98`) is removed. At `f8a869b` the only restore path is the journaled `volumeRestore`.

### Old-build compatibility

- The override is limited to `b0b83a8289e1bf9cf349068aca184f0879e9aaf0` and `9f96f7b24cd0aed702e4dc40373bdda4307aad31` (`infra/compat/storage-compat.knobs.json:4`, `infra/scripts/storage-compat.test.mjs:16`).
- `storage-compat.sh` uses the marker `x-cogniate-storage-compat`. It checks all four copies against `infra/compat/storage-compat.sha256` before it sources the copied lock helper. The `run --` allowlist, the old-only `HEAD` check and the candidate guard are as in §12.
- I recomputed the four hashes in the clone. They match the `.sha256` file.

### Original LMS isolation

The range `8138097..f8a869b` does not change the Moodle, Blackboard or Canvas services, their routes or their assertions.

- In `infra/compose.yaml`, the changed lines are only in `lti-service` (`:130`, `:146`), `cogniate-app` (`:164`, `:183-195`), the new storage services (`:354-405`) and the new volumes (`:482-483`). The `moodle`, `lms-sim` and `qa-platform` blocks are unchanged.
- No file under `services/lti-service/src` changes, except `cli/stack-data.test.ts`.
- Only two lines change in the existing acceptance harness, and both add something. `tests/host/run-t1.mjs` adds an information note, and `tests/acceptance/M1/common/migration.probe.ts` adds a `storage-lock-scope` stage dispatch. No existing assertion changes.

### Final precision items in the QA harness

| Item | Evidence |
|---|---|
| A-S-14 (identity binding) | `tests/host/storage-docker.mjs:173-177` binds macOS 27.0.1 arm64, Docker CLI 29.9.1 (`678271184175…`) and Compose 5.6.0 (`1ec06408b809…`). `compareIdentity` (`:195`) compares all six values. `identityBoundary` (`tests/host/core.mjs:155-159`) sets `state.abort` to BLOCKED on a mismatch. So G-1 applies only to these identities: match or block. |
| B-S-23 | `a-first-start-resume` uses `firstStartSetup({ legacyPrecondition: true })` (`storage-rows.mjs:620`). The restore and import setup uses `legacyPrecondition: false` (`:845`). |
| G1-QA-01 | The ownership ledger lists and records containers, volumes and networks by the lane label (`storage-docker.mjs:222-245`). |
| G1-QA-02 | `dockerClock` reads the engine clock (`storage-docker.mjs:36-41`). `createdNotBefore` compares whole seconds (`:43`). |

The `storage_run` wrapper (`lib.sh:356`) uses `docker compose run --rm -T`. This matches the G-1 scope only for the recorded identities above. It gives no general claim.

The row count is 488 = 416 + 72. Only `c-host-negative` may be a conditional N/A.

## 7. QA preparation: runtime assumptions traced

The QA prep (`049da68`, follow-up `8a66a33`) lists assumptions that it did not measure (`docs/reviews/M1/qa.md`, about lines 690–800). I traced each one to the implementation. Fail-closed behavior alone does not prove that the interface is compatible.

| QA assumption | Implementation at `f8a869b` | Result |
|---|---|---|
| Refusal codes are JSON values; text alone is never a refusal | Text only on the paths in A-SI-01 | **Mismatch: A-SI-01** |
| `storage_lock_wait` and `storage_lock_refused` name the owner `runId`, `command`, `pid`, `acquiredAt` | `eventLine` with `ownerView` on stdout and in `infra/.logs/storage-lock.jsonl` (`storage-oplock.sh:63-71`, `:315`) | Agrees (source) |
| `storage_preflight` and `storage_preflight_summary` lines with `runId` | Written by `sqlite-lock-probe.mjs` `logLines` (`:436`) | Agrees (source) |
| `storage_content_check` with `content_missing` | `stack-data.mjs:485` through `logTo` on stdout | Agrees (source) |
| Refused restore of a damaged backup says "no target changed" | `stack-data.mjs:817` adds the text when it is not there | Agrees (source); the code is missing for `manifest_incomplete` (A-SI-01) |
| A broken journal gives `journal_inconsistent` at start | `evaluateState` | Agrees (source); `recover` differs (A-SI-02) |

## 8. Limits

- I give **no runtime acceptance credit**. All live rows stay UNVERIFIED until QA runs them in a Lead-approved runtime window.
- G-1 holds only for the recorded OS, Docker CLI and Compose plugin identities. Any other identity blocks.
- The Author evidence (`.tmp/author-handoff/task_3b908985fd0b/`) is diagnostic. I read it as context, not as proof.
- I did not run the unit tests, the infra tests or any Docker command.

## 9. Close condition

APPROVE needs **A-SI-01** fixed: every refusal path in §4 writes its code in a JSON line, with a test per path family. Then I need a re-review of that diff only.

A-SI-02 and A-SI-03 may be deferred with a recorded owner. I recommend fixing A-SI-02 in the same round, because the fix is small and the tests are easy to add.

---

# Round 2: follow-up review of the repaired candidate

Verdict: **APPROVE** (source only)

Round: 2

| Item | Value |
|---|---|
| Reviewer | Reviewer-A (Claude Code, Opus 5.5 xhigh), same retained session |
| Date | 2026-10-21 |
| Task / dispatch | `task_34365528ced3` / `ctx_ba60b67fd2af` |
| Candidate (exact source) | `a784522a3cdd9bb67453b03093092cac24e87402` |
| Diff base | `f8a869bc6990d966b669352bedd8ec528adb4c08` |
| Contract | `89be93cc9e24f74c2b32ce72180ad4c706d000f7` (ADR-012 revision 3.3), unchanged |
| B-SI-07 disposition | Architect `msg_4286bb7f2bc0` and Lead `msg_eefd866c15b1`, recorded at `8c4d565` |
| Author evidence | `.tmp/author-handoff/task_81a4c5dab4dc/`: held list `73a39c77b1f1370635ac3a0fc41c1a1eb0ae3afc06a30be727487dfb67661240`, evidence manifest `e547a151f34fab04ca0d00acf2aae06f9af5693dc1242fb54bced458ecf4098d`, report `be8000fd7cedcc5916a866ceb43d9595aa83781d67325155e2175b9958e12b6e` |
| Runtime credit | **None.** |

The round-1 text above stays unchanged. This section adds the round-2 result only.

## R2.1 Inputs, independence and method

- I reviewed the exact candidate in a new isolated detached clone (`/tmp/rva-a784522`, `HEAD` = `a784522a3cdd9bb67453b03093092cac24e87402`).
- I read:
  - the diff `f8a869b..a784522` of the 12 Author files;
  - the Author report, `controls.md`, `qa-compat.mjs` and `qa-compat.log`;
  - the repair scope in `docs/team/multi-lms-plan.md`;
  - the B-SI-07 disposition in the Lead dispatch;
  - the published round-1 report of Reviewer-B at `d2b39ea`, which the dispatch allows.
- I did not read a round-2 draft of Reviewer-B.
- I ran no Docker, runtime or product stack command, and I did not repeat the broad root check. The Lead's clean-clone root check at `a784522` (log SHA-256 `7e4744c8bdb1eca3e76ee9c52d0f8c87a1a9fcdc757f1bcc6f7504cb225d7250`) is the Lead's evidence, not mine.

**What I verified myself:**

- All 12 held files match `held-files.sha256`, and all 8 evidence files match `evidence.sha256`.
- The four compatibility copies match `infra/compat/storage-compat.sha256` (`shasum -c`: 4 of 4 OK).
- `tests/**` and `docs/architecture/**` have no change between `f8a869b` and `a784522`.
- `services/lti-service/src/cli/stack-data.test.ts`: all 214 `expect` lines of `f8a869b` are still present (a sorted multiset compare finds 0 missing lines; 297 now).
- The fake Docker in that file adds only opt-in branches (`FAKE_OLD_LAYOUT`, `FAKE_COPY_CONTAINER`, `FAKE_RM_FAIL`, `FAKE_VOLUME_RM_FAIL`). Its default answers are the same as before.
- In the three node test files, only three earlier assertion lines change, all in `storage-oplock.test.mjs`: two message texts for A-SI-03, and one "no raw text" check that is now stricter. The exit-code, "the command did not run" and lock-cleanup assertions stay.

**My host-only checks** (scratch folders, fake or no Docker; the scripts are in `/tmp/rva-checks/`):

| Check | `a784522` | `f8a869b` (control) |
|---|---|---|
| `recover` with a valid lti journal and an invalid app journal: 10 cases (`{"broken`, `null`, `0`, `[]`, `{}`, a folder, a link to a valid journal, `prepared` with `null` and with `{"broken`, both `null`) | 10 of 10: exit 2 and the tree is unchanged | 6 cases exit 0 "nothing to recover"; the 2 `prepared` cases change the tree |
| Probe mutants in a scratch copy, each against `node --test sqlite-lock-probe.test.mjs` (baseline 43 of 43 pass) | M1 (the exact B-SI-02 mutant), M2 (`(errcode & 0xff) !== 5`, accepts 261 and 517), M3 (an elapsed wait read as `probe_error`), M4 (initialization after the deadline), M5 (an exit timeout read as `probe_error`): each killed, 1 test fails | — |
| QA's frozen oracle (`tests/host/storage-oracle.mjs` `assertRefuses`) on real output: `content_path_unsafe` from a start script, `backup_source_not_ok:journal_open` (and no manifest), `source_unreadable` (with the entry, no manifest) | 3 of 3 PASS | 3 of 3 FAIL ("exit 1 without … in its JSON output") |
| A readable, unprepared volume (root 0755, `packages` absent): volume backup | exit 0; `unprepared` lists the two items; the volume is unchanged | exit 0, but the volume changes: the root mode becomes 0700 and `packages` is created (the read-only mode ran the §4 step as the owner) |
| Each refusal code that `tests/host/storage-rows.mjs` expects in `refusal()` or `assertRefuses()` (24 codes) | every code has a product path that writes it in a JSON line | — |

## R2.2 Disposition of the round-1 findings

| ID | Round-1 severity | Disposition | Code at `a784522` | Tests and checks |
|---|---|---|---|---|
| A-SI-01 / B-SI-01 | MAJOR / BLOCKER (shared) | **Closed** | `stack-data.mjs:43-48` (`Refused` with `code` and safe `details`; `refusalLine`), `:811` (legacy-backup catch), `:839` (drill refusals), `:849` (`prepare_failed`), `:880` (main catch); `lib.sh:335-342` (`storage_refusal_json`), `:356`, `:413`; `stack-data.sh:30`, `:41-42`, `:84`, `:117`; `storage-compat.sh:24-29`, `:64`, `:72`, `:75`, `:156` | `stack-data.test.ts:1007-1137` (17 volume-command cases, 5 legacy-backup cases, `prepare_failed`, the shell paths, the folder refusals); `storage-oplock.test.mjs` (stack:up `content_path_unsafe`); `storage-compat.test.mjs` (two wrapper cases); Author controls N10–N15, N21; my oracle check |
| A-SI-02 | MINOR | **Closed** | `stack-data.mjs:253-268` (`readJournal`: `null` only for ENOENT; a non-file, a parse failure, a non-object or a failed `validJournal` → `{ invalid: true }`); `:540` (`classifyJournals(lti, app)` gets that value directly) | `stack-data.test.ts:1166-1217` (9 values with a committed lti journal, 4 with a prepared one, both invalid, a folder, a link, and the R1/R0 regression); Author controls N8, N9; my 10-case check |
| A-SI-03 | NIT | **Closed** | `storage-oplock.sh:28-36` (`ps` stderr ignored), `:77` (`tagged`), `:133`, `:146`, `:154-165` (the cleanup loop releases on failure), `:330-345` (the message names the step, the exit status, a moved stale record and removed containers, then "No data was changed") | `storage-oplock.test.mjs` (two new A-SI-03 cases; the two changed message checks); Author controls N18, N19 |
| B-SI-02 | MINOR (required) | **Closed** | `sqlite-lock-probe.mjs:349-355` (`REAL_DRIVER`, `PROBE_BOUNDS`; a library seam only, no CLI flag or environment variable), `:361` (`probeFolder` takes `driver`), `:406` (only errcode 5 passes), `:432` (`cleanLeftovers` takes `removeFile`) | `sqlite-lock-probe.test.mjs:315-408`: errcodes 5, 261, 517, 6, 1, 10, 13, 773, none, the string `'5'`, a non-SQLite error, a primary-only code; a lock that is always granted; five holder failures; the release control; a cleanup failure; 900 stale files and 5 near-match names; my mutants M1 and M2 |
| B-SI-03 | MINOR (required) | **Closed** | `sqlite-lock-probe.mjs:308-332` (each wait gives a line, an end or a timeout), `:335-340` (`exitOf`), `:342` (`answer`: timeout → `timeout`, any other wrong answer → `probe_error`), `:416` | The "each elapsed wait" case (HELD, PONG, COMMITTED, exit), and the "exits or answers wrongly" case with a time bound; my mutants M3 and M5 |
| B-SI-04 | NIT | **Closed** | `sqlite-lock-probe.mjs:553` (`settled`: only one report), `:624` (`expired`: no identity is written after the summary), `:643-656` (on the deadline: one `storage_preflight` line per folder with `reason: timeout`, then the summary, exit 1). The entry point still calls `process.exit(code)`. | The "whole-run bound" case, also with a late probe that would pass; my mutant M4 |
| B-SI-05 | NIT | **Closed** | `stack-data.sh:103` (copy container: "Nothing was removed"), `:123-131` (step 3 names the containers already removed; the copy and both volumes stay), `:136` (step 4 names them; the Docker message stays, as §9 step 4 requires) | `stack-data.test.ts:1139-1164`; Author control N20 |
| B-SI-06 | NIT | **Closed** | `infra/README.md:92-98` (the §15 cleanup list, with `docker volume prune --all`; it agrees with ADR-012:688-693), `:171-175` (the §12 allowed and forbidden table, with old `stack:restart`, `stack:reset`, `e2e:reset`, `test:e2e`, `demo*`) | Document review only |
| B-SI-07 | NIT | **Closed, as the Architect disposition reads it** | See R2.3 | `stack-data.test.ts:1219-1284`; Author controls N16, N17; my unprepared-volume and `source_unreadable` checks |

## R2.3 B-SI-07 against the six required behaviors

The disposition is an existing-contract reading, not a design change. I checked the implementation only against its items 1–6.

1. **No §4 change; drop at once.** For `backup` and `quarantine-copy`, `writes` is false (`stack-data.mjs:829`). `dropPrivilege(ids)` runs at `:832`, before any read of volume data. Before that line, the code only parses arguments, reads `HOST_UID`/`HOST_GID` and builds paths. **Met.**
2. **Unprepared items are information.** `unpreparedItems` (`:632-646`) lists a root owner or mode and an absent or non-conforming mountpoint. The list goes into the `storage_backup` and `storage_quarantine_copy` lines (`:855-865`). It is never `prepare_failed`. **Met.**
3. **Backup "state OK" with the row-5 report semantics.** `volumeBackup` uses `evaluateState` (`:654-656`). Row 5 (`sqlite-lock-probe.mjs`, the mountpoint rule) accepts an absent mountpoint or an empty one owned by `HOST_UID` or by root. Rows 4–18 do not check the owner or mode of the volume root. The other codes and their order do not change. **Met.**
4. **A failed read as `HOST_UID` fails closed.** `readable` (`stack-data.mjs:615-623`) maps EACCES and EPERM to `source_unreadable` with an entry relative to the volume root. Backup: exit 1, no manifest. Quarantine copy: exit 1, and `stack-data.sh:98` then removes nothing. **Met**, with one diagnostic gap: see A-SI-04.
5. **Mounts and command fields unchanged.** `infra/compose.yaml` has no change since `f8a869b`. `STORAGE_MAINT_VOLUME_MODE=ro` stays for backup (`stack-data.sh:61`) and quarantine (`:97`). **Met.**
6. **Writers unchanged.** Restore, import and recover still run `prepareFolder` as root, then drop privilege (`stack-data.mjs:829-842`). The test at `stack-data.test.ts:1241` shows that a restore still prepares the root (0700) and the mountpoints. **Met.**

The existing scoped limit stays as the disposition states it. A read-only mode copies only what `HOST_UID` can read. An entry that only root can read stops the mode, and nothing is removed.

## R2.4 New findings

No new BLOCKER, MAJOR or MINOR finding. Two NITs, both deferrable:

| ID | Severity | File:line | Finding | Suggested action |
|---|---|---|---|---|
| A-SI-04 | NIT | `infra/scripts/sqlite-lock-probe.mjs:61-70` (`readJsonEntry`), used by `stack-data.mjs:654-656` | A volume backup does not name an identity or journal file that `HOST_UID` cannot read. `readJsonEntry` catches every read error and returns `ok: false`, so the state is `identity_invalid` or `journal_inconsistent`. The backup then refuses `backup_source_not_ok:<state>`, without `source_unreadable` and without the path. Host check: an identity or journal of mode 000 gives exit 1 and no manifest (fail closed), and the quarantine copy of the same volume names the path correctly. Only a file of the host user without a read bit reaches this case. A root-owned file stops first at row 6 (`owner_mismatch`), which is the contract code. | Optional: map EACCES in `readJsonEntry` to a distinct result, or check readability in `volumeBackup` before the state, so that disposition item 4 ("the path named") also holds for these two files. |
| A-SI-05 | NIT | `infra/README.md:146` | "Every refusal (exit 1, nothing changed) also prints one JSON line" says too much. The service-stop check (`lib.sh` `require_services_stopped`), the candidate guard (`storage-compat.sh` `guard`), the wrapper "stop now" checks and the `INCOMPLETE` mark still print text only. The Author lists this limit, and no contract code exists for these stops, so the behavior is correct. | Say "every coded refusal", and name the text-only stops. This can move to the M4 guide. |

## R2.5 Earlier guarantees (regression check)

- **Refusal text, exit and order.** The human messages of the earlier refusals do not change: the diff adds only a `code` or `details` argument. The JSON line comes before the stderr text. Exit codes stay (1 for refusals, 2 for usage, 2 for unresolved, 3 for a drill stop). The precedence in `volumeRestore` (validation → target state → source kind → pair rule) does not change.
- **No change before a refusal.** The tests compare the whole tree before and after each refusal (`stack-data.test.ts:1044-1052`).
- **Privilege rule.** No new log line is written as root. The drill refusal line (`:839`) and the `prepare_failed` line (`:849`) come after `dropPrivilege`. The read-only modes drop at once (`:832`). The legacy backup runs on the host.
- **Safe JSON fields.** Node builds every shell JSON line, so every value is escaped. The test with the container name `other "lti"` shows this. No line holds the message text, raw command output or an absolute host path. The `refusalOf` helper checks the fixed key set and that no temp root appears.
- **Original LMS isolation.** The diff touches only `infra/scripts/**`, `infra/README.md`, `infra/compat/storage-compat.sha256` and one CLI test file. No provider, route or shared LTI engine code changes.
- **Rows.** `tests/**` does not change, so the inventory stays 488 = 416 + 72, and only `c-host-negative` may be a conditional N/A. All 32 live rows stay UNVERIFIED.

## R2.6 Source facts, host evidence and unmeasured assumptions

**Source facts** (read in code): R2.2, R2.3 and R2.5.

**Host evidence** (mine, scratch, no Docker): the checks in R2.1. The Author's 21 controls and the Lead's root check are their evidence. I read the control list and repeated five probe mutants myself.

**Unmeasured Docker, privilege and filesystem assumptions** (not claimed):

- `docker compose run --rm -T` passes the container's stdout, including the new `storage_refused` line, to the command's stdout. This holds only in the G-1 scope (macOS 27.0.1 arm64, Docker CLI 29.9.1, Compose 5.6.0, bound hashes).
- Root, then `setgroups`/`setgid`/`setuid`, in `node:24.22.0-alpine3.24`. The read-only modes now drop at once, and this is also not run in a container.
- A real new volume has a root-owned 0755 root. I assume `HOST_UID` can list it and read the files of `HOST_UID` in it. The `owner` and `root_owned` items of `unpreparedItems` cannot be produced as a non-root host user, so no unit test covers them.
- EACCES, EPERM and EROFS behavior on the Docker Desktop volume filesystem under a `:ro` mount.
- WAL lock enforcement and extended errcode 5 on a real volume. This is measured only on host APFS. Codes 261, 517 and 6 are injected only.
- On the 60 s deadline, `process.exit` leaves the holder child behind. I assume that the container end stops it, and that the next `check` step 5 removes its scratch files.
- The real `docker rm` and `docker volume rm` failure text, and `{{index .Config.Labels …}}` on an unlabeled container.
- `ps`/`lstart` on Linux hosts, and the added preflight time per `stack:restart` and `stack:up`.

## R2.7 Verdict

**APPROVE** at exact source `a784522a3cdd9bb67453b03093092cac24e87402`, for source only.

- No BLOCKER or MAJOR is open. A-SI-01/B-SI-01 is closed for the union of paths, including the legacy hot-journal backup and the compatibility wrapper.
- The required B-SI-02 and B-SI-03 checks are closed with unit evidence and with my own mutants.
- A-SI-02, A-SI-03, B-SI-04, B-SI-05 and B-SI-06 are closed. B-SI-07 is closed against the recorded Architect disposition.
- A-SI-04 and A-SI-05 are NITs. They can be deferred with a recorded owner.

This approval gives no runtime acceptance credit. The runtime gates stay closed until the Lead opens them: the two full M1 rounds, the old routes, the lock self-check and the A-S-14 identity check at each run.
