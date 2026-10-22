Verdict: HOLD at candidate `aaa823b` — round 1 Canvas rows 233/233 PASS (232 SIM + `M1-37.canvas.aa` snapshot-isolated; sink gate PASS); the full run failed in round 1 storage (50 of 70 common rows FAIL; round 1 438/488 PASS); round 2 not run; partial evidence only, no AC-M3-01 credit (see §19)
Round: 13 (task `task_e28388df4dcc`, dispatch `ctx_e7de4ddd7504`; see §19). Round 12 header: "HOLD at candidate `9cdd768` — round 1 Canvas rows 233/233 PASS (232 SIM + `M1-37.canvas.aa` snapshot-isolated; sink gate PASS); the full run failed in round 1 storage (69 of 70 common rows FAIL; round 1 419/488 PASS); round 2 not run; partial evidence only, no AC-M3-01 credit" (dispatch `ctx_374ca3cec6a5`, §18). Round 11 result: "HOLD at candidate `51a80b5` — round 1 Canvas rows complete; round 1 stopped in snapshot-upgrade" (dispatch `ctx_f8cca0cc95be`, §17). Round 10 header: "HOLD at candidate `82e2dab` — round 1 Canvas rows 233/233 PASS (232 SIM + `M1-37.canvas.aa` snapshot-isolated; sink gate PASS); the full run stopped in round 1 snapshot-upgrade on a common host-collector issue; round 2 not run; partial evidence only, no AC-M3-01 credit" (dispatch `ctx_33862fcfa6d1`, §16). Round 9 header: "HOLD at candidate `55c33a3` — round 1 Canvas rows 233/233 PASS (232 SIM + `M1-37.canvas.aa` snapshot-isolated; sink gate PASS); round 1 incomplete (stopped in snapshot-upgrade on a common-row oracle issue), round 2 not run; no AC-M3-01 credit" (dispatch `ctx_f3f20494787a`, §15). Round 8 header: "FAIL / HOLD for round 1 SIM at storage candidate `a784522` — 232 SIM Canvas rows: 231 PASS, 1 FAIL (`M1-17.canvas.repeat`, a QA oracle defect; no product defect shown); round incomplete; one-case repair held, not run (see §14)" (§14). Round 7 header: "FAIL / HOLD for round 1 SIM at `aff4882` — 232 selected Canvas rows: 229 PASS, 3 FAIL (all QA oracle or request defects; no product defect); bounded repairs held, not run" (dispatch `ctx_4a94125660be`, §13)
Owner: round 13 by a fresh Claude Canvas QA-E2E session (`claude-opus-5-5`, xhigh; Orca session `c9188d79-d5a7-4ab0-bc62-ac27e61ff412`), which did not run rounds 1–12; round 12 by a new Claude Canvas QA-E2E session (`claude-opus-5-5`, xhigh; Orca session `d892992a-032c-4693-b6ac-3e8359c10af3`), which did not run rounds 1–11; round 11 by Orca session `07499b81-08f3-49dd-8576-2057a21a95ac` (§17); round 10 by a new Claude Canvas QA-E2E session (`claude-opus-5-5`, xhigh; Orca session `95d4c010-ef6d-4f58-87fe-7a686ec36424`), which did not run rounds 1–9; rounds 8–9 by another new Claude Canvas QA-E2E session (`claude-opus-5-5`, xhigh; Orca session `228bb341-1217-4df5-bc56-664d1f41faa3`), which did not run the earlier rounds; earlier rounds by the original Claude Canvas QA and, for rounds 5–6, the independent Codex Canvas QA quota replacement remain below
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

Status after round 2 (§8): C-1 to C-3 are closed by the Architect clarification at `ca14de6`, and the cases assert the exact oracles. C-4 is closed by the Lead decision (no rotation host action; L-C14 stays UNVERIFIED).

| Id | Item | Status |
| --- | --- | --- |
| C-1 | Exact `domain` of the Canvas JSON. | Closed: `host:port` (port only when not 443). |
| C-2 | Pending Canvas `POST …/deployments`. | Closed: `409 CONNECTION_NOT_READY` before any grant check. |
| C-3 | Redeemed `initial` grant on add-deployment. | Closed: `403 GRANT_INVALID`, reason `redeemed` only. |
| C-4 | Signing-key rotation host action. | Closed: not added; live row L-C14 stays UNVERIFIED. |
| C-5 | A live race that misses its 5 s window reports `BLOCKED` with its times (same rule as Blackboard). No product timeout changes. | Open rule for the run |
| C-6 | The Canvas browser rows and M2 need the acceptance stack only; no extra fixture or core change is needed. | — |

Not done in this task: product, Moodle regression, local Canvas, hosted Canvas or Blackboard live checks. Every live row stays UNVERIFIED.

## 8. Round 2 — alignment with the Architect clarification (2026-10-20)

Input: [review response M1](../../architecture/review-response-M1.md) at `ca14de6` (C-1 to C-3), the Lead handoff for `task_ef66f1c5c7ed`, and Reviewer-B finding B-M1-03 (refusals make no LTI call). No case was removed or loosened; two case titles changed. The manifest keeps the same 222 case ids.

| Case | Change | Oracle now |
| --- | --- | --- |
| `M1-19.canvas.json`, `M1-19.canvas.inline-key` | C-1: the "both forms" branch is removed. QA computes the value from `PUBLIC_LTI_URL`. | `extensions[0].domain` equals the lower-case host name plus `:<port>` when the port is not 443, exactly; at a non-443 port the bare host name is refused. The whole document is still compared with `deepEqual`. |
| `M1-20.canvas.pending` | C-2: also sends the pending connection's issued `initial` code. | Both a well-formed random code and the issued `initial` code → `409 CONNECTION_NOT_READY`; no `grant_rejected` line for the connection; no gate request of any method, no simulator service call, no sink hit, no LTI platform; the `initial` grant stays `issued` and then redeems with `200` through `PUT …/platform` (no live lease). The no-attempt observation is in §9. |
| `M1-20.canvas.initial-grant` | C-3: the "`redeemed` or `purpose`" alternative is removed; a deployment id without approval is used. | `403 GRANT_INVALID`; exactly one `grant_rejected {reason: "redeemed"}` for the connection; no gate request; connection and `platform.deploymentIds` unchanged; a proper `add_deployment` grant for the same id then redeems with `200` (no live lease). The no-attempt observation is in §9. |
| `M1-29.canvas.m` | B-M1-03: the three refusals now run inside the no-call watch. | `other_library`, `other_connection` and an unknown code → the same `403 GRANT_INVALID` answer, with zero gate requests of any method (provider reads included). |

All other Canvas refusal cases keep their no-call watch over every gate method (`noRemoteCall`); no provider `GET` is filtered out.

Harness evidence (round 2, worktree with the committed portal `9f96f7b` and design `ca14de6`): `node tests/sim/canvas/protocol.test.mjs` 5 pass; `node tests/host/run-m1.mjs --harness-only --provider canvas` 21 self-tests pass, typecheck pass, 239 API cases (24 common, 215 Canvas) and 19 host/browser rows; `--provider all` 359 API cases and 19 rows; `--provider blackboard` 144 API cases and 12 rows (unchanged). No stack, no product call.

## 9. Round 3 — B-M3-03: observed "no attempt" for C-2 and C-3 (2026-10-20)

Finding: Reviewer-B B-M3-03 at `f89262c` (MINOR): an unchanged connection DTO and a later successful redemption exclude a live lease, but they do not observe that no binding attempt was created. Oracle: accepted design D revision 3, R3.7, at `78bc34a` (approvals `b6e8f73`); the C-2 and C-3 decisions (`ca14de6`) and R3.2 stay unchanged.

**Observation (R3.7).** `grant_attempt_started {trace_id, grant_id, connection_id, attempt_id}` is written once after each committed phase 1, never on a refusal, in first-in, first-out order before the same request's `http_request` line. The new helpers in `31-canvas-grants.test.ts` use it as follows:

