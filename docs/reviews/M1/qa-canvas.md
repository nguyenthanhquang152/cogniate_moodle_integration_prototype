Verdict: PREPARED — Canvas simulator and Canvas M1 cases are ready; harness checks only, no product verification
Round: 1
Owner: independent Claude QA-E2E (Canvas QA), claude-opus-5-5, xhigh
Behavior baseline: `56591df0e71939d5d62c9042c630c841d01f84e8` (ADR-011 revision 6). Plan: [M1 QA plan](qa-plan.md) at `6733e57`.

## 1. Independence and inputs

I wrote every case from the accepted criteria before any product reading.

- Read: ADR-011 revision 6, LTI contract §2 and §9, app contract §4–§6.1 and §10, tasks M1, M2 and M3, research facts F-CV-1 to F-CV-23, the M1 QA plan, the QA-owned simulator core, the common and Blackboard harness files, and the T6/T7 QA tests.
- For runner plumbing only, I read the e2e helper functions in `infra/scripts/lib.sh` (`prepare_e2e`, `qa_env_args`, `dc`). I did not read service, app, portal or player code, author notes or reviews.
- No stack was started. No product, tenant or public endpoint was called.

## 2. Canvas source pins

Revision: `instructure/canvas-lms` `1c9f0bb8013ed69c4f2efe11fd483025469b7e6c` (the `canvas-upstream` pin in `tests/fixtures/multi-lms/provider-sources.json`). I read these files at that revision before I used them for fixtures:

| File | Fact used by the simulator or the cases |
| --- | --- |
| `app/controllers/lti/ims/authentication_controller.rb` | Required keys `client_id`, `login_hint`, `lti_message_hint`, `nonce`, `prompt`, `redirect_uri`, `response_mode`, `response_type`, `scope`; `scope` must be `openid`; `state` is optional. |
| `app/models/lti/lti_advantage_adapter.rb` | Login sends `iss`, `login_hint`, `client_id`, `lti_deployment_id`, `target_link_uri`, `lti_message_hint`, `canvas_environment`, `canvas_region`, and optionally `lti_storage_target=post_message_forwarding`. |
| `lib/lti/messages/jwt_message.rb` | `product_family_code = "canvas"` (F-CV-22); `document_target = "iframe"` (F-CV-17); AGS and NRPS URLs on the root account domain (F-CV-18). |
| `lib/lti/messages/deep_linking_request.rb` | Return URL on the request host with a `data` query (F-CV-21); `assignment_selection`: `ltiResourceLink`, targets `iframe` and `window`, no `data` claim. |
| `app/controllers/lti/ims/concerns/deep_linking_services.rb` | Response JWT: `iss` = client id, `aud` = the Canvas issuer, `nonce` required. |
| `lib/canvas/oauth/client_credentials_provider.rb` | Assertion `aud` = the token URL of the request host, a string. |
| `app/controllers/lti/ims/scores_controller.rb` | `400` for a timestamp before the stored result (F-CV-19); `422` at the attempt limit (F-CV-23). |
| `lib/lti/substitutions_helper.rb` | Student View role `…/lti/system/person#TestUser` (F-CV-20). |

## 3. Canvas simulator (`tests/sim/canvas/`)

`index.mjs` exports `createProviders(runtime)` with two providers on the QA core (`createProvider`). The core is unchanged.

| Provider | Issuer | Auth and JWKS | Token, AGS, NRPS | Page-only host |
| --- | --- | --- | --- | --- |
| `canvas-sim-cloud` | `https://canvas.sim.test` (value only, never served) | `sso.canvas.sim.test` | `school-a.canvas.sim.test`, `school-b.canvas.sim.test` | `canvas.school-a.sim.test` |
| `canvas-sim-self` | `https://canvas-self.sim.test` | `canvas-self.sim.test` | `api.canvas-self.sim.test` | `canvas-self.sim.test` |

Canvas rules in the fixture: query-only Deep Linking `data`, no response `sub`, string assertion `aud`, `iframe` document target, family `canvas`, host-bound bearer tokens. A small wrapper refuses an authentication request without a Canvas key and records the `prompt` and `response_mode` values (`kind: canvas-oidc`), with no token. The Canvas cases send Canvas login extras and the faithful `assignment_selection` settings as a scenario claim.

