Verdict: APPROVE
Round: 6

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

## Round 3

Reviewer-A: Codex GPT-6-Astra xhigh. Lens: “Is it right and is it safe?”

**Verdict: CHANGES_REQUESTED — 4 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT open.** Reviewed QA commit `cfcdc0ca155c86daaf13f524d67a800cad5b7916` at integration pin `af36ad31`, using `git diff c1bf5c7a af36ad31 -- tests/ltiaas/kit docs/reviews/LA-E7-06/qa.md`. References below are at that pin. The restored M1 imports fix the earlier session and transport replacements, but several callers still use incompatible request and response contracts. The host pass does not establish that the K1 cases can execute or prove their stated safety properties.

### Previous finding disposition

| Finding | Status | Evidence |
| --- | --- | --- |
| A-LA-E7-06-01 | OPEN, BLOCKER | Current-wave identity is now independent and linked files are read. However, artifact suite identity is optional, so one anonymous PASS artifact certifies three different frozen suites. |
| A-LA-E7-06-02 | CLOSED, unchanged | Required API capability-map checks remain. The C1 caller's different DTO errors remain under A-08. |
| A-LA-E7-06-03 | CLOSED, unchanged | Required-source and recursive secret-scan checks remain; log loading now uses the existing acceptance paths and `.jsonl` files. |
| A-LA-E7-06-04 | CLOSED | `evaluateKitRunPassRule` validates every record before partitioning and rejects unknown/unselected channels (`runtime.ts:716`). The new full-run K0 negative checks pass. |
| A-LA-E7-06-05 | CLOSED | Grant issuance uses the frozen `cli('app:grant', args)` bridge, correct flags, and the real labeled 43-character output parser (`runtime.ts:974`; `fixtures.ts:388`, `:479`). Grant redemption has a separate body error under A-08. |
| A-LA-E7-06-06 | CLOSED, unchanged | The capability-based ungraded refusal oracle remains. Picker transport and DTO errors are tracked under A-08. |
| A-LA-E7-06-07 | OPEN, BLOCKER | C2 now includes capability details and both no-network checks; A3 and R6 contain more assertions. L9 still uses one library, L4 selects its expected outcome from the response, and L7 does not establish shared placement. |
| A-LA-E7-06-08 | OPEN, BLOCKER | M1 imports, authentication, publication, simulator record kind and log paths are restored. Setup, manifest loading, picker handoff, registration and several DTO consumers still disagree with the shipped contracts. |
| A-LA-E7-06-09 | OPEN, BLOCKER | All 12 fault names, exact codes and a valid control are present. The suite selects the wrong channel for the required generic-channel matrix. |
| A-LA-E7-06-10 | CLOSED | All documented level aliases are accepted and the suite-level `describe.skip` guards are removed. The K0 level checks pass. |

### A-LA-E7-06-01 — BLOCKER — One anonymous artifact can certify three frozen suites

**Location:** `tests/ltiaas/kit/lib/fixtures.ts:1074`.

**Problem and evidence:** `verifyWaveSuiteArtifact` checks the suite name only when `parsed.suite` exists. A private host probe wrote one file containing only `{"waveId":"current-wave","outcome":"PASS"}` and referenced it for T3b, T7 and T8. With complete synthetic kit records and an independently supplied current wave/run identity, full-run certification returned `ok: true`. Nothing in that file establishes a result for any of the three named suites. The freshness and missing-file fixes are useful, but AC-05 still accepts unverified `coveredBy` claims.

**Suggested fix:** Require explicit matching suite identity in each consumed result, or validate an equivalent per-suite record from a documented aggregate result format. Add negative checks for a missing identity and one unrelated result reused for multiple suites, with a correctly identified result as the positive control.

### A-LA-E7-06-07 — BLOCKER — Safety cases still have ineffective setup or oracles

**Locations:** `tests/ltiaas/kit/suites/k1-launch.k1sim.test.ts:178`, `:304`, `:409`; `tests/ltiaas/kit/lib/runtime.ts:1020`.

**Problem and evidence:** These cases still do not prove TEST-STRATEGY §2.4 / AC-01:

