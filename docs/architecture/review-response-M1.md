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
