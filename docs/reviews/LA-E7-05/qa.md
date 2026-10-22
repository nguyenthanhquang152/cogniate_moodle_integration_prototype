Verdict: PASS
Round: 2

# LA-E7-05 Simulator scenario options and the platform side of Dynamic Registration — QA verification (Round 2, host-only)

Tester: QA-E2E (Orca tasks `task_5a1930354a1f` and `task_d53f1b5cb520`, dispatches `ctx_27c70bf6d702` and `ctx_c2fa74121b7b`), 2026-10-22. Spec: `docs/architecture/ltiaas/tasks/LA-E7-05.md`. Design: `docs/architecture/ltiaas/adr/LA-ADR-02-generic-lti-channel.md` D5 and D7, `docs/architecture/ltiaas/adr/LA-ADR-05-lti-advantage-completeness.md` D1–D9, `docs/architecture/ltiaas/adr/LA-ADR-08-onboarding-and-connection-health.md` D1, and `tests/ltiaas/TEST-STRATEGY.md` §2.8.

Independence: QA-E2E built the simulator scenario options, Dynamic Registration platform endpoints, platform storage frame, and host-only self-tests from `LA-E7-05.md`, `LA-ADR-02`, `LA-ADR-05`, `LA-ADR-08`, `TEST-STRATEGY.md` §2.8, and `tests/sim/**`. QA-E2E read no product source files (`services/**`, `apps/**`, `packages/**`), Author notes, or Author branches.

## Round 1 (Host-Only)

| Item | Value |
| --- | --- |
| Integration SHA | `f83a00e` (`LA-E7-02` simulator data-driven loading, `hosts.json`, generic and Brightspace providers) |
| Worktree | `la-qa` (`nguyenthanhquang152/la-qa`, base `46fe5f1`) |
| Lane and slot | Host-only (Docker ban active; K1-SIM stack runs wait for the LA Docker window) |
| Files delivered | `tests/sim/core/runtime.mjs`, `tests/sim/core/provider.mjs`, `tests/sim/core/loading.test.mjs`, `tests/sim/generic/index.mjs`, `tests/sim/generic/protocol.test.mjs`, `tests/sim/brightspace/index.mjs`, `tests/sim/brightspace/protocol.test.mjs`, `tests/sim/canvas/index.mjs`, `tests/sim/README.md`, `docs/reviews/LA-E7-05/qa.md` (plus `LA-E7-02` Round-2 fixes in `docs/reviews/LA-E7-02/qa.md`) |
| Artifacts | `~/cogniate-qa-runs/LA/LA-E7-05/r1/` (umask 077): `sim-baseline-self-tests.log`, `sim-e7-05-self-tests.log`, `sim-all-self-tests.log` |

## Acceptance Criteria

