Verdict: CHANGES_REQUESTED
Round: 1

# M1 storage harness repair: bounded source review (Reviewer-B)

Reviewer-B, 2026-10-21 (UTC). Lens B: "Can a human team own it?" (maintainability, error handling, operability, test discrimination).
This is a source review of the bounded QA harness repair. **It gives no runtime acceptance credit.** A self-check pass count is not runtime acceptance. No M1 row changes status because of this review. The latest full runtime result stays 438 PASS, 50 FAIL at `aaa823b`.

## Identity and scope

| Item | Value |
| --- | --- |
| Role | Independent Reviewer-B. Blind: I did not read Reviewer-A's report or any plan text written after `71a5bf9`. I read the QA report only after I had formed and sent my findings, and only its §9.1 and LD-2 rows (see Limits). |
| Model | Claude Code Opus 5.5 (`claude-opus-5-5`), xhigh effort. |
| Lifecycle | Run `run_ebe671ad72a9`, task `task_d3984e81680f`, dispatch `ctx_47285c0af009`. Session `orca_session_id:e20ddff9-030d-4637-9a1b-0bb6ef04a578`. |
| Final source target | `71a5bf92608f8ee20e81363a0be987474fc59859`, tests tree `d574737219dffadb4447968bb0cc06393e61e5b9` (Lead `msg_7da821ad319b`). |
| Freeze reviewed first | `5f184771d835fcf03701053c6b11a00ec7f0ccf3`, tests tree `b7aa39ae22acd33671e09857dd66412dcc77b8fd`, parent `54600e8`. |
| Baseline | Tests tree `4c7e067feedc644f955afee37806f06e7273dd04` (`54600e8:tests`). |
| Delta `5f18477..71a5bf9` | Three test lines only: V8-6 adds the end `+010000-01-01T00:00:00.000Z`; V8-4 adds the start `-000001-01-01T00:00:00.000Z`; LD-3 changes `slice(1, 3)` to `slice(1, 4)`. All ten runtime modules are byte-equal. The three lines are correct. |
| Files reviewed | The exact 21 paths of the dispatch: `tests/host/m1-migration.mjs`, `run-m1.mjs`, `storage-compat-route.mjs`, `storage-diagnostic.mjs`, `storage-fixture-script.mjs`, `storage-handoff.mjs`, `storage-lane.mjs`, `storage-oracle.mjs`, `storage-private-scan.mjs`, `storage-rows.mjs`, and their eleven self-tests (`m1-migration`, `storage-compat-route`, `storage-diagnostic`, `storage-fixture-script`, `storage-handoff`, `storage-lane`, `storage-oracle`, `storage-private-copy`, `storage-private-scan`, `storage-rows`, `storage-source-inventory`). `git diff --stat 54600e8 5f18477` names exactly these 21 paths. No manifest, row inventory, product, infra or root path changed. |
| Criteria read | Charter and phase plan at `54600e8`. Frozen triage `2d763fe` (`storage-full-round-triage.md`, SHA-256 `ade4e8a0f9e54823040828758b7683d5c9b230587747f3ef3c89ef8e99f9a032`, verified). M1 precision `a60ba4a` (`M1.md`, SHA-256 `ac444799ae5e93706054a7e352e339bdea509a889328c15365a3535864fb37af`, verified). Lead checkpoint `97b22a1`. Grants `msg_0f65fbcdf49c`, `msg_9b1720e2eeb9`, `msg_df38477e48e2` as the plan and the QA map record them. Lead messages `msg_54efd9ce2cea`, `msg_7da821ad319b`, `msg_2001d162f358`, `msg_fde002730640`, `msg_17c53757c0bb`, `msg_872ba3fe50c7`, `msg_8b3f59cd88cd`, `msg_4fea72afeb79` (severity rule: a required acceptance criterion or required control that fails is BLOCKER, also when only a race can show it). |

## Method and evidence

I read the committed target only. I extracted `5f18477:tests` and `71a5bf9:tests` with `git archive` into my private root. The shared worktree now holds uncommitted Round 2 edits by another worker (file times from 17:29Z). I did not read or use them.

