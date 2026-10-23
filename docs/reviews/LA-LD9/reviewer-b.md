Verdict: APPROVE
Round: 8

# LD-9 lists LA-IC-12, LA-IC-16, LA-IC-17, Reviewer-B (lens: "Can a human team own it?")

Scope: the QA-owned LD-9 lists in `tests/ltiaas/golden/expected/`, which are `LA-IC-12.json` (LA-E3-04 empty Deep Linking responses), `LA-IC-16.json` (simulator allowlist rule, BD-A1-36) and `LA-IC-17.json` (strict Moodle `PUT …/platform` body, BD-A1-41). I also reviewed the compare rule `sim-hosts-allowlist` in `tests/ltiaas/golden/lib/compare.mjs`, and TEST-STRATEGY §4.7 (rows `:448`, `:452`, `:453`). Plan LD-9: each `LA-IC` lists the exact assertions it changes, and no other assertion may change. I did not open the other reviewer's file. I did not run Docker.

| List | Verdict | Counts |
| --- | --- | --- |
| LA-IC-12 | **APPROVE** | 0 findings |
| LA-IC-16 | **APPROVE** | 2 NIT |
| LA-IC-17 | **APPROVE** | 0 findings |
| LA-IC-18 (Reviewer-B2, added later) | **APPROVE** | 1 NIT |

## How I checked

- Private `/tmp` clone of the integration HEAD with `tests/node_modules` copied (removed after the run). The shared LA worktree did not change.
- `node --test tests/ltiaas/golden/golden.k0.test.mjs`: **11 of 11 passed**.
- My own scans of the frozen suites (`tests/acceptance`, `tests/e2e`, `tests/host`) for each claim (below).
- A probe of `compareCaptures` with the real `LA-IC-16.json`, on a base allowlist and seven candidates (results under LA-IC-16).

## LA-IC-12 — APPROVE

- **Claim:** 0 golden fields, 0 frozen-test changes at the service part (`3344520`); 3 Author unit-test files changed; G4 picker text pending for LA-E3-05.
- **My check:**
  - `grep` for an empty `contentItems` finds only the new LA task suite `tests/ltiaas/tasks-lti/LA-E3-04/deep-linking.k1sim.test.ts`, not a frozen test.
  - The only frozen use of `deepLinkingSettings` is `T3a/1-deep-linking.spec.ts:52`, a property read (`?.acceptTypes`), not a whole-object compare.
  - The three Author test changes match the LA-E3-04 diff I reviewed (`deep-linking.test.ts`, `compat.test.ts` `[]` → `null` in the refusal table, `idtoken.test.ts`).
  - The pending G4 picker text is named, with its reason (`07-sim-scenario.m2.ts:36` clicks the first button). The list is complete and easy to follow.

## LA-IC-16 — APPROVE (2 NIT)

- **Claim:** one golden field, `G1.acceptance.ltiHealth.outbound_allowlist`, compared by the rule: `.sim.test` entries equal the `tests/sim/hosts.json` allowlist union as a set; non-`.sim.test` entries equal G-BASE in order; every other allowlist stays strict. 0 frozen tests touched.
- **The rule cannot hide a non-simulator change.** My probe, with `compareCaptures(base, candidate, [LA-IC-16])`:

  | Candidate change | Result |
  | --- | --- |
  | the manifest's sim hosts | PASS (expected) |
  | add `attacker.test` | FAIL (`acceptance.ltiHealth.outbound_allowlist`) |
  | reorder the non-sim entries | FAIL |
  | add `lms-sim.test` (the control host, not `.sim.test`) | FAIL |
  | add `evil.sim.test` (not in `hosts.json`) | FAIL |
  | a sim host in `default.ltiHealth` | FAIL (`default.ltiHealth.outbound_allowlist[1]`) |
  | a sim host in `acceptance.appHealth` | FAIL (`acceptance.appHealth.outbound_allowlist[2]`) |

  The rule also refuses duplicate `.sim.test` entries and a manifest host that does not end in `.sim.test` (`compare.mjs:62-76`).
- **Frozen tests:** my `grep` for `outbound_allowlist` and allowlist checks in `tests/acceptance`, `tests/e2e`, `tests/host` finds no assertion. The M1 and M2 files use simulator hosts only as targets. So "0 frozen tests touched" holds.

### B-LD9-01 — NIT — The rule applies even when the LA-IC-16 file is not passed

- **File:** `tests/ltiaas/golden/lib/compare.mjs:174-177`.
- **Problem:** `compareCaptures(base, candidate)` with no expected-delta file still explains the allowlist diff and labels it `LA-IC-16` (my probe: `without the LA-IC-16 file: LA-IC-16`; the unit test `resAuto` asserts this on purpose). The check itself is the same, so nothing is hidden. But a reader of a report cannot tell whether the reviewed list was passed, and the `missing` check never fires for this rule.
- **Suggested fix:** Label the implicit case `LA-IC-16 (implicit)` in `report()`, or apply the rule only when the delta file is passed. Then the gate command always names `--expected LA-IC-16`.

### B-LD9-02 — NIT — The LA-IC-16 list has no scan record

- **File:** `tests/ltiaas/golden/expected/LA-IC-16.json` (no `scanChecked` and `scanResult`, unlike LA-IC-12 and LA-IC-17); TEST-STRATEGY `:452`.
- **Problem:** The list says `frozenTestsTouched: []` without the files that the scan read, so a later reviewer cannot repeat the check from the list alone.
- **Suggested fix:** Add `scanChecked` (for example: "no frozen test asserts `outbound_allowlist`; M1 and M2 use simulator hosts only as targets") and a one-line `scanResult`, as in the other two lists.

## LA-IC-17 — APPROVE

- **Claim:** 0 golden fields and 0 frozen-test changes: every Moodle or standard `PUT …/platform` body in the portal, golden capture, and frozen suites sends only the six documented keys.
- **My check:** my `grep` of `PUT …/platform` calls in `tests/acceptance`, `tests/e2e` and `tests/ltiaas/golden` finds the listed six-key bodies:
  - `T4b1/1-connect.spec.ts:130,134` (`{ ...six, jwksUrl: evil }` is still six keys);
  - `T4b1/3-security.spec.ts:116`, `T4b1/4-adoption.spec.ts:54,65,75`;
  - the two M1 Canvas self-platform bodies (`61-canvas-containment.test.ts:156`, `41-canvas-grades.test.ts:89`).

  The other hits are Canvas and Blackboard grant bodies (already strict in M1) or `{}` refusals. No frozen test sends an extra key to a Moodle body and expects `200`. The list is complete.

