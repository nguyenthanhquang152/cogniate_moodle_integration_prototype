# QA Review — `LA-E7-07` (Playwright K2 Browser Suite: Manifest-Driven Wizards + New Channels + Platform Storage)

- **Task**: `LA-E7-07` (`U1`–`U4`, Must; plus Slot 6 `R2-sim` runner glue for `LA-E7-09`)
- **Round**: `1` (Host-only test-first authoring; live Docker stack execution deferred to Slot 6)
- **SHA**: `8c65424` (`main` after `LA-E3-02`, `LA-E2-05`, `LA-E1-11`, `LA-E6-02`)
- **Reviewer**: `QA-E2E` (`term_80640d06-310f-4eac-bc95-872fd936d43c`)
- **Verdict**: `PENDING (Docker window — host-only K2 suite authored and verified: 7/7 coverage selftests, 0 TS errors, 12 K2 + 2 R2-sim cases listed)`
- **Evidence Dir**: `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-07/r1/`
- **Host Run Time**: `4.61 s` (`node tests/e2e/ltiaas/run-k2.mjs --harness-only`; `coverage.selftest.mjs` `< 1 s`)

---

## 1. Suite Files Authored (`tests/e2e/ltiaas/**`)

| Path | Role |
|---|---|
| `tests/e2e/ltiaas/playwright.config.ts` | Dedicated Playwright config (`testDir: '.'`, `testMatch: ['**/*.k2.ts']`, `workers: 1`, `fullyParallel: false`). Keeps `tests/e2e/playwright.config.ts` (`T7`: `0-start`..`9-end`) and `tests/e2e/M2/playwright.config.ts` (`M2`: `01-cards`..`06-grade-table`) completely untouched. |
| `tests/e2e/ltiaas/playwright.r2-sim.config.ts` | Dedicated Playwright config (`testMatch: ['r2-moodle-sim.spec.ts']`, `workers: 1`) for `LA-E7-09` Slot 6 `R2-sim` (`moodle-sim` at `https://moodle.sim.test`). |
| `tests/e2e/ltiaas/manifest.json` | Machine-readable manifest mapping all 12 K2 browser cases (`U1.card-order` .. `U4.platform-storage.negative`) to `AC-LA-E7-07-01`..`05` and the linked product ACs (`AC-LA-E1-11-04`, `AC-LA-E1-11-05`, `AC-LA-E2-05-03`, `AC-LA-E3-02-08`, `AC-LA-E3-02-09`). |
| `tests/e2e/ltiaas/coverage.mjs` | Verifies 1-to-1 `{case:<id>}` pairing between `manifest.json` and `*.k2.ts` files, required `U1.`/`U2.`/`U3.`/`U4.` prefixes, required AC coverage, and live `@cogniate/channel-kernel` registry alignment (`moodle`, `canvas`, `blackboard`, `lti-generic`, `brightspace`). |
| `tests/e2e/ltiaas/coverage.selftest.mjs` | 7 host-only selftests exercising `verifyK2Coverage()` and `verifyChannelKernelManifests()` (positive + 6 negative mutation checks). |
| `tests/e2e/ltiaas/lib/k2.ts` | Shared helpers: `loadProductChannelRegistry()` (via `@cogniate/channel-kernel`), simulator constants (`MOODLE_SIM`, `GENERIC_SIM`, `BRIGHTSPACE_SIM`, `CANVAS_CLOUD_SIM`), `createSimScenario()`, `issueOperatorGrantCli()`, `publishCourseViaDialog()`, `performTeacherDeepLinkPick()`, `performLearnerCompletion()`, `assertPortalResultsSent()`, and `installStateCookieStripper()`. |
| `tests/e2e/ltiaas/01-u1-cards.k2.ts` | `U1`: Data-driven Integrations hub card assertions across all registered channel manifests (`card.order`, `card.title`, `card.description`, `card.mark`, and `/integrations/:channelId/connect` routing). |
| `tests/e2e/ltiaas/02-u2-wizards.k2.ts` | `U2`: Data-driven wizard assertions across all 5 channels: Step 1 (`setup.createFields`, method radios, Site URL Rule 1), Step 2 (`registrationUrl` copy on dynamic, `developer-key-json` buttons only when declared in `setup.artifacts`, exact 16/14/9 `tool-configuration` rows with `[data-key]` and Copy buttons), Step 3 (`setup.bindingFields`, `FieldSpec.default` pre-fills, `Approval code` gating on `operatorGrant`), and `texts.adminSteps` rendering with zero raw `{LMS}`/`{tool}` placeholders. |
| `tests/e2e/ltiaas/03-u3-new-channels-flow.k2.ts` | `U3`: End-to-end browser journeys for `lti-generic` (Dynamic Registration same-host `self`, Dynamic Registration foreign token host staged + `--accept-staged --confirm-foreign-hosts`, and Manual Registration with `GRANT_MISMATCH` check + Deep Linking picker Cancel + multi-select checkboxes + learner score sync) and `brightspace` (Manual Registration with 9 D2L tool rows, 5 D2L defaults, foreign token host `auth.brightspace.sim.test`, custom `tokenAudience` `https://api.brightspace.sim.test/auth/token`, UUID deployment ID, Deep Linking, and learner score sync). |
| `tests/e2e/ltiaas/04-u4-platform-storage.k2.ts` | `U4`: Framed Canvas Cloud launch (`https://school-a.canvas.sim.test/__frame?url=...`) with `__Host-lti_state_*` stripped on `POST /lti/launch/cogniate`. Positive case verifies `lti.put_data` (`cog_state_<d>`) and `lti.get_data` on `https://sso.canvas.sim.test`, `POST /lti/launch/cogniate/storage-check` (`303`), and player frame launch. Negative case verifies wrong-origin and wrong-`message_id` `lti.get_data.response` messages are ignored and `[data-error-code="STATE_COOKIE_MISSING"]` renders after 1.5 s. |
| `tests/e2e/ltiaas/r2-moodle-sim.spec.ts` | Slot 6 `R2-sim` suite on `moodle-sim` (`https://moodle.sim.test`) covering manual connect, `.mbz` export, Deep Linking without window hint, HTML learner grade sync, `409` conflict, `503` failure + `Resend` recovery, and Check 14 family guard refusal (`PROVIDER_PROFILE_MISMATCH`). |
| `tests/e2e/ltiaas/run-k2.mjs` | Runner supporting `--harness-only` (host-only coverage selftests, TypeScript typecheck, Playwright `--list` for K2, R2-sim, M2, and T7) and full Docker Slot 6 runs (`--suite k2` on `qa-e2e-la-sim-r2` and `--suite r2-sim` on `qa-e2e-la-sim-r1`). |

