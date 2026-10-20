Verdict: APPROVE
Round: 3

# Design gate: B-M1-03 proposal D (local provider snapshot) — Reviewer-A

## Round 1 (2026-10-20)

| Item | Value |
| --- | --- |
| Verdict | **CHANGES_REQUESTED.** Proposal D is the right direction and I accept its core (snapshot at create, local strict body and phase 1, V before S1, Canvas S1 `url` pin). It needs the amendments below before implementation. One is MAJOR. |
| Proposal | `a4bc3a4d301e56086af85d0afce977fce494eb18`: `docs/architecture/review-response-M1.md` section "B-M1-03 … proposal D", D1 to D8, and the applied app contract §4.8 "Issue output" clarification. |
| Baselines | ADR-011 revision 6 at `56591df`. C-1 to C-3 clarified at `ca14de6`. |
| Product and harness read | Product `9f96f7b` (`app/connections.ts`, `app/binding-targets.ts`, `app/redemption.ts`, `app/operator.ts`, `domain/bindings.ts`, migration `011`, `packages/shared/src/logger.ts`). Harness `0008bde` (gate rules in `tests/acceptance/M1/**`). Read through `git show` and a detached clone only. |
| Reviewer | Reviewer-A, Claude Code Opus 5.5, xhigh, the retained instance. Task `task_f01adc29325b`, dispatch `ctx_49f6050fff8e`. |
| Independence | I did not read any other reviewer's or QA's target-snapshot review. I read Reviewer-B's round-1 B-M1-03 text only as the problem statement. No product, test, architecture or team file was changed. No stack. |

### What D gets right

- The snapshot comes from the `GET /api/providers` answer that the create handler **already** reads with the API key (contract §4.2). It adds no new trusted public input. Self-hosted Canvas `target_issuer` comes from the canonical site URL through the fixed profile template, as today.
- Steps 1 to 6 of D2 (adapter, snapshot present, strict body, finalized repeat, phase 1 checks 1–7 in the accepted order and transaction) can run with zero LTI requests. This closes B-M1-03 for `PUT …/platform`, keeps every refusal's public answer, and keeps AC-M1-37 (f)'s "no new gate request" oracle without weakening it.
- Blackboard **V** (after phase 1, under S0 and the 5 s timeout, before S1) keeps the accepted `409 PROVIDER_NOT_READY` answer for an inactive or replaced shared platform. It writes nothing remote, and its failure path (attempt `failed`, lease cleared only if held, grant free, reservation kept) matches the LTI-failure rules. The call budget (V + S1 + S2 + S3 + S2 + S3) stays inside the lease; with S0's 6 s rule and one GET retry, the worst case is about 45 s.
- The Canvas S1 `url: target_issuer` pin uses an existing LTI rule: `PLATFORM_URL_NOT_IN_PROFILE` is checked before every conflict check (LTI contract §9.4). So a created record always carries the issuer that the attempt saved, and the cleanup lookup (`url`, `clientId`, `profile`) cannot miss it.
- Migration `012` is additive, nullable and without backfill. v10 and `011` Moodle rows are untouched, and the Moodle create path still makes no LTI call.
- Isolation, I1 to I6, refs, cleanup ownership and the add-deployment isolation (D1/D2 of revision 6) are unchanged. The snapshot is not in the DTO and has no write path after create.
- The readiness check is fail-safe. If the shared platform is switched off after V and before S1 or S3, the LTI writes still go to the pinned platform id, and the LTI service refuses logins and launches of an inactive platform. Approval-only routing (I2) still decides authority.

### Findings

#### A-D-01 MAJOR: the Canvas add-deployment path still resolves providers remotely before phase 1

