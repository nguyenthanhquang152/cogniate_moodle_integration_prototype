# Review response: M1 contract questions C-1 to C-3 (Canvas)

Owner: Architect. Date: 2026-10-20. Task `task_52f5846266a5`, dispatch `ctx_a31df44410f0`.

Input: `docs/reviews/M1/qa-canvas.md` §7, items C-1, C-2 and C-3, at HEAD `17aa295` (QA preparation `9964e6f`). Accepted behaviour baseline: ADR-011 revision 6 at `56591df`. The app contract and M1 did not change between `56591df` and `17aa295`.

Scope: clarification of accepted behaviour only. No rule, schema, API, code, timeout or provider scope changes. The ADR revision stays 6. This file gives no product or live PASS. QA alignment task `task_ef66f1c5c7ed` uses it.

Note: the QA question names "§4.7.3". The app contract has no §4.7.3. The add-deployment endpoint is in app contract §4.7.2.

## Decisions

| Id | Question | Disposition | Basis |
| --- | --- | --- | --- |
| C-1 | `domain` in the Canvas JSON at a port other than 443: host name or `host:port`? | **`host:port`.** `domain` is the URL host of `PUBLIC_LTI_URL`: the lower-case host name, plus `:<port>` only when the port is not 443. At 443 it is the host name only, never `:443`. | App contract §4.6 already says "host of `PUBLIC_LTI_URL`"; a URL host includes a non-default port. The same port rule is the canonical origin rule (ADR-011 §3, §6). Canvas source (below) compares the domain with `.<host>[:<non-default port>]`, so a bare host name does not match a tool URL on another port. |
| C-2 | Pending Canvas `POST …/deployments` → `409 CONNECTION_NOT_READY`, but no `add_deployment` grant can be issued while pending. Is the state check before phase 1? | **Confirmed.** The endpoint checks, in order and before any grant lookup: (1) another library's connection → `404`; (2) `lms` is not `canvas` → `409 CAPABILITY_NOT_SUPPORTED`; (3) status is not `registered` or `connected` → `409 CONNECTION_NOT_READY`; (4) strict body → `422 INVALID_PLATFORM_VALUES`; then the finalized repeat; then phase 1. Checks 1 to 3 read no grant and log no `grant_rejected`. | App contract §4.7.2: the endpoint serves only `registered` or `connected` Canvas connections, and the finalized repeat answers before the grant is checked. §4.8: the CLI issues `add_deployment` only for a `registered` or `connected` connection. AC-M1-20 expects `CONNECTION_NOT_READY`, which phase 1 cannot give for an unknown code (check 1 answers `403` first). AC-M1-29 (l) expects `404` for another library. The order of (2) to (4) was not written before; this states it. |
| C-3 | An `initial` grant on the add-deployment endpoint after registration: which reason? | **`403 GRANT_INVALID`, log reason `redeemed`** (exactly one `grant_rejected {reason: "redeemed", connection_id}`). Phase 1 runs its checks in order, and check 2 (not revoked, not redeemed, not expired) comes before check 3 (`purpose`). The only reachable `initial` grant of a registered connection is the one it redeemed. `purpose` is reachable only with an unredeemed `initial` grant on a registered connection, and no CLI path makes one, so it is a unit test only. | App contract §4.7.1 phase 1 (ordered checks, "the first failure answers"; log reasons). §4.8: `initial` is issued only for a `pending` connection, and a new grant revokes older unredeemed grants of the same connection and purpose. So no unredeemed, unrevoked `initial` grant can exist on a registered connection. |

## Canvas primary source for C-1

Canvas `app/models/context_external_tool.rb`, last commit `c3dbadc0213b44fc3a768497b16a8c6cfb8c234b` (read 2026-10-20):

- `self.standardize_url` (lines 957–969) parses the URL with `Addressable::URI.parse(url)&.normalize`.
- `matches_tool_domain?` (lines 1039–1048) builds `"." + host + (port ? ":#{port}" : "")` from the standardized URL and matches `/\.#{Regexp.escape(domain)}\z/`. The domain is lower-cased and its scheme is removed first.
- Addressable `lib/addressable/uri.rb` (commit `4229164843616783287ca359bbe38b574f1908a3`), `normalized_port` (line 1392): the port is `nil` when it equals the default port of the scheme.

Result: at 443 the compared string is `.lti.cogniate.test`, so `domain` must be the host name. At 8443 it is `.lti.cogniate.test:8443`, so `domain: "lti.cogniate.test"` does **not** match and `domain: "lti.cogniate.test:8443"` does. The research facts F-CV-7 and F-CV-12 (domain field; domain matching of returned links) stay valid. The live effect stays `UNVERIFIED` until a live row passes.

## Required test adjustments (QA owns the tests)

| Id | Change |
| --- | --- |
| C-1 | AC-M1-19: compute the expected value independently from `PUBLIC_LTI_URL`: lower-case host name, plus `:<port>` only when the port is not 443. Assert `extensions[0].domain` equals it exactly. At the QA port 8443 expect `<host>:8443`; reject the bare host name. Remove the "accepts both forms" branch. |
| C-2 | AC-M1-20 pending case: send a well-formed body (a random 43-character base64url code) and expect `409 CONNECTION_NOT_READY`. Also send the pending connection's issued `initial` code: expect the same `409`, and the grant stays `issued` (it then redeems normally through `PUT …/platform`). For both: no `grant_rejected` line, no attempt row, no gate request. |
| C-3 | AC-M1-20 `initial` case: after registration, send the connection's redeemed `initial` code with a deployment id that has **no approval** (for example `dA3`). Expect `403 GRANT_INVALID` and exactly one `grant_rejected {reason: "redeemed"}` for this connection; no attempt row, no LTI call, approvals and `platform.deploymentIds` unchanged. Remove the "`redeemed` or `purpose`" alternative. Do not use an approved id such as `dA`: the finalized repeat answers `200` before any grant check. |

## Changed design files (wording only)

| File | Change |
| --- | --- |
| `docs/architecture/contracts/cogniate-app-api.md` | §4.6: one paragraph defines the exact `domain` form (C-1). §4.7.2 `POST …/deployments`: the order of checks (1) to (4) before the finalized repeat and phase 1 (C-2). |
| `docs/architecture/tasks/M1.md` | AC-M1-20: exact fixtures and oracles for the pending case (C-2) and the `initial` case (C-3). |

No change to ADR-011, the LTI contract, the data model, product, tests, reviews or team files.

## Product reading (after the decisions; not verification)

After the decisions, a read-only look at committed product `76b03c7` gives: `canvas-configuration.ts` sets `domain` from `new URL(…).host`; `canvas-deployments.ts` checks capability, then status, then the strict body before it calls the redemption engine; `redemption.ts` checks `revoked`, `redeemed` and `expired` before `other_library` and `purpose`. This reading is not a test result. Only QA's runs on a frozen candidate give evidence.

---

# B-M1-03: local target data for phase 1 — proposal D (REQUIRES DESIGN REVIEW)

Task `task_82c1af131e8a`, dispatch `ctx_d4db78b27fef`. Inputs: Reviewer-B `docs/reviews/M1/reviewer-b.md` B-M1-03 (MAJOR); the Author's question `msg_e85c09a8df5d`; the Lead's dependency note `msg_1b3d231b3f20` and edge list `msg_8ef847392094`. I read committed product `9aeeddc` only (`connections.ts`, `binding-targets.ts`, `redemption.ts`, `operator.ts`, migration `011`). Accepted baseline: ADR-011 revision 6 at `56591df`.

**Status: PROPOSAL, NOT ACCEPTED. Superseded by "proposal D, revision 2" below, where revision 2 says so; this text stays as the reviewed record of `a4bc3a4`.** It adds three columns, one read step and one S1 field. It needs independent review before the Author implements it. Until then the accepted contract is unchanged, except for the one clarification in "Clarification applied now" below.

## Problem

The accepted contract (app contract §4.7.1) runs ordered phase 1 (checks 1–7, attempt, lease, reservation) in one transaction **before any LTI call**. But phase 1 needs four values that the app today gets only from `GET /api/providers`:

1. The Blackboard shared client id (check 5).
2. The Blackboard shared platform id (the check 7 key and the attempt target).
3. The canonical issuer of a Canvas `initial` target (`binding_attempt.issuer` is `NOT NULL`, and it is the cleanup lookup key).
4. The shared client id for the strict-body rule "Blackboard `clientId`, if sent, must equal the shared client id" (`422 INVALID_PLATFORM_VALUES`, field `clientId`).

Product therefore reads providers before parse and before phase 1. So local refusals depend on the remote service and send requests (B-M1-03).

## Options

| Option | Result | Why not chosen |
| --- | --- | --- |
| A: local checks 1–6 as a pre-check, then the provider read, then checks 1–7 with the lease | rejected | An outbound call happens before phase 1 and before a check 7 refusal; the "one transaction, then calls" rule breaks. |
| B: phase 1a (checks 1–6 + lease), read, then phase 1b (check 7 + attempt) | rejected | It splits the lease from the attempt row, puts check 5 and check 7 after an outbound call, and changes refusal and history semantics. |
| C: snapshot in the grant at issue | rejected | The strict-body `clientId` rule runs before the grant lookup, so it would have to move into check 5 and change the public answer (`INVALID_PLATFORM_VALUES` → `GRANT_MISMATCH`). |
| **D: provider snapshot on the connection at create** | **proposed** | `POST /app-api/connections` **already** reads `GET /api/providers` for every Canvas and Blackboard connection (profile check, site rules, `PROVIDER_NOT_READY`; contract §4.2). Saving three values from that same read makes the strict body, the finalized repeat and all of phase 1 local, with no new trusted input and no change to any public answer of a refusal. |

## D1. New connection fields (data model §4.2; migration `012_connection_provider_snapshot.sql`)

| Field | Value and source | Written by | Read by | Mutability |
| --- | --- | --- | --- | --- |
| `target_issuer TEXT` | Canvas cloud and sim: the profile `issuer` of the providers row (fixed value). `canvas-self-hosted`: the row issuer template filled with the canonical `siteUrl`. Blackboard: the profile `issuer` of the shared profile. Moodle: `NULL`. | Only the create handler, in the insert transaction, from the same `GET /api/providers` answer that validated the profile | strict body: no; `app:grant issue` (validate); phase 1: the Canvas `initial` and Blackboard attempt `issuer`; S1 (Canvas `url`); V (Blackboard) | Write once. No `UPDATE` path, no API field, no CLI flag, not in the DTO. |
| `target_platform_id TEXT` | Blackboard: `sharedPlatform.id` of the providers row (active at create). Canvas and Moodle: `NULL` (Canvas `add_deployment` uses `lti_platform_id`, which phase 2 writes). | same | `app:grant issue`; phase 1 (check 7 key, attempt `lti_platform_id`, reservation key); V | same |
| `target_client_id TEXT` | Blackboard: `sharedPlatform.clientId`. Canvas and Moodle: `NULL` (the Canvas client id comes from the request and the grant). | same | strict body (Blackboard optional `clientId`); `app:grant issue`; phase 1 check 5 (Blackboard); V | same |

Every value comes from the authenticated LTI admin API, never from a portal or LMS value. No other code writes these fields. A different provider state needs a **new connection**.

Migration `012` (forward only, additive): three nullable columns. **No backfill.** Moodle rows stay `NULL`, and Moodle code never reads the fields (the Moodle create path makes no LTI call, unchanged). No released database has Canvas or Blackboard rows (v10 has none). A Canvas or Blackboard row with `target_issuer` `NULL` (only possible in an M1 work-in-progress lane) is refused **locally**:
- `PUT …/platform` → `409 PROVIDER_NOT_READY` ("Make a new connection"), before phase 1, with no LTI call;
- `app:grant issue` → exit 1, nothing stored.

`add_deployment`, `DELETE`, `suspend`, `release` and revoke cleanup do not need the fields; they use `lti_platform_id`, the reservation and the saved attempt targets, unchanged. QA and Author lanes that applied the old `011` only get `012` added; nothing is edited.

## D2. Flow and failure precedence