---

## 2. Acceptance Criteria Matrix (Round 1 — Host-Only Test-First)

| AC ID | Case ID(s) | Requirement Summary | Host-Only Check | Live SIM Verdict |
|---|---|---|---|---|
| `AC-LA-E7-07-01` (`LA-E3-02`, `AC-LA-E3-02-08`) | `U1.card-order`, `U1.card-copy-and-action` | `U1` iterates over `loadProductChannelRegistry(true).channels()` sorted by `card.order`, checks `GET /app-api/lms-providers` order, and verifies every card's `title`, `description`, `mark`, and `/integrations/:channelId/connect` route. | `PASS` (verified against live `@cogniate/channel-kernel` 5-channel registry) | `pending: Docker window` |
| `AC-LA-E7-07-02` (`LA-E3-02`, `AC-LA-E3-02-09`) | `U2.step1-create-fields`, `U2.step2-artifacts-and-tool-rows`, `U2.step3-binding-fields-and-defaults`, `U2.admin-steps-texts` | `U2` checks Step 1 `createFields` + method radios, Step 2 `registrationUrl` + `developer-key-json` gating + 16/14/9 `tool-configuration` rows (`[data-key]`, Copy button), Step 3 `bindingFields` + `FieldSpec.default` pre-fills + `Approval code` gating, and `texts.adminSteps` with `{LMS}`/`{tool}` substituted. | `PASS` (verified against `@cogniate/channel-kernel` manifests + `tsc --noEmit`) | `pending: Docker window` |
| `AC-LA-E7-07-03` (`LA-E1-11`, `AC-LA-E1-11-04`, `AC-LA-E1-11-05`) | `U3.lti-generic.dynamic-self`, `U3.lti-generic.dynamic-staged-foreign-host`, `U3.lti-generic.manual-grant`, `U3.brightspace.manual-flow` | `U3` exercises `lti-generic` (Dynamic `self`, Dynamic foreign token host staged + `--accept-staged --confirm-foreign-hosts`, Manual with `GRANT_MISMATCH` + Deep Linking Cancel/multi-select + learner score 100) and `brightspace` (Manual with 9 D2L tool rows, 5 D2L defaults, foreign token host `auth.brightspace.sim.test`, custom `tokenAudience` `https://api.brightspace.sim.test/auth/token`, UUID deployment ID, Deep Linking, and learner score 100). | `PASS` (`tsc --noEmit` + Playwright `--list`) | `pending: Docker window` |
| `AC-LA-E7-07-04` (`LA-E2-05`, `AC-LA-E2-05-03`) | `U4.platform-storage.positive`, `U4.platform-storage.negative` | `U4` strips `__Host-lti_state_*` from `POST /lti/launch/cogniate` inside an iframe (`https://school-a.canvas.sim.test/__frame?url=...`) and tests both positive recovery (`lti.put_data` + `lti.get_data` on `https://sso.canvas.sim.test` -> `POST /lti/launch/cogniate/storage-check` -> player) and negative rejection (wrong origin `https://school-a.canvas.sim.test` + wrong `message_id` ignored -> `[data-error-code="STATE_COOKIE_MISSING"]` after 1.5 s). | `PASS` (`tsc --noEmit` + Playwright `--list`) | `pending: Docker window` |
| `AC-LA-E7-07-05` | All 12 K2 cases + `R2-sim` + `M2` + `T7` | K2 + R2-sim + M2 + T7 pass on the local stack (`https://moodle.sim.test`, `https://canvas.sim.test`, `https://sso.canvas.sim.test`, `https://blackboard.sim.test`, `https://generic.sim.test`, `https://brightspace.sim.test`, `https://auth.brightspace.sim.test`). | `PASS` (`run-k2.mjs --harness-only`: 12 K2 + 2 R2-sim + 26 M2 + 10 T7 specs discovered) | `pending: Docker window` |

