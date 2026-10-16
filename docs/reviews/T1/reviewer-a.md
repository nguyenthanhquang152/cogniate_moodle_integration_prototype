Verdict: CHANGES_REQUESTED
Round: 1

# Reviewer-A: T1 review (lens: "Is it right and is it safe?")

Scope: `git diff cfe30c1 bc530a7` (67 files), checked against `docs/architecture/tasks/T1.md` and `docs/architecture/local-stack.md` as they are in the working tree.

Focus (from the Lead): TLS and CA handling, Moodle dev security settings, the scope of the web service tokens and of the QA oracle, secrets, idempotency of provisioning, port exposure.

Method:

- I read all infra scripts, the PHP provisioning, `compose.yaml`, the Caddyfile and `packages/shared`.
- I made read-only checks on the running `cogniate-stack`:
  - `docker inspect` for mounts and ports.
  - `openssl` and `curl --resolve … --cacert` for TLS.
  - One read-only PHP query in the Moodle container for config, services, roles and counts. I deleted my temp file after the query.
  - A scan of the container logs, `infra/.logs` and all tracked files for the values in `.env` and `seed.json`. The scan printed names and counts only.
- I did not touch the `qa-*` projects. I did not read any other review file.

Counts: 0 BLOCKER, 1 MAJOR, 5 MINOR, 1 NIT.

---

## MAJOR

### A-T1-01 — MAJOR — The dev CA can sign certificates for any domain for 10 years, and the README tells humans how to trust it system-wide

- **Location:** `infra/scripts/gen-certs.sh:22-35` (CA config); `infra/README.md:96-100` ("Trust `infra/.certs/root.crt` in the login keychain").
- **Problem:** The CA has no name constraints and is valid until 2036. If a human follows the README and trusts it in the keychain, then any program that reads `infra/.certs/ca.key` can intercept every HTTPS site on that Mac.
- **Evidence:**
  - `openssl x509 -text` on `root.crt` shows `CA:TRUE, pathlen:0`, `Not After: Oct 13 2036`, and **no Name Constraints**.
  - `ca.key` has mode 600, so every process of the user can read it. That includes the lifecycle scripts of about 300 npm packages that run on each `npm ci` in this repo. The path is fixed and easy to guess.
  - The README has a CAUTION, but the risk does not go away when the human forgets to remove the trust.
  - The containers are safe: `ca.key` is mounted in no container (`docker inspect`), and the e2e container hides it with a tmpfs.
- **Fix:**
  - Add `nameConstraints = critical, permitted;DNS:test` to `[v3_ca]`. This allows `moodle.test`, `*.cogniate.test`, `*.cogniate-content.test`, and the later `evil.test` and `qa-platform.test`. Name constraints are part of RFC 5280, and current macOS and Chrome verifiers enforce them.
  - Shorten the CA life, for example to 825 days.
  - In `gen-certs.sh`, if an existing CA has no constraint, make a new CA, and print that the human must trust it again.
  - Optional: leave the host name out of the CA CN. It shows in screenshots and HAR files.
  - If the Lead removes the keychain step from the README instead, this finding becomes MINOR.

---

## MINOR

### A-T1-02 — MINOR — The web service setup gives more access than needed, and the QA oracle has no dev-only guard

- **Location:** `infra/moodle/php/setup_webservices.php:20-31, 50, 122-125`; `infra/scripts/seed.sh:34`; `infra/scripts/demo.sh:11`.
- **Problem:** Both services can download and upload files. The QA oracle has the full manager role. So each token can do more than its function list says.
- **Evidence:**
  - **Files.** Both services are made with `downloadfiles = 1` and `uploadfiles = 1` (my check of the DB confirms this). `webservice/pluginfile.php` checks only the token and `downloadfiles`, then serves files with the capabilities of the token user. The function whitelist does not limit this. So:
    - The oracle token (manager archetype, 560 capabilities, including `moodle/backup:backupcourse`) can download any file that a manager can read, including course backups.
    - The product token can read the content files of every course that its system role can view.
  - **Product role.** It has `moodle/webservice:createtoken`, which the setup does not need. It also has `moodle/role:assign` with the right to assign `editingteacher`, plus `moodle/user:viewalldetails`, `moodle/site:viewuseridentity` and `moodle/course:useremail`. T1 asks for the nine spike functions, so this follows the spec. But T4 needs only `core_webservice_get_site_info`, `core_course_get_courses_by_field` and `core_course_create_courses`. The admin guide will probably copy this set to customer sites.
  - **No guard.** `npm run seed` and `npm run demo` always install the oracle. The script does not check that it runs on a dev site.
  - **Drift.** Reruns only add functions and capabilities. They never remove ones that are no longer in the list, so a later least-privilege change does not reach existing stacks.
