Verdict: HOLD at candidate `82e2dab` — the Common full M1 run stopped in round 1 (common host collector); Canvas M1 round 1 233/233 rows PASS (partial); M2 and T7 NOT RUN (no window); live UNVERIFIED; local Canvas DEFERRED (see §10)
Round: 7 (2026-10-21). Round 6 verdict: "HOLD at storage candidates `a784522` (failed attempt) and `55c33a3` — M2 and T7 NOT RUN (no window); Canvas M1 round 1 233/233 rows PASS at `55c33a3` but rounds incomplete; live UNVERIFIED; local Canvas DEFERRED". Round 5 verdict: "at `aff4882`: M2 64/64 functional PASS (SIM); T7 3/3 default runs + demo + confirm PASS; observer-log incident contained; M1 held by Core QA; live UNVERIFIED"
Owner: round 7 by a new Claude QA-E2E session (`claude-opus-5-5`, xhigh; Orca session `95d4c010-ef6d-4f58-87fe-7a686ec36424`), which did not run rounds 1–6; round 6 by another new Claude QA-E2E session (`claude-opus-5-5`, xhigh; Orca session `228bb341-1217-4df5-bc56-664d1f41faa3`), which did not run rounds 1–5; round 5 by the original Claude Canvas QA, resumed by owner request; rounds 1–2 by the independent Codex replacement
Task: `task_e28388df4dcc`; dispatch: `ctx_33862fcfa6d1` (round 6: `ctx_f3f20494787a`; round 5: `ctx_4a94125660be`; rounds 1–2: `ctx_8ec51c3aa7b5`)

# M3 QA-E2E verification checkpoint

Sections 1–4 retain round 1. Sections 5–7 retain rounds 2–4. Section 8 retains round 5. Section 9 retains round 6. Section 10 is the current round 7 result.

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
