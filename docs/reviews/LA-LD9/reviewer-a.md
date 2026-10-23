Verdict: APPROVE
Round: 4

# LD-9 test-change lists: Reviewer-A (lens "Is it right and is it safe?")

- Lists:
  - `tests/ltiaas/golden/expected/LA-IC-12.json`
  - `LA-IC-16.json`
  - `LA-IC-17.json`
  - the rule in `tests/ltiaas/golden/lib/compare.mjs`
  - TEST-STRATEGY §4.7 rows LA-IC-12, -16 and -17
  - `tests/ltiaas/golden/README.md` §5

  The commits are `c953275` and `6340e02`. The files at `HEAD` are the same.
- References: LA-ADR-04 D6, D8; plan LD-9; A1 BD-A1-36, BD-A1-41; LA-ADR-05 D3; AC-LA-E0-03-08.
- I ran on the host (no Docker):
  - `node --test tests/ltiaas/golden/golden.k0.test.mjs`: 11/11 pass.
  - A probe of `compareCaptures` with G-BASE G1 and ten changed copies of `acceptance.*Health.outbound_allowlist`.
  - My own scan of each claimed file, and `git grep` over `tests/acceptance`, `tests/e2e`, `tests/host`, `tests/fixtures`, `apps` and `packages/channels/moodle/portal`.
- Blind review: I did not open the other reviewer's file.

| List | Verdict | Counts |
| --- | --- | --- |
| LA-IC-12 (LA-E3-04 service part) | APPROVE | 0 BLOCKER, 0 MAJOR, 0 MINOR, 1 NIT (A-LA-LD9-02) |
| LA-IC-16 (simulator allowlist rule) | APPROVE | 0 BLOCKER, 0 MAJOR, 0 MINOR, 2 NIT (A-LA-LD9-01, -02) |
| LA-IC-17 (strict Moodle `PUT …/platform`) | APPROVE | 0 BLOCKER, 0 MAJOR, 0 MINOR, 1 NIT (A-LA-LD9-03) |
| LA-IC-18 (three LA-E1-11 portal looks; added 2026-10-23, section "LA-IC-18") | APPROVE | 0 BLOCKER, 0 MAJOR, 0 MINOR, 1 NIT (A-LA-LD9-04) |

## LA-IC-12: complete

- Golden fields: none today. That is right: `capture.golden.ts` never reads `GET /api/idtoken` of a Deep Linking launch (it imports `idToken` but does not call it) and never sends an empty item list. The G2 `deep-link` records come from the one-item golden pick.
- Frozen tests: none. That is right:
  - My `git grep` found no `contentItems: []` or `content_items: []` in a frozen suite.
  - The only frozen reader of `deepLinkingSettings` is `T3a/1-deep-linking.spec.ts:47-52`, which reads `acceptTypes` by property, so the new `acceptLineItem` and `acceptMediaTypes` members do not break it.
- The three Author unit-test files are named, with what each one changes.
- The file names the G4 picker text that LA-E3-05 adds (`goldenFieldsPendingAppPart`), and `changes` is empty. When LA-E3-05 lands, its LD-9 list must add `G4.{blackboard,canvas}.pages.picker.text` to `changes`, or the G4 compare fails.

## LA-IC-16: complete, and the rule cannot hide a non-simulator change

- Golden fields: only `G1.acceptance.ltiHealth.outbound_allowlist`. That is right:
  - `acceptance.appHealth` has no simulator host (README §4b: "The app allowlist does not change").
  - The `default` profile has none.
  - G2 keeps only the records of the three baseline providers (`capture.golden.ts:165`).
- Frozen tests: none. That is right: no frozen suite reads `outbound_allowlist`, and no frozen test names one of the seven new hosts (`git grep` outside `tests/sim` and `docs`). The LA suites that use the rule (LA-E1-05 AC-07 and AC-09) are listed. The LA-E7-03 runner already handles more than three providers.
- Rule probe (`compareCaptures` against G-BASE G1, with `LA-IC-16.json`):

  | Candidate | Result |
  | --- | --- |
  | The 3 non-simulator hosts in G-BASE order plus the 15 manifest hosts | pass, explained by LA-IC-16 |
  | Plus `evil2.test` | fail |
  | Plus `lms-sim.test` (does not end in `.sim.test`) | fail |
  | Plus `x.sim.test`, which is not in the manifest | fail |
  | One manifest host missing | fail |
  | The non-simulator hosts in another order | fail |
  | A manifest host added to `acceptance.appHealth` | fail (strict diff) |
  | A manifest host added to `default.ltiHealth` | fail (strict diff) |

  The rule also refuses duplicates, entries that are not strings, and a manifest allowlist with a host that does not end in `.sim.test`. So the only change it can explain is "the `.sim.test` set equals the manifest allowlist set". The manifest itself is checked fail-closed by the simulator and by `lib.sh`.
