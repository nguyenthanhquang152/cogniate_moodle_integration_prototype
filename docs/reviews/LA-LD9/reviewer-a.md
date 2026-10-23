Verdict: APPROVE
Round: 8

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

## Round 5

Reviewer: Codex GPT-6-Astra, xhigh; lens A. Reviewed lead-QA `19da95e` / merge `4d08fc1`: IC-03, IC-20, IC-21, their README and TEST-STRATEGY rows, and `golden.k0.test.mjs`. Checked the records against LA-ADR-04 D8, the cited build decisions, plan §6.1 LD-9 and product source at `326ceae`. Blind review; no Reviewer-B file read.

**Verdict: CHANGES_REQUESTED for IC-03; APPROVE for IC-20 and IC-21. New findings: 0 BLOCKER, 1 MAJOR, 0 MINOR, 1 NIT. A-LA-LD9-08 is closed. Earlier findings retain their recorded status.**

Verification used a fresh private clone at `dd19b694`, with its own `npm ci --ignore-scripts` and a cleared Vitest cache. The relevant LTI implementation and portal error renderer are unchanged from `326ceae`; the later Canvas wizard changes in this test snapshot are outside this review.

- Golden K0: **12/12 pass**. The metadata checks require the new records and the corrected IC-20 citation. They do not prove the prose in `scanChecked`.
- The **11 distinct Author test files** named by these records: **203/203 pass**.
- **15 private comparator probes pass**: each record permits G-BASE self-comparison and rejects an added field independently in G1–G4. None of the empty deltas permits a golden difference.
- Every listed scan file and numeric range exists at `326ceae`. Source inspection found the evidence problems below. No live capture, browser suite, K1 stack, Docker or host stack runner was run.

### LA-IC-03 — CHANGES_REQUESTED

The intended product changes are correct: the standard profile accepts a path-prefix issuer, requires the full configuration URL to equal `issuer + '/mod/lti/openid-configuration.php'`, and refuses missing Deep Linking support. G1–G4 do not execute DR. The real-Moodle frozen flows use the standard endpoint; AC-T3-05's foreign-issuer fixture still fails before the Deep Linking check. Thus the empty golden and frozen-test lists remain supported. The E3-06 fixture change in `18fa1d3` correctly replaces its old `/openid-<id>.json` URL with the standard path under a unique issuer prefix.

**A-LA-LD9-09 (MAJOR): IC-03 wrongly marks the query-bearing E5-06 simulator fixture unchanged.**

- Where: `tests/ltiaas/golden/expected/LA-IC-03.json:39,43` and its incomplete `qaTaskTestChanges` list at `:21-22`.
- Problem: the scan compares the URL's pathname, while the product compares the full URL. This misses another affected QA fixture and labels a failing DR path as unchanged.
- Evidence: `tests/sim/core/runtime.mjs:303-304` returns a configuration URL ending in `?scenario=...`; `protocol-wiring.k1sim.test.ts:161-163` uses that returned URL and has the same query-bearing fallback. At `326ceae`, `services/lti-service/src/lti/registration.ts:81` requires full-string equality. `http/routes/registration.ts:118,314` passes the unmodified URL at start and completion. A private pure-function probe with `https://moodle.sim.test/mod/lti/openid-configuration.php?scenario=e506-dr-ac07` succeeds under the old origin rule and returns `{ code: 'ISSUER_MISMATCH', detail: 'configuration_path_mismatch' }` under the standard rule. With another permissive DR profile loaded, start can pass, but completion with the default standard profile still fails its exact rule. This is not evidence that the K1 suite passed.
- Suggested fix: have QA repair or explicitly track the E5-06 fixture so its standard-profile configuration URL has the exact required form, with safe scenario selection. Record that additional task-test adjustment and correct the scan result and corresponding summaries. Keep the empty golden/frozen lists; this finding does not authorize changing frozen assertions or relaxing the product rule.

**A-LA-LD9-10 (NIT): several scan descriptions name assertions that the cited ranges do not contain.**