## 4. Case inventory

Every row is **PREPARED, NOT RUN**. Label: `SIM`. File folder: `tests/acceptance/M1/canvas/`. Machine inventory: `manifest.json` (222 rows: 215 `api`, 7 `browser`). Each case title has `AC-M1-NN` and `{case:M1-NN.canvas.<variant>}`.

| AC | Rows | File | Case suffixes |
| --- | --- | --- | --- |
| AC-M1-04 | 9 | 11-canvas-platforms.test.ts | `cloud-fixed`, `override-auth`, `override-jwks`, `override-token`, `override-url`, `self-hosted`, `service-url-blackboard`, `service-url-standard`, `split-hosts` |
| AC-M1-05 | 18 | 11-canvas-platforms.test.ts | `canonical`, `rule1-fragment`, `rule1-http`, `rule1-path`, `rule1-query`, `rule1-userinfo`, `rule2-ipv4`, `rule2-ipv6`, `rule2-localhost`, `rule2-sub-localhost`, `rule3-app`, `rule3-content`, `rule3-lti`, `rule4-service-sso`, `rule4-sso`, `rule4-sso-port`, `rule5-instructure`, `self-positive` |
| AC-M1-07 | 8 | 11-canvas-platforms.test.ts | `conditional-delete`, `deactivate-reactivate`, `deployment-add`, `deployment-site-refused`, `parallel-conditional`, `patch-site-refused`, `platform-diff`, `staged-platform` |
| AC-M1-08 | 2 | 21-canvas-protocol.test.ts | `deep-link`, `login-redirect` |
| AC-M1-09 | 12 | 41-canvas-grades.test.ts, 70-canvas-browser.spec.ts | `best-html`, `best-scorm12`, `browser-framed` (browser), `browser-top-level` (browser), `embedded-page`, `html-incomplete`, `html-seven-of-ten`, `html-zero`, `moodle-static-control`, `scorm-incomplete`, `scorm-seven-of-ten`, `scorm-zero` |
| AC-M1-12 | 4 | 21-canvas-protocol.test.ts | `ags-lineitem-evil`, `ags-lineitems`, `dl-return`, `nrps` |
| AC-M1-13 | 5 | 21-canvas-protocol.test.ts | `inactive-deployment`, `login-token-deployment`, `no-client-id`, `unknown-deep-link`, `unknown-resource` |
| AC-M1-14 | 3 | 21-…, 41-…, 70-… | `browser-runtime-name` (browser), `claims`, `runtime-identity` |
| AC-M1-15 | 7 | 11-canvas-platforms.test.ts | `default-profile`, `dto`, `dynamic-refused`, `lms-providers`, `lms-unknown`, `profile-mismatch`, `split` |
| AC-M1-16 | 10 | 41-canvas-grades.test.ts | `graded-vs-preview`, `institution-admin`, `instructor`, `learner`, `learner-and-instructor`, `learner-institution-instructor`, `simple-instructor`, `simple-learner`, `student-view`, `teaching-assistant` |
| AC-M1-17 | 7 | 31-canvas-grants.test.ts | `other-library-conflict`, `register`, `repeat`, `strict-client-secret`, `strict-issuer`, `strict-jwks-url`, `strict-missing-code` |
| AC-M1-18 | 3 | 41-canvas-grades.test.ts | `disconnect`, `grant-revoked`, `pending-score` |
| AC-M1-19 | 5 | 31-canvas-grants.test.ts | `blackboard-refused`, `inline-key`, `json`, `jwk-other`, `rows` |
| AC-M1-20 | 7 | 31-canvas-grants.test.ts | `add`, `capability-blackboard`, `capability-moodle`, `initial-grant`, `missing-code`, `pending`, `repeat` |
| AC-M1-21 | 3 | 31-canvas-grants.test.ts | `course-shell`, `registration-url`, `web-services` |
| AC-M1-22 | 5 | 41-…, 70-… | `back-to-canvas`, `browser-status-text` (browser), `inactive-text`, `role-text`, `unknown-deployment-text` |
| AC-M1-24 | 1 | 99-canvas-secrets.spec.ts | `browser-secrets` (browser; the last browser activity) |
| AC-M1-25 | 2 | 21-canvas-protocol.test.ts | `self-hosted-metadata`, `site-metadata` |
| AC-M1-26 | 5 | 41-canvas-grades.test.ts | `deep-link`, `grade`, `no-cloud-hosts`, `page-host-ags`, `register` |
| AC-M1-29 | 24 | 31-canvas-grants.test.ts | `a-foreign-code`, `a-no-code`, `c`, `d`, `e-client`, `e-deployment`, `f`, `g`, `h`, `i-other-library`, `i-redeemed`, `k-add-client`, `k-add-pending`, `k-initial-registered`, `k-library`, `k-service-url`, `k-site`, `k-site-canonical`, `k-ttl`, `l-delete`, `l-get`, `l-post-deployments`, `l-put`, `m` |
| AC-M1-31 | 4 | 31-canvas-grants.test.ts | `other-lms`, `publication-fields`, `routes`, `signed-out` |
| AC-M1-32 | 5 | 41-canvas-grades.test.ts | `ags-on-page-host`, `deep-link`, `dl-on-service-host`, `grade`, `idtoken` |
| AC-M1-33 | 4 | 41-canvas-grades.test.ts | `mapping-400`, `mapping-422`, `status-400`, `status-422` |
| AC-M1-34 | 28 | 21-canvas-protocol.test.ts | `cloud-` and `self-` × (`altered-signature`, `unknown-key`, `unknown-kid`, `none`, `hs256`, `wrong-issuer`, `wrong-audience`, `multi-aud-no-azp`, `multi-aud-wrong-azp`, `expired`, `future-iat`, `wrong-nonce`, `no-cookie`, `replay`) |
| AC-M1-36 | 5 | 21-canvas-protocol.test.ts | `encoded-dot`, `encoded-slash`, `origin`, `path`, `query` |
| AC-M1-37 | 21 | 51-canvas-races.test.ts | `c`, `c2`, `d`, `e`, `f`, `g`, `h`, `i`, `j`, `m`, `n`, `p-activate`, `p-create`, `q`, `r`, `s-compensation`, `s-dead`, `s-retry`, `t`, `u-after-c`, `u-after-c2` |
| AC-M1-38 | 7 | 61-canvas-containment.test.ts | `a`, `b`, `d`, `e`, `f`, `f-held-delete`, `g-late-create` |
| AC-M1-39 | 5 | 21-…, 61-… | `blackboard-family-on-canvas`, `operator-order`, `residual-race`, `squat-refused`, `upper-case-family` |
| AC-M1-40 | 3 | 21-…, 70-… | `a-dl-third-host`, `b-frame-refused` (browser), `c-return-fallback` (browser) |

