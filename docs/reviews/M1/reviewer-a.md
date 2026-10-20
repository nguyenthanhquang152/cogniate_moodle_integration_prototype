Verdict: APPROVE
Round: 3

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

## Round 2 (2026-10-20): integrated implementation and harness

| Item | Value |
| --- | --- |
| Verdict | **CHANGES_REQUESTED**. The local-preflight defect B-M1-03 is repaired, but the binding read path still has two bounded-call defects. Two audit defects and the harness capture defect A-M3-01 also need disposition. The earlier code and design approvals do not approve this candidate. |
| Exact reviewed SHA | **`eb43247d02df622d5da72dafac41d919f65a91fe`**, product and harness together, detached in `/tmp/cogniate-review-a-eb43247.XUbPtw`. |
| Normative basis | Applied contracts **`ccdd9ef67cdd2be4c6af374136777fda4e081943`**, ADR-011, and M1/M2/M3 task specifications. Proposal `78bc34a` and design approvals `b6e8f73` are history. |
| Reviewer and authority | Independent replacement Reviewer-A, Codex GPT-6-Astra, xhigh, authorized by the current team brief at `1cb392e`. Task `task_74de10f72cf9`, dispatch `ctx_3604d1e6a48e`. This is not a cross-model review. No delegation. |
| Start gate | Lead supplied the frozen SHA after implementation and harness commits and reported a passing root check: lint, typechecks, 996 tests in 69 files, zero skips. That root-check result is Lead evidence, not my execution. |
| Independence | I used my Round 1 reports and earlier shared findings, including historical Reviewer-B reports at `689e424` and `f89262c`. I did not read Reviewer-B's new review or exchange conclusions with that reviewer. |
| Boundary | Static integrated review plus the supplemental checks below. No stack, browser acceptance, full M1 run, live tenant, public exposure, commit, or push. Only my three review reports changed in the shared workspace; they are held for Lead commit. |

### New findings

All file and line references in this round are at the exact reviewed SHA.

**A-M1-03 — MAJOR — Canvas S2 sends a second lookup without S0.**

Location: `services/cogniate-app/src/app/redemption.ts:261` and `:318`–`:319`.

The outer S0 protects `readTarget` once. When the profile-qualified Canvas lookup returns no row, `readTarget` immediately performs a second, unqualified lookup. It does not recheck revocation, connection state, lease ownership, or remaining lease time. The applied app contract §4.7.1 requires S0 before **every** call and no further S1–S3 calls after cancellation. This also adds a call outside the stated five-call Canvas sequence.

Independent supplemental probe: run the real engine and repositories on an in-memory migrated database; make S1 answer `409 PLATFORM_ALREADY_EXISTS`; revoke the actual grant while the first S2 lookup returns `[]`. The captured second query had `revoked: true`. When it also returned `[]`, the handler answered `502 LTI_SERVICE_ERROR`, rather than taking the cancellation path before another lookup. No unauthorized approval was demonstrated; the defect is the missing cancellation/lease gate and extra call. Preserve the required `PLATFORM_IN_USE` result for a conflicting `standard` record, but make that lookup fit the approved S0 and call-count rules. Add a control for cancellation and insufficient lease time between the reads.

**A-M1-04 — MAJOR — Binding GETs inherit an automatic retry outside S0 and the five-second step bound.**

Location: `services/cogniate-app/src/clients/lti-client.ts:193`–`:197`, `:224`, `:228`–`:238`; `packages/shared/src/outbound.ts:224`, `:247`–`:248`.

The app's V/S2 reads use the default outbound GET policy. A `network_error` starts a second wire request with a fresh five-second timer, without returning to the engine's S0. The binding contract §4.7.1 specifically bounds V to five seconds and requires every attempt call to pass S0; its failure path ends the attempt on a failed call. The general LTI-to-platform GET retry in LTI contract §4 is not a reason to change Moodle transport or to bypass the binding-specific rules.

