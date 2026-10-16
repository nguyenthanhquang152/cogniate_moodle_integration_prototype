Verdict: CHANGES_REQUESTED
Round: 1

# Reviewer-A: T0 design review (lens: "Is it right and is it safe?")

Scope: everything under `docs/architecture/` (README, ADR-001 to ADR-010, both contracts, rea-evaluation, open-questions, tasks T1 to T8).

Method:

- I checked Moodle claims in the Moodle 5.2.4 source (`/tmp/cogniate-moodle-src/moodle`). In this file, paths such as `mod/lti/auth.php` are relative to `public/`.
- I read the vendored `scorm-api.js`, the manifest and the HTML export. I unzipped each one into its own new temp folder.
- I compared the LTIAAS claims with `.research_cache/ltiaas_docs/`.
- I ran two small local browser tests (my own scripts, headless Chrome 155) for the two BLOCKERs.
- I did not use the live Moodle. I did not read `reviewer-b.md`.

Counts: 2 BLOCKER, 6 MAJOR, 8 MINOR, 2 NIT.

## Answers to the five review questions

1. **End to end on Moodle 5.2.** On the Moodle side the design works. I checked registration, Deep Linking, launch, AGS and completion in the source (see "Verified as correct"). Three steps fail as written:
   - The registration "Connect" POST fails (A-T0-02).
   - The picker POST fails (A-T0-02).
   - The package page does not load in the player (A-T0-01).

   Framing of the tool pages is not specified (A-T0-07). Production clock skew breaks Deep Linking and AGS tokens (A-T0-06).
2. **LTI security model.**
   - The 12 launch checks and the Deep Linking response claims are complete and correct for LTI 1.3 Core and the Security Framework. The AGS scope rule and the line item origin rule are also correct.
   - The gaps are in the routing and binding around the checks: A-T0-03, A-T0-04, A-T0-05 and A-T0-08.
   - The cookie and iframe analysis is correct. The state cookie needs `SameSite=None; Secure; Partitioned`. Deep Linking always runs in an iframe. Moodle handles its own Lax cookie with `repost_crosssite_page`. Moodle 5.2 has no LTI client-side storage. One error text is wrong (A-T0-12).
3. **SCORM 1.2 and grades.**
   - For this package, these parts are correct: the 301 probe, "first answer stands", the package's own `LMSFinish`, mastery 70, and the outcome mapping.
   - The timestamp rule (+1 s) matches Moodle's 409 rule. "Send only FullyGraded" is correct, because Moodle sets the score to null otherwise.
   - I found no way to get a duplicate grade. Moodle keeps the latest score, and a resend sends the same value.
   - A score can be lost or lowered in edge cases (A-T0-09). Version changes are not defined (A-T0-10). Three SCORM details differ from the RTE and from Moodle (A-T0-15).
4. **Acceptance criteria.** The happy path is well covered. Each MAJOR finding asks for a new AC. A-T0-16 lists the other cases that have no test.
5. **rea and the legal framing.** The `rea` verdict is correct: we have no artifact, the ToS applies after a sign-up, and the public docs give the interface. The "clean-room" claim needs a written process (A-T0-14). Some compatibility claims are not accurate (A-T0-13).

---

## BLOCKER

### A-T0-01 — BLOCKER — The CSP on package files blocks the package page in the player

- **Location:**
  - `README.md` §9.5, row "Framing"
  - `contracts/cogniate-app-api.md` §7, `GET /pkg/{packageId}/{path}`
  - `tasks/T5.md`, AC-T5-01
- **Problem:** Package files send `frame-ancestors https://content.cogniate-content.test`. CSP checks **every** ancestor, and the top ancestor is the player shell on `https://app.cogniate.test`. So the browser blocks every package page.
- **Evidence:**
  - CSP Level 3, `frame-ancestors`, navigation response check: the algorithm walks up "while current is a child navigable". It returns "Blocked" when the origin of any container document does not match.
  - Local test (Chrome 155): a shell on origin A frames a runtime on origin B (`frame-ancestors A`), and the runtime frames two pages on B. The page with `frame-ancestors B` did not run its script. The page with `frame-ancestors B A` ran.
  - So AC-T5-04, AC-T5-07 and AC-T5-09 fail: no SCO runs, so there is no tracking. AC-T5-01 asserts the wrong value.
