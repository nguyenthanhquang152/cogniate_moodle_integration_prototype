Verdict: APPROVE
Round: 2

# LA-E5-22 review: Reviewer-A (lens "Is it right and is it safe?")

## Round 1

- Reviewer: Claude Code Opus 5.5 xhigh (Reviewer-A, same session as LA-E3-15 and LA-E3-16).
- Diff: `git diff c62b373^1 c62b373` (lane K). Commits:
  - `90d1207`: RQ-2 S files; the `app-keys` folder and the e2e tmpfs;
  - `f7e0e9c`: settings, the start rules and the sealing wrapper;
  - `b0fed78`: RQ-2 R file; AGS opens the service key through the key provider;
  - `e58cf6e`: RQ-2 R file; readiness `key_version_missing`;
  - `f4545c7`: row-bound associated data and `PortContext.seal(value, column)`;
  - `06cf4ca`: the `app:keys` CLI.
- References: `docs/architecture/ltiaas/tasks/LA-E5-22.md`; LA-ADR-06 D6 ("Blob format", "Associated data", "Re-wrap", "Scope in LA"), D12; operability §2, §6.3; security delta §10; A2 BD-A2-91; the shared `packages/shared/src/key-provider.ts` and `config.ts` (read only).
- I ran these in a private clone at `c62b373`. I deleted the Vitest cache before each run. No Docker, no stack.
  - `npm run test:unit` (all workspaces): 195 files, 3150 tests pass, 5 skipped.
  - `npm run test:infra`: exit 0. It includes the new `compose-e2e-secrets` check.
  - `npm run test:k0`: 147 tests pass.
  - F1 and F5 PASS; `npm run typecheck`: exit 0; ESLint on `services/cogniate-app`, `packages/channels/moodle` and `infra/scripts`: clean.
  - Three probes (below). The probe file is kept at `/tmp/ra-e201/e522/ra-e522-probe.test.ts`.
- Blind review: I did not open the other reviewer's file.
- **Counts: 0 BLOCKER, 0 MAJOR, 2 MINOR, 0 NIT.**

### Checks (the lens A focus of the brief)