- **A-LA-LD9-01 (NIT): the compare explains the allowlist difference as LA-IC-16 even when no expected-delta file is given.**
  - Where: `tests/ltiaas/golden/lib/compare.mjs` in `compareCaptures` (`allowlistDiff.explainedBy = simHostsEntry ? simHostsEntry.id : 'LA-IC-16'`).
  - Problem: probe: the same candidate with `expected = []` also passes. AC-LA-E0-03-08 says "a difference named in an `LA-IC` expected-delta file passes; the same difference without that file fails". BD-A1-36 wants a lasting rule, so an always-on rule can be what was meant, but the README and the K0 test do not say that this id is an exception.
  - Suggested fix: explain the difference only when `LA-IC-16.json` (or `--sim-hosts`) is given. Or write the exception into README §5 and add a K0 case that pins it.
- Notes:
  - The rule reads `tests/sim/hosts.json` from the checkout that runs the compare. Run it in a checkout of the compared SHA, or pass `--sim-hosts`.
  - With the file, a self-compare of G-BASE fails at today's SHA, because the manifest has 15 hosts and G-BASE has 8. That is correct, but do not pass the file to the G-BASE self-check.
  - This list covers only the manifest change. The new default simulator record fields from the LA-E7-05 part of `0e65ab1` (my A-LA-E7-02-04) are a separate G2 change that has no id yet.

## LA-IC-17: complete

- Golden fields: none. That is right, but for another reason than the file gives. The golden script never calls the app's `PUT …/platform`: it registers the Moodle-shaped QA platform with the LTI service (`POST /api/platforms`, `tests/acceptance/lib/qa-platform.ts:43`). So no golden field can see the new refusal. See A-LA-LD9-03 for the wrong line reference.
- Frozen tests: none. I checked every Moodle or standard `PUT …/platform` body in the scan list:
  - `T4b1/1-connect.spec.ts:128-134`, `3-security.spec.ts:116`, `4-adoption.spec.ts:17-24` (`sixOf`);
  - `M1/canvas/41-canvas-grades.test.ts:89-90` and `61-canvas-containment.test.ts:156-158` (standard connections with exactly six keys);
  - `T6/2-connect.spec.ts`;
  - `e2e/2-scenario-b.spec.ts:52` (the label-to-key map of the six).

  The Moodle portal form sends only `platformFields` (`packages/channels/moodle/portal/ManualSetup.tsx:35-40`).
- The other `PUT …/platform` calls in the test tree are Canvas or Blackboard bodies, which were already strict.
- **A-LA-LD9-03 (NIT): the scan entry `tests/ltiaas/golden/capture.golden.ts:276-285` points to the lines that write the capture files, not to a platform body.**
  - Where: `LA-IC-17.json` `scanChecked`, `tests/ltiaas/golden/README.md` §5, and TEST-STRATEGY §4.7 row LA-IC-17.
  - Problem: the file has 279 lines, and lines 276-279 only write `G1.json`–`G4.json`. The golden capture has no app `PUT …/platform` call. The 0-change result stays right, but the record names the wrong evidence.
  - Suggested fix: replace the entry with "golden capture: no app `PUT …/platform`; the QA platform is registered by `POST /api/platforms` (`tests/acceptance/lib/qa-platform.ts:43`)".

## A-LA-LD9-02 (NIT): two `approval` paths point to files that are not on the integration branch

