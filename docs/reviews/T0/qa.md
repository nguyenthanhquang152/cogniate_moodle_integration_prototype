Verdict: PASS
Round: 1

# T0 testability review (QA)

Date: 2026-10-16. Role: QA (independent). Scope: the 120 acceptance criteria (AC) in `docs/architecture/tasks/T1.md` to `T8.md`.

Inputs: `CLAUDE.md`, `docs/team/charter.md`, `docs/research/inputs.md`, `docs/architecture/README.md`, both contracts, ADR-004, ADR-005, ADR-009, ADR-010, T1 to T8, `infra/moodle/SPIKE-NOTES.md`. I did not read Author code.

Extra checks for oracles:

- I listed the two fixture zips with `unzip -l`. I read `imsmanifest.xml`, `scorm-api.js` and the page markup with `unzip -p`. I did not extract them.
- I read Moodle 5.2.4 source in the running spike container `cogniate-moodle-moodle-1`: `mod/lti/service/gradebookservices/classes/local/resources/scores.php` and `lib/completionlib.php`.

## 1. Verdict

PASS. QA can start to write the T1 tests now. After the fixes below, every AC can get a deterministic PASS or FAIL. No finding is a BLOCKER.

The 12 MAJOR findings must close before the task that they name goes to verification. Most of them are test hooks or missing oracles, not design changes.

| Severity | Count |
| --- | --- |
| BLOCKER | 0 |
| MAJOR | 12 |
| MINOR | 18 |
| NIT | 2 |

## 2. AC testability by task

Q-T0-02 (credentials) applies to every AC. It is not repeated below.

| Task | AC | Testable as written | Need a change (finding) |
| --- | --- | --- | --- |
| T1 | 12 | 03, 04, 05, 06, 07, 09 | 01, 10 (Q-T0-01); 02 (Q-T0-13); 08, 12 (Q-T0-14); 11 (Q-T0-11) |
| T2 | 17 | 01–05, 08–15, 17 | 06 (Q-T0-15); 07 (Q-T0-03); 16 (Q-T0-09) |
| T3 | 22 | 01–04, 06, 07, 09–15, 17, 18, 21 | 05, 16 (Q-T0-09); 08, 20 (Q-T0-17); 19 (Q-T0-18); 22 (Q-T0-16, Q-T0-09) |
| T4 | 21 | 01–08, 10–17, 19–21 | 09 (Q-T0-03); 18 (Q-T0-09) |
| T5 | 19 | 02–05, 07–10, 17, 18 | 01 (Q-T0-30); 06 (Q-T0-22); 11, 13 (Q-T0-05); 12 (Q-T0-05, Q-T0-21); 14 (Q-T0-23); 15, 16 (Q-T0-21); 19 (Q-T0-09) |
| T6 | 10 | 01, 03, 04, 05, 07, 08, 09 | 02, 06, 10 (Q-T0-24) |
| T7 | 12 | 02–07, 09, 12 | 01 (Q-T0-01, Q-T0-09, Q-T0-13); 08 (Q-T0-12); 10 (Q-T0-09); 11 (Q-T0-25) |
| T8 | 7 | 01, 05 | 02 (Q-T0-13); 03, 04, 06, 07 (Q-T0-26) |
| **Total** | **120** | **82** | **38** |

Oracles that I verified (no change needed):

- AC-T3-17: Moodle returns `400 "Incorrect score received"` for a user who is not gradable (`scores.php:184-186`). So `400 PLATFORM_REJECTED_REQUEST` is correct.
- AC-T3-13: Moodle returns `409` if the stored grade time ≥ the score timestamp (`scores.php:196-198`). The "+1 s" rule is necessary.
- AC-T5-07, AC-T7-05: Moodle updates "Receive a grade" completion in the same request as the grade (`completionlib.php:1549-1569`). Cron is a fallback only.
- AC-T5-02: `lyra.mp4` is 10,721,508 bytes in both zips.
- AC-T5-04: `scorm-api.js` sets `CogniateSCORM.available = true` only after it finds `API` and `LMSInitialize` works.
- AC-T5-07 to -09: the course has one question with 1 correct and 3 wrong options. The adapter marks a page seen after 10 s visible time and a scroll to the end. The menu page is seen on visit. The video is not part of the gate.

## 3. MAJOR findings

### Q-T0-01 MAJOR: No clean, isolated test run is defined

- Where: `tasks/T1.md:42` (AC-T1-01), `tasks/T1.md:51` (AC-T1-10), `tasks/T1.md:15`, `tasks/T7.md:11`.
- Problem: QA cannot run on a clean environment that is independent of the Author's working tree and Docker state.
- Evidence: AC-T1-01 needs a clean clone, but the build under test is not in git until the Lead commits after done. The compose project name `cogniate-stack` is fixed. Only one stack can bind `127.0.0.1:443`. A QA `stack:reset` deletes the Author's data. The spike stack `cogniate-moodle` runs now.
- Fix:
  1. For each verification round, the Lead gives QA a commit SHA (a WIP branch is enough). QA clones it into a new folder outside the repo.
  2. All state (`.env`, `infra/.secrets`, `infra/.certs`, data folders) stays inside the checkout. `COMPOSE_PROJECT_NAME` can be set from env, and volume names use it.
  3. During a QA run, the Author's stack and the spike stack are down. The Lead coordinates this.

### Q-T0-02 MAJOR: Credentials and seed outputs have no fixed, machine-readable place

