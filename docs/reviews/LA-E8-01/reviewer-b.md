Verdict: APPROVE
Round: 5

## Round 1

Reviewer-B: Can a human team own it? Reviewed `bb9f6d7e`, merged as `0f96658d`, against LA-E8-01, the channel/profile design, plan §6.1 and the named QA evidence. The numbered path, examples, kind-B/new-capability boundary and pending-SIM labels are clear. The following steps prevent a new developer from reaching the stated result.

### B-LA-E8-01-01 — MAJOR — Make the migration completion check reachable

**File:** `docs/guides/ltiaas/add-a-channel.md:211–221`, also line 297.

**Problem:** Disconnecting the old Moodle connection does not remove its platform from the supplied list, so the instruction to reach an empty affected-platform list cannot succeed.

**Evidence:** `services/cogniate-app/src/kernel/authority/self.ts:56–58` disconnects by setting the platform's `active` flag to false and disabling the connection. `services/lti-service/src/store/platforms.ts:136–145` retains and lists that row; neither the API query nor the guide's filter excludes inactive rows. In both bash and zsh, the exact guide pipeline prints the same affected row before and after `active: false`. It also continues to print a no-family platform after a human identifies it as an unrelated Moodle site. Thus the blanket empty-list checklist is not a usable release decision.

**Suggested fix:** Separate active affected platforms from inactive history and from platforms whose family still needs manual review. Give a command and explicit completion condition that can be satisfied after the documented disconnect, while requiring every active unknown-family platform to be checked. Do not direct the operator to delete history merely to make the list empty. Verify the command with active affected, disconnected affected and unrelated no-family examples.

### B-LA-E8-01-02 — MAJOR — Supply a single-provider simulator starting point

**File:** `docs/guides/ltiaas/add-a-channel.md:235–239`.

**Problem:** The instructed source file exports both the generic and Moodle providers; changing the new LMS configuration alone leaves a duplicate Moodle provider and stops discovery.

**Evidence:** `tests/sim/generic/index.mjs` ends with `return [generic, moodleSim].map(...)`. In the private clone, I copied that file, changed the generic provider's id, family and hosts to `review-sixth`, and added the one required host entry. Calling the real `loadProviders` function without starting a server fails with `Duplicate simulator provider moodle-sim`. Returning only the new provider makes the same loader pass, with all six existing providers and exactly one new provider. The copied Brightspace protocol test also has Brightspace-specific exports and constants, so it needs an explicit adaptation instruction.

**Suggested fix:** Show a short single-provider module, or use the single-provider Brightspace file as the starting point. If retaining the generic template, explicitly remove `moodleSim` and return only the new configuration. Name the test imports/constants to adapt and include a host-only discovery check before the stack step.

### B-LA-E8-01-03 — MAJOR — Resolve the known sixth-fixture gate as a prerequisite

**File:** `docs/guides/ltiaas/add-a-channel.md:269`, also lines 278 and 298.

**Problem:** The path promises a passing kit host check within the permitted files, but the disclosed fixed five-channel list makes that check fail for every new channel.

**Evidence:** The focused AC-LA-E7-06-07 host test passes at the review SHA. Adding `tests/ltiaas/kit/channels/review-sixth.json` makes it fail at `kit.k0.test.ts:51`, solely because discovery now returns a sixth id. `ALL_KIT_CHANNEL_IDS` and `loadAllChannelFixtures()` live outside the guide's edit set. The note identifies the problem, but the check table still says "pass" and provides no completed prerequisite. This is a confirmed host failure, distinct from the explicitly accepted pending K1-SIM verification.

**Suggested fix:** Treat this as a blocking QA-owned kit dependency and link its resolution before presenting the path as executable. Have the kit discover the added fixture and include it in its source/capability checks and `all` selection, rather than requiring another fixed-list edit for every LMS. Re-run the host check with a sixth fixture, then update the guide with the verified result. Docs must not edit the QA implementation itself.

### B-LA-E8-01-04 — MINOR — State that F2 needs committed changes

**File:** `docs/guides/ltiaas/add-a-channel.md:276`, also lines 284–288.

**Problem:** The numbered path never tells a new developer to commit the channel changes before the F2 command, which ignores the working tree and index.

**Evidence:** After the new simulator, manifest entry and kit fixture were present in the private working tree, the exact command against its starting SHA printed `F2 PASS: core = 0, paths = 0`. `diffPaths()` compares the merge base with `HEAD` only. The comparison note is accurate, but a successful empty diff does not prove the files just created by this path.