Accounting:

- All 28 Canvas criteria of `REQUIRED.canvas` in `tests/acceptance/M1/common/coverage.mjs` have rows. AC-M1-24 has an extra Canvas browser row.
- All 21 mandatory AC-M1-37 Canvas suffixes and all 7 AC-M1-38 Canvas suffixes are separate rows.
- Both-provider races have their own Canvas rows: AC-M1-37 `d`, `e`, `f`, `g`, `i`, `j`, `m`, `n`, `q`, `r` and AC-M1-38 `a`, `b`, `e` (Blackboard has its own rows). AC-M1-07 `parallel-conditional` is the Canvas counterpart of the shared-platform ref race.
- AC-M1-29 split: Canvas owns `a`, `i`, the Canvas counterparts of `c`–`h`, `k` (Canvas CLI refusals) and `l`/`m`. Blackboard owns its rows.

Outcome differences that the criteria imply for Canvas `initial` (no `lti_platform_id` before phase 2): an active record without approval gives `launch_rejected {reason: "unknown_platform"}` (AC-M1-37 `c2`, `i`, `m`). A Canvas added deployment gives `deployment_not_approved` (`p-activate`, `s-*`). Release of a Canvas binding prints `deleted` (Blackboard: `kept_inactive`).

## 5. Commands

