# Local stack (infra)

The local stack is a copy of production in Docker: Moodle 5.2.4 behind TLS, four host names on three sites, and the two Node services. Design: `docs/architecture/local-stack.md` and `docs/architecture/adr/ADR-005-local-topology-tls-cookies.md`.

| Host name (`.env`) | Container | Site (for cookies) |
| --- | --- | --- |
| `PUBLIC_MOODLE_URL` = `https://moodle.test` | `moodle:8080` (Moodle 5.2.4, PostgreSQL 16) | `moodle.test` |
| `PUBLIC_LTI_URL` = `https://lti.cogniate.test` | `lti-service:4100` | `cogniate.test` |
| `PUBLIC_APP_URL` = `https://app.cogniate.test` | `cogniate-app:4200` | `cogniate.test` |
| `PUBLIC_CONTENT_URL` = `https://content.cogniate-content.test` | `cogniate-app:4201` | `cogniate-content.test` |

Only the proxy (Caddy) publishes a port: `127.0.0.1:443`. Moodle 8080 and PostgreSQL 5432 are not published.

## Requirements

- Docker Desktop (about 4 GB free memory is enough), Node 24, npm, `openssl`, `bash`.
- Images (pulled by the first `stack:up`): `erseco/alpine-moodle:v5.2.4`, `postgres:16-alpine`, `caddy:2.11.7-alpine`, `node:24.22.0-alpine3.24`. The test image `cogniate-stack-e2e:1.56.0` is built from `mcr.microsoft.com/playwright:v1.56.0-noble`.

## Quick start

```sh
npm ci
npm run stack:doctor    # checks this computer first: Docker, memory, port, subnet, certificates, images, course zips
npm run demo            # gen-env, build, stack:up, seed. Prints the URLs and user names.
npm run demo:prepare    # optional: connects Moodle, publishes both courses, adds both activities (about 10 s)
npm run demo:users      # the URLs, the user names and where their passwords are
npm run demo:browser    # opens a throwaway Chrome profile that can reach the stack
```

The passwords are in `.env` and in `infra/.secrets/seed.json` (`demo:users` names the variables; it never prints a password).

First run: the first `npm run stack:up` downloads about 2.3 GB of images. Then the first Moodle install takes about 30 s, and `seed` a few seconds. The first test run also builds the test image (about 3.6 GB), and the first `.mbz` build makes the Build Runner image (about 20 s). Later starts take seconds. The services run the host `node_modules` inside Alpine containers, so service run-time packages must be pure JavaScript.

## Commands

All commands run from the repo root.

