Verdict: APPROVE
Round: 2

# LA-E5-08 review, Reviewer-B (lens: "Can a human team own it?")

## Round 2: S1 key-provider wiring and S2 fix round 1

Diffs: S1 `git diff dbee32b 29cd178` (lane commit `29cd178`; integration merge `43ccc6f`) and S2 `git diff 3f9120b c5f1a6e`. The changed files are the same at HEAD. The dispatch calls this "S1 wiring + S2 fix, round 1". It is my second round on this task file. Spec: `LA-E5-08.md` and its RQ-1 line (`:23`). I did not open the other reviewer's file.

Counts (this round): **0 BLOCKER, 0 MAJOR, 1 MINOR, 1 NIT.** My round-1 MINOR B-LA-E5-08-01 is **closed**.

### Round-1 findings

| Finding | Status |
| --- | --- |
| B-LA-E5-08-01 (MINOR) | **Closed.** `keyProviderFor` (`packages/shared/src/key-provider.ts:268`) gives the bound ring. After any `bindKeyProvider` in the process, every other master-key Buffer throws `KeyProviderError` `key_provider_not_bound` (`:272-274`). This includes a copy with the same bytes and a Buffer that was used before the binding. This is the fix that I suggested. `key-provider.test.ts` (a new module copy per test, with `vi.resetModules`) and `main.test.ts:50-58` (a copy of the service master key fails closed) test it. The old code gave a legacy ring, so both tests fail on it. |
| B-LA-E5-08-02 (NIT) | Still open and deferred. It was not in the fix brief. |

### Checks

| Check | Result |
| --- | --- |
| Wiring | **Correct.** `startLtiService` (`main.ts`) calls `loadKeyProvider({db, logger, masterKey: config.masterKey})` after `openDb` and before the token client, `buildApp` and the listeners. So every store caller gets the bound Buffer. `runBootstrap` (`cli/bootstrap.ts`) binds before `ensureAccount` and `ensureToolKey`. No other process uses the key functions: only `store/{tool-keys,service-keys,registrations}.ts` call `keyProviderFor`, and `shared-platform.ts` and `operator.ts` do not take the master key. Compose mounts `./.secrets/lti:/run/secrets/lti:ro`, which is the folder of `DEFAULT_KEYRING_FILE` (`keys/key-config.ts:16`). `stack-up.sh` makes that folder with mode 700 before compose runs, so Docker does not make it as root. With no `keyring.json`, the stack keeps today's `legacy` version (second bootstrap test). |
| Tests | There is one test per entry point. `main.test.ts`: with the ring `{active: "k2"}`, a new tool key is a `k2` blob, and a copy of the key fails closed. If the `loadKeyProvider` line is removed, the first check (`:43`) fails, because the ring is then `legacy`. `bootstrap.test.ts`: the first key and a rotated key are `k2` blobs; with no ring file, the key is `legacy`. The `services/lti-service` and `packages/shared` suites pass at HEAD: 45 files, 641 tests, no Docker. |
| No behaviour change outside the spec | The refactor keeps the start order, the `service_started` fields, `service_stopping` and the 3 s exit timer. `close()` keeps the order: retention stop, both listeners, then the database. The bootstrap JSON line keeps its keys and their order `{account, created, kid, apiKey}`, which `lti-bootstrap.sh` reads. The cache sweep (`store/tool-keys.ts:59`) only removes expired entries (A-LA-E5-08-02; the fix brief allowed it). One exception: B-LA-E5-08-03. |
| Ownership, Must not edit, LMS names | S1 changed `main.ts`, `cli/bootstrap.ts` and their tests, the lti-service mount line and `stack-up.sh`; S1 owns `infra/**` (`epics.md:545`). S2 changed `key-provider.ts`, `store/tool-keys.ts` and the tests of its LA-E5-08 files. `crypto.ts`, `lti/**` and the app files did not change. No LMS name was added. |
| Open point: e2e can read `keyring.json` | This is Reviewer-A's area (A-T1-03). One note for the owner: the tmpfs mount point is inside a read-only bind, so Docker cannot make it. The tmpfs works only because `stack-up.sh` makes `infra/.secrets/lti` first. Put a comment next to the tmpfs line that says this, so that nobody removes the `mkdir` line. |

