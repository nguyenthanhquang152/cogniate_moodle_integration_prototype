# QA Review — `LA-E7-07` (Playwright K2 Browser Suite: Manifest-Driven Wizards + New Channels + Platform Storage)

- **Task**: `LA-E7-07` (`U1`–`U4`, Must; plus Slot 6 `R2-sim` runner glue for `LA-E7-09`)
- **Round**: `1` (Docker Slot 6 execution on `COMPOSE_PROJECT_NAME=qa-e2e-la-sim-r2`, `PUBLIC_PORT=9443`, `STACK_SUBNET=172.20.0.0/16`)
- **SHA**: `195930c1b56c7b78bfaa7776cbeec6da40cf4f87` (`195930c1`)
- **Reviewer**: `QA-E2E` (`term_80640d06-310f-4eac-bc95-872fd936d43c`)
- **Verdict**: `FAIL` (Round 1 live browser run on `195930c1` uncovered 2 product copy/card-manifest discrepancies (`P1`, `P2`) and 4 first-contact DOM/Playwright cookie-jar selector mismatches; all test-side selector/cookie-stripper updates are applied and verified in `tests/e2e/ltiaas/**` for Round 2, while `LA-E7-09` `R2-sim` passed `2/2` on `qa-e2e-la-sim-r1`)
- **Evidence Dir**: `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT6-195930c1/repo/tests/host/artifacts/qa-e2e-la-sim-r2-195930c1-2026-10-23T12-46-34-171Z`
- **Boundary Records Dir**: `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT6-195930c1/boundary/`
- **Run Time**: `257.74 s` full stack lifecycle (`177.41 s` Playwright container run) on `qa-e2e-la-sim-r2`; `4.61 s` host-only harness verification

---

## 1. Intended Product Changes Between `8c65424` and `195930c1` Recorded in K2

Per the Slot 6 brief, the following intended product changes between `8c65424` and `195930c1` were verified and recorded in `tests/e2e/ltiaas/**`:

| Task / Interface Change ID | Change Summary (`8c65424` → `195930c1`) | K2 Test / Selftest Update Applied |
|---|---|---|
| `LA-E2-06` | `brightspace.manifest.json` `registration` changed from `[{ method: 'manual', authority: 'operatorGrant' }]` to `[{ method: 'dynamic', authority: 'self' }, { method: 'manual', authority: 'operatorGrant' }]` (Brightspace Dynamic Registration added alongside Manual Registration). | Updated `tests/e2e/ltiaas/coverage.selftest.mjs` (`brightspace.registration.map((r) => r.method)` → `['dynamic', 'manual']`) and `03-u3-new-channels-flow.k2.ts` (`U3.brightspace.manual-flow` explicitly selects `'manual'` on Step 1). |
| `LA-E3-15` / `LA-E3-16` (`LA-IC-14`) | `canvas.manifest.json` `registration` changed from `[{ method: 'manual', authority: 'operatorGrant' }]` to `[{ method: 'manual', authority: 'operatorGrant' }, { method: 'dynamic', authority: 'operatorGrant' }]` (Canvas LTI Advantage Dynamic Registration under `operatorGrant`, with Step 1 radio labels `"Developer key"` for `manual` and `"Dynamic Registration"` for `dynamic`). | Updated `02-u2-wizards.k2.ts` (`U2.step2-artifacts-and-tool-rows` asserts `expect(dto.bindingAuthority).toBe(dynEntry.authority)` instead of hardcoding `'self'`, and `selectRegistrationMethod()` in `lib/k2.ts` matches `/^(Manual|Developer key)/i` and `/^(Automatic|Dynamic(\s+Registration)?)/i`). |
| `LA-E1-11` / `LA-E2-05` (`'channel'` tool-configuration rows) | `lti-generic` (`STANDARD_14_TOOL_ROW_KEYS`, 14 rows) and `brightspace` (`D2L_9_TOOL_ROW_KEYS`, 9 rows) expose `'channel'` artifact `tool-configuration` rows (`[data-key]` + Copy buttons). | Verified in `02-u2-wizards.k2.ts` (`U2.step2-artifacts-and-tool-rows`) and `03-u3-new-channels-flow.k2.ts` (`U3.brightspace.manual-flow` lines 387–389). |

---

