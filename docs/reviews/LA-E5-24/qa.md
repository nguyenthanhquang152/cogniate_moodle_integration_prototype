Verdict: PASS
Round: 2

# LA-E5-24 Pilot backup and restore drill: QA verification (Round 2 live K1-SIM stack drill)

- **Task:** `LA-E5-24` — Pilot backup and restore drill
- **Verdict:** `PASS`
- **Round:** `2`
- **QA Engineer:** `QA-E2E` (Orca task `task_16fd2d20a0cd`, dispatch `ctx_a7c85bc8a65d`, run `run_06d07dc77faf`)
- **Date / Window:** `2026-10-23T20:30:00Z` to `2026-10-23T21:30:00Z` (`DOCKER-YES` SIM slot; actual execution `2026-10-23T20:30:26Z` to `2026-10-23T20:38:43Z`, `0` Docker commands before `20:30:00Z`)
- **Commit verified:** `5603861886909667a03d2aaf7843a9b17a4020ed` (integration commit; product code `60230165`)
- **Spec:** `docs/architecture/ltiaas/tasks/LA-E5-24.md` (`LA-ADR-06` D3, D6, D10, D14; `docs/architecture/ltiaas/operability.md` §7, §7.2, §7.3; `docs/architecture/ltiaas/tasks/README.md` §2 form (g), form (h), §6; `docs/architecture/ltiaas/TEST-STRATEGY.md` §5.4)
- **Suite:** `tests/e2e/ltiaas/{run-la-e5-24.mjs,la-e5-24-drill.mjs,la-e5-24-container-step.mjs,la-e5-24-drill.selftest.mjs}`
- **Primary artifacts directory:** `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E5-24/r2/artifacts/qa-e2e-la-drill-r2-56038618-2026-10-23T20-36-36-947Z/` (and initial run `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E5-24/r2/artifacts/qa-e2e-la-drill-r1-56038618-2026-10-23T20-31-13-032Z/`)
- **Boundary & watcher records:** `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E5-24/r2/boundary/` (`umask 077`)

---

## 1. Executive Summary (`K1-SIM` Live Stack Drill on `56038618`, code `60230165`)

All 6 acceptance criteria (`AC-LA-E5-24-01` through `AC-LA-E5-24-06`) and all host-runner gates (`PRE`, `CLONE`, `H1`, `TEARDOWN`) **PASSED (`10/10`)** on the live `K1-SIM` stack at commit `5603861886909667a03d2aaf7843a9b17a4020ed` (product code `60230165`).

During the first live run (`qa-e2e-la-drill-r1-56038618-2026-10-23T20-31-13-032Z`, `COMPOSE_PROJECT_NAME=qa-e2e-la-drill-r1`), `PRE`, `CLONE`, `H1`, `AC-LA-E5-24-01`, `AC-LA-E5-24-02`, `AC-LA-E5-24-03`, `stack:data-restore`, post-restore `stack:up`, and `TEARDOWN` all succeeded, while `post-restore-verify` (`ERROR: FAIL`) hit a test-helper URL assertion bug in `tests/e2e/ltiaas/la-e5-24-container-step.mjs` (line 451 checked `GET /rt/:token` — the runtime iframe wrapper HTML — for `data-cog-quiz="q0"` instead of fetching `GET /rt/:token/state` first and requesting `${PUBLIC_CONTENT_URL}${rtState.packageBaseUrl}${rtState.launchPath}`, i.e. `/pkg/:packageId/index.html`). `qa-e2e-la-drill-r1` tore down cleanly (`0` containers, `0` volumes, `0` networks left).

We fixed the helper in `tests/e2e/ltiaas/la-e5-24-container-step.mjs` (verifying both `GET /rt/:token` wrapper HTML and `GET ${PUBLIC_CONTENT_URL}${rtState.packageBaseUrl}${rtState.launchPath}` course package HTML) and staged the updated helpers in `tests/e2e/ltiaas/run-la-e5-24.mjs`, then ran the authorized rerun on `COMPOSE_PROJECT_NAME=qa-e2e-la-drill-r2` (`qa-e2e-la-drill-r2-56038618-2026-10-23T20-36-36-947Z`), which exited `0` with **`10/10 PASS`**.

---

## 2. Runner `summary.json` Accounting (Every ID and Status, No Omitted `FAIL` or `ERROR` Rows)

### 2.1 Rerun 2 (`qa-e2e-la-drill-r2-56038618-2026-10-23T20-36-36-947Z` — Final `PASS`, `10/10`)

