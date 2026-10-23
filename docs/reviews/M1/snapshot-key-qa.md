# M1-38 snapshot probe: stable Canvas service-key repair (QA, held)

Common QA, 2026-10-21. **Result: the two-line probe repair is held for the Lead. Host-side controls PASS. No runtime acceptance ran.** This is a bounded QA repair after the failed acceptance dispatch `ctx_4446d0034a39`. It is not an acceptance retry. The failed run at `55c33a3` and its raw evidence stay **FAIL** ([qa.md, "Retry at `55c33a3`"](qa.md)). No M1 criterion gets credit from this report.

## Identity

| Item | Value |
| --- | --- |
| Role and session | Common QA, independent of the product authors and reviewers. Requested and effective model: Claude Code Opus 5.5 (`claude-opus-5-5`), xhigh effort. Orca session `orca_session_id:d3d960de-f407-4401-978c-ea1d38b6c833`. |
| Task | Run `run_ebe671ad72a9`, task `task_e3b78fb1a605`, dispatch `ctx_56fe09e67789`. Lead status `msg_b24301c08ea4`: work only on the probe and this report, hold both, no Docker. |
| Base tested candidate | `55c33a3e2d60670b5e759a79144c96bd213fca1f` |
| Worktree | branch `nguyenthanhquang152/lti-multi-lms`, HEAD `a9280647e9aa1e9a7c945dfde6cf0126aa8c5704`. `git diff --quiet 55c33a3 HEAD -- tests` exits 0: the `tests/` tree at HEAD is the same as the tested candidate. |
| Owned files | `tests/acceptance/M1/common/snapshot-migration.probe.ts` and this report. No other repository file changed. No commit and no push. |

## Change (exact diff)

```diff
@@ -31 +31 @@ async function preserve(state: Json) {
-  const canvas = await canvasPlay(state.a, state.canvasPub), blackboard = await openPlay(state.b, state.blackboardPub);
+  const canvas = await canvasPlay(state.a, state.canvasPub, { resourceLinkId: state.canvasPub.id }), blackboard = await openPlay(state.b, state.blackboardPub);
@@ -53 +53 @@ if (stage === 'snapshot-seed') m1Test('M1-38.common.h1', ...
-  const canvasPub = await publication(a), canvasRun = await canvasPlay(a, canvasPub);
+  const canvasPub = await publication(a), canvasRun = await canvasPlay(a, canvasPub, { resourceLinkId: canvasPub.id });
```

| Held file | SHA-256 before | SHA-256 after |
| --- | --- | --- |
| `tests/acceptance/M1/common/snapshot-migration.probe.ts` | `11a6809c35b99190630e077e2517eba4c9bfd3fbb0eb2a6147f040b8bfd65e01` (same at `55c33a3` and HEAD) | `4b1276328f35b86c19547ffe12fd28e8222f032fd238ca512cc290e9dafad6d3` |
| `docs/reviews/M1/snapshot-key-qa.md` | new file | given in the completion message (a file cannot contain its own hash) |

Unchanged: every assertion, case id, title and inventory row; the old-image pin `9f96f7b`; the phases; the Blackboard and Moodle checks; the host runner; the helpers (`canvasPlay` keeps its `unique('rl')` default for all other callers). Two lines was enough, so no wider change was needed.

## Why the repair is correct (sources)

- **Failure.** `M1-38.common.h1` failed at `snapshot-migration.probe.ts:32` in `preserve()`: the Canvas key of the second launch differed from the saved key ([qa.md](qa.md), "Retry at `55c33a3`").
- **Cause.** `canvasPlay` launches with `resourceLinkId: unique('rl')`, then spreads the caller's patch (`tests/acceptance/M1/canvas/canvas.ts:105-106`). So each call used a new resource link. `openPlay` uses `resourceLinkId: pub.id` (`tests/acceptance/M1/common/course.ts:43-44`).
- **Contract.** A service key is "stable per (platform, deployment, context, resource link)" (`docs/architecture/contracts/lti-service-api.md:218`), "one key per (platform, deployment, context, resource link)" (§3.3, line 254). Generation is 0 for exclusive platforms (§9.14, line 645), the Canvas profiles are exclusive (line 444), and `canvas-sim-cloud` follows its copy (line 447). Two different resource links must give two keys, so the old probe compared two different tuples.
- **Criterion.** The keys of (A) and (B) must stay unchanged through the route (`docs/architecture/tasks/M1.md:187` for h4, `:188` for h5). That is a same-tuple claim.
- **Same tuple after the repair.** Platform and deployment come from the saved target `state.a` (`canvas.ts:67-70`, `scenarioOf` and `canvasLaunch`). The context is the simulator default `context-1` (`tests/sim/core/runtime.mjs:57-59`), because neither call sets it. The resource link is now `canvasPub.id` at both call sites.
- **Helper support.** The patch overrides the default (spread after it). An existing Canvas test already uses this override: `tests/acceptance/M1/canvas/41-canvas-grades.test.ts:61`.

