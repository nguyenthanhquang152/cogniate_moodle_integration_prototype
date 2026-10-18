# Contract: Cogniate app (stand-in for the Cogniate platform)

Status: T0 round 2. Owner: Architect. Security rules: [`../security.md`](../security.md). Flows: [`../flows.md`](../flows.md).

NOTE: This is our design for a stand-in. It is not a Cogniate API (spec §7.1). When Cogniate gives its contract, only this app changes.

| Origin | Serves | Auth |
| --- | --- | --- |
| `PUBLIC_APP_URL` | Portal SPA, `/app-api/*`, tool pages `/tool/*`, player shell `/play/*` | Portal: session cookie. Tool pages and player: capability id in the path. |
| `PUBLIC_CONTENT_URL` | `/pkg/*`, `/rt/*`, `/_rt/assets/*` | Runtime token in the path. No cookies. |

## 0. Endpoints and tasks

| Part | Task |
| --- | --- |
| §2 session, §3 courses and versions (upload, inspector) | T4a |
| §4 connections, §5 publications (without results), §6 `/tool/register` | T4b1 |
| §6 `/tool/launch`, `/tool/deep-link`, `/tool/picker/*`, `/play` shell | T4b2 |
| §7 content host, §8 SCORM runtime, §5 results GET, §10 score sync | T5a |
| §9 HTML runtime, results refresh, Resend, retry schedule | T5b |
| §3 download `kind=original` | T6 |
| §11 course shell and web services token, `kind=mbz` | T8 (stretch) |

---

## 1. Conventions

- JSON, UTF-8. Error body = LTI service shape `{ status, error, details: { message, description } }`. Some errors add fields in `details` (listed).
- IDs are random and prefixed: `lib_`, `usr_`, `crs_`, `ver_`, `pkg_`, `con_`, `pub_`, `rl_`, `att_`, `ply_`, `pck_`, `sync_`. Capability ids and tokens have ≥ 128 random bits.
- Portal API writes need `Origin` = `PUBLIC_APP_URL`, else `403 ORIGIN_NOT_ALLOWED`.
- Every `/app-api/*` call except `POST /app-api/session` and `GET /app-api/play/:playId/status` needs the session cookie, else `401 NOT_SIGNED_IN`.
- Every query is limited to the session user's library. A resource of another library gives `404 NOT_FOUND`, for reads and writes.
- The app reads the LTI API key from `infra/.secrets/lti-api-key.cogniate` at each use, and sends `X-Trace-Id` to the LTI service.
- If a call to the LTI service fails (5xx, timeout, `PLATFORM_*` error), the app API answers `502 LTI_SERVICE_ERROR` with the trace id. If the LTI service answers but the body fails the app's schema for that endpoint, the app answers `502 INVALID_LTI_ANSWER`. A 4xx from the LTI service that the user can fix is mapped to the app's own 4xx code.
- All untrusted text is escaped on output (security §7).
- `GET {PUBLIC_APP_URL}/healthz` → `200 {"status":"ok","service":"cogniate-app","profile":"default","outbound_allowlist":["lti.cogniate.test"],"knobs":[]}`. `profile` is `acceptance` in that compose profile (local-stack §3), and `outbound_allowlist` then also has `qa-platform.test` and `evil.test`.

## 2. Session (mock login) — T4a

| Method and path | Request | Success |
| --- | --- | --- |
| `POST /app-api/session` | `{ "email", "password" }` | `204` + `__Host-cog_session` (`Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`) |
| `DELETE /app-api/session` | — | `204`, clears the cookie |
| `GET /app-api/me` | — | `200 { "user": { "id", "email", "name", "role" }, "library": { "id", "name" } }` |

Seed: `thanh@cogniate.test` → "Thanh's Library"; `qa-b@cogniate.test` → "QA Library B". Passwords in `.env` and `infra/.secrets/seed.json` (key `portal.users`). Wrong login: `401 INVALID_CREDENTIALS`.

## 3. Courses and course versions — T4a

| Method and path | Request | Success |
| --- | --- | --- |
| `GET /app-api/courses` | — | `200 { "courses": [Course] }` |
| `POST /app-api/courses` | `{ "title", "summary"?, "variant"?: "default", "lang"?: "en" }` | `201` Course |
| `GET /app-api/courses/:courseId` | — | `200` Course with `versions` |
| `POST /app-api/courses/:courseId/versions` | `multipart/form-data`: `package` (zip ≤ 200 MB), `masteryScore`? (0–100, HTML only) | `201` CourseVersion. `masteryScore` with a SCORM package → `400 MASTERY_SCORE_NOT_ALLOWED` ("SCORM packages use the mastery score of their manifest"); nothing is stored. A value outside 0–100 → `400 INVALID_REQUEST`. |
| `GET /app-api/courses/:courseId/versions/:versionId` | — | `200` CourseVersion |
| `GET /app-api/courses/:courseId/versions/:versionId/download?kind=original` (T6) | — | `200 application/zip`, the uploaded bytes |

Course: `{ id, title, summary, variant, lang, createdAt, latestVersion, publications: [{ id, connectionId, status }] }`. `latestVersion` = `{ id, version, format, createdAt }` of the newest version, or `null` (only accepted versions are stored, so there is no status field).

CourseVersion (values for the SCORM fixture):

