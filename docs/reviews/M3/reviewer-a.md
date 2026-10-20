Verdict: APPROVE
Round: 4

# M3 review: Reviewer-A (correctness and security)

## Round 1 (2026-10-20)

| Item | Value |
| --- | --- |
| Verdict | **APPROVE** for the M3 infrastructure and the prepared harness from the correctness and security lens. No BLOCKER or MAJOR is open. AC-M3-01 to AC-M3-07 are **evidence** criteria. None of them is met yet, because QA has not run the suites. |
| Product and infrastructure revision | `76b03c7f24c15de2f7e164b836b27a398d45158a` (infrastructure as reviewed at `1e2c81f`; the `76b03c7` delta adds the app guard of A-M1-01). |
| Test revision | `9964e6f132e6608216616bff621e3f9ba5667b04` (simulator, common, Blackboard and Canvas M1 harness, M2 browser suite, host runners). |
| Baselines | Behaviour `56591df` (ADR-011 rev 6). Implementation `2941140`. |
| Reviewer | Reviewer-A, Claude Code Opus 5.5, xhigh. Task `task_def3c0e1323e`, dispatch `ctx_8abc3ceb148c`. I did not read any Reviewer-B report. |
| Method | Static reading of `infra/**` changes (compose, transport gate, scripts) and of `tests/sim/**`, `tests/acceptance/M1/**`, `tests/e2e/M2/**` and the host runners. No stack, no product call. |

### Findings

| Id | Sev. | Status | Note |
| --- | --- | --- | --- |
| A-M1-01 | MINOR | Closed at `76b03c7` | An app test override was not limited to the `acceptance` profile. Reported in `docs/reviews/M1/reviewer-a.md`. It affects M3 §3.3: "in every other profile the app calls the LTI service directly" is now enforced in code. |

No other finding.

### Checks

| Topic | Result | Where |
| --- | --- | --- |
| Simulator service | `lms-sim` runs only in the `acceptance` compose profile. Its tests are mounted read-only. Signing keys exist only in memory. Hosts are `.sim.test` aliases only. The QA leaf certificate gets only these names. No real vendor host or certificate is spoofed. | `infra/compose.yaml`, `infra/scripts/gen-certs.sh`, `tests/sim/core/crypto.mjs` |
| Simulation profiles | The LTI service turns them on only with `STACK_PROFILE=acceptance` and `LTI_PROVIDER_SIMULATION=on`. Compose sets the variable only through the acceptance script variables. | LTI `profiles/index.ts`, `config.ts`; `infra/scripts/lib.sh` L90–L96 |
| Transport gate | `lti-gate` runs only in `acceptance`. It adds no production code path and changes no URL check. `/__gate/*` is never forwarded. A held request is still forwarded on release after its caller left, and its answer is discarded. Holds are limited to 600 s, and reset drops held requests. Events hold no header, body, query or secret. The app uses it only through `LTI_API_URL`, which is now refused outside `acceptance`. | `infra/lti-gate/gate.mjs`, `infra/compose.yaml`, app `config.ts` |
| Upgrade and rollback | The scripts refuse to run while `cogniate-app` or `lti-service` runs. The backup lists both databases and their sidecars with size and SHA-256, plus the migration names, and is verified before exit 0. The restore validates the whole backup (form, id, project, files) before any change, replaces exactly the listed files and deletes unlisted sidecars. No ledger row is edited. | `infra/scripts/stack-data.sh`, `stack-data.mjs` |
| Run isolation | Lanes, project names, ports and subnets come from the phase plan. The runners use their own clones and label-scoped teardown (as written in the QA plans; I did not run them). | `tests/host/run-m1.mjs`, `tests/e2e/host/run-m2.mjs` |
| Harness independence | No import of product code; no skipped or focused test; independent signing and expected values. | `tests/**` at `9964e6f` |

### Criteria covered by this report

| AC | Status at this round |
| --- | --- |
| AC-M3-01 M1 QA record with labels | Harness accounts for every M1 criterion and named subcase (common, Blackboard, Canvas manifests). No run, so no evidence. |
| AC-M3-02 Moodle regression | Not run. Prerequisites are the Lead decisions on QA items H-3 and H-6 (portal label baselines) and the approved test-change list. |
| AC-M3-03 M2 QA record | 64 browser rows prepared with screenshot masking of approval codes. No run. |
| AC-M3-04 simulator hygiene | Design holds by reading (in-memory keys, no tracked key file, no secret in simulator logs). Needs the run's `git status` and log scan. |
| AC-M3-05 live matrix | Every live row stays `UNVERIFIED`. No authorization exists. Nothing in this review is live evidence. |
| AC-M3-06 run isolation | Runner design holds by reading. Needs the run record of volumes and containers. |
| AC-M3-07 secrets | Scan design holds by reading (captured ltiks, service keys, tokens, assertions, approval codes against all logs and evidence). Needs the run. |

