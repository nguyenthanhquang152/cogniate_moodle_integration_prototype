# QA-3 K1-SIM Execution Plan (Lanes K, R, and P — Golden-Free & MOODLE-LIVE-Free)

- **Lane / Role**: `QA-3` (`tests/ltiaas/tasks-core/**`, lanes K, R, and P)
- **Docker Window Rule**: **Not granted yet (`HOST-ONLY`)** — do not run any Docker command until the Lead issues an explicit `DOCKER-YES` grant (`docs/team/ltiaas/charter-LA.md` §0).
- **Compose Project Naming**: `COMPOSE_PROJECT_NAME=qa3-la-sim-r<n>` (`qa3-la-sim-r1` .. `qa3-la-sim-r3`)
- **Port & Subnet**: `PUBLIC_PORT=9453`, `STACK_SUBNET=172.21.0.0/16`
- **Scope**: Every `K1-SIM`, `MOODLE-LIVE`-free, and golden-free row of QA-3's lanes (K, R, and P) that is `"pending: Docker window"` in `docs/reviews/LA-*/qa.md` (plus the ready test-first `LA-E2-03` K1-SIM suite in `tests/ltiaas/tasks-core/LA-E2-03/`). Golden-capture/compare rows (`G1`–`G4`), Lead QA R1/migration/U1 SIM runs, QA-E2E `K2` browser runs, and `MOODLE-LIVE` rows are listed separately in §1.2.

---

## 1. Suite Execution Order & Time Budget

### 1.1 Golden-Free, MOODLE-LIVE-Free `K1-SIM` Suites (`qa3-la-sim-r1` .. `qa3-la-sim-r3`)

The QA-3 suites run in the dependency and state-isolation order below:

| Order | Task ID | Lane | Batch | Project (`COMPOSE_PROJECT_NAME`) | K1-SIM ACs / Tests | Tasks README §2 Forms / Controls | Est. Standalone Min | Est. Batched Min | Why This Order |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `LA-E5-12` | K | Batch 1a | `qa3-la-sim-r1` | `7` `K1-SIM` (`AC-LA-E5-12-01` .. `-07` in `cli-audit.k1sim.test.ts`) | Form (b) (`docker compose exec -e STACK_PROFILE=production -e OPERATORS=<name> cogniate-app npm run app:grant -- …`), form (i) (`docker compose exec cogniate-app npm run app:audit -- list …`) | 6 min | 6 min | Runs first on a clean `acceptance` stack via `tests/ltiaas/tasks-core/LA-E5-12/run.mjs`. Exercises per-process CLI env overrides (`STACK_PROFILE=production`, `OPERATORS`, `OPERATORS_FILE`, `OPERATOR_NAME`) without restarting services or mutating transport gates. |
| 2 | `LA-E1-08` (`AC-02`) | K | Batch 1b | `qa3-la-sim-r1` | `1` `K1-SIM` AC (`AC-LA-E1-08-02`: 4 K1-CAP C2 M1 guard cases: `M1-18.blackboard.tool-config`, `M1-21.blackboard.capabilities`, `M1-20.canvas.capability-moodle`, `M1-21.canvas.course-shell`) | Standard `e2e` container HTTP calls + three network oracles (`evil.test` sink, `outbound_request` / `outbound_blocked` logs, `/__sim/records`) | 5 min | 1 min | Pure negative capability-guard checks (`409 CAPABILITY_NOT_SUPPORTED` for `webServices`, `canvasConfiguration`, `addDeployment`, `courseShell`) with zero outbound calls or state side effects. Can run on `qa3-la-sim-r1` before teardown (~1 min) or standalone (~5 min). |
| 3 | `LA-E4-03` (`AC-02..05`) | R | Batch 2 | `qa3-la-sim-r2` | `4` `K1-SIM` (`AC-LA-E4-03-02` .. `-05` in `reporter.k1sim.test.ts`) | Form (l) (`npm run stack:restart -- lti-service` and `npm run stack:restart -- cogniate-app`), `lti-gate` rules (`https://lti-gate.test/__gate/*`), simulator `scoreAnswers` (`409`, `429 Retry-After: 30`, `503`) | 8 min | 8 min | Isolated in `qa3-la-sim-r2` because `AC-02` restarts `lti-service`, `AC-03` triggers a 30 s partition throttle pause (`429` + `Retry-After: 30`), `AC-04` holds platform A score requests at `lti-gate` for cross-platform fairness, and `AC-05` restarts `cogniate-app` while a score POST is held in flight (`uncertain` recovery + confirmation send `>= 5 s` later). |
| 4 | `LA-E2-03` (`AC-03, -04, -05, -07`) *(when `LA-E2-03` is merged)* | K | Batch 3 | `qa3-la-sim-r3` | `4` `K1-SIM` (`AC-LA-E2-03-03`, `-04`, `-05`, `-07` in `lti-generic.k1sim.test.ts`) | Standard `e2e` container HTTP calls (`GET /app-api/lms-providers`, `GET /api/providers`, `POST /app-api/connections`, `GET .../tool-configuration`, `POST /api/platforms`) | 5 min | 2 min *(on `r1`)* / 5 min *(own `r3`)* | Ready test-first suite in `tests/ltiaas/tasks-core/LA-E2-03/lti-generic.k1sim.test.ts`. Cleans up created platforms in `afterEach`. Run if `LA-E2-03` is merged before the window opens. |
| **Subtotal (merged `qa.md` tasks)** | **3 suites** | **K, R** | **Batches 1–2** | `qa3-la-sim-r1..r2` | **`12` `K1-SIM` ACs (`15` test cases)** | Forms (b), (i), (l), `lti-gate`, `lms-sim` | **~19 min** | **~15 min** | Covers every golden-free, `MOODLE-LIVE`-free K1-SIM row currently `"pending: Docker window"` in QA-3's `qa.md` files. |
| **Total (including `LA-E2-03`)** | **4 suites** | **K, R** | **Batches 1–3** | `qa3-la-sim-r1..r3` | **`16` `K1-SIM` ACs (`19` test cases)** | Forms (b), (i), (l), `lti-gate`, `lms-sim` | **~24 min** | **~17–20 min** | Includes `LA-E2-03` if merged on integration prior to the slot. |

