# M1-38 snapshot probe: stable Canvas service-key repair — Reviewer-A

Verdict: **APPROVE** (test source only)

Round: 1

| Item | Value |
|---|---|
| Reviewer | Reviewer-A (Claude Code, Opus 5.5 xhigh), retained session `604b28c1-156c-4266-84c3-e0f0089004da` |
| Date | 2026-10-21 |
| Task / dispatch | `task_cb31d65ca232` / `ctx_95f5cc04ec0f` |
| Candidate (product = test) | `82e2dab6d26915c90070a4aae8ac0c4472706c2d`, tests tree `51b2e50e2ed02efd4553c4b09c2c4b0d28d624c5` |
| Base | `55c33a3e2d60670b5e759a79144c96bd213fca1f` |
| Held test file | `tests/acceptance/M1/common/snapshot-migration.probe.ts`, SHA-256 `4b1276328f35b86c19547ffe12fd28e8222f032fd238ca512cc290e9dafad6d3` (base `11a6809c35b99190630e077e2517eba4c9bfd3fbb0eb2a6147f040b8bfd65e01`) |
| QA evidence assessed | `docs/reviews/M1/snapshot-key-qa.md`, SHA-256 `7043c81768f3eecc5ae73ee7197e322a1f3295ad869fb0722603c0bf5293860f` |
| Lens | Correctness, isolation and stable identity semantics |
| Runtime credit | **None.** No product, stack or Docker run. |

## 1. Summary

The two-line repair makes the h1 seed launch and every `preserve()` launch of the old Canvas connection use the same resource link: the publication id, as `openPlay` already does for Blackboard. So the probe now checks the contract claim it was written for: the service key of one fixed (platform, deployment, context, resource link) tuple stays the same through the `011 → 012` route.

The unchanged assertion still fails when the product gives that same tuple another key. No case id, title, assertion, pin or inventory row changes. I found no BLOCKER, MAJOR or MINOR finding.

## 2. Inputs and independence

- I reviewed exact bytes in fresh detached clones: `/tmp/rva-82e2dab` (candidate) and `/tmp/rva-55c33a3` (base). I did the base diagnosis before the candidate existed, with `git show` and base-only reads.
- `git diff --stat 55c33a3 82e2dab -- . ':!docs'` shows one file, +2/−2. No path under `services/`, `apps/`, `packages/` or `infra/` changes, and no other test changes.
- I read QA's report as evidence. I did not read another reviewer's report for this task.
- I ran no product, stack or Docker command. I changed only this file.

## 3. The defect at the base (source facts)

- `canvasPlay` launches with `{ resource: pub.id, resourceLinkId: unique('rl'), ...patch }` (`tests/acceptance/M1/canvas/canvas.ts:105-106`). Each call without a patch gets a new resource link. `openPlay` uses `resourceLinkId: pub.id` (`tests/acceptance/M1/common/course.ts:41-43`).
- At the base, the seed launch (probe `:53`) and `preserve()` (probe `:31`) both used the default. Then `:32` compares the new key with the saved `state.canvasKey`.
- The contract keys the value on the tuple: "Stable per (platform, deployment, context, resource link)" (`docs/architecture/contracts/lti-service-api.md:218`), with a new value only when the generation changes (`:647`). Exclusive Canvas platforms keep generation 0 (`:645`, `:444`).
- The product agrees:
  - `serviceKeyForLaunch` takes the context and resource-link ids from the signed claims (`services/lti-service/src/lti/service-keys.ts:14-25`);
  - `deriveServiceKey` is an HMAC of (tool account, platform, deployment, context, resource link) plus `generation=N` only when N > 0 (`services/lti-service/src/store/service-keys.ts:32-38`);
  - both files are byte-identical at the old build `9f96f7b`, so a same-tuple key carries through the upgrade.
- The simulator keeps `contextId: 'context-1'` and lays the posted scenario over its defaults (`tests/sim/core/runtime.mjs:57-60`). The signed claims carry `scenario.contextId` and `scenario.resourceLinkId` (`tests/sim/core/provider.mjs:30-31`).
- So at the base, every Canvas launch was a new tuple with a new key. This is the observed h1 failure in the `011` seed.

## 4. The repair (candidate)

| Line | Before | After |
|---|---|---|
| `:31` (`preserve()`) | `canvasPlay(state.a, state.canvasPub)` | `canvasPlay(state.a, state.canvasPub, { resourceLinkId: state.canvasPub.id })` |
| `:53` (h1 seed) | `canvasPlay(a, canvasPub)` | `canvasPlay(a, canvasPub, { resourceLinkId: canvasPub.id })` |

- The patch spreads after the default, so it wins (`canvas.ts:106`). The same override is already in use at `tests/acceptance/M1/canvas/41-canvas-grades.test.ts:61`.
- **Same tuple everywhere.** Platform and deployment come from the saved binding `state.a`, through `scenarioOf` (`canvas.ts:67-68`). No h-case writes `state.a.clientId`, `state.a.deploymentId` or `state.canvasPub`; h4 changes only `state.a.connection` (`:128`). The context is the simulator default. The resource link is `canvasPub.id`, which `store()` saves and `load()` reads back.
- **Both stages use the repaired probe.** `installTests` extracts the frozen `identity.testSha` tests tree into the clone for the old and the candidate stage (`tests/host/run-m1.mjs:196-209`).
- **Generation.** h4 adds deployments to A's exclusive Canvas platform; A's own deployment keeps generation 0 (`lti-service-api.md:645`). h5 rebinds C0-B and C0-C, which are other deployments and platforms. So M1.md (h4) ":187 … its old service key keep working" is a same-tuple claim, and the repaired probe tests exactly that.
- **Protection kept.** `:32`, `:33` and the two `service(… '/api/lineitems')` `200` checks are unchanged. A different key for the same tuple still fails `:32`.

