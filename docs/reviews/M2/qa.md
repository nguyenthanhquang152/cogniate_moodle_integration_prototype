Verdict: FAIL — frozen M2 SIM run: 35 PASS, 29 FAIL; repair preparation only
Round: 4, verification task `task_e28388df4dcc`, dispatch `ctx_8ec51c3aa7b5`
Owner: independent Codex Canvas QA quota replacement, authorized by Lead for GPT-6-Astra at xhigh

Sections 1–4 preserve the earlier preparation record. The current execution result is in section 5.

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