`PUT /app-api/connections/:id/platform`, Canvas and Blackboard (first failure answers; steps 1–6 are local and send **zero** LTI requests):

| # | Step | Failure |
| --- | --- | --- |
| 1 | connection of another library | `404` |
| 2 | no provider adapter | `409 CAPABILITY_NOT_SUPPORTED` |
| 3 | non-Moodle connection without snapshot (`target_issuer` `NULL`) | `409 PROVIDER_NOT_READY` |
| 4 | strict body; Blackboard `clientId`, if sent, equals `target_client_id` | `422 INVALID_PLATFORM_VALUES` (field names) |
| 5 | finalized repeat (unchanged, local) | `200`, nothing changes |
| 6 | phase 1 checks 1–7 in the accepted order and transaction. Check 5: Blackboard client id = `target_client_id`. Check 7 key: (`target_platform_id`, `deploymentId`). Attempt target: Canvas (`lti_profile`, `target_issuer`, request `clientId`, `deploymentId`); Blackboard (`target_platform_id`, `deploymentId`, issuer `target_issuer`, client `target_client_id`). | accepted answers (`403`, `409 CONNECTION_NOT_PENDING`, `422 GRANT_MISMATCH`, `409 GRANT_IN_USE`, `409 DEPLOYMENT_IN_USE` / `DEPLOYMENT_FIXED`) |
| 7 | S0, then **V** (Blackboard only, new): `GET /api/providers`; the connection's profile row must have `sharing: shared`, `issuer` = `target_issuer`, and `sharedPlatform` with `id` = `target_platform_id`, `clientId` = `target_client_id`, `active: true` | timeout or error → LTI failure: `502 LTI_SERVICE_ERROR`. Any mismatch, a missing row or an inactive platform → `409 PROVIDER_NOT_READY`. In both cases: no S1; the attempt is marked `failed` and the lease is cleared, each only if `redeeming_attempt` still holds this attempt; the grant stays unredeemed and free; the reservation stays with the pending connection. |
| 8 | S0, S1 … phase 2, compensation: accepted. Canvas S1 now also sends `url: <target_issuer>` (an existing optional field that "must equal the filled profile value", LTI contract §9.4). | Canvas S1 `400 PLATFORM_URL_NOT_IN_PROFILE` (the profile issuer changed in the LTI service) → `409 PROVIDER_NOT_READY`; nothing is created (that check comes before every conflict check, LTI §9.4 check order); attempt `failed`; lease cleared conditionally; grant free. |

`POST …/deployments` (Canvas `add_deployment`): unchanged (contract §4.7.2 order; the target is already local: `lti_platform_id`, `deploymentId`; issuer and client from `platform`). No V.

S0 also runs before V, with the same checks as before S1 (lease holder, at least 6 s left, grant not revoked, connection still in the start state). Call budget before phase 2: at most six calls (V + S1 + S2 + S3 + S2 + S3), all under the 5 s timeout, still well within the 60 s lease.

## D3. `app:grant issue` (contract §4.8)

Before anything is stored, one read-only `GET /api/providers`:
- **Blackboard:** as today, the profile row must have an active shared platform and `--client-id` must equal its client id. New: the live `sharedPlatform.id`, `clientId` and row `issuer` must equal the connection's `target_platform_id`, `target_client_id` and `target_issuer`, else exit 1 ("The Blackboard shared platform changed after this connection was made. Make a new connection.").
- **Canvas** (new read): the live row issuer, filled for self-hosted, must equal `target_issuer`, else exit 1 (same text, "Canvas profile").

If the read fails: exit 1, nothing stored (as today for Blackboard). `issue` still makes no LTI **write**.

## D4. Edges

| Edge | Result |
| --- | --- |
| Shared platform deactivated after create, before issue | issue: exit 1 (existing). |
| Deactivated after issue, before redemption | phase 1 succeeds locally; V → `409 PROVIDER_NOT_READY`, no S1; the reservation is kept; after the operator reactivates, the same code → `200` (retry reuses the reservation, check 7). |
| Shared platform deleted and recreated (new id or client), or a restore or new LTI database with another shared platform | issue: exit 1 (snapshot mismatch); V: `409 PROVIDER_NOT_READY`; no record is written on the new platform. Old reservations and attempt targets keep the old id; `DELETE`, `suspend` and `release` read it → `404` → `absent`. Remedy: a new connection. |
| Shared issuer differs (`issuer` of the row) | as above (V and issue compare it). |
| Canvas profile issuer changes in the LTI service after create (needs an ADR change) | issue: exit 1. A grant issued before the change: S1 → `400 PLATFORM_URL_NOT_IN_PROFILE` → `409 PROVIDER_NOT_READY`, no record. So a remote record always has the issuer that the attempt saved; the cleanup lookup (`url`, `clientId`, `profile`) cannot miss it. |
| App restart | The snapshot is in the database: no cold-cache read on refusal paths. The lease and dead-handler rules are unchanged. |
| Revoke, `DELETE` or `suspend` during V | V is a read. The next S0 (before S1) sees the revoke or the changed state → no S1; phase 2 fails → `403 GRANT_INVALID` or `409 CONNECTION_NOT_PENDING`, with no compensation (no S3). |
| A newer attempt during V | impossible while the lease is live (I1). If the lease was taken over, the next S0 gives `taken_over`, `403`, and no call. Every attempt and lease update stays conditional on `redeeming_attempt`. |
| Retry after V failure | same grant, new attempt, V again; the reservation is reused. |
| Cancel after V failure | `DELETE`: fence-out finds nothing (no S1) → `absent`; the reservation stays with the disabled connection until `release` (unchanged). |

## D5. Security and invariants kept

- No new trusted public identifier.
- The grant binding is unchanged: library, connection, LMS, profile, site, service, client id, deployment id and purpose. The Blackboard platform is pinned by an operator-verified snapshot at issue and re-validated (V) before any mutation.
- D1 and D2 isolation is unchanged: `add_deployment` never touches the platform or approved deployments.
- I1–I6, S0, the 5 s timeouts, the strict body, the finalized repeat and the cleanup ownership are unchanged.
- I6 is stronger: every target, including the Canvas issuer, is saved at phase 1 from local data.
- No new accepted limitation. The stale-data cases fail closed with `409 PROVIDER_NOT_READY`, and the remedy is a new connection.

## D6. Exact amendments if D is accepted (not applied)

| File | Change |
| --- | --- |
| App contract §4.2 | create rule: Canvas and Blackboard connections save the provider snapshot from the same providers read (D1); not in the DTO. |
| App contract §4.4 | PUT precedence table D2 steps 1–6; Canvas S1 body adds `url`; the row "Blackboard: no active shared platform" becomes V (step 7) and the null-snapshot case (step 3). |
| App contract §4.7.1 | Terms "Target": its source is the snapshot. Check 5 wording: "Blackboard: the connection's `target_client_id`". The LTI step table gets row V. S0 runs before V. Call budget: six. The outcome table gets two rows (V not ready; V read fails). |
| App contract §4.8 | issue validation D3. |
| Data model §4.2 | three columns, rules "write once, create handler only"; migration `012`. |
| ADR-011 §14 | migration list adds `012`. |
| M1 | new AC-M1-37 (v), (w), (x) and an AC-M1-29 (k) refusal (D7); unit-test list. |
| LTI contract | none (the `url` field and `PLATFORM_URL_NOT_IN_PROFILE` already exist). |

## D7. Regression and acceptance impact

New subcases, both providers where marked:
- **(v) zero outbound on local refusals (both providers):** gate `fail_before` on every `/api/*`, then `PUT …/platform` with (1) a well-formed unknown code → `403`; (2) a valid code during a live lease (dead handler of (d)) → `409 GRANT_IN_USE`; (3) another library's held deployment (Blackboard) → `409 DEPLOYMENT_IN_USE`; (4) a wrong `deploymentId` → `422 GRANT_MISMATCH`; (5) Blackboard body `clientId` ≠ shared → `422 INVALID_PLATFORM_VALUES` (`clientId`). Each makes **zero** gate requests.
- **(w) Blackboard readiness (V):** issue a grant, deactivate the shared platform through the LTI admin API (QA), `PUT` → `409 PROVIDER_NOT_READY`; the gate shows exactly one `GET /api/providers` and no `POST`; grant `issued`; reservation kept; reactivate → same code → `200`.
- **(x) V read failure:** `fail_before` on `GET /api/providers` with a valid Blackboard code → `502`, no `POST`, grant free; retry → `200`.
- **AC-M1-29 (k):** issue on a Blackboard connection whose snapshot differs from the live shared platform → exit 1 (QA may need to delete and recreate the shared platform; if this cannot be reached in SIM, unit test).

Gate schedules: each Blackboard attempt (also each retry) sends one `GET /api/providers` (V) after phase 1 and before S1. Rules on `POST` and `PATCH` do not match it. A `fail_before` on all `/api/*` now hits V first. The 5 s window of each held call is unchanged. Canvas attempts send no V. `tests/acceptance/M1/canvas/51-canvas-races.test.ts:162` (no new request on a lease refusal) needs no weakening.

Unit tests (Author):
- phase 1 and the route run with an LTI client that throws on any call for steps 1–6;
- the create handler writes the snapshot from the read, and no other path writes it;
- V cases;
- the issue snapshot checks;
- Canvas S1 sends `url`, and `PLATFORM_URL_NOT_IN_PROFILE` maps to `409`;
- migration `012` on v10 and on an `011` database.

No test may accept provider GETs before phase 1, or skip V, to pass.

## D8. Ownership hand-off (after independent acceptance only)

| Owner | Work |
| --- | --- |
| Author (engine owner) | migration `012`, `domain/connections.ts`, `app/connections.ts` (create capture; PUT uses the snapshot, no `sharedClientIdOf` on PUT), `app/binding-targets.ts` (local resolver), `app/redemption.ts` (V, S0 before V), `providers/canvas.ts` (S1 `url`), `app/operator.ts` (D3), unit tests |
| Codex QA | (v) Blackboard part, (w), (x), AC-M1-29 (k) |
| QA-E2E | (v) Canvas part |
| Architect | D6 contract text after acceptance |
| Reviewers A and B | independent review of this proposal first, then of the code |

## Clarification applied now (no behaviour change)

App contract §4.8 "Issue output" said "`issue` makes no LTI call". But the accepted Blackboard issue check ("`--client-id` equals the active shared platform client id") needs a read of the LTI service, which product does. The sentence now says: no LTI **write**; a Blackboard issue reads `GET /api/providers` once; if the read fails, exit 1 and nothing is stored. This matches the accepted check and the product; it adds nothing from D.

---

# B-M1-03 proposal D, revision 2 (REQUIRES DESIGN REVIEW; NOT ACCEPTED)

**Superseded by revision 3 below.** This revision stays unchanged as the reviewed record of `caa3541`; only revision 3 is normative.

Task `task_1d0ecd7020a8`, dispatch `ctx_fc5241ad834d`.

Inputs (reviews of proposal D at `a4bc3a4`):

| Report | Findings |
| --- | --- |
| Reviewer-A `docs/reviews/M1/reviewer-a-target-snapshot.md` | A-D-01 to A-D-05 |
| Reviewer-B `docs/reviews/M1/reviewer-b-target-snapshot.md` | B-M1-D-01 to B-M1-D-03 |
| Codex QA `docs/reviews/M1/qa-target-snapshot.md` | Q-TS-01 to Q-TS-04 |
| Lead messages | `msg_ade7f8526129`, `msg_0028acd06c91` |

This revision **replaces D1 to D8** of the first proposal. It stays a proposal until both reviewers and QA recheck it. No contract, data model, ADR or task file changes before that gate, so the R6 amendments are not applied yet. The only file that this revision changes is this one.

Unchanged core:
- an authoritative snapshot saved at create;
- one atomic, local, ordered phase-1 transaction before any LTI call;
- strict bodies and local finalized repeats;
- saved targets and write-ahead ref history;
- S0 and the 5 s call budget;
- Blackboard validation (V) before any mutation;
- the Canvas issuer pinned in S1;
- no new trusted public identifier;
- unchanged Moodle data and unchanged cleanup isolation.

## R0. Disposition per finding

