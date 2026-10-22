Verdict: APPROVE
Round: 2

# LA-E5-08 review: Reviewer-A (lens "Is it right and is it safe?")

- Diff: `git diff 1b17261 3f9120b` (lane commit `3f9120b`; merged as `85a1882`).
- References: `docs/architecture/ltiaas/tasks/LA-E5-08.md`; LA-ADR-06 D6 and AP-06-23..26; the Lead-approved RQ-2 edits (`packages/shared/src/index.ts`, two export lines; `services/lti-service/src/db/migrations.test.ts`, `.slice(0, 4)`).
- Known open item: S1 still has to call `loadKeyProvider` in `main.ts` and `cli/bootstrap.ts`, and add the compose mount. Until then, the stores use `LTI_MASTER_KEY` as ring version `legacy`.
- Blind review: I did not open the other reviewer's file. I wrote my findings before I judged the Author's listed choices; my judgement is at the end.
- **Counts: 0 BLOCKER, 0 MAJOR, 1 MINOR, 1 NIT.**

## Checks

| Check | Result |
| --- | --- |
| Blob format and associated data (D6) | Correct. The blob is `"cgk1"` \| version length \| version \| wrapped-key length (2 bytes) \| wrapped data key \| value. AES-256-GCM is used throughout, with a fresh data key and fresh IVs per blob (`packages/shared/src/key-provider.ts:177-189`). The wrap uses the header as associated data, so a renamed version id does not open (test `key-provider.test.ts:124-138` uses two versions with the same key bytes). The value uses `lti:<table>:<column>:<account>:<row key>`. `parseHeader` checks every length before it reads (`:108-117`). The data key is zeroed after use. |
| Legacy blobs | Correct. A blob without the header opens with version `legacy` and no associated data, as `crypto.ts` did. A blob with a valid-looking header falls back to the legacy form, and the GCM tag proves the result (`:211-218`; test `:113-122`). A ring without `legacy`, or with another key under that id, fails closed (test `:108-110`). |
| Service-key values (M1 byte-identical rule) | Kept. `mac('service-key', 'legacy')` = `HMAC(HMAC(master, 'cogniate-lti/service-key/v1'), input)` (`:80-83`, `:221-228`). Golden values captured before the change are hard-coded (`key-provider.test.ts:40`; `service-keys.test.ts`, generation 0 and 1). The values stay the same when another version is active. The migration test on an M1 database (001–004) shows `derivation_version = 'legacy'`, every other column unchanged, and the old keys found and issued again with the same value (AC-10). |
| Other versions | HKDF-SHA-256 with info `cogniate-lti/<purpose>/<version>` (`:226`), as D6 says. The empty salt is acceptable: RFC 5869 makes the salt optional, and the ring keys are 32 random bytes. A missing version throws `key_version_missing`. |
| Fail closed | Yes. A ring file that cannot be read, cannot be parsed, has a bad key, or has an active version that is not in `keys` stops the start. Different `LTI_MASTER_KEY` and `LTI_MASTER_KEY_FILE` values also stop it (`services/lti-service/src/keys/key-config.ts:20-47`). Error messages name versions and tables only (test `key-provider.test.ts:164-177`). `ready()` logs `key_provider_not_ready {version}` for each missing version (AC-08). The provider that `loadKeyProvider` creates logs `key_open_failed {table, reason}` when a blob does not open. The signing route then answers `500 INTERNAL_ERROR` with the trace id, and the control call passes (AC-05; `tool-keys.test.ts:59-91`). |
| Cache (D6) | The decrypted key is checked against kid, provider and time, so a new active kid misses at once (`services/lti-service/src/store/tool-keys.ts:54-69`; AC-09 and the rotate test). See A-LA-E5-08-02. |
| UNIT ACs fail on the old behaviour | Yes. AC-03..AC-08 need the new provider. AC-09 fails on the old code, which decrypted at every signature. AC-10 fails because the old schema has no `derivation_version` column. |
| "Must not edit" and ownership | Respected. `crypto.ts` and `lti/**` are unchanged. The two edits outside the task files are the Lead-approved RQ-2 lines. All other files are S2's in B1. |
| No wire change (LA-IC-10) | Yes, for every existing row. New tool keys and registration tokens are stored as `"cgk1"` blobs (design note: "New blobs always use the `cgk1` form"). A rollback to the old build therefore needs the backup restore of LA-ADR-04 D7, which is the documented procedure. |
| No LMS name in core paths | Yes. |

## Findings

