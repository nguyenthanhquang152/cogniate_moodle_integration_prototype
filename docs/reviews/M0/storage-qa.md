Verdict: FAIL (design testability) — 13 required fixes (MAJOR), 6 MINOR, 2 NIT; no BLOCKER
Round: 1, task `task_f86ec03635e4`, dispatch `ctx_cccf34f08216`, 2026-10-21

# Storage design testability review (common QA)

Owner: the independent common/Blackboard QA session (Claude Code Opus 5.5, xhigh). This is a design review only. It is
not an acceptance run, it gives no acceptance credit, and it does not open the implementation gate.

| Item | Value |
| --- | --- |
| Frozen review candidate | `6a5eb6a89b3ee6bb377f93244b00e6488e9e2314` (architecture and Lead records only) |
| Product and test tree | identical to `8138097889f87359d5055bb1d79766b5ed842f92` (checked with `git diff --quiet` on `services apps packages infra tests` and the root build files) |
| Scope | ADR-012 (new), the ADR-006 and ADR-011 §14 amendments, `local-stack.md`, `tasks/M1.md`, `tasks/M3.md`, `architecture/README.md`, `tasks/README.md` |
| Old builds read for feasibility | `b0b83a8289e1bf9cf349068aca184f0879e9aaf0`, `9f96f7b24cd0aed702e4dc40373bdda4307aad31` |
| Independence | I did not read either storage reviewer report or any other new storage review or worker draft. I read the committed tree with `git show <sha>:<path>`, not the evolving working tree. |
| Docker | none |

All file and line references are at `6a5eb6a`. "ADR" means `docs/architecture/adr/ADR-012-sqlite-volume-storage.md`.

## 1. Method

1. I wrote the case map of §4 from the criteria (AC-M1-41, the changed AC-M1-23/30/38 (h1), AC-M3-01) and from the ADR
   rules. I did this before I read any implementation note. No implementation exists yet.
2. For each case I asked four questions: what can QA observe, what is the independent oracle, what fixture makes the
   case happen, and which result would be a false PASS.
3. I built interruption and counterexample schedules for each state table and each journal boundary.
4. I checked feasibility against the source of both old builds and the candidate (§5). I ran no product command.

## 2. Required fixes

Each of these forces a QA guess, permits a false PASS, or makes a required path impossible. Severity follows charter §5.

### Q-S-01 MAJOR — The start-state table is not total; an interrupted first start has no defined result

- Location: ADR §5 lines 122–129; ADR §4 step 8, line 85; ADR §7 line 191.
- Problem: several reachable states match no row, so QA cannot state the expected result.
- Evidence (schedules):
  1. A guarded `stack:up` on a fresh lane. The preflight writes the lti identity, then the process dies before it writes
     the app identity (step 8 writes two files and is not journaled). Next start: "only one identity" → `IDENTITY_*`
     refusal with "no automatic repair", on an empty lane.
  2. The preflight writes both identities (`generation 0`, `fresh`). Then `dc up` fails before any service migrates
     (port busy, image error). Next start: two identities, no database. `FRESH` needs "no identity". `OK` needs "both
     databases present". `HALF_PAIR` needs "exactly one database". No row matches.
  3. The same, but `lti-service` has created `lti.db` and `cogniate-app` has not. Next start: `HALF_PAIR` refusal on a
     lane that holds only empty first-start data.
  4. A restore into `FRESH` volumes (line 191) is rolled back. After it: terminal journals, no identity, no database.
     `FRESH` needs "no journal". `OK` needs identities. No row matches.
- Consequence: QA cannot write the oracle for these schedules. An operator meets a dead end, or the product does
  something that the contract does not state.
- Fix: make the table total and ordered. Define each of the four states above explicitly, with its exact result and
  message. Either allow a defined recovery for a generation-0 `fresh` pair whose databases are absent or partial, or
  refuse it with an exact message and the exact reset command.

### Q-S-02 MAJOR — Reason codes are wildcards, and the precedence between states is not defined

- Location: ADR §4 result row, line 87 (`identity_*`); ADR §5 lines 126–129 (`IDENTITY_*`); M1.md lines 218–219.
- Problem: several states can hold at the same time, and the codes are not enumerated.
- Evidence: at the drill boundary `identity-lti`, the lti identity has `generation + 1` and the app identity does not.
  So `JOURNAL_OPEN` (journals `swapped`) and `IDENTITY_*` (identities differ) both hold. AC-M1-41 (g) (M1.md:219)
  expects `JOURNAL_OPEN`. A removed identity plus a removed database in one volume also matches two rows.
- Consequence: if QA accepts any `identity_*` or any refusal, a wrong reason passes. That is a false PASS, and the
  operator can get the wrong advice (for example, no mention of `--recover`).
- Fix: enumerate every reason code (for example `identity_missing`, `identity_mismatch`, `identity_project`,
  `db_without_identity`, `half_pair`, `journal_open`, `rollback_failed`, `unknown_entry`). Give one evaluation order (I
  suggest: `rollback_failed`, `journal_open`, `unknown_entry`, then identity, then half pair). Give the message for each.

### Q-S-03 MAJOR — The ownership rule conflicts with the Docker-made mountpoints of the nested binds

- Location: ADR §4 step 1, line 78; ADR §3 line 48 and the allowed entries, lines 54–60; ADR §10 assumptions 1–2,
  lines 256–257.
- Problem: step 1 fails `owner_mismatch` when "any existing file or folder inside" has another owner. The appdb volume
  holds the mountpoint folders `packages` and `uploads`. Docker normally creates a missing mountpoint as `root:root`.
- Evidence (schedule, to confirm in the build step): fresh lane → preflight passes (no mountpoint yet) →
  `cogniate-app` starts and Docker creates `packages` and `uploads` in the volume → the next guarded start (any
  `stack:restart`; the M1 suite does dozens) → the preflight sees root-owned folders → `owner_mismatch` → refusal.
- Consequence: if assumption 1 holds as expected, every later guarded start refuses. The expected results of (a) and
  (d) are then unknown.
- Fix: state the owner and mode of the two mountpoint folders. Either exempt them by exact name and type, or set them
  non-recursively in step 1. Define whether "inside" means direct children or the whole tree. Add a (d) case for the
  chosen rule.

### Q-S-04 MAJOR — QA has no defined route to read and write the volumes

- Location: ADR §9 line 250 ("through the maintenance container", "a read-only one-shot copy"); M1.md:218 ("through the
  maintenance container"); ADR §7 line 177.
- Problem: many required oracles and fixtures need direct volume access, and the ADR defines no QA interface for it.
- Evidence: the needs are the AC-M1-30 stale-sidecar fixture (today a host write, `tests/host/m1-migration.mjs:149`),
  the snapshot and ledger reads (`m1-migration.mjs:16`, `:38`), the P5 fixture (`tests/host/p5-fixture.mjs:11`), and
  AC-M1-41 (a) identity reads, (b) the oracle scratch files, (d) planted entries and a foreign-owner file, (f) identity
  tamper and (g) the tamper of `.previous`. The maintenance service is listed in §9 line 248, but its commands, mounts
  and modes are not defined.
- Independence: if QA reads the state only through the product's own maintenance code, the oracle is not independent.
- Scratch naming: QA's oracle in (b) must create files in a volume root. Every name other than `.lock-probe-*` is an
  unknown entry (§3 line 60), and `.lock-probe-*` is reserved for the product probe (step 3 deletes it).
- Fix: authorize and specify a QA fixture container: pinned image ID, `--network none`, the project label, only
  `<project>_ltidb` and `<project>_appdb`, read-only for reads, read-write only for named fixture writes while both
  services are positively stopped, a QA-owned script, and removal after use. State that this is a test fixture, not an
  overlay. Name an allowed scratch pattern for QA's lock oracle (or require `.lock-probe-qa-*` with QA cleanup and a
  passing preflight afterwards).

