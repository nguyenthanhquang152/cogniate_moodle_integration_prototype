Verdict: APPROVE
Round: 2

# T7 review — Reviewer-B (lens: "Can a human team own it?")

Scope:
- The Author's harness: `infra/scripts/{e2e-reset,e2e-wait,demo-prepare,moodle-cron,qa-suite}.sh`, `infra/demo/prepare.mjs`, `infra/moodle/php/{start_lti_registration,activate_lti_tool,add_lti_activity}.php` (commits `8b45d15`, `4a35ee0`).
- QA-E2E's suite: `tests/e2e/**` at HEAD, plus the uncommitted `teacherHint` change in the working copy (3 files, 14 lines; the version that QA ran with `--replace-e2e`).

Spec: `tasks/T7.md`, `tasks/README.md` §2. QA evidence: `docs/reviews/T7/qa.md` (PASS: all 15 ACs, three consecutive runs of about 188 s, `retries: 0`, `workers: 1`).

| Severity | Count | Ids |
| --- | --- | --- |
| BLOCKER | 0 | — |
| MAJOR | 0 | — |
| MINOR | 3 | B-T7-01, B-T7-02, B-T7-03 |
| NIT | 3 | B-T7-04, B-T7-05, B-T7-06 |

Summary: The product team can run both commands. The output tells them what each step does and what to do next. The suite drives the real portal and the real Moodle UI for every human step. The waits are mostly polls with the AC deadlines. All findings are small. None blocks.

## What I checked

- I read all the harness files, the suite README, `tests/playwright.config.ts` and the main suite paths: A1–A2, A5–A6 (`lib/flows.ts`, `lib/learner.ts`), AC-T7-04/05/06, B5, B6 and `lib/moodle.ts` `followMenuPath`.
- A read-only helper swept all of `tests/e2e/**` for shortcuts, fixed waits, poll deadlines and selectors. I checked each of its points against the code before using it. Two did not hold up:
  - AC-T7-06 ignores the return value of `pollUntil`. But the soft UI checks after it (`toContainText('Sent')`, outcome, score) still fail when the sync never reaches "sent". So a timeout does not pass silently.
  - In B5, an empty picker passes the hard negative check. But the soft check "lists Thanh's two courses" (`2-scenario-b.spec.ts` line 203) then fails the test.
- I read Moodle's CLI exception handler in the running container (read-only `grep`), for B-T7-06.
- I did not run the suite or `demo:prepare`. The Author's stack is read-only for me, and QA has three clean runs.

## Can the product team run it and understand failures?

- **`npm run demo:prepare`:** Yes.
  - The header lists the six steps, and each step prints a numbered line ("1. Thanh: connection "Dev Moodle" (dynamic registration)", "3. Moodle admin: activate the tool, Show in activity chooser, New window", …).
  - It checks its preconditions and gives the fix: "Missing infra/.secrets/seed.json. Run: npm run e2e:reset"; "Missing course zip: <path> (set COURSE_FIXTURES_DIR)"; "Unknown option: … (see --help)".
  - A second run stops with "Thanh already has the connection "Dev Moodle". For a fresh demo run: npm run e2e:reset (then npm run demo:prepare)."
  - The portal and API steps (`prepare.mjs`) fail with a short reason ("upload of <title> -> 413 …", "Connect failed (500): …"). The Moodle PHP steps do not show Moodle's error (B-T7-06).
  - It ends with a "Demo ready in N s" block: URLs, users, where the passwords are, the two activity links, and "Next: log in to Moodle as cg_student and open an activity (it opens in a new window)". QA measured 9.3 s.
  - It copies the zips (untrusted data) into a new empty folder before upload.
- **The PHP helpers** are short (28–62 lines). Each header says what it does, its output and how to run it. `start_lti_registration.php` reads the registration URL from stdin, so the secret ref is not on a command line. Two helpers use Moodle 5.2.4 internals (`registration_helper`, `jwks_helper`, direct `lti_types` writes). The headers say this, and step 6 ("cg_teacher opens both activities") catches a break after a Moodle upgrade.
- **`npm run e2e:reset`:** Yes.
  - It has four numbered steps ("== e2e:reset 1/4 stack:reset" …) and prints the total time.
  - `e2e-wait.sh` names what is not ready and its last answer ("Not ready: Cogniate app /healthz (default profile, no knobs). Last answer: …").
  - It also checks the portal page and a real admin login (the password goes through a mode-600 temp file).
