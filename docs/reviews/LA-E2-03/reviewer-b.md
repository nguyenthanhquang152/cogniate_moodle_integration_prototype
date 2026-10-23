Verdict: CHANGES_REQUESTED
Round: 3

## Round 1

Reviewer-B: Codex GPT-6-Astra xhigh. Lens: can a human team own it? Reviewed `c81bc24`, `278a0a8`, `56851de`, `0605770` and `d252e02`, including BD-A1-81, at merge `ddfd4c63272f3fcc3123aca81fb47766fc4bdb99`. Checked the task, LA-ADR-01 D2/D5, LA-ADR-02 D1/D3, app contract delta §3, build rulings BD-A1-78..81/-85/-86 and plan §6.1. Blind review; the other reviewer's file was not read.

**Counts:** 0 BLOCKER, 1 MAJOR, 2 MINOR, 0 NIT.

### B-LA-E2-03-01 — MAJOR — The manual form makes the optional token audience mandatory

- **Files:** `packages/channels/lti-generic/manifest.ts:50`; `services/cogniate-app/src/kernel/setup/admin-value.ts:44`; `apps/portal/src/channels/ManifestWizard.tsx:50`.
- **Problem:** the manifest correctly marks `tokenAudience` optional, but the shared form sends every input, including `tokenAudience: ""`. The adapter validates that empty string as a URL and refuses it. A tenant following the documented default of using the token URL as the audience cannot leave the optional input blank.
- **Evidence:** in a private clone, rendered the actual generic manual wizard, kept its pre-filled issuer, entered valid required values and a 43-character approval code, left Token audience blank, and pressed Save. The captured PUT body contained `tokenAudience: ""`; the real `adminValueSetup(...).parseBindingBody` returned `{ ok: false, fields: ["tokenAudience"] }`. This result maps to `422 INVALID_PLATFORM_VALUES` before grant processing. The portal-to-parser test expecting a valid body failed. Existing API tests omit the property and do not cover the form's payload.
- **Suggested fix:** omit empty optional fields in the shared form (lane P through RQ-1/RQ-2), or explicitly normalize the blank optional audience to absence in the adapter. Keep nonempty invalid URLs and empty required fields refused. Add a form-to-parser regression for blank and explicitly supplied audiences; no channel-specific portal module is needed.

### B-LA-E2-03-02 — MINOR — Manifest defaults bypass the strict value checks

- **File:** `services/cogniate-app/src/kernel/setup/admin-value.ts:49`.
- **Problem:** posted values are trimmed and validated, but defaults go directly into `values`. The manifest schema checks only a nonempty string and its placeholders, so a channel author can supply a malformed default that the adapter treats as valid. The issuer-origin check also skips a default that is not a valid HTTPS URL.
- **Evidence:** schema-valid variants returned `ok: true` when an absent field used issuer default `http://foreign.example.edu/issuer`, JWKS default `https://keys.example.edu/jwks#fragment`, client-id default `has spaces`, or grant-code default `short`. Posting each identical value instead returned `ok: false` with that field. A valid HTTPS issuer on a different origin was correctly refused. The checked-in generic issuer default is valid; this is a reusable-adapter validation gap, not evidence of an LTI-service validation bypass.
- **Suggested fix:** fill defaults first, then apply one trimming and value-validation function to both sources before constructing `AdminValues`. Add tests that require the same field refusal for a malformed posted value and malformed default. Preserve posted-value precedence and the issuer-origin check.

### B-LA-E2-03-03 — MINOR — The issuer refusal tells the tenant that all URLs must share the site origin

- **Files:** `services/cogniate-app/src/kernel/setup/admin-value.ts:96`; `services/cogniate-app/src/kernel/authority/common.ts:39`.
- **Problem:** the new adapter reuses `reason: 'origin'` for an issuer mismatch, which selects the older all-URLs-on-site instruction. Admin-value channels intentionally allow their other endpoints on different HTTPS hosts. The repair sentence therefore describes a stricter rule than this adapter applies.
- **Evidence:** the new API test pins `The URLs must be https and on the your LMS site of this connection.` for `fields: ['issuer']`, while the same adapter's positive test accepts `accessTokenEndpoint: 'https://token.provider.test/token'` for another site origin.
- **Suggested fix:** add an issuer-specific refusal reason/text through the shared contract, for example `The issuer must have the same HTTPS origin as this connection's site URL.` Preserve the existing baseline origin text. Test both the specific field and the repair sentence.

### Ownership, docs and verification