- Where: `LA-IC-12.json` `"approval": "docs/reviews/LA-E3-04/qa.md"`, and `LA-IC-16.json` `"approval": "docs/reviews/LA-E7-03/qa.md"`. Neither file exists at `HEAD`, because `docs/reviews/LA-E3-04/` and `docs/reviews/LA-E7-03/` hold only reviewer files. LA-IC-16 belongs to LA-E7-02 (BD-A1-36), whose QA record is `docs/reviews/LA-E7-02/qa.md`. `LA-IC-17.json` points to `docs/reviews/LA-E1-07/qa.md`, which exists.
- Problem: an auditor cannot follow the approval link from the expected-delta file.
- Suggested fix: point LA-IC-16 to `docs/reviews/LA-E7-02/qa.md` (or the LA-E7-03 QA README under `tests/ltiaas/tasks-ops/LA-E7-03/`). Land the LA-E3-04 `qa.md`, or point to the record that exists.

## LA-IC-18

- Reviewer: Reviewer-A2 (same session), lens A. Date: 2026-10-23.
- List: `tests/ltiaas/golden/expected/LA-IC-18.json` (commit `f973e21`; the same at `HEAD`). References: LA-ADR-04 D8 row LA-IC-18; A1 BD-A1-50; plan LD-9.
- I did not run Docker. I read the three product changes at `HEAD` (`apps/portal/src/courses/PublishDialog.tsx:71-73`, `apps/portal/src/connect/Connect.tsx:51`, `apps/portal/src/IntegrationLogo.tsx:29-31`) and the old code at `0d9aeda^1`. I checked every `scanChecked` file, and I ran `git grep` over `tests/e2e`, `tests/acceptance` and `tests/ltiaas`.
- Blind review: I did not open the other reviewer's file.
- **Verdict: APPROVE. 0 BLOCKER, 0 MAJOR, 0 MINOR, 1 NIT (A-LA-LD9-04).** The claim "0 golden changes and 0 frozen-test changes" is right.

| Change | Check |
| --- | --- |
| (a) Publish result modal names the connection's LMS | The result view is "Published to {LMS}" and "This course is available in the {LMS} content picker." No test contains `Published to` or `available in the`. For Moodle (U1, U2, T6) the text is still "Moodle". M2 `05-publish-results.m2.ts:10-32` checks only the pre-publish dialog (title "Publish to an LMS", the option texts) and does not click Publish. |
| (b) Connect-page logo colour from the card | Before: `lms === "moodle" ? "orange" : "red"`. Now: `manifest.card.color`. So only Blackboard changes, from red to blue: Canvas is `red` and Moodle is `orange` in the manifests, as before. No test reads a logo class or a colour on the Connect page. The only computed-colour test is T6 `1-integrations.spec.ts` AC-T6-02, which checks the body background, the active pill, the font and the card radius, not a logo. No test compares screenshots: `shot` only attaches a file, and the test tree has no `toHaveScreenshot` or `toMatchSnapshot`. |
| (c) Logo `title` | The span is `aria-hidden="true"`, so the title is not part of any accessible name, and `getByRole` and `getByText` do not see it. The only `getByTitle` and `[title]` uses are on Moodle pages (`tests/e2e/lib/moodle.ts:192`, `:303`), and `missingLabels` (`moodle.ts:64-75`) only checks that labels are present, so an extra title cannot make it fail. |
| Golden | `capture.golden.ts` G4 holds only tool and player pages (picker, error pages, `/play`), G1 to G3 hold API DTOs and simulator records, and no portal page is captured. So `goldenFields: []` and `changes: []` are right. |

- **A-LA-LD9-04 (NIT): two `scanChecked` ranges are past the end of their files, and the LA-IC-18 rows are missing from the two human-readable tables.**
  - Where: `LA-IC-18.json` `scanChecked`: `tests/e2e/M2/00-blackboard-not-ready.m2.ts:10-49` (the file has 35 lines), `tests/e2e/M2/03-blackboard-wizard.m2.ts:37-115` (110 lines). `tests/ltiaas/TEST-STRATEGY.md` §4.7 and `tests/ltiaas/golden/README.md` §5 ("Reviewed `LD-9` Expected-Delta Records") have rows for LA-IC-12, -16 and -17, but not for LA-IC-18.
  - Problem: the scan result stays right, because I read both files whole. But the record names lines that do not exist, and an auditor who reads the tables does not find LA-IC-18.
  - Suggested fix: change the two ranges to `10-35` and `37-110` (or name the whole files), and add one LA-IC-18 row to each table.


## Round 2

### LA-IC-13, LA-IC-15 and NIT checks