- Where: `tests/ltiaas/golden/expected/LA-IC-03.json:36,41`; `tests/ltiaas/golden/expected/LA-IC-21.json:31`.
- Evidence: T4b1 `3-security.spec.ts:95-110` contains the end of **AC-T4-33**, its unknown-ref check, and the start of AC-T4-34; it is not AC-T4-25 or a ref-replay test. E2-02 `dynamic-registration.k1sim.test.ts:150-310` does not cover AC-01 through AC-08 as claimed: the wrong-path branch asserts a status, not `ISSUER_MISMATCH`, and the staged case reads the registration view before creating an inactive platform directly after line 310. It does not complete a staged DR registration in that range.
- Suggested fix: name the actual cases and assertions, correct the ranges where needed, and remove the unsupported completion claim. The zero golden/frozen-change conclusions do not depend on these overstatements.

### LA-IC-20 — APPROVE

BD-A1-81 is reflected correctly. `ChannelErrorNotice` handles the five manifest keys; Moodle `PLATFORM_IN_USE` now matches `LEGACY_SELF_BINDING_TEXT.collision` after filling `{LMS}`. Canvas site rules 1/5 and collision text, Blackboard deployment text, and the baseline site-rule texts keep their bytes. Other codes retain each form's renderer. BD-A1-102's `details.reason` exception is present at `326ceae`, but the decision explicitly requires no LD-9 record change because no baseline answer carries that field.

The M2 assertions run on the owning channels. T6 checks invalid-field/alert presence, T4b1 checks API status/code, and U1/U2 use valid connection flows. G1–G4 do not render the portal notices. The empty golden and frozen lists are correct, and both summary tables agree with the updated record.

**A-LA-LD9-08 closed:** the record and both tables now cite `tests/acceptance/lib/portal.ts:176-181`, which contains `hasInlineError`. The new K0 assertion rejects the former `89-99` citation. Round 4's table entry saying Moodle `PLATFORM_IN_USE` uses generic text is superseded by BD-A1-81 and this round.

### LA-IC-21 — APPROVE

BD-A1-93 / BD-A2-86 match the implementation: both update paths call the same transaction-local helper, preserve the existing platform's `active` value, and force `false` when staged. `autoActivate` applies only to a new platform. The regression test covers an explicit update of a switched-off platform, and the existing duplicate-client test covers the other path.

AC-T3-03 creates an active platform (`1-registration.spec.ts:89`); AC-T3-26 then updates that platform (`2-update.spec.ts:61-77`). Its result remains unchanged. The app rejects explicit updates before completion and never sends `updatePlatformId`; the listed frozen app flows register new tools. G1–G4 make no completion call. The empty golden/frozen lists and both summary rows are correct. A-LA-LD9-10 requests evidence wording cleanup only; the E5-06 URL issue belongs to IC-03, not this activation change.

Only this review file was changed in the integration worktree. No commit was made.

## Round 6

Reviewer: Codex GPT-6-Astra xhigh, lens A. Reviewed the five records and their test/table changes in `d41b8d2` and `b40c789`, against product source at **`b40c789`**, LA-ADR-04 D8, LA-ADR-05 D3/D4/D6, the cited build decisions and plan §6.1 LD-9. Blind review; no Reviewer-B file read.

**Verdict: CHANGES_REQUESTED for IC-01; APPROVE for IC-03, IC-04, IC-12 and IC-14. New findings: 0 BLOCKER, 2 MAJOR, 0 MINOR, 3 NIT.** A-LA-LD9-09 is closed as a record correction. The IC-03 portions of A-LA-LD9-10 are closed; its IC-21 wording item remains outside this dispatch. Other earlier findings retain their status.

Verification: fresh private clone `/tmp/la-review-a-8ef139baba6e`, detached at `b40c789`, own install, Vitest cache cleared before each run. **342/342 focused tests** pass (15 existing Author files plus one private app-response probe); **105/105 contract K0 tests** and **12/12 golden K0 tests** pass. **38 comparison probes** confirm the four narrow records' intended changes and reject extra/wrong values. Six additional IC-01 probes demonstrate the overly broad acceptance below. The reported slot-3A live compare is evidence for `8f1ecea`, not a live verification of `b40c789`; I ran no Docker, stack, browser or host stack runner.

