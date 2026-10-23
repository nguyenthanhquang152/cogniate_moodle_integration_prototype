Verdict: APPROVE
Round: 2

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

## Round 2

- Reviewer-A: Claude Code Opus 5.5 xhigh. It replaces the Codex Reviewer-A of round 1, which its provider's content filter stopped. Same lens.
- Diff:
  - `git diff 66d1a04 4d6eec9` (urgent fix `ddf3771`);
  - `git diff 2de8b78 3b3dadf` (fix round 1: RQ-2 `734de51`, `82a3321`, `e07ab16`, `87ac6cd`, `80e31d7`; the merge also holds LA-E2-01 `d6a0b82`).
- References: task notes (BD-A1-84, -87, -88, -89); A2 BD-A2-84 (build-decisions-A2.md:475); contract delta §4.5, §4.6.1; `packages/shared/src/migrations.ts:1-3`.
- I ran these in a private clone at `3b3dadf` (no Docker, no stack):
  - Vitest on `services/lti-service` and `packages/channel-kernel`: 98 files, 1303 tests pass.
  - `npm run test:k0`: 134 tests pass.
  - F1 PASS (0 hits); `npm run typecheck`: exit 0. ESLint on the product packages: clean.
  - The round 1 probe file: I copied it unchanged from the round 1 clone. Its 10 tests now pass: 7 that failed in round 1, plus the 3 controls.
  - My new probes: three edge cases of the fix, and a comparison of the start page with the M1 baseline (`865c3d0^1`, `4b0f003`).
- Blind review: I did not open the other reviewer's file.
- **Counts (open after round 2): 0 BLOCKER, 0 MAJOR, 2 MINOR (new), 1 NIT (new). All six round 1 findings are closed.**

### Round 1 findings: re-run

| Finding | Status | Fix and evidence at `3b3dadf` |
| --- | --- | --- |
| A-LA-E2-02-01 (BLOCKER): profile boundary | **Closed** | `updateProblem` (`http/routes/registration.ts:292`) refuses a different stored profile with `409 REGISTRATION_UPDATE_NOT_ALLOWED`, `details.reason` `profile_mismatch` (BD-A1-88). Explicit update: the check runs before the remote POST (`:301-306`). Duplicate client: it runs again inside the write transaction (`update`, `:396`, `:414`). Probe 1 (duplicate, stored `standard`): `409`, the record is unchanged. Probe 4 (verified `reg-update` with `profile: standard` on a staged generic record): `409`, the record is still inactive with `pending-grant` and its audience. Committed tests BD-A1-88 (a) and (b) check no remote POST and an unchanged row. |
| A-LA-E2-02-02 (BLOCKER): audience checked but not stored | **Closed** | `applyRegistrationUpdate` writes `client_assertion_aud` and `granted_scopes` with no `COALESCE` (BD-A1-89). I-SELF (`:342-343`) is decided on the exact `platformAud` that is stored. Probe 3: the update is active, and the stored audience is `null`. A real token-client call now sends `aud` = the issuer-origin token URL to that same URL. Before, the foreign audience went to the new host. Committed test: audience removal on both update paths. |
| A-LA-E2-02-03 (MAJOR): old-endpoint token reused | **Closed** | The cache and in-flight key now hold `platform.id`, `tokenEndpoint`, `clientId`, the effective `aud`, the scopes and the optional deployment (`platform/token-client.ts`). Probe 10: after the update, the token client asks the new endpoint and returns the new token. Committed tests cover a cache hit and an old request in flight that must not fill the new set. The M1 token requests do not change; only the internal key does. `platform/token-client.ts` is a lane L file outside this task's may-edit list; the round 1 fix suggestion asked for it, and the Lead's merge names it. |
| A-LA-E2-02-04 (MAJOR): staged collision overwrites another binding | **Closed** | `updateProblem` refuses a stored non-null `bindingRef` that differs from the request's, with `409 BINDING_REF_MISMATCH` and reason `platform_of_other_connection`, in the same transaction as the write. Probe 2: `409`, the record is unchanged. Committed tests: an active owner, a staged owner, a same-owner retry, and a rotation before `complete`. Note: the check runs only when the request has a `bindingRef`. It is required for every `any-https` profile. For `standard`, the M1 duplicate-client rule (B-T3b-02) does not change. |
| A-LA-E2-02-05 (MAJOR): JWT downgraded to opaque | **Closed** | `ddf3771`: only a token that does not parse as a JWS can be `opaque-bearer`. A JWS keeps its verification failure. Probe 5 (expired JWT, generic profile loaded): `400 INVALID_OPENID_CONFIGURATION`, no session. The JWKS-failure control still gives `FETCH_FAILED`. The committed test runs a bad signature, an expired token and a wrong scope with the product registry (where `lti-generic` is loaded) and with a baseline registry. |
| A-LA-E2-02-06 (MINOR): migration 021 CHECK | **Closed** | `CHECK (token_kind IN ('scope-jwt', 'opaque-bearer'))`. Probe 6 and the store test: an unknown value fails with a CHECK error. `complete` now refuses any stored kind outside the allowed list (fail closed). Follow-up: A-LA-E2-02-09. |
| Round 1 note: the AC-01 family test was masked | **Closed** | `e07ab16` adds the focused case: a standard-compatible configuration where only the family differs gives `400`, `family=zzdr`, no registration request, and the session stays open. The round 1 control passes too. |