Source: `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E5-24/r2/artifacts/qa-e2e-la-drill-r2-56038618-2026-10-23T20-36-36-947Z/summary.json`

| ID | Status | Title | Notes from `summary.json` | Evidence files |
| --- | --- | --- | --- | --- |
| `PRE` | `PASS` | Preflight: tools, free port, free subnet, no leftover QA project | `node 24.21.0, docker 29.9.1, compose 5.6.0`; `project qa-e2e-la-drill-r2, PUBLIC_PORT 9443, STACK_SUBNET 172.20.0.0/16`; `other containers on this Docker host: 2 (not touched by QA)` (`sto-it-*`) | `lane-boundary.json` |
| `CLONE` | `PASS` | Clone the SHA into a new folder | `HEAD 5603861886909667a03d2aaf7843a9b17a4020ed`; `clone /Users/quangnguyen/cogniate-qa-runs/LA/LA-E5-24/r2/clone-r2` | `cmd/01-git-clone.log`, `cmd/02-git-checkout.log` |
| `H1` | `PASS` | The stack runs as `qa-e2e-la-drill-r2` with the T1 services | `services: cogniate-app, lms-sim, lti-gate, lti-service, moodle, postgres, proxy, qa-platform, sink` | `cmd/06-stack-up-initial.log`, `cmd/07-seed.log` |
| `AC-LA-E5-24-01` | `PASS` | `stack:data-backup -- --out <external folder>` with both services stopped exits 0 and passes manifest validation | `exit 0; backupId=729d1f45-8f06-4974-a0ed-7e386cfaf141; composeProject=qa-e2e-la-drill-r2; pairId=f9f1412dc5eacfed8db28a3a37890dfe; generation=0`; `files=2; ltiMigrations=21; appMigrations=18; content={"packagesFiles":1,"uploadsFiles":1,"totalBytes":1734}` | `cmd/09-stack-down-before-backup.log`, `cmd/10-stack-data-backup.log`, `drill-backup-manifest.json` |
| `AC-LA-E5-24-02` | `PASS` | Backup record lists key version IDs from `GET /operator/v1/key-provider` and holds no key material (`0` secret hits) | `kind=local-keyring; activeVersion=legacy; versionIds=["legacy"]`; `secret scan: checked 12 secret values + 4 patterns; record hits=0, manifest hits=0` | `drill-backup-record.json`, `drill-backup-secret-scan.json` |
| `AC-LA-E5-24-03` | `PASS` | After backup, stack starts and `POST /operator/v1/accounts` with `{id: "drill-79cfd4a5", ...}` returns `201` | `POST /operator/v1/accounts status=201; id=drill-79cfd4a5; accounts before restore=["cogniate","drill-79cfd4a5","qa-second"]` | `cmd/11-stack-up-after-backup.log`, `cmd/12-e524-post-backup-write.log`, `drill-post-backup-write.json` |
| `AC-LA-E5-24-04` | `PASS` | `stack:data-restore -- --from <folder>` exits 0; after `stack:up`, LTI `/readyz` and app `/healthz` succeed, and `GET /operator/v1/accounts` has no `drill-79cfd4a5` | `restore exit=0; contentFilesRestored=2; LTI /readyz={"status":"ready"}; App /healthz="ok"`; `accounts after restore=["cogniate","qa-second"]; GET /operator/v1/accounts/drill-79cfd4a5 status=404` | `cmd/13-stack-down-before-restore.log`, `cmd/14-stack-data-restore.log`, `cmd/15-stack-up-after-restore.log`, `cmd/16-e524-post-restore-verify.log`, `drill-post-restore-verify.json` |
| `AC-LA-E5-24-05` | `PASS` | On the restored stack, one simulator learner launch reaches the player, and one final score reaches the simulator | `playId=ply_x1h--mMDfTIq3vpfDXp-5Q; packageHtmlStatus=200; commitStatus=200; simulatorScore={"scoreGiven":90,"scoreMaximum":100,"activityProgress":"Completed","gradingProgress":"FullyGraded"}; portalSyncStatus=sent` | `cmd/16-e524-post-restore-verify.log`, `drill-post-restore-verify.json` |
| `AC-LA-E5-24-06` | `PASS` | Evidence records restore start/end times (RTO) and backup age (RPO); external backup folder and drill project removed | `backupCreatedAt=2026-10-23T20:37:33.712Z; restoreStartedAt=2026-10-23T20:37:53.527Z; restoreCompletedAt=2026-10-23T20:38:20.101Z`; `RTO=26574 ms (26.574 s); RPO=19815 ms (19.815 s); externalBackupRemoved=true` | `drill-metrics.json` |
| `TEARDOWN` | `PASS` | QA stack `qa-e2e-la-drill-r2` removed: only recorded resources whose inspect matched; nothing left by exact name or label | `npm run stack:down exit 0`; `left after cleanup: 0 containers, 0 volumes (exact lane names included), 0 networks`; `other projects' containers that stopped or restarted: none (information)` | `cmd/17-stack-down.log`, `lane-ownership.json` |