- **Fix:**
  - Set `downloadfiles = 0` and `uploadfiles = 0` for both services, and update existing rows on rerun.
  - Give the oracle role only the capabilities that its six functions need, instead of the manager archetype.
  - Refuse `--profile=qa_oracle` unless the wwwroot host ends with `.test`.
  - Remove `moodle/webservice:createtoken` from the product role.
  - Make each rerun sync the lists, so that it removes extra functions and capabilities.
  - Ask the Architect to cut the product service to the functions that T4 uses, before the admin guide is written.

### A-T1-03 — MINOR — The e2e container mounts the whole repo read-write and can read `.env`

- **Location:** `infra/compose.yaml:169-182`; `infra/scripts/qa-suite.sh:20-21`; T1 scope H8 ("The `e2e` container mounts the repo, `infra/.secrets` and `infra/.logs` read-only").
- **Problem:** QA test dependencies run as root with write access to product code, infra scripts and `.git/hooks`, and with read access to every secret in `.env`. H8 asks for a read-only repo.
- **Evidence:**
  - `..:/repo` has no `:ro`. The compose comment says "The repo is read-write".
  - `.env` is at `/repo/.env`. It holds `LTI_MASTER_KEY`, `APP_MASTER_KEY`, `DB_PASS` and all passwords. A black-box suite needs only `seed.json`.
  - `npm ci --prefix tests` runs package lifecycle scripts. A script that writes `.git/hooks/*` or `infra/scripts/*.sh` gets code execution on the host later.
  - The H8 table checks only `.secrets`, `.logs` and the keys, so QA's check passes anyway.
- **Fix:**
  - Mount `..:/repo:ro`.
  - Add writable mounts only for the test output folders (for example `tests/test-results` and `tests/playwright-report`), and keep the `tests/node_modules` volume.
  - Bind `/dev/null` over `/repo/.env`.
  - Consider `npm ci --ignore-scripts` for the QA project.

### A-T1-04 — MINOR — The shared logger redacts only some exact top-level keys, and `http_request` logs the raw path

- **Location:** `packages/shared/src/logger.ts:35-46`; `packages/shared/src/http.ts:58-63`.
- **Problem:** The common names for secrets in our contracts are not redacted. Secrets inside nested objects are not redacted. URL paths that will carry capability ids are logged in full.
- **Evidence:**
  - `REDACT_KEYS` matches lower-cased keys exactly. So `serviceKey`, `apiKey`, `accessToken`, `idToken`, `registrationToken` and `clientAssertion` (the camelCase names in the contracts) are not redacted.
  - `redact()` does not look into nested objects. So `{ headers: { authorization } }` or an error object with `config.headers` is logged as it is.
  - `http_request` logs `path`. From T4 and T5 on, paths include `/play/{playId}`, `/lti/picker/{pickerId}` and `/rt/{runtimeToken}`. AC-T5-19 and AC-T7-10 require that runtime tokens are not in logs.
  - My scan found **no** secret in today's logs (0 hits for 13 values). This is a risk for later tasks, not a leak now.
- **Fix:**
  - Normalise key names before the check (lower case, with `_` and `-` removed), and redact recursively.
  - Add value patterns: JWT `eyJ…\.…\.…`, the `ltis_` API key prefix, `Bearer `, and `ltik=` in strings.
  - Log the route template (for example `/play/:playId`) instead of the raw path, or add a path redaction hook that T4 and T5 must use.
  - Add a unit test for each rule.

### A-T1-05 — MINOR — `stack:restart` accepts overrides that `/healthz` does not report, and the knob file stays active without a warning

- **Location:** `infra/scripts/stack-restart.sh:23-52`; `infra/scripts/lib.sh:54-59`; `packages/shared/src/knobs.ts`.
- **Problem:** A test can set any environment variable on a service, and the stack does not show it. Also, every later `stack:up`, `seed` or test run uses the knob file without a warning.
- **Evidence:**
  - `--env` accepts any `KEY=VALUE`. For a key that is not registered, it only prints a warning, and `/healthz` and `test_knob_active` list registered knobs only.
  - So `NODE_TLS_REJECT_UNAUTHORIZED=0` (no TLS checks in Node) or a changed `NODE_EXTRA_CA_CERTS` can be active, while `/healthz` says `knobs: []`.
  - local-stack.md says: "There is no 'dev mode' that turns off a check". T7 says that the E2E runs with no knobs. Neither can be proved with `/healthz` today.
  - `dc()` adds `.tmp/compose.knobs.yaml` to every compose command, with no message.
- **Fix:**
  - Refuse unregistered keys, or allow them only with `--unsafe` and report every override key in `/healthz` (for example in `overrides`).
  - Make `stack:up`, `seed` and `qa-suite.sh` print a CAUTION line while the knob file exists.
  - Give T7 a pre-check that fails when the knob file exists.

### A-T1-06 — MINOR — The Moodle curl rule in the code is better than the spec, but no check proves what stays blocked