```json
{
  "id": "ver_...", "courseId": "crs_...", "version": 1, "format": "scorm12", "packageId": "pkg_...",
  "report": {
    "format": "scorm12", "entryPath": "index.html", "totalBytes": 12723159, "fileCount": 7,
    "scorm": { "schemaVersion": "1.2", "identifier": "com.cogniate.01M2M36B46JZVWKZDB6ETGA9R6", "title": "Build Your First Website with AI: The Zero-to-Hero Micro-Sprint", "masteryScore": 70, "scoCount": 1 },
    "html": null,
    "externalHosts": ["cogniate-prod-ai-course-creation.s3.ap-southeast-1.amazonaws.com"],
    "warnings": [ { "code": "EXTERNAL_ASSETS", "detail": "The package loads files from 1 external host." } ]
  },
  "trackingProfile": { "format": "scorm12", "launchPath": "index.html", "pages": ["index", "lesson-ai-web-sprint"], "menuPage": "index", "questionIds": ["01M2M36Y89M9KPPZENF1ZW4AWJ"], "masteryScore": 70, "minDwellMs": 10000 },
  "createdAt": "..."
}
```

HTML fixture: `format=html`, `totalBytes=12103306`, `fileCount=7`, `report.html = { "pages": ["index", "lesson-ai-web-sprint"], "menuPage": "index", "questionIds": ["01M2M36Y89M9KPPZENF1ZW4AWJ"] }`, `externalHosts = ["cogniate-prod-ai-course-creation.s3.ap-southeast-1.amazonaws.com", "fonts.gstatic.com"]`.

Report rules: `fileCount` counts files (not folders). `totalBytes` = sum of uncompressed sizes. `externalHosts` = hosts of absolute URLs that **load** a resource: `src`, `srcset`, `poster`, `<link href>`, `<base href>` (relative URLs then load from that host), CSS `url()` and `@import`. Plain links and comments do not count.

### 3.1 Detection and profile

| Rule | SCORM 1.2 | HTML |
| --- | --- | --- |
| Detect | `imsmanifest.xml` at the root, or in one single top-level folder | No manifest. `index.html` at the root or in one single top-level folder. |
| Version | `metadata/schemaversion` = `1.2` | — |
| Entry | `href` of the one resource with `adlcp:scormtype="sco"`; the file must exist | `index.html` |
| Pages | Root `.html` files (information only) | `.html` files in the entry folder. Key = file name without `.html`. |
| Menu page | — | `index`, when there is more than one page |
| Questions | `data-cog-quiz` values (information only) | Unique `data-cog-quiz` values in document order, pages sorted by name |
| Mastery | `adlcp:masteryscore` (null if absent) | upload field; default 70 if there are questions, else null |

### 3.2 Reject codes

Rejected upload: `422`, `details.message = "PACKAGE_REJECTED"`, `details.reasons = [{ "code", "title", "action", "path"?, "detail" }]` (`title` = a short plain-language name of the problem, `action` = what to do about this reason), and `details.action` = one sentence with the overall next action for the user (for example "Export the course again as SCORM 1.2 with one SCO."). Other app API errors may also carry `details.action`. Nothing stays in the package store.

```json
{ "status": 422, "error": "Unprocessable Content",
  "details": { "message": "PACKAGE_REJECTED", "description": "The package was rejected.",
    "action": "Fix the package and upload it again.",
    "reasons": [ { "code": "PATH_TRAVERSAL", "title": "Unsafe file path", "action": "Export the course again; file paths must stay inside the package.", "path": "../evil.html", "detail": "The path has a .. segment." } ] } }
``` Log: `package_rejected {codes}`.

| Code | Meaning |
| --- | --- |
| `ZIP_INVALID` | Not a readable zip |
| `ZIP_TOO_LARGE` | Upload > 200 MB, or uncompressed total > 500 MB |
| `ZIP_TOO_MANY_ENTRIES` | > 5,000 entries |
| `ZIP_BOMB` | Compression ratio of an entry > 100 |
| `PATH_TRAVERSAL` | A `..` segment anywhere in the path (also `a/../../x`) |
| `ABSOLUTE_PATH` | Starts with `/`, `\` or a drive letter |
| `SYMLINK_ENTRY` | Symbolic link |
| `INVALID_ENTRY_NAME` | A file or folder name at any depth has NUL or control characters, a backslash, bidi controls (U+200E, U+200F, U+202A–U+202E, U+2066–U+2069), or zero-width or invisible characters (U+00AD, U+200B–U+200D, U+2060, U+FEFF) |
| `DUPLICATE_ENTRY` | Same after NFC and case folding |
| `MANIFEST_INVALID_XML` | Manifest does not parse |
| `MANIFEST_DTD_FORBIDDEN` | Manifest has `<!DOCTYPE` or `<!ENTITY` |
| `SCORM_VERSION_UNSUPPORTED` | Not SCORM 1.2 |
| `MULTI_SCO_UNSUPPORTED` | More than one SCO |
| `LAUNCH_FILE_MISSING` | SCO `href` not in the zip |
| `NO_ENTRY_PAGE` | HTML package without `index.html` |
| `INVALID_PACKAGE_IDENTIFIER` | A package-derived identifier or title breaks the rules of §3.3 (`path` = file, `detail` = which field) |

### 3.3 Package-derived identifiers (A-T4a-01)

Values that come from the package are untrusted. They must pass these rules before anything is stored; otherwise the upload is rejected with `INVALID_PACKAGE_IDENTIFIER`.

| Value | Source | Rule |
| --- | --- | --- |
| Manifest, organization, item and resource identifiers | `imsmanifest.xml` | 1–128 characters, `^[A-Za-z0-9._:-]+$` |
| Question ids | `data-cog-quiz` | 1–128 characters, `^[A-Za-z0-9._:-]+$`; at most 1,000 per package |
| Page keys | `body[data-lesson-id]`, else the file name without `.html` | 1–64 characters, `^[A-Za-z0-9._-]+$`; at most 500 pages per package |
| Titles | manifest `<title>` | 1–255 characters after trim; no control characters (U+0000–U+001F except tab, U+007F–U+009F); stored as text and always escaped on output |
| Forbidden names | every id and page key, case-insensitive | `__proto__`, `prototype`, `constructor` |

Code keeps id-keyed data in `Map` objects or objects made with `Object.create(null)`.

Check order: the zip and XML checks of §3.2 run first, and the first failing check gives the code. So a character that XML 1.0 does not allow (for example U+0007, raw or as `&#7;`) gives `MANIFEST_INVALID_XML`. The §3.3 control-character rule then catches characters that are valid XML but banned here (C1 controls such as U+0085, and U+007F).

