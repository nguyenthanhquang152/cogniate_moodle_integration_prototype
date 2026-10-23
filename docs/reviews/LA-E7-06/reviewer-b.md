Verdict: CHANGES_REQUESTED
Round: 4

## Round 1

Reviewer-B: Codex GPT-6-Astra xhigh. Lens: can a human team own the kit?
Reviewed commit `1fd9aacc5273b0b00a1790f0af633fb2fcd9c9df` against the task spec, `tests/ltiaas/TEST-STRATEGY.md` §§2.4–2.6, and plan §6.1. **4 BLOCKER, 2 MAJOR, 0 MINOR, 0 NIT.**

The per-port file layout and the acceptance selector are clear. The selector preserves separate M1 and LA runs, and the new suites import the existing helpers. However, the certification summary can accept absent evidence, several required cases have been replaced by different cases with the same IDs, and adding a fixture still needs shared code changes. A green K0 run does not establish that the kit enforces its pass rule.

### B-LA-E7-06-01 — BLOCKER — `coveredBy` uses invented PASS results

**File:line:** `tests/ltiaas/kit/lib/fixtures.ts:603`, `tests/ltiaas/kit/suites/k-hyg.k1sim.test.ts:44`.

**Problem and evidence:** `DEFAULT_WAVE_PASS_RESULTS` assigns PASS to T3b, T7 and T8. The evaluator uses it when evidence is omitted, and H2 explicitly supplies it on every run. No current-wave result is loaded. With the Moodle fixture and a complete synthetic kit execution, omitting all frozen-suite evidence returns `ok: true`; passing an empty evidence map returns `ok: false`. The shipped K0 test exercises an explicit failure map but misses the actual runner's unconditional success map. Thus AC-05 can report PASS when the named suites have not run, are pending, or failed.

**Suggested fix:** Remove the PASS default. Require explicit evidence tied to the current wave for every `coveredBy` suite, with an artifact reference. Missing, stale, pending or failed evidence must prevent certification. Add host tests for those states and explain who produces the evidence and how the kit consumes it.

### B-LA-E7-06-02 — BLOCKER — case IDs no longer mean the design cases

**File:line:** `tests/ltiaas/kit/lib/fixtures.ts:293`, `tests/ltiaas/kit/suites/k1-launch.k1sim.test.ts:186`, `tests/ltiaas/kit/suites/k1-ags.k1sim.test.ts:165`, `tests/ltiaas/kit/suites/k1-dl.k1sim.test.ts:152`.

**Problem and evidence:** The expected list and K0 checks agree with the implementation's replacement cases, rather than the required cases in TEST-STRATEGY §2.4. Examples:

| Design requirement | What the kit records instead |
| --- | --- |
| Launch L9: two libraries on the same channel stay apart; L10: platform-storage HTTP behaviour and refusal order | L9 checks custom claims; L10 checks privacy. Neither tests library isolation or storage. |
| AGS A4: staff preview sends nothing; A5: disabled connection sends nothing; A6: off-origin service URL refusal | A4 calls the direct score API for 429; A5 checks conflict; A6 lists line items with a limit. The required negative flows are absent. |
| DL D5: `accept_lineitem: false` rejects a graded item and shows `PLACEMENT_NOT_GRADED` for a channel without ungraded content | The kit's D6 expects a successful pick and an item without `lineItem`, even for the baseline fixtures whose `content.ungraded` is false. |

The last example also contradicts the pinned product's picker rule (`services/cogniate-app/src/tool-pages/picker.ts:122`, `:187`). This is a source-level defect; no live run was attempted. Launch family-guard and deployment cases, learner-DL refusal, distinct response nonces, and the full AGS status mapping also need reconciliation with the design. `L-FAULTS` currently runs inside every channel loop although the design specifies the full matrix once. Marking L9 N/A from `sim.supportsCustomClaims` also creates an exclusion outside the capability/C2 rule.

**Suggested fix:** Map every design case to its assertions and applicability before updating the expected list. Preserve the design IDs, or publish an explicit complete mapping if cases are split. Restore the missing flows and the specified negative oracles; do not weaken product behaviour to satisfy the replacement tests. Check registration and NRPS against the same table as part of that reconciliation. K0 should validate this independent catalog, and a removed required case must be detected.

### B-LA-E7-06-03 — BLOCKER — C1 treats missing API capability maps as optional

**File:line:** `tests/ltiaas/kit/lib/fixtures.ts:497`, `:526`, `:548`; `tests/ltiaas/kit/suites/k1-cap.k1sim.test.ts:72`.

**Problem and evidence:** Each provider/connection capability map is optional and compared only when truthy. The live suite checks that the provider row exists, then casts its fields without checking their presence. A provider and connection response that omit both `channelCapabilities` and the six legacy flags therefore pass C1 if the manifest and tool keys match. A host probe set all four API fields to `undefined` and received `{ ok: true, errors: [] }`. Existing missing-key probes remove a key from a present map; they do not catch a missing map. This defeats AC-04's bilateral equality requirement.

