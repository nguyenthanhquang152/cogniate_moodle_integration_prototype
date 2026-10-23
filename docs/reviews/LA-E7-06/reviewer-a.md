Verdict: CHANGES_REQUESTED
Round: 2

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

## Round 2

Reviewer-A: Codex GPT-6-Astra xhigh. Lens: “Is it right and is it safe?”

**Verdict: CHANGES_REQUESTED — 6 BLOCKER, 1 MAJOR, 0 MINOR, 0 NIT open.** Reviewed QA commit `5dcb2406` at integration pin `c1bf5c7a`, using `git diff 1fd9aacc c1bf5c7a -- tests/ltiaas/kit docs/reviews/LA-E7-06/qa.md`. References below are at that pin. The changes fix several host helpers, but replace the working M1 integration helpers with contracts that the product does not implement. K0 passing does not establish that the K1 suites can run or that their assertions prove the required behavior.

### Round 1 disposition

| Finding | Status | Evidence |
| --- | --- | --- |
| A-LA-E7-06-01 | OPEN, BLOCKER | The constant PASS default is gone, but the real H2 caller accepts the evidence file's own wave ID as the current wave. |
| A-LA-E7-06-02 | CLOSED | The comparator requires all four API maps and rejects missing, null and array values. The new K0 negative tests pass. C1's separate response-contract error is covered by A-08 below. |
| A-LA-E7-06-03 | CLOSED | The scanner now requires inputs, reads simulator records and walks nested artifacts; planted leaks and missing inputs fail its K0 probes. The default log-source wiring is separately broken under A-08. |
| A-LA-E7-06-04 | OPEN, BLOCKER | Failure-before-rethrow, duplicate preservation, run IDs, global cases and explicit hygiene-last sequencing are fixed. The full-run evaluator still ignores records outside the selected channels and GLOBAL. |
| A-LA-E7-06-05 | OPEN, BLOCKER | `--service-url` and `--client-id` are fixed, but the replacement CLI helper has other blocking contract errors. |
| A-LA-E7-06-06 | CLOSED | The previous ungraded-picker success oracle is changed to 403 `PLACEMENT_NOT_GRADED` when the capability is false, and the distinct service-level negative case is present. The wrong literal message and record kind are separate runtime-contract errors under A-08. |
| A-LA-E7-06-07 | OPEN, BLOCKER | The documented case IDs are present, but several required behavioral assertions remain absent or can pass for unrelated results. |

### A-LA-E7-06-01 — BLOCKER — The evidence file still determines its own freshness

**Locations:** `tests/ltiaas/kit/suites/k-hyg.k1sim.test.ts:49`, `:110`; `tests/ltiaas/kit/lib/runtime.ts:277`, `:333`; `tests/ltiaas/kit/lib/fixtures.ts:1101`.

**Problem and evidence:** H2 and the summary use `LA_WAVE_ID ?? waveEvidence.waveId`; the evaluator also defaults to the manifest's wave ID. Without an independently supplied current-wave ID, an old file is treated as current. The loader reads the manifest but never reads its linked suite artifacts; `artifactPath` is only checked as a nonempty string. A host probe supplied an `old-wave` manifest with T3b/T7/T8 PASS and nonexistent artifact paths, plus complete synthetic kit records: full-run certification returned `ok: true`. The control supplying `current-wave` independently failed. AC-05 therefore still lacks a current-wave gate.

**Suggested fix:** Require the wave identity from the current run independently of the supplied results. Consume and validate the referenced suite results rather than accepting unchecked artifact pointers. Test the real H2 loading path with absent current identity, stale evidence and missing referenced evidence.

### A-LA-E7-06-04 — BLOCKER — Extra-channel failures disappear from full-run certification

**Locations:** `tests/ltiaas/kit/lib/runtime.ts:344`, `:366`; `tests/ltiaas/kit/lib/fixtures.ts:929`.

**Problem and evidence:** The evaluator partitions records into selected fixture IDs and GLOBAL. No validation handles a record outside those partitions. A host probe added `unexpected:K1-REG:R99` with outcome FAIL and the current run ID to an otherwise complete run. Certification returned `ok: true` and `totalFailed: 0`. Thus an extra executed case, even a failed one, does not reliably fail AC-02. Preserving the append-only ledger fixes the earlier overwrite defect but is not sufficient.

**Suggested fix:** Validate every record against the complete expected run list before partitioning it. Reject unknown channel IDs, extra IDs and all failed/skipped/stale records, including those outside a selected channel. Add this case to the full-run host test, not only the per-channel evaluator tests.

### A-LA-E7-06-05 — BLOCKER — The replacement grant helper cannot issue or parse a real grant

**Locations:** `tests/ltiaas/kit/lib/fixtures.ts:336`; `tests/ltiaas/kit/lib/runtime.ts:742`, `:747`.