Reviewer-A: Codex GPT-6-Astra, lens A. Date: 2026-10-23. Reviewed commit `aa3b214`, with the product changes at `a2dfc04` (LA-E3-12) and `a285bdb` (LA-E4-03), against plan §6.1 LD-9, the task specs and LA-ADR-04 D8. The earlier findings above remain as review history; their current status is below.

**Verdict: APPROVE. 0 BLOCKER, 0 MAJOR, 0 MINOR, 2 new NITs and 1 partly open earlier NIT.**

| List | Verdict | Current findings |
| --- | --- | --- |
| LA-IC-13 | APPROVE | A-LA-LD9-05 (NIT): scan descriptions and references need correction; the zero-change conclusion is right |
| LA-IC-15 | APPROVE | A-LA-LD9-06 (NIT): evidence references need correction; exactly two golden changes are allowed |
| LA-IC-12 | APPROVE | A-LA-LD9-02 closed for this list |
| LA-IC-16 | APPROVE | A-LA-LD9-01 and -02 closed; scan record added |
| LA-IC-17 | APPROVE | A-LA-LD9-03 closed |
| LA-IC-18 | APPROVE | A-LA-LD9-04 partly closed: both table rows added, two invalid ranges remain |

#### Verification and scope

- Private host-only clone `/tmp/la-reviewer-a-ctx-e49090c83184`, pinned to `aa3b214`; no Docker, stack or stack-starting runner. No other reviewer's file was opened. Only this review file changed in the integration worktree.
- `node --test tests/ltiaas/golden/golden.k0.test.mjs`: **12/12 pass**. Restoring the parent comparator in the private clone makes the new no-expected-file assertion fail; the fixed comparator was restored afterwards.
- **29 independent comparison probes pass**, including four CLI runs. They cover the exact two LA-IC-15 values, omission of the delta, omission of either change, a changed byte, removal, another field, publication, score row, file or third channel, LA-IC-13's empty allowance, and LA-IC-16 opt-in. All six delta files together explain exactly three changes (two conflict texts and the allowlist).
- The six LTI Author test files named by LA-IC-13, plus `tracking.test.ts` and `drivers/lti-ags/reporter.test.ts`: **225/225 tests pass in 8 files**. Three extra private reporter probes using the real `409 PLATFORM_CONFLICT` description also pass: Moodle equals the stored G-BASE text byte for byte, and Canvas/Blackboard equal the two expected values.
- This is a source and stored-capture review, not a fresh live golden capture or browser regression run. The coordinator confirmed that LA K2 (`tests/e2e/ltiaas/`) has **not yet landed**; this review covers existing golden captures and frozen acceptance/browser suites, including M1 and M2.

#### LA-IC-13: zero golden and frozen-test changes confirmed

The golden script grades with numeric scores, does not capture platform DTOs or call memberships, and uses the simulator's single-client audience. Its setup helpers can register platforms, but the added `trustedAudiences` response member is not captured. The existing platform tests inspect selected DTO properties or deployment subobjects; they do not require an exact platform key set. The product merge changes exactly the six Author test files named in the record and no frozen test.

A scan of the frozen acceptance/e2e suites found no score POST with `scoreGiven: null`, including no `NaN`/`Infinity` score input that JSON serialization would turn into null. The explicit NRPS version overrides are `['2.0']`; the simulator default is also `['2.0']`. The important audience exception is `T2b/qa-platform.test.ts:82-89`: it already sends two audiences **without `azp`**, and already expects `INVALID_ISSUER_OR_AUDIENCE`. The new trust check follows the existing `azp_missing` check, so this assertion stays valid. The record's statement that no such array exists is incorrect, but its zero-change conclusion is correct.

Repeat the scan at `aa3b214` with:

```sh
rg -n 'scoreGiven|scoreMaximum|NaN|Infinity|service_versions|setAudience|\baud\s*:' tests/acceptance tests/e2e tests/sim
rg -n '/api/platforms|Object.keys|deepEqual|deepStrictEqual|toEqual' tests/acceptance tests/e2e
git diff --name-only a2dfc04^1 a2dfc04
```

**A-LA-LD9-05 (NIT): several LA-IC-13 evidence descriptions do not match the cited source.**

