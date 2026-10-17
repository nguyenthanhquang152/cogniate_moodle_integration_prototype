# T2a: LTI service core — platforms, keys, OIDC launch, ltik, ID token API

Owner: Author. Depends on: T1. Contract: [`../contracts/lti-service-api.md`](../contracts/lti-service-api.md) §0 (T2a rows), §1, §2.1–2.3, §2.5, §3.1, §3.9, §5, §7. Security: [`../security.md`](../security.md) §2, §3, §8, §9. QA rules and knobs: [`README.md`](README.md). Round 3: T2 is split into T2a (this file) and T2b (negative launch matrix and the `acceptance` profile).

## Goal

Moodle launches the LTI service with LTI 1.3. The service runs all checks and redirects to the tool with a ltik. A back end reads the LTIAAS-shaped ID token. Platforms are registered by API.

## Scope

In:

- `services/lti-service` (folders per ADR-008): SQLite with migrations, config from env and `loadPublicUrls()`, JSON logs (events of contract §5).
- Tool accounts, one RSA key each, bootstrap CLI (contract §7). Seed makes `cogniate` and `qa-second`; API keys in `infra/.secrets/lti-api-key.<account>` and their paths in `seed.json` (key `lti.apiKeyFiles`).
- `GET /lti/keys/{toolAccountId}`.
- Auth middleware for the three schemes (contract §1.2). `SERVICE-AUTH-V1` returns `401 INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER` for every key until T3a.
- Error shape and codes (contract §1.3). HTML error pages with code, trace id, action line, and the `data-error-code` and `data-trace-id` attributes (security §2.2).
- Platforms API `GET`, `POST`, `GET /:id`, `PATCH /:id` with the issuer-origin rule (security §2.4).
- `GET|POST /lti/login/{toolAccountId}`, `POST /lti/launch/{toolAccountId}`: **all 12 checks** of security §2.2, the OIDC `error` case and the help texts. Each check has unit tests here; T2b adds the black-box negative matrix.
- Launch store, ltik (`LTIK_TTL_SECONDS`), `GET /api/idtoken` (+ `raw=true`), mapping of contract §3.1 (no `serviceKey` yet).
- `packages/shared` outbound client with the SSRF guard (security §9): the IP check runs in the lookup that the connection uses (the mechanism of security §9; `node:https` with a guarded `lookup` is fine), the blocked ranges of security §9, one allowlist per service, the event rule (one event per attempt, policy and failure reasons). The platform JWKS goes through it (`createLocalJWKSet`, no `jose` remote fetch).
- Dev seed `npm run seed:lti-manual` (idempotent): in Moodle (PHP CLI, `lti_add_type`) the tool "Cogniate (seed)" with the LTI service URLs for account `cogniate`, `launchcontainer=4`, `coursevisible=2`, deep linking on, `gradesynchronization=2`, `memberships=1`, send name/email 0; activities "Seed activity" (`COGNIATE-DEV-101`) and "Seed activity 102" (`COGNIATE-DEV-102`), tool URL `{PUBLIC_LTI_URL}/lti/launch/cogniate?resource=seed`, accept grades on, maximum grade 100. It registers the platform with `POST /api/platforms` (deployment id = tool type id). **H9:** if the platform was deleted, a rerun makes it again. It writes `{ typeId, clientId, deploymentId, cmids, platformId }` to `seed.json` (key `ltiSeed`), with `cmids` = `{ "<course shortname>": <cmid> }`, for example `{ "COGNIATE-DEV-101": 3, "COGNIATE-DEV-102": 4 }` (cmids, not course ids). The Author documents this key in the `seed.json` section of `infra/README.md`.
- **H14:** `npm run test:acceptance -- <args>` forwards `<args>` to `npm --prefix tests run acceptance -- <args>`, and the `e2e` container gets every `QA_*` env variable of the caller (a small change to the T1 suite script).

Out: the `acceptance` profile, `qa-platform.test`, the `evil.test` sink, the negative matrix (T2b). Deep Linking, AGS, service keys (T3a). Dynamic registration (T3b). App pages (T4b1, T4b2).

## Design notes

- Keep the 12 checks as small functions with one unit test each (pass + fail). Reviewer-A maps them to security §2.2.
- Mark the state as used in the same transaction that reads it.
- Clock skew 60 s. Unit tests sign test tokens with a local test key; no network in unit tests.
- The tool URL `{PUBLIC_APP_URL}/tool/launch` is still a stub. QA reads the redirect URL; it does not need the page.

## Acceptance criteria

Setup: `npm run stack:up && npm run seed && npm run seed:lti-manual` (default profile). Values from `seed.json`.

Keys, platforms, routing:

- **AC-T2-01** `GET /lti/keys/cogniate` → `200 application/json`, `keys` ≥ 1, each with `kty=RSA`, `kid`, `alg=RS256`, `use=sig`, `n`, `e`, and no `d`, `p`, `q`, `dp`, `dq`, `qi`. `GET /lti/keys/unknown` → `404`.
- **AC-T2-02** `POST /api/platforms` (Bearer `cogniate`) with a valid body → `201` with all fields of contract §3.9. The same call again → `409 PLATFORM_ALREADY_EXISTS`. `GET /api/platforms?clientId=` returns it. No header → `401 INVALID_AUTHORIZATION_HEADER`. Wrong key → `401 INVALID_LTIK_AUTH_AUTHORIZATION_HEADER`. The `qa-second` key sees an empty list and gets `404` for `GET /:id`.
- **AC-T2-18** `qa-second` registers the **same** issuer + client id as the seed platform → `201` (its own record). A `cg_student` launch of "Seed activity" still lands with a ltik that works only with the `cogniate` API key (`qa-second` key + that ltik → `401`).
- **AC-T2-29** `POST /api/platforms` with `authConfig.key = https://evil.test/jwks` (issuer `PUBLIC_MOODLE_URL`) → `400 PLATFORM_URL_NOT_ON_ISSUER_ORIGIN`. The same for `accesstokenEndpoint` and `authenticationEndpoint` on another origin. No `outbound_*` event for `evil.test`. `authConfig.method=RSA_KEY` → `400 UNSUPPORTED_AUTH_METHOD`. An `http://` URL → `400 INVALID_REQUEST`. (T2b repeats this AC with the sink.)

