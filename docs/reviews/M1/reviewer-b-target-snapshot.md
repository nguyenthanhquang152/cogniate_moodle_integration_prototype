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