### Q-S-05 MAJOR — The clean old-checkout rule contradicts the existing old-route harness

- Location: ADR §8 line 233 ("clean (`git status` shows no tracked change)"); M1.md:200 ("the old checkout is clean").
- Problem: the migration and snapshot routes check out the old SHA and then install the frozen candidate tests over it
  (`tests/host/m1-migration.mjs:103–104`, `:154–155`, `:177–178`).
- Evidence: `b0b83a8` tracks 138 files under `tests/`, and 93 of them differ from the candidate. `9f96f7b` tracks 201
  files, and 56 differ. So `git status` always shows tracked changes during an old step.
- Consequence: every old step is `BLOCKED` by the letter of the rule, or QA must reinterpret the rule.
- Fix: define cleanliness exactly. For example: every tracked path outside `tests/` equals the old SHA; `tests/` equals
  the frozen candidate test tree (by tree hash); no other untracked file outside the ignored paths.

### Q-S-06 MAJOR — The old-route command list is incomplete, and the disable order cannot be run

- Location: ADR §8 line 235; ADR §8 line 230 ("`stack:storage-compat` (candidate tree)"); M1.md:203 (AC-M1-23 step 3)
  and M1.md:184 ((h1): "stop, disable the override, back up").
- Problem 1: the actual routes also run old `npm ci`, old `npm run gen-env`, old `npm run build` (`m1-migration.mjs`
  `old-ci-restored`, `old-build-restored`), the harness's `docker compose config` (the name guard in `tests/host/core.mjs`),
  `git checkout` and the test install. The CLI route uses the harness's own `docker compose -f infra/compose.yaml
  --env-file .env exec` (`tests/host/m1-control.mjs`), not the old `dc exec`. None of these is allowed or forbidden.
- Problem 2: AC-M1-23 step 3 and (h1) disable the override and then check out the candidate. At that moment the old SHA
  is checked out, so the candidate-only `stack:storage-compat` script does not exist in the tree.
- Consequence: QA must guess whether an unlisted command makes the row `BLOCKED`, and the stated order cannot run.
- Fix: state the rule as a principle plus a complete list. For example: "any old command that does not create,
  recreate or restart a service container is allowed; compose `up`, `create`, `run` and `restart` of a service without
  the knobs file, and old `stack:restart` and `stack:reset`, are forbidden." Give the order "check out the candidate
  with both services stopped, then disable", or let the frozen source's script target the clone.

### Q-S-07 MAJOR — AC-M1-41 has no enumerated subcase IDs and no phase placement

- Location: M1.md:212–222; M3.md:84 (AC-M3-01).
- Problem: "every subcase individually mandatory in both full runs" is required, but each letter holds several
  independent observations: (d) 5, (e) about 9, (f) 5, (g) 10, (h) 4, (i) 4.
- Evidence: the runner checks an exact list of IDs and compares the result of each ID between the two rounds
  (`tests/host/run-m1.mjs`; `verifyResults` in `tests/acceptance/M1/common/coverage.mjs`).
- Consequence: if one row covers a whole letter, a failing observation can hide behind the others. If QA invents the
  split, its accounting may not match the Lead's.
- Fix: enumerate stable IDs, as for B-M1-03, assign each to a phase, and state the new total per round (§4 below gives
  a proposal: 416 + 45).

### Q-S-08 MAJOR — `NOT APPLICABLE` in (c) has no place in the run accounting

- Location: M1.md:215 ("recorded `NOT APPLICABLE` … never a PASS"); M3.md:84 ("a `BLOCKED`, skipped, empty or missing
  row fails the run").
- Problem: the runner and AC-M3-01 accept only PASS for a mandatory row. (c) also mixes a portable self-test with a
  host-dependent negative in one subcase.
- Consequence: on a host where locks work, the row can never be complete, so the full run fails. A host whose oracle
  result changed between rounds would also break the "same result per test" rule.
- Fix: split (c) into (c1) the portable self-test, which must PASS, and (c2) the host negative. For (c2), give an
  allowed outcome set, for example PASS (fault shown and the preflight refused) and PASS-NA (the oracle showed
  enforcement, with the oracle evidence attached). Define how AC-M3-01 counts PASS-NA. Require the QA oracle and the
  probe to use the same scratch folder in the same round.

### Q-S-09 MAJOR — The probe interface is not defined for the required observations

- Location: ADR §4 lines 66–87; M1.md:213 ("filesystem type recorded") and M1.md:215 ("the probe's portable
  self-test", "pointed at that scratch folder by a QA-only test mount"); the M1 Self-check (M1.md:228: supplemental
  unit tests are "never a `SIM` row").
- Problem:
  - Only a failure line is defined, so (a) has no defined output that records `fs_type` on a pass.
  - No `selftest` mode exists. If the self-test exists only as a unit test, it cannot fill the (c) SIM row.
  - No argument or environment variable points the probe at a folder. So a "QA-only test mount" means a QA-made compose
    change, which the no-overlay rule forbids.
- Fix: define the command line (mode, folder list), a `selftest` mode with its three scenarios and outputs, a success
  line such as `storage_preflight_passed {runId, folder, fs_type}`, and the exit codes. Then QA can run the program in
  its own fixture container (Q-S-04) without editing the product compose file.

### Q-S-10 MAJOR — Restore drills can give a false PASS and miss real crash points

- Location: M1.md:219 ((g)); ADR §7 lines 177–216, especially the drill list at line 216.
- Problem 1, false PASS: if the drill backup equals the in-place state, then `before` equals `after` for every file. A
  recovery that wrongly leaves the `after` files in place then still "equals `before`".
- Problem 2, missing boundaries: there is no drill point inside one volume's swap. Two examples: the old files are
  already in `.previous-<opId>/` and the staged files are not yet in place (no database in place); or `lti.db` has moved
  and `lti.db-wal` has not. The listed unit cases (M1.md:228: partial staged copy, partial identity `.tmp`, `fsync`
  failure, the gaps between the journal writes and between the identity writes) do not cover these points. There is
  also no drill for an interrupted rollback (`rolling_back`), and no stack-level check that `--recover` is idempotent.
- Problem 3: the `rollback_failed` tamper has no stated boundary. At `committed-lti`, recovery goes forward (ADR line
  205), so a `.previous` tamper does not cause a rollback there.
- Fix:
  - Require a drill backup that differs from the in-place state in every listed file (a write after the backup).
    Require QA to hash the in-place files on its own before each drill.
  - Add drill points inside a swap and for an interrupted rollback, or name them as library-API unit cases with exact
    states.
  - State the tamper boundary, for example `swapped`.
  - Add one more `--recover` run with the expected result "nothing to recover", exit 0.

### Q-S-11 MAJOR — No row covers the import of an old-schema bind installation, and the (e) fixture is undefined

- Location: ADR-011 §14 (the amended upgrade procedure, "A bind-layout installation that has never used the volumes
  first runs the one-time import"); M1.md:217 ((e): "from QA's own backup"); M1.md:200–203 (AC-M1-23 now uses the
  volumes from the start).
- Problem: the documented upgrade path for every existing installation is: old schema on bind folders → legacy backup
  → import → candidate start → migrations. No acceptance row runs it. The (e) fixture has no stated schema or source.
- Consequence: the main operator path for real installations stays unverified, and a candidate-schema fixture would
  hide migration problems after an import.
- Fix: choose one of two.
  - Define the (e) fixture as QA's own released-v10 lane data (made on the volumes under the override, then copied at
    rest as a legacy set), and add a row where import plus a candidate start applies `011`/`012` and keeps `K0` and the
    rows.
  - Record explicitly that the old-schema import is not verified, as a human-review limit.

### Q-S-12 MAJOR — A legacy `-journal` file has no defined import result

- Location: ADR §6 line 133 (the legacy set includes `<db>-journal`); ADR §3 line 60 (`<db>-journal` in a volume root
  is an unknown entry); ADR §6 steps 1–5, lines 149–154.
- Problem: a legacy set with a hot rollback journal can be imported in only two ways, and both are wrong. Either the
  journal is copied, and the next preflight refuses `unknown_entry`. Or it is left out, and the imported database can be
  inconsistent.
- Fix: the import refuses a legacy set that holds `<db>-journal`, with an exact code (for example
  `legacy_hot_journal`), and nothing changes. Add an (e) case.

### Q-S-13 MAJOR — The "no live database" statement is false for running-stack paths, and restart refusal is undefined

- Location: ADR line 89 ("It runs before any service opens a database, so no CLI can be active"); ADR §4 coverage
  table, lines 96–97 (`stack:restart`; `test:acceptance` runs `stack-up.sh` while the stack runs).
- Problem: in `stack:restart` and in the second `stack-up.sh` of `test:acceptance`, the services run while the
  preflight runs. The preflight state checks then see live databases and sidecars. Also, QA's host control handles
  requests concurrently, so two preflights can overlap. Step 3 of one run can then delete the live scratch files of the
  other. In my analysis that fails closed (a refusal), but it is a spurious refusal.
- Testability: AC-M1-41 has no case for the restart path. If the restart preflight fails, the contract does not say
  whether the running container is kept.
- Fix: correct line 89. State that a failing preflight in `stack:restart` leaves the running container unchanged and
  exits 1. Serialize preflights per project (or limit step 3 to entries of finished runs). Add a case: `stack:restart`
  runs a new preflight (a new run ID), and a planted unknown entry makes the restart refuse without recreating the
  container.

## 3. Other findings

### Q-S-14 MINOR — (i) mixes product behavior and harness self-checks in SIM rows

- Location: M1.md:221; ADR §8 line 232 ("The harness also recomputes them").
- Problem: the `enable` refusal and the candidate `stack:up` guard are product behavior. The one-byte hash change and
  the added environment key test QA's own harness checks.
- Fix: keep the two product checks as SIM rows. Record the two harness negatives as harness self-checks of the run,
  not as product rows.

### Q-S-15 MINOR — "Exactly the fields of §4" does not enumerate the `storage-preflight` service

- Location: ADR §8 line 234, item (d); ADR §4 lines 66–70.
- Problem: §4 names the image, `network_mode`, the profile and the mounts. The probe also needs at least a user (root
  for step 1), the `HOST_UID`/`HOST_GID` environment and a command, and the restart policy is not stated.
- Fix: enumerate the full service definition, so that the config check of item (d) is exact.

### Q-S-16 MINOR — The method to compute C0 and C1 is not stated

- Location: ADR §8 line 234.
- Problem:
  - The old `lib.sh` exports the profile environment (`ACTIVE_STACK_PROFILE`, `COMPOSE_PROFILES`, `ACCEPTANCE_*`). A
    plain `docker compose config` call does not get it, so C0 and C1 can differ for reasons that are not the override.
  - Item (d) is visible only with `--profile storage`.
  - `test:acceptance` also uses `--profile test`.
- Fix: state that C0 and C1 are computed through the old `dc()` with the same saved profile, for each compose profile
  that the step uses (including `test` and `storage`). State that volume lists are compared by `target`.

### Q-S-17 MINOR — The `scratch_overflow` bound counts entries, and the state after an overflow is undefined

- Location: ADR §4 step 3, line 80.
- Problem: one interrupted probe can leave three entries (`.db`, `-wal`, `-shm`). So three interrupted runs reach the
  bound of 9. The contract does not say whether anything is deleted when it fails `scratch_overflow`, or how the
  operator recovers.
- Fix: count probe sets, or state the bound in sets. Define the state after an overflow and the recovery command. Test
  9 (removed, pass) and 10 (refused).

### Q-S-18 MINOR — No rule for a backup from another pair or a newer generation

- Location: ADR §7 lines 177–191 ("A restore into `OK` volumes keeps the `pairId`").
- Problem: the contract does not say whether a valid same-project backup whose `pairId` differs from the target, or
  whose `generation` is newer, is accepted or refused.
- Fix: define the rule, and add a case.

### Q-S-19 MINOR — The detection of an old-layout container is not defined

- Location: ADR §6 step 1, line 136.
- Problem: "any container of this project" and the mount match are not defined.
- Fix: state the label (`com.docker.compose.project=<project>`) and the match (destination `/data`; the source is the
  host folder).

### Q-S-20 NIT — The SIM label meaning for AC-M1-41

- Location: M1.md:212 (label `SIM`); M3.md:20 (SIM defined as a signed provider simulation).
- Problem: no provider simulation takes part in AC-M1-41.
- Fix: add one sentence that defines SIM for AC-M1-41 as local QA-lane infrastructure checks with synthetic fixtures.

### Q-S-21 NIT — The QA impact list misses one file

- Location: ADR §9 line 250.
- Problem: `tests/host/m1-migration.selftest.mjs` also writes and reads `infra/.data/...` database files (lines 12–32).
- Fix: add it to the list.

### Optional design preferences (not required)

- O-1: Restrict `--stop-after` to a test-only switch (for example an environment guard), or state that it is available
  in every profile on purpose.
- O-2: Add a run ID and the measured lock-wait times to the preflight success line, for evidence.
- O-3: State where `stack:up` prints the preflight result, so evidence does not need container logs after `--rm`.

## 4. Independent case map and inventory proposal

The two existing rounds keep all **416** rows unchanged, with the same IDs, phases and labels (common 42, Blackboard
141, Canvas 233; 392 API, 7 browser, 17 host). Each round adds the AC-M1-41 host rows below. The existing route rows
(M1-23.*, M1-30.*, M1-38.common.h1–h5) keep their IDs and add the ADR §8 evidence qualifier. The new rows are owned
by common QA.

Phase proposal: a new host phase `storage` in each round, after `sim`. It uses its own fresh clone and the same lane,
so its resets and planted states never touch the `sim` lane. Two route-qualification rows go into the existing phases.

| Proposed ID (`M1-41.common.*`) | Phase | Observable and independent oracle | Fixture | False-PASS guard |
| --- | --- | --- | --- | --- |
| `a-fresh` | storage | Pass lines for both folders with `fs_type` (Q-S-09). The preflight container exits before the first service starts (Docker events). QA's own read: equal `pairId`, `generation 0`, `kind fresh` | fresh lane | a missing pass line or a wrong order fails |
| `a-restart` | storage | `stack:restart` runs a new preflight (new run ID). A planted unknown entry → refused, container unchanged | QA fixture write | needs Q-S-13 |
| `b-oracle-lti`, `b-oracle-app` | storage | QA's oracle: READY/PING, the holder alive and in its transaction before and after, errcode 5 only, release-positive control | scratch name per Q-S-04 | a non-lock error is never "enforced" |
| `b-sequence` | storage | 3 fresh-lane cycles: `stack:up`, `seed`, `GET /api/providers` 200; zero `internal_error`; `integrity_check` `ok` on a stopped copy | `stack:reset` between cycles | files alone are no evidence |
| `c-selftest` | storage | the probe's three self-test scenarios | `selftest` mode (Q-S-09) | not a unit test |
| `c-host-negative` | storage | QA oracle on a scratch bind under `.tmp/`; probe on the same folder → `lock_not_enforced`, exit 1 | QA fixture container | PASS/PASS-NA per Q-S-08 |
| `d-clean`, `d-stale`, `d-overflow`, `d-journal`, `d-owner`, `d-mountpoints` | storage | no probe entry left; 1 stale entry removed; 9 removed and 10 refused; `<db>-journal` → `unknown_entry`, nothing starts; foreign owner → `owner_mismatch`, that file unchanged; the mountpoint rule (Q-S-03) | QA writes as root, services stopped | the file is hashed and its owner read before and after |
| `e-fresh-refusal`, `e-import`, `e-kept`, `e-changed-byte`, `e-added-wal`, `e-not-same-import`, `e-import-nonfresh`, `e-content-missing`, `e-old-layout` | storage | the §6 table rows and messages; import `committed`, the volume bytes equal the legacy bytes before migrations, `legacySources` equal QA's own hashes, a new `pairId`, `kind import`; refusals change nothing (hashes) | legacy set at rest per Q-S-11 | QA hashes the legacy files and volumes on its own |
| `e-hot-journal` (Q-S-12), `e-old-schema` (Q-S-11, if adopted) | storage | refusal with no change / migrations after import | QA fixture | — |
| `f-pairid`, `f-identity`, `f-db`, `f-project`, `f-restore` | storage | the exact reason per Q-S-02; the original files back → start | QA fixture writes | exact reason, not any refusal |
| `g-prepared` … `g-committed-lti` (8), `g-tamper`, `g-damaged` | storage | exit 3; `stack:up` refuses `journal_open`; `--recover` result; in place = QA's own `before` hashes (or `after` for the forward commit); old identities back; then a start; the tamper → exit 2, folders kept; a damaged backup → exit 1, no journal | a backup that differs from the in-place state (Q-S-10) | `before` ≠ `after` for every file |
| `h-restore-nomanifest`, `h-import-nomanifest`, `h-volume-manifest`, `h-legacy-manifest` | storage | refusal; manifest fields; QA's own hashes | interrupted backup folder | — |
| `i-enable-refusal`, `i-candidate-guard` | storage | refusal, the existing knobs file unchanged (hash); the candidate `stack:up` refuses with the marker | — | harness negatives are not rows (Q-S-14) |
| `j-migration` | migration | per old step: both override hashes, C0/C1 difference only (a)–(d), clean rule (Q-S-05), preflight exit 0, mount check | — | a missing record fails the row |
| `j-snapshot` | snapshot-upgrade | the same for `9f96f7b` | — | same |

Proposed count: 45 new rows in each round (2 + 3 + 2 + 6 + 9 + 5 + 10 + 4 + 2 + 2), so 461 per round, or 463 if
`e-hot-journal` and `e-old-schema` are added. The Architect fixes the final list and the number. `sim` keeps 394 rows,
`snapshot-isolated` 6, `snapshot-upgrade` 5 + 1, `migration` 11 + 1, and the new `storage` phase 43 (394 + 6 + 6 +
12 + 43 = 461). Each guarded restart in `sim` now also runs a
preflight. That adds time, not rows.

Feasibility of the other requested checks:

- Held lock, refusal and release: feasible with QA's own oracle. My bounded diagnostic used the same method (READY/PING,
  `inTransaction`, errcode 5 only, release-positive control, and a `nolock=1` negative control).
- Wrong-error control: the probe treats errcode 6 and other errors as FAIL (ADR line 82). QA's oracle and its negative
  control exclude non-lock errors.
- Paired identities: feasible through QA's own read-only reads (Q-S-04).
- All legacy source and target combinations: feasible for the rows in ADR §6. The two undefined rows are in Q-S-12 and
  Q-S-11.
- Partial rename, journal and identity crashes: the journal and identity gaps are covered by drills. The partial
  rename gap is Q-S-10. The first-start identity gap is Q-S-01.
- Exact old-build fixture comparisons: feasible after Q-S-05, Q-S-06, Q-S-15 and Q-S-16.
- Negative tamper: (f), (g) and (i) are feasible with a QA write route (Q-S-04).
- Both old migration routes: feasible (§5). The order of the disable step is Q-S-06.

## 5. Feasibility checks against the source (read-only)

| Check | Result |
| --- | --- |
| Product and test tree at the candidate | identical to `8138097` |
| Override injection in both old builds | `dc()` adds `-f .tmp/compose.knobs.yaml` when it exists (`b0b83a8` `infra/scripts/lib.sh:94`, `9f96f7b` `:107`), with `--project-directory infra` (`:93`, `:106`). So relative paths in the override resolve from `infra/`. |
| Who writes or deletes the knobs file in the old builds | only `stack-restart.sh` writes it, and only `stack-reset.sh:31` deletes it. Old `stack-up.sh`, `qa-suite.sh` and `seed.sh` keep it. |
| Compose calls that bypass `dc()` in the old builds | only the Build Runner's own build project (`build-runner.sh:160`, `:171`, `:194`). It does not mount the SQLite files. |
| Old SQLite mounts | `lti-service` `./.data/lti-service:/data` (`b0b83a8` `compose.yaml:143`, `9f96f7b` `:146`); `cogniate-app` `./.data/cogniate-app:/data` (`:177`, `:183`). The build-queue mounts are outside `/data`. Items (a)–(b) cover every database mount. |
| `HOST_UID` in the old builds | exported by the old `lib.sh` and used by the old compose files |
| Old routes and the forbidden old `stack:restart` | the probes of `migration.probe.ts` and the `snapshot-seed` stage of `snapshot-migration.probe.ts` call no `m1-restart` or `m1-profile`. `restartApp()` (`snapshot.ts:87`) is used only in the candidate phases. |
| Tracked `tests/` in the old SHAs | 138 files (`b0b83a8`) and 201 (`9f96f7b`); 93 and 56 differ from the candidate → Q-S-05 |
| QA files that touch host database paths | `tests/host/m1-migration.mjs`, `m1-migration.selftest.mjs`, `p5-fixture.mjs`, `run-t1.mjs` (information scan only) → Q-S-21 |
| In-container test reads of database files | none. The e2e container mounts the checkout read-only (`..:/repo:ro`), and no acceptance or e2e test reads `lti.db` or `cogniate.db`. |

## 6. What this review does not claim

- It does not claim that any assumption of ADR §10 is true or false. Q-S-03 is a high-likelihood conflict from normal
  Docker behavior and must be settled in the build step.
- It does not claim that the bind mount fails in DELETE mode, that every bind mount fails, or that the Docker update
  caused the fault. Those questions stay open, as the ADR says.
- It approves no implementation and makes no acceptance claim. Every stack-level gate must run again on the
  storage-repaired candidate. All 32 live rows stay UNVERIFIED.

Checks used: `git show`/`git diff` at the SHAs above; `git ls-tree` and `git grep` at `8138097`, `b0b83a8` and
`9f96f7b`. No Docker, stack or product command was run.

## Round 2

Verdict (Round 2): FAIL (design testability) — 5 MAJOR, 5 MINOR, 2 optional; no BLOCKER. All 13 Round 1 MAJOR findings are closed (some with a residual, listed below).
Round: 2, task `task_30e5c7f55481`, dispatch `ctx_ab90749064c8`, 2026-10-21

The Round 1 text above is unchanged. Its first 30,362 bytes still have SHA-256
`a1cba5040d7573e74a9e62fb015452426c3def2ac77ddc1ca4df9b6f0fa88c51`.

| Item | Value |
| --- | --- |
| Frozen design candidate | `7a6374460dd02c3544b6dbf043086b0facefceb2` (ADR-012 revision 2) |
| Product and test tree | identical to `8138097889f87359d5055bb1d79766b5ed842f92` (checked with `git diff --quiet` on `services apps packages infra tests` and the root build files) |
| Read | ADR-012 rev 2, `review-response-storage.md`, the M1, M3, ADR-006, ADR-011 §14, `local-stack.md` and index changes, and the Lead's phase-plan synthesis |
| Not read | both storage reviewer reports, every other worker's Round 2 review or draft, and the optional Author feasibility report (I used only the facts that ADR-012 §17 quotes) |
| Method | Read-only `git show`/`git diff` at the SHAs above, and source reads of `b0b83a8`, `9f96f7b` and `8138097`. No Docker, no stack, no product command. |

References are at `7a63744`. "ADR" means ADR-012 revision 2 (`docs/architecture/adr/ADR-012-sqlite-volume-storage.md`).

### R2.1 Recheck of the Round 1 findings

| Id | Round 2 status | Evidence at `7a63744` | Residual |
| --- | --- | --- | --- |
| Q-S-01 | Closed | ADR §6, lines 174–195: one total, ordered table. Row 10 `FRESH_INIT_PARTIAL`, row 13 `FRESH` (accepts `rolled_back` journals), row 14 `FIRST_START`, row 18 `state_unclassified`. Row `a-first-start-resume` | — |
| Q-S-02 | Closed | Exact codes, no wildcards. Rows 1–3 (journal) come first (lines 176–178, 195) | §5 step 1 runs before the table: R2-06 (MINOR) |
| Q-S-03 | Closed | ADR §4, lines 80–89: precreate the mountpoints, fix an empty root-owned one, otherwise `mountpoint_unsafe`; measured fact M2 (line 518). Row `d-mountpoint` | — |
| Q-S-04 | Closed in principle | ADR §11, lines 356–369: QA fixture container, read and write modes, `.qa-scratch-*`, the independence rule | The mount list does not cover the probe file, the host-negative scratch bind or the decoy container: R2-04 (MAJOR) |
| Q-S-05 | Closed | ADR §12 exact tree rule, lines 391–397 | — |
| Q-S-06 | Closed | ADR §12 command rule, lines 414–430. The order is checkout, then disable (lines 434–447). The copied `storage-compat.sh` runs after the old checkout (line 389). I confirmed from source that the old `seed.sh` uses only `dc exec`, that the old `stack-down.sh` removes neither the volumes nor the knobs file, and that the old `gen-env.sh` keeps an existing `.env` (line 23 comment), in both old SHAs. | — |
| Q-S-07 | Closed | ADR §13, lines 456–469: 63 ids, phases and totals. I recounted: 6+3+2+7+13+6+16+6+2+2 = 63; `storage` 61 | — |
| Q-S-08 | Closed | ADR §14, lines 477–485; M3 AC-M3-01: one conditional row, reported apart, never counted as PASS | The two-round equality rule for that row is not stated: R2-08 (MINOR) |
| Q-S-09 | Closed | ADR §5, lines 99–154: command line, modes, one JSON line per folder, a summary line, exit codes, self-test | The self-test folder is not stated: R2-04 (MAJOR) |
| Q-S-10 | Partly closed | New drill points, a backup that differs, the `swapped` tamper point and `g-recover-idempotent` (ADR lines 300–318; M1.md:268–270) | The drill oracle compares only the main database hash: R2-01 (MAJOR) |
| Q-S-11 | Closed in design | Row `e-old-schema` (M1.md:257); the `storage` phase runs after `migration` (ADR line 454) | The fixture copies the master keys only: R2-03 (MAJOR) |
| Q-S-12 | Closed | `legacy_hot_journal` for start and for backup (ADR lines 228, 348); row `e-hot-journal` | — |
| Q-S-13 | Closed | ADR §7 line 208: a failed restart preflight exits before the recreate; lines 217–220 replace the old claim. Rows `a-restart`, `a-restart-refusal` | The new operation lock brings a scope problem: R2-02 (MAJOR) |
| Q-S-14 | Closed | Harness self-checks are apart from the rows (ADR lines 473–475; M1.md:287) | — |
| Q-S-15 | Closed | The full `storage-preflight` field table (ADR lines 110–122) | — |
| Q-S-16 | Closed | C0/C1 go through the old `dc()` with `--profile storage` and the step profiles, keyed by `target` (ADR lines 401–405). Also confirmed from source: the old `lib.sh` sets `KNOBS_FILE="$REPO_ROOT/.tmp/compose.knobs.yaml"` (line 9 in both old SHAs), an **absolute** path. So §17 assumption 2 (relative `-f` resolution, fact M6) does not apply to the old builds. | — |
| Q-S-17 | Closed | No count cap; delete under the lock; `scratch_cleanup_failed` (ADR line 130). Row `d-stale` (12 files and one near-match) | — |
| Q-S-18 | Closed | The pair-rule table (ADR lines 246–250) | Targets other than `OK` and `FRESH`: R2-07 (MINOR) |
| Q-S-19 | Closed | ADR §10 step 1, line 340 (label, destination `/data`, resolved source) | — |
| Q-S-20 | Closed | M1.md:219 defines `SIM` for these rows | — |
| Q-S-21 | Closed | ADR §11 line 369 and §16 line 507 | — |

### R2.2 Required fixes (Round 2)

#### R2-01 MAJOR — The drill oracle uses only the main database hash, so a wrong recovery can pass

- Location: M1.md:223 ("The oracle checks the database SHA-256 … It does not require a difference in `-wal` or `-shm` files"); M1.md:268 ("both databases equal their state before the restore"); ADR §13, line 471.
- Problem: with WAL, a committed write can stay in `<db>-wal` until a checkpoint. A main-file hash then does not prove the logical state, before or after the drill.
- Schedule:
  1. QA takes backup `B`, then makes the write after `B` (a new platform and a new connection).
  2. QA stops the services. If the services stop without a final checkpoint (not stated anywhere), the write is only in `lti.db-wal` and `cogniate.db-wal`, and the main files can still equal `B`'s main files.
  3. In that state, the precondition "the two generations differ in both databases" is false when it is checked by main-file hash. It is not detected.
  4. After a drill and `--recover`, a defective rollback leaves `B`'s `-wal` in place, or does not move the old `-wal` back. The main-file hash still equals "before", so the row passes, but SQLite then reads `B`'s state or a mixed state.
- Consequence: a false PASS on the most important recovery rows (11 drill rows plus `g-fresh-target`).
- Fix:
  - Precondition: QA reads stopped copies of each database with its sidecars (in its fixture container). The pre-drill pair must contain the new platform and connection, and `B` must not.
  - Result for the rollback rows: QA's listing of the in-place set (name, size and SHA-256 of `<db>`, `-wal`, `-shm`, where "absent" counts as a value) equals the pre-drill listing, and the same logical read shows the pre-drill rows.
  - Result for `committed-lti` and `g-fresh-target`: the in-place set equals `B`'s listed set, with no unlisted sidecar.
  - Keep "no sidecar difference is required" only for the fixture, not for the oracle.

#### R2-02 MAJOR — The scope and re-entry of the operation lock for `test:*` are not defined; the literal rule deadlocks

- Location: ADR §7, line 200 ("Every guarded command of the table below takes the lock before its first Docker command, and keeps it until it ends") and line 209 (`test:acceptance`, `test:e2e`, `e2e:reset` are guarded); ADR §12, line 428 ("The harness holds the operation lock for the whole command"); ADR §7, line 201 (a second command waits 120 s and then refuses).
- Schedule 1, the literal reading: `npm run test:acceptance` takes the lock. Its own internal `stack-up.sh` (also guarded) then waits 120 s and refuses `operation_in_progress`. The suite never starts. No re-entry rule exists.
- Schedule 2, if the outer command keeps the lock for its run: in phase `sim`, the M1 suite asks the QA host control for `stack:restart` many times (`m1-restart`, `m1-profile`: AC-M1-29, 35, 37, 38). The host control runs `npm run stack:restart` as a separate process, not as a child of `qa-suite.sh`. Each restart waits 120 s and refuses, so those mandatory rows fail.
- Schedule 3: the snapshot-upgrade and migration probes run the candidate `test:acceptance`. If the harness applies line 428 to them too, the same deadlock follows.
- Consequence: a correct implementation of the literal text fails required rows. QA cannot tell which scope is intended.
- Fix:
  - State that `test:acceptance`, `test:e2e` and `e2e:reset` take the lock only inside each internal `stack-up.sh` or `stack-reset.sh` run, and not around the whole command.
  - State that the lock is not re-entrant.
  - Limit line 428 to old-build commands (the old scripts take no lock). The harness never holds the lock around a candidate command.
  - Add one `a-serialize` check: a `stack:restart` from the host control during a running candidate `test:acceptance` succeeds.

#### R2-03 MAJOR — `e-old-schema` copies only the master keys, but its oracle needs the matching credentials

- Location: M1.md:257 ("sets that lane's two service master keys from the AC-M1-23 lane"; "the v10 platform and connection of AC-M1-23 are listed through the public API").
- Problem: the imported `lti.db` holds the AC-M1-23 lane's tool-account API key hash. The imported `cogniate.db` holds that lane's portal password hashes. The app uses `infra/.secrets/app/lti-api-key` to call the LTI service. The storage lane has other values from its own `gen-env` and `seed`, or no key files after a `stack:reset` (`stack-reset.sh:31` at `8138097` removes `seed.json` and `lti-api-key.*`).
- Schedule: import, then `stack:up`. Then `GET /api/platforms` with the storage lane's key → `401`, or the portal sign-in with the storage lane's password fails. The row fails although the product is right, unless QA guesses which secrets to carry over.
- Fix: list the full synthetic credential set that QA copies from the AC-M1-23 lane: the two master keys, `infra/.secrets/lti-api-key.*`, `infra/.secrets/app/lti-api-key` and the portal user credentials (`seed.json`). The storage lane keeps its project name, port, subnet and certificates. State that the oracle authenticates with the copied values, and that no `seed` runs between the import and the oracle.

#### R2-04 MAJOR — The fixture container cannot run `c-selftest` and `c-host-negative` as written, and the self-test folder is not stated

- Location: ADR §11, line 364 (mounts: "only `<project>_ltidb` and `<project>_appdb`, and QA's own script and output folder"); ADR §14, line 480 ("runs the probe on the same folder … in QA's fixture container"); ADR §5, line 149 (`selftest` "runs in one empty folder"); M1.md:236 ("in an empty scratch folder"); M1.md:255 (the `e-old-layout` decoy binds a legacy folder at `/data`).
- Problem 1: both rows need the product probe file mounted read-only, and `c-host-negative` needs the `.tmp/` scratch bind. §11 forbids both mounts. The decoy container of `e-old-layout` is also outside the §11 rule.
- Problem 2: `selftest` scenario `normal` must pass, so its folder must enforce WAL locks.
- Schedule: QA runs `selftest` in its mounted output folder, a host bind. On the measured host, WAL locks fail there, so `normal` reports `lock_not_enforced` and the program exits 1. The mandatory row fails although the probe is right.
- Fix:
  - Allow in §11 the candidate probe file read-only (for `c-selftest` and `c-host-negative`), the `.tmp/qa-host-negative-<16 hex>/` bind (for `c-host-negative` only), and the decoy container exactly as M1.md:255 describes it.
  - State that `selftest` runs in a new folder of the container's own writable layer (for example `/tmp/qa-selftest-<hex>`), never in a bind mount.

#### R2-05 MAJOR — `a-serialize` has a random order, so its result can differ between runs

- Location: M1.md:230 ("`stack:data-backup` and `stack:up` started at the same time (services stopped): one waits for the other; both exit with their normal result; the backup has a manifest").
- Schedule: both commands start, and `stack:up` creates the lock folder first. It starts the services. Then the backup takes the lock, sees running services, and correctly refuses (exit 1, no manifest). So the stated oracle fails in about half of the runs, and the two rounds can differ.
- Fix: make the order fixed. Start the backup; wait until `owner.json` names it; then start `stack:up`. Check that `stack:up` waits (lock owner record, or Docker events: no service container is created before the backup ends), that the backup exits 0 with a manifest and no `INCOMPLETE` file, and that `stack:up` then exits 0. If both orders must be covered, give each its own expected result.

### R2.3 Other findings (Round 2)

| Id | Sev. | Location | Problem | Narrow fix |
| --- | --- | --- | --- | --- |
| R2-06 | MINOR | ADR §5 step 1 (line 128) runs §4 before step 4; §6 order (lines 172–195) | `--prepare` runs before the table. An unsafe mountpoint can refuse before rows 1–3, and prepare changes owner and mode even when the table then refuses (for example a `rollback_failed` lane kept as evidence). No current row conflicts. | State that prepare records an unsafe mountpoint and lets the table decide, and that prepare changes nothing when rows 1–3 match. |
| R2-07 | MINOR | ADR §8 pair rule, lines 246–250 | Only target `OK` and `FRESH` are defined. A restore or import into `FIRST_START` or `FRESH_INIT_PARTIAL` has no result. | Refuse with an exact code, for example `restore_target_not_ok:<state>`, and add a unit case. |
| R2-08 | MINOR | ADR §14; M3 AC-M3-01 | The rounds must give "the same result per test". For `c-host-negative`, PASS in one round and `NOT_APPLICABLE` in the other is not ruled. | State whether such a difference fails the gate (I suggest: it fails, because the host fault must be stable). |
| R2-09 | MINOR | ADR §10 legacy table, lines 345–352 | The table does not say "first matching row". A legacy `-journal` next to a pair in `journal_open` matches two rows. | Declare first-match order, and the position of the §6 refusal row. |
| R2-10 | MINOR | ADR §7, line 202 (`storage_lock_reclaimed`) | The sink and fields of the lock events are not stated, but `a-serialize` checks that the event is "logged". | Name the sink (stdout and `infra/.logs/storage-preflight.jsonl`) and the fields (`project`, `oldOwner`, `newOwner`, `ts`). |

Optional (not required):
- O2-1: add `ts` to each `storage_preflight` line. Then the `a-fresh` order ("logged before the first service container is created") needs no Docker event stream.
- O2-2: every guarded `stack:restart` now adds a preflight. Rows with fixed time windows (for example the 60 s lease windows of AC-M1-37) stay valid only while a restart stays short. QA will record the restart durations; no design change is asked.

### R2.4 Final case inventory (as designed at `7a63744`)

| Item | Value |
| --- | --- |
| Original mandatory rows, each round | **416**, with unchanged ids, phases and labels (common 42, Blackboard 141, Canvas 233; API 392, browser 7, host 17) |
| New AC-M1-41 rows, each round | **63**: a 6, b 3, c 2, d 7, e 13, f 6, g 16, h 6, i 2, j 2 |
| Rows per full round | **479** |
| Phase order and counts | `sim` 394 → `snapshot-isolated` 6 → `snapshot-upgrade` 6 (5 + `j-snapshot`) → `migration` 12 (11 + `j-migration`) → `storage` 61 (new; its own fresh clone and lane; after `migration`, because `e-old-schema` uses that round's AC-M1-23 backup) |
| Full rounds | 2, at the same product and test SHA, with the same result per row |
| Conditional row | only `M1-41.common.c-host-negative`: PASS, or `NOT_APPLICABLE` with same-round oracle evidence; reported apart and never counted as PASS (see R2-08) |
| Not rows | the harness self-checks (one-byte change → `BLOCKED`; added environment key → not-allowed difference) and the supplemental unit and integration cases |
| After both rounds | all legacy groups of AC-M3-02 (b); separately, M2 and three T7 runs by QA-E2E; all 32 live rows stay UNVERIFIED |

Oracle independence, per group, once R2-01 to R2-05 are fixed:
- (a), (d), (f): QA's own listings and identity parses in its fixture container; container ids and start times from `docker inspect`.
- (b): QA's own two-process oracle in `.qa-scratch-*`.
- (c): the product probe is the tested object; the `c-host-negative` comparison is QA's own oracle on the same folder.
- (e), (h): QA's own hashes of the legacy files and manifests, and logical reads of stopped copies.
- (g): the full in-place listing plus a logical read (R2-01).
- (i), (j): QA's harness log and its hash and config checks.

No row uses a product maintenance command as its own oracle (M1.md:220).

### R2.5 What Round 2 does not claim

It does not claim any §17 assumption beyond the source facts stated above. It approves no implementation and gives no
acceptance credit. Every stack-level gate must run again on the storage-repaired candidate.

## Round 3

Verdict (Round 3): FAIL (design testability) — 2 MAJOR (both are narrow text fixes with no design change), 4 MINOR, 1 NIT; no BLOCKER. All Round 2 findings R2-01 to R2-10 are closed.
Round: 3, task `task_0e99b6e5fb12`, dispatch `ctx_010e8e2ab9d8`, 2026-10-21

Rounds 1 and 2 above are unchanged. Their first 47,421 bytes still have SHA-256
`50b83fbdc6c50645be16c54e7ddf2b8c35e450cadae9e83325c2841c567a2194`.

| Item | Value |
| --- | --- |
| Frozen design candidate | `b3bd22e2ada43f45499db5e50cfb4cafc8295fb9` (ADR-012 revision 3) |
| Product and test tree | identical to `8138097889f87359d5055bb1d79766b5ed842f92` (checked with `git diff --quiet` on `services apps packages infra tests` and the root build files) |
| Read | ADR-012 rev 3, the Round 3 section of `review-response-storage.md`, the M1, M3, ADR-011 §14 and index changes, and the Lead's phase-plan synthesis |
| Not read | both storage reviewer reports and every other worker's Round 3 report or draft |
| Method | Read-only `git show`/`git diff` at the SHAs above, and source reads of `8138097` (`infra/scripts/*.sh`, `tests/host/p5-fixture.mjs`, `tests/host/run-t5.mjs`, `tests/acceptance/T5a/0-setup.spec.ts`, `package.json`). No Docker, stack or product command. |

References are at `b3bd22e`. "ADR" means ADR-012 revision 3.

### R3.1 Recheck of the Round 2 findings

| Id | Round 3 status | Evidence at `b3bd22e` |
| --- | --- | --- |
| R2-01 | Closed | ADR §8 "File set" (line 348): `<db>`, `-wal`, `-shm` and the identity; equality is never the main file alone. ADR §13 "Recovery oracle" (lines 602–606): the full file set plus logical rows from stopped copies with their sidecars. M1.md:224–225 defines "equals the state before" and "equals `B`" with both parts; the logical precondition is at M1.md:224. Every `g-*` and `e-*` recovery row uses these terms (M1.md:277, 283, 285–286). |
| R2-02 | Closed | ADR §7 Scope (lines 263–272): candidate `test:acceptance`, `test:e2e` and `e2e:reset` hold no lock; each internal start takes and releases it. The lock is not re-entrant (A4, line 242). Rows `a-lock-scope` and `a-lock-reentry` (M1.md:235–236). The trace in R3.3 finds no deadlock. |
| R2-03 | Closed for credentials | M1.md:263–266: the four `.env` values and four secret files; no `gen-env`, `seed`, `lti:bootstrap` or `seed-portal` before the oracle; the oracle uses only the copied values. A **new** gap in the same row: R3-01 (package content). |
| R2-04 | Closed | ADR §11 container kinds (lines 483–489). The `selftest` folder is in the container's own writable layer (ADR line 161; M1.md:242). `c-host-negative` uses a `storage-oracle` and then a `storage-probe` container on the same bind folder (M1.md:243). |
| R2-05 | Closed | `a-serialize` has a fixed order and an order-independent oracle (M1.md:232). A precision point: R3-04. |
| R2-06 | Closed | ADR §5 `check` steps 1–6 (lines 138–143): read, then the journal gate with no change, then preparation, which records an unsafe mountpoint for row 5, then the privilege drop, the cleanup and the table. |
| R2-07 | Closed | ADR §8 "Other target states" (line 338); row `h-target-state` (M1.md:294). A precision point: R3-05. |
| R2-08 | Closed | ADR §14 "Two rounds" (line 620); M3 AC-M3-01. |
| R2-09 | Closed | ADR §10 first-match rows L1–L7 (lines 459–469). |
| R2-10 | Closed | ADR §7 "Lock events" (lines 276–284): sink, fields with `ts`, and the event list. |
| O2-1, O2-2 | Done | `ts` on every storage line (lines 155–157, 166, 404); §17 assumption 8 (line 682). |

The Round 1 and Round 2 closures still hold at `b3bd22e`. The §6 table is unchanged and total. The exact codes, the
tree rule, the command rule (now with the `run --` wrapper, lines 516–521), the C0/C1 method, the mountpoint rule and
the legacy hot-journal rule are all still present. A takeover can never move a newer lock, for two reasons. A stale
record cannot become live again, because the live test compares `pid` with `pidStart`. And a takeover is a `rename` to
the never-deleted name `stale-<runId>`, which fails onto a non-empty folder (lines 243–252). This proof depends on §17
assumption 4, which stays unmeasured.

### R3.2 Required fixes (Round 3)

#### R3-01 MAJOR — `e-old-schema` cannot pass: the import's content check refuses, because no package folder is copied

- Location:
  - M1.md:263–266. The row runs "after QA's `stack:reset` of the storage lane". It copies "the two databases … It also
    copies the complete synthetic credential set … and nothing else".
  - ADR §8 line 340: every restore **and import** runs the content check. Every `package.storage_path` must exist under
    `infra/.data/cogniate-app/packages`, else `content_missing`.
- Evidence:
  - AC-M1-23 step 1 (M1.md:208) runs the unmodified `SETUP-T5a` (`tests/host/m1-migration.mjs:107–108`). That setup
    creates and uploads SCORM, HTML and blank-SCO courses (`tests/acceptance/T5a/0-setup.spec.ts:24`, `:32–33`). So the
    v10 app database in the AC-M1-23 step 4 backup has `package` rows with `storage_path` values.
  - The candidate `stack-reset.sh` removes `infra/.data/cogniate-app` (ADR §3 line 56; §15).
- Schedule: `stack:reset` empties the storage lane's packages folder → QA copies the v10 databases and credentials →
  legacy backup → `stack:data-import` → the staged content check finds a missing `storage_path` → refuses
  `content_missing` (correct product behavior) → the mandatory row fails in both rounds.
- Fix (text only): add to the copy list the package folders that the copied app database references, from the AC-M1-23
  clone's `infra/.data/cogniate-app/packages/` (QA's own synthetic course content), placed before the legacy backup. The
  row's oracle should also record that the content check passed.

#### R3-02 MAJOR — The T5b P5 fixture contradicts the §11 write rule

- Location: ADR §11 line 485 (write mode "only while both services are positively stopped and QA holds the operation
  lock"; the only running-stack exception is `a-restart-refusal`); ADR §11 line 493 and M3 AC-M3-02 (b) ("keeps its
  approved app-stop guard and its assertions; only its database access moves into the `storage-fixture` container").
- Evidence:
  - `tests/host/p5-fixture.mjs:17–22` stops **only** `cogniate-app` (`docker compose stop cogniate-app`). It edits
    `cogniate.db`, then runs `docker compose start cogniate-app`; `lti-service` keeps running.
  - P5 is a required T5b case (`tests/host/run-t5.mjs:39`), so it is part of the legacy suites of AC-M3-02 (b).
- Schedule: the T5b legacy run reaches P5 → QA must write `cogniate.db` in `appdb` while `lti-service` runs → §11
  forbids it → QA either breaks §11 or changes the approved P5 guard. Both are forbidden, so the legacy group cannot run
  within the rules.
- I should have found this in Round 2; the same text was present at `7a63744`.
- Fix (text only): add P5 as a second named running-stack exception in §11. Its write is limited to `cogniate.db` (and
  the sidecars that SQLite uses) in `appdb`. It needs `cogniate-app` positively stopped (the approved guard) and the lock
  held through `storage-oplock.sh run --`. `lti-service` may run, because it does not mount `appdb`. In the same place,
  state that the existing harness `docker compose stop` and `start` of an existing service container are accepted
  harness actions, not supported operator starts. These are P5, the P2 app recovery of `run-t5.mjs`, and the M1-23/30
  stops. They change no storage layout.

### R3.3 Scope trace: candidate suites, the host control and the lock (no deadlock)

| Path | Source fact at `8138097` | Lock behavior at `b3bd22e` | Result |
| --- | --- | --- | --- |
| `npm run test:acceptance` (`qa-suite.sh`) | starts with `STACK_PROFILE=acceptance stack-up.sh` (line 56); its `EXIT` trap runs `STACK_PROFILE=default stack-up.sh` (line 45) | the command holds no lock; each internal `stack-up.sh` takes and releases it | the suite container runs with the lock free |
| `npm run test:e2e` / `e2e:reset` | `qa-suite.sh` line 62 runs `e2e-reset.sh`, which runs `stack-reset.sh` (27), `stack-up.sh` (29) and `seed.sh` (31) one after another | each internal run takes and releases the lock; `seed` takes none | no nesting |
| Host-control `m1-restart` / `m1-profile` during a suite | `tests/host/m1-control.mjs` runs `npm run stack:restart` from the harness process (ADR §17 S4) | not a child of a lock holder, so `COGNIATE_STORAGE_LOCK_RUN` is absent; A1–A2 acquire; concurrent restarts wait (≤ 120 s) | no deadlock; checked by `a-lock-scope` |
| QA fixture writes | `storage-oplock.sh run -- <QA command>` | the QA command is not a guarded command | no re-entry |
| Old route | `storage-compat.sh run -- npm run test:acceptance` holds the lock for the whole old command; old scripts take none; the host control refuses old restarts under the marker | — | no nested wait |
| `demo` | `demo.sh:11–12` runs `stack-up.sh`, then `seed.sh` | not named in the §7 scope table: R3-07 | consistent if it holds no lock of its own |

### R3.4 Other findings (Round 3)

| Id | Sev. | Location | Problem | Narrow fix |
| --- | --- | --- | --- | --- |
| R3-03 | MINOR | ADR §9 steps 1–2 (lines 432–438) | The volume-user check lists "every container, in any state" that references the lane volumes. It does not exclude the command's own copy container (`oneoff=True`, a storage service). If that container still exists at step 2, quarantine refuses `volume_in_use` and names itself. | State that steps 2–5 run on the host after the copy container has ended and is removed, or exclude the containers whose `org.cogniate.storage.run` is this command's `runId`. |
| R3-04 | MINOR | M1.md:232 (`a-serialize`) | QA "waits until the lock record names that backup". A fast backup can acquire and release before the first read, and then the wait never ends. The row itself says a fast backup can finish early. | Wait for the backup's `storage_lock_acquired` event in `storage-lock.jsonl`, or the live record, whichever comes first. |
| R3-05 | MINOR | M1.md:294 (`h-target-state`, "after `--stop-after staged` on another lane") | The `storage` phase has one lane and one checkout ("one checkout per project", ADR §7 line 274). A second lane needs another project, `.env` and stack, and no rule defines one. | Use the same lane: `--stop-after staged`, check the refusal, then `--recover`. Or define the second lane. |
| R3-06 | MINOR | M1.md:283 (`g-fresh-target`) and M1.md:292 (`h-pair-mismatch`) | After `g-fresh-target`, the lane carries `B`'s `pairId` again. A backup "made before `g-quarantine`" then has the same `pairId`, so a restore succeeds and `pair_mismatch` cannot happen. The row needs a new fresh pair, and the sequence does not make one. | State the order and fixture: for example, one more `stack:data-quarantine`, then a fresh `stack:up` (a new `pairId`), then the old-pair restore. |
| R3-07 | NIT | ADR §7 scope table (lines 265–270) | `demo` and `demo:prepare` are in the candidate guard (line 562) but not in the scope table. `demo.sh` calls `stack-up.sh`. | Add "no lock of its own, like the `test:*` commands". |

### R3.5 Inventory and oracle independence (as designed at `b3bd22e`)

| Item | Value |
| --- | --- |
| Original mandatory rows, each round | **416**, with unchanged ids, phases and labels |
| AC-M1-41 rows, each round | **72**: a 10, b 3, c 2, d 7, e 13, f 6, g 20, h 7, i 2, j 2 (I recounted from ADR §13 lines 589–598 and M1.md:219–299) |
| Rows per full round | **488** |
| Phases | `sim` 394, `snapshot-isolated` 6, `snapshot-upgrade` 6, `migration` 12, `storage` 70; `storage` runs after `migration` in each round, and `e-old-schema` runs last |
| Rounds | 2, at the same product and test SHA, with the same result per row (also for `c-host-negative`) |
| Conditional | only `c-host-negative`: PASS or `NOT_APPLICABLE` with same-round evidence, reported apart, never counted as PASS |
| Not rows | harness self-checks (copied-file hashes, an added environment key, host-control refusal under the marker) and unit/integration cases |

None of my Round 3 findings adds or removes a row.

Oracle independence: every group is decided by QA's own parsing and hashing, through the five fixture container kinds of
§11 and `docker inspect`/`ps`. The lock rows (`a-lock-*`, `g-orphan-*`) use QA's own reads of the lock records and
events, and QA's container listings. The product probe is the tested object only in `c-*`. No row uses a product
maintenance command as its own oracle (M1.md:221).

### R3.6 Dispositions

| Finding | Disposition |
| --- | --- |
| R2-01 – R2-10, O2-1, O2-2 | Closed (R3.1) |
| R3-01, R3-02 | Required before the design passes. Each is a narrow text fix; neither needs a design change. |
| R3-03 – R3-06 | Precision fixes; not blocking alone |
| R3-07 | NIT |

The design is otherwise testable as written. Once R3-01 and R3-02 are fixed, I see no remaining required gap in the
case map, the phases or the oracles. This review approves no implementation and gives no acceptance credit. Every
stack-level gate must run again on the implemented candidate, and the §17 assumptions remain to be verified there.
