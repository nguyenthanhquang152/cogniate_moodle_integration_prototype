Verdict: PASS
Round: 1

# T2a QA verification

| Item | Value |
| --- | --- |
| SHA | `a2a5aa3f605da7ca5c4d2772da8589fc031026f4` (T2a code `7bfbbb1`, QA tests `a2a5aa3`) |
| Spec | `tasks/T2a.md` at `8f10cb2` (the Architect's answers). The SHA has the older text. QA also tested the two new parts of `8f10cb2`: AC-T2-19 (405 page) and AC-T2-15 (platform switched off between login and launch). The Author's notes for this round describe the same behavior. |
| Tests used | `a2a5aa3` plus the QA-side changes of this round (section 3). Changed files: `E/tests-diff-vs-sha.txt`. New files that this diff does not show: `tests/acceptance/T2a/seed-ui.spec.ts`, `tests/acceptance/T4b2/5-negative.spec.ts`, `tests/acceptance/T4b2/zz-headers-errors.spec.ts`, `tests/host/run-t4b.mjs` (only the first one is in the T2a scope). |
| Date | 2026-10-17 |
| Runner | `COMPOSE_PROJECT_NAME=qa-t2a-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 COURSE_FIXTURES_DIR=<repo>/docs/raw/data/courses node tests/host/run-t2.mjs --sha a2a5aa3… --tasks T2a --replace-tests` |
| Clean environment | New clone `~/cogniate-qa-runs/qa-t2a-r1-a2a5aa3f-2026-10-17T01-21-45-197Z`. Preflight: no project `qa-t2a-r1`, no QA volumes or networks, port 8443 and subnet 172.29.0.0/16 free. |
| Isolation | The QA stack ran next to the Author's stack (`cogniate-stack`, 5 containers). None of them stopped or restarted. After the run: 0 QA containers, 0 volumes, 0 networks. |
| Tools | macOS host: Node 24.21.0, Docker 29.8.2, Compose 5.5.1. e2e image: Playwright 1.56.0 (Chromium), Node 22.20. |
| Evidence root | `E` = `tests/host/artifacts/qa-t2a-r1-a2a5aa3f-2026-10-17T01-21-45-197Z/` (git-ignored, local, known secret values redacted). `E/summary.json` has every result with notes. |

The verdict comes from run 5, the full suite. The runner did these steps:

1. `seed:lti-manual` twice (host check).
2. Pass A: all T2a tests. 19 tests reported, 0 failed, 1 skipped (AC-T2-07, which runs only with its knob).
3. Knob pass: `LTIK_TTL_SECONDS=20`, `QA_GREP=AC-T2-07`. 1 test ran and passed.
4. `stack:reset`, `stack:up`, `seed`, `seed:lti-manual`.
5. Pass C: `QA_GREP=AC-T2-03|AC-T2-31`. 3 tests ran and passed.

Runs 1, 2 and 4 failed only because of QA test defects (section 3). Run 3 had the same results as run 5, without the two `8f10cb2` oracles.

## 1. Results per acceptance criterion

`A`, `K` and `C` are `E/container-passA/`, `E/container-knob/` and `E/container-passC/`. `vt` = `vitest-results.json`, `pw` = `playwright-results.json`.

| AC | Result | What QA saw | Evidence |
| --- | --- | --- | --- |
| AC-T2-01 | PASS | `GET /lti/keys/cogniate`: 200 JSON, RS256 public keys (`kty`, `kid`, `alg`, `use=sig`, `n`, `e`), no private members. Unknown account: 404. | `A/vt` |
| AC-T2-02 | PASS | `POST /api/platforms`: 201 with all fields of contract §3.9. Again: 409 `PLATFORM_ALREADY_EXISTS`. List, auth errors and account isolation are correct. | `A/vt` |
| AC-T2-03 | PASS | `cg_student` opens "Seed activity". A new window reaches `{PUBLIC_APP_URL}/tool/launch?resource=seed&ltik=…` in 10 s or less. The ltik has 43 characters. Pass C (after reset) gives the same result. | `A/pw`, `C/pw` |
| AC-T2-04 | PASS | `GET /api/idtoken`: 200. `user.id` = Moodle id of `cg_student`, Learner role, no email or name. `platform.*` = `ltiSeed` values, `productFamilyCode=moodle`. `launch.type`, `launch.target` and `launch.context.id` (course id of `COGNIATE-DEV-101`) are correct. `resourceLink.id` is not empty. `presentation.documentTarget` = the `document_target` value. `deepLinking.available=false`. | `A/pw` |
| AC-T2-05 | PASS | `?raw=true`: 200 with `iss`, `aud`, `sub`, message type and deployment id claims. | `A/pw` |
| AC-T2-06 | PASS | Five header cases, each 401 with the error shape: `qa-second` key, random ltik and no `:` give `INVALID_LTIK_AUTH_AUTHORIZATION_HEADER`. `Bearer` and `SERVICE-AUTH-V1` give `INVALID_AUTHORIZATION_HEADER`. | `A/pw` |
| AC-T2-07 | PASS | With the knob on (`/healthz` `knobs: [LTIK_TTL_SECONDS=20]`), the ltik works less than 10 s after the redirect and gets 401 at TTL + 3 s. After the restart, `knobs: []` again. | `K/pw`, `E/cmd/11-restart-lti-knob.log`, `E/cmd/13-restart-lti-default.log` |
| AC-T2-08 | PASS | The 302 goes to Moodle `auth.php` with all the OIDC parameters. `state` and `nonce` have 43 characters and are different in two launches. The cookie has `__Host-`, `Secure`, `HttpOnly`, `SameSite=None`, `Partitioned` and `Path=/`. | `A/pw` |
| AC-T2-12 | PASS | `iss=https://evil.test`: 400 page `UNKNOWN_PLATFORM`, no `Location`. `/lti/login/unknown`: 404 `UNKNOWN_TOOL_ACCOUNT`. | `A/vt` |
| AC-T2-13 | PASS | `target_link_uri=https://evil.test/x`: 400 page `INVALID_TARGET_LINK_URI`. | `A/vt` |
| AC-T2-14 | PASS | `deploymentIds:["999"]`: the launch stops at the login with page `UNKNOWN_DEPLOYMENT` (400, `login_rejected`). After the restore, the launch works. | `A/pw`, `A/service-logs/lti-service.jsonl` |
| AC-T2-15 | PASS | (1) `active:false` before the launch: 403 page `PLATFORM_NOT_ACTIVE` from the login (`login_rejected`). After `active:true`, the launch works. (2) **Between login and launch** (`8f10cb2` text): 403 page `PLATFORM_NOT_ACTIVE` from the launch, and `launch_check_failed {check: "platform_active", code: "PLATFORM_NOT_ACTIVE"}` with the same trace id. With the platform active again, the same id_token, state and cookie get 401 `INVALID_STATE` (`check: 1`). So the state is used up. | `A/pw`, `A/captured-error-pages.jsonl`, `A/service-logs/lti-service.jsonl` |
| AC-T2-16 | PASS | `lti-service.jsonl` has none of the captured ltiks, id_tokens, states or API keys. | `A/pw`, `A/captured-secrets.jsonl` (redacted) |
| AC-T2-18 | PASS | `qa-second` registers the same issuer and client id: 201 (its own record). A Moodle launch still belongs to `cogniate`: the `cogniate` key reads it, and the `qa-second` key gets 401. | `A/pw` |
| AC-T2-19 | PASS | The 303 has `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, and the state cookie with `Max-Age=0`. `GET /lti/launch/cogniate` (`8f10cb2` text): 405 page `data-error-code="METHOD_NOT_ALLOWED"`, `Allow: POST`, and `data-trace-id` equal to `X-Trace-Id`. | `A/pw`, `A/captured-error-pages.jsonl` |
| AC-T2-29 | PASS | `authConfig.key`, `accesstokenEndpoint` and `authenticationEndpoint` on `evil.test`: 400 `PLATFORM_URL_NOT_ON_ISSUER_ORIGIN`. Only `JWK_SET` is accepted. There is no `outbound_*` event for `evil.test`. The sink oracle is not available in the default profile (section 4). | `A/vt`, `A/service-logs/lti-service.jsonl` |
| AC-T2-31 | PASS | `seed:lti-manual` twice: exit 0 and the same `ltiSeed`. In Moodle (QA oracle WS), cmid 3 is LTI "Seed activity" in `COGNIATE-DEV-101` and cmid 4 is "Seed activity 102" in `COGNIATE-DEV-102`. The course pages link to them (UI). The `ltiSeed` platform is the same in the LTI service. After reset, up, seed and `seed:lti-manual`, `seed.json` has new values (new client id) that match the new stack, and the launch works (pass C). | `E/cmd/08…`, `09…`, `14…` to `17…`, `A/vt`, `A/pw`, `C/vt`, `C/pw` |
| AC-T2-17 | n/a | Merged into AC-T2-29 in the spec. | — |

### Test hooks

| Hook | Result | Evidence |
| --- | --- | --- |
| H1 (project, port, subnet from env) | PASS: five services under `qa-t2a-r1`. | `E/cmd/05-compose-config-name.log` |
| H3 (`stack:restart --env`) | PASS: the knob shows in `/healthz`, and `knobs: []` comes back after a restart without `--env`. | `E/cmd/11…`, `13…` |
| H14 (`QA_*` forwarding) | PASS: with `QA_TASK=T2a`, only T2a tests ran (0 outside T2a). With `QA_GREP=AC-T2-07`, only AC-T2-07 ran. | `E/summary.json` |

### The Author's contract additions (Lead's list)

The tests agree with all four. QA did not change an oracle to match them.

| Addition | QA result |
| --- | --- |
| `GET /lti/launch/…` → 405 page `METHOD_NOT_ALLOWED` | Agrees (AC-T2-19). Also `Allow: POST`. |
| `PLATFORM_NOT_ACTIVE` through `check: "platform_active"` | Agrees (AC-T2-15). |
| `outbound_blocked` with reason `network_error` | Not exercised: no T2a AC makes a blocked outbound call. AC-T2-29 is refused before any fetch (0 `outbound_*` events). T2b covers it. |
| `SERVICE-AUTH-V1` → 401 until T3a | Agrees (AC-T2-06: 401 `INVALID_AUTHORIZATION_HEADER` with the error shape). |

## 2. Findings

Counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 1 NIT.

### Q-T2a-01 — NIT — The `cmids` example in T2a.md uses course-id-like numbers (owner: Architect)

- **Location:** `tasks/T2a.md`, In, dev seed: "`cmids` = `{ "<course shortname>": <cmid> }`, for example `{ "COGNIATE-DEV-101": 2, "COGNIATE-DEV-102": 3 }`".
- **Problem:** On a fresh stack the course ids are 2 and 3, and the cmids are 3 and 4. The example shows the course ids, not the cmids. The keys are course shortnames, so a reader can take `cmids` for a course-id map. QA's own seed reader made this error in run 2 (section 3, item 2).
- **Suggested fix:** Use the real values in the example (`{ "COGNIATE-DEV-101": 3, "COGNIATE-DEV-102": 4 }`). Or add "cmid = `course_modules.id`, not the course id".

## 3. QA-side changes in this round

These are QA test defects. They are not product defects. Each one caused a failed run.

1. **Run 1 (`…2026-10-16T16-54-01-876Z`): `moodleLogin` with an open session.** Two launches in one browser context showed Moodle's "You are already logged in … Log out?" page. So AC-T2-03 and AC-T2-14 timed out in `beforeAll`. Fix: `lib/moodle-ui.ts` logs out first when there is a session.
2. **Run 2 (`…2026-10-17T01-07-49-293Z`): the seed reader took a cmid as a course id.** The reader finds course ids by the key name `COGNIATE-DEV-10x`. It also walked into `ltiSeed.cmids`, so it read the cmid 3 as the course id of `COGNIATE-DEV-101`. So AC-T2-04 (`context.id` 2 ≠ 3) and AC-T2-31 failed. The product values were correct. Fix: `lib/seed.ts` and `host/lib.mjs` skip `ltiSeed` and `cmids`. Checked on the real `seed.json`: courses 2 and 3, users 2 to 5.
3. **Run 2: serial skip.** `T2a/launch.spec.ts` was serial, so AC-T2-05, -06, -08, -18 and -19 did not run after the AC-T2-04 failure. Fix: default mode. A failure starts a new worker, and `beforeAll` runs again.
4. **New oracles for the `8f10cb2` text** (AC-T2-19 page code and `Allow`, AC-T2-15 between login and launch). In run 4 (`…2026-10-17T01-19-18-370Z`), the first AC-T2-15 version tried to hold the GET to Moodle `auth.php`. Playwright routes see only the first URL of a redirect chain, so the hook did not run and the platform stayed active (the log shows no PATCH between login and launch). Fix: QA holds Moodle's id_token POST and sends it after the PATCH. This is still between login and launch.
5. **AC-T2-31 UI oracle** (`T2a/seed-ui.spec.ts`, new) and a module list in the AC-T2-31 WS failure message.
6. **Runner:** H14 checks in `run-t2.mjs`, the `fresh` option in `core.mjs`, `SETUP` in the result id pattern. After run 5, `core.mjs` also lists new (untracked) files in `tests-diff-vs-sha.txt`.

For this round, no new SHA is necessary: `--replace-tests` copied the working-copy tests into the clean clone. The Lead can commit `tests/**` as it is now.

## 4. Not covered

- **AC-T2-29, sink oracle:** the default profile has no `evil.test` sink. T2b repeats AC-T2-29 in the `acceptance` profile with all three oracles.
- **`outbound_blocked` / `network_error`:** no T2a AC makes this call. T2b covers it.
- **H9** (a rerun makes the platform again after `DELETE`): the spec moves it to T3c, AC-T3-19.
- **The unit tests of each check:** Author scope. QA tests only the black box.