---

## 3. Cookie-Removal Route Rule Note (`LA-E7-07.md` Design Note)

To simulate a browser that blocks third-party cookies inside a cross-site LMS iframe without disabling first-party cookies elsewhere in the test context, `installStateCookieStripper(context)` in `tests/e2e/ltiaas/lib/k2.ts` installs a Playwright route handler targeting `${urls.lti}/lti/launch/cogniate`:

1. When the iframe submits `POST https://lti.cogniate.test/lti/launch/cogniate` (after `GET/POST /lti/login/cogniate` has already set `__Host-lti_state_<d>` and sent the `lti.put_data` postMessage to `window.parent.frames["__lti_storage_frame"]` on `https://sso.canvas.sim.test`), the route handler intercepts the request.
2. If `request.method() === 'POST'` and `url.pathname === '/lti/launch/cogniate'`, the handler reads the outgoing `cookie` header, filters out every cookie pair whose name starts with `__Host-lti_state_`, and calls `route.continue({ headers })` (removing the `cookie` header entirely if no other cookies remain).
3. Because `POST /lti/launch/cogniate` arrives without `__Host-lti_state_<d>` while `id_token` + `state` are valid, `lti-service` returns `200 text/html` containing the storage recovery page instead of redirecting immediately (`303`) or failing immediately (`400`).
4. In `U4.platform-storage.positive`, the storage recovery page posts `{ subject: 'lti.get_data', key: 'cog_state_<d>', message_id }` to `window.parent.frames["__lti_storage_frame"]` with `targetOrigin = 'https://sso.canvas.sim.test'`, receives `{ subject: 'lti.get_data.response', message_id, value: '<nonce>' }` from `https://sso.canvas.sim.test`, and submits `POST /lti/launch/cogniate/storage-check` (`id_token`, `state`, `storage_nonce`), which returns `303` to `/lti/deep-link` or `/play/...`.
5. In `U4.platform-storage.negative`, a route handler on `https://sso.canvas.sim.test/__lti_storage` replaces the simulator storage frame HTML with an inert page so the genuine `https://sso.canvas.sim.test` frame does not auto-reply with the valid nonce. The test then dispatches two forged `MessageEvent('message')` events to the tool iframe:
   - Event 1: `origin: 'https://school-a.canvas.sim.test'` (wrong origin, matching `message_id`).
   - Event 2: `origin: 'https://sso.canvas.sim.test'` (matching `targetOrigin`, wrong `message_id`).
   Both are ignored (`storageCheckPosts === 0`), and after the 1.5 s timeout the recovery page renders `[data-error-code="STATE_COOKIE_MISSING"]` with the exact copy `'Your browser blocked the launch state in both cookies and platform storage. Open the activity in a new tab, or allow cookies for this site.'`.

