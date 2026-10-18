# T3c: Compatibility-only endpoints and the independent-client test

Owner: Author (endpoints, compat container). QA (compat test script). Depends on: T7 PASS (off the critical path). Contract: [`../contracts/lti-service-api.md`](../contracts/lti-service-api.md) §0 (T3c rows), §3.2 (`/form`, `/message`), §3.5 (write rows), §3.7, §3.9 (DELETE), §3.10, §8. Decisions: ADR-001 (clean-room), ADR-003 (claim).

## Goal

Complete the LTIAAS-compatible surface and prove the narrow compatibility claim with a client that we did not write.

## Scope

In:

- `POST /api/deeplinking/form`, alias `POST /api/deeplinking/message`.
- `POST /api/lineitems`, `PUT` and `DELETE /api/lineitems/:id`.
- `GET /api/memberships` (NRPS, `role` short name or URI, `limit`, `resourceLinkId`, `url`).
- `DELETE /api/platforms/:id` (revokes ltiks and service keys).
- OAuth2 stubs (`501`).
- Compat container (Author, in `infra/`): compose profile `compat`, image `python:3.12-slim` with `ltiaas==0.0.4` pinned (MIT, PyPI). Runner interface (see `infra/README.md`, "Compat runner"): it does **not** read `seed.json`; it gets only the `cogniate` API key, the stack CA (`REQUESTS_CA_BUNDLE`), the base URL, and an optional read-only `COMPAT_INPUT_FILE` (QA's captured launch values). The repo's `tests/compat/` is mounted read-only and it runs `python /tests/compat/run.py`. Root script `npm run test:compat` starts it. The Author does not write or read that script.
- Fallback (if the SDK license or install fails): QA writes a small Python or Node client from the public endpoint names in our contract §0, and the Lead records the switch.

Round 3 (from QA's run of the real `ltiaas` 0.0.4 SDK against a mock): make the service tolerant of the SDK, as in LTI contract §1.4, §3.1, §3.2, §3.6 and differences D14: leading `//` in the path, `services.outcomes: {available: false}` in `/api/idtoken`, `user_id` alias on scores GET, content item `url` missing or `null`.

## Acceptance criteria

- **AC-T3-09** `POST /api/deeplinking/form` with the AC-T3-07 body → `200 {form}`: one `<form>` with `action` = `target` of `/api/deeplinking`, one hidden `JWT` input whose JWT verifies and has the same claims as AC-T3-08 (except `nonce`, `iat`, `exp`), and the fixed submit script. `POST /api/deeplinking/message` with the same body → `200 {message, target}` like `/api/deeplinking`.
- **AC-T3-15** `POST /api/lineitems {label:"QA extra <runId>", scoreMaximum:10}` → `201` with `id`. `PUT` with `label:"QA extra 2"` → `201`; the Moodle gradebook shows the new name. `DELETE` → `204`; the column is gone. With a launch whose AGS scope is only `lineitem.readonly` → `403 SERVICE_NOT_AVAILABLE`.
- **AC-T3-19** `DELETE /api/platforms/<seed platform>` → `204`. The old service key → `401 INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER`, the old ltik → `401`. `npm run seed:lti-manual` makes the platform again (H9); a new launch works. QA runs this AC last.
- **AC-T3-20** `GET /api/memberships` (ltik of a `cg_student` launch) → `200`, `context.id` = course id, `members` has the ids of `cg_teacher`, `cg_student`, `cg_student2` with roles, and no `email` or `name`. `?role=Learner` and `?role=http://purl.imsglobal.org/vocab/lis/v2/membership#Learner` each return only the two students. A `url` on `https://evil.test` → `400 INVALID_URL_PARAMETER`, zero sink hits.
- **AC-T3-21** `POST /api/oauth/x/access_token` → `501 NOT_IMPLEMENTED` with the error shape.
- **AC-T3-31** SDK tolerances (black-box, no SDK needed): `GET //api/idtoken` with a valid ltik → `200` like `/api/idtoken`; the body has `services.outcomes = {available: false}`; `GET …/scores?user_id=<id>` gives the same answer as `?userId=<id>`, and both with different values → `400 INVALID_REQUEST`; `POST /api/deeplinking` with an `ltiResourceLink` whose `url` is `null` → `200`, and the JWT item `url` = `{PUBLIC_LTI_URL}/lti/launch/cogniate`. A line item id that breaks the URL rule still gives `400 INVALID_LINE_ITEM_ID` when the request path starts with `//`.
- **AC-T3-27** Independent client: with one real `cg_student` launch ltik and one real `cg_teacher` deep-linking ltik (captured by QA), `npm run test:compat` runs the SDK against `PUBLIC_LTI_URL` with the `cogniate` API key. It must: read the ID token (user id, platform URL, context id match the launch); build a deep-linking form or message for one `ltiResourceLink`; post a score and read it back (value matches); list memberships. Every call is `2xx` and every field that the SDK reads exists. Any failure is listed in qa.md with the differences table row (contract §8) that explains it, or as a defect. Line item ids: the SDK does not encode them (difference D15); the QA script passes each line item id already encoded with `encodeURIComponent`, as the public reference requires. The SDK's own unencoded form is expected to give `404 NOT_FOUND` and is listed under D15, not as a defect.

## Self-check

`npm run check` green. Unit tests: form builder escaping, NRPS role mapping, platform delete cascade.