| Case | Remaining defect |
| --- | --- |
| L9: two-library isolation | L9 passes generated `lib-l9-a-…` and `lib-l9-b-…` labels, but setup maps only the exact string `B` to session B and every other value to A. A host probe captured two A sessions and identical library IDs. The test therefore exercises two connections in one library, not the required tenant boundary. |
| L4: signed-family guard levels | The test chooses the first different family, then accepts either a 400 mismatch refusal or a 303 plus warning according to the observed status. It never derives the required result from the source family's guard level and destination platform. It can credit refusal where passthrough is required, or passthrough where refusal is required. The strategy specifies those outcomes separately (`tests/ltiaas/TEST-STRATEGY.md:150`). |
| L7: both learners share one placement | It searches `learner.subject` and compares top-level `resourceLinkId` with the external launch value. The real result has `learner.sub` and `activity.resourceLinkId`, the internal placement reference (`services/cogniate-app/src/domain/results.ts:125`). Even after correcting the field access, the oracle must compare the two learners' internal placement identities, not compare an internal ID with the input string. The second unqualified `waitSync(..., 'sent')` can also return the first learner's already-sent sync. |

**Suggested fix:** Select explicit A/B sessions and assert different library IDs before testing isolation. Derive L4's expected refusal or warning before sending the request, and cover the required guard-level branches. Poll each learner's actual row and sync, then assert the two rows reference one internal placement. Prove the negative assertions with bounded host checks or mutants; source-text presence is insufficient.

### A-LA-E7-06-08 — BLOCKER — Restored helper imports still leave incompatible K1 contracts

**Locations:** `tests/ltiaas/kit/lib/runtime.ts:1055`, `:1077`, `:1182`, `:1218`; `tests/ltiaas/kit/lib/fixtures.ts:333`; the suite locations below.

**Problem:** The thin-glue requirement is not satisfied by importing M1 helpers while passing different bodies or interpreting different result shapes. Setup itself sends fields rejected by the real adapters. Several independent errors then prevent the corrected product from passing AC-01/AC-04, or prevent the intended safety check from being reached.

| Kit caller and evidence | Shipped contract / necessary correction |
| --- | --- |
| Setup sends `authUrl`/`tokenUrl` (`runtime.ts:1055`) and operator grant `approvalCode` (`:1077`). | Moodle requires `authenticationEndpoint`/`accessTokenEndpoint` (`packages/channels/moodle/app.ts:48`, `:78`); Canvas requires `grantCode` (`packages/channels/canvas/app.ts:16`). Host probes passed the captured bodies to the real parsers: both were rejected. Correct the bodies in setup and the registration cases that repeat them. |
| C1 loads `packages/lms-channels/channels/<id>/manifest.json` (`fixtures.ts:341`). | The shipped manifests are TypeScript modules in `packages/channels/<id>/manifest.ts`. A host probe confirmed all five real manifests exist and the default loader throws for all five. Use the actual public registry/manifest interface. |
| C1 reads `connRes.json.connection`, `toolCfgRes.json.fields` and `channel.capabilities` (`k1-cap.k1sim.test.ts:76`, `:92`, `:102`). | Connection GET returns the DTO directly; tool configuration is an array of rows; `channel` is an ID string and the map is `channelCapabilities` (`services/cogniate-app/src/app/connections.ts:149`, `:236`, `:259`). These accesses fail before a meaningful bilateral comparison. The same nested-connection assumption appears in registration tests. |
| L1 expects top-level `platformId`, `deploymentId`, `messageType`, `version`, `roles`, `context`, and `services.ags.serviceKey` (`k1-launch.k1sim.test.ts:82`). Related AGS/NRPS/DL assertions use the same invented layout. | `/api/idtoken` returns `platform.id/deploymentId`, `launch.type/context/resourceLink/deepLinkingSettings`, `ltiVersion`, `user.roles`, and `services.serviceKey` (`services/lti-service/src/lti/idtoken.ts:37`). Assert the actual documented fields. |
| AGS A1 decodes `tr.clientAssertion` and splits `tr.scope` (`k1-ags.k1sim.test.ts:86`, `:105`). | Simulator token records expose `clientId`, `audience` and `scopes`; they do not expose the credential JWT (`tests/sim/core/provider.mjs:186`). The simulator already validates assertion identity and unique JTI (`:159`). Use the safe record fields and validation behavior; do not add raw credential logging to satisfy the test. |
| AGS A3 casts `waitSync` to an array and calls `.find` (`k1-ags.k1sim.test.ts:182`), then searches `learner.subject`. | M1 `waitSync` returns one sync object (`tests/acceptance/M1/common/course.ts:74`); result rows come from `results`, with `learner.sub`. A host probe exercised the real helper and confirmed `.find` throws. A3 therefore stops at its first 204 case before reaching the new 429 assertion. |
| `openPickerOnChannel` performs one GET and returns the launch handoff URL (`runtime.ts:1182`). | The handoff returns another 303 to `/tool/picker/:id`; the frozen picker helper follows it and opens the page (`tests/acceptance/M1/common/course.ts:89`). A host probe confirmed the wrapper returns status 303 and the intermediate `/tool/deep-link` URL instead of a picker. |
| Dynamic registration expects `/tool/register?token=` (`runtime.ts:1218`), while R6 calls POST `/api/registrations/dynamic/preview` and `/dynamic/complete` (`k1-reg.k1sim.test.ts:486`, `:493`). | The supplied registration URL uses `?ref=` and enters GET `/lti/register/:account`; the LTI API then exposes GET `/api/registrations/:id` and POST `/api/registrations/:id/complete` (`services/cogniate-app/src/app/connections.ts:57`; `services/lti-service/src/http/routes/registration.ts:3`). The invented preview route does not exist. Follow the existing handshake and session-specific API. |

