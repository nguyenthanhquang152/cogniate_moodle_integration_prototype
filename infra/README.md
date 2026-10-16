# Local stack (infra)

The local stack is a copy of production in Docker: Moodle 5.2.4 behind TLS, four host names on three sites, and the two Node services. Design: `docs/architecture/README.md` §10 and ADR-005.

| Host name (`.env`) | Container | Site (for cookies) |
| --- | --- | --- |
| `PUBLIC_MOODLE_URL` = `https://moodle.test` | `moodle:8080` (Moodle 5.2.4, PostgreSQL 16) | `moodle.test` |
| `PUBLIC_LTI_URL` = `https://lti.cogniate.test` | `lti-service:4100` | `cogniate.test` |
| `PUBLIC_APP_URL` = `https://app.cogniate.test` | `cogniate-app:4200` | `cogniate.test` |
| `PUBLIC_CONTENT_URL` = `https://content.cogniate-content.test` | `cogniate-app:4201` | `cogniate-content.test` |

Only the proxy (Caddy) publishes a port: `127.0.0.1:443`. Moodle 8080 and PostgreSQL 5432 are not published.

## Requirements

- Docker Desktop (about 4 GB free memory is enough), Node 24, npm, `openssl`, `bash`.
- Images (pulled by the first `stack:up`): `erseco/alpine-moodle:v5.2.4`, `postgres:16-alpine`, `caddy:2.11.7-alpine`, `node:24.22.0-alpine3.24`. The test image `cogniate-stack-e2e:1.56.0` is built from `mcr.microsoft.com/playwright:v1.56.0-noble`.

## Quick start

```sh
npm ci
npm run demo            # gen-env, build, stack:up, seed. Prints the URLs and user names.
npm run demo:browser    # opens a throwaway Chrome profile that can reach the stack
```

The passwords are in `.env` and in `infra/.secrets/seed.json`.

## Commands

All commands run from the repo root.

| Command | When to use it | Deletes | Keeps |
| --- | --- | --- | --- |
| `npm run gen-env` | First run, or after you change `PUBLIC_PORT`. `stack:up` runs it for you. | nothing | Existing secrets. It adds missing secrets, writes the four URLs, and makes `infra/.certs/` if missing. |
| `npm run stack:up` | Start the stack. It waits until every service is healthy. | nothing | everything |
| `npm run seed` | After `stack:up`. You can run it again at any time (idempotent). | nothing | everything. It updates Moodle settings, users, courses and tokens, makes the LTI tool accounts `cogniate` and `qa-second` (API keys in `infra/.secrets/lti-api-key.<account>`), and rewrites `infra/.secrets/seed.json` (other keys, such as `ltiSeed`, are kept). |
| `npm run seed:lti-manual` | After `seed`: a launchable dev setup without UI. Idempotent. | nothing | everything. Makes the Moodle tool "Cogniate (seed)", the activities "Seed activity" (101) and "Seed activity 102" (102), registers the platform in the LTI service (`POST /api/platforms`; a deleted platform is made again), and writes `ltiSeed` to `seed.json`. |
| `npm run lti:bootstrap -w services/lti-service -- --account <id> --name <name> [--rotate-api-key] [--rotate-signing-key]` | Make or update one LTI tool account (contract §7). | nothing (a rotated key replaces the old key) | everything. A new or rotated API key is printed once and written to `infra/.secrets/lti-api-key.<account>` (mode 600). |
| `npm run demo` | One command for a human demo: `npm ci` (if needed), gen-env, build, stack:up, seed. | nothing | everything |
| `npm run demo:browser` | Look at the stack in Chrome without any change to your Mac. | nothing | A throwaway profile in `.tmp/demo-browser-profile` (delete it any time). |
| `npm run stack:down` | Stop the containers. | containers | volumes (Moodle site, database), `.env`, certificates, `infra/.secrets`, `infra/.logs` |
| `npm run stack:reset` | Start again with an empty Moodle site and an empty LTI service. Then run `stack:up`, `seed` and `seed:lti-manual`. | volumes (Moodle site, database), the LTI service database (`infra/.data/lti-service/`), `infra/.secrets/seed.json`, `infra/.secrets/lti-api-key.*`, `infra/.logs/`, `infra/.data/backups/`, test knobs | `.env` (same passwords), `infra/.certs/` (same CA), `infra/.data/fixtures/`. It refuses a project that belongs to another checkout, and without `.env` it needs an explicit `COMPOSE_PROJECT_NAME`. |
| `npm run stack:restart -- <service> [--env K=V ...]` | Restart one service with test knobs (registered knobs only). Without `--env`, the defaults come back. | The knobs of that service (when you restore the defaults) | everything else |
| `npm run stack:logs [-- <service>...]` | Follow the container logs. | nothing | everything |
| `npm run stack:moodle-reach-check` | Check that Moodle's own HTTP client reaches the LTI service (curl security + CA), and that seven other targets stay BLOCKED. Host rule (https, port 443): metadata IP, loopback, `10.0.0.0/8`, the Docker Desktop host, another Docker range. Port rule: port 80, the database port. Exit 1 if one is ALLOWED. | nothing | everything |
| `npm run stack:node-reach-check` | Check that `lti-service` and `cogniate-app` reach Moodle over HTTPS (Node trusts the CA). | nothing | everything |
| `npm run fixtures:check` | Check the two course zips (they are not in git). | nothing | everything |
| `npm run test:acceptance` / `npm run test:e2e` | Run the QA suites in the e2e container. | `tests/node_modules` (`npm ci`) | everything else |
| `npm run check` | Lint, type check and unit tests (on the host). | nothing | everything |

