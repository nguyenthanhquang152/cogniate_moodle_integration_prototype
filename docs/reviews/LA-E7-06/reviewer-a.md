Verdict: CHANGES_REQUESTED
Round: 1

## Round 1

Reviewer-A: Codex GPT-6-Astra xhigh. Lens: “Is it right and is it safe?”

Reviewed integration commit `1fd9aacc5273b0b00a1790f0af633fb2fcd9c9df` against LA-E7-06 and TEST-STRATEGY §2.2–§2.6 / §9.2 item 11. The coordinator confirmed this dispatch covers the kit only; the E8-04 text was stale. Findings: **7 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT**. BLOCKER follows base charter §5: an acceptance criterion fails or the result is wrong.

### A-LA-E7-06-01 — BLOCKER — Frozen-suite PASS results are invented

**Locations:** `tests/ltiaas/kit/lib/fixtures.ts:603`, `tests/ltiaas/kit/lib/fixtures.ts:613`, `tests/ltiaas/kit/suites/k-hyg.k1sim.test.ts:44`.

**Problem:** `DEFAULT_WAVE_PASS_RESULTS` declares T3b, T7 and T8 PASS. H2 supplies this constant unconditionally. No result from the current wave is loaded or checked. Thus Moodle's `coveredBy` capabilities can be certified when the referenced suites did not run, failed, or belong to a different wave. This fails AC-05.

**Evidence:** A host probe supplied the computed passing kit records with no frozen-suite evidence. `evaluateChannelPassRule` returned `ok: true`; supplying an explicit empty evidence map returned `ok: false`. The K0 test exercises an explicit FAIL map, but the real H2 caller always supplies the hard-coded PASS map.

**Suggested fix:** Require explicit frozen-suite results with a verified current-wave identity. Missing, pending, failed or stale evidence must fail certification. Test the actual H2 evidence-loading path with each negative case; remove the production PASS default.

### A-LA-E7-06-02 — BLOCKER — C1 accepts removal of entire API capability objects

**Locations:** `tests/ltiaas/kit/lib/fixtures.ts:521`, `tests/ltiaas/kit/lib/fixtures.ts:532`, `tests/ltiaas/kit/lib/fixtures.ts:543`, `tests/ltiaas/kit/lib/fixtures.ts:554`, `tests/ltiaas/kit/suites/k1-cap.k1sim.test.ts:72`.

**Problem:** All four API maps are compared only when truthy. C1 passes response fields through casts without asserting that they exist. A provider entry and connection DTO can omit both `channelCapabilities` and legacy `capabilities`, and the claimed bilateral check still passes. This fails AC-04 and TEST-STRATEGY C1.

**Evidence:** Two host probes set all four API maps to `undefined` and then `null`, while retaining the correct manifest and tool keys. Both returned `ok: true`. Existing missing-key tests remove a key inside a supplied map and do not cover a missing whole map.

**Suggested fix:** Require the four API maps at the C1 boundary and reject missing, null and malformed objects before comparing keys and values. Add negative probes that remove each whole response object independently.

### A-LA-E7-06-03 — BLOCKER — K-HYG can pass without scanning required evidence

**Locations:** `tests/ltiaas/kit/lib/runtime.ts:93`, `tests/ltiaas/kit/lib/runtime.ts:947`, `tests/ltiaas/kit/lib/runtime.ts:960`, `tests/ltiaas/kit/lib/runtime.ts:966`.

**Problem:** The scan reads `/secrets` to obtain the search values but never reads simulator records. It scans only immediate files in `LA_RUN_DIR`, skips nested evidence, and scans no artifact directory when that variable is absent. Missing or unreadable service logs become empty strings. A nonempty secret inventory therefore allows H1 to report success with missing required inputs or an unscanned leak. This fails AC-06.

**Evidence:** An isolated host probe supplied one synthetic secret, unavailable service logs, a simulator-record stub containing that secret, and a nested evidence file containing it. The scan returned `secretCount: 1`, `leakedCount: 0`, `ok: true`, and never called the records reader. Moving the same secret to a top-level artifact made the control fail, confirming the blind spot rather than a bad search value.

