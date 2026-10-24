# QA Review — `LA-E7-09` (`R2-sim` Moodle-Shaped Standard Simulator Channel End-to-End & Wave-End Gate)

Verdict: PASS
Round: 4
SHA: `a7bd110e9c6d504c69a6c0608cbdeef80feff942` (`a7bd110e`, product `8fadb828088ffe1b4db02179ab0fa3ab2388a12a`; Slot 8 `f34b27dfe45599676b47f09fae85924ccfdbe5d5`; Slot 6 `195930c1b56c7b78bfaa7776cbeec6da40cf4f87`)

- **Lane / Slot**: `QA-E2E` (`term_80640d06-310f-4eac-bc95-872fd936d43c`), Docker Slot 6 (`12:07Z–13:05Z`)
- **Compose Project**: `COMPOSE_PROJECT_NAME=qa-e2e-la-sim-r1` (`PUBLIC_PORT=9443`, `STACK_SUBNET=172.20.0.0/16`)
- **Run ID**: `qa-e2e-la-sim-r1-195930c1-2026-10-23T12-43-21-483Z`
- **Measured Time**: `32.6 s` Playwright suite execution (`24.8 s` + `7.8 s`); `104.5 s` full stack lifecycle (`gen-env`, `stack:up`, `seed`, `e2e` container run, secret scan, `stack:down`)
- **Private Run & Boundary Dir (`umask 077`)**: `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT6-195930c1/`

---

## 1. Slot 6 `LA-E7-09` `R2-sim` Acceptance Criteria (`AC-01`..`AC-08`)

Command executed:

```sh
COMPOSE_PROJECT_NAME=qa-e2e-la-sim-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 \
COURSE_FIXTURES_DIR=/Users/quangnguyen/cogniate-qa-runs/qa-multi-r1-bf09cdad-2026-10-22T12-05-24-521Z/tests/fixtures/courses \
node tests/e2e/ltiaas/run-k2.mjs --suite r2-sim --sha 195930c1 \
  --source /Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/ltiaas-milestone \
  --workdir /Users/quangnguyen/cogniate-qa-runs/LA/SLOT6-195930c1/r2-sim-clone \
  --replace-tests --tests-from /Users/quangnguyen/cogniate-qa-runs/LA/SLOT6-195930c1/repo/tests
```

| AC | Criterion | Status | Test ID | Measured Time | Evidence Artifact |
|---|---|---|---|---|---|
| `AC-01` | Manual Moodle connect on `moodle-sim` (`https://moodle.sim.test`) via `/integrations/moodle/connect` (`standard` profile, `self` binding authority, transitions `pending` -> `registered` without an operator grant) | **PASS** | `R2-SIM.connect-mbz-deeplink-and-grades` | `24.8 s` | `.../r2-sim-case-results.json`, `.../cmd/08-r2-sim-browser-pass.log` |
| `AC-02` | Moodle `.mbz` backup capability (`capabilities['export.packages'] = ['mbz']`): renders `Moodle backup (.mbz) – Moodle only` on the SCORM 1.2 course page and accepts `POST` + `GET /app-api/courses/:id/versions/:vId/mbz` | **PASS** | `R2-SIM.connect-mbz-deeplink-and-grades` | `24.8 s` | `.../r2-sim-case-results.json`, `.../cmd/08-r2-sim-browser-pass.log` |
| `AC-03` | Teacher Deep Linking pick inside `https://moodle.sim.test/__frame`: returns `ltiResourceLink` item with `resource=pub_<id>` and omits `window` hint (`launch.windowHint = false` on `moodle`) | **PASS** | `R2-SIM.connect-mbz-deeplink-and-grades` | `24.8 s` | `.../r2-sim-case-results.json`, `.../cmd/08-r2-sim-browser-pass.log` |
| `AC-04` | Both HTML and SCORM 1.2 learner launches on `moodle-sim` complete and sync grade `100` (`200`), showing `Completed — score 100 sent to Moodle`, portal Results `Sent` (`Learner learner-1 @ moodle.sim.test`), and connection status `connected` | **PASS** | `R2-SIM.connect-mbz-deeplink-and-grades` | `24.8 s` | `.../r2-sim-case-results.json`, `.../cmd/08-r2-sim-browser-pass.log` |
| `AC-05` | `409` score conflict on `moodle-sim` (`scoreAnswers: [{ status: 409 }]`) transitions the dispatch row to `conflict` | **PASS** | `R2-SIM.grades-409-503-and-check14` | `7.8 s` | `.../r2-sim-case-results.json`, `.../cmd/08-r2-sim-browser-pass.log` |
| `AC-06` | `503` transient score error (`scoreAnswers: [503, 200]`) retries to `sent` (`tries >= 2`), and permanent `400` failure recovers to `sent` on `POST /app-api/score-syncs/:id/resend` | **PASS** | `R2-SIM.grades-409-503-and-check14` | `7.8 s` | `.../r2-sim-case-results.json`, `.../cmd/08-r2-sim-browser-pass.log` |
| `AC-07` | Launch Check 14 family guard refusal on `standard` profile: launching with `product_family_code = 'canvas'` against the Moodle `standard` platform renders `[data-error-code="PROVIDER_PROFILE_MISMATCH"]` (`400`) | **PASS** | `R2-SIM.grades-409-503-and-check14` | `7.8 s` | `.../r2-sim-case-results.json`, `.../cmd/08-r2-sim-browser-pass.log` |
| `AC-08` | Speed comparison vs live Moodle 5.2: `R2-sim` executes both end-to-end specs in `32.6 s` (`104.5 s` total stack lifecycle) compared to `~12 min` (`T7 × 1`) / `~40 min` (`T7 × 3`) on the Moodle 5.2 container (`> 10×` faster), with `0` secret hits across `43` captured values in `22` files (`M3-07-R2-SIM` PASS) | **PASS** | `R2-SIM.*`, `M3-07-R2-SIM`, `TEARDOWN` | `32.6 s` (`104.5 s` total) | `.../r2-sim-secret-scan.json`, `.../summary.json` |

---

## 2. `LA-E7-09.md` Wave-End Gate Criteria (`AC-LA-E7-09-01`..`05`)

