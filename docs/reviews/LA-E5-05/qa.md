Verdict: PASS
Round: 4

# LA-E5-05 LTI CLIs as operator API clients: QA verification

## K1-SIM Docker slot 1 (`4209dcb`, Batch 3 on `qa2-la-sim-r3`)

Tester: QA-2 (Orca task `task_0336155284b2`, dispatch `ctx_c5845e359f4b`, run `run_06d07dc77faf`), 2026-10-23. Verified in SIM slot 1 (`04:41Z–05:29Z`) on a clean `--no-hardlinks` clone of `4209dcb` (product code `77df44e`) in `~/cogniate-qa-runs/LA/qa2-sim-4209dcb/clone-batch3` (`COMPOSE_PROJECT_NAME=qa2-la-sim-r3`, `PUBLIC_PORT=9443`, `STACK_SUBNET=172.20.0.0/16`).

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E5-05-01 .. 08 | PASS (K1-SIM) | `tests/ltiaas/tasks-ops/LA-E5-05/cli.test.ts` (8 `K1-SIM` tests: `AC-LA-E5-05-01` .. `08`, plus `B-LA-E5-05-04` recovery text) | `COMPOSE_PROJECT_NAME=qa2-la-sim-r3 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 node tests/ltiaas/tasks-ops/run-batch3.mjs --sha 4209dcb --workdir ~/cogniate-qa-runs/LA/qa2-sim-4209dcb/clone-batch3 --replace-tests` | All 8 `K1-SIM` tests pass (`container-LA-E5-05`, `8/8` passed in `7530 ms`; artifacts at `tests/host/artifacts/qa2-la-sim-r3-4209dcb-2026-10-23T05-11-11-546Z`, log `~/cogniate-qa-runs/LA/qa2-sim-4209dcb/logs/batch-3.log`). |

---

## Round 3 (fix round 2, `dc88b7d` at `836d579`)

