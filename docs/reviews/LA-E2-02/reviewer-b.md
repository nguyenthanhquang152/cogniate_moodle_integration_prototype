Verdict: APPROVE
Round: 4

# LA-E2-02 review, Reviewer-B

## Round 1

Reviewer-B: Codex GPT-6-Astra xhigh. Date: 2026-10-23. Lens: "Can a human team own it?" Reviewed `7168908`, `ce0a506`, `ccddb68` and `9518f75` (merge `865c3d0`) against the task spec, LA-ADR-02 D2/D5, contract delta §4.5, BD-A1-55/59/68/77 and plan §6.1. Also checked the later BD-A1-84 clarification. Verification used a private `git clone --no-hardlinks` at `6d776696f6e0bd59590999c83a5b23b013879151`. No other reviewer's report was read; no Docker or stack was run.

Counts: **0 BLOCKER, 1 MAJOR, 2 MINOR, 0 NIT.**

### B-LA-E2-02-01 — MAJOR — Completion recovery still sends a non-Moodle admin to Moodle menus

- **File:** `services/lti-service/src/http/routes/registration.ts:345`, also lines 349, 356 and 359; shared route helper at line 66.
- **Problem:** A failed completion for a generic DR profile tells its administrator to delete a Moodle "Pending tool" in "Manage tools". This is a likely failure path where the remote write is uncertain, so the administrator needs usable recovery instructions before trying again.
- **Evidence:** Four private route probes use the `zz-generic` profile, its `ZZ DR` channel, an opaque token and otherwise valid configuration. A timeout, `401 token_already_used`, server error and malformed successful response each return `502 PLATFORM_ERROR`, reason `tool_may_exist`, and exactly: `Moodle may have saved a Pending tool. In Manage tools, delete the Pending tool 'Review tool', then connect again.` The chosen profile and `profileChannel` are already known at this point, but every path calls the context-free `pendingToolText`. This is distinct from the start-page limitation: BD-A1-84 allows no-context start pages, while AC-09 and D5 item 8 require channel-aware completion text.
- **Suggested fix:** Keep the frozen Moodle helper and its baseline wording unchanged. Add a neutral recovery path for new DR channels, or a channel-owned recovery sentence with a generic default, through A1/K's text contract. It should explain that the tool may already exist, name the tool, and give a safe next step without assuming Moodle menus. Add completion-error tests for a non-Moodle channel and retain the existing Moodle assertions.
- **Design coordination:** BD-A1-30/D12 freeze the text associated with `MOODLE_TOOL_MAY_EXIST`; they do not clearly define its use for a new generic DR flow. The coordinator reviewed this ambiguity and instructed me to report the observed defect now, with A1's clarification going to the lane L fix round. This finding does not authorize changing the frozen baseline text.

### B-LA-E2-02-02 — MINOR — Migration 021 omits the specified token-kind constraint

- **File:** `services/lti-service/src/db/migrations/021_registration_token_kind.sql:4`.
- **Problem:** `token_kind` is unconstrained `TEXT`, although BD-A1-77, the task notes and data-model §4.2 require `CHECK (token_kind IN ('scope-jwt', 'opaque-bearer'))`.
- **Evidence:** A private database probe successfully updates a real registration row to `opaque-bearre`. The store casts the value to the TypeScript union on read. The migration test proves NULL backfill and preservation of old columns, but does not test rejection of an unknown kind. Normal typed writers use valid values, so this is safe to defer.
- **Suggested fix:** Add the declared database constraint using the team's migration policy. Test both valid kinds and NULL, plus a rejected unknown value, while retaining the old-row preservation test.

### B-LA-E2-02-03 — MINOR — The completion family-guard test is stopped by an earlier rule

- **File:** `services/lti-service/src/http/routes/registration.test.ts:548–552`.
- **Problem:** The test says it checks the family guard at `complete`, but its generic configuration already fails the selected `standard` profile's issuer/configuration-path rule. Checking only `400 INVALID_REQUEST` cannot distinguish those refusals.
- **Evidence:** Removing only the completion family-guard block at route lines 309–313 leaves **all 40 route tests passing**. A private control uses a standard-compatible configuration URL and endpoints, with family `zzdr`, so only the family differs. It gets `400`, reason `family=zzdr`, and no registration POST with the real code; the same guard-removal mutant returns `200` and fails the control. The guard works today; the gap is regression coverage for UNIT AC-01, D5 item 5.
- **Suggested fix:** Use a configuration that satisfies the chosen profile's other rules, assert `details.reason === 'family=zzdr'`, the correct channel advice and no outbound registration. Keep the existing start-phase and successful owner-channel cases.