- **Location:** `infra/moodle/php/setup_dev_network.php`; `docs/architecture/tasks/T1.md` (scope: "blocked hosts = default minus `172.16.0.0/12`"); `docs/architecture/local-stack.md` §2 "Moodle dev-only"; `infra/compose.yaml:36` and `.env.example:18` ("must be inside 172.16.0.0/12").
- **Problem:** The spec says that the whole `172.16.0.0/12` block is opened. The code opens only `STACK_SUBNET`. No AC or script proves that the other ranges and ports stay blocked.
- **Evidence:**
  - Live value of `curlsecurityblockedhosts`: `127.0.0.0/8`, `192.168.0.0/16`, `10.0.0.0/8`, `172.16.0.0/13`, `172.24.0.0/14`, `172.30.0.0/15`, `172.29.0.0/16`, `0.0.0.0`, `localhost`, `169.254.169.254`, `0000::1`. That is exactly `172.16.0.0/12` minus `172.28.0.0/16`.
  - Live value of `curlsecurityallowedport`: `443` only. Port 80 was removed, which is stricter than the default. Nothing in the subnet listens on 443 except the proxy, so Moodle can reach only the proxy. This is correct and safer than the spec.
  - The PHP also accepts subnets inside `10.0.0.0/8` and `192.168.0.0/16`, but the comments say "must be inside 172.16.0.0/12".
  - AC-T1-05 proves only that the one opening works.
- **Fix:**
  - Change the text in T1 and local-stack.md to the rule in the code ("default list, with only `STACK_SUBNET` cut out; ports 443 and `PUBLIC_PORT`"), and fix the two comments.
  - Add negative cases to `stack:moodle-reach-check`, or an AC. Each URL must be blocked:
    - `https://169.254.169.254/`
    - `http://moodle.test/` (port 80)
    - `https://postgres:5432/`
    - an address in `172.17.0.0/16`

---

## NIT

### A-T1-07 — NIT — `infra/.logs` is world-writable

- **Location:** `infra/scripts/stack-up.sh:11` (`chmod 777 "$LOGS_DIR"`).
- **Problem:** Any local user or process can add or replace the log files that QA uses as evidence (H7).
- **Evidence:** With Docker Desktop on macOS, writes from a bind mount show as the host user, so 777 is not needed there. The live log files have the owner `quangnguyen`.
- **Fix:**
  - On macOS, use 700.
  - On Linux hosts, use `user: "${UID}:${GID}"` for the Node services, or a group with mode 1770.

---

## Verified as correct (no action)

- **Ports.**
  - Exactly one published port: `127.0.0.1:443->443/tcp` on the proxy.
  - Moodle `8080/tcp` and Postgres `5432/tcp` are only exposed inside the network, not published.
  - The Caddy admin API listens on `127.0.0.1:2019` inside the proxy only.
- **Key placement.**
  - `ca.key` is mounted in no container.
  - `stack.key` is mounted only in the proxy, read-only.
  - The Node containers get only `root.crt`, run as `node`, and mount code read-only.
  - Each master key goes only to its own service.
  - The e2e container hides `infra/.certs` with a tmpfs that holds the public certificates only (from `compose.yaml`; I did not start it).
- **TLS.**
  - The leaf has SAN = exactly the four names, `CA:FALSE`, `serverAuth`, and is valid for 397 days.
  - All four hosts give HTTP 200 with `ssl_verify=0` against `root.crt`.
  - Without the CA, verification fails (curl error 60).
  - An unknown SNI (`evil.test`) gets a TLS alert. Plain HTTP to port 443 gets 400.
  - Moodle trusts the CA through `moodledata/moodleorgca.crt` (Alpine bundle + root).
- **Moodle settings.** `noemailever=1`, `sslproxy=1`, `cookiesecure=1`, `debug=0`, `debugdisplay=0`. The curl settings are as listed in A-T1-06.
- **Secrets.**
  - `.env` has mode 600. `infra/.certs` and `infra/.secrets` have mode 700. `seed.json` has mode 600 and is written atomically.
  - Passwords reach the PHP scripts on stdin, not in command lines.
  - No value from `.env` or `seed.json` appears in any container log, in `infra/.logs` (all lines are valid JSON), or in any of the 457 tracked files.
  - The spike credentials were removed from `SPIKE-NOTES.md`, and no spike secret files are left.
  - `git check-ignore` covers `.env`, `infra/.certs`, `infra/.secrets`, `infra/.logs` and `.tmp`.
- **Idempotency.**
  - After seed, the live counts are clean: 7 users, 3 courses, 6 enrolments, 8 role assignments, 2 tokens.
  - Each service has `restrictedusers=1`, one authorised user and one permanent token.
  - Users, courses, enrolments, roles, services and tokens are found again by name, so a rerun makes no duplicates.
  - `setup_dev_network.php` computes from the defaults each time, so its result does not grow with reruns.
- **Demo browser.** `demo:browser` changes nothing on the Mac. It accepts only the SPKI of our leaf, in a throwaway profile.