**Suggested fix:** Audit every wrapper and suite against the real helper signatures, route bodies and DTOs, including simulator profile/shared-platform setup. Use typed boundary values and small host contract tests that execute the callers with actual product-shaped responses. The new K0 “documented contracts” test (`kit.k0.test.ts:932`) mostly checks source strings, so it passes despite the defects above. Keep product and frozen M1 files unchanged; then verify the corrected K1 rows in the authorized SIM window.

### A-LA-E7-06-09 — BLOCKER — The full protocol matrix selects a named channel instead of generic

**Locations:** `tests/ltiaas/kit/suites/k1-launch.k1sim.test.ts:547`; `tests/ltiaas/kit/suites/k1-nrps.k1sim.test.ts:129`.

**Problem and evidence:** Both global suites search for `simProfile === 'lti-1p3-standard'` and silently fall back to the first fixture. No shipped fixture has that profile. A host probe over the real fixtures confirmed the selected provider is `moodle-sim`; the generic fixture's profile is `lti-generic`. Thus the corrected 12 faults and exact error-code assertions do not run on the generic channel as required by TEST-STRATEGY §2.4 (`:151`) and AC-08. N2 has the same mistaken selector.

**Suggested fix:** Select the protocol-control fixture from an explicit fixture/registry trait and fail if it is missing or ambiguous. Do not silently substitute an unrelated channel. Add a host assertion for the selected fixture, retaining the existing exact fault-list, valid-launch control and per-fault code checks.

### Round 3 verification and boundaries

- Private clone `/tmp/la-review-a-a69d11638d88`, detached at `af36ad31`, created with `git clone --no-hardlinks`; dependencies installed there only.
- Kit K0: `LA_LEVEL=k0 npx --no-install vitest run --reporter=verbose --config tests/ltiaas/kit/vitest.config.mts` — **13/13 PASS**, 1 file, 201 ms.
- Kit type check: `npx --no-install tsc --noEmit -p tests/ltiaas/kit/tsconfig.json` — **exit 0**.
- Private diagnostic suite: `npx --no-install vitest run --reporter=verbose --config reviewer-r3.config.mts` — **8/8 diagnostic assertions PASS**, 1 file, 182 ms. They confirm the current defects: all manifest loads fail, both setup parsers reject their captured bodies, L9 uses A twice, picker stops at the handoff, real `waitSync` is not an array, one anonymous artifact certifies three suites, and global selection picks the wrong fixture. M1 network/CLI calls were mocked; parsers and `waitSync` were real. This is host evidence, not a live K1 result.
- Probe source/config and logs remain in the private clone: `reviewer-r3.probe.test.ts`, `reviewer-r3.config.mts`, `reviewer-r3-probes.log`, `reviewer-r3-k0.log`, `reviewer-r3-types.log`. Cleared private `node_modules/.vitest-cache` before each Vitest run.
- The reviewed QA commit changes only the permitted kit and QA-report files. No product or frozen-test changes, and no LMS name added to core paths. K0's suite-neutrality check passes. Host negative coverage improves, but the executed probes show the behavioral acceptance coverage is incomplete.
- No Docker, stack, stack-starting host runner, K1-SIM execution or commit. Pending live evidence is not an additional finding in this host-only review. Reviewer-B's file was not opened. Only this review file was changed by this reviewer in integration; concurrent work was left untouched.