### Scope limits

The accepted MINOR deferral A-M0-10 (only `canvas-self-hosted` identifier reoccupation after a release) is unchanged. This report does not widen or narrow it. Local Canvas and hosted Canvas remain separate evidence levels, and no live tenant was used.

## Round 2 (2026-10-20): integrated implementation and harness

| Item | Value |
| --- | --- |
| Verdict | **CHANGES_REQUESTED**. A-M3-01 makes several new snapshot/readiness/upgrade assertions incomplete or unable to pass. Harness-only success is insufficient to approve this candidate. M1 has additional product findings; M2 source review is approved separately. |
| Exact reviewed SHA | **`eb43247d02df622d5da72dafac41d919f65a91fe`**, product, infrastructure and harness together. Isolated detached checkout: `/tmp/cogniate-review-a-eb43247.XUbPtw`. |
| Normative basis | Applied contracts `ccdd9ef67cdd2be4c6af374136777fda4e081943`, ADR-011, M1 and M3. Proposal `78bc34a` and approvals `b6e8f73` remain design history. |
| Reviewer | Independent replacement Reviewer-A, Codex GPT-6-Astra, xhigh, authorized by the current team brief at `1cb392e`; task `task_74de10f72cf9`, dispatch `ctx_3604d1e6a48e`. No delegation or cross-model claim. |
| Independence | Read my prior reports and earlier shared findings, including historical B reports at `689e424` and `f89262c`. Did not read the other reviewer's new review or share conclusions before submission. |
| Boundary | Static review plus targeted supplemental units, harness-only commands and independent in-memory probes. No new stack, full acceptance, browser execution, migration run, live tenant or public exposure. Only the three existing Reviewer-A reports were edited; no commit or push. |

### A-M3-01 — MAJOR — New scenarios do not capture all methods they assert

Locations: `tests/acceptance/M1/blackboard/52-snapshot.test.ts:22`–`:35`, `:112`–`:114`, `:143`–`:156`; `blackboard/02-snapshot-isolated.test.ts:20`–`:28`, `:32`–`:39`, `:48`–`:58`; `common/snapshot-migration.probe.ts:121`–`:127`, `:147`–`:153`. Supporting behavior: `common/client.ts:195`, `common/snapshot.ts:16`–`:18`, `:102`–`:107`, and `infra/lti-gate/gate.mjs:204`–`:216`.

The gate emits events only for matched rules. An unmatched method is forwarded **without an event**. `gateRules` replaces the rule list; it does not add catch-all capture. `snapshotScope` starts with reset, and reset leaves no rules. The new `watchAll` helper works when explicitly armed, but several cases do not use it, or replace its rules with a GET-only fault rule.

| Scenario | Concrete effect at this candidate |
| --- | --- |
| Blackboard snapshot i3/i4, `freshRedemption` | `vRule` arms only one GET `/api/providers`. V, POST and PATCH may all execute, but only V is recorded. `vBeforeMutation` requires the missing POST/PATCH and fails. |
| Blackboard x1 retry | The first fault captures V. After `gateReset`, the successful retry has no capture rule; `vBeforeMutation` sees no requests and fails. |
| Isolated Blackboard w/y2/k1, including restart | w's first readiness check and its post-reset retry are unarmed. y2 captures only GET but requires GET plus POST. k1 expects one provider GET before and after restart without arming it. These assertions cannot observe their expected calls. |
| Blackboard z1–z4 cancellation | Only the held V GET is captured. The assertion that no POST/PATCH/DELETE occurred is blind to those methods. Remote-state checks help but do not prove the required absence of outbound calls. |
| Old-011 upgrade h4 | The case does not arm capture before asserting that Canvas add made no `/api/providers` request. An erroneous provider read would pass unseen. |
| Old-011 upgrade h5 Canvas branch | Only the Blackboard branch arms `watchAll`; the Canvas branch requires `['POST', 'GET']` after a reset, so its event array is empty. |

