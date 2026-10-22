Verdict: M2 functional PASS — fifth frozen run at `aff4882`: 64/64, capture coverage complete, clean boundary; external observer log leak FAIL/incident, contained (history: `004568b` PASS, `e3cd7db` 60/4)
Round: 8, verification task `task_e28388df4dcc`, dispatch `ctx_4a94125660be` (earlier rounds: `ctx_8ec51c3aa7b5`)
Owner: original Claude Canvas QA (`claude-opus-5-5`, xhigh), resumed by owner request; round 5 owner was the independent Codex quota replacement

Sections 1–5 preserve earlier preparation and execution records. Sections 6–8 retain rounds 5–7. The current execution result is in section 9.

## 1. Inputs and result

Lead authorized this quota replacement at `0b6808e05fe93c5dee9aa0537eae1f470a4be2ab`. The start handoff supplied applied contracts `ccdd9ef67cdd2be4c6af374136777fda4e081943` and narrow QA repair `3b160f7bc22ca43f18bc16c94ecfc336b0fe80d6`. Approved proposal: `78bc34ac422e0bcac324fa10e69ec9f82a17a3b8`; approvals: `b6e8f739e6de752cb287929c9836734d2494e444`. Adopted A-D-09 precision governs.

M2 keeps **64 browser cases and all 13 criteria**. Every existing case ID, title and manifest entry remains unchanged. Exact neutral readiness checks extend the existing Canvas and Blackboard error cases. Expected text comes from applied M2 and app §4.7.3, not product code or author notes.

## 2. Prepared checks

| Existing case | Expected readiness result |
| --- | --- |
| `M2-05.lti-service-error` | The original LTI failure remains. With a previously issued Canvas code and simulation profiles now off, Save shows the neutral title and action. The connection stays pending and the code is cleared. |
| `M2-06.retry-after-error` | The original successful second Save remains. A separate pending connection refuses while its shared platform is inactive, shows the same text, and registers with the same code after reactivation. |

The exact title is `This LMS setup is not ready in Cogniate.`

The exact action is `Ask your Cogniate operator to check the LMS setup for this connection. The operator tells you to try again later, or to make a new connection.`

The Blackboard card guidance remains `Blackboard is not set up for this Cogniate service yet. Ask your Cogniate operator.` It is still asserted in `M2-02.not-ready`; the two error cases require the separate neutral text above.

The current same-document, live-poll cancellation observation in `08-routes.m2.ts` is unchanged. Moodle still requires `Disconnect Moodle?` and `This stops launches through this connection. The tool stays in Moodle.` The card, route, detail and Moodle files have no diff.

## 3. Preparation evidence

| Check | Result |
| --- | --- |
| `node tests/e2e/host/run-m2.mjs --harness-only` | Two harness self-checks pass; typecheck passes; all 64 M2 rows are discovered and accounted; T7 discovery unchanged. |
| Manifest comparison | All 64 committed entries remain exactly equal. |
| Protected file comparison | `00-blackboard-not-ready.m2.ts`, `01-cards.m2.ts`, `04-detail.m2.ts` and `08-routes.m2.ts` unchanged. |
| `git diff --check` on owned files | Clean. |

These are discovery and harness results only. No browser acceptance, simulated product acceptance, stack, migration, legacy suite, full root check or tenant run occurred. There is no product PASS, screenshot evidence or live LMS claim.

## 4. Held paths and next handoff

- `tests/e2e/M2/02-canvas-wizard.m2.ts`
- `tests/e2e/M2/03-blackboard-wizard.m2.ts`
- `tests/e2e/M2/lib/m2.ts`
- `tests/acceptance/M1/canvas/browser.ts` — expands the action type to the existing host `m1-profile` control
- `docs/reviews/M2/qa-plan.md`
- `docs/reviews/M2/qa.md`

The shared browser helper is also listed once in [the Canvas M1 report](../M1/qa-canvas.md), which records all other Canvas paths and inventories. No M2 manifest, host runner, common QA file or product file changed. No commit or push was made.

Lead must integrate these paths and freeze the product and test SHAs for the separate independent verification task. Full M1 still requires both complete rounds, including the common QA owner's mixed-provider `011→012` route. M2 browser and real Moodle regression evidence remain pending.

## 5. Round 4 — frozen M2 execution and repair preparation (2026-10-20)

**FAIL.** All 64 named browser cases ran: **35 PASS, 29 FAIL, zero skips, zero retries**. Both product and test SHA were `eb43247d02df622d5da72dafac41d919f65a91fe`. The failed run remains attached to that SHA. Later edits are not part of its evidence and do not turn a failed row into PASS.

Applied criteria: `ccdd9ef67cdd2be4c6af374136777fda4e081943`. Lead granted the exclusive window in `msg_cb4eaf43472a`. During this run, `msg_478c680eab7a` marked the candidate obsolete and held T7 for the repair freeze. Lead accepted the failed run and authorized owned test repairs in `msg_d8dc5181f08c`.

### 5.1 Run identity and evidence

- Label: `SIM`. Project `qa-e2e-sim-r1`, port `8643`, subnet `172.27.0.0/16`, profile `acceptance`.
- Run id: `qa-e2e-sim-r1-eb43247d-2026-10-20T12-34-50-805Z`.
- Frozen external source: `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-eb43247-21t8wgiv/source`; fresh runtime clone: `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-eb43247-21t8wgiv/m2-stack`.
- Artifact directory **A**: `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-eb43247-21t8wgiv/source/tests/host/artifacts/qa-e2e-sim-r1-eb43247d-2026-10-20T12-34-50-805Z`. Paths below are relative to A unless stated otherwise.
- Browser start `2026-10-20T12:35:31.048Z`; Playwright duration `38.619 s`; complete browser command `40.875 s`, exit `1`. Chromium through Playwright `1.56.0`; the exact Chromium version was not retained by this runner. No TLS bypass was used.
- `m2-case-results.json`: all 64 named outcomes and both SHAs. `evidence/m2/playwright-results.json`: per-case failures, timing and attachments. `cmd/09-m2-browser-pass.log`: exact browser command and output.
- Sixteen retained PNGs under `evidence/m2/playwright/`; approval inputs are masked. These cover the reached states only. Registration failed in setup, so screenshots of every successful wizard step are **not complete**.
- `summary.json` records `M2-STACK` PASS with LTI profile `acceptance`, simulation profiles `["blackboard-sim","canvas-sim-cloud"]` and app profile `acceptance`. The executed runner also asserted empty knobs on both services and running `lms-sim`/`lti-gate`. It retained this reduced health record, not the full response bodies.
- `images.json` records service image ids. `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-eb43247-21t8wgiv/m2-images.json` adds repository digests and the exact local e2e image id. Node: `sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f`; Moodle: `sha256:3a310197e51ff34c6e8e8adbb92703fe598f71cbcf9eb974055c27f07f4cb23d`; e2e: `sha256:bc6f12c5f1338f8627fe3d638644df4f017f17a8c1db72a468f549792628c69f`.

Command, from the frozen external source:

```sh
COMPOSE_PROJECT_NAME=qa-e2e-sim-r1 PUBLIC_PORT=8643 STACK_SUBNET=172.27.0.0/16 \
COURSE_FIXTURES_DIR=/Users/quangnguyen/Workspaces/personal/cogniate_moodle_integration_prototype/docs/raw/data/courses \
node tests/e2e/host/run-m2.mjs \
  --sha eb43247d02df622d5da72dafac41d919f65a91fe \
  --test-sha eb43247d02df622d5da72dafac41d919f65a91fe \
  --workdir /Users/quangnguyen/cogniate-canvas-qa-runs/verification-eb43247-21t8wgiv/m2-stack
```

Both course hashes matched the approved fixtures before startup. The host Build Runner had a live process and a heartbeat age of `1.107 s` during setup; this does not prove a course build, which the failed browser setup never reached.

