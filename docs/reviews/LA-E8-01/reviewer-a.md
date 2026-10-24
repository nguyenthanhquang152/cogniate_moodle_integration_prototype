Verdict: CHANGES_REQUESTED
Round: 3

# LA-E8-01 — Reviewer-A

## Round 1

Reviewer: Codex GPT-6-Astra xhigh, 2026-10-24. Lens: correctness and safety. Reviewed Docs commit `bb9f6d7e` (integration merge `0f96658d`), the task spec, LA-ADR-01 D1/D2/D4/D6, LA-ADR-02 D1/D4/D7/D8, plan §6.1, the implementation and cited QA rows. The guide is unchanged at integration `4e453a7c`. Private clone: `9be35f812384981159617fb7c7475d32f3c8a694`.

Four findings: **3 BLOCKER, 1 MAJOR, 0 MINOR**.

### A-LA-E8-01-01 — BLOCKER — The migration list can omit live affected platforms and cannot clear disconnected rows

- **File:** `docs/guides/ltiaas/add-a-channel.md:214`; also `:218`, `:220`, `:221` and `:297`.
- **Problem:** The family comparison is case-sensitive, but the launch guard is not. An empty list therefore does not prove that it is safe to ship the guard. Conversely, the list includes inactive platforms, so the prescribed disconnect does not remove a matching row and cannot satisfy the final empty-list check. This fails AC-03.
- **Evidence:** `services/lti-service/src/lti/launch.ts:91` stores the signed family without folding case; `store/platforms.ts:194` retains that value; `lti/checks.ts:254` lowercases the family before checking the guard. A private test used the real in-memory platform API and the exact guide filter: `desire2learn` is listed, while active `DESIRE2LEARN` and `Desire2Learn` platforms are omitted; all three receive `PROVIDER_PROFILE_MISMATCH` from the `standard` launch guard. A second test applied `PATCH active:false`, as `services/cogniate-app/src/kernel/authority/self.ts:57` does on disconnect. The subsequent GET still returned the inactive row and the guide still printed it.
- **Suggested fix:** Compare normalized family codes and define the release condition in terms of **active** affected platforms, with active unknown-family platforms checked by hand. Keep an explicit verification that each migrated old platform is inactive and each replacement works. Update the repeat check and checklist to match; do not delete historical platform rows just to empty the list. Add QA examples for upper/mixed case, inactive rows and a platform with no family.

### A-LA-E8-01-02 — BLOCKER — Copying the generic simulator module registers Moodle twice

- **File:** `docs/guides/ltiaas/add-a-channel.md:235`; also `:236`.
- **Problem:** The chosen template exports two providers. Changing the new LMS configuration leaves its second `moodleSim` provider in `createProviders`, which prevents simulator loading. The stated path cannot reach the AC-02 K1 run.
- **Evidence:** `tests/sim/generic/index.mjs:67` returns both `generic` and `moodleSim`; the existing generic folder remains loaded. In the private clone I copied the module, changed the generic id/family/hosts to a new LMS, and added the matching single host entry. Calling only `loadProviders` with the real runtime failed with `Duplicate simulator provider moodle-sim` at `tests/sim/core/runtime.mjs:195`; no server or stack started. Changing the copied module to return only the new provider made full discovery succeed with seven distinct providers.
- **Suggested fix:** Explicitly remove the copied Moodle configuration and return only the new provider, or start from a single-provider template such as Brightspace. Show the `createProviders` result and include a host-only full-discovery check before asking QA to start a stack.

### A-LA-E8-01-03 — MAJOR — F2 can report success without checking any of the new work

- **File:** `docs/guides/ltiaas/add-a-channel.md:276`; also `:284` and `:300`.
- **Problem:** The guide creates files, then runs the branch-diff command without requiring a commit. F2 compares two commits; it ignores tracked working-tree changes, staged changes and untracked files. A normal pre-commit run can pass even if the new work edits core.
- **Evidence:** `infra/scripts/fitness/channel-diff.mjs:28` invokes `git diff ... <merge-base> HEAD`. In the private clone, a new simulator folder, a changed host manifest and a changed `services/lti-service/src/http/routes/platforms.ts` produced `F2 PASS: core = 0, paths = 0` with the guide command and the starting HEAD as base. Passing those same three paths through the supported `--paths-from` mode produced exit 1 and `F2 FAIL: core = 1, paths = 3`.
- **Suggested fix:** Require all intended changes to be committed on the task branch before this gate, keep a stable starting SHA, and require a clean working tree plus a nonempty report that includes the expected files. Alternatively document a complete working-tree path collection for `--paths-from`. State that `paths = 0` does not certify a new channel.

