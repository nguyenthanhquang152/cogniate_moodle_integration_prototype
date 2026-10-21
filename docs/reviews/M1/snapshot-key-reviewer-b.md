Verdict: APPROVE
Round: 1

# M1-38 snapshot probe: stable Canvas service-key repair — Reviewer-B

Reviewer: dedicated independent Reviewer-B, Claude Code `claude-opus-5-5`, xhigh, retained session `c75b96cd-c1da-42ea-9b53-c5207e508e49`. Task `task_0168e7df3b76`, dispatch `ctx_b79580197a2f`, run `run_ebe671ad72a9`. Date: 2026-10-21.

This is a bounded source review of one test-oracle repair. It is not a product review. **It gives no runtime acceptance credit.**

## 1. Scope and exact sources

| Item | Value |
| --- | --- |
| Candidate | `82e2dab6d26915c90070a4aae8ac0c4472706c2d`, `tests` tree `51b2e50e2ed02efd4553c4b09c2c4b0d28d624c5` |
| Base | `55c33a3e2d60670b5e759a79144c96bd213fca1f` |
| Changed file | `tests/acceptance/M1/common/snapshot-migration.probe.ts`, SHA-256 `4b1276328f35b86c19547ffe12fd28e8222f032fd238ca512cc290e9dafad6d3` |
| QA report (evidence only) | `docs/reviews/M1/snapshot-key-qa.md`, SHA-256 `7043c81768f3eecc5ae73ee7197e322a1f3295ad869fb0722603c0bf5293860f` |

- `git diff --stat 55c33a3 82e2dab -- services apps packages infra tests docs/architecture package.json` shows one file, 2 insertions and 2 deletions. The other commits since the base change documents only.
- **Contract:** `services.serviceKey` is "Stable per (platform, deployment, context, resource link)" (`docs/architecture/contracts/lti-service-api.md:218`).
- **Independence:** I did not read any other reviewer's report on this repair. I did the base diagnosis from `git show 55c33a3:…` before the candidate existed. I then repeated every check on the committed bytes.

Line numbers below are at `82e2dab`. "Probe" means the changed file.

## 2. The change

The two Canvas launches of the probe now pass the publication id as the resource link:
- probe `:31` (`preserve`): `canvasPlay(state.a, state.canvasPub, { resourceLinkId: state.canvasPub.id })`;
- probe `:53` (h1 seed): `canvasPlay(a, canvasPub, { resourceLinkId: canvasPub.id })`.

No other line changes. Every assertion, case id, title, the old-build pin `9f96f7b`, the Blackboard path and every helper stay the same.

## 3. Diagnosis at the base (source facts)

**What made the keys differ:**
- `canvasPlay` launches with `resourceLinkId: unique('rl')`, then spreads the caller's patch after it (`tests/acceptance/M1/canvas/canvas.ts:105`–`:106`). So each call used a new resource link.
- The Blackboard `openPlay` already launches with `resourceLinkId: pub.id` (`tests/acceptance/M1/common/course.ts:41`–`:43`).

**What makes the key:**
- The product key is an HMAC of (tool account, platform, deployment, context, resource link), plus the generation when it is above 0 (`services/lti-service/src/store/service-keys.ts:32`–`:38`). It is stored as one row per tuple (`:44`–`:67`).
- Platform and deployment come from the saved target (`canvas.ts:67`–`:68`).
- The context is the simulator default `context-1` (`tests/sim/core/runtime.mjs:58`).
- So the seed launch (`:53`) and the `preserve` launch (`:31`, called at `:77`) had different tuples, and therefore different keys. The assertion at `:32` then failed. This matches the failed run (h1 in the 011 seed).

**History:** the defect was there from the start. The unique link default comes from `9964e6f`, and the `preserve` key check from `3fef85f`. No product change caused the failure.

**After the repair:** both calls use (A platform, A deployment, `context-1`, `canvasPub.id`). That is the same tuple at the seed and at every `preserve` call: h1 `:77`, h2 `:102`, h3 `:119`, h4 `:133`, h5 `:156`, `:160`, `:165`, `:179`.

The h4 key check through `service(state.canvasKey, …)` (`:131`) and the Blackboard checks do not change. An existing Canvas test already uses the same override (`tests/acceptance/M1/canvas/41-canvas-grades.test.ts:61`).

## 4. What I checked myself

**Control harness** (fresh folder `/tmp/rb-key-SUc5hm`, mode 0700): script `rb/rb-key-controls.mjs`, SHA-256 `f965a09a8156685198735e325929dc0f921155a0c2be64cfac2da320cc44eaf3`.
- **Real code, taken from each git tree:**
  - the probe's h1 seed body and its `preserve`;
  - the real `canvasPlay`, `binding` and constants;
  - the in-process simulator runtime with the real `canvas-sim-cloud` config;
  - the product's `deriveServiceKey`.
