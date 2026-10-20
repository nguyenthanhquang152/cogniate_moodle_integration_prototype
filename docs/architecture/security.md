# Security model

Status: T0 round 2; multi-LMS rules in §12 and marked M1 lines (M0, 2026-10-20). Overview: [`README.md`](README.md). Flows: [`flows.md`](flows.md). Log event names: the "Log events" sections of both contracts.

## 1. Trust boundaries

| Zone | Origin (site) | Trusts | Does not trust |
| --- | --- | --- | --- |
| Moodle | `https://moodle.test` (`moodle.test`) | its own session | tool JWTs until the signature is valid |
| LTI service | `https://lti.cogniate.test` (`cogniate.test`) | platform JWTs after the checks, the API key | browser input, `openid_configuration` URLs, line item URLs from tools |
| Cogniate app | `https://app.cogniate.test` (`cogniate.test`) | LTI service API answers | URL query parameters, runtime commits, every text from packages or Moodle |
| Content origin | `https://content.cogniate-content.test` (`cogniate-content.test`) | nothing | everything: it runs untrusted package code |
| Canvas or Blackboard (M1) | school site origin; provider hosts for auth, JWKS, token (ADR-011 §5) | its own session | tool JWTs until the signature is valid |

The content origin is a different **site**, not only a different subdomain. Same-site content could send Lax cookies to the app and could set cookies on the parent domain.

## 2. LTI messages

### 2.1 Login initiation (`GET|POST /lti/login/{toolAccountId}`)

1. The tool account in the path must exist (else `404 UNKNOWN_TOOL_ACCOUNT`).
2. `iss` + `client_id` must match an active platform **of that account**. If `client_id` is missing and the account has more than one platform with this `iss`, the request fails.
3. If `lti_deployment_id` is present, it must be a known deployment (`UNKNOWN_DEPLOYMENT`) and, from M1, active (`DEPLOYMENT_NOT_ACTIVE`). The state record keeps it for check 9.
4. `target_link_uri` must start with `{PUBLIC_LTI_URL}/lti/launch/{toolAccountId}`.
5. The service makes `state` and `nonce` (32 random bytes each), stores `hash(state) → {platform, nonce, target_link_uri, expires_at = now + 10 min}`, sets the state cookie, and redirects (302) to the platform auth endpoint with `scope=openid`, `response_type=id_token`, `response_mode=form_post`, `prompt=none`, `client_id`, `redirect_uri={PUBLIC_LTI_URL}/lti/launch/{toolAccountId}`, `login_hint`, `lti_message_hint`, `state`, `nonce`.

Login error codes: `UNKNOWN_TOOL_ACCOUNT`, `UNKNOWN_PLATFORM`, `PLATFORM_NOT_ACTIVE`, `UNKNOWN_DEPLOYMENT`, `DEPLOYMENT_NOT_ACTIVE` (M1), `INVALID_TARGET_LINK_URI`, `INVALID_REQUEST`. Log: `login_rejected {code}`.

### 2.2 Launch (`POST /lti/launch/{toolAccountId}`)

Run order: check 1, then 3, then 2, then 4 to 12, then 13 (M1, profiles other than `standard`). Every failure gives an HTML error page (status 400 or 401) and no redirect. Every failure logs `launch_check_failed {check, code}`.

