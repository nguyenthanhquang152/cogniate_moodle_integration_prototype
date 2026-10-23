Verdict: CHANGES_REQUESTED
Round: 1

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
