Verdict: PASS
Round: 1

# T3a QA verification

| Item | Value |
| --- | --- |
| SHA | `6f03a806f451ab5b0ac5c2702efce7e05a4979e1` (T3a code `a0a753d`, T3b code `7d9f2c7`, QA tests with the moodle-dl fix) |
| Spec | `tasks/T3a.md` (ACs unchanged since the tests were written; the round adds the refactor notes B-T2a-01 and B-T4a-01), contract `lti-service-api.md` §3.2–§3.6 |
| Tests used | The SHA tests plus the QA-side changes of this round (section 3), with `--replace-tests` (changed files: `E4/tests-diff-vs-sha.txt`). The Lead can commit `tests/**`. |
| Runs | **Run 3** (`E3`): T2a + T2b (regression) + T3a + T3b in one pass A, then the T2a knob pass and the reset pass. **Run 4** (`E4`): T3a alone, after one QA helper fix. The T3a verdict comes from run 4. Run 3 agrees with it, except AC-T3-23 (a QA helper defect) and AC-T3-17/-18 (skipped after it). |
| Runner | `COMPOSE_PROJECT_NAME=qa-t3-r2 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 node tests/host/run-t2.mjs --sha 6f03a80… --tasks T2a,T2b,T3a,T3b --replace-tests` (run 3), then `--tasks T3a` (run 4). Setup: `stack:up`, `seed`, `seed:lti-manual` twice. `test:acceptance` switches to the `acceptance` profile. |
| Clean environment | New clones under `~/cogniate-qa-runs/qa-t3-r2-6f03a806-…`. Before the runs, QA stopped its old runner and removed the leftover projects `qa-t3a-r1` and `qa-t3-r1` (containers, volumes, networks). |
| Isolation | The Author's stack was not touched by QA. After each run: 0 QA containers, 0 volumes, 0 networks. |
| Evidence roots | `E3` = `tests/host/artifacts/qa-t3-r2-6f03a806-2026-10-17T23-29-06-525Z/`, `E4` = `tests/host/artifacts/qa-t3-r2-6f03a806-2026-10-17T23-37-32-975Z/` |

## 1. Results per acceptance criterion (run 4)

Run 4: 14 T3a tests, 0 failed, 0 skipped. Evidence: `E4/container-passA/playwright-results.json` and `E4/container-passA/service-logs/`.

| AC | Result | What QA saw |
| --- | --- | --- |
| AC-T3-06 | PASS | `cg_teacher` uses Select content in `COGNIATE-DEV-101` (seed tool). The deep-linking launch reaches `{app}/tool/deep-link?ltik=…` (the 303 of the launch). `GET /api/idtoken`: `LtiDeepLinkingRequest`, `deepLinking.available=true`, `acceptTypes` contains `ltiResourceLink`, no `resourceLink`. |
| AC-T3-07 | PASS | `POST /api/deeplinking` → 200 `{message, target}`, where `target` is Moodle `contentitem_return.php`. Moodle fills the activity form, the form is saved in the Moodle UI, and the grade item has maximum 100. |
| AC-T3-08 | PASS | The deep-linking JWT verifies with `/lti/keys/cogniate` and has the required claims and times. |
| AC-T3-10 | PASS | A content item on `evil.test` → 400 `INVALID_CONTENT_ITEM`. Two items when `accept_multiple=false`, through a deep-linking launch of the QA platform (`qa-platform.test`) → 400 `INVALID_CONTENT_ITEM`. A resource-link ltik → 403. No sink hit, no `outbound_*` to `evil.test`. |
| AC-T3-11 | PASS | A launch of "QA DL": `assignmentAndGrades.available=true`, the `lineItemId` is on `PUBLIC_MOODLE_URL/mod/lti/services.php/…`, and `serviceKey` is present. `cg_student2` gets the same `serviceKey`. |
| AC-T3-12 | PASS | Score 87 (ltik) → 204. The QA oracle shows 87 for `cg_student`. |
| AC-T3-13 | PASS | `SERVICE-AUTH-V1`: 91, then 92 within one second → both 204. The gradebook shows 92. |
| AC-T3-14 | PASS | `GET /api/lineitems` has "QA DL" (`scoreMaximum` 100). `GET` of the item gives the same item. Its scores for `cg_student`: `resultScore` 92, `resultMaximum` 100. |
| AC-T3-16 | PASS | A line item on `evil.test`, and the line item of "Seed activity 102" (another course) with the "QA DL" service key → 400 `INVALID_LINE_ITEM_ID`, with no outbound request and no sink hit. |
| AC-T3-17 | PASS | Scores for `cg_teacher`, and for a user who is not in the course → 400 `PLATFORM_REJECTED_REQUEST`. |
| AC-T3-18 | PASS | A service key with the `qa-second` API key → 401 `INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER`. `SERVICE-AUTH-V1` on `/api/idtoken` → 401 `INVALID_AUTHORIZATION_HEADER`. |
| AC-T3-22 | PASS | Two score posts within 60 s: at most one `platform_token {cache:"miss"}`, and the second post has `cache:"hit"`. |
| AC-T3-23 | PASS | QA makes the manual tool "QA tool B" in the Moodle UI, registers it with `POST /api/platforms`, and adds an activity with it in `COGNIATE-DEV-101`. The "QA DL" service key with tool B's line item, once with tool B's `type_id` and once without `type_id` → 400 `INVALID_LINE_ITEM_ID`, no outbound request. Tool B's grade does not change. |
| AC-T3-24 | PASS | For each API response of AC-T3-12 to AC-T3-14: the number of `outbound_request` events to Moodle with its trace id = 1 + the number of `platform_token {cache:"miss"}` events with that trace id. |