| AC | Observable outcome | Evidence Tier | Status | Notes |
|---|---|---|---|---|
| `AC-LA-E7-09-01` | `T7`: 3 runs × 17 PASS plus the demo skip, as in the baseline | `MOODLE-LIVE` | `pending: Slot 8 (MOODLE-LIVE window)` | Scheduled in `tests/ltiaas/GATE-RUN-PLAN.md` §4.5 (`qalead-la-7`); `R2-sim` passed on `moodle-sim` in Slot 6 (`32.6 s`). |
| `AC-LA-E7-09-02` | Each legacy group `T2a–T8` gives the baseline result per test id | `MOODLE-LIVE` | `pending: Slot 8 (MOODLE-LIVE window)` | Scheduled in `tests/ltiaas/GATE-RUN-PLAN.md` §4.5 (`qalead-la-7`). |
| `AC-LA-E7-09-03` | `/healthz` of both services in the `default` profile shows `"knobs": []` and `"profile": "default"` after the run | `MOODLE-LIVE` / `SIM` | **PASS** (`SIM` in Slot 6 + `MOODLE-LIVE` in Slot 8: `"profile": "default"` and `"knobs": []` verified on `lti-service`, `cogniate-app`, and `cogniate-content` before and after the run, and zero `test_knob_active` events in `infra/.logs`) | Verified in `S8-01` (`evidence-s8-01-health-start.json`) and `S8-06` (`evidence-s8-06-health-end.json`). |
| `AC-LA-E7-09-04` | `K2` `U1`–`U4` pass for every registered channel (`U3` only for new channels) on the wave-end SHA | `K2` / `MOODLE-LIVE` | **PASS** (`SIM` `U1`–`U4` in `docs/reviews/LA-E7-07/qa.md` + `MOODLE-LIVE` `U1` cards, `U2` wizards across all 5 channels, and `U1`/`U2` continuity across `lti-service` + `cogniate-app` restarts on live Moodle 5.2.4 in `S8-01`, `S8-02`, `S8-03`, `S8-U1-PREP`, `S8-U2-RESTART`, `S8-06`) | Executed in Slot 8 on `qa-e2e-la-s8-r2` (`f34b27df` / product `8fadb828`). |
| `AC-LA-E7-09-05` | Final SHA only: the two identical full runs of the milestone end (SIM and Moodle lanes) both pass | `MOODLE-LIVE` | `pending: B4 milestone-end gate` | Final B4 milestone gate (`LA-E7-09.md`). |

---

## Round 2 — Slot 8 `MOODLE-LIVE` (`QA-E2E` Part on `f34b27df` / Product `8fadb828`, `2026-10-23T23:20:32Z`)

- **Verdict**: **PASS** (all functional `MOODLE-LIVE` checks `S8-01`..`S8-06`, `S8-U1-PREP`, `S8-U2-RESTART`, `S8-KEYS-STATUS`, and `TEARDOWN` **PASS**; see exact runner accounting below including the runner post-step `ERROR` row that was fixed in `tests/e2e/ltiaas/run-slot8-moodle.mjs:369`)
- **Integration SHA**: `f34b27dfe45599676b47f09fae85924ccfdbe5d5` (`f34b27df`)
- **Product Code SHA (`WAVE-END`)**: `8fadb828088ffe1b4db02179ab0fa3ab2388a12a` (`8fadb828`)
- **Lane / Slot**: `QA-E2E` (`term_80640d06-310f-4eac-bc95-872fd936d43c`), Wave-End Docker Slot 8 (`2026-10-23T22:38:05Z`–`2026-10-23T23:18:30Z`)
- **Compose Project**: `COMPOSE_PROJECT_NAME=qa-e2e-la-s8-r2` (`PUBLIC_PORT=9543`, `STACK_SUBNET=172.21.0.0/16`)
- **Run IDs**:
  - `qa-e2e-la-s8-r2-f34b27df-2026-10-23T23-10-32-311Z`
  - `qa-e2e-la-s8-r2-f34b27df-2026-10-23T23-14-54-556Z` (primary evidence run)
- **Clone (`--no-hardlinks`)**: `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT8-QA-E2E/clone-r2-run`
- **Artifacts**: `/Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/la-qa/tests/host/artifacts/qa-e2e-la-s8-r2-f34b27df-2026-10-23T23-14-54-556Z`
- **Boundary & Watcher Dir (`umask 077`)**: `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT8-QA-E2E/boundary/`

### 1. Command Executed

```sh
COMPOSE_PROJECT_NAME=qa-e2e-la-s8-r2 \
PUBLIC_PORT=9543 \
STACK_SUBNET=172.21.0.0/16 \
COURSE_FIXTURES_DIR=/Users/quangnguyen/cogniate-qa-runs/LA/GATE/course-fixtures \
node tests/e2e/ltiaas/run-slot8-moodle.mjs \
  --sha f34b27dfe45599676b47f09fae85924ccfdbe5d5 \
  --source /Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/ltiaas-milestone \
  --workdir /Users/quangnguyen/cogniate-qa-runs/LA/SLOT8-QA-E2E/clone-r2-run \
  --replace-tests \
  --tests-from /Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/la-qa/tests
```

### 2. Exact Runner Result Accounting (`summary.json` of `qa-e2e-la-s8-r2-f34b27df-2026-10-23T23-14-54-556Z`)

Every ID from `/Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/la-qa/tests/host/artifacts/qa-e2e-la-s8-r2-f34b27df-2026-10-23T23-14-54-556Z/summary.json` (zero omitted rows):

