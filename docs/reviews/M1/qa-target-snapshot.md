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

---

## Round 2 — CHANGES_REQUESTED / FAIL FOR DESIGN TESTABILITY ONLY

Reviewed on 2026-10-20 for task `task_2184b58e02fa`, dispatch `ctx_db5eb5c61bc7`. **One MAJOR and two MINOR items remain.** Revision 2 resolves the main design policies, but its old-row acceptance table still requires a public-API outcome that the preserved grant-check order cannot produce.

### Exact inputs and independence

Authoritative proposal: **`caa35412887aa7c4b762a2c82be5fd12a984db9c`**, `docs/architecture/review-response-M1.md`, “B-M1-03 proposal D, revision 2,” R0–R9, lines 194–449. Original D1–D8 is superseded. Accepted baseline remains `56591df0e71939d5d62c9042c630c841d01f84e8` plus `ca14de6360021af4ce3692f1a0073fe4ec92633d`.

The original report above is preserved byte for byte from **`c447dd3f95bd8230c9d3b0aad818b9224231c031`**. Frozen harness **`0008bdef092b866a361d57ab705b581cd16312a5`** was used only to check reachability and accounting. No other worker's Round 2 report, product code, author implementation notes or uncommitted tests were read. No test or stack ran. Applying the promised R9 amendments after this gate is expected; their absence from contract files is not itself a finding.

### Disposition of every prior finding

| Prior finding | Round 2 disposition | Exact evidence and remaining work |
| --- | --- | --- |
| **Q-TS-01, MAJOR** — null-snapshot lifecycle | **Partly closed; MAJOR retained for one incorrect acceptance oracle** | R1 lines 259–274 and R4 lines 327–333 preserve registered repeats and Canvas add-deployment issuance/redemption without snapshots or provider reads. Pending old rows fail closed, partial Blackboard snapshots are defined, and live issuer drift no longer blocks add-deployment. However, R1 line 268's registered/other-values `409` conflicts with R2's ordered checks and C-3; see the concrete case below. |
| **Q-TS-02, MAJOR** — V timing and cancellation | **CLOSED for design testability** | R3 lines 304–323 defines the post-V transaction and first-failure order for success, mismatch, error and timeout. Lost lease wins, then connection change, then revocation, then V failure. R3/R6 explicitly permits a committed approval under an inactive parent, which blocks protocol/service use until reactivation; S1 missing pinned platform maps to `409`, while later S2/S3 `404` remains `502`. R6 also fixes cleanup after an earlier lost S3: saved targets are read, not presumed absent. |
| **Q-TS-03, MAJOR** — no-attempt evidence | **CLOSED for design testability** | R7 lines 358–370 defines the event, fields, post-commit emission and FIFO stream. The request's same-trace `http_request` line is a bounded flush control, with a separate positive redemption including V failure. Missing capture is blocked evidence; crash durability is not claimed. Atomic rollback remains supplemental unit/integration evidence. The existing app §12 defines the HTTP log event and shared trace field, so this requires no debug API. One restart-row wording inconsistency remains under Q-TS-04 below. |
| **Q-TS-04, MAJOR** — inventory and upgrade route | **Core gap closed; residual downgraded to MINOR** | R8 lines 374–430 makes the named additions mandatory in both full passes, retains all existing cases, adds a populated `38(h)` `011→012` route, and separates unit-only comparators/rollback from SIM. The released-v10 M1-23/30 path stays separate. Same-client P0→P1 drift is explicitly reachable. Remaining inventory wording is listed below; it does not require new product behavior. |

### Remaining MAJOR: Q-TS-01 registered/other-values row is not a reachable `409` fixture

**Evidence:** revision-2 R1 line **268**, R2 line **286**, R8 `38(h)` line **407**, and accepted C-3 at lines **17** and **35** of the same frozen proposal file.

Reproducible contract-only counterexample:

1. On the pinned `011` build, create pending Canvas C, issue initial grant G, and redeem G for `dA`. C is registered and G is redeemed.
2. Upgrade to `012`; C has no snapshot, as R1 intends.
3. Send strict `PUT …/platform` with C's correct client, a new `deploymentId: dOther`, and G's code. The finalized repeat does not apply.
4. R2 phase-1 check 2 returns **`403 GRANT_INVALID`**, with `grant_rejected.reason = "redeemed"`. It cannot reach check 4's `409 CONNECTION_NOT_PENDING`.

An unknown code instead fails check 1; an add-deployment grant fails the purpose check. The accepted CLI cannot issue a fresh initial grant after registration. C-3 already states why an unredeemed, unrevoked initial grant on a registered connection is not a public fixture. Yet `38(h)` requires exercising **every R1 row**, including its unconditional registered/other-values `409`.

**Required amendment:** state the earlier grant errors in R1's registered/other-values row. For its concrete SIM fixture, require the `403`/`redeemed` result above, zero requests, no attempt, and unchanged approval/key. Label check 4's `409` here as a supplemental unit-only branch with an injected otherwise-valid initial grant. Preserve the accepted check order; do not move the status check ahead of the grant checks to satisfy the table.

Also make the `38(h)` seed explicit: issue initial grants for the pending Canvas and Blackboard rows **before** upgrading. Those saved, still-valid codes reach new check 4a and demonstrate `409 PROVIDER_NOT_READY`; unknown codes must still give `403`, and new issuance on the upgraded null-snapshot rows must exit 1 locally. This is a fixture clarification within the existing upgrade scope.

### Remaining MINOR: Q-TS-04 inventory and restarted-process evidence

**Evidence:** R8 lines **386–388**, **408**, **428**, and R7 line **369**.

- The required “fresh `012`” row has no AC/subcase id. Give it an explicit stable id, or attach its enumerated positive controls to named required ids, before the R9 M1/M3 text is frozen. All other new groups have names: `37(v1–v12)`, `(w)`, `(x1–x2)`, `(y1–y2)`, `(z1–z5)`, `(aa)`, `29(k1–k3)`, and `38(h)`. The frozen manifest validator requires an AC-backed case id; a prose-only row cannot be counted.
- `v4–v6` say “no event” for the dead-handler schedules, while R7 says not to make an event-absence claim across restart and to use API/gate/CLI evidence there. Specify either no cross-process absence assertion, or a **new**, healthy-process cursor with its own same-process FIFO control. Do not compare a pre-kill cursor with post-restart logs as proof of no attempt. Align “skipped if the restart misses the lease window” with the global `BLOCKED` schedule rule. Either status fails the full acceptance gate under the frozen harness; neither may count as PASS.

### New MINOR: Q-TS-R2-01 — target construction sentence contradicts the transaction rule

**Evidence:** R0 line **224** says every target is built locally **inside phase 1**; R2 lines **286–290** saves the target in the atomic attempt write; R2 line **300** says the engine “never builds a target … before phase 1 commits.”

Replace the last statement with the intended distinction: **resolve and persist the target from local validated data inside phase 1; make no LTI call before commit; construct/send the remote create request afterwards.** The accepted target columns and write-ahead requirement already establish the intended behavior, so this is a wording correction, not a request for another transaction or remote precheck.

### Reachability and oracle confirmation

The following design expectations are testable without product-source-derived expected values:

| Required group | Reachable fixture and exact evidence |
| --- | --- |
| `v1–v3`, `v7–v12` | Prepare connections and grants first, arm all-method `/api/*` faults, then take the request window. R2 gives exact status/error precedence. Count **every** `received` event, including GET; pair the fault configuration with a valid Blackboard redemption that reaches V. Use R7's healthy-process HTTP/event control for no-attempt evidence. Canvas add-deployment is a distinct local path, not evidence borrowed from initial connect. |
| `v4–v6` | The accepted held-S1/dead-handler control leaves a live 60 s lease after app restart. Retry only after health and before expiry; `409 GRANT_IN_USE` and zero new gate requests are observable. Use the corrected event scope above. A missed window is not a successful race. |
| `w`, `x1–x2` | Public admin deactivation or the existing gate creates V mismatch, `503` transport failure, or a timed-out read. The CLI exposes `issued`; competing B's local reservation refusal plus A's immediate successful retry establishes retention and lease release. Late read delivery cannot create a record or resume the ended handler. |
| `y1–y2` | Wait for V `held_after`, then deactivate or delete/recreate the empty platform through the admin API. Release before 5 s. With no other fault, test the documented committed binding under an inactive parent and its `PLATFORM_NOT_ACTIVE` denial; for deletion, test S1's `409 PROVIDER_NOT_READY`, old pinned id and no mutation at P1. This does not claim atomic readiness. |
| `z1–z5` | The matching and non-matching held V responses can coexist with operator revoke, disconnect or suspend. R3 supplies the cancellation-first oracle even when V failed; its supplemental decision-order fixture covers the full outcome table. Existing lost-S3 controls create the owned earlier record for `z5`, and public cleanup reads prove `fenced`, not `absent`. Existing ref/late-write cases stay mandatory. |
| `aa`, `k1–k3` | The accepted simulation-off service restart reaches Canvas `UNKNOWN_PROFILE`. Empty Blackboard P0 can be deleted and recreated with the same client to isolate platform-id drift; missing P0 and a different-client recreation are also public fixtures. Fixed issuer drift and an isolated client comparator remain supplemental, not synthetic vendor behavior. |
| `38(h)` and fresh `012` | Public API/CLI setup can create the specified old states and saved attempts. Preserve an old approved deployment/key and an issued add-deployment grant; upgrade and add another deployment without changing the first key. Use the corrected R1 oracles above. Snapshots' raw storage and atomic rollback need separate stopped-copy/unit evidence; API effects remain SIM. |

R8's supplemental list supplies complete snapshot, partial snapshot, individual comparator, missing adapter, Canvas S1 URL/error mapping, post-commit audit, rollback-injection and throwing-LTI-client fixtures. They are explicitly outside SIM accounting. QA must use independent literal expectations; no production validator, response rewriting, vendor DNS/certificate spoofing or SSRF relaxation is needed.

### Gate, execution and held file

The prior command and resource plan remains applicable after design correction and a later implementation/test dispatch: exact frozen product/test SHAs, one QA stack at a time in the allocated lane, two full passes including the populated `011` upgrade, separate released-v10 Moodle migration/rollback, and unchanged legacy/T7 gates. Live provider evidence remains separate. No code or test execution is required to close this design recheck.

R9 line 449 correctly preserves `services/cogniate-app/src/providers/canvas.ts` with its current Canvas owner until an explicit Lead transfer. QA owns common/Blackboard scenarios, the new host upgrade route and accounting; QA-E2E owns Canvas variants; Author owns product and colocated unit tests.

**Held path for the Lead's exact-path commit:** `docs/reviews/M1/qa-target-snapshot.md`. Only this Round 2 append was written. Resolve the one MAJOR oracle conflict and carry the two MINOR corrections into the frozen proposal; then recheck the design. This is a delivered review, not proposal approval or product acceptance.

---

## Round 3 — APPROVE / PASS FOR DESIGN TESTABILITY ONLY

Independent bounded recheck, 2026-10-20, task `task_03dd4c0d94cd`, dispatch `ctx_f5b1c375220f`. **All remaining QA findings are closed. Remaining severity: no BLOCKER, MAJOR, MINOR or NIT findings in this recheck.** No concrete regression was found in the corrections.

### Exact inputs and boundary