## LA-IC-18 — APPROVE (1 NIT)

Reviewer-B2 (same lens B), in a later dispatch. List: `tests/ltiaas/golden/expected/LA-IC-18.json` (QA-E2E, commit `f973e21`). Design: LA-ADR-04 D8 row LA-IC-18 (`:149`), A1 BD-A1-50. I did not open any reviewer-a file. I did not run Docker.

- **Claim:** The three visible LA-E1-11 changes are listed, with 0 golden fields and 0 frozen-test changes:
  - (a) the publish modal names the connection's LMS;
  - (b) the Connect-page logo uses the card colour;
  - (c) the logo has a `title`.
- **Can a later reader tell what changed?** Yes, in two steps:
  - `ld9.design[0]` links to the LA-ADR-04 D8 table. Its LA-IC-18 row states each change with "before" and "after" (for example "before: 'Moodle' for every LMS"; "Blackboard: blue, as on its card; before: red there").
  - `scanResult` names the code for each change: `PublishDialog` `lmsNames[…]`, `Connect.tsx` → `manifest.card.color`, and `IntegrationLogo` `title={name}`.
- **Can a later reader tell why no test moved?** Yes. `scanResult` gives one reason per change, and `scanChecked` lists 18 files with exact line ranges, so the scan can be repeated. My own scans agree:
  - (a) `grep -i "published to|content picker"` in `tests/e2e`, `tests/acceptance`, `tests/host` and `tests/ltiaas/golden` finds only comments, and no assertion on the dialog text.
  - (b) No test in `tests/e2e` or `tests/acceptance` looks at a logo colour class or the logo component.
  - (c) The only `getByTitle` uses are in `tests/e2e/lib/moodle.ts:192` and `:303`, and they target Moodle's own tool card, not the portal logo.
  - The golden capture records API DTOs, simulator records and tool pages, not portal components (`capture.golden.ts` ranges in `scanChecked`).
- **Format:** The keys are the same as in LA-IC-17 (`goldenFields`, `testChanges`, `frozenTestsTouched`, `scanChecked`, `scanResult`), and `approval` points to `docs/reviews/LA-E1-11/qa.md`, which names LA-IC-18. The restored "Open {LMS}" button of BD-A1-50 is correctly not listed, because it returns to the baseline.

### B-LD9-03 — NIT — The three changes exist in the JSON only inside one long `scanResult` string

- **File:** `tests/ltiaas/golden/expected/LA-IC-18.json:34` (`scanResult`, about 1,050 characters, with (a), (b) and (c) inline); `:36` (`"changes": []`).
- **Problem:** A reader of the JSON alone sees `goldenFields: []`, `testChanges: []` and `changes: []`. To learn what the three visible changes are, the reader must parse one long sentence, or open the ADR row. LA-IC-17 has one change, so one sentence works there. This list has three.
- **Suggested fix:** Split `scanResult` into one entry per change. For example, a `visibleChanges` array with `{ id: "a", what, before, after, code, whyNoTestMoved }`. Or keep the string and add one short `summary` line: "(a) publish modal LMS name, (b) Connect-page logo colour, (c) logo title; no assertion reads any of them." Apply the same shape to later multi-change lists.

## Not checked

- The G4 picker text change of LA-E3-05 (pending; a new list round when it lands).

## Round 2

## LA-IC-13, LA-IC-15 and NIT checks

Reviewer-B: Codex GPT-6-Astra xhigh, same ownership lens. Reviewed `aa3b214` in a private `git clone --no-hardlinks`, against plan §6.1 LD-9, LA-ADR-04 D8, the LA-E3-12 and LA-E4-03 changes (`a2dfc04`, `a285bdb`), and the earlier findings above. No Reviewer-A file was opened. Only this review file changed in the integration worktree; no Docker, stack, commit or frozen-test edit.

| List | Verdict | Current findings / follow-up |
| --- | --- | --- |
| LA-IC-13 | **APPROVE** | 1 new MINOR, B-LD9-04: correct the scan and source descriptions |
| LA-IC-15 | **APPROVE** | 1 new MINOR, B-LD9-05: correct the design and test references |
| LA-IC-12 | **APPROVE** | Approval-path update checked; no new finding |
| LA-IC-16 | **APPROVE** | B-LD9-01 and B-LD9-02 closed |
| LA-IC-17 | **APPROVE** | Corrected capture range and explanation checked; no new finding |
| LA-IC-18 | **APPROVE** | Index rows added; B-LD9-03 remains open (NIT) |

### Verification

- `node --test tests/ltiaas/golden/golden.k0.test.mjs`: **12/12 passed** at `aa3b214`. Restoring the pre-change comparator in the private clone made the new opt-in assertion fail: **11 passed, 1 failed**, with `Without LA-IC-16 in expected, allowlist diff must not be auto-explained`. The comparator was restored after the check.
- **15 independent checks passed** against the stored G-BASE capture and the real JSON delta files. LA-IC-15 accepts the two exact replacements. It rejects an omitted expected file, one missing replacement, the wrong channel name, a changed error prefix, another field, and an additional Moodle or third-channel `lastError` change. The Moodle and third-channel cases use explicitly synthetic paired fixtures because G3 has only Blackboard and Canvas. The CLI reports the extra field by its exact path and exits 1. LA-IC-13 authorizes no changed field. LA-IC-16 does not explain a change without its delta file, even when `simHosts` is supplied as an option.
- Source scans covered `tests/acceptance`, `tests/e2e`, the simulator launch builder, and the golden capture. Neither product merge changes a `tests/**` file. This is a host-only comparison and source review, not a fresh live G1–G4 capture or M1/M2/K2 run. There is no `tests/e2e/ltiaas/` K2 suite at the reviewed SHA; the LA-E1-11 QA report still marks K2 U1/U2 pending. Existing U1/U2 and M2 source checks were inspected, without claiming that pending K2 work passed.

### LA-IC-13 — zero golden and frozen-test changes confirmed