### 2.2 Initial Run 1 (`qa-e2e-la-drill-r1-56038618-2026-10-23T20-31-13-032Z` — `7 PASS, 1 FAIL (ERROR)`, Full Accounting)

Source: `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E5-24/r2/artifacts/qa-e2e-la-drill-r1-56038618-2026-10-23T20-31-13-032Z/summary.json`

| ID | Status | Title | Notes from `summary.json` |
| --- | --- | --- | --- |
| `PRE` | `PASS` | Preflight: tools, free port, free subnet, no leftover QA project | `node 24.21.0, docker 29.9.1, compose 5.6.0`; `project qa-e2e-la-drill-r1, PUBLIC_PORT 9443, STACK_SUBNET 172.20.0.0/16`; `other containers on this Docker host: 0` |
| `CLONE` | `PASS` | Clone the SHA into a new folder | `HEAD 5603861886909667a03d2aaf7843a9b17a4020ed`; `clone /Users/quangnguyen/cogniate-qa-runs/LA/LA-E5-24/r2/clone` |
| `H1` | `PASS` | The stack runs as `qa-e2e-la-drill-r1` with the T1 services | `services: cogniate-app, lms-sim, lti-gate, lti-service, moodle, postgres, proxy, qa-platform, sink` |
| `AC-LA-E5-24-01` | `PASS` | `stack:data-backup -- --out <external folder>` with both services stopped exits 0 and passes manifest validation | `exit 0; backupId=d7e58de5-19ca-4efa-aa5f-1be212f11013; composeProject=qa-e2e-la-drill-r1; pairId=27c44e2b28ae5c9bfaf6e3c8b5045963; generation=0; files=2; ltiMigrations=21; appMigrations=18` |
| `AC-LA-E5-24-02` | `PASS` | Backup record lists key version IDs from `GET /operator/v1/key-provider` and holds no key material (`0` secret hits) | `kind=local-keyring; activeVersion=legacy; versionIds=["legacy"]; checked 12 secret values + 4 patterns; record hits=0, manifest hits=0` |
| `AC-LA-E5-24-03` | `PASS` | After backup, stack starts and `POST /operator/v1/accounts` with `{id: "drill-bce284eb", ...}` returns `201` | `POST /operator/v1/accounts status=201; id=drill-bce284eb; accounts before restore=["cogniate","drill-bce284eb","qa-second"]` |
| `ERROR` | `FAIL` | Runner error (`post-restore-verify exited 0`: `1 !== 0`) | Test-helper assertion defect in `la-e5-24-container-step.mjs:451` (`AssertionError: Restored course HTML contains quiz questions`): checked `GET /rt/:token` (runtime wrapper HTML) instead of `GET ${PUBLIC_CONTENT_URL}${rtState.packageBaseUrl}${rtState.launchPath}` (`/pkg/:packageId/index.html`). Fixed in `tests/e2e/ltiaas/la-e5-24-container-step.mjs` and verified in `qa-e2e-la-drill-r2`. |
| `TEARDOWN` | `PASS` | QA stack `qa-e2e-la-drill-r1` removed: only recorded resources whose inspect matched; nothing left by exact name or label | `npm run stack:down exit 0; left after cleanup: 0 containers, 0 volumes, 0 networks; other projects' containers that stopped or restarted: none` |

---

## 3. Acceptance Criteria Verification Table (`LA-E5-24` Round 2 Live `K1-SIM` + Host Selftest)