### 5.2 Criteria and named subcases

Every row uses the same command, SHAs, run id and artifact directory from section 5.1. A criterion fails if any named case fails.

| Criterion | PASS | FAIL | Verdict |
| --- | ---: | ---: | --- |
| AC-M2-01 | 2 | 1 | FAIL |
| AC-M2-02 | 2 | 0 | PASS |
| AC-M2-03 | 19 | 0 | PASS |
| AC-M2-04 | 5 | 1 | FAIL |
| AC-M2-05 | 1 | 5 | FAIL |
| AC-M2-06 | 0 | 4 | FAIL |
| AC-M2-07 | 1 | 2 | FAIL |
| AC-M2-08 | 1 | 2 | FAIL |
| AC-M2-09 | 1 | 2 | FAIL |
| AC-M2-10 | 0 | 2 | FAIL |
| AC-M2-11 | 2 | 4 | FAIL |
| AC-M2-12 | 0 | 2 | FAIL |
| AC-M2-13 | 1 | 4 | FAIL |

Named results (`CLI` = grant setup failed before the requested behavior; `ORDER` = viewport-coordinate assertion failed):

| Case id | Result | Evidence detail |
| --- | --- | --- |
| `M2-01.cards` | PASS | Reached assertions passed |
| `M2-01.isolated-newest` | FAIL | CLI |
| `M2-01.moodle-card` | PASS | Reached assertions passed |
| `M2-02.not-ready` | PASS | Reached assertions passed |
| `M2-02.ready` | PASS | Reached assertions passed |
| `M2-03.profile-labels` | PASS | Reached assertions passed |
| `M2-03.rule1-fragment` | PASS | Reached assertions passed |
| `M2-03.rule1-http` | PASS | Reached assertions passed |
| `M2-03.rule1-path` | PASS | Reached assertions passed |
| `M2-03.rule1-query` | PASS | Reached assertions passed |
| `M2-03.rule1-userinfo` | PASS | Reached assertions passed |
| `M2-03.rule2-ipv4` | PASS | Reached assertions passed |
| `M2-03.rule2-ipv6` | PASS | Reached assertions passed |
| `M2-03.rule2-localhost` | PASS | Reached assertions passed |
| `M2-03.rule2-sub-localhost` | PASS | Reached assertions passed |
| `M2-03.rule3-app` | PASS | Reached assertions passed |
| `M2-03.rule3-content` | PASS | Reached assertions passed |
| `M2-03.rule3-lti` | PASS | Reached assertions passed |
| `M2-03.rule4-service-sso` | PASS | Reached assertions passed |
| `M2-03.rule4-sso` | PASS | Reached assertions passed |
| `M2-03.rule4-sso-port` | PASS | Reached assertions passed |
| `M2-03.rule5-instructure` | PASS | Reached assertions passed |
| `M2-03.valid-default-service` | PASS | Reached assertions passed |
| `M2-03.valid-split` | PASS | Reached assertions passed |
| `M2-04.clipboard-denied` | PASS | Reached assertions passed |
| `M2-04.copy-json` | PASS | Reached assertions passed |
| `M2-04.download-failure` | PASS | Reached assertions passed |
| `M2-04.download-json` | PASS | Reached assertions passed |
| `M2-04.inline` | PASS | Reached assertions passed |
| `M2-04.rows` | FAIL | ORDER |
| `M2-05.grant-invalid` | FAIL | CLI |
| `M2-05.grant-mismatch` | FAIL | CLI |
| `M2-05.invalid-values` | PASS | Reached assertions passed |
| `M2-05.lti-service-error` | FAIL | CLI |
| `M2-05.platform-in-use` | FAIL | CLI |
| `M2-05.success` | FAIL | CLI |
| `M2-06.deployment-in-use` | FAIL | CLI |
| `M2-06.retry-after-error` | FAIL | CLI |
| `M2-06.second-deployment` | FAIL | CLI |
| `M2-06.success` | FAIL | CLI |
| `M2-07.badges` | PASS | Reached assertions passed |
| `M2-07.canvas-detail` | FAIL | CLI |
| `M2-07.no-add-elsewhere` | FAIL | CLI |
| `M2-08.blackboard-no-moodle-features` | FAIL | CLI |
| `M2-08.canvas-no-moodle-features` | FAIL | CLI |
| `M2-08.moodle-controls` | PASS | Reached assertions passed |
| `M2-09.blackboard-dialog` | FAIL | CLI |
| `M2-09.canvas-dialog` | FAIL | CLI |
| `M2-09.moodle-dialog` | PASS | Reached assertions passed |
| `M2-10.canvas-results` | FAIL | CLI |
| `M2-10.publish-dialog` | FAIL | CLI |
| `M2-11.add-deployment-keyboard` | FAIL | CLI |
| `M2-11.axe-blackboard` | PASS | Reached assertions passed |
| `M2-11.axe-canvas` | PASS | Reached assertions passed |
| `M2-11.axe-canvas-detail` | FAIL | CLI |
| `M2-11.blackboard-keyboard` | FAIL | CLI |
| `M2-11.canvas-keyboard` | FAIL | CLI |
| `M2-12.blackboard` | FAIL | CLI |
| `M2-12.canvas` | FAIL | CLI |
| `M2-13.cross-library` | FAIL | CLI |
| `M2-13.cross-provider` | FAIL | CLI |
| `M2-13.form-state` | PASS | Reached assertions passed |
| `M2-13.no-stale-values` | FAIL | CLI |
| `M2-13.routes-open` | FAIL | CLI |

### 5.3 Failure roots and authorized corrections

1. **Q-M2-CLI — shared host-control blocker, 28 cases.** `tests/host/m1-control.mjs` runs `npm run <script> -w services/<service>` inside a service container whose compose working directory is already `/repo/services/<service>`. Grant issue exits `1`: `No workspaces found: --workspace=services/cogniate-app`. Each affected row stopped before its grant-dependent behavior. Common QA owns the cwd repair and the positive app/LTI operator CLI controls. No product verdict is inferred from these setup failures.
2. **Q-M2-ORDER — owned harness defect, `M2-04.rows`.** The loop compared viewport y coordinates across Copy clicks. A click scrolls the viewport; the method row was at `502.234375`, below the previous recorded comparison value `899.1875`. The repair measures all four row positions before the first click, then runs every original Copy and exact clipboard assertion. Case id, four-row count, visible values and strict order are unchanged. Product execution of the repaired assertion is pending.

The real Canvas and Blackboard readiness paths were **not reached**. The same-document live-poll case also failed in setup: there is no observed cancellation or delivered late response from this run. The unchanged case can observe cancellation; it must not be described as proving that a late response was delivered. The Moodle card, controls and exact disconnect text passed their named M2 checks, but this is not the full T7 Moodle regression.

### 5.4 Harness checks after the correction

- `node tests/e2e/host/run-m2.mjs --harness-only`: PASS, two self-checks, typecheck, exactly 64 named cases; T7 discovery unchanged. Log `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-eb43247-21t8wgiv/m2-repair-harness.log`.
- Local synthetic-page check of the actual old and repaired assertion blocks: old loop fails after scroll; repaired loop checks all four rows and four Copy values; reversed rows fail. Chrome `155.0.8059.85`, no product, stack or network request. Result `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-eb43247-21t8wgiv/m2-row-order-harness.json`. This is a harness check, not SIM acceptance.
- `git diff --check` on owned test paths: PASS. All case ids and manifests remain unchanged.

### 5.5 Hygiene, cleanup and next gate

The runner's captured-secret scan passed: **1 captured value, 49 files, zero hits** in service/simulator/gate logs and redacted evidence. This result is limited: grant and learner paths did not execute, so it does not prove the full successful-flow secret inventory. Raw values remain in the private external clone, outside shared evidence.