**Suggested fix:** Require these maps in the live comparison and reject absent, null or malformed values before comparing keys. If manifest-only K0 comparison is useful, expose it as a separate operation so an omitted live DTO cannot silently select that mode. Add negative tests for whole-field absence in both API responses.

### B-LA-E7-06-04 — MAJOR — run state loses failures and has no enforced final phase

**File:line:** `tests/ltiaas/kit/lib/runtime.ts:150`, `:162`, `:208`; `tests/ltiaas/kit/vitest.config.mts:47`; `tests/ltiaas/kit/suites/k-hyg.k1sim.test.ts:31`.

**Problem and evidence:** The fixed JSONL files are appended to, `resetKitRunState` has no caller, and records contain no run identity. `readAllExecutedCases` retains only the last record for an ID. In a host probe, FAIL followed by PASS correctly fails when passed directly to the evaluator, but the same records written and read through the actual state helpers yield PASS. Reusing `LA_RUN_DIR` can also retain a previous PASS for a case that does not finish in the current run. Suites write records only after success, while H2 hardcodes `skippedCount: 0`.

The config comment promises suite order, but an include array plus `fileParallelism: false` does not enforce it. The installed Vitest default sequencer sorts using cached failures/duration or file size; `sequencer: undefined` leaves that policy in effect. HYG therefore has no guaranteed post-suite position. These behaviours make rerun and failure diagnosis unreliable, contrary to the fresh-run and flake rules in §2.6.

**Suggested fix:** Establish a fresh run identity and initialize state once. Collect actual pass, fail and skip outcomes, retain failure history, and reject duplicate execution where the rule requires once. Run hygiene and summary generation in an explicit final phase after all suites. Emit the failure summary even when certification fails. Add a host test for persisted FAIL→PASS, stale-state reuse, missing/skipped cases and final-phase ordering.

### B-LA-E7-06-05 — BLOCKER — hygiene passes without required inputs

**File:line:** `tests/ltiaas/kit/lib/runtime.ts:89`, `:953`, `:970`; `tests/ltiaas/kit/suites/k-hyg.k1sim.test.ts:23`.

**Problem and evidence:** The scan reads `/__sim/secrets` as its secret dictionary but never reads simulator records. Missing/unreadable service logs become empty strings. Artifact scanning covers only immediate files in `LA_RUN_DIR`; nested evidence is skipped, and no artifact directory is scanned when that variable is absent. A positive secret count does not prove that any required source was read.

Host-only probes evaluated the unchanged scanner with synthetic secrets and stubbed network imports: missing service logs returned `ok: true`; the simulator records endpoint was never requested; a leak in `LA_RUN_DIR/evidence/redacted.json` returned `ok: true`. A control with the same leak in a top-level artifact was caught. Thus AC-06 can certify a scan that omitted required evidence.

**Suggested fix:** Enumerate and validate required sources, fetch simulator records, and scan the declared redacted artifact tree recursively. Fail when required input cannot be obtained, including the secret dictionary. Keep raw secret capture files explicitly excluded. Record the scanned-source inventory and add negative tests for missing inputs and leaks in each source type.

### B-LA-E7-06-06 — MAJOR — the one-fixture onboarding workflow is incomplete

**File:line:** `tests/ltiaas/kit/lib/fixtures.ts:11`, `:186`, `:200`; `tests/ltiaas/kit/kit.k0.test.ts:52`; `tests/ltiaas/kit/README.md:13`.

**Problem and evidence:** `all` and `loadAllChannelFixtures` use a hardcoded five-ID list, while K0 requires discovered files to equal that list. Adding only a sixth fixture breaks K0 and leaves the channel out of `all`. A temporary six-fixture directory was discovered as six files but loaded as five fixtures. TEST-STRATEGY §2.5 promises one kit fixture for a new channel, with no shared suite edit.

The README provides layout and two commands, but no procedure for creating/source-checking a fixture, preparing the simulator dependency, supplying wave evidence, interpreting missing/extra/C2 failures, or finding the result artifacts. A new owner must reverse-engineer the 725-line fixture helper and 1001-line runtime to operate this workflow.

**Suggested fix:** Use fixture discovery for the all-channel loader and audit while preserving the intentional three-channel default. Add a canary fixture test proving that one new file joins discovery without changing shared lists. Document the ordered onboarding/run workflow, required fields and design citations, N/A/`notBuilt`/`coveredBy` rules, evidence inputs, result paths, and concrete failure examples.

### Verification and scope

- Private `git clone --no-hardlinks`, detached at the reviewed pin, with dependencies installed only there. Shipped host command: `LA_LEVEL=k0 npx --no-install vitest run --reporter=verbose --config tests/ltiaas/kit/vitest.config.mts`: **8/8 PASS**, including the missing/extra array probes, fixture audit, equality checks and suite neutrality check.
- Additional host probes evaluated the pinned TypeScript helpers with acceptance/network imports stubbed: **8 corrective predicates failed, 5 controls passed**, as detailed above. Probe source: `/tmp/reviewer-b-e706r1-probes.cjs`; output: `/tmp/reviewer-b-e706r1-probes.log`; shipped K0 log: `/tmp/reviewer-b-e706r1-k0.log`. These are local diagnostics, not K1-SIM evidence.
- The task diff stays within the permitted kit, selector and QA-report paths. No product, frozen suite or simulator files were changed. No Docker, stack, host stack runner or K1-SIM suite was run; the pending live ACs remain pending.
- Blind review maintained. Only this review file was edited in the integration worktree; no commit was made.

