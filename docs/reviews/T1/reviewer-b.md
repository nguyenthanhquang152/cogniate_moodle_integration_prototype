Verdict: APPROVE
Round: 2

# T1 review — Reviewer-B (lens: "Can a human team own it?")

Scope: `git diff cfe30c1 bc530a7` (67 files), spec `docs/architecture/tasks/T1.md` (working tree), QA tests in `39b3450`.

What I ran (read-only for the live stacks):

| Check | Result |
| --- | --- |
| Clean export of `bc530a7` in `/tmp`: `npm ci && npm run check` | Pass. 7 test files, 32 tests, about 3 s. |
| `npm run check` in the main working copy | **Fail**, 66 ESLint errors, all in a git-ignored file (B-T1-01) |
| Live stack `cogniate-stack`: `docker ps`, host `curl --cacert` to the four hosts | 5 containers healthy. One published port `127.0.0.1:443`. Four hosts give 200. |
| `npm run stack:moodle-reach-check`, `npm run stack:node-reach-check` | Both pass (Moodle uses `moodleorgca.crt`; both Node services get 200 from Moodle) |
| `infra/.secrets/seed.json` | Mode 600. The keys match the "Stable key paths" table. |
| Failure probes in the `/tmp` copy, with `DOCKER_HOST` set to a dead socket (no stack touched) | See B-T1-03. The fixtures, shell-vs-`.env`, and missing-`tests/` messages are clear. |

| Severity | Count | Ids |
| --- | --- | --- |
| BLOCKER | 0 | — |
| MAJOR | 2 | B-T1-01, B-T1-02 |
| MINOR | 6 | B-T1-03 to B-T1-08 |
| NIT | 3 | B-T1-09 to B-T1-11 |

## Summary for the Lead's focus questions

- **New developer in 10 minutes from `infra/README.md`:** Yes, if the images are already present. The quick start is three commands (`npm ci`, `npm run demo`, `npm run demo:browser`). The README has one clear command table with "deletes / keeps" columns. The first image download (about 2.3 GB for the stack, plus 3.6 GB for the e2e image at the first test run) takes most of the time, and the README does not say so (B-T1-10).
- **Command naming and count:** 19 root scripts and 5 helpers. The names are consistent (`stack:*`, `demo*`, `test:*`). There is no single "what is wrong?" command (B-T1-03).
- **Script readability and error messages:** Good. The scripts are short, have a header comment, use `set -euo pipefail`, and print the next command. The shell-vs-`.env` guard for parallel stacks is very good.
- **Shared package boundaries:** Small and readable. Some names and one placeholder will cause confusion in T2 (B-T1-06).
- **Over-engineering:** None that blocks. The CIDR subtraction in `setup_dev_network.php` is justified by parallel stacks. The shape-based `seed.json` reader in QA's tests is more than needed (B-T1-07).
- **Seed idempotency:** The PHP finds every item by name and reuses it. The admin password is the one gap (B-T1-02).
- **Common failures:** Missing fixtures: clear message. Port 443 busy, Docker not running, subnet overlap: raw Docker text or a wrong hint (B-T1-03). Lost `.env` with old volumes: a 10-minute hang (B-T1-02).

## What is good (keep it)

- The CA and leaf certificate are made before any container starts, and `stack:reset` keeps them. This fixes the startup-order risk from T0.
- One source for the public URLs (`gen-env` → `.env` → compose → `loadPublicUrls()`). The Caddyfile reads the same values.
- `lib.sh` stops when a shell value differs from `.env`. So a command cannot touch another checkout's stack by mistake.
- `infra/README.md`: one command table, a TLS table, the `seed.json` key table, the knob table, and a troubleshooting list. The spike notes carry a clear "historical" banner.
- The `fixtures:check` message says what is missing and how to get it.

---

## Findings

### B-T1-01 — MAJOR — `npm run check` fails in a normal working copy because ESLint does not follow `.gitignore`