- **Where:** proposal D2, the paragraph "`POST …/deployments` (Canvas `add_deployment`): unchanged … the target is already local … No V"; D7 (v) covers only `PUT …/platform`. Product `9f96f7b`: `services/cogniate-app/src/app/binding-targets.ts` L33 calls `providerProfiles(deps.lti, …)` for **every** purpose, before the purpose branch at L39. `app/redemption.ts` L149 calls `deps.resolve` before `phase1` for every endpoint, including `app/canvas-deployments.ts`.
- **Problem:** the add-deployment target is local **data** (`lti_platform_id`, `deploymentId`, `platform.issuer`, `platform.clientId`), but the product does not resolve it locally: it reads `GET /api/providers` first, and it can answer `409 PROVIDER_NOT_READY` or `502` before the grant checks. "Unchanged" would keep B-M1-03 on one of the three redemption endpoints. That breaks the same contract rule (app contract §4.7.1: ordered phase 1 before any LTI call). An invalid code, a live lease (`GRANT_IN_USE`) or a mismatch on `POST …/deployments` would still depend on the LTI service and send a request.
- **Required amendment:** state that target resolution is local for **all** three redemption endpoints (Canvas `initial`, Canvas `add_deployment`, Blackboard `initial`): the engine makes no LTI request before phase 1 commits. For `add_deployment`, issuer and client id come from the connection's `platform`, with no providers read and no V. Extend D7 (v) with the Canvas `POST …/deployments` cases (well-formed unknown code → `403`, live lease → `409 GRANT_IN_USE`, wrong `deploymentId` → `422 GRANT_MISMATCH`), each with zero gate requests. Add the matching unit test: the resolver and phase 1 run with an LTI client that throws on any call, for all three endpoints.

#### A-D-02 MINOR: the null-snapshot rule conflicts with add-deployment and with the finalized repeat

- **Where:** D1 ("A Canvas or Blackboard row with `target_issuer` `NULL` … is refused locally: `PUT …/platform` → `409 PROVIDER_NOT_READY` …; `app:grant issue` → exit 1"; "`add_deployment` … do not need the fields"); D2 step 3 before step 5; D3 Canvas ("the live row issuer … must equal `target_issuer`").
- **Problem:** two outcomes contradict the text:
  1. D3 compares the live issuer with `target_issuer` for every Canvas issue. So an `add_deployment` grant for a registered Canvas connection made before `012` (null snapshot) is refused, although add-deployment "does not need the fields".
  2. D2 step 3 runs before the finalized repeat (step 5). So a registered pre-`012` connection's idempotent `PUT` repeat changes from `200` to `409`.
  Both cases exist only in M1 work-in-progress lanes, but the contract text must be unambiguous.
- **Amendment:** apply the null-snapshot refusal (PUT step 3 and issue) only to purpose `initial`. For `add_deployment` issue, validate against the connection `platform` (issuer, client id), or skip the Canvas issuer read. Either keep the finalized repeat before step 3 for a `registered` or `connected` connection, or state the `409` explicitly.

#### A-D-03 MINOR: Canvas readiness errors map differently from Blackboard

- **Where:** D2 step 8 maps only `400 PLATFORM_URL_NOT_IN_PROFILE` to `409 PROVIDER_NOT_READY`. The Blackboard V maps "a missing row" to `409`.
- **Problem:** a Canvas S1 that meets `400 UNKNOWN_PROFILE` (a simulation profile after the service restarts with simulations off, or a removed profile) ends as `502 LTI_SERVICE_ERROR`. Before D, the resolver answered `409 PROVIDER_NOT_READY` for a missing profile row. Both are fail-closed, but the public answer differs by provider and from today.
- **Amendment:** also map S1 `400 UNKNOWN_PROFILE` to `409 PROVIDER_NOT_READY`, with the same attempt, lease and grant handling as step 8. Add it to the outcome table and to a unit test.

#### A-D-04 MINOR: the `grant_attempt_started` no-attempt oracle needs stated semantics (B-M3-03 input)

- **Where:** product `app/redemption.ts` L138 logs `grant_attempt_started {trace_id, grant_id, connection_id, attempt_id}` **inside** the phase-1 transaction, before `COMMIT`. App contract §12 does not list the event. The service logger writes the JSONL file through an asynchronous `createWriteStream` (`packages/shared/src/logger.ts` L128–L145). The CLI logger is synchronous.
- **Assessment:** the event is usable as a negative "no attempt" oracle for the local refusals of D2 steps 1–6, under three conditions:
  1. The event must have contract semantics: "exactly one line per committed phase 1, with `connection_id`, `grant_id`, `attempt_id`". Today a failed `COMMIT` after the log line would leave a line without an attempt. That only causes a false FAIL of a negative check (safe), but the semantics should be exact.
  2. A negative check must be bounded by a later positive control in the same service process. Its line, read from the same file stream, proves that earlier lines were flushed, because the stream keeps first-in, first-out order. A fixed sleep proves nothing.
  3. The event is not evidence across a crash or `stack:restart` (dead-handler schedules), because buffered lines can be lost. Those schedules must rely on API answers and gate events.