## Round 2

Verdict: **CHANGES_REQUESTED**. Reviewer-B: Codex GPT-6-Astra xhigh. Reviewed `1fd9aacc..c1bf5c7a0e7d5e92bdeae00279b346fd4a0111c8` (QA fix `5dcb2406`) against the task, TEST-STRATEGY §§2.2–2.6 and plan §6.1. **3 BLOCKER, 3 MAJOR, 0 MINOR, 0 NIT open.**

The new ledger, explicit sequencer and required hygiene inputs improve the kit. However, the fix also replaces the shared M1 clients with a separate runtime that does not follow the supported API contracts. The host self-tests pass, but do not establish that the live suites can complete setup or enforce the required outcomes.

### Round 1 disposition

| Finding | Result |
| --- | --- |
| B-LA-E7-06-01 | **Open, partial fix.** No default PASS; absent manifests and explicit stale/failed entries now fail. Artifact references and independent current-wave identity remain unchecked. |
| B-LA-E7-06-02 | **Open, partial fix.** Catalog IDs are restored, L-FAULTS/N2 are global, and D5/D6 are present. Several bodies still omit the required assertions. |
| B-LA-E7-06-03 | **Closed.** The pure comparator rejects missing, null and array capability maps. K0 has negative whole-field controls. The new live DTO mismatch is covered by -07. |
| B-LA-E7-06-04 | **Open, partial fix.** Fresh run IDs, retained duplicates/failures, FAIL-before-rethrow, skip handling, final suite order and failure summaries are implemented. The full-run evaluator still drops records outside selected channels. |
| B-LA-E7-06-05 | **Closed.** The scanner requires inputs, scans simulator records and recurses into evidence; K0 tests missing inputs and planted leaks. The new log-reader wiring problem is covered by -07. |
| B-LA-E7-06-06 | **Open, partial fix.** Discovery and the onboarding guide improve. The shipped K0 audit still requires exactly five fixtures, so the promised one-file addition fails. |

### B-LA-E7-06-07 — BLOCKER — the replacement runtime cannot drive the supported contracts

**File:line:** `tests/ltiaas/kit/lib/runtime.ts:1`, `:614`, `:657`, `:726`, `:756`, `:931`, `:977`, `:1014`; `tests/ltiaas/kit/lib/fixtures.ts:339`; `tests/ltiaas/kit/suites/k1-cap.k1sim.test.ts:43`.

**Problem and evidence:** The task explicitly requires `kit/lib` to import the M1 helpers, never copy them. Round 2 removes those imports and implements authentication, publication, operator CLI, HTTP and launch clients again. These implementations disagree with the contracts and existing helpers:

| New kit behaviour | Supported contract/helper |
| --- | --- |
| `createStaffSession` signs a fabricated `cogniate_staff_session` token for a random library. Every per-channel setup uses it for its first course request. | `POST /app-api/session` issues the database-backed `__Host-cog_session`; other app API calls require it (`cogniate-app-api.md:32`, `:43`; `M1/common/client.ts:63`). The fabricated cookie cannot authenticate that request. |
| LTI admin calls send `x-service-api-key`; launch-token calls send `Bearer <ltik>`. | Admin uses Bearer API key; launch/service APIs use `LTIK-AUTH-V2` / `SERVICE-AUTH-V1` (`lti-service-api.md:41`, `:50`; `M1/common/client.ts:49`). |
| Publication calls `/app-api/courses/:id/publish` without uploading a version or selecting a connection. | Create/upload a course, then `POST /app-api/publications` (`cogniate-app-api.md:629`; `M1/common/course.ts:25`). |
| Login uses a random library ID as the tool account; launch posts to `/lti/launch` without an account. | Both protocol routes require the tool-account segment (`lti-service-api.md:111`, `:125`; the acceptance account is `cogniate`). |
| Grant execution uses workspace `@cogniate/app` and parses a `cgg_` code. | The workspace is `@cogniate/cogniate-app`; the existing host bridge parses a 43-character approval code (`services/cogniate-app/package.json:2`; `M1/common/client.ts:114`). |
| C1 reads `.providers[].id`; hygiene reads only `$LA_RUN_DIR/*.log` or its `logs/` child. | Provider DTO uses `.lms[].lms` (`cogniate-app-api.md:240`). Shared log helpers use `QA_LOGS_DIR` / `infra/.logs` and `.jsonl` files (`tests/acceptance/lib/paths.ts:27`). |

The first mismatch blocks setup before the case assertions. Fixing only that cookie would leave the later requests incompatible. The CLI argument K0 test checks added flags but cannot detect the wrong workspace, code parser or execution bridge. These are source/contract findings; no live execution is claimed.

