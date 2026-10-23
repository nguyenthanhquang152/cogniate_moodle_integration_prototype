# M1 content-refusal repair (QA-RP-01): Reviewer-A

Verdict: APPROVE
Round: 1

Reviewer: fresh independent Reviewer-A (lens A: "Is it right and is it safe?"), Claude Code Opus 5.5 xhigh, no subworkers. Task `task_18fd0f622d94`, dispatch `ctx_14983551ffcd`. Date: 2026-10-21. I did not read any other review of this candidate.

This verdict is about the source and the design only. It gives no runtime or acceptance credit. At review start, independent host QA H1–H7 was running, and Q1/Q2 and every full-run gate were pending. Status from the Lead, received after I held this verdict: host H1–H7 PASS, committed at `18aa600` (14 subcases, 656 assertions). I did not read or review that report or its output, and this report makes no claim about its content. Q1/Q2 and every full-run gate stay pending.

## 1. Inputs

| Input | Value | Check |
| --- | --- | --- |
| Candidate | `aaa823b25306c5e560f7c4050238b374dec4d4e3`, parent `e9156905dde652ffca0b2348a3f17323c93c0b4b` | `HEAD` of this worktree; only `pnpm-workspace.yaml` is untracked |
| Frozen design | `2323361`: [storage-content-refusal-repair](../../architecture/tasks/storage-content-refusal-repair.md) SHA-256 `e7bcf8e0848c56c977a1c5dddd0281e0c194f6834c245542d45accc979ac8f47`; ADR-012 revision 3.5; the M1 `FRESH` clarification; the reset-brief cross-links | brief hash equal in the worktree and at `2323361` |
| Product diff `e915690..aaa823b` | `infra/scripts/stack-data.mjs` (+56/−27), `services/lti-service/src/cli/stack-data.test.ts` (+267/−5), `infra/README.md` (one sentence, line 141) | exactly the three allowed files |
| Tests tree | `4c7e067feedc644f955afee37806f06e7273dd04` | `git rev-parse aaa823b:tests` is equal |
| Changed test assertions | only the assertion at the old `:356` (now `:368`): `['rolled_back','rolled_back']` → listing equal and `[null, null]` journals | `git diff` removes no other `expect` line. The test title and the import line also change; neither is an assertion |
| Author report | `/Users/quangnguyen/cogniate-author-diagnostics/storage-content-refusal-repair-task_54e36981ceff-20261021T0953Z/report.md` | SHA-256 `63296712…3cf7`, equal to the Lead value. I read its mutation table and its evidence limits |

Evidence labels in this report:
- **R**: my read-only reasoning on the source.
- **P**: my own executed host probes (§8). There was no Docker call.
- **AU**: Author checks as reported. I did not run them again.
- **PEND**: runtime evidence that does not exist yet.

## 2. Summary

| Severity | Count | Ids |
| --- | --- | --- |
| BLOCKER | 0 | — |
| MAJOR | 0 | — |
| MINOR | 4 | A-CR-01, A-CR-02, A-CR-03, A-CR-04 (A-CR-04 is older than this change) |
| NIT | 1 | A-CR-05 |

The candidate does what the frozen design asks. The content check is now the last check of step 1. A `content_missing` refusal and a `content_check_failed` refusal make no write in either target volume. This includes `.tmp` leftovers and the bytes of earlier terminal journals. The check reads only a verified scratch copy of the app files that the manifest lists. It removes that copy before it writes its one line. The engine, recovery, drills, lock and permissions are unchanged after the first journal write.

My probes show this on the host with a stricter oracle than the unit tests: inode, mtime and ctime of every entry, plus a trace of every write-like `fs` call. The same probes fail on the parent `e915690`, so they detect the old order.

## 3. Write trace against the content-check boundary (R, P)

Writer path for `restore` and `import`, in order (`infra/scripts/stack-data.mjs`):

| Step | Line | Writes a target? |
| --- | --- | --- |
| §4 volume-side steps as root (`prepareFolder`) | `:860` | Only on an unprepared volume (owner, mode, empty mountpoints). The design keeps this as is (brief §9). On a prepared volume there is no call (`sqlite-lock-probe.mjs:249–278`). P: all listings, with inode/mtime/ctime, are equal on prepared targets. |
| Drill options; privilege drop | `:862–872` | No |
| `validate()` (whole backup) | `:712` | No (read only) |
| `pairState()` → `readFolder()` (target state) | `:715` | No (`lstat`, `readdir`, read) |
| Source kind, pair rule | `:731–757` | No; refusals throw `Refused` |
| `contentCheck()` | `:761`, `:585–627` | No. Writes only in `mkdtemp(tmpdir())` (0700). The only SQLite open is the scratch copy, read-only. |
| `content_missing` refusal | `:762–764` | No |
| `.tmp` removal (first target write) | `:767` | Yes, only after the check passed |
| `engine.run()` (`prepared` journals onward) | `:769–770` | Yes (unchanged path) |