- **Amendment:** add the event to app contract §12, and emit it after the phase-1 transaction commits (or state the pre-commit limitation). Write the oracle rule above into the M1 QA notes. No new database or API surface is needed.

#### A-D-05 NIT: live versus snapshot values shown to admins

- `GET …/tool-configuration` (Blackboard `client_id` row) and `GET /app-api/lms-providers` show the **live** shared client id, while redemption and issue now pin the **snapshot**. After the shared platform is replaced, a Learn administrator can be shown an Application ID that this connection will never accept. Suggest: show `target_client_id` on an existing connection, or show the "make a new connection" text when the two values differ.
- D1 wording: "never from a portal … value" is true for every value except the self-hosted `target_issuer`. That value is the canonical portal site URL put through the fixed template, so say so.

### Requested checks

| Topic | Result |
| --- | --- |
| Changed precedence | For Blackboard, `PROVIDER_NOT_READY` moves from before the strict body and grant checks to after phase 1 (V). D6 states this for §4.4. A side effect is accepted and documented in D4: phase 1 can write an attempt, the lease and a moved reservation before V refuses. I see no harm: the reservation stays with a pending connection of the same library, the retry reuses it, and other libraries are blocked as before. |
| Readiness TOCTOU | Fail-safe (see "What D gets right"). V is a readiness check, not a lock. Nothing gains authority without approval. |
| Profile issuer drift | Canvas: S1 `url` pin, issue check. Blackboard: V and issue compare the issuer, id and client id. Covered. |
| Old `011` and v10 Moodle | Preserved. Moodle never reads the snapshot. `011` lanes get `012` added only. |
| Existing registered add-deployment | Needs A-D-01 and A-D-02. |
| Saved targets, ref history, cleanup, isolation, revoke, cancel, retry | Unchanged by D. Cleanup paths read LTI records, not providers. The Canvas issuer is saved at phase 1 from local data (I6 is stronger). |
| D7 reachability | (v) 1–5 can be reached with a `fail_before` rule on every `/api/*` (gate rules replace the list, held requests stay held, so (v)2 can use the (d) dead handler). (w) and (x) can be reached through the LTI admin API and a `fail_before` rule on `GET /api/providers`. AC-M1-29 (k) needs a shared-platform delete and re-create, which needs no active deployments; otherwise a unit test, as D says. |
| Existing race schedules | Preserved. The committed harness rules match `POST` or `PATCH` paths, or use pass-through watch rules. V adds one `GET` per Blackboard attempt that those rules do not hold. A watch rule records it, so exact-count assertions in the Blackboard harness must count it; no test may filter it out. |
| Applied §4.8 clarification | Accurate. Product `app/operator.ts` reads providers once for a Blackboard issue and makes no LTI write. Canvas issue makes no read today. D3 would add one; then the clarification must name Canvas too (D6 lists §4.8). |
| D8 ownership | A proposal only. `services/cogniate-app/src/providers/canvas.ts` belongs to Author-2 today; it needs an explicit Lead transfer or an Author-2 task. I did not treat D8 as permission. |

### What closes this gate

- A-D-01 is amended (local resolution for all three redemption endpoints, with zero-call tests for `POST …/deployments`).
- A-D-02, A-D-03 and A-D-04 are amended, or the Lead records them as accepted deferrals with their stated limits. A-D-05 is optional.
- I then re-check the amended proposal text before any engine implementation.

## Round 2 (2026-10-20)