**Suggested fix:** Restore thin adapters around the existing public M1/acceptance helpers, preserving fixture-driven channel choices. Check every new request and DTO against the public contracts, including grade completion/results and registration routes. Add host adapter controls for the request shapes and response parsing. Keep live verification pending until the repaired suites run in their booked lane; do not change product APIs to match this runtime.

### B-LA-E7-06-01 — BLOCKER — wave evidence can still certify missing or stale results

**File:line:** `tests/ltiaas/kit/lib/runtime.ts:277`, `:336`; `tests/ltiaas/kit/lib/fixtures.ts:930`, `:1101`; `tests/ltiaas/kit/suites/k-hyg.k1sim.test.ts:50`, `:111`.

**Problem and evidence:** `loadWaveEvidenceFromRun` reads only the operator-written manifest. `artifactPath` is tested only as a non-empty string; its target is never read. In host probes, a complete synthetic run passed with all three artifact paths missing, and also with those paths containing failed results while the manifest said PASS. The shipped positive K0 control likewise supplies paths without creating their artifacts.

Both HYG callers use `LA_WAVE_ID ?? waveEvidence.waveId`, and the evaluator has the same fallback. With `LA_WAVE_ID` absent, an old manifest supplies its own definition of the current wave and passes. An explicit different current-wave ID correctly fails, but this does not protect the actual fallback. AC-05 still cannot establish that the named suites passed in the same wave.

**Suggested fix:** Require a current-wave identity supplied independently by the run. Resolve each reference and validate an agreed result artifact format, including suite, wave and successful outcome; a missing/unreadable artifact must fail. If an evidence aggregation step produces this manifest, make that step validate the artifacts and make its provenance explicit. Add controls for omitted current-wave identity, missing references and contradictory results.

### B-LA-E7-06-02 — BLOCKER — restored case titles still overstate their assertions

**File:line:** `tests/ltiaas/kit/suites/k1-cap.k1sim.test.ts:101`; `tests/ltiaas/kit/suites/k1-ags.k1sim.test.ts:161`; `tests/ltiaas/kit/suites/k1-launch.k1sim.test.ts:265`.

**Problem and evidence:** TEST-STRATEGY §2.4 requires observable outcomes, not only the corresponding IDs. Even after repairing -07, these cases would not detect required regressions:

- **C2:** `registration.dynamic` accepts any status at least 400, including an unrelated route error. `setup.artifacts` reads successful tool configuration and checks that a JSON row is absent, without invoking the artifact refusal. No branch checks `details.capability`, and the suite has no zero-simulator-call / no-`outbound_request` oracle required for these negative guards. Such a C2 PASS is then used to authorize N/A coverage.
- **A3:** The title includes `204 → sent`, but its body never runs a 204 scenario. The 503 and 429 checks search the whole response for `pending` or `throttled`; neither checks the affected sync row's tries, despite comments promising `tries >= 1` and `tries === 0`. The 429 case does not establish the Retry-After pause. Wrong row matching, a counted throttle attempt or a missing successful mapping can survive these assertions.
- **L7:** Two contextless launches opening a player do not prove one shared placement. There is no grade commit/dispatch assertion to the launch line item, no placement-count check, and no “no gradebook column” result check for the no-AGS case (AP-05-08–11). The title claims all of these cases.

**Suggested fix:** Complete a design-case-to-assertion map and implement each required oracle. Use the shared grade/result helpers to select and wait for the exact row, and use simulator cursors plus logs for negative outbound checks. Add focused mutants/negative controls that remove the behaviour being certified; a catalog-presence test alone does not prove coverage. Apply the same check to conditional assertions in registration and NRPS.

### B-LA-E7-06-04 — MAJOR — the final evaluator ignores extra failed channel records

**File:line:** `tests/ltiaas/kit/lib/runtime.ts:324`, `:347`, `:379`; `tests/ltiaas/kit/lib/fixtures.ts:929`.

**Problem and evidence:** The full-run evaluator visits each selected fixture and then `GLOBAL`. Each channel evaluator filters out other channel IDs. There is no check that every input record belongs to one of those sets. A host probe appended one current-run FAIL with an unselected channel ID to an otherwise complete ledger: the report returned `ok: true`, `totalFailed: 0`. The same extra FAIL under a selected channel correctly failed. Thus a stale selection or mislabeled channel can leave an executed failure outside the final accounting, despite AC-02's extra-case rule.

**Suggested fix:** Validate the entire ledger against the expected full-run case IDs and selected channels before partitioning. Reject unknown channel IDs and count all failures/skips. Add disk-ledger controls for extra PASS, FAIL and SKIP records on an unselected channel, alongside the existing selected-channel probes.

### B-LA-E7-06-06 — MAJOR — adding one fixture still breaks the host audit

**File:line:** `tests/ltiaas/kit/kit.k0.test.ts:102`, `:104`, `:106`; `tests/ltiaas/kit/README.md:28`.

**Problem and evidence:** The new loader discovers a sixth fixture, but the real audit still asserts `ids === BASELINE_CHANNEL_IDS` and `fixtures.length === 5`. In the private clone, adding only `channels/review-canary.json` made the unchanged host command fail at line 104: **9 PASS, 1 FAIL**. Its separate temporary-directory “sixth fixture” test still passed in that same run. The README's zero-shared-list-edit workflow therefore remains false at the certification entry point.

