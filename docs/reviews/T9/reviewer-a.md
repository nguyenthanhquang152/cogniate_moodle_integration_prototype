Verdict: APPROVE
Round: 1

# T9 review: Reviewer-A (accuracy and safety)

Scope: the docs pack at `2129b69`:
- `README.md`;
- `docs/guides/**` (run the stack, Moodle admin, teacher, learner view, troubleshooting, native channel);
- `docs/human_review/**` (START-HERE, proven, decisions-needed, deferred, flows, PLAN, `explainer.html`, `video/script.json`, `video/slides.html`).

Spec: `docs/architecture/tasks/T9.md`.

Lens: every "works" or "proven" claim must trace to a QA AC or a review file at a real SHA, and no claim may say more than QA showed. The pack must hold no secrets, the legal and clean-room notes must be correct, and the commands must match the scripts.

Method (all read-only, from `git archive 2129b69` into temporary folders that were deleted afterwards):
- I extracted every AC id cited in the pack (ranges expanded) and matched each one to the AC rows of `docs/reviews/*/qa.md` at the same SHA.
- I read `proven.md`, `START-HERE.md`, `run-the-stack.md`, the legal parts of `decisions-needed.md` and `explainer.html`, and the Reviewer-A rows of `deferred.md`.
- I compared every `npm run …` command with `package.json`.
- I searched the whole pack for the 13 real secret values of this checkout (`.env` `*PASS|SECRET|KEY|TOKEN*`, `infra/.secrets/lti-api-key.*`, `seed.json` passwords and tokens). The values were compared, never printed. I also looked for JWT, PEM and `password=` patterns.
- I checked the explainer and slides for external loads.
- I did not read `reviewer-b.md`.

## Results (no finding)

- **Claims trace to QA.**
  - The pack cites **121** AC ids. Every one maps to a `qa.md` row with **PASS**, except:
    - AC-T8-02 to AC-T8-10: always marked **pending** ("Builder evidence only. QA … is pending" in `proven.md`, and `"status": "pending"` in the explainer data);
    - AC-T9-01 and AC-T9-03: this task's own checks, marked as not done (the run guide lists the 10-minute test as not done).
  - AC-T2-17 is inside a cited range only. Its `qa.md` row is `n/a`, merged into AC-T2-29 (PASS).
  - T4a's `qa.md` header still says `FAIL` (round 1), but its Round 3 section says PASS, and the board agrees. That is a header for QA to fix, not a pack error.
- **Nothing claims more than QA showed.**
  - The numbers match the T7 `qa.md`: 188, 189 and 186 s; grade latency 3.4–3.9 s; launches under 0.2 s; `e2e:reset` 36 s and `demo:prepare` 9.3 s; 0 of 28 captured secrets in the logs; 15/15 checks over three runs.
  - T3c is shown as proven (AC-T3-27, -09, -20; QA PASS `8fdfa9e` on the board).
  - The portal texts changed after the QA run (Q-T7-01, Q-T7-02) are listed as "QA pending".
  - The run guide tags every step that QA did not run as **[Not verified by QA]**: `stack:doctor`, `demo:users`, `demo:browser`, `stack:down`, the default port 443, and the new `yes` question.
  - The "Not proven" list covers README §6 (MoodleCloud Q5, Safari Deep Linking Q16, the player in Firefox and Safari, video playback, a real person, load and scale) and adds the human 10-minute test and the `.mbz` restore through the UI.
- **No secrets.**
  - None of the 13 real secret values appears in the pack. There is no JWT, PEM block or literal password.
  - The guides name the `.env` variables (for example `MOODLE_STUDENT_PASSWORD`) and say "Do not copy the passwords into git, chat or tickets".
  - The explainer and the slides load nothing external (no external `src`, `href`, `@import`, `url()` or `fetch`). The video narration comes from `script.json`, which was part of the scan.
- **Legal and clean-room notes are correct** (ADR-001, ADR-003, decision Q1):
  - The service is "a clean-room implementation of the 1EdTech specifications" with "an API in the same shape as the public LTIAAS API".
  - `rea` was evaluated and not used, because LTIAAS is hosted and its terms forbid reverse engineering.
  - The MIT `ltiaas` 0.0.4 SDK is a test-only client and is not shipped.
  - "LTIAAS-compatible" is for internal use until Q1 is decided. "LTIAAS" must not be used in product names, and the LTI® mark needs a check.