| # | Check | Error code |
| --- | --- | --- |
| 1 | A state record exists for `hash(state)` in this tool account, is not used and is not expired. | `INVALID_STATE` |
| 3 | Mark the state as used (single use). This happens for every POST with a known state, also when a later check fails. | — |
| 2 | The state cookie exists and equals `state` (constant-time compare). | `STATE_COOKIE_MISSING` (no cookie), `INVALID_STATE` (different value) |
| 4 | The form field is a compact JWS. Header `alg` = `RS256`. `kid` is present. (`none`, `HS256` and every other value fail.) | `INVALID_ID_TOKEN` |
| 5 | `iss` = issuer of the state's platform. `aud` contains its `client_id`. If `aud` has more than one value, `azp` = `client_id`. | `INVALID_ISSUER_OR_AUDIENCE` |
| 6 | The signature is valid with a key of the platform JWKS (unknown `kid` → one refetch, at most once per minute). | `INVALID_SIGNATURE` |
| 7 | `exp` > now − 60 s and `iat` < now + 60 s. | `TOKEN_EXPIRED` |
| 8 | `nonce` = the nonce of the state record. | `INVALID_NONCE` |
| 9 | `deployment_id` is a known deployment of the platform. M1: it equals the login `lti_deployment_id` if the login had one, and the deployment is active. No exception for shared platforms. | `UNKNOWN_DEPLOYMENT` (details `deployment_unknown`, `deployment_differs_from_login`), `DEPLOYMENT_NOT_ACTIVE` (`deployment_inactive`) |
| 10 | `version` = `1.3.0`. `message_type` is `LtiResourceLinkRequest` or `LtiDeepLinkingRequest`. | `UNSUPPORTED_MESSAGE_TYPE` |
| 11 | Required claims exist: `sub`, `roles`, `target_link_uri`; `resource_link.id` (resource link) or `deep_linking_settings.deep_link_return_url` (deep linking). | `MISSING_CLAIM` |
| 12 | `target_link_uri` = the value in the state record, and it starts with `{PUBLIC_LTI_URL}/lti/launch/{toolAccountId}`. | `INVALID_TARGET_LINK_URI` |
| 13 | M1, profiles other than `standard`: every present URL claim is https and has no user info; AGS `lineitems`, AGS `lineitem` and NRPS `context_memberships_url` are on the **service origin**, and `deep_linking_settings.deep_link_return_url` is on the **site origin** of the launch deployment (ADR-011 §5; the two differ only for a Canvas platform with a separate service URL). | `SERVICE_ORIGIN_MISMATCH` (details `claim=ags_lineitems`, `claim=ags_lineitem`, `claim=nrps`, `claim=dl_return`) |

Other launch cases:

| Case | Result |
| --- | --- |
| The form has `error` (Moodle sends `invalid_scope`, `unauthorized_client`, `access_denied` this way) and no `id_token` | The state is used up. Page `PLATFORM_ERROR` shows the OIDC code. Log `check: "oidc_error"`. |
| The platform was switched off between login and launch | Checked right after check 3 (the state is used up). Page `PLATFORM_NOT_ACTIVE`. Log `launch_check_failed {check: "platform_active", code: "PLATFORM_NOT_ACTIVE"}`. This is not one of the 12 checks. |
| `GET` (or any method except `POST`) on `/lti/launch/{toolAccountId}` | `405` page `METHOD_NOT_ALLOWED`, header `Allow: POST`. |
| `STATE_COOKIE_MISSING` | The service checks the signature (checks 4 and 6) only to choose the help text. It never continues the launch. Resource link: "Your browser blocked a cookie in an embedded frame. Ask your Moodle admin to set the Cogniate tool to open in a new window." Deep linking: "Your browser blocks cookies in Moodle's content dialog. Use Chrome, Edge or Firefox, or allow cookies for this site." Otherwise: "Start again from Moodle." |

Every HTML error page shows: the code, the trace id, and one line with the next action. Its main element has `data-error-code` and `data-trace-id`, and the element with the next-action sentence has `data-error-action`. Error pages have no form and no state-changing button, so they may be framed by any https origin (§5); this keeps them visible in Moodle's frames before a platform is known.

After all checks pass, the service stores the launch, makes the ltik, deletes the state cookie, logs `launch_accepted {platform_id, message_type}`, and redirects (303) to the tool. It copies the query of `target_link_uri` and adds `ltik` (LTIAAS behaviour). The tool must **not** trust the copied query (section 4).

Clock rule: we accept 60 s of skew. Spec §10 says five minutes. We use 60 s on purpose, because Moodle sets `exp = iat + 60 s` (spike §5d). 300 s would accept a token for six minutes.

### 2.3 JWTs that we sign

Moodle decodes with `$leeway = 0` (`lib/php-jwt/src/JWT.php`). A tool clock that is ahead by less than one second already fails. So every JWT that we send has:

- `iat = now − 30 s` (no `nbf`)
- `exp = now + 300 s`

| JWT | Other claims |
| --- | --- |
| Deep Linking response | `iss = client_id`, `aud = platform issuer`, M1: `sub = client_id` for profiles with `deepLinkingResponseSub` (Blackboard), `nonce` (new random value), `deployment_id`, `message_type = LtiDeepLinkingResponse`, `version = 1.3.0`, `content_items` (exactly as the tool sent them), `data` (echo, if present), `msg`, `log`, `errormsg`, `errorlog` (from `options`) |
| Client assertion (token request) | `iss = sub = client_id`, `aud = token endpoint`, `jti` (random). M1: `aud = [token endpoint]` for profiles with `clientAssertionAudArray` (Blackboard). |

