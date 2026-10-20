Verdict: PASS
Round: 1

# T7 QA-E2E verification

Scope of this round: three consecutive official runs of `npm run test:e2e` and the demo pass, all at the same SHA with the same suite. All 15 T7 acceptance criteria pass. Run 1 is described in sections 1–4; runs 2 and 3 and the demo pass (AC-T7-11, AC-T7-15) are in section 5.

| Item | Value |
| --- | --- |
| SHA | `1639c7ee06d741408b234618255714f877d835c7` (T6 round 2 with the wizard step `edit-tool-settings`, T3c round 3, T8 backend, T5b done; QA-E2E suite `0b6a1e6`) |
| Spec | `tasks/T7.md` (Scenarios A, B, C; AC-T7-01 to -15), `tasks/README.md` §2, `tasks/T6.md` (`moodle-steps.json`), app contract §4.1, §5 |
| Suite | `tests/e2e/**` of the working copy (`--replace-e2e`): the SHA suite plus 3 QA-side fixes (`lib/moodle.ts`: the chooser option can open the form at once; `lib/learner.ts`, `lib/flows.ts`: DOM-click fallback, see Q-T7-03). Diff: `runs/…/tests-e2e-diff-vs-sha.txt`. The Lead can commit `tests/e2e/**`. |
| Runner | `COMPOSE_PROJECT_NAME=qa-e2e-r1 PUBLIC_PORT=8543 STACK_SUBNET=172.31.0.0/16 COURSE_FIXTURES_DIR=<repo>/docs/raw/data/courses node tests/e2e/host/run-t7.mjs --sha 1639c7e… --runs 1 --replace-e2e` |
| What the runner does | Fresh clone in `~/cogniate-qa-runs/qa-e2e-r1-1639c7ee-2026-10-19T02-31-21-517Z`, course zips (SHA-256 checked), `npm ci`, `gen-env`, compose name guard, then `npm run test:e2e` (= `e2e:reset`, the suite in the `e2e` container, the end check of `qa-suite.sh`), then `stack:down` and removal of the project's containers, volumes and networks. |
| Isolation | Own project `qa-e2e-r1`, port 8543, subnet 172.31.0.0/16. QA-E2E did not touch `qa-t*` or `cogniate-*` projects. After the run: 0 containers, 0 volumes, 0 networks of `qa-e2e-r1`. |
| Images | `erseco/alpine-moodle:v5.2.4` (`sha256:3a310197e51f…`), `node:24.22.0-alpine3.24` (`sha256:44fce696f38b…`, lti-service and cogniate-app), `postgres:16-alpine` (`sha256:721873c34ceb…`), `caddy:2.11.7-alpine` (`sha256:d8542f48d34a…`); e2e image from `mcr.microsoft.com/playwright:v1.56.0-noble`. |
| Browser | Chromium (Playwright 1.56.0), `retries: 0`, `workers: 1`. Hosts outside `*.test` are blocked (route and host-resolver rule). `QA_IGNORE_HTTPS_ERRORS` was not used. |
| Evidence root | Run 1: `E` = `tests/e2e/artifacts/runs/qa-e2e-r1-1639c7ee-2026-10-19T02-31-21-517Z/` (git-ignored). Runs 2, 3 and the demo pass: `F` = `tests/e2e/artifacts/runs/qa-e2e-r1-1639c7ee-2026-10-19T02-37-10-943Z/` (folders `run1` = run 2, `run2` = run 3, `demo`). Screenshots and JSON: `E/run1/evidence/`. Traces and HTML report: `E/run1/playwright/`, `E/run1/playwright-report/`. Service logs: `E/run1/service-logs/`. Commands: `E/cmd/`. |

## 1. Run 1 results per acceptance criterion