- Where: `tests/ltiaas/golden/expected/LA-IC-13.json:9`, `:16`, `:18`, `:20`, `:30`, `:35`, `:36`, `:39`, `:42`, `:44`; repeated scan claims in golden README §5 and TEST-STRATEGY §4.7.
- Evidence: T2b does send the two-audience negative case above. Both M1 score references send **7/10** and expect platform `400`/`422` `PLATFORM_REJECTED_REQUEST`, not 11/10 `INVALID_SCORE`. T3a's cited range does not contain the claimed negative/NaN/boolean/string score table. M1 common's platform POST is at `:77-81`, not `:49-60`. The AGS unit test compares parser results, not an HTTP `200`; the check-5 unit test expects `INVALID_ISSUER_OR_AUDIENCE`, not `INVALID_ID_TOKEN`. The wire field is `trustedAudiences`; `trusted_audiences` is the database column. The linked `LA-ADR-07-data-migration-and-indexes.md` does not exist.
- Suggested fix: keep `changes: []` and `frozenTestsTouched: []`, but derive the scan descriptions from the pinned source; explain the existing missing-`azp` negative case and use `LA-ADR-07-security-and-tenancy.md#d8-trusted-audiences-could`. Align the two summary tables. This is evidence cleanup, not a request to change a frozen assertion.

#### LA-IC-15: exactly the two conflict texts confirmed

The only G-BASE strings with the old conflict suffix are the Blackboard and Canvas `B-conflict` score-sync `lastError` values. The two entries use exact paths and exact full values, with no wildcard or permissive string rule. Missing either change fails as `MISSING`; changing another field or a third channel fails as an unexplained difference, including through `compare.mjs`.

G4's `status-conflict` responses have no `lastError`. T6's exact Moodle suffix remains unchanged, and T5b checks the `PLATFORM_CONFLICT` code. M1's cited failures are platform `400`/`422`; M2's cited result cases check successful sends. No frozen assertion needs to change. Neither the stored G-BASE files nor the frozen acceptance/e2e/host suites change in `aa3b214`.

**A-LA-LD9-06 (NIT): LA-IC-15's scan locations and one Author-test description are inaccurate.**

- Where: `tests/ltiaas/golden/expected/LA-IC-15.json:16`, `:28`, `:29`, `:34`; the copied locations in golden README §5 and TEST-STRATEGY §4.7.
- Evidence at `aa3b214`: the two G3 conflict strings are at `G3.json:363,1076`, not `:93,315`; the G4 conflict objects are at `G4.json:121-134,312-325`, not `:45-56,144-155`. `05-publish-results.m2.ts` has 57 lines, so `:34-90` is invalid; its result case is Canvas. The `a285bdb` change to `tracking.test.ts` replaces HTTP `syncResult` assertions with neutral `dispatchResult` assertions; it does not add `recordRuntimeScore`/`lmsName` coverage.
- Suggested fix: use the actual lines or stable JSON paths, narrow the M2 range to `:34-57`, and describe the tracking test change accurately. Keep the two exact delta entries unchanged.

#### Earlier NITs

- **A-LA-LD9-01 closed.** `compareCaptures` now explains the allowlist change only with a matching expected entry. The same candidate fails with no delta, including when only `simHosts` is supplied. The new test fails with the old comparator. The low-level `diff()` remains a manifest-aware helper; the approval gate uses `compareCaptures`/the CLI.
- **A-LA-LD9-02 closed.** LA-IC-12 now points to existing reviewer records; LA-IC-16 points to the existing LA-E7-02 QA record. All listed approval paths exist; only existence was checked for the other reviewer's paths.
- **LA-IC-16 scan record confirmed.** The new `scanChecked` and `scanResult` identify the health/capture readers. Reading the named files and searching the frozen acceptance/e2e suites confirms that none asserts `outbound_allowlist` contents. The only golden allowance remains `G1.acceptance.ltiHealth.outbound_allowlist`.
- **A-LA-LD9-03 closed.** LA-IC-17 now describes the pending Moodle connections at `capture.golden.ts:194-200` and direct QA platform registration at `qa-platform.ts:43`; the two summary tables match.
- **A-LA-LD9-04 remains partly open (NIT).** Both LA-IC-18 table rows are present. However, `tests/ltiaas/golden/expected/LA-IC-18.json:15` still cites `00-blackboard-not-ready.m2.ts:10-49` (35 lines), and `:18` still cites `03-blackboard-wizard.m2.ts:37-115` (110 lines). Use `10-35` and `37-110`, or name the whole files. The delta list stays approved.