- **Fix:**
  - For `/pkg/*`, send `frame-ancestors https://content.cogniate-content.test https://app.cogniate.test`.
  - Update README §9.5, contract §7 and AC-T5-01.
  - In AC-T5-04 and AC-T5-09, assert that the package page's own script runs. For SCORM: `CogniateSCORM.available === true`. For HTML: the runtime can read `body[data-lesson-id]` of the child page.

### A-T0-02 — BLOCKER — `Referrer-Policy: no-referrer` makes the browser send `Origin: null`, and the CSRF rule rejects `null`

- **Location:**
  - `contracts/cogniate-app-api.md` §6: the intro, `POST /lti/register` and `POST /lti/picker/{pickerId}`
  - `README.md` §9.4 "CSRF", second bullet
- **Problem:** Tool pages send `Referrer-Policy: no-referrer`. So the browser sends `Origin: null` on the form POSTs of these pages. The design returns 403 for `null`, so the "Connect" button and the content picker cannot work.
- **Evidence:**
  - Fetch Standard, "append a request `Origin` header": for a non-CORS request with a method other than GET or HEAD, the policy `no-referrer` sets the origin to `null`.
  - Local test (Chrome 155): a same-origin form POST from a page with `Referrer-Policy: no-referrer` arrived with `Origin: 'null'`. With `Referrer-Policy: same-origin`, it arrived with the real origin.
  - Moodle does not sandbox these iframes (`mod/lti/amd/src/tool_configure_controller.js:130`, `mod/lti/templates/contentitem.mustache:52`). So our header is the only cause.
  - So AC-T4-08, AC-T4-15, AC-T7-02 and AC-T7-03 fail.
- **Fix:**
  - Send `Referrer-Policy: same-origin` on tool pages. Capability ids then stay out of cross-origin `Referer` headers, and same-origin POSTs keep a real `Origin`.
  - Keep the strict `Origin` rule.
  - Add an AC:
    - A picker POST with `Origin: https://evil.test` gives 403.
    - A picker POST with `Origin: null` gives 403.
    - A real click on the page works.

---

## MAJOR

### A-T0-03 — MAJOR — The app launch handoff trusts an unsigned URL parameter (`resource`), and the handoff can be replayed

- **Location:**
  - `contracts/cogniate-app-api.md` §6: `GET /lti/launch` and `POST /lti/picker/{pickerId}`
  - `contracts/lti-service-api.md` §2.2 (Location rule)
  - `README.md` §6c and §9.6
- **Problem:** The app reads the publication from the `resource` query parameter of its own URL, and the learner can change that URL. So a learner can point a Moodle activity to another course of the same connection, or send a grade for a course that they did not take.
- **Evidence:**
  - §2.2 copies the query of `target_link_uri` into `{launchUrl}?…&ltik=`. The signed value is `launch.target` from `GET /api/idtoken` (§3.1). But §6 uses the query parameter `resource`.
  - The ltik is valid for 24 h (ADR-003 P6), and §6 does not make the handoff single use. A learner can copy the ltik from the browser network panel and open `/lti/launch?resource=<other publication>&ltik=<own ltik>`. The check "publication belongs to connection" passes.
  - README §8.2 gives no unique key for the upsert of `RESOURCE_LINK`. If the key is (deployment, context, resource link), then `publication_id` changes for **all** learners of that activity. If not, the new attempt sends its score to the `lineItemId` of the original activity.
  - Another person who opens the same URL within 24 h starts a play session on the first learner's attempt. This is session fixation.
  - `POST /lti/picker` does not check that each `publicationId` belongs to the connection of the picker. Only the GET list is filtered.
- **Fix:**
  1. Read the publication only from `launch.target`, or from a `custom` claim that the content item sets. Ignore the query parameter.
  2. Bind `resource_link_id` to the publication at the first launch. Use the unique key (connection, `deployment_id`, `context_id`, `resource_link_id`). If a later launch does not match, show the "not available" page.
  3. Make the app handoff single use per ltik: a second GET shows an error page.
  4. On the picker POST, check again that each id is a publication of the picker's connection and is not withdrawn.
  5. Add one AC for each of items 1 to 4.

### A-T0-04 — MAJOR — Login routing uses (iss, client_id) for all accounts, but the uniqueness rule is per account

- **Location:**
  - `README.md` §8.1 (unique keys) and §9.6
  - `contracts/lti-service-api.md` §2.1 and §3.9
  - ADR-003, "Protocol endpoints"
