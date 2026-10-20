# Review response: first independent storage reviews (ADR-012)

Inputs at `2bb918f550f165f535aa89c4ac4993f9fbac5067` (they review the design frozen at `6a5eb6a`):

| Report | Verdict and counts | SHA-256 |
| --- | --- | --- |
| `docs/reviews/M0/storage-reviewer-a.md` | CHANGES_REQUESTED: 3 MAJOR, 4 MINOR, 1 NIT, 3 optional | `f5ceeebacb98146ffc85ecfcf00ad1d9d47ee5332494d86495d0c4b455150a13` |
| `docs/reviews/M0/storage-reviewer-b.md` | CHANGES_REQUESTED: 1 BLOCKER, 4 MAJOR, 7 MINOR, 2 NIT, 5 optional | `4f95cf7d2b3cebaf583f72edc6a6b30abad14bb5f69521049eaf283c18fecad2` |
| `docs/reviews/M0/storage-qa.md` | FAIL (design testability): 13 MAJOR, 6 MINOR, 2 NIT, 3 optional | `a1cba5040d7573e74a9e62fb015452426c3def2ac77ddc1ca4df9b6f0fa88c51` |

Other inputs:
- the Lead's correction scope in `docs/team/multi-lms-plan.md` at `2bb918f` (task `task_05303c6abd7a`), with the B-S-11 fact correction;
- the Author's measured feasibility diagnostic (task `task_b5db7037a739`), report SHA-256 `32a07797786eac79ada89a07c472735f7fffb87cd13da7afc00ff6ccb18226ba`, recorded as host-limited facts M1–M8 in ADR-012 §17.

Vocabulary:
- "Done" = changed as asked.
- "Done, changed" = resolved in another way; the reason is given.
- "Not adopted" = an optional item that this revision does not take; the reason is given.
- "Rejected in part" = a part that the Lead's fact check showed to be wrong.

No BLOCKER or MAJOR is waived or deferred. This file records the Architect's changes. It is **not** an approval, and it closes no finding. The same three reviewers recheck the next frozen revision.

