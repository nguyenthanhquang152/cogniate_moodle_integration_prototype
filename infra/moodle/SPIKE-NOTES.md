# Spike notes: local Moodle 5.2.4 for the LTI prototype

Author spike, 2026-10-16. Host: macOS, Docker Desktop 29.8.2 (8 GB, 12 CPU), Compose v5.5.1.
Status words: **VERIFIED** = I ran it and saw the result. **NOT VERIFIED** = read in code or inferred only.
Paths below are relative to `infra/moodle/`. The QA role must verify these facts again; this is Author evidence only.

## 0. Status: historical

This file records the T1-spike (2026-10-16): facts and evidence only. The spike stack (`http://localhost:8080`, socat sidecar, project `cogniate-moodle`) was removed in T1.
The current stack is `infra/compose.yaml` (HTTPS, four `.test` names). See `infra/README.md` for commands.
The spike scripts named below (`scripts/up.sh`, `scripts/spike-verify.sh`, `spike_*.py`, `spike_fake_tool.php`, `curl_probe.php`) were deleted in T1. The PHP helpers moved to `infra/moodle/php/`.
No credential, token or client id from the spike is kept here. Those values were local and were deleted with the spike volumes.

## 1. Bring-up — VERIFIED

- Compose project `cogniate-moodle`: `postgres` (16-alpine), `moodle` (erseco/alpine-moodle:v5.2.4), `tool-proxy` (alpine/socat).
- Admin user comes from env: `MOODLE_USERNAME` / `MOODLE_PASSWORD` (the image runs `admin/cli/install.php` + `install_database.php`).
- Time to healthy: **31 s** on a fresh install (measured two times, spike stack). **16 s** for `down` + `up` with data. **8 s** for `restart moodle`.
- Persistent volumes: `cogniate-moodle_pgdata` (about 100 MB) and `cogniate-moodle_moodledata` (60–86 MB). After `down`/`up`: courses=2, lti_types=1, scoes=2, tokens=1 (data kept).
- `config.php` is not on a volume. The entrypoint writes it again on each start from env. So env is the only config source.
- wwwroot: `SITE_URL=http://localhost:8080`. Evidence: `scripts/moodle-cfg.sh --name=wwwroot` → `http://localhost:8080`.
  To change it, edit `SITE_URL` and the port mapping, then `docker compose up -d`. Keep host port = 8080: nginx in the container listens on 8080. If the ports are the same, `http://localhost:8080` also works inside the container.
  A request to another host name redirects: `curl http://127.0.0.1:8080/` → `303 → http://localhost:8080/`.
- Health check (compose): `curl -fsS -o /dev/null http://localhost:8080/login/index.php`. The image default (`/fpm-ping`) only shows PHP-FPM.

## 2. CLI — VERIFIED

- Moodle 5.2 has the split layout. Code root `$CFG->root=/var/www/html`. Web root `$CFG->dirroot=/var/www/html/public`. `config.php` is at the root. `public/config.php` is a loader stub.
- CLI scripts are at the root, not under `public/`: `/var/www/html/admin/cli/{cfg,backup,restore_backup,upgrade,...}.php`.
- PHP: `/usr/local/bin/php`, PHP 8.3.15. User: `nobody` (uid 65534). `docker compose exec` uses this user by default.
- Wrappers: `scripts/moodle-cfg.sh --name=X [--set=Y] [--component=Z]` and `scripts/moodle-php.sh <script|-r code>`.
- Custom scripts: mount read-only at `/opt/cogniate/php`. Start with `define('CLI_SCRIPT', true); require('/var/www/html/config.php');`.
- Evidence: `dirroot=/var/www/html/public root=/var/www/html wwwroot=http://localhost:8080 release=5.2.4 (Build: 20261005)`.

## 3. Web services — VERIFIED

`scripts/php/setup_webservices.php` (idempotent) does these steps:
1. It sets `enablewebservices=1` and adds `rest` to `webserviceprotocols`.
2. It makes the user `cogniate_integration` (manual auth, random password).
3. It makes the system role `cogniateintegration` with only the needed capabilities. The role may assign student/teacher (this is necessary for `enrol_manual_enrol_users`).
4. It makes the external service `cogniate_integration` (restricted users, 9 functions): `core_webservice_get_site_info`, `core_course_create_courses`, `core_course_get_courses_by_field`, `core_course_get_contents`, `core_course_get_categories`, `core_course_create_categories`, `enrol_manual_enrol_users`, `core_user_create_users`, `core_user_get_users_by_field`.
5. It makes a permanent token with `\core_external\util::generate_token()`. A second run returns the same token.

