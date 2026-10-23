Verdict: APPROVE
Round: 2

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

## Round 2

Reviewer-A: Codex GPT-6-Astra, xhigh. Date: 2026-10-23 (+07). Reviewed `68e2d44`, `1f6ddc7`, `fd9b512` and `eb1d415` against BD-A2-77 through BD-A2-80, LA-ADR-06 D6/D12, operability §2, the task spec and plan §6.1. Test snapshot: `a3e50efeab51a92ade5c260ba489842821d3eaa8`, private clone `/tmp/la-review-a-bdddf01d8b4c`. Blind review.

**Verdict: APPROVE. Open counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**

- **A-LA-E5-21-01 is closed.** `readSecretFile` checks the opened descriptor with `fstat`, rejects non-regular files, applies the group/world-bit mask and reads that same descriptor. Production rejects unsafe modes; default/acceptance warn and continue for readable regular files. Both master-key and key-ring reads use it. Tests cover safe modes `0600`/`0400`, several unsafe modes, symlink targets, directories, unreadable files and missing files.
- **A-LA-E5-21-02 is closed under BD-A2-77.** `loadConfig` no longer requires a separate master key. `main.ts` reads `readStartupKeys` before opening the database and passes its ring to `loadKeyProvider`. A valid ring containing `legacy` starts production by itself; its legacy bytes become the shared handle. A supplied master key must match that version. Missing rings retain the legacy fallback.

The two changed S2 assertions follow the ruling exactly: a ring without `legacy` now gives `key_ring_invalid` before provider startup, and a differing standalone master key is refused instead of silently ignored. The missing non-legacy version test still checks `key_provider_not_ready` and failed readiness, so that coverage was retained. No unrelated acceptance expectation was removed.

The seven refusal messages match operability §2. Their fields contain fixed text and setting names, with no secret value or path in the mode refusal. Hex-key reads validate 64 hex characters and compare after case normalization; other secrets retain exact string comparison. The six production checks retain D12 order.

The Round 1 production probes were rerun through `loadConfig` plus the new `readStartupKeys` boundary. **All four passed**, including the formerly failing mode and ring-only cases. Two more independent probes passed:

1. A process with an unsafe master-key file exits 1 with one fixed `secret_file_mode` JSON line, no stderr/stack trace, no key/path value and no database creation.
2. Startup keeps using the loaded ring when its file is replaced after `readStartupKeys` returns but before provider binding. The reader is called once and the active provider version remains correct.

The combined focused run passed **115 tests in 12 files**, and the combined independent run passed **11 probes**, as documented in [LA-E5-20 Reviewer-A](../LA-E5-20/reviewer-a.md). TypeScript checks passed for the shared package and both services. The existing production guard and readiness UNIT tests remain green.

Regression controls in the private clone were detected: bypassing the mode check caused **5 test failures**; requiring a separate master key again caused the real ring-only startup test to fail. Both mutations were restored and compared with the snapshot. Logs: `/tmp/la-review-a-bdddf01d8b4c-mode-control.log` and `/tmp/la-review-a-bdddf01d8b4c-ring-control.log`. Baseline and probe logs use the same prefix with `-baseline.log` and `-probes.log`.

No new finding. The S2 export and key-config/test changes are the explicit RQ-2 scope of this dispatch. App config, the knob registry, infrastructure, QA `tests/**` and frozen assertions are untouched; no LMS-specific core branch was added. Only this review file was edited for this item in the integration worktree. No Docker, stack, host stack runner, commit or push was used. No Reviewer-A fix remains; QA and the Lead own final regression closeout.
