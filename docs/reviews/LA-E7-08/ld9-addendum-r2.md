# LD-9 Frozen-Test Change Addendum R2 — `M1-08.canvas.login-redirect` (`WE-F6`, `LA-IC-06`)

- **Author:** QA-3 (`task_a220d02eff5c` / `ctx_81cafe6682c3`)
- **Date:** 2026-04-20
- **Rule Reference:** `docs/team/decision-log-ltiaas.md` (`LD-9`)
- **Architect-2 Classification:** `BD-A2-110` (`LA-IC-06` test-change list item; `LA-ADR-05` D1 rules 1 & 1a)
- **Wave-End Product SHA:** `8fadb828088ffe1b4db02179ab0fa3ab2388a12a` (tag `la-wave-end-product-3`)
- **Gate Test Base Tag / SHA:** `la-gate-test-3` = `e46bb27c9487d332f40fcefd4dd880304d1d31f1` (in `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-3`; parent `la-gate-test-base-c1-3` = `e00b9651`)
- **Failing Gate Evidence:** Re-Gate Slot 3C (`docs/reviews/LA-E7-08/re-gate-slot-3c-qa3.md`, Finding `WE-F6`; log `/Users/quangnguyen/cogniate-qa-runs/LA/qa3-we-slot-3c/m1-sim.log`)
- **QA Independence:** Prepared solely from `docs/architecture/ltiaas/adr/LA-ADR-04-refactor-and-migration.md`, `docs/architecture/ltiaas/adr/LA-ADR-05-lti-advantage-completeness.md`, `docs/architecture/ltiaas/contracts/lti-service-api-delta.md`, `docs/reviews/LA-E7-08/ld9-addendum-r1.md`, and frozen test files under `tests/acceptance/M1/**`. No `services/lti/**` or `services/api/**` product source files were read. Neither `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-3` nor `tests/acceptance/M1/canvas/21-canvas-protocol.test.ts` in the shared worktree was modified.

---

## 1. Item Classification & Architectural Reason

### 1.1 Item Classification
- **Integration Contract Item:** `LA-IC-06` (`LA-ADR-04` §6 — *Platform Storage and State Continuity (`LA-E3-15`)*; `LA-ADR-05` D1 — *Platform Storage JavaScript Flow*; `contracts/lti-service-api-delta.md` §2.1 — *`GET|POST /lti/login/:tenantSlug` Platform Storage Response*).
- **Affected Frozen Test:** `M1-08.canvas.login-redirect` in `tests/acceptance/M1/canvas/21-canvas-protocol.test.ts:16-35`.
- **Disposition:** Approved `LD-9` frozen-test update per Architect-2 note `BD-A2-110`. The `200 text/html` platform-storage response is the architecturally required behavior when `lti_storage_target` is sent on `/lti/login/:tenantSlug`.

### 1.2 Why `M1-08.canvas.login-redirect` Changes Under `LD-9` (`LA-IC-06` / `BD-A2-110`)
1. **Trigger in the frozen test:** `M1-08.canvas.login-redirect` calls:
   ```ts
   const started = await canvasLaunch(p, {}, { login: { lti_storage_target: 'post_message_forwarding' } });
   ```
   which sends `lti_storage_target=post_message_forwarding` on `POST /lti/login/cogniate` for the Canvas platform.
