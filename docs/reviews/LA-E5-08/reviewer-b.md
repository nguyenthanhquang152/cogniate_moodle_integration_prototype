Verdict: APPROVE
Round: 1

# LA-E5-08 review, Reviewer-B (lens: "Can a human team own it?")

Diff: `git diff 1b17261 3f9120b` (lane S2 commit `3f9120b`; integration merge `85a1882`). Spec: `docs/architecture/ltiaas/tasks/LA-E5-08.md`. Design: LA-ADR-06 D6, operability §2 and §6.3. I wrote my findings before I read the Author's notes on the local choices, and I did not open the other reviewer's file.

Counts: **0 BLOCKER, 0 MAJOR, 1 MINOR, 1 NIT.**

## Checks

| Check | Result |
| --- | --- |
| Files and ownership | Only the spec's files changed: `packages/shared/src/key-provider.ts` (new), `services/lti-service/src/keys/key-config.ts` (new; S2 in `epics.md` §5), `store/{tool-keys,service-keys,registrations}.ts`, migration `006`, and their tests. Two Lead-approved RQ-2 edits (`packages/shared/src/index.ts` export lines; `.slice(0, 4)` in `db/migrations.test.ts`). `crypto.ts`, `lti/**` and the app files are unchanged. The callers in `lti/**` and `http/**` still pass the Buffer, which `KeyHandle` accepts, so no file of another lane changed. |
| No behaviour change outside the spec | New tool keys and registration tokens use the `"cgk1"` form. Old blobs open with `legacy`. Service-key values stay byte for byte (`derivation_version = legacy`). Until S1 wires `loadKeyProvider` (the known RQ-1 item), every call uses the legacy ring, so nothing on the wire changes. Migration `006` lands before a `005`; RQ-5 allows this, and the two files do not depend on each other. |
| No LMS name in core | None added (only the test fixtures use `moodle.test`). |
| UNIT ACs fail on the old behaviour | AC-03 and AC-10 compare with golden values captured before the change (`V3E5DSnW…`, `MIVWS5Vj…`), and AC-10 runs on an M1 (`001`–`004`) database. AC-05 runs through the HTTP app (`POST /api/deeplinking`, `500 INTERNAL_ERROR` with the trace id, `key_open_failed {table: "tool_key"}`); the old code had no row binding, so the copied blob would open and the call would give `200`. AC-04, 06 and 07 test the new module. AC-08 tests `ready()` and the log. AC-09 counts decryptions with a controlled clock (the old code decrypted at every signature). The six test files pass at HEAD: 35 tests, about 0.5 s, no Docker. |
| Author's local choices | Sync `sealSync`, `openSync` and `macSync` until the async store (LA-E5-23): accepted; the async port methods exist next to them. HKDF with an empty salt: acceptable (the key-ring keys are uniform random). `mac('runtime-token', 'legacy')` equal to today's app value: accepted for LA-E5-22. Different `LTI_MASTER_KEY` and `LTI_MASTER_KEY_FILE` values stop the start: good, it fails closed. The WeakMap binding: see B-LA-E5-08-01. |
| Open item (not a finding) | Until S1 calls `loadKeyProvider` in `main.ts` and `cli/bootstrap.ts`, and adds the compose mount, the key ring file is not read and `key_open_failed` and `key_provider_not_ready` have no logger in the running service. QA-2's K1-SIM checks of AC-01, AC-02, AC-05 and AC-08 should run after that RQ-1 commit. |

## Findings

### B-LA-E5-08-01 — MINOR — An unbound master-key Buffer silently becomes a legacy-only ring

- **File:** `packages/shared/src/key-provider.ts:252-268`; `services/lti-service/src/keys/key-config.ts:67-69`.
- **Problem:** `keyProviderFor(buffer)` finds the loaded key ring by the identity of the Buffer object. Any Buffer that is not the one bound at start (a copy with the same bytes, or a process that forgot `loadKeyProvider`) silently gets a new legacy-only ring. Nothing tells the operator.
- **Evidence:** `const providers = new WeakMap<Uint8Array, LocalKeyProvider>()`; when the lookup misses, `provider = createLocalKeyProvider(legacyKeyRing(handle))`. The S1 wiring of `main.ts` and `cli/bootstrap.ts` is still to come (RQ-1). Example: with a key ring `{active: "k2", keys: {legacy, k2}}`, a CLI run (`--rotate-signing-key`) that misses the binding seals the new private key with `legacy`, not `k2`, and logs nothing. If `legacy` later leaves the ring, a value sealed through such a path does not open. The tests themselves must re-bind in `finally` blocks (`store/tool-keys.test.ts`, AC-05), which shows that the state is easy to get wrong.
- **Suggested fix (cheap):** Fail loudly. Once a provider is bound in the process, `keyProviderFor` with an unbound Buffer throws `KeyProviderError` ("master key not bound; call loadKeyProvider at start") instead of making a legacy ring; with no binding at all, keep today's fallback. Or key the map by a SHA-256 of the key bytes, so copies resolve to the same ring. Add one unit case. LA-E5-23 can then remove the binding.

### B-LA-E5-08-02 — NIT — HKDF info uses the `cogniate-lti/` prefix for an app purpose

- **File:** `packages/shared/src/key-provider.ts:226`.
- **Problem:** The info string is `cogniate-lti/<purpose>/<version>` for every purpose, also `runtime-token`, which is an app value (LA-E5-22). The design names this exact info string (LA-ADR-06 D6), so it is correct, but a reader may think that the runtime token belongs to the LTI service.
- **Suggested fix:** One comment line at `LEGACY_SUBKEY` or `macSync`: "the info prefix is fixed by LA-ADR-06 D6 for every purpose, also for app values".