All seven `LA-E7-05` acceptance criteria (`AC-LA-E7-05-01`..`AC-LA-E7-05-07`) have level `K1-SIM` and stay `pending: Docker window` until the Lead grants a Docker window. Their host-only simulator proofs are complete and recorded below.

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E7-05-01 | pending: Docker window | `tests/sim/core/loading.test.mjs`, `tests/sim/blackboard/protocol.test.mjs`, `tests/sim/canvas/protocol.test.mjs` | `node --test tests/sim/core/*.test.mjs tests/sim/canvas/protocol.test.mjs tests/sim/blackboard/protocol.test.mjs` | **Host-only PASS (10/10 tests, 880 ms)**: With no new option set on a scenario, every existing simulator self-test passes unchanged (`sim-baseline-self-tests.log`). Live M1 and M2 stack regression waits for the Docker window. |
| AC-LA-E7-05-02 | pending: Docker window | `tests/sim/generic/protocol.test.mjs`, `tests/sim/brightspace/protocol.test.mjs` (`LA-E7-05 Dynamic Registration`) | `node --test tests/sim/generic/protocol.test.mjs tests/sim/brightspace/protocol.test.mjs` | **Host-only PASS**: `generic-sim`, `moodle-sim`, and `brightspace-sim` serve their OpenID configuration (`/.well-known/openid-configuration` and provider paths) and accept `POST` tool registrations across all item-1 options (issuer with path, token endpoint on a second `.sim.test` host `token.generic.sim.test` / `auth.brightspace.sim.test`, `authorization_server` off the issuer origin, and both opaque Bearer token and Moodle-style `scope: "reg"` / `"reg-update"` JWTs), recording `scopes`, `messages`, and `redirectUris` in `/__sim/records` (`sim-e7-05-self-tests.log`). Live K1-SIM stack run waits for the Docker window. |
| AC-LA-E7-05-03 | pending: Docker window | `tests/sim/generic/protocol.test.mjs` (`LA-E7-05 throttling options`) | `node --test tests/sim/generic/protocol.test.mjs` | **Host-only PASS**: Scenarios return `429` with `Retry-After: 30` on score, `429` without a header on score, `429` on token (`tokenAnswers`), `429` on memberships (`nrpsAnswers`), and `403` with `Rate Limit Exceeded` in the body on score, and `/__sim/records` records each request ISO timestamp (`ts`), `status`, and `retryAfter` (`sim-e7-05-self-tests.log`). Live K1-SIM stack run waits for the Docker window. |
| AC-LA-E7-05-04 | pending: Docker window | `tests/sim/generic/protocol.test.mjs` (`LA-E7-05 Deep Linking options`) | `node --test tests/sim/generic/protocol.test.mjs` | **Host-only PASS**: Scenarios set `accept_multiple`, `accept_lineitem`, and `accept_media_types` in `deep_linking_settings`, and the return endpoint accepts both an empty `content_items: []` Cancel response and a multi-item response (`items.length === 2`, omitting `lineItem` when `accept_lineitem: false`) and records `items`, `itemCount`, and `cancelled` in `/__sim/records` (`sim-e7-05-self-tests.log`). Live K1-SIM stack run waits for the Docker window. |
| AC-LA-E7-05-05 | pending: Docker window | `tests/sim/generic/protocol.test.mjs` (`LA-E7-05 Deep Linking options ... and NRPS members option`) | `node --test tests/sim/generic/protocol.test.mjs` | **Host-only PASS**: With `members` (or `nrpsMembers`) set on a scenario, the memberships endpoint returns `200 application/vnd.ims.lti-nrps.v2.membershipcontainer+json` with that exact membership list, and defaults to `members: []` when omitted (`sim-e7-05-self-tests.log`). Live K1-SIM stack run waits for the Docker window. |
| AC-LA-E7-05-06 | pending: Docker window | `tests/sim/generic/protocol.test.mjs` (`LA-E7-05 platform storage`) | `node --test tests/sim/generic/protocol.test.mjs` | **Host-only PASS**: With `storageTarget` (or `platformStorage: true`) set on a scenario, `login` sends `lti_storage_target`, `/__frame` includes the auth host's hidden storage frame (`/__storage`), and `lti.put_data` / `lti.get_data` answer only for the matching sender `origin` and echo the exact `message_id` (isolating data across origins and rejecting missing/non-HTTPS origins or missing `message_id`) (`sim-e7-05-self-tests.log`). Live K1-SIM stack run waits for the Docker window. |
| AC-LA-E7-05-07 | pending: Docker window | `tests/sim/generic/protocol.test.mjs` (`LA-E7-05 ... Should/Could options` and `Canvas DR`) | `node --test tests/sim/generic/protocol.test.mjs` | **Host-only PASS**: All Should and Could options are implemented and verified host-only: second platform signing key per provider (`secondKey` / `useSecondKey` / `jwksKeys`), institution administrator role (`institutionAdmin` / `adminRole`), on-demand `invalid_client` token answer (`tokenError: 'invalid_client'`), extra ID token `aud` value (`extraAud`), `cogniate_placement=ungraded` target (`ungradedPlacement`), and Canvas DR with an opaque token on `canvas-sim-cloud` and `canvas-sim-self` (`sim-e7-05-self-tests.log`). Live K1-SIM stack run waits for the Docker window. |