### Findings

#### B-LA-E5-08-03 — MINOR — The new entry guard makes `main.ts` a silent no-op when its path contains a symlink

- **File:** `services/lti-service/src/main.ts:72`; `services/lti-service/src/cli/bootstrap.ts:35`. The same guard is in `cli/operator.ts:64` and in the M1 file `cli/shared-platform.ts:47`.
- **Problem:** `resolve(process.argv[1])` does not follow symlinks, but the `import.meta.url` of the main module is the real path. When the start path contains a symlink, the guard is false. Then nothing starts, nothing is logged, and the process exits 0. Before this change, `main.ts` always started. The compose stack does not have this problem (`/repo` is a bind mount; `working_dir: /repo/services/lti-service`). But if a person runs `npm start` or `npm run dev` from a symlinked checkout, no service starts and no error shows. On macOS, `/tmp` and `/var` are symlinks to `/private/...`.
- **Evidence:** I put the same guard in a scratch file under `/tmp` and ran it with Node v24.21.0. Through `/tmp/...` it gives `guard FALSE: /tmp/guardcheck.Fp08Lt/g.mjs vs /private/tmp/guardcheck.Fp08Lt/g.mjs`. Through the real path it gives `guard true`. Through a symlinked folder it gives `guard FALSE`. `import.meta.main` gives `true` in all three cases.
- **Suggested fix:** Use `if (import.meta.main) { … }`. It is in Node 24.2 and later; the repo needs Node 24.11 or later, the image uses 24.22, and `@types/node` has the type. It replaces the whole condition and the `resolve` and `fileURLToPath` imports. Change `main.ts` and `cli/bootstrap.ts` now, and change `operator.ts` and `shared-platform.ts` the next time their owners edit them. It is acceptable to defer this.

#### B-LA-E5-08-04 — NIT — No production caller can trigger the `key_provider_legacy_fallback` warning

- **File:** `packages/shared/src/key-provider.ts:268`, `:275-278`.
- **Problem:** The warning is logged only when a caller gives `keyProviderFor` a logger. No production caller does: the three store callers give only the handle. Also, after the S1 wiring, every process that uses these stores binds first. So the warning code and the `fallbackLogged` state run only in tests, but a reader will think that the logs show the fallback. `main.test.ts:48` checks that the line is absent, but the line cannot appear there in any case.
- **Suggested fix:** Remove the `logger` parameter and `fallbackLogged`. This is the simplest fix, now that both entry points bind. Or keep them and add one comment: "No production caller gives a logger. main.ts and cli/bootstrap.ts bind at start, so the fallback runs only in tests and in a process that does not bind."

## Round 1

Diff: `git diff 1b17261 3f9120b` (lane S2 commit `3f9120b`; integration merge `85a1882`). Spec: `docs/architecture/ltiaas/tasks/LA-E5-08.md`. Design: LA-ADR-06 D6, operability §2 and §6.3. I wrote my findings before I read the Author's notes on the local choices, and I did not open the other reviewer's file.

Verdict (round 1): APPROVE. Counts: **0 BLOCKER, 0 MAJOR, 1 MINOR, 1 NIT.**

### Checks