### Regression (run 3)

T2a and T2b: all 34 results pass in the same stack with the refactored code (generic errors, the `app.ts` split, shared modules, the profile export fix). That includes AC-T2-30 (profile `default` after `test:acceptance`), the AC-T2-07 knob pass and the AC-T2-31 reset pass.

### The Author's notes for this round

| Note | QA result |
| --- | --- |
| `SERVICE-AUTH-V1` works on line-item routes | Agrees: AC-T3-13, AC-T3-16, AC-T3-23. |
| `/api/idtoken` returns `services.serviceKey`, the same for every user of the activity | Agrees: AC-T3-11. |
| A failed token request always maps to 502 `PLATFORM_ERROR` | Not exercised by a T3a AC. |
| `maxParamLength` 2048 for encoded line-item ids | Not exercised. |
| `lib.sh` no longer exports `STACK_PROFILE` (compose reads `ACTIVE_STACK_PROFILE`) | The profile switch works (`service_started` default → acceptance → default; AC-T2-30). |
| ACs that the Author did not cover: AC-T3-23 (second tool through the Moodle UI), the `accept_multiple=false` case of AC-T3-10, the UI save of AC-T3-07 | All three PASS by QA (above). |

## 2. Findings

Counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT. (A-T3a-01, the encoded-separator hole, is tested in T3b as AC-T3-29, and passes at this SHA.)

## 3. QA-side changes in this round

Several runs failed only because of QA test defects. Each one is now fixed.

1. **Moodle "Add an activity" URL** (`lib/moodle-dl.ts`). Moodle 5.2.4 uses `modedit.php?add=lti&typeid=<id>` (`mod/lti/lib.php`). With `type=<id>`, Moodle refuses: "The manual creation of tools without a course tool definition is no longer supported". This made every T3a test fail at `25e482b` (`qa-t3a-r1`).
2. **Deep-link return** (`lib/moodle-dl.ts`). A document that Playwright makes with `route.fulfill` cannot navigate a frame to another origin. QA checked this in the e2e image: a cross-origin form POST or `location.replace` from such a page ends on `chrome-error://`, while from a real page it works. So QA's stand-in page could never post the JWT to Moodle (`qa-t3-r1`). Now the modedit page itself posts the JWT into Moodle's dialog iframe (`target="contentitem-page-iframe"`, as Moodle's own form does). That POST is same-origin, so Moodle's `SameSite=Lax` session cookie goes with it.
3. **Registration hold** (`lib/moodle-reg.ts`). `/tool/register` is reached through two redirects: Moodle's 302, then the LTI service's 303. Redirect hops are not routed. So QA follows the chain with `route.fetch`, and the Manage tools page then points the registration iframe at the app URL (a new navigation, which the route holds).
4. **A relay page on `qa-platform.test` was tried and dropped**: that host serves `.html` as `application/octet-stream`.
5. **`addToolActivity`** (`lib/moodle-dl.ts`): the maximum-grade field is in a collapsed form section. The helper now expands the sections and sets the field even when it is hidden (run 3, AC-T3-23).
6. **Runner** (`tests/host/run-t2.mjs`): T3a and T3b run in pass A with T2a/T2b (they share the T2b setup). H14 accepts the AC ids of the selected tasks.

Other attempts: `qa-t3-r2` run 1 failed in `stack:up` ("not healthy after 22 s"). At that time the Author's stack restarted, and the host load was high. The retry passed setup. That run is not product evidence.

## 4. Not covered

- The token-request failure mapping (502 `PLATFORM_ERROR` for a Moodle 400 from `token.php`).
- Line-item ids longer than 2048 characters.