**Suggested fix:** Enumerate and require the complete run's service logs, simulator records and redacted evidence. Walk the evidence tree, provide an explicit artifact root, and fail when required input is unavailable. Keep the private secret inventory separate from publishable evidence. Add planted-leak and missing-input probes for every source.

### A-LA-E7-06-04 — BLOCKER — The execution ledger can erase failures and miss executed cases

**Locations:** `tests/ltiaas/kit/lib/runtime.ts:150`, `tests/ltiaas/kit/lib/runtime.ts:162`, `tests/ltiaas/kit/lib/runtime.ts:208`, `tests/ltiaas/kit/suites/k-hyg.k1sim.test.ts:42`, `tests/ltiaas/kit/suites/k1-nrps.k1sim.test.ts:63`.

**Problem:** The ledger appends into a caller-supplied run directory; `resetKitRunState` has no caller. `readAllExecutedCases` keeps only the last record for each ID. Suites record success only after assertions, with no failure hook, and H2 hard-codes the skipped count to zero. A manual rerun in the same directory can retain old PASS entries or overwrite FAIL with PASS. The standalone N2 test is neither in the expected list nor recorded, so missing/extra execution checks do not cover the actual full test collection. This defeats AC-02 and §2.6's rule that a failed-then-passing case is a flake, not a PASS for that run.

**Evidence:** A host probe wrote a FAIL followed by the computed PASS records. Reading the ledger removed the FAIL and the pass rule returned `ok: true`. Source inspection finds no reset call or automatic failure/skip recording. The K0 missing/extra probes operate on synthetic lists and cannot detect these runtime gaps.

**Suggested fix:** Initialize a unique run ledger once, bind records to that run, and obtain all collected case IDs and outcomes from the runner. Preserve any failure within a run and record skipped tests and global cases such as N2. Finalize only after all suites finish. The current `sequencer: undefined` is not an ordering guarantee: a host probe of the installed default sequencer placed a cached failed K-HYG suite before functional suites. Use a final reporter/hook or explicit order, and test omitted, extra, skipped and failed-then-rerun cases through the real ledger path.

### A-LA-E7-06-05 — BLOCKER — Grant helper uses an invalid flag and omits a required value

**Locations:** `tests/ltiaas/kit/lib/runtime.ts:325`, `tests/ltiaas/kit/lib/runtime.ts:327`.

**Problem:** Canvas grant issuance sends `--service`, but the operator CLI accepts `--service-url`. The `add_deployment` branch omits `--client-id`, although it is required for both purposes. Canvas setup therefore cannot reach the intended tests, and additional-deployment grant issuance cannot succeed. This prevents AC-01.

**Evidence:** Host probes captured the helper's arguments without running the operator or a stack. Parsing the Canvas arguments with the CLI's declared options throws `Unknown option '--service'`; additional-deployment arguments contain no `--client-id`. The CLI contract and required-field check are at `services/cogniate-app/src/cli/grant.ts:17` and `:32`.

**Suggested fix:** Send `--service-url` and always include the bound client ID. Add host contract checks for initial and additional-deployment arguments, then verify both flows in the authorized K1 window.

### A-LA-E7-06-06 — BLOCKER — D6 requires behavior that the design explicitly refuses

**Location:** `tests/ltiaas/kit/suites/k1-dl.k1sim.test.ts:152`.

**Problem:** With `acceptLineitem: false`, D6 expects a successful pick and an ungraded item for every channel. Every fixture has `content.ungraded: false` and marks that feature `notBuilt`. TEST-STRATEGY §2.4 / LA-ADR-05 D3c require the picker to show `PLACEMENT_NOT_GRADED` in this situation. The correct product cannot pass this test, and changing the product to satisfy it would defeat the capability rule. This prevents AC-01.

**Evidence:** The test asserts status 200 at line 158 and one item without `lineItem` at lines 166–167. The refusal is implemented at `services/cogniate-app/src/tool-pages/picker.ts:122`, `:187` and `:241`; its status is 403 (`:51`). This is a source-confirmed oracle error, not a claimed live K1 result.

