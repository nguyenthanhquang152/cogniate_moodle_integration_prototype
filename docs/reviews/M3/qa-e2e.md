Verdict: FAIL / HOLD — first M2 SIM run failed; T7 held for repair freeze
Round: 1 (2026-10-20)
Owner: independent Codex Canvas QA replacement, GPT-6-Astra xhigh, no delegation
Task: `task_e28388df4dcc`; dispatch: `ctx_8ec51c3aa7b5`

# M3 QA-E2E verification checkpoint

Applied contract: `ccdd9ef67cdd2be4c6af374136777fda4e081943`. Executed product and test: `eb43247d02df622d5da72dafac41d919f65a91fe`. Scope and replacement authorization: team brief `910f7a48f39c5679040a8e0c98f4de54baf14f8f`. Full M2 result, command, image identities, reduced health output, timing, per-case results, masked screenshot paths and limits are in [M2 QA §5](../M2/qa.md#5-round-4--frozen-m2-execution-and-repair-preparation-2026-10-20).

## 1. Criterion status

| Criterion | Result in this checkpoint | Evidence and limit |
| --- | --- | --- |
| AC-M3-01 | NOT RUN / HOLD | Core QA executes both complete M1 rounds. Canvas independently judges its 233 rows from those same frozen artifacts. No rows from the superseded candidate are carried forward. |
| AC-M3-02(a) | NOT RUN / HOLD | No T7 stack, three-run sequence, demo or confirmation check started. Lead `msg_478c680eab7a` holds the candidate. Earlier T7 reports do not satisfy this final-SHA gate. |
| AC-M3-02(b) | Other owner | Core QA owns legacy regression and the return-to-default checks. No duplicate execution or independent verdict is claimed here. |
| AC-M3-03 | FAIL | M2: 35 PASS, 29 FAIL, zero skipped/retried rows; all 64 named outcomes retained. Only 16 screenshots of reached states; successful registration steps were not reached. |
| AC-M3-04 | PARTIAL, gate pending | The signed simulator ran; no new simulator key file was introduced. Grant and learner flows failed in setup, so full successful-flow hygiene still needs the repaired run and common QA evidence. |
| AC-M3-05 | Matrix recorded, live UNVERIFIED | [Live matrix](live.md) retains every normative row and exact planned steps. No live authorization, tenant, account or exposure was used. |
| AC-M3-06 | PASS for this run | Zero containers after cleanup, exactly seven unchanged baseline volume metadata records, no owned network or host Build Runner. No Docker Desktop settings changed. |
| AC-M3-07 | Captured scan PASS; full gate pending | 1 captured value, 49 files, zero hits in the failed run's service/simulator/gate logs and redacted evidence. Grant/learner secrets were not exercised; this is not a full successful-flow privacy result. |

## 2. Failure and repair boundary

The M2 run id is `qa-e2e-sim-r1-eb43247d-2026-10-20T12-34-50-805Z`, on `qa-e2e-sim-r1`, `8643`, `172.27.0.0/16`, profile `acceptance`. The 28 grant-dependent failures are a shared host-control CLI workspace error. Common QA owns that repair. `M2-04.rows` is an owned scrolling-coordinate harness defect; its correction retains all value, ordering and Copy assertions. A synthetic local-page check reproduces the original failure and rejects reversed rows after repair. No product pass is inferred from that check.

After the submitted integrated review, Lead authorized complete all-method capture for older Canvas race rules. The compatible common helper is `watchAll(action = "pass", faults: Json[] = [])`, specific faults first. Both modified Canvas files preserve all case ids, negative assertions and timing bounds. See [Canvas QA round 5](../M1/qa-canvas.md#11-round-5--integrated-review-response-and-verification-hold-2026-10-20).

M2 harness checks: 2 PASS, typecheck, all 64 IDs. Canvas-selected M1 harness checks: 31 PASS, typecheck, 251 API plus 24 host/browser rows including common. Full inventories remain common 42, Blackboard 141, Canvas 233, total M1 416. These are preparation checks only. Full root check, legacy suites, migrations and real-provider verification were not executed by this worker.

## 3. Isolation and retained artifacts

External evidence root: `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-eb43247-21t8wgiv`. The frozen source and fresh runtime clone are separate from the shared working tree. `baseline-before.json` holds the seven complete volume metadata records. `baseline-after-m2.json` records exact equality at `2026-10-20T12:37:25.151515Z`; zero containers and only the three baseline networks remained. `m2-images.json` adds image digests. The private runtime clone retains raw generated test values; shared evidence consists only of the runner's redacted artifacts and masked PNGs.

The exclusive window was released to Lead in `msg_43f19e48bd65` after complete cleanup. No new stack follows without repair freeze and a new explicit window. No local Canvas startup or new feasibility assessment has occurred: it remains after the successful SIM and Moodle gates, and must be reported to Lead before startup. Hosted Canvas and Blackboard remain UNVERIFIED separately.

## 4. Next gate

Lead integrates the owned corrections with common QA's CLI and all-method capture fixes, freezes exact product/test SHAs, and assigns a serialized window. QA-E2E then repeats all 64 M2 cases and executes default-profile T7 three consecutive times plus demo/check-confirm. Default health must include no knobs, `simulation_profiles: []`, no `lms-sim` and no `lti-gate`. Core QA separately supplies both complete M1 runs. Exact neutral readiness text, Blackboard card guidance, Moodle baseline and the existing live-poll cancellation observation remain mandatory; cancellation is not proof of a delivered late response.