```text
$ curl -s "http://localhost:8080/webservice/rest/server.php?wstoken=$TOKEN&wsfunction=core_webservice_get_site_info&moodlewsrestformat=json"
{'sitename': 'Cogniate_Dev_Moodle', 'username': 'cogniate_integration', 'release': '5.2.4 (Build: 20261005)', 'siteurl': 'http://localhost:8080', ...}
functions: [9 names above]
bad token → {"errorcode":"invalidtoken","message":"Invalid token - token not found"}
```

Through REST with this token I also did: `core_course_create_courses` → `[{"id":3,"shortname":"COGNIATE-WS-1"}]`, `core_user_create_users` → `[{"id":6,...}]`, `enrol_manual_enrol_users` → `null` (success, user has role `student`), `core_course_get_contents` → sections JSON.
Note: curl glob trap. Send `values[0]=...` in the POST body (or use `curl -g`), not in the URL.

## 4. Users and course — VERIFIED

`scripts/php/setup_users_course.php --teacherpass=.. --studentpass=..` (idempotent) gives:
`{"courseid":2,"shortname":"COGNIATE-DEV-101","teacher":{"id":4,"roles":["editingteacher"]},"student":{"id":5,"roles":["student"]}}`.
The student web login works: `POST /login/index.php` → `303 → /login/index.php?testsession=5`.

## 5. LTI 1.3

### 5a. Preconfigured tool from CLI — VERIFIED

- Moodle 5.2.4 still has LTI only in `public/mod/lti`. There is no `core_ltix` / `ltix` code in this build (grep is empty). `public/mod/lti/UPGRADING.md` has no move note.
- Admin UI: Site administration > Plugins > Activity modules > External tool > **Manage tools** = `/mod/lti/toolconfigure.php`. Preconfigured list = `/admin/settings.php?section=modsettinglti`.
- `scripts/php/setup_lti_tool.php` calls `lti_add_type($type, $config)` with `$type->state = LTI_TOOL_STATE_CONFIGURED` (1). Without it, the default is PENDING (2). On rerun it calls `lti_update_type` and keeps the client_id.
- client_id: auto-generated (`random_string(15)`) for `1.3.0`. **deployment_id = tool type id.** **issuer = `$CFG->wwwroot`.**
- Config keys used (`lti_` prefix is removed when stored, `ltiservice_` is kept):

| Key | Value used | Allowed values |
| --- | --- | --- |
| `lti_typename`, `lti_toolurl`, `lti_description` | name, launch URL | text (go to `lti_types` columns) |
| `lti_ltiversion` | `1.3.0` (`LTI_VERSION_1P3`) | `LTI-1p0`, `LTI-2p0`, `1.3.0` |
| `lti_keytype` | `JWK_KEYSET` | `RSA_KEY`, `JWK_KEYSET` |
| `lti_publickeyset` | tool JWKS URL | URL (`lti_publickey` for RSA_KEY) |
| `lti_initiatelogin` | tool login URL | URL |
| `lti_redirectionuris` | launch URL | one URL per line |
| `lti_contentitem` | 1 | 0 / 1 (Deep Linking) |
| `lti_toolurl_ContentItemSelectionRequest` | deep link URL | URL (stored in `lti_types_config`) |
| `ltiservice_gradesynchronization` | 2 | 0 off, 1 grade sync only, 2 sync + line item management |
| `ltiservice_memberships` | 1 | 0 / 1 (NRPS) |
| `lti_sendname`, `lti_sendemailaddr` | 0, 0 (privacy default) | 0 never, 1 always |
| `lti_acceptgrades` | 2 | 0 never, 1 always, 2 as set in the activity / deep link |
| `lti_launchcontainer` | 4 | 2 embed, 3 embed without blocks, 4 new window, 5 existing window |
| `lti_coursevisible` | 2 | 0 no, 1 preconfigured list, 2 also in the activity chooser |
| `lti_forcessl`, `lti_organizationid_default` | 0, `SITEID` | 0/1; `SITEID`/`SITEHOST` |