## 2. Product Findings Uncovered on `195930c1` (`qa-e2e-la-sim-r2`)

### P1 — `U1.card-copy-and-action` (`AC-LA-E7-07-01`, `AC-LA-E1-11-04`): Moodle card on `/integrations` does not render `moodle.manifest.card.description` or `moodle.manifest.card.mark`
- **Severity**: Medium (`AC-LA-E1-11-04` / `AC-LA-E7-07-01` manifest-driven card rendering)
- **Observed on `195930c1`** (`error-context.md` for `U1.card-copy-and-action`):
  - On `/integrations` (`tabpanel "LMS Publishing"`), the 4 newer channel cards (`Canvas`, `Blackboard`, `LTI 1.3`, `D2L Brightspace`) render their exact `manifest.card.title`, `manifest.card.description`, and `manifest.card.mark` (`Cv`, `Bb`, `LTI`, `D2L`).
  - However, the `Moodle` card (`article "Moodle"`) still renders legacy hardcoded copy `"Export SCORM packages and sync course content with your Moodle LMS."` and an `<svg>` (`img`) icon instead of `moodle.manifest.card.description` (`"Publish Cogniate courses to Moodle with LTI 1.3."`) and `moodle.manifest.card.mark` (`"m"`).

### P2 — `U2.admin-steps-texts` / `U3.lti-generic.*` (`AC-LA-E1-11-05`): `lti-generic` wizard renders doubled `"your your LMS"` when substituting `{LMS}`
- **Severity**: Low (UI copy / STE polish)
- **Observed on `195930c1`** (`error-context.md` for `/integrations/lti-generic/connect`):
  - Because `lti-generic.manifest.json` defines `names.text: "your LMS"`, templates containing `"your {LMS}"` render with a duplicated `"your"`:
    - Header subtitle: `"Bring your course library to your your LMS site."`
    - Step 4 in `Tool settings`: `"Ask your Cogniate operator for an approval code. The operator checks the values with your your LMS administrator first. The code works once and expires."`

---

## 3. Round 1 Case Results & Test-Harness Updates Prepared for Round 2

In Round 1 (`qa-e2e-la-sim-r2-195930c1-2026-10-23T12-46-34-171Z`), the stack brought up all 9 services (`cogniate-app`, `lms-sim`, `lti-gate`, `lti-service`, `moodle`, `postgres`, `proxy`, `qa-platform`, `sink`), seeded cleanly, and ran all 12 K2 Playwright browser cases before tearing down cleanly (`0` leftover containers, volumes, or networks).

Because the Docker Slot 6 window (`12:07Z–13:05Z`) permitted only the two scheduled stack runs (`qa-e2e-la-sim-r1` for `LA-E7-09` and `qa-e2e-la-sim-r2` for `LA-E7-07`) and explicitly instructed *"if time is short, finish the running suite and stop rather than starting a third stack"*, the 4 first-contact DOM/Playwright harness issues below were fixed in `tests/e2e/ltiaas/**` and verified with `coverage.selftest.mjs` (`7/7`) and `tsc --noEmit` (`0` errors) ready for Round 2:

