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

## Round 2

Round 2 verdict: APPROVE (source review of tests tree `183a72b`; no runtime acceptance credit)

Reviewer-B, 2026-10-21 (UTC). This is a source review of the bounded Round 2 harness repair. **It gives no runtime acceptance credit.** A self-check pass count is not runtime acceptance. No M1 row changes status because of this review. The latest full runtime result stays 438 PASS, 50 FAIL at `aaa823b`. The Round 1 text above is unchanged.

### R2 identity and scope

| Item | Value |
| --- | --- |
| Role | Independent Reviewer-B, Round 2. A fresh Claude Code session (Lead `msg_5be928a5e72d`). The Round 1 text above is my predecessor's evidence. Blind: I did not read Reviewer-A's report, transcript or findings, or any plan text after `71a5bf9`. |
| Model | Claude Code Opus 5.5 (`claude-opus-5-5`), xhigh effort. |
| Lifecycle | Run `run_ebe671ad72a9`, task `task_025a5ff61125`, dispatch `ctx_ec443484d5f6`. Session `orca_session_id:52fc926d-4d37-4ea3-9cbf-77e4fc3a7e53`. |
| Source target | Held WIP commit `c71912ff76965f60d92d964ac0bccf5337f59771` (parent `90a5639`), tests tree `183a72b2fea5ff065fc57c96649199bc720fb6e0` (Lead `msg_97dcea53dcd0`). |
| Base | `71a5bf92608f8ee20e81363a0be987474fc59859`, tests tree `d574737219dffadb4447968bb0cc06393e61e5b9`. |
| Delta | `git diff 71a5bf9 c71912f -- tests`: exactly the 11 granted paths, 919 insertions, 49 deletions. Runtime: `storage-private-scan.mjs`, `storage-lane.mjs`, `storage-rows.mjs`, `storage-fixture-script.mjs`, `m1-migration.mjs`. Self-tests: `storage-private-scan`, `storage-rows`, `storage-private-copy`, `m1-migration`, `storage-source-inventory`, `storage-diagnostic`. No other test, product, manifest, row inventory or architecture path. `storage-diagnostic.mjs`, `storage-handoff.mjs`, `run-m1.mjs`, `storage-compat-route.mjs` and `storage-oracle.mjs` are byte-equal to `71a5bf9`. |
| Criteria | Charter §5 and §6. Frozen triage `2d763fe` (SHA-256 `ade4e8a0f9e54823040828758b7683d5c9b230587747f3ef3c89ef8e99f9a032`, verified) §4.3, §7.2–§7.5, §12. M1 precision `a60ba4a` (SHA-256 `ac444799ae5e93706054a7e352e339bdea509a889328c15365a3535864fb37af`, verified) LD-2. The Round 2 requirements of the dispatch. |
| QA control maps (Lead grant `msg_6d19ac9b5d99`) | `map/CONTROL-MAP.md` `6e28a020c3c702f09894b82d335486bc3620bff74164263801d664152cd68f8a`; `A-01.md` `34864741797fb9e9bc6a1e5abf2d5dfe395e839e5701cebed63828db887bdc58`; `A-01b.md` `39ad4463c48f1baed617caac9aa4e0d29dd9e13b6769cd9cc50d4b2697b45c0b`; `A-02.md` `d28455496254693386a52263e2371081a153a67039a56e5a35f7709e2ed958ab`; `A-03.md` `fe69065ec37aca14a00e0a5cc1fb3d996a991d811aa09c0f98b2f076d83e2599`; `A-04.md` `e3d4a464c8a8623643393405e5736bebba67f6a18d2b159500e9df354b7712c3` (3287 bytes, 0600). All verified. They hold QA's criteria and control proposals only. QA root: `/Users/quangnguyen/cogniate-qa-runs/storage-harness-repair-qa-r2-20261021T1646Z`. |

### R2 method

- I reviewed fixed Git objects only. I extracted `71a5bf9:tests` and `c71912f:tests` with `git archive` into my private root `/Users/quangnguyen/cogniate-review-runs/harness-repair-reviewer-b-r2-20261021T1814Z` (0700, made under umask 077). I read the whole delta and the unchanged code that it calls. I did not read the working-tree source while QA held it.
- I sent a criteria checkpoint before the source was held (`msg_31a1e6f85bd2`) and a static source status (`msg_ec3617189707`).
- I ran no self-test, no mutant and no probe. No concrete doubt remained that needed one. My checks are static: the V4-9 token pattern and the new import pattern over the twelve runtime modules of `c71912f`, file hashes, and a read-only script that compares QA's evidence with my own `git archive` copies.
- Deviation D-1: at about 18:20Z, one `node -e` command imported the held `storage-rows.mjs` from my private copy to print `SEQUENCE` indices. It had no fake `HOME` or `TMPDIR`, no Docker stub and no purpose that I sent first. It called no function and wrote no file. After it, I used static reads only.
- No Docker, Compose, network, service, settings change or dependency installation.

Evidence manifest: `manifest-r2-v1.tsv` in my private root (mode 0600; 509 real files with type, mode, size, SHA-256 and the Git base of each extracted file), SHA-256 `6e8693d7cefe6172dabef15f448bba6b8b33f9dc51c70e5427d082d31234e64d`. It excludes itself and the final copy of this section, whose bytes are in this file.

### R2 closure of the Round 1 findings

| Finding | Round 2 result |
| --- | --- |
| B-HR-01 (BLOCKER) | **Closed.** `g-orphan-refusal` now checks `recordBefore !== null` ("The original lock record is present before the first command") right after the snapshot. After **each** of the three commands it checks `<label>: the lock record is unchanged`, after the stale-record check. The final check after the loop stays. Controls (`storage-rows.selftest.mjs`): R2-03-01 (`orphan-lock-absent`) gives FAIL with that exact first cause. R2-03-02 gives FAIL with the exact first cause for a lock gone after `orphan-recover`, `orphan-up` and `orphan-backup`, and for the transient case (gone after `orphan-recover`, back byte-equal after `orphan-up`). The LD-2 case `orphan-lock-changed` now FAILs earlier, at `orphan-up: the lock record is unchanged` (a stronger check; no case removed). Mutants: MU-03-1 (non-null check removed), MU-03-2 (per-command check accepts `null`) and MU-03-3 (per-command check removed) are each DETECTED by an assertion. M-LD2a and M-LD2b stay DETECTED. The FakeWorld A6 model (an active storage container after an acquisition gives `storage_writer_active` and a release) is a mock-only change. It is needed for the R2-03-01 precondition. It cannot act while no storage container runs with a free lock; V7-1 and V2-8 pass with the unchanged declared map. |
| B-HR-02 (BLOCKER) | **Closed.** `withScratch` keeps the body error as the thrown error and puts a removal error on it as `scratchCleanup` (a non-Error body value becomes a `StorageFail`). `storagePhase`: a body error with `scratchCleanup` keeps its first cause, adds `cleanup note: <removal message>`, sets the step FAIL (also from BLOCKED), and sets the abort state when the removal error is a `PhaseAbort`. The later-step note keeps its template `phase stopped after <step>: <cleanup cause>; first cause: <first cause>`. A per-step scan hit after a FAIL or BLOCKED body is now a later note; the step is FAIL. Controls: R2-02-04/05 (a) and (b) at `@backup-B`, R2-02-05 (b, row) at `e-old-schema`, R2-02-07a and R2-02-07b, R2-02-01, R2-02-02, R2-02-02b, R2-02-05u and R2-02-06. In the scratch cases the race is undone right after the refusal, so no later scan can find it again. `stopProblems` checks 70 unique row ids, the exact first cause, the exact note of every later row and fixture, no product command after the stop, the abort-path scan and the `phase-end` log segment. The runner's owned teardown is outside `storagePhase`; `storagePhase` returns normally after a stop, so the teardown still runs. Mutants MU-02-1 to MU-02-11 (with MU-02-1u and MU-02-2m) are each DETECTED by an assertion. |
| B-HR-03 (MINOR) | **Closed for the required cleanup coverage.** The V8-6 stub now writes `summary.json` by fault: `cleanup` (one TEARDOWN FAIL), `cleanup-mixed` (PASS and FAIL), `cleanup-missing` (no TEARDOWN row), `cleanup-unreadable` (no file). Each expects the exact cause (`storage NOT RUN: migration owned cleanup did not pass`, or `… migration cleanup record unreadable`), no storage child, and teardown and W4 exactly once. These texts equal `storage-diagnostic.mjs:72–75`, which is unchanged. MU-V86-1 to MU-V86-4 are each DETECTED by the variant that only it can fail. **Deferred (MINOR):** the broader "published once" extension of Round 1 (a scan point published zero or two times, a wrong `configDiff` removal count). |
| B-HR-04 (MINOR) | **Unchanged; accepted limit.** The Lead accepts M5-4b as a bounded MINOR coverage limit under the specified V5-4 input. M5-4b stays NOT DETECTED and is never equivalent. The held `rmSync` stays safe in an outside-writer race (Round 1 probe P-B). |
| B-HR-05 (NIT), B-HR-07 (NIT) | **Deferred.** The delta does not touch `a-serialize`, `run-m1.mjs` or `storage-diagnostic.mjs`. |
| B-HR-06 (MINOR) | **Deferred.** The delta does not touch the plants outside `guarded`. |
| B-HR-08 (NIT) | **Deferred.** The same pattern stays in three error-based detections: MU-01-3b (`ENOENT` at `readlink`, because the mutant deleted the kept link), M4-7c and M2-4b. Each error comes from the mutated behavior. |

### R2 criteria coverage of the whole delta