## Round 3

## LA-IC-19

Reviewer: Codex GPT-6-Astra xhigh, lens A. Date: 2026-10-23. **APPROVE: 0 BLOCKER, 0 MAJOR, 0 MINOR, 1 new NIT (A-LA-LD9-07).** Earlier lists and their finding statuses are unchanged by this review.

Reviewed `04af91d` and its expected-delta record against BD-A1-57, LA-ADR-01 D12, LA-ADR-04 D8 and plan §6.1 LD-9. The product implementation is the LA-E1-09 channel-aware expired-session text. Source and stored-capture verification used private clone `/tmp/la-reviewer-a-ctx-e1c7d3f9bf5b` at `ce2a3ba`; no Docker, stack or browser acceptance runner ran. No other reviewer's file was opened; approval-path checks tested existence only.

### Zero golden and frozen-test changes confirmed

- `goldenFields: []`, `frozenTestsTouched: []` and `changes: []` are correct. The capture script exercises active runtime sessions to create outcomes, but does not store an expired content-host response in G1–G4. The stored captures contain no `RUNTIME_EXPIRED` value. Existing 410 tool-page responses are separate errors, not this runtime response.
- The only frozen test explicitly triggering `RUNTIME_EXPIRED` is `tests/acceptance/T5a/6-negative.spec.ts:75-84` (AC-T5-15). It launches a Moodle activity, waits past the TTL and checks only status 410 and the error code. The Moodle description also remains byte-for-byte equal. M1/M2 helpers complete active sessions; the cited browser checks do not assert an expired Canvas/Blackboard response.
- I checked the cited source ranges and searched `tests/acceptance`, `tests/e2e`, `tests/host`, `tests/fixtures` and the golden tree. All listed ranges exist. No stored G-BASE or frozen acceptance/e2e/host file changes in `04af91d`; only the LD-9 record, the two summary tables and the comparator unit test change.
- The coordinator's earlier scope clarification still applies: LA K2 (`tests/e2e/ltiaas/`) has not yet landed. This approval covers the existing frozen suites, including M1/M2 and T1–T8/U1–U2; it is not evidence from an unlanded K2 suite or a new live capture.

### Verification

- `node --test tests/ltiaas/golden/golden.k0.test.mjs`: **12/12 pass**, including IC-19 metadata and the combined expected-delta comparison.
- **Five private comparison probes pass**: G-BASE self-comparison with IC-19 succeeds, while an extra field in each of G1, G2, G3 and G4 independently fails. The empty delta cannot allow a golden difference.
- `lms-texts.test.ts` passes in the shared **239-test** focused run. Its runtime case pins exact Moodle/custom-channel descriptions for expired state requests, the custom-channel expired commit description, unknown-token 404 and expired runtime-page 404. This supports the unchanged Moodle assertion used by the scan.

### Finding

**A-LA-LD9-07 (NIT): IC-19 overstates the tested channel cases and includes a route that returns 404.**

- Where: `tests/ltiaas/golden/expected/LA-IC-19.json:13,21,34`; `tests/ltiaas/TEST-STRATEGY.md:455`.
- Evidence: the runtime case at `services/cogniate-app/src/tool-pages/lms-texts.test.ts:101-125` tests Moodle and the custom `your LMS` channel, not separate Canvas and Blackboard expired responses. `content-host/server.ts:189-191` returns HTML 404 for an expired `GET /rt/:token`; only `/state` and `/commit` use the 410 error at `:185-187,200-208`. The strategy row incorrectly includes the runtime page among the 410 routes. Also, the golden script uses active runtime responses to drive the scenario; it does not capture those response bodies as the `scanChecked` wording suggests.
- Suggested fix: describe the actual Moodle/custom cases, list only the state and commit routes for the 410 change, and say that golden setup uses active runtime sessions without capturing expired responses. Keep the empty golden/frozen change lists. This is evidence-text cleanup and does not require a product change or a frozen-test edit.

Only this review file was changed for this item.

## Round 4

## LA-IC-20