| Runner ID | Status | Duration | Notes / Evidence from `summary.json` |
|---|---|---|---|
| `PRE` | **PASS** | — | `node 24.21.0, docker 29.9.1, compose 5.6.0`; `project qa-e2e-la-s8-r2, PUBLIC_PORT 9543, STACK_SUBNET 172.21.0.0/16`; `other containers on this Docker host: 2 (not touched by QA)` |
| `CLONE` | **PASS** | — | `HEAD f34b27dfe45599676b47f09fae85924ccfdbe5d5`; `--replace-tests` from `la-qa/tests` |
| `FIXTURES` | **PASS** | — | SHA-256 verified SCORM 1.2 (`a685744e5fd9…`) and HTML (`9f04d3abd65f…`) fixture zips |
| `SETUP` | **PASS** | — | `npm ci 0, gen-env 0, e2e:reset 0` (`cmd/03-root-npm-ci.log`, `cmd/04-gen-env.log`, `cmd/06-e2e-reset.log`) |
| `H1` | **PASS** | — | `services: cogniate-app, lti-service, moodle, postgres, proxy` under `qa-e2e-la-s8-r2` |
| `S8-01` | **PASS** | `1.72 s` | `[LA-E7-09 / AC-LA-E7-09-03 / AC-LA-E7-09-04] K2.MOODLE.U1-cards`: default profile `/healthz` is clean (`profile: "default"`, `knobs: []` on `lti-service`, `cogniate-app`, `cogniate-content`) and Integrations hub renders all 5 channels (`moodle`, `canvas`, `blackboard`, `lti-generic`, `brightspace`) in manifest `card.order` (`10, 20, 30, 40, 50`) (`evidence-s8-01-health-start.json`) |
| `S8-02` | **PASS** | `3.94 s` | `[LA-E7-09 / AC-LA-E7-09-04 / LA-E3-07 AC-03] K2.MOODLE.U2-wizards`: Step 1 `createFields` + Rule 1 origin check, Step 2 `setup.artifacts` + 16 Moodle tool rows (row 13 `nrps` = `"Do not use this service"`), Step 3 `bindingFields` + defaults + `adminSteps` across all 5 channels on `default` profile |
| `S8-03` | **PASS** | `7.98 s` | `[LA-E7-09 / LA-E2-02 AC-08 / LA-E3-07 AC-03 / LA-E5-22 AC-06] K2.MOODLE.connect-and-publish`: live Moodle 5.2.4 Dynamic Registration (`Registered — activate in Moodle`, `Active`, `Show in activity chooser and as a preconfigured tool`, `New window`), Web Services token sealing (`PUT /app-api/connections/:id/web-services` -> `200`, `release: "5.2.4+"`), Moodle course shell creation (`shellStatus: "created"`, `visible: 0`) with `cgk1`-sealed `ws_token_encrypted`, and HTML + SCORM 1.2 publish |
| `S8-04` | **PASS** | `16.84 s` | `[LA-E3-05 AC-LA-E3-05-04 & AC-LA-E3-05-11]`: Moodle 5.2.4 Deep Linking picker sends `accept_multiple: true` in `deep_linking_settings` yet renders `3` single-select radio buttons and `0` checkboxes (`content.multiple: false`); clicking `Cancel` posts `POST /tool/picker/:id/cancel` (`200`) with signed JWT `content_items: []` and `msg: "No course was added."`, Moodle 5.2.4 automatically closes `.modal.show` (`modalClosedAutomatically: true`), leaves `#id_name` empty (`""`), creates `0` activities in `COGNIATE-DEV-101` (`stats.activities === 0`), and consumes the session (`GET /tool/picker/:id` -> `410 PICKER_USED`); picking adds SCORM 1.2 & HTML activities (`evidence-s8-04-moodle-picker-cancel.json`) |
| `S8-05` | **PASS** | `39.94 s` | `[LA-E4-03 AC-LA-E4-03-09]`: Browser grade delivery on live Moodle 5.2.4: `cg_student` completes SCORM 1.2 (`grade 100, latency 3.8 s`) and HTML (`grade 100, latency 3.8 s`) activities (`100.00` in Moodle gradebook & grader report, `Passed 100` and `Sent` in portal Results) (`evidence-s8-05-grader-report-101.json`) |
| `S8-U1-PREP` | **PASS** | — | Verified all 4 `cogniate-app` encrypted columns in `/data/cogniate.db` start with `"cgk1"` (`{"ok":true,"beforeHeaders":{"ws_token_encrypted":"cgk1","ref_token_encrypted":"cgk1","service_key_encrypted":"cgk1","ltik_encrypted":"cgk1"},"afterWsHeader":"QAS8","legacyBlobLength":60}`) and staged pre-upgrade legacy unheadered AES-256-GCM `ws_token_encrypted` blob (`iv[12] \|\| tag[16] \|\| ciphertext`) (`cmd/08-stage-legacy-u1-ws-token.log`) |
| `S8-U2-RESTART` | **PASS** | — | Rolling restart of `lti-service` (`npm run stack:restart -- lti-service` exit `0`, health `ok=true`) and `cogniate-app` (`npm run stack:restart -- cogniate-app` exit `0`, health `ok=true`) on live Moodle stack (`cmd/09-restart-lti-service.log`, `cmd/10-restart-cogniate-app.log`) |
| `S8-06` | **PASS** | `30.20 s` | `[LA-E7-09 MOODLE U1/U2 continuity & LA-E5-22 AC-LA-E5-22-06 / A-LAB-09 & AC-LA-E7-09-03]`: After `lti-service` + `cogniate-app` restart and legacy `ws_token_encrypted` `U1` fixture: Moodle 5.2.4 course shell creation succeeds (`shellStatus: "created"`, `visible: 0`), `PUT /web-services` returns `200`, pre-restart open `picker_session` unseals `ltik_encrypted` (`GET` -> `200`, `POST /cancel` -> `200` with signed `JWT`), new teacher Deep Linking pick in `COGNIATE-DEV-102` succeeds (`stats.activities === 2`), `cg_student2` launch + score sync on pre-restart HTML activity in `COGNIATE-DEV-101` unseals `resource_link.service_key_encrypted` and reaches `100.00` (`Sent`), and `/healthz` of `lti-service`, `cogniate-app`, and `cogniate-content` is `profile: "default"`, `knobs: []`, with `0` `test_knob_active` events in `infra/.logs` (`evidence-s8-06-health-end.json`) |
| `S8-KEYS-STATUS` | **PASS** | — | `docker compose exec -T cogniate-app npm run -s app:keys -- status` -> `Key provider: local-keyring Active version: legacy Version legacy (active): 7 sealed values` (`cmd/12-app-keys-status.log`) |
| `ERROR` | `FAIL` (runner post-step bug in historical run; repaired in Round 3) | — | In the historical `23-14-54-556Z` run, `run-slot8-moodle.mjs:369` threw `TypeError: r.redact.findIn is not a function` (and the commit at `b5f68c4b` used `r.redact.values`, which is also undefined on `Redactor`), so `M3-07-S8` did not complete in-run. Repaired in Round 3 using the public `Redactor` interface (`redact.apply(text)` and `redact.size`) with `m1-secrets.raw.jsonl` loaded and verified host-only via `node tests/e2e/ltiaas/run-slot8-moodle.mjs --selftest` and `/Users/quangnguyen/cogniate-qa-runs/LA/WE-F9-HOST/slot8-primary-run-scan.json` (`57` secrets across `47` files, `0` hits); live rerun of the secret-hygiene row scheduled in Slot 8b. |
| `TEARDOWN` | **PASS** | — | `npm run stack:down exit 0`; `left after cleanup: 0 containers, 0 volumes (exact lane names included), 0 networks`; `other projects' containers that stopped or restarted: /sto-it-mq-6395e0ce5d84, /sto-it-065d0e8760d3 (information)` |

#### Complete Accounting of All 10 Saved Slot 8 Run Folders (`la-qa/tests/host/artifacts/qa-e2e-la-s8-*`)

