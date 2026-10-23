Verdict: HOLD at candidate `aaa823b` — the Common full M1 run failed in round 1 storage (50 of 70 storage rows FAIL; round 1 438/488 PASS; four root failures, cause not established); Canvas M1 round 1 233/233 rows PASS (partial); M2 and T7 NOT RUN (no window); live UNVERIFIED; local Canvas DEFERRED (see §13)
Round: 10 (2026-10-21). Round 9 verdict: "HOLD at candidate `9cdd768` — the Common full M1 run failed in round 1 storage (69 of 70 storage rows FAIL; round 1 419/488 PASS; two causes look like Common harness or oracle defects, one is not established); Canvas M1 round 1 233/233 rows PASS (partial); M2 and T7 NOT RUN (no window); live UNVERIFIED; local Canvas DEFERRED (see §12)". Round 8 verdict: "HOLD at candidate `51a80b5` — the Common full M1 run stopped in round 1 snapshot-upgrade (`M1-38.common.h4`, a Common host-control replay defect) and Common's W4 strict comparison failed (outer environment); Canvas M1 round 1 233/233 rows PASS (partial); M2 and T7 NOT RUN (no window); live UNVERIFIED; local Canvas DEFERRED". Round 7 verdict: "HOLD at candidate `82e2dab` — the Common full M1 run stopped in round 1 (common host collector); Canvas M1 round 1 233/233 rows PASS (partial); M2 and T7 NOT RUN (no window); live UNVERIFIED; local Canvas DEFERRED". Round 6 verdict: "HOLD at storage candidates `a784522` (failed attempt) and `55c33a3` — M2 and T7 NOT RUN (no window); Canvas M1 round 1 233/233 rows PASS at `55c33a3` but rounds incomplete; live UNVERIFIED; local Canvas DEFERRED". Round 5 verdict: "at `aff4882`: M2 64/64 functional PASS (SIM); T7 3/3 default runs + demo + confirm PASS; observer-log incident contained; M1 held by Core QA; live UNVERIFIED"
Owner: round 10 by a fresh Claude QA-E2E session (`claude-opus-5-5`, xhigh; Orca session `c9188d79-d5a7-4ab0-bc62-ac27e61ff412`), which did not run rounds 1–9; round 9 by a new Claude QA-E2E session (`claude-opus-5-5`, xhigh; Orca session `d892992a-032c-4693-b6ac-3e8359c10af3`), which did not run rounds 1–8; round 8 by a new Claude QA-E2E session (`claude-opus-5-5`, xhigh; Orca session `07499b81-08f3-49dd-8576-2057a21a95ac`), which did not run rounds 1–7; round 7 by a new Claude QA-E2E session (`claude-opus-5-5`, xhigh; Orca session `95d4c010-ef6d-4f58-87fe-7a686ec36424`), which did not run rounds 1–6; round 6 by another new Claude QA-E2E session (`claude-opus-5-5`, xhigh; Orca session `228bb341-1217-4df5-bc56-664d1f41faa3`), which did not run rounds 1–5; round 5 by the original Claude Canvas QA, resumed by owner request; rounds 1–2 by the independent Codex replacement
Task: `task_e28388df4dcc`; dispatch: `ctx_e7de4ddd7504` (round 9: `ctx_374ca3cec6a5`; round 8: `ctx_f8cca0cc95be`; round 7: `ctx_33862fcfa6d1`; round 6: `ctx_f3f20494787a`; round 5: `ctx_4a94125660be`; rounds 1–2: `ctx_8ec51c3aa7b5`)

# M3 QA-E2E verification checkpoint

Sections 1–4 retain round 1. Sections 5–7 retain rounds 2–4. Section 8 retains round 5. Section 9 retains round 6. Section 10 retains round 7. Section 11 retains round 8. Section 12 retains round 9. Section 13 is the current round 10 result.

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

## 5. Round 2 — current verification status