Reviewed **`78bc34ac422e0bcac324fa10e69ec9f82a17a3b8`**, `docs/architecture/review-response-M1.md`, the complete authoritative revision-3 section **R3.0–R3.10, lines 455–780**. Earlier proposal sections are superseded history. The accepted baseline remains `56591df0e71939d5d62c9042c630c841d01f84e8` plus `ca14de6360021af4ce3692f1a0073fe4ec92633d`.

Prior QA reports are preserved from **`9eb5da33bf6985d8bf03f33c64fa9a79654de8f6`**. The accepted app contract's phase-1, adoption, cleanup and release rules and M3's accounting rules were checked against the corrections. Harness **`0008bdef092b866a361d57ab705b581cd16312a5`** was used only for accounting/reachability. No other worker's Round 3 report, author notes, product source or dirty test content was used. No test or stack ran.

### Per-finding disposition

| Finding at Round 2 | Disposition | Evidence at the exact revision-3 SHA |
| --- | --- | --- |
| **Q-TS-01 — MAJOR**, registered-row error fixture | **CLOSED** | R3.1 line **550** preserves grant-first errors and explicitly separates the unreachable state-check branch. `38(h3)`, line **705**, now requires the registered connection's redeemed initial code plus a new deployment to return `403 GRANT_INVALID`, reason `redeemed`, with zero requests, no attempt, and unchanged approval/key. Check 4's `409` is supplemental only, line **726**. |
| **Q-TS-01 — pending-row seed clarification** | **CLOSED** | `38(h1)`, line **703**, explicitly issues both pending rows' valid initial grants before upgrade. The controlled failures leave those grants issued. `38(h2)`, line **704**, distinguishes saved valid codes (`409`, check 4a), unknown codes (`403 not_found`), and new issuance (exit 1, unchanged grant list). The fixture no longer depends on obtaining a new grant after the null-snapshot guard exists. |
| **Q-TS-04 — MINOR**, fresh-012 ids and restart evidence | **CLOSED** | `38(i1–i5)`, lines **708–712**, gives stable ids for cloud, self-hosted, Blackboard, persistence and Moodle controls; repeated migration application is explicitly supplemental, line **725**. R3.7 rule 5, line **665**, and `37(v4–v6)`, lines **682–684**, require a new healthy-process cursor and same-process HTTP completion control. Missed 5 s or 60 s windows are `BLOCKED`, never PASS or SKIP, line **734**. |
| **Q-TS-R2-01 — MINOR**, target construction wording | **CLOSED** | R3.2 lines **580–594** consistently require local target construction and persistence inside the same phase-1 transaction, no remote resolution/call before commit, and S1 request construction from the committed target afterwards. This preserves the atomic lease/reservation/attempt boundary. |
| **Q-TS-02 and Q-TS-03**, closed in Round 2 | **Remain CLOSED** | R3.3/R3.6 retain the cancellation-first decision, exact readiness/error handling, pinned target, point-in-time V limit and saved-target cleanup. R3.7 retains post-commit audit emission, bounded FIFO evidence and crash limits; transaction rollback remains supplemental. |

### Populated upgrade and recovery are reachable

The corrected `38(h1–h5)` route uses only the public API, operator CLI and accepted gate on a pinned `011` build, then a stopped backup and upgrade:

- **Blackboard C0-B:** S1 `fail_before` leaves a local reservation and saved attempt target, but no remote deployment. Before containment, C1's negative control fails locally with `409 DEPLOYMENT_IN_USE`. C0-B suspend and release correctly report **`absent` / `absent`**; release frees its reservation. C1 then creates a fresh inactive deployment at generation **0** and activates it to **1**. It must not expect an existing remote row or a generation increment from a previous binding.
- **Canvas C0-C:** S3 `drop_after` leaves an active owned platform without approval. C1's negative control reaches S2 and gets `409 PLATFORM_IN_USE`. C0-C suspend reports **`fenced`**, release reports **`deleted`**, and C1 can redeem onto a **new platform**. Saved targets and ref history let cleanup find the orphan even though C0-C has no committed platform id.
- The rightful C1 grant is issued before suspend/release. Release's disabled-state, lease and active-record preconditions remain intact; failed cleanup or a late write uses the existing retry procedure. The accepted self-hosted D-12 limit is stated, not represented as solved.
- The unrelated registered Canvas and Blackboard bindings remain unchanged. `h3–h4` separately preserve the registered Canvas approval and old key while consuming the pre-upgrade add-deployment grant and then issuing/redeeming another grant without a snapshot/provider read.