- **A-LA-E5-08-01 (MINOR): an unbound master-key Buffer silently becomes a legacy-only ring, with no log line.**
  - Where: `packages/shared/src/key-provider.ts:259-267` (`keyProviderFor`) and `:252-257` (binding by Buffer identity). Callers: `services/lti-service/src/cli/bootstrap.ts:28` and `services/lti-service/src/main.ts:23,26` each pass their own `config.masterKey`.
  - Problem:
    - Any code path that does not get the bound Buffer instance quietly uses ring `{active: legacy}` built from `LTI_MASTER_KEY`. It then ignores the key-ring file. The test at `key-provider.test.ts:194` documents this: a Buffer with equal bytes gets the fallback provider, not the ring.
    - The fallback provider has no logger. So on that path a blob that does not open produces no `key_open_failed` line, only `internal_error {error: "KeyProviderError"}`.
    - Today this is the state of the whole service (the known open item). After the S1 follow-up, one missed entry point is enough to bring it back.
  - Failure case:
    1. The ring is `{active: "k2", keys: {legacy, k2}}`, and `main.ts` is wired, but `cli/bootstrap.ts` is not.
    2. `lti:bootstrap --rotate-signing-key` seals the new active signing key as version `legacy`, using `LTI_MASTER_KEY`. AP-06-24 ("a new signing key is sealed with `k2`") then fails with no error.
    3. If `LTI_MASTER_KEY` is not the ring's `legacy` key (for example, an operator set a new value after moving the keys into the ring), the web process cannot open that account's active signing key. Every launch, Deep Linking response and token request of that account then fails.
  - Suggested fix:
    - In the S1 follow-up, call `loadKeyProvider` in both entry points. Add one test per entry point: with a ring file `{active: "k2"}`, `ensureToolKey` writes a `k2` blob.
    - Make the fallback visible: log `key_provider_unbound` (warn) once per process. Or pass the default logger to the fallback provider, so `key_open_failed` is never lost.
    - Better: let `keyProviderFor` refuse an unbound handle when a ring file exists. The LA-E5-23 provider-only store port then removes the fallback.
- **A-LA-E5-08-02 (NIT): an expired cache entry stays in memory until the account signs again.**
  - Where: `services/lti-service/src/store/tool-keys.ts:54-69`.
  - Problem: an entry is removed only when the same account calls again with an active row (`:64`). For an account that stops signing, or whose key is retired with no new active key (`:60` returns before the cache), the decrypted private JWK stays in process memory without limit. D6 says that the key "is kept in memory per kid for at most 10 minutes". The risk is small, because the ring keys are in memory anyway.
  - Suggested fix: remove expired entries at each call (a short sweep of the map), or use one `unref()` timer.

## Author's listed choices (judged after my findings)

- WeakMap binding until LA-E5-23: acceptable as a bridge, but the silent fallback needs A-LA-E5-08-01.
- `sealSync`, `openSync` and `macSync`: acceptable. The async `KeyProvider` interface of D6 stays complete, and only the local adapter adds the sync methods.
- HKDF with an empty salt: acceptable (see Checks).
- `mac('runtime-token', 'legacy')` = HMAC(master key, input): matches today's app derivation, `HMAC(masterKey, 'runtime-token:<playId>')` (`services/cogniate-app/src/tool-pages/launch-rules.ts:61-62`). The golden test at `key-provider.test.ts:47-51` pins it.
- Different `LTI_MASTER_KEY` and `LTI_MASTER_KEY_FILE` values stop the start: correct (fail closed). Note: `services/lti-service/src/config.ts:22-23` (S1) still requires `LTI_MASTER_KEY`, so the `_FILE`-only path is unreachable until S1 or LA-E5-21 changes `config.ts`.

## Notes (no finding)

- `toolKeyVersions` counts only non-empty blobs (`tool-keys.ts`, `length(private_jwk_encrypted) > 0`). LA-E5-10 should "zero" a removed key's blob by emptying it. A zero-filled blob of the same length would read as version `legacy`, and `ready()` would then need `legacy` for ever.
- The K1-SIM ACs (AC-01, AC-02) wait for QA-2's Docker window.

## Round 2 (S1 wiring and S2 fix)

- Diffs:
  - S1 wiring: `git diff dbee32b 29cd178` (merged as `43ccc6f`).
  - S2 fix: `git diff 3f9120b c5f1a6e`.
- References: the LA-E5-08 spec and its RQ-1 list (`loadKeyProvider` in `main.ts`, the secret mount in `infra/compose.yaml`); my round-1 findings above. The `stack-up.sh` folder line is an RQ-2 edit.
- Blind review as before.
- **Verdict (round 2): APPROVE.** The round-1 MINOR and NIT are closed, and the wiring is right. New: **0 BLOCKER, 0 MAJOR, 1 MINOR** (A-LA-E5-08-03: the known open point, which I confirm and size here).

