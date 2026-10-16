# Run the local stack

This guide tells you how to start, open, reset and stop the local stack on a Mac. The stack is Moodle 5.2 and the Cogniate services in Docker.

For all commands, settings and certificates, see the technical reference: [`infra/README.md`](../../infra/README.md).

## How to read the tags

| Tag | Meaning |
| --- | --- |
| `[AC-T1-02]`, `[LC-T1-03]`, `[H2]` | QA tested this behaviour in task T1, and it passed. The tag is a row in [`docs/reviews/T1/qa.md`](../reviews/T1/qa.md), round 2 (commit `b82382b`). |
| `[Not verified by QA]` | Only the Author checked it. It can fail on your Mac. If it fails, tell the Lead. |

NOTE: QA ran the stack with `PUBLIC_PORT=8443`, so the QA URLs end in `:8443` [LC-T1-02]. The default port is 443. Then the URLs have no port number [Not verified by QA].

## What the stack gives you

| URL | What it shows |
| --- | --- |
| `https://moodle.test/login/index.php` | The Moodle 5.2 login page [AC-T1-03] |
| `https://lti.cogniate.test/healthz` | `{"status":"ok","service":"lti-service","knobs":[]}` [AC-T1-04] |
| `https://app.cogniate.test/healthz` | The same, with the service `cogniate-app` [AC-T1-04] |
| `https://content.cogniate-content.test/healthz` | The same, with the service `cogniate-content` [AC-T1-04] |

The portal and the course player come in later tasks (T4 to T6). This guide does not describe them yet.

`npm run seed` makes these Moodle users and courses:

| User | Role in `COGNIATE-DEV-101` and `COGNIATE-DEV-102` |
| --- | --- |
| `admin` | Moodle site administrator |
| `cg_teacher` | Editing teacher [AC-T1-08] |
| `cg_student` | Student [AC-T1-08] |
| `cg_student2` | Student [AC-T1-08] |

- All four users can sign in with the passwords in `.env` [AC-T1-10].
- The passwords are also in `infra/.secrets/seed.json` [H2]. In `.env`, the names are `MOODLE_ADMIN_PASSWORD`, `MOODLE_TEACHER_PASSWORD`, `MOODLE_STUDENT_PASSWORD` and `MOODLE_STUDENT2_PASSWORD`.
- Git ignores both files [AC-T1-11]. Do not copy the passwords into git, chat or tickets.
- Completion tracking is on in both courses [AC-T1-08].

## Before you start

You need:

- A Mac with Docker Desktop. QA used Docker 29.8.2 and Compose 5.5.1.
- Node 24 and npm. QA used Node 24.21.0.
- The Docker images on your Mac. The times in this guide are with the images already pulled, as in AC-T1-02.

## Procedure 1: Start the stack the first time

1. Start Docker Desktop.
2. Wait until Docker Desktop shows that the engine runs.
3. Open a terminal in the repo folder.
4. Run `npm ci` to install the packages [AC-T1-01].
5. Run `npm run gen-env` to make `.env` and the certificates in `infra/.certs/` [LC-T1-01].
6. Run `npm run stack:up` to start the containers [AC-T1-02].
7. Wait until the command stops.
8. Run `npm run seed` to make the Moodle users and courses [AC-T1-02].
9. Read the four URLs in the output [AC-T1-02].

Result: steps 6 and 8 end with exit code 0. In the QA run, they took 31 seconds together [AC-T1-02].

## Procedure 2: Show the URLs and user names again

1. Run `npm run demo` [LC-T1-03].

Result: the command prints the four URLs and the four user names [LC-T1-03].

NOTE: `npm run demo` can also install, build and start the stack in one command. QA verified it only on a stack that runs already. For the first start, use procedure 1.

## Procedure 3: Open the stack in your browser [Not verified by QA]

QA opened the Moodle login page and signed in with Chromium inside the test container [AC-T1-03, AC-T1-07]. QA did not test a browser on your Mac.

1. Make sure that Google Chrome or Chromium is in `/Applications`.
2. Run `npm run demo:browser` [Not verified by QA].
3. In the new Chrome window, go to the Moodle login page tab [Not verified by QA].
4. Type `cg_teacher` in the user name field.
5. Type the password of `cg_teacher` from `infra/.secrets/seed.json`.
6. Click **Log in**.

Result: Moodle signs you in as `cg_teacher` [AC-T1-07]. With a wrong password, Moodle does not sign you in [AC-T1-07].

The Author states these facts. QA did not verify them:

- The Chrome window uses a new profile in `.tmp/demo-browser-profile`. You can delete this folder at any time.
- The command does not change the settings of your Mac.
- If Chrome is in a different folder, set `CHROME_BIN=/path/to/chrome` before the command.

You can also use your daily browser. This changes the settings of your Mac. Read the section "Your own browser" in [`infra/README.md`](../../infra/README.md#your-own-browser) and its CAUTION first [Not verified by QA].

## Procedure 4: Start again with an empty Moodle site (reset)

WARNING: `npm run stack:reset` deletes the Moodle site and its database. You lose all courses, activities and grades that you added.

1. Run `npm run stack:reset` [AC-T1-10].
2. Run `npm run stack:up` [AC-T1-10].
3. Run `npm run seed` [AC-T1-10].

Result [AC-T1-10]:

- Moodle has only the site course, `COGNIATE-DEV-101` and `COGNIATE-DEV-102`. QA added a course before the reset, and that course was gone after it.
- The passwords in `.env` still work.
- The certificate authority in `infra/.certs/` does not change (same fingerprint).
- In the QA run, the three steps took 33 to 34 seconds.

## Procedure 5: Run seed again

1. Run `npm run seed` [AC-T1-12].

Result: exit code 0. Seed does not make a second copy of a user, course, enrolment, web service or token [AC-T1-12]. You can run it at any time.

## Procedure 6: Stop the stack [Not verified by QA]

1. Run `npm run stack:down` [Not verified by QA].

Result: the containers stop. The Moodle site and the database stay [Not verified by QA]. To start the stack again, run `npm run stack:up`.

## Optional checks

| Command | Expected result | Tag |
| --- | --- | --- |
| `npm run check` | Exit code 0 (lint, type check, unit tests). | AC-T1-01 |
| `npm run stack:moodle-reach-check` | Moodle reaches the LTI service. The command prints `{"status":"ok","service":"lti-service","knobs":[]}`. | AC-T1-05 |
| `npm run stack:node-reach-check` | The two Cogniate services reach Moodle. Exit code 0. | AC-T1-13 |
| `npm run fixtures:check` | Exit code 0 if the two course zips are correct. Exit code 1 if a zip is missing or changed. | LC-T1-06 |

## Not verified by QA

- `npm run demo:browser`, and any browser on your Mac.
- `npm run demo` as the first command on a new clone.
- `npm run stack:down`.
- The default port 443. QA used port 8443.
- Safari and Firefox. QA used Chromium only.
- The 10-minute test with a new person (AC-T9-01). It comes after task T7.

## If something goes wrong

See "Troubleshooting" in [`infra/README.md`](../../infra/README.md#troubleshooting) [Not verified by QA].