Cleanup passed at `2026-10-20T12:37:25.151515Z`: zero containers, all seven baseline Docker volume metadata records exactly unchanged, only `bridge`, `host` and `none` networks, and no owned Build Runner process. Full before/after evidence: `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-eb43247-21t8wgiv/baseline-before.json` and `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-eb43247-21t8wgiv/baseline-after-m2.json`. No Docker Desktop setting, real tenant, account or public exposure changed.

Lead received the failure and clean boundary in `msg_43f19e48bd65`. **T7, demo/check-confirm and another M2 stack remain HOLD** until repair freeze and a new exclusive window. Core QA still owns both complete M1 rounds; Canvas will judge its 233 rows from those exact per-case artifacts. All live LMS rows stay UNVERIFIED. No full root check, migration, legacy acceptance or live provider run was performed here.

## 6. Round 5 — second frozen M2 run and diagnostic hygiene (2026-10-20)

**FAIL: 61 PASS, 3 FAIL, zero skips and zero retries.** Product and test SHA: `ae130a3501f3a2502c6a34e36319629e3dcdfb09`. Applied criteria remain `ccdd9ef67cdd2be4c6af374136777fda4e081943`. Lead authorized the exclusive window in `msg_499d8986cf43` after the narrow common QA controls passed. This round supersedes the execution result in §5, not its historical evidence.

### 6.1 Identity and execution

Run `qa-e2e-sim-r2-ae130a35-2026-10-20T13-02-19-726Z`; project `qa-e2e-sim-r2`; port `8643`; subnet `172.27.0.0/16`; profile `acceptance`. External evidence root (`R`): `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-ae130a3-s73h9dlx`. Frozen source: `R/source`. Fresh runtime clone: `R/m2-stack`. Artifact directory (`A`): `R/source/tests/host/artifacts/qa-e2e-sim-r2-ae130a35-2026-10-20T13-02-19-726Z`.

Executed from the frozen source:

```sh
COMPOSE_PROJECT_NAME=qa-e2e-sim-r2 PUBLIC_PORT=8643 STACK_SUBNET=172.27.0.0/16 \
COURSE_FIXTURES_DIR='/Users/quangnguyen/Workspaces/personal/cogniate_moodle_integration_prototype/docs/raw/data/courses' \
node tests/e2e/host/run-m2.mjs \
  --sha ae130a3501f3a2502c6a34e36319629e3dcdfb09 \
  --test-sha ae130a3501f3a2502c6a34e36319629e3dcdfb09 \
  --workdir /Users/quangnguyen/cogniate-canvas-qa-runs/verification-ae130a3-s73h9dlx/m2-stack
```

The Playwright pass began at `2026-10-20T13:03:00.689Z` and took `131844.29 ms`. Runner exit: `1`; strict result accounting rejects the three failed rows. Browser observed inside the actual e2e container: Chromium `141.0.7390.37`, Playwright `1.56.0`, Linux arm64. `A/evidence/m2/playwright-results.json`, `A/m2-case-results.json` and `A/cmd/09-m2-browser-pass.log` hold the redacted results. There are 35 masked screenshots in `A/evidence/m2/playwright`. QA visually inspected the Canvas teacher picker and Blackboard step 4; successful learner completion screenshots do not exist because those steps failed.

Full health and browser/image/Build Runner observations are in `R/qa-e2e-sim-r2-observation.jsonl`. At `13:02:30.047Z`, all three service health endpoints returned 200, `profile: acceptance`, empty knobs, and LTI profiles `blackboard-sim`, `canvas-sim-cloud`. The readiness cases deliberately removed profiles, observed empty profiles at `13:03:22.784Z`, then restored both at `13:03:29.129Z`. Initial startup probes before services were ready are recorded separately; they are not passing health evidence. Fresh Build Runner PID `40074` started at `13:02:53Z`; observed alive with image ready and a fresh heartbeat during browser execution.

Image IDs (full repository digests are in the observer; service inventory is `A/images.json`):

| Image | ID |
| --- | --- |
| Node `24.22.0-alpine3.24` | `sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f` |
| Moodle `v5.2.4` | `sha256:3a310197e51ff34c6e8e8adbb92703fe598f71cbcf9eb974055c27f07f4cb23d` |
| Caddy `2.11.7-alpine` | `sha256:d8542f48d34a9cf4e4c11a478865229840e87e4c96ea3f439101f31a5d35f75f` |
| Postgres `16-alpine` | `sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea` |
| E2E `1.56.0` | `sha256:27d1576af12a9a03852704ff30d5db61c957d3a69e097b7e18f31238e5e0b2df` |

### 6.2 All named outcomes

All 64 existing cases ran once. `M2-04.rows` now passes all four values, strict row order and Copy checks. Both provider registration/readiness paths are reached. Exact neutral readiness text, Blackboard card guidance, Moodle card/control/disconnect text and keyboard/axe checks pass their named cases. These observations do not replace T7.

| Case | Outcome |
| --- | --- |
| `M2-02.not-ready` | PASS |
| `M2-02.ready` | PASS |
| `M2-01.cards` | PASS |
| `M2-01.isolated-newest` | PASS |
| `M2-01.moodle-card` | PASS |
| `M2-03.profile-labels` | PASS |
| `M2-03.rule1-http` | PASS |
| `M2-03.rule1-path` | PASS |
| `M2-03.rule1-query` | PASS |
| `M2-03.rule1-fragment` | PASS |
| `M2-03.rule1-userinfo` | PASS |
| `M2-03.rule2-ipv4` | PASS |
| `M2-03.rule2-ipv6` | PASS |
| `M2-03.rule2-localhost` | PASS |
| `M2-03.rule2-sub-localhost` | PASS |
| `M2-03.rule3-lti` | PASS |
| `M2-03.rule3-app` | PASS |
| `M2-03.rule3-content` | PASS |
| `M2-03.rule4-sso` | PASS |
| `M2-03.rule4-sso-port` | PASS |
| `M2-03.rule5-instructure` | PASS |
| `M2-03.rule4-service-sso` | PASS |
| `M2-03.valid-split` | PASS |
| `M2-03.valid-default-service` | PASS |
| `M2-04.rows` | PASS |
| `M2-04.copy-json` | PASS |
| `M2-04.download-json` | PASS |
| `M2-04.inline` | PASS |
| `M2-04.clipboard-denied` | PASS |
| `M2-04.download-failure` | PASS |
| `M2-05.success` | PASS |
| `M2-05.grant-invalid` | PASS |
| `M2-05.grant-mismatch` | PASS |
| `M2-05.platform-in-use` | PASS |
| `M2-05.invalid-values` | PASS |
| `M2-05.lti-service-error` | PASS |
| `M2-06.success` | PASS |
| `M2-06.deployment-in-use` | PASS |
| `M2-06.retry-after-error` | PASS |
| `M2-06.second-deployment` | PASS |
| `M2-07.badges` | PASS |
| `M2-07.canvas-detail` | PASS |
| `M2-07.no-add-elsewhere` | PASS |
| `M2-08.canvas-no-moodle-features` | PASS |
| `M2-08.blackboard-no-moodle-features` | PASS |
| `M2-08.moodle-controls` | PASS |
| `M2-09.blackboard-dialog` | PASS |
| `M2-09.canvas-dialog` | PASS |
| `M2-09.moodle-dialog` | PASS |
| `M2-10.publish-dialog` | PASS |
| `M2-10.canvas-results` | PASS |
| `M2-11.canvas-keyboard` | PASS |
| `M2-11.blackboard-keyboard` | PASS |
| `M2-11.add-deployment-keyboard` | PASS |
| `M2-11.axe-canvas` | PASS |
| `M2-11.axe-blackboard` | PASS |
| `M2-11.axe-canvas-detail` | PASS |
| `M2-12.canvas` | FAIL |
| `M2-12.blackboard` | FAIL |
| `M2-13.routes-open` | PASS |
| `M2-13.cross-provider` | PASS |
| `M2-13.no-stale-values` | FAIL |
| `M2-13.form-state` | PASS |
| `M2-13.cross-library` | PASS |