Advanced helpers in `infra/scripts/`:

- `moodle-php.sh <script|-r code>`: run PHP in the Moodle container as `nobody`.
- `moodle-cfg.sh --name=X [--set=Y]`: read or set a Moodle setting with `admin/cli/cfg.php`.
- `e2e-run.sh <command>`: run a command in the e2e container. Example: `infra/scripts/e2e-run.sh node infra/e2e/smoke.mjs`.
- `stage-fixture.sh <zip> <name.zip>`: copy a zip to `infra/.data/fixtures/` for Moodle.
- `moodle-backup.sh <courseid> [--nousers]`: make an `.mbz` in `infra/.data/backups/`.

## Configuration

- `.env` (made by `npm run gen-env`, mode 600, git-ignored) has two parts:
  - Generated secrets: database password, Moodle passwords, and master keys.
  - Public config: `PUBLIC_PORT` and the four `PUBLIC_*_URL` values.
- The four URLs are the only source of public URLs. Compose passes them to every container. Code reads them with `loadPublicUrls()` from `@cogniate/shared`. Do not write URL literals in code.
- To change the port: set `PUBLIC_PORT=8443` in `.env`, run `npm run gen-env`, then `npm run stack:up`. Every URL then ends in `:8443`, and seed adds the port to Moodle's allowed ports.
- Optional variables (not in `.env` by default):
  - `COMPOSE_PROJECT_NAME`: default `cogniate-stack`. Use another name for a second checkout (for example a QA clone). Volume names use it.
  - `STACK_SUBNET`: default `172.28.0.0/16`. It must be inside a private range of Moodle's default blocked list (`10.0.0.0/8`, `172.16.0.0/12` or `192.168.0.0/16`); seed cuts only this subnet out of that list.
  - `COURSE_FIXTURES_DIR`: default `docs/raw/data/courses`.

All state is inside the checkout: `.env`, `infra/.certs/`, `infra/.secrets/`, `infra/.logs/`, `infra/.data/`, `.tmp/`. The only exception is the Docker volumes `<project>_pgdata` and `<project>_moodledata`.

## TLS and trust

`npm run gen-env` runs `infra/scripts/gen-certs.sh` before any container starts:

| File | What | Who uses it |
| --- | --- | --- |
| `infra/.certs/ca.key` | Dev CA private key (mode 600) | Only `gen-certs.sh`. It is never mounted into a container. |
| `infra/.certs/root.crt` | Dev CA certificate: 365 days, `nameConstraints = critical, permitted;DNS:test` (it can sign only `.test` names) | Moodle (`seed` writes `moodledata/moodleorgca.crt` = Alpine CA bundle + this root), Node (`NODE_EXTRA_CA_CERTS=/certs/root.crt`), Playwright Chromium (NSS database, `infra/e2e/entrypoint.sh`) |
| `infra/.certs/stack.crt`, `stack.key` | One leaf certificate, SAN = the four host names, 90 days, never after the CA end date | The proxy only |

`stack:reset` does not delete `infra/.certs/`. `gen-certs.sh` makes a new leaf only if the leaf is missing, expires in less than 30 days, or does not match the names or the CA. To start a new CA, delete `infra/.certs/` and run `npm run gen-env`.

In the e2e container, only the browser (NSS) and Node trust the CA. `curl` does not, so `curl https://moodle.test` fails and `curl --cacert /certs/root.crt https://moodle.test` works.

## Your own browser

`npm run demo:browser` starts Chrome with a new profile in `.tmp/demo-browser-profile`. It uses two flags:

- `--host-resolver-rules="MAP *.test 127.0.0.1, MAP *.cogniate-content.test 127.0.0.1"`: the stack names resolve to 127.0.0.1 in this browser only.
- `--ignore-certificate-errors-spki-list=<hash of the stack leaf key>`: this browser accepts only our leaf certificate. Other certificate errors still show.

Nothing changes on your Mac. Set `CHROME_BIN=/path/to/chrome` if Chrome is not in `/Applications`.

For your daily browser (optional, not needed for tests):

1. Add `127.0.0.1 moodle.test lti.cogniate.test app.cogniate.test content.cogniate-content.test` to `/etc/hosts`.
2. Optional: trust `infra/.certs/root.crt` in the login keychain.

CAUTION: A trusted root lets every certificate signed by `infra/.certs/ca.key` pass on your Mac. The name constraint limits this to `.test` names: a certificate for any other name (for example `example.com`) fails, even with the trust. Keep `ca.key` private anyway, and remove the trust when you finish. When `gen-certs.sh` makes a new CA (old CA without the constraint, or less than 30 days left), it prints a CAUTION: trust the new `root.crt` again.

## Moodle provisioning (`npm run seed`)

| Item | Value |
| --- | --- |
| Users | `admin` (from the image, password `MOODLE_ADMIN_PASSWORD`), `cg_teacher`, `cg_student`, `cg_student2` (manual auth) |
| Courses | `COGNIATE-DEV-101` and `COGNIATE-DEV-102`, completion tracking on. In both: `cg_teacher` = editingteacher, `cg_student` and `cg_student2` = student. |
| Product WS service | `cogniate_integration`, user `cogniate_integration`, 9 functions: `core_webservice_get_site_info`, `core_course_create_courses`, `core_course_get_courses_by_field`, `core_course_get_contents`, `core_course_get_categories`, `core_course_create_categories`, `enrol_manual_enrol_users`, `core_user_create_users`, `core_user_get_users_by_field` |
| QA oracle WS service | `cogniate_qa_oracle`. **Dev/test only. Never configure it on a real site.** User `cogniate_qa_oracle`, role = manager archetype + `webservice/rest:use`. Functions: `gradereport_user_get_grade_items`, `core_completion_get_activities_completion_status`, `core_enrol_get_enrolled_users`, `core_course_get_contents`, `core_course_get_courses_by_field`, `core_course_update_courses` |
| CA trust | `moodledata/moodleorgca.crt` = Alpine CA bundle + `root.crt` |
| Dev-only network settings | `curlsecurityblockedhosts` = the Moodle default list with only `STACK_SUBNET` cut out (`172.16.0.0/12` is split around it; every other entry stays). `curlsecurityallowedport` = `443` (+ `PUBLIC_PORT`), so port 80 is closed. `noemailever` = 1. `stack:moodle-reach-check` proves the rules. MoodleCloud does not need these settings. |
| WS file access | Both services have `downloadfiles = 0` and `uploadfiles = 0`: a token cannot read or upload files through `webservice/pluginfile.php`. |
| Admin password | Seed sets the `admin` password from `.env` on every run. |