| Area | Result |
| --- | --- |
| Scan roots (`storage-private-scan.mjs`) | Confirmed. `realChain` reads each folder from the base down with `lstat`: a directory, not a link, of the host user. `scanTree` checks its root chain before any `readdir`; an invalid root gives `<area>: not scanned: <rel> (<reason>)` and no walk. Data areas use the private root as base and are found with `lstat` (not `existsSync`). Extra roots are checked from the root itself. `scanOutside` checks the chain `clone/infra/.data` and the owner of each legacy folder, and the parent chain of each ledger path; a ledger path outside the clone is a problem. Every runtime ledger path (`copyCredentials`) is inside the clone. A root that is a link, a file, missing or of another owner FAILs, is not walked and gets no correction (R2-01-02, -02b, -03, -04 a–c; MU-01-1a/b/c, -7, -8, -10, -12). The public hit record keeps its Round 1 fields (`publicHit` removes `abs`, `base` and `chain`; R2-01-01). |
| 0755 area | Confirmed. A real 0755 area of the host user FAILs the closure and is still scanned; its same-owner hit gets the normal correction (R2-01-04 d). A closure problem never sets a refusal, so no new abort rule exists. |
| Corrections (§7.5 step 3, 4) | Confirmed. Stage 1: the recorded folder chain (device and inode from the base) before the open → `path changed before the correction: …`. Stage 2: the existing `O_RDONLY \| O_NOFOLLOW` open and `fstat` identity. Stage 3: the chain again after the open and before `fchmod` → `path changed after the open: …`. Stage 5: after the change, the chain and the path → a late refusal that reports the mode that the recorded inode now has. A refusal always goes to `refusals`, so the phase stops. R2-01-07 (P, O, R, D, Da, Db, L) counts `fchmodSync` and `chmodSync`: zero calls in every pre-open race and exactly one in L; R2-01-07o covers outside hits. MU-01-4, -5, -6, -9, -13 are DETECTED. Post-operation races are disclosed; no atomic guarantee is claimed: a window stays between stage 3 and the `fchmod` call of the same descriptor (no JavaScript between them), and after stage 5. |
| Scratch removal (`storage-lane.mjs`) | Confirmed. `removeScratch` scans from the private root down and records the scan first. An invalid scratch chain → `PhaseAbort`, nothing walked or removed (R2-01-06 c–e). Just before `rmSync`, the recorded chain is checked again → `PhaseAbort("… the folder changed before the removal: …")` (R2-01-06b). A residual window stays between that check and `rmSync`, and inside `rmSync`; `rmSync` removes a final link as a link. MU-01-1c, -3a, -3b, -11 are DETECTED. |
| Creation seams (§7.3, V4-1) | Confirmed. `createExclusive` calls the hook after `fstat` and before the first byte; `hook?.()` makes `null` and `undefined` inert. Site #7: the hook exists only when `QA_ORACLE_CREATE_OBSERVE` names an existing file, only in the oracle-B negative path (host self-test only); it appends with `O_APPEND \| O_NOFOLLOW` and never creates. Site #12: the four calls (`g-damaged`, `h-nomanifest` ×2, `h-old-manifest`; eight copies) pass `lane.copyHook` (default `null`). Site #13: `migrationRun` option `copyHook` (default `null`). `run-m1.mjs` is unchanged and passes no hook. |
| Creation controls | Confirmed. R2-05-07 starts the real oracle-B child through `/bin/sh` with umask 022 and 000 and asserts the umask that the shell reports. R2-05-12 runs the eight copies with the umask pinned to 022 and 000; each observation records its umask; `g-damaged`, `h-nomanifest` and `h-old-manifest` must PASS. R2-05-13 runs the four damage copies at 022 and 000. One check (O-1 to O-4): exactly one observation per file, an empty regular 0600 file at creation, the same device and inode as the final file, final mode 0600, folders 0700. R2-05-D shows each message. Every site-local token-free mutant (MU-05-7a/b, -12a/b, -12c-g/n1/n2/o, -13a/b) fails **both** mask tests, while the V4-9 inventory test passes on the same mutant copy. So the site control is the detector, apart from the inventory anchors. |
| V4-9 import rule | Confirmed. The pattern `/\b(?:from\|import)\s*(?:\(\s*)?['"][^'"]*\.selftest\.mjs['"]/` also matches a bare side-effect import (single quotes, double quotes without a semicolon, no space). The existing forms still FAIL; a bare import of a runtime module is allowed. MU-04-1 (Round 1 pattern) is DETECTED. My static run on `c71912f`: the token counts equal X1–X8 exactly and no runtime module imports a self-test. The anchors of #7, #12 and #13 follow the new call text. |
| Invariants | Confirmed. No change to `SEQUENCE`, `NEEDS`, the 21 restore sites, the V2-8 injections (27), the declared V7-1 map, LD-1, LD-3, the §9.1 raw time inequalities (`storage-handoff.mjs` byte-equal) or the X1–X8 table. V7-1, V2-8, LD-1, LD-2 and LD-3 pass in both final suites. |
| Hooks absent (R2-05-N) | Confirmed by evidence (below). The #12 and #13 records are byte-identical between the `71a5bf9` runtime and the held runtime; #7 differs only in the child pid in one file name. No row, status or first-cause normalization; no weak comparator. |

### R2 final QA evidence (checked by me)

Lead pointers: `msg_2f04c08e5432`, `msg_6a9d65a5518c`, `msg_b59d9c40b937`. My read-only script `bin/check-evidence.py` compares each item with my own `git archive` copies; its output is `notes/evidence-checks-1.txt`.

| Evidence (QA root) | SHA-256 | Result |
| --- | --- | --- |
| `evidence/held-hashes-2.txt` | `88d8f16380c88b6d014851ec2fb632d49efc41454e1d85659a20f0f2b63160ab` | 11/11 equal the `c71912f` blobs. |
| `logs/full2-u022.meta` | `cc547d3ed939cf391b87c7e4a32f79838936e1ecdfcb974a93fc1813dcc051a5` | 18:05:22Z–18:14:21Z, child umask 022: 142/142 PASS, 0 fail, 0 skipped, 0 cancelled, 0 Docker-stub calls, 0 temporary leftovers. 15/15 self-test hashes equal `c71912f`. |
| `logs/final-u077.meta` | `d1f927ec5ec01697c2885139a8b29c735a061377dc4a25b0115cc6d8823d3adf` | 18:15:04Z–18:24:09Z, child umask 077: the same counts. 15/15 self-test hashes equal `c71912f`. |
| `evidence/mutants-summary.json` | `bd6b21b9802fc7fff7f6e3f58d7d469be9b6381bc4c22bcea9db90cfc15b3802` | 70 mutants (46 new, 24 Round 1 reruns), 70 DETECTED, no SETUP ERROR; 67 by an assertion, 3 error-based (MU-01-3b, M4-7c, M2-4b). Catalog `bin/catalog-r2.py` `3df0c49b837bdc22932a02a061b99c7ae3ea0b83a9b16208165b782fdd469223` (with `catalog-r2-new.py` `20c7894b166e72a99e8c922b1f58c28d272da399f12b30ff64418d03c7a4909e`, `catalog-r2-round1.py` `ca15dc7686204eb9d8ca7e053a5f501ddcd68b28cedbfa5a8b6c53af342248da`); driver `bin/mutate.py` `4f71150f3b20a48ac7bcd329137a4b96e3294d1df2a9d217b10e07183889de09`: an anchor count other than expected is SETUP ERROR; DETECTED needs a failing control on the mutant copy and a passing control on an unmutated copy. |
| `evidence/mutant-copy-binding.json` | `363f354b5ca839b95e6bc05cba1e35b3d71b23abf659e60b3a43f3fa8491df70` | 113 copies (70 mutants, 43 baselines). My script compared every copy with my `c71912f` copy: only the expected mutated file differs; 0 mismatches. |
| `evidence/worktree-inventory-during-mutants.json`, `…-after-mutants.json` | `356588eb8855b9d3fa5d10b97d4ad1663a6ab6b1b3413c9cd744e69427c70b29` (both) | The worktree `tests/host` equals `c71912f` during and after the mutant runs. |
| `evidence/neutral/final-base-inventory-{before,after}.json` | `1fd7caca6144c74cc265673718c6a99856cdce956b2272bca22b8347a1f4006b` (both) | Base tree: runtime modules equal `71a5bf9`, self-tests equal `c71912f` (checked by me against both copies). |
| `evidence/neutral/final-new2-inventory-{before,after}.json` | `356588eb8855b9d3fa5d10b97d4ad1663a6ab6b1b3413c9cd744e69427c70b29` (both) | New tree: all equal `c71912f`. |
| `evidence/neutral/compare-v4-v3-final-base-v3-final-new2.json` | `a73900699cb1afa90325b4b46f38d04ab4fa19fdba7454146256f6b124284efa` | Equal. Comparator `bin/neutral-compare-v4.py` `0de0d348a16803a0f74116c815f509d592bd97989215ef397e3e579255cb3c9f`: strict whole-object equality; the only normalization is the #7 pid in the copy name. My script agrees: `site-12.json` and `site-13.json` are byte-identical; `site-7.json` is equal after the pid name only. #12: `g-damaged`, `h-nomanifest`, `h-old-manifest` PASS (first cause none), ten folders. #13: 12 evidence rows PASS, ten scan points. Runs: `logs/neutral-final-base-u022.meta` `5a596e68f8998b7f537579056997cced6287dc05bd12f831b7aa838e685e2823`, `logs/neutral-final-new2-u022.meta` `b1d394cbfe094a77e1972a3bfb8fffa7c67f7ac97dd3252bb00d158abffd3216` (3/3 PASS each). |

No observation hook in the neutrality runs: `replayLane` sets `copyHook: null`, the #13 run passes no `copyHook`, and `oracleB(…, null)` deletes `QA_ORACLE_CREATE_OBSERVE` from the child environment. The runtime callers pass no hook. `logs/neutral-final-env.txt` is 0 bytes; I do not use it as evidence. The failed first run `neutral-final-new-u022` (wrong folder, no tests found) and its two empty inventory files are kept and recorded in QA's `evidence/deviations.md`; QA repeated it as `final-new2`.

### R2 new findings

#### B-HR-09 — NIT — the scratch removal names a missing folder "not a real folder … and is kept"

- **Where:** `tests/host/storage-lane.mjs:273`.
- **Problem:** When the scratch folder is absent at removal, `realChain` gives `absent`; the `PhaseAbort` text says the folder "is not a real folder of the host user and is kept". The phase stop is correct (the cleanup cannot run safely), but the text can mislead a triage. No current body removes its own scratch folder.
- **Suggested fix:** a separate text for `absent`, for example "the folder is missing".

#### B-HR-10 — NIT — a `scratchCleanup` note is dropped when the body error is itself a `PhaseAbort`

- **Where:** `tests/host/storage-rows.mjs:129–135` (`if (e instanceof PhaseAbort) … else if (e?.scratchCleanup)`).
- **Problem:** A body `PhaseAbort` with a `scratchCleanup` sets the abort state from the body error, but the cleanup note is not added. The refusal stays in the scan record. No current `withScratch` body can throw a `PhaseAbort` (no nested scratch), so this path is not reachable today; the phase still stops.
- **Suggested fix:** add the cleanup note in both branches.

### R2 limits and disclosures

- No runtime acceptance credit. I ran no self-test, no mutant and no probe; I rely on QA's runs. I checked their hashes, their binding to the held bytes and the record equality myself.
- The suite metas hash the self-tests only. The runtime binding of the two final suites is by bracketing: `held-hashes-2.txt` (18:05:22Z), my worktree check (18:23:44Z), the neutral inventories (about 18:19Z) and the worktree inventories during and after the mutant runs all equal `c71912f`. `full2-u022` ran before the commit time (18:15:55Z) on the same bytes.
- The scan guard starts at the root that it checks (the lane private root or the extra root). Folders above that root are not checked. This matches the specified rule.
- The mock lane (`FakeWorld`) is QA's model of ADR-012. Its PASS shows harness order, restores and stops, not product behavior.
- QA's report `docs/reviews/M1/storage-harness-repair-qa.md` at `614baae` (SHA-256 `57005503aa133b7eb2c50565e84e7d80db6d90ab7d053891efa8cc5e7f488c2f`, verified; Lead `msg_659f4e22ca11`) was committed after I had written this section. I read only a few lines of its Round 2 by search: the verdict scope, the bounded-race text, the M5-4b and M4-8f text and the V4-9 correction. They agree with this review and changed no finding. My verdict rests on the evidence files above.
- `git log` showed the subject of commit `ba4b124` ("record independent Round 2 harness approval A"). I did not read that commit or Reviewer-A's file. My findings were complete and sent (`msg_ec3617189707`) before that commit.
- My manifest `manifest-r2-v1.tsv` lists only real files of my private root. Deviation D-1 is in `notes/deviations.md`.