| AC | Host dry-run status | Live `K1-SIM` stack status | Test id / file | Command | Live `K1-SIM` evidence (`qa-e2e-la-drill-r2` on `56038618`) |
| --- | --- | --- | --- | --- | --- |
| `AC-LA-E5-24-01` | `PASS` (`5/5` selftest, `6/6` dry-run) | `PASS` | `tests/e2e/ltiaas/run-la-e5-24.mjs` (`AC-LA-E5-24-01`), `tests/e2e/ltiaas/la-e5-24-drill.mjs` (`inspectDrillBackup`, `copyContentFolders`) | `COMPOSE_PROJECT_NAME=qa-e2e-la-drill-r2 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 COURSE_FIXTURES_DIR=/Users/quangnguyen/cogniate-qa-runs/LA/GATE/course-fixtures node tests/e2e/ltiaas/run-la-e5-24.mjs --sha 5603861886909667a03d2aaf7843a9b17a4020ed ...` | After `npm run stack:down` (`exit 0`, `3763 ms`), `npm run stack:data-backup -- --out <external>/db` exited `0` (`1072 ms`) with `storage_backup` event (`backupId: "729d1f45-8f06-4974-a0ed-7e386cfaf141"`, `composeProject: "qa-e2e-la-drill-r2"`, `source: "volume"`, `pairId: "f9f1412dc5eacfed8db28a3a37890dfe"`, `generation: 0`, `unprepared: []`). Validated `manifest.json` and both SQLite databases (`lti-service/lti.db`: `233472` bytes, SHA-256 `ab2df16e...`, `21` applied migrations `001_init.sql`..`021_registration_token_kind.sql`; `cogniate-app/cogniate.db`: `446464` bytes, SHA-256 `a874f632...`, `18` applied migrations `001_init.sql`..`018_picker_pick.sql`) plus external content backup (`packagesFiles: 1`, `uploadsFiles: 1`, `totalBytes: 1734`). |
| `AC-LA-E5-24-02` | `PASS` | `PASS` | `tests/e2e/ltiaas/run-la-e5-24.mjs` (`AC-LA-E5-24-02`), `tests/e2e/ltiaas/la-e5-24-drill.mjs` (`buildBackupRecord`, `scanBackupRecordForSecrets`) | same | Queried `GET http://lti-service:4110/operator/v1/key-provider` (`200`, `kind: "local-keyring"`, `activeVersion: "legacy"`, `versions: [{"id":"legacy","state":"active","sealedCount":2,"derivedCount":0}]`) and wrote `<drillRoot>/backup-record.json` with `versionIds: ["legacy"]` and `sourceRevision: "5603861886909667a03d2aaf7843a9b17a4020ed"`. Scanned both `backup-record.json` and `manifest.json` against `12` live secret values (`LTI_MASTER_KEY`, `APP_MASTER_KEY`, `lti-operator-key`, portal session/passwords, tokens) and `4` key-material regex patterns (`ltio_`, `ltis_`, PEM private keys, JSON key fields): **`0` secret hits in `backup-record.json` and `0` secret hits in `manifest.json`**. |
| `AC-LA-E5-24-03` | `PASS` | `PASS` | `tests/e2e/ltiaas/run-la-e5-24.mjs` (`AC-LA-E5-24-03`), `tests/e2e/ltiaas/la-e5-24-container-step.mjs` (`stepPostBackupWrite`) | same | Restarted stack (`npm run stack:up`, `exit 0`, `17165 ms`) and called `POST http://lti-service:4110/operator/v1/accounts` with `{ id: "drill-79cfd4a5", name: "Drill Marker 79cfd4a5", launchUrl: "https://app.cogniate.test:9443/tool/launch", deepLinkingUrl: "https://app.cogniate.test:9443/tool/picker", registrationUrl: "https://app.cogniate.test:9443/app" }`. Verified HTTP `201`, account `status: "active"`, and `GET /operator/v1/accounts` returned `["cogniate", "drill-79cfd4a5", "qa-second"]`. |
| `AC-LA-E5-24-04` | `PASS` | `PASS` | `tests/e2e/ltiaas/run-la-e5-24.mjs` (`AC-LA-E5-24-04`), `tests/e2e/ltiaas/la-e5-24-container-step.mjs` (`stepPostRestoreVerify`) | same | Stopped services (`npm run stack:down`, `exit 0`, `3640 ms`; never `stack:reset`), restored `packages/` and `uploads/` (`2` files), and ran `npm run stack:data-restore -- --from <external>/db` in the same compose project (`qa-e2e-la-drill-r2`): exited `0` (`1104 ms`, `restore: committed`, `generation: 1`, `opId: "9ef55d20-5239-48de-ae53-702c0aa45a28"`). Started stack (`npm run stack:up`, `exit 0`, `20816 ms`) and verified: `GET https://lti.cogniate.test:9443/readyz` -> `200 {"status":"ready"}`, `GET http://lti-service:4110/readyz` -> `200 {"status":"ready","reasons":[]}`, `GET https://app.cogniate.test:9443/healthz` -> `200 {"status":"ok","service":"cogniate-app","profile":"acceptance"}`, `GET http://cogniate-app:4210/readyz` -> `200 {"status":"ready"}`, `GET /operator/v1/accounts` -> `200` with `["cogniate", "qa-second"]` (`drillMarkerPresent: false`), and `GET /operator/v1/accounts/drill-79cfd4a5` -> `404`. |
| `AC-LA-E5-24-05` | `PASS` | `PASS` | `tests/e2e/ltiaas/run-la-e5-24.mjs` (`AC-LA-E5-24-05`), `tests/e2e/ltiaas/la-e5-24-container-step.mjs` (`stepPostRestoreVerify`) | same | On the restored stack, created simulator scenario `sc-drill-79cfd4a5` (`provider: "moodle-sim"`, `resource: "pub_eOIf15u1f2K57R3P0G3V8A"`) and executed a full LTI 1.3 OIDC third-party login (`POST /lti/login/cogniate` -> `302` -> `GET https://moodle.sim.test/mod/lti/auth.php` -> `200` -> `POST /lti/launch/cogniate` -> `303` -> `GET /tool/launch` -> `303` -> `/play/ply_x1h--mMDfTIq3vpfDXp-5Q`). Verified player shell (`200`), runtime page `/rt/:token` (`200`), runtime state `/rt/:token/state` (`200`), and restored HTML course package `/pkg/:pkgId/index.html` (`200`, contains `data-cog-quiz="q0"`). Committed 9/10 quiz answers (`POST /rt/:token/commit` -> `200`) and verified final AGS score delivery at `GET https://lms-sim.test/__sim/records` (`kind: "score"`, `scoreGiven: 90`, `scoreMaximum: 100`, `activityProgress: "Completed"`, `gradingProgress: "FullyGraded"`) and `GET /app-api/publications/pub_eOIf15u1f2K57R3P0G3V8A/results` (`portalSyncStatus: "sent"`). |
| `AC-LA-E5-24-06` | `PASS` | `PASS` | `tests/e2e/ltiaas/run-la-e5-24.mjs` (`AC-LA-E5-24-06`), `tests/e2e/ltiaas/la-e5-24-drill.mjs` (`computeDrillMetrics`) | same | Recorded `backupCreatedAt: "2026-10-23T20:37:33.712Z"`, `restoreStartedAt: "2026-10-23T20:37:53.527Z"`, `restoreCompletedAt: "2026-10-23T20:38:20.101Z"`, **RTO = `26574 ms` (`26.574 s`)**, **RPO (backup age at restore start) = `19815 ms` (`19.815 s`)** in `drill-metrics.json`. Removed external backup directory (`backupFolderRemoved: true`) and tore down `qa-e2e-la-drill-r2` (`0` containers, `0` volumes, `0` networks remaining). |

