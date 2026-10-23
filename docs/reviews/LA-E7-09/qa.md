# QA Review — `LA-E7-09` (`R2-sim` Moodle-Shaped Standard Simulator Channel End-to-End & Wave-End Gate)

Verdict: PASS
Round: 1
SHA: `195930c1b56c7b78bfaa7776cbeec6da40cf4f87` (`195930c1`)

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
| `S8-01` | **PASS** | `1.72 s` | `[LA-E7-09 / AC-LA-E7-09-03 / AC-LA-E7-09-04] K2.MOODLE.U1-cards`: default profile `/healthz` is clean (`profile: "default"`, `knobs: []` on `lti-service`, `cogniate-app`, `cogniate-content`) and Integrations hub renders all 5 channels (`moodle`, `canvas`, `brightspace`, `blackboard`, `lti-generic`) in manifest `card.order` (`evidence-s8-01-health-start.json`) |
| `S8-02` | **PASS** | `3.94 s` | `[LA-E7-09 / AC-LA-E7-09-04 / LA-E3-07 AC-03] K2.MOODLE.U2-wizards`: Step 1 `createFields` + Rule 1 origin check, Step 2 `setup.artifacts` + 16 Moodle tool rows (row 13 `nrps` = `"Do not use this service"`), Step 3 `bindingFields` + defaults + `adminSteps` across all 5 channels on `default` profile |
| `S8-03` | **PASS** | `7.98 s` | `[LA-E7-09 / LA-E2-02 AC-08 / LA-E3-07 AC-03 / LA-E5-22 AC-06] K2.MOODLE.connect-and-publish`: live Moodle 5.2.4 Dynamic Registration (`Registered — activate in Moodle`, `Active`, `Show in activity chooser and as a preconfigured tool`, `New window`), Web Services token sealing (`PUT /app-api/connections/:id/web-services` -> `200`, `release: "5.2.4+"`), Moodle course shell creation (`shellStatus: "created"`, `visible: 0`) with `cgk1`-sealed `ws_token_encrypted`, and HTML + SCORM 1.2 publish |
| `S8-04` | **PASS** | `16.84 s` | `[LA-E3-05 AC-LA-E3-05-04 & AC-LA-E3-05-11]`: Moodle 5.2.4 Deep Linking picker sends `accept_multiple: true` in `deep_linking_settings` yet renders `3` single-select radio buttons and `0` checkboxes (`content.multiple: false`); clicking `Cancel` posts `POST /tool/picker/:id/cancel` (`200`) with signed JWT `content_items: []` and `msg: "No course was added."`, Moodle 5.2.4 automatically closes `.modal.show` (`modalClosedAutomatically: true`), leaves `#id_name` empty (`""`), creates `0` activities in `COGNIATE-DEV-101` (`stats.activities === 0`), and consumes the session (`GET /tool/picker/:id` -> `410 PICKER_USED`); picking adds SCORM 1.2 & HTML activities (`evidence-s8-04-moodle-picker-cancel.json`) |
| `S8-05` | **PASS** | `39.94 s` | `[LA-E4-03 AC-LA-E4-03-09]`: Browser grade delivery on live Moodle 5.2.4: `cg_student` completes SCORM 1.2 (`grade 100, latency 3.8 s`) and HTML (`grade 100, latency 3.8 s`) activities (`100.00` in Moodle gradebook & grader report, `Passed 100` and `Sent` in portal Results) (`evidence-s8-05-grader-report-101.json`) |
| `S8-U1-PREP` | **PASS** | — | Verified all 4 `cogniate-app` encrypted columns in `/data/cogniate.db` start with `"cgk1"` (`{"ok":true,"beforeHeaders":{"ws_token_encrypted":"cgk1","ref_token_encrypted":"cgk1","service_key_encrypted":"cgk1","ltik_encrypted":"cgk1"},"afterWsHeader":"QAS8","legacyBlobLength":60}`) and staged pre-upgrade legacy unheadered AES-256-GCM `ws_token_encrypted` blob (`iv[12] \|\| tag[16] \|\| ciphertext`) (`cmd/08-stage-legacy-u1-ws-token.log`) |
| `S8-U2-RESTART` | **PASS** | — | Rolling restart of `lti-service` (`npm run stack:restart -- lti-service` exit `0`, health `ok=true`) and `cogniate-app` (`npm run stack:restart -- cogniate-app` exit `0`, health `ok=true`) on live Moodle stack (`cmd/09-restart-lti-service.log`, `cmd/10-restart-cogniate-app.log`) |
| `S8-06` | **PASS** | `30.20 s` | `[LA-E7-09 MOODLE U1/U2 continuity & LA-E5-22 AC-LA-E5-22-06 / A-LAB-09 & AC-LA-E7-09-03]`: After `lti-service` + `cogniate-app` restart and legacy `ws_token_encrypted` `U1` fixture: Moodle 5.2.4 course shell creation succeeds (`shellStatus: "created"`, `visible: 0`), `PUT /web-services` re-seals `ws_token_encrypted` with `"cgk1"`, pre-restart open `picker_session` unseals `ltik_encrypted` (`GET` -> `200`, `POST /cancel` -> `200` with signed `JWT`), new teacher Deep Linking pick in `COGNIATE-DEV-102` succeeds (`stats.activities === 2`), `cg_student2` launch + score sync on pre-restart HTML activity in `COGNIATE-DEV-101` unseals `resource_link.service_key_encrypted` and reaches `100.00` (`Sent`), and `/healthz` of `lti-service`, `cogniate-app`, and `cogniate-content` is `profile: "default"`, `knobs: []`, with `0` `test_knob_active` events in `infra/.logs` (`evidence-s8-06-health-end.json`) |
| `S8-KEYS-STATUS` | **PASS** | — | `docker compose exec -T cogniate-app npm run -s app:keys -- status` -> `Key provider: local-keyring Active version: legacy Version legacy (active): 7 sealed values` (`cmd/12-app-keys-status.log`) |
| `ERROR` | `FAIL` (runner helper bug, fixed) | — | `TypeError: r.redact.findIn is not a function` at `run-slot8-moodle.mjs:369` (after all functional and CLI checks `S8-01`..`S8-KEYS-STATUS` completed). Fixed in `run-slot8-moodle.mjs:369` (`[...r.redact.values].filter((v) => text.includes(v))`) and verified directly against the run's `infra/.logs/*.jsonl` (`6` files) and `r.ART` (`41` files) across all `35` captured secrets: `{"secretCount":35,"logFiles":6,"artFiles":41,"hits":[]}` (`0` hits). |
| `TEARDOWN` | **PASS** | — | `npm run stack:down exit 0`; `left after cleanup: 0 containers, 0 volumes (exact lane names included), 0 networks`; `other projects' containers that stopped or restarted: /sto-it-mq-6395e0ce5d84, /sto-it-065d0e8760d3 (information)` |