- **`npm run test:e2e`:** Mostly.
  - It removes its named container on Ctrl+C, checks again at the end that the stack is clean (AC-T7-13), and prints "test:e2e: artifacts in tests/e2e/artifacts/".
  - When a step fails, the later steps stop with a clear reason, for example "Needs the SCORM activity from an earlier step (that step failed or did not run)." (`lib/e2e.ts` `need()`).
  - Two human gaps: the run deletes all data without a warning on screen (B-T7-01), and the README does not say how to read a failure (B-T7-02).
- **`npm run moodle:cron`:** A clear fallback. QA did not need it (qa.md AC-T7-05).

## Do the E2E tests prove the claims?

- **Real UI:** Yes. Every step that a person does in T7.md (A1–A6, B1–B6) is Playwright clicks and fields in the portal and in Moodle. The API, oracle and log reads are checks only (`connectionOf`, `publicationOf`, `grade`, `completion`, `ltiModules`, `resultsApi`). C1 (replay) and C2 (log grep) use HTTP and files by design. The few shortcuts are visible:
  - `followMenuPath` opens the fallback URL when a Moodle label is missing, and records the difference. AC-T7-14 asks for exactly this ("QA lists any difference").
  - On the HTML package menu, a decorative layer covers the lesson link, so the suite uses a DOM click. It writes a "DOM click" annotation, and QA reported it as Q-T7-03 for a manual check.
  - Some steps open a page by URL (`ensureEditMode` opens the course page, "Manage tools" when the page is not already open). The steps under test are still clicks.
- **Waits:**
  - Grades poll for 60 s, every 1 s (`flows.ts` line 55). Completion polls for 60 s, and the AC-T7-06 sync polls for 60 s.
  - The latency clock starts after the 11 s dwell (`flows.ts` line 51), which is about when the course completes. So "0 s" for `cg_student2` means that the grade was already in Moodle.
  - There are two fixed waits outside the rule (B-T7-03).
- **Flake risks:**
  - The suite depends on file order, `workers: 1` and `artifacts/state.json`. This is by design and the README says so. `need()` makes the chain failures readable.
  - `retries: 0`. The browser resolves only `*.test` names.
  - Popups wait for `context.waitForEvent('page')` before the click. Frames are found by URL polling.
  - Three runs in a row passed (188/189/186 s).
  - The remaining risks are CSS and text selectors in Moodle and in the portal: `.tool-card`, `.badge`, `.editmode-switch-form input[name="setmode"]`, and the portal tagline in `portal.ts` line 26. A Moodle upgrade can break them. That is normal for this kind of suite.
- **Weak checks:** one (B-T7-04).

## Readability and maintainability

- The harness is good. Short scripts, numbered steps, one job per PHP helper, comments that say "why".
- The suite is large (about 2,500 lines) but has a clear shape. There is one test per scenario step, a test name that starts with the step and the ACs ("B6 AC-T7-09 AC-T7-07 …"), and helpers by area (`moodle`, `portal`, `learner`, `oracle`, `capture`). Soft checks have messages that say what they expect.
- Some long tests and repeated helpers remain (B-T7-05).

---

## Findings

### B-T7-01 — MINOR — `npm run test:e2e` deletes all stack data without a warning on screen

- **Location:** `infra/scripts/qa-suite.sh` lines 50–57 (`e2e` runs `e2e-reset.sh` unless `E2E_RESET=0`); `infra/scripts/e2e-reset.sh` line 15.
- **Problem:** For QA this is right (AC-T7-01 needs a clean reset for each run). But a product person who ran `npm run demo:prepare`, or who uploaded courses by hand, may run `npm run test:e2e` "to check that it still works". They then lose the whole site (Moodle courses, connections, uploads), with no warning before the delete.
- **Evidence:**
  - The docs say it: `infra/README.md` line 55 ("Deletes": "with `test:e2e` also all stack data"), and `tests/e2e/README.md` ("it runs `e2e:reset` first").
  - But at run time the only line before the delete is "== e2e:reset 1/4 stack:reset". The WARNING is only in a script comment (`e2e-reset.sh` line 4). `stack-reset.sh` prints "Stack data deleted." after the delete.
- **Suggested fix:**
  - Minimum: change the step line to "== e2e:reset 1/4 stack:reset (WARNING: deletes all stack data: Moodle site, courses, connections, uploads)".
  - Better: in a terminal (TTY), when `infra/.secrets/seed.json` exists, also print "Press Enter to go on, or Ctrl+C to stop (E2E_RESET=0 skips the reset)". Do not ask without a TTY (QA host runner, CI).

### B-T7-02 — MINOR — The README does not say how to debug a failed step

