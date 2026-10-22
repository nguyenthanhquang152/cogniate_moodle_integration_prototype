Verdict: APPROVE
Round: 2

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