### 5b. Dynamic registration — VERIFIED (simulated tool, `scripts/spike_dynreg.py`)

Moodle 5.2 supports LTI Advantage dynamic registration. Code: `startltiadvregistration.php`, `openid-configuration.php`, `openid-registration.php`, `classes/local/ltiopenid/registration_helper.php`.
1. The admin pastes the tool URL in Manage tools ("Add LTI Advantage"). The JS opens `startltiadvregistration.php?url=..&sesskey=..` in an iframe.
2. Moodle redirects (302) to the tool URL with `openid_configuration` and `registration_token`.
   The token is an RS256 JWT signed with the platform key: `{'sub': '<new client_id>', 'scope': 'reg', 'iat', 'exp': iat+3600}`.
3. The tool GETs the openid configuration (public, no auth). `registration_endpoint=http://localhost:8080/mod/lti/openid-registration.php`.
4. The tool POSTs its registration with `Authorization: Bearer <registration_token>`. Moodle returns `client_id`, plus `deployment_id` (= type id) inside `https://purl.imsglobal.org/spec/lti-tool-configuration`.
5. The tool closes the window with `postMessage({subject:'org.imsglobal.lti.close'})` (code only; NOT VERIFIED in a browser).
- **Result: the new tool is PENDING (state 2).** An admin must click "Activate" in Manage tools. Moodle sets fixed values: `launchcontainer=3`, `coursevisible=1`. Scopes map to services (AGS lineitem → `gradesynchronization=2`, NRPS → `memberships=1`).
- If a tool with the same domain exists, Moodle first shows an "update or register new" page. `type=0` = register as new.
- No https check in this flow (it worked over http).

### 5c. Platform endpoints — VERIFIED

| Item | Value |
| --- | --- |
| Issuer / platform ID | `http://localhost:8080` |
| Auth request URL | `http://localhost:8080/mod/lti/auth.php` |
| Access token URL | `http://localhost:8080/mod/lti/token.php` (client_credentials + `private_key_jwt`, RS256) |
| Keyset URL | `http://localhost:8080/mod/lti/certs.php` → `200 application/json`, `{"keys":[{"kty":"RSA","alg":"RS256","kid":"21dc2b65…","use":"sig",...}]}` |
| OpenID config | `http://localhost:8080/mod/lti/openid-configuration.php` |
| Platform key | `config_plugins` `mod_lti/privatekey` + `mod_lti/kid` (made at install). `cfg.php --component=mod_lti --name=kid` = JWKS kid. |

### 5d. Full LTI 1.3 round trip without a real tool — VERIFIED (`scripts/spike-verify.sh`, on a fresh reset)

```text
== WS site info          cogniate_integration 5.2.4 (Build: 20261005) 9 functions
== Token                 access_token ok; tool stub saw: 1 JWKS fetch(es) from Moodle   ← Moodle → http://localhost:3000/jwks.json via sidecar
== Launch                login initiation form action: http://localhost:3000/lti/login
                         fields: iss, target_link_uri, login_hint=5, lti_message_hint, client_id, lti_deployment_id=1
                         auth.php form action: http://localhost:3000/lti/launch  fields: [id_token, state]  (state round-trips)
                         signature: valid; sub=5; iss=http://localhost:8080
== AGS score 80/100      POST .../mod/lti/services.php/2/lineitems/2/lineitem/scores?type_id=1 → 200; gradebook: 80.00000 / 100.00000
== NRPS                  members: [('5', ['Learner'], name=False, email=False), ('4', ['Instructor'], False, False)]
```

The id_token has `deployment_id`, `message_type=LtiResourceLinkRequest`, `context`, `resource_link`, roles, AGS `endpoint` (lineitems + lineitem), NRPS `namesroleservice`, `launch_presentation.return_url`. It has no name or email (sendname=0). **id_token `exp` = `iat` + 60 s.** Access token `expires_in` = 3600.

## 6. Networking — VERIFIED (recommendation at the end)