| # | Saved Run ID (`tests/host/artifacts/<runId>/summary.json`) | Clone / Log (`SLOT8-QA-E2E/logs/`) | PASS / FAIL Totals | Failing IDs in `summary.json` | Root Cause & Serial-Skip Accounting |
|---|---|---|---|---|---|
| 1 | `qa-e2e-la-s8-r1-f34b27df-2026-10-23T22-48-18-037Z` | `clone` / `run-slot8-r1.log` | `6 PASS`, `1 FAIL` | `SLOT8-PASS1: FAIL` | `playwright.moodle-live.config.ts` used CommonJS `__dirname` under ESM (`exit 1, 0 cases collected`); fixed with `fileURLToPath(import.meta.url)`. |
| 2 | `qa-e2e-la-s8-r2-f34b27df-2026-10-23T22-49-50-271Z` | `clone-r2` / `run-slot8-r2.log` | `6 PASS`, `1 FAIL` | `ERROR: FAIL` | `TypeError: r.save is not a function` in `runPlaywrightPhase`; fixed to `r.saveText`. |
| 3 | `qa-e2e-la-s8-r2-f34b27df-2026-10-23T22-52-08-040Z` | `clone-r2-clean` / `run-slot8-r2-clean.log` | `7 PASS`, `4 FAIL` | `S8-02: FAIL`, `S8-03: FAIL`, `S8-04: FAIL`, `S8-05: FAIL` | `S8-01` passed (`1.63 s`); `S8-02` failed assertion at `0.96 s` because `moodle` `adminSteps` were checked only on the manual wizard instead of combining dynamic + manual wizard text. **`S8-03`, `S8-04`, and `S8-05` (`0.00 s` each) were not executed assertion failures — Playwright skipped them due to `test.describe.serial` after `S8-02` failed, and `collectPlaywrightCases` maps non-`passed` statuses to `FAIL`.** |
| 4 | `qa-e2e-la-s8-r2-f34b27df-2026-10-23T22-56-57-679Z` | `clone-r2-run` / `run-slot8-r2-run.log` | `3 PASS`, `1 FAIL` | `FIXTURES: FAIL` | Course fixture zips not found before `COURSE_FIXTURES_DIR` fallback was wired. |
| 5 | `qa-e2e-la-s8-r2-f34b27df-2026-10-23T22-57-53-722Z` | `clone-r2-run` / `run-slot8-r2-run.log` | `3 PASS`, `1 FAIL` | `FIXTURES: FAIL` | Course fixture zips not found before `COURSE_FIXTURES_DIR` env variable was exported. |
| 6 | `qa-e2e-la-s8-r2-f34b27df-2026-10-23T22-58-50-994Z` | `clone-r2-run` / `run-slot8-r2-run.log` | `9 PASS`, `2 FAIL` | `S8-04: FAIL`, `S8-05: FAIL` | `S8-01..S8-03` passed; `S8-04` failed `radioCount` assertion at `6.45 s` (`Expected: 2, Received: 3` because `S8-03` also published the `cgk1` course-shell course on the same connection). **`S8-05` (`0.00 s`) was a `test.describe.serial` skip after `S8-04` failed, mapped to `FAIL` by `collectPlaywrightCases`.** |
| 7 | `qa-e2e-la-s8-r2-f34b27df-2026-10-23T23-01-23-859Z` | `clone-r2-run` / `run-slot8-r2-run.log` | `10 PASS`, `1 FAIL` | `S8-05: FAIL` | `S8-01..S8-04` passed; `S8-05` failed at `39.80 s` on the portal Results table column selector (`Best outcome` holds both `Passed` and `100`). |
| 8 | `qa-e2e-la-s8-r2-f34b27df-2026-10-23T23-05-03-073Z` | `clone-r2-run` / `run-slot8-r2-run.log` | `11 PASS`, `1 FAIL` | `S8-U1-PREP: FAIL` | `S8-01..S8-05` passed; `S8-U1-PREP` failed because SQLite DB path in `cogniate-app` is `/data/cogniate.db` rather than `/data/cogniate-app.db`. |
| 9 | `qa-e2e-la-s8-r2-f34b27df-2026-10-23T23-10-32-311Z` | `clone-r2-run` / `run-slot8-r2-run.log` | `15 PASS`, `1 FAIL` | `ERROR: FAIL` | All functional & CLI checks `S8-01..S8-06`, `S8-U1-PREP`, `S8-U2-RESTART`, `S8-KEYS-STATUS`, and `TEARDOWN` passed; post-step threw `TypeError: r.collectLogs is not a function`. |
| 10 | `qa-e2e-la-s8-r2-f34b27df-2026-10-23T23-14-54-556Z` | `clone-r2-run` / `run-slot8-r2-run.log` | `15 PASS`, `1 FAIL` | `ERROR: FAIL` | Primary evidence run: all functional & CLI checks `S8-01..S8-06`, `S8-U1-PREP`, `S8-U2-RESTART`, `S8-KEYS-STATUS`, and `TEARDOWN` passed; post-step threw `TypeError: r.redact.findIn is not a function` before `M3-07-S8` could be recorded (repaired in Round 3). |

### 3. Cross-Lane `MOODLE-LIVE` Rows Verified in Slot 8 (For Lead to Copy into Other QA Lanes' `qa.md` Files)

1. **`docs/reviews/LA-E3-05/qa.md` (owned by `QA-4`)**:
   - **`AC-LA-E3-05-04` (`MOODLE-LIVE` picker part) — PASS**: On live Moodle 5.2.4 (`S8-04`, `16.84 s`), Moodle's `LtiDeepLinkingRequest` sends `"accept_multiple": true` in `deep_linking_settings`, while the Cogniate picker (`moodle` channel `content.multiple: false`) renders `3` `<input type="radio" name="publicationId">` inputs and `0` `<input type="checkbox" name="publicationId">` inputs, and returns 1 `ltiResourceLink` item per Deep Linking pick (`stats.activities === 1` on each publication, `evidence-s8-04-moodle-picker-cancel.json`). *(Note: the AC's `"T7 passes unchanged (AP-05-16)"` part comes from the Lead QA `T7 × 1` run; copy this row into `docs/reviews/LA-E3-05/qa.md` together with the Lead QA `T7 × 1` result.)*
   - **`AC-LA-E3-05-11` (`MOODLE-LIVE`) — PASS**: On live Moodle 5.2.4 (`S8-04`, `16.84 s`), clicking `Cancel` (`button[data-cancel]`) inside Moodle's `Select content` modal posts `POST /tool/picker/:pickerId/cancel` -> `200` returning an auto-submitted `LtiDeepLinkingResponse` JWT with `"https://purl.imsglobal.org/spec/lti-dl/claim/content_items": []` and `"https://purl.imsglobal.org/spec/lti-dl/claim/msg": "No course was added."`. Moodle 5.2.4's `contentitem_return.php` handler automatically closes the `.modal.show` dialog (`modalClosedAutomatically: true`), leaves `#id_name` empty (`""`), creates `0` activities in `COGNIATE-DEV-101` (`stats.activities === 0`), and consumes the picker session (`GET /tool/picker/:pickerId` replay returns `410 PICKER_USED`). Evidence: `evidence-s8-04-moodle-picker-cancel.json`, `s8-04-picker-before-cancel.png`, `s8-04-after-picker-cancel.png`.
2. **`docs/reviews/LA-E4-03/qa.md` (owned by `QA-3`)**:
   - **`AC-LA-E4-03-09` (`MOODLE-LIVE` browser part) — PASS**: On live Moodle 5.2.4 (`S8-05`, `39.94 s`, and `S8-06`, `30.20 s`), `cg_student` launches and completes both SCORM 1.2 and HTML activities in `COGNIATE-DEV-101`, delivering `100.00` to the Moodle gradebook and grader report (`evidence-s8-05-grader-report-101.json`) and showing `Passed 100` / `Sent` in the Cogniate portal Results view; after `lti-service` + `cogniate-app` restarts (`S8-06`), `cg_student2` launches and completes the pre-restart HTML activity in `COGNIATE-DEV-101`, delivering `100.00` to the Moodle gradebook and `Sent` in portal Results.
