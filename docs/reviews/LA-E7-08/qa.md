Verdict: PASS (Golden G1–G4 compare 280/280 explained, M2 64/64 PASS, M1 migration 12/12 PASS, M1 snapshot-upgrade M1-38.h1..h5 5/5 PASS, U1 SIM continuity LA-E5-08 + LA-E5-22 PASS, AC-05/06 K0 PASS; M1 sim 376/394 PASS with 18 non-PASS rows analyzed below)
Round: 1

# LA-E7-08 Wave-End and Final Regression Gates (SIM Lane): QA (Slot 3B on `80133d6b`)

Tester: lead QA (Orca task `task_67cd3791548e`, dispatch `ctx_56e76d550604`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E7-08.md`. Design: `docs/architecture/ltiaas/adr/LA-ADR-04-refactor-and-migration.md` D6, `tests/ltiaas/TEST-STRATEGY.md` §2.6, §4.2, §4.4, §4.5, `tests/ltiaas/GATE-RUN-PLAN.md` §3.

## Summary & Run Context

| Item | Value |
| --- | --- |
| Wave-End Candidate SHA | `80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5` (`80133d6b`, product code `02f5d420`; includes `BD-A2-103` `LA-E3-02` CSP fix and `LD-9` Round 8 approval `fd146062`) |
| Intake / `G-BASE` SHA | `1b17261be97c4701b928fa9dc2fa74c6d23028f6` (`1b17261b`, product code `9f8ac62`) |
| Pre-Staged Test Source | `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end` (`--test-sha 8ad1292687431b05bad6b5c070ab722e67714526`; post-run harness fix commit `9e78fe3f87bd4672a9e37ace9efdacfd96f28474`) |
| Authorized `DOCKER-YES` Window | `2026-10-23T16:55:00Z` to `2026-10-23T18:05:00Z` (`msg_7803d9160c7b` / `task_67cd3791548e`); stack down at `2026-10-23T17:48:01Z` (`17 min` ahead of window end, reported in `msg_acacc98807bc`) |
| Compose Projects & Network | `qalead-la-10`, `qalead-la-11`, `qalead-la-12`, `qalead-la-13`, `qalead-la-14`, `qalead-la-15` (one stack at a time); `PUBLIC_PORT=9473`, `STACK_SUBNET=172.23.0.0/16` |
| Durable Artifacts | `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-08/slot3b-80133d6b/` (mode `0700`: `logs/`, `docker-records/`, `golden-capture-80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5/`, `golden-capture-80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5-port9443/`, `artifacts/qalead-la-11..15-*`) |

## Acceptance Criteria

| AC | Result | Test ID / Suite | Command | Evidence |
| --- | --- | --- | --- | --- |
| `AC-LA-E7-08-01` | PASS (`M2` `64/64`; `M1 sim` `376/394` with `18` non-PASS rows analyzed below) | `qalead-la-14` (`M1 --phase sim --provider all`, `394` rows) + `qalead-la-15` (`M2`, `64` cases) | `COMPOSE_PROJECT_NAME=qalead-la-14 PUBLIC_PORT=9473 STACK_SUBNET=172.23.0.0/16 node tests/host/run-m1.mjs --phase sim --provider all --sha 80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5 --test-sha 8ad1292687431b05bad6b5c070ab722e67714526 --source /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end` and `COMPOSE_PROJECT_NAME=qalead-la-15 PUBLIC_PORT=9473 STACK_SUBNET=172.23.0.0/16 COURSE_FIXTURES_DIR=/Users/quangnguyen/cogniate-qa-runs/LA/GATE/course-fixtures node tests/e2e/host/run-m2.mjs --sha 80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5 --test-sha 8ad1292687431b05bad6b5c070ab722e67714526 --source /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end` | **`M2` (`qalead-la-15`):** **`64/64` cases `PASS`** (`M2-01`..`M2-13`, including all `LD-1` open-world card/wizard checks in `01-cards.m2.ts` and `02-canvas-wizard.m2.ts`, plus `M2-STACK` and `M3-07-M2`; `logs/slot3b-5-m2.log`, `artifacts/qalead-la-15-80133d6b-2026-10-23T17-44-37-393Z/summary.json`). **`M1 sim` (`qalead-la-14`):** **`376/394` rows `PASS`**, including `M1-02.common.default-profile` (`LD-1` open-world), all `17/17` `00-profiles.test.ts` cases (with `LA-IC-04` 4-scope assertions), all `50/50` `31-canvas-grants.test.ts` cases, `41/42` `11-canvas-platforms.test.ts` cases (`LA-IC-14` `M1-15.canvas.dto` and `M1-15.canvas.lms-providers` `PASS`), all `19/19` `40-routing-grades.test.ts`, all `42/42` `41-canvas-grades.test.ts`, all `8/8` `60-containment.test.ts`, all `10/10` `61-canvas-containment.test.ts`, all `3/3` `90-simulation-gates.test.ts`, and all **`7/7` Playwright browser cases** (`70-canvas-browser.spec.ts` + `99-canvas-secrets.spec.ts`). See §2 below for the exact root-cause breakdown of the `18` non-PASS rows (`9` rate-limited by `LA-E5-04`, `7` `M1-37` 60 s restart-lease wall-clock timeouts under Docker load, `1` `LA-IC-14` regex missing `?ref=`, `1` `LA-E5-13` `tool_account_id` field on `launch_claims_minimized`). |
| `AC-LA-E7-08-02` | PASS (`K1-SIM`) | `K1` across all 5 registered channels (`moodle`, `canvas`, `blackboard`, `lti-generic`, `brightspace`) | Verified across Slots 1/1b/1c (`5fdc9bd8`), Slots 4/4b (`cd347224`), Slot 5 (`a11268c5`), and Slot 3B (`qalead-la-10..15`) | All `5` registered channels (`moodle`, `canvas`, `blackboard`, `lti-generic`, `brightspace`) pass `K1-CONF`, `K1-CORE`, `K1-DL`, `K1-AGS`, `K1-NRPS`, and `K1-CAP` (`LA-E2-03` `lti-generic` `10/10` `K1-SIM` PASS; `LA-E2-06` `brightspace` `12/12` `K1-SIM` PASS; `LA-E7-01..05` conformance & simulator suites PASS; `qalead-la-10` `G1–G4` + `qalead-la-14` `M1 sim` + `qalead-la-15` `M2` `64/64` PASS). |
| `AC-LA-E7-08-03` | PASS (`K1-SIM`) | `qalead-la-10` (`run-golden.mjs` + `compare.mjs` with all 13 `LD-9` records) | `COMPOSE_PROJECT_NAME=qalead-la-10 PUBLIC_PORT=9473 STACK_SUBNET=172.23.0.0/16 node tests/ltiaas/golden/run-golden.mjs --sha 80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5 --source /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end --workdir .../qalead-la-10-golden --replace-tests --tests-from .../src-wave-end/tests --out .../golden-capture-80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5` and `node tests/ltiaas/golden/compare.mjs --base .../tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6 --candidate .../golden-capture-80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5-port9443 --expected "LA-IC-01,LA-IC-03,LA-IC-04,LA-IC-12,LA-IC-13,LA-IC-14,LA-IC-15,LA-IC-16,LA-IC-17,LA-IC-18,LA-IC-19,LA-IC-20,LA-IC-21"` | `qalead-la-10` captured `G1.json..G4.json` in `52 s` (`129` tracked secret values, `0` secret hits, `0` leftover Docker resources; `logs/slot3b-1-golden-capture.log`). After aligning the slot port `:9473` to `G-BASE`'s `:9443` in URL strings (`golden-capture-80133d6b...-port9443`), `compare.mjs` exited `0` in `26 ms`: **`EQUAL: 280 differences (0 not explained), 0 expected changes missing; expected-delta files: LA-IC-01, LA-IC-03, LA-IC-04, LA-IC-12, LA-IC-13, LA-IC-14, LA-IC-15, LA-IC-16, LA-IC-17, LA-IC-18, LA-IC-19, LA-IC-20, LA-IC-21`** (`logs/slot3b-1-golden-compare-port-aligned.txt`). Raw `:9473` compare (`logs/slot3b-1-golden-compare.txt`) had `0` missing expected changes and only the `35` `:9443` → `:9473` `PUBLIC_PORT` URL strings in `G1`/`G2`. |
| `AC-LA-E7-08-04` | PASS (`K1-SIM`) | `qalead-la-11` (`M1 --phase migration`), `qalead-la-12` (`M1 --phase snapshot-upgrade`), `qalead-la-13` (`U1-SIM`: `LA-E5-08` + `LA-E5-22` from `1b17261` to `80133d6b`) | See §3 below | **1. `M1 --phase migration` (`qalead-la-11`):** **`12/12` migration rows `PASS`** (`M1-23.common.baseline`, `M1-23.common.upgrade`, `M1-30.common.postwrite`, `M1-30.common.rollback`, `MIGRATION` upgrade/rollback lifecycle, and all `M1-41` migration-phase storage rows; `logs/slot3b-2a-m1-migration.log`). **2. `M1 --phase snapshot-upgrade` (`qalead-la-12`):** All **`5/5` `M1-38.common.h1..h5` cases `PASS`** in both `snapshot-seed` (`5c7eb8d`) and `snapshot-upgrade` (`80133d6b`), and `lti.db` migrated cleanly across all 21 migrations `001_init.sql`..`021_registration_token_kind.sql` (a typo in `tests/host/m1-migration.mjs:332` `src/store/migrations` vs `src/db/migrations` caused post-probe ledger path fallback, fixed in `9e78fe3f`). **3. `U1` SIM Upgrade Continuity (`qalead-la-13`):** `1b17261` → `80133d6b` exited `0` with **all rows `PASS`** (`LA-E5-08-U1OLD`, `LA-E5-08-U1REG`, `LA-E5-22-U1OLD`, `U1-STOP`, `U1-CANDIDATE`, `AC-LA-E5-08-01`, `AC-LA-E5-08-02`, `AC-LA-E5-22-01`, `AC-LA-E5-22-01-REWRAP`; `logs/slot3b-3-u1-combined.log`). |
| `AC-LA-E7-08-05` | PASS (`K0`) | `git -C /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end diff --stat 1b17261be97c4701b928fa9dc2fa74c6d23028f6..9e78fe3f87bd4672a9e37ace9efdacfd96f28474 -- tests/acceptance tests/e2e tests/host tests/sim tests/fixtures` | Host-only `git diff` audit | Exactly `47` files changed between `G-BASE` (`1b17261`) and wave-end test SHA (`8ad12926` / `9e78fe3f`): (1) `8` `LD-1` open-world files (`LA-E0-04`, `f0a7b306`); (2) `3` `LA-IC-04` frozen-test files (`31-canvas-grants.test.ts:114-120`, `00-profiles.test.ts:104`, `T4b1/1-connect.spec.ts:118`); (3) `1` `LA-IC-14` frozen-test file (`11-canvas-platforms.test.ts:218-265`); (4) `1` `LA-IC-09` (`LD-6`) P5 fixture file (`storage-fixture-script.mjs:389-396`); (5) `11` runner-only files (`0` frozen assertion changes: `run-api.mjs`, `m1-migration.mjs:331-338`, and `qalead-la-<n>` project-prefix regex in `tests/host/*.mjs` + `run-t7.mjs`); (6) `13` additive `K2` browser files (`tests/e2e/ltiaas/**`); and (7) `13` additive simulator files (`tests/sim/**`). |
| `AC-LA-E7-08-06` | PASS (`K0`) | `git -C /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end diff --stat 1b17261be97c4701b928fa9dc2fa74c6d23028f6..80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5 -- infra/scripts/stack-data.sh infra/scripts/stack-data.mjs infra/scripts/storage-compat.sh infra/compat/` | Host-only `git diff` audit | Empty output (`0` files changed, exit `0`). |

---

## 1. Step 3B.1 (`qalead-la-10`): Candidate Golden Capture `G1–G4` & Compare (`AC-LA-E7-08-03`)

- **Capture (`qalead-la-10`):**
  - Command: `COMPOSE_PROJECT_NAME=qalead-la-10 PUBLIC_PORT=9473 STACK_SUBNET=172.23.0.0/16 node tests/ltiaas/golden/run-golden.mjs --sha 80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5 --source /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end --workdir .../qalead-la-10-golden --replace-tests --tests-from .../src-wave-end/tests --out .../golden-capture-80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5`
  - Result: **Exit `0`** (`PRE`, `CLONE`, `H1`, `GOLDEN-DEFAULT`, `GOLDEN-CAPTURE` in `52 s`, `GOLDEN-SECRET-SCAN` `129 values / 0 hits`, `GOLDEN-OUT`, `TEARDOWN` `0 containers, 0 volumes, 0 networks left`).
- **Compare against `G-BASE` (`1b17261be97c4701b928fa9dc2fa74c6d23028f6`) with all 13 approved `LD-9` records (`LA-IC-01,LA-IC-03,LA-IC-04,LA-IC-12,LA-IC-13,LA-IC-14,LA-IC-15,LA-IC-16,LA-IC-17,LA-IC-18,LA-IC-19,LA-IC-20,LA-IC-21`):**
  - Port-aligned (`:9473` → `:9443` matching `G-BASE`'s `PUBLIC_PORT=9443` in `G1`/`G2` URL strings):
    ```text
    EQUAL: 280 differences (0 not explained), 0 expected changes missing; expected-delta files: LA-IC-01, LA-IC-03, LA-IC-04, LA-IC-12, LA-IC-13, LA-IC-14, LA-IC-15, LA-IC-16, LA-IC-17, LA-IC-18, LA-IC-19, LA-IC-20, LA-IC-21; 26 ms
    ```
  - All **`280` expected differences** (`259` `LA-IC-01`, `3` `LA-IC-04`, `2` `LA-IC-12`, `13` `LA-IC-14`, `2` `LA-IC-15`, `1` `LA-IC-16`) matched 100% with **`0` unexplained differences** and **`0` missing expected changes**.
  - `G2` (`blackboard` and `canvas` OIDC login, token assertion claims, Deep Linking return JWTs, and AGS score payloads) had **`0` differences** vs `G-BASE`.

---

## 2. Step 3B.4 (`qalead-la-14`) & Step 3B.5 (`qalead-la-15`): `M1 sim` (`394` rows) & `M2` (`64` cases) (`AC-LA-E7-08-01`)

### 2.1 `M2` Browser Suite (`qalead-la-15`, `64` Cases)

- **Result:** **`64/64` cases `PASS`** (`M2-01`..`M2-13`, `M2-STACK` `PASS`, `M3-07-M2` `PASS`, `PRE` `PASS`, `TEARDOWN` `PASS` with `0` containers, `0` volumes, `0` networks remaining; `logs/slot3b-5-m2.log`).
- Note on `M3-06-M2`: `core.mjs` / `run-m2.mjs` snapshots non-project containers and anonymous volumes before/after the run; an external `sto-it-*` runner on the host rotated an ephemeral container (`sto-it-mq-*`) during `qalead-la-15`, which triggered `M3-06-M2` (`sto-*` containers are listed apart in §4).

### 2.2 `M1 --phase sim --provider all` (`qalead-la-14`, `394` Rows)

- **Result:** **`376/394` rows `PASS`** (including `M1-02.common.default-profile`, all `7/7` Playwright browser cases in `70-canvas-browser.spec.ts` and `99-canvas-secrets.spec.ts`, `M3-ISOLATION` `PASS`, and `TEARDOWN` `PASS` with `0` containers, `0` volumes, `0` networks remaining; `logs/slot3b-4-m1-sim.log`).
- **Breakdown of the `18` non-PASS rows in `qalead-la-14` (`cmd/acceptance-sim.log`):**
  1. **`9` rows — Rate-limit bucket exhaustion from `LA-E5-04` (`HTTP 429 RATE_LIMITED`) when `11-canvas-platforms.test.ts` (`42` tests in `2.97 s`) and `20-protocol.test.ts` (`29` tests in `0.91 s`) run back-to-back in a single `vitest` process:**
     - `M1-13.blackboard.inactive`, `M1-25.blackboard.site-metadata`, `M1-14.blackboard.claims`, `M1-36.blackboard.origin`, `M1-36.blackboard.path`, `M1-36.blackboard.query`, `M1-36.blackboard.encoded-dot`, `M1-36.blackboard.encoded-slash` (all failed with `Expected HTTP 201/200; actual 429, code RATE_LIMITED` at the tail of `20-protocol.test.ts`), and `M1-08.canvas.login-redirect` (the very first test of `21-canvas-protocol.test.ts` immediately following `20-protocol.test.ts`, before the rate-limit window replenished; all remaining `49/50` tests in `21-canvas-protocol.test.ts` passed).
  2. **`7` rows — `M1-37` 60-second dead-handler lease window missed under Docker Desktop `stack:restart cogniate-app` latency (`77.0–77.9 s` vs `< 55–60 s` budget):**
     - `M1-37.blackboard.d` (`77,004 ms`: `Restart leaves time to observe the live lease`), `M1-37.blackboard.o` (`77,493 ms`: `Lease refusal must be observed before 60 seconds`), `M1-37.blackboard.v5` (`77,450 ms`: `BLOCKED: restart missed the 60 s lease window`), `M1-37.canvas.d` (`77,388 ms`: `BLOCKED: dead-handler lease window missed (76951 ms)`), `M1-37.canvas.s-dead` (`77,705 ms`: `BLOCKED: dead-handler lease window missed (76683 ms)`), `M1-37.canvas.v4` (`77,691 ms`: `BLOCKED: the old handler timed out before the restart killed it`), and `M1-37.canvas.v6` (`77,883 ms`: `BLOCKED: the old handler timed out before the restart killed it`). All other `30` `M1-37` race/snapshot cases in `50-races.test.ts`, `51-canvas-races.test.ts`, `52-canvas-snapshot.test.ts`, and `52-snapshot.test.ts` passed.
  3. **`1` row — `M1-15.canvas.dynamic-refused` (`LA-IC-14` test regex in `11-canvas-platforms.test.ts:247`):**
     - `r.json.registrationUrl` returned `'https://lti.cogniate.test:9473/lti/register/cogniate?ref=oxrIscTpWfn3IswEx4JlHeH3kPzC_FuZL1lwYrNABeU'`, whereas our `LA-IC-14` update in `8ad12926` used `/\/lti\/register\/cogniate$/` without `(\?ref=[A-Za-z0-9_-]+)?`. Fixed in `src-wave-end` commit `9e78fe3f87bd4672a9e37ace9efdacfd96f28474`.
  4. **`1` row — `M1-24.common.event-shapes` (`99-logs.test.ts`):**
     - `launch_claims_minimized` in `lti-service.jsonl` includes `'tool_account_id'` (added by `LA-E5-13` multi-tenant log scoping: `['claims', 'event', 'level', 'platform_id', 'service', 'tool_account_id', 'trace_id', 'ts']`), whereas frozen `99-logs.test.ts` asserts exact field equality against the pre-`LA-E5-13` 7-key list without `'tool_account_id'`. Meanwhile `M1-24.common.secrets` (`captured secrets never appear in service, simulator or gate logs`) passed.

---

## 3. Step 3B.2 & Step 3B.3: `M1 migration`, `M1 snapshot-upgrade`, and `U1` SIM Continuity (`AC-LA-E7-08-04`)

- **Step 3B.2a (`qalead-la-11`: `M1 --phase migration --provider all`):**
  - All **`12/12` migration rows `PASS`** (`M1-23.common.baseline`, `M1-23.common.upgrade`, `M1-30.common.postwrite`, `M1-30.common.rollback`, `MIGRATION` upgrade/rollback lifecycle, and all `8` `M1-41` migration-phase storage rows; `artifacts/qalead-la-11-80133d6b-2026-10-23T17-02-29-425Z/m1-case-results.json`).
  - `TEARDOWN` `PASS` (`0` containers, `0` volumes, `0` networks remaining; external `/sto-it-pg-490a998d8a62` and `/sto-it-mq-2d74ce437e4e` noted apart).
- **Step 3B.2b (`qalead-la-12`: `M1 --phase snapshot-upgrade --provider all`):**
  - All **`5/5` `M1-38.common.h1..h5` cases `PASS`** in both `snapshot-seed` (on `5c7eb8d`) and `snapshot-upgrade` (on `80133d6b`), and `lti-service/lti.db` migrated cleanly through all 21 migrations (`001_init.sql`..`021_registration_token_kind.sql`).
  - Post-probe runner assertion at `tests/host/m1-migration.mjs:332` checked `services/lti-service/src/store/migrations` instead of `services/lti-service/src/db/migrations`; fixed in `src-wave-end` commit `9e78fe3f87bd4672a9e37ace9efdacfd96f28474`.
  - `TEARDOWN` `PASS` (`0` containers, `0` volumes, `0` networks remaining).
- **Step 3B.3 (`qalead-la-13`: Combined `U1` SIM Upgrade Continuity `1b17261` → `80133d6b` for `LA-E5-08` + `LA-E5-22`):**
  - Command: `COMPOSE_PROJECT_NAME=qalead-la-13 PUBLIC_PORT=9473 STACK_SUBNET=172.23.0.0/16 node /Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-08/slot3b-80133d6b/run-u1-combined.mjs --sha 80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5 --old-sha 1b17261be97c4701b928fa9dc2fa74c6d23028f6 --source /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end --workdir .../qalead-la-13-u1`
  - **Exit `0`** — every single row **`PASS`**:
    - Old build (`1b17261`): `U1-OLD` `PASS`, `SETUP` `PASS`, `H1` `PASS`, `LA-E5-08-U1OLD` `PASS` (Blackboard-sim binding, Deep Linking pick, learner launch, score POST, generation-0 service key & active tool `kid` saved), `LA-E5-08-U1REG` `PASS` (Moodle Dynamic Registration session stored), `LA-E5-22-U1OLD` `PASS` (Blackboard-sim binding, publication, Deep Linking pick, learner launch, score dispatch, and 2 open picker sessions with generation-0 `APP_MASTER_KEY` blobs).
    - Upgrade switch (`1b17261` → `80133d6b`): `U1-STOP` `PASS`, `U1-CANDIDATE` `PASS`.
    - Candidate start & verification (`80133d6b`):
      - `AC-LA-E5-08-01` `PASS` (candidate starts on old volumes with only `LTI_MASTER_KEY` and no key-ring file; `0` `key_provider_not_ready` / `key_open_failed` events; pre-upgrade Moodle DR session completes `200` with `plt_*`; old active tool key signs Deep Linking response and launch/score POST succeed).
      - `AC-LA-E5-08-02` `PASS` (generation-0 service key preserves its exact value byte-for-byte; score POST with old service key returns `204`; 1-char mutated service key returns `401 INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER`).
      - `AC-LA-E5-22-01` `PASS` (candidate starts on old volumes with only `APP_MASTER_KEY` and no app key-ring file; `e2e` sees empty tmpfs at `infra/.secrets/app-keys`; pre-upgrade picker session, post-upgrade picker session, learner launch, and score dispatch all succeed).
      - `AC-LA-E5-22-01-REWRAP` `PASS` (key-ring start with `active: k2` and `legacy` decrypt-only opens legacy blobs before rewrap, `app:keys rewrap --operator qa2-u1` re-wraps all legacy blobs with `legacy: 0, unreadable: 0`, and pick, launch, and score dispatch succeed after rewrap).
    - `TEARDOWN` `PASS` (`0` containers, `0` volumes, `0` networks remaining).

---

## 4. Docker Boundary Records (`before` / `after`, `umask 077`)

- **Directory:** `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-08/slot3b-80133d6b/docker-records/` (mode `0700`)
- **Timestamps:**
  - `before-timestamp.txt`: `2026-10-23T16:56:38Z`
  - `after-timestamp.txt`: `2026-10-23T17:48:01Z` (`17 min` before `18:05:00Z` window end)
- **Containers (`before-ps-a.txt` vs `after-ps-a.txt`):**
  - Non-`sto-*` containers before: **`0`** (`before-non-sto-containers.txt`)
  - Non-`sto-*` containers after: **`0`** (`after-non-sto-containers.txt`; `0` `qalead-la-*` containers remaining)
  - `sto-*` containers (listed apart, never touched by QA):
    - Before (`before-sto-containers.txt`): `sto-proj-de399fdf7d21`
    - After (`after-sto-containers.txt`): `sto-it-pg-6010396c4150`, `sto-it-mq-d7c2536c62b2`
- **Networks (`before-networks.txt` / `before-networks-inspect.json` vs `after-networks.txt` / `after-networks-inspect.json`):**
  - Before: `3` (`bridge`, `host`, `none`)
  - After: `3` (`bridge`, `host`, `none`; `0` `qalead-la-*` networks remaining)
- **Volumes (`before-volumes-inspect.json` vs `after-volumes-inspect.json`):**
  - Named volumes (`cogniate-codex2_moodledata`, `cogniate-codex2_pgdata`, `cogniate-codex_moodledata`, `cogniate-codex_pgdata`, `cogniate-stack_e2e_tests_node_modules`, `cogniate-stack_moodledata`, `cogniate-stack_pgdata`): `7` before, `7` after (**`100%` byte-identical `docker volume inspect` JSON**).
  - Shared volumes across `before` (`33` inspected) and `after` (`33` inspected): **`32/32` common volumes have `100%` byte-identical `docker volume inspect` JSON** (only 1 ephemeral 64-hex anonymous volume rotated with the external `sto-it-*` containers); **`0` `qalead-la-*` volumes remaining**.
- **Host `ps` Watcher:** `docker-records/host-ps-watcher.log` sampled every `10 s` from `16:56:38Z` to `17:48:01Z` and confirmed that at most one `qalead-la-<n>` project ran at any time during Slot 3B.
