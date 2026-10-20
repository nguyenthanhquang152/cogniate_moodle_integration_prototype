# ADR-012: SQLite state on project-scoped named volumes, with a lock prerequisite

Status: Proposed, **revision 3.1** (revision 3 with the bounded Round 3 corrections; design for independent check; not accepted). Date: 2026-10-21. Owner: Architect. Amends [ADR-006](ADR-006-storage.md) (storage location) and [ADR-011 §14](ADR-011-multi-lms.md#14-compatibility-migration-upgrade-and-rollback) (maintenance commands).

Revision history:
- Revision 1 was frozen at `6a5eb6a` and reviewed in `docs/reviews/M0/storage-reviewer-a.md`, `storage-reviewer-b.md` and `storage-qa.md` (committed at `2bb918f`).
- Revision 2 answers every finding. The ID-by-ID response is [review-response-storage](../review-response-storage.md).
- Revision 2 was frozen at `7a63744` and rechecked in Round 2 of the same three reports (committed at `584ab9e`).
- Revision 3 answers the Round 2 findings (response: Round 3 section of [review-response-storage](../review-response-storage.md)).
- Revision 3 was frozen at `b3bd22e` and rechecked in Round 3 (committed at `7f2c2c5`). Revision 3.1 makes only the bounded corrections that the Lead's Round 3 escalation lists (response: "Round 3 bounded corrections" in [review-response-storage](../review-response-storage.md)). It is not a new general design round.
- The same three reviewers check their exact findings against revision 3.1; this text does not close any finding.

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
| DS2 | A storage preflight prepares the volume roots without recursion, checks a real WAL lock exclusion with a live holder and a positive release, and evaluates one total, ordered start-state table. It runs in a fresh one-shot container on every **guarded** path of §7, under one operation lock per checkout and project. The lock stays held while a storage container of the project still runs. |
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

Volume side (the preflight, as root, before it drops privilege; §5 step 3):
1. **Volume root folder:** if its owner is not `HOST_UID:HOST_GID` or its mode is not `0700`, change only that folder.
2. **`appdb` mountpoints** `packages` and `uploads`:
   - absent → create as `HOST_UID:HOST_GID`, `0700`;
   - present, an empty directory owned by root → change only that directory to `HOST_UID:HOST_GID`, `0700`;
   - present, an empty directory owned by `HOST_UID` → nothing;
   - present and not an empty directory, or a symbolic link → `mountpoint_unsafe`.
3. Never recursive. Never a file. Never follow a symbolic link.

Docker therefore finds both mountpoints present before the first app start, so a later start sees the same owner. A mountpoint that an older start made as root is fixed once, and only while it is empty.

Maintenance writers (backup, restore, import, recover, quarantine) start as root only for the same two volume-side steps. Then they switch to `HOST_UID:HOST_GID` (`setgid`, then `setuid`) before they read or write anything else. So no maintenance command leaves a root-owned entry.

**Privilege rule (every storage program, every mode).** As root, a program may only read and do the §4 volume-side steps. It writes no other file, no identity, no journal and no log line as root. A root-step failure is kept in memory; the program drops privilege, then writes its output and log lines, then exits 1. Modes that do no §4 step (`report`, `mark-started`, `probe`, `selftest`) drop privilege at once. A program that starts as `HOST_UID` (for example in a QA fixture container) runs unchanged.

## 5. Storage preflight

### Program and service

Program: `infra/scripts/sqlite-lock-probe.mjs`.

Command lines:
- `node sqlite-lock-probe.mjs <report|check|mark-started> --run-id <16 hex> --project <name> --folder lti=<path> --folder app=<path> [--prepare]` (`--prepare` only with `check`);
- `node sqlite-lock-probe.mjs probe --run-id <16 hex> --folder <name>=<path> [--folder …]`;
- `node sqlite-lock-probe.mjs selftest --run-id <16 hex> --folder self=<path>`.

| Mode | Use | Writes |
| --- | --- | --- |
| `report` | print the §6 state of both folders | nothing |
| `check` | the steps below: journal gate, preparation, state table, lock probe, initialization | root folder and mountpoint owner/mode, probe scratch, identities |
| `mark-started` | set `firstStart: "completed"` in both identities after a healthy first start | identities |
| `probe` | only the lock probe (steps 7–10 below) on each named folder; no state table, no preparation, no identity | probe scratch only |
| `selftest` | the three scenarios below, in one empty folder on a filesystem that enforces locks | scratch only |

Compose service `storage-preflight`. This is the full definition; it does **not** use the `x-node-service` anchor:

| Field | Value |
| --- | --- |
| `image` | `node:24.22.0-alpine3.24` |
| `profiles` | `["storage"]` (a plain `up` never starts it) |
| `user` | `"0:0"` (for the §4 volume-side steps only; the privilege rule of §4 applies) |
| `network_mode` | `none` |
| `restart` | `"no"` |
| `entrypoint` | `["node", "/probe/sqlite-lock-probe.mjs"]` |
| `command` | none in the file; each caller passes the mode and arguments |
| `environment` | `HOST_UID: ${HOST_UID}`, `HOST_GID: ${HOST_GID}` |
| `volumes` | `ltidb:/check/lti-service`, `appdb:/check/cogniate-app`, the program file read-only at `/probe/sqlite-lock-probe.mjs` (candidate: `./scripts/sqlite-lock-probe.mjs`; old builds: `../.tmp/storage-compat/sqlite-lock-probe.mjs`), `./.logs:/logs` |
| `labels` | `org.cogniate.storage: "preflight"` |
| not set | `depends_on`, `ports`, `networks`, `healthcheck`, `working_dir` |

Every caller runs it as `dc --profile storage run --rm --name <project>-storage-<runId> --label org.cogniate.storage.run=<runId> storage-preflight <mode> …` (§7 storage containers).

### Steps of `check`

| Step | Rule |
| --- | --- |
| 1. Read | as root, read only: list both volume roots with `lstat`; read the journals and identities |
| 2. Journal gate | §6 rows 1–3 match → refuse with that code. Nothing changes: no preparation, no cleanup, no initialization. |
| 3. Prepare | `--prepare`: the §4 volume-side steps. An unsafe mountpoint is recorded, not changed; step 6 refuses it as row 5. |
| 4. Privilege | switch to `HOST_UID:HOST_GID` (§4 privilege rule) |
| 5. Leftovers | delete every probe scratch file whose name matches `^\.lock-probe-[0-9a-f]{16}\.db(-wal\|-shm)?$`, and the identity and journal `.tmp` files (no journal is open, by step 2). The operation lock of §7 makes sure that no other storage program runs. No count limit. A failed delete → `scratch_cleanup_failed` with the path; nothing starts; fix the cause and run again. |
| 6. State | evaluate §6 rows 4–18; a refusal code stops here |
| 7. Live holder | a child process opens `.lock-probe-<runId>.db` in WAL mode, runs `BEGIN IMMEDIATE`, inserts one row, and writes `HELD` |
| 8. Negative oracle | the parent opens the same file with `busy_timeout = 0`. `BEGIN IMMEDIATE` must fail with the **extended** result code `5` (`SQLITE_BUSY`) exactly. Success → `lock_not_enforced`. `261` (`SQLITE_BUSY_RECOVERY`), `517` (`SQLITE_BUSY_SNAPSHOT`), `6` (`SQLITE_LOCKED`) or any other result → `probe_error`. Then the parent sends `PING`; the child must answer `PONG inTransaction=1`. |
| 9. Release-positive control | the parent sends `COMMIT`; the child commits, closes, writes `COMMITTED` and exits 0; the parent's `BEGIN IMMEDIATE` must succeed and a `SELECT` must return the child's row; the parent rolls back and closes |
| 10. Cleanup | delete the run's scratch `.db`, `-wal` and `-shm` in a `finally` block; a failed delete → `scratch_cleanup_failed` |
| 11. Initialization | `FRESH` → write both identities; `FRESH_INIT_PARTIAL` → write the missing identity; `OK` with a `pending` identity → write `completed` (§6) |
| Bounds | each wait ≤ 10 s (`timeout`); the whole run ≤ 60 s |

### Output

One JSON line per folder on stdout, and the same lines appended to `infra/.logs/storage-preflight.jsonl` (after the privilege drop):

`{"event":"storage_preflight","ts":"<iso>","runId":"<id>","mode":"check","project":"<name>","folder":"lti","path":"/check/lti-service","fsType":"ext4","state":"OK","result":"pass","reason":null,"waits":{"busyMs":0,"releaseMs":12}}`

A last line `{"event":"storage_preflight_summary","ts","runId","mode","result":"pass"|"fail","reasons":[…]}`. Exit codes: `0` pass, `1` fail (any reason), `2` usage error. A non-lock error is never a pass. `stack:up` and `stack:restart` print these lines, so the evidence does not need container logs after `--rm`.

### Self-test (portable, controlled negative)

`selftest` runs in one empty folder. The folder must be on a filesystem that enforces locks; QA uses a new folder in the fixture container's own writable layer, never a bind mount (§11).
- `normal` → must be `pass`;
- `no-hold` (the child opens the database but takes no lock) → must be `lock_not_enforced`;
- `holder-dies` (the child exits before `PING`) → must be `probe_error`.

It prints one line per scenario, `{"event":"storage_selftest","ts","runId","scenario","expected","observed","ok"}`, and exits 0 only when all three are `ok`. It never touches a database folder of the product.

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

### Storage containers

A **storage container of project P** is a container with the label `com.docker.compose.project=P` and the label `org.cogniate.storage` (value `preflight` or `maintenance`). Every guarded command creates its storage containers with `dc --profile storage run --rm --name P-storage-<runId> --label org.cogniate.storage.run=<runId> <service> …`, so each one names its run.
- **Active:** Docker state `running`, `paused`, `restarting` or `removing`. An active storage container can still write the volumes. Its client process can be gone: a client killed with `SIGKILL` does not stop the container (§17 assumption).
- **Inactive:** state `created`, `exited` or `dead`. It has no running process, so it cannot write.

### Lock records

All lock records are folders in `.tmp/` of the checkout, each with an `owner.json` record:

| Folder | Meaning |
| --- | --- |
| `storage-op.<P>.lock/` | the lock; present = held |
| `storage-op.<P>.cand-<runId>/` | a candidate record of a command that is installing the lock |
| `storage-op.<P>.stale-<runId>/` | a reclaimed lock record, kept as evidence (§7 takeover); no storage command deletes it |
| `storage-op.<P>.rel-<runId>/` | a released lock that its owner is deleting |

`owner.json`: `{ formatVersion: 1, project, checkout (absolute path), command, runId, pid, pidStart, pgid, acquiredAt, containers: [names] }`.
- `pid` is the process of the guarded command (or of the wrapper of §12, or of `storage-oplock.sh run`).
- `pidStart` is the start time of that process as `LC_ALL=C ps -o lstart= -p <pid>` prints it. `pgid` is its process group, from `LC_ALL=C ps -o pgid= -p <pid>`.
- **Locale.** Every `ps` call of the lock, for writing and for comparing, runs with `LC_ALL=C`, whatever the caller's locale is. (Scratch probe on the measured host, §17 P3: `lstart` printed `Wed Oct 21 …` under `C` and `mer. 21 oct. …` under `fr_FR.UTF-8`.)
- The **owner identity** is the pair (`pid`, `pidStart`). It is live only when `LC_ALL=C ps -o lstart= -p <pid>` prints exactly `pidStart`. So a reused pid, or a pid after a host reboot, is not live.
- A **record is live** when its owner identity is live, **or** when any process other than the checking process has the record's `pgid` (`LC_ALL=C ps -ax -o pid=,pgid=`, read once and matched in the helper's own code). The group part covers a Docker client that survives a kill of only its parent script (A-S-12): the client is still in the group, so the record stays live, also before the client has created its container.
- Each record is written to `owner.json.tmp`, then `fsync`, then `rename`. A lock folder appears only by the `rename` of a complete candidate folder, so a lock never has an incomplete record.
- The holder adds each storage container name to `containers` before it creates that container. This is evidence for messages; safety does not depend on it.

