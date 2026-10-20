Verdict: CHANGES_REQUESTED
Round: 1

# Reviewer-B: provider target snapshot design gate

Reviewer: retained independent Reviewer-B, Codex GPT-6-Astra, xhigh.
Task: `task_63f744cb3a1a`. Dispatch: `ctx_34758f845593`.

Proposal reviewed: **`a4bc3a4d301e56086af85d0afce977fce494eb18`**, `docs/architecture/review-response-M1.md` B-M1-03, D1–D8, and its applied app contract §4.8 clarification. Accepted baseline: `56591df0e71939d5d62c9042c630c841d01f84e8`, ADR-011 revision 6; C1–C3: `ca14de6360021af4ce3692f1a0073fe4ec92633d`.

I read committed inputs in a clean detached clone. Its product paths equal `9f96f7b24cd0aed702e4dc40373bdda4307aad31`; its test paths equal `0008bdef092b866a361d57ab705b581cd16312a5`. I did not read the held Author changes or another reviewer's or QA's new target-snapshot review. No stack, browser acceptance, account, tenant, or implementation test was run. This is a design review, not product verification or live evidence.

The local snapshot approach can fix B-M1-03 without splitting phase 1 or allowing provider reads on refusal paths. One lifecycle decision below must be resolved before implementation. The original product finding B-M1-03 stays open until an accepted design is implemented and independently checked.

## Findings

### B-M1-D-01 — MAJOR — the old-011 Canvas add-deployment lifecycle has conflicting rules

**Location:** proposal D1, lines 88–92; D2, lines 102–109; D3, lines 115–119; D7, line 174.

D1 says `add_deployment` does not need the snapshot and remains unchanged, but also refuses every `app:grant issue` for a null-snapshot connection. D3 requires every Canvas issue to compare the live issuer with `target_issuer`, with no purpose exception. These rules leave the supported grant-issue path unavailable for an otherwise valid registered Canvas connection after migration `012`.

Concrete case:

1. An `011` lane has a registered Canvas connection with an approved deployment D1, its committed platform, and saved attempt history.
2. Additive `012` runs without backfill. All three new fields are `NULL`.
3. The operator tries to approve D2 with `app:grant issue --purpose add_deployment`.
4. D1/D3 refuse it. The supposedly unchanged `POST …/deployments` can still consume a previously issued grant, but the operator cannot obtain another one.

This case is reachable in the Author and QA lanes that D1 explicitly preserves. It is not a released v10 Moodle compatibility problem. A finalized initial repeat on that same registered connection also becomes `409 PROVIDER_NOT_READY` at D2 step 3, rather than reaching the stated unchanged `200` repeat at step 5.

**Required amendment:** state one purpose-specific lifecycle policy in D1, D2, D3 and the resulting contracts. If registered Canvas add-deployment is preserved, define how issue uses its existing committed platform target without backfilling or introducing trusted public input; scope the null-snapshot refusal accordingly. If the intent is to retire this capability on all old-011 connections, state that as an explicit migration behavior change, remove the unchanged/no-snapshot claim, and give the operator recovery order for connections that already have approvals and publications. Do not silently infer either choice in code.

**Required evidence:** a populated `011` fixture with pending and registered Canvas rows, migrated to `012`, must assert issue, initial finalized repeat, add-deployment repeat/new deployment, and cleanup results under the chosen policy. A test that only checks whether three columns exist does not resolve this conflict. Also state whether D3's live-issuer comparison applies to `add_deployment` on a new snapshotted connection after profile issuer drift; its mutation target remains the existing platform.

### B-M1-D-02 — MINOR — a failed V does not establish that cleanup will find no record

**Location:** proposal D4, line 134, “Cancel after V failure”; related D4 lines 127–129 and D7 lines 162–174.

The row says `DELETE` finds nothing and returns the `absent` cleanup result because there was no S1. That is true only when no earlier attempt left a record. A normal supported retry can have history:

1. Attempt A completes S3, but its answer is lost. It leaves an active owned deployment without approval.
2. The operator deactivates the Blackboard shared platform.
3. Attempt B on the same grant passes local phase 1, then V refuses the inactive shared platform.
4. `DELETE` or `suspend` must still find A's deployment and fence it. V's failure does not remove A's target or ref history.

The accepted cleanup rules and current `binding-cleanup.ts:59` correctly enumerate all attempts. Thus this is a wrong proposed outcome, not evidence that current cleanup omits the record. Leaving the row unqualified can produce a false QA oracle or an incorrect implementation shortcut.

**Correction:** qualify `absent` as the first-attempt/no-prior-record case. State that cleanup after V failure still examines all saved targets and checks ownership; an earlier owned record can produce `fenced`, and a foreign record can produce `not_owned`. Add the lost-S3 → V refusal → cancel/suspend sequence to the V cases. Provider drift likewise must not be used as proof that an old saved target is absent.

### B-M1-D-03 — MINOR — the proposed acceptance amendments omit the agreed no-attempt audit semantics

**Location:** proposal D6–D7, lines 145–176; accepted app contract §4.7.1, line 389. Related open finding: B-M3-03.

The Lead permits test preparation using the existing `grant_attempt_started` event, but this proposal does not define that evidence contract. At the frozen product, `redemption.ts:138` emits the event after inserting the attempt, taking the lease and writing the reservation, **inside the transaction callback**. `packages/shared/src/migrations.ts:21` commits only after that callback returns. The event is therefore not an atomic record of a durable database commit. A later commit failure can leave a log with no committed row. The logger also writes through buffered streams (`packages/shared/src/logger.ts:123`); a crash or missing log data can leave no observed event despite a committed attempt.

**Correction:** document the existing event name, INFO level, `connection_id`, `grant_id`, `attempt_id`, and emission point. For C2/C3 and ordinary local-refusal tests, require a connection-scoped before/after observation, a positive control on the same log stream, and a healthy process with complete log capture. Wait for the control event so an empty read is not accepted merely because the stream has not arrived. Describe this as bounded test evidence for normal completed requests; do not use absence of this event as a durable no-row oracle across a crash, restart, rollback, or log loss. No new database or API inspection surface is needed for that bounded use.

## Other design checks

| Area | Assessment of this proposal |
| --- | --- |
| Create and local phase 1 | Saving values from the already-required authenticated provider read is sufficient for a local target. Strict body and the finalized repeat must remain before the single ordered phase-1 transaction. Within phase 1, checks 1–7, attempt, lease and Blackboard reservation remain atomic. No preliminary GET or split transaction is acceptable. |
| Snapshot trust and scope | The three fields are server-owned and write-once. Do not add them to the DTO, accept them from a request, or update them during retry/issue. Canvas client/deployment values still require the operator grant. |
| Blackboard V | The proposed row checks shared profile, issuer, platform id, client id and active state after local reservation and under S0/5 s. S0 must run again before S1. On failure, the current attempt must not release a newer lease or undo its reservation. Existing revocation/state changes must not be reversed by a “grant free” failure path. |
| Readiness TOCTOU | V is a point-in-time observation, not a lock on the LTI service. If the operator deactivates the shared platform after V, existing deployment POST/PATCH endpoints do not test the parent active flag (`services/lti-service/src/http/routes/platforms.ts:234`, `:268`). The attempt can still register while launches remain blocked by the inactive parent. This boundary already exists; the proposal must not describe V as an atomic readiness guarantee through phase 2. No new cross-service lock is requested. |
| Canvas issuer drift | Adding `url: target_issuer` to initial S1 uses the existing LTI contract §9.4 validation. That validation precedes conflict handling. It prevents creating a record under a different issuer from the saved cleanup lookup. Keep the same pinned target for retry and cleanup; do not replace it with a fresh profile issuer after failure. |
| Cleanup and isolation | Keep saved attempt targets and write-ahead ref history for all outcomes, including V failure. The new fields must not replace old attempt history. Canvas add-deployment acts on its own deployment; Blackboard never PATCHes or DELETEs the shared platform. Existing adoption, compensation, generation and approval rules remain required. |
| Migration and rollback | A new nullable `012`, without edits to `011` or backfill, fits the migration runner. v10 Moodle rows remain NULL and must never enter snapshot checks. Rollback still uses the paired verified backup and the new maintenance commands with both services stopped; an older build must not start on a `012` ledger. Do not delete ledger rows or use a reverse SQL migration. The populated old-011 behavior needs the decision in B-M1-D-01. |
| Applied §4.8 clarification | Accepted as a clarification: the committed Blackboard issue path already reads providers once to check the active shared client. “No LTI write” describes that path correctly. This does not approve D3's new Canvas behavior. |