These outcomes follow from R3.1 lines **556–566** and `h1–h5` lines **703–707**, and agree with accepted app §§4.7.1, 4.7.2 and 4.9. In `h2`, “no attempt/reservation” means no new writes by the refused redemption; C0-B's pre-existing reservation remains for the `h5` negative control and release. R3.6's local-refusal row preserves that existing state.

The upgrade cases are **SIM**, distinct from released-v10 **MOODLE-LIVE** M1-23/M1-30 migration, backup and rollback. The latter retains its original baseline and evidence labels. R3.8 lines **674–675**, **703** and R3.9 line **752** require the populated `011` route in both full rounds at identical product/test SHAs. The frozen host runner's two-pass structure can be extended for these cases; this review does not claim that extension is already implemented.

### Complete test boundary and accounting

The required additions now have named AC/subcase groups: **37(v1–v12), (w), (x1–x2), (y1–y2), (z1–z5), (aa); 29(k1–k3); 38(h1–h5), (i1–i5)**. R3.9 line **751** carries the same inventory into the later M1 amendment. Every existing case stays mandatory; missing, empty or blocked results cannot satisfy full acceptance.

All-method gate capture and paired positive controls remain explicit at lines **670–675**. CLI provider reads finish during preparation, before the redemption cursor; GETs are never filtered out of the measured request window. The restart persistence case uses that same separation: issue-time reads remain required by R3.4, while redemption has no remote precheck before phase 1. Healthy no-attempt evidence uses the new process's own FIFO control and is never treated as a database rollback oracle.

Live held-call schedules still release within 5 s; timeout cases wait for `caller_gone`. Cancellation combined with a failed V has the explicit R3.3 first-failure table and `z4` fixture. Repeated cleanup in `z5` now has the exact `fenced`/`fenced` outcome. R3.3 also makes readiness-S1 cancellation precedence and the new-id premise explicit. These additions preserve the existing staging, approval, ref-history and old-key oracles.

Lines **714–728** keep internal-only cases separate: missing adapter, partial snapshots, independent field comparators, capture/immutability, exact Canvas request URL, event timing, atomic rollback, a throwing LTI client, post-V ordering, repeated migration application, and the injected registered initial grant. Fixed issuer drift is not fabricated through public simulator controls. No vendor DNS/certificate impersonation, production validator reuse or SSRF relaxation is needed.

The neutral readiness text and internal cause mapping in R3.10 have exact expectations and assigned assertions. R3.9 preserves the current Canvas owner of `providers/canvas.ts` until explicit transfer and names the server/portal owners for the text change. QA retains common/Blackboard cases, the host upgrade route and accounting; QA-E2E retains Canvas variants. No ownership transfer is inferred from this approval.

### Result and held artifact

**APPROVE / PASS FOR DESIGN TESTABILITY ONLY at `78bc34ac422e0bcac324fa10e69ec9f82a17a3b8`.** The design provides reachable public fixtures and observable outcomes, with supplemental-only branches clearly separated. The later Architect contract amendments, implementation, independent tests and full acceptance remain necessary. Original product finding **B-M1-03 remains open** until implementation and verification; this verdict is not product or live-provider acceptance.

**Held path for the Lead's exact-path commit:** `docs/reviews/M1/qa-target-snapshot.md`. Only this Round 3 append was written; earlier rounds are preserved. No product/tests/architecture/team changes, test execution, stack operations, commits or pushes were performed.
