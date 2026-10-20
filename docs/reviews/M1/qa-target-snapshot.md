# CHANGES_REQUESTED — DESIGN TESTABILITY ONLY

Independent Codex QA review, 2026-10-20. Four **MAJOR** amendments are required before proposal D is accepted. This is not a product test, code review, or interoperability result. No stack, test, migration, or provider operation ran.

## Scope and frozen inputs

- Proposal: **`a4bc3a4d301e56086af85d0afce977fce494eb18`**, [review-response-M1.md, B-M1-03 D1–D8](../../architecture/review-response-M1.md#d1-new-connection-fields-data-model-42-migration-012_connection_provider_snapshotsql), plus its applied app-contract §4.8 clarification.
- Accepted design: `56591df0e71939d5d62c9042c630c841d01f84e8`, ADR-011 revision 6; C1–C3 clarification: `ca14de6360021af4ce3692f1a0073fe4ec92633d`.
- Feasibility only: committed harness `0008bdef092b866a361d57ab705b581cd16312a5`, especially case accounting, the host controls, and the migration runner. Candidate reference: `9f96f7b24cd0aed702e4dc40373bdda4307aad31`; no product-source inspection or execution for this review.
- Contracts read from the proposal commit: app §§4.2–4.9, LTI §§9.3–9.6, data model §4.2, M1 and M3. Line references below refer to that commit.

This report was written before reading either reviewer's or QA-E2E's new target-snapshot report. No held author test changes or author implementation notes were used. Proposal D remains unaccepted. The applied “no LTI write” clarification does not accept D.

## Required amendments

### Q-TS-01 — MAJOR: old registered Canvas has two incompatible grant rules

**References:** proposal D1 lines 88–92, D2 lines 102–109, D3 lines 115–119; app §4.7.2 and §4.8.

D1 refuses **all** grant issuance for a Canvas row with a null snapshot. D3 also compares every Canvas issue against `target_issuer`. However, D1 says `add_deployment` needs no snapshot and D2 says its behavior is unchanged. An existing `011` registered Canvas connection therefore appears able to redeem an already issued add-deployment grant, but unable to obtain a new one. Its finalized `PUT …/platform` repeat also changes from local `200` to `409` because the null check precedes the repeat. These are observable differences, not merely missing database backfill.

**Required decision:** publish a state/purpose table for old null-snapshot rows: pending initial connect, registered initial repeat, registered/connected add-deployment issue and redemption, disabled cleanup. State whether the null guard applies to initial issuance only. If existing registered Canvas add-deployment is preserved, derive its issuance target from its committed platform, as redemption already does, and specify the corresponding provider-read rule. Otherwise explicitly describe the incompatibility and recovery, rather than calling it unchanged. New non-null registered Canvas also needs an explicit decision on whether live profile drift can block add-deployment issuance.

**Closing evidence:** create these states on a pinned pre-012 `011` build using the public API/CLI, upgrade without SQL edits, and exercise each table row. Keep an approved Canvas deployment and its old service key working while adding another deployment. Failed issuance must leave the grant list and previous grant states unchanged. Preserve pending/disabled saved targets and ref history through cleanup. These are `SIM` upgrade cases; they do not replace the released-v10 `MOODLE-LIVE` migration cases.

### Q-TS-02 — MAJOR: V observes a point in time; later changes and competing failures lack precise outcomes

**References:** D2 lines 106–111; D4 lines 125–134; D5 lines 139–143; app S0 and LTI §§9.4–9.6.

The following schedule is reachable with existing controls: hold **after** V has returned an active shared platform, deactivate that platform through the LTI admin API, then deliver V within 5 s. S0 does not recheck platform readiness. The deployment endpoints have no documented parent-active precondition. Thus the proposal does not establish its broad statement that stale data always gives `409 PROVIDER_NOT_READY`; a binding may finish under an inactive parent. Deleting the empty old platform and creating a new one in the same window instead makes S1 target an absent old id. The accepted generic error rule suggests `502`, not the blanket `409`.

There is a second ambiguity: hold an **inactive** V answer, revoke or disconnect the connection, then deliver the answer within 5 s. D2 says V failure gives `409` and a free grant; D4 says cancellation during V gives `403` or `409 CONNECTION_NOT_PENDING`. A revoked grant cannot be “free.” A failed V response concurrent with cancellation needs a defined first failure.

**Required decision:** add outcome rows for readiness changes **after the V read**, and for cancellation combined with unsuccessful V. Define HTTP error, grant/lease/attempt state, reservation, remote record/ref, authority, and next cleanup/retry action. State the exact limit of the readiness check. If atomic readiness at S1/S3 is intended, define a real LTI-side condition; another app read cannot guarantee it. Do not weaken I1–I6, staging, or S0.

**Closing evidence:** use `hold_after GET /api/providers`, wait for `held_after`, perform the admin action directly, then release before `caller_gone`. Test deactivation, delete/recreate, revoke, DELETE and suspend as separate outcomes. In every replacement case assert that no write targets the new platform. If a live schedule misses the 5 s deadline, record the scheduling failure; do not extend production timeouts or reinterpret it as the intended race.

### Q-TS-03 — MAJOR: the proposed no-attempt evidence is not yet a stable contract

**References:** app §4.7.1 phase 1 and I1; M1 audit criteria; D7(v). No `grant_attempt_started` event is specified in the architecture at the proposal SHA.

Lead authorization permits preparing an oracle around the existing audit event fields `(connection_id, grant_id, attempt_id)`. That is useful, but event absence is meaningful only if emission and capture semantics are fixed. Zero gate requests does not prove that no attempt row was inserted. Nor does a successful later retry prove that phase 1's lease, attempt and reservation were one transaction.

**Required amendment:** contract the event, its correlation fields, and its emission point relative to successful phase-1 commit. Specify one event per successful phase-1 commit in a healthy run, none on rollback or refusal, and an observable completion/flush boundary for log capture. Do not promise crash-durable exactly-once logging unless it exists. A crash between database commit and log persistence can make absence inconclusive.

**Closing evidence:** for each healthy negative, capture bounded before/after audit cursors and assert no new start event for the request's connection/grant; also assert the exact refusal and zero gate requests. Include a positive control that creates one attempt and one start event, including a V-failure attempt. Unknown codes have no grant id, so isolate the connection and time window. Dead-handler tests need a confirmed first-attempt event before the kill and a healthy restarted-process negative window. A missing positive control or incomplete log is blocked evidence, not PASS.

Actual rollback atomicity needs a separate transaction-level test: inject failure between the attempt/lease/reservation writes and observe that none survive. This is supplemental unit/integration evidence, not a public-API `SIM` result. No new public debug API or writable database fixture is assumed.

### Q-TS-04 — MAJOR: the new acceptance inventory omits reachable variants and the `011` upgrade route

**References:** D6–D8; M3 AC-01/02/06; frozen `tests/acceptance/M1/common/coverage.mjs` and `tests/host/m1-migration.mjs`.

D7's core cases are feasible, but “V cases,” “snapshot checks,” and “migration on an `011` database” do not define a complete fixture/oracle inventory. The current host migration runner starts at released `b0b83a8`; it does not exercise old M1 Canvas/Blackboard rows. The mandatory race list also has no `(v)`, `(w)`, `(x)` or `29(k)` entries yet. A broad one-test-per-AC row would miss these variants.

**Required amendment:** adopt the concrete allocation below in M1/M3 and the later QA task. Preserve every existing AC and race subcase; add individually mandatory result ids for each `(v)` variant, `(w)`, `(x)`, `29(k)`, and the agreed lifecycle/upgrade cases. Require the new cases in both full runs at the same exact product/test SHAs. Add a separate `011→012` fixture route without replacing or relabeling M1-23/M1-30. Internal-only variants must be explicitly supplemental and must not fill a `SIM` row.

The Blackboard `29(k)` platform-id mismatch **is reachable**: a pending connection creates no deployment, so its empty shared platform can be deleted and recreated through the LTI admin API. LTI §9.4 only refuses shared-platform deletion when an active deployment exists. Use a fresh QA project and the same client id to isolate id drift. A unit-only fallback is not needed for this case.

## Concrete acceptance-to-test allocation

All rows below are proposed test work after approval, not executed results. `SIM` uses only the accepted `.sim.test` hosts, signed QA fixtures, operator CLI, public app/LTI APIs and transport gate. Supplemental unit evidence stays outside M3's acceptance totals.

| Case / environment | Fixture and schedule | Required observable oracle |
| --- | --- | --- |
| `37(v)` unknown code, both providers / SIM | Create a valid connection first. Arm catch-all `/api/*` `fail_before` rules, then send a well-formed unknown code. | `403 GRANT_INVALID`, zero gate requests, `grant_rejected` reason `not_found`, no new attempt under Q-TS-03. |
| `37(v)` live lease, both / SIM | Start a valid attempt; hold S1 and restart only the app as in accepted `(d)`. Establish health and a new event cursor while the original 60 s lease is live. Arm catch-all faults and retry the valid code. | `409 GRANT_IN_USE`, zero new requests including provider GETs, no new attempt; the first held request is tracked separately. If restart misses the lease window, the intended case did not run. |
| `37(v)` foreign reservation, Blackboard / SIM | A has the reservation. B has its own pending connection and a correctly bound grant for the same shared platform/deployment, issued before faults. | `409 DEPLOYMENT_IN_USE`, zero gate requests and no attempt; A's approval, generation and key remain valid. |
| `37(v)` wrong deployment, both / SIM | Valid grant for `dA`; request `dOther`. For Blackboard also make `dOther` a foreign reservation to test precedence. | `422 GRANT_MISMATCH`, field `deploymentId`, before reservation/readiness errors; zero gate requests and no attempt. |
| `37(v)` wrong explicit client, Blackboard / SIM | Correct grant and deployment; explicit body `clientId` differs from the connection snapshot. | `422 INVALID_PLATFORM_VALUES`, field `clientId`, before phase 1; no `grant_rejected`, no attempt and zero gate requests. Omitted and matching client values are positive controls. |
| Local guards and repeat / SIM; absent adapter supplemental unit-only | Combine wrong library, malformed body, null snapshot, invalid code and finalized repeat as applicable. Run the cold-restart variants too. Use the existing add-deployment precedence unchanged except for the explicit Q-TS-01 decision. | Exact first-failure matrix from D2/C2; no GET hidden by filtering. Valid finalized repeats return the agreed local result without consuming another grant. Malformed/null combinations need distinct rows. |
| `37(w)` inactive V / SIM | Fresh empty shared platform P0; issue A's and a competing B grant, then directly deactivate P0. Redeem A. Reactivate P0; try B, then retry A's same code. | First A: `409 PROVIDER_NOT_READY`, exactly one V GET, no S1/S2/S3, one phase-1 start, grant `issued`. B gets local `409 DEPLOYMENT_IN_USE`, proving A kept its reservation. A retries immediately to `200`, proving the lease is free and reservation reusable; each real attempt has its own V/start. |
| `37(x)` V transport failure / SIM | Valid Blackboard grant; `fail_before GET /api/providers`, then a separate held-read timeout case. Clear the fault before retry. | `502 LTI_SERVICE_ERROR`, one V request, no mutations, grant `issued`; immediate retry `200`. For timeout, wait for `caller_gone`; releasing a read later makes no write or handler continuation. |
| `29(k)` drift and immutable target / SIM | Create pending C at P0, issue G0, delete empty P0, recreate P1 with the **same** client id. Attempt another issue for C; then redeem G0. Restart app and repeat refusals; create new C1 at P1 as a positive control. | Issue exits 1 after its one provider read, with no new/revoked grant; G0 redemption gives V `409`, no write at P1. C remains pinned after restart. C1 can issue and bind. Also test missing platform and a different-client recreation, without claiming the latter isolates the client comparator. |
| V late-readiness / SIM | The held-after schedules of Q-TS-02. Pre-create all CLI fixtures before arming rules. | Exact outcome rows still required. Always preserve target id and isolation; distinguish an unsuccessful readiness check from a successful check made stale later. |
| Cancellation and cleanup at V / SIM | Hold a successful V, revoke/DELETE/suspend, release within 5 s. Separately, let V fail and then cancel, repeat cleanup, release, and retry with a new connection. | No S1 or compensation for a cancelled read-only attempt; exact Q-TS-02 precedence. Cleanup on saved P0 returns `absent` when deleted, leaves P1 unchanged, retains reservation until release, and clears only the old connection's ownership. Audit/result lines correlate to the old target. |
| Saved targets after S1/S3 / SIM | Retain every accepted `37/38` lost-answer, late-create, stale-write, replacement, revoke and release schedule; Blackboard has V before S1. Include pending Canvas without a committed platform id. | Cleanup still finds the exact saved issuer/client/profile or platform/deployment; fresh conditional refs fence old writes. Registered Canvas add-deployment never changes its platform or approved deployment/key. Old keys after rebind still fail under the accepted generation rules. |
| Snapshot capture/issuer comparators / supplemental unit-only | Independently authored provider-response literals: BB id-only, client-only, issuer-only, inactive, missing row/shared platform, wrong sharing; Canvas cloud and self-hosted canonical issuer. One accepted provider read for create, a different response on any attempted second read. | Create saves all fields from the same accepted response; subsequent operations never overwrite them. Each single-field mismatch is rejected independently. Portal-supplied snapshot fields are rejected under strict create rules. Exercise all-null old rows; define fail-closed handling of partial BB snapshots in the unit fixture contract. |
| Canvas stale issuer / supplemental unit-only | Connection snapshot I0; injected live provider row I1 for issue, and an LTI client fixture returning `400 PLATFORM_URL_NOT_IN_PROFILE` for S1. Independent request oracle expects `url: I0`. Test conflict-plus-URL-mismatch precedence in the LTI contract fixture. | Issue exits 1 without revoking an older grant. S1 pins I0, maps to `409 PROVIDER_NOT_READY`, does not create/approve, and releases only its own lease. Fixed profile issuer changes are not reachable through the accepted simulator/admin API; do not invent a response-rewriting gate or mutate production profiles. |

For every gate-negative case, finish setup and any CLI provider reads **before** the event cursor. Cover all HTTP methods on `/api/*`, not merely POST/PATCH. Count every `received` request after the cursor, including unmatched/pass-through GETs. A paired valid Blackboard request with the same fault configuration must reach V and fail, showing that capture is active. The gate logs do not contain request bodies; inspect public remote state for black-box effects and use an independent unit request oracle for the exact Canvas S1 `url`.

## Migration and baseline plan

1. **Released v10:** retain `b0b83a8289e1bf9cf349068aca184f0879e9aaf0` and the existing M1-23/M1-30 `MOODLE-LIVE` path. Both services stop before backup; verify both databases, sidecars, manifest and ledger. Upgrade applies existing migrations plus `012`, never edits `011` or its ledger entry. Old Moodle fields, generation-0 service key, activities and score history survive. Exercise backup refusal, whole-backup validation and restore to the original code/data as before.
2. **Old M1 `011`:** use a separately pinned build confirmed to have `011` and no `012` (candidate reference `9f96f7b…` must be checked before use). Seed through public operations: pending Canvas/BB, registered Canvas with an approval/key, registered BB, and failed attempts with saved targets/ref history. Preserve an add-deployment grant before upgrade. Stop, back up, upgrade, and assert the Q-TS-01 table plus cleanup/revoke/release on old rows. No direct SQL creation or ledger manipulation. Read-only inspection of stopped copied databases can verify three null columns and preserved rows; it is supplemental storage evidence, not a substitute for API outcomes.
3. **Fresh 012:** create new connections and demonstrate the positive snapshot path, persistence across restart, correct self-hosted canonical issuer, and Moodle's unchanged create behavior with no provider call. Re-running startup applies no duplicate migration and changes no snapshot.

Record both source-build SHA and candidate SHA for upgrade evidence. Any failure to prepare the old state through that build is a fixture blocker to report, not permission to synthesize state by editing a live database. The new `011` route needs a QA-owned runner extension after approval; the existing runner has no flag that already performs it.

## Execution, accounting and ownership

The later task should first run harness checks, then the focused SIM additions, then full acceptance. Existing executable entry points are:

```sh
node tests/host/run-m1.mjs --harness-only --provider all

# PRODUCT_SHA and TEST_SHA must be exact, approved, frozen 40-character commits.
COMPOSE_PROJECT_NAME=qa-multi-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 \
  node tests/host/run-m1.mjs --phase sim --provider all \
  --sha "${PRODUCT_SHA:?approved product SHA required}" \
  --test-sha "${TEST_SHA:?frozen test SHA required}"

COMPOSE_PROJECT_NAME=qa-multi-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 \
  node tests/host/run-m1.mjs --phase full --provider all \
  --sha "${PRODUCT_SHA:?approved product SHA required}" \
  --test-sha "${TEST_SHA:?frozen test SHA required}"
```

These are future commands, not evidence from this review. Full mode currently runs SIM and migration twice at the same SHAs, then legacy runners; the approved `011` extension must join both rounds. Do not run from a working tree with uncommitted tests. Every added result carries its AC/subcase, evidence label, product/test SHAs, command, run id, image digests, profile, health, timestamps and redacted artifacts. Missing, skipped, empty or blocked cases cannot satisfy an AC.

Use one QA stack at a time in the allocated `qa-multi-r*` lane. Run destructive shared-platform fixtures in a fresh isolated project/phase, not against a suite's populated shared platform. Recheck resource and port availability. The recorded Docker VM has 7.75 GiB; the phase maximum is two stacks overall, with no Docker Desktop change and no modification of the seven baseline volumes. Coordinate with QA-E2E before startup. Cleanup only owned temporary resources after saving redacted evidence.

M1/M3 accounting remains intact: all existing protocol, setup/export, signed OIDC/DL, grading, URL/SSRF, library/deployment isolation, proof/replay, capability, migration and regression cases stay mandatory. Keep default-profile T7's three consecutive runs and legacy suites distinct. SIM gives no Canvas/Blackboard live claim; hosted checks remain separately authorized and labeled.

D8 does not transfer `providers/canvas.ts` by itself. The Canvas owner retains it until the Lead issues an explicit handoff after design acceptance. Codex QA owns common/Blackboard scenarios and case accounting; QA-E2E owns the Canvas acceptance variants; Author owns product and colocated unit tests. QA fixtures and expected values must remain independent of production validators. No response rewriting, vendor DNS/certificate impersonation, or production SSRF exception is needed.

**Acceptance gate:** resolve Q-TS-01 through Q-TS-04 in the frozen design, assign the exact cases and supplemental fixtures, then re-review. This report authorizes no implementation and makes no product verification claim.
