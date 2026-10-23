Verdict: CHANGES_REQUESTED
Round: 1

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