| Id | Sev. | Disposition | Where |
| --- | --- | --- | --- |
| A-D-01 | MAJOR | Done. Every redemption endpoint builds its target **locally inside phase 1**: Canvas `initial` (snapshot and request), Canvas `add_deployment` (committed platform), Blackboard `initial` (snapshot and request). No endpoint reads providers before phase 1 commits. `POST …/deployments` never reads providers and never runs V. New zero-call cases for `POST …/deployments`. Unit test with an LTI client that throws on any call, for all three endpoints. | R2, R3, R8 |
| A-D-02 | MINOR | Done. The missing-snapshot refusal is phase-1 check **4a**, for purpose `initial` only, after the grant and start-state checks. The finalized repeat runs before phase 1 from the persisted `platform`. `add_deployment` issue and redemption use the committed platform and never need the snapshot. | R1, R2, R4 |
| A-D-03 | MINOR | Done. Canvas `initial` S1 `400 UNKNOWN_PROFILE` and `400 PLATFORM_URL_NOT_IN_PROFILE` both map to `409 PROVIDER_NOT_READY`, with the V-failure handling. `add_deployment` S1 errors keep the accepted mapping (`502`). | R3, R6 |
| A-D-04 | MINOR | Done. `grant_attempt_started` gets contract semantics: emitted **after** the phase-1 commit; FIFO positive control in the same process; no claim across a crash or restart. | R7 |
| A-D-05 | NIT | Done. The Blackboard `client_id` row of `tool-configuration` comes from local data (snapshot, else the persisted platform, else a refusal); `lms-providers` stays live. The self-hosted issuer wording is precise. | R1, R5 |
| B-M1-D-01 | MAJOR | Done. One purpose-specific lifecycle policy (table R1). Registered Canvas add-deployment on an old `011` row is **preserved**: issue and redemption use its committed platform, with no backfill and no provider read. Live profile issuer drift does **not** block `add_deployment` issue on any connection. | R1, R4 |
| B-M1-D-02 | MINOR | Done. After a V failure, cleanup still reads every saved target. An earlier owned record gives `fenced`, a foreign one `not_owned`. `absent` only means the saved id has no record. Provider drift is never proof of absence. | R6 |
| B-M1-D-03 | MINOR | Done. The audit event name, level, fields and emission point are defined, with bounded test semantics. | R7 |
| Q-TS-01 | MAJOR | Done. State/purpose table for null-snapshot rows (R1); populated `011→012` route (R8). | R1, R8 |
| Q-TS-02 | MAJOR | Done. V is a point-in-time observation, not a lock. Exact outcomes for changes after V, for V failure together with revoke, `DELETE` or `suspend`, and for delete/recreate. | R3, R6 |
| Q-TS-03 | MAJOR | Done. Same as B-M1-D-03, plus the atomic-rollback fixture as supplemental evidence. | R7, R8 |
| Q-TS-04 | MAJOR | Done. Individually mandatory result ids; separate `011→012` route in both full rounds; reachable Blackboard same-client drift; supplemental-only list. | R8 |

## R1. Snapshot fields and the old-`011` lifecycle

Fields (migration `012_connection_provider_snapshot.sql`, three nullable columns, forward only, no backfill; `011` and its ledger entry are not edited):

| Field | Source (from the one `GET /api/providers` answer that the create handler already reads for profile validation and `PROVIDER_NOT_READY`) | Required for |
| --- | --- | --- |
| `target_issuer` | Canvas cloud and sim: the row `issuer` (a fixed value). `canvas-self-hosted`: the row template `{siteUrl}` filled with the canonical `siteUrl` from the create body. That is the portal input after site rules 1–5, the same value that the grant binds as `--site` and that the accepted design already uses as the self-hosted issuer; it is not a new trusted identifier. Blackboard: the row `issuer`. | Canvas and Blackboard `initial` |
| `target_platform_id` | Blackboard: `sharedPlatform.id` (active at create). Else `NULL`. | Blackboard `initial` |
| `target_client_id` | Blackboard: `sharedPlatform.clientId`. Else `NULL`. | Blackboard `initial` |

Write rules:
- Only the create handler writes these fields, in the insert transaction, from that one response.
- No `UPDATE` path, no request field, no CLI flag. A create body never sets them: the existing create schema applies, and the stored values come only from the provider read.
- Not in the DTO.
- Moodle rows stay `NULL`; Moodle code never reads them.

A snapshot is **complete** when:
- Canvas: `target_issuer` is not `NULL`;
- Blackboard: all three fields are not `NULL`.

A partial Blackboard snapshot (not producible by the create handler) is treated as missing.

Lifecycle for a connection **without** a complete snapshot (old `011` rows only; v10 has no Canvas or Blackboard rows):

| State | Operation | Result |
| --- | --- | --- |
| `pending` Canvas or Blackboard | `PUT …/platform` | Steps R2.1–R2.4 as usual (`404`, `422`, no repeat). Phase 1 checks 1–4 as usual (`403` for any invalid code). Then check 4a → `409 PROVIDER_NOT_READY` ("Make a new connection"), no attempt, no lease, no reservation, no LTI call. |
| `pending` Canvas or Blackboard | `app:grant issue --purpose initial` | exit 1 "This connection has no provider snapshot. Make a new connection." No grant stored, no older grant revoked, no LTI call. |
| `pending` Blackboard | `GET …/tool-configuration` | `409 PROVIDER_NOT_READY` (no local client id; a null row is never returned). |
| `pending` Canvas | `GET …/tool-configuration`, `GET …/canvas-configuration` | unchanged (no snapshot value is used) |
| `registered` or `connected` Canvas or Blackboard | `PUT …/platform`, same values | `200` finalized repeat from the persisted `platform` (unchanged, local) |
| `registered` or `connected` | `PUT …/platform`, other values | phase 1 → check 4 `409 CONNECTION_NOT_PENDING` (unchanged; check 4a is never reached) |
| `registered` or `connected` Canvas | `app:grant issue --purpose add_deployment` | unchanged accepted rules; `--client-id` must equal the persisted `platform.clientId`; no provider read |
| `registered` or `connected` Canvas | `POST …/deployments` (repeat or new deployment) | unchanged: R2 precedence; target (`lti_platform_id`, `deploymentId`); issuer and client from `platform`; no provider read; no V |
| `registered` or `connected` Blackboard | `GET …/tool-configuration` | `client_id` row = persisted `platform.clientId` |
| `disabled`, any | `DELETE`, `suspend`, `release`, `app:grant revoke` cleanup | unchanged (saved attempt targets, reservation, `lti_platform_id`) |

Recovery for a pending old row: make a new connection (it gets a snapshot) and issue its grant. Nothing is backfilled and no public input is trusted.

## R2. Local precedence before any LTI call

`PUT …/platform`, Canvas and Blackboard. The first failure answers; steps 1–5 send **zero** LTI requests.

| # | Step | Failure |
| --- | --- | --- |
| 1 | connection of another library | `404` |
| 2 | no provider adapter (unit only) | `409 CAPABILITY_NOT_SUPPORTED` |
| 3 | strict body. Blackboard optional `clientId`, if sent, is compared with the **first non-null local source**: `target_client_id`, then the persisted `platform.clientId`. If both are `NULL` (old pending row), only its form is checked (1–255 printable ASCII without spaces). | `422 INVALID_PLATFORM_VALUES`, field names |
| 4 | finalized repeat: `registered` or `connected`, and the persisted `platform` has the same `clientId` (Canvas) and the `deploymentId` | `200`, nothing changes |
| 5 | phase 1, one `BEGIN IMMEDIATE` transaction: checks 1, 2, 3 (`403`), 4 (`409 CONNECTION_NOT_PENDING`), **4a** (`initial`: complete snapshot, else `409 PROVIDER_NOT_READY`), 5 (`422 GRANT_MISMATCH`; Blackboard client = `target_client_id`), 6 (`409 GRANT_IN_USE`), 7 (`409 DEPLOYMENT_IN_USE` / `DEPLOYMENT_FIXED`; key `target_platform_id`, `deploymentId`). Then the attempt row, the lease and the Blackboard reservation, then commit. | accepted answers, plus 4a |

The engine reads snapshot values only after check 4a. The attempt target is:
- Canvas: `lti_profile`, `target_issuer`, the request `clientId`, `deploymentId`;
- Blackboard: `target_platform_id`, `deploymentId`, issuer `target_issuer`, client `target_client_id`.

`POST …/deployments` (Canvas `add_deployment`). Unchanged order from C-2 (`ca14de6`), all local:
1. `404`;
2. `409 CAPABILITY_NOT_SUPPORTED`;
3. `409 CONNECTION_NOT_READY` (also when the committed `lti_platform_id` or `platform` is missing);
4. `422` strict body;
5. finalized repeat (approval) → `200`;
6. phase 1 checks 1–7 (no 4a), with target (`lti_platform_id`, `deploymentId`) and issuer and client from `platform`.

No provider read and no V. The engine never builds a target or a create request before phase 1 commits, for any endpoint.

## R3. LTI step for Blackboard `initial`: V and its limit

After the phase-1 commit and the `grant_attempt_started` line, the sequence is: S0 → **V** (`GET /api/providers`, 5 s timeout) → **post-V decision** → S0 → S1 … (accepted).

The post-V decision runs once after every V result: an answer, an error or a timeout. It is one short transaction. It applies the first matching row:

| # | Condition | Answer | Attempt, lease, grant, reservation |
| --- | --- | --- | --- |
| 1 | the lease no longer holds this attempt | `403 GRANT_INVALID` (`taken_over`) | attempt `cancelled`; lease unchanged; grant unchanged; reservation unchanged |
| 2 | the connection is no longer `pending` (`DELETE` or `suspend`; both also revoke the grant) | `409 CONNECTION_NOT_PENDING` (the accepted AC-M1-37 (g) answer) | attempt `cancelled`; lease cleared if it holds this attempt; grant stays revoked; reservation kept |
| 3 | the grant is revoked or replaced by the operator (connection still `pending`) | `403 GRANT_INVALID` (`revoked` / `replaced`) | as row 2 |
| 4 | V timed out or failed | `502 LTI_SERVICE_ERROR` | attempt `failed`; lease cleared if it holds this attempt; grant unchanged (`issued`); reservation kept |
| 5 | V answered, but the profile row is missing, `sharing` is not `shared`, the row `issuer` ≠ `target_issuer`, `sharedPlatform` is `NULL`, its `id` ≠ `target_platform_id`, its `clientId` ≠ `target_client_id`, or `active` is false | `409 PROVIDER_NOT_READY` | as row 4 |
| 6 | V matched | continue with S0 → S1 | — |

Cancellation always wins over a V result. No row makes a revoked grant usable again. A read-only attempt never compensates (it has no S3), so rows 1–5 send no further LTI call.

**Limit (stated, not a guarantee).** V is a point-in-time readiness observation, not a lock in the LTI service.
- **Deactivated after V:** S1 and S3 still go to the pinned platform id. The accepted LTI deployment endpoints do not check the parent platform's `active` flag. So the attempt can commit an approval (`200 registered`) while the parent is inactive. Every login, launch and service call of that platform then fails in the LTI service (`PLATFORM_NOT_ACTIVE`) until the operator reactivates it. No authority comes from this: approval routing (I2) and the inactive parent both still apply. This boundary already existed in revision 6; D does not change it, and the documents must not call V an atomic readiness guarantee.
- **Deleted or re-created after V:** S1 `POST /api/platforms/{pinned id}/deployments` gets `404 UNREGISTERED_PLATFORM`. For a shared target this maps to `409 PROVIDER_NOT_READY`, with row 4 handling. No record is created, and no write ever goes to the new platform. A later S2 or S3 `404` keeps the accepted LTI-failure mapping (`502`).

Call budget before phase 2 for Blackboard: V + S1 + S2 + S3 + S2 + S3 = 6 calls, each under S0 and the 5 s timeout, inside the 60 s lease. Canvas has no V (at most 5 calls).

## R4. `app:grant issue` (proposed §4.8 text after acceptance)

Every check runs before the grant transaction. On any failure: exit 1, no grant stored, no older grant revoked.