Independent supplemental control used **the actual gate source**, executed with in-memory HTTP/TLS/filesystem boundaries and no listening sockets. With the exact single-provider-GET rule, I sent GET `/api/providers`, POST `/api/platforms/P/deployments`, and PATCH `/api/platforms/P/deployments/D`. All three were forwarded; `received` contained only the GET; the real `vBeforeMutation` oracle threw. After reset, another provider GET was forwarded with zero events. Log: `/tmp/cogniate-review-a-eb43247-gate-probe.log`.

This probe does not mirror the binding implementation, and it is not full acceptance. It demonstrates the gate's actual observation boundary. The hand-built event arrays in current oracle self-tests cannot detect that the scenario failed to arm the gate.

Suggested repair: keep each specific fault rule first, then add trailing pass rules for **all seven supported methods**. Re-arm after every reset and before taking the observation cursor. Use fault catch-alls where required by the local-refusal controls. Retain exact ordering/zero-call assertions and separate the negative window from its positive capture control. Add a meaningful gate/helper check that sends matched and otherwise-unmatched methods through the real gate boundary. Do not replace negative assertions with an empty array or infer no requests from final DTO state.

### Prior findings and coverage assessment

| Item | Static result |
| --- | --- |
| B-M1-02 backup guard | Positive Docker/Compose state checks now refuse unknown, running and restarting service states. Targeted stack-data units pass. This does not prove backup/restore against real volumes. |
| B-M3-01 wizard steps | Corrected wizard transition and detail-badge checks remain in the M2 source. The prepared 64-case inventory passes its harness-only validation. |
| B-M3-02 route observer | Same-document navigation, sentinel and document-root observer repair the destroyed-observer gap. Cancellation of a delayed request is possible; no delivered-late-response claim is made. Browser evidence is pending. |
| B-M3-03 no-attempt evidence | The new bounded audit cursor, response trace/completion check and paired positive `grant_attempt_started` control address the earlier inference from DTO state alone. The product emits that event after phase-1 commit. The separate `grant_rejected` trace defect A-M1-05 breaks exact-trace refusal assertions and must not be hidden by weakening the oracle. |
| Fresh and restart snapshot cases | Manifests include local precedence, finalized repeats, valid-grant/mismatch/state ordering, snapshot persistence, absence of provider reads and positive controls. Fresh/restart source coverage exists, but A-M3-01 prevents reliable execution evidence for several rows. |
| V/S1 races | Prepared outcomes distinguish local no-attempt refusal, one committed attempt before V, cancellation-first readiness, old-target S1 after provider replacement, and parent deactivation after V. The latter expects registration success followed by LTI denial, which matches the approved non-atomic readiness outcome. Gate coverage must include unexpected methods, not just the held request. |
| Canvas | Separate initial/add paths, issuer pin/readiness faults and cancellation cases are prepared. The three Canvas oracle self-tests pass. No SIM or internal fixture alone proves hosted Canvas behavior. |
| Five-second/60-second bounds | The gate can hold/deliver/drop traffic without pausing the handler's timer. Tests retain caller-gone and lease-window controls. The product's fallback/automatic retry gaps are A-M1-03/A-M1-04; existing happy-path and timeout self-tests do not resolve them. |
| Simulator and secrets | Shared provider-neutral engine, independent signing material and `.sim.test` names remain. Simulation and gate overrides stay acceptance-only. Source review found no new production test exception. Actual run hygiene, retained files and complete logs still need QA's scan. |

### Both full-run inventories and migration preparation

`tests/host/run-m1.mjs` invokes every entry in `FULL_PHASES` for **each of two runs at the same frozen SHAs**: `sim`, `snapshot-isolated`, `snapshot-upgrade`, and `migration`; it validates the combined inventory before comparing runs, then runs the legacy phase. The harness-only command discovers 392 API cases and 24 host rows. Discovery and inventory validation do not mean these 416 rows passed.

The snapshot upgrade preparation pins old build `9f96f7b24cd0aed702e4dc40373bdda4307aad31`. It seeds a populated old-011 state with the frozen harness, checks the old app ledger, stops the services and takes the paired backup. Candidate image build is separated from service start so it can check that merely building did not migrate data. The new run checks the exact appended 012 app migration and unchanged LTI migration ledger. The h2/h3 old-pending/old-registered cases, h4 old Canvas add/key survival, and h5 reservation/orphan cleanup are material controls, subject to the findings above.