P (C11): the trace order on a successful import is `mkdtemp(scratch)` → copy → read-only open → `rm(scratch)` → `storage_content_check` line → first target write (the `.tmp` removal) → first journal write. On every refusal case there is no write-like call under the target root.

## 4. Lens A checks

| # | Property | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Order: backup, target state, source kind, pair rule, content check, then `.tmp`, then the first journal | Correct (`:712–770`) | R; AU U7; P C5, C11 |
| 2 | No target write on `content_missing` (empty `FRESH`, recovered `FRESH` R1 and R2, `OK` with `committed` journals, `OK` with `rolled_back` journals) | Holds. Journal bytes, identities, databases and `.tmp` files stay. Inode, mtime and ctime of every entry and of both roots stay. | P C1, C2, C3-R1, C3-R2, C4; AU U1–U3, U6 |
| 3 | Refusal output | Exactly one `storage_content_check` (`content_missing`, `checked: 1`, `missing: ["packages/p1"]`), then one `storage_refused` with `code: "content_missing"` and `command`. Stderr has "Nothing was changed.". No cancel, rollback, unresolved or drill line. Exit 1. The check `opId` is in no journal. | P C1–C4; AU U1–U4 |
| 4 | Scratch bytes | Only the manifest-listed app files are copied (`filesByRole.app`; the names come from the `ALLOWED` set, so there is no path escape). Each copy is checked for size and SHA-256 before the open. The open is `readOnly`. The scratch is in the process temp folder, never in a volume or a bind. | R `:590–600`; P C9 (listed `-wal`/`-shm` copied and used; `p1` only in the WAL is found), C11 |
| 5 | Unlisted file exclusion | Holds. A planted unlisted `cogniate.db-wal` that adds `p2` is not read: `pass`, `checked: 1`. A control read with the WAL shows `p1, p2`, so the planted WAL works. | P C10; AU U5(c) (an unlisted `-shm` is not in the left scratch) |
| 6 | Check failure → `content_check_failed`, no line, no target write | Holds for a failed copy (EIO), a partial copy, a database without `storage_path`, and a failed cleanup (real CLI path, EPERM). Scratch removed after each failure except the failed cleanup. After a failed cleanup the scratch stays only in `TMPDIR`, holds only `cogniate.db`, and the message names only its base name. | P C7, C8, C18; AU U5 a/b/c |
| 7 | Exactly one truthful line, written after the cleanup | Holds for copy, verify, open and cleanup failures. One gap: a folder lookup error gives a `content_missing` line (A-CR-01). | R `:611–626`; P C11, C14 |
| 8 | Malformed and symlink inputs (existing contract) | A symlinked backup file is followed by `validate()` (as before). The scratch copy is a regular file with verified bytes. A symlink at `packages/p1` is `content_missing` (strict `lstat`, as before). `packages/.` and `packages/..` pass (A-CR-04, older than this change). | P C13, C17 |
| 9 | Precedence | `journal_open` target with missing content: `restore_target_state` (state named) and `import_target_not_fresh`. `drill_not_enabled` comes first. No check line, listing equal, the open journal untouched. | P C5; AU U7 (damaged backup ×3, `FIRST_START`, OK import, wrong source ×2, `pair_mismatch`) |
| 10 | After the first journal write: unchanged | The engine diff only removes the check and the `contentMissing` reason. `cancel`, `rollbackVolume`, `recover`, `commit`, drill points, `--pause-after`, exit codes and the journal format are unchanged. A backup file changed after the check gives a verified cancel (`storage_restore_cancelled`, `rolled_back` journals, databases equal). | R diff `:475–533`; P C15; AU U4 (boundary, `recover` → 1 then 0) |
| 11 | Lock, permissions, Docker | `stack-data.sh`, `lib.sh`, `compose.yaml` and `sqlite-lock-probe.mjs` are unchanged. The check runs after `dropPrivilege` (`:872`, `:901`). The probes made 0 docker-stub calls. | R; P |
| 12 | No atomic snapshot claim | The code comment, ADR §8 "Limits", brief §3 and §9 and the README sentence claim no atomic snapshot. ADR and brief say so explicitly. | R |
| 13 | QA oracle compatibility | `assertRefuses` needs exit 1 and the code in the JSON output. `nothingChanged` and `freshVolume` need an equal listing. The new output gives both. No QA file changed. Runtime proof is PEND (Q2, `e-content-missing`, `e-old-schema`). | R `tests/host/storage-oracle.mjs:37–40`, `storage-rows.mjs:1038–1077` |