- **Problem:** Two tool accounts can register the same (issuer, client_id). The shared `/lti/login` and `/lti/launch` cannot tell them apart. So one account can take or break the launches of another account.
- **Evidence:**
  - The unique key is `platform(tool_account_id, issuer, client_id)` (README §8.1).
  - §2.1 says: "The platform is found by (`iss`, `client_id`)". Login and launch have no account in the path. Keys and registration do have one (`/lti/keys/{account}`, `/lti/register/{account}`).
  - Client ids are not secret. Every learner can see `aud` in the auto-submitted `id_token` form.
  - AC-T2-02 tests only that `qa-second` cannot **read** the platform. No AC tests a duplicate registration.
- **Fix:**
  - Put the tool account id in the protocol paths (`/lti/login/{toolAccountId}`, `/lti/launch/{toolAccountId}`), or make (issuer, client_id) unique across all accounts.
  - Add an AC: `qa-second` sends `POST /api/platforms` with the `cogniate` pair and gets 409. The `cogniate` launch still works.

### A-T0-05 — MAJOR — The design does not handle the "update existing tool" choice in Moodle dynamic registration

- **Location:**
  - `README.md` §6a-1, notes
  - ADR-009, "Consequences"
  - `contracts/lti-service-api.md` §2.4 and §3.8
  - T3, T4, T7 (no AC)
- **Problem:** The admin of a second library can choose "update" on Moodle's choice page. Moodle then overwrites the first library's tool and returns its client id. The design does not say what the LTI service and the app do next.
- **Evidence:**
  - `mod/lti/startltiadvregistration.php`: when `lti_get_tools_by_url()` finds a tool on the same domain, Moodle shows `registration_upgrade_choice_page`. If `type > 0`, the registration token has `scope = reg-update` and `sub = <type id>`.
  - `mod/lti/openid-registration.php`: for an existing type, it calls `lti_update_type()` and returns the existing `client_id`.
  - `registration_helper::registration_to_config()` resets the name, the URLs, the privacy settings, `launchcontainer` (embed) and `coursevisible` (preconfigured only).
  - All Cogniate tools use the domain `lti.cogniate.test`, so every second library sees this choice page.
  - Possible results:
    - The second connection binds to the first library's platform. Two libraries then share one `platform.id`, and the picker can show the wrong library.
    - Or our service returns 409 after Moodle already changed the first library's tool.
- **Fix:**
  - `GET /api/registrations/:id` returns the operation (`new` or `update`, from the token `scope`) and the existing `platformId`.
  - The app accepts `update` only for the same connection (a re-connect). Otherwise it shows "Choose Register as a new tool", and the service does not post to Moodle.
  - Keep `connection.lti_platform_id` unique.
  - Add an AC that uses the choice page.

### A-T0-06 — MAJOR — The JWTs that we send to Moodle use `iat = now`, but Moodle allows no clock skew

- **Location:**
  - `README.md` §9.2, "Deep Linking response" and "Service calls to Moodle"
  - `contracts/lti-service-api.md` §4
- **Problem:** Moodle rejects our Deep Linking response and our client assertion when our clock is ahead of the Moodle clock, even by part of a second.
- **Evidence:**
  - `lib/php-jwt/src/JWT.php:41`: `$leeway = 0`. Line 166 throws `BeforeValidException` when `floor(iat) > now + leeway`.
  - `lti_verify_jwt_signature()` (`mod/lti/locallib.php:1363`) decodes with this library. `contentitem_return.php` (through `lti_convert_from_jwt`, `locallib.php:3447`) and `token.php` both use it.
  - Moodle compares whole seconds. So if our clock is ahead by d seconds (d < 1), about d of every second fails. Self-hosted Moodle servers often drift. The dev stack shares one host clock, so the E2E cannot find this.
  - On our side, README §9.2 allows 60 s of skew. Spec §10 says "five-minute clock skew". This difference is not written down.
- **Fix:**
  - On the Deep Linking response and the client assertion, set `iat = now − 30 s` (no `nbf`) and `exp = now + 300 s`.
  - Add a unit test with a fake clock that is 2 s ahead.
  - Record the 60 s choice as a difference from spec §10, or use 300 s.

### A-T0-07 — MAJOR — The design does not define which origins may frame the tool pages, or where their forms may post

- **Location:**
  - `contracts/cogniate-app-api.md` §6, intro
  - `README.md` §9.4
  - `tasks/T4.md`, AC-T4-21
  - ADR-005, "Launch container"