- Where: `tasks/T1.md:19-22`, `tasks/T2.md:21`, `tasks/T4.md:17`, `contracts/cogniate-app-api.md:35`.
- Problem: Tests cannot sign in or call APIs without fixed names for the generated values.
- Evidence: Only the LTI API key path is fixed (`infra/.secrets/lti-api-key.<account>`). These are not defined: the `.env` names of the Moodle passwords (`admin`, `cg_teacher`, `cg_student`, `cg_student2`), the portal passwords (Thanh, QA Library B), and the WS token location of the new stack. `seed:lti-manual` prints its JSON to stdout only.
- Fix: `npm run seed` and `npm run seed:lti-manual` write `infra/.secrets/seed.json` (git-ignored, mode 600). Content: Moodle users (username, password, id), course ids by shortname, WS token, portal users, API key paths, and the `seed:lti-manual` object (`typeId`, `clientId`, `deploymentId`, `cmids`, `platformId`). Keep the format stable. QA reads only this file.

### Q-T0-03 MAJOR: TTL test settings have no mechanism, and AC-T2-07 has a race

- Where: `tasks/T2.md:48` (AC-T2-07), `tasks/T4.md:57` (AC-T4-09), `tasks/T7.md:14`.
- Problem: QA cannot set `LTIK_TTL_SECONDS` or `REF_TTL_SECONDS` for one test and then restore the default. A 5 s ltik that must "work at once" is not deterministic.
- Evidence: The launch chain (Moodle form → `/lti/login` → `auth.php` → `/lti/launch` → 303) takes 1 to 3 s before QA can call `/api/idtoken`. A slow run can use most of the 5 s.
- Fix: Add `npm run stack:restart -- <service> --env KEY=VALUE`, and the same command without `--env` to restore the defaults (or a compose override file). Change the AC values: TTL 20 s, first call less than 10 s after the redirect, `401` at TTL + 3 s. Apply the same rule to `REF_TTL_SECONDS`. T7 keeps the defaults.

### Q-T0-04 MAJOR: No machine oracle for Moodle grades, completion, roles and tool settings

- Where: `tasks/T1.md:47` (AC-T1-06), `tasks/T1.md:49`, `:53`; `tasks/T3.md:60-63`; `tasks/T5.md:54-64`; `tasks/T7.md:49-50`; `tasks/T8.md:31`.
- Problem: QA can check grades, completion and roles only by UI scraping. UI scraping is slow and brittle when it polls for "within 60 s".
- Evidence: The integration WS service has 9 functions (spike §3). None of them reads grades, completion or enrolments. AC-T1-06 fixes that list, so the product service must not get more functions.
- Fix: The seed makes a second, QA-only WS service `cogniate_qa_oracle` with its own user and token in `seed.json`. Functions: `gradereport_user_get_grade_items`, `core_completion_get_activities_completion_status`, `core_enrol_get_enrolled_users`, `core_course_get_contents`, `core_course_update_courses` (T8). QA uses it to poll. A screenshot of the Moodle page stays the evidence where an AC names that page. This service is not part of the product and not needed in production. Alternative: the Lead lets QA run read-only PHP CLI in the Moodle container.

### Q-T0-05 MAJOR: Score sync rows are not visible through an API

- Where: `tasks/T5.md:58-60` (AC-T5-11, -12, -13), `contracts/cogniate-app-api.md:178`.
- Problem: Three ACs say "no score sync row" or "no new score sync row", but the API shows only the latest sync.
- Evidence: `ResultRow.scoreSync` has `status`, `tries`, `sentAt` and `lastError` of one sync. A new row with the same values is invisible. The contract does not say if preview attempts are result rows.
- Fix: Add `scoreSyncs: [{ id, status, tries, scoreGiven, scoreMaximum, createdAt }]` (or a `scoreSyncCount`) to `ResultRow`. Say if preview attempts are rows (with `preview: true`). Alternative: the spec allows a read-only SQL count on `cogniate.db` with a fixed table name. I prefer the API field.

### Q-T0-06 MAJOR: Most `id_token` checks have no negative AC, and the checks have no error-code map

- Where: `README.md:701-716` (§9.2 checks 4, 5, 7, 8, 10, 11, 12), `tasks/T2.md:42-58`.
- Problem: T2 tests only checks 1, 2, 6 and 9, plus the login checks. An implementation that skips the `alg`, `aud`, `exp`, `nonce`, `version`, required-claim or `target_link_uri` check passes T2.
- Evidence: AC-T2-09 to -15 cover replay, cookie, tamper, unknown issuer, login target, deployment and inactive platform. Contract §2.2 lists 10 error codes but does not map them to the 12 checks.
- Fix:
  1. The Architect adds a table "check number → error code".
  2. Add ACs that QA can run with real Moodle tokens:
     - Re-signed `alg=none` and `HS256` tokens → `INVALID_ID_TOKEN`.
     - Unknown `kid` → `INVALID_SIGNATURE`.
     - QA holds an intercepted launch POST for 125 s, then sends it with its own state and cookie → `TOKEN_EXPIRED`.
     - Token of launch A with the state and cookie of launch B → `INVALID_NONCE`.
     - Token of tool A with the state of tool B (same issuer, T3 onward) → `aud` check fails.
  3. Test hook for checks 10, 11 and 12 (valid signature, bad claims): in the acceptance profile only, the proxy serves `https://qa-platform.test` as static files from `tests/fixtures/qa-platform/` (a QA-owned JWKS). `OUTBOUND_PRIVATE_HOST_ALLOWLIST` includes this host in that profile only. QA registers it with `POST /api/platforms` and signs its own tokens. T7 does not use it.