Private root (0700, made under umask 077): `/Users/quangnguyen/cogniate-review-runs/harness-repair-reviewer-b-20261021T1605Z`.
Every probe ran with `env -i`, umask 077, `TMPDIR` and `HOME` inside that root, and a fail-closed Docker stub (0700, exits 97) first on `PATH`. The stub log has 0 calls. No Docker, Compose, network, service, settings change or dependency installation. No full acceptance run. Host: macOS (Darwin), Node v24.21.0.
Evidence manifest: `manifest-2.tsv` (36 entries, mode 0600), SHA-256 `df6c72790f2e9332363d7e2fe15d81dc7d9f8af3c6d4f362acbe78464005a68e`. It keeps the 19 file entries of the first manifest `manifest.tsv` (preserved, SHA-256 `0578bd1acc15e0978d3ff84c0aa9c9f36e0e984bd917d20f775bf4a6c9aed0bb`). It replaces that manifest's five pseudo-entries `probe/<mutant>/diff` with real files: the saved `diff -r` outputs (`probe/diffs/<mutant>.diff-r.txt`, same SHA-256 values), six `diff -u` files, and each mutated source file with the SHA-256 of its base file and its git blob reference at `5f18477` or `71a5bf9`.

| Probe | What it does | Result |
| --- | --- | --- |
| P-A2 (`probe-a2-withscratch.mjs`) | A real `StorageLane.withScratch`. The body writes a 0644 file. The §7.5 race (path becomes a link before the correction) is armed after the body. Run once with a passing body and once with a failing body. | Body passes: `PhaseAbort`, refusal recorded. Body fails: the thrown error is the body `StorageFail`; the refusal is only in the scan record. The next `scanTree` of the kept folder finds 0 hits (links are not hits). See B-HR-02. |
| P-B (`probe-b-rmsync.mjs`) | `fs.rmSync(link, {recursive: true})` and `fs.rmSync(realpathSync(link), …)` on a link to a folder. | The real code removes the link and keeps the target. The M5-4b form deletes the target. See the M5-4b disposition. |
| P-M48F (`probe-m48f.mjs`) | `open(link, O_CREAT\|O_EXCL\|O_WRONLY)` without `O_NOFOLLOW` on a dangling link, a link to a file and a link to a folder. | `EEXIST` for all three. The dangling target is not created. M4-8f is equivalent. |
| Mutant D | `storage-diagnostic.mjs:75` removed (run-or-stop condition (d), migration owned cleanup). Run V8-6 on `5f18477` and on `71a5bf9`. | V8-6 passes 1/1 on both. The mutant survives. See B-HR-03. |
| Mutant L | `storage-rows.mjs:939` accepts `recordHash(lock) === null`. Run LD-2 on `5f18477` and on `71a5bf9`. | LD-2 passes 1/1 on both. The mutant survives. See B-HR-01. |
| Mutant M2-9a, behavior only | The M2-9a edit, plus removal of the two `STORAGE-SEED-RESUME` lookup lines of V2-9 in my private copy. | V2-9 fails at `Only the first seed ran` (2, expected 1). The detection is behavioral. |
| Baselines | V8-6, LD-2 and LD-3 on the unmutated `71a5bf9` tree. | Each passes 1/1. |

Static checks (no execution):
- V4-9 token pattern `/\b(copyFileSync|copyFile|cpSync|cp|mkdtempSync|mkdtemp|tmpdir)\s*\(/g` over the twelve runtime modules: `storage-lane.mjs` `copyFileSync` 1; `storage-rows.mjs` `cpSync` 1; `storage-compat-route.mjs`, `run-m1.mjs` and `storage-fixture-script.mjs` `mkdtempSync` 1 and `tmpdir` 1 each; `m1-migration.mjs` `mkdtempSync` 2; all other counts 0. This equals X1–X8 exactly.
- A-SRR-08 bypass search: no computed member (`fs['…']`), no destructured or renamed token, no `fs/promises`, no `tmpdir` reference without a call, no spawn of `cp`, `rsync`, `ditto`, `install` or `mktemp`. The only `tar` is the existing frozen-test install (`run-m1.mjs:238`).
- Every new file-system write in the runtime diff has an explicit mode: exclusive `0600` creates, `0700` folders (`mkdirSync` then `chmodSync` of the new empty folder), and `fchmod` on the descriptor for into-volume files. No protected-class copy is made first and changed later. X1 (`boot()`, script into `bin/`, then `0555`) stays the named exception.

