Verdict: PASS
Round: 1

# T3b QA verification

| Item | Value |
| --- | --- |
| SHA | `6f03a806f451ab5b0ac5c2702efce7e05a4979e1` (T3a code `a0a753d`, T3b code `7d9f2c7`) |
| Spec | `tasks/T3b.md` at `47d55c3`: AC-T3-01 to -05, -25, -26, -28, plus the new AC-T3-29 (encoded separators, A-T3a-01) and AC-T3-30 (score timestamp ≤ now + 15 min) |
| Tests used | The SHA tests plus the QA-side changes listed in `docs/reviews/T3a/qa.md` section 3, with `--replace-tests`. The AC-T3-29 and AC-T3-30 tests are new in `tests/acceptance/T3b/4-line-items.spec.ts`. |
| Run | Run 3 on `qa-t3-r2`: T2a + T2b (regression) + T3a + T3b in one pass A (`acceptance` profile), then the T2a knob and reset passes. T3b runs after T3a, so AC-T3-29 and AC-T3-30 use the "QA DL" line item and service key of T3a. |
| Runner | `COMPOSE_PROJECT_NAME=qa-t3-r2 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 node tests/host/run-t2.mjs --sha 6f03a80… --tasks T2a,T2b,T3a,T3b --replace-tests` |
| Isolation | The Author's stack was not touched by QA. After the run: 0 QA containers, 0 volumes, 0 networks. |
| Evidence root | `E3` = `tests/host/artifacts/qa-t3-r2-6f03a806-2026-10-17T23-29-06-525Z/` (`container-passA/playwright-results.json`, `service-logs/`) |

## 1. Results per acceptance criterion

All 10 T3b tests passed in run 3.

| AC | Result | What QA saw |
| --- | --- | --- |
| AC-T3-01 | PASS | Manage tools → paste the registration URL → "Add LTI Advantage". The registration frame reaches `{app}/tool/register?registrationId=…&ref=qa123`, without `registration_token` and `openid_configuration`. QA holds the frame there (T3b scope: QA stands in for the app page). |
| AC-T3-02 | PASS | `GET /api/registrations/<id>` describes Moodle and a new, anonymous registration. |
| AC-T3-03 | PASS | `complete` → 200 `{platformId, close html}`. Moodle has a Pending tool with our URLs and privacy settings. The platform matches the tool. The close page closes the dialog. |
| AC-T3-04 | PASS | A second `complete` → 409 `REGISTRATION_ALREADY_COMPLETED`. An unknown id → 404 `REGISTRATION_NOT_FOUND`. No Bearer → 401. |
| AC-T3-05 | PASS | The `openid_configuration` URL goes through the guard: a private IP gives `outbound_blocked {reason: private_ip}` and no `outbound_request`; `http` is refused; the issuer must be its own origin. |
| AC-T3-25 | PASS | An update of "QA dyn" without the matching `updatePlatformId` → 409 `REGISTRATION_UPDATE_NOT_ALLOWED`. Moodle does not change. |
| AC-T3-26 | PASS | An update with `updatePlatformId` = `existingPlatformId` → 200, with the same client id and platform id, and `registration_completed {operation: update}`. |
| AC-T3-28 | PASS | An unknown tool account shows the `UNKNOWN_TOOL_ACCOUNT` page (404) inside Moodle's registration frame. |
| AC-T3-29 | PASS | Nine line-item ids, each built from the real "QA DL" line item URL (same origin, path prefix and `type_id`). Their paths contain `%2F`, `%2f`, `%5C`, `%5c`, `%252F`, `%2E%2E`, a raw backslash, `/../` and `/./`. `POST …/scores` (service key) and `GET …/scores` (ltik) each give 400 `INVALID_LINE_ITEM_ID`, with no `outbound_*` event to the Moodle host for those trace ids and 0 `sink_hit`. |
| AC-T3-30 | PASS | `timestamp` = now + 10 min is accepted (204 or 409 `PLATFORM_CONFLICT`). `timestamp` = now + 16 min → 400 `INVALID_REQUEST`, the answer names `timestamp`, and there is no outbound request. AC-T3-30 posts for `cg_student2`, so the future grade time does not block later posts for `cg_student`. |

Regression in the same run: T2a and T2b, 34 of 34 results pass (see `docs/reviews/T3a/qa.md`).

## 2. Findings

Counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.

## 3. QA-side changes

The registration hold of AC-T3-01/-03/-25/-26 needed the QA helper fix in `lib/moodle-reg.ts`. QA now follows Moodle's 302 and the LTI service's 303 itself, and the Manage tools page points the frame at the app URL. Earlier runs failed on that QA defect only. Details are in `docs/reviews/T3a/qa.md` section 3.

## 4. Not covered

- None of the T3b ACs. The registration choice page for an update (AC-T3-25/-26) was driven through the real Moodle UI.