### Acquisition (every guarded command, before its first Docker command)

| Step | Rule |
| --- | --- |
| A1 | Write `cand-<runId>/owner.json` for this command. |
| A2 | `rename(cand-<runId>, lock)`. It succeeds only when no lock exists, because a held lock folder is never empty. Success → A6. Failure because the lock exists → A3. |
| A3 | Read the lock record `K`. A lock folder without a valid record for 10 s → refuse `operation_lock_invalid`, naming the folder (manual exit: the M4 guide; only when no storage command of this checkout runs). |
| A4 | `COGNIATE_STORAGE_LOCK_RUN` in this process equals `K.runId` → refuse `operation_lock_reentry` at once. Else, the record `K` is live → wait, poll each 1 s, for up to 120 s; then refuse `operation_in_progress`, naming `K.command`, `K.runId`, `K.pid` and `K.acquiredAt`. When the lock goes, → A2. |
| A5 | The record `K` is not live (a **stale** record: owner identity ended and group empty). If any **active** storage container of P exists → refuse `storage_writer_active`, naming its name, id, state and `org.cogniate.storage.run` label. Nothing moves. Else read the lock record again: not `K` → A2. Still `K` → `rename(lock, stale-<K.runId>)`. Success → log `storage_lock_reclaimed`, then A2. Failure (the lock is gone, or `stale-<K.runId>` exists because another command reclaimed `K` first) → A2. |
| A6 | This command holds the lock. Before its first Docker write it checks the storage containers of P again: an **active** one → refuse `storage_writer_active` and release; an **inactive** one → remove it by id (`docker rm <id>`, never `-f`, never `-v`) and log `storage_container_removed`. Then it deletes each `cand-*` and `rel-*` folder whose record is not live (`storage_lock_cleanup`). It exports `COGNIATE_STORAGE_LOCK_RUN=<runId>` to its children. |

Why a takeover never removes a current owner:
- A stale record has an ended owner identity, and an ended identity cannot come back. So the owner of `K` can never release it again. (A reused group id can make a stale record look live again; that only makes other commands wait: fail-closed.)
- The second read in A5 happens after the liveness test. So if it still shows `K`, only a takeover can move it.
- A takeover moves `K` only to the name `stale-<K.runId>`. That folder is never empty and never deleted, so a second `rename` to the same name fails. It cannot move a newer lock.
- An orphaned writer blocks the takeover (A5) and every new holder (A6). No new writer starts while an old storage container is active.

### Process ownership (A-S-12)

| Rule | Detail |
| --- | --- |
| Docker clients stay in the group | A guarded command starts every Docker client (`dc run`, `dc up`, `docker rm`, …) as a foreground child, or as a plain background job that it waits for. A child that is not put in a new group stays in the command's group. The scripts use no `setsid`, `disown` or `set -m` for a Docker client. |
| Long-lived helpers leave the group | The only long-lived background process that a guarded command starts is the Build Runner (`stack-up.sh` → `start_build_runner` in `lib.sh`, today `nohup … &`; source fact S6). It is started in its own process group (`set -m` for that one job). So it never keeps a lock record live after `stack:up` ends. (Scratch probe P5: a `( set -m; nohup … & )` job got its own group; a plain `&` job did not.) |
| The caller gives the group | The design does **not** claim that every `npm` or script call has its own group. An interactive shell gives each command line its own job group. QA's harness starts each guarded command that a row may kill as its own group (Node `spawn` with `detached: true`); the current `tests/host/lib.mjs` `run` does not detach (source fact S7). |
| Shared group: fail-closed | When the caller runs a guarded command in a group that it shares with other long-lived processes (for example a harness process), a record of a killed command stays live while that group lives. Other commands then wait and refuse `operation_in_progress`. Exit: end that caller or its group, or wait, then run the command again. Safety does not depend on the group being private; only the time to recover does. |