**Suggested fix:** Add an explicit checkpoint to commit the intended task files before F2 and check that the report includes those paths. Alternatively document a complete working-tree path-list check using the supported `--paths-from` mode.

### Verification and boundaries

- Fresh private `git clone --no-hardlinks` at `/tmp/la-e8-01-r1-review-b-5uxd630n/repo`, pinned to `0f96658d78235c47ae2d86101713fb51f2a7d598`, with its own successful `npm ci`. Cleared its Vitest cache before each kit run. No Docker, stack, host stack runner or server listener ran; no commit was made.
- Evidence in the clone's parent folder: `migration-list-proof.json` (four shell/phase cases), `simulator-copy-proof.log`, `simulator-single-provider-proof.log`, `kit-baseline.log` (one pass), `kit-sixth-fixture.log` (the expected failure), and `f2-uncommitted.log`. Temporary source and fixture changes were confined to that clone.
- All relative file links and linked heading anchors resolve. Checked the cited QA rows for channel discovery, traits/defaults, guard behavior, simulator hosts, F2, K0 and browser flows. The pending kit SIM labels accurately distinguish unrun work; this review does not claim AC-02's scratch-branch SIM execution.
- The author diff changes only the permitted new guide. No product code, architecture, other guide or core LMS path changed. There are no UNIT ACs in this documentation task. The QA ownership needed for the kit correction is identified above; integration changes from this review are confined to this file. No other reviewer's file was opened.

Open findings: **0 BLOCKER, 3 MAJOR, 1 MINOR**.

## Round 2

Verdict: **CHANGES_REQUESTED**. Reviewed `4a712bc5`, merged as `5bb7d8f0`. Three findings close; the QA-owned kit prerequisite remains open. No new findings.

| Round-1 finding | Status | Evidence in `docs/guides/ltiaas/add-a-channel.md` |
| --- | --- | --- |
| B-LA-E8-01-01 (MAJOR) | Closed | Lines 208–246: the command checks active platforms, matches the family in lower case, labels known matches `AFFECTED` and unknown families `CHECK`, and accepts the ids manually confirmed to be unrelated. The procedure verifies the new connection and the old platform's inactive state. The final empty result is now reachable without deleting history. |
| B-LA-E8-01-02 (MAJOR) | Closed | Lines 254–300: a complete single-provider template replaces the two-provider copy; test adaptation is explicit. The host-only loader command succeeds with the template and one manifest entry and prints exactly one additional provider id. |
| B-LA-E8-01-04 (MINOR) | Closed | Lines 332–347: record the starting SHA, commit the intended files, require a clean tree, then run F2 and check that its report lists those files. An empty diff is explicitly not proof of the addition. |

### B-LA-E8-01-03 — MAJOR — Still open: the kit prerequisite has not landed

**File:** `docs/guides/ltiaas/add-a-channel.md:328`, also line 350.

**Problem:** The revised text describes fixture discovery and a passing new-fixture canary, but the reviewed repository still has the fixed-list behavior that caused Round 1's failure.

**Evidence:** At `5bb7d8f075a342c5cc57d453ded732f4df8b65c4`, `tests/ltiaas/kit/lib/fixtures.ts:11` still declares five `ALL_KIT_CHANNEL_IDS`; `resolveSelectedChannelIds()` uses that list for `all` (line 189), and `loadAllChannelFixtures()` iterates it (line 201). `kit.k0.test.ts:51` still requires discovered ids to equal those five ids. The source of the reproduced Round-1 sixth-fixture failure is unchanged. The dispatch says QA-4 is fixing this now, and the guide labels the claim pending QA, but neither is evidence that the dependency has been resolved. No kit tests were rerun this round; the permitted execution scope was the guide's snippets with local fake data only.

**Suggested fix / closure condition:** Land the QA-owned discovery change, include its source/capability checks and `all` selection, and supply the new-fixture canary result. Then update or substantiate the guide's statement and close this finding. Until that happens, describe it as a blocking prerequisite rather than an available passing path. This needs coordination with QA, not a Docs edit to a QA-owned file. The pending K1-SIM verification is a separate, already disclosed item.

### Round-2 verification