| Check | Result |
| --- | --- |
| No key material in logs, env or e2e-visible paths | Holds. **Logs:** errors name settings or tables, never values. Examples: `key_open_failed` "A sealed value of table connection did not open (auth_failed)"; the fixed `secret_file_mode` and `app_master_key_in_env` texts; `parseKeyRing` names only the version id; the AGS failure logs `err.name` only. `app:keys status`/`rewrap` print versions and counts, and the audit event has counts only. **Env:** `production` refuses `APP_MASTER_KEY` before any file is read (`config_refused app_master_key_in_env`, fixed text). The dev compose still passes the env value for the default profile, as the LTI service does. **Files:** `APP_MASTER_KEY_FILE` and the ring are read with `readSecretFile` (`fstat` on the open descriptor). A group or world bit is refused in `production` and only warned otherwise. Probe P3: a ring with `0644` gives `secret_file_mode` in production and `ok` in default. **e2e:** `infra/.secrets/app-keys` is hidden by its own tmpfs, it is not bound anywhere else, and only `cogniate-app` mounts it, read only. The infra test checks all three. `stack-up.sh` and `prepare_e2e` make the folder with mode `0700`. |
| Associated data cannot be swapped between rows, columns or libraries | Holds for every new blob. The associated data is `app:<table>:<column>:<library_id>:<row key>`, and `associatedData` refuses `:` in the table, column or library, so the row key (last part) is unambiguous. Each call site uses its own row:<br>- web-services token: connection id (through `PortContext`, bound connection only);<br>- ref copy: `ref_token_hash`, sealed with the session library;<br>- service key: resource-link id, sealed inside `upsertResourceLink` with the row id;<br>- picker ltik: the stored hash, with the library of the picker's connection.<br>The re-wrap uses the same `appAad`. Probe P1, on a ws-token blob: another connection of the same library, another library, and the ref-copy column of the same row each give `auth_failed`; its own row opens. Legacy blobs carry no associated data, so they can be moved until they are re-wrapped. D6 accepts this (A-LAD-16), and the app has no legacy refusal in LA (BD-A2-91). The re-wrap covers the long-lived columns. |
| Legacy blobs still open; runtime token unchanged | Holds. A blob without the header opens with the version `legacy` (the GCM tag proves it). The ring must hold `legacy`, else the start is refused, so legacy blobs and the runtime token never lose their key. The runtime token is `macSync('runtime-token', 'legacy')`, whose subkey is the master key itself, so it equals the old `HMAC-SHA-256(APP_MASTER_KEY, …)`. The AC-04 golden test compares with the old formula and a fixed value. |
| Re-wrap under concurrent writes | Holds. Rows are read first. Each batch of 100 is one synchronous transaction: authenticated open, seal with the active version, then a compare-and-set `UPDATE … WHERE <key> = ? AND <column> = <old blob>`. A row that another writer changed (the app process, another CLI run) gives 0 changes and is counted as `skippedChanged`, so no write is lost. Each new blob has a fresh IV, so no blob is written twice. An unreadable row is counted with its header version, the run continues, and `outcome` is `failed`. Test: the racing writer keeps its value `token-b2`. Probe P2: a legacy blob whose IV looks like a `k2` header (structural version `k2`) is re-sealed to a real `k2` blob, and the value is kept. See A-LA-E5-22-01 for the missing committed test. |
| Fail closed when unbound or when a version is missing | Holds. After `bindKeyProvider`, any other `Buffer` throws `key_provider_not_bound` (WeakMap identity; test "an unbound handle fails closed"). `main.ts`, the worker and `operatorRuntime` bind before any seal or open, and `seed-portal.ts` seals nothing. A version that a row uses but the ring lacks: the start logs `key_provider_not_ready {version}`, `/readyz` gives `503 key_version_missing`, and opening such a row gives `key_open_failed (version_missing)` (probe P3). See A-LA-E5-22-02 for what that does to score dispatch. |
| Production refusal | Holds: `app_master_key_in_env` (test) and `secret_file_mode` for the key file and the ring (test, probe P3). |
| UNIT ACs | AC-02 (header plus legacy), AC-03 (another library), AC-04 (golden) and AC-05 (file equals env, hex without case) have tests that fail on the old code. AC-01 and AC-06 are QA rows (U1, MOODLE-LIVE). |
| Must-not-edit list and ownership | `packages/shared/src/key-provider.ts` and `services/lti-service/**` are not touched. The other-lane edits are the named RQ-2 commits: S for infra, R for the AGS driver and readiness. The Moodle channel lines are K's own. F1 PASS. |

### Findings

- **A-LA-E5-22-01 (MINOR): the unit test that BD-A2-91 names for a colliding legacy blob is missing.**
  - Where: `services/cogniate-app/src/app/sealing.ts:195` decides "already in the active version" from the authenticated metadata. `sealing-start.test.ts:52-68` re-wraps only an ordinary legacy blob.
  - Problem: the task notes list three unit tests: "a ring without legacy stops the start; APP_MASTER_KEY in the production environment is refused; a re-wrap of a colliding legacy blob re-seals it". The third is not in the diff. Suppose someone changed line 195 to the structural `blobKeyVersion(row.blob) === active`. Every committed test would still pass, but a legacy blob whose IV looks like a header of the active version would stay in the legacy form. The code is right today: probe P2 re-seals such a blob.
  - Suggested fix: add the probe as a test. Build a legacy blob whose IV is `"cgk1" + 0x02 + "k2" + 0x00 0x3c + 3 bytes` (AES-GCM, master key, no associated data). Check that its structural version is `k2`, run `rewrapAppBlobs` with the active `k2`, and check `rewrapped: 1` and `legacyFormat: false` with the same value.

- **A-LA-E5-22-02 (MINOR): a missing key version fails score dispatches for good, not for later retry.**
  - Where: `services/cogniate-app/src/drivers/lti-ags/index.ts:56-61` maps every service-key open error to `local_failure`. `packages/tracking/src/outcome.ts:109` makes that status `failed` with no next try. The same root cause also makes `connectionJson` throw while it opens the ref copy (`app/connections.ts:75`), so the library's connection list answers `500`.
  - Problem: before LA-E5-22, a decrypt failure meant a corrupted blob. With versions, the most likely cause is a ring that the operator can fix: a version removed too early, or a ring file written while the running app was not restarted. That last case is new for the app, because `app:keys rewrap` runs in a separate process. It loads the ring from the file and can move the long-lived blobs to a version that the running app does not have yet. Until the ring is fixed, each score dispatch becomes `failed`, and someone must send each row again by hand (`POST /score-syncs/:id/resend`). The app fails closed and no plaintext leaks, but grade deliveries are lost from automatic delivery.
  - Suggested fix:
    1. In `deliver`, map a `KeyProviderError` with reason `version_missing` (and `key_provider_not_bound`) to `retryable` with backoff. Keep `auth_failed`, a moved or corrupted blob, as `local_failure`.
    2. Make the order explicit in operability §6.3 (A2) and in the `app:keys rewrap` output: write the ring, restart the app and check `/readyz` = 200, then re-wrap. A cheap guard is also possible: the CLI refuses `rewrap` when the active version of the ring file is not the version of the newest blob that the app sealed.