### R2 verdict

APPROVE for the source of tests tree `183a72b2fea5ff065fc57c96649199bc720fb6e0` (`c71912f`), with no runtime acceptance credit. No BLOCKER or MAJOR is open. B-HR-01 and B-HR-02 are closed. B-HR-03 is closed for its required cleanup coverage. Deferred: the B-HR-03 published-once extension (MINOR), B-HR-04 (MINOR, accepted limit; M5-4b NOT DETECTED, not equivalent), B-HR-06 (MINOR), and B-HR-05, B-HR-07, B-HR-08, B-HR-09, B-HR-10 (NIT). A change to any of the 11 paths cancels this verdict.

## Round 3

Round 3 verdict: APPROVE (source review of tests tree `290a773f1c9779693153ae77b46cc8ceb7eb83f4`; no runtime acceptance credit)

Reviewer-B, 2026-10-21 (UTC). This is a bounded source review of the Round 3 harness repair: the service-state checks of the storage fixtures after the candidate `C` diagnostic. **It gives no runtime acceptance credit.** A self-check pass count is not runtime acceptance. No M1 row changes status because of this review. The Round 1 and Round 2 text above is unchanged (prefix SHA-256 `a2b31180636c085aa3d95117b937e0fdcdf482fd85144548ad7c3aaa1708f385`, 48,745 bytes, at `d3296dd`).

### R3 identity and scope

| Item | Value |
| --- | --- |
| Role | Fresh independent Reviewer-B, Round 3. Blind: I did not read any peer review report, transcript or finding. I did not read the uncommitted QA report in the worktree. I read only §R2.13 of the committed QA report at `7f4cc61`, after my findings and evidence checks were sent and the Lead sent it as final evidence. |
| Model | Claude Code Opus 5.5 (`claude-opus-5-5`), xhigh effort. |
| Lifecycle | Run `run_ebe671ad72a9`, task `task_1f1e4e4466b9`, dispatch `ctx_d547c43bc41a`. Session `orca_session_id:3e4f3eee-628a-4752-a0d4-d05532373748`. |
| Source target | `c4de96f41163a23c182f0fbcb513460086da2fd8`, tests tree `290a773f1c9779693153ae77b46cc8ceb7eb83f4`. Held SHA-256: `storage-rows.mjs` `0958cc49fdf24c447f6b8eb446b17908979e6516f186cd8343fc7a77ede215c1`, `storage-rows.selftest.mjs` `9ef56478f7099dc28a8733c163f4803f36cc8bc1f24b687cb28e388eaeec4376`, `run-m1.mjs` `8e1ef65ccac3bc593f501e6f871be3a8e987fe59e3441b0a303897629d57a076`. All three equal my `git archive` copy. |
| Base | Old candidate `C` = `d3296dd6eddbe723364a639d8e2db0adf12ab183`, tests tree `183a72b2fea5ff065fc57c96649199bc720fb6e0`. |
| Delta | `git diff d3296dd c4de96f -- tests`: exactly the three granted files, 32 insertions, 8 deletions (`run-m1.mjs` +2/−1, `storage-rows.mjs` +5/−3, `storage-rows.selftest.mjs` +25/−4). The other paths of the commit are documentation (`README.md`, `docs/**`). The product (every path outside `docs/**`, `tests/**` and `README.md`) is byte-equal to `9f8ac625443931242edd8da301c3d4f0d3e34290`. |
| Criteria | Charter §5 and §6. Frozen triage `2d763fe` (SHA-256 `ade4e8a0f9e54823040828758b7683d5c9b230587747f3ef3c89ef8e99f9a032`, verified) §4.3, §12 (V2-8, V4-9, V7-1). M1 precision `a60ba4a` (SHA-256 `ac444799ae5e93706054a7e352e339bdea509a889328c15365a3535864fb37af`, verified): `e-fresh-refusal`, "nothing changes", the write after `B`. ADR-012 §7, §9, §11. The Round 3 grant in the dispatch. |
| QA proposal | `diagnosis-c/backup-B-502.md` (SHA-256 `b0004ad12a62694b66d6509a918e2934bc004981ffa87e2561a8565f187500bd`, 5,900 bytes, 0600) and `backup-B-502-erratum.md` (SHA-256 `1205cdbcf729bad7ea4601b16f2133eac9512763322de15567675d5944904d4a`, 371 bytes, 0600; it corrects the header time to 19:31:17Z). QA root: `/Users/quangnguyen/cogniate-qa-runs/storage-harness-repair-qa-r2-20261021T1646Z`. This is QA's proposal, not a peer finding. |

### R3 method

- I reviewed fixed Git objects only. I extracted `d3296dd:tests` and `c4de96f:tests` with `git archive` into my private root `/Users/quangnguyen/cogniate-review-runs/harness-r3-reviewer-b-task_1f1e4e4466b9-20261021T1942Z` (0700, made under umask 077). I read the whole delta and the unchanged code that it calls: `serviceContainers` and `servicesStopped` (`storage-docker.mjs`), `stopServices`, `snapshot` and `assertUnchanged` (`storage-lane.mjs`), `nothingChanged` (`storage-oracle.mjs`), `run` (`lib.mjs`), and the FakeWorld lane, `dryRun` and `EXPECTED` (`storage-rows.selftest.mjs`). These modules, `dryRun` and `EXPECTED` are byte-equal to `C`.
- I sent the criteria and static findings first (`msg_39a67f609c91`, `msg_a867279ca113`), then the evidence check (`msg_e866fd661968`) and the `stack:down` and R2-D-2 reconciliation (`msg_d09251f8afb0`).
- I ran no self-test, no mutant and no probe. No concrete doubt remained that needed one. My checks of QA's evidence are three read-only Node scripts (`bin/bind-copies.mjs`, `bin/equiv-2.mjs`, `bin/tail-blocks.mjs`) and reads of QA's logs, metas and npm debug logs. The scripts import no test or product code and run no Docker command. They ran with my normal `HOME`, without a Docker stub, and wrote only into my private root under umask 077.
- No Docker, Compose, network, service, settings change or dependency installation. No repository edit except this section.

### R3 assessment of the QA diagnosis

The hypothesis is correct. `serviceContainers` lists every lane container that is not a one-off and not a storage container (`storage-docker.mjs:330–343`). On a real lane these are `proxy`, `postgres`, `moodle`, `lti-service` and `cogniate-app`. The harness stop stops only the two app services (`storage-lane.mjs:85–91`). So after `e-not-same-import`, `.some((x) => x.running)` at `@backup-B` was true because of the three platform containers. The fixture skipped `stack:up` and wrote the markers through the proxy to a stopped `lti-service` (HTTP 502). All 37 failed rows depend on `@backup-B`. The same class is in `postB` (every `@post-B`) and in `e-fresh-refusal` ("No service starts" would FAIL while the platform runs). A search of the 26 runtime modules of `tests/host` finds no other running-state check over the unfiltered container list. `stopped()` (`storage-rows.mjs:248`) still issues one extra harness stop while the platform runs; this is harmless and unchanged. `bOracle` (`:1325`) already filters the app names.

### R3 source review of the three sites

| Site | Result |
| --- | --- |
| `appRunning` (`storage-rows.mjs:249–250`) | Correct. True only when **each** of `lti-service` and `cogniate-app` has a container with `running: true`. An absent, `created`, `exited` or `dead` app container, or one app down, gives false. |
| `postB` (`:298`) and `@backup-B` (`:866`) | Correct. They now call `up()` (product `stack:up`, exit 0, then `waitHealthy`) unless both app services run. `stack:up` on a running or half-running stack is the accepted `a-second-start` path. The predicate decides only whether `up()` runs before `writeMarkers`. The marker write, the stop, the backup and the logical checks are unchanged. |
| `e-fresh-refusal` (`:1080`) | Correct. "No service starts" now checks the two app services only. `assertUnchanged` is unchanged code; its snapshot uses `lane.services()`, which lists every lane container, and `nothingChanged` compares `id`, `startedAt` and `created` of each. So a start, restart or new container of `proxy`, `postgres` or `moodle` still FAILs the row. The change drops only the wrong condition "no platform container already runs". |
| `run-m1.mjs:71–72` | Correct. Only the `--harness-only` self-test call gets `timeoutMs: 1_800_000`; every other bound is unchanged. A timeout still fails (`checked` asserts exit 0). The measured run took 574 s (32 % of the bound). |

No refusal, start, data-integrity or lock invariant is weaker. No row, criterion, oracle, manifest, `SEQUENCE`, `NEEDS`, V7-1 map, V2-8 injection or V4-9 table changed. The delta adds no V4-9 token.

### R3 controls

- **FakeWorld platform (opt-in `platformOn`).** The first `startServices` makes running `proxy`, `postgres` and `moodle` containers with the lane project label (`storage-rows.selftest.mjs:368–371`). The fake `docker compose stop` and the fake quarantine act on the app services only, so the platform persists. `reset()` clears it (`:935`), and the next start makes it again. `all()` lists it (`:445`), so the fake `serviceContainers` now gives the real lane's list. When `platformOn` is not set, the default dry runs behave as in `C`; only log entries get two more fields.
- **R2-RT-1 (`:1821–1834`).** The full dry run with the platform. It asserts: the declared V7-1 map in both directions; the discriminating precondition at the end of the step before `@backup-B` and before the first `@post-B` (both app services stopped, three platform containers running); every HTTP request of those two steps while both app services ran; and the `e-fresh-refusal` precondition (platform running before it, app services stopped after it).
- **Old/new (QA evidence, checked).** `logs/rt-base-u022` (19:37:45Z–19:38:07Z, pattern `R2-RT-1|V7-1`): V7-1 PASS, R2-RT-1 FAIL at the declared-map assertion with exactly 37 rows "not run: prerequisite `@backup-B` did not pass". This is the shape of the `C` diagnostic. `src/rt-base/tests/host` equals `c4de96f` except `storage-rows.mjs`, which equals `C` (`run-m1.mjs` is not imported by `storage-rows.selftest.mjs`). `logs/rt-new-u022`: 2/2 PASS.
- **Mutants (QA evidence, checked).** Catalog `bin/catalog-rt.py` (SHA-256 `818cce53851dd8e697967b023afee1e5a0382f0fd3913e3887e48bde4cd8ef80`) was made at 19:38:43Z, before the run `mutate-rt1` (19:38:54Z); driver `bin/mutate.py` `4f71150f…` is unchanged from Round 2. Each mutant puts back the exact `C` line at one site. MU-RT-1 and MU-RT-2: DETECTED, the 37-row `@backup-B` cascade (MU-RT-2 fails through `postB('b1')` inside `@backup-B`). MU-RT-3: DETECTED, exactly `e-fresh-refusal: FAIL "No service starts"`. Each detection is a failed assertion; the unmutated baseline passes. My script: each mutant copy equals my `c4de96f` `tests/host` except `storage-rows.mjs`, which is `c4de96f` with exactly one anchor (count 1) replaced; the baseline copy equals `c4de96f` (`notes/bind-copies-1.json`).

### R3 complete suites (QA evidence, checked)

