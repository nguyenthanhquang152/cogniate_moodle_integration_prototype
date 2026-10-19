Verdict: APPROVE
Round: 2

# T8 (stretch) review — Reviewer-B (lens: "Can a human team own it?")

Scope: `git diff 48c725d c9e26da -- . ':!docs' ':!tests'` (34 files): host-side Build Runner (`infra/scripts/build-runner.sh`, `infra/build-runner/{compose.yaml,Dockerfile,queue.mjs,php/build_course.php}`), build-queue folders, `stack:up`/`stack:down`/`stack:reset` hooks, the mbz API (`app/mbz.ts`, `domain/mbz-builds.ts`, migration 009), the course shell through Moodle WS (`app/web-services.ts`, `clients/moodle-ws.ts`), string knobs in `packages/shared/src/knobs.ts`. Spec: `tasks/T8.md`, ADR-007, app contract §11.

| Check | Result |
| --- | --- |
| `npm run check` | 636 passed, 1 failed: `apps/portal/src/server.test.ts` "downloads exactly the uploaded bytes …" (expected by the Lead until T6 round 2; see B-T8-03) |

| Severity | Count | Ids |
| --- | --- | --- |
| BLOCKER | 0 | — |
| MAJOR | 1 | B-T8-01 |
| MINOR | 1 | B-T8-02 |
| NIT | 1 | B-T8-03 |

## Lead's focus questions

- **Can a developer understand the Build Runner?** Yes.
  - The header of `build-runner.sh` explains *why* it runs on the host (the Docker socket is root, so it is never mounted into the internet-facing app), the four queue folders and who may write them, and the two commands.
  - `build_one` reads top to bottom: validate → `running` → copy the zip (by sha256, into a new empty folder) → start the throwaway Moodle → steps `course`, `scorm`, `backup` → copy → teardown → `ready`.
  - Each failure writes `step` and `reason` **after** the teardown, so "failed" means "nothing left" (AC-T8-07).
  - The `infra/README.md` row describes the runner, the log file, the image, the knobs and what it deletes.
- **Can a developer operate it?**
  - Start: `stack:up` starts the watcher in the background (pid file, log `infra/.logs/build-runner.log`), and `npm run build-runner` runs it in the foreground.
  - Stop: `stack:down` and `stack:reset` call `stop_build_runner`.
  - Missing image: `ensure_image` builds it once.
  - A request that waits more than 60 s shows "Waiting for the Build Runner. It starts with npm run stack:up, or run npm run build-runner."
  - Stopping the runner **during** a build has no recovery (B-T8-01), and a runner that dies is hard to see (B-T8-02).
- **Request and status file format:** Clear and safe. `queue.mjs` treats the request as untrusted: a size limit, a strict pattern for each field, no path taken from the request, and the zip found by sha256. Status writes are atomic (`.tmp` + rename) and add `startedAt`, `updatedAt` and `finishedAt`. The app copies the status only forward and cuts `step` and `reason` to safe lengths.
- **Tests (`native.test.ts`):** They cover the app side: one checked request with the knobs; a second POST returns the same build; HTML → `422 MBZ_NOT_SUPPORTED`; another library → 404; status running → ready with a download → failed with the reason; the 60 s hint; the runner's request checks; AC-T8-08 and AC-T8-09 (WS token stored encrypted, missing functions, hidden course shell, `exists`). The host script itself is checked live by QA (AC-T8-02 to -07), as planned.
- **Fit with `stack:up` and `stack:reset`:**
  - `stack:up` creates the queue folders before compose mounts them (otherwise Docker would make them as root) and starts the runner.
  - `stack:reset` deletes the queue.
  - Neither removes leftover `cogniate-build-*` projects (B-T8-01).

---

## Findings

### B-T8-01 — MAJOR — A build that is interrupted (runner stopped or killed) is never cleaned up, and that course version can then never be built again

- **Location:** `infra/scripts/build-runner.sh` (`watch` loop: `mv requests/… processing/…`, `build_one`, `rm processing/…`; no `trap`); `infra/scripts/lib.sh` `stop_build_runner` (`kill <pid>`); `services/cogniate-app/src/app/mbz.ts` `refresh()` (the hint only when there is **no** status file and the request is still in `requests/`) and `POST …/mbz` ("if `current` is `queued` or `running`, return it").
- **Problem:** A build takes minutes. Suppose the developer runs `stack:down` or `stack:reset`, presses Ctrl+C on `npm run build-runner`, or the Mac sleeps during a build. Then:
  1. The watcher dies, but the throwaway project `cogniate-build-<id>` (Moodle and Postgres) keeps running.
  2. The request stays in `processing/`.
  3. The status file stays `status: running`.
  4. The app shows the build as running forever, and every new `POST …/mbz` returns that same stuck build (202), so the user cannot start a new build for this version.

  The only way out is to clean Docker by hand and edit the queue files or the database.
