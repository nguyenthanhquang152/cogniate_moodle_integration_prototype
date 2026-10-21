Verdict: CHANGES_REQUESTED
Round: 1

# Storage harness repair — source review, Reviewer-A

Reviewer-A (lens A: "Is it right and is it safe?"). Claude Code Opus 5.5, xhigh. Task `task_900f34785612`, dispatch `ctx_02b5d009ee21`. Date: 2026-10-21.

This review is bounded. It covers the QA harness repair of the frozen triage. It gives no runtime acceptance and no row credit. A passing self-test count is not runtime evidence. The product helper repair (`9f8ac62`) is outside this review.

## 1. Target, criteria and method

| Item | Value |
| --- | --- |
| Primary target | WIP commit `5f184771d835fcf03701053c6b11a00ec7f0ccf3` (parent `54600e86c01b7e2e2065b1b3d42fbcc8f5f7fd72`), tests tree `b7aa39ae22acd33671e09857dd66412dcc77b8fd` |
| Baseline | tests tree `4c7e067feedc644f955afee37806f06e7273dd04` (at `54600e8`) |
| Final source target | `71a5bf92608f8ee20e81363a0be987474fc59859` (parent `e2d91c4`, Lead docs only), tests tree `d574737219dffadb4447968bb0cc06393e61e5b9`. It changes three self-test lines only (§7). Every runtime module is byte-identical to `5f18477`, so each runtime line reference below is valid at both commits. |
| Diff scope | `54600e8..5f18477` changes exactly the 21 named `tests/host/**` paths (3,852 insertions, 250 deletions). No other path. `e2d91c4..71a5bf9` changes three of these self-tests. No product, root, manifest or inventory path changes (`m1-storage-manifest.json`, `storage-inventory.mjs`, `core.mjs`, `storage-docker.mjs` are unchanged). `pnpm-workspace.yaml` stays untracked and untouched. |
| Criteria | Charter and phase plan at `54600e8`. Frozen triage `2d763fe`, `storage-full-round-triage.md` SHA-256 `ade4e8a0f9e54823040828758b7683d5c9b230587747f3ef3c89ef8e99f9a032` (verified; unchanged at both targets). M1 precision `a60ba4a`, `M1.md` SHA-256 `ac444799ae5e93706054a7e352e339bdea509a889328c15365a3535864fb37af` (verified; unchanged). The Lead decisions R2-01 to R2-05, IN-1 to IN-4, B-SR-04 to B-SR-07, INT-1 to INT-6, A-SRR-08, and the grants `msg_0f65fbcdf49c`, `msg_9b1720e2eeb9`, `msg_df38477e48e2`, as the plan records them. |
| QA control map | `/Users/quangnguyen/cogniate-qa-runs/storage-harness-repair-qa-20261021T1356Z/map/control-map.md`: SHA-256 `bf47ec74bc0e2ebadbc461407d10545342c10710ee0d00d2d0d1604d7bdaafda`, 35,836 bytes, file `0600`, folders `0700`. Birth 13:59:32Z, last change 14:00:03Z. The Lead grant commit `8b73023` is at 14:02:40Z, so the map is older than the grant and did not change after it. `clarifications.md` and `amendment-A1.md` (`e377fc260c1cd1924675ca22e5a0ce661123a1ee59d64b458cccd0b7928ad8a3`, the frozen A-1 amendment) are separate files. I read metadata only, not the map text. |
| Method | Source reading of every changed line of the 21 files at the committed target (exported with `git archive`, not the working tree). Independent recount of the V4-9 tokens and a search for alias, computed, stream, link and external-command copies. Narrow, contained host probes (§9). Review of the supplied mutation evidence (§6). No Docker, Compose, network, service, settings or dependency step. No full acceptance. I did not read the QA implementation report before my initial source findings were held and sent; I read it later (§10). I did not read any peer review report. |

## 2. Result

CHANGES_REQUESTED. Two BLOCKER findings, one MAJOR, one MINOR and two NIT.

- A-SH-01 and A-SH-02 are BLOCKER under charter §5, because a frozen criterion fails. In each case the probe makes a state that the frozen text itself names: V4-10 (e) makes `backups/` a link, and §7.5 step 4 names "a race" as a cause of a refused correction. No scope exclusion applies (§2.1). Impact, for the routing of the repair: in both states the step stays FAIL, so no row gets a false PASS. The failed rules are the side rules "a link is never followed" with the bounded correction (A-SH-01), and "a refused correction stops the phase" (A-SH-02).
- A-SH-05 is MAJOR. V4-1 must detect "copy, then chmod" at each copy site. At sites #7, #12 and #13 it checks only the helper or the final mode. My probes put a site-local "copy, then chmod" (no V4-9 token) at #7, #12 and #13. Every control passes under child umask `022` (and `000` for #7). The code at these sites is correct today (§4.2); the control does not prove it.
- Everything else conforms to the accepted criteria (§4, §5). The mutation dispositions are in §6. The fixed commit `71a5bf9` is correct (§7).

### 2.1 Severity reconciliation (Lead `msg_f73eae3e7219`)

I first rated A-SH-01 and A-SH-02 MINOR because no supported actor makes these states. That reason is a likelihood, not a scope exclusion. I checked each possible exclusion in the frozen text:

| Possible exclusion | Applies? | Why |
| --- | --- | --- |
| Triage §13 Limits | No | It lists the V4-9 static-text limit, the birth-time dependency, unmeasured rename cases and runtime unknowns. It names no link or race exclusion for the scans or the corrections. |
| V4-10 (e) | No, the opposite | It makes `backups/` a link on purpose and expects FAIL. So this state is inside the criteria, and §7.4 ("A symbolic link is never followed") applies to it. |
| §7.5 step 4 | No, the opposite | It names "a link, another owner, another inode, a race" as refusal causes, and it says that the phase stops. §4.3 repeats: "or when a private-file correction is refused". |
| §4.0 step 9 (the first cause is kept) | No | It keeps the first cause of a row. It does not cancel the abort; §4.3 sets the abort and keeps the first cause together. |
| A-SRR-08 (Lead, 13:55 UTC) | Not for A-SH-01/02. Not for A-SH-05 | It accepts only that the text scan cannot see an aliased or computed token call, and it gives that scope to the source reviewers. A-SH-05 is not a token call; it is a site control (V4-1) that does not detect its named mutation. |
| P-1a condition 4 (services stopped; QA alone in its lane clone and private folder) | Only for A-SH-06 | It is the stated operating envelope of the `d-content-folder` deletions (§6.2). It says nothing about the private-root scans. |

So A-SH-01 and A-SH-02 fail the literal frozen requirements. I do not narrow the criteria. A repair needs re-review and fresh affected validation.

## 3. Findings