The separate Moodle migration phase retains old-baseline setup, original-key use, a real SCORM/score path, paired backup, upgrade, post-upgrade writes, tamper refusal, and restore under the old build. Both migration phases belong in **both** complete-run inventories. I inspected their preparation; I did not execute either migration, inspect a real backup, or exercise rollback. They remain required acceptance evidence.

### Supplemental commands and results

All commands ran in the exact detached candidate checkout after offline dependency installation:

```sh
node tests/host/run-m1.mjs --harness-only --provider all
node tests/e2e/host/run-m2.mjs --harness-only
node --test tests/acceptance/M1/canvas/snapshot-oracle.selftest.mjs
```

- M1: **27 self-tests passed**, tests typecheck passed, 392 API cases and 24 host rows discovered, exit 0; `/tmp/cogniate-review-a-eb43247-harness.log`.
- M2: **2 self-tests passed**, tests typecheck passed, 64 browser cases accounted, T7 selection unchanged, exit 0; `/tmp/cogniate-review-a-eb43247-m2-harness.log`.
- Canvas oracle: **3 self-tests passed, zero skips**, exit 0; `/tmp/cogniate-review-a-eb43247-canvas-oracle.log`.
- The exact focused unit commands are recorded in the M1/M2 Round 2 reports: **234 tests in 17 files passed**, zero skips, including migration, current-state score fence, configuration, provider, LTI and stack-data guard cases.
- The independent gate diagnostic ran as `node --input-type=module` with its script on stdin and the in-memory boundaries described above. It reproduced the missing-event defect. It opened no socket and changed no repository source.

### Still-pending acceptance

AC-M3-01 through AC-M3-07 remain evidence requirements. This review supplies no full-run, browser, Moodle-live, rollback, container-isolation or complete secret-scan PASS. Fix the blocking implementation and harness findings, freeze the next candidate, and run the authorized suites with both complete inventories and all required controls. Keep `SIM`, local Canvas, `MOODLE-LIVE` and live Canvas/Blackboard evidence distinct. No live matrix entry is promoted by these static or supplemental results.

## Round 3 (2026-10-20): bounded correction re-review

| Item | Value |
| --- | --- |
| Verdict | **CHANGES_REQUESTED**. The original A-M3-01 snapshot/upgrade locations are repaired. A newly identified MAJOR gap, A-M3-02, remains in older Blackboard no-call assertions. M1's four repair findings are closed; M2 source corrections are approved separately. |
| Exact product/test SHA | **`ae130a3501f3a2502c6a34e36319629e3dcdfb09`**, delta from `eb43247d02df622d5da72dafac41d919f65a91fe`. Detached clone `/tmp/cogniate-review-a-ae130a3.ketuxd`. |
| Repair commits | `41ee174ddcd4cd5c925b09d7c57ef9f8ceaa03b9` common/Blackboard and CLI; `feb36b112edd4173094e0ba3d38ccfc0a549fb35` Canvas and M2; `ae130a3501f3a2502c6a34e36319629e3dcdfb09` backend. Normative applied contracts remain `ccdd9ef67cdd2be4c6af374136777fda4e081943`. |
| Reviewer and independence | Retained independent replacement Reviewer-A, Codex GPT-6-Astra xhigh; task `task_e0177b2e9a56`, dispatch `ctx_2b5524d3ba70`. Used prior A Round 2 and submitted B final at `9680bb7`; did not read B's new re-review or communicate conclusions with that reviewer. No delegation. |
| Scope | Source and targeted supplemental probes/checks. No stack, browser, live activity, product/test edits, commit or push. Only my three existing reports are held uncommitted for Lead. Prior report history is retained. |

### A-M3-01 disposition: original locations closed

`common/gate-capture.mjs:4`–`:12` installs specific fault rules first, followed by pass/fault capture for GET, HEAD, POST, PUT, PATCH, DELETE and OPTIONS. It reads the cursor only after the rule update completes. `common/snapshot.ts:16`–`:19` exposes that behavior through `watchAll`, and `snapshotScope` resets then arms it before collecting evidence.

The earlier defective Blackboard 52/isolated and common old-011 h4/h5 paths now keep catch-alls behind faults, re-arm after resets and take the relevant cursor afterward. The Canvas 51 race and 52 dead-S3 windows also use this helper. Exact trace refusals, request-completion/audit windows, separate positive capture controls and state/authority checks were retained. No criterion or case was removed.