Provenance of QA evidence (hashes and metadata, the mutation results the Lead sent me, and the QA report sections named in Limits):
- Pre-source map `map/control-map.md`: SHA-256 `bf47ec74bc0e2ebadbc461407d10545342c10710ee0d00d2d0d1604d7bdaafda` matches the plan; mode 0600; time 14:00:03Z, before the 14:02Z grant. Later text is in a separate `map/clarifications.md` (15:39Z) and `map/amendment-A1.md` (SHA-256 `e377fc260c1cd1924675ca22e5a0ce661123a1ee59d64b458cccd0b7928ad8a3`, 16:16:45Z, before the `71a5bf9` commit). The map stays immutable.
- V7-1 latent-defect evidence `evidence/latent-defects-v7-1.md`: SHA-256 `e061d44dc542bf6d15c47015575d07bfec35bd03b07d2b23e22cc56e00b33c5b` is unchanged. The original FAIL stays in the record.
- Final self-checks: `logs/final-u077.meta` `6db23dad5b3e99782d777dcd9c1f1fbc6d6ca550dcfcc70316a3bb094f53f659` and `logs/final-u022.meta` `c1a51bfcae83cc2d619a6643d1a2711464846fabce1fb17602296e3376dacd7c`. Each: exit 0, 105/105 PASS, 0 skipped, `docker_stub_calls=0`, `tmp_left=0`. The 15 self-test hashes in each meta equal `71a5bf9`. Limit: the metas do not hash the runtime modules; the worktree edits after the runs have later times (17:29Z and later).
- Mutation results: `run-m1` `27b1afd6bc3ce884af2afb546622bea1de8506a60c7912f8e1e9099fb0063878` (133), `run-m1b` `c52923bd167c5cb32cab1e4adb28790f2c29bb09ac06ae815dbeca5c2853198f` (2), `run-fixcheck` `47767b031501c2abd051e53243cdac24b5d6b427b193f4a579046c4f8195b8c6`, `run-m2-focused` `39c09b20e1ecb6025fc084260e91d1f578f1050c35629c57c07694c46a71da09`. All hashes match the Lead's message.

## Criteria coverage (what I confirmed)

| Area | Result |
| --- | --- |
| Creation modes (§7.2, §7.3) | Confirmed for sites #1–#16. Private helper: `O_CREAT\|O_EXCL\|O_NOFOLLOW\|O_WRONLY` with `0600`, `fstat` check before the first byte, digest check after. Into-volume helper: the same create, then `fchmod` to the recorded or planted mode. `privateEmptyFile` and `checkCapture` match §7.3 (before: regular, same inode, 0600, size 0, one link; after: regular, same inode, 0600). Container `scratchBase` is set after the spec (`storage-fixture-script.mjs:526`). V4-1 runs each site under umask 022 and 000. |
| Scans (§7.4, §7.5) | Confirmed, except B-HR-02 (BLOCKER: no phase stop after a refused scratch correction when the body already failed). Hits stay in the record after a correction; `failed` stays true; a correction never makes a PASS. Scratch is removed only when clean. Root closure, `bin/` rule and outside classes match the table. |
| Restores and phase stop (§4.3) | Confirmed. 21 sites, 29 calls in the dry run, 27 injections in V2-8. The aborting row keeps its first cause; a cleanup failure is a separate `restore note:`; every later step is `BLOCKED` with the exact note; fixtures too; one abort-path scan; the phase-end log segment still runs. V2-10 covers a root plant that fails or times out after `packages`. |
| `a-serialize` (§3.1) | Confirmed. Offset, `pgid` identity, exactly one acquire, release by `runId`, string equality of the command, two clock samples, `lo`/`hi`, fail-closed time compare. The row awaits `backup.done` also on an identity failure and saves the output through `saveText` (V1-8 mock asserts the order). NIT B-HR-05. |
| `d-mountpoint` (§4.0) | Confirmed: baseline before the plant, `meta` through `lstat` only, restore on "started and not confirmed", stop and lock before the restore. |
| P-1a | Confirmed: `a-fresh` needs `ENOENT` for three paths; `d-content-folder` keeps `P` (device, inode, owner, group, mode) and deletes the children; `rmSync` does not follow a final link (P-B). |
| Handoff (§9.1) | Confirmed: one function, exact raw-ms inequalities, no tolerance, no flooring, no `utimes`. Self-tests make ordered events at least 2 ms apart and assert each premise; a false premise fails, never passes. |
| Drivers (§9 step 7) | `fullRounds` keeps the phases, order, arguments, result files and handoff path; it adds only `QA_M1_WINDOW_START` for migration and storage. The diagnostic makes `D` with `mkdirSync` 0700 and a random suffix, takes `w` after `D`, and applies conditions (a)–(f). Teardown and W4 always run. Zero runtime credit. Gap: B-HR-03. |
| V7-1 | Confirmed: the map has all 70 row ids with status and exact first cause; the compare runs in both directions; only `c-host-negative` (NOT_APPLICABLE) and `a-lock-scope` (FAIL, fake suite) differ from PASS. |
| LD-1 | Confirmed: only exact ids of a detached `storage-decoy` and a created `storage-volume-user`, kept for their own row; an id retires only after a removal with exit 0; the transient container gets no exemption; a listing failure stays `StorageBlocked`. Controls: positive per role; negatives for an unexpected id, the transient container, another row, no row and a failed removal. |
| LD-2 | The stale-record oracle is confirmed (snapshot before the first command; compare after each of the three commands; no evidence is erased; transient reclaim, removal, rename and change are each detected). The lock-record part fails: B-HR-01 (BLOCKER). |
| LD-3 | Confirmed: the existing `ltidb` `.previous-<opId>/lti.db` tamper; appdb is not covered (as M1 states); names are volume plus file name; only the exact root journals are exempt from the byte compare; each root journal is checked alone (regular file, JSON object, same keys, `rollback_failed`, only `state` and `updatedAt` may change); a nested journal is never exempt. All declared LD-3 negative controls exist; the `71a5bf9` fix makes the cross-volume case discriminate (FIX-M-LD3c). |