The captured score requests use numeric values; the baseline simulator launch builder supplies one client-id audience and NRPS `service_versions: ['2.0']` (`tests/sim/core/provider.mjs:66,76`). The capture does not record a platform DTO, so its additional `trustedAudiences` property is not a golden field. Registration helpers do call `/api/platforms`; the distinction is that their whole DTO is not captured or asserted. Frozen platform tests read selected properties. I found no frozen assertion that expects rejection of `scoreGiven: null` or success for a non-2.0 NRPS version.

One existing negative audience test **does** send an untrusted second audience: `tests/acceptance/T2b/qa-platform.test.ts:82-90`. It removes `azp` and already expects `INVALID_ISSUER_OR_AUDIENCE`; the new check preserves that answer. Thus no frozen assertion needs to change, but the record's explanation of this case must be corrected. The six Author test filenames match `git diff a2dfc04^1 a2dfc04 --name-only`.

### B-LD9-04 — MINOR — LA-IC-13 records incorrect evidence for a correct zero-change conclusion

- **File:** `tests/ltiaas/golden/expected/LA-IC-13.json:8` (design links), `:16` (Author test descriptions), `:30` (scan descriptions), `:44` (summary); the no-extra-audience claim is repeated in TEST-STRATEGY §4.7 and golden README §5.
- **Problem:** A maintainer cannot reproduce several claims from the cited source. The comparison is safe because `changes` is empty, and the independent scan supports zero changed assertions; these are evidence and navigation defects, safe to defer.
- **Evidence:** `:35` says T2b does not use a multi-audience array, although `qa-platform.test.ts:87` explicitly does. The cited M1 score tests send `7/10` and exercise upstream `400/422 PLATFORM_REJECTED_REQUEST`, not `11/10 -> INVALID_SCORE`. T3a's cited range tests line-item isolation and authorization, not the claimed negative/NaN/boolean/string score table. The DTO is `trustedAudiences`, not `trusted_audiences`; check 5 reports `INVALID_ISSUER_OR_AUDIENCE`, not `INVALID_ID_TOKEN`; `ags.test.ts:8-16` tests `parseScore`, not an HTTP `200 ok:true` answer. The ADR-07 filename does not exist, and the ADR-05/contract anchors do not name the actual headings.
- **Suggested fix:** Rebuild each description from the cited lines. Explain that the existing two-audience case remains negative because `azp` is absent. Use LA-ADR-05 `#d10-small-spec-gaps-could`, `LA-ADR-07-security-and-tenancy.md#d8-trusted-audiences-could`, and the actual contract headings (§4.3 Scores / §3.6, §4.4 Memberships / §3.7, §4.6 Platforms / §3.9 and §9.4). Correct the test/API names and propagate the qualified audience claim to both index rows; keep `changes: []`.

### LA-IC-15 — exactly two golden changes confirmed

The full new values match the two G3 `B-conflict.results[0].scoreSyncs[0].lastError` paths, with no wildcard or broad string rule. Baseline G3 has exactly two occurrences of the old Moodle suffix (`G3.json:363,1076`); the conflict status DTOs in G4 omit `lastError` (`G4.json:121-136,312-327`). The capture reads the results after the conflict and leaves G4 status unchanged.

T6's Moodle text assertion remains valid, and T5b checks `PLATFORM_CONFLICT` on a Moodle row. M1's named tests exercise 400/422 failures; M2's named result flows test sent rows. The reporter constructs the suffix from the channel text name (`services/cogniate-app/src/drivers/lti-ags/index.ts:70`), and its unit table includes the unchanged Moodle string alongside Canvas and Blackboard (`reporter.test.ts:55-57`). No additional frozen assertion change is needed.

### B-LD9-05 — MINOR — LA-IC-15 sends maintainers to the wrong decision and test evidence

- **File:** `tests/ltiaas/golden/expected/LA-IC-15.json:8`, `:16`, `:28`; `tests/ltiaas/TEST-STRATEGY.md:451`; golden README §5 LA-IC-15 row.
- **Problem:** The exact delta is correct, but the supporting references misidentify the authorizing decision, the changed test, and the captured lines.
- **Evidence:** `BD-A1-21` concerns the `ProfileSource` type import. **BD-A1-27** authorizes this conflict-text change; the strategy diff replaces that correct number with 21. `packages/tracking/src/tracking.test.ts` did not gain `recordRuntimeScore`/optional `lmsName` coverage in `a285bdb`: its change replaces `syncResult` cases with `dispatchResult` cases, and the named function is absent. The JSON cites G3 lines 93/315 and G4 lines 45–56/144–155; the actual conflict locations at the reviewed SHA are G3 363/1076 and G4 121–136/312–327.
- **Suggested fix:** Restore BD-A1-27 in the JSON and both indexes; describe the tracking policy test change accurately or omit it from the conflict-text evidence. Keep `reporter.test.ts` as the direct channel-name test, and correct the capture references (or use the stable JSON paths already present in `goldenFields`). No change to the two expected values is required.

### Earlier NIT and metadata checks

- **B-LD9-01 closed:** `compareCaptures` now explains the allowlist only through a supplied expected-delta entry. Both the regression test and the old-comparator failure prove this. Other allowlists, non-simulator order, duplicate hosts and unlisted hosts remain strict in the passing suite.
- **B-LD9-02 closed:** LA-IC-16 now lists eight scan locations and a result. The referenced health checks read status/profile/knobs rather than allowlist contents; an independent search found no frozen `outbound_allowlist` assertion.
- **LA-IC-12 / LA-IC-16 approval-path follow-up closed:** the updated strings name existing review files, including this LD-9 review. I checked path existence only for Reviewer-A targets and did not inspect their contents or infer their verdicts.
- **LA-IC-17 scan-range follow-up closed:** `capture.golden.ts:194-200` creates pending Moodle connections without an app platform PUT; `acceptance/lib/qa-platform.ts:43` registers the QA platform directly. The revised explanation now states this distinction.
- **LA-IC-18 index-row follow-up closed, B-LD9-03 still open:** TEST-STRATEGY §4.7 and golden README §5 now list all three visible changes and explain why no assertion moves. However, `aa3b214` does not change `LA-IC-18.json`; its three changes are still buried in the same long `scanResult`, without the short summary or separate entries requested by B-LD9-03. This remains a non-blocking NIT, not a new finding.

