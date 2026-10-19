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