| Case ID | Round 1 Duration | Round 1 Result & Root Cause on `195930c1` | Fix Applied in `tests/e2e/ltiaas/**` for Round 2 |
|---|---|---|---|
| `U1.card-order` | `1.85 s` | `GET /app-api/lms-providers` returned the exact 5-channel order `['moodle', 'canvas', 'blackboard', 'lti-generic', 'brightspace']`, and all 5 `<article>` cards rendered in order in the DOM (`error-context.md` lines 82–115). The DOM index check failed (`Expected > 134, Received 134`) because `card(page, "LTI 1.3")` used `.filter({ hasText: "LTI 1.3" }).last()`, which matched `article "D2L Brightspace"` whose description ends with `"with LTI 1.3."`. | Updated `01-u1-cards.k2.ts` to locate each card via `page.getByRole('article', { name: m.card.title, exact: true })`. |
| `U1.card-copy-and-action` | `16.24 s` | Failed on `moodle` card (`getByText('m', { exact: true })` and `m.card.description` mismatch — see **Product Finding P1**). | Updated card locator in `01-u1-cards.k2.ts`; kept manifest `card.description` / `card.mark` assertion per `AC-LA-E7-07-01`. |
| `U2.step1-create-fields` | `16.29 s` | Step 1 of `moodle` rendered `Connection name`, `Moodle site URL`, registration radios, and refused `https://moodle.sim.test/not-an-origin` with `"Use an HTTPS site origin, for example https://moodle.test. Do not add a path."` instead of Canvas's `ERR.rule[1]` (`"Enter only the address, for example https://school.instructure.com. No path."`). Also `lti-generic` and `brightspace` render `Connection method` as a `<select>` (`combobox "Connection method"`) rather than radio inputs. | Updated `02-u2-wizards.k2.ts` to accept both `combobox "Connection method"` and registration method radios (`Automatic`/`Dynamic Registration` vs `Manual`/`Developer key`), and match each channel's origin/no-path validation message. |
| `U2.step2-artifacts-and-tool-rows` | `16.80 s` | Passed `moodle` (`dynamic` + `manual` 16 rows) and `canvas` (`dynamic`), then timed out on `canvas` `manual` Step 1 because the Canvas manual radio is labeled `"Developer key Paste the developer key JSON into Canvas..."` (`LA-E3-16`) rather than `"Manual"`. | Added `selectRegistrationMethod(page, method)` in `lib/k2.ts` handling `combobox "Connection method"` (`Automatic`/`Manual`) and radios (`/^(Manual|Developer key)/i`, `/^(Automatic|Dynamic(\s+Registration)?)/i`). |
| `U2.step3-binding-fields-and-defaults` | `16.13 s` | Passed `moodle` Step 3 binding fields, then timed out on `canvas` `manual` Step 1 radio (`"Developer key"` vs `"Manual"`). | Fixed via `selectRegistrationMethod(page, method)` in `lib/k2.ts` and `02-u2-wizards.k2.ts`. |
| `U2.admin-steps-texts` | `0.89 s` | Navigated to `/integrations/moodle/con_...` and read `body.innerText()` while the page still showed `"Loading…"` (before the connection detail query resolved). In `error-context.md` (captured right after failure), all 6 Moodle `adminSteps` (`"In Moodle, open Manage tools."`, etc.) were rendered with `{LMS}` and `{tool}` substituted. | Added `await expect(page.getByText('Loading…')).toHaveCount(0, { timeout: 15_000 })` in `createPendingViaWizard` (`02-u2-wizards.k2.ts`). |
| `U3.lti-generic.dynamic-self` | `15.74 s` | Timed out on `/integrations/lti-generic/connect` waiting for `getByRole('radio', { name: /^(Automatic|Dynamic)/i })` because `lti-generic` renders `combobox "Connection method"` (`<select>`) with options `"Automatic"` and `"Manual"`. | Updated `03-u3-new-channels-flow.k2.ts` to use `selectRegistrationMethod(page, 'dynamic')` and click `Get registration URL` if present before `Copy Registration URL`. |
| `U3.lti-generic.dynamic-staged-foreign-host` | `15.61 s` | Same Step 1 `combobox "Connection method"` vs `radio` selector mismatch on `/integrations/lti-generic/connect`. | Updated `03-u3-new-channels-flow.k2.ts` to use `selectRegistrationMethod(page, 'dynamic')`. |
| `U3.lti-generic.manual-grant` | `15.60 s` | Same Step 1 `combobox "Connection method"` vs `radio` selector mismatch on `/integrations/lti-generic/connect`. | Updated `03-u3-new-channels-flow.k2.ts` to use `selectRegistrationMethod(page, 'manual')`. |
| `U3.brightspace.manual-flow` | `16.30 s` | On `/integrations/brightspace/connect`, `Connection method` is a `combobox` (`<select>`) defaulted to `"Automatic"` (`dynamic`). Because the test checked `if (await manualRadio.count() > 0)` (which was `0`), the connection was created as `dynamic` instead of `manual`. Even so, the manage page rendered all 9 `D2L_9_TOOL_ROW_KEYS` (`Name`, `Domain`, `Redirect URLs`, `OpenID Connect Login URL`, `Target Link URI`, `Keyset URL`, `Extensions`, `Roles`, `Privacy`) and passed lines 387–389 before failing on `Issuer` input (only rendered for `manual`). | Updated `03-u3-new-channels-flow.k2.ts` to call `await selectRegistrationMethod(page, 'manual')` on `/integrations/brightspace/connect`. |
| `U4.platform-storage.positive` | `2.18 s` | Framed Canvas Cloud launch (`https://school-a.canvas.sim.test/__frame?url=...`) launched into `/play/ply_RKtuis0SLZHjxx5tJ9Wkuw/embedded` and rendered `"Open in a new window"`, but `strippedUrls.length` was `0` because Playwright's synchronous `request.headers()` inside `context.route(...)` did not include Chromium's CookieStore `Cookie` header on cross-site iframe `POST /lti/launch/cogniate`. | Updated `installStateCookieStripper(context)` in `lib/k2.ts` to inspect `await context.cookies(ltiOrigin)` + `await request.allHeaders()`, record `__Host-lti_state_*` cookie names, and call `await context.clearCookies({ name: /^__Host-lti_state_/ })` before `route.continue()`. |
| `U4.platform-storage.negative` | `31.68 s` | Same root cause as `U4.platform-storage.positive`: because `request.headers().cookie` was empty in the route callback, Chromium still attached `__Host-lti_state_*` from its cookie jar on `POST /lti/launch/cogniate`, so the launch bypassed the storage recovery page and opened `/play/ply_g0mf5So04EOJ2polorUy9Q/embedded`. | Fixed in `installStateCookieStripper(context)` in `lib/k2.ts` via `await context.clearCookies({ name: /^__Host-lti_state_/ })`. |