- **Commands match the scripts.** All 18 `npm run` commands in the pack exist in `package.json` at `2129b69`. The data-loss warnings in the run guide match what `e2e:reset` deletes and keeps (`.env`, certificates and fixtures are kept). The script flags (`-- --yes`, `E2E_CONFIRM=1`) match `qa-suite.sh` and `e2e-reset.sh`.
- **No risky advice.** No `sudo`, `rm -rf`, `prune`, TLS bypass (`-k`, `NODE_TLS_REJECT_UNAUTHORIZED`), `chmod 777` or `/etc/hosts` edit is recommended.

## Findings

### A-T9-01: NIT: `deferred.md` misses A-T7-02, and `troubleshooting.md` has no pointer to the trace warning

- Location: `docs/human_review/deferred.md` (no A-T7 row); `docs/guides/troubleshooting.md`.
- Problem:
  - The C2 scope limit (A-T7-02, still open) is not in the deferred list. (A-T7-03 is resolved, so it does not belong there.)
  - The trace warning exists: `infra/README.md` line 331, in the section "Debug a failed E2E step", which the run guide's Procedure 6 links to. But `troubleshooting.md` links only to `infra/README.md#troubleshooting`, so a reader who starts from troubleshooting does not reach the warning that traces and the HTML report hold raw passwords, cookies, `id_token`s and ltiks.
- Fix: add A-T7-02 to `deferred.md`. In `troubleshooting.md`, add one line for a failed E2E step: a link to "Debug a failed E2E step", with "Do not share `tests/e2e/artifacts/` (traces, report). Send the trace id and the log lines."

### A-T9-02: NIT: "Each finished task passed QA and two independent reviews" is a little too broad

- Location: `docs/human_review/START-HERE.md` ("A team of agents") and the same text in `explainer.html`.
- Problem: the board lists **T5-spike** as "Unreviewed" (reference code in `apps/player-spike/`, with no QA and no reviews). The sentence names only the T8 exception.
- Fix: "(T5-spike: reference code, not reviewed or QA-tested; T8: QA pending)".

## Counts