| Id | Severity | File:line (runtime lines valid at `5f18477` and `71a5bf9`) | Problem | Evidence | Suggested fix |
| --- | --- | --- | --- | --- | --- |
| A-SH-01 | BLOCKER | `tests/host/storage-private-scan.mjs:162–163`, `:44–48`, `:123–131` | `scanPoint` walks a private data area or an extra root through a symbolic link. The bounded correction then changes the mode of a host-user file outside the private root. Triage §7.4: "A symbolic link is never followed." §7.5 step 3 limits the correction to the recorded private file. | Probe 1 (§9): `backups` is a link to an outside folder with a `0644` file (the V4-10 (e) state). `rootClosure` reports "private root not closed: backups (symlink)", so the step FAILs. But `scanTree` calls `readdirSync` on the link, records the outside file as hit `backups/victim.txt`, and `correctHit` changes it from `0644` to `0600`. `O_NOFOLLOW` protects only the last path part. V4-10 (e) calls only `rootClosure`, so no control sees this. | In `scanPoint` and `scanTree`, `lstat` each area and each extra root first. Walk it only when it is a real directory of the host user; else record a problem and correct nothing. Also guard the same way where `removeScratch` scans its own folder. Optionally, `correctHit` checks that the real path of the parent folder is still inside the area. Add a scan-point variant of V4-10 (e): the step FAILs and the link target keeps its mode. |
| A-SH-02 | BLOCKER | `tests/host/storage-lane.mjs:272–278`; `tests/host/storage-rows.mjs:126–130`, `:139–147` | When the body of `withScratch` fails and the removal scan then refuses a correction, `withScratch` throws the body error, not `PhaseAbort`. `storagePhase` sets the abort only for a `PhaseAbort`, a failed restore or a refusal in its own step scan, so the phase does not stop. Triage §7.5 step 4 and §4.3: a refused correction stops the phase. | Probe 2 (§9): the body makes a `0644` `lti.db` in the scratch, and the path becomes a link at the correction (the §7.5 race). Body passes: `withScratch` throws `PhaseAbort` (correct). Body fails first: it throws the body `Error`; the scan record has one refusal; there is no `PhaseAbort`. The per-step scan does not find it again, because the kept entry is now a link, and a link is not a hit. Storage-phase callers: `backupLogical` (`@backup-B`, `@post-B`) and `e-old-schema` (`storage-paths`). | Keep the first cause and also set the abort. For example: after each step, `storagePhase` sets the cleanup cause when any scan record of that step has a refusal; or `withScratch` throws a `PhaseAbort` that carries the body error as the first cause. Add one V4-8 variant: a body failure plus a refused removal correction stops the phase with the body error as the first cause. |
| A-SH-05 | MAJOR | `tests/host/storage-private-copy.selftest.mjs:81–87` (#7) and `:92–112` (#12, #13 helper only); `tests/host/storage-rows.selftest.mjs:1204–1207` (#12 final modes); `tests/host/m1-migration.selftest.mjs:222–235` (#13 final modes) | V4-1 must show, "for each copy site #1–#13", that "the hook reports 0600 and size 0 on the same device and inode as the final file", and must detect "copy, then chmod". At #7 the copy runs in a child process with no creation report; at #12 and #13 the hook is tested only on the helper, and the call sites are checked by final mode. A site-local copy, then `chmod`, without a V4-9 token, passes every control. | Probes 4–6 (§9), each in a private copy of `71a5bf9`: #7 `oracle-B` with `writeFileSync` + `chmodSync 0600`: V4-1 passes under umask `022` and `000`. #13 migration damage copy as a hand-written tree copy + `chmod`: all three SD-1 tests pass under child umask `022`. #12 `g-damaged` the same: V7-1 passes under child umask `022`. The V4-9 token check passes each time (only the V4-9 mutation self-test fails, on its own anchor text, which is not a detection). The current code uses the helpers at all three sites (§4.2), so this is a control gap, not a code defect. | Observe the creation at each of these sites. #7: let the child report the `fstat` of its new descriptor (a behavior-neutral seam, as for R2-03), and assert `0600`, size `0` and the final inode. #12 and #13: pass a creation hook through the call (for example a lane-level hook option) and assert it in V7-1 and SD-1. Alternatively, the Lead records an explicit disposition for these three sites. |
| A-SH-04 | MINOR | `tests/host/storage-source-inventory.selftest.mjs:32` | The self-test import rule finds `from '…selftest.mjs'` and `import('…selftest.mjs')`, but not a bare side-effect import `import './x.selftest.mjs';`. V4-9 names "a runtime module that imports a self-test file" as a mutation. | Regex text. My search of the 12 runtime modules finds no self-test import of any form, so the tree itself conforms. The missed form is unusual in practice. | Also match `^\s*import\s*['"][^'"]*\.selftest\.mjs['"]` (multiline). Add one mutation. |
| A-SH-03 | NIT | `tests/host/storage-rows.mjs:926`, `:939` | `g-orphan-refusal` does not check that the lock record exists before the three commands. If `recordHash` gives `null` before and after, "the lock record is unchanged" passes. | `recordHash` returns `null` for a missing `owner.json` (`storage-oracle.mjs:278`). `orphanStart` waits for the record, and nothing removes it before line 926. The M1 negative control (a lock folder that is gone after a command) is detected. | `check(recordBefore !== null, 'The lock record of the killed command exists')`. |
| A-SH-06 | NIT | `tests/host/storage-rows.selftest.mjs:1387–1402` (V5-4); `tests/host/storage-rows.mjs:726–733`, `:736–742` | M5-4b (`rmSync(realpath(child))`) survives. It is masked, not equivalent (§6.2). | The V5-4 input is a link "before a deletion", so `safe()` blocks first by design. The current deletion removes a link as a link (QA probe M5-4b, original variant: the target is kept). The only path to the difference is a writer outside QA during a synchronous section, which P-1a condition 4 excludes. | Record M5-4b as "masked, not detected, not equivalent", with this limit. Optional control: a mock lane whose required pre-deletion listing (`saveText` of `…-before.json`, P-1a condition 2) puts a link at the child; assert that the link target is unchanged. |

## 4. Criteria trace (lens A)

### 4.1 Private creation modes (P-3, §7.2–§7.3)

- Helpers (`storage-fixture-script.mjs:54–140`): `createExclusive` opens with `O_CREAT|O_EXCL|O_NOFOLLOW|O_WRONLY` and mode `0600`, then checks `fstat` (regular, `0600`, size `0`) before the first byte. The hook sees this check. `privateWrite` writes, `fsync`s, then re-opens without a link follow and checks the same device and inode, mode `0600` and SHA-256. `privateCopy` returns the source mode as a record only. `privateReplace` writes an exclusive temporary in the target folder, then renames it and checks the same inode. `intoVolumeWrite` creates `0600`, writes, `fsync`s, `fchmod`s the descriptor to the recorded or planted mode, then checks `lstat` and the bytes. `privateEmptyFile` and `checkCapture` match §7.3 (before: regular, same inode, `0600`, size `0`, one link; after: regular, same inode, `0600`).
- Under a child umask `022` (and `077`), each private file is `0600` at creation, because the open mode is `0600` and the umask only removes bits. No site claims compliance from a later `chmod`. Folders: `privateScratch`, `privateCopyTree`, `ensureFolder` and the diagnostic `D` use `mkdir` with mode `0700`, which is `0700` at creation under `022` and `077`. The `chmod` that follows is a no-op there and never widens.
- Sites #1–#16 use the helpers: stash and copy-out (#1, #3), unstash (#2, recorded mode), `logicalRead` (#4; no default `scratchBase`, `:233`), plant `copy`, `write`, `editjson` (#5, #6), `oracle-B` (#7), `LegacyFixtures.place` (#8), `copyCredentials` (#9: exclusive temporary, rename, write ledger), `backupLogical` (#10, lane scratch), `storagePaths` (#11, caller scratch), `privateCopyTree` (#12, #13; a link FAILs), `configDiff` (#14), `writeMarker` with `wx` and `0600` (#15), `writeHandoff` through `privateWrite` (#16; an existing file fails and stays unchanged). The control coverage of #7, #12 and #13 is A-SH-05.
- Container scratch (IN-4, X6): `main()` sets `scratchBase: os.tmpdir()` after the spec spread (`:526`), so a spec value cannot choose the folder.
- R2-04: the helpers use no V4-9 token. They use `open`, `fstat`, `mkdir`, `readdir`, `lstat`, `rename`, `unlink` and `rm` where the operation needs them.

### 4.2 V4-9 source inventory

- The token pattern in the self-test is exactly the triage pattern. The scope is every non-self-test `storage-*.mjs`, plus `m1-migration.mjs` and `run-m1.mjs` (12 files now; the scope finds the three new modules).
- My recount gives exactly X1–X8: `storage-lane.mjs` `copyFileSync` 1; `storage-rows.mjs` `cpSync` 1; `storage-compat-route.mjs` `mkdtempSync` 1, `tmpdir` 1; `run-m1.mjs` `mkdtempSync` 1, `tmpdir` 1; `storage-fixture-script.mjs` `mkdtempSync` 1, `tmpdir` 1; `m1-migration.mjs` `mkdtempSync` 2; all other files 0.
- Alias and computed bypass (A-SRR-08 scope): no bare reference to any token name (so no `const c = fs.copyFileSync`), no `fs[…]`, no `fs.promises`, no stream or `pipeline` copy, no `link`/`linkSync`, and no external copy command (`cp`, `rsync`, `ditto`, `docker cp`). The one `tar` call (`run-m1.mjs:238`) installs the frozen public test tree, as before. I checked every `writeFileSync` and `appendFileSync` site of the runtime modules: none copies protected bytes outside the helpers. The writes in place keep the existing `0600` mode of a private copy (`g-damaged`, `h-old-manifest`, the migration damage copies).

### 4.3 Scans, hits, corrections and scratch removal (§7.4–§7.5)

- Hits stay in the record after a correction. `failed` is true for any hit or problem (`storage-private-scan.mjs:150–153`). `storagePhase` makes the step FAIL on `scan.failed`; a correction never changes FAIL to PASS (`storage-rows.mjs:139–145`). A refusal at a step scan sets the abort (`:144`).
- `correctHit` opens without a link follow, checks regular file, owner, device and inode, uses `fchmod` on that descriptor, then checks mode, device, inode, size and SHA-256 (`:123–138`). A `null` hit hash fails closed. Gaps: A-SH-01 (an area link) and A-SH-02 (an abort lost after a body failure).
- `removeScratch` deletes only when the scan has no hit and no problem; else it keeps the folder (`storage-lane.mjs:263–270`). Observation: `logicalRead` removes its own inner `qa-logical-*` folder without a scan (`storage-fixture-script.mjs:264`). Its files are helper copies, checked `0600` at creation, and SQLite gives a sidecar the mode of its database file. I accept this by construction.
- Root closure, the `bin/` rule and the outside classes match §7.4. Scan points: after every `SEQUENCE` step, also a not-run step, and on the abort path (storage); after the private backup, after each damage copy, at each `configDiff` removal and at the phase end (migration); after the snapshot backup, at each `configDiff` removal and at the phase end (snapshot-upgrade).

### 4.4 Restore sites, failure injections and the phase stop (§4.0, §4.3)

- `guarded` runs the restore after every body result, records each restore, sets `ctx.cleanup` on a failed restore, and never replaces the first cause (`storage-rows.mjs:207–215`). `storagePhase` applies §4.0 step 9: a body PASS with a failed restore is FAIL with the cleanup cause; else the restore note is added (`:131–136`).
- Abort (`:107–111`, `:147`, `:151–159`): every remaining step gets exactly one `BLOCKED` result with the exact note "phase stopped after `<step>`: `<cleanup cause>`; first cause: `<row cause>`". Fixtures get the same note. The abort-path scan and the phase-end log segment run. The phase returns normally, so the runner's owned teardown runs.
- The 21 sites and the seven site-14 calls are exactly the §4.3 table. `d-unknown` has three calls, so the uninjected dry run has 29 restore records. V2-8 asserts that each of the 27 injections reaches its site (a site whose row does not run in the uninjected dry run is BLOCKED, never PASS). It compares the rows before the stop with an uninjected run, and every row after it with the exact note. I did not run V2-8 myself.
- `d-mountpoint` (site 10): `started` is set before the plant call, so a failed or timed-out plant still gets the restore (QA-SRT-03, V2-10). The restore stops and confirms the services, finds the root-owned mountpoints with `meta`, changes only those under QA's lock, then needs a full `HOST_UID` listing. "Nothing else changed" compares with the listing before the plant and keeps only the database exclusion.
- Observation O-1 (no frozen criterion requires more; for the Lead's information): only site 10 has the "the plant started" trigger (§4.0 step 8, QA-SRT-03). At most other sites the plant call is before its guard, as §4.0 step 7 allows for sites 11 and 12 ("as today"). A plant that fails part-way or times out there runs no restore and does not set the abort. On a container timeout, the unchanged code also ignores the result of its `docker rm -f` (`storage-lane.mjs:105–108`).

### 4.5 `a-serialize` (§3.1)

- `serializeVerdict` (`storage-oracle.mjs:357–388`) follows steps 1 and 4–8 in order: truncation; exactly one acquire with the spawned `pgid` after the offset (no command fallback); the wait owner from the own `stack:up` lines (`runId` and `pgid`); exactly one release of run `X`; `R.command === C` with `C` a non-empty string; two good samples; `lo` and `hi` from the samples. A start at or after `R.ts + hi` passes; before `R.ts + lo` is "started before"; else "clock uncertainty". No tolerance and no floor; sub-millisecond engine fractions are kept.
- `waitForRun` ends only on an acquire event after the offset with the spawned `pgid`, or a lock record with it.
- The row (`storage-rows.mjs:513–544`) stops both services, takes the offset and the first sample before the spawn, and awaits `backup.done` in `finally`, also on an identity failure (V1-8). The backup output goes through `saveText`.

### 4.6 P-1a (`a-fresh`, `d-content-folder`)

- `a-fresh` is `BLOCKED` "lane not fresh: `<path>`" unless `lstat` gives `ENOENT` for `P` and both children before its start (`:403–407`).
- `d-content-folder` stops and confirms the services. `safe()` checks `P` and both children as real directories of the host user, and the empty legacy sets. It saves a listing before each deletion. It deletes the children, never `P`, and never renames. It checks `ENOENT`. After `stack:up`, both children are new `0700` directories and `P` keeps its device, inode, owner, group and mode. The unsafe-case cleanup removes the link as a link and makes a new empty `0700` `uploads`; a non-link refuses.

### 4.7 V7-1 mock dry run (R2-02, B-SR-07)

- The mock runs the real `storagePhase`, row procedures, helpers and scans on real temporary folders. Only Docker, npm and HTTPS are fakes. `EXPECTED` declares all 70 rows: 68 PASS, `c-host-negative` NOT_APPLICABLE with its exact cause, and `a-lock-scope` FAIL with its exact cause (no suite runs host-only). `compareMap` compares status and first cause in both directions, and finds a duplicate, an undeclared result and a declared row that is not observed.

### 4.8 Handoff, diagnostic and the full mode (§9, §9.1)

- `checkHandoff` (`storage-handoff.mjs`) checks every §9.1 item against caller facts: the window form and `w ≤ s`; `H` regular, host user, `0600`, one link; `D` a real host-user folder with no group or other bit; `w ≤ H.mtimeMs ≤ s`; resolved and real paths; the clone in the run root with the `RUN_ID` of `b` and the candidate SHA, and `w ≤ birthtime ≤ H.mtime`; the backup root next to it with the X7 name, mode `0700`, and `birthtime(Cm) ≤ birthtime(R) ≤ H.mtime`; the manifest `composeProject = b`. All comparisons use raw milliseconds; there is no tolerance, floor or `utimes`. A birth time of `0` fails closed.
- Controls V8-1 to V8-4 make entries in order, at least 2 ms apart, and assert each premise before the check (B-SR-04, IN-2). They use the real writer (`writeHandoff`) and the real check.
- `fullRounds` keeps the phases, order, arguments, result files and the checks of the old loop. It adds only `QA_M1_WINDOW_START`, taken before each round's migration child and given to its storage child (R2-03). V8-5 checks two rounds with a recorder.
- `diagnosticRun` makes `D` with `mkdir` and a random suffix, takes `w` after `D`, runs migration, applies all six run-or-stop conditions with `s` = the check time, then runs storage only when every condition holds. Teardown and W4 always run. It records results but gives no credit; its exit code is only a summary. `--window-end` is required and is not an authorization (INT-4).

### 4.9 LD-1, LD-2, LD-3 and the M1 precision (`a60ba4a`)

- LD-1 (`storage-lane.mjs:45–47`, `:110–124`): only the full 64-hex id of a detached `storage-decoy` and of a created (never started) `storage-volume-user` is kept, and only for the row that made it. Any other remaining id, a kept id in another row or outside a row, and the container that just ran fail the check. A failed listing throws `StorageBlocked`. An id retires only after a successful removal; a failed removal keeps it, so the next row fails.
- LD-2 (`storage-rows.mjs:923–941`, `:1578–1590`): the `stale-*` names and the hash of each `owner.json` are recorded before the first command and compared after each of the three refusals. The lock record and the file-set listing are compared after them. The helpers only read; they never remove earlier evidence. See A-SH-03.
- LD-3 (`:967–986`, `:1597–1622`): the tamper is one changed byte of the existing `ltidb` `.previous-<opId>/lti.db`; no `appdb` tamper is added. A root journal is only the exact path `.storage-journal.json` in each volume root; a nested one is never exempt. (1) The names, root journals included, and (2) the (name, SHA-256) pairs without the root journals are compared as multisets. The name keeps the volume, so a move inside a volume is allowed and a move across volumes is not (Lead `msg_df38477e48e2`). (3) Each root journal is checked on its own: a regular file before and after, one JSON object, the same keys, `state = rollback_failed`, and every other value except `updatedAt` equal.
- The dated M1 controls each discriminate their failure at the oracle level and, where M1 names a row result, at the row level. The original V7-1 FAIL evidence is not part of this diff; the new runs pass on their own.

## 5. Conformance of the other Lead decisions

R2-01 (keep the scratch and the file after a hit, also after a correction) holds and is tested. R2-05 (the self-releasing `a-lock-wait` holder) is outside the 21 sites. B-SR-05 (the into-volume final mode in V4-2) holds. B-SR-06 holds. INT-1 and INT-2: the three stricter oracles, exact P-1a and `@seed-resume` change no row id, manifest or count. INT-6: V1-12 resolves and records one `HEAD`.

## 6. Mutation evidence

Source: `/Users/quangnguyen/cogniate-qa-runs/storage-harness-repair-qa-20261021T1356Z/mutants/`. I verified the supplied hashes: `run-m1/results.json` `27b1afd6bc3ce884af2afb546622bea1de8506a60c7912f8e1e9099fb0063878`, `run-m1b/results.json` `c52923bd167c5cb32cab1e4adb28790f2c29bb09ac06ae815dbeca5c2853198f`, `run-fixcheck/results.json` `47767b031501c2abd051e53243cdac24b5d6b427b193f4a579046c4f8195b8c6`, `probe-m48f/result.json` `27adc8fc4e0474c6c1bc7c47da819fe11fdb1d551c863a51d05ad579bb6bfbd3`, `probe-m54b/result.json` `2720df0555452fb8fdca752a51d9784aaebe87bcbb9989bb0cf91c12adc867e9`.

Counts: `run-m1` has 133 entries (128 detected, 4 not detected, 1 baseline failure: V1-12 needs a git checkout). `run-m1-v112` runs M1-12a in a repository copy (detected: the acquire `pgid` is not the spawned `pgid`). `run-m1b` has 2 entries (1 detected, 1 not). Total 135: 130 detected, 5 not detected. The campaign has no site-local mutant at #7, #12 or #13 (A-SH-05), and none for A-SH-01 or A-SH-02.

### 6.1 M4-8f (`privateEmptyFile` without `O_NOFOLLOW`): equivalent

POSIX requires `open` with `O_CREAT|O_EXCL` to fail with `EEXIST` when the last path part is a symbolic link, whatever the link points to. `O_NOFOLLOW` affects only the last part. So the two flag sets give the same result for every last-part form. The QA probe measures a dangling link, a link to a file and a link to a folder, with and without the flag: `EEXIST` each time, and the link stays. I accept M4-8f as equivalent. `O_NOFOLLOW` stays necessary in the read paths (`readRegular`, `hashNoFollow`, `correctHit`), which the campaign did not mutate this way.

### 6.2 M5-4b (`rmSync(realpath(child))`): masked, not equivalent

- The QA argument is correct for the supported path. In both cases of `d-content-folder`, `safe()` and the deletion run in one synchronous JavaScript run: the unsafe case calls `deleteChild` inside the body of `guarded`, before any `await`; the absent case has no `await` between `safe()` and both deletions. `saveText` is synchronous (`core.mjs:109–114`). The services are positively stopped, and QA uses no container. So no QA step can put a link at the child between the check and the deletion.
- A difference remains: another writer of the same user could make that change between the `lstat` of `safe()` and the deletion. Then M5-4b deletes the link target, and the real code removes only the link. P-1a condition 4 sets the envelope of these deletions (services stopped, QA alone in its own lane clone and private folder), so this case is outside the criteria. But it shows that M5-4b is not equivalent.
- Disposition: not a runtime defect, not a detected fault, and not an equivalent mutant. Record it as "masked by the synchronous precondition", with the limit above (A-SH-06).

### 6.3 M8-4d, M8-6d, M-LD3c: self-test gaps, closed in `71a5bf9`

M8-4d and M8-6d remove the exact window form; an extended ISO year (for example `-000001-…` or `+010000-…`) still round-trips through `toISOString()`. M-LD3c removes the volume from the LD-3 name; the old cross-volume fixture also deleted a file, so the name check still failed. See §7 for my own check of the fix.

### 6.4 Detections by an error, and M2-7a

- Each of the eight error detections comes directly from the mutated behavior, not from an unrelated break: M2-2 (a hidden `readdir` throws `EACCES`, the V2-2 premise); M2-4b and M2-9a (a missing row or a missing `@seed-resume` record makes a helper read `undefined`); M4-7c (the deleted file gives `ENOENT`); M6-1a (the pre-reset segment has no lock log); M8-5b (a shared handoff path fails its exclusive create, as it would at runtime); M-IN4 (the spec folder, mode `0500`, refuses the scratch); M8-6c (an invalid window end throws instead of giving a cause). I accept them as honest. Limit: the failure text is an error, not a named assertion. For M2-9a, a later implementation-neutral assertion (one seed call) would also fail.
- M2-7a removes the explicit stop and confirm before the root restore. The write-mode gate of `StorageLane.container` also refuses while a service runs, so the safety property holds twice, and only the cause text tells the two apart. The triage lists a cause text as an allowed observable. Limit: no control covers the case "a service runs, but `stopped()` can stop it", where the explicit stop decides whether the restore succeeds.

## 7. Final source target `71a5bf9`

- Only the three granted self-test lines change: `storage-handoff.selftest.mjs:120` (`-000001-01-01T00:00:00.000Z` is BLOCKED), `storage-diagnostic.selftest.mjs:131` (`+010000-01-01T00:00:00.000Z` starts no child), `storage-rows.selftest.mjs:1520` (`slice(1, 4)`: only the moved file leaves `lti`). No runtime module changes.
- My check (probe 3, §9), in private copies of `71a5bf9`: each targeted test passes on the real code. With M8-4d, M8-6d and M-LD3c applied, each test fails at exactly the new line (`:120`, `:133`, `:1520`). This agrees with QA `run-fixcheck` (3 baselines pass, 8 targeted mutants detected).

## 8. Limitations

- Host source review only. No runtime window, no candidate C, no Docker. The rows of triage §N-4 stay unknown until a storage run.
- I did not run the complete host suite or the full mutation campaign. I rely on the supplied QA results for counts (§6, §10).
- macOS APFS and Node 24.21.0 only. The handoff check depends on birth times.
- I did not read the QA control-map text or any Reviewer-B file. I read the final QA report (§10) only after all findings of this review were fixed and sent to the Lead (`msg_e5dc8211bccb`, and the severity reconciliation of §2.1).
- Evidence-mode deviations in my own private root, disclosed: (a) the probe fixtures widened two synthetic one-byte files to `0644` (probe 2 `outside.db`) and `0555` (probe 1 script) as test conditions; both were created `0600` and set back to `0600` after their results were recorded. (b) Two test-output files, `a05-m13-sd1-u022.tap` and `a05-m12-v71-u022.tap`, were created by a shell redirect inside the child umask `022`, so they were `0644` at creation for the length of the test run (under 15 s); then I set them to `0600`. They hold `node --test` output with no secret. All entries are now `0600` files in `0700` folders.

## 9. Probe manifest

Private root `/Users/quangnguyen/cogniate-review-runs/harness-repair-reviewer-a-task_900f34785612-20261021T1605Z` (`0700`). Parent umask `077`. `TMPDIR` and `HOME` were inside the root for every node run. No real HOME configuration was read or written. Every temporary test folder was removed (`fix/tmp` and `fix/home` are empty). `src/` and `base/` hold `git archive` exports of `5f18477` and `54600e8`; `fix/base/` holds the export of `71a5bf9`.

Full manifest: `MANIFEST-2.sha256` in the root, SHA-256 `c22a6bb6a17c1d0d6b8a4f3ccbdf797f864e8b4f2ae908c90fdf6545d81322a4`, 763 regular-file entries: the 762 evidence files and the preserved first manifest. It excludes only itself, and every entry verifies. The first manifest, `MANIFEST.sha256` (SHA-256 `f57811eb0b13111df881f125264be3bf6a920a7c6a7ead35bfaf84a709a4eca7`), stays unchanged as a record. It has one mechanical defect: it lists its own temporary output `./MANIFEST.sha256.tmp` with the empty-file hash, and that path no longer exists; its other 762 entries match. Three symbolic links are probe fixtures: `probe1/clone-storage-private/backups` and two `probe2/…/scratch/probe-*/lti.db`. No entry has a group or other bit.

| Probe | Purpose and result | Files (SHA-256) |
| --- | --- | --- |
| 1 | A-SH-01. A private root whose `backups` is a link to an outside folder with a `0644` file. `scanPoint` FAILs the closure, records the outside file as a hit and corrects it to `0600`. | `notes/probe1.mjs` `d14a01e786b8a5779790e1b0608d3998bc4a4e89f47c50c86e04b82a951ed9db`; `notes/probe1.out` `b6956e3817f3360e8c8fb05522a219c576ef6573a27afb174bf765a408f91a9d` |
| 2 | A-SH-02. `withScratch` with a `0644` file whose path becomes a link at the correction. Body passes: `PhaseAbort`. Body fails: the body `Error`, with one refusal in the scan record. The link target stays `0644` in both. | `notes/probe2.mjs` `cbf6bd1579f3a94924933b2570de5296358a2f0a49481535ee6b8b9a3de31a00`; `notes/probe2.out` `6982b25d00f86ccc22aff013bbe0bd79b4fb3c9bf939c86f8bdd7b7a824c815f` |
| 3 | §7. The three fixed controls at `71a5bf9`: baselines pass; M8-4d, M8-6d and M-LD3c fail at the new lines. | `notes/fix-base-v84.tap` `33e774eb0bc254b0555e4cee373e6f9521388bed2f4893f6344da1ee9405cced`; `notes/fix-base-v86.tap` `4a0551f0f8546fa2d0403e6603b957a51991e245c30d849e5e32a203b36f6a84`; `notes/fix-base-ld3.tap` `867844215dd0a35e6019b526f937fb21d3e7cd081311c0580c544a9241b90b79`; `notes/fix-m84.tap` `de8d41b7151a56e873de619044635dd90d78c41309cadc1dbc242dd50aa1f97c`; `notes/fix-m86.tap` `da54cc6e67644b6b520322c61e336fa59f11c77b1262d8d25debd1ec8d55cb83`; `notes/fix-ld3c.tap` `ecce16d1c44c5be1d9e06288e6c97fa037e7da53ea63b4caa42a3f956133ae6e` |
| 4 | A-SH-05, site #7. `oracle-B` copy as `writeFileSync` + `chmodSync 0600`. V4-1 passes (umask `022` and `000`). V4-9: the token check passes; only its mutation self-test fails, on its anchor text. | `notes/a05-m7-v41.tap` `0292022e91b4b65e66e04c9b4c19f7a8c48837faffadb22a093a662e9ef951fa`; `notes/a05-m7-v49.tap` `7b64d197c64ec1dd629b05323471f63cb5905c80b8c85ab9b1ff39791adb1a31` |
| 5 | A-SH-05, site #13. The migration damage copy as a hand-written tree copy + `chmod`. SD-1 passes under child umask `022`; the V4-9 token check passes. (`a05-m13-sd1.tap` is a first run under umask `077`; it does not show the creation mode and is not used as evidence.) | `notes/a05-m13-sd1-u022.tap` `1cc7d9ea4070d7570ec445b69978c12ee962a070149ae0727e6b05db136c65ae`; `notes/a05-m13-v49.tap` `e7bd025039c12bec63f2b4f3b504d94467b5376834e650309563fedcd6eee16e`; `notes/a05-m13-sd1.tap` `37aad09a98b61cdf0f3035f17f56c4c664ebf8822fcca426b0da83b171c3e5d6` |
| 6 | A-SH-05, site #12. The `g-damaged` copy the same way. V7-1 passes under child umask `022`. | `notes/a05-m12-v71-u022.tap` `14884bb9fb297db219a2ad3df60264896f84656ce99f5025b9bf00987952f16f` |
| Tools | The mutation helper (one exact anchor, replaced once) and my table of the supplied QA results. | `notes/mutate.py` `b0e93466983d8bc0d0c0ffaf009e2b4d31becdda5933ec4ce443ea0163922e6f`; `notes/mutants-table.txt` `fa44ec1a23a446e06bfe36a59111048ba0f1fe2aa57081cf6f9190960dd77cf9` |

## 10. Final evidence

Supplied by the Lead (`msg_d462340e7901`, `msg_20e1438fc15c`) and checked by me:

- Complete host self-checks at `71a5bf9`: `logs/final-u077.meta` SHA-256 `6db23dad5b3e99782d777dcd9c1f1fbc6d6ca550dcfcc70316a3bb094f53f659` (child umask `077`, end 16:26:01Z) and `logs/final-u022.meta` SHA-256 `c1a51bfcae83cc2d619a6643d1a2711464846fabce1fb17602296e3376dacd7c` (child umask `022`, end 16:32:31Z), in the QA root. Each: exit 0, 105 tests, 105 PASS, 0 fail, 0 skipped, 0 cancelled, `docker_stub_calls=0`, `tmp_left=0`; the adjacent TAP files agree. Each of the 11 changed self-test files listed in the meta has the SHA-256 of its `71a5bf9` blob.
- Focused mutants at `71a5bf9`: `mutants/run-m2-focused/results.json` SHA-256 `39c09b20e1ecb6025fc084260e91d1f578f1050c35629c57c07694c46a71da09`: 22 entries (the M8 group and M-LD3a to M-LD3e), 22 detected, no baseline failure. Combined campaign: 133 of 135 detected; M4-8f and M5-4b stay not detected (§6.1, §6.2).
- Final QA report `docs/reviews/M1/storage-harness-repair-qa.md` at `1759ede8658476f01246f61b674d504c30f4d18c` (a docs-only commit), SHA-256 `009c2ee2cba0510c474772016b5eff7340039023ded9c6b3705ccfecfb0ddb7b`, verdict PASS for host self-checks only. It says that the site #7 creation hook "is not observable (child process); final mode and the V4-9 inventory cover it". Probe 4 shows that V4-9 does not cover a copy without a token, so A-SH-05 stands. The report also states that "a refused correction aborts the phase"; probe 2 shows the exception of A-SH-02. I did not verify the 11,985-entry QA manifest; the Lead reports that it verified it.

This evidence does not change the verdict. A-SH-01, A-SH-02 and A-SH-05 are source and control findings; a passing self-test run cannot close them. After a repair, the affected checks need re-review and fresh validation.

## Round 2

Verdict: APPROVE
Round: 2

Reviewer-A (lens A). Claude Code Opus 5.5, xhigh. Task `task_67e836c13f1b`, dispatch `ctx_426e6f466ac4`, run `run_ebe671ad72a9`. Date: 2026-10-21 (UTC). This round is independent of QA and of Reviewer-B. It gives no runtime acceptance and no row credit. A passing self-test count is not runtime evidence. The product release-status repair `9f8ac62` is out of scope (Lead: independently verified).

### R2.1 Target, criteria and method

| Item | Value |
| --- | --- |
| Source target | WIP commit `c71912ff76965f60d92d964ac0bccf5337f59771` (parent `90a5639`), tests tree `183a72b2fea5ff065fc57c96649199bc720fb6e0` |
| Base | `71a5bf92608f8ee20e81363a0be987474fc59859`, tests tree `d574737219dffadb4447968bb0cc06393e61e5b9` (my Round 1 final target) |
| Diff scope | `71a5bf9..c71912f -- tests` changes exactly the 11 granted paths (919 insertions, 49 deletions): `storage-private-scan.mjs`, `storage-lane.mjs`, `storage-rows.mjs`, `storage-fixture-script.mjs`, `m1-migration.mjs` (runtime) and `storage-private-scan`, `storage-rows`, `storage-private-copy`, `m1-migration`, `storage-source-inventory`, `storage-diagnostic` self-tests. Every other runtime module is unchanged. The other paths of the range are Lead and review documents; I did not read the Reviewer-B file or the plan entries of this round. `pnpm-workspace.yaml` stays untracked and untouched. |
| Criteria | Charter. Frozen triage `2d763fe` (`ade4e8a0f9e54823040828758b7683d5c9b230587747f3ef3c89ef8e99f9a032`). M1 precision `a60ba4a` (`ac444799ae5e93706054a7e352e339bdea509a889328c15365a3535864fb37af`). ADR-012 §11 and §15. The Lead's Round 2 closure text, decision D-A1 (literal triage §4.3) and the bounded race grant, as the dispatch states them. My Round 1 section above (prefix `8f5491d9e9dbf422486cf20ae826c3011dc3849e2153468a57ced63f83603d24`, 37,632 bytes; unchanged). |
| QA maps (read only) | `CONTROL-MAP.md` `6e28a020c3c702f09894b82d335486bc3620bff74164263801d664152cd68f8a`; `A-01.md` `34864741797fb9e9bc6a1e5abf2d5dfe395e839e5701cebed63828db887bdc58`; `A-01b.md` `39ad4463c48f1baed617caac9aa4e0d29dd9e13b6769cd9cc50d4b2697b45c0b`; `A-02.md` `d28455496254693386a52263e2371081a153a67039a56e5a35f7709e2ed958ab`; `A-03.md` `fe69065ec37aca14a00e0a5cc1fb3d996a991d811aa09c0f98b2f076d83e2599`; `A-04.md` `e3d4a464c8a8623643393405e5736bebba67f6a18d2b159500e9df354b7712c3`; S3 report `579238fba1c813d39e49d8b633d42452b56b3c508686a10fa2986d008fa4c34f`. All in `/Users/quangnguyen/cogniate-qa-runs/storage-harness-repair-qa-r2-20261021T1646Z/map` and `evidence/`, files `0600`. The map's `0644` creation (E-1, E-3) and the future-time header errors (E-1, E-4) stay disclosed. `CONTROL-MAP.md` has birth 16:51:32Z and ctime 16:51:50Z (inode 10166791); I infer no correct creation from its present mode. |
| Method | Staged. (1) Criteria and control map only, before any source: checkpoints `msg_31702b04ef24`, `msg_426df497c5a2`, `msg_36d7f08ce9a8`, `msg_0adadbdf5721` (R2.3). (2) Source from git objects only (`git archive` of both commits into my private root), never the working tree: every changed runtime line, the Round 2 controls, and a static V4-9 recount. (3) The final evidence when the Lead supplied it (R2.6). No host probe ran in this round. No Docker, Compose, network, service, settings or dependency step. |

### R2.2 Result

APPROVE for this bounded host source round. No BLOCKER, MAJOR or MINOR finding remains.

- The Round 1 findings A-SH-01 (BLOCKER), A-SH-02 (BLOCKER), A-SH-05 (MAJOR), A-SH-04 (MINOR) and A-SH-03 (NIT) are closed in source, in their controls and by their mutants (R2.4, R2.6). A-SH-06 keeps its Round 1 disposition: M5-4b is masked, not detected and not equivalent; M4-8f is equivalent through `O_EXCL`, and `O_NOFOLLOW` stays.
- Three new NIT findings (A-SH-07 to A-SH-09, R2.5). The Lead keeps them for M4. No source change is requested in this round.
- The approval covers the harness source at `c71912f` and its host self-checks only. It gives no runtime acceptance, no row credit and no candidate C. The rows of triage §N-4 stay unknown until a storage run.

### R2.3 Criteria and control checkpoints (before source)

| Item | Gap I named | Binding (QA A-02 to A-04, Lead disposition) | Source check at `c71912f` |
| --- | --- | --- | --- |
| G-1 | A BLOCKED body plus a scratch-removal hit or refusal had no status rule and no control; a corrected hit after a body error was dropped (`first ??= e`). | `scratchCleanup` keeps any removal error; FAIL also from BLOCKED; body cause first; abort only for a `PhaseAbort`. R2-02-07a/b on the real caller `e-old-schema`; MU-02-10, MU-02-11. | Holds (R2.4 A-SH-02). |
| G-2 | `removeScratch` guarded only before the walk; a parent swap before `rmSync` could delete outside. | Chain recheck immediately before `rmSync`; R2-01-06b (swap of `scratch/` and of the private root); MU-01-11; residual window disclosed. | Holds: `storage-lane.mjs:277–279`, no statement between the recheck and `rmSync`. |
| G-3 | No case with the lane private root itself as a link. | R2-01-02b; MU-01-12. | Holds. |
| G-4 | No race for an outside (legacy or ledger) hit. | R2-01-07o; MU-01-13. | Holds. |
| G-5 | Exact O position; "no additional outside write" in L. | O after stage 1 and before `open`; `fchmodSync`/`chmodSync` counted (0 in P, O, R, D; 1 in L); a second T entry stays unchanged; D-area and D-base. | Holds. The count is not vacuous: L must count exactly 1 through the same spy, and the scanner calls `fs.fchmodSync` on the default export that the spy replaces. |
| G-6 | Mutants at every #12 call and site-local copies at #12 and #13. | MU-05-12c-g, -n1, -n2, -o; MU-05-12a and MU-05-13a hand-written token-free copy-then-`chmod` at the call site; 12b, 13b, 7a, 7b late or plain. | Catalog verified (R2.6). |
| G-7 | Comparator key collision; damaged #13 manifest; undeclared JS normalization. | A-03: replayed fixed inputs (fixed B/X2 bytes, counter names, fixed `backupId`); whole-record equality; only the #7 pid name is substituted. | Holds in source (R2.4 A-SH-05). |
| G-8 | Unlisted map changes; A-SH-01 id renumbering. | Table map → A-01 → catalog; distinct D-base, D-area and D controls; in-process mask pin with the mask in each observation. | Holds. |
| NB-1 to NB-4 | v3 records not bound to runtime-module hashes; stale after A-04; #12 record without row results; hook absence. | Fresh bound records requested by the Lead. | NB-3 and NB-4 hold in source; NB-1 and NB-2: R2.6. |
| A-04 | — | LD-2 lock check after each command; V8-6 (d) cleanup variants (self-test only). | Holds. |

### R2.4 Closure of the Round 1 findings

| Id (Round 1 severity) | Required closure | Code at `c71912f` | Controls and mutants | Status |
| --- | --- | --- | --- | --- |
| A-SH-01 (BLOCKER) | The scanner never follows a linked area or extra root and never changes an outside target; real host-owned roots and parents; scratch removal guarded; full entry points; bounded races. | `storage-private-scan.mjs:47–58` `realChain` (lstat from the base down: a directory, not a link, of the host user); `:60–69` `folderChange` compares type, owner, device and inode of every recorded level, the base and the area root included; `:85–102` `scanTree` walks nothing when the chain fails; `:224–231` `scanPoint` uses `lexists` and `base = privateRoot` for areas, `base = root` for extra roots; `:139–176` `scanOutside` checks the clone, `infra`, `infra/.data` and every ledger parent, and refuses a ledger path outside the clone; `:183–204` `correctHit` stages (1) before `open`, (2) the unchanged `O_RDONLY\|O_NOFOLLOW` open and `fstat` identity, (3) the chain again with no statement before `fchmodSync` (`:193–195`), (4) the unchanged checks, (5) a late refusal with the observed mode. `storage-lane.mjs:269–279` `removeScratch`: guarded scan, `PhaseAbort` when not scanned, chain recheck, then `rmSync`. | R2-01-01 to -07, -02b, -06b, -07o (`storage-private-scan.selftest.mjs:171–404`); R2-01-03 migration entry (`m1-migration.selftest.mjs:344`); MU-01-1a to MU-01-13. | Closed in source; evidence R2.6. |
| A-SH-02 (BLOCKER) | A cleanup refusal keeps the first body cause and stops the phase, also after a body FAIL or BLOCKED, at a fixture, and when the per-step scan cannot find the raced file; every later row and fixture BLOCKED with the exact note; 70 ids once; archive and teardown. | `storage-lane.mjs:285–292` `withScratch` keeps the body error and puts any removal error on it as `scratchCleanup`; `storage-rows.mjs:126–137` FAIL from BLOCKED, `cleanup note`, abort only for a `PhaseAbort`; `:146–153` per-step scan: a failed or blocked step keeps its first cause, status FAIL. The abort note template and the abort path are unchanged. | R2-02-01, -02, -02b, -04/05 (a, b), -05 (b, row), -07a, -07b (`storage-rows.selftest.mjs:1607–1708`, with `stopProblems`: 70 ids, exact later notes, no product command after the stop, abort-path scan, phase-end segment); R2-02-05u; R2-02-06 (migration and snapshot-upgrade); MU-02-1 to MU-02-11. | Closed in source; evidence R2.6. |
| A-SH-05 (MAJOR) | Actual sites #7 (child), #12 (all four calls), #13 report an empty regular `0600` creation on the final inode before bytes, at explicit `022` and `000`; token-free site mutants fail the site controls; hook absence neutral against unhooked `71a5bf9`. | `storage-fixture-script.mjs:429–433` (#7: hook only when `QA_ORACLE_CREATE_OBSERVE` names an existing file; append with `O_WRONLY\|O_APPEND\|O_NOFOLLOW`, never create); `storage-rows.mjs:894`, `:914`, `:916`, `:1213` (#12, `lane.copyHook`, default `null`); `m1-migration.mjs:187`, `:235` (#13, `copyHook`, default `null`). `run-m1.mjs` and the lane constructor callers are unchanged, so no runtime path sets a hook. The helpers are unchanged (I-7). | R2-05-07 (child through `/bin/sh` with its own umask, `022` and `000`), R2-05-12 and R2-05-13 (both masks; one observation per source file; O-1 to O-4; the mask in each observation), R2-05-D, R2-05-N (#7 deletes `QA_ORACLE_CREATE_OBSERVE`; #12 and #13 pass no hook; fixed inputs); MU-05-7a to MU-05-13b. | Closed in source; evidence R2.6. |
| A-SH-04 (MINOR) | Bare side-effect imports found, existing forms kept. | `storage-source-inventory.selftest.mjs:32`: `/\b(?:from\|import)\s*(?:\(\s*)?['"][^'"]*\.selftest\.mjs['"]/`. | Eight forms (bare in both quotes, no space, namespace, default, `export {}`/`export *` from, dynamic) FAIL; a bare runtime import passes; MU-04-1. My static recount: X1–X8 exact; no runtime module imports a self-test. | Closed in source; evidence R2.6. |
| A-SH-03 (NIT) | Non-null original lock record. | `storage-rows.mjs:936`; A-04 adds the check after each command (`:948`); the final check stays. | R2-03-01, R2-03-02 (gone after each command, transient); MU-03-1 to MU-03-3. | Closed in source; evidence R2.6. |
| A-SH-06 (NIT) | M5-4b stays masked, not equivalent; M4-8f equivalent through `O_EXCL`, and `O_NOFOLLOW` stays. | No change to the `d-content-folder` deletion or the helpers. | QA map I-7, I-8. | Unchanged disposition. |

D-A1 and C-2 hold in source: an invalid area or extra root gives a scan problem (step FAIL) and is not walked; only a refused correction, an unsafe scratch removal or a failed restore sets the abort; a real `0755` area of the host user FAILs the closure and is still scanned and corrected.

### R2.5 Findings

No BLOCKER, no MAJOR, no MINOR. Three NIT. The Lead keeps them for M4; this round requests no source change.

| Id | Severity | File:line (`c71912f`) | Problem | Evidence | Suggested fix |
| --- | --- | --- | --- | --- | --- |
| A-SH-07 | NIT | `tests/host/storage-rows.selftest.mjs:1739–1761` (R2-05-12) | The pinned process umask is restored only by the dry-run hooks at `h-nomanifest` and `h-old-manifest`. There is no `finally` or `t.after`. A failure between `pin` and `unpin` leaves `022` or `000` for the later tests of the same file. | Source. R2-05-13 (`m1-migration.selftest.mjs:313`) restores in `finally`. Effect: only the self-test temporary files in QA's `0700` TMPDIR; no evidence and no runtime path. | Register `t.after(() => process.umask(old))` when `pin` runs. |
| A-SH-08 | NIT | `tests/host/storage-private-scan.mjs:115` (`rootClosure`), `:124` (`binRule`) | Both read a folder with `readdirSync` before or without an `lstat` guard. For a linked private root or a linked `bin/`, they list the link target, and `binRule` hashes one file in it. The problem text can then carry the target's entry names. | Classification: the frozen rule "a symbolic link is never followed" (triage §7.4) and the closure "never walk a linked area or extra root, never change an outside target" apply to the private data areas, the extra roots and the corrections. `rootClosure` and `binRule` are not walks of a data area: they only read, they never correct, and the closure FAILs with `(symlink)` in the same record (R2-01-02 `bin`, R2-01-02b). The tests show the targets unchanged (type, mode, size, SHA-256, device, inode, ctime). So no frozen criterion fails; this is information exposure of entry names in QA's own evidence. Unchanged since Round 1. | `lstat` the root and `bin/` first, and skip the listing when either is not a real directory. |
| A-SH-09 | NIT | `tests/host/storage-lane.mjs:273` | An absent scratch folder at removal gives `PhaseAbort` with "…not scanned: … (missing); the folder is not a real folder of the host user and is kept". Nothing is kept, because nothing exists. | Source. The phase stop is fail-closed and is within "the cleanup cannot run safely" (triage §4.3, D-A1). Only the text is wrong. | Name the absent case in the text. |

Observations (no finding, no request): (a) residual windows, all disclosed: a swap between the walk's `lstat` and its `readdirSync` can make the walk read through a link, but the stage (1) and (3) checks refuse any correction there; the window between stage (3) and the `fchmodSync` call; the window between the removal recheck and `rmSync`, and inside `rmSync`. The repair claims no atomic protection. (b) When a body error is itself a `PhaseAbort` and the scratch removal also fails, the removal error is not added as a note; the abort is set by the body error. (c) Lead-recorded observations stay as they are: a hard-linked hit (`nlink > 1`), a copy site that writes 0600 copies through a linked area after a closure FAIL (D-A1), and a create-then-`chmod`-then-observe mutant.

### R2.6 Evidence

All files are in `/Users/quangnguyen/cogniate-qa-runs/storage-harness-repair-qa-r2-20261021T1646Z` (files `0600`). I verified each hash and checked the content below myself. I did not read the QA report of this round.

| Evidence | SHA-256 | What I checked |
| --- | --- | --- |
| `logs/final-u077.meta` (child umask `077`, 18:15:04–18:24:09Z) | `d1f927ec5ec01697c2885139a8b29c735a061377dc4a25b0115cc6d8823d3adf` | exit 0; 142 tests, 142 pass, 0 fail, 0 skipped, 0 cancelled; `docker_stub_calls=0`; `tmp_left=0`; the 15 self-test hashes equal the `c71912f` blobs. |
| `logs/full2-u022.meta` (child umask `022`, 18:05:22–18:14:21Z) | `cc547d3ed939cf391b87c7e4a32f79838936e1ecdfcb974a93fc1813dcc051a5` | The same results and the same 15 self-test hashes. |
| `evidence/held-hashes-2.txt` (18:05:22Z) | `88d8f16380c88b6d014851ec2fb632d49efc41454e1d85659a20f0f2b63160ab` | The 11 changed paths; each equals its `c71912f` blob. At my check, the worktree `tests/` equals `c71912f` (`git diff --quiet`). |
| `evidence/mutants-summary.json` | `bd6b21b9802fc7fff7f6e3f58d7d469be9b6381bc4c22bcea9db90cfc15b3802` | 70 entries, 70 unique ids, 70 DETECTED, no SETUP ERROR, no NOT DETECTED. 67 detections fail on a named assertion. 3 fail on an error that the mutation itself causes: MU-01-3b (the removal deleted the kept link, so `readlink` gives `ENOENT`), M4-7c and M2-4b (as accepted in Round 1). Each of the 10 A-SH-05 site mutants fails both mask tests (two failing tests). The V4-9 inventory test passes on each of these mutant trees, so the site control is the detector. Examples that match the intended property: MU-01-5 (stage 3 removed) makes the moved file in T `0600` in variant O, the outside write that the grant forbids; MU-01-12 (the chain skips the base) changes the target of a linked private root; MU-01-13 lets an outside correction pass after a parent move; MU-02-6 (no abort at a fixture) breaks the stop at `@backup-B`. |
| `bin/catalog-r2.py`, `catalog-r2-new.py` (46), `catalog-r2-round1.py` (24), `mutate.py` | `3df0c49b837bdc22932a02a061b99c7ae3ea0b83a9b16208165b782fdd469223`, `20c7894b166e72a99e8c922b1f58c28d272da399f12b30ff64418d03c7a4909e`, `ca15dc7686204eb9d8ca7e053a5f501ddcd68b28cedbfa5a8b6c53af342248da`, `4f71150f3b20a48ac7bcd329137a4b96e3294d1df2a9d217b10e07183889de09` | Every bound id is present. The A-SH-05 mutants are site-local and token-free (`writeFileSync`, `readFileSync`, `chmodSync`). An anchor count other than the expected count gives SETUP ERROR (no credit). |
| `evidence/mutant-copy-binding.json` | `363f354b5ca839b95e6bc05cba1e35b3d71b23abf659e60b3a43f3fa8491df70` | 113 copies (43 baselines, 70 mutants), `notBound` empty; each copy differs from the reference only in its expected files; no baseline differs. |
| `evidence/worktree-inventory-during-mutants.json`, `-after-mutants.json` | `356588eb8855b9d3fa5d10b97d4ad1663a6ab6b1b3413c9cd744e69427c70b29` (both) | 41 files, `runtimeRef` and `selftestRef` `c71912f`, no difference; I matched all 41 to my `c71912f` export. |
| `evidence/neutral/v3-final-base`, `v3-final-new2`; `bin/neutral-compare-v4.py`; `compare-v4-v3-final-base-v3-final-new2.json` | site-12 `e363d93a5b49cda4f22ab7c3f00d7e3d2753e800ed033d85eb9e72023acdb28b` (both); site-13 `7b68b242977024757b9f58353c51a932cae4f25ae76986be9061fb82b719c32c` (both); site-7 `ec3752bcd839891ad24d2c33c839fba6ee569ad9031e14aa34d50bb8e53dd340` and `e08509fbf4eb5031b86685d99b251ca2f7dfc963655e5be3cc59264fae55fe9a`; comparator `0de0d348a16803a0f74116c815f509d592bd97989215ef397e3e579255cb3c9f` | NB-1 and NB-2 closed. The before and after inventories bind each run: `final-base` uses the `71a5bf9` blobs for the five changed runtime modules and the `c71912f` self-tests; `final-new2` uses `c71912f` for all 41 files. I matched every file to my two exports. #12 and #13 are byte-identical across versions; #7 is equal after the pid-name substitution only (strict dict equality). The #12 record has the three row results (PASS, first cause `null`). The first new run (`logs/neutral-final-new-u022`, exit 1) failed in setup on a path typo before any test ran; it stays as a record and gives no credit. The earlier v3 records stay as history. |

Limit: the suite metas bind the self-test files by hash. The runtime modules of the two suites are bound by `held-hashes-2.txt` at the start of the 022 run and by the worktree inventories of the mutant run; all equal `c71912f`.

### R2.7 Limits

- Host source review only. No runtime window, no candidate C, no Docker. The rows of triage §N-4 stay unknown until a storage run.
- I did not run the complete suite or the mutation campaign. I verified the supplied hashes and counts, and I read the code and the controls.
- macOS APFS and Node 24 only (the QA metas record `v24.21.0`).
- Independence: I read no Reviewer-B report, finding or transcript, and no plan entry of this round. I did not read the QA report of this round.

### R2.8 Private root and deviations

Private root `/Users/quangnguyen/cogniate-review-runs/harness-r2-reviewer-a-task_67e836c13f1b-20261021T1732Z` (`0700`). `src/` and `base/` hold the `git archive` exports of `c71912f` and `71a5bf9` (`tests/` only). `notes/` holds the checkpoint bodies and this draft. Deviation D-1 (disclosed): `notes/checkpoint-1.md` (inode 10196272) was created `0644` by the editor tool inside the `0700` root; it holds review text only and no secret. I set it to `0600` and made `notes/checkpoint-1.body`, created `0600` by the shell. A later `0600` mode does not prove a `0600` creation. Every other file was created `0600` under umask `077` by shell commands (`tar`, `printf`, `cat`, `shasum`) or by an explicit `0600` exclusive create. Deviation D-2 (disclosed): to check the two suite metas, two short lists of public test file names and SHA-256 values were written to `/tmp` (umask `077`, `0600`) and deleted in the same command, in under 1 s; no secret. Manifest: `MANIFEST.sha256` in the root, SHA-256 `f2d59f171a2a14ad5992c965c628537be1fe07d688ac580257699cce923b2c4f`, 510 entries (every regular file except itself; every file `0600`, every folder `0700`, no link). It does not cover this report, which is recorded in git.

## Round 3

Verdict: APPROVE
Round: 3

Reviewer-A (lens A). Claude Code Opus 5.5, xhigh. Task `task_842ea419d367`, dispatch `ctx_ea4fe64fdd8b`, run `run_ebe671ad72a9`. Date: 2026-10-21 (UTC). This round reviews the bounded repair after the failed candidate C diagnostic. It is independent of the QA repair owner and of Reviewer-B. It gives no runtime acceptance and no row credit. A passing self-test count is not runtime evidence.

### R3.1 Target, criteria and method

| Item | Value |
| --- | --- |
| Source target | WIP commit `c4de96f41163a23c182f0fbcb513460086da2fd8` (parent `caa382a`), tests tree `290a773f1c9779693153ae77b46cc8ceb7eb83f4`. Held hashes (equal to my export): `storage-rows.mjs` `0958cc49fdf24c447f6b8eb446b17908979e6516f186cd8343fc7a77ede215c1`, `storage-rows.selftest.mjs` `9ef56478f7099dc28a8733c163f4803f36cc8bc1f24b687cb28e388eaeec4376`, `run-m1.mjs` `8e1ef65ccac3bc593f501e6f871be3a8e987fe59e3441b0a303897629d57a076`. |
| Base | Candidate C `d3296dd6eddbe723364a639d8e2db0adf12ab183`, tests tree `183a72b2fea5ff065fc57c96649199bc720fb6e0` (the tests tree of my Round 2 target `c71912f`). |
| Diff scope | `d3296dd..c4de96f -- tests` changes exactly the three granted paths: `run-m1.mjs` (+2, −1), `storage-rows.mjs` (+5, −3), `storage-rows.selftest.mjs` (+25, −4). The other paths of the range are `README.md`, `docs/guides/**`, `docs/human_review/**` and `docs/team/**`. `git diff 9f8ac62 c4de96f` has no path outside `docs/`, `README.md` and `tests/`, so the product is unchanged. `c4de96f..7f4cc61` changes documents only. The worktree `tests/` equals `c4de96f` (`git diff --quiet`). `pnpm-workspace.yaml` stays untracked and untouched. |
| Criteria | Charter. Frozen triage `2d763fe` (`ade4e8a0f9e54823040828758b7683d5c9b230587747f3ef3c89ef8e99f9a032`). M1 precision `a60ba4a` (`ac444799ae5e93706054a7e352e339bdea509a889328c15365a3535864fb37af`). ADR-012 §7, §9 and §11 (unchanged since `a60ba4a`). Lead grant `msg_8fee425d4749`, as the dispatch and the plan checkpoint at `caa382a` state it. My Round 1 and Round 2 sections above (prefix `d721edaae6790bddfae573160fcb9dd07dd91afc5d6cee3e40b87fa54354df9b`, 58,293 bytes; unchanged). |
| QA proposal | `diagnosis-c/backup-B-502.md` `b0004ad12a62694b66d6509a918e2934bc004981ffa87e2561a8565f187500bd` (5,900 bytes, `0600`) and `backup-B-502-erratum.md` `1205cdbcf729bad7ea4601b16f2133eac9512763322de15567675d5944904d4a` (371 bytes, `0600`). The erratum corrects the header time: the file is from 19:31:17Z, not "about 19:40Z". |
| Method | Staged. (1) The criteria, the proposal and the C source from git objects, before the new source. I sent my initial assessment (`msg_23a24effd49b`). (2) `c4de96f` and `d3296dd` exported with `git archive` into my private root. I did not read the working-tree test code. (3) Narrow private probes, with purpose and commands sent first (`msg_f30bc0cb0922`); results in `msg_cf1f0abdfb9d`. (4) The final QA evidence (`msg_ca4e5c308e29`, `msg_9b0d6b5d47d3`, `msg_53511f162d90`). I did not read any Reviewer-B file, peer conclusion or transcript, or the text of the QA report. No Docker, Compose, network, service, settings or dependency step. |

### R3.2 Result

APPROVE for this bounded host source round. No BLOCKER and no MAJOR finding. One MINOR finding (A-SH-10). The Lead accepted it as a coverage deferral that does not block (`msg_45768c36f8c1`).

- The hypothesis of the QA proposal is correct (R3.3). The repair corrects the three sites, and it weakens no refusal, start, write-gate or data-integrity rule (R3.4).
- The FakeWorld platform model is opt-in. It matches the real lane in every transition that these sites can observe (R3.5).
- The bound of 1,800,000 ms applies only to the host self-test call of the `--harness-only` branch (R3.6).
- The required evidence is present and bound to `c4de96f` (R3.8). R2-RT-1 fails on the C runtime and passes on the repair. MU-RT-1 to MU-RT-3 are each detected by an actual failed assertion. The complete `--harness-only` run under child umask `022` also meets the complete-022 suite requirement. The complete 077 suite passes with its own state.
- The approval covers the harness source at `c4de96f` and its host self-checks only. It gives no runtime acceptance, no row credit and no new candidate. The rows after `@backup-B` stay unknown until a new diagnostic.

### R3.3 Diagnosis (independent check of the proposal)

- `serviceContainers` (`storage-docker.mjs:330–343`) lists every container with the lane project label, except one-off and storage containers. So `lane.services()` also lists `proxy`, `postgres` and `moodle`.
- At C, `@backup-B` (`storage-rows.mjs:864`) and `postB` (`:296`) start the stack only when no listed container runs. `e-fresh-refusal` (`:1078`) fails when any listed container runs.
- Diagnostic evidence (read only: names, states, statuses). The `a-first-start-both-pending-up` log (`cmd/281`) shows `proxy`, `postgres` and `moodle` Running and Healthy. The harness stop of `e-not-same-import` (`cmd/284`) stops only `cogniate-app` and `lti-service`. No command log exists between `cmd/290` and `cmd/291`, so `before-B-marker` did not run. Step `034-fixture-backup-B.json` (`12b3027177c7ea579d98753f9f6de107f3ce227a84f1bd6e33d84b2abcd22e0d`) is FAIL with the notes "New LTI platform: HTTP 502" and "duration 0 s". `m1-case-results.json` (`a3d5c49df59e6e123e3d72aedab238a34f7251ebbe23063994fdddf3260bcf69`) has 33 PASS and 37 FAIL. Each FAIL has the first cause "not run: prerequisite …".
- The C FakeWorld listed only the two app services (`all()`). So V7-1 always started the stack at these sites and could not see the fault.
- The mock reproduces the real failure. The 37 mismatches of R2-RT-1 on the C runtime (QA `rt-base-u022`) are exactly the 37 FAIL row ids of the diagnostic.
- `postB('b1')` in `@backup-B` (`:877` at `c4de96f`) runs after `stop-before-B`. So a repair of `:864` alone would still fail. The proposal names all three sites. My search of the 12 runtime modules finds no other use of `running` that counts the platform (R3.4).
- No product, lock or storage fault is shown. The product refused correctly in `e-not-same-import`.

### R3.4 The three sites and the state combinations

| Site (`c4de96f`) | C | Repair | Lens-A check |
| --- | --- | --- | --- |
| `@backup-B` `storage-rows.mjs:866` | `up` when no lane container runs | `up` unless both app services run (`appRunning`, `:250`) | `up` runs in every case where C ran it. It also runs when one or both app services are stopped while another lane container runs. `up` is the product `stack:up` (exit 0, then `waitHealthy`). The C mock already used this path. `B` is still taken after the markers and the harness stop. |
| `postB` `:298` (in `@backup-B` and each `@post-B`) | the same as `:864` at C | the same predicate | As above. The write after `B` and its logical proof are unchanged. |
| `e-fresh-refusal` `:1080` | FAIL when any lane container runs | FAIL when an app service runs | `assertUnchanged` runs first. `nothingChanged` keys every listed container by `id`, `startedAt` and `created`. So a start, restart or new container of any service still FAILs, and M1 "no service starts" holds. A platform that runs and does not change passes. |

| State before the step (probes on the mock) | C | `c4de96f` | Evidence |
| --- | --- | --- | --- |
| Both app services stopped; platform running (the diagnostic state) | no start; the write fails | `stack:up` | R2-RT-1: C FAIL, repair PASS |
| Both app services stopped; no platform | `stack:up` | `stack:up` | V7-1 PASS on both trees |
| Only `cogniate-app` runs before `@backup-B` (platform on, off) | no start; the write fails (37 mismatches) | `stack:up` (`before-B-marker`); map holds | PA1, PA1x |
| Only `lti-service` runs before the first `@post-B` (platform on, off) | no start; FAIL (PA2x: 21 mismatches at `@post-B`) | `stack:up` (`stack-up-before-<tag>`); map holds | PA2, PA2x |
| Both app services run | no start | no start | The second and third `@post-B` of the mock take this path |
| `e-fresh-refusal`: platform runs and does not change | FAIL "No service starts" (QA MU-RT-3) | PASS | PB0 |
| `e-fresh-refusal`: the refusal creates and starts `lti-service` | FAIL (source) | FAIL "something changed: service container created or recreated" | PB1 |
| `e-fresh-refusal`: the refusal restarts `moodle` | FAIL (source) | FAIL "something changed" (created or recreated, and changed) | PB3 |
| `e-fresh-refusal`: `lti-service` runs before the refusal and does not change | FAIL (source) | FAIL "No service starts" | PB4 |

The other service-state checks need no change:
- `servicesStopped` (`storage-docker.mjs:357`) already filters the two app services. It is the write-mode gate, the root-restore precondition and the `stopServices` check, and it is unchanged.
- `stopped()` (`:248`) still counts every lane container. While the platform runs, it calls the harness stop of the two app services again. The extra stop is harmless, as the proposal states.
- The `a-fresh` creation order, `g-quarantine-in-use` ("still exist") and `g-quarantine` ("every other container is unchanged") check all containers, so they are stricter with the platform. R2-RT-1 now also exercises them with the platform present. `bOracle` filters the app services.

### R3.5 FakeWorld platform model

- `platformOn` is opt-in. Only R2-RT-1 sets it. When it is not set, `all()` adds nothing and `reset()` sets an empty list. The step-end log entries get two extra fields, and the HTTP entries get one. V7-1 and its declared map are unchanged, and V7-1 passes on both trees.
- With `platformOn`, the first successful non-restart start makes `proxy`, `postgres` and `moodle` running containers with the lane project label. `docker compose stop` and quarantine change only the app services. `stack:reset` removes the platform, and the next successful start makes it again.
- This matches the real lane. The platform kept running through the first-start quarantine (`cmd/281`: not recreated) and through the harness stop (`cmd/284`). ADR-012 §9 says that quarantine touches no other container. `stack-reset.sh` runs `down -v --remove-orphans`.
- R2-RT-1 asserts state at the time of each request: each HTTP entry records `appRunning`. It also asserts the precondition before `@backup-B` and the first `@post-B`: both app services stopped and three platform containers running. For `e-fresh-refusal`, it asserts a running platform before the row and no running app service at its end. So it does not rely on the command list alone.

### R3.6 The finite self-test bound

- `run-m1.mjs:72` is the only change: `{ timeoutMs: 1_800_000 }` on the `node --test` call. `checked` (`:52`, default 120,000 ms) has only two callers, `:72` and `:73`. Both are inside the `--harness-only` branch (`:66–113`), and that branch ends with `process.exit(0)` before any Docker, clone or product step.
- The typecheck and the four discoveries keep 120,000 ms. The runtime children (43,200,000 ms), W4 (1,800,000 ms) and the owned cleanup are unchanged.
- At the bound, `lib.mjs` `run()` sends `SIGTERM` and then `SIGKILL` to its own child, and the assertion fails, so the bound fails closed. The measured complete run took 573.9 s.

### R3.7 Findings

No BLOCKER, no MAJOR, no NIT. One MINOR.

| Id | Severity | File:line (`c4de96f`) | Problem | Evidence | Suggested fix |
| --- | --- | --- | --- | --- | --- |
| A-SH-10 | MINOR (Lead: deferred, does not block, `msg_45768c36f8c1`) | `tests/host/storage-rows.selftest.mjs:1821–1834` (R2-RT-1); `tests/host/storage-rows.mjs:250` | No control tells the required predicate (both app services run) from a weaker one (any app service runs). The precondition of R2-RT-1 stops both services, so the two predicates give the same result there. | My private mutant `any` (`.every` → `.some` at `:250`) passes R2-RT-1. My PA probes detect it: 37 mismatches at `@backup-B` (PA1, PA1x) and 21 at `@post-B` (PA2, PA2x). The code at `c4de96f` is correct: PA 4 of 4 pass. With PB, the private probes on the repair pass 8 of 8. | A one-app-down variant of R2-RT-1 and a mutant MU-RT-4 (`.every` → `.some`). No repair is requested in this round. |

Observations (no finding, no request):
- O-1. My private mutant `drop` removes the `e-fresh-refusal` service check. It passes R2-RT-1, PB1 and PB3, because `assertUnchanged` still finds any start or restart. Only PB4 (an app service that runs before the refusal) detects it. So the M1 oracle "no service starts" does not depend on this one line.
- O-2. The fake `stack:down` stops the app services and keeps the platform running. The real `down --remove-orphans` removes every lane container, and the next `stack:up` makes them again. Only `a-second-start` calls `stack:down`, and its next action is `stack:up`, with no service-state check between them. So no acceptance or detection in this delta changes.

### R3.8 Evidence

All QA files are in `/Users/quangnguyen/cogniate-qa-runs/storage-harness-repair-qa-r2-20261021T1646Z` (files `0600`, folders `0700`). I verified each hash and checked the content below myself.

| Evidence | SHA-256 | What I checked |
| --- | --- | --- |
| `logs/rt-base-u022.meta`, `.tap` (19:37:45–19:38:07Z) | `bb72c6a6b599e584d37b74a14547f33b951fa2ce86dda332f810fb54b117dbd4`, `508f3a1d6a95c67c7244c0d3d5b68b6cb5833fa804ce4a3043ee9bca16266aeb` | Old/new discrimination, C side. The copy `src/rt-base/tests/host` has the C `storage-rows.mjs` (`c2934448d422817d8f9e33242fc7c369c7d4f97464ef36c6d15b62bd7022c83b`, equal to the C blob) and the new self-test and `run-m1.mjs`. No file in it is newer than the run start. V7-1 passes. R2-RT-1 fails at the declared-map assertion with 37 mismatches, equal to the diagnostic FAIL set. |
| `logs/rt-new-u022.meta`, `.tap` (19:38:07–19:38:31Z) | `6ce25d5e1bf398984c1f895e4dfa19b45085e7f839e1a65cc2928e70af2121b0`, `bad18aed45937aa031066bbb48703546abe0bbac09ec2e1e0f642a4509ba8330` | V7-1 and R2-RT-1 pass. This meta binds the self-test only; `evidence/held-hashes-rt.txt` (`3aa67bfd632c2ad33f2edbbf13af8a641b7b24741d8fd47e855fa5cb73bc11e5`) is from 19:38:43Z, after this run. The new-side PASS is bound by the complete 022 run below: R2-RT-1 is one of its 172 results, and all 42 host files are hash-bound before and after it. |
| `bin/catalog-rt.py`; `mutants/run-rt1/results.json`; `MU-RT-1/2/3/mutant.log`; `evidence/mutant-copy-binding-rt.json` | `818cce53851dd8e697967b023afee1e5a0382f0fd3913e3887e48bde4cd8ef80`; `c66c63fdf6996cc47d58da91de08fa74750425fa5098f25dc92c62a67ca44baa`; `0f1c3d887eb820ce8e54eb3d843449532b2a19cfa4ca9691e584afba511da237`, `c1cd439432279e37bcd7b483f470e2e9728a75dcfe925f6a670d718f1c3fdb43`, `fd6dd2e616532d5c5630f11e6a20a649a688afefc500e965ce03e4ca2711d653`; `55a8bd8b0bc17e838f43d34ff6fb99054185389f49f66ef15556bd241445815a` | The catalog was born at 19:38:43Z, before the mutant run (19:38:54–19:39:29Z). Each edit puts back the exact C text of one site. Each copy differs from the reference only in `storage-rows.mjs`, and the baseline passes. MU-RT-1 and MU-RT-2 each fail the map with the 37 `@backup-B` dependents. MU-RT-3 fails with exactly `e-fresh-refusal: FAIL "No service starts"`. These are 3 of 3 actual assertion failures, and no Docker stub was called. |
| `logs/ho-rt-u022.meta`, `.stdout`, `.stderr` (child umask `022`, 19:40:16–19:49:54Z) | `ad9c48552cb5f2b2b56b6bbefee0138b8cc66ab8c64f1aad0f6577834d37aeb8`, `ba8f08e515ba671721e84335f6299e14e9c498bda659a77cce8ad513c17b6177`, empty | The complete `node tests/host/run-m1.mjs --harness-only --provider blackboard` run: exit 0; `docker_stub_calls=0`. It meets the complete-022 suite because of the four conditions below. |
| `logs/final-rt-u077.meta`, `.tap`, `.stderr` (child umask `077`, 19:40:18–19:49:50Z) | `2a94c65c153fca8f52bf62b6faa06f8a0188620932283337c2926ddbac1b4932`, `1b659329643e00b1c3c54a6f86c105276eef1e11f7abc918a5d14c99fc9d4d67`, empty | 143 tests: 143 pass; 0 fail, cancelled, skipped or todo. Exit 0; `docker_stub_calls=0`; `tmp_left=0`. Its own HOME and TMPDIR (`final-rt-u077`), separate from the 022 run (`ho-rt-u022`). The worktree `tests/host` has no shared artifact folder. The 15 self-test hashes equal the `c4de96f` blobs. |
| `evidence/worktree-inventory-rt.json` (19:50:28Z); `evidence/tail-rt-u022-inventory-before.json`, `-after.json` | `16c5ccee1241bd24f68302f9e3a435c4a0541a8078c67dd526e5f609ac663d00` (all three) | 41 files, `runtimeRef` and `selftestRef` `c4de96f`, no difference. |
| `logs/tail-rt-u022.meta`, `.stdout`, `.stderr`; `bin/tail-replay.mjs` (19:54:39–19:54:42Z) | `52659007b0bba45cce3306a7e259bb4c9604d25a91d4f735a3381907ba978268`, `7c7154276bc7f933d3fe26ad1e2bed00ad07660f2fa96122ccf2480e6218cbb7`, `0b75cdc946155876e3a82b6650ffde390eaa9b666608cf8e28438112f925d36b`; `d2c911fae750ed1bcddce9731658682ddbb0058b313f7a864487d1828b3998ea` | The R2-D-2 corrective tail. The launcher checks `run-m1.mjs` against the held hash. It cuts the `checked` and `loadingRuntime` definitions and the tail (typecheck and four discoveries) as one literal block each from that text, and it runs them. It runs no self-test. HOME `.npmrc` has `update-notifier=false` and `offline=true`. Exit 0; the typecheck and the inventory line pass. |
| `evidence/manifest-r2-v4.tsv`; QA report at `7f4cc61` | `eb3a24f548afad0e3291f247afedcebe9f074f78af347ae229530738e1ee00ca`; `b6248d0e841130de35925655b802fe7e282649605ca6edfd77fe97c0df86e688` (77,922 bytes) | Hashes only. The Lead verified the 7,028 manifest entries. I did not read the report text. |

The complete `--harness-only` run under `022` meets the complete-022 suite because all four conditions hold:
1. File selection. The branch selects `tests/host/**/*.selftest.mjs`, `tests/sim/**/*.test.mjs` and `tests/acceptance/M1/common/**/*.selftest.mjs`. In the worktree these are 15 host files (the same 15 as my `c4de96f` export and as the 077 run), 4 sim files and 3 common files. By name, all 143 test names of the 077 run occur exactly once among the 172 names of this run (I unescaped TAP `\#`). The other 29 names come from the sim and common files.
2. Full result capture. The output has 172 top-level results, all passed, and the summary "tests 172, pass 172, fail 0, cancelled 0, skipped 0, todo 0".
3. No skipped or interrupted test. Exit 0 after 573.9 s, under the 1,800,000 ms bound. No skip or todo marker.
4. Source binding. The meta hashes 42 `tests/host` files before and after the run. All 84 entries equal the `c4de96f` blobs. The run started 5 s before the commit (19:40:21Z); the binding is by content.

R2-D-2 (QA disclosure, Lead `msg_9b0d6b5d47d3`). During the original `--harness-only` run, the npm update notifier of the typecheck step fetched public npm metadata. By source order (`:72`, then `:73`), this step runs only after `node --test` ends. So the deviation does not change the 172 self-test results, but the original run does not meet the no-network rule. The corrective tail replay passes with the notifier off and npm offline. Limit: no traffic capture exists, so I cannot confirm independently that no other network access happened.

Other limits of the evidence:
- The 077 meta binds the self-tests by hash. The runtime modules of that run are bound by the 022 inventories before and after, which bracket it, and by the inventory at 19:50:28Z.
- The sim and common test files are not hash-bound in the meta. They did not change since C, and the worktree `tests/` now equals `c4de96f`.
- V1-12 in the 022 run recorded `HEAD` `caa382a`, because the run started before the commit. V1-12 copies only `package.json` and `infra/`, which are equal at `caa382a` and `c4de96f`.

### R3.9 Limits

- Host source review only. No runtime window and no Docker. The real behavior with one app service down is not measured. The probes use QA's fake world.
- I did not run the complete suites or the mutation campaign. My probes are narrow: 8 probe tests on the repaired tree, 4 on the C runtime, and R2-RT-1 plus 4 probe tests on each of two private mutants.
- I verified unchanged bytes. I did not review again the Round 2 controls, the 142-test gates or the deferred findings (Lead `msg_d04786244ff9`). The V7-1 map and the 27 V2-8 injections are unchanged in source and pass in both complete runs. My static V4-9 recount gives X1–X8 on both trees.
- macOS APFS and Node 24.21.0 only.
- Independence: I read no Reviewer-B file, finding or transcript, and no QA report text. I read the QA proposal, QA evidence files, and the diagnostic evidence that the proposal names (names, states and statuses only).

### R3.10 Private root and deviations

Private root `/Users/quangnguyen/cogniate-review-runs/harness-r3-reviewer-a-task_842ea419d367-20261021T1941Z` (`0700`, outside the repository). `c/` and `n/` hold the `git archive` exports (`tests/` only) of `d3296dd` and `c4de96f`. `probes/` holds the four probe trees (`new`, `old`, `any`, `drop`), the probe appendix (`cc09b8082f15c05b…`), the captures and the metas. `bin/` holds the fail-closed Docker stub (it records each call and exits 97; zero calls), the runner, the mutation helper (exactly one anchor), the V4-9 recount and the meta-binding check. `notes/` holds the draft, the recount, the binding and selection checks, and the evidence hashes.
- Each writing command started with umask `077`. Captures were created `0600` before each child. Each node child ran under umask `022` inside the `0700` root, with `env -i`, its own HOME and TMPDIR, `--test-timeout=180000` and a 900 s alarm. Its output redirect was outside the umask subshell. Each run left no temporary or HOME file.
- Now `bin/docker` and `bin/run-probe.sh` are `0700`. Every other file is `0600`, every folder is `0700`, and there is no link.
- Deviation D-1 (disclosed): one command that compared the QA copy `src/rt-base` with C had no `umask 077`. It created `notes/c-files.txt` (inode 10798218, 250 lines) and `notes/rtbase-files.txt` (inode 10798219, 42 lines) at `0644`, born 19:47:20Z. They hold only relative file paths of the public test tree, with no secret. I recorded their metadata (`notes/deviation-d1-before-chmod.txt`) and set them to `0600` at about 20:05Z. A later `0600` does not prove a `0600` creation. Every other file was created `0600` or `0700`.
- Disclosures: (1) to compare names, I listed test file names (not content) in the worktree `tests/`; (2) I read the QA private copy `src/rt-base` by hash and modification time only.

Manifest: `MANIFEST.sha256` in the root, SHA-256 `c89e905495d4cc1ad214504ecc3a2fd1961a6ee601c095dd4239d615da4fb06f`, 1,533 entries. It lists every regular file except itself, and every entry verifies. It does not cover this report, which is recorded in git.