---

## 4. Suite Files (`tests/e2e/ltiaas/**`)

| Path | Role |
|---|---|
| `tests/e2e/ltiaas/playwright.config.ts` | Dedicated Playwright config (`testDir: '.'`, `testMatch: ['**/*.k2.ts']`, `workers: 1`, `fullyParallel: false`). Keeps `tests/e2e/playwright.config.ts` (`T7`: `0-start`..`9-end`) and `tests/e2e/M2/playwright.config.ts` (`M2`: `01-cards`..`06-grade-table`) untouched. |
| `tests/e2e/ltiaas/playwright.r2-sim.config.ts` | Dedicated Playwright config (`testMatch: ['r2-moodle-sim.spec.ts']`, `workers: 1`) for `LA-E7-09` Slot 6 `R2-sim` (`moodle-sim` at `https://moodle.sim.test`). |
| `tests/e2e/ltiaas/manifest.json` | Machine-readable manifest mapping all 12 K2 browser cases (`U1.card-order` .. `U4.platform-storage.negative`) to `AC-LA-E7-07-01`..`05` and the linked product ACs (`AC-LA-E1-11-04`, `AC-LA-E1-11-05`, `AC-LA-E2-05-03`, `AC-LA-E3-02-08`, `AC-LA-E3-02-09`). |
| `tests/e2e/ltiaas/coverage.mjs` | Verifies 1-to-1 `{case:<id>}` pairing between `manifest.json` and `*.k2.ts` files, required `U1.`/`U2.`/`U3.`/`U4.` prefixes, required AC coverage, and live `@cogniate/channel-kernel` registry alignment (`moodle`, `canvas`, `blackboard`, `lti-generic`, `brightspace`). |
| `tests/e2e/ltiaas/coverage.selftest.mjs` | 7 host-only selftests exercising `verifyK2Coverage()` and `verifyChannelKernelManifests()` (positive + 6 negative mutation checks, updated for `LA-E2-06` `brightspace` `['dynamic', 'manual']`). |
| `tests/e2e/ltiaas/lib/k2.ts` | Shared helpers: `loadProductChannelRegistry()`, simulator constants (`MOODLE_SIM`, `GENERIC_SIM`, `BRIGHTSPACE_SIM`), `createSimScenario()`, `issueOperatorGrantCli()`, `selectRegistrationMethod()`, `publishCourseViaDialog()`, `performTeacherDeepLinkPick()`, `performLearnerCompletion()`, `assertPortalResultsSent()`, and `installStateCookieStripper()`. |
| `tests/e2e/ltiaas/01-u1-cards.k2.ts` | `U1`: Data-driven Integrations hub card assertions across all registered channel manifests (`card.order`, `card.title`, `card.description`, `card.mark`, and `/integrations/:channelId/connect` routing). |
| `tests/e2e/ltiaas/02-u2-wizards.k2.ts` | `U2`: Data-driven wizard assertions across all 5 channels: Step 1 (`setup.createFields`, method controls, Site URL Rule 1), Step 2 (`registrationUrl` copy on dynamic, `developer-key-json` buttons only when declared in `setup.artifacts`, exact 16/14/9 `tool-configuration` rows with `[data-key]` and Copy buttons), Step 3 (`setup.bindingFields`, `FieldSpec.default` pre-fills, `Approval code` gating on `operatorGrant`), and `texts.adminSteps` rendering with zero raw `{LMS}`/`{tool}` placeholders. |
| `tests/e2e/ltiaas/03-u3-new-channels-flow.k2.ts` | `U3`: End-to-end browser journeys for `lti-generic` (Dynamic Registration same-host `self`, Dynamic Registration foreign token host staged + `--accept-staged --confirm-foreign-hosts`, and Manual Registration with `GRANT_MISMATCH` check + Deep Linking picker Cancel + multi-select checkboxes + learner score sync) and `brightspace` (Manual Registration with 9 D2L tool rows, 5 D2L defaults, foreign token host `auth.brightspace.sim.test`, custom `tokenAudience` `https://api.brightspace.sim.test/auth/token`, UUID deployment ID, Deep Linking, and learner score sync). |
| `tests/e2e/ltiaas/04-u4-platform-storage.k2.ts` | `U4`: Framed Canvas Cloud launch (`https://school-a.canvas.sim.test/__frame?url=...`) with `__Host-lti_state_*` stripped on `POST /lti/launch/cogniate`. Positive case verifies `lti.put_data` (`cog_state_<d>`) and `lti.get_data` on `https://sso.canvas.sim.test`, `POST /lti/launch/cogniate/storage-check` (`303`), and player frame launch. Negative case verifies wrong-origin and wrong-`message_id` `lti.get_data.response` messages are ignored and `[data-error-code="STATE_COOKIE_MISSING"]` renders after 1.5 s. |
| `tests/e2e/ltiaas/r2-moodle-sim.spec.ts` | Slot 6 `R2-sim` suite on `moodle-sim` (`https://moodle.sim.test`) — **PASSED 2/2** in `LA-E7-09` (`qa-e2e-la-sim-r1-195930c1-2026-10-23T12-43-21-483Z`). |
| `tests/e2e/ltiaas/run-k2.mjs` | Runner supporting `--harness-only` and full Docker runs (`--suite k2` on `qa-e2e-la-sim-r2` and `--suite r2-sim` on `qa-e2e-la-sim-r1`), with `M3-06` baseline volume protection that lists non-owned `sto-*` ephemeral containers/volumes apart. |