### Q-T0-07 MAJOR: No test for a line item of another tool in the same Moodle course

- Where: `contracts/lti-service-api.md:295`, `README.md:788`, `tasks/T3.md:64` (AC-T3-16), `tasks/T7.md:31-37`.
- Problem: A service key of library A can name a line item of library B's tool in the same course, and our rule lets the request go to Moodle.
- Evidence: Line item URLs in one course differ only in `?type_id=` (`/mod/lti/services.php/2/lineitems/7/lineitem?type_id=1`). The path rule ignores the query string. Moodle 5.2.4 then calls `check_tool($typeid)` and returns `401` (`scores.php:82-88`). Our service maps that to `502 PLATFORM_ERROR`, and the worker retries it. Without `type_id`, Moodle takes another code path (`scores.php:116-121`). So isolation depends on Moodle, not on our rule. AC-T3-16 tests another course only. Scenario B uses another course too.
- Fix: The Architect decides if the rule also compares the `type_id` query value. Add an AC: in `COGNIATE-DEV-101`, make activities of two tools (Thanh dynamic, library B manual). Use the service key of A with the line item URL of B, once with B's `type_id` and once with no `type_id`. Expected: `400 INVALID_LINE_ITEM_ID`, no outbound request, and B's grade does not change. Also add: a score for a user who is not in the course → `400 PLATFORM_REJECTED_REQUEST`.

### Q-T0-08 MAJOR: App security negatives are missing (tool-page CSRF, XSS, tenant matrix)

- Where: `README.md:763`, `contracts/cogniate-app-api.md:22`, `:196`, `:198`, `:200`, `tasks/T4.md:44-51`, `tasks/T6.md:40-49`.
- Problem: The README rules for tool-page CSRF, output escaping and library isolation have few or no ACs.
- Evidence: No AC posts to `/lti/register` or `/lti/picker/{id}` with a foreign or `null` `Origin`. No AC puts markup into untrusted text: the manifest title, the course title, and the Moodle context and resource-link titles. The picker, the confirm page, the player shell and the portal show this text. AC-T4-06 tests only `GET /app-api/courses/:id` across libraries.
- Fix: Add these ACs:
  1. A tool-page POST with `Origin: https://evil.test` or `Origin: null` → `403`, and no state change.
  2. A package with the manifest title `<img src=x onerror="window.__xss=1">` and a course title `<b>x</b>` → the portal, picker and shell show the text literally, and `window.__xss` is undefined.
  3. A library B session gets `404` for Thanh's connection, publication, results, refresh, withdraw, version and download endpoints, for reads and writes.
  4. An unknown `playId` on `/app-api/play/{id}/status` → `404`.

### Q-T0-09 MAJOR: Log-based ACs cannot run in the e2e container

- Where: `tasks/T2.md:57`, `tasks/T3.md:47`, `:64`, `:73`, `tasks/T4.md:72`, `tasks/T5.md:69`, `tasks/T7.md:46`, `:55`.
- Problem: Eight ACs grep service logs. The tests run in the `e2e` container, which has no Docker access. AC-T7-01 wants one command.
- Evidence: The only log access is `npm run stack:logs` (Docker, on the host). Event names are fixed only for `platform_token` and `launch_rejected`. "No request to evil.test" (AC-T3-16) is provable only if every outbound request has a log line.
- Fix: The services also write their JSON log lines to `infra/.logs/<service>.jsonl` (git-ignored, kept across restarts in one run). Mount this folder read-only into `e2e`. Fix the event names:
  - `outbound_request {host, method, status}` for every outbound call
  - `outbound_blocked {host, reason}`
  - `platform_token {cache}`
  - `launch_rejected {reason}`
  - `score_sync {status, tries}`

### Q-T0-10 MAJOR: QA cannot own its test workspace and its dependencies

- Where: `team/charter.md:14`, `tasks/T1.md:21-23`.
- Problem: QA owns only `tests/acceptance/**` and `tests/e2e/**`. The tests also need files at the `tests/` root and test-only packages.
- Evidence: `T1.md:21` says "QA owns the config under `tests/`". That conflicts with `charter.md:14`. QA needs `tests/package.json` with a lock file, `tests/playwright.config.ts`, `tests/tsconfig.json` and `tests/fixtures/**`. QA also needs these packages: `@axe-core/playwright` (AC-T6-09), `jose` (AC-T3-08, Q-T0-06), a zip writer (AC-T4-05) and a tar reader (AC-T8-04). `test:acceptance` has no definition. A root Vitest run (`npm run check`) also finds `tests/acceptance/**/*.test.ts`, and these tests need the stack.
- Fix: The Lead gives QA all of `tests/**` as a separate npm project (not a root workspace). The Author makes these changes:
  - Root `vitest.config.ts`, ESLint and `tsc` exclude `tests/**`.
  - `test:acceptance` runs `npm ci --prefix tests`, then Vitest with `tests/acceptance/vitest.config.ts` and Playwright project `acceptance-ui`, in the `e2e` container.
  - The `e2e` container mounts the repo, the CA (read-only) and `infra/.secrets` (read-only). It sets `NODE_EXTRA_CA_CERTS`.

### Q-T0-11 MAJOR: AC-T1-11 scope is unclear, and SPIKE-NOTES.md has live dev secrets

