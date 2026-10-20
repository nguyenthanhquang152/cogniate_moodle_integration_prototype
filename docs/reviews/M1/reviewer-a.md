Verdict: APPROVE
Round: 1

# M1 review: Reviewer-A (correctness and security)

## Round 1 (2026-10-20)

| Item | Value |
| --- | --- |
| Verdict | **APPROVE** for the M1 code at the product revision below, from the correctness and security lens. No BLOCKER or MAJOR is open. This is a code review. It is **not** product acceptance (QA has not run the suites) and it is **not** live interoperability evidence. |
| Product revision | `76b03c7f24c15de2f7e164b836b27a398d45158a`. Full review at `1e2c81f58a1474836fdc0913e4f7a87d75f95298`, plus the delta `1e2c81f..76b03c7` (only `services/cogniate-app/src/config.ts` and its new test change product behaviour). |
| Test revision | `9964e6f132e6608216616bff621e3f9ba5667b04` (product paths identical to `76b03c7`). Common and Blackboard harness from `6733e57`, Canvas harness added at `9964e6f`. |
| Baselines | Behaviour `56591df` (ADR-011 revision 6). Implementation `2941140`. |
| Reviewer | Reviewer-A, Claude Code Opus 5.5, xhigh, the retained instance. Task `task_def3c0e1323e`, dispatch `ctx_8abc3ceb148c`. |
| Independence | I did not read any Reviewer-B report. I wrote no product, test or architecture file. |
| Method | Static reading of every changed service, package, infra and app path in a clean clone (`/tmp/rva-impl-1e2c81f`), traced against ADR-011 rev 6, both contracts, data model, security and M1. No stack was started. |
| Checks | I did not run the root check myself (the clean clone has no `node_modules`, and installing needs network). Author-side evidence only: the Lead's isolated root check at `1e2c81f` (lint, typechecks, 876 tests in 66 files, 0 skips, `/tmp/cogniate-lead-foundation.bzkF2F.final-implementation-check.log`) and the Author's check at `76b03c7` (889 tests in 67 files, `/tmp/au-check-am101.log`). These are not independent evidence. |

### Findings