## Host-Only Suite Timings

| Suite | Command | Result | Measured time |
| --- | --- | --- | --- |
| Baseline simulator self-tests (M1/M2 + loader/manifest fail-closed checks) | `node --test tests/sim/core/*.test.mjs tests/sim/canvas/protocol.test.mjs tests/sim/blackboard/protocol.test.mjs` | 10 passed, 0 failed | 0.88 s |
| `LA-E7-02` + `LA-E7-05` provider and scenario-option self-tests (`generic`, `moodle-sim`, `brightspace`, `canvas` DR) | `node --test tests/sim/generic/protocol.test.mjs tests/sim/brightspace/protocol.test.mjs` | 13 passed, 0 failed | 0.99 s |
| Combined simulator self-tests (all 5 test files) | `node --test tests/sim/core/*.test.mjs tests/sim/blackboard/protocol.test.mjs tests/sim/canvas/protocol.test.mjs tests/sim/generic/protocol.test.mjs tests/sim/brightspace/protocol.test.mjs` | 23 passed, 0 failed | 1.32 s |

## Round 2 (Reviewer-A2 Round-1 Fixes, Host-Only)

| Item | Value |
| --- | --- |
| Integration SHA | `0e65ab1` (`LA-E7-05` Round 1) |
| Worktree | `la-qa` (`nguyenthanhquang152/la-qa`) |
| Lane and slot | Host-only (Docker ban active; K1-SIM stack runs stay `pending: Docker window`) |
| Reviewer findings addressed | `A-LA-E7-05-01` (BLOCKER), `A-LA-E7-05-02` (MINOR) from `docs/reviews/LA-E7-05/reviewer-a.md` |
| Files updated | `tests/sim/core/provider.mjs`, `tests/sim/generic/protocol.test.mjs`, `tests/sim/README.md`, `docs/reviews/LA-E7-05/qa.md` |
| Artifacts | `~/cogniate-qa-runs/LA/LA-E7-05/r2/sim-all-self-tests.log` (56/56 tests pass in 3.59 s) |

### Reviewer-A2 Finding Dispositions

| Finding | Severity | Fix and Verification |
| --- | --- | --- |
| `A-LA-E7-05-01` | BLOCKER | In `tests/sim/core/provider.mjs` (`storageMessage`), `senderOrigin` now takes the explicit `x-storage-origin` header set by the storage frame's `postMessage` listener (`event.origin`) before falling back to `request.headers.origin`, and refuses `senderOrigin === 'https://' + request.host` so the browser's same-origin `Origin` header on the frame's own `POST /__storage` can never partition storage by or target the auth host. In `tests/sim/generic/protocol.test.mjs`, the platform-storage test now extracts and runs the `<script>` returned by `GET /__storage` inside a browser-like `vm` context whose `fetch('/__storage', { method: 'POST' })` injects `Origin: https://generic.sim.test` (the frame's own auth-host origin), verifying that `lti.put_data` and `lti.get_data` partition by `event.origin` (`https://lti.cogniate.test` vs `https://other-tool.test`) and reply via `event.source.postMessage(response, event.origin)`. |
| `A-LA-E7-05-02` | MINOR | Restored both M1/M2 defaults in `tests/sim/core/provider.mjs`: (1) `deepLinkReturn` now refuses an empty `content_items: []` with `'DL item count'` unless the scenario opts in with `dlAllowCancel: true` (or `allowCancel: true` / `allowEmptyDl: true`), and (2) `scenario.claims[DL + 'deep_linking_settings']` replaces the computed `deep_linking_settings` claim object completely (while `scenario.dlSettings` / `scenario.deepLinkingSettings` merges into the default object). Verified both rules in `tests/sim/generic/protocol.test.mjs`. |
