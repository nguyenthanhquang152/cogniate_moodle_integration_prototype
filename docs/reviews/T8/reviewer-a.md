Verdict: APPROVE
Round: 1

# T8 review (stretch): Reviewer-A (correctness and security)

Scope: `git diff 48c725d c9e26da -- . ':!docs' ':!tests'` (34 files). Spec: `tasks/T8.md`, ADR-007, app contract §11, security §9 (outbound guard), §10 (secrets).

Method:
- I read every changed file:
  - the host runner (`infra/scripts/build-runner.sh`, `infra/build-runner/queue.mjs`), the build project (`infra/build-runner/compose.yaml`, `Dockerfile`, `php/build_course.php`) and the app mounts in `infra/compose.yaml`;
  - `lib.sh` and `stack-up`/`stack-down`/`stack-reset`;
  - `app/mbz.ts`, `domain/mbz-builds.ts`, migration 009, the `kind=mbz` download in `app/courses.ts`;
  - `app/web-services.ts`, `clients/moodle-ws.ts`, the publish shell in `app/publications.ts`, `domain/connections.ts`, `domain/publications.ts`;
  - the knobs.
- Read-only host checks: the runner PID file, file counts in the queue folders, the five status files (status, step and reason only), and `docker ps -a`, `docker volume ls`, `docker network ls` and `docker image ls` for `cogniate-build-*`.
- I made no writes and started no build.
- I did not read `reviewer-b.md`.

## Lens-A questions

1. **Can a crafted request file make the host runner do more than build one known package?** Through the **contents** of the file, no. Through the **file type**, a little (see A-T8-01).
   - Only names that match `^bld_[0-9a-f]{24}\.json$` are taken.
   - `queue.mjs validate` checks every field against a strict pattern: `buildId`, `courseId`, `versionId`, `packageSha256` (`^[0-9a-f]{64}$`), `variant`, `lang`, `title` (1–255 characters, no control characters), `hold` (boolean) and `failAt` (one of the steps). The total is at most 4,096 characters.
   - No path comes from the request: the zip is `$UPLOADS/<sha256>.zip`, copied into a new empty folder and mounted read-only.
   - Every shell value is a checked pattern and is quoted. The title goes to PHP only through `job.json`, never through the shell.
   - The PHP builder uses only Moodle APIs with parameters.
   - The runner cannot check that the SHA-256 belongs to the requested library, but the app already has every upload, so a compromised app gains nothing from this.
2. **Isolation of the build containers.**
   - There is one network with `internal: true` and no published port. The project does not join any network of the main stack. Docker's DNS on an internal network does not resolve `moodle.test`.
   - It has its own Postgres and volumes. The database and admin passwords are random for each build. No main-stack secret or certificate is mounted.
   - The mounts are `php` (read-only), `in` (read-only) and `out` (read-write).
   - The image gets its composer dependencies at image build time, so a running build needs no internet.
   - `down -v --remove-orphans` runs for every outcome, and the `failed` or `ready` status is written **after** the teardown (AC-T8-07).
   - Live: five finished builds (three `ready`, two `failed` with the test knob), and no `cogniate-build-*` container, volume or network is left.
   - Gaps: a stopped runner (A-T8-02), and the `out` folder is writable by the build container (A-T8-01 b).
3. **Web services token.**
   - The token must match `^[A-Za-z0-9]{16,128}$`. It is checked with `core_webservice_get_site_info` and stored only as AES-256-GCM under `APP_MASTER_KEY` (`ws_token_encrypted`).
   - It is sent only in the POST body (`wstoken`), never in the URL, and the outbound log keeps only host, method and status.
   - The connection JSON shows only `webServices { siteName, release }`. Error texts keep Moodle's `errorcode` and at most 200 characters of Moodle's message, which does not echo the token.
4. **SSRF through the site URL.**
   - Every WS call goes through the guarded outbound client (https only, the IP check in the connect lookup, no redirects) to the connection's `siteUrl`, which must be an https origin at creation.
   - The app's private-host allowlist adds `moodle.test` for the dev stack only. Production stays empty (security §9).
   - A library user can point a pending connection at any public https host. That host only receives its own token, and only `siteName`, `release` and `functions` from its JSON come back, so there is nothing to gain.
