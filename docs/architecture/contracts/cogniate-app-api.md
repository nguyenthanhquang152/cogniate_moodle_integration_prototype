# Contract: Cogniate app (stand-in for the Cogniate platform)

Status: T0 round 2; M0 multi-LMS additions in §4.2–§4.8, §5.1 and §6.1 (2026-10-20). Owner: Architect. Security rules: [`../security.md`](../security.md). Flows: [`../flows.md`](../flows.md).

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
| §4.2–§4.8 LMS types, providers, portal routes, Canvas and Blackboard registration with operator grants, deployments, capability guards, grant CLI; §5.1 publication fields; §6.1 multi-LMS tool page rules; §12 additions | M1 (portal use: M2) |

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
- `GET {PUBLIC_APP_URL}/healthz` → `200 {"status":"ok","service":"cogniate-app","profile":"default","outbound_allowlist":["lti.cogniate.test","moodle.test"],"knobs":[]}`. `profile` is `acceptance` in that compose profile (local-stack §3), and `outbound_allowlist` then also has `qa-platform.test` and `evil.test`.

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

Rejected upload: `422`, `details.message = "PACKAGE_REJECTED"`, `details.reasons = [{ "code", "title", "action", "path"?, "detail" }]` (`title` = a short plain-language name of the problem, `action` = what to do about this reason, `path` = the zip entry name that failed, always present for entry-level codes: `PATH_TRAVERSAL`, `ABSOLUTE_PATH`, `SYMLINK_ENTRY`, `INVALID_ENTRY_NAME`, `DUPLICATE_ENTRY`, `ZIP_BOMB`, `LAUNCH_FILE_MISSING`, and for `INVALID_PACKAGE_IDENTIFIER`), and `details.action` = one sentence with the overall next action for the user (for example "Export the course again as SCORM 1.2 with one SCO."). Other app API errors may also carry `details.action`. Nothing stays in the package store.

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

`lastError`: `null`, or `{ code, title, action, ltiCode, traceId, at }` of the last failed registration or manual connect (`code` = the app code, for example `REGISTRATION_FAILED`; `title` and `action` = server-owned plain-language texts from the same table as the tool error pages; `ltiCode` = the LTI service `details.message` if there was one, else `null`). It is cleared by the next success. The portal shows it (T6). `status`: `pending`, `registered`, `connected`, `disabled`. "Link expired" is derived (`pending` and `registrationUrlExpiresAt` past). `platform` after registration: `{ id, issuer, clientId, deploymentIds, productFamilyCode }`.

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
| 16 | `accept_grades` | Accept grades from the tool | `As specified in Deep Linking definition or Delegate to teacher` (the exact Moodle 5.2.4 option text of the tool form, Q-T7-01) |

The six values back from Moodle use the fixed keys of `PUT .../platform`: `issuer`, `clientId`, `deploymentId`, `authenticationEndpoint`, `accessTokenEndpoint`, `jwksUrl`.

### 4.2 LMS type, provider profile and capabilities (M1)

Design: [ADR-011](../adr/ADR-011-multi-lms.md). All fields below are additions. A request without them behaves as in §4 and §4.1 (LMS `moodle`, profile `standard`).

Connection DTO (every connection answer; new fields marked M1):