- Fresh private `git clone --no-hardlinks` at `/tmp/la-e8-01-r2-review-b-izkmfmrs/repo`, pinned to `5bb7d8f075a342c5cc57d453ded732f4df8b65c4`. No dependency installation, test runner, server listener, Docker, stack or commit.
- **22/22 snippet cases passed** in bash and zsh: 16 migration-filter cases cover case variants, inactive history, unresolved families, checked unrelated ids, a completed move, an empty account and invalid/error answers; six discovery cases cover the baseline, the exact new template plus one host entry, and rejection when that entry is missing. Both completion cases fail against the old guide filter, as expected. Evidence: `snippet-review.py`, `snippet-review.log`, `snippet-results.json` and `snippet-summary.json` in the clone's parent folder.
- Checked links resolve; the other-reviewer link was excluded from inspection. The fixed-six simulator self-test is explicitly disclosed and assigned to QA-E2E; it is not the new discovery command, which passed. The guide now keeps K2 changes in a separate QA-E2E task and preserves the author file boundary.
- The author diff changes only the permitted guide. No product behavior, architecture, other guide or core LMS path changed. No UNIT ACs apply to this documentation task. Round 1 remains intact above; integration changes are limited to this report. No other reviewer's file was opened.

Open findings: **0 BLOCKER, 1 MAJOR (B-LA-E8-01-03), 0 MINOR**.


## Round 3

Verdict: **CHANGES_REQUESTED**. Reviewed Docs commits `4b5fc743` and `270df640`, integrated at `a400c78e`, scoped to `docs/guides/ltiaas/add-a-channel.md`. **0 BLOCKER, 1 MAJOR, 0 MINOR, 0 NIT open.** The previous kit-discovery finding closes; one newly changed command has a working-directory defect.

### Previous findings and changed text

- **B-LA-E8-01-03 — Closed.** The committed loader discovers fixture files for both default and `all` selection, and the audit checks each discovered fixture's 17 capabilities and sources. The canary no longer assumes exactly five starting fixtures. In a fresh private clone, adding only `tests/ltiaas/kit/channels/review-six.json` and running the guide's exact K0 command gives **16/16 PASS**, with no suite/shared-list edit. This independently supports the cited LA-E7-06 QA Round 4 evidence and that task's Reviewer-B closure of -06. It does not close that kit's remaining SIM/source findings or LA-H25.
- **B-LA-E8-01-01, -02 and -04 remain closed.** The changed filter also fixes the checked-id follow-up: a checked id suppresses only an unknown-family `CHECK` row; a later signed family match still prints `AFFECTED`. The exact snippet passes **24/24** fake-data checks across bash and zsh, including case variants, checked/unchecked unknowns, inactive history, completed moves and invalid answers. The former filter hides the checked signed-family row in both shells, reproducing the regression.
- Step 9 now names `coveredBy`, all 17 capabilities, the fixture audit and the one-file discovery rule. The retained pending-QA-SIM labels correctly keep host evidence separate from AC-LA-E8-01-02 and the unrun kit simulator rows.

### B-LA-E8-01-05 — MAJOR — The revised K1 command starts the runner from the wrong directory

**File:line:** `docs/guides/ltiaas/add-a-channel.md:353`; supporting code: `tests/acceptance/run-api.mjs:13`, `:22`; container default: `infra/compose.yaml:449`.

**Problem:** The new command is `QA_TASK=K1 node tests/acceptance/run-api.mjs` (with the run-dir and channel settings). This locates the entry point from the repository root, also the `e2e` container's `/repo` working directory. But `run-api.mjs` spawns `node_modules/vitest/vitest.mjs` with `--config ltiaas/kit/vitest.config.mts` and no `cwd`. Those paths are relative to the caller, so it selects `/repo/ltiaas/kit/vitest.config.mts`, which does not exist; the actual config is under `/repo/tests`. Changing to `/repo/tests` without changing the documented command instead makes its entry-point path wrong. A developer cannot reach the required K1 check with this command, independently of the disclosed pending SIM verification.

**Evidence:** Ran the actual entry point locally with `spawn` replaced by a capture stub (no child runner, network or stack). From the documented root, the captured config resolves to missing `repo/ltiaas/kit/vitest.config.mts`. From `repo/tests`, `node acceptance/run-api.mjs` resolves the existing `repo/tests/ltiaas/kit/vitest.config.mts`. The cited kit README repeats the same root-relative command; citing it does not resolve the mismatch.

**Suggested fix:** State the working directory and use, from `/repo` inside the prepared `e2e` container: `LA_RUN_DIR=/tmp/kit-run QA_KIT_CHANNELS=<id> QA_TASK=K1 npm --prefix tests run acceptance:api`. Alternatively, explicitly change to `/repo/tests` and run `node acceptance/run-api.mjs` with those settings. Route the matching README correction to QA; no product change is needed. Keep the SIM result pending until QA runs it.