**Primitives.** The lock uses only `mkdir`, the `rename(2)` system call and `ps` on the host. `storage-oplock.sh` does every folder `rename` and every record write through `node` (`node:fs.renameSync`, `fsync`), never through shell `mv`. Reason: `mv a b` moves `a` **into** an existing folder `b` and succeeds, so A2 and the takeover would not be exclusive (scratch probe P1–P2: `renameSync` onto a non-empty folder fails with `ENOTEMPTY`; `mv` moved the folder inside). No `flock` and no new product API are needed.

**Lock self-check.** `bash infra/scripts/storage-oplock.sh selftest` runs on the host without Docker, in a new scratch folder `.tmp/storage-op-selftest-<16 hex>/` with the project name `selftest-<16 hex>`. Its container checks see no container. It removes its scratch folder. Each scenario has a bound of 30 s; the whole run has 90 s.

| Scenario | Expected |
| --- | --- |
| `rename-held` | a candidate `rename` onto a held lock fails, and a second takeover onto an existing `stale-<id>` fails |
| `locale` | a record written under `LC_ALL=C` is still live when the check runs from a caller environment with another locale (for example `LC_ALL=fr_FR.UTF-8`, if installed); the line also records whether a raw `ps -o lstart=` differs in that locale |
| `orphan-client` | a stub owner in its own group starts a stub client child; the owner gets `SIGKILL` alone → a contender refuses `operation_in_progress`, not a reclaim; after the stub client ends → the contender reclaims (`storage_lock_reclaimed`) |
| `dead-owner` | a record whose owner has ended and whose group is empty → reclaimed |
| `own-group` | a background job started like the Build Runner has a group other than the command's |

It prints one line per scenario, `{"event":"storage_lock_selftest","ts","runId","scenario","expected","observed","ok"}`, and exits 0 only when all are `ok`.

**Release.** The holder releases after its last storage container has exited (its `dc run` returned). For `stack:up`, this is after `up --wait` and `mark-started`. Release steps:
1. Read the record; continue only when it has its own `runId`. Else log `storage_lock_lost` and exit 1; another owner's lock is never removed.
2. `rename(2)` of the lock folder to `rel-<runId>`, then delete `rel-<runId>`.
3. Log `storage_lock_released`.

An `EXIT`, `INT` or `TERM` trap releases the lock in the same way after the child `dc run` has ended. After `SIGKILL` there is no release, and the record becomes stale (A5).

**Orphaned writer: the operator exit.** `storage_writer_active` names the container. Wait until it ends (a maintenance run then completes or stops at its own error), or stop it with `docker stop <name>`. `operation_in_progress` for a record whose owner has ended means that a process of its group still runs (for example a Docker client); the message names the group and its processes. Wait for them, or end them. A restore or import that is stopped in the middle is then a crash at that point. Run the command again: the lock is reclaimed (A5), and `stack:data-restore -- --recover` handles the journal (§8).

### Scope

| Command | Lock scope |
| --- | --- |
| candidate `stack:up`, `stack:restart`, `stack:reset`, `stack:data-backup`, `-restore` (also `--recover`), `-import`, `-quarantine`, `stack:storage-compat` (`enable`, `disable`) | the whole command |
| candidate `demo` | no lock of its own; its internal `stack-up.sh` run takes and releases the lock, like the test commands. `demo:prepare`, `demo:users` and `demo:browser` start no container and take no lock. |
| candidate `test:acceptance`, `test:e2e`, `e2e:reset` | no lock of their own. Each internal `stack-up.sh` or `stack-reset.sh` run takes and releases the lock. The suite container (`e2e`) is not a storage container. So a QA host-control `stack:restart` during the suite gets the lock between those internal runs. |
| `infra/scripts/storage-oplock.sh run -- <command>` (candidate tree) | the whole command. QA uses it for its fixture writes. It must not wrap a candidate guarded command: that command then refuses `operation_lock_reentry` at once. |
| old-build commands | only through the copied `bash .tmp/storage-compat/storage-compat.sh run -- <old command>` (§12): one lock for the whole old command, because the old scripts take no lock. Its `preflight` and `status` subcommands also take the lock. |

The lock is **not re-entrant**. No supported command starts another guarded command while it holds the lock. The candidate test commands hold no lock, so their internal starts and the host-control restarts never wait on a parent.

**One checkout per project.** The lock and its records are in `.tmp/` of one checkout, so they serialize the commands of that checkout only. Two checkouts that use one project name are not supported. The design does not claim cross-checkout locking. (The storage-container checks in A5 and A6 are project-wide, so they also see a storage container of another checkout. This is a side effect, not a guarantee.)

### Lock events

Each event is one JSON line on stdout and in `infra/.logs/storage-lock.jsonl`. The host scripts write it as the host user.
- Fields: `{event, ts, project, command, runId, pid, pidStart, pgid, owner: {runId, command, pid, pidStart, pgid, acquiredAt} | null, reason | null, waitedMs, container: {name, id, state, runLabel} | null}`.
- Events:
  - `storage_lock_acquired`, `storage_lock_wait`, `storage_lock_released`, `storage_lock_lost`;
  - `storage_lock_refused`, with `reason` `operation_in_progress`, `operation_lock_reentry`, `storage_writer_active` or `operation_lock_invalid`;
  - `storage_lock_reclaimed`, with `owner` = the stale record;
  - `storage_lock_cleanup`, `storage_container_removed`;
  - `storage_lock_selftest` (self-check lines).

### Guarded paths

| Path | Guarded? | Rule |
| --- | --- | --- |
| `npm run stack:up` | **yes** | lock; §4 host-side steps; §10 legacy scan; `storage-preflight check --prepare …` (a new container and a new `runId` each time); `dc up --wait`; `mark-started` when an identity still says `pending`; release |
| `npm run stack:restart -- <svc>` | **yes** | lock; host-side steps; preflight. A failed preflight → exit 1 **before** `up --force-recreate`, so the running container keeps its container id and start time. Then the existing restart; release. |
| `npm run stack:reset` | **yes** (lock only) | lock; then the existing removal. It is never a recovery step (§9). |
| `test:acceptance`, `test:e2e`, `e2e:reset` | **yes**, per internal run | they start and reset the stack only through `stack-up.sh` and `stack-reset.sh` (scope table) |
| `stack:data-backup`, `-restore`, `-import`, `-quarantine`, `--recover` | **yes** | lock; both services positively stopped; §8 and §9 |
| `stack:storage-compat` (`enable`, `disable`) | **yes** | lock |
| old-build starts (§12) | **yes** | the harness or the operator runs each old start command through the copied `storage-compat.sh run --` |
| QA host-control actions `m1-restart`, `m1-profile` | **yes** | they run the candidate `stack:restart`, which takes its own lock. While the `x-cogniate-storage-compat` marker is present, the host control refuses them before it runs any command (QA-owned, §11). |
| CLIs through `dc exec` (`seed`, `lti:bootstrap`, `lti:shared-platform`, `app:grant`, `app:binding`, `seed-portal`) | **indirectly** | They run inside a running container whose volume was checked when it started through a guarded path. They take no lock: they create no container and use working SQLite locks. |
| `npm run stack:down` | no | Source fact (all three trees, `stack-down.sh:7`): `docker compose … down --remove-orphans`. It stops and **removes** the service containers and the project network, and keeps the volumes and the knobs file. It writes no database file. Whether it also stops a running storage container is not measured (§17); if it does, that is a crash at that point, and §8 recovery applies. Do not run it while a storage command runs. |
| QA harness actions `docker compose stop` and `start` of an existing service container (T5b P2 and P5, the AC-M1-23/30 stops) | not a supported operator start | They create no container and change no mount, so they change no storage layout. The P5 write follows §11. |
| `docker compose up`, `start` or `restart` typed by hand | **no** | Outside the supported scripts. Stated limit. The design adds **no** `depends_on: service_completed_successfully` guard, although Compose accepted one in the Author's fixture (§17). Reason: the preflight needs a mode, a fresh `runId` and the operation lock, which a compose dependency cannot give, and every compose call would need `--profile storage`. |
| Docker restarts containers itself (`restart: unless-stopped`, for example after a VM boot) | **no** | Stated limit. dockerd restarts only containers that were running, so a lane stopped for maintenance stays stopped. Storage containers have `restart: "no"`. |

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