| Field | Type | Rule |
| --- | --- | --- |
| `id`, `name`, `siteUrl`, `method`, `status`, `createdAt`, `lastLaunchAt`, `lastError`, `webServices` | as §4 | unchanged |
| `registrationUrl`, `registrationUrlExpiresAt` | string or `null` | unchanged (pending dynamic Moodle connection only) |
| `lms` (M1) | `"moodle"`, `"canvas"`, `"blackboard"` | stored; default `moodle` |
| `profile` (M1) | string | LTI service profile id; stored; default per LMS: `moodle` → `standard`, `canvas` → `canvas-cloud-production`, `blackboard` → `blackboard` |
| `serviceUrl` (M1) | string | Canvas: the service URL (https origin of the Canvas AGS and NRPS URLs and the token endpoint; the root account domain); stored; default `siteUrl`. Moodle and Blackboard: always equal to `siteUrl`. |
| `capabilities` (M1) | object of booleans | derived from `lms` ([ADR-011 §11](../adr/ADR-011-multi-lms.md#11-capabilities)): `dynamicRegistration`, `operatorApproval`, `webServices`, `courseShell`, `addDeployment`, `canvasConfiguration` |
| `platform` | object or `null` | `{ id, issuer, clientId, deploymentIds, productFamilyCode, siteUrl (M1), serviceUrl (M1) }`. `siteUrl` = the site origin, `serviceUrl` = the service origin (for Moodle both equal the connection `siteUrl`). Blackboard: `deploymentIds` has only this connection's deployment, never other schools' ids. |

The DTO never contains an approval code, a grant note or a grant id.

Example (registered Canvas connection):

```json
{
  "id": "con_...", "name": "School A Canvas", "siteUrl": "https://canvas.school-a.edu", "method": "manual", "status": "registered",
  "lms": "canvas", "profile": "canvas-cloud-production", "serviceUrl": "https://school-a.instructure.com",
  "capabilities": { "dynamicRegistration": false, "operatorApproval": true, "webServices": false, "courseShell": false, "addDeployment": true, "canvasConfiguration": true },
  "registrationUrl": null, "registrationUrlExpiresAt": null,
  "platform": { "id": "plt_...", "issuer": "https://canvas.instructure.com", "clientId": "10000000000042", "deploymentIds": ["12:8865aa05b4b79b64a91a86042e43af5ea8ae79eb"], "productFamilyCode": "canvas", "siteUrl": "https://canvas.school-a.edu", "serviceUrl": "https://school-a.instructure.com" },
  "createdAt": "...", "lastLaunchAt": null, "lastError": null, "webServices": null
}
```

`POST /app-api/connections` body: `{ name, siteUrl, method, lms?, profile?, serviceUrl? }`.

| Rule | Error |
| --- | --- |
| `lms` not one of the three | `400 INVALID_REQUEST`, `details.field = "lms"` |
| `profile` is not a profile of that LMS in `GET /app-api/lms-providers` (simulation profiles only when they are on) | `400 INVALID_REQUEST`, `details.field = "profile"` |
| `method: "dynamic"` with `lms` other than `moodle` | `422 CAPABILITY_NOT_SUPPORTED`, `details.capability = "dynamicRegistration"`; nothing stored |
| `lms` other than `moodle`: `siteUrl` or `serviceUrl` breaks a site rule ([ADR-011 §6](../adr/ADR-011-multi-lms.md#6-provider-trust-profiles); the same shared function as the LTI service) | `422 INVALID_SITE_URL`, `details.rule` (1 to 5), `details.field` (`siteUrl` or `serviceUrl`) |
| `serviceUrl` with `lms` other than `canvas` | `400 INVALID_REQUEST`, `details.field = "serviceUrl"` |
| `lms: "blackboard"` and the profile has no active shared platform | `409 PROVIDER_NOT_READY`; action: "Ask the Cogniate operator to register the Blackboard application." |

A new Canvas or Blackboard connection is `pending` and has `method: "manual"`. The Moodle rules of §4 do not change.

Portal routes (the app serves the portal for these paths; M1 adds them to the server allowlist, M2 to the portal router): `/integrations/canvas/connect`, `/integrations/canvas/:connectionId`, `/integrations/blackboard/connect`, `/integrations/blackboard/:connectionId`, next to the existing Moodle routes. A route whose LMS is not the connection's `lms` shows the portal's "not found" view. Other unknown paths keep today's behaviour (no portal fallback for `/app-api/*`, `/tool/*`, `/play/*`).

### 4.3 `GET /app-api/lms-providers` (M1)

Session required. The app builds the answer from `GET /api/providers` (LTI contract §9.3). Failure of that call: `502 LTI_SERVICE_ERROR`.

```json
{
  "lms": [
    { "lms": "moodle", "label": "Moodle", "methods": ["dynamic", "manual"],
      "capabilities": { "dynamicRegistration": true, "operatorApproval": false, "webServices": true, "courseShell": true, "addDeployment": false, "canvasConfiguration": false },
      "profiles": [ { "id": "standard", "label": "Moodle site", "simulation": false, "ready": true, "clientId": null } ] },
    { "lms": "canvas", "label": "Canvas", "methods": ["manual"],
      "capabilities": { "dynamicRegistration": false, "operatorApproval": true, "webServices": false, "courseShell": false, "addDeployment": true, "canvasConfiguration": true },
      "profiles": [
        { "id": "canvas-cloud-production", "label": "Instructure-hosted Canvas (production)", "simulation": false, "ready": true, "clientId": null },
        { "id": "canvas-cloud-beta", "label": "Instructure-hosted Canvas (beta)", "simulation": false, "ready": true, "clientId": null },
        { "id": "canvas-cloud-test", "label": "Instructure-hosted Canvas (test)", "simulation": false, "ready": true, "clientId": null },
        { "id": "canvas-self-hosted", "label": "Self-hosted Canvas", "simulation": false, "ready": true, "clientId": null } ] },
    { "lms": "blackboard", "label": "Blackboard Learn", "methods": ["manual"],
      "capabilities": { "dynamicRegistration": false, "operatorApproval": true, "webServices": false, "courseShell": false, "addDeployment": false, "canvasConfiguration": false },
      "profiles": [ { "id": "blackboard", "label": "Blackboard Learn", "simulation": false, "ready": false, "clientId": null } ] }
  ]
}
```

Simulation profile labels: `Canvas cloud (simulation)` for `canvas-sim-cloud`, `Blackboard Learn (simulation)` for `blackboard-sim`; they come last in their LMS list with `"simulation": true`, only when the LTI service reports them (LTI contract §9.13). `ready` = the profile is exclusive, or its shared platform exists and is active. `clientId` = the shared platform client id (the Blackboard Application ID), else `null`. Labels are app texts.

### 4.4 `PUT /app-api/connections/:id/platform` per LMS (M1)

Moodle (`profile: standard`): unchanged (§4). No grant.

Canvas and Blackboard use a strict body. A key that is not listed (for example `issuer`, an endpoint, or `clientSecret`) gives `422 INVALID_PLATFORM_VALUES` with that key in `details.fields`, and nothing changes. A listed key that is missing also gives `422 INVALID_PLATFORM_VALUES` with that key. Values are trimmed, 1 to 255 characters, printable ASCII without spaces (`0x21`–`0x7E`); `grantCode` is 43 base64url characters.

| LMS | Body | After the grant redemption (§4.7) | Success |
| --- | --- | --- | --- |
| `canvas` | `{ clientId, deploymentId, grantCode }` | `POST /api/platforms { profile, clientId, name: "Cogniate (<library>)", siteUrl, serviceUrl, deploymentIds: [deploymentId] }`; for `canvas-self-hosted` the issuer is `siteUrl` | `200`, `registered` |
| `blackboard` | `{ deploymentId, grantCode, clientId? }` (`clientId`, if sent, must equal the shared client id, else `422`, field `clientId`) | `POST /api/platforms/{shared id}/deployments { deploymentId, siteUrl }`; for an inactive deployment of a disabled connection of the same library: `PATCH …/deployments/{id} { active: true, siteUrl }` (new binding, generation + 1) | `200`, `registered` |

| Case | Answer |
| --- | --- |
| Grant errors | §4.7 (`403 GRANT_INVALID`, `422 GRANT_MISMATCH`, `409 GRANT_IN_USE`) |
| Canvas: the LTI service answers `409 PLATFORM_ALREADY_EXISTS` | If that platform has exactly the grant's profile, issuer, client id, site and service URL, contains the deployment, and **no** connection owns it: bind it (grant-authorized recovery; set it active). Else `409 PLATFORM_IN_USE` ("This Canvas developer key is already connected to Cogniate. Make a new developer key for this library."); the grant stays unredeemed. |
| Blackboard: the deployment is reserved by another connection that is not a `disabled` connection of the same library | `409 DEPLOYMENT_IN_USE` ("This Blackboard site is already connected to Cogniate."); no LTI service call; the grant stays unredeemed |
| Blackboard: the LTI service answers `409 DEPLOYMENT_ALREADY_EXISTS` while this connection holds the reservation | active with the same site: bind; inactive: `PATCH { active: true, siteUrl }`; active with another site: `409 DEPLOYMENT_IN_USE` |
| Blackboard: no active shared platform | `409 PROVIDER_NOT_READY` |
| A repeat of the call that registered this connection (same `clientId` and `deploymentId`) | `200`, nothing changes, no grant is checked or used |
| The LTI service fails (5xx, timeout) | `502 LTI_SERVICE_ERROR`. The grant stays unredeemed (its redeeming mark is cleared). Blackboard: the reservation stays with this pending connection. A retry with the same grant can finish. |
| The LTI service answers `400 INVALID_SITE_URL` | `422 INVALID_SITE_URL` |
| The platform or deployment was created but the connection is no longer pending | the app switches it off (platform `active: false`, or deployment `active: false` with `deployment_orphan_deactivated`); the grant stays unredeemed |

### 4.5 Tool configuration rows for Canvas and Blackboard (M1)

`GET /app-api/connections/:id/tool-configuration` keeps the 16 Moodle rows of §4.1 for `moodle`. For the other LMS types it returns these rows, in this order. `key` is stable. `label` is the LMS form label (human text; the live checks confirm it). URLs come from `PUBLIC_LTI_URL`; the tool account is `cogniate`.

Canvas (developer key form; only the Paste JSON method is supported):

| # | `key` | `label` | `value` |
| --- | --- | --- | --- |
| 1 | `key_name` | Key Name | `Cogniate (<library name>)` |
| 2 | `redirect_uris` | Redirect URIs | `{PUBLIC_LTI_URL}/lti/launch/cogniate` |
| 3 | `method` | Method | `Paste JSON` |
| 4 | `lti_json` | LTI 1.3 Configuration | `Paste the JSON from "Copy JSON" or "Download JSON". Do not edit it.` |

Blackboard (Learn tool registration; values the Learn admin compares):

| # | `key` | `label` | `value` |
| --- | --- | --- | --- |
| 1 | `client_id` | Client ID | the shared client id (Application ID) |
| 2 | `login_initiation_url` | Login Initiation URL | `{PUBLIC_LTI_URL}/lti/login/cogniate` |
| 3 | `tool_redirect_url` | Tool Redirect URL(s) | `{PUBLIC_LTI_URL}/lti/launch/cogniate` |
| 4 | `tool_jwks_url` | Tool JWKS URL | `{PUBLIC_LTI_URL}/lti/keys/cogniate` |
| 5 | `tool_status` | Tool Status | `Approved` |
| 6 | `user_fields` | User Fields to Send | `Role in Course only. Do not send Name or Email Address.` |
| 7 | `grade_service` | Allow grade service access | `Yes` |
| 8 | `membership_service` | Allow Membership Service access | `Yes` |
| 9 | `placement` | Placement | `Cogniate: type Deep Linking, Target Link URI {PUBLIC_LTI_URL}/lti/launch/cogniate, student access off` |

Values that come back use the fixed keys of §4.4. The approval code comes from the operator, not from the LMS.

### 4.6 `GET /app-api/connections/:id/canvas-configuration` (M1)

Canvas connections only; other LMS types give `409 CAPABILITY_NOT_SUPPORTED`. Query `jwk`: `url` (default) or `inline`; another value gives `400 INVALID_REQUEST`. Headers: `Content-Type: application/json; charset=utf-8`, `Content-Disposition: attachment; filename="cogniate-canvas-lti.json"`, `Cache-Control: no-store`. The document is served only through this signed-in API (no public configuration URL). Body (exactly these keys; values for `cogniate`):

```json
{
  "title": "Cogniate (<library name>)",
  "description": "Cogniate courses (SCORM 1.2 and HTML) with grade return.",
  "oidc_initiation_url": "{PUBLIC_LTI_URL}/lti/login/cogniate",
  "target_link_uri": "{PUBLIC_LTI_URL}/lti/launch/cogniate",
  "scopes": [
    "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem",
    "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly",
    "https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly",
    "https://purl.imsglobal.org/spec/lti-ags/scope/score",
    "https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly"
  ],
  "extensions": [
    {
      "domain": "<host of PUBLIC_LTI_URL>",
      "tool_id": "cogniate",
      "platform": "canvas.instructure.com",
      "privacy_level": "anonymous",
      "settings": {
        "text": "Cogniate",
        "placements": [
          { "placement": "assignment_selection", "message_type": "LtiDeepLinkingRequest", "target_link_uri": "{PUBLIC_LTI_URL}/lti/launch/cogniate", "text": "Cogniate" }
        ]
      }
    }
  ],
  "public_jwk_url": "{PUBLIC_LTI_URL}/lti/keys/cogniate",
  "custom_fields": {}
}
```

With `jwk=inline` the key `public_jwk_url` is replaced by `public_jwk`: a **snapshot** of the active tool public key from `GET {PUBLIC_LTI_URL}/lti/keys/cogniate` (`kty`, `kid`, `alg: "RS256"`, `use: "sig"`, `n`, `e`; never a private member), and the answer has the header `X-Cogniate-Key-Id: <kid>`. Every other key is the same. Canvas does not refresh an inline key: after `lti:bootstrap --rotate-signing-key`, the Canvas admin must paste a new export, or Deep Linking and grade return fail for that installation. `platform` is `canvas.instructure.com` for every Canvas profile (it names the extension set, not a host). `link_selection` is not offered (ADR-011 §8, D-11).

### 4.7 Operator approval grants, deployments, disconnect and guards (M1)

Grant redemption (Canvas `PUT …/platform`, Canvas `POST …/deployments`, Blackboard `PUT …/platform`). Checks in this order, in one database transaction, before any LTI service call:

| # | Check | Failure |
| --- | --- | --- |
| 1 | `grantCode` has the right form and its SHA-256 matches a grant | `403 GRANT_INVALID` |
| 2 | The grant is not revoked, not redeemed and not expired | `403 GRANT_INVALID` |
| 3 | The grant's `library_id` is the session library, its `connection_id` is the path connection, and its `purpose` fits the endpoint (`initial` for `PUT …/platform`, `add_deployment` for `POST …/deployments`) | `403 GRANT_INVALID` |
| 4 | The grant's LMS type, profile, site URL and service URL equal the connection; its client id and deployment id equal the request (Blackboard: the shared client id) | `422 GRANT_MISMATCH`, `details.fields` = the request keys that differ (`clientId`, `deploymentId`), or `["connection"]` if the connection changed |
| 5 | No other redemption of this grant runs (`redeeming_since` is null or older than 60 s) | `409 GRANT_IN_USE` |
| 6 | Blackboard: reserve (shared platform, deployment): free, or held by a `disabled` connection of the same library (the row moves) | `409 DEPLOYMENT_IN_USE` |

Then the transaction sets `redeeming_since` and commits. The LTI service call follows (§4.4). On success one transaction sets `redeemed_at`, updates the connection (`registered`, or the new deployment in `platform`) and logs `grant_redeemed`. On an LTI failure the app clears `redeeming_since`. Every `403` and `422` above logs `grant_rejected {reason}` with a precise reason (`not_found`, `revoked`, `redeemed`, `expired`, `other_library`, `other_connection`, `purpose`, `mismatch`) and changes no LTI row. The answer never says which of checks 1 to 3 failed.

| Method and path | Request | Success / errors |
| --- | --- | --- |
| `POST /app-api/connections/:id/deployments` | `{ deploymentId, grantCode }` (strict body) | Canvas connections that are `registered` or `connected`, after the redemption above (`purpose: add_deployment`): `POST /api/platforms/:id/deployments` on the connection's own platform (an existing inactive row: `PATCH { active: true }`); `200` connection. An id that is already active on this platform: `200`, no change, no grant is used. Other LMS types: `409 CAPABILITY_NOT_SUPPORTED` (`addDeployment`). Status `pending` or `disabled`: `409 CONNECTION_NOT_READY`. |
| `DELETE /app-api/connections/:id` | — | `moodle`, `canvas`: unchanged (platform `active: false`). `blackboard`: if the connection holds a reservation, `PATCH /api/platforms/{shared id}/deployments/{deploymentId} { active: false }` only; the shared platform and other deployments do not change; the reservation stays with the disabled connection. Unredeemed grants of the connection are revoked. |

Score syncs of a disabled Canvas or Blackboard connection (ADR-011 §12): the worker sends nothing; a due row becomes `failed` with `lastError = "CONNECTION_DISABLED"` and one `score_sync` event without a POST (`phase: "send"`, `tries` unchanged). `POST /app-api/score-syncs/:id/resend` and `POST /app-api/publications/:id/results/refresh` for such a connection: `409 CONNECTION_NOT_READY`. Moodle connections are unchanged.

Capability guards (nothing is stored when they fire):

| Request | Guard |
| --- | --- |
| `PUT /app-api/connections/:id/web-services` (§11) on a connection that is not `moodle` | `409 CAPABILITY_NOT_SUPPORTED`, `details.capability = "webServices"`; no outbound call |
| `POST /app-api/publications` with `createMoodleCourse` for a connection that is not `moodle` | `409 CAPABILITY_NOT_SUPPORTED`, `details.capability = "courseShell"`; no publication is made or changed |
| `POST /app-api/connections/:id/registration-url` on a connection that is not `moodle` | `409 CONNECTION_NOT_PENDING` (unchanged code: only a pending dynamic connection has a URL) |

### 4.8 Operator CLI: approval grants (M1)

The operator runs it in the app service (`docker compose exec cogniate-app …`). It is not reachable over HTTP.

```sh
npm run app:grant -w services/cogniate-app -- issue --connection <con_id> --site <origin> [--service-url <origin>] --client-id <id> --deployment-id <id> \
    [--purpose initial|add_deployment] [--ttl-seconds 86400] --note "<evidence reference>"
npm run app:grant -w services/cogniate-app -- revoke --grant <grt_id>
npm run app:grant -w services/cogniate-app -- list --connection <con_id>
```

| Rule | Detail |
| --- | --- |
| Issue checks | The connection exists and is `canvas` or `blackboard`. `initial`: the connection is `pending`. `add_deployment`: a Canvas connection that is `registered` or `connected`, and `--client-id` equals its platform client id. `--site` equals the connection `siteUrl`. `--service-url` (Canvas only; default `--site`) equals the connection `serviceUrl`. Blackboard: `--client-id` equals the active shared platform client id. Ids: 1 to 255 printable ASCII without spaces. `--ttl-seconds`: 60 to 604800 (default 86400). `--note`: 1 to 500 characters. Any failure: exit 1 with one line, nothing stored. |
| Issue output | Grant id, approval code (shown only here, once), expiry time. A new grant for the same connection and purpose revokes older unredeemed ones. |
| Revoke | Sets `revoked_at` on an unredeemed grant (exit 0). A redeemed grant cannot be revoked (exit 1); disconnect the connection instead. |
| List | Grant id, purpose, site, service URL, client id, deployment id, created, expires, state (`issued`, `redeeming`, `redeemed`, `expired`, `revoked`). Never the code or its hash. |
| Logs | `grant_issued {grant_id, connection_id, purpose, expires_at}`, `grant_revoked {grant_id}`. Never the code. |

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
| `POST /app-api/score-syncs/:syncId/resend` (T5b) | — | `200`: the row goes back to `pending` with `tries = 0` and a new 24 h retry window. Only the learner's current **best** final result on that resource link is ever sent: Resend works only for a `failed` or `conflict` row whose score is that best result. A row whose score is lower than any existing final result of the learner on that resource link (whatever that result's sync status: `sent`, `pending`, `conflict`, `failed`, or a final attempt with no row) → `409 SYNC_NOT_RESENDABLE`. Any other status → `409 SYNC_NOT_RESENDABLE`. |

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

### 5.1 Publication fields for the portal (M1)

Every publication answer gets two additions: `lms` (the connection's LMS type) and `connectionName`. The portal shows them in the publish dialog, the course page and the results page.

## 6. Tool pages and player shell — T4b1 (`/tool/register`), T4b2 (the others)

Server-rendered HTML. No cookies. Headers per page: security §5. Every tool error page logs exactly one event (§12) with its code and, when the error came from the LTI service, `lti_status` and `lti_code`. Every error page shows the code, the trace id and one action line, marked with `data-error-code`, `data-trace-id` and `data-error-action` (security §2.2). Log events: §12.

| Method and path | Input | Result |
| --- | --- | --- |
| `GET /tool/launch` | `ltik` | Handoff (security §4): single use (`409 HANDOFF_USED`); `GET /api/idtoken`; publication from the signed `launch.target` (`resource`); resource link upsert by (connection, deployment, context, resource link) with `lineItemId` and service key; attempt (data-model §2, incl. the rule after a rebind); play session. `303 /play/{playId}`, or `303 /play/{playId}/embedded` when `documentTarget` is `iframe` (`frame` and `window` open the player directly). Errors: `401` page `INVALID_LTIK` (bad or expired ltik: `launch_rejected {reason: invalid_ltik}`; a valid deep-linking ltik sent to `/tool/launch`: `launch_rejected {reason: not_resource_link}`), `502` page `LTI_SERVICE_ERROR` (the LTI service failed), `404` page "This course is not available" (`PUBLICATION_NOT_IN_CONNECTION`, `UNKNOWN_PLATFORM`), `410` page "This course is no longer available" (`PUBLICATION_WITHDRAWN`). No attempt on error. |
| `GET /tool/deep-link` | `ltik` | Checks in this order: (1) single use (`409 HANDOFF_USED`, `handoff_rejected`); (2) `GET /api/idtoken` (`401` page `INVALID_LTIK`, `deep_link_rejected {reason: invalid_ltik}`; `502` page `LTI_SERVICE_ERROR`); (3) `launch.type` is `LtiDeepLinkingRequest` (`403` page, `not_deep_linking`); (4) a role that ends with `#Instructor`, `#ContentDeveloper` or `#Administrator` (`403` page, `role_not_allowed`; M1: the role sets of §6.1); (5) `platform.id` belongs to a connection (`404` page, `deep_link_rejected {reason: unknown_platform}`). Then a picker session (`PICKER_TTL_SECONDS`, default 1 h) with the ltik encrypted, and `303 /tool/picker/{pickerId}`. |
| `GET /tool/picker/{pickerId}` | — | Radio list (single select) of the connection's `available` publications: title, format badge ("SCORM 1.2" / "HTML"), version. Unknown id: `404` page `PICKER_NOT_FOUND`; used: `410` page `PICKER_USED`; expired: `410` page `PICKER_EXPIRED`. |
| `POST /tool/picker/{pickerId}` | form `publicationId` (exactly one) | Checks: picker exists (`404 PICKER_NOT_FOUND`), not used (`410 PICKER_USED`), not expired (`410 PICKER_EXPIRED`), `Origin` (403), publication of this connection and `available` (`400 PUBLICATION_NOT_AVAILABLE`, no deep-linking call). Calls `POST /api/deeplinking` with one item (flows §6b). The returned `target` (deep-link return URL) must be on the platform issuer origin, else `502` page `RETURN_URL_MISMATCH` with no "try again" advice (the action line says: give the trace id to your Moodle administrator), and no form is posted. Page with a hidden form (`JWT`, action = `target`) and a nonce script that submits it. Marks the picker used. |
| `GET /tool/register` | `registrationId`, `ref` | Checks `ref` (`pending`, not expired, not used). `GET /api/registrations/{id}`. Checks `url` origin = `siteUrl` origin (`SITE_MISMATCH`). If `operation = update`: page `UPDATE_NOT_ALLOWED` ("Go back in Moodle and choose Register as a new external tool"), always (security §2.5). Else the confirm page: site URL, Moodle version, library, "Learners are anonymous: Moodle does not send names or emails." Button "Connect". On submit the button is disabled (no second submit) and the page shows "Connecting to Moodle. This can take up to 15 seconds. Do not close this window." (B-FIX-02; the `complete` call can take 15 s, §6 failure pages). Errors: `400` page `REF_INVALID`, `REF_EXPIRED`, `SITE_MISMATCH`. |
| `POST /tool/register` | form `registrationId`, `ref` | `Origin` check (403). Calls `complete` with `privacyLevel: "anonymous"`, `autoActivate: true`, `platformName: "Cogniate (<library name>)"` (ASCII). Stores the platform (unique per connection), sets `registered`, uses up the ref. Page with a nonce script `(window.opener || window.parent).postMessage({subject:'org.imsglobal.lti.close'}, '*')` and the text "Done. Go back to Moodle and activate the tool." |
| `POST /tool/register` failure pages | — | `REGISTRATION_FAILED` (`502`): the `complete` call failed before Moodle stored a tool (for example Moodle rejected the registration, or the LTI service answered `REGISTRATION_*` or `PLATFORM_ERROR` from Moodle's answer); text: "The connection failed. Go back to Moodle and try again." `MOODLE_TOOL_MAY_EXIST` (`502`): the call failed after the registration was sent to Moodle (timeout or no answer), so Moodle may have saved a Pending tool; text: "Moodle may have saved a Pending tool. In Manage tools, delete the Pending tool 'Cogniate (<library>)', then connect again." Timing (P1, Lead decision): the app waits up to **15 s** for `complete`, longer than the LTI service's 5 s call to Moodle, so the LTI service answers first and its `tool_may_exist` reason reaches the app. If `complete` still gives no answer (timeout, no connection, or `504`), the app also shows `MOODLE_TOOL_MAY_EXIST`, never `REGISTRATION_FAILED`. In both cases the connection stays `pending` and the ref is not used up (the admin can use the same URL again until it expires). If the returned platform already belongs to another connection, the app shows `REGISTRATION_FAILED` and changes neither connection. |
| `GET /play/{playId}` | — | Player shell: course title (the shell script is served at `{PUBLIC_APP_URL}/_player/shell.js`, from the `apps/player` build), status text, "Back to Moodle" (`returnUrl`), runtime iframe `{PUBLIC_CONTENT_URL}/rt/{runtimeToken}` (sandbox and `allow`: security §7). Unknown or expired: `404` page `PLAY_NOT_FOUND`. |
| `GET /play/{playId}/embedded` | — | Text "This course opens in a new window." Button "Open in a new window" (`target=_blank`, `rel=noopener`) to `/play/{playId}`. |
| `GET /app-api/play/{playId}/status` | — | `200 { outcome, scoreGiven, scoreMaximum, preview, scoreSync: { status, scoreGiven, scoreMaximum } }`; `scoreSync` is the **newest** score sync of this learner on this activity (any attempt), with the score of that row; all three fields are `null` before the first one. Unknown id → `404`. The shell polls every 5 s. Status text (P11, Lead decision): if this attempt's score equals the synced row's score (same `scoreGiven / scoreMaximum`), the texts stay as they are (for example "Completed — score 80 sent to Moodle"). If the scores differ (this attempt 60, synced row 80): `sent` → "Completed — score 60. Moodle keeps your best score: 80"; `pending` → "Completed — score 60. Sending your best score, 80, to Moodle"; `failed` → "Completed — score 60. Your best score, 80, was not sent to Moodle"; `conflict` → unchanged ("Completed — Moodle has a grade with a newer time"). If this attempt has no score, the texts have no score of their own: `sent` → "Completed. Moodle keeps your best score: 80"; `pending` → "Completed. Sending your best score, 80, to Moodle"; `failed` → "Completed. Your best score, 80, was not sent to Moodle". Scores use the existing format (a whole number, or `n/max` when the maximum is not 100). |

Play session: `PLAY_TTL_SECONDS` (default 24 h). It holds the SHA-256 hash of the runtime token and a session id. It holds no ltik. The runtime token is derived from the play id with the app master key (HMAC); only its hash is stored, so a database copy alone cannot rebuild a runtime URL.

### 6.1 Multi-LMS rules for tool pages and the player (M1)

These rules replace the matching parts of the §6 table. For a Moodle connection every result stays the same, because its site origin is its issuer origin.

| Topic | Rule |
| --- | --- |
| Launch routing | `/tool/launch` and `/tool/deep-link` find the connection in this order: (1) a reservation for (`platform.id`, `platform.deploymentId`) whose connection is `registered` or `connected`; (2) the connection whose `lti_platform_id` is `platform.id` and that is `registered` or `connected`. None: page `UNKNOWN_PLATFORM` (`reason: unknown_platform`). |
| Site check | `platform.siteUrl` and `platform.serviceUrl` (LTI contract §9.9) must equal the connection `siteUrl` and `serviceUrl`. Else page `UNKNOWN_PLATFORM`, log `launch_rejected` or `deep_link_rejected` with `reason: site_mismatch`. No attempt, no picker. |
| Canvas embedded page | Canvas sends `documentTarget = iframe` for every launch (ADR-011 §8). For a `canvas` connection, `/play/{playId}/embedded` has a nonce script: if the page is the top-level page (`window.top === window`), it replaces the location with `/play/{playId}` at once; in a frame it shows the existing "Open in a new window" button. CSP: `frame-ancestors {site}; form-action 'none'; script-src 'nonce-…'`. Moodle and Blackboard keep the static page without script. |
| Site origin | The picker pages and `/play/{playId}/embedded` use `frame-ancestors {site}` (security §5). `POST /tool/picker/{id}` requires the returned `target` on `{site}` (`RETURN_URL_MISMATCH` otherwise). The launch return URL is kept only if it is https on `{site}`. "Back to …" without a return URL goes to `{site}/`. |
| Roles | Deep Linking needs a context staff role or an admin role. A launch is graded only with a context learner role and no context staff role; any other launch is a preview. The sets are in [ADR-011 §10](../adr/ADR-011-multi-lms.md#10-roles). Codes and log reasons stay (`ROLE_NOT_ALLOWED`, `role_not_allowed`). |
| Content item | Unchanged for `moodle`. For `canvas` and `blackboard`, if `launch.deepLinkingSettings.acceptPresentationDocumentTargets` contains `window`, the item also has `"window": { "targetName": "_blank" }`. The publication id stays in the `resource` query of the item URL; no custom parameters. |
| LMS name in texts | Every text that names Moodle (tool error pages, player "Back to Moodle", player status texts, `UNKNOWN_PLATFORM` and `ROLE_NOT_ALLOWED` actions) uses the LMS name of the connection: `Moodle`, `Canvas` or `Blackboard`. Without a connection, the name comes from `platform.profile` (`canvas-*` → Canvas, `blackboard*` → Blackboard, else Moodle). Moodle texts stay byte for byte. |
| Learner label | `Learner {sub} @ {host of the connection siteUrl}` (results, §5). |

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
| `204` | `sent`, except that a required P2 confirmation keeps the first accepted send `pending` (below). |
| `409 PLATFORM_CONFLICT` | `conflict` (no retry; "Moodle has a grade with a newer time"). A teacher override alone does **not** cause a 409: Moodle 5.2.4 accepts the score and keeps the override (`scores.php` compares times; `grade_item::update_raw_grade` does not change an overridden final grade). |
| `400`, `404`, `422` (`PLATFORM_REJECTED_REQUEST`; `422` from M1) | `failed` at once, no retry, `lastError` = description. Canvas `400` for a score older than its stored result is this case, not `conflict`. |
| `403` from the LTI service (for example `SERVICE_NOT_AVAILABLE`, `PLATFORM_NOT_ACTIVE`) | `failed` at once (a retry cannot fix it), `lastError` = the code |
| `401`, `5xx`, `502`, `504`, network error | retry: 5 s, 30 s, 2 min, 10 min, 30 min, then every 1 h until 24 h after `createdAt`, then `failed` |

When rows are made: ADR-010.

Known implementation difference, **A-T9-C01 (deferred MINOR, Lead decision 2026-10-19)**: when the line item is missing and its GET lookup repeatedly fails with a retryable error before any score POST, the implementation keeps the 5 s retry delay instead of increasing it. `tries` counts actual score POSTs, so it stays zero on this path. The 24 h window still applies, including the latest manual Resend time; the failed lookup sends no score POST. The increasing schedule above remains the policy. A future fix must count preparation retries separately from actual score POSTs.

### P2: durable bounded confirmation

This policy repairs uncertain delivery of a superseded lower score. It adds no public status or endpoint and does not change outbound timeouts.

1. Persist an in-flight marker before a score POST. Record uncertain delivery when no conclusive response arrives, or when restart finds an unresolved marker. Retain earlier uncertainty even if a later retry succeeds.
2. If an uncertain lower send is superseded, persist a confirmation requirement for the current best pending row of the same learner and activity. A still higher row inherits it. Never resend a superseded row.
3. A first `204` for a row that requires confirmation leaves it `pending`, with `sentAt = null`. Persist a due time at least 5 s after that response. The normal worker poll sends the confirmation when due.
4. Before each send and success update, check that the row is still pending and current best. If it was superseded, preserve its terminal state and the requirement for the higher row.
5. One successful confirmation `204` permits `sent` and completes the requirement. Restart must resume a pending confirmation; it must not promote the row to `sent` without the response.
6. Confirmation failures use the table above and the existing retry schedule. Keep the original retry-window start, or the latest manual Resend time. At 24 h, stop as `failed`; confirmation never extends the window.
7. Each actual POST increments `tries` and emits one `score_sync` event. Waiting does not count as a send. Restart can repeat an unacknowledged confirmation, but success must not start another confirmation loop.

All `409` responses remain terminal `conflict` until a permitted manual Resend. Do not use results-read inequality to force another send: a teacher override intentionally differs from the submitted score (AC-T5-33). The same guarded client, 5 s timeout, generated timestamps and no transport-level POST retry still apply.

The confirmation proves that Moodle accepted that delivery. It cannot prove that an arbitrarily late older request will not write afterward. This is a recorded remote-ordering limit, not a new guarantee of gradebook equality.

Recovery requires a stored marker. Migration 010 preserves old sync history and starts the new delivery fields empty; it cannot infer unresolved remote writes from before the upgrade (data-model §2).

## 11. Stretch (T8): native `.mbz` and course shell

Native `.mbz` (SCORM course versions only):

| Method and path | Request | Success / errors |
| --- | --- | --- |
| `POST /app-api/courses/:courseId/versions/:versionId/mbz` | — | `202` MbzBuild (`status: queued`). If the newest build of this version still waits or runs, `202` with that build (no new build). An HTML version → `422 MBZ_NOT_SUPPORTED`. Two builds of the library already `queued` or `running` → `409 MBZ_BUILD_LIMIT` (at most 2 active builds per library, so one library cannot fill the single build queue). |
| `GET /app-api/courses/:courseId/versions/:versionId/mbz` | — | `200` MbzBuild of the newest build, or `404` if none |
| `GET /app-api/courses/:courseId/versions/:versionId/download?kind=mbz` | — | `200 application/vnd.moodle.backup`: the **newest `ready` build of this version**, also when a newer build of the same version is `queued`, `running` or `failed` (Lead decision: a version's content never changes, so an older ready `.mbz` of the same version is still correct). `404 NOT_FOUND` when the version has no `ready` build, or when its file is not in `out/`. |

MbzBuild: `{ buildId, courseId, versionId, status, step, reason, bytes, createdAt, updatedAt, finishedAt, downloadUrl }`. `status`: `queued`, `running`, `ready`, `failed`. `step`: the current or failed step (`start`, `course`, `scorm`, `backup`, `copy`; `done` when `ready`). `reason`: plain text when `failed`; while a build is `queued` for more than 60 s, a hint why it waits (the Build Runner is not running, makes its image, or the build waits in the queue; from the runner heartbeat); else `null`. `bytes` and `downloadUrl`: set when `ready`, else `null` (so `GET .../mbz` can show a newer `queued` or `failed` build with `downloadUrl: null` while the download still serves an older `ready` build of the version). A `ready` or `failed` build does not change any more.

Build time-out (B-T8-01): a build with no progress for **10 min** becomes `failed`, so a new request starts a fresh build. "No progress" = the runner's status file for the build is not updated for 10 min, or the runner did not take the request in 10 min. The `reason` says which (for example "The Build Runner did not finish this build (no progress for 10 min). Build again."). A held build (`BUILD_RUNNER_HOLD`) is not timed out: the runner updates its status every 30 s while it waits. A build that the time-out made `failed` does not count for `MBZ_BUILD_LIMIT`.

Build Runner (host side, ADR-007, security §10a): one runner per queue (single-runner rule: lock file `infra/.data/build-queue/.runner.pid`; a second `watch`, `once` or `sweep` is refused and exits `1`; a dead pid, or a pid that is now another program, does not count). It writes a heartbeat `status/runner.json` `{ pid, startedAt, lastSeenAt, image }` (`image`: `missing`, `building`, `ready`, `failed`); the app treats a heartbeat older than 30 s as "not running". At start (and on `stack:reset`) it marks interrupted builds `failed`, removes their work folders and every leftover `cogniate-build-*` container, volume and network **of this stack** (build projects of another stack on the same Docker host are not touched). On `TERM` or `INT` during a build it removes the build project and marks the build `failed`.

Build Runner log events: JSON lines with `service: build-runner`, in `infra/.logs/build-runner.jsonl` (`stack:up` writes the runner's stdout there). `trace_id` = the build id for build events, else the runner boot id (`runner-` + 12 hex).

| Event | Level | Fields |
| --- | --- | --- |
| `runner_started` | info | `pid`, `queue` |
| `runner_refused` | error | `other_pid` (single-runner rule) |
| `runner_stopping` | info | — |
| `image_build` | info | `image` |
| `image_build_failed` | error | `image`, `detail` |
| `request_rejected` | warn | `file`, `detail` (a request file that fails the A-T8-01 checks) |
| `build_started` | info | `course_id`, `version_id` |
| `build_step` | info | `step` |
| `build_hold` | info | `hold_file` |
| `build_ready` | info | `bytes` |
| `build_failed` | warn | `step`, `reason` (also for builds that the start-up sweep or a stop marks failed) |
| `build_leftover_removed` | warn | `project` |
| `build_error` | error | `file` (an unexpected error in one build; the runner goes on with the next request) |

Course shell (web services):

| Method and path | Request | Success / errors |
| --- | --- | --- |
| `PUT /app-api/connections/:id/web-services` (Moodle only, §4.7) | `{ token }` | `200 { siteName, release, functions }` after `core_webservice_get_site_info`. `422 WS_TOKEN_INVALID` or `WS_FUNCTIONS_MISSING`. Moodle unreachable or a Moodle error → `502 MOODLE_WS_ERROR`. |
| `POST /app-api/publications` with `createMoodleCourse: { categoryId? }` (Moodle connections only, §4.7) | — | Publication with `moodleCourse { id, idnumber, url }`, `shellStatus` (`created`, `exists`, `failed`) and `shellError` (plain text when `failed`, else `null`) |

Connection field `webServices`: `{ siteName, release }` after a successful `PUT .../web-services`, else `null`. The token is stored encrypted and never returned.

Web services functions the app needs: `core_webservice_get_site_info`, `core_course_get_courses_by_field`, `core_course_create_courses`. Shell: `idnumber = cogniate:{courseId}:{variant}:{lang}`, `visible = 0`. The Moodle host is in the app's outbound allowlist for these calls (security §9).

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
| `launch_rejected` | warn | `reason`: `publication_not_in_connection`, `publication_withdrawn`, `unknown_platform`, `site_mismatch` (M1), `invalid_ltik`, `not_resource_link` (a valid deep-linking ltik on `/tool/launch`), `lti_service_error`; plus `lti_status`, `lti_code` when the LTI service answered with an error |
| `launch_accepted` | info | `attempt_id`, `preview` |
| `resource_link_rebound` | info | `resource_link_id`, `from_publication`, `to_publication` |
| `deep_link_rejected` | warn | `reason`: `not_deep_linking` (the ltik is not a deep-linking launch), `role_not_allowed`, `invalid_ltik`, `unknown_platform`, `site_mismatch` (M1); plus `lti_status`, `lti_code` when the LTI service answered with an error |
| `picker_rejected` | warn | `reason`: `not_found`, `used`, `expired`, `publication_not_available`, `lti_service_error`, `return_url_mismatch`; plus `lti_status`, `lti_code` when the LTI service answered with an error |
| `retention_cleanup` | info | `table`, `deleted` |
| `platform_orphan_deactivated` | warn | `platform_id` |
| `platform_orphan_deactivate_failed` | error | `platform_id`, `error` (the LTI service code or the error class name) |
| `registration_confirm_rejected` | warn | `code` (incl. `REGISTRATION_FAILED`, `MOODLE_TOOL_MAY_EXIST`, `UPDATE_NOT_ALLOWED`) |
| `commit_accepted` | info | `session_id`, `seq`, `commit_event`, `stale` (true for a late `finish` or `unload`) (`commit`, `finish`, `unload` or `progress`; the field is not called `event`, because every log line already has `event`) |
| `internal_error` | error | `method`, `path` (no query, no capability ids), `error` (the error class name only, for example `TypeError`). No error message with data and no stack trace in the JSON file (stdout may print the stack at `debug`). The response is `500 INTERNAL_ERROR` with the trace id. |
| `commit_rejected` | warn | `code`, `field` |
| `outcome_changed` | info | `attempt_id`, `outcome` |
| `score_sync` | info | `sync_id`, `status`, `tries`, `phase` (`send` or `confirmation`). `status` is the persisted row status. When the first accepted P2 send stays pending, include `send_result: "sent"`. When a send ends after its row was superseded (ADR-010 rule 5), the row stays `superseded` and the line has `status: "superseded"` plus `send_result` = the status that the send would have set (`sent`, `pending`, `conflict` or `failed`) (B-FIX-01). One event per actual POST. |
| `grant_issued` | info | `grant_id`, `connection_id`, `purpose`, `expires_at` (§4.8; M1) |
| `grant_revoked` | info | `grant_id` (§4.8; M1) |
| `grant_redeemed` | info | `grant_id`, `connection_id`, `purpose`, `platform_id`, `deployment_id` (§4.7; M1) |
| `grant_rejected` | warn | `reason` (§4.7; M1), `connection_id` |
| `deployment_orphan_deactivated` | warn | `platform_id`, `deployment_id` (§4.4; M1) |
| `deployment_orphan_deactivate_failed` | error | `platform_id`, `deployment_id`, `error` (M1) |
| `gradebook_refresh_failed` | warn | `publication_id`, `resource_link_id`, `lti_status`, `lti_code` (one per row that "Refresh from Moodle" could not read) |