The three new `gate-capture.selftest.mjs` tests execute the **actual gate handler**, replacing only Node network/file boundaries. They reproduce the old narrow-rule blind spot, confirm all seven methods, specific-fault precedence, one-shot exhaustion, reset/re-arm, and separate negative/positive windows. They passed in my harness-only run. These are meaningful observation controls, not merely hand-built event arrays, but they prove only callers that install the helper.

### A-M3-02 — MAJOR — Older Blackboard no-call assertions still have incomplete capture

**Locations at the exact SHA:** `tests/acceptance/M1/blackboard/50-races.test.ts:125`–`:130` and `tests/acceptance/M1/blackboard/30-grants.test.ts:12`–`:20`. Gate behavior remains `infra/lti-gate/gate.mjs:204`–`:216`; the one-shot rule consumes its count before the held request is released.

The replacement-during-live-lease case `M1-37.blackboard.f` arms only one PATCH `hold_after` rule. That rule is exhausted when S3 is held. It then takes a cursor, sends the replacement request and checks that no gate event followed the cursor. At that point **no rule can capture a new GET, POST or PATCH**, including the same PATCH path. Unmatched calls are forwarded without events. Thus the 409/status check can pass while the claimed I1 zero-call observation is blind to an erroneous provider read or mutation.

The older `30-grants.test.ts` `noMutation` helper captures only GET/POST/PATCH/DELETE under `^/api/`. It claims no LTI call but cannot see HEAD/PUT/OPTIONS. Those omissions also fail the requested all-seven-method capture control. The first location is the principal blocking case because it misses even the binding engine's normal methods.

**Independent actual-gate probe:** I reused the gate-boundary loader from the committed self-test, with the actual gate source and only in-memory Node edges. Under the exact one-shot PATCH rule, I held the first PATCH, took its event cursor, then sent three unexpected requests: GET `/api/providers`, POST `/api/platforms/P/deployments`, PATCH `/api/platforms/P/deployments/D`. All three forwarded; the case's current zero-event assertion still saw **0**. Arming the repaired helper observed all **3**. A second control sent HEAD/PUT/OPTIONS under the four-method `noMutation` rules: **0 observed**, versus **3** with the all-method helper.

Command: `node /tmp/cogniate-review-a-ae130a3-gate-gap-probe.mjs`, exit 0; output `/tmp/cogniate-review-a-ae130a3-gate-gap-probe.log`. This proves the observation defect, not that the production handler currently makes those forbidden calls. The files are older unchanged paths newly identified in this re-review, not a regression introduced by the three repair commits. I reported the finding promptly to Lead in `msg_55731d8888b8`.

**Suggested repair:** use the existing all-method helper in these remaining no-call windows, with the specific hold rule before catch-alls and capture armed before the cursor. Preserve the held request, replacement grant, 409 result, negative window and later cancellation/recovery assertions. Add a caller-level control that injects an unexpected request while the original hold remains active and proves the zero-call assertion fails. Audit other narrow-rule callers that claim absence of all traffic; do not weaken the assertion or substitute final remote state.

### CLI, M2 and full inventory

The shared host CLI correction at `tests/host/m1-control.mjs:20` supplies `--workdir /repo` before the service name, then invokes the actual service workspace script. Compose mounts and both service manifests support that path. The new self-test exercises the real file-control handler with captured subprocess calls, preserving arguments, return code, stdout/stderr, secret registration and the command whitelist. It passed. Real container CLI execution is separate QA evidence; the Lead's 14-case PARTIAL preflight report includes both CLIs.

The M2 Copy/row-order repair preserves the four rows and all Copy/clipboard checks. My supplemental probe of the actual assertion blocks reproduced the old scroll failure, passed the repaired loop, and rejected reversed rows, wrong values, wrong clipboard contents and a missing Copy control. M2's prior actual `eb43247` **35 PASS / 29 FAIL** record remains history. Neither the source correction nor the 14-case preflight is a full repaired M2 PASS.

Git comparison confirmed no change to common/Blackboard/Canvas manifests, the M2 manifest, `tests/host/run-m1.mjs` or `m1-phases.mjs`. The full runner still requires **both complete runs at the same frozen SHAs**, each inventorying `sim`, `snapshot-isolated`, `snapshot-upgrade` and `migration`; it compares per-case results, then runs legacy separately. Default-profile T7/Moodle browser regression remains separate and mandatory. Populated old-011/012 and paired Moodle backup/rollback evidence are still required in their respective phases. There was no migration or contract change.