## 5. Checks I performed

### 5.1 Faithful control (real helper, real simulator, real product key function)

A scratch Vitest file (`/tmp/rva-skey-ctl/zz-rva-skey.control.test.ts`, run in a scratch copy of each clone, then moved out of the tree) does this:

- It takes the **exact call-site text** of `:53` and `:31` from the given probe file and runs it against the **real** `canvasPlay` / `canvasLaunch` / `scenarioOf`.
- Only the network edge is replaced. `launch` feeds the scenario into the **real** simulator (`createRuntime` + Canvas `createProviders`: scenario merge, Canvas authorize, signed `id_token`). The key is the **real** product `deriveServiceKey` over the signed claims' (deployment, context, resource link), with generation 0.
- The probe's own assertion (`assert.equal(canvas.token.services.serviceKey, state.canvasKey)`) runs after a JSON `store()`/`load()` round trip, five times (h1 seed and h2–h5).

| Probe bytes | Five `preserve()` comparisons | Tuples seen (deployment / context / resource link) | Same tuple, generation changed to 1 |
|---|---|---|---|
| Base `55c33a3` | **FAIL ×5** (the old failure) | 7 different `rl-…` links | FAIL |
| Candidate `82e2dab` | **PASS ×5** | one tuple: `dA / context-1 / pub_rva1` | **FAIL** (protection kept) |

This control covers the two Canvas call sites and the product key rule. It does not run the rest of the probe; QA's control does (§6).

### 5.2 Inventory, ids and typecheck

| Check (candidate clone, clean tree) | Result |
|---|---|
| `node tests/host/run-m1.mjs --harness-only --provider all` | exit 0; 70 of 70 self-checks; typecheck; "392 API cases, 96 host rows (72 AC-M1-41); 488 mandatory rows per round"; phases `sim` 394, `migration` 12, `snapshot-upgrade` 6, `snapshot-isolated` 6, `storage` 70 — identical to the base |
| `--harness-only --provider canvas` | exit 0; 70 of 70; 251 API + 96 host rows |
| `tests/acceptance/M1/canvas/manifest.json` | unchanged; 233 Canvas entries |
| Case ids, titles, pins | The `m1Test`/`upgradeCase` lines, the `9f96f7b` pins (`:41`, `:50`) and every assertion line are outside the diff |

My first harness run failed only because my own scratch control file sat in the tests tree (typecheck). I moved it out and ran again on the clean tree with the results above.

## 6. QA evidence (assessed, not repeated)

QA ran the **real probe file** of both trees under Vitest. The fake world gave keys by the contract rule (one row per tuple, an HMAC value, generation rules). It reports:

- C1: base h1 FAIL at `:32` (from `:77`).
- C2: candidate h1–h5 PASS, with 13 Canvas launches on one tuple and one key, and 13 Blackboard launches on one key.
- C3–C5: a same-tuple key change fails at the seed, h2, h3, h4 or h5, as expected.
- Unchanged inventory and ids.

Their counts agree with my reading: 1 seed launch + 12 `preserve()` calls (seed 1, h2 1, h3 1, h4 1, h5 8) = 13 Canvas launches.

QA's fake key service is a stand-in for the product. My control in §5.1 adds the real simulator claims and the real product `deriveServiceKey` for the changed call sites. Together they cover the whole probe flow and the real key rule. I did not rerun QA's harness.

## 7. Findings

No BLOCKER, MAJOR or MINOR finding.

| ID | Severity | Note |
|---|---|---|
| A-SK-01 | Limit (no action) | The repaired probe no longer launches a *new* Canvas resource link here, so it does not show that a new link gets a new key. No h-criterion asks for that, and other Canvas cases keep the `unique('rl')` default. |
| A-SK-02 | Limit (no action) | Repeated launches of one Canvas resource link reach the same app activity. Blackboard already did this in the failed run, and its `openPlay` launches completed. The Canvas app path is runtime-only evidence. |

## 8. Limits

- **No runtime acceptance credit.** The real product at `9f96f7b` and at the candidate, the `011 → 012` migration of the key rows, and the gate, CLI and log assertions of h1–h5 are not run here.
- The failed attempt at `55c33a3` stays FAIL. A new freeze and full runs are needed.
- My control uses `deriveServiceKey` (the value). It does not run `issueServiceKey`'s row update, which stores the same hash for the same tuple and generation.

## 9. Verdict

**APPROVE** at `82e2dab6d26915c90070a4aae8ac0c4472706c2d` (probe SHA-256 `4b1276328f35b86c19547ffe12fd28e8222f032fd238ca512cc290e9dafad6d3`), for the test source only.