## 5. Findings

### A-CR-01 — MINOR — A folder lookup error is recorded as `content_missing`

- **Where:** `infra/scripts/stack-data.mjs:620–625` (`catch { return true; }` at `:623`). Design text: ADR-012 §8 "Check failure".
- **Problem:** An `lstat` error other than "not there" (for example `EACCES`) counts the folder as missing. So the one result line says that a folder is missing, but the program did not find that out.
- **Trigger (P C14):** The content folder has mode `0000`, and `packages/p1` exists in it. Import into a prepared `FRESH` pair.
- **Expected:** Revision 3.5 says "A check that cannot finish refuses `content_check_failed` … It is never `content_missing`". The task asks for one truthful line. So: `content_check_failed`, and no `storage_content_check` line.
- **Actual:** Exit 1. One line `{"result":"content_missing","checked":1,"missing":["packages/p1"]}`, then `storage_refused` `content_missing`. No target write (it fails closed).
- **Notes:** This rule is older than this change (the same `catch` was at `e915690`). The ADR "Check failure" list names copy, verify, open, read and cleanup, but not the folder lookup. So the code matches the literal frozen text, and the gap is in the design text. The only effect is a wrong diagnosis. In the product the program reads `/content/packages` as `HOST_UID`, so this case is not likely.
- **Fix (bounded):** Count only `ENOENT`, `ENOTDIR` and a non-directory entry as missing. Any other lookup error refuses `content_check_failed` with no line. Add "a package folder lookup fails" to ADR §8 "Check failure". Or the Architect states that a lookup error counts as missing. This can wait for the deferred list.

### A-CR-02 — MINOR — Unit U5 library cases do not prove the cleanup after a copy or verify failure

- **Where:** `services/lti-service/src/cli/stack-data.test.ts:1429–1451` (U5 a/b through the library API).
- **Problem:** These cases assert `content_check_failed`, no line and an equal tree. They do not assert that the scratch folder is gone. Only the CLI case at `:1476` (open/read failure, through `dataCmd`) and the CLI refusal and success cases check that `TMPDIR` is empty.
- **Trigger (R, not executed):** A mutant that removes the scratch only after the copy loop finishes (an early throw from the copy or verify step skips the cleanup). U5 a/b (library) still pass. The CLI case at `:1476` still passes, because its failure comes after the loop. The Author's M7c (no cleanup at all) is caught, but it does not cover this partial mutant.
- **Expected:** Design §4 property 3: remove the scratch "also after a failure".
- **Current code:** Correct. There is one cleanup after the `try` (`:611–614`). P C18: after an EIO copy and after a partial copy, `TMPDIR` is empty and the database is never opened.
- **Fix (bounded):** In each U5 library case, wrap `checkRemove` with a spy that calls `REAL_IO.checkRemove` and records the path. Assert one call and `existsSync(path) === false`. Or also run U5 a/b through `dataCmd`.

### A-CR-03 — MINOR — The independent QA plan has no `content_check_failed` check

- **Where:** Brief §6 (H1–H7), the plan as the frozen brief writes it. I did not read the QA report. This finding is about the plan only.
- **Problem:** In the brief, the new code `content_check_failed` and its "no line, no target write" rule have only Author unit evidence and reviewer probes. The plan has no independent QA check for them.
- **Trigger:** Brief §6 defines H1–H7 for `content_missing`, success, `.tmp` and precedence only.
- **Expected:** Independent evidence for each new refusal path, where it is possible without fault injection.
- **Fix (bounded):** QA can test one case with no fault injection: a legacy backup whose app database has no `storage_path` column, or whose app file is not a database, with a matching manifest. Expect exit 1, `content_check_failed`, no check line, equal listings and an empty `TMPDIR` (my P C8 does this). The Lead decides whether to add it to QA scope or to record the gap. It does not block, because `content_check_failed` is a diagnostic code that no M1 row uses.

### A-CR-04 — MINOR (older than this change; outside this repair) — `packages/.` and `packages/..` pass the content check

