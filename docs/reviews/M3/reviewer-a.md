Verdict: APPROVE
Round: 1

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