### Ownership, design and verification

The rule split is clear: the start route derives permissive rules from loaded profiles that offer DR; `complete` selects one profile and applies its exact rules before the registration POST. The pure parser owns issuer and endpoint checks. The profile guide names the issuer rule, fixed configuration path, endpoint policy and token format; the manifest must also offer a dynamic method. The stored token kind avoids a second JWKS fetch. Check 14 now calls the same kernel guard with the explicit `launch` phase.

The remaining UNIT AC-01 cases have direct positive/negative assertions: issuer paths and the fixed Moodle path; endpoint origins and reserved hosts; opaque versus verified registration tokens; audience/I-SELF staging; unknown or non-DR profiles; Deep Linking and explicit scope support; and stored granted scopes. The new successful generic case would fail under the earlier standard-only completion behavior. The Moodle manifest test pins the new help key's exact baseline sentence. The completion-text and family-test gaps are recorded above.

- **147 tests in 7 files passed**, including registration parser/routes/store, launch checks, protocol codes, platform rules and kernel manifest tests. The same 147 passed after restoring the private mutation. The additional family control also passed with restored code.
- LTI service and channel-kernel type checks, ESLint on all **14 changed TypeScript files**, F1 and F5 passed. F1 found zero LMS-name hits; F5 found zero hits across six rules.
- Evidence is under `/tmp/la-review-b-d114e80b087f/`: `reviewer-b-focused.log`, `reviewer-b-restored.log`, `reviewer-b-probes.log`, `reviewer-b-no-complete-family-guard.log`, `reviewer-b-family-control-mutant.log` and `reviewer-b-family-control-restored.log`. The private reproducer is `services/lti-service/src/http/routes/registration.reviewer-b.test.ts` there. Its four recovery assertions and one constraint assertion fail against the candidate as described above.
- Lane L owns the route, rules and stores. `7168908` is the explicit RQ-2 change for K's kernel/Moodle text files; BD-A1-77 and the Lead's RQ-5 allocation authorize migration 021. The check-14 edit stays within its allowed call switch. No app, service wiring/configuration or `tests/**` file changed in these commits. Existing route assertions changed only for the new response field and LA-IC-03 configuration path.
- The no-context start-page wording follows BD-A1-59/84 and is not a finding. K1-SIM AC-02–07/09, Moodle AC-08, G4 and R1/R2-lite remain QA gates. The later flag-removal/null-trait follow-up in BD-A1-75/83 is outside these four reviewed commits.

Only this review file was changed in the integration worktree. No commit was made.

## Round 2

Verdict: **CHANGES_REQUESTED**. Reviewer-B: Codex GPT-6-Astra xhigh. Date: 2026-10-23. Reviewed `ddf3771`, `734de51`, `82a3321`, `e07ab16`, `87ac6cd` and `80e31d7` (merges `4d6eec9` / `3b3dadf`) against the task, D5, BD-A1-84/87/88/89 and plan §6.1. Verification used a private `git clone --no-hardlinks` at `6689a185faa90c444de2e1c540a476bccb4dcf01`. No other reviewer's report was read; no Docker or stack was run.

Counts: **0 BLOCKER, 1 MAJOR, 0 MINOR, 0 NIT.** All three Round 1 findings are closed; B-LA-E2-02-04 is new.

| Finding | Resolution and evidence |
| --- | --- |
| B-LA-E2-02-01 | `toolMayExist` now uses the selected channel's `TOOL_MAY_EXIST` sentence, filled once with the LMS and tool names. All four original private probes now receive the generic channel's recovery text. The new four route tests check the exact sentence and unchanged status/code/reason; restoring the old text makes all four fail. The Moodle manifest test compares the filled sentence to the frozen helper, byte for byte. |
| B-LA-E2-02-02 | Migration 021 now has the specified CHECK, and the store test rejects both an unknown value and the typo used in the review. Removing the constraint makes that test fail. NULL backfill and preservation of pre-021 columns remain covered; completion also rejects an unknown stored kind defensively. |
| B-LA-E2-02-03 | The added completion test uses a standard-compatible configuration and changes only the family. It asserts `family=zzdr`, the exact channel advice, no registration POST and an open session. Removing the completion guard now makes this test fail. The original private control also passes with the real code. |

### B-LA-E2-02-04 — MAJOR — Explicit updates can reactivate a platform despite the revised keep-active rule