3. **`docs/reviews/LA-E5-22/qa.md` (owned by `QA-2`)**:
   - **`AC-LA-E5-22-06` / `A-LAB-09` (`MOODLE-LIVE`) — PASS**: On live Moodle 5.2.4 (`S8-03`, `S8-U1-PREP`, `S8-U2-RESTART`, `S8-06`, `S8-KEYS-STATUS`), all 4 `cogniate-app` encrypted columns (`connection.ws_token_encrypted`, `connection.ref_token_encrypted`, `resource_link.service_key_encrypted`, `picker_session.ltik_encrypted`) are verified to start with the `"cgk1"` envelope header in `S8-U1-PREP`; Moodle course shell creation (`POST /app-api/publications` with `createMoodleCourse: {}`) creates hidden Moodle course shells (`shellStatus: "created"`, `visible: 0`) both when `connection.ws_token_encrypted` is sealed with `"cgk1"` (`S8-03`) and after staging a pre-upgrade legacy unheadered AES-256-GCM blob (`iv[12] || tag[16] || ciphertext`, `legacyBlobLength: 60`) into `connection.ws_token_encrypted` and restarting `lti-service` and `cogniate-app` (`S8-U1-PREP` -> `S8-U2-RESTART` -> `S8-06`); `PUT /app-api/connections/:id/web-services` returns `200`, and `app:keys status` (`S8-KEYS-STATUS`) reports `Key provider: local-keyring Active version: legacy Version legacy (active): 7 sealed values`.

### 4. Slot 8 Docker Boundary, Protected Volumes & Watcher Audit (`/Users/quangnguyen/cogniate-qa-runs/LA/SLOT8-QA-E2E/boundary/`)

- **Before-slot timestamp**: `2026-10-23T22:38:05Z` (`before-timestamp.txt`)
- **After-slot timestamp**: `2026-10-23T23:18:30Z` (`after-timestamp.txt`)
- **Owned-only cleanup**:
  - `qa-e2e-la-s8-*` containers remaining: `0` (`after-owned-containers.txt`)
  - `qa-e2e-la-s8-*` volumes remaining: `0` (`after-owned-volumes.txt`)
  - `qa-e2e-la-s8-*` networks remaining: `0` (`after-owned-networks.txt`)
- **32 Protected Baseline Volumes**:
  - `before-32-baseline-volumes-inspect.json` vs `after-32-baseline-volumes-inspect.json`: **`0` diff lines** (`baseline-32-volumes-inspect.diff` is empty; all 32 baseline volumes unchanged).
- **Environment Note (`TEST-STRATEGY` §5.4 — Foreign `sto-*` Containers & Anonymous Volume)**:
  - During Slot 8, ephemeral `sto-it-*` containers (`sto-it-mq-938ed331c5f5` at `22:38:05Z` with anonymous volume `0cafaad6b7902710b5bfbe6925d97b86ee2cf5ce6ef600b076daea444016eef2`, and `/sto-it-mq-6395e0ce5d84`, `/sto-it-065d0e8760d3` during `23:10Z–23:17Z`) were created and removed by another worker's storage integration test (`infra/scripts/stack-data.test.mjs` / `storage-preflight` tests). Per `TEST-STRATEGY` §5.4 and the dispatch rules, these `sto-*` resources were listed apart (`before-sto-containers.txt`, `after-sto-containers.txt`) and never touched by `QA-E2E`.
- **Continuous Watchers**:
  - `docker-events-watch.log` (`docker events --since 2026-10-23T22:38:05Z`) and `host-ps-watcher.log` (5-second `ps` snapshots) ran continuously from before the first Docker launch through final teardown and were stopped cleanly at `2026-10-23T23:19:54Z`.

---

## Round 3 — `WE-F9` Host-Only Fix (`AC-LA-E7-08-05`) & Slot 8 Review Fixes (`A-LA-E7-09-01..04`, `B-LA-E7-09-01..03`)

- **Verdict**: **PASS** (host-only verification complete; live rerun of the repaired `run-slot8-moodle.mjs` secret-hygiene row `M3-07-S8` scheduled for Slot 8b per Lead instruction)
- **Baseline Reference SHA**: `1b17261be97c4701b928fa9dc2fa74c6d23028f6` (`1b17261`)
- **Host Verification Dir (`umask 077`, no Docker used)**: `/Users/quangnguyen/cogniate-qa-runs/LA/WE-F9-HOST/`

### 1. `WE-F9` Root Cause & Fix (`docs/reviews/LA-E7-08/qa.md` §7 / `qalead-la-30`)

1. **Root Cause**:
   - The frozen `T7` runner (`tests/e2e/host/run-t7.mjs`) runs `QA_SUITE=e2e` against `tests/playwright.config.ts`, which sets `testDir: './e2e'` and `testMatch: '**/*.spec.ts'`.
   - While all other `LA` suites under `tests/e2e/ltiaas/` used dedicated non-`.spec.ts` extensions (`01..04-*.k2.ts` and `05-moodle-live-slot8.moodle.ts`), the `LA-E7-09` `R2-SIM` suite was named `tests/e2e/ltiaas/r2-moodle-sim.spec.ts` and matched `**/*.spec.ts` during `T7`, failing on the default Moodle stack with `"Exact QA_PRODUCT_SHA required for product evidence at ../acceptance/M1/canvas/browser.ts:21"`.
   - Why `tests/e2e/ltiaas/run-k2.mjs --harness-only` missed the leak earlier: `r2-moodle-sim.spec.ts` registered its tests through `k2Case(...)` in `tests/e2e/ltiaas/lib/k2.ts:383:7`, so Playwright's `--list` output printed `ltiaas/lib/k2.ts:383:7 › K2 R2-SIM...` rather than `r2-moodle-sim.spec.ts`.
2. **Fix Applied (Strictly inside `tests/e2e/ltiaas/**`)**:
   - Renamed `tests/e2e/ltiaas/r2-moodle-sim.spec.ts` -> `tests/e2e/ltiaas/r2-moodle-sim.r2sim.ts`.
   - Updated `tests/e2e/ltiaas/playwright.r2-sim.config.ts` so `testMatch: ['r2-moodle-sim.r2sim.ts']`.
   - Hardened `tests/e2e/ltiaas/run-k2.mjs` (`--harness-only`) to check `/ltiaas\/|\.(k2|r2sim|moodle)\.ts|\{case:(U[1-4]|R2-SIM)\./` and assert exact baseline test/file counts across `T7` (`18 tests in 6 files`), `M2` (`64 tests in 1 file`), `T6` (`18 tests in 6 files`), and `T5a,T8` (`37 tests in 14 files`).
   - Audited all `*.spec.ts` and `*.m2.ts` files across `tests/` against `1b17261be97c4701b928fa9dc2fa74c6d23028f6`: `tests/e2e/ltiaas/r2-moodle-sim.spec.ts` was the **only** added `.spec.ts` or `.m2.ts` file in the entire repository.

### 2. Host-Only `--list` Proof (`1b17261` Baseline vs Fixed `la-qa/tests`)