Independent supplemental probe: use the real app LTI client and shared outbound client with only the HTTP request boundary controlled. The first `/api/providers` request emitted `ECONNRESET` after 4,100 ms; the second answered after another 4,100 ms. One `getProviders` invocation succeeded after **8,215 ms**, with wire requests at 2 ms and 4,109 ms. No timeout constant was changed. Give binding reads the approved bounded policy, with no hidden retry outside S0; preserve unrelated transport behavior. Verify a delayed network error, cancellation before a retry would start, and the exact five-second/60-second limits.

**A-M1-05 — MINOR — Phase-1 refusal events lose the HTTP trace.**

Location: `services/cogniate-app/src/app/redemption.ts:62`–`:64`; `packages/shared/src/logger.ts:137`–`:140`.

`reject` logs `grant_rejected` without the request's `trace_id`. The logger substitutes its boot trace. App contract §12 reserves that trace for lifecycle events. In the production-engine probe, the expected trace was `review-request-123456789`, but the event used `boot-4be85f9244a1`. This breaks request correlation and the new exact-trace assertions in `tests/acceptance/M1/blackboard/52-snapshot.test.ts:46`, the Canvas snapshot refusals, and `common/snapshot-migration.probe.ts:93` and `:117`. Pass the request trace to every phase-1 rejection. Keep the precise reason, local precedence, and secret exclusions; do not weaken those harness assertions. The API refusal itself remains correct.

**A-M1-06 — MINOR — `grant_redeemed` is emitted before the phase-2 commit.**

Location: `services/cogniate-app/src/app/redemption.ts:365`, `:391`–`:394`; `packages/shared/src/migrations.ts:21`–`:30`.

The success event is inside the transaction callback. `transaction` executes `COMMIT` only after that callback returns. App contract §4.7.1 says to commit, then log the success. A successful probe observed `grant_attempt_started` with `db.isTransaction=false` but `grant_redeemed` with `db.isTransaction=true`. A second probe installed a test-only deferred foreign-key trigger in the disposable in-memory database. Phase-2 COMMIT then failed and rolled back: connection `pending`, zero approvals, and grant `redeemed_at=null`, but **one `grant_redeemed` event had already been emitted**. Move the success event after the transaction returns successfully. This is an audit-integrity defect; the probe did not show committed unauthorized data. The fault fixture is supplemental and is not a proposed migration.

**Related harness finding: A-M3-01 — MAJOR.** See Round 2 of `../M3/reviewer-a.md`. Several new snapshot/readiness/upgrade assertions observe only a selected GET rule, or no rules, while the gate forwards unmatched methods without events. Some positive assertions cannot pass; some zero-call assertions cannot detect an unexpected call. Harness-only checks do not close this defect.

### Prior findings and applied repair

| Finding | Round 2 disposition |
| --- | --- |
| A-M1-01 | Closed. The acceptance-only `LTI_API_URL` guard remains in the service and operator configuration paths; the targeted config tests pass. |
| A-M1-02 | **NIT, open, safe to defer**, unchanged from Round 1. The `writeApproval` evidence at `domain/bindings.ts:281`–`:286` has not changed. This round does not promote or close it. |
| B-M1-01 | The stale worker-batch and post-lookup send gaps are repaired in the inspected path. The worker rereads current connection state, and `beginSend` checks again after the awaited line-item lookup. The score-sync unit suite passed. Full wire-level acceptance is still pending. |
| B-M1-02 | The backup/restore guard now requires positive Docker/Compose stopped-state evidence; unknown/unavailable status is refused. The targeted stack-data tests passed. No real backup/restore run was performed here. |
| B-M1-03 | The original provider-read-before-local-refusal defect is closed by static tracing and the targeted tests. All three endpoints enter the same engine after local route/body guards; phase 1 captures the target atomically before V or S1. This closure does not close A-M1-03/A-M1-04 or approve the repaired candidate. |
| A-M0-10 | Accepted historical MINOR deferral stays limited to `canvas-self-hosted` identifier reoccupation by `standard` after release. No wider guarantee is claimed. |

