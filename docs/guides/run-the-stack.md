# Run the local stack

This guide tells you how to start the prototype on a Mac, open it in your browser, and start again. The stack is a real Moodle 5.2.4 site and the Cogniate services, in Docker.

Technical reference (all commands, settings, certificates): [`infra/README.md`](../../infra/README.md).

## How to read the tags

| Tag | Meaning |
| --- | --- |
| `[AC-T7-15]`, `[LC-T1-06]`, `[H2]` | QA tested this behaviour, and it passed. The tag is a row in `docs/reviews/<task>/qa.md`, for example [`T7`](../reviews/T7/qa.md) or [`T1`](../reviews/T1/qa.md). |
| `[Not verified by QA]` | Only the builder checked it. It can fail on your Mac. If it fails, tell the Lead. |

NOTE: QA used `PUBLIC_PORT=8443` and `8543`, so the QA URLs end in `:8443` or `:8543` [AC-T1-09, AC-T7-07]. The default port is 443. Then the URLs have no port number [Not verified by QA].

## What you get

| URL | What it is |
| --- | --- |
| `https://moodle.test/login/index.php` | The Moodle 5.2.4 site [AC-T1-03, AC-T1-07] |
| `https://app.cogniate.test/signin` | The Cogniate portal (a stand-in for the real Cogniate portal) [AC-T4-01] |

| User | Where | Role |
| --- | --- | --- |
| `admin` | Moodle | Site administrator [AC-T7-14] |
| `cg_teacher` | Moodle | Editing teacher in `COGNIATE-DEV-101` and `COGNIATE-DEV-102` [AC-T1-08] |
| `cg_student`, `cg_student2` | Moodle | Students in both courses [AC-T1-08] |
| `thanh@cogniate.test` | Portal | Owner of "Thanh's Library" [AC-T4-01] |
| `qa-b@cogniate.test` | Portal | Owner of "QA Library B", a second library for isolation tests [AC-T7-08] |

- The passwords are in `infra/.secrets/seed.json` [H2, AC-T4-01] and in `.env` [AC-T1-10]. Examples of `.env` names: `MOODLE_STUDENT_PASSWORD`, `PORTAL_THANH_PASSWORD`.
- Git ignores both files [AC-T1-11]. Do not copy the passwords into git, chat or tickets.

## Before you start

You need:

- A Mac with Docker Desktop. QA used Docker 29.8.2.
- Node 24 and npm. QA used Node 24.21.0.
- The two Cogniate course zips. They are not in git (decision Q15). Procedure 1 tells you where to put them.
- The Docker images on your Mac. The times below are with the images already pulled.

Optional: run `npm run stack:doctor`. It prints one line per check, with `OK`, `FIX` or `INFO`, and a fix for each `FIX` [AC-T9-01].