---

## 4. Service Stop Duration Recording (`BD-A2-109` Note)

Per the task brief (`BD-A2-109` note: record each service stop duration), every `npm run stack:down` execution during both `qa-e2e-la-drill-r1` and `qa-e2e-la-drill-r2` was timed in `cmd/*.log`. All 6 stack stops completed cleanly in **3.57s–3.76s** (`3566 ms`–`3763 ms`), confirming that `lti-service` and `cogniate-app` exit promptly on `SIGTERM` without hitting Docker's 10-second `SIGKILL` timeout:

| Run / Project | Step | Command Log | Exit Code | Duration (`duration_ms`) | Notes |
| --- | --- | --- | --- | --- | --- |
| `qa-e2e-la-drill-r2` | Stop before `stack:data-backup` | `cmd/09-stack-down-before-backup.log` | `0` | **`3763 ms`** (`3.763 s`) | Clean `SIGTERM` shutdown of all 9 compose services + network removal |
| `qa-e2e-la-drill-r2` | Stop before `stack:data-restore` | `cmd/13-stack-down-before-restore.log` | `0` | **`3640 ms`** (`3.640 s`) | Clean `SIGTERM` shutdown of all 9 compose services + network removal |
| `qa-e2e-la-drill-r2` | Final `TEARDOWN` `stack:down` | `cmd/17-stack-down.log` | `0` | **`3669 ms`** (`3.669 s`) | Clean `SIGTERM` shutdown of all 9 compose services + network removal |
| `qa-e2e-la-drill-r1` | Stop before `stack:data-backup` | `cmd/09-stack-down-before-backup.log` | `0` | **`3680 ms`** (`3.680 s`) | Clean `SIGTERM` shutdown of all 9 compose services + network removal |
| `qa-e2e-la-drill-r1` | Stop before `stack:data-restore` | `cmd/13-stack-down-before-restore.log` | `0` | **`3592 ms`** (`3.592 s`) | Clean `SIGTERM` shutdown of all 9 compose services + network removal |
| `qa-e2e-la-drill-r1` | Final `TEARDOWN` `stack:down` | `cmd/17-stack-down.log` | `0` | **`3566 ms`** (`3.566 s`) | Clean `SIGTERM` shutdown of all 9 compose services + network removal |