Changed files: [ADR-012](adr/ADR-012-sqlite-volume-storage.md) (revision 2, rewritten; section numbers changed), [ADR-006](adr/ADR-006-storage.md), [ADR-011 §14](adr/ADR-011-multi-lms.md#14-compatibility-migration-upgrade-and-rollback), [local-stack](local-stack.md), [M1](tasks/M1.md), [M3](tasks/M3.md), [tasks README](tasks/README.md), [architecture README](README.md).

Section map (revision 1 → revision 2): §3 layout → §3; §4 preflight → §4 (preparation), §5 (preflight), §7 (guarded paths); §5 start states → §6; §6 legacy and import → §8 (pair rule), §10 (legacy); §7 backup and restore → §8; quarantine → §9 (new); QA access → §11 (new); §8 old builds → §12; rows → §13, §14 (new); lane and cleanup → §15 (new); §9 ownership → §16; §10 assumptions → §17.

## Reviewer-A

| Id | Sev. | Resolution |
| --- | --- | --- |
| A-S-01 | MAJOR | Done. ADR-012 §4: the preflight, as root, sets the owner and mode of the volume root only, creates `packages` and `uploads` in `appdb` as `HOST_UID:HOST_GID 0700` before the first app start, and changes an existing mountpoint only when it is an empty root-owned directory. A non-empty or linked mountpoint → `mountpoint_unsafe`. Never recursive; no symbolic link is followed. §3 allows the two mountpoints only as empty directories. The Author's measurement (ADR-012 §17 M1–M3) shows the root-owned mountpoint and that precreation works on the measured host. Rows: `a-second-start`, `a-restart`, `d-mountpoint`. |
| A-S-02 | MAJOR | Done. ADR-012 §6 is one total table with 18 ordered rows and exact codes; the last row, `state_unclassified`, catches any state that no other row matches. Counterexample 1: `firstStart: "pending"` with zero or one database → `FIRST_START` (start; `mark-started` after a healthy start); one fresh identity only → `FRESH_INIT_PARTIAL` (complete it). Counterexample 2: an empty-`before` rollback removes the new identities, `.restore-<opId>/` and the empty `.previous-<opId>/`; `FRESH` accepts both journals terminal `rolled_back`; the import can run again. Counterexample 3: recovery row R1. Counterexample 4: R5 (change nothing, exit 2). Counterexample 5: journal rows come first. Done, changed for the order: `rollback_failed`, `journal_inconsistent`, `journal_open` come **before** `unknown_entry`, so a lane in the middle of a restore always names `--recover` or the quarantine (the order that B-S-06 and Q-S-02 ask for). `stack:reset` is never a recovery step (§9, ADR-011 §14). Rows: `a-first-start-resume`, `e-import-recover`, `g-prepared-lti`, `g-fresh-target`, `g-recover-idempotent`, `g-tamper`. |
| A-S-03 | MAJOR | Done. ADR-012 §8 Backup: a volume source must be in state `OK` with no open journal (`backup_source_not_ok:<code>`), and the manifest records `pairId`, `generation` and `legacySources`. A legacy source refuses `legacy_hot_journal` and `legacy_unknown_entry`; nothing is dropped. A `source: volume` manifest without `pairId` or `generation` → `manifest_incomplete`. Rows: `h-open-journal`, `e-hot-journal`, `g-damaged`, `h-volume-manifest`. |
| A-S-04 | MINOR | Done, changed. The "no live database" claim is corrected (ADR-012 §7 "Running services"). Serialization uses one host-side per-project operation lock (`mkdir`, owner record, 120 s wait, stale reclaim), not a lock file in the volume, so it also covers backup, restore and the old-build steps. Under the lock, the cleanup deletes every matching probe file, with no age bound and no count cap. Rows: `a-serialize`, `d-stale`. |
| A-S-05 | MINOR | Done. ADR-012 §12: one preflight before each harness-invoked old start command and `status` after it; old `test:acceptance` stays allowed, and the checks around it cover its two internal starts. C0 and C1 go through the old `dc()` with `--profile storage` and every profile of the step. M1 AC-M1-23 step 0. |
| A-S-06 | MINOR | Done. ADR-011 §14 rollback step 4: the copied `storage-compat.sh preflight`, old `stack:up`, then `storage-compat.sh status` (the `/data` mounts are the project volumes and the nested binds; the knobs hash is unchanged). A failed check means "stop now". Old `stack:reset` is forbidden while the override is enabled. |
| A-S-07 | MINOR | Done. ADR-012 §8: the read-only content check runs on every restore and import, before the swap. It proves only that the referenced package folders exist, not that their files are the same. Row: `e-content-missing`. |
| A-S-08 | NIT | Done. (1) Extended result code `5` only; `261`, `517`, `6` and others → `probe_error` (§5). (2) The full service definition, without the `x-node-service` anchor, with `user: "0:0"` and `restart: "no"` (§5). (3) The candidate guard covers `stack:restart` and every candidate start and data command (§12). (4) QA's oracle uses the allowed `.qa-scratch-<16 hex>` folder (§3, §11). |
| O-1 | optional | Not adopted. A gate inside each service `command` changes the service command, which the old-build allowed differences forbid (§12 C1 − C0), and it cannot run the lock probe. Hand-typed compose starts stay a stated limit (§7). |
| O-2 | optional | Done. A restore that keeps the `pairId` keeps `legacySources` (§8 pair rule). Row: `e-provenance-restore`. |
| O-3 | optional | Done. ADR-011 §14 warning: a rollback also undoes revocations and suspensions after the backup; revoke and suspend again. |

## Reviewer-B

| Id | Sev. | Resolution |
| --- | --- | --- |
| B-S-01 | BLOCKER | Done. As A-S-01. Also: every maintenance writer drops to `HOST_UID:HOST_GID` after its narrow root step (§4), so no root-owned entry appears (unit case "no root-owned entry after any maintenance command"). Rows: `a-second-start`, `a-restart`. |
| B-S-02 | MAJOR | Done. ADR-011 §14 and ADR-012 §12: rollback mode is temporary (until the next upgrade); the forbidden old commands are listed (`stack:restart`, `stack:reset`, `e2e:reset`, `test:e2e`, `demo*`, hand-typed compose starts); the supported restart is old `stack:down` → `storage-compat.sh preflight` → old `stack:up` → `storage-compat.sh status`; the operator can run `status` at any time; a failure means stop. The optional sentinel tripwire is not adopted: the Lead scope allows no sentinel that overwrites a legacy database and no broader overlay. |
| B-S-03 | MAJOR | Done. As A-S-02 counterexample 2: the empty-`before` rollback ends in exact `FRESH`, and `FRESH` accepts terminal `rolled_back` journals. Rows: `e-import-recover`, `g-fresh-target`. |
| B-S-04 | MAJOR | Done. Recovery row R1: lti `prepared` X with the app journal absent or terminal for another `opId` → remove `.restore-X/`, verify lti in place = `before`, write lti `rolled_back` X, exit 1. Drill point `prepared-lti`. Row: `g-prepared-lti`. |
| B-S-05 | MAJOR | Done. ADR-012 §4 host side: the candidate scripts and `storage-compat enable` create `infra/.data/cogniate-app`, `packages` and `uploads` as the host user, mode `0700`, before any compose start; a link, a non-directory or a wrong owner → `content_path_unsafe`; a host folder is never `chown`ed. Row: `d-content-folder`. |
| B-S-06 | MINOR | Done. The ADR-012 §6 order is the one asked for: `rollback_failed`, `journal_inconsistent`, `journal_open`, then `unknown_entry`, mountpoint, owner, identity rows, then the allowed and missing-database rows. |
| B-S-07 | MINOR | Done. (1) The order is now: checkout of the candidate with both services stopped, then `disable`, then backup (ADR-011 §14 upgrade step 2, ADR-012 §12, M1 AC-M1-23 step 3, AC-M1-38 (h1)). (2) `enable` copies `storage-compat.sh` and the probe to `.tmp/storage-compat/`, so `bash .tmp/storage-compat/storage-compat.sh preflight` runs after the old checkout. (3) The candidate guard covers `stack:up`, `stack:restart`, `test:*`, `e2e:reset`, `demo*` and `stack:data-*`. |
| B-S-08 | MINOR | Done. `rollback_failed` exit: `npm run stack:data-quarantine -- --out <folder>` copies every volume entry with a manifest, verifies it, and then removes only the two SQLite volumes; then restore a known backup into the `FRESH` lane (§9). Done, changed for the optional retry: `--recover` changes nothing on `rollback_failed` (R5), because the cause of a failed rollback is not known safely. The scratch cap is dropped (§5 step 3). Rows: `g-tamper`, `g-quarantine`, `d-stale`. |
| B-S-09 | MINOR | Done. As Reviewer-A O-2: `legacySources` survive a same-pair restore. Row: `e-provenance-restore`. |
| B-S-10 | MINOR | Done. As A-S-05: C0/C1 with `--profile storage` and the step profiles, compared by `target`; the preflight point is "before each harness-invoked old start command", with `status` after it. |
| B-S-11 | MINOR | Done, and rejected in part. Done: ADR-012 §15 and `local-stack.md`: the databases belong to the project name; a fresh QA lane has no `<lane>_ltidb` or `<lane>_appdb` before its first start and after cleanup (also AC-M3-06); `docker volume prune --all` and a Docker Desktop purge remove them. Rejected in part (Lead fact check of the Docker CLI reference): `docker system prune --volumes` prunes anonymous volumes only, so the text does not say that it removes these named volumes. The optional checkout id is not adopted: the project-name rule and the fresh-lane check are enough for the prototype. |
| B-S-12 | MINOR | Done. AC-M3-02 approved-change list: the ADR-012 storage access of the T5b P5 fixture and the AC-M1-23/30 snapshot reads through the QA fixture container; the P5 app-stop guard and every assertion stay unchanged. |
| B-S-13 | NIT | Done. As A-S-04: the running-services statement is corrected (§7). |
| B-S-14 | NIT | Done. The marker is the top-level key `x-cogniate-storage-compat` with `formatVersion` and both revisions (§12). |
| O-1 | optional | Not adopted. The import refuses a hot journal and any unknown legacy entry. A data-quality check of legacy databases is operator guidance (M4), not a gate. |
| O-2 | optional | Done. `--stop-after` needs `STORAGE_DRILL=1`, else exit 1 before any change; each use logs `storage_drill_stop` (§8). |
| O-3 | optional | Done. ADR-012 §13: `b-sequence` shows that the volumes work; the cause claim rests on the lock-level rows `b-oracle-*` and `c-host-negative` and on the §1 diagnostics. |
| O-4 | optional | Done, changed. QA runs the probe on its scratch bind folder in its own fixture container (§11, §14), so no compose override or knobs entry is needed. |
| O-5 | optional | Done. M1 AC-M1-41 defines `SIM` here as a host-infrastructure check with synthetic fixtures in QA's own lane. |

## Common QA

| Id | Sev. | Resolution |
| --- | --- | --- |
| Q-S-01 | MAJOR | Done. Schedule 1 → `FRESH_INIT_PARTIAL` (row 10). Schedule 2 → `FIRST_START` (row 14). Schedule 3 → `FIRST_START` (one database while `firstStart` is `pending`). Schedule 4 → `FRESH` (row 13). Rows: `a-first-start-resume`, `g-fresh-target`; the one-database case is a unit case. |
| Q-S-02 | MAJOR | Done. Every code is named, there are no wildcards, each row has its result and message, and the evaluation order is the one QA suggested (§6). |
| Q-S-03 | MAJOR | Done. As A-S-01. "Inside" means the direct children of the volume root (§3 allowed-children table); the mountpoints must be empty; nothing is recursive. Row: `d-mountpoint`. |
| Q-S-04 | MAJOR | Done. ADR-012 §11 QA fixture container: pinned image id, `--rm`, `--network none`, QA labels, only the two lane volumes, read-only at any time as `HOST_UID`, write only while both services are positively stopped and under the operation lock, root only for the named owner changes, one stated running-stack exception for `a-restart-refusal`. QA's oracle scratch is `.qa-scratch-<16 hex>`. Independence: QA's own script is the oracle, never the product maintenance code. |
| Q-S-05 | MAJOR | Done. ADR-012 §12 tree rule: every tracked path outside `tests/` equals the old SHA, `tests/` equals the frozen candidate test tree (tree hash), and no other untracked file exists outside the ignored paths. |
| Q-S-06 | MAJOR | Done. ADR-012 §12 command rule: a principle plus a full list, including old `npm ci`, `build`, `gen-env`, `config`, the harness's `exec` and `stop`, and `git checkout`. Old `seed` is allowed because it uses `exec` only (read in the `seed.sh` of both old SHAs). The disable order is fixed as in B-S-07. |
| Q-S-07 | MAJOR | Done. ADR-012 §13 and M1 AC-M1-41: 63 stable ids in groups (a)–(j) with phases; each has its oracle in M1. QA's 45 rows were the provisional input; the final list adds `a-second-start`, `a-restart-refusal`, `a-serialize`, `a-first-start-resume`, `d-symlink`, `d-content-folder`, `e-hot-journal`, `e-old-schema`, `e-import-recover`, `e-provenance-restore`, the swap and rollback drill points, `g-recover-idempotent`, `g-quarantine`, `g-fresh-target`, `h-open-journal`, `h-pair-mismatch` and `h-old-manifest`. It drops `d-overflow` (no cap). |
| Q-S-08 | MAJOR | Done, changed. `c-selftest` must PASS. `c-host-negative` is the single conditional row: PASS, or `NOT_APPLICABLE` with QA's same-round oracle evidence on the same folder. It is reported separately and never counted as a PASS (the Lead rule; not "PASS-NA"). AC-M3-01 states the accounting (ADR-012 §14). |
| Q-S-09 | MAJOR | Done. ADR-012 §5: the command line with `--run-id`, `--project` and `--folder`; the modes `report`, `check`, `mark-started` and `selftest`; one JSON line per folder for pass and fail, with `runId`, `fsType`, `state`, `reason` and the wait times; a summary line; exit codes 0/1/2; the three self-test scenarios. |
| Q-S-10 | MAJOR | Done. Drill backups differ from the in-place pair in both databases, and the oracle checks the database hashes plus the identity `generation` and `provenance` (no sidecar difference is required). New drill points `prepared-lti`, `swap-lti-mid`, `swap-app-mid`, `rollback-mid`. The tamper boundary is `swapped`. A second `--recover` → "nothing to recover", exit 0. Rows (g). |
| Q-S-11 | MAJOR | Done. Row `e-old-schema`: QA copies the v10 databases of this round's AC-M1-23 step 4 backup (made on the volumes) to the legacy folders of a fresh storage lane, imports them, and the candidate start applies the new migrations. The storage phase runs after the migration phase for this reason. |
| Q-S-12 | MAJOR | Done. As A-S-03: `legacy_hot_journal` for start and backup, and nothing changes. Row: `e-hot-journal`. |
| Q-S-13 | MAJOR | Done. As A-S-04, and: a failed `stack:restart` preflight exits 1 before `up --force-recreate`, so the running container keeps its id and start time (§7). Rows: `a-restart`, `a-restart-refusal`, `a-serialize`. |
| Q-S-14 | MINOR | Done. The one-byte and added-key negatives are harness self-checks in a separate section (ADR-012 §13, AC-M3-01). The rows `i-enable-refusal` and `i-candidate-guard` stay product rows. |
| Q-S-15 | MINOR | Done. As A-S-08 (2): the full field table in §5. |
| Q-S-16 | MINOR | Done. As A-S-05: C0/C1 through the old `dc()` with its saved profile environment; volume lists compared by `target`. |
| Q-S-17 | MINOR | Done, changed. No count cap: under the operation lock, every name that matches the probe pattern is deleted; a failed delete → `scratch_cleanup_failed` with the path. Row: `d-stale` (twelve files removed, one near-match refused). |
| Q-S-18 | MINOR | Done. ADR-012 §8 pair rule table (same pair, another pair, `FRESH` target, legacy source). A newer generation of the same pair is accepted; the result is target generation + 1. Rows: `h-pair-mismatch`, `g-fresh-target`, `h-old-manifest`. |
| Q-S-19 | MINOR | Done. ADR-012 §10 step 1: the label `com.docker.compose.project=<project>`, a mount with destination `/data` and a source equal to a resolved legacy path. Row: `e-old-layout`. |
| Q-S-20 | NIT | Done. As Reviewer-B O-5. |
| Q-S-21 | NIT | Done. `tests/host/m1-migration.selftest.mjs` is in the QA list (ADR-012 §11, §16). |
| O-1 | optional | Done. As Reviewer-B O-2. |
| O-2 | optional | Done. The run id and the wait times are in every preflight line (§5). |
| O-3 | optional | Done. `stack:up` and `stack:restart` print the preflight lines, and the probe appends them to `infra/.logs/storage-preflight.jsonl` (§5). |

## Row accounting

| Item | Value |
| --- | --- |
| Existing rows per full round | 416 (unchanged ids, phases and labels) |
| New AC-M1-41 rows per full round | 63: a 6, b 3, c 2, d 7, e 13, f 6, g 16, h 6, i 2, j 2 |
| Total per full round | 479 |
| Phases | `sim` 394, `snapshot-isolated` 6, `snapshot-upgrade` 6 (5 + `j-snapshot`), `migration` 12 (11 + `j-migration`), `storage` 61 |
| Conditional | only `c-host-negative` (PASS, or `NOT_APPLICABLE` with evidence; never counted as PASS) |
| Not rows | the harness self-checks; the supplemental unit and integration cases |

## Still to verify in the build step

The design does not claim these. ADR-012 §17 lists them:
- the measured facts M1–M7 for the candidate and old product Compose files, with `--env-file` and the old `dc()` arguments;
- the relative `-f .tmp/compose.knobs.yaml` path resolution;
- the WAL lock enforcement on the volume with the product's `node:sqlite`;
- the extended `errcode` in `node:sqlite` errors;
- the atomic host `mkdir` and `kill -0` for the operation lock;
- the `docker inspect` mount fields for `status`;
- Linux hosts.

All runtime gates run again after the implementation. All 32 live rows stay `UNVERIFIED`.

## Round 3 response (to the Round 2 rechecks; ADR-012 revision 3)

The Round 1 response above is kept as history; it applies to revision 2. This section applies to revision 3.

Inputs at `584ab9efdcba1be2b5dfa1d0bc506d043f65ea72` (Round 2 of each report rechecks revision 2, frozen at `7a6374460dd02c3544b6dbf043086b0facefceb2`):

| Report (Round 2 section) | Verdict and new findings | SHA-256 of the whole report |
| --- | --- | --- |
| `docs/reviews/M0/storage-reviewer-a.md` | CHANGES_REQUESTED: A-S-01 to A-S-08 closed; new A-S-09 MAJOR, A-S-10 MINOR, A-S-11 NIT (5 items) | `1ba1ceb6abec579db1d46b2c115a22ab717fcf507f56bd215db7945dfd48c14a` |
| `docs/reviews/M0/storage-reviewer-b.md` | CHANGES_REQUESTED: B-S-01 to B-S-14 closed; new B-S-15 MAJOR, B-S-16 MINOR, B-S-17 to B-S-19 NIT | `16b857b032d430fa67fc1db4375cc25a8d8dea109616be1b6e06059f5d84a338` |
| `docs/reviews/M0/storage-qa.md` | FAIL (design testability): Round 1 findings closed or converted; new R2-01 to R2-05 MAJOR, R2-06 to R2-10 MINOR, 2 optional; 479 = 416 + 63 confirmed | `50b83fbdc6c50645be16c54e7ddf2b8c35e450cadae9e83325c2841c567a2194` |

Other inputs:
- the Lead scope "Storage design correction, Round 3" in `docs/team/multi-lms-plan.md` at `584ab9e` (task `task_5fc787769d03`);
- Lead message `msg_f0221cbee8dd`: keep the recovery change bounded and serialized; no general adversarial filesystem protocol.

No MAJOR is waived or deferred. This section records changes; it closes no finding. The same three reviewers recheck the next frozen revision.

### Reviewer-A, Round 2

| Id | Sev. | Resolution |
| --- | --- | --- |
| A-S-09 | MAJOR | Done. ADR-012 §7 is rewritten. (1) **Storage containers** have exact labels (`com.docker.compose.project`, `org.cogniate.storage`, `org.cogniate.storage.run=<runId>`) and the name `<project>-storage-<runId>`. (2) The lock record has a **process identity** (`pid` and `pidStart` from `ps -o lstart=`). (3) Acquisition A1–A6: a stale record is reclaimed only when **no active storage container** of the project exists (else `storage_writer_active`, nothing moves). Every new holder checks again before its first Docker write (A6). (4) The takeover is race-safe without `flock`: a lock folder appears only by the `rename` of a complete candidate folder; a takeover is a `rename` to the keyed name `stale-<runId>`, which is never deleted, after a second read that follows the liveness test (proof in §7). (5) The operator exit for an orphaned writer: wait, or `docker stop <name>`, then `--recover`. Rows: `g-orphan-refusal`, `g-orphan-complete`, `g-orphan-stopped`; drill option `--pause-after` (§8). Unit cases: M1 Self-check. |
| A-S-10 | MINOR | Done, bounded (Lead `msg_f0221cbee8dd`). ADR-012 §8 **R3 order**: classify each in-place file first; after-files leave their places before any before-file comes back; unknown bytes or an unlisted sidecar → `rollback_failed`, nothing deleted. **Checked move**: one `rename` after an `lstat` check that the target is absent. The lock and the stopped services make the check enough; no new partial state and no link protocol. A collision → `rollback_failed`. Unit cases: M1 Self-check. |
| A-S-11 (1) | NIT | Done. §4 privilege rule: as root, only reads and §4 steps; no identity, journal or log line as root, in any mode; `mark-started`, `report`, `probe` and `selftest` drop privilege at once. |
| A-S-11 (2) | NIT | Done. §8 "Other target states": `restore_target_state` and `import_target_not_fresh`, with the state named. Row `h-target-state`. |
| A-S-11 (3) | NIT | Done. As B-S-15. |
| A-S-11 (4) | NIT | Done. `enable` copies and hashes `storage-oplock.sh` with the probe and the runner (four hashes, qualifier `<h4>`); the copied `storage-compat.sh run --` holds the lock for an old command (§12). |
| A-S-11 (5) | NIT | Done. The QA host control refuses `m1-restart` and `m1-profile` while the marker is present (§11; harness self-check in §13). Owner: QA (`tests/host/m1-control.mjs`). |
| O-1 note | — | Done. The `depends_on` reason in §7 no longer cites the old-build differences; the reason is the mode, `runId` and lock that a compose dependency cannot give. |

### Reviewer-B, Round 2

| Id | Sev. | Resolution |
| --- | --- | --- |
| B-S-15 | MAJOR | Done. ADR-012 §9: after the verified copy, quarantine lists every container that uses a lane volume. It removes only the project's `lti-service` and `cogniate-app` containers that are not `run` containers and are `exited`, `created` or `dead` (read again), by id, without `-f` or `-v`. Any other user → `volume_in_use`, naming it; nothing is removed. `quarantine.json` records what was removed. Rows: `g-quarantine` (now from `docker compose stop`, with a container-list oracle) and `g-quarantine-in-use`. ADR-011 §14 states it. |
| B-S-16 | MINOR | Done. Process identity with `pidStart` (a reused pid or a pid after a reboot is not live); `operation_lock_invalid` with a manual exit in the M4 guide; "one checkout per project" in §7, §15, `local-stack.md` and ADR-011 §14, with no cross-checkout claim; the lock helper is copied and hashed for old checkouts. |
| B-S-17 | NIT | Done. ADR-012 §12 and §17 S1: both old `lib.sh` (line 9) set an absolute `KNOBS_FILE`; the old relative-path assumption is removed. I read this with `git show` at both SHAs. |
| B-S-18 | NIT | Done. ADR-012 §12 "fresh old-route lane"; M1 AC-M1-23 step 1 and AC-M1-38 (h1): `enable` in the candidate checkout before `git checkout <old>`. |
| B-S-19 | NIT | Done. As A-S-11 (1): output and log lines only after the privilege drop, also after a root-step failure. |

### Common QA, Round 2

| Id | Sev. | Resolution |
| --- | --- | --- |
| R2-01 | MAJOR | Done. ADR-012 §8 "File set" and §13 "Recovery oracle"; M1 AC-M1-41 rules. Verification and the oracle compare the full file set (`<db>`, `-wal`, `-shm`: presence, size, SHA-256; identity) and the logical rows from copies of stopped databases with their sidecars, never the originals. The fixture differs logically in both databases; it does not need every sidecar to differ. |
| R2-02 | MAJOR | Done. ADR-012 §7 scope table: candidate `test:acceptance`, `test:e2e` and `e2e:reset` hold no lock; each internal `stack-up.sh` or `stack-reset.sh` run takes it. The lock is not re-entrant (`operation_lock_reentry` at once). The whole-command lock applies only to the old-build wrapper. Rows: `a-lock-scope` (host-control restart during a candidate suite), `a-lock-reentry`. |
| R2-03 | MAJOR | Done. M1 `e-old-schema`: the complete synthetic credential set (four `.env` values and four secret files), the storage lane's own project, port, subnet, certificates and Moodle values, no `gen-env`, `seed`, `lti:bootstrap` or `seed-portal` before the oracle, the oracle with the copied values only. The row runs last in the `storage` phase. |
| R2-04 | MAJOR | Done. ADR-012 §11 container kinds: `storage-probe` (the candidate probe read-only; `selftest` in a new folder of the container's writable layer; `probe` mode on the `.tmp/qa-host-negative-<16 hex>/` bind for `c-host-negative` only), `storage-oracle`, `storage-decoy`, `storage-volume-user`. All bounded, labeled, without network. The P5 app-stop guard is unchanged. New probe mode `probe` (§5). |
| R2-05 | MAJOR | Done. `a-serialize` has a fixed order (the backup first, `stack:up` after the lock record names the backup) and an order-independent oracle (no service starts before the backup's release). Separate rows `a-lock-wait` and `a-lock-stale` (dead owner, reused pid, `cand-*` and `rel-*` leftovers). |
| R2-06 | MINOR | Done. ADR-012 §5 steps: read, then the **journal gate** (rows 1–3 refuse with no change), then preparation, which records an unsafe mountpoint for row 5, then the privilege drop, cleanup and the table. |
| R2-07 | MINOR | Done. As A-S-11 (2). |
| R2-08 | MINOR | Done. ADR-012 §14 and AC-M3-01: the same-result rule applies to `c-host-negative`; PASS in one round and `NOT_APPLICABLE` in the other fails the run. No broader waiver. |
| R2-09 | MINOR | Done. ADR-012 §10: first-match rows L1–L7; the §6 journal rows come first (L1), then the legacy hot journal (L2), then other §6 refusals (L3). |
| R2-10 | MINOR | Done. ADR-012 §7 "Lock events": sink stdout and `infra/.logs/storage-lock.jsonl`, the fields with `ts`, and the event list. |
| O2-1 | optional | Done. `ts` on every `storage_preflight`, summary, self-test and drill line. |
| O2-2 | optional | Done. ADR-012 §17 assumption 8 and AC-M3-01: no test window or lease changes; QA records restart durations. |

### Row accounting (revision 3)

| Item | Value |
| --- | --- |
| Existing rows per full round | 416 (unchanged ids, phases and labels) |
| AC-M1-41 rows per full round | 72 = the 63 of revision 2 + 9 added: `a-lock-wait`, `a-lock-stale`, `a-lock-scope`, `a-lock-reentry`, `g-orphan-refusal`, `g-orphan-complete`, `g-orphan-stopped`, `g-quarantine-in-use`, `h-target-state` |
| Groups | a 10, b 3, c 2, d 7, e 13, f 6, g 20, h 7, i 2, j 2 |
| Total per full round | 488 |
| Phases | `sim` 394, `snapshot-isolated` 6, `snapshot-upgrade` 6, `migration` 12, `storage` 70 |
| Conditional | only `c-host-negative`; same result in both rounds; never counted as PASS |
| Not rows | harness self-checks (copied-file hashes, added environment key, host-control refusal under the marker); unit and integration cases |

### Facts: source, measured, unmeasured

- **Source facts** (read with `git show`; ADR-012 §17 S1–S5): absolute old `KNOBS_FILE` and conditional `-f`; old `seed.sh` uses `exec` only; old `test:acceptance` has two internal starts; the candidate host control runs `npm run stack:restart`; the candidate `stack-reset.sh` removes project containers with `docker rm -f`.
- **Measured** (Author feasibility diagnostic, one macOS host; ADR-012 §17 M1–M8): unchanged from revision 2.
- **Unmeasured** (ADR-012 §17 assumptions 1–9), among them: directory `rename` and `ps -o lstart=` behavior on the host; a `docker compose run` container that keeps running after its client gets `SIGKILL`; `run --name`/`--label` and `docker ps --filter volume=`; restart durations inside the existing test windows; Linux hosts.

All runtime gates run again after the implementation. All 32 live rows stay `UNVERIFIED`. No acceptance credit comes from this design.

## Round 3 bounded corrections (to the Round 3 rechecks; ADR-012 revision 3.1)

The two earlier sections above are kept as history. This section applies to revision 3.1. It is a bounded correction of the concrete Round 3 findings that the Lead's "Storage Round 3 escalation and bounded correction" lists. It is not a new general design round, and it labels no finding deferred or approved.

Inputs at `7f2c2c5db6f398291106b778f19811ca3dfaa440` (Round 3 of each report checks revision 3, frozen at `b3bd22e2ada43f45499db5e50cfb4cafc8295fb9`):

| Report (Round 3 section) | Verdict and findings | SHA-256 of the whole report |
| --- | --- | --- |
| `docs/reviews/M0/storage-reviewer-a.md` | APPROVE (design); new A-S-12 MINOR | `c5bac73f38f3ca4f2d897b090b6195420f22bb2f54aa5993cab9eeed312429b8` |
| `docs/reviews/M0/storage-reviewer-b.md` | APPROVE (design); new B-S-20 MINOR (required), B-S-21 NIT | `42dd201aa7fdbe28f3b83681438cc3310a36106fd7daf026565d71eae6205b60` |
| `docs/reviews/M0/storage-qa.md` | FAIL (design testability); R3-01, R3-02 MAJOR (text gaps), R3-03 to R3-06 MINOR, R3-07 NIT; 488 = 416 + 72 confirmed | `ee614e70eba8aeae165533109eb36bf8089412c8a62ce42b7cad91b1b0dec1df` |

The same owners check these dispositions in their Round 3 addenda. This text closes no finding.

| Id | Sev. | Resolution |
| --- | --- | --- |
| QA R3-01 | MAJOR | Done. M1 `e-old-schema`: the copy list adds the course package folders that the copied app database names (QA reads the distinct `package.storage_path` values from a copy, never the original) and places them in the storage lane **before** the legacy backup. The import prints a new `storage_content_check` line (ADR-012 §8); the row records `result: "pass"` and `checked` equal to QA's own count. The credential, lane and source limits are unchanged. |
| QA R3-02 | MAJOR | Done. ADR-012 §11: new container kind `storage-p5`, the second named exception while a service runs. It mounts only `<project>_appdb`, never `ltidb`; it writes only `cogniate.db` and its SQLite sidecars; `cogniate-app` is positively stopped by the approved P5 guard; the stop, write and start run inside one `storage-oplock.sh run --`; `lti-service` may run. §7 and §11 name the existing harness `docker compose stop`/`start` actions (T5b P2 and P5, the AC-M1-23/30 stops, Moodle) as accepted harness actions, not operator starts. AC-M3-02 states the same; no assertion changes. |
| A-S-12 | MINOR | Done (bounded correction, not an accepted limit). ADR-012 §7 "Process ownership": the lock record also holds `pgid`; a record is live while its owner identity is live **or** another process has that group, so a Docker client that survives a parent-only `SIGKILL` keeps the record live also before it creates a container. Guarded commands keep their Docker clients in their group; the Build Runner (source fact S6) is started in its own group. The design does not claim that every `npm` or script call has its own group (source fact S7): in a shared group a killed command's record stays live (fail-closed, `operation_in_progress`, with a stated exit). Self-check: `storage-oplock.sh selftest` scenario `orphan-client` (run once per round by QA as a harness self-check, and in the Author's tests); stack-level case `a-lock-stale` (4). Unit cases: M1 Self-check. |
| B-S-20 | MINOR (required) | Done. ADR-012 §7 "Primitives": every lock folder move is `rename(2)` through `node:fs.renameSync`, never shell `mv`; every `ps` call writes and compares under `LC_ALL=C`. Self-check scenarios `rename-held` and `locale`; unit case with a non-C locale on one side. |
| B-S-21 | NIT | Done. ADR-012 §7 `stack:down` row and §9: `stack:down` (`down --remove-orphans`) removes the service containers and the project network and keeps the volumes and the knobs file (source fact S8). |
| QA R3-03 | MINOR | Done. ADR-012 §9 step 1 completes the removal of its own ended copy container (by its run label) before step 2. |
| QA R3-04 | MINOR | Done. M1 `a-serialize`: QA waits for the backup's `storage_lock_acquired` event or the live record, whichever comes first. |
| QA R3-05 | MINOR | Done. M1 `h-target-state` uses one lane at two points: a `--stop-after staged` refusal then `--recover`, and the `FRESH` state between `g-quarantine` and `g-fresh-target`. |
| QA R3-06 | MINOR | Done. M1 `h-pair-mismatch` runs after `g-fresh-target`: one more quarantine, then `stack:up` makes a fresh pair whose `pairId` QA checks differs from `B`'s, then the restore of `B` refuses `pair_mismatch`. |
| QA R3-07 | NIT | Done. ADR-012 §7 scope: `demo` has no lock of its own (its internal `stack-up.sh` takes it); `demo:prepare`, `demo:users` and `demo:browser` start no container. |

### Facts used by these corrections

- **Source facts** (`git show`, read only; ADR-012 §17): S6 the Build Runner start in `stack-up.sh`/`lib.sh` is a plain `nohup … &` job; S7 QA's `tests/host/lib.mjs` `run` does not detach, and P5/P2 use `docker compose stop`/`start cogniate-app`; S8 `stack-down.sh:7` is `down --remove-orphans` in all three trees.
- **Architect scratch probes** (design feasibility only, not acceptance; no Docker, no product command; macOS APFS, `/bin/bash` 3.2.57, Node 24.21.0; ADR-012 §17 P1–P5): `renameSync` onto a non-empty folder fails with `ENOTEMPTY` (onto an empty one it replaces); `mv` moves a folder into an existing one; `ps -o lstart=` differs under `fr_FR.UTF-8`; after a parent-only `SIGKILL` the child stays in the owner's own group, and a non-detached child shares its caller's group; `( set -m; … & )` gives a job its own group.
- **Unmeasured** (ADR-012 §17 assumptions 4, 10, 11 added or changed): the Linux behavior of P1–P5; whether the `docker compose` client (or the `docker` front process) stays in the command's group; whether `down --remove-orphans` touches a running storage container.

### Row accounting

No row is added or removed. Each full round still has **488** mandatory rows: the 416 existing rows (unchanged ids, phases, labels and assertions) and the 72 AC-M1-41 rows (a 10, b 3, c 2, d 7, e 13, f 6, g 20, h 7, i 2, j 2). Changed oracles or fixtures: `a-serialize`, `a-lock-stale` (new case 4), `e-old-schema`, `g-orphan-refusal`, `g-orphan-stopped`, `h-pair-mismatch`, `h-target-state`. The lock self-check is a harness self-check, not a row.

No implementation, runtime or acceptance approval follows from this text. All 32 live rows stay `UNVERIFIED`, and every required M1, legacy, M2 and T7 rerun remains.

## G1 bounded correction: R3B-01, A-S-13, B-S-22 (ADR-012 revision 3.2)

The sections above are kept as history. This section applies to revision 3.2. It stays inside the escalated G1. It is not a fourth general review round and no accepted waiver.

Inputs at `0928c888543a1171944870125ac2fe2ab5e0067a` (bounded checks of revision 3.1, frozen at `a65a4ee`): Reviewer-A APPROVE with new MINOR A-S-13; Reviewer-B APPROVE with new NIT B-S-22; common QA FAIL (bounded testability) with new MAJOR R3B-01, and R3-01 to R3-07 closed. Whole-report SHA-256: Reviewer-A `89955081e57ab49caea679c6cf43dba9dc418a26c55ed161b2a57af8e26889c0`, Reviewer-B `c18278e6db0fa287efbe80bc0bc8ad41d8de41114a80aeebc59b18dc8f10394b`, QA `5ae7988ddcf37cff10cb336b85bc115abd2d9b23315433378382715a2e3fd12d`. The same owners check these dispositions after the Lead freezes them. This text closes no finding.

| Id | Sev. | Resolution |
| --- | --- | --- |
| QA R3B-01 | MAJOR | Done. ADR-012 §11 "Lane volume presence": (1) before every mount (every QA container kind, also `docker create`), QA checks both exact names with `docker volume inspect`; it mounts only an existing volume with this project's Compose labels; an absent name is recorded `absent` and never mounted; an unlabeled or foreign volume with a lane name is unsafe (row FAIL, or `BLOCKED` before the first start), and QA changes and removes nothing. (2) No QA step creates a lane volume: the `FIRST_START` fixture comes from one product `storage-preflight check --prepare` run through Compose under QA's `storage-oplock.sh run --` (exact command in §11). (3) QA then checks independently: labels, `HOST_UID:HOST_GID 0700` roots and mountpoints, two `pending` fresh identities with one `pairId`, no database or journal. (4) The partial state removes only the app identity as the service user. (5) `FRESH` and "nothing changes" define absent volumes, so a product command's own Compose creation of the declared volumes is never confused with a QA mount. ADR-012 §15, AC-M3-06 and `local-stack.md`: fresh-lane, ownership record, teardown and after-cleanup checks use the exact names as well as the labels; the teardown removes only resources recorded as made by the run and preserves and reports any other. Rows changed: `a-first-start-resume` and `h-target-state` (2) use the product setup; `a-fresh` and `g-quarantine` check exact names. |
| A-S-13 | MINOR | Done as a gate, not as an accepted limit. ADR-012 §17 "Build-step gate G-1": a separate Lead-assigned Author diagnostic measures, with a real Docker client, the groups of the script, the `docker` front process and the `compose` plugin, a parent-only kill before creation and a whole-group kill before creation (no surviving client, no container within 30 s). §7 claims the group guarantee only where G-1 passed. If G-1 is unmeasured or fails, the implementation is not accepted, and AC-M1-41 and the stack-level reruns stay `BLOCKED`; the procedure is stop, record the evidence, report it for an approved repair. Reviewer-A's two repair ideas are recorded only as candidates for that later review. M1 Self-check and M3 AC-M3-01 state the gate. No mechanism changed. |
| B-S-22 | NIT | Done. The group read is exactly `LC_ALL=C ps -A -o pid= -o pgid=` in ADR-012 §7, §17 assumption 4, the self-check output field `psCommand`, and the M1 unit list. |

### Fixture paths checked for the absent-volume rule

Every fixture step that mounts a lane volume was checked. Only two rows could meet absent volumes at a QA write; both now use the product setup.

| Row or fixture | Volume state at the QA step | Result |
| --- | --- | --- |
| `a-first-start-resume` | absent (new lane) or absent after quarantine | changed: product setup, independent check, service-user removal for the partial case |
| `h-target-state` (2) | absent after `g-quarantine` | changed: product setup, independent check, service-user removal of both identities to return to `FRESH` |
| `a-fresh`, fresh-lane boundary, teardown | absent before the first start; absent after cleanup | changed: exact names and labels, ownership record, preserve rule |
| `e-fresh-refusal`, `e-content-missing`, `e-old-schema` (after `stack:reset`), `g-fresh-target`, `h-pair-mismatch`, `e-import`, `e-import-recover` | absent or `FRESH` before a **product** command | unchanged steps; QA mounts only after the product's Compose run created the labeled volumes; `FRESH` and "nothing changes" follow §11 item 5 |
| `d-*`, `f-*`, `g-*` drills, `g-quarantine-in-use`, `b-*`, `a-*` lock rows, P5 (`storage-p5`), AC-M1-23/30 snapshot reads and fixtures (`m1-migration.mjs`) | volumes exist (made by earlier guarded starts) | unchanged; the exact-name check runs before each mount |
| `c-*`, `e-old-layout` decoy, credential and package copies | no lane volume mounted | unchanged |

Root fixture exceptions (`d-owner`, `d-mountpoint`), the P5 exception, oracle independence (the setup output is never the oracle) and all 416 original assertions are unchanged.

### Row accounting

No row is added or removed: **488** per full round = 416 original rows + 72 AC-M1-41 rows (a 10, b 3, c 2, d 7, e 13, f 6, g 20, h 7, i 2, j 2); phases `sim` 394, `snapshot-isolated` 6, `snapshot-upgrade` 6, `migration` 12, `storage` 70.

### Remaining assumptions and gates

- Gate G-1 (A-S-13) is unmeasured until the Author diagnostic reports; it blocks implementation acceptance.
- ADR-012 §17 assumptions 1–9 and 11 stay unmeasured; assumption 6 now also covers the Compose volume labels that the presence rule reads.
- No implementation, Docker or acceptance authority follows from this text. All 32 live rows stay `UNVERIFIED`, and every M1, legacy, M2 and T7 rerun remains.