### 6.3 Three failures and evidence limits

- **M2-12.canvas and M2-12.blackboard — player boot failure.** Both reached real HTML upload, portal publication, the framed teacher pick and the expected Deep Linking resource. Learner frames were app `/play/[play_id]`, content `/rt/[runtime_token]` and `about:blank`; `doCourse` timed out after 30 seconds waiting for `/pkg/.../index.html`. In both learner windows, service logs show shell entry 200 followed by a player asset 404, and runtime page 200 followed by a runtime asset 404; no runtime-state request follows. The normalized logs do not expose the missing filenames. They corroborate the author's submitted diagnosis of a shared generated player chunk that the existing asset routes do not serve. Product player build ownership was forwarded through Lead; package selectors, real-course completion, score 100 and Sent assertions stay unchanged. `A/player-boot-sanitized-sequence.json` preserves the sequence.
- **M2-13.no-stale-values — product history/DOM transition defect.** The case opens Canvas once, installs the existing MutationObserver, delays subsequent Canvas detail requests by 3 seconds, clicks Refresh status, then changes the LMS connection selector to Blackboard without a document reload. It waits for the Blackboard URL and visible site, then 7 seconds and checks the observer. The observer saw Canvas page/service URLs and a Canvas deployment ID while the pathname was Blackboard. It verifies an intercepted Canvas request, but does not record whether the held response was delivered or cancelled. The failure therefore proves a stale URL/DOM observation, not a late response repopulation. The original same-document and live-poll/cancellation observation remains unchanged. Lead relayed the author's independent BrowserRouter reproduction in `msg_4f75f0cd85fa`: history changes before concurrent React commits the replacement view, while cancellation works and the late response does not repopulate the new route. This classifies the defect as the product navigation boundary; the frozen browser result alone does not establish that internal cause. No readiness wait or observer was weakened.

Sanitized handoffs: `msg_12f41af5ebdd` and `msg_f228085d8a97`. No raw capability value was included. No new product run occurred during triage.

### 6.4 Privacy gap, containment and harness repair

**The original runner scan is insufficient for AC-M3-07.** It reported 52 captured values, 63 files and zero hits, but M2 used `doCourse` without T7's launch capture and did not install the existing browser request capture. Timeout diagnostics retained two runtime tokens and two play IDs. This is a harness evidence leak; no service-log hit for the two missed runtime values was found. Do not promote the original zero-hit count to a full privacy PASS.

Shared text copies were sanitized with stable placeholders, 16 replacements across the browser command log and JSON report. The originals stay mode `0600` under the private external runtime clone. The independent rescan covers 77 shared text files and finds zero remaining hits for those four values. `R/runtime-diagnostic-redaction.json` and `R/capability-diagnostic-redaction.json` record counts and before/after hashes without secret values. This containment does not repair the historical capture inventory or prove the future automatic scan.

Owned repair installs request-time capture before navigation in every M2 context, including `libraryPage`; records URL capabilities and launch form/query values only through the existing private recorder; and formats frame timeout and blocked-request URLs without credentials, query/fragment values or runtime/play/picker path tokens. The common owner extended the recorder's accepted kinds for `play_id` and `picker_id`; no duplicate writer was added. Both actual frame-wait branches have negative controls with synthetic full capabilities. Cases, product actions, timing, completion and route assertions are unchanged.

`node tests/e2e/host/run-m2.mjs --harness-only`: **5 PASS**, typecheck PASS, exact 64-case discovery and unchanged T7 selection. `node tests/host/run-m1.mjs --harness-only --provider canvas`: **33 PASS**, typecheck PASS, 251 API plus 24 host/browser rows including common. Logs: `R/m2-hygiene-harness.log` and `R/canvas-hygiene-harness.log`. These are harness checks only; the automatic capture repair still requires the next frozen browser run.

### 6.5 Cleanup and next gate

Cleanup at `2026-10-20T13:06:07.255505+00:00` found zero containers, exactly the same seven complete baseline volume metadata records, only `bridge`, `host`, `none` networks, and no owned Build Runner. `R/baseline-before.json` and `R/baseline-after-m2.json` retain the comparison. The window was released to Lead in `msg_dde9a4b82cc9`; Lead confirmed the hold in `msg_fc6e9ba4bbca`.

**T7 is NOT RUN / HOLD**, including the three-run sequence, demo and confirmation checks. No new stack starts before Lead integrates the product and harness repairs, freezes exact SHAs and assigns a new exclusive window. Core QA still owns both full M1 rounds and host upgrade evidence; independent Canvas verdicts need all 233 Canvas rows from each. All live LMS matrix rows remain UNVERIFIED. No legacy suite, full root check, live tenant or public exposure was used by this worker.

## 7. Round 6 — third frozen M2 run at `e3cd7db` (2026-10-20)

**FAIL: 60 PASS, 4 FAIL, zero skips, zero retries, zero flaky.** Product and test SHA: `e3cd7dbc11a2c41f9059445b0f011bd1ba5e1e63` (author commit `4b3edd54a24c9ca1f793dc1a9976e19ee2841001`; standalone player scripts and synchronous portal routes). Lead opened the exclusive window in `msg_88bc0ba11c4c`. Applied criteria remain `ccdd9ef67cdd2be4c6af374136777fda4e081943`. This round supersedes the execution result in §6, not its historical evidence. The four failures are QA harness races (§7.3). QA found no product defect, but the product player repair is still not verified.

### 7.1 Identity and execution

Run `qa-e2e-sim-r3-e3cd7dbc-2026-10-20T13-35-07-428Z`; project `qa-e2e-sim-r3`; port `8643`; subnet `172.27.0.0/16`; profile `acceptance`. External evidence root (`R`, mode `0700`): `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-e3cd7db-xSD1OpOM`. Frozen source: `R/source` (clean, detached at the SHA; `tests/` equal to `7ddff36`). Fresh runtime clone: `R/m2-stack`. Artifact directory (`A`): `R/source/tests/host/artifacts/qa-e2e-sim-r3-e3cd7dbc-2026-10-20T13-35-07-428Z`.

Executed from the frozen source:

```sh
COMPOSE_PROJECT_NAME=qa-e2e-sim-r3 PUBLIC_PORT=8643 STACK_SUBNET=172.27.0.0/16 \
COURSE_FIXTURES_DIR='/Users/quangnguyen/Workspaces/personal/cogniate_moodle_integration_prototype/docs/raw/data/courses' \
node tests/e2e/host/run-m2.mjs \
  --sha e3cd7dbc11a2c41f9059445b0f011bd1ba5e1e63 \
  --test-sha e3cd7dbc11a2c41f9059445b0f011bd1ba5e1e63 \
  --workdir /Users/quangnguyen/cogniate-canvas-qa-runs/verification-e3cd7db-xSD1OpOM/m2-stack
```

Preflight before any build, recorded in `R/baseline-before.json`:
- zero containers;
- the seven complete volume metadata records equal the previous baseline exactly;
- networks `bridge`, `host`, `none` only;
- port `8643` free; no overlap with `172.27.0.0/16`;
- no Build Runner process;
- both course zips match their SHA-256 values.

The Playwright pass began at `2026-10-20T13:35:54.379Z` and took `69331.19 ms` (one worker, no retries). Runner exit: `1`. Strict accounting rejects the four failed rows. Redacted results: `A/evidence/m2/playwright-results.json`, `A/m2-case-results.json` and `A/cmd/09-m2-browser-pass.log`. There are 33 screenshots in `A/evidence/m2/playwright`. QA inspected the Blackboard step 3 screenshot: the Approval code field is masked.