| Suite / Runner Config | Command (`npx playwright test --list`) | `1b17261` Baseline Selection | Fixed Candidate Selection | `diff -u` Lines | Evidence File (`/Users/quangnguyen/cogniate-qa-runs/LA/WE-F9-HOST/lists/`) |
|---|---|---|---|---|---|
| **Frozen `T7` (`QA_SUITE=e2e`)** | `QA_SUITE=e2e npx playwright test -c playwright.config.ts --list` | `Total: 18 tests in 6 files` | `Total: 18 tests in 6 files` | **`0` lines** (identical) | `baseline-t7.txt`, `candidate-t7.txt` |
| **Frozen `M2`** | `npx playwright test -c e2e/M2/playwright.config.ts --list` | `Total: 64 tests in 1 file` (`9` `*.m2.ts` specs via `lib/m2.ts`) | `Total: 64 tests in 1 file` | **`0` lines** (identical) | `baseline-m2.txt`, `candidate-m2.txt` |
| **Frozen `T6` (`QA_SUITE=acceptance --grep @T6`)** | `QA_SUITE=acceptance npx playwright test -c playwright.config.ts --grep "@T6" --list` | `Total: 18 tests in 6 files` | `Total: 18 tests in 6 files` | **`0` lines** (identical) | `baseline-t6.txt`, `candidate-t6.txt` |
| **Frozen `T5a,T8` (`QA_SUITE=acceptance --grep "@T5a\|@T8"`)** | `QA_SUITE=acceptance npx playwright test -c playwright.config.ts --grep "@T5a\|@T8" --list` | `Total: 37 tests in 14 files` | `Total: 37 tests in 14 files` | **`0` lines** (identical) | `baseline-t8.txt`, `candidate-t8.txt` |
| **Frozen Full `acceptance` (`QA_SUITE=acceptance`)** | `QA_SUITE=acceptance npx playwright test -c playwright.config.ts --list` | `Total: 171 tests in 66 files` | `Total: 171 tests in 66 files` | **`0` lines** (identical) | `baseline-acceptance-all.txt`, `candidate-acceptance-all.txt` |
| **`LA-E7-09` `R2-SIM` Config** | `npx playwright test -c e2e/ltiaas/playwright.r2-sim.config.ts --list` | N/A (new in `LA`) | `Total: 2 tests in 1 file` (`R2-SIM.connect-mbz-deeplink-and-grades`, `R2-SIM.grades-409-503-and-check14`) | — | `candidate-r2-sim.txt` |
| **`LA-E7-07` `K2` Config** | `npx playwright test -c e2e/ltiaas/playwright.config.ts --list` | N/A (new in `LA`) | `Total: 12 tests in 1 file` (`U1`..`U4` `12` cases) | — | `candidate-k2.txt` |
| **`LA-E7-09` Slot 8 `MOODLE-LIVE` Config** | `QA_SLOT8_PHASE=pass1\|pass2 npx playwright test -c e2e/ltiaas/playwright.moodle-live.config.ts --list` | N/A (new in `LA`) | `pass1`: `Total: 5 tests in 1 file` (`S8-01`..`S8-05`); `pass2`: `Total: 1 test in 1 file` (`S8-06`) | — | `candidate-slot8-pass1.txt`, `candidate-slot8-pass2.txt` |
| **`run-k2.mjs --harness-only` Guard** | `node tests/e2e/ltiaas/run-k2.mjs --harness-only` | N/A | **PASS (`exit 0`)**: `7/7 selftests passed ... HARNESS ONLY: 12 K2 browser cases + 2 R2-sim cases discovered and accounted; T7 (18 tests in 6 files), M2 (64 tests in 9 files), and T6/T8 selections unchanged.` | — | `harness-only.txt` |

### 3. Slot 8 Review Findings Resolved (`docs/reviews/LA-E7-09/reviewer-a.md` & `reviewer-b.md`)

| Review ID | Severity | Resolution & Host-Only Proof |
|---|---|---|
| `A-LA-E7-09-01` / `B-LA-E7-09-01` | **MAJOR** | **Fixed in `tests/e2e/ltiaas/run-slot8-moodle.mjs`**: Replaced the broken `r.redact.values` / `r.redact.findIn` calls with `scanSlot8Files({ redact, cloneDir, artDir })`, which uses **only the public `Redactor` interface** (`redact.apply(text)` and `redact.size`, counting `<redacted:N>` replacements when `redact.apply(text) !== text`). Moved log collection, redaction, and scanning into `collectAndScanLogsAndEvidence()` inside a `finally` block so `docker-logs/`, `service-logs/`, `infra/.logs/*.jsonl`, and `r.ART` are always redacted and scanned before `steps()` exits, writing `slot8-secret-scan.json` and recording `M3-07-S8`. Verified host-only via `node tests/e2e/ltiaas/run-slot8-moodle.mjs --selftest` (`slot8-selftest.json`): planted-secret probe fails as required (`ok: false, hitCount: 2` across `infra/.logs/cogniate-app.jsonl` and `docker-logs/moodle-probe.log`), and clean-log probe passes (`ok: true, hitCount: 0, secretCount: 3`). Also ran `scanSlot8Files` against the primary run (`clone-r2-run` + `qa-e2e-la-s8-r2-f34b27df-2026-10-23T23-14-54-556Z`): `{"ok":true,"secretCount":57,"scannedFileCount":47,"hitCount":0,"hits":[]}` (`slot8-primary-run-scan.json`). |
| `A-LA-E7-09-02` | **MINOR** | **Fixed in `tests/e2e/ltiaas/run-slot8-moodle.mjs` & saved artifacts**: `loadCapturedSecretsIntoRedactor(cloneDir, redact)` now loads `tests/acceptance/artifacts/m1-secrets.raw.jsonl` (in addition to `captured-secrets.jsonl` and `captured-secrets.txt`) immediately after `pass1`, after `pass2`, and in the `finally` block before `docker-logs/` collection. Also redacted the dead Dynamic Registration `ref` in all 5 saved `tests/host/artifacts/qa-e2e-la-s8-r2-*/docker-logs/moodle-*.log` files (`22-58-50`, `23-01-23`, `23-05-03`, `23-10-32`, `23-14-54`) and tightened file permissions (`chmod 600`) on `SLOT8-QA-E2E/logs/*.log` and `captured-secrets.jsonl`. |
| `B-LA-E7-09-02` | **MINOR** | **Fixed in `tests/e2e/ltiaas/run-slot8-moodle.mjs`**: Applied `PUBLIC_PORT ??= '9543'` and `STACK_SUBNET ??= '172.21.0.0/16'` before `createRunner(...)` so the slot defaults take effect when env overrides are omitted, and added `SLOT8_HELP` (`--help` / `-h`) naming `node tests/e2e/ltiaas/run-slot8-moodle.mjs`, the default port/subnet/project, `COURSE_FIXTURES_DIR`, and `--selftest` (`slot8-help.txt`). |
| `A-LA-E7-09-03` / `B-LA-E7-09-03` | **MINOR** | **Fixed in `docs/reviews/LA-E7-09/qa.md` Round 2**: Added the complete 10-run table for all saved `tests/host/artifacts/qa-e2e-la-s8-*` folders (including `22-48-18-037Z` and `22-49-50-271Z`, and distinguishing `test.describe.serial` skips `S8-03..05` in `22-52-08-040Z` and `S8-05` in `22-58-50-994Z` from executed assertion failures), labeled `AC-LA-E3-05-04` as `MOODLE-LIVE picker part`, corrected the `S8-01` card order to `moodle, canvas, blackboard, lti-generic, brightspace`, and stated accurately that `S8-06` verified HTTP `200` on `PUT /web-services` and `7 sealed values` in `app:keys status`. |
| `A-LA-E7-09-04` | **NIT** | **Fixed in `tests/e2e/ltiaas/05-moodle-live-slot8.moodle.ts`**: Added `expect(!modalVisibleAfterCancel \|\| returnFrameText.length > 0, 'AC-LA-E3-05-11: Moodle closes the dialog or shows a message').toBe(true)` at line 654 and tightened the Rule 1 fallback regex at line 332 from `/Do not add a path\.\|No path\.\|origin/i` to `/Do not add a path\.\|No path\./i`. |

