Verdict: CHANGES_REQUESTED
Round: 1

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