- Where: `tasks/T1.md:52`, `infra/moodle/SPIKE-NOTES.md:15-19`.
- Problem: AC-T1-11 says "each value in `.env`", but the repo has more than one env file. A file that git does not ignore already holds generated secrets.
- Evidence: `infra/moodle/.env` and `infra/moodle/.data/ws.json` are git-ignored (`infra/moodle/.gitignore`). `SPIKE-NOTES.md` is not ignored. Its §0 shows the admin, teacher and student passwords and the WS token in clear text. If T1 keeps the spike `.env`, `git grep` finds these values in SPIKE-NOTES.md and the AC fails.
- Fix: AC text: "every value in every `.env*` file (not `.env.example`) and in every file under `infra/.secrets/` and `**/.data/`". Before the first commit of `infra/`, remove the values from SPIKE-NOTES §0, or make new spike values (`rm .env`, reset).

### Q-T0-12 MAJOR: AC-T7-08 proves nothing in the given order

- Where: `tasks/T7.md:27` (step A4), `tasks/T7.md:31-37` (Scenario B), `tasks/T7.md:53`.
- Problem: QA checks Thanh's picker in step A4, before library B has a course (step B3). So "never lists it" always passes.
- Evidence: The scenarios run in the order A, then B.
- Fix: Add a step after B3: `cg_teacher` opens "Select content" of "Thanh's Library – Cogniate" again. The library B course must not be in the list.

## 4. MINOR and NIT findings

| ID | Severity | Where | Problem and evidence | Fix |
| --- | --- | --- | --- | --- |
| Q-T0-13 | MINOR | `T1.md:43`, `T7.md:46`, `T8.md:27` | The limits of 15 min, 25 min and 5 min depend on image pulls from the internet. | Measure with the images pulled before the run. QA records the pull time and the image digests separately. |
| Q-T0-14 | MINOR | `T1.md:49`, `:53` | No read method for roles (`core_enrol_get_enrolled_users` is not in the 9 functions), or for service and token counts. | Use Q-T0-04. Else use the admin UI (Participants, Manage tokens). Add an oracle: the WS token value is the same after the second seed. |
| Q-T0-15 | MINOR | `T2.md:47`; `lti-service-api.md:136`, `:140` | AC-T2-06 gives no `details.message` for 3 cases. T2 does not test the 303 headers of the LTI service or `GET /lti/launch` → `405`. | Account mismatch and missing `:` → `INVALID_LTIK_AUTH_AUTHORIZATION_HEADER`. `SERVICE-AUTH-V1` → `INVALID_AUTHORIZATION_HEADER` (as in AC-T3-18). New AC: the 303 has `Referrer-Policy: no-referrer`, `Cache-Control: no-store` and state cookie `Max-Age=0`. `GET /lti/launch` → `405`. |
| Q-T0-16 | MINOR | `T3.md:73` | The token cache is in `lti.db`, so earlier tests can fill it. Then "miss once, hit once" fails. | Oracle: the two posts give at most one `miss`, and the second post is a `hit`. |
| Q-T0-17 | MINOR | `T3.md:53`, `:71`; `README.md` §9.2 | "content_items equal to the request" is not defined if the service adds defaults. `exp - iat ≤ 600` does not agree with the README value of 300 s. `?role=Learner` has no defined form (short name or URI). | Request fields must deep-equal the claim items. List the fields that the service can add. Use `exp - iat = 300 ± 1`. State the accepted role forms. |
| Q-T0-18 | MINOR | `T3.md:67` | AC-T3-19 deletes the seed platform. Later tests and reruns need it. | `seed:lti-manual` makes the platform again if it is missing. QA runs AC-T3-19 last. |
| Q-T0-19 | MINOR | `cogniate-app-api.md:59-63`; `T4.md:48-49` | No rule for `externalHosts`, `fileCount` and `totalBytes`. The pages have many `https://` strings in licence comments (github.com, tailwindcss.com, w3.org, twitter.com). The example `totalBytes: 23380000` is wrong for this zip. | Count only URLs that load a resource (`src`, `srcset`, `poster`, `link href`, CSS `url()`, `@import`). Expected sets: SCORM = {S3 host}. HTML = {S3 host, `fonts.gstatic.com`}. `fileCount` counts files, not folders: SCORM 7, HTML 7. `totalBytes` is the sum of uncompressed sizes: SCORM 12,723,159, HTML 12,103,306. |
| Q-T0-20 | MINOR | `T4.md:50`; `cogniate-app-api.md:89-105` | AC-T4-05 does not test 6 reject codes: `ZIP_TOO_LARGE`, `ZIP_TOO_MANY_ENTRIES`, `INVALID_ENTRY_NAME`, `MANIFEST_INVALID_XML`, `LAUNCH_FILE_MISSING`, `NO_ENTRY_PAGE`. It also does not test a nested path such as `a/../../evil.html`. | Add them to AC-T4-05. QA makes these zips at run time (201 MB of random data for `ZIP_TOO_LARGE`). |
| Q-T0-21 | MINOR | `T5.md:59`, `:65-66`; `cogniate-app-api.md:219-254` | QA cannot make a valid commit of its own. `RuntimeState` has no `seq`. The spec does not say if the server accepts a commit after `finish`, or if it checks `seq` before CMI validation. | Add `lastSeq` to `RuntimeState`, or use the rule "any `seq` > the last accepted `seq`". Define the check order. New text for AC-T5-12: relaunch, then commit `failed`/0 in the new session. |
| Q-T0-22 | MINOR | `T5.md:50` | AC-T5-06 does not name the package. The real package writes its own `suspend_data` on load and overwrites `qa-resume`. | Use the blank SCO of AC-T5-05. |
| Q-T0-23 | MINOR | `T5.md:64` | Timing can make AC-T5-14 fail. Retries are at +5 s, +35 s, +155 s and +755 s. If Moodle is not ready at +155 s, the next try is at +755 s. | Procedure: start Moodle when `tries ≥ 1` shows, before +30 s. QA stops and starts Moodle from the host. |
| Q-T0-24 | MINOR | `T6.md:41`, `:45`, `:49` | AC-T6-02 does not name the CSS property of the active pill. AC-T6-06: a local upload ends in less than 1 s, so QA cannot see the progress bar. AC-T6-10 has no route list. | Pill: `background-color` = `rgb(166, 103, 228)` ± 1, or name the gradient. Progress: an element with `role="progressbar"` and `aria-valuenow`. QA slows the upload with CDP `Network.emulateNetworkConditions`. List the portal routes. |
| Q-T0-25 | MINOR | `T7.md:56` | The AC does not say if a pass after a Playwright retry counts. | Set `retries: 0`. Three runs with no retry = PASS. |
| Q-T0-26 | MINOR | `T8.md:28-32` | AC-T8-03 needs an exec "during the build" (a race) and the internet (`example.com`). AC-T8-07 has no way to make a build fail. AC-T8-06 needs `core_course_update_courses`. AC-T8-04 is unclear if the Announcements forum is allowed. | Add `BUILD_RUNNER_HOLD=1` (pause before teardown) and `BUILD_RUNNER_FAIL_AT=<step>`. AC-T8-03 oracle: `docker network inspect` → `Internal: true`, no other network, and DNS fails for `moodle.test`. Use Q-T0-04 for visibility. Write "exactly one `scorm` activity; other modules are allowed" (or not). |
| Q-T0-27 | MINOR | `README.md` §9.5 CAUTION; `T5.md:54-56` | The packages load S3 images and Google fonts. So page load time depends on the internet. | QA blocks every request to a host that is not `*.test`, in all browser contexts, and records the blocked URLs. The runtime must not wait for these hosts. |
| Q-T0-28 | MINOR | ADR-004 HTML rules; ADR-010 rule 4 | No black-box AC for "first answer stands", the 10 s dwell limit, or "better result" (failed → passed raises the grade). | HTML: click wrong, then right → `failed`, 0. Scroll to end, answer, close before 10 s → `in_progress`. After AC-T5-08: commit `passed`/100 → new sync, gradebook 100. |
| Q-T0-29 | MINOR | `T4.md:56`, `T6.md:43`, `T7.md:62` | Each dynamic registration adds one Moodle tool on `lti.cogniate.test`. Later runs then get the "update or register new" page. T5 and T6 setup takes about 10 min of UI steps. | QA helpers accept both pages. Optional hook: `npm run stack:snapshot <name>` and `stack:restore <name>` for all stack volumes, so suites can start from the "T4 state". |
| Q-T0-30 | MINOR | `T5.md:42` | HTTP clients and Caddy can clean up or redirect raw `..` paths. A `308` from the proxy is not a `404`. | QA sends raw paths (`curl --path-as-is`, raw Node request). Oracle: status `400` or `404`, and the body is not the file. |
| Q-T0-31 | NIT | `T2.md:50`/`T7.md:55`; `T2.md:57`/`T5.md:69`; `T4.md:69-70`/`T7.md:48`, `:53`; `T5.md:68`/`T6.md:47`/`T7.md:51` | Some ACs repeat on different layers. | Keep them. QA uses one helper per check and links the evidence. |
| Q-T0-32 | NIT | `T5.md:56` | AC-T5-10 checks only `index.html`. | Compare the SHA-256 of every file in the zip. The cost is small. |

