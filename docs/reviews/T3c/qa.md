Verdict: PASS
Round: 1

# T3c QA verification

| Item | Value |
| --- | --- |
| SHA | `8fdfa9ec4c86343c58a8019df1e3131817fe8047` (T3c rounds 2 and 3 with the A-T3c-03 `%3F`/`%23` line item guard, T6 round 2, T8 round 2 and portal; QA tests). The Lead named `1639c7e` first; T3c had not started, so QA ran the newer SHA, which has everything of `1639c7e` and the A-T3c-03 guard (the Lead asked to re-check AC-T3-27 on it). |
| Spec | `tasks/T3c.md` and LTI contract §1.4 (leading `//`; a double-encoded `:lineItemId` is decoded once more, never more than two decodes), §3.1 (`services.outcomes`), §3.2 (`/form`, `/message`, `url: null`, `custom: null`), §3.5, §3.6 (`user_id`, `comment: null`), §3.7, §3.9, §3.10, §8 (D14, D15) at this SHA. |
| Scope | AC-T3-09, -15, -20, -21, -31, -27 and AC-T3-19 (last), with the T3a ACs as setup and regression (T3c uses the T3a activity "QA DL"). |
| Tests used | The SHA tests plus the QA-side changes in section 3 (`--replace-tests`). The Lead can commit `tests/**`. |
| Runner | `COMPOSE_PROJECT_NAME=qa-t3c-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 node tests/host/run-t3c.mjs --sha 8fdfa9e…`: setup with `seed:lti-manual`, one pass `QA_TASK=T3a,T3c` (acceptance profile). The host channel answers `compat-run` (AC-T3-27: `COMPAT_INPUT_FILE=<QA input file> npm run test:compat`) and `seed-lti-manual` (AC-T3-19). |
| Independent client | `tests/compat/run.py` with the real `ltiaas==0.0.4` Python SDK (MIT, PyPI) in the compat container: the SDK's own calls and models, no SDK code copied. Inputs: one real `cg_student` launch ltik and one real `cg_teacher` deep-linking ltik, captured by QA and written to a mode-600 input file (deleted after the run). |
| Isolation | Each run used a new stack, removed with its volumes and networks. QA did not touch other stacks. None of the 74 values captured in run 2 (ltiks, service keys) is in the compat output or the runner logs. |
| Evidence roots | `R1` = `tests/host/artifacts/qa-t3c-r1-8fdfa9ec-2026-10-19T02-57-08-686Z/` (AC-T3-09 QA defect; AC-T3-27 and AC-T3-19 passed), `R2` = `…T02-59-33-082Z/` (all ACs). |

## 1. Results per acceptance criterion (`R2`)