- **Location:** `eslint.config.js` `ignores`.
- **Problem:** ESLint ignores `infra/.data/**` and `.tmp/**`, but git ignores `.data/` in every folder. So a git-ignored file breaks the root check, which is the Definition-of-Done gate (charter §4).
- **Evidence:**
  - Today, `npm run check` in the main checkout gives 66 errors, all in `apps/player-spike/.data/pkg-scorm/scorm-api.js`. `git check-ignore -v` shows `.gitignore:12:.data/`. That file is the untrusted vendored SCORM adapter from a course package.
  - With `--ignore-pattern '**/.data/**'` the same lint passes. A clean export of `bc530a7` passes too.
  - The ignore list repeats `.gitignore` by hand, so the two lists will drift again. Later tasks put extracted packages and fixtures in `data/` folders (ADR-006).
- **Suggested fix:** Load `.gitignore` into the flat config (`includeIgnoreFile` from `@eslint/compat`). Or lint an allow-list (`packages/*/src`, `services/*/src`, `apps/*/src`, `infra/**/*.mjs`, root config files) instead of the whole repo. Do the same for Vitest. Add a unit test or a CI-like step that puts a bad `.js` file in `x/.data/` and expects `npm run check` to pass.

### B-T1-02 — MAJOR — A new `.env` with old Docker volumes breaks the stack, and the failure shows only after about 10 minutes

- **Location:** `infra/scripts/gen-env.sh`, `infra/scripts/stack-up.sh`, `infra/compose.yaml` (Moodle health check), `infra/moodle/php/setup_users_courses.php`, `infra/README.md` "All state is inside the checkout".
- **Problem:** The Docker volumes live outside the checkout. If `.env` is lost (deleted, or a fresh clone at the same path with the same project name), `gen-env` makes a new `DB_PASS` and `MOODLE_ADMIN_PASSWORD`, but the old database keeps the old values.
- **Evidence:**
  - `gen-env.sh` makes every missing secret silently. Postgres reads `POSTGRES_PASSWORD` only when the data folder is empty, so Moodle can no longer connect to its database.
  - `stack-up.sh` waits with `--wait-timeout 900`, and the Moodle health check allows 30 s + 120 × 5 s. So the user sees "unhealthy" after about 10 minutes, with no cause and no next step.
  - "Delete the folder and clone again" is a usual way for a new developer to start fresh. The README says that the volumes are the "only exception", but no script checks for this.
  - Seed never sets the **admin** password: `setup_users_courses.php` updates only `cg_*` users, and Moodle sets `admin` only at install. `seed-json.mjs` copies `MOODLE_ADMIN_PASSWORD` from `.env`. If the two values differ, `seed.json` holds a wrong admin password and nothing warns. QA's AC-T1-12 browser test signs in as `admin` with that value.
- **Suggested fix:**
  1. In `gen-env` (or at the start of `stack-up`): if `.env` is new **and** the volume `<project>_pgdata` exists, stop with: "This checkout has a new .env, but the database volume is old. Restore the old .env, or run npm run stack:reset."
  2. Seed sets the admin password from `.env` too, so seed always repairs it.
  3. Shorten the feedback loop: Moodle starts in about 31 s, so a health budget and `--wait-timeout` of about 300 s are enough. On failure, `stack-up` prints the last 20 log lines of each unhealthy service (as `stack-restart.sh` already does).

### B-T1-03 — MINOR — Some common failures give raw Docker text or a wrong hint, and there is no "doctor" command

- **Location:** `infra/scripts/lib.sh` `require_running`, `infra/scripts/stack-up.sh`; `infra/README.md` Troubleshooting.
- **Problem:** The Lead's three common failures get uneven help.
- **Evidence (probed in a `/tmp` copy with a dead `DOCKER_HOST`):**
  - **Docker not running:** `stack:up` prints Docker's own "failed to connect to the docker API … check if the daemon is running", which is acceptable. But `seed`, both reach checks, `stack:restart` and `e2e-run.sh` print "Service 'moodle' is not healthy (status: missing). Run: npm run stack:up". The user has just run that command, so the hint points the wrong way.
  - **Port 443 busy:** there is no check before `docker compose up`. Postgres and Moodle start first, then the proxy fails with Docker's "port is already allocated", and the stack stays half up. The README fix (set `PUBLIC_PORT`) is correct, but it is in a different section.
  - **Second stack with the default subnet:** Docker prints "Pool overlaps with other one on this address space". The README says why in the QA-hooks table, but the error text does not link to it.
  - **Missing fixtures:** clear message with steps. Good.