## Round 3

## LA-IC-19

Verdict: **APPROVE — 1 new MINOR (B-LD9-06), 0 BLOCKER/MAJOR.** Reviewed `04af91d`, LA-ADR-04 D8 / BD-A1-57 and the LA-E1-09 runtime text change. Same Reviewer-B lens; no Reviewer-A file was opened. Earlier LD-9 findings retain their round-2 status.

The **0 golden / 0 frozen-test changes** conclusion holds. The record gives twelve scan locations, the shipping commit, the affected description and the reason Moodle stays unchanged. `T5a/6-negative.spec.ts:75-84` is the only frozen runtime-expiry case found: it launches Moodle and checks status 410 plus `RUNTIME_EXPIRED`, not the description. The other cited runtime helpers and M1/M2 flows exercise active sessions. The golden capture records no `RUNTIME_EXPIRED` response; the similar Moodle text in G4 belongs to other error codes and must not be changed by this list. No existing frozen assertion needs a rewrite.

Host-only verification in the private `deef75e` clone: **12/12 golden K0 tests** and **11/11 `lms-texts.test.ts` tests** pass. An independent comparison with only LA-IC-19 passes for an unchanged capture and rejects an altered G4 refusal action as an unexplained difference, confirming that `changes: []` authorizes nothing. The T5 runner was read only; no Docker, stack, host stack runner, live capture or browser suite was run. A named K2 suite is not present at this SHA, so the scan of existing frozen sources is not a K2 execution result.

### B-LD9-06 — MINOR — Correct the runtime route and test-coverage descriptions

- **File:** `tests/ltiaas/TEST-STRATEGY.md:455`; `tests/ltiaas/golden/expected/LA-IC-19.json:9`, `:13`, `:34`.
- **Problem:** The list is repeatable and its empty delta is correct, but its supporting description overstates which route returns 410 and which channel names the Author test asserts.
- **Evidence:** The strategy includes `GET /rt/{token}` in the changed 410-body routes. That route deliberately returns **404 HTML** for an expired token (`content-host/server.ts:189-191`); only state GET and commit POST use the 410 JSON helper. The existing unit test explicitly expects the expired root route to remain 404. The JSON says the cited Author test asserts Moodle, Canvas, Blackboard and custom-name expiry bodies, but `lms-texts.test.ts:102-124` asserts only Moodle and the custom `your LMS` channel. Its ADR-01 anchor `#d12-lms-display-names-in-core-text-must` also does not exist; the heading is `D12. Texts`.
- **Suggested fix:** Describe only `GET /rt/{token}/state` and `POST /rt/{token}/commit` as the changed 410 JSON routes, and state that the root route retains its 404 response. Describe the actual Moodle/custom-channel checks without claiming extra assertions, and use `#d12-texts`. Keep `changes: []` and the frozen-test count at zero; no product change or additional baseline waiver is needed.

## Round 4

## LA-IC-20

Verdict: **APPROVE — 0 BLOCKER, 0 MAJOR, 0 MINOR, 1 NIT (B-LD9-07).** Same Reviewer-B ownership lens, Codex GPT-6-Astra xhigh. Reviewed the LA-IC-20 record and its K0 check in `b3807f4`, plus the LA-IC-18 split in `1babba9`, against plan §6.1 LD-9, LA-ADR-04 D8 and BD-A1-63/69. Pinned verification: `d768eec`. No Reviewer-A file was opened; no Docker, stack, live capture or browser acceptance suite was run.

The **0 golden / 0 frozen-test changes** conclusion is supported. The record names the five error keys, their exact generic replacements and which baseline manifests retain the old bytes. The old helper used the same Canvas/Blackboard wording for every channel; the new helper selects manifest text, then falls back to generic text:

| Channel | Keys that keep their old text | Keys that now use generic text |
| --- | --- | --- |
| Moodle | `SITE_RULE_1` | `SITE_RULE_5`, `PLATFORM_IN_USE`, `DEPLOYMENT_IN_USE`, `DEPLOYMENT_FIXED` |
| Canvas | `SITE_RULE_1`, `SITE_RULE_5`, `PLATFORM_IN_USE` | `DEPLOYMENT_IN_USE`, `DEPLOYMENT_FIXED` |
| Blackboard | `SITE_RULE_1`, `DEPLOYMENT_IN_USE`, `DEPLOYMENT_FIXED` | `SITE_RULE_5`, `PLATFORM_IN_USE` |
| No channel, or a channel without error overrides | None | All five |

My independent frozen-suite scan agrees with the record. M2 checks site rules 1/5 and `PLATFORM_IN_USE` on Canvas, and `DEPLOYMENT_IN_USE` on Blackboard, so those exact strings stay valid. T4b1 and M1 check API codes; T6's invalid-platform case checks an inline error without matching its wording. G1–G4 capture API data and tool/player pages, not these portal notices. `ChannelScope` wraps both connect-route slots, and the author tests cover create and manage routes. The reviewed LD-9 changes touch QA metadata and the golden unit test, with no frozen assertion, comparator relaxation or new product branch.

### B-LD9-07 — NIT — Correct the inline-error helper citation

- **File:** `tests/ltiaas/golden/expected/LA-IC-20.json:34`; repeated in TEST-STRATEGY §4.7 and golden README §5.
- **Problem/evidence:** The scan cites `tests/acceptance/lib/portal.ts:89-99` for `hasInlineError`, but those lines contain the colour helpers. `hasInlineError` is at lines **177–181**, both at `b3807f4` and the reviewed HEAD. Its implementation supports the stated conclusion: it counts invalid fields and nonempty alerts without matching provider-error text. Only navigation is wrong.
- **Suggested fix:** Change the range to `177-181` in the record and both indexes; keep the function name and the zero-change conclusion.

### LA-IC-18 follow-up and verification

- **B-LD9-03 closed.** `1babba9` adds a short summary and three `visibleChanges` entries, each with what changed, before/after values, source location and why no assertion moves. The publish modal, logo colour and logo title are now independently readable. The empty delta is unchanged. Other earlier findings are outside this dispatch and retain their last reviewed status.
- In a private `git clone --no-hardlinks`: **12/12 golden K0 tests** and **100/100 author tests across all seven files named by LA-IC-20 passed**. Six independent comparator checks confirmed that LA-IC-18 and LA-IC-20 each accept the unchanged stored capture and reject an altered API issuer or G4 string.
- Restoring only the pre-`8e061ce` provider-error helper made **six of its seven new tests fail**, covering all three baseline channels, the generic fallback, placeholder filling and context-bound notices. The unchanged generic-independent text test still passed. The source was restored and the private clone was clean. This verifies the listed unit evidence; it does not claim execution of M2, T6 or K2.