---

## 4. Ready Commands for Docker Slot 6 (`LA-E7-09` and `LA-E7-07`)

When the coordinator grants Docker Slot 6 (`PUBLIC_PORT=9443`, `STACK_SUBNET=172.20.0.0/16`):

### 4.1 `LA-E7-09` — `R2-sim` on `moodle-sim` (`COMPOSE_PROJECT_NAME=qa-e2e-la-sim-r1`)

```sh
COURSE_FIXTURES_DIR=/Users/quangnguyen/cogniate-qa-runs/qa-multi-r1-bf09cdad-2026-10-22T12-05-24-521Z/tests/fixtures/courses \
COMPOSE_PROJECT_NAME=qa-e2e-la-sim-r1 \
PUBLIC_PORT=9443 \
STACK_SUBNET=172.20.0.0/16 \
node tests/e2e/ltiaas/run-k2.mjs --suite r2-sim
```

### 4.2 `LA-E7-09` — `R3` on `canvas-sim` + `blackboard-sim` (`M2` 26 browser cases)

```sh
COURSE_FIXTURES_DIR=/Users/quangnguyen/cogniate-qa-runs/qa-multi-r1-bf09cdad-2026-10-22T12-05-24-521Z/tests/fixtures/courses \
COMPOSE_PROJECT_NAME=qa-e2e-la-sim-r1 \
PUBLIC_PORT=9443 \
STACK_SUBNET=172.20.0.0/16 \
node tests/acceptance/M1/run-m1.mjs --suite m2
```

### 4.3 `LA-E7-07` — `K2` (`U1`–`U4`, 12 browser cases on `COMPOSE_PROJECT_NAME=qa-e2e-la-sim-r2`)

```sh
COURSE_FIXTURES_DIR=/Users/quangnguyen/cogniate-qa-runs/qa-multi-r1-bf09cdad-2026-10-22T12-05-24-521Z/tests/fixtures/courses \
COMPOSE_PROJECT_NAME=qa-e2e-la-sim-r2 \
PUBLIC_PORT=9443 \
STACK_SUBNET=172.20.0.0/16 \
node tests/e2e/ltiaas/run-k2.mjs --suite k2
```

### 4.4 `LA-E7-09` — `R1` (only if Slot 6 also brings up real Moodle `moodle.cogniate.test`)

```sh
COURSE_FIXTURES_DIR=/Users/quangnguyen/cogniate-qa-runs/qa-multi-r1-bf09cdad-2026-10-22T12-05-24-521Z/tests/fixtures/courses \
COMPOSE_PROJECT_NAME=qa-e2e-la-sim-r1 \
PUBLIC_PORT=9443 \
STACK_SUBNET=172.20.0.0/16 \
./tests/node_modules/.bin/playwright test -c tests/e2e/playwright.config.ts
```

---

## 5. Host-Only Verification Logs

- `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-07/r1/k2-harness-only.log` (`4.61 s`, exit `0`)
- `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-07/r1/k2-coverage-selftest.log` (`7/7` selftests passed)
- `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-07/r1/tests-typecheck.log` (`tsc --noEmit -p tsconfig.json`, exit `0`)
- `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-07/r1/root-lint.log` (`npm run lint`, exit `0`)
- `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-07/r1/playwright-k2-list.log` (`12 tests in 1 file`)
- `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-07/r1/playwright-r2-sim-list.log` (`2 tests in 1 file`)