- **Suggested fix:**
  1. Add `require_docker` to `lib.sh` (`docker info` fails → "Docker is not running. Start Docker Desktop, then run the command again.").
  2. Add a preflight in `stack-up`: the port is free or held by this project's proxy (`dc port proxy`), and the subnet is not used by another network. Each check prints the exact fix.
  3. Add `npm run stack:doctor`: Docker, `.env` and URLs, days left on the certificates, the port, container health, active knobs, both reach checks, and fixtures. One line each with OK or FIX. It then replaces the two reach-check commands in daily use.

### B-T1-04 — MINOR — Health-check requests fill the JSON logs

- **Location:** `packages/shared/src/http.ts` `createHealthServer` (one `http_request` line for each request); `infra/compose.yaml` Node health checks (`interval: 3s`).
- **Problem:** Each container health check writes one log line every 3 s for each listener. The files keep these lines across restarts until `stack:reset`.
- **Evidence:** After about 6 minutes, each `infra/.logs/*.jsonl` file has about 124 lines, and almost all are `GET /healthz` from `127.0.0.1`. That is about 29,000 lines a day for each file. A human who reads the logs, and QA's log searches (later: redaction greps, `launch_rejected`), must look through this noise.
- **Suggested fix:** Do not log `GET /healthz` from the container health check (loopback client), or log it at `debug` and add a `LOG_LEVEL` filter (default `info`). Set the Node health interval to 10 s.

### B-T1-05 — MINOR — Knobs that are not in the registry stay hidden from `/healthz`

- **Location:** `infra/scripts/stack-restart.sh` (unregistered key → warning only); `packages/shared/src/knobs.ts`; `infra/README.md` "Test knobs".
- **Problem:** `stack:restart -- <svc> --env ANY_KEY=…` changes the service, but `/healthz` still shows `knobs: []`. So the planned T7 check "every service shows no knobs" (B-T0-12) can pass while an override is active.
- **Evidence:** "A key that is not in the registry is passed on to the service with a warning, and it is not reported." Any variable can be set this way, for example `PUBLIC_LTI_URL`, `NODE_OPTIONS` or `NODE_EXTRA_CA_CERTS`. Also, the overrides stay in `.tmp/compose.knobs.yaml` for every later `stack:up`, and `stack:up` does not say that knobs are active.
- **Suggested fix:** Reject keys that are not in `KNOB_REGISTRY` (exit 2 with the list of valid knobs). If a free-form override is really needed, report it in `/healthz` as `{name, value, registered: false}`. `stack:up` prints a WARNING line for each service that has overrides in `.tmp/compose.knobs.yaml`.

### B-T1-06 — MINOR — Shared package: unclear module names and a placeholder that will become dead code

- **Location:** `packages/shared/src/http.ts`, `service.ts`, `logger.ts`.
- **Problem:** Small boundary issues that T2 will make worse if they are not fixed now.
- **Evidence:**
  - `http.ts` holds inbound server helpers: the health server, `listen`, signals, trace id, port parsing and the error body. T2 adds the outbound HTTP client with the SSRF guard to the same package (architecture README §4), so there will be two "HTTP" modules.
  - `createHealthServer` is a T1 placeholder ("T2 and T4 replace it") but lives in the shared package. When the services move to Fastify, it stays as dead code or as a second HTTP stack.
  - `closeOnSignal(servers, loggers[0])` logs `service_stopping` only for the first listener. `cogniate-content.jsonl` never gets that event, but H7 lists it as a T1 event for each service log.
  - `LogLevel` has `debug`, but the logger has no `debug()` method and no level filter (see B-T1-04).
- **Suggested fix:** Rename `http.ts` to `server.ts` (inbound). Keep the name `outbound.ts` for T2. Move the placeholder server into the two service stubs, and keep only `healthBody(service, knobs)` in shared. Log `service_stopping` for each listener. Add `debug()` and `LOG_LEVEL`.

### B-T1-07 — MINOR — Three QA checks do not match the spec