**Suggested fix:** Require the baseline entries to remain present in order, then audit every discovered fixture without a fixed total. Exercise the actual audit with an added fixture, rather than testing discovery alone. The expanded guide can remain.

### B-LA-E7-06-08 — MAJOR — documented level names silently disable all live suites

**File:line:** `tests/ltiaas/kit/vitest.config.mts:53`; `tests/ltiaas/kit/lib/runtime.ts:105`; `tests/ltiaas/kit/suites/k-hyg.k1sim.test.ts:21`.

**Problem and evidence:** The config accepts `LA_LEVEL=k1sim` and `all`, but `isK1SimEnabled` accepts only `k1-sim` unless a separate `QA_TASK` or `QA_KIT_RUN` flag is set. Every live suite, including HYG, selects `describe.skip` from that predicate. Host probes with only either accepted level returned false. Consequently those supported selections skip the certification phase and its no-skip/final-summary checks. The advertised `QA_TASK=K1` wrapper does enable them; the defect concerns the other accepted selectors.

**Suggested fix:** Share one mode parser between config and suites, including defaults and accepted aliases. Reject inconsistent selectors before suite registration. Add a host matrix for k0, k1sim, all and QA_TASK defaults; assert that any selection containing K1 also enables HYG. No SIM execution is needed to test the parser.

### Verification and scope

- Used a private `git clone --no-hardlinks`, detached at `c1bf5c7a0e7d5e92bdeae00279b346fd4a0111c8`; installed dependencies there only. Shipped `LA_LEVEL=k0 npx --no-install vitest run --reporter=verbose --config tests/ltiaas/kit/vitest.config.mts`: **10/10 PASS**. Log: `/tmp/reviewer-b-e706r2-k0.log`.
- Pinned-source host probes blocked HTTP and child-process execution: **7 corrective predicates failed, 9 controls passed**. Source: `/tmp/reviewer-b-e706r2-probes.cjs`; output: `/tmp/reviewer-b-e706r2-probes.log`. These establish helper behaviour, not K1-SIM results.
- A sixth-file probe in the private clone ran that same host command: **9 PASS, 1 FAIL** at the fixed baseline assertion. Log: `/tmp/reviewer-b-e706r2-canary.log`. Removed the canary afterward; clone tracked files remained unchanged.
- The reviewed diff stays within kit and QA-report ownership. The acceptance selector is unchanged in this fix; no product, frozen suite or simulator path was edited. The host neutrality check passes. Required live ACs remain **pending**; no Docker, stack, host stack runner or K1-SIM suite was run.
- Blind review maintained. Only this review file was edited in the integration worktree; no commit was made. Other agents' existing changes were left alone.

## Round 3

Verdict: **CHANGES_REQUESTED**. Reviewer-B: Codex GPT-6-Astra xhigh. Reviewed QA fix `cfcdc0ca` at integration pin `af36ad31ddb3defa161d696d569b09185cbf46ac`, using the scoped diff from `c1bf5c7a`, against the task, TEST-STRATEGY §§2.2–2.6 and plan §6.1. **3 BLOCKER, 1 MAJOR, 0 MINOR, 0 NIT open.** These are retained findings; no new finding ID is added.

The shared clients, full-ledger accounting and level selection are improved. However, a team still cannot run the documented kit against the supported contracts, and the green host checks do not establish the required case outcomes. Live K1-SIM evidence remains pending.

### Round 2 disposition

| Finding | Result |
| --- | --- |
| B-LA-E7-06-01 | **Open, partial fix.** Independent wave identity and existing, readable, current-wave PASS artifacts are now required. An artifact without a suite identity can still certify every named suite. |
| B-LA-E7-06-02 | **Open, partial fix.** C2 now checks the capability error and absence of outbound calls. A3 and L7 have more assertions, but the contract errors below prevent them from running, and L4/L7/L9 still do not prove their design requirements. |
| B-LA-E7-06-04 | **Closed.** The full-run evaluator rejects unselected/unknown channel records and counts their failures. Host controls confirm rejection and `totalFailed: 1`; earlier duplicate, stale, skip and final-order protections remain. |
| B-LA-E7-06-06 | **Open, partial fix.** The main audit accepts discovered additions. Its canary test still fixes the total and expected IDs, so adding a real sixth fixture breaks K0. |
| B-LA-E7-06-07 | **Open, partial fix.** M1/acceptance imports, authentication, publication and log paths are restored. The adapters and suite callers still send or read incompatible contract shapes. |
| B-LA-E7-06-08 | **Closed.** Config/runtime mode semantics now agree for the supported aliases and defaults. Live suites no longer independently select `describe.skip`; the host mode matrix and alias probes pass. |

B-LA-E7-06-03 and -05 remain closed. The strict capability comparator and required recursive hygiene inputs are retained; service logs now use the shared `LOGS_DIR` and `.jsonl` paths.

### B-LA-E7-06-07 — BLOCKER — restored imports still have incompatible callers