## Seed and preserve paths (inspection)

| Probe line | Path | Canvas launch tuple |
| --- | --- | --- |
| 53 | h1 seed launch on the old build | (A platform, A deployment, `context-1`, `canvasPub.id`); key saved as `state.canvasKey` |
| 77 | h1 `preserve()` after `store()` | same tuple |
| 102, 119, 133 | h2, h3, h4 `preserve()` | same tuple, from `load()` of the saved JSON |
| 156, 160, 165, 179 | h5 `preserve()`, once for C0-B and once for C0-C at each line | same tuple |

- `state.canvasPub` is saved by `store()` and read by `load()`. No h-case writes `state.canvasPub`, `state.a.clientId` or `state.a.deploymentId`. h4 changes only `state.a.connection` (line 128).
- h4 adds deployments to A's exclusive Canvas platform. The generation of A's deployment stays 0 (§9.14), so A's key must stay the same.
- h5 C0-C releases the orphan platform. That platform has a different client id (probe line 65), so A is not touched. h5 C0-B rebinds C0-B's deployment. Only that deployment's generation changes; B's deployment is different.
- **Both stages use this probe.** The runner installs the frozen `tests/` tree after the old checkout and after the candidate checkout (`tests/host/run-m1.mjs:196-209`; `tests/host/m1-migration.mjs:279`, `:299`).
- **j rows.** `M1-41.common.j-snapshot` is a host row, not a probe case (`tests/host/m1-phases.mjs:17-18`). The runner computes it from the route steps (`tests/host/m1-migration.mjs:306-309`). It does not call `preserve()` or launch. `j-migration` uses `migration.probe.ts` in the `migration` phase, not this probe. The repair does not change either row.

## Host-side controls (actually run, no Docker)

**Method.** A fresh private directory `/Users/quangnguyen/cogniate-qa-runs/snapshot-key-qa-20261021T0404Z` (mode 0700, outside the repository). Two trees came from `git archive 55c33a3 tests`: `base` (unchanged) and `fix` (the held probe bytes copied in). Vitest 3.2.7 ran the **real** probe file of each tree. These parts are real: all probe code and assertions; `canvasPlay`, `canvasLaunch`, `scenarioOf`, `appPage`, `binding` and the id helpers of `canvas.ts`; `openPlay` of `course.ts`; `received` of `snapshot-oracle.mjs`. Only network-facing helpers are replaced, through `vi.mock`, by a fake world:

- The fake launch applies the same defaults as `beginLaunch` (`client.ts:149-150`) and the simulator (`runtime.mjs:57-59`).
- The fake LTI service gives keys by the contract rule: one stored row per (platform, deployment, context, resource link); an HMAC value; generation 0 for Canvas; generation 1 for a new active shared Blackboard deployment; a row of an older generation gets a new value; the service API accepts only a current key.
- The fake world is saved to a file between the seed process and the upgrade process, like the volumes in the real route.
- The app, CLI and gate fakes only let the probe reach each `preserve()` call. They are **not** evidence for any non-key assertion.
- A fault switch can change the key value of the **same** tuple once (a defective product).