## Round 5

Reviewed the three records and their index/golden-test changes in `19da95e`, merged at `4d08fc1`, against LA-ADR-04 D8, the cited BD decisions and source at `326ceae`. Same Reviewer-B lens; blind review. **CHANGES_REQUESTED: 1 MAJOR and 1 MINOR, no new BLOCKER or NIT.** B-LD9-07 is closed; earlier findings outside this dispatch retain their last reviewed status.

### LA-IC-03 — CHANGES_REQUESTED

The empty golden and frozen-test lists are supported: G1 leaves Moodle connections pending; G2–G4 use Canvas/Blackboard; the frozen real-Moodle DR flows use the expected endpoint. T3b's foreign-issuer negative case fails before its missing Deep Linking message matters. The NRPS task-fixture correction is named and its issuer/path change is present in `18fa1d3` / `dbc80e9`. However, the additional task-suite impact scan is incomplete.

#### B-LD9-08 — MAJOR — A query-bearing simulator fixture is incorrectly marked unaffected

- **File:** `tests/ltiaas/golden/expected/LA-IC-03.json:39`, repeated in `scanResult` at line 43; both index summaries also omit this fixture impact.
- **Problem:** The record says the LA-E5-06 fixture is unchanged because its URL pathname matches the required endpoint, but the product compares the full configuration URL. This omits an affected positive QA flow from the impact inventory.
- **Evidence:** At `326ceae`, `tests/sim/core/runtime.mjs:304` returns `…/mod/lti/openid-configuration.php?scenario=…`; `protocol-wiring.k1sim.test.ts:161–168` uses that URL and lines 435–449 complete with the default `standard` profile, expecting success. `services/lti-service/src/lti/registration.ts:81` compares the full string with `issuer + configurationPath`; `http/routes/registration.ts:314` applies this exact rule at completion. A private route probe confirmed **303 start, then 400 `INVALID_REQUEST` / `configuration_path_mismatch`** with the query; the otherwise identical query-free URL completed with 200. The relevant parser and route code is identical at the test pin and `326ceae`. This is host-only evidence, not a SIM run.
- **Suggested fix:** Mark the LA-E5-06 fixture as affected/pending and name its QA owner and follow-up, or cite its verified correction. Correct the record and both indexes; retain the supported zero golden/frozen changes. Describe start versus completion separately: with a broader DR profile loaded, a wrong-path configuration can start and then fail the exact `standard` rule at completion, rather than always failing at start with `ISSUER_MISMATCH`.

### LA-IC-20 — APPROVE

BD-A1-81 is now reflected correctly: Moodle `PLATFORM_IN_USE` keeps the server collision sentence through its manifest. This supersedes that cell of the round-4 table; Moodle's other missing keys still use generic text. The manifest equality test and portal notice tests pass. Frozen M2 checks still target the channels that own the expected wording; T4b1 asserts the API code, and T6 checks error presence. **B-LD9-07 closed:** `176–181` includes the `hasInlineError` comment and implementation in the record and both indexes; the golden metadata test checks the corrected citation. BD-A1-102 explicitly requires no further LD-9 entry for its cause-specific `details.reason` exception because baseline answers do not carry it; it does not invalidate this baseline delta.

### LA-IC-21 — APPROVE with 1 MINOR

The stated API change matches BD-A1-93/BD-A2-86 and the shared update helper: a staged update becomes inactive, other updates preserve stored `active`, and creation alone uses `autoActivate`. T3b AC-T3-03 establishes `active === true` at line 89 before AC-T3-26 updates that same platform. No frozen inactive-update case was found, and the golden capture never calls registration completion. The empty delta is justified.

#### B-LD9-09 — MINOR — The cited task suite is described as completing registrations that it does not complete

- **File:** `tests/ltiaas/golden/expected/LA-IC-21.json:31`; related coverage claim in `LA-IC-03.json:41`.
- **Problem/evidence:** The record calls `dynamic-registration.k1sim.test.ts:150–310` evidence of new and staged registration completion. At `326ceae`, its valid path case only starts and reads a session (lines 233–255); its completion calls exercise refusals. The staging case creates an inactive platform directly through `POST /api/platforms` (lines 308–326), then checks login refusal. It does not prove successful staged completion. The LA-IC-03 claim that this range directly tests all AC-01 through AC-08 is also too broad.
- **Suggested fix:** Describe the actual start/view, refusal and direct-platform setup checks, using the correct ranges. Keep the route unit tests as the evidence for update/creation behavior and the T3b scan as the reason no frozen assertion moves. This metadata correction is safe to defer; it does not alter the empty delta.

### Round-5 verification and limits

- Fresh private `git clone --no-hardlinks` at `4d08fc1`, with its own `npm ci`; Vitest cache removed before each run. **12/12 golden K0 tests** and **144/144 author tests across seven files** passed. The latter cover registration parsing/routes/store/codes, manifest validation, portal error text and channel shell behavior.
- **Nine independent comparator checks passed:** each of the three empty records accepts the stored capture and rejects changes to an existing G1 issuer and G4 page text. No comparator rule or frozen assertion changes in this dispatch.
- The query probe had **one expected failure and one passing control**; it was removed before the clean author-suite run. Logs: `/tmp/reviewer-b-ld9r5-{golden,author,query-probe}.log`. Independent frozen-source scans confirmed the cited T3b update and mismatch cases.
- No Docker, stack, browser acceptance or live capture was run. The private clone was restored, checked clean and removed. Only this review file changed in integration; no commit was made. Lead QA should correct the affected-fixture inventory and request the next list review; SIM/live validation remains separate.

## Round 6

Reviewed the five records at **`b40c789`**, including merges `d41b8d2` and `b40c789`, against plan §6.1 LD-9, LA-ADR-04 D8, the cited design decisions, product code and affected fixture sources. Same Reviewer-B ownership lens, Codex GPT-6-Astra xhigh; blind review. **CHANGES_REQUESTED: 1 new MAJOR, 1 new MINOR and 1 new NIT; no new BLOCKER.** Only this review file was edited in integration.