### Verification and boundary

Private `git clone --no-hardlinks` at `a400c78e`: `/tmp/e8-01-r3-review-b-v6106ssq/repo`, with its own dependencies. Local fake data only: sixth-fixture K0 **16/16**, filter **24/24**, two old-filter negative controls, and the stubbed-spawn directory comparison. Evidence in the parent folder: `kit-sixth-fixture.log`, `sixth-fixture.json`, `filter-new.sh`, `filter-old.sh`, `filter-results.json`, `capture-spawn.mjs`, `documented-spawn.json`, `corrected-spawn.json`, `links.json`. Removed the fake fixture; the private tracked tree is unchanged. Guide link targets resolve; the other-reviewer link was excluded.

The scoped author changes stay in the allowed guide; the other files of `270df640` belong to its separate LA-E8-05 work and were not reviewed here. No UNIT AC applies to this documentation task. No Docker, stack, live request, SIM runner or commit; only this review file was edited in integration, and no Reviewer-A file was opened.

## Round 4

Verdict: **APPROVE**. Reviewed Docs commit `2960639e`, integrated at `e8aacf54`, and the matching QA-owned README command correction integrated at `29fcb01d`. **0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT open; no new findings.**

**B-LA-E8-01-05 — Closed.** `docs/guides/ltiaas/add-a-channel.md:353–355` now states the `/repo` working directory and uses `npm --prefix tests run acceptance:api`. The note explains why the runner needs `tests/` and gives the correct direct-node form after changing to `/repo/tests`. This matches `tests/package.json`, `tests/acceptance/run-api.mjs`, the container working directory, and `tests/ltiaas/kit/README.md:112–125`. The README correction was made by QA. Earlier findings -01 through -04 remain closed.

Independently reran the actual acceptance entry point with a fake Vitest file in a fresh private `git clone --no-hardlinks`, pinned to `e8aacf546b61d98b831ebcccedbff92dd072fc9c`: `/tmp/e8-01-r4-review-b-5vyy8a8m/repo`. Commands were extracted from the guide, with only `<id>` replaced by a fake id. **6/6 probe cases passed** across bash and zsh: both corrected forms exit 0, start in `tests/`, find the existing kit config, pass the expected Vitest arguments, and preserve `LA_RUN_DIR`, `QA_KIT_CHANNELS` and `QA_TASK`. In both shells the old root command resolves the missing root-level config and exits 3, as expected. Evidence in the parent folder: `probe.py`, `fake-vitest.mjs`, `probe-results.json`, `probe.log`, and per-case JSON/log files. The clone's tracked files are unchanged; no dependency installation was needed.

The Docs diff changes only the permitted guide. No product, architecture, core LMS path or other guide changes; no UNIT AC applies. This focused probe validates command startup, not K1 behavior. The guide keeps the real K1-SIM run and AC-LA-E8-01-02 pending QA; this approval does not replace those runs or the separate kit review. No Docker, stack, real test runner, live request or commit. Only this report was edited in integration, and no Reviewer-A file was opened.

## Round 5

Verdict: **APPROVE**. Reviewed walkthrough-fix commit `dc7a1213`, integrated at `77f58f62`, using the dispatched diff from `4052958f`. **0 BLOCKER, 0 MAJOR, 1 MINOR, 0 NIT open.** Thirteen walkthrough findings close; L3 needs one non-blocking wording qualification. Previous findings B-LA-E8-01-01 through -05 remain closed.

### Walkthrough findings

All ids below have prefix `F-LA-E8-01-`; checked against LA-E8-02 QA §3.1 and the cited design/code.

