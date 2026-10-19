Verdict: APPROVE
Round: 2

# T8 review (stretch): Reviewer-A (correctness and security)

History: the round 1 verdict was APPROVE (1 MINOR, 2 NIT; below). The round 2 verdict is APPROVE (section "Round 2" at the end, with the readiness note).

## Round 1

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

## Round 2

Scope: `git diff 16507ac b5ee0ea -- infra services ':!infra/scripts/stack-doctor.sh' ':!infra/scripts/demo-users.sh'` (19 files).
- I read the new `queue.mjs`, `build-runner.sh`, the build compose file and `build_course.php`, and the `mbz.ts`, `mbz-builds.ts` and `compose.yaml` changes.
- I ran the **real** `queue.mjs` (identical to `b5ee0ea`) on crafted files in a new temporary folder. Each call had a 4 s watchdog, so a blocking read would show as "HUNG". The folder was deleted afterwards.
- I did not read `reviewer-b.md`.

### A-T8-01 (MINOR): resolved. I tried to break the symlink and FIFO cases.

`validate` (request files) opens with `O_RDONLY | O_NOFOLLOW | O_NONBLOCK`, then uses `fstat`: the file must be regular, owned by this user, and at most 4,096 bytes. It reads exactly `st.size` bytes.

| Request file | Result |
| --- | --- |
| normal JSON request | accepted |
| symlink to `/etc/hosts`; symlink to the runner's **own** valid request | `request is a symlink` |
| FIFO (`mkfifo`) | `request is not a regular file`, at once (no hang) |
| folder; `/dev/zero` | `request is not a regular file` |
| 5,000-byte file | `request too large` |
| hard link to the user's own regular file | accepted (same user, same file system, so no gain) |

`publish` (the backup) uses `lstat`: the file must be regular. Then come the size range (18 B to 2 GB), the gzip magic read through `O_NOFOLLOW`, and `copyFileSync(…, COPYFILE_EXCL)`.

| Backup / destination | Result |
| --- | --- |
| gzip file to a new name | copied (`{"bytes":42}`) |
| symlink to `/etc/hosts`; symlink to the runner's own valid backup; FIFO; folder | `backup is not a regular file (symlink or special file)` |
| not gzip; 2 bytes | `backup is not a gzip file`; `backup size is out of range` |
| existing destination; destination that is a planted symlink | `EEXIST`, and the symlink target is **not** written |

The design closes the round 1 path. The build container has **no writable host folder** any more: the `out` bind mount is removed, and the backup is written inside the container (`moodledata/cogniate-out`). The runner takes it out with `docker cp` into a new empty host folder. `docker cp` copies a symlink as a symlink unless you pass `-L`, and the runner does not. After the copy, the container cannot change that host folder, so there is no race between the check and the copy. `out/` is still read-only for the app. `rm -rf` of the work folder does not follow links.

### B-T8-01 and A-T8-02 (recovery): resolved

- **Stop signal:** a `TERM` or `INT` trap (`on_stop`) tears down the current project, removes the work folder and hold file, writes `status=failed` with the reason "The Build Runner stopped during the build …", removes the request and the heartbeat, and frees the lock. Long commands run through `bg … & wait`, so the trap runs at once.
- **Start-up sweep (also used by `stack:reset`):** it fails interrupted builds in `processing/`, removes work folders that match `^[0-9a-f]{24}$`, and runs `down -v` on every container, volume or network labelled `cogniate-build-<24 hex>`.
- **Single runner:** the lock `build-queue/.runner.pid` (not mounted in the app) holds the pid, and a pid only counts if `ps … command` contains `build-runner.sh`.
- **App timeout:** a build with no progress for 10 min is failed, so a new request starts fresh. The hints come from the `status/runner.json` heartbeat.

### A-T8-03 (NIT): resolved

At most 2 queued or running builds per library, else `409 MBZ_BUILD_LIMIT`.

### A-T8-04: NIT: two small robustness details

- (a) `activeBuildCount` counts rows that are still `queued` or `running`. A stale build on **another** version becomes `failed` only when that version is refreshed (GET or POST for it). After a runner crash, a library can therefore stay at the limit until it opens those versions. Fix: before the count, expire the library's active builds with no progress for `STALE_BUILD_MS`, or count only builds updated within that time.
- (b) In `publish`, `EEXIST` from `copyFileSync` is not caught. The runner keeps the last line of a Node stack trace as the failure reason that the portal shows. Fix: catch it and call `fail('a backup with this id already exists')`.

Round 2 counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 1 NIT (A-T8-04). All round 1 findings are resolved.

## Readiness scripts (`f26ffbf`): note

- **`npm run demo:users` prints no secret.** It prints the public URLs, the user names, and only the **names** of the variables that hold the passwords (`MOODLE_ADMIN_PASSWORD`, `PORTAL_THANH_PASSWORD`, …), with a pointer to `.env` and `infra/.secrets/seed.json`. When the stack runs, it adds the LTI activities from one read-only `SELECT` in the Moodle container (course short name, activity name, view URL).
- **`npm run stack:doctor` changes nothing.** It runs only read-only checks: `docker info`, `image inspect`, `network ls`/`inspect`, `compose port`/`ps`, `docker inspect` health, `openssl x509` reads of `infra/.certs/*.crt`, one TCP connect to `127.0.0.1:$PUBLIC_PORT`, a DNS cache query and `grep`. It runs no `rm`, `down`, `kill`, `docker run` or file write. Sourcing `lib.sh` only reads `.env` and exports variables. Its output holds only versions, sizes, host names, subnets and fix commands, never a key or password.

## T8 portal (AC-T8-10; Codex batch `git diff 8b4442b 8fdfa9e`): note, no finding

The new views (`WebServices.tsx`, `MoodleBackup.tsx`, `MoodleCourse.tsx`, `PublishDialog.tsx`) are safe:
- **Token handling.** The token input is `type="password"` with `autocomplete="off"`. The token is kept only in React state, sent once in the `PUT …/web-services` body, and cleared (`setToken("")`) after a successful save. It never goes to `localStorage`, `sessionStorage` or a cookie, and the UI shows only `siteName` and `release` from the answer. The two committed screenshots show an empty or masked field, and the error state shows only the server message, the code and a trace id.
- **XSS.** `build.reason`, `shellError`, site name, release and course names are React text nodes. No view uses raw HTML.
- **Links.** The backup link is the server-built relative `/app-api/…/download?kind=mbz` path. "Open Moodle course" uses the server-built `{https siteUrl}/course/view.php?id={integer}` with `target="_blank" rel="noopener noreferrer"`.
- **Origin.** The new writes (`PUT web-services`, `POST …/mbz`, `POST /publications` with `createMoodleCourse` only when the connection has a token) all go through `api.ts`, so the server's `Origin` rule applies.