### Static correctness and security trace

| Area | Result and limits |
| --- | --- |
| Three endpoints and phase 1 | Blackboard initial PUT, Canvas initial PUT, and Canvas add-deployment POST use one `createRedemptionEngine`. Library ownership and provider capability are local. Canvas add checks registered/platform state before its strict body, as specified. Finalized repeats are local. Grant checks 1–4, snapshot check 4a, mismatch, lease and reservation checks keep their specified order. Attempt, target, lease and reservation commit in one transaction; `grant_attempt_started` follows that commit. |
| Snapshot creation and privacy | `app/connections.ts` captures the snapshot from the same provider response used for creation and stores it with the new connection. Canvas pins the issuer; Blackboard pins issuer, client and platform id. DTOs omit the fields. Normal state/name updates do not refresh them; Moodle stores no provider snapshot. |
| Migration and old 011 | `012_connection_provider_snapshot.sql` is additive; 011 is unchanged and existing rows are not backfilled. An old pending initial connection with a valid grant reaches `no_snapshot`; invalid grants still fail earlier. Old registered repeat and Canvas add use committed platform data. Cleanup can recover old attempts from saved target/ref history without fabricating a snapshot. Migration-unit checks passed; actual paired upgrade/restore remains pending. |
| V and S1 readiness | Blackboard V compares the captured platform id/client/issuer and sharing/active state. Post-V and mapped S1 readiness decisions check takeover, connection change, and revoke/replacement before reporting readiness or transport failure. Replacement of the shared platform does not retarget a captured attempt. Deactivation after V can allow the approved registration race, while LTI parent-state checks still deny launch authority. |
| Canvas issuer pin and errors | Canvas S1 sends the captured issuer in `url`. `UNKNOWN_PROFILE` and `PLATFORM_URL_NOT_IN_PROFILE` enter the cancellation-first readiness decision. `PROVIDER_NOT_READY` title/action are provider-neutral and agree across server and portal. |
| I1–I6, leases and refs | Approval is required for application launch authority; staged records are inactive; activation and compensation use new write-ahead refs and conditional ownership; adoption observes the history floor; lease takeover cannot clear another attempt's lease. The constants remain 60,000 ms and a 6,000 ms minimum before calls. **The all-call S0 and five-second claims are not fully satisfied**, as A-M1-03/A-M1-04 show. I do not give an unqualified I1–I6 approval. |
| Cleanup | DELETE/suspend/revoke/release inspect committed ownership and attempt history, including exact Canvas issuer/client/profile lookup. They fence only owned refs, retain required reservation/history until release, and refuse release while a live attempt or active owned record prevents it. |
| LTI and tenant boundaries | Account-scoped admin storage, approved-deployment routing, profile family checks, exact origins, active platform/deployment and binding generation checks remain in the shared LTI path. Service-key authority is checked before issuance; generation-zero key input is unchanged. Deep Linking preserves the exact return target including query and optional data; Blackboard assertion `aud`/Deep Linking `sub` differ from Canvas as specified. No new tenant crossover was found in the inspected paths. |
| Production/Moodle boundary | Simulation profiles still need acceptance profile plus simulation opt-in. The transport-gate override remains acceptance-only. No production test exception was added. Moodle routing, generation-zero key compatibility, provider texts and the existing dynamic-registration timeout policy are retained; this is source/unit evidence, not Moodle-live evidence. |

### Supplemental commands and results

All commands below ran in `/tmp/cogniate-review-a-eb43247.XUbPtw` at the frozen SHA. Dependencies were installed from the existing cache with `npm ci --offline --ignore-scripts --no-audit --no-fund` and `npm --prefix tests ci --offline --ignore-scripts --no-audit --no-fund`; both exited 0.