---

## Round 4 — Slot 8b `MOODLE-LIVE` Full Rerun with Repaired In-Run Secret Scan (`M3-07-S8`) on `a7bd110e` / Product `8fadb828` (`2026-10-24T01:35:33Z`)

- **Verdict**: **PASS** (`16/16` runner IDs **PASS** in `summary.json`, including `M3-07-S8: PASS` with `58` secrets scanned across `43` files and `0` hits; exit code `0`; zero `--replace-tests` overrides)
- **UTC Timestamp (`date -u`)**: `2026-10-24T01:35:33Z`
- **Integration SHA**: `a7bd110e9c6d504c69a6c0608cbdeef80feff942` (`a7bd110e`)
- **Product Code SHA (`WAVE-END`)**: `8fadb828088ffe1b4db02179ab0fa3ab2388a12a` (`8fadb828`)
- **Lane / Slot**: `QA-E2E` (`term_80640d06-310f-4eac-bc95-872fd936d43c`), Wave-End Docker Slot 8b (`2026-10-24T01:28:48Z`–`2026-10-24T01:35:09Z`)
- **Compose Project**: `COMPOSE_PROJECT_NAME=qa-e2e-la-s8b-r1` (`PUBLIC_PORT=9543`, `STACK_SUBNET=172.21.0.0/16`)
- **Run ID**: `qa-e2e-la-s8b-r1-a7bd110e-2026-10-24T01-31-21-479Z`
- **Fresh Clone (`git clone --no-hardlinks`, no `--replace-tests`)**: `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT8B-QA-E2E/clone-s8b-r1`
- **Artifacts**: `/Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/la-qa/tests/host/artifacts/qa-e2e-la-s8b-r1-a7bd110e-2026-10-24T01-31-21-479Z`
- **Boundary & Watcher Dir (`umask 077`)**: `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT8B-QA-E2E/boundary/`

### 1. Command Executed

```sh
umask 077
COMPOSE_PROJECT_NAME=qa-e2e-la-s8b-r1 \
PUBLIC_PORT=9543 \
STACK_SUBNET=172.21.0.0/16 \
COURSE_FIXTURES_DIR=/Users/quangnguyen/cogniate-qa-runs/LA/GATE/course-fixtures \
node tests/e2e/ltiaas/run-slot8-moodle.mjs \
  --sha a7bd110e9c6d504c69a6c0608cbdeef80feff942 \
  --source /Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/ltiaas-milestone \
  --workdir /Users/quangnguyen/cogniate-qa-runs/LA/SLOT8B-QA-E2E/clone-s8b-r1
```

### 2. Exact Runner Result Accounting (`summary.json` of `qa-e2e-la-s8b-r1-a7bd110e-2026-10-24T01-31-21-479Z`)

Every ID from `/Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/la-qa/tests/host/artifacts/qa-e2e-la-s8b-r1-a7bd110e-2026-10-24T01-31-21-479Z/summary.json` (`16/16 PASS`, zero omitted rows):

| Runner ID | Status | Duration | Notes / Evidence from `summary.json` |
|---|---|---|---|
| `PRE` | **PASS** | — | `node 24.21.0, docker 29.9.1, compose 5.6.0`; `project qa-e2e-la-s8b-r1, PUBLIC_PORT 9543, STACK_SUBNET 172.21.0.0/16`; `other containers on this Docker host: 0 (not touched by QA)` |
| `CLONE` | **PASS** | — | `HEAD a7bd110e9c6d504c69a6c0608cbdeef80feff942 A1 build64: BD-A1-116 (WE-F10: frozen T5b AC-T5-36 test race on both SHAs; no product fix)`; `clone /Users/quangnguyen/cogniate-qa-runs/LA/SLOT8B-QA-E2E/clone-s8b-r1` (committed test files only; no `--replace-tests`) |
| `FIXTURES` | **PASS** | — | `Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-scorm-v2.zip: copied (a685744e5fd9…)`; `Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-html.zip: copied (9f04d3abd65f…)` |
| `SETUP` | **PASS** | — | `npm ci 0, gen-env 0, e2e:reset 0` (`cmd/03-root-npm-ci.log`, `cmd/04-gen-env.log`, `cmd/06-e2e-reset.log`) |
| `H1` | **PASS** | — | `services: cogniate-app, lti-service, moodle, postgres, proxy` under `qa-e2e-la-s8b-r1` |
| `S8-01` | **PASS** | `1.69 s` | `[LA-E7-09 / AC-LA-E7-09-03 / AC-LA-E7-09-04] K2.MOODLE.U1-cards: default profile /healthz is clean and Integrations hub renders all 5 channels in manifest card.order` (`cmd/07-playwright-pass1.log`, `evidence-s8-01-health-start.json`) |
| `S8-02` | **PASS** | `3.77 s` | `[LA-E7-09 / AC-LA-E7-09-04 / LA-E3-07 AC-03] K2.MOODLE.U2-wizards: Step 1 createFields + Rule 1, Step 2 artifacts + 16 Moodle tool rows (row 13 "Do not use this service"), Step 3 bindingFields + defaults + adminSteps across all 5 channels on default profile` (`cmd/07-playwright-pass1.log`) |
| `S8-03` | **PASS** | `7.64 s` | `[LA-E7-09 / LA-E2-02 AC-08 / LA-E3-07 AC-03 / LA-E5-22 AC-06] K2.MOODLE.connect-and-publish: live Moodle 5.2.4 Dynamic Registration, Web Services token sealing, course shell creation, and HTML + SCORM 1.2 publish` (`cmd/07-playwright-pass1.log`) |
| `S8-04` | **PASS** | `17.05 s` | `[LA-E3-05 AC-LA-E3-05-04 & AC-LA-E3-05-11] Moodle 5.2.4 Deep Linking picker: sends accept_multiple: true yet renders single-select radios; Cancel posts content_items: [] ("No course was added."), closes modal without creating an activity, and consumes the session; picking adds SCORM & HTML activities` (`cmd/07-playwright-pass1.log`, `evidence-s8-04-moodle-picker-cancel.json`) |
| `S8-05` | **PASS** | `39.57 s` | `[LA-E4-03 AC-LA-E4-03-09] Browser grade delivery on live Moodle 5.2.4: cg_student completes SCORM 1.2 and HTML activities (100.00 in Moodle gradebook & grader report, Sent in portal results)` (`cmd/07-playwright-pass1.log`, `evidence-s8-05-grader-report-101.json`) |
| `S8-U1-PREP` | **PASS** | — | `{"ok":true,"beforeHeaders":{"ws_token_encrypted":"cgk1","ref_token_encrypted":"cgk1","service_key_encrypted":"cgk1","ltik_encrypted":"cgk1"},"afterWsHeader":"QAS8","legacyBlobLength":60}` (`cmd/08-stage-legacy-u1-ws-token.log`) |
| `S8-U2-RESTART` | **PASS** | — | `lti-service restart exit 0 (health ok=true); cogniate-app restart exit 0 (health ok=true)` (`cmd/09-restart-lti-service.log`, `cmd/10-restart-cogniate-app.log`) |
| `S8-06` | **PASS** | `29.96 s` | `[LA-E7-09 MOODLE U1/U2 continuity & LA-E5-22 AC-LA-E5-22-06 / A-LAB-09 & AC-LA-E7-09-03] After lti-service + cogniate-app restart and legacy ws_token_encrypted U1 fixture: Moodle course shell creation succeeds, pre-restart open picker session unseals, new Deep Linking pick in COGNIATE-DEV-102 succeeds, cg_student2 launch + score sync on pre-restart activity reaches 100.00, and /healthz is default/no-knobs` (`cmd/11-playwright-pass2.log`, `evidence-s8-06-health-end.json`) |
| `S8-KEYS-STATUS` | **PASS** | — | `Key provider: local-keyring Active version: legacy Version legacy (active): 7 sealed values` (`cmd/12-app-keys-status.log`) |
| `M3-07-S8` | **PASS** | — | `scanned 58 secrets across 43 files, hits: 0` (`slot8-secret-scan.json`: `{"ok":true,"secretCount":58,"scannedFileCount":43,"hitCount":0,"hits":[]}`) |
| `TEARDOWN` | **PASS** | — | `npm run stack:down exit 0`; `left after cleanup: 0 containers, 0 volumes (exact lane names included), 0 networks`; `other projects' containers that stopped or restarted: none (information)` |

