Verdict: APPROVE
Round: 1

# LA-E3-09 review: Reviewer-A

## Round 1

Reviewer: Codex GPT-6-Astra xhigh, lens "Is it right and is it safe?" Date: 2026-10-23. **Counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**

Reviewed lane commits `7433884` (RQ-2 kernel type) and `0dc350f` against the task spec, LA-ADR-05 D6, contract delta §4.5, BD-A2-89, BD-A1-105 and plan §6.1. Verification used integration `8f4aef71e5dcbc3092820b92f5f0b0277535a1cb` with `0dc350f` merged privately using `--no-commit --no-ff`. No findings.

### Acceptance and safety

- **Origin and endpoint checks:** the site comes from the configuration URL, the service origin from the token endpoint. Neither comes from the shared issuer. The derived origins pass the site rules, including the fixed hosts of all loaded profiles. Issuer, auth, token and JWKS values must match the selected profile. The registration endpoint stays on the derived site or service origin. Configuration and registration requests still use the guarded outbound client.
- **AC-05:** the route test checks refusal before any outbound request when only profile-rule DR channels are available. With admin-value profiles also loaded, start keeps the existing union of accepted rules; completion applies the selected profile's exact rule. Removing the pre-fetch refusal makes the AC-05 test fail. A configuration on the shared SSO host can be fetched, but completion refuses it before registration POST or platform writes, as BD-A2-89 requires.
- **Always staged:** hosted and self-hosted Canvas require a binding reference and remain inactive even with `autoActivate: true`, including the all-same-origin case. Private beta/test route probes also use separate service origins and confirm `PLATFORM_NOT_ACTIVE` on learner login without another outbound call. A duplicate client held by another binding reference remains unchanged, including its active state and origins.
- **Family and request safety:** private probes refuse Canvas-to-generic completion and a Canvas-shaped configuration claiming the guarded Blackboard family. Extension keys pass the HTTPS URL schema, values must be non-empty strings, and the record has at most eight members. The loaded map is frozen; extension values stay literal. The Canvas request carries the three specified members and four requested AGS scopes. Core request members and the existing Moodle request assertions remain intact; the providers DTO does not expose the extension map.
- **Scope and ownership:** the kernel addition is isolated in the authorized RQ-2 commit. Other changes stay in Canvas profile data and lane L's registration, profile, store and adjacent unit-test files. The task's forbidden Canvas manifest/app and redemption files are untouched. No LMS branch was added to core code.

### Verification

All runs used fresh private clone `/tmp/la-reviewer-a-ctx-110f26edc013`, its own `npm ci`, and a deleted `node_modules/.vitest-cache` before every Vitest run.

- Focused registration, profile and store suites: **114/114**.
- Login, multi-LMS, app staging and redemption suites plus six private boundary probes: **205/205**.
- Seven negative controls are detected: removing the pre-fetch guard, unconditional staging, shared-SSO refusal, exact endpoint matching, request extensions, binding isolation, or HTTPS-only extension-key validation. After restoration: **120/120** affected checks pass.
- LTI service, app, kernel and channel Node typechecks pass. Targeted lint and diff whitespace checks pass. F1: **0 hits**. F5: **6 rules, 0 hits**.
- K0: **146 passed, 1 failed**. The only failure is `K-LEGACY.canvas`: the old golden expects `dynamicRegistration: false`, while the reviewed capability is `true`. This is the dispatch's expected LA-IC-14 change, pending QA's LD-9 update; it is not an additional implementation finding.

Probe sources are saved under `/tmp/la-reviewer-a-ctx-110f26edc013-probes`; logs use the same prefix. All mutations were restored to the private merged snapshot, and the temporary probe was removed from that clone. No Docker, stack, stack-starting runner, commit or other reviewer's file was used. Only this report was written in integration. This approval covers the implementation; the reviewed LA-IC-14 test update, K1-SIM AC-01 through AC-04, post-grant learner launch and live Canvas compatibility remain QA gates.