```sh
COURSE_FIXTURES_DIR=/Users/quangnguyen/Workspaces/personal/cogniate_moodle_integration_prototype/docs/raw/data/courses npm run test:unit -- \
  services/cogniate-app/src/app/redemption.test.ts \
  services/cogniate-app/src/app/canvas-deployments.test.ts \
  services/cogniate-app/src/domain/migration-011.test.ts \
  services/cogniate-app/src/domain/migration-012.test.ts \
  services/cogniate-app/src/worker/score-sync.test.ts \
  services/cogniate-app/src/providers/canvas.test.ts \
  services/cogniate-app/src/config.test.ts \
  services/lti-service/src/http/routes/multi-lms.test.ts \
  services/lti-service/src/profiles/canvas.test.ts \
  services/lti-service/src/cli/stack-data.test.ts

node tests/host/run-m1.mjs --harness-only --provider all
node --test tests/acceptance/M1/canvas/snapshot-oracle.selftest.mjs
```

- Unit command: **183 passed, 10 files, zero skips**, exit 0. Log `/tmp/cogniate-review-a-eb43247-unit.log`.
- M1 harness-only: **27 self-tests passed**, tests typecheck passed, **392 API cases plus 24 host rows** discovered, exit 0. Log `/tmp/cogniate-review-a-eb43247-harness.log`. Discovery is not execution of those cases.
- Canvas oracle self-test: **3 passed, zero skips**, exit 0. Log `/tmp/cogniate-review-a-eb43247-canvas-oracle.log`.
- Four independent diagnostic invocations used `node --input-type=module` with scripts supplied on stdin. They exercised the real engine/repositories, outbound client, SQLite COMMIT boundary, and actual gate source respectively. The schedules, controls and observed outputs are described in A-M1-03 through A-M1-06 and A-M3-01. Logs: `/tmp/cogniate-review-a-eb43247-engine-probes.log`, `-read-bound-probe.log`, `-commit-probe.log`, and `-gate-probe.log`. These are local diagnostics, not persisted acceptance tests or an independent simulator. They do not implement a second copy of the binding algorithm.
- M2 unit/harness commands and results are recorded in that report; total focused product unit tests across the two commands: **234 passed**.

### Acceptance still pending

QA must still execute the repaired candidate through the authorized fresh/restart snapshot, isolated readiness, old-011 upgrade, both complete-run inventories, Moodle regression/migration/rollback and M2 browser routes. Neither my focused units nor internal fault fixtures establish these results. SIM evidence remains distinct from `MOODLE-LIVE` and live Canvas/Blackboard interoperability; no live row was run or promoted by this review.

## Round 3 (2026-10-20): bounded correction re-review

| Item | Value |
| --- | --- |
| Verdict | **APPROVE** for the M1 implementation correction. A-M1-03 through A-M1-06 are closed at this SHA. A-M1-02 remains the accepted open NIT. This is not release or acceptance approval: M3 has a newly identified MAJOR harness finding, A-M3-02. |
| Exact product and test SHA | **`ae130a3501f3a2502c6a34e36319629e3dcdfb09`**, compared with `eb43247d02df622d5da72dafac41d919f65a91fe`. All candidate reads and executions used detached local clone `/tmp/cogniate-review-a-ae130a3.ketuxd`. |
| Repair commits | Common/Blackboard capture and host CLI: `41ee174ddcd4cd5c925b09d7c57ef9f8ceaa03b9`; Canvas capture and M2 order: `feb36b112edd4173094e0ba3d38ccfc0a549fb35`; backend: `ae130a3501f3a2502c6a34e36319629e3dcdfb09`. |
| Basis and interpretation | Applied contracts `ccdd9ef67cdd2be4c6af374136777fda4e081943`, ADR-011 and M1/M2/M3 criteria. Lead interpretation `msg_742788eff0bb` was assessed against the actual S2/target/adoption rules below. No contract was edited or treated as newly approved. |
| Reviewer | Retained independent replacement Reviewer-A, Codex GPT-6-Astra xhigh; role extension `e8fbb53`; task `task_e0177b2e9a56`, dispatch `ctx_2b5524d3ba70`. No delegation. |
| Independence and scope | Used my submitted Round 2 at `af5d5f6` and already-submitted B review at `9680bb7`. Did not read the other reviewer's new re-review or exchange conclusions with that reviewer. No product/test edits, stack, browser run, live tenant, public exposure, commit or push. Only my existing three reports are held for Lead commit. |