Observer: `R/qa-e2e-sim-r3-observation.jsonl`.
- **Browser** (inside the actual e2e container): Chromium `141.0.7390.37`, Playwright `1.56.0`, Linux arm64.
- **Health:** at `13:35:17.196Z`, the LTI, app and content endpoints returned 200 `ok`, with `profile: acceptance`, empty knobs, and LTI `simulation_profiles` `blackboard-sim`, `canvas-sim-cloud`.
- **Readiness cases:** `M2-02` removed the profiles through host control (empty at `13:36:16.182Z`), then restored both (`13:36:22.617Z`).
- **Build Runner:** fresh PID `66554` started at `13:35:48Z`, with the image ready. The observer saw it alive, with heartbeat ages of 0.2–1.9 s.

| Image | ID |
| --- | --- |
| Node `24.22.0-alpine3.24` (app, LTI, simulator, gate, sink, QA platform) | `sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f` |
| Moodle `v5.2.4` | `sha256:3a310197e51ff34c6e8e8adbb92703fe598f71cbcf9eb974055c27f07f4cb23d` |
| Caddy `2.11.7-alpine` | `sha256:d8542f48d34a9cf4e4c11a478865229840e87e4c96ea3f439101f31a5d35f75f` |
| Postgres `16-alpine` | `sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea` |
| E2E `qa-e2e-sim-r3-e2e:1.56.0` | `sha256:152efc18cc3f727e7e05f9505f484756f754b2b194e81ef8239184f4983f24cf` |

### 7.2 All named outcomes

All 64 cases ran once, in execution order. `M2-13.no-stale-values` now passes with the unchanged observer, the held late request and every existing assertion.

| Case | Outcome |
| --- | --- |
| `M2-02.not-ready` | PASS |
| `M2-02.ready` | PASS |
| `M2-01.cards` | PASS |
| `M2-01.isolated-newest` | PASS |
| `M2-01.moodle-card` | PASS |
| `M2-03.profile-labels` | PASS |
| `M2-03.rule1-http` | PASS |
| `M2-03.rule1-path` | PASS |
| `M2-03.rule1-query` | PASS |
| `M2-03.rule1-fragment` | PASS |
| `M2-03.rule1-userinfo` | PASS |
| `M2-03.rule2-ipv4` | PASS |
| `M2-03.rule2-ipv6` | PASS |
| `M2-03.rule2-localhost` | PASS |
| `M2-03.rule2-sub-localhost` | PASS |
| `M2-03.rule3-lti` | PASS |
| `M2-03.rule3-app` | PASS |
| `M2-03.rule3-content` | PASS |
| `M2-03.rule4-sso` | PASS |
| `M2-03.rule4-sso-port` | PASS |
| `M2-03.rule5-instructure` | PASS |
| `M2-03.rule4-service-sso` | PASS |
| `M2-03.valid-split` | PASS |
| `M2-03.valid-default-service` | PASS |
| `M2-04.rows` | PASS |
| `M2-04.copy-json` | PASS |
| `M2-04.download-json` | PASS |
| `M2-04.inline` | PASS |
| `M2-04.clipboard-denied` | PASS |
| `M2-04.download-failure` | PASS |
| `M2-05.success` | PASS |
| `M2-05.grant-invalid` | PASS |
| `M2-05.grant-mismatch` | PASS |
| `M2-05.platform-in-use` | PASS |
| `M2-05.invalid-values` | PASS |
| `M2-05.lti-service-error` | PASS |
| `M2-06.success` | PASS |
| `M2-06.deployment-in-use` | PASS |
| `M2-06.retry-after-error` | PASS |
| `M2-06.second-deployment` | PASS |
| `M2-07.badges` | PASS |
| `M2-07.canvas-detail` | PASS |
| `M2-07.no-add-elsewhere` | PASS |
| `M2-08.canvas-no-moodle-features` | FAIL |
| `M2-08.blackboard-no-moodle-features` | PASS |
| `M2-08.moodle-controls` | PASS |
| `M2-09.blackboard-dialog` | PASS |
| `M2-09.canvas-dialog` | PASS |
| `M2-09.moodle-dialog` | PASS |
| `M2-10.publish-dialog` | PASS |
| `M2-10.canvas-results` | PASS |
| `M2-11.canvas-keyboard` | PASS |
| `M2-11.blackboard-keyboard` | FAIL |
| `M2-11.add-deployment-keyboard` | PASS |
| `M2-11.axe-canvas` | PASS |
| `M2-11.axe-blackboard` | PASS |
| `M2-11.axe-canvas-detail` | PASS |
| `M2-12.canvas` | FAIL |
| `M2-12.blackboard` | FAIL |
| `M2-13.routes-open` | PASS |
| `M2-13.cross-provider` | PASS |
| `M2-13.no-stale-values` | PASS |
| `M2-13.form-state` | PASS |
| `M2-13.cross-library` | PASS |

### 7.3 Four failures: QA harness races

QA owns all four failing helpers. The normalized service logs place each failure before the product finished an asynchronous load that it then completed correctly.

- **`M2-08.canvas-no-moodle-features`, `M2-12.canvas`, `M2-12.blackboard`.** The helpers `publishDialog` (`04-detail.m2.ts`) and `publishVia` (`07-sim-scenario.m2.ts`) read the `LMS connection` options **once** with `select.evaluate()`. The dialog opens with the status `Loading…` and only `Choose a connection`.
  - For `M2-08.canvas`, `GET /app-api/connections` completed at `13:36:36.075Z`. The case failed at about `13:36:36.089Z`.
  - The `M2-12.blackboard` page snapshot, taken just after the failure, already lists `Blackboard M2-… (Blackboard, learn-a.blackboard.sim.test)`.
  - The same helper passed for `M2-08.blackboard-no-moodle-features`. The synchronous route change (`useTransitions={false}`) makes this load window visible; the loading state itself is valid product behavior.
- **`M2-11.blackboard-keyboard`.** The case opens `/integrations/blackboard/connect` and starts pressing Tab at once, up to 80 times. The Blackboard form renders only after `GET /app-api/lms-providers` returns (`13:36:43.223Z`). The case ended at `13:36:43.275Z`, with focus on the sidebar `Assets` link. The snapshot shows the form present after the loop. The Canvas form has no such load and passed.
- **Impact.** Both `M2-12` cases stopped before the teacher pick and the learner launch. **The product player-bundle repair is not verified by M2 yet.** AC-M2-08, AC-M2-11 and AC-M2-12 stay FAIL for this run.

QA requested a test-only repair in `msg_523fd7d86744`. Lead authorized it as a bounded, held QA repair in `msg_3590cf55633f` (see §7.5). The frozen source and runtime clone were not patched. This run stays 60 PASS / 4 FAIL.

### 7.4 Privacy, cleanup and next gate

- **`M3-07-M2` PASS:** 45 captured values, 62 files, 0 hits.
- **Independent private rescan:** 43 clone-captured values over 77 text files, including the runner stdout and observer files: 0 hits.
- **Limit:** the run created no play or runtime capability, because `M2-12` stopped first. Automatic play and runtime capture is therefore still not exercised.
- **`M3-06-M2` PASS:** volumes 7 → 7, containers 0 → 0.
- **`TEARDOWN` PASS:** 0 containers, 0 volumes and 0 networks left.
- **Independent after-check** (`R/baseline-after-m2.json`): zero containers, seven volume records exactly equal to the before snapshot, baseline networks only, no Build Runner process, port `8643` free.

**T7 is NOT RUN / HOLD.** Lead's window allows T7 only after all 64 M2 cases pass and cleanup is complete. The stack window closed after cleanup. The next stage needs a Lead commit of the held repair (§7.5), a new exact SHA, a new exclusive window and a fresh full 64-case run. All live LMS matrix rows remain UNVERIFIED.

### 7.5 Authorized held repairs (no stack)

Lead authorized two bounded QA repairs: the readiness repair (`msg_3590cf55633f`) and the Deep Linking response capture (`msg_b4e09fd0ad1a`, from Reviewer-A finding A-M3-03 MINOR). Both are held in the shared tree for Lead commit. No product, common, Blackboard, runner or manifest path changed. No sleep, retry, skip or timeout change was added.

