Verdict: PASS
Round: 1

# T1 QA verification

| Item | Value |
| --- | --- |
| SHA | `ef9faebbacad1a1435e5faa5076e4e773d2b684b` (T1 code `bc530a7`, QA tests `39b3450`) |
| Tests used | `39b3450` plus QA-side fixes made in this round (see "QA-side changes"). Diff: `E/tests-diff-vs-sha.txt` |
| Date | 2026-10-16 |
| Runner | `COMPOSE_PROJECT_NAME=qa-t1-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 COURSE_FIXTURES_DIR=<repo>/docs/raw/data/courses node tests/host/run-t1.mjs --sha ef9faeb… --replace-tests` |
| Clean environment | New clone `~/cogniate-qa-runs/qa-t1-r1-ef9faebb-2026-10-16T13-49-02-046Z`. No `node_modules`, `.env`, `infra/.certs`, `infra/.secrets` or `infra/.logs` at start. No volumes of `qa-t1-r1` at start. |
| Isolation | The QA stack ran next to the Author's stack (`cogniate-stack`, 127.0.0.1:443). None of the 5 Author containers stopped or restarted during the run. At the end the QA stack had 0 containers, 0 volumes and 0 networks left. |
| Tools | macOS host: Node 24.21.0, Docker 29.8.2, Compose 5.5.1. e2e image: Playwright 1.56.0 (Chromium), Node 22.20. |
| Evidence root | `E` = `tests/host/artifacts/qa-t1-r1-ef9faebb-2026-10-16T13-49-02-046Z/` (git-ignored, local; known secret values are redacted). `E/summary.json` has every result with notes. |

The in-container suite ran twice: pass 1 on the first stack, pass 2 after `stack:reset`. Both passes gave the same results: 28 passed, 3 failed (H7 ×2, H8 ×1).

## 1. Results per acceptance criterion

| AC | Result | What QA saw | Evidence |
| --- | --- | --- | --- |
| AC-T1-01 | PASS | Fresh clone: `npm ci` (138 packages) and `npm run check` (ESLint, `tsc` for 3 workspaces, 32 unit tests) exit 0. | `E/cmd/03-root-npm-ci.log`, `E/cmd/04-root-check.log` |
| AC-T1-02 | PASS | No stack volumes. `stack:up` + `seed` exit 0 in 31 s (images pulled before). The output prints the four URLs. | `E/cmd/12-compose-pull.log`, `E/cmd/14-stack-up.log`, `E/cmd/15-seed-1.log` |
| AC-T1-03 | PASS | From `e2e`: `/login/index.php` 200 with `form#login`. TLS verifies with `root.crt` (Node and `curl --cacert` → 200). With public roots only: Node certificate error, curl exit 60. Chromium trusts the CA (`ignoreHTTPSErrors` off). | `E/container-pass1/vitest-results.json`, `E/container-pass2/…` |
| AC-T1-04 | PASS | `/healthz` of lti-service, cogniate-app and cogniate-content: 200 JSON, `status: "ok"`, correct service names, `knobs: []`. | same |
| AC-T1-05 | PASS | `stack:moodle-reach-check` prints `{"status":"ok","service":"lti-service","knobs":[]}`. | `E/cmd/16-moodle-reach-check.log` |
| AC-T1-06 | PASS | Product token: `release` 5.2.x, `siteurl` = `https://moodle.test:8443`, all 9 functions, no oracle-only function. Unknown token → `invalidtoken`. | `E/container-pass1/vitest-results.json` |
| AC-T1-07 | PASS | `cg_teacher` signs in. `MoodleSession`: `Secure=true` (also `HttpOnly`, `SameSite=Lax`). A wrong password shows `#loginerrormessage`. | `E/container-pass1/playwright/T1-moodle-login-*/cg_teacher-signed-in.png`, `trace.zip` |
| AC-T1-08 | PASS | `COGNIATE-DEV-101` and `-102` exist once, ids = `seed.json`, `enablecompletion=1`. `cg_teacher` = editingteacher; `cg_student`, `cg_student2` = student (QA oracle WS). | `E/container-pass1/vitest-results.json` |
| AC-T1-09 | PASS | Exactly one binding: `proxy 127.0.0.1:8443->8443/tcp` (PUBLIC_PORT 8443). Moodle 8080 and Postgres 5432 are not published. | `E/summary.json` (AC-T1-09), `E/images.json` |
| AC-T1-10 | PASS | QA made a marker course, then reset → up → seed (33 s). Marker gone. Only the site course, 101 and 102 exist. `root.crt` and `.env` unchanged. All four users sign in with the `.env` passwords (`testsession` = `seed.json` id). Pass 2 of the suite on the new site = pass 1. | `E/cmd/27-stack-reset.log` … `29-seed-after-reset.log`, `E/container-pass2/` |
| AC-T1-11 | PASS | 15 in-scope secret values (Lead scope): none is in a tracked file of HEAD. `.env`, `infra/.certs`, `infra/.secrets`, `infra/.logs` are ignored and not tracked. `.env.example` secret keys are empty. `.env` mode 600. The values differ from the workspace `.env` (random). | `E/summary.json` (AC-T1-11, GEN-ENV) |
| AC-T1-12 | PASS | `seed` ran three times (seed, seed, demo): exit 0, `seed.json` unchanged. Each user is enrolled once with unique roles. Manage tokens: 2 tokens, no duplicate (user, service) pair. Each service is listed once on External services. | `E/cmd/19-seed-2.log`, `E/cmd/20-demo.log`, `E/container-pass1/playwright/T1-moodle-admin-*/manage-tokens.png`, `external-services.png` |
| AC-T1-13 | PASS | First run and after reset: `fetch('https://moodle.test:8443/login/index.php')` in lti-service and cogniate-app → 200, no redirect. | `E/cmd/17…`, `18…`, `30…`, `31…` |