1. Baseline per connection, taken only after a completed request of the test (its own same-trace `http_request` line), so an earlier attempt line of the connection (for C-3, the registration's own attempt) is already in the file.
2. For each refused request: wait with a 15 s deadline for that request's own `http_request` line (trace id from its `x-trace-id`, same method and status), then assert zero added `grant_attempt_started` lines for the connection.
3. Positive control in the same process and stream: the follow-up redemption must add exactly one line, for its own grant id, with an `attempt_id`, before its own `http_request` line. So a missing or stale capture cannot pass.
4. Late lines are not ignored: after the positive control, the connection has exactly one new line since the baseline.
5. A missing `x-trace-id`, a missing completion line or an incomplete log capture fails as `BLOCKED`, never as PASS. No fixed sleep is evidence.

| Case | Refused requests observed | Positive control |
| --- | --- | --- |
| `M1-20.canvas.pending` (C-2) | a random 43-character code and the issued `initial` code → `409 CONNECTION_NOT_READY`, each with zero added attempt lines | the same `initial` grant through `PUT …/platform` → `200`, exactly one line |
| `M1-20.canvas.initial-grant` (C-3) | the redeemed `initial` code for a deployment without approval → `403 GRANT_INVALID`, zero added attempt lines | a proper `add_deployment` grant for the same id → `200`, exactly one line |

Every earlier assertion stays: the public status and code, exactly one `grant_rejected {reason: "redeemed"}` (C-3) or none (C-2), zero gate requests of any method (provider reads included), the `issued` grant state, the unchanged connection and approvals, and the positive redemption. The connection DTO and the follow-up redemption are no longer described as no-attempt evidence. Check 3 (`purpose`) stays a unit-only branch. Case ids, titles and the manifest do not change.

**Limits (R3.7).** One healthy process with complete capture of `cogniate-app.jsonl`; no claim across a crash or a restart; an absent line is not a database or rollback oracle (atomic rollback stays supplemental unit evidence). The approved `purpose` field is not asserted here; the broader design D cases are a separate later task.

**Harness evidence (no stack, no product call).** `npm --prefix tests run typecheck` passes. `node tests/host/run-m1.mjs --harness-only --provider canvas`: 21 self-tests, 239 API cases and 19 host/browser rows; `--provider all`: 359 and 19; `--provider blackboard`: 144 and 12 (unchanged). Discovery: 215 Canvas API ids and titles equal the manifest. Out-of-repo oracle self-check (synthetic `cogniate-app.jsonl`, the exported helpers of this file): 6 pass — a refused request without a line passes and one with a line fails; the positive control fails with zero lines, two lines or another grant; a wrong status or method fails; a missing trace header, a missing completion line (after the deadline) and an incomplete capture are `BLOCKED`.

## 10. Round 4 — applied snapshot preparation (2026-10-20)

Verdict: PREPARED, NOT RUN against the product. No product PASS is claimed.

Lead supplied the start handoff through Orca before editing. Applied contracts: `ccdd9ef67cdd2be4c6af374136777fda4e081943`, including adopted A-D-09 precision. Proposal: `78bc34ac422e0bcac324fa10e69ec9f82a17a3b8`; independent approvals: `b6e8f739e6de752cb287929c9836734d2494e444`. The preceding narrow repair is committed at `3b160f7bc22ca43f18bc16c94ecfc336b0fe80d6`. Shared QA helpers and routing are frozen at `3fef85f51ea798ac6bf3245dba632131f4e38dda`.

The Lead authorized the separate Codex quota replacement at `0b6808e05fe93c5dee9aa0537eae1f470a4be2ab`. This worker remains independent of both authors and common QA. Expectations came from applied M1, M2 and app contracts. No author notes, held author tests, product modules or production validators were read for this preparation.

### 10.1 Added rows and preserved controls

| Canvas IDs | Prepared assertion |
| --- | --- |
| `M1-37.canvas.v1`, `v3` | Unknown code on initial PUT and added-deployment POST: `403 GRANT_INVALID`, exactly `not_found`, zero requests on every HTTP method, zero attempt events in the bounded window. |
| `M1-37.canvas.v8`, `v10` | Wrong deployment: `422 GRANT_MISMATCH`, exact field `deploymentId`, exactly `mismatch`, same zero-request and audit controls. |
| `M1-37.canvas.v4`, `v6` | Kill the handler with S3 held. After restart, complete a healthy-process GET before a new audit cursor. Retry inside the live lease: `409 GRANT_IN_USE`, zero requests and no attempt. Missed deadlines are `BLOCKED`. |
| `M1-37.canvas.v12` | Both endpoints: wrong-library and strict-body precedence; pending POST status before grant/body checks; finalized repeats consume no grant. Repeat after a cold app restart. |
| `M1-37.canvas.aa` | Separate `snapshot-isolated` phase. Issue first, turn simulations off with the approved host control, then Canvas S1 gives neutral `409 PROVIDER_NOT_READY`, `profile_missing`, no platform, grant still `issued`. Restore and redeem the same code. |
| `M1-38.canvas.i1`, `i2` | Fresh cloud and self-hosted connections: canonical issuer, exactly staged POST then activation PATCH, no provider GET, one committed-attempt event, one active platform. |
| `M1-38.canvas.i4` | Both cloud and self-hosted variants restart between create and issue, then between issue and redemption. Use a fresh audit cursor after a completed request in the new process. |

All 222 earlier Canvas rows retain their IDs, titles and metadata. The 11 approved rows raise the Canvas inventory to 233. Both-provider race rows remain, including `d/e/f/g/i/j/m/n/q/r` and containment `a/b/e`. The host-owned `h1`–`h5` are counted once in common, never as extra Canvas rows.

C-2 and C-3 keep every earlier status, purpose/order, rejection reason, state, no-call and positive-control assertion. Their exported audit helpers now use `common/snapshot.ts`. That helper verifies the process start, same-trace FIFO completion and exact event count. The end-of-case delayed-line checks remain. The Canvas no-call helper now watches GET, HEAD, POST, PUT, PATCH, DELETE and OPTIONS without path exclusions.

Each new local refusal completes all issue and preparation reads before its gate cursor. A separately prepared Blackboard request then reaches V under the same all-method fault and records one attempt. Successful Canvas controls record one attempt as well. The two dead-handler rows discard the held S3 without forwarding; existing `d` and `s-dead` retain their late-write controls.

The existing race file now uses shared `liveRelease` and `restartApp`. Both old dead-handler rows check the lease window before and after the refused request. Missed delivery or lease windows report `BLOCKED`; their expected outcomes and all IDs remain unchanged.

### 10.2 Current inventory

| Owner | API | Browser | Host | Total |
| --- | --- | --- | --- | --- |
| Common, owned by Codex QA | 25 | 0 | 17 | 42 |
| Blackboard, owned by Codex QA | 141 | 0 | 0 | 141 |
| Canvas | 226 | 7 | 0 | 233 |
| Full M1 | 392 | 7 | 17 | 416 |

Provider selections include common: Canvas has 251 API plus 24 host/browser rows; Blackboard has 166 API plus 17 host rows. The full phases contain 394 `sim`, 6 `snapshot-isolated`, 5 `snapshot-upgrade`, and 11 `migration` rows. Both later full runs require every phase at the same product and test SHAs.

### 10.3 Harness evidence

| Command or check | Result |
| --- | --- |
| `node tests/host/run-m1.mjs --harness-only --provider all` | 27 harness self-checks pass; typecheck passes; 392 API IDs and 24 host/browser rows accounted; both populated-upgrade discovery stages pass. |
| `node --test tests/acceptance/M1/canvas/snapshot-oracle.selftest.mjs tests/acceptance/M1/common/snapshot-oracle.selftest.mjs` | 5 pass: 3 Canvas oracle checks and 2 shared checks already included in the 27 above. Hidden provider GETs and other methods, extra S1 calls, missing activation, and missed lease windows cannot pass. |
| Manifest comparison with committed input | All 222 existing Canvas entries are unchanged; exactly the approved 11 IDs are added. |
| `node tests/e2e/host/run-m2.mjs --harness-only` | 2 self-checks and typecheck pass; 64 M2 IDs remain; T7 discovery is unchanged. |
| `git diff --check` on owned paths | Clean. |

The first typecheck found a new helper return-type error. It was corrected before the passing checks. No acceptance test body was executed.

### 10.4 Shared handoff and limits

The existing `canvasConnection`, `canvasGrant`, `canvasRedeem`, `canvasBound`, `binding`, `addGrant`, `addDeployment`, `canvasLaunch` and constants remain compatible with common QA's populated-011 probe. No host, common or Blackboard test file changed. Lead received the named IDs and interface handoff in `msg_04979d66e315`.

New `canvas/snapshot-fixture.ts` exports `snapshotCanvas`, `applySnapshot`, `oneCanvasAttempt`, `freshCanvasSuccess`, `prepareVControl` and `failedVControl`. The last two provide the paired V control through public common APIs. Browser `hostAction` now accepts the existing `m1-profile` action for the readiness assertion; the host whitelist is unchanged.

Hold these exact paths for Lead integration:

- `tests/acceptance/M1/canvas/02-canvas-snapshot-isolated.test.ts`
- `tests/acceptance/M1/canvas/31-canvas-grants.test.ts`
- `tests/acceptance/M1/canvas/51-canvas-races.test.ts`
- `tests/acceptance/M1/canvas/52-canvas-snapshot.test.ts`
- `tests/acceptance/M1/canvas/browser.ts`
- `tests/acceptance/M1/canvas/canvas.ts`
- `tests/acceptance/M1/canvas/manifest.json`
- `tests/acceptance/M1/canvas/snapshot-fixture.ts`
- `tests/acceptance/M1/canvas/snapshot-oracle.mjs`
- `tests/acceptance/M1/canvas/snapshot-oracle.d.mts`
- `tests/acceptance/M1/canvas/snapshot-oracle.selftest.mjs`
- `docs/reviews/M1/qa-canvas.md`

The M2 paths are listed in [the M2 report](../M2/qa.md). Lead must integrate the exact paths and freeze the test SHA before independent product verification. The common QA owner retains the full manifest, mixed-provider old-state fixtures, and populated `011→012` host route.

Audit absence is limited to complete capture in one healthy process. It is not storage, transaction rollback or cross-crash proof. Fixed-issuer drift, atomic rollback and raw storage checks remain supplemental; they never fill a SIM row. No stack, product/SIM/browser acceptance, migration, legacy suite, root check, tenant access or public exposure ran. No commit or push was made. Setup-generated `pnpm-workspace.yaml` and the author's held `redemption.test.ts` were untouched. Real Canvas, Blackboard and Moodle regression evidence remains pending for the separate verification task.

## 11. Round 5 — integrated review response and verification hold (2026-10-20)

**PREPARED, NOT RUN for Canvas M1.** The full product/test candidate `eb43247d02df622d5da72dafac41d919f65a91fe` was superseded during the separate M2 browser run. Lead holds new stacks in `msg_478c680eab7a`. Core QA retains execution of both complete M1 rounds; this worker has not executed or duplicated any M1/host-upgrade acceptance row.

After submission, Lead authorized reading Reviewer-A Round 2, committed at `af5d5f6b612545b74b425011ed6e25514743da5d`. A-M3-01 exposed unarmed or GET-only observations in common/Blackboard/upgrade paths. Common QA owns those repairs and the actual-gate helper check. The product findings A-M1-03 through A-M1-06 are outside this worker's scope; the bounded call, cancellation, rejection trace and post-commit audit assertions remain unchanged.

### 11.1 Owned capture corrections

Lead authorized these changes in `msg_d8dc5181f08c`. The coordinator confirmed common QA's final interface from `msg_6717ae0ed480`: `watchAll(action = "pass", faults: Json[] = [])`. It puts specific fault rules first, appends pass/fault catch-alls for all seven methods, and returns the cursor only after arming.

- `51-canvas-races.test.ts`: every fault installation now uses the shared helper. Each scope re-arms after its opening reset, including the parallel-redemption case without a specific fault. Specific rule ids, precedence, actions, counts and every existing assertion remain intact. No GET filter was added.
- `52-canvas-snapshot.test.ts`: v4/v6 held-S3 setup now also captures all methods. Their local refusal window still uses a new healthy-process completion and cursor, then all-method failure rules and a separate positive attempt control.
- All eleven snapshot additions already armed capture before their measured windows and re-armed after intervening resets. Fresh/restart positive cases and isolated aa retain their controls. Existing C-2/C-3 purpose and order assertions, both time bounds, and all exported Canvas fixture interfaces are unchanged.

No common, Blackboard, host, manifest, product or infrastructure path was edited by this worker. Fixed-issuer drift, rollback and raw storage probes remain supplemental and do not fill SIM rows.

### 11.2 Inventory and checks

The inventory remains **233 Canvas rows: 226 API plus seven browser**, with common 42, Blackboard 141, and full M1 416. Existing case ids and manifest bytes are unchanged from `eb43247`. Both future full rounds still require all 416 rows, including the common owner's populated `011→012` route exactly once per round.

`node tests/host/run-m1.mjs --harness-only --provider canvas` passed: **31 shared harness self-checks, zero skips**, typecheck, **251 API plus 24 host/browser rows** including common cases. Log: `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-eb43247-21t8wgiv/canvas-repair-harness.log`. This includes the common owner's new actual-gate capture checks; it is not a product acceptance run. M2 also keeps all 64 IDs and passes its two harness self-checks, typecheck and discovery.

### 11.3 Required handoff

Hold `tests/acceptance/M1/canvas/51-canvas-races.test.ts`, `tests/acceptance/M1/canvas/52-canvas-snapshot.test.ts` and this report for Lead integration. Common QA must integrate its final `watchAll`/capture implementation and host operator CLI cwd fix before refreeze. Core QA must then provide both complete M1 per-case artifacts with exact product/test SHAs, run ids, phases and evidence paths for an independent Canvas verdict. No Canvas PASS or live LMS claim is made at this checkpoint.

## 12. Round 6 — browser diagnostic capture repair (2026-10-20)

**PREPARED; Canvas M1 acceptance still NOT RUN.** Separate M2 execution at product/test `ae130a3501f3a2502c6a34e36319629e3dcdfb09` found a browser evidence capture gap. Lead authorized the owned repair in `msg_fc6e9ba4bbca` and `msg_70756407eb31`. The public `captureSecrets(context)` interface now captures runtime/play/picker capabilities and LTI launch form/query values at request time, using the same private recorder. Core QA owns its one-line accepted-kind extension. Both Canvas and shared learner frame timeout functions use URL shapes with no capability paths, user information, query values or fragments. No product validator, test expectation, case ID or manifest changed.

Five M2 harness checks include synthetic request-time collection, a negative control for the old query-only stripping, and both actual frame-wait timeout branches. The Canvas-selected M1 harness passes 33 shared self-checks, typecheck and discovery of 251 API plus 24 host/browser rows including common. Log: `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-ae130a3-s73h9dlx/canvas-hygiene-harness.log`. This is not SIM or live acceptance. Canvas remains 233 rows (226 API, seven browser); common 42, Blackboard 141, full M1 416. Existing C2/C3 purpose/order, bounded audit oracle, all-method capture and fixture exports are unchanged.

Hold `tests/acceptance/M1/canvas/browser.ts`, `browser-diagnostics.mjs`, `browser-diagnostics.d.mts` and this report for Lead integration with the M2 diagnostic paths. Core QA still supplies both complete frozen M1 runs, including the populated host upgrade route exactly once each. Independent Canvas verdict and live evidence remain pending. Failed M2 privacy evidence and the containment limits are recorded in [M2 QA §6](../M2/qa.md#6-round-5--second-frozen-m2-run-and-diagnostic-hygiene-2026-10-20).

## 13. Round 7 — first full M1 round, SIM phase, at `aff4882` (2026-10-20)

**FAIL / HOLD. No M1 acceptance credit.** Core QA ran full M1 round 1 at product and test `aff48823a4c6206d6314d91a95f5eb0979d3e0e7` and stopped after the SIM phase. Run `qa-multi-r1-aff48823-2026-10-20T14-42-33-520Z`, project `qa-multi-r1`, health profile `default` for app and LTI after the run. Artifact directory: `/Users/quangnguyen/cogniate-qa-runs/m3-frozen-aff4882-20261020T1420Z/source/tests/host/artifacts/qa-multi-r1-aff48823-2026-10-20T14-42-33-520Z`. Canvas QA judged the Canvas rows independently from the runner rows and the raw reports. The failed run evidence is preserved and was not edited.

### 13.1 Exact accounting

| Set | Rows |
| --- | --- |
| Full M1 inventory | 416: Canvas 233, Blackboard 141, common 42 |
| Round 1 SIM selection | 394: Blackboard 136 API, Canvas 225 API + 7 browser, common 25 API + 1 SIM host row |
| Raw sources of the 394 | Vitest 392 assertions: 386 executed (377 passed, 9 failed) + 6 skipped because they belong to another phase. Plus 7 Playwright browser rows and 1 host row |
| Not in this phase | 22: Canvas `M1-37.canvas.aa` (snapshot-isolated), Blackboard 5 snapshot-isolated, common 5 snapshot-upgrade + 11 `MOODLE-LIVE` host rows |
| **Canvas** | **233 = 232 selected (229 PASS: 222 API + 7 browser; 3 FAIL) + 1 NOT RUN (`M1-37.canvas.aa`)** |

Raw and runner results agree on every selected Canvas row: same product and test SHA, label `SIM`, one result, no retry or flake. `evidence/sim` and `evidence/final` hold byte-identical raw reports and are counted once. The runner's evidence scan record shows 1299 captured values, 633 files, 0 hits.

### 13.2 The three failures

| Case | Class | Evidence |
| --- | --- | --- |
| `M1-36.canvas.query` | Test oracle defect | The test appended `?injected=1` to the claim line items URL. That claim URL has no query. API contract §3.4 rules 1–4 hold: same origin, path prefix, every claim query parameter kept with the same value, no encoded trick. So the URL is valid and the product's 200 is correct. AC-M1-36 "a changed claim query parameter" needs a claim URL that has a parameter. Core's `M1-36.blackboard.query` has the same defect. |
| `M1-20.canvas.repeat` | Test oracle defect (millisecond time window) | The case ran at about `14:44:56.086–57.130Z` on connection `con_8n1UzuNLG4rL-TOFXQhdqg`. The first add's `grant_redeemed` and its same-trace `POST …/deployments` 200 are both logged at `14:44:56.803Z`. `since` was `Date.now()` after that 200, and `eventsSince` counts `ts >= since`, so the first redemption itself was counted. The two repeats (`57.119Z`, `57.121Z`) returned 200 with no `grant_attempt_started`, no `grant_redeemed` and no outbound request. The unused grant has only `grant_issued`. |
| `M1-21.canvas.course-shell` | Test request defect | The test sent `createMoodleCourse: true`. App API contract (line 888) defines `createMoodleCourse: { categoryId? }`; the T8 test and the portal send `{}`. A schema 400 `INVALID_REQUEST` before the capability guard is correct for a malformed body. Core's `M1-21.blackboard.capabilities` has the same body. |

### 13.3 Authorized repairs (held, not run)

Lead authorized repairs A–C in `msg_f981848032b1`. Case IDs, titles and the inventory are unchanged, as are every status, code and no-outbound assertion.

- **A — `21-canvas-protocol.test.ts`.** `query` leaves the generic loop. A dedicated `M1-36.canvas.query` launches with an AGS claim whose `lineitems` URL is `…/line_items?scope_tag=qa-a`, and the claim URL itself must give 200. Then, for the changed value (`?scope_tag=qa-b`) and for the missing parameter (the bare URL), the `url` form must give 400 `INVALID_URL_PARAMETER` and the `:lineItemId` form 400 `INVALID_LINE_ITEM_ID`, with no outbound call.
- **B — `31-canvas-grants.test.ts`, `M1-20.canvas.repeat`.** A connection-scoped line count replaces the time window. After the first add, `completed(first, 'POST')` waits for the same-trace `http_request` line; the R3.7 order puts the redemption lines before it. The test then counts the connection's `grant_redeemed` lines (new `redeemedLines`, with the same capture guard as `attemptLines`) and `grant_attempt_started` lines. Both repeats run inside `noRemoteCall`, and each waits for its own completion. Both counts must stay unchanged, and the unused grant must stay `issued`. There is no time slack, no sleep and no claim across processes.
- **C — `31-canvas-grants.test.ts`, `M1-21.canvas.course-shell`.** `createMoodleCourse: true` becomes `{}`. The course exists, so the request reaches the capability guard.

Evidence (synthetic or harness only; `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-aff4882-eFk7FU4s/m1-canvas-repair/`):
- `node tests/host/run-m1.mjs --harness-only --provider canvas`: 34/34 self-checks, typecheck PASS, 251 API + 24 host rows (unchanged). All providers: 392 API + 24 host rows (unchanged).
- `m1-controls.mjs` compiles the exact source of `readLog`, `attemptLines`, `redeemedLines` and `eventsSince` and records their SHA-256 values. It checks four things:
  - Two same-millisecond repeats leave both counts unchanged. The old timestamp oracle counts the first redemption on the same log, which reproduces the failure.
  - A later same-millisecond `grant_redeemed` and a later `grant_attempt_started` are each detected.
  - A malformed line blocks; a partial last line does not.
  - Against the contract's §3.4 rule, the new claim URL is valid, the changed value and the missing parameter are invalid, and the old `?injected=1` URL is valid under the default claim.
- Independent judge: `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-aff4882-eFk7FU4s/canvas-judge/` (`canvas-judge.mjs`, its synthetic self-test, `round1-sim-judge.json`, `round1-canvas-classification.json`).

No product edit, stack or partial product run. A new frozen SHA and a complete M1 round are needed for any Canvas M1 verdict; `M1-37.canvas.aa` still needs its snapshot-isolated phase.

## 14. Round 8 — storage candidate `a784522`: round 1 SIM partial result and one-case oracle repair (2026-10-21)

**FAIL / HOLD. No M1 acceptance credit.** A new Claude QA-E2E session wrote this round. It did not execute rounds 1–7, and their provenance stays as written above.

Common QA ran full M1 round 1 at product = test `a784522a3cdd9bb67453b03093092cac24e87402` (ADR-012 storage candidate). The runner stopped after the SIM phase. Run `qa-multi-r1-a784522a-2026-10-21T02-21-14-202Z`; project `qa-multi-r1`; app and LTI health `default` after the phase. Artifact directory: `/Users/quangnguyen/cogniate-qa-runs/m3-frozen-a784522-20261021T0217Z/source/tests/host/artifacts/qa-multi-r1-a784522a-2026-10-21T02-21-14-202Z`. The snapshot-isolated, snapshot-upgrade, migration and storage phases, all of round 2 and legacy did not run. This worker had no stack. It read only the redacted artifacts and the frozen source.

### 14.1 Independent Canvas judgement (partial)

The judge `canvas-judge-round.mjs` reads `m1-identity.json`, `m1-case-results.json`, the scan record and the raw Vitest/Playwright reports. It requires one artifact per phase and one raw result per row, with no retry. Its synthetic self-test passes 1 positive and 10 negative controls, plus 2 round-comparison controls. Tools and hashes: `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-a784522-wgLHNZc0/tools/` (`tool-hashes-r2-abs.sha256`).

| Set | Result |
| --- | --- |
| Canvas inventory | 233 = 226 API + 7 browser; 232 in `sim`, 1 in `snapshot-isolated` (`M1-37.canvas.aa`). AC-M1-41 has no Canvas row. |
| SIM phase | 232 rows: **231 PASS** (224 API + 7 browser), **1 FAIL** (`M1-17.canvas.repeat`). Runner and raw reports agree. Product = test = `a784522`, label `SIM`, one result each, no retry. |
| Not run | `M1-37.canvas.aa` (its phase did not run). |
| Scan record | 1,300 captured values, 637 files, 0 hits. |

Record: `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-a784522-wgLHNZc0/diag/m1-r1-sim/canvas-judge-r1-sim.json`. AC-M3-01 needs two complete matching rounds, so this result gives no Canvas PASS.

### 14.2 The failure: `M1-17.canvas.repeat`

- **Assertion:** `31-canvas-grants.test.ts:95`: `assert.equal(logEvents('grant_redeemed', since, { grant_id }).length, 0)` gave `1 !== 0`. Duration **364.97 ms** (milliseconds).
- **Criterion (AC-M1-17):** "The first call repeated (same values) → `200`, same platform, no new `grant_redeemed`."
- **Evidence** (redacted `service-logs`): connection `con_-R7GysmAldDXKoFBdHhUJA`, grant `grt_CvinaGi2dWckKum02T9aQQ`.
  - First PUT, trace `6ec9ef43…`: `grant_attempt_started` 02:23:45.209Z, LTI `POST /api/platforms` 201 and `PATCH` 200, `grant_redeemed` .215Z, `http_request PUT …/platform 200` .215Z.
  - The test takes `since = Date.now()` after that response and before the next request (`GET /__sim/records` at .217Z). The count of 1 needs `since ≤ .215Z`, so `since` is exactly .215Z.
  - `eventsSince` counts `ts >= since` (`tests/acceptance/lib/lti.ts:209`), so it counted the first redemption.
  - Repeat PUT, trace `4efb6d9b…`: one `http_request PUT …/platform 200` at .226Z. It has no `grant_*` line, no `outbound_request` and no LTI service line. The gate logged zero events while the all-method pass rules were armed. `noRemoteCall` and the same-platform check passed.
  - In the whole round log this grant has only `grant_issued`, `grant_attempt_started` and one `grant_redeemed`. Of 179 redeemed grants, none has two `grant_redeemed` lines.
- **Classification:** QA test-oracle defect in this worker's file. It is a same-millisecond inclusive time window: the same class as `M1-20.canvas.repeat` (§13.2, repaired at `8138097`). That repair missed this sibling case. The logs show no product defect: the repeat met all three AC-M1-17 expectations.
- **Other cursors:** all other Canvas `since = Date.now()` uses count another event type or id, or test only presence. None can count its own earlier request's line. Read-only check: `M1-28.blackboard.positive` takes `since` before the grant and expects the count to stay 1.
- Diagnosis record: `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-a784522-wgLHNZc0/diag/m1-r1-sim/M1-17.canvas.repeat-diagnosis.json`.

### 14.3 Authorized repair (held, not run)

Lead authorized one case in one file in `msg_415316b9ae64`. The change record is `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-a784522-wgLHNZc0/repair-m1-17/test-id-change-record.md`.

- `M1-17.canvas.repeat` now uses line counts, not a time window. First, a completed later `GET` of the connection is a same-process barrier (the `attemptBaseline` pattern). Then the connection must have exactly one `grant_redeemed` line, for its grant. The repeat runs inside the unchanged `noRemoteCall`, with the unchanged `200` and same-platform assertions, then waits for its own completion (`completed(again, 'PUT')`). After that, the connection's `grant_redeemed` count must not increase.
- Case id, title, manifest and inventory are unchanged. There is no sleep and no slack. No assertion became weaker, and the baseline-is-one check is new.
- Held file SHA-256: `888fd4c2e9814defd9ac8912a330122a2eac0ac596f9c18128081613a4240ed0` (was `e2ac98119df268f48aa439c2b36fe1e46c45c907786e92bed5a16603d213e262`). Patch: `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-a784522-wgLHNZc0/repair-m1-17/held.patch` (8 insertions, 2 deletions; `git diff --check` clean).

Evidence (harness and synthetic only):
- In a scratch clone of `a784522` with the patch, `run-m1.mjs --harness-only --provider canvas` and the all-provider run each pass 70/70 self-checks with zero skips, plus typecheck and discovery. Canvas selection: 251 API + 96 host rows. All providers: 392 API + 96 host rows. Both give 488 rows per round (`sim` 394, `snapshot-isolated` 6, `snapshot-upgrade` 6, `migration` 12, `storage` 70) and 233 Canvas rows, unchanged.
- `m1-17-controls.mjs` compiles the exact `readLog`, `redeemedLines` and `eventsSince` sources and runs the old and new assertions on synthetic logs. Results:
  - The observed same-millisecond sequence: the old oracle gives FAIL, which reproduces the run; the new oracle gives PASS.
  - A later same-millisecond `grant_redeemed` of the same grant, or of another grant of the connection: FAIL.
  - Another connection's redemption in the same millisecond: PASS.
  - A first call with zero, two or another grant's redemption line: FAIL.
  - A malformed line: BLOCKED. A partial last line: tolerated.
  - All 10 controls behave as stated. Output: `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-a784522-wgLHNZc0/repair-m1-17/m1-17-controls-output.json`.

No product edit, stack, Docker diagnostic or partial product run. The repair needs a Lead commit, a new reviewed freeze and fresh runs of both complete M1 rounds, legacy, M2 and T7 at that SHA. `a784522` stays a recorded failed attempt.

## 15. Round 9 — candidate `55c33a3`: round 1 Canvas rows complete, round incomplete (2026-10-21)

**HOLD. No M1 acceptance credit.** Candidate product = test `55c33a3e2d60670b5e759a79144c96bd213fca1f`. It is `a784522` plus the §14.3 repair; services, apps, packages and infra trees are unchanged. Common QA ran the full documented M1 entry (`run-m1.mjs`, phase `full`).

Round 1 results:
- **SIM** passed 394/394 (run `qa-multi-r1-55c33a3e-2026-10-21T03-25-15-066Z`).
- **snapshot-isolated** passed 6/6 (run `qa-multi-r1-55c33a3e-2026-10-21T03-48-17-759Z`).
- **snapshot-upgrade** stopped at `M1-38.common.h1` (seed on `011`), run `qa-multi-r1-55c33a3e-2026-10-21T03-49-53-008Z`. Common QA reports a common-oracle issue: each `canvasPlay` makes a new `resourceLinkId`, but the oracle expects a stable `serviceKey`. No product defect is shown. Common QA owns that case.
- The migration and storage phases of round 1, all of round 2 and legacy did not run.

Artifact root (public): `/Users/quangnguyen/cogniate-qa-runs/m3-frozen-55c33a3-20261021T0315Z/source/tests/host/artifacts/`. This worker had no stack. It read only completed public artifacts and the completed SIM phase clone.

### 15.1 Independent Canvas judgement (round 1, two Canvas phases)

The judge is the approved `canvas-judge-round-v2.mjs` (manifest `1af4609e…`). It first runs the unchanged v1 judge, then the sink-capture gate.

| Gate | Result |
| --- | --- |
| Canvas rows (v1) | **233/233 PASS**: SIM 232 (225 API + 7 browser), including `M1-17.canvas.repeat`; snapshot-isolated 1 (`M1-37.canvas.aa`). Runner and raw reports agree. Each row has one result and no retry. Product = test = `55c33a3`, label `SIM`, provider `all`. App and LTI health `default` after each phase. |
| Scan records | SIM: 0 hits (Common reports 1,300 captured values plus 12 stack values over 680 public files). snapshot-isolated: 10 values, 65 files, 0 hits. |
| Sink gate (AC-M1-12, four cases) | **PASS.** `sink.jsonl` SHA-256 `b05a2e010b3055fcba7b61db28b81e0d93013f796f245ef4d22d106bc983b9ca`: 2 complete lines with a trailing newline. Lifetime `boot-f6d6338e22f2`: 03:26:03.386Z to 03:48:01.274Z, inside the run. `ags-lineitems`, `ags-lineitem-evil`, `nrps` and `dl-return` each ran once and passed, in `21-canvas-protocol.test.ts`, inside 03:26:16.995Z to 03:26:24.980Z. 0 `sink_hit` in the lifetime. |
| Canvas browser artifacts (AC-M3-07) | Independent scan with 1,316 values from the completed SIM phase clone (`.env`, `infra/.secrets`, capture files). 15 screenshots: **0 hits**. Two were inspected visually; they show no capability and no approval input. 14 trace zips (7 distinct traces): 124 hits, as expected for raw traces; they stay private and are named only by location and hash. |
| Round completeness (AC-M3-01) | **Not met.** Round 1 snapshot-upgrade is incomplete: one FAIL (`M1-38.common.h1`) and five rows not run. The migration and storage phases did not run, and round 2 did not run. The same-result rule of two rounds cannot be checked. |

Records (evidence root `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-55c33a3-o05nHi07`):
- `judge/round1/judge-v2-r1-sim-isolated.json`
- `judge/round1/judge-v2-sim-interim.json` and `sim-input-hashes.txt`
- `scan/r1-sim-canvas-browser-scan.json` (counts only) and `scan/r1-sim-canvas-browser-files.sha256`

Permission facts, observed and not changed: the completed SIM phase clone and its `tests/acceptance/artifacts` folders are mode 0755. `captured-secrets.jsonl` there is 0644 and holds raw values; `m1-secrets.raw.jsonl` is 0600. The home folder is 0750 with an ACL. Common QA owns these files.

### 15.2 Disposition

- Canvas M1 at `55c33a3`: round 1 Canvas rows 233/233 PASS (partial evidence), sink gate PASS, browser screenshots clean. **Overall HOLD.** AC-M3-01 needs two complete matching 488-row rounds at one SHA.
- `a784522` stays a recorded failed attempt (§14). No PASS carries from it or from `aff4882`.
- A proper retry follows a new reviewed freeze that includes Common QA's oracle repair. Then both complete rounds must be judged again with the same tools.

## 16. Round 10 — candidate `82e2dab`: round 1 Canvas rows complete again, round incomplete (2026-10-21)

**HOLD. No M1 acceptance credit.** A new Claude QA-E2E session (Orca session `95d4c010-ef6d-4f58-87fe-7a686ec36424`) wrote this round. It did not execute rounds 1–9. Their provenance stays as written above.

Candidate product = test `82e2dab6d26915c90070a4aae8ac0c4472706c2d` (tests tree `51b2e50e2ed02efd4553c4b09c2c4b0d28d624c5`). It is `55c33a3` plus Common QA's two-line repair in `tests/acceptance/M1/common/snapshot-migration.probe.ts` (SHA-256 `4b1276328f35…6d3`). Product files equal `a784522`. Lead authority: `msg_40eca66674cd`. Mask and checkout rules: `msg_aea8cd9e30e0`, `msg_f132bffe54dc`, `msg_9ee0ecb9d2e6`. Closure: `msg_24bc463c9067`.

Common QA ran the full documented M1 entry from 04:29:22Z, after W1–W3 passed. Round 1:
- **SIM** passed 394/394 (run `qa-multi-r1-82e2dab6-2026-10-21T04-29-22-551Z`).
- **snapshot-isolated** passed 6/6 (run `qa-multi-r1-82e2dab6-2026-10-21T04-52-21-763Z`).
- **snapshot-upgrade:** the repaired `M1-38.common.h1` passed. Then the runner exited 1 at 04:55:18Z. Common QA reports that its host `inspectBackup` collector expects an array, but the per-database migrations record is an object. No product defect is shown. Common QA owns this collector.
- The rest of snapshot-upgrade, the migration and storage phases, all of round 2 and legacy did not run.

Common QA reports a strict W4 comparison PASS and zero owned resources after cleanup. This worker started no stack, no wake container and no Docker diagnostic. It read the Docker client binary hashes, the completed public artifacts and the capture files of the completed SIM phase clone.

### 16.1 Preparation (host only)

- Evidence root `R` = `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-82e2dab-EphODiew`, made under umask 077: every folder 0700, every file 0600. `R/source` is a fresh `--no-hardlinks` detached clone of the exact SHA with an empty status.
- Approved tool bytes come from the `55c33a3` root. First, both original manifests were checked: R4 `0f5b1e9c…` 22/22 and sink-v2 `1af4609e…` 4/4. Then the relocated `55c33a3` manifests were checked: `63b96bce…` and `4cb2eb90…`. The new relocated manifests are `R/tools/tool-hashes-r4-abs.sha256` (`1766bd7d…`, 22 OK) and `R/tools/tool-hashes-sink-ext-abs.sha256` (`a2bb0430…`, 4 OK). All six tool self-tests reproduce their stored outputs.
- Harness only: `run-m1.mjs --harness-only` gives 70/70 for `canvas` and for `all`, with 488 rows per round (sim 394, snapshot-isolated 6, snapshot-upgrade 6, migration 12, storage 70). The Canvas manifest has 233 rows. `run-m2.mjs --harness-only` gives 6/6 and 64 cases. The T7 list has 18 tests in 6 files.
- Umask observation: under umask 077, the Common self-check "planted changes are exact…" in `storage-fixture-script.selftest.mjs` fails (69/70, `Mode kept 384 !== 416`), because it writes a 0640 file. Under umask 022 it passes (70/70). Both logs stay in `R`. This is an effect of the environment, not a product result.
- The G-1 client identities match the bound table: macOS 27.0.1 arm64, Docker CLI 29.9.1 `67827118…`, Compose v5.6.0 `1ec06408…`.

### 16.2 Independent Canvas judgement (round 1, two Canvas phases)

The judges are the unchanged approved `canvas-judge-round.mjs` (v1) and `canvas-judge-round-v2.mjs` (sink gate).

| Gate | Result |
| --- | --- |
| Canvas rows (v1) | **233/233 PASS**: SIM 232 (225 API + 7 browser); snapshot-isolated 1 (`M1-37.canvas.aa`). Runner and raw reports agree. Each row has one result and no retry. Product = test = `82e2dab`, label `SIM`, provider `all`. App and LTI health `default` after each phase. |
| Scan records | SIM: 1,300 values, 637 files, 0 hits. snapshot-isolated: 10 values, 65 files, 0 hits. |
| Sink gate (AC-M1-12, four cases) | **PASS.** `sink.jsonl` SHA-256 `391b31b2f164…f7a8`: 2 complete lines with a trailing newline. One lifetime `boot-e09d8ecd64fc`, 04:30:05.777Z to 04:52:05.365Z. It starts after the run start and stops before the identity time (04:52:15.816Z). `ags-lineitems`, `ags-lineitem-evil`, `nrps` and `dl-return` each ran once and passed in `21-canvas-protocol.test.ts`; the raw file interval is 04:30:19.392Z to 04:30:27.027Z. 0 `sink_hit`. |
| Canvas browser artifacts (AC-M3-07) | 1,316 values from the completed SIM phase clone: 9 `.env`, 8 secrets-file and 1,299 capture values. 15 screenshots (9 distinct): **0 hits**. QA inspected all 9 distinct screenshots visually: they show no token, capability or approval input. The two refused-frame screenshots are blank by design. 14 trace zips (7 distinct): 120 hits in 7 files, as expected for raw traces. They stay private and are named only by location and hash. |
| Round completeness (AC-M3-01) | **Not met.** Round 1 stopped in snapshot-upgrade. The migration and storage phases and round 2 did not run, so the same-result rule of two rounds cannot be checked. |

Records in `R`:
- `judge/round1/judge-v1-sim-isolated.json` (`edb794e0…`) and `judge/round1/judge-v2-sim-isolated.json` (`d0784044…`)
- `judge/round1/judge-v1-sim-interim.json` and `judge/round1/judge-v2-sim-interim.json` (SIM phase alone)
- `scan/r1-sim-canvas-browser-scan.json` (`f95475f7…`, counts only) and `scan/r1-sim-canvas-browser-files.sha256`

Inputs: SIM `m1-case-results.json` `9ae24368…` and `m1-identity.json` `0517b508…`; snapshot-isolated `m1-case-results.json` `ce4f5770…`.

### 16.3 Disposition

- Canvas M1 at `82e2dab`: round 1 Canvas rows 233/233 PASS, sink gate PASS and clean screenshots. This is partial evidence. **Overall HOLD**; this dispatch settles as failed.
- `55c33a3`, `a784522` and `aff4882` keep their own records. No PASS carries from one candidate to another.
- Next: Common QA repairs its host collector under a new reviewed freeze. Then both complete rounds run. QA-E2E runs both judges again over all five phase artifacts of each round and compares the two rounds.

## 17. Round 11 — candidate `51a80b5`: round 1 Canvas rows complete, round 1 stopped in snapshot-upgrade (2026-10-21)

**HOLD. No M1 acceptance credit. This dispatch settles as failed.** A new Claude QA-E2E session (`claude-opus-5-5`, xhigh; Orca session `07499b81-08f3-49dd-8576-2057a21a95ac`) wrote this round. It did not execute rounds 1–10. Their provenance stays as written above.

Candidate product = test `51a80b51de2c7491466a21a678418ff8178d247d` (tests tree `a47b34cd56bb3d85e4c3ef1cafef0a2b0c3210c0`). It is `82e2dab` plus Common QA's backup-oracle repair: `tests/host/m1-migration.mjs` (SHA-256 `1be7c1c9…6cc75`) and its self-test (`20745f2a…fe5a`). The `services`, `apps`, `packages` and `infra` trees equal `a784522`. Lead authority: `msg_3fc90776b450` (host only), run start `msg_cc57744668aa`, closure `msg_229e86b15fd5`.

Common QA ran the full documented M1 entry from 05:30:48Z, after W1–W3 passed. Round 1:
- **SIM** passed 394/394 (run `qa-multi-r1-51a80b51-2026-10-21T05-30-48-841Z`).
- **snapshot-isolated** passed 6/6 (run `qa-multi-r1-51a80b51-2026-10-21T05-54-07-197Z`).
- **snapshot-upgrade** (run `qa-multi-r1-51a80b51-2026-10-21T05-55-43-894Z`): the seed `M1-38.common.h1` and `h2`, `h3`, `h5` passed; `M1-38.common.h4` failed. The runner recorded `ERROR` and exited 1 at 05:57:35Z.
- The migration and storage phases of round 1, all of round 2 and legacy did not run.

Separate outer-environment failure (Common QA final status, relayed in `msg_f0f6b9e20bf6`): the W4 capture passed, but the W4 strict comparison **FAILED**. A new unrelated anonymous volume (`d5df35bd…`, CreatedAt 05:32:46Z) appeared. Common's sampler also saw six non-lane `fgw-*` containers during the window; they were gone at W4. No attribution is established, and the unrelated volumes are preserved. The seven protected volumes, the W3 anonymous volume, the networks, the Docker settings and the engine match. Zero containers remained at cleanup. Common's privacy scan found 0 hits in 33 raw logs and 879 public files. This worker made no Docker daemon call in this dispatch. Its only Docker binary calls were the client-only `docker --version` and `docker compose version --short` (G-1, at about 05:27:5xZ).

### 17.1 Preparation (host only)

- Evidence root `R` = `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-51a80b5-KfIjrKmn`. `R` and its folders are 0700; logs and records are 0600. `R/source` is a fresh `--no-hardlinks` clone under umask 022 into a pre-made 0700 folder, detached at the exact SHA, with an empty `status --porcelain --ignored`. Record: `R/notes/prep.json` (`a32064d9…`), with the path and mode chain.
- Tool bytes: the original manifests were checked first (R4 `0f5b1e9c…` 22/22, sink-v2 `1af4609e…` 4/4), then the relocated `82e2dab` manifests (`1766bd7d…`, `a2bb0430…`). The relative path and content lists are identical. The new relocated manifests are `R/tools/tool-hashes-r4-abs.sha256` (`6cc77937…`, 22 OK) and `R/tools/tool-hashes-sink-ext-abs.sha256` (`852fff8e…`, 4 OK). All six tool self-tests reproduce their stored outputs (`R/notes/tool-selftests/compare.txt`).
- Harness only, under umask 022: `run-m1.mjs --harness-only` gives 71/71 for `canvas` and for `all`. Each round has 488 rows (sim 394, snapshot-isolated 6, snapshot-upgrade 6, migration 12, storage 70). The Canvas manifest has 233 rows: 225 API and 7 browser in `sim`, 1 API in `snapshot-isolated`. `run-m2.mjs --harness-only` gives 6/6 and 64 cases. The T7 list has 18 tests in 6 files.
- G-1 client identities (binary hashes, no daemon call): macOS 27.0.1 arm64, Docker CLI 29.9.1 `67827118…`, Compose 5.6.0 `1ec06408…`. They equal the bound table.

### 17.2 Independent Canvas judgement (round 1, two Canvas phases)

The judges are the unchanged approved `canvas-judge-round.mjs` (v1) and `canvas-judge-round-v2.mjs` (sink gate), run under umask 077.

| Gate | Result |
| --- | --- |
| Canvas rows (v1) | **233/233 PASS**: SIM 232 (225 API + 7 browser); snapshot-isolated 1 (`M1-37.canvas.aa`). Runner and raw reports agree. Each row has one result and no retry. Product = test = `51a80b5`, label `SIM`, provider `all`. App and LTI health `default`, no knobs, LTI `simulation_profiles: []` after each phase. |
| Scan records | SIM: 1,300 values, 637 files, 0 hits. snapshot-isolated: 10 values, 65 files, 0 hits. |
| Sink gate (AC-M1-12, four cases) | **PASS.** `sink.jsonl` SHA-256 `b3acfbd6…bb74d`: 2 complete lines with a trailing newline. One lifetime `boot-996790377305`, 05:31:33.131Z to 05:53:50.616Z. It starts after the run start (05:30:48.841Z) and stops before the identity time (05:54:01.108Z). `ags-lineitems`, `ags-lineitem-evil`, `nrps` and `dl-return` each ran once and passed in `21-canvas-protocol.test.ts`; the raw file interval is 05:31:46.571Z to 05:31:54.233Z. 0 `sink_hit`. |
| Canvas browser artifacts (AC-M3-07) | 1,316 values from the completed SIM phase clone: 9 `.env`, 8 secrets-file and 1,299 capture values. 15 screenshots (6 distinct): **0 hits**. QA inspected all 6 distinct screenshots visually: 4 player pages, 1 framed embedded page and 1 blank refused third-host frame. They show no token, capability or approval input. 14 trace zips (7 distinct): 124 hits in 7 files, as expected for raw traces. They stay private and are named only by location and hash. |
| Round completeness (AC-M3-01) | **Not met.** Round 1 stopped in snapshot-upgrade with one FAIL. The migration and storage phases and round 2 did not run, so the same-result rule of two rounds cannot be checked. |

Records in `R`:
- `judge/round1/judge-v1-sim-interim.json` (`da7bc6c1…`) and `judge/round1/judge-v2-sim-interim.json` (`884f2943…`): SIM phase alone, kept unchanged. Their only problem is the missing `snapshot-isolated` artifact at that time.
- `judge/round1/judge-v1-sim-isolated.json` (`6eed44b5…`) and `judge/round1/judge-v2-sim-isolated.json` (`2cbe2da5…`).
- `judge/round1/sim-interim-record.json` (`aadd5cf9…`), with input hashes.
- `scan/r1-sim-canvas-browser-scan.json` (`4266d62f…`, counts only) and `scan/r1-sim-canvas-browser-files.sha256`.

Inputs: SIM `m1-case-results.json` `1e7fa2fd…` and `m1-identity.json` `649c2162…`; snapshot-isolated `m1-case-results.json` `09a0205f…` and `m1-identity.json` `3e03acbb…`.

### 17.3 The snapshot-upgrade failure: `M1-38.common.h4` (Common-owned case)

QA-E2E read only the redacted artifacts and the frozen source. Common QA owns the case, its oracle and the host control. Lead accepted this diagnosis as a reported Common-harness defect (`msg_229e86b15fd5`). Common QA confirmed the replay cause independently (`msg_1b76a14fcad1`, relayed in `msg_f0f6b9e20bf6`) and owns the repair.

- **Assertion:** `snapshot-oracle.mjs:39` (`auditWindow`): "Scoped committed phase-1 event count", `0 !== 1`. It is in the seeded iteration of `redeemedWithOneAttempt`.
- **Evidence** (`cogniate-app.jsonl` and `host-actions/`):
  - 05:56:38.232Z, seed on `011`: `grant_issued` for the add grant of Canvas connection `con_9nO…` (`state.add`).
  - 05:57:02.396Z to .406Z: seven `m1-cli` host actions start at the same time. The upgrade test file starts later, at 05:57:13.002Z. The seven calls equal the seven CLI calls of the `h1` seed, one for one. One of them is `app:grant issue --purpose add_deployment` for `con_9nO…`; it exits 0.
  - 05:57:03.031Z: a second `grant_issued` (`add_deployment`) for `con_9nO…`.
  - 05:57:17.439Z, `h4`: `POST …/deployments` answers 403. The app logs `grant_rejected {reason: revoked}` and no `grant_attempt_started`.
- **Cause:** `tests/host/m1-control.mjs` keeps the answered request names only in an in-memory set. It never removes `req-m1-*.json` from `<clone>/tests/acceptance/artifacts/control`. `run-m1.mjs` `suite()` (line 277) starts a new host control for each suite. The seed and upgrade suites use one clone and one control folder. So the upgrade-stage host control ran every seed request again against the `012` stack. The replays also replaced the seed-time `host-actions/<id>.json` records.
- **Product check:** app contract §4.8 says that a new grant for the same connection and purpose revokes older unredeemed ones. §4.7.1 phase 1 rejects a revoked grant with `403 GRANT_INVALID` and `grant_rejected {reason: revoked}`, and logs no attempt. The product followed the contract.
- **Classification:** QA harness defect in Common-owned files. No product defect is shown. `h2`, `h3` and `h5` passed after the replay. The replayed `initial` issues exited 1 and store nothing; the `list` calls only read.
- **Exposure:** `storage-rows.mjs:416` also starts a host control for each lane. Common QA owns the repair and its scope.
- Record: `R/diag/m1-r1-snapshot-upgrade/M1-38.common.h4-diagnosis.json` (`2902e588…`).

### 17.4 Disposition

- Canvas M1 at `51a80b5`: round 1 Canvas rows 233/233 PASS, sink gate PASS and clean screenshots. This is partial evidence. **Overall HOLD**; this dispatch settles as failed.
- Not achieved at this candidate: a complete round 1, round 2, the round comparison, legacy, M2 and T7. No runtime window was transferred to QA-E2E.
- The W4 strict comparison failure is a separate outer-environment FAIL of this attempt. The partial Canvas PASS does not become full acceptance.
- `82e2dab`, `55c33a3`, `a784522` and `aff4882` keep their own records. No PASS carries from one candidate to another.
- Next: Common QA repairs the host-control replay under a new reviewed freeze, and the outer-environment change is resolved or attributed. Then both complete rounds run, and QA-E2E runs both judges over all five phase artifacts of each round and compares the two rounds.

## 18. Round 12 — candidate `9cdd768`: round 1 Canvas rows complete, round 1 failed in storage (2026-10-21)

**HOLD. No M1 acceptance credit. The full attempt failed.** A new Claude QA-E2E session (`claude-opus-5-5`, xhigh; Orca session `d892992a-032c-4693-b6ac-3e8359c10af3`) wrote this round. It did not execute rounds 1–11. Their provenance stays as written above.

Candidate product = test `9cdd7687b91169a262648018ec6945efa31217dc` (tests tree `eccd4b50aa9c0ef6a25ce7d95fd383c0f3ad817e`). It is `51a80b5` plus Common QA's host-control replay repair: `tests/host/m1-control.mjs` (SHA-256 `21baa87d…a99d06`) and its self-test (`4473c993…aa323`). The `services`, `apps`, `packages` and `infra` trees and the root build files equal `a784522`. Canvas, M2 and Canvas simulator tests did not change from `51a80b5`. Lead authority: `msg_320a8f66e700` (host-only preparation), `msg_a867b85d536b` (host-only judge of Common's phases) and `msg_3ea5c8fe52fd` (record the failure). Common retry `ctx_9e877dcb4b10` held the only Docker window. This worker ran no Docker daemon command. Its only Docker binary calls were the client-only `docker --version` and `docker compose version --short`.

Common QA ran the documented full M1 entry. W3 live time is 2026-10-21T07:09:19.299Z (`runStartSecond` 1792566559). Round 1:
- **SIM** passed 394/394 (run `qa-multi-r1-9cdd7687-2026-10-21T07-09-22-264Z`).
- **snapshot-isolated** passed 6/6 (run `qa-multi-r1-9cdd7687-2026-10-21T07-32-20-230Z`).
- **snapshot-upgrade** passed 6/6, including `M1-38.common.h1`–`h5` (run `qa-multi-r1-9cdd7687-2026-10-21T07-33-55-800Z`). Common reports 33 host-control requests, 33 acknowledgements and no replay.
- **migration** passed 12/12 (run `qa-multi-r1-9cdd7687-2026-10-21T07-35-46-368Z`).
- **storage** (lane `qa-multi-r1-st`, run `qa-multi-r1-st-9cdd7687-2026-10-21T07-39-36-550Z`): 1 PASS and 69 FAIL of the 70 required rows. The runner exited 1 at 07:40:46Z.
- Round 1 total: 419 PASS and 69 FAIL of 488 required rows. Round 2 and legacy did not run.

The Lead reports that Common's W4 end boundary and strict comparison passed. Common's scan found 0 hits for 1,466 + 53 captured values in 45 raw and 1,096 public files. Raw traces stay private.

### 18.1 Preparation (host only)

- Evidence root `R` = `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-9cdd768-mVjZIekp`, made with `mktemp -d` under umask 077. `R` and its folders are 0700; files outside `R/source` are 0600. Shared ancestors were not changed.
- `R/source` is a `--no-hardlinks --no-checkout` clone under umask 022 into a pre-made 0700 folder, detached at the exact SHA. It has 0 status lines, no `.env`, no root `node_modules` and a disabled push URL.
- Tool bytes: the original manifests (`0f5b1e9c…` 22/22, `1af4609e…` 4/4) and the predecessor manifests (`6cc77937…` 22/22, `852fff8e…` 4/4) were checked first. The copies are byte-identical to the original root. The relocated manifests are `2ae9b22e…` (22 OK) and `2bba4a92…` (4 OK). All six tool self-tests reproduce their stored outputs.
- Harness only, under umask 022: `run-m1.mjs --harness-only` gives 73/73 for `canvas` and for `all`, with typecheck PASS. Each round has 488 rows (sim 394, snapshot-isolated 6, snapshot-upgrade 6, migration 12, storage 70). The Canvas manifest (`c4974629…`) has 233 rows: 225 API and 7 browser in `sim`, 1 API in `snapshot-isolated`. `run-m2.mjs --harness-only` gives 6/6 and 64 cases. The T7 list has 18 tests in 6 files.
- G-1 client identities (no daemon call): macOS 27.0.1 arm64, Docker CLI 29.9.1 `67827118…`, Compose 5.6.0 `1ec06408…`. They equal the bound table.
- Handoff `R/notes/handoff.md` (`4a0a1b5e…`) and record `R/notes/prep.json` (`c95e1bbb…`). The Lead verified and accepted them (`msg_aa95f18bcc73`). They give no runtime credit.

### 18.2 Independent Canvas judgement (round 1)

The judges are the unchanged approved `canvas-judge-round.mjs` (v1) and `canvas-judge-round-v2.mjs` (sink gate), run under umask 077 against the Common artifacts, read only. All input hashes equal Common's completion notices (`msg_9e5152bafe12`, `msg_1760a953edfe`).

| Gate | Result |
| --- | --- |
| Canvas rows (v1) | **233/233 PASS**: SIM 232 (225 API + 7 browser); snapshot-isolated 1 (`M1-37.canvas.aa`). 0 FAIL, BLOCKED, SKIP or MISSING. Each row has one result. Product = test = `9cdd768`, label `SIM`, provider `all`. App and LTI health `default`, no knobs, LTI `simulation_profiles: []` after both phases. |
| Scan records | SIM: 1,300 values, 637 files, 0 hits. snapshot-isolated: 10 values, 65 files, 0 hits. |
| Sink gate (AC-M1-12, four cases) | **PASS.** `sink.jsonl` SHA-256 `07ea7125…3e02`: 2 complete lines with a trailing newline. One lifetime `boot-c09b2ab64a7f`, 07:10:06.118Z to 07:32:03.848Z. It starts after the run start (07:09:22.264Z) and stops before the identity time (07:32:14.224Z). `ags-lineitems`, `ags-lineitem-evil`, `nrps` and `dl-return` each ran once and passed in `21-canvas-protocol.test.ts`; the file interval is 07:10:19.495Z to 07:10:26.946Z. 0 `sink_hit`. |
| Canvas browser artifacts (AC-M3-07) | 1,316 values from the SIM phase clone: 9 `.env`, 8 secrets-file and 1,299 capture values. 15 screenshots (6 distinct): **0 hits**. QA inspected all 6 distinct screenshots visually: 4 player pages (3 "Not started", 1 "Completed — score 70 sent to Canvas"), 1 framed embedded page ("Open in a new window") and 1 blank refused third-host frame. They show no token, capability or approval input. 14 trace zips (7 distinct): 120 hits in 7 files, as expected for raw traces. They stay private and are named only by location and hash. |
| Round completeness (AC-M3-01) | **Not met.** Round 1 failed in the storage phase. Round 2 did not run, so the same-result rule of two rounds cannot be checked. |

Inputs: SIM `m1-case-results.json` `cdf59d9c…`, `m1-identity.json` `195c0184…`, `m1-vitest-results.json` `e31999bb…`, `playwright-results.json` `4b8f46e6…`; snapshot-isolated `m1-case-results.json` `94efcd76…`, `m1-identity.json` `27bb5ffd…`. Cross-check: Common's round-1 row record (`round-1-rows.json`, `ea0b02dc…`, 488 rows; `msg_d6729b90ce8e`) has the same 233 Canvas ids, all PASS. The snapshot-upgrade, migration and storage phases hold no Canvas rows.

Records in `R`:
- `judge/round1/judge-v1-sim-interim.json` (`dd489d78…`) and `judge/round1/judge-v2-sim-interim.json` (`cf021190…`): SIM phase alone, kept unchanged. Their only problem is the missing `snapshot-isolated` artifact at that time.
- `judge/round1/judge-v1-sim-isolated.json` (`83cdb0c2…`) and `judge/round1/judge-v2-sim-isolated.json` (`e4d62962…`).
- `judge/round1/sim-interim-record.json` (`f12bc3a1…`) and `judge/round1/round1-canvas-record.json` (`2a2c8599…`), with input hashes.
- `scan/r1-sim-canvas-browser-scan.json` (`24eb07ad…`, counts only) and `scan/r1-sim-canvas-browser-files.sha256`.

### 18.3 The storage failure (Common-owned rows)

QA-E2E read only the redacted artifacts, the storage clone's folder metadata and the frozen source. Common QA owns these rows, their oracles and the classification. The Lead forwarded this first diagnosis to Common QA (`msg_3ea5c8fe52fd`). Common QA confirmed all three causes independently from the same records (`msg_d6729b90ce8e`): `c-selftest` and `a-fresh` are common-harness defects; the cause of the `e-old-schema` import failure is not established. Record: `R/diag/m1-r1-storage/storage-r1-diagnosis.json` (`a6cf303e…`).

| Row | Evidence | First classification |
| --- | --- | --- |
| `M1-41.common.c-selftest` | The probe exits 2: "selftest needs an existing empty folder". The harness passes `--folder self=/tmp/qa-selftest-<hex>` (`storage-rows.mjs:247-249`) and does not make that folder in the container. The probe requires an existing empty folder (`sqlite-lock-probe.mjs:521`). ADR-012 §11 gives QA the job to make a new folder in the container's writable layer. | Likely a Common harness defect |
| `M1-41.common.a-fresh` | "Preflight pass is logged before the first service container is created" fails. `preflightOf()` (`storage-oracle.mjs:42`) takes the last summary line. On a first start, `stack:up` logs the `check --prepare` summary at 07:40:09.248Z and, after `dc up --wait`, the `mark-started` summary at 07:40:39.035Z. This is the order of the ADR-012 guarded-path table. The oracle compares the `mark-started` line. | Likely a Common oracle defect |
| `M1-41.common.e-old-schema` (import half) | `stack:data-import` exits 1 with a Docker daemon error: the bind source `infra/.data/cogniate-app/packages` does not exist. It does not give the `content_missing` refusal. `stack-data.sh:75` calls `prepare_content_folders` (`lib.sh:351`) before the storage run. The folder exists now with a modification time in the same second as the import lock (07:40:45.786Z), just after `stack:reset` removed it. | Not established: Docker Desktop file-sharing visibility of a just-made host folder, or a product robustness gap |

All other failed rows say "not run: prerequisite … did not pass" (from `a-fresh` and `@seed`). `ERROR` is the runner's required-case check on `a-fresh`. `M1-41.common.c-host-negative` passed (`fakeowner`, `lock_not_enforced`).

### 18.4 Disposition

- Canvas M1 at `9cdd768`: round 1 Canvas rows 233/233 PASS, sink gate PASS and clean screenshots. This is partial evidence. **Overall HOLD**; the full attempt failed.
- Not achieved at this candidate: a complete round 1, round 2, the round comparison, legacy, M2 and T7. No runtime window was transferred to QA-E2E.
- `51a80b5`, `82e2dab`, `55c33a3`, `a784522` and `aff4882` keep their own records. No PASS carries from one candidate to another.
- Next: Common QA repairs the two harness defects, and the import failure is diagnosed (environment or product). Repairs go through a new reviewed freeze. Then both complete rounds run, and QA-E2E runs both judges over each round and compares the two rounds.

## 19. Round 13 — candidate `aaa823b`: round 1 Canvas rows complete, round 1 failed in storage (2026-10-21)

**HOLD. No M1 acceptance credit. The full attempt failed.** A fresh Claude QA-E2E session (`claude-opus-5-5`, xhigh; Orca session `c9188d79-d5a7-4ab0-bc62-ac27e61ff412`) wrote this round. It did not execute rounds 1–12. Their provenance stays as written above.

Candidate product = test `aaa823b25306c5e560f7c4050238b374dec4d4e3` (tests tree `4c7e067feedc644f955afee37806f06e7273dd04`). It is `9cdd768` plus the storage-harness repair `0e83e3c`, the reset repair `89fb4b4` and the content-refusal repair `aaa823b`. Non-docs changes from `9cdd768`: `infra/README.md`, `infra/scripts/stack-data.mjs`, `infra/scripts/stack-reset.sh` (with a new `stack-reset.test.mjs`), `services/lti-service/src/cli/stack-data.test.ts`, and the Common-owned `tests/host/storage-oracle.mjs`, `storage-rows.mjs` and their self-tests. Canvas, M2, T7 and simulator tests, `apps`, `packages` and the root build files did not change. Lead authority: `msg_570cd1eeaefd` (host-only preparation), `msg_ce27725ccc0d` (host-only judge of Common's phases) and `msg_6627a593581e` (record the failure). Common retry `ctx_b4253986bb55` held the only Docker window (`msg_a33783fa968c`). This worker executed no `docker` or `docker compose` binary at all; a PATH stub recorded 0 Docker calls during every host check.

Common QA ran the documented full M1 entry; the runner started at 10:54:48Z (`msg_77de10893829`). Round 1:
- **SIM** passed 394/394 (run `qa-multi-r1-aaa823b2-2026-10-21T10-54-48-482Z`).
- **snapshot-isolated** passed 6/6 (run `qa-multi-r1-aaa823b2-2026-10-21T11-17-41-577Z`).
- **snapshot-upgrade** passed 6/6, including `M1-38.common.h1`–`h5` (run `qa-multi-r1-aaa823b2-2026-10-21T11-19-17-179Z`).
- **migration** passed 12/12 (run `qa-multi-r1-aaa823b2-2026-10-21T11-21-08-271Z`).
- **storage** (lane `qa-multi-r1-st`, run `qa-multi-r1-st-aaa823b2-2026-10-21T11-24-56-069Z`): 20 PASS and 50 FAIL of the 70 required rows. The runner exited 1 at 11:36:48Z.
- Round 1 total: 438 PASS and 50 FAIL of 488 required rows. QA-E2E counted these from the five `m1-case-results.json` files. Round 2 and legacy did not run.

Common reports that its W4 end boundary, strict comparison, clone guard and secret scan finished at 11:37:11Z, and returned the window (`msg_e7b3059ffea0`). The Lead reports them as PASS (`msg_6627a593581e`). QA-E2E did not inspect them.

### 19.1 Preparation (host only)

- Evidence root `R` = `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-aaa823b-ktBOQB57`, made with `mktemp -d` under umask 077 at 10:41:49Z. Mode inventory at 11:42:51Z (`R/notes/mode-inventory.txt`, `edb3cac2…`; `stat` only, no `chmod`): `R` is 0700, and the top of `R/source` is 0700. Outside `R/source`, all 23 folders (including the run, private and tool folders) are 0700. Outside `R/source`, regular files are 0600, except three executables at 0700: the two Docker guard stubs (`private/stub-bin/docker`, `docker-compose`) and the session wait helper (`notes/scripts/wait-watch.sh`). Inside `R/source`, git clone, `npm ci` and the Playwright list ran under umask 022: 669 folders are 0755, files are 0644 or 0755 (executables), and one Playwright report file is 0664. Shared ancestors were not changed. Host tools ran with `TMPDIR` inside `R`.
- `R/source` is a `--no-hardlinks --no-checkout` clone under umask 022 into a pre-made 0700 folder, detached at the exact SHA. It has 0 status lines, no `.env`, no root `node_modules` and a disabled push URL.
- Independence disclosure: at about 10:39Z, before the Lead's first message reached this session, one broad `orca orchestration inbox --json` listing showed message payloads of the whole run. They included the already submitted summary payloads of both content-refusal reviewers (verdicts, counts and finding ids) and the subject of the Q1/Q2 Docker grant. No reviewer or QA report file was opened, and that content was not used. The Canvas criteria, cases and judge tools were frozen before this dispatch and did not change. This worker reported the exposure at once (`msg_6e50d2d5f439`); the Lead recorded it and kept the scope unchanged (`msg_1183c4e6ff3d`). All later inbox reads used only the exact worker handle.
- Tool bytes: the predecessor handoff (`4a0a1b5e…`) and manifests (`2ae9b22e…` 22/22, `2bba4a92…` 4/4) and the original manifests (`0f5b1e9c…` 22/22, `1af4609e…` 4/4) were checked first. `cp -p` copies are byte-identical (27/27 to the predecessor, 26/26 to the original root). The relocated manifests are `f2038b00…` (22 OK) and `5dd24a5a…` (4 OK). All six tool self-tests reproduce their stored outputs. No tool, oracle or wrapper byte changed.
- Harness only, under umask 022: `run-m1.mjs --harness-only` gives 77/77 for `canvas` and for `all`, with typecheck PASS. The four new self-checks are the `0e83e3c` storage-harness checks. Each round has 488 rows (sim 394, snapshot-isolated 6, snapshot-upgrade 6, migration 12, storage 70). The Canvas manifest (`c4974629…`) has 233 rows: 225 API and 7 browser in `sim`, 1 API in `snapshot-isolated`. `run-m2.mjs --harness-only` gives 6/6 and 64 cases. The T7 list has 18 tests in 6 files, identical to `9cdd768`.
- G-1 client identities by file hash only (no binary run): macOS 27.0.1 arm64, Docker CLI `67827118…`, Compose `1ec06408…`. They equal the bound table.
- Handoff `R/notes/handoff.md` (`a3af986a…`), record `R/notes/prep.json` (`6634dc80…`) and ledger `R/notes/prep-file-hashes.sha256` (`fcc103ac…`, 25 entries). The Lead verified and accepted them (`msg_ce27725ccc0d`). They give no runtime credit.
- Common's frozen source `/Users/quangnguyen/cogniate-qa-runs/m3-frozen-aaa823b-20261021T1040Z/source` was bound read only: HEAD `aaa823b…`, tests tree `4c7e067…`, 0 status lines, same Canvas manifest.

### 19.2 Independent Canvas judgement (round 1)

The judges are the unchanged approved `canvas-judge-round.mjs` (v1) and `canvas-judge-round-v2.mjs` (sink gate), run under umask 077 against the Common artifacts, read only. All input hashes equal Common's completion notices (`msg_79752e648fce`, `msg_3816b95c668e`, `msg_f0a0aaab3d75`, `msg_a4df578931ce`, `msg_295643a96c6e`).

| Gate | Result |
| --- | --- |
| Identity (all five phases) | Product = test = `aaa823b…` in every phase. Labels: `SIM` (sim, snapshot-isolated, snapshot-upgrade, storage), `MOODLE-LIVE` + `SIM` (migration). Provider `all`. |
| Canvas rows (v1, five phases) | **233/233 PASS**: SIM 232 (225 API + 7 browser); snapshot-isolated 1 (`M1-37.canvas.aa`). 0 FAIL, BLOCKED, SKIP or MISSING; no problems. Each row has one result. The other three phases hold no Canvas rows. App and LTI health `default`, no knobs, LTI `simulation_profiles: []` after the SIM, snapshot-isolated and storage phases. |
| Scan records | SIM: 1,300 values, 637 files, 0 hits. snapshot-isolated: 10 / 65 / 0. snapshot-upgrade: 118 / 85 / 0. migration: 38 / 79 / 0. storage: 0 values / 307 files / 0 hits. |
| Sink gate (AC-M1-12, four cases) | **PASS.** `sink.jsonl` SHA-256 `0f1e7674…77fc`: 2 complete lines with a trailing newline. One lifetime `boot-89295e8e9e39`, 10:55:31.721Z to 11:17:25.272Z. It starts after the run start (10:54:48Z) and stops before the identity time (11:17:35.675Z). `ags-lineitems`, `ags-lineitem-evil`, `nrps` and `dl-return` each ran once and passed in `21-canvas-protocol.test.ts`; the file interval is 10:55:45.168Z to 10:55:52.781Z. 0 `sink_hit`. |
| Canvas browser artifacts (AC-M3-07) | 1,316 values from the SIM phase clone: 9 `.env`, 8 secrets-file and 1,299 capture values. 15 screenshots (6 distinct): **0 hits**. QA inspected all 6 distinct screenshots visually: 1 framed embedded page ("Open in a new window"), 1 blank refused third-host frame, 3 player pages "Status: Not started" and 1 "Status: Completed — score 70 sent to Canvas". They show no token, capability or approval input. 14 trace zips (7 distinct): 124 hits in 7 files, as expected for raw traces. They stay private and are named only by location and hash. |
| Round completeness (AC-M3-01) | **Not met.** Round 1 failed in the storage phase. Round 2 did not run, so no round comparison is possible. |

Inputs: SIM `m1-case-results.json` `53394632…`, `m1-identity.json` `0959aa80…`, `summary.json` `fe6755db…`; snapshot-isolated `6ded3fb4…`, `4cce238e…`, `a42c0d93…`; snapshot-upgrade `627cd19c…`, `0d71ce2f…`, `9267ce47…`; migration `6d9395e5…`, `66fc85fb…`, `f00c9bda…`; storage `e3a4f381…`, `eb70904e…`, `81214d35…`.

Records in `R`:
- `judge/round1/judge-v1-sim-interim.json` (`1357bb3b…`) and `judge/round1/judge-v2-sim-interim.json` (`598b1518…`): SIM phase alone, kept unchanged. Their only problem is the missing `snapshot-isolated` artifact at that time.
- `judge/round1/judge-v1-sim-isolated.json` (`ea71a9aa…`) and `judge/round1/judge-v2-sim-isolated.json` (`7fef4c63…`).
- `judge/round1/judge-v1-round1-all5.json` (`235753bd…`) and `judge/round1/judge-v2-round1-all5.json` (`7fef4c63…`): all five phases.
- `judge/round1/sim-interim-record.json` (`68fa420c…`), `judge/round1/round1-canvas-record.json` (`c1d6a69f…`) and `judge/round1/round1-final-record.json` (`b3db0127…`), with input hashes.
- `scan/r1-sim-canvas-browser-scan.json` (`36043af5…`, counts only) and `scan/r1-sim-canvas-browser-files.sha256`.

### 19.3 The storage failure (Common-owned rows)

QA-E2E read only the redacted storage artifacts and, after the run, the storage clone's folder metadata. Common QA owns these rows, their oracles and the classification. This is a first look, not a classification.

| Root row | Evidence |
| --- | --- |
| `M1-41.common.a-serialize` | The assertion "Backup storage_lock_released logged" failed (9 s). |
| `d-mountpoint`, `d-content-folder`, `f-pairid`, `f-identity-missing`, `f-db-without-identity`, `f-project`, `f-half-pair` | "QA fixture list failed: EACCES: permission denied, scandir '/v/appdb/packages'". |
| `M1-41.common.a-first-start-resume` | `stack:data-quarantine` exited 1 at 11:34:05Z: `storage_refused`, `quarantine-copy`, `source_unreadable`, entry `cogniate-app/packages`; "Cannot read cogniate-app/packages as the host user (EACCES) … No target changed." |
| `M1-41.common.e-old-schema` | The content check recorded `checked=3`, equal to QA's count of distinct `storage_path` values. Then "Portal sign-in of thanh@cogniate.test: HTTP 403" (35 s). |

The other 40 failed rows say "not run: prerequisite … did not pass". They follow from `a-first-start-resume` (directly for `e-not-same-import`, and through `@backup-B`, `@post-B`, `@legacy-place` and `@legacy-import-lane`), from the `f-*` rows (`f-originals-back`) and from `e-old-schema` (`e-content-missing`). The QA fixture listing and the product quarantine copy both report the same EACCES on the content folder `cogniate-app/packages`. After the run (11:36:10Z), that folder in the storage clone is mode 0700, owner `quangnguyen:staff`, with three `pkg_*` subfolders at 0755. Its mode at the failure times is not known. The candidate changed `stack-reset.sh` and `stack-data.mjs`. Cause: **not established** (product reset or content-folder mode, harness fixture identity, or environment).

### 19.4 Disposition

- Canvas M1 at `aaa823b`: round 1 Canvas rows 233/233 PASS, sink gate PASS and clean screenshots. This is partial evidence. **Overall HOLD**; the full attempt failed (round 1 438/488).
- Not achieved at this candidate: a complete round 1, round 2, the round comparison, legacy, M2 and T7. No runtime window was transferred to QA-E2E.
- `9cdd768`, `51a80b5`, `82e2dab`, `55c33a3`, `a784522` and `aff4882` keep their own records. No PASS carries from one candidate to another.
- Next: Common QA classifies the four root storage failures. Any repair goes through a new reviewed freeze. Then both complete rounds run, and QA-E2E runs both judges over each round and compares the two rounds.

## 20. Round 14 — candidate C3 `c4c6d04`: round 1 Canvas rows complete, round 1 failed in storage (2026-10-22)

**HOLD. No M1 acceptance credit. The full attempt failed.** A fresh Claude QA-E2E session wrote this round: `claude-opus-5-5`, xhigh; Orca session `34e03f7b-2209-4749-8db7-c5b507717b71`; task `task_5f3f8aa499cb`, dispatch `ctx_1fd6cb09010e`. It did not execute rounds 1–13. Their provenance stays as written above. Candidate C2 `0938ea1` had only a host preparation by another session (`ctx_d2465e113d79`). Its storage diagnostic failed, so C2 has no Canvas judgement and no section here.

Candidate product = test `c4c6d045b3a132f72bf059d77367d278de9222fa` (tests tree `17330479829a6b65e560afc297e2bee6777459dd`). It is C2 `0938ea1` plus the R4 repair `cd73139` of the Common-owned `tests/host/storage-rows.mjs` and its self-test, and later docs-only commits. `services`, `apps`, `packages`, `infra` and the root build files equal `9f8ac62`. Canvas, M2, T7 and simulator tests did not change. Lead authority: the dispatch preamble (host only), `msg_952820585105`, `msg_53398fdb8c4b`, `msg_5c47811ac5d9` (judge the closed phases early), `msg_7843086da8ce`, `msg_de67b6b34ca8` and `msg_04a1afc953ac` (close out). Common QA (`ctx_2e9642c8e4be`) held the only Docker window. This worker executed no `docker` or `docker compose` binary; a PATH stub recorded 0 calls.

Common QA ran the documented full M1 entry from `/Users/quangnguyen/cogniate-qa-runs/qa-common-c3-20261022T0154Z/source` (HEAD `c4c6d04…`, tests tree `17330479…`, 0 status lines). The runner started at 02:40:53Z. Round 1:
- **SIM** passed 394/394 (run `qa-multi-r1-c4c6d045-2026-10-22T02-40-53-303Z`).
- **snapshot-isolated** passed 6/6 (run `qa-multi-r1-c4c6d045-2026-10-22T03-03-58-641Z`).
- **snapshot-upgrade** passed 6/6, including `M1-38.common.h1`–`h5` (run `qa-multi-r1-c4c6d045-2026-10-22T03-05-36-389Z`).
- **migration** passed 12/12 (run `qa-multi-r1-c4c6d045-2026-10-22T03-07-30-611Z`).
- **storage** (lane `qa-multi-r1-st`, run `qa-multi-r1-st-c4c6d045-2026-10-22T03-11-29-196Z`): 52 PASS and 18 FAIL of the 70 required rows.
- Round 1 total: 470 PASS and 18 FAIL of 488 required rows. Round 2 and legacy did not run.

The Lead reports that Common's run ended and returned its Docker window (`msg_04a1afc953ac`). QA-E2E did not inspect Common's W4, cleanup or scans.

### 20.1 Preparation (host only)

- Evidence root `R` = `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-c4c6d04-qA52QXut`, made with `mktemp -d` under umask 077 at 01:58Z. Outside `R/source`, all folders are 0700 and regular files are 0600, except three 0700 executables: the two Docker guard stubs and the wait helper. `R/source` is 0700. Its children come from the umask-022 clone and copy (folders 0755, files 0644 or 0755, 11 links; `.git/index` 0600). Inventory: `R/notes/mode-inventory.json` (`stat` only, no `chmod`).
- `R/source` is a clean `--no-hardlinks --no-checkout` clone, detached at `c4c6d04…`. It has 0 status lines, only sample hooks and a disabled push URL. It has no `.env`, root `node_modules`, `.tmp` or `infra` state. The only non-docs change from C2 is `tests/host/storage-rows.mjs` (`a9ef100d…`) and its self-test (`4fcd18d5…`).
- Dependency binding: the static import closures of `run-m2.mjs` (7 files), `run-t7.mjs` (2), `storage-docker.mjs`, `lib.mjs`, both `coverage.mjs` files and `storage-inventory.mjs` hold no changed file. Only Common's `run-m1.mjs` imports `storage-rows.mjs`. The frozen-helper inventory is byte-identical to C2: 488 rows (394/6/6/12/70); Canvas 233 (225 API and 7 browser in `sim`, 1 API in `snapshot-isolated`); M2 64.
- Test dependencies: `tests/package.json` and `tests/package-lock.json` are byte-identical to C2. The cached C2 `tests/node_modules` was copied with `rsync -a`. All 1,927 entries are identical (type, mode, size, SHA-256, link target). All 111 lock packages are present at their lock versions, except 50 optional packages for other platforms (as in C2). No install, download or npm call happened.
- Tools: the C2 root was checked read only first (handoff `336dc47e…`, 91-entry manifest `cdbd5e6c…`, plan v2 `7bbeec18…`). Its `notes/deviations.txt` grew append-only after that manifest; its first 801 bytes still equal the manifest hash. `cp -p` copied 37 files, and all 37 are byte-identical. The relocated manifests pass: R4 22/22, sink 4/4, boundary 4/4. The Docker stubs differ only in their log path. The unused `round-rows.mjs` helper was not copied. No tool self-test or host suite was repeated (accepted C2 qualification).
- Plans: `R/plan/runbook-c4c6d04.md` (`32f390b5…`), `window-commands-c4c6d04.md` (`4435163d…`) and `judge-commands-c4c6d04-v2.md` (`6abfac2f…`) are literal derivations of the accepted C2 files. By rule (`msg_53398fdb8c4b`), round completeness uses the five `m1-case-results.json` files directly with `jq`. The check covers counts per phase and the exact phase and id set against the 488 rows of the four frozen manifests (`R/judge/expected-ids-c3.tsv`, `97e37fa1…`). Controls on the accepted `aaa823b` round 1: all five files give 0 differences; without storage, 70 rows are missing; a doubled SIM file gives 394 duplicates.
- Host facts (file hashes only, no Docker binary run): macOS 27.0.1 arm64; Docker CLI `67827118…`; Compose `1ec06408…`; fixtures HTML `9f04d3ab…` and SCORM `a685744e…`; baseline `219da30b…` (7 records). Unrelated PID 64140 was only observed.
- Disclosures (`R/notes/deviations.txt`): D-1, the first source-binding record has empty fields because a zsh variable did not split; it is kept, and v2 is correct. D-2, the first count control printed a false identity column because the SHA was not exported; v2 is correct. D-3, the first plan derivation stopped on its own guard after it wrote two correct files; v2 confirmed them byte for byte and wrote the third.
- Handoff `R/notes/handoff.md` (`b3347462…`) and manifest `R/notes/MANIFEST-host-ready.sha256` (`dec68131…`, 76 entries). The Lead verified and accepted them (`msg_53398fdb8c4b`). They give no runtime credit.

### 20.2 Independent Canvas judgement (round 1)

The judges are the unchanged approved `canvas-judge-round.mjs` (v1) and `canvas-judge-round-v2.mjs` (sink gate). They ran under umask 077 against Common's artifacts, read only. QA-E2E judged the three first phases when they closed (`msg_5c47811ac5d9`), and then all five phases. The interim input hashes did not change, and both v1 outputs have identical Canvas rows.

| Gate | Result |
| --- | --- |
| Phase binding | Each of the five phase folders has product = test = `c4c6d04…`, provider `all`, `abort: null` and an identity time after 02:40:53Z. Each `m1-case-results.json` equals (parsed JSON) Common's accounting file `round-1-<phase>.json` in `/Users/quangnguyen/cogniate-qa-runs/qa-common-c3-20261022T0154Z/full/tmp/qa-m1-accounting-QEFABY/`. The two diagnostic folders (`qa-multi-r1-c4c6d045-2026-10-22T02-03-14-229Z`, `qa-multi-r1-st-c4c6d045-2026-10-22T02-07-12-250Z`) were not used. |
| Round row set (direct, `jq`) | 488 rows in the five phase files: 394/6/6/12/70, 488 distinct ids, 0 SHA mismatches. The sorted phase and id list is byte-identical to the 488-row list of the four frozen manifests (`97e37fa1…`): 0 duplicates, 0 missing, 0 extra. Status: 470 PASS, 18 FAIL, all 18 in storage. |
| Canvas rows (v1, five phases) | **233/233 PASS**: SIM 232 (225 API + 7 browser); snapshot-isolated 1 (`M1-37.canvas.aa`). 0 FAIL, BLOCKED, SKIP or MISSING; no problems. Each row has one runner result and one raw result without retries. The other three phases hold no Canvas rows. After the SIM and snapshot-isolated phases, app and LTI health show `default`, `knobs: []` and LTI `simulation_profiles: []`. |
| Scan records | SIM: 1,300 values, 637 files, 0 hits. snapshot-isolated: 10 / 65 / 0. snapshot-upgrade: 118 / 89 / 0. migration: 38 / 89 / 0. storage: 0 values / 789 files / 0 hits. |
| Sink gate (AC-M1-12, four cases) | **PASS.** `sink.jsonl` SHA-256 `3e691b63…c313`: 2 complete lines with a trailing newline. One lifetime `boot-5a3b2446764c`, 02:41:41.423Z to 03:03:42.112Z. It starts after the run start (02:40:53Z) and stops before the identity time (03:03:52.620Z). `ags-lineitems`, `ags-lineitem-evil`, `nrps` and `dl-return` each ran once and passed in `21-canvas-protocol.test.ts`; the file interval is 02:41:55.258Z to 02:42:02.866Z. 0 `sink_hit`. |
| Canvas browser artifacts (AC-M3-07) | The selection rule of the accepted `aaa823b` scan gives 29 files in 7 folders (15 screenshots, 14 trace zips). 1,315 values from the SIM phase clone: 9 `.env`, 7 secrets-file and 1,299 capture values. 15 screenshots (6 distinct): **0 hits**. QA inspected all 6 distinct screenshots visually: 1 framed embedded page ("Open in a new window"), 1 blank refused third-host frame, 3 player pages "Status: Not started" and 1 "Status: Completed — score 70 sent to Canvas". They show no token, capability or approval input. The 14 trace zips stay private: 120 hits in 7 files, as expected for raw traces. They are named only by location and hash. |
| Round completeness (AC-M3-01) | **Not met.** Round 1 failed in the storage phase. Round 2 did not run, so no round comparison is possible. |

Records in `R` (SHA-256):
- `judge/round1/inputs-interim3.sha256` (`63b24671…`) and `judge/round1/inputs-full5.sha256` (`ae558f42…`): input hashes and the accounting comparison.
- `judge/round1/judge-v1-interim3.json` (`d8600e6d…`) and `judge/round1/judge-v2-interim3.json` (`b6bafc2f…`): the three closed phases.
- `judge/round1/judge-v1-round1-all5.json` (`70445a6a…`) and `judge/round1/judge-v2-round1-all5.json` (`b6bafc2f…`): all five phases.
- `judge/round1/round-direct.txt` (`22adf39e…`) and `judge/round1/actual-ids.tsv` (`97e37fa1…`, equal to the expected list).
- `judge/round1/canvas-browser-targets.json` (`11d8db07…`), `scan/r1-sim-canvas-browser-scan.json` (`2c34f8e2…`, counts only) and `judge/round1/visual-check-r1.txt` (`c28f6b3a…`).
- Every judge, target and scan stderr file is empty.

### 20.3 The storage failure (Common-owned rows)

QA-E2E read only the redacted storage results. Common QA and the fixer own these rows, their oracles and the classification. This is a first look, not a classification.

| Rows | Evidence |
| --- | --- |
| `M1-41.common.g-tamper` | The only failed executed row: "--recover after the tamper: expected exit 2, got 1" (3 s). |
| `g-quarantine`, `g-quarantine-in-use` | "not run: prerequisite g-tamper did not pass". |
| `h-legacy-manifest`, `h-target-state`, `e-hot-journal`, `e-old-layout` | "not run: prerequisite @legacy-place did not pass". The fixture `STORAGE-LEGACY-PLACE` did not run because `g-quarantine` did not pass. |
| `e-fresh-refusal`, `g-fresh-target` | "not run: prerequisite h-target-state did not pass". |
| `h-pair-mismatch` | "not run: prerequisite g-fresh-target, @legacy-remove did not pass". The fixture `STORAGE-LEGACY-REMOVE` did not run because `@legacy-place` did not pass. |
| `e-import-recover`, `e-changed-byte`, `e-added-wal`, `e-import-nonfresh`, `h-old-manifest` | "not run: prerequisite @legacy-import-lane did not pass". The fixture `STORAGE-LEGACY-IMPORT-LANE` did not run because `h-pair-mismatch` did not pass. |
| `e-import`, `e-kept`, `e-provenance-restore` | Each "not run" because the row before it in this chain did not pass. |

All 17 dependent rows trace back to `g-tamper`. The runner's final coverage check then failed (row `ERROR`, "Required case is not PASS"). Cause: **not established** by QA-E2E. The repair session `ctx_898acbaef3a6` owns the diagnosis and any authorized repair.

### 20.4 Disposition

- Canvas M1 at `c4c6d04`: round 1 Canvas rows 233/233 PASS, sink gate PASS, clean screenshots, and an exact 488-row set. This is partial evidence only. **Overall HOLD**; the full attempt failed (round 1 470/488).
- Not achieved at this candidate: a complete round 1, round 2, the round comparison, legacy, M2 and T7. No Docker window was granted to QA-E2E.
- `aaa823b`, `9cdd768`, `51a80b5`, `82e2dab`, `55c33a3`, `a784522` and `aff4882` keep their own records. No PASS carries from one candidate to another.
- Next: the repair session diagnoses `g-tamper`. Any repair goes through a new reviewed freeze. Then both complete rounds run, and QA-E2E runs both judges and the exact row-set check over each round and compares the two rounds.

## 21. Round 15 — candidate C4 `bf09cda`: round 1 complete and Canvas rows PASS; full attempt stopped in round 2 (2026-10-22)

**HOLD. Overall M1 full acceptance is PENDING. No M1 acceptance credit from this section alone.** Round 1 is complete (488/488 PASS) and its 233 Canvas rows pass. Common's full runner stopped in round 2 on an external isolation failure (§21.3). Round 2, the round comparison and legacy are not judged here.

A fresh Claude QA-E2E session wrote this round: `claude-opus-5-5`, xhigh; Orca session `fe5b6a79-3e58-4919-b764-e7ab4cc6ec6a`; task `task_1eabbfbed895`, dispatch `ctx_745cb25fcb7c`. It did not execute rounds 1–14. Their provenance stays as written above.

Candidate product = test `bf09cdad91ca548e1ecbc14428b55180d35d5360` (tests tree `8283d90dc669feb72eeb7ec43f5dbf80a156f0d4`). It is C3 `c4c6d04` plus the R5 repair `27e1f61` of the Common-owned `tests/host/storage-rows.mjs` (`fbb99131…`) and its self-test (`edc2d97a…`), the text-only `infra/README.md` clarification and later docs-only commits. `services`, `apps`, `packages` and the root build files equal `9f8ac62`. Canvas, M2, T7 and simulator tests did not change. Lead authority: the dispatch preamble (host only), `msg_6a1f7731232e`, `msg_26da51187107`, `msg_d1f00e6c240b`, `msg_92797f8d189e` (round 1 evidence grant), `msg_f31679702ee3` (round 1 accepted), `msg_972209aa6979` (round 2 stop, hold) and `msg_d3435c5e5e8d` (record round 1 now). Common QA (`ctx_e23ced3dd1fa`) held the only Docker window. This worker executed no `docker` or `docker compose` binary; a PATH stub logged only its own 2-line positive control.

### 21.1 Preparation (host only)

- Evidence root `R` = `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-bf09cda-Kb7OPU3d`, made with `mktemp -d` under umask 077 at 04:08Z. In the preparation inventory (04:13Z), outside `R/source`, folders were 0700 and files 0600, except three 0700 executables (two Docker guard stubs and the wait helper `wait-watch.sh`). At the round 1 closeout there are four: the fourth is `R/private/tmp/wait.sh`, a helper that only waits for Orca inbox messages; it is not evidence logic. `R/source` is 0700; its children come from the umask-022 clone and copy. Inventory: `R/notes/mode-inventory.json` (`lstat` only, no `chmod`).
- `R/source` is a clean `--no-hardlinks --no-checkout` clone, detached at `bf09cda…`, with 0 status lines, only sample hooks and a disabled push URL. It has no `.env`, root `node_modules`, `.tmp`, `infra` state or artifacts. Non-docs change from C3: `infra/README.md` (text) and the two R5 storage files.
- Dependency binding: the static import closures of `run-m2.mjs` (7 files), `run-t7.mjs` (2), `storage-docker.mjs`, `lib.mjs`, both `coverage.mjs` files and `storage-inventory.mjs` hold no changed file. The frozen-helper inventory is byte-identical to C3: 488 rows (394/6/6/12/70); Canvas 233 (225 API and 7 browser in `sim`, 1 API in `snapshot-isolated`); M2 64. The expected phase and id list `R/judge/expected-ids-c4.tsv` is byte-identical to C3 (`97e37fa1…`).
- Test dependencies: `tests/package.json` and `tests/package-lock.json` are byte-identical to C3. The cached C3 `tests/node_modules` was copied with `rsync -a`. All 1,927 entries are identical; all non-optional lock packages are at their lock versions. No install, download or npm call happened.
- Tools: QA first verified the C3 closeout manifest (`a5a4cb45…`, 106/106) read only. `cp -p` copied the same 37 qualified files; all 37 are byte-identical with the expected hash and mode. Relocated manifests pass: R4 22/22, sink 4/4, boundary 4/4. No tool self-test or host suite was repeated. The old `round-rows.mjs` helper was not copied.
- Plans: `R/plan/runbook-bf09cda.md` (`73c80fc3…`), `window-commands-bf09cda.md` (`8e344fc8…`) and `judge-commands-bf09cda.md` (`e6219e61…`) are literal derivations of the accepted C3 files (diff `R/notes/plans-c3-c4.diff`, `d5cb8f9f…`). Two rule additions in the judge commands: Git reads of Common's source use `GIT_OPTIONAL_LOCKS=0`, and step 0b is the executed C3 accounting check (each `m1-case-results.json` parse-equal to Common's `round-N-<phase>.json`, run id, abort, timestamps and runner order).
- Host facts (file hashes only): macOS 27.0.1 arm64; Docker CLI `67827118…`; Compose `1ec06408…`; fixtures HTML `9f04d3ab…` and SCORM `a685744e…`; baseline `219da30b…` (7 records); PID 64140 only observed.
- Handoff `R/notes/handoff.md` (`3998f911…`) and manifest `R/notes/MANIFEST-host-ready.sha256` (`4e9ef764…`, 84 entries). The Lead verified and accepted them (`msg_6a1f7731232e`). They give no runtime credit.
- Disclosures (`R/notes/deviations.txt`): D-1, the first plan derivation stopped on its own guard (it matched the new provenance phrase) after it wrote the runbook; v2 confirmed that file byte for byte and wrote the other two. N-1, one redirect to a relative path was refused by the shell before the command ran; nothing was written, and the command ran again with the absolute path.

### 21.2 Independent Canvas judgement (round 1)

Common QA ran the documented full M1 entry from `/Users/quangnguyen/cogniate-qa-runs/qa-common-c4-20261022T0408Z/full-src/source` (HEAD `bf09cda…`, tests tree `8283d90d…`, 0 status lines). The runner started at 05:26:57Z. The judges are the unchanged approved `canvas-judge-round.mjs` (v1) and `canvas-judge-round-v2.mjs` (sink gate). They ran under umask 077 against Common's artifacts, read only, after the Lead's round 1 evidence grant.

| Gate | Result |
| --- | --- |
| Phase binding | The five granted folders are `qa-multi-r1-bf09cdad-2026-10-22T05-26-57-277Z` (sim), `…T05-49-50-379Z` (snapshot-isolated), `…T05-51-25-320Z` (snapshot-upgrade), `…T05-53-15-870Z` (migration) and `qa-multi-r1-st-bf09cdad-2026-10-22T05-57-08-327Z` (storage). Each has product = test = `bf09cda…`, provider `all`, run id = folder name and `abort: null`. Identity times 05:49:44.388Z, 05:51:20.960Z, 05:53:11.485Z, 05:57:04.002Z and 06:19:44.633Z are after the runner start and in runner order. Each `m1-case-results.json` equals (parsed JSON) Common's accounting file `round-1-<phase>.json` in `/Users/quangnguyen/cogniate-qa-runs/qa-common-c4-20261022T0408Z/full/tmp/qa-m1-accounting-XdBX6Z/`. No other folder was read. |
| Round row set (direct, `jq`) | 488 rows in the five phase files: 394/6/6/12/70, 488 distinct ids, 0 SHA mismatches, **488 PASS**. `M1-41.common.c-host-negative` is PASS. The sorted phase and id list is byte-identical to the 488-row list of the four frozen manifests (`97e37fa1…`): 0 duplicates, 0 missing, 0 extra. |
| Canvas rows (v1, five phases) | **233/233 PASS**: SIM 232 (225 API + 7 browser); snapshot-isolated 1 (`M1-37.canvas.aa`). 0 FAIL, BLOCKED, SKIP or MISSING; no problems and no row notes (one result each, no retries). After the SIM and snapshot-isolated phases, app and LTI health show `default`, `knobs: []` and LTI `simulation_profiles: []`. |
| Scan records | SIM: 1,300 values, 637 files, 0 hits. snapshot-isolated: 10 / 65 / 0. snapshot-upgrade: 118 / 89 / 0. migration: 38 / 89 / 0. storage: 0 values / 878 files / 0 hits. |
| Sink gate (AC-M1-12, four cases) | **PASS.** `sink.jsonl` SHA-256 `7e9a2eaa…`: 2 lines. One lifetime `boot-3849e0c32055`, 05:27:41.179Z to 05:49:33.920Z, after the run start and before the identity time. `ags-lineitems`, `ags-lineitem-evil`, `nrps` and `dl-return` each ran once and passed in `21-canvas-protocol.test.ts`; the file interval is 05:27:54.631Z to 05:28:02.193Z. 0 `sink_hit`. |
| Canvas browser artifacts (AC-M3-07) | The accepted selection rule gives 29 files in 7 folders (15 screenshots, 14 trace zips). 1,315 values from the SIM phase clone: 9 `.env`, 7 secrets-file and 1,299 capture values. 15 screenshots (6 distinct): **0 hits**. QA inspected all 6 distinct screenshots visually: 1 framed embedded page ("Open in a new window"), 1 blank refused third-host frame, 3 player pages "Status: Not started" and 1 "Status: Completed — score 70 sent to Canvas". They show no token, capability or approval input. The 14 trace zips stay private: 120 hits in 7 files, as expected for raw traces. They are named only by location and hash. |

Records in `R` (SHA-256):
- `notes/grant-r1-msg_92797f8d189e.txt` (`f7659f03…`): the Lead's exact round 1 paths, accounting files and SIM clone.
- `judge/round1/inputs.sha256` (`c93d2c03…`): input hashes and the accounting comparison. `judge/round1/bind-v2.txt` (`6782320e…`): run id, abort, clone, times and order.
- `judge/round1/round-direct.txt` (`dfb4b517…`), `judge/round1/id-set.txt` (`2b853f72…`) and `judge/round1/actual-ids.tsv` (`97e37fa1…`, equal to the expected list).
- `judge/round1/judge-v1.json` (`e765638f…`) and `judge/round1/judge-v2.json` (`a92c2cf0…`).
- `judge/round1/canvas-browser-targets.json` (`9d8e4247…`), `scan/r1-sim-canvas-browser-scan.json` (`c1374bf6…`, counts only) and `judge/round1/visual-check-r1.txt` (`138adebf…`).
- `judge/round1/round1-record.txt` (`2d95fde0…`). The Lead verified 54 input bindings, 13 record bindings and 29 browser target hashes and accepted this round 1 judgement as one-round evidence (`msg_f31679702ee3`).
- Every judge, target and scan stderr file is empty.
- Disclosure D-2: the first bind record (`inputs.sha256`) prints `runId=null` and `abort=null`, because `m1-identity.json` has no such keys (C3 read them from `summary.json`). The file is kept unchanged. `bind-v2.txt` reads both from each `summary.json`. The accounting and hash lines of the first record are not affected.

### 21.3 Round 2 (not judged)

The Lead reports (`msg_972209aa6979`) that Common's full runner exited 1 at 06:44:53Z. In round 2, SIM passed 394/394 and snapshot-isolated passed 6/6, but the snapshot-isolated `M3-ISOLATION` check failed: the unrelated container `/qa-la-sim-r2-cogniate-app-1` changed during the window, and the strict W4 comparison lists 16 new resources of the LA run. No product or test fault is established. QA-E2E received no round 2 evidence grant. It did not read or judge any round 2 folder, Common's W4 or the cleanup.

### 21.4 Disposition

- Canvas M1 at `bf09cda`: round 1 is complete (488/488 PASS, exact phase and id set, accounting parse-equal), with Canvas rows 233/233 PASS, sink gate PASS and clean screenshots. This is one-round evidence only.
- **Overall M1 full acceptance: PENDING.** This full attempt stopped in round 2 on external isolation. A second complete round, the round comparison (same per-row result) and the 12 legacy groups are still needed.
- Not achieved at this candidate: round 2, the round comparison, legacy, M2 and T7. No Docker window was granted to QA-E2E. All 32 live rows stay UNVERIFIED; local Canvas stays DEFERRED.
- C3 `c4c6d04` and the older candidates keep their own records. No PASS carries from one candidate to another.

## 22. Round 16 — candidate C4 `bf09cda` (`full2` retry): both 488-row rounds complete, Canvas 233/233 PASS in each, per-case equality PASS; legacy and final W4 pending (2026-10-22)

**HOLD (bounded two-round checkpoint). Overall M1 full acceptance is PENDING.** Both 488-row rounds of the `full2` invocation are complete (`488/488 PASS` in each round). Independent Canvas QA-E2E judged `233/233 PASS` in round 1 and `233/233 PASS` in round 2, and proved exact per-case equality across all 233 Canvas rows and all 488 required rows (including `M1-41.common.c-host-negative`). Common's 12 legacy groups, the final `full2` W4 boundary comparison, fresh M2, fresh T7 and overall acceptance are still pending.

Provenance:
- The earlier Claude Code Opus 5.5 (`claude-opus-5-5`, xhigh) session (`task_1eabbfbed895`, dispatch `ctx_745cb25fcb7c`, session `fe5b6a79-3e58-4919-b764-e7ab4cc6ec6a`) judged `full2` round 1 under Lead grant `msg_ddb281d01832` (accepted in `msg_7d3f9ba8b68c`) and recorded its handoff in `docs/team/model-transition-2026-10-22.md` (`msg_06f2802507ed`).
- Under the product owner's model transition (`docs/team/model-transition-2026-10-22.md`), replacement independent Canvas QA-E2E (`task_1eabbfbed895`, dispatch `ctx_296da6e34f11`, terminal `term_3fd51366-4ec9-4a5c-994d-be6f04a4bcf1`, Antigravity Gemini 4 Argon (High), `gemini-4-argon-high`, high effort) adopted the held root read-only (`msg_16a26a6bf279`, accepted in `msg_f000ec7efa0a`), judged `full2` round 2 and the round-1 vs. round-2 comparisons under Lead grant `msg_8a7fc83b1a13` (accepted in `msg_486a0d5f48c7`), and wrote this section. It did not execute rounds 1–15 or `full2` round 1; their provenance stays as written above.
- Candidate product = test `bf09cdad91ca548e1ecbc14428b55180d35d5360` (tests tree `8283d90dc669feb72eeb7ec43f5dbf80a156f0d4`). Source, tests, criteria and qualified tools did not change. Neither session executed a `docker` or `docker compose` binary; `R/private/stub-bin/calls.log` still holds only the 2-line (113 B) positive control from initial preparation.

### 22.1 Preparation and preserved manifests (host only)

- Held evidence root `R` = `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-bf09cda-Kb7OPU3d` (§21.1). No new root, clone, dependency copy, host suite or control campaign was run.
- All 119 entries of `R/notes/MANIFEST-r1-closeout-v2.sha256` (`adc0a74e7c3a43079d02f611be74b3a70ed6f2b757522903ea0ea5958c0fd814`) and all 17 entries of `R/judge/full2-round1/MANIFEST-full2-round1.sha256` (`d841776132b5582dafc0d717831f008f9989c93494df1e71a7dae882678dce0e`) re-verify `119/119` and `17/17` with 0 mismatches (`verify-manifest.mjs`).
- New `full2` round-2 outputs were written only inside `R/judge/full2-round2` and `R/scan/full2-round2`. Both directories were confirmed absent before creation (`mkdir -m 0700` under `umask 077`), and all 23 regular files inside them were created with mode `0600`.

### 22.2 Independent Canvas judgement — `full2` round 1

Common QA started the `full2` retry at `07:14:45Z` from `/Users/quangnguyen/cogniate-qa-runs/qa-common-c4-20261022T0408Z/full2-src/source` (HEAD `bf09cda…`, tests tree `8283d90d…`, 0 status lines with `GIT_OPTIONAL_LOCKS=0`), with accounting directory `/Users/quangnguyen/cogniate-qa-runs/qa-common-c4-20261022T0408Z/full2/tmp/qa-m1-accounting-pld7ce`.

| Gate | Result |
| --- | --- |
| Phase binding | The five granted round-1 folders are `qa-multi-r1-bf09cdad-2026-10-22T07-14-45-647Z` (`sim`), `…T07-37-53-810Z` (`snapshot-isolated`), `…T07-39-29-485Z` (`snapshot-upgrade`), `…T07-41-19-810Z` (`migration`) and `qa-multi-r1-st-bf09cdad-2026-10-22T07-45-11-499Z` (`storage`). Each has product = test = `bf09cda…`, provider `all`, `runId` = folder name (from `summary.json`) and `abort: null`. Identity times `07:37:47.758Z`, `07:39:25.215Z`, `07:41:15.460Z`, `07:45:07.000Z` and `08:06:21.854Z` are after the `07:14:45Z` runner start and in strict runner order. Each `m1-case-results.json` (`c9331e3a…`, `43cbf82c…`, `1857504f…`, `4098d6ca…`, `fd5dc4a7…`) is parsed-equal (`jq -S .`) to its `round-1-<phase>.json` (`635dd637…`, `a4a3dc10…`, `16d91cae…`, `16511ce6…`, `1c8395f8…`). |
| Round row set (direct, `jq` + `comm`) | 488 rows across the five phase files (`394/6/6/12/70`), 488 distinct ids, 0 SHA mismatches, **488 PASS**. `M1-41.common.c-host-negative` is `PASS`. `judge/full2-round1/actual-ids.tsv` is byte-identical to `judge/expected-ids-c4.tsv` (`97e37fa1…`): 0 duplicates, 0 missing, 0 extra. |
| Canvas rows (`v1`, five phases) | **233/233 PASS**: `sim` 232 (225 API + 7 browser); `snapshot-isolated` 1 (`M1-37.canvas.aa`). 0 FAIL, BLOCKED, SKIP or MISSING; 0 problems and 0 row notes. After `sim` and `snapshot-isolated`, app and LTI health show `default`, `knobs: []` and LTI `simulation_profiles: []`. |
| Scan records | `sim`: 1,300 values, 637 files, 0 hits. `snapshot-isolated`: 10 / 65 / 0. `snapshot-upgrade`: 118 / 89 / 0. `migration`: 38 / 89 / 0. `storage`: 0 / 878 / 0. |
| Sink gate (AC-M1-12, four cases) | **PASS.** `sink.jsonl` SHA-256 `1bd9bd78…`: 2 lines. One lifetime `boot-d1df63614f4a`, `07:15:33.989Z` to `07:37:37.295Z` (after runner start, before identity time). `ags-lineitems`, `ags-lineitem-evil`, `nrps` and `dl-return` each ran once and passed in `21-canvas-protocol.test.ts` (`07:15:47.369Z` to `07:15:54.985Z`). 0 `sink_hit`. |
| Canvas browser artifacts (AC-M3-07) | 29 files in 7 folders of SIM clone `qa-multi-r1-bf09cdad-2026-10-22T07-14-45-647Z` (15 shared PNG, 14 private trace zips). `secret-scan` checked 1,316 values (9 `.env`, 8 secrets-file, 1,299 capture): **0 hits** in the 15 shared PNGs. Visual check of all 6 distinct PNGs (`b4ea5c68…`, `1ef24a81…`, `ba64adf8…`, `f61803c3…`, `9350d8f0…`, `8a268761…`) found no token, capability or approval input. The 14 trace zips stay private (120 hits in 7 files, expected for raw traces). |

Records in `R` for `full2` round 1 (manifest `judge/full2-round1/MANIFEST-full2-round1.sha256`, `d8417761…`, 17 entries):
- `judge/full2-round1/grant-msg_ddb281d01832.txt` (`02dc717e…`), `judge/full2-round1/inputs.sha256` (`933f0278…`).
- `judge/full2-round1/round-direct.txt` (`ef587b13…`), `judge/full2-round1/id-set.txt` (`620f9949…`), `judge/full2-round1/actual-ids.tsv` (`97e37fa1…`).
- `judge/full2-round1/judge-v1.json` (`efcaa4d0…`), `judge/full2-round1/judge-v2.json` (`1e64ea2d…`).
- `judge/full2-round1/canvas-browser-targets.json` (`dc8a4d46…`), `scan/full2-round1/r1-sim-canvas-browser-scan.json` (`c9160e34…`), `judge/full2-round1/visual-check.txt` (`8edf7062…`), `judge/full2-round1/round-record.txt` (`868d68fe…`).
- Disclosure D-4 (`notes/deviations-2.txt`, `259398bb…`): `private/tmp/msg-f2r1.txt` (status message text, no secrets) was created without `umask 077` (born `0644` inside `0700` `private/tmp`, then set to `0600`); judgment records were unaffected.

### 22.3 Independent Canvas judgement — `full2` round 2 and round comparison

| Gate | Result |
| --- | --- |
| Phase binding | The five granted round-2 folders are `qa-multi-r1-bf09cdad-2026-10-22T08-06-26-068Z` (`sim`), `…T08-29-22-193Z` (`snapshot-isolated`), `…T08-30-59-740Z` (`snapshot-upgrade`), `…T08-32-52-124Z` (`migration`) and `qa-multi-r1-st-bf09cdad-2026-10-22T08-36-44-622Z` (`storage`). Each has product = test = `bf09cda…`, provider `all`, `runId` = folder name, `summary.sha` = `bf09cda…` (`bind-v2.txt`) and `abort: null`. Identity times `08:29:15.922Z`, `08:30:55.482Z`, `08:32:47.849Z`, `08:36:40.031Z` and `08:58:28.138Z` are after round-1 storage end (`08:06:21.854Z`) and in strict runner order. Each `m1-case-results.json` (`9d13cd39…`, `6c1dbfec…`, `ed0ab06d…`, `4098d6ca…`, `b2a72031…`) is parsed-equal (`jq -S .`) to its `round-2-<phase>.json` (`a80ad848…`, `4c4c5085…`, `b881c1bc…`, `16511ce6…`, `dd401f17…`) in `qa-m1-accounting-pld7ce`. Common's `round-2-bind.json` (`c1e555c7…`), `round-2-verify.json` (`09b75cb6…`) and `round-2-time.json` (`653dfbf5…`) match. |
| Round row set (direct, `jq` + `comm`) | 488 rows across the five phase files (`394/6/6/12/70`), 488 distinct ids, 0 SHA mismatches, **488 PASS**. `M1-41.common.c-host-negative` is `PASS`. `judge/full2-round2/actual-ids.tsv` is byte-identical to `judge/expected-ids-c4.tsv` (`97e37fa1…`): 0 duplicates, 0 missing, 0 extra. |
| Canvas rows (`v1`, five phases) | **233/233 PASS**: `sim` 232 (225 API + 7 browser); `snapshot-isolated` 1 (`M1-37.canvas.aa`). 0 FAIL, BLOCKED, SKIP or MISSING; 0 problems and 0 row notes. After `sim` and `snapshot-isolated`, app and LTI health show `default`, `knobs: []` and LTI `simulation_profiles: []`. |
| Scan records | `sim`: 1,300 values, 637 files, 0 hits. `snapshot-isolated`: 10 / 65 / 0. `snapshot-upgrade`: 118 / 89 / 0. `migration`: 38 / 89 / 0. `storage`: 0 / 878 / 0. |
| Sink gate (AC-M1-12, four cases) | **PASS.** `sink.jsonl` SHA-256 `afef61cd…`: 2 lines. One lifetime `boot-ccba2e03f778`, `08:07:08.924Z` to `08:29:05.297Z` (after phase start `08:06:26.068Z`, before identity time `08:29:15.922Z`). `ags-lineitems`, `ags-lineitem-evil`, `nrps` and `dl-return` each ran once and passed in `21-canvas-protocol.test.ts` (`08:07:22.031Z` to `08:07:29.635Z`). 0 `sink_hit`. |
| Canvas browser artifacts (AC-M3-07) | 29 files in 7 folders of SIM clone `qa-multi-r1-bf09cdad-2026-10-22T08-06-26-068Z` (15 shared PNG, 14 private trace zips). `secret-scan` checked 1,316 values (9 `.env`, 8 secrets-file, 1,299 capture): **0 hits** in the 15 shared PNGs. Visual check of all 6 distinct PNGs (`1647187b…`, `1ef24a81…`, `0a9fd29c…`, `9b78437f…`, `3063096d…`, `cce1321c…`) found 1 player page "Status: Completed — score 70 sent to Canvas", 1 blank refused third-host frame, 1 framed embedded page ("Open in a new window") and 3 player pages "Status: Not started", with no token, capability or approval input. The 14 trace zips stay private (124 hits in 7 files, expected for raw traces). |
| Round 1 vs. Round 2 equality (AC-M3-01) | **PASS.** `compare-rounds.mjs` on `judge/full2-round1/judge-v1.json` and `judge/full2-round2/judge-v1.json` gives `verdict: "PASS"`, `sameSha: true`, `rows: [233, 233]`, `onlyInFirst: []`, `onlyInSecond: []`, `sameResult: true`. Direct 488-row comparison across all five phases (`compare-488-rounds.json`) gives `verdict: "PASS"`, `round1Rows: 488`, `round2Rows: 488`, `onlyInRound1: []`, `onlyInRound2: []`, `cHostNegativeEqual: true` (`PASS` in both rounds) and `sameResult488: true`. |

Records in `R` for `full2` round 2 and comparisons (manifest `judge/full2-round2/MANIFEST-full2-round2.sha256`, `82cbc38a…`, 23 entries):
- `judge/full2-round2/grant-msg_8a7fc83b1a13.txt` (`c83a811c…`), `judge/full2-round2/inputs.sha256` (`3a169941…`) and `judge/full2-round2/bind-v2.txt` (`62dc26fb…`).
- `judge/full2-round2/round-direct.txt` (`34aaaaa3…`), `judge/full2-round2/id-set.txt` (`8d9d98ee…`) and `judge/full2-round2/actual-ids.tsv` (`97e37fa1…`).
- `judge/full2-round2/judge-v1.json` (`76b1004b…`) and `judge/full2-round2/judge-v2.json` (`49084aed…`).
- `judge/full2-round2/canvas-browser-targets.json` (`b36e1ce2…`), `scan/full2-round2/r2-sim-canvas-browser-scan.json` (`d82c6665…`) and `judge/full2-round2/visual-check.txt` (`54a7a4ca…`).
- `judge/full2-round2/compare-rounds.json` (`9246450d…`) and `judge/full2-round2/compare-488-rounds.json` (`4678381e…`).
- `judge/full2-round2/deviations-r2.txt` (`223ce095…`) and `judge/full2-round2/round-record.txt` (`948d59ed…`). All seven `*.stderr` files are 0 bytes.
- Disclosure D-5 (`judge/full2-round2/deviations-r2.txt`): the first inline `node -e` invocations for `inputs.sha256` and `r2-sim-canvas-browser-scan.json` omitted `--input-type=module` (and referenced `t.sharedPng` instead of `t.shared`) before the immediate rerun; `inputs.sha256` (v1, kept unchanged) checked `sum.productSha` instead of `sum.sha` on `summary.json`, while `bind-v2.txt` (`62dc26fb…`) checks `sum.sha === SHA` (all five `summarySHA=true`).
- Window disclosures carried from Lead/Common records (not inspected by Canvas QA-E2E): `full2` W3 (`ee6a4afa…`) protects 10 volume records under Lead decision `msg_1364abcfecfe` (original exact-nine precondition deviation recorded); a transient Savoy probe (`sto-rmq-probe`) at `07:32Z` during round-1 `sim` was gone before the `07:37:53Z` `snapshot-isolated` PRE check, and all phase isolation checks passed; LA and Savoy hold Docker work until explicit handoff; overall `full2` W4 remains pending after legacy.

### 22.4 Disposition

- Canvas M1 at C4 `bf09cda` (`full2` retry): both 488-row rounds are complete (`488/488 PASS` each, exact 488-row set, accounting parse-equal in all 10 phase files), Canvas rows pass `233/233` in round 1 and `233/233` in round 2, both sink gates pass, both browser scans and visual checks pass, and round-1 vs. round-2 per-case equality passes (`233/233` Canvas and `488/488` overall, including `M1-41.common.c-host-negative`).
- **Overall M1 and M3 acceptance: PENDING.** Common QA's 12 legacy groups and final `full2` W4 comparison, followed by fresh M2 and fresh T7 under separate exclusive Docker windows, remain required.
- All 32 live rows remain UNVERIFIED; local Canvas remains DEFERRED. Earlier candidates keep their own records and carry no credit to C4.