- **Problem:** Moodle frames the tool pages, and the picker posts to Moodle. The design does not set `frame-ancestors` or `form-action` for these pages. Common secure defaults break both flows, and a loose value allows clickjacking.
- **Evidence:**
  - Moodle frames the registration page (`mod/lti/amd/src/tool_configure_controller.js:130`) and "Select content" (`mod/lti/templates/contentitem.mustache:52`).
  - The picker result page submits to `…/mod/lti/contentitem_return.php`, which is cross-origin.
  - The usual helmet defaults are `frame-ancestors 'self'`, `form-action 'self'` and `X-Frame-Options: SAMEORIGIN`. Each one breaks these pages.
  - Dynamic registration always sets embed (`LTI_LAUNCH_CONTAINER_EMBED_NO_BLOCKS` in `registration_helper.php`). Until the admin edits the tool, launches open in an iframe. In Chromium the partitioned cookie works, so such a launch reaches `/play` inside Moodle. The design does not say what happens then.
- **Fix:**
  - Define the policy for each page, and test it in AC-T4-21:
    - `/lti/register`: `frame-ancestors <origin of the connection siteUrl>`.
    - `/lti/picker/*`: `frame-ancestors <platform issuer origin>`. On the result page, `form-action <origin of deep_link_return_url>`.
    - `/play/*`: `frame-ancestors 'none'`. If `launch.presentation.documentTarget` is `iframe`, show a page with an "Open in a new window" button instead of the player.
  - Do not send `X-Frame-Options` on pages that Moodle frames.

### A-T0-08 — MAJOR — Platform URLs can go around the SSRF guard

- **Location:**
  - `tasks/T2.md`, "Design notes", first bullet
  - `README.md` §9.7
  - `contracts/lti-service-api.md` §3.9
  - `contracts/cogniate-app-api.md` §4, `PUT /app-api/connections/:id/platform`
- **Problem:** T2 tells the Author to use `jose` `createRemoteJWKSet`, which uses its own HTTP client. Manual platform URLs also do not have to be on the issuer origin. So a tenant can make the LTI service send requests to internal hosts.
- **Evidence:**
  - README §9.7 says: "All outbound HTTP goes through one client". T2 says "Use `jose` `createRemoteJWKSet` per platform" and gives no fetch hook.
  - §3.9 checks only "All URLs must be https". The app checks only "issuer origin = `siteUrl`". A library user can set `jwksUrl` or `accessTokenEndpoint` to any https host. A login and launch from a fake platform then make the service fetch that URL.
  - AC-T3-05 covers only `openid_configuration`. No AC covers the JWKS URL or the token URL.
- **Fix:**
  - Fetch the platform JWKS with the guarded client. Use the jose custom fetch option, or our own fetch plus `createLocalJWKSet` with our cache rules.
  - Require `authenticationEndpoint`, `accesstokenEndpoint` and the JWKS URL to be on the issuer origin. Moodle puts `auth.php`, `token.php` and `certs.php` under wwwroot.
  - Add an AC: a platform with `jwksUrl https://169.254.169.254/x` gives 400 at create, and the service sends no outbound request.

---

## MINOR

### A-T0-09 — MINOR — The score sync rules can drop the best score, and the portal can show a result that differs from Moodle

- **Location:** ADR-010 rules 4, 6 and 7; `README.md` §7 "Score sync"; `contracts/cogniate-app-api.md` §10.
- **Problem:** The "better" test compares only with the last **sent** value, and any newer row supersedes a pending row. So during an outage, a lower result can replace a better score that is still pending.
- **Evidence:**
  - Rule 4 says: "again only when the new scoreGiven / scoreMaximum is higher than the last sent value". Row 1 (100) is pending while Moodle is down, so nothing was sent yet. A later terminal commit (0, for example from a second window) makes row 2, and row 1 becomes `superseded`. Moodle then gets 0.
  - Rule 6 maps `409` to `superseded`, even when no newer row exists. In Moodle a 409 means that the stored grade time is the same or newer (`scores.php`, `get_json_for_post_request()`). This happens after a teacher override or a reset of `SCORE_CLOCK`.
  - Rule 7: retries stop after about 43 min and the row becomes `failed`. There is no resend action, although the service key never expires.
  - AC-T5-12 checks only the gradebook. After that AC, the portal can show `failed` while Moodle shows 100.
