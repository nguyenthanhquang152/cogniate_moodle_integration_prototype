Verdict: PASS (host-only K0 + UNIT; K1-SIM pending: Docker window)
Round: 2

# LA-E3-01 Platform storage: login page and state columns: QA verification

Tester: QA-4 (Orca task `task_fb862e2b49d1`, dispatch `ctx_6039a0441240`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E3-01.md` (with `BD-A1-33`, `BD-A1-34`, `BD-A2-35`, `BD-A2-41`, `BD-A2-44`). Suite: `tests/ltiaas/tasks-lti/LA-E3-01/` (QA-4 test-first).

Independence: QA-4 did not read product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files to author `tests/ltiaas/tasks-lti/LA-E3-01/`, and verified all K0 and UNIT ACs in an isolated `--no-hardlinks` clone using boolean assertions that never print product source.

| Item | Value |
| --- | --- |
| SHA (Round 1) | `5ec8a699a554a4043fe91c6f6903380a0c2f53d4` (`5ec8a69`: lane L `LA-E3-01` Round 1 merge, 13 files) |
| SHA (Round 2) | `a2dfc0418ccf421891f260925ddee0d22371e240` (`a2dfc04`; holds `LA-E3-01` Round 2 fix merge `3344520`: lane L commits `23a736e`, `5fecc58`, `db1038f`, `f09c3ea`) |
| Lane and slot | lane L; no Docker (`HOST-ONLY`; `K1-SIM` row marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/qa4-r8-a2dfc04/clone`: `git clone --no-hardlinks --no-checkout`, detached at `5ec8a69` (Round 1) and `a2dfc04` (Round 2), push URL `DISABLED`, `npm ci` at root and `tests/` |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/qa4-r8-a2dfc04/logs/` (umask 077): `npm-ci.log`, `npm-ci-tests.log`, `LA-E3-01-r1-k0.log`, `e3-01-r1-unit.log`, `LA-E3-01-k0.log`, `e3-01-unit.log`, `rev.txt`, `remotes.txt`, `status-after.txt` |

## Round 1 (`5ec8a69`)

Verdict: PASS (host-only K0 + UNIT; K1-SIM pending: Docker window)
Round: 1

### Acceptance criteria (Round 1)

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E3-01-01 | PASS (UNIT + K0) | `services/lti-service/src/lti/login.test.ts > platform storage login > keeps the old 302, Location and Set-Cookie with a null trait (AC-01)` + `platform-storage-login.k0.test.ts > Profile registry contract check` | `LA_LEVEL=k0 LA_TARGET_ROOT=$PWD ./node_modules/.bin/vitest run --config tests/ltiaas/tasks-lti/LA-E3-01/vitest.config.mts --reporter=verbose` | A profile with `platformStorage: null` or absent answers `302` with the exact pre-storage `Location` and `Set-Cookie`, and no baseline profile has a non-null trait in `5ec8a69`. `LA-E3-01-r1-k0.log`, `e3-01-r1-unit.log` |
| AC-LA-E3-01-02 | PASS (UNIT) | `services/lti-service/src/lti/login.test.ts > platform storage login > keeps the 302 with an absent or invalid from-login target undefined (AC-02, AC-05)` + empty string case | `./node_modules/.bin/vitest run --reporter=verbose services/lti-service/src/lti/login.test.ts` | A profile with `targetFrame: "from-login"` and a login without `lti_storage_target` (or `""`) answers `302`. `e3-01-r1-unit.log` |
| AC-LA-E3-01-03 | PASS (UNIT + K0) | `services/lti-service/src/lti/login.test.ts > platform storage login > returns the page and unchanged cookie for GET, with the exact old auth URL (AC-03, AC-04, AC-08)` + `POST` case + `platform-storage-login.k0.test.ts` | as AC-01 | Both `GET` and `POST` logins with `targetFrame: "from-login"` and `lti_storage_target=forwarding` return `200 text/html; charset=utf-8`, the rule-3 CSP (`default-src 'none'; script-src 'nonce-…'; frame-ancestors https:; form-action 'none'; base-uri 'none'`), and the unchanged state cookie. `LA-E3-01-r1-k0.log`, `e3-01-r1-unit.log` |
| AC-LA-E3-01-04 | PASS (UNIT) | `services/lti-service/src/lti/login.test.ts > platform storage login > returns the page and unchanged cookie for GET, with the exact old auth URL (AC-03, AC-04, AC-08)` + `POST` case | as AC-02 | The `authUrl` in the page's JSON block is byte-for-byte equal to the `Location` header that the `302` path builds for the same input and random state/nonce. `e3-01-r1-unit.log` |
| AC-LA-E3-01-05 | PASS (UNIT) | `services/lti-service/src/lti/login.test.ts > platform storage login > keeps the 302 with an absent or invalid from-login target aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa (AC-02, AC-05)` + `a b` case + `services/lti-service/src/profiles/storage.test.ts` (11 invalid cases) | `./node_modules/.bin/vitest run --reporter=verbose services/lti-service/src/lti/login.test.ts services/lti-service/src/profiles/storage.test.ts` | An invalid `lti_storage_target` (`> 64` chars or `a b`) falls back to `302` without rendering the page; invalid profile `platformStorage` shapes are rejected by the schema. `e3-01-r1-unit.log` |
| AC-LA-E3-01-06 | PASS (UNIT + K0) | `services/lti-service/src/lti/storage-pages.test.ts > escapes all five JSON characters and keeps request data out of script text (AC-06 builder)` + `services/lti-service/src/lti/login.test.ts > preserves the hostile login hint through URL encoding and the JSON block (AC-06 login)` | `./node_modules/.bin/vitest run --reporter=verbose services/lti-service/src/lti/storage-pages.test.ts services/lti-service/src/lti/login.test.ts` | Both `BD-A2-35` parts pass: (a) the page builder escapes `<`, `>`, `&`, U+2028 and U+2029 in the `<script type="application/json">` payload; (b) a login with `login_hint` containing `</script><script>alert(1)</script>` and U+2028 preserves the exact value in the parsed `authUrl` and emits no unescaped `<` outside the JSON block. `e3-01-r1-unit.log` |
| AC-LA-E3-01-07 | PASS (UNIT) | `services/lti-service/src/lti/storage-pages.test.ts > posts to forwarding and only the storage origin, with the bounded state key (AC-07)` + `posts to _parent and only the storage origin, with the bounded state key (AC-07)` + `services/lti-service/src/lti/login.test.ts > uses a fixed frame and fixed storage origin without a target parameter (AC-07)` | as AC-06 | Posts `lti.put_data` with `key = cog_state_<d>` and `value = <state>` to `window.parent.frames["forwarding"]` or `window.parent` (`_parent`), with targetOrigin `O` (either `authOrigin` or a fixed `https` origin), never `*`. `e3-01-r1-unit.log` |
| AC-LA-E3-01-08 | PASS (UNIT) | `services/lti-service/src/store/states.test.ts > stores and returns storage metadata, defaults old callers to null and keeps state single use (AC-08)` + `login.test.ts` (`AC-03, AC-04, AC-08`) | `./node_modules/.bin/vitest run --reporter=verbose services/lti-service/src/store/states.test.ts services/lti-service/src/lti/login.test.ts` | Storage logins store `storage_target` and `storage_origin` on the `oidc_state` row; `302` logins store `NULL` for both; `consumeState` returns both columns and stays single-use. `e3-01-r1-unit.log` |
| AC-LA-E3-01-09 | PASS (UNIT + K0) | `services/lti-service/src/store/states.test.ts > migration 014 gives every copied M1 state null storage columns and preserves old fields (AC-09)` | `./node_modules/.bin/vitest run --reporter=verbose services/lti-service/src/store/states.test.ts` | LTI migration `014_platform_storage.sql` applies cleanly to a copy of an M1 LTI database with existing `oidc_state` rows, giving them `NULL` in `storage_target` and `storage_origin` and passing F5 `sql-portability`. `LA-E3-01-r1-k0.log`, `e3-01-r1-unit.log` |
| AC-LA-E3-01-10 | pending: Docker window (K1-SIM) | `tests/ltiaas/tasks-lti/LA-E3-01/platform-storage-login.k1sim.test.ts > AC-LA-E3-01-10` | SIM Docker slot | Pending Docker window (M1 `--phase sim` + M2 regression). |

## Round 2 (`3344520` / `a2dfc04`)

Verdict: PASS (host-only K0 + UNIT; K1-SIM pending: Docker window)
Round: 2

### Round 2 changes and verification (`23a736e`, `5fecc58`, `db1038f`, `f09c3ea` in `3344520`, verified at `a2dfc04`)

| Item | Result | Evidence |
| --- | --- | --- |
| Static login page text (`BD-A2-41`, `23a736e`) | PASS (UNIT + K0) | `services/lti-service/src/lti/storage-pages.test.ts > shows the static waiting text and JavaScript help (BD-A2-41)` and `platform-storage-login.k0.test.ts > AC-LA-E3-01-03 .. AC-LA-E3-01-07 (static check)` verify that the login page renders `<p>Opening the activity. Please wait.</p>` and `<noscript>This activity needs JavaScript. Turn on JavaScript in your browser, then open the activity again from your course.</noscript>` with no request values and unchanged CSP. `LA-E3-01-k0.log`, `e3-01-unit.log` |
| Explicit storage binding rules (`storageBindingOf`, `FRAME_NAME`, registry seam `5fecc58` + `db1038f`) | PASS (UNIT + K0) | `profiles/storage.ts` centralizes `storageBindingOf` and `FRAME_NAME`; `login.test.ts` injects a test profile registry without `vi.spyOn`; `StateRecord.storageTarget` and `storageOrigin` are required `string \| null` fields (`states.test.ts > stores and returns storage metadata or explicit nulls and keeps state single use (AC-08)`). `LA-E3-01-k0.log`, `e3-01-unit.log` |
| Slot-collision cookie priority regression (`BD-A2-44`, `f09c3ea`) | PASS (UNIT) | `services/lti-service/src/lti/storage-check.test.ts > a parallel login overwrites the storage slot; matching cookie present: true (BD-A2-44)` and `matching cookie present: false (BD-A2-44)` verify that when two parallel logins share the same `cog_state_<d>` slot, a launch with its state cookie succeeds via the cookie path and a launch without its cookie fails closed with `400 INVALID_STATE` (`storage_mismatch`). `e3-02-unit.log` |
| All Round 1 UNIT + K0 ACs (`AC-LA-E3-01-01` .. `09`) at `a2dfc04` | PASS (UNIT + K0) | `platform-storage-login.k0.test.ts` (5/5 passed in `5.23s`) and focused unit suite (`4` files, `39` passed in `2.99s`). `LA-E3-01-k0.log`, `e3-01-unit.log` |

### Lead R0 `npm run check` counts at `a2dfc04`

| Suite | Count at `a2dfc04` |
| --- | --- |
| Vitest (`test:unit`) | 2,641 passed |
| Infra (`test:infra`, `node --test`) | 252 pass, 0 fail |
| K0 (`test:k0`) | 121 passed |
| F1 (`fitness:lms-names`) | `F1 PASS: 20 files with hits, 74 hits` (0 hits on all `LA-E3-01` files) |
| F5 (`fitness:rules`) | `F5 PASS: 6 rules, 0 hits` (0 hits on `store/states.ts` and `014_platform_storage.sql`) |

## Other checks

- **File scope (`5ec8a69` and `3344520`):** Touches `services/lti-service/src/lti/{login,storage-pages}*.ts`, `services/lti-service/src/store/states*.ts`, `services/lti-service/src/db/migrations/014_platform_storage.sql`, `services/lti-service/src/profiles/{registry,schema,storage,types}*.ts`, one line in `services/lti-service/src/http/routes/protocol.ts` (`BD-A1-34`), `packages/channel-kernel/src/profiles.ts` (`BD-A1-33` RQ-2), and the `profileRegistry` test seam in `services/lti-service/src/http/app.ts` + `testkit.ts` (`RQ-2`). No app files or `packages/channels/**` files were modified by `LA-E3-01`.
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/qa4-r8-a2dfc04/clone` is empty after the run (`status-after.txt`, 0 bytes).

## Regression and time

R0: PASS (`5.31s` Round 1 K0, `2.33s` Round 1 unit; `5.23s` Round 2 K0, `2.99s` Round 2 unit). `AC-LA-E3-01-10` (`K1-SIM`) is `pending: Docker window`.
