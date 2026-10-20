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

**Status: PROPOSAL, NOT ACCEPTED.** It adds three columns, one read step and one S1 field. It needs independent review before the Author implements it. Until then the accepted contract is unchanged, except for the one clarification in "Clarification applied now" below.

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