The architecture is maintainable: `setupOf` selects and caches one pure kernel adapter per channel/registry; the adapter builds its profile map from manifest registrations and has no channel-id branch. The channel README and ADR describe the no-`app.ts` path, required fields, defaults, registration authorities and profile traits. The default wizard already reads `FieldSpec.default`. The missing check is the interface between that wizard and this strict parser, reported above.

The reviewed cross-lane changes are the declared RQ-2 test updates; no LTI-service or portal production file changed. The kernel port additions and temporary staged-create refusal are explicit E2-04 preparation. Custom `setup.toolRows` belongs to E2-05 under BD-A1-78; switching `toolConfiguration` from `none` to `channel` follows the QA kit change under BD-A1-85. These planned steps are not claimed complete here. No LMS-name literal was added to scanned core code; full F1 remains at zero.

Verification ran only in `/tmp/la-e2-03-review-b-dbru185x/repo` at the merge SHA:

- **379 focused unit tests in 20 files passed:** kernel, adapter, app create/provider/redemption paths, affected LTI profile/route tests and portal error/shell tests. **134 K0 tests passed**, including the admin-profile canary without `app.ts`, generic capabilities and profile traits.
- Full repository lint, `npm run typecheck`, F1 (0 hits) and F5 (six rules, 0 hits) passed.
- AC-06 tests discriminate default filling and issuer-origin validation: disabling either behavior made its named test fail. AC-08 fails when the manual/self guard is disabled. The remaining AC-06 posted-body cases cover unknown/missing keys, malformed values and explicit override; they omit the two gaps above.
- Removing only the BD-A1-81 Moodle collision override made **six** kernel/portal assertions fail. Its filled text equals the frozen server collision sentence, and the baseline form retains that sentence.
- The added review probe for a blank optional audience failed as described in B-01; direct default probes reproduced B-02. All temporary changes were restored. No Docker, stack, commit or push was run.

QA retains K1-SIM AC-03/04/05/07, the F2 report and R1. Request changes for B-01; B-02 and B-03 are safe to schedule separately.

## Round 2

**Verdict: APPROVE.** Reviewed `3777e7c76d5ce89f3cd6d93b8975188fb4dec0f6` at merge `0e6bace312c766509119eeb77f48c4e594a90c34`, against B-LA-E2-03-01 and B-LA-E2-03-02 only. B-03 was explicitly outside this fix round. Blind review; the other reviewer's file was not read.

**Open counts:** 0 BLOCKER, 0 MAJOR, 1 MINOR (B-03 carried), 0 NIT. No new findings.

- **B-LA-E2-03-01 — CLOSED.** `kernel/setup/admin-value.ts:50` treats an empty or whitespace-only optional string as absent before validation. Required blank values still fail. The new tests cover blank, whitespace, supplied valid audience, nonempty invalid audience and blank required JWKS, plus the manual-form-shaped PUT through grant redemption. I also reran the actual rendered generic wizard-to-parser probe from Round 1: the form still sends `tokenAudience: ""`, but parsing now succeeds without an audience.
- **B-LA-E2-03-02 — CLOSED.** `kernel/setup/admin-value.ts:31` provides one trimming/validation function for posted and defaulted values, and line 63 applies it after placeholder expansion. The malformed issuer, JWKS, client-id and grant-code defaults now fail with the same field as their posted counterparts. Explicit valid values still replace defaults; a valid HTTPS issuer default on another origin still gets the origin refusal.
- **B-LA-E2-03-03 — OPEN, MINOR.** The issuer-specific repair sentence was not part of `3777e7c`; carry the Round 1 finding unchanged.

Verification in `/tmp/la-e2-04-review-b-p0ltlhei/repo`: the clean merge passed **277 focused tests in 12 files**, including both changed test files and the portal shell, and **134 K0 tests**. Full lint, type checks, F1 and F5 passed. As a negative control, restoring only `admin-value.ts` from `3777e7c^` made all **three** new parser/default/API regressions fail; the fixed parser was then restored. The extra real wizard-to-parser probe passed with the fix. No portal or LTI-service production file changed in this fix; no Docker, stack, commit or push was run.

This approval closes the two dispatched E2-03 findings. The separate staged-form and finalized-repeat gaps introduced or exposed by E2-04 are recorded in that task's Round 1 report.


## Follow-ups (E2-K)

**Verdict: CHANGES_REQUESTED.** Reviewer-B: Codex GPT-6-Astra xhigh. Round 3, 2026-10-23. Reviewed `9d52c24`, `b01794f`, `6776bbd`, `afaf9ff` and `a176489` in merge `e82808e`, against LA-E2-03, BD-A1-78/94/95, README §4 N10 and plan §6.1. Verification used a private clone at `667bcf875102865884c0d30b8c4f04e8dc20ae4b`, which also contains the new Brightspace folder. Blind review; no other reviewer's report was read.