**Readiness** (`04-detail.m2.ts`, `05-publish-results.m2.ts`, `06-keyboard-axe.m2.ts`, `07-sim-scenario.m2.ts`):
- Before every option snapshot or label read, a retrying `expect(...).toHaveCount(1)` waits for the exact expected option: the M2-07 connection switcher (all three expected options), M2-08 `publishDialog`, the M2-10 dialog (both positive options) and M2-12 `publishVia`.
- All existing assertions follow unchanged: positive options, pending and disabled absence, the option format, the label read and the selection.
- `formReady` waits until the first form field is visible before the first Tab in `M2-11.canvas-keyboard`, `M2-11.blackboard-keyboard` and `M2-11.add-deployment-keyboard`. It does not focus, click or fill the field. The `tabTo` loop, visible-focus check and keyboard-only input are unchanged.

**Capture** (`tests/acceptance/M1/canvas/browser-diagnostics.mjs`, `tests/e2e/M2/browser-secrets.selftest.mjs`):
- The request-time listener now records the signed Deep Linking response (form field `JWT`) through the same private recorder, as kind `id_token`, as T7 does. The helper API, the type surface and all earlier capture kinds are unchanged.
- A new self-check posts a synthetic response JWT. It requires exactly one `id_token` capture, and a scan with the captured values must find the leak in shared failure text.

Evidence (synthetic only; retained in `R/readiness-repair/`):

| Check | Result |
| --- | --- |
| `node tests/e2e/host/run-m2.mjs --harness-only` | 6/6 self-checks PASS (5 earlier + 1 new), typecheck PASS, all 64 cases discovered, T7 selection unchanged |
| `node tests/host/run-m1.mjs --harness-only --provider canvas` | 33/33 PASS, typecheck PASS, 251 API + 24 host rows (unchanged) |
| Scratch readiness controls, host Google Chrome `155.0.8059.85`, Playwright `1.56.0` | 19/19 behave as stated. The spec is generated from 18 verbatim lines of the repaired files and records their SHA-256 values. |
| — old one-shot reads (C01, C06, C12) and the old Tab loop (C15) | Reproduce the frozen failures on delayed synthetic pages |
| — new readiness with delayed valid data (C02, C04, C07, C13, C16) | PASS. `formReady` leaves focus on `BODY`. |
| — negative controls (C03, C05, C08–C11, C14, C17–C19) | Still FAIL: missing option, loaded pending option, loaded disabled option, bad format, keyboard-inaccessible field, form never rendered, focus not visible |
| New capture self-check against the old module (scratch mirror) | FAILS with `actual: []`: the gap is detected. It passes with the repaired module. |

The scratch config uses a 2 s expect timeout for speed (all synthetic delays are shorter); the M2 config keeps 15 s. These are harness checks only. The next frozen browser run must reach the teacher Deep Linking and learner runtime/play steps for the scan to exercise those capabilities.

## 8. Round 7 — fourth frozen M2 run at `004568b` (2026-10-20)

**PASS: 64 PASS, 0 FAIL, zero skips, zero retries, zero flaky.** Product and test SHA: `004568bd4ab8390d64945cb73f16cfdd51d566bf`. This is the Lead commit of the held readiness and capture repairs (§7.5) on top of the `e3cd7db` product. The product and build sources are identical to `e3cd7db`, and the Core legacy timeout repair is `504421b`. Lead opened the exclusive window in `msg_b6726e8da143`. Applied criteria remain `ccdd9ef67cdd2be4c6af374136777fda4e081943`. This round supersedes the execution result in §7, not its history: the `e3cd7db` run stays 60 PASS / 4 FAIL.

### 8.1 Identity and execution

Run `qa-e2e-sim-r4-004568bd-2026-10-20T13-56-30-961Z`; project `qa-e2e-sim-r4`; port `8643`; subnet `172.27.0.0/16`; profile `acceptance`. External evidence root (`R`, mode `0700`): `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-004568b-HS9Wwxx3`. Frozen source: `R/source` (clean, detached at the SHA). Fresh runtime clone: `R/m2-stack`. Artifact directory (`A`): `R/source/tests/host/artifacts/qa-e2e-sim-r4-004568bd-2026-10-20T13-56-30-961Z`.

Before the stack, in the frozen source: `npm ci --prefix tests`, then `node tests/e2e/host/run-m2.mjs --harness-only`: 6/6 self-checks PASS, typecheck PASS, all 64 cases discovered, T7 selection unchanged (`R/frozen-m2-harness.log`). The discovery output was removed, and the source stayed clean.

```sh
COMPOSE_PROJECT_NAME=qa-e2e-sim-r4 PUBLIC_PORT=8643 STACK_SUBNET=172.27.0.0/16 \
COURSE_FIXTURES_DIR='/Users/quangnguyen/Workspaces/personal/cogniate_moodle_integration_prototype/docs/raw/data/courses' \
node tests/e2e/host/run-m2.mjs \
  --sha 004568bd4ab8390d64945cb73f16cfdd51d566bf \
  --test-sha 004568bd4ab8390d64945cb73f16cfdd51d566bf \
  --workdir /Users/quangnguyen/cogniate-canvas-qa-runs/verification-004568b-HS9Wwxx3/m2-stack
```

Preflight (`R/baseline-before.json`):
- zero containers;
- the seven full volume metadata records equal the reference baseline exactly;
- networks `bridge`, `host`, `none` only;
- ports `8643` and `8543` free; no overlap with `172.27.0.0/16`;
- no Build Runner process;
- Docker `29.8.2`, MemTotal `8319238144`, NCPU `12`;
- both course zips match their SHA-256 values.

The Playwright pass began at `2026-10-20T13:57:11.576Z` and took `111896.73 ms`, with one worker and no retries. Runner exit `0`. All 64 rows carry product SHA = test SHA = `004568b…` and environment `SIM`. Redacted results: `A/evidence/m2/playwright-results.json`, `A/m2-case-results.json`, `A/cmd/09-m2-browser-pass.log`. There are 40 screenshots in `A/evidence/m2/playwright`. QA inspected the Canvas learner completion screenshot ("Status: Completed — score 100 sent to Canvas"); no capability is visible.

Observer (`R/qa-e2e-sim-r4-observation.jsonl`):
- **Browser** in the e2e container: Chromium `141.0.7390.37`, Playwright `1.56.0`, Linux arm64.
- **Health:** at `13:56:41.072Z`, LTI, app and content returned 200 `ok`, `profile: acceptance`, empty knobs, and LTI `simulation_profiles` `blackboard-sim`, `canvas-sim-cloud`. `M2-02` removed the profiles through host control (`13:57:33.786Z`) and restored both (`13:57:40.231Z`).
- **Build Runner:** fresh PID `83097` started at `13:57:05Z`, image ready, alive, heartbeat age 0.1–1.3 s.

| Image | ID |
| --- | --- |
| Node `24.22.0-alpine3.24` (app, LTI, simulator, gate, sink, QA platform) | `sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f` |
| Moodle `v5.2.4` | `sha256:3a310197e51ff34c6e8e8adbb92703fe598f71cbcf9eb974055c27f07f4cb23d` |
| Caddy `2.11.7-alpine` | `sha256:d8542f48d34a9cf4e4c11a478865229840e87e4c96ea3f439101f31a5d35f75f` |
| Postgres `16-alpine` | `sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea` |
| E2E `qa-e2e-sim-r4-e2e:1.56.0` | `sha256:6e0220025cc5d88af8c22b28f59e038e0cd4e20d3770ae0b33168415c6f35342` |

### 8.2 All named outcomes

All 64 cases ran once, in execution order. Both `M2-12` cases now complete the real HTML course end to end: portal connection, publish, framed teacher pick, learner completion with score 100, and sync Sent. This verifies the player-bundle repair in SIM.