### Finding disposition and conformance

| Finding | Disposition, evidence and location at `ae130a3` |
| --- | --- |
| A-M1-03, unguarded Canvas S2 fallback | **CLOSED.** `app/redemption.ts:267`–`:283`, `:323`–`:334` use one qualified lookup when the platform id is not yet known. There is no unqualified fallback. An empty successful list response runs the local S0 check before returning `PLATFORM_IN_USE`. Revocation/replacement, state change, takeover, cleared lease and less than six seconds remaining all stop without another wire call. Independent probes cover these branches. |
| A-M1-04, hidden GET retry and timeout | **CLOSED.** V and all S2 read forms pass `singleAttempt: true` at `app/redemption.ts:237`, `:327`–`:334`. `clients/lti-client.ts:186` maps it to `timeoutMs: 5000, retryNetworkError: false`; `packages/shared/src/outbound.ts:250` honors the opt-out. The default GET retry remains enabled for unrelated calls. Real-client/transport-boundary probes and the focused tests verify both behaviors. |
| A-M1-05, refusal trace | **CLOSED.** `app/redemption.ts:62`–`:64`, `:87`, `:108`, `:112` pass `req.traceId` to every grant-invalid/mismatch log path. Exact request trace, reason and secret exclusions are retained. All three endpoint families passed the colocated reason matrix; independent unknown-code/mismatch probes also passed with zero remote calls. |
| A-M1-06, pre-COMMIT success event | **CLOSED.** `app/redemption.ts:306`–`:310` emits `grant_redeemed` only after `phase2` returns from `transaction`. Independent successful runs observed it with no open transaction. Deferred-FK COMMIT failure on all three binding families left no approval or redeemed grant and emitted no success event. The internal fault fixture remains supplemental. |
| A-M1-02 | **NIT, open, safe to defer**, unchanged. The broader disabled-connection approval replacement at `domain/bindings.ts:281`–`:286` and its isolation rationale remain exactly as in prior rounds. |
| A-M1-01; B-M1-01/02/03 | Earlier closures retained. Configuration, score worker, maintenance guard, local-preflight/snapshot and migration source are unchanged by this correction. This round does not replace their required acceptance evidence. |

The single-query interpretation is consistent with the applied S2 rule: a successful qualified lookup with no row supplies no adoptable target. Returning `409 PLATFORM_IN_USE` makes no foreign write and leaves the grant unredeemed. It also preserves the specified refusal when a `standard` platform occupies the issuer/client key, without reading or adopting that foreign profile. A record that disappears between the create conflict and this list response has the same empty-result outcome. In contrast, a failed list request, timeout, or GET-by-id `404` remains `502 LTI_SERVICE_ERROR`. This distinction concerns a successful empty response versus a failed call; I found no contract ambiguity that requires a new design decision for this repair.

The independent empty-result schedule observed exactly `POST platform, GET list` in every branch. Ordinary empty response gave 409; revoke/replacement/takeover gave 403; disabled connection gave the state 409; a cleared lease or 5,999 ms remaining gave 502. A newer lease was preserved. At exactly 6,000 ms remaining, an adoptable result proceeded to activation; at 5,999 ms it did not. The constants remain a 60,000 ms lease and 6,000 ms S0 minimum.