| AC | Result | What QA saw | Evidence (`E/run1/evidence/`) |
| --- | --- | --- | --- |
| AC-T7-01 | PASS | One command, `npm run test:e2e`, ran Scenarios A, B, C from a clean reset. Exit 0 in 188 s, of which `e2e:reset` took 41 s (limit 25 min). 17 tests passed, 0 failed; 1 skipped (the AC-T7-15 player check, which runs only in the demo pass). | `E/cmd/06-test-e2e-run1.log`, `E/run1/tests.json` |
| AC-T7-02 | PASS | Moodle shows "Cogniate (Thanh's Library)" with the badge "Active", "Tool configuration usage" = "Show in activity chooser and as a preconfigured tool", "Default launch container" = "New window". The connection is `registered` after A2 (portal: "Registered — activate in Moodle") and `connected` after A4 (portal badge "Connected"). | `A2-tool-A-manage-tools.png`, `A2-tool-A-settings.png`, `A2-tool-settings.json`, `A2-portal-registered.png`, `A4-integrations-connected.png` |
| AC-T7-03 | PASS | Both pickers listed exactly "AI Website Sprint — SCORM" and "AI Website Sprint — HTML". Both activities exist in `COGNIATE-DEV-101`; each grade item has maximum 100. Both publications show "Selected in Moodle 1" (and `stats.activities` 1). | `A4-scorm-picker.png`, `A4-html-picker.png`, `A4-publication-scorm.png`, `A4-publication-html.png`, `summary.json` (`pickers`) |
| AC-T7-04 | PASS | QA oracle: `cg_student` 100.00 (SCORM) and 100.00 (HTML); `cg_student2` 0.00 (SCORM) and "-" (no grade, HTML). Time from the end of the course to the grade in Moodle: 3.9 s, 3.8 s, 0 s (limit 60 s). The grader report shows the same values. | `AC-T7-04-oracle-grades.json`, `AC-T7-04-grader-report-101.png`, `AC-T7-04-grader-report-101.json` |
| AC-T7-05 | PASS | Completion "Receive a grade" (QA oracle state): `cg_student` SCORM 1, HTML 1 (done); `cg_student2` SCORM 1 (done), HTML 0 (not done). No `npm run moodle:cron` was needed. | `AC-T7-05-oracle-completion.json`, `AC-T7-05-course-page-cg_student.png`, `AC-T7-05-course-page-cg_student2.png`, `A4-*-activity-form.png` |
| AC-T7-06 | PASS | Portal Results (UI): SCORM "Learner 4" "Passed 100" "Sent", "Learner 5" "Failed 0" "Sent"; HTML "Learner 4" "Passed 100" "Sent". After "Refresh from Moodle" the Gradebook column shows 100 / 100, 0 / 100, 100 / 100. | `AC-T7-06-results-scorm.png`, `AC-T7-06-results-scorm-refreshed.png`, `AC-T7-06-results-html.png`, `AC-T7-06-results-html-refreshed.png` |
| AC-T7-07 | PASS | 4 learner launches from the Moodle course page (link with `window.open`). Each ended at `https://app.cogniate.test:8543/play/ply_…` in a new top-level window with Moodle as opener, in 87–138 ms after the click. No final URL has `ltik`. The shell showed "Completed — score 100 sent to Moodle" (and "Completed — score 0 sent to Moodle" for `cg_student2`). | `summary.json` (`launches`), `cg_student*-player.png`, `cg_student*-done.png` |
| AC-T7-08 | PASS | B4 picker (`COGNIATE-DEV-102`, "Cogniate (QA Library B)"): only "AI Website Sprint — HTML (QA Library B)". B5 picker (`COGNIATE-DEV-101`, Thanh's tool, opened after B3): Thanh's two courses, not the library B course. B5 saved no activity. | `B4-picker.png`, `B5-picker-thanh.png`, `summary.json` (`pickers`) |
| AC-T7-09 | PASS | `COGNIATE-DEV-102` gradebook: 100.00 for `cg_student`. Library B Results show the "Learner 4" row "Passed 100". Thanh's SCORM and HTML Results show no library B activity and no Course 102 row (UI and API). | `AC-T7-09-oracle-grade-102.json`, `AC-T7-09-grader-report-102.png`, `AC-T7-09-results-library-B.png`, `AC-T7-09-results-thanh-scorm.png`, `AC-T7-09-results-thanh-html.png` |
| AC-T7-10 | PASS | C1: the `cg_student` SCORM launch form (id_token + state, first post 303) posted again from a browser page and from Node, both with the original state cookie → HTTP 401 error page `data-error-code="INVALID_STATE"`, no redirect. `lti-service.jsonl` has `launch_check_failed {check: 1, code: INVALID_STATE}`. C2: 0 hits in the 3 log files for 8 ltiks, 3 service keys, 4 runtime tokens, 11 id_tokens (launch forms and Deep Linking response JWTs) and 2 API keys. QA searched each full value, and for a JWT also its payload and signature parts. | `C1-replay.json`, `C1-browser-replay.png`, `C2-secret-grep.json` (values masked), `E/run1/captured-secrets-masked.json` |
| AC-T7-11 | PASS | Three consecutive runs passed with `retries: 0`: run 1 (188 s), run 2 (189 s), run 3 (186 s); each 17 passed, 0 failed. Section 5. | `E/run1/tests.json`, `F/run1/tests.json`, `F/run2/tests.json`, `F/summary.json` |
| AC-T7-12 | PASS (run 1) | Screenshots: grader reports (101, 102), completion (course pages), portal Results (SCORM, HTML, library B, Thanh), Moodle tool settings (both tools: Manage tools card and edit form). Playwright traces for every test. Run times: section 3. | `E/run1/evidence/`, `E/run1/playwright/*/trace.zip` |
| AC-T7-13 | PASS | At the start and at the end, the three `/healthz` answered 200 with `"profile":"default"` and `"knobs":[]`. No `test_knob_active` event in the run's logs. The end check of `qa-suite.sh` also passed (exit 0). | `health-start.json`, `health-end.json` |
| AC-T7-14 | PASS | The wizard showed 6 dynamic steps; their `data-step-id` values equal the ids in `moodle-steps.json`. QA followed each step on the live Moodle 5.2.4 site: the menu path by clicks (Site administration → tab Plugins → Activity modules → External tool → Manage tools), then Add LTI Advantage, the Cogniate panel and Connect, Pending and Activate, and Edit with "Tool configuration usage", "Show in activity chooser and as a preconfigured tool", "Default launch container", "New window", "Save changes". Every label is on the page where the step says. No difference. The optional step `choose-register-new` did not apply: after `e2e:reset` no other tool exists, so Moodle did not show the choice page, and its label was not checked in this run. | `A2-steps.json`, `A2-label-diffs.json` (empty), `A2-manage-tools.png`, `A2-cogniate-confirm.png`, `A2-after-connect.png` |
| AC-T7-15 | PASS | After a fresh `e2e:reset` (36 s), `npm run demo:prepare` ended with exit 0 in 9.3 s (limit 3 min; it prints "Demo ready in 8 s"). Then `cg_student` opened both activities from the course page; each reached `/play/ply_…` (166 ms, 109 ms) and the course package loaded in the player. Section 5. | `F/demo/evidence/demo-launches.json`, `F/demo/evidence/demo-player-3.png`, `F/demo/evidence/demo-player-4.png`, `F/cmd/` (demo-prepare log) |

B-T6-01 (the wizard had no edit step) is closed: at `1639c7e` the wizard shows `edit-tool-settings`, and A2 followed it with no label difference.

## 2. Findings

| Id | Severity | Where | Problem | Evidence | Suggested fix |
| --- | --- | --- | --- | --- | --- |
| Q-T7-01 | MINOR | app contract §4.1 row 16; `GET …/tool-configuration`; manual wizard row `accept_grades` | The portal value "Delegate to teacher" is not an option text in Moodle 5.2.4. The Moodle option is "As specified in Deep Linking definition or Delegate to teacher". An admin who looks for the exact text does not find it. | `B2-manual-diffs.json`, `B1-tool-configuration-rows.json`, `B2-tool-B-settings.png` | Owner: Architect (contract text), then Author (app value). Use the exact Moodle 5.2.4 option text. |
| Q-T7-02 | MINOR | portal publication text "Teachers: Add an activity > Cogniate (<library>) > Select content"; course page "In Moodle: Add an activity → SCORM package"; `tasks/T7.md` A4 | Moodle 5.2.4 has no "Add an activity" label. The path is: Edit mode on → "Add content" (in the section) → "Activity or resource" → select the tool → "Add" → "Select content". A teacher who follows the portal text does not find the button. | `A4-publication-scorm.png`, `A4-course-101.png`; Moodle markup: button `title="Add content"`, menu item "Activity or resource", chooser footer button "Add" | Owner: Architect (T6.md text), then Author-2 (portal text). Use the Moodle 5.2.4 labels. |
| Q-T7-03 | NIT | HTML course package (fixture), menu page | On the HTML package menu page a decorative layer (`div.absolute … -z-0`) covers the centre of the lesson link, so Playwright refuses a pointer click. QA clicked the same link with a DOM click (as the T5 QA did). The SCORM package link takes a normal click. A person who clicks the link text may not see a problem; QA did not check this by hand. | Test annotations "DOM click" in A5 (HTML) and B6, `E/run1/tests.json` | No product change. Docs or the human review can check the HTML package menu by hand. |

Not seen in this run: the old Moodle button text "Register as a new tool" on the Cogniate `UPDATE_NOT_ALLOWED` page. T7 makes no update attempt, so this page did not show.

## 3. Run times (run 1)

| Part | Seconds |
| --- | --- |
| `npm run test:e2e` total (incl. `e2e:reset` and the container start) | 188 |
| `e2e:reset` | 41 |
| Suite (17 tests) | 142 |
| A1–A2 (portal wizard + Moodle admin steps) | 8.0 |
| A3 (two uploads and two publishes) | 1.7 |
| A4 (two activities by the chooser and the picker) | 12.0 |
| A5 (`cg_student`, SCORM and HTML, each with the 11 s dwell) | 38.3 |
| A6 (`cg_student2`, SCORM) | 19.9 |
| AC-T7-04, -05, -06 checks | 1.7, 4.8, 1.2 |
| B1–B2 (manual connect), B3, B4, B5, B6 | 8.8, 0.9, 8.1, 6.8, 26.5 |
| C1, C2, start and end checks | < 0.2 each |

## 4. Notes for the reader

- Moodle 5.2.4 labels that differ from the task text (tasks README §2): A4 "Add an activity" is "Add content" → "Activity or resource" → select → "Add" (Q-T7-02). The completion setting is in "Completion conditions": "Add requirements" → "Receive a grade" (any grade). On the first edit-mode visit Moodle shows the user tour "Activate edit mode"; QA ends it, as a person would.
- The chooser option sometimes opens the activity form at the first click (before the chooser script takes the click), and sometimes only selects it (then "Add" opens the form). The suite accepts both.
- Secrets: qa.md and the JSON evidence show no secret values (first 6 characters and the length only). The Playwright traces of this throwaway stack contain raw tokens; they stay in the git-ignored artifacts.
- Suite design: each scenario step is one Playwright test; later steps read the run state from `tests/e2e/artifacts/state.json`. So one failed check does not hide the later steps.

## 5. Runs 2 and 3, and the demo pass

Runner: the same command with `--runs 2 --demo` at the same SHA and with the same suite (`--replace-e2e`, the same 3 files as run 1). New clone `~/cogniate-qa-runs/qa-e2e-r1-1639c7ee-2026-10-19T02-37-10-943Z`, the same project, port and subnet. After the demo pass the stack was removed: 0 containers, 0 volumes, 0 networks.

| Run | `npm run test:e2e` | `e2e:reset` | Tests | Grade latency (s): `cg_student` SCORM, HTML, 102; `cg_student2` SCORM | C2 (captured / found in logs) | AC-T7-14 label differences |
| --- | --- | --- | --- | --- | --- | --- |
| 1 (`E/run1`) | exit 0, 188 s | 41 s | 17 pass, 0 fail, 1 skip (DEMO) | 3.9, 3.8, 3.8; 0 | 28 / 0 | none |
| 2 (`F/run1`) | exit 0, 189 s | 41 s | 17 pass, 0 fail, 1 skip (DEMO) | 3.8, 3.8, 3.8; 0 | 28 / 0 | none |
| 3 (`F/run2`) | exit 0, 186 s | 43 s | 17 pass, 0 fail, 1 skip (DEMO) | 3.8, 3.4, 3.9; 0 | 28 / 0 | none |

In every run: connection A `registered` after A2 and `connected` after A4, connection B `registered` after B2; pickers A4 = Thanh's two courses, B4 = only the library B course, B5 = Thanh's two courses; the only manual-form difference is Q-T7-01; Q-T7-03 (DOM click on the HTML lesson link) in A5 and B6.

Demo pass (AC-T7-15): `npm run e2e:reset` exit 0 in 36 s; `npm run demo:prepare` exit 0 in 9.3 s. Its output lists the steps (dynamic connection, Connect, activate with "Show in activity chooser" and "New window", upload and publish, two activities with grade 100 and completion "Receive a grade", teacher preview check) and the activity URLs `…/mod/lti/view.php?id=3` and `id=4`. Then `E2E_RESET=0 QA_E2E_DEMO=1 QA_GREP=AC-T7-15 npm run test:e2e`: the DEMO test passed (2.5 s); `cg_student` reached the player with the course package in both activities.

Build Runner note (Lead heads-up about `1639c7e`): the collected service logs (`infra/.logs/*.jsonl`) and command output of both runner calls have no `build_leftover_removed` event. The T7 suite does not use the Build Runner. A later run will use a SHA ≥ `8b4442b`.


## 6. Suite changes after the reviews (Round 1 addendum)

The reviews asked for small suite changes (no product change). QA-E2E made them in `tests/e2e/**` (in `565ac16`):

| Item | Change |
| --- | --- |
| B-T7-03 | No fixed waits outside the dwell rule. B6: QA waits for Thanh's own `cg_student` row ("Passed") before the negative check, so the check reads a full table. `learnerRun`: QA polls for the final shell text ("Completed — score 0 sent to Moodle" for a wrong answer) with a 90 s deadline. A6 now also checks that text. |
| B-T7-04 | AC-T7-06 reads the "Best outcome" cell ("Passed 100", "Failed 0") and the "Moodle sync" cell ("Sent"), not any text in the row. |
| A-T7-02 | C2 also captures and asserts state values, the registration `ref`, and the raw play ids (`ply_…`) and picker ids (`pck_…`) (security §10, §11; contract §12). It needs at least one value of each kind. |
| A-T7-03 | `tests/e2e/README.md`: traces and the HTML report hold raw secrets; keep them out of shared evidence. |
| Q-T7-01, Q-T7-02 fixed on main | The teacher hint check accepts the Moodle 5.2.4 labels in order ("Edit mode → Add content → Activity or resource → Cogniate (<library>) → Add → Select content"; T6.md writes ">" and leaves out "Edit mode"). The manual form now has no difference (the portal value is the exact Moodle option "As specified in Deep Linking definition or Delegate to teacher"). |

Validation run of the changed suite: `f0e5525`, fresh clone, `npm run test:e2e` exit 0 in 184 s (e2e:reset 42 s), 17 pass, 0 fail. C2: 48 captured values of 9 kinds (8 ltiks, 3 service keys, 4 runtime tokens, 11 id_tokens, 2 API keys, 8 states, 1 registration ref, 4 play ids, 4 picker ids), 0 found in the logs. Evidence: `tests/e2e/artifacts/runs/qa-e2e-r1-f0e55252-2026-10-19T02-57-08-020Z/`. The stack was removed after the run.

Not done (optional in A-T7-02): a search of the container stdout logs (`docker compose logs`). The service JSON logs carry the same events.

## 7. Pre-final run (`2129b69`)

`2129b69` has the same code as `63de503` (only docs changed). It includes the Author's B-T7-01 confirmation (`88e7d76`). The runner now passes `-- --yes` to `test:e2e` and `e2e:reset` and has a new option `--check-confirm` (`tests/e2e/host/run-t7.mjs`).

Command: `… node tests/e2e/host/run-t7.mjs --sha 2129b69 --runs 1 --check-confirm --demo --replace-e2e` (the only suite file that differs from the SHA is the runner). Fresh clone `~/cogniate-qa-runs/qa-e2e-r1-2129b69-2026-10-19T08-31-58-985Z`, project `qa-e2e-r1`, port 8543, subnet 172.31.0.0/16. Evidence: `G` = `tests/e2e/artifacts/runs/qa-e2e-r1-2129b69-2026-10-19T08-31-58-985Z/`.

| Check | Result | What QA saw | Evidence |
| --- | --- | --- | --- |
| `npm run test:e2e -- --yes` | PASS | Exit 0 in 185 s (`e2e:reset` 42 s). 17 pass, 0 fail, 1 skip (DEMO). No AC-T7-14 label difference, no manual-form difference. Grades in Moodle 3.8 s after each completion. C2: 45 captured values of 9 kinds, 0 in the logs. | `G/run1/tests.json`, `G/run1/evidence/` |
| B-T7-01 "no" deletes nothing: `npm run e2e:reset` | PASS | In a terminal (pty from `script`, answer typed after the prompt) the command prints the WARNING, asks "Type yes to delete the data and go on …", gets "no", prints "Stopped. Nothing was deleted." and exits 1. Snapshot before and after is the same: 5 containers (same ids and start times), 3 volumes, `seed.json` (same SHA-256), the data folders, the log files. | `G/cmd/07-confirm-no-e2e-reset.log`, `G/summary.json` (`confirm`) |
| B-T7-01 "no" deletes nothing: `npm run test:e2e` | PASS | The same for `test:e2e`: question, "no", "Stopped. Nothing was deleted.", exit 1, stack unchanged. | `G/cmd/08-confirm-no-test-e2e.log` |
| `--yes` on a fresh stack | PASS | The first `test:e2e -- --yes` in the new clone did not ask (no terminal, and no stack data yet). The demo pass `e2e:reset -- --yes` deleted and rebuilt the stack. | `G/cmd/06-test-e2e-run1.log`, `G/cmd/09-demo-e2e-reset.log` |
| AC-T7-15 `demo:prepare` (registration values now through stdin, A-T7-01) | PASS | After `e2e:reset` (44 s): `npm run demo:prepare` exit 0 in 9.0 s ("Demo ready in 8 s"), with the step list and the two activity URLs. Then `cg_student` reached the player with the course package in both activities (DEMO test PASS). | `G/cmd/10-demo-prepare.log`, `G/demo/evidence/` |
| Teardown | PASS | 0 containers, 0 volumes, 0 networks of `qa-e2e-r1` left. No `build_leftover_removed` event in the collected logs. | `G/cmd/12-stack-down.log` |

The same checks also passed at `63de503` (`tests/e2e/artifacts/runs/qa-e2e-r1-63de503-2026-10-19T03-05-23-440Z/`: `test:e2e` 180 s, both "no" checks, `demo:prepare` 8.2 s).

## 8. Final-candidate run (`8059c31`)

`8059c31` has all merged fixes (`.mbz` build race, runner lock, grade guard P2/P5, player status text P11, register timeout P1, fail-closed reset A-T7-04). The runner adds the A-T7-04 check to `--check-confirm` (committed in `fd84156`).

Command: `… node tests/e2e/host/run-t7.mjs --sha 8059c31 --runs 1 --check-confirm --demo --replace-e2e`. Fresh clone `~/cogniate-qa-runs/qa-e2e-r1-8059c31-2026-10-19T09-03-48-868Z`, project `qa-e2e-r1`, port 8543, subnet 172.31.0.0/16. Evidence: `H` = `tests/e2e/artifacts/runs/qa-e2e-r1-8059c31-2026-10-19T09-03-48-868Z/`.

| Check | Result | What QA saw | Evidence |
| --- | --- | --- | --- |
| `npm run test:e2e -- --yes` (AC-T7-01 to -14) | PASS | Exit 0 in 187 s (`e2e:reset` 42 s). 17 pass, 0 fail, 1 skip (DEMO). No AC-T7-14 label difference, no manual-form difference, no finding. Grades in Moodle 3.8 s after each completion. C2: 45 captured values of 9 kinds, 0 in the logs. Connection A `registered` → `connected`, B `registered`. | `H/run1/tests.json`, `H/run1/evidence/` |
| P11 player status text | PASS | When the attempt's score equals Moodle's score, the text did not change: "Completed — score 100 sent to Moodle" (A5, B6) and "Completed — score 0 sent to Moodle" (A6) matched exactly. No T7 scenario does a lower retake, so the new text "Completed — score X. Moodle keeps your best score: Y" does not show in T7. | A5, A6, B6 in `H/run1/tests.json` |
| B-T7-01 "no" in a terminal (`e2e:reset`, `test:e2e`) | PASS | Asks, gets "no", "Stopped. Nothing was deleted.", exit 1, stack unchanged. | `H/cmd/07-…`, `H/cmd/08-…` |
| A-T7-04 fail closed: no terminal, no `--yes`, no `E2E_CONFIRM` (`e2e:reset`, `test:e2e`) | PASS | With stack data present, each command printed the WARNING and "No terminal to ask. Run it with -- --yes, or E2E_CONFIRM=1. Nothing was deleted.", exit 1. Snapshot before and after the same (5 containers with the same ids and start times, 3 volumes, `seed.json`, data folders, log files). | `H/cmd/09-no-terminal-e2e-reset.log`, `H/cmd/10-no-terminal-test-e2e.log`, `H/summary.json` (`confirm`) |
| AC-T7-15 `demo:prepare` | PASS | After `e2e:reset -- --yes` (49 s): `demo:prepare` exit 0 in 8.6 s; `cg_student` reached the player with the course package in both activities. | `H/cmd/12-demo-prepare.log`, `H/demo/evidence/` |
| Teardown | PASS | 0 containers, 0 volumes, 0 networks of `qa-e2e-r1`. No `build_leftover_removed` event in the collected logs. | `H/cmd/14-stack-down.log` |

## 9. Final regression run (`dd6dd11`, final code)

`dd6dd11` = `8059c31` plus the review follow-ups: the Cogniate register page disables "Connect" on submit and shows a wait text; one extra `score_sync` log line for a superseded late send; P11 texts for attempts with no score; a clamp on the outbound timeout. The suite is the one in the SHA (no `--replace-e2e`).

Command: `… node tests/e2e/host/run-t7.mjs --sha dd6dd11 --runs 1 --check-confirm --demo`. Fresh clone `~/cogniate-qa-runs/qa-e2e-r1-dd6dd11-2026-10-19T09-12-10-259Z`, project `qa-e2e-r1`, port 8543, subnet 172.31.0.0/16. Evidence: `J` = `tests/e2e/artifacts/runs/qa-e2e-r1-dd6dd11-2026-10-19T09-12-10-259Z/`.

| Check | Result | What QA saw | Evidence |
| --- | --- | --- | --- |
| `npm run test:e2e -- --yes` (AC-T7-01 to -14) | PASS | Exit 0 in 183 s (`e2e:reset` 42 s). 17 pass, 0 fail, 1 skip (DEMO). A2 clicked "Connect" once and the Cogniate panel closed as before. No AC-T7-14 label difference, no manual-form difference, no finding. Grades in Moodle 3.8–3.9 s after each completion; shell texts "Completed — score 100 / 0 sent to Moodle" unchanged. C2: 45 captured values of 9 kinds, 0 in the logs. | `J/run1/tests.json`, `J/run1/evidence/` |
| B-T7-01 "no" in a terminal; A-T7-04 no terminal and no `--yes` (`e2e:reset`, `test:e2e`) | PASS | All four stop with exit 1 and the right text ("Stopped. Nothing was deleted." / "No terminal to ask … Nothing was deleted."). The stack is unchanged each time. | `J/cmd/07-…` to `J/cmd/10-…`, `J/summary.json` |
| AC-T7-15 `demo:prepare` | PASS | After `e2e:reset -- --yes` (39 s): exit 0 in 8.4 s; `cg_student` reached the player in both activities. | `J/cmd/12-demo-prepare.log`, `J/demo/evidence/` |
| Teardown | PASS | 0 containers, 0 volumes, 0 networks of `qa-e2e-r1`. | `J/cmd/14-stack-down.log` |

T7 on the final code: all 15 ACs pass. Passing `npm run test:e2e` runs in this file: `1639c7e` ×3, `f0e5525`, `63de503`, `2129b69`, `8059c31`, `dd6dd11` (183–189 s each). One dry run at `512bb86` (not listed above) failed on a suite text check (the old teacher hint); §6 fixed the check.

## 10. Replacement QA-E2E repair regression — 2026-10-19

Verdict: **PASS**. Round: **2 (Codex continuation)**. All 15 T7 ACs pass on the repaired candidate below. Earlier rounds and failures remain above.

| Item | Value |
| --- | --- |
| Independent role | Dedicated replacement QA-E2E, Codex GPT-6-Astra, xhigh. Independent of Authors, Docs and reviewers under the continuation charter. This is not a cross-model review. |
| Exact tested SHA | `c5683f896330debaea5e9a09f49357dc3e99e92b`. Its product and T7 harness match `d54c607d7fc6ce2d97e039bb108f52a37f2174ee`. No working-copy overlay was used. |
| Product delta from `dd6dd11` | `services/cogniate-app/src/domain/migrations/010_score_delivery_confirmation.sql`, `src/domain/score-syncs.ts`, `src/worker/score-sync.ts`, and adjacent `src/runtime-path.test.ts`. The repair adds durable delivery markers and bounded confirmation. |
| Isolation | Fresh external clone: `/Users/quangnguyen/cogniate-qa-runs/qa-e2e-cont-p2-c5683f89-2026-10-19T11-17-07-393Z`. Own project `qa-e2e-cont-p2`, port `8743`, subnet `172.29.0.0/16`. The Lead assigned the only new QA stack slot and required preservation of the ten existing development containers. |
| Command | `COMPOSE_PROJECT_NAME=qa-e2e-cont-p2 PUBLIC_PORT=8743 STACK_SUBNET=172.29.0.0/16 COURSE_FIXTURES_DIR=<read-only real course source> node tests/e2e/host/run-t7.mjs --sha c5683f896330debaea5e9a09f49357dc3e99e92b --runs 3 --check-confirm --demo` |
| Fixtures | Read-only copies from the historical QA clone `qa-e2e-t9-bf22fb7-20261019T084016/docs/raw/data/courses/`. SCORM SHA-256 `a685744e5fd9de21c203c3b2f47916ef1079532196ed870df89a00ab8ee76df7`; HTML `9f04d3abd65f85e362b2dca5207cc4b86ffa286e4b1a73923c157b69321f3f6d`. Copies went to the isolated clone's `tests/fixtures/courses/` and `docs/raw/data/courses/`. Source files stayed unchanged. |
| Environment | Local Moodle 5.2.4; Chromium in Playwright 1.56.0; one worker and `retries: 0`. Default profile, no knobs. No Moodle cron was needed. |
| Evidence | `K` = `tests/e2e/artifacts/runs/qa-e2e-cont-p2-c5683f89-2026-10-19T11-17-07-393Z/`. Commands, summary, each run's screenshots/JSON/logs, traces and demo evidence remain local. Raw traces and Playwright HTML reports contain test secrets; do not publish them. |

| Run | Full command | Reset | Tests | Grade latency: SCORM / HTML / wrong SCORM / library B | Secret scan |
| --- | --- | --- | --- | --- | --- |
| 1 | exit 0, 186 s | 48 s | 17 PASS, 0 FAIL, 1 demo-only skip | 3.3 / 3.8 / 3.3 / 3.8 s | 45 values, 9 kinds, 0 hits |
| 2 | exit 0, 181 s | 43 s | 17 PASS, 0 FAIL, 1 demo-only skip | 3.3 / 3.8 / 3.9 / 3.8 s | 45 values, 9 kinds, 0 hits |
| 3 | exit 0, 175 s | 39 s | 17 PASS, 0 FAIL, 1 demo-only skip | 3.9 / 3.8 / 3.8 / 3.8 s | 45 values, 9 kinds, 0 hits |

| AC | Result | Observed evidence in `K` |
| --- | --- | --- |
| AC-T7-01 | PASS | Each `npm run test:e2e -- --yes` starts from a clean reset and runs Scenarios A, B and C. All three runs exit 0, well below 25 minutes. `cmd/06-…` to `08-…`, `run*/tests.json`. |
| AC-T7-02 | PASS | Dynamic tool Active, New window and Show in activity chooser. Connection A changes `registered` to `connected`; B is `registered` after manual setup. `run*/evidence/A2-…`, `A4-integrations-connected.png`, `summary.json`. |
| AC-T7-03 | PASS | Thanh's picker contains exactly the two courses. Both activities have maximum 100; both publications show Selected in Moodle. `A4-*-picker.png`, publication screenshots and grade oracle. |
| AC-T7-04 | PASS | Student 1: SCORM 100, HTML 100. Student 2: SCORM 0, HTML no grade. Every observation takes at most 3.9 s. `AC-T7-04-oracle-grades.json` and grader report screenshot. |
| AC-T7-05 | PASS | Completion states are 1/1 for Student 1 and 1/0 for Student 2. Oracle and course screenshots agree. `AC-T7-05-*`. |
| AC-T7-06 | PASS | Portal rows show Passed 100/Sent, Failed 0/Sent and Passed 100/Sent. Refresh reads 100, 0 and 100. `AC-T7-06-results-*.png`. |
| AC-T7-07 | PASS | All 12 scenario launches end in a new top-level player window with Moodle as opener, without `ltik`. Click-to-player times are 90–125 ms. `summary.json`, player screenshots. |
| AC-T7-08 | PASS | B4 lists only library B's course. B5 lists only Thanh's two courses. `B4-picker.png`, `B5-picker-thanh.png`, `summary.json`. |
| AC-T7-09 | PASS | Course 102 and library B show Student 1's 100. Thanh's results do not contain that activity. `AC-T7-09-*`. |
| AC-T7-10 | PASS | Replayed launch returns `INVALID_STATE`. Each run finds zero hits for all 45 captured values of nine kinds in service JSON logs. `C1-replay.json`, `C2-secret-grep.json`. |
| AC-T7-11 | PASS | Three consecutive runs of this exact repaired SHA pass with retries 0. This proof does not rely on the historical three-run result. |
| AC-T7-12 | PASS | Each run includes grader, completion, portal and tool-setting screenshots, traces and timings. QA-E2E visually inspected the rendered grader report, portal results, completion page and tool settings. |
| AC-T7-13 | PASS | Start and end health reports show `profile: default` and empty knobs for all three services. No `test_knob_active` event is present. `health-start.json`, `health-end.json`, end test. |
| AC-T7-14 | PASS | No dynamic-step label difference and no manual-form difference in any run. `A2-label-diffs.json` and `B2-manual-diffs.json` are empty. |
| AC-T7-15 | PASS | Fresh demo reset: 43 s. `demo:prepare`: exit 0 in **8.64 s**, below 180 s. The separate demo test passes; Student 1 reaches both course players. `cmd/13-…` to `15-…`, `demo/evidence/`. |

Additional required checks:

- **B-T7-01:** answering `no` in a terminal stops both `e2e:reset` and `test:e2e` with exit 1. Both show the refusal message. Containers, volumes, seed hash, data folders and log lists are unchanged.
- **A-T7-04:** without a terminal, `--yes` or `E2E_CONFIRM`, both commands refuse with exit 1 and unchanged snapshots. Evidence: `cmd/09-…` to `12-…` and `summary.json`.
- **Root check:** `npm run check` in the isolated checkout exits 0. Lint, type checking and **708 unit tests in 48 files PASS, zero skips**. All five real-fixture tests ran. Evidence: `root-check.log`.
- **Teardown:** runner and independent exact-label queries both find **zero own containers, volumes and networks**. All ten pre-existing containers keep their IDs, start times and running state. Evidence: `cleanup-independent.json`, `other-containers-before.json`, `other-containers-after.json`, `cmd/16-stack-down.log`.
- **T8 scope:** the Architect's section 10 repair assessment retains the dated T8 PASS at `8059c31`. This delta changes no native channel, Build Runner, LTI transport, portal or infra path. QA-E2E checked the product-path diff; no new T8 run is claimed.

No new finding. T7 does not place the P2 late-write race or test lower-retake P11 variants. Those claims use the separate T5b regression at `d54c607`. This PASS does not remove the post-confirmation late-write risk or reconstruct unrecorded sends from before migration 010. Chromium/local Moodle and the HTML menu DOM-click limitation remain the tested boundary.

The full T7/root result and zero-resource teardown were sent to the Lead promptly. This worker remains active for the final committed T9 pack; this section does not declare T9 complete.

## M3 regression checkpoint — 2026-10-20

**NOT RUN / HOLD.** Task `task_e28388df4dcc`, independent Codex Canvas QA replacement. The planned final-SHA T7 gate was product/test `eb43247d02df622d5da72dafac41d919f65a91fe`, default profile, three consecutive runs plus demo and confirmation checks. While M2 was running, Lead `msg_478c680eab7a` superseded that candidate and required a hold before T7. No T7 stack or acceptance command started, so none of AC-T7-01 through AC-T7-15 is newly passed here; the historical rounds above retain their original SHA limits.

The preceding M2 stack was fully removed with the seven baseline Docker volumes unchanged. The next T7 run requires the repair freeze and another serialized window on `qa-e2e-m3-rN`, port `8543`, subnet `172.31.0.0/16`. It must record default health, no knobs, `simulation_profiles: []`, and absence of `lms-sim` and `lti-gate`. No T7 test or assertion changed in this checkpoint. See [M3 QA-E2E](../M3/qa-e2e.md) and [M2 QA round 4](../M2/qa.md#5-round-4--frozen-m2-execution-and-repair-preparation-2026-10-20).

### M3 checkpoint update — second M2 candidate

**T7 remains NOT RUN / HOLD.** Product/test `ae130a3501f3a2502c6a34e36319629e3dcdfb09` finished M2 with 61 PASS and three FAIL; conditional T7 authorization required all 64 PASS and cleanup. Therefore no default T7 stack, three-run sequence, demo or confirmation command began. Cleanup returned to zero containers and seven exact baseline volume metadata records.

The only shared learner glue change prepared here formats failed frame-wait URLs without runtime/play/picker capabilities; all Moodle navigation, real-course steps, exact completion text, grade and scenario assertions stay unchanged. Both actual frame timeout branches pass synthetic negative controls; T7 discovery remains unchanged. This does not establish a new T7 PASS. Product and diagnostic repairs need Lead integration, exact refreeze and another serialized window. See [M3 round 2](../M3/qa-e2e.md#5-round-2--current-verification-status) and [M2 round 5](../M2/qa.md#6-round-5--second-frozen-m2-run-and-diagnostic-hygiene-2026-10-20).
