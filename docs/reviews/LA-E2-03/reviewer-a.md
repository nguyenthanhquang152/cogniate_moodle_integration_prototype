Verdict: APPROVE
Round: 4

# LA-E2-03 review: Reviewer-A

## Round 1

Reviewer: Codex GPT-6-Astra xhigh, lens "Is it right and is it safe?" Date: 2026-10-23. **Counts: 0 BLOCKER, 1 MAJOR, 1 MINOR, 0 NIT.**

Reviewed `c81bc24`, `278a0a8`, `56851de`, `0605770` and `d252e02` (merge `ddfd4c6`) against the task spec, LA-ADR-01 D2/D5, LA-ADR-02 D1/D3/D8, app API delta §3, BD-A1-78..81/-85/-86 and plan §6.1. Tests ran in private clone `/tmp/la-reviewer-a-ctx-a2a42535d055` at `4d6eec9`, which includes the dispatched lane L prerequisite fix `ddf3771`; this review judges lane K's changes, not that separate L fix.

### Findings

**A-LA-E2-03-01 (MAJOR): leaving the optional token audience blank makes the generic manual form fail.**

- Where: `packages/channels/lti-generic/manifest.ts:50`; `services/cogniate-app/src/kernel/setup/admin-value.ts:44`; consumer `apps/portal/src/channels/ManifestWizard.tsx:50`.
- Problem: the new manifest renders `tokenAudience` as an optional URL input, but the default wizard serializes every input, including an empty optional one. The adapter correctly rejects the posted empty string as an invalid URL. A user whose platform has no separate audience cannot submit the advertised optional form without supplying an extra value.
- Evidence: a private route probe renders `/integrations/lti-generic/con_shell` using the real manifest and wizard, fills the required manual fields, leaves Token audience blank, and clicks Save. The captured request contains `tokenAudience: ""`; the real adapter returns `{ ok: false, fields: ["tokenAudience"] }`. A separate app API probe confirms `422 INVALID_PLATFORM_VALUES` with that field, before grant processing. Omitting the key from the same body reaches the grant check (`403 GRANT_INVALID` for the deliberately unissued test code). Existing adapter tests omit the optional key in hand-written bodies; existing shell tests do not submit this real generic form.
- Suggested fix: coordinate with P to omit blank optional fields from the manifest form, keeping required blank fields invalid and non-empty posted values authoritative; an explicitly agreed server normalization is another option. Add a real generic-manual route test that leaves Token audience blank and passes the submitted body through the strict parser. The portal file remains P-owned and needs the normal RQ handover.

**A-LA-E2-03-02 (MINOR): filled defaults bypass the strict parser's field validation.**

- Where: `services/cogniate-app/src/kernel/setup/admin-value.ts:47` and `:96`.
- Problem: posted values are trimmed and checked as URLs, printable IDs or grant codes, but defaults are copied directly into `values`. A non-HTTPS default issuer also skips the origin comparison because that comparison is conditional on `isHttpsUrl` succeeding.
- Evidence: five schema-valid manifest variants are refused when their value is posted, but return `ok: true` when the same value comes from an omitted field's default: an HTTP issuer on another origin, a credential-bearing issuer on another origin, an HTTP authentication endpoint, a 2049-character invalid JWKS URL, and a client ID containing a space. The public default test covers only a valid `{siteUrl}` and a valid override.
- Impact: malformed channel defaults produce a successful strict-body result and defer the error to a later layer. This is contained: the shipped generic default is only the canonical site URL, and separate real LTI-route probes still reject the invalid URL values, including on staged creates. No platform-validation bypass was demonstrated, so this is safe to defer.
- Suggested fix: run each filled default through the same normalization and validation as a posted value before building `AdminValues`, then apply the issuer-origin check. Preserve the rule that a present invalid value is rejected rather than replaced by a default; add invalid-default cases beside AC-06.

### Acceptance and safety checks