| Record | Verdict | Findings / previous-round status |
| --- | --- | --- |
| LA-IC-03 | **APPROVE** | B-LD9-08 closed at the impact-list level; fixture correction still pending at this pin |
| LA-IC-04 | **APPROVE** | B-LD9-11 MINOR: correct the coverage and source descriptions |
| LA-IC-14 | **APPROVE** | Exact 13-field delta and three affected frozen cases confirmed |
| LA-IC-12 | **APPROVE** | B-LD9-12 NIT: update the stale future-work summary |
| LA-IC-01 | **CHANGES_REQUESTED** | B-LD9-10 MAJOR: type-only rules accept incorrect channel values |

### LA-IC-03 — APPROVE

**B-LD9-08 closed:** the record and both indexes now identify the query-bearing LA-E5-06 fixture, its QA-4 owner and the required query-free configuration URL. The start/complete distinction is correct: another loaded DR profile may accept start, while completion with `standard` enforces the full URL. The zero golden/frozen-change conclusion remains supported by the scanned T3b, T4b1, U1 and capture paths.

This closes the inventory defect, **not the simulator fixture repair**. At `b40c789`, `tests/ltiaas/tasks-lti/LA-E5-06/protocol-wiring.k1sim.test.ts:161-163` still takes `reg.openidConfiguration` or the query-bearing fallback. The JSON correctly marks that work pending. I did not verify a later QA-4 correction or run SIM.

The LA-IC-03 part of **B-LD9-09** is also corrected: its range now distinguishes start/view, completion refusals and direct platform setup. The separate incorrect completion claim in `LA-IC-21.json:31` remains outside this dispatch and retains its round-5 MINOR status.

### LA-IC-04 — APPROVE with 1 MINOR

The three exact changes are correct: remove the fifth scope from each Canvas JSON form, and replace Moodle manual row 13 with `Do not use this service`. The other fifteen Moodle rows and the four AGS scopes stay pinned. The three affected frozen files are correctly identified: M1 Canvas JSON assertions, M1 Moodle's full row-value assertion, and T4b1's full row tuples. T6, U2 and M2 copy/read live values; direct service registration keeps its separate five-scope fallback. No additional frozen change was found in the scanned acceptance/e2e sources.

#### B-LD9-11 — MINOR — The record claims simulator assertions that the cited file does not contain

- **File:** `tests/ltiaas/golden/expected/LA-IC-04.json:26`; related descriptions at lines 20, 36, 43 and 51; repeated M1 citation in TEST-STRATEGY §4.7 and golden README §5.
- **Problem:** The exact delta is safe, but a maintainer following the coverage inventory will mistake a placeholder for implemented verification.
- **Evidence:** `tasks-core/LA-E3-07/nrps-scopes.k1sim.test.ts:12-18` only asserts `LA_DOCKER_WINDOW === '1'`; it performs no G1 comparison, configuration request, row check or DR scope assertion. The cited Moodle Author test checks row 13, not `registration.scopes`. LA-E2-02's completion calls are negative cases, not evidence of successful five-scope fallback. M1's full Moodle row assertion is at `common/00-profiles.test.ts:115-130`, not `93-108`.
- **Suggested fix:** Mark the simulator file as a placeholder/pending implementation and name the actual unit or LA-E3-06 assertions that support scope behavior. Correct the Moodle Author-test description and M1 range in the record and both indexes. Keep the three golden changes and affected frozen-file list unchanged; a source scan is not a SIM result.

### LA-IC-14 — APPROVE

The record precisely lists **12 G1 changes and one G3 change**: the three Canvas provider projections each gain the dynamic method and true legacy flag; six G1 Canvas connection DTOs and the G3 Canvas connection flip that flag. The exact values reject another channel's flag change and a reordered methods array. D8 and the Canvas DR decisions authorize these changes; the current manifest/registry and staged-registration tests agree.

The three M1 cases at `canvas/11-canvas-platforms.test.ts:218-265` are the affected frozen assertions: connection capabilities, the old dynamic-create refusal, and provider methods/capabilities. Updating the refusal case also requires changing its “stores nothing” expectation to the accepted pending connection behavior. The record names this case and its new 201/registration-URL outcome. The shared K0 oracle is updated; the task-specific LA-E1-02 oracle at `registry.k0.test.ts:80-87,181-203` is still old at this pin and is explicitly listed as affected. This list approval does not claim that old fixture or the frozen M1 suite now passes. Their QA updates and live validation remain follow-up work.

### LA-IC-12 — APPROVE with 1 NIT

Both full G4 strings equal the stored baseline text plus ` Cancel`, and match the normalized slot-3A capture. The add button remains first, followed by a separate Cancel form; the frozen helpers select the first submit button or the exact `Add to Moodle` name. The inspected service tests do not assert the old empty-list rejection or whole-token equality. No frozen assertion change is needed.

#### B-LD9-12 — NIT — The summary still says the two shipped picker changes are future work

- **File:** `tests/ltiaas/golden/expected/LA-IC-12.json:34-36`; `tests/ltiaas/golden/README.md:133`.
- **Problem/evidence:** `goldenFields` and `changes` now contain two G4 replacements, but the scan text still says “when it lands” / “will add”; the README still describes `changes: []`. A later reader gets different current counts from the JSON and its index.
- **Suggested fix:** State that LA-E3-05 contributes the two listed picker replacements, retain the separate zero-change statement for the service part, and add the picker source/test citation. Update the README to two golden changes and zero frozen changes.

### LA-IC-01 — CHANGES_REQUESTED

#### B-LD9-10 — MAJOR — Type-only wildcard rules silently approve wrong channel data