### Other checks

| Check | Result |
| --- | --- |
| TOOL_MAY_EXIST (BD-A1-87) | Codes and reason do not change (`502 PLATFORM_ERROR`, `tool_may_exist`). The Moodle sentence filled with the tool name equals `pendingToolText` byte for byte (kernel test). Other channels get the neutral default (test for all four uncertain outcomes). The kernel key and the Moodle value come from the RQ-2 commit `734de51`, which the task note allows. |
| Start page, §4.6.1 order (`ddf3771`) | It follows rule 5 (rule 2, then 3, then 1) and AC-04. Comparison with M1 (`865c3d0^1`), nothing fetched in any case. With an `any-https` DR profile loaded (the product registry now loads `lti-generic`), a Blackboard configuration with every endpoint on `blackboard.com` gives `PLATFORM_URL_NOT_IN_PROFILE`. M1 gave `ISSUER_RESERVED` with "Connect it as Canvas or Blackboard". The realistic Canvas and Blackboard configurations (endpoints on `sso.canvaslms.com` or `developer.blackboard.com`) gave `INVALID_OPENID_CONFIGURATION` in M1 and now give `PLATFORM_URL_NOT_IN_PROFILE`. This matches AC-04 and D2a, so I record no finding. I found no frozen test with a DR `ISSUER_RESERVED` page in `tests/`; QA's G4 run decides. |
| Must-not-edit list | `http/app.ts`, `config.ts`, `main.ts` and app code are not changed. Channel-folder and kernel edits come only from RQ-2 `734de51`. |

### Findings (round 2)

- **A-LA-E2-02-07 (MINOR): the explicit update path activates a staged platform when the new configuration meets I-SELF.**
  - Where: `services/lti-service/src/http/routes/registration.ts:381` (`active: staged ? false : body.data.autoActivate ?? true`) and `:396` (the explicit path passes `values.active`). The duplicate path keeps the stored value (`:414`).
  - Problem: the BD-A1-89 task note says "staged = inactive, I-SELF = stored `active` kept". On the explicit path, a stored staged platform (inactive, waiting for a grant) becomes active, and its pending `bindingRef` is kept. Contract §4.5 says that for a staged registration "only the grant redemption activates the platform".
  - Evidence: my probe with a test `scope-jwt` `any-https` profile. Seed: inactive, `bindingRef: pending-grant`, foreign token URL and audience. Then a verified `reg-update` with an I-SELF configuration and the same `bindingRef`. Result: `200`, `active: true`, `bindingRef: pending-grant`, audience `null`. The same seed on the duplicate path stays inactive.
  - Why MINOR: no product profile reaches this path today. An explicit update needs a scope-JWT token. The only scope-JWT DR profile is `standard`, which is never staged, and `lti-generic` takes opaque tokens, so its operation is always `new`. Also, after the update every value is on the issuer origin, so I-SELF holds. The app still gates launches by the connection's authority.
  - Suggested fix: ask A1 whether "stored `active` kept" also covers the explicit path. If yes, keep the stored value when the stored platform is staged (inactive with a binding ref). Keep the M1 `autoActivate` rule for the Moodle explicit update, so T3b does not change. Add one test.

- **A-LA-E2-02-08 (MINOR): a staged `complete` stores an `authorization_server` on a reserved host.**
  - Where: `services/lti-service/src/http/routes/registration.ts:342` (`platformAud` is taken from the configuration with no host rule); `lti/registration.ts:135`.
  - Evidence: probe with a configuration whose token URL is `https://auth.idp.test/token` and whose `authorization_server` is the Blackboard gateway token URL. Start `303`, then `complete` `200`, `active: false`, and the audience is stored.
  - Problem: this is the Dynamic Registration twin of A-LA-E2-01-01. A2 BD-A2-84 (and the A2 note being added to this task) requires rule 2 for the audience in every create, staged too.
  - Suggested fix: apply `endpointHostProblem` to a URL-shaped `authorization_server`, in `parseOpenIdConfiguration` or before the staged decision. Refuse with `PLATFORM_URL_NOT_IN_PROFILE` before anything is sent. Add the test that the note names.

- **A-LA-E2-02-09 (NIT): migration `021` was changed after it was merged.**
  - Where: `services/lti-service/src/db/migrations/021_registration_token_kind.sql:4` (`82a3321`). The shared runner stores each applied file's SHA-256 and stops the start when an applied file changes (`packages/shared/src/migrations.ts:1-3`, "never edit an applied migration").
  - Impact: any LA database that applied the old `021` (integration SHAs `865c3d0` to before `3b3dadf`) now stops at start. Authors work host-only, and the Docker window was held, so probably no such database exists.
  - Suggested fix: the Lead confirms that no persistent LA database applied the old file, or recreates that database, and writes one line in the board. The alternative (a new `022` that rebuilds the table) costs more than it gives before release.

### Verdict (round 2)

APPROVE for lens A. All round 1 BLOCKER and MAJOR findings are closed: each has a committed test, and the round 1 probes pass unchanged. A-07 waits for an A1 answer and A-08 implements the A2 ruling BD-A2-84; both are MINOR and can land with the lane L change for BD-A2-83/84. My reproduction files are in `/tmp/ra-e201/` (private clone; not committed).