| Area | Result |
| --- | --- |
| UNIT AC-06 | Tests cover unknown/missing fields, wrong origins, valid defaults and posted overrides. Removing default filling makes the named AC test fail. Finding -02 covers the remaining invalid-default gap. |
| UNIT AC-08 | The test rejects manual → self on both app and LTI registry loads. Disabling check 6 makes this test fail. |
| K0 AC-01/-02/-09/-10/-11 | **134/134 K0 tests pass**, including the admin canary without `app.ts`. Generic capability flags, four AGS scopes without NRPS, profile traits and platform storage agree with the specified data. |
| Create and profile boundary | Public and private app tests reject bad URL forms, IP/localhost/own-service hosts, and selection of `standard`, Canvas or Blackboard profiles for either generic method. Removing the new kernel-served site check causes two public tests to fail. Rule 4 uses the selected profile's fixed hosts under ADR-011 §6; the generic admin profile has no fixed hosts. |
| LTI boundary / AC-07 supplement | With the actual `lti-generic` profile, an active platform with a foreign token host gives `400 PLATFORM_URL_NOT_ON_ISSUER_ORIGIN`; the same values with `active: false` and a binding reference create an inactive platform. A fixed-profile request with admin values is refused. These are in-memory route checks, not K1-SIM evidence. |
| Frozen behavior and ownership | The Moodle error value fills to `LEGACY_SELF_BINDING_TEXT.collision` byte for byte, and the actual manual-form test pins it. Baseline lists retain their existing entries; the new generic entry and the operator list text changes are specified/ratified. L test expectations and P error tests are the dispatched RQ-2 edits; the port types and narrowing guard are the dispatched K work. No frozen acceptance file, applied migration or baseline LTI profile is edited. F1 adds no exception. |
| Explicit companion work | `toolConfiguration: 'none'` is the authorized BD-A1-85 interim state; showing the portal rows follows the kit change. Admin-value staged redemption and the first-use fixed-profile check remain LA-E2-04, as specified; the current staged-call guard fails closed. These are not new findings. |

### Verification

- Focused public kernel, app, LTI profile/route and portal suites: **454/454 tests in 30 files**. App, portal and channel-node type checks pass.
- K0: **134/134**. Full lint passes. F1: **0 files with hits, 0 hits**. F5: **6 rules, 0 hits**.
- Private probes: **6 failures** establish the two findings; **4 passing controls** cover request-level behavior and profile/LTI boundaries. Diagnostic changes that omit blank optional form values and validate filled defaults make the affected public suites plus the app/portal probes pass (**59/59**); those product edits were restored.
- Three negative controls are detected: removed defaults, removed kernel-served site checks, and disabled manual-self load check. After all mutations were restored, the four affected public suites pass (**88/88**).

Probe sources are saved outside the clean clone at `/tmp/la-reviewer-a-ctx-a2a42535d055-probes`; logs use the same prefix in `/tmp`. No Docker, stack, stack-starting runner or commit was used. No other reviewer's file was opened, and only this review file was written in the integration worktree. K1-SIM, R1 and live/golden regression remain QA gates; this review does not claim those results.


## Round 2

Verdict: APPROVE. Reviewer: Codex GPT-6-Astra xhigh. Date: 2026-10-23. **Open counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**

Reviewed `3777e7c` at integration merge `0e6bace` against the task spec and both Round 1 findings. Verification ran in private clone `/tmp/la-reviewer-a-ctx-88ca8c796cc6`; the separate LA-E2-04 work has its own report.

- **A-LA-E2-03-01 (MAJOR): CLOSED.** The parser treats only blank optional string values as absent. The actual generic manual form still sends `tokenAudience: ""`, but its submitted body now passes the real parser; the new app-route test redeems that complete form body with a valid grant. Required blanks, unknown fields and malformed non-empty values remain invalid. This uses the server-normalization option accepted in Round 1 and needs no portal edit.
- **A-LA-E2-03-02 (MINOR): CLOSED.** Filled defaults now go through the same trim/form checks as posted values, followed by the issuer-origin check. All five private invalid-default cases from Round 1 are refused: HTTP issuer, credential-bearing issuer, HTTP authentication endpoint, overlong invalid JWKS URL and invalid client ID. Valid defaults and posted overrides remain covered by the public tests.