### LA-IC-01 — CHANGES_REQUESTED

**A-LA-LD9-11 (MAJOR): type-only wildcard rules hide incorrect or missing baseline-channel fields.**

- Where: `tests/ltiaas/golden/expected/LA-IC-01.json:5-23,415-438,913-952`; no regression for the actual IC-01 record in `golden.k0.test.mjs`.
- Problem: the record allows any string/object/array instead of the channel-specific values required by TEST-STRATEGY §4.7. A wildcard also counts as satisfied when only some baseline objects have the new field.
- Evidence: a private G-BASE candidate containing wrong channel names, wrong origin rules and fabricated capability objects passes IC-01 with **259 explained differences and zero missing entries**. Separate variants still pass when a Canvas connection has `channel: 'moodle'`, has an empty `channelCapabilities`, lacks `channel` entirely, or its provider has `registration: []`. These are product regressions, not intended additive output. The existing combined K0 comparison omits IC-01.
- Suggested fix: pin exact baseline paths and values, or use semantic rules that validate the expected channel/profile and require every expected field. Preserve the separate IC-14 capability changes. Add negative controls for wrong channel identity, capability values, missing fields and empty registration methods, and include the real record in the combined comparison.

**A-LA-LD9-12 (MAJOR): the three exact Brightspace rows reject the reviewed product.**

- Where: `tests/ltiaas/golden/expected/LA-IC-01.json:517,683,849`.
- Evidence: these rows require manual-only methods, `dynamicRegistration: false`, and no dynamic binding authority. At `b40c789`, `packages/channels/brightspace/manifest.ts:19-22` offers `['dynamic', 'manual']`; the real app route projects `dynamicRegistration: true` and `{ dynamic: 'self', manual: 'operatorGrant' }`. The private app-injection probe verifies that response. Substituting it into the three provider-list locations makes IC-01 fail all three exact entries. LA-E2-06 / BD-A1-108 already apply at this SHA; IC-14 only changes Canvas and cannot explain this difference.
- Suggested fix: update these exact new-channel objects to the intended wave-end output and record the source decision. Add a current-provider response check so an older slot's expected values cannot silently become the wave-end oracle. Do not replace the exact rows with another unrestricted object rule.

The record also needs its LD-9 scan/summary entry when repaired: the README's reviewed-record table omits IC-01 and the strategy row still describes the planned value-pinning rule. The E0/LD-1 rewrite remains a separate authorized list; this review does not authorize additional frozen assertion changes under IC-01.

### LA-IC-03 — APPROVE

**A-LA-LD9-09 closed:** the record now lists both affected QA task fixtures, explains full-URL comparison, distinguishes start from standard-profile completion, and explicitly tracks the E5-06 change as pending. The empty golden and frozen lists remain correct. The corrected T4b1 AC-T4-09/33 and E2-02 scan descriptions resolve this record's part of A-LA-LD9-10.

At the pinned SHA, `createMoodleDrScenario` still uses the query-bearing URL; its fix is **not present in this snapshot**. Approval is of the accurate change list, not proof that E5-06 now passes. QA must land the fixture fix and verify the affected completion case before its gate.

### LA-IC-04 — APPROVE

The three exact G1 changes match D4 and `a390edb`: remove only scope index 4 from each Canvas JSON form, and change only Moodle row 13's value. Source and tests confirm four AGS scopes in the channel request, while direct LTI completion without `scopes` retains its five-scope default. Blackboard's manual membership instruction is not changed by this product commit.

The frozen list identifies the two Canvas JSON cases, the common Moodle configuration case, and T4b1 AC-T4-10: **four cases in three files**. T6 and M2 compare against live API values; U2 passes live row values to `fillManualTool`; the direct-service NRPS and DR fixtures remain valid. No further frozen assertion edit was found. The proposed edits are still prospective at `b40c789`.