2. **Pre-LA-E3-15 assumption vs. `LA-IC-06` contract:**
   - Before `LA-E3-15` (`LA-IC-06`), `/lti/login/:tenantSlug` did not implement the IMS LTI Platform Storage handshake, so it ignored `lti_storage_target` and returned `302 Found` with a `Location` header pointing to `CLOUD.auth` (`https://sso.canvaslms.com/api/lti/authorize_redirect`). Furthermore, `canvasLaunch` (`tests/acceptance/M1/canvas/canvas.ts:28-38`, delegating to `beginLaunch` in `tests/acceptance/M1/common/client.ts:266-286`) only follows the OIDC authorize step when `login.status === 302 && location.startsWith('https://')`; when `login.status === 200`, `beginLaunch` returns `{ login, cookie, location: '', authorize: login, action: '', fields: {}, response: login }` without requesting `CLOUD.auth` or posting `id_token` to `/lti/launch/cogniate`.
   - Under `LA-ADR-05` D1 rules 1, 1a, 2, 3, and 5 and `contracts/lti-service-api-delta.md` §2.1:
     - **Rule 1 (Trigger):** When a valid `/lti/login/:tenantSlug` request includes a non-empty `lti_storage_target` string (`<= 128` ASCII printable characters, `/^[\x21-\x7E]{1,128}$/`), the service returns `200 OK` with `Content-Type: text/html; charset=utf-8` (and no `Location` header) instead of `302 Found`, while still setting the `__Host-lti_state_<hash>` cookie.
     - **Rule 1a (Origin resolution):** `origin` in `<script id="lti-storage-data" type="application/json">` is `platform.authorizationServer` when it is a valid `https://` origin, otherwise `new URL(platform.authEndpoint).origin`. For Canvas (`authorizationServer: 'https://canvas.instructure.com'`, `authEndpoint: 'https://sso.canvaslms.com/api/lti/authorize_redirect'` in `tests/acceptance/M1/canvas/constants.ts:15-16`), `LA-ADR-05` D1 rule 1a explicitly specifies that when `authorizationServer` is a token-AUD URI and not an origin hosting the OIDC authorization frame, `new URL(platform.authEndpoint).origin` (`https://sso.canvaslms.com`, i.e. `new URL(CLOUD.auth).origin`) is used.
     - **Rule 2 & §2.1 (Security headers & data block):** The `200` response carries `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, `Content-Security-Policy: default-src 'none'; script-src 'nonce-<base64>'; frame-ancestors https:; form-action 'none'; base-uri 'none'`, and `<script id="lti-storage-data" type="application/json">{"authUrl":"...","target":"post_message_forwarding","origin":"https://sso.canvaslms.com","key":"cog_state_<16hex>","state":"<state>"}</script>`.
3. **Preserved `AC-M1-08` invariants + full launch completion:**
   - The updated test inspects the `200` platform-storage response headers and `lti-storage-data` JSON payload (`target === 'post_message_forwarding'`, `origin === new URL(CLOUD.auth).origin`, `key` matching `/^cog_state_[0-9a-f]{16}$/`, `data.state === q.get('state')`), parses `new URL(data.authUrl)` to verify every existing `AC-M1-08` authorize query assertion (`CLOUD.auth` origin+pathname, `client_id`, `redirect_uri`, `login_hint`, `lti_message_hint`, `canvas_environment=prod`, `canvas_region=not_configured`, `lti_storage_target=post_message_forwarding`, `state`/`nonce` lengths `>= 32`, `__Host-lti_state_` cookie), and then executes the browser redirect to `data.authUrl` (`httpsRequest(data.authUrl)` -> `parseForm` -> `rememberSecret(fields.id_token)` / `rememberSecret(fields.state)` -> `formPost(action, fields, started.cookie)` -> `rememberSecret(ltik)`) so both `response.status === 303` and the Canvas simulator `canvas-oidc` record (`assert.deepEqual(oidc.missing, [])`) are verified end-to-end and secret redaction for `M1-30.no-secret-in-logs` (`tests/acceptance/M1/common/99-logs.test.ts`) is preserved.

---

## 2. Scan of Frozen Suites for `lti_storage_target`

Command run against `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-3` at tag `la-gate-test-3` (`e46bb27c9487d332f40fcefd4dd880304d1d31f1`):

```text
$ git -C /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-3 grep -n lti_storage_target -- tests/acceptance tests/e2e tests/host
tests/acceptance/M1/canvas/21-canvas-protocol.test.ts:18:  const started = await canvasLaunch(p, {}, { login: { lti_storage_target: 'post_message_forwarding' } });
tests/acceptance/M1/canvas/21-canvas-protocol.test.ts:27:  for (const [k, v] of Object.entries({ ...CANVAS_LOGIN, lti_storage_target: 'post_message_forwarding' })) {
```

- `CANVAS_LOGIN` in `tests/acceptance/M1/canvas/constants.ts:39` is `{ canvas_environment: 'prod', canvas_region: 'not_configured' }` and does **not** include `lti_storage_target`.
- Shared helpers `launch()` and `beginLaunch()` (`tests/acceptance/M1/common/client.ts:266-291`) and `canvasLaunch()` (`tests/acceptance/M1/canvas/canvas.ts:28-38`) are untouched.
- Therefore, `M1-08.canvas.login-redirect` in `tests/acceptance/M1/canvas/21-canvas-protocol.test.ts` is the **only** frozen test case in `tests/acceptance`, `tests/e2e`, or `tests/host` that sends `lti_storage_target`, and no other test case moves.

---

## 3. Exact Diff Against `la-gate-test-3` (`e46bb27c9487d332f40fcefd4dd880304d1d31f1`)

Generated from a private `--no-hardlinks` clone of `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-3` detached at `la-gate-test-3` (`e46bb27c9487d332f40fcefd4dd880304d1d31f1`):

```diff
diff --git a/tests/acceptance/M1/canvas/21-canvas-protocol.test.ts b/tests/acceptance/M1/canvas/21-canvas-protocol.test.ts
index 65b2edcd..1e58a120 100644
--- a/tests/acceptance/M1/canvas/21-canvas-protocol.test.ts
+++ b/tests/acceptance/M1/canvas/21-canvas-protocol.test.ts
@@ -1,7 +1,7 @@
 // Canvas login, Deep Linking and launch checks: AC-M1-08, -12, -13, -14, -25, -34, -36, -39 (family), -40 (a).
 import { sinkHitsSince } from '../../lib/lti';
 import {
-  AGS, DL, LTI, NRPS, admin, assert, deploymentPath, expectStatus, formPost, host, idToken,
+  AGS, DL, LTI, NRPS, admin, assert, deploymentPath, expectStatus, formPost, host, httpsRequest, idToken,
   logEvents, m1Test, noServiceCalls, parseForm, preparedLaunch, records, rememberSecret, service, unique, urls, type Json,
 } from '../common/client';
 import { pick, publication } from '../common/course';
@@ -16,10 +16,22 @@ const SCOPE = ['https://purl.imsglobal.org/spec/lti-ags/scope/lineitem', 'https:
 m1Test('M1-08.canvas.login-redirect', 'Canvas login goes to the fixed SSO authorize URL with unchanged hints', async () => {
   const p = await canvasPlatform();
   const started = await canvasLaunch(p, {}, { login: { lti_storage_target: 'post_message_forwarding' } });
-  assert.equal(started.login.status, 302);
-  const location = new URL(started.location);
+  assert.equal(started.login.status, 200);
+  assert.equal(started.login.headers.location, undefined);
+  assert.equal(started.login.headers['cache-control'], 'no-store');
+  assert.equal(started.login.headers['referrer-policy'], 'no-referrer');
+  assert.match(String(started.login.headers['content-security-policy'] ?? ''),
+    /^default-src 'none'; script-src 'nonce-[^']+'; frame-ancestors https:; form-action 'none'; base-uri 'none'$/);
+  const block = started.login.body.match(/<script id="lti-storage-data" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
+  assert.ok(block, 'lti-storage-data JSON block');
+  const data = JSON.parse(block) as { authUrl: string; target: string; origin: string; key: string; state: string };
+  assert.equal(data.target, 'post_message_forwarding');
+  assert.equal(data.origin, new URL(CLOUD.auth).origin);
+  assert.match(data.key, /^cog_state_[0-9a-f]{16}$/);
+  const location = new URL(data.authUrl);
   assert.equal(`${location.origin}${location.pathname}`, CLOUD.auth);
   const q = location.searchParams;
+  assert.equal(data.state, q.get('state'));
   assert.equal(q.get('client_id'), p.clientId);
   assert.equal(q.get('redirect_uri'), `${urls.lti}/lti/launch/cogniate`);
   assert.equal(q.get('login_hint'), (started.scenario as Json).id, 'login_hint unchanged');
@@ -29,7 +41,12 @@ m1Test('M1-08.canvas.login-redirect', 'Canvas login goes to the fixed SSO author
   }
   assert.ok((q.get('state') ?? '').length >= 32); assert.ok((q.get('nonce') ?? '').length >= 32);
   assert.ok(started.cookie.startsWith('__Host-lti_state_'), 'State cookie set');
-  assert.equal(started.response.status, 303, 'The full Canvas launch with Canvas login extras succeeds');
+  const authorize = await httpsRequest(data.authUrl); expectStatus(authorize, 200);
+  const { action, fields } = parseForm(authorize.body);
+  rememberSecret(fields.id_token); rememberSecret(fields.state);
+  const response = await formPost(action, fields, started.cookie);
+  rememberSecret(response.headers.location ? new URL(String(response.headers.location)).searchParams.get('ltik') ?? '' : '');
+  assert.equal(response.status, 303, 'The full Canvas launch with Canvas login extras succeeds');
   const oidc = (await records()).records.filter((r) => r.kind === 'canvas-oidc').at(-1)!;
   assert.deepEqual(oidc.missing, []);
 });
```

---

## 4. `git apply --check` & Host Typecheck Proof

### 4.1 `git apply --check` Against `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-3` (`la-gate-test-3`)

```text
$ git -C /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-3 rev-parse HEAD la-gate-test-3^{commit}
e46bb27c9487d332f40fcefd4dd880304d1d31f1
e46bb27c9487d332f40fcefd4dd880304d1d31f1

$ git -C /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-3 apply --check -v /Users/quangnguyen/cogniate-qa-runs/LA/qa3-ld9-addendum-r2/ld9-addendum-r2.patch
Checking patch tests/acceptance/M1/canvas/21-canvas-protocol.test.ts...
APPLY_CHECK_EXIT=0

$ git -C /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-3 status --short
(empty — /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-3 was not modified)
```

### 4.2 TypeScript Typecheck in Scratch Clone (`tests/tsconfig.json`, `strict: true`, includes `acceptance/**/*.ts`)

```text
$ npm --prefix /Users/quangnguyen/cogniate-qa-runs/LA/qa3-ld9-addendum-r2/clone/tests run typecheck
> cogniate-m0-acceptance@0.1.0 typecheck
> tsc --noEmit -p tsconfig.json
TYPECHECK_EXIT=0
```

---

## 5. Summary & Re-Gate Evidence Table

| Item (`LA-IC-*` / ADR) | File & Line Range | Frozen Test ID | Old Assertion | New Assertion | Reason | Re-Gate Evidence (Post-Approval) |
|---|---|---|---|---|---|---|
| `LA-IC-06` (`LA-ADR-04` §6; `LA-ADR-05` D1 rules 1, 1a, 2, 3, 5; `contracts/lti-service-api-delta.md` §2.1; `BD-A2-110`) | `tests/acceptance/M1/canvas/21-canvas-protocol.test.ts:16-52` (import at `:4`) | `M1-08.canvas.login-redirect` | `assert.equal(started.login.status, 302)` + `new URL(started.location)` + `assert.equal(started.response.status, 303)` | `assert.equal(started.login.status, 200)`, no `Location` header, `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, nonce CSP header, `<script id="lti-storage-data" type="application/json">` with `target: 'post_message_forwarding'`, `origin: new URL(CLOUD.auth).origin` (`https://sso.canvaslms.com`), `key: /^cog_state_[0-9a-f]{16}$/`, `data.state === q.get('state')`, all existing `AC-M1-08` `CLOUD.auth` query & `__Host-lti_state_` cookie checks on `new URL(data.authUrl)`, plus browser step `httpsRequest(data.authUrl)` -> `parseForm` -> `formPost(action, fields, started.cookie)` -> `assert.equal(response.status, 303)` and `oidc.missing` empty | `M1-08.canvas.login-redirect` explicitly passes `lti_storage_target: 'post_message_forwarding'` on `/lti/login/cogniate`; under `LA-IC-06` (`LA-E3-15`), `/lti/login/:tenantSlug` returns the `200 text/html` platform-storage page with `lti-storage-data` JSON instead of `302` | To be recorded by `M1-08.canvas.login-redirect` in an `M1 --phase sim` run (`tests/acceptance/M1/canvas/21-canvas-protocol.test.ts`) on the new gate test SHA cut on `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-3` after Reviewer-A and Reviewer-B approve this addendum (`LD-9`) |


---

## Round 2

- **Author:** QA-3 (`task_4c06fe48d545` / `ctx_986e64f286e0`), 2026-10-23
- **Reviews Addressed:**
  - **Reviewer-A (`docs/reviews/LA-E7-08/ld9-addendum-r2-reviewer-a.md`, `CHANGES_REQUESTED` — 1 BLOCKER, 1 MINOR):**
    - **`A-LD9-R2-01` (BLOCKER — Storage-key assertion requires the wrong length):** Changed the storage-key assertion in `M1-08.canvas.login-redirect` (`tests/acceptance/M1/canvas/21-canvas-protocol.test.ts:30`) and the Round 2 rationale and summary table below from `/^cog_state_[0-9a-f]{16}$/` to `/^cog_state_[0-9a-f]$/`, matching `BD-A2-110` and `LA-ADR-05` D1 rule 3 (`cog_state_<d>`, where `<d>` is one hex digit, the first hex digit of the state hash, so the tool uses at most 16 storage keys `cog_state_0`..`cog_state_f`).
    - **`A-LD9-R2-02` (MINOR — Explanation attributes different security rules to the ADR):** Replaced the Round 1 §1.2 target/origin explanation with the actual profile trait, target, and storage-origin rules from `LA-ADR-05` D1 (rules 1, 1a, 2, 3, 5) and `BD-A2-110` in §R2.1 below.
  - **Reviewer-B (`docs/reviews/LA-E7-08/ld9-addendum-r2-reviewer-b.md`, `CHANGES_REQUESTED` — 1 BLOCKER, 1 MINOR):**
    - **`B-LA-E7-08-LD9-03` (BLOCKER — Storage-key assertion rejects the specified response):** Fixed by the `/^cog_state_[0-9a-f]$/` update in `tests/acceptance/M1/canvas/21-canvas-protocol.test.ts:30` and the Round 2 prose/table below (`A-LD9-R2-01`).
    - **`B-LA-E7-08-LD9-04` (MINOR — Supporting narrative does not match its cited inputs):** Corrected every cited document path, helper location/return shape, hostname, grep output, and typecheck output in §R2.1–§R2.4 below to match the pinned `la-gate-test-3` (`e46bb27c9487d332f40fcefd4dd880304d1d31f1`) checkout and `docs/reviews/LA-E7-08/qa.md` §6.

### R2.1 Corrected References, Helper Citations & `LA-ADR-05` D1 Rules (`A-LD9-R2-02`, `B-LA-E7-08-LD9-04`)

- **Rule & Evidence References:**
  - **LD-9 Rule Reference:** `docs/team/ltiaas/plan.md` §6.1 (`LD-9`).
  - **Architect-2 Classification:** `BD-A2-110` (`docs/architecture/ltiaas/build-decisions-A2.md` §62; `LA-ADR-05` §5 `LA-IC-06` row; `LA-ADR-04` D8 `LA-IC-06` row).
  - **Failing Gate Evidence (Slot 3C):** Recorded in `docs/reviews/LA-E7-08/qa.md` §6 (`§6.2` `:229`, `§6.3` `:238-244`, `§6.4` `:296`), with durable artifacts under `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT3C/` (`SLOT3C/artifacts/qalead-la-40-8fadb828-2026-10-23T21-00-56-592Z/summary.json`, `m1-case-results.json`, and `cmd/acceptance-sim.log` where `M1-08.canvas.login-redirect` failed with `AssertionError: Expected values to be strictly equal: 200 !== 302` at `acceptance/M1/canvas/21-canvas-protocol.test.ts:19:10`).
- **Pinned Frozen-Test Helpers at `la-gate-test-3` (`e46bb27c9487d332f40fcefd4dd880304d1d31f1`):**
  - `CLOUD` in `tests/acceptance/M1/canvas/constants.ts:14-18` sets `profile: 'canvas-sim-cloud'` and `auth: 'https://sso.canvas.sim.test/api/lti/authorize_redirect'`, so `new URL(CLOUD.auth).origin` is `'https://sso.canvas.sim.test'`.
  - `CANVAS_LOGIN` in `tests/acceptance/M1/canvas/constants.ts:39` is `{ canvas_environment: 'prod', canvas_region: 'not_configured' }`.
  - `canvasLaunch` in `tests/acceptance/M1/canvas/canvas.ts:69-70` calls `launch(scenarioOf(t, patch), { ...options, login: { ...CANVAS_LOGIN, ...options.login } })`.
  - `launch` in `tests/acceptance/M1/common/client.ts:159-170` calls `beginLaunch(patch, options.login)` (`tests/acceptance/M1/common/client.ts:148-158`) and at line 161 checks `if (started.login.status !== 302) return { ...started, response: started.login, ltik: '', fields: {} as Record<string, string> };`. When login returns `200`, `launch` returns without calling `httpsRequest(started.location)` or posting `id_token` to `/lti/launch/cogniate`.
  - In `tests/acceptance/M1/canvas/21-canvas-protocol.test.ts:27-29`, the preserved loop checks `for (const [name, value] of [['scope', 'openid'], ['response_type', 'id_token'], ['response_mode', 'form_post'], ['prompt', 'none']])`.
- **Actual `LA-ADR-05` D1 Rules (`docs/architecture/ltiaas/adr/LA-ADR-05-lti-advantage-completeness.md:91-96`, `contracts/lti-service-api-delta.md` §2.1, and `BD-A2-110`):**
  1. **Rule 1 — Trigger (profile data):** The profile trait `platformStorage` is `null`, or `{ targetFrame: 'from-login' | <frame name>, origin: 'authOrigin' | <fixed https origin> }`. The login uses the `200` login page only when the trait is not `null` **and** a target `T` exists: `from-login` takes `T` from the login parameter `lti_storage_target` (query or form body; at most 64 characters, `[A-Za-z0-9_-]` or `_parent`); a frame name is `T` itself (for an LMS that does not send the parameter). Else the login answers `302` byte for byte as today.
  2. **Rule 1a — Trait values:** In E1 and E2, `platformStorage` was `null` for every profile (so `M1-08.canvas.login-redirect` answered `302` at baseline `1b17261`). In E3 (`LA-ADR-05`), every Canvas profile has `{ from-login, authOrigin }` and `lti-generic` has `{ from-login, authOrigin }`; `standard`, Blackboard, and `brightspace` stay `null`.
  3. **Rule 2 — Storage origin (`O`):** `O` is the origin of the platform `authenticationEndpoint` when the trait says `authOrigin` (the OIDC auth origin; for `canvas-sim-cloud` in `M1-08.canvas.login-redirect`, `new URL(CLOUD.auth).origin` = `'https://sso.canvas.sim.test'`), else the fixed origin of the trait.
  4. **Rule 3 — Login page:** Answers `200`, no `Location`, `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, CSP `default-src 'none'; script-src 'nonce-…'; frame-ancestors https:; form-action 'none'; base-uri 'none'`, and sets the same `__Host-lti_state_*` cookie as today. The page puts `authUrl` (equal to the `Location` of today's `302`, with all query parameters and hints unchanged), `state`, `target`, and `origin` (`O`) into `<script id="lti-storage-data" type="application/json">`, and sets `key` to `cog_state_<d>`, where `<d>` is the first hex digit of the state hash (`/^cog_state_[0-9a-f]$/`, one hex digit, so the tool uses at most 16 keys in platform storage).
  5. **Rule 5 — Launch, cookie present (`BD-A2-110`):** When the subsequent launch `POST` carries the state cookie, the launch is unchanged (check 2, then checks 4 to 14) and answers `303` to the tool. Following `data.authUrl` through the simulator with `started.cookie` completes the launch with `303` and records `canvas-oidc` with `missing: []`.

### R2.2 Exact Frozen-Suite Scan Output at `la-gate-test-3` (`B-LA-E7-08-LD9-04`)

Exact command output against `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-3` (`la-gate-test-3` = `e46bb27c9487d332f40fcefd4dd880304d1d31f1`):

```text
$ git -C /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-3 grep -n lti_storage_target -- tests/acceptance tests/e2e tests/host
tests/acceptance/M1/canvas/21-canvas-protocol.test.ts:18:  const started = await canvasLaunch(p, {}, { login: { lti_storage_target: 'post_message_forwarding' } });
```

Only line 18 of `tests/acceptance/M1/canvas/21-canvas-protocol.test.ts` matches across `tests/acceptance`, `tests/e2e`, and `tests/host`.

### R2.3 Regenerated Exact Diff Against `la-gate-test-3` (`e46bb27c9487d332f40fcefd4dd880304d1d31f1`)

Generated from `/Users/quangnguyen/cogniate-qa-runs/LA/qa3-ld9-addendum-r2/clone` detached at `la-gate-test-3` (`e46bb27c9487d332f40fcefd4dd880304d1d31f1`):

```diff
diff --git a/tests/acceptance/M1/canvas/21-canvas-protocol.test.ts b/tests/acceptance/M1/canvas/21-canvas-protocol.test.ts
index 65b2edcd..36a3ffa8 100644
--- a/tests/acceptance/M1/canvas/21-canvas-protocol.test.ts
+++ b/tests/acceptance/M1/canvas/21-canvas-protocol.test.ts
@@ -1,7 +1,7 @@
 // Canvas login, Deep Linking and launch checks: AC-M1-08, -12, -13, -14, -25, -34, -36, -39 (family), -40 (a).
 import { sinkHitsSince } from '../../lib/lti';
 import {
-  AGS, DL, LTI, NRPS, admin, assert, deploymentPath, expectStatus, formPost, host, idToken,
+  AGS, DL, LTI, NRPS, admin, assert, deploymentPath, expectStatus, formPost, host, httpsRequest, idToken,
   logEvents, m1Test, noServiceCalls, parseForm, preparedLaunch, records, rememberSecret, service, unique, urls, type Json,
 } from '../common/client';
 import { pick, publication } from '../common/course';
@@ -16,10 +16,22 @@ const SCOPE = ['https://purl.imsglobal.org/spec/lti-ags/scope/lineitem', 'https:
 m1Test('M1-08.canvas.login-redirect', 'Canvas login goes to the fixed SSO authorize URL with unchanged hints', async () => {
   const p = await canvasPlatform();
   const started = await canvasLaunch(p, {}, { login: { lti_storage_target: 'post_message_forwarding' } });
-  assert.equal(started.login.status, 302);
-  const location = new URL(started.location);
+  assert.equal(started.login.status, 200);
+  assert.equal(started.login.headers.location, undefined);
+  assert.equal(started.login.headers['cache-control'], 'no-store');
+  assert.equal(started.login.headers['referrer-policy'], 'no-referrer');
+  assert.match(String(started.login.headers['content-security-policy'] ?? ''),
+    /^default-src 'none'; script-src 'nonce-[^']+'; frame-ancestors https:; form-action 'none'; base-uri 'none'$/);
+  const block = started.login.body.match(/<script id="lti-storage-data" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
+  assert.ok(block, 'lti-storage-data JSON block');
+  const data = JSON.parse(block) as { authUrl: string; target: string; origin: string; key: string; state: string };
+  assert.equal(data.target, 'post_message_forwarding');
+  assert.equal(data.origin, new URL(CLOUD.auth).origin);
+  assert.match(data.key, /^cog_state_[0-9a-f]$/);
+  const location = new URL(data.authUrl);
   assert.equal(`${location.origin}${location.pathname}`, CLOUD.auth);
   const q = location.searchParams;
+  assert.equal(data.state, q.get('state'));
   assert.equal(q.get('client_id'), p.clientId);
   assert.equal(q.get('redirect_uri'), `${urls.lti}/lti/launch/cogniate`);
   assert.equal(q.get('login_hint'), (started.scenario as Json).id, 'login_hint unchanged');
@@ -29,7 +41,12 @@ m1Test('M1-08.canvas.login-redirect', 'Canvas login goes to the fixed SSO author
   }
   assert.ok((q.get('state') ?? '').length >= 32); assert.ok((q.get('nonce') ?? '').length >= 32);
   assert.ok(started.cookie.startsWith('__Host-lti_state_'), 'State cookie set');
-  assert.equal(started.response.status, 303, 'The full Canvas launch with Canvas login extras succeeds');
+  const authorize = await httpsRequest(data.authUrl); expectStatus(authorize, 200);
+  const { action, fields } = parseForm(authorize.body);
+  rememberSecret(fields.id_token); rememberSecret(fields.state);
+  const response = await formPost(action, fields, started.cookie);
+  rememberSecret(response.headers.location ? new URL(String(response.headers.location)).searchParams.get('ltik') ?? '' : '');
+  assert.equal(response.status, 303, 'The full Canvas launch with Canvas login extras succeeds');
   const oidc = (await records()).records.filter((r) => r.kind === 'canvas-oidc').at(-1)!;
   assert.deepEqual(oidc.missing, []);
 });
```

### R2.4 `git apply --check` & Exact Host Typecheck Output (Round 2 Patch)

```text
$ git -C /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-3 rev-parse HEAD la-gate-test-3^{commit}
e46bb27c9487d332f40fcefd4dd880304d1d31f1
e46bb27c9487d332f40fcefd4dd880304d1d31f1

$ git -C /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-3 apply --check -v /Users/quangnguyen/cogniate-qa-runs/LA/qa3-ld9-addendum-r2/ld9-addendum-r2.patch
Checking patch tests/acceptance/M1/canvas/21-canvas-protocol.test.ts...

$ git -C /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-3 status --short

$ npm --prefix /Users/quangnguyen/cogniate-qa-runs/LA/qa3-ld9-addendum-r2/clone/tests run typecheck

> cogniate-qa-tests@0.0.0 typecheck
> tsc --noEmit -p tsconfig.json
```

Both `git apply --check -v` and `npm --prefix .../tests run typecheck` exited with code `0`, and `git -C /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-3 status --short` produced empty output.

### R2.5 Round 2 Summary & Re-Gate Evidence Table

| Item (`LA-IC-*` / ADR) | File & Line Range | Frozen Test ID | Old Assertion | New Assertion (Round 2) | Reason (`LA-ADR-05` D1 & `BD-A2-110`) | Re-Gate Evidence (Post-Approval) |
|---|---|---|---|---|---|---|
| `LA-IC-06` (`LA-ADR-04` §6 & D8; `LA-ADR-05` D1 rules 1, 1a, 2, 3, 5 & §5; `contracts/lti-service-api-delta.md` §2.1; `BD-A2-110`) | `tests/acceptance/M1/canvas/21-canvas-protocol.test.ts:16-52` (import at `:4`) | `M1-08.canvas.login-redirect` | `assert.equal(started.login.status, 302)` + `new URL(started.location)` + `assert.equal(started.response.status, 303)` | `assert.equal(started.login.status, 200)`, no `Location` header, `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, nonce CSP header, `<script id="lti-storage-data" type="application/json">` with `target: 'post_message_forwarding'`, `origin: new URL(CLOUD.auth).origin` (`https://sso.canvas.sim.test`), `key: /^cog_state_[0-9a-f]$/` (one hex digit, first hex digit of the state hash), `data.state === q.get('state')`, all existing `AC-M1-08` `CLOUD.auth` query & `__Host-lti_state_` cookie checks on `new URL(data.authUrl)`, plus browser step `httpsRequest(data.authUrl)` -> `parseForm` -> `formPost(action, fields, started.cookie)` -> `assert.equal(response.status, 303)` and `oidc.missing` empty | Every Canvas profile has `platformStorage: { from-login, authOrigin }` in E3 (`LA-ADR-05` D1 rule 1a), and `M1-08.canvas.login-redirect` sends `lti_storage_target: 'post_message_forwarding'`, so login returns the `200` platform-storage login page (rules 1–3) and the subsequent cookie launch answers `303` (rule 5; `BD-A2-110`) | Pending authorized re-gate: to be recorded by `M1-08.canvas.login-redirect` in an `M1 --phase sim` run (`tests/acceptance/M1/canvas/21-canvas-protocol.test.ts`) on the new gate test SHA cut on `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-3` after Reviewer-A and Reviewer-B approve this addendum (`docs/team/ltiaas/plan.md` §6.1 `LD-9`) |