### 1.2 Other `"pending: Docker window"` Rows in QA-3 `qa.md` Files (Kept Separate by Rule)

Per `docs/architecture/ltiaas/tasks/README.md` §2 and the Lead's instructions, the remaining `"pending: Docker window"` rows in QA-3's `qa.md` files are **not** part of the golden-free, `MOODLE-LIVE`-free K1-SIM batches above:

| Category | Task & AC Rows | Suite / Runner | Owner & Slot |
| --- | --- | --- | --- |
| **Golden Capture / Compare (`G1`–`G4`)** | `LA-E1-01` `AC-03` (`G1`), `LA-E1-02` `AC-09` (`G1`), `LA-E1-06` `AC-05` (`G1`), `LA-E1-07` `AC-07` (`G1`, `G4`), `LA-E1-08` `AC-01` (`G1.canvasConfiguration`), `LA-E1-09` `AC-01` (`G2`, `G3` with `LA-IC-19`), `LA-E4-02` `AC-08` (`G3`), `LA-E4-05` `AC-05` (`G3` with `LA-IC-15`) | `tests/ltiaas/golden/run-golden.mjs` (1 SIM capture) + host-only `LA_LEVEL=k1sim npx --prefix tests vitest run --config tests/ltiaas/tasks-core/<task>/vitest.config.mts` (~1 min total for all 8 compare suites once capture folder exists) | Lead QA golden capture on SIM slot (`qa-la-sim-r<n>`) + QA-3 / Lead QA host-only compare |
| **Lead QA Per-Step `R1` & Migration / `U1` Runs (`K1-SIM`)** | `LA-E1-06` `AC-07` (`R1`), `LA-E1-06` `AC-08` (`migration` + `snapshot-upgrade` + `U1`), `LA-E1-07` `AC-07` (`R1`), `LA-E1-08` `AC-07` (`R1`), `LA-E1-11` `AC-06` (`R1` + `T6` subset), `LA-E4-02` `AC-06` (`U1`), `LA-E4-02` `AC-07` (`migration` + `snapshot-upgrade`), `LA-E4-02` `AC-09` (`R1`) | `tests/host/run-m1.mjs --phase sim|migration|snapshot-upgrade`, `tests/e2e/host/run-m2.mjs` | Lead QA (`qa-la-sim-r<n>`, `tasks/README.md` §2) |
| **QA-E2E Browser Cases (`K2`)** | `LA-E1-11` `AC-04` (`K2 U1`), `LA-E1-11` `AC-05` (`K2 U2`) | `tests/e2e/ltiaas/**` (Chromium on SIM lane) | QA-E2E (`qa-la-sim-r<n>`, `tasks/README.md` §2) |
| **Moodle 5.2 Live Checks (`MOODLE-LIVE`)** | `LA-E1-07` `AC-08` (`R2-lite`: `T7 × 1`, `T4b1`, `T4b2`), `LA-E1-08` `AC-08` (`R2-lite`: `T7 × 1`, `T8`), `LA-E1-09` `AC-05` (`R2-lite`: `T7 × 1`, `T4b2`, `T5a`, `T6`), `LA-E4-02` `AC-10` (`T5a`, `T5b` with `LD-6` `record_dispatch` fixture, `T7 × 1`), `LA-E4-03` `AC-09` (`T5a`, `T5b`, `T7 × 1`) | `tests/host/run-{t4b,t5,t8}.mjs`, `tests/e2e/host/run-t7.mjs` | Lead QA + QA-E2E (`qa-la-moodle-r<n>`, `tasks/README.md` §2) |