## Test reachability and ownership

- D7(v)'s unknown code, wrong deployment, optional Blackboard client mismatch, and other-library reservation cases are reachable. Issue the needed valid grants and establish the held lease/reservation **before** arming the all-API failure gate. Capture the request window after preparation. Do not filter GETs out of the assertion.
- D7(w) and (x) exercise the new V after successful local phase 1. Keep the reservation, retain the unredeemed grant, and prove the retry after reactivation or removal of the transport failure. Also cover the prior-history case in B-M1-D-02.
- A Blackboard snapshot-id mismatch can be reached by creating a connection against an empty shared platform, deleting that platform, and recreating it before issue. Do this only in an isolated fixture with no active deployments. Do not delete a shared platform used by unrelated cases; the existing API correctly refuses that deletion.
- Existing S1/S3 gate rules match POST/PATCH and will not accidentally consume V. Existing Canvas replacement tests take their no-new-request cursor after replacement issue; the added issue GET belongs to preparation, not the refused redemption. Preserve the all-method watch and the 5 s live-race budget. A slow issue/read can make a live schedule BLOCKED; it does not justify increasing production timeouts.
- Test V interruption with successful V response followed by revoke/disconnect/takeover before S1, as well as V timeout/error. The existing S0/phase-2 cancellation rules still decide these outcomes. Do not claim a V read itself creates a ref or a remote record.
- D8 line 182 is a proposed allocation only. `providers/canvas.ts` remains Author-2's file under the Lead's current ownership. Implementation requires an explicit narrow transfer from the Lead or an Author-2 task after design acceptance.

## Gate result

**CHANGES_REQUESTED** for B-M1-D-01. Correct B-M1-D-02 and define the bounded audit evidence in B-M1-D-03 in the design revision. No product implementation is approved by this review. The report is held for the Lead; no commit or push was made.

## Round 2 — proposal D revision 2

Verdict: **CHANGES_REQUESTED**

Task: `task_06b884338b8a`. Dispatch: `ctx_1fd3ff3518ef`.
Exact proposal: **`caa35412887aa7c4b762a2c82be5fd12a984db9c`**, authoritative section “B-M1-03 proposal D, revision 2”, R0–R9. D1–D8 are superseded history.

I read this exact commit in the same clean detached clone. Product paths still equal `9f96f7b24cd0aed702e4dc40373bdda4307aad31`; test paths still equal `0008bdef092b866a361d57ab705b581cd16312a5`. I used those sources only to check feasibility. The accepted baseline remains `56591df0e71939d5d62c9042c630c841d01f84e8` plus `ca14de6360021af4ce3692f1a0073fe4ec92633d`.

This append preserves my original report committed in `c447dd3f95bd8230c9d3b0aad818b9224231c031`. I did not read another worker's Round 2 report, held Author regressions, or dirty product files. No stack or test execution was needed for this bounded design recheck. Applying the accepted-contract copies later is intentional, not a finding here.

### Disposition of every Round 1 finding