5. **Tenant scope of the mbz download.**
   - The course, the version, the package (`library_id`) and the build (`latestReadyBuild(db, library, version)`) are all scoped by library.
   - The file path is `out/<bld_ + 24 hex from the database>.mbz`, read-only in the app.
   - `Content-Disposition` uses only the integer version. `POST .../mbz` is a write, so it is under the `/app-api` `Origin` rule.

## Other checks (no finding)

- **App mounts.** The app container gets `requests/` read-write, and `status/` and `out/` read-only. `processing/` and `hold/` are not mounted. The Docker socket is never mounted in the app container.
- **Status flow.** Status files are written atomically (`.tmp` then rename). The app accepts only the known statuses, cuts `step` to 32 characters and `reason` to 300, and changes a row only while it is not finished. The portal shows `reason` as text.
- **Course shell.** The publish shell reads the library's own encrypted token (`webServicesOf(db, lib, …)`), finds a course by idnumber (`cogniate:{courseId}:{variant}:{lang}`) or creates it hidden (`visible=0`), and records `created`, `exists` or `failed` without stopping the publish. Two libraries on the same site cannot clash, because the idnumber holds the course id.
- **Knobs.** `BUILD_RUNNER_FAIL_AT` accepts only the listed steps. Active knobs are reported as for the other knobs.

## Findings

### A-T8-01: MINOR: the host runner follows symlinks and reads special files from folders that untrusted parties write

- Location: `infra/build-runner/queue.mjs` `checked()` (`readFileSync(path)` before the 4,096-character check); `infra/scripts/build-runner.sh` lines 77–78 (`[[ -s "$work/out/course.mbz" ]]` and `cp "$work/out/course.mbz" …`).
- Problem:
  - (a) `requests/` is writable by the internet-facing app container. A file named `bld_<24 hex>.json` that is a symlink or a FIFO makes the host process (running as the developer) read any host file it can read, read `/dev/zero` until Node's buffer limit, or block forever on a FIFO, which stops the watcher. Only fixed error texts are logged, so no content leaks.
  - (b) `$work/out/` is writable by the build container, which processes the untrusted SCORM zip. The runner copies `course.mbz` while that container still runs, and `cp` follows a symlink. A package that gets code execution in the build Moodle could therefore make `course.mbz` point to a host file (for example the user's SSH key). The runner would copy that file into `out/<id>.mbz`, and the library user could download it.
- Evidence: the runner design treats both inputs as untrusted ("the request file comes from the internet-facing app, so it is UNTRUSTED"; "Untrusted data: … mounted read-only"). The file-type checks are missing at exactly these two points.
- Fix:
  - (a) In `checked()`, call `lstatSync` first. Refuse anything that is not a regular file of at most 4,096 bytes. Then open it with `O_RDONLY | O_NOFOLLOW` and read through the descriptor.
  - (b) Stop the build containers (`dcb stop`) before the copy step, so the folder cannot change. Then refuse a `course.mbz` that is a symlink or not a regular file (`[[ -f … && ! -L … ]]`). Copy with no-dereference, or open with `O_NOFOLLOW`.
  - Add one test for each case.

### A-T8-02: NIT: stopping the runner during a build leaves the build project and a "running" build

- Location: `infra/scripts/build-runner.sh` `watch` (no `trap`); `lib.sh` `stop_build_runner`; `stack-down.sh` and `stack-reset.sh`.
- Problem: `stop_build_runner` sends SIGTERM to the watcher, but no trap tears down the current `cogniate-build-<hex>` project. The containers, volumes and network stay. The request stays in `processing/`, and the status stays `running`, so the portal waits forever. `stack:down` and `stack:reset` do not remove leftover `cogniate-build-*` projects.
- Fix: in `watch`, trap `TERM` and `INT`, tear down the current project, and write `status=failed`, `reason="The Build Runner stopped."`. Let `stack:reset` remove leftover `cogniate-build-*` projects.

### A-T8-03: NIT: one library can fill the single build queue

- Location: `app/mbz.ts` `POST .../mbz` (one build for each **version** at a time, no limit for each library).
- Problem: the runner builds one package at a time, and each build starts a Moodle and a Postgres. A library with many SCORM versions can queue one build for each version and delay every other library's builds.
- Fix: allow one queued or running build for each library (return the current one with `202`), or a small limit, and show the queue position.

## Counts

0 BLOCKER, 0 MAJOR, 1 MINOR (A-T8-01), 2 NIT (A-T8-02, -03).