- **File:** `tests/ltiaas/golden/expected/LA-IC-01.json:7-23`, `:417-438`, `:925-951` (with matching rules in the other provider/connection views).
- **Problem:** LD-9 requires the intended values to be reviewable; TEST-STRATEGY §4.7 specifically requires each new baseline-channel field and its value. `string`, `object`, `array` and `present` rules only check type/presence. They therefore waive incorrect identity, authority, endpoint policy and capabilities, even when the recorded comparison says EQUAL. A team cannot use this record as the stated regression gate.
- **Evidence:** I replayed the actual normalized slot-3A capture against G-BASE with its eleven expected records: **EQUAL, 264 differences, zero missing**. Independently changing each of the following still produced EQUAL with **zero unexplained and zero missing changes**: Moodle provider `channel = 'wrong-channel'`; its `channelCapabilities = {}`; Canvas connected DTO `bindingAuthority = 'self'`; first default profile `endpointOrigins = 42`; Moodle provider `registration = []`. These are single-field mutations of the real capture, not synthetic replacement baselines. The new real IC-01 record is absent from the combined golden K0 case, so the twelve passing tests do not reject these defects.
- **Suggested fix:** Pin exact values per captured channel/profile, or use narrow semantic rules that enforce those values and the permitted additions. Preserve IC-14's Canvas dynamic-registration interaction explicitly. Add negative controls for the five incorrect values and include the real IC-01 record in combined comparison coverage. Give IC-01 the same design, exact-field and affected-fixture/scan metadata as the other LD-9 records so another team can reproduce its 97-entry list without reverse-engineering the capture. Keep baseline fields strict.

### Round-6 verification and limits

- Fresh private `git clone --no-hardlinks` at `b40c789`, own `npm ci`; Vitest cache removed before the run. **12/12 golden K0 tests** and **100/100 Author tests in six files** passed: Canvas configuration, Moodle tool rows, app Canvas export, app connection/DR, kernel registry and staged registration.
- **18 independent comparator checks passed** for IC-04, IC-12 and IC-14: exact deltas accepted; missing expected changes, omitted records, extra fields, wrong values/order and nearby unauthorized changes rejected. The five IC-01 invalid-value probes exposed the MAJOR above. Logs and probe sources: `/tmp/reviewer-b-ld9r6-{golden,author,controls,comparator}.log`, `/tmp/reviewer-b-ld9r6-controls.mjs`, `/tmp/reviewer-b-ld9r6-ic01-probe.mjs`.
- Slot-3A replay used the stored `golden-cand-port9443` artifacts from the LA-E7-08 QA run. That capture predates IC-04/IC-14; their checks here use explicit expected-delta fixtures, not a later live capture. The wave-end live comparison remains pending.
- No Docker, stack, host stack runner, browser suite, frozen-test edit or commit. Reviewed changes stay in QA-owned files and introduce no product-core LMS branch. No tracked source mutation was needed; the private clone was checked clean and removed. Earlier findings not explicitly closed above retain their prior status.

## Round 7

Reviewed `7db4f2c5` / `e085b16e` against plan §6.1 LD-9, LA-ADR-04 D8, the named product decisions and the round-6 findings. Same Reviewer-B ownership lens; blind review. **CHANGES_REQUESTED: 1 new MAJOR (B-LD9-13), 1 new MINOR (B-LD9-14), no new BLOCKER or NIT.** The exact-value golden rules are now sound; the remaining blocking issue is the new frozen-fixture inventory.

### Previous findings and exact-value checks

- **B-LD9-10 closed.** All 259 IC-01 paths have exact values and no wildcard/type-only rule. The new K0 case includes the actual record, its standalone comparison, the combined 13-record comparison and ten negative controls. I independently rebuilt the changed fields from current product code: real `/api/providers` and `/app-api/lms-providers` handlers through in-memory test harnesses, `connectionJson`, Canvas configuration and Moodle row helpers. Keeping the stored capture's unchanged fields and shared-platform state yielded **EQUAL: 280 explained differences, zero missing**. This confirms Brightspace dynamic/manual registration, Canvas dynamic registration, the two enabled connection-check capabilities, the four AGS scopes and profile-dependent connection capabilities without constructing the candidate from the expected entries.
- The **five round-6 mutations now all fail**: wrong Moodle channel, empty capabilities, wrong Canvas authority, numeric endpoint origins and empty registration methods. Missing channel on one provider, missing channel on one connection and an extra capability also fail. In five separate in-memory delta mutations, replacing just the affected exact value with its former type-only rule made the incorrect value pass again while the correct answer still passed. An unrelated baseline issuer change remains unexplained and fails.
- **B-LD9-09 closed.** IC-21 now describes the actual LA-E2-02 start/view, refusal and direct-platform cases. IC-03's matching correction was already checked in round 6.
- **B-LD9-11 closed:** the original coverage overstatement and wrong M1 range are corrected. IC-04 identifies the simulator test as a placeholder, separates the Moodle row assertion from scope coverage, cites the real fallback test and points to M1 lines 115–130. A newly added description of its gate is still inaccurate; this is included in B-LD9-14 below.
- **B-LD9-12 closed.** IC-12 and both indexes now report the two shipped G4 picker replacements, zero frozen changes and the app picker test sources. The exact replacements are unchanged.
- **IC-03 and IC-14 retain APPROVE.** The IC-03 fixture repair is now present: `a27a5607` / `d12b7b94` supplies the path-prefix issuer and builds the query-free configuration URL. IC-14 corrects the snapshot-file description and explains the Canvas form's manual default after the method selector landed. These are source checks, not a new SIM/M1 run. B-LD9-08 remains closed.

### B-LD9-13 — MAJOR — IC-01 declares the required frozen-test rewrite landed, but the reviewed tree still has the old assertions

- **File:** `tests/ltiaas/golden/expected/LA-IC-01.json:302-313`, especially lines 305–307 and 313; repeated in `tests/ltiaas/golden/README.md:131`.
- **Problem:** The record justifies zero affected frozen tests by saying all eight LD-1 rewrites landed before G-BASE in LA-E0-02. That is not the state of either G-BASE or `7db4f2c5`. A maintainer following this list will miss a required regression-suite dependency and expect the current provider answers to pass frozen tests that still reject them.
- **Evidence:** `M1/common/00-profiles.test.ts:41-46` removes only `label` and `sharedPlatform` before whole-list equality, so the new fields and profiles fail. `tests/host/run-m1.mjs:296` still requires exactly six profiles; current default output has eight. `M1/canvas/11-canvas-platforms.test.ts:255` still requires exactly the three baseline LMS ids; current output has five. I executed these assertion shapes against G-BASE and independently obtained current product answers: **all three baseline controls pass and all three current-answer controls fail**. The six frozen paths named in the metadata have no diff between G-BASE and the reviewed pin. The separate rewrite commit `f0a7b306` is not an ancestor of `7db4f2c5`; the board also records that rewrite as kept off integration pending approval. The rewrite owner task is **LA-E0-04**, while LA-E0-02 records the baseline.
- **Suggested fix:** Replace the landed/no-impact claim with the exact outstanding LD-1 assertions, their owner, rewrite commit/task and integration status. Distinguish “no additional IC-01 rewrite after LD-1” from “the frozen suite is already compatible.” Either cite the approved landed rewrite and rescan that pin, or explicitly retain LD-1 as a pending dependency in the JSON and indexes. This finding does not authorize unrelated frozen-test edits or require changing the now-correct 259 golden values.

