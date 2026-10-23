Verdict: APPROVE
Round: 2

## Round 1

Reviewer-B: Codex GPT-6-Astra xhigh. Lens: can a human team own it? Reviewed `3b2cdeb`, `064f4fa`, `32e27bd`, `63a51c1`, `1537882`, `da9a663` and `e0ffe74` at merge `0e6bace312c766509119eeb77f48c4e594a90c34`. Checked LA-E2-04, LA-ADR-02 D2a/D5/D6, app API delta §3.4/§7, BD-A1-79/-87/-90..92, ownership matrix §5 and plan §6.1. Blind review; the other reviewer's file was not read.

**Counts:** 1 BLOCKER, 1 MAJOR, 1 MINOR, 0 NIT.

### B-LA-E2-04-01 — MAJOR — The staged wizard cannot send the two required IDs

- **Files:** `services/cogniate-app/src/kernel/authority/operator-grant.ts:36`; `packages/channels/lti-generic/manifest.ts:45`; `apps/portal/src/channels/ManifestWizard.tsx:34`.
- **Problem:** the new staged path requires `{ clientId, deploymentId, grantCode }`, but the generic manifest marks both ID fields `method: 'manual'`. The staged connection still has method `dynamic`, so the shared wizard filters out both IDs. The fallback approval-code input and Save button appear, but the tenant cannot complete the request. App API delta §3.4 requires both IDs to be pre-filled from the staged platform.
- **Evidence:** a private test rendered the real generic wizard with a pending dynamic connection, stored authority `operatorGrant` and platform IDs `client-1` / `dep-1`. Its only input was `grantCode`; entering the code and pressing Save sent only that property. The assertion requiring all three fields failed. `parseStagedBody` reports both missing IDs as `422 INVALID_PLATFORM_VALUES`, yet the form has no inputs to correct them. The new API chain test supplies those IDs itself and therefore misses the user-flow failure.
- **Suggested fix:** make the ID fields available for the staged dynamic method, through the manifest owner or a lane-P RQ as needed, and reuse the existing platform pre-fill. Keep the long admin-value fields manual-only and keep the short staged API body strict. Add a real wizard submission test for the staged DTO, then include this path in the K1-SIM registration check. No channel-id branch is needed in core.

### B-LA-E2-04-02 — BLOCKER — A different bound value is accepted as a successful finalized repeat

- **Files:** `services/cogniate-app/src/app/redemption.ts:76`, `services/cogniate-app/src/app/redemption.ts:159`.
- **Problem:** the new bound-value comparison runs only in phase 1. The finalized-repeat fast path still compares only the client/deployment IDs and returns first. A caller can submit a different valid admin endpoint and receive `200` even though that value was neither approved nor saved. This is a wrong success result, not evidence that the changed endpoint is activated. App API delta §3.4 limits a finalized repeat to the same IDs **and bound values** and requires differing fields in `GRANT_MISMATCH`.
- **Evidence:** in the private clone, issued and redeemed a manual grant with JWKS `https://lms.school.edu/jwks`, then repeated the PUT with the same IDs/code and JWKS `https://lms.school.edu/different-jwks`. The response was `200`, there was no LTI call, and the stored platform still used the first JWKS URL. The test expecting `422 GRANT_MISMATCH` with `fields: ['jwksUrl']` failed. The checked-in repeat test covers only an identical body.
- **Suggested fix:** compare the submitted admin values with the committed approval's saved bound values before accepting this fast path; use the same canonical-origin/exact-URL comparator and return the differing field names. Preserve the no-LTI-call behavior for an identical repeat and the existing fixed-profile behavior. Test changed endpoints, a changed/added/removed optional audience and an identical repeat.

### B-LA-E2-04-03 — MINOR — The audit code catalogue does not describe all staged refusals

- **Files:** `services/cogniate-app/src/app/operator.ts:189`, `services/cogniate-app/src/app/operator.ts:201`; `docs/architecture/ltiaas/contracts/cogniate-app-api-delta.md:199`.
- **Problem:** the new `deployment_mismatch` audit code has no row in the required §7 catalogue. The same implementation also uses `bound_values_missing` for a staged connection without `--accept-staged`, while that row describes only a non-staged connection missing endpoint flags. The `staged_values_changed` row describes a change after values were printed, while the implemented check runs before printing. Support cannot map these events to the documented causes reliably.
- **Evidence:** the passing staged operator test pins all six actual refusal codes, including `deployment_mismatch`; the §7 table lists only the six additions of BD-A1-92 and has no deployment-mismatch row. The CLI lines themselves name the right repair action for a missing acceptance flag or a wrong deployment ID.
- **Suggested fix:** have the contract owner add the new stable code and align the two staged causes with the implementation, retaining the field-specific CLI lines and existing audit assertions. Add the staged-client case to `client_id_mismatch` as part of that same catalogue update.

### Ownership, operator flow and verification

The main implementation has clear boundaries: `BOUND_FIELDS` fixes the display/comparison order, the shared comparison helpers serve phase 1 and adoption, and `stageRegistration` owns the guarded SQL transition in one statement. Missing endpoint flags are named, each foreign-host value is marked before the approval code, and the refusal explains `--confirm-foreign-hosts`. Successful issue and list output retain the bound values. The command wrapper maps each new CLI flag directly to the typed operator input; no stack-backed CLI was started.

The diff stays in K's app paths and adjacent unit tests. The `domain/connections.ts` addition is the explicit BD-A1-90 exception. No forbidden LTI-service, launch, picker or R production path changed. No LMS-name literal was added to scanned core code. The frozen Moodle page texts remain covered, while new channel text uses one substitution pass.

Verification ran only in `/tmp/la-e2-04-review-b-p0ltlhei/repo` at the merge SHA:

- **277 focused tests in 12 files passed**, covering operator refusals/audit, redemption, registration pages, client wire fields, adapter checks, connections and the shared portal shell. **134 K0 tests passed**.
- Full repository lint, `npm run typecheck`, F1 (0 hits) and F5 (six rules, 0 hits) passed.
- UNIT AC-01/-02/-06 and AC-07's list behavior have discriminating tests: restoring `operator.ts` from before `63a51c1` made all seven bound-value operator tests fail. AC-05's trigger/guard test passed on the implementation and failed when the authority change was disabled. AC-07's suspend/release test verifies the stored `exclusive_platform` attempt and the actual platform deactivation/deletion; the record-kind selection itself was already present before this task.
- The two added review probes failed as described in B-01/B-02. All temporary changes were restored; the private checkout is clean. The separate actual manual-form probe passed after `3777e7c`, as reported in LA-E2-03 Round 2.

QA still owns K1-SIM AC-03/-04/-08, the full generic kit, learner launch/score evidence and R1. Those were not run or claimed here. Request changes for B-01 and B-02; B-03 is safe to defer. No Docker, stack, commit or push was run.

## Round 2

**Verdict: APPROVE.** Reviewed `71da381` and `16085aa` at merge `67e5ab05c38a4eed71824ae753938bb3a772652f`, the staged manifest/DTO fix `9d52c24`, and A1's contract update `0ad9807` (BD-A1-96/-97). Blind review; the other reviewer's file was not read.

**Open counts:** 0 BLOCKER, 0 MAJOR, 1 MINOR, 0 NIT. All three Round 1 findings close; B-04 below is new.

- **B-LA-E2-04-01 — CLOSED.** The manifest now supplies the three dynamic binding fields, and the pending staged DTO retains its unapproved staged deployment IDs for pre-fill. The new rendered-wizard test and the route test both pass. I also joined the real paths in a private probe: POST a dynamic connection, complete a staged registration through `/tool/register`, GET its actual DTO, issue its grant, render `ManifestWizard` with that DTO, enter only the code, and send the captured form through the actual PUT route. It submitted exactly `{ clientId, deploymentId, grantCode }`, returned `registered`, activated the same platform and made no platform create. The long manual form remains covered separately. This was a manifest/DTO fix; no shared-wizard production change was needed.
- **B-LA-E2-04-02 — CLOSED.** `repeatMismatch` reads the committed approval's grant and compares its bound values using the phase-1 helper before accepting a finalized repeat. Changed issuer/endpoints and added/removed/changed audience now return `422 GRANT_MISMATCH` with the differing fields; the log has `grant_rejected`, reason `mismatch`, connection id and trace id. Identical values, canonical-equivalent origins, blank absent audience, fixed-profile repeats and the short staged body keep the no-LTI-call repeat behavior. The tests also assert that refusals do not change the platform.
- **B-LA-E2-04-03 — CLOSED.** BD-A1-96 adds `deployment_mismatch`, the staged `client_id_mismatch` case, the missing `--accept-staged` case and the pre-print `staged_values_changed` timing. The catalogue contains all 26 refusal codes checked against the operator implementation, and the staged CLI tests pin the matching repair lines and audit events.

### B-LA-E2-04-04 — MINOR — A gone staged platform still gets the collision instruction

- **Files:** `services/cogniate-app/src/app/redemption.ts:226`, `services/cogniate-app/src/app/redemption.ts:319`; contract: `docs/architecture/ltiaas/contracts/cogniate-app-api-delta.md:103`.
- **Problem:** BD-A1-97 requires the existing `409 PLATFORM_IN_USE` code to explain that the staged registration is gone and to make a new connection. The missing-record branch still uses the ordinary collision message. Support is told that a key is already connected when the platform no longer exists.
- **Evidence:** after issuing a staged grant, removed its platform from the fake LTI service and called the real PUT route. It returned `409 PLATFORM_IN_USE` with `This your LMS developer key is already connected to Cogniate. Make a new developer key for this library, or ask your Cogniate operator.` The assertion requiring the gone-staged cause failed. The status/code are correct; no platform was created or activated.
- **Suggested fix:** give this staged missing-record branch its own description, such as `The staged registration is gone. Make a new connection.`, while keeping the existing code and the ordinary collision text. Pin the full refusal in a route test, and check the portal notice too: its generic `PLATFORM_IN_USE` replacement must not hide the specific cause. This is safe to defer as an operator-text issue.

### Round 2 verification and scope

Used a fresh `git clone --no-hardlinks` at `/tmp/la-e2-04-r2-review-b-lmlvn0ij/repo`, with its own successful `npm ci`. Deleted `node_modules/.vitest-cache` before every Vitest run. **211 focused tests in eight files passed**, plus full lint, type checks, F1 (0 hits) and F5 (six rules, 0 hits). The wizard-to-route probe ran in a Node test with a local jsdom document and Fastify injection, with the fake LTI service; no listener or stack was started.

Negative controls are discriminating: restoring the old repeat engine made the two mismatch regressions fail while the identical-repeat test passed; restoring the pre-`9d52c24` manifest broke the staged wizard but preserved the manual test; restoring the old DTO broke the staged deployment pre-fill test. Additional BD-A1-97 probes confirmed that disconnect and suspend/release leave an unredeemed staged platform unchanged and inactive, with no LTI call. The changed-value staged refusal remains covered by the route suite; the gone-platform description is B-04.

The portal edit is the dispatched RQ-2 test only; the production fixes stay in the declared K paths, with the manifest/DTO change explicitly included in this review. All private mutations were restored; the private checkout is clean. Only this report was edited in the integration worktree. QA still owns K1-SIM/R1 and browser acceptance; no Docker, stack, commit or push was run.