## Findings

Severity follows charter §5 and Lead `msg_4fea72afeb79`: a required acceptance criterion or a required control that fails is BLOCKER, also when only a race can show it. My first status (`msg_b727bd1e4b1c`) gave B-HR-01 as MAJOR and B-HR-02 as MINOR. Under this rule both are BLOCKER. The other severities are checked against the frozen text below.

### B-HR-01 — BLOCKER — a required LD-2 negative control is missing, and an absent lock passes

- **Where:** `tests/host/storage-rows.mjs:926` and `:939` (`g-orphan-refusal`); `orphanStart` at `:1396–1397`; controls at `tests/host/storage-rows.selftest.mjs:993` and `:1495–1498`.
- **Required (M1 `a60ba4a`):** "The `g-orphan-refusal` oracle fails for: … a lock folder that is gone or has another `owner.json`." The row text also requires "the lock record is unchanged". So the required row outcome for a gone lock folder is FAIL, with the existing cause `The lock record is unchanged` (`:939`). It is not BLOCKED.
- **Problem 1 (control):** Only "another `owner.json`" has a control (`orphan-lock-changed`). No control removes the lock folder.
- **Problem 2 (row):** `recordBefore` (`:926`) is not bound to the orphan's lock. `orphanStart` saw the record (`:1396–1397`), but if the folder is gone at the snapshot, `null === null` passes `:939`. The row then gives PASS where M1 requires FAIL.
- **Evidence:** Mutant L changes `:939` to accept `recordHash(lock) === null`. LD-2 passes 1/1 on `5f18477` and on `71a5bf9` (`probe/out/mut-lockgone-ld2.log`, `m71-lockgone-ld2.log`). The QA campaign has two LD-2 mutants (M-LD2a, M-LD2b); neither covers a gone lock. The code is correct only when the record exists at the snapshot.
- **Suggested fix:** in the row, FAIL with `The lock record is unchanged` when the snapshot has no lock record, or when its `runId` is not the killed command's `runId` (one line in `storage-rows.mjs`). Add one mock-lane injection that removes the lock folder after one of the three commands, with the expected first cause `^The lock record is unchanged$`. Rerun LD-2 and V7-1.

### B-HR-02 — BLOCKER — a refused scratch correction does not stop the phase when the body already failed

