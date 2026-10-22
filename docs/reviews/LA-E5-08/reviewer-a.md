Verdict: APPROVE
Round: 1

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