*Earlier diagnostic runs in Slot 8 before the final run*:
- `qa-e2e-la-s8-r1-f34b27df-2026-10-23T22-41-37-989Z` & `22-46-47-189Z`: runner setup / ESM `__dirname` / `r.saveText` fixes in `05-moodle-live-slot8.moodle.ts` and `run-slot8-moodle.mjs`.
- `qa-e2e-la-s8-r2-f34b27df-2026-10-23T22-52-08-040Z`: `S8-01` PASS; `S8-02` failed because `adminSteps` for `moodle` were checked on the manual wizard instead of combining dynamic + manual wizard text.
- `qa-e2e-la-s8-r2-f34b27df-2026-10-23T22-56-57-679Z` & `22-57-53-722Z`: `FIXTURES` failed before `COURSE_FIXTURES_DIR` was added to `run-slot8-moodle.mjs`.
- `qa-e2e-la-s8-r2-f34b27df-2026-10-23T22-58-50-994Z`: `S8-01..S8-03` PASS; `S8-04` failed `radioCount` (`Expected: 2, Received: 3` because `S8-03` also published the `cgk1` course-shell course on the same connection).
- `qa-e2e-la-s8-r2-f34b27df-2026-10-23T23-01-23-859Z`: `S8-01..S8-04` PASS; `S8-05` failed portal results column header (`Best outcome` holds both `Passed` and `100`).
- `qa-e2e-la-s8-r2-f34b27df-2026-10-23T23-05-03-073Z`: `S8-01..S8-05` PASS; `S8-U1-PREP` failed SQLite path (`/data/cogniate.db` vs `/data/cogniate-app.db`).
- `qa-e2e-la-s8-r2-f34b27df-2026-10-23T23-10-32-311Z`: `S8-01..S8-06`, `S8-U1-PREP`, `S8-U2-RESTART`, `S8-KEYS-STATUS`, `TEARDOWN` all **PASS**; `ERROR` on `r.collectLogs()` in post-step.

