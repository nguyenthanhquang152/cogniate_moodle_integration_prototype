# T3a: LTI services that the app needs — service keys, token client, Deep Linking response, scores, line item reads

Owner: Author. Depends on: T2. Contract: [`../contracts/lti-service-api.md`](../contracts/lti-service-api.md) §0 (T3a rows), §3.2 (`/api/deeplinking`), §3.3, §3.4, §3.5 (GET rows), §3.6, §4, §5. Security §2.3, §8, §9. Decision: ADR-010.

## Goal

The Cogniate app can do everything that the critical path needs through the LTIAAS-shaped API: deep-link a course, read the line item, and send and read scores in the background.

## Scope

In:

- Service keys in `GET /api/idtoken` (contract §3.3) and `SERVICE-AUTH-V1`.
- Platform token client with an in-memory cache (contract §4). Client assertion and Deep Linking JWT with `iat = now − 30 s`, `exp = now + 300 s` (security §2.3).
- `POST /api/deeplinking` (message + target).
- `GET /api/lineitems`, `GET /api/lineitems/:id`, `POST` and `GET /api/lineitems/:id/scores`. Line item URL rule incl. query parameters (contract §3.4). Timestamp rule (in memory).
- Platform error mapping (contract §1.3).
- `launch.deepLinkingSettings` in the ID token.

Out: `/api/deeplinking/form`, `/message`, line item writes, NRPS, platform DELETE, OAuth stubs (T3c). Dynamic registration (T3b).

## Design notes

- Scores URL = line item path + `/scores`, query kept (Moodle `?type_id=`).
- Unit test with a fake clock 2 s ahead of "Moodle": the JWT `iat` is still in the past.
- QA can stand in for the app pages: a Playwright `route` on `{PUBLIC_APP_URL}/tool/deep-link**` that reads the ltik, calls the API, and fulfils the request with its own form.

## Acceptance criteria

Setup: T2 setup (`acceptance` profile, `seed:lti-manual`).

Deep Linking:

- **AC-T3-06** `cg_teacher`: `COGNIATE-DEV-101` → Add an activity → "Cogniate (seed)" → Select content. The frame reaches `{PUBLIC_APP_URL}/tool/deep-link?ltik=<v>`. `GET /api/idtoken` → `launch.type=LtiDeepLinkingRequest`, `services.deepLinking.available=true`, `launch.deepLinkingSettings.acceptTypes` has `ltiResourceLink`, no `launch.resourceLink`.
- **AC-T3-07** `POST /api/deeplinking` with one `ltiResourceLink` (`title "QA DL <runId>"`, `url {PUBLIC_LTI_URL}/lti/launch/cogniate?resource=qa-dl`, `lineItem {scoreMaximum:100,label:"QA DL <runId>"}`) → `200 {message, target}`, `target` = Moodle `contentitem_return.php`. QA posts `message` as `JWT` to `target` in the frame. The activity form gets the name. After save, the course has the activity and the gradebook has the item with maximum 100.
- **AC-T3-08** The JWT, verified with `/lti/keys/cogniate`, has `iss` = client id, `aud` = `PUBLIC_MOODLE_URL`, `message_type = LtiDeepLinkingResponse`, `version = 1.3.0`, `deployment_id`, `nonce`, `content_items` deep-equal to the request items, `exp − iat = 330 ± 1`, and `iat ≤ now − 25 s` at the time of the response.
- **AC-T3-10** Content item `url` on `https://evil.test` → `400 INVALID_CONTENT_ITEM`. Two items when `acceptMultiple` is false → `400 INVALID_CONTENT_ITEM`. A resource-link ltik → `403 SERVICE_NOT_AVAILABLE`.

Service keys and scores:

- **AC-T3-11** `cg_student` launches "QA DL". `GET /api/idtoken` → `assignmentAndGrades.available=true`, `lineItemId` on `PUBLIC_MOODLE_URL/mod/lti/services.php/...`, `serviceKey` present. A launch by `cg_student2` of the same activity returns the **same** `serviceKey`.
- **AC-T3-12** `POST /api/lineitems/<enc lineItemId>/scores` (ltik) `{userId:<cg_student>, activityProgress:"Completed", gradingProgress:"FullyGraded", scoreGiven:87, scoreMaximum:100}` → `204`. QA oracle `gradereport_user_get_grade_items` shows 87 for `cg_student` in "QA DL" (screenshot of the grader report as evidence).
- **AC-T3-13** The same with `SERVICE-AUTH-V1 <key>:<serviceKey>`, sent twice within one second (`91`, then `92`) → both `204`; the gradebook shows 92.
- **AC-T3-14** `GET /api/lineitems` (ltik) → `lineItems` has "QA DL" (`scoreMaximum` 100). `GET /api/lineitems/<enc id>` → the same item. `GET /api/lineitems/<enc id>/scores?userId=<cg_student>` → `scores[0].resultScore=92`, `resultMaximum=100`.
- **AC-T3-16** Line item id `https%3A%2F%2Fevil.test%2Fx` → `400 INVALID_LINE_ITEM_ID`; zero sink hits; no `outbound_*` event for `evil.test`. The line item URL of "Seed activity 102" (course `COGNIATE-DEV-102`) with the service key of "QA DL" (course `COGNIATE-DEV-101`) → `400 INVALID_LINE_ITEM_ID`, no outbound request.
- **AC-T3-23** Same course, two tools: QA makes a manual tool "QA tool B" in the Moodle UI (values of the `cogniate` account, ADR-009), registers it with `POST /api/platforms`, and adds an activity with it in `COGNIATE-DEV-101` (accept grades, maximum 100). The service key of "QA DL" with the line item URL of tool B's activity, once with tool B's `type_id` and once with no `type_id` → `400 INVALID_LINE_ITEM_ID`, no outbound request, and tool B's grade does not change.
- **AC-T3-17** Score for `cg_teacher` → `400 PLATFORM_REJECTED_REQUEST`. Score for a user id that is not in the course → `400 PLATFORM_REJECTED_REQUEST`.
- **AC-T3-18** A service key with the `qa-second` API key → `401 INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER`. `SERVICE-AUTH-V1` on `/api/idtoken` → `401 INVALID_AUTHORIZATION_HEADER`.
- **AC-T3-22** Two score posts within 60 s: the log has at most one `platform_token {cache:"miss"}` for them, and the second post has `cache:"hit"`.
- **AC-T3-24** Every platform call in AC-T3-12 to AC-T3-14 has exactly one `outbound_request` event (`host` = Moodle host) with the trace id of that API response.

## Self-check

`npm run check` green. Unit tests: content item validation, scores URL builder (with and without query), line item URL rule (origin, path, query), timestamp rule, platform error mapping, `Link` header parsing, fake-clock JWT test.
