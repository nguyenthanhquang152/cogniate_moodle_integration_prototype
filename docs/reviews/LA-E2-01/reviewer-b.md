Verdict: APPROVE
Round: 2

# LA-E2-01 review, Reviewer-B

## Round 1

Reviewer-B: Codex GPT-6-Astra xhigh. Lens: can a new channel team write and diagnose a profile from the trait contract? Reviewed `6d91c5b`, `5dcf673`, `e5b33e4`, `ac75ca0`, `1c345d2`, `c54b7f2`, `48284a7` and `c7929d1` in merges `b33c178` / `4b0f003`, against the task, LA-ADR-02 D2/D2a, LA-ADR-01 load check 7, contract delta §4.6/§4.7 and BD-A1-74 to -76. Verification used a private `git clone --no-hardlinks` at `bd32e0583de0217b7b560efbbd511b81c4bdb132`. No Reviewer-A file was opened; no Docker or stack was run.

Counts: **0 BLOCKER, 1 MAJOR, 1 MINOR, 0 NIT.**

### B-LA-E2-01-01 — MAJOR — The default issuer-only rule skips the stored audience check

- **File:** `services/lti-service/src/http/routes/platforms.ts:127` (the issuer-only branch), with the stored value used at `services/lti-service/src/platform/token-client.ts:61`.
- **Problem:** A valid admin profile can set `clientAssertionAud.value: '{platformValue}'` and omit `endpointOrigins`, taking the documented strict `issuer` default. An active create then accepts a foreign assertion audience: only the `any-https` branch calls the I-SELF audience check. A new channel team cannot rely on the documented default or the task's active-platform invariant. The current baseline profiles use `{tokenEndpoint}`, so their normal behavior is unaffected; the newly supported trait combination is wrong.
- **Evidence:** In the private clone I added a data-only test channel to the normal `buildProfileRegistry` load, copied the standard admin profile with a new id/list order and no frozen wire value, set `{ value: '{platformValue}', form: 'string' }`, and omitted `endpointOrigins`. Load check 7 passed and the registry returned `endpointOrigins: 'issuer'`. An injected `POST /api/platforms` with issuer `https://tenant.example.edu`, all three endpoints on that origin, `active: true`, and `clientAssertionAud: 'https://foreign.example.edu/token'` returned **201 active**. The real token client then signed that foreign `aud` and sent the assertion to `https://tenant.example.edu/token` (outbound transport was a local fake; no network call). LA-ADR-02 D2a and contract delta §4.6 require an active admin platform's audience to be absent or equal to the token endpoint. The new AC-04 tests cover only `any-https`, so they miss this default-path case.
- **Suggested fix:** Apply the active-admin audience invariant independently of the endpoint-origin branch, or reject an unsupported trait combination at load check 7. Preserve the existing baseline behavior and the explicit staged exception. Add a profile loaded with the omitted origin trait and `{platformValue}`: an active foreign audience must give `400 PLATFORM_URL_NOT_ON_ISSUER_ORIGIN` naming `clientAssertionAud`, while an absent audience or the token URL passes. Test the explicit `issuer` value too.

### B-LA-E2-01-02 — MINOR — Document the final DR omission rule in the trait reference

- **File:** `docs/architecture/ltiaas/adr/LA-ADR-02-generic-lti-channel.md:43`; `packages/channels/canvas/lti-profiles.ts:14`; `packages/channels/blackboard/lti-profiles.ts:11`.
- **Problem:** The reference says the baseline profiles set every trait explicitly, but the final commit deliberately removes `dynamicRegistration` from Canvas and Blackboard. It also describes omission as `null` without distinguishing the normalized LTI profile from the raw profile used by the kernel capability calculation. A channel author can reasonably treat omission and explicit `null` as interchangeable when they are not.
- **Evidence:** `48284a7` records the reason: explicit `null` disables the dynamic capability, while an absent raw field leaves it unconstrained (`packages/channel-kernel/src/capabilities.ts:81-103`); the LTI registry normalizes either case to `null`. The baseline profile comments mention only the LTI result. The behavior preserves the existing K0 compatibility case, but the public trait note still describes the earlier implementation.
- **Suggested fix:** A1 should document the temporary baseline omission and the two representations, and state what a new DR-capable channel must declare. Replace “The baseline profiles set every value” with the final rule and link the removal plan/compatibility reason. No baseline behavior change is requested by this finding.

