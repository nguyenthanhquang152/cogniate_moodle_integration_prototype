# Security model

Status: T0 round 2. Overview: [`README.md`](README.md). Flows: [`flows.md`](flows.md). Log event names: the "Log events" sections of both contracts.

## 1. Trust boundaries

| Zone | Origin (site) | Trusts | Does not trust |
| --- | --- | --- | --- |
| Moodle | `https://moodle.test` (`moodle.test`) | its own session | tool JWTs until the signature is valid |
| LTI service | `https://lti.cogniate.test` (`cogniate.test`) | platform JWTs after the checks, the API key | browser input, `openid_configuration` URLs, line item URLs from tools |
| Cogniate app | `https://app.cogniate.test` (`cogniate.test`) | LTI service API answers | URL query parameters, runtime commits, every text from packages or Moodle |
| Content origin | `https://content.cogniate-content.test` (`cogniate-content.test`) | nothing | everything: it runs untrusted package code |

The content origin is a different **site**, not only a different subdomain. Same-site content could send Lax cookies to the app and could set cookies on the parent domain.

## 2. LTI messages

### 2.1 Login initiation (`GET|POST /lti/login/{toolAccountId}`)

1. The tool account in the path must exist (else `404 UNKNOWN_TOOL_ACCOUNT`).
2. `iss` + `client_id` must match an active platform **of that account**. If `client_id` is missing and the account has more than one platform with this `iss`, the request fails.
3. If `lti_deployment_id` is present, it must be a known deployment.
4. `target_link_uri` must start with `{PUBLIC_LTI_URL}/lti/launch/{toolAccountId}`.
5. The service makes `state` and `nonce` (32 random bytes each), stores `hash(state) → {platform, nonce, target_link_uri, expires_at = now + 10 min}`, sets the state cookie, and redirects (302) to the platform auth endpoint with `scope=openid`, `response_type=id_token`, `response_mode=form_post`, `prompt=none`, `client_id`, `redirect_uri={PUBLIC_LTI_URL}/lti/launch/{toolAccountId}`, `login_hint`, `lti_message_hint`, `state`, `nonce`.

Login error codes: `UNKNOWN_TOOL_ACCOUNT`, `UNKNOWN_PLATFORM`, `PLATFORM_NOT_ACTIVE`, `UNKNOWN_DEPLOYMENT`, `INVALID_TARGET_LINK_URI`, `INVALID_REQUEST`. Log: `login_rejected {code}`.

### 2.2 Launch (`POST /lti/launch/{toolAccountId}`)

Run order: check 1, then 3, then 2, then 4 to 12. Every failure gives an HTML error page (status 400 or 401) and no redirect. Every failure logs `launch_check_failed {check, code}`.

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
| 9 | `deployment_id` is a known deployment of the platform. | `UNKNOWN_DEPLOYMENT` |
| 10 | `version` = `1.3.0`. `message_type` is `LtiResourceLinkRequest` or `LtiDeepLinkingRequest`. | `UNSUPPORTED_MESSAGE_TYPE` |
| 11 | Required claims exist: `sub`, `roles`, `target_link_uri`; `resource_link.id` (resource link) or `deep_linking_settings.deep_link_return_url` (deep linking). | `MISSING_CLAIM` |
| 12 | `target_link_uri` = the value in the state record, and it starts with `{PUBLIC_LTI_URL}/lti/launch/{toolAccountId}`. | `INVALID_TARGET_LINK_URI` |

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
| Deep Linking response | `iss = client_id`, `aud = platform issuer`, `nonce` (new random value), `deployment_id`, `message_type = LtiDeepLinkingResponse`, `version = 1.3.0`, `content_items` (exactly as the tool sent them), `data` (echo, if present), `msg`, `log`, `errormsg`, `errorlog` (from `options`) |
| Client assertion (token request) | `iss = sub = client_id`, `aud = token endpoint`, `jti` (random) |

Signing key: one active RSA 2048 key per tool account, RS256, with `kid`. Rotation is optional in the prototype.

### 2.4 Platform URLs