| Case | Outcome |
| --- | --- |
| `M2-02.not-ready` | PASS |
| `M2-02.ready` | PASS |
| `M2-01.cards` | PASS |
| `M2-01.isolated-newest` | PASS |
| `M2-01.moodle-card` | PASS |
| `M2-03.profile-labels` | PASS |
| `M2-03.rule1-http` | PASS |
| `M2-03.rule1-path` | PASS |
| `M2-03.rule1-query` | PASS |
| `M2-03.rule1-fragment` | PASS |
| `M2-03.rule1-userinfo` | PASS |
| `M2-03.rule2-ipv4` | PASS |
| `M2-03.rule2-ipv6` | PASS |
| `M2-03.rule2-localhost` | PASS |
| `M2-03.rule2-sub-localhost` | PASS |
| `M2-03.rule3-lti` | PASS |
| `M2-03.rule3-app` | PASS |
| `M2-03.rule3-content` | PASS |
| `M2-03.rule4-sso` | PASS |
| `M2-03.rule4-sso-port` | PASS |
| `M2-03.rule5-instructure` | PASS |
| `M2-03.rule4-service-sso` | PASS |
| `M2-03.valid-split` | PASS |
| `M2-03.valid-default-service` | PASS |
| `M2-04.rows` | PASS |
| `M2-04.copy-json` | PASS |
| `M2-04.download-json` | PASS |
| `M2-04.inline` | PASS |
| `M2-04.clipboard-denied` | PASS |
| `M2-04.download-failure` | PASS |
| `M2-05.success` | PASS |
| `M2-05.grant-invalid` | PASS |
| `M2-05.grant-mismatch` | PASS |
| `M2-05.platform-in-use` | PASS |
| `M2-05.invalid-values` | PASS |
| `M2-05.lti-service-error` | PASS |
| `M2-06.success` | PASS |
| `M2-06.deployment-in-use` | PASS |
| `M2-06.retry-after-error` | PASS |
| `M2-06.second-deployment` | PASS |
| `M2-07.badges` | PASS |
| `M2-07.canvas-detail` | PASS |
| `M2-07.no-add-elsewhere` | PASS |
| `M2-08.canvas-no-moodle-features` | PASS |
| `M2-08.blackboard-no-moodle-features` | PASS |
| `M2-08.moodle-controls` | PASS |
| `M2-09.blackboard-dialog` | PASS |
| `M2-09.canvas-dialog` | PASS |
| `M2-09.moodle-dialog` | PASS |
| `M2-10.publish-dialog` | PASS |
| `M2-10.canvas-results` | PASS |
| `M2-11.canvas-keyboard` | PASS |
| `M2-11.blackboard-keyboard` | PASS |
| `M2-11.add-deployment-keyboard` | PASS |
| `M2-11.axe-canvas` | PASS |
| `M2-11.axe-blackboard` | PASS |
| `M2-11.axe-canvas-detail` | PASS |
| `M2-12.canvas` | PASS |
| `M2-12.blackboard` | PASS |
| `M2-13.routes-open` | PASS |
| `M2-13.cross-provider` | PASS |
| `M2-13.no-stale-values` | PASS |
| `M2-13.form-state` | PASS |
| `M2-13.cross-library` | PASS |

### 8.3 Privacy and capture coverage

- **`M3-07-M2` PASS:** 74 captured values (simulator and clone), 63 files, 0 hits.
- **Independent private rescan:** 68 clone-captured values over 80 text files, including the runner stdout, observer output and harness log: 0 hits.
- **Private capture coverage** (counts only, from the single private recorder; JWT kinds come from decoded claims):

| Provider | Teacher Deep Linking | Learner launch |
| --- | --- | --- |
| Canvas | request `id_token` 1; response `JWT` 1 (`aud` Canvas) | resource-link `id_token` 1; `play_id` 2; `runtime_token` 6 |
| Blackboard | request `id_token` 1; response `JWT` 1 | resource-link `id_token` 1; `play_id` 1; `runtime_token` 6 |

The recorder also holds 4 `picker_id`, 5 `ltik`, 8 `state`, 4 `nonce` and 26 `api_key` values. The play and runtime values are grouped by their order between the two Deep Linking responses. The automatic request-time capture (7ddff36) and the response JWT capture (§7.5) are now exercised by a real run.

### 8.4 Cleanup

- **`M3-06-M2` PASS:** volumes 7 → 7, containers 0 → 0.
- **`TEARDOWN` PASS:** 0 containers, 0 volumes and 0 networks left.
- **Independent after-check at `2026-10-20T14:00:03Z`** (`R/baseline-after-m2.json`): zero containers. Volume records, networks and Docker MemTotal/NCPU are exactly equal to the before snapshot. No Build Runner process; ports `8643` and `8543` free.