### Reviewed files and independent checks

Read the complete harness delta: common `gate-capture.mjs`, its declaration/self-test, `snapshot.ts`, `snapshot-migration.probe.ts`; Blackboard `02-snapshot-isolated.test.ts`, `52-snapshot.test.ts`; Canvas `51-canvas-races.test.ts`, `52-canvas-snapshot.test.ts`; `tests/host/m1-control.mjs` and its self-test; and M2 `02-canvas-wizard.m2.ts`. Rechecked the actual gate, snapshot/audit oracles, old Blackboard 30/50 callers, Canvas/common helper call sites, Compose/service CLI layout, full-run phase accounting and unchanged manifests.

```sh
node tests/host/run-m1.mjs --harness-only --provider all
node tests/e2e/host/run-m2.mjs --harness-only
node --test tests/acceptance/M1/canvas/snapshot-oracle.selftest.mjs
node /tmp/cogniate-review-a-ae130a3-gate-gap-probe.mjs
node /tmp/cogniate-review-a-ae130a3-row-probe.mjs
```

All exited 0. M1: **31 self-tests**, typecheck, **392 API + 24 host rows** discovered; log `/tmp/cogniate-review-a-ae130a3-harness.log`. M2: **2 self-tests**, typecheck and **64 rows**; log `/tmp/cogniate-review-a-ae130a3-m2-harness.log`. Canvas oracle: **3 self-tests**; log `/tmp/cogniate-review-a-ae130a3-canvas-oracle.log`. No self-test skip. The gate probe reproduced A-M3-02; exit 0 means its diagnostic assertions passed, not that the candidate's affected acceptance cases are adequate.

M1 Round 3 records my **207 passing focused product tests** and **20 independent grouped engine/transport/audit probes**. Those probes do not replace the independent acceptance suite or use an internal binding fixture as its oracle. Neither private probe starts a stack or browser.

### Evidence boundary

Lead reported an exact-SHA clean root check of **1,032 tests / 69 files / zero skips** in `msg_db27b9cc3f43`. Lead relayed QA's **14/14 PARTIAL SIM preflight** in `msg_7ac69e393e11`, with both real CLIs, selected repaired capture cases, scoped cleanup and evidence scanning. These are attributed Lead/QA results, not my execution and not full M1/M3 PASS.

The newly reported A-M3-02 gap needs correction and review. Both full M1 inventories, migration/rollback, legacy, complete repaired M2 and default-profile T7/Moodle execution remain separate gates at this evidence boundary. A later source approval or selected-case PASS must not erase historical failures or promote SIM to live evidence. All 32 live matrix rows remain UNVERIFIED.

## Round 4 (2026-10-20): A-M3-02 repair and runtime/diagnostic corrections

| Item | Value |
| --- | --- |
| Verdict | **APPROVE** for the bounded harness corrections. A-M3-02 is closed. No BLOCKER or MAJOR is open. Two new MINOR findings (A-M3-03, A-M3-04) are privacy-evidence gaps; they do not block this source approval, but the fresh AC-M3-07 run should include their fix or a Lead decision. This is **not** an acceptance PASS: both complete M1 runs, legacy, migration/rollback, the full M2 rerun, T7 and the fresh privacy scan are still open gates. |
| Exact product/test SHA | **`e3cd7dbc11a2c41f9059445b0f011bd1ba5e1e63`**, compared with `ae130a3501f3a2502c6a34e36319629e3dcdfb09`. Detached clone `/tmp/rva-e3cd7db`; no dirty worktree file was used. |
| Repair commits | Common/Blackboard capture and recorder kinds `832f8c8ac437c7fd93425d7152f865a8ffb13eaa`; Canvas/M2 browser capture and diagnostics `7ddff36ccc58ebc9218c7e1bca646f28067c891b`; product integration `e3cd7dbc11a2c41f9059445b0f011bd1ba5e1e63` (six paths, see M2 Round 4). Applied contracts `ccdd9ef67cdd2be4c6af374136777fda4e081943`. |
| Reviewer | The **original** Claude Reviewer-A session (claude-opus-5-5, xhigh), resumed at the owner's request (team brief `094964d`). Task `task_016398b7ed4e`, dispatch `ctx_7e250abb1487`. No delegation. Round 3 above was done by the retained Codex GPT-6-Astra replacement; I kept it unchanged. |
| Independence and scope | I used the submitted reports (`76ac36c`, B prior `9680bb7`) only as history. I did not read Reviewer-B's new re-review. No stack, browser, live tenant, account, product/test edit, commit or push. Private scratch probes only. |