**A-LA-LD9-13 (NIT): the common Moodle configuration citation uses the wrong source range.** Where: `LA-IC-04.json:36,43`, README §5 and TEST-STRATEGY §4.7. At the reviewed SHA, the named case is `tests/acceptance/M1/common/00-profiles.test.ts:115-130`, with the NRPS value at `:126`; `93-108` is unrelated platform/refusal and DTO code. Use the integration range, or name the different QA source revision explicitly. The case and intended value change are correct.

### LA-IC-12 — APPROVE

Both new values equal their stored G4 picker text **plus exactly ` Cancel`**. The renderer puts Add before Cancel, so the frozen `.first()` selectors keep selecting Add; the Moodle named-button selector also stays valid. The service fixtures do not send an empty list expecting refusal or compare the complete shaped settings object. The no-course page has Cancel too, but G4 does not capture that page. Zero frozen edits and these two golden paths are supported.

**A-LA-LD9-14 (NIT): the record narrative and both tables still call the app change pending.** Where: `LA-IC-12.json:34,36`, `golden/README.md:133`, `TEST-STRATEGY.md:448`. The JSON now has two committed changes, while the README says `changes: []` and both narratives say the picker change will land later. Update the status/counts and include the app picker test/source evidence. The old optional-empty-record branch in K0 can also be removed now that both changes are present.

### LA-IC-14 — APPROVE

All **13 paths** are accounted for: ten Canvas capability flags across G1/G3 and three added provider methods. The K0 oracle changes only Canvas's `dynamicRegistration` flag. D6 and BD-A1-106/107 require the same `operatorGrant` authority before and after staging; the reviewed app tests cover the pending registration URL, inactive completion and grant adoption. The listed three M1 cases need the stated updates; sibling refusal cases and the other five capability flags must stay strict.

M2 continues through the manual path because `CanvasCreate` defaults to manual, even with the later LA-E3-16 wizard present. The separate E1-02 task fixture still pins Canvas false and G-BASE directly; the record correctly identifies it as affected, so QA must update both checks without changing G-BASE. This approval covers the listed changes, not an unrun wave-end capture.

**A-LA-LD9-15 (NIT): several IC-14 evidence references do not describe the pinned tree.** Where: `LA-IC-14.json:42-43,64-66`. The named E3-15 `canvas-dr-app.k0.test.ts` and E3-09 `canvas-dr.{k0,k1sim}.test.ts` files are absent at `b40c789`; mark them planned or cite their actual revision. `03-snapshot-controls.test.ts` ends at line 24, not 35; the common Blackboard checks start at line 131, beyond the cited `82-129`. Describe M2's manual default at the reviewed code, rather than relying on the older API-only Canvas wizard state. Correct these references; the 13 golden paths and three frozen-case changes remain valid.

Only this review file was edited in the integration worktree. No commit was made.

## Round 7

Reviewer: Codex GPT-6-Astra xhigh, lens A. Reviewed `7db4f2c5`, the named product source `d26d7018`, and the intervening product diff against plan §6.1 LD-9, LA-ADR-04 D8 and TEST-STRATEGY §4.7. Tests use a fresh private clone pinned to **`7db4f2c5`**; the intervening product changes do not alter the reviewed channel/profile projections. Blind review; no Reviewer-B file read.

**APPROVE for IC-01, IC-03, IC-04, IC-12, IC-14 and IC-21. New findings: 0 BLOCKER, 0 MAJOR, 0 MINOR, 1 NIT.** A-LA-LD9-11 and -12 are closed. A-LA-LD9-10, -13 and -14 are closed. A-LA-LD9-15 is partly closed, with one citation correction left below. Earlier findings outside this dispatch retain their status.

### Verification

Private clone `/tmp/la-review-a-ea939d2c10ff`, own `npm ci`, Vitest cache cleared before each run:

- **113/113 Author tests** pass in the seven IC-01 metadata-listed files; a separate **1/1 private product-response test** passes.
- **103/103 contract K0 tests** and **12/12 golden K0 tests** pass. The golden test covers IC-01 alone, all 13 records together with **280 explained differences**, and ten negative controls. Substituting round 6's IC-01 makes the new test fail; the reviewed file was then restored byte-for-byte.
- **525 IC-01 comparison probes** pass: the correct candidate, rejection of the original round 6 bad candidate, rejection of a wrong value and a missing value at each of the 259 paths, and rejection of the five separate round 6 variants. **38 narrow-record probes** pass for IC-03/04/12/14.
- The private product test reads the real LTI `/api/providers` route in default and acceptance modes, passes those rows to the real app `/app-api/lms-providers` route, and projects the captured connection shapes with the current connection DTO code and registry. All **259 exact IC-01 values** match. Comparing that candidate with IC-01 plus IC-14 passes with **272 differences**. Existing captured shared-platform state is held constant; this is host verification of the projections, not a replay of operator seeding or a new live golden capture.

No Docker, stack, browser or host stack runner was used.

### Resolved findings and approved scope

**A-LA-LD9-11 closed:** all 259 paths are unique, use exact indices/keys and exact JSON values, and match `ld9.goldenFields`. No wildcard or type-only rule remains. Wrong channel identity/name, empty capabilities, empty registration and a missing field now fail. The actual record is included in the combined test. G-BASE, normalization rules and the comparator are unchanged.

**A-LA-LD9-12 closed:** all three exact Brightspace provider rows now match the current response: dynamic and manual methods, dynamic capability enabled, and self/operatorGrant authorities. The same product-response check confirms four AGS scopes, Canvas dynamic registration, and `setup.connectionCheck: true` for Canvas and lti-generic. IC-14 retains its separate 13 legacy-field changes. IC-01's new metadata and both summary tables identify the additive paths and the separate LD-1 rewrite; no extra frozen assertion change is authorized.

**A-LA-LD9-10 closed:** IC-21 now describes the actual E2-02 refusal/start/view cases and direct inactive-platform test, without claiming staged completion. IC-03's previously corrected portions remain valid. The E5-06 query-free helper is now present at the reviewed pin, as the updated IC-03 record states; its K1-SIM execution remains a separate QA gate.

**A-LA-LD9-13 closed:** IC-04 and both tables now cite the common Moodle configuration case at `115-130`, including its row-13 value at `126`. The three exact golden changes and four frozen cases in three files remain approved.

**A-LA-LD9-14 closed:** IC-12 and both tables describe the landed app picker change, name the app tests, and list the two exact G4 text changes. K0 no longer accepts the obsolete empty/pending record. Zero frozen edits remains correct.

### Non-blocking documentation findings

**A-LA-LD9-15 (NIT), partly closed:** the snapshot-control/common-profile ranges are corrected, the E3-09 suites now exist at the cited integration revision, and the absent E3-15 suite is identified as QA-3 branch work. The remaining issue is `tests/ltiaas/golden/expected/LA-IC-14.json:66`: `packages/channels/canvas/portal/canvas.tsx` does not exist at either `7db4f2c5` or the cited `4c9809ff`. The current code is `packages/channels/canvas/portal/CanvasCreate.tsx:13-17`, with `useState(methods.includes("manual") ? "manual" : methods[0] ?? "manual")`, not the quoted generic initializer. Cite that file and describe the conditional default. The conclusion that M2 selects manual remains correct.

**A-LA-LD9-16 (NIT): IC-04 names a skip guard absent from its placeholder test.**

- Where: `tests/ltiaas/golden/expected/LA-IC-04.json:26`.
- Evidence: `tests/ltiaas/tasks-core/LA-E3-07/nrps-scopes.k1sim.test.ts:12-18` uses an ordinary `describe` and asserts `LA_DOCKER_WINDOW === '1'`; it does not use `describe.skipIf`. Calling it a placeholder is correct, but the asserted skip behavior is not present at this pin.
- Suggested fix: describe the environment assertion accurately, or cite an explicit different revision if the skip guard exists only on a QA branch. No product or frozen-assertion change is needed for this NIT.