### Verdict

APPROVE for lens A. Key material stays out of logs, the production environment and the e2e container. New blobs are bound to their row, column and library. Legacy blobs and the runtime token keep working. The re-wrap is compare-and-set safe. An unbound handle or a missing version fails closed. The two MINOR findings go to `deferred.md`, or to K's next commit on these files.

## Round 2

- Reviewer: Claude Code Opus 5.5 xhigh (same session as round 1).
- Diff: `git diff 760b4e77^1 760b4e77` (lane K fix round 1, `051ae4c8`). References: A2 BD-A2-97 (ratified); BD-A2-91; LA-ADR-06 D6; operability §6.3.
- I ran these in the private clone at `760b4e77`. I deleted the Vitest cache before each run. No Docker.
  - `npm run test:unit`: 3159 tests pass, 5 skipped.
  - `npm run test:k0`: 145 tests pass.
  - F1 PASS; `npm run typecheck`: exit 0; ESLint on `services/cogniate-app`: clean.
  - My round 1 probes, run unchanged: P1 swaps refused, P2 colliding blob re-sealed, P3 production ring mode and missing version.
  - One mutation check (below).
- Blind review: I did not open the other reviewer's file.
- **Counts (open after round 2): 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**

| Finding | Status | Evidence at `760b4e77` |
| --- | --- | --- |
| A-LA-E5-22-01 (MINOR): the colliding-legacy re-wrap test is missing | **Closed** | `sealing-start.test.ts` adds the case. A legacy blob has an IV of `"cgk1" + 0x02 + "k2" + 0x00 0x3c + 3 bytes`, so its structural version is `k2` and the authenticated metadata says `legacy`. The re-wrap with the active `k2` re-seals it with the same value, and a second run does nothing. Mutation check: I added a structural early skip (`if (blobKeyVersion(row.blob) === active) continue;`) before the open in `rewrapAppBlobs`. The new test then fails (1 failed, 3 passed). I restored the file. |
| A-LA-E5-22-02 (MINOR): a missing key version fails dispatches for good | **Closed** (BD-A2-97) | The new `keyVersionUnavailable(handle, blob, err)` (`app/sealing.ts`) is true only for `key_provider_not_bound`, or for `key_open_failed` when the blob's header version is not in the ring. A legacy blob always reads as `legacy`, which the ring must hold, so a legacy blob with a failed tag stays loud.<br>**AGS `deliver`:** that case gives `{kind: 'retryable', uncertain: false}` and sends nothing (`beginSend` is not called). The outbox retries with backoff inside the 24 h window (`dispatchResult`), and `auth_failed` stays `local_failure` (test: an unknown-version key gives retryable; a legacy blob of another key gives local_failure).<br>**Connection list and detail:** only that row loses `registrationUrl` and its expiry (`200`). "Get registration URL" makes a new ref with the running ring. A copy moved from another row (`auth_failed`) still gives `500` (test).<br>**Order text:** "write the new key ring, restart the app and check /readyz = 200, then run app:keys rewrap" is in the file header, the usage output and the re-wrap output (tests updated). |

Lens A notes on the fix:
- The retryable class depends only on whether the ring lacks a version. That is an operator state, and `/readyz` reports it as `key_version_missing`.
- A blob copied verbatim from another row keeps a header version that the ring has, so it fails with `auth_failed`. Moved data therefore stays a loud failure (`500` / `local_failure`). It is not silently retried.
- Only a writer that also forges a header with an unknown version can make a failure "retryable". That writer already has database write access, and the value still never opens.
- No key material and no plaintext appear in the new texts.

### Verdict (round 2)

APPROVE for lens A. Both round 1 MINORs are closed with tests that fail on the old code. The round 1 checks still hold at `760b4e77`.