### A-M3-02 disposition: **CLOSED**

The repair arms every method on every path, before the cursor, with each specific fault rule ahead of the catch-alls (`common/gate-capture.mjs:4`–`:12`; first match wins in `infra/lti-gate/gate.mjs:204`).

- **`50-races.test.ts`.** `scope` re-arms after its reset (L64). Every race replaces its narrow `gateRules` call with `watchAll('pass', [specific rules])`. In race `f` (L126–L131), the catch-alls stay active after the one-shot S3 hold is consumed. The cursor comes from `gateMark()` after the replacement grant is issued, so issue-time reads stay outside the window. The held request, the `409 GRANT_IN_USE`, the zero-event window, `liveRelease` (< 4.5 s), the `403`, the `replaced` audit line and the adopting retry are unchanged. Rule-id lookups (`cleanup`, `retry`, `activate`) still work, because the specific rules stay first.
- **`30-grants.test.ts`.** `noMutation` (L13–L19) now uses `gateReset()` then `seq = await watchAll()`. The remote-record, simulator-service and gate oracles are all kept.
- **Other owned no-call windows.** Common/Canvas snapshot windows (`02-*`, `52-*`, `snapshot-fixture.ts`, `snapshot-migration.probe.ts`), the Canvas race `f` and `canvas.ts noRemoteCall` already arm all seven methods before their mark. They are unchanged since `ae130a3`. `60-containment` and `61-canvas-containment` use narrow hold rules, but they make no absence claim; they look up their own request id. `20-protocol`/`21-canvas-protocol` `noServiceCalls` is a simulator-record oracle, not a gate oracle. I found no remaining owned gate absence claim with partial capture.
- **Manifests and counts.** No change to any M1/M2 manifest, `tests/host/**` or `infra/**`.

**Caller-level checks (`gate-capture.selftest.mjs`, two new tests).** They run the **actual** `30-grants`/`50-races` callers, transpiled unchanged, against the actual gate handler, with only network edges supplied in memory. My checks:

1. At `e3cd7db`: **5/5 pass** (`node --test tests/acceptance/M1/common/gate-capture.selftest.mjs`; log `/tmp/rva-e3cd7db-gatecap.log`).
2. The same self-test with the two **`ae130a3` callers** in a scratch copy: the three helper tests pass, and **both new caller tests fail** ("Missing expected rejection"). They detect the old defect. Log `/tmp/rva-oldcallers.log`.
3. My own per-method matrix (the actual loader with a non-stopping loop; `/tmp/rva-probes/a-m3-02-matrix.base.mjs`, log `/tmp/rva-probes/a-m3-02-matrix.log`):

| Injected call | Old `noMutation` | New `noMutation` | Old race `f` | New race `f` |
| --- | --- | --- | --- | --- |
| none (clean control) | pass | pass | pass | pass, hold reset |
| GET, POST, PATCH, DELETE | detected | detected | **missed** | detected |
| HEAD, PUT, OPTIONS | **missed** | detected | **missed** | detected |
| GET outside `/api` (`noMutation`) / GET `/api/providers` (race) | **missed** | detected | **missed** | detected |

In race `f`, every injection goes on the same path as the consumed hold, with that hold still active (`timers.size === 1`). The new callers detect every method, and the clean continuation (release, `403`, retry `200`) still runs.

### New findings

#### A-M3-03 — MINOR — M2 request-time capture does not record the Deep Linking response JWT

- **Where:** `tests/acceptance/M1/canvas/browser-diagnostics.mjs:2` (`fields = ['ltik', 'id_token', 'state', 'nonce']`) and the form branch at L35–L38. Compare T7's `tests/e2e/lib/capture.ts:54`, which records the tool's Deep Linking response `JWT` form field as a secret.
- **Problem:** M2 cases run the in-browser teacher pick (for example M2-12 reached "the expected Deep Linking resource"). The tool then posts `JWT=<signed response>` to the simulator return URL. The new M2 capture sees this request but records no `JWT` value, and M2 does not install T7's `captureLti`. So the fresh AC-M3-07 scan cannot detect this signed assertion if a simulator or service log keeps it. This is a gap in the evidence, not an observed leak.
- **Suggested fix:** record form `JWT` values in the same private recorder (T7 uses kind `id_token`). Add one synthetic self-test row.