| Run | Result |
| --- | --- |
| `logs/final-rt-u077` (`run-suite.sh` `4a83fbc4…`; 19:40:18Z–19:49:50Z; child umask 077; own `HOME` and `TMPDIR`; Docker stub first) | exit 0; 143/143 PASS; 0 fail, cancelled, skipped, todo; 15/15 self-test hashes equal `c4de96f`; 0 Docker-stub calls; 0 temporary leftovers. |
| `logs/ho-rt-u022` (`node tests/host/run-m1.mjs --harness-only --provider blackboard`; 19:40:16Z–19:49:54Z; child umask 022; own `HOME` and `TMPDIR`; Docker stub first) | exit 0; 172/172 PASS; 0 fail, cancelled, skipped, todo; then `tsc` typecheck and the inventory line. One npm metadata request after the tests (R2-D-2, below). Before and after hashes of all 42 `tests/host` files equal `c4de96f`. `tmp_left=1` is Node's compile cache of the `tsc` step (tool state), not a test leftover. |
| Equivalence (my `bin/equiv-2.mjs`, `notes/equiv-2.json`) | Every one of the 143 test names of the 077 suite appears exactly once with a pass mark in the harness-only output. The other 29 are `tests/sim` and `tests/acceptance/M1/common` tests only. So the harness-only run is a superset of the complete self-test suite at umask 022, with full results, no skipped or interrupted test, and source binding by its own before and after hashes. `notes/equiv-1.json` is an earlier output of the same check; it reported 17 false gaps because TAP escapes `#` as `\#`. Version 2 fixes only that. |
| Network deviation R2-D-2 (QA) | Confirmed in the npm debug logs of `home/ho-rt-u022`: one `http fetch GET 200 https://registry.npmjs.org/npm 417ms` in the `npm --prefix tests run typecheck` call that started at 19:49:50.629Z, after the `node --test` child had ended (`run-m1.mjs` awaits it). Inside the self-tests, the two npm calls of each run (`config get update-notifier`, and the V1-12 `run stack:data-backup`, exit 1) have no fetch line; the 077 run has no npm typecheck and no fetch line. So the 172 results stay valid functional evidence, but the harness-only run is not a network-compliant run, and the deviation stands. No traffic capture exists, so other network use is not excluded. |
| Corrective tail (`logs/tail-rt-u022`, 19:54:39Z–19:54:42Z, `bin/tail-replay.mjs` `d2c911fae750ed1bcddce9731658682ddbb0058b313f7a864487d1828b3998ea`) | Valid as bounded evidence of the typecheck and the four `vitest list` discoveries only. The launcher checks the `run-m1.mjs` hash and runs its literal `checked`/`loadingRuntime` definitions and tail block; my `bin/tail-blocks.mjs` on my `c4de96f` copy gives the same block hashes (`f731ea4b…`, `9d542ea3…`; `notes/tail-blocks-1.json`), and the tail has no self-test call. A new private `HOME` with `.npmrc` `update-notifier=false` and `offline=true`; its two npm debug logs have no fetch line; exit 0; the summary line equals the first run. |
| QA final report | `docs/reviews/M1/storage-harness-repair-qa.md` at `7f4cc61396930a791991e9eef5426ebff08f673a`, SHA-256 `b6248d0e841130de35925655b802fe7e282649605ca6edfd77fe97c0df86e688`, 77,922 bytes (verified). I read only §R2.13, after the Lead sent it as final evidence (`msg_f936277acf7d`). It agrees with my checks. Manifest `evidence/manifest-r2-v4.tsv` SHA-256 `eb3a24f548afad0e3291f247afedcebe9f074f78af347ae229530738e1ee00ca` (hash verified; the Lead verified its 7,028 entries). |

### R3 findings

#### B-HR-11 — MINOR — no control covers partial app availability

- **Where:** `tests/host/storage-rows.mjs:250` (`appRunning`); control `tests/host/storage-rows.selftest.mjs:1821–1834`.
- **Problem:** The grant requires that `appRunning` needs **both** app services. No control has a state with exactly one app service running when `@backup-B` or `postB` checks it. The fake stop and start act on both services; the one-service fake restart (`:756`) runs only in the early `a-restart`, `a-restart-refusal` and `i-enable-refusal` rows, on a running stack. R2-RT-1 asserts that both app services are stopped before each discriminating step. So, as a static prediction, a mutant that accepts one running app service (`.some` over the two names) passes R2-RT-1 and V7-1. I did not run such a mutant; this is not observed mutation evidence.
- **Why MINOR:** The code is correct (static). The required controls (R2-RT-1, MU-RT-1 to MU-RT-3) exist and detect their faults. A discriminating case is missing; no required control fails.
- **Suggested fix:** one R2-RT-1 variant with a hook at the end of `e-not-same-import` that starts only `lti-service`; expect `up('before-B-marker')` and every HTTP request with both app services running.
- **Lead disposition (`msg_e56fc43281a4`):** accepted as MINOR deferred coverage under charter §5. No source repair or survivor probe in this round. The id is kept for the M4 carry-forward.

#### B-HR-12 — NIT — a harness-only timeout is not named in the failure text

- **Where:** `tests/host/run-m1.mjs:52–56` (`checked`), with `run` in `tests/host/lib.mjs:12–34`.
- **Problem:** `checked` ignores `result.timedOut`. After 30 minutes the run prints the partial output and then "`node` failed: `<stderr>`", without the word "timeout". The result stays a failure, so it is honest, but the cause is not named. `run` signals only the direct child.
- **Note:** Pre-existing helper. No change is requested in this batch.
- **Lead disposition (`msg_e56fc43281a4`):** accepted as NIT deferred timeout diagnostics. The id is kept for the M4 carry-forward.

Observation (no finding): `appRunning` does not include `proxy`, which the API write path also uses. No harness step stops `proxy` alone, and such a fault gives a loud HTTP error, not a false PASS.

### R3 deferred items

Unchanged and deferred: the B-HR-03 published-once extension (MINOR), B-HR-04 (MINOR, accepted limit; M5-4b NOT DETECTED, not equivalent), B-HR-06 (MINOR), and B-HR-05, B-HR-07, B-HR-08, B-HR-09, B-HR-10 (NIT). The delta does not touch their sites. New and deferred by the Lead (`msg_e56fc43281a4`): B-HR-11 (MINOR), B-HR-12 (NIT).

### R3 limits and disclosures

- No runtime acceptance credit. I ran no self-test, no mutant and no probe; I rely on QA's runs. I checked their hashes, their binding to my own `git archive` copies, the test names and the failure texts.
- The FakeWorld lane is QA's model of ADR-012 and of the platform containers. Its PASS shows harness order and decisions, not product or Docker behavior. No control asserts that `reset()` removes the platform; the code is one assignment. R2-RT-1 runs the full 70-row dry run, so it runs the fake `stack:down` of `a-second-start` (`storage-rows.mjs:448`; fake at `storage-rows.selftest.mjs:962`). The fake only stops the two app services and keeps every container, also the platform. The real `stack:down` removes all lane containers, and the next `stack:up` makes new ones with new ids. The effect on this delta is none: after `a-second-start` both app services and the three platform containers run in the fake and in the real lane, so the three predicates get the same inputs later, and no check of the delta compares container ids across `a-second-start` (`assertUnchanged` compares inside one row). R2-RT-1 does not model the re-creation of the platform by `stack:down`.
- The rows after `@backup-B` have no real storage run on any candidate. Their runtime result stays unknown until a new diagnostic window.
- `final-rt-u077` ran in `<worktree>/tests/host` (`run-suite.sh` `cd "$dir"`; QA §R2.13). Its meta hashes the 15 self-tests only. The runtime modules are bound by bracketing: all 42 `tests/host` files equal `c4de96f` at 19:38:43Z (`held-hashes-rt.txt`), 19:40:16Z and 19:49:54Z (the harness-only inventories) and 19:50:28Z (`evidence/worktree-inventory-rt.json`, SHA-256 `16c5ccee1241bd24f68302f9e3a435c4a0541a8078c67dd526e5f609ac663d00`). The R2-RT-1 PASS in that run also excludes the `C` `storage-rows.mjs`, which fails R2-RT-1.
- `orca orchestration check` gave three Lead messages (19:48:57Z, 19:51:24Z, 19:53:15Z) only at 19:55Z; my filtered inbox read did not list them. I acknowledged them in `msg_d09251f8afb0`.
- My first status message gave the delta as "+40/−6". The correct count is 32 insertions and 8 deletions (`git diff --numstat`); I corrected it in a later message.
- At the start, `git log --oneline -15` showed commit subjects up to `01f3973`, including the Round 2 subject `ba4b124` (already disclosed in Round 2). I read no peer file.
- Evidence manifest: `manifest-r3-v2.tsv` in my private root (mode 0600; 531 real files with type, mode, size, SHA-256, and for each Git-extracted file its Git object and blob check; 0 blob mismatches), SHA-256 `87cb10a430d50d5f622361c6d173fef5a2335e53dc518c7bce9bd4957648a00d`. It excludes itself and `notes/round3-final.md`, the final copy of this section, whose bytes are in this file. It lists the superseded `manifest-r3-v1.tsv` (SHA-256 `4d5ec01817bc853eae0db3922831cc08875174719c751e2a83a81edcda169e01`) and the drafts `notes/round3-draft-v1.md` to `-v4.md`; v4 was a first final copy with a wrong Role-row sentence, fixed only by `bin/draft-v5.py`. Every entry of the root is owner-only (`find -perm +044` finds none).

### R3 verdict

APPROVE for the source of tests tree `290a773f1c9779693153ae77b46cc8ceb7eb83f4` (`c4de96f`), with no runtime acceptance credit. No BLOCKER or MAJOR is open. The three sites are correct, no invariant is weaker, and R2-RT-1 with MU-RT-1 to MU-RT-3 discriminates the old and the repaired behavior by failed assertions. The complete 077 suite passes; the harness-only 022 run is a full superset of the complete 022 suite and is functional evidence, but it is not network-compliant (QA R2-D-2); the bounded corrective tail covers only its typecheck and discoveries. New and deferred by the Lead: B-HR-11 (MINOR), B-HR-12 (NIT). Earlier deferred items are unchanged. A change to any of the three paths cancels this verdict. Runtime evidence needs a new frozen candidate and a new diagnostic window.

## Round 4

Round 4 verdict: APPROVE (source review of tests tree `17330479829a6b65e560afc297e2bee6777459dd`; no runtime acceptance credit)

Reviewer-B, 2026-10-22 (UTC). This is a bounded source review of the Round 4 harness repair: the three first causes of the candidate `C2` storage diagnostic. **It gives no runtime acceptance credit.** A self-check pass count is not runtime acceptance. No M1 row changes status because of this review. The Round 1 to Round 3 text above is unchanged (prefix SHA-256 `7527cc2a6733d44c3c8aaae171639730e968d64ef08ae761f108c530d6c6f1cc`, 68,179 bytes, at `572fe4e`).

### R4 identity and scope