| Finding | Round 2 disposition | Exact evidence |
| --- | --- | --- |
| B-M1-D-01, MAJOR | **CLOSED at design level.** The registered Canvas add-deployment and finalized-repeat conflict is resolved. | R1 lines 267–270 and R4 line 333 preserve issue and redemption from the committed platform without a snapshot or provider read. Profile issuer drift does not block this purpose. R2 puts missing-snapshot check 4a after grant/state checks, and after the local finalized repeat. R8 line 407 requires a populated old-011 migration route, including an old approval/key and an issued add-deployment grant. The separate pending-row recovery gap below is not a claim that this registered-path fix failed. |
| B-M1-D-02, MINOR | **CLOSED at design level.** Cleanup after a failed V preserves prior history. | R6 lines 347–354 requires saved-target reads and distinguishes prior owned, foreign and absent records. R8(z5), line 402, requires lost S3 → V failure → cleanup of the earlier record. |
| B-M1-D-03, MINOR | **CLOSED at design level.** The audit semantics and their limits are specified. | R7 lines 358–370 defines INFO fields, including `purpose`, moves emission after commit, requires FIFO request-completion capture plus a successful event control, and excludes crashes/restarts and rollback inference. R8 lines 417–418 requires after-commit and rollback tests. The frozen app already returns `x-trace-id` and emits `http_request` in `onResponse` (`services/cogniate-app/src/app/server.ts:99`, `:108`), so the completion control is feasible without a new API. Moving the event and adding its field still require implementation; this is not a claim that the old code already meets R7. |

### B-M1-D-04 — MAJOR — the pending old-011 recovery omits the old reservation and orphan cleanup

**Location:** revision 2 R1 line 274, with the populated migration route in R8 line 407.

“Make a new connection … and issue its grant” is insufficient recovery for the pending rows with failed attempts that R8 deliberately seeds.

Two concrete schedules use only already-accepted behavior:

- **Blackboard:** old connection C0 passes phase 1, then S1 fails. C0 remains pending and keeps its deployment reservation. After `011→012`, C0 cannot redeem because it lacks a snapshot. Create C1 in the same library and issue a grant for the same deployment as R1 instructs. C1's check 7 returns `409 DEPLOYMENT_IN_USE`: the holder C0 is still pending, so the disabled-same-library transfer rule does not apply.
- **Canvas:** C0's S3 succeeds but its response is lost. C0 stays pending with an active owned platform and no approval. After migration, a new C1 with the same values cannot adopt that active record: its ref belongs to C0, not C1. S2 returns `409 PLATFORM_IN_USE`. C0's missing snapshot prevents retry, but does not prevent its cleanup.

Evidence: accepted app contract §4.7.1 checks 4/7 and adoption A1–A3; frozen `redemption.ts:119` and `:283`. Accepted §4.9 already supplies the repair: `suspend` disables the old connection, revokes its grants and fences saved targets; `release` waits for the lease to end and handles only that connection's records/reservation (`binding-cleanup.ts:191`). No new protocol or cleanup implementation is needed.

**Required amendment:** complete R1's operator recovery with the existing sequence: prepare the new connection and rightful grant, suspend the old pending connection, confirm cleanup and the lease/release preconditions, release the old binding as required by §4.9, then redeem on the new connection. Keep the existing retry rule for failed cleanup or a late write, and the existing self-hosted release race limitation. Do not suggest deleting local history, editing snapshots, bypassing the reservation, or changing an unrelated registered connection.

Extend R8(38h)'s explicit oracle to exercise these two seeded pending cases through recovery and prove that the new binding succeeds while unrelated approved deployments and keys still work. Listing “cleanup and release of old rows” separately does not make the stated recovery procedure complete.

### B-M1-D-05 — MINOR — the registered nonrepeat row promises an unreachable first error

**Location:** R1 line 268 versus R2 line 286 and accepted C-3.

R1 says a registered/connected connection with other values gets check 4's `409 CONNECTION_NOT_PENDING`. Phase 1 still checks the grant first. For a registered old-011 Canvas connection, send its redeemed initial code with a fresh deployment id: the repeat does not match, and check 2 answers `403 GRANT_INVALID`, reason `redeemed`, before check 4. An unknown code likewise answers `403`, not `409`. The unchanged CLI does not issue a fresh usable initial grant for a registered connection.

