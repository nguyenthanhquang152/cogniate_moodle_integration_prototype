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