- **Where:** `tests/host/storage-lane.mjs:272–279` (`withScratch`), with `:263–270`, `tests/host/storage-private-scan.mjs:53–54`, `tests/host/storage-rows.mjs:140–145`.
- **Required (triage `2d763fe` §7.5 step 4 and §4.3):** a refused correction is recorded as "correction refused: `<reason>`" and the phase stops. The row keeps its own status and first cause. Then every remaining `SEQUENCE` step is `BLOCKED` with the note "phase stopped after `<step>`: `<cleanup cause>`; first cause: `<row cause>`". The abort-path scan and the phase-end log segment run.
- **Problem:** `withScratch` keeps the first error (`first ??= e`). When the body fails, the `PhaseAbort` of a refused correction at the scratch removal is dropped. The next per-step scan cannot find the refusal again, because `scanTree` does not report links. So the phase continues.
- **Evidence:** P-A2. Passing body: `PhaseAbort` with "correction refused: … cannot open without a link follow (ELOOP)". Failing body: `StorageFail` "body failed first"; the refusal is only in the scan record; the next `scanTree` of the kept folder finds 0 hits and 0 problems.
- **Scope:** A persistent refusal (another owner, no owner read bit) is found again by the next per-step scan and does stop the phase. A race refusal is lost. The storage-phase callers are `backupLogical` (`@backup-B`, `@post-B`) and `storagePaths` (`e-old-schema`). In the migration and snapshot-upgrade phases each error ends the phase as FAIL, so they meet §7.5.
- **Suggested fix:** in `withScratch`, when `remove()` throws `PhaseAbort`, throw a `PhaseAbort` whose message keeps the body error first (for example "body cause; private scratch …: correction refused: …"), so that `storagePhase` sets `cleanupCause`. Or let `storagePhase` read the refusals of the step's own scan records. Add the failing-body variant of the R2-01 control and one V2-8-style mock-lane run that checks the phase stop.

### B-HR-03 — MINOR — V8-6 does not discriminate run-or-stop condition (d) or the published-once rule

- **Where:** `tests/host/storage-diagnostic.mjs:66–67` and `:73–75`; stub at `tests/host/storage-diagnostic.selftest.mjs:81`; stop list at `:113–123`.
- **Problem:** The stub always writes `TEARDOWN` PASS. No variant has a failed migration cleanup, a scan point that is published zero or two times, or a wrong `configDiff` removal count.
- **Evidence:** Mutant D (condition (d) removed) passes V8-6 on both trees (`probe/out/mut-d-v86.log`, `m71-d-v86.log`). The QA campaign has no mutant for (d).
- **Why MINOR:** The frozen V8-6 text lists six variants (a row FAIL, a scan hit, a refused correction, an invalid handoff, an unclear ownership record, an expired window) and two mutations (a storage start after a migration failure; a stop without teardown or W4). All exist and are detected. Condition (d) (Lead B-SR-02) is implemented correctly (`:73–75`). No required control fails; a discriminating variant is missing.
- **Suggested fix:** add stub faults `teardown-fail` (one `TEARDOWN` FAIL) and `point-twice` (one point published twice), each with its exact `storage NOT RUN: …` cause.

### B-HR-04 — MINOR — M5-4b: the QA disposition is transparent; a race-only discrimination gap remains

- **Where:** `tests/host/storage-rows.mjs:736–742` (`deleteChild`), `:743–748` and `:770–772`.
- **QA claim:** The QA report (§9.1) gives M5-4b as "NOT DETECTED. Proposed masked … Not accepted as detected and not waived." It makes no equivalence claim. This is the disclosed result, not a new unsupported claim.
- **Assessment of QA's argument:** It is correct for this process. `safe()` runs synchronously before each deletion; no `await` lies between them (`:743` → `guarded` → body → `deleteChild` as its first statement; `:770` → `:772`). So no harness code can change a child between the check and the deletion. Services are positively stopped.
- **What remains:** An outside process can still change a child between `lstat` and `rmSync`. In that race the held code still meets P-1a condition 4 ("removes a symbolic link as a link and never follows it"): `rmSync(dir)` removes the link and keeps the target (P-B). The M5-4b form deletes the target (P-B; QA `probe-m54b`). So M5-4b is not equivalent, but only a race shows it.
- **Why MINOR:** No frozen criterion fails for the held code, also in the race. V5-4 meets its specified input (a link or a file before the deletion → `BLOCKED`, nothing deleted) and detects a deletion that proceeds on a link (M5-4a). If the Lead reads the V5-4 named mutation ("a deletion that follows a link") as also requiring the form that keeps the precheck, this is a required-control gap and BLOCKER under `msg_4fea72afeb79`; the fix is the same.
- **Suggested fix:** add a race variant in the style of V4-7 and R2-01: after `safe()`, replace the child with a link to an outside folder (for example at the `childListing` read), then assert that the outside folder and its file are unchanged and the link is gone. Otherwise record M5-4b as "masked, not equivalent, accepted limit".