**Problem and evidence:** The command selects workspace `@cogniate/app`; the real package is `@cogniate/cogniate-app` (`services/cogniate-app/package.json:2`). It sends unknown option `--lms` and omits required `--note` (`services/cogniate-app/src/cli/grant.ts:17–32`). A host argument probe confirmed all three mismatches without executing the CLI. Even after fixing those arguments, the helper searches stdout for `cgg_…`, whereas the operator emits an unprefixed random token in `Approval code (shown once): …` (`services/cogniate-app/src/app/operator.ts:269`, `:283`). The new K0 test checks the two previously named flags but misses these errors. Grant-dependent K1 setup cannot complete, preventing AC-01.

**Suggested fix:** Reuse the M1 CLI bridge and grant-output parser, with the real workspace and complete required arguments. Check the entire argument/output contract for initial, additional-deployment and staged grants before the authorized K1 run.

### A-LA-E7-06-07 — BLOCKER — Restored case names still do not prove the required safety behavior

**Locations:** `tests/ltiaas/kit/suites/k1-ags.k1sim.test.ts:223`; `tests/ltiaas/kit/suites/k1-launch.k1sim.test.ts:265`; `tests/ltiaas/kit/suites/k1-cap.k1sim.test.ts:105`; `tests/ltiaas/kit/suites/k1-reg.k1sim.test.ts:489`.

**Problem and evidence:** AC-01 and TEST-STRATEGY §2.4 require behavioral evidence, not just a matching catalog. These gaps remain even after correcting the transport contracts in A-08:

| Required case | Remaining gap |
| --- | --- |
| AGS A3: 429 leaves the affected row pending without counting a try | The test checks only that the whole gradebook body contains `pending` or `throttled`. It does not identify the 429 learner's row or inspect its try count. The previous 503 row can satisfy this expression. The completion POST result is not checked. |
| LAUNCH L7: contextless launch dispatches to its lineitem; without AGS it has no gradebook column; two learners share one placement | The test opens pages and checks a missing service key. It never commits a score, checks dispatch, checks the no-column result, or compares/counts placements for the two learners. |
| CAP C2: documented refusal, `details.capability`, zero simulator calls and no outbound log event | The dynamic-registration branch accepts any status at least 400. The artifacts branch reads tool configuration successfully rather than calling the guarded artifact route. The C2 suite does not assert the required capability detail and both no-network oracles. A routing error can be credited as a capability refusal. |
| REG R6: full I-SELF negative | The staged DR scenario changes `authorizationServer` only; the foreign token-endpoint scenario and connection DTO authority assertion are absent. Those are explicit parts of R6. |

**Suggested fix:** Map each required behavior to an observable assertion against the correct row, placement, error and network boundary. Use mutants or negative controls to prove each assertion fails when the required protection is removed. A complete list of case IDs alone must not certify coverage.

### A-LA-E7-06-08 — BLOCKER — The new runtime uses contracts that the product does not implement

**Locations:** `tests/ltiaas/kit/lib/runtime.ts:614`, `:657`, `:772`, `:789`, `:931`, `:977`, `:1014`; `tests/ltiaas/kit/suites/k1-cap.k1sim.test.ts:43`; `tests/ltiaas/kit/suites/k1-dl.k1sim.test.ts:45`, `:314`.

**Problem:** LA-E7-06's design note and TEST-STRATEGY §2.2 require thin glue that imports M1 helpers. The replacement runtime imports none of those helpers and implements a different session, API and launch protocol. Every channel setup starts with a locally signed `cogniate_staff_session` cookie for a random library. The product accepts `__Host-cog_session`, with a 43-character token backed by a stored session (`services/cogniate-app/src/app/session.ts:11–25`). A host probe passed the generated cookie to the real session resolver: it returned `undefined` before any database lookup. Setup therefore fails before the first authenticated course request can succeed.

**Further source evidence:** Fixing the cookie alone will not make the suites runnable:

| New kit contract | Existing product/helper contract |
| --- | --- |
| `x-service-api-key` for LTI API calls; bare `Bearer ltik` in launch tests | M1 uses `Bearer API_KEY` for admin and `LTIK-AUTH-V2 API_KEY:LTIK` for launch access (`tests/acceptance/lib/lti.ts:75`). |
| Login uses the library ID as account; launch posts to `/lti/launch` | The configured tool account is used by M1; the product launch route requires `/lti/launch/:account` (`services/lti-service/src/http/routes/protocol.ts:58`). |
| POST `/app-api/courses/:id/publish` | M1 uploads a version and posts `/app-api/publications` with connection/course IDs (`tests/acceptance/M1/common/course.ts:25–32`). |
| C1 reads `providers[].id` | `/app-api/lms-providers` returns `lms[]` with `lms` and `channel` IDs (`services/cogniate-app/src/app/connections.ts:142–155`). |
| Picker selection posts JSON course IDs to `/tool/picker/:id/select`; the refusal pins a new literal sentence | The picker posts `publicationId` form values to `/tool/picker/:pickerId` and uses the channel-aware refusal text (`services/cogniate-app/src/tool-pages/picker.ts:51`, `:219`). |
| DL assertions filter simulator records with `kind === 'dl'` | The simulator records `deep-link` (`tests/sim/core/provider.mjs:343`), so zero-return assertions are vacuous and positive lookup fails. |
| Service logs are read only from `LA_RUN_DIR/<service>.log` or its `logs` child | The acceptance harness uses `QA_LOGS_DIR` or `infra/.logs`, with `<service>.jsonl` (`tests/acceptance/lib/paths.ts:27`, `tests/acceptance/lib/logs.ts:25`). The default scanner cannot find those required logs. |