### A-LA-E8-01-04 — BLOCKER — The K2 instruction requires an edit outside AC-01

- **File:** `docs/guides/ltiaas/add-a-channel.md:280`; also the file boundary at `:88`.
- **Problem:** “QA adds the channel to the U3 cases” is a required check step, but those cases are outside every directory allowed by AC-01. Assigning the edit to QA does not make the guide's claim that every step stays within the listed paths true.
- **Evidence:** The cited E7-07 AC-03 QA row names `tests/e2e/ltiaas/03-u3-new-channels-flow.k2.ts`. That file contains four explicit generic/Brightspace journeys, including fixed integration URLs at lines 63 and 386; a new channel fixture does not add a new journey. Neither this test nor its directory appears in the task's allowed paths or the guide's file table.
- **Suggested fix:** Separate shared U3 test development into an explicitly scoped QA prerequisite, and give the guide a verification step that can run for the new channel without editing shared test files. If that requires a harness change, keep the new-channel K2 check pending that work. Otherwise seek an Architect-approved scope change before claiming AC-01 is satisfied.

### Verification and limits

- The author changed only the permitted guide. The manifest/profile shape, import boundaries, admin-value adapter, registration authorities and registration-level guard match the cited design. The intended order is correctly “move first, then guard”; finding 01 concerns the command that determines whether that move is complete. No secret is embedded in an example and no core LMS identifier was added.
- Sampled all referenced QA task families against their actual AC rows: E1-03, E2-02 through E2-06, E7-02 through E7-04, E7-06 and E7-07. The evidence-label convention identifies the task and qa.md AC row. The guide distinguishes host/unit evidence from SIM and K2, and explicitly marks the pending kit simulator evidence. The corrected migration instructions still need QA verification; the present pending note is not proof that the release check works.
- **2/2 private Vitest probes passed**, demonstrating both migration defects with the exact filter and real API responses. The host script reproduced the simulator-copy failure and F2 false pass, with passing single-provider and failing explicit-core-path controls. These are reviewer diagnostics, not a replacement for QA's scratch-branch AC-02 run.
- Tests ran only in `/tmp/la-reviewer-a-ctx-82756498e9a0`, made with `git clone --no-hardlinks` and its own `npm ci`; its Vitest cache was removed before the run. The clone is clean after removing private probes and restoring temporary edits. Evidence: `/tmp/la-reviewer-a-ctx-82756498e9a0-probes/` (`review-e801.test.ts`, `selector.log`, `host-probes.mjs`, `host-probe-results.json`, `f2-paths.txt`).
- The fixed-five-channel kit limitation at guide line 269 is already disclosed and remains a separate QA prerequisite; this review does not claim that the sixth-fixture host check passes. **AC-LA-E8-01-02 remains pending QA's simulator run.** No Docker, stack, host stack runner, commit or Reviewer-B file was used. Only this review file was changed in the integration worktree.


## Round 2

Reviewer: Codex GPT-6-Astra xhigh, 2026-10-24. Reviewed Docs fix `4a712bc5` (merge `5bb7d8f0`), unchanged at integration `1b1c71f5`. **APPROVE: 0 open BLOCKER, 0 open MAJOR, 1 new MINOR.** All four Round 1 findings are closed.

### Round 1 finding checks

- **A-LA-E8-01-01 — closed.** The list compares both family values in lower case, omits inactive platforms, distinguishes `AFFECTED` from `CHECK`, and gives a reachable completion condition. The move now verifies the new connection and the old platform's `active:false` state. Local fake-data checks of the exact Node snippet confirmed three case variants, an uppercase argument, inactive history, unknown and unrelated families, hand-checked unknowns, and a completed migration with no output. The separate stale-note edge case below does not reopen the original case-folding or inactive-row defects.
- **A-LA-E8-01-02 — closed.** The new template returns exactly `[createProvider(runtime, newlms)]`, with no copied Moodle provider. Its fields match the provider factory. Step 7 explains how to adapt optional protocol tests and gives the correct full-discovery imports and call; `loadProviders` checks every provider and host entry without starting a server. The expected result includes exactly one new id. This round checked that path statically, within the dispatch's fake-data-only execution limit.
- **A-LA-E8-01-03 — closed.** Step 10.1 requires committed files and a clean working tree before F2, identifies the starting base, rejects an empty report as proof, and requires the report to list the committed files. This matches the implementation's merge-base-to-HEAD diff.
- **A-LA-E8-01-04 — closed.** K2 case development is now explicitly a separate QA-E2E task, outside the author path and its file table. The author is no longer told to edit shared browser tests.

### A-LA-E8-01-05 — MINOR — A hand-checked id also hides a newly known affected family