Tester: QA-2 (Orca task `task_629a1e81d6ee`, dispatch `ctx_11b32368a088`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E5-05.md` (with `BD-A2-02`, `BD-A2-14`, `BD-A2-33`, `BD-A2-34`, `B-LA-E5-05-04`). Suite: `tests/ltiaas/tasks-ops/LA-E5-05/` (updated in Round 3 with the `B-LA-E5-05-04` recovery-text assertion on `AC-LA-E5-05-07`).

Independence: QA-2 did not read product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files to write `tests/ltiaas/tasks-ops/LA-E5-05/` or during this host-only run on `836d579`. QA-2 verified all host-only UNIT, infra (`node --test`), K0 and suite checks in an isolated `--no-hardlinks` clone of `836d579`.

| Item | Value |
| --- | --- |
| SHA | `836d579f2a42f7d44b6e470d1e74a17bb46aaee2` (integration `836d579`; holds `LA-E5-05` commit `dc88b7d`) |
| Lane and slot | lane S1; no Docker (`HOST-ONLY`; `K1-SIM` rows marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/qa2-r7-836d579/clone`: `git clone --no-hardlinks`, detached at `836d579f2a42f7d44b6e470d1e74a17bb46aaee2`, push URL `DISABLED`, `npm ci` at root and `tests/` |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/qa2-r7-836d579/logs/` (umask 077): `npm-ci-root.log`, `npm-ci-tests.log`, `check.log`, `e5-05-r3-unit.log`, `e5-05-r3-infra.log`, `qa-suites-host.log`, `task-commits-stat.txt`, `head.txt`, `status-after.txt` |

### Round 3 fix row (`dc88b7d`, `B-LA-E5-05-04`)

| Item | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| B-LA-E5-05-04 (`dc88b7d`: 401 and missing-key recovery text gives `--replace-operator-key` last and says that it revokes every operator key) | PASS (UNIT + INFRA); K1-SIM pending: Docker window | `services/lti-service/src/cli/operator-client.test.ts > names the host file and a real recovery path when the server rejects the copied key` + `infra/scripts/lti-bootstrap.test.mjs > a missing original stops bootstrap and deletes a stale mounted operator copy` + `tests/ltiaas/tasks-ops/LA-E5-05/cli.test.ts > AC-LA-E5-05-07` | `npx --no-install vitest run --reporter=verbose services/lti-service/src/cli/bootstrap.test.ts services/lti-service/src/cli/operator-client.test.ts services/lti-service/src/cli/shared-platform.test.ts services/lti-service/src/http/routes/multi-lms.test.ts && node --test infra/scripts/lti-bootstrap.test.mjs` | Both the operator client `401` message and the `lti-bootstrap.sh` missing-key / help lines first instruct the operator to put the current key in `infra/.secrets/lti-operator-key` or ask another operator to issue a new key, and give `--replace-operator-key (init --replace)` last with the warning `"This revokes every operator key, also the keys of other operators and scripts."` (and without `"safely"`). `e5-05-r3-unit.log`, `e5-05-r3-infra.log`, `qa-suites-host.log` |

### R0 `npm run check` counts at `836d579` (`check.log`)

| Suite | LA-E0-01 (`1b17261`) | Round 1–2 (`d40826d`) | Round 3 (`836d579`) |
| --- | --- | --- | --- |
| Vitest (`test:unit`) | 97 files; 1,351 passed, 5 skipped | 155 files; 2,498 passed, 5 skipped | 169 files; 2,743 passed, 5 skipped |
| Infra (`test:infra`, `node --test`) | 197 pass, 0 fail | 243 pass, 0 fail (23 suites) | 252 pass, 0 fail (23 suites) |
| K0 (`test:k0`) | — | 3 files; 121 passed | 3 files; 121 passed |
| F1 (`fitness:lms-names`) | — | `F1 PASS: 20 files with hits, 74 hits` | `F1 PASS: 9 files with hits, 29 hits` |
| F5 (`fitness:rules`) | — | `F5 PASS: 6 rules, 0 hits` | `F5 PASS: 6 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability), 0 hits` |

### Round 3 other checks and timing

- **File scope (`dc88b7d`):** Touches only `infra/scripts/lti-bootstrap.sh`, `infra/scripts/lti-bootstrap.test.mjs`, `services/lti-service/src/cli/operator-client.ts`, and `services/lti-service/src/cli/operator-client.test.ts` (`task-commits-stat.txt`).
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/qa2-r7-836d579/clone` is empty after the run (`status-after.txt`, 0 bytes).
- **Timing:** Focused 4-file unit run (`e5-05-r3-unit.log`, 47 tests): `2.63 s`; infra `lti-bootstrap.test.mjs` (`e5-05-r3-infra.log`, 5 tests): `0.71 s`. QA-2 host-only suite checks (`tsc --noEmit`, `vitest list` 8 `K1-SIM` cases, `node --check run.mjs`): PASS (`qa-suites-host.log`).

---

## Round 1–2 (at `d40826d`)