---

## 5. Docker Boundary & Watcher Records (`/Users/quangnguyen/cogniate-qa-runs/LA/LA-E5-24/r2/boundary/`)

All boundary and watcher records were captured under `umask 077` in `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E5-24/r2/boundary/`:

- **Timestamps:**
  - Before slot: `2026-10-23T20:30:26Z` (`before-timestamp.txt`; zero Docker commands executed prior to `20:30:00Z`)
  - After slot: `2026-10-23T20:38:43Z` (`after-timestamp.txt`)
- **Non-`sto-*` containers (`before-non-sto-containers.txt` / `after-non-sto-containers.txt`):**
  - Before: `0` containers (`0` bytes)
  - After: `0` containers (`0` bytes)
- **Foreign `sto-*` containers (`before-sto-containers.txt` / `after-sto-containers.txt` — Environment Note per `TEST-STRATEGY.md` §5.4):**
  - Before (`20:30:26Z`): `0` `sto-*` containers.
  - After (`20:38:43Z`): `2` foreign `sto-it-*` containers (`6a20adc90ab3` `sto-it-mq-8862594d4908` `rabbitmq:4.2.6-management-alpine` on `127.0.0.1:55001-55002`, and `7e6650d4f894` `sto-it-72cf30371d0f` `postgres:18.6` on `127.0.0.1:55000`) plus their `2` anonymous Docker volumes (`d67771d5df0d1e3cf9f10951fbd3cef9813d9216cee8ecb4e6f6ca750c585e7b`, `d8791f0bc5fbd00f7e45e771f1a2696ea7cb7b7f608187ad71b643f2cb988379`).
  - **Cause (`TEST-STRATEGY.md` §5.4):** Started by a sibling workspace's `go test` integration suite (`cmd/txn-orchestrator` / `internal/ingest`, recorded in `host-ps-watcher.log`). Listed apart in `after-sto-containers.txt` and never touched by QA.
- **Networks (`before-networks.txt` / `after-networks.txt` / `*-networks-inspect.json`):**
  - Before: `3` default networks (`bridge`, `host`, `none`)
  - After: `3` default networks (`bridge`, `host`, `none`); `0` `qa-e2e-la-drill-*` networks remaining.
- **32 Protected Baseline Volumes (`baseline-32-volume-names.txt`, `before-volumes-inspect.json`, `after-volumes-inspect.json`, `baseline-32-volumes-inspect.diff`):**
  - All 32 protected baseline volumes (`cogniate-codex_moodledata`, `cogniate-codex_pgdata`, `cogniate-codex2_moodledata`, `cogniate-codex2_pgdata`, `cogniate-stack_e2e_tests_node_modules`, `cogniate-stack_moodledata`, `cogniate-stack_pgdata`, plus 25 anonymous baseline volumes) were inspected before (`20:30:26Z`) and after (`20:38:43Z`).
  - `diff -u before-volumes-inspect.json after-volumes-inspect.json` (`baseline-32-volumes-inspect.diff`) is **`0` bytes (`0` lines)** — every protected baseline volume is byte-for-byte untouched.
  - `0` `qa-e2e-la-drill-*` volumes remain after teardown.
- **Continuous Watchers (`20:30:45Z` to `20:38:43Z`):**
  - `boundary/docker-events-watch.log` (`3.2 MB`, JSON event stream from `2026-10-23T20:30:00Z` through teardown)
  - `boundary/host-ps-watcher.log` (`23 MB`, 5-second `ps -axo pid,ppid,pgid,comm,args` samples across the entire drill window)

---

# Round 1 History (Preserved)

Verdict: PASS (HOST-ONLY); K1-SIM live stack drill pending Docker window
Round: 1

## LA-E5-24 Pilot backup and restore drill: QA verification (Round 1 host-only)

