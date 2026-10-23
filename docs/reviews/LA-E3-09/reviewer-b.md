Verdict: APPROVE
Round: 2

## Round 1

Reviewer-B: Codex GPT-6-Astra xhigh. Lens: can a human team own it? Reviewed `7433884` and `0dc350f`, merged without committing onto integration snapshot `8f4aef7` in a private clone. **1 BLOCKER, 0 MAJOR, 1 MINOR.** Line numbers below refer to that merged tree. No other reviewer's file was read.

### B-LA-E3-09-01 — BLOCKER — The AC-05 test removes the profiles that bypass the pre-fetch guard

- **Where:** `services/lti-service/src/http/routes/registration.ts:205`; `services/lti-service/src/http/routes/registration.test.ts:908`.
- **Problem:** The public route fetches a forbidden configuration host with the normal mixed registry, although AC-05 requires refusal before the fetch. The test gives a misleading green result by removing Dynamic Registration from every admin-value profile.
- **Evidence:** The guard requires `startRule.issuerRules.length === 0`. A private route probe using unchanged `setup()` and `https://canvas.instructure.com/api/lti/security/openid-configuration` recorded that exact URL in the outbound client's calls, before the route returned 400. The checked-in AC-05 test instead calls `fixedOnlyRegistry()`. Its helper tests prove the fixed-profile predicate, but do not prove the real route's boundary.
- **Ruling:** I asked about both readings: retain the union start rule and narrow AC-05, or require a common pre-fetch floor. The Lead relayed A2 **BD-A2-93** in `msg_5b2cf922cad3`: retain the union rule, and refuse non-HTTPS URLs, hosts failing site rules 1–3, and every reserved fixed host before any fetch, with `PLATFORM_URL_NOT_IN_PROFILE`, no fetch and no session. This includes the shared Canvas issuer, SSO hosts and twins, and Blackboard fixed hosts. The finding is confirmed, not pending a ruling. The Lead assigned the fix to lane L for round 2.
- **Suggested fix:** Put that common floor before `fetchConfiguration`, independently of the presence of admin rules. Replace the narrowed fixture test with a real mixed-registry route test that asserts the error code, zero outbound calls and zero sessions for each forbidden class. Keep positive checks for allowed configuration origins. Align the earlier SSO-fetch test with BD-A2-93; retain the `configuration_on_fixed_host` check at complete as a defensive guard if needed.

### B-LA-E3-09-02 — MINOR — Extension-key restrictions and the loader error do not match the documented contract

- **Where:** `services/lti-service/src/profiles/schema.ts:21`, `:43`, `:100`; `packages/channel-kernel/src/profiles.ts:46`.
- **Problem:** A channel author following BD-A1-105's “absolute https URL” rule can stop the service with a valid key and receive no explanation of the extra constraint.
- **Evidence:** `https://lms.example` and `https://lms.example/lti?x=1` are absolute HTTPS URLs, but `url.href === value` and the query/fragment ban reject them. The task spec and LA-ADR-02 D2 do not state those restrictions. Private loader probes for these keys, and for an HTTP key, all reported the member path followed only by `Invalid key in record`; the nested “Expected an absolute https URL…” issue is lost by the top-level issue formatter. The known Canvas keys pass, so this can be deferred.
- **Suggested fix:** Align the predicate with BD-A1-105, or have A1 document the stricter key syntax and explain why it is needed. Preserve the nested key-validation reason in the loader error. Add a test that checks the actual diagnostic, plus a valid root-URL case. Keep the existing eight-member limit, non-empty values and literal-value semantics.

### Ownership and refusal review

- The task's “Must not edit” paths are unchanged. The two-line kernel type addition is the explicit RQ-2 exception ratified by BD-A1-105. The remaining production changes are in L-owned profile, registration and store paths. No LMS name is added as a core behavior branch; the three vendor keys stay in the Canvas folder.
- The fixed-profile logic has named helpers and one exact-rule check at complete. The complete refusal names the selected profile and supplies `details.reason: configuration_on_fixed_host`; the tests check that no platform or upstream registration is created. Endpoint refusals put the exact member in the safe log detail, for example `not_profile_value=jwks_uri`, with a trace id on the public page.
- Start-page text still uses the no-context channel: the private Canvas error probe said “Check the Moodle site address”. This is the documented BD-A1-84 limit in LA-ADR-02 D5, not a new finding. The API's fixed-host reason remains useful to support.
- BD-A1-105 explains where to put the extension map, its member/value limits, literal values, request placement and provider-API omission. The schema mismatch above is the remaining author-facing gap. The unchanged standard-request equality test protects Moodle request parity.