- **Evidence:** A search for `trap`, `cogniate-build-` and `processing` in `build-runner.sh`, `lib.sh`, `stack-down.sh` and `stack-reset.sh` finds no cleanup and no sweep at start. `stop_build_runner` only kills the pid. AC-T8-03 ("no `cogniate-build-*` items after the build") is proven only for builds that end normally.
- **Suggested fix:**
  1. In `watch` and `once`: `trap` TERM and INT → tear down the current project (`dcb down -v`) and write `status=failed step=<step> reason="The Build Runner stopped during the build. Start it again and build again."`.
  2. When the watcher starts: mark every file in `processing/` as `failed` with that reason, and remove every leftover project with `docker compose ls` / the label `com.docker.compose.project=cogniate-build-*`.
  3. In the app: a `running` build with no status update for longer than a step timeout (for example 15 min) is shown as failed with "The Build Runner did not finish this build", and `POST` starts a new build.
  4. `stack:reset` also removes leftover `cogniate-build-*` projects and volumes.
  5. Add one live QA check: stop the runner during the `scorm` step → the build shows the reason, a new build works, and `docker ps -a` shows no `cogniate-build-*`.

### B-T8-02 — MINOR — The runner's health is hard to see, and its log does not use the service log format

- **Location:** `infra/scripts/lib.sh` `start_build_runner` (`nohup … &` then "Build Runner started (pid …)"); `build-runner.sh` `ensure_image` (with `set -e`, a failed `docker build` ends the watcher at once); `log()` (plain text to `infra/.logs/build-runner.log`).
- **Problem:**
  - `stack:up` prints "Build Runner started" right after `nohup`, even when the watcher dies a second later (for example the first image build fails: no network, a composer error). Builds then wait, and the user sees only the generic 60 s hint.
  - The other services write JSON lines with `event` and `trace_id`, and QA and support search those. The runner writes free text.
- **Suggested fix:**
  1. After starting, `stack:up` waits about 2 s, checks the pid, and if the watcher is gone prints the last 20 log lines and "the Build Runner did not start".
  2. The runner writes a small heartbeat (`infra/.data/build-queue/runner.json {pid, startedAt, lastSeenAt, image: "ready" | "missing"}`), so the app can say "The Build Runner is not running" or "The build image is missing: run npm run build-runner image".
  3. Write JSON lines (`build_started`, `build_step`, `build_failed {step, reason}`, `build_ready {bytes}`, `runner_started`, `image_build_failed`) to `infra/.logs/build-runner.jsonl`, and add them to app contract §12.

### B-T8-03 — NIT — Small points

- **Location and fix:**
  - `build-runner.sh` usage line: "Usage: build-runner.sh [watch | once <request.json>]" does not name the existing `image` command. Add it.
  - `teardown()` waits for the hold file with `while [[ -e … ]]; do sleep 2; done` and no limit. A forgotten `BUILD_RUNNER_HOLD=1` blocks the single-threaded runner, and so every other build. Add a maximum (for example 30 min), then go on and log it.
  - The failing test on main (`apps/portal/src/server.test.ts`, `download?kind=mbz`) is the cogniate-app route test that sits in the portal workspace (B-T6-04). A change in cogniate-app (T8) broke a test in `apps/portal`. Moving it next to `courses.ts` keeps each task's tests in its own workspace.

---

## Round 2

Round 2 verdict: **APPROVE**. No open BLOCKER or MAJOR finding.

Input: `git diff 16507ac b5ee0ea -- infra services ':!infra/scripts/stack-doctor.sh' ':!infra/scripts/demo-users.sh'` (19 files).