- **Where:** `infra/scripts/stack-data.mjs:621` (`/^packages\/([^/]+)$/`).
- **Problem:** The rule is "a directory under `infra/.data/cogniate-app/packages`". `packages/..` names the parent folder, and `packages/.` names the packages folder itself. Both are accepted.
- **Trigger (P C13):** The app database has `storage_path` values `packages/..` and `packages/.`, and the content folder is empty. Import into `FRESH`.
- **Expected:** Both are not package folders, so `content_missing`.
- **Actual:** Exit 0, `pass`, `checked: 2`.
- **Notes:** The app writes only `packages/{id}` (`services/cogniate-app/src/domain/migrations/001_init.sql:34`). So only a crafted backup has such a row. A crafted backup already controls the whole database, so this adds no new trust boundary. The content host uses `join(dataDir, storage_path)` as the package root (`services/cogniate-app/src/content-host/server.ts:145`). This is R only; I did not test the content host. The regex is unchanged since `f8a869b`. The frozen design keeps the rule, so this repair must not change it.
- **Fix (bounded, later):** Count a `.` or `..` name as missing (for example `/^packages\/(?!\.\.?$)[^/]+$/`) and add one unit case. Put it on the M4 deferred list.

### A-CR-05 — NIT — The README order list does not name the content check

- **Where:** `infra/README.md:139`.
- **Problem:** The restore order ends at "the pair". Line 141 now says that the content check runs before the first journal write, but it does not say that it comes after the pair rule.
- **Fix:** Optional, in a later docs pass. The brief allows only one sentence in this repair. The sentence at line 141 is correct.

## 6. Test quality (lens A view)

- The new `listing()` checks names, types, modes, sizes and SHA-256 values. It does not check uid, gid, inode, mtime or ctime, so it cannot see a write that is later undone. My trace and mtime/ctime oracle find no such write (P). The M1 full-round "nothing changes" oracle has the same limit: `listingDiff` compares `entryKey` = path, type, uid, gid, mode, size, SHA-256 and link target (`tests/host/storage-oracle.mjs:64–76`, tests tree `4c7e067`), with no inode, mtime, ctime or write trace. This statement does not describe the new H1–H7 oracle. That oracle is QA's own, and I did not read it. The Lead states that it checks uid, gid, inode and mtime; my probes add ctime and a full write trace. This is not a finding.
- U1–U8 match brief §5. The mutation table in the Author report matches the design table. The Author states its own limit: the partial-copy sub-case alone does not catch M6, and the other-bytes sub-case catches it. The stricter U3 assertion prepares the target first, so the listing covers every write.
- U5(c) also checks the place (`dirname(scratch) === tmpdir()`) and that only listed files are in the left scratch. This covers the "unlisted file" reading item of brief §5.
- Gaps: A-CR-02 (cleanup after a copy or verify failure in the library cases). There is no unit case for a `journal_open` target plus missing content (my P C5 covers it). This is not required by U7.

## 7. Design review (lens A)

- Moving the check into step 1 is the smallest change that keeps the strict refusal contract. The rejected options in brief §2 are rejected for correct reasons: removing journals after a cancel cannot restore earlier bytes, and staging outside the volume breaks the checked move (fact M4).
- Brief §3 is correct when I check it against the code. Staging stays journaled. A crash before the first journal leaves no journal (R0). Drill points all come after step 1. `.tmp` leftovers stay on any refusal.
- The two meanings of `FRESH` (ADR §6, §11 item 5, M1 clarification) are consistent with the QA rows. `e-import-recover` and `g-fresh-target` use their own condition. `freshVolume` is used only by the refusal halves.
- Behavior change to note (R): with missing content, `--stop-after prepared-lti` and `--stop-after prepared` now refuse `content_missing` (exit 1) instead of stopping (exit 3). ADR §8 states this ("Every drill point comes after step 1"). The QA drill rows run in lanes where the content is present, and their later points already needed the check to pass. Full rounds must confirm this (PEND).
- The design limits are honest: no atomic snapshot; a leftover after a failed cleanup; §4 steps on unprepared volumes; no drill inside step 1. A-CR-01 is the only gap in the design text.

## 8. My probe record (P)