- `authenticationEndpoint`, `accesstokenEndpoint` and the JWKS URL must be https URLs on the **issuer origin**. Moodle puts `auth.php`, `token.php` and `certs.php` under wwwroot. Else: `400 PLATFORM_URL_NOT_ON_ISSUER_ORIGIN` at create.
- The platform JWKS is fetched with the guarded client (section 9), not with the `jose` remote fetcher. The service builds the key set with `createLocalJWKSet` and caches it for 10 min (refresh age).
- If a refresh fails (timeout, error status, bad JSON), the service keeps using the cached keys up to a **maximum age of 24 h** from the last good fetch, and logs the failed attempt. A token whose `kid` is in the cached set still verifies. A token with an unknown `kid` fails with `INVALID_SIGNATURE` (`detail: jwks_fetch_failed`). After 24 h without a good fetch, the cache is dropped and every launch of that platform fails with `INVALID_SIGNATURE` (`detail: jwks_unavailable`).
- Dynamic registration: the `openid_configuration` URL goes through the guarded client. Its `issuer` must equal the origin of the configuration URL. All endpoint URLs in it must be on that origin.

### 2.5 Dynamic registration: "update existing tool"

Moodle shows a choice page when a tool with the same domain exists. If the admin picks "update", Moodle's registration token has `scope = reg-update` and `sub = <type id>`, and Moodle overwrites that tool.

- The LTI service reads the operation from the token (verified with the platform JWKS from the configuration) and finds the existing platform by (issuer, deployment id = type id).
- `GET /api/registrations/:id` returns `operation` and `existingPlatformId`.
- `complete` with `operation = update` needs `updatePlatformId` = `existingPlatformId`, and the platform must belong to the same tool account. Else `409 REGISTRATION_UPDATE_NOT_ALLOWED`, and the service sends **nothing** to Moodle.
- The app **never** allows an update in the prototype (Lead decision, A-T4b1-02): a registration URL exists only for a `pending` connection, so a connection with a platform cannot re-register. For `operation = update` the app always shows `UPDATE_NOT_ALLOWED` ("Go back in Moodle and choose Register as a new tool") and calls nothing. To re-connect a library, the admin deletes its tool in Moodle, the Cogniate user disconnects and connects again. The LTI service keeps `updatePlatformId` as an API feature for other tools.

### 2.6 Platform ownership (A-T4b1-01)

| Rule | Detail |
| --- | --- |
| No adoption | Manual connect (`PUT /app-api/connections/:id/platform`) binds only a platform that the LTI service **creates** in that call (`201`). A `409 PLATFORM_ALREADY_EXISTS` gives `409 PLATFORM_IN_USE` and changes nothing, unless that platform is already bound to the same connection (a repeat of the same call, `200`). So no library can take over the seed platform, another library's platform, or an orphan. |
| Orphans are switched off | If the app gets a platform id from the LTI service (registration `complete` or manual create) and cannot bind it to the requesting connection, and no other connection owns it, the app sets it `active: false` at once and logs `platform_orphan_deactivated {platform_id}`. A disconnect also sets the platform `active: false`. |
| Foreign platforms | Platforms that the app did not create for a connection (the dev seed platform, platforms made through the LTI API by other tools) are never adopted and never changed by the app. |

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

NOTE: Deep Linking always runs in Moodle's modal iframe (`amd/src/contentitem.js`). The return page calls `parent.processContentItemReturnData`, so a popup cannot replace the iframe. So the teacher flow needs our partitioned state cookie. It works in Chromium and Firefox. It can fail in Safari. Decision: open questions Q16.

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

`{issuer}` = origin of the launch platform issuer. `{site}` = origin of the connection `siteUrl`. `{return}` = origin of `deep_link_return_url`. No page that Moodle frames sends `X-Frame-Options`.

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
| `/play/{playId}/embedded` | `frame-ancestors {issuer}; form-action 'none'` | `same-origin` |
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
| Cookies | The content origin sets none. Tracking uses the runtime token in the path. |
| Server checks | Every CMI value and every progress report is checked against the rules and the tracking profile of the attempt's version. |
| Output | All untrusted text (manifest title, course title, file names, Moodle context and activity titles, Moodle error messages) is HTML-escaped in server pages. The portal never uses `dangerouslySetInnerHTML`. |
| External hosts | The packages load images from the Cogniate S3 bucket, and the HTML export loads Google fonts. The runtime must not wait for these hosts. QA blocks them in tests. |

WARNING: Scores are computed in the browser. The HTML quiz shows `data-cog-correct="true"` in the page. A learner with developer tools can forge a score. This is accepted for completion-type courses only (Q8).

