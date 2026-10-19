Verdict: PASS
Round: 1

# T9 QA verification (QA-E2E)

The Lead gave T9 QA to QA-E2E (the first QA works on T8). Scope: AC-T9-01 (the command part; the human part stays HR-2), AC-T9-02, AC-T9-03. AC-T9-04 is Reviewer-B's (confirmed in `reviewer-b.md`).

| Item | Value |
| --- | --- |
| Docs SHA | `bf22fb7` (Docs T9 round 1 fixes). AC-T9-01 ran on a fresh clone of `bf22fb7`. AC-T9-02 and AC-T9-03 read the committed `bf22fb7` text. |
| Spec | `tasks/T9.md` (AC-T9-01 to -04); charter §1 (document only what QA verified) |
| Isolation | Own project `qa-e2e-t9`, port 8543, subnet 172.31.0.0/16. QA did not touch any other project. After each run: 0 containers, 0 volumes, 0 networks of `qa-e2e-t9`. |
| Evidence root | `T` = `tests/e2e/artifacts/t9/qa-e2e-t9-bf22fb7-20261019T084016/` (git-ignored): `timeline.txt`, one log per step, `pages/` (screenshots, `results.json`). A first attempt at `4182c80` (`…/qa-e2e-t9-4182c80-20261019T083857/`) stopped at the course zips (finding Q-T9-02). |

## 1. Results per acceptance criterion

| AC | Result | What QA saw | Evidence |
| --- | --- | --- | --- |
| AC-T9-01 (command part, QA run) | PASS | QA followed only the root `README.md` "Quick start" and `docs/guides/run-the-stack.md` Procedures 1–3, in a fresh clone, on macOS (Docker 29.8.2, Node 24.21.0), with the images already pulled. **61 s** from the clone to both pages (limit 10 min). Steps: course zips into `docs/raw/data/courses/` (0 s), `npm ci` (3 s; the npm cache was warm), `npm run fixtures:check` (OK), `npm run gen-env` (1 s), optional `npm run stack:doctor` ("all checks OK"), `npm run e2e:reset` (42 s; a fresh clone has no data, so it did not ask for "yes", as the README says: "If it asks, type yes"), `npm run demo:prepare` (10 s), `npm run demo:users`, then the browser. Browser: Google Chrome 155 from `/Applications`, started by Playwright in headless mode with the same flags as `npm run demo:browser` (`--host-resolver-rules` for the four stack names, `--ignore-certificate-errors-spki-list` with the stack key), a throwaway profile. The Moodle login page answered HTTP 200 with the login form; `cg_student` signed in. The portal sign-in page answered HTTP 200 with "Sign in"; `thanh@cogniate.test` signed in (landed on `/integrations`). Passwords were read from `infra/.secrets/seed.json`, as the guide says. | `T/timeline.txt`, `T/*.log`, `T/pages/1-moodle-login.png` … `4-portal-signed-in.png`, `T/pages/results.json` |
| AC-T9-01 (human part) | OPEN (HR-2) | No person who did not build the stack has done the run yet. The Lead accepted this QA run for the command part only. | `docs/human_review/decisions-needed.md` HR-2 |
| AC-T9-02 | PASS | All 177 tags in the 6 guides and the root README point to a QA row: each AC id has a PASS row in its task's `qa.md` (script check of every tag), and the "T7 qa.md §6" links exist. The only tag without a row is AC-T9-01 itself (this file). QA also read every guide for behaviour sentences without a tag: each one is tagged, or marked "[Not verified by QA]" / "pending QA" (T8, allowed). Section 3 lists the "[Not verified by QA]" items that this run and T7 §7 now verify, so Docs can tag them. | Section 3 |
| AC-T9-03 | PASS | `docs/human_review/proven.md` §3 lists all 8 "Not proven" items of `docs/architecture/README.md` §6: Safari Deep Linking (Q16), MoodleCloud (Q5), the player in Firefox and Safari, video playback, a real person closing a real window, mobile browsers, load and scale (Q11), 1EdTech certification (Q1). It adds the human-run items (HR-2, Q17) and the `.mbz` restore in the Moodle pages. `docs/human_review/decisions-needed.md` lists all 17 open questions (Q1–Q17) of `docs/architecture/open-questions.md`, each with a recommendation, who decides and what it blocks, plus the residual risks R1–R5 and the hand-over checks HR-1, HR-2. | `proven.md`, `decisions-needed.md` at `bf22fb7` |
| AC-T9-04 | — | Reviewer-B's check (STE). | `reviewer-b.md` |

## 2. Steps that were unclear, wrong or missing (AC-T9-01)