**File:line:** `tests/ltiaas/kit/lib/runtime.ts:1029`, `:1055`, `:1077`, `:1182`, `:1218`; `tests/ltiaas/kit/lib/fixtures.ts:331`; `tests/ltiaas/kit/suites/k1-cap.k1sim.test.ts:76`; `tests/ltiaas/kit/suites/k1-ags.k1sim.test.ts:182`.

**Problem and evidence:** Importing the frozen clients repairs transport, but does not repair these request and response contracts:

| Kit caller | Supported contract and consequence |
| --- | --- |
| `setupChannelBinding` omits `fixture.simProfile`; manual endpoint fields are `authUrl` / `tokenUrl`, and redemption sends `approvalCode`. | Connections need the simulator profile selection. The strict manual body uses `authenticationEndpoint`, `accessTokenEndpoint` and `grantCode` (app API §4.2; LA app API delta §3.3). A host capture for Canvas has no profile or `grantCode` and has the unknown `approvalCode` field. Setup cannot establish the intended binding. |
| C1 reads `connRes.json.connection`, `toolCfgRes.json.fields` and `.channel.capabilities`. Its manifest loader defaults to `packages/lms-channels/channels/<id>/manifest.json`. | The connection DTO is flat, tool configuration is an array, and both capability maps are top-level `channelCapabilities`; `channel` is a string (app API §4; delta §§1–2). The repository has `packages/channels/<id>/manifest.ts`. The actual loader throws for Canvas on the reviewed tree. C1 cannot reach its otherwise strict comparison. |
| A3 casts `waitSync(...)` to result rows and calls `.find(...)`; several cases select `learner.subject` and a top-level `resourceLinkId`. | Frozen `M1/common/course.ts:74` returns one sync object. The results contract uses `learner.sub` and `activity.resourceLinkId` (app API §5, ResultRow). A host evaluation of the frozen helper returns `{ status: 'sent', ... }`, not an array; the first A3 mapping would fail at `.find`. |
| `openPickerOnChannel` fetches the launch location once and returns that location as the picker URL. | The launch location is a handoff which redirects to the picker. Frozen `M1/common/course.ts:89` follows both steps. With a contract-shaped handoff, the kit returns 303 and the handoff URL instead of the 200 picker page. |
| Dynamic Registration asserts that `registrationUrl` contains `/tool/register?token=`. | The connection contract returns `/lti/register/cogniate?ref=...` (app API §4). The helper rejects the valid registration URL before the handshake. |

The new K0 “documented contracts” check (`kit.k0.test.ts:932`) searches source strings for imports and assertions. It passes with these incompatible calls present. It therefore does not establish that a valid response can pass the suite.

**Suggested fix:** Audit each adapter and caller against the public contracts and frozen helpers. Preserve simulator profile selection, strict request keys, DTO shapes and redirect steps. Add host contract tests that execute the adapters with valid responses and inspect captured requests; avoid unchecked casts that hide incompatible return types. Keep product APIs unchanged and keep live verification pending until the repaired suites run in their booked lane.

### B-LA-E7-06-01 — BLOCKER — unnamed evidence still certifies named frozen suites

**File:line:** `tests/ltiaas/kit/lib/fixtures.ts:1074`; `tests/ltiaas/kit/README.md:52`.

**Problem and evidence:** `verifyWaveSuiteArtifact` compares `parsed.suite` only when the field is present. A host probe referenced one file containing only `{ "waveId": "current-wave", "outcome": "PASS" }` for T3b, T7 and T8. With a complete synthetic Moodle case ledger, the pass rule returned `ok: true`. Naming that same artifact `T3b` correctly rejects its use for T7/T8. Missing independent current-wave identity and an artifact with FAIL now correctly fail, so those parts of the previous finding are fixed. The remaining acceptance still does not establish that each named suite passed, as AC-05 requires.

The guide describes the manifest but not the new artifact schema or the requirement that references resolve inside `LA_RUN_DIR`. Its absolute-path example does not explain that restriction. A new operator must read the validator to prepare accepted evidence.

**Suggested fix:** Require the artifact's suite identity to match the named suite, along with its wave and outcome. Add the anonymous/reused-artifact negative control. Document the artifact format, producer and directory rule so a team can supply real suite results without reverse-engineering the implementation.

### B-LA-E7-06-02 — BLOCKER — some expanded cases still miss their required oracle

**File:line:** `tests/ltiaas/kit/suites/k1-launch.k1sim.test.ts:187`, `:283`, `:304`, `:409`; `tests/ltiaas/kit/lib/runtime.ts:1020`.

**Problem and evidence:** Even after -07 is repaired, these cases do not establish TEST-STRATEGY §2.4's required outcomes:

- **L4:** The case chooses its expected result from the actual status: any 400 with `PROVIDER_PROFILE_MISMATCH` passes, otherwise 303 plus a log passes. It never derives refusal versus log-only behaviour from the selected family guard and target profile. A regression that swaps those policies can pass.
- **L7:** The score check verifies learner and values but not the target launch line item. The two result rows are checked for the requested resource-link ID, without a placement identity/count assertion. Duplicate placements for that same ID can survive those checks. The second generic `waitSync(..., 'sent')` can also match the first learner's existing sync.
- **L9:** Both bindings pass generated library labels, while `setupChannelBinding` selects account B only for the exact string `'B'` and account A otherwise. The actual adapter capture is `['A', 'A']`. Thus this case never creates the required two-library boundary; at best it checks isolation between connections within one library.

