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
- The two Cogniate course zips in `docs/raw/data/courses/`. They are not in git (decision Q15).
- The Docker images on your Mac. The times below are with the images already pulled.

Optional: run `npm run stack:doctor`. It prints one line per check, with `OK` or `FIX` and a fix [Not verified by QA].

## Procedure 1: Start a ready demo from zero

WARNING: Step 6 deletes the local Moodle site and all local Cogniate data. Use it only for a local demo stack.

1. Start Docker Desktop.
2. Open a terminal in the repo folder.
3. Run `npm ci` to install the packages [AC-T1-01].
4. Run `npm run fixtures:check` to check the two course zips [LC-T1-06].
5. Run `npm run gen-env` to make `.env`, the passwords and the certificates [LC-T1-01].
6. Run `npm run e2e:reset` to build and start an empty stack [AC-T7-15].
7. When the command asks, type `yes` and press Return [Not verified by QA].
8. Run `npm run demo:prepare` to make the demo set-up [AC-T7-15].
9. Read the users and the two activity URLs in the output [AC-T7-15].

Result [AC-T7-15]:

- In the QA run, step 6 took 36 seconds and step 8 took 9.3 seconds.
- Thanh's Library is connected to Moodle. Both courses are uploaded and published.
- `COGNIATE-DEV-101` has two Cogniate activities, with a maximum grade of 100 and completion "Receive a grade".
- `cg_student` can open both activities and reach the course player.

NOTE: `demo:prepare` does by script what the guides for the [Moodle admin](moodle-admin.md) and the [teacher](teacher.md) show by hand. To do these steps by hand, run only steps 1 to 7.

## Procedure 2: Show the users

1. Run `npm run demo:users` [Not verified by QA].

Result: the command lists the URLs, the users, and the `.env` name of each password. It does not print passwords [Not verified by QA].

## Procedure 3: Open the stack in your browser [Not verified by QA]

QA opened every page with Chromium in a test container [AC-T7-01]. QA did not test a browser on your Mac.

1. Make sure that Google Chrome or Chromium is in `/Applications`.
2. Run `npm run demo:browser`. A new Chrome window opens with its own profile [Not verified by QA].
3. In the Moodle tab, sign in as `cg_student`, `cg_teacher` or `admin` [AC-T1-07].
4. In a new tab, go to `https://app.cogniate.test/signin`.
5. Sign in with the email `thanh@cogniate.test` and its password [AC-T4-01].

Result: you are signed in to Moodle and to the Cogniate portal.

The builder states these facts. QA did not verify them:

- The Chrome profile is in `.tmp/demo-browser-profile`. You can delete it at any time.
- The command does not change the settings of your Mac.
- If Chrome is in a different folder, set `CHROME_BIN=/path/to/chrome` before the command.

Next: [what a learner sees](learner-view.md).

## Procedure 4: Start again

WARNING: `npm run e2e:reset` deletes the local Moodle site, the Cogniate data, the logs and `seed.json`. It keeps `.env` and the certificates.

1. Run `npm run e2e:reset` [AC-T7-01, AC-T7-15].
2. When the command asks, type `yes` and press Return [Not verified by QA].
3. If you want the demo set-up again, run `npm run demo:prepare` [AC-T7-15].

Result: an empty stack in about 40 seconds, with the same passwords [AC-T7-01, AC-T1-10].

## Procedure 5: Stop the stack [Not verified by QA]

1. Run `npm run stack:down` [Not verified by QA].

Result: the containers stop. The data stays [Not verified by QA]. To start again, run `npm run stack:up` [AC-T1-02].

## Procedure 6: Run the full end-to-end test

1. Run `npm run test:e2e` [AC-T7-01].
2. When the command asks, type `yes` and press Return [Not verified by QA].

Result: the test starts an empty stack and runs the full story on Moodle 5.2.4. In the QA runs, it took 188, 189 and 186 seconds, with 17 tests passed and no retries [AC-T7-01, AC-T7-11].

NOTE: In a script, use `npm run test:e2e -- --yes` or set `E2E_CONFIRM=1`. Then the command does not ask [Not verified by QA]. If a step fails, see "Debug a failed E2E step" in [`infra/README.md`](../../infra/README.md#debug-a-failed-e2e-step).

## Optional checks

| Command | Expected result | Tag |
| --- | --- | --- |
| `npm run check` | Exit code 0 (lint, type check, unit tests). | AC-T1-01 |
| `npm run seed` | Exit code 0. You can run it again at any time. It makes no duplicate users or courses. | AC-T1-12 |
| `npm run stack:node-reach-check` | The Cogniate services reach Moodle. Exit code 0. | AC-T1-13 |

## Not verified by QA

- `npm run stack:doctor`, `npm run demo:users`, `npm run demo:browser` and `npm run stack:down`.
- The `yes` question of `e2e:reset` and `test:e2e`. It came after the last QA run.
- `npm run demo` as the first command on a new clone. QA checked `npm run demo` only after T1, on a stack that ran already [LC-T1-03].
- A browser on your Mac, and the default port 443.
- Safari and Firefox. QA used Chromium only.
- The 10-minute test with a new person (AC-T9-01, decision HR-2).

If something goes wrong, see [troubleshooting](troubleshooting.md).