| Item | Value |
| --- | --- |
| Role | Fresh independent Reviewer-B, Round 4. Blind: I did not read any peer review report, message or conclusion. I am independent of the repair owner `ctx_898acbaef3a6`. |
| Model | Claude Code Opus 5.5 (`claude-opus-5-5`), xhigh effort. No subworkers. |
| Lifecycle | Run `run_ebe671ad72a9`, task `task_dceb2a7a9e76`, dispatch `ctx_85d74f1aba96`. Session `orca_session_id:d6226934-300e-4700-abe8-101746e0a323`. |
| Source target | `cd731397fa2a5ee660b1b9575f942caec64c2f21`, tests tree `17330479829a6b65e560afc297e2bee6777459dd`. Held SHA-256: `storage-rows.mjs` `a9ef100d1aa0b8ba956b74a8c1d0ea8433fdc66bab8c9a1ba606068065a65f94` (120,488 bytes), `storage-rows.selftest.mjs` `4fcd18d5c7fee4bbb8e07a8a22391d591d36c8a81f152de15c290f6ce7a42ba2` (163,725 bytes). Both equal my `git archive` copy. |
| Base | Candidate `C2` = `0938ea1bd29acd00a67c7fc1cc8d7606edf2802d`, tests tree `290a773f1c9779693153ae77b46cc8ceb7eb83f4`. |
| Delta | `git diff 0938ea1 cd73139 -- tests`: exactly the two granted files, 200 insertions, 28 deletions (`storage-rows.mjs` +42/−8, `storage-rows.selftest.mjs` +158/−20), 21 hunks; I read every hunk. The other paths of the commit are documentation. The product (every path outside `docs/**`, `tests/**` and `README.md`) is byte-equal to `9f8ac625443931242edd8da301c3d4f0d3e34290`. |
| Criteria | Charter §5 and §6. ADR-012 §6 (identity `legacySources`), §8 (drill table `prepared-lti`; recovery rows R0–R2; `--pause-after`; import "from the manifest"), §10 (L6). M1 precision `a60ba4a` (`M1.md:262`, `:286–287`, `:293–295`). Frozen triage `2d763fe` (SHA-256 `ade4e8a0f9e54823040828758b7683d5c9b230587747f3ef3c89ef8e99f9a032`, verified) §3.1 (attribution to the own run), §8. The Lead grant (`msg_ae92ccdcd298`, `msg_6ea06c164c32`, `msg_3152abb8b4e6`). |
| Failure facts | QA C2 section of `docs/reviews/M1/qa.md` at `e4d7058` (SHA-256 `66e3e2fcbb3b984199a6eac5307fc78f85861f290e95b8a2ca5768880e4bc7ab`, verified): FC-1, FC-2, FC-3 and three dependent "not run" rows. |

### R4 method

- I reviewed fixed Git objects only. I extracted `0938ea1:tests/host` and `cd73139:tests/host` with `git archive` into my private root `/Users/quangnguyen/cogniate-review-runs/harness-r4-reviewer-b-task_dceb2a7a9e76-20261022T0112Z` (0700, made under umask 077). I did not read the worktree test files. I read the whole delta and the unchanged code that it calls: `linesOf`, `jsonLines`, `until` and `spawnGroup` (`storage-oracle.mjs`); `fileset` and `readJson` (`storage-fixture-script.mjs`); `state` and `allLogLines` (`storage-lane.mjs`). Product reads at `9f8ac62`: `drillOptions` (`infra/scripts/stack-data.mjs:304–325`), `logTo` (`:631–634`), the import `legacySources` (`:737`), L6 (`:122–129`), `storage_run` (`infra/scripts/lib.sh:370–376`) and the restore call (`infra/scripts/stack-data.sh:88`).
- I read only the relevant redacted C2 artifacts: `cmd/317`, `332`, `334`, `335` and `567`, `storage/g-orphan-refusal-kill.json`, and the five `storage/log-archive` segments.
- I sent questions before the source existed (`msg_01a0cb2fc73d`), one correction (`msg_1045d62e1256`), the source assessment (`msg_cb668c905ef6`), the focused evidence check (`msg_6bd720327c3f`) and the final-report check (`msg_7ee9c5824516`).
- I ran no self-test, no mutant and no probe. My checks of QA's evidence are two read-only Python scripts that import no test or product code (`bin/bind-mutants-v3.py`, `bin/bind-inventory.py`) and direct reads (`diff`, `grep`, `shasum`, `stat`) of QA's indexes, metas, TAP files and npm debug logs. The scripts ran with my normal `HOME`, without a Docker stub, and wrote only into my private root under umask 077. Statements marked "inference" below come from reading code and data; they are not executed probes.
- No Docker, Compose, network, service, settings change or dependency installation. No repository edit except this section.

### R4 C2 facts (my independent read)

| Cause | Facts |
| --- | --- |
| FC-1 | `cmd/332`: own output has `storage_drill_stop`, opId `43c92156…`, point `prepared-lti`. `cmd/334`: exit 1, "cancelled at the first journal write; the targets equal the state before (verified)". `cmd/335`: the lti journal is `rolled_back` with opId `43c92156…`; the app journal is `present: false`. `cmd/317`, the last file set before the drill (only `h-nomanifest` refusals come between): both journals `present: false`. |
| FC-2 | All five log-archive segments together have one `storage_drill_pause` (20:32:25.836Z, op `afa56af2…`, `swapped-lti`, 120 s) and its resume (20:34:25.840Z). Both belong to `g-orphan-refusal`. Its kill record: lock `runId` `610b2a16…`, record `pgid` 34638 = the spawned `pgid`, `containers: []` at the first read; the running container suffix and run label are `83b5370d…`, not the lock `runId`. |
| FC-3 | `cmd/567`: both identities list `lti-service/lti.db` (122,880 bytes, `584617df…`) and `cogniate-app/cogniate.db` (315,392 bytes, `57edf5a9…`). |

### R4 source review of the three sites

| Site | Result |
| --- | --- |
| FC-1: `drill` (`storage-rows.mjs:1369–1370`, `:1392–1395`) and `firstWriteRolledBack` (`:1638–1649`) | Correct. Only `prepared-lti` uses the new predicate. Every other non-committed point still needs both journals `rolled_back`. The opId comes only from the drill command's own output. The lti journal must be `rolled_back` with that opId. The app journal observation (`present`, `sha256`, `json`) must equal the observation taken after `stopped()` and just before the drill; a missing observation fails. This is ADR-012 §8 R1: "write lti `rolled_back` X; leave the app journal as it is". `equalsBefore`, the second `--recover`, `assertUnchanged`, the `g-recover-idempotent` entry, `up` and the stop are unchanged. Inference: on the C2 data above the predicate passes. A generalization to other points fails closed, because `pre` is `null` there. |
| FC-2: `orphanStart` (`:1414–1421`), `ownPause` and `waitOwnPause` (`:1650–1659`) | Correct. The wait reads only the spawned group's own output: event `storage_drill_pause`, point `swapped-lti`, a 32-hex opId. The bound stays 180 s; no pause fails at the deadline. The `SIGKILL` of the group, the empty-group wait and the one-running-container check are unchanged. The selected pause is saved in `<label>-kill.json` and returned. This follows triage §3.1: "An event or a record of another run never ends the wait." Inference (source and evidence): the product runs the maintenance container attached (`dc … run --rm -T`, `lib.sh:375`), the restore call does not capture it (`stack-data.sh:88`), and `logTo` writes stdout before the log file. C2 `cmd/332`, the captured client output of the same path, holds the container's `storage_drill_stop` line. No C2 record shows a pause line in a spawned group's output, because C2 saved no group output; the R4 kill record will. If the line does not arrive, the row fails at the deadline; it cannot pass falsely. |
| FC-3: `e-import` (`:1163`) and `legacySourcesMatch` (`:1660–1669`) | Correct. Both identities are checked. Each list must equal the manifest `files` as a sorted multiset of complete `[name, size, sha256]` entries, non-empty, with duplicates counted. No basename or other normalization is applied on either side. The product builds `legacySources` from the same `m.files` (`stack-data.mjs:737`), and the harness reads that manifest from `X2`. |

`SEQUENCE`, `NEEDS`, `DRILL_POINTS`, the row ids and the V7-1 map are unchanged; the 70-row map is intact. The three intended assertion sites change. No unrelated existing assertion is weakened or changed. No refusal, data-equality, idempotence or cleanup check is removed.

### R4 fake-world fidelity (`storage-rows.selftest.mjs`)

- **R1 and R0.** At `prepared-lti` the fake writes only the lti journal (`prepared`, opId X) and logs `storage_drill_stop` with that opId. `recover` returns "nothing to recover" when each journal is absent or terminal (R0). For lti `prepared` X with the app journal absent or terminal with another opId (R1), it writes lti `rolled_back` and leaves the app journal; exit 1 with the ADR message. The C2 fake wrote both journals at every point, and its second `--recover` would have written an app journal.
- **Orphan pause.** The holder gets its opId, the lane log path, a marker path, a 1,000 ms delay and a mode. After the delay it writes the marker file first, then the product-shaped pause line to the lane log, then to stdout. `orphanSync` runs at each fake Docker, exec and npm answer. It makes the `swapped-lti` journals and the running maintenance container only after the marker exists. So a kill before the marker leaves no container, and every earlier pause stays in the lane log. Injection `orphan-unrelated-log-pause` appends a pause of another opId to the lane log right after the lock record.
- **Import and L6.** Both identities get full names with size. L6 compares `service/name`, size and SHA-256 for both identities, order-free. Injection `import-app-sources-differ` changes one digest in the app identity only.
- The other holder callers (`a-lock-*`) pass five arguments and are not restore commands, so the new arguments are unused there.

### R4 controls (QA evidence, checked)

- **Index.** `r4/evidence/r4-evidence-index-1.txt` (SHA-256 `fff986c922025c9f586c7fb02f01e60f2c0a324d747aaa997a3d327cb2c1a455`): all 26 entries match SHA-256, size and mode. `r4/old/*` equal my `C2` copy; `r4/held/*` equal my `cd73139` copy.
- **Old/new.** Old-control `storage-rows.mjs` (`a7e8c788…`, 120,406 bytes) is the `C2` file plus one appended block (a comment, `OP_ID` and the four new helpers); `diff` shows nothing else. The `C2` row code does not name these helpers, so the block is inert at the old call sites. The other 41 files equal the held tree. `old-control-1` (022, pattern `R4|V7-1`, 01:23:38Z–01:24:39Z): 3 PASS (the pure tables) and 5 FAIL. V7-1 fails with exactly the six C2 rows and the C2 first-cause texts: `g-prepared-lti` "A verified rolled_back", `g-orphan-stopped` "The maintenance container still runs", `e-import` "legacySources equal the manifest list", and the three "not run: prerequisite" rows. The four world tests fail. `focus-final-1` (022, held self-test, 01:25:29Z–01:26:21Z): 7/7 PASS, no Docker-stub call, no temporary leftover. `focus-new-1` (an earlier self-test, `df8c8ca0…`) had 6/7 because a test-only comparison included a duration note; it is preserved, and `focus-new-2` passed that test.
- **The R4 world test asserts:** the eight rows through `e-provenance-restore` PASS; the drill exits 3; the app journal is absent before the drill and after the recovery; 11 `recover-again-*` calls exit 0 with "nothing to recover" and 11 `g-recover-idempotent` notes; the lane log has the two pauses (refusal, stopped) with different opIds, equal to the two kill records; both identities list the full names.
- **Negative controls.** Pure tables: FC-1 three pass cases and eight fail cases; FC-2 six rejected lines and two 300 ms deadline failures; FC-3 nine plus two fail cases (basename only, wrong service path with an equal digest, missing, extra, duplicate, digest, size, no size, empty). World: `r1-same-op-app-journal` → `g-prepared-lti` FAIL with the R1 text; `orphan-unrelated-log-pause` → the three orphan rows PASS, four pauses in the log, the own pauses are the second and the fourth; `import-app-sources-differ` → `e-import` FAIL with the app text.
- **Mutants (`mutants/run-r4-1`).** The catalog `r4/bin/catalog-r4.py` (SHA-256 `18e872c239414ea6e25e68dd1bb57f9916addafabf3fdb62138acac8b4eacbd6`, mtime 01:23:19Z) precedes the results (01:27:42Z). Three baselines pass. MU-R4-FC1, -FC2 and -FC3 put back the exact `C2` text; each fails at the original first cause. MU-R4-FC1-pre (`pre` replaced by the state after recovery) and MU-R4-FC3-lti (lti identity only) make the negative row PASS, and the control fails by assertion. My `bin/bind-mutants-v3.py` (`notes/bind-mutants-3.json`): each mutant copy has 42 files equal to the held tree, except `storage-rows.mjs`, which is the held file with exactly one catalog anchor (count 1) replaced; the three baseline copies equal the held tree.