| Finding | Result and evidence |
| --- | --- |
| L1 | Closed: steps 2, 3 and 9 give the manual-only method/field changes, explicit `dynamicRegistration: null`, computed authority map and legacy flag. Matches LA-ADR-02 D2 / BD-A1-83 and the kernel/LTI registry behavior. |
| L2 | Closed: step 5 distinguishes the host-only authoring branch from the operator's pre-release check on each deployed environment. Only a simulated-only LMS gets the recorded N/A exception; the final checklist preserves the migration requirement for real LMSs. |
| L3 | Partial: step 9 explains that guards affect the kit and retains a passing host check; the new guarded-family canary passes. The universal probe statement needs B-LA-E8-01-06 below. |
| L4 | Closed: step 10.2 prints actual per-channel K0 groups. The new id appears with the canary folder and disappears when that folder is removed. |
| U1 | Closed: §0.4 gives simulator defaults and requires `design` / `UNVERIFIED (simulated only)` labels, consistent with the provider template. |
| U2 | Closed: step 2 follows LA-ADR-01 D3, LA-ADR-05 D3b and LA-ADR-08 D4. Unknown multi-select support stays false; both capability and launch permission are required. Connection check is `setup.connectionCheck`, not an invented `ops` capability. |
| U3 | Closed: dynamic binding fields are conditional on the dynamic method. |
| U4 | Closed: step 4 keeps launch guard effects for a manual-only LMS and permits an empty guard list when no distinct family is known. |
| U5 | Closed: the stale fixed-provider warning is removed; the exact simulator self-test command passes with the new provider. |
| U6 | Closed: step 7 explicitly chooses its single-provider template over the older generic-copy instruction in the simulator README. |
| U7 | Closed: step 7 distinguishes optional D2L-specific protocol assertions from the checks applicable to the template. |
| U8 | Closed: the guide uses “all tests pass, 0 failed” instead of a changing test total, as the Lead directed. |
| U9 | Closed: same observable channel-id check as L4. |
| U10 | Closed: step 11 explicitly skips the separate admin guide for a simulated-only LMS and explains the absence of a docs path in F2. |

### B-LA-E8-01-06 — MINOR — Qualify the L4 probe-selection statement

**File:line:** `docs/guides/ltiaas/add-a-channel.md:370`.

**Problem:** The sentence says a new guard adds a `registration_guarded` / `warn_passthrough` probe for its family to **every other channel**. The kit selects one foreign registration-level family per target, and the expected result depends on the target's authority. The sentence follows `DOCS-E801w.md` item 3, but that brief also needs this qualification; no kit behavior change is requested.

**Evidence:** `tests/ltiaas/kit/lib/fixtures.ts:1724` selects the first eligible foreign family; `:1695–1712` expects refusal for a target with manual `self` authority, warning/pass-through otherwise. With the added `reviewwalk` family, the real selector chooses it for Brightspace; Moodle, Canvas, Blackboard and `lti-generic` still select `desire2learn`. Moodle's registration-level outcome is `refuse` / 400, including when the new family is supplied directly. Step 4 already describes the Moodle refusal correctly. This affects the explanation, not execution of the guide.

**Suggested fix:** Say that a new guard participates in the kit's cross-channel probe selection and can add/change the registration-level probe. Preserve the target-dependent outcome: Moodle `standard` refuses; other targets warn and pass. Avoid promising a separate new-family probe for every target.

### Verification and boundary

Fresh private `git clone --no-hardlinks` at `/tmp/e8-01-r5-review-b-9m28n06o/repo`, pinned to `77f58f624ce2a5a35d8f6dc2213ec5185039d5df`, with its own successful `npm ci`. Added a manual-only sixth channel, the exact guide simulator template, one host entry and one fixture guarding a new family. No shared suite/list edit. Cleared the private Vitest cache before each Vitest command.

- Exact discovery command: seven providers, including only one new `review-walk-sim`.
- Exact simulator self-test command: **59/59 PASS**.
- Exact K0 listing pipeline, with shell `pipefail`: exit 0 and all six channel ids, including `review-walk`. Without the channel folder: exit 0, five baseline ids and no temporary id.
- Exact kit host command: **26/26 PASS**, including the guarded-family addition. Direct kernel computation matches all 17 fixture capabilities and all six legacy flags; the real L4 selector supplies the evidence above.

Evidence in the parent folder: `commands.json`, `command-results.json`, `simulator-discovery.log`, `simulator-selftests.log`, `channel-list.log`, `channel-list-without-canary.log`, `kit-host.log`, `capability-and-guard-probe.json`, and `probe-inputs/`. Removed only the probe additions and restored the private host manifest; the clone is clean.

The earlier migration filter is byte-for-byte unchanged, the corrected K1 invocation and F2 commit checkpoint remain, and the added-channel kit and simulator checks pass. All 33 checked local guide link targets resolve (Reviewer-A excluded). The changed text introduces no new citation to the kit's changing R3/play-retry instructions. The author changed only the allowed guide; no product, architecture or core LMS path changed, and no UNIT AC applies to this documentation task. No Docker, stack, live-LMS request or commit. Only this review file was edited in integration; no Reviewer-A file was opened. Pending QA-SIM labels remain and receive no runtime credit from this review.