Rule: the browser and the Moodle container must use the same URLs: Moodle `http://localhost:8080`, tool `http://localhost:3000`.

| Option | Container → host tool | Browser can use same URL | Moodle curl allowed |
| --- | --- | --- | --- |
| (i) `host.docker.internal:3000` | VERIFIED works (resolves to 192.168.65.254) | **No**: the host cannot resolve it (`curl` exit 6, no `/etc/hosts` entry) | Only if `192.168.0.0/16` is unblocked |
| (ii) socat sidecar, `network_mode: service:moodle`, `localhost:3000 → host.docker.internal:3000` | VERIFIED `curl http://localhost:3000/hello.json` in the Moodle container → 200. The host server binds 127.0.0.1 only. | **Yes** | After the dev change below |
| (iii) `*.localhost` names | VERIFIED: `tool.localhost` → 127.0.0.1 in PHP and on the host, works through the same sidecar | Yes | Same change. No reverse proxy needed or built. |

Moodle curl security (defaults in 5.2.4, VERIFIED with `scripts/php/curl_probe.php`):
- `curlsecurityblockedhosts` = `127.0.0.0/8, 192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12, 0.0.0.0, localhost, 169.254.169.254, 0000::1`.
- `curlsecurityallowedport` = `443, 80`.
- Result with defaults: `localhost:3000`, `127.0.0.1:3000`, `host.docker.internal:3000` → `The URL is blocked.`
- Moodle resolves the name first and blocks on the IP. mod_lti uses this check for the tool JWKS fetch (`token.php`, deep-link return).

Dev change (`scripts/php/setup_dev_network.php`, `--restore` puts the defaults back):
- Remove loopback only: blocked = `192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12, 0.0.0.0, 169.254.169.254`.
- Allowed ports = `443, 80, 3000`.
- After: `localhost:3000` → 200, `127.0.0.1:3000` → 200, `host.docker.internal:3000` → blocked, `localhost:3001` → blocked.

Sidecar caveat (VERIFIED and fixed): after `restart moodle`, the plain socat sidecar kept the old network namespace (`curl` → 000). The compose file now has a watchdog loop. It exits when port 8080 is gone, and `restart: unless-stopped` joins the new namespace. After two restarts of moodle only, and one restart of both, the forward worked again when Moodle was healthy.

**Recommendation:** use option (ii).
- Moodle stays at `http://localhost:8080`. Container port = host port, so the URL works for the browser, for the tool on the host, and inside the container.
- Run the tool on the host at `http://localhost:3000` (`npm run dev`).
- The sidecar makes the tool URL the same inside the Moodle container.
- Change curl security for loopback + port 3000 only.
- Why not (i): the browser cannot use `host.docker.internal`, and it needs a wider unblock (`192.168.0.0/16`).
- If the tool later runs in a container: put it in the Moodle namespace too (`network_mode: service:moodle`, publish 3000 on the `moodle` service). NOT VERIFIED.

## 7. Cookies and https — VERIFIED (header) / code

- Header over http: `Set-Cookie: MoodleSession=...; path=/; HttpOnly; SameSite=Lax`. There is no `Secure` flag.
- Code: `session/manager.php:390-395` sets `SameSite=Lax`, and `None` only for the Moodle mobile app. `is_moodle_cookie_secure()` (`sessionlib.php:93-103`) needs `$CFG->cookiesecure` (default 1, current value 1) AND https or `$CFG->sslproxy`. I found no setting for SameSite in this code (it is fixed).
- LTI cross-site handling (code, NOT VERIFIED cross-site): if no session cookie arrives, `mod/lti/auth.php` (and `contentitem_return.php`) shows `repost_crosssite_page`. That page POSTs the form to itself again, as a same-site request, so the Lax cookie is sent.
- https: the LTI 1.3 launch, token, AGS, NRPS and dynamic registration all worked over plain http (section 5d). Moodle does not enforce https. `lti_forcessl` only changes launch URLs to https.
- CAUTION: `http://localhost:3000` and `http://localhost:8080` are the **same site** (ports are not part of the site). So dev does not test the cross-site cookie path that production has (tool on another domain).

## 8. SCORM native + backup — VERIFIED