### Lead-approved changes (not yet in T1.md)

| ID | Change | Result | Evidence |
| --- | --- | --- | --- |
| LC-T1-01 | `gen-env` makes the CA and one leaf cert before containers start; `stack:reset` keeps them | PASS: `root.crt` (CA) and `stack.crt` (SAN with the four names, signed by the root), with 0 project containers. The served certs verify. `root.crt` SHA-256 is the same after reset. | `E/cmd/11-gen-env.log`, `E/summary.json` |
| LC-T1-02 | Public URLs from `PUBLIC_*_URL` in `.env` | PASS: four https URLs with `:8443`. | `E/summary.json` |
| LC-T1-03 | `npm run demo` | PASS: exit 0 on a running stack. It prints the four URLs and the four user names. | `E/cmd/20-demo.log` |
| LC-T1-04 | `npm run demo:browser` | **Not verified by QA** (Lead decision: it opens a Chrome window). The script exists. | `E/cmd/21-npm-run-list.log` |
| LC-T1-05 | `infra/README.md` command table | PASS: one table lists all 13 commands. | `E/summary.json` |
| LC-T1-06 | `npm run fixtures:check` | PASS: exit 0 for the real zips and for a copy; exit 1 for a changed byte and for a missing zip. The QA SHA-256 values match. | `E/cmd/07…` to `10…` |

### Test hooks

| Hook | Result | Evidence |
| --- | --- | --- |
| H1 `COMPOSE_PROJECT_NAME`, `PUBLIC_PORT`, `STACK_SUBNET` from env | PASS: five services under `qa-t1-r1` on `172.29.0.0/16`. Compose resolves the QA project name before `stack:up`. | `E/cmd/13-compose-config-name.log`, `E/summary.json` |
| H2 `infra/.secrets/seed.json` | PASS: all users, course ids and both tokens. The ids match Moodle (WS and login). | `E/container-pass1/vitest-results.json` |
| H3 `stack:restart --env` | PASS: `LTIK_TTL_SECONDS=600` and `REF_TTL_SECONDS=600` show in `/healthz` `knobs` and in a `test_knob_active` log line. A restart without `--env` gives `knobs: []` again. | `E/cmd/22…` to `25…` |
| H4 QA oracle WS service | PASS: the oracle token can call all 6 oracle functions. The product token gets `accessexception` for the 4 oracle-only functions. | `E/container-pass1/vitest-results.json` |
| H7 JSON logs | **FAIL** (Q-T1-02): `http_request` lines are correct (with `trace_id`). Lifecycle lines have no `trace_id`. | `E/service-logs/*.jsonl`, vitest results |
| H8 test harness | **FAIL in part** (Q-T1-01): `tests/` is not a root workspace (PASS). A failing canary file in `tests/` does not break `npm run check` (PASS). `NODE_EXTRA_CA_CERTS` = `root.crt` (PASS). `.secrets` and `.logs` are read-only (PASS). `.certs` is writable (FAIL). | `E/cmd/05…`, `E/cmd/06…`, vitest results |

