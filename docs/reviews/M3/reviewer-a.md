Verdict: CHANGES_REQUESTED
Round: 2

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
