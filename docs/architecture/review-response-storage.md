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