**Suggested fix:** Derive expected policies independently from the fixture/profile, assert the actual line-item target and one-placement invariant, and select distinct A/B accounts with an explicit library-ID inequality check. Complete the design-case-to-assertion map and add focused negative controls for wrong policy, duplicate placement and same-library setup. Source-text presence checks cannot replace those controls.

### B-LA-E7-06-06 — MAJOR — the onboarding self-test still fixes the fixture count

**File:line:** `tests/ltiaas/kit/kit.k0.test.ts:154`, `:179`, `:180`, `:183`.

**Problem and evidence:** `runShippedChannelsAudit` now correctly accepts all discovered fixtures. However, the canary test copies every discovered fixture into its temporary directory, adds one more, then requires exactly six and the fixed baseline-plus-canary ID list. Adding only `channels/review-canary.json` in the private clone produces **12 PASS, 1 FAIL** from the unchanged K0 command: line 179 receives 7 but expects 6. The main audit passes in that same run. The documented one-file onboarding workflow therefore still needs a shared test edit.

**Suggested fix:** Derive the canary expectations from the discovered input set, or seed a deliberately fixed isolated fixture set. Verify the whole K0 command with one real extra fixture; checking only the extracted audit misses this failure.

### Verification and scope

- Private `git clone --no-hardlinks`, detached at `af36ad31ddb3defa161d696d569b09185cbf46ac`; dependencies installed there only. Shipped host command `LA_LEVEL=k0 npx --no-install vitest run --reporter=verbose --config tests/ltiaas/kit/vitest.config.mts`: **13/13 PASS**. Log: `/tmp/reviewer-b-e706r3-k0.log`.
- Pinned-source host probes with all external clients stubbed and live operations blocked: **8 corrective predicates failed, 10 controls passed**. Source: `/tmp/reviewer-b-e706r3-probes.cjs`; output: `/tmp/reviewer-b-e706r3-probes.log`. These are local contract/helper diagnostics, not live results.
- Actual sixth-file probe: **12 PASS, 1 FAIL**, as above. Log: `/tmp/reviewer-b-e706r3-canary.log`. The temporary fixture was removed afterward; the private clone's tracked files are unchanged.
- QA fix `cfcdc0ca` edits only the kit and its QA report. No product, frozen suite, simulator or selector file is changed by that fix. The host suite-neutrality check passes. No Docker, stack, host stack runner or K1-SIM suite was run; the live ACs remain **pending**.
- Blind review maintained. Only this review file was edited in the integration worktree; no commit was made. This is Round 3 with blocking findings, for the Lead's charter round-limit handling.

## Round 4

Verdict: **CHANGES_REQUESTED**. Reviewer-B: Codex GPT-6-Astra xhigh. Reviewed QA fix `30b5eb24`, integration pin `3a8b0e6f65d809e564dcbad71e2db1b4a5ad8deb`, using `af36ad31..3a8b0e6f` scoped to the kit and QA report. **2 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT open.** No new finding IDs; the remaining defects continue -02 and -07.

### Round 3 disposition

| Finding | Result and evidence |
| --- | --- |
| B-LA-E7-06-01 | **CLOSED.** Artifact suite identity is required. My anonymous/reused artifact negatives and named current-wave positive control pass, alongside missing-wave and contradictory-outcome controls. K0 covers both channel and full-run evaluators. The README now states the artifact schema, producer and directory rule. |
| B-LA-E7-06-02 | **OPEN, partial fix.** L9 now selects A/B explicitly and asserts different library IDs. L4 derives an expectation before launch, and L7 waits for each learner. However, L4 selects the wrong guard fixtures, L7 still accepts duplicate rows and a wrong line-item path, and A3 can return before dispatch. Counterexamples below. |
| B-LA-E7-06-06 | **CLOSED.** Canary expectations now use the discovered input set. The unchanged full host command passes **16/16** after adding only a real sixth fixture, with no shared test/list edit. |
| B-LA-E7-06-07 | **OPEN, partial fix.** Profile/grant keys, flat DTO parsing, the single `waitSync` return object, normal picker handoff and the registration URL flow are improved. The picker adapter now fabricates a 200 for a redirect loop, and L10 still sends an incompatible storage-check request. |

Previously closed -03, -04, -05 and -08 remain closed. The explicit protocol-control selection also removes the former first-fixture fallback. These source findings do not replace the pending live acceptance run.

### B-LA-E7-06-02 — BLOCKER — the revised case checks still fail or miss required behaviour

**File:line:** `tests/ltiaas/kit/suites/k1-launch.k1sim.test.ts:188`, `:194`, `:387`; `tests/ltiaas/kit/lib/fixtures.ts:1568`, `:1705`, `:1751`; `tests/ltiaas/kit/suites/k1-ags.k1sim.test.ts:262`.