---

## 2. Pre-Window Host-Only Gate (`0` Docker)

Run these host-only checks in an isolated `--no-hardlinks` clone of the target integration SHA before starting the Docker window:

```sh
# 1. Typecheck acceptance/e2e harness and all QA-3 tasks-core suites (0 Docker)
npm --prefix tests run typecheck
npx --prefix tests tsc --noEmit \
  --target ES2022 --module ESNext --moduleResolution Bundler \
  --strict --skipLibCheck --isolatedModules --esModuleInterop \
  --resolveJsonModule --allowJs --allowImportingTsExtensions --types node \
  tests/ltiaas/tasks-core/**/*.ts tests/ltiaas/tasks-core/**/*.mts
node --check tests/ltiaas/tasks-core/LA-E5-12/run.mjs

# 2. Verify K1-SIM test discovery (0 Docker)
for t in LA-E5-12 LA-E4-03 LA-E2-03 LA-E1-08; do
  LA_LEVEL=k1sim npx --prefix tests vitest list --config "tests/ltiaas/tasks-core/$t/vitest.config.mts" || exit 1
done
QA_M1_PROVIDER=all QA_GREP="M1-18\.blackboard\.tool-config|M1-21\.blackboard\.capabilities|M1-20\.canvas\.capability-moodle|M1-21\.canvas\.course-shell" \
  npx --prefix tests vitest list --config tests/acceptance/M1/vitest.config.mts

# 3. Run K0 and UNIT-row gates for the K1-SIM tasks (0 Docker)
for t in LA-E5-12 LA-E4-03 LA-E4-05; do
  LA_LEVEL=k0 LA_SCRATCH_CLONE="$PWD" LA_RUN_DIR="$RUN_ROOT/k0/$t" \
    npx --no-install vitest run --config "tests/ltiaas/tasks-core/$t/vitest.config.mts" --reporter=verbose || exit 1
done
```

### Recorded Pre-Window Host-Only Gate Result on `f2e340e` (Code `19d6dc4`)