### B-LD9-14 — MINOR — Several coverage references do not resolve to the tests they describe

- **File:** `tests/ltiaas/golden/expected/LA-IC-01.json:283-294`; related gate description in `LA-IC-04.json:26`.
- **Problem/evidence:** Six named test files do not exist at the reviewed pin: `packages/channels/lti-generic/channel.test.ts`, LA-E1-01's `golden-baseline.k1sim.test.ts`, LA-E1-06's two `connections.*.test.ts` files and LA-E2-03's two `lti-generic-app.*.test.ts` files. The existing QA paths are `LA-E1-01/golden-g1.k1sim.test.ts`, `LA-E1-06/{migration-013.k0,golden-g1.k1sim}.test.ts` and `LA-E2-03/lti-generic.{k0,k1sim}.test.ts`; their descriptions must match their actual scope. The provider-list and stored binding-authority tests are in app `connections.test.ts`, not the cited `connect.test.ts`. IC-04 now calls its placeholder `describe.skipIf(!process.env.LA_DOCKER_WINDOW)` gated, but the actual file uses plain `describe` and asserts that the environment variable equals `'1'`; setting it does not implement any simulator assertion.
- **Suggested fix:** Check each metadata path against the tree and describe the assertions actually present. Use the existing generic-channel test sources, distinguish pending golden binding/placeholder work from implemented coverage, and describe the IC-04 environment check literally. These navigation and coverage-description corrections are safe to defer; they do not weaken the exact delta.

### Round-7 verification and limits

- Private `git clone --no-hardlinks` at `7db4f2c5`, own `npm ci`; Vitest cache deleted before every run. **12/12 golden K0 tests passed**, including the ten new negative controls. The independent current-output probe passed with eight invalid-value/missing-field controls and three frozen-assertion baseline/current controls. Five additional mutations verified the sensitivity to the former type-only rules.
- Evidence: `/tmp/reviewer-b-ld9r7-golden.log`, `/tmp/reviewer-b-ld9r7-product-probe.log`, `/tmp/reviewer-b-ld9r7-product-probe.test.ts`, `/tmp/reviewer-b-ld9r7-current-result.json`, and `/tmp/reviewer-b-ld9r7-rule-controls.{mjs,log}`. The current-output probe retains unchanged fields from the normalized slot-3A capture; it is not a fresh full G1–G4 capture. The wave-end live comparison and frozen-suite execution remain separate.
- The nine changed files are within QA ownership; no comparator implementation, product core or frozen assertion changed in this review diff. No Docker, stack, host stack runner or commit. The private probe was removed, the clone was checked clean and deleted, and only this review file was edited in integration. Earlier findings outside the stated closures retain their prior status.

## Round 8

Reviewed `b796b1ec` against plan §6.1 LD-1/LD-9 and LA-ADR-04 D8. **APPROVE: B-LD9-13 and B-LD9-14 closed; 0 new BLOCKER, MAJOR or MINOR, 1 new NIT.** Same Reviewer-B lens; blind review.

- **B-LD9-13 closed.** IC-01 and both indexes now name the six pending frozen-file rewrites and two shared helpers, their LA-E0-04 ownership, `la-qa` commit `f0a7b306`, and the wave-end landing gate. They distinguish zero *additional* IC-01 edits after LD-1 from current compatibility. At the reviewed pin, all six files still equal G-BASE and `f0a7b306` is not an ancestor, so the pending status matches the tree. This approval does not claim the frozen suites already pass or approve unrelated rewrite changes.
- **B-LD9-14 closed.** All **31 file references in the 21 IC-01 coverage entries** exist. The corrected provider/binding-authority and generic-channel references identify the actual tests; the E1-01/E1-06 golden binding is explicitly pending. IC-04 correctly distinguishes the former plain-`describe` environment placeholder from the now-implemented JSON, Moodle-row and score-run assertions. IC-14 names the existing Canvas DR suites and `CanvasCreate.tsx` with its actual conditional manual default. The two range-end typos below do not reopen the missing-file/false-coverage finding.
- IC-01's 259 exact-value rules and the IC-04/IC-14 golden `changes` arrays are unchanged. Their prior value approvals remain valid. The seven-file diff stays in QA ownership and changes no product core, comparator implementation or frozen assertion.

### B-LD9-15 — NIT — Two citation ranges extend beyond the files

- **File:** `tests/ltiaas/golden/expected/LA-IC-01.json:281` and `:286`.
- **Problem/evidence:** At `b796b1ec`, `manifest.test.ts:9-170` ends beyond that file's 167 lines, and `lti-generic.test.ts:23-85` / the inner `:57-85` exceed its 77 lines. The files and starting lines are correct. The new K0 check validates file existence, not line bounds.
- **Suggested fix:** Correct the range ends to the current source (167 and 77 respectively). No comparator or test-harness change is needed.

Verification: fresh private `git clone --no-hardlinks` pinned to `b796b1ec`, own `npm ci`, then `node --test tests/ltiaas/golden/golden.k0.test.mjs`: **12/12 passed**. A nonexistent author-test path and a false landed-status mutation each failed the new metadata checks; after restoration, **12/12 passed** again. Independent git/source checks confirmed the pending rewrite, citation paths/ranges and unchanged exact golden rules. Logs: `/tmp/reviewer-b-ld9r8-{golden,missing-ref,false-landed,restored}.log`. The clone was checked clean and deleted; only this report changed in integration. No Vitest, Docker, stack, host stack runner or commit. LD-1 landing, the live G1–G4 comparison and frozen-suite execution remain pending wave-end work; earlier findings outside the stated closures retain their prior status.