### R4 complete suites (QA evidence, checked)

| Run | Result |
| --- | --- |
| `r4/logs/complete-u022` (`run-suite.sh` `8ad8b1f1…`; 01:28:03Z–01:38:44Z; child umask 022; own `HOME` and `TMPDIR`; Docker stub first; empty pattern) | exit 0; 150/150 PASS; 0 fail, cancelled, skipped, todo; all 15 `*.selftest.mjs` files once, each hash equal to `cd73139`; 0 Docker-stub calls; 0 temporary leftovers. 150 = the 143 tests of the Round 3 complete suite (same tests tree as `C2`) plus the 7 new tests; the delta adds 7 tests and removes none. Meta `80cf38e2df9dc20c7fa1d97734dd8ce0a0f384f7541ad61ff645d20d6234d45a`, TAP `0e4d7ba5be4a4e8b99d1d16e94d74f07ea69465ccc282c80534db7c5581ff8c8`. |
| `r4/logs/affected-u077` (01:29:31Z–01:40:09Z; child umask 077) | exit 0; 48/48 PASS (the 41 earlier tests of the file plus the 7 new tests); only `storage-rows.selftest.mjs`, hash `4fcd18d5…`; 0 fail, cancelled, skipped, todo; 0 Docker-stub calls; 0 temporary leftovers. Meta `31c760b37ddf522c617bf3833ddf6c120ce79c3e47088f6d74e18be491d7dbe5`, TAP `57b9da6415e0ace2b844cd8b9d6d62dd213cc0368298390f5b559847dfcfc3db`. |
| Runtime module binding | Both runs ran in the worktree `tests/host`. The metas hash the self-tests only. QA inventories at 01:28:23Z and 01:40:15Z list all 42 `tests/host` files; my `bin/bind-inventory.py` finds every hash equal to my `cd73139` copy (`notes/bind-inventory-1.json`, `-2.json`). They bracket the 077 run. The 022 run started at 01:28:03Z, 20 s before the first inventory; there is no inventory before its start. Its binding is the hold and the Lead's commit `cd73139` at 01:27:52Z, the start-time self-test hashes, and the inventories during and after the run (QA §R2.14a). |
| Network configuration (QA deviation R4-D-1) | The R4 runner made no `.npmrc` in the fake `HOME`. In `complete-u022` the unchanged V1-12 probe made three npm calls (`config get update-notifier`, `--version`, `run stack:data-backup`) with its own scratch `.npmrc` (`update-notifier=false`) but without `offline=true`. I checked the two debug logs in `r4/home/complete-u022/.npm/_logs`: no `http fetch` line (`--version` writes no log). This is not traffic proof. So `complete-u022` is valid functional evidence, but it is not a network-compliant run. |
| V1-12 replay (QA §R2.14a) | `r4/logs/v112-replay` (01:48:21Z–01:48:22Z, child umask 022; runner `run-v112.sh` `d13933e6…`): only the unchanged V1-12 test, `storage-oracle.selftest.mjs` `8421d6d0…` (equal to `cd73139`); a new private `HOME/.npmrc` (0600, `offline=true`, `update-notifier=false`, `fund=false`, `audit=false`, `bc272fbe…`, unchanged after the run) made before any npm call. 1/1 PASS, exit 0, 0 skipped, 0 R4-stub calls, 0 temporary leftovers. Both npm debug logs load that `.npmrc` and have no `http fetch` line. The inventories at 01:48:20Z and 01:48:29Z equal my `cd73139` copy (my `bin/bind-inventory.py`). `7a0bfa0` changes only `docs/team` after `cd73139`. Index `r4/evidence/r4-evidence-index-3.txt` (`969a1555e2bb6d9b6d06654b572cd0b9133726aa84faaffd4edf59a237edca66`): all 11 entries verified. The replay covers only that probe; it does not make the first run compliant. |
| QA final report | `docs/reviews/M1/storage-harness-repair-qa.md` at `133f93ee668661a696322c886a86841e10349230`, SHA-256 `607c6fdb91201c23a2ce73beffa6e155e12a5fc1682502ea9754c5179edd6ec9`, 95,362 bytes (verified). Its first 91,609 bytes equal the held §R2.14 version (`d4997b964cee6bec18e2d5ef643e20c7db738e6ad510b7175f0ec5dd8c3ab461`). I read only §R2.14 and §R2.14a, after the Lead sent them as final evidence (`msg_c56d2a2e17a9`, `msg_4fe9abe8993e`). They agree with my checks. Index 2 (`f505f649a2efa2ad12173e047fbb101deee7dea7907c7906505309841e7acae7`): all 43 entries verified. `tests` at `133f93e` equal `cd73139`. |

### R4 findings

No new BLOCKER, MAJOR, MINOR or NIT finding.

Observations (no finding; adjacent, unchanged code; the Lead keeps them as observations in `msg_6ea06c164c32`):

- **O-R4-1.** The lock-record wait in `orphanStart` (`storage-rows.mjs:1412–1413`) accepts any `owner.json`; it does not check `pgid` = the spawned `pgid` (triage §3.1 step 3 uses that binding). A foreign record fails closed later (the `storage_lock_reclaimed` owner checks); it cannot give a false PASS. In C2 the record `pgid` equaled the spawned `pgid`.
- **O-R4-2.** The container check is a name prefix (`:1419`). Binding it to the lock `runId` would be wrong: the container suffix is the storage run id (C2: `83b5370d…`, lock `runId` `610b2a16…`). A valid binding would re-read `owner.json` after the kill and require the container name in its `containers` list. My first question proposed the wrong binding; I corrected it in `msg_1045d62e1256`.
- **O-R4-3.** `stopCheck` (`:335–338`) still accepts an earlier `storage_drill_stop` with the same point from the lane logs. Exit 3 is still required, and `g-prepared-lti` now takes its opId from the command's own output only.
- **O-R4-4.** `e-provenance-restore` (`:1180`) compares the lti `legacySources` only. The product writes one list to both identities.
- **O-R4-5.** The fake FC-2 discrimination depends on time: the holder pauses after 1,000 ms, and the record wait polls every 250 ms. On this host, old-control and MU-R4-FC2 failed as intended. A very slow host could let the old behavior pass the fake row; that is a control false negative, never a false product PASS.

### R4 deferred items

Unchanged and deferred: the B-HR-03 published-once extension (MINOR), B-HR-04 (MINOR, accepted limit; M5-4b NOT DETECTED, not equivalent), B-HR-06 (MINOR), B-HR-11 (MINOR), and B-HR-05, B-HR-07, B-HR-08, B-HR-09, B-HR-10, B-HR-12 (NIT). The delta does not touch their sites.

### R4 limits and disclosures

- No runtime acceptance credit. The repaired rows and the three formerly blocked rows (`g-recover-idempotent`, `e-kept`, `e-provenance-restore`) have no real storage run on this source. The next diagnostic must show them executed: 11 `g-recover-idempotent` entries, a `g-orphan-stopped` kill record with the own pause (opId of this operation), and `e-kept` and `e-provenance-restore` with their own commands. A PASS count alone is not enough.
- The FakeWorld is QA's model of ADR-012. Its PASS shows harness order and decisions, not product or Docker behavior.
- I ran no self-test, no mutant and no probe; I rely on QA's runs and my binding checks. The `C2`-data and attached-output statements are inferences from code and artifacts.
- The two complete runs ran in the worktree `tests/host`. Their runtime modules are bound by the two QA inventories (01:28:23Z, 01:40:15Z) and by the commit at 01:27:52Z. The first inventory is 20 s after the 022 run start; an edit and revert inside a bracket is not excluded by these records.
- My binding script failed twice before `bind-mutants-v3.py` (tuple parsing in the catalog reader). The two failed versions, `bin/bind-mutants.py` and `bin/bind-mutants-v2.py`, and their empty outputs `notes/bind-mutants-1.json` and `-2.json` (0 bytes, 0600) stay in my root.
- The first `orchestration check` gave `msg_6e559f3f2c90` again on a later read, because I had not acknowledged its batch. No message was lost.
- QA §R2.14 names the Lead id `A-SH-11` (MINOR, deferred to M4) for the `stopCheck` observation, and the Lead's `msg_c56d2a2e17a9` names it too. I did not read any peer report. I sent the same point first as question Q9 in `msg_01a0cb2fc73d` (about 01:12Z), before I read §R2.14. My O-R4-3 is the same item; I agree with MINOR and the deferral.
- Evidence manifest: `manifest-r4-v1.tsv` in my private root (mode 0600; 104 real files and 9 folders with type, mode, size and SHA-256; for each of the 84 Git-extracted files its Git object and blob check, 0 mismatches), SHA-256 `3284dd0639224d01b26067fb62a79ab8e055ba12537e8907f351a694d88bd4e9`. It excludes itself and `notes/round4-final.md`, the final copy of this section, whose bytes are in this file. It lists the drafts `notes/round4-draft-v1.md` to `-v5.md`, the question and status notes, and the failed script versions. Every entry of the root is owner-only (`find -perm +044` finds none).

### R4 verdict

APPROVE for the source of tests tree `17330479829a6b65e560afc297e2bee6777459dd` (`cd73139`), with no runtime acceptance credit. No BLOCKER or MAJOR is open. Each of the three C2 first causes is repaired at its own site, and no contract is weaker: R1 only at `prepared-lti`, only the own pause of the spawned operation, and complete `legacySources` of both identities. The fake world now models the three product behaviors. On it, the old C2 rows fail with exactly the C2 shape, the repaired rows and the three formerly blocked rows pass, and five bound mutants are detected by assertion. The complete 022 suite (150/150) and the affected 077 file (48/48) pass on the held bytes. The complete 022 run is functional evidence but not network-compliant (QA R4-D-1); the V1-12 replay covers only that probe. I have no new finding and five observations. Earlier deferred items are unchanged. A change to either of the two files cancels this verdict. Runtime evidence needs a new frozen candidate and a new diagnostic window. Still required: the diagnostic (migration 12 rows, then storage 70 rows), two complete 488-row rounds, the 12 legacy groups, and fresh M2 and T7. All 32 live LMS rows stay `UNVERIFIED`; local Canvas stays `DEFERRED`.