### B-HR-05 — NIT — `a-serialize` can name a lock-order fault when `stack:up` only failed

- **Where:** `tests/host/storage-rows.mjs:538–542`.
- **Problem:** The time verdict runs before the `stack:up` exit check. If `stack:up` fails without a new start, `StartedAt` keeps the start time from before the row. The first cause then reads "service started before the backup released the lock".
- **Note:** The baseline had the same order. The status (FAIL) is right; only the cause can mislead a triage. Suggested fix: check `start.code` first, or keep the verdict as a note when `stack:up` failed.

### B-HR-06 — MINOR — a failed or timed-out plant outside `guarded` gets no restore and no phase stop

- **Where:** for example `tests/host/storage-rows.mjs:845–847` (two `legacy.place` calls before `guarded`) and `:661–662` (the `d-owner` root `chown` before `guarded`).
- **Problem:** If the second `place` fails, or a root plant times out after its change, the plant stays and later rows fail with other causes. This is the carry-over pattern of RC-2.
- **Why MINOR:** Triage §4.3 sets the abort state on a failed or unsafe restore. Only §4.0 step 8 (site 10) adds the "started" trigger after a failed or timed-out plant, and the code does that (V2-10). So no frozen criterion fails at the other sites. The risk is a misattributed cascade, the RC-2 pattern. Consider the same trigger for multi-step and root plants in a later round.

### B-HR-07 — NIT — diagnostic operability details

- `diagnosticRun` calls its hook `teardown`, but `run-m1.mjs:190–192` only checks that no lane resource remains; each child did its own teardown. An operator can read the record as "the diagnostic removed resources". A name such as `laneCleanCheck` is clearer.
- `run-m1.mjs:414` writes `QA_M1_RESULTS_FILE` with the process umask. In `D` it sits next to `diagnostic.json` and the scan record, which are `0600` from creation. It holds row ids and notes, not a protected class. `privateWrite` would make `D` uniform.

### B-HR-08 — NIT — some detections are clear only after reading the code

- `phaseStopProblems` (`storage-rows.selftest.mjs:1234–1236`) and V6-1 (`:1196`) fail with a `TypeError` when a row or a log file is missing (M2-4b, M6-1a). The failures come from the mutated behavior, but the message does not name it.
- V2-9 (`:1338–1339`) first looks up the fixture record id `STORAGE-SEED-RESUME`, which is an implementation name. The behavioral check `Only the first seed ran` follows and detects M2-9a alone (my probe).
- IN-4 (`storage-private-copy.selftest.mjs:180–191`): the explicit assertion "Nothing in the folder named by the spec" cannot discriminate alone, because `logicalRead` removes its scratch. The `0500` folder makes the mutant fail with `EACCES`, which is a real behavioral effect.

## Mutation evidence dispositions (my assessment)