The six formerly failing private parser/form probes now pass. Restoring only the pre-fix `admin-value.ts` in the private clone makes **9 tests fail** across the new public tests and private regression probes, including all six former failures; the product file was then restored. Thus the new tests exercise the changed behavior rather than only the new implementation.

Focused public verification shared with LA-E2-04: **231/231 tests in 10 files**, app typecheck, **134/134 K0**, full lint, F1 (**0 hits**) and F5 (**6 rules, 0 hits**) pass. After restoring all mutations, the five affected public suites pass (**75/75**). The private clone is clean; probe sources and logs are saved under `/tmp/la-reviewer-a-ctx-88ca8c796cc6-probes` and the same `/tmp` prefix.

The fix changes only the allowed adapter and adjacent unit tests; no frozen acceptance, migration, LTI profile or P-owned product file changes. No Docker, stack, stack-starting runner or commit was used, and no other reviewer's file was opened. The two LA-E2-04 findings are separate from this fix verdict; stack/live regression remains with QA.

## Follow-ups (E2-K)

Verdict: CHANGES_REQUESTED. Round: 3. Reviewer: Codex GPT-6-Astra xhigh. Date: 2026-10-23. **Open counts: 0 BLOCKER, 1 MAJOR, 0 MINOR.** The two earlier Reviewer-A findings remain closed.

Reviewed `9d52c24`, `b01794f`, `6776bbd`, `afaf9ff` and RQ-2 `a176489` (merge `e82808e`) against the task, LA-ADR-01 D2/D4/D5, app API delta §3.3–3.4, BD-A1-78/94/95, README §4 N10 and plan §6.1. Verification used private clone `/tmp/la-review-a-a64f7fa74140` at `667bcf875102865884c0d30b8c4f04e8dc20ae4b`.

### A-LA-E2-03-03 — MAJOR — The open-world rewrite still rejects a valid simulation-only extension

**Files:** `packages/channel-kernel/src/registry.test.ts:163`; `services/lti-service/src/profiles/canvas.test.ts:26`.

The kernel test removes only its own `zz-sim` fixture when comparing the simulation-on and simulation-off product registries. It assumes the product root contains no other simulation-only channel. The LTI test still requires the last two profiles to be exactly `blackboard-sim` and `canvas-sim-cloud`, although D4 puts a new simulation profile after those baseline profiles. Both assumptions violate N10 and make a valid channel-folder addition require another core test edit.

**Evidence:** In the private clone, added two data-only folders copied from the valid generic manifest/profile, with unique channel/profile ids: a real channel (`card.order: 5`, `listOrder: 90`) and a simulation-only channel (`card.order: 6`, `listOrder: 90`, `simulation: true`). All nine rewritten test files pass with the real extension alone (**241/241**). With both extensions present, **239 pass and exactly two fail**: the kernel equality includes `review-added-sim` on only one side; the LTI tail becomes `canvas-sim-cloud, review-added-sim`. Both registries load successfully; no product code changes are needed for the extension.

**Suggested fix:** Compare the off registry with the on registry filtered by each manifest's `availability`, while retaining explicit checks that the fixture simulation is hidden/shown. Assert membership and relative order of the baseline simulation profiles, plus the general real-before-simulation/order rule, instead of requiring a fixed tail. Add a temporary simulation-only folder to the extension control so both real and simulated additions are exercised.

### Safety and verification

