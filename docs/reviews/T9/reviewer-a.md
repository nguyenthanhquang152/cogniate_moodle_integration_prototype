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


## Round 3 — replacement continuation, final review (2026-10-19)

**Verdict: APPROVE — complete continuation accuracy and safety scope.**

**Open findings: 0 BLOCKER, 0 MAJOR, 1 accepted MINOR, 0 new NIT.** Two MINOR findings were raised in this continuation: A-T9-C01 is accepted for deferral; A-T9-C02 is resolved. Historical deferrals are separate.

### Identity, exact scope and independence

Independent replacement Reviewer-A: **Codex GPT-6-Astra, xhigh**, under the [continuation authority](../../team/charter.md#continuation-authority-2026-10-19). This is the same worker and review task as Round 2. It is not a cross-model review.

| Scope | Exact revision |
| --- | --- |
| Continuation baseline | `c3f6d13` |
| Previously approved product baseline | `dd6dd1188833653cb92c63cc09e3c438ac3cb7b4` |
| Reviewed repair, migration, tests and harness | `d54c607d7fc6ce2d97e039bb108f52a37f2174ee` |
| Full T5a/T5b/T6 QA reports | `c5683f896330debaea5e9a09f49357dc3e99e92b` |
| Fresh T7/root QA report | `a5633697206831d5a148f872d08e45d803dce4cd`, testing `c5683f8` |
| Final architecture reconciliation | `533141e6903ba13e1b3efd09a0851a52a1d7f867` |
| Final pack source stamp | `6932539d4b44e017dd54acc8dc37c6bb2ba9fed1` |
| Final artifact candidate | **`39c401ae7247547a6a503414ffa699aaea6fb884`** |
| Final T9 QA evidence | **`1a6f92c97489ca8304cacc03e4e1212d8d8ae27d`**, [QA §5](qa.md#5-replacement-qa-e2e-final-verification--2026-10-19) |

Round 2 covers every product, migration and test change since the product baseline, including the fractional-score correction. This round adds every final README, guide, human-pack, video and architecture change through the artifact candidate. I checked follow-up fixes from committed revisions. Product and harness paths are unchanged from `d54c607` through the final candidate. The later QA-evidence commit changes none of those artifacts or product paths.

I did not open Reviewer-B's review files. I submitted my product and final-artifact verdicts before the Lead relayed the counterpart's final result. The final QA report supplies the assigned STE authority; I did not use counterpart findings to derive this accuracy/safety verdict. Only this report was edited. No product edits, commits, pushes, subagents or QA-stack changes were made by this reviewer.

### Fresh evidence reconciled with the claims

| Evidence | Result and practical boundary |
| --- | --- |
| Focused P2/P5, exact repair | Six tests passed, including two setup tests. Higher 90 remained pending after its first accepted response and an actual app restart. Confirmation followed after 5.661 seconds. Moodle remained 90 for the finite 90-second observation. P5 used the disclosed one-row fixture. |
| Full T5a/T5b/T6, exact repair | **49 required ACs and 65 executed tests passed**, with no failures, retries or flakes. The main T5a TTL case was intentionally skipped there and passed in its separate 20-second TTL run. T5b includes teacher override, conflict stop, P11 sent/pending/failed states and P2; T6 includes the whole keyboard wizard and teacher copy. |
| Fresh T7 after repair | All **15 ACs passed in three consecutive runs**, taking 186, 181 and 175 seconds. Each run passed 17 scenarios without retry or flake. Its demo-only skip passed separately. Grade observations took 3.3–3.9 seconds. Four destructive-command refusals preserved stack snapshots. Reset took 43 seconds; demo preparation took 8.64 seconds. T7 is not the P2 late-write race test. |
| T7 secret and resource checks | Each run scanned 45 captured values across nine kinds in service JSON logs, with zero hits. Container stdout is outside that scan, as A-T7-02 records. Teardown left zero own resources; ten baseline containers retained their IDs, start times and running state. |
| Final T9 QA, exact artifacts | All four ACs are PASS under their stated authorities. QA verified the isolated candidate, guide evidence, all 25 decision IDs, offline interactions, generated content, all 26 slide/narration correspondences and cleanup. No new finding was raised. |
| Final root check | Independent QA's isolated `npm run check` passed lint, type checking and **708 tests in 48 files, with zero skipped or failed**. All five real-fixture tests ran. This replaces the earlier 703-pass/five-skip self-check as final evidence. |
| Historical T4b and T8 | P1 connection-feedback evidence remains dated to its final T4b1 run. T8 retains its `8059c31` AC-T8-02 through -10 and two race-check results. There is no new T8 run. The repair changes no native-channel, Build Runner or infra code. |

I read the focused/full host summaries, Playwright results and P2/P5 attachments, plus the fresh T7 summaries, four Playwright reports, scan records, root log and isolation records. For final T9, I read the committed QA appendix and its provenance, document audit, offline, media, root-check and cleanup records. Both committed MP4 hashes match the final QA records.

Local evidence roots, intentionally not tracked:

- `tests/host/artifacts/qa-cont-p2-d54c607d-2026-10-19T10-45-38-252Z/`
- `tests/host/artifacts/qa-cont-t5-d54c607d-2026-10-19T10-52-13-189Z/`
- `tests/e2e/artifacts/runs/qa-e2e-cont-p2-c5683f89-2026-10-19T11-17-07-393Z/`
- `tests/e2e/artifacts/t9/continuation/final-39c401ae/`

The full P2 run records accepted 90 at 11:04:52.856 UTC, still pending at try 2 with no `sentAt`. The app stopped at 11:04:53.397 and restarted at 11:04:54.061. Confirmation succeeded at 11:04:58.479: a **5.623-second gap**, then sent at try 3. The lower 60 stayed superseded; no obsolete retry or repeated confirmation loop appeared during the next 90 seconds.

The full P5 run deleted exactly one higher failed 80 sync. Both final attempts and their version IDs, plus best 80, remained unchanged. The lower failed 60 row kept try 1. Resend returned descriptive `409 SYNC_NOT_RESENDABLE`. This exercises the existing best-final-attempt contract through a fixture-assisted state; it is not pure black-box coverage.

### Independent final-artifact checks

- Read the final committed source and rendered artifacts, rather than drafts. Source `6932539` is an ancestor of the artifact commit. Explainer data and video script match that source after the intentional stamp update.
- `build-md.mjs --check` passed. My scan found **131 local Markdown links with no missing paths or anchors**. Final QA independently reports the same 131 links, 63 checked fragments and no missing guide report IDs.
- The offline explainer passed in a fresh local Chrome context: five tabs, 39 flow steps, all proof filters and all 25 decisions. Proof groups contain 22 QA, zero pending, one author and 16 not-proven rows. Temporary Q4 input survived reload and export, then was cleared. No human decision was submitted. There were zero page errors and HTTP requests. QA additionally exercised all story steps, keyboard navigation and autoplay on the final candidate.
- Scanned 20 final text deliverables for private-key/JWT patterns and 22 distinct local secret values, without printing them. There were no hits. I inspected the visible portal images and video frames for exposed credentials. This is a scoped deliverable check, not a claim about all possible secrets in every runtime log.
- Fully decoded both final videos and inspected all **26 scene frames**, plus full-size limit and decision frames. Text, captions and source stamps are visible. English is **182.4 seconds / 2,211,513 bytes**; Vietnamese is **212.4 seconds / 2,567,661 bytes**. Both are below four minutes and eight million bytes. Their streams are H.264 1280×720 at 5 fps and mono AAC at 44,100 Hz.
- Scene boundaries agree with narration pauses, without cumulative drift. The final slide remains after the audio ends. Final QA independently regenerated the 26 narration clips: both resulting AAC streams exactly match the committed videos. Its regenerated slide comparisons also pass. These technical checks do not supply Vietnamese human voice or wording approval.

### T9 acceptance and architecture reconciliation

| Criterion | Review conclusion |
| --- | --- |
| AC-T9-01 | PASS under the Lead's explicit acceptance of the historical 61-second fresh-clone QA run, permitted by the spec. Images were pulled and npm cache was warm. No unfamiliar human performed it; HR-2 remains open. |
| AC-T9-02 | Guide behavior is linked to QA evidence or explicitly bounded as unverified. Current repair claims use fresh T5/T6 and T7 evidence. Native API/CLI checks are kept distinct from Moodle-page restore, token-form, cloud and runner-hardening gaps. Pending tests are not represented as passing. |
| AC-T9-03 | Markdown and explainer retain the architecture's Not Proven/Not Guaranteed limits and all **25 decisions: Q1–Q18, R1–R5, HR-1 and HR-2**, with recommendations. Q4 contains no invented human acceptance of P2. Q18 remains unsupported. |
| AC-T9-04 | The Lead and final QA appendix record Reviewer-B's explicit PASS for this same artifact candidate. This is the assigned STE authority, not an independent STE measurement by Reviewer-A. |

Architect's final conformance approval reconciles the bounded prototype policy, evidence dates and unchanged T8 scope. It does not approve production deployment or replace human decisions. The earlier Firefox claim is corrected to Chromium-only QA; Firefox and Safari remain unproven. The final Q1 readability edit retains the clean-room, test-only MIT SDK, narrow compatibility and raw-slash 404 boundaries.

### Findings and historical treatment

**A-T9-C01 — MINOR, accepted deferral.** The Lead accepted the Round 2 lookup-only retry exception under the charter's MINOR rule. The contract and deferred list now disclose it. Repeated preparation lookup failures remain at five-second intervals because no score POST increments `tries`; the 24-hour bound remains. The documented increasing retry policy is not silently rewritten as proof of implementation. A future separate preparation-retry counter remains the suggested repair.

**A-T9-C02 — MINOR, resolved.** At `533141e`, `proven.md:24` and `explainer.html:924` used the broad statement “No serious accessibility error.” The standalone explainer also lacked the live 24-hour, T6 viewport/card and accessibility-scope limits already present in Markdown QA notes. I sent this finding promptly to the Lead. Fix `d1a521094c369bfa76dedced781e24042a75d366` narrows the claim to five tested surfaces with no serious or critical axe issue. It adds the missing limits to the explainer. I verified the fix again in `39c401ae`.

Historical A-T9-01 and A-T9-02 are resolved: the trace warning/A-T7-02 scope is retained, and the original spikes are identified as unreviewed reference code. Accepted P7/P10 differences and the other historical deferrals stay visible. Resolved T8 race findings are not listed as current defects. The broad remote-ordering inference in my old fixes report remains superseded by Round 2; it is not restored by this approval.

### Limits retained in the approval

The five-second confirmation gap **does not prevent an arbitrarily late older remote write after confirmation**. `sent` records accepted delivery and required confirmation; it does not guarantee lasting equality with Moodle. The finite 90-second QA observation proves only that observed run. Migration 010 cannot recover unrecorded sends from before the upgrade. The seven-row synthetic upgrade check remains author evidence, not independent upgrade acceptance.

Live operation for the full 24-hour retry window, untested P11 conflict/scoreless states, other browsers, viewports outside the T6 scope, untested card/error states and accessibility beyond the specified checks remain unproven. MoodleCloud, subfolder Moodle, the listed native UI/runner gaps and production readiness remain outside the demonstrated scope. All human decisions remain open where stated, including Q4, Vietnamese approval HR-1 and unfamiliar-human follow-up HR-2.

**Final counts: 0 open BLOCKER, 0 open MAJOR, 1 accepted MINOR, 1 resolved MINOR, 0 new NIT. APPROVE.** Both review phases and the required fresh evidence are complete. No further review work is pending in this dispatch.