## 2. Findings

### Q-T1-01 MINOR: `infra/.certs` is writable in the e2e container

- Where: `infra/compose.yaml`, service `e2e`, volume for `infra/.certs` (black-box: line not known).
- Problem: approved hook H8 says the e2e container mounts `infra/.certs` read-only. A test can write to it.
- Evidence: `E/container-pass1/vitest-results.json`: "/repo/infra/.certs must not be writable: expected true to be false". The same happened in pass 2 and in runs 1 and 2. `.secrets` and `.logs` are read-only.
- Fix: add `:ro` to the `infra/.certs` mount of `e2e`.

### Q-T1-02 MINOR: lifecycle log lines have no `trace_id` field

- Where: lti-service and cogniate-app logger (`infra/.logs/<service>.jsonl`).
- Problem: approved hook H7 lists `trace_id` as a field of every line. `service_started` and `service_stopping` lines do not have it.
- Evidence: in run 3, each file has 1 `service_started` and 1 `service_stopping` without `trace_id`. All `http_request` lines have a string `trace_id`. Example (lti-service, line 1): `{"ts":…,"level":"info","service":"lti-service","event":"service_started","port":4100,"public_url":…,"node":"v24.22.0"}`.
- Fix: write `"trace_id": null` on lines with no request, or the Lead changes H7 to "request lines only". The QA test then changes to match.

### Q-T1-03 MINOR: the e2e image name does not follow `COMPOSE_PROJECT_NAME`

- Where: `infra/compose.yaml`, service `e2e`, `image:`.
- Problem: every stack builds and tags the same image `cogniate-stack-e2e:1.56.0`. A QA run re-tags the image of the Author's stack, so parallel stacks are not fully separate.
- Evidence: `E/cmd/26-test-acceptance-pass1.log`: "naming to docker.io/library/cogniate-stack-e2e:1.56.0" in project `qa-t1-r1`. In this round both stacks used the same SHA, so the content was the same.
- Fix: use `${COMPOSE_PROJECT_NAME}-e2e:1.56.0`, or remove `image:` (Compose then names the image `<project>-e2e`).

### Q-T1-04 NIT: Moodle shows a missing capability for the product WS token

- Where: Moodle Site administration > Server > Web services > Manage tokens, token "cogniate-dev".
- Problem: Moodle shows "Missing capabilities: Update user profiles (moodle/user:update)" for the product token. One of the 9 functions declares this capability. T1 does not need it: the user lookup by username works (H2).
- Evidence: `E/container-pass1/playwright/T1-moodle-admin-*/manage-tokens.png`.
- Fix: none for T1. Check it in T4, where the app uses the WS client.

## 3. QA-side changes in this round

QA ran three runs on the same SHA. Runs 1 and 2 found defects in the QA tests, not in the product. Run 3 is the evidence above. Every other product result was the same in all three runs (`tests/host/artifacts/qa-t1-r1-ef9faebb-2026-10-16T13-42-44-011Z/`, `…13-46-03-551Z/`).

- The H4 and AC-T1-12 UI tests called `core_webservice_get_site_info` with the oracle token. That function is not in the approved oracle function list, so Moodle answered `accessexception`. Now H4 checks each oracle function directly, and AC-T1-12 does not use the oracle user id.
- The table reader counted the empty placeholder rows that Moodle report tables add, and it joined the service name with its shortname. It now drops empty rows and reads cell lines.
- The login helper waits for `.toggle-sensitive-wrapper #password` before it types (Lead hint).
- The runner applies the Lead's AC-T1-11 scope. Values from `**/.data` and from the workspace env files are information only; none was in a tracked file.
- The runner's "diff vs SHA" note used a wrong pathspec. This is fixed; the real diff is in `E/tests-diff-vs-sha.txt`.

The Lead should commit these test changes (`tests/**`) before round 2.

## 4. Not covered