All actual binding call sites still pass S0: Blackboard V, staged S1, each S2, each S3 and the optional compensation. There is one engine and at most two activation rounds. Independent controlled-boundary runs observed five calls for Canvas initial/add and six for Blackboard after S1 conflict and one activation mismatch. No new retry or call was hidden in a read. These probes used the real engine, migrations and repositories; the boundary supplied controlled responses, not a second binding algorithm.

I1–I6, local target capture and hidden snapshot rules were not weakened. Ref creation/history, conditional activation and compensation, adoption/history floor, approval-only application authority and cleanup ownership remain unchanged. The source delta does not change migrations, LTI validation/keys, the score worker, provider adapters, the portal, Moodle behavior or the production simulation/gate restrictions. The unrelated Moodle completion call retains its 15-second outer allowance, and ordinary GETs retain their existing retry policy.

### Reviewed files

Read the complete delta and surrounding callers in `services/cogniate-app/src/app/redemption.ts` and its tests, `services/cogniate-app/src/clients/lti-client.ts` and its tests, and `packages/shared/src/outbound.ts` and its tests. Rechecked `app/binding-targets.ts`, `domain/bindings.ts`, `domain/connections.ts`, the shared transaction/logger, and the applied contract's phase-1, S0–S3, phase-2, failure and audit rules. Harness/CLI and M2 files are listed in the corresponding Round 3 reports. Git comparison confirmed that the architecture, migrations, LTI-service source, provider targets, cleanup, score worker, portal/player and infrastructure have no delta from the previous candidate.

### Independent supplemental execution

Dependencies were installed offline in the detached candidate with:

```sh
npm ci --offline --ignore-scripts --no-audit --no-fund
npm --prefix tests ci --offline --ignore-scripts --no-audit --no-fund

COURSE_FIXTURES_DIR=/Users/quangnguyen/Workspaces/personal/cogniate_moodle_integration_prototype/docs/raw/data/courses npm run test:unit -- \
  services/cogniate-app/src/app/redemption.test.ts \
  services/cogniate-app/src/app/canvas-deployments.test.ts \
  services/cogniate-app/src/clients/lti-client.test.ts \
  packages/shared/src/outbound.test.ts

node /tmp/cogniate-review-a-ae130a3-probes.mjs
```

All commands exited 0. The focused unit run passed **207 tests in four files, zero skips**; log `/tmp/cogniate-review-a-ae130a3-unit.log`. This is my execution of committed tests, distinct from the author's reported 197-test selection.

The independent scratch script passed **20 grouped probes**: seven empty-S2/cancellation states, three maximum-call sequences with committed audit checks, both sides of the six-second lease boundary, list failure and id-404 failure, trace/failed-COMMIT checks for all three families, and three transport controls. The real outbound/client stack made one wire request for a delayed reset and settled at **4,106 ms**, made one request and timed out at **5,002 ms** despite an 8-second default, and retained two wire attempts for an unrelated default GET. Timing values are observed wall-clock values, not relaxed production limits. Script and output are in `/tmp/cogniate-review-a-ae130a3-probes.mjs` and `/tmp/cogniate-review-a-ae130a3-probes.log`. No listening socket or external service was used by that script.

### Other evidence and remaining gates

Lead subsequently reported a clean exact-SHA root check in `msg_db27b9cc3f43`: lint/typechecks and **1,032 tests in 69 files, zero skips**, log `/tmp/cogniate-lead-foundation.bzkF2F.round3-check.log`. This is Lead validation, not mine.

Lead also relayed QA's **14/14 PARTIAL SIM preflight** in `msg_7ac69e393e11`, including actual app/LTI operator commands and selected repaired capture cases. It is QA execution and does not establish either complete M1 inventory, migration/rollback, legacy, full M2, default-profile T7 or live interoperability. M3 A-M3-02 still blocks an unqualified harness approval. All live evidence stays separate; this report does not promote any live matrix entry.