#### A-M3-04 — MINOR — Legacy T5 frame-wait failure text still prints full capability URLs

- **Where:** `tests/acceptance/lib/t5.ts:200` (`page.frames().map((fr) => fr.url())`, with query). It is unchanged. Users: `T5a/*`, `T5b/*`. These suites are part of the legacy phase of the same full M1 runner (`tests/host/run-m1.mjs:133`–`:149`; M3 AC-M3-02 (b)).
- **Problem:** this is the same failure mode QA found in M2. On a frame timeout, the shared error text keeps `/play/<id>`, `/rt/<token>` and query values. Legacy capture records the runtime token only after the frame is found (`t5.ts:213`), and it never records play ids. So the AC-M3-07 zero-hit scan can miss them. It only happens on a failure, and the player fix makes the M2-12-type timeout less likely. `t8.ts:174` lists Moodle SCORM frames, and `tests/e2e/lib/moodle.ts:156`/`:392` strip queries and contain no Cogniate path capability, so I do not include them.
- **Suggested fix:** use `diagnosticUrl` in this branch (as `learner.ts:63` does now), or install request-time capture in the legacy browser fixtures. The owner and timing are a Lead decision.

### Diagnostics repair (`7ddff36`): accepted, with A-M3-03

- Capture starts before any request. The M2 `guard` fixture calls `captureSecrets(context)` before `context.route` and `use()`. `libraryPage` calls it right after `newContext`, before `newPage`/sign-in (`tests/e2e/M2/lib/m2.ts:71`, `:101`).
- URL capabilities (`/rt`, `/play`, `/tool/picker`, also decoded) and query/form `ltik`, `id_token`, `state` and `nonce` go only to `recordSecret` (the git-ignored `captured-secrets.jsonl`). `832f8c8` adds the `play_id`/`picker_id` kinds.
- Both frame-timeout branches (`canvas/browser.ts:181`, `e2e/lib/learner.ts:63`) and the M2 blocked-request list (`m2.ts:75`) use `diagnosticUrl`. It removes credentials, query and fragment, and replaces the three capability segments. The product's capability routes are exactly `/rt/:token`, `/play/:playId` and `/tool/picker/:pickerId`. The contract does not define `/pkg/{packageId}` as a capability id, so keeping its shape is consistent.
- The three self-tests are meaningful. They include the old query-only negative control, capture before any successful frame wait, and the **actual** `waitForFrame` failure branches compiled from both files. They passed in the M2 harness run.
- QA's record keeps AC-M3-07 as **FAIL / rerun required**: four missed historical values (two runtime tokens, two play ids), shared copies sanitized, and the original zero-hit scan insufficient. A fresh privacy run is required. I did not see or use any of those values.

### Independent harness execution

```sh
node tests/host/run-m1.mjs --harness-only --provider all   # 33 self-checks; 392 API + 24 host rows; exit 0
node tests/e2e/host/run-m2.mjs --harness-only              # 5 self-checks; 64 M2 cases; T7 selection unchanged; exit 0
```

Logs: `/tmp/rva-e3cd7db-m1-harness.log`, `/tmp/rva-e3cd7db-m2-harness.log`. No self-test skip. These numbers match the QA claims (33/416, 5/64).

### Evidence boundary

The Lead reported a clean exact-SHA root check of **1,039 tests in 70 files, zero skips**, plus lint and typechecks (`msg_54ff82484809`). That is the Lead's validation, not my execution. This report proves harness observation and source behaviour only. It is not a complete SIM run, migration/rollback, legacy, Moodle/T7 or live result. The M2 **61 PASS / 3 FAIL** run at `ae130a3` and the insufficient privacy inventory stay FAIL history. The Lead relayed QA's full M2 run at `e3cd7db` (`msg_b790866db0d7`): **60 PASS / 4 FAIL**. M2-13 passes. M2-12 (both cases), M2-08.canvas and M2-11.blackboard fail on harness readiness, and both learner scenarios stopped before launch. The privacy scan found 0 hits (45 values / 62 files; expanded 43 / 77), but A-M3-03 means it does not cover the Deep Linking response JWT. That is QA's evidence, not mine. The human-review flag for A-M3-02 stays in history; its correction is now reviewed. All 32 live matrix rows remain UNVERIFIED.