## 5. Test plan

### 5.1 Layers

| Layer | What it checks | Tools | Runs in | Tasks |
| --- | --- | --- | --- | --- |
| L0 host | Docker, git, ports, reset, stop and start, network inspect, times | Node 24 scripts, `docker compose`, `git` | macOS host | T1, AC-T5-14, T8 |
| L1 API | HTTP contracts, auth headers, error bodies, headers, tokens, uploads | Vitest, Node `fetch` with the stack CA, `jose` | `e2e` container | T1 to T5, T8 |
| L2 browser acceptance | Moodle launch, Deep Linking, registration, runtime `frame.evaluate`, portal, axe | Playwright 1.56.0 (Chromium), `@axe-core/playwright` | `e2e` container | T2 to T6 |
| L3 E2E | Scenarios A, B, C | Playwright 1.56.0 | `e2e` container, `npm run test:e2e` | T7 |

Oracle order: the value in the AC first. For Moodle, a UI screenshot is the evidence and the QA oracle WS (Q-T0-04) is the polling source. QA reads data stores only where an AC allows it (for example, the package store count in AC-T4-05).

### 5.2 Layout

```text
tests/                           QA-owned (pending Q-T0-10)
  package.json, package-lock.json
  playwright.config.ts           projects: acceptance-ui, e2e; retries 0; workers 1; trace on
  tsconfig.json
  fixtures/                      generators for crafted zips, blank SCO, qa-platform JWKS
  acceptance/
    vitest.config.ts
    lib/                         CA-aware HTTP client, auth headers, seed.json reader,
                                 Moodle WS client, log reader, zip crafter, JWT tools
    host/                        L0 scripts (Docker and git steps)
    t1/ … t5/ t8/                *.test.ts (L1) and *.spec.ts (L2)
    .gitignore                   artifacts/
  e2e/
    pages/                       page objects: Moodle admin, teacher, learner; portal; player
    scenario-a.spec.ts, scenario-b.spec.ts, scenario-c.spec.ts
    .gitignore                   artifacts/
```