## Round 4

Reviewer-A: Codex GPT-6-Astra xhigh. Lens: “Is it right and is it safe?”

**Verdict: CHANGES_REQUESTED — 2 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT open.** Reviewed QA commit `30b5eb244e80e27ee49af657fd7dd93030441044`, integrated at `3a8b0e6f`, with `git diff af36ad31 3a8b0e6f -- tests/ltiaas/kit docs/reviews/LA-E7-06/qa.md`. All locations below refer to `3a8b0e6f`. This is the review after the last allowed fix round; the two open findings require the Lead's product-owner escalation under charter-LA §5. No additional fix round or live run is authorized by this review.

### Open Round 3 finding disposition

| Finding | Round 4 status | Evidence |
| --- | --- | --- |
| A-LA-E7-06-01 | **CLOSED** | `fixtures.ts:1114` requires an explicit matching suite identity. My current-wave full-run probe rejects anonymous files and reuse of a T3b file for T7, and accepts three correctly named files. The new K0 negatives also pass. |
| A-LA-E7-06-07 | **OPEN, BLOCKER** | L9 now uses distinct A/B sessions and asserts different library IDs. L7 now waits for both learners and checks shared placement, but retains the invalid comparison with the external resource ID. L4's new selector and expected-family table are wrong for shipped fixtures. Three focused host probes demonstrate those remaining L4/L7 failures below. |
| A-LA-E7-06-08 | **OPEN, BLOCKER** | Real Moodle/Canvas binding parsers now accept the captured setup bodies; simulator profile selection, the normal picker handoff, flat DTOs and single-object `waitSync` consumption are corrected. The picker helper now fabricates success for a redirect loop, and L10 still cannot consume real storage pages. D3 still posts the wrong picker field. |
| A-LA-E7-06-09 | **CLOSED** | Both global callers use `selectProtocolControlFixture` (`k1-launch.k1sim.test.ts:702`, `k1-nrps.k1sim.test.ts:148`). My probe selects `lti-generic`/`generic-sim` and rejects missing or duplicate controls. Exact fault names/codes, the valid launch control and no-call checks remain. |

Earlier closed findings A-02, A-03, A-04, A-05, A-06 and A-10 remain closed. The new evidence below continues A-07 and A-08 rather than creating duplicate finding IDs.

### A-LA-E7-06-07 — BLOCKER — L4 and L7 still reject correct product behavior

**Locations:** `tests/ltiaas/kit/suites/k1-launch.k1sim.test.ts:188`, `:194`, `:219`, `:396`, `:400`; `tests/ltiaas/kit/lib/fixtures.ts:1568`.

**Problem and evidence:** Predetermining an outcome fixes the prior post-hoc branching only if the selected family and expected outcome are correct. The following failures still prevent the required safety cases from passing under AC-01 / TEST-STRATEGY §2.4:

| Case | Confirmed remaining failure |
| --- | --- |
| L4 foreign launch-guarded family | The selector treats `operatorGrant && !registration.dynamic` as the guard trait. Blackboard is the only shipped match, so the Blackboard case excludes itself and gets `undefined`, then dereferences `.sim.family`. A host probe executed the selector expression extracted from the actual suite and confirmed there is no candidate. Canvas is launch-guarded but supports Dynamic Registration, so that predicate wrongly excludes it. |
| L4 foreign registration-guarded family | On Canvas, the second selector chooses Moodle. The new helper classifies `moodle` as registration-guarded and requires a warning, but the shipped registry has no guarded-family entry for it: the real `familyGuardVerdict` returns `{kind: 'pass'}`. My host probe confirmed that the kit rejects the correct silent 303. The guarded registration family here is `desire2learn`; Dynamic Registration support is not a guard-level indicator. Also, the warning lookup at `:219` defaults to the app log, while this is an LTI-service event (`tests/acceptance/M1/common/client.ts:192`). |
| L7 shared contextless placement | After validating the shared internal placement, the suite still requires its ID and both result-row IDs to equal `sharedRlId`, the external launch claim. A host probe used the real `upsertResourceLink` and `publicationResults` with an in-memory database. Both learners correctly share one generated `rl_…` ID, different from the external `rl-ctxless-…` value; the new shared-placement validator accepts that result, but the retained suite equality throws. Product sources: `services/cogniate-app/src/domain/launch.ts:62`, `services/cogniate-app/src/domain/results.ts:36`, `:127`. |

**Suggested fix for the escalated work:** Select foreign families using their actual declared guard level and derive expectations from that independent design data. Read the LTI-service warning with a relevant platform/trace filter. Keep L7's per-learner sent checks and shared internal-ID invariant, and remove the external-ID comparisons. The K0 cases must exercise the suite's selectors and final comparisons, not only the new helper functions with hand-built values.

### A-LA-E7-06-08 — BLOCKER — Page and picker callers still use incompatible contracts

**Locations:** `tests/ltiaas/kit/lib/runtime.ts:1245`; `tests/ltiaas/kit/suites/k1-launch.k1sim.test.ts:584`, `:603`, `:609`; `tests/ltiaas/kit/suites/k1-dl.k1sim.test.ts:156`.

**Problem and evidence:** The repaired request bodies and DTOs do not complete the caller audit. These remaining cases either reject a conforming response or report a response that never occurred:

| Boundary | Evidence |
| --- | --- |
| Picker handoff | After following the handoff, `openPickerOnChannel` changes a 303 whose Location points back to the same picker into status 200. My probe supplies that redirect loop: the returned `page.status` is 303, `status` is 200 and HTML is empty. A separate positive control supplies a real 200 picker and passes. Preserve the observed response; a redirect loop is not a successful page. |
| L10 storage login | It extracts an authorize URL with a regex over raw HTML instead of parsing `lti-storage-data`. The real renderer escapes query separators as `\u0026` in that JSON. A host probe against `storageLoginPage` confirms the extracted URL differs from `authUrl` and has no `state` query parameter; parsing the JSON gives the correct URL. Product: `services/lti-service/src/lti/storage-pages.ts:14`, `:49`. |
| L10 storage check | It calls `parseForm` on the storage-check HTML, but that page creates its form in JavaScript. The real `storageCheckPage` plus frozen `parseForm` throws `HTML form action present` in a host probe. The actual data block gives `postUrl` and `check`; the endpoint consumes `{check, value}` with the LTI origin, not the suite's `{state}`/`pendingId` fields and absent Origin (`services/lti-service/src/lti/launch.ts:109`). The current positive 303 assertion cannot be reached correctly. |
| D3 multiple selection | The form sends repeated `publicationIds` (plural) and expects 200. The real picker route reads only repeated `publicationId` (singular), so it sees zero selections and returns `PUBLICATION_NOT_AVAILABLE` (`services/cogniate-app/src/tool-pages/picker.ts:219`, `:226`). The negative single-selection branch uses the same wrong name, so its 400 can be unrelated to the multiple-selection restriction. This is source-confirmed; no SIM run was used. |

The C1 loader no longer throws, but its default “manifest” operand is now read from the same QA fixture (`fixtures.ts:354`) or copied from the supplied fixture (`:363`), rather than from the product manifest. A private mutation probe changed one fixture capability and supplied matching API maps: the purported manifest comparison passed while the real registry capability differed; substituting the real registry map correctly failed. The API-to-fixture checks still run, so this observation does **not** claim those checks were removed. It shows that the additional claimed manifest check is self-comparison and does not establish independent manifest equality.