- Root: `/Users/quangnguyen/cogniate-reviewer-a-content-refusal-aaa823b-20261021T1024Z` (mode 0700, host only).
- Scripts: `git archive` of `aaa823b` and `e915690` (only `stack-data.mjs` and `sqlite-lock-probe.mjs`). The worktree was not used to run anything.
- Runs used Node v24.21.0 as the host user, with `HOST_UID`/`HOST_GID` set to my ids, and a docker stub first on `PATH` (0 calls). Each command had a new empty `TMPDIR` in the root. `STORAGE_LOG_DIR` did not exist.
- Oracles are my own: a recursive listing (path, type, uid, gid, mode, size, SHA-256, link, inode, mtime ns, ctime ns), my own JSON-line parsing, my own SQLite fixtures, and a preload (`tools/tracer.mjs` plus `tools/sqlite-shim.mjs`). The preload records every write-like `fs` call, every `DatabaseSync` open and every JSON stdout line, in order. Faults come from the preload only: EPERM on the scratch removal (C7), EIO or a partial scratch copy (C18), and a backup byte appended after the check (C15). Product commands are setup steps only.
- Results:
  - Candidate: 16 groups, 219/219 checks PASS (`runs/cand-Uge73G/result.json`).
  - Parent `e915690`: 9 discriminating groups, 93/149 checks PASS and every group FAIL (`runs/parent-uaeJ55/result.json`). The parent shows journals written, `.tmp` removals, `storage_restore_cancelled` and the check after the first target write.
  - No write-like call went outside the probe root. No `TMPDIR` was left non-empty: C7 records its expected left scratch, then removes it. No root-owned entry.
- `evidence-manifest.sha256` (SHA-256 `53bda65373eb4c656ccefd89faa8ec41ec8f793fcab0af3346ad2c29f5604143`):

| File | SHA-256 |
| --- | --- |
| `cand/infra/scripts/stack-data.mjs` | `5c3fde5cab845e27bbb942c69cc4a4578964a2c66171ba068b625f15b4a7c258` (equal to the worktree file) |
| `parent/infra/scripts/stack-data.mjs` | `7296fe85578bda8056cc5adf5abe93c13ffe87bd4d72e5e78e867a507d88c293` |
| `tools/tracer.mjs` | `f2e8ca1400e6dabb88d4de7c405de490a271885518bd928f9fcae31f88c8a1bf` |
| `tools/sqlite-shim.mjs` | `857257f2bad3f81a8311b4925deb7db459b09e322dc7c5c7e97fe331fc785382` |
| `tools/probe.mjs` | `7a8c2b99dceb703ced7879e8417690ccf2f28446d5866e6c6df43df1b2bd47ed` |
| `runs/cand-Uge73G/result.json` | `7a6f0ed2b827cd832ce2e2c0cc3d6af66d0dbb1730ddd24b258924ffb7861955` |
| `runs/parent-uaeJ55/result.json` | `7a57a3c62e05b5ebd193a106a6764f6d6541849dd53455415de05a84e9b11938` |

- Earlier runs `cand-POAdM1`, `cand-1QGDem`, `cand-omVna0` and `parent-JjTMC9` were harness development runs. They had a tracer bug (the SQLite hook was not active, and a copy source counted as a write) and then an argument bug in the shim. They are kept, but they are not evidence.
- Probe limits: one host, one attempt per case, macOS APFS, not the Linux container. The cleanup failure and the copy faults are injected through `fs` hooks; they are not real disk faults. C13 and C14 record observed behavior and do not assert it.

## 9. What I did not do, and the limits

- I did not run `npm run check`, the full unit file or the Author's mutants again. AU numbers (105/105 focused, root 1123 PASS with 5 existing fixture skips, infra 84/84, all required mutants caught, frozen old test 87/88 with only the named assertion failing) are the Author's claims.
- Author evidence limits, as the Author recorded them: some first unit, mutant and root runs used the 0700 system `TMPDIR`. There, 14 matched unit-fixture leftovers were removed after identification. There is no full inventory of the system temp folder for the other suites. The optional M7c private scratch artifacts were removed before the preserve note, and its result and log are kept. I make no claim about those gaps beyond that record.
- No Docker call, no runtime. Q1 and Q2 on this SHA, two 488-row rounds with the same result per row (also the exact `e-content-missing` and `e-old-schema` assertions), the legacy suites, the fresh M2 rows, three T7 runs and the G-1 binding stay mandatory and PEND. At review start, independent QA H1–H7 was running on the same SHA. Status from the Lead: H1–H7 PASS at `18aa600` (14 subcases, 656 assertions). I did not read or review it, and this report claims nothing about its content.
- All 32 real-LMS rows stay UNVERIFIED. Existing failures stay as recorded. This review waives no assertion and gives no acceptance credit.