| AC | Result | What QA saw |
| --- | --- | --- |
| AC-T3-09 | PASS | A real `cg_teacher` deep-linking launch. `POST /api/deeplinking/form` with the AC-T3-07 body → `200 {form}`: one `<form id="lti_dl_submit" method="POST">` whose `action` is the `target` of `/api/deeplinking` (Moodle `contentitem_return.php`), one hidden `JWT` input; the JWT verifies with `/lti/keys/cogniate`, and its claims equal those of the `/api/deeplinking` JWT except `nonce`, `iat`, `exp`; the fixed submit script is present. `POST /api/deeplinking/message` → `200 {message, target}` with the same target and the same claims. |
| AC-T3-15 | PASS | `POST /api/lineitems {label: "QA extra <runId>", scoreMaximum: 10}` → `201` with a Moodle URL `id`; the Moodle gradebook has the column. `PUT` with "QA extra 2" → `201`; Moodle shows "QA extra 2" and not the old name. `DELETE` → `204`; the column is gone. A QA platform launch whose AGS scope is only `lineitem.readonly` → `POST` `403 SERVICE_NOT_AVAILABLE` with the error shape and no platform call. |
| AC-T3-20 | PASS | `GET /api/memberships` (ltik of a `cg_student` launch) → `200`, `context.id` = course id, members `3: Instructor`, `4: Learner`, `5: Learner` (cg_teacher, cg_student, cg_student2), no `email`, `name`, `givenName`, `familyName` or `picture`. `?role=Learner` and the full role URI → only the two students. `url=https://evil.test/…` → `400 INVALID_URL_PARAMETER`; three oracles: the answer, zero `evil.test` sink hits, no `outbound_*` event for `evil.test`. |
| AC-T3-21 | PASS | `POST /api/oauth/x/access_token` and `…/access_token/refresh` with the API key → `501 NOT_IMPLEMENTED` with the error shape; without auth → `401`. |
| AC-T3-31 | PASS | `GET //api/idtoken` → `200`, equal to `/api/idtoken`; `services.outcomes = {available: false}`. Scores `?user_id=` = `?userId=`; both with different values → `400 INVALID_REQUEST`. `ltiResourceLink` with `url: null` → `200`, JWT item `url` = `{PUBLIC_LTI_URL}/lti/launch/cogniate`; with `custom: null` → `200` (JWT item `custom: {}`). The AC-T3-12 score with the line item id encoded once and twice → `204` and `204`; with `comment: null` → `204`; encoded three times → `400 INVALID_LINE_ITEM_ID` and no outbound request. A line item id on `evil.test` with a leading `//` → `400 INVALID_LINE_ITEM_ID`; the same id encoded twice → `400`; zero sink hits, no `outbound_*` for `evil.test`. |
| AC-T3-27 | PASS | The SDK against `PUBLIC_LTI_URL` with the `cogniate` API key, every check passes: `get_id_token` (user id 4, platform `https://moodle.test:8443`, context 2); `build_deep_linking_form` and `build_deep_linking_form_components` for one `ltiResourceLink` (JWT item `url` = the default launch URL); `submit_score` 7/10 and `get_scores` → 70/100 (ratio 0.7) for that user only; `get_memberships` (context 2, members 3, 4, 5, no personal fields). All 6 calls `2xx`; the SDK's models found every field they read (no `ValidationError`). The SDK sends `//api/…` paths (D14) and gets the line item id from QA once-encoded (`quote(id, safe="")`), which it encodes again (`https%253A%252F…`, accepted, §1.4). Evidence for D15: the SDK's own raw id → `404 NOT_FOUND`, as the contract says (not a defect). |
| AC-T3-19 | PASS | Run last. `DELETE /api/platforms/<seed platform>` → `204`. The old service key → `401 INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER`; the old ltik → `401` (`INVALID_LTIK_AUTH_AUTHORIZATION_HEADER`); `GET` of the platform → `404 UNREGISTERED_PLATFORM`. `npm run seed:lti-manual` (host) makes the platform again (a new id); a new `cg_student` launch → `GET /api/idtoken` `200`. |

T3a regression (setup of this pass): all 14 T3a ACs PASS in `R1` and `R2`.

### Differences table (contract §8) for AC-T3-27

| SDK behaviour | Result | Row |
| --- | --- | --- |
| Leading `//` in every path | Accepted | D14 |
| `services.outcomes` read by the `IdToken` model | Present (`{available: false}`) | D10, D14 |
| `get_scores` sends `user_id` | Accepted as an alias of `userId` | D14 |
| Content items with `url: null`, `custom: null` and other `null` fields | Accepted; the default `url` is set | D14 |
| Line item id: the SDK does not encode it; QA passes it once-encoded and the SDK encodes it again | Double-encoded id accepted; raw id `404` | D15 |

## 2. Findings

No product findings.

## 3. QA-side changes (tests only)

1. `tests/compat/run.py` (new): AC-T3-27 client. It reads the input file (`COMPAT_INPUT_FILE`, as in `infra/README.md`; it also accepts the README key names), passes line item ids once-encoded, prints only the first 6 characters and the length of secrets, records each HTTP status, and ends with one `QA_COMPAT_RESULT` JSON line. A raw-id probe (D15) runs outside the "every call 2xx" check.
2. `tests/host/run-t3c.mjs` (new) and host actions `compat-run`, `seed-lti-manual`. The runner adds the captured ltiks to its redaction list before it runs the compat container.
3. AC-T3-31 follows the round 3 text: the id encoded once, twice and three times, `custom: null`, `comment: null`.
4. AC-T3-09: the first version sent `/form` and `/message` without the `options` of the AC-T3-07 call, so the JWT had no `msg` claim and the claims differed (`R1`). The test now sends exactly the same body as the `/api/deeplinking` call (`deepLinkBody`).

## 4. Not covered

- `POST /api/lineitems` with a real Moodle tool whose AGS setting is "grade sync only" (QA used a QA platform launch with only `lineitem.readonly` in the claim).
- `?resourceLinkId` and `limit` on `/api/memberships`; NRPS paging.
- `DELETE /api/platforms` of a platform of another account.

## 5. Writing

This file uses Simplified Technical English where practical: short sentences, active voice, one instruction per sentence. API names, AC ids and error codes are kept as they are.