---

## 5. Docker Slot 6 Boundary & Resource Records

- **Before-slot records** (`2026-10-23T12:13:04Z`):
  - `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT6-195930c1/boundary/docker-ps-before.txt`
  - `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT6-195930c1/boundary/docker-ps-sto-before.txt` (`sto-it-pg-*`, `sto-it-mq-*` listed apart, untouched)
  - `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT6-195930c1/boundary/docker-networks-before.txt` (`bridge`, `host`, `none`)
  - `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT6-195930c1/boundary/baseline-32-volume-names-before.txt` (`32` protected baseline volumes)
  - `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT6-195930c1/boundary/baseline-32-volumes-inspect-before.json`
- **Host `ps` watcher log** (`12:13:33Z`–`12:52:39Z`):
  - `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT6-195930c1/boundary/host-ps-watcher.log`
- **After-slot records** (`2026-10-23T12:52:43Z`):
  - `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT6-195930c1/boundary/docker-ps-after.txt` (`0` `qa-e2e-la-sim-*` containers remaining)
  - `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT6-195930c1/boundary/docker-ps-sto-after.txt` (`sto-it-mq-c045406f1b2c`, `sto-load-22571760f3f8` untouched)
  - `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT6-195930c1/boundary/docker-networks-after.txt` (`bridge`, `host`, `none` — `0` QA networks remaining)
  - `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT6-195930c1/boundary/baseline-32-volumes-inspect-after.json`
  - `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT6-195930c1/boundary/baseline-32-volumes-inspect.diff` (`0` lines — all 32 protected baseline volumes byte-for-byte unchanged)