- **Location:** `tests/e2e/README.md` ("Run", "Evidence").
- **Problem:** The README says how to run the suite and that "Playwright traces and the HTML report" are in `artifacts/`. It does not say which folder holds what, how to open the report, or how to run one step again. A product person sees a red line in the terminal and a folder full of files.
- **Evidence:**
  - The config writes traces and screenshots to `tests/e2e/artifacts/playwright/` and the HTML report to `tests/e2e/artifacts/playwright-report/` (`tests/playwright.config.ts` lines 17 and 27). The README does not name these folders.
  - The README also does not name `QA_GREP` (config line 10), `E2E_RESET=0` (`qa-suite.sh` lines 51–56) or `--keep` (`host/run-t7.mjs` line 41).
- **Suggested fix:** Add a short "When a test fails" section:
  1. The test name starts with the scenario step (for example "B6 …"). T7.md says what that step does. A later step that says "Needs … from an earlier step" is not the cause: find the first failed step.
  2. Open the HTML report: `npx --prefix tests playwright show-report tests/e2e/artifacts/playwright-report`. Each failed test has its error, screenshots and trace.
  3. Service logs: `infra/.logs/*.jsonl`. The trace id on an error page finds the log lines.
  4. Run one step again on the same stack: `E2E_RESET=0 QA_GREP='B6' npm run test:e2e`. It reads `artifacts/state.json` from the last full run (for debugging only).

### B-T7-03 — MINOR — Two fixed waits break the rule in tasks README §2, and one negative UI check can pass with no proof

- **Location:** `tests/e2e/2-scenario-b.spec.ts` line 262; `tests/e2e/lib/flows.ts` line 60.
- **Problem:**
  - The rule is "Poll with the deadlines in the ACs. Fixed waits only for the 11 s dwell and the TTL tests" (`tasks/README.md` §2).
  - In B6, the test waits for the "Refresh from Moodle" button, then `waitForTimeout(1_000)`, then checks that Thanh's results page does **not** contain the library B course. If the table renders after 1 s, the negative check reads a page with no rows and passes. The API check after it (lines 267–268) still proves the claim, so the AC is safe. But the UI check and its screenshot do not prove it.
  - In `learnerRun`, a wrong answer waits a fixed 6 s ("the shell polls the status every 5 s") before it reads the shell text. The text is only noted, not checked, so this is not a flake risk. But it is a second fixed wait, and it costs 6 s for each wrong-answer run.