Signing key: one active RSA 2048 key per tool account, RS256, with `kid`. Rotation is optional in the prototype.

### 2.4 Platform URLs

- `standard` profile: `authenticationEndpoint`, `accesstokenEndpoint` and the JWKS URL must be https URLs on the **issuer origin**. Other profiles (M1) take the issuer and these URLs from the fixed profile (§12). Moodle puts `auth.php`, `token.php` and `certs.php` under wwwroot. Else: `400 PLATFORM_URL_NOT_ON_ISSUER_ORIGIN` at create.
- The platform JWKS is fetched with the guarded client (section 9), not with the `jose` remote fetcher. The service builds the key set with `createLocalJWKSet` and caches it for 10 min (refresh age).
- If a refresh fails (timeout, error status, bad JSON), the service keeps using the cached keys up to a **maximum age of 24 h** from the last good fetch, and logs the failed attempt. A token whose `kid` is in the cached set still verifies. A token with an unknown `kid` fails with `INVALID_SIGNATURE` (`detail: jwks_fetch_failed`). After 24 h without a good fetch, the cache is dropped and every launch of that platform fails with `INVALID_SIGNATURE` (`detail: jwks_unavailable`).
- The deep-link return URL in a deep-linking launch must be https on the issuer origin (M1: the site origin; the same value for `standard`); the LTI service refuses to sign a response for any other target (`400 INVALID_DEEP_LINK_RETURN_URL`, A-T3c-01), and the app checks it again (`RETURN_URL_MISMATCH`).
- Dynamic registration: the `openid_configuration` URL goes through the guarded client. Its `issuer` must equal the origin of the configuration URL. All endpoint URLs in it must be on that origin.

### 2.5 Dynamic registration: "update existing tool"

Moodle shows a choice page when a tool with the same domain exists. If the admin picks "update", Moodle's registration token has `scope = reg-update` and `sub = <type id>`, and Moodle overwrites that tool.

- The LTI service reads the operation from the token (verified with the platform JWKS from the configuration) and finds the existing platform by (issuer, deployment id = type id).
- `GET /api/registrations/:id` returns `operation` and `existingPlatformId`.
- `complete` with `operation = update` needs `updatePlatformId` = `existingPlatformId`, and the platform must belong to the same tool account. Else `409 REGISTRATION_UPDATE_NOT_ALLOWED`, and the service sends **nothing** to Moodle.
- The app **never** allows an update in the prototype (Lead decision, A-T4b1-02): a registration URL exists only for a `pending` connection, so a connection with a platform cannot re-register. For `operation = update` the app always shows `UPDATE_NOT_ALLOWED` ("Go back in Moodle and choose Register as a new external tool") and calls nothing. To re-connect a library, the admin deletes its tool in Moodle, the Cogniate user disconnects and connects again. The LTI service keeps `updatePlatformId` as an API feature for other tools.

### 2.6 Platform ownership (A-T4b1-01)

| Rule | Detail |
| --- | --- |
| No adoption | Manual connect (`PUT /app-api/connections/:id/platform`) binds only a platform that the LTI service **creates** in that call (`201`). A `409 PLATFORM_ALREADY_EXISTS` gives `409 PLATFORM_IN_USE` and changes nothing, unless that platform is already bound to the same connection (a repeat of the same call, `200`). So no library can take over the seed platform, another library's platform, or an orphan. |
| Orphans are switched off | If the app gets a platform id from the LTI service (registration `complete` or manual create) and cannot bind it to the requesting connection, and no other connection owns it, the app sets it `active: false` at once and logs `platform_orphan_deactivated {platform_id}`. A disconnect also sets the platform `active: false`. If switching off fails, the app logs `platform_orphan_deactivate_failed`. There is **no** startup scan for orphans: it cannot tell orphans from the dev seed and QA platforms, which must stay active. |
| Slow Moodle at registration (P1) | The app waits up to 15 s for `complete` (the LTI service waits 5 s for Moodle), so it gets the LTI service's answer and can switch off an orphan. If `complete` still times out, the app shows `MOODLE_TOOL_MAY_EXIST` (app contract §6). It has no platform id in that case, so it cannot switch off a platform that the LTI service made late. That platform has no connection, so the app refuses its launches (`unknown_platform`), and the admin deletes the Pending tool in Moodle as the page says. |
| Foreign platforms | Platforms that the app did not create for a connection (the dev seed platform, platforms made through the LTI API by other tools) are never adopted and never changed by the app. |
| Residual risk (accepted, prototype) | A dynamic registration with `operation = new` that returns the client id of an existing platform with no connection gets that platform bound to the new connection (the LTI service updates it, LTI contract §3.8). A standard Moodle cannot cause this: each new registration gets a new client id, and a reused registration token fails with `token_already_used`. Only a site admin with a modified Moodle could. No rule is added (Lead decision; Reviewer-A, T4b1). Listed in open-questions "Residual risks". |