Tester: QA-E2E (Orca task `task_99872cc0e28d`, dispatch `ctx_79ac5a1843bd`, run `run_06d07dc77faf`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E5-24.md` (`LA-ADR-06` D3, D6, D10, D14; `docs/architecture/ltiaas/operability.md` §7, §7.2, §7.3; `docs/architecture/ltiaas/tasks/README.md` §2 form (g), form (h), §6). Suite: `tests/e2e/ltiaas/{run-la-e5-24.mjs,la-e5-24-drill.mjs,la-e5-24-container-step.mjs,la-e5-24-drill.selftest.mjs}`.

### Round 1 summary (host-only authoring and dry-run at `053ea576`, code = `02f5d420`)

- **SHA verified:** `053ea576f1e07834b359c8e7297f1effedcf1f57` (product code `02f5d420`)
- **Mode:** Host-only authoring and dry-run under active `DOCKER BAN` (`0` Docker, `docker compose`, or `stack:*` commands executed)
- **Isolated clone path:** `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E5-24/r1/repo` (`--no-hardlinks`, outer directory `0700`, push remote `DISABLED`)
- **Artifacts:** `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E5-24/r1/artifacts/` (`la-e5-24-dry-run-summary.json`, `la-e5-24-selftest.log`, `dry-run.log`)
- **Independence:** Authored strictly from `docs/architecture/ltiaas/tasks/LA-E5-24.md`, `docs/architecture/ltiaas/operability.md` (§7, §7.2, §7.3), `docs/architecture/ltiaas/adr/LA-ADR-06-service-operability.md`, `docs/architecture/ltiaas/contracts/lti-service-api-delta.md` (§2.5, §3), `docs/architecture/ltiaas/contracts/cogniate-app-api-delta.md` (§3, §8a), and `infra/scripts/{stack-data.sh,stack-data.mjs,sqlite-lock-probe.mjs}`. Zero product service or package source files (`services/**`, `packages/**`, `apps/**`) were read.

### Round 1 Acceptance criteria

| AC | Host dry-run status | Live `K1-SIM` stack status | Test id / file | Command | Evidence / notes |
| --- | --- | --- | --- | --- | --- |
| `AC-LA-E5-24-01` | `PASS (HOST-DRY-RUN)` | `pending: Docker window` | `tests/e2e/ltiaas/la-e5-24-drill.selftest.mjs` (`AC-LA-E5-24-01`) + `tests/e2e/ltiaas/run-la-e5-24.mjs` (`--dry-run`) | `node tests/e2e/ltiaas/run-la-e5-24.mjs --dry-run --sha 053ea576 --source ~/cogniate-qa-runs/LA/LA-E5-24/r1/repo --artifacts-dir ~/cogniate-qa-runs/LA/LA-E5-24/r1/artifacts` | Exercises `volumeBackup()` and `validate()` from `infra/scripts/stack-data.mjs` + `inspectDrillBackup()` on real SQLite database files (`lti-service/lti.db`, `cogniate-app/cogniate.db`) in an external `0700` backup folder (`<drillRoot>/db`): verifies `formatVersion: 1`, UUID `backupId`, `composeProject`, `source: "volume"`, 32-hex `pairId`, `generation`, file sizes, SHA-256 digests, and per-service `schema_migration` lists (`3` LTI + `3` App migrations). Negative controls verify refusal of `project_mismatch`, `backup_incomplete` (`INCOMPLETE` marker), and `backup_damaged` (corrupted byte or missing DB file). |
| `AC-LA-E5-24-02` | `PASS (HOST-DRY-RUN)` | `pending: Docker window` | `tests/e2e/ltiaas/la-e5-24-drill.selftest.mjs` (`AC-LA-E5-24-02`) + `tests/e2e/ltiaas/run-la-e5-24.mjs` (`--dry-run`) | same | `buildBackupRecord()` writes `<drillRoot>/backup-record.json` (sibling of `<drillRoot>/db`) with `keyProvider: { kind, activeVersion, versionIds, versions }` extracted from `GET /operator/v1/key-provider` and strips any stray properties. `scanBackupRecordForSecrets()` verifies `0` hits across `backup-record.json` and `manifest.json` against candidate secrets (`LTI_MASTER_KEY`, `APP_MASTER_KEY`, `ltio_...` operator key, `ltis_...` tenant API key) and 4 key-material regex patterns (`operator_key_token`, `tenant_api_key_token`, `pem_private_key`, `raw_key_property`); negative controls verify all 5 planted leak forms are caught. |
| `AC-LA-E5-24-03` | `PASS (HOST-DRY-RUN)` | `pending: Docker window` | `tests/e2e/ltiaas/la-e5-24-drill.selftest.mjs` (`AC-LA-E5-24-03 & AC-LA-E5-24-04`) + `tests/e2e/ltiaas/la-e5-24-container-step.mjs` (`--step post-backup-write`) | same | `buildDrillMarkerAccount(runId, publicAppUrl)` builds `{ id: "drill-<runId>", name: "Drill Marker <runId>", launchUrl, deepLinkingUrl, registrationUrl }` for `POST /operator/v1/accounts` (`201`) and verifies `drill-<runId>` is present in the pre-restore `tool_account` state. |
| `AC-LA-E5-24-04` | `PASS (HOST-DRY-RUN)` | `pending: Docker window` | `tests/e2e/ltiaas/la-e5-24-drill.selftest.mjs` (`AC-LA-E5-24-03 & AC-LA-E5-24-04`) + `tests/e2e/ltiaas/la-e5-24-container-step.mjs` (`--step post-restore-verify`) | same | Exercises `volumeRestore()` from `infra/scripts/stack-data.mjs` in the same compose project (`qa-e2e-la-drill-r1`), verifies `exit 0`, byte-for-byte restoration of `lti.db` and `cogniate.db`, removal of planted stale `lti.db-wal` sidecar, committed `.storage-journal.json` records (`state: "committed"`, matching `opId` and `backupId`) in both volumes, and `verifyDrillMarkerAbsent()` confirming `drill-<runId>` is absent after restore (plus `GET /operator/v1/accounts/drill-<runId>` -> `404`, LTI `/readyz` -> `200`, and App `/healthz` + operator `/readyz` -> `200` in container step). |
| `AC-LA-E5-24-05` | `PASS (HOST-DRY-RUN)` | `pending: Docker window` | `tests/e2e/ltiaas/la-e5-24-drill.selftest.mjs` (`AC-LA-E5-24-05`) + `tests/e2e/ltiaas/la-e5-24-container-step.mjs` (`--step pre-backup`, `--step post-restore-verify`) | same | Verifies `copyContentFolders()` and `restoreContentFolders()` round-trip for `infra/.data/cogniate-app/{packages,uploads}` (removing post-backup unreferenced package folders before `stack:data-restore` `contentCheck`), validates the 10-question HTML course ZIP archive (`makeHtmlCourseZipBuffer()`), and syntax-checks `la-e5-24-container-step.mjs` which performs the post-restore `moodle-sim` learner launch (`/lti/login/cogniate` -> `moodle.sim.test` OIDC auth -> `/lti/launch/cogniate` -> `/tool/launch` -> `/play/ply_...` -> `/rt/<token>/commit` score `90/100`) and polls `/__sim/records` (`scoreGiven: 90, scoreMaximum: 100`) + `/app-api/publications/:id/results` (`status: "sent"`). |
| `AC-LA-E5-24-06` | `PASS (HOST-DRY-RUN)` | `pending: Docker window` | `tests/e2e/ltiaas/la-e5-24-drill.selftest.mjs` (`AC-LA-E5-24-06`) + `tests/e2e/ltiaas/run-la-e5-24.mjs` | same | `computeDrillMetrics()` records `backupCreatedAt`, `restoreStartedAt`, `restoreCompletedAt`, `rtoMs` (`restoreCompletedAt - restoreStartedAt`), and `rpoMs` (`restoreStartedAt - backupCreatedAt`); removes the external backup folder in `finally` and tears down the drill project (`TEARDOWN` in `core.mjs`). |

### Round 1 Host dry-run and selftest execution summary (`053ea576`)

| Suite | Command | Result | Time | Evidence |
| --- | --- | --- | --- | --- |
| `la-e5-24-drill.selftest.mjs` (`node:test`) | `node --test tests/e2e/ltiaas/la-e5-24-drill.selftest.mjs` | `5/5` passed | `260.3 ms` | `~/cogniate-qa-runs/LA/LA-E5-24/r1/artifacts/la-e5-24-selftest.log` |
| `run-la-e5-24.mjs --dry-run` (all 6 ACs) | `node tests/e2e/ltiaas/run-la-e5-24.mjs --dry-run --sha 053ea576 --source ~/cogniate-qa-runs/LA/LA-E5-24/r1/repo --artifacts-dir ~/cogniate-qa-runs/LA/LA-E5-24/r1/artifacts` | `6/6` ACs `PASS (HOST-DRY-RUN)` | `558 ms` | `~/cogniate-qa-runs/LA/LA-E5-24/r1/artifacts/la-e5-24-dry-run-summary.json`, `dry-run.log` |