## Round 5

Round 5 verdict: APPROVE (source review of tests tree `8283d90dc669feb72eeb7ec43f5dbf80a156f0d4`; no runtime acceptance credit)

Reviewer-B, 2026-10-22 (UTC). This is a bounded source review of the Round 5 harness repair: the `g-tamper` target selection that failed the candidate `C3` full round 1. **It gives no runtime acceptance credit.** A self-check pass count is not runtime acceptance. No M1 row changes status because of this review. The Round 1 to Round 4 text above is unchanged (prefix SHA-256 `c8d0e9248853249d7727209679afc1a59bb18224e545ed9c6263a884314940b3`, 90,449 bytes, at `c4c6d04`).

### R5 identity and scope

| Item | Value |
| --- | --- |
| Role | Independent Reviewer-B, Round 5 (lens: ownability and evidence quality). Blind: I did not read `storage-harness-reviewer-a.md` or any peer review message or conclusion. I am independent of the repair owner `ctx_898acbaef3a6`. |
| Model | Claude Code Opus 5.5 (`claude-opus-5-5`), xhigh effort. No subworkers. |
| Lifecycle | Run `run_ebe671ad72a9`, task `task_5ec3f3a1c1c4`, dispatch `ctx_153504502fc4`. Session `orca_session_id:04e9b240-0b16-4dcb-bf61-c6e62c803edb`. |
| Source target | `27e1f6102409b3d6b676bc46a28150624450a444`, tests tree `8283d90dc669feb72eeb7ec43f5dbf80a156f0d4`. Held SHA-256: `storage-rows.mjs` `fbb99131ca0dc5673006ee500c0d413d8005298efaee320d7213ecb60016ba85` (123,062 bytes), `storage-rows.selftest.mjs` `edc2d97a1753b92c320e020c3bd6f201c476c9dca76eeea29e731911923364f6` (171,250 bytes). Both equal my `git archive` copy and the fixer's `r5/held` copies. |
| Base | Failed candidate `C3` = `c4c6d045b3a132f72bf059d77367d278de9222fa`, tests tree `17330479829a6b65e560afc297e2bee6777459dd` (my R4 hashes `a9ef100d…` and `4fcd18d5…`, verified again). |
| Delta | `git diff c4c6d04 27e1f61 -- tests`: exactly the two granted files, `storage-rows.mjs` +36/−3, `storage-rows.selftest.mjs` +103/−9. The diff SHA-256 is `907b61f98791558837793128d707a5299b5fc579a0eba8bbd29e3f90bfe8d4da`, equal to the fixer's `r5/held/r5.diff`. I read every hunk. `27e1f61` changes only these two files. `d9ffc59` after it changes only `docs/team`. |
| Product | Every path outside `docs/**`, `tests/**` and `README.md` is byte-equal to `9f8ac625443931242edd8da301c3d4f0d3e34290`, except `infra/README.md`. That file is documentation; `5a5453c` ("M4 (wip): clarify storage refusal output in infrastructure guide"), a commit after `C3`, changed it. No code, script or configuration path differs. |
| Criteria | Charter §5 and §6. M1 `g-tamper` (`docs/architecture/tasks/M1.md:288`) and the LD-3 precision and negative controls (`:313–314`). ADR-012 §8: journal states (`swapped`), "After a commit, one previous generation is kept, and older `.previous-*` folders are removed" (`:407`), R3 steps 3 and 6, recovery drills. Lead grant `msg_f8be5a9636b8`, fixer plan v2 `msg_b72ab04bc19b`, source hold `msg_f3a938656609`, Lead handoff `msg_531468a7f02c`. |
| Failure facts | `docs/reviews/M1/qa.md` §"Full run at candidate C3", first cause `g-tamper` and the 17 dependent rows (committed at `6ebeeb6`). |

### R5 method

- I reviewed fixed Git objects. I extracted `c4c6d04:tests/host` and `27e1f61:tests/host` with `git archive` into my private root `/Users/quangnguyen/cogniate-review-runs/harness-r5-reviewer-b-task_5ec3f3a1c1c4-20261022T0347Z` (0700, made under umask 077). I read the whole delta and the unchanged code that it calls: `check` and `linesOf`/`jsonLines` (`storage-oracle.mjs`), `entry`, `listRoot` and the `flip` plant (`storage-fixture-script.mjs`), and in the self-test `dryRun`, `afterSave` (hooks), `drillStop`, `recover`, `restoreInto`, `orphanSync`, the orphan completion, `injectTamper`, `EXPECTED` and `compareMap`.
- I read only the relevant `C3` raw command records, read only: full round 1 `cmd/515` to `cmd/518` and `cmd/520`, `storage/steps/055-g-tamper.json`; and the same four records of the `C3` diagnostic (`…T02-07-12-250Z`).
- My checks are read-only Python scripts that import no test or product code, run with `python3 -I`: `bin/real-tamper-check.py` (the new target and precondition rules, written again in Python, on the real `C3` logs), `bin/bind-r5.py` (mutant, baseline and old-control copies against my copies), `bin/bind-inventory-r5.py`, `bin/bind-final-r5.py` (final TAP and meta files, npm debug logs, `.npmrc` files) and `bin/verify-index.py`. `bind-r5.py` executes the fixer's catalog `r5/bin/catalog-r5.py` to read its anchors; I read the whole file first, and it holds only literal assignments.
- I ran no self-test, no mutant and no probe. No Docker, Compose, network, service, npm, settings change or dependency installation. No repository edit except this section.
- I sent one interim status, without a finding, after the source review (`msg_79e130d257b9`).

### R5 C3 facts (my independent read)

| Run | Own stop output | `.previous-*` in the lti listing before the plant | Planted | Recovery |
| --- | --- | --- | --- | --- |
| Full round 1 | `cmd/515` (`ad7cd35a…`): exit 3, one `storage_drill_stop`, point `swapped`, opId `7011aa7c703074d4650ddad2b299a689` | `cmd/516` (`4639edc4…`): `.previous-3f350b56…` and `.previous-7011aa7c…` | `cmd/517` (`9b4f70b0…`): `.previous-3f350b56…/lti.db` | `cmd/520` (`e264a760…`): exit 1, "rolled back; … (verified)"; step `055` (`2b2b88b8…`): FAIL "--recover after the tamper: expected exit 2, got 1" |
| Diagnostic | `cmd/515` (`1a0eeaf6…`): one line, `035f404e…` | `cmd/516` (`6237fed4…`): `.previous-035f404e…` and `.previous-f6af6f85…` | `cmd/517` (`e94ebb2a…`): `.previous-035f404e…/lti.db` | Row PASS (QA record; I did not read its `cmd/520`) |

My `bin/real-tamper-check.py` (`notes/real-tamper-check-1.json`) applies the new rules to these bytes. Round 1: the new target is `.previous-7011aa7c…/lti.db`, one regular file. The real listings `516` and `518` differ only in the planted file, so the strict precondition has no field that changes by itself (the listing has no time fields; `entry`, `storage-fixture-script.mjs:166–174`). With the new target, the precondition on round 1 bytes reports "`.previous-7011…/lti.db` did not change" and "`.previous-3f35…/lti.db` changed", so the new row would stop before `--recover`. Diagnostic: the new target equals the planted file, and the precondition passes. This agrees with ADR-012 §8 `:407`: the extra folder is the kept generation of the last commit (the orphan operation completed in `g-orphan-complete`). No product fault is shown.

### R5 source review (`storage-rows.mjs`)

| Site | Result |
| --- | --- |
| `g-tamper` (`:980–1001`) | Correct. The row calls `tamperTarget(stop, l)` on the listing before any change. `check` throws (`storage-oracle.mjs:18`), so a refusal stops the row before the plant. The plant uses only `target.path`. After the plant, `tamperMade(l, listedBefore, target.path)` must be empty before `--recover`; the failure text starts with "precondition not made", so a harness precondition is not confused with a product result. The command order stays the same (stop, list, plant, list, file set, recover; `cmd/515` to `cmd/520` in round 1). The precondition uses the two existing listings and adds no command. `stopCheck`, exit 2, "Every journal rollback_failed", `tamperChanges`, `rootJournalChanges`, the `stack:up` refusal naming `stack:data-quarantine` and "no target changed" are unchanged. |
| `tamperTarget` (`:1678–1689`) | Correct and simple. It reads only the drill command's own output (`linesOf` = stdout and stderr). Zero lines, any line with another point, any opId that is not 32 lower-case hex, or more than one opId → `{ problem }`. The same line twice is accepted. The target is the exact path `.previous-<X>/lti.db`; exactly one entry, of type `file`, else `{ problem }`. No lane-log fallback, no sorted first or last pick, no retry. This matches M1 `:288` ("`.previous-<opId>/lti.db` in the `ltidb` volume") and grant `msg_f8be5a9636b8`. |
| `tamperMade` (`:1694–1702`) | Correct. Over both volumes it requires the same entry names, a target that is a file before and after with another SHA-256, and every other entry JSON-equal (type, owner, mode, size, SHA-256, link target), the kept generation included. |
| Sweep | Confirmed. Line 984 at `C3` was the only operation-specific folder selection in `tests/host`. `:316–318` (no `.restore-*`, no empty `.previous-*`) and `:1148` (no `.restore-*` or `.previous-*` after a fresh-target rollback) check all folders, so a kept generation does not change them. No other `tests/host` module names `.previous-`. |

`SEQUENCE`, `NEEDS`, `DRILL_POINTS`, the row ids, `EXPECTED` and the 70-row map are unchanged. No acceptance check is removed or made weaker; the delta adds one precondition. A-SH-11 (`stopCheck` also reads lane logs) stays the accepted MINOR. `g-tamper` no longer depends on it, because `tamperTarget` needs the own line.

### R5 fake-world fidelity (`storage-rows.selftest.mjs`)

- **Kept generation (ADR-012 §8 `:407`).** `keepGeneration(opId)` keeps `.previous-<opId>` and removes `.restore-*` and every other `.previous-*` in both volumes. The two fake commit paths that leave a previous folder call it: the `committed-lti` recovery (R4) and the orphan completion. Before, both removed every `.previous-*`, so the `C3` state could not occur in the fake.
- **Rollback (R3 step 6; R1).** The fake rollback removes only `.restore-<X>` and `.previous-<X>` of its own operation; R1 removes only `.restore-<lti opId>`. A kept generation of an earlier commit stays, as in `C3` (`g-orphan-stopped` did not remove `3f35…`).
- **Both orders.** `newOpId(kind)` sets the first hex digit for `drill` or `orphan` operations only when a test sets `opIdFirst`; otherwise the id stays random. `KEPT_FIRST` reproduces round 1, `KEPT_LAST` the diagnostic.
- **Recovery decision.** The fake `recover` gives exit 2 only when a file of `.previous-<journal opId>` differs from the journal's `previous` hashes. So a change in the kept generation leads to a rollback and exit 1, as the product did in round 1.
- **`tamper-no-effect`.** The plant skips the `flip` and still lists it as done. Only `g-tamper` uses `flip` (`storage-rows.mjs:986` is the only `op: 'flip'`), so the injection affects no other row.
- **`injectTamper`.** The LD-3 negatives now use `.previous-<journal opId>` instead of the first `.previous-*`, so they stay deterministic with a kept generation.