- **Location:** `tests/acceptance/lib/logs.ts` `REQUIRED_LOG_FIELDS`; `tests/acceptance/T1/harness.test.ts` (H7); `tests/acceptance/T1/tls-health.test.ts` (AC-T1-04); `tests/acceptance/lib/seed.ts`.
- **Problem:** One QA check is stricter than the spec, and two are weaker.
- **Evidence:**
  - **H7, stricter:** `REQUIRED_LOG_FIELDS` has `trace_id`, and the test asks for it on **every** line. T1.md H7 writes `trace_id?` (optional). The live `service_started` lines have no `trace_id` (one line in each file). So this test fails against an implementation that follows the spec, or the spec is unclear. The Lead must choose one rule. (The simplest rule for humans: every line has `trace_id`, and lifecycle events use one id per process start.)
  - **AC-T1-04, weaker:** the content listener case has `knobsRequired: false` ("may omit the field"). The AC requires `knobs: []` on all three hosts.
  - **H2, weaker:** `seed.ts` finds users, courses and tokens by shape (111 lines), because "the Lead fixed the content, not the key names". `infra/README.md` now defines "Stable key paths", and the promise is "later tasks never rename or remove keys". A reader by shape cannot detect a rename, so the H2 test cannot prove that promise. It is also more code than a reader by key path.
- **Suggested fix:** The Lead decides the `trace_id` rule, and the spec and the test then follow it. Require `knobs: []` for the content listener. Read `seed.json` by the documented key paths and assert each path (the test then also proves "no rename").

### B-T1-08 — MINOR — The QA host runner leaves some spec checks unproven and is hard for a new QA engineer to read

- **Location:** `tests/host/run-t1.mjs` (commit `39b3450`); `tests/acceptance/T1/harness.test.ts`.
- **Problem:** Some checks in the T1 table have no test or a test that cannot fail. The 880-line runner is one sequential script with its own small test harness.
- **Evidence (each item checked in the code):**
  - **H8:** no test checks that `ca.key` and `stack.key` are not visible in the e2e container. `git grep` for `stack.key` and `ca.key` in `tests/` at `39b3450` finds nothing. The harness test checks only that `infra/.certs` is read-only.
  - **H7:** no test reads `cogniate-content.jsonl`, and no test checks `service_stopping`, "kept across restarts" or "deleted by reset".
  - **AC-T1-05:** `acT105` accepts any output that holds `{"status":"ok"…"service":"lti-service"}`. Nothing shows that Moodle's own client made the call.
  - **Demo:** `lcDemo` looks for user names with `stdout.includes(s)`. `cg_student` also matches `cg_student2`.
  - **AC-T1-11:** `git check-ignore` runs for four paths only (`.env`, `root.crt`, `seed.json`, one log). `.env.*`, `**/.data/` and `.tmp/` are not checked.
  - **AC-T1-13:** the runner uses its own `docker exec … fetch`, not `npm run stack:node-reach-check`, which the AC names and which humans will use.
  - **Summary:** `summarize()` has no list of expected ids, so `summary.json` does not show which spec ids were never checked. (An exception still records a FAIL, so this does not hide a failure.)
  - **Ids:** the runner reports `LC-T1-03` to `LC-T1-06`, but T1.md names these checks "Demo" and "Fixtures".
  - **Duplication:** `host/lib.mjs` repeats the `seed.json` reader, the `.env` parser and the WS client of `acceptance/lib/`.
  - **Safety:** `--checkout <path>` accepts any path. The Author's `lib.sh` guard (shell vs `.env` project name) stops Docker commands against `cogniate-stack`. But the runner itself still writes its canary file and artifacts into that path.
- **Suggested fix:**
  1. Add the H8 key-visibility check and the missing H7 checks.
  2. For AC-T1-05, add a negative case that only Moodle's client can give. For example, `npm run stack:moodle-reach-check -- https://moodle.test:9/` must fail with Moodle's "The URL is blocked".
  3. Match whole words in the demo output, and run `stack:node-reach-check` as well.
  4. Put one list of expected ids from T1.md into the runner, and report each missing id as NOT RUN. Use the T1.md names.
  5. Import the shared helpers instead of copying them.
  6. Refuse `--checkout` when that checkout's `.env` has a project name that does not start with `qa-`.