### `infra/.secrets/seed.json`

Mode 600 and git-ignored. Format `cogniate-seed/1`. Later tasks add keys. They do not rename or remove keys.

```json
{
  "format": "cogniate-seed/1",
  "generatedAt": "2026-10-16T13:20:00.000Z",
  "urls": { "moodle": "https://moodle.test", "lti": "https://lti.cogniate.test", "app": "https://app.cogniate.test", "content": "https://content.cogniate-content.test" },
  "moodle": {
    "users": {
      "admin":       { "username": "admin",       "password": "<from .env>", "id": 2 },
      "cg_teacher":  { "username": "cg_teacher",  "password": "<from .env>", "id": 4 },
      "cg_student":  { "username": "cg_student",  "password": "<from .env>", "id": 5 },
      "cg_student2": { "username": "cg_student2", "password": "<from .env>", "id": 6 }
    },
    "courses": { "COGNIATE-DEV-101": 2, "COGNIATE-DEV-102": 3 },
    "ws": {
      "product":   { "service": "cogniate_integration", "username": "cogniate_integration", "userid": 3, "token": "<32 hex>", "functions": ["..."] },
      "qa_oracle": { "service": "cogniate_qa_oracle",   "username": "cogniate_qa_oracle",   "userid": 7, "token": "<32 hex>", "functions": ["..."] }
    }
  },
  "lti": { "apiKeyFiles": { "cogniate": "infra/.secrets/lti-api-key.cogniate", "qa-second": "infra/.secrets/lti-api-key.qa-second" } },
  "ltiSeed": { "typeId": 1, "clientId": "<Moodle client id>", "deploymentId": "1", "cmids": { "COGNIATE-DEV-101": 3, "COGNIATE-DEV-102": 4 }, "platformId": "plt_..." }
}
```

The ids are examples. Always read them from the file.

Stable key paths (later tasks only add keys):

| Key path | Type | Value |
| --- | --- | --- |
| `format` | string | `cogniate-seed/1` |
| `generatedAt` | string | ISO 8601 time of the last seed |
| `urls.moodle`, `urls.lti`, `urls.app`, `urls.content` | string | the four `PUBLIC_*_URL` values |
| `moodle.users.<username>.username` | string | `admin`, `cg_teacher`, `cg_student`, `cg_student2` (the key is the user name) |
| `moodle.users.<username>.password` | string | password from `.env` |
| `moodle.users.<username>.id` | number | Moodle user id |
| `moodle.courses.<shortname>` | number | course id, for `COGNIATE-DEV-101` and `COGNIATE-DEV-102` |
| `moodle.ws.product.service` | string | `cogniate_integration` |
| `moodle.ws.product.username`, `.userid` | string, number | `cogniate_integration` and its id |
| `moodle.ws.product.token` | string | permanent REST token (32 hex) |
| `moodle.ws.product.functions` | string[] | the 9 function names |
| `moodle.ws.qa_oracle.service`, `.username`, `.userid`, `.token`, `.functions` | as above | `cogniate_qa_oracle`, its user, token and 6 function names |
| `lti.apiKeyFiles.<account>` | string | repo-relative path of the API key file of the LTI tool account (`cogniate`, `qa-second`); the file holds one line `ltis_…` |
| `ltiSeed.typeId` | number | Moodle tool type id of "Cogniate (seed)" (written by `seed:lti-manual`) |
| `ltiSeed.clientId`, `ltiSeed.deploymentId` | string | Moodle client id and deployment id (= type id) of that tool |
| `ltiSeed.cmids.<course shortname>` | number | course module id of "Seed activity" (`COGNIATE-DEV-101`) and "Seed activity 102" (`COGNIATE-DEV-102`) |
| `ltiSeed.platformId` | string | id of the platform in the LTI service (`plt_…`) |

## QA hooks