**Other target states.** Step 1 reads the target state (§6, as `report` does). A restore into any state other than `OK` or `FRESH` refuses `restore_target_state`. An import into any state other than `FRESH` refuses `import_target_not_fresh`. The output names the state (for example `FIRST_START`, `FRESH_INIT_PARTIAL` or a §6 refusal code) and the next step: `--recover` or quarantine for a journal row, `stack:up` to finish a first start, or quarantine. Nothing changes.

Before the swap, every restore and import runs a read-only content check on a scratch copy of the staged app database: every `package.storage_path` must exist as a directory under `infra/.data/cogniate-app/packages`, else `content_missing`, and nothing changes. This proves only that the referenced folders exist. It does not prove that their files are the same. The command prints and logs one line `{"event":"storage_content_check","ts","opId","result":"pass"|"content_missing","checked":<count of distinct storage_path values>,"missing":[…]}`.

### Journal and states

One maintenance process restores or imports both volumes: both volumes read-write, the backup folder read-only, both services positively stopped, the operation lock held, in one storage container (§7). Each volume holds `.storage-journal.json`: `{ formatVersion, operation: "restore" | "import", opId, backupId, manifestSha256, pairIdBefore, generationBefore, state, before: [{name, size, sha256}], after: [{name, size, sha256}], identityBefore, updatedAt }`. The two journals have the same `opId`.

**Write order.** Each state change is written to the lti journal first, then to the app journal. At commit, the order is: lti identity, app identity, lti journal, app journal.

**File set.** The file set of a volume is its database `<db>`, `<db>-wal`, `<db>-shm` and `.storage-identity.json`. For each name it holds presence, size and SHA-256; "absent" is a value. `before` and `after` list the present database files; a name that is not listed is absent. Two file sets are **equal** when every one of the four names has the same presence and, when present, the same size and SHA-256 (the identity is compared with `identityBefore` or with the new identity). "Verify in place = `before`" and "verify in place against `after`" always mean this equality, never the main database alone.

**Checked move.** Every move of a swap, a rollback and a forward completion is one `rename` inside one volume, then `fsync` of both folders. Before the `rename`, the program checks two things: the source has the bytes that the journal expects, and the target name does not exist (`lstat`). A target that exists is a **collision**, and nothing moves. The check and the `rename` are not one atomic step. This is enough here, because the operation lock is held and both services are stopped, so no other process writes the volume in between (§7). A crash leaves each file at its source or at its target, never both, so the existing recovery classification applies.

| State | Meaning |
| --- | --- |
| (no journal) | Step 1 validates the whole backup (existing rules, plus the pair rule and `manifest_incomplete`). A failure → exit 1 "no target changed" (true: nothing was written). |
| `prepared` | the journal holds `before` (current files with SHA-256) and `identityBefore`; no target file changed |
| `staged` | every listed file is copied into `.restore-<opId>/`, `fsync`ed and verified; the content check passed; no target file changed |
| `swapping` | the swap of this volume began: files move one by one with the checked move — current files and identity into `.previous-<opId>/`, staged files into place. An in-place file that is not in `before`, a source with other bytes, or a collision stops the swap and starts R3. |
| `swapped` | this volume's new files are in place; old files and old identity are in `.previous-<opId>/` |
| `committed` | both file sets verified equal to `after` in place (so no unlisted sidecar is in place); this volume's new identity is written |
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
| R3 | both X, at least one `swapping`, `swapped` or `rolling_back`, and not the R4 pair | roll back **both**, by the R3 order below | `1` "rolled back; the targets equal the state before (verified)" |
| R4 | lti `committed` X, app `swapped` X (identities written in any order) | re-verify both file sets against `after`. Both are equal → write the missing app identity and app journal, both `committed`. One is not → R3. | `0` "commit completed", or as R3 |
| R5 | any `rollback_failed` | change **nothing** | `2` "the rollback did not finish; do not start; keep both volumes; use `stack:data-quarantine`" |
| R6 | any other pair (`journal_inconsistent`, §6 row 2) | change nothing | `2`, as R5 |