- **Suggested fix:**
  - B6: before the negative check, wait for a row that must be there (Thanh's `cg_student` row for that publication, with "Passed"). Then the negative check reads a full table. Remove the 1 s wait.
  - `learnerRun`: wait for the expected final shell text with a deadline, as the correct path does with `SHELL_DONE_100`.

### B-T7-04 — NIT — The score check for `cg_student2` matches any "0" in the row

- **Location:** `tests/e2e/1-scenario-a.spec.ts` line 398: `toContainText(new RegExp(`\\b${r.score}\\b`))` with `score: '0'`.
- **Problem:** `\b0\b` also matches the "0" in "0.00", or in a date or count in another column of the same row. The "Failed" outcome check carries the proof today.
- **Suggested fix:** Check the score cell only, as the refresh check does: `cellUnder(row, /score/i)`.

### B-T7-05 — NIT — Long tests and repeated small helpers

- **Location:**
  - `tests/e2e/1-scenario-a.spec.ts` lines 56–184 (the A1–A2 test, 129 lines, with an inline `chooseNew` and a seven-branch step dispatcher).
  - `tests/e2e/2-scenario-b.spec.ts` lines 62–140 (B1–B2, a second dispatcher of the same kind).
  - A regex-escape helper in three copies: `lib/flows.ts` line 68, `1-scenario-a.spec.ts` line 70, and the new `teacherHint` in `lib/e2e.ts`.
  - `esc` in `3-scenario-c.spec.ts` line 15 escapes HTML: same name, different job.
  - `done` is a Set (`1-scenario-a.spec.ts` line 86), the state map `st.done`, and a function (line 351).
- **Problem:** A new person must read about 130 lines to change one Moodle wizard step. The same name means three things.
- **Suggested fix:** When the suite is next changed (not now):
  - Put one `escapeRegExp` in `lib/e2e.ts`.
  - Move the wizard step dispatcher to `lib/moodle.ts` (for example `runWizardStep(step, ctx)`), so that A2 and B2 call it.
  - Rename the local `done` to `handled` and `isDone`.

### B-T7-06 — NIT — `demo:prepare` hides Moodle's error text when a PHP step fails

- **Location:** `infra/scripts/demo-prepare.sh` lines 38, 44, 49 and 56–57 (`mphp … | jsonline`, and `jsonline` is `grep '^{' | tail -1`).
- **Problem:** Moodle 5.2.4 writes CLI fatal errors to stdout (`public/lib/setuplib.php` lines 162, 181 and 196: `echo …fatal_error(...)`). `jsonline` keeps only the JSON line, so it drops the error. When step 2, 3 or 5 fails (for example "course COGNIATE-DEV-101 not found" after a partial seed), the person sees the step line and then the script stops with no reason, or with a Node `JSON.parse` stack trace from `jget`. This is not likely: the preconditions are checked, and a rerun stops with the clear "run e2e:reset" message.
- **Suggested fix:** Keep the PHP output in a variable. When it has no JSON line, print "Step N failed. Moodle said:" and the last 10 lines, then exit 1. Make `step` do the same for an empty answer.

---

## Round 2 (polish 88e7d76)

Verdict: APPROVE. Scope: `git show 88e7d76` (`infra/scripts/{lib,e2e-reset,qa-suite,demo-prepare}.sh`, `infra/README.md`).

What I checked:
- I read the diff.
- I ran `confirm_stack_delete` from `lib.sh` in a pseudo-terminal (`script`) against a temp folder. There was no stack and no delete. I tested the answers `yes`, `no`, `Yes` and an empty answer, and also no terminal, `--yes`, and no data.
- I ran the new `mstep`, `step_failed` and `redact` functions from `demo-prepare.sh` against a fake `mphp` that prints a Moodle-style error with fake secrets (a temp `.env` and `seed.json`).
- I checked that `npx playwright` resolves from the repo root.

| Id | Round 2 status | Evidence |
| --- | --- | --- |
| B-T7-01 | **Resolved** | `confirm_stack_delete` (`lib.sh`) prints a clear three-line WARNING: what goes (Moodle site, portal data, LTI service data, seed users and API keys, `infra/.logs/`) and what stays (`.env`, `infra/.certs/`, `infra/.data/fixtures/`). In a terminal, only `yes` goes on (the probe returned). `no`, `Yes` and an empty answer print "Stopped. Nothing was deleted." and exit 1. In `qa-suite.sh` the question comes before the exit trap and before any container starts, so a "no" does nothing. `-- --yes` and `E2E_CONFIRM=1` skip the question. `--yes` is removed before the suite arguments. With no terminal there is no question, so the QA runners do not hang, and with no data there is no question. The step line now says "1/4 stack:reset (deletes all stack data)". |
| B-T7-02 | **Resolved** | `infra/README.md` "Debug a failed E2E step" has the four folders, "find the FIRST failed step" ("Needs … from an earlier step" is not the cause), `show-report`, `show-trace --port 0`, `grep` of the trace id in `infra/.logs/*.jsonl`, and `E2E_RESET=0 QA_GREP='B6'` for one step. The `test:e2e` row links to it. The WARNING about secrets in traces and in the HTML report is clear: keep them local, share only the error text and screenshots. The root has `@playwright/test` 1.56.0 (the same version as `tests/`), so `npx playwright …` from the repo root works without a download. |
| B-T7-06 | **Resolved** | Steps 2, 3 and 5 go through `mstep`, and the portal steps go through `step`. Both keep the full output. With no JSON line they print "Step N failed. Moodle said:" (or "The portal step said:") and the last 10 lines, without Docker progress lines, then exit 1. In the probe, the Moodle error ("Can not find data record in database table course … COGNIATE-DEV-101") was shown. The `ref=` value, the `.env` password, the seed password and the JWT were shown as `[redacted]` / `[redacted JWT]`. JSON values now go to `node` on stdin, not on a command line. |
| B-T7-03, -04, -05 | Open (MINOR / NIT, QA-owned `tests/e2e/**`, not blocking) | Not in this commit. They can go with the next suite change. |

New in Round 2: nothing at MINOR or above. Two small points, no action needed:
- `npm run test:e2e` now prints the WARNING twice: once with the question in `qa-suite.sh`, and again (with no question) when `e2e-reset.sh` runs with `E2E_CONFIRM=1`. This is harmless. It repeats the warning just before the delete.
- The end line "test:e2e: artifacts in tests/e2e/artifacts/" (`qa-suite.sh` line 40) could add "(when a test fails: infra/README.md, Debug a failed E2E step)", and `tests/e2e/README.md` (QA) could link to that section. Optional.