## 3. Cookies and launch container

| Cookie | Host | Attributes | Purpose | Life |
| --- | --- | --- | --- | --- |
| `__Host-lti_state_{first 8 chars of the state hash}` | LTI service | `Secure; HttpOnly; SameSite=None; Partitioned; Path=/` | Binds the OIDC state to the browser | 10 min, deleted after launch |
| `__Host-cog_session` | app | `Secure; HttpOnly; SameSite=Lax; Path=/` | Portal login (mock) | 8 h |
| `MoodleSession` | Moodle | `Secure` (behind the TLS proxy), `SameSite=Lax` | Moodle | Moodle |
| none | content origin | — | — | — |

- `SameSite=None` is needed, because Moodle `auth.php` sends the `id_token` with a cross-site POST.
- One cookie name per state lets two launches run in two tabs.
- Learner launches use **New window**. In an iframe, our state cookie is a third-party cookie. Moodle 5.2 has no LTI client-side storage (`lti_storage_target` is not in `mod/lti`).
- Moodle handles its own Lax cookie on cross-site POSTs with `repost_crosssite_page` (`auth.php`, `contentitem_return.php`).
- Tool pages after the launch use no cookies. They use capability ids in the path (`/tool/picker/{pickerId}`, `/play/{playId}`), bound to one launch, with expiry.

NOTE: Deep Linking always runs in Moodle's modal iframe (`amd/src/contentitem.js`). The return page calls `parent.processContentItemReturnData`, so a popup cannot replace the iframe. So the teacher flow needs our partitioned state cookie. QA verified Chromium only; other browsers, including Firefox, remain unproven. It can fail in Safari. Decision: open questions Q16.

## 4. Launch handoff (Cogniate app)

| Rule | Detail |
| --- | --- |
| Single use | The first `GET /tool/launch` or `GET /tool/deep-link` with a ltik stores `hash(ltik)`. A second request with the same ltik shows `HANDOFF_USED` (409). |
| Signed target | The publication comes from the `resource` query of the **signed** `launch.target` (from `GET /api/idtoken`). The `resource` query of the app URL is ignored. |
| Binding | Resource link key: (connection, `deployment_id`, `context_id`, `resource_link_id`). If a later signed target names another publication of the same connection, the teacher changed the activity: the row is updated (`resource_link_rebound`). A publication of another connection, or a withdrawn one, gives the "not available" page. |
| Attempt after a rebind | A launch continues an in-progress attempt only if the attempt's course version belongs to the course of the resource link's **current** publication. Otherwise it starts a new attempt on that publication's current version. The old attempt stays as it is (no score) and shows under the results of its own course's publication. |
| Picker POST | The app checks again that the posted publication belongs to the picker's connection and is not withdrawn. |
| Embedded launch | If `launch.presentation.documentTarget` is `iframe`, the app shows `/play/{playId}/embedded` with an "Open in a new window" button instead of the player. `frame` (Moodle "Existing window") and `window` are top-level and open the player directly. |

## 5. Page headers

`{issuer}` = origin of the launch platform issuer. `{site}` = origin of the connection `siteUrl`. M1: every `{issuer}` in this table becomes `{site}`; for Moodle both are the same origin (ADR-011 §5). `{return}` = origin of `deep_link_return_url`. No page that Moodle frames sends `X-Frame-Options`.