| Check | Result |
| --- | --- |
| Files and ownership | Only the spec's files changed: `packages/shared/src/key-provider.ts` (new), `services/lti-service/src/keys/key-config.ts` (new; S2 in `epics.md` §5), `store/{tool-keys,service-keys,registrations}.ts`, migration `006`, and their tests. Two Lead-approved RQ-2 edits (`packages/shared/src/index.ts` export lines; `.slice(0, 4)` in `db/migrations.test.ts`). `crypto.ts`, `lti/**` and the app files are unchanged. The callers in `lti/**` and `http/**` still pass the Buffer, which `KeyHandle` accepts, so no file of another lane changed. |
| No behaviour change outside the spec | New tool keys and registration tokens use the `"cgk1"` form. Old blobs open with `legacy`. Service-key values stay byte for byte (`derivation_version = legacy`). Until S1 wires `loadKeyProvider` (the known RQ-1 item), every call uses the legacy ring, so nothing on the wire changes. Migration `006` lands before a `005`; RQ-5 allows this, and the two files do not depend on each other. |
| No LMS name in core | None added (only the test fixtures use `moodle.test`). |
| UNIT ACs fail on the old behaviour | AC-03 and AC-10 compare with golden values captured before the change (`V3E5DSnW…`, `MIVWS5Vj…`), and AC-10 runs on an M1 (`001`–`004`) database. AC-05 runs through the HTTP app (`POST /api/deeplinking`, `500 INTERNAL_ERROR` with the trace id, `key_open_failed {table: "tool_key"}`); the old code had no row binding, so the copied blob would open and the call would give `200`. AC-04, 06 and 07 test the new module. AC-08 tests `ready()` and the log. AC-09 counts decryptions with a controlled clock (the old code decrypted at every signature). The six test files pass at HEAD: 35 tests, about 0.5 s, no Docker. |
| Author's local choices | Sync `sealSync`, `openSync` and `macSync` until the async store (LA-E5-23): accepted; the async port methods exist next to them. HKDF with an empty salt: acceptable (the key-ring keys are uniform random). `mac('runtime-token', 'legacy')` equal to today's app value: accepted for LA-E5-22. Different `LTI_MASTER_KEY` and `LTI_MASTER_KEY_FILE` values stop the start: good, it fails closed. The WeakMap binding: see B-LA-E5-08-01. |
| Open item (not a finding) | Until S1 calls `loadKeyProvider` in `main.ts` and `cli/bootstrap.ts`, and adds the compose mount, the key ring file is not read and `key_open_failed` and `key_provider_not_ready` have no logger in the running service. QA-2's K1-SIM checks of AC-01, AC-02, AC-05 and AC-08 should run after that RQ-1 commit. |

### Findings

#### B-LA-E5-08-01 — MINOR — An unbound master-key Buffer silently becomes a legacy-only ring

- **File:** `packages/shared/src/key-provider.ts:252-268`; `services/lti-service/src/keys/key-config.ts:67-69`.
- **Problem:** `keyProviderFor(buffer)` finds the loaded key ring by the identity of the Buffer object. Any Buffer that is not the one bound at start (a copy with the same bytes, or a process that forgot `loadKeyProvider`) silently gets a new legacy-only ring. Nothing tells the operator.
- **Evidence:** `const providers = new WeakMap<Uint8Array, LocalKeyProvider>()`; when the lookup misses, `provider = createLocalKeyProvider(legacyKeyRing(handle))`. The S1 wiring of `main.ts` and `cli/bootstrap.ts` is still to come (RQ-1). Example: with a key ring `{active: "k2", keys: {legacy, k2}}`, a CLI run (`--rotate-signing-key`) that misses the binding seals the new private key with `legacy`, not `k2`, and logs nothing. If `legacy` later leaves the ring, a value sealed through such a path does not open. The tests themselves must re-bind in `finally` blocks (`store/tool-keys.test.ts`, AC-05), which shows that the state is easy to get wrong.
- **Suggested fix (cheap):** Fail loudly. Once a provider is bound in the process, `keyProviderFor` with an unbound Buffer throws `KeyProviderError` ("master key not bound; call loadKeyProvider at start") instead of making a legacy ring; with no binding at all, keep today's fallback. Or key the map by a SHA-256 of the key bytes, so copies resolve to the same ring. Add one unit case. LA-E5-23 can then remove the binding.

#### B-LA-E5-08-02 — NIT — HKDF info uses the `cogniate-lti/` prefix for an app purpose

- **File:** `packages/shared/src/key-provider.ts:226`.
- **Problem:** The info string is `cogniate-lti/<purpose>/<version>` for every purpose, also `runtime-token`, which is an app value (LA-E5-22). The design names this exact info string (LA-ADR-06 D6), so it is correct, but a reader may think that the runtime token belongs to the LTI service.
- **Suggested fix:** One comment line at `LEGACY_SUBKEY` or `macSync`: "the info prefix is fixed by LA-ADR-06 D6 for every purpose, also for app values".