Tester: QA-2 (Orca task `task_756d65316a50`, dispatch `ctx_eb2462bb36b5`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E5-05.md` (with `BD-A2-02`, `BD-A2-14`, `BD-A2-33`, `BD-A2-34`, `Q-LAB-01`). Suite: `tests/ltiaas/tasks-ops/LA-E5-05/` (QA-2 test-first, updated in `d40826d`).

Independence: QA-2 did not read product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files to write `tests/ltiaas/tasks-ops/LA-E5-05/` or during this host-only run on `d40826d`. QA-2 verified all host-only UNIT, infra (`node --test`), K0 and suite checks in an isolated `--no-hardlinks` clone of `d40826d`.

| Item | Value |
| --- | --- |
| SHA | `d40826d765649b5ece01e23d26e53ccd2df7a14b` (integration `d40826d`; holds `LA-E5-05` Round 1 merge `8706619`, fix round 1 `6ae0ebe` (`541e13e`), and QA-2 suite `d40826d`) |
| Lane and slot | lane S1; no Docker (`HOST-ONLY`; `K1-SIM` rows marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/qa2-r5-d40826d/clone`: `git clone --no-hardlinks --no-checkout`, detached at `d40826d765649b5ece01e23d26e53ccd2df7a14b`, push URL `DISABLED`, `npm ci` at root and `tests/` |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/qa2-r5-d40826d/logs/` (umask 077): `npm-ci.log`, `check.log`, `e5-05-unit.log`, `e5-05-infra.log`, `e5-05-qa-host.log`, `task-merges-stat.txt`, `rev.txt`, `remotes.txt`, `status-after.txt` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E5-05-01 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-05/cli.test.ts > AC-LA-E5-05-01` + Author unit tests: `services/lti-service/src/cli/bootstrap.test.ts > creates and repeats cogniate / qa-second / another-tool through audited requests while preserving URLs and omitted names`, `runs the symlinked CLI entry point with one JSON stdout line` | `npx --no-install vitest run --reporter=verbose services/lti-service/src/cli/bootstrap.test.ts services/lti-service/src/cli/operator-client.test.ts services/lti-service/src/cli/shared-platform.test.ts && node --test infra/scripts/lti-bootstrap.test.mjs && npx --prefix tests tsc --noEmit -p tests/ltiaas/tasks-ops/LA-E5-05/tsconfig.json && npx --prefix tests vitest list --config tests/ltiaas/tasks-ops/LA-E5-05/vitest.config.mts` | Waits for a SIM Docker window (`npm run lti:bootstrap -- --account cogniate --name Cogniate` on a fresh stack). Unit and infra tests pass now (`bootstrap.test.ts`, `lti-bootstrap.test.mjs`; `e5-05-unit.log`, `e5-05-infra.log`, `e5-05-qa-host.log`). |
| AC-LA-E5-05-02 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-05/cli.test.ts > AC-LA-E5-05-02` + `services/lti-service/src/cli/bootstrap.test.ts` | as AC-01 | Waits for a SIM Docker window (one audit event per change with actor `operator:<name of the key file>`). Verified at unit level against an in-process operator API server in `bootstrap.test.ts` (`e5-05-unit.log`). |
| AC-LA-E5-05-03 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-05/cli.test.ts > AC-LA-E5-05-03` + `services/lti-service/src/cli/bootstrap.test.ts > creates and repeats ... through audited requests` + `infra/scripts/lti-bootstrap.test.mjs > a second run keeps API keys and refreshes the mounted operator copy from the original` | as AC-01 | Waits for a SIM Docker window (second run without flags prints `created: false` and no `apiKey`, and writes no `api_key.issue` event). Passes at unit/infra level (`e5-05-unit.log`, `e5-05-infra.log`). |
| AC-LA-E5-05-04 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-05/cli.test.ts > AC-LA-E5-05-04` + `services/lti-service/src/cli/bootstrap.test.ts > BD-A2-33: emergency rotation replaces both active keys in one audited issue call`, `a failed atomic rotation preserves both old keys and returns no replacement secret`, `explains a lost rotation answer and repairs it on an explicit rerun` | as AC-01 | Waits for a SIM Docker window (`--rotate-api-key` on a fresh account). Unit tests verify atomic `POST …/api-keys {revokeOthers: true}` (`BD-A2-33`) and actionable recovery on lost rotation answers (`541e13e`, `e5-05-unit.log`). |
| AC-LA-E5-05-05 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-05/cli.test.ts > AC-LA-E5-05-05` + `services/lti-service/src/cli/bootstrap.test.ts > the service seals first and rotated signing keys with its own provider (ring=true/false)` | as AC-01 | Waits for a SIM Docker window (`--rotate-signing-key` on a fresh account retires any `next` key with `{immediate: true}` per `BD-A2-14`, creates and force-activates a new key, lists it first on JWKS, and logs `signing_key.activate` with `details.forced: true`). Passes at unit level (`e5-05-unit.log`). |
| AC-LA-E5-05-06 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-05/cli.test.ts > AC-LA-E5-05-06` + `services/lti-service/src/cli/shared-platform.test.ts > maps create and repeat status to the unchanged output and forwards failures`, `names the unknown account in the shared-platform CLI error` | as AC-01 | Waits for a SIM Docker window (`lti:shared-platform` for an existing shared platform with the same client id prints the same output and creates no second platform). Passes at unit level (`e5-05-unit.log`). |
| AC-LA-E5-05-07 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-05/cli.test.ts > AC-LA-E5-05-07` + `services/lti-service/src/cli/operator-client.test.ts > bootstrap.ts exits 1 with one key-file line and leaves database bytes untouched`, `shared-platform.ts exits 1 with one key-file line and leaves database bytes untouched`, `names the host file and a real recovery path when the server rejects the copied key` + `infra/scripts/lti-bootstrap.test.mjs > a missing original stops bootstrap and deletes a stale mounted operator copy` | as AC-01 | Waits for a SIM Docker window (renamed `infra/.secrets/lti-operator-key` deletes the copy per `BD-A2-34`, exits 1 naming the key file, and leaves `lti.db` unchanged). Passes at unit and infra test levels (`e5-05-unit.log`, `e5-05-infra.log`). |
| AC-LA-E5-05-08 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-05/cli.test.ts > AC-LA-E5-05-08` + `infra/scripts/lti-bootstrap.test.mjs > a second run keeps API keys and refreshes the mounted operator copy from the original` | as AC-01 | Waits for a SIM Docker window (`npm run seed` twice on the same volume per `BD-A2-02` issues no second operator key and no second API key). Wrapper behavior passes in `lti-bootstrap.test.mjs` (`e5-05-infra.log`). |

### R0 `npm run check` counts at `d40826d` (`check.log`)

| Suite | LA-E0-01 (`1b17261`) | At `d40826d` |
| --- | --- | --- |
| Vitest (`test:unit`) | 97 files; 1,351 passed, 5 skipped | 155 files; 2,498 passed, 5 skipped |
| Infra (`test:infra`, `node --test`) | 197 pass, 0 fail | 243 pass, 0 fail (23 suites) |
| K0 (`test:k0`) | — | 3 files; 121 passed |
| F1 (`fitness:lms-names`) | — | `F1 PASS: 20 files with hits, 74 hits` |
| F5 (`fitness:rules`) | — | `F5 PASS: 6 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability), 0 hits` |

## Other checks

- **File scope (`8706619` and fix round `541e13e` in `6ae0ebe`):** `LA-E5-05` touches `services/lti-service/src/cli/{bootstrap,bootstrap.test,operator-client,operator-client.test,shared-platform,shared-platform.test}.ts`, `infra/scripts/{lti-bootstrap.sh,lti-bootstrap.test.mjs,stack-reset.sh}`, and `services/lti-service/src/http/routes/multi-lms.test.ts` (`task-merges-stat.txt`). Does not touch `services/lti-service/src/http/operator/**` or `infra/scripts/seed.sh`.
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/qa2-r5-d40826d/clone` is empty after the run (`status-after.txt`, 0 bytes).

## Regression and time

R0 (`npm run check` on the clean clone): PASS (`48.35 s` unit, `0.70 s` K0). Focused 5-file unit run (`e5-05-unit.log`, 47 tests): `1.00 s`; infra `lti-bootstrap.test.mjs` (5 tests): `0.72 s`. QA-2 host-only suite checks (`tsc --noEmit`, `vitest list` 8 `K1-SIM` cases, `node --check run.mjs`): PASS (`1.6 s`). `AC-LA-E5-05-01` .. `08` (`K1-SIM`), `M1 --phase sim`, and SIM area regressions are `pending: Docker window`.
