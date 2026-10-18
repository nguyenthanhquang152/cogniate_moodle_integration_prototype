Verdict: CHANGES_REQUESTED
Round: 1

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