- **File:** `services/lti-service/src/http/routes/registration.ts:396`, using the default at line 381; task rule at `docs/architecture/ltiaas/tasks/LA-E2-02.md:32`.
- **Problem:** The task's BD-A1-89 note says an update that meets I-SELF keeps the stored `active` value. The explicit-update path instead uses `autoActivate ?? true`. An administrator can therefore update registration details on a disabled platform and turn it on without asking for activation. The duplicate-client path at line 414 follows the stated keep-active rule.
- **Evidence:** A private probe creates an inactive `zz-jwt` platform with binding ref `owner-ref`, obtains a verified `reg-update` session for its deployment, and completes with the same profile, matching `updatePlatformId` and binding ref. The configuration meets I-SELF and the request omits `autoActivate`. Completion returns `200` for the same platform, and its stored `active` value becomes **true**. The new explicit-update regression fixture starts active, so it does not detect this difference.
- **Suggested fix:** Apply the documented rule on both existing-platform paths, reading the current state inside the write transaction: stage to inactive when required, otherwise preserve the stored state. Add inactive explicit-update coverage. If A1 intends explicit updates to retain the old `autoActivate` semantics, state that exception in the task and contract, explain it for operators, and pin both behaviors in tests instead of describing one keep-active rule.
- **Design coordination:** The baseline API lists `autoActivate` default `true`. The coordinator confirmed that lane L deliberately kept that rule for explicit updates, asked A1 to resolve its conflict with the revised task note, and instructed me to report the probe without waiting. This finding records the current mismatch; it does not assume A1's pending answer.

### Round 2 verification and scope

The update checks are centralized in `updateProblem` and repeated inside the local write transaction. Profile and binding-owner refusals have stable reasons and leave the existing record unchanged. Credential fields are now written as one set, including clearing an omitted audience; the token cache key includes the endpoint, client id and resolved audience. `audienceOf` supplies both the cache key and assertion, so the two cannot select different values. Tests cover a request in flight for the old credentials.

- The combined two-item suite passed **273 tests in 15 files**, then passed all 273 again after private mutations were restored. This includes the earlier UNIT rule table and the new update, cache and refusal cases. The six original private B probes also pass; the new inactive-update probe fails as described above.
- Controlled regressions produced **15 expected test failures** across this dispatch: four recovery cases, one constraint case, one completion guard, six existing-platform update cases, one token-cache case and two E2-01 audience cases. All source mutations were restored.
- LTI service, channel-kernel and channel node type checks passed. ESLint on all 15 changed TypeScript files, F1 and F5 passed; both fitness scans had zero hits.
- Evidence under `/tmp/la-review-b-8257dae87f41/`: `reviewer-b-focused.log`, `reviewer-b-restored.log`, `reviewer-b-private-probes.log`, `reviewer-b-mutant-{recovery,constraint,family,audience}.log`, `reviewer-b-old-update.log` and `reviewer-b-old-cache.log`. The private reproducer is `services/lti-service/src/http/routes/registration.reviewer-b.test.ts` there.
- `734de51` is the explicit K-file RQ-2 for the new text key and Moodle sentence. The other changes remain in lane L's route, parser, stores and token client; the token-cache fix supports the reviewed credential-update path. App code, service wiring/configuration and `tests/**` are untouched. The existing JWT test now runs with and without an opaque-token profile; the path fixture change has a second test proving the production registry still rejects the bad path at `complete`. No new LMS-name branch or exception was added.
- K1-SIM, Moodle, goldens and R1/R2-lite remain QA gates. The app-side use of the new recovery key belongs to LA-E2-04. The deferred flag-removal/null-trait follow-up is outside these commits.

Only the assigned Reviewer-B reports were changed in the integration worktree. No commit was made.


## Round 3

**Verdict: APPROVE.** Reviewer-B: Codex GPT-6-Astra xhigh. Date: 2026-10-23. Reviewed `f8fa4ff` in merge `678eb72` against B-LA-E2-02-04, BD-A1-93, LA-IC-21, the task notes and the `complete` contract in lti-service-api-delta §4.5. Verification used a private clone at `667bcf875102865884c0d30b8c4f04e8dc20ae4b`. Blind review; no other reviewer's report was read.

**Open counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.** No new findings.

**B-LA-E2-02-04 — CLOSED.** `services/lti-service/src/http/routes/registration.ts:393` now puts the activation rule in the shared existing-platform update helper: staged updates set `active: false`; all other updates keep `existing.active`. Both the explicit-id and duplicate-client paths read the existing record inside the write transaction and call that helper. `autoActivate` remains on the create path only. The comment, task, contract and LA-IC-21 agree, so the operator's disabled state has one clear rule.