Only this review file was edited in the integration worktree. No commit was made. Live wave-end capture and outstanding QA gates remain outside this host-only review.

## Round 8

Reviewer: Codex GPT-6-Astra xhigh, lens A. Reviewed **`b796b1ec`** (QA source `d1200f0b`) against plan §6.1 LD-9, the affected records, source at their cited `195930c1` pin, and the six frozen files plus two helpers staged in `f0a7b306`. This is a proportional metadata and citation review. Blind review; no Reviewer-B file read.

**APPROVE. New findings: 0 BLOCKER, 0 MAJOR, 0 MINOR, 1 NIT.** A-LA-LD9-15 and -16 are closed. Earlier findings outside this dispatch retain their status.

### Scope and resolved findings

IC-01 now correctly records **six frozen files plus two shared helpers pending on integration**, owned by **LA-E0-04 / LD-1**, staged on `la-qa` in `f0a7b306`, and due at the wave-end gate after separate LD-1 list approval. The record and both summary tables agree. Its zero-edit conclusion means **zero additional IC-01 frozen edits after LD-1**, not that the existing frozen assertions already accept the current output. This supersedes any earlier implication that the rewrite had landed before G-BASE. The M2 card entry correctly describes adding registered-extra-card and ordering checks; its existing baseline presence/text checks remain. IC-14 retains its separate Canvas legacy-field edits.

IC-01's 10 Author and 11 QA evidence entries resolve to **31 existing files**. The formerly absent or misnamed paths are corrected, and the E1-01/E1-06 golden-binding placeholders are explicitly recorded as pending. The new K0 guard checks path existence; it does not validate citation line ranges or prove pending suites have run.

**A-LA-LD9-15 closed:** IC-14 now cites `packages/channels/canvas/portal/CanvasCreate.tsx:13-17` and accurately describes its conditional manual default. The cited E3-15 `canvas-dr.k0.test.ts` and `canvas-dr.k1sim.test.ts` files now exist at the reviewed integration pin.

**A-LA-LD9-16 closed:** IC-04 distinguishes the historical plain-`describe` placeholder and its environment assertion from the implemented 99-line suite at the current pin. Its descriptions match the four-AGS-scope Canvas JSON checks, Moodle row 13, and score paths without NRPS. No K1-SIM execution is inferred from reading that suite.

### Verification

Fresh private clone `/tmp/la-review-a-503c471af31b`, detached at `b796b1ec`, with its own install: **12/12 golden K0 tests pass**. Two private negative controls fail at the intended new assertions: removing the pending frozen list fails its required count, and replacing an Author citation with an absent path fails the file-existence check. The record was restored byte-for-byte after each control. IC-01/04/14 `changes` arrays are unchanged from the parent commit; the existing 259-path IC-01, combined 280-difference, and negative-value checks remain intact. No product source, frozen assertion, G-BASE, normalization rule or comparator changed in this diff. No Docker, stack, browser or host stack runner was used.

### Non-blocking citation finding

**A-LA-LD9-17 (NIT): a few IC-01 line references remain inaccurate.**

- Where: `tests/ltiaas/golden/expected/LA-IC-01.json:281,286,311,324`; repeated host-runner citation in `tests/ltiaas/golden/README.md:131` and `tests/ltiaas/TEST-STRATEGY.md:438`.
- Evidence: both at `195930c1` and `b796b1ec`, `manifest.test.ts` ends at line **167**, not 170, and app `lti-generic.test.ts` ends at **77**, not 85. The host runner's exact six-profile assertion is at **297**; line 296 closes its API helper. These nearby citation errors do not change the named cases, pending ownership or approved change list.
- Suggested fix: trim the two ranges and the repeated app-test subrange to existing lines, and cite host assertion line 297 consistently. No product or frozen-assertion change is needed.

Only this review file was edited in the integration worktree. No commit was made. Separate LD-1 approval/landing and live wave-end verification remain pending.