NOTE: If another stack runs on this Mac (for example a second clone), give this clone its own project name, port and subnet. See "Separate checkout" in [`infra/README.md`](../../infra/README.md#qa-hooks).

## Procedure 1: Start a ready demo from zero

WARNING: Step 8 deletes the local Moodle site and all local Cogniate data. Use it only for a local demo stack.

1. Start Docker Desktop.
2. Open a terminal in the repo folder.
3. Make the course folder: `mkdir -p docs/raw/data/courses` [AC-T9-01].
4. Copy the two Cogniate course zips into `docs/raw/data/courses/` [AC-T9-01].
5. Run `npm ci` to install the packages [AC-T1-01].
6. Run `npm run fixtures:check` to check the two course zips [LC-T1-06].
7. Run `npm run gen-env` to make `.env`, the passwords and the certificates [LC-T1-01].
8. Run `npm run e2e:reset` to build and start an empty stack [AC-T7-15].
9. When the command asks, type `yes` and press Return [AC-T9-01].
10. Run `npm run demo:prepare` to make the demo set-up [AC-T7-15].
11. Read the users and the two activity URLs in the output [AC-T7-15].

Result [AC-T7-15]:

- In the QA run, step 8 took 36 seconds and step 10 took 9.3 seconds. From a new clone to both pages in the browser took 61 seconds [AC-T9-01].
- Thanh's Library is connected to Moodle. Both courses are uploaded and published.
- `COGNIATE-DEV-101` has two Cogniate activities, with a maximum grade of 100 and completion "Receive a grade".
- `cg_student` can open both activities and reach the course player.

NOTE: `demo:prepare` does by script what the guides for the [Moodle admin](moodle-admin.md) and the [teacher](teacher.md) show by hand. To do these steps by hand, run only steps 1 to 9.

NOTE: On a new clone, `e2e:reset` does not ask. If you answer anything other than `yes`, it stops and deletes nothing [T7 qa.md §7].

## Procedure 2: Show the users

1. Run `npm run demo:users` [AC-T9-01].

Result: the command lists the URLs, the users, the `.env` name of each password, and the Cogniate activities. It does not print passwords [AC-T9-01].

## Procedure 3: Open the stack in your browser

QA signed in on both pages with Chrome and the same settings as `demo:browser`, but without a window on the desktop [AC-T9-01].

1. Make sure that Google Chrome or Chromium is in `/Applications`.
2. Run `npm run demo:browser`. A new Chrome window opens with its own profile [Not verified by QA].
3. In the Moodle tab, sign in as `cg_student`, `cg_teacher` or `admin` [AC-T9-01, AC-T1-07].
4. In a new tab, go to `https://app.cogniate.test/signin` [AC-T9-01].
5. Sign in with the email `thanh@cogniate.test` and its password [AC-T9-01, AC-T4-01].

Result: you are signed in to Moodle and to the Cogniate portal [AC-T9-01].

The builder states these facts. QA did not verify them:

- The Chrome profile is in `.tmp/demo-browser-profile`. You can delete it at any time.
- The command does not change the settings of your Mac.
- If Chrome is in a different folder, set `CHROME_BIN=/path/to/chrome` before the command.

Next: [what a learner sees](learner-view.md).

## Procedure 4: Start again

WARNING: `npm run e2e:reset` deletes the local Moodle site, the Cogniate data, the logs and `seed.json`. It keeps `.env` and the certificates.

1. Run `npm run e2e:reset` [AC-T7-01, AC-T7-15].
2. When the command asks, type `yes` and press Return [AC-T9-01].
3. If you want the demo set-up again, run `npm run demo:prepare` [AC-T7-15].

Result: an empty stack in about 40 seconds, with the same passwords [AC-T7-01, AC-T1-10].

## Procedure 5: Stop the stack

1. Run `npm run stack:down` [AC-T9-01].

Result: the containers are removed. The data stays [AC-T9-01]. To start again, run `npm run stack:up` [AC-T1-02].

## Procedure 6: Run the full end-to-end test

1. Run `npm run test:e2e` [AC-T7-01].
2. When the command asks, type `yes` and press Return [T7 qa.md §7].

Result: the test starts an empty stack and runs the full story on Moodle 5.2.4. In the QA runs, it took 188, 189 and 186 seconds, with 17 tests passed and no retries [AC-T7-01, AC-T7-11].

NOTE: In a script, use `npm run test:e2e -- --yes` or set `E2E_CONFIRM=1`. Then the command does not ask [T7 qa.md §7]. If a step fails, see "Debug a failed E2E step" in [`infra/README.md`](../../infra/README.md#debug-a-failed-e2e-step).

## Optional checks

| Command | Expected result | Tag |
| --- | --- | --- |
| `npm run check` | Exit code 0 (lint, type check, unit tests). | AC-T1-01 |
| `npm run seed` | Exit code 0. You can run it again at any time. It makes no duplicate users or courses. | AC-T1-12 |
| `npm run stack:node-reach-check` | The Cogniate services reach Moodle. Exit code 0. | AC-T1-13 |

## Not verified by QA

- The desktop window of `npm run demo:browser` (Procedure 3, step 2).
- `npm run demo` as the first command on a new clone. QA checked `npm run demo` only after T1, on a stack that ran already [LC-T1-03].
- The default port 443.
- Safari and Firefox. QA used Chromium and Chrome only.
- The 10-minute test with a new person. QA did the command part in 61 seconds [AC-T9-01]. The human part is decision HR-2.

If something goes wrong, see [troubleshooting](troubleshooting.md).