- **Fix:**
  - Compare with the best value of all rows that are pending or sent. Supersede a row only with a better payload.
  - Map 409 to a visible `conflict` state.
  - Retry for longer (for example 24 h), and add "Resend" in the results view.
  - Show the best outcome of the attempt in the portal.
  - Add an AC: stop Moodle, pass (row pending), send a fail commit, start Moodle. The gradebook must show 100.

### A-T0-10 — MINOR — The design does not say what a new course version does to existing attempts

- **Location:** `README.md` §8.2 `ATTEMPT.course_version_id`; `contracts/cogniate-app-api.md` §5 `POST /app-api/publications` ("version updated"); `open-questions.md` Q13.
- **Problem:** A new version changes what a launch runs. The design does not say which version an existing attempt uses, or what happens to its saved progress.
- **Evidence:**
  - Spec §9.4, "Assessment change", live link column: "New attempts use the new version". The design has one attempt per (resource link, user), for all time.
  - HTML commits may use only keys from `profile.pages` and `profile.questionIds` (contract §7, "Server checks"). If the profile changes, the saved progress can fail validation on every commit (400).
  - The SCORM package clears its answers when the question fingerprint changes (`scorm-api.js`, `reconcileWithPreviousVersion`).
- **Fix:** Keep each attempt on its `course_version_id`, and use the new version only for new attempts (spec §9.4). Or define a migration (drop unknown keys). Add one AC.

### A-T0-11 — MINOR — A multi-select in the picker loses the completion setting

- **Location:** `contracts/cogniate-app-api.md` §6, `GET /lti/picker/{pickerId}` ("checkboxes if `acceptMultiple`"); `tasks/T7.md`, Scenario A step 4.
- **Problem:** Moodle always sends `accept_multiple = true`. When more than one item comes back, Moodle hides the activity form, so the teacher cannot set "Receive a grade".
- **Evidence:**
  - `mod/lti/auth.php` calls `lti_build_content_item_selection_request(…, false, true, …)`, which means `$multiple = true`.
  - `mod/lti/amd/src/contentitem.js`, `showMultipleSummaryAndHideForm()`, hides every child of the form and posts the same form data for each item.
  - T7 adds one course at a time, so the E2E does not find this.
- **Fix:** In the prototype, always use single select (radio buttons). Or tell the teacher in the picker to set completion on each activity after save. Add an AC or a guide note.

### A-T0-12 — MINOR — Some launch error paths are missing or give wrong advice

- **Location:** `contracts/lti-service-api.md` §2.2; `README.md` §9.4.
- **Problem:** Moodle can post an OIDC error with no `id_token`, and the design does not handle it. Also, the "open in a new window" text is wrong for Deep Linking, which always runs in an iframe.
- **Evidence:**
  - On a failure, `mod/lti/auth.php` sets `$params['error']` (and `error_description`): `invalid_scope`, `unauthorized_client`, `access_denied`. It still auto-posts the form with `state` to our `redirect_uri`. §2.2 has no error code for this case.
  - The `STATE_COOKIE_MISSING` page asks the admin to set "New window". That setting does not change `contentitem.php`, which always uses the iframe.
- **Fix:**
  - When `error` is present: use up the state, and show `PLATFORM_ERROR` with the OIDC code.
  - Check the signature first. Then choose the error text by `message_type`. For Deep Linking, say: "Your browser blocks cookies in Moodle's content dialog. Use Chrome, Edge or Firefox, or allow cookies for this site."

### A-T0-13 — MINOR — Some LTIAAS compatibility claims do not match the public docs

- **Location:**
  - ADR-003 tables
  - `contracts/lti-service-api.md` §1.2, §3.1, §3.6, §3.8 and §3.9
  - `rea-evaluation.md`, "What this means for the product"