### Verification

- Private clone: `/tmp/la-e3-09-review-b-3810ab04/repo`, made with `git clone --no-hardlinks`, with its own successful `npm ci`. Deleted `node_modules/.vitest-cache` before every Vitest run. No Docker, stack, stack runner or commit.
- **265 tests passed in eight files:** LTI registration helper and route tests, Canvas and trait tests, platform store tests, and app connection/redemption/redemption-admin tests. Lint, typecheck, F1 LMS-name fitness and F5 rules fitness passed.
- **K0:** 146 passed; exactly one expected failure, `K-LEGACY.canvas`, because the frozen baseline still says `dynamicRegistration: false`. This is the dispatched LA-IC-14 QA change, not an additional finding.
- Two private diagnostic probes passed and recorded the mixed-registry fetch, public action/log detail and extension-key errors. Negative controls were effective: removing the pre-fetch branch failed the existing AC-05 fixture test; removing request extension insertion failed the builder assertion and all three AP-05-29 route cases. All private edits were restored; the clone has only the intended staged merge and no unstaged changes.
- Logs and saved probes are under `/tmp/la-e3-09-review-b-3810ab04/`: `focused.log`, `k0.log`, `probes.log`, `probe-results.txt`, `prefetch-negative.log`, `extensions-negative.log`, and the lint/typecheck/fitness logs.
- AC-01–04 have useful unit support here, but their K1-SIM evidence, pre/post-grant learner launch, M1 simulations, portal companion and hosted Canvas validation remain QA/cut-group work. AC-05 remains open under B-LA-E3-09-01. No live Canvas claim is made.

## Round 2

Reviewed `487c6a3` (merge `3ca7538`) and the LA-IC-14 K0 assertion in `d41b8d2`, at integration snapshot `c362bc3`. **APPROVE: 0 open BLOCKER, 0 MAJOR, 0 MINOR.** Both Round 1 findings are closed; no new finding.

- **B-LA-E3-09-01 — CLOSED.** The route calls the shared `configurationUrlProblem` before the outbound client, independently of loaded admin-value rules. The old fixed-only branch and test registry are gone. The AC-05 route test uses the product registry and checks no outbound calls and no stored sessions for reserved issuer hosts, other reserved hosts, own hosts and invalid host names. My original shared-issuer probe now returns `ISSUER_RESERVED` with the unchanged M1 action and no fetch/session; SSO, beta SSO and an intranet name return `PLATFORM_URL_NOT_IN_PROFILE` with the expected safe log detail. BD-A2-94 and BD-A2-95 refine Round 1's BD-A2-93 requirement: HTTP and IP literals continue to the guarded client; reserved issuer hosts retain the legacy page. The helper, route, error-page and guarded-client tests pass. The stored-session test still proves the defensive `configuration_on_fixed_host` refusal at complete.
- **B-LA-E3-09-02 — CLOSED.** BD-A1-109 now documents normalized URL text, the root slash, and the query/fragment ban with accepted and refused examples. The loader preserves the member path and nested reason. The original bare-root, query and HTTP-key probes now explain the constraint; the normalized root key passes and its literal `{siteUrl}` value is unchanged. The checked-in diagnostic test checks the actual message.

Verification used a fresh `git clone --no-hardlinks` with its own successful `npm ci`, at `/var/folders/_h/pjt6zzrj46sctnb18tsmbzgw0000gn/T/la-e3-09-r2-review-b-dvl2idp1/repo`. Deleted `node_modules/.vitest-cache` before each Vitest run. **177 focused tests in six files and both private probes passed; all 147 K0 tests passed.** Lint, typecheck, F1 and F5 passed. The six files cover registration helpers/routes, profile traits/Canvas data, error-page text and the real outbound guard. The LA-IC-14 K0 change is limited to the declared Canvas capability flag and its explanatory comment; approved for this task.

Negative controls: bypassing the floor failed the checked-in AC-05 test and private route probe; restoring the old issue formatter failed the checked-in diagnostic test and private schema probe. All temporary edits were restored, and the private checkout is clean. Logs and saved probes are beside that checkout (`focused.log`, `k0.log`, `probes.log`, `probe-results.txt`, `prefetch-negative.log`, `diagnostic-negative.log`, and lint/typecheck/fitness logs).

The fix stays in L-owned files, respects the task's forbidden paths and adds no LMS-specific core branch. No Docker, stack runner, commit or other reviewer's file was used. This closes Reviewer-B's code-review findings; simulator/launch, portal-companion and hosted Canvas evidence remain with QA and the cut group as described in Round 1.
