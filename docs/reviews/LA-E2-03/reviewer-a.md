Verdict: CHANGES_REQUESTED
Round: 1

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
