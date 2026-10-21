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