| Item | Value |
| --- | --- |
| Verdict | **APPROVE (PASS)** for proposal D revision 2 as a design. No BLOCKER or MAJOR is open. A-D-01 to A-D-05 are closed. Two new MINOR findings (A-D-06, A-D-07) and one NIT (A-D-08) are amendment text for the R9 task. They do not block this gate. |
| Proposal | `caa35412887aa7c4b762a2c82be5fd12a984db9c`: `docs/architecture/review-response-M1.md`, section "B-M1-03 proposal D, revision 2" (L194–L449, R0 to R9). It replaces D1 to D8 of `a4bc3a4`. |
| Baselines | ADR-011 revision 6 at `56591df`. C-1 to C-3 at `ca14de6`. The contract, data model, ADR and task files at `caa3541` still have the baseline text, because R9 is not applied yet. I judged the proposal, not those unchanged files. |
| Prior report | Round 1 above (committed at `5a08512`). |
| Feasibility reads | Product `9f96f7b`: `app/server.ts`, `app/redemption.ts`, `app/binding-targets.ts`, `app/connections.ts`, `app/api-errors.ts`, `packages/shared/src/logger.ts`, portal `connect/provider-errors.tsx`, LTI `store/platforms.ts`. Harness `0008bde`: `tests/acceptance/T1/harness.test.ts`. Read through `git show` and a detached clone only. Product code is feasibility evidence, not the design. |
| Reviewer | Reviewer-A, Claude Code Opus 5.5, xhigh, the retained instance. Task `task_c17cd1135dca`, dispatch `ctx_d1e7f2d9e3f0`. |
| Independence | I did not read the other Round 2 reports (commit `fd74df4`) or the held dirty files (`redemption.test.ts`, `pnpm-workspace.yaml`). No product, test, architecture or team file was changed. No stack. |

### Dispositions of the Round 1 findings

| Id | Sev. | Round 2 | Evidence |
| --- | --- | --- | --- |
| A-D-01 | MAJOR | **Closed** | R2 (L276–L300): all three redemption endpoints build the target locally inside phase 1. "The engine never builds a target or a create request before phase 1 commits, for any endpoint" (L300). `POST …/deployments` keeps the C-2 order, reads no providers and runs no V. R8 adds the zero-request cases v3, v6 and v10, and a unit test with an LTI client that throws on any call, for all three endpoints. Feasible: every input is local (snapshot columns, `lti_profile`, `lti_platform_id`, `platform_json`, the request body). The product must move `providerProfiles` (`binding-targets.ts` L33) and `deps.resolve` (`redemption.ts` L149) out of the path before phase 1. |
| A-D-02 | MINOR | **Closed** | Check 4a applies to `initial` only and comes after checks 1–4 (R2 step 5). The finalized repeat (R2 step 4) uses the persisted `platform` before phase 1, so a registered `011` row still gets `200`. `add_deployment` issue and redemption use the committed platform (R1, R4). |
| A-D-03 | MINOR | **Closed** | Both Canvas `initial` S1 `400` codes map to `409 PROVIDER_NOT_READY` (R0, R6 L352). `add_deployment` keeps `502`. Case 37 (aa) reaches `UNKNOWN_PROFILE` through the AC-M1-35 restart. `PLATFORM_URL_NOT_IN_PROFILE` is a unit test only, because R8 forbids a profile change to reach it. |
| A-D-04 | MINOR | **Closed** | R7: the event is written after the commit, exactly once for each committed phase 1, never on a refusal or a rollback, and it is not durable. The positive control is sound and has a contract basis. App contract §12 (L805) logs `http_request` at `info` for every request except `GET /healthz`. Product `server.ts` L100–L113 reuses a valid incoming `X-Trace-Id`, sends it back, and writes the line in `onResponse`, after the handler. One logger stream keeps first-in, first-out order (`logger.ts` L128–L145). The T1 harness already finds an `http_request` line by `x-trace-id` (`tests/acceptance/T1/harness.test.ts` L139–L149). R7.5 (no claim across a crash or restart) is my Round 1 condition 3. |
| A-D-05 | NIT | **Closed** | R5: the `client_id` row comes from `target_client_id`, else `platform.clientId`, else `409`. `lms-providers` stays live for new connections. R1 now says how the self-hosted issuer is made. |

### New findings