Each test title starts with its AC id, for example `AC-T2-09 replay gives INVALID_STATE`. QA-made extra tests (from findings) use the finding id.

### 5.3 Clean-environment run (each round)

1. Get the commit SHA from the Lead. Clone it into a new folder outside the repo.
2. Make sure that the folder has no `node_modules`, `.env`, `infra/.secrets` or `infra/.certs`.
3. Make sure that no other stack runs (`docker compose ls`), and that no stack volumes exist when the AC says so.
4. Pull the images before the run. Record the image digests.
5. Run `npm ci && npm run check`, then `npm run stack:up && npm run seed`. Record the times.
6. Run `npm run test:acceptance -- <task>` and the L0 host scripts. For T7, run `npm run test:e2e` three times.
7. Save the service logs and `docker compose ps` output into the artifacts folder.
8. Run `npm run stack:down`. Use `npm run stack:reset` before the next round.

### 5.4 Determinism rules

- `retries: 0`, `workers: 1`, no parallel UI tests (they share one Moodle).
- Poll with deadlines from the AC (10 s, 60 s, 3 min). Use fixed waits only for the 11 s dwell and the TTL tests.
- Block every host that is not `*.test` in all browser contexts (Q-T0-27).
- Use unique names per run (for example `QA DL <runId>`).
- Every suite starts from a known state: reset and seed, or a snapshot (Q-T0-29).
- Use the visible labels of Moodle 5.2.4. Record each difference from the task text.
- Chromium only. qa.md says that Deep Linking in Safari is not tested (README §9.4, Q16).
- If Chromium cannot trust the stack CA, use `ignoreHTTPSErrors` (ADR-005) and record it in qa.md. AC-T1-03 still checks the TLS chain with Node.
- Do not use the package helper `window.CogniateSCORM.markLessonComplete` in any AC path.

### 5.5 Evidence in each `docs/reviews/<task>/qa.md`

- Commit SHA, image digests, run date, run times.
- One table row per AC: PASS or FAIL, test id, command, and the artifact path.
- Playwright traces for all L2 and L3 tests. Screenshots at each Moodle or portal assertion (grader report, completion report, tool settings, portal results).
- HTTP exchange logs for L1. Secrets in evidence show only the first 6 characters and the length.
- Service log snapshot, and the grep result for each captured secret.
- Each FAIL gets a finding (`Q-Tn-NN`) with the expected value, the actual value and the evidence.

### 5.6 Test hooks needed from the Author

| Hook | Need | Finding |
| --- | --- | --- |
| H1 | Commit SHA per round; all state inside the checkout; `COMPOSE_PROJECT_NAME` from env | Q-T0-01 |
| H2 | `infra/.secrets/seed.json` with credentials, ids, tokens and seed outputs | Q-T0-02 |
| H3 | `stack:restart -- <service> --env KEY=VALUE` and restore | Q-T0-03 |
| H4 | QA-only Moodle WS service `cogniate_qa_oracle` with token | Q-T0-04 |
| H5 | Score sync history in `ResultRow` | Q-T0-05 |
| H6 | `qa-platform.test` static host and allowlist entry, acceptance profile only | Q-T0-06 |
| H7 | JSON log files in `infra/.logs/`, mounted read-only into `e2e`; fixed event names | Q-T0-09 |
| H8 | `tests/**` as a QA npm project; root check excludes it; `test:acceptance` defined; `e2e` mounts and `NODE_EXTRA_CA_CERTS` | Q-T0-10 |
| H9 | `seed:lti-manual` makes a deleted platform again | Q-T0-18 |
| H10 | `lastSeq` in `RuntimeState` | Q-T0-21 |
| H11 | Optional: `stack:snapshot` and `stack:restore` | Q-T0-29 |
| H12 | T8: `BUILD_RUNNER_HOLD`, `BUILD_RUNNER_FAIL_AT` | Q-T0-26 |
| H13 | `npm run moodle:cron` (fallback only) | T7 risk note |

Not needed: a SCORM fast-forward hook. The completion gate is 10 s of visible time plus a scroll to the end on one lesson page. The 10.7 MB video is not part of the gate. A real 11 s wait per run is deterministic and costs about 2 min per full suite.

## Round 2

Verdict: PASS
Round: 2

Date: 2026-10-16. Input: commit `b06aa8a` (`docs/architecture/tasks/README.md`, T1 and the new task files T5-spike, T2, T3a, T3b, T3c, T4a, T4b, T5a, T5b, T6, T7, T8, T9, `review-response-T0.md`, `security.md`, `local-stack.md`, both contracts). I did not read Author code.

Verdict reason: all 12 round-1 MAJOR findings are resolved. The new and moved ACs have a black-box oracle, except the items below. The one new MAJOR (Q-T0-39) concerns T5b and T6 only. It does not block T2, T3a, T3b or T4a/T4b. It must close before T5b goes to verification.

| Severity (round 2, new) | Count |
| --- | --- |
| BLOCKER | 0 |
| MAJOR | 1 |
| MINOR | 7 |
| NIT | 2 |