### 3. Cross-Lane `MOODLE-LIVE` Rows Verified in Slot 8 (For Lead to Copy into Other QA Lanes' `qa.md` Files)

1. **`docs/reviews/LA-E3-05/qa.md` (owned by `QA-4`)**:
   - **`AC-LA-E3-05-04` (`MOODLE-LIVE`) — PASS**: On live Moodle 5.2.4 (`S8-04`, `16.84 s`), Moodle's `LtiDeepLinkingRequest` sends `"accept_multiple": true` in `deep_linking_settings`, while the Cogniate picker (`moodle` channel `content.multiple: false`) renders `3` `<input type="radio" name="publicationId">` inputs and `0` `<input type="checkbox" name="publicationId">` inputs, and returns 1 `ltiResourceLink` item per Deep Linking pick (`evidence-s8-04-moodle-picker-cancel.json`).
   - **`AC-LA-E3-05-11` (`MOODLE-LIVE`) — PASS**: On live Moodle 5.2.4 (`S8-04`, `16.84 s`), clicking `Cancel` (`button[data-cancel]`) inside Moodle's `Select content` modal posts `POST /tool/picker/:pickerId/cancel` -> `200` returning an auto-submitted `LtiDeepLinkingResponse` JWT with `"https://purl.imsglobal.org/spec/lti-dl/claim/content_items": []` and `"https://purl.imsglobal.org/spec/lti-dl/claim/msg": "No course was added."`. Moodle 5.2.4's `contentitem_return.php` handler automatically closes the `.modal.show` dialog (`modalClosedAutomatically: true`), leaves `#id_name` empty (`""`), creates `0` activities in `COGNIATE-DEV-101` (`stats.activities === 0`), and consumes the picker session (`GET /tool/picker/:pickerId` replay returns `410 PICKER_USED`). Evidence: `evidence-s8-04-moodle-picker-cancel.json`, `s8-04-picker-before-cancel.png`, `s8-04-after-picker-cancel.png`.
2. **`docs/reviews/LA-E4-03/qa.md` (owned by `QA-3`)**:
   - **`AC-LA-E4-03-09` (`MOODLE-LIVE` browser part) — PASS**: On live Moodle 5.2.4 (`S8-05`, `39.94 s`, and `S8-06`, `30.20 s`), `cg_student` launches and completes both SCORM 1.2 and HTML activities in `COGNIATE-DEV-101`, delivering `100.00` to the Moodle gradebook and grader report (`evidence-s8-05-grader-report-101.json`) and showing `Passed 100` / `Sent` in the Cogniate portal Results view; after `lti-service` + `cogniate-app` restarts (`S8-06`), `cg_student2` launches and completes the pre-restart HTML activity in `COGNIATE-DEV-101`, delivering `100.00` to the Moodle gradebook and `Sent` in portal Results.
3. **`docs/reviews/LA-E5-22/qa.md` (owned by `QA-2`)**:
   - **`AC-LA-E5-22-06` / `A-LAB-09` (`MOODLE-LIVE`) — PASS**: On live Moodle 5.2.4 (`S8-03`, `S8-U1-PREP`, `S8-U2-RESTART`, `S8-06`, `S8-KEYS-STATUS`), all 4 `cogniate-app` encrypted columns (`connection.ws_token_encrypted`, `connection.ref_token_encrypted`, `resource_link.service_key_encrypted`, `picker_session.ltik_encrypted`) are sealed with the `"cgk1"` envelope header; Moodle course shell creation (`POST /app-api/publications` with `createMoodleCourse: {}`) creates hidden Moodle course shells (`shellStatus: "created"`, `visible: 0`) both when `connection.ws_token_encrypted` is sealed with `"cgk1"` (`S8-03`) and after staging a pre-upgrade legacy unheadered AES-256-GCM blob (`iv[12] || tag[16] || ciphertext`, `legacyBlobLength: 60`) into `connection.ws_token_encrypted` and restarting `lti-service` and `cogniate-app` (`S8-U1-PREP` -> `S8-U2-RESTART` -> `S8-06`); `app:keys status` reports `Key provider: local-keyring Active version: legacy Version legacy (active): 7 sealed values`.

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