### R5 controls (QA evidence, checked)

- **Tests added.** Four `HARNESS ONLY: R5` tests. (1) Both orders up to `g-tamper`: the row PASS in both; the two `.previous-*` folders are in the intended order; the drill's `lti.db` changed; the kept `lti.db` hash equals its hash after `g-orphan-complete`; `g-tamper-recover` exit 2. (2) Full dry run with `KEPT_FIRST`: 70 rows, `compareMap` against the unchanged `EXPECTED` gives no problem, and the 17 former dependents PASS by name. (3) `tamper-no-effect`: `g-tamper` FAIL with exactly "precondition not made: .previous-<32 hex>/lti.db did not change its bytes", and no `g-tamper-recover` call. (4) Tables: 2 accepted and 12 refused `tamperTarget` cases (no line, another point, mixed points, no opId, short, upper case, two opIds, only the kept generation, folder, link, two entries, no listing); 1 passing and 7 failing `tamperMade` cases.
- **Old control (`r5/logs/old-control-2`, 03:44:35Z–03:45:32Z, child umask 022, pattern `R5`).** My `bin/bind-r5.py` (`notes/bind-r5-1.json`): the copy has 42 files; 41 equal the held tree; its `storage-rows.mjs` (`a91c1bc2…`) is the `C3` file plus one appended block (a comment and the two new helpers, the same text as held). The `C3` row does not call them, so the block is inert. Result 1 PASS, 3 FAIL. Test 1: actual `['kept first: FAIL --recover after the tamper: expected exit 2, got 1', 'kept last: PASS']`, which is the round 1 cause and the diagnostic result. Test 2: exactly 18 problems, `g-tamper` with the round 1 cause and the same 17 rows as `qa.md` with their "not run: prerequisite" causes. Test 3: the old row runs `--recover` and gives the round 1 cause. Test 4 passes, as expected. `r5/old/*` equal `C3`.
- **Mutants (`mutants/run-r5-1`, catalog `r5/bin/catalog-r5.py` `c0f5fba1…`, results `3e4b8e23…`).** Both baselines (the two R5 world tests on copies equal to the held tree) pass. MU-R5-1 puts back the exact `C3` selector: DETECTED by assertion, actual `kept first: FAIL --recover after the tamper: expected exit 2, got 1`. MU-R5-2 removes the precondition check: DETECTED by assertion, the cause is "--recover after the tamper: expected exit 2, got 1" instead of the precondition text. `bind-r5.py`: each mutant copy has 42 files equal to the held tree except `storage-rows.mjs`, which is the held file with exactly one catalog anchor (count 1) replaced; both baseline copies equal the held tree. 0 Docker-stub calls, 0 temporary leftovers.

### R5 complete suites (QA evidence, checked)

| Run | Result |
| --- | --- |
| `r5/logs/complete-u022` (`run-suite.sh` `7cbe8c1f…`; 03:47:24Z–03:59:13Z; child umask 022; own `HOME` and `TMPDIR`; fail-closed Docker stub `119bf837…` first; empty pattern) | exit 0; 154/154 PASS; 0 fail, cancelled, skipped, todo; all 15 `*.selftest.mjs` files once, each hash equal to my held copy; 0 Docker-stub calls; 0 temporary leftovers. My `bin/bind-final-r5.py` (`notes/bind-final-r5-1.json`): the 154 names are the 150 of R4 `complete-u022` plus the 4 R5 tests; none removed. Meta `f441b31a…`, TAP `e22f9e41…`. |
| `r5/logs/affected-u077` (03:47:30Z–03:59:13Z; child umask 077) | exit 0; 52/52 PASS (the 48 R4 tests of the file plus the 4 R5 tests, none removed); only `storage-rows.selftest.mjs` `edc2d97a…`; 0 fail, cancelled, skipped, todo; 0 Docker-stub calls; 0 temporary leftovers. Meta `66cc5544…`, TAP `8d0c3e81…`. |
| Runtime module binding | Both runs used the worktree `tests/host`. Inventories immediately before each launch (03:47:20Z, `060cc11d…`; 03:47:27Z, `82ac0d2e…`) and after both runs (03:59:26Z, `4dd2489e…`) each list 42 files; my `bin/bind-inventory-r5.py` finds 0 missing, 0 extra and 0 different against my `27e1f61` copy. This closes the R4 gap (no inventory before the 022 start). The Lead committed `27e1f61` at 03:47:39Z with the same bytes. |
| Network configuration | The runner makes `HOME/.npmrc` (0600, `offline=true`, `update-notifier=false`, `fund=false`, `audit=false`, `bc272fbe…`) before the child starts. It is unchanged after the runs. In `complete-u022` the unchanged V1-12 probe made its npm calls; both debug logs (`80b0480f…`, `c9f56c0e…`) load that `.npmrc` and have no `http fetch` line; no notifier marker. `affected-u077` made no npm call. This resolves R4-D-1 for these runs. It is log evidence, not traffic proof. |
| Evidence index | `r5/evidence/r5-evidence-index.txt` (`a82b8bd2f72edab154b06666d9d922f8c27e26f11b92c6d13559e77e3415c88b`): all 44 entries match SHA-256, size and mode (`bin/verify-index.py`). |
| QA final report | `docs/reviews/M1/storage-harness-repair-qa.md` at `5681c0f771fb30399d88c7059e6cf9f4286c90f9`, SHA-256 `601cfb93c2661425dba12afcdde3fa0d41ac6c02effec06abf4c844f417a357b`, 104,926 bytes (verified from Git). Its first 95,362 bytes equal the R4 version at `133f93e` (`607c6fdb91201c23a2ce73beffa6e155e12a5fc1682502ea9754c5179edd6ec9`). I read only §R2.15, after the Lead sent it as final evidence (`msg_5da8affe5699`, `msg_4ec70991aaf7`). It agrees with my checks, also on its disclosures: the zsh slip, `focus-1` and `focus-2` on an earlier self-test, the `old-control-1` hook error on old code, the npm debug logs at 0644, and the fake normal-commit limit (my O-R5-1). `tests` at `5681c0f` equal `27e1f61` (tree `8283d90d…`); `5681c0f` changes only that report. |

### R5 findings

No new BLOCKER, MAJOR, MINOR or NIT finding.

Observations (no finding):

- **O-R5-1 (fake, unchanged code).** A normal restore in the fake (`restoreInto`, `storage-rows.selftest.mjs:873–879`) makes no `.previous-<opId>` and removes no older one, and its committed journal gets a new random opId. In the product, every commit keeps its own previous generation (ADR-012 §8 `:407`). This does not affect the R5 claim: between `g-orphan-complete` and `g-tamper` no restore commits, the fake has exactly the kept orphan folder and the drill folder (asserted by R5 test 1), and the real `C3` listings show the same two folders. The later rows ran against the real product in the `C3` diagnostic and passed. A future check that depends on the kept generation of a normal restore needs this model first.
- **O-R5-2 (evidence).** QA §R2.15 says "the held bytes give R5 4/4 PASS (`r5/logs/focus-3`)". The `focus-3` meta (03:44:35Z, before the hold at 03:47:15Z) records only the self-test hash, not `storage-rows.mjs`, and no inventory brackets it. So I give it no weight. The held-byte proof is the two final runs (inventories before and after), the mutant baselines and the old control (copies that I compared byte for byte).
- **O-R5-3 (scope note).** `tamperMade` checks that the target's SHA-256 changed. It does not check the target's own mode, owner or size; the `flip` plant keeps them, and the grant asks only for the hash. Not a weakening.

### R5 deferred items

Unchanged and deferred: A-SH-11 (MINOR, M4; my O-R4-3), the B-HR-03 published-once extension (MINOR), B-HR-04 (MINOR, accepted limit), B-HR-06 (MINOR), B-HR-11 (MINOR), and B-HR-05, B-HR-07, B-HR-08, B-HR-09, B-HR-10, B-HR-12 (NIT). O-R4-1, O-R4-2, O-R4-4 and O-R4-5 stay observations. The delta does not touch their sites.

### R5 limits and disclosures

- No runtime acceptance credit. `g-tamper` and its 17 dependents have no real storage run on this source. The next diagnostic and full rounds must show, for `g-tamper`: the own stop line, the planted path `.previous-<that opId>/lti.db`, the listing before and after the plant (only that file changed), `--recover` exit 2 and the LD-3 results; and the 17 rows executed with their own commands. A PASS count alone is not enough.
- The FakeWorld is QA's model of ADR-012. Its PASS shows harness order and decisions, not product or Docker behavior. The real-log check above is my re-derivation in Python of the two new rules; it is not an execution of the harness.
- I ran no self-test, no mutant and no probe; I rely on QA's runs and my binding checks.
- Edits or reverts inside a bracket of two inventories are not excluded by these records; the bracket is 03:47:20Z to 03:59:26Z.
- QA deviation `r5/evidence/deviations-r5.md` (a zsh `:t` slip made two empty `r5/old` files, which were removed and made again; the bytes now equal `C3`) agrees with my `bind-r5.py` result.
- Evidence manifest: `manifest-r5-v1.tsv` in my private root (mode 0600; 102 real files and 8 folders with type, mode, size and SHA-256; for each of the 84 Git-extracted files its Git object and blob check, 0 mismatches), SHA-256 `d890cb6db0f0434f73f8600b8082341df8f21f4932b42263afaf29499824ddd6`. It excludes itself and `notes/round5-final.md`, the final copy of this section, whose bytes are in this file. It lists the drafts `notes/round5-draft-v1.md` to `-v3.md`, my scripts and their outputs. Every entry of the root is owner-only (`find -perm +044` finds none).

### R5 verdict

APPROVE for the source of tests tree `8283d90dc669feb72eeb7ec43f5dbf80a156f0d4` (`27e1f61`), with no runtime acceptance credit. No BLOCKER or MAJOR is open. `g-tamper` now changes `.previous-<opId>/lti.db` of its own drill, taken only from its own stop output, and it proves that only this file changed before `--recover`. Every earlier assertion stays. The fake keeps the previous generation of the last commit and rolls back only its own folders, so the `C3` order fault is reproduced: when the kept generation sorts first, the old row fails with the round 1 cause (and the full run has the same 17 blocked rows); when it sorts last, the old row passes. The new row passes in both orders, and all 70 rows run. Two bound mutants are detected by assertion. The complete 022 suite (154/154) and the affected 077 file (52/52) pass on the held bytes, with inventories before and after and private offline npm settings. I have no new finding and three observations. A change to either file cancels this verdict. Still required: a new frozen candidate, the diagnostic (migration 12 rows, then storage 70 rows), two complete 488-row rounds, the 12 legacy groups, and fresh M2 and T7. All 32 live LMS rows stay `UNVERIFIED`; local Canvas stays `DEFERRED`.