#### A-D-06 MINOR: one public `409 PROVIDER_NOT_READY` now has different recoveries, but its user text is still the Blackboard-only text

- **Where:** R1 L263 (check 4a, "Make a new connection"), R3 row 5, R6 (Canvas S1 `400`; deleted or re-created after V), R9 (L432–L449, no M2 or portal row). Baseline: app contract §4.2 L232, action "Ask the Cogniate operator to register the Blackboard application."; M2 task L95, "`409 PROVIDER_NOT_READY` → the Blackboard not-ready text"; product `api-errors.ts` L38; portal `connect/provider-errors.tsx` L21 (`PROVIDER_NOT_READY: BLACKBOARD_NOT_READY`).
- **Problem:** after D, the same code has at least three causes, and each cause has a different correct action:
  1. The shared platform is inactive (V row 5, case w). The correct action is to wait for the operator to reactivate it, then retry the same code. A new connection does not help: create also refuses, and the pending connection's reservation blocks a second connection (check 7).
  2. There is no snapshot (check 4a), or the shared platform was replaced (V row 5, case 29 k1). The correct action is to make a new connection.
  3. The Canvas profile is missing or changed (S1 `400`, case aa). The Canvas wizard then shows a **Blackboard** text.
  The portal shows one fixed text for each code. So in cause 2 the user is told to ask for a Blackboard registration that already exists, and in cause 3 a Canvas user reads Blackboard advice. All causes fail closed. This is wrong recovery advice, not a security gap.
- **Amendment:** keep the one public code. Add a cause field (for example `details.reason`: `platform_inactive`, `platform_changed`, `no_snapshot`, `profile_missing`) with a server-owned title and action for each cause. Or use one neutral text that names both actions. Add the M2 error-text table, the portal map (portal owner) and the app contract §4.4 and §4.7.1 texts to R9. Assert the cause in cases w, 29 (k1), (aa) and 38 (h).

#### A-D-07 MINOR: the recovery for an old pending row does not say "disconnect it first"

- **Where:** R1 L274: "Recovery for a pending old row: make a new connection (it gets a snapshot) and issue its grant." Accepted app contract §4.7.1: check 7 (L385) moves a Blackboard reservation only from a `disabled` connection of the same library. L284: after a failed attempt, "Blackboard keeps the reservation with this pending connection". L408: an active record whose ref is not an older ref of **this** connection is not adoptable.
- **Problem:** case 38 (h) seeds failed attempts with saved targets on pending `011` rows. Such a row can hold (a) the Blackboard reservation of (shared platform, deployment), or (b) an active Canvas platform or Blackboard deployment from a lost S3 answer. Check 4a refuses every redemption of that row, so the reservation or the record never clears by itself. A new connection with the same values then gets `409 DEPLOYMENT_IN_USE` at phase 1 (portal text: "This Blackboard site is already connected to Cogniate."), or `409 PLATFORM_IN_USE` or `DEPLOYMENT_IN_USE` at S2. The data stays safe (fail closed, cleanup unchanged). Only the documented recovery does not work as written.
- **Amendment:** change the R1 recovery to: "First disconnect (`DELETE`) or `suspend` the old pending connection. Its fence-out switches off its records, and check 7 then moves its reservation to the new connection of the same library. Then make a new connection and issue its grant." The accepted adoption rule A3 then lets the new connection adopt an inactive record with the same values. Add this order to case 38 (h), with a negative control: a new connection before the disconnect gets the `409`.

#### A-D-08 NIT: wording items for the R9 text

1. R2 L288, "The engine reads snapshot values only after check 4a": R2 step 3 already reads `target_client_id` for the Blackboard body check. Say "builds the target from snapshot values only after check 4a".
2. R3 rows 1–3 do not name the audit line. An accepted cancellation logs `grant_redemption_cancelled {reason}` (app contract L410, L827). State the reasons: `taken_over` (row 1), `connection_changed` (row 2), and `revoked` or `replaced` (row 3). Then z1–z4 can assert them.
3. R6 L352 (Canvas S1 `400`) says "or as row 2 or 3 if cancelled first", but R3 defines the post-call decision only after V. Say whether the Canvas S1 `400` result runs the same decision (rows 1–3 first) or the accepted LTI-failure path.
4. R1 L268, "phase 1 → check 4": checks 1–3 still come first, so an invalid code gives `403`. Say "checks 1–3, then check 4".
5. R3 L321, "Deleted or re-created after V", needs a new platform id. The LTI contract shows only an opaque `plt_…`. Product ids are 96-bit random values (`store/platforms.ts` L104). Case 29 (k1) re-creates the platform with the same client id and issuer, so only the id can show the change. State in §4.7.1 that a re-created platform always gets a new id.
6. R8 37 (z5), "then `DELETE` and `suspend`": say if this is one run (`suspend` repeats the fence-out on a disabled connection) or two runs, and give the oracle of the second call.