| Hook | How |
| --- | --- |
| Separate checkout (parallel stack) | Clone into a new folder. On the first command set the identity, for example `COMPOSE_PROJECT_NAME=qa-t1-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 npm run stack:up`. `gen-env` saves the three values in that checkout's `.env`; later commands need no variables. A shell value that differs from `.env` stops the command (so it never touches the other stack). Containers, volumes and the network get the project name as prefix. Two stacks run at the same time if their `PUBLIC_PORT` and `STACK_SUBNET` differ. Each checkout has its own CA. |
| Seed data | `infra/.secrets/seed.json` (above) |
| Test knobs | See "Test knobs" below. |
| Logs | `infra/.logs/<service>.jsonl` (`lti-service`, `cogniate-app`, `cogniate-content`), mode 700 (the Node services run as the host user). One JSON object per line: `{ts, level, service, event, trace_id, ...}`. Every line has `trace_id`: request lines use the request trace id (or the caller's `x-trace-id`); lifecycle lines use one boot trace id per process (`boot-<12 hex>`). T1 events: `service_started`, `test_knob_active`, `http_request {method, path, status, ms}`, `service_stopping` (one per listener). `/healthz` requests are logged only at `LOG_LEVEL=debug` (default `info`), so the health checks do not fill the files. Paths have no query string, and token-like path segments show as `:redacted`. Secret keys (any spelling, any depth) and secret-looking values (JWT, `Bearer`, `ltik=`) are redacted. Kept across restarts. `stack:reset` deletes them. |
| e2e container | Image `<project>-e2e:1.56.0` (Playwright 1.56.0). Repo at `/repo`, **read-only**. `/repo/.env` is the public part of `.env` only (`.tmp/public.env`: project, subnet, port, the four URLs; no secret). `infra/.secrets` and `infra/.logs` are read-only. `infra/.certs` shows only `root.crt` and `stack.crt` (no keys). Writable: `tests/acceptance/artifacts`, `tests/e2e/artifacts`, `tests/test-results`, `tests/playwright-report`, `tests/.tmp`, and `/repo/tests/node_modules` (a Docker volume with the Linux install, so it does not replace the host's `tests/node_modules`). `NODE_EXTRA_CA_CERTS=/certs/root.crt`. Chromium trusts the CA through NSS. The four `PUBLIC_*_URL` variables are set. |
| QA suites | `tests/` is a separate npm project owned by QA (with `tests/package-lock.json`). `npm run test:acceptance -- <args>` runs `npm ci --prefix tests && npm --prefix tests run acceptance -- <args>` in the e2e container. `test:e2e` runs the `e2e` script the same way. If `tests/package.json` is missing, the command stops with a message. |
| QA env (H14) | Every `QA_*` variable of the caller reaches the e2e container (name only on the command line; the value comes from the environment), for `test:acceptance`, `test:e2e` and `infra/scripts/e2e-run.sh`. |
| Knobs and `stack:up` | A knob set with `stack:restart --env` stays active through a later `stack:up` (the override file is part of every compose command), until `stack:restart -- <service>` without `--env` or `stack:reset` (Q-T0-43). |

## LTI service

| Item | Value |
| --- | --- |
| Code | `services/lti-service` (Fastify, `jose`, Zod, `node:sqlite`). Contract: `docs/architecture/contracts/lti-service-api.md`. |
| Database | `infra/.data/lti-service/lti.db` (SQLite, plain SQL migrations in `src/db/migrations/` at start). `stack:reset` deletes it. |
| Tool keys | One RSA 2048 key per tool account (RS256). The private JWK is encrypted with `LTI_MASTER_KEY` (AES-256-GCM). Public keys: `{PUBLIC_LTI_URL}/lti/keys/<account>`. |
| Outbound calls | Only through the guarded client in `packages/shared/src/outbound.ts` (https only, no redirects, 5 s, 1 MB, private IPs blocked inside the connection lookup). Allowlist: `OUTBOUND_PRIVATE_HOST_ALLOWLIST=moodle.test` (compose). Every call logs `outbound_request` or `outbound_blocked`. |
| Moodle URLs for a manual tool | Login `{PUBLIC_LTI_URL}/lti/login/cogniate`, redirect and tool URL `{PUBLIC_LTI_URL}/lti/launch/cogniate`, keyset `{PUBLIC_LTI_URL}/lti/keys/cogniate`. |
| Author smoke check | `infra/scripts/e2e-run.sh node infra/e2e/lti-launch-smoke.mjs [cg_student] [--via=view|launch]`: a real Moodle launch of "Seed activity", then `GET /api/idtoken` (prints no secret). |

## Test knobs

The registry is `KNOB_REGISTRY` in `packages/shared/src/knobs.ts`. Later tasks add knobs there and nowhere else.

| Knob | Service | Default | Range | Used by |
| --- | --- | --- | --- | --- |
| `LTIK_TTL_SECONDS` | `lti-service` | `86400` (24 h, contract) | 1 to 2,592,000 | ltik lifetime (T2, AC-T2-07) |
| `REF_TTL_SECONDS` | `cogniate-app` | `86400` (24 h, contract `cogniate-app-api.md`) | 1 to 2,592,000 | registration URL `ref` token lifetime (T4, AC-T4-09) |

- Set: `npm run stack:restart -- lti-service --env LTIK_TTL_SECONDS=5`.
- Restore the defaults: `npm run stack:restart -- lti-service` (no `--env`).
- Active knob = env value set and different from the default. At start, the service logs one `test_knob_active {name, value}` line per active knob. `GET /healthz` returns `"knobs":[{"name":"LTIK_TTL_SECONDS","value":"5"}]`. With the defaults, `"knobs":[]`. `value` is the string you set.
- Every listener of a process reports the knobs of its compose service. So `cogniate-content` (same process as `cogniate-app`) also lists `REF_TTL_SECONDS`.
- A value that is not a whole number in the range stops the service. `stack:restart` then prints the error and the restore command.
- A key that is not a registered knob of that service is refused (exit 2, with the list of valid knobs). So `/healthz` always shows every override.
- While overrides exist, `stack:up`, `seed`, `test:acceptance` and `test:e2e` print a CAUTION line.
- The overrides are kept in `.tmp/compose.knobs.yaml` until you restore the defaults or run `stack:reset`.

## Course fixtures

The two Cogniate exports are not in git. Their SHA-256 values are in `infra/fixtures/courses.sha256`. `npm run fixtures:check` compares the files in `COURSE_FIXTURES_DIR` (default `docs/raw/data/courses`). If a file is missing, it prints how to get it. Treat the zips as untrusted data: `stage-fixture.sh` copies a zip into an emptied folder that is mounted read-only in Moodle.

## Troubleshooting

- CAUTION for browser tests: on the Moodle login page, `core/togglesensitive` (setting `loginpasswordtoggle`, default on) re-creates the password field when its JavaScript starts. A value typed before that is lost, and the login fails with "Your login info may be incorrect" (about 1 run in 3 in Playwright). Wait for `.toggle-sensitive-wrapper #password` before you type. `infra/e2e/smoke.mjs` shows the pattern.

- `PUBLIC_* ... expected ...`: you changed `PUBLIC_PORT`. Run `npm run gen-env`.
- `Docker is not running`: start Docker Desktop, wait until it is ready, then run the command again.
- `Port 443 on 127.0.0.1 is busy`: stop the other program, or set `PUBLIC_PORT` in `.env` (see Configuration), run `npm run gen-env`, then `npm run stack:up`.
- `This checkout has no .env, but project ... still has Docker volumes`: a new `.env` has new passwords that do not match the old database. Restore the old `.env`, or run `npm run stack:reset` (it also works without `.env`).
- `The stack is not healthy`: `stack:up` waits at most 300 s, then prints the last log lines of each unhealthy service. A first Moodle install takes about 30 s. More: `npm run stack:logs -- moodle`.
- On Docker Desktop, `lsof` shows the Docker process on `*:443`. A connection from another machine still fails, because Docker forwards only `127.0.0.1:443` to the proxy.

## History

T1-spike (2026-10-16): `infra/moodle/SPIKE-NOTES.md` has the spike facts and evidence. That stack ran on `http://localhost:8080` with a socat sidecar. T1 replaced it with this HTTPS stack, so the spike commands in those notes no longer exist.