### R2.1 Round-1 MAJOR findings

| Id | Status | How it is resolved, and the evidence |
| --- | --- | --- |
| Q-T0-01 | Resolved | Charter §3a, T1 H1. Proven in the T1 round-1 run: QA stack `qa-t1-r1` on 8443 and `172.29.0.0/16`, next to the Author's stack (`docs/reviews/T1/qa.md`). |
| Q-T0-02 | Resolved | T1 H2 `seed.json` (`cogniate-seed/1`); later keys `lti.apiKeyFiles`, `ltiSeed` (T2), `portal.users` (T4a). |
| Q-T0-03 | Resolved | Knob table and the "first call < 10 s, 401 at TTL + 3 s" procedure (tasks README §3). The host-side part of the procedure is in Q-T0-37. |
| Q-T0-04 | Resolved | T1 H4. Proven in T1 round 1: the oracle token calls all 6 functions. |
| Q-T0-05 | Resolved | `ResultRow.scoreSyncs`, `attempts`, `best`, preview rows (app contract §5). AC-T5-11, -12, -13, -20 now use these fields. |
| Q-T0-06 | Resolved | Check → code map and run order (security §2.2); AC-T2-20 to -27; `qa-platform.test` (local-stack §3). Two oracle gaps remain: Q-T0-35, Q-T0-36. |
| Q-T0-07 | Resolved | The URL rule compares every query parameter (contract §3.4); AC-T3-23 (same course, other tool, with and without `type_id`). |
| Q-T0-08 | Resolved | AC-T4-22 (tool-page `Origin`), AC-T4-28 and AC-T6-13 (XSS), AC-T4-29 (tenant matrix, unknown `playId`). |
| Q-T0-09 | Resolved | T1 H7 (log files mounted read-only; proven in T1 round 1); event tables in LTI contract §5 and app contract §12; `evil.test` sink logs `sink_hit`. |
| Q-T0-10 | Resolved | Charter §1, T1 H8. Proven in T1 round 1 (canary file test). |
| Q-T0-11 | Resolved | AC-T1-11 names every secret path. SPIKE-NOTES §0 has no secrets now. The T1 round-1 clone had `infra/.logs/` git-ignored. The AC text has a new problem: Q-T0-34. |
| Q-T0-12 | Resolved | T7 Scenario B step 5 reopens Thanh's picker after B3; AC-T7-08. |

The round-1 MINOR and NIT items are resolved as `review-response-T0.md` says. I spot-checked Q-T0-15, -19, -20, -21, -24, -25, -28 and -30 in the new ACs: all are present.

### R2.2 New findings

#### Q-T0-39 MAJOR: no deterministic way to make a `conflict` or `failed` score-sync row

- Where: `tasks/T5b.md` AC-T5-31, AC-T5-32; `tasks/T6.md` AC-T6-14; app contract §10 (`409 PLATFORM_CONFLICT` → `conflict`, "for example a teacher override").
- Problem: AC-T6-14 needs "a `conflict` row (from AC-T5-31)", and AC-T5-32 needs "a `conflict` or `failed` row". The specified flow most likely never makes either row.
- Evidence: Moodle 5.2.4 returns 409 only when the stored grade `timemodified` ≥ the score `timestamp` in seconds (`mod/lti/service/gradebookservices/classes/local/resources/scores.php:196-198`, read in round 1). A teacher override at time T, then our score at T' > T (the service sends `max(now, last + 1 s)`), gives 200. Moodle keeps the override, and the row is `sent`. AC-T5-31 allows `sent`, so it passes. But AC-T6-14 has no input then, and AC-T5-32 has no recipe for `failed` (24 h of retries, or a 400 from Moodle).
- Fix: name one recipe per state in the ACs.
  - `failed`: after the launch, unenrol the learner in the Moodle UI (Participants), or add `enrol_manual_unenrol_users` to the QA oracle. Then complete → Moodle `400` ("Incorrect score received", user not gradable) → `failed` at once.
  - `conflict`: QA posts a score for the learner through the LTI API with `timestamp` = now + 10 min (contract §3.6 addition). Then `npm run stack:restart -- lti-service` (this clears the in-memory score clock). The learner completes → our timestamp < Moodle `timemodified` → 409 → `conflict`.
  - Also correct the app contract §10 example: a teacher override alone does not cause a 409.

#### Q-T0-33 MINOR: T1.md H7 says `trace_id` is optional

- Where: `tasks/T1.md` H7 (`{ts, level, service, event, trace_id?, ...}`).
- Problem: security §11, LTI contract §5, app contract §12 and the Lead decision (lifecycle events use a boot trace id) all say every event has `trace_id`.
- Fix: change `trace_id?` to `trace_id`. The QA H7 test stays as it is.

#### Q-T0-34 MINOR: AC-T1-11 text is not testable literally

- Where: `tasks/T1.md` AC-T1-11 ("`git grep` for every value in those files finds nothing").
- Problem: `infra/.logs/*.jsonl`, `seed.json` and `.tmp/` hold public values (`info`, `/healthz`, `cg_teacher`, URLs) that are in tracked docs. The AC fails for a correct product.
- Evidence: the Lead's round-1 decision scoped the check to secret values (secret keys of `.env`, secret values under `infra/.secrets/`, `infra/.certs/*.key`). The T1 round-1 run used that scope and passed.
- Fix: write the Lead scope into AC-T1-11. Keep the `git check-ignore` list as it is.