### Round-1 findings

| Id | Status | Evidence |
| --- | --- | --- |
| A-LA-E5-08-01 (MINOR) | closed | The two failure paths I named are gone. (1) Both entry points now bind before their first store call: `services/lti-service/src/main.ts:43` (right after `openDb`, before the token client, the routes and the operator app) and `services/lti-service/src/cli/bootstrap.ts:24` (before `ensureToolKey` at `:28`). Each has a test with a ring file `{active: "k2"}`: `main.test.ts:28-59` (the service key seals a `k2` blob) and `cli/bootstrap.test.ts` (the first and a rotated signing key are `k2`; with no ring file, `legacy`). (2) A missed binding now fails closed. After any binding in the process, an unbound master key throws `key_provider_not_bound` (`packages/shared/src/key-provider.ts:254`, `:272-274`). This includes a Buffer with the same bytes and one used before the binding (tests `key-provider.test.ts`, "fail closed after a binding"; `main.test.ts:50-58`). I traced every store caller: each gets `config.masterKey` of its own process (routes, token client, bootstrap), so no product path hits the new error. |
| A-LA-E5-08-02 (NIT) | closed | `services/lti-service/src/store/tool-keys.ts:58-59` removes every expired entry at each call, also those of accounts that stopped signing. |

### Wiring checks

| Check | Result |
| --- | --- |
| Order | `loadKeyProvider` runs before any key use in both processes. A bad or unreadable ring file makes `startLtiService` reject, so the process exits (fail closed). `cli/operator.ts` and `cli/shared-platform.ts` use no key material. |
| Mount | `./.secrets/lti:/run/secrets/lti:ro` on `lti-service` only (`infra/compose.yaml:152`), which matches `DEFAULT_KEYRING_FILE`. `stack-up.sh` creates `infra/.secrets/lti` with mode `0700` before compose runs, so Docker does not make it as root. With no ring file, today's stack is unchanged (`legacy` from `LTI_MASTER_KEY`). |
| Entry-point guard | The `resolve(argv[1]) === fileURLToPath(import.meta.url)` guard is the pattern that `cli/shared-platform.ts` already uses. `node --watch src/main.ts` keeps the script as `argv[1]`. If the guard ever failed, the compose healthcheck would show it. |
| Behaviour | Moving the code into `startLtiService()` and `runBootstrap()` keeps the start order, the `service_started` fields, retention and the signal handling (close both listeners, then the database; 3 s fallback exit). |

### New finding

- **A-LA-E5-08-03 (MINOR, the known open point): the test container can read the key ring.**
  - Where: `infra/compose.yaml:471` (`e2e`: `./.secrets:/repo/infra/.secrets:ro`, no `user:`, so it runs as root). The new ring folder lives under that path (`:152`).
  - Problem:
    - Until now, the `e2e` container saw only QA's own credentials under `infra/.secrets` (`seed.json`, API-key copies, the operator key). `.env` is replaced by the public copy, so `LTI_MASTER_KEY` was out of reach (my T1 resolution of A-T1-03).
    - When a `keyring.json` exists (QA form (a) for AP-06-24, or any operator ring), the root `e2e` container can read every ring key. Mode `0600` does not stop root. With the ring, it can open every sealed blob and compute every service key.
    - The `e2e` install still runs npm lifecycle scripts (A-T1-03 rest, deferred). So a test dependency could read the ring.
    - This affects dev and acceptance stacks only (production has no `e2e` service).
  - Suggested fix (the Lead's proposal is right):
    - Add `tmpfs: /repo/infra/.secrets/lti` (or an empty read-only volume) to the `e2e` service. Docker mounts the parent bind first and then the nested mount, because it sorts mounts by path, and `stack-up.sh` already creates the folder.
    - Add one check to the S1 follow-up: inside `e2e`, `ls -A /repo/infra/.secrets/lti` prints nothing while the host folder holds `keyring.json`.

### Notes (no finding)

- No product caller passes a logger to `keyProviderFor`, so `key_provider_legacy_fallback` (`key-provider.ts:277`) never logs from product code. That is acceptable now, because both entry points bind and the fail-closed rule covers a missed binding. The parameter can go when LA-E5-23 removes the fallback.
- `runBootstrap` calls `loadKeyProvider` without a logger, so a missing ring version is not logged by `lti:bootstrap`. The web process logs it at its own start (`main.ts:43` passes the logger), and `ready()` is the operator signal.