**Suggested fix:** Restore thin wrappers around the existing M1 session, CLI, publication, launch, API and evidence helpers. Match documented DTOs and simulator record names in the suites. Add bounded host contract checks at these boundaries, then run the corrected K1 suites in the authorized SIM window. Product changes to accommodate these invented test contracts would be outside this task's scope.

### A-LA-E7-06-09 — BLOCKER — The claimed 12-fault matrix omits real faults and never checks their error codes

**Locations:** `tests/ltiaas/kit/lib/fixtures.ts:245`; `tests/ltiaas/kit/suites/k1-launch.k1sim.test.ts:512`.

**Problem and evidence:** The new list uses `tampered` and `alg-none`, which the simulator signer does not implement. It implements `altered-signature`, `unknown-kid`, `none` and `hs256` (`tests/sim/core/crypto.mjs:13–23`); these required cases are absent from the new list, which substitutes state/replay cases. Two host probes called the actual simulator signer with the new aliases and verified both resulting tokens successfully as RS256. In addition, the common fault assertion accepts any status at least 400 and never compares the documented error code. An unrelated 404 or authentication refusal can satisfy it. This directly fails AC-08, independently of A-08's route errors.

**Suggested fix:** Use the simulator's exact 12 supported fault names and assert each documented error code. Verify a valid launch control before applying a fault. Keep state/replay tests as additional cases if useful; they do not replace algorithm, key-ID and signature negatives.

### A-LA-E7-06-10 — MAJOR — Supported level selections silently disable K1 suites

**Locations:** `tests/ltiaas/kit/vitest.config.mts:52`; `tests/ltiaas/kit/lib/runtime.ts:105`.

**Problem and evidence:** The config accepts `LA_LEVEL=k1sim` and `LA_LEVEL=all`, but `isK1SimEnabled` recognizes only `k1-sim`, `QA_TASK=K1`, `QA_TASK=LA-E7-06` or `QA_KIT_RUN=1`. With either supported level and no redundant QA flag, every K1 suite uses `describe.skip`, including hygiene. Two host probes confirmed both guards return false. The documented QA_TASK wrapper avoids this mismatch, but direct supported level selection can produce skipped K1 work instead of certification.

**Suggested fix:** Use one level parser or let the config's include list determine which suites run. Add host checks for every supported level and reject a selected run containing skips.

### Round 2 verification and boundaries

- Private clone `/tmp/la-review-a-ecc984c39479`, detached at `c1bf5c7a`, created with `git clone --no-hardlinks`; dependencies installed there only.
- Kit K0: `LA_LEVEL=k0 npx --no-install vitest run --reporter=verbose --config tests/ltiaas/kit/vitest.config.mts` — **10/10 PASS**, 1 file, 129 ms. Its new negative tests establish the helper fixes noted above, but do not cover the runtime contracts or the remaining false-PASS paths.
- Kit type check: `npx --no-install tsc --noEmit -p tests/ltiaas/kit/tsconfig.json` — **exit 0**.
- Private diagnostic suite: `npx --no-install vitest run --reporter=verbose --config reviewer-r2.config.mts` — **9/9 diagnostic assertions PASS**, 1 file, 280 ms. These confirm observed behavior, not product acceptance. Probe source/config and logs are retained as `reviewer-r2.probe.test.ts`, `reviewer-r2.config.mts`, `reviewer-r2-probes.log`, `reviewer-r2-types.log` and `reviewer-k0.log` in the private clone. No HTTP requests, operator invocation or stack were needed.
- Cleared private `node_modules/.vitest-cache` before each Vitest run. No Docker, stack-starting runner or K1-SIM execution. The pending live K1 evidence is not an additional finding in this host-only review.
- QA commit `5dcb2406` stays within the allowed kit and QA-report paths. No product or frozen-test edit was made by that commit; no LMS name was added to core paths. The M1-helper requirement is violated as described in A-08. Reviewer-B's file was not opened. This review file is the only integration file changed by this reviewer; concurrent work was left untouched. No commit.
