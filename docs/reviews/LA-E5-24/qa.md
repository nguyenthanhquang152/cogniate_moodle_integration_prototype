Verdict: PASS (HOST-ONLY); K1-SIM live stack drill pending Docker window
Round: 1

# LA-E5-24 Pilot backup and restore drill: QA verification (Round 1 host-only)

Tester: QA-E2E (Orca task `task_99872cc0e28d`, dispatch `ctx_79ac5a1843bd`, run `run_06d07dc77faf`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E5-24.md` (`LA-ADR-06` D3, D6, D10, D14; `docs/architecture/ltiaas/operability.md` §7, §7.2, §7.3; `docs/architecture/ltiaas/tasks/README.md` §2 form (g), form (h), §6). Suite: `tests/e2e/ltiaas/{run-la-e5-24.mjs,la-e5-24-drill.mjs,la-e5-24-container-step.mjs,la-e5-24-drill.selftest.mjs}`.

## Round 1 summary (host-only authoring and dry-run at `053ea576`, code = `02f5d420`)

- **SHA verified:** `053ea576f1e07834b359c8e7297f1effedcf1f57` (product code `02f5d420`)
- **Mode:** Host-only authoring and dry-run under active `DOCKER BAN` (`0` Docker, `docker compose`, or `stack:*` commands executed)
- **Isolated clone path:** `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E5-24/r1/repo` (`--no-hardlinks`, outer directory `0700`, push remote `DISABLED`)
- **Artifacts:** `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E5-24/r1/artifacts/` (`la-e5-24-dry-run-summary.json`, `la-e5-24-selftest.log`, `dry-run.log`)
- **Independence:** Authored strictly from `docs/architecture/ltiaas/tasks/LA-E5-24.md`, `docs/architecture/ltiaas/operability.md` (§7, §7.2, §7.3), `docs/architecture/ltiaas/adr/LA-ADR-06-service-operability.md`, `docs/architecture/ltiaas/contracts/lti-service-api-delta.md` (§2.5, §3), `docs/architecture/ltiaas/contracts/cogniate-app-api-delta.md` (§3, §8a), and `infra/scripts/{stack-data.sh,stack-data.mjs,sqlite-lock-probe.mjs}`. Zero product service or package source files (`services/**`, `packages/**`, `apps/**`) were read.

## Acceptance criteria

| AC | Host dry-run status | Live `K1-SIM` stack status | Test id / file | Command | Evidence / notes |
| --- | --- | --- | --- | --- | --- |
| `AC-LA-E5-24-01` | `PASS (HOST-DRY-RUN)` | `pending: Docker window` | `tests/e2e/ltiaas/la-e5-24-drill.selftest.mjs` (`AC-LA-E5-24-01`) + `tests/e2e/ltiaas/run-la-e5-24.mjs` (`--dry-run`) | `node tests/e2e/ltiaas/run-la-e5-24.mjs --dry-run --sha 053ea576 --source ~/cogniate-qa-runs/LA/LA-E5-24/r1/repo --artifacts-dir ~/cogniate-qa-runs/LA/LA-E5-24/r1/artifacts` | Exercises `volumeBackup()` and `validate()` from `infra/scripts/stack-data.mjs` + `inspectDrillBackup()` on real SQLite database files (`lti-service/lti.db`, `cogniate-app/cogniate.db`) in an external `0700` backup folder (`<drillRoot>/db`): verifies `formatVersion: 1`, UUID `backupId`, `composeProject`, `source: "volume"`, 32-hex `pairId`, `generation`, file sizes, SHA-256 digests, and per-service `schema_migration` lists (`3` LTI + `3` App migrations). Negative controls verify refusal of `project_mismatch`, `backup_incomplete` (`INCOMPLETE` marker), and `backup_damaged` (corrupted byte or missing DB file). |
| `AC-LA-E5-24-02` | `PASS (HOST-DRY-RUN)` | `pending: Docker window` | `tests/e2e/ltiaas/la-e5-24-drill.selftest.mjs` (`AC-LA-E5-24-02`) + `tests/e2e/ltiaas/run-la-e5-24.mjs` (`--dry-run`) | same | `buildBackupRecord()` writes `<drillRoot>/backup-record.json` (sibling of `<drillRoot>/db`) with `keyProvider: { kind, activeVersion, versionIds, versions }` extracted from `GET /operator/v1/key-provider` and strips any stray properties. `scanBackupRecordForSecrets()` verifies `0` hits across `backup-record.json` and `manifest.json` against candidate secrets (`LTI_MASTER_KEY`, `APP_MASTER_KEY`, `ltio_...` operator key, `ltis_...` tenant API key) and 4 key-material regex patterns (`operator_key_token`, `tenant_api_key_token`, `pem_private_key`, `raw_key_property`); negative controls verify all 5 planted leak forms are caught. |
| `AC-LA-E5-24-03` | `PASS (HOST-DRY-RUN)` | `pending: Docker window` | `tests/e2e/ltiaas/la-e5-24-drill.selftest.mjs` (`AC-LA-E5-24-03 & AC-LA-E5-24-04`) + `tests/e2e/ltiaas/la-e5-24-container-step.mjs` (`--step post-backup-write`) | same | `buildDrillMarkerAccount(runId, publicAppUrl)` builds `{ id: "drill-<runId>", name: "Drill Marker <runId>", launchUrl, deepLinkingUrl, registrationUrl }` for `POST /operator/v1/accounts` (`201`) and verifies `drill-<runId>` is present in the pre-restore `tool_account` state. |
| `AC-LA-E5-24-04` | `PASS (HOST-DRY-RUN)` | `pending: Docker window` | `tests/e2e/ltiaas/la-e5-24-drill.selftest.mjs` (`AC-LA-E5-24-03 & AC-LA-E5-24-04`) + `tests/e2e/ltiaas/la-e5-24-container-step.mjs` (`--step post-restore-verify`) | same | Exercises `volumeRestore()` from `infra/scripts/stack-data.mjs` in the same compose project (`qa-e2e-la-drill-r1`), verifies `exit 0`, byte-for-byte restoration of `lti.db` and `cogniate.db`, removal of planted stale `lti.db-wal` sidecar, committed `.storage-journal.json` records (`state: "committed"`, matching `opId` and `backupId`) in both volumes, and `verifyDrillMarkerAbsent()` confirming `drill-<runId>` is absent after restore (plus `GET /operator/v1/accounts/drill-<runId>` -> `404`, LTI `/readyz` -> `200`, and App `/healthz` + operator `/readyz` -> `200` in container step). |
| `AC-LA-E5-24-05` | `PASS (HOST-DRY-RUN)` | `pending: Docker window` | `tests/e2e/ltiaas/la-e5-24-drill.selftest.mjs` (`AC-LA-E5-24-05`) + `tests/e2e/ltiaas/la-e5-24-container-step.mjs` (`--step pre-backup`, `--step post-restore-verify`) | same | Verifies `copyContentFolders()` and `restoreContentFolders()` round-trip for `infra/.data/cogniate-app/{packages,uploads}` (removing post-backup unreferenced package folders before `stack:data-restore` `contentCheck`), validates the 10-question HTML course ZIP archive (`makeHtmlCourseZipBuffer()`), and syntax-checks `la-e5-24-container-step.mjs` which performs the post-restore `moodle-sim` learner launch (`/lti/login/cogniate` -> `moodle.sim.test` OIDC auth -> `/lti/launch/cogniate` -> `/tool/launch` -> `/play/ply_...` -> `/rt/<token>/commit` score `90/100`) and polls `/__sim/records` (`scoreGiven: 90, scoreMaximum: 100`) + `/app-api/publications/:id/results` (`status: "sent"`). |
| `AC-LA-E5-24-06` | `PASS (HOST-DRY-RUN)` | `pending: Docker window` | `tests/e2e/ltiaas/la-e5-24-drill.selftest.mjs` (`AC-LA-E5-24-06`) + `tests/e2e/ltiaas/run-la-e5-24.mjs` | same | `computeDrillMetrics()` records `backupCreatedAt`, `restoreStartedAt`, `restoreCompletedAt`, `rtoMs` (`restoreCompletedAt - restoreStartedAt`), and `rpoMs` (`restoreStartedAt - backupCreatedAt`); removes the external backup folder in `finally` and tears down the drill project (`TEARDOWN` in `core.mjs`). |

## Host dry-run and selftest execution summary (`053ea576`)

| Suite | Command | Result | Time | Evidence |
| --- | --- | --- | --- | --- |
| `la-e5-24-drill.selftest.mjs` (`node:test`) | `node --test tests/e2e/ltiaas/la-e5-24-drill.selftest.mjs` | `5/5` passed | `260.3 ms` | `~/cogniate-qa-runs/LA/LA-E5-24/r1/artifacts/la-e5-24-selftest.log` |
| `run-la-e5-24.mjs --dry-run` (all 6 ACs) | `node tests/e2e/ltiaas/run-la-e5-24.mjs --dry-run --sha 053ea576 --source ~/cogniate-qa-runs/LA/LA-E5-24/r1/repo --artifacts-dir ~/cogniate-qa-runs/LA/LA-E5-24/r1/artifacts` | `6/6` ACs `PASS (HOST-DRY-RUN)` | `558 ms` | `~/cogniate-qa-runs/LA/LA-E5-24/r1/artifacts/la-e5-24-dry-run-summary.json`, `dry-run.log` |

## Command for Round 2 live `K1-SIM` stack drill (when `DOCKER-YES` SIM window is granted)

```sh
COMPOSE_PROJECT_NAME=qa-e2e-la-drill-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 \
  node tests/e2e/ltiaas/run-la-e5-24.mjs --sha 053ea576 --replace-tests
```
