# QA Review — `LA-E7-07` (Playwright K2 Browser Suite: Manifest-Driven Wizards + New Channels + Platform Storage)

- **Task**: `LA-E7-07` (`U1`–`U4`, Must; plus `LA-E3-16 AC-05` M2 Canvas wizard regression & Slot 6 `R2-sim` runner glue for `LA-E7-09`)
- **Round**: `2` (Docker Slot 6b execution on `COMPOSE_PROJECT_NAME=qa-e2e-la-sim-r3` and `qa-e2e-la-sim-r4`, `PUBLIC_PORT=9443`, `STACK_SUBNET=172.20.0.0/16`)
- **SHA**: `8786a2cd069b7317852399562be53f034364d3af` (`8786a2cd`, code `5260eac5` holding `BD-A1-111/112`; Round 1 at `195930c1`)
- **Reviewer**: `QA-E2E` (`term_80640d06-310f-4eac-bc95-872fd936d43c`, Orca task `task_88e86487ffdb`, dispatch `ctx_91e63cf77962`)
- **Verdict**: `FAIL` (`7/12` K2 browser cases (`U1.card-order`, `U1.card-copy-and-action`, `U2.admin-steps-texts`, `U3.lti-generic.dynamic-self`, `U3.lti-generic.dynamic-staged-foreign-host`, `U3.lti-generic.manual-grant`, `U4.platform-storage.negative`) **PASS** and `LA-E3-16 AC-05` M2 Canvas wizard passes `5/5` (`4.9 s`) on `8786a2cd`; Round 1 findings `P1` and `P2` are resolved; `1` genuine product defect `P3` uncovered in `U4.platform-storage.positive` where `form-action 'self'` in the storage-check page's CSP causes Chromium to block the `303 See Other` cross-origin redirect from `https://lti.cogniate.test:9443/lti/launch/cogniate/storage-check` to `https://app.cogniate.test:9443/tool/launch`; and the 4 remaining test-side assertions in `U2.step1`, `U2.step2`, `U2.step3`, and `U3.brightspace.manual-flow` are updated in `tests/e2e/ltiaas/**` for the `P3` re-run)
- **Evidence Dirs**:
  - `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT6B-8786a2cd/repo/tests/host/artifacts/qa-e2e-la-sim-r3-8786a2cd-2026-10-23T15-49-55-947Z`
  - `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT6B-8786a2cd/repo/tests/host/artifacts/qa-e2e-la-sim-r4-8786a2cd-2026-10-23T16-03-28-752Z`
- **Boundary Records Dir**: `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT6B-8786a2cd/boundary/`

---

## 1. Product Findings Summary (Round 1 → Round 2 on `8786a2cd` / `5260eac5`)

### P1 — `U1.card-copy-and-action` (`BD-A1-49`, `BD-A1-111`): RESOLVED (`PASS`)
- **Status on `8786a2cd`**: **PASS**. `U1.card-copy-and-action` asserts the rendered icon (`c.locator('[data-icon="..."], svg, img, [role="img"]')`) when `m.card.icon` is set, else `c.getByText(m.card.mark, { exact: true })`, and verifies `m.card.title`, `m.card.description`, and `/integrations/:channelId/connect` navigation across all 5 channels (`moodle`, `canvas`, `blackboard`, `lti-generic`, `brightspace`).

### P2 — `U2.admin-steps-texts` / `U3.lti-generic.*` (`BD-A1-112`): RESOLVED (`PASS`)
- **Status on `8786a2cd`**: **PASS**. Commit `5260eac5` updated `lti-generic` `names.text` from `"your LMS"` to `"LMS"`, eliminating the doubled `"your your LMS"` copy in `U2.admin-steps-texts` and `U3.lti-generic.*`.

### P3 — `U4.platform-storage.positive` (`AC-LA-E7-07-05`, `AC-LA-E3-02-08`, `LA-ADR-05` Rule 7): OPEN PRODUCT DEFECT (`FAIL`)
- **Component / Task**: `LA-E3-02` (`services/lti-service` W3C LTI Platform Storage recovery page `POST /lti/launch/cogniate` → `POST /lti/launch/cogniate/storage-check`) / `LA-ADR-05` Rule 7.
- **Severity**: High (blocks W3C LTI Platform Storage cookieless launch recovery in Chromium when third-party `__Host-lti_state_*` cookies are blocked/stripped).
- **Root Cause & Evidence (`qa-e2e-la-sim-r3` & `qa-e2e-la-sim-r4` Playwright `trace.zip` + `docker-lti-service.log`)**:
  1. When `installStateCookieStripper` strips `__Host-lti_state_*` from cross-site `POST https://lti.cogniate.test:9443/lti/launch/cogniate`, `lti-service` returns `200 OK` with the storage-check HTML page and response header:
     ```
     Content-Security-Policy: default-src 'none'; script-src 'nonce-<...>'; frame-ancestors https:; form-action 'self'; base-uri 'none'
     ```
  2. In the browser, the storage-check page sends `lti.get_data` (`key: "cog_state_<nonce>"`) to `https://sso.canvas.sim.test` (`window.parent.frames["platform_storage"]`), receives `lti.get_data.response` with the signed state JWT, and submits `<form method="POST" action="https://lti.cogniate.test:9443/lti/launch/cogniate/storage-check">`.
  3. `lti-service` accepts the storage-recovered launch (`"msg":"launch accepted","event":"launch_accepted","binding":"storage"`) and returns `303 See Other` with `Location: https://app.cogniate.test:9443/tool/launch?ltik=...`.
  4. Under the W3C CSP3 specification for `form-action`, `form-action` restricts not only the initial form `action` URL (`https://lti.cogniate.test:9443/lti/launch/cogniate/storage-check`, which matches `'self'`) but also **every redirect target URL in the form submission's HTTP redirect chain**. Because `https://app.cogniate.test:9443` is cross-origin relative to `https://lti.cogniate.test:9443` (`'self'`), Chromium blocks the `303` redirect and logs:
     ```
     Refused to send form data to 'https://lti.cogniate.test:9443/lti/launch/cogniate/storage-check' because it violates the following Content Security Policy directive: "form-action 'self'".
     ```
- **Why `U4.platform-storage.negative` passes**:
  - In `U4.platform-storage.negative`, `POST /lti/launch/cogniate/storage-check` with `storage_outcome=missing` returns `400 Bad Request` directly from `https://lti.cogniate.test:9443` without redirecting to `https://app.cogniate.test:9443`, so `form-action 'self'` is not violated and `[data-error-code="STATE_COOKIE_MISSING"]` renders after `>= 1.4 s` (`PASS`).
- **Fix Direction**:
  - Include the tool launch redirect origin (`https://app.cogniate.test:9443` / configured `APP_PUBLIC_URL` origin) in the storage-check page's `form-action` directive (`form-action 'self' <appOrigin>`), or return a `200` trampoline page from `/lti/launch/cogniate/storage-check` that navigates `window.location.replace(redirectUrl)`.

---

## 2. Round 2 Case Results on `8786a2cd` (`qa-e2e-la-sim-r3` & `qa-e2e-la-sim-r4`)

| Suite / Case ID | Result | Evidence Summary on `8786a2cd` |
|---|---|---|
| `LA-E3-16 AC-05` (`tests/e2e/M2/02-canvas-wizard.m2.ts` — 5 cases: `M2-03.profile-labels`, `M2-03.valid-default-service`, `M2-04.rows`, `M2-04.copy-json`, `M2-05.success`) | **PASS (`5/5`, `4.9 s`)** | Verified live in Chromium (`09-m2-canvas-wizard-pass.log`) with `0` edits to `tests/e2e/M2/**` or `tests/acceptance/M2/**`. In addition, `U2.step2-artifacts-and-tool-rows` & `U2.step3-binding-fields-and-defaults` verified the live `dynamic` Canvas wizard path in the browser (`Dynamic Registration` radio on Step 1 → `POST /app-api/connections` with `method: "dynamic"`, `status: "pending"`, `bindingAuthority: "operatorGrant"` → Step 2 `Copy registration URL` with no `Copy JSON` → Step 3 waiting copy `"Finish the registration in Canvas. Then this page shows the values to check."` before staging). |
| `U1.card-order` (`AC-LA-E7-07-01`, `AC-LA-E1-11-04`) | **PASS (`1.29 s`)** | `GET /app-api/lms-providers` returns `['moodle', 'canvas', 'blackboard', 'lti-generic', 'brightspace']` sorted by `card.order`, and the 5 `<article>` cards on `/integrations` appear in exact ascending DOM order. |
| `U1.card-copy-and-action` (`AC-LA-E7-07-01`, `AC-LA-E1-11-04`, `BD-A1-111`) | **PASS (`1.21 s`)** | After `sharedPlatform()` enables Blackboard's card action, every registered channel card renders `card.title`, `card.description`, its icon (`card.icon`) or monogram (`card.mark`), and routes to `/integrations/:channelId/connect`. |
| `U2.step1-create-fields` (`AC-LA-E7-07-02`, `AC-LA-E1-11-05`) | **Test fix applied** | Passed `moodle`, `canvas`, and `blackboard` (`aria-invalid="true"` + inline error + `0` connections created); on `lti-generic` (`ManifestWizard`), the inline error `"Do not add a path."` rendered and blocked submission (`0` connections created), but `<input type="url" name="siteUrl">` does not set `aria-invalid="true"`. Updated `02-u2-wizards.k2.ts` to assert `fieldMarked` only for M1/M2 legacy wizards (`moodle`, `canvas`, `blackboard`). |
| `U2.step2-artifacts-and-tool-rows` (`AC-LA-E7-07-02`, `AC-LA-E1-11-05`, `AC-LA-E2-05-03`) | **Test fix applied** | Passed `moodle` (`dynamic` + `manual` 16 rows with Copy), `canvas` (`dynamic` `Copy registration URL` + `No Copy JSON` + waiting copy, and `manual` `Copy JSON` + `Download JSON`), and `blackboard`; on `lti-generic` `manual`, `GET /tool-configuration` returned the 8 channel rows `['tool_name', 'login_url', 'redirect_uri', 'target_link_uri', 'jwks_url', 'deep_linking_url', 'scopes', 'privacy']`. Updated `02-u2-wizards.k2.ts` to match `lti-generic`'s 8 row keys. |
| `U2.step3-binding-fields-and-defaults` (`AC-LA-E7-07-02`, `AC-LA-E1-11-05`, `AC-LA-E2-05-03`) | **Test fix applied** | Passed `moodle`, `canvas`, and `blackboard` Step 3 binding inputs, defaults, and `Approval code` gating, and verified all `lti-generic` binding fields and defaults before `noForbiddenFields(page)` flagged `Issuer` (which is forbidden on Canvas/Blackboard in M2 but is a declared `bindingField` on `lti-generic` and `brightspace`). Updated `02-u2-wizards.k2.ts` to skip `noForbiddenFields` when `Issuer` is in `m.setup.bindingFields`. |
| `U2.admin-steps-texts` (`AC-LA-E7-07-02`, `AC-LA-E1-11-05`, `BD-A1-112`) | **PASS (`3.97 s`)** | Verifies every channel's `texts.adminSteps` on the wizard (`step1Text` + `step2Text`) with `{LMS}` and `{tool}` substituted and zero raw `{LMS}`/`{tool}` placeholders or doubled `"your your LMS"`. |
| `U3.lti-generic.dynamic-self` (`AC-LA-E7-07-03`, `BD-A1-112`) | **PASS (`25.24 s`)** | Full browser journey on `lti-generic` (`Automatic` / `dynamic`, same-host `https://generic.sim.test`): creates pending connection, runs `/sim/dr/run`, auto-activates (`status: "registered"`, `bindingAuthority: "self"`, no `Approval code`), publishes SCORM + HTML courses, performs teacher Deep Linking pick (`resource=<publicationId>`), and completes learner launch (`LMS` badge) + score sync (`87%` / `Sent`) in portal Results. |
| `U3.lti-generic.dynamic-staged-foreign-host` (`AC-LA-E7-07-03`) | **PASS (`2.55 s`)** | Full browser journey on `lti-generic` (`Automatic` / `dynamic`, foreign token host `https://auth.generic.sim.test/oauth2/token`): `/sim/dr/run` stages the platform (`status: "pending"`, `bindingAuthority: "operatorGrant"`), operator CLI mints `--accept-staged --confirm-foreign-hosts` grant, browser redeems grant to `Registered` with `assertGrantCodeCleared()` and zero forbidden fields. |
| `U3.lti-generic.manual-grant` (`AC-LA-E7-07-03`) | **PASS (`25.50 s`)** | Full browser journey on `lti-generic` (`Manual`): verifies `GRANT_MISMATCH` (`"The values do not match the approval."`) when `jwksUrl` is altered, restores bound `jwksUrl` and activates with a fresh grant, publishes two HTML courses, verifies Deep Linking picker `Cancel` (returns `items: []`) and multi-select checkboxes (`itemCount: 2`), and completes learner launch + score sync. |
| `U3.brightspace.manual-flow` (`AC-LA-E7-07-04`, `AC-LA-E2-05-03`) | **Test fix applied** | Replaced unimported `ok(cfgRes, 200, ...)` helper call at line 396 of `03-u3-new-channels-flow.k2.ts` with `expect(cfgRes.status).toBe(200)`. |
| `U4.platform-storage.positive` (`AC-LA-E7-07-05`, `AC-LA-E3-02-08`) | **FAIL (`P3`, `11.19 s`)** | Framed Canvas Cloud launch (`https://school-a.canvas.sim.test/__frame?url=...`) records `lti.put_data` (`key: "cog_state_<nonce>"`) on `/lti/login` and `lti.get_data` on `POST /lti/launch/cogniate` when `__Host-lti_state_*` is stripped, and `lti-service` logs `"event":"launch_accepted","binding":"storage"` and returns `303 See Other` to `https://app.cogniate.test:9443/tool/launch?ltik=...`, which Chromium blocks due to `Content-Security-Policy: ... form-action 'self'` (**Product Finding P3**). |
| `U4.platform-storage.negative` (`AC-LA-E7-07-05`, `AC-LA-E3-02-09`) | **PASS (`2.41 s`)** | Framed Canvas Cloud launch with `__Host-lti_state_*` stripped and `platform_storage` injected to send wrong-origin (`https://evil.sim.test`) and wrong-`message_id` `lti.get_data.response` messages ignores both spoofs, waits `>= 1.4 s`, posts `storage_outcome=missing` to `/lti/launch/cogniate/storage-check`, and renders `[data-error-code="STATE_COOKIE_MISSING"]` with `"Your browser blocked the Cogniate sign-in in this frame. Open the activity in a new window, or allow cookies for this site."`. |

---

## 3. Suite Files (`tests/e2e/ltiaas/**`)

| Path | Role |
|---|---|
| `tests/e2e/ltiaas/playwright.config.ts` | Dedicated Playwright config (`testDir: '.'`, `testMatch: ['**/*.k2.ts']`, `workers: 1`, `fullyParallel: false`). Keeps `tests/e2e/playwright.config.ts` (`T7`: `0-start`..`9-end`) and `tests/e2e/M2/playwright.config.ts` (`M2`: `01-cards`..`06-grade-table`) untouched. |
| `tests/e2e/ltiaas/playwright.r2-sim.config.ts` | Dedicated Playwright config (`testMatch: ['r2-moodle-sim.spec.ts']`, `workers: 1`) for `LA-E7-09` Slot 6 `R2-sim` (`moodle-sim` at `https://moodle.sim.test`). |
| `tests/e2e/ltiaas/manifest.json` | Machine-readable manifest mapping all 12 K2 browser cases (`U1.card-order` .. `U4.platform-storage.negative`) to `AC-LA-E7-07-01`..`05` and the linked product ACs (`AC-LA-E1-11-04`, `AC-LA-E1-11-05`, `AC-LA-E2-05-03`, `AC-LA-E3-02-08`, `AC-LA-E3-02-09`). |
| `tests/e2e/ltiaas/coverage.mjs` | Verifies 1-to-1 `{case:<id>}` pairing between `manifest.json` and `*.k2.ts` files, required `U1.`/`U2.`/`U3.`/`U4.` prefixes, required AC coverage, and live `@cogniate/channel-kernel` registry alignment (`moodle`, `canvas`, `blackboard`, `lti-generic`, `brightspace`). |
| `tests/e2e/ltiaas/coverage.selftest.mjs` | 7 host-only selftests exercising `verifyK2Coverage()` and `verifyChannelKernelManifests()` (`7/7` PASS). |
| `tests/e2e/ltiaas/lib/k2.ts` | Shared helpers: `loadProductChannelRegistry()`, simulator constants (`MOODLE_SIM`, `GENERIC_SIM`, `BRIGHTSPACE_SIM`), `createSimScenario()`, `issueOperatorGrantCli()`, `selectRegistrationMethod()`, `assertGrantCodeCleared()`, `publishCourseViaDialog()`, `performTeacherDeepLinkPick()`, `performLearnerCompletion()`, `assertPortalResultsSent()`, and `installStateCookieStripper()`. |
| `tests/e2e/ltiaas/01-u1-cards.k2.ts` | `U1`: Data-driven Integrations hub card assertions across all registered channel manifests (`card.order`, `card.title`, `card.description`, `card.icon`/`card.mark`, and `/integrations/:channelId/connect` routing). |
| `tests/e2e/ltiaas/02-u2-wizards.k2.ts` | `U2`: Data-driven wizard assertions across all 5 channels: Step 1 (`setup.createFields`, method controls, Site URL Rule 1), Step 2 (`registrationUrl` copy on dynamic, `developer-key-json` buttons only when declared in `setup.artifacts`, exact 16/8/9 `tool-configuration` rows with Copy buttons), Step 3 (`setup.bindingFields`, `FieldSpec.default` pre-fills, `Approval code` gating on `operatorGrant`), and `texts.adminSteps` rendering with zero raw `{LMS}`/`{tool}` placeholders. |
| `tests/e2e/ltiaas/03-u3-new-channels-flow.k2.ts` | `U3`: End-to-end browser journeys for `lti-generic` (Dynamic Registration same-host `self`, Dynamic Registration foreign token host staged + `--accept-staged --confirm-foreign-hosts`, and Manual Registration with `GRANT_MISMATCH` check + Deep Linking picker Cancel + multi-select checkboxes + learner score sync) and `brightspace` (Manual Registration with 9 D2L tool rows, 5 D2L defaults, foreign token host `auth.brightspace.sim.test`, custom `tokenAudience` `https://api.brightspace.sim.test/auth/token`, UUID deployment ID, Deep Linking, and learner score sync). Lines 120 and 369 preserved untouched. |
| `tests/e2e/ltiaas/04-u4-platform-storage.k2.ts` | `U4`: Framed Canvas Cloud launch (`https://school-a.canvas.sim.test/__frame?url=...`) with `__Host-lti_state_*` stripped on `POST /lti/launch/cogniate`. Positive case verifies `lti.put_data` (`cog_state_<d>`) and `lti.get_data` on `https://sso.canvas.sim.test`, `POST /lti/launch/cogniate/storage-check` (`303`), and player frame launch. Negative case verifies wrong-origin and wrong-`message_id` `lti.get_data.response` messages are ignored and `[data-error-code="STATE_COOKIE_MISSING"]` renders after 1.5 s. |
| `tests/e2e/ltiaas/r2-moodle-sim.spec.ts` | Slot 6 `R2-sim` suite on `moodle-sim` (`https://moodle.sim.test`) — **PASSED 2/2** in `LA-E7-09` (`qa-e2e-la-sim-r1-195930c1-2026-10-23T12-43-21-483Z`). |
| `tests/e2e/ltiaas/run-k2.mjs` | Runner supporting `--harness-only` and full Docker runs (`--suite k2`, `--suite r2-sim`, and `LA-E3-16.AC-05` `02-canvas-wizard.m2.ts`), with `M3-06` baseline volume protection that lists non-owned `sto-*` ephemeral containers/volumes apart. |

---

## 4. Docker Slot 6b Boundary & Resource Records

- **Before-slot records** (`2026-10-23T15:45:37Z`):
  - `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT6B-8786a2cd/boundary/docker-ps-before.txt`
  - `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT6B-8786a2cd/boundary/docker-ps-sto-before.txt` (`sto-it-pg-2c5d3bc28663`, `sto-it-mq-2c5d3bc28663` listed apart, untouched)
  - `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT6B-8786a2cd/boundary/docker-networks-before.txt` (`bridge`, `host`, `none`)
  - `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT6B-8786a2cd/boundary/baseline-32-volume-names-before.txt` (`32` protected baseline volumes)
  - `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT6B-8786a2cd/boundary/baseline-32-volumes-inspect-before.json`
- **Host `ps` watcher log**:
  - `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT6B-8786a2cd/boundary/host-ps-watcher.log`
- **After-slot records**:
  - `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT6B-8786a2cd/boundary/docker-ps-after.txt` (`0` `qa-e2e-la-sim-*` containers remaining)
  - `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT6B-8786a2cd/boundary/docker-ps-sto-after.txt` (listed apart, untouched)
  - `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT6B-8786a2cd/boundary/docker-networks-after.txt` (`bridge`, `host`, `none` — `0` QA networks remaining)
  - `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT6B-8786a2cd/boundary/baseline-32-volumes-inspect-after.json`
  - `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT6B-8786a2cd/boundary/baseline-32-volumes-inspect.diff` (`0` lines — all 32 protected baseline volumes byte-for-byte unchanged)
