# Storage harness repair — independent common QA (host self-checks)

Verdict: PASS
Round: 1

Scope of this verdict: host-only self-checks of the repaired harness. It is not runtime QA and gives no acceptance credit.
Two named mutants stay NOT DETECTED with proposed dispositions (M4-8f equivalent, M5-4b masked; section 9.1). Their final
disposition and the applicable gate belong to the Lead after the two independent source reviews. This verdict does not
close that gate.

Task `task_6c53cbbc403c`, dispatch `ctx_f189530f67c1`, run `run_ebe671ad72a9`. Role: independent common QA harness owner (fresh instance).
Model: Claude Code Opus 5.5 (`claude-opus-5-5`), xhigh. Date: 2026-10-21 (UTC).

## 1. Scope and limits

- Target: the host storage and migration acceptance harness against triage revision 4 `2d763fec502f6b7758b7ed56f51613183e5021ce`
  (SHA-256 `ade4e8a0f9e54823040828758b7683d5c9b230587747f3ef3c89ef8e99f9a032`), with the Lead decisions of the dispatch
  (R2-01…R2-05, IN-1…IN-4, A-SRR-07, A-SRR-08), the supplement `msg_11843e2d6407` (B-SR-04…B-SR-07), and the later grants
  (LD-1; LD-2 and LD-3 per `docs/architecture/tasks/M1.md` at `a60ba4a`, SHA-256 `ac444799ae5e93706054a7e352e339bdea509a889328c15365a3535864fb37af`).
- Original tests tree: `4c7e067feedc644f955afee37806f06e7273dd04`. No product file, fixture source, manifest or row inventory changed.
  No row id or count changed (70 storage rows, 12 migration rows).
- Host only. No Docker, Compose, live service, network call or settings change. No real migration or storage child ran.
  Every self-test run had a fail-closed Docker stub first on `PATH`; it recorded zero calls.
- These are self-checks of my own harness. They are not independent runtime QA. Two blind source reviews come before any diagnostic.
  The mock lane is QA's model of the product; it can find sequence and fixture-logic errors, not runtime errors (triage N-4).

## 2. Provenance and independence

- Control map, frozen before any implementation source read: `/Users/quangnguyen/cogniate-qa-runs/storage-harness-repair-qa-20261021T1356Z/map/control-map.md`
  (SHA-256 `bf47ec74bc0e2ebadbc461407d10545342c10710ee0d00d2d0d1604d7bdaafda`, 0600 in a 0700 root). The Lead granted the exact 22 paths.
  Later clarifications are in `map/clarifications.md` of the same root; the map itself is unchanged.
- Before the map I read only the charter, the triage, M1 rows, ADR-012 §4, §7, §11, §15, the plan checkpoints of 13:03–13:46 UTC and
  the dispatch. IN-1…IN-4 come from a QA testability report that I did not write and did not read; I used the Lead's summary.
- I did not read any reviewer report, testability report, Author note or product QA report. After the grant I read the Lead's plan
  checkpoint text twice (for the LD-2/LD-3 grant); it summarizes other tasks' status; I did not use it for any oracle.
- Late messages: my first Orca delivery batch stayed unacknowledged, so five Lead messages (14:02–15:33 UTC) reached me only at about
  15:40 UTC. I applied them at once (clarification C-3; status `msg_c417b3da0839`). Earlier V1-12 runs that used `NPM_CONFIG_*` keys are
  superseded history.
- Hygiene deviations (clarification D-1): one scratch copy made with `cp -p` kept mode 0644 (repo source text, no secret) until I set
  0600; npm's compile cache folders in a test TMPDIR (child umask 022, inside the 0700 root) before the probe contained them.
- During my final suite run an untracked file `docs/reviews/M1/storage-harness-reviewer-a.md` appeared in the shared
  worktree. I saw only its name in `git status`. I did not open or read it.

## 3. Changed paths

The Lead made a WIP exact-path commit of the 21 held code and test paths at `5f184771d835fcf03701053c6b11a00ec7f0ccf3`
(tests tree `b7aa39ae22acd33671e09857dd66412dcc77b8fd`); I compared each committed blob with my held SHA-256: 21 of 21 equal.
Amendment A-1 (section 9.2) then changed one line in each of three self-test paths; the Lead committed them at
`71a5bf92608f8ee20e81363a0be987474fc59859` (tests tree `d574737219dffadb4447968bb0cc06393e61e5b9`). The final hashes below
equal the worktree and the blobs at `71a5bf9`. These commits are source-review snapshots, not candidate C. This report is
the 22nd granted path.

| Path | SHA-256 | Bytes |
|---|---|---|
| `tests/host/m1-migration.mjs` | `97d2ee6c3b9f8659c7ff8c951289c2c4044a960975c54568d94f634eba7ee082` | 24756 |
| `tests/host/m1-migration.selftest.mjs` | `a0a033cd042ccfad67950260a3bcc6d474c3fa838cbab686e164a4efe3cb86c4` | 22444 |
| `tests/host/run-m1.mjs` | `ad11f9dd901399bdce787d93436be1a6ee760a2e690d2f1f927b3c9dda9d7658` | 28633 |
| `tests/host/storage-compat-route.mjs` | `27903ecd69615ba51e05523163975aafb97c799433d90753ae2b3301486508da` | 19615 |
| `tests/host/storage-compat-route.selftest.mjs` | `c14eebc1946a26dbfcbef196bca24b12c23680b09d01ea101a0e46fb6e3dbb51` | 11977 |
| `tests/host/storage-diagnostic.mjs` | `1cf21687a956d36d0f80be66a94e52aa3c1cc0e6640b5b7d6d8cc27f8fefc9bb` | 9731 |
| `tests/host/storage-diagnostic.selftest.mjs` | `05fc0a17b4758777a27a9ddeef19ca42de65c0758e07d1368a4fbc4551cb93e3` | 11510 |
| `tests/host/storage-fixture-script.mjs` | `5b5d43bba40f2332ae7339826d3ebd15384e427f6b69d14edbf2abcd5db365f6` | 30957 |
| `tests/host/storage-fixture-script.selftest.mjs` | `cd8d4825afaab92ceb25a2fc4dbc5332768dec2cb418d4d9a4ea8a357dba63bb` | 12562 |
| `tests/host/storage-handoff.mjs` | `b020379f9cc49200513090f5faeccf7d9f6991f5d5bfedd69e39b16292d6a096` | 6203 |
| `tests/host/storage-handoff.selftest.mjs` | `3800268e588d61e9af369a782d28c05db7899dd3bbd7c2b7f71a33da3155921c` | 8467 |
| `tests/host/storage-lane.mjs` | `88a3388bad47503bcd241f8501673bd802e0180b7f8efb137afd5d9ded2d4138` | 20144 |
| `tests/host/storage-lane.selftest.mjs` | `15f17a4be4283ff154638102ffca1b9066014771cc00f9c31dbd78da9f8adc8a` | 10951 |
| `tests/host/storage-oracle.mjs` | `e15564d1c523f7f075c5e1444b9820a5bc5814a75bcd63c2b7e7a251312d3ed6` | 22856 |
| `tests/host/storage-oracle.selftest.mjs` | `8421d6d0f0a6d8c85c16ea9be2d2a0961fe6de7730c9a395650262c74c7cf3fe` | 30592 |
| `tests/host/storage-private-copy.selftest.mjs` | `25007d36f8628510ccd200a3b0e2265085fb2ee272f39a50d764daa0b729a6ce` | 15254 |
| `tests/host/storage-private-scan.mjs` | `48d96c829813960c2790782033d713d120bcc541d7d582625027c031486321a6` | 10343 |
| `tests/host/storage-private-scan.selftest.mjs` | `10f4dd5cff2dbb6cf9fd47d7b0b8cf667bbc27b9e1aac9959b6f89e4b76a29b1` | 11315 |
| `tests/host/storage-rows.mjs` | `922d5ba1aa67b59c30ccf16550f5aede58743e93df0cb8d73aed1cff3430d22a` | 116873 |
| `tests/host/storage-rows.selftest.mjs` | `97991968562c5547560b373a6f8cb7c96f964733e159fe2dd27b2badfb1d6c57` | 128633 |
| `tests/host/storage-source-inventory.selftest.mjs` | `469fbeab8c1698f9766861b074a619de22143fc9dca6dba4ddcc9e87800408c3` | 7307 |

New runtime modules: `storage-private-scan.mjs`, `storage-handoff.mjs`, `storage-diagnostic.mjs`. No dropped or unused path.
`pnpm-workspace.yaml` (untracked) is not mine and I did not touch it.

## 4. Repairs

Each repair implements one accepted triage item. Row ids, row count (70 storage, 12 migration) and the original assertions
did not change, except the exact accepted P-1a text and the two LD-2/LD-3 assertions that M1 `a60ba4a` replaced.