- The twelve affected committed suites pass **274/274**. K0 passes **149/149**; channel-kernel, app and LTI-service type checks pass. F1 has **0 hits**; F5 has **6 rules, 0 hits**.
- **Five independent safety probes pass.** Unknown account/path/prototype placeholders are rejected. Inserted braces and replacement directives remain literal. Different invocation contexts supply their own protocol URLs. Concurrent requests from two libraries keep their own names, and cross-library connection reads return 404. The real portal component renders hostile labels and values as text, with no injected image, script, iframe or link.
- Three negative controls are detected by assertions: changing valid baseline card order, corrupting the emitted Blackboard wire `lms` value after load validation, and disabling manifest tool rows. Thus the rewritten tests still protect baseline ordering/values, and the new tool-row test fails when the feature is removed. All product mutations were restored before the successful real-extension run and K0.
- The staged generic form test covers all three required dynamic fields, deployment-id prefill and grant redemption. The issuer mismatch uses its dedicated closed reason and accurate core sentence; the existing generic malformed-field cases and legacy origin handling remain covered.
- Ownership is respected by the explicit follow-up scope and the three-file L test RQ-2. No QA-owned test, migration, portal product file or baseline LTI profile changed in the reviewed commits. No new LMS dispatch branch or channel-owned protocol path was introduced.

Private evidence: `reviewer-a-extensions.log`, `reviewer-a-real-extension.log`, `reviewer-a-probes.log` and `reviewer-a-mutant-*.log` in the clone; the two extension folders are saved outside its channel root. No Docker, stack, stack-starting runner or commit was used. No other reviewer's file was opened, and only this review file changed in the integration worktree. Stack and live regression remain QA work.

## Follow-ups (E2-K) round 2

Verdict: APPROVE. Round: 4. Reviewer: Codex GPT-6-Astra xhigh. Date: 2026-10-23. **Open counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**

Reviewed `1c60d42` and RQ-2 `d58061f` (merge `053e5c7`) against A-LA-E2-03-03, the task, LA-ADR-01 D4, README §4 N10 and plan §6.1. Verification used a fresh `git clone --no-hardlinks` at `823bb268fbaf2399f95c8d5b5300ad98d186beff`, with its own `npm ci`, in `/tmp/la-review-a-ffc559a1a523`. The clone's `node_modules/.vitest-cache` was deleted before every Vitest run.

**A-LA-E2-03-03 (MAJOR): CLOSED.** The kernel comparison now removes every simulation-only manifest, while retaining the explicit fixture visibility checks. The LTI tests preserve baseline simulation membership and relative order, check the full D4 ordering rule, and exercise a simulation-only channel beside a normal channel with a simulation profile. Storage checks keep frozen baseline values and permit valid added profiles; the registration baseline fixture selects baseline owners rather than excluding one named extension.

- Repeated the two-folder reproduction using current generic manifest/profile data and unique ids: a real channel (`card.order: 5`, `listOrder: 90`) and a simulation-only channel (`card.order: 6`, `listOrder: 90`, `simulation: true`). All nine original suites plus the two other changed suites pass: **311/311 tests in 11 files**.
- Restoring only the two old assertions reproduces **exactly the original two failures**: the extra simulation-only channel remains on one side of the kernel comparison, and the LTI simulation tail includes the added profile. Other current assertions remain unchanged for this control.
- A valid change of baseline Blackboard simulation `listOrder` from 60 to 75 makes the revised baseline-order assertion fail. After restoring mutations, the five affected suites pass **140/140** with both extension folders present. Kernel and LTI-service type checks pass.

The commits change only five adjacent unit-test files within the dispatched L/RQ-2 scope. No product behavior, UNIT acceptance criterion, QA-owned test, migration or baseline profile changes; earlier findings -01/-02 remain closed. All tracked mutations in the private clone were restored, and the two canary folders were moved outside its channel root. Evidence is in `reviewer-a-two-extensions.log`, `reviewer-a-old-assertions-isolated.log`, `reviewer-a-baseline-order-mutant.log`, `reviewer-a-restored.log` and `reviewer-a-typecheck.log` there.

Only this review file was written in the integration worktree; no dependency install ran there. No Docker, stack, stack-starting runner, commit or other reviewer's file was used. Stack and live regression remain QA gates.
