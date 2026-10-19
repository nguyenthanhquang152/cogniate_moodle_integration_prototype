Verdict: APPROVE
Round: 1

# T7 review — Reviewer-B (lens: "Can a human team own it?")

Scope:
- The Author's harness: `infra/scripts/{e2e-reset,e2e-wait,demo-prepare,moodle-cron,qa-suite}.sh`, `infra/demo/prepare.mjs`, `infra/moodle/php/{start_lti_registration,activate_lti_tool,add_lti_activity}.php` (commits `8b45d15`, `4a35ee0`).
- QA-E2E's suite: `tests/e2e/**`.

Spec: `tasks/T7.md`, `tasks/README.md` §2. QA evidence: `docs/reviews/T7/qa.md` (PASS: all 15 ACs, three consecutive runs of about 188 s, `retries: 0`, `workers: 1`).

| Severity | Count | Ids |
| --- | --- | --- |
| BLOCKER | 0 | — |
| MAJOR | 0 | — |
| MINOR | 2 | B-T7-01, B-T7-02 |
| NIT | 1 | B-T7-03 |

## Can the product team run it and understand failures?

- **`npm run demo:prepare`:** Yes.
  - The header lists the six steps, and each step prints a numbered line ("1. Thanh: connection "Dev Moodle" …", "3. Moodle admin: activate the tool, Show in activity chooser, New window", …).
  - It checks its preconditions with a fix: "Missing infra/.secrets/seed.json. Run: npm run e2e:reset"; "Missing course zip: <path> (set COURSE_FIXTURES_DIR)".
  - A second run stops with "Thanh already has the connection "Dev Moodle". For a fresh demo run: npm run e2e:reset (then npm run demo:prepare)."
  - It ends with a "Demo ready in N s" block: URLs, users, where the passwords are, the two activity links, and "Next: log in to Moodle as cg_student and open an activity (it opens in a new window)".
  - It copies the zips (untrusted data) into a new folder before upload. `--help` prints the header.
- **`npm run e2e:reset`:** Yes. It has four numbered steps ("== e2e:reset 1/4 stack:reset" …). `e2e-wait.sh` names what is not ready and its last answer ("Not ready: Cogniate app /healthz (default profile, no knobs). Last answer: …"). It also checks the portal page and a real admin login (the password goes through a mode-600 temp file).
- **`npm run test:e2e`:** Mostly. It removes its named container on Ctrl+C, checks again at the end that the stack is clean (AC-T7-13), and prints "test:e2e: artifacts in tests/e2e/artifacts/". Two human points: B-T7-01 and B-T7-02.
- **`npm run moodle:cron`:** A clear fallback. QA did not need it (qa.md AC-T7-05).

## Do the E2E tests prove the claims?

(Completed after the suite sweep below.)

---

## Findings

### B-T7-01 — MINOR — `npm run test:e2e` deletes all stack data without a warning

- **Location:** `infra/scripts/qa-suite.sh` lines 50–57 (`e2e` → `e2e-reset.sh` unless `E2E_RESET=0`); `infra/scripts/e2e-reset.sh` (step 1 `stack:reset`); `tests/e2e/README.md` ("`npm run test:e2e` (it runs `e2e:reset` first)").
- **Problem:** For QA this is right (AC-T7-01: a clean reset each run). But a product person who ran `npm run demo:prepare`, or who uploaded courses by hand, and then runs `npm run test:e2e` "to check that it still works" loses the whole site (Moodle courses, connections, uploads), with no warning and no prompt.
- **Evidence:** No message before the reset says that data will be deleted. The README does not say "deletes".
- **Suggested fix:** When `test:e2e` runs in a terminal (TTY) and the stack has data (`seed.json` exists), print "WARNING: test:e2e first deletes all stack data (Moodle site, courses, connections). Press Enter to go on, or Ctrl+C to stop (E2E_RESET=0 skips the reset)." Skip the prompt without a TTY (QA runner, CI). Write the same WARNING in `tests/e2e/README.md` and `infra/README.md`.

### B-T7-02 — MINOR — The README does not say how to read a failure

- **Location:** `tests/e2e/README.md` "Evidence".
- **Problem:** The README says where the evidence goes, but not what to open first when a run fails. A product person sees a red line in the terminal and a folder full of files.
- **Suggested fix:** Add four lines:
  1. The test name starts with the scenario step (for example "A4 …"), and T7.md says what that step does.
  2. Open the HTML report: `npx playwright show-report tests/e2e/artifacts/report` (or the path that the config uses).
  3. Open the trace of the failed test: `npx playwright show-trace <trace.zip>`.
  4. The service logs for the run are in `infra/.logs/*.jsonl`, and the trace id on any error page links to them.

### B-T7-03 — NIT — (Completed after the suite sweep below.)