Reviewer: Codex GPT-6-Astra, xhigh; lens A. Reviewed the IC-20 record in `b3807f4`, product merge `2877245` and the IC-18 split in `1babba9`, against BD-A1-63/69, LA-ADR-04 D8, LA-E1-12 and plan §6.1 LD-9. Blind review; no Reviewer-B file read.

**Verdict: APPROVE. This list has 0 BLOCKER, 0 MAJOR, 0 MINOR and 1 NIT (A-LA-LD9-08).** Earlier lists retain their recorded status except A-LA-LD9-04, closed below.

### Channel and key changes confirmed

Compared the five original strings in `8e061ce^:apps/portal/src/connect/provider-errors.tsx` with the current manifest values and generic fallback. “Same” below means the original bytes, after filling `{LMS}`; “generic” means the exact fallback recorded in IC-20.

| Key | Moodle | Canvas | Blackboard | No channel / channel without own text |
| --- | --- | --- | --- | --- |
| `SITE_RULE_1` | Same | Same | Same | Generic |
| `SITE_RULE_5` | Generic | Same | Generic | Generic |
| `PLATFORM_IN_USE` | Generic | Same | Generic | Generic |
| `DEPLOYMENT_IN_USE` | Generic | Generic | Same | Generic |
| `DEPLOYMENT_FIXED` | Generic | Generic | Same | Generic |

The core receives the route's manifest through `ChannelScope` for both create and manage routes. The record correctly distinguishes a channel's own text from its fallback; it does not claim all five texts stay unchanged on every baseline channel. The other site rules and server-side `LEGACY_APP_ERROR_TEXT` stay unchanged.

### Frozen readers and golden scope

- M2's exact text assertions are Canvas site rules 1/5 and `PLATFORM_IN_USE`, plus Blackboard `DEPLOYMENT_IN_USE`. All use the owning channel, so their strings remain equal. The additional Blackboard assertion at line 106 is an API error-code check. No frozen browser assertion checks `DEPLOYMENT_FIXED` or a generic fallback case.
- T6 AC-T6-05 checks inline error presence for invalid Moodle platform fields. T4b1 adoption and the M1 refusals check API status/codes, not portal notice strings. U1/U2 connect successfully. Searches across the frozen acceptance/e2e/host suites confirm no further reader of the five changed portal texts.
- G1–G4 capture API DTOs, simulator records, tool pages and player responses; they never render the portal error component. Thus `goldenFields: []`, `frozenTestsTouched: []` and `changes: []` are correct. No stored G-BASE or frozen acceptance/e2e/host file changes in the reviewed record/product commits. This is a source and stored-capture review, not a new live capture or browser run; `tests/e2e/ltiaas/` is not present at the reviewed SHA.

### IC-18 split and earlier finding

**A-LA-LD9-04 closed.** The two ranges now end at the real file boundaries (`10-35`, `37-110`), and both human-readable tables have the IC-18 row. The split separately describes (a) LMS names in the publish result/checkbox, (b) Blackboard's Connect logo changing red to blue, and (c) the aria-hidden logo title. Each has a before/after and its zero-change reason. Moodle's visible text stays the same; M2 Canvas/Blackboard cannot enter the course-shell result view; no frozen selector, colour assertion or screenshot comparison reads the other two changes. The empty golden and frozen-change lists remain correct.

### Verification and finding

- Private clone `/tmp/la-review-a-e702-ic20.ewzZy1/` at `d768eec`: **100/100 tests in the seven named Author test files pass**, including channel/key parity, generic/custom contexts and create/manage route wiring. Golden K0: **12/12 pass**. Ten private comparator probes pass: each of IC-18 and IC-20 accepts a G-BASE self-compare but rejects an added field independently in G1, G2, G3 and G4. Neither empty record permits a golden difference.
- **A-LA-LD9-08 (NIT): the IC-20 inline-error helper reference points to unrelated code.** Where: `tests/ltiaas/golden/expected/LA-IC-20.json:34`, copied into golden README §5 (`:138`) and TEST-STRATEGY §4.7 (`:456`). The cited `tests/acceptance/lib/portal.ts:89-99` contains the card-grid return and colour helpers; `hasInlineError` is at `:176-181`. The actual helper does check only invalid-field/alert presence, so the zero-change conclusion is right. Update the three references to `176-181` or the function name; no frozen assertion or product change is needed.

Only this review file was edited for this item. No Docker, stack, host stack runner or commit was used.