**R3 order** (per volume, lti first, then app):
1. Write `rolling_back`.
2. Classify each in-place name of the file set: bytes equal to its `before` entry (or to `identityBefore`) → keep it in place; else bytes equal to its `after` entry (or to the new identity) → move it to `.restore-X/`; absent → nothing; any other bytes, or a present name that neither list has → `rollback_failed` at once. All the after-files leave their places **before** any before-file comes back.
3. Move each `before` file that is not in place from `.previous-X/` into place. The file must have its `before` bytes; else `rollback_failed`.
4. Put the old identity back: move it from `.previous-X/`, or write it from `identityBefore`. For an empty `before` there is no identity.
5. Verify in place = `before`.
6. Remove `.restore-X/` (it holds only staged copies of the backup and after-files with the backup's bytes) and `.previous-X/` when it is empty. Write `rolled_back`.

A collision in any move → `rollback_failed`. So the rollback never overwrites data that it does not know.

A rollback step that fails, or a verification after a rollback that fails, writes `rollback_failed` to every journal that it can write, keeps every file and folder, and exits `2`. Exit `1` is used only after a verification. Exit `2` never says "no target changed".

The same R3 routine runs at once inside a live restore when any step after `swapping` begins fails. Exit codes:
- `0`: committed, or nothing to recover;
- `1`: refused before any change, or cancelled or rolled back with a verified result;
- `2`: unresolved;
- `3`: stopped by `--stop-after`.

Terminal journals do not block a start (§6). So a lane recovers fully after R1–R4.

### Recovery drills

`--stop-after <point>` exits with code 3 right after the named point is durable. It skips no check, and leaves the same files that a crash at that point leaves. Each use logs `storage_drill_stop {ts, opId, point}`. It is a drill option: it is accepted only when the environment has `STORAGE_DRILL=1`; else the command exits 1 before any change. `rollback-mid` also needs `STORAGE_DRILL_FAIL=after-swapped`, which makes the restore fail on purpose right after `swapped`.

`--pause-after <point>` (same points, also only with `STORAGE_DRILL=1`, and with `STORAGE_DRILL_PAUSE_SECONDS` from 1 to 300) makes the maintenance container wait at the point. It logs `storage_drill_pause {ts, opId, point, seconds}`, waits, logs `storage_drill_resume`, and then goes on normally. QA uses it to keep a storage container active while its client is gone (§13 `g-orphan-*`). A command takes at most one of the two options.

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

Partial copies, a partial `.tmp` file, an `fsync` failure, a collision, and an in-place file with unknown bytes (→ `rollback_failed`, nothing deleted) are unit tests through the library API.

The existing AC-M1-30 oracles stay true:
- a damaged backup stops in the "(no journal)" row, with no change;
- a valid restore puts the backed-up bytes in place;
- an unlisted target sidecar moves to `.previous-<opId>/`, so it is gone from its place.

## 9. Quarantine: the non-destructive exit

`npm run stack:data-quarantine -- --out <folder outside the checkout>` is the exit from `rollback_failed`, `journal_inconsistent` and any refusal that the operator cannot repair. It runs with the operation lock held (so no storage container of the project is active, §7 A6) and with both services positively stopped (`exited`, `created`, `dead` or absent, as the existing maintenance check reads them):
1. **Copy.** Copy **every** entry of both volumes (databases, sidecars, identities, journals, `.restore-*`, `.previous-*`) into the folder, with a manifest of names, sizes and SHA-256, written last, in one storage container of this run. Verify the copy. A failure → exit 1; nothing is removed. Then complete the removal of that copy container: when a container with this command's `org.cogniate.storage.run` label still exists, it must be inactive; remove it by id (`docker rm <id>`) and check that none remains. Only then go on, so step 2 never sees the command's own container.
2. **Volume users.** List every container, in any state, that references `<project>_ltidb` or `<project>_appdb` (`docker ps -a --filter volume=<name>`). A user may be removed only when **all** of these hold:
   - label `com.docker.compose.project=<project>`;
   - label `com.docker.compose.service` is `lti-service` or `cogniate-app`;
   - label `com.docker.compose.oneoff` is not `True` (not a `run` container);
   - state `exited`, `created` or `dead`, read again at this step.
   Any other user → refuse `volume_in_use`, naming its name, id, project and service labels, and state. Nothing is removed; exit 1; the verified copy stays.
3. **Service containers.** Remove each allowed user by id (`docker rm <id>`; never `-f`, never `-v`). They hold no data: the service state is in the volumes, and the next guarded `stack:up` creates them again.
4. **Volumes.** `docker volume rm <project>_ltidb <project>_appdb`. A failure → exit 1 with the Docker message. The service containers of step 3 stay removed; the volumes and the copy stay.
5. **Record.** Write `quarantine.json` in the folder and print one `storage_quarantine` line: `{ts, project, out, manifestSha256, removedContainers: [{name, id, service}], removedVolumes}`.

So both documented stops lead to a successful quarantine: `docker compose stop` keeps the stopped service containers, and step 3 removes them; `stack:down` (`down --remove-orphans`) already removed them and kept the volumes, so step 2 finds no service container.

It does **not** touch the legacy bind files, the content folders, the Moodle volumes, any other container, any other project, or any backup. The lane is then `FRESH`. The operator restores a known backup into it (§8, FRESH target) or imports. Exit `0` when the copy verified and both volumes are gone.

`stack:reset` is **never** a recovery step: it also deletes the content folders, the legacy files, `infra/.data/backups` and the Moodle volumes.

## 10. Legacy bind-folder data

The **legacy set** of a service is every entry of `infra/.data/<service>/` whose name is `<db>` or starts with `<db>-` (for example `-wal`, `-shm`, `-journal`). For the app, `packages/` and `uploads/` are content, not legacy.

`stack-up.sh` runs the legacy scan before the preflight, under the lock:
1. It refuses `old_layout_container` when any container with the label `com.docker.compose.project=<project>` has a mount whose destination is `/data` and whose source is the resolved host path `<checkout>/infra/.data/lti-service` or `<checkout>/infra/.data/cogniate-app`.
2. It reads the legacy sets at rest and computes size and SHA-256.
3. It reads the pair state with `report`.
4. It takes the **first** matching row of the table below. Only after a "continue" does it run the preflight in `check` mode.

| # | Legacy sets | Pair state | Result |
| --- | --- | --- | --- |
| L1 | any | §6 rows 1–3 (`rollback_failed`, `journal_inconsistent`, `journal_open`) | that refusal: an open or failed restore or import comes first, as in §6 |
| L2 | a `<db>-journal`, or another `<db>-…` entry that is not `-wal` or `-shm` | any other | refuse `legacy_hot_journal` (for `-journal`) or `legacy_unknown_entry`: a hot rollback journal is not supported; nothing changes |
| L3 | any | any other §6 refusal code | that refusal |
| L4 | both empty | an allowed state (§6) | continue |
| L5 | present | `FRESH` | refuse `legacy_present`: "Import the legacy databases explicitly (`stack:data-backup -- --source legacy`, then `stack:data-import`), or move them out of the checkout. No empty database was made." |
| L6 | present | `OK` or `FIRST_START`, with `legacySources` equal to the current legacy files (the same names, sizes and SHA-256; nothing added, removed or changed) | continue, with the warning "legacy files are kept for reference and are not used" |
| L7 | present | any other allowed state, or a difference to `legacySources` | refuse `legacy_conflict`: "Legacy and volume databases both exist and are not the same import. Move the legacy files out, or import into a quarantined lane." |

Every combination matches one row, so the table is total.

`legacySources` survive a restore that keeps the `pairId` (§8). So a backup and restore cycle on an imported lane does not create a `legacy_conflict`.

## 11. QA fixture access (test interface, not an overlay)

QA reads and writes the volumes, and runs the probe, only through its own fixture containers. Each kind below is a test fixture, not an overlay; QA owns every one.

Common rules for every QA container:
- image `node:24.22.0-alpine3.24`, pinned by the image id that QA records at the start of the run;
- `--network none`, the labels `org.cogniate.qa=<kind>` and `org.cogniate.lane=<project>`, user `HOST_UID:HOST_GID` unless a row below says root;
- a host-side time bound of 120 s (the decoy: until its row ends), after which QA removes it by id;
- QA checks after each row that none of its containers remains.

| Kind (`org.cogniate.qa`) | Mounts | Use and limits |
| --- | --- | --- |
| `storage-fixture` (`--rm`) | only `<project>_ltidb` and `<project>_appdb`, and QA's own script and output folder | **Read mode:** volumes read-only, at any time. **Write mode:** volumes read-write, only while both services are positively stopped and QA holds the operation lock (`storage-oplock.sh run --`, §7). Root only for the owner changes of `d-owner` and `d-mountpoint`. One exception while services run: the single empty planted entry of `a-restart-refusal`, in the `ltidb` root only, removed by QA after that row. The lock oracle of `b-oracle-*` may run while services run, only inside `.qa-scratch-<16 hex>/`; QA removes it, and a preflight afterwards must pass. Logical reads (§13) open only copies in the container's own writable layer, never the originals. |
| `storage-probe` (`--rm`) | the candidate `infra/scripts/sqlite-lock-probe.mjs` read-only at `/probe/sqlite-lock-probe.mjs`; for `c-host-negative` only, also the QA scratch bind `<storage clone>/.tmp/qa-host-negative-<16 hex>/` read-write at `/check/host-negative` | `c-selftest`: `selftest --folder self=/tmp/qa-selftest-<16 hex>`, a new folder in the container's own writable layer, never a bind mount; no volume is mounted. `c-host-negative`: `probe --folder host=/check/host-negative`. QA makes the scratch bind folder empty, as the host user, and removes it after the row. |
| `storage-oracle` (`--rm`) | QA's own oracle script, and the same scratch bind as `c-host-negative` | QA's independent two-process lock oracle on that folder, before the probe, in the same round. It never mounts the product probe. |
| `storage-decoy` (`-d --rm`) | `<checkout>/infra/.data/lti-service` read-only at `/data` | `e-old-layout` only: also the label `com.docker.compose.project=<project>`, command `sleep 300`. It opens no database. QA removes it by id (`docker rm -f <id>`) right after the row. |
| `storage-volume-user` (`docker create`, never started) | `<project>_ltidb` read-only | `g-quarantine-in-use` only. QA removes it by id after the row. |
| `storage-p5` (`--rm`) | only `<project>_appdb` read-write, and QA's P5 script. Never `<project>_ltidb`. | The T5b P5 fixture: the second named exception while a service runs. QA runs the approved P5 sequence inside one `storage-oplock.sh run -- <QA P5 step>`: the existing `docker compose stop cogniate-app` (the approved app-stop guard), the check that `cogniate-app` is positively stopped, the write, then the existing `docker compose start cogniate-app`. The write touches only `cogniate.db` and the `-wal` and `-shm` files that SQLite uses for it. `lti-service` may run, because it does not mount `appdb`. The P5 assertions do not change. |

Other QA rules:
- **Independence.** QA's own scripts parse identities, journals and lock records, hash files and read rows. They never use the product maintenance code as their oracle. The product commands are what QA tests.
- **Existing fixtures.** The T5b P5 fixture keeps its approved app-stop guard and its assertions; only its database access moves into the `storage-p5` container.
- **Harness actions.** The existing harness `docker compose stop` and `start` of an existing service container stay as they are: T5b P2 (stop and start `cogniate-app`), T5b P5 (above), the AC-M1-23/30 stops of both services, and the Moodle stop and start. They are accepted harness actions, not supported operator starts (§7). They create no container and change no mount. `tests/host/m1-migration.mjs` and `m1-migration.selftest.mjs` read and write volume copies the same way.
- **Lock records.** For `a-lock-stale`, QA writes lock record folders in `.tmp/` of the storage clone as the host user (§7 format).
- **Host control.** While `.tmp/compose.knobs.yaml` holds the `x-cogniate-storage-compat` marker, QA's host control (`tests/host/m1-control.mjs`) refuses `m1-restart` and `m1-profile` before it runs any command. This is recorded as a harness self-check (§13).

## 12. Old-build storage compatibility (bounded exception)

Scope: **only** `b0b83a8289e1bf9cf349068aca184f0879e9aaf0` (released v10; AC-M1-23/30, AC-M1-41 `e-old-schema`) and `9f96f7b24cd0aed702e4dc40373bdda4307aad31` (populated `011`; AC-M1-38 h1–h5). Every design and implementation review must accept it.

### Files and injection

- Committed in the candidate tree (backend Author):
  - `infra/compat/storage-compat.knobs.json` (the override);
  - `infra/scripts/sqlite-lock-probe.mjs`;
  - `infra/scripts/storage-compat.sh` (the runner);
  - `infra/scripts/storage-oplock.sh` (the lock helper of §7);
  - `infra/compat/storage-compat.sha256` (the SHA-256 of these four files).
- The override is JSON with the top-level marker key `"x-cogniate-storage-compat": {"formatVersion": 1, "revisions": ["b0b83a8289e1bf9cf349068aca184f0879e9aaf0", "9f96f7b24cd0aed702e4dc40373bdda4307aad31"]}`.
- `npm run stack:storage-compat -- enable` (candidate tree):
  1. refuses when `.tmp/compose.knobs.yaml` already exists ("test knobs are active: restore the defaults first"); it never merges;
  2. creates the host content folders (§4);
  3. copies the override to `.tmp/compose.knobs.yaml`, and copies the probe, `storage-compat.sh` and `storage-oplock.sh` to `.tmp/storage-compat/`;
  4. checks all hashes.
- Source fact (both old SHAs, `infra/scripts/lib.sh` line 9): `KNOBS_FILE="$REPO_ROOT/.tmp/compose.knobs.yaml"`, an **absolute** path, and the old `dc()` adds `-f "$KNOBS_FILE"` to every compose call when that file exists. `.tmp/` is git-ignored and survives `git checkout --force`.
- After the old SHA is checked out, the copies run without the candidate tree:
  - `bash .tmp/storage-compat/storage-compat.sh run -- <old start command>`: the only supported way to run an old start command. It accepts only old `npm run stack:up` and old `npm run test:acceptance …`; any other command → `wrapper_command_not_allowed`. Steps: take the operation lock for the whole command (§7); check the hashes of the knobs file and the copies; the preflight; the command; `status`; release. The exit code is the command's, or 1 when a check fails ("stop now").
  - `storage-compat.sh preflight` and `storage-compat.sh status`: the same checks alone, each under the lock.
  - `storage-compat.sh disable`: removes the knobs file and the copies.
  - `bash .tmp/storage-compat/storage-oplock.sh run -- <command>`: QA's fixture writes during old steps (§11).
  - `run`, `preflight` and `status` are **old-only**: they refuse `wrapper_old_only` unless `git rev-parse HEAD` is one of the two SHAs of the marker. A candidate command never runs through them; it takes its own lock (§7).

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
| through the old `dc()`: old `npm run stack:up` and old `npm run test:acceptance` (they start services; only through `storage-compat.sh run --`), old `npm run seed` (it uses `exec` only), old `npm run stack:down` (it keeps the volumes and the knobs file); the copied `storage-compat.sh run`, `preflight` and `status` | the candidate commands of the guard below; the QA host-control actions `m1-restart` and `m1-profile` (they run old `stack:restart`; §11) |

Preflight and mount checks:
- Each **harness-invoked** (or operator-invoked) old start command runs as `storage-compat.sh run -- <command>`, so one preflight runs before it and the mount check after it.
- The mount check (`status`) reads `docker inspect` of the running `lti-service` and `cogniate-app`. `/data` must be the volume `<project>_ltidb` / `<project>_appdb`; the app must have the two nested binds; no bind may sit at `/data`; and the knobs file hash must still equal its frozen value. Else exit 1 → `BLOCKED` (QA) or "stop now" (operator).
- Old `test:acceptance` calls `stack-up.sh` twice inside one command. The preflight before the command and the mount check after it cover those internal starts. They use the same knobs file and the same volumes, so the storage cannot change between them. The wrapper holds the lock for the whole old command; the old scripts take no lock, so nothing inside waits for it. The host control refuses old restarts (§11), so no other start runs during the command.

**Candidate guard.** Every candidate command that can create, recreate or start a container, or that reads or writes the databases, refuses while `.tmp/compose.knobs.yaml` holds the `x-cogniate-storage-compat` key ("run `npm run stack:storage-compat -- disable`"). These commands are `stack:up`, `stack:restart`, `stack:reset`, `test:*`, `e2e:reset`, `demo*` and `stack:data-*`. `seed` runs `exec` only and is not affected.

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
  4. `git checkout <old>`; install and build it;
  5. `bash .tmp/storage-compat/storage-compat.sh run -- npm run stack:up`.
- A **fresh old-route lane** (AC-M1-23 step 1, AC-M1-38 (h1)): in the clone, check out the candidate and run `npm run stack:storage-compat -- enable` **before** `git checkout <old>`; then install the frozen tests and run `storage-compat.sh run -- npm run stack:up`.
- Old and new builds use the same volumes, so the two QA routes need no import step.
- **Evidence qualifier:** every old-build row keeps its label (`MOODLE-LIVE` or `SIM`) and adds: "old build `<sha>`: tracked product tree equal to that SHA, frozen candidate tests (`tests/` tree `<hash>`), and the storage-compatibility override (`compose.knobs.yaml` SHA-256 `<h1>`, probe `<h2>`, runner `<h3>`, lock helper `<h4>`), which changes only the effective-config items (a)–(e) of ADR-012 §12". It never says "unchanged old infrastructure".
- The old `warn_knobs` caution line is expected and recorded. `/healthz` shows `"knobs":[]`, because the override sets no environment.

## 13. Acceptance rows (AC-M1-41)

Every row has the id `M1-41.common.<id>` and is individually mandatory in **each** full round. The phase `storage` is a new host phase. It runs in its own fresh clone with its own lane (project name), after the `migration` phase of the same round, because `e-old-schema` uses the v10 databases of that round's AC-M1-23 backup. `e-old-schema` runs last in the `storage` phase.

| Group | Ids | Phase | Count |
| --- | --- | --- | --- |
| a. start paths and the operation lock | `a-fresh`, `a-second-start`, `a-restart`, `a-restart-refusal`, `a-serialize`, `a-first-start-resume`, `a-lock-wait`, `a-lock-stale`, `a-lock-scope`, `a-lock-reentry` | storage | 10 |
| b. lock and write safety | `b-oracle-lti`, `b-oracle-app`, `b-sequence` | storage | 3 |
| c. negatives | `c-selftest`, `c-host-negative` (conditional, §14) | storage | 2 |
| d. hygiene and ownership | `d-clean`, `d-stale`, `d-unknown`, `d-symlink`, `d-owner`, `d-mountpoint`, `d-content-folder` | storage | 7 |
| e. legacy and import | `e-fresh-refusal`, `e-import`, `e-kept`, `e-changed-byte`, `e-added-wal`, `e-not-same-import`, `e-import-nonfresh`, `e-content-missing`, `e-old-layout`, `e-hot-journal`, `e-old-schema`, `e-import-recover`, `e-provenance-restore` | storage | 13 |
| f. identity | `f-pairid`, `f-identity-missing`, `f-db-without-identity`, `f-project`, `f-half-pair`, `f-originals-back` | storage | 6 |
| g. restore recovery and quarantine | `g-prepared-lti`, `g-prepared`, `g-staged`, `g-swap-lti-mid`, `g-swapped-lti`, `g-swap-app-mid`, `g-swapped`, `g-identity-lti`, `g-identity-app`, `g-committed-lti`, `g-rollback-mid`, `g-recover-idempotent`, `g-tamper`, `g-quarantine`, `g-damaged`, `g-fresh-target`, `g-orphan-refusal`, `g-orphan-complete`, `g-orphan-stopped`, `g-quarantine-in-use` | storage | 20 |
| h. backup and pair rule | `h-nomanifest`, `h-volume-manifest`, `h-legacy-manifest`, `h-open-journal`, `h-pair-mismatch`, `h-old-manifest`, `h-target-state` | storage | 7 |
| i. product guards | `i-enable-refusal`, `i-candidate-guard` | storage | 2 |
| j. old-route qualification | `j-migration` (phase `migration`), `j-snapshot` (phase `snapshot-upgrade`) | as named | 2 |

Total new rows: **72** per round (revision 2 had 63; revision 3 adds the nine rows `a-lock-wait`, `a-lock-stale`, `a-lock-scope`, `a-lock-reentry`, `g-orphan-refusal`, `g-orphan-complete`, `g-orphan-stopped`, `g-quarantine-in-use` and `h-target-state`). The existing **416** rows stay unchanged, with the same ids, phases and labels. So each full round has **488** mandatory rows. The phases are: `sim` 394, `snapshot-isolated` 6, `snapshot-upgrade` 6, `migration` 12, `storage` 70.

QA's own hashes decide every "equal" and "unchanged" oracle. `b-sequence` shows that the volumes work; the cause claim rests on the lock-level rows `b-oracle-*` and `c-host-negative` and on the diagnostics of §1, not on `b-sequence`. **Recovery oracle.** Every recovery and restore row compares two things, both read only from **stopped** volumes in QA's `storage-fixture` container:
- the **full file set** of each volume (§8): `<db>`, `<db>-wal` and `<db>-shm` with presence, size and SHA-256 ("absent" is a value), and the identity with its `generation` and `provenance`;
- the **logical rows**: QA copies each database together with its present sidecars into the container's own writable layer and reads the marker rows from that copy (so a committed write that is still in `-wal` counts). It never opens an original.

The fixture is built so that the two generations differ **logically** in both databases: after backup `B`, QA writes one new LTI platform and one new app connection, and its logical read confirms that the pre-drill pair has them and `B` does not. The fixture does not need every sidecar to differ, because sidecars can be absent or equal. The oracle still compares the full file set exactly.

Harness self-checks are recorded in a separate harness section of the run, **not** as product rows:
- a one-byte change of the override, the probe, the runner or the lock helper → the harness reports `BLOCKED`;
- an override copy with one added environment key → the config check reports a not-allowed difference;
- with the marker present, a host-control `m1-restart` or `m1-profile` request → the host control refuses before it runs any command;
- once per round, before the `storage` phase: `bash infra/scripts/storage-oplock.sh selftest` (§7) exits 0 with every scenario `ok`. A failure makes the `storage` phase `BLOCKED`.

## 14. The single conditional row

`M1-41.common.c-host-negative` is the **only** row that can be `NOT_APPLICABLE`.
- QA first runs its own lock oracle on a scratch bind folder under `.tmp/` of the storage clone. Then it runs the probe on the **same** folder in the same round, in QA's fixture container (§11).
- Where QA's oracle shows the demonstrated fault (WAL lock not enforced), the probe must report `lock_not_enforced` and exit 1, and the row is PASS.
- Where QA's oracle shows enforcement, the row is `NOT_APPLICABLE`, with the oracle evidence attached.
- `NOT_APPLICABLE` is reported separately and is **never** counted as a PASS. A round is complete only when every other row is PASS and this row is PASS or `NOT_APPLICABLE` with evidence.
- **Two rounds.** The existing rule "the same result per row in both full rounds" applies to this row too: PASS in both, or `NOT_APPLICABLE` with evidence in both. A different result between the rounds fails the run, because the host fault must be stable. This is not a general waiver: it applies to this one row only.
- No other row, and no original M1 row, can be `NOT_APPLICABLE`.
- `c-selftest` is the portable negative and must PASS on every host.

## 15. Lane ownership and cleanup

The databases belong to the **compose project name**, not to the checkout.
- A new clone that reuses an existing project name finds that project's volumes, and its identity check passes. But `gen-env` gives the new clone new master keys, so the services cannot use the old encrypted rows.
- Rule: a fresh QA lane must show no `<lane>_ltidb` and no `<lane>_appdb` before its first start (QA's boundary check with the label `com.docker.compose.project=<lane>`), and none after its cleanup.
- **One checkout per project.** The operation lock is in `.tmp/` of the checkout (§7). Two checkouts that use one project name are not supported, and nothing claims to lock across checkouts. The `stale-*` lock records stay in `.tmp/` as evidence; QA removes them with its clone.

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
| Backend Author (owns `infra/**`) | `infra/compose.yaml` (volumes, nested binds, `storage-preflight`, a `maintenance` service); `infra/scripts/sqlite-lock-probe.mjs` (new) and its unit test; `infra/scripts/storage-oplock.sh` (new: acquisition A1–A6 with the group rule, takeover, release, lock events, `run --`, `selftest`; every `rename` and record write through `node`, every `ps` with `LC_ALL=C`); `lib.sh` `start_build_runner` (its own process group); `infra/scripts/stack-up.sh`, `stack-restart.sh`, `stack-reset.sh` (lock only), `qa-suite.sh` and `e2e-reset.sh` (guard only; no lock of their own); `infra/scripts/stack-data.sh`, `stack-data.mjs`, `lib.sh` (storage containers with name and run label, `--source legacy`, `stack:data-import`, `stack:data-quarantine` with the volume-user rule, the journal, the checked move, the R3 order, the target-state refusals, `--recover`, `--stop-after`, `--pause-after`); `infra/compat/*`, `infra/scripts/storage-compat.sh`; root `package.json` scripts; `infra/README.md`; `services/lti-service/src/cli/stack-data.test.ts` (new cases; existing assertions unchanged) |
| Product code | none |
| Independent common QA (Claude) | `tests/host/m1-migration.mjs`, `tests/host/m1-migration.selftest.mjs`, `tests/host/p5-fixture.mjs` (database access through §11; guards and assertions unchanged); `tests/host/run-t1.mjs` (the information-only `**/.data` scan no longer sees database bytes; note it); `tests/host/m1-control.mjs` (refuse `m1-restart` and `m1-profile` while the compat marker is present); a detached start (own process group) for each guarded command that a row kills; the `storage-p5` P5 access; the QA fixture scripts and container kinds of §11 under `tests/host/`; the QA suite case that `a-lock-scope` runs; the 72 AC-M1-41 rows and their accounting |
| Architect | this ADR, ADR-006, `local-stack.md`, ADR-011 §14, M1, M3, the indexes, `review-response-storage.md` |
| Docs (M4) | operator guide: import, backup, restore, recovery, quarantine, rollback mode with the override, cleanup semantics |

## 17. Measured feasibility facts and assumptions for the build step

**Measured feasibility facts.** Source: the Author diagnostic `/Users/quangnguyen/cogniate-author-diag/storage-feasibility-20261020T2119Z/public/AUTHOR-DIAGNOSTIC-storage-feasibility.md`, SHA-256 `32a07797786eac79ada89a07c472735f7fffb87cd13da7afc00ff6ccb18226ba` (task `task_b5db7037a739`). It used synthetic files on one host only: macOS, Docker Desktop engine 29.9.1, Compose 5.6.0. These are feasibility facts. They are not candidate acceptance and not a guarantee for other platforms.

| # | Fact on the measured host | Design use |
| --- | --- | --- |
| M1 | A new empty named volume at `/data` (the image has no `/data`) is `root:root 0755`. The service user cannot write in it. | §4 volume-root step |
| M2 | For nested binds, Docker creates the covered mountpoint folders inside the volume as `root:root 0755`, empty, at container creation. Host-source owner and mountpoint owner are different. | §4 mountpoint rule (fix an empty root-owned mountpoint) |
| M3 | A narrow root step (the volume root and the two mountpoints, `501:20 0700`, not recursive) works. A later volume-only container and the next start with binds keep `501:20 0700`. The bare mountpoints stay empty. | §4, §5 step 3 |
| M4 | As the service user in the volume: a `0600` file, a file `fsync`, a rename in one folder, a rename over a file, a rename into another folder of the same volume, and a folder `fsync` all work. A rename from the volume into the `uploads` bind fails with `EXDEV`. | §6 and §8 write order; §3 rename rule |
| M5 | A Compose override with a volume at the same target **replaces** the base `/data` bind (merge by target) and adds the two nested binds. | §12 items (a) and (b) |
| M6 | A profiled service is absent unless its profile is enabled. `run --rm --no-deps` of a one-shot service works with `-p` and absolute `-f` files. Compose resolves a relative `-f` path against the current folder, not against `--project-directory`. | §5 service, §12 C0/C1 |
| M7 | `config --format json` gave the same hash in two runs of one fixture. | §12 C0/C1 |
| M8 | `up --wait` accepted a `service_completed_successfully` dependency in the fixture. | not used (§7) |

**Source facts** (read with `git show`, no run):

| # | Fact | Design use |
| --- | --- | --- |
| S1 | Both old `lib.sh` (line 9) set `KNOBS_FILE="$REPO_ROOT/.tmp/compose.knobs.yaml"`, an absolute path, and the old `dc()` adds `-f "$KNOBS_FILE"` only when the file exists. So M6's relative-path behavior does not apply to the old builds. | §12 injection |
| S2 | Both old `seed.sh` use only `dc exec`. | §12 command rule |
| S3 | Both old `qa-suite.sh` call `stack-up.sh` twice in one `test:acceptance` (acceptance profile, then the default restore). | §12 `run --` |
| S4 | The candidate host control (`tests/host/m1-control.mjs`) runs `npm run stack:restart` in the clone for `m1-restart` and `m1-profile`. | §7 scope, §11 |
| S5 | The candidate `stack-reset.sh` removes every container with the project label (`docker rm -f`) and then the project volumes. | §7 guarded paths |
| S6 | The candidate `stack-up.sh` calls `start_build_runner` (`lib.sh`), which starts `build-runner.sh watch` with `nohup … &`, a plain background job. No other guarded script starts a long-lived background process. | §7 process ownership |
| S7 | QA's `tests/host/lib.mjs` `run` uses `spawn` without `detached`; its timeout sends `SIGTERM`, then `SIGKILL`, to the child pid only. `tests/host/p5-fixture.mjs` and the P2 action of `tests/host/run-t5.mjs` run `docker compose stop cogniate-app` and `start cogniate-app`; P5 then opens `cogniate.db` with `node:sqlite`. | §7, §11 |
| S8 | `stack-down.sh:7` in `b0b83a8`, `9f96f7b` and the candidate: `docker compose --profile test --profile acceptance down --remove-orphans`. | §7, §9 |

**Architect scratch probes** (design feasibility only, not acceptance; no Docker, no product command; macOS Darwin 27.0.0 on APFS, `/bin/bash` 3.2.57, Node 24.21.0; scratch folders under `/tmp`):

| # | Observed | Design use |
| --- | --- | --- |
| P1 | `fs.renameSync` of a folder onto a non-empty folder failed with `ENOTEMPTY`, also for a second takeover onto an existing `stale-<id>`; onto an **empty** folder it succeeded (replace) | §7 A2, A5 (a lock or `stale-*` folder is never empty) |
| P2 | `mv m1 m2` with an existing `m2` moved `m1` into `m2` and exited 0 | §7: never `mv` |
| P3 | `ps -o lstart=` for one process: `C` and `vi_VN.UTF-8` printed the same text; `fr_FR.UTF-8` printed another text | §7: `LC_ALL=C` |
| P4 | a stub owner started as its own group, then `SIGKILL` to the owner alone: its foreground child stayed in the group; after the child ended, the group was empty. A child started without its own group shared the caller's group (the caller's shell and Node were in it). | §7 group rule; shared group = fail-closed |
| P5 | in a script, `( set -m; nohup sleep … & )` gave the job its own group; a plain `nohup … &` job kept the script's group | §7 Build Runner rule |

**Assumptions still to verify in the build step (not claimed, not measured):**
1. M1–M7 also hold for the candidate and the old product Compose files, with the project's `--env-file` and the old `dc()` arguments.
2. The named volume enforces the SQLite WAL lock with the product's `node:sqlite` (shown by QA's earlier diagnostic; not part of the feasibility diagnostic). The probe checks this at every guarded start.
3. `node:sqlite` reports the extended result code in its error (`errcode`), so 5, 261 and 517 can be told apart.
4. On Linux hosts: the `rename(2)` and `ps` behavior of P1, P3 and P4–P5 (measured only on macOS). On every host: `LC_ALL=C ps -o lstart= -p <pid>` prints the same text for a live process each time, and nothing for an ended one.
5. A `docker compose run --rm` container keeps running after its client gets `SIGKILL` (the A-S-09 premise). The design does not depend on whether Docker or the client removes it after it ends: A6 removes an inactive leftover.
6. `docker compose run` accepts `--name` and `--label` for the storage containers, and `docker ps -a --filter volume=<name>` lists every container that references a named volume, in any state.
7. `docker inspect` shows the mount type, source and destination needed by `status`.
8. The added preflight time of each guarded `stack:restart` stays inside the existing test windows (for example the 60 s lease windows of AC-M1-37). QA records the measured restart durations. No test window or lease changes.
9. On Linux hosts, the bind-source owner rules and real UIDs give the same result as M2–M3.
10. The Docker client of a guarded command stays in the command's process group while it runs: the `docker compose` plugin process, or at least the `docker` front process that waits for it (not measured: Docker was not used in the probes).
11. Whether `docker compose … down --remove-orphans` without `--profile storage` stops or removes a running storage container (a `run` container of a profiled service). The design depends on neither answer (§7 `stack:down` row).

## 18. Consequences

- Concurrent CLI and service access is safe wherever the preflight passes. Wherever it fails, the stack refuses to start, with an exact reason.
- Database files are no longer plain files in the checkout. Read them only through the maintenance or QA fixture container.
- Existing bind installations need one explicit import. Old builds need the override, with its caution line, and a temporary rollback mode with forbidden commands.
- A lane that cannot recover has a non-destructive quarantine exit.
- Storage commands of one checkout are serialized. A killed client cannot let a second writer start while its storage container still runs.
- The released-v10 and `011` evidence rows carry the §12 qualifier.