All T7 gate conditions in `msg_b6726e8da143` were met, so T7 started under the same window. T7 failed through a QA harness race in `tests/e2e/lib/portal.ts`; M2 does not call that function (see [T7 QA](../T7/qa.md#m3-checkpoint-update--fourth-candidate-004568b-t7-executed-fail)).

## 9. Round 8 — fifth frozen M2 run at `aff4882` (2026-10-20)

**PASS: 64 PASS, 0 FAIL, zero skips, zero retries, zero flaky.** Product and test SHA: `aff48823a4c6206d6314d91a95f5eb0979d3e0e7`. The product and build are byte-identical to `e3cd7db`. In `tests/`, only `tests/e2e/lib/portal.ts` differs from `004568b` (the T7 `publishCourse` readiness repair, which M2 does not call). Lead opened the exclusive window in `msg_cd92688894e5`. The `004568b` M2 PASS and the `004568b` T7 FAIL remain history.

### 9.1 Identity and execution

Run `qa-e2e-sim-r5-aff48823-2026-10-20T14-19-46-505Z`; project `qa-e2e-sim-r5`; port `8643`; subnet `172.27.0.0/16`; profile `acceptance`. External evidence root (`R`, mode `0700`): `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-aff4882-eFk7FU4s`. Frozen source: `R/source` (clean, detached). Runtime clone: `R/m2-stack`. Artifacts (`A`): `R/source/tests/host/artifacts/qa-e2e-sim-r5-aff48823-2026-10-20T14-19-46-505Z`.

Before the stack, in the frozen source:
- `npm ci --prefix tests`, then `run-m2.mjs --harness-only`: 6/6 self-checks PASS, typecheck PASS, all 64 cases, T7 selection unchanged.
- T7 inventory: 18 tests in 6 files.
- Preflight (`R/baseline-before.json`): zero containers. The seven volume records, the networks and Docker `29.8.2` / MemTotal `8319238144` / NCPU `12` are exactly equal to the established baseline. No Build Runner; ports `8643` and `8543` free; both course zip hashes match.

The command is the §8.1 command with project `qa-e2e-sim-r5`, both SHAs `aff48823a4c6206d6314d91a95f5eb0979d3e0e7` and `--workdir R/m2-stack`. The Playwright pass began at `2026-10-20T14:20:27.306Z` and took `112997.88 ms`. Runner exit `0`. All rows carry product = test = `aff48823…`, environment `SIM`. There are 40 screenshots. The learner screenshots of both `M2-12` cases show "Status: Completed — score 100 sent to Canvas" and "… to Blackboard".

- **Browser:** Chromium `141.0.7390.37`, Playwright `1.56.0`, Linux arm64.
- **Health:** at `14:19:56.213Z`, 200 `ok`, `profile: acceptance`, empty knobs, both SIM profiles. They were removed (`14:20:51.234Z`) and restored (`14:20:57.673Z`) by `M2-02`.
- **Build Runner:** fresh PID `27365` started at `14:20:20Z`, image ready, alive, heartbeat 0.1–1.3 s.
- **Images:** identical to §8.1 except e2e `qa-e2e-sim-r5-e2e:1.56.0` `sha256:d21b52715db71c24c91d35aba07daa03bd88a029c4ad55f93535b3a53928bd34`.

### 9.2 All named outcomes

| Case | Outcome |
| --- | --- |
| `M2-02.not-ready` | PASS |
| `M2-02.ready` | PASS |
| `M2-01.cards` | PASS |
| `M2-01.isolated-newest` | PASS |
| `M2-01.moodle-card` | PASS |
| `M2-03.profile-labels` | PASS |
| `M2-03.rule1-http` | PASS |
| `M2-03.rule1-path` | PASS |
| `M2-03.rule1-query` | PASS |
| `M2-03.rule1-fragment` | PASS |
| `M2-03.rule1-userinfo` | PASS |
| `M2-03.rule2-ipv4` | PASS |
| `M2-03.rule2-ipv6` | PASS |
| `M2-03.rule2-localhost` | PASS |
| `M2-03.rule2-sub-localhost` | PASS |
| `M2-03.rule3-lti` | PASS |
| `M2-03.rule3-app` | PASS |
| `M2-03.rule3-content` | PASS |
| `M2-03.rule4-sso` | PASS |
| `M2-03.rule4-sso-port` | PASS |
| `M2-03.rule5-instructure` | PASS |
| `M2-03.rule4-service-sso` | PASS |
| `M2-03.valid-split` | PASS |
| `M2-03.valid-default-service` | PASS |
| `M2-04.rows` | PASS |
| `M2-04.copy-json` | PASS |
| `M2-04.download-json` | PASS |
| `M2-04.inline` | PASS |
| `M2-04.clipboard-denied` | PASS |
| `M2-04.download-failure` | PASS |
| `M2-05.success` | PASS |
| `M2-05.grant-invalid` | PASS |
| `M2-05.grant-mismatch` | PASS |
| `M2-05.platform-in-use` | PASS |
| `M2-05.invalid-values` | PASS |
| `M2-05.lti-service-error` | PASS |
| `M2-06.success` | PASS |
| `M2-06.deployment-in-use` | PASS |
| `M2-06.retry-after-error` | PASS |
| `M2-06.second-deployment` | PASS |
| `M2-07.badges` | PASS |
| `M2-07.canvas-detail` | PASS |
| `M2-07.no-add-elsewhere` | PASS |
| `M2-08.canvas-no-moodle-features` | PASS |
| `M2-08.blackboard-no-moodle-features` | PASS |
| `M2-08.moodle-controls` | PASS |
| `M2-09.blackboard-dialog` | PASS |
| `M2-09.canvas-dialog` | PASS |
| `M2-09.moodle-dialog` | PASS |
| `M2-10.publish-dialog` | PASS |
| `M2-10.canvas-results` | PASS |
| `M2-11.canvas-keyboard` | PASS |
| `M2-11.blackboard-keyboard` | PASS |
| `M2-11.add-deployment-keyboard` | PASS |
| `M2-11.axe-canvas` | PASS |
| `M2-11.axe-blackboard` | PASS |
| `M2-11.axe-canvas-detail` | PASS |
| `M2-12.canvas` | PASS |
| `M2-12.blackboard` | PASS |
| `M2-13.routes-open` | PASS |
| `M2-13.cross-provider` | PASS |
| `M2-13.no-stale-values` | PASS |
| `M2-13.form-state` | PASS |
| `M2-13.cross-library` | PASS |

### 9.3 Privacy, capture and cleanup

- **`M3-07-M2` PASS:** 74 values, 63 files, 0 hits.
- **Independent private rescans:** 68 clone-captured values over 81 text files, 0 hits; 8 `.env` secrets over 78 files, 0 hits.
- **Capture coverage** (counts only): identical to §8.3, for each provider (Deep Linking response JWT, resource-link `id_token`, `play_id`, `runtime_token`).
- **`M3-06-M2` and `TEARDOWN` PASS.** Independent after-check at `14:24:23Z`: zero containers; volumes, networks and Docker MemTotal/NCPU exact; no Build Runner or observer process; both ports free.

**Evidence hygiene outcomes for this run.** These are separate from the M2 functional PASS, which Lead accepted in `msg_987f8e232e3b`. This run is not a pristine end-to-end privacy gate.

| Outcome | Result | Detail |
| --- | --- | --- |
| External observer log leak | **FAIL / incident** | At about `14:22:20Z`, the external read-only observer (`R/observe.mjs`, not repository code) crashed when a container vanished between `docker ps` and `docker inspect`. Node printed the failed command output, including container environment values, into `R/observer.stdout.log`: 4 occurrences of 2 values (`LTI_MASTER_KEY` and one `seed.json` value) of the disposable `qa-e2e-sim-r5` stack, now destroyed with its volumes. The values were never forwarded, committed or copied to shared artifacts. |
| Local private containment | PASS | The original is now `R/private/observer.stdout.original.log`, mode `0600`, under the `0700` root and `0700` `private/`. It is not published or opened in shared output. |
| Sanitized copy rescan | PASS | `R/observer.stdout.log`: 4 placeholders for 2 values, 0 remaining hits. SHA-256 before `215367a3df3ea88264b2d1935fbfb778106f70fbb5ea722ee28c2b8549ea39e2`, after `f945c2d5cd0dd31a3c9d72e6415de63bb4b0c5a3b461c43dd1c29d543b731c20` (`R/observer-log-redaction.json`). |
| Observation gap | Recorded | The observer missed the progress lines after `M2-12.canvas` and its `containers_removed` record. Case results come from the runner report. Identity, health and Build Runner records were captured before the crash. |
| Observer repair | PASS (controls) | Lead authorized the external observer repair (`R/observe2.mjs`, SHA-256 `d60dc920f5122d2b3317ae28e071ba7885c19bb780ab287f9d027d7d05c53dc0`): tolerant per-container inspect, no printed `docker` output, error handlers that record only a code. In `R/observer-control/`, byte-identical copies ran against a fake `docker` with a planted synthetic secret. The old observer reproduces the leak and collects nothing. The new one emits no payload, collects the surviving container and image, and withholds an unexpected exception (only `observer_error: uncaught`). |

QA stopped before T7 and reported in `msg_4e94792776cf`. T7 then ran under a new window with the pinned observer and passed (see [T7 QA](../T7/qa.md#m3-checkpoint-update--final-candidate-aff4882-t7-pass)).

## 10. Round 9 — candidate C3 `c4c6d04`: NOT RUN (2026-10-22)

**NOT RUN. No M2 result at this candidate.** A fresh Claude QA-E2E session wrote this note: `claude-opus-5-5`, xhigh; Orca session `34e03f7b-2209-4749-8db7-c5b507717b71`; task `task_5f3f8aa499cb`, dispatch `ctx_1fd6cb09010e`. It did not execute rounds 1–8.

- Candidate product = test `c4c6d045b3a132f72bf059d77367d278de9222fa`. `apps/portal` and `tests/e2e` did not change since `aff4882`; the M2 manifest (64 cases) is unchanged.
- Reason: a fresh M2 run needs the accepted complete Common full and legacy gate and a separate exclusive Docker window. Common's full round 1 failed in storage (470 PASS, 18 FAIL of 488; root row `M1-41.common.g-tamper`). Round 2 and legacy did not run, and the Lead granted no M2 window ([M3 QA-E2E §14](../M3/qa-e2e.md#14-round-11--candidate-c3-c4c6d04-2026-10-22)).
- Prepared only (host): the M2 command of `R/plan/runbook-c4c6d04.md` section B (`32f390b5…`) on lane `qa-e2e-sim-r6`, port 8643, subnet `172.27.0.0/16`, with the window steps of `R/plan/window-commands-c4c6d04.md` (`4435163d…`). `R` = `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-c4c6d04-qA52QXut`.
- All 64 browser cases, the 13 AC and their named subcases stay NOT RUN at this SHA. The 64/64 result at `aff4882` (§9) is history only and gives no credit to this candidate.
