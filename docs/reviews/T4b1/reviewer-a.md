Verdict: APPROVE
Round: 2

# Reviewer-A: T4b1 review (lens: "Is it right and is it safe?")

History: the round 1 verdict was APPROVE (findings below). The round 2 verdict is APPROVE (section "Round 2" at the end).

## Round 1

Scope:

- `git diff 6f03a80 1ec7cde -- . ':!docs' ':!tests'`:
  - connections (dynamic + manual) and publications;
  - `GET`/`POST /tool/register`;
  - the typed LTI client and the secret mount;
  - the T3b registration-UX items in the LTI service.
- Spec: `tasks/T4b1.md`, app contract §4–§6 and §12 (including the Architect's commit `c415b64`), `security.md` §2.5, §5, §6 and §8.

Method:

- I read all the code.
- Read-only live checks:
  - an unknown-ref error page;
  - `POST /tool/register` with a foreign `Origin`, `null` and none (all rejected before any other work);
  - the container mounts and key file modes;
  - `cogniate.db` (SQLite `mode=ro`) and the app log.
- I did not read `reviewer-b.md`.

Counts: 0 BLOCKER, 0 MAJOR, 1 MINOR, 1 NIT.

## The Architect's rule (`c415b64`): "if the returned platform already belongs to another connection → `REGISTRATION_FAILED`, neither connection changes"

**Enforced in the app.**

- `markRegistered` first runs `SELECT id FROM connection WHERE lti_platform_id = ? AND id <> ?`. If a row exists, it throws `PlatformTakenError`, and `POST /tool/register` shows `REGISTRATION_FAILED` before anything is written.
- The column `connection.lti_platform_id UNIQUE` is a second barrier.
- The bind is a conditional `UPDATE … WHERE status = 'pending'`, so two confirms with the same ref cannot both bind.

**Limit:** "neither connection changes" is true for the **app's** connections only. When the check fails, the LTI service has already stored the platform, and Moodle has a Pending tool. See A-T4b1-01.

## Verified

| Area | Result |
| --- | --- |
| **Register page headers** (security §5) | Confirm form: `frame-ancestors {connection siteUrl}; form-action 'self'; script-src 'nonce-…'`. Close page: `form-action 'none'` and a nonce script for `org.imsglobal.lti.close`. Error pages: `frame-ancestors https:; form-action 'none'`. All pages: `Referrer-Policy: same-origin`, `no-store`, `nosniff`, no `X-Frame-Options`, no `Set-Cookie`. Live: an unknown ref → `400`, `data-error-code="REF_INVALID"`, `data-trace-id`, `frame-ancestors https:`. All untrusted text (site, Moodle version, library name, hidden form values) is escaped. |
| **Origin rule** (security §6) | `POST /tool/register` checks `Origin === PUBLIC_APP_URL` **first**. Live: `https://evil.test`, `null` and no `Origin` → `403 ORIGIN_NOT_ALLOWED`, and `csrf_rejected` is logged. The ref is checked again in the POST, and the platform is bound only by the conditional update. |
| **Ref token** | 32 random bytes (43 characters). The table keeps its SHA-256 for lookup and an AES-256-GCM copy (`APP_MASTER_KEY`, only in `cogniate-app`) so the portal can show the URL again while the connection is pending. Single use: both are set to `NULL` when the connection is registered or disabled. A new URL replaces the old ref. The TTL is checked. Live DB: pending dynamic rows hold hash + BLOB (no plaintext ref in the BLOB), and registered rows hold neither. A replay → `REF_INVALID`. |
| **Site and update checks** | `SITE_MISMATCH`: the registration `url` (the issuer, which the LTI service already checked against the configuration URL) must equal the connection `siteUrl`. `isUpdateAllowed`: an update needs `existingPlatformId === connection.ltiPlatformId`, and only then does the app send `updatePlatformId`. So library B cannot update library A's tool (AC-T4-30). |
| **Tenant isolation** | Every connection query has `library_id`. The ref lookup works across libraries, because the ref itself is the capability. Publications check both the connection **and** the course against the session library, and every SQL join has `con.library_id = ? AND c.library_id = ?`. Another library gets 404. |
| **App → LTI client and secrets** | The API key file is read at each use. `cogniate-app` mounts only `infra/.secrets/app` (read-only): live `/run/secrets/app` `rw=false`, folder mode 700, file mode 600. `seed.json` and the `qa-second` key are not visible. Every call sends `X-Trace-Id`, goes through the guarded outbound client, and builds ids with `encodeURIComponent` (the registration id is also limited to `^[A-Za-z0-9_-]{1,64}$`). LTI failures → `502 LTI_SERVICE_ERROR` with the trace id. Live log: no API key, no ref, no 43-character token. |
| **Manual platform values** (SSRF) | The app checks https, issuer origin = `siteUrl`, and the auth, token and JWKS URLs on the issuer origin. The LTI service checks the same rules again, and every fetch goes through the outbound guard. |
| **T3b items in the LTI service** | `tool_may_exist` after a timeout, network error, 5xx, `token_already_used` or an unreadable 2xx → the app page `MOODLE_TOOL_MAY_EXIST` (resolves A-T3b-01). A message `target_link_uri` must be our launch URL. The registration token is set to `NULL` on completion (resolves A-T3b-03). |

---

## MINOR

### A-T4b1-01 — MINOR — Unbound ("orphan") platforms stay active, and a manual connection of any library can take one over

- **Location:**
  - `services/cogniate-app/src/app/connections.ts:179-184` (`PLATFORM_ALREADY_EXISTS` → adopt the existing platform);
  - `tool-pages/register.ts:120-133` (`REGISTRATION_FAILED` after a successful `complete`).
- **Problem:** An LTI platform that no connection holds is left **active** in the LTI service. `PUT /connections/:id/platform` then adopts any such platform for any library that sends its issuer and client id, with no proof that the platform belongs to that library.
- **Evidence:**
  - Orphans appear on documented paths:
    - The registration URL is opened in two tabs and both are confirmed. The second `complete` succeeds in the LTI service and Moodle, then `markRegistered` → `PlatformTakenError` ("connection is not pending") → `REGISTRATION_FAILED`. The result is a second Pending Moodle tool with the **same name** and an active, unbound platform.
    - The dev seed platform "Cogniate (seed)" is never bound to a connection.
  - Client ids are not secret: every learner sees `aud` in the auto-submitted `id_token` form.
  - So a library B user can make a manual connection for that Moodle site and `PUT` the orphan's issuer and client id. The app gets `409 PLATFORM_ALREADY_EXISTS` from the LTI service, finds the platform, and `markRegistered` binds it, because no connection holds it.
  - If the admin activated that Pending tool (it has the same name as the real one), its launches then go to library B. Without the takeover, every launch of that tool fails with "not available", and the page text "The connection failed. Go back to Moodle and try again." is wrong, because the other tab did connect.
- **Fix:**
  - In `PUT …/platform`, refuse `PLATFORM_ALREADY_EXISTS` (`422 INVALID_PLATFORM_VALUES`, "This Moodle tool is already registered with Cogniate"), with no adoption. A retry after a crash can use a new Moodle tool.
  - When `POST /tool/register` refuses a platform that the LTI service just created (`PlatformTakenError`), set it inactive (`PATCH /api/platforms/:id {active:false}`). For the "connection is not pending" case, show a specific page: "This connection is already registered. Delete the extra Pending tool 'Cogniate (<library>)' in Moodle."
  - Do not seed an unbound active platform in `default` stacks, or mark it inactive.

## NIT

### A-T4b1-02 — NIT — The "re-connect" update path can never be allowed

- **Location:** `services/cogniate-app/src/tool-pages/register.ts:40-43, 64, 126`; `domain/connections.ts` `refreshPlatform`.
- **Problem:** `check()` accepts only a `pending` dynamic connection, and a pending connection has no `ltiPlatformId`. So `isUpdateAllowed` is always false for an update, and every "update" shows `UPDATE_NOT_ALLOWED`. `refreshPlatform` is unreachable.
- **Evidence:** This is safe (it is the strictest outcome). But security §2.5 and app contract §6 describe an allowed update for "the platform of the same connection (a re-connect)".
- **Fix (Architect):** Either remove the re-connect promise and `refreshPlatform`, or define how a `registered` connection gets a re-connect URL (a new ref for registered connections, valid only for `operation = update` of its own platform).

---

## Round 2

Verdict (round 2): APPROVE

Input: `git diff 1ec7cde 0fc5e33 -- . ':!docs' ':!tests'` and the new rules (security §2.6, app contract §4, commit `2cf7d33`). I did not read `reviewer-b.md`.

Round 2 counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 1 NIT (A-T4b1-03).

| Round 1 id | Status | Evidence |
| --- | --- | --- |
| A-T4b1-01 (MINOR) | Resolved | **Manual:** `PLATFORM_ALREADY_EXISTS` → `409 PLATFORM_IN_USE`, so there is no adoption, and only a platform created in this call is bound. If the bind then fails (`PlatformTakenError`), `deactivateOrphan` switches that new platform off. A repeat of the same successful PUT gives `200` and changes nothing. **Dynamic:** if `complete` returned a platform id and the bind fails (another connection holds it, or the connection is no longer pending, for example the two-tab case), `deactivateOrphan` sets the platform inactive only when **no** connection owns it, and logs `platform_orphan_deactivated`. An owned platform is never touched. No orphan scan at start: accepted, because it would switch off the seed and QA platforms. |
| A-T4b1-02 (NIT) | Resolved | `check()` returns `UPDATE_NOT_ALLOWED` for every `operation = update`, and `refreshPlatform` and `isUpdateAllowed` are gone. Re-connect = delete the Moodle tool, disconnect, connect again (security §2.5). |
| New: `lastError` | Safe | It stores only codes (`code`, `ltiCode`), the trace id and the time, and only for a pending connection. It is cleared on success. |

**The Author's open edge.** Can library B adopt library A's orphan through a "new" registration that returns an existing platform? With a standard Moodle 5.2, no:

- `startltiadvregistration.php` puts a **new** client id into every `scope = reg` token (`new_clientid()`, `random_string(15)`).
- `openid-registration.php` creates the type with that id.
- A reused token is refused: `registration_helper.php:381-385`, `token_already_used`, which the LTI service maps to `tool_may_exist` (no platform id comes back).
- A retry after our own success finds the session completed (`409 REGISTRATION_ALREADY_COMPLETED`).

So the LTI fallback "`PlatformExistsError` on `new` → update the existing platform" (B-T3b-02) is reached only when the **platform** returns a client id that we already have for the same issuer. Only a misbehaving Moodle can do that, in practice that site's own administrator, who controls the site's tools anyway. **Accepted as a residual risk**, with one hardening point (A-T4b1-03).

### A-T4b1-03 — NIT — The B-T3b-02 fallback switches a deactivated orphan back on

- **Location:** `services/lti-service/src/http/routes/registration.ts` (the `PlatformExistsError` branch → `applyRegistrationUpdate` with `active: autoActivate ?? true`).
- **Problem:** On the edge above, the existing platform gets `active = true` again, also when the app had switched it off as an orphan. If no connection owns it, the app then binds it to the requesting library.
- **Fix:** In that branch, keep the stored `active` value (never re-activate). Or answer `502 PLATFORM_ERROR` ("the platform returned the client id of an existing registration"), as A-T3b-02 suggested. Either one closes the edge, even for a misbehaving platform.