| Purpose | Rule |
| --- | --- |
| `initial`, Canvas | complete snapshot (else R1 exit 1). One `GET /api/providers` (read failure → exit 1). Exit 1 if the connection's profile row is missing, or if the row issuer filled with the canonical `siteUrl` ≠ `target_issuer` ("The Canvas profile changed after this connection was made. Make a new connection."). |
| `initial`, Blackboard | complete snapshot. One `GET /api/providers` (read failure → exit 1). The row must have an active shared platform whose `id`, `clientId` and row `issuer` equal the snapshot, and `--client-id` must equal that client id, else exit 1 ("The Blackboard shared platform changed after this connection was made. Make a new connection."). |
| `add_deployment`, Canvas | unchanged accepted rules: a `registered` or `connected` Canvas connection with its committed platform, and `--client-id` = `platform.clientId`. **No provider read, no snapshot needed, no issuer comparison**: the target is the existing platform, so profile drift does not block it. |

`issue` never writes to the LTI service. After acceptance, the §4.8 clarification already applied names the Canvas `initial` read as well.

## R5. Configuration rows (A-D-05)

- `GET …/tool-configuration`, Blackboard `client_id` row: `target_client_id`; else the persisted `platform.clientId`; else `409 PROVIDER_NOT_READY`. No provider read on this path.
- `GET /app-api/lms-providers` stays live; it describes the providers for **new** connections. After a shared platform is replaced, an existing connection keeps showing the client id that it accepts. Its redemption and issue then answer "make a new connection".

## R6. Outcomes and cleanup (additions to the accepted outcome table)

| Case | Answer | Grant | Attempt, lease | Reservation | Remote record | Cleanup |
| --- | --- | --- | --- | --- | --- | --- |
| Local refusal, any step R2.1–R2.5 | as R2 | unchanged | no attempt, no lease change | unchanged | unchanged | — |
| V row 4 or 5 (first attempt) | `502` or `409 PROVIDER_NOT_READY` | `issued` | `failed`; lease cleared | kept | none from this attempt | retry the same code later; `DELETE` → fence-out reads all saved targets |
| V failure after an earlier lost S3 (attempt A left an active owned deployment; attempt B fails at V) | `409` or `502` | `issued` | B `failed` | kept | A's record unchanged by B | `DELETE` or `suspend` finds A's saved target → `fenced`. A record with another connection's ref → `not_owned`. Only a `404` at the saved id → `absent`. |
| Revoke, `DELETE` or `suspend` around V (rows 1–3) | `403` or `409 CONNECTION_NOT_PENDING` | revoked | `cancelled` | kept (released only by `release`) | none from this attempt | as above |
| Deactivated after V | `200 registered` possible | `redeemed` | `committed` | kept | active deployment under an inactive parent | operator reactivates, or `suspend` |
| Deleted or re-created after V | `409 PROVIDER_NOT_READY` (S1 `404`) | `issued` | `failed` | kept | none; nothing on the new platform | `DELETE` → saved old id → `absent`; a new connection binds on the new platform |
| Canvas S1 `400 UNKNOWN_PROFILE` or `400 PLATFORM_URL_NOT_IN_PROFILE` | `409 PROVIDER_NOT_READY` | `issued` (or as row 2 or 3 if cancelled first) | `failed`; lease cleared if held | — | none | retry after the profile returns, or a new connection |

Provider drift is never proof that a saved target is absent. Cleanup reads each saved id.

## R7. `grant_attempt_started`: event contract and bounded test use

Contract (app contract §12 after acceptance):
- Event `grant_attempt_started`, level `info`.
- Fields: `trace_id`, `grant_id`, `connection_id`, `attempt_id`, `purpose`.
- Emitted **after** the phase-1 transaction commits: exactly one line per committed phase 1 in a healthy process. Never on a refusal or a rolled-back transaction.
- The service logger writes through a buffered stream in first-in, first-out order. The line is not durable: a crash or restart can lose it.

Bounded test use (M1 QA notes after acceptance):
1. Only in a healthy process with complete capture of `cogniate-app.jsonl`.
2. Take a connection-scoped cursor before the request. Unknown codes have no grant id, so scope by connection and time window.
3. After the refused request, wait with a deadline for a **positive control in the same process and stream**: the refused request's own `http_request` line (same `trace_id`; it is written when the answer is sent, after any phase-1 line of that request). A suite also runs one positive-control redemption that produces exactly one event, including one attempt that fails at V.
4. A missing positive control or incomplete capture is a blocked result, not a pass. A fixed sleep proves nothing.
5. No claim across a crash or `stack:restart`. Dead-handler schedules first confirm the first attempt's event before the kill, then use API answers, gate events and CLI state for the restarted process.
6. Absence of the event is not a database oracle. Atomic rollback of attempt, lease and reservation is supplemental unit or integration evidence: inject a failure between those writes and observe that none survives.

## R8. Acceptance and test inventory (individually mandatory ids; proposed M1 and M3 text)

All cases below are `SIM` unless marked. Rules for all of them:
- Finish fixture setup, including CLI provider reads, before the cursor.
- Count every gate `received` request on every method after the cursor; never filter GETs.
- A paired valid Blackboard request with the same faults must reach V, which proves that capture is active.
- Every existing AC and race subcase stays required.
- The new ids run in both full rounds at the same product and test SHAs.