WARNING: Google Fonts in the HTML export send learner IP addresses to Google (Q9).

## 8. Tenant isolation

- LTI service: protocol URLs carry the tool account. The API key resolves to one tool account. Every ltik, service key, platform and registration lookup includes `tool_account_id`. A credential of account A never reads data of account B (401 or 404).
- Cogniate app: every query includes `library_id`. At launch, `platform.id` → connection → library. A resource of another library gives 404.
- AGS and NRPS URLs from a tool (`:lineItemId`, `url` query) must have the origin and path prefix of the claim URL (`lineitems` or `context_memberships_url`) **and** every query parameter of the claim URL with the same value. Moodle puts `type_id` in the query, so this rule stops a service key of tool A from naming a line item of tool B in the same course. The path is checked as sent (raw, not decoded): it must not contain `%2F`, `%5C`, `%2E` or `%25` in any letter case (encoded slash, backslash, dot, or double encoding), a backslash, or a `.` or `..` segment, because Moodle's web server decodes them and a path could then leave the course (A-T3a-01). The rule runs before any outbound call. The platform access token goes only to platform URLs.

## 9. Outbound requests (SSRF guard)

All outbound HTTP of both services goes through one client in `packages/shared` (`outbound`):

- https only. No redirects. Timeout 5 s. Response limit 1 MB.
- The IP check runs **inside the lookup that the connection uses**. Mechanism (library-neutral; T2a uses `node:https` with its own `lookup` option): the client gives the HTTPS request a `lookup` function that resolves the name once, checks **every** address of the answer, and hands only those checked addresses to the socket. No other lookup happens for that connection (no proxy, no second resolver), so a DNS answer that changes between check and connect (DNS rebinding) cannot reach a blocked IP. An IP literal in the URL is checked before the request. TLS still verifies the certificate against the host name (`servername` = host).
- Blocked ranges:
  - IPv4: `0.0.0.0/8`, `10.0.0.0/8`, `100.64.0.0/10` (CGNAT), `127.0.0.0/8`, `169.254.0.0/16` (link-local, incl. the `169.254.169.254` metadata address), `172.16.0.0/12`, `192.0.0.0/24`, `192.168.0.0/16`, `198.18.0.0/15`, `224.0.0.0/4` (multicast), `240.0.0.0/4`, `255.255.255.255/32`.
  - IPv6: `::/128`, `::1/128`, `::/96` (IPv4-compatible), `fc00::/7`, `fe80::/10`, `fec0::/10` (site-local), `ff00::/8`, `64:ff9b::/96` (NAT64), `2002::/16` (6to4), and IPv4-mapped `::ffff:0:0/96` (the mapped IPv4 address is checked against the IPv4 list).
- Allowlist per service (`OUTBOUND_PRIVATE_HOST_ALLOWLIST`, a host name list; the host may resolve to a blocked range): LTI service: the Moodle host. Cogniate app: the LTI service host. The `acceptance` profile adds `qa-platform.test` and `evil.test` to both (so that a missing rule shows up as a sink hit). Production: empty.
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
| `ref` token | app, 32 random bytes | hash, 24 h, single use | same |
| Runtime token | play session, 32 random bytes | hash, 24 h | same |
| Master keys | `gen-env` | `.env` (git-ignored) | KMS |

## 11. Privacy and logs

- Default privacy level `anonymous`: no `name` and no `email` claims. Learners are shown as "Learner {sub} @ {host}".
- Logs are JSON lines in `infra/.logs/<service>.jsonl` and on stdout. Every event has `ts`, `level`, `service`, `event`, `trace_id`. Lifecycle events with no request (`service_started`, `test_knob_active`, `service_stopping`) use one boot trace id per process. `GET /healthz` requests are not written to the JSON log files (stdout may keep them at `debug` level) (Lead decision B-T1-04).
- Trace ids: the app sends `X-Trace-Id` to the LTI service. The LTI service reuses a valid incoming id (`^[A-Za-z0-9-]{16,64}$`), else makes one. The score sync worker makes one per sync row.
- The logger redacts: `ltik`, `id_token`, `JWT`, `registration_token`, `client_assertion`, `access_token`, `Authorization`, cookies, `ref`, runtime tokens, service keys, and the `ltik` query in URLs.