#### Q-T0-35 MINOR: AC-T2-21 depends on the JWKS cache and the refetch limit

- Where: `tasks/T2.md` AC-T2-21; security §2.2 check 6 ("one refetch, at most once per minute"); contract §4 (10 min cache).
- Problem: whether the unknown-`kid` token causes a fetch depends on when the platform JWKS was last fetched. If an earlier test fetched it less than 60 s before, the correct service makes no fetch, and "the log shows one JWKS refetch" fails.
- Fix: add the precondition and a second step. (1) Post the unknown-`kid` token at least 61 s after the last JWKS fetch for that platform → `INVALID_SIGNATURE` and exactly one `outbound_request {host: qa-platform.test}` with the trace id of that response. (2) A second unknown-`kid` post within 60 s → `INVALID_SIGNATURE` and no new `outbound_request`. This also tests the limit.

#### Q-T0-36 MINOR: AC-T2-30 "every JWKS fetch" has no independent count

- Where: `tasks/T2.md` AC-T2-30; contract §5 (`outbound_request {host, method, status, ms}`, no path); local-stack §3 (`qa-platform.test` is a static host without a hit log).
- Problem: the only record of a JWKS fetch is the `outbound_request` event itself. So "every fetch has one event" cannot fail.
- Fix: `qa-platform.test` logs `qa_platform_hit {method, path}` to `infra/.logs/qa-platform.jsonl`, like the sink. QA then checks: hits on the JWKS path = `outbound_request {host: qa-platform.test}` events, in the T2 run. For Moodle, keep the weaker form ("each JWKS fetch that the service logs has `host` = issuer host").

#### Q-T0-37 MINOR: `test:acceptance` does not pass arguments or `QA_*` env into the container

- Where: `tasks/T1.md` H8, tasks README §3 (knobs).
- Problem: a knob test needs `stack:restart` (host), then only the knob tests in the container, then a restore. Tests in the `e2e` container cannot restart services. The spec does not say that `npm run test:acceptance` forwards arguments or env, so QA cannot select one task or one test.
- Fix (hook H14): `npm run test:acceptance -- <args>` forwards `<args>` to `npm --prefix tests run acceptance -- <args>`, and the container gets every `QA_*` env variable of the caller. Until then, QA tests select themselves from `/healthz` `knobs`: a knob test runs only when its knob is active, and every other test skips when any knob is active.

#### Q-T0-38 MINOR: the `acceptance` profile has no start command and no visible marker

- Where: `tasks/T2.md` "Setup … with the `acceptance` profile"; tasks README §4; local-stack §3; T7 (must run without it).
- Problem: T2 setup says "with the acceptance profile" but names no command for `stack:up` with it. The allowlist entries for `qa-platform.test` and `evil.test` exist "in this profile only", but nothing shows whether they are active. A T2 negative can then pass or fail for the wrong reason (for example `outbound_blocked {private_ip}` instead of a sink hit), and T7 cannot prove that the profile is off.
- Fix: name the command (for example `STACK_PROFILE=acceptance npm run stack:up`), and add `"profile": "default" | "acceptance"` to every `/healthz`. AC-T7-13 then also checks `"profile": "default"`.

#### Q-T0-40 MINOR: AC-T9-01 needs a human with a GUI browser

- Where: `tasks/T9.md` AC-T9-01.
- Problem: "a person who did not build the stack … in their browser in ≤ 10 minutes" uses `npm run demo:browser`, which opens a Chrome window. QA cannot judge "unclear steps" the way a new human can, and it does not drive desktop Chrome.
- Fix: the Lead names a human (or accepts a QA run). QA can time the command part in a fresh clone and check the two pages with Playwright and `--host-resolver-rules`. The qa.md row then says which part a human did.

#### Q-T0-41 NIT: HTML error pages have no stable markers

- Where: security §2.2 ("Every HTML error page shows: the code, the trace id, and one line with the next action"), app contract §6.
- Problem: QA must find the code and the trace id in free text. The `X-Trace-Id` header exists (contract §1.4), but the page text format is not fixed.
- Fix: put `data-error-code` and `data-trace-id` attributes on the page's main element. Until then, QA asserts the page text contains the code and the `X-Trace-Id` header value.

#### Q-T0-42 NIT: `qa-platform.test` URL mapping and run-time files are not stated

- Where: local-stack §3.
- Problem: QA assumes `https://qa-platform.test/<path>` serves `tests/fixtures/qa-platform/<path>`, with `.json` as `application/json`. QA also writes the JWKS there at run time, so that no test private key goes into git.
- Fix: state both in local-stack §3. QA git-ignores the generated files.

### R2.3 Effect on the T1 tests (QA work, round 2 of T1)

T1.md now folds in the hooks with more detail. Before the T1 round-2 run, QA updates its tests:

- H2: `seed.json` mode 600, `format = "cogniate-seed/1"`, and the WS services shape (`service`, `username`, `userid`, `token`, `functions`).
- H7: also check `cogniate-content.jsonl`.
- H8: the new text mounts only `root.crt` and `stack.crt` of `infra/.certs`. QA checks that both files are read-only and that no `*.key` file is visible, instead of checking the whole folder. Finding Q-T1-01 is re-judged against this text in T1 round 2.
- AC-T1-13: also run `npm run stack:node-reach-check`.
- AC-T1-11: the `git check-ignore` list adds `infra/.data/` and `.tmp/`.