### Requested checks

| Topic | Result |
| --- | --- |
| Local-only order, all three endpoints | Pass. R2 steps 1–5 and the C-2 order for `POST …/deployments` use only local data. There is no provider read, no V and no request before the phase-1 commit (L300). The zero-request oracles v1–v12 count every gate request on every method, with a paired valid Blackboard request as the capture control. |
| Old `011` state and purpose | Pass, with A-D-07. R1 covers each state and operation. Registered Canvas `add_deployment` is kept. No backfill and no new trusted input. |
| Strict parsing and repeat precedence | Pass. The strict body (step 3) comes before the finalized repeat (step 4), as accepted. The Blackboard `clientId` source order (snapshot, then platform, then form only) is local. Check 5 uses `target_client_id`, which issue (R4) already requires to equal `--client-id`. |
| Canvas S1 mapping | Pass. Both `400` codes give `409` for `initial`. `add_deployment` keeps `502`. See A-D-06 for the user text and A-D-08 item 3. |
| V cancellation and state ownership | Pass. Rows 1–3 come before rows 4–6, so cancellation always wins, as in accepted phase 2 (`DELETE` answers `409 CONNECTION_NOT_PENDING`, AC-M1-37 (g)). `DELETE` and `suspend` do not change the lease (app contract L461, L511), so row 1 does not hide row 2. Rows 1–5 send no LTI call. This is correct, because the attempt has no S3 to compensate. A late V answer after the 5 s timeout causes nothing (case x2). After row 6, S0 still runs before S1. |
| Cleanup of earlier attempts | Pass. R6 keeps every saved target in the fence-out, the revoke cleanup and the release. `absent` means only a `404` at the saved id. Provider drift is never proof of absence. Case z5 covers it. |
| Snapshot immutability | Pass. There is one writer: the create insert, from the one provider read that create already makes (`connections.ts` L202 read, L221 insert). There is no `UPDATE` path, no request field and no CLI flag, and the fields are not in the DTO. A unit test checks that later reads never overwrite them. |
| Bounded audit semantics | Pass (A-D-04 closed). |
| I1–I6 | Kept. I1: check 6 is unchanged, and V runs inside the lease. I2: approval routing is unchanged, and the inactive-parent limit gives no authority. I3–I5: V is read-only and writes no ref. I6: stronger, because phase 1 saves the full target, with the Canvas issuer. |
| Call budget | Pass. Blackboard has 6 calls and Canvas has 5. Each call runs after S0 (at least 6 s left), with a 5 s timeout, inside the 60 s lease. |
| Contradictions | None in the design. Revision 2 replaces D1–D8 explicitly. The unchanged baseline files still show the old order (for example, app contract §4.4 puts Blackboard readiness before the strict body). R9 lists them for the later Architect task. R9 does not list the M2 and portal text (A-D-06). |
| Ownership | R9 transfers nothing. `providers/canvas.ts` stays with its current owner. Correct. |

### What closes this gate

- From my lens, the gate passes now. A-D-06 and A-D-07 (MINOR) and A-D-08 (NIT) go into the R9 amendment task, or the Lead records them as accepted deferrals with their stated limits. I re-check the applied amendment text when it is frozen.
- The accepted MINOR deferral A-M0-10 (only `canvas-self-hosted` identifier reoccupation after a release) is unchanged. This report does not widen or narrow it.
- Nothing here is live evidence. Every new case is `SIM` or a unit test.

## Round 3 (2026-10-20)

