Verdict: CHANGES_REQUESTED
Round: 1

## Round 1

Reviewer-B: Codex GPT-6-Astra, xhigh. Date: 2026-10-23. Lens: Can a human team own it?

Reviewed `c8faf49`, `c19e722` and `caf437f` against LA-E5-21, LA-ADR-06 D6/D12, security delta §15, operability §2, plan §6.1 and the ownership matrix. The task spec points to LA-ADR-06 D12, which is the production-profile design used here. Verification ran in a private `git clone --no-hardlinks` at integration SHA `d8cb6af`. No other reviewer's file was opened.

### B-LA-E5-21-01 — MAJOR — A valid key ring still requires a separate master-key file

**File:** `services/lti-service/src/config.ts:54–55`; startup ordering at `services/lti-service/src/main.ts:38` and `:52`.

**Problem:** An operator cannot start production with only a valid `LTI_KEYRING_FILE`, although D6/D12 allow the ring as the key source.

**Evidence:** `loadConfig` unconditionally requires `LTI_MASTER_KEY` or `LTI_MASTER_KEY_FILE` before startup reaches `loadKeyProvider`. The environment value is forbidden in production. A fresh production-service probe with a valid ring, a trusted proxy and loopback operator bind fails before opening the database with `LTI_MASTER_KEY must be 64 hex characters (npm run gen-env), or the file LTI_MASTER_KEY_FILE must hold them`. The same ring starts successfully when a separate master-key file is added. A master-key-file-only start also succeeds. The ring is valid; the extra requirement comes from config loading. D6 describes the master key as the fallback when the ring file is absent, and D12 expressly allows the ring. The refusal directs the operator toward a redundant secret file or an environment setting that production refuses.

**Suggested fix:** Resolve the key-ring source before requiring the legacy fallback. Preserve the binding of the validated provider to the handle used by store callers, with any needed S2 ownership request. Add a full `startLtiService` test with only `LTI_KEYRING_FILE` and neither master-key setting; keep the working master-key-file case and the environment-value refusal covered.

Scope clarification was requested through the coordinator as `msg_62a2d9fb02a5`; it was unanswered at review completion. This finding follows the published D6/D12 contract, not an assumed answer or approval.

### B-LA-E5-21-02 — MINOR — Add the recovery action to each refusal line

**Files:** `services/lti-service/src/main.ts:41`; `services/lti-service/src/config.ts:38`.

**Problem:** The production refusal line names a rule but gives no setting name or recovery action, so it does not let an operator fix the cause from that line alone.

**Evidence:** Six real entry-point probes each exited 1 and wrote one JSON line, but the diagnostic content was only one of the six reason codes. For example, `test_knob_active` does not identify `LTIK_TTL_SECONDS`; `master_key_in_env` does not tell the operator to unset `LTI_MASTER_KEY` and use `LTI_MASTER_KEY_FILE`; `no_trusted_proxy` does not name `TRUSTED_PROXY_CIDRS`. The rule order and refusal behavior are correct, so this is safe to defer.

**Suggested fix:** Keep the stable reason codes and add a fixed recovery message that names the setting and the required change. For a test knob, include only its registered name, not its value. Name secret-file settings without echoing key contents or arbitrary input. Pin the messages in tests, as the app CLI does.

### B-LA-E5-21-03 — MINOR — Keep one comparison rule for a hex master key

**Files:** `packages/shared/src/config.ts:67`; caller `services/lti-service/src/config.ts:54`; existing comparison `services/lti-service/src/keys/key-config.ts:40`.

**Problem:** The new reader treats upper- and lower-case hex encodings of the same master key as conflicting secrets, while the existing key provider accepts them.

**Evidence:** With a file containing `ab` repeated 32 times and `LTI_MASTER_KEY` containing the same bytes as upper-case hex, both `default` and `acceptance` now fail with `LTI_MASTER_KEY and LTI_MASTER_KEY_FILE have different values`. The pre-`caf437f` config loader and the current `readKeyRing` both accept those exact settings. The key-provider test already covers this equivalence. This is a small compatibility change outside the intended production-only refusals; either removing the duplicate setting or using one letter case avoids it.

**Suggested fix:** Apply hex-key normalization or decoded-byte comparison consistently at the LTI key boundary, with tests through `loadConfig` in both existing profiles. Keep the generic reader case-sensitive for secrets whose case matters. Coordinate a shared comparison with S2 if needed, rather than leaving two different rules for the same key.

### Review checks and validation

- The six production rules have a small, ordered guard. Real entry-point probes for all six exit 1, produce one JSON line with the expected reason, produce no stack trace and create no database. A separate probe with `LOG_DIR` set confirms that the same line reaches the log file before exit.
- A real production service with only `LTI_MASTER_KEY_FILE` starts on temporary ports and closes cleanly. The file is trimmed and decoded correctly; mismatched environment/file values fail without printing their contents.
- UNIT AC-02–06 each has a direct assertion. Disabling only the production guard caused seven expected test failures, including every refusal AC. The file-based half of AC-04 also rejects the old environment-only loader. Restoring the source made all config tests pass.
- S1 owns both configuration files and the service entry point in this wave; `c19e722` is the explicit RQ-2 export. The app config, shared knobs and infrastructure were not edited. No `tests/**` change or new LMS name in core paths was found. The compatibility exception is recorded in B-LA-E5-21-03.

The combined dispatch run passed **65 tests in 5 files**:

```sh
./node_modules/.bin/vitest run packages/shared/src/config.test.ts services/lti-service/src/config.test.ts services/lti-service/src/main.test.ts services/lti-service/src/keys/key-config.test.ts services/cogniate-app/src/cli/audit.test.ts --maxWorkers 2
```

Both service type checks, ESLint on the nine changed TypeScript files, and F1/F5 passed. The config and audit CLI suites passed all 36 tests after the private mutations were restored. Evidence is in `/tmp/la-review-b-34de19be90b5/reviewer-b-focused.log`, `reviewer-b-no-production-guard.log`, `reviewer-b-restored.log`, and the `reviewer-b-startup-probe`, `reviewer-b-refusal-log-probe` and `reviewer-b-key-case-probe` `.mjs`/`.log` pairs.

No Docker or stack runner was used. K1-SIM AC-01/07 and the health golden remain QA gates.

Only this review file was changed for this item. Open findings: **1 MAJOR and 2 MINOR; 0 BLOCKER**.