Harness only (no Docker, no product call):

```sh
node tests/host/run-m1.mjs --harness-only --provider canvas
node tests/host/run-m1.mjs --harness-only --provider all
node --test tests/sim/canvas/protocol.test.mjs
```

Product runs (after the Lead commits the tests, freezes both SHAs and reserves the lane; the M1 plan lane is `qa-multi-rN`, port 8443, `172.29.0.0/16`):

```sh
export COMPOSE_PROJECT_NAME=qa-multi-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16
export COURSE_FIXTURES_DIR=/Users/quangnguyen/Workspaces/personal/cogniate_moodle_integration_prototype/docs/raw/data/courses
node tests/host/run-m1.mjs --phase sim --provider canvas --sha "$QA_PRODUCT_SHA" --test-sha "$QA_TEST_SHA"   # partial readiness only
node tests/host/run-m1.mjs --sha "$QA_PRODUCT_SHA" --test-sha "$QA_TEST_SHA"                                  # full M1 gate
```

The Vitest pass runs the API rows in contract order (`11`, `21`, … between the common and Blackboard files, before `80`–`99`). The Playwright pass (`QA_TASK=M1`) then runs the 7 browser rows; `99-canvas-secrets.spec.ts` is last and reads `/__sim/secrets` privately. Estimate, not a measurement: the Canvas rows add 60–100 minutes to one SIM pass (restarts and 60 s waits in AC-M1-18, -29 `g`, -33, -37 `d`, `s-dead`, -38 `a`).

## 6. Harness evidence (2026-10-20)

| Command | Result |
| --- | --- |
| `node --test tests/sim/canvas/protocol.test.mjs` | 5 pass, 0 fail |
| `node tests/host/run-m1.mjs --harness-only --provider canvas` | 21 self-tests pass; typecheck pass; 239 API cases discovered (24 common, 215 Canvas) and 19 host/browser rows accounted; providers `canvas-sim-cloud`, `canvas-sim-self` |
| `node tests/host/run-m1.mjs --harness-only --provider all` | 21 self-tests pass; typecheck pass; 359 API cases (24 common, 120 Blackboard, 215 Canvas) and 19 host/browser rows; three providers load |
| `node tests/host/run-m1.mjs --harness-only --provider blackboard` | 144 API cases, 12 host rows (unchanged) |
| `QA_SUITE=acceptance QA_TASK=M1 playwright test --list` | 7 Canvas browser rows |

These checks prove only that the harness loads, types and accounts for every case. They make no product call.

## 7. Open items for the Lead

| Id | Item | Needed from |
| --- | --- | --- |
| C-1 | Contract §4.6 names `domain` "<host of PUBLIC_LTI_URL>". With a non-443 QA port it is unclear if the port is part of it. AC-M1-19 accepts both forms and records the value. | Architect (wording) |
| C-2 | AC-M1-20 expects `409 CONNECTION_NOT_READY` for a pending Canvas connection. Only a well-formed random code can reach it (the CLI refuses `add_deployment` while pending). The case expects the endpoint precondition before phase 1. | Architect (confirm order) |
| C-3 | AC-M1-20 "an `initial` grant": in black box, that grant is already redeemed, so phase 1 answers at check 2 or 3. The case accepts the log reason `redeemed` or `purpose`; the public answer is `403 GRANT_INVALID` in both. | Architect (confirm) |
| C-4 | Signing-key rotation is not reachable: the M1 host channel has no `lti:bootstrap --rotate-signing-key` action. No SIM criterion needs it; AC-M1-19 `inline-key` proves the snapshot is the active key. Live row L-C14 covers rotation. | Lead (optional host action through Codex QA) |
| C-5 | A live race that misses its 5 s window reports `BLOCKED` with its times (same rule as Blackboard). No product timeout changes. | — |
| C-6 | The Canvas browser rows and M2 need the acceptance stack only; no extra fixture or core change is needed. | — |

Not done in this task: product, Moodle regression, local Canvas, hosted Canvas or Blackboard live checks. Every live row stays UNVERIFIED.