- **Problem:** Some "the public docs say" and "same as LTIAAS" statements are wrong. So the promise "a tool works after two changes" is too strong.
- **Evidence** (files in `.research_cache/ltiaas_docs/`):
  1. No file has the path `/api/deeplinking/message`. The reference page (`api_post-api-deeplinking-message.txt`) also says `/api/deeplinking`. So the row "the guide and the reference use different paths" is wrong. The alias does no harm.
  2. `api_get-api-registrations.txt` shows only the `registrationID` parameter and no path. Mark these paths "path is ours", as for platforms.
  3. `api_post-api-registrations-complete.txt` says `privacyLevel` is "One of public (default)". We use `anonymous` as the default. This is the right choice for privacy, but it is a difference.
  4. For scores GET, the docs have `next`, `prev`, `first` and `last` (`guides_api_manipulating-grades.txt`). §3.6 has only `next`.
  5. `api_get-idtoken.txt` marks `resourceLink` as "object required". §3.1 leaves it out for Deep Linking.
  6. The docs say `authConfig.method` "MUST be one of JWK_SET, JWK_KEY or RSA_KEY". We accept only `JWK_SET`.
  7. The docs describe `publicKey` as "Platform public key". §3.9 uses it for the **tool** key.
  8. The docs show an API key as a UUID. §1.2 fixes the format `ltis_` + 43 characters. ADR-003 "What we do not promise" lists only the ltik and service key formats.
- **Fix:**
  - Correct the ADR-003 rows.
  - Add a table "Differences from the public LTIAAS API" for items 3 to 8.
  - Make the promise exact: "works after two changes, except for the items in the differences table".

### A-T0-14 — MINOR — The "clean-room" process is not defined

- **Location:** ADR-001 "Clean-room rules"; ADR-002 "Consequences"; `rea-evaluation.md` "What we do instead".
- **Problem:** The documents say "clean-room" but do not say who may read the LTIAAS docs or the `ltijs` source. So we cannot show the claim to a lawyer.
- **Evidence:**
  - Every role can open `.research_cache/ltiaas_docs/`. The only rule is "do not copy" (CLAUDE.md, charter §7).
  - ADR-002 lets the Author read `ltijs` source (by the LTIAAS author). Its own table says "Built from 1EdTech specs only".
- **Fix:**
  - Write the process:
    - Only the Architect reads the LTIAAS docs and puts the names into the contract.
    - The Author and QA work from the contract and the 1EdTech specs. They do not open `.research_cache/ltiaas_docs/` or the `ltijs` source.
    - Keep a short provenance log.
  - Or do not use the term "clean-room". Say "independent implementation of the public interface".
  - Keep Q1 for legal review.

### A-T0-15 — MINOR — Three SCORM 1.2 details differ from the RTE and from Moodle's own player

- **Location:** ADR-010 mapping table (`in_progress` row); `contracts/cogniate-app-api.md` §7 ("On `finish` or `unload`…") and §8; `tasks/T5.md` AC-T5-05.
- **Problem:** Three small rules give a different result from SCORM 1.2 in Moodle.
- **Evidence:**
  1. On `LMSFinish`, Moodle changes `not attempted` to `completed` (`mod/scorm/datamodels/scorm_12.js:624-625`). Then it applies the mastery score (line 629). ADR-010 maps `not attempted` to `in_progress`. So a SCO that only calls `LMSFinish` never gets a grade.
  2. For an unknown element (`cmi.foo`), SCORM 1.2 gives error 201 (invalid argument), and Moodle also returns 201 (`scorm_12.js:287-291`). AC-T5-05 expects 401, but 401 means "valid but not implemented".
  3. The server adds `session_time` to `total_time` on `finish` **and** on `unload`. The Cogniate package calls `LMSFinish`, and then `pagehide` fires. So the time on task is doubled.
- **Fix:**
  - Apply the `LMSFinish` status rule (in `normal` mode with `credit`) before the outcome is derived.
  - Accept 201 in AC-T5-05, or write down why we use 401.
  - Add `session_time` only once per `sessionId`.
  - None of these changes the grade for the Cogniate package.

### A-T0-16 — MINOR — The acceptance criteria do not test some important cases

- **Location:** `tasks/T2.md` to `tasks/T7.md`.
- **Problem:** The ACs prove the happy path well, but the risks below have no test.
- **Evidence:**
  - **Re-launch after a pass.** At load, the package calls `LMSFinish` at once (end of `scorm-api.js`, when `completionRatio() >= 1`). Expected: no new sync row, and the outcome stays `passed`.
  - **Launch of a withdrawn publication.** README §6e promises the text "This course is no longer available".
  - **HTML fail path.** Only the SCORM fail path has a test.
  - **Tool key rotation.** Run `--rotate-signing-key`, then make a Deep Linking return. It must still verify in Moodle. Moodle fetches the keyset again for an unknown `kid` (`mod/lti/locallib.php:1316-1344`).
  - **First launch in embed mode.** Dynamic registration sets embed by default. Test a launch before the admin edits the tool (see A-T0-07).
  - **Teacher override.** A teacher overrides a grade, then a new learner score arrives. Expected: the override stays (see A-T0-09).