| Mutant | Assessment |
| --- | --- |
| M4-8f (`O_NOFOLLOW` removed in `privateEmptyFile`) | Equivalent; QA's proposed equivalence is supported. `O_CREAT\|O_EXCL` fails with `EEXIST` on any existing final component, also on a dangling link (POSIX; my probe P-M48F and QA `probe-m48f` agree). `O_NOFOLLOW` stays as defense in depth. No control can discriminate it. |
| M5-4b | Masked for the V5-4 input and every in-process path; not equivalent under an outside writer. QA reports it as masked, not detected and not waived (no equivalence claim). The held code is safe in the race (P-B). See B-HR-04. |
| M8-4d, M8-6d, M-LD3c | Real self-test gaps. The `71a5bf9` lines close them (FIX-M8-4d, FIX-M8-6d and FIX-M-LD3c detected; fix baselines pass). |
| M2-4b, M2-9a, M6-1a, M4-7c, M8-5b, M2-2, M-IN4, M8-6c (error, not assertion) | Each error comes from the mutated behavior: a missing row, a second seed, a missing pre-reset log, a deleted file, a refused second exclusive write, a `readdir` on a 000 folder, a scratch in a 0500 folder, an invalid end time that throws. None comes from a broken mutation. M2-9a is also detected by behavior alone (probe). Diagnostics: B-HR-08. |
| M2-7a (stop check removed in the restore) | Detected by cause text only. The container layer (`storage-lane.mjs:102`) still refuses a write while services run, so the required outcome (no restore, cleanup failure, phase stop) holds under the mutant. The cause text is an observable result under triage §12. Acceptable. |
| Not in the campaign | A vanished lock (B-HR-01), the `withScratch` precedence (B-HR-02) and condition (d) (B-HR-03) have no mutant. My probes show that the vanished-lock and condition (d) mutants survive, and that the precedence fault exists in the held code (P-A2). |

## Limits and disclosures

- I did not run the full self-test suite or any acceptance. I rely on the QA metas for 105/105, and I checked their hashes and self-test hashes only.
- I did not read Reviewer-A's report (`bf8d897`); I saw only its commit subject in `git log`. When I displayed `71a5bf9`, I also saw its plan checkpoint at 16:14 UTC; it contains no review finding.
- I read the QA report at `1759ede` (SHA-256 `009c2ee2cba0510c474772016b5eff7340039023ded9c6b3705ccfecfb0ddb7b`, verified) only after I had sent my findings (`msg_b727bd1e4b1c`) and after Lead permission (`msg_872ba3fe50c7`, `msg_4fea72afeb79`). I read its header, §9.1 and its LD-2 rows. It changed no finding; I used it only to quote the QA dispositions of M4-8f and M5-4b.
- Manifest correction (Lead request): the first manifest listed five `probe/<mutant>/diff` entries. They were SHA-256 values of piped `cd <root> && diff -r <base>/tests probe/<mutant>/tests` output, not files. `manifest-2.tsv` replaces them with saved files that give the same values. While I made it, a shell loop made six empty, misnamed files, and a first `manifest-2.tsv` draft had wrong git references (zsh path modifiers). I removed the six empty files and rewrote the draft before I cited it. No probe ran again.
- `orca orchestration check` did not show five Lead messages. I read them through the filtered inbox at about 17:46Z and acknowledged them in `msg_b727bd1e4b1c`.
- Private-root deviation: `tmp/rows.diff` (a public `git diff`, no secret) was made `0644` at 16:07Z because that one command had no `umask 077`. I set it to `0600` at about 17:47Z. This does not make it compliant from creation. The same applies to `tmp/qa-report-1759ede.md.txt` (a copy of the committed QA report, no secret): it was made by a shell redirect without `umask 077` and set to `0600` in the same command. Two synthetic `outside.db` files are `0644` on purpose (scan-hit fixtures). `probe/out/probe-a.json` is a failed first attempt (the race was armed too early); P-A2 replaces it.
- Observation only: one QA mutant log (`mutants/run-m1-v112/M1-12a/run.log`) has mode `0644` inside QA's `0700` root. QA hygiene is outside this review.
- The mock lane in `storage-rows.selftest.mjs` is a large QA model of ADR-012 (about 850 lines). Its PASS shows harness order and restores, not product behavior. A product change can make it drift.

## Verdict

CHANGES_REQUESTED. B-HR-01 and B-HR-02 are BLOCKER (charter §5; Lead `msg_4fea72afeb79`). B-HR-03, B-HR-04 and B-HR-06 are MINOR. B-HR-05, B-HR-07 and B-HR-08 are NIT.

The bounded repair needs: one line in `storage-rows.mjs` and one LD-2 control (B-HR-01); one change in `storage-lane.mjs` `withScratch` (or in `storagePhase`) and its controls (B-HR-02). No criterion, row, manifest or count change is needed. After the repair, a short Round 2 can check the delta, the new controls with their mutants, LD-2, V7-1 and V2-8, and both complete self-check runs.