### 3. In-Run Secret Scan Result (`slot8-secret-scan.json`)

- **File**: `/Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/la-qa/tests/host/artifacts/qa-e2e-la-s8b-r1-a7bd110e-2026-10-24T01-31-21-479Z/slot8-secret-scan.json`
- **Result**: `{"ok": true, "secretCount": 58, "scannedFileCount": 43, "hitCount": 0, "hits": []}`
- **Scope**: `58` secrets loaded into `Redactor` (from `.env`, `infra/.secrets` including `seed.json` leaves, `tests/e2e/artifacts/captured-secrets.jsonl`, `tests/acceptance/artifacts/m1-secrets.raw.jsonl` including the Dynamic Registration `ref` and WS token, and `tests/acceptance/artifacts/captured-secrets.txt`) and scanned across all `43` files (`infra/.logs/*.jsonl`, `docker-logs/*.log`, `service-logs/*.jsonl`, `cmd/*.log`, `evidence/*.json`, and Playwright reports) with `0` hits. In `docker-logs/moodle-939bf8c5.log`, the Dynamic Registration `ref` parameter was automatically redacted to `<redacted:43>` prior to scanning.

### 4. Hashes of Committed Test Files That Ran in `clone-s8b-r1` (`a7bd110e`)

Recorded in `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT8B-QA-E2E/boundary/test-files-sha256.txt` and `test-files-git-blobs.txt`:

| File (in `clone-s8b-r1` at `a7bd110e9c6d504c69a6c0608cbdeef80feff942`) | Git Blob SHA-1 | SHA-256 |
|---|---|---|
| `tests/e2e/ltiaas/05-moodle-live-slot8.moodle.ts` | `44ed7e2343139152826a1a6bc63e467d3c33480e` | `349f612ff0c001653fe16ce366d46bf6bcddc8df793f8cc972b30125c1e87859` |
| `tests/e2e/ltiaas/playwright.moodle-live.config.ts` | `a549ddf7c531f0318a8995dd689d5ed76c6b9844` | `afab106e6b462a098f3497c4e919e17eaf34bb202489892fe6f53d6f37375950` |
| `tests/e2e/ltiaas/run-slot8-moodle.mjs` | `105710600d0c070314632fc8963e31dea9a5914a` | `715410e6e627679a6d3b2c7172f5205aab348b0bf40604bc68ade81884b85601` |
| `tests/e2e/ltiaas/lib/k2.ts` | `568035a1a7252689009c96cf8a7287e98fe49b5a` | `4204c2de964977bdc2d6a2145c8f63c5d213ea5cb53d4a10795bc811cb10df54` |
| `tests/e2e/ltiaas/r2-moodle-sim.r2sim.ts` | `3ff4f3d10b4f2881e49dbe8a6b6440d22ab2e5c2` | `367a87af70606242e81c977413ffe20e027b96e8a3867c749edb7fdf09cea8fb` |

### 5. Slot 8b Docker Boundary, 32 Protected Volumes & Watcher Records (`/Users/quangnguyen/cogniate-qa-runs/LA/SLOT8B-QA-E2E/boundary/`)

- **Before-slot timestamp**: `2026-10-24T01:28:48Z` (`before-timestamp.txt`)
- **After-slot timestamp**: `2026-10-24T01:35:09Z` (`after-timestamp.txt`)
- **Owned-only cleanup**:
  - `qa-e2e-la-s8b-*` containers remaining: `0` (`after-owned-containers.txt`)
  - `qa-e2e-la-s8b-*` volumes remaining: `0` (`after-owned-volumes.txt`)
  - `qa-e2e-la-s8b-*` networks remaining: `0` (`after-owned-networks.txt`)
- **32 Protected Baseline Volumes (`docker volume inspect`)**:
  - `before-32-baseline-volumes-inspect.json` vs `after-32-baseline-volumes-inspect.json`: **`0` diff lines** (`baseline-32-volumes-inspect.diff` is `0` bytes; all 32 baseline volumes untouched).
- **Non-`sto-*` Containers**:
  - `before-non-sto-containers.txt` vs `after-non-sto-containers.txt`: **`0` diff lines** (`non-sto-containers.diff` is `0` bytes). Ephemeral `sto-proj-c45deec31cab` present at `01:28:48Z` was listed apart (`before-sto-containers.txt`) and never touched.
- **Continuous Watchers**:
  - `docker-events-watch.log` (`docker events --since 2026-10-24T01:28:48Z`) and `host-ps-watcher.log` (5-second `ps` snapshots) ran continuously from before clone/stack start through teardown and were stopped cleanly at `2026-10-24T01:35:09Z`.