## 4. Connections — T4b1

```json
{
  "id": "con_...", "name": "Dev Moodle", "siteUrl": "https://moodle.test", "method": "dynamic",
  "status": "pending",
  "registrationUrl": "https://lti.cogniate.test/lti/register/cogniate?ref=...", "registrationUrlExpiresAt": "...",
  "platform": null, "createdAt": "...", "lastLaunchAt": null,
  "lastError": null
}
```

`lastError`: `null`, or `{ code, ltiCode, traceId, at }` of the last failed registration or manual connect (`code` = the app code, for example `REGISTRATION_FAILED`; `ltiCode` = the LTI service `details.message` if there was one, else `null`). It is cleared by the next success. The portal shows it (T6). `status`: `pending`, `registered`, `connected`, `disabled`. "Link expired" is derived (`pending` and `registrationUrlExpiresAt` past). `platform` after registration: `{ id, issuer, clientId, deploymentIds, productFamilyCode }`.

| Method and path | Request | Success / errors |
| --- | --- | --- |
| `GET /app-api/connections` | — | `200 { "connections": [...] }` |
| `POST /app-api/connections` | `{ "name", "siteUrl" (https origin), "method" }` | `201`. Dynamic: `registrationUrl` (ref valid `REF_TTL_SECONDS`, default 24 h, single use). |
| `GET /app-api/connections/:id` | — | `200` |
| `POST /app-api/connections/:id/registration-url` | — | `200 { registrationUrl, expiresAt }`. The old ref stops working. Only when `pending`, else `409 CONNECTION_NOT_PENDING`. |
| `GET /app-api/connections/:id/tool-configuration` | — | `200 [{ "key", "label", "value" }]`: exactly the 16 rows of §4.1, in that order |
| `PUT /app-api/connections/:id/platform` | `{ issuer, clientId, deploymentId, authenticationEndpoint, accessTokenEndpoint, jwksUrl }` (https; issuer origin = `siteUrl`; endpoints on the issuer origin) | `200` `registered` (calls `POST /api/platforms`). `422 INVALID_PLATFORM_VALUES` with `details.fields`. Only for a `pending` manual connection, else `409 CONNECTION_NOT_PENDING`, except a repeat of the call that bound this connection's platform (same values: `200`, same platform). Binds only a platform created in this call; an existing platform (same issuer and client id) gives `409 PLATFORM_IN_USE`, unless it is already this connection's platform (security §2.6). |
| `DELETE /app-api/connections/:id` | — | `204`, `disabled` (calls `PATCH /api/platforms/:id {active:false}`) |

The first valid launch from the platform sets `connected` and `lastLaunchAt`.

### 4.1 Tool configuration rows (manual registration)

`key` is stable (portal T6 and E2E T7 use it). `label` is the Moodle 5.2.4 form label (human text, may change). URLs come from `PUBLIC_LTI_URL`; the tool account is `cogniate`.

| # | `key` | `label` | `value` |
| --- | --- | --- | --- |
| 1 | `tool_name` | Tool name | `Cogniate (<library name>)` |
| 2 | `tool_url` | Tool URL | `{PUBLIC_LTI_URL}/lti/launch/cogniate` |
| 3 | `lti_version` | LTI version | `LTI 1.3` |
| 4 | `public_key_type` | Public key type | `Keyset URL` |
| 5 | `public_keyset_url` | Public keyset | `{PUBLIC_LTI_URL}/lti/keys/cogniate` |
| 6 | `initiate_login_url` | Initiate login URL | `{PUBLIC_LTI_URL}/lti/login/cogniate` |
| 7 | `redirection_uris` | Redirection URI(s) | `{PUBLIC_LTI_URL}/lti/launch/cogniate` |
| 8 | `deep_linking` | Supports Deep Linking (Content-Item Message) | `Yes` |
| 9 | `content_selection_url` | Content Selection URL | `{PUBLIC_LTI_URL}/lti/launch/cogniate` |
| 10 | `tool_configuration_usage` | Tool configuration usage | `Show in activity chooser and as a preconfigured tool` |
| 11 | `launch_container` | Default launch container | `New window` |
| 12 | `ags` | IMS LTI Assignment and Grade Services | `Use this service for grade sync and column management` |
| 13 | `nrps` | IMS LTI Names and Role Provisioning | `Use this service to retrieve members' information as per privacy settings` |
| 14 | `share_name` | Share launcher's name with tool | `Never` |
| 15 | `share_email` | Share launcher's email with tool | `Never` |
| 16 | `accept_grades` | Accept grades from the tool | `Delegate to teacher` |