**Open counts: 0 BLOCKER, 1 MAJOR, 0 MINOR, 0 NIT.** B-LA-E2-03-03 is closed; B-LA-E2-03-04 is new.

### B-LA-E2-03-04 — MAJOR — The open-world rewrite still rejects new simulation entries

- **Files:** `services/lti-service/src/profiles/canvas.test.ts:26`; `packages/channel-kernel/src/registry.test.ts:163`.
- **Problem:** the Canvas test still requires the last two loaded profiles to be exactly the two baseline simulation profiles. The kernel test compares simulations-off with simulations-on after removing only its own `zz-sim` fixture, so it assumes that the product root has no simulation-only channel. Both tests read the real product root. A team can add a valid channel folder and then must edit core tests to make the build pass, contrary to N10 and BD-A1-95.
- **Evidence:** in the private clone, added only `packages/channels/zz-review-new/{manifest.ts,lti-profiles.ts}`: a manual operator-grant channel using the generic admin-value shape, `card.order: 90`, one real profile (`listOrder: 100`) and one simulation profile (`listOrder: 101`). Discovery and profile validation succeeded; the nine rewritten test files produced **240 passes and one failure**, at `canvas.test.ts:26`, whose actual tail was `canvas-sim-cloud, zz-review-new-sim`. Replaced that folder with `zz-review-simonly`, `availability: 'simulation-only'`, one valid simulation profile, and reran the same files: **239 passes and two failures**, at the two cited lines. The additional kernel failure is the new channel remaining in the simulations-on comparison. No core code or test was changed for either probe.
- **Suggested fix:** assert membership and the relative order of the baseline simulation profiles after filtering to the profiles under test, or use a registry made only from fixtures. In the kernel comparison, filter all simulation-only manifests by their declared availability, while retaining the explicit on/off assertions for `zz-sim`. Include both a normal channel with a simulation profile and a simulation-only channel in the add-folder check. Keep this fix in E2-K before naming its final base SHA, as BD-A1-94 requires.

### Resolved finding and maintainability

**B-LA-E2-03-03 — CLOSED.** `admin-value.ts` returns the typed `issuerOrigin` reason, and `authority/common.ts` gives the issuer-specific repair sentence. The older `origin` and malformed-value sentences remain unchanged. The API test checks the exact new sentence while allowing a token endpoint on another HTTPS host; restoring the old reason makes that test fail.

`setup.toolRows` is a small, usable data contract. The exported type and placeholder list, ADR D2/D5 and adapter test explain row order, the generic fallback, and which context values are available. The schema rejects unknown row properties, invalid or duplicate keys, an empty list, empty labels/values and unsupported placeholders. Filling is one pass, so inserted library text containing braces or `$&` stays literal. The adapter uses the supplied tool URLs and scope set. Disabling the custom-row branch makes the new rendering test fail. No additional usability finding is needed for this field.

N10 clearly distinguishes tests of the product registry from tests of a fixed fixture registry. The rewrites generally show a useful pattern: preserve the frozen baseline values, select the entry under test by id, and derive the allowed ordering from manifest/profile data. The two remaining simulation assumptions above are an incomplete application of that rule.

The staged-registration follow-up adds the dynamic client/deployment/grant fields and preserves the staged deployment ids in the pending DTO so the form can pre-fill them. Its regression uses those manifest fields and the fetched DTO to redeem the grant; removing just the DTO exception makes it fail with an empty deployment list. This checks `9d52c24` only and is not a new verdict on LA-E2-04's separate fix round.

### Verification and ownership

- The clean candidate passed **329 focused tests in 13 files**, including all changed test files and the LA-E2-02 route suite reviewed alongside this item. Root type checks, full lint, F1 (0 hits) and F5 (six rules, 0 hits) passed.
- The two added-folder probes failed only as described in B-04. The custom-row, issuer-reason and staged-DTO negative controls each caused their intended regression test to fail. Temporary folders and source mutations were removed; all 329 focused tests passed again after restoration.
- `a176489` is the declared RQ-2 for L's three test files; the other E2-K changes remain in K's manifest, kernel and app files. No `tests/**`, service wiring or portal production file changed in these commits. No LMS branch was added to core.
- Logs are `/tmp/reviewer-b-e2k-{focused,restored,canary-real-sim,canary-simonly}.log` and `/tmp/reviewer-b-e2k-mutant-{rows,issuer,staged-dto}.log`. QA retains the E2-N add-channel/F2 gate and stack-backed ACs. No Docker, stack, commit or push was run.
