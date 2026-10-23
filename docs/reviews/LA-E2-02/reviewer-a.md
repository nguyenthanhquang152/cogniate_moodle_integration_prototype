Verdict: CHANGES_REQUESTED
Round: 1

## Round 1

Reviewer-A: Codex GPT-6-Astra, xhigh. Lens: Is it right and is it safe?

Reviewed `7168908`, `ce0a506`, `ccddb68` and `9518f75`, merged by `865c3d0`, at integration snapshot `6d776696f6e0bd59590999c83a5b23b013879151`. Also read the A1 clarifications in `dd57f22` (BD-A1-82–84), which landed during this review. **Open: 2 BLOCKER, 3 MAJOR, 1 MINOR.**

### A-LA-E2-02-01 — BLOCKER — Existing platforms bypass the selected-profile boundary

**Files:** `services/lti-service/src/http/routes/registration.ts:287`, `:370`, `:388`; `services/lti-service/src/store/platforms.ts:233`.

The route validates the request's profile, but neither update path requires the existing platform to have that profile. `applyRegistrationUpdate` keeps the stored profile. Thus validation can use one channel's rules while the resulting platform continues to use another channel's token, privacy and launch rules. This breaks D5 items 3, 6 and 10.

**Evidence:** Two private route probes fail. First, seed an existing `standard` platform and complete a `zz-generic` registration for the same issuer/client using an opaque token and a configuration path that standard would reject: completion returns 200 and the platform still has `profile: standard`. Second, seed an inactive generic platform with a foreign audience and `bindingRef: pending-grant`; start a verified `reg-update` JWT for its deployment, then complete with `profile: standard` and its `updatePlatformId`. The response is 200 with `active: true`; the platform remains generic, with its foreign audience and pending-grant ref. No grant adoption occurred.

**Suggested fix:** Require profile identity on both the explicit-update and duplicate-client paths. Check a known update target before the remote POST; check a response-discovered collision in the local write transaction. Refuse cross-profile reuse without changing the existing record. Add both regressions; a profile change needs an explicit migration protocol, not this fallback.

### A-LA-E2-02-02 — BLOCKER — I-SELF checks a different audience from the one stored

**Files:** `services/lti-service/src/http/routes/registration.ts:326`, `:364`, `:389`; `services/lti-service/src/store/platforms.ts:235`.

When a new configuration omits `authorization_server`, `platformAud` is null and the route decides that I-SELF holds. The update SQL uses `COALESCE`, however, so a prior foreign `client_assertion_aud` survives. An active existing platform stays active with this unchecked audience. The same defect remains even when the supplied binding ref equals the stored ref.

**Evidence:** Seed an approved generic platform with token endpoint and audience `https://auth.idp.test/token`. Repeat DR for the same issuer/client and same binding ref, now with every endpoint on the issuer origin and no `authorization_server`. Completion returns `active: true`, changes the token URL to `https://lms.school.test/sakai/token`, and retains the foreign audience. A subsequent real token-client call signs `aud: https://auth.idp.test/token` and sends that assertion to the new issuer-host token URL. The private probe captures this destination/audience pair; it is not only a database inconsistency.

**Suggested fix:** Make an omitted audience in a complete configuration clear the old platform audience, or calculate staging from the actual merged values and require a grant for the retained foreign value. Validate and store the same effective credentials atomically. Cover both update paths and audience removal, not only creation with an explicit audience.

### A-LA-E2-02-03 — MAJOR — Repeat DR keeps tokens issued for the previous endpoint

**Files:** `services/lti-service/src/http/routes/registration.ts:371`, `:389`; `services/lti-service/src/platform/token-client.ts:99`.

Registration updates replace credential inputs while preserving the platform id. The token cache and in-flight map use only that id, scopes and optional deployment id. A token obtained from the old endpoint can therefore remain in use for up to an hour after completion changes the endpoint. This is independent of the retained-audience defect: it occurs with a null audience before and after the update.

**Evidence:** A private probe caches a token from `https://auth.idp.test/token`, completes an all-on-origin generic registration for the same platform and binding ref, then requests the same scope using the updated platform. Completion is active, but the token client returns the old foreign-endpoint token; its request history contains only the old endpoint. It never contacts the newly registered endpoint. AGS uses that returned token as its Bearer credential (`platform/ags.ts:234`).

**Suggested fix:** Include a credential generation or the effective credential tuple in cache/in-flight identity, or invalidate both safely on registration changes. An old in-flight request must not repopulate the new credential state. Add cache-hit and in-flight update regressions; coordinate the token-client edit with the Lead if it needs a scope extension.