| Command | When to use it | Deletes | Keeps |
| --- | --- | --- | --- |
| `npm run gen-env` | First run, or after you change `PUBLIC_PORT`. `stack:up` runs it for you. | nothing | Existing secrets. It adds missing secrets, writes the four URLs, and makes `infra/.certs/` if missing. |
| `npm run stack:up` | Start the stack. It waits until every service is healthy. `STACK_PROFILE=acceptance npm run stack:up` starts the acceptance profile (see "Acceptance profile"); `npm run stack:up` without `STACK_PROFILE` restores the default. Only changed services restart. | nothing | everything |
| `npm run seed` | After `stack:up`. You can run it again at any time (idempotent). | nothing | everything. It updates Moodle settings, users, courses and tokens, makes the LTI tool accounts `cogniate` and `qa-second` (API keys in `infra/.secrets/lti-api-key.<account>`), makes the portal users of the Cogniate app (`thanh@cogniate.test`, `qa-b@cogniate.test`), and rewrites `infra/.secrets/seed.json` (other keys, such as `ltiSeed`, are kept). |
| `npm run seed:lti-manual` | After `seed`: a launchable dev setup without UI. Idempotent. | nothing | everything. Makes the Moodle tool "Cogniate (seed)", the activities "Seed activity" (101) and "Seed activity 102" (102), registers the platform in the LTI service (`POST /api/platforms`; a deleted platform is made again), and writes `ltiSeed` to `seed.json`. |
| `npm run lti:bootstrap -w services/lti-service -- --account <id> --name <name> [--rotate-api-key] [--rotate-signing-key]` | Make or update one LTI tool account (contract §7). | nothing (a rotated key replaces the old key) | everything. A new or rotated API key is printed once and written to `infra/.secrets/lti-api-key.<account>` (mode 600). |
| `npm run demo` | One command for a human demo: `npm ci` (if needed), gen-env, build, stack:up, seed. | nothing | everything |
| `npm run demo:browser` | Look at the stack in Chrome without any change to your Mac. | nothing | A throwaway profile in `.tmp/demo-browser-profile` (delete it any time). |
| `npm run stack:down` | Stop the containers. | containers | volumes (Moodle site, database), `.env`, certificates, `infra/.secrets`, `infra/.logs` |
| `npm run seed:lti-activity -- --type <typeId> --course <shortname> --name <name> --url <toolUrl>` | T4b2 dev helper: add one External tool activity without the Moodle UI (QA AC-T4-18 "QA foreign"). Idempotent by name: a rerun updates the tool type and URL. | nothing | the activity (grade maximum 100, accept grades on). Prints `{cmid, instanceid, courseid, typeid, launchurl}`. |
| `npm run stack:reset` | Start again with an empty Moodle site and an empty LTI service. Then run `stack:up`, `seed` and `seed:lti-manual`. | volumes (Moodle site, database, and the SQLite volumes `<project>_ltidb` and `<project>_appdb`), the old bind folder `infra/.data/lti-service/`, every entry of `infra/.data/cogniate-app/` (the folder stays, empty; with the package store), `infra/.secrets/seed.json`, `infra/.secrets/lti-api-key.*`, `infra/.logs/`, `infra/.data/backups/`, test knobs, the saved stack profile | `.env` (same passwords), `infra/.certs/` (same CA), `infra/.data/fixtures/`. It refuses a project that belongs to another checkout, and without `.env` it needs an explicit `COMPOSE_PROJECT_NAME`. |
| `npm run stack:restart -- <service> [--env K=V ...]` | Restart one service with test knobs (registered knobs only). Without `--env`, the defaults come back. | The knobs of that service (when you restore the defaults) | everything else |
| `npm run stack:logs [-- <service>...]` | Follow the container logs. | nothing | everything |
| `npm run stack:moodle-reach-check` | Check that Moodle's own HTTP client reaches the LTI service (curl security + CA), and that seven other targets stay BLOCKED. Host rule (https, port 443): metadata IP, loopback, `10.0.0.0/8`, the Docker Desktop host, another Docker range. Port rule: port 80, the database port. Exit 1 if one is ALLOWED. | nothing | everything |
| `npm run stack:node-reach-check` | Check that `lti-service` and `cogniate-app` reach Moodle over HTTPS (Node trusts the CA). | nothing | everything |
| `npm run fixtures:check` | Check the two course zips (they are not in git). | nothing | everything |
| `npm run test:acceptance` / `npm run test:e2e` | Run the QA suites in the e2e container. `test:acceptance` switches to the acceptance profile first and restores the default at the end, also after a failure or Ctrl+C. `test:e2e` (T7) runs `e2e:reset` first (default profile, no knobs) and checks the clean state again at the end; artifacts go to `tests/e2e/artifacts/` (see [Debug a failed E2E step](#debug-a-failed-e2e-step)). **It deletes all stack data first**: it prints a warning, and in a terminal it asks you to type `yes`. `npm run test:e2e -- --yes` or `E2E_CONFIRM=1` skips the question (QA runners and CI). Without a terminal and without the flag it stops and deletes nothing. `E2E_RESET=0` skips the reset (debugging only). | `tests/node_modules` (`npm ci`); with `test:e2e` also all stack data (see `e2e:reset`) | everything else |
| `npm run e2e:reset [-- --yes]` | T7: a clean stack for the E2E suite and the demo, in about 1 min. Idempotent. **It deletes all stack data**: it prints a warning, and in a terminal it asks you to type `yes` (`--yes` or `E2E_CONFIRM=1` skips the question). Without a terminal and without the flag it stops and deletes nothing. It builds the player and the portal, runs `stack:reset`, `stack:up` (default profile, no knobs) and `seed`, then waits until every `/healthz` shows `"profile":"default"` and `"knobs":[]`, the portal page answers and the Moodle admin can log in. | everything that `stack:reset` deletes | what `stack:reset` keeps |
| `npm run demo:prepare [-- --no-verify]` | T7: Scenario A by API and CLI, on a fresh `e2e:reset` (about 10 s): Thanh's dynamic connection "Dev Moodle" (registration and Connect without a browser), the tool activated ("Show in activity chooser", "New window"), both course zips uploaded and published, both activities in `COGNIATE-DEV-101` with grade 100 and completion "Receive a grade". Then `cg_teacher` opens both activities (a preview, no learner data). Prints the users and the activity URLs. It refuses a second run (run `e2e:reset` first). When a step fails, it prints "Step N failed. Moodle said:" (or "The portal step said:") and the last 10 lines of the output, with the secrets removed. | nothing | everything |
| `npm run build-runner` | T8 (stretch): the host-side Build Runner in the foreground (`stack:up` starts it in the background and checks that it really runs; log: JSON lines in `infra/.logs/build-runner.jsonl`, heartbeat `infra/.data/build-queue/status/runner.json`). It takes build requests from `infra/.data/build-queue/requests/`, starts a throwaway Moodle in its own compose project `cogniate-build-<id>` (internal network, no internet, own Postgres, image `cogniate-build-moodle:v5.2.4` built once from `infra/build-runner/Dockerfile`), makes the hidden course with one SCORM activity, backs it up without users, takes the `.mbz` out with `docker cp` (no writable host folder; a symlink or a non-gzip file is refused), writes it to `infra/.data/build-queue/out/` and removes the project and its volumes. A request file must be a regular file of this user (no symlink, FIFO, device or directory; anything else is rejected, removed, and its build is marked failed at once). The package zip is copied from the upload store without following a symlink, and the copy must have the sha256 of the request. A stop during a build (`stack:down`, Ctrl+C) tears the build down and marks it failed; at start, and on `stack:reset`, this stack's leftover `cogniate-build-*` items (label `org.cogniate.stack=<COMPOSE_PROJECT_NAME>`) and work folders are removed, and an interrupted build is marked failed. Other stacks on the same Docker host keep their builds. Only one runner runs at a time (lock file `infra/.data/build-queue/.runner.pid`); a second one stops with a clear message. The app fails a build with no progress for 10 min, so a new request starts a fresh build; one library may have at most 2 builds waiting or running. Docker is used only here, never in a container: the app may only write requests and read status and `.mbz` files. Knobs `BUILD_RUNNER_HOLD=1` (wait before teardown until `infra/.data/build-queue/hold/<buildId>` is removed) and `BUILD_RUNNER_FAIL_AT=<step>` (`npm run stack:restart -- cogniate-app --env ...`). | the build projects it made | everything else |
| `npm run stack:doctor` | Before the first start, or when something does not work. One line per check (OK, FIX with the exact fix, or INFO): Docker running and its memory, Node.js and the npm packages, `.env` and its URLs, the certificates (names and days left), port `PUBLIC_PORT`, subnet `STACK_SUBNET`, the images (incl. the Build Runner image), the two course zips, and (when the stack is up) the health of each service, the Build Runner, test knobs, the profile and the seed. Exit 1 if a check needs a fix. | nothing | everything |
| `npm run demo:users` | The demo URLs, the Moodle and portal user names with their roles, and the `.env` variable that holds each password (it never prints a password). With the stack up, it also lists the Cogniate activities in Moodle. | nothing | everything |
| `npm run moodle:cron` | T7 fallback (H13): run the Moodle cron once, for example when a report or the completion state waits for it. | nothing | everything |
| `npm run check` | Lint, type check, unit tests and the infra host tests (`npm run test:infra`: `infra/scripts/*.test.mjs`, no Docker). | nothing | everything |
| `npm run stack:data-backup -- --out <folder> [--source legacy]` | M1 upgrade (ADR-011 §14, ADR-012 §8): with `cogniate-app` and `lti-service` STOPPED. The folder must be new and outside the checkout (it holds secrets). Default: the two SQLite volumes (the pair state must be `OK`). `--source legacy`: the old bind folders `infra/.data/lti-service` and `infra/.data/cogniate-app` (read only), before an import. | nothing | everything. See [SQLite storage](#sqlite-storage-adr-012). |
| `npm run stack:data-restore -- --from <folder>` | M1 rollback: restore a volume backup into the volumes, with both services STOPPED. **Every write after the backup is lost.** | the current databases (they move to `.previous-<opId>/` in each volume) | everything else. It validates the whole backup first; any failure: exit 1 and no change. See [SQLite storage](#sqlite-storage-adr-012). |
| `npm run stack:data-restore -- --recover` | After a restore or an import that did not finish (`journal_open`). | as the journals decide (R0–R6) | everything that the journals do not name |
| `npm run stack:data-import -- --from <folder>` | Put a legacy backup (`--source legacy`) into an empty (`FRESH`) volume pair. | nothing | everything |
| `npm run stack:data-quarantine -- --out <folder>` | The exit from `rollback_failed`, `journal_inconsistent` or a refusal that you cannot repair. It copies both volumes first. | the stopped `lti-service` and `cogniate-app` containers and the two SQLite volumes (after a verified copy) | the copy in `<folder>` |
| `npm run stack:storage-compat -- enable\|disable` | Run one of the two old builds on the volumes (ADR-012 §12). | `disable`: the override and its copies | everything else |
| `npm run lti:shared-platform -w services/lti-service -- --account cogniate --profile blackboard --client-id <Application ID> [--name "Cogniate"]` | M1 operator step (once per LTI host): make the shared Blackboard platform. Host command: `docker compose --project-directory infra -p "<project-name>" -f infra/compose.yaml --env-file .env exec -T --workdir /repo lti-service npm run lti:shared-platform -w services/lti-service -- --account cogniate --profile blackboard --client-id <Application ID>`. | nothing | everything. Prints `{platformId, created}`; the same client id again changes nothing; another client id: exit 1. |
| `npm run app:grant -w services/cogniate-app -- issue\|revoke\|list …` / `npm run app:binding -w services/cogniate-app -- suspend\|release …` | M1 operator approval grants and binding containment (app contract §4.8, §4.9); not reachable over HTTP. Host example: `docker compose --project-directory infra -p "<project-name>" -f infra/compose.yaml --env-file .env exec -T --workdir /repo cogniate-app npm run app:grant -w services/cogniate-app -- list --connection <con_id>`. `issue` prints the approval code once. | nothing local except what the command states | everything else |

Run these two operator examples on the host, in the repository folder. Replace `<project-name>` with `COMPOSE_PROJECT_NAME` from the root `.env`. Use the same Compose prefix for other `app:grant` and `app:binding` operations.

M1 CLI QA uses `exec -T --workdir /repo` with these npm workspace selectors ([helper](../tests/host/m1-control.mjs), [QA record](../docs/reviews/M1/qa.md)) [SIM AC-M1-28, AC-M1-38, M1-06.blackboard.cli]. The project and file flags follow the existing [Compose helper](scripts/lib.sh).

Advanced helpers in `infra/scripts/`:

- `moodle-php.sh <script|-r code>`: run PHP in the Moodle container as `nobody`.
- `moodle-cfg.sh --name=X [--set=Y]`: read or set a Moodle setting with `admin/cli/cfg.php`.
- `e2e-run.sh <command>`: run a command in the e2e container. Example: `infra/scripts/e2e-run.sh node infra/e2e/smoke.mjs`.
- `stage-fixture.sh <zip> <name.zip>`: copy a zip to `infra/.data/fixtures/` for Moodle.
- `moodle-backup.sh <courseid> [--nousers]`: make an `.mbz` in `infra/.data/backups/`.

## SQLite storage (ADR-012)

The two SQLite databases are in project volumes. The course content stays on the host.

| Path in the container | Storage |
| --- | --- |
| `lti-service` `/data` | volume `<project>_ltidb`: `lti.db` (with `-wal`, `-shm`) |
| `cogniate-app` `/data` | volume `<project>_appdb`: `cogniate.db` (with `-wal`, `-shm`) |
| `cogniate-app` `/data/packages`, `/data/uploads` | host folders `infra/.data/cogniate-app/packages`, `…/uploads` |

- The scripts make the host folders with mode `0700`. They never `chown` a host folder. A symbolic link, a file, or a folder of another user at one of these paths stops the command (`content_path_unsafe`). Nothing changes.
- Each volume also holds `.storage-identity.json` (pair id, generation, first start, provenance, legacy sources). A restore or an import writes `.storage-journal.json`, `.restore-<opId>/` and `.previous-<opId>/`. Do not edit these files.
- Cleanup (ADR-012 §15):
  - `stack:down` keeps the volumes.
  - `stack:reset` deletes both volumes, the old bind folders and the content folders of this project.
  - `docker volume prune` (without `--all`) deletes only unused anonymous volumes, so it keeps these volumes.
  - `docker volume prune --all` deletes every unused named volume: these databases and the Moodle volumes too.
  - `docker system prune --volumes` deletes only anonymous volumes, so it keeps these volumes.
  - Docker Desktop "Clean / Purge data" deletes every volume.

### Start check (preflight)

`stack:up` and `stack:restart` run the storage preflight before a service starts. It runs in a one-shot container (`storage-preflight`, profile `storage`, no network). It reads both volumes, finds the start state, and tests a real SQLite WAL lock with two processes on each volume. A refusal stops the command with exit 1.

| Code | What to do |
| --- | --- |
| `journal_open` | A restore or an import did not finish. Run `npm run stack:data-restore -- --recover`. |
| `rollback_failed`, `journal_inconsistent`, `state_unclassified` | Do not start. Keep both volumes. Run `npm run stack:data-quarantine -- --out <folder>`. |
| `legacy_present` | Old databases are in `infra/.data/lti-service` or `infra/.data/cogniate-app`, and the volumes are empty. Import them (`stack:data-backup -- --source legacy`, then `stack:data-import`), or move them out of the checkout. |
| `legacy_conflict` | Old databases and volume databases both exist, and they are not the same import. Move the old files out of the checkout. |
| `old_layout_container` | A container still mounts an old bind folder at `/data`. Run `npm run stack:down`. |
| `lock_not_enforced`, `probe_error` | The SQLite lock does not work on this storage (only the extended code 5 counts as a lock), or the test holder ended or answered wrongly. Do not start. |
| `timeout` | A probe wait (10 s) or the whole run (60 s) elapsed. The run then writes one `storage_preflight` line per volume and the summary last. |
| `unknown_entry`, `mountpoint_unsafe`, `owner_mismatch`, `identity_*`, `half_pair`, `no_databases`, `db_without_identity` | The message names the path or the state. Do not start until the cause is clear. |

- `prepare_failed` (a root step failed) comes after any state code in the list of reasons.
- Log: `infra/.logs/storage-preflight.jsonl`. Each run writes one `storage_preflight` line per volume, then one `storage_preflight_summary` line.
- The `report` mode (the legacy scan of `stack:up`) also writes one `storage_report_identity` line per valid identity, before the summary: `{event, ts, runId, folder, pairId, generation, firstStart, provenanceKind, legacySources: [{name, size, sha256}]}`. It holds identity data only, never file content. It is never a `storage_preflight` line.

### The operation lock

These commands hold one lock for the whole command: `stack:up`, `stack:restart`, `stack:reset`, every `stack:data-*`, and `stack:storage-compat -- enable` or `disable`. The lock is the folder `.tmp/storage-op.<project>.lock/` with `owner.json` (one checkout, one project). `test:acceptance` and `e2e:reset` take no lock of their own; the commands that they start take it.

| Message | Meaning and next step |
| --- | --- |
| `operation_in_progress` | Another storage command holds the lock. The command waits up to 120 s, then stops. A lock stays live while any process of its process group runs (for example a Docker client). Wait for it, or end it. |
| `operation_lock_reentry` | A guarded command started inside another one. Run the commands one after the other. |
| `storage_writer_active` | A storage container of the project still runs. Wait until it ends, or run `docker stop <name>`. |
| `operation_lock_invalid` | The lock folder has no valid record for 10 s. The message says "Follow the manual exit of the operator guide". In this prototype the manual exit is: stop and escalate. No validated manual recovery procedure exists. Do not remove or move the lock folder. Send the message and folder name to the engineering owner ([operator guide](../docs/guides/operator.md#43-storage-lock-messages)). |

- A lock of a command that ended is taken over (`storage_lock_reclaimed`). The old record stays in `.tmp/storage-op.<project>.stale-<runId>/`.
- Log: `infra/.logs/storage-lock.jsonl`. Self-check without Docker: `bash infra/scripts/storage-oplock.sh selftest`.
- QA fixture writes: `bash infra/scripts/storage-oplock.sh run -- <command>`.

### Backup, restore, import, recovery

Every `stack:data-*` command first takes the candidate guard and the lock. Then it checks that `cogniate-app` and `lti-service` are stopped (exited, created, dead or absent). Then one `maintenance` container (name `<project>-storage-<runId>`, label `org.cogniate.storage.run=<runId>`, no network) does the work.

- **Backup** (`stack:data-backup`): the volumes are read-only. The manifest is written last (`source: "volume"`, `pairId`, `generation`, `legacySources`). A service that starts during the copy marks the folder `INCOMPLETE`. That folder is not a backup.
- **Restore** (`stack:data-restore`): the checks come in this order: the whole backup, the target state, the backup source, the pair. A target `OK` of the same pair gets `generation + 1`. A `FRESH` target takes the pair of the backup. Another pair: `pair_mismatch` (quarantine first). Any other target state: `restore_target_state`, with the next step.
- **Import** (`stack:data-import`): only a legacy backup, only into a `FRESH` pair (`import_target_not_fresh`). It makes a new pair, generation 1.
- A restore and an import write a journal in each volume: `prepared`, `staged`, `swapping`, `swapped`, `committed`. Before the first journal write, a content check makes sure that every `package.storage_path` exists under `infra/.data/cogniate-app/packages` (else the command exits 1 with `content_missing`, writes no journal and changes nothing). The current files move to `.previous-<opId>/`. One previous generation is kept.
- **Recovery** (`stack:data-restore -- --recover`) reads only the journals and the file locations. It finishes a cut commit, or rolls back both volumes. It never overwrites a file that it does not know (`rollback_failed`).
- Exit codes: `0` done; `1` refused before a change, or cancelled or rolled back (verified); `2` not resolved (do not start, keep both volumes, quarantine); `3` stopped by a drill.
- Drills (QA only, `STORAGE_DRILL=1`): `--stop-after <point>` or `--pause-after <point>` (with `STORAGE_DRILL_PAUSE_SECONDS` from 1 to 300). Points: `prepared-lti`, `prepared`, `staged`, `swap-lti-mid`, `swapped-lti`, `swap-app-mid`, `swapped`, `identity-lti`, `identity-app`, `committed-lti`, and `rollback-mid` (only with `STORAGE_DRILL_FAIL=after-swapped`).
- Log: `infra/.logs/storage-maintenance.jsonl` (for example `storage_content_check`, `storage_backup`, `storage_recover`, `storage_quarantine`).
- A coded refusal (exit 1, nothing changed) prints one JSON line `{"event":"storage_refused","ts","command","code",…}`. Then it prints the human text on stderr.
  - The JSON line goes to stdout. Exception: the folder refusals `backup_folder_in_checkout` and `backup_folder_not_empty` (backup and quarantine) write it to stderr. So read both streams.
  - The line has the code, for example `pair_mismatch`, `restore_target_state`, `backup_source_not_ok:<state>`, `content_path_unsafe`, `old_layout_container` or `volume_in_use`.
  - Its other fields are safe: a §6 `state`, an `entry` or `path` relative to its root, `reasons` (`prepare_failed`), and the lock `runId` (shell helper lines).
  - For a container, the line has `container` (the name) and `id`. It adds `mount` (`old_layout_container`), or `project`, `service` and the container `state` (`volume_in_use`).
  - The line never holds the message text, raw command output or an absolute host path.
- Some safe stops have no code. They print text on stderr only, exit 1 and write no JSON line:
  - the service-stop check: Docker does not answer, or `cogniate-app` or `lti-service` is not stopped (nothing changed);
  - the candidate guard: the storage-compatibility override is enabled (nothing changed);
  - the `stop now:` lines of the old-build wrapper;
  - a service started during a backup: the folder is marked `INCOMPLETE` and is not a backup;
  - the quarantine stops (`Quarantine stopped: …`): the text names what was removed and what stays.
- Backup and the quarantine copy only read the volumes. They do no root step (§4) and switch to the host user at once. An item that the next `stack:up` prepares (the root folder owner or mode, an absent or root-owned mountpoint) is listed as `unprepared` in their output line. An entry that the host user cannot read stops them with `source_unreadable` (exit 1, no manifest; quarantine removes nothing).

WARNING: a restore loses every write after the backup. A backup holds secrets (encrypted rows, hashes): keep it outside the checkout. `stack:reset` is never a recovery step.

### Quarantine

`npm run stack:data-quarantine -- --out <folder outside the checkout>`:
1. It copies every entry of both volumes into the folder and verifies the copy (manifest last).
2. It finds every container, in any state, that uses one of the two volumes.
3. It removes only the stopped `lti-service` and `cogniate-app` containers of this project (`docker rm`, never `-f`, never `-v`). Any other user (a one-off container, another project or service, a running container) stops it with `volume_in_use`. Then nothing is removed, and the copy stays.
4. It removes both volumes.
5. It writes `quarantine.json` in the folder and one line in the log.

The lane is then `FRESH`. Restore a known backup into it, or import.

### Old builds (storage-compatibility override)

This applies only to the old builds `b0b83a8` and `9f96f7b` (ADR-012 §12).
1. In the candidate tree, before `git checkout <old>`: `npm run stack:storage-compat -- enable`. It copies `infra/compat/storage-compat.knobs.json` to `.tmp/compose.knobs.yaml`, and the probe, the runner and the lock helper to `.tmp/storage-compat/`. Then it checks every hash against `infra/compat/storage-compat.sha256`. It refuses when test knobs are active.
2. In the old checkout: `bash .tmp/storage-compat/storage-compat.sh run -- npm run stack:up` (or `npm run test:acceptance …`). Any other command stops with `wrapper_command_not_allowed`. The wrapper runs only when `HEAD` is one of the two old builds (`wrapper_old_only`). Steps: hash check, lock, hash check, preflight, the command, the mount check, release. A failed check: exit 1, "stop now".
3. `bash .tmp/storage-compat/storage-compat.sh preflight`, `… status` and `… disable` do one step each.

The command rule while the override is enabled (ADR-012 §12). Do not run an old command that creates, recreates, starts or restarts a service container, or that deletes or rewrites `.tmp/compose.knobs.yaml`. Such a command can start a service without the override, on an empty bind folder.

| Allowed | Forbidden |
| --- | --- |
| `git checkout` of the two old builds; the frozen test install; old `npm ci`, `npm run build`, `npm run gen-env` (it keeps an existing `.env`); `docker compose … config`; `docker compose … exec` and `stop` | old `npm run stack:restart`, `stack:reset`, `e2e:reset`, `test:e2e`, `demo`, `demo:prepare`, `demo:users`, `demo:browser` |
| old `npm run stack:up` and old `npm run test:acceptance …`, **only** through `bash .tmp/storage-compat/storage-compat.sh run -- …` | any `docker compose up`, `create`, `run`, `start` or `restart` of a service without the knobs file |
| old `npm run seed` (it uses `exec` only); old `npm run stack:down` (it keeps the volumes and the knobs file); the copied `storage-compat.sh run`, `preflight` and `status` | every candidate start or database command (the candidate guard stops it); the QA host-control actions `m1-restart` and `m1-profile` |

While the override is enabled, every candidate start or database command stops: run `npm run stack:storage-compat -- disable` first. When you change one of the four files, write `infra/compat/storage-compat.sha256` again (`npm run test:infra` checks it).

## Configuration

- `.env` (made by `npm run gen-env`, mode 600, git-ignored) has two parts:
  - Generated secrets: database password, Moodle passwords, and master keys.
  - Public config: `PUBLIC_PORT` and the four `PUBLIC_*_URL` values.
- The four URLs are the only source of public URLs. Compose passes them to every container. Code reads them with `loadPublicUrls()` from `@cogniate/shared`. Do not write URL literals in code.
- To change the port: set `PUBLIC_PORT=8443` in `.env`, run `npm run gen-env`, then `npm run stack:up`. Every URL then ends in `:8443`, and seed adds the port to Moodle's allowed ports.
- Optional variables (not in `.env` by default):
  - `COMPOSE_PROJECT_NAME`: default `cogniate-stack`. Use another name for a second checkout (for example a QA clone). Volume names use it.
  - `STACK_SUBNET`: default `172.28.0.0/16`. It must be inside a private range of Moodle's default blocked list (`10.0.0.0/8`, `172.16.0.0/12` or `192.168.0.0/16`); seed cuts only this subnet out of that list.
  - `COURSE_FIXTURES_DIR`: default `docs/raw/data/courses`.

All state is inside the checkout: `.env`, `infra/.certs/`, `infra/.secrets/`, `infra/.logs/`, `infra/.data/`, `.tmp/`. The only exception is the Docker volumes `<project>_pgdata`, `<project>_moodledata`, `<project>_ltidb` and `<project>_appdb`.

## TLS and trust

`npm run gen-env` runs `infra/scripts/gen-certs.sh` before any container starts:

| File | What | Who uses it |
| --- | --- | --- |
| `infra/.certs/ca.key` | Dev CA private key (mode 600) | Only `gen-certs.sh`. It is never mounted into a container. |
| `infra/.certs/root.crt` | Dev CA certificate: 365 days, `nameConstraints = critical, permitted;DNS:test` (it can sign only `.test` names) | Moodle (`seed` writes `moodledata/moodleorgca.crt` = Alpine CA bundle + this root), Node (`NODE_EXTRA_CA_CERTS=/certs/root.crt`), Playwright Chromium (NSS database, `infra/e2e/entrypoint.sh`) |
| `infra/.certs/stack.crt`, `stack.key` | One leaf certificate, SAN = the four host names, 90 days, never after the CA end date | The proxy only |
| `infra/.certs/qa.crt`, `qa.key` | Second leaf, SAN = `evil.test`, `qa-platform.test` (acceptance profile), same rules. The stack leaf does not change for it. | The `sink` and `qa-platform` containers only |

`stack:reset` does not delete `infra/.certs/`. `gen-certs.sh` makes a new leaf only if the leaf is missing, expires in less than 30 days, or does not match the names or the CA. To start a new CA, delete `infra/.certs/` and run `npm run gen-env`.

In the e2e container, only the browser (NSS) and Node trust the CA. `curl` does not, so `curl https://moodle.test` fails and `curl --cacert /certs/root.crt https://moodle.test` works.

## Your own browser

`npm run demo:browser` starts Chrome with a new profile in `.tmp/demo-browser-profile`. It uses two flags:

- `--host-resolver-rules="MAP *.test 127.0.0.1, MAP *.cogniate-content.test 127.0.0.1"`: the stack names resolve to 127.0.0.1 in this browser only.
- `--ignore-certificate-errors-spki-list=<hash of the stack leaf key>`: this browser accepts only our leaf certificate. Other certificate errors still show.

Nothing changes on your Mac. Set `CHROME_BIN=/path/to/chrome` if Chrome is not in `/Applications`.

For your daily browser (optional, not needed for tests):

1. Add `127.0.0.1 moodle.test lti.cogniate.test app.cogniate.test content.cogniate-content.test` to `/etc/hosts`.
2. Optional: trust `infra/.certs/root.crt` in the login keychain.

CAUTION: A trusted root lets every certificate signed by `infra/.certs/ca.key` pass on your Mac. The name constraint limits this to `.test` names: a certificate for any other name (for example `example.com`) fails, even with the trust. Keep `ca.key` private anyway, and remove the trust when you finish. When `gen-certs.sh` makes a new CA (old CA without the constraint, or less than 30 days left), it prints a CAUTION: trust the new `root.crt` again.

## Moodle provisioning (`npm run seed`)

| Item | Value |
| --- | --- |
| Users | `admin` (from the image, password `MOODLE_ADMIN_PASSWORD`), `cg_teacher`, `cg_student`, `cg_student2` (manual auth) |
| Courses | `COGNIATE-DEV-101` and `COGNIATE-DEV-102`, completion tracking on. In both: `cg_teacher` = editingteacher, `cg_student` and `cg_student2` = student. |
| Product WS service | `cogniate_integration`, user `cogniate_integration`, 9 functions: `core_webservice_get_site_info`, `core_course_create_courses`, `core_course_get_courses_by_field`, `core_course_get_contents`, `core_course_get_categories`, `core_course_create_categories`, `enrol_manual_enrol_users`, `core_user_create_users`, `core_user_get_users_by_field` |
| QA oracle WS service | `cogniate_qa_oracle`. **Dev/test only. Never configure it on a real site.** User `cogniate_qa_oracle`, role = manager archetype + `webservice/rest:use`. Functions: `gradereport_user_get_grade_items`, `core_completion_get_activities_completion_status`, `core_enrol_get_enrolled_users`, `core_course_get_contents`, `core_course_get_courses_by_field`, `core_course_update_courses` |
| CA trust | `moodledata/moodleorgca.crt` = Alpine CA bundle + `root.crt` |
| Dev-only network settings | `curlsecurityblockedhosts` = the Moodle default list with only `STACK_SUBNET` cut out (`172.16.0.0/12` is split around it; every other entry stays). `curlsecurityallowedport` = `443` (+ `PUBLIC_PORT`), so port 80 is closed. `noemailever` = 1. `stack:moodle-reach-check` proves the rules. MoodleCloud does not need these settings. |
| WS file access | Both services have `downloadfiles = 0` and `uploadfiles = 0`: a token cannot read or upload files through `webservice/pluginfile.php`. |
| Admin password | Seed sets the `admin` password from `.env` on every run. |
| Portal users (Cogniate app, mock login) | `thanh@cogniate.test` in "Thanh's Library" (password `PORTAL_THANH_PASSWORD`) and `qa-b@cogniate.test` in "QA Library B" (password `PORTAL_QAB_PASSWORD`). Role `owner`. Seed runs `node src/cli/seed-portal.ts` in the `cogniate-app` container (passwords on stdin). A password changes only when `.env` changes; then the old sessions of that user end. |

### `infra/.secrets/seed.json`

Mode 600 and git-ignored. Format `cogniate-seed/1`. Later tasks add keys. They do not rename or remove keys.

```json
{
  "format": "cogniate-seed/1",
  "generatedAt": "2026-10-16T13:20:00.000Z",
  "urls": { "moodle": "https://moodle.test", "lti": "https://lti.cogniate.test", "app": "https://app.cogniate.test", "content": "https://content.cogniate-content.test" },
  "moodle": {
    "users": {
      "admin":       { "username": "admin",       "password": "<from .env>", "id": 2 },
      "cg_teacher":  { "username": "cg_teacher",  "password": "<from .env>", "id": 4 },
      "cg_student":  { "username": "cg_student",  "password": "<from .env>", "id": 5 },
      "cg_student2": { "username": "cg_student2", "password": "<from .env>", "id": 6 }
    },
    "courses": { "COGNIATE-DEV-101": 2, "COGNIATE-DEV-102": 3 },
    "ws": {
      "product":   { "service": "cogniate_integration", "username": "cogniate_integration", "userid": 3, "token": "<32 hex>", "functions": ["..."] },
      "qa_oracle": { "service": "cogniate_qa_oracle",   "username": "cogniate_qa_oracle",   "userid": 7, "token": "<32 hex>", "functions": ["..."] }
    }
  },
  "lti": { "apiKeyFiles": { "cogniate": "infra/.secrets/lti-api-key.cogniate", "qa-second": "infra/.secrets/lti-api-key.qa-second" } },
  "ltiSeed": { "typeId": 1, "clientId": "<Moodle client id>", "deploymentId": "1", "cmids": { "COGNIATE-DEV-101": 3, "COGNIATE-DEV-102": 4 }, "platformId": "plt_..." },
  "portal": {
    "users": {
      "thanh@cogniate.test": { "email": "thanh@cogniate.test", "password": "<from .env>", "id": "usr_...", "name": "Thanh", "role": "owner", "library": { "id": "lib_...", "name": "Thanh's Library" } },
      "qa-b@cogniate.test":  { "email": "qa-b@cogniate.test",  "password": "<from .env>", "id": "usr_...", "name": "QA B",  "role": "owner", "library": { "id": "lib_...", "name": "QA Library B" } }
    }
  }
}
```

The ids are examples. Always read them from the file.

Stable key paths (later tasks only add keys):

| Key path | Type | Value |
| --- | --- | --- |
| `format` | string | `cogniate-seed/1` |
| `generatedAt` | string | ISO 8601 time of the last seed |
| `urls.moodle`, `urls.lti`, `urls.app`, `urls.content` | string | the four `PUBLIC_*_URL` values |
| `moodle.users.<username>.username` | string | `admin`, `cg_teacher`, `cg_student`, `cg_student2` (the key is the user name) |
| `moodle.users.<username>.password` | string | password from `.env` |
| `moodle.users.<username>.id` | number | Moodle user id |
| `moodle.courses.<shortname>` | number | course id, for `COGNIATE-DEV-101` and `COGNIATE-DEV-102` |
| `moodle.ws.product.service` | string | `cogniate_integration` |
| `moodle.ws.product.username`, `.userid` | string, number | `cogniate_integration` and its id |
| `moodle.ws.product.token` | string | permanent REST token (32 hex) |
| `moodle.ws.product.functions` | string[] | the 9 function names |
| `moodle.ws.qa_oracle.service`, `.username`, `.userid`, `.token`, `.functions` | as above | `cogniate_qa_oracle`, its user, token and 6 function names |
| `lti.apiKeyFiles.<account>` | string | repo-relative path of the API key file of the LTI tool account (`cogniate`, `qa-second`); the file holds one line `ltis_…` |
| `ltiSeed.typeId` | number | Moodle tool type id of "Cogniate (seed)" (written by `seed:lti-manual`) |
| `ltiSeed.clientId`, `ltiSeed.deploymentId` | string | Moodle client id and deployment id (= type id) of that tool |
| `ltiSeed.cmids` | object | `{ "<course shortname>": <cmid> }`, for example `{ "COGNIATE-DEV-101": 3, "COGNIATE-DEV-102": 4 }`. The values are course module ids (cmids), not course ids. |
| `ltiSeed.cmids.<course shortname>` | number | course module id of "Seed activity" (`COGNIATE-DEV-101`) and "Seed activity 102" (`COGNIATE-DEV-102`) |
| `ltiSeed.platformId` | string | id of the platform in the LTI service (`plt_…`) |
| `portal.users.<email>.email` | string | `thanh@cogniate.test`, `qa-b@cogniate.test` (the key is the email, the login name of the Cogniate app) |
| `portal.users.<email>.password` | string | password from `.env` (`PORTAL_THANH_PASSWORD`, `PORTAL_QAB_PASSWORD`) |
| `portal.users.<email>.id`, `.name`, `.role` | string | user id (`usr_…`), display name, `owner` |
| `portal.users.<email>.library.id`, `.library.name` | string | library id (`lib_…`) and name ("Thanh's Library", "QA Library B") |

## QA hooks

| Hook | How |
| --- | --- |
| Separate checkout (parallel stack) | Clone into a new folder. On the first command set the identity, for example `COMPOSE_PROJECT_NAME=qa-t1-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 npm run stack:up`. `gen-env` saves the three values in that checkout's `.env`; later commands need no variables. A shell value that differs from `.env` stops the command (so it never touches the other stack). Containers, volumes and the network get the project name as prefix. Two stacks run at the same time if their `PUBLIC_PORT` and `STACK_SUBNET` differ. Each checkout has its own CA. |
| Seed data | `infra/.secrets/seed.json` (above) |
| Test knobs | See "Test knobs" below. |
| Logs | `infra/.logs/<service>.jsonl` (`lti-service`, `cogniate-app`, `cogniate-content`), mode 700 (the Node services run as the host user). One JSON object per line: `{ts, level, service, event, trace_id, ...}`. Every line has `trace_id`: request lines use the request trace id (or the caller's `x-trace-id`); lifecycle lines use one boot trace id per process (`boot-<12 hex>`). T1 events: `service_started`, `test_knob_active`, `http_request {method, path, status, ms}`, `service_stopping` (one per listener). `/healthz` requests are not logged (the services log at level `info`; compose sets no log level), so the health checks do not fill the files. Paths have no query string, and token-like path segments show as `:redacted`. Secret keys (any spelling, any depth) and secret-looking values (JWT, `Bearer`, `ltik=`) are redacted. Kept across restarts. `stack:reset` deletes them. |
| e2e container | Image `<project>-e2e:1.56.0` (Playwright 1.56.0). Repo at `/repo`, **read-only**. `/repo/.env` is the public part of `.env` only (`.tmp/public.env`: project, subnet, port, the four URLs; no secret). `infra/.secrets` and `infra/.logs` are read-only. `infra/.certs` shows only `root.crt` and `stack.crt` (no keys). Writable: `tests/acceptance/artifacts`, `tests/e2e/artifacts`, `tests/test-results`, `tests/playwright-report`, `tests/.tmp`, and `/repo/tests/node_modules` (a Docker volume with the Linux install, so it does not replace the host's `tests/node_modules`). `NODE_EXTRA_CA_CERTS=/certs/root.crt`. Chromium trusts the CA through NSS. The four `PUBLIC_*_URL` variables are set. |
| QA suites | `tests/` is a separate npm project owned by QA (with `tests/package-lock.json`). `npm run test:acceptance -- <args>` runs `npm ci --prefix tests && npm --prefix tests run acceptance -- <args>` in the e2e container, inside the acceptance profile (local-stack §3): (1) `STACK_PROFILE=acceptance npm run stack:up`, (2) the suite, (3) `npm run stack:up` with the default profile, also when the suite fails or stops with Ctrl+C (the suite container is removed too). A killed run (SIGKILL) leaves the profile on: `/healthz` shows `"profile": "acceptance"`, and `npm run stack:up` restores the default. `test:e2e` runs the `e2e` script the same way, in the current profile. If `tests/package.json` is missing, the command stops with a message. |
| QA env (H14) | Every `QA_*` variable of the caller reaches the e2e container (name only on the command line; the value comes from the environment), for `test:acceptance`, `test:e2e` and `infra/scripts/e2e-run.sh`. |
| Knobs and `stack:up` | A knob set with `stack:restart --env` stays active through a later `stack:up` (the override file is part of every compose command), until `stack:restart -- <service>` without `--env` or `stack:reset` (Q-T0-43). |

## Acceptance profile (T2b)

Start: `STACK_PROFILE=acceptance npm run stack:up`. Stop: `npm run stack:up` (no `STACK_PROFILE`). The choice is saved in `.tmp/stack-profile.<project>`: only `stack:up` changes it, so `stack:restart`, `seed` and the other commands keep it.

| Item | Value |
| --- | --- |
| `evil.test` (service `sink`) | HTTPS, answers `200 ok` to every request. Logs `sink_hit {host, method, path}` to `infra/.logs/sink.jsonl`. A sink hit means that a service called a host that it must not call. |
| `qa-platform.test` (service `qa-platform`) | HTTPS, `GET`/`HEAD https://qa-platform.test/<path>` serves `tests/fixtures/qa-platform/<path>` (`.json` as `application/json`, `Cache-Control: no-store`). Missing file, folder, `..` or a symlink out of the folder: `404`. Other methods: `405`. Logs `qa_platform_hit {method, path, status}` to `infra/.logs/qa-platform.jsonl`. QA writes its JWKS there at run time (the e2e container can write this folder; the files are git-ignored by QA). `QA_PLATFORM_DIR` (relative to `infra/`) serves another folder, for example for an Author self-check. |
| Both hosts | Code: `infra/qa-hosts/qa-hosts.mjs` (plain Node, no packages). Each container has its network alias and the `qa.crt` leaf. Log lines use the service format; paths have no query, and token-like segments show as `:redacted`. The health check uses plain HTTP `:8080` inside the container and is not logged. |
| Allowlists | `OUTBOUND_PRIVATE_HOST_ALLOWLIST` of `lti-service` = `moodle.test,qa-platform.test,evil.test` and of `cogniate-app` = `lti.cogniate.test,moodle.test,qa-platform.test,evil.test` (default profile: without the two QA names; the app needs `moodle.test` for the T8 web services). |
| `/healthz` and `service_started` | `"profile": "acceptance"` and `"outbound_allowlist": [...]` (the active list). Example (default): `{"status":"ok","service":"lti-service","profile":"default","knobs":[],"outbound_allowlist":["moodle.test"]}`. |

### Acceptance profile additions (M1, M3 §3)

| Item | Value |
| --- | --- |
| `lms-sim` | QA's signed platform simulator (`tests/sim/server.mjs`, read-only mount). Network aliases and QA leaf names come from `tests/sim/hosts.json`, plus the fixed control alias `lms-sim.test`. The infra writes the acceptance alias override to `.tmp/compose.sim-hosts.yaml`. Until LA-E7-02 supplies the manifest, the infra uses the fixed simulator host list. Log `infra/.logs/lms-sim.jsonl`. |
| `lti-gate` | The app-to-LTI transport gate (`infra/lti-gate/gate.mjs`, plain Node), alias `lti-gate.test`. The app sends its `/api/*` calls there (`LTI_API_URL=https://lti-gate.test`); browser traffic does not pass it. Control API `/__gate/rules`, `/__gate/release`, `/__gate/events`, `/__gate/reset` (M3 §3.3). Log `infra/.logs/lti-gate.jsonl`. |
| LTI service | `LTI_PROVIDER_SIMULATION=on`: the simulation profiles `blackboard-sim` and `canvas-sim-cloud` exist (`/healthz` `simulation_profiles`). The allowlist adds the `allowlist` hosts from the simulator manifest. `npm run stack:restart -- lti-service --env STACK_PROFILE=default` or `--env LTI_PROVIDER_SIMULATION=off` checks the other gate combinations (AC-M1-35); these two are not test knobs. |
| Cogniate app | The allowlist adds `lti-gate.test`. |
| Default profile | None of the above: no simulator, no gate, `simulation_profiles: []`, the app calls the LTI service directly. |

## SDK compatibility runner (T3c)

QA owns `tests/compat/run.py`. Start the stack and seed it, then run `npm run test:compat`.
The `compat` profile builds a Python 3.12 image with `ltiaas==0.0.4` and all runtime dependencies pinned in `infra/compat/requirements.txt`.
The build checks the SDK version, MIT license metadata and dependency consistency.
No SDK implementation is part of the product code.

| Input | Host | Container |
| --- | --- | --- |
| QA script, read-only | `tests/compat/`; override with `COMPAT_TESTS_DIR` (relative paths start at `infra/`) | `/tests/compat/run.py` |
| API key, read-only | `infra/.secrets/lti-api-key.cogniate` | `LTI_API_KEY_FILE=/run/secrets/lti-api-key.cogniate` |
| Public CA, read-only | `infra/.certs/root.crt` | `REQUESTS_CA_BUNDLE=/certs/root.crt` |
| Optional launch input, read-only | `COMPAT_INPUT_FILE` (relative paths start at the caller's folder) | `COMPAT_INPUT_FILE=/run/compat/input.json`; unset when no file is supplied |
| Public URLs | The four `PUBLIC_*_URL` values in `.env` | The same variables |
| QA options | Caller variables named `QA_*` | Passed by name; secret values stay off the command line |

QA captures one real student launch and one real teacher Deep Linking launch before this command.
It can write their inputs to a private, git-ignored file (mode 600), then pass its path:

```sh
COMPAT_INPUT_FILE=.tmp/compat-input.json npm run test:compat
```

Input JSON shape for the QA runner (replace the example strings with captured values):

```json
{
  "studentLtik": "captured-student-ltik",
  "teacherDeepLinkingLtik": "captured-teacher-deep-linking-ltik",
  "expected": {
    "userId": "student-lti-sub",
    "platformUrl": "https://moodle.test:8443",
    "contextId": "course-id"
  },
  "lineItemId": "https://moodle.test:8443/mod/lti/services.php/course/lineitems/item?type_id=tool"
}
```

`lineItemId` is optional when QA gets it from the ID token. QA may add the other ids it needs.
The harness must keep captured values out of logs. The container receives no `seed.json`, other account keys or app secrets.

The command stops with one clear error line if the QA script is missing or the SDK image build fails.
Before running the script, it checks `PUBLIC_LTI_URL/healthz` with the mounted CA and no redirects.
A CA mismatch stops with one line: run `npm run gen-env` and `npm run stack:up` again.
The certificate check never turns TLS verification off. QA's script exit status is returned unchanged.

## LTI service

| Item | Value |
| --- | --- |
| Code | `services/lti-service` (Fastify, `jose`, Zod, `node:sqlite`). Contract: `docs/architecture/contracts/lti-service-api.md`. |
| Database | `/data/lti.db` in the Docker volume `<project>_ltidb` (SQLite, ADR-012; plain SQL migrations in `src/db/migrations/` at start, shared runner `packages/shared/src/migrations.ts`). Each applied migration is stored with its SHA-256: if you edit an applied file, the service does not start (add a new file instead, or `stack:reset`). `stack:reset` deletes it. |
| Tool keys | One RSA 2048 key per tool account (RS256). The private JWK is encrypted with `LTI_MASTER_KEY` (AES-256-GCM). Public keys: `{PUBLIC_LTI_URL}/lti/keys/<account>`. |
| Outbound calls | Only through the guarded client in `packages/shared/src/outbound.ts` (https only, no redirects, 5 s, 1 MB, private IPs blocked inside the connection lookup). Allowlist: `OUTBOUND_PRIVATE_HOST_ALLOWLIST=moodle.test` (compose). Every attempt logs exactly one event: `outbound_request` or `outbound_blocked`. |
| Platform JWKS | Refreshed after 10 min. An unknown `kid` causes one refetch, at most one attempt per minute. If a refresh fails, the cached keys stay usable up to 24 h after the last good fetch (security §2.4). One fetch at a time per JWKS URL: launches that arrive during a fetch wait for it. |
| Dynamic registration (T3b) | In Moodle: Site administration > Plugins > External tool > Manage tools, paste `{PUBLIC_LTI_URL}/lti/register/cogniate` and press "Add LTI Advantage". Moodle shows a choice page when a tool with the same domain exists (always in this stack: the seed tool); choose "Register as a new external tool". The frame goes to `{PUBLIC_APP_URL}/tool/register?registrationId=…` (the app page comes in T4b1). `GET /api/registrations/:id` and `POST /api/registrations/:id/complete` (Bearer) finish it. An "update" registration is allowed only with `updatePlatformId` = `existingPlatformId`; otherwise `409 REGISTRATION_UPDATE_NOT_ALLOWED` and nothing is sent to Moodle. |
| Services API (T3a) | `POST /api/deeplinking`, `GET /api/lineitems`, `GET /api/lineitems/:lineItemId`, `POST` and `GET /api/lineitems/:lineItemId/scores` (`:lineItemId` = the URL-encoded line item URL). `GET /api/idtoken` gives `services.serviceKey` when the launch has AGS or NRPS; `SERVICE-AUTH-V1 <api key>:<service key>` works on the line item routes. A line item URL must be inside the AGS claim URL of the launch (same origin, path inside it, same `type_id`, and no `%2F`, `%5C`, `%2E`, `%25`, backslash or dot segment in the raw path), else `400 INVALID_LINE_ITEM_ID` and no call to Moodle. A score `timestamp` may be at most now + 15 min. Platform tokens are cached in memory (`platform_token {cache: hit|miss}`). |
| Launch failure log | `launch_check_failed {check, code, detail}` and `login_rejected {code, detail}`. `detail` is a fixed, safe reason, for example `skew_s=73`, `kid_unknown`, `jwks_fetch_failed`, `alg=HS256`, `missing=resource_link`. It never holds a token, a claim value or a key. Error pages mark the code and trace id (`<main data-error-code data-trace-id>`) and the next action (`<p data-error-action>`). |
| Moodle URLs for a manual tool | Login `{PUBLIC_LTI_URL}/lti/login/cogniate`, redirect and tool URL `{PUBLIC_LTI_URL}/lti/launch/cogniate`, keyset `{PUBLIC_LTI_URL}/lti/keys/cogniate`. |
| Author smoke check | `infra/scripts/e2e-run.sh node infra/e2e/lti-launch-smoke.mjs [cg_student] [--via=view|launch]`: a real Moodle launch of "Seed activity", then `GET /api/idtoken` (prints no secret). |

## Cogniate app

| Item | Value |
| --- | --- |
| Code | `services/cogniate-app` (Fastify, `@fastify/multipart`, Zod, `node:sqlite`) and `packages/package-inspector` (`yauzl`, `fast-xml-parser`, `parse5`). Contract: `docs/architecture/contracts/cogniate-app-api.md`. |
| Data folder | `/data` in the container (`DATA_DIR`) is the Docker volume `<project>_appdb` (ADR-012). `/data/packages` and `/data/uploads` are binds of the host folders `infra/.data/cogniate-app/packages` and `…/uploads`. `stack:reset` deletes all of them. |
| Database | `/data/cogniate.db` (SQLite). Plain SQL migrations in `src/domain/migrations/` at start. Each applied migration is stored with its SHA-256: if you edit an applied file, the service does not start (add a new file instead, or `stack:reset`). |
| Package store | `/data/packages/<pkg_id>/` (extracted files), `/data/uploads/<sha256>.zip` (original upload), `/data/uploads/.tmp/` (uploads in progress; emptied at start). A rejected upload leaves nothing here. Count the packages: `docker compose -p <project> exec cogniate-app ls /data/packages \| wc -l` (the path is absolute: the working folder of the container is `/repo/services/cogniate-app`). |
| Upload limits | Zip ≤ 200 MB (200,000,000 bytes), uncompressed ≤ 500 MB, ≤ 5,000 entries, ratio ≤ 100 per entry (security §7). |
| Connections (T4b1) | `POST /app-api/connections {name, siteUrl, method: dynamic|manual}`. Dynamic: the answer has `registrationUrl` (`{PUBLIC_LTI_URL}/lti/register/cogniate?ref=…`, single use, `REF_TTL_SECONDS`, default 24 h); the Moodle admin pastes it in Manage tools, chooses "Register as a new external tool" on Moodle's choice page, and presses Connect on the Cogniate page in the dialog (`/tool/register`). Manual: `GET …/tool-configuration` gives the 16 values for Moodle; `PUT …/platform` takes the six values back. Publish with `POST /app-api/publications {connectionId, courseId}`. |
| LTI service API key | The app reads `/run/secrets/app/lti-api-key` at each call (`LTI_API_KEY_FILE`). Least privilege: compose mounts only `infra/.secrets/app/` (read-only), which holds only that key; `lti-bootstrap.sh` (run by `seed`) keeps it equal to `infra/.secrets/lti-api-key.cogniate`. `seed.json` and the other keys are not in the container. |
| Sign in by hand | `curl -si https://app.cogniate.test/app-api/session -H 'Origin: https://app.cogniate.test' -H 'Content-Type: application/json' -d '{"email":"thanh@cogniate.test","password":"<PORTAL_THANH_PASSWORD>"}'`. Every write needs `Origin: {PUBLIC_APP_URL}`. |

## Test knobs

The registry is `KNOB_REGISTRY` in `packages/shared/src/knobs.ts`. Later tasks add knobs there and nowhere else.

| Knob | Service | Default | Range | Used by |
| --- | --- | --- | --- | --- |
| `LTIK_TTL_SECONDS` | `lti-service` | `86400` (24 h, contract) | 1 to 2,592,000 | ltik lifetime (T2, AC-T2-07) |
| `REF_TTL_SECONDS` | `cogniate-app` | `86400` (24 h, contract `cogniate-app-api.md`) | 1 to 2,592,000 | registration URL `ref` token lifetime (T4, AC-T4-09 uses 20) |
| `PICKER_TTL_SECONDS` | `cogniate-app` | `3600` (1 h, contract §6) | 1 to 86,400 | content picker session lifetime (T4b2, AC-T4-20 uses 20: POST the picker at TTL + 3 s gives 410) |
| `PLAY_TTL_SECONDS` | `cogniate-app` | `86400` (24 h, contract §6) | 1 to 2,592,000 | play session lifetime: player shell and runtime token (T5, AC-T5-15 uses 20: a commit at TTL + 3 s gives `410 RUNTIME_EXPIRED`) |
| `BUILD_RUNNER_HOLD` | `cogniate-app` | `0` | 0 or 1 | T8: 1 = the build waits before teardown until `infra/.data/build-queue/hold/<buildId>` is removed (AC-T8-03) |
| `BUILD_RUNNER_FAIL_AT` | `cogniate-app` | `""` (empty: no failure) | string: `start`, `course`, `scorm`, `backup` or `copy` | T8: the build fails at that step (AC-T8-07 uses `backup`) |

- Set: `npm run stack:restart -- lti-service --env LTIK_TTL_SECONDS=5`.
- Restore the defaults: `npm run stack:restart -- lti-service` (no `--env`).
- Active knob = env value set and different from the default. At start, the service logs one `test_knob_active {name, value}` line per active knob. `GET /healthz` returns `"knobs":[{"name":"LTIK_TTL_SECONDS","value":"5"}]`. With the defaults, `"knobs":[]`. `value` is the string you set.
- Every listener of a process reports the knobs of its compose service. So `cogniate-content` (same process as `cogniate-app`) also lists the `cogniate-app` knobs.
- A number knob: a value that is not a whole number in the range stops the service. `stack:restart` then prints the error and the restore command.
- The string knob `BUILD_RUNNER_FAIL_AT`: the value must be one of the listed steps (exact, lower case); any other value stops the service in the same way. The empty value is the default (no failure).
- The two Build Runner knobs belong to `cogniate-app`: the app puts them into each build request, and the host Build Runner applies them. So restart `cogniate-app` with them, for example `npm run stack:restart -- cogniate-app --env BUILD_RUNNER_FAIL_AT=backup`.
- A key that is not a registered knob of that service is refused (exit 2, with the list of valid knobs). So `/healthz` always shows every override.
- While overrides exist, `stack:up`, `seed`, `test:acceptance` and `test:e2e` print a CAUTION line.
- The overrides are kept in `.tmp/compose.knobs.yaml` until you restore the defaults or run `stack:reset`.

## Course fixtures

The two Cogniate exports are not in git. Their SHA-256 values are in `infra/fixtures/courses.sha256`. `npm run fixtures:check` compares the files in `COURSE_FIXTURES_DIR` (default `docs/raw/data/courses`). If a file is missing, it prints how to get it. Treat the zips as untrusted data: `stage-fixture.sh` copies a zip into an emptied folder that is mounted read-only in Moodle.

## Debug a failed E2E step

`npm run test:e2e` writes everything to `tests/e2e/artifacts/` (git-ignored):

| Path | Content |
|---|---|
| `tests/e2e/artifacts/playwright-report/` | The HTML report: each test with its error, screenshots and trace |
| `tests/e2e/artifacts/playwright/` | The test output folders: `trace.zip` files and screenshots |
| `tests/e2e/artifacts/state.json` | The ids of the last full run (connection, activities); a re-run of one step reads them |
| `infra/.logs/*.jsonl` | The service logs (JSON lines, one file for each service) |

1. Find the FIRST failed step. The test name starts with the scenario step (for example "B6 ..."); `docs/architecture/tasks/T7.md` says what the step does. A later step that says "Needs ... from an earlier step" is not the cause.
2. Open the report: `npx playwright show-report tests/e2e/artifacts/playwright-report` (from the repo root; it opens your browser). Click the failed test to see the error, the screenshots and the trace.
3. Open one trace directly: `npx playwright show-trace --port 0 tests/e2e/artifacts/playwright/<test folder>/trace.zip`. The trace shows each action, the page before and after, the network requests and the console.
4. Find the service log lines: an error page shows a trace id. Search for it: `grep -h '<trace id>' infra/.logs/*.jsonl`.
5. Run one step again on the same stack (no reset, debugging only): `E2E_RESET=0 QA_GREP='B6' npm run test:e2e`. It uses the ids in `state.json` from the last full run. For the official result, run the full suite again (with the reset).

WARNING: a trace and the HTML report hold raw secrets: passwords typed into forms, cookies, `id_token`s, ltiks and the registration URL. Keep them on your computer. Do not attach them to a ticket, a chat or a review pack, and do not commit them. To share a failure, share the error text and the screenshots only.

## Troubleshooting

- CAUTION for browser tests: on the Moodle login page, `core/togglesensitive` (setting `loginpasswordtoggle`, default on) re-creates the password field when its JavaScript starts. A value typed before that is lost, and the login fails with "Your login info may be incorrect" (about 1 run in 3 in Playwright). Wait for `.toggle-sensitive-wrapper #password` before you type. `infra/e2e/smoke.mjs` shows the pattern.

- `PUBLIC_* ... expected ...`: you changed `PUBLIC_PORT`. Run `npm run gen-env`.
- `Docker is not running`: start Docker Desktop, wait until it is ready, then run the command again.
- `Port 443 on 127.0.0.1 is busy`: stop the other program, or set `PUBLIC_PORT` in `.env` (see Configuration), run `npm run gen-env`, then `npm run stack:up`.
- `This checkout has no .env, but project ... still has Docker volumes`: a new `.env` has new passwords that do not match the old database. Restore the old `.env`, or run `npm run stack:reset` (it also works without `.env`).
- `The stack is not healthy`: `stack:up` waits at most 300 s, then prints the last log lines of each unhealthy service. A first Moodle install takes about 30 s. More: `npm run stack:logs -- moodle`.
- On Docker Desktop, `lsof` shows the Docker process on `*:443`. A connection from another machine still fails, because Docker forwards only `127.0.0.1:443` to the proxy.

## History

T1-spike (2026-10-16): `infra/moodle/SPIKE-NOTES.md` has the spike facts and evidence. That stack ran on `http://localhost:8080` with a socat sidecar. T1 replaced it with this HTTPS stack, so the spike commands in those notes no longer exist.