**Suggested fix:** Assert the documented refusal and zero Deep Linking return for the current fixtures. Gate successful ungraded-item expectations on a supported, built capability. Also include the distinct service-level `INVALID_CONTENT_ITEM` negative case required by the strategy.

### A-LA-E7-06-07 — BLOCKER — The case catalog does not cover the required security cases

**Locations:** `tests/ltiaas/kit/lib/fixtures.ts:293`, `tests/ltiaas/kit/suites/k1-launch.k1sim.test.ts:46`, `tests/ltiaas/kit/suites/k1-ags.k1sim.test.ts:165`, `tests/ltiaas/kit/suites/k1-reg.k1sim.test.ts:26`.

**Problem:** The expected-case catalog and suites agree with each other but replace several TEST-STRATEGY §2.4 cases with unrelated checks. A complete ledger under this catalog does not prove all applicable K1 cases passed, as AC-01 requires. The omissions concern safety boundaries, not merely different case names.

| Required behavior | Current evidence and gap |
| --- | --- |
| LAUNCH: unknown/inactive deployment, signed-family guards, two-library isolation, and platform-storage HTTP rules | L3 tests an administrator role; L4 only opens a launch without context; L9 tests custom claims; L10 tests privacy. No corresponding negative or cross-library scenarios are present in the kit. L1 also credits `launch.topLevelContinue` after only checking that the fixture value is a boolean (`:51`). |
| DL: learner refusal, foreign-Origin cancel refusal, distinct response nonces, and single selection when the channel forbids multiple items but the launch allows them | D1–D8 do not contain these negative/uniqueness checks. D5-GUARD uses `acceptMultiple: false` (`k1-dl.k1sim.test.ts:126`), so it does not test the required channel restriction when the platform permits multiple items. |
| AGS: staff preview and disabled connection send nothing; off-origin service URL refusal; 429 leaves the app row pending without counting a try | A4 calls the LTI score API directly and asserts the propagated 429/header, not the app outbox state. A5 tests 409 conflict; A6 tests a list limit. The required no-send and off-origin cases are absent. |
| REG: strict-body rejection, invalid grant, reserved issuer, guarded-family refusal, and full I-SELF origin-binding negative | R1–R6 cover connect, mismatched values, staged/happy DR, added deployment and connection check. Staging alone does not assert the off-origin token/authorization cases, active-create refusal, and zero token requests required by strategy R6. |

**Suggested fix:** Trace each §2.4 requirement to a real scenario and behavioral assertion, then compute the expected list from that complete catalog. Add the omitted security cases and their network/log oracles. Retain the documented applicability rules, including the full 12-fault matrix once on the generic channel. Check coverage before scheduling the fresh SIM run.

### Verification and boundaries

- Private clone: `/tmp/la-review-a-f2a8d7c3f20b`, detached at the reviewed SHA, created with `git clone --no-hardlinks`. Dependencies installed there only.
- Kit K0: `LA_LEVEL=k0 npx --no-install vitest run --reporter=verbose --config tests/ltiaas/kit/vitest.config.mts` — **8/8 PASS**, 1 file, 1.16 s. This confirms the existing host checks pass; it does not establish the missing runtime gates.
- Isolated reviewer probes: `npx --no-install vitest run --reporter=verbose --config reviewer-probes.config.mts` — **8/8 confirmed the current defects**, 1 file, 389 ms. Runtime network/CLI dependencies were mocked; all secrets were synthetic. Probe source, config and logs remain in the private clone (`reviewer-probes.test.ts`, `reviewer-probes.log`, `reviewer-k0.log`). The cases cover frozen evidence, two missing-map variants, ledger failure overwrite, hygiene blind spots with a detecting control, both CLI errors, and default sequencing.
- Cleared the private clone's `node_modules/.vitest-cache` before each Vitest run. No Docker, stack, stack-starting host runner, commit, or product/test edit in integration. K1 remains pending; its missing live evidence is not reported as a separate defect in this host-only dispatch.
- The reviewed diff stays within the authorized QA kit, selector and QA-report paths. No product changes or frozen-test changes beyond the authorized selector. The host neutrality check passes. Reviewer-B's file was not opened. Only this review file was changed in integration.
