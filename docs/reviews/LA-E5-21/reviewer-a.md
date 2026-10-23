Verdict: CHANGES_REQUESTED
Round: 1

## Round 1

Reviewer-A: Codex GPT-6-Astra, xhigh. Date: 2026-10-23 (+07).

Reviewed `c8faf49`, `c19e722` and `caf437f` (merge `2a15f5b`). Test snapshot: `d8cb6af6958afae2c12381700faf180e7ad99609`, private clone `/tmp/la-review-a-d7ce4dfe99d4`.

Basis: LA-E5-21; LA-ADR-06 D12 and D6; security delta §15; operability §2; plan §6.1 and ownership matrix §5. D12 is in LA-ADR-06, rather than LA-ADR-07 as named in the dispatch. No earlier Reviewer-A file existed. Review was blind.

### A-LA-E5-21-01 — MAJOR — Production accepts a master-key file with unsafe permissions

**Location:** `packages/shared/src/config.ts:63`–`:65`; production caller: `services/lti-service/src/config.ts:54`.

**Problem:** `readSecretSetting` reads any file the service can read, without checking its permissions. A key file readable by every local user is accepted by production configuration. Operability §2 specifies secret files with mode `0600`, and the dispatch explicitly requires wrong permissions to refuse startup. OS read access alone does not enforce that rule.

**Evidence:** An independent probe wrote a valid fixture key with mode `0600`, changed the mode to `0644`, and called `loadConfig` with `STACK_PROFILE=production`, `LTI_MASTER_KEY_FILE`, a trusted proxy and the loopback operator host. Configuration succeeded and returned the key; the expected refusal assertion failed. Separate probes confirmed that mode `0000` gives `EACCES` and a missing master-key file gives `ENOENT`. Those refusals do not cover an overly permissive file. No shipped test changes the file mode.

**Suggested fix:** Check the secret file's permission policy before accepting its contents, preferably on the same opened file descriptor used for the read. Refuse unsafe group/world access with a fixed diagnostic that contains no key material. Add tests for the documented safe mode, world/group-readable or writable modes, unreadable files and missing files. Preserve the existing default/acceptance environment-key support.

### A-LA-E5-21-02 — MAJOR — A valid key ring still requires a second key source

**Location:** `services/lti-service/src/config.ts:54`–`:55`; startup ordering: `services/lti-service/src/main.ts:38` and `:52`.

**Problem:** Startup always requires `LTI_MASTER_KEY` or `LTI_MASTER_KEY_FILE` before it loads the key provider. In production the environment form is forbidden, so a deployment with a complete valid `LTI_KEYRING_FILE` still needs a separate master-key file. LA-ADR-06 D12 expressly allows the key ring, and D6 makes the standalone master key a fallback when no ring exists. The Author's note describes a real implementation limit; it does not resolve that design mismatch.

**Evidence:** A private probe created a mode-`0600` ring with active version `k2` and valid `legacy` and `k2` keys. With no `LTI_MASTER_KEY` or `LTI_MASTER_KEY_FILE`, `readKeyRing(env)` accepts it and returns active version `k2`. The same production environment fails in `loadConfig` with `LTI_MASTER_KEY must be 64 hex characters ... or the file LTI_MASTER_KEY_FILE must hold them`. The provider is never reached. This is an inherited startup precondition left unresolved by the new production/file configuration, not a new failure in the ring parser.

**Suggested fix:** Let startup obtain its key handle from the validated ring without requiring a second secret source. Use the existing provider-loading seam and coordinate any S2-owned change; do not add a second ring parser. Retain the legacy fallback when the ring is absent. Add a production start test with only the ring, and retain tests for missing referenced versions and legacy fallback.

### Checks and evidence

The focused baseline passed **65 tests in 5 files**:

```sh
NODE_NO_WARNINGS=1 npx vitest run \
  packages/shared/src/config.test.ts \
  services/lti-service/src/config.test.ts \
  services/lti-service/src/main.test.ts \
  services/lti-service/src/keys/key-config.test.ts \
  services/cogniate-app/src/cli/audit.test.ts
```

Log: `/tmp/la-review-a-d7ce4dfe99d4-baseline.log`. TypeScript checks passed for the shared package, LTI service and Cogniate app.

Independent checks in `services/lti-service/src/reviewer-a-production-probe.test.ts`, created only in the private clone, gave **2 failures** for the findings above and **2 passes**:

- All six production refusals were checked in real child processes, with later unsafe settings still present. Each exits 1 with exactly one JSON `config_refused` line, the first D12 reason, no stderr/stack trace, no fixture key or allowlist value, and no database creation.
- Missing, unreadable and malformed master-key files refuse. A malformed file's content is absent from the error stack. Conflicting environment/file values give a fixed error naming only the settings. The existing shared test also checks the exact conflict error.

Command: `NODE_NO_WARNINGS=1 npx vitest run services/lti-service/src/reviewer-a-production-probe.test.ts`. Log: `/tmp/la-review-a-d7ce4dfe99d4-probes.log`.

UNIT AC-02 through AC-06 have focused tests. Disabling only the new production guard in the private clone made **7 tests fail**, including the five UNIT criteria and the order checks; the mutation was restored. Log: `/tmp/la-review-a-d7ce4dfe99d4-config-control.log`. Default/acceptance values and the loopback address checks pass. No secret content is interpolated into the new fixed refusal reasons or the master-key format/conflict errors.

### Scope and remaining gates

The diff stays in S1's config/helper files and adjacent tests, the explicitly dispatched `main.ts` change, and the one-line S2 export under RQ-2. It does not edit the app config, shared knob registry, `infra/**`, `tests/**` or frozen acceptance assertions. No LMS-specific core branch was added.

Open findings: **2 MAJOR**, no BLOCKER. Fix the file-permission check and ring-only startup, then retest. K1-SIM AC-01/07 and full regression gates remain with QA. No Docker, stack or host stack runner was used. Only this review file was written for this item in the integration worktree; no product edit, commit or push was made.