**Correction:** make the row say “normal ordered phase-1 errors; check 4 returns 409 only if checks 1–3 pass.” Use the reachable redeemed-code case in the populated migration route and assert `403/redeemed`, zero remote calls and no attempt event. Do not change phase-1 precedence to satisfy the table.

### B-M1-D-06 — MINOR — R2 contradicts its atomic target construction rule

**Location:** R2 line 300 versus R0 line 224 and R2 lines 286–290.

Line 300 says the engine never builds a target “before phase 1 commits.” The proposal elsewhere requires building the local target inside phase 1 and saving it in the attempt before that same commit. Both statements cannot hold.

**Correction:** say that phase 1 builds and saves the target from its fresh local connection data, after the relevant checks, and that the S1 request is constructed from this committed target after commit. No remote resolution or request occurs before commit. This preserves the proposed atomic transaction; it is a wording correction, not a request for a new phase.

### Remaining feasibility and boundary checks

- **Old-011 lifecycle:** pending initial issue refuses locally without revoking an older grant; a valid pre-upgrade initial code reaches 4a, while invalid/revoked/redeemed codes still fail earlier. Registered repeats and new Canvas add-deployment use persisted values. Disabled rows retain the unchanged cleanup/release path. Partial Blackboard snapshots use the missing-snapshot rule. The pending recovery in B-M1-D-04 is the remaining MAJOR.
- **V and cancellation:** R3's decision table now makes a completed local cancellation win over a matching, non-matching or failed V. It does not make a revoked grant usable, clear a newer lease, compensate a read-only attempt, or write to a replacement platform. R8(z1–z5) covers the concrete cancellation and prior-history schedules. A matched V still needs another S0 before S1.
- **Point-in-time readiness:** R3 explicitly permits an approval under a parent deactivated after V, while LTI login/launch/service use remains blocked. Its S1-on-deleted-id mapping is `409 PROVIDER_NOT_READY`; later S2/S3 `404` keeps `502`. R6 no longer treats provider drift alone as proof of remote absence.
- **Canvas mappings:** initial S1 `400 UNKNOWN_PROFILE` and `400 PLATFORM_URL_NOT_IN_PROFILE` map to readiness failure under the proposed cancellation/failure rules. Add-deployment keeps its prior error mapping and has no V. Turning simulations off makes the unknown-profile case reachable without rewriting responses. Fixed issuer drift remains supplemental evidence, as R8 states.
- **Audit evidence:** the same-request `http_request` marker orders the negative observation after any attempt event on that stream. The separate positive redemption, including a V-failed attempt, checks that the event itself is present. Missing capture/control is BLOCKED. The declared bounds do not establish durable absence after a crash or rollback.
- **Migration and isolation:** additive `012`, no backfill, no edited `011` ledger, and NULL/no-read Moodle behavior remain coherent. The separate populated `011→012` route is additional to the released Moodle upgrade/rollback checks. The existing paired backup/restore procedure still applies.
- **Gate accounting:** all-method capture, valid-request capture controls, the fresh-project same-client platform replacement, and preparation before the cursor are feasible. Existing race cases remain mandatory. **NIT:** R8(v4), line 386, says “skipped if the restart misses the lease window,” while line 428 requires BLOCKED. Use BLOCKED consistently, including inherited v5/v6 wording; a missed schedule cannot count as a passing mandatory case. The frozen runner already records BLOCKED as failure (`tests/host/run-m1.mjs:242`).
- **Ownership:** R9 leaves the Canvas provider file with its current owner until a Lead transfer. No implementation ownership is conferred by this review.

### Round 2 result

**CHANGES_REQUESTED.** B-M1-D-01, B-M1-D-02 and B-M1-D-03 are closed at the design level. B-M1-D-04 is the remaining **MAJOR**; B-M1-D-05 and B-M1-D-06 are **MINOR**, with one gate-status wording NIT noted above. Complete the existing pending-row recovery and correct the contradictory rows before implementation. Original product B-M1-03 remains open pending an accepted design, implementation and independent verification.

Held file: `docs/reviews/M1/reviewer-b-target-snapshot.md`. Only this Round 2 append was written; no commit or push was made.
