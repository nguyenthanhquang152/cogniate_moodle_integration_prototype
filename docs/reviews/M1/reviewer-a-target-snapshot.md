Verdict: CHANGES_REQUESTED
Round: 1

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