### B-T1-09 — NIT — Docs disagree about which values `gen-env` writes and which subnets are allowed

- **Location:** `.env.example` ("optional, not written by gen-env"); `infra/README.md` Configuration ("Optional variables (not in `.env` by default)"); `infra/compose.yaml` and `.env.example` ("must be inside 172.16.0.0/12"); `tasks/T1.md` Scope ("blocked hosts = default minus `172.16.0.0/12`").
- **Problem:** `gen-env.sh` writes `COMPOSE_PROJECT_NAME` and `STACK_SUBNET` into `.env` (lines 38–39, and the README QA-hooks row says so). `setup_dev_network.php` accepts subnets in 10/8, 172.16/12 and 192.168/16, and it removes **only** the stack subnet from the blocked list (safer than the spec). `lib.sh` checks only the CIDR syntax.
- **Suggested fix:** Make the four texts say what the code does. Make `lib.sh` reject a subnet that the PHP will reject, so the error comes before `docker compose up`. Ask the Architect to change the T1 Scope line to "default minus the stack subnet".

### B-T1-10 — NIT — The four host names are written in four places

- **Location:** `infra/scripts/lib.sh` `require_env`, `gen-env.sh`, `gen-certs.sh` `NAMES`, `infra/compose.yaml` proxy aliases.
- **Problem:** A change of one host name needs four matching edits. The Caddyfile already reads the env values.
- **Suggested fix:** Define `STACK_HOSTS=(…)` once in `lib.sh`, and build the URLs, the SAN list and the check from it. Pass the names to compose as env values for the aliases.

### B-T1-11 — NIT — The quick start does not say how long the first run takes or how to sign in

- **Location:** `infra/README.md` Requirements and Quick start; `infra/scripts/demo.sh`, `demo-browser.sh`.
- **Problem:** A new developer does not know that the first `stack:up` downloads about 2.3 GB, or that the first test run builds a 3.6 GB e2e image. After `npm run demo`, they must open `.env` or `seed.json` to find a password.
- **Suggested fix:** Add a "First run" line with the measured times (download, first Moodle install of about 31 s, seed). Add `npm run demo:users`, which prints the user and password table from `seed.json` (dev-only values). Also write in the README that the host `node_modules` is mounted into Alpine, so service runtime dependencies must be pure JavaScript.

---

## Round 2

Round 2 verdict: **APPROVE**. No open BLOCKER or MAJOR finding from Reviewer-B.

Input: `git diff bc530a7 b82382b -- . ':!docs' ':!tests'` (28 files) and the Author's fix claims.

How I checked:

- `npm run check` in the main checkout (HEAD `b82382b`). Result: pass, 7 test files, 38 tests. NOTE: the ignored `apps/player-spike/.data/` folder is no longer there. So I proved the fix in a clean export instead.
- Clean export of `b82382b` in `/tmp`, then `npm ci`. I added broken files in five git-ignored places and ran `npm run check` again.
- Failure probes in the same export, with a fake `docker` command first in `PATH`. It records every call and never reaches the real Docker, so the Author's stack and `qa-t1-r2` were not touched. One real listener held `127.0.0.1:9443` for the busy-port case.
- Read-only look at the live `infra/.logs/lti-service.jsonl`.

### Round-1 findings: verification