Executed on **2026-10-23** against integration SHA `f2e340e0e5bce7e2071ca7d7dfecd92a40c12e5f` (product code identical to `19d6dc4a2ebe64dd5e97cb9ed43b0bb64c01c3e9`) in a fresh `--no-hardlinks` clone at `~/cogniate-qa-runs/LA/k1-sim-plan-gate/r1/clone` (`umask 077`, push disabled, `0` Docker commands run):

| Gate Step | Command / Target | Result | Measured Time & Details |
| --- | --- | --- | --- |
| Clone & install | `git clone --no-hardlinks` (`f2e340e`) + `npm ci` + `npm --prefix tests ci` | **PASS** (exit `0`) | `6.0 s` (`~/cogniate-qa-runs/LA/k1-sim-plan-gate/r1/k0/{root,tests}-npm-ci.log`) |
| `tests/` & `tasks-core/**` typecheck + runner syntax | `npm --prefix tests run typecheck` + `tsc --noEmit ... tests/ltiaas/tasks-core/**/*.{ts,mts}` + `node --check tests/ltiaas/tasks-core/LA-E5-12/run.mjs` | **PASS** (exit `0`) | `5.0 s`; `0` errors across all `tests/ltiaas/tasks-core/**` files. *(Note: running `tsc -p tests/ltiaas/tsconfig.json` across all QA folders flags 14 TS errors in QA-4's `tests/ltiaas/tasks-lti/{LA-E3-11,LA-E3-12,LA-E3-13,LA-E5-18}` `hasErrorShape`/`errorCode` calls; `tests/ltiaas/tasks-core/**` is 100% clean.)* |
| K1-SIM Vitest discovery | `LA_LEVEL=k1sim npx --prefix tests vitest list` on `LA-E5-12`, `LA-E4-03`, `LA-E2-03`, `LA-E1-08` + M1 capability-guard filter | **PASS** (exit `0`) | Discovers all `7` `AC-LA-E5-12-01..07` tests, all `4` `AC-LA-E4-03-02..05` tests, all `4` `AC-LA-E2-03-03,04,05,07` tests, `AC-LA-E1-08-01`, and the M1 capability-guard cases. |
| `LA-E5-12` K0 + UNIT gate | `LA_LEVEL=k0 ... vitest run --config tests/ltiaas/tasks-core/LA-E5-12/vitest.config.mts` | **PASS** (`2/2` tests, exit `0`) | `86.37 s` (`npm run check`: `180` unit test files / `2,857` passed, `5` skipped; `3` K0 files / `121` passed; `F1 PASS: 0 files with hits, 0 hits`; `F5 PASS: 6 rules, 0 hits`; `AC-LA-E5-12-08` unit suite `1.47 s`). |
| `LA-E4-03` K0 + UNIT gate | `LA_LEVEL=k0 ... vitest run --config tests/ltiaas/tasks-core/LA-E4-03/vitest.config.mts` | **PASS** (`3/3` tests, exit `0`) | `89.15 s` (`R0` check + `AC-LA-E4-03-01, -06, -07, -08` + `BD-A1-61` neutral-kernel and M1 `score_sync`/`sync_` invariants). |
| `LA-E4-05` K0 + UNIT gate | `LA_LEVEL=k0 ... vitest run --config tests/ltiaas/tasks-core/LA-E4-05/vitest.config.mts` | **PASS** (`2/2` tests, exit `0`) | `97.85 s` (`R0` check + `AC-LA-E4-05-01..04` worker process mode and production `job_runner_twice` refusal). |

---

## 3. Before / After Docker Records (`umask 077` & `charter-LA §0` 32 Volume Guard)

Immediately after receiving an explicit `DOCKER-YES` grant from the Lead (and **before** starting Batch 1), create a private boundary-records directory with `umask 077` and snapshot all existing Docker containers, networks, and volumes (including the 32 protected volume records from `docs/team/ltiaas/charter-LA.md` §0):

```sh
umask 077
export QA3_WINDOW_DIR="$HOME/cogniate-qa-runs/LA/qa3-k1sim-window-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$QA3_WINDOW_DIR/boundary"

# Before-window Docker records (mode 0600 inside 0700 folder)
docker ps -a --no-trunc > "$QA3_WINDOW_DIR/boundary/docker-ps-before.txt"
docker network ls --no-trunc > "$QA3_WINDOW_DIR/boundary/docker-networks-before.txt"
docker volume ls > "$QA3_WINDOW_DIR/boundary/docker-volumes-before.txt"
docker volume ls -q | sort > "$QA3_WINDOW_DIR/boundary/docker-volume-names-before.txt"
if [ -s "$QA3_WINDOW_DIR/boundary/docker-volume-names-before.txt" ]; then
  docker volume inspect $(cat "$QA3_WINDOW_DIR/boundary/docker-volume-names-before.txt") \
    > "$QA3_WINDOW_DIR/boundary/docker-volumes-inspect-before.json"
fi

# Verify no pre-existing qa3-la-sim-r* resources exist at the boundary
docker ps -a --filter "name=qa3-la-sim-"
docker network ls --filter "name=qa3-la-sim-"
docker volume ls --filter "name=qa3-la-sim-"
```

After all batches and owned-only cleanup (§5) complete, capture the after-window records and verify zero diff on non-`qa3-la-sim-*` volumes:

```sh
umask 077
docker ps -a --no-trunc > "$QA3_WINDOW_DIR/boundary/docker-ps-after.txt"
docker network ls --no-trunc > "$QA3_WINDOW_DIR/boundary/docker-networks-after.txt"
docker volume ls > "$QA3_WINDOW_DIR/boundary/docker-volumes-after.txt"
docker volume ls -q | sort > "$QA3_WINDOW_DIR/boundary/docker-volume-names-after.txt"
if [ -s "$QA3_WINDOW_DIR/boundary/docker-volume-names-after.txt" ]; then
  docker volume inspect $(cat "$QA3_WINDOW_DIR/boundary/docker-volume-names-after.txt") \
    > "$QA3_WINDOW_DIR/boundary/docker-volumes-inspect-after.json"
fi

# Verify the 32 protected volume names and inspect records are byte-identical before vs after
diff -u "$QA3_WINDOW_DIR/boundary/docker-volume-names-before.txt" \
        "$QA3_WINDOW_DIR/boundary/docker-volume-names-after.txt"
diff -u "$QA3_WINDOW_DIR/boundary/docker-volumes-inspect-before.json" \
        "$QA3_WINDOW_DIR/boundary/docker-volumes-inspect-after.json"
```

---

## 4. Exact Commands Per Batch (During Granted Window)

Set the window environment variables:

```sh
export SHA="f2e340e0e5bce7e2071ca7d7dfecd92a40c12e5f"
export PUBLIC_PORT=9453
export STACK_SUBNET="172.21.0.0/16"
```

### Batch 1 (`COMPOSE_PROJECT_NAME=qa3-la-sim-r1`, ~7 min batched / ~11 min standalone): `LA-E5-12` & `LA-E1-08` (`AC-02`)

#### 1a. `LA-E5-12` (`AC-LA-E5-12-01` .. `AC-LA-E5-12-07`, ~6 min)

`tests/ltiaas/tasks-core/LA-E5-12/run.mjs` clones `$SHA` with `--no-hardlinks`, brings up `qa3-la-sim-r1` on `PUBLIC_PORT=9453` and `STACK_SUBNET=172.21.0.0/16`, runs the host-control listener for `qa3-app-cli` (tasks README §2 forms (b) and (i): `docker compose -f infra/compose.yaml --env-file .env exec -T --workdir /repo -e NPM_CONFIG_UPDATE_NOTIFIER=false [-e STACK_PROFILE=production] [-e OPERATORS=qa-op] [-e OPERATORS_FILE=...] [-e OPERATOR_NAME=...] cogniate-app npm run <app:grant|app:binding|app:audit> -w services/cogniate-app -- ...`), runs `cli-audit.k1sim.test.ts` inside `e2e`, records per-AC results, and tears down `qa3-la-sim-r1`:

```sh
COMPOSE_PROJECT_NAME=qa3-la-sim-r1 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  node tests/ltiaas/tasks-core/LA-E5-12/run.mjs --sha "$SHA" \
  --workdir "$QA3_WINDOW_DIR/qa3-la-sim-r1-e512"
```

#### 1b. `LA-E1-08` `AC-LA-E1-08-02` (K1-CAP C2 Capability Guards with M1 Values, ~1 min batched / ~5 min standalone)

Runs the M1 capability-guard cases (`M1-18.blackboard.tool-config`, `M1-21.blackboard.capabilities`, `M1-20.canvas.capability-moodle`, `M1-21.canvas.course-shell`) on `qa3-la-sim-r1` to verify:
- Blackboard `PUT /app-api/connections/:id/web-services` → `409 CAPABILITY_NOT_SUPPORTED` (`details.capability = "webServices"`) and `GET /app-api/connections/:id/canvas-configuration` → `409 CAPABILITY_NOT_SUPPORTED` (`details.capability = "canvasConfiguration"`).
- Moodle `POST /app-api/connections/:id/deployments` → `409 CAPABILITY_NOT_SUPPORTED` (`details.capability = "addDeployment"`).
- Canvas `POST /app-api/publications` with `createMoodleCourse: {}` → `409 CAPABILITY_NOT_SUPPORTED` (`details.capability = "courseShell"`).
- Each with the three network oracles (error code, zero hits on `evil.test`, zero `outbound_request` / `outbound_blocked` events).

If run inside the active `qa3-la-sim-r1` clone before teardown (~1 min):

```sh
(
  cd "$QA3_WINDOW_DIR/qa3-la-sim-r1-e512" && \
  COMPOSE_PROJECT_NAME=qa3-la-sim-r1 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  QA_TASK=M1 QA_M1_PROVIDER=all \
  QA_GREP="M1-18\.blackboard\.tool-config|M1-21\.blackboard\.capabilities|M1-20\.canvas\.capability-moodle|M1-21\.canvas\.course-shell" \
    npm run test:acceptance
)
```

---

### Batch 2 (`COMPOSE_PROJECT_NAME=qa3-la-sim-r2`, ~8 min): `LA-E4-03` (`AC-LA-E4-03-02` .. `AC-LA-E4-03-05`)

Runs `tests/ltiaas/tasks-core/LA-E4-03/reporter.k1sim.test.ts` on an isolated compose project `qa3-la-sim-r2` with the M1 host-control listener (`m1-restart` for `npm run stack:restart -- lti-service` and `npm run stack:restart -- cogniate-app`, tasks README §2 form (l)), `lti-gate` rules (`https://lti-gate.test/__gate/*`), and `lms-sim` `scoreAnswers`:

```sh
umask 077
CLONE_R2="$QA3_WINDOW_DIR/qa3-la-sim-r2-e403"
git clone --quiet --no-hardlinks --no-checkout . "$CLONE_R2"
(
  cd "$CLONE_R2"
  git remote set-url --push origin no_push
  git checkout --quiet --detach "$SHA"
  export COMPOSE_PROJECT_NAME=qa3-la-sim-r2
  export PUBLIC_PORT=9453
  export STACK_SUBNET="172.21.0.0/16"

  npm ci --no-audit --no-fund
  npm run gen-env
  npm run stack:up
  npm run seed

  # Start the host-control listener for form (l) m1-restart (lti-service & cogniate-app)
  # and run LA-E4-03 K1-SIM (AC-LA-E4-03-02, -03, -04, -05) inside the e2e container:
  node --input-type=module -e '
    import path from "node:path";
    import { createHostControl } from "./tests/host/host-control.mjs";
    import { readEnv, run } from "./tests/host/lib.mjs";
    const env = { ...process.env, ...readEnv(".env"), COMPOSE_PROJECT_NAME: process.env.COMPOSE_PROJECT_NAME };
    const fakeRunner = {
      CLONE: process.cwd(),
      STACK_ENV: env,
      state: { h1Verified: true, urls: { lti: env.PUBLIC_LTI_URL, app: env.PUBLIC_APP_URL }, ca: "infra/.certs/root.crt" },
      saveText: () => {},
      waitHealth: async () => ({ ok: true }),
    };
    const ctl = createHostControl(fakeRunner, {
      "m1-restart": async (req) => {
        if (!["lti-service", "cogniate-app"].includes(req.service)) return { code: 2 };
        const res = await run("npm", ["run", "stack:restart", "--", req.service], { cwd: process.cwd(), env, timeoutMs: 180_000 });
        return { code: res.code };
      },
    });
    const stop = ctl.start();
    try {
      const res = await run(
        "npm",
        [
          "run",
          "test:acceptance",
          "--",
          "reporter.k1sim.test.ts",
          "--reporter=default",
          "--reporter=json",
          "--outputFile=/repo/tests/acceptance/artifacts/vitest-results.json",
        ],
        { cwd: process.cwd(), env: { ...env, QA_TASK: "LA-E4-03" }, timeoutMs: 1_200_000 },
      );
      process.exitCode = res.code;
    } finally {
      stop();
      await run("npm", ["run", "stack:down"], { cwd: process.cwd(), env, timeoutMs: 300_000 });
    }
  '
)
```

---

### Batch 3 (`COMPOSE_PROJECT_NAME=qa3-la-sim-r3`, ~5 min standalone / ~2 min if shared, Conditional on `LA-E2-03` Merge): `LA-E2-03` (`AC-LA-E2-03-03`, `-04`, `-05`, `-07`)

Run once `LA-E2-03` is merged on the integration branch:

```sh
umask 077
CLONE_R3="$QA3_WINDOW_DIR/qa3-la-sim-r3-e203"
git clone --quiet --no-hardlinks --no-checkout . "$CLONE_R3"
(
  cd "$CLONE_R3"
  git remote set-url --push origin no_push
  git checkout --quiet --detach "$SHA"
  export COMPOSE_PROJECT_NAME=qa3-la-sim-r3
  export PUBLIC_PORT=9453
  export STACK_SUBNET="172.21.0.0/16"

  npm ci --no-audit --no-fund
  npm run gen-env
  npm run stack:up
  npm run seed
  try_rc=0
  QA_TASK=LA-E2-03 npm run test:acceptance -- \
    lti-generic.k1sim.test.ts \
    --reporter=default \
    --reporter=json \
    --outputFile=/repo/tests/acceptance/artifacts/vitest-results.json || try_rc=$?
  npm run stack:down
  exit "$try_rc"
)
```

---

## 5. Owned-Only Cleanup Commands (`TEST-STRATEGY §5.4` & `charter-LA §0`)

Every batch brings down its own stack in `finally`. Before closing the Docker window (or after any interrupted run), run this label-scoped cleanup sweep to guarantee zero leftover `qa3-la-sim-r1`..`qa3-la-sim-r3` containers, networks, or volumes without touching any other lane's resources (`docker system prune` and `docker volume prune` are **forbidden**):

```sh
for proj in qa3-la-sim-r1 qa3-la-sim-r2 qa3-la-sim-r3; do
  # 1. Remove containers owned by $proj
  cids=$(docker ps -aq --filter "label=com.docker.compose.project=${proj}")
  if [ -n "$cids" ]; then
    docker rm -f $cids
  fi

  # 2. Remove networks owned by $proj
  nids=$(docker network ls -q --filter "label=com.docker.compose.project=${proj}")
  if [ -n "$nids" ]; then
    docker network rm $nids
  fi

  # 3. Remove volumes owned by $proj
  vids=$(docker volume ls -q --filter "label=com.docker.compose.project=${proj}")
  if [ -n "$vids" ]; then
    docker volume rm -f $vids
  fi
done

# 4. Verify zero qa3-la-sim-* resources remain
docker ps -a --filter "name=qa3-la-sim-"
docker network ls --filter "name=qa3-la-sim-"
docker volume ls --filter "name=qa3-la-sim-"
```