**Suggested fix for the escalated work:** Preserve HTTP status values, consume the escaped storage JSON and documented storage-check body/origin, and use the real picker form field. Either obtain the manifest operand through the public registry or clearly limit the comparison to the API/fixture contract. Exercise the real page renderers and caller boundaries in host tests. Do not change product or frozen M1 contracts to accommodate the kit.

### Round 4 verification and boundaries

- Private clone `/tmp/la-review-a-29f08bae897a`, made with `git clone --no-hardlinks`, detached at `3a8b0e6f`; dependencies installed only there.
- Kit K0: `LA_LEVEL=k0 npx --no-install vitest run --reporter=verbose --config tests/ltiaas/kit/vitest.config.mts` — **16/16 PASS**, 1 file, 226 ms. Kit type check: `npx --no-install tsc --noEmit -p tests/ltiaas/kit/tsconfig.json` — **exit 0**.
- Re-ran my original Round 3 diagnostic source against this pin, changing only its scratch-output path: **6 old-defect assertions no longer hold; 2 still hold**. Those two exercise the unchanged `waitSync` return contract and an inline copy of the obsolete selector, so they are not evidence that the corrected callers still have those two bugs. The old picker mock always returns 303; its changed result exposed the status fabrication above. Full replay output: `reviewer-r3-replay.log`.
- Re-expressed the eight Round 3 boundaries as current-behavior checks, using the actual new selector and a real-200 picker control, and added seven focused diagnostic checks. `npx --no-install vitest run --reporter=verbose --config reviewer-r4.config.mts` — **15/15 PASS**, 1 file, 322 ms: eight regression checks and seven assertions confirming the remaining defects. This is diagnostic evidence, not K1 acceptance. It uses real binding parsers, public registry/family guard, `waitSync`, placement/result functions and storage-page renderers; network/CLI calls are mocked. The placement probe uses in-memory SQLite. The fixture mutation was confined to the private clone and restored.
- Private files: `reviewer-r4.probe.test.ts`, `reviewer-r4.config.mts`, `reviewer-r4-probes.log`, `reviewer-r4-k0.log`, `reviewer-r4-types.log`, plus the retained Round 3 replay files. Private `node_modules/.vitest-cache` was cleared before each Vitest run. No additional root or live suite result is claimed.
- The reviewed QA commit stays within the permitted kit and QA-report paths. No product, simulator or frozen-test changes, and no LMS name added to core paths; the suite-neutrality K0 check passes. The remaining gaps are in the safety oracles and runtime contracts, despite the green static/source-text checks.
- No Docker, stack, stack-starting host runner, K1-SIM execution or commit. Reviewer-B's file and probes were not opened. Only this review file was changed by this reviewer in integration. Live evidence remains pending, and its absence is not an additional finding in this host-only review.

## Round 5

Reviewer-A: Codex GPT-6-Astra xhigh. Lens: “Is it right and is it safe?”

**Verdict: CHANGES_REQUESTED — 1 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT open.** Reviewed QA commits `7859b25b` and `c07b575c`, integrated at `1698489b`, with `git diff 3a8b0e6f 1698489b -- tests/ltiaas/kit docs/reviews/LA-E7-06/qa.md`. All locations below refer to that pin. This is the extra fix round authorized by LA-H25(a), including the D3 ruling BD-A1-120 and storage-data ruling BD-A2-112. The previous page, picker and placement counterexamples are resolved; C1 still rejects a conforming API response.

### Open Round 4 finding disposition