- `npm run demo:browser` (LC-T1-04): not verified by QA.
- A human browser on the host (`/etc/hosts` or `--host-resolver-rules`): not tested. The E2E path needs nothing on the host.
- Chromium only. T1 has no Safari-specific criterion.

## Round 2

Verdict: PASS
Round: 2

| Item | Value |
| --- | --- |
| SHA | `b82382bd5ad066aae82eabfd68ea08996e33e2b6` ("T1 (wip, round 2): fixes for A-T1-01, B-T1-01/02 and 9 minors") |
| Tests used | `279903a` (in the SHA) plus one QA fix in `tests/acceptance/T1/harness.test.ts` and runner changes (see "QA-side changes"). Only the T1 task folder was in the clone (`--only-task-folders T1`). Diff: `E2/tests-diff-vs-sha.txt` |
| Runner | `COMPOSE_PROJECT_NAME=qa-t1-r2 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 COURSE_FIXTURES_DIR=<repo>/docs/raw/data/courses node tests/host/run-t1.mjs --sha b82382b… --replace-tests --only-task-folders T1` |
| Isolation | QA stack next to the Author's stack (`cogniate-stack` on 443). No Author container stopped or restarted. At the end: 0 containers, 0 volumes, 0 networks of `qa-t1-r2`. |
| Evidence root | `E2` = `tests/host/artifacts/qa-t1-r2-b82382bd-2026-10-16T16-09-23-370Z/` (git-ignored, secrets redacted). Run 1 of this round: `tests/host/artifacts/qa-t1-r2-b82382bd-2026-10-16T16-06-24-025Z/`. |
| In-container suite | 39 tests in pass 1 and 39 in pass 2 (after `stack:reset`): all PASS. |

### R2.1 Results per acceptance criterion

| AC | Result | What QA saw | Evidence |
| --- | --- | --- | --- |
| AC-T1-01 | PASS | Fresh clone: `npm ci` and `npm run check` exit 0. A failing canary file in `tests/` does not break the check. | `E2/cmd/03…`, `04…`, `06…` |
| AC-T1-02 | PASS | `stack:up` + `seed` exit 0 in 31 s (images pulled before); the four URLs are printed. | `E2/cmd/14…`, `15…` |
| AC-T1-03 | PASS | 200 with `form#login`; TLS verifies with `root.crt` (Node and curl); public roots only → Node error, curl exit 60. | `E2/container-pass1/vitest-results.json` |
| AC-T1-04 | PASS | Three `/healthz`: 200 JSON, `status: "ok"`, service names, `knobs: []`. | same |
| AC-T1-05 | PASS | Prints `{"status":"ok","service":"lti-service","knobs":[]}`. On stderr the script also shows four blocked targets: `169.254.169.254`, `lti.cogniate.test:80`, `postgres:5432`, `172.17.0.1`. | `E2/cmd/16-moodle-reach-check.log` |
| AC-T1-06 | PASS | Release 5.2.x, `siteurl` = `https://moodle.test:8443`, the 9 functions, no oracle-only function; unknown token → `invalidtoken`. | vitest results |
| AC-T1-07 | PASS | `cg_teacher` signs in; `MoodleSession` `Secure=true`; a wrong password is refused. | `E2/container-pass1/playwright/T1-moodle-login-*/` |
| AC-T1-08 | PASS | Both courses once, `enablecompletion=1`, correct roles. | vitest results |
| AC-T1-09 | PASS | One binding: `proxy 127.0.0.1:8443->8443/tcp`. | `E2/summary.json` |
| AC-T1-10 | PASS | Marker course gone after reset + up + seed (34 s); only the site course, 101 and 102; `root.crt` (same CA fingerprint) and `.env` kept; four logins with the same passwords; pass 2 all PASS. | `E2/cmd/27…`–`29…`, `E2/container-pass2/` |
| AC-T1-11 | PASS | 15 secret values (round-2 wording: secret `.env` entries, passwords and tokens in `infra/.secrets/`, `infra/.certs/*.key`): none in tracked files. Every listed path is git-ignored, incl. `infra/.data/` and `.tmp/`. `.env.example` secret keys are empty. | `E2/summary.json` |
| AC-T1-12 | PASS | Three seeds (seed, seed, demo): `seed.json` unchanged; one token per (user, service); each service once; one enrolment per user. | `E2/cmd/19…`, `20…`, `E2/container-pass1/playwright/T1-moodle-admin-*/` |
| AC-T1-13 | PASS | First run and after reset: `fetch` → 200 in lti-service and cogniate-app; `npm run stack:node-reach-check` exit 0 with two 200 results. | `E2/cmd/17…`, `18…`, `30…`, `31…` |

