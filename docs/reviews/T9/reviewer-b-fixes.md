Verdict: APPROVE
Round: 1

# Fix review — Reviewer-B (lens: maintainability, operability, what the user sees)

Scope:
- Author-2 (Codex continuation fork):
  - `655ab78` C-T8-01 (`.mbz` build reservation);
  - `804a139` P2/P5 (superseded score guard, REAL division);
  - `ab0119b` P11 (player status texts);
  - `5b10196` P1 (register `complete` waits 15 s, `MOODLE_TOOL_MAY_EXIST` mapping, `OutboundRequest.timeoutMs`).
- Author, `8059c31`: C-T8-02 atomic runner lock, C-T8-03 lang rule and failed status, A-T7-04 fail closed without a terminal, A1 pid reuse, A2 doctor memory, A3 queue entries and no-follow copy, A4 `LOG_LEVEL`, A6/A7, D2/D3/D8 infra README, Q-T9-02 fixtures message.

Specs: `docs/reviews/T9/architect-conformance.md` §2 (P1, P2, P5, P11) and the A/D rows; app contract §6 (register failure pages, P11 status texts), §10, §11 and the log table; security §2.6, §9, §10a; ADR-010 rules 4 and 5; T8 qa.md C-T8-01/02.

| Severity | Count | Ids |
| --- | --- | --- |
| BLOCKER | 0 | — |
| MAJOR | 0 | — |
| MINOR | 2 | B-FIX-01, B-FIX-02 |
| NIT | 1 | B-FIX-03 |

Summary: All the fixes do what the findings asked, with clear comments and focused tests. Two small gaps remain. A superseded send leaves no line in the app log. The connect page gives no feedback during the new 15 s wait, and a second click shows a false "failed" page.

## What I checked

- I read every diff and the spec rows.
- `npm run check` on the branch: exit 0, 48 test files, 679 tests passed.
- P11: I ran `playStatusText` (`packages/tracking/src/status-text.ts`) on edge cases: an attempt with no score, 1/3 against 2/6, and 0.7/1 against 70/100.
- P1: I read the LTI service's registration session states (`store/registrations.ts`: `open` → `completing` → `completed`) to see what a second click does.
- A-T7-04: I checked every tracked caller of `test:e2e` and `e2e:reset` with `git grep`. `tests/e2e/host/run-t7.mjs` passes `-- --yes` on lines 235, 260 and 262, and removes `E2E_CONFIRM` from its base environment. No other runner calls the reset.
- C-T8-03, D3: the queue `lang` regex is the app's rule exactly (`courses.ts` line 21). The README knob ranges match `knobs.ts`.

## Per fix

| Fix | Result | Notes (lens B) |
| --- | --- | --- |
| C-T8-01 (`655ab78`) | Good | The re-check and `createBuild` run with no `await` between them, and a comment says why. If the queue write fails, the reservation is marked `failed` with "The build request could not be written. Build again." So the person can try again at once. The `refresh` early return keeps an old status from timing out a newer build. Four focused tests cover the two QA races, a stale retry and a failed write, and they use the test clock with no sleeps. |
| P2 (`804a139`) | Good, one gap | `AND status = 'pending'` is the smallest correct guard (ADR-010 rule 5), and `recordSend` now returns whether it wrote. The test holds the send in flight with two promises, which is deterministic, and proves that the row stays `superseded`, is never retried, and that only 80 reaches Moodle. Gap: the log line is dropped (B-FIX-01). |
| P5 (`804a139`) | Good | `CAST(score_given AS REAL)`. The test sets up two attempts (60, 80) with no higher sync row, and its comment explains why the version order matters. |
| P11 (`ab0119b`) | Good | The three new texts match contract §6 word for word ("Completed — score 60. Moodle keeps your best score: 80"; "… Sending your best score, 80, to Moodle"; "… Your best score, 80, was not sent to Moodle"). `conflict` and the equal-score texts are unchanged. The texts are short and clear for learners, and the best score always has a label. The format follows the existing rule (a whole number, or `n/max`), and the comparison uses fractions (40/50 = 80/100). The status API returns the row's score, and the launch test covers the `null` shape. One defensive edge: B-FIX-03. |
| P1 (`5b10196`) | Good, one gap | `timeoutMs` is a per-request override, and the test proves that the next request uses the default again. `completeRegistration` uses 15 s, with a comment that gives the reason. The mapping is narrow: only a failed `complete` with no platform id (`tool_may_exist`, `LTI_SERVICE_UNREACHABLE`, 504 `PLATFORM_TIMEOUT`) gives `MOODLE_TOOL_MAY_EXIST`. `NO_API_KEY` and a failure after `complete` give `REGISTRATION_FAILED`. Orphan cleanup now runs before the rethrow. The table tests make each case easy to read. Gap: the waiting page (B-FIX-02). |
| C-T8-02 (`8059c31`) | Good | `ln` of a file that already holds the pid is atomic. A stale lock is taken over only under a `mkdir` mutex, and the holder is checked again under it. A runner that loses the race gets the same clear message: "Another Build Runner is running (pid N). Stop it first: npm run stack:down." A take-over is logged as `runner_lock_taken_over`. |
| C-T8-03 | Good | A rejected request now gets a `failed` status at once, with a plain reason: "The build request was not valid (lang). Build again or ask support." Only the field name is shown, never the request content. There is no 10-minute wait. The idnumber length check has a comment with its sum (≤ 99). |
| A-T7-04 | Good | Without a terminal and without the flag, the run now stops: "No terminal to ask. Run it with -- --yes, or E2E_CONFIRM=1. Nothing was deleted." Nothing hangs, and nothing is deleted by accident. The QA runner passes `--yes`, and the run guide NOTE already says "In a script, use `npm run test:e2e -- --yes`". This replaces the "no terminal: going on" behaviour that I accepted in T7 Round 2, and it is safer. |
| A1 | Good | `build_runner_running` now checks that the pid is `build-runner.sh` (the same rule as the lock), so `stack:down` cannot signal another program after a reboot. |
| A2 | Good | The doctor compares bytes against 5.5 GiB (5,905,580,032), and the comment says why. It shows one decimal ("5.9 GB"). |
| A3 | Good | A request entry that is not a regular file is logged (`request_rejected`, "request is not a regular file") and removed. `rm -rf` does not follow links. `queue.mjs stage` copies with `O_NOFOLLOW` / `O_EXCL`, checks the sha256 of the copy, and fails with a short reason ("the package zip is a symlink", "… does not have the expected sha256"), which `build_one` shows. |
| A4, A6, A7 | Good | `LOG_LEVEL` is no longer offered in `.env.example`. `logger.ts` still reads it from the process environment, and its doc comment says so. The unused T1 helpers are gone, and `check` passes. The knob text says "AC-T4-09 uses 20". |
| D2, D3, D8 | Good | Allowlist with `moodle.test` and the reason. Knob rows for `PICKER_TTL_SECONDS`, `PLAY_TTL_SECONDS` and the two Build Runner knobs, with the AC that uses each. The string-knob rule. The design link now points to files that exist. |
| Q-T9-02 | Good | `fixtures:check` and the doctor now say "Make the folder: mkdir -p "docs/raw/data/courses". Copy the two course zips into it". The path is relative to the repo, which is right for a new person. |
| `demo-prepare.sh` redact | Good | It now also removes the LTI API key files and PEM private keys from a failed step's output. |

