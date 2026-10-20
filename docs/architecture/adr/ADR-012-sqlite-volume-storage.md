# ADR-012: SQLite state on project-scoped named volumes, with a lock prerequisite

Status: Proposed (design for independent review; not accepted). Date: 2026-10-21. Owner: Architect. Amends [ADR-006](ADR-006-storage.md) (storage location) and [ADR-011 §14](ADR-011-multi-lms.md#14-compatibility-migration-upgrade-and-rollback) (maintenance commands).

## 1. Context

| Input | Value |
| --- | --- |
| Author diagnostic | `/Users/quangnguyen/cogniate-author-diag/providers500-8138097-20261020T2022Z/public/AUTHOR-DIAGNOSTIC-report.md`, SHA-256 `f759561126bf17c70914fbcb114850f95662b838ffd1bc185f3a732e0ce075c3` |
| QA diagnostic | `/Users/quangnguyen/cogniate-qa-runs/claude-sqlite-diag-20261020T2035Z/public/QA-SQLITE-LOCK-DIAGNOSTIC.md`, SHA-256 `ada5017363a0e757b3faaccc301c0e854fb95056bd6ec2928ab95c5060c62cb7` |
| Proposal | `/Users/quangnguyen/cogniate-architect-diag/storage-recovery-task_a37d8fc8b8e3/STORAGE-RECOVERY-PROPOSAL.md` revision 2, SHA-256 `a0e497c2058a29f1c463358daf088cd6ea5370c8ba439d8ed5973d2784e05ff3` |
| Lead scope | `msg_9cf2186e296b` (task `task_f7bf1fb07035`) |

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
| DS1 | The SQLite files of both services live only on two project-scoped named volumes, `ltidb` and `appdb`. Content files stay on the existing bind folders. No product code changes. |
| DS2 | A storage preflight checks folder ownership, real WAL lock exclusion with a live holder and a positive release, and the pair identity. It runs in a fresh one-shot container on every **guarded** path of §4. The paths that it does not guard are listed. |
| DS3 | The two databases are one **pair**. An identity file in each volume names the pair. A journaled, paired restore recovers from every interruption boundary and keeps the old state until both targets are verified. |
| DS4 | Old bind-folder databases are never selected automatically. An explicit import goes only into empty volumes. Any ambiguous state refuses to start. |
| DS5 | A bounded, storage-only compatibility override lets the two old builds `b0b83a8289e1bf9cf349068aca184f0879e9aaf0` and `9f96f7b24cd0aed702e4dc40373bdda4307aad31` run on the volumes. It is the only exception to the no-overlay rule. No route ever returns live data to a bind folder. |
| DS6 | New acceptance criterion AC-M1-41. Every stack-level gate runs again on the new candidate. |

## 3. Layout

| Container path | Storage | Owner, mode | `stack:reset` | Backup |
| --- | --- | --- | --- | --- |
| lti-service `/data` (`lti.db`, `lti.db-wal`, `lti.db-shm`) | named volume `ltidb` (Docker name `<COMPOSE_PROJECT_NAME>_ltidb`) | `HOST_UID:HOST_GID`; root folder `0700` | removed (existing `down -v`) | yes |
| cogniate-app `/data` (`cogniate.db`, `-wal`, `-shm`) | named volume `appdb` (`<project>_appdb`) | same | removed | yes |
| cogniate-app `/data/packages`, `/data/uploads` | **nested binds** of the unchanged host folders `infra/.data/cogniate-app/packages` and `…/uploads` | host user, `0700` | removed (existing `rm -rf infra/.data/cogniate-app`) | no (as today) |
| Moodle volumes, build queue, logs, secrets, certificates, fixtures, `.mbz` backups | unchanged | unchanged | unchanged | unchanged |

Rules:
- A database and its `-wal` and `-shm` files are always in the same volume folder.
- The upload rename stays inside one mount (`uploads/.tmp` → `uploads`). The host-side Build Runner reads `infra/.data/cogniate-app/uploads` as today. `package.storage_path` stays relative to `/data`.
- Allowed entries in a volume root:
  - `<db>`, `<db>-wal`, `<db>-shm`;
  - `.storage-identity.json` and `.storage-journal.json` (with their `.tmp` variants while a write is in progress);
  - `.restore-<opId>/` and `.previous-<opId>/`;
  - `.lock-probe-*` (removed by the probe);
  - for `appdb` only, the mountpoint folders `packages` and `uploads`.
  Any other entry, for example `<db>-journal` or a second `*.db`, is an **unknown state**, and the preflight refuses.
- Volume names carry the project name, so lanes are isolated. A lane never touches another project's volumes.
- `stack:down` keeps the volumes. `docker volume prune` without `-a` removes only anonymous volumes.

## 4. Storage preflight

Program `infra/scripts/sqlite-lock-probe.mjs`, run as the Compose service `storage-preflight`:
- image: the existing `node:24.22.0-alpine3.24`;
- `network_mode: none`;
- Compose profile `storage`, so a plain `up` never starts it;
- mounts: `ltidb` at `/check/lti-service` and `appdb` at `/check/cogniate-app`, read-write; no other mount except the program file (read-only).

Modes:
- `report` is read-only and prints the state of §5 as JSON.
- `check` (the default) does these steps for each folder, in this order:

| Step | Rule |
| --- | --- |
| 1. Ownership | As root: if the owner of the volume **root folder** is not `HOST_UID:HOST_GID`, or its mode is not `0700`, change only that folder. Never recursive, never a file. If any existing file or folder inside has another owner: FAIL `owner_mismatch` (no automatic fix). |
| 2. Privilege | Switch to `HOST_UID:HOST_GID` (`process.setgid`, then `process.setuid`). All later steps run as the service user. |
| 3. Scratch cleanup | Delete every `.lock-probe-*` entry left by an earlier interrupted run (at most 9 entries; more → FAIL `scratch_overflow`). A failed delete → FAIL. |
| 4. Live holder | A child process opens `.lock-probe-<16 hex>.db` in WAL mode, runs `BEGIN IMMEDIATE`, inserts one row, and writes `HELD <pid>`. |
| 5. Negative oracle | The parent process opens the same file with `busy_timeout = 0`. `BEGIN IMMEDIATE` must fail with errcode **5** (`SQLITE_BUSY`) exactly; any other result, also success or errcode 6, is a FAIL. Then the parent sends `PING`; the child must answer `PONG inTransaction=1` (it is alive and still holds the transaction). |
| 6. Release-positive control | The parent sends `COMMIT`; the child commits, closes, writes `COMMITTED` and exits 0. The parent's `BEGIN IMMEDIATE` must now succeed, and a `SELECT` must return the child's row; the parent then rolls back and closes. |
| 7. Cleanup | Delete the scratch `.db`, `-wal` and `-shm` in a `finally` block. A failed delete → FAIL. |
| 8. Pair identity | the §5 state table must give `OK` or `FRESH`; on `FRESH`, write both identity files (§5). |
| Bounds | each wait ≤ 10 s; a timeout → FAIL `timeout`; the whole run ≤ 60 s |
| Result | exit 0 only when every step passes for both folders. Else exit 1 with one line `storage_preflight_failed {folder, fs_type, reason}` (`lock_not_enforced`, `probe_error`, `timeout`, `owner_mismatch`, `scratch_overflow`, `identity_*`, `unknown_entry`, `journal_open`), and nothing starts. A non-lock error is never a pass. |

The probe never opens `lti.db` or `cogniate.db`. It runs before any service opens a database, so no CLI can be active and there is no startup race.

### Coverage: guarded and unguarded paths

| Path | Guarded? | How |
| --- | --- | --- |
| `npm run stack:up` | **yes** | `stack-up.sh` runs §6 (legacy check), then `dc --profile storage run --rm storage-preflight` (a new container each time, never an earlier "completed" result), then `dc up`. |
| `npm run stack:restart -- <svc>` | **yes** | `stack-restart.sh` runs the preflight before its `up --no-deps --force-recreate`. |
| `test:acceptance`, `test:e2e`, `e2e:reset` | **yes** | they start the stack through `stack-up.sh` |
| `stack:data-restore`, `stack:data-import` | **yes** | the journal of §7, then the preflight in `check` mode |
| Old-build starts in the routes of §8 | **yes** | the harness, or the operator rollback step, runs the override's preflight before each old `stack:up` |
| CLIs through `dc exec` (`seed`, `lti:bootstrap`, `lti:shared-platform`, `app:grant`, `app:binding`, `seed-portal`) | **indirectly** | They run inside a running service container. Its volume was checked when it started through a guarded path. A running container's storage does not change. |
| `stack:data-backup` | not needed | one process, both services stopped, volumes mounted read-only |
| A `docker compose up`, `start` or `restart` typed by hand | **no** | outside the supported scripts. A `depends_on: service_completed_successfully` guard is added only if the build step shows that it works with `up --wait`; else the docs do not claim this guard. |
| Docker restarts containers itself (`restart: unless-stopped`, for example after a VM boot) | **no** | dockerd starts the containers without Compose. Stated limit. QA and the documented procedures always start through `stack:up`. |

## 5. Pair identity and the start-state table

Each volume holds `.storage-identity.json`:

```json
{ "formatVersion": 1, "composeProject": "<name>", "pairId": "<uuid>", "role": "lti" | "app", "generation": 0,
  "createdAt": "<iso>", "provenance": { "kind": "fresh" | "restore" | "import", "opId": "<uuid>|null",
  "backupId": "<uuid>|null", "manifestSha256": "<hex>|null", "legacySources": [ { "name", "size", "sha256" } ] } }
```

Rules:
- Every identity and journal write uses a `.tmp` file, then `fsync`, then `rename`, then `fsync` of the folder.
- Both volumes always carry the same `pairId`, `composeProject` and `generation`.
- `legacySources` lists every legacy database and sidecar file that an import read, with size and SHA-256.

Start-state table. The preflight computes the state from both volumes; `stack-up.sh` adds the legacy scan of §6:

| State | Condition (both volumes) | Result |
| --- | --- | --- |
| `FRESH` | no database, no identity, no journal, no `.restore-*` or `.previous-*`, only allowed entries | write both identities (`generation 0`, `kind: fresh`, new `pairId`) |
| `OK` | both identities valid and equal in `pairId`, `composeProject` and `generation`; both databases present; no journal, or both journals terminal (`committed` or `rolled_back`) with the same `opId` | start |
| `JOURNAL_OPEN` | any journal not terminal (`prepared`, `staged`, `swapping`, `swapped`, `rolling_back`, `rollback_failed`), or the two journals differ in `opId` or state | refuse: "a restore did not finish: run `npm run stack:data-restore -- --recover`" (`rollback_failed`: "do not start; keep both volumes; see the journal and the `.restore-`/`.previous-` folders") |
| `IDENTITY_*` | only one identity; or the identities differ; or a database exists without an identity; or `composeProject` is not this project | refuse; no automatic repair |
| `HALF_PAIR` | exactly one database present | refuse ("the two databases must stay a pair") |
| `UNKNOWN_ENTRY` | an entry that is not allowed (§3) | refuse |

## 6. Legacy bind-folder data (no automatic selection)

The **legacy set** of a service is every present file among `infra/.data/<service>/<db>`, `<db>-wal`, `<db>-shm` and `<db>-journal`.

`stack-up.sh` runs this scan before the preflight:
1. It refuses if any container of this project mounts `infra/.data/lti-service` or `infra/.data/cogniate-app` at `/data` ("an old-layout container runs: stop it first").
2. It reads the legacy sets at rest (no service uses them) and computes size and SHA-256.
3. It reads the volume state with `storage-preflight report` (read-only; it writes no identity).
4. It decides by the table below. Only after a "continue" does it run the preflight in `check` mode, which writes the identities of a `FRESH` pair.

| Legacy sets | Volume state | Result |
| --- | --- | --- |
| both empty | `FRESH` or `OK` | continue with the preflight |
| any present | `FRESH` | **refuse**: "legacy databases found in `infra/.data`. Import them explicitly (`npm run stack:data-import`), or move them out of the checkout. No empty database was made." |
| any present | `OK` with `provenance.kind: import`, and the current legacy files equal `legacySources` exactly (the same names, sizes and SHA-256; nothing added, removed or changed) | continue, with the warning "legacy files are kept for reference and are not used" |
| any present | `OK` with any other provenance, or with a difference to `legacySources` | **refuse**: "legacy databases and volume databases both exist and are not the same import. Move the legacy files out, or replace the volumes explicitly." |
| any | not `OK` or `FRESH` | refuse (§5) |

Explicit import: `npm run stack:data-import -- --from <legacy backup folder>`.
1. It runs only when both services are positively stopped (the existing guard).
2. It runs only when both volumes are `FRESH`. Otherwise it refuses, because an import never overwrites state. To replace volume data on purpose, use `stack:data-restore` (§7), which keeps the previous generation.
3. The legacy backup comes from `npm run stack:data-backup -- --source legacy --out <folder>`. That command reads the legacy sets as one host process at rest, with both services stopped.
4. Before the swap, the import checks the staged app database read-only: every `package.storage_path` must exist under `infra/.data/cogniate-app/packages`, else it refuses `content_missing`. A database is never paired with the wrong content folder.
5. It uses the journal of §7, with `kind: import` and `legacySources` copied from the manifest.

## 7. Backup and the journaled paired restore

### Backup

A backup is complete only when all of these hold:
1. Both services were positively stopped at the start **and** when the copy ends (re-checked; a change → exit 1 and the output folder is marked incomplete).
2. Every database and every present `-wal`/`-shm` file was copied byte-for-byte. The tool never opens a source database for writing and never runs a WAL checkpoint, so the copy is the stopped state as it is. The migration names are read from a scratch copy.
3. The verified copies were re-hashed.
4. `manifest.json` is written **last** (`.tmp`, `fsync`, `rename`).

There is no manifest before step 4, so a folder without a manifest is never a backup.

Rules:
- The manifest keeps `formatVersion 1` and the same file names (`lti-service/lti.db`, …). Added fields: `source` (`volume` or `legacy`), `pairId` (volume source), `generation`.
- The SHA-256 values come only from the backup tool's own reads of the stopped files.
- Volume source: one maintenance container mounts both volumes **read-only** and the host output folder (outside the checkout).
- Legacy source: one host process, as today.
- The backup contains secrets (encrypted rows, hashes): it stays outside the checkout, at mode `0600`, with no `.env` and no private key.

### Restore: states, files and recovery

One maintenance process restores both volumes: both volumes rw, the backup folder read-only, both services positively stopped. Each volume holds a journal `.storage-journal.json`: `{ formatVersion, operation, opId, backupId, manifestSha256, pairIdBefore, generationBefore, state, before: [{name, size, sha256}], after: [{name, size, sha256}], identityBefore, updatedAt }`. The two journals have the same `opId`. A state change is written to the lti journal first, then to the app journal.

| State | Written after | On-disk meaning |
| --- | --- | --- |
| (no journal) | — | step 1 validates the whole backup (existing rules). A failure here → exit 1 "no target changed" (true: nothing was written). |
| `prepared` | both journals hold `before` (current files with SHA-256) and `identityBefore` | no target file changed |
| `staged` | every listed file is copied into `.restore-<opId>/` of its volume, `fsync`ed and verified | no target file changed |
| `swapping` | one volume's swap begins | **in-place files may be mixed** |
| `swapped` | in **each** volume: current files and identity are moved (`rename`) into `.previous-<opId>/`, then the staged files are moved into place | new files in place, old files and old identities kept in `.previous-<opId>/` |
| `committed` | both volumes verified in place against `after`, no unlisted sidecar in place, then the new identity written in each volume (`generation + 1`, provenance, the same `pairId` for a restore, a new `pairId` for an import into `FRESH`) | done |
| `rolling_back` | a failure after `swapping` | old files are being moved back |
| `rolled_back` | every in-place file equals `before` (verified), the old identities are back, `.restore-<opId>/` is removed | the state before the restore, verified |
| `rollback_failed` | a move or a verification failed during the rollback | **unresolved**; both volumes and both folders are kept as evidence |

A restore into `FRESH` volumes (an empty lane) has an empty `before` list, and writes new identities with a new `pairId` (`kind: restore`). A restore into `OK` volumes keeps the `pairId`.

The commit writes, in this order: the lti identity, the app identity, the lti journal `committed`, then the app journal `committed`.

Commit rule:
- The restore is committed only when **both** journals say `committed`.
- `.previous-<opId>/` (the old databases, sidecars, identities and import provenance) stays until both are committed. After that, one previous generation is kept, and older `.previous-*` folders are removed.

Recovery: `npm run stack:data-restore -- --recover`. The startup refusal of §5 names this command. Recovery chooses its action only from the observed state, and every action is idempotent. Before it moves a file, it checks where the file is now (in place, in `.restore-`, in `.previous-`) by name and SHA-256 against `before` and `after`.

| Observed | Action | Result |
| --- | --- | --- |
| both `prepared` or `staged` (or one each) | remove `.restore-<opId>/`; verify in place = `before`; both → `rolled_back` | exit 1 "the restore was cancelled; the targets equal the state before it (verified)" |
| any `swapping`, `swapped` or `rolling_back`, and not both `committed` | roll back **both** volumes: move the `before` files and the old identity from `.previous-<opId>/` into place (or rebuild the old identity from `identityBefore`); move any `after` file out of place into `.restore-<opId>/`; verify in place = `before`; both → `rolled_back` | exit 1 "rolled back (verified)" |
| one `committed`, the other `swapped` (stopped between the two final writes) | re-verify **both** volumes against `after`. If both verify: write the missing identity and journal, both → `committed` (exit 0). If one does not verify: roll back both, as in the row above. | exit 0 or exit 1 (verified) |
| both `committed` or both `rolled_back` | nothing | exit 0, "nothing to recover" |
| a rollback step fails, or a verification after the rollback fails | journal → `rollback_failed`, keep every folder | exit 2: "the rollback did not finish. Do not start. Both volumes and the `.restore-`/`.previous-` folders are kept as evidence." Never "no target changed". |

The same rollback routine runs at once inside a live restore when any step after `swapping` fails. Exit codes:
- `0`: committed;
- `1`: refused before any change, or rolled back with a verified result;
- `2`: unresolved, and the start stays refused.

A terminal journal (`committed`, `rolled_back`) does not block a start. So after a successful recovery the stack can start again; there is no permanent refusal.

Recovery drills: `stack:data-restore --stop-after <state>` exits with code 3 right after it durably writes `<state>`. The values are `prepared`, `staged`, `swapping-lti`, `swapped-lti`, `swapped`, `identity-lti`, `identity-app`, `committed-lti`. It skips no check and leaves the same files that a crash at that boundary leaves. Partial copies, a partial identity `.tmp` and an `fsync` failure are covered by unit tests through the library API.

The existing AC-M1-30 oracles stay true. They read only the six in-place database and sidecar names:
- a damaged backup stops at the "(no journal)" row, and no target changes;
- a valid restore puts the backed-up bytes in place;
- an unlisted target sidecar moves to `.previous-<opId>/`, so it is gone from its place.

## 8. Old-build storage compatibility (bounded exception)

Scope: **only** `b0b83a8289e1bf9cf349068aca184f0879e9aaf0` (released v10; AC-M1-23/30) and `9f96f7b24cd0aed702e4dc40373bdda4307aad31` (populated `011`; AC-M1-38 h1–h5). Both bind-mount SQLite, and their seed and CLI steps run while services run, so they are unsafe on a host where WAL locks fail. This override is the only exception to the phase plan's no-overlay rule. Every design and implementation review must accept it.

| Item | Rule |
| --- | --- |
| Committed files (candidate tree, backend Author) | `infra/compat/storage-compat.knobs.json` (the override, JSON), `infra/scripts/sqlite-lock-probe.mjs`, and `infra/compat/storage-compat.sha256` (the SHA-256 of both files) |
| Injection | The old builds' only override hook: `dc()` in their `infra/scripts/lib.sh` adds `-f .tmp/compose.knobs.yaml` to every compose call. `npm run stack:storage-compat -- enable` (candidate tree) copies the override to `.tmp/compose.knobs.yaml` and the probe to `.tmp/storage-compat/sqlite-lock-probe.mjs`. `.tmp/` is git-ignored and survives `git checkout --force`. `disable` removes both. |
| No silent knob loss | `enable` refuses when `.tmp/compose.knobs.yaml` already exists ("test knobs are active: restore the defaults first"). It never merges. An old route that needs a knob cannot run with the override, and is `BLOCKED`. |
| Hash checks (before every old-build step) | The SHA-256 of `.tmp/compose.knobs.yaml` and of the probe copy must equal `infra/compat/storage-compat.sha256` **of the frozen candidate**. The harness also recomputes them from the candidate tree. A stale or wrong file → `BLOCKED`. |
| Old source | The old checkout is the exact SHA, clean (`git status` shows no tracked change); the old tracked product source is unchanged. |
| Allowed effective-config changes | For each profile that a step uses (default; acceptance for `test:acceptance` and the `011` seed), compare `C0` = `docker compose config --format json` of the old checkout without the override and `C1` = with it. After normalizing key order, `C1 − C0` may contain **only**: (a) in `services.lti-service.volumes`, the entry with target `/data` changes from `bind` `<checkout>/infra/.data/lti-service` to `volume` `ltidb`; (b) in `services.cogniate-app.volumes`, the `/data` entry changes from `bind` `<checkout>/infra/.data/cogniate-app` to `volume` `appdb`, plus two new `bind` entries `<checkout>/infra/.data/cogniate-app/packages` → `/data/packages` and `…/uploads` → `/data/uploads`; (c) top-level `volumes` adds `ltidb` and `appdb`; (d) a new service `storage-preflight` with profile `storage` and exactly the fields of §4. Any other difference (environment, image, command, ports, networks, depends_on, other services) → `BLOCKED`. |
| Commands of the old routes | Allowed: old `npm run stack:up`, old `npm run seed`, old `npm run test:acceptance` (its two `stack:up` calls keep the knobs file), old in-container CLIs through `dc exec`, public API calls, the harness's `docker compose stop cogniate-app lti-service`, and `dc --profile storage run --rm storage-preflight`. **Forbidden:** old `stack:restart` (it rewrites `services.<svc>` in the knobs file and would drop the override), old `stack:reset` before the route ends, and any compose `up`, `create` or `run` of a service without the knobs file. |
| Mount checks | Before the first old step and after **every** old step: `docker inspect` of the running `lti-service` and `cogniate-app` must show `/data` as the volume `<project>_ltidb` / `<project>_appdb`, the two nested binds for the app, and no bind at `/data`; and the override hash still equal. Else `BLOCKED`. |
| Preflight | before each old `stack:up`: `dc --profile storage run --rm storage-preflight` must exit 0 |
| Rollback | The route restores into the **volumes** (§7), enables the override, checks out the old SHA, runs the preflight and starts. **No route and no documented procedure returns live data to a bind folder.** |
| Candidate guard | The candidate's `stack-up.sh` refuses while `.tmp/compose.knobs.yaml` holds the storage-compat marker ("run `npm run stack:storage-compat -- disable`"). |
| Evidence qualifier | Every old-build row keeps its label (`MOODLE-LIVE` or `SIM`) and adds: "old build `<sha>` with tracked product source unchanged and the storage-compatibility override (`compose.knobs.yaml` SHA-256 `<h1>`, probe SHA-256 `<h2>`), which changes only the effective-config items (a)–(d) of ADR-012 §8". It never says "unchanged old infrastructure". The old `warn_knobs` "CAUTION: test knobs are active" line is expected and recorded. `/healthz` shows `"knobs":[]`, because the override sets no environment. |

Old and new builds use the **same** volumes, so the two routes need no import step.

## 9. Ownership and interfaces

| Owner | Files |
| --- | --- |
| Backend Author (owns `infra/**`) | `infra/compose.yaml` (volumes, nested binds, `storage-preflight`, a `maintenance` service for backup, restore and import); `infra/scripts/sqlite-lock-probe.mjs` (new) and its unit test; `infra/scripts/stack-up.sh`, `stack-restart.sh` (§4, §6, candidate guard); `infra/scripts/stack-data.sh`, `stack-data.mjs`, `lib.sh` (container execution, `--source legacy`, `stack:data-import`, the journal and `--recover`/`--stop-after`); `infra/compat/*` and the `stack:storage-compat` script; root `package.json` scripts; `infra/README.md`; `services/lti-service/src/cli/stack-data.test.ts` (new cases; existing assertions unchanged) |
| Product code | none |
| Independent common QA (currently Claude, per the Lead) | `tests/host/m1-migration.mjs` (read snapshots and ledgers through a read-only one-shot copy of the volumes; the stale-sidecar fixture through the maintenance container; the §8 checks in every old phase); `tests/host/p5-fixture.mjs` (the bounded P5 edit in a one-shot container after the existing app stop); `tests/host/run-t1.mjs` (the information-only `**/.data` scan no longer sees database bytes; note it); the AC-M1-41 cases. Every existing assertion stays. |
| Architect | this ADR, ADR-006, `local-stack.md`, ADR-011 §14, M1, M3 |
| Docs (M4) | operator guide: import, backup, restore, recovery, rollback with the override |

## 10. Assumptions for the build step (to verify, not claimed)

1. Docker creates the mountpoint folders of nested binds inside a named volume, and mounts the parent first.
2. A new empty named volume mounted at a path that the image lacks is `root:root`.
3. `docker compose run --rm` of a profiled one-shot service works with the project's `--env-file` and `-f` arguments, in both the candidate and the old builds.
4. `docker compose config --format json` gives stable, comparable output for the allow-list of §8.
5. `rename` within one volume is atomic, and `fsync` of the folder is supported.
6. Whether `up --wait` accepts a `service_completed_successfully` dependency (§4, optional guard only).

## 11. Consequences

- Concurrent CLI and service access is safe wherever the preflight passes. Wherever it fails, the stack refuses to start, with a clear reason.
- Database files are no longer plain files in the checkout. Read them only through the maintenance container.
- Existing bind installations need one explicit import.
- Old builds need the override, with its caution line.
- The released-v10 and `011` evidence rows carry the §8 qualifier.
