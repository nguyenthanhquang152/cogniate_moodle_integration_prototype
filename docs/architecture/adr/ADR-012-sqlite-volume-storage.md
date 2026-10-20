# ADR-012: SQLite state on project-scoped named volumes, with a lock prerequisite

Status: Proposed, **revision 2** (design for independent review; not accepted). Date: 2026-10-21. Owner: Architect. Amends [ADR-006](ADR-006-storage.md) (storage location) and [ADR-011 §14](ADR-011-multi-lms.md#14-compatibility-migration-upgrade-and-rollback) (maintenance commands).

Revision history:
- Revision 1 was frozen at `6a5eb6a` and reviewed in `docs/reviews/M0/storage-reviewer-a.md`, `storage-reviewer-b.md` and `storage-qa.md` (committed at `2bb918f`).
- Revision 2 answers every finding. The ID-by-ID response is [review-response-storage](../review-response-storage.md).
- The same three reviewers recheck revision 2; this text does not close any finding.

## 1. Context

| Input | Value |
| --- | --- |
| Author diagnostic | `/Users/quangnguyen/cogniate-author-diag/providers500-8138097-20261020T2022Z/public/AUTHOR-DIAGNOSTIC-report.md`, SHA-256 `f759561126bf17c70914fbcb114850f95662b838ffd1bc185f3a732e0ce075c3` |
| QA diagnostic | `/Users/quangnguyen/cogniate-qa-runs/claude-sqlite-diag-20261020T2035Z/public/QA-SQLITE-LOCK-DIAGNOSTIC.md`, SHA-256 `ada5017363a0e757b3faaccc301c0e854fb95056bd6ec2928ab95c5060c62cb7` |
| Proposal | `/Users/quangnguyen/cogniate-architect-diag/storage-recovery-task_a37d8fc8b8e3/STORAGE-RECOVERY-PROPOSAL.md` revision 2, SHA-256 `a0e497c2058a29f1c463358daf088cd6ea5370c8ba439d8ed5973d2784e05ff3` |
| Lead scope | `msg_9cf2186e296b` (task `task_f7bf1fb07035`); correction scope in the phase plan at `2bb918f` (task `task_05303c6abd7a`) |

What is known on the measured host (Docker Desktop 4.96.0, engine 29.9.1):

| Location | Filesystem | WAL mode (the product mode) | DELETE mode |
| --- | --- | --- | --- |
| host bind mount (`infra/.data/<service>`) | `fakeowner` | **lock not enforced**: a second writer gets the lock while the first holds it; the first then cannot commit; the final rows are `[B, B]`, and the first writer's inserted row is absent (QA; the author saw the same lock failure) | disputed: the author saw no lock, QA saw the lock enforced |
| Docker named volume | `ext4` | enforced (QA) | enforced (QA) |
| container layer | `overlay` | enforced (QA, author) | enforced (QA, author) |

The symptom was `GET /api/providers` `500`. A CLI process closed `lti.db` while the server had it open, and the server's next read failed with `SQLITE_CORRUPT`. The cause inside Docker is not known.

This ADR does **not** claim:
- that the engine update caused the fault;
- that every lock or mode fails on bind mounts;
- that bind mounts fail on other hosts.

The decision does not depend on any of these claims.

## 2. Decision

| # | Decision |
| --- | --- |
| DS1 | The SQLite files of both services live only on two project-scoped named volumes, `ltidb` and `appdb`. Content files stay on the existing host folders, as nested binds. No product code changes. |
| DS2 | A storage preflight prepares the volume roots without recursion, checks a real WAL lock exclusion with a live holder and a positive release, and evaluates one total, ordered start-state table. It runs in a fresh one-shot container on every **guarded** path of §7, under one per-project operation lock. |
| DS3 | The two databases are one **pair**. Identity files name the pair. A journaled paired restore has a total recovery table, keeps the old state until both targets are verified, and never claims "no target changed" without a verification. |
| DS4 | Old bind-folder databases are never selected automatically. An explicit import goes only into a fresh pair. Any ambiguous state refuses, with an exact reason code. A non-destructive quarantine is the exit for an unresolved lane. `stack:reset` is never a recovery step. |
| DS5 | A bounded storage-only override lets exactly the two old builds `b0b83a8289e1bf9cf349068aca184f0879e9aaf0` and `9f96f7b24cd0aed702e4dc40373bdda4307aad31` run on the volumes. It is the only exception to the no-overlay rule. No route and no documented procedure returns live data to a bind folder. |
| DS6 | Acceptance criterion AC-M1-41 with enumerated rows (§13), and every stack-level gate runs again on the new candidate. |

## 3. Layout

| Path | Storage | Owner, type, mode | `stack:reset` | Backup |
| --- | --- | --- | --- | --- |
| lti-service `/data` (`lti.db`, `lti.db-wal`, `lti.db-shm`) | named volume `ltidb` (Docker name `<COMPOSE_PROJECT_NAME>_ltidb`) | root folder `HOST_UID:HOST_GID`, `0700` | removed (existing `down -v`) | yes |
| cogniate-app `/data` (`cogniate.db`, `-wal`, `-shm`) | named volume `appdb` (`<project>_appdb`) | same | removed | yes |
| `appdb` mountpoints `packages`, `uploads` (inside the volume) | directories made by the preflight (§4) | `HOST_UID:HOST_GID`, `0700`, always empty in the volume | removed with the volume | no |
| cogniate-app `/data/packages`, `/data/uploads` | **nested binds** of the host folders `infra/.data/cogniate-app/packages` and `…/uploads` | host user, directory, `0700`, made by the host-side scripts (§4) | removed (existing `rm -rf infra/.data/cogniate-app`) | no (as today) |
| Moodle volumes, build queue, logs, secrets, certificates, fixtures, `.mbz` backups | unchanged | unchanged | unchanged | unchanged |

Rules:
- A database and its `-wal` and `-shm` files are always in the same volume folder.
- The upload rename stays inside one mount (`uploads/.tmp` → `uploads`). The host-side Build Runner reads `infra/.data/cogniate-app/uploads` as today. `package.storage_path` stays relative to `/data`.
- **Allowed direct children** of a volume root (checked with `lstat`; a symbolic link is never followed and is never allowed):

| Name pattern | Type | Owner | Notes |
| --- | --- | --- | --- |
| `lti.db` / `cogniate.db` (only in its own volume) and its `-wal`, `-shm` | regular file | `HOST_UID:HOST_GID` | the database |
| `.storage-identity.json`, `.storage-journal.json` | regular file | `HOST_UID:HOST_GID` | §6, §8 |
| `.storage-identity.json.tmp`, `.storage-journal.json.tmp` | regular file | `HOST_UID:HOST_GID` | only during a write; a leftover is removed by the next operation that holds the lock |
| `.restore-<opId>`, `.previous-<opId>` (`opId` = 32 lowercase hex) | directory | `HOST_UID:HOST_GID` | §8 |
| `.lock-probe-<runId>.db`, `-wal`, `-shm` (`runId` = 16 lowercase hex) | regular file | `HOST_UID:HOST_GID` | probe scratch; removed by the probe |
| `.qa-scratch-<16 hex>` | directory | `HOST_UID:HOST_GID` | QA oracle scratch (§11); QA removes it |
| `packages`, `uploads` (only in `appdb`) | directory, **empty** | `HOST_UID:HOST_GID`, or `root:root` before the preflight changes it | the nested-bind mountpoints |

  Any other entry is `unknown_entry`.

## 4. Preparation of folders and mountpoints

Host side (the candidate `stack-up.sh`, `stack-restart.sh`, the maintenance commands, and `storage-compat` for the old builds):
1. Create `infra/.data/cogniate-app`, `…/packages` and `…/uploads` as the host user with mode `0700` when they are absent. Do this before any compose command that can start a service.
2. Refuse `content_path_unsafe` when any of the three exists and is a symbolic link, or is not a directory, or is not owned by the host user. Nothing is changed in that case. The scripts never `chown` a host folder.

Volume side (the preflight, as root, before it drops privilege; §5 step 1):
1. **Volume root folder:** if its owner is not `HOST_UID:HOST_GID` or its mode is not `0700`, change only that folder.
2. **`appdb` mountpoints** `packages` and `uploads`:
   - absent → create as `HOST_UID:HOST_GID`, `0700`;
   - present, an empty directory owned by root → change only that directory to `HOST_UID:HOST_GID`, `0700`;
   - present, an empty directory owned by `HOST_UID` → nothing;
   - present and not an empty directory, or a symbolic link → `mountpoint_unsafe`.
3. Never recursive. Never a file. Never follow a symbolic link.

Docker therefore finds both mountpoints present before the first app start, so a later start sees the same owner. A mountpoint that an older start made as root is fixed once, and only while it is empty.

Maintenance writers (backup, restore, import, recover, quarantine) start as root only for the same two volume-side steps. Then they switch to `HOST_UID:HOST_GID` (`setgid`, then `setuid`) before they read or write anything else. So no maintenance command leaves a root-owned entry.

## 5. Storage preflight

### Program and service

Program: `infra/scripts/sqlite-lock-probe.mjs`.

Command line: `node sqlite-lock-probe.mjs <mode> --run-id <16 hex> --project <name> --folder lti=<path> --folder app=<path> [--prepare]`. Modes:

| Mode | Use | Writes |
| --- | --- | --- |
| `report` | print the §6 state of both folders | nothing |
| `check` | with `--prepare`: §4 volume-side steps; then state table; then lock probe; then `FRESH` initialization (§6) | root folder and mountpoint owner/mode, probe scratch, identities |
| `mark-started` | set `firstStart: "completed"` in both identities after a healthy first start | identities |
| `selftest` | the three scenarios below, in one folder that must be empty | scratch only |

Compose service `storage-preflight`. This is the full definition; it does **not** use the `x-node-service` anchor:

| Field | Value |
| --- | --- |
| `image` | `node:24.22.0-alpine3.24` |
| `profiles` | `["storage"]` (a plain `up` never starts it) |
| `user` | `"0:0"` (§4 volume-side steps only; the program then drops to `HOST_UID:HOST_GID`) |
| `network_mode` | `none` |
| `restart` | `"no"` |
| `entrypoint` | `["node", "/probe/sqlite-lock-probe.mjs"]` |
| `command` | none in the file; each caller passes the mode and arguments |
| `environment` | `HOST_UID: ${HOST_UID}`, `HOST_GID: ${HOST_GID}` |
| `volumes` | `ltidb:/check/lti-service`, `appdb:/check/cogniate-app`, the program file read-only at `/probe/sqlite-lock-probe.mjs` (candidate: `./scripts/sqlite-lock-probe.mjs`; old builds: `../.tmp/storage-compat/sqlite-lock-probe.mjs`), `./.logs:/logs` |
| `labels` | `org.cogniate.storage: "preflight"` |
| not set | `depends_on`, `ports`, `networks`, `healthcheck`, `working_dir` |

### Steps of `check`

| Step | Rule |
| --- | --- |
| 1. Prepare | `--prepare`: the §4 volume-side steps, as root |
| 2. Privilege | switch to `HOST_UID:HOST_GID` |
| 3. Leftovers | delete every probe scratch file whose name matches `^\.lock-probe-[0-9a-f]{16}\.db(-wal\|-shm)?$` (the operation lock of §7 makes sure no other probe runs). No count limit. A failed delete → `scratch_cleanup_failed` with the path; nothing starts; fix the cause and run again. |
| 4. State | evaluate the §6 table; a refusal code stops here |
| 5. Live holder | a child process opens `.lock-probe-<runId>.db` in WAL mode, runs `BEGIN IMMEDIATE`, inserts one row, and writes `HELD` |
| 6. Negative oracle | the parent opens the same file with `busy_timeout = 0`. `BEGIN IMMEDIATE` must fail with the **extended** result code `5` (`SQLITE_BUSY`) exactly. Success → `lock_not_enforced`. `261` (`SQLITE_BUSY_RECOVERY`), `517` (`SQLITE_BUSY_SNAPSHOT`), `6` (`SQLITE_LOCKED`) or any other result → `probe_error`. Then the parent sends `PING`; the child must answer `PONG inTransaction=1`. |
| 7. Release-positive control | the parent sends `COMMIT`; the child commits, closes, writes `COMMITTED` and exits 0; the parent's `BEGIN IMMEDIATE` must succeed and a `SELECT` must return the child's row; the parent rolls back and closes |
| 8. Cleanup | delete the run's scratch `.db`, `-wal` and `-shm` in a `finally` block; a failed delete → `scratch_cleanup_failed` |
| 9. Initialization | state `FRESH` → write both identities (§6) |
| Bounds | each wait ≤ 10 s (`timeout`); the whole run ≤ 60 s |

### Output

One JSON line per folder on stdout, and the same lines appended to `infra/.logs/storage-preflight.jsonl`:

`{"event":"storage_preflight","runId":"<id>","mode":"check","project":"<name>","folder":"lti","path":"/check/lti-service","fsType":"ext4","state":"OK","result":"pass","reason":null,"waits":{"busyMs":0,"releaseMs":12}}`

A last line `{"event":"storage_preflight_summary","runId","mode","result":"pass"|"fail","reasons":[…]}`. Exit codes: `0` pass, `1` fail (any reason), `2` usage error. A non-lock error is never a pass. `stack:up` and `stack:restart` print these lines, so the evidence does not need container logs after `--rm`.

### Self-test (portable, controlled negative)

`selftest` runs in one empty folder:
- `normal` → must be `pass`;
- `no-hold` (the child opens the database but takes no lock) → must be `lock_not_enforced`;
- `holder-dies` (the child exits before `PING`) → must be `probe_error`.

It prints one line per scenario, `{"event":"storage_selftest","runId","scenario","expected","observed","ok"}`, and exits 0 only when all three are `ok`. It never touches a database folder of the product.

## 6. Start-state table (total and ordered)

Each volume holds `.storage-identity.json`:

```json
{ "formatVersion": 1, "composeProject": "<name>", "pairId": "<32 hex>", "role": "lti" | "app", "generation": 0,
  "createdAt": "<iso>", "firstStart": "pending" | "completed",
  "provenance": { "kind": "fresh" | "restore" | "import", "opId": "<32 hex>|null", "backupId": "<uuid>|null",
                  "manifestSha256": "<hex>|null", "restoredFromPairId": "<32 hex>|null", "restoredFromGeneration": <int>|null },
  "legacySources": [ { "name", "size", "sha256" } ] }
```

Every identity and journal write uses a `.tmp` file, then `fsync`, then `rename`, then `fsync` of the folder. Initialization writes the lti identity, then the app identity. Both have the same `pairId`, `generation 0`, `kind: fresh` and `firstStart: "pending"`.

**First start of the pair.** The pair is `completed` when any identity says `firstStart: "completed"`; else it is `pending`. (`mark-started` writes the lti identity, then the app identity, so a cut between the two writes is still `completed`.) `check` writes `completed` into an identity that still says `pending` when the pair is `completed` or when both databases are present (row 17).

The state of the pair is the **first** matching row:

| # | Code (refusal) or state (allowed) | Condition | Result and message |
| --- | --- | --- | --- |
| 1 | `rollback_failed` | any journal has state `rollback_failed` | refuse: "A restore could not roll back. Do not start. Keep both volumes. Use `npm run stack:data-quarantine -- --out <folder>` (§9)." |
| 2 | `journal_inconsistent` | the two journals (or one journal and an absent one) form a pair that no recovery row R0–R5 of §8 lists, for example an open app journal next to an lti journal of another `opId` | refuse; same message as row 1 |
| 3 | `journal_open` | any journal is not terminal (terminal = `committed` or `rolled_back`) | refuse: "A restore or import did not finish. Run `npm run stack:data-restore -- --recover`." |
| 4 | `unknown_entry` | a direct child that is not allowed (§3), or an allowed name of the wrong type | refuse, naming the entry |
| 5 | `mountpoint_unsafe` | §4 mountpoint rule (in `report`: a root-owned empty mountpoint is a pass, because `check` fixes it) | refuse |
| 6 | `owner_mismatch` | an allowed entry, other than the root folder and the mountpoints, is not `HOST_UID:HOST_GID` | refuse, naming the entry; nothing is changed |
| 7 | `identity_invalid` | an identity that does not parse or has the wrong `formatVersion` or `role` | refuse |
| 8 | `identity_project` | an identity with another `composeProject` | refuse |
| 9 | `identity_mismatch` | two identities that differ in `pairId` or `generation` | refuse |
| 10 | `FRESH_INIT_PARTIAL` (allowed) | exactly one identity; it is `kind: fresh`, `generation 0`, `firstStart: "pending"`; no database; no non-terminal journal | `check`: write the missing identity with the same `pairId`, then continue as `FIRST_START` |
| 11 | `identity_missing` | exactly one identity (any other case) | refuse |
| 12 | `db_without_identity` | a database exists and no identity | refuse |
| 13 | `FRESH` (allowed) | no database, no identity; no `.restore-*` or `.previous-*`; each journal is absent or `rolled_back` (any `opId`) | `check`: initialize the pair, then continue as `FIRST_START` |
| 14 | `FIRST_START` (allowed) | the pair is `pending`; zero or one database | continue: the services create the missing databases; after both services are healthy, `stack:up` runs `mark-started` |
| 15 | `half_pair` | the pair is `completed`; exactly one database | refuse: "One database of the pair is missing." |
| 16 | `no_databases` | the pair is `completed`; no database | refuse: "Both databases are missing." |
| 17 | `OK` (allowed) | both identities valid and equal; both databases present; journals absent or terminal | continue; `check` sets `firstStart: "completed"` in an identity that still says `pending` |
| 18 | `state_unclassified` | any state that no row above matches (for example no identity and no database, but a `committed` journal or a `.previous-*` folder) | refuse; same message as row 1 |

Rows 1–3 come first, so a lane in the middle of a restore always names the right command, also when an identity is missing or moved (`.previous-*`). Row 18 makes the table total: every state has exactly one result.

## 7. Guarded paths and the operation lock

**Operation lock.** One lock per project, at the host path `.tmp/storage-op.<project>.lock/` (made with `mkdir`, which is atomic). It holds `owner.json` with `{pid, command, runId, startedAt}`.
- Every guarded command of the table below takes the lock before its first Docker command, and keeps it until it ends.
- A second command waits up to 120 s, then refuses `operation_in_progress` and names the owner.
- A lock whose `pid` no longer runs on this host is stale. The next command removes it, logs `storage_lock_reclaimed`, and goes on.
- The helper `infra/scripts/storage-oplock.sh run -- <command>` lets QA and the operator serialize their own fixture and old-build steps with the same lock.

| Path | Guarded? | Rule |
| --- | --- | --- |
| `npm run stack:up` | **yes** | lock; §4 host-side steps; §10 legacy scan; `dc --profile storage run --rm storage-preflight check --prepare …` (a new container and a new `runId` each time); `dc up --wait`; on the first healthy start `mark-started` |
| `npm run stack:restart -- <svc>` | **yes** | lock; host-side steps; preflight. A failed preflight → exit 1 **before** `up --force-recreate`, so the running container keeps its container id and start time. Then the existing restart. |
| `test:acceptance`, `test:e2e`, `e2e:reset` | **yes** | they start the stack only through `stack-up.sh` |
| `stack:data-backup`, `-restore`, `-import`, `-quarantine`, `--recover` | **yes** | lock; both services positively stopped; §8 and §9 |
| `stack:storage-compat` (`enable`, `disable`, `preflight`, `status`) | **yes** | lock |
| old-build starts (§12) | **yes** | the harness or the operator runs the copied `storage-compat.sh preflight` before each harness-invoked or operator-invoked old start command, inside the lock |
| CLIs through `dc exec` (`seed`, `lti:bootstrap`, `lti:shared-platform`, `app:grant`, `app:binding`, `seed-portal`) | **indirectly** | They run inside a running container whose volume was checked when it started through a guarded path. They take no lock: they create no container and use working SQLite locks. |
| `docker compose up`, `start` or `restart` typed by hand | **no** | Outside the supported scripts. Stated limit. The design adds **no** `depends_on: service_completed_successfully` guard, although Compose accepted one in the Author's fixture (§17). Reasons: the preflight needs a mode, a fresh `runId` and the operation lock, which a compose dependency cannot give; every compose call would need `--profile storage`; and the old-build allowed differences (§12) forbid a `depends_on` change. |
| Docker restarts containers itself (`restart: unless-stopped`, for example after a VM boot) | **no** | Stated limit. dockerd restarts only containers that were running, so a lane stopped for maintenance stays stopped. |

**Running services.** The preflight of `stack:restart`, and of a second `stack:up` on a running stack, runs while services hold their databases open. This is safe:
- the probe opens only its own scratch files;
- the state checks only list names, read owners and read the identity and journal files;
- the root-folder and mountpoint changes happen only on the first start or after an older root-made mountpoint, and change no file that a service uses.

## 8. Backup and the journaled paired restore

### Backup

A backup is complete only when all of these hold:
1. Both services were positively stopped at the start **and** when the copy ends (re-checked; a change → exit 1, and the folder is marked incomplete by an `INCOMPLETE` file).
2. **Volume source:** the §6 state is `OK`, with no open journal; else refuse `backup_source_not_ok:<code>`. **Legacy source:** the §10 legacy set has no `-journal` and no other unknown entry (`legacy_hot_journal`, `legacy_unknown_entry`), and no old-layout container runs.
3. Every database and every present `-wal`/`-shm` file was copied byte-for-byte. The tool never opens a source database for writing and never runs a WAL checkpoint, so the copy is the stopped state as it is. The migration names are read from a scratch copy.
4. The copies were re-hashed.
5. `manifest.json` is written **last** (`.tmp`, `fsync`, `rename`).

There is no manifest before step 5, so a folder without a manifest is never a backup.

Manifest:
- `formatVersion 1` and the same file names (`lti-service/lti.db`, …);
- added fields `source` (`volume` or `legacy`), and for `volume` also `pairId`, `generation` and `legacySources` (copied from the identities);
- the SHA-256 values come only from the backup tool's own reads of the stopped files.

**Older manifests** without `source` were made by the earlier tool from the bind folders, so they count as `source: legacy` without `legacySources`. A manifest with `source: volume` but no `pairId` or `generation` → `manifest_incomplete`.

The volume source is read in one maintenance container that mounts both volumes **read-only** and the host output folder. The backup contains secrets (encrypted rows, hashes): it stays outside the checkout, at mode `0600`, with no `.env` and no private key.

### Restore and import: targets and pair rule

| Backup `source` | Target `OK` | Target `FRESH` |
| --- | --- | --- |
| `volume`, `pairId` equal to the target | restore; the new identity keeps the `pairId`, `generation` = target `generation` + 1, the target's `legacySources` are kept | — |
| `volume`, another `pairId` | refuse `pair_mismatch` (to restore another pair, quarantine first, §9) | restore; the new identity takes the backup's `pairId`, `generation` = backup `generation` + 1, `legacySources` from the backup |
| `legacy` (also an older manifest) | refuse `import_target_not_fresh` | `stack:data-import`: new `pairId`, `generation 1`, `kind: import`, `legacySources` from the manifest |

Before the swap, every restore and import runs a read-only content check on a scratch copy of the staged app database: every `package.storage_path` must exist as a directory under `infra/.data/cogniate-app/packages`, else `content_missing`, and nothing changes. This proves only that the referenced folders exist. It does not prove that their files are the same.

### Journal and states

One maintenance process restores or imports both volumes: both volumes read-write, the backup folder read-only, both services positively stopped, the operation lock held. Each volume holds `.storage-journal.json`: `{ formatVersion, operation: "restore" | "import", opId, backupId, manifestSha256, pairIdBefore, generationBefore, state, before: [{name, size, sha256}], after: [{name, size, sha256}], identityBefore, updatedAt }`. The two journals have the same `opId`.

**Write order.** Each state change is written to the lti journal first, then to the app journal. At commit, the order is: lti identity, app identity, lti journal, app journal.

| State | Meaning |
| --- | --- |
| (no journal) | Step 1 validates the whole backup (existing rules, plus the pair rule and `manifest_incomplete`). A failure → exit 1 "no target changed" (true: nothing was written). |
| `prepared` | the journal holds `before` (current files with SHA-256) and `identityBefore`; no target file changed |
| `staged` | every listed file is copied into `.restore-<opId>/`, `fsync`ed and verified; the content check passed; no target file changed |
| `swapping` | the swap of this volume began: files move one by one by `rename` — current files and identity into `.previous-<opId>/`, staged files into place |
| `swapped` | this volume's new files are in place; old files and old identity are in `.previous-<opId>/` |
| `committed` | both volumes verified in place against `after`, no unlisted sidecar in place; this volume's new identity is written |
| `rolling_back` | a rollback of this volume began |
| `rolled_back` | in place equals `before` (verified); the old identity is back (or, for an empty `before`, no identity); `.restore-<opId>/` and an empty `.previous-<opId>/` are removed |
| `rollback_failed` | a move or a verification failed during the rollback; every file and folder is kept |

`.previous-<opId>/` is kept until both journals are `committed`. After a commit, one previous generation is kept, and older `.previous-*` folders are removed. The new identities of a restore or an import have `firstStart: "completed"`, because both databases exist.

### Recovery table (total)

Recovery runs with `npm run stack:data-restore -- --recover`; the refusal of §6 names this command. It decides only from the observed journals and file locations. Every move first checks where the file is now (in place, in `.restore-<opId>/`, in `.previous-<opId>/`) by name and SHA-256 against `before` and `after`, so a repeated run gives the same result.

Here "X" is the open `opId`; the lti journal is written first, so lti is never behind app.

| # | Observed journals | Action | Exit and message |
| --- | --- | --- | --- |
| R0 | none, or both terminal | nothing | `0` "nothing to recover" |
| R1 | lti `prepared` X; app absent, or terminal with another `opId` | the first write was cut: staging starts only after both say `prepared`. Remove `.restore-X/` if present, verify lti in place = `before`, write lti `rolled_back` X; leave the app journal as it is. | `1` "cancelled at the first journal write; the targets equal the state before (verified)" |
| R2 | both X, each `prepared`, `staged` or `rolled_back`, and at least one not terminal (this includes an R2 that was cut between its two journal writes) | remove `.restore-X/` in both; verify both in place = `before`; both `rolled_back` | `1` "cancelled; the targets equal the state before (verified)" |
| R3 | both X, at least one `swapping`, `swapped` or `rolling_back`, and not the R4 pair | roll back **both**: write `rolling_back`; move every `before` file and the old identity from `.previous-X/` into place (or rebuild the old identity from `identityBefore`); move every `after` file that is in place back into `.restore-X/`; for an empty `before`, remove the new identities; verify in place = `before`; remove `.restore-X/` and an empty `.previous-X/`; both `rolled_back` | `1` "rolled back; the targets equal the state before (verified)" |
| R4 | lti `committed` X, app `swapped` X (identities written in any order) | re-verify both volumes against `after`. Both verify → write the missing app identity and app journal, both `committed`. One fails → R3. | `0` "commit completed", or as R3 |
| R5 | any `rollback_failed` | change **nothing** | `2` "the rollback did not finish; do not start; keep both volumes; use `stack:data-quarantine`" |
| R6 | any other pair (`journal_inconsistent`, §6 row 2) | change nothing | `2`, as R5 |

A rollback step that fails, or a verification after a rollback that fails, writes `rollback_failed` to every journal that it can write, keeps every file and folder, and exits `2`. Exit `1` is used only after a verification. Exit `2` never says "no target changed".

The same R3 routine runs at once inside a live restore when any step after `swapping` begins fails. Exit codes:
- `0`: committed, or nothing to recover;
- `1`: refused before any change, or cancelled or rolled back with a verified result;
- `2`: unresolved;
- `3`: stopped by `--stop-after`.

Terminal journals do not block a start (§6). So a lane recovers fully after R1–R4.

### Recovery drills

`--stop-after <point>` exits with code 3 right after the named point is durable. It skips no check, and leaves the same files that a crash at that point leaves. Each use logs `storage_drill_stop {opId, point}`. It is a drill option: it is accepted only when the environment has `STORAGE_DRILL=1`; else the command exits 1 before any change. `rollback-mid` also needs `STORAGE_DRILL_FAIL=after-swapped`, which makes the restore fail on purpose right after `swapped`.

| Point | State left |
| --- | --- |
| `prepared-lti` | lti `prepared`, app not yet written |
| `prepared` | both `prepared` |
| `staged` | both `staged` |
| `swap-lti-mid` | lti `swapping`; the lti database is in `.previous-X/`, and the staged lti database is not in place yet |
| `swapped-lti` | lti `swapped`, app `staged` |
| `swap-app-mid` | app `swapping`; the app database is in `.previous-X/`, and the staged app database is not in place yet |
| `swapped` | both `swapped` |
| `identity-lti` | the new lti identity is written |
| `identity-app` | both new identities are written |
| `committed-lti` | lti `committed`, app `swapped` |
| `rollback-mid` (with a forced failure after `swapped`) | lti `rolling_back`; the lti database is back, the lti sidecars are not |

Partial copies, a partial `.tmp` file and an `fsync` failure are unit tests through the library API.

The existing AC-M1-30 oracles stay true:
- a damaged backup stops in the "(no journal)" row, with no change;
- a valid restore puts the backed-up bytes in place;
- an unlisted target sidecar moves to `.previous-<opId>/`, so it is gone from its place.

## 9. Quarantine: the non-destructive exit

`npm run stack:data-quarantine -- --out <folder outside the checkout>` is the exit from `rollback_failed`, `journal_inconsistent` and any refusal that the operator cannot repair. It runs with both services positively stopped and the operation lock held:
1. Copy **every** entry of both volumes (databases, sidecars, identities, journals, `.restore-*`, `.previous-*`) into the folder, with a manifest of names, sizes and SHA-256, written last. Verify the copy.
2. Remove only the two volumes `<project>_ltidb` and `<project>_appdb`.

It does **not** touch the legacy bind files, the content folders, the Moodle volumes, any other project, or any backup. The lane is then `FRESH`. The operator restores a known backup into it (§8, FRESH target) or imports. Exit `0` when the copy verified and both volumes are gone; else `1`, and nothing is removed.

`stack:reset` is **never** a recovery step: it also deletes the content folders, the legacy files, `infra/.data/backups` and the Moodle volumes.

## 10. Legacy bind-folder data

The **legacy set** of a service is every entry of `infra/.data/<service>/` whose name is `<db>` or starts with `<db>-` (for example `-wal`, `-shm`, `-journal`). For the app, `packages/` and `uploads/` are content, not legacy.

`stack-up.sh` runs the legacy scan before the preflight, under the lock:
1. It refuses `old_layout_container` when any container with the label `com.docker.compose.project=<project>` has a mount whose destination is `/data` and whose source is the resolved host path `<checkout>/infra/.data/lti-service` or `<checkout>/infra/.data/cogniate-app`.
2. It reads the legacy sets at rest and computes size and SHA-256.
3. It reads the pair state with `report`.
4. It decides by the table below. Only after a "continue" does it run the preflight in `check` mode.

| Legacy sets | Pair state | Result |
| --- | --- | --- |
| both empty | allowed state (§6) | continue |
| any `-journal` or other `<db>-…` entry that is not `-wal` or `-shm` | any | refuse `legacy_hot_journal` or `legacy_unknown_entry`: a hot rollback journal is not supported; nothing changes |
| present | `FRESH` | refuse `legacy_present`: "Import the legacy databases explicitly (`stack:data-backup -- --source legacy`, then `stack:data-import`), or move them out of the checkout. No empty database was made." |
| present | `OK` or `FIRST_START`, with `legacySources` equal to the current legacy files (the same names, sizes and SHA-256; nothing added, removed or changed) | continue, with the warning "legacy files are kept for reference and are not used" |
| present | any other allowed state, or a difference to `legacySources` | refuse `legacy_conflict`: "Legacy and volume databases both exist and are not the same import. Move the legacy files out, or import into a quarantined lane." |
| any | a refusal code of §6 | that refusal |

`legacySources` survive a restore that keeps the `pairId` (§8). So a backup and restore cycle on an imported lane does not create a `legacy_conflict`.

## 11. QA fixture access (test interface, not an overlay)

QA reads and writes the volumes only through its own fixture container. The rules:

| Item | Rule |
| --- | --- |
| Image | `node:24.22.0-alpine3.24`, pinned by the image id that QA records at the start of the run |
| Container | `docker run --rm --network none --label org.cogniate.qa=storage-fixture --label org.cogniate.lane=<project>`; removed after use; QA checks that none remains |
| Mounts | only `<project>_ltidb` and `<project>_appdb`, and QA's own script and output folder |
| Read mode | volumes read-only, user `HOST_UID:HOST_GID`; allowed at any time |
| Write mode | volumes read-write, user `HOST_UID:HOST_GID`, only while both services are positively stopped and QA holds the operation lock. Root only for the owner changes of `d-owner` and `d-mountpoint`. One exception while services run: the single empty planted entry of `a-restart-refusal`, in the `ltidb` root only, removed by QA after that row |
| Lock oracle | may run while services run, only inside `.qa-scratch-<16 hex>/`; QA removes it, and a preflight afterwards must pass |
| Independence | QA's own script parses identities and journals and hashes files. It never uses the product maintenance code as its oracle. The product commands are what QA tests. |
| Existing fixtures | the T5b P5 fixture keeps its approved app-stop guard and its assertions; only its database access moves into this container. `tests/host/m1-migration.mjs` and `m1-migration.selftest.mjs` read and write volume copies the same way. |

## 12. Old-build storage compatibility (bounded exception)

Scope: **only** `b0b83a8289e1bf9cf349068aca184f0879e9aaf0` (released v10; AC-M1-23/30, AC-M1-41 `e-old-schema`) and `9f96f7b24cd0aed702e4dc40373bdda4307aad31` (populated `011`; AC-M1-38 h1–h5). Every design and implementation review must accept it.

### Files and injection

- Committed in the candidate tree (backend Author):
  - `infra/compat/storage-compat.knobs.json` (the override);
  - `infra/scripts/sqlite-lock-probe.mjs`;
  - `infra/scripts/storage-compat.sh`;
  - `infra/compat/storage-compat.sha256` (the SHA-256 of the three files).
- The override is JSON with the top-level marker key `"x-cogniate-storage-compat": {"formatVersion": 1, "revisions": ["b0b83a8289e1bf9cf349068aca184f0879e9aaf0", "9f96f7b24cd0aed702e4dc40373bdda4307aad31"]}`.
- `npm run stack:storage-compat -- enable` (candidate tree):
  1. refuses when `.tmp/compose.knobs.yaml` already exists ("test knobs are active: restore the defaults first"); it never merges;
  2. creates the host content folders (§4);
  3. copies the override to `.tmp/compose.knobs.yaml`, and copies the probe and `storage-compat.sh` to `.tmp/storage-compat/`;
  4. checks all hashes.
- The old builds' `dc()` adds `-f .tmp/compose.knobs.yaml` to every compose call. `.tmp/` is git-ignored and survives `git checkout --force`.
- After the old SHA is checked out, the copied `bash .tmp/storage-compat/storage-compat.sh <preflight|status|disable>` runs without the candidate tree. `disable` removes the two copies.

### Exact tree rule

During an old step:
- every tracked path **outside** `tests/` equals the old SHA, and no untracked file exists outside git-ignored paths and `tests/`;
- `tests/` equals the frozen candidate test tree (by tree hash).

This is the existing harness contract: old product tree, new tests. The harness records both tree hashes. No other product path may differ.

### Allowed effective-config changes

The harness computes the effective config through the old `dc()` itself, with the saved stack profile environment from the old `lib.sh`:
- C1 = the old `dc()` arguments, with `--profile storage` plus every profile that the step uses (`acceptance`, `test`), then `config --format json`;
- C0 = the same arguments without `-f .tmp/compose.knobs.yaml`.

After normalization (sorted keys; each `volumes` list compared as a set keyed by `target`), `C1 − C0` may contain **only**:
- (a) in `services.lti-service.volumes`, the entry with target `/data` changes from `bind` `<checkout>/infra/.data/lti-service` to `volume` `ltidb`;
- (b) in `services.cogniate-app.volumes`, the `/data` entry changes from `bind` `<checkout>/infra/.data/cogniate-app` to `volume` `appdb`, and two new `bind` entries appear: `<checkout>/infra/.data/cogniate-app/packages` → `/data/packages` and `…/uploads` → `/data/uploads`;
- (c) top-level `volumes` adds `ltidb` and `appdb`;
- (d) the service `storage-preflight` of §5, with exactly the fields of that table (old-build program path);
- (e) the top-level `x-cogniate-storage-compat` key.

Any other difference (environment, image, command, ports, networks, `depends_on`, labels, other services) → `BLOCKED`.

### Command rule

Principle:
- **Allowed:** an old command that does not create, recreate, start or restart a service container and does not delete or rewrite `.tmp/compose.knobs.yaml`.
- **Forbidden:** a command that does one of these things. The only exceptions are old `npm run stack:up` and old `npm run test:acceptance`, which start services through the old `dc()` (so with the override), each inside the checks below.

| Allowed | Forbidden while the override is enabled |
| --- | --- |
| `git checkout` of the two SHAs, the frozen test install, old `npm ci`, `npm run build`, `npm run gen-env` (it keeps an existing `.env`), `docker compose … config`, the harness's `docker compose … exec` and `stop` | old `npm run stack:restart`, `stack:reset`, `e2e:reset`, `test:e2e`, `demo`, `demo:prepare`, `demo:users`, `demo:browser`; any `docker compose up`, `create`, `run`, `start` or `restart` of a service without the knobs file |
| through the old `dc()`: old `npm run stack:up` and old `npm run test:acceptance` (they start services), old `npm run seed` (it uses `exec` only), old `npm run stack:down` (it keeps the volumes and the knobs file); the copied `storage-compat.sh preflight` and `status` | the candidate commands of the guard below |

Preflight and mount checks:
- One preflight runs before each **harness-invoked** (or operator-invoked) old command that can start a service.
- The mount check runs after it: `storage-compat.sh status` reads `docker inspect` of the running `lti-service` and `cogniate-app`. `/data` must be the volume `<project>_ltidb` / `<project>_appdb`; the app must have the two nested binds; no bind may sit at `/data`; and the knobs file hash must still equal its frozen value. Else exit 1 → `BLOCKED` (QA) or "stop now" (operator).
- Old `test:acceptance` calls `stack-up.sh` twice inside one command. The preflight before the command and the mount check after it cover those internal starts. They use the same knobs file and the same volumes, so the storage cannot change between them. The harness holds the operation lock for the whole command.

**Candidate guard.** Every candidate command that can create, recreate or start a container, or that reads or writes the databases, refuses while `.tmp/compose.knobs.yaml` holds the `x-cogniate-storage-compat` key ("run `npm run stack:storage-compat -- disable`"). These commands are `stack:up`, `stack:restart`, `test:*`, `e2e:reset`, `demo*` and `stack:data-*`. `seed` runs `exec` only and is not affected.

### Routes and evidence

- Upgrade order:
  1. stop both services (old build);
  2. `git checkout <candidate>` with both services stopped;
  3. `npm run stack:storage-compat -- disable`;
  4. `stack:data-backup`;
  5. `stack:up`.
- Rollback order:
  1. stop both services;
  2. `stack:data-restore` into the volumes;
  3. `stack:storage-compat -- enable`;
  4. `git checkout <old>`;
  5. `bash .tmp/storage-compat/storage-compat.sh preflight`;
  6. old `npm run stack:up`;
  7. `storage-compat.sh status`.
- Old and new builds use the same volumes, so the two QA routes need no import step.
- **Evidence qualifier:** every old-build row keeps its label (`MOODLE-LIVE` or `SIM`) and adds: "old build `<sha>`: tracked product tree equal to that SHA, frozen candidate tests (`tests/` tree `<hash>`), and the storage-compatibility override (`compose.knobs.yaml` SHA-256 `<h1>`, probe `<h2>`, runner `<h3>`), which changes only the effective-config items (a)–(e) of ADR-012 §12". It never says "unchanged old infrastructure".
- The old `warn_knobs` caution line is expected and recorded. `/healthz` shows `"knobs":[]`, because the override sets no environment.

## 13. Acceptance rows (AC-M1-41)

Every row has the id `M1-41.common.<id>` and is individually mandatory in **each** full round. The phase `storage` is a new host phase. It runs in its own fresh clone with its own lane (project name), after the `migration` phase of the same round, because `e-old-schema` uses the v10 databases of that round's AC-M1-23 backup.

| Group | Ids | Phase | Count |
| --- | --- | --- | --- |
| a. start paths | `a-fresh`, `a-second-start`, `a-restart`, `a-restart-refusal`, `a-serialize`, `a-first-start-resume` | storage | 6 |
| b. lock and write safety | `b-oracle-lti`, `b-oracle-app`, `b-sequence` | storage | 3 |
| c. negatives | `c-selftest`, `c-host-negative` (conditional, §14) | storage | 2 |
| d. hygiene and ownership | `d-clean`, `d-stale`, `d-unknown`, `d-symlink`, `d-owner`, `d-mountpoint`, `d-content-folder` | storage | 7 |
| e. legacy and import | `e-fresh-refusal`, `e-import`, `e-kept`, `e-changed-byte`, `e-added-wal`, `e-not-same-import`, `e-import-nonfresh`, `e-content-missing`, `e-old-layout`, `e-hot-journal`, `e-old-schema`, `e-import-recover`, `e-provenance-restore` | storage | 13 |
| f. identity | `f-pairid`, `f-identity-missing`, `f-db-without-identity`, `f-project`, `f-half-pair`, `f-originals-back` | storage | 6 |
| g. restore recovery | `g-prepared-lti`, `g-prepared`, `g-staged`, `g-swap-lti-mid`, `g-swapped-lti`, `g-swap-app-mid`, `g-swapped`, `g-identity-lti`, `g-identity-app`, `g-committed-lti`, `g-rollback-mid`, `g-recover-idempotent`, `g-tamper`, `g-quarantine`, `g-damaged`, `g-fresh-target` | storage | 16 |
| h. backup and pair rule | `h-nomanifest`, `h-volume-manifest`, `h-legacy-manifest`, `h-open-journal`, `h-pair-mismatch`, `h-old-manifest` | storage | 6 |
| i. product guards | `i-enable-refusal`, `i-candidate-guard` | storage | 2 |
| j. old-route qualification | `j-migration` (phase `migration`), `j-snapshot` (phase `snapshot-upgrade`) | as named | 2 |

Total new rows: **63** per round. The existing **416** rows stay unchanged, with the same ids, phases and labels. So each full round has **479** mandatory rows. The phases are: `sim` 394, `snapshot-isolated` 6, `snapshot-upgrade` 6, `migration` 12, `storage` 61.

QA's own hashes decide every "equal" and "unchanged" oracle. `b-sequence` shows that the volumes work; the cause claim rests on the lock-level rows `b-oracle-*` and `c-host-negative` and on the diagnostics of §1, not on `b-sequence`. Recovery drills use a backup that differs from the in-place pair in **both** databases (a write after the backup), and they check the identities' `generation` and `provenance`. They do not require differences in sidecars, which can be legitimately absent or the same.

Harness self-checks are recorded in a separate harness section of the run, **not** as product rows:
- a one-byte change of the override, the probe or the runner → the harness reports `BLOCKED`;
- an override copy with one added environment key → the config check reports a not-allowed difference.

## 14. The single conditional row

`M1-41.common.c-host-negative` is the **only** row that can be `NOT_APPLICABLE`.
- QA first runs its own lock oracle on a scratch bind folder under `.tmp/` of the storage clone. Then it runs the probe on the **same** folder in the same round, in QA's fixture container (§11).
- Where QA's oracle shows the demonstrated fault (WAL lock not enforced), the probe must report `lock_not_enforced` and exit 1, and the row is PASS.
- Where QA's oracle shows enforcement, the row is `NOT_APPLICABLE`, with the oracle evidence attached.
- `NOT_APPLICABLE` is reported separately and is **never** counted as a PASS. A round is complete only when every other row is PASS and this row is PASS or `NOT_APPLICABLE` with evidence.
- No other row, and no original M1 row, can be `NOT_APPLICABLE`.
- `c-selftest` is the portable negative and must PASS on every host.

## 15. Lane ownership and cleanup

The databases belong to the **compose project name**, not to the checkout.
- A new clone that reuses an existing project name finds that project's volumes, and its identity check passes. But `gen-env` gives the new clone new master keys, so the services cannot use the old encrypted rows.
- Rule: a fresh QA lane must show no `<lane>_ltidb` and no `<lane>_appdb` before its first start (QA's boundary check with the label `com.docker.compose.project=<lane>`), and none after its cleanup.

Cleanup semantics:
- `stack:reset` (`down -v` with the project guard) removes both volumes, the legacy bind folders and the content folders of this project.
- `stack:down` keeps the volumes.
- `docker volume prune` without `--all` removes only unused **anonymous** volumes.
- `docker volume prune --all` removes every unused named volume, so these databases and the Moodle volumes too.
- `docker system prune --volumes` prunes anonymous volumes only (Docker CLI reference), so it does not remove these named volumes.
- Docker Desktop's clean or purge of all data removes every volume.

## 16. Ownership and interfaces

| Owner | Files |
| --- | --- |
| Backend Author (owns `infra/**`) | `infra/compose.yaml` (volumes, nested binds, `storage-preflight`, a `maintenance` service); `infra/scripts/sqlite-lock-probe.mjs` (new) and its unit test; `infra/scripts/storage-oplock.sh` (new); `infra/scripts/stack-up.sh`, `stack-restart.sh`, `qa-suite.sh` and `e2e-reset.sh` (guard only); `infra/scripts/stack-data.sh`, `stack-data.mjs`, `lib.sh` (container execution, `--source legacy`, `stack:data-import`, `stack:data-quarantine`, the journal, `--recover`, `--stop-after`); `infra/compat/*`, `infra/scripts/storage-compat.sh`; root `package.json` scripts; `infra/README.md`; `services/lti-service/src/cli/stack-data.test.ts` (new cases; existing assertions unchanged) |
| Product code | none |
| Independent common QA (Claude) | `tests/host/m1-migration.mjs`, `tests/host/m1-migration.selftest.mjs`, `tests/host/p5-fixture.mjs` (database access through §11; guards and assertions unchanged); `tests/host/run-t1.mjs` (the information-only `**/.data` scan no longer sees database bytes; note it); the QA fixture script under `tests/host/`; the 63 AC-M1-41 rows and their accounting |
| Architect | this ADR, ADR-006, `local-stack.md`, ADR-011 §14, M1, M3, the indexes, `review-response-storage.md` |
| Docs (M4) | operator guide: import, backup, restore, recovery, quarantine, rollback mode with the override, cleanup semantics |

## 17. Measured feasibility facts and assumptions for the build step

**Measured feasibility facts.** Source: the Author diagnostic `/Users/quangnguyen/cogniate-author-diag/storage-feasibility-20261020T2119Z/public/AUTHOR-DIAGNOSTIC-storage-feasibility.md`, SHA-256 `32a07797786eac79ada89a07c472735f7fffb87cd13da7afc00ff6ccb18226ba` (task `task_b5db7037a739`). It used synthetic files on one host only: macOS, Docker Desktop engine 29.9.1, Compose 5.6.0. These are feasibility facts. They are not candidate acceptance and not a guarantee for other platforms.

| # | Fact on the measured host | Design use |
| --- | --- | --- |
| M1 | A new empty named volume at `/data` (the image has no `/data`) is `root:root 0755`. The service user cannot write in it. | §4 volume-root step |
| M2 | For nested binds, Docker creates the covered mountpoint folders inside the volume as `root:root 0755`, empty, at container creation. Host-source owner and mountpoint owner are different. | §4 mountpoint rule (fix an empty root-owned mountpoint) |
| M3 | A narrow root step (the volume root and the two mountpoints, `501:20 0700`, not recursive) works. A later volume-only container and the next start with binds keep `501:20 0700`. The bare mountpoints stay empty. | §4, §5 step 1 |
| M4 | As the service user in the volume: a `0600` file, a file `fsync`, a rename in one folder, a rename over a file, a rename into another folder of the same volume, and a folder `fsync` all work. A rename from the volume into the `uploads` bind fails with `EXDEV`. | §6 and §8 write order; §3 rename rule |
| M5 | A Compose override with a volume at the same target **replaces** the base `/data` bind (merge by target) and adds the two nested binds. | §12 items (a) and (b) |
| M6 | A profiled service is absent unless its profile is enabled. `run --rm --no-deps` of a one-shot service works with `-p` and absolute `-f` files. Compose resolves a relative `-f` path against the current folder, not against `--project-directory`. | §5 service, §12 C0/C1 |
| M7 | `config --format json` gave the same hash in two runs of one fixture. | §12 C0/C1 |
| M8 | `up --wait` accepted a `service_completed_successfully` dependency in the fixture. | not used (§7) |

**Assumptions still to verify in the build step (not claimed):**
1. M1–M7 also hold for the candidate and the old product Compose files, with the project's `--env-file` and the old `dc()` arguments (not measured).
2. The old `dc()` gives `-f .tmp/compose.knobs.yaml` in a form that Compose resolves to the checkout's `.tmp/` (M6: a relative `-f` path resolves against the current folder).
3. The named volume enforces the SQLite WAL lock with the product's `node:sqlite` (shown by QA's earlier diagnostic; not part of the feasibility diagnostic). The probe checks this at every guarded start.
4. `node:sqlite` reports the extended result code in its error (`errcode`), so 5, 261 and 517 can be told apart.
5. `mkdir` on the host is atomic for the operation lock, and `kill -0 <pid>` detects a dead owner.
6. `docker inspect` shows the mount type, source and destination needed by `status`.
7. On Linux hosts, the bind-source owner rules and real UIDs give the same result as M2–M3 (not measured).

## 18. Consequences

- Concurrent CLI and service access is safe wherever the preflight passes. Wherever it fails, the stack refuses to start, with an exact reason.
- Database files are no longer plain files in the checkout. Read them only through the maintenance or QA fixture container.
- Existing bind installations need one explicit import. Old builds need the override, with its caution line, and a temporary rollback mode with forbidden commands.
- A lane that cannot recover has a non-destructive quarantine exit.
- The released-v10 and `011` evidence rows carry the §12 qualifier.