Exact product/test: `ae130a3501f3a2502c6a34e36319629e3dcdfb09`. Applied contract unchanged. Full command, all 64 results, image identities, browser version, complete health observations, fresh Build Runner, cleanup and sanitized evidence paths are in [M2 QA §6](../M2/qa.md#6-round-5--second-frozen-m2-run-and-diagnostic-hygiene-2026-10-20).

| Criterion | Current result | Evidence and limit |
| --- | --- | --- |
| AC-M3-01 | NOT RUN / HOLD | Core QA owns both full M1 runs. Independent Canvas verdict still needs 233 Canvas outcomes in each frozen run. Inventories stay common 42, Blackboard 141, Canvas 233, total 416. |
| AC-M3-02(a) | NOT RUN / HOLD | T7 never started after M2 failed; no three-run, demo or confirmation result is claimed at this SHA. |
| AC-M3-02(b) | Other owner | Core QA owns legacy/default-return checks. |
| AC-M3-03 | FAIL | 61 PASS, three FAIL, zero skip/retry, all 64 rows. Both real-course learner cases failed before package load; stale-value route observer failed separately. |
| AC-M3-04 | PARTIAL | Both simulated teacher Deep Linking paths succeeded; both learner-completion paths failed. No live behavior is inferred. |
| AC-M3-05 | UNVERIFIED live | All 32 normative live matrix rows retain their planned steps and UNVERIFIED status. |
| AC-M3-06 | PASS for this run | Zero containers, seven full baseline volume metadata records unchanged, baseline networks only, no owned Build Runner after cleanup. |
| AC-M3-07 | FAIL / rerun required | Original 52-value/63-file scan missed two runtime tokens and two play IDs in failure diagnostics. Shared copies were sanitized; independent 77-file rescan finds zero remaining hits for those four values. The automatic repair is harness-tested only. |

The player symptom is supported by two sets of 404 asset requests before any learner runtime-state request. The author owns the player build repair. The route observer proves Canvas values were present at the Blackboard pathname; it does not prove delivery of a delayed response. Lead subsequently relayed the author's BrowserRouter reproduction: history changes before React replaces the view, with cancellation intact. This is a product navigation defect; the original observation remains unchanged.

Owned hygiene repair captures capabilities at request time and masks capability paths in both frame timeout functions. Five M2 self-checks, typecheck and all 64 IDs pass; Canvas-selected M1 harness passes 33 checks, typecheck and unchanged 251 API plus 24 host/browser rows including common. No product run followed those edits. Frozen failed source and tests were not edited. Lead must integrate exact owned paths and the common recorder extension before a new test SHA.

External evidence root: `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-ae130a3-s73h9dlx`. Cleanup at `2026-10-20T13:06:07.255505+00:00`; window released in `msg_dde9a4b82cc9`. T7 remains HOLD until a fresh all-64 M2 PASS and clean boundary on the repaired candidate, or a new explicit Lead instruction. No stack, tenant, account or public exposure was introduced during repair preparation.

## 6. Round 3 — third M2 run at `e3cd7db`

Exact product/test: `e3cd7dbc11a2c41f9059445b0f011bd1ba5e1e63`. Applied contract unchanged. Lead window: `msg_88bc0ba11c4c`. Full command, all 64 results, image identities, browser version, health, Build Runner, cleanup and evidence paths are in [M2 QA §7](../M2/qa.md#7-round-6--third-frozen-m2-run-at-e3cd7db-2026-10-20).

| Criterion | Current result | Evidence and limit |
| --- | --- | --- |
| AC-M3-01 | NOT RUN / HOLD | Core QA owns both full M1 runs and is held. The independent Canvas verdict still needs the 233 Canvas outcomes from each frozen run. |
| AC-M3-02(a) | NOT RUN / HOLD | M2 did not pass all 64 cases, so T7 did not start. No three-run, demo or confirmation result is claimed at this SHA. |
| AC-M3-02(b) | Other owner | Core QA owns the legacy and default-return checks. |
| AC-M3-03 | FAIL | 60 PASS, 4 FAIL, zero skips or retries, all 64 rows. `M2-13.no-stale-values` now passes. The four failures are QA harness races: a one-shot read of the publish-dialog options while it shows `Loading…` (`M2-08.canvas`, both `M2-12`), and a Tab loop that starts before the Blackboard form renders (`M2-11.blackboard-keyboard`). |
| AC-M3-04 | NOT VERIFIED | Both `M2-12` cases stopped at the publish step, before the teacher pick and learner launch. The player-bundle repair is not verified. |
| AC-M3-05 | UNVERIFIED live | All 32 normative live matrix rows keep their planned steps and UNVERIFIED status. |
| AC-M3-06 | PASS for this run | Zero containers after cleanup, seven volume records exactly unchanged, baseline networks only, no Build Runner process, port `8643` free. |
| AC-M3-07 | Scan PASS; full gate pending | Runner scan: 45 values, 62 files, 0 hits. Independent private rescan: 43 values, 77 files, 0 hits. No play or runtime capability was created, so automatic capability capture is still not exercised. |

Lead authorized two bounded, held QA repairs: readiness in `msg_3590cf55633f` and Deep Linking response capture in `msg_b4e09fd0ad1a` (Reviewer-A A-M3-03 MINOR). The readiness repair adds retrying waits before the option reads and before the first Tab. It keeps every assertion, case ID and keyboard-only input. The capture repair records the response form field `JWT` as `id_token` through the same private recorder. Harness and synthetic control results are in [M2 QA §7.5](../M2/qa.md#75-authorized-held-repairs-no-stack). External evidence root: `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-e3cd7db-xSD1OpOM`. The frozen source and runtime clone were not edited. The stack window is closed. T7 stays HOLD until a new frozen SHA passes all 64 M2 cases with complete cleanup.

## 7. Round 4 — M2 and T7 at `004568b`

Exact product/test: `004568bd4ab8390d64945cb73f16cfdd51d566bf`. Product and build sources are identical to `e3cd7db`; the held QA repairs from round 3 are included. Lead window: `msg_b6726e8da143`. External evidence root: `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-004568b-HS9Wwxx3`. Details: [M2 QA §8](../M2/qa.md#8-round-7--fourth-frozen-m2-run-at-004568b-2026-10-20) and [T7 QA](../T7/qa.md#m3-checkpoint-update--fourth-candidate-004568b-t7-executed-fail).

| Criterion | Current result | Evidence and limit |
| --- | --- | --- |
| AC-M3-01 | NOT RUN / HOLD | Core QA owns both full M1 runs and is held. The independent Canvas verdict still needs the 233 Canvas outcomes from each frozen run. |
| AC-M3-02(a) | FAIL | T7 three default runs: 8 PASS, 9 FAIL, 1 demo-only skip each. One QA harness race in `tests/e2e/lib/portal.ts` (`publishCourse` reads the options once) cascades from A3. Confirm checks 4/4 OK, demo pass OK, and default health (`default`, no knobs, `simulation_profiles: []`, no simulator or gate) at every reset. |
| AC-M3-02(b) | Other owner | Core QA owns the legacy and default-return checks. |
| AC-M3-03 | PASS (SIM) | M2: 64/64 PASS, zero skips or retries, single SHA, all 13 criteria and every named variant. |
| AC-M3-04 | PASS (SIM) | Both `M2-12` scenarios complete the real HTML course: portal connection, publish, framed teacher Deep Linking, learner score 100, sync Sent. No live behavior is inferred. |
| AC-M3-05 | UNVERIFIED live | All 32 normative live matrix rows keep their planned steps and UNVERIFIED status. |
| AC-M3-06 | PASS | After M2 and after T7: zero containers; the seven volume records, networks and Docker MemTotal/NCPU are exactly equal to before; no Build Runner; ports free. |
| AC-M3-07 | PASS for M2 and T7 scans | M2: runner 74 values, 63 files, 0 hits. Independent: 68 values, 80 files, 0 hits. Capture coverage per provider: Deep Linking response JWT, resource-link `id_token`, `play_id` and `runtime_token`. T7: C2 PASS in each run; union of 60 values over 103 files, 0 hits. |

Lead authorized the bounded `portal.ts` readiness repair in `msg_859204e81d48`. It is held for Lead commit with synthetic controls and unchanged inventories (see [T7 QA](../T7/qa.md#m3-checkpoint-update--fourth-candidate-004568b-t7-executed-fail)). T7 stays HOLD until Lead freezes one new product/test SHA and opens a new window. The plan is a fresh full M2 and three default T7 passes plus demo and confirmation checks at that single SHA. The M2 PASS at `004568b` remains history. Local Canvas is not assessed: it needs SIM and Moodle to pass first.

## 8. Round 5 — M2 and T7 at `aff4882`

Exact product/test: `aff48823a4c6206d6314d91a95f5eb0979d3e0e7`. Product and build are byte-identical to `e3cd7db`. In `tests/`, the only change from `004568b` is the `portal.ts` `publishCourse` readiness repair. Both independent source supplements approve `aff4882` (Lead `msg_72d5add19f35`). External evidence root: `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-aff4882-eFk7FU4s`. Details: [M2 QA §9](../M2/qa.md#9-round-8--fifth-frozen-m2-run-at-aff4882-2026-10-20) and [T7 QA](../T7/qa.md#m3-checkpoint-update--final-candidate-aff4882-t7-pass).

| Criterion | Current result | Evidence and limit |
| --- | --- | --- |
| AC-M3-01 | NOT RUN / HOLD | Core QA owns both full M1 runs and is held. The independent Canvas verdict still needs the 233 Canvas outcomes from each frozen run. |
| AC-M3-02(a) | PASS | T7: three consecutive default runs, 17 PASS / 0 FAIL / 1 demo-only skip each; demo pass PASS; 4/4 confirm and fail-closed checks; default health at every reset (`default`, no knobs, `simulation_profiles: []`, no simulator or gate). |
| AC-M3-02(b) | Other owner | Core QA owns the legacy and default-return checks. |
| AC-M3-03 | PASS (SIM) | M2: 64/64, zero skips or retries, single SHA, all 13 criteria and every named variant. |
| AC-M3-04 | PASS (SIM) | Both `M2-12` scenarios complete the real HTML course (teacher Deep Linking, learner score 100, sync Sent). No live behavior is inferred. |
| AC-M3-05 | UNVERIFIED live | All 32 normative live matrix rows keep their planned steps and UNVERIFIED status. |
| AC-M3-06 | PASS | After M2 and after T7: zero containers; the seven volume records, networks and Docker MemTotal/NCPU exactly equal to before; no Build Runner; ports free. |
| AC-M3-07 | Product and runner scans PASS; QA observer incident FAIL, contained | M2: runner 74 values, 63 files, 0 hits; per-provider capture coverage complete; independent rescans 0 hits. T7: union of 145 captured values plus `.env` secrets over 128 files, 0 hits; C2 PASS in each run. Separately, the external QA observer crash wrote 2 disposable-stack values into its own log during M2. The log was contained privately, its sanitized copy rescans at 0 hits, and the observer was repaired and pinned with controls. |

Common QA remains held until Lead hands back. Local Canvas may now be assessed for feasibility only (SIM and Moodle gates passed); QA reports feasibility to Lead before any startup.

## 9. Round 6 — ADR-012 storage candidates `a784522` and `55c33a3` (2026-10-21)

**HOLD.** A new QA-E2E session did this round. It did not execute rounds 1–5; their results remain at their own SHAs and carry no credit to these candidates.

Lead authority for this round: `msg_027a758a8352`, the T7 wrapper conditions in `msg_d7d02ff31b63` and `msg_c2d16837f83e`, and the repair authorization `msg_415316b9ae64`. Common QA held the only Docker window all through this dispatch. This worker ran no Docker runtime: it started no stack and created no Docker resource. Its work was host checks, read-only Docker inspection, the approved one-case M1-17 oracle repair and the external tool work below.

### 9.1 Criterion status

| Criterion | Result | Evidence and limit |
| --- | --- | --- |
| AC-M3-01 | HOLD | `a784522`: round 1 SIM Canvas 231 PASS, 1 FAIL (`M1-17.canvas.repeat`, a QA oracle defect, repaired in `55c33a3`); round incomplete. `55c33a3`: round 1 Canvas rows 233/233 PASS (SIM 232, snapshot-isolated 1) and the sink gate PASS, but round 1 stopped in snapshot-upgrade and round 2 did not run. Details: [Canvas QA §14–§15](../M1/qa-canvas.md#15-round-9--candidate-55c33a3-round-1-canvas-rows-complete-round-incomplete-2026-10-21). |
| AC-M3-02(a) | NOT RUN | No window; the candidate was not released for runtime. No T7 run, demo or confirmation check happened at either SHA. |
| AC-M3-02(b) | Other owner | Common QA owns the legacy suites; legacy did not run at either candidate. |
| AC-M3-03 | NOT RUN | No M2 run at either SHA. The 64/64 result at `aff4882` is history only. |
| AC-M3-04 | NOT RUN (QA-E2E part) | Needs the M2 run. |
| AC-M3-05 | UNVERIFIED | All 32 live rows stay UNVERIFIED ([live matrix](live.md)). Local Canvas is DEFERRED without a separately authorized environment. No sign-up, account, tunnel, public exposure, live-tenant write or Docker Desktop change. |
| AC-M3-06 | No new run evidence | No QA-E2E lane was used. A read-only check found both reserved lanes (`qa-e2e-sim-r6`, `qa-e2e-m3-r3`) fresh by exact names and labels. The G-1 identities match the bound table: macOS 27.0.1 arm64, CLI 29.9.1 `67827118…`, Compose 5.6.0 `1ec06408…`. Node image `44fce696…` is present. |
| AC-M3-07 | Partial | Canvas browser artifacts of `55c33a3` round 1 SIM: 15 screenshots, 0 hits against 1,316 values; 7 distinct traces hold raw values and stay private. The M2 and T7 scans need their runs. |

### 9.2 Prepared and approved tools (external, not repository code)

These tools give no product credit.
- **T7 wrapper** (manifest `0f5b1e9c794a25e71318a7d9dd3533c9e7327d4f4a6c76b8b622722eecb57017`). Reviewer-A findings A-TW-01 to A-TW-08 are closed and Reviewer-B approved revision 4.
  - `run-t7.mjs` keeps a label-only teardown. So T7 runs the documented command with `--keep` on an exact fresh `--checkout`. `lane-watch` then does the ADR-012 §15 cleanup with the frozen `storage-docker.mjs` ledger.
  - Before READY: W1 wake, W2 liveness, W3 strict boundary. After the run: W4 strict live end.
  - Fail-closed rules: a sticky `madeByRun=false`, an events-child end, a listing error or a stop-request doubt keeps every resource. A separate run-evidence record binds the gate inputs.
  - Controls: lane-watch 32/32, runlog 7/7, prepare/gate 5/5.
  - Later maintenance: QA-E2E should replace the frozen T7 label-only preflight and teardown in a separately reviewed freeze.
- **Canvas judge v2 with the sink-capture gate** (manifest `1af4609e1cecf0e7b08c454a884929836faac61efd306e73e84ac14844afc1d2`, Reviewer-A approved). Controls: 17/17.
- **Independent secret scan** (counts only; zero values = NO-COVERAGE) and the pinned post-incident observer `d60dc920…`.
- Evidence roots: `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-a784522-wgLHNZc0` (`a784522`) and `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-55c33a3-o05nHi07` (`55c33a3`).

### 9.3 Next gate

Common QA owns a common-oracle repair for `M1-38.common.h1`. After a new reviewed freeze, the plan is:
1. Common QA runs both complete M1 rounds; QA-E2E judges the 233 Canvas rows of each round with judge v2 and compares the two rounds.
2. After Common's cleanup and an explicit window transfer: M2 (all 64 rows) on `qa-e2e-sim-r6` / 8643 / 172.27.0.0/16.
3. Then T7 (three default runs, demo and confirmation checks, all 15 AC) on `qa-e2e-m3-r3` / 8543 / 172.31.0.0/16, strictly in sequence.

## 10. Round 7 — candidate `82e2dab` (2026-10-21)

**HOLD; this dispatch settles as failed.** A new QA-E2E session did this round. It did not execute rounds 1–6; their results stay at their own SHAs and carry no credit to this candidate.

Candidate product = test `82e2dab6d26915c90070a4aae8ac0c4472706c2d`. Lead authority: `msg_40eca66674cd` (host only; approved R4 and sink-v2 tool bytes). Mask and checkout rules: `msg_aea8cd9e30e0`, `msg_f132bffe54dc`, `msg_9ee0ecb9d2e6`. Closure: `msg_24bc463c9067`. Common QA held the only Docker window. This worker started no stack, no wake container and no Docker diagnostic.

### 10.1 Criterion status

| Criterion | Result | Evidence and limit |
| --- | --- | --- |
| AC-M3-01 | HOLD (partial) | The Common full run exited 1 at 04:55:18Z in round 1 snapshot-upgrade, after the repaired `M1-38.common.h1` passed. Common QA reports that its host `inspectBackup` collector expects an array and gets an object; no product defect is shown. Round 1 Canvas rows 233/233 PASS and sink gate PASS ([Canvas QA §16](../M1/qa-canvas.md#16-round-10--candidate-82e2dab-round-1-canvas-rows-complete-again-round-incomplete-2026-10-21)). The migration and storage phases, round 2 and legacy did not run. |
| AC-M3-02(a) | NOT RUN | No window. No T7 run, demo or confirmation check at this SHA. |
| AC-M3-02(b) | Other owner | Common QA owns the legacy suites. They did not run. |
| AC-M3-03 | NOT RUN | No M2 run at this SHA. The 64/64 result at `aff4882` is history only. |
| AC-M3-04 | NOT RUN (QA-E2E part) | Needs the M2 run. |
| AC-M3-05 | UNVERIFIED | All 32 live rows stay UNVERIFIED ([live matrix](live.md)). Local Canvas stays DEFERRED. No sign-up, account, tunnel, public exposure, live-tenant write or Docker Desktop change. |
| AC-M3-06 | No QA-E2E run evidence | No QA-E2E lane was used. Common QA reports a strict W4 comparison PASS and zero owned resources after its run. |
| AC-M3-07 | Partial | Canvas browser artifacts of round 1 SIM: 15 screenshots (9 distinct), 0 hits against 1,316 values, clean visual inspection. The 7 distinct raw traces stay private. The M2 and T7 scans need their runs. |

### 10.2 Prepared for the next window (host only; no product credit)

- Evidence root `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-82e2dab-EphODiew` (`R`), private (0700 folders, 0600 files). It holds the exact-SHA source clone and the approved R4 and sink-v2 tool bytes with verified manifests. Details: [Canvas QA §16.1](../M1/qa-canvas.md#161-preparation-host-only).
- Lead decisions for the runtime: the runner child (`run-with-ts` with `run-m2.mjs` or `run-t7.mjs`) uses umask 022. lane-watch, the observer, the capture watcher, the scans and the judges use umask 077. M2 uses `--workdir R/m2-stack`. T7 `prepare-checkout` runs under umask 022 into `R/t7-clone/<name>`; `R` and `R/t7-clone` are owned 0700 folders (option A, `msg_9ee0ecb9d2e6`).
- Boundary: `/Users/quangnguyen` is 0750 with group staff. The only account with primary group staff is the owner. `R` blocks every other non-root user (`R/notes/boundary-host-only.json`).
- Reserved lanes stay: M2 on `qa-e2e-sim-r6` / 8643 / `172.27.0.0/16`, then T7 on `qa-e2e-m3-r3` / 8543 / `172.31.0.0/16`, strictly in sequence and only after an explicit Lead window.

### 10.3 Next gate

Common QA repairs its host collector under a new reviewed freeze. Then both complete M1 rounds run, with the Canvas judges on each round and the round comparison. After that: M2 (all 64 rows) and T7 (three default runs, the demo pass, four confirmation checks, all 15 AC) under explicit windows.

## 11. Round 8 — candidate `51a80b5` (2026-10-21)

**HOLD; this dispatch settles as failed.** A new QA-E2E session did this round. It did not execute rounds 1–7; their results stay at their own SHAs and carry no credit to this candidate.

Candidate product = test `51a80b51de2c7491466a21a678418ff8178d247d` (tests tree `a47b34cd…`). It is `82e2dab` plus Common QA's backup-oracle repair (`tests/host/m1-migration.mjs` and its self-test). Product files equal `a784522`. Lead authority: `msg_3fc90776b450` (host only; approved R4 and sink-v2 tool bytes), run start `msg_cc57744668aa`, closure `msg_229e86b15fd5`. Common QA held the only Docker window. This worker started no stack, no wake container and no Docker diagnostic, and made no Docker daemon call.

### 11.1 Criterion status

| Criterion | Result | Evidence and limit |
| --- | --- | --- |
| AC-M3-01 | HOLD (partial) | The Common full run exited 1 at 05:57:35Z in round 1 snapshot-upgrade. `M1-38.common.h4` failed; `h1`, `h2`, `h3` and `h5` passed. QA-E2E's independent diagnosis: Common's host control ran the seed-stage CLI requests again at the start of the upgrade stage, and the replayed add-deployment grant replaced the seeded one. The product followed the contract. Lead accepted this as a reported Common-harness defect, and Common QA confirmed the cause independently (`msg_1b76a14fcad1`). Round 1 Canvas rows 233/233 PASS and sink gate PASS ([Canvas QA §17](../M1/qa-canvas.md#17-round-11--candidate-51a80b5-round-1-canvas-rows-complete-round-1-stopped-in-snapshot-upgrade-2026-10-21)). The migration and storage phases, round 2 and legacy did not run. |
| AC-M3-02(a) | NOT RUN | No window. No T7 run, demo or confirmation check at this SHA. |
| AC-M3-02(b) | Other owner | Common QA owns the legacy suites. They did not run. |
| AC-M3-03 | NOT RUN | No M2 run at this SHA. The 64/64 result at `aff4882` is history only. |
| AC-M3-04 | NOT RUN (QA-E2E part) | Needs the M2 run. |
| AC-M3-05 | UNVERIFIED | All 32 live rows stay UNVERIFIED ([live matrix](live.md)). Local Canvas stays DEFERRED: the SIM and Moodle gates did not pass at this candidate, so no feasibility assessment or startup happened. No sign-up, account, tunnel, public exposure, live-tenant write or Docker Desktop change. |
| AC-M3-06 | FAIL for this attempt (outer environment); no QA-E2E run evidence | No QA-E2E lane was used. Common QA's W4 capture passed, but its strict comparison failed: a new unrelated anonymous volume (`d5df35bd…`, CreatedAt 05:32:46Z) appeared, and six non-lane `fgw-*` containers were seen during the window and were gone at W4. No attribution is established; the unrelated volumes are preserved. The seven protected volumes, the W3 anonymous volume, networks, settings and engine match, and zero containers remained at cleanup (`msg_f0f6b9e20bf6`). This worker made no Docker daemon call; its only Docker binary calls were the client-only `docker --version` and `docker compose version --short`. |
| AC-M3-07 | Partial | Canvas browser artifacts of round 1 SIM: 15 screenshots (6 distinct), 0 hits against 1,316 values, clean visual inspection. The 7 distinct raw traces stay private. Common QA's scan of this attempt: 0 hits in 33 raw logs and 879 public files. The M2 and T7 scans need their runs. |

### 11.2 Prepared (host only; no product credit)

- Evidence root `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-51a80b5-KfIjrKmn` (`R`). `R` and its folders are 0700. It holds the exact-SHA source clone and the approved R4 and sink-v2 tool bytes with verified manifests. Details: [Canvas QA §17.1](../M1/qa-canvas.md#171-preparation-host-only).
- `R/plan/runbook-51a80b5.md` gives the concrete M2 and T7 commands of the approved plan for this candidate. Under the Lead's permission contract, the runner children and `prepare-checkout` use umask 022. lane-watch, the observer, the capture watcher, the scans and the judges use umask 077. M2 uses `--workdir R/m2-stack`. T7 uses `R/t7-clone/qa-e2e-m3-r3-51a80b51-<UTC>`.
- Reserved lanes stay: M2 on `qa-e2e-sim-r6` / 8643 / `172.27.0.0/16`, then T7 on `qa-e2e-m3-r3` / 8543 / `172.31.0.0/16`, strictly in sequence and only after an explicit Lead window.

### 11.3 Next gate

Common QA repairs the host-control replay under a new reviewed freeze, and the outer-environment change is resolved or attributed before a new window. Then both complete M1 rounds run, with the Canvas judges on each round and the round comparison. After that: M2 (all 64 rows) and T7 (three default runs, the demo pass, four confirmation checks, all 15 AC) under explicit windows.

## 12. Round 9 — candidate `9cdd768` (2026-10-21)

**HOLD; the full attempt failed.** A new QA-E2E session did this round. It did not execute rounds 1–8; their results stay at their own SHAs and carry no credit to this candidate.

Candidate product = test `9cdd7687b91169a262648018ec6945efa31217dc` (tests tree `eccd4b50…`). It is `51a80b5` plus Common QA's host-control replay repair (`tests/host/m1-control.mjs` and its self-test). Product files equal `a784522`. Lead authority: `msg_320a8f66e700` (host-only preparation), `msg_a867b85d536b` (host-only Canvas judge of Common's phases) and `msg_3ea5c8fe52fd` (record the failure). Common retry `ctx_9e877dcb4b10` held the only Docker window. This worker started no stack, no wake container and no Docker diagnostic, and made no Docker daemon call.

### 12.1 Criterion status

| Criterion | Result | Evidence and limit |
| --- | --- | --- |
| AC-M3-01 | HOLD (partial) | Common's full run exited 1 at 07:40:46Z in round 1 storage. Round 1: SIM 394/394, snapshot-isolated 6/6, snapshot-upgrade 6/6 (`M1-38.common.h1`–`h5` PASS, no host-control replay), migration 12/12, storage 1 PASS and 69 FAIL. Round total 419 PASS, 69 FAIL of 488. QA-E2E's first diagnosis names three root failures: `c-selftest` and `a-fresh` look like Common harness or oracle defects; the `e-old-schema` import failure is not established. The other failed storage rows did not run because of `a-fresh`. Common QA confirmed all three independently (`msg_d6729b90ce8e`). Round 1 Canvas rows 233/233 PASS and sink gate PASS ([Canvas QA §18](../M1/qa-canvas.md#18-round-12--candidate-9cdd768-round-1-canvas-rows-complete-round-1-failed-in-storage-2026-10-21)). Round 2 and legacy did not run. |
| AC-M3-02(a) | NOT RUN | No window. No T7 run, demo or confirmation check at this SHA. |
| AC-M3-02(b) | Other owner | Common QA owns the legacy suites. They did not run. |
| AC-M3-03 | NOT RUN | No M2 run at this SHA. The 64/64 result at `aff4882` is history only. |
| AC-M3-04 | NOT RUN (QA-E2E part) | Needs the M2 run. |
| AC-M3-05 | UNVERIFIED | All 32 live rows stay UNVERIFIED ([live matrix](live.md)). Local Canvas stays DEFERRED: the SIM and Moodle gates did not pass at this candidate, so no feasibility assessment or startup happened. No sign-up, account, tunnel, public exposure, live-tenant write or Docker Desktop change. |
| AC-M3-06 | No QA-E2E run evidence | No QA-E2E lane was used. The Lead reports that Common's W4 end boundary and strict comparison passed. This worker's only Docker binary calls were the client-only `docker --version` and `docker compose version --short`. |
| AC-M3-07 | Partial | Canvas browser artifacts of round 1 SIM: 15 screenshots (6 distinct), 0 hits against 1,316 values, clean visual inspection. The 7 distinct raw traces stay private. Common's scan of this attempt: 0 hits for 1,466 + 53 values in 45 raw and 1,096 public files. The M2 and T7 scans need their runs. |

### 12.2 Prepared (host only; no product credit)

- Evidence root `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-9cdd768-mVjZIekp` (`R`). `R` and its folders are 0700. It holds the exact-SHA source clone and the approved R4 and sink-v2 tool bytes with verified manifests. Details: [Canvas QA §18.1](../M1/qa-canvas.md#181-preparation-host-only).
- `R/notes/handoff.md` (`4a0a1b5e…`) and `R/notes/prep.json` (`c95e1bbb…`): the Lead verified and accepted them (`msg_aa95f18bcc73`).
- `R/plan/runbook-9cdd768.md` (`6100a075…`) gives the concrete Canvas judge, M2 and T7 commands of the approved plan. The runner children and `prepare-checkout` use umask 022. lane-watch, the observer, the capture watcher, the scans and the judges use umask 077.
- Planned lanes, to be confirmed by the Lead at a window: M2 on `qa-e2e-sim-r6` / 8643 / `172.27.0.0/16`, then T7 on `qa-e2e-m3-r3` / 8543 / `172.31.0.0/16`, strictly in sequence.
- Storage diagnosis record: `R/diag/m1-r1-storage/storage-r1-diagnosis.json` (`a6cf303e…`).

### 12.3 Next gate

Common QA repairs the two harness defects, and the `e-old-schema` import failure is diagnosed (environment or product). Any repair goes through a new reviewed freeze. Then both complete M1 rounds run, with the Canvas judges on each round and the round comparison. After that: M2 (all 64 rows) and T7 (three default runs, the demo pass, four confirmation checks, all 15 AC) under explicit windows.

## 13. Round 10 — candidate `aaa823b` (2026-10-21)

**HOLD; the full attempt failed.** A fresh QA-E2E session did this round. It did not execute rounds 1–9; their results stay at their own SHAs and carry no credit to this candidate.

Candidate product = test `aaa823b25306c5e560f7c4050238b374dec4d4e3` (tests tree `4c7e067f…`). It is `9cdd768` plus the storage-harness repair `0e83e3c`, the reset repair `89fb4b4` and the content-refusal repair `aaa823b`. Canvas, M2, T7 and simulator tests did not change; `tests/e2e` also equals `aff4882`. `run-t7.mjs` calls the changed `stack-reset.sh` through `test:e2e` and `e2e:reset`, so a T7 run at this SHA would exercise the reset repair. Lead authority: `msg_570cd1eeaefd` (host-only preparation), `msg_ce27725ccc0d` (host-only Canvas judge) and `msg_6627a593581e` (record the failure). Common retry `ctx_b4253986bb55` held the only Docker window. This worker started no stack, no wake container and no Docker diagnostic. It executed no `docker` or `docker compose` binary; a PATH stub recorded 0 calls.

### 13.1 Criterion status

| Criterion | Result | Evidence and limit |
| --- | --- | --- |
| AC-M3-01 | HOLD (partial) | Common's full run exited 1 at 11:36:48Z in round 1 storage. Round 1: SIM 394/394, snapshot-isolated 6/6, snapshot-upgrade 6/6 (`M1-38.common.h1`–`h5` PASS), migration 12/12, storage 20 PASS and 50 FAIL. Round total 438 PASS, 50 FAIL of 488, same SHA in all five phases. A first look finds four root failures: `a-serialize` (lock-release log assertion), seven rows with "EACCES … scandir '/v/appdb/packages'" in the QA fixture listing, `a-first-start-resume` (the product quarantine refuses `source_unreadable` on `cogniate-app/packages`) and `e-old-schema` (portal sign-in HTTP 403 after the content check). Forty rows did not run because of them. Cause not established; Common QA owns the classification. Round 1 Canvas rows 233/233 PASS and sink gate PASS ([Canvas QA §19](../M1/qa-canvas.md#19-round-13--candidate-aaa823b-round-1-canvas-rows-complete-round-1-failed-in-storage-2026-10-21)). Round 2 and legacy did not run; no round comparison. |
| AC-M3-02(a) | NOT RUN | No window. No T7 run, demo or confirmation check at this SHA. |
| AC-M3-02(b) | Other owner | Common QA owns the legacy suites. They did not run. |
| AC-M3-03 | NOT RUN | No M2 run at this SHA. The 64/64 result at `aff4882` is history only. |
| AC-M3-04 | NOT RUN (QA-E2E part) | Needs the M2 run. |
| AC-M3-05 | UNVERIFIED | All 32 live rows stay UNVERIFIED ([live matrix](live.md)). Local Canvas stays DEFERRED: the SIM and Moodle gates did not pass at this candidate, so no feasibility assessment or startup happened. No sign-up, account, tunnel, public exposure, live-tenant write or Docker Desktop change. |
| AC-M3-06 | No QA-E2E run evidence | No QA-E2E lane was used. Common reports that W4, the strict comparison, the clone guard and its scan finished at 11:37:11Z; the Lead reports them as PASS. QA-E2E did not inspect them. |
| AC-M3-07 | Partial | Canvas browser artifacts of round 1 SIM: 15 screenshots (6 distinct), 0 hits against 1,316 values, clean visual inspection. The 7 distinct raw traces stay private (124 hits in 7 files, expected for raw traces). Runner scan records of all five phases: 0 hits. The M2 and T7 scans need their runs. |

### 13.2 Prepared (host only; no product credit)

- Evidence root `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-aaa823b-ktBOQB57` (`R`). `R`, the top of `R/source` and all 23 folders outside `R/source` (run, private and tool folders) are 0700. Outside `R/source`, regular files are 0600, except the two Docker guard stubs and the session wait helper (0700 executables). Children inside `R/source` were made under umask 022 (folders 0755; files 0644, 0755 or, for one Playwright report file, 0664). Inventory: `R/notes/mode-inventory.txt` (`edb3cac2…`), `stat` only. It holds the exact-SHA source clone and the approved R4 and sink-v2 tool bytes with verified manifests. Details: [Canvas QA §19.1](../M1/qa-canvas.md#191-preparation-host-only).
- Independence disclosure: at about 10:39Z, one broad run-wide inbox listing showed the already submitted summary payloads of both content-refusal reviewers and the Q1/Q2 grant subject. No reviewer or QA report file was opened; the content was not used. Frozen criteria, cases and tools stayed unchanged. Reported in `msg_6e50d2d5f439`, recorded by the Lead in `msg_1183c4e6ff3d`. Later inbox reads used only the exact worker handle.
- `R/notes/handoff.md` (`a3af986a…`), `R/notes/prep.json` (`6634dc80…`) and `R/notes/prep-file-hashes.sha256` (`fcc103ac…`): the Lead verified and accepted them (`msg_ce27725ccc0d`).
- `R/plan/runbook-aaa823b.md` (`52f37a27…`) gives the concrete Canvas judge, M2 and T7 commands of the approved plan, and maps the wrapper fail-closed rules to existing self-test checks. The runner children and `prepare-checkout` use umask 022. lane-watch, the observer, the capture watcher, the scans and the judges use umask 077.
- Planned lanes, to be confirmed by the Lead at a window: M2 on `qa-e2e-sim-r6` / 8643 / `172.27.0.0/16`, then T7 on `qa-e2e-m3-r3` / 8543 / `172.31.0.0/16`, strictly in sequence.
- Round 1 record with the storage first look: `R/judge/round1/round1-final-record.json` (`b3db0127…`).

### 13.3 Next gate

Common QA classifies the four root storage failures (product, harness or environment). Any repair goes through a new reviewed freeze. Then both complete M1 rounds run, with the Canvas judges on each round and the round comparison. After that: M2 (all 64 rows) and T7 (three default runs, the demo pass, four confirmation checks, all 15 AC) under explicit windows.

## 14. Round 11 — candidate C3 `c4c6d04` (2026-10-22)

**HOLD; the full attempt failed.** A fresh QA-E2E session did this round: `claude-opus-5-5`, xhigh; Orca session `34e03f7b-2209-4749-8db7-c5b507717b71`; task `task_5f3f8aa499cb`, dispatch `ctx_1fd6cb09010e`. It did not execute rounds 1–10. Their results stay at their own SHAs and carry no credit to this candidate. Candidate C2 `0938ea1` had only a host preparation by another session; its storage diagnostic failed, and it has no QA-E2E result.

Candidate product = test `c4c6d045b3a132f72bf059d77367d278de9222fa` (tests tree `17330479…`). It is C2 `0938ea1` plus the R4 repair `cd73139` of the Common-owned `tests/host/storage-rows.mjs` and its self-test, and later docs-only commits. Product and build paths equal `9f8ac62`. Canvas, M2, T7 and simulator tests did not change; `tests/e2e` still equals `aff4882`. Lead authority: the dispatch preamble (host only) and `msg_952820585105`, `msg_53398fdb8c4b`, `msg_5c47811ac5d9`, `msg_7843086da8ce`, `msg_de67b6b34ca8`, `msg_04a1afc953ac`. Common QA `ctx_2e9642c8e4be` held the only Docker window. This worker started no stack, no wake container and no Docker diagnostic. It executed no `docker` or `docker compose` binary; a PATH stub recorded 0 calls.

### 14.1 Criterion status

| Criterion | Result | Evidence and limit |
| --- | --- | --- |
| AC-M3-01 | HOLD (partial) | Common's full run started at 02:40:53Z. Round 1: SIM 394/394, snapshot-isolated 6/6, snapshot-upgrade 6/6 (`M1-38.common.h1`–`h5` PASS), migration 12/12, storage 52 PASS and 18 FAIL. Round total 470 PASS, 18 FAIL of 488, same SHA in all five phases. The phase and id set equals the 488 rows of the frozen manifests exactly. The only failed executed row is `M1-41.common.g-tamper` ("--recover after the tamper: expected exit 2, got 1"); the other 17 failed rows did not run because a prerequisite in that chain did not pass. Cause not established; the repair session `ctx_898acbaef3a6` owns the diagnosis. Round 1 Canvas rows 233/233 PASS and sink gate PASS ([Canvas QA §20](../M1/qa-canvas.md#20-round-14--candidate-c3-c4c6d04-round-1-canvas-rows-complete-round-1-failed-in-storage-2026-10-22)). Round 2 and legacy did not run; no round comparison. |
| AC-M3-02(a) | NOT RUN | No window. No T7 run, demo pass or confirmation check at this SHA. |
| AC-M3-02(b) | Other owner | Common QA owns the legacy suites. They did not run. |
| AC-M3-03 | NOT RUN | No M2 run at this SHA. The 64/64 result at `aff4882` is history only. |
| AC-M3-04 | NOT RUN (QA-E2E part) | Needs the M2 run. |
| AC-M3-05 | UNVERIFIED | All 32 live rows stay UNVERIFIED ([live matrix](live.md)). Local Canvas stays DEFERRED: the SIM and Moodle gates did not pass at this candidate, so no feasibility assessment or startup happened. No sign-up, account, tunnel, public exposure, live-tenant write or Docker Desktop change. |
| AC-M3-06 | No QA-E2E run evidence | No QA-E2E lane was used. The Lead reports that Common's run ended and returned its window; QA-E2E did not inspect Common's W4, cleanup or scans. |
| AC-M3-07 | Partial | Canvas browser artifacts of round 1 SIM: 15 screenshots (6 distinct), 0 hits against 1,315 values, clean visual inspection. The 14 raw trace zips stay private (120 hits in 7 files, expected for raw traces). Runner scan records of all five phases: 0 hits. The M2 and T7 scans need their runs. |

### 14.2 Prepared (host only; no product credit)

- Evidence root `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-c4c6d04-qA52QXut` (`R`), made under umask 077. Outside `R/source`, folders are 0700 and files 0600, except three 0700 executables (two Docker guard stubs, one wait helper). Children of `R/source` come from the umask-022 clone and dependency copy. Details: [Canvas QA §20.1](../M1/qa-canvas.md#201-preparation-host-only).
- The approved R4, sink-v2 and Common boundary tools are byte-identical copies of the accepted C2 preparation (37/37). No tool self-test, host suite or M2 harness run was repeated. The cached test dependencies were copied after exact package, lock and entry checks.
- `R/plan/runbook-c4c6d04.md` (`32f390b5…`) and `R/plan/window-commands-c4c6d04.md` (`4435163d…`) are literal derivations of the accepted C2 plans. M2 is planned on `qa-e2e-sim-r6` / 8643 / `172.27.0.0/16`, and then T7 on `qa-e2e-m3-r3` / 8543 / `172.31.0.0/16`, strictly in sequence. Each window needs its own G1 and W1–W4; the sampler stays alive through the W4 capture. T7 uses `run-t7.mjs --sha c4c6d045b3a132f72bf059d77367d278de9222fa --checkout <new DEST> --runs 3 --demo --check-confirm --keep` inside the approved external ownership wrapper.
- Handoff `R/notes/handoff.md` (`b3347462…`) and manifest `R/notes/MANIFEST-host-ready.sha256` (`dec68131…`): the Lead verified and accepted them (`msg_53398fdb8c4b`).

### 14.3 Next gate

The repair session `ctx_898acbaef3a6` diagnoses `M1-41.common.g-tamper`. Any repair goes through a new reviewed freeze. Then both complete M1 rounds run, with the Canvas judges and the exact row-set check on each round and the round comparison. After the accepted full and legacy gate: M2 (all 64 rows) and T7 (three default runs, the demo pass, four confirmation checks, all 15 AC), each under its own explicit window.

## 15. Round 12 — candidate C4 `bf09cda` (2026-10-22)

**HOLD; overall full acceptance is PENDING.** A fresh QA-E2E session did this round: `claude-opus-5-5`, xhigh; Orca session `fe5b6a79-3e58-4919-b764-e7ab4cc6ec6a`; task `task_1eabbfbed895`, dispatch `ctx_745cb25fcb7c`. It did not execute rounds 1–11. Their results stay at their own SHAs and carry no credit to this candidate.

Candidate product = test `bf09cdad91ca548e1ecbc14428b55180d35d5360` (tests tree `8283d90d…`). It is C3 `c4c6d04` plus the R5 repair `27e1f61` of the Common-owned `tests/host/storage-rows.mjs` and its self-test, the text-only `infra/README.md` clarification and later docs-only commits. Product and build paths equal `9f8ac62`. Canvas, M2, T7 and simulator tests did not change; `tests/e2e` still equals `aff4882`. Lead authority: the dispatch preamble (host only) and `msg_6a1f7731232e`, `msg_26da51187107`, `msg_d1f00e6c240b`, `msg_92797f8d189e`, `msg_f31679702ee3`, `msg_972209aa6979`, `msg_d3435c5e5e8d`. Common QA `ctx_e23ced3dd1fa` held the only Docker window. This worker started no stack, no wake container and no Docker diagnostic. It executed no `docker` or `docker compose` binary; a PATH stub logged only its own 2-line positive control.

### 15.1 Criterion status

| Criterion | Result | Evidence and limit |
| --- | --- | --- |
| AC-M3-01 | HOLD (partial) | Common's full run started at 05:26:57Z. Round 1 is complete: SIM 394/394, snapshot-isolated 6/6, snapshot-upgrade 6/6, migration 12/12, storage 70/70, total 488 PASS, same SHA in all five phases. The phase and id set equals the 488 rows of the frozen manifests exactly, and each phase file parse-equals Common's accounting file. Round 1 Canvas rows 233/233 PASS and sink gate PASS ([Canvas QA §21](../M1/qa-canvas.md#21-round-15--candidate-c4-bf09cda-round-1-complete-and-canvas-rows-pass-full-attempt-stopped-in-round-2-2026-10-22)). The Lead reports that the runner exited 1 at 06:44:53Z in round 2: SIM 394/394 and snapshot-isolated 6/6 passed, but `M3-ISOLATION` failed because the unrelated container `/qa-la-sim-r2-cogniate-app-1` changed (16 new LA resources in the strict W4 comparison). No product or test fault is established. QA-E2E did not judge round 2. No round comparison; legacy did not run. |
| AC-M3-02(a) | NOT RUN | No window. No T7 run, demo pass or confirmation check at this SHA. |
| AC-M3-02(b) | Other owner | Common QA owns the legacy suites. They did not run. |
| AC-M3-03 | NOT RUN | No M2 run at this SHA. The 64/64 result at `aff4882` is history only. |
| AC-M3-04 | NOT RUN (QA-E2E part) | Needs the M2 run. |
| AC-M3-05 | UNVERIFIED | All 32 live rows stay UNVERIFIED ([live matrix](live.md)). Local Canvas stays DEFERRED: the full and Moodle gates did not pass at this candidate, so no feasibility assessment or startup happened. No sign-up, account, tunnel, public exposure, live-tenant write or Docker Desktop change. |
| AC-M3-06 | No QA-E2E run evidence | No QA-E2E lane was used. The round 2 isolation failure belongs to Common's lane check (Lead report); QA-E2E did not inspect Common's W4, cleanup or scans. |
| AC-M3-07 | Partial | Canvas browser artifacts of round 1 SIM: 15 screenshots (6 distinct), 0 hits against 1,315 values, clean visual inspection. The 14 raw trace zips stay private (120 hits in 7 files, expected for raw traces). Runner scan records of all five round 1 phases: 0 hits. The M2 and T7 scans need their runs. |

### 15.2 Prepared (host only; no product credit)

- Evidence root `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-bf09cda-Kb7OPU3d` (`R`), made under umask 077. In the preparation inventory, outside `R/source`, folders were 0700 and files 0600, except three 0700 executables (two Docker guard stubs, the wait helper `wait-watch.sh`). At the round 1 closeout there are four: the fourth is `R/private/tmp/wait.sh`, which only waits for Orca inbox messages and is not evidence logic. Children of `R/source` come from the umask-022 clone and dependency copy. Details: [Canvas QA §21.1](../M1/qa-canvas.md#211-preparation-host-only).
- The qualified R4, sink-v2 and Common boundary tools are byte-identical copies of the accepted C3 preparation (37/37; C3 closeout manifest 106/106 checked first). No tool self-test, host suite or M2 harness run was repeated. The cached test dependencies were copied after exact package, lock and entry checks (1,927 entries).
- `R/plan/runbook-bf09cda.md` (`73c80fc3…`) and `R/plan/window-commands-bf09cda.md` (`8e344fc8…`) are literal derivations of the accepted C3 plans. M2 is planned on `qa-e2e-sim-r6` / 8643 / `172.27.0.0/16`, and then T7 on `qa-e2e-m3-r3` / 8543 / `172.31.0.0/16`, strictly in sequence. Each window needs its own G1 and W1–W4; the sampler stays alive through the W4 capture. T7 uses `run-t7.mjs --sha bf09cdad91ca548e1ecbc14428b55180d35d5360 --checkout <new DEST> --runs 3 --demo --check-confirm --keep` inside the approved external ownership wrapper.
- Handoff `R/notes/handoff.md` (`3998f911…`) and manifest `R/notes/MANIFEST-host-ready.sha256` (`4e9ef764…`): the Lead verified and accepted them (`msg_6a1f7731232e`).

### 15.3 Next gate

Common's full attempt must run again with an exclusive Docker window and no external Docker activity. Then both complete M1 rounds need the Canvas judges, the exact row-set check on each round and the round comparison, and the 12 legacy groups must pass. After the accepted full and legacy gate: M2 (all 64 rows) and T7 (three default runs, the demo pass, four confirmation checks, all 15 AC), each under its own explicit window.

## 16. Round 13 — candidate C4 `bf09cda` (`full2` retry, bounded two-round checkpoint) (2026-10-22)

**HOLD (bounded two-round checkpoint); overall full acceptance is PENDING.** Under the product owner's model transition (`docs/team/model-transition-2026-10-22.md`), replacement independent Canvas QA-E2E (`task_1eabbfbed895`, dispatch `ctx_296da6e34f11`, terminal `term_3fd51366-4ec9-4a5c-994d-be6f04a4bcf1`, Antigravity Gemini 4 Argon (High), `gemini-4-argon-high`, high effort) adopted the held C4 root `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-bf09cda-Kb7OPU3d` read-only (`msg_16a26a6bf279`, `msg_f000ec7efa0a`) after the earlier Claude Code Opus 5.5 xhigh session (`ctx_745cb25fcb7c`) judged `full2` round 1 (`msg_ddb281d01832`, `msg_7d3f9ba8b68c`) and settled. This session judged `full2` round 2 and the round-1 vs. round-2 comparisons under `msg_8a7fc83b1a13` (`msg_486a0d5f48c7`). It did not execute rounds 1–12 or `full2` round 1; their provenance stays as recorded above.

Candidate product = test `bf09cdad91ca548e1ecbc14428b55180d35d5360` (tests tree `8283d90dc669feb72eeb7ec43f5dbf80a156f0d4`). Source, tests, criteria and qualified tools are unchanged. Common runtime QA (`ctx_e23ced3dd1fa`, continued by `ctx_77546b08ce17`) holds the active full/legacy window. Canvas QA-E2E remains host-only and executed no `docker` or `docker compose` binary (`R/private/stub-bin/calls.log` remains 2 lines / 113 B positive control only).

### 16.1 Criterion status

| Criterion | Result | Evidence and limit |
| --- | --- | --- |
| AC-M3-01 | HOLD (two-round M1 + Canvas equality PASS; legacy and final W4 pending) | Common's `full2` retry started at `07:14:45Z` from `qa-common-c4-20261022T0408Z/full2-src/source`. Both 488-row rounds are complete at `bf09cda…`: Round 1 passed `394/6/6/12/70` = `488/488 PASS` (`07:14:45Z`–`08:06:21.854Z`); Round 2 passed `394/6/6/12/70` = `488/488 PASS` (`08:06:26.068Z`–`08:58:28.138Z`). In both rounds, the phase and id set equals the frozen 488-row manifest list (`97e37fa1…`) with 0 duplicates, 0 missing and 0 extra, `M1-41.common.c-host-negative` is `PASS`, and all 10 phase `m1-case-results.json` files are parsed-equal to Common's `round-N-<phase>.json` files in `qa-m1-accounting-pld7ce`. Independent Canvas QA-E2E judged `233/233 PASS` in round 1 (`judge/full2-round1/judge-v1.json`, `efcaa4d0…`) and `233/233 PASS` in round 2 (`judge/full2-round2/judge-v1.json`, `76b1004b…`), with sink gate `PASS` in both rounds (`1e64ea2d…`, `49084aed…`). Round 1 vs. Round 2 equality passed for all 233 Canvas rows (`compare-rounds.json`, `9246450d…`) and all 488 rows across all five phases (`compare-488-rounds.json`, `4678381e…`). Details: [Canvas QA §22](../M1/qa-canvas.md#22-round-16--candidate-c4-bf09cda-full2-retry-both-488-row-rounds-complete-canvas-233233-pass-in-each-per-case-equality-pass-legacy-and-final-w4-pending-2026-10-22). Common's 12 legacy groups and final `full2` W4 closure remain pending. |
| AC-M3-02(a) | NOT RUN | No M3 T7 window granted yet on C4 `bf09cda`. |
| AC-M3-02(b) | Other owner (running/pending) | Common QA owns the 12 legacy groups. They follow round 2 in the active `full2` run. |
| AC-M3-03 | NOT RUN | No M2 window granted yet on C4 `bf09cda`. The 64/64 result at `aff4882` is history only. |
| AC-M3-04 | Partial (M1 SIM rounds 1 and 2 PASS; M2 part NOT RUN) | In both `full2` rounds, app and LTI health after `sim` and `snapshot-isolated` show `default`, `knobs: []` and LTI `simulation_profiles: []`. The M2 run remains pending. |
| AC-M3-05 | UNVERIFIED | All 32 live rows stay UNVERIFIED ([live matrix](live.md)). Local Canvas stays DEFERRED: the full/legacy, M2 and T7 gates are not yet complete at this candidate, so no feasibility assessment or startup happened. No sign-up, account, tunnel, public exposure, live-tenant write or Docker Desktop change. |
| AC-M3-06 | Pending (no QA-E2E lane used yet; `full2` W4 pending) | No QA-E2E lane was used. `full2` W3 (`ee6a4afa…`) protects 10 volume records under Lead decision `msg_1364abcfecfe` (original exact-nine precondition deviation disclosed). A transient Savoy probe (`sto-rmq-probe`) at `07:32Z` was gone before the `07:37:53Z` `snapshot-isolated` PRE check; all ten closed round-1 and round-2 phases passed their phase isolation checks. LA and Savoy hold Docker work until explicit handoff. Final `full2` W4 comparison and M2/T7 window boundaries remain pending. Later M2/T7 windows must verify all 10 `full2` W3 volume records (7 original + 3 anonymous) before lane start. |
| AC-M3-07 | Partial (both `full2` M1 rounds PASS; M2/T7 pending) | Canvas browser artifacts of `full2` round 1 (`dc8a4d46…`) and round 2 (`b36e1ce2…`): 29 targets in 7 folders each (15 shared PNG, 14 private trace zips). `secret-scan` against 1,316 values in each round (`c9160e34…`, `d82c6665…`) found **0 hits** in the 15 shared PNGs; visual checks of all 6 distinct PNGs per round (`8edf7062…`, `54a7a4ca…`) found no token, capability or approval input. Raw trace zips stay private (120 hits in 7 files in round 1; 124 hits in 7 files in round 2, expected for raw traces). Runner scan records of all 10 phase folders across both rounds report 0 hits. M2 and T7 scans await their runs. |

### 16.2 Preserved and new evidence manifests (host only)

- Held root `R` = `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-bf09cda-Kb7OPU3d`.
- Preserved manifests verified `119/119` (`notes/MANIFEST-r1-closeout-v2.sha256`, `adc0a74e…`) and `17/17` (`judge/full2-round1/MANIFEST-full2-round1.sha256`, `d8417761…`; record `868d68fe…`) with 0 mismatches.
- New `full2` round-2 and round-comparison manifest `judge/full2-round2/MANIFEST-full2-round2.sha256` (`82cbc38ab5be0d979212e1dd04b511cf4cbf198b862e68c6638a9dc6fc9075a6`, 23 entries, all mode `0600` inside `0700` `judge/full2-round2` and `scan/full2-round2`; record `judge/full2-round2/round-record.txt`, `948d59ed…`) verified `23/23` with 0 mismatches.
- Disclosures D-1, N-1, D-2, D-3, D-4 (`notes/deviations.txt`, `notes/deviations-2.txt`) and D-5 (`judge/full2-round2/deviations-r2.txt`, `223ce095…`; authoritative `summary.sha` check in `judge/full2-round2/bind-v2.txt`, `62dc26fb…`) are preserved.

### 16.3 Next gate

Common QA completes the 12 legacy groups, the final `full2` W4 capture/comparison and owned cleanup. After the full and legacy gate passes, QA-E2E executes fresh M2 (64 cases, 13 AC on `qa-e2e-sim-r6` / 8643 / `172.27.0.0/16`) and fresh T7 (three consecutive default runs of 17 PASS / 0 FAIL / 1 demo-only skip, demo <= 180 s, four confirmation checks, all 15 AC on `qa-e2e-m3-r3` / 8543 / `172.31.0.0/16`), each under a separate explicit Lead window preserving all 10 `full2` W3 volume records.


## 17. Round 12 — Candidate `C6` `4008afb9` / Tests `C8` `5561e8f7` & `C9` `9eb504f5` (`E-R6` / `E-R7`: M1 & M2 Accepted PASS; T7 Pending on Host Return Cutoff, 2026-10-23)

- **Worker & Lifecycle Identity**: Independent QA-E2E (`Antigravity Gemini 4 Argon (High)`, model `gemini-4-argon-high`, effort `high`, no subworkers), terminal `term_3fd51366-4ec9-4a5c-994d-be6f04a4bcf1`, task `task_3ca468cb75c8`, dispatch `ctx_8449a3df3e54`.
- **Evidence Root**: `R = /Users/quangnguyen/cogniate-canvas-qa-runs/verification-5561e8f-c8R3Prep` (`MANIFEST-host-ready.sha256` `d7bbdb75d084bfa20324806b473b49e7273e43c02f44ffd0ebb9ae54f806dc60`, `84/84` OK; `MANIFEST-lane-watch-r4-v2.sha256` `1b6be474b5a972b5b028e064985486ea6a2f5e43767ce48f2ac63a676af27fef`, `6/6` OK).

### 17.1 Criterion Status at `04:45 UTC` Host Return

| Criterion | Result | Evidence and limit |
| --- | --- | --- |
| AC-M3-01 | **PASS** (accepted in `msg_1d96a40f0530`) | Split 488-row M1 ledger under `E-R7`: two fresh `sim` rounds at product `C6` (`4008afb92fe983d52db33442e060210b929966c8`) + tests `C9` (`9eb504f5bff4be7e291570fde12fdf9919a07fa1`) passed `394/394` rows (`232` Canvas [`225` API + `7` browser], `136` Blackboard, `26` Common) and `7/7` dead-handler preconditions in both Round 1 (`sim394-judge.json` `6a144eff...`, `dead-handler-7cases-v2.json` `a48da55f...`, `sealed-r1-reconciliation.json` `80553cfb...`) and Round 2 (`sim394-judge.json` `b772a382...`, `dead-handler-7cases.json` `13d71c0b...`, `sealed-r2-reconciliation.json` `ca0ce2d9...`), with `0` differences in `compare-sim394-c9-v5-rounds.json` (`bb42dea4...`), combined with the `94` carried non-`sim` rows (`6` `snapshot-isolated` including 233rd Canvas row `M1-37.canvas.aa`, `6` `snapshot-upgrade`, `12` `migration`, `70` `storage`) passing `94/94` in both `C4` (`bf09cdad91ca548e1ecbc14428b55180d35d5360`) `full2` rounds (`c4-adr012-carried-evidence-mapping.json` `e29e7cc5...`; see [Canvas QA §24](../M1/qa-canvas.md#24-round-18--candidate-c6-4008afb9--tests-c9-9eb504f5-e-r7-v5-two-round-sim-rerun-7-dead-handler-cases-488-row-split-ledger--c4-adr-012-r67-mapping-2026-10-23-pass)). |
| AC-M3-02(a) | **PENDING** (unused grant closed; not FAIL/PASS) | External preflight completed in `$R/t7-external-preflight` (`w3-start.json` `8cbb2e04...`, `w3-32vol.json` `f3e16bca...`, `compare-vs-m2-w4-v2.json` `9ad49c7f...`). Because `delivery_b3dbcb6b45db` arrived at `04:33:55 UTC` (past the `04:33 UTC` runner-start cutoff in `msg_d04d641ae347` against the hard `04:45 UTC` host return) and `W1` wake produced a preflight default-bridge replacement (`7dac5c96...` $\rightarrow$ `b9a014a3...`), QA held per `msg_affa86d19d73` / `msg_d04d641ae347` and closed the unused T7 grant per `msg_1713b21b2f5b` without launching `run-t7-window-v2.sh` ([T7 QA](../T7/qa.md#m3-regression--candidate-c6-4008afb9--tests-c8-5561e8f7-2026-10-23-pending-external-preflight-only-unused-grant-closed-before-launch)). |
| AC-M3-02(b) | **PASS** (carried `E-R4`) | Common QA's `12/12` legacy groups (`T1`–`T6`) passed at product `C6` (`4008afb9...`) + tests `C7` (`70671e7b...`) and are carried unchanged under `E-R4` / `E-R6` / `E-R7`. |
| AC-M3-03 | **PASS** (accepted in `msg_d04d641ae347`) | M2 Attempt 4 (`qa-e2e-sim-r7-5561e8f7-2026-10-23T04-25-46-176Z` at product `C6` `4008afb9...`, tests `C8` `5561e8f7...`, equivalent at `C9` per `§12.6`) passed `64/64` cases across all `13` criteria and all `7/7` actual M2 gates (`PRE`, `CLONE`, `H1`, `M2-STACK`, `M3-07-M2`, `M3-06-M2`, `TEARDOWN`; `71/71` summary entries `PASS` in `summary.json` `9354bc51...`, `run-evidence.json` `cac0f6f4...`; see [M2 QA §11](../M2/qa.md#11-round-10--candidate-c6-4008afb9--tests-c8-5561e8f7-e-r6-attempts-13-not-accepted-attempt-4-qa-e2e-sim-r7-accepted-pass-6464-2026-10-23)). |
| AC-M3-04 | **PASS** (M1 & M2) | Default profile (`profile: default`, `knobs: []`, `simulation_profiles: []`) verified in both `V5` M1 rounds and in M2 Attempt 4 (`M2-STACK` / `observe2.mjs` `832b9f94...`). |
| AC-M3-05 | **UNVERIFIED** | All **32** real-LMS rows stay **`UNVERIFIED`** ([live matrix](live.md)); Local Canvas stays **`DEFERRED`**. |
| AC-M3-06 | **PASS** (M1 & M2; T7 **PENDING**) | Both `V5` M1 rounds (`w4-compare.json` R1 `b1d12472...`, R2 `12c0b3b9...`) and M2 Attempt 4 (`w4-compare.json` `9978db7b...`, `lane-watch-r4` `summary.json` `0ae9320a...` with `isolationPass: true` and `0` `listing_vanish`) preserved all `32` protected volume records and left `0` containers/networks/volumes and `0` owned processes. Current host-return boundary (`t7-external-preflight/w3-start.json` `8cbb2e04...`, `w3-32vol.json` `f3e16bca...`) proves `0` LTI containers and `32/32` volume records byte-equal to accepted M2 `W4` (`544142a1...`). Pre-`W3` M2 bridge replacement (`ea3da34c...` $\rightarrow$ `7dac5c96...`) and missed prelaunch hold are disclosed and reconciled in `pre-w3-bridge-reconciliation-v2.json` (`f75f9617...`) and `pre-w3-bridge-reconciliation-addendum-la.json` (`b26a4828...`). |
| AC-M3-07 | **PASS** (M1 & M2; T7 **PENDING**) | Secret scans passed with `0` shared hits in `V5` M1 Round 1 (`80e7a99a...`, `1,315` values), `V5` M1 Round 2 (`3da1faef...`, `1,315` values), and M2 Attempt 4 (`de83f4b8...`, `84` values, `0` shared hits, `0` private hits; runner `M3-07-M2` `74` values, `66` files, `0` hits). |

- **Final Host Return & LA Acknowledgment (`04:38:30 UTC`)**: Final host return to LA was fixed at `04:38:30 UTC` (`msg_c60a642ef29f`), acknowledged by LA in `msg_b7f76ead5610` confirming no LA mutation through that time (with correction `msg_3eafe1d524b8` that its seven `04:35:12Z` watcher events were the qualified wake-container lifecycle, not bridge events). `07:45 UTC` is the earliest permitted time to request a new LTI host window after the embargo, not a guaranteed reservation or completion time.


---

## 2026-10-23T15:54:00Z Append-Only Record — E-R8 Shared-Host T7 Verification Attempt (`t7-attempt-r8-20261023T1510Z`, Overall FAIL on Run 2 `A4` Sticky-Footer Viewport Cascade) & Bounded Four-File C10 Repair (`task_5bccef8e6029` / `ctx_73b31b9cc18d`)

- **Stage A External Preflights**:
  - **Attempt 1 (`$R/notes/t7-external-preflight-r8-20261023T1510Z`, Grant `msg_c210c4fab62b`, LA Handoff `msg_f6fa96e2f3e6`) — FAIL (Environment Fault, Zero Daemon Contact, Preserved)**: Top-level `HOME=$R/private/home` caused `settings.path` `ENOENT` in `w3-start.json` (`17,685` B, `0600`, SHA-256 `f338d34f9d4f659ee09c4e263211e4ac66a5e3055594149d47771cf23933a5e3`) and Docker CLI context fallback to `unix:///var/run/docker.sock` (`ENOENT`, raw stderr `194` B, SHA-256 `7f82543b38da1e2daad7c74045136e02753ca9315fce32ce59da86bdda722d11`; `w1-wake.json` `599` B `ab1fb113...` rc=2, `w2-liveness.json` `2,377` B `ebe3660b...` rc=2, `w3-anon.json` `385` B `ae2534cb...` rc=1, `w3-32vol.json` `9,072` B `7f26988c...` rc=1, `pre-w3-bridge-reconciliation.json` `20,821` B `83f3430a...`).
  - **Attempt 2 (`$R/notes/t7-external-preflight-r8-20261023T1521Z`, Replacement Grant `msg_6ead93e7a896`, Accepted in `PREFLIGHT_DECISION_MSG=msg_37daa6076f89`, LA Hold `msg_c1c6a9d55c38` through `15:50:00Z`) — PASS (All 5 Exits `0`)**: Executed under `E-A` `RUNENV` (`HOME=/Users/quangnguyen`). `w1-wake.json` (`1,667` B, `e89d4e4c72168f6ddcbee3cf8a04544dd51418cd225fbf289aa9c2a97ad8e38c`), `w2-liveness.json` (`720` B, `c414a7310e5052fdd1c2fd7dd8eeceaa20c6c331ce3c924a4b62fba6c74adcf0`), `w3-start.json` (`31,715` B, `c10f393829436a3d25dd3bef38c82f8489e7d0bd46339adf5cae0d7e21f07baf`), `w3-anon.json` (`380` B, `7d9e9b68e61eb61d079529ed847f72a11fa0999af449555e3dff8d0fcb2c2b4f`, `ok: true`), `w3-32vol.json` (`1,550` B, `9752b3b88608dfec3f7aca5149d969dcd72c65f6664e3fd20afa261a0f6119f1`, `ok: true`, `all32VolumeRecordsByteEqual: true`), `pre-w3-bridge-reconciliation.json` (`7,476` B, `0faee1bb60374e52d674e8b6f6a98486fec34d112b4c8b4e36762a26577f814a`; raw helper `full32EqualToPrevW4: false` reflects its 34-total-vs-32 count check where 2 extra volumes are SV-attributed Savoy volumes, while all 32 baseline volume records are 100% byte-equal to `PREV_W4` `544142a1...`). Reconciled in `msg_37daa6076f89` / `msg_c8673725f23c` for idle-VM `bridge` `Id`/`Created` replacement (`7dac5c96...` -> `50ad4452...`) and `host`/`none` `ipam` collector representation change (`[]` -> `null`).
- **Stage B Runtime Execution (`$R/t7-attempt-r8-20261023T1510Z`, Grant `msg_0de90d08153d`, Delivery `delivery_16d648ba703c`, `supervisorPid: 59664`, `15:28:20Z`–`15:43:18Z`) — FAIL (`EXIT_CODE=1`, `RUNNER_RC=1`)**:
  - **Runner Results (`summary.json` `43,856` B `ef37bee6dd69b657873a58f91b68b72570db6c0f9095cbb3bac634764c5a7a2b`)**: Run 1 (`223 s`, `17 PASS, 0 FAIL, 1 SKIP`), Run 2 (`271 s`, `9 PASS, 8 FAIL, 1 SKIP` — causal failure in `A4` `saveAndReturn` `locator.click` timeout after `fullPage: true` `shot(page, 'A4-scorm-activity-form')`, where trace DOM snapshots prove `body.hasstickyfooter` changed from present before capture to absent after capture and through the `15 s` timeout so `#id_submitbutton2` stayed outside the viewport while the exact Moodle sticky-footer script trigger remains inferred, cascading to `A5`, `A6`, `AC-T7-04`, `AC-T7-05`, `AC-T7-06`, `B5`, `B6`), Run 3 (`226 s`, `17 PASS, 0 FAIL, 1 SKIP`), 4 confirm/refusal checks (`PASS`), and `AC-T7-15` demo pass (`demo:prepare` `12.41 s <= 180 s`, `PASS`).
  - **Operational Cleanup `T11–T13` all `0`, Runner FAIL (`RUNNER_RC=1`), `T14` Omitted as Designed**: `OBS_RC=0`, `CAP_RC=0`, `LANE_RC=0` (`lane/summary.json` `3,603` B `52a81db2...` `isolationPass: true, keepVerified: true`; `lane/boundary-start.json` `35,202` B `63c23762...`; `lane/boundary-end.json` `30,597` B `eaf80f77...`), `SAMPLER_RC=0` (`sampler/lane-containers.json` `20,467` B `e1ec82f3...`, `54` samples, `0` skew violations), `W4_CAPTURE_RC=0` (`w4-end.json` `29,582` B `b59aba22...`, `problems: []`), `W4_COMPARE_RC=0` (`w4-compare.json` `6,441` B `e3f9e3c5...`, `problems: []`, `protectedIdenticalAtEnd: true`), `W4_ANON_RC=0` (`w4-anon.json` `371` B `1829cfd4...`, `ok: true`), `W4_RECONCILE_RC=0` (`w4-32vol.json` `1,216` B `726cafee...`, `ok: true`, `all32VolumeRecordsByteEqual: true`), `private/t13-status.json` (`79` B, `5ed5dd3e...`). Host returned cleanly before `15:50Z`.
  - **Private Failure-Closeout Scan & Manifest (`$R/notes/t7-failure-closeout-r8-20261023T1510Z`)**: `t7-failure-scan.json` (`34,697` B, `7160f9d0ab2d97c4dd230cbe595e53f4ffc54e886d581972844fa29acab8de4e`, `verdict: "FAIL"`, `values: 136`, `sharedHits: 1` on `03-compose-config-name.log` for `kind: "env:DB_PASS"` because `tests/e2e/host/run-t7.mjs:111` `addSecretsFromClone()` filters `.env` keys with `/PASSWORD|SECRET|KEY|TOKEN/i` and misses `DB_PASS` when redacting `docker compose config --format json` output), `map-triggers.json` (`19,020` B, `340e4ed5abe658e1a735cb06d339db9c92272d51e667446b2ef2172dd1deddc0`), and `failure-artifact-manifest.json` (`331,255` B, `1403016e680898857633de8be128a537975240a3436d3493784b071f7a95277b`).
- **Bounded Four-File C10 Repair (`msg_b8ba462766d0`, `msg_df199ac75a9d`, `t7-cycle2-diagnosis-and-repair.md`, `c10-run-t7-redaction-decision-v2.md`)**:
  - Updated `tests/e2e/lib/flows.ts` (`5,475` B, mode `0644`, SHA-256 `e8577c878240146d070d7b13a7901f2b56ee189a0d12cfc61861d60084c476a2`), `tests/e2e/2-scenario-b.spec.ts` (`13,719` B, mode `0644`, SHA-256 `ff7cd8c34bbc6f5785bad3dad8c89a4a984b30a711dfaf824e3868d40e50c00a`), `tests/e2e/host/t7-env-secrets.mjs` (`353` B, mode `0644`, SHA-256 `f9b538de16a59da79928dd5ccffea20b8234103acd045aeb5a19730b13bebba4`), and `tests/e2e/host/run-t7.mjs` (`21,769` B, mode `0644`, SHA-256 `a23659dfb8f02e7d3a5dcf8020bff05a877217ea39703fa6043773ac84ab2c03`).
  - Verified `npm --prefix tests run typecheck` (`exit 0`), `18` T7 test titles unchanged, `0` full-page `shot()` calls before sticky-footer clicks, `0` overlap with the M1/M2/legacy `T1–T6` dependency closures, and `redaction-selftest-v2.mjs` (`9,997` B, `6a9dafe78ae0696092a558bf40d765a30f4a3c9ede87bcee5c0e5e3f999e0773`) -> `redaction-selftest-results-v2.json` (`3,052` B, `5f20a4a41382786634d28f058bb09b540df4cb592842cb3bf6664c11b10b3ebd`, Controls A/B/C/D all `PASS`).


---

## 2026-10-23T16:45:00Z Append-Only Record — E-R8 Shared-Host C10 T7 Runtime Verification & Acceptance (`t7-attempt-c10-20261023T1615Z`: PASS, Accepted in `msg_c84789ebb2b4`)

- **Worker & Lifecycle Identity**: Independent QA-E2E (`Antigravity Gemini 4 Argon (High)`, model `gemini-4-argon-high`, effort `high`, no subworkers), retained terminal `term_3fd51366-4ec9-4a5c-994d-be6f04a4bcf1`, task `task_580493b156ed`, dispatch `ctx_27d8caf0ba9f`.
- **Candidate, Wrapper & Review Bindings**:
  - **Source & Tests Identity (`C10`)**: `97b68af439b6565f891042b20497b18aadca6a24` (`tests` tree `ec2d86f590902ee99997d6ed2b78599dc3006072`; product tree outside `docs/**` and `tests/**` byte-identical to `C6` `4008afb92fe983d52db33442e060210b929966c8`; accepted M2 remains at its true execution SHA `C8` `5561e8f72a83de36a68877c6b26ffc8288ade735`; M1 `394` + `94` carried rows and `12/12` legacy groups remain at their accepted identities).
  - **Qualified Wrapper, Manifests & Independent Reviews**: `$R/notes/scripts/run-t7-window-v3-c10.sh` (`27,486` B, mode `0700`, SHA-256 `a9ac8f5632ad67cdd9d0e25da07f61c143589944826e8e6bab68cc5ac1fb8f96`), `$R/notes/t7-c10-finalization/r1/MANIFEST-finalization.sha256` (`42a81af7...`, `12/12` entries), `$R/notes/t7-shared-host-implementation/r2/MANIFEST-candidate-r2.sha256` (`e4f60300...`, `42/42` entries), `$R/notes/scripts/detached-launch.py` (`2,161` B, `0700`, `4a1f1ed3...`), approved by Reviewer A (`msg_ddc375614df4`) and Reviewer B (`msg_18bf2b69720e`).
- **Stage A External Preflight (`$R/notes/t7-external-preflight-c10-20261023T1615Z`, Grant `msg_554a615fa08f` / `delivery_59676b515a29`, LA Hold `msg_7b06bc025fc0` / `msg_0459f8a6f66d` through `16:50:00Z`, Accepted in `msg_903b04fa87ab`) — PASS (All 5 Exits `0`)**:
  - `w1-wake.json` (`1,667` B, `8097a4b7...`), `w2-liveness.json` (`718` B, `a6f45da5...`), `w3-start.json` (`31,717` B, `474e50d9e39b9b7b9dd35f42a72a228390a22df8f49309bb52c91a9a4ba48694`, `problems: []`, `liveness.ok: true`), `w3-anon.json` (`380` B, `c6e2c45a...`, `ok: true`), `w3-32vol.json` (`1,551` B, `e99cec65...`, `ok: true`, `all32VolumeRecordsByteEqual: true`), `pre-w3-bridge-reconciliation.json` (`4,880` B, `8240ff76b4cdb7d031f74d132ed4dcd4e04ee0d781161dece3b4e7c622092244`, confirming `32/32` volume records byte-equal to accepted M2 `PREV_W4` `544142a1...`, identical `dockerInfo` and `settings.normalizedSha256`, idle-VM `bridge` `Id`/`Created` replacement `7dac5c96...` -> `50ad4452...`, and old-collector `host`/`none` `ipam` `[]` -> `null`).
- **Stage B Runtime Execution (`$R/t7-attempt-c10-20261023T1615Z`, Grant `msg_28bc7b21d064` / `delivery_df0be9bf28fa`, `supervisorPid: 30198`, `16:26:20Z`–`16:39:03Z`, Accepted in `msg_c84789ebb2b4`, Host Returned in `msg_d50a68ebaa8b`) — PASS (`EXIT_CODE=0`, `RUNNER_RC=0`)**:
  - **Functional Runner (`summary.json` `39,317` B `f98813044f0e03ad2b171a4424f06fdd93cf6360c69689afcbdc8969bd8887ab`)**: Run 1 (`208.8 s`, `17 PASS, 0 FAIL, 1 SKIP`), Run 2 (`195.0 s`, `17 PASS, 0 FAIL, 1 SKIP`), Run 3 (`199.8 s`, `17 PASS, 0 FAIL, 1 SKIP`), all `4/4` confirmation/refusal checks (`B-T7-01` / `A-T7-04` `PASS`), and `AC-T7-15` demo pass (`demo:prepare` `11.45 s <= 180 s`, player check `PASS`). All `15/15` T7 criteria (`AC-T7-01`..`AC-T7-15`) passed.
  - **Mandatory `A4` / `B4` / `B5` Trace & PNG Judgments**: `0` `'element is outside of the viewport'` logs across all `51` passing tests in `run1`, `run2`, and `run3`; all `12` sticky-footer clicks in `A4`, `B4`, and `B5` succeeded on the first attempt (`149.2 ms`–`322.6 ms`, `0` retries); all `12` form/picker PNGs (`A4-scorm-activity-form.png`, `A4-html-activity-form.png`, `B4-activity-form.png`, `B5-picker-thanh.png` in `run1`–`run3`) verified visually (`"Completion conditions"` expanded with `"Receive a grade"` $\rightarrow$ `"Any grade"` selected and sticky footer visible; full `B5` picker modal). Residual `A-T7C10-01` picker-key `fullPage: true` shots remain `MINOR` deferred with trace proof of zero sticky-footer degradation.
  - **Operational Cleanup, Coexistence Pools (`§§16–17`), Secret Scan & `B-TW-02` Binder**: `w3-start.json` (`29,589` B, `896bdbec...`), `prelaunch-guard.json` (`5,014` B, `ca4640aa...`, `ok: true`), `lane/boundary-start.json` (`28,626` B, `e2f83359...`), `lane/boundary-end.json` (`26,244` B, `621e7129...`), `lane/summary.json` (`1,397` B, `dc64ac3b3003cb92e3aaa1268afe99c79678cb0b3701f720717c77bbf1769ac5`, `isolationPass: true, keepVerified: true, laneEmptyEnd: true`), `w4-end.json` (`27,474` B, `3c6355d7...`, `problems: []`), `w4-compare.json` (`2,939` B, `ed635c9b...`, `problems: []`, `protectedIdenticalAtEnd: true`), `w4-anon.json` (`371` B, `1191a3f0...`, `ok: true`), `w4-32vol.json` (`896` B, `5325a642...`, `ok: true, all32VolumeRecordsByteEqual: true`), `sampler/lane-containers.json` (`18,434` B, `f5f5386a...`, `48` samples, `0` skew violations), `private/t13-status.json` (`79` B, `5ed5dd3e...`), `scan/t7-scan.json` (`38,847` B, `c477f68c343bed971f7f423c432d7f5db11e9d7d3333e4d1f6b207078e6bd844`, `verdict: "PASS", values: 162, sharedHits: 0` including `cmd/03-compose-config-name.log`), `t7/gate.json` (`55` B, `8d6d2a8b...`, `gate: "PASS"`), `t7/run-evidence.json` (`382,147` B, `5a06fda52944b2a0ea13b776ab3e0debcae818cc5f0fc4498060bde3cd69118b`, `897` binder entries), and `$R/notes/t7-runtime-c10-20261023T1615Z/c10-artifact-manifest.json` (`366,538` B, `b0e65ca62251b42798aeb019ab74910dcc9e1dd3f0fd18d88c90e96be471d01b`, `902` entries).

### Updated M3 Criterion Status After C10 T7 Acceptance (`msg_c84789ebb2b4`)

| Criterion | Result | Evidence and limit |
| --- | --- | --- |
| AC-M3-01 | **PASS** (accepted in `msg_1d96a40f0530`) | Split 488-row M1 ledger under `E-R7`: two fresh `sim` rounds at product `C6` (`4008afb9...`) + tests `C9` (`9eb504f5...`) passed `394/394` rows and `7/7` dead-handler preconditions, combined with `94/94` carried non-`sim` rows in both `C4` (`bf09cdad...`) `full2` rounds ([Canvas QA §24](../M1/qa-canvas.md)). |
| AC-M3-02(a) | **PASS** (accepted in `msg_c84789ebb2b4`) | `t7-attempt-c10-20261023T1615Z` at `C10` (`97b68af4...`, product `C6` `4008afb9...`) passed all `15/15` T7 criteria, `3` consecutive `17/17` default runs, `4/4` confirmation/refusal checks, and `AC-T7-15` demo (`11.45 s <= 180 s`) with `run-evidence.json` `5a06fda5...` ([T7 QA](../T7/qa.md)). Prior `t7-attempt-r8-20261023T1510Z` remains preserved as `FAILED`. |
| AC-M3-02(b) | **PASS** (carried `E-R4`) | Common QA's `12/12` legacy groups (`T1`–`T6`) passed at product `C6` (`4008afb9...`) + tests `C7` (`70671e7b...`). |
| AC-M3-03 | **PASS** (accepted in `msg_d04d641ae347`) | M2 Attempt 4 (`qa-e2e-sim-r7-5561e8f7-2026-10-23T04-25-46-176Z` at product `C6` `4008afb9...`, tests `C8` `5561e8f7...`) passed `64/64` cases across all `13` criteria and `7/7` gates ([M2 QA §11](../M2/qa.md)). |
| AC-M3-04 | **PASS** (M1, M2 & T7) | Default profile (`profile: default`, `knobs: []`, `simulation_profiles: []`) verified across M1, M2 Attempt 4, and T7 (`qa-e2e-m3-r3-observation.jsonl` `84f85203...`). |
| AC-M3-05 | **UNVERIFIED** | All **32** real-LMS rows stay **`UNVERIFIED`** ([live matrix](live.md)); Local Canvas stays **`DEFERRED`**. |
| AC-M3-06 | **PASS** (M1, M2 & T7) | Verified across M1, M2 Attempt 4, and T7 (`w4-compare.json` `ed635c9b...`, `w4-32vol.json` `5325a642...`, `lane/summary.json` `dc64ac3b...` with `isolationPass: true`, `keepVerified: true`, `32/32` protected volume records byte-equal, `0` owned resources or processes left; inherited `allContainers` residual false-`FAIL` on foreign coexistence remains `FAIL`, never waived). |
| AC-M3-07 | **PASS** (M1, M2 & T7) | Strict secret scans passed with `0` shared hits across M1 (`80e7a99a...`, `3da1faef...`), M2 (`de83f4b8...`), and T7 (`scan/t7-scan.json` `c477f68c...`, `162` values, `207` text + `550` binary shared files, `0` shared hits including `cmd/03-compose-config-name.log`). |