| Id | Severity | Where | Problem | Evidence | Suggested fix |
| --- | --- | --- | --- | --- | --- |
| Q-T9-02 | MINOR | `README.md` "Quick start" line "The two course zips must be in `docs/raw/data/courses/`"; `run-the-stack.md` "Before you start"; the `fixtures:check` message | A fresh clone has no folder `docs/raw/data/courses/`. A copy into it fails ("Not a directory"). QA's first attempt stopped there. | `tests/e2e/artifacts/t9/qa-e2e-t9-4182c80-20261019T083857/02-copy-zips.log` | Add one step: "Make the folder: `mkdir -p docs/raw/data/courses`. Copy the two zips into it." (Docs; the `fixtures:check` text: Author.) |
| Q-T9-01 | NIT | `run-the-stack.md` (no step), `troubleshooting.md` row "Port 443 … is busy" | On a Mac that already runs another stack, the guides do not say how to give this checkout its own port, project name and subnet. QA set `COMPOSE_PROJECT_NAME`, `PUBLIC_PORT` and `STACK_SUBNET` for `gen-env` (from `infra/README.md`, "Separate checkout"). A new person with one stack does not need this. The port row in troubleshooting works (edit `.env`, run `gen-env`). | `T/05-gen-env.log`, `T/06-stack-doctor.log` | Optional: one NOTE in the run guide that links to `infra/README.md` "Separate checkout". |
| Q-T9-03 | NIT | `run-the-stack.md` Procedure 5 result "the containers stop. The data stays" | `npm run stack:down` removes the containers (not only stops them). The data stays: the three volumes were still there after the command. | `T/11-stack-down.log`, `T/volumes-after-stack-down.txt` (3 volumes), `T/containers-after-stack-down.txt` (0) | "The containers are removed. The data stays." |

Not a problem: the time for `npm ci` (3 s) is with a warm npm cache. On a new Mac the first `npm ci` also downloads the packages; T9.md counts only pulled images.

## 3. "[Not verified by QA]" items that QA now verified

Docs can replace these tags with the evidence below (`T` = section 1 root; T7 §7 = `docs/reviews/T7/qa.md` §7).

| Guide line (`bf22fb7`) | What QA saw | Evidence |
| --- | --- | --- |
| `run-the-stack.md` "Optional: run `npm run stack:doctor`" (and `troubleshooting.md` line 5) | One line per check with `OK`, `FIX` or `INFO`. With the zips missing it printed `FIX` and the fix; with everything ready, "Result: all checks OK." | `T/06-stack-doctor.log`; the `4182c80` attempt `06-stack-doctor.log` |
| Procedure 1 step 7, Procedure 4 step 2: "When the command asks, type `yes`" | With stack data, `npm run e2e:reset` in a terminal printed the WARNING, asked "Type yes to delete the data and go on …", took "yes", and reset the stack (44 s; new `seed.json`, new containers). On a fresh clone it does not ask. | `T/21-e2e-reset-answer-yes.log`, `T/07-e2e-reset.log` |
| The same question, answer "no" (`e2e:reset` and `test:e2e`) | "Stopped. Nothing was deleted.", exit 1, stack unchanged. | T7 §7 |
| Procedure 6 step 2 and NOTE: `test:e2e` asks; with `-- --yes` it does not ask | Asks in a terminal (T7 §7). The QA runner always uses `-- --yes`: no question, the run goes on. | T7 §7, T7 §5 |
| Procedure 2: `npm run demo:users` | Lists the web addresses, the users with the `.env` name of each password, the two courses and the two Cogniate activity URLs. It prints no password. | `T/09-demo-users.log` |
| Procedure 3 steps 3–5 (and the flags of `demo:browser`) | With the same flags as `demo:browser` (Chrome 155, headless): the Moodle login page, sign-in as `cg_student`, the portal sign-in page, sign-in as Thanh. QA did not run the command itself, because it opens a window on the desktop. Step 2 ("A new Chrome window opens") stays not verified. | `T/pages/` |
| Procedure 5: `npm run stack:down` | Exit 0. The containers are removed; the data volumes stay (see Q-T9-03). | `T/11-stack-down.log` |

Still not verified by QA (correctly marked in the guides): the default port 443; the window of `demo:browser`; `npm run demo` as the first command; the badges "Link expired" and "Disconnected" and the "Disconnect" button; the pending-tool clean-up; the native-channel steps in the Moodle pages and Options B and C (T8 pending); the troubleshooting rows marked "No"; Safari, Firefox, MoodleCloud.

## 4. Notes

- `docs/architecture/open-questions.md` R4 says "Chromium and Firefox work". QA tested Chromium only. The pack (`decisions-needed.md` R4) says "Other browsers are not proven", which is correct. The Architect file is outside T9 (NIT for the Architect).
- After `bf22fb7`, Docs committed `5187765` (T9 conformance), and the Architect is editing `docs/architecture/README.md` §6 and `open-questions.md`. If §6 or the open questions change, AC-T9-03 needs a short re-check.