| Control | Tree | Fault | Result (actual) |
| --- | --- | --- | --- |
| C1 old failure | base | none | h1 **FAIL** at `probe.ts:32:10` (from `:77`): two different 43-character keys. The two Canvas launches used two resource links. This is the same location as the failed run. |
| C2 same tuple | fix | none | h1 PASS; then h2, h3, h4, h5 PASS. Canvas: 13 launches (seed 2, upgrade 11: h2 1, h3 1, h4 1, h5 8), one tuple, **one key**. Blackboard: 13 launches, one key. 26 service calls, all `200`. |
| C3 | fix | Canvas key changes, seed | h1 **FAIL** at `:32` (from `:77`) |
| C4 | fix | Blackboard key changes, seed | h1 **FAIL** at `:33` (from `:77`). Line 32 passed first, so line 33 now runs. |
| C5-h2 | fix | Canvas key changes in h2 | h2 FAIL `:32` (from `:102`); h3 FAIL `:32`; h4 FAIL `:131` (old key `401`); h5 FAIL `:27` |
| C5-h3 | fix | Canvas key changes in h3 | h2 PASS; h3 FAIL `:32` (from `:119`); h4 FAIL `:131`; h5 FAIL `:27` |
| C5-h4 | fix | Canvas key changes in h4 | h2, h3 PASS; h4 FAIL `:32` (from `:133`); h5 FAIL `:27` |
| C5-h5 | fix | Canvas key changes in h5 | h2, h3, h4 PASS; h5 FAIL `:32` (from `:156`) |

The h5 `:27` failures after an h4 failure are expected: a failed case does not `store()` its state, so the next case reads older connection data. Seed-stage faults stop at h1, so their upgrade stage did not run.

**Reasoning only (not run):** the behaviour of the real product at `9f96f7b` and at the candidate; app attempt reuse for a repeated Canvas resource link; the gate, CLI and log assertions of h1–h5; runtime timings. The repaired check no longer shows that a new resource link gets a new key; no h-criterion asks for that.

## Harness-only checks, typecheck and inventory

All ran in a private clone of HEAD `a928064` with the held probe bytes (`npm --prefix tests ci` exit 0). The `tests/` tree there equals `55c33a3` except the probe.

| Check | Result |
| --- | --- |
| `node tests/host/run-m1.mjs --harness-only --provider all` | exit 0. Self-checks 70 of 70 PASS. Typecheck PASS. "392 API cases, 96 host rows (72 AC-M1-41); **488** mandatory rows per round; phases sim 394, migration 12, snapshot-upgrade 6, snapshot-isolated 6, storage 70". |
| `--harness-only --provider canvas` | exit 0. 347 rows (common and Canvas). |
| Joined inventory by owner (same functions as the runner) | common 114, Blackboard 141, **Canvas 233** (225 API `sim`, 7 browser `sim`, 1 API `snapshot-isolated`). Probe rows: `M1-38.common.h1`–`h5`, phase `snapshot-upgrade`. |
| `vitest list` ids, base probe vs held probe | identical: all providers 392, Canvas filter 251, stage `snapshot-seed` 1 (h1), stage `snapshot-upgrade` 4 (h2–h5). The five full titles are identical. |
| `npm --prefix tests run typecheck` in the worktree | exit 0 (`noEmit`) |

No product acceptance, Docker, live provider or runtime check ran.

## Evidence (private, mode 0700)

Root: `/Users/quangnguyen/cogniate-qa-runs/snapshot-key-qa-20261021T0404Z`. `harness/` holds the control code; `evidence/` holds one folder per control (`*.vitest.json`, `summary.txt`, `world.json`), the discovery lists, the harness-only output and the inventory. The world files hold only synthetic keys of the fake world. The summaries hold no key value (hashes and lengths only).

| File | SHA-256 (first 12) |
| --- | --- |
| `harness/zz-world.mjs` | `24f5ed01e281` |
| `harness/zz-snapshot-key-control.test.ts` | `06b4e310cd76` |
| `harness/run-control.sh` | `616e4baff732` |
| `evidence/c1-base-different-link/summary.txt` | `77be8cfbb831` |
| `evidence/c2-fix-same-tuple/summary.txt` | `f3ec78612096` |
| `evidence/c2-fix-same-tuple/snapshot-upgrade.vitest.json` | `08687b9c2cf9` |
| `evidence/harness-only-all.txt` | `f38b5844d8a5` |
| `evidence/inventory-fix.txt` | `eb3df9fb5352` |

## Next

1. The Lead commits the two held files by exact path.
2. Reviewer-A and Reviewer-B review the repair independently.
3. The Lead freezes a new candidate SHA.
4. A new Docker window runs the full acceptance again: both 488-row rounds and all legacy groups, from a fresh clone.

Until then, all M1 rows keep their current status.