| Id | Sev. | Status | File:line | Problem | Evidence | Fix |
| --- | --- | --- | --- | --- | --- | --- |
| A-M1-01 | MINOR | **Closed at `76b03c7`** | `services/cogniate-app/src/config.ts` L35–40, L49 at `1e2c81f` | The app accepted the test override `LTI_API_URL` in every `STACK_PROFILE`, and then sent every `/api/*` call with the LTI API key to that origin. | Phase plan "Test environment decisions": test overrides stay unavailable in production. M3 §3.3: in every other profile the app calls the LTI service directly. Only `infra/scripts/lib.sh` limited it. The LTI service's simulation switch already needs both the profile and the variable. | `76b03c7`: `loadConfig` refuses a set `LTI_API_URL` unless `STACK_PROFILE=acceptance`, and refuses a non-origin value. The service (`main.ts`) and the operator CLI (`cli/operator-runtime.ts` L14) both use `loadConfig`. 13 unit cases in `config.test.ts`. Verified by reading; I did not run them. |
| A-M1-02 | NIT | Open | `services/cogniate-app/src/domain/bindings.ts` L281–286 | `writeApproval` deletes an existing approval row of **any** disabled connection for the same key. Data model §4.2 "Approvals" names only the Blackboard same-library move. | Today the two rules give the same result: another library cannot reach phase 2 for that key while the old reservation exists, and `release` deletes the old row together with the reservation. | Add `AND library_id = ?` (the new approval's library), or state the broader rule in the data model. Safe to defer. |

### Areas checked (code reading)

| Area | Result | Where |
| --- | --- | --- |
| Provider profiles | The values equal ADR-011 §6; one registry; simulation ids only with profile `acceptance` **and** `LTI_PROVIDER_SIMULATION=on`; reserved issuer origins (including dynamic registration); a stored profile that is unknown at run time is inactive for login, launch and API calls. | LTI `profiles/*.ts`, `lti/binding.ts`, `http/routes/platforms.ts`, `routes/registration.ts` |
| Login and launch | Login rule 3 (known and active login deployment, kept in the state); checks 1–12 unchanged; check 9 (same as the login deployment, active); check 13 (service URLs on the service origin, return URL on the site origin, detail `claim=… host=…`); check 14 for every profile, before the allowlist and before storage; origins come from stored rows, never from claims. | `lti/login.ts`, `lti/launch.ts`, `lti/checks.ts` |
| Claim allowlist | Exact ADR-011 §9 members; removed names logged without values; `custom` and `lis` removed. | `lti/claims.ts`, `routes/protocol.ts` |
| Fence and staging | A conditional PATCH needs a new ref (`bindingRef` ≠ `ifBindingRef`), and it is compared with the current value in one transaction; creates can be inactive; generation: staged 0, every activation and every adoption of an active row + 1, switch-off unchanged; conditional DELETE. | `lti/platform-rules.ts` `checkRotation`, `store/platforms.ts`, `routes/platforms.ts` |
| Service authority | The LTI service checks generation, platform state and deployment state (`platformOf`) **before** `/api/idtoken` issues a service key, so an old ltik cannot issue a key of an old generation; generation 0 keeps the old HMAC input. | `http/service-context.ts`, `routes/idtoken.ts`, `store/service-keys.ts` |
| Deep Linking and tokens | Target = the claim exactly as received (query included), on the site origin; `data` echoed only if sent; `sub` only for Blackboard; client assertion `aud` array only for Blackboard; one scope per call; token cache keyed by platform id and scope. | `lti/deep-linking.ts`, `platform/token-client.ts`, `platform/ags.ts` |
| Redemption engine | Phase 1 checks 1–7 in contract order in one `BEGIN IMMEDIATE` transaction; one live attempt per connection (60 s lease); S0 before every LTI call (≥ 6 s left, grant and state before S1–S3); mutating LTI calls have the 5 s timeout and no retry; S1 staged inactive with a write-ahead ref; S2 adoption rows A1–A3 with `history_floor`; S3 activation with a new ref; at most two mismatches; phase 2 writes the approval and redeems in one transaction; compensation only on its own activation ref. | `app/redemption.ts`, `domain/bindings.ts`, `app/binding-targets.ts` |
| Authority and routing | Only an `approved_deployment` row of a `registered` or `connected` Canvas or Blackboard connection routes a launch; otherwise `deployment_not_approved` or `unknown_platform`; then the site and service check and the LMS check (`lms_mismatch`); then roles (staff or admin for Deep Linking; graded only with a learner role and no staff role). Moodle keeps routing by `lti_platform_id`; its site check holds because existing Moodle `siteUrl` values equal the issuer origin. | `domain/connections.ts` `routeLaunch`, `tool-pages/launch.ts`, `packages/shared/src/roles.ts` |
| Cleanup owners | Fence-out, revoke cleanup and release find records through the committed binding **and** every attempt target (Canvas `initial`: lookup by exact `url`, `clientId` and `profile`); every write is conditional with a write-ahead ref; release refuses while a lease is live or an owned record is active, deletes owned inactive Canvas platforms with `?ifBindingRef`, and deletes only its own reservation and approvals. | `app/binding-cleanup.ts`, `app/operator.ts`, `cli/*.ts` |
| Grants and operator CLI | 256-bit code, hash only; `--library` cross-check and printed names before the code; a replacement revokes older open grants; revoke of a redeemed grant refused; audit lines written before exit; no code in logs. | `app/operator.ts`, `cli/grant.ts`, `cli/operator-runtime.ts` |
| Disabled connections | The worker sends nothing for a disabled Canvas or Blackboard connection and fails the row at its due time (`CONNECTION_DISABLED`, tries unchanged); Resend and Refresh give `409`. | `worker/score-sync.ts`, `domain/score-syncs.ts`, `app/results.ts` |
| Canvas pages and JSON | Embedded page continues only at top level (nonce script, `frame-ancestors {site}`); picker and return target on the site origin; `window` hint only when accepted; JSON with one `assignment_selection` placement, `privacy_level: anonymous`, the active key first for `?jwk=inline`. | `tool-pages/canvas-embedded.ts`, `play.ts`, `picker.ts`, `app/canvas-configuration.ts` |
| Migrations | `004` and `011` are additive, with old-row defaults; generation 0 keeps today's key values. | `db/migrations/004_provider_profiles.sql`, `domain/migrations/011_lms_types.sql` |
| Platform 422 | `PLATFORM_REJECTED_REQUEST` in the LTI service, `failed` without retry in the app. | `platform/error-mapping.ts`, `packages/tracking/src/outcome.ts` |

### Criteria covered by this report

"Code" = the behaviour that the criterion needs is present in the reviewed code. "Rows" = the prepared QA rows at `9964e6f` (common, Blackboard, Canvas). No row has run, so no criterion has PASS evidence. AC-M1-23 and AC-M1-30 are `MOODLE-LIVE`; all others are `SIM`.

| AC | Code | Rows | AC | Code | Rows |
| --- | --- | --- | --- | --- | --- |
| 01 profiles | yes | common, Blackboard | 21 capability guards | yes (409 before any outbound call) | Blackboard, Canvas, common |
| 02 default profile | yes | common | 22 site check and texts | yes | Blackboard, Canvas |
| 03 standard and reserved issuers | yes | common | 23 upgrade | yes (`stack-data.sh` refuses while a service runs) | common |
| 04 fixed endpoints | yes | Blackboard, Canvas | 24 logs and secrets | yes (no code, token or assertion in logs) | common, Canvas |
| 05 site rules | yes (one shared function) | Blackboard, Canvas | 25 `platform.siteUrl` and `profile` | yes | common, Blackboard, Canvas |
| 06 shared platform | yes | Blackboard | 26 self-hosted Canvas | yes | Canvas |
| 07 deployments, staging, rotation | yes | common, Blackboard, Canvas | 27 binding generation | yes | Blackboard |
| 08 Canvas login and Deep Linking | yes | Canvas | 28 grants (positive) | yes | Blackboard, Canvas (via 17) |
| 09 Canvas grade return | yes | Canvas | 29 grants (negative) | yes | Blackboard, Canvas |
| 10 Blackboard Deep Linking | yes | Blackboard | 30 rollback | yes (full validation before any change) | common |
| 11 Blackboard grade return | yes | Blackboard | 31 portal routes, publication fields | yes | Blackboard, Canvas |
| 12 check 13 | yes | common, Blackboard, Canvas | 32 page and service origins | yes | Canvas |
| 13 routing and deployment state | yes | Blackboard, Canvas | 33 platform score errors | yes | Blackboard, Canvas |
| 14 claim allowlist | yes | common, Blackboard, Canvas | 34 per-profile cryptographic refusals | yes (unchanged checks 1–12) | Blackboard, Canvas |
| 15 connections API | yes | common, Blackboard, Canvas | 35 simulation gate combinations | yes | common |
| 16 roles | yes | Canvas | 36 service key URL isolation | yes (claims passed check 13; §3.4 rule unchanged) | Blackboard, Canvas |
| 17 Canvas registration | yes | Canvas | 37 redemption faults and races, (a)–(u), (c2) | yes, traced for every named subcase | Blackboard (16 rows), Canvas (21 rows) |
| 18 disconnect | yes | Blackboard, Canvas | 38 containment and recovery, (a)–(g) | yes | Blackboard (6 rows), Canvas (7 rows) |
| 19 configuration documents | yes | common, Blackboard, Canvas | 39 signed product family | yes (LTI check 14 plus app `lms_mismatch`) | common, Canvas |
| 20 Canvas deployments | yes (no-grant `200` only with an approval) | Canvas | 40 third page host | yes | Canvas |

### Harness review (tests at `9964e6f`)

- Independence: no test imports `services/`, `apps/` or `@cogniate` code; no `skip`, `only`, `todo` or `fixme`; simulator keys exist only in memory; no real vendor host name is used.
- Completeness: the common, Blackboard and Canvas manifests together account for every criterion above, every named AC-M1-37 and AC-M1-38 subcase, and a separate Canvas row for each both-provider race. The oracles that I sampled (AC-M1-37 c2, d, t, u; AC-M1-38 f) match the traced product behaviour. This includes `unknown_platform` for an unapproved Canvas `initial` record and `deployment_not_approved` for a Canvas added deployment.
- Open QA items C-1 to C-5 (Canvas plan) are wording or reachability questions for the Architect and the Lead. None of them needs a product change from my lens. For C-2, `canvas-deployments.ts` checks the status before the body and the grant, so the expected `409 CONNECTION_NOT_READY` is reachable.

### Scope limits

- A-M0-10 stays the accepted MINOR deferral exactly as approved: after a release, a grant-free `standard` connect can take a released **`canvas-self-hosted`** issuer and client id first. Check 14 refuses its Canvas-signed launches before any claim is stored. The code does not claim to close this race, and this review does not broaden or strengthen that guarantee.
- No live Canvas or Blackboard row was exercised. `SIM` results never prove "works with Canvas" or "works with Blackboard".
- Author repairs after `76b03c7` (for example the uncommitted score-sync changes in the working tree when I wrote this) are outside this round. They get a new review round.