- Staging (untrusted data): `scripts/stage-fixture.sh` copies the zip (no extract on the host) into an emptied `.data/fixtures/`. That dir is mounted read-only at `/opt/cogniate/fixtures`. sha256 `a685744e5fd9de21c203c3b2f47916ef1079532196ed870df89a00ab8ee76df7`, 12,724,251 bytes.
  The script empties the dir in place. `rm -rf` + `mkdir` broke the bind mount (the container saw an empty dir).
- `scripts/php/add_scorm_activity.php`: zip → admin draft area → `add_moduleinfo()` (`scormtype=local`). Moodle parsed it in **0.14 s**:
  `version SCORM_1.2`; scoes: `org-01M2M36B46JZVWKZDB6ETGA9R6-v2` (organization), `item-001` (sco, launch `index.html`); `masteryscore=70`; 7 content files (`index.html` 925,985 B, `lesson-ai-web-sprint.html`, `scorm-api.js`, `style.css`, `lyra.mp4` 10,721,508 B, logo, manifest).
- Student view: `player.php` → 200, `loadSCO.php` → 200, `pluginfile.php/<ctx>/mod_scorm/content/1/index.html` → 200 (925,985 B), mp4 range request → 206 `video/mp4`. I did not run the SCORM API in a browser (NOT VERIFIED).
- Backup: `scripts/backup-course.sh 2 [--nousers]` (uses `admin/cli/backup.php`). It takes about 1 s.
  - Default: **23,174,563 B** `.mbz`. It has `users=1`, 2 user records, and activities `scorm`, `lti`, `forum`. It holds 13 file records. The package zip (12.7 MB) and the extracted mp4 (10.7 MB) are both inside.
  - `--nousers` (sets `backup | backup_general_users=0` for the run, then 1 again): 23,173,229 B, `users=0`, no `users.xml`, name ends in `-nu`.
  - Restore of this `.mbz` on another site was NOT VERIFIED. The LTI activity in it points to a site tool type, so the mapping on another site is unknown.

## 9. Resources and teardown — VERIFIED

`docker stats` (idle after the tests): moodle 73–119 MiB, postgres 30–65 MiB, tool-proxy 1–3 MiB, CPU < 4 %.
Peak (`/sys/fs/cgroup/memory.peak`): moodle 210 MiB, postgres 44 MiB. The 8 GB Docker limit has a lot of headroom.
Image sizes: moodle 1.6 GB, postgres 411 MB, socat small.

- Stop, keep data: `docker compose down`
- Full reset: `./scripts/reset.sh`, then `./scripts/up.sh && ./scripts/provision.sh`. Measured: 31 s + 1 s.
- New credentials too: `rm .env` before `up.sh`.
- Remove images: `docker image rm erseco/alpine-moodle:v5.2.4 postgres:16-alpine alpine/socat:latest`.

## Risks for the end-to-end LTI flow

1. Dev hides cross-site cookie problems (section 7). Test once with the tool on another site name, or with https and a real domain, before we claim production behaviour.
2. MoodleCloud: we cannot change `curlsecurityblockedhosts` there. The tool JWKS URL must be public https on port 443.
3. Dynamic registration creates a PENDING tool. The admin must click "Activate". The connect UX must show this step.
4. The id_token is valid for 60 s (`exp` = `iat` + 60). The tool clock must be in sync, and the tool must validate the token at once.
5. `alpine/socat:latest` is not pinned. Pin it by digest for repeatable builds.
6. The AGS test used the line item that Moodle makes for an activity with grade 100. Line items from Deep Linking or from `POST lineitems` were not tested.
7. `.mbz` restore to MoodleCloud with an LTI activity inside: not tested.

## Files

`docker-compose.yml`, `.env.example`, `.gitignore`, `scripts/{up,reset,gen-env,provision,stage-fixture,backup-course,moodle-php,moodle-cfg,spike-verify}.sh`, `scripts/lib.sh`, `scripts/spike_lti_roundtrip.py`, `scripts/spike_dynreg.py`,
`scripts/php/{setup_dev_network,setup_webservices,setup_users_course,setup_lti_tool,add_lti_activity,add_scorm_activity,curl_probe,spike_fake_tool}.php`.
`spike_*` files are test helpers, not product code.