| Finding | Round 5 status | Counterexample replay |
| --- | --- | --- |
| A-LA-E7-06-07 | **CLOSED** | L4 selects from explicit `guardedFamilies` data (`fixtures.ts:1685`) and runs the same case body in K0 and K1 (`cases.ts:83`; `k1-launch.k1sim.test.ts:185`). My replay uses the real registry and `familyGuardVerdict` for all five targets: Blackboard gets a Canvas launch guard, and Canvas gets the registration-guarded `desire2learn` warning in the LTI log. Removing that warning makes the case fail. L7's only final verdict now uses the two learners' internal placement IDs (`k1-launch.k1sim.test.ts:340`). Real in-memory SQLite placement/results with one generated ID pass; duplicate rows and wrong score paths fail. The publication placement count and both sent syncs remain required. |
| A-LA-E7-06-08 | **OPEN, BLOCKER** | Picker handoff retains actual 200, 303 and 403 statuses, including a 303 loop. L10 parses escaped JSON and the required check block; complete Canvas and generic-channel case replays pass against the real in-process login, launch and storage-check routes, with `{check, value}` and Origin. D3 sends repeated singular `publicationId`: the real picker returns 400 `PUBLICATION_NOT_AVAILABLE`, makes no Deep Linking call, remains unused, and then accepts one item on that same picker. The self-comparison called a manifest check is removed and the scope is accurately limited to API/fixture equality. However, that equality still confuses channel-level and profile-level capabilities, as shown below. |

Earlier closed findings remain closed. This round continues A-08 for the remaining C1 caller-contract failure rather than creating a duplicate finding ID.

### A-LA-E7-06-08 — BLOCKER — C1 requires profile-only keys in the channel-level provider map

**Locations:** `tests/ltiaas/kit/lib/fixtures.ts:1462`; `tests/ltiaas/kit/suites/k1-cap.k1sim.test.ts:102`; `tests/ltiaas/kit/kit.k0.test.ts:1542`.

**Problem:** `verifyBilateralCapabilities` compares all 17 fixture keys with both API maps. The provider entry is expressly a **channel-level** map (`docs/architecture/ltiaas/contracts/cogniate-app-api-delta.md:52`). Its two profile traits, `platform.sharing` and `site.serviceOrigin`, are absent by design. The connection DTO includes those traits for its selected profile. The C1 caller passes both maps directly and requires zero errors, so a correct product cannot pass AC-LA-E7-06-04.

**Evidence:** My host probe authenticated against the real app, used Fastify injection to GET `/app-api/lms-providers`, created a Canvas simulation-profile connection, and GET that connection. The provider response has 15 keys for each of the five shipped channels. The Canvas connection has 17. Passing those actual response maps and legacy flags into the kit comparator produces exactly these two errors:

```text
GET /app-api/lms-providers channelCapabilities["platform.sharing"] mismatch on "canvas": expected "exclusive", got undefined
GET /app-api/lms-providers channelCapabilities["site.serviceOrigin"] mismatch on "canvas": expected true, got undefined
```

The real route calls `channels.capabilities(m.id)` without a profile (`services/cogniate-app/src/app/connections.ts:149`); the connection DTO supplies one (`:94`). The kernel documents these keys as optional without a profile and conditionally emits them (`packages/channel-kernel/src/capabilities.ts:16`, `:19`, `:108`, `:110`). Artificially adding the two profile fields to the provider response makes the comparator pass; changing a fixture capability then correctly fails, confirming that the API comparison itself is active. The new K0 C1 test copies the entire 17-key fixture into its simulated registry answer (`kit.k0.test.ts:1542`), so it misses this boundary despite the green host suite.

**Suggested fix:** Give the provider and connection comparisons separate expectations at their documented capability levels. Keep exact required-key, value and unknown-key checks for each level; do not change the product API or simply tolerate all missing keys. Add a positive host case with the real 15-key provider shape and 17-key connection shape, plus negatives for a missing channel capability and a missing connection profile trait. Keep the fixture-mismatch and unknown-key negatives.

### Round 5 verification and boundaries