| Id | Status | Evidence |
| --- | --- | --- |
| B-T8-01 (MAJOR) | **Resolved** | `build-runner.sh` traps TERM and INT and runs the long commands as background jobs (`bg …`), so the trap runs at once and tears down the current `cogniate-build-*` project. It writes the failed status with `STOPPED_REASON` ("The Build Runner stopped during the build. Start it again (npm run stack:up) and build again."). At start, and in the new `sweep` command (which `stack:reset` now runs), interrupted builds in `processing/` are marked failed and every leftover `cogniate-build-*` container, volume and network is removed. A lock file (`build-queue/.runner.pid`) refuses a second runner (its sweep would kill the first runner's build). The app fails a build with no progress for 10 min (`STALE_BUILD_MS`), so `POST …/mbz` can start a new one. `native.test.ts` grew by about 97 lines for these paths. |
| B-T8-02 | **Resolved** | `start_build_runner` prints "Build Runner started" only when the pid is alive **and** `status/runner.json` exists. Otherwise it prints "ERROR: the Build Runner did not start (it stopped at once) …", the last five log lines and the fix. The heartbeat `{pid, startedAt, lastSeenAt, image}` drives the app hints: "not running …", "cannot make its build image … run npm run build-runner image", "making its build image (once, about 20 s)". The log is JSON lines in `infra/.logs/build-runner.jsonl` (stderr in `build-runner.err.log`). |
| B-T8-03 (NIT) | Partly | The usage line now names `image` and `sweep`. Still open, safe to defer: the hold wait has no time limit (test-only knob). |

## Readiness (`f26ffbf`): `npm run stack:doctor`, `npm run demo:users`, host names in one place

Judged as a Vietnamese product person who runs the stack by hand. I ran `stack:doctor` against the live stack (it changes nothing). Result: 20 `OK` lines and one `INFO`, then "Result: all checks OK.", exit 0. I ran `demo:users` with passwords masked in my notes, although the script prints none.

- **`stack:doctor`: very good.**
  - One line per check, with `OK`, `FIX` or `INFO`, then a one-line result and exit 1 when something needs a fix.
  - It covers Docker (running, memory, CPUs), Node and npm packages, `.env` and URLs, certificates (days left, names), port, subnet, images, fixtures, each service's health, the Build Runner, test knobs, the profile, seeding, and how to browse the names.
  - Every `FIX` has **one** concrete next action in short STE sentences, mostly the exact command: "Run: npm ci"; "Docker Desktop > Settings > Resources > Memory: set 6 GB or more, then Apply & restart."; "Set STACK_SUBNET in .env to a free range (for example 172.29.0.0/16), run npm run gen-env, then npm run stack:up."
  - Two small points (NIT):
    1. The test-knob fix says "for each service in .tmp/compose.knobs.yaml". Print the service names in the line (the doctor can read the file), so nobody must open a hidden file.
    2. Only the stack *leaf* certificate is checked for expiry. Also check `infra/.certs/root.crt` (365 days), with "delete infra/.certs/, run npm run gen-env, then npm run stack:up (and trust the new CA again if you trusted it)".
- **`demo:users`: clear.**
  - It shows the web addresses (with "no page to open" for the LTI and content hosts, and "open them with npm run demo:browser"), the Moodle users with roles and courses, the portal users with libraries, where the passwords are (the `.env` variable name for each user, and `seed.json`), and the direct Moodle activity links.
  - It never prints a password. That is a safe default, but a product person must then open `.env`, which Finder hides.
  - Suggestion (NIT): add a local-only opt-in, for example `npm run demo:users -- --copy cg_teacher` (copies one password with `pbcopy`) or `--show-passwords` (with a WARNING line that these are local dev values).
- **Host names in one place (B-T1-10): resolved.** `lib.sh` defines and exports `MOODLE_HOST`, `LTI_HOST`, `APP_HOST`, `CONTENT_HOST` and `STACK_HOSTS`. `gen-env`, `gen-certs`, `demo-browser` and the doctor use them, and the compose aliases read `${MOODLE_HOST:-moodle.test}` (and so on). The only other place is the compose fallback default, which is fine.

---

## T8 portal (AC-T8-10 UI, merge `bdca28a`, Author-2 / Codex)

Verdict for this part: **APPROVE** (NITs only). Input: `git diff 8b4442b 8fdfa9e` (`apps/portal/src/courses/{MoodleBackup,MoodleCourse,PublishDialog}.tsx`, `connect/{WebServices,ConnectionSetup}.tsx`). `npm run check`: pass, 46 test files, 658 tests.

- **What is good:**
  - "Moodle backup" has one button ("Build Moodle backup (.mbz)", "Starting build…" while busy) and shows the build status, the server reason and the download.
  - The "Restore in MoodleCloud" steps are short STE, one action per line: "Open Site administration > Courses > Restore course." → "Upload the .mbz file." → "Restore as a new course." → "The course arrives hidden. Check the course, then make it visible."
  - The web-services form says why it is optional ("to create an empty course when you publish"), uses a password field with `autocomplete="off"`, clears the token after saving, and shows the site and release in a polite live region.
  - The publish dialog's checkbox and the Moodle course link follow T8.
- **NITs:**
  1. `MoodleCourse.tsx` shows the raw value ("Moodle course status: created / exists / failed"). Use plain words, for example "A hidden Moodle course was created.", "The Moodle course already exists.", "Cogniate could not create the Moodle course: <reason>".
  2. The last restore step holds two actions. Split it.
  3. `T8-REPORT.md` and `evidence/t8-*` add to the report files in the product folder (B-T6-04).