The six values back from Moodle use the fixed keys of `PUT .../platform`: `issuer`, `clientId`, `deploymentId`, `authenticationEndpoint`, `accessTokenEndpoint`, `jwksUrl`.

## 5. Publications — T4b1 (results: T5a, T5b)

```json
{
  "id": "pub_...", "connectionId": "con_...", "courseId": "crs_...", "courseTitle": "...",
  "versionId": "ver_...", "version": 1, "format": "scorm12", "status": "available",
  "stats": { "activities": 0, "learners": 0, "inProgress": 0, "completed": 0, "passed": 0, "failed": 0, "lastScoreSync": null },
  "createdAt": "...", "updatedAt": "..."
}
```

`status`: `available` or `withdrawn`. `stats.activities` = resource links seen in launches + picks (deep-linking responses sent) not yet matched to a launch. This is intended: Moodle tells the tool nothing when a teacher picks a course and then cancels the activity form, so a cancelled pick counts until a launch shows otherwise (it never does). For that reason the portal label is "Selected in Moodle" (not "Linked") when `stats.activities > 0`, and "In use" when `stats.learners > 0`.

| Method and path | Request | Success / errors |
| --- | --- | --- |
| `POST /app-api/publications` | `{ connectionId, courseId, versionId? }` | `201` new, `200` existing (one per connection + course; version updated; `withdrawn` → `available`). `409 CONNECTION_NOT_READY`, `409 VERSION_NOT_READY`. |
| `GET /app-api/publications` | query `connectionId`?, `courseId`? | `200 { publications }` |
| `GET /app-api/publications/:id` | — | `200` |
| `POST /app-api/publications/:id/withdraw` | — | `200` `withdrawn` |
| `GET /app-api/publications/:id/results` (T5a) | — | `200 { rows: [ResultRow] }` |
| `POST /app-api/publications/:id/results/refresh` (T5b) | — | `200 { rows }` after an AGS results read per row (`SERVICE-AUTH-V1`) |
| `POST /app-api/score-syncs/:syncId/resend` (T5b) | — | `200`: the row goes back to `pending` with `tries = 0` and a new 24 h retry window. Only for `failed` or `conflict`, and never when an equal or better result for the same learner and activity is already `sent` or `pending`; else `409 SYNC_NOT_RESENDABLE`. |

ResultRow (one per learner per activity; preview attempts are rows with `preview: true`):

```json
{
  "learner": { "sub": "5", "label": "Learner 5 @ moodle.test" },
  "activity": { "resourceLinkId": "rl_...", "contextTitle": "...", "title": "..." },
  "preview": false,
  "best": { "attemptId": "att_...", "outcome": "passed", "scoreGiven": 100, "scoreMaximum": 100 },
  "attempts": [ { "attemptId": "att_...", "versionId": "ver_...", "outcome": "passed", "scoreGiven": 100, "scoreMaximum": 100, "updatedAt": "..." } ],
  "scoreSyncs": [ { "id": "sync_...", "status": "sent", "tries": 1, "scoreGiven": 100, "scoreMaximum": 100, "createdAt": "...", "sentAt": "...", "lastError": null } ],
  "gradebook": { "resultScore": 100, "resultMaximum": 100, "readAt": "..." }
}
```

`scoreSyncs` lists every row, oldest first. `gradebook` is `null` until a refresh. After a refresh, if `gradebook.resultScore / resultMaximum` differs from `best.scoreGiven / scoreMaximum` while the last sync is `sent`, the row has `gradebookDiffers: true`, and the portal shows "Moodle keeps another grade, for example a teacher override".

## 6. Tool pages and player shell — T4b1 (`/tool/register`), T4b2 (the others)

Server-rendered HTML. No cookies. Headers per page: security §5. Every tool error page logs exactly one event (§12) with its code and, when the error came from the LTI service, `lti_status` and `lti_code`. Every error page shows the code, the trace id and one action line, marked with `data-error-code`, `data-trace-id` and `data-error-action` (security §2.2). Log events: §12.