- **Fix:** Add one AC for each item, in T3, T5 or T7.

---

## NIT

### A-T0-17 — NIT — The example values in contract §3.1 do not match Moodle 5.2.4

- **Location:** `contracts/lti-service-api.md` §3.1, response example.
- **Problem and evidence:**
  - The spike token (`infra/moodle/.data/id_token.claims.json`) has these `tool_platform` values: `version = "2026042004"`, `guid` = a 32-character hash, `name = "moodle"`, `description = "Cogniate_Dev_Moodle"`.
  - The example shows `version = "2026100500"`, `guid = "moodle.test"`, and the site name in `name`.
- **Fix:** Use the real values, or mark the values as placeholders, so that QA does not assert them.

### A-T0-18 — NIT — Permissions for the inner package frame are not set

- **Location:** `README.md` §5 and §9.5, row "Sandbox".
- **Problem:** `allow="autoplay; fullscreen"` is set only on the runtime iframe. Permission delegation stops at each frame, so the course video cannot go full screen.
- **Evidence:** The sandbox has no `allow-modals`, so `alert()` and `confirm()` in a package do nothing. The HTML export has one such call.
- **Fix:** Set the same `allow` value on the inner package iframe. Decide on `allow-modals`, and write the decision down.

---

## Verified as correct (no action)

Evidence is from the Moodle 5.2.4 source unless stated.

- **`mod/lti/auth.php`.** It requires `scope=openid`, `response_type=id_token`, a matching `client_id`, `login_hint` equal to the user id, and `redirect_uri` in the registered list. It also requires `response_mode=form_post` and `prompt` empty or `none`. If the user is not logged in, it shows `repost_crosssite_page`.
- **Login and `target_link_uri`.** Moodle posts a form (`locallib.php:3601`) with `iss`, `target_link_uri` (the activity URL with its query), `login_hint`, `lti_message_hint`, `client_id` and `lti_deployment_id`, which is the type id (`locallib.php:3634-3672`). The `id_token` uses the same URL (`locallib.php:3386`), so launch check 12 holds.
- **Deep Linking.**
  - "Select content" always opens in a modal iframe.
  - `lineItem` with accept grades "Delegate" (dynamic: `registration_helper.php`; manual: ADR-009) sets `instructorchoiceacceptgrades = 1` and the maximum grade to `scoreMaximum` (`content_item_to_form`).
  - The coupled row in `ltiservice_gradebookservices` makes the `lineitem` claim appear.
  - `typeid` stays fixed in the form (`mod_form.php:424`), so two Cogniate tools on one domain do not mix.
  - Moodle 4.3+ ignores the `window` and `iframe` hints (`locallib.php:1514`).
- **Dynamic registration.**
  - Moodle requires `client_name`, `jwks_uri`, `initiate_login_uri`, `redirect_uris`, `private_key_jwt` and `domain`, and `target_link_uri` must match `domain`.
  - The new tool is PENDING, with embed and "preconfigured only" defaults.
  - `claims` set the privacy settings, and scopes set the services.
  - Moodle handles the close `postMessage` (`tool_configure_controller.js:109`).
- **AGS.**
  - `application/vnd.ims.lis.v1.score+json` is required.
  - Moodle stores our `timestamp` as `timemodified`, and the 409 rule compares with that value. So "+1 s per (line item, user)" is correct.
  - A score that is not `FullyGraded` sets the grade to null.
  - Only gradable users are accepted.
  - ISO 8601 with milliseconds and `Z` passes `validate_iso8601_date`.
  - `token.php` grants the intersection of the requested and permitted scopes.
- **Other checks.**
  - Moodle fetches the tool JWKS again for an unknown `kid`, so key rotation works.
  - `get_cacert()` reads `$CFG->dataroot/moodleorgca.crt` first.
  - `mod/lti` has no `lti_storage_target`.
  - "Receive a grade" completion runs on a grade update, and a grade of 0 counts as received.
- **The package.** The SCO finds `parent.API`, probes for 301, keeps navigation in the frame, writes only the elements in README §6c, and calls `LMSFinish` itself. The HTML export has the markup that ADR-004 needs: `body[data-lesson-id]`, `[data-cog-quiz]`, and radio inputs with `data-cog-correct`.