- **Stubs:** only the network edge. `launch()` builds the scenario in the real simulator and returns the key that `deriveServiceKey` gives for that scenario's tuple. Page fetches return fixed pages. The Blackboard `openPlay` is a stub; it is not under review.
- **The upgrade controls** call the real `preserve(load())` after a passing seed. This is the shared Canvas key check of h1–h5.
- I ran everything twice, with the same results. Output: `rb/cand-out-1.json` (SHA-256 `4680073e394060f3ac5aebe51a48483601daf3e41a013c34ed10c38eb90ed6ec`) and `rb/base-out-1.json` (SHA-256 `17f1bed6d4d37d61f8c5ea945661f27de1bb05d0e801bbea8ac3dcb766279388`).

| # | Tree | Product | Result | Meaning |
| --- | --- | --- | --- | --- |
| 1 | base | contract | h1 **FAIL**: both compared values are issued keys, and they differ | reproduces the old failure. The two launches differ only by resource link: same client `cA`, deployment `dA`, context `context-1`. |
| 2 | base | the key ignores the resource link (diagnosis only) | h1 PASS | the resource link alone causes the failure |
| 3 | candidate | contract | h1 PASS | the repaired seed |
| 4 | candidate | contract, after a same-tuple upgrade | `preserve(load())` PASS; a second call PASS | the repaired positive; all 8 Canvas launches use the publication id |
| 5 | candidate | generation bump after the upgrade | **FAIL**: two different issued keys | a changed key on the same tuple is still caught |
| 6 | candidate | platform re-created by the upgrade | **FAIL**: two different issued keys | as above |
| 7 | candidate | master key rotated | **FAIL**: two different issued keys | as above |

**Inventory and identity** (clean detached clone of `82e2dab`, no Docker):
- `node tests/host/run-m1.mjs --harness-only --provider all`: exit 0. 70 of 70 self-checks and typecheck pass. "392 API cases, 96 host rows (72 AC-M1-41); 488 mandatory rows per round". Phases: `sim` 394, `migration` 12, `snapshot-upgrade` 6, `snapshot-isolated` 6, `storage` 70.
- `--provider canvas`: exit 0. 70 of 70 pass, 347 rows.
- `tests/acceptance/M1/canvas/manifest.json` and `tests/acceptance/M1/common/manifest.json` are byte-identical at `55c33a3` and `82e2dab`. The Canvas manifest has 233 rows.
- The ids, `SIM` labels and titles of `M1-38.common.h1`–`h5` do not change.

## 5. QA evidence (assessed, not repeated)

**What I confirmed independently:**
- the cause, the contract tuple and the call-site table;
- the base failure at the Canvas key comparison;
- the repaired positive;
- that changed keys on the same tuple are still caught;
- the 488-row inventory and the 233 Canvas rows.

**What is QA evidence only:** QA's fake-world runs of the h2–h5 bodies (C2, C5-h2 … C5-h5) and the Blackboard key fault (C4). My controls reach h2–h5 only through the shared `preserve`. Source reading shows no other Canvas launch or key comparison in the probe. h4 uses `state.canvasKey` only in `service()` calls.

**QA's own statement:** QA states the limits correctly. The repaired check no longer shows that a new resource link gets a new key. That property is not an h-criterion.

## 6. Findings

There is no BLOCKER, MAJOR, MINOR or NIT finding.

**Observations (no action needed):**
- **O-1 (maintainability):** the reason for the two overrides is in the QA report, but not in the probe. A later edit that removes them fails loudly at `:32`, so this is safe. A one-line comment at `:31` and `:53` (the same link as the seed, so the same key tuple, `lti-service-api.md:218`) would save a future diagnosis.
- **O-2 (minimality):** changing the `canvasPlay` default instead would affect every Canvas caller that depends on a fresh link. Overriding at the call sites is the smallest correct repair, and it matches the Blackboard convention.

## 7. Limits (not measured)

- The real product at `9f96f7b` and at the candidate. Both are expected to derive the generation-0 key in the same way (`service-keys.ts:27`–`:30`), but I did not run them.
- App behaviour when the same Canvas resource link is launched again: play or attempt reuse. `preserve` checks only the player, runtime state `200` and the key.
- The gate, CLI and log assertions of h1–h5, and real timing.

## 8. Verdict

**APPROVE**, for the test source only.
- The two-line repair makes the seed and every `preserve` call test the same contract tuple.
- It reproduces and removes the old false failure.
- It still fails when the key of the same tuple changes.

**No runtime acceptance is given.** The rows count only in a new full M1 run (both 488-row rounds and the legacy groups) at the exact frozen SHA. Earlier source approvals stay source-only, and all 32 live LMS rows stay UNVERIFIED.