### Ownership, diagnostics and verification

The rest of the trait interface is readable: the kernel type names each field and points to D2, defaults are applied in one registry function, and the closed schema refuses inconsistent issuer kinds, endpoint-origin modes, audience forms and configuration paths. Refusals include the channel, check 7, profile id, field and expected value; the legacy array flag agreement gives a direct correction. `scope-jwt` names the behavior without introducing an LMS selector. The token client reads traits, filters granted scopes before cache lookup, and separates cached tokens by deployment when that claim is enabled.

- **100 test files, 1,316 tests passed** across the LTI service, kernel and affected portal areas in this two-item dispatch. Root type checking and ESLint on all **30 changed TypeScript files** passed. F1: **0 hits**. F5: **six rules, 0 hits**. The first attempt could not start because the copied dependency folder was incomplete; refreshing only the private clone fixed the test environment.
- UNIT AC-02 has positive and negative registry cases. AC-04 tests every off-origin endpoint/audience and the staged exception; AC-05 tests fixed endpoint/issuer hosts, ports, case and simulation hosts in both modes. AC-06 checks stored/fallback audiences, the baseline array form, deployment claims and cache separation. AC-07 checks granted scope filtering, refusal without an outbound request and NULL compatibility. AC-09 upgrades a pre-020 database, compares all old columns, checks both new NULLs and round-trips non-null values. The missing audience/default combination is the finding above.
- Controlled regressions in the clone removed the issuer-kind, origin and reserved-host guards and restored the old token client: **16 tests failed** across the three relevant files, including the named UNIT acceptance tests. Source changes were restored. Migration 020 is additive SQL; its test would fail without the new columns. The added null response fields follow contract delta §4.6; existing fields retain their values.
- File ownership follows matrix §5. The kernel type is the explicit RQ-2 commit; the idtoken fixture adjustment is the recorded L2 RQ-2 line; the AGS/NRPS and service-context edits carry deployment identity within lane L. Migration 020 is the assigned new file. The task's forbidden new-channel, registration, app and S-owned files are unchanged. No profile-id dispatch or new LMS-name exception was added.
- K0/K1-SIM and the task's R1/R2-lite/T7 live gates remain QA evidence. The traits are available now; this review does not claim that the later E2-02 DR consumer or the E2-03 channel has run.

## Round 2

Verdict: **APPROVE**. Reviewer-B: Codex GPT-6-Astra xhigh. Date: 2026-10-23. Reviewed `d6a0b82` and the BD-A1-82/83 design updates against LA-E2-01, LA-ADR-02 D2/D2a and plan §6.1. Verification used a private `git clone --no-hardlinks` at `6689a185faa90c444de2e1c540a476bccb4dcf01`. No other reviewer's report was read; no Docker or stack was run.

Counts: **0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.** Both Round 1 findings are closed.

- **B-LA-E2-01-01:** `planAdmin` now calls the small `checkActiveAudience` helper after either endpoint-origin branch. An active admin platform must have no audience value or exactly its token endpoint; the explicit staged exception remains. Tests load both an omitted `endpointOrigins` trait and explicit `issuer`, reject foreign audiences with the expected field/action text and no platform write, and accept the absent, equal-token and staged cases. Removing only this call caused both new tests to fail.
- **B-LA-E2-01-02:** D2's BD-A1-83 note now distinguishes the raw profile's object, NULL and absent forms from LTI registry normalization. It explains the temporary baseline omission and its follow-up, and tells a new channel team to declare both a dynamic manifest method and the profile object. This supplies the missing ownership guidance; the later explicit-NULL change is not claimed here.

The change stays in lane L's allowed platform route, its unit test and the shared platform-rule module. It adds no profile-id branch, new LMS name or protected-file edit. The separation of endpoint checks from the audience invariant is clear and avoids repeating the default-path mistake.

The combined two-item verification passed **273 tests in 15 files**, including the existing registry, platform, token-client and migration UNIT acceptance tests. LTI service, channel-kernel and channel node type checks passed, as did ESLint on the dispatch's 15 changed TypeScript files, F1 and F5. Evidence: `/tmp/la-review-b-8257dae87f41/reviewer-b-focused.log` and `reviewer-b-mutant-audience.log`; the latter records two expected failures. All private mutations were restored. K0/K1-SIM, goldens and R1/R2-lite/T7 remain QA gates.