| Method and path | Input | Result |
| --- | --- | --- |
| `GET /tool/launch` | `ltik` | Handoff (security §4): single use (`409 HANDOFF_USED`); `GET /api/idtoken`; publication from the signed `launch.target` (`resource`); resource link upsert by (connection, deployment, context, resource link) with `lineItemId` and service key; attempt (data-model §2, incl. the rule after a rebind); play session. `303 /play/{playId}`, or `303 /play/{playId}/embedded` when `documentTarget` is `iframe` (`frame` and `window` open the player directly). Errors: `401` page `INVALID_LTIK` (bad or expired ltik: `launch_rejected {reason: invalid_ltik}`; a valid deep-linking ltik sent to `/tool/launch`: `launch_rejected {reason: not_resource_link}`), `502` page `LTI_SERVICE_ERROR` (the LTI service failed), `404` page "This course is not available" (`PUBLICATION_NOT_IN_CONNECTION`, `UNKNOWN_PLATFORM`), `410` page "This course is no longer available" (`PUBLICATION_WITHDRAWN`). No attempt on error. |
| `GET /tool/deep-link` | `ltik` | Checks in this order: (1) single use (`409 HANDOFF_USED`, `handoff_rejected`); (2) `GET /api/idtoken` (`401` page `INVALID_LTIK`, `deep_link_rejected {reason: invalid_ltik}`; `502` page `LTI_SERVICE_ERROR`); (3) `launch.type` is `LtiDeepLinkingRequest` (`403` page, `not_deep_linking`); (4) a role that ends with `#Instructor`, `#ContentDeveloper` or `#Administrator` (`403` page, `role_not_allowed`); (5) `platform.id` belongs to a connection (`404` page, `deep_link_rejected {reason: unknown_platform}`). Then a picker session (`PICKER_TTL_SECONDS`, default 1 h) with the ltik encrypted, and `303 /tool/picker/{pickerId}`. |
| `GET /tool/picker/{pickerId}` | — | Radio list (single select) of the connection's `available` publications: title, format badge ("SCORM 1.2" / "HTML"), version. Unknown id: `404` page `PICKER_NOT_FOUND`; used: `410` page `PICKER_USED`; expired: `410` page `PICKER_EXPIRED`. |
| `POST /tool/picker/{pickerId}` | form `publicationId` (exactly one) | Checks: picker exists (`404 PICKER_NOT_FOUND`), not used (`410 PICKER_USED`), not expired (`410 PICKER_EXPIRED`), `Origin` (403), publication of this connection and `available` (`400 PUBLICATION_NOT_AVAILABLE`, no deep-linking call). Calls `POST /api/deeplinking` with one item (flows §6b). The returned `target` (deep-link return URL) must be on the platform issuer origin, else `502` page `RETURN_URL_MISMATCH` with no "try again" advice (the action line says: give the trace id to your Moodle administrator), and no form is posted. Page with a hidden form (`JWT`, action = `target`) and a nonce script that submits it. Marks the picker used. |
| `GET /tool/register` | `registrationId`, `ref` | Checks `ref` (`pending`, not expired, not used). `GET /api/registrations/{id}`. Checks `url` origin = `siteUrl` origin (`SITE_MISMATCH`). If `operation = update`: page `UPDATE_NOT_ALLOWED` ("Go back in Moodle and choose Register as a new external tool"), always (security §2.5). Else the confirm page: site URL, Moodle version, library, "Learners are anonymous: Moodle does not send names or emails." Button "Connect". Errors: `400` page `REF_INVALID`, `REF_EXPIRED`, `SITE_MISMATCH`. |
| `POST /tool/register` | form `registrationId`, `ref` | `Origin` check (403). Calls `complete` with `privacyLevel: "anonymous"`, `autoActivate: true`, `platformName: "Cogniate (<library name>)"` (ASCII). Stores the platform (unique per connection), sets `registered`, uses up the ref. Page with a nonce script `(window.opener || window.parent).postMessage({subject:'org.imsglobal.lti.close'}, '*')` and the text "Done. Go back to Moodle and activate the tool." |
| `POST /tool/register` failure pages | — | `REGISTRATION_FAILED` (`502`): the `complete` call failed before Moodle stored a tool (for example Moodle rejected the registration, or the LTI service answered `REGISTRATION_*` or `PLATFORM_ERROR` from Moodle's answer); text: "The connection failed. Go back to Moodle and try again." `MOODLE_TOOL_MAY_EXIST` (`502`): the call failed after the registration was sent to Moodle (timeout or no answer), so Moodle may have saved a Pending tool; text: "Moodle may have saved a Pending tool. In Manage tools, delete the Pending tool 'Cogniate (<library>)', then connect again." In both cases the connection stays `pending` and the ref is not used up (the admin can use the same URL again until it expires). If the returned platform already belongs to another connection, the app shows `REGISTRATION_FAILED` and changes neither connection. |
| `GET /play/{playId}` | — | Player shell: course title (the shell script is served at `{PUBLIC_APP_URL}/_player/shell.js`, from the `apps/player` build), status text, "Back to Moodle" (`returnUrl`), runtime iframe `{PUBLIC_CONTENT_URL}/rt/{runtimeToken}` (sandbox and `allow`: security §7). Unknown or expired: `404` page `PLAY_NOT_FOUND`. |
| `GET /play/{playId}/embedded` | — | Text "This course opens in a new window." Button "Open in a new window" (`target=_blank`, `rel=noopener`) to `/play/{playId}`. |
| `GET /app-api/play/{playId}/status` | — | `200 { outcome, scoreGiven, scoreMaximum, preview, scoreSync: { status } }`; `scoreSync` is the **newest** score sync of this learner on this activity (any attempt); `scoreSync.status` is `null` before the first one. Unknown id → `404`. The shell polls every 5 s. |

Play session: `PLAY_TTL_SECONDS` (default 24 h). It holds the SHA-256 hash of the runtime token and a session id. It holds no ltik. The runtime token is derived from the play id with the app master key (HMAC); only its hash is stored, so a database copy alone cannot rebuild a runtime URL.

## 7. Content host — T5a

| Method and path | Result |
| --- | --- |
| `GET /pkg/{packageId}/{path}` | File. `Content-Type` from the allowlist (`html`, `htm`, `js`, `mjs`, `css`, `json`, `xml`, `svg`, `png`, `jpg`, `jpeg`, `gif`, `webp`, `ico`, `mp4`, `webm`, `mp3`, `wav`, `ogg`, `woff`, `woff2`, `ttf`, `otf`, `txt`, `vtt`, `pdf`), else `application/octet-stream`. `nosniff`. CSP `frame-ancestors {PUBLIC_CONTENT_URL} {PUBLIC_APP_URL}`. `Range` → `206`. Raw or encoded `..` → `400` or `404`. |
| `GET /rt/{runtimeToken}` | Runtime page (format of the attempt). CSP `frame-ancestors {PUBLIC_APP_URL}`. Unknown or expired → `404`. |
| `GET /rt/{runtimeToken}/state` | `200` RuntimeState |
| `POST /rt/{runtimeToken}/commit` | `200 { accepted: true, outcome, scoreGiven?, scoreMaximum? }`. `application/json` or `text/plain` (`sendBeacon`). |
| `GET /_rt/assets/*` | Runtime JS and CSS |
| `GET /healthz` | `200 {"status":"ok","service":"cogniate-content","profile":"default","outbound_allowlist":[...],"knobs":[]}` (same process as the app, same allowlist) |

No cookies. No CORS headers.

RuntimeState:

```json
{
  "format": "scorm12", "packageBaseUrl": "/pkg/pkg_.../", "launchPath": "index.html",
  "preview": false, "learner": { "id": "5", "name": "" },
  "sessionId": "ses_...", "lastSeq": 0,
  "scorm": { "cmi": { "core": { "total_time": "0000:01:00.00", "...": "saved values" }, "...": "..." }, "entry": "resume", "masteryScore": 70, "launchData": "", "credit": "credit" },
  "html": null
}
```

`scorm.cmi.core.total_time` is the stored total of the earlier sessions (CMITimespan); the runtime serves it as the read-only `cmi.core.total_time`.

HTML: `"scorm": null`, `"html": { "profile": <tracking profile of the attempt's version>, "progress": { "seenPages": [...], "answers": { "<id>": "1" } } }`.

Commit bodies:

```json
{ "kind": "scorm12", "event": "commit", "sessionId": "ses_...", "seq": 7,
  "cmi": { "core": { "lesson_status": "incomplete", "lesson_location": "lesson-ai-web-sprint", "score": { "raw": "100", "min": "0", "max": "100" }, "session_time": "0000:00:42.10", "exit": "suspend" },
           "suspend_data": "v:2;q:f5f1e28b;p:index;a:1", "comments": "", "interactions": [], "objectives": [] } }
```

```json
{ "kind": "html", "event": "progress", "sessionId": "ses_...", "seq": 3,
  "progress": { "seenPages": ["index", "lesson-ai-web-sprint"], "answers": { "01M2M36Y89M9KPPZENF1ZW4AWJ": "1" } } }
```

`event`: `commit`, `finish`, `unload` (SCORM); `progress`, `unload` (HTML). `seq` is a whole number ≥ 1 that starts at 1 in each session; `seq: 0` or a non-integer fails the schema (`400 INVALID_REQUEST`, `details.field = "seq"`).

Transport (T5-spike, verified in Chromium): `commit`, `finish` and `progress` use `fetch` with `keepalive: true` and `application/json`. `pagehide` sends **one** `navigator.sendBeacon` (`text/plain`) with `event: unload`, and no extra `fetch`. The runtime does not send state by `postMessage`. Bodies stay under 60 KB (browser limit for keepalive and beacon bodies is about 64 KB). Requests can arrive out of `seq` order; the runtime's `unload` can arrive before the package's last `pagehide` commits.

Check order: (1) token valid and not expired (`404`, `410 RUNTIME_EXPIRED`); (2) `sessionId` of this play session (else `400 INVALID_REQUEST`, `details.field = "sessionId"`); (3) `seq` > last accepted `seq` of the session, else `409 STALE_SEQUENCE` — except a late `finish` or `unload`: a late `finish` closes the attempt with the Moodle `LMSFinish` rule; a late `unload` is accepted but never overwrites newer data; both are logged `commit_accepted {…, stale: true}`; (4) value rules below (`400 INVALID_CMI` or `INVALID_PROGRESS`, `details.field`); (5) store, derive the outcome, maybe make a score sync. A commit after `finish` or `unload` in the same session is accepted for storage if its `seq` is higher, but it never lowers the attempt outcome. Log: `commit_rejected {code, field}`.

| Element | Rule |
| --- | --- |
| `lesson_status` | `passed`, `completed`, `failed`, `incomplete`, `browsed`, `not attempted` |
| `score.raw`, `min`, `max` | `""` or a decimal from 0 to 100 |
| `lesson_location` | ≤ 255 chars |
| `suspend_data`, `comments` | ≤ 4096 chars |
| `session_time` | `HH[HH]:MM:SS[.S[S]]` |
| `exit` | `time-out`, `suspend`, `logout`, `""` |
| `interactions` | ≤ 250; `type` and `result` per SCORM 1.2 |
| HTML `seenPages` | subset of the profile pages |
| HTML `answers` | keys in the profile questions; values `"1"` or `"0"`; a saved answer never changes |

Moodle rules that the server applies (as `mod/scorm/datamodels/scorm_12.js` does):

- On `finish`: if `lesson_status` is `not attempted`, it becomes `completed`. Then, in `normal` mode with `credit`, if a mastery score exists and `score.raw` is set, the status becomes `passed` (raw ≥ mastery) or `failed`, whatever it was before (Moodle `StoreData` with its default `masteryoverride`).
- `total_time` = the `total_time` before the session + the **largest** `session_time` seen in that session (the package's session time grows inside a session). So arrival order, stale commits and the duplicate `unload` after `finish` do not change the sum, and each session counts once.
- Next session `entry`: `resume` if the last `exit` was `suspend`, else `""`. First session: `ab-initio`.

## 8. SCORM 1.2 runtime (`window.API`) — T5a

One runtime page load = one session. The API object is **our own subset** (T5-spike decision, ADR-004). After `LMSFinish` every call answers `101`, and `LMSInitialize` is not allowed again in the same page load (Moodle allows it; the spike showed that the package then sends a second `finish`).

| Call | Before `LMSInitialize` | Session open | After `LMSFinish` |
| --- | --- | --- | --- |
| `LMSInitialize("")` | `"true"`, `0` | `"false"`, `101` | `"false"`, `101` |
| `LMSGetValue(el)` | `""`, `301` | value, `0` (or `201`, `401`, `404`) | `""`, `101` |
| `LMSSetValue(el, v)` | `"false"`, `301` | `"true"` or `"false"` (`201`, `402`, `403`, `405`) | `"false"`, `101` |
| `LMSCommit("")` | `"false"`, `301` | `"true"`, `0` (sends `commit`) | `"false"`, `101` |
| `LMSFinish("")` | `"false"`, `301` | `"true"`, `0` (sends `finish`) | `"false"`, `101` |
| `LMSGetLastError()`, `LMSGetErrorString(code)`, `LMSGetDiagnostic(code)` | text | | |

A non-empty argument to `LMSInitialize`, `LMSCommit` or `LMSFinish` → `"false"`, `201`. An element that is not in the SCORM 1.2 data model (for example `cmi.foo`) → `201`, as in SCORM 1.2 and Moodle. A SCORM 1.2 element that we do not implement → `401`.

| Element | Access | Value |
| --- | --- | --- |
| `cmi.core._children`, `cmi.core.score._children`, `cmi.student_data._children`, `cmi.interactions._children`, `cmi.objectives._children` | RO | standard lists |
| `cmi.core.student_id` | RO | LTI `sub` |
| `cmi.core.student_name` | RO | `"Family, Given"` if shared, else `""` |
| `cmi.core.lesson_location` | RW | |
| `cmi.core.credit` | RO | `credit` (`no-credit` in preview) |
| `cmi.core.lesson_status` | RW | setting `not attempted` → `405` |
| `cmi.core.entry` | RO | `ab-initio`, `resume`, `""` |
| `cmi.core.score.raw`, `.min`, `.max` | RW | |
| `cmi.core.total_time` | RO | |
| `cmi.core.lesson_mode` | RO | `normal` |
| `cmi.core.exit`, `cmi.core.session_time` | WO (read → `404`) | |
| `cmi.suspend_data` | RW | |
| `cmi.launch_data` | RO | manifest `adlcp:datafromlms` or `""` |
| `cmi.comments` | RW | |
| `cmi.comments_from_lms` | RO | `""` |
| `cmi.student_data.mastery_score` | RO | manifest value |
| `cmi.student_data.max_time_allowed`, `.time_limit_action` | RO | `""` |
| `cmi.interactions._count`, `cmi.objectives._count` | RO | |
| `cmi.interactions.n.*` | WO | `id`, `objectives.n.id`, `time`, `type`, `correct_responses.n.pattern`, `weighting`, `student_response`, `result`, `latency` |
| `cmi.objectives.n.id`, `.score.*`, `.status` | RW | |
| `cmi.student_preference.*` | — | `401` (not implemented) |

## 9. HTML runtime — T5b

Depends on the "Cogniate HTML export markup v1" (Q7):

| Markup | Meaning |
| --- | --- |
| `<body data-lesson-id="{key}">` | page key (fallback: file name without `.html`) |
| `[data-cog-quiz="{questionId}"]` | question container |
| `input[data-cog-correct="true" | "false"]` inside it | one option; `true` = correct |
| `a[href$=".html"]` without a scheme | internal link: the runtime removes `target` and `rel` |

Rules: ADR-004 "HTML: option C". The runtime does not change package bytes. It attaches to each child document when `readyState` is `interactive` or `complete` (poll and `load`), never only on `load`, because a hanging external host blocks `load`.

## 10. Score sync worker — T5a (retry schedule and Resend: T5b)

Sends `POST /api/lineitems/{encodeURIComponent(lineItemId)}/scores` with `SERVICE-AUTH-V1`:

```json
{ "userId": "5", "activityProgress": "Completed", "gradingProgress": "FullyGraded", "scoreGiven": 100, "scoreMaximum": 100 }
```

| Answer | Row status |
| --- | --- |
| `204` | `sent` |
| `409 PLATFORM_CONFLICT` | `conflict` (no retry; "Moodle has a grade with a newer time"). A teacher override alone does **not** cause a 409: Moodle 5.2.4 accepts the score and keeps the override (`scores.php` compares times; `grade_item::update_raw_grade` does not change an overridden final grade). |
| `400`, `404` (`PLATFORM_REJECTED_REQUEST`) | `failed` at once, `lastError` = description |
| `403` from the LTI service (for example `SERVICE_NOT_AVAILABLE`, `PLATFORM_NOT_ACTIVE`) | `failed` at once (a retry cannot fix it), `lastError` = the code |
| `401`, `5xx`, `502`, `504`, network error | retry: 5 s, 30 s, 2 min, 10 min, 30 min, then every 1 h until 24 h after `createdAt`, then `failed` |

When rows are made: ADR-010.

## 11. Stretch (T8): course shell and web services

| Method and path | Request | Success / errors |
| --- | --- | --- |
| `PUT /app-api/connections/:id/web-services` | `{ token }` | `200 { siteName, release, functions }` after `core_webservice_get_site_info`. `422 WS_TOKEN_INVALID` or `WS_FUNCTIONS_MISSING`. |
| `POST /app-api/publications` with `createMoodleCourse: { categoryId? }` | — | Publication with `moodleCourse { id, idnumber, url }`, `shellStatus` (`created`, `exists`, `failed`) |
| `GET .../versions/:versionId/download?kind=mbz`, `POST .../mbz` | — | T8 |

Web services functions the app needs: `core_webservice_get_site_info`, `core_course_get_courses_by_field`, `core_course_create_courses`. Shell: `idnumber = cogniate:{courseId}:{variant}:{lang}`, `visible = 0`.

## 12. Log events

Every event: `ts`, `level`, `service` (`cogniate-app` or `cogniate-content`), `event`, `trace_id` (lifecycle events: the per-process boot trace id). Files: `infra/.logs/cogniate-app.jsonl`, `infra/.logs/cogniate-content.jsonl`. No secret in any field.

| Event | Level | Fields |
| --- | --- | --- |
| `service_started` | info | `node`, `port`, `public_url`, `profile`, `outbound_allowlist`, `knobs` |
| `service_stopping` | info | — |
| `test_knob_active` | warn | `name`, `value` |
| `http_request` | info | `method`, `path` (no query, no capability ids: `/play/:id`), `status`, `ms`. Every request except `GET /healthz` (not in the JSON log file; stdout may keep it at `debug`, B-T1-04). |
| `outbound_request` | info | `host`, `method`, `status`, `ms` (every call to the LTI service or Moodle) |
| `outbound_blocked` | warn | `host`, `method`, `reason` (policy or failure reasons of security §9) |
| `csrf_rejected` | warn | `origin` |
| `package_accepted` | info | `version_id`, `format` |
| `package_rejected` | warn | `codes` |
| `handoff_rejected` | warn | `code` (`HANDOFF_USED`) |
| `launch_rejected` | warn | `reason`: `publication_not_in_connection`, `publication_withdrawn`, `unknown_platform`, `invalid_ltik`, `not_resource_link` (a valid deep-linking ltik on `/tool/launch`), `lti_service_error`; plus `lti_status`, `lti_code` when the LTI service answered with an error |
| `launch_accepted` | info | `attempt_id`, `preview` |
| `resource_link_rebound` | info | `resource_link_id`, `from_publication`, `to_publication` |
| `deep_link_rejected` | warn | `reason`: `not_deep_linking` (the ltik is not a deep-linking launch), `role_not_allowed`, `invalid_ltik`, `unknown_platform`; plus `lti_status`, `lti_code` when the LTI service answered with an error |
| `picker_rejected` | warn | `reason`: `not_found`, `used`, `expired`, `publication_not_available`, `lti_service_error`, `return_url_mismatch`; plus `lti_status`, `lti_code` when the LTI service answered with an error |
| `retention_cleanup` | info | `table`, `deleted` |
| `platform_orphan_deactivated` | warn | `platform_id` |
| `platform_orphan_deactivate_failed` | error | `platform_id`, `error` (the LTI service code or the error class name) |
| `registration_confirm_rejected` | warn | `code` (incl. `REGISTRATION_FAILED`, `MOODLE_TOOL_MAY_EXIST`, `UPDATE_NOT_ALLOWED`) |
| `commit_accepted` | info | `session_id`, `seq`, `commit_event`, `stale` (true for a late `finish` or `unload`) (`commit`, `finish`, `unload` or `progress`; the field is not called `event`, because every log line already has `event`) |
| `internal_error` | error | `method`, `path` (no query, no capability ids), `error` (the error class name only, for example `TypeError`). No error message with data and no stack trace in the JSON file (stdout may print the stack at `debug`). The response is `500 INTERNAL_ERROR` with the trace id. |
| `commit_rejected` | warn | `code`, `field` |
| `outcome_changed` | info | `attempt_id`, `outcome` |
| `score_sync` | info | `sync_id`, `status`, `tries` |
| `gradebook_refresh_failed` | warn | `publication_id`, `resource_link_id`, `lti_status`, `lti_code` (one per row that "Refresh from Moodle" could not read) |