---

## Findings

### B-FIX-01 — MINOR — A send that ends after its row was superseded leaves no line in the app log

- **Location:** `services/cogniate-app/src/worker/score-sync.ts` lines 70–72 (`if (recordSend(...)) log.info('score_sync', …)`); `services/cogniate-app/src/runtime-path.test.ts` "P2: …" (`expect(t.logs.filter(… 'score_sync' … lowId)).toEqual([])`).
- **Problem:** When the guard keeps a superseded row, the worker writes nothing. But the send did happen:
  - The LTI service logs the score POST with the worker's trace id. If Moodle answered 204, Moodle showed the lower score until the better row was sent.
  - In the app, the row stays `superseded` with the old `tries`, as if it was never sent, and the app has no line for that trace id.
  - An operator who asks "why did Moodle show 60 for a few seconds?" or "what is this score POST?" cannot explain it from the app log.
  - The test now asserts the silence, so the next developer will keep it.
- **Suggested fix:** When `recordSend` returns `false`, log one info line, for example `score_sync` with `status: 'superseded'` and `send_result: result.status`, plus `tries` (or a new event `score_sync_superseded` with `sync_id`, `send_result`). Add it to the app contract log table (Architect). Change the test to expect exactly that one line.

### B-FIX-02 — MINOR — The connect page shows nothing during the 15 s wait, and a second click shows a false "failed" page

- **Location:** `services/cogniate-app/src/tool-pages/register.ts`: the confirm page (`<button type="submit">Connect</button>`, no script) and `POST /tool/register`. LTI service `store/registrations.ts` lines 62–64 (`claimRegistrationSession`: `open` → `completing`) and `http/routes/registration.ts` line 188 (`REGISTRATION_ALREADY_COMPLETED`).
- **Problem:** With P1, when Moodle is slow, the Moodle admin can wait up to 15 s after "Connect" with no sign that anything is happening. Before P1 the wait was about 5 s. If they click "Connect" again:
  - the second POST finds the session in `completing`;
  - it gets 409 `REGISTRATION_ALREADY_COMPLETED`;
  - the app maps this to `REGISTRATION_FAILED`, and the browser shows that answer: "The connection failed. Go back to Moodle and try again."
  - Meanwhile the first call can still succeed. The connection becomes `registered`, and Moodle has a Pending tool, but the frame does not close.

  The admin is told that it failed when it worked, and "try again" then fails because the `ref` is used. The problem existed before P1, but P1 makes the window about three times longer.
- **Suggested fix:** The page already gets a CSP nonce (`toolPageHeaders('register-form', { site, nonce })`, line 40). Add a small nonce script. On submit it disables the button and shows "Connecting to Moodle. This can take up to 15 seconds. Do not close this window." Add the text to app contract §6 (Architect).

### B-FIX-03 — NIT — The P11 text breaks when an attempt has no score

- **Location:** `packages/tracking/src/status-text.ts` (`different` is true when `s.scoreGiven === null`).
- **Problem:** For a final attempt with no score and a sync row, the text is "Completed — score . Moodle keeps your best score: 100" (my probe). This cannot happen today: `outcome.ts` line 46 gives every final outcome a score (100/100, or 0/100 for failed). It is a trap for a later change.
- **Suggested fix:** When `score === ''`, use "Completed. Moodle keeps your best score: 100" (and the same for the other two cases), or treat a missing score as "not different". Add one test row.

## Notes (no finding)

- `npm run check` passes (679 tests). I did not run the stack or the T8 runner. QA owns the regression (T8 races, P1/P2 with `docker compose pause`).
- The doctor shows GiB values with the label "GB". This is acceptable for the readers.