| Response | `Content-Security-Policy` (main parts) | `Referrer-Policy` |
| --- | --- | --- |
| LTI service error pages | `default-src 'none'; style-src 'self'; frame-ancestors https:; form-action 'none'` (no form, no action: safe to frame, and visible before a platform is known) | `same-origin` |
| LTI service 302 / 303 | — | `no-referrer` |
| `/tool/launch`, `/tool/deep-link` 303 | — | `no-referrer` |
| All `/tool/*` error pages (launch, deep link, picker, register) | `frame-ancestors https:; form-action 'none'` (no form, no action) | `same-origin` |
| `GET /tool/register` | `frame-ancestors {site}; form-action 'self'; script-src 'nonce-…'` | `same-origin` |
| `POST /tool/register` result | `frame-ancestors {site}; form-action 'none'; script-src 'nonce-…'` | `same-origin` |
| `GET /tool/picker/{id}` | `frame-ancestors {issuer}; form-action 'self'` | `same-origin` |
| `POST /tool/picker/{id}` auto-submit | `frame-ancestors {issuer}; form-action {return}; script-src 'nonce-…'` | `same-origin` |
| `/play/{playId}` | `frame-ancestors 'none'; frame-src {PUBLIC_CONTENT_URL}; script-src 'nonce-…'` | `same-origin` |
| `/play/{playId}/embedded` | `frame-ancestors {issuer}; form-action 'none'`. M1, Canvas connections: plus `script-src 'nonce-…'` for the top-level continuation script (app contract §6.1). | `same-origin` |
| Portal (SPA) | `default-src 'self'; frame-ancestors 'none'` | `same-origin` |
| `/rt/{runtimeToken}` | `frame-ancestors {PUBLIC_APP_URL}` | `same-origin` |
| `/pkg/{packageId}/*` | `frame-ancestors {PUBLIC_CONTENT_URL} {PUBLIC_APP_URL}` (CSP checks every ancestor, and the shell is the top ancestor) | `same-origin` |

`same-origin` keeps capability ids out of cross-origin `Referer` headers. It also makes the browser send a real `Origin` on same-origin form POSTs. (`no-referrer` makes the browser send `Origin: null`.)

## 6. CSRF

| Endpoint group | Rule |
| --- | --- |
| Portal API writes (`/app-api/*`) | `SameSite=Lax` session cookie **and** `Origin` = `PUBLIC_APP_URL`. Else `403 ORIGIN_NOT_ALLOWED`. |
| Tool page POSTs (`/tool/register`, `/tool/picker/{id}`) | No ambient credentials. The `ref` token or capability id is the authorization. `Origin` must be `PUBLIC_APP_URL`. Other values, including `null` and no header, get 403 and change nothing. Log: `csrf_rejected {origin}`. |
| LTI service `/api/*` | No cookies. `Authorization` header only. No CORS headers. |

## 7. Untrusted package content

| Control | Rule |
| --- | --- |
| Upload limits | Zip ≤ 200 MB. Uncompressed total ≤ 500 MB. ≤ 5,000 entries. Compression ratio per entry ≤ 100. |
| Path safety | Reject absolute paths, `..` segments (also nested, `a/../../x`), backslashes, drive letters, NUL or control characters, symlink entries, duplicates after NFC + case fold. |
| Parsing | `imsmanifest.xml`: reject any `<!DOCTYPE` or `<!ENTITY`, then parse with entity processing off. HTML: a parser that only reads attributes. |
| Identifiers | Ids, page keys and titles from the package follow app contract §3.3 (length, character set, no `__proto__`, `prototype`, `constructor`); else `INVALID_PACKAGE_IDENTIFIER`. Id-keyed data uses `Map` or `Object.create(null)`. |
| Storage | Extract only after all checks pass, into a new `pkg_` folder. Check the path again on every serve. |
| Serving | MIME type from an allowlist. `X-Content-Type-Options: nosniff`. `Range` support. Raw `..` paths give 400 or 404, never the file. |
| Frames | Runtime iframe: `sandbox="allow-scripts allow-same-origin"` and `allow="autoplay; fullscreen"` (T5-spike: the minimal set that runs both exports; without `allow-same-origin` the runtime gets an opaque origin, which no `frame-ancestors` source matches, so the package is blocked). `allow-forms`, `allow-popups` and `allow-modals` are not needed for these exports; add them per export version only if a later export needs them. The inner package iframe needs no `allow` (it is same-origin with the runtime and inherits the `'self'` allowlist). The shell sends no `Permissions-Policy`; if it ever does, `fullscreen` and `autoplay` must list `{PUBLIC_CONTENT_URL}`. No top navigation. `allow-same-origin` is safe only because the content origin is cross-site to the shell. |
| Cookies | The content origin sets none. Tracking uses the runtime token in the path. The proxy removes the `Cookie` request header on the content host, and each launch clears cookies that package code may have set on the content origin. |
| Shared content origin | All libraries share one content origin in the prototype. Package code of one library runs on the same origin as another library's packages (shared `localStorage`, `sessionStorage`). Residual risk R5 (accepted for the prototype); production needs one content subdomain per tenant (Q10). |
| Server checks | Every CMI value and every progress report is checked against the rules and the tracking profile of the attempt's version. |
| Output | All untrusted text (manifest title, course title, file names, Moodle context and activity titles, Moodle error messages) is HTML-escaped in server pages. The portal never uses `dangerouslySetInnerHTML`. |
| External hosts | The packages load images from the Cogniate S3 bucket, and the HTML export loads Google fonts. The runtime must not wait for these hosts. QA blocks them in tests. |

