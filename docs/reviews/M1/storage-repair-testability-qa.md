Verdict: PASS
Round: 2

# Storage repair: design testability (independent QA)

Scope: **design testability only**, host-only, before the harness work. No acceptance credit. No implementation, no Docker call, no network service, no runtime test, no existing shell script was run. Owner: independent QA (Claude Code Opus 5.5, xhigh). Task `task_1fb4229dead2`, dispatch `ctx_c46c7c8e09eb`, run `run_ebe671ad72a9`. Date: 2026-10-21.

**Result in brief.** The bounded repair is feasible on the pinned sources, and its 16 copy sites and four exceptions match the source. But the frozen text is not internally consistent in one mandatory control. V4-9 cannot pass on a correct tree: its file set matches the self-tests, which must make temporary folders, and the in-container logical read needs a scratch that no exception names (QA-SRT-01, MAJOR). Four smaller items need a text correction: V4-1 against V4-2 (final mode of the into-volume sites), the trigger of the `d-mountpoint` root restore, the "this window" rule of the handoff, and the definition of a "QA plant" for the phase stop (QA-SRT-02 to -05, MINOR). Each correction is one or two sentences in the triage file. None changes the architecture, a product file, R1-A, a row id or a row count. With these five corrections, I expect a PASS for design testability.

### Frozen inputs (verified)

| Input | Pin | SHA-256 |
| --- | --- | --- |
| Design commit | `ab285856c139ddd50be8c8482eec1a330b7055da` | — |
| `docs/architecture/tasks/storage-full-round-triage.md` (revision 3) | `ab28585` | `70ba4f9b5a2e61ce79296b9d689618f9a56ddc3d5a8ea0f6189c8f0514241dba` (equal) |
| `docs/architecture/tasks/M1.md` | `ab28585` | `b648853cea837284020229a99db81b699066fa916876f90905eb374fdba61057` (equal) |
| `docs/architecture/adr/ADR-012-sqlite-volume-storage.md` | `ab28585` | `57602ca4cf9dc82ea2fb874d2ef8618dad204ca7d1727bfa56ee3fa6746fa589` (equal) |
| `docs/team/charter.md` | `ab28585` | `5289f7f72471d15d8fbff41dde898514cee0270d28ea62bcfd006f259cd23054` |
| QA tests tree | `4c7e067feedc644f955afee37806f06e7273dd04` (= `HEAD:tests`, = `01ce5bc:tests`) | the ten tests files of triage §1 hash equal to its table |
| Product R1-A | `01ce5bc2d2d26e4fb1226c5f4f19528fb9ed576b` | `storage-oplock.sh` `90d246792c41d63268411bdfec4e9e04764f89d57d51343a0f60c1b88969ca96`; `storage-oplock.test.mjs` `e2b2224b257b45e5a249af744762c146bf0be0bf33662f5345c589f8ac7c2131`; `storage-compat.sha256` `3337c5858f3d055e910d8002e139f3e7496ab17f2efc33cc39b46171f31d2747` |

Line references: `T:` = the triage file at `ab28585`; `M1:` = `M1.md` at `ab28585`; `ADR:` = ADR-012 at `ab28585`; source lines are in the tests tree `4c7e067` (for example `storage-rows.mjs:532` = `tests/host/storage-rows.mjs` line 532) or in the product at `01ce5bc`.

<!-- criterion-map:begin -->
## Part 1. Criterion-to-test map (frozen before any source read)

Written from the normative design only: `docs/team/charter.md`, `docs/architecture/tasks/storage-full-round-triage.md` (revision 3), `docs/architecture/tasks/M1.md` (AC-M1-41, P-1a text) and ADR-012 §4, §7, §9–§11, §13–§15, all at `ab285856c139ddd50be8c8482eec1a330b7055da`. No product, harness or test source, no Author report and no concurrent reviewer report was read before this map was frozen.

Classes: **H** = host-only unit control (no Docker). **M** = host-only mock lane (fake product and fake Docker). **R** = runtime only (diagnostic window; outside this dispatch). "T:" = triage line. "M1:" = `M1.md` line. "ADR:" = ADR-012 line.

### 1.1 RC-1 oracle and R1-A (V1)

| Map id | Criterion (normative source) | Test and observable oracle | Mutation that must fail it | Class |
| --- | --- | --- | --- | --- |
| Q1-01 | Offset; truncated log → FAIL (T:113) | pure verdict function; log shorter than offset → FAIL "lock log truncated" | offset ignored | H |
| Q1-02 | Wait ends only on a sign of the spawned `pgid` (T:115) | V1-7: older `W` event and record before spawn; wait does not end | `.some()` over whole log | H |
| Q1-03 | Exactly one acquire after offset with spawned `pgid` (T:116) | V1-8: zero and two such events → FAIL "backup run not identified" | "any new acquire" | H |
| Q1-04 | Wait owner = `X` (T:117) | V1-9: wait line with other `owner.runId` → FAIL "stack:up waited on another run"; no wait line → "no wait observed" | missing cross-check | H |
| Q1-05 | Release selection by `runId` = `X` (T:118) | V1-2, V1-11 (none) → FAIL "no release…"; two → FAIL "more than one release…"; V1-3: `Z` later does not win | command match; "last release"; earlier-release fallback | H |
| Q1-06 | `R.command` === `C` (T:119) | V1-1 (`null`), V1-1b (other string) → schema FAIL with the ADR-012 §7 message; `selectedRunId` = `X` | non-null-only check; schema step skipped | H |
| Q1-07 | Fail-closed timing with offset `o` and uncertainty `u` (T:120) | V1-4, V1-10: late release → FAIL on time; margin inside `[lo, hi]` → FAIL "clock uncertainty"; +2 s engine offset hides 1 s early start → FAIL; failed sample → FAIL "clock not measured"; result records `o`, `u`, `lo`, `hi`, margins | compare without offset or uncertainty | H |
| Q1-08 | Older pair `W` before offset (V1-6) | FAIL on time; `selectedRunId` = `X`, never `W` | whole-log or first-match acquire | H |
| Q1-09 | Spawned `pgid` premise (V1-12) | Docker stub first on `PATH`; logged acquire `pgid` = spawned `pgid` | identity rule with a false premise | H (stub) |
| Q1-10 | Saved backup output through `saveText` (T:121) | artifact `storage/a-serialize-backup.log` exists, redacted, in the final scan | output kept in memory only | **no host control named** (see PA-15) |
| Q1-11 | R1-A: every lock event carries the emitter's own acquire command, also `storage_lock_lost` and the `TERM` trap release (T:106, T:364–365; ADR:311) | V1-5 (Author): `run -- true`, lost case, `TERM` case; values, not keys | release without `--command` | H (Author) |
| Q1-12 | R1-A scope: exactly three product files; compat hash line 4 updated in the same commit (T:362–368) | `git diff --stat` of the R1-A commit; `npm run test:infra` compat hash check | a fourth file; stale hash | H (inspection) |
| Q1-R | V1-R (T:125) | runtime | — | R |

### 1.2 RC-2 root plant, restore and phase stop (V2, N-5)

| Map id | Criterion | Test and observable oracle | Mutation | Class |
| --- | --- | --- | --- | --- |
| Q2-01 | `listRoot` stays strict (T:151) | V2-1: non-root, `000` folders, direct `readdirSync` precondition, refuses root | global or named `EACCES` relaxation | H |
| Q2-02 | `meta` is `lstat` only, never `readdir`, never follows a link (T:145) | V2-2: `000` folders → `type`, `uid`, `gid`, `mode`, no entry list | hidden `readdir` | H |
| Q2-03 | Order listing → plant → `meta` → `stack:up` → listing; restore on failure; first cause kept (T:142–150) | V2-3: injected `stack:up` failure | missing restore; restore replaces first cause | M |
| Q2-04 | No-op plant → "precondition not made" (T:145) | V2-6 | no-op plant passes | M |
| Q2-05 | "Nothing else changed" against step-2 baseline; mountpoints no longer excluded (T:147) | V2-5 | baseline drops the check | M |
| Q2-06 | Root restore only after a confirmed stop and under the lock (T:149) | V2-7 | restore without stop or lock check | M |
| Q2-07 | Restore trigger "step 3 ran and step 6 did not confirm" (T:149) | partial plant (one entry changed, then plant error) → restore runs | restore only after a fully successful plant | M (**PA-3**) |
| Q2-08 | One abort state; remaining steps `BLOCKED` with the fixed note; 70 row ids, one result each; fixtures same; teardown runs; abort changes nothing (T:179–183) | V2-4 | row-only BLOCKED; missing row | M |
| Q2-09 | Every row-level restore of a QA plant uses the abort rule (T:184) | V2-8: one injected failure per restore site; the site list must be complete | a site without the rule | M (**PA-4**; completeness after source read) |
| Q2-10 | Second `@seed` occurrence needs `a-fresh` and `a-first-start-resume` (T:243–247) | V2-9 | shared need; forward need | M |
| Q2-R | V2-R (T:187) | runtime; includes `storage_quarantine_copy` lines | — | R (**PA-13**) |

### 1.3 RC-3 `Origin` (V3)