| Triage item | Repair |
|---|---|
| §3.1 spawned backup (V1) | `a-serialize` spawns the backup through `lane.spawnGroup` (own process group), waits for the acquire event with this pgid and the command `stack:data-backup` after the log offset (`waitForRun`), takes two clock samples, and gives the verdict in the pure function `serializeVerdict` (offset and truncation, pgid identity, wait owner, one release for the run, release schema, fail-closed clock bounds lo/hi with sub-millisecond `timeMs`). The row awaits `backup.done` also after a failed identification and saves `storage/a-serialize-backup.log`. |
| §4.0, §4.3 root mountpoint plant (V2-3…V2-7, V2-10) | `d-mountpoint` plants root ownership, proves it with the new `meta` op (lstat only) or BLOCKs "precondition not made", restores ownership after both services positively stop, and adds the note `root restore: …`. |
| §4.3 phase abort (V2-4, V2-8) | Every one of the 21 restore sites runs through `guarded(site, body, restore)`. A failed restore keeps the first cause first, adds the restore note, makes the row FAIL, and BLOCKs every later step with one exact note. An abort-path scan and the phase-end log segment still run. `storage/restores.json` records every restore. |
| §5 Origin (V3) | `portal` and every non-GET `app()` request send `Origin: <app URL>`. |
| §6 P-1a (V5-1…V5-4) | `a-fresh` BLOCKs `lane not fresh: <rel>` on ENOENT. `d-content-folder` deletes only the child, keeps the parent (device/inode evidence), and after the unsafe case restores an empty 0700 `uploads` with the exact accepted note. |
| §6 seed needs (V2-9) | The second seed step is `@seed-resume` with needs `a-fresh`, `a-first-start-resume`; `e-not-same-import` and `@backup-B` need `@seed-resume`. |
| §7.2, §7.3 private copies (V4-1, V4-2, V4-6, V4-8, V4-9) | Sites #1–#16 use exclusive 0600 creates (`O_CREAT\|O_EXCL\|O_NOFOLLOW`, fstat before the first byte, SHA-256 check), into-volume writes with an explicit `fchmod` to the recorded mode, replace by rename, 0700/0600 recursive copies that refuse links, and private empty capture files with lstat checks before and after the shell. Scratch lives in `<root>/scratch/` of the lane. The token inventory allows only X1–X8. |
| §7.4, §7.5 scans (V4-3…V4-5, V4-7, V4-10) | `storage-private-scan.mjs`: data areas without a name exemption, root closure (exactly `backups`, `bin`, `out`, `quarantine`, `scratch`; 0700; host uid), the bin rule (script 0555 and digest), the outside classes (legacy placements and the write ledger), a hit record and a bounded correction (no link follow, same device/inode, `fchmod 0600`, re-check). A refused correction aborts the phase. Scans run after every storage step, on the abort path, at migration and snapshot points and at phase end. |
| §8 event archives (V6) | A log segment is archived before each `stack:reset` and at phase end. An absence claim without its segment is BLOCKED. `storage/absence.json` records the claims. |
| §9.1 handoff (V8-1…V8-4) | `checkHandoff` binds the handoff file, the M1-23 clone and the backup root to this window (w, H, s order; direct entries of the run root; 0600/0700; host uid; project and SHA). The migration child writes H exclusively (0600). Each round gets a new `QA_M1_WINDOW_START` before its migration child. |
| §9 step 7 diagnostic (V8-5, V8-6) | `diagnosticRun`: a new 0700 folder D, then w (after D's birth time), the migration child, the run-or-stop rule (a)–(f), then the storage child or `storage NOT RUN: <cause>`; teardown and W4 always run last. Migration scan points are published (IN-3). The rule is necessary, never an authorization. |

## 5. Latent defects found by the V7-1 dry run

The first full mock dry run on the repaired tree failed at three checks that the accepted repair list did not name. I kept
the original FAIL evidence (`logs/full1-u077.{meta,tap}`, `logs/full1-u022.{meta,tap}`, `logs/latent-without-{container,stale,journal}.txt`,
`mutants/explore*`, `evidence/latent-defects-v7-1.md` SHA-256 `e061d44d…`) and asked the Lead. I did not change those checks
before the grants.

| Id | Check | Disposition | Implementation |
|---|---|---|---|
| LD-1 | `storage-lane.mjs` "No QA container remains after its run" | Lead grant `msg_9b1720e2eeb9` | The lane records the exact id of the two kept roles (detached `storage-decoy`, created `storage-volume-user`) with the owning step; a remaining id passes only while its row owns it; `removeKept` retires an id only after its removal succeeds. |
| LD-2 | `g-orphan-refusal` "No stale-* folder" | M1 `a60ba4a`; grant `msg_df38477e48e2` | Per command: no command adds a `stale-*` folder, and the earlier records are unchanged. |
| LD-3 | `g-tamper` "No file is deleted" | M1 `a60ba4a`; grant `msg_df38477e48e2` | The multiset of names with volume identity is equal; SHA-256 pairs are equal except the two exact root journals, which have their own state checks. An `appdb` tamper is not covered (disclosed). |

Each LD has declared negative controls (section 8) and named mutants (section 9).

## 6. Restore sites (§4.3)

21 sites; 29 restore calls in the uninjected base run; 27 injections (site 14 `identityCase` has seven calls). Each
injection must give exactly 70 results: the rows before the stop equal the base run, the row FAILs with its first cause and
the restore note, every later row and fixture is BLOCKED with one exact note, and the abort-path scan, the phase-end
segment and the failed restore record exist.

| # | Site | Row |
|---|---|---|
| 1 | c-host-negative scratch | c-host-negative |
| 2 | a-restart-refusal planted entry | a-restart-refusal |
| 3 | a-lock-stale case 2 QA process group | a-lock-stale |
| 4 | a-lock-stale case 4 stub group | a-lock-stale |
| 5 | i-candidate-guard override marker | i-candidate-guard |
| 6 | d-stale near-match | d-stale |
| 7 | d-unknown notes.txt | d-unknown |
| 8 | d-symlink link and WAL stash | d-symlink |
| 9 | d-owner lti.db owner | d-owner |
| 10 | d-mountpoint root plant | d-mountpoint |
| 11 | d-mountpoint file case | d-mountpoint |
| 12 | d-mountpoint link case | d-mountpoint |
| 13 | d-content-folder unsafe case | d-content-folder |
| 14 | identityCase (f-pairid, f-identity-missing, f-db-without-identity, f-project, f-project-invalid, f-half-pair, f-half-pair-none) | f-pairid, f-identity-missing, f-db-without-identity, f-project (2), f-half-pair (2) |
| 15 | e-not-same-import legacy copies | e-not-same-import |
| 16 | g-quarantine-in-use QA container | g-quarantine-in-use |
| 17 | e-hot-journal legacy journal | e-hot-journal |
| 18 | e-old-layout QA decoy | e-old-layout |
| 19 | e-changed-byte legacy byte | e-changed-byte |
| 20 | e-added-wal legacy WAL | e-added-wal |
| 21 | e-content-missing package folder hold | e-content-missing |

Naming correction (C-1): the site-14 calls are the seven `identityCase` labels above; the count stays 21 sites / 27 injections.

## 7. Copy and write sites (§7.2, V4-1)

"Hook" means a creation hook saw an empty 0600 regular file whose device and inode equal the final file.

| Site | Code | Creation evidence | Final-mode evidence |
|---|---|---|---|
| #1 | fixture `stash` | hook, umask 022 and 000 | 0600; source mode recorded only |
| #2 | fixture `unstash` | hook | V4-2: recorded mode (umask 022 and 077) |
| #3 | fixture `copyOut` | hook | 0600; returned mode = source mode |
| #4 | `logicalRead` (container and host) | hook under the caller's `scratchBase`; no default | 0600; IN-4: the container uses its own temporary folder |
| #5 | fixture plant `copy` | hook | V4-2 |
| #6 | fixture plant `write`, `editjson` | hook; editjson temporary is the final inode | V4-2 |
| #7 | oracle-B negative copy | not observable (child process); V4-9 static | 0600 under umask 022 and 000 |
| #8 | `LegacyFixtures.place` | hook | 0600 |
| #9 | `copyCredentials` (`privateReplace`) | hook, five exclusive creates | 0600 |
| #10 | `backupLogical` | hook, lane scratch only (umask 022 and 000) | 0600 |
| #11 | `storagePaths` scratch read | hook; no default scratch folder | 0600 |
| #12 | `privateCopyTree` of B | — | 0700 folders, 0600 files; a link fails; 8 damaged copies checked in V7-1 |
| #13 | `privateCopyTree` in migration | — | 0700 folders, 0600 files (`m1-migration.selftest.mjs`) |
| #14 | `configDiff` captures | `privateEmptyFile`, lstat before and after the shell | swap, fill or new inode stops before the shell or before any read |
| #15 | `writeMarker` | `wx`, 0600 | never replaces an existing path (V4-6) |
| #16 | `writeHandoff` | exclusive create | 0600, one link; a second write fails `EEXIST` (V8-1) |

## 8. Controls

All controls are host-only self-tests (`HARNESS ONLY`). Each QA control id of the triage V1–V8 table, and IN-4, SD-1 and
LD-1…LD-3, has at least one named mutant in section 9. Two exceptions: V1-5 is an Author control of the product lock
script, outside this harness; V4-9 holds its own mutations (one token at each site #1–#16, a new module, a self-test
module, a default `scratchBase`, a self-test import, a match in a comment), each on a temporary copy. The final complete
suite (section 10) ran every control below.

| Group | Controls (self-test names, shortened) | File |
|---|---|---|
| V1 | V1 a-serialize verdict (offset, pgid, own command, later start, wait owner, one release, schema, clock lo/hi, truncation); V1-7 wait end; clock samples sub-ms; V1-12 actual npm path; V1-8 unidentified run waits for the backup end | `storage-oracle.selftest.mjs`, `storage-rows.selftest.mjs` |
| V2 | V2-1 strict listing; V2-2 `meta` lstat only; V2-3 stack:up failure order; V2-4 failed root restore; V2-5/V2-6 unrelated change, plant without effect; V2-7 restore only when stopped and locked; V2-8 27 injections; V2-9 seed needs; V2-10 partial and time-out plants | `storage-fixture-script.selftest.mjs`, `storage-rows.selftest.mjs` |
| V3 | V3-1 Origin on every portal and app write, none on GET; V3-2 Origin predicate refuses the LTI URL, a trailing slash, another port | `storage-lane.selftest.mjs` |
| V4 | V4-1 sites #1–#16 (umask 022 and 000); V4-2 recorded modes (umask 022 and 077) and identityCase/d-symlink modes; V4-3 data areas; V4-4 outside classes; V4-5 bin rule; V4-6 markers; V4-7 hit record and bounded correction; V4-8 private empty files and R2-01; V4-9 token inventory and 16 site mutations; V4-10 root closure; helper contracts; IN-4 | `storage-private-copy`, `storage-private-scan`, `storage-lane`, `storage-rows`, `storage-compat-route`, `storage-source-inventory` (`.selftest.mjs`) |
| V5 | V5-1 P-1a `lane not fresh`; V5-2/V5-3 child deletion, kept P, unsafe case; V5-4 link or file child BLOCKED | `storage-rows.selftest.mjs` |
| V6 | V6-1 segments before each reset and at phase end (in V7-1); V6-2 absence claim BLOCKED without a segment | `storage-rows.selftest.mjs` |
| V7 | V7-1 full 70-row SEQUENCE against the declared expectation map, in both directions; one scan after each of the 81 SEQUENCE steps (70 rows, 11 fixtures); 29 restores at 21 sites | `storage-rows.selftest.mjs` |
| V8 | V8-1…V8-4 handoff binding; V8-5 full-mode recorder (two rounds); V8-6 diagnostic run-or-stop (a)–(f), teardown and W4 always | `storage-handoff.selftest.mjs`, `storage-diagnostic.selftest.mjs` |
| SD-1 | migration and snapshot scan points; a 0644 product file FAILs at its point; `scanAt` | `m1-migration.selftest.mjs` |
| LD-1…LD-3 | kept containers (positives per role, four negatives); per-command stale records; tamper names, pairs and root journals (M1 declared negatives, row-level injections) | `storage-lane.selftest.mjs`, `storage-rows.selftest.mjs` |

Declared expectation map of V7-1: every row PASS, except `c-host-negative` NOT_APPLICABLE ("QA oracle shows enforcement on
this host; probe exit 0; reported apart, never counted as PASS") and `a-lock-scope` FAIL ("test:acceptance with the QA
storage case: expected exit 0, got 1"; the mock lane does not model those lock pairs). A mock map is not a product result.

## 9. Mutation campaign

Driver `bin/mutate.py` (private root): each mutant is an exact text edit on a fresh private copy of `tests/host`, never on
the worktree. A mutant is DETECTED only when its named control fails on the copy, and that control first passes on an
unmutated copy (baseline). Outer umask 077, child umask 022, fail-closed Docker stub first on `PATH`, `TMPDIR` inside the copy.

Runs:

| Run | Mutants | Result |
|---|---|---|
| m1 | 133 (catalog `bin/catalog.py`) | 128 DETECTED, 4 NOT DETECTED, 1 baseline BLOCKED (M1-12a: a copy has no git checkout, so V1-12 BLOCKs as designed) |
| m1-v112 | V1-12 baseline and M1-12a, each in a private no-checkout clone (`--no-hardlinks`, HEAD detached at `5f18477`) | baseline PASS; M1-12a DETECTED |
| m1b | 2 siblings of M8-4d in `windowCause` | M8-6c DETECTED (RangeError only), M8-6d NOT DETECTED |
| fixcheck | the proposed test-only fixes with and without the five gap mutants | with the fix the held code passes V8-4, V8-6 and LD-3; M8-4d, M8-6d, M-LD3c and M8-6c, M-LD3a/b/d/e DETECTED |
| m2-focused | the 22 V8 and LD-3 mutants of m1 and m1b, on the committed bytes of `71a5bf9` | 22 DETECTED |

Detection mode: A = the control's own assertion; G = a runtime guard of the harness under test refuses (`StorageFail`);
E = a fail-closed error (named in the row).

Initial results (runs m1, m1-v112, m1b, before amendment A-1):

| Mutant | Control | Run | Verdict | Mode | First cause (shortened) |
|---|---|---|---|---|---|
| M1-1a | V1-1 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: null` |
| M1-1b | V1-1 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: null` |
| M1-1c | V1-1b | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:` |
| M1-2 | V1-2 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:` |
| M1-3 | V1-3 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:` |
| M1-4a | V1-4 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:` |
| M1-4b | V1-4 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:` |
| M1-6a | V1-6 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:` |
| M1-6b | V1-6 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:` |
| M1-7 | V1-7 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Not before the sign of this run` |
| M1-8a | V1-8 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:` |
| M1-8b | V1-8 wait | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: The row waited for backup.done: the last output line is saved` |
| M1-9 | V1-9 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:` |
| M1-10a | V1-10 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:` |
| M1-10b | V1-10 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:` |
| M1-11 | V1-11 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:` |
| M1-12a | V1-12 | m1 | BASELINE BLOCKED (copy has no git checkout; V1-12 BLOCKED as designed) | — | — |
| M1-12a | V1-12 | m1-v112 (private clone) | DETECTED | A | `acquire pgid 9888 is not the spawned pgid 10389` |
| M1-13 | V1-13 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:` |
| M1-14 | V1-14 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:` |
| M1-15 | V1-15 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:` |
| M1-16 | V1-16 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: storage/a-serialize-backup.log through saveText` |
| M2-1a | V2-1 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Missing expected exception: listRoot fails with EACCES for packages` |
| M2-1b | V2-1 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Missing expected exception: listRoot fails with EACCES for packages` |
| M2-2 | V2-2 | m1 | DETECTED | E | `Error: EACCES: permission denied, scandir '<copy>/packages'` |
| M2-3a | V2-3 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: stack:up: expected exit 0, got 1 \| duration 0 s` |
| M2-3b | V2-4 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: The first cause stays the body cause` |
| M2-4a | V2-4 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:` |
| M2-4b | V2-4 | m1 | DETECTED | E | `TypeError: Cannot read properties of undefined (reading 'status')` |
| M2-5 | V2-5 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:` |
| M2-6 | V2-6 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: duration 0 s` |
| M2-7a | V2-7 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:` |
| M2-7b | V2-7 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:` |
| M2-9a | V2-9 | m1 | DETECTED | E | `TypeError: Cannot read properties of undefined (reading 'status')` |
| M2-9b | V2-9 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: The first seed needs only a-fresh` |
| M2-10 | V2-10 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: QA fixture plant failed: injected: the plant failed after packages \| duration ` |
| M3-1 | V3-1 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: POST https://app.qa-lane.test:8443/app-api/session: Origin undefined` |
| M3-2a | V3-2 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: POST https://app.qa-lane.test:8443/app-api/connections: Origin https://lti.qa-` |
| M3-2b | V3-2 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: POST https://app.qa-lane.test:8443/app-api/connections: Origin https://app.qa-` |
| M3-2c | V3-2 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: POST https://app.qa-lane.test:8443/app-api/connections: Origin https://app.qa-` |
| M2-8-s01 | V2-8 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Each injection stops the phase with 70 results: [["c-host-negative scratch",["` |
| M2-8-s02 | V2-8 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Each injection stops the phase with 70 results: [["a-restart-refusal planted e` |
| M2-8-s03 | V2-8 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Each injection stops the phase with 70 results: [["a-lock-stale case 2 QA proc` |
| M2-8-s04 | V2-8 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Each injection stops the phase with 70 results: [["a-lock-stale case 4 stub gr` |
| M2-8-s05 | V2-8 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Each injection stops the phase with 70 results: [["i-candidate-guard override ` |
| M2-8-s06 | V2-8 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Each injection stops the phase with 70 results: [["d-stale near-match",["d-sta` |
| M2-8-s07 | V2-8 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Each injection stops the phase with 70 results: [["d-unknown notes.txt",["d-un` |
| M2-8-s08 | V2-8 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Each injection stops the phase with 70 results: [["d-symlink link and WAL stas` |
| M2-8-s09 | V2-8 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Each injection stops the phase with 70 results: [["d-owner lti.db owner",["d-o` |
| M2-8-s10 | V2-8 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Each injection stops the phase with 70 results: [["d-mountpoint root plant",["` |
| M2-8-s11 | V2-8 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Each injection stops the phase with 70 results: [["d-mountpoint file case",["d` |
| M2-8-s12 | V2-8 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Each injection stops the phase with 70 results: [["d-mountpoint link case",["d` |
| M2-8-s13 | V2-8 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Each injection stops the phase with 70 results: [["d-content-folder unsafe cas` |
| M2-8-s14 | V2-8 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Each injection stops the phase with 70 results: [["identityCase f-pairid",["f-` |
| M2-8-s15 | V2-8 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Each injection stops the phase with 70 results: [["e-not-same-import legacy co` |
| M2-8-s16 | V2-8 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Each injection stops the phase with 70 results: [["g-quarantine-in-use QA cont` |
| M2-8-s17 | V2-8 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Each injection stops the phase with 70 results: [["e-hot-journal legacy journa` |
| M2-8-s18 | V2-8 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Each injection stops the phase with 70 results: [["e-old-layout QA decoy",["e-` |
| M2-8-s19 | V2-8 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Each injection stops the phase with 70 results: [["e-changed-byte legacy byte"` |
| M2-8-s20 | V2-8 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Each injection stops the phase with 70 results: [["e-added-wal legacy WAL",["e` |
| M2-8-s21 | V2-8 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Each injection stops the phase with 70 results: [["e-content-missing package f` |
| M4-1a | V4-1 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Hook for <copy>/lti.db` |
| M4-1b | V4-1 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Hook for <copy>/lti.db` |
| M4-1c | V4-1 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Created empty 0600: <copy>/lti.db` |
| M4-1d | V4-1 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Inside the lane scratch/: <copy>/lti.db` |
| M4-1e | V4-1 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Missing expected rejection: No default scratchBase` |
| M4-2a | V4-2 (B-SR-05) | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: unstash: the recorded original mode` |
| M4-2b | V4-2 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:` |
| M4-2c | V4-2 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:` |
| M4-3 | V4-3 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: out/x/pkg/index.html` |
| M4-4 | V4-4 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: The scan point includes the outside classes` |
| M4-5a | V4-5 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: A second file` |
| M4-5b | V4-5 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: A changed digest` |
| M4-6a | V4-6 | m1 | DETECTED | G | `StorageFail: QA marker file has mode 0600: qa.txt` |
| M4-6b | V4-6 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Missing expected exception.` |
| M4-7a | V4-7 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: link refused` |
| M4-7b | V4-7 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: The other inode is unchanged` |
| M4-7c | V4-7 | m1 | DETECTED | E | `Error: ENOENT: no such file or directory, open '<copy>/cogniate.db'` |
| M4-7d | V4-7 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: The step FAILs` |
| M4-8a | V4-8 (R2-01) | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Missing expected exception.` |
| M4-8b | V4-8 (R2-01) | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: The folder and the file are kept` |
| M4-8c | V4-8 (R2-01) | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: The folder and the file are kept` |
| M4-8d | V4-8 | m1 | DETECTED | G | `StorageFail: Capture files are not private: args before the shell: mode 0644; env before the shell: mode 0644` |
| M4-8e | V4-8 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Missing expected exception: A target that exists before the create fails` |
| M4-8f | V4-8 (expected equivalent) | m1 | NOT DETECTED | — |  |
| M4-8g | V4-8 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: The validation function is expected to return "true". Received false` |
| M4-8h | V4-8 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: The validation function is expected to return "true". Received false` |
| M4-10a | V4-10 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: a:` |
| M4-10b | V4-10 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: d:` |
| M5-1 | V5-1 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: infra/.data/cogniate-app mode 0700, host user \| lane not fresh: infra/.data/co` |
| M5-2a | V5-2 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: The old packages inode exists nowhere in the clone or the private root` |
| M5-2b | V5-2 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: P has the same device, inode, owner, group and mode \| unsafe case cleanup: upl` |
| M5-3a | V5-3 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: A listing of each child before its deletion` |
| M5-3b | V5-3 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: cleanup d-content-folder unsafe case failed: EEXIST: file already exists, mkdi` |
| M5-4a | V5-4 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: uploads` |
| M5-4b | V5-4 (expected masked by the safety check) | m1 | NOT DETECTED | — |  |
| M6-1a | V6-1 | m1 | DETECTED | E | `TypeError: Cannot read properties of undefined (reading 'includes')` |
| M6-1b | V6-1 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Segment before b-sequence-reset-1` |
| M6-2 | V6-2 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: A missing segment before a reset` |
| M7-1a | V7-1 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:` |
| M7-1b | V7-1 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Observed statuses and first causes equal the declared map; failed fake command` |
| M7-1c | V7-1 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: One result for each of the 70 row ids` |
| M7-1d | V7-1 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: a-fresh needs d-clean, which runs before it` |
| M7-1e | V7-1 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Observed statuses and first causes equal the declared map; failed fake command` |
| M7-1f | V7-1 (R2-02) | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Observed statuses and first causes equal the declared map; failed fake command` |
| M7-1g | V7-1 (R2-02) | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Observed statuses and first causes equal the declared map; failed fake command` |
| M8-1a | V8-1 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Missing expected exception: A second write to the same path fails` |
| M8-1b | V8-2 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: handoff check failed: clone: birth time is not inside the window (w ≤ birthtim` |
| M8-2a | V8-2 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: BLOCKED expected` |
| M8-2b | V8-5 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: w is after the previous child ended and before the migration child (1792598842` |
| M8-3a | V8-3 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: BLOCKED expected` |
| M8-3b | V8-3 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: BLOCKED expected` |
| M8-3c | V8-3 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: handoff check failed: backup root: not next to the clone` |
| M8-4a | V8-4 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: BLOCKED expected` |
| M8-4b | V8-4 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:` |
| M8-4c | V8-4 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: BLOCKED expected` |
| M8-4d | V8-4 | m1 | NOT DETECTED | — |  |
| M8-5b | V8-5 | m1 | DETECTED | E | `Error: EEXIST: file already exists, open '<copy>/handoff.json'` |
| M8-5c | V8-5 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: The phases, their order and the arguments` |
| M8-6a | V8-6 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: row` |
| M8-6b | V8-6 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: row: the owned teardown and strict W4 run` |
| M-IN4 | IN-4 | m1 | DETECTED | E | `Error: Command failed: <copy>/node --no-warnings <copy>/storage-fixture-script.mjs logical --lti <copy>/ltidb ` |
| M-SD1 | SD-1 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:` |
| M-LD1a | LD-1 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Missing expected rejection: A kept id is not permitted in another row` |
| M-LD1b | LD-1 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Retired after its removal` |
| M-LD1c | LD-1 | m1 | DETECTED | G | `StorageFail: No QA container remains after its run` |
| M-LD1d | LD-1 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Missing expected rejection: An unexpected remaining id` |
| M-LD2a | LD-2 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: orphan-transient-reclaim` |
| M-LD2b | LD-2 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: A rename` |
| M-LD3a | LD-3 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Only the root journals change; a moved file inside its volume keeps its name a` |
| M-LD3b | LD-3 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: An added nested journal` |
| M-LD3c | LD-3 | m1 | NOT DETECTED | — |  |
| M-LD3d | LD-3 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:` |
| M-LD3e | LD-3 | m1 | DETECTED | A | `AssertionError [ERR_ASSERTION]: Each root journal gives its own result` |
| M8-6c | V8-6 (window end form) | m1b | DETECTED | E | `RangeError: Invalid time value` |
| M8-6d | V8-6 (window end form, NaN guarded) | m1b | NOT DETECTED | — |  |

### 9.1 Not detected, and their dispositions

Initial result: 130 of 135 named mutants DETECTED. The five NOT DETECTED results stay in the record (`mutants/run-m1/results.json`
SHA-256 `27b1afd6…`, `mutants/run-m1b/results.json` SHA-256 `c52923bd…`; amendment A-1 lists all evidence hashes).

| Mutant | Change | Evidence | Status |
|---|---|---|---|
| M4-8f | `privateEmptyFile` opens with `O_CREAT\|O_EXCL` without `O_NOFOLLOW` | POSIX: `O_CREAT\|O_EXCL` never follows a final link. Probe `mutants/probe-m48f/result.json` (darwin, node v24.21.0): `EEXIST` for a dangling link, a link to a file and a link to a folder, with and without `O_NOFOLLOW`; each target unchanged. | NOT DETECTED. Proposed equivalent on the measured host; `O_NOFOLLOW` stays as defense in depth. Final disposition waits for the independent reviews (Lead `msg_ad4b0832186b`). |
| M5-4b | `deleteChild` removes `realpath(child)` | Probe `mutants/probe-m54b/result.json`: in isolation the mutant deletes the link target, the held code removes only the link. In the harness `safe()` runs synchronously before each `deleteChild`, with no `await` and no lane call between them (`storage-rows.mjs` lines 743→747 through the synchronous start of `guarded()`, 770→772); V5-4 shows that `safe()` BLOCKs a link or file child (M5-4a DETECTED). | NOT DETECTED. Proposed masked by the synchronous precheck, under the premise that both services are positively stopped and no other writer acts in the gap. Not accepted as detected and not waived; both reviewers assess the probe and the concurrency premise. |
| M8-4d | `checkHandoff` without the `WINDOW_FORM` test | The four V8-4 wrong-window values were also refused by the later round-trip check. `-000001-01-01T00:00:00.000Z` is a valid `toISOString()` time but not the exact form of §9.1. | Control gap. Fixed by amendment A-1 (one V8-4 line); DETECTED after the fix. |
| M8-6d | `windowCause`: form test replaced by a NaN guard | The same gap for the window end: `+010000-01-01T00:00:00.000Z` round-trips, is far in the future and is not the exact form. (M8-6c, the plain removal, was DETECTED only by a RangeError.) | Control gap. Fixed by amendment A-1 (one V8-6 value); DETECTED after the fix. |
| M-LD3c | LD-3 name without the volume | Probe `mutants/probe-ld3c/result.json`. My control case "A move across volumes keeps no name" also dropped `.previous-<opId>/lti.db`, so it was a deletion plus a move, and the mutant caught it as a deletion. | Construction error in my control. Fixed by amendment A-1 (a pure move, `slice(1, 4)`); DETECTED after the fix. The LD-3 reading (a name keeps the volume) stays as granted in `msg_df38477e48e2`. |

### 9.2 Amendment A-1 and the focused rerun

Lead grant `msg_ad4b0832186b`: only three one-line self-test changes, no runtime module change. I froze the private
amendment `map/amendment-A1.md` (SHA-256 `e377fc260c1cd1924675ca22e5a0ce661123a1ee59d64b458cccd0b7928ad8a3`) with the exact
changes, the survivor evidence and the pre-edit hashes before the edits. The Lead committed the three paths at
`71a5bf92608f8ee20e81363a0be987474fc59859` (tests tree `d574737219dffadb4447968bb0cc06393e61e5b9`).

- Fix check before the edits (`run-fixcheck`, private copies): with the fix, the held code passes V8-4, V8-6 and LD-3;
  M8-4d, M8-6d and M-LD3c are DETECTED by assertion; M8-6c and M-LD3a/b/d/e stay DETECTED. Each edited file is byte-equal
  to its fix-check copy.
- Focused rerun on the committed bytes (`run-m2-focused`; every baseline copy equals `71a5bf9`): all 22 V8 and LD-3
  mutants of runs m1 and m1b DETECTED (20 by assertion; M8-6c still by RangeError; M8-5b by EEXIST).

Result after the fix: 133 of 135 DETECTED; M4-8f and M5-4b stay NOT DETECTED with the proposed dispositions above.

### 9.3 Detected, with a note

- M2-7a: detected only by the restore-note cause (self-test line 1308). The volume effect is the same, because
  `StorageLane.container` also refuses a root write while the services run (a second guard).
- Mode E detections are fail-closed, but not a clean control assertion: M2-4b, M2-9a, M6-1a (TypeError in the control on
  a missing row, record or segment file), M4-7c (ENOENT: the corrected file is gone), M8-5b (EEXIST: the second round's
  exclusive handoff create), M2-2 and M-IN4 (EACCES: the intended mechanism of the control), M8-6c (RangeError).

## 10. Complete host self-test suite

Command (private runner `bin/run-suite.sh <label> <child umask> <tests/host>`): outer umask 077; then in a subshell
`umask <mask>; cd tests/host; env TMPDIR=<root>/tmp/<label> QA_DOCKER_STUB_LOG=<root>/logs/<label>-docker-calls.log
PATH=<root>/stub/bin:$PATH node --test --test-reporter=tap <every *.selftest.mjs>`. The `.meta` file of each run records
node, npm, the resolved `docker` path, the SHA-256 of each test file, the counts, the stub calls and the TMPDIR residue.

| Run | Tree | Child umask | Tests | Pass | Fail | Stub calls | TMPDIR left |
|---|---|---|---|---|---|---|---|
| baseline-4c7e067-u022 | original tests tree `4c7e067` | 022 | 48 | 48 | 0 | 0 | 0 |
| baseline-4c7e067-u077 | original tests tree `4c7e067` | 077 | 48 | 47 | 1 | 0 | 0 |
| full1-u077 | repaired, before the LD-2/LD-3 grant | 077 | 101 | 99 | 2 | 0 | 0 |
| full1-u022 | repaired, before the LD-2/LD-3 grant | 022 | 101 | 99 | 2 | 0 | 0 |
| postgrant-u077 | held bytes of `5f18477` | 077 | 105 | 105 | 0 | 0 | 0 |
| postgrant-u022 | held bytes of `5f18477` | 022 | 105 | 105 | 0 | 0 | 0 |
| final-u077 | `71a5bf9` (tests tree `d574737`) | 077 | 105 | 105 | 0 | 0 | 0 |
| final-u022 | `71a5bf9` (tests tree `d574737`) | 022 | 105 | 105 | 0 | 0 | 0 |

- The baseline u077 failure ("Mode kept", the planted-changes test) is an artifact of the child umask in the original test
  setup; the repaired self-test sets the mode explicitly with `chmod 0640`.
- The full1 failures are V7-1 and V2-8, caused by LD-1…LD-3 (section 5). They stay in the record.
- Final runs: 16:19:30Z–16:32:31Z. Each of the 11 changed or new self-test files has the SHA-256 of section 3 in both
  `.meta` files. Every runtime module was last written at or before 15:42:53Z, every self-test at or before 16:17:08Z.
- These are self-checks of my own harness, not independent runtime QA.

## 11. V1-12 record (actual npm path, fail-closed Docker stub)

- Path: `npm run stack:data-backup -- --out <probe>/out`, started through the harness `spawnGroup` (own process group), in a
  probe copy of the committed `package.json` and `infra/` of the candidate SHA (`git archive`; no `.env`, no working-tree bytes).
- Candidate: the test resolves `HEAD` once per probe and records it. Recorded candidates: `dac55476f3146c21e6199382250a34ed13f725f1`
  (postgrant-u077), `54600e86c01b7e2e2065b1b3d42fbcc8f5f7fd72` (postgrant-u022), `5f184771d835fcf03701053c6b11a00ec7f0ccf3`
  (mutation run m1-v112, private clones), `71a5bf92608f8ee20e81363a0be987474fc59859` (final-u077) and
  `f663d1d94d2c8445f74341681262be59c9dd204d` (final-u022). The Lead made docs-only commits between probes, so the
  resolved `HEAD` moved. Every recorded candidate includes `9f8ac625443931242edd8da301c3d4f0d3e34290`, and `package.json`
  and `infra/` are byte-equal in all of them (`git diff` empty; tree `infra` `d4625250f391bb43fbba57a05c86a13c28ba7e61`).
- npm `11.19.0`, node `v24.21.0`.
- Environment rule: no `npm_*` key in any case (asserted); `COMPOSE_PROJECT_NAME=qa-v112-<6 hex>`; `TMPDIR` = the probe folder.
- npm network checks off only through a scratch `<copy>/.npmrc` (mode 0600, created `wx`): `update-notifier=false`,
  `fund=false`, `audit=false`. The candidate archive has no `.npmrc` (asserted). `npm config get update-notifier` gives `false`.
  The SHA-256 of the real `~/.npmrc` is equal before and after (or the file is absent both times).
- Docker: `command -v docker` resolves to the probe stub first on `PATH`. The stub records each call and answers exit 97.
  Result: one `storage_lock_acquired` event with the spawned pgid and `stack:data-backup`; one stub call, made while the lock
  was held and after the acquire line; the command exits 1; no lock folder remains.
- The decision discriminates: another acquire command, a pgid that does not survive the npm hop, a success answer and a call
  before the acquire each give a problem.
- The lock log has no `storage_lock_released` line after the refused Docker call. This matches the documented silent
  A6 error release (ADR-012 O-1, revision 3.6). The V1-12 decision does not use a release line.

## 12. No real Docker

- Every suite and mutation run puts the fail-closed stub `stub/bin/docker` (exit 97, records each call) first on `PATH`.
  The stub makes its log file only when it is called. Recorded calls: 0 in every suite run (baseline, full1, postgrant, final) and in every mutation run (m1, m1b, m1-v112,
  fixcheck, m2-focused).
- V1-12 adds its own probe stub before that; its calls are recorded in the probe and checked (one call, answer 97).
- No real migration or storage child ran. The diagnostic driver ran only with recorded stub children (V8-5, V8-6).
- No network access by design: the lane self-tests use loopback HTTPS servers that the test makes, and the V1-12 probe
  turns off the npm network checks (section 11). I did not capture network traffic.

## 13. Limits and open items

- No acceptance credit. The mock lane is QA's model of the product. W1–W4 and G1 are outside this work.
- `appdb` tamper is not covered by LD-3 (Lead direction; disclosed).
- Site #7 creation hook is not observable (child process); final mode and the V4-9 inventory cover it.
- IN-3: the publication of scan records in the `run-m1.mjs` `finally` block is not tested dynamically. The diagnostic driver
  fails closed when the record is missing or incomplete (V8-6).
- The diagnostic CLI branch of `run-m1.mjs` (`--phase diagnostic`) did not run; `diagnosticRun` ran with recorded stubs.
- A-SRR-08: the V4-9 text inventory cannot see an aliased or computed call. The runtime modules use none; the source reviews
  must check this.
- `a-lock-scope` is a declared mock FAIL in the V7-1 map (the mock lane does not model the lock pairs of test:acceptance);
  `c-host-negative` is declared NOT_APPLICABLE (the QA oracle shows enforcement on this host).
- The mutation copies are not git checkouts. A V1-12 mutant needs the private clone layout of `bin/mutate-v112.sh`.
- The two source reviews come before any diagnostic. The diagnostic needs a Lead-granted exclusive Docker window.
- Unrelated process: a `node --test … tests/host/m1-control.selftest.mjs` process (pid 64140) ran for more than 9 hours on
  this host. I did not start it and did not touch it.

## 14. Deviations

- D-1 (hygiene): one scratch copy made with `cp -p` kept mode 0644 (repo source text) until I set 0600; npm compile-cache
  folders (0755) appeared inside a 0700 probe folder before the probe set `NODE_DISABLE_COMPILE_CACHE=1`; one failed draft
  left 000 folders in its TMPDIR, which I restored and removed.
- D-2 (hygiene, found by my final manifest): six files were created at 0644, not 0600: three summary logs and
  `work/hold-hashes.txt` (outer shell commands without `umask 077`), and the two `run.log` files of `bin/mutate-v112.sh`
  (a redirect inside the umask-022 child). They hold hashes, counts and test output, no secret. I set them to 0600, set
  the two D-1 compile-cache folders to 0700, and recorded this in `map/clarifications.md` (SHA-256 `001cc9fb…`).
- C-3 (late messages): five Lead messages reached me late because my first delivery batch stayed unacknowledged. I applied
  them when I read them. Earlier V1-12 runs with `NPM_CONFIG_*` keys are superseded history.

## 15. Evidence and hold

- Private QA root: `/Users/quangnguyen/cogniate-qa-runs/storage-harness-repair-qa-20261021T1356Z` (0700). Manifest of every
  entry (type, mode, owner, size, SHA-256): `evidence/manifest-final-2.tsv`, SHA-256 `7fc238d9b8b84807441d3487e459523535f39b55be37b3ee281ab5b237343c46`, 11985
  entries. Modes: 924 folders 0700; 11027 files 0600; 34 files 0700 (6 executables in `bin/` and `stub/bin/`, and 28 git
  hook samples, never run, in the two private clones). The first manifest `evidence/manifest-final.tsv` (`ddaed2c0…`)
  records the six 0644 files and two 0755 folders that I then corrected (deviation D-2).
- Key files: `map/control-map.md` (`bf47ec74…`, frozen before any source read), `map/clarifications.md`,
  `map/amendment-A1.md` (`e377fc26…`), `evidence/latent-defects-v7-1.md` (`e061d44d…`), `logs/*.meta` and `*.tap` of each
  suite run, `mutants/run-*/results.json`, `mutants/probe-*/result.json`, `bin/` (runner, mutation driver, catalogs).
- I hold this report and the 21 paths of section 3. I ask the Lead for an exact-path commit of this report. I do not
  commit, push or merge.

## Round 2

Round 2 verdict: PASS (host self-checks of the Round 2 harness repair only)

Scope of this verdict: the bounded repairs A-SH-01 to A-SH-05, the Lead bindings G-1 to G-8, the LD-2 per-command lock check and the V8-6 owned-cleanup controls, checked host-only on the WIP source-review snapshot `c71912ff76965f60d92d964ac0bccf5337f59771` (tests tree `183a72b2fea5ff065fc57c96649199bc720fb6e0`). It is not runtime QA. It gives no acceptance credit, no candidate C and no closure of the independent source reviews. I observed no new source fault. The prior Reviewer-A and Reviewer-B findings stay open until their independent closure. The Round 1 section above stays unchanged.

Task `task_d018895ca985`, dispatch `ctx_898acbaef3a6`, run `run_ebe671ad72a9`. Role: QA harness repair owner, Round 2 (fresh instance; sole QA editor). Model: Claude Code Opus 5.5 (`claude-opus-5-5`), xhigh. Date: 2026-10-21 (UTC).

### R2.1 Provenance and independence

- Before the map I read only the charter, triage `2d763fe` (SHA-256 `ade4e8a0…`, verified), M1 `a60ba4a` (SHA-256 `ac444799…`, verified), ADR-012 §7, §11 and §15, and the phase plan. I read no implementation source and no report before the map was frozen.
- Frozen map: `map/CONTROL-MAP.md` (`6e28a020c3c702f09894b82d335486bc3620bff74164263801d664152cd68f8a`). Lead grant `msg_c671d53d5d30`. Amendments, each frozen and sent before the edits that it covers: A-01 `34864741797fb9e9bc6a1e5abf2d5dfe395e839e5701cebed63828db887bdc58`, A-01b `39ad4463c48f1baed617caac9aa4e0d29dd9e13b6769cd9cc50d4b2697b45c0b`, A-02 `d28455496254693386a52263e2371081a153a67039a56e5a35f7709e2ed958ab`, A-03 `fe69065ec37aca14a00e0a5cc1fb3d996a991d811aa09c0f98b2f076d83e2599`, A-04 `e3d4a464c8a8623643393405e5736bebba67f6a18d2b159500e9df354b7712c3`. They record errata of my own: future end times in two headers (E-1, E-4), two conditional paths not three (E-2), and a withdrawn absolute race claim (E-5).
- After the grant I read the target source, the Round 1 QA report, and (read only) the Round 1 private catalog and runner. I read no reviewer report. The bindings G-1 to G-8, N1-N5, NB-1 to NB-4 and the LD-2/V8-6 items came to me as Lead messages; I did not read the reviewers' files.
- All repository edits were made by an exact anchored applier (`bin/apply-edits.py`; every anchor must occur exactly once). The same self-test edit specifications were applied to a private S3 baseline tree.

### R2.2 Changed paths

The Lead committed exactly these 11 paths at `c71912f`; each blob equals my held SHA-256 (`evidence/held-hashes-2.txt`). This report is the 12th path.

| Path | SHA-256 |
|---|---|
| `tests/host/storage-private-scan.mjs` | `d66b442306b15ea8dcb28cccc4b29e145ed60c259fa580038fa6e98d315aa278` |
| `tests/host/storage-private-scan.selftest.mjs` | `d556d6b64e15b6163ee7e432f8edc5fc4ed102535dab3c62fd134d6e6063b9cd` |
| `tests/host/storage-lane.mjs` | `23c03a87ffd7a81a2deb19e71b3b0e4dfc9aca04943978e845ea3da8565270d2` |
| `tests/host/storage-rows.mjs` | `c2934448d422817d8f9e33242fc7c369c7d4f97464ef36c6d15b62bd7022c83b` |
| `tests/host/storage-rows.selftest.mjs` | `25e3b6f90f749b3ad7ed240e049cd2350edec50676f08ea320f9223a0e9fd50c` |
| `tests/host/storage-fixture-script.mjs` | `49c76c9f9bd489efc4791786518bcecc637c9562986cfb3739f35e65dd258842` |
| `tests/host/storage-private-copy.selftest.mjs` | `42c673c1df99deaa329aaff4f754a65f1bebb17298b17716a13257fc9d27ab17` |
| `tests/host/m1-migration.mjs` | `c749a81bab147bc5c79a17bf4479f264666636e1be9bef6dbc88442bb6eac4bf` |
| `tests/host/m1-migration.selftest.mjs` | `6929d6216dec4beeeb0977ac43ef66028be51eec7a7c5f676471bc5adbdac5c9` |
| `tests/host/storage-source-inventory.selftest.mjs` | `8d8d88abe5362e7c6f86b2eb42fe274a929f8498a9a8fcd6e9b317cacd23f402` |
| `tests/host/storage-diagnostic.selftest.mjs` | `637a42182f4998fc654013d9e6e1b0e6fc5f6a50dcee5569303dbcc2c5074394` |

`storage-diagnostic.selftest.mjs` is the one extra path of Lead grant `msg_12f26a9f0379`. No product file, fixture input, manifest, row id or count, `core.mjs`, `storage-docker.mjs`, `storage-handoff.mjs`, `storage-diagnostic.mjs`, `storage-compat-route.mjs`, `run-m1.mjs` or architecture text changed. `pnpm-workspace.yaml` (untracked) is not mine and I did not touch it.

### R2.3 Repairs

| Item | Repair |
|---|---|
| A-SH-01 roots | `realChain` checks the base and every folder down to an area, extra root or scratch root with `lstat` (a real directory of the host user). A root that is missing, a link, not a directory or of another owner is not walked: problem `<area>: not scanned: <rel> (<reason>)`, no hit, no correction. `scanOutside` checks `infra`, `infra/.data` and every ledger parent the same way. A 0755 area of the host user still FAILs the closure and is still scanned (A-01b C-2). |
| A-SH-01 correction | Each hit keeps its folder chain (device and inode) from its base. Stage 1: the chain before the open; stage 2: the existing `O_RDONLY \| O_NOFOLLOW` open and `fstat` identity; stage 3: the chain again after the open and before `fchmod`; stage 4: the existing `fchmod` and re-check; stage 5: the chain and the path after the change (a late refusal that reports the recorded inode's mode). |
| A-SH-01/G-2 scratch | `removeScratch` scans from the lane private root down. A scratch folder that is not a real folder of the host user → `PhaseAbort`, nothing walked or removed. Immediately before `rmSync` it checks the recorded chain again (no `await` and no other I/O between that check and `rmSync`); a change → `PhaseAbort`, nothing removed. |
| A-SH-02/G-1 | `withScratch` keeps the body error as the thrown error and puts any removal error on it as `scratchCleanup`. `storagePhase` keeps the body cause first, adds `cleanup note: <removal message>`, sets the step FAIL (also from BLOCKED), and sets the abort state when the removal error is a `PhaseAbort`. After a scan hit, a FAIL or BLOCKED step keeps its first cause (the step becomes FAIL). |
| A-SH-03, LD-2 | `g-orphan-refusal` requires a non-null original lock record, and checks the lock record after each of the three commands (`<label>: the lock record is unchanged`). The final check stays. |
| A-SH-04 | V4-9 matches `from`, dynamic `import(` and a bare `import` of a `*.selftest.mjs` in either quote form. |
| A-SH-05 seams | #7: `QA_ORACLE_CREATE_OBSERVE` names an existing private file; only then the oracle-B child appends its creation record (`O_WRONLY \| O_APPEND \| O_NOFOLLOW`, no create). #12: `StorageLane` option `copyHook` (default `null`) at the four calls. #13: `migrationRun` option `copyHook` (default `null`); `run-m1.mjs` passes nothing. Unused, each seam leaves behavior and output unchanged (R2.6). |

### R2.4 S3 baselines (the old runtime with the new self-tests)

`src/s3-base` = `71a5bf9` tests with only the Round 2 self-test edits; its runtime modules equal `71a5bf9` (checked by hash). Summary: `evidence/s3-baselines.md` (`579238fb…`) and later runs `logs/s3-base*`. Each gap-specific control failed there for its stated reason: a linked area, extra root, migration root or private root was walked and T was set 0644 → 0600; a moved parent or outside parent let the correction change the moved file; a linked scratch folder was walked and gave no `PhaseAbort`; a scratch folder whose parent changed after the scan was deleted through the link; `withScratch` dropped the refused correction after a body error; a BLOCKED step lost its first cause to the scan cause; a BLOCKED body with a corrected or refused scratch hit stayed BLOCKED without a stop; a fixture or row scratch refusal after a body error did not stop the phase; the transient lock removal and the absent lock record let `g-orphan-refusal` PASS; the old V4-9 pattern missed a bare import (separate variant `src/s3-v49`); sites #7, #12 and #13 gave 0 creation records.

Limits and corrections (no gap credit for these):
- F-1 (A-02): the first R2-03-01 injection removed nothing, so the first S3 "gap shown" entry for R2-03-01 is withdrawn. F-2: QA's fake product did not model the ADR-012 §7 A6 refusal after a free-lock acquisition; I added that model to the fake (it cannot act in an uninjected run). Corrected evidence: on the old runtime the LD-2 test PASSes and the R2-03-01 test FAILs because the row wrongly PASSes; on `c71912f` both tests PASS because the row now FAILs with the required cause (`logs/s3-base2-r203-u022`, `logs/s5-focus3-r203-u022`).
- R2-01-04 fails on the old runtime first by the new problem text, so its later parts are not reached there. R2-02-06 "damage copy bytes" cannot be injected on the old runtime because it uses the new #13 seam. The existing LD-2 `orphan-lock-changed` case fails on the old runtime only because its expected first cause is now the earlier per-command text.

### R2.5 New controls (all `HARNESS ONLY: R2-…`)

| Control | File | What it proves |
|---|---|---|
| R2-01-01, -02, -02b, -03, -04, -05 | private-scan | normal root; each data area, `bin/` and the private root as a link; migration and snapshot roots, both legacy folders, `infra/.data` and a ledger parent as links; missing, file and other-owner roots; 0755 area; a nested link. T keeps type, mode, size, SHA-256, inode and ctime. |
| R2-01-06, -06b | private-scan | scratch folder or `scratch/` as a link, a file in its place, and a parent swap after the removal scan: `PhaseAbort`, nothing walked, corrected or deleted. |
| R2-01-07, -07o | private-scan | races through `scanPoint`: P (after the record), O (after stage 1, before the open), R (area moved), D, D-area, D-base (same inode under another real folder), L (after `fchmod`); outside ledger and legacy hits. Exact refusal per stage; `fchmod` 0 times, or exactly once in L; the open spy count shows both spies act; every other T entry unchanged. |
| R2-02-01, -02, -02b, -04/05 a/b, -05 row, -07a/b | rows | per-step refusal after a PASS, FAIL and BLOCKED step; fixture and row scratch refusal after a passing body and after a body error; a BLOCKED body with a corrected and with a refused scratch hit. Exact first cause, cleanup note, BLOCKED notes of every later row and fixture, no later product command, abort-path scan, phase-end segment, 70 results. |
| R2-02-05u | private-scan | `withScratch` unit: body error thrown, refusal carried. |
| R2-02-06 (5 tests) | m1-migration | refused corrections at the backup, damage-copy-bytes, phase-end and snapshot-backup scan points (`PhaseAbort`, record published, scan points up to the stop), and a `configDiff` body error with a refused scratch correction (body error first, record published). |
| R2-03-01, R2-03-02 | rows | absent original lock record; lock gone after each command; transient removal restored later. |
| R2-04 cases | source-inventory | three bare-import forms and five existing forms FAIL; a bare runtime import is allowed. |
| R2-05-07, -12, -13 (each at 022 and 000), R2-05-D | private-copy, rows, m1-migration | one creation record per written file: an empty 0600 regular file on the final inode, final 0600, folders 0700, the pinned umask on every record (child `sh` reports its umask for #7; in-process pinning with restoration for #12 and #13). |
| V8-6 cleanup variants | diagnostic | TEARDOWN FAIL, mixed, missing, unreadable → exact `storage NOT RUN` cause; no storage child; teardown and W4 once. |

### R2.6 Neutrality without the seams (A-03, strict comparator)

- Method: replayed shared synthetic inputs. #12: the real `g-damaged`, `h-nomanifest` and `h-old-manifest` procedures on a minimal fake lane with fixed B and X2 bytes and counter folder names; the record holds the three row results (all PASS), the product calls and every entry of B, X2 and the eight copies. #13: `mockMigration` with a fixed `backupId`. #7: the unhooked child. The relation method N1-N5 was not used and gets no credit; the earlier v1 comparison (`evidence/neutral/compare-base1-base2.json`) is a broad comparison only, kept as history.
- Comparator v4 `bin/neutral-compare-v4.py` (`0de0d348a16803a0f74116c815f509d592bd97989215ef397e3e579255cb3c9f`): strict whole-record equality; the only normalization is the child pid in the #7 copy name. v3 stays as history.
- Final runs bound to source: `v3-final-base` (runtime modules equal `71a5bf9`) and `v3-final-new2` (all 41 `tests/host` modules equal `c71912f`); inventories before and after each run (`evidence/neutral/final-*-inventory-{before,after}.json`); the self-test files are byte-equal in both trees. Result: equal (`compare-v4-v3-final-base-v3-final-new2.json`). Raw #12 record `e363d93a5b49cda4f22ab7c3f00d7e3d2753e800ed033d85eb9e72023acdb28b` and raw #13 record `7b68b242977024757b9f58353c51a932cae4f25ae76986be9061fb82b719c32c` are byte-identical in both trees. The four earlier v3 runs (two each) also compare equal under v4.
- No copy hook and no `QA_ORACLE_CREATE_OBSERVE` were set in these runs; the run environment had no `QA_` variable.

### R2.7 Mutation campaign

Catalog `bin/catalog-r2.py` (`3df0c49b…`), frozen and sent before the first run: 46 new mutants (`catalog-r2-new.py`, `20c7894b…`) and 24 Round 1 mutants on the changed surfaces, copied unchanged (`catalog-r2-round1.py`, `ca15dc76…`). Driver `bin/mutate.py` (`4f71150f…`): a fresh private copy of the held `tests/host` per mutant and per baseline, child umask 022, private HOME and TMPDIR, the fail-closed stub first on `PATH`. Every one of the 113 copies equals `c71912f` except exactly the files that its mutant edits (`evidence/mutant-copy-binding.json`). The worktree equalled `c71912f` before, during and after the runs.

Result: 70 of 70 DETECTED; 0 baseline failures, 0 SETUP ERROR, 0 Docker-stub calls, 0 TMPDIR left (`mutants/run-m1-{fast,rows-a,rows-b}/results.json`, summary `evidence/mutants-summary.json`). 67 by the control's own assertion; 3 by a fail-closed error: MU-01-3b (`ENOENT` at the `readlink` of the kept link, which the mutant deleted), M4-7c and M2-4b (as in Round 1).

| Group | Mutants |
|---|---|
| A-SH-01 | MU-01-1a/1b/1c (guard skipped only for data areas, extra roots, scratch), 3a/3b, 4 (stage 1), 5 (stage 3), 6 (stage 5), 7 (owner), 8 (type), 9 (chain device/inode), 10 (outside parents), 11 (pre-removal check), 12 (base skipped), 13 (empty outside chain) |
| A-SH-02 | MU-02-1, 1u, 2, 2m, 3, 4 (archive), 5 (note without first cause), 6 (fixture), 7, 8 (record not published), 9 (BLOCKED first cause), 10, 11 |
| A-SH-03, LD-2 | MU-03-1, 2 (accepts a missing record), 3 |
| A-SH-04 | MU-04-1 |
| A-SH-05 | MU-05-7a/7b, 12a/12b (hand-written copy-then-chmod and late observation at `g-damaged`), 12c-g, 12c-n1, 12c-n2, 12c-o (hook dropped at one call site each), 13a/13b |
| V8-6 (d) | MU-V86-1 to 4 (on private copies of `storage-diagnostic.mjs` only) |
| Round 1 reruns | M4-3, M4-4, M4-5a/b, M4-7a/b/c/d, M4-10a/b, M4-8a/b/c, M4-1a/b/c/d, M2-3b, M2-4a/b, M7-1a, M-LD2a/b, M-SD1 |

Each A-SH-05 mutant fails both mask tests of its site control, and the failing copy names its call site (`nomanifest-*`, `incomplete-*`, `old-manifest-*`, `damaged-*`). The V4-9 inventory test PASSes on each of these mutant trees: V4-9 does not see a token-free copy, so the site controls are the detectors. Map, A-01 and catalog ids are mapped in A-01b C-4 and A-02 G-8.

### R2.8 Complete host self-test suites

| Run | Child umask | Tests | Pass | Fail | Skipped | Stub calls | TMPDIR left | Time (UTC) |
|---|---|---|---|---|---|---|---|---|
| full1-u022 (pre-A-04, earlier evidence) | 022 | 141 | 141 | 0 | 0 | 0 | 0 | 17:48:26-17:56:41 |
| full2-u022 (final) | 022 | 142 | 142 | 0 | 0 | 0 | 0 | 18:05:22-18:14:21 |
| final-u077 (final) | 077 | 142 | 142 | 0 | 0 | 0 | 0 | 18:15:04-18:24:09 |

Outer umask 077; private HOME and TMPDIR per run; no `npm_*` or `NPM_CONFIG_*` variable. Source binding: the held hashes equalled the 11 paths before and after full2; the inventory of all 41 `tests/host` modules equalled `c71912f` at 18:19:45Z, 18:24:41Z and 18:30:15Z. The 105 Round 1 tests are among the 142, and V7-1 keeps its declared map (every row PASS except `c-host-negative` NOT_APPLICABLE and `a-lock-scope` FAIL with their exact causes), 29 restores at 21 sites, and the 27 V2-8 injections, after F-2.

V1-12 (unchanged test) archived the committed `HEAD` that it resolved: `7f6da573cd0342b447f129f50e3ccb2736278e87` in full2 and `90a56395f2d254fb838942a75033a36c8bd3d325` in final-u077 (the Lead's docs-only commits moved `HEAD`). Both have `infra` tree `d4625250f391bb43fbba57a05c86a13c28ba7e61` and the same `package.json` as `9f8ac62` and `c71912f`. One stub call, answer 97, exit 1, one acquire with the spawned pgid and `stack:data-backup`.

### R2.9 Correction of a Round 1 claim

Round 1 §7 lists "V4-9 static" as creation evidence for site #7 only, and "—" for #12 and #13; §13 says that the final mode and the V4-9 inventory cover #7. Correction: V4-9 is a source-text check of copy tokens. It applies the same way to every site #1-#16, and it is creation evidence for no site: it cannot see a token-free plain write followed by `chmod` (R2.7 shows that V4-9 PASSes on all ten such mutants). Round 2 adds runtime creation records at #7, #12 and #13.

### R2.10 Limits and dispositions

- Bounded races, as specified: the correction re-checks at stages 1, 3 and 5. A move in the window between the stage-3 check and the `fchmod` call of the same descriptor is reported by stage 5 as a refused correction (late refusal; the recorded inode then has mode 0600), and the phase stops. The scratch removal has the same kind of window between its chain check and `rmSync` (and inside `rmSync`). No atomic guarantee is claimed.
- D-A1 (Lead accepted): an invalid scan root FAILs and is not walked; it does not by itself stop the phase. A refused correction or an unsafe scratch cleanup stops it.
- M5-4b stays NOT DETECTED, masked by the synchronous precondition under P-1a condition 4; not equivalent. M4-8f stays equivalent (`O_CREAT \| O_EXCL` refuses final links); `O_NOFOLLOW` stays. Neither was rerun; neither surface changed.
- The mock lane is QA's model of the product (F-2 added one ADR-012 A6 behavior to it). It finds sequence and fixture-logic errors, not runtime errors.
- Closed, not deferred: Q-R1A-01 and ADR-012 O-1. Carried as recorded: the nonblocking unit-coverage MINORs, O-A2, B-RR-02 and B-RR-03, and the harness deferrals (A-SFT-08 to M4; R1-A QA O-1).
- Tool state outside the QA modes: npm wrote 4 folders (0755) and 4 debug logs (0644) in the private HOME of the two child-022 suites (`home/full{1,2}-u022/.npm/_logs`, during V1-12). They are not QA-authored data; they are listed apart in the manifest.

### R2.11 Deviations

- R2-D-1: the editor tool wrote the first map file at 0644 inside the 0700 map folder. I replaced it with an exclusively created 0600 copy (same SHA-256). The replacement does not prove a 0600 creation. After that no editor tool wrote inside the private root.
- Tooling slips of my own shell, each recorded in `evidence/deviations.md`: one pre-edit hash list did not run (zsh did not split it; git hashes used instead); four empty compare outputs with bad names were removed and the compares rerun; one neutral run used a wrong folder (zsh `:c` modifier) and was repeated as `final-new2`.

### R2.12 Evidence and hold

- Private QA root: `/Users/quangnguyen/cogniate-qa-runs/storage-harness-repair-qa-r2-20261021T1646Z` (0700). Manifest: `evidence/manifest-r2-v1.tsv` (see the Lead message for its SHA-256); it excludes itself and `tmp/`. The earlier `evidence/manifest-r2-probe.tsv` stays.
- I hold this report. I ask the Lead for an exact-path commit of it. I do not commit, push or merge. I stay in this session as the remediation owner.

### R2.13 Repair batch RT (after the candidate C diagnostic)

Status of this subsection: PASS for host checks of the batch only. No runtime, acceptance or candidate credit. Source: `c4de96f41163a23c182f0fbcb513460086da2fd8` (tests tree `290a773f1c9779693153ae77b46cc8ceb7eb83f4`), the Lead's exact-path commit of my three held files.

- Trigger: the independent runtime QA ran the candidate C diagnostic (`d3296dd6eddbe723364a639d8e2db0adf12ab183`, harness `c71912f`). Migration 12/12 PASS. Storage steps 1-33 PASS; step 034 `@backup-B` FAILed "New LTI platform: HTTP 502"; the later failures were prerequisite cascades. I read the evidence and source only (no run, no Docker): `diagnosis-c/backup-B-502.md` (`b0004ad12a62694b66d6509a918e2934bc004981ffa87e2561a8565f187500bd`; its header time is corrected in `diagnosis-c/backup-B-502-erratum.md`).
- Cause (harness): `serviceContainers` lists every lane container (proxy, postgres, moodle, lti-service, cogniate-app). `@backup-B` started the stack only when no container ran. After `e-not-same-import` stopped the two app services, proxy, postgres and moodle still ran, so the start was skipped and the API write reached a stopped `lti-service` through the proxy. The same check was in `postB` (every `@post-B`), and `e-fresh-refusal` checked "no service starts" over all containers. QA's mock lane had only the two app containers, so V7-1 could not see this.
- Repair (Lead grant `msg_8fee425d4749`; exactly three paths): `storage-rows.mjs` `appRunning` (both app services run) at `@backup-B` and `postB`, and "no service starts" for the two app services (`assertUnchanged` still compares every lane container); `run-m1.mjs:71` a finite 1,800,000 ms bound for the complete self-test invocation of `--harness-only` (the earlier 120 s bound stopped it after 120 s; it takes about 9.6 min); `storage-rows.selftest.mjs` an opt-in mock state with running proxy, postgres and moodle (made by the first start, kept by a harness stop and a quarantine, removed by `stack:reset`), and control R2-RT-1.
- R2-RT-1: the full dry run with the platform containers keeps the 70-row declared V7-1 map; before `@backup-B` and the first `@post-B` both app services were stopped and the platform ran (precondition made); every API request of those steps came while both app services ran; `e-fresh-refusal` ran with the platform running. It FAILs on the C runtime (the `@backup-B` cascade, as in the runtime) and PASSes on `c4de96f` (`logs/rt-base-u022`, `logs/rt-new-u022`). V7-1 itself is unchanged and PASSes on both.
- Mutants (catalog `bin/catalog-rt.py`, `818cce53851dd8e697967b023afee1e5a0382f0fd3913e3887e48bde4cd8ef80`, frozen and sent before the run): MU-RT-1 (`@backup-B` check put back), MU-RT-2 (`postB`), MU-RT-3 (`e-fresh-refusal`): 3 of 3 DETECTED by the R2-RT-1 map assertion (MU-RT-3: `e-fresh-refusal: FAIL "No service starts"`). The baseline copy passed; every copy equals the held bytes except its one edited file (`evidence/mutant-copy-binding-rt.json`).
- Complete runs on the held bytes (equal to `c4de96f` before and after each run):

| Run | Child umask | Result | Time (UTC) |
|---|---|---|---|
| `node tests/host/run-m1.mjs --harness-only --provider blackboard` (worktree; private HOME and TMPDIR; Docker stub first) | 022 | exit 0; `node --test` 172/172 PASS (all 143 host self-tests plus the sim and `acceptance/M1/common` self-tests), 0 cancelled, 0 skipped, 573.9 s; typecheck and the four discovery checks PASS; 0 stub calls | 19:40:16-19:49:54 |
| complete host self-tests (`bin/run-suite.sh`) | 077 | 143/143 PASS, 0 skipped, 0 stub calls, 0 TMPDIR left | 19:40:18-19:49:50 |

- The `--harness-only` run counts as the complete child-022 suite (Lead): it ran the same 15 host self-test files and every one of the 143 host tests passed in it.
- Disclosed: npm and `tsc` left a `node-compile-cache` folder (0755) in that run's private TMPDIR (tool state, kept). On a timeout, `lib.mjs` `run()` signals only its direct child; this stays a disclosed limit and is not changed. The mock platform is a model: three always-running containers without health states. The storage rows after `@backup-B` still have no runtime result on any candidate.
- Deviation R2-D-2: in the `--harness-only` run, its `npm --prefix tests run typecheck` step ran npm with a fresh private HOME and the npm update notifier on. npm's debug log records one outbound request, `http fetch GET 200 https://registry.npmjs.org/npm` (19:49:50Z), and npm wrote `_update-notifier-last-checked`. This breaks the "no external network" rule. It was npm's public metadata request; no project data was sent. I did not turn the notifier off for this run (only the V1-12 probe does that through its scratch `.npmrc`). No other npm call in my runs made a request. A repeat of this run needs the notifier off first.
- Tool state of this batch, outside the QA modes and listed apart: npm wrote 2 folders (0755) and 4 files (0644: three debug logs and `_update-notifier-last-checked`) in `home/ho-rt-u022/.npm`. With the earlier 8 entries (R2.10), manifest `evidence/manifest-r2-v3.tsv` has 6 such folders and 8 such files; every QA-authored entry is 0700 (folders) or 0600 (files), and the 11 QA tools are 0700. Earlier manifests v1 and v2 stay.
- Bounded corrective check for R2-D-2 (Lead `msg_bd5a8904b210`), 19:54:39Z-19:54:42Z, child umask 022: only the post-self-test tail of the held `run-m1.mjs --harness-only` branch (the typecheck and the four vitest discoveries) ran again. A private launcher `bin/tail-replay.mjs` (`d2c911fae750ed1bcddce9731658682ddbb0058b313f7a864487d1828b3998ea`) checks the `run-m1.mjs` hash (`8e1ef65c…`), takes the literal `checked`/`loadingRuntime` definitions and the tail block from that file (block hashes in `logs/tail-rt-u022.stderr`) and runs them with the same imports. It runs no self-test and is not a second complete run. Control before any npm call: a new private HOME with a private `.npmrc` (`update-notifier=false`, `offline=true`; `npm config get` showed both), a new TMPDIR, the Docker stub first, no `npm_*` or `NPM_CONFIG_*` variable. Result: exit 0; typecheck and all four discoveries passed; the summary line is identical to the first run; 0 stub calls. The two new npm debug logs have no `http fetch` line, and npm wrote no `_update-notifier-last-checked`. This absence in the npm logs is a bounded observation, not a traffic capture. The tail files were equal to `c4de96f` before and after (`evidence/tail-rt-u022-inventory-{before,after}.json`). R2-D-2 stays recorded: the first `--harness-only` run is functional evidence, but it was not network-compliant.
- Working folder of `final-rt-u077`: `bin/run-suite.sh` (`4a83fbc4c0151e880dc81c9827c961d35cfa3ccc46a1ee610b125e5085eda2ea`) runs `cd "$dir"` with `dir` = its third argument, here `<worktree>/tests/host`; its meta lists the 15 self-test files by absolute worktree paths with their hashes (all equal to `c4de96f`). Each self-test imports its runtime modules by relative ESM paths, so all of them resolve to that held worktree folder. The inventories of the `--harness-only` run at 19:40:16Z and 19:49:54Z (all 42 `tests/host` files equal to `c4de96f`) bracket the 077 run (19:40:18Z-19:49:50Z).
- Manifest `evidence/manifest-r2-v4.tsv` (`eb3a24f548afad0e3291f247afedcebe9f074f78af347ae229530738e1ee00ca`, 7028 entries) adds these records. It has one more npm debug log at 0644 (the tail's npm call under child umask 022): npm tool state is now 6 folders at 0755 and 9 files at 0644, all in private fake HOMEs. Manifests v1 to v3 stay.
- Clarification (Lead `msg_621c9f196529`; the text above stays as history). The saved npm logs show one public npm metadata request (`GET https://registry.npmjs.org/npm`) and no other `http fetch` line. I made no traffic capture. So "no project data was sent" and "no other npm call in my runs made a request" mean only what these logs show; that no other data or request was sent is not established. For `final-rt-u077`, the direct evidence is the hash of each of its 15 self-test files in its meta (equal to `c4de96f`). The runtime modules that those files import are bound only by bracketing: the inventories of all 42 `tests/host` files at 19:40:16Z and 19:49:54Z (from the parallel `--harness-only` run) equal `c4de96f`; there is no separate before/after hash of the runtime modules by the 077 run itself.

### R2.14 Repair batch R4 (after the C2 diagnostic)

Status of this subsection: PASS for host checks of the batch only. No runtime, acceptance or candidate credit. Source: `cd731397fa2a5ee660b1b9575f942caec64c2f21` (tests tree `17330479829a6b65e560afc297e2bee6777459dd`), the Lead's exact-path commit of my two held files: `tests/host/storage-rows.mjs` (120488 bytes, `a9ef100d1aa0b8ba956b74a8c1d0ea8433fdc66bab8c9a1ba606068065a65f94`) and `tests/host/storage-rows.selftest.mjs` (163725 bytes, `4fcd18d5c7fee4bbb8e07a8a22391d591d36c8a81f152de15c290f6ce7a42ba2`). Evidence root: `/Users/quangnguyen/cogniate-qa-runs/storage-harness-repair-qa-r2-20261021T1646Z` (below: `r4/…`, `mutants/run-r4-1/…`, `diagnosis-c2/…`).

- Trigger: the C2 diagnostic (candidate `0938ea1b`, harness bytes equal to `c4de96f` for these two files) had three first causes (Lead `msg_c5b104978f9c`). Grant `msg_864eb746fa28`: edit only the two test files and append to this report. Lead clarifications: `msg_3ebcd0ef6d27`, `msg_a636f75a1e23`, `msg_d51dae38845f`, `msg_5e0c779233bc`, `msg_5de55590fe11`. My plan `msg_30864a7f2e44` first proposed a lane-log fallback for FC2 (a pause with an opId that no log line had before the spawn). The Lead rejected it before I wrote that code (`msg_5e0c779233bc`): a new opId does not prove that a log line belongs to this command. The repair uses the own output only.
- FC1, cause (harness): after `--recover`, `drill()` required both journals `rolled_back` at every point. ADR-012 §8: `prepared-lti` is "lti `prepared`, app not yet written", and R1 writes lti `rolled_back` X and leaves the app journal as it is. In C2 the product did this (lti `rolled_back`, opId `43c921565cf97b11c72122d4d6f7ea13`; app journal `present: false`), so `g-prepared-lti` FAILed "A verified rolled_back" and `g-recover-idempotent` did not run. Repair: only for `prepared-lti`, QA observes the file sets just before the drill. X is the opId of the `storage_drill_stop` line in the drill command's own output (in C2, cmd 332 has this line with the same opId as the lti journal). The new helper `firstWriteRolledBack` requires the lti journal `rolled_back` with opId X (32 hex), and the app journal observation (present, SHA-256 and JSON; or `present: false`; or an absent volume) equal to the observation before the drill. A missing observation fails. A new app journal, also one of the same operation, fails. `prepared-lti` is 1 of the 11 drill points. The other nine rollback points keep the both-journal `rolled_back` check, and `committed-lti` keeps its own forward-commit branch (exit 0, the pair equals `B`). Exit 1, `equalsBefore`, the second `--recover` (exit 0 "nothing to recover", `assertUnchanged`), the start and stop and `DRILL_POINTS` (11) do not change. (My status messages `msg_30864a7f2e44` and `msg_31269b414451` said "the other 10 points"; that was not precise: see this text.)
- FC2, cause (harness): `orphanStart` accepted any `storage_drill_pause` line in the lane logs. At `g-orphan-stopped` the pause of `g-orphan-refusal` (opId `afa56af2…`, 20:32:25.836Z) was still in `storage-maintenance.jsonl`. So the wait ended at once, QA killed the group before the maintenance container started, and the row FAILed "The maintenance container still runs". Repair: the new helpers `ownPause` and `waitOwnPause` accept only a `storage_drill_pause` line in the spawned group's own stdout or stderr, with point exactly `swapped-lti` and an opId of 32 hex. The lane logs are not read. The product runs the maintenance container attached (`compose run --rm -T`) and writes each line to stdout before the log file, so the line reaches this output. The 180 s bound, the SIGKILL, the empty-group check and the check for exactly one running maintenance container do not change. The kill evidence `storage/<row>-kill.json` and the return value now also hold the selected pause line. QA adds no owner.json, pgid or container-name binding (the container suffix is `STORAGE_RUN_ID`, not the lock `runId`; `msg_d51dae38845f`).
- FC3, cause (harness): `e-import` compared the basenames of the manifest names with the names in the lti identity only. The product writes the complete manifest names (`lti-service/lti.db`), size and SHA-256 (ADR-012 §6 shape; §8 import "from the manifest"). Repair: the new helper `legacySourcesMatch` compares `legacySources` of both identities with the manifest's `files` list as a sorted multiset of complete `[name, size, sha256]`; the list must not be empty. There is no basename or other normalization on either side.
- Fake-world corrections (they were the reason V7-1 could not see the causes): `drillStop` at `prepared-lti` writes only the lti journal (`prepared` X), and every stop line has its opId. The fake `--recover` has R0 (each journal absent or terminal) and R1 (lti `rolled_back`, the app journal as it is, exit 1 with the ADR message). The holder of the orphan restore takes the lock, and after 1000 ms first writes the fake checkpoint for the running container, then writes the product-shaped pause line (event, ts, opId, point, seconds) to `storage-maintenance.jsonl` and to its own stdout. Each fake Docker, exec and npm answer first makes that container and the `swapped-lti` journals when the checkpoint exists. So a seen pause always means a running container, and a kill before the checkpoint leaves no container. Earlier pauses stay in the log. The fake import writes the complete `{ name, size, sha256 }`, and the fake L6 compares full names, sizes and digests for both identities, so `e-kept` and `e-provenance-restore` are real dependent checks.
- New controls (`HARNESS ONLY: R4 …`, 7 tests): (1) the dry run to `e-provenance-restore`: the eight rows `g-prepared-lti`, `g-recover-idempotent`, `g-orphan-refusal`, `g-orphan-complete`, `g-orphan-stopped`, `e-import`, `e-kept`, `e-provenance-restore` PASS; the R1 precondition was made (no app journal before, none after); 11 `recover-again-*` calls in `DRILL_POINTS` order, each exit 0 "nothing to recover"; the earlier pause is in the log and `g-orphan-stopped` selected its own later pause (another opId); both identities hold the complete names. (2) FC1 table: the passing cases and eight failing cases (another opId, lti still `prepared`, lti journal absent, a new same-op app journal, changed app journal bytes, no observation before, no opId, an opId that is not 32 hex). (3) FC1 world: a recovery that also writes a same-op app journal FAILs `g-prepared-lti`. (4) FC2 table and bounded wait: own stdout or stderr pass; no pause, point `swapped-app`, no opId, a short or upper-case opId, or another event give no pause; `waitOwnPause` with an output that has no current pause fails closed at its deadline (300 ms in the test; the row keeps 180 s). (5) FC2 world: a pause of an unrelated operation appended to the lane log after the spawn does not end the wait; the three orphan rows PASS. (6) FC3 table: wrong service path with an equal digest, basenames only, a missing, extra or duplicate entry, a changed digest or size, no size, an empty list, no list, a manifest with a duplicate entry: each fails. (7) FC3 world: an app identity whose `legacySources` differ FAILs `e-import` "legacySources of the app identity equal the manifest list".
- Old and new (child umask 022): the held bytes give 7/7 R4 PASS (`r4/logs/focus-final-1.tap`, `320e0d59d717c3596f6b611eb44332d2068c6c762203b6f17166390f01958796`). The old-C2 control `r4/old-control/host` uses the C2 `storage-rows.mjs` plus only the appended new helper exports (`a7e8c788a73cdf0b000bfc36859b95b97386877049a3ef289b3c51612604cec8`) with the new self-test file (`r4/logs/old-control-1.tap`, `0a9f83e584da05b42942570060c75d128c2bf28019d7664e4a9ef5a1454ed654`). There V7-1 FAILs with exactly the C2 runtime causes: `g-prepared-lti` FAIL "A verified rolled_back", `g-recover-idempotent` not run, `g-orphan-stopped` FAIL "The maintenance container still runs", `e-import` FAIL "legacySources equal the manifest list", `e-kept` and `e-provenance-restore` not run. The four R4 world tests also FAIL there (C2 even PASSes `g-prepared-lti` with the injected same-op app journal; C2 FAILs `g-orphan-refusal` with the unrelated log pause). The three table tests pass on both, as expected. V7-1 with its unchanged declared map PASSes on the new bytes.
- Mutants (catalog `r4/bin/catalog-r4.py`, `18e872c239414ea6e25e68dd1bb57f9916addafabf3fdb62138acac8b4eacbd6`, frozen before the run; Lead accepted the five as bounded): MU-R4-FC1, MU-R4-FC2 and MU-R4-FC3 each put back the exact C2 text of one cause; MU-R4-FC1-pre (the observation after the recovery as "before") and MU-R4-FC3-lti (only the lti identity) weaken a call-site choice that the tables cannot see. 5 of 5 DETECTED; the three baseline copies PASS and have the held hashes (`mutants/run-r4-1/results.json`, `f010d26e22b767847edfcad144c9422509f1f6a57866f2ce82cce32894474e8f`).
- Complete runs on the held bytes. The worktree `tests/host` equals `cd73139`: the inventories of all 42 files at 01:28:23Z and 01:40:15Z (`r4/evidence/inventory-20261022T012823Z.txt`, `inventory-20261022T014015Z.txt`) are equal and match `cd73139`, so they bracket both runs. Each meta lists its self-test files with their hashes.

| Run | Child umask | Result | Time (UTC) |
|---|---|---|---|
| complete host self-tests (`r4/bin/run-suite.sh`, all 15 files; `r4/logs/complete-u022.tap` `0e4d7ba5be4a4e8b99d1d16e94d74f07ea69465ccc282c80534db7c5581ff8c8`) | 022 | 150/150 PASS (the 143 earlier tests and the 7 R4 tests), 0 cancelled, 0 skipped, 0 stub calls, 0 TMPDIR left | 01:28:03-01:38:44 |
| `storage-rows.selftest.mjs`, the affected file (`r4/logs/affected-u077.tap` `57b9da6415e0ace2b844cd8b9d6d62dd213cc0368298390f5b559847dfcfc3db`) | 077 | 48/48 PASS, 0 cancelled, 0 skipped, 0 stub calls, 0 TMPDIR left | 01:29:31-01:40:09 |

- Why only one file at 077: the batch changes only `storage-rows.mjs` and its self-test. The new fake files (the holder checkpoint and `storage-maintenance.jsonl`) are in that file's private world roots. The other 14 self-test files did not change and passed in the complete 022 run; their 077 evidence stays the complete 077 run of R2.13.
- Disclosed redundant run: `file-new-1` (01:22:39Z-01:33:19Z, child umask 022, `r4/logs/file-new-1.tap` `744a3a043c89e6f3c0574406196856a383dca9a16b4f3cc7a8f6c4eee10159be`) ran the complete `storage-rows.selftest.mjs` on near-final bytes: the held self-test file and `storage-rows.mjs` `b5f6697688c26d8a3fcec12340a871d13c88520fb324cedaba7358b33c921d61`, which differs from the held bytes in one doc-comment line only (an ADR section number). 48/48 PASS. It is not byte-identical evidence and I do not count it. The complete 022 run on the held bytes had already started before the Lead asked to avoid this repeat, so I did not stop it.
- First focused run (`r4/logs/focus-new-1.tap`): 6/7. The C2-causes test compared the row notes, which end with a `duration` entry. I corrected that test assertion before the hold (`focus-new-2`: 1/1 PASS). No row or fake change.
- Environment: `r4/bin/run-suite.sh` (`8ad8b1f1b18b8b204413be817f5597b891ccf93034df1df9377ff1a07611a4cd`) is the R2 runner with only the root path changed and its `npm --version` metadata line removed. The Docker stub `r4/bin/docker` (`119bf837fcc77f2c39e0e908ba652dc480fbba13dae770a37e8ce7a5c0bedfee`) has the bytes of the R2 stub. The runner makes no npm call. My status messages said "no npm call"; that is true for the runner only. Inside the complete 022 run, the existing V1-12 probe (`storage-oracle.selftest.mjs`) made its two npm calls with its scratch `.npmrc` (`update-notifier=false`): `npm config get update-notifier` (answer `false`) and `npm run stack:data-backup` in its scratch copy (exit 1). Its two debug logs have no `http fetch` line, and npm wrote no `_update-notifier-last-checked`. This is a bounded observation from the logs, not a traffic capture. npm tool state in `r4/home/complete-u022/.npm`: 2 folders at 0755 and 2 files at 0644 (child umask 022), listed apart. Every QA-authored R4 file is 0600 and every QA folder 0700; the three tools are 0700.
- Observations, not changed: A-SH-11 (Lead: MINOR, deferred to M4): `stopCheck` also accepts an earlier `storage_drill_stop` line of the same point from the lane logs (for example at `e-import-recover` `staged` and `swapped`, after `g-staged` and `g-swapped`); in C2 each drill command's own output had its stop line. The lock record's pgid and the container's run label are not bound to the spawned group; the own-output proof does not need them. A `node --test` process of another QA run root (pid 64140, started 2026-10-21T06:26:06Z, working folder in `host-control-replay-rb-20261021T0622Z`) was still alive on this host. It is not mine; I did not touch it and I told the Lead.
- Limits: the fake is a model. In the old-C2 control, the FC2 result depends on timing: the C2 wait ends at the first poll after the lock record (250 ms interval), and the fake pause comes 1000 ms after the lock. A much slower host could hide the early kill in that control; this gives a false old PASS, never a false new PASS. The new wait has no timing dependence. The fail-closed case uses a 300 ms bound in the test; the row keeps 180 s. These repairs have no runtime result yet.
- Deviations: none new in R4 (the npm wording above is a correction of my status text, not a rule break).
- Evidence and hold: index `r4/evidence/r4-evidence-index-2.txt` (`f505f649a2efa2ad12173e047fbb101deee7dea7907c7906505309841e7acae7`, 43 entries with SHA-256, size and mode; index 1 `fff986c9…` stays). The source stays held at `cd73139`. I stay in the same session for further findings.

#### R2.14a Correction of R2.14 (Lead `msg_a06478e534a2`; the text above stays as history)

- Binding of the complete 022 run. R2.14 says that the inventories at 01:28:23Z and 01:40:15Z "bracket both runs". That is not correct for `complete-u022`: it started at 01:28:03Z, 20 s before the first inventory. There is no full inventory before its start, and I do not add one now. Its true binding: (1) I held the two source files with their hashes at 01:26Z, and the Lead verified them and committed them as `cd73139` at 01:27:52Z, before the launch; I made no edit after the hold. (2) Its meta lists the 15 self-test files with their hashes, all equal to `cd73139`. (3) The full inventories during the run (01:28:23Z) and after it (01:40:15Z) equal `cd73139`. For `affected-u077` (01:29:31Z-01:40:09Z) the two inventories do bracket the run.
- Deviation R4-D-1 (npm configuration). The grant `msg_864eb746fa28` required npm's update notifier off and npm offline before any npm call. My R4 runner made no `.npmrc` in the fake HOME. In `complete-u022` the V1-12 probe (`storage-oracle.selftest.mjs`) ran three npm commands, not two: `npm config get update-notifier`, `npm --version` and `npm run stack:data-backup`. Its scratch `.npmrc` sets `update-notifier=false`, `fund=false` and `audit=false`, but not `offline=true`. `npm --version` wrote no debug log, so there are only two logs. R2.14 said "two npm calls" and "Deviations: none new in R4"; both statements are wrong. The two logs have no `http fetch` line; this is not proof that no traffic occurred.
- Bounded corrective replay (Lead `msg_a06478e534a2`), 01:48:21Z-01:48:22Z, child umask 022. Only the unchanged V1-12 test ran: `r4/bin/run-v112.sh` (`d13933e6321979d5d0a7ee905c53e5b38c23fb7b00ba41a9d85519b7cf7dec28`), file `storage-oracle.selftest.mjs` (`8421d6d0f0a6d8c85c16ea9be2d2a0961fe6de7730c9a395650262c74c7cf3fe`, equal to `cd73139`), pattern `^HARNESS ONLY: V1-12 npm run stack:data-backup through spawnGroup`. Before any npm call the runner made a fresh private HOME and TMPDIR and the file `HOME/.npmrc` (0600, `offline=true`, `update-notifier=false`, `fund=false`, `audit=false`; `bc272fbefa708a5bbd7ee75905375e187284f90fcaadf7cb3ab988a866d3fb1c`, unchanged after the run). No `npm_*` or `NPM_CONFIG_*` variable; the fail-closed Docker stub first on PATH; the runner itself calls no npm. Source binding: the full `tests/host` inventories before (01:48:20Z) and after (01:48:29Z) the replay equal `cd73139`; git HEAD was `7a0bfa07b9c3498d05bf1ce5d299cd0b003682e5`, which changes only `docs/team` files after `cd73139` (package.json, `infra` and `tests` are equal). Result: 1/1 PASS, exit 0, 0 skipped (`r4/logs/v112-replay.tap`, `0ebf667e4be2ee5b2a86d7b4c27c38739df9080256a9cc6b2aa0d8649964919c`; meta `80250adf92c7539a4aa14f350eec3b1295f7abd2600885c46ae169d988a40b90`). The probe diagnostic: npm 11.19.0; `stack:data-backup` exit 1 at the probe's own fail-closed Docker stub (1 call, answer 97) after `storage_lock_acquired`; 0 calls to the R4 stub; 0 TMPDIR entries left. The two npm debug logs (`config get`, `run`) each show that npm loaded `HOME/.npmrc`; they have no `http fetch` line, and there is no `_update-notifier-last-checked`. This is a log observation, not a traffic capture. npm tool state in the replay HOME: 2 folders at 0755 and 2 debug logs at 0644 (child umask 022), listed apart. The replay does not make the first run compliant: R4-D-1 stays recorded for `complete-u022`.
- Evidence: index `r4/evidence/r4-evidence-index-3.txt` (`969a1555e2bb6d9b6d06654b572cd0b9133726aa84faaffd4edf59a237edca66`, 11 entries) adds the replay files, the two new inventories and the held R2.14 report copy (`d4997b96…`). Indexes 1 and 2 stay. The source stays held at `cd73139`.

### R2.15 Repair batch R5 (after C3 full round 1)

Status of this subsection: PASS for host checks of the batch only. No runtime, acceptance or candidate credit. The 18 failed rows of C3 round 1 stay failed history. Source: `27e1f6102409b3d6b676bc46a28150624450a444` (tests tree `8283d90dc669feb72eeb7ec43f5dbf80a156f0d4`), the Lead's exact-path commit of my two held files, `tests/host/storage-rows.mjs` (123062 bytes, `fbb99131ca0dc5673006ee500c0d413d8005298efaee320d7213ecb60016ba85`) and `tests/host/storage-rows.selftest.mjs` (171250 bytes, `edc2d97a1753b92c320e020c3bd6f201c476c9dca76eeea29e731911923364f6`), on C3 `c4c6d045`. Evidence root: `/Users/quangnguyen/cogniate-qa-runs/storage-harness-repair-qa-r2-20261021T1646Z` (`r5/…`, `mutants/run-r5-1/…`, `diagnosis-c2/…`).

- Trigger: C3 full round 1 storage had 52 PASS and 18 FAIL (Lead `msg_9520a0e97ab5`). One executed first cause: `g-tamper` "--recover after the tamper: expected exit 2, got 1"; the other 17 rows (and three fixtures) did not run because of it. Grant `msg_f8be5a9636b8`; plan `msg_838f324b0f7c` and v2 `msg_b72ab04bc19b` (accepted `msg_09725af166ee`).
- Cause (harness), from the raw round-1 evidence (`qa-multi-r1-st-c4c6d045-2026-10-22T03-11-29-196Z`): cmd 515 (`g-tamper-stop`) has the own-output stop line with opId X = `7011aa7c703074d4650ddad2b299a689`, point `swapped`. The cmd 516 listing has two lti folders, `.previous-3f350b564a83ec6616cac1abd3db26ff` and `.previous-7011aa7c…`. The first is the previous generation kept after the commit of the `g-orphan-refusal`/`g-orphan-complete` restore (pause 03:26:23.945Z, resume 03:28:23.948Z). `storage-rows.mjs:984` took the first `.previous-*/lti.db` in the sorted listing, so cmd 517 changed `.previous-3f350b56…/lti.db`, not the file of this drill. Cmd 520: R3 "rolled back; the targets equal the state before (verified)", exit 1. This is correct for an intact `.previous-<X>`. In the C3 diagnostic the same two kinds of folder existed (`035f404e…` current, `f6af6f85…` kept); the current one sorted first, so the right file changed and the row passed. The result depended on the order of two random opIds.
- ADR-012 assessment (no product inference): §8 keeps one previous generation after a commit and removes older ones at the next commit; R3 step 6 removes only `.restore-X` and an empty `.previous-X`. So the two folders at `swapped` are conformant. M1 `g-tamper` requires the change in `.previous-<opId>/lti.db` of the drill operation. No product, criteria or ADR change.
- Repair (rows): new exported `tamperTarget(stop, listing)`: every `storage_drill_stop` line in `g-tamper-stop`'s own output must have point `swapped` and the same 32-hex opId X; the lti listing must hold `.previous-<X>/lti.db` as exactly one regular file. Else the row FAILs before any change. New exported `tamperMade(before, after, target)`: between QA's listings just before and just after the plant, only the target changes its SHA-256; names and every other entry of both volumes (the kept generation included) are equal. Else FAIL "precondition not made: …" before `--recover`. `stopCheck` (exit 3, point `swapped`) and every later assertion of the row do not change. There is no log fallback, no sorted first or last choice, no retry and no forced id.
- Fake (self-test), faithful to ADR-012 §8: a commit (the committed-lti recovery and the orphan completion) keeps `.previous-<its opId>` and removes `.restore-*` and older `.previous-*`; a rollback removes only its own `.restore-<X>` and `.previous-<X>`; a test-only first digit for orphan and drill opIds puts the kept generation before or after the drill (both orders occur with random opIds); an injection `tamper-no-effect` skips the flip. The fake's own LD-3 injections now use `.previous-<journal opId>` instead of a first match.
- Sweep: in `tests/host`, `storage-rows.mjs:984` was the only operation-specific folder selection. Lines 316-318 (no `.restore-*`, no empty `.previous-*`) and 1146 (none on a fresh lane) check all folders and stay correct with a kept generation. In the fake, `injectTamper` had the same first-match selector; it is now bound. A-SH-11 (MINOR, M4) stays deferred; `g-tamper` takes X from its own output.
- New controls (`HARNESS ONLY: R5 …`, 4 tests): (1) dry runs to `g-tamper` with the kept generation first and last: both PASS; two `.previous-*` folders in the intended order; only the drill's `lti.db` changed; the kept folder's bytes did not change; `--recover` exit 2. (2) A full 70-row dry run with the kept generation first: the declared map, so the 17 rows after `g-tamper` run and PASS. (3) `tamper-no-effect`: FAIL "precondition not made: .previous-<opId>/lti.db did not change its bytes", and no `--recover` call. (4) Tables: `tamperTarget` refuses no stop line, another point, a mixed point, no opId, a short or upper-case opId, two opIds, only the kept generation, a folder, a link, two target entries and no listing; `tamperMade` fails for no change, a change of the kept generation instead, a second changed file, a changed mode, an added or a removed entry, and a removed target.
- Old and new (child umask 022): the held bytes give R5 4/4 PASS (`r5/logs/focus-3`). The old-C3 control `r5/old-control-2` (C3 rows plus only the two new helper exports, `a91c1bc2…`; the held self-test) gives "kept first: FAIL --recover after the tamper: expected exit 2, got 1" (as round 1) and "kept last: PASS" (as the diagnostic); its full kept-first dry run FAILs `g-tamper` and the same 17 rows; with `tamper-no-effect` it gives the old cause, not the precondition. `r5/old-control-1` (an earlier self-test whose R5 order test then stopped with an ENOENT in its hook on old code; I made the hook tolerant and the test report both orders) also shows V7-1 FAIL with the same 18 rows. `R4|V7-1|LD-3|tamper`: 13/13 PASS (`r5/logs/focus-2`, on the self-test before that test-only change).
- Mutants (catalog `r5/bin/catalog-r5.py`, `c0f5fba136e6005231b425143091057fc1912dcefdf544b952f3bb66c8338799`, frozen before the run): MU-R5-1 puts back the C3 first-match selector (DETECTED: "kept first: FAIL --recover after the tamper: expected exit 2, got 1"); MU-R5-2 removes the precondition check (DETECTED: the no-effect case gives the old cause). 2 of 2; the baseline copies have the held hashes (`mutants/run-r5-1/results.json`, `3e4b8e23cc40e7640ce0f9574cf9cd3fce93e9658d2478f3b35ea47ec0de1e00`).
- Complete runs on the held bytes (worktree equal to `27e1f61`). A full `tests/host` inventory was taken immediately BEFORE each launch (`r5/evidence/inventory-20261022T034720Z-before-u022.txt`, 03:47:20Z; `inventory-20261022T034727Z-before-u077.txt`, 03:47:27Z) and after both runs (`inventory-20261022T035926Z-after.txt`, 03:59:26Z). All three list 42 files, are equal and match `27e1f61`, so they bracket both runs. Each meta lists its self-test files with their hashes.

| Run | Child umask | Result | Time (UTC) |
|---|---|---|---|
| complete host self-tests (`r5/bin/run-suite.sh`, all 15 files; `r5/logs/complete-u022.tap` `e22f9e41794a9b3856df5150834b5e4d5de3b3ea0706ade5a492662751a2aaeb`) | 022 | 154/154 PASS (the 150 earlier tests and the 4 R5 tests), 0 cancelled, 0 skipped, 0 stub calls, 0 TMPDIR left | 03:47:24-03:59:13 |
| `storage-rows.selftest.mjs`, the affected file (`r5/logs/affected-u077.tap` `8d0c3e81cdb36eb7ee4482ecb3fc32d059de7e44cdac53715614f234bc6c5392`) | 077 | 52/52 PASS, 0 cancelled, 0 skipped, 0 stub calls, 0 TMPDIR left | 03:47:30-03:59:13 |

- npm (the R4-D-1 lesson applied): `r5/bin/run-suite.sh` (the R4 runner plus these lines) makes the file `HOME/.npmrc` (0600: `offline=true`, `update-notifier=false`, `fund=false`, `audit=false`; `bc272fbefa708a5bbd7ee75905375e187284f90fcaadf7cb3ab988a866d3fb1c`) in each new private HOME before it starts node. The runner calls no npm. In `complete-u022` the V1-12 probe ran its three npm commands; its two debug logs show that npm loaded this `HOME/.npmrc`, they have no `http fetch` line, and npm wrote no `_update-notifier-last-checked`. This is a log observation, not a traffic capture. npm tool state there: folders at 0755 and two debug logs at 0644 (child umask 022), listed apart. The 077 run made no npm call.
- Why only one file at 077: the batch changes only `storage-rows.mjs` and its self-test; the other 14 files did not change and passed in the complete 022 run.
- Disclosed: (1) a zsh slip made two empty files in `r5/old` (`"$C3:t…"` path modifier); I removed them and made them again with `"${C3}:…"` (`r5/evidence/deviations-r5.md`). (2) `r5/logs/focus-1` (R5 4/4) and `focus-2` ran on the self-test before the test-only change to the R5 order test; `focus-3`, `old-control-2`, the mutants and both complete runs use the held self-test. No other deviation.
- Observations, not changed: A-SH-11 (MINOR, M4) stays deferred. The fake still makes no `.previous-*` for a normal (not drilled) restore or import commit; the kept generation that matters for `g-tamper` comes from the orphan commit, which the fake now models.
- Limits: the fake is a model. The order test fixes only the first digit of fake opIds; product opIds stay random. These repairs have no runtime result yet; the 18 C3 round-1 failures stay failed history until fresh acceptance.
- Evidence and hold: index `r5/evidence/r5-evidence-index.txt` (`a82b8bd2f72edab154b06666d9d922f8c27e26f11b92c6d13559e77e3415c88b`, 44 entries with SHA-256, size and mode: 39 files 0600, 3 tools 0700, 2 npm debug logs 0644). The source stays held at `27e1f61`. I stay in the same session.