| Change or hook | Result | Evidence |
| --- | --- | --- |
| LC-T1-01 CA and leaf | PASS: CA life 365 days, critical Name Constraints with only `Permitted: DNS:test`, leaf `stack.crt` (four SANs) does not outlive the CA, made before any container; `root.crt` kept by reset. | `E2/summary.json`, vitest results |
| LC-T1-02 public URLs | PASS | vitest results |
| LC-T1-03 `npm run demo` | PASS | `E2/cmd/20-demo.log` |
| LC-T1-04 `npm run demo:browser` | **Not verified by QA** (Lead decision). The script exists. | `E2/cmd/21…` |
| LC-T1-05 command table | PASS (14 commands, incl. `stack:node-reach-check`) | `E2/summary.json` |
| LC-T1-06 `fixtures:check` | PASS | `E2/cmd/07…`–`10…` |
| Curl rule (T1 scope, A-T1-06) | PASS: allowed ports exactly `443, 8443`; blocked hosts = the Moodle 5.2.4 default list, with `172.16.0.0/12` split into `172.16.0.0/13`, `172.24.0.0/14`, `172.28.0.0/16`, `172.30.0.0/15` (only `172.29.0.0/16` cut out). Read with `admin/cli/cfg.php` (read-only). | `E2/cmd/*moodle-cfg*` |
| H1, H2, H3, H4 | PASS (H2 now also checks mode 600, `cogniate-seed/1`, both WS service records) | `E2/summary.json`, vitest results |
| H7 | PASS: every line of the three logs has a non-empty `trace_id`; lifecycle lines carry their process's boot trace id. | vitest results, `E2/container-pass1/service-logs/` |
| H8 | PASS: no `*.key` visible in `e2e`; `.secrets` and `.logs` read-only; `NODE_EXTRA_CA_CERTS` = `root.crt`. | vitest results |

### R2.2 Status of the round-1 findings

| Id | Status | Evidence |
| --- | --- | --- |
| Q-T1-01 MINOR (`infra/.certs` writable in e2e) | Closed. Judged against the round-2 H8 text (only `root.crt` and `stack.crt`; no key visible): no key file is visible, and the secrets and logs mounts are read-only. | H8 tests in `E2/container-pass1/vitest-results.json` |
| Q-T1-02 MINOR (lifecycle lines without `trace_id`) | Closed. Every lifecycle line has the boot trace id, for example `test_knob_active` and `service_started` both `boot-406e4258d6f8`. | `E2/container-pass1/service-logs/lti-service.jsonl` lines 3–4 |
| Q-T1-03 MINOR (e2e image name) | Closed. The image is `qa-t1-r2-e2e:1.56.0`. | `E2/cmd/26-test-acceptance-pass1.log` |
| Q-T1-04 NIT (missing `moodle/user:update` on the product token) | Open, unchanged. Moodle still shows it. No T1 impact; check in T4. | `E2/container-pass1/playwright/T1-moodle-admin-*/manage-tokens.png` |

No new findings against the product.

### R2.3 QA-side changes in this round

- Run 1 of this round (`…16-06-24-025Z`) failed only the H7 boot-trace-id tests in pass 1, after the knob restarts. The cause was the QA test: it assumed that a process's lifecycle lines start with `service_started`. The product writes `test_knob_active` just before `service_started`, with the same boot trace id. T1.md does not fix the order. The test now checks the rule without order: every `test_knob_active` and `service_stopping` line carries the boot trace id of some `service_started` line, and each boot id has at most one start and one stop. The failure message now lists every lifecycle line.
- The runner keeps a copy of the service logs after each in-container pass (`container-<pass>/service-logs/`), because `stack:reset` deletes them.
- The runner can keep only some task folders in the clone (`--only-task-folders`), so that unfinished tests of later tasks do not run in a T1 round.
- The AC-T1-05 note in this run read only stdout; the reach-check negative cases are on stderr (the evidence file has both). The runner now reads both.

The Lead should commit the QA changes in `tests/**` (H7 test, runner) with the next commit.