| Map id | Criterion | Test and observable oracle | Mutation | Class |
| --- | --- | --- | --- | --- |
| Q3-01 | `portal()` and `app()` send `Origin` === lane `PUBLIC_APP_URL` on `POST`, `PUT`, `PATCH`, `DELETE`; no other header change (T:199) | V3-1: recording HTTPS function | omission | H |
| Q3-02 | Exact value (T:199) | V3-2: LTI URL, trailing `/`, other port → the control fails | loose or fixed origin | H |
| Q3-03 | No other storage-phase `/app-api` writer bypasses the helpers | source inventory of request call sites | a direct request without `Origin` | H (inspection; **PA-22**) |
| Q3-04 | Product negatives unchanged (T:203–205) | Author `npm run check`; full-gate T4a | relaxation | outside QA host scope |
| Q3-R | V3-R (T:207) | runtime, complete window | — | R |

### 1.4 P-1a (V5)

| Map id | Criterion | Test and observable oracle | Mutation | Class |
| --- | --- | --- | --- | --- |
| Q5-01 | `a-fresh`: `lstat` of `P`, `P/packages`, `P/uploads` → `ENOENT` before `stack:up`, else `BLOCKED` "lane not fresh: <path>" (M1:230) | V5-1 | precondition only recorded | M |
| Q5-02 | Fresh clone has no `P` before `a-fresh` | inspection: no tracked entry under `infra/.data/`, no earlier harness step that creates `P` | — | H (inspection) |
| Q5-03 | Absent children: `P` identity kept; children deleted, never renamed; `ENOENT`; new children `0700` of the host user (M1:255) | V5-2 | rename; new `P` | M (**PA-17**) |
| Q5-04 | Unsafe case: delete `uploads`, plant link → `content_path_unsafe` before any compose start; link and target unchanged; cleanup = remove link as link, new empty `0700` `uploads` (M1:254) | V5-3 | rename-back; link left | M |
| Q5-05 | Safety: services stopped; real host-user directories; no legacy entry; link removed as link; nothing outside the two children (M1:256) | V5-4 | deletion that follows a link | M |
| Q5-06 | Failed cleanup stops the phase (M1:257) | V2-8 site entries for `d-content-folder` | — | M (**PA-4**) |
| Q5-R | V5-R (T:233) | runtime | — | R |

### 1.5 P-3 copy modes, scan and correction (V4)