| Item | Value |
| --- | --- |
| Verdict | **APPROVE (PASS)** for proposal D revision 3 as a design. No BLOCKER, MAJOR or MINOR is open from my lens. A-D-06, A-D-07 and A-D-08 are closed. One new NIT (A-D-09) is optional amendment text. The original product finding B-M1-03 stays open until implementation and verification. |
| Proposal | `78bc34ac422e0bcac324fa10e69ec9f82a17a3b8`: `docs/architecture/review-response-M1.md`, section "B-M1-03 proposal D, revision 3 — AUTHORITATIVE" (L455–L780, R3.0 to R3.10), read as a whole. Revision 2 and D1–D8 above it are superseded history. The pre-freeze fixture correction (h5: Blackboard `absent`/`absent`, then a fresh deployment at generation 0 → 1; Canvas `fenced`/`deleted`, then a new platform) is in this text. |
| Baselines | ADR-011 revision 6 at `56591df`. C-1 to C-3 at `ca14de6`. Accepted app contract and M1 task text read at `78bc34a`. These files are unchanged since `caa3541`, because R3.9 is a later Architect task. |
| Prior report | Round 2 above (committed at `979aecc`). |
| Feasibility reads | Product `9f96f7b`: `app/connections.ts` L220 and L254, LTI `cli/shared-platform.ts` L37. Reading only. No new product audit. |
| Reviewer | Reviewer-A, Claude Code Opus 5.5, xhigh, the retained instance. Task `task_1fe8ae6741d8`, dispatch `ctx_752eba91c7de`. |
| Independence | I did not read any Round 3 report of another worker. I did not use the held `redemption.test.ts` or `pnpm-workspace.yaml`. No product, test, architecture or team file was changed. No stack and no test run. |

### Dispositions of the Round 2 findings

| Id | Sev. | Round 3 | Evidence |
| --- | --- | --- | --- |
| A-D-06 | MINOR | **Closed** | R3.10 (L761–L780): one public code and no public reason field. One neutral title and action for every LMS and cause, and the action names both recoveries ("try again later, or … make a new connection"). The operator diagnosis is the internal `provider_not_ready {connection_id, profile, cause}` log, with an exact cause map. R3.9 (L754–L757) adds the app contract text, the M2 error-text row and the two implementation files with their owners. The Blackboard card text (AC-M2-02) stays. Cases w, y2, aa, 29 (k1) and 38 (h2) assert the text and the cause. |
| A-D-07 | MINOR | **Closed** | R3.1 (L556–L566) gives a fixed order of accepted operations: new connection C1, C1's grant first, `suspend` C0, `release` C0, then redeem. The text names both blockers (a reservation held by a **pending** connection, check 7; an active record with another connection's ref, A1–A3). Case 38 (h5) has the negative control (C1 before step 3: Blackboard `DEPLOYMENT_IN_USE` at check 7, Canvas `PLATFORM_IN_USE` at S2). This order is better than my shorter "disconnect first" order: it is the accepted D-12 operator order, and it equals the accepted AC-M1-38 (f) pending-Canvas recovery (suspend `fenced`, release `deleted`, new connection `200`). |
| A-D-08 | NIT | **Closed** (all six items) | (1) L580: "builds the target from snapshot values only after check 4a", and step 3 reads only `target_client_id`. (2) L604–L606: rows 1–3 log `grant_redemption_cancelled` with `taken_over`, `connection_changed`, `revoked` or `replaced` (from `revoked_reason`). (3) L613: the Canvas S1 `400` and Blackboard S1 `404` readiness answers run rows 1–3 first. (4) L550: grant checks 1–3 first, then check 4. (5) L617 and L753: a platform id is never reused, and this sentence goes into the LTI contract. Product feasibility: 96-bit random ids, and the shared-platform CLI creates the platform `active: true` (`cli/shared-platform.ts` L37), so case 29 (k1) logs `platform_changed`. (6) L698: z5 is one run, and the repeated `suspend` gives `fenced` again, as AC-M1-38 (a) and fence-out step 3 ("also when the record is already inactive") require. |

