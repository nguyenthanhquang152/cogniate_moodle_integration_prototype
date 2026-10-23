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
| `AC-LA-E7-09-03` | `/healthz` of both services in the `default` profile shows `"knobs": []` and `"profile": "default"` after the run | `MOODLE-LIVE` / `SIM` | **PASS** (`SIM`: `"knobs": []` verified on `lti-service` and `cogniate-app`; `MOODLE-LIVE` pending Slot 8) | Verified at `run-k2.mjs:227` (`assert.deepEqual([lti?.knobs, appHealth?.knobs], [[], []])`). |
| `AC-LA-E7-09-04` | `K2` `U1`–`U4` pass for every registered channel (`U3` only for new channels) on the wave-end SHA | `K2` | See `docs/reviews/LA-E7-07/qa.md` (`qa-e2e-la-sim-r2`) | Executed in Slot 6 immediately following `qa-e2e-la-sim-r1`. |
| `AC-LA-E7-09-05` | Final SHA only: the two identical full runs of the milestone end (SIM and Moodle lanes) both pass | `MOODLE-LIVE` | `pending: B4 milestone-end gate` | Final B4 milestone gate (`LA-E7-09.md`). |
