Verdict: PASS
Round: 4

# LA-E7-05 Simulator scenario options and the platform side of Dynamic Registration — QA verification (Round 4, host-only)

Tester: QA-E2E (Orca tasks `task_5a1930354a1f`, `task_d53f1b5cb520`, `task_46dc59b8a82f`, and `task_3ce1cd75a3b5`; dispatches `ctx_27c70bf6d702`, `ctx_c2fa74121b7b`, `ctx_7c356cfea1ef`, and `ctx_b5361e5c44f7`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E7-05.md`. Design: `docs/architecture/ltiaas/adr/LA-ADR-02-generic-lti-channel.md` D5 and D7, `docs/architecture/ltiaas/adr/LA-ADR-05-lti-advantage-completeness.md` D1–D9, `docs/architecture/ltiaas/adr/LA-ADR-08-onboarding-and-connection-health.md` D1, and `tests/ltiaas/TEST-STRATEGY.md` §2.8.

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
| AC-LA-E7-05-05 | pending: Docker window | `tests/sim/generic/protocol.test.mjs` (`LA-E7-05 Deep Linking options ... and NRPS members option`) | `node --test tests/sim/generic/protocol.test.mjs` | **Host-only PASS**: With `members` set on a scenario, the memberships endpoint returns `200 application/vnd.ims.lti-nrps.v2.membershipcontainer+json` with that exact membership list, and defaults to `members: []` when omitted (`sim-e7-05-self-tests.log`). Live K1-SIM stack run waits for the Docker window. |
| AC-LA-E7-05-06 | pending: Docker window | `tests/sim/generic/protocol.test.mjs` (`LA-E7-05 platform storage`) | `node --test tests/sim/generic/protocol.test.mjs` | **Host-only PASS**: With `storageTarget` set on a scenario, `login` sends `lti_storage_target`, `/__frame` includes the auth host's hidden storage frame (`/__storage`), and `lti.put_data` / `lti.get_data` answer only for the matching sender `origin` and echo the exact `message_id` (isolating data across origins and rejecting missing/non-HTTPS origins or missing `message_id`) (`sim-e7-05-self-tests.log`). Live K1-SIM stack run waits for the Docker window. |
| AC-LA-E7-05-07 | pending: Docker window | `tests/sim/generic/protocol.test.mjs` (`LA-E7-05 ... Should/Could options` and `Canvas DR`) | `node --test tests/sim/generic/protocol.test.mjs` | **Host-only PASS**: All Should and Could options are implemented and verified host-only: second platform signing key per provider (`secondKey` / `jwksKeys`), institution administrator role (`institutionAdmin`), on-demand `invalid_client` token answer (`tokenAnswers: ['invalid_client']`), extra ID token `aud` value (`extraAud`), `cogniate_placement=ungraded` target (`ungradedPlacement`), and Canvas DR with an opaque token on `canvas-sim-cloud` and `canvas-sim-self` (`sim-e7-05-self-tests.log`). Live K1-SIM stack run waits for the Docker window. |

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

## Round 3 (Reviewer-B2 Round-1 and Reviewer-A `A-LA-E7-02-04` Fixes, Host-Only)

| Item | Value |
| --- | --- |
| Integration SHA | `7623e61` (`LA-E7-02` Round 3 + `LA-E7-05` Round 2) |
| Worktree | `la-qa` (`nguyenthanhquang152/la-qa`) |
| Lane and slot | Host-only (Docker ban active; K1-SIM stack runs stay `pending: Docker window`) |
| Reviewer findings addressed | `A-LA-E7-02-04` (BLOCKER, moved from `LA-E7-02` to `LA-E7-05`), `B-LA-E7-05-01` (MAJOR), `B-LA-E7-05-02` (MINOR), `B-LA-E7-05-03` (MINOR), `B-LA-E7-05-04` (MINOR), `B-LA-E7-05-05` (NIT), `B-LA-E7-05-06` (NIT) |
| Files updated | `tests/sim/core/runtime.mjs`, `tests/sim/core/provider.mjs`, `tests/sim/core/dr.mjs`, `tests/sim/core/storage.mjs`, `tests/sim/core/loading.test.mjs`, `tests/sim/generic/protocol.test.mjs`, `tests/sim/README.md`, `docs/reviews/LA-E7-05/qa.md` |
| Artifacts | `~/cogniate-qa-runs/LA/LA-E7-05/r3/sim-all-self-tests.log` (58/58 tests pass in 1.80 s) |

### Reviewer-A and Reviewer-B2 Finding Dispositions

| Finding | Severity | Fix and Verification |
| --- | --- | --- |
| `A-LA-E7-02-04` | BLOCKER | Restored byte-equal default `/__sim/records` keys (`jwks`, `auth`, `token`, `nrps`, `ags`, `score`, `deep-link`, `rejected`) in `tests/sim/core/provider.mjs` when no `LA-E7-05` option is set (`auth.kid` is added only when `secondKey`, `jwksKeys: 'second-only'`, or `fault: 'unknown-key'` is set; `token.status` and `nrps.status` are added only when `tokenAnswers` / `nrpsAnswers` supply an answer; `nrps.memberCount` is added only when `members` is set; `deep-link.itemCount` and `cancelled` are added only when a Deep Linking option or non-single item count is used). Also stopped adding auto-generated `registrationToken` secrets to `/__sim/secrets` unless `scenario.dr` is set or a registration request runs. Pinned all 7 default record key lists in `tests/sim/generic/protocol.test.mjs`. |
| `B-LA-E7-05-01` | MAJOR | Defined `SCENARIO_OPTIONS` (41 canonical options), `DR_OPTIONS` (14 canonical `scenario.dr` options), and `LEGACY_SCENARIO_ALIASES` (the 7 legacy aliases used by `tests/ltiaas/tasks-lti/LA-E5-14/throttling.k1sim.test.ts`: `tokenAnswer`, `tokenStatus`, `nrpsAnswer`, `membershipsAnswers`, `membershipsAnswer`, `nrpsStatus`, `membershipsStatus`) in `tests/sim/core/runtime.mjs`. Removed all other aliases, added fail-closed validation with closest-option suggestions (`Unknown scenario option "<key>" (did you mean "<closest>"?)`), documented every option, `scenario()` return shape, query parameter, and reserved Bearer value in `tests/sim/README.md`, and added a table-parity test in `tests/sim/core/loading.test.mjs`. |
| `B-LA-E7-05-02` | MINOR | Scoped `secondKey` / `jwksKeys` and `storageTarget` to the active scenario (`runtime.activeByProvider.get(config.id)`, updated when a scenario is posted or authenticated, or selected explicitly via `?scenario=<id>` / `login_hint`), so an earlier scenario with `secondKey` or `storageTarget` never pollutes a later scenario on the same provider. Verified Probe P2 in `tests/sim/generic/protocol.test.mjs`. |
| `B-LA-E7-05-03` | MINOR | Replaced `path.endsWith(...)` on the JWKS, auth, and token routes with `matchesEndpointPath(pattern, path)` in `tests/sim/core/provider.mjs`, which matches only the exact configured path (or RegExp) or the exact issuer-path prefix of a scenario on that provider. Verified Probe P3 (`/any/prefix/lti/jwks.json`, `/any/prefix/lti/oidc/auth`, `/x/lti/oauth2/token` return `null`) in `tests/sim/generic/protocol.test.mjs`. |
| `B-LA-E7-05-04` | MINOR | Consolidated queued answer parsing into `answerOf` and `nextAnswer` in `tests/sim/core/runtime.mjs` (used across `token`, `nrps`, and `score` with `persistent: true` support on all three), and extracted Dynamic Registration into `tests/sim/core/dr.mjs` and Platform Storage into `tests/sim/core/storage.mjs`. |
| `B-LA-E7-05-05` | NIT | Removed the in-memory `localStore` fallback from `storageScript()` in `tests/sim/core/storage.mjs` so `/__storage` is the single store and every storage operation is recorded in `/__sim/records`. |
| `B-LA-E7-05-06` | NIT | Replaced bare error labels in `tests/sim/core/provider.mjs` and `tests/sim/core/dr.mjs` with explicit expectations (`'DL item type must be ltiResourceLink'`, `'DL item lineItem.scoreMaximum must be 100'`, `'DR application_type must be "web"'`, etc.). |

Note: Round-1 alias names (`nrpsMembers`, `platformStorage`, `useSecondKey`, `adminRole`, `tokenError`) were removed in Round 3 (`B-LA-E7-05-01`). Use the canonical names in the `tests/sim/README.md` tables (updated in the AC table above).

## Round 4 (Reviewer-B2 Round-2 NIT `B-LA-E7-05-07`, Host-Only)

| Finding | Severity | Fix and Verification |
| --- | --- | --- |
| `B-LA-E7-05-07` | NIT | Added the explicit definition of "active scenario" in `tests/sim/README.md` (`The active scenario of a provider is the scenario of its latest POST or latest auth request; ?scenario=<id> overrides it.`), replaced the removed round-1 alias names (`nrpsMembers`, `platformStorage`, `useSecondKey`, `adminRole`, `tokenError`) in the `AC-LA-E7-05-05`..`AC-LA-E7-05-07` rows above with the canonical option names, and added the note under Round 3. Verified all 58 simulator self-tests pass in 1.67 s (`~/cogniate-qa-runs/LA/LA-E7-05/r4/sim-all-self-tests.log`). |