WARNING: Scores are computed in the browser. The HTML quiz shows `data-cog-correct="true"` in the page. A learner with developer tools can forge a score. This is accepted for completion-type courses only (Q8).

WARNING: Google Fonts in the HTML export send learner IP addresses to Google (Q9).

## 8. Tenant isolation

- M1 (ADR-011 §4): the tenancy key is (tool account, issuer, client id, deployment id). The issuer alone never selects a tenant. A shared Blackboard platform serves many libraries; each library owns one deployment. Disconnect changes only that deployment.
- LTI service: protocol URLs carry the tool account. The API key resolves to one tool account. Every ltik, service key, platform and registration lookup includes `tool_account_id`. A credential of account A never reads data of account B (401 or 404).
- Cogniate app: every query includes `library_id`. At launch, `platform.id` → connection → library. A resource of another library gives 404.
- AGS and NRPS URLs from a tool (`:lineItemId`, `url` query) must have the origin and path prefix of the claim URL (`lineitems` or `context_memberships_url`) **and** every query parameter of the claim URL with the same value. Moodle puts `type_id` in the query, so this rule stops a service key of tool A from naming a line item of tool B in the same course. The line item id is decoded once, and once more only if it then starts with `https%3A%2F%2F` (never more than two decodes; LTI contract §1.4). The path of that final value must not contain `%2F`, `%5C`, `%2E` or `%25` in any letter case (encoded slash, backslash, dot, or more encoding), a backslash, or a `.` or `..` segment, because Moodle's web server decodes them and a path could then leave the course (A-T3a-01). A triple-encoded id is refused, because the decoding never gives a valid line item URL for it. The rule runs before any outbound call. The platform access token goes only to platform URLs.

## 9. Outbound requests (SSRF guard)

All outbound HTTP of both services goes through one client in `packages/shared` (`outbound`):