The Round 1 findings A-D-01 to A-D-05 stay closed. R3.0 keeps their dispositions, and R3.2, R3.3 and R3.7 keep the text that closed them.

### Requested checks

| Topic | Result |
| --- | --- |
| Old-pending recovery and I1–I6 | Pass. I1: each connection has its own lease, and `release` needs C0's lease to be not live. I2: C0 has no approval, and C1 gets one only in its phase 2. I3–I5: `suspend` writes its ref to the history first and rotates the ref on each owned record. `release` deletes only with `ifBindingRef`. A late write is handled by the accepted "run `suspend` and `release` again" rule (L563). I6: C0's saved targets find every record, also on an old `011` row, because the accepted design saved the target at phase 1. C1's negative-control attempt leaves only a target that C1 owns. The orphan that it met has C0's ref, so C1's later cleanup reports it `not_owned`. |
| Cleanup of earlier attempts | Pass. `release` keeps C0's attempts, grants and ref history, as accepted (app contract §4.9). It deletes only C0's own reservation and approvals. The text "no local history is deleted" (L566) uses the accepted meaning of history. |
| Grant-first order and registered repeats | Pass. The finalized repeat (R3.2 step 4) answers `200` before phase 1. Other values give checks 1–3 first (`403`: `not_found`, `redeemed`, `purpose`), with zero requests and no attempt (L550). Check 4 on a registered row needs an unredeemed `initial` grant. The CLI cannot make one: `initial` needs a `pending` connection, and a new grant revokes older ones (`replaced`) (app contract §4.8, Issue checks and Issue output). So the unit-only branch is correct. A request without a valid code learns nothing about the connection state. |
| Local target construction | Pass. L594: phase 1 builds the target from the fresh local row and saves it in the attempt row in the same transaction. The S1 request is built from the committed target after the commit. No call and no remote resolution happen before the commit, for every endpoint. |
| Audit scope after the commit | Pass. `grant_attempt_started` is written only after the commit (R3.7). Rule 5 needs a new cursor and a same-trace control in the restarted, healthy process, and never compares logs from before and after a restart. `provider_not_ready` and `grant_redemption_cancelled` are separate events, so the no-attempt oracle stays exact. |
| Neutral portal recovery text | Pass, with A-D-09 item 1. The text names no LMS and is correct for every cause. |
| Regressions from the corrections | None found. The shared decision for readiness answers keeps "cancellation wins". Those S1 answers make no record, so no compensation is needed. The recovery order uses only accepted operations and bypasses no reservation or adoption rule. |

### New finding

#### A-D-09 NIT: three precision items in the R3.10 and R3.6 text

1. **Implementation file list (L757).** Product `app/connections.ts` L220 (the create-time Blackboard refusal) passes the old action text explicitly to `ApiError`, so that text overrides the `api-errors.ts` default. Add `connections.ts` to the R3.10 implementation files. L254 is the pre-phase-1 read that the A-D-01 change removes. At create time there is no connection yet: log `connection_id: null`, or omit it, for `cause: platform_inactive`.
2. **Cause precedence (L777).** "If several V conditions fail, the first in this list is logged" puts `platform_inactive` before `platform_changed`. Suppose the shared platform is replaced by a new **inactive** platform with another id. The log then says `platform_inactive`, but reactivation does not help, because the id differs. Log `platform_changed` first when `sharedPlatform` exists and its `id` or `clientId` differs, or log every failing cause. This is operator diagnosis only. The public text is neutral, and the refusal fails closed.
3. **Outcome row (L647).** The R3.6 row "Deleted or re-created after V" still shows only `issued` and `failed`. Add "(or as rows 1–3 if cancelled first)", as the Canvas row L648 does. The L613 paragraph already gives this rule.

### What closes this gate

- From my lens, the design gate passes. A-D-09 is optional text for the R3.9 amendment task. Applying R3.9 to the contracts is a later Architect task, not a missing part of the proposal.
- B-M1-03 in the product stays open until the implementation and its verification.
- The accepted MINOR deferral A-M0-10 (only `canvas-self-hosted` identifier reoccupation after a release) is unchanged. R3.1 restates the D-12 window between steps 4 and 5 and does not widen it.
- Nothing here is live evidence.