**Problem and evidence:** The new helper tests pass, but they do not exercise these conditions in the actual cases:

- **L4 foreign-fixture selection:** A launch guard is inferred from `manual === 'operatorGrant' && !registration.dynamic`. Blackboard is the only shipped match; when Blackboard is the target, it is excluded and `launchGuardedForeign` is undefined. Executing the actual Blackboard L4 callback with host stubs throws `Cannot read properties of undefined (reading 'sim')` before any launch call. The “registration-guarded” selector picks Moodle for Canvas, but Moodle declares `guardedFamilies: []` (`packages/channels/moodle/manifest.ts:39`). The helper nevertheless treats `moodle` as registration-guarded and requires a warning. Registration capability is not family-guard metadata.
- **L7 placement and target:** `verifyContextlessSharedPlacement` still checks distinct resource-link strings, not one placement. Adding a second result row for the same learner and resource-link ID returns `ok: true`. Changing both score-record paths to another line item on the same publication also returns `ok: true`: `path` is passed by L7 but never checked. The shipped “duplicate placement” control changes the resource-link ID, so it does not cover the original concern of multiple placements for the same ID.
- **A3 retry timing:** `waitSync(..., 'pending')` accepts a newly queued sync with `tries: 0`. A3 immediately requires `tries >= 1`. A host execution of the unchanged frozen helper with that valid pre-dispatch row returns it at once. The case can fail before the simulator's 503 response occurs, despite correct retry behaviour.

**Suggested fix:** Select foreign families from the declared guard levels, with an explicit missing-fixture diagnostic, and validate the actual selected combinations. Use a placement observation that distinguishes duplicate placements for the same resource link, reject duplicate result rows, and compare the dispatch path with the launch line item. For A3, wait for the target sync to show an attempted dispatch before asserting retry state. Add controls for these exact counterexamples and align the README assertion map with what is proved.

### B-LA-E7-06-07 — BLOCKER — transport results and storage-check inputs remain incompatible

**File:line:** `tests/ltiaas/kit/lib/runtime.ts:1241`; `tests/ltiaas/kit/suites/k1-launch.k1sim.test.ts:609`, `:644`, `:654`.

**Problem and evidence:** Two concrete contract errors remain:

1. `openPickerOnChannel` changes a picker response from 303 to 200 when its `Location` points to itself. With a redirect-loop stub, the helper returns `status: 200` while its own `page.status` is 303. The shared HTTP client follows no redirects; no successful page was received. The normal 303 handoff → 200 page and a 403 refusal both pass my separate controls. The loop must remain a failure, including for L8's status-only staff-picker assertion.
2. L10's supposed successful storage-check sends `state` with no `Origin` header. The public LTI API delta §2.2 requires form fields `check`, `value` and an Origin equal to the LTI origin. Executing the actual Canvas L10 callback with contract-shaped responses captures `{ check: 'chk-host', value: '', state: 'host-state' }` and only an `accept` header; a contract-shaped `400 INVALID_STATE` response then fails its expected 303. The wrong-value case repeats this request shape, and the missing-row case uses `pendingId` instead of `check`, so its refusals cannot establish the intended validation order either.

**Suggested fix:** Preserve actual HTTP status and reject redirect loops. Send the storage-check body's documented fields and Origin, and distinguish wrong value, replay and unknown check with otherwise valid requests. Exercise these adapters/case callbacks with contract-shaped host responses; source-string checks and typechecking cannot detect these errors.

### Verification and scope

- Private `git clone --no-hardlinks` at the reviewed pin: `/tmp/review-b-e706-r4-mwv0u9p0`. Dependencies installed there only. Shipped kit K0: **16/16 PASS**; the same command with `channels/review-canary.json`: **16/16 PASS**; kit TypeScript check: **PASS**. Logs: `/tmp/reviewer-b-e706r4-k0.log`, `/tmp/reviewer-b-e706r4-canary.log`, `/tmp/reviewer-b-e706r4-typecheck.log`. Removed the canary; clone tracked files remain unchanged.
- Replayed my Round 3 harness with only the pin/path updated: **17/18**, with the sole failure being the obsolete expectation that A3's return is an array. A3 now uses the sync object. The original picker stub always returned 303; I separated that into a redirect-loop negative and supplied an actual 200 for the valid-page control. The **17 applicable historical checks pass** in `/tmp/reviewer-b-e706r4-probes.cjs` and `.log`; the unchanged replay is retained as `/tmp/reviewer-b-e706r4-historical-probes.cjs` and `.log`.
- Additional pinned-source checks, including the actual L4 and L10 callbacks with external clients stubbed: **8 corrective predicates fail, 6 controls pass**. Source and full output: `/tmp/reviewer-b-e706r4-focused-probes.cjs` and `.log`. No HTTP, child-process stack action or K1-SIM execution occurred.
- QA fix `30b5eb24` stays within kit/QA-report ownership; product, frozen tests and simulator paths are unchanged. The K0 suite-neutrality check passes. Blind review maintained; only this review file was edited in the integration worktree, with no commit. This review follows the last allowed fix round; the two open BLOCKERs require the Lead's product-owner escalation under charter-LA §5.