The regression at `registration.test.ts:728` reproduces the original inactive-platform case and verifies the response and stored row. It also checks an explicit `autoActivate: true` update and a new platform with `autoActivate: false`. Restoring only the route from `f8fa4ff^` makes this test fail at the first update: actual `active: true`, expected `false`. The fixed route was restored; the existing staged and duplicate-client cases still pass.

The combined review suite passed **329 tests in 13 files**, including all **55 registration route tests**, before and after the temporary probes. Root type checks, full lint, F1 and F5 passed. Evidence: `/tmp/reviewer-b-e2k-focused.log`, `/tmp/reviewer-b-e2k-mutant-active.log` and `/tmp/reviewer-b-e2k-restored.log`. The commit changes only L's route and colocated unit test; no forbidden file, new LMS-name branch or unrelated behavior change was found. QA retains the live/simulator and frozen-suite confirmation for LA-IC-21. No Docker, stack, commit or push was run.


## Round 4

**Verdict: APPROVE.** Reviewer-B: Codex GPT-6-Astra xhigh. Date: 2026-10-23. Reviewed `1cbae3e` and RQ-2 `c240a6e` together in merge `78ffce1`, against BD-A1-75/83 and LA-ADR-02 D2. QA's prerequisite merge `4d08fc1` is an ancestor of this merge. Verification used a private clone at `823bb268fbaf2399f95c8d5b5300ad98d186beff`, with its own `npm ci` and the Vitest cache deleted before each run. Blind review; no other reviewer's report was read.

**Open counts: 0 BLOCKER, 0 MAJOR, 1 MINOR, 0 NIT.** The Round 3 approval remains valid; B-LA-E2-02-05 is new documentation follow-up.

### B-LA-E2-02-05 — MINOR — The profile-default note still derives the form from the removed flag

- **File:** `docs/architecture/ltiaas/adr/LA-ADR-02-generic-lti-channel.md:45`.
- **Problem:** the current default description says `clientAssertionAud` uses the legacy flag's form. After this removal, that flag is invalid and omission always gives the token URL as a string. A channel author reading the referenced D2 guidance must infer the final default from the transition history or inspect code.
- **Evidence:** `profiles/registry.ts:28` supplies `{ value: '{tokenEndpoint}', form: 'string' }`. A private probe omitting the trait from the Blackboard profile returned that string default, while an old `flags.clientAssertionAudArray: true` failed check 7. D2's table correctly describes the replacement and explicit array form, so the repair remains discoverable; the default paragraph is stale.
- **Suggested fix:** A1 should state the final default explicitly and mark the flag-derived default as historical. Add a short migration sentence: remove `flags.clientAssertionAudArray`, retain or set `clientAssertionAud.form: 'array'` when required, and otherwise use `'string'` (also the omitted-trait default).

### Author experience, compatibility and verification

The load-check error is actionable: an old Blackboard flag produces `RegistryError`, check `7`, channel `blackboard`, reason `profile_schema_invalid`, detail `profile "blackboard": flags: Unrecognized key: "clientAssertionAudArray"`. Removing that key while keeping its explicit array trait succeeds. The kernel source type and strict LTI schema agree; no production reference to the old flag remains. Keeping the two reviewed commits together is necessary because a leftover flag in any channel profile fails startup.

Compared all **eight baseline profile records** with `1cbae3e^`, normalizing an omitted DR trait to `null` and using the old versus new audience defaults: every value is identical except the removed flag. Canvas and Blackboard now declare `dynamicRegistration: null` explicitly. The token-client tests still check standard string and Blackboard array JWT audiences. No token-client logic changed in this round.

- The clean full unit suite passed **3,055 tests in 190 files**, with five skipped. K0 passed **149 tests**. Root type checks, full lint, F1 (0 hits) and F5 (six rules, 0 hits) passed.
- Three controlled regressions each caused the intended test to fail: allowing the removed flag, changing the omitted-trait default to array, and changing the Blackboard audience trait to string. All mutations were restored; **32 profile/token-client tests** then passed. Logs: `/tmp/reviewer-b-e2k2-mutant-{removed-flag,default-form,baseline-aud}.log`, `/tmp/reviewer-b-e2k2-restored.log` and `/tmp/reviewer-b-e2k2-profile-probes.log`.
- Ownership follows the declared RQ-2 changes to the kernel type and the two K-owned channel profiles; L owns the remaining schema, registry, baseline profiles and colocated tests. No app, portal, service wiring or `tests/**` file changed in these commits, and no new LMS branch was added. QA retains live and simulator regression gates. No Docker, stack, commit or push was run.