0 BLOCKER, 0 MAJOR, 0 MINOR, 2 NIT (A-T9-01, -02). Not committed (Lead's instruction).


## Round 2 — replacement continuation, phase 1 (2026-10-19)

**Scoped verdict: APPROVE — committed product, migration, tests and policy.**
**Final T9 pack verdict: pending phase 2.** This section does not close the T5, T7 or T9 gates.

### Identity and scope

- Independent replacement Reviewer-A, assigned Codex GPT-6-Astra at xhigh effort under the charter's continuation authority.
- This is a replacement-model review. It is not a new cross-model review.
- Reviewed candidate: `d54c607d7fc6ce2d97e039bb108f52a37f2174ee`.
- Continuation baseline: `c3f6d13`. Product baseline: `dd6dd1188833653cb92c63cc09e3c438ac3cb7b4`.
- Read committed files with `git show` and `git diff`. Other workers' uncommitted drafts were excluded.
- Read my historical T9 review and fixes report. I did not read Reviewer-B's review files or findings.
- No product, test or architecture file changed. No commit, push, subagent or stack action was performed.

The product delta contains exactly four files: migration `010_score_delivery_confirmation.sql`, `domain/score-syncs.ts`, `worker/score-sync.ts`, and `runtime-path.test.ts`, all under `services/cogniate-app/src/`. I reviewed every change in these files. I also traced their callers and the existing transaction, migration, LTI-client, line-item and grade-policy code.

The QA delta includes T4b1/T4b2/T5b/T6 acceptance tests, the host-control channel, the P5 fixture, and the T4b/T5 runners. I reviewed those changes against the committed task specs. I checked the architecture changes since `c3f6d13`, including ADR-009, ADR-010, the app contract, data model and T5b/T6 specs.

### Correctness and safety results

| Area | Review result |
| --- | --- |
| Durable uncertainty | `beginSend` stores a marker and increments `tries` before calling the score client. Startup recovery marks unresolved sends uncertain. `recordSend` retains earlier uncertainty after an ordinary successful retry. |
| Higher-result confirmation | The requirement is derived from uncertain lower rows of the same learner and internal resource link. It therefore survives restart and a still higher result, including another course version. The first accepted higher send stays `pending`, with no `sentAt`. |
| Confirmation timing | The first accepted higher response stores a due time at least five seconds later. A successful confirmation permits `sent` and clears the covered uncertainty. Successful confirmation does not create an endless send loop. |
| Concurrency | The production app has one process, one synchronous SQLite connection and one worker drain. Current-best checks run before processing a row and after awaited line-item lookup. The guarded update rejects a superseded row. Result updates run in `BEGIN IMMEDIATE`; a late response cannot revive a superseded row or consume the higher row's requirement. This does not establish multi-process worker support. |
| Score comparisons | The corrected final-attempt comparison casts the INTEGER score to REAL. Score-sync columns already have REAL affinity. The new unit cases cover higher final attempts without sync rows during ordinary sends and confirmation. |
| Retry window and conflicts | Confirmation retains the original retry start. A new manual Resend resets its window. Expired rows fail, and a first success without time for confirmation fails. A confirmation 409 remains `conflict` without an automatic retry. See A-T9-C01 for the lookup-only backoff exception. |
| Teacher override | The repair does not compare gradebook reads to trigger extra sends. Existing Moodle override handling remains intact. The author tests model an override during the P2 sequence; fresh independent override evidence is still required. |
| Logging | Normal score-client calls log the persisted status, try count and phase. A superseded response includes `send_result`; the first accepted higher response logs `pending` with `send_result: sent`. Waiting adds no try or score event. Crash-before-log and failures inside client preparation are not proof of one remote write per event. |
| Migration | Migration 010 adds nullable markers and a false uncertainty default without changing previous migrations or historical statuses. Existing unresolved remote work from before the upgrade cannot be reconstructed. Recovery applies to markers written after the upgrade. |
| P5 fixture | It requires a verified fresh QA clone and its own `qa-*` project. It stops only that app, deletes one exact failed sync id, asserts one deletion, and restarts with a health wait in `finally`. Public assertions retain both attempts and best 80, retain the otherwise eligible failed 60 row, then require Resend 409. This tests the existing best-final-attempt rule, with a disclosed fixture exception. |
| Test isolation | Changed host actions use the runner's clone and explicit QA compose environment. The shared runner verifies project labels; teardown selects its own project's resources. I found no new cross-project cleanup command. |
| Harness corrections | The T4 initial outcome allows the already specified first runtime commit. The XSS activity name follows the existing task spec while retaining the malicious manifest test. T6 uses the accepted Moodle teacher path and an awaited focus assertion. These changes are not themselves passing QA evidence. |

### Evidence boundaries

The coordinator reported root self-check: **703 passed, five fixture-dependent skips**, and runtime tests: **52/52 passed**. I reviewed the author tests but did not run independent acceptance QA. The coordinator also reported a synthetic seven-row schema-upgrade check in ignored local artifacts. That is author evidence, not independent migration QA.

The committed failed QA round at `a5d9ddc` remains valid history: P2 left Moodle at 60 while the app said 90 sent; P5 did not reach Resend because the higher sync remained visible. The withdrawn `1ce57f2` run produced no acceptance result. Neither run is a PASS for this repair. At this phase-one verdict, fresh focused P2/P5, full T5a/T5b/T6, fresh T7, final architecture reconciliation and the final docs/videos are pending.

**Remote-write limit:** an older timed-out Moodle request may write after the accepted confirmation. The five-second gap is a bounded mitigation. `sent` records accepted delivery and any required confirmation; it does not guarantee lasting equality with Moodle. The final human pack must retain this limit and the migration boundary above.

My historical fixes report said that a grade could not go down because the worker sends serially. The live failure disproved that remote-ordering inference. Its local terminal-state finding remains valid, but that broad statement must not be used as current evidence. This round supersedes that inference without deleting the historical record.

### A-T9-C01 — MINOR: repeated line-item lookup failures stay on the first retry step

- Location at `d54c607`: `services/cogniate-app/src/worker/score-sync.ts:56`, `:80` and `:81`; `worker/line-item.ts:17`.
- Problem: when a launch has no line-item id and lookup repeatedly fails, no score POST starts, so `tries` stays zero. Each failure calls `syncResult` with try 1 and schedules another attempt in five seconds.
- Evidence: source tracing plus an in-memory evaluation of the committed `packages/tracking/src/outcome.ts` function. Seven consecutive lookup-failure inputs with zero POST tries each returned `pending` and a 5,000 ms delay. No files or stack state changed for this check.
- Impact: the documented 5 s, 30 s, 2 min, 10 min, 30 min, then hourly backoff does not apply on this path. The 24-hour bound remains. This increases lookup traffic during an outage; it does not demonstrate a wrong grade.
- Suggested fix: preserve POST-only `tries` and add separate retry accounting for failed preparation. Alternatively, the Lead may accept this narrow prototype exception and record it in the contract and deferred list.
- Disposition at submission: sent to the Lead; owner assessment pending. Safe to defer under the charter's MINOR rule.

### Phase-one counts and remaining work

**0 BLOCKER, 0 MAJOR, 1 MINOR, 0 new NIT.** Historical accepted deferrals remain separate from these new counts.

The code/harness verdict is APPROVE with A-T9-C01 recorded. The final T9 verdict remains pending. I will review the final committed README, guides, human pack, EN/VI videos, fresh QA/T7 reports, architecture reconciliation and any follow-up changes in this same task and instance.
