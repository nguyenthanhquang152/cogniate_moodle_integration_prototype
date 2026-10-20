Verdict: PREPARED — Canvas simulator and Canvas M1 cases are ready; harness checks only, no product verification
Round: 5 (verification checkpoint and capture repair, task `task_e28388df4dcc`; see §11)
Owner: independent Codex Canvas QA quota replacement, authorized by Lead for GPT-6-Astra at xhigh; earlier Claude reports remain below
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