- Private clone `/tmp/la-review-a-5bbade125d93`, made with `git clone --no-hardlinks`, detached at `1698489b`. Dependencies were copied into the private clone; no install or test ran in integration.
- Kit K0: `LA_LEVEL=k0 npx --no-install vitest run --reporter=verbose --config tests/ltiaas/kit/vitest.config.mts` — **24/24 PASS**, 1 file, 280 ms. Kit typecheck: `npx --no-install tsc --noEmit -p tests/ltiaas/kit/tsconfig.json` — **exit 0**. Logs: `reviewer-kit-k0.log`, `reviewer-kit-types.log`.
- Independent replay: `node_modules/.bin/vitest run --reporter=verbose --config reviewer-r5.config.mts` — **12/12 diagnostic assertions PASS**, 1 file, 1.24 s. Eleven checks verify corrected boundaries; the C1 check confirms the remaining defect, so this is not K1 acceptance. Source, config and final output are retained as `reviewer-r5.probe.test.ts`, `reviewer-r5.config.mts` and `reviewer-r5-probes.log` in the private clone. The probes use real product functions, in-memory SQLite and in-process HTTP injection; external transport and Deep Linking signing are test doubles where noted in the source.
- The commits stay within the permitted kit and QA-report paths. They change no product, simulator or frozen M1 source and add no LMS name to core paths. The new executable case checks cover the old L4/L7, page and picker failures; the C1 host fixture shape remains the demonstrated coverage gap.
- No Docker, stack, stack-starting runner, K1-SIM execution or commit. No Reviewer-B file or probe was opened. Only this review file was changed by this reviewer in integration. Live evidence remains pending; its absence is not an additional finding in this host-only review.

## Round 6 (A-08 re-check)

Reviewer-A: Codex GPT-6-Astra xhigh. Lens: “Is it right and is it safe?”

**Verdict: APPROVE — 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT open.** Reviewed QA commit `acbc0feb`, integrated at `e17a7a44`, using `git diff 1698489b e17a7a44 -- tests/ltiaas/kit docs/reviews/LA-E7-06/qa.md`. This review covers only A-LA-E7-06-08 and new defects in the changed lines. No new finding. Earlier closed findings remain closed.

**A-LA-E7-06-08: CLOSED.** The comparator now checks the provider map against the 15 channel-level keys and the connection map against all 17 selected-profile keys (`tests/ltiaas/kit/lib/fixtures.ts:1476`, `:1501`). Missing keys and wrong values still fail. Extra profile traits on the provider map and unknown keys on either map also fail. The two profile traits match LA-ADR-01 D3, and the new K0 test verifies the key list against that design table (`kit.k0.test.ts:1576`). The suite and README now describe the two levels correctly.

The unchanged Round 5 C1 probe now receives `[]` from the actual 15-key provider and 17-key Canvas connection HTTP responses, so its old-defect assertion fails as expected. My revised positive-control probe accepts those same responses. It then removes and changes each of the 15 provider keys and 17 connection keys in turn, adds an unknown key to either map, adds each profile trait to the provider map, and changes a fixture capability: every invalid case is rejected. The probe uses authenticated Fastify injection with the real app and in-memory SQLite; it starts no server or stack.

Verification in private clone `/tmp/la-review-a-11c353feeb1d`, created with `git clone --no-hardlinks` and detached at `e17a7a44`, with dependencies copied into that clone:

- Kit K0: `LA_LEVEL=k0 node_modules/.bin/vitest run --reporter=verbose --config tests/ltiaas/kit/vitest.config.mts` — **25/25 PASS**, 204 ms (`reviewer-r6-kit-k0.log`). An initial concurrent attempt hit a private Vitest cache-removal conflict before running tests; the serial rerun passed.
- Real API C1 probe: `node_modules/.bin/vitest run --reporter=verbose --config reviewer-r6.config.mts` — **1/1 PASS**, 551 ms (`reviewer-r6-c1.log`; source `reviewer-r6-c1.probe.test.ts`). The unchanged old-defect replay is retained in `reviewer-r5-c1-replay.log`.
- Regression sensitivity: replacing only the comparator with its Round 5 implementation makes the new `C1 levels` K0 test fail on the valid provider shape (`reviewer-r6-old-comparator-mutant.log`). Restored the file and confirmed no tracked diff in the private clone.
- Kit typecheck: `node_modules/.bin/tsc --noEmit -p tests/ltiaas/kit/tsconfig.json` — **exit 0** (`reviewer-r6-types.log`).

The commit changes only permitted kit and QA-report files, with no product, simulator or frozen-test changes and no LMS name added to core paths. No Docker, stack, K1-SIM run, integration install or commit. Reviewer-B's file and probes were not opened. Only this review file was edited in integration. Live K1 evidence remains pending; this approval closes the host-review finding and does not claim a live kit pass.
