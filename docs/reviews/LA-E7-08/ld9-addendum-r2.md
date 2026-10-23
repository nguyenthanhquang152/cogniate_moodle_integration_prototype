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