| Map id | Criterion | Test and observable oracle | Mutation | Class |
| --- | --- | --- | --- | --- |
| Q4-01 | Private helper: `O_CREAT|O_EXCL|O_NOFOLLOW|O_WRONLY`, `0600`; `fstat` before the first byte (regular, `0600`, size 0) to a hook; `fsync`; SHA-256; source mode returned, never applied (T:295) | V4-1 per private site; umask `022` and `000` | plain copy; copy then `chmod`; umask mode | H |
| Q4-02 | Into-volume helper: exclusive `0600` create, write, `fsync`, `fchmod` target mode, `lstat` check (T:296) | V4-2 recorded `0644` and `0600`; umask `022` and `077` | return keeps `0600`; byte-only compare | H |
| Q4-03 | V4-1 and V4-2 agree on the final mode of into-volume sites #2, #5, #6 | V4-1 text says "for each site #1–#14 … final mode `0600`" | — | **PA-1** |
| Q4-04 | Inventory completeness: every QA copy **and write** site into a private area or a protected-class path is one of #1–#16 or X1–X4 (T:258–289) | source sweep (after freeze) of copy, write, `mkdtemp`, `tmpdir`, shell `cp`, `docker cp` | an unlisted site | H (inspection; **PA-21**, **PA-10**) |
| Q4-05 | V4-9 static check scope and matcher (T:443) | the check over its named files passes on a clean tree and FAILs with one inserted call | — | H (**PA-2**) |
| Q4-06 | Private scratch: `<private root>/scratch/<label>-<16 hex>` `0700`; `remove()` scans first (T:297) | V4-8 | removal without scan | H (**PA-11**, **PA-20**) |
| Q4-07 | Scan areas: private data areas full scan; `bin/` exact rule `0555`; outside classes (legacy folders, QA write ledger) (T:302–306) | V4-3, V4-4, V4-5 | name exemption; unchecked `bin/`; no outside class | H (**PA-14**) |
| Q4-08 | Scan points: after every `SEQUENCE` step and fixture, abort path, each `remove()`; migration points (T:308–312) | V7-1 hook count; migration points by inspection | missing hook | M |
| Q4-09 | Markers `0600` with `wx` (#15) (T:280) | V4-6 | marker without mode or `wx` | H |
| Q4-10 | Scan hit: step FAIL; record; one bounded correction with `O_RDONLY|O_NOFOLLOW`, same dev/inode, `fchmod 0600`; refused → phase stop (T:314–319) | V4-7 with link and other-inode variants | correction that follows a link; FAIL that turns PASS | H |
| Q4-11 | #14 capture files made empty `0600` before the shell writes (T:279) | V4-8 | umask mode | H |
| Q4-12 | #16 handoff `wx` `0600` (T:281) | V8-1 | reused file | H (**PA-6**) |
| Q4-R | V4-R (T:325) | runtime | — | R |

### 1.6 Log archive (V6)

| Map id | Criterion | Test and observable oracle | Mutation | Class |
| --- | --- | --- | --- | --- |
| Q6-01 | Segment before **each** product `stack:reset` and at the phase end, also after a phase stop; byte length and line count recorded; `saveText` redaction (T:330) | V6-1 | archive after reset, or none | M (**PA-12**: resets inside candidate commands) |
| Q6-02 | Absence claim with a missing segment → `BLOCKED` (T:332) | V6-2 | absence claim from a truncated log | H |

### 1.7 Dry run and diagnostic handoff (V7, V8)

| Map id | Criterion | Test and observable oracle | Mutation | Class |
| --- | --- | --- | --- | --- |
| Q7-01 | Full `SEQUENCE` mock dry run: procedures, needs backward only, scan hook after every step and abort path, each restore runs, 70 row ids one result each, a harness exception FAILs (T:450) | V7-1 | missing hook, restore, row; forward need | M (**PA-16**) |
| Q8-01 | Migration (12) then storage (70) on one candidate; one new `0700` folder; handoff absent before the migration child; exclusive create; storage child accepts only this window's clone and backup (T:346–352) | V8-1 | reused or stale handoff | H (**PA-5**, **PA-6**) |

### 1.8 Pre-source ambiguity candidates (to confirm or drop after the source read)

- PA-1 V4-1 final mode `0600` "for each site #1–#14" versus V4-2 recorded or planted mode for #2, #5, #6.
- PA-2 V4-9 scans `tests/host/storage-*.mjs`, which also matches `*.selftest.mjs` files that need temporary folders; the `cp` matcher is not defined.
- PA-3 §4.0 step 8 "when step 3 ran": started or completed.
- PA-4 `d-content-folder` "both cleanups" is not defined; V2-8 needs an exact site count.
- PA-5 V8-1 "this window's migration clone and backup" and "the window's folders" have no binding rule; V8-1 "host only" migration child needs a defined unit.
- PA-6 #16 `wx` handoff versus two rounds of the full mode at one path.
- PA-7 §3.1 step 5: the source of "the `storage_lock_wait` lines of `stack:up`" is not defined.
- PA-8 V1-5 "every event of every test has a non-empty `command`" versus the `storage_lock_selftest` line shape (ADR-012 §7).
- PA-9 #6 plant `write` default mode when no planted mode is given.
- PA-10 return path of the #3 `copyOut` copy; into-volume replace over an existing target with `O_EXCL`.
- PA-11 private scratch root of the migration phase.
- PA-12 `stack:reset` runs inside a candidate command (for example `test:acceptance` in `a-lock-scope`) without a QA segment.
- PA-13 V2-R needs `storage_quarantine_copy`; ADR-012 §9 names only `storage_quarantine`.
- PA-14 `c-host-negative` host scratch (`.tmp/qa-host-negative-*`) holds container-made database files; no scan rule names it.
- PA-15 §3.1 step 9 saved output has no host control.
- PA-16 V7-1: "harness exception" versus a row FAIL caused by fake output; the fake product contract is not defined.
- PA-17 V5-2 and V5-3 inode oracles: inode reuse and the walk scope.
- PA-18 V1-12 spawns `bash … storage-oplock.sh run`, not the row's spawn shape.
- PA-19 #9 `rename` over bound secret files: an unmeasured bind topology (fails closed).
- PA-20 `privateScratch.remove()` after a hit and a correction: remove or keep.
- PA-21 other QA write sites (legacy plants, `INCOMPLETE` markers, private-area writes) outside #1–#16.
- PA-22 other storage-phase `/app-api` writers outside `portal()` and `app()`.
<!-- criterion-map:end -->

## Part 2. Freeze boundary and independence record

| Item | Value |
| --- | --- |
| Map frozen | 2026-10-21T13:02:16Z |
| Map SHA-256 | `c99cf106cf7abf1653e67174736749ee7d78648a25c51757af8af24a6749e808` = SHA-256 of the bytes between the `criterion-map:begin` and `criterion-map:end` markers of this file. The same bytes are in `/Users/quangnguyen/cogniate-qa-runs/storage-repair-testability-qa-20261021T1302Z/criterion-map.md` (mode `0600`, folder `0700`). |
| Source boundary | The first source read was after 13:02:16Z: `git cat-file` of the pins, then a `git archive` of `01ce5bc` (`tests`, `infra`, `package.json`, `.gitignore`) into `…/storage-repair-testability-qa-20261021T1302Z/src/` (umask `077`). Source was read for feasibility only. |
| Not read | Author self-check notes; the commit message bodies of `01ce5bc`, `d0769ed`, `7fbf7c8`, `0a97fe9`, `e493db6` (I saw one-line subjects in `git log --oneline` only); `docs/reviews/M1/storage-repair-reviewer-a.md` and `storage-repair-reviewer-b.md`; the earlier triage reviews (not needed). |
| Concurrent change | At about 13:13Z, the working-tree triage file changed (uncommitted; SHA-256 prefix `0c5bf6a0`; it calls itself revision 4). I saw only the first 60 characters of its lines 1–14 while I checked a line number. I read nothing else of it. Every `T:` reference and judgment here uses `ab28585`. HEAD moved to `e493db6`; `git diff --stat ab28585 e493db6` shows only the two concurrent reviewer reports and two team files. |
| Private folder deviations | (1) A pinned copy of the triage file existed with mode `0644` inside the `0700` folder for less than one minute; I deleted it and wrote it again with mode `0600` from creation. (2) 32 extracted executable source files had mode `0700` (owner only, never group or other); I set them to `0600`. Neither holds a secret. |

## Part 3. Feasibility result per map id (after the source read)

| Map id | Result | Evidence or condition |
| --- | --- | --- |
| Q1-01 | Testable; **no control named** | Pure function; see PR-1 |
| Q1-02 to Q1-08 | Testable host-only | Pure function over injected events, record, `pgid` and clock samples (T:111) |
| Q1-09 | Testable with the Docker stub | Covers `bash …` only; the row spawns `npm` (`storage-rows.mjs:397`); see PR-5 |
| Q1-10 | Testable; **no control named** | See PR-4 |
| Q1-11 | Testable; Author controls present | Release passes `--command "$STORAGE_LOCK_COMMAND"` (`storage-oplock.sh:387–388` at `01ce5bc`); `release` logs through `ctxOf` (`:179`, `:191`, `:315`). The test asserts values for `run -- true`, `lost` and `TERM`, and an `afterEach` asserts a non-empty `command` on every lock-log event (`storage-oplock.test.mjs` at `01ce5bc`). |
| Q1-12 | Verified | `01ce5bc` changes exactly the three §10.1 files. `storage-compat.sha256` line 4 is `90d24679…` = SHA-256 of `storage-oplock.sh` at `01ce5bc`. |
| Q2-01, Q2-02 | Testable host-only (macOS, non-root) | `listRoot` reads with `readdirSync` (`storage-fixture-script.mjs:61–74`); `meta` is new |
| Q2-03 to Q2-06, Q2-08, Q2-10 | Testable on a mock lane | The existing fake-lane pattern runs real row procedures (`storage-rows.selftest.mjs:17`, `:41–60`) |
| Q2-07 | Testable after QA-SRT-03 | |
| Q2-09 | Testable after QA-SRT-05 | 21 sites (§5.1) |
| Q2-R | Feasible | The product logs `storage_quarantine_copy` (`infra/scripts/stack-data.mjs:892`) |
| Q3-01, Q3-02 | Testable host-only | Needs an injectable request function (IR-3) |
| Q3-03 | Verified | Only `portal()` and `app()` write to `/app-api` (`storage-lane.mjs:172`, `:181`; `writeMarkers` `:196`; GET at `storage-rows.mjs:1082`) |
| Q5-01, Q5-03 to Q5-05 | Testable on a mock lane (host temp folders) | APFS file ids are not reused on the measured host, so the inode oracles are sound there |
| Q5-02 | Verified | `infra/.data/` is not tracked (`.gitignore:19`; `git ls-tree 01ce5bc -- infra/.data` is empty). `@prepare`, `gen-env`, `core.mjs` and the two `c-*` rows before `a-fresh` make no `P` (`storage-rows.mjs:27`, `:228–283`; `gen-env.sh` has no `.data` path). Round 2 and the diagnostic use new clones (`core.mjs:85`). |
| Q4-01, Q4-02, Q4-06 to Q4-11 | Testable host-only | Both lanes have a private root, because the migration phase also calls `StorageLane.boot()` (`m1-migration.mjs:179–180`; `storage-lane.mjs:34–44`) |
| Q4-03 | **Contradiction** | QA-SRT-02 |
| Q4-04 | Verified complete | §5.2 |
| Q4-05 | **Cannot pass as written** | QA-SRT-01 |
| Q4-12 | Testable | Handoff paths differ per round in the full mode (`run-m1.mjs:148`), so `wx` does not break round 2 |
| Q6-01, Q6-02 | Testable on a mock lane | QA's product resets are exactly `storage-rows.mjs:1004` (three times) and `:1027`. `test:acceptance` runs only `stack-up.sh` (`infra/scripts/qa-suite.sh:48`, `:59`). |
| Q7-01 | Feasible, large | IR-7 |
| Q8-01 | Testable after QA-SRT-04 | |
| Q*-R | Runtime only | Outside this dispatch |

## Part 4. Findings

Severity follows charter §5. "Required" means: the frozen text needs this change before QA writes the tests.

### 4.1 Required corrections

**QA-SRT-01 — MAJOR — V4-9 cannot pass on a correct tree (T:443, T:283, T:312, T:384).**
- Problem: V4-9 scans `tests/host/storage-*.mjs`. This glob also matches every `storage-*.selftest.mjs` file. X1–X4 are "the only copy or temporary-folder calls outside the helpers that … V4-9 accepts" (T:283), and no exemption may be added during the work (T:312).
- Evidence 1: the current self-tests make temporary folders under `os.tmpdir()`: `storage-rows.selftest.mjs:42`, `:135`, `:173`, `:194`; `storage-fixture-script.selftest.mjs:16`, `:65`; `storage-oracle.selftest.mjs:14`; `storage-inventory.selftest.mjs:37`. V4-1 itself needs "a source at `0644` made by the control". The recommended file `storage-source-inventory.selftest.mjs` (T:384) is inside its own glob and holds the forbidden names as patterns.
- Evidence 2: `logicalRead` (`storage-fixture-script.mjs:107–115`) also runs inside the fixture container. There, ADR-012 §11 requires copies "in the container's own writable layer" (ADR:542), which is the container's `os.tmpdir()`. Site #4 (T:269) keeps the function and names a private scratch for the host only. X1–X4 do not name the container scratch.
- Effect: a correct implementation fails V4-9, or needs an exemption that the design forbids. The work would return to the Architect.
- Smallest correction (T:443 and T:283–287): (a) "source-inventory check of `tests/host/storage-*.mjs` except `*.selftest.mjs`, `m1-migration.mjs`, `run-m1.mjs`"; (b) add "X5 `storage-fixture-script.mjs` `logicalRead` inside a fixture container: its scratch is in the container's own writable layer (ADR-012 §11). The scratch base is a required argument: the container command gives a folder of the container layer, and every host caller gives a `privateScratch`." Recommended, same edit: define the matcher as calls, not text: `copyFile`, `copyFileSync`, `cp`, `cpSync` of `node:fs` or `node:fs/promises`, and `mkdtemp` or `mkdtempSync` with a path built from `os.tmpdir()`.

**QA-SRT-02 — MINOR — V4-1 and V4-2 give two final modes for sites #2, #5 and #6 (T:435, T:436, T:267, T:270, T:271).**
- Problem: V4-1 says "for **each** site #1–#14 … the final mode is `0600` (private)". V4-2 says that `unstash` and the plant `copy`, `write` and `editjson` end with "exactly the recorded or planted mode" (for example `0644`). §7.2 gives #2, #5 and #6 the into-volume helper.
- Smallest correction (T:435, Expected): "…; the final mode is `0600` at the private-helper sites (#1, #3, #4, #7–#14). At the into-volume sites (#2, #5, #6) V4-1 checks only the creation hook (`0600`, size `0`, the same device and inode); the final mode is the V4-2 mode."

**QA-SRT-03 — MINOR — the root-restore trigger is ambiguous for a partial plant (T:149).**
- Problem: "It runs when step 3 ran and step 6 did not confirm …". The plant is one fixture container with two `chown` ops in order (`storage-rows.mjs:532`; `storage-fixture-script.mjs:147–171`). If it fails after the first op, `packages` stays `root:root` and the call throws.
- Effect: if "ran" is read as "completed", no restore runs, and the RC-2 cascade of 47 rows (T:136) returns.
- Smallest correction (T:149): "It runs when step 3 started (also when the plant command failed or timed out) and step 6 did not confirm …". Control proposal PR-6.

**QA-SRT-04 — MINOR — "this window's migration clone and backup" has no rule (T:349, T:451).**
- Problem: `@old-schema-setup` accepts the handoff "only when `m123Clone` and `m123Backup` are this window's migration clone and backup"; V8-1 expects `BLOCKED` for "a clone or backup outside the window's folders". No text defines either term.
- Evidence: the migration clone is `~/cogniate-qa-runs/<RUN_ID>` (`core.mjs:85`); the backup is `<clone parent>/qa-m1-private-backup-<random>/original` (`m1-migration.mjs:204–206`). Neither is inside the new handoff folder. Today the reader checks presence only (`run-m1.mjs:359–360`; `storage-rows.mjs:1024–1025`).
- Problem 2: V8-1 says "host only: a standalone migration child". A real migration child needs Docker in its first step (`m1-migration.mjs:179–180` → `storage-lane.mjs:49`, `docker image inspect`).
- Smallest correction (T:349 and T:451): "This window's" = both paths exist, are real directories of the host user, and have a birth time not earlier than the folder of `QA_M1_HANDOFF_FILE`; `m123Backup` is `original/` in a `qa-m1-private-backup-*` sibling of `m123Clone`. Else `BLOCKED`. V8-1 unit: `writeHandoff` (exclusive, `0600`), the storage-side acceptance function, and the two-child driver wiring with a stub child. No real migration child runs host-only.

**QA-SRT-05 — MINOR — "QA plant" is not defined, so V2-8 has no exact site list (T:184, T:431; M1:254–257).**
- Problem: §4.3 covers "every row-level `finally` restore of a QA plant" and lists some sites "at least". "QA plant" is not defined. "`d-content-folder` (both cleanups, `M1.md`)" does not match M1, which has one cleanup (the unsafe case, M1:254); the absent-children case has no cleanup. "The five `identityCase` rows" are five rows with seven calls (`storage-rows.mjs:597–604`, `:607–615`).
- Evidence: the source has 21 row-level cleanup sites (§5.1). Twelve are outside the list, among them QA containers (`:803`, `:885`), QA process groups (`:1221`, `:1254`), a product toggle (`:472`) and legacy copies (`:651`, `:874`, `:976`, `:983`). Example: a failed decoy removal makes every later `stack:up` refuse `old_layout_container`. That is the same misattributed cascade that §4.3 stops.
- Smallest correction (T:184): add "A QA plant is any change that a step makes for its own setup and must undo: a file, folder, link, owner or mode change, a legacy copy, a QA container, a QA process group, or a product toggle (override marker, test knobs)." Replace "(both cleanups, `M1.md`)" with "(the cleanup of the unsafe case)". QA's §10.2 inventory then uses the list in §5.1 as the V2-8 site list.

### 4.2 Proposed control additions (proposals, not frozen requirements)

Each proposal adds a control for a rule that the frozen text already has. None adds a requirement to the product.

| Id | Rule | Proposed control | Mutation |
| --- | --- | --- | --- |
| PR-1 | T:113 truncated log | log shorter than the offset → FAIL "lock log truncated" | the offset is ignored |
| PR-2 | T:118 more than one release | two releases with `runId` = `X` → FAIL "more than one release for the backup run" | "first or last release" |
| PR-3 | T:120 failed sample | a clock sample fails → FAIL "clock not measured" | a default offset of 0 |
| PR-4 | T:121 saved output | `storage/a-serialize-backup.log` exists after the row, went through `saveText`, and a planted redaction value is absent | output kept in memory only |
| PR-5 | T:116, T:423 `pgid` premise for the row's spawn shape | V1-12b: `spawnGroup('npm', ['run', <script>])`, where the script runs `bash <abs>/infra/scripts/storage-oplock.sh run -- true` with the Docker stub; the acquire `pgid` equals the spawned `pgid` | npm puts the script in another group |
| PR-6 | QA-SRT-03 | V2-6b: the plant changes `packages`, then fails → the restore runs; the next full listing works; the row is FAIL with the plant cause | a restore only after a successful plant |

PR-5 protects against a false FAIL, not a false PASS: the identity step already fails closed (T:116).

### 4.3 Safe deferred items and residual runtime risks

- **SD-1 (MINOR, correct before §9 step 8).** The "Migration phase" scan points include "after the snapshot backup" (T:310). That backup is in phase `snapshot-upgrade` (`m1-migration.mjs:299–303`), and site #14 `configDiff` also runs there (`m1-migration.mjs:286`). That phase has no named phase-end scan point. The diagnostic does not run it.
- **SD-2 (MINOR).** The `c-host-negative` host scratch `<clone>/.tmp/qa-host-negative-<16 hex>/` (`storage-rows.mjs:263–282`) holds QA oracle database files (`t.db`, `storage-fixture-script.mjs:302`, `:330`) and probe scratch during the row. No §7.4 area or ledger names it. Today the oracle empties it and the row removes it in `finally`, so no scan point sees it. Recommendation: assert that it is absent after the row; a leftover is a cleanup failure (§4.3). Synthetic data; no secret.
- **SD-3 (observation, out of scope).** The three `@post-B` occurrences share one need entry (`storage-rows.mjs:56–57`), the same class as N-5. A `g-orphan-complete` failure is then named as `@post-B` in `g-orphan-stopped`. The Lead requested only the `@seed` repair.
- **SD-4 (observation, out of scope).** `i-enable-refusal` restores the defaults outside `finally` (`storage-rows.mjs:453`). A failed check at `:450–452` leaves the test knobs, and `i-candidate-guard` then fails at its first step. A-SFT-05 (g) is not required (T:473).
- **SD-5 (residual runtime risk, fails closed).** In the absent-children case, the stopped service containers still exist (`docker compose stop`, `storage-lane.mjs:74`), so `stack:up` starts existing containers after the children were made again. R3 was measured with new `docker run` containers ([storage-reset-parent-repair](../../architecture/tasks/storage-reset-parent-repair.md):23). That the result is the same for a start of an existing container is an inference. A different result makes the row FAIL; it cannot make a false PASS.
- **SD-6 (residual runtime risk, fails closed).** The uncertainty `u = (h2 − h1) / 2` includes the time of `docker system info`. The observed margin is about 1 s (T:237). A slow engine call gives FAIL "clock uncertainty", never a PASS.
- **SD-7 (NIT).** ADR-012 §7 lists `storage_lock_selftest` with the lock events (ADR:311, ADR:318), but its line has no `command`. V1-5 "every event of every test" must mean the events of the §7 field list. The R1-A test already reads only the lock log.
- **SD-8 (NIT).** T:297 and §7.5 do not say whether `privateScratch.remove()` removes the folder after a hit. Proposed reading: remove it after a successful correction; keep it after a refused correction (phase stop).
- **SD-9 (NIT).** T:117: take the `storage_lock_wait` lines of `stack:up` from its own captured output (`res.lines`), as `a-lock-wait` does (`storage-rows.mjs:380`), not from a command match in the shared log.

### 4.4 Implementation recommendations (no design change)

- **IR-1** `d-symlink`: move the link removal (`storage-rows.mjs:515`) into `finally`, before `unstash`. Else a body failure before `:515` makes the exclusive `unstash` fail (today: the target check at `storage-fixture-script.mjs:188`), and §4.3 then stops the phase.
- **IR-2** `stash` and `copyOut` answers must return each source mode, and `unstash` must receive it. Today `identityCase` drops the `copyout` answer (`storage-rows.mjs:1117`) and `stash` returns no mode (`storage-fixture-script.mjs:193`).
- **IR-3** V3-1: `StorageLane` imports `httpsLoopback` at module level (`storage-lane.mjs:9`). Add an optional request function to the constructor, so the control can record requests.
- **IR-4** The clock sample needs a host time before the engine call; `dockerClock` reads it after (`storage-docker.mjs:36–41`). Optional: take the best of several samples at each point to make `u` smaller. The rule stays fail-closed.
- **IR-5** Private helper: call `fchmod(fd, 0600)` before the `fstat` check. Then an unusual umask (for example `0177`) does not fail a correct copy. Without it the helper still fails closed.
- **IR-6** Diagnostic: use base project names that the `aaa823b` run did not use, so the fresh-lane check does not depend on that run's cleanup. (I made no Docker read.)
- **IR-7 (MINOR clarification recommended for V7-1, T:450).** Build the dry run on the fake-lane pattern (`storage-rows.selftest.mjs:41–60`) and the real fixture script on host temp folders, with fake product answers keyed by the command label. State in V7-1 that a row FAIL caused by a fake answer is allowed, and that only a non-assertion exception (for example `TypeError`) FAILs the dry run. "Each §4.3 restore runs" is possible only where the fake drives the row to its plant; V2-8 covers the failure path of each site.

### 4.5 Pre-source candidates: final state

| Candidate | State | Reason |
| --- | --- | --- |
| PA-1 | QA-SRT-02 | |
| PA-2 | QA-SRT-01 | |
| PA-3 | QA-SRT-03 | |
| PA-4 | QA-SRT-05 | |
| PA-5 | QA-SRT-04 | |
| PA-6 | Dropped | Per-round handoff paths (`run-m1.mjs:148`) |
| PA-7 | SD-9 | |
| PA-8 | SD-7 | |
| PA-9 | Dropped | `write` defaults to `0600` (`storage-fixture-script.mjs:152`) |
| PA-10 | Dropped | The #3 return is `unstash` after the removal of the files in place (`storage-rows.mjs:1121–1127`), so the targets are absent |
| PA-11 | Dropped | The migration lane has a private root (`m1-migration.mjs:179–180`) |
| PA-12 | Dropped | No reset inside `test:acceptance` (`qa-suite.sh:48`, `:59`) |
| PA-13 | Dropped | `stack-data.mjs:892` |
| PA-14 | SD-2 | |
| PA-15 | PR-4 | |
| PA-16 | IR-7 | |
| PA-17 | Note | Sound on APFS (the measured host); not on a file system that reuses inodes |
| PA-18 | PR-5 | |
| PA-19 | Dropped | `stack:reset` removes the secret files first (`stack-reset.sh:36–38`); `copyCredentials` then makes new files, and no container exists |
| PA-20 | SD-8 | |
| PA-21 | Dropped | `e-hot-journal` (`:867`) and `e-added-wal` (`:982`) use `0600` with `wx`; `INCOMPLETE` uses `0600` (`:710`); other writes keep an existing mode (§5.2) |
| PA-22 | Dropped | Q3-03 |

## Part 5. Inventories (tests tree `4c7e067`)

### 5.1 Restore sites (proposed V2-8 list)

"Listed" = named in T:184.

| # | Step | QA plant | Cleanup today | Line | Listed |
| --- | --- | --- | --- | --- | --- |
| 1 | `c-host-negative` | host scratch `.tmp/qa-host-negative-*` | `finally` `rmSync` | `:282` | no |
| 2 | `a-restart-refusal` | empty file in the `ltidb` root (services run) | `finally` plant `remove` | `:351` | no |
| 3 | `a-lock-stale` (2) | live QA process group | `finally` `killGroup` | `:1221` | no |
| 4 | `a-lock-stale` (4) | stub group that keeps a planted lock live | `finally` `killGroup` | `:1254` | no |
| 5 | `i-candidate-guard` | storage-compat override marker | `finally` `stack:storage-compat -- disable` | `:472` | no |
| 6 | `d-stale` | near-match probe file | `finally` `remove` | `:488` | no |
| 7 | `d-unknown` | three planted entries | `finally` `remove` (each) | `:496` | yes |
| 8 | `d-symlink` | WAL stash and link | link removal `:515`; `finally` `unstash` `:516` | `:506–516` | yes |
| 9 | `d-owner` | `lti.db` owner `0:0` | `finally` `chown` back | `:527` | yes |
| 10 | `d-mountpoint` root plant | mountpoints `0:0` | none today; new §4.0 step 8 | `:532` | yes |
| 11 | `d-mountpoint` file case | file in `uploads` | `finally` `remove` | `:549` | yes |
| 12 | `d-mountpoint` link case | `packages` link | `finally` `remove`, `mkdir 0700` | `:552` | yes |
| 13 | `d-content-folder` unsafe case | `uploads` link | `finally` unlink and rename back; P-1a: remove the link, new `uploads` `0700` | `:570` | yes |
| 14 | `identityCase` (5 rows, 7 calls) | identity, database and sidecar changes | `finally` `remove`, then `unstash` | `:1119–1128` | yes |
| 15 | `e-not-same-import` | legacy copies | `finally` `legacy.removeAll()` | `:651` | no |
| 16 | `g-quarantine-in-use` | QA volume-user container | `finally` `docker rm` | `:803` | no |
| 17 | `e-hot-journal` | legacy `lti.db-journal` | `finally` unlink | `:874` | no |
| 18 | `e-old-layout` | QA decoy container | `finally` `docker rm -f` | `:885` | no |
| 19 | `e-changed-byte` | one changed legacy byte | `finally` change back | `:976` | no |
| 20 | `e-added-wal` | legacy `lti.db-wal` | `finally` unlink | `:983` | no |
| 21 | `e-content-missing` | package folder hold | `finally` rename back | `:1051` | yes |

Cleanups inside a step, without `finally` (recommend the same rule): `b-oracle-lti` and `b-oracle-app` in-volume `.qa-scratch-*` (removed by the oracle op, checked at `:1107–1108`); the QA container time bound (`storage-lane.mjs:95–99`). The absent-children case of `d-content-folder` (P-1a) has no plant to undo.

### 5.2 Copy and write sites

Every site of T:264–281 is at the stated place, with the stated behavior (✔).

| Site | Pinned lines | Today (source) | ✔ |
| --- | --- | --- | --- |
| #1 `stash` | `storage-fixture-script.mjs:180–197` (copy `:190`) | `copyFileSync` with `COPYFILE_EXCL`, source mode kept | ✔ |
| #2 `unstash` | same | hold-file mode kept | ✔ |
| #3 `copyOut` | `:221–235` | copy, then `chmod` to the source mode; used by `identityCase` (`storage-rows.mjs:1117`) and `e-not-same-import` (`:644–645`) | ✔ |
| #4 `logicalRead` | `:107–139` | `mkdtempSync(scratchBase = os.tmpdir())`, copies keep the mode; container and host (through #10) | ✔ (see QA-SRT-01) |
| #5 plant `copy` | `:174–178` | `copyFileSync` `EXCL`, source mode | ✔ |
| #6 plant `write`, `editjson` | `:150–153`, `:198–206` | `write`: `{ mode: op.mode ?? 0600, flag: 'wx' }` (umask applies); `editjson`: temp with `st.mode & 0777`, `wx`, rename | ✔ |
| #7 `oracle-B` | `:289` | plain copy (self-test only) | ✔ |
| #8 `LegacyFixtures.place` | `storage-oracle.mjs:233–241` | copy `EXCL`, then `chmod 0600` | ✔ |
| #9 `copyCredentials` | `storage-rows.mjs:1334–1349` | `.env` rewritten in place (`:1342`); four files copied, then `chmod 0600` (`:1346`) | ✔ |
| #10 `backupLogical` | `storage-lane.mjs:218–229` | `mkdtempSync(os.tmpdir())`, plain copy; then `logicalRead` makes a second host scratch | ✔ |
| #11 `storagePaths` | `storage-rows.mjs:1304–1322` | `mkdtempSync(os.tmpdir())`, plain copy | ✔ |
| #12 backup copies | `:687`, `:707`, `:709`, `:992` | `cpSync` recursive | ✔ |
| #13 damage copies | `m1-migration.mjs:218` | `cpSync` recursive | ✔ |
| #14 `configDiff` | `storage-compat-route.mjs:200–219` | shell `>` into `mkdtempSync(os.tmpdir())`; removed only on success (`:218`); also in phase `snapshot-upgrade` (`m1-migration.mjs:286`) | ✔ |
| #15 markers | `storage-rows.mjs:558` (`qa.txt`, no mode), `:502` (`0600`, no `wx`) | | ✔ |
| #16 `writeHandoff` | `m1-migration.mjs:163–171` | `0600`, no `wx`; written once, at the end of `migrationRun` (`:263`) | ✔ |
| X1 | `storage-lane.mjs:46` | copy, then `chmod 0555` | ✔ |
| X2 | `storage-rows.mjs:1070` | `cpSync` of course folders into `P/packages` | ✔ |
| X3 | `storage-compat-route.mjs:186` | git index in `mkdtempSync(os.tmpdir())` (never removed; not a protected class) | ✔ |
| X4 | `run-m1.mjs:141` | accounting scratch `0700` | ✔ |

Other writes found; none needs a P-3 change: `rawwrite` in place (`storage-fixture-script.mjs:208–212`, existing mode kept), `mkdir` op (`:173`), `flip` (`:160–168`); `h-nomanifest` `INCOMPLETE` (`storage-rows.mjs:710`, `0600`); `e-hot-journal` (`:867`) and `e-added-wal` (`:982`), `0600` with `wx`; `e-changed-byte` in place (`:972–976`); `g-damaged` and `h-old-manifest` rewrites of existing copies (`:689`, `:694`, `:994`); `m1-migration.mjs:220`, `:225` (existing files); lock records (`storage-oracle.mjs:270–275`, `0600`, `wx`); host-control files (`storage-rows.mjs:1262`; `m1-control.mjs:62`, `:68`); evidence through `saveText` (`core.mjs:109–114`) and the redaction rewrites (`run-m1.mjs:371`, `core.mjs:438`); course fixtures (`run-m1.mjs:317`); the frozen tests archive (`run-m1.mjs:204–208`). `core.mjs` copies no protected class into a lane area (`:233`, `:251`, `:354`).

### 5.3 Scan areas, scratch roots and temporary sites

| Root | Made by | Holds | Covered by |
| --- | --- | --- | --- |
| `<clone>-storage-private/` `bin/`, `out/`, `backups/`, `quarantine/` (storage lane and migration lane) | `StorageLane.boot()` (`storage-lane.mjs:34–46`) | fixture script; holds and markers; product and QA backups; quarantine copies | §7.4 private areas and `bin/` rule |
| `<clone>-storage-private/scratch/` | new (`privateScratch`) | #4 host, #10, #11, #14 | §7.4 |
| `qa-m1-private-backup-*`, `qa-m1-snapshot-private-*` (clone parent) | `m1-migration.mjs:204–205`, `:299–300` | AC-M1-23 backup and damage copies; snapshot backup | §7.4 (SD-1 for the snapshot points) |
| legacy folders `infra/.data/lti-service/`, `infra/.data/cogniate-app/` (direct entries) | `LegacyFixtures.place`; `e-hot-journal`; `e-added-wal` | QA legacy copies and plants | §7.4 outside rule |
| `.env`, `infra/.secrets/**` of the storage clone | #9 | copied credentials | §7.4 QA write ledger |
| `<clone>/.tmp/qa-host-negative-*` | `c-host-negative` | oracle `t.db*`, probe scratch (during the row) | none (SD-2) |
| `<clone>/.tmp/storage-op.<P>.*` | `a-lock-stale` plants | lock records | not a protected class |
| `os.tmpdir()`: `qa-backup-read-*`, `qa-logical-*`, `qa-storage-paths-*`, `qa-compat-config-*` | #10, #4 host, #11, #14 | database copies; `env -0` output | moved to `privateScratch` |
| `os.tmpdir()`: `qa-tree-*`, `qa-m1-accounting-*` | X3, X4 | git index; result files and the full-mode handoff | exceptions |
| container `/tmp` (`qa-selftest-*`, `qa-logical-*`) | `c-selftest`; fixture `logicalRead` | probe self-test; logical-read copies | container layer, `--rm` (QA-SRT-01 X5) |
| in-volume `.qa-scratch-*` | `b-oracle-*` | oracle database | not host-visible |
| new diagnostic folder (`0700`) | QA, §9 step 7 | the handoff (ids and paths) | §9 step 7 |

## Part 6. Exact proposed implementation file list

QA (`tests/**` only; base tree `4c7e067`):

| File | Change |
| --- | --- |
| `tests/host/storage-rows.mjs` | `a-serialize` (§3.1); `d-mountpoint` (§4.0); `a-fresh` and `d-content-folder` (P-1a); phase stop in `storagePhase` (§4.3); `@seed-resume` (N-5); scan hook after every step; log archive before `:1004` and `:1027` and at the phase end; sites #9, #11, #12, #15; IR-1 |
| `tests/host/storage-fixture-script.mjs` | `meta`; both copy helpers; sites #1–#7; required scratch base for `logicalRead` (X5); stash and copy-out modes (IR-2); `listRoot` unchanged |
| `tests/host/storage-lane.mjs` | `Origin` on non-GET in `portal()` and `app()`; optional request function (IR-3); `scratch/` in `boot()` and `privateScratch`; site #10; `bin/` rule |
| `tests/host/storage-oracle.mjs` | site #8; optionally the pure `a-serialize` verdict function |
| `tests/host/m1-migration.mjs` | sites #13 and #16; migration scan points; the handoff window rule (QA-SRT-04) |
| `tests/host/storage-compat-route.mjs` | site #14 (needs the migration lane's private root through `this.lane`) |
| `tests/host/storage-private-scan.mjs` (new) | §7.4 scan and §7.5 hit record and correction |
| `tests/host/storage-docker.mjs` | only if the clock sample (`h1`, `E`, `h2`) goes into `dockerClock` (`:36–41`); this file is not in T:376–384, so a new module is the other way |
| `tests/host/run-m1.mjs` | only a two-child diagnostic driver; no change of the `full` mode |
| `tests/host/storage-private-copy.selftest.mjs` (new) | V4-1 to V4-8 |
| `tests/host/storage-source-inventory.selftest.mjs` (new) | V4-9 (after QA-SRT-01) |
| `tests/host/storage-rows.selftest.mjs` | V1 (with PR-1 to PR-5), V2-3 to V2-9 (with PR-6), V5, V6, V7, V8 storage side; V3-1 and V3-2, unless a new `storage-lane.selftest.mjs` holds them |
| `tests/host/storage-fixture-script.selftest.mjs` | V2-1, V2-2, V4 fixture sites |
| `tests/host/m1-migration.selftest.mjs` | #13, #16 and the V8-1 writer (not in T:384; recommended) |
| `tests/host/storage-compat-route.selftest.mjs` | #14 (not in T:384; recommended) |

Product (Author, R1-A, already at `01ce5bc`; independent source reviews pending): `infra/scripts/storage-oplock.sh`, `infra/scripts/storage-oplock.test.mjs`, `infra/compat/storage-compat.sha256`. No other product file. A-SFT-08 stays deferred to M4 (`stack-data.mjs` unchanged).

Architect (text only, for QA-SRT-01 to -05): `docs/architecture/tasks/storage-full-round-triage.md` (T:149, T:184, T:283–287, T:349, T:435, T:443, T:451). No change to `M1.md` or ADR-012 is needed for these corrections.

Not changed: `tests/host/storage-inventory.mjs`, `tests/host/m1-storage-manifest.json`, row ids, row counts. The 32 live-LMS rows stay UNVERIFIED. Local Canvas stays DEFERRED.

## Part 7. Verdict

**Verdict: FAIL (design testability only), Round 1.**

- Testable as frozen, except for the items in the next bullet: the RC-1 oracle and V1 (four rules lack a named control: PR-1 to PR-4), the R1-A command contract (scope, hash and Author controls verified at `01ce5bc`), the RC-2 procedure and the phase stop, RC-3 `Origin`, the exact P-1a criterion (M1:230, M1:253–259), the log archive, N-5, and the scan and correction rules. All 16 copy sites and X1–X4 match the source, and the inventory has no missing protected-class site.
- Not testable as frozen: V4-9 (QA-SRT-01, MAJOR). Ambiguous or contradictory: V4-1 against V4-2, the root-restore trigger, the handoff window rule, and the restore-site scope (QA-SRT-02 to -05, MINOR).
- The five corrections are text only and bounded to the triage file. They do not change the architecture, a product file, R1-A, the A-SFT-08 deferral, a row id or a row count. After them, I expect a PASS. PR-1 to PR-6 are proposals; SD-1 to SD-9 are safe to defer as stated; IR-1 to IR-7 are for the implementation dispatch.
- No acceptance credit. No implementation was done in this dispatch.

## Round 2

Verdict for this round: **PASS (design testability only)**. Target: revision 4 of `docs/architecture/tasks/storage-full-round-triage.md`. This is a bounded addendum. No acceptance credit.

### R2.1 Provenance and frozen inputs

- Owner: a **fresh** independent QA instance (Claude Code Opus 5.5, xhigh). Task `task_f8174e4a191e`, dispatch `ctx_b079f49025d8`, run `run_ebe671ad72a9`. Date: 2026-10-21.
- Round 1 (Parts 1–7 above) is the historical evidence of the **preceding** QA instance (task `task_1fb4229dead2`, dispatch `ctx_c46c7c8e09eb`). This instance did not write the Round 1 map and did not freeze it. Round 1 text is unchanged. Only the two status lines at the top of this file changed (from `FAIL` and `1`), as charter §6 requires. Part 7 keeps the Round 1 verdict.
- Before this edit, the file at `0468b19` had SHA-256 `de4116bf4f30dc019fdf76a9d18bf6c35fa7f0737b4e0ae6434d8cd653e91af3`. The bytes between the Round 1 `criterion-map` markers still hash to `c99cf106…e808` (checked before and after this edit).

| Input | Pin | SHA-256 |
| --- | --- | --- |
| Triage, revision 4 (target) | `2d763fec502f6b7758b7ed56f51613183e5021ce` | `ade4e8a0f9e54823040828758b7683d5c9b230587747f3ef3c89ef8e99f9a032` (equal) |
| Triage, revision 3 (diff base) | `ab285856c139ddd50be8c8482eec1a330b7055da` | `70ba4f9b…1dba` (equal) |
| `docs/architecture/tasks/M1.md` | `2d763fe` | `b648853cea837284020229a99db81b699066fa916876f90905eb374fdba61057` (unchanged) |
| `docs/architecture/adr/ADR-012-sqlite-volume-storage.md` | `2d763fe` | `57602ca4cf9dc82ea2fb874d2ef8618dad204ca7d1727bfa56ee3fa6746fa589` (unchanged) |
| `docs/team/charter.md` | `2d763fe` | `5289f7f7…3054` (unchanged) |
| Tests tree | `2d763fe:tests` = `4c7e067…` (= `F`; unchanged) | — |
| Product R1-A | `01ce5bc` | as Round 1 |

Commit `2d763fe` changes only the triage file (+182, −48). `M1.md` and ADR-012 are byte-identical, so the exact P-1a and O-1 criteria that Round 1 confirmed are unchanged.

<!-- criterion-map-r2:begin -->
### R2.2 Changed-criterion map (frozen before any Round 2 source read)

Written from the diff `ab28585..2d763fe` of the triage file only (revision 4, SHA-256 `ade4e8a0…a032`). "T4:" = a line of revision 4. Classes as in Part 1 (H, M, R). The Round 1 map ids stay valid. A row below either changes a Round 1 id (named) or adds a new id.

| Map id | Changed criterion (revision 4) | Test and observable oracle | Mutation that must fail it | Class | Round 1 id |
| --- | --- | --- | --- | --- | --- |
| Q2R-01 | Source-inventory scope = runtime modules only (`storage-*.mjs` without `*.selftest.mjs`, plus `m1-migration.mjs`, `run-m1.mjs`); exact token regex over the whole text; exact per-file counts X1–X8; no runtime import of a self-test (§7.2) | V4-9 over the repaired tree; mutations on a temporary copy of the scope | a token at a #1–#16 site; a new `storage-x.mjs` with a token; a default `scratchBase`; an import of a self-test; a scope that matches self-tests | H | Q4-05 (QA-SRT-01) |
| Q2R-02 | `logicalRead` has no default `scratchBase`; a call without it throws; container `main()` passes the container temp folder (X5, X6); every host call passes a `privateScratch` path; the only host caller is #10 (§7.2 #4) | V4-1 (#4, #10): final file inside `scratch/`; call without base throws | default `scratchBase`; host scratch outside `scratch/` | H | Q4-01, Q4-06 |
| Q2R-03 | V4-1 covers copy sites #1–#13; final `0600` at #1, #3, #4, #7–#13; at #2, #5, #6 only the creation hook; final mode = V4-2 | V4-1 per site under umask `022` and `000` | an into-volume site that ends at `0600`; copy then `chmod` | H | Q4-03 (QA-SRT-02) |
| Q2R-04 | Private empty file: exclusive no-follow `0600` create; `fstat` regular, host user, `0600`, size 0; return dev/inode; caller `lstat` before the shell (regular, same dev/inode, `0600`, size 0, one link) and after the shell (regular, same dev/inode, `0600`); else FAIL, no captured byte read (§7.3, #14) | V4-8 variants: pre-existing target; link before the shell; non-empty target; other inode during the shell (fake shell) | create without `O_EXCL`/`O_NOFOLLOW`; no `lstat` check before or after the shell | H | Q4-11 |
| Q2R-05 | `privateScratch` uses `mkdirSync`, mode `0700`; `remove()` scans first; zero hits → removes; a hit → step FAIL and the folder is kept, also after a safe §7.5 correction; a correction never turns FAIL into PASS (§7.3, SD-8) | a hit in a scratch, then a safe correction: the folder and the file still exist; step FAIL | `remove()` deletes after a correction; FAIL that turns PASS | H | Q4-06 (SD-8) |
| Q2R-06 | Lane private root closure: exactly `bin/`, `out/`, `backups/`, `quarantine/`, `scratch/`; root and each entry a real directory of the host user, mode exactly `0700`; else FAIL "private root not closed: `<entry>`"; checked at each scan point of the owning phase; storage, migration and snapshot-upgrade lanes (§7.4) | V4-10 variants (a)–(f) | scan of named areas only; name check without type, mode or owner | H | new |
| Q2R-07 | Scan points split: migration phase (after private backup, each damage copy, each `configDiff` scratch removal, phase end); snapshot-upgrade phase (each `configDiff` removal, after the snapshot backup, phase end); snapshot points required in the full gates before full acceptance; §7.5 phase FAIL and stop for both phases (§7.4, §7.5, §9 step 8) | inspection of the hook calls per phase; scan unit tests (V4-3, V4-7) | a missing snapshot phase-end scan | H (inspection) / R | Q4-08 (SD-1) |
| Q2R-08 | QA plant definition; exact 21-site list; site 14 = seven calls; one cleanup for `d-content-folder`; 27 injections; one-op fixture scratch is not a row-level plant (§4.3) | V2-8: one injection per site and per site-14 call; phase stop as V2-4 each | a site without the abort rule; a site-14 call without it | M | Q2-09, Q5-06 (QA-SRT-05) |
| Q2R-09 | Root-restore trigger: step 3 started (also failed or timed out); partial plant restores only the root-owned entry (§4.0 step 8) | V2-10 (fail and time-out variants) | restore only after a successful plant | M | Q2-07 (QA-SRT-03) |
| Q2R-10 | `a-serialize` wait lines from the captured `stack:up` output (`res.lines` of `a-serialize-up`) (§3.1 step 5, SD-9) | V1-9 with the wait line given as captured output | a command match in the shared log | H | Q1-04 |
| Q2R-11 | V1-12 on the actual row path: `spawnGroup('npm', ['run','stack:data-backup','--','--out',…])` in a `git archive` scratch copy, row environment, fail-closed Docker stub (exit 97); one acquire, `pgid` = spawned `pgid`, `command` = `stack:data-backup`; A6 before the first Docker call; non-zero exit; no lock folder left; `npm --version` recorded | V1-12 | identity premise false through the `npm` hop; acquire command not the backup's own | H (stub) | Q1-09 (PR-5) |
| Q2R-12 | PR-1 to PR-4 as V1-13 to V1-16; SD-7 in V1-5 | V1-13 to V1-16; V1-5 | as Round 1 PR-1 to PR-4 | H / M | Q1-01, Q1-05, Q1-07, Q1-10, Q1-11 |
| Q2R-13 | Handoff binding §9.1: window channel `QA_M1_WINDOW_START` (exact ISO form; new `w` per round in `full` mode; after `D` in the diagnostic); storage-child facts (run root, `-st` project and base `b`, candidate SHA, start `s`, host uid); items 1–5 (window; handoff file, folder, mtime, JSON, absolute real paths; clone name, owner, birth time; backup root name, mode, birth time; backup manifest `composeProject` = `b`); one shared function; else `BLOCKED` with the item | V8-1 (positive), V8-2 (stale), V8-3 (outside), V8-4 (type, owner, variable) on synthetic folders | a check that trusts the handoff path; a window per run; link follow; prefix-only check | H | Q8-01 (QA-SRT-04) |
| Q2R-14 | `full` mode: one new `w` per round before that round's migration child; per-round handoff path unchanged; no other `full`-mode change (§9.1, §10.2) | V8-5 with a spawn recorder, two rounds | one `w` per run; shared handoff path; changed phase list | H | Q8-01 |
| Q2R-15 | Diagnostic run-or-stop rule (a)–(f); "storage NOT RUN: `<cause>`"; owned teardown and strict W4; the storage child runs the §9.1 check again (§9 step 7) | V8-6 with child stubs | storage start after a migration failure; stop without teardown or W4 | H | Q8-01 (B-SR-02) |
| Q2R-16 | V7-1: a fake-caused row FAIL is allowed only when declared first with row id and cause; any other FAIL, missing coverage, unsafe order, failed cleanup or unexpected exception FAILs the dry run (Lead: compare declared expected row and cause results) | V7-1 | an undeclared row FAIL accepted; a declared result that is not compared | M | Q7-01 (IR-7) |
| Q2R-17 | Limits added: birth time needed (fails closed elsewhere); V4-9 binds per file and count, not per function; SD-3 to SD-6 recorded (§13) | inspection | — | — | — |

Not normative for QA testability (checked only for consistency): the `app.test.ts` citation (§5), the header and history, §0 rows, §14 note, §15 map.
<!-- criterion-map-r2:end -->

### R2.3 Freeze boundary and independence record

| Item | Value |
| --- | --- |
| Changed-criterion map frozen | 2026-10-21T13:33:47Z |
| Map SHA-256 | `b95456ebb1b8af079330ff43ad484d863dce8a302dac3fbf3fbc141ce2f6bbe9` = SHA-256 of the bytes between the `criterion-map-r2` markers. The same bytes are in `/Users/quangnguyen/cogniate-qa-runs/storage-repair-testability-qa-r2-20261021T1328Z/criterion-map-r2.md` (mode `0600`, folder `0700`). |
| Read before the map | This report; charter §5–§7; the Lead's freeze message; `git diff ab28585 2d763fe` of the triage file; the §12 control rules of revision 4. No source. |
| Source boundary | After 13:33:47Z, targeted reads only: `git show` of tests files at `4c7e067`, of `infra/` files and `package.json` at `01ce5bc`, and of `app.test.ts` at `aaa823b`; metadata (names, types, owners, modes, birth times) of existing folders under `~/cogniate-qa-runs`. No content of a private file. |
| Not read | The working-tree triage file before the freeze; `docs/reviews/M1/storage-repair-reviewer-a.md` and `-reviewer-b.md`; every concurrent confirmation report; R1-A Author and product-QA reports; the team-file changes of `42d14a9`. |
| Probes and deviations | No probe. No Docker, no runtime, no write outside the private folder and this file. Private files were `0600` from creation (umask `077`). No deviation. |

### R2.4 Closure of the Round 1 findings

| Finding | Revision 4 change | Targeted source check | State |
| --- | --- | --- | --- |
| QA-SRT-01 (MAJOR) V4-9 | §7.2: scope = runtime modules; exact token regex; exact per-file counts X1–X8; `logicalRead` without a default `scratchBase`; X5, X6; V4-9 mutations | The regex finds 30 matches in the nine runtime modules at `4c7e067`. Each match is a site or X1–X4, X7, X8: `m1-migration.mjs` `:204` X7, `:218` #13, `:299` X8; `run-m1.mjs` `:141` X4; `storage-compat-route.mjs` `:186` X3, `:202` #14; `storage-fixture-script.mjs` `:107` (#4 default base), `:111` X5, `:115` #4, `:177` #5, `:190` #1/#2, `:229` #3, `:289` #7; `storage-lane.mjs` `:46` X1, `:222`, `:224` #10; `storage-oracle.mjs` `:238` #8; `storage-rows.mjs` `:687`, `:707`, `:709`, `:992` #12, `:1070` X2, `:1307`, `:1309` #11, `:1346` #9; `storage-docker.mjs` and `storage-inventory.mjs` none. No match is in a comment or a string. After the moves that §7.2 names, the counts equal the X1–X8 table. `logicalRead` has two callers only: container `main()` (`storage-fixture-script.mjs:382`) and host #10 (`storage-lane.mjs:225`). `fixtureArgs` sets no environment and mounts only the lane volumes, `/qa/bin` and `/qa/out` (`storage-docker.mjs:16`, `:103–131`), so X6 is never a host path. The text matcher with exact counts fails closed; it is an acceptable replacement for Round 1's call matcher. | **Closed** |
| QA-SRT-02 (MINOR) V4-1 against V4-2 | V4-1: final `0600` at #1, #3, #4, #7–#13; creation hook only at #2, #5, #6; #14 in V4-8 | Text only | **Closed** |
| QA-SRT-03 (MINOR) restore trigger | §4.0 step 8: "step 3 started" (also failed or timed out); a partial plant restores only the root-owned entry; V2-10 (PR-6 plus a time-out) | Text only; order (a)–(d) unchanged | **Closed** |
| QA-SRT-04 (MINOR) handoff window | §9 step 7, §9.1, V8-1 to V8-6. Round 1's folder-birth rule is replaced. The reason is correct: both `full`-mode rounds share one accounting scratch (`run-m1.mjs:141`, `:148`), so a folder-based window accepts round-1 entries in round 2. | Every fact of §9.1 exists without the handoff: `identity.productSha` (`run-m1.mjs:115`); `RUN_ID` = project, first 8 of `--sha`, ISO time with `:` and `.` as `-`, and the default clone folder (`core.mjs:84–85`); migration project `baseProject`, storage project `${baseProject}-st` (`run-m1.mjs:144`, `:153`); `lane.clone` = `r.CLONE` (`storage-lane.mjs:31`); `migration` runs directly before `storage` (`m1-phases.mjs:4`), so a per-round `w` also rejects the snapshot clones of that round; backup root made next to the clone, `0700`, with `original/` (`m1-migration.mjs:204–206`); handoff written last (`:263`); backup `manifest.json` with `composeProject` = project (`stack-data.mjs:703`, `:72–76`), written after the maintenance container drops to the host user (`compose.yaml:381`). Host metadata: `~/cogniate-qa-runs` equals its real path; 12 existing clone names match the item 3 form; two existing backup root names match the item 4 form, and four snapshot root names have the other prefix that item 4 rejects; APFS birth times are non-zero; `os.tmpdir()` differs from its real path (as V8-1 says). No real migration child runs host-only. | **Closed** |
| QA-SRT-05 (MINOR) QA plant | §4.3: definition; 21-site table; one `d-content-folder` cleanup; 27 injections | The table equals Round 1 §5.1 (steps, lines, restores). 27 = 20 sites + 7 site-14 calls. | **Closed** (NIT R2-05) |

### R2.5 Changed controls: feasibility

| Control | Result | Evidence or condition |
| --- | --- | --- |
| V1-5 (SD-7) | Testable (Author) | Wording only |
| V1-9 with §3.1 step 5 (SD-9) | Testable H | `a-serialize-up` is a `product()` call (`storage-rows.mjs:402`); `res.lines` is used the same way in `a-lock-wait` (`:380`) |
| V1-12 (PR-5, actual `npm` path) | Testable with the stub | At `01ce5bc`: `package.json:25` → `stack-data.sh` → `lib.sh` reads `.env` only when it exists (`lib.sh:19`) → `storage_compat_guard` reads only the marker file (`storage-compat.sh:114`) → `storage_lock_acquire "stack:data-backup"` (`stack-data.sh:32`). On a fresh copy, A1–A5 make no Docker call (the A5 lister runs only for a stale record, `storage-oplock.sh:126–127`). A6 logs first; the first Docker call is the lister after it (`:141–144`); its failure releases quietly (`:151`). So a correct candidate gives one acquire with `command` `stack:data-backup`, a non-zero exit and no lock folder. The `pgid` equality is the measured premise; a false premise FAILs the control (fail closed). |
| V1-13 to V1-16 | Testable | Equal to PR-1 to PR-4 |
| V2-8 | Testable on a mock lane (large) | 27 injections; the fakes must drive each row to its plant |
| V2-10 | Testable on a mock lane | PR-6 plus a time-out variant |
| V4-1 | Testable H | QA-SRT-02 closed |
| V4-8 | Testable H; gap **R2-01** | The #14 variants discriminate |
| V4-9 | Testable H | Counts verified (R2.4); IN-1 |
| V4-10 | Testable H | Only `boot()` makes root entries (`storage-lane.mjs:34–43`; no other use of `.private` in the runtime modules), each with mode `0700`. The migration and snapshot phases boot one lane each (`m1-migration.mjs:180`, `:280`); `oldLane` uses the same root. I did not measure the nine roots of §7.4 again. |
| V7-1 | Testable on a mock lane; gap **R2-02** | |
| V8-1 to V8-4 | Testable H | IN-2 |
| V8-5 | Testable H only with a seam; **R2-03** | |
| V8-6 | Testable H | New driver code; IN-3 |

The scan points of both migration phases are explicit (§7.4). The snapshot-upgrade points, and its phase-end scan, are required in the full gates before full acceptance (§9 step 8). `configDiff` runs in that phase at `m1-migration.mjs:286`, after `boot()`, so #14 has a private root there.

### R2.6 Remaining items

Severity follows charter §5. None blocks.

**R2-01 — MINOR — the §7.3 keep rule has no control (T4 §7.3 `privateScratch`; §12 V4-8).**
- Problem: §7.3 keeps the scratch after a hit, also after a safe correction (SD-8, Lead). V4-8 still expects "the step FAILs before the removal" and names no mutation for a deletion. V4-7 covers a deletion only at a scan point, not in `remove()`.
- Effect: a `remove()` that deletes the folder after a hit or after a correction passes V4-8 as written.
- Smallest correction (V4-8): Expected: "the step FAILs; `remove()` keeps the folder and the file, also after a safe §7.5 correction; the step stays FAIL." Mutation: "a `remove()` that deletes after a hit or after a correction."

**R2-02 — MINOR — V7-1 compares in one direction only (T4 §12 V7-1).**
- Problem: V7-1 allows a fake-caused FAIL only when it is declared with its row id and cause, and it FAILs on any other FAIL. It does not say what happens when a declared result does not occur, or when a row is `BLOCKED` without a declaration.
- Effect: an allow-list implementation meets the text but does not compare declared and observed results (Lead condition). A row that is `BLOCKED` by a wrong need, or a declared FAIL that becomes PASS, does not FAIL the dry run.
- Smallest correction (V7-1): "Before the run, the dry run declares the expected status and cause of each row that is not expected to PASS. The observed status and cause of all 70 rows must equal this map. Else the dry run FAILs." Mutation: "a declared FAIL that does not occur; an undeclared `BLOCKED` row."

**R2-03 — MINOR — V8-5 needs a seam that §10.2 does not allow in words (T4 §10.2 `run-m1.mjs`; §12 V8-5).**
- Problem: §10.2 allows "only `QA_M1_WINDOW_START` for each round; no other change of the `full` mode". V8-5 needs "the child spawn replaced by a recorder", host only. The `full` branch spawns through `childRun` → `run(process.execPath, …)` of `lib.mjs` (`run-m1.mjs:128–129`). It has no injection point, and it first runs git checks on the frozen source (`:118–125`).
- Effect: V8-5 needs either a code seam (literally "another change") or a loader that replaces `lib.mjs` (indirect and brittle). It is possible, so the item does not block. The §9.1 "Unchanged" list already names what must not change.
- Smallest correction (§10.2): "A behavior-neutral seam that lets V8-5 replace the child spawn is allowed. It changes no phase, order, variable, result file or assertion of the `full` mode."

**R2-04 — NIT — helper call list (T4 §7.2).** §7.2 says that the §7.3 helpers "use `open`, `mkdir`, `readdir` and `lstat` calls only". §7.3 also needs `fstat`, `fchmod`, `fsync`, `rename` (#9, `editjson`) and a removal (`privateScratch.remove()`). Read it as "the helpers make no token call". No effect on a test.

**R2-05 — NIT — one QA process group is not named (T4 §4.3).** `a-lock-wait` starts a QA process group that holds the lock (`storage-rows.mjs:372`, `storage-oplock.sh run -- sleep 150`) and waits for it in `finally` (`:389`). The new definition covers it ("a QA process group"), but it is not in the 21-site list, and the exception names only fixture operations. Its `finally` has no undo step that can fail: the holder ends after a bounded time and releases its own lock. Recommendation: name it under the self-removing exception, or add it as site 22 (then 28 injections). This corrects the Round 1 §5.1 inventory of the preceding instance. It is not a new design issue.

Implementation notes (no design change; not requirements):
- **IN-1** V4-9 fixes `run-m1.mjs` at `mkdtempSync` 1 and `tmpdir` 1 (X4). The diagnostic folder `D` must not add a token. Use `mkdirSync` with mode `0700` and a random name, or reuse the one X4 call. A second `mkdtempSync(os.tmpdir())` FAILs V4-9.
- **IN-2** V8-1 to V8-4: `w` and `s` have millisecond resolution; birth times and `mtime` are finer. Where a case needs an order between a time value and a file event, the control waits until `Date.now()` is at least 1 ms past the earlier value. Else a stale case can look fresh in the same millisecond, or `H.mtime ≤ s` can fail in the positive case. The product check stays fail closed; only the control would be flaky.
- **IN-3** Run-or-stop (c) and V8-6: the migration child must publish its scan hits and corrections (for example in its result file), so that the driver can apply (c). The stub uses the same channel.
- **IN-4** X6: `main()` passes the operation spec to `logicalRead` (`storage-fixture-script.mjs:382`). It must set `scratchBase` after the spec, so that a spec value cannot replace the container temporary folder.

### R2.7 Verdict

**Verdict: PASS (design testability only), Round 2.**
- Revision 4 closes QA-SRT-01 to QA-SRT-05. The changed scan, cleanup, oracle and handoff texts agree with each other and with the pinned source. The remaining items are R2-01 to R2-03 (MINOR) and R2-04, R2-05 (NIT). Each is a one-sentence text change or an implementation choice. I recommend that the Lead decides R2-01 to R2-03 before QA writes V4-8, V7-1 and V8-5.
- Lead conditions: PR-1 to PR-4 and PR-6 are V1-13 to V1-16 and V2-10. PR-5 is the actual `npm` path in V1-12, and it is feasible at `01ce5bc`. The snapshot-upgrade scan points and its phase-end scan are explicit and required before full acceptance. A scan hit keeps the scratch after a safe correction (§7.3; control gap R2-01). V7-1 rejects undeclared FAILs, but its comparison is one-way (R2-02).
- `M1.md` and ADR-012 are byte-identical to the confirmed hashes. Revision 4 changes no criterion text in them.
- Limits: design testability only. No acceptance credit. No implementation, Docker, runtime suite or live service. The source checks covered the changed text only. The Round 1 inventories were not swept again; R2-05 came from one targeted check of the `spawnGroup` calls. The nine-root metadata of §7.4 was not measured again. V1-12 feasibility is a source reading of `01ce5bc`; the `npm` process-group premise stays a measurement of that control. The diagnostic and the full rounds are outside this dispatch.
