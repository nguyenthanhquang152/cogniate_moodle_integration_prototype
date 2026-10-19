# T3b: Dynamic registration, incl. "update existing tool"

Owner: Author. Depends on: T2a, T2b. Contract: [`../contracts/lti-service-api.md`](../contracts/lti-service-api.md) §2.4, §3.8. Security §2.4, §2.5. Decision: ADR-009.

## Goal

A Moodle admin can register a tool account with one URL. The service refuses a foreign "update" before it changes anything in Moodle.

## Scope

In: `GET /lti/register/{toolAccountId}`; `GET /api/registrations/:id` (with `operation`, `existingPlatformId`); `POST /api/registrations/:id/complete` (with `updatePlatformId`); the registration request of ADR-009; reading `scope` and `sub` from the Moodle registration token (verified with the platform JWKS).

Out: the app confirm page (T4b1).

NOTE: Moodle shows its choice page ("update an existing tool" or "register as a new tool") whenever a tool with the same domain exists (`startltiadvregistration.php`). In our stack the seeded manual tool "Cogniate (seed)" (T2a) already uses the LTI service domain, so **every** dynamic registration in T3b sees the choice page, also AC-T3-01. Production has the same effect: a second library on the same Moodle site, or a re-connect, always sees it. The T6 wizard explains it (AC-T6-12). QA stands in for `{PUBLIC_APP_URL}/tool/register` with a Playwright `route`.

## Acceptance criteria

- **AC-T3-01** As Moodle `admin`: Manage tools → paste `{PUBLIC_LTI_URL}/lti/register/cogniate?ref=qa123` → "Add LTI Advantage". Moodle shows the choice page (the seed tool has the same domain); QA chooses **"register as new"**. The frame reaches `{PUBLIC_APP_URL}/tool/register?registrationId=<id>&ref=qa123`, without `registration_token` and `openid_configuration`.
- **AC-T3-02** `GET /api/registrations/<id>` (Bearer) → `200`: `url = PUBLIC_MOODLE_URL`, `familyCode = moodle`, `version` not empty, `supportedScopes` has `.../lti-ags/scope/score`, `supportedMessages` has `LtiDeepLinkingRequest`, `privacyLevel = anonymous`, `operation = new`, `existingPlatformId = null`.
- **AC-T3-03** `complete {"platformName":"QA dyn <runId>"}` → `200` with `platformId` and `html` with `org.imsglobal.lti.close`. In Moodle a new Pending tool "QA dyn <runId>" has: tool URL `{PUBLIC_LTI_URL}/lti/launch/cogniate`, keyset `{PUBLIC_LTI_URL}/lti/keys/cogniate`, login `{PUBLIC_LTI_URL}/lti/login/cogniate`, deep linking on, AGS "grade sync and column management", share name and email Never. `GET /api/platforms/<platformId>` → `active=true`, `url = PUBLIC_MOODLE_URL`, `clientId` = Moodle client id, `deploymentIds = [<type id>]`.
- **AC-T3-04** A second `complete` → `409 REGISTRATION_ALREADY_COMPLETED`. Unknown id → `404 REGISTRATION_NOT_FOUND`. No Bearer → `401`.
- **AC-T3-05** `GET /lti/register/cogniate?openid_configuration=https://169.254.169.254/x` → `400` page; the log has `outbound_blocked {reason: private_ip}` and no `outbound_request` for that host. `openid_configuration=http://...` → `400`, `outbound_blocked {reason: not_https}`. A configuration whose `issuer` is another origin (QA serves it on `qa-platform.test`) → `400 ISSUER_MISMATCH`.
- **AC-T3-28** Error pages are visible in Moodle's frame: the admin pastes `{PUBLIC_LTI_URL}/lti/register/unknown` → "Add LTI Advantage" ("register as new" on the choice page) → the registration frame shows the error page (not a blocked frame) with HTTP status **404**, `data-error-code="UNKNOWN_TOOL_ACCOUNT"`, a `data-trace-id`, and `frame-ancestors https:`.
- **AC-T3-29** Line item URL encoding (A-T3a-01, fixed in this batch): with a valid ltik or service key, `POST` and `GET .../scores` on line item ids whose path contains `%2F`, `%2f`, `%5C`, `%5c`, double-encoded `%252F`, an encoded dot `%2E%2E`, a backslash, or a `/../` or `/./` segment (each built from the real line item URL, so the origin, path prefix and `type_id` still match) → `400 INVALID_LINE_ITEM_ID`, no `outbound_*` event for the Moodle host with that trace id, and no `sink_hit`. (With the T3c round-3 two-decode rule, each of these ids is still refused after the decoding of LTI contract §1.4.)
- **AC-T3-30** Score timestamp limit: a score with `timestamp` = now + 10 min → accepted (`204` or `409 PLATFORM_CONFLICT` from Moodle); with `timestamp` = now + 16 min → `400 INVALID_REQUEST` naming `timestamp`, and no outbound request.
- **AC-T3-25** Second registration from the same Moodle with the same URL: Moodle shows the choice page. QA chooses "update" of "QA dyn". `GET /api/registrations/<id2>` → `operation = update`, `existingPlatformId` = the AC-T3-03 platform. `complete` without `updatePlatformId`, and with another platform id → `409 REGISTRATION_UPDATE_NOT_ALLOWED`. The tool "QA dyn" in Moodle is unchanged (same name, same URLs, Active/Pending state as before), and `registration_rejected` is logged.
- **AC-T3-26** The same flow with `updatePlatformId` = `existingPlatformId` → `200`; Moodle returns the same client id; the platform keeps its id; `registration_completed {operation: update}` is logged.

## Self-check

`npm run check` green. Unit tests: registration request builder (each privacy level), operation detection from the token, issuer-origin rule.