### A-LA-E2-02-04 — MAJOR — A staged collision overwrites another connection's binding

**Files:** `services/lti-service/src/http/routes/registration.ts:388`; `services/lti-service/src/store/platforms.ts:235`.

The duplicate-client fallback changes an existing platform's endpoints, active state and binding ref without checking the current binding owner. The Moodle-era assumption that an account-level duplicate is a safe retry now applies to generic, grant-bound platforms. BD-A1-84 explicitly requires refusal of another connection's platform before restaging it.

**Evidence:** Seed an active generic platform with `bindingRef: owner-connection`. A new staged DR response with the same issuer/client and request ref `different-connection` returns 200, switches the existing platform off, replaces its token endpoint, and writes the new ref. The previous owner's conditional operations then lose their fencing value. The probe requires refusal with the old record unchanged and fails.

**Suggested fix:** Check ownership before updating a collision, within the same transaction as the write. Permit only the documented retry/adoption case; reject a different non-null binding ref and leave the existing record intact. Cover an active owner, a staged owner, a valid same-owner retry, and a concurrent binding rotation.

### A-LA-E2-02-05 — MAJOR — Invalid JWTs are downgraded to opaque tokens

**File:** `services/lti-service/src/http/routes/registration.ts:211`.

Once any opaque-token DR profile is loaded, every `INVALID_OPENID_CONFIGURATION` result from JWT verification becomes `opaque-bearer`. This includes an expired token, bad signature and invalid registration scope. BD-A1-84's D5 clarification says a JWT-shaped token is never treated as opaque. It also changes the existing Moodle refusal when a generic channel is installed.

**Evidence:** With the test generic profile loaded, a correctly signed Moodle registration JWT expired by 120 seconds returns 303 and creates an opaque session, instead of the existing 400 `INVALID_OPENID_CONFIGURATION` page. The committed legacy refusal test passes because its registry contains no opaque DR profile. A separate control confirms that an unreachable JWKS still produces `FETCH_FAILED`.

**Suggested fix:** Keep opaque acceptance in the non-JWS branch. Preserve the failure of a token that enters JWT verification. Run the expired, bad-signature and wrong-scope cases with both a baseline registry and an opaque-capable channel present.

### A-LA-E2-02-06 — MINOR — Migration 021 omits its ratified enum constraint

**File:** `services/lti-service/src/db/migrations/021_registration_token_kind.sql:4`.

BD-A1-77, the task notes and data-model §4.2 require `TEXT NULL CHECK (token_kind IN ('scope-jwt', 'opaque-bearer'))`; the migration adds unrestricted `TEXT`. A private database probe successfully stores `unknown-kind`. The route only rejects the specific opaque value for a scope-JWT profile, so an unexpected stored value is not fail-closed. Current typed writers emit valid values, making this a defensive schema defect rather than a demonstrated public-input bypass.

**Suggested fix:** Enforce the nullable enum in the migration and test both permitted values, NULL and rejection of an unknown value. Reject unexpected persisted kinds defensively at completion.

### Verification and scope

- In private clone `/tmp/la-review-a-a64d67e5ae5c`, the eight relevant committed unit files pass: **169 tests** covering registration routes/rules/store, checks, platform rules/routes, codes and manifest text. LTI-service, channel-kernel and channel Node type checks pass.
- Ten independent probes give **seven failing assertions** supporting the six findings and **three passing controls**: complete-time family refusal with a valid standard configuration URL, legacy NULL token kind without a second JWKS fetch, and JWKS-fetch failure without opaque downgrade. Reproduction code is `services/lti-service/src/http/routes/reviewer-a-dr-boundaries.test.ts` in that private clone; output is `reviewer-a-boundaries.log` there.
- AC-01 has new rule-table and route coverage. Its committed complete-time family test is masked by an earlier issuer/configuration-path refusal: disabling just that family check leaves the committed test passing, while the independent valid-URL control fails. Add that focused case when repairing the registration boundary tests. The Moodle manifest byte assertions and existing launch-check tests pass unchanged; LA-IC-03 has positive and negative path tests.
- The reviewed changes respect lane ownership: the K/Moodle text edits are the explicit RQ-2 commit, migration 021 is the assigned migration, and `checks.ts` changes only check 14. No app/bootstrap files or QA-owned tests changed. No new LMS-id dispatch was added to core code. The separately gated legacy-flag removal is outside these four commits.
- No Docker, stack, host stack runner, commit, or other reviewer's file was used. Only this review file changed in the integration worktree. K1-SIM, Moodle-live/G4 and the LD-9 QA assertion list remain for their authorized verification runs; these unit results do not close those rows.