| Id | Case | Oracle |
| --- | --- | --- |
| 37 (v1) | unknown code, Canvas `PUT` | `403`, `grant_rejected not_found`, zero requests, R7 no event |
| 37 (v2) | unknown code, Blackboard `PUT` | same |
| 37 (v3) | unknown code, Canvas `POST …/deployments` | same |
| 37 (v4) | live lease (dead handler of (d)), Canvas `PUT` | `409 GRANT_IN_USE`, zero new requests, no event; skipped if the restart misses the lease window |
| 37 (v5) | live lease, Blackboard `PUT` | same |
| 37 (v6) | live lease, Canvas `POST …/deployments` | same |
| 37 (v7) | foreign reservation, Blackboard (B's grant issued before faults) | `409 DEPLOYMENT_IN_USE`, zero requests; A's approval, generation and key unchanged |
| 37 (v8) | wrong `deploymentId`, Canvas `PUT` | `422 GRANT_MISMATCH` (`deploymentId`), zero requests |
| 37 (v9) | wrong `deploymentId` that is also a foreign reservation, Blackboard | `422 GRANT_MISMATCH` before `DEPLOYMENT_IN_USE`, zero requests |
| 37 (v10) | wrong `deploymentId`, Canvas `POST …/deployments` | `422 GRANT_MISMATCH`, zero requests |
| 37 (v11) | Blackboard body `clientId` ≠ snapshot; omitted and matching values as positive controls | `422 INVALID_PLATFORM_VALUES` (`clientId`), no `grant_rejected`, zero requests |
| 37 (v12) | local guard matrix (wrong library, malformed body, finalized repeat), also after a cold app restart | R2 first-failure order; repeat `200` consumes no grant |
| 37 (w) | V inactive: fresh empty shared platform; issue A's and a competing B grant; deactivate; redeem A; reactivate; B; retry A | A `409 PROVIDER_NOT_READY` with exactly one V and no S1; one event; grant `issued`. B `409 DEPLOYMENT_IN_USE` (A kept the reservation). A retry → `200`, with its own V and event. |
| 37 (x1) | V `fail_before` | `502`, one V, no writes, grant `issued`; retry → `200` |
| 37 (x2) | V held past 5 s (`caller_gone`), then released | `502`; the late answer causes no write and no continuation |
| 37 (y1) | `hold_after` on V, deactivate the platform, release within 5 s | R3 limit: `200 registered` possible, launches `PLATFORM_NOT_ACTIVE` until reactivation; the record is on the pinned id |
| 37 (y2) | `hold_after` on V, delete and re-create the empty platform, release | `409 PROVIDER_NOT_READY` (S1 `404`); no write on the new platform |
| 37 (z1)–(z3) | `hold_after` on a matching V; then (z1) `app:grant revoke`, (z2) `DELETE`, (z3) `suspend`; release within 5 s | (z1) `403 GRANT_INVALID` (row 3); (z2), (z3) `409 CONNECTION_NOT_PENDING` (row 2); no S1, no compensation |
| 37 (z4) | `hold_after` on a non-matching V; then `app:grant revoke`; release | `403` (row 3 before row 5); grant stays revoked |
| 37 (z5) | lost S3 (attempt A), deactivate, attempt B fails at V, then `DELETE` and `suspend` | B `409`; cleanup `fenced` on A's saved target |
| 37 (aa) | Canvas `initial` S1 `400 UNKNOWN_PROFILE`: `canvas-sim-cloud` connection and grant, then `stack:restart -- lti-service` with simulations off (AC-M1-35 control), then `PUT` | `409 PROVIDER_NOT_READY`, no platform, grant `issued` |
| 29 (k1) | Blackboard drift: pending C at P0, grant G0; delete the empty P0; re-create P1 with the **same** client id (fresh QA project); issue for C; redeem G0; app restart; repeat; new C1 at P1 as a positive control | issue exit 1 after one read, no grant change; G0 → `409 PROVIDER_NOT_READY` (V), no write on P1; C stays pinned after restart; C1 issues and binds |
| 29 (k2) | shared platform missing at issue | issue exit 1 |
| 29 (k3) | re-created with another client id | issue exit 1 (does not isolate the client comparator; unit test does) |
| 38 (h) | populated `011→012` route (new host route, separate from AC-M1-23/30, in both full rounds): seed on a pinned build with `011` and no `012`, through public API and CLI only. Seed: pending Canvas and Blackboard, registered Canvas with an approval and a key, registered Blackboard, failed attempts with saved targets, and an issued `add_deployment` grant. Stop, back up, upgrade, then exercise every R1 row. | R1 results; approved deployment and old key keep working while a new deployment is added; failed issue leaves grants unchanged; cleanup and release of old rows use saved targets. Read-only inspection of stopped database copies is supplemental. |
| fresh `012` | new connections: snapshot path, restart persistence, self-hosted canonical issuer, Moodle create with no provider call, restart applies no migration twice | positive controls |

**Supplemental, unit or integration only (never a `SIM` row):**
- adapter missing;
- partial snapshot;
- snapshot capture from one response (later reads never overwrite);
- each single-field V and issue comparator (id, client, issuer, inactive, missing row, wrong sharing; Canvas cloud and self-hosted issuer);
- create-body snapshot keys never stored;
- Canvas S1 sends `url: target_issuer`, and both `400` codes map to `409`;
- `grant_attempt_started` after commit;
- atomic rollback injection;
- the resolver and phase 1 for all three endpoints with an LTI client that throws on any call;
- the post-V decision order.

Fixed profile issuer changes cannot be reached through the simulator or admin API. Do not rewrite responses or change production profiles to reach them.

Gate schedules:
- Existing `POST` and `PATCH` rules do not match V.
- An all-`/api/*` `fail_before` hits V first.
- Issue-time provider GETs belong to preparation.
- Each held call keeps its 5 s; a live schedule that misses it is `BLOCKED`, never a reason to change production timeouts.

Accounting: QA owns common and Blackboard ids, the `011` route and the case accounting. QA-E2E owns the Canvas variants. The Author owns product and colocated unit tests.

## R9. Amendments after acceptance (not applied) and ownership

| File | Change |
| --- | --- |
| App contract §4.2 | snapshot capture (R1) |
| App contract §4.4 | R2 precedence; Canvas S1 `url`; the readiness row becomes check 4a and V |
| App contract §4.7.1 | Terms (target source); check 4a; check 5 Blackboard source; V row and post-V decision; budget; outcome rows R6; the V limit |
| App contract §4.7.2 | unchanged order; note "no provider read" |
| App contract §4.8 | R4 |
| App contract §12 | `grant_attempt_started` (R7) |
| `tool-configuration` rule | R5 |
| Data model §4.2 | three columns, write rules, migration `012` |
| ADR-011 §14 | migration list adds `012` |
| M1 | R8 ids and unit list |
| M3 | the `011` route in both rounds |
| LTI contract | none |

Ownership after acceptance: the Lead assigns. `services/cogniate-app/src/providers/canvas.ts` (S1 `url`) stays with its current Canvas owner until the Lead makes an explicit transfer. This proposal transfers nothing.

---

# B-M1-03 proposal D, revision 3 — AUTHORITATIVE (REQUIRES DESIGN REVIEW; NOT ACCEPTED)

Task `task_68130407ba89`, dispatch `ctx_ebe383641cd8`. **This section is the one coherent normative proposal.** It replaces revision 2 (above, kept as the reviewed record of `caa3541`) and, through it, D1–D8 of `a4bc3a4`. Section numbers R3.0–R3.10 belong to this revision only.

Inputs (Round 2 reviews of revision 2 at `caa3541`):

| Report | Findings |
| --- | --- |
| Reviewer-A `docs/reviews/M1/reviewer-a-target-snapshot.md`, Round 2 (Lead `msg_d3456c44427d`) | APPROVE; A-D-06, A-D-07 MINOR; A-D-08 NIT |
| Reviewer-B `docs/reviews/M1/reviewer-b-target-snapshot.md`, Round 2 (`6222358`) | B-M1-D-04 MAJOR; B-M1-D-05, B-M1-D-06 MINOR; one NIT |
| Codex QA `docs/reviews/M1/qa-target-snapshot.md`, Round 2 (`9eb5da3`) | Q-TS-01 residual MAJOR; Q-TS-04 residual and Q-TS-R2-01 MINOR |

It stays a proposal until both reviewers and QA recheck it. No contract, data model, ADR, task, product, test or team file changes before that gate; the amendments in R3.9 come after it. This is a bounded correction of the existing scope: no new function and no new public field.

Unchanged core:
- an authoritative snapshot saved at create;
- one atomic, local, ordered phase-1 transaction before any LTI call;
- strict bodies and local finalized repeats;
- saved targets and write-ahead ref history;
- S0 and the 5 s call budget;
- Blackboard validation (V) before any mutation;
- the Canvas issuer pinned in S1;
- no new trusted public identifier;
- unchanged Moodle data and unchanged cleanup isolation;
- accepted I1–I6, timeouts, phase order and migration rules;
- explicit ownership.

## R3.0. Disposition per finding

### Round 2 findings (reviews of revision 2 at `caa3541`)

| Id | Sev. | Disposition | Where |
| --- | --- | --- | --- |
| B-M1-D-04 | MAJOR | Done. The old-pending recovery is one fixed order of accepted operations: (1) new connection with a snapshot, (2) rightful `initial` grant first, (3) `suspend` the old row (fence-out of its saved targets), (4) `release` after the lease and active-record preconditions, (5) redeem at once. It includes the accepted retry rule for a failed cleanup or a late write, and the D-12 limit. The populated route seeds both a Blackboard retained reservation and a Canvas active orphan, and checks every step, a negative control, and unchanged unrelated bindings and keys. | R3.1, R3.8 (38 h1, h5) |
| B-M1-D-05 | MINOR | Done. The registered other-values row gives the normal grant-first errors. The reachable fixture is the own redeemed `initial` code → `403` (`redeemed`), zero requests, no attempt. Check 4 `409` is a supplemental unit-only branch. | R3.1, R3.8 (38 h3), supplemental list |
| B-M1-D-06 | MINOR | Done. Phase 1 builds and saves the target from the fresh local row inside its transaction; no call before the commit; the S1 request is built from the committed target after the commit. | R3.2 |
| B (NIT) | NIT | Done. `skipped` is removed. A missed window is `BLOCKED`, which fails the gate. | R3.8 (v4–v6), gate rules |
| Q-TS-01 (residual) | MAJOR | Done. Same correction as B-M1-D-05. The seeds give both old pending providers a valid `initial` code before the upgrade (reaches 4a); unknown codes stay `403`; a new issue exits 1. | R3.1, R3.8 (38 h1–h3) |
| Q-TS-04 (residual) | MINOR | Done. Stable ids for the fresh `012` controls, 38 (i1)–(i5); the repeated-start check is supplemental. v4–v6 use a new cursor in the restarted healthy process with its own completion control, never a pre/post-kill comparison; missed schedules are `BLOCKED`. | R3.7 rule 5, R3.8 |
| Q-TS-R2-01 | MINOR | Done. Same correction as B-M1-D-06. | R3.2 |
| A-D-06 | MINOR | Done. One neutral `PROVIDER_NOT_READY` title and action for every LMS and cause; no new public reason field; an internal `provider_not_ready {cause}` log for operator diagnosis. The exact later M2, portal and contract changes and their owners are listed. | R3.10, R3.9 |
| A-D-07 | MINOR | Done, with the complete B-M1-D-04 order (instead of the shorter "disconnect first" order), plus the negative control: before step 3, the new connection gets `409 DEPLOYMENT_IN_USE` (Blackboard) or `409 PLATFORM_IN_USE` (Canvas). | R3.1, R3.8 (38 h5) |
| A-D-08 | NIT | Done, all six items: (1) "builds the target from snapshot values only after check 4a"; (2) audit reasons `taken_over`, `connection_changed`, `revoked` / `replaced` in rows 1–3; (3) readiness answers of Canvas S1 and Blackboard S1 run the same decision (rows 1–3 first); (4) "checks 1–3, then check 4"; (5) platform ids are never reused, which goes into the LTI contract; (6) z5 is one run with the exact repeated `suspend` oracle. | R3.1, R3.2, R3.3, R3.6, R3.8, R3.9 |
| Self-check | — | Fixed: revision 2's header pointed to "the R6 amendments"; the amendments are R3.9. | header |

Round 2 verdicts: Reviewer-A APPROVE (A-D-01 to A-D-05 closed); Reviewer-B CHANGES_REQUESTED (B-M1-D-01 to B-M1-D-03 closed); QA CHANGES_REQUESTED (Q-TS-02 and Q-TS-03 closed). This revision answers every open item above. It is still **not accepted** until the three recheck it.

### Round 1 findings (reviews of `a4bc3a4`; dispositions kept, section references now point to revision 3)

| Id | Sev. | Disposition | Where |
| --- | --- | --- | --- |
| A-D-01 | MAJOR | Done. Every redemption endpoint builds its target **locally inside phase 1**: Canvas `initial` (snapshot and request), Canvas `add_deployment` (committed platform), Blackboard `initial` (snapshot and request). No endpoint reads providers before phase 1 commits. `POST …/deployments` never reads providers and never runs V. New zero-call cases for `POST …/deployments`. Unit test with an LTI client that throws on any call, for all three endpoints. | R3.2, R3.3, R3.8 |
| A-D-02 | MINOR | Done. The missing-snapshot refusal is phase-1 check **4a**, for purpose `initial` only, after the grant and start-state checks. The finalized repeat runs before phase 1 from the persisted `platform`. `add_deployment` issue and redemption use the committed platform and never need the snapshot. | R3.1, R3.2, R3.4 |
| A-D-03 | MINOR | Done. Canvas `initial` S1 `400 UNKNOWN_PROFILE` and `400 PLATFORM_URL_NOT_IN_PROFILE` both map to `409 PROVIDER_NOT_READY`, with the V-failure handling. `add_deployment` S1 errors keep the accepted mapping (`502`). | R3.3, R3.6 |
| A-D-04 | MINOR | Done. `grant_attempt_started` gets contract semantics: emitted **after** the phase-1 commit; FIFO positive control in the same process; no claim across a crash or restart. | R3.7 |
| A-D-05 | NIT | Done. The Blackboard `client_id` row of `tool-configuration` comes from local data (snapshot, else the persisted platform, else a refusal); `lms-providers` stays live. The self-hosted issuer wording is precise. | R3.1, R3.5 |
| B-M1-D-01 | MAJOR | Done. One purpose-specific lifecycle policy (table R3.1). Registered Canvas add-deployment on an old `011` row is **preserved**: issue and redemption use its committed platform, with no backfill and no provider read. Live profile issuer drift does **not** block `add_deployment` issue on any connection. | R3.1, R3.4 |
| B-M1-D-02 | MINOR | Done. After a V failure, cleanup still reads every saved target. An earlier owned record gives `fenced`, a foreign one `not_owned`. `absent` only means the saved id has no record. Provider drift is never proof of absence. | R3.6 |
| B-M1-D-03 | MINOR | Done. The audit event name, level, fields and emission point are defined, with bounded test semantics. | R3.7 |
| Q-TS-01 | MAJOR | Done. State/purpose table for null-snapshot rows (R3.1); populated `011→012` route (R3.8). | R3.1, R3.8 |
| Q-TS-02 | MAJOR | Done. V is a point-in-time observation, not a lock. Exact outcomes for changes after V, for V failure together with revoke, `DELETE` or `suspend`, and for delete/recreate. | R3.3, R3.6 |
| Q-TS-03 | MAJOR | Done. Same as B-M1-D-03, plus the atomic-rollback fixture as supplemental evidence. | R3.7, R3.8 |
| Q-TS-04 | MAJOR | Done. Individually mandatory result ids; separate `011→012` route in both full rounds; reachable Blackboard same-client drift; supplemental-only list. | R3.8 |

## R3.1. Snapshot fields and the old-`011` lifecycle

Fields (migration `012_connection_provider_snapshot.sql`, three nullable columns, forward only, no backfill; `011` and its ledger entry are not edited):

| Field | Source (from the one `GET /api/providers` answer that the create handler already reads for profile validation and `PROVIDER_NOT_READY`) | Required for |
| --- | --- | --- |
| `target_issuer` | Canvas cloud and sim: the row `issuer` (a fixed value). `canvas-self-hosted`: the row template `{siteUrl}` filled with the canonical `siteUrl` from the create body. That is the portal input after site rules 1–5, the same value that the grant binds as `--site` and that the accepted design already uses as the self-hosted issuer; it is not a new trusted identifier. Blackboard: the row `issuer`. | Canvas and Blackboard `initial` |
| `target_platform_id` | Blackboard: `sharedPlatform.id` (active at create). Else `NULL`. | Blackboard `initial` |
| `target_client_id` | Blackboard: `sharedPlatform.clientId`. Else `NULL`. | Blackboard `initial` |

Write rules:
- Only the create handler writes these fields, in the insert transaction, from that one response.
- No `UPDATE` path, no request field, no CLI flag. A create body never sets them: the existing create schema applies, and the stored values come only from the provider read.
- Not in the DTO.
- Moodle rows stay `NULL`; Moodle code never reads them.

A snapshot is **complete** when:
- Canvas: `target_issuer` is not `NULL`;
- Blackboard: all three fields are not `NULL`.

A partial Blackboard snapshot (not producible by the create handler) is treated as missing.

Lifecycle for a connection **without** a complete snapshot (old `011` rows only; v10 has no Canvas or Blackboard rows):

| State | Operation | Result |
| --- | --- | --- |
| `pending` Canvas or Blackboard | `PUT …/platform` | Steps R3.2.1–R3.2.4 as usual (`404`, `422`, no repeat). Phase 1 checks 1–4 as usual (`403` for any invalid code). Then check 4a → `409 PROVIDER_NOT_READY` (R3.10 text; log `cause: no_snapshot`), no attempt, no lease, no reservation, no LTI call. Recovery: the R3.1 order below. |
| `pending` Canvas or Blackboard | `app:grant issue --purpose initial` | exit 1 "This connection has no provider snapshot. Make a new connection." No grant stored, no older grant revoked, no LTI call. |
| `pending` Blackboard | `GET …/tool-configuration` | `409 PROVIDER_NOT_READY` (no local client id; a null row is never returned). |
| `pending` Canvas | `GET …/tool-configuration`, `GET …/canvas-configuration` | unchanged (no snapshot value is used) |
| `registered` or `connected` Canvas or Blackboard | `PUT …/platform`, same values | `200` finalized repeat from the persisted `platform` (unchanged, local) |
| `registered` or `connected` | `PUT …/platform`, other values (no finalized repeat) | the normal ordered phase-1 errors, grant checks first: an unknown code → check 1 `403 GRANT_INVALID` (`not_found`); the connection's own redeemed `initial` code → check 2 `403` (`redeemed`); an `add_deployment` code → check 3 `403` (`purpose`). Check 4 `409 CONNECTION_NOT_PENDING` answers only when checks 1–3 pass. That needs an unredeemed, unrevoked `initial` grant on a registered connection, which the CLI never issues (C-3), so check 4 here is a **supplemental unit-only** branch with an injected grant. Check 4a is never reached. Zero LTI requests and no attempt in every case. |
| `registered` or `connected` Canvas | `app:grant issue --purpose add_deployment` | unchanged accepted rules; `--client-id` must equal the persisted `platform.clientId`; no provider read |
| `registered` or `connected` Canvas | `POST …/deployments` (repeat or new deployment) | unchanged: R3.2 precedence; target (`lti_platform_id`, `deploymentId`); issuer and client from `platform`; no provider read; no V |
| `registered` or `connected` Blackboard | `GET …/tool-configuration` | `client_id` row = persisted `platform.clientId` |
| `disabled`, any | `DELETE`, `suspend`, `release`, `app:grant revoke` cleanup | unchanged (saved attempt targets, reservation, `lti_platform_id`) |

Recovery for a pending old row C0 (Canvas or Blackboard), using only accepted operations (app contract §4.8, §4.9). C0 may still hold a Blackboard reservation, or an active owned Canvas orphan from a lost S3 answer, and both block a new connection: check 7 refuses a reservation held by a **pending** connection, and adoption A1–A3 refuses an active record with another connection's ref. So the order is fixed:

| Step | Operator action | Expected result |
| --- | --- | --- |
| 1 | The library makes a new connection C1 with the rightful values; it gets a complete snapshot. | `201`, `pending` |
| 2 | `app:grant issue --purpose initial` for C1 (the rightful grant first, as in the D-12 operator order). | exit 0 |
| 3 | `app:binding suspend --connection C0`. C0 becomes `disabled`, its unredeemed grants are revoked (`suspend`), and the fence-out writes a new ref on every owned saved target (Blackboard deployment; Canvas platform, found by the saved issuer, client and profile). | exit 0. Per saved target: an owned record → `fenced`; no record → `absent` (for example a Blackboard attempt whose S1 never reached the LTI service). On `failed`: run `suspend` again (accepted retry rule). |
| 4 | `app:binding release --connection C0`, after its preconditions: C0 is `disabled`; its lease is not live (a dead handler's lease lasts until 60 s after its phase 1; else exit 1 "retry after <n> s"); no owned record is active. | exit 0. Per saved target: an owned inactive record → Canvas `deleted` (conditional delete), Blackboard `kept_inactive` (the deployment row stays inactive); no record → `absent`. Then C0's own local rows are deleted: its reservation (Blackboard) and its approvals. On `failed`, or after a late write: run `suspend` and `release` again (accepted rule; the saved targets find a late record). |
| 5 | C1 redeems its code at once. | Blackboard: check 7 finds the reservation free, and C1 takes it. If step 4 gave `kept_inactive` (a deployment row exists), S1 gets `409 DEPLOYMENT_ALREADY_EXISTS` → S2 adopts the inactive row (A3, C1 holds the reservation) → S3 → generation + 1 → `200`. If step 4 gave `absent` (no row), S1 creates the deployment inactive (generation 0) → S3 activates it (generation 1) → `200`. Canvas: any owned platform was deleted at step 4, so S1 creates a new platform with the pinned `url` → `200`. |

Every other connection, approval and key stays unchanged in every step. The accepted self-hosted limit D-12 applies between steps 4 and 5: a grant-free Moodle connect can take a released `canvas-self-hosted` issuer and client id first. Step 2 before step 3 makes that window short; it does not close it. Nothing is backfilled, no snapshot is edited, no local history is deleted, no reservation rule is bypassed, and no public input is trusted.

## R3.2. Local precedence before any LTI call

`PUT …/platform`, Canvas and Blackboard. The first failure answers; steps 1–5 send **zero** LTI requests.

| # | Step | Failure |
| --- | --- | --- |
| 1 | connection of another library | `404` |
| 2 | no provider adapter (unit only) | `409 CAPABILITY_NOT_SUPPORTED` |
| 3 | strict body. Blackboard optional `clientId`, if sent, is compared with the **first non-null local source**: `target_client_id`, then the persisted `platform.clientId`. If both are `NULL` (old pending row), only its form is checked (1–255 printable ASCII without spaces). | `422 INVALID_PLATFORM_VALUES`, field names |
| 4 | finalized repeat: `registered` or `connected`, and the persisted `platform` has the same `clientId` (Canvas) and the `deploymentId` | `200`, nothing changes |
| 5 | phase 1, one `BEGIN IMMEDIATE` transaction: checks 1, 2, 3 (`403`), 4 (`409 CONNECTION_NOT_PENDING`), **4a** (`initial`: complete snapshot, else `409 PROVIDER_NOT_READY`), 5 (`422 GRANT_MISMATCH`; Blackboard client = `target_client_id`), 6 (`409 GRANT_IN_USE`), 7 (`409 DEPLOYMENT_IN_USE` / `DEPLOYMENT_FIXED`; key `target_platform_id`, `deploymentId`). Then the attempt row, the lease and the Blackboard reservation, then commit. | accepted answers, plus 4a |

The engine builds the target from snapshot values only after check 4a, inside the phase-1 transaction. (Step 3 reads only `target_client_id`, for the body check.) The attempt target that it saves is:
- Canvas: `lti_profile`, `target_issuer`, the request `clientId`, `deploymentId`;
- Blackboard: `target_platform_id`, `deploymentId`, issuer `target_issuer`, client `target_client_id`.

`POST …/deployments` (Canvas `add_deployment`). Unchanged order from C-2 (`ca14de6`), all local:
1. `404`;
2. `409 CAPABILITY_NOT_SUPPORTED`;
3. `409 CONNECTION_NOT_READY` (also when the committed `lti_platform_id` or `platform` is missing);
4. `422` strict body;
5. finalized repeat (approval) → `200`;
6. phase 1 checks 1–7 (no 4a), with target (`lti_platform_id`, `deploymentId`) and issuer and client from `platform`.

No provider read and no V.

Target construction, for every endpoint: phase 1 builds the target from its fresh local connection row (after check 4a for `initial`, after check 4 for `add_deployment`). It saves the target in the attempt row in the **same** transaction, before the commit. No LTI call and no remote resolution happen before the commit. The S1 request is built from the committed target **after** the commit.

## R3.3. LTI step for Blackboard `initial`: V and its limit

After the phase-1 commit and the `grant_attempt_started` line, the sequence is: S0 → **V** (`GET /api/providers`, 5 s timeout) → **post-V decision** → S0 → S1 … (accepted).

The post-V decision runs once after every V result: an answer, an error or a timeout. It is one short transaction. It applies the first matching row:

| # | Condition | Answer | Attempt, lease, grant, reservation |
| --- | --- | --- | --- |
| 1 | the lease no longer holds this attempt | `403 GRANT_INVALID`; log `grant_redemption_cancelled {reason: "taken_over"}` | attempt `cancelled`; lease unchanged; grant unchanged; reservation unchanged |
| 2 | the connection is no longer `pending` (`DELETE` or `suspend`; both also revoke the grant) | `409 CONNECTION_NOT_PENDING` (the accepted AC-M1-37 (g) answer); log `grant_redemption_cancelled {reason: "connection_changed"}` | attempt `cancelled`; lease cleared if it holds this attempt; grant stays revoked; reservation kept |
| 3 | the grant is revoked or replaced by the operator (connection still `pending`) | `403 GRANT_INVALID`; log `grant_redemption_cancelled {reason: "revoked"}` or `{reason: "replaced"}` (from `revoked_reason`) | as row 2 |
| 4 | V timed out or failed | `502 LTI_SERVICE_ERROR` (no cancel event; the existing `outbound_request` line shows the call) | attempt `failed`; lease cleared if it holds this attempt; grant unchanged (`issued`); reservation kept |
| 5 | V answered, but the profile row is missing, `sharing` is not `shared`, the row `issuer` ≠ `target_issuer`, `sharedPlatform` is `NULL`, its `id` ≠ `target_platform_id`, its `clientId` ≠ `target_client_id`, or `active` is false | `409 PROVIDER_NOT_READY` (neutral text, R3.10); log `provider_not_ready {connection_id, profile, cause}` | as row 4 |
| 6 | V matched | continue with S0 → S1 | — |

Cancellation always wins over a V result. No row makes a revoked grant usable again. A read-only attempt never compensates (it has no S3), so rows 1–5 send no further LTI call.

**The same decision for every readiness answer.** Rows 1–3, then the readiness `409` with row 4 handling, also run after these answers: the Canvas `initial` S1 `400 UNKNOWN_PROFILE` or `400 PLATFORM_URL_NOT_IN_PROFILE`, and the Blackboard S1 `404 UNREGISTERED_PLATFORM`. Every other S1, S2 or S3 failure keeps the accepted LTI-failure path (`502`). These S1 answers create no record, so the attempt has no S3 and does not compensate.

**Limit (stated, not a guarantee).** V is a point-in-time readiness observation, not a lock in the LTI service.
- **Deactivated after V:** S1 and S3 still go to the pinned platform id. The accepted LTI deployment endpoints do not check the parent platform's `active` flag. So the attempt can commit an approval (`200 registered`) while the parent is inactive. Every login, launch and service call of that platform then fails in the LTI service (`PLATFORM_NOT_ACTIVE`) until the operator reactivates it. No authority comes from this: approval routing (I2) and the inactive parent both still apply. This boundary already existed in revision 6; D does not change it, and the documents must not call V an atomic readiness guarantee.
- **Deleted or re-created after V:** a re-created platform always has a new id. The LTI service never reuses a platform id (random ids; product: 96 random bits). R3.9 adds this premise to the LTI contract; the same client id and issuer therefore cannot hide a replacement. S1 `POST /api/platforms/{pinned id}/deployments` gets `404 UNREGISTERED_PLATFORM`. For a shared target this maps to `409 PROVIDER_NOT_READY`, with row 4 handling. No record is created, and no write ever goes to the new platform. A later S2 or S3 `404` keeps the accepted LTI-failure mapping (`502`).

Call budget before phase 2 for Blackboard: V + S1 + S2 + S3 + S2 + S3 = 6 calls, each under S0 and the 5 s timeout, inside the 60 s lease. Canvas has no V (at most 5 calls).

## R3.4. `app:grant issue` (proposed §4.8 text after acceptance)

Every check runs before the grant transaction. On any failure: exit 1, no grant stored, no older grant revoked.

| Purpose | Rule |
| --- | --- |
| `initial`, Canvas | complete snapshot (else R3.1 exit 1). One `GET /api/providers` (read failure → exit 1). Exit 1 if the connection's profile row is missing, or if the row issuer filled with the canonical `siteUrl` ≠ `target_issuer` ("The Canvas profile changed after this connection was made. Make a new connection."). |
| `initial`, Blackboard | complete snapshot. One `GET /api/providers` (read failure → exit 1). The row must have an active shared platform whose `id`, `clientId` and row `issuer` equal the snapshot, and `--client-id` must equal that client id, else exit 1 ("The Blackboard shared platform changed after this connection was made. Make a new connection."). |
| `add_deployment`, Canvas | unchanged accepted rules: a `registered` or `connected` Canvas connection with its committed platform, and `--client-id` = `platform.clientId`. **No provider read, no snapshot needed, no issuer comparison**: the target is the existing platform, so profile drift does not block it. |

`issue` never writes to the LTI service. After acceptance, the §4.8 clarification already applied names the Canvas `initial` read as well.

## R3.5. Configuration rows (A-D-05)

- `GET …/tool-configuration`, Blackboard `client_id` row: `target_client_id`; else the persisted `platform.clientId`; else `409 PROVIDER_NOT_READY`. No provider read on this path.
- `GET /app-api/lms-providers` stays live; it describes the providers for **new** connections. After a shared platform is replaced, an existing connection keeps showing the client id that it accepts. Its redemption (`409 PROVIDER_NOT_READY`) and issue (exit 1) then refuse. The operator follows the R3.1 recovery order for it, because the old connection can still hold a reservation.

## R3.6. Outcomes and cleanup (additions to the accepted outcome table)

| Case | Answer | Grant | Attempt, lease | Reservation | Remote record | Cleanup |
| --- | --- | --- | --- | --- | --- | --- |
| Local refusal, any step R3.2.1–R3.2.5 | as R3.2 | unchanged | no attempt, no lease change | unchanged | unchanged | — |
| V row 4 or 5 (first attempt) | `502` or `409 PROVIDER_NOT_READY` | `issued` | `failed`; lease cleared | kept | none from this attempt | retry the same code later; `DELETE` → fence-out reads all saved targets |
| V failure after an earlier lost S3 (attempt A left an active owned deployment; attempt B fails at V) | `409` or `502` | `issued` | B `failed` | kept | A's record unchanged by B | `DELETE` or `suspend` finds A's saved target → `fenced`. A record with another connection's ref → `not_owned`. Only a `404` at the saved id → `absent`. |
| Revoke, `DELETE` or `suspend` around V (rows 1–3) | `403` or `409 CONNECTION_NOT_PENDING` | revoked | `cancelled` | kept (released only by `release`) | none from this attempt | as above |
| Deactivated after V | `200 registered` possible | `redeemed` | `committed` | kept | active deployment under an inactive parent | operator reactivates, or `suspend` |
| Deleted or re-created after V | `409 PROVIDER_NOT_READY` (S1 `404`) | `issued` | `failed` | kept | none; nothing on the new platform | `DELETE` → saved old id → `absent`; a new connection binds on the new platform |
| Canvas S1 `400 UNKNOWN_PROFILE` or `400 PLATFORM_URL_NOT_IN_PROFILE` | `409 PROVIDER_NOT_READY`, after the R3.3 rows 1–3 (a cancellation answers first, with its own audit reason) | `issued` (revoked if cancelled) | `failed` (or `cancelled`); lease cleared if held | — | none | retry after the profile returns, or a new connection (R3.10 text) |

Provider drift is never proof that a saved target is absent. Cleanup reads each saved id.

## R3.7. `grant_attempt_started`: event contract and bounded test use

Contract (app contract §12 after acceptance):
- Event `grant_attempt_started`, level `info`.
- Fields: `trace_id`, `grant_id`, `connection_id`, `attempt_id`, `purpose`.
- Emitted **after** the phase-1 transaction commits: exactly one line per committed phase 1 in a healthy process. Never on a refusal or a rolled-back transaction.
- The service logger writes through a buffered stream in first-in, first-out order. The line is not durable: a crash or restart can lose it.

Bounded test use (M1 QA notes after acceptance):
1. Only in a healthy process with complete capture of `cogniate-app.jsonl`.
2. Take a connection-scoped cursor before the request. Unknown codes have no grant id, so scope by connection and time window.
3. After the refused request, wait with a deadline for a **positive control in the same process and stream**: the refused request's own `http_request` line (same `trace_id`; it is written when the answer is sent, after any phase-1 line of that request). A suite also runs one positive-control redemption that produces exactly one event, including one attempt that fails at V.
4. A missing positive control or incomplete capture is a blocked result, not a pass. A fixed sleep proves nothing.
5. No claim across a crash or `stack:restart`. A dead-handler schedule confirms the first attempt's event before the kill. For the restarted process it uses API answers, gate events and CLI state. An event-absence claim in the restarted process needs its own **new** cursor, taken after the restart in a healthy process, bounded by that process's own same-trace `http_request` control (rule 3). It is never a comparison of pre-kill and post-restart logs.
6. Absence of the event is not a database oracle. Atomic rollback of attempt, lease and reservation is supplemental unit or integration evidence: inject a failure between those writes and observe that none survives.

## R3.8. Acceptance and test inventory (individually mandatory ids; proposed M1 and M3 text)

All cases below are `SIM` unless marked. Rules for all of them:
- Finish fixture setup, including CLI provider reads, before the cursor.
- Count every gate `received` request on every method after the cursor; never filter GETs.
- A paired valid Blackboard request with the same faults must reach V, which proves that capture is active.
- Every existing AC and race subcase stays required.
- The new ids run in both full rounds at the same product and test SHAs.

| Id | Case | Oracle |
| --- | --- | --- |
| 37 (v1) | unknown code, Canvas `PUT` | `403`, `grant_rejected not_found`, zero requests, R3.7 no event |
| 37 (v2) | unknown code, Blackboard `PUT` | same |
| 37 (v3) | unknown code, Canvas `POST …/deployments` | same |
| 37 (v4) | live lease (dead handler of (d)), Canvas `PUT` | `409 GRANT_IN_USE`, zero new gate requests. The no-event check uses a new cursor in the restarted, healthy process with that request's own `http_request` control (R3.7 rule 5). `BLOCKED` (a gate failure, never a pass or a skip) if the restart misses the lease window. |
| 37 (v5) | live lease, Blackboard `PUT` | same as (v4), including the `BLOCKED` rule |
| 37 (v6) | live lease, Canvas `POST …/deployments` | same as (v4), including the `BLOCKED` rule |
| 37 (v7) | foreign reservation, Blackboard (B's grant issued before faults) | `409 DEPLOYMENT_IN_USE`, zero requests; A's approval, generation and key unchanged |
| 37 (v8) | wrong `deploymentId`, Canvas `PUT` | `422 GRANT_MISMATCH` (`deploymentId`), zero requests |
| 37 (v9) | wrong `deploymentId` that is also a foreign reservation, Blackboard | `422 GRANT_MISMATCH` before `DEPLOYMENT_IN_USE`, zero requests |
| 37 (v10) | wrong `deploymentId`, Canvas `POST …/deployments` | `422 GRANT_MISMATCH`, zero requests |
| 37 (v11) | Blackboard body `clientId` ≠ snapshot; omitted and matching values as positive controls | `422 INVALID_PLATFORM_VALUES` (`clientId`), no `grant_rejected`, zero requests |
| 37 (v12) | local guard matrix (wrong library, malformed body, finalized repeat), also after a cold app restart | R3.2 first-failure order; repeat `200` consumes no grant |
| 37 (w) | V inactive (assert the R3.10 text and the log `cause: platform_inactive`): fresh empty shared platform; issue A's and a competing B grant; deactivate; redeem A; reactivate; B; retry A | A `409 PROVIDER_NOT_READY` with exactly one V and no S1; one event; grant `issued`. B `409 DEPLOYMENT_IN_USE` (A kept the reservation). A retry → `200`, with its own V and event. |
| 37 (x1) | V `fail_before` | `502`, one V, no writes, grant `issued`; retry → `200` |
| 37 (x2) | V held past 5 s (`caller_gone`), then released | `502`; the late answer causes no write and no continuation |
| 37 (y1) | `hold_after` on V, deactivate the platform, release within 5 s | R3.3 limit: `200 registered` possible, launches `PLATFORM_NOT_ACTIVE` until reactivation; the record is on the pinned id |
| 37 (y2) | `hold_after` on V, delete and re-create the empty platform, release | `409 PROVIDER_NOT_READY` (S1 `404`; R3.10 text, `cause: platform_changed`); no write on the new platform |
| 37 (z1)–(z3) | `hold_after` on a matching V; then (z1) `app:grant revoke`, (z2) `DELETE`, (z3) `suspend`; release within 5 s | (z1) `403 GRANT_INVALID` (row 3); (z2), (z3) `409 CONNECTION_NOT_PENDING` (row 2); no S1, no compensation |
| 37 (z4) | `hold_after` on a non-matching V; then `app:grant revoke`; release | `403` (row 3 before row 5); grant stays revoked |
| 37 (z5) | one run: lost S3 (attempt A); deactivate; attempt B fails at V; then `DELETE`; then `app:binding suspend` on the same, now `disabled`, connection | B `409 PROVIDER_NOT_READY`. `DELETE` → `204`, fence-out line `fenced` for A's saved target (it was active). `suspend` → exit 0, its fence-out repeats: line `fenced` again (a new ref on the now inactive record), no other change (accepted AC-M1-38 (a) repeat rule). |
| 37 (aa) | Canvas `initial` S1 `400 UNKNOWN_PROFILE` (assert the R3.10 text and `cause: profile_missing`): `canvas-sim-cloud` connection and grant, then `stack:restart -- lti-service` with simulations off (AC-M1-35 control), then `PUT` | `409 PROVIDER_NOT_READY`, no platform, grant `issued` |
| 29 (k1) | Blackboard drift: pending C at P0, grant G0; delete the empty P0; re-create P1 with the **same** client id (fresh QA project); issue for C; redeem G0; app restart; repeat; new C1 at P1 as a positive control | issue exit 1 after one read, no grant change; G0 → `409 PROVIDER_NOT_READY` (V; R3.10 text, `cause: platform_changed`), no write on P1; C stays pinned after restart; C1 issues and binds |
| 29 (k2) | shared platform missing at issue | issue exit 1 |
| 29 (k3) | re-created with another client id | issue exit 1 (does not isolate the client comparator; unit test does) |
| 38 (h1) | populated `011→012` route: a new host route, separate from AC-M1-23/30, run in both full rounds. Seed it on a pinned build with `011` and no `012`, through the public API, CLI and gate only, **before** the upgrade: (A) a registered Canvas connection with an approved deployment and its service key, plus an issued `add_deployment` grant; (B) a registered Blackboard connection; (C) a pending Blackboard connection C0-B with an issued `initial` grant, redeemed once under `fail_before` on S1 (`502`; the grant stays `issued`; the local reservation stays; **no** remote deployment exists, because S1 never reached the LTI service); (D) a pending Canvas connection C0-C with an issued `initial` grant, redeemed once under `drop_after` on S3 (`502`; an active owned platform without approval; the grant stays `issued`). Then stop, back up, upgrade. | see (h2)–(h5) |
| 38 (h2) | old pending rows after the upgrade: C0-B and C0-C with their saved valid codes; an unknown code; a new `initial` issue | saved codes → check 4a `409 PROVIDER_NOT_READY` (R3.10 text, `cause: no_snapshot`), zero requests, no attempt; unknown code → `403 not_found`; issue → exit 1, grant list unchanged |
| 38 (h3) | old registered rows after the upgrade: same-value repeats (A, B); (A) with its redeemed `initial` code and a new `deploymentId` | repeats `200` from the persisted platform; the redeemed code → `403 GRANT_INVALID` (`redeemed`), zero requests, no attempt, approval and key unchanged |
| 38 (h4) | old registered Canvas (A): redeem the seeded `add_deployment` grant for a new deployment; then issue and redeem one more | both `200` from the committed platform, no provider read; the first approved deployment and its old service key keep working |
| 38 (h5) | recovery order R3.1 steps 1–5 for C0-B and for C0-C. Negative control first: C1 redeems **before** step 3 | Negative control: Blackboard `409 DEPLOYMENT_IN_USE` at check 7 (zero requests; C0-B is still `pending` and holds the reservation); Canvas `409 PLATFORM_IN_USE` at S2 (S1 `409`, then the active orphan has C0-C's ref). Then, per R3.1. **C0-B (reservation only):** suspend line `absent`; release (after the lease) line `absent`, exit 0, and C0-B's reservation is gone; C1 redemption `200` with a fresh deployment: S1 `201` inactive at generation 0, then S3 → generation 1. **C0-C (active orphan):** suspend line `fenced`; release line `deleted`; C1 redemption `200` with a new platform. (A) and (B) bindings, approvals and keys unchanged throughout. Read-only inspection of stopped database copies is supplemental. |
| 38 (i1) | fresh `012`: new Canvas cloud connection, redeem | `200`; zero LTI requests before phase 1; the platform `url` is the profile issuer |
| 38 (i2) | fresh `012`: new `canvas-self-hosted` connection, redeem | `200`; the platform `url` is the canonical site origin |
| 38 (i3) | fresh `012`: new Blackboard connection, redeem | `200` with exactly one V before S1 |
| 38 (i4) | fresh `012`: app restart between create and issue, and between issue and redemption | the same results as (i1)–(i3); zero provider reads before phase 1 after each restart (the snapshot is not read again) |
| 38 (i5) | fresh `012`: Moodle create | no gate request (no provider call), unchanged DTO |

**Supplemental, unit or integration only (never a `SIM` row):**
- adapter missing;
- partial snapshot;
- snapshot capture from one response (later reads never overwrite);
- each single-field V and issue comparator (id, client, issuer, inactive, missing row, wrong sharing; Canvas cloud and self-hosted issuer);
- create-body snapshot keys never stored;
- Canvas S1 sends `url: target_issuer`, and both `400` codes map to `409`;
- `grant_attempt_started` after commit;
- atomic rollback injection;
- the resolver and phase 1 for all three endpoints with an LTI client that throws on any call;
- the post-V decision order;
- a second start applies no migration twice and changes no snapshot (stopped-copy storage evidence);
- check 4 `409 CONNECTION_NOT_PENDING` on a registered connection with an injected unredeemed `initial` grant.

Fixed profile issuer changes cannot be reached through the simulator or admin API. Do not rewrite responses or change production profiles to reach them.

Gate schedules:
- Existing `POST` and `PATCH` rules do not match V.
- An all-`/api/*` `fail_before` hits V first.
- Issue-time provider GETs belong to preparation.
- Each held call keeps its 5 s. A schedule that misses its window (the 5 s of a held call, or the 60 s lease of a dead handler) is `BLOCKED`. `BLOCKED` fails the full gate. It is never a pass or a skip, and never a reason to change production timeouts.

Accounting: QA owns common and Blackboard ids, the `011` route and the case accounting. QA-E2E owns the Canvas variants. The Author owns product and colocated unit tests.

## R3.9. Amendments after acceptance (not applied) and ownership

| File | Change |
| --- | --- |
| App contract §4.2 | snapshot capture (R3.1) |
| App contract §4.4 | R3.2 precedence; Canvas S1 `url`; the readiness row becomes check 4a and V |
| App contract §4.7.1 | Terms (target source); check 4a; check 5 Blackboard source; V row and post-V decision; budget; outcome rows R3.6; the V limit |
| App contract §4.7.2 | unchanged order; note "no provider read" |
| App contract §4.8 | R3.4 |
| App contract §12 | `grant_attempt_started` (R3.7) |
| `tool-configuration` rule | R3.5 |
| Data model §4.2 | three columns, write rules, migration `012` |
| ADR-011 §14 | migration list adds `012` |
| M1 | R3.8 ids (37 v1–v12, w, x1–x2, y1–y2, z1–z5, aa; 29 k1–k3; 38 h1–h5, i1–i5) and the unit list |
| M3 | the `011` route in both rounds |
| LTI contract §3.9 / §9.4 | one sentence: a platform id is never reused; a re-created platform has a new id (R3.3 premise). |
| App contract §4.2, §4.4, §4.7.1, §12 | the neutral `PROVIDER_NOT_READY` title and action (R3.10); the `provider_not_ready` log event |
| M2 error-text table | row `409 PROVIDER_NOT_READY` → the R3.10 neutral text (was "the Blackboard not-ready text"). The Blackboard **card** not-ready text (AC-M2-02, from `lms-providers` `ready`) does not change. |

Implementation files for R3.10 (for the Lead's assignment): `services/cogniate-app/src/app/api-errors.ts` (server title and action; engine Author) and `apps/portal/src/connect/provider-errors.tsx` (portal map `PROVIDER_NOT_READY`; portal owner Author-2).

Ownership after acceptance: the Lead assigns. `services/cogniate-app/src/providers/canvas.ts` (S1 `url`) stays with its current Canvas owner until the Lead makes an explicit transfer. This proposal transfers nothing.

## R3.10. One neutral `409 PROVIDER_NOT_READY` text (A-D-06)

After D, one public code has several causes:
- the Blackboard shared platform is not active (wait, then retry the same code);
- the connection has no snapshot, or the shared platform or the Canvas profile changed (make a new connection by the R3.1 order);
- the Canvas profile is missing (wait for the operator, then retry).

The code stays the same, and **no public reason field** is added. The text is neutral for every LMS and every cause, and it names both recoveries:

| Field | Text |
| --- | --- |
| Title | `This LMS setup is not ready in Cogniate.` |
| Action | `Ask your Cogniate operator to check the LMS setup for this connection. The operator tells you to try again later, or to make a new connection.` |

Operator diagnosis is internal:
- the app logs `provider_not_ready {connection_id, profile, cause}` (warn) for check 4a, V row 5 and the readiness S1 answers;
- `cause`, exactly: check 4a → `no_snapshot`; V row 5 with a missing profile row → `profile_missing`; V row 5 with `sharedPlatform` `NULL` or `active` false → `platform_inactive`; V row 5 with another `id` or `clientId`, or `sharing` not `shared` → `platform_changed`; V row 5 with another row `issuer` → `issuer_changed`; Blackboard S1 `404 UNREGISTERED_PLATFORM` → `platform_changed`; Canvas S1 `400 UNKNOWN_PROFILE` → `profile_missing`; Canvas S1 `400 PLATFORM_URL_NOT_IN_PROFILE` → `issuer_changed`; the create-time Blackboard refusal → `platform_inactive`. If several V conditions fail, the first in this list is logged;
- `app:grant issue` prints its own cause line (R3.4).

Cases 37 (w), (y2), (aa), 29 (k1) and 38 (h2) assert the text and the logged `cause`. The create-time refusal (`lms: blackboard` without an active shared platform, app contract §4.2) uses the same neutral text and logs `cause: platform_inactive`.

---

# B-M1-03 proposal D: acceptance and application record

Task `task_cf7e2e942594`, dispatch `ctx_50ca8c5ba951` (Lead gate message `msg_2a5205155c10`).

**Accepted design:** proposal D **revision 3** at `78bc34ac422e0bcac324fa10e69ec9f82a17a3b8` (the section above). Approvals for that exact text:

| Report | Verdict |
| --- | --- |
| Reviewer-A, Round 3, `docs/reviews/M1/reviewer-a-target-snapshot.md` | APPROVE (one optional NIT, A-D-09) |
| Reviewer-B, Round 3, `docs/reviews/M1/reviewer-b-target-snapshot.md` | APPROVE |
| Codex QA, Round 3, `docs/reviews/M1/qa-target-snapshot.md` | PASS for design testability |

All three Round 3 reports were committed together at `b6e8f739e6de752cb287929c9836734d2494e444`. The proposal text above (revision 3, revision 2 and D1–D8) stays unchanged as the reviewed record. This record and the normative documents below apply it. The original product finding B-M1-03 stays open until the implementation is verified independently.

## Amendment map (R3.9 applied)

| Revision 3 section | Normative document and section |
| --- | --- |
| R3.1 fields and write rules | app contract §4.2 (capture at create), §4.7.3 (fields, rules, completeness); data model §4.3 (migration `012`); ADR-011 §14 (migration list) |
| R3.1 old-`011` lifecycle and recovery order | app contract §4.7.3 (lifecycle table; recovery steps 1–5 with the `absent` and owned-record branches) |
| R3.2 local precedence; target built inside phase 1 | app contract §4.4 (order of steps 1–5; Blackboard `clientId` source order; finalized repeat before phase 1), §4.7.1 (Terms "Target" and "Provider snapshot"; check 4a; check 5 source; target construction), §4.7.2 (`POST …/deployments`: no provider read, no V) |
| R3.3 V, post-V decision, readiness answers, V limit, budget | app contract §4.7.1 (S0 before V; row V; post-V decision table with audit reasons; readiness answers of S1; V limit; six-call budget; LTI failure exception) |
| R3.3 platform id premise | LTI contract §9.4 (a platform id is never reused) |
| R3.4 issue | app contract §4.8 (Issue checks; Issue output: an `initial` issue reads providers once; `add_deployment` makes no LTI call) |
| R3.5 configuration rows | app contract §4.5 (Blackboard `client_id` row source; `409` instead of a null row) |
| R3.6 outcomes | app contract §4.7.1 outcome table (seven new rows) |
| R3.7 event contract | app contract §4.7.1 (log after commit), §12 (`grant_attempt_started`) |
| R3.7 bounded test use | M1 AC-M1-37, B-M1-03 evidence rules (1)–(5) |
| R3.8 ids and supplemental list | M1 AC-M1-37 (v1)–(v12), (w), (x1)–(x2), (y1)–(y2), (z1)–(z5), (aa); AC-M1-29 (k1)–(k3); AC-M1-38 (h1)–(h5), (i1)–(i5); the supplemental unit list; M1 design note and scope |
| R3.8 both full runs; separate route | M3 AC-M3-01 and run order step 2 |
| R3.10 neutral text and cause log | app contract §4.2, §4.4, §4.7.1 row 5, §4.7.3 (text and cause table), §12 (`provider_not_ready`); M2 error-text table (the Blackboard card text does not change) |

Every existing acceptance criterion and race variant stays as it was. No accepted outcome changed.

## Final nonblocking text dispositions (Reviewer-A A-D-09)

| Item | Disposition |
| --- | --- |
| 1. Implementation paths; create-time log | Done. `services/cogniate-app/src/app/connections.ts` is in the implementation list below; its hard-coded old create-time action text is replaced by the neutral text. The create-time `provider_not_ready` line has `connection_id: null`, because no connection exists yet (app contract §4.2, §4.7.3, §12). |
| 2. Cause precedence | Done. When `sharedPlatform` exists and its `id` or `clientId` differs, the cause is `platform_changed`, before `platform_inactive`. Exact order in app contract §4.7.3 (profile missing; wrong sharing; no shared platform; another id or client; another issuer; inactive). Operator diagnosis only; no public field. |
| 3. Deleted or re-created after V | Done. The app contract §4.7.1 outcome row now names the approved cancellation-first alternative (post-V rows 1–3), as the Canvas row does. |

These are wording changes. They change no approved outcome and add no scope.

## Implementation files and interfaces (for the Lead's assignments; no ownership transfer)

| Owner (current) | Files | Required change |
| --- | --- | --- |
| Backend Author (shared engine, Blackboard) | `services/cogniate-app/src/domain/migrations/012_connection_provider_snapshot.sql` (new), `services/cogniate-app/src/domain/connections.ts` | three nullable columns and their read model (data model §4.3) |
| | `services/cogniate-app/src/app/connections.ts` | create: write the snapshot from the one providers answer; neutral create-time text; `provider_not_ready {connection_id: null}`. `PUT …/platform`: no providers read before phase 1; Blackboard `clientId` local source order. `tool-configuration`: local `client_id` source, `409` instead of a null row |
| | `services/cogniate-app/src/app/binding-targets.ts`, `services/cogniate-app/src/app/redemption.ts` | target built and saved inside phase 1 from local rows (all three endpoints); check 4a; `grant_attempt_started` after the commit; V and the post-V decision; readiness answers of S1; `provider_not_ready` causes |
| | `services/cogniate-app/src/app/operator.ts` | `app:grant issue` rules of §4.8 |
| | `services/cogniate-app/src/app/api-errors.ts` | neutral `PROVIDER_NOT_READY` title and action |
| | colocated unit tests | the M1 supplemental list |
| Canvas Author-2 | `services/cogniate-app/src/providers/canvas.ts` and its test | interface: the `exclusive_platform` create request adds `url` = the issuer saved in the target |
| | `apps/portal/src/connect/provider-errors.tsx` and its test | `PROVIDER_NOT_READY` → the neutral text; the Blackboard card text stays |
| LTI service | none | the never-reused id premise already holds; it is now contract text |
| Codex QA / QA-E2E | `tests/**` (as assigned) | common and Blackboard ids, the `011` route and accounting / the Canvas variants |

## Checks

`git diff --check`, the Markdown link and anchor check, and the table column check are clean for every changed file. The id inventory is exhaustive and the same in M1, M3 and this record: AC-M1-37 23 ids in 21 bullets ((z1)–(z3) share one bullet), AC-M1-29 3 ids, AC-M1-38 10 ids.

No unresolved contradiction was found. Two places were checked and need no change, so they stay outside this task's files:
- flows §6h-2 shows the unchanged create-time `PROVIDER_NOT_READY`;
- security §12 states no rule that the design changes.