- **File:** `docs/guides/ltiaas/add-a-channel.md:223`.
- **Problem:** `checked.includes(p.id)` skips the row before examining its current family. A saved hand-check can therefore override newer signed family information on a later list run.
- **Evidence:** With one active unknown-family platform passed as a checked id, the snippet correctly prints nothing. Keeping that argument and changing the fake API row to `productFamilyCode: "DESIRE2LEARN"` still prints nothing. The service stores the family at each accepted launch, so the information can change between reads. A control that applies the checked-id exception only to the empty-family branch prints `AFFECTED` for the updated row.
- **Suggested fix:** Skip inactive rows first, always print a matching known family, and suppress `CHECK` only when the still-unknown row is in `checked`. This is nonblocking because the documented procedure permits only ids manually confirmed to be another LMS; the change protects against stale notes without changing that procedure.

### Verification and remaining dependencies

Six local fake-data executions of the exact extracted filter and the restricted-exclusion control passed. Evidence: `/tmp/la-reviewer-a-ctx-7a33b5d7224b-probes/migration-filter.js` and `results.json`. No service, simulator, Docker, stack, package install or commit ran in this round. No Reviewer-B file was opened; only this review file changed in the integration worktree.

The kit discovery/canary claim is expressly pending LA-E7-06 Round 2, and the fixed-six-provider simulator self-test is expressly a QA-owned pending fix. Those changes were not verified here; the checked integration still had the fixed lists. AC-LA-E8-01-02 and the migration procedure's simulator check remain pending QA, as the revised guide says. Only the permitted guide changed, with no product behavior, secret example or new core LMS identifier.


## Round 3

Reviewer: Codex GPT-6-Astra xhigh, 2026-10-24. Reviewed Docs `4b5fc743` and `270df640`, guide at integration `a400c78e`, against the task, kit implementation/README and cited QA Round 4. **CHANGES_REQUESTED: 1 new BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT. A-LA-E8-01-05 is closed; earlier closed findings stay closed.**

### A-LA-E8-01-06 — BLOCKER — The revised K1 command resolves the config from the wrong directory

- **File:** `docs/guides/ltiaas/add-a-channel.md:353`.
- **Problem:** `node tests/acceptance/run-api.mjs` runs from the repository root, but that runner starts Vitest with the relative config `ltiaas/kit/vitest.config.mts` and inherits the working directory (`tests/acceptance/run-api.mjs:13`, `:22–25`). The real config is under `tests/ltiaas/kit/`. The documented command cannot start the required K1 check, so AC-LA-E8-01-02 cannot produce its stated result.
- **Evidence:** The e2e container defaults to `/repo` (`infra/compose.yaml:449`); its entrypoint does not change directory. A local fake repository used the exact runner and a fake Vitest executable that only records/checks the config path. The documented command resolved `<repo>/ltiaas/kit/vitest.config.mts` (absent) and failed. The control `npm --prefix tests run acceptance:api` ran from `<repo>/tests` and found the config. This probe started no tests, services or network requests. The kit README repeats the same incorrect command; matching it does not make the guide command executable.
- **Suggested fix:** From `/repo`, use `LA_RUN_DIR=/tmp/kit-run QA_KIT_CHANNELS=<id> QA_TASK=K1 npm --prefix tests run acceptance:api`, or explicitly enter `/repo/tests` and run `node acceptance/run-api.mjs` with those variables. Ask QA to correct the corresponding kit README examples. Keep the SIM result pending its authorized run.

### Fix checks and limits

- **A-LA-E8-01-05 closed:** checked ids now suppress only unknown-family `CHECK` lines. Eight executions of the exact filter with fake API data pass, including a checked id that later signs the matching family, case variants, inactive rows, unrelated families and a completed move. The prior filter still misses the newly known affected row.
- Step 9 correctly describes the 17 capability fields, optional `coveredBy` evidence, automatic fixture discovery/default selection and source audit. With a sixth fake fixture in `/tmp`, the committed helpers discover/select all six, audit all six, and generate the new fixture's expected cases. The K0 canary uses dynamic counts; QA Round 4 §4.2 records the cited 16/16 full host result, and those kit files are unchanged between `86a50df8` and `a400c78e`. Removing that pending-canary note is supported. The full K0 suite was not rerun here.
- The kit K1-SIM labels, scratch-branch AC-02 run and migration SIM verification remain pending. Only the guide's changed text was reviewed; no product behavior or new core LMS name is added. Evidence: `/tmp/la-reviewer-a-ctx-65622814dac7-probes/` (`migration-filter.js`, `migration-results.json`, `kit-discovery.json`, `command-path-results.json`, fake fixtures/runner). Only local fake data was executed; no Docker, stack, package install, commit or Reviewer-B file was used. Only this review file changed in integration.