| Id | Sev. | Status | Evidence |
| --- | --- | --- | --- |
| B-T1-01 | MAJOR | **Resolved** | ESLint loads `.gitignore` (`includeIgnoreFile`), and Vitest uses an allow-list (`*/src/**/*.test.ts`, excludes `**/.data/**`, `**/.tmp/**`). Probe: a syntax error in `x/.data/bad.js` and in `packages/shared/.data/bad.js`, a type error in `packages/shared/src/.data/bad.ts`, a failing test in `packages/shared/src/.data/bad.test.ts`, and a syntax error in `.tmp/bad.js` → `npm run check` exits 0 (38 tests). |
| B-T1-02 | MAJOR | **Resolved** (one small gap: B-T1-12) | Probe "no `.env` + volumes `rb-probe_pgdata`, `rb-probe_moodledata`": `stack:up` stops at once with "This checkout has no .env, but project 'rb-probe' still has Docker volumes … Fix: restore the old .env, or … npm run stack:reset". `.env` is not written, and `compose up` is not called. Seed now sends the admin password (`seed.sh` step 3). `stack:up` waits ≤ 300 s, prints the last 20 log lines of each unhealthy service, and names `stack:reset`. `stack:reset` works without `.env` (removes the project by its Docker labels). |
| B-T1-03 | MINOR | Resolved for Docker down and busy port; the rest is deferred | Docker down: `stack:up` and `seed` print "Docker is not running. Start Docker Desktop …", with no `compose up`. Busy port: "Port 9443 on 127.0.0.1 is busy … edit PUBLIC_PORT in .env …", before any container starts. The project's own proxy on the port is allowed (`dc port proxy`). Deferred: subnet preflight and `stack:doctor`. |
| B-T1-04 | MINOR | Resolved | `/healthz` is logged at `debug`. `LOG_LEVEL` (default `info`) filters it. The live `lti-service.jsonl` has 0 `/healthz` lines. `service_started` has `trace_id: "boot-…"` (Lead rule). |
| B-T1-05 | MINOR | Resolved | `stack:restart -- lti-service --env NODE_OPTIONS=…` → "NODE_OPTIONS is not a registered knob of lti-service. Valid knobs of lti-service: LTIK_TTL_SECONDS." A registered knob for the wrong service is also refused. `compose up` is not called in either case. `stack:up` and `seed` print a CAUTION while `.tmp/compose.knobs.yaml` has knobs. |
| B-T1-06 | MINOR | Partly resolved; the rest is deferred | `service_stopping` is now logged for each listener. `debug()` and `LOG_LEVEL` exist. Deferred: the file renames. ADR-008 (T0 round 3) already maps `http.ts` and `service.ts` to the `server` module. |
| B-T1-07, B-T1-08 | MINOR | Not an Author item | These findings are about QA-owned files. The Lead kept QA's H7 `trace_id` rule. The Lead routes the rest to QA. They do not block T1. |
| B-T1-09 | NIT | Partly resolved | `.env.example` and the `STACK_SUBNET` text are now correct. Open: `infra/README.md` Configuration still says "Optional variables (not in `.env` by default)" for `COMPOSE_PROJECT_NAME` and `STACK_SUBNET`, but `gen-env.sh` writes both (lines 49–50). `lib.sh` still checks only the CIDR syntax. |
| B-T1-10 | NIT | Deferred | Host names are in several places. |
| B-T1-11 | NIT | Deferred | First-run times and `demo:users`. |

**Deferrals:** I accept all of them. The Docker-down and busy-port messages cover the common cases. Subnet overlap happens only with parallel stacks, and the README documents it. The renames fit naturally into T2a, when the `outbound` module comes: please make `outbound.ts` a new file, not part of `http.ts`. AC-T9-01 (T9) covers the first-run guidance. The Lead lists B-T1-03 (rest), B-T1-06 (renames), B-T1-09 (rest), B-T1-10 and B-T1-11 in `docs/human_review/deferred.md`.

### B-T1-12 — MINOR — `npm run demo` (or `gen-env`) with Docker stopped skips the old-volume guard

- **Location:** `infra/scripts/gen-env.sh` (the guard runs only when `docker info` succeeds); `infra/scripts/demo.sh` (it runs `gen-env.sh` before `stack-up.sh`).
- **Problem:** If Docker is not running, `gen-env` writes a new `.env` without the volume check. When Docker runs again, `.env` exists, so the guard never runs, and the old B-T1-02 failure comes back (now after ≤ 300 s, with logs and a hint).
- **Evidence:** Probe with Docker "down" and no `.env`: `bash infra/scripts/gen-env.sh` → "Wrote …/.env (mode 600)". `demo.sh` lines 8–10 run `gen-env.sh`, then `build`, then `stack-up.sh`, so `require_docker` in `stack-up.sh` comes too late.
- **Suggested fix:** Call `require_docker` at the start of `demo.sh`. In `gen-env.sh`, refuse to make a **new** `.env` when Docker is not reachable ("Start Docker first, so gen-env can check for old data"). Updating an existing `.env` can stay possible without Docker.