Happy path:

- **AC-T2-03** `cg_student` opens "Seed activity". Within 10 s a new window reaches `{PUBLIC_APP_URL}/tool/launch?resource=seed&ltik=<value>`. `ltik` is 43 characters.
- **AC-T2-04** `GET /api/idtoken` (`LTIK-AUTH-V2 <cogniate key>:<ltik>`) → `200`: `user.id` = Moodle id of `cg_student`; `user.roles` has a Learner role; no `user.email`, no `user.name`; `platform.url` = `PUBLIC_MOODLE_URL`; `platform.clientId`, `platform.deploymentId` = `ltiSeed` values; `platform.productFamilyCode` = `moodle`; `launch.type` = `LtiResourceLinkRequest`; `launch.target` = `{PUBLIC_LTI_URL}/lti/launch/cogniate?resource=seed`; `launch.context.id` = course id of `COGNIATE-DEV-101`; `launch.resourceLink.id` not empty; `launch.presentation.documentTarget` = `document_target`; `services.deepLinking.available` = `false`. QA does not assert the other `platform.*` values.
- **AC-T2-05** `GET /api/idtoken?raw=true` → `200` with `iss`, `aud`, `sub`, `.../claim/message_type`, `.../claim/deployment_id`.
- **AC-T2-08** The `302` from `/lti/login/cogniate`: `Location` is Moodle `auth.php` with `scope=openid`, `response_type=id_token`, `response_mode=form_post`, `prompt=none`, `client_id`, `redirect_uri={PUBLIC_LTI_URL}/lti/launch/cogniate`, `login_hint` and `lti_message_hint` as sent, `state` and `nonce` of 43 characters (different in two launches). `Set-Cookie`: `__Host-` prefix, `Secure`, `HttpOnly`, `SameSite=None`, `Partitioned`, `Path=/`.
- **AC-T2-19** The `303` from `/lti/launch/cogniate` has `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, and the state cookie with `Max-Age=0`. `GET /lti/launch/cogniate` → `405` page with `data-error-code="METHOD_NOT_ALLOWED"` and header `Allow: POST`.

Header, ltik and login errors:

- **AC-T2-06** On `/api/idtoken`: `qa-second` key + valid ltik → `401 INVALID_LTIK_AUTH_AUTHORIZATION_HEADER`; valid key + random 43-char ltik → `401 INVALID_LTIK_AUTH_AUTHORIZATION_HEADER`; `LTIK-AUTH-V2 <key>` without `:` → `401 INVALID_LTIK_AUTH_AUTHORIZATION_HEADER`; `Bearer <key>` → `401 INVALID_AUTHORIZATION_HEADER`; `SERVICE-AUTH-V1 …` → `401 INVALID_AUTHORIZATION_HEADER`. All bodies have the error shape.
- **AC-T2-07** `stack:restart -- lti-service --env LTIK_TTL_SECONDS=20`. A launch, then `/api/idtoken` less than 10 s after the redirect → `200`. The same call at TTL + 3 s → `401`. `stack:restart -- lti-service` restores the default.
- **AC-T2-12** `POST /lti/login/cogniate` with `iss=https://evil.test` → `400` page `UNKNOWN_PLATFORM`, no `Location`. `POST /lti/login/unknown` → `404 UNKNOWN_TOOL_ACCOUNT`.
- **AC-T2-13** `target_link_uri=https://evil.test/x` at login → `400` page `INVALID_TARGET_LINK_URI`.
- **AC-T2-14** `PATCH /api/platforms/:id {deploymentIds:["999"]}` then a launch → `UNKNOWN_DEPLOYMENT`. Restore → launch works.
- **AC-T2-15** `PATCH … {active:false}` → launch shows `PLATFORM_NOT_ACTIVE`. `active:true` → works. Switched off **between** login and launch (QA holds the redirect to Moodle `auth.php`, sends `PATCH {active:false}`, then lets the flow go on) → `PLATFORM_NOT_ACTIVE` with `launch_check_failed {check: "platform_active"}`, and the state is used up.

Logs and hooks:

- **AC-T2-16** After the T2a ACs, `infra/.logs/lti-service.jsonl` contains none of the captured ltiks, `id_token`s, states or API keys.
- **AC-T2-31** `npm run seed:lti-manual` twice gives the same `ltiSeed` values. After `stack:reset`, `stack:up`, `seed`, `seed:lti-manual`, a launch of "Seed activity" works again, and `seed.json` has the new ids. (Recreate after `DELETE /api/platforms/:id`: T3c, AC-T3-19.)
- **AC-T2-17** (merged into AC-T2-29.)

## Self-check

`npm run check` green. Unit tests: each launch check (pass + fail), header parser, error shape, outbound client (each blocked range of security §9 incl. IPv6 and IPv4-mapped, allowlist, redirect not followed, every call logs one event, and a fake resolver that answers a public IP first and a private IP second: the connection must not reach the private IP), redaction, issuer-origin rule.