- https only. No redirects. Timeout 5 s (one exception: the app's registration `complete` call waits 15 s, §2.6). A per-request timeout above 60 000 ms (also Infinity) uses 60 000 ms; NaN, 0 or a negative value uses the 5 s default (A-FX-02). Response limit 1 MB.
- The IP check runs **inside the lookup that the connection uses**. Mechanism (library-neutral; T2a uses `node:https` with its own `lookup` option): the client gives the HTTPS request a `lookup` function that resolves the name once, checks **every** address of the answer, and hands only those checked addresses to the socket. No other lookup happens for that connection (no proxy, no second resolver), so a DNS answer that changes between check and connect (DNS rebinding) cannot reach a blocked IP. An IP literal in the URL is checked before the request. TLS still verifies the certificate against the host name (`servername` = host).
- Blocked ranges:
  - IPv4: `0.0.0.0/8`, `10.0.0.0/8`, `100.64.0.0/10` (CGNAT), `127.0.0.0/8`, `169.254.0.0/16` (link-local, incl. the `169.254.169.254` metadata address), `172.16.0.0/12`, `192.0.0.0/24`, `192.168.0.0/16`, `198.18.0.0/15`, `224.0.0.0/4` (multicast), `240.0.0.0/4`, `255.255.255.255/32`.
  - IPv6: `::/128`, `::1/128`, `::/96` (IPv4-compatible), `fc00::/7`, `fe80::/10`, `fec0::/10` (site-local), `ff00::/8`, `64:ff9b::/96` (NAT64), `2002::/16` (6to4), and IPv4-mapped `::ffff:0:0/96` (the mapped IPv4 address is checked against the IPv4 list).
- Allowlist per service (`OUTBOUND_PRIVATE_HOST_ALLOWLIST`, a host name list; the host may resolve to a blocked range): LTI service: the Moodle host. Cogniate app: the LTI service host and the Moodle host (course shell web services, T8). The `acceptance` profile adds `qa-platform.test` and `evil.test` to both (so that a missing rule shows up as a sink hit). M1: the `acceptance` profile also adds the simulation hosts of M3 (`developer.blackboard.sim.test`, `learn-a.blackboard.sim.test`, `learn-b.blackboard.sim.test`, `sso.canvas.sim.test`, `school-a.canvas.sim.test`, `school-b.canvas.sim.test`, `canvas-self.sim.test`) to the LTI service. Production: empty.
- Every attempt logs exactly one event. `outbound_request {host, method, status, ms}` = an HTTP response was accepted (any status that is not a redirect). `outbound_blocked {host, method, reason}` = no accepted response. Reasons: policy (the guard refused) `not_https`, `private_ip`, `redirect` (a 3xx is not followed), `too_large`; failure (after the guard allowed the call) `dns_error`, `timeout`, `network_error` (connection refused, reset or TLS error). A GET is retried once after `network_error`; the retry is a second attempt with its own event.

## 10. Keys and secrets

| Secret | Made by | Stored | Production |
| --- | --- | --- | --- |
| Dev CA key and leaf key | `gen-env` (`openssl`) before containers start; CA with Name Constraints `permitted DNS:test`, life ≤ 1 year | `infra/.certs/` (git-ignored, kept by `stack:reset`; `ca.key` never mounted in a container) | Public CA |
| Tool RSA key | LTI service bootstrap | `tool_key`, private part AES-256-GCM with `LTI_MASTER_KEY` | KMS, 90-day rotation |
| API key | bootstrap, printed once | SHA-256 hash; the app reads `infra/.secrets/lti-api-key.<account>` at each use | Secret manager |
| ltik | launch, 32 random bytes | hash only, 24 h | same |
| Service key | first launch of a resource link | hash only, no expiry, revocable | same |
| Platform access token | Moodle `token.php` | memory only | same |
| Registration token | Moodle | encrypted, ≤ 1 h | same |
| `ref` token | app, 32 random bytes | hash for the check, 24 h, single use; plus an AES-GCM encrypted copy, only so that the portal can show `registrationUrl` again (app contract §4) | same |
| Runtime token | HMAC of the play id with `APP_MASTER_KEY` (base64url) | SHA-256 hash only, 24 h | same |
| Play id, picker id | app, ≥ 128 random bits | SHA-256 hash only (A-T4b2-03); the raw id exists only in the URL and the handoff redirect | same |
| Master keys | `gen-env` | `.env` (git-ignored) | KMS |

## 10a. Build Runner (T8, stretch)

| Rule | Detail |
| --- | --- |
| Where it runs | On the **host**, as a script. The app never gets the Docker socket. |
| Interface | Files in `infra/.data/build-queue/`: the app writes only to `requests/`; it reads `status/` and `out/`, which are read-only for it. |
| Isolation | Each build runs a throwaway Moodle + Postgres on an **internal** Docker network (no internet, no link to the main stack). |
| Image | A derived image `cogniate-build-moodle:v5.2.4` with Moodle's PHP packages baked in, so a build needs no internet. |
| Input | The package is untrusted data like any upload. The runner finds the zip by its sha256 in the app's upload store (no path from the request is used), copies it into a new empty folder and mounts it read-only. |
| Request files (A-T8-01) | The runner opens a request with no-follow and no-block flags (`O_NOFOLLOW`, `O_NONBLOCK`) and checks it with `fstat`: only a regular file of the runner's user, at most 4 KB. A symlink, FIFO or device is refused (never read, never waited on) and logged as `request_rejected`. It takes only names `bld_<24 hex>.json`. Every field is checked against a strict pattern. The app writes each request atomically (temporary file + rename, mode `0600`). |
| Backup copy (A-T8-01) | `docker cp` copies a symlink as a symlink (it never follows it), into a new empty folder. The runner then accepts the `.mbz` only as a regular file (`lstat`: no symlink, no special file), 18 B to 2 GB, with the gzip magic bytes, and writes it into `out/` with exclusive create (it fails if the target exists, also a planted symlink). Else the build is `failed` ("The backup was refused: …"). |
| Single runner | One runner per queue (lock file `build-queue/.runner.pid`). A second runner is refused, because its start-up clean-up would remove the first runner's build. |
| Limits | At most 2 active builds per library (`409 MBZ_BUILD_LIMIT`). A build with no progress for 10 min becomes `failed` (app contract §11). |
| Clean-up | At start and on `stack:reset`: interrupted builds become `failed`; leftover `cogniate-build-*` containers, volumes, networks and work folders **of this stack** are removed (never the build projects of another stack on the same Docker host). On `TERM`/`INT` the current build is removed and marked `failed`. |

## 11. Privacy and logs

- Default privacy level `anonymous`: no `name` and no `email` claims. Learners are shown as "Learner {sub} @ {host}" (M1: host of the connection site URL).
- M1: Canvas and Blackboard launches keep only the claim allowlist of ADR-011 §9 (no names, emails, `lis`, `custom` or vendor claims). The Canvas JSON sets `privacy_level: anonymous`; the Blackboard guide sends the role only.
- Logs are JSON lines in `infra/.logs/<service>.jsonl` and on stdout. Every event has `ts`, `level`, `service`, `event`, `trace_id`. Lifecycle events with no request (`service_started`, `test_knob_active`, `service_stopping`) use one boot trace id per process. `GET /healthz` requests are not written to the JSON log files (stdout may keep them at `debug` level) (Lead decision B-T1-04).
- Trace ids: the app sends `X-Trace-Id` to the LTI service. The LTI service reuses a valid incoming id (`^[A-Za-z0-9-]{16,64}$`), else makes one. The score sync worker makes one per sync row.
- The logger redacts: `ltik`, `id_token`, `JWT`, `registration_token`, `client_assertion`, `access_token`, `Authorization`, cookies, `ref`, runtime tokens, service keys, and the `ltik` query in URLs.

## 12. Multi-LMS (M1, ADR-011)

| Rule | Detail |
| --- | --- |
| Fixed profiles | Issuer, auth, token and JWKS URLs of Canvas and Blackboard come from one reviewed code module (ADR-011 §6). No request field, token claim or admin input can set another endpoint (`400 PLATFORM_URL_NOT_IN_PROFILE`). There is no "allow any host" option. |
| Reserved issuers | A `standard` platform cannot use a fixed-profile issuer origin (`ISSUER_RESERVED`, also for dynamic registration). So no second record can claim `https://blackboard.com` or a Canvas cloud issuer with other endpoints. |
| Simulation profiles | On only when the service profile is `acceptance` and `LTI_PROVIDER_SIMULATION=on` (LTI contract §9.13). Unknown in every other case. |
| Site URL rules | ADR-011 §6 rules 1 to 5 for every site URL and Canvas service URL, one shared function for the LTI service and the app. Rule 4 refuses only fixed provider hosts; site-derived endpoints are allowed. The site URL is never fetched at connect time; later calls use the guarded client (§9). |
| Self-hosted Canvas | Issuer = site origin; fixed paths on it; hosted Instructure hosts refused (rule 5). |
| Check 13 | Service URL claims on the service origin, the Deep Linking return URL on the site origin (§2.2). The platform access token goes only to URLs that passed check 13 and the line item rule (§8). This matters most for Blackboard: one gateway token works for every Learn site of the Application ID. |
| Binding approval | Ids are not secrets. Every new Canvas platform, Canvas added deployment and Blackboard deployment needs a one-time operator approval grant, bound to the exact library, connection, profile, site URL, service URL, client id and deployment id, redeemed atomically in a session of that library before activation (ADR-011 §4a, app contract §4.7, §4.8). Only the code's SHA-256 is stored. No unbound-launch exception exists in launch validation. |
| Deployment state | Inactive deployment: launches and API calls fail (`DEPLOYMENT_NOT_ACTIVE`). |
| Binding generation | A new binding of a shared deployment makes older service keys and ltiks fail with `401` (LTI contract §9.14). Generation 0 keeps today's key values. |
| Ownership | Exclusive platforms: §2.6 unchanged, plus one bounded exception: during a grant redemption, an unowned platform with exactly the grant's profile, issuer, client id and site may be bound (crash recovery). Shared platforms: the reservation is written in the grant redemption transaction; the app never patches or deletes a shared platform; `DELETE` with active deployments is refused. |
| No proxy redirect | One redirect URI for every LMS (`{PUBLIC_LTI_URL}/lti/launch/{toolAccountId}`). Research §5.3. |
| No secrets from LMS admins | No client secret field; the strict body refuses it. Service access uses the signed client assertion. |
| Error page texts | Pages of a platform with a Canvas or Blackboard profile name that LMS, not Moodle. Before a platform is known, a login `iss` equal to a fixed profile issuer selects that LMS name. `standard` texts stay byte for byte. |
| Personal data | Claim allowlist (ADR-011 §9): only the listed claims are stored; `custom` is dropped. NRPS rule unchanged. |
