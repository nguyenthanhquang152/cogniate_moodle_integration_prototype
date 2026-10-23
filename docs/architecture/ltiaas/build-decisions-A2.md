# Build decisions: Architect-2 (A2) response

Date: 2026-10-22. Author: Architect-2 (A2), Claude Code Opus 5.5 xhigh (charter-LA §0 routing rule). Base: integration branch `quang/ltiaas-milestone` at `872521a`. Brief: `docs/team/ltiaas/briefs/p4/ARCH-A2-build1-full.md`.

The Lead made these design calls during the build to keep the lanes moving. A2 checked each call against the code and the design. Result: all three calls are **ratified**. BD-A2-01 gets one addition (a guard). The addition is a follow-up and not a merge gate.

## 1. Decisions

| Id | Lead call | Ratified / changed | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-01 | Audit atomicity (RQ-2 for S1; LA-ADR-06 D4 rule 1, AC-LA-E5-02-08). `transaction()` in `packages/shared/src/migrations.ts` runs `fn` in a SAVEPOINT when a transaction is open (RELEASE on success; ROLLBACK TO + RELEASE on error, then rethrow). With no open transaction it is unchanged (`BEGIN IMMEDIATE` … `COMMIT`). `withAudit` in `store/audit.ts` runs "change + `ok` event" in one `transaction()`, so no lane edits `store/platforms.ts`. | **Ratified, with one addition**: `transaction()` must refuse a callback that returns a thenable (rule T2 guard). | LA-ADR-06 D4 "Transaction rule" T0–T5; LA-E5-02 design notes; LA-E5-09 and LA-E5-10 design notes (sync rule) | Checked: `migrations.ts:27-50`, `store/audit.ts:122-146`, nested tests `migrations.test.ts:94-113`, `audit.test.ts:112-134`. Main risk: `KeyProvider.seal` is async (`key-provider.ts:24`). An async callback in `audit.change` commits the `ok` event at the first `await`, and the change then runs outside the transaction. S2 meets this first in LA-E5-10 (key pair and seal) and LA-E5-09 (re-wrap). Rule: async work before `audit.change`, or `sealSync` inside. Reentrancy is safe (sync driver, unique savepoint names). The shared helper also nests in the Cogniate app: no app caller used the old "cannot start a transaction within a transaction" error (A1 FYI). Residual T5 (rollback error hides the first error after SQLite ends the transaction): MINOR, for `deferred.md`. |
| BD-A2-02 | A-LA-E5-01-01 = B-LA-E5-01-01: `npm run seed` makes the operator key (`infra/scripts/lti-bootstrap.sh` runs `lti:operator init --if-none`), not `stack:up`; `stack:reset` now deletes `infra/.secrets/lti-operator-key`. | **Ratified.** | LA-ADR-06 D3 "Trust bootstrap", AP-06-13, §5 "CLIs", §5 LA-IC-10 row; operability §2 (secret files and rules), §6.4, §7.3; LA-E5-01 scope, AC-06, regression; LA-E5-05 AC-08 | Checked: `seed.sh:43-44`, `lti-bootstrap.sh:25-53`, `stack-reset.sh:36`. New A2 call that matches the code: `stack:reset` **keeps** `infra/.secrets/lti/` (the key ring), like `.env`, because it is key material, not stack data. No code change. Optional NIT for S1: name `infra/.secrets/lti/` in the "Keeps" list of the `stack-reset.sh` header. |
| BD-A2-03 | Secret visibility (A-LA-E5-08-03, fixed by S1): the `e2e` container must not see `infra/.secrets/lti`. An empty tmpfs covers `/repo/infra/.secrets/lti` in the `e2e` service, and `infra/.secrets/lti` must exist before compose up. | **Ratified.** | security-delta §10 "Visibility rule for the test container (A-T1-03 extension)", §1 key-ring row, residual R-LA-8; operability §2 rules; LA-ADR-06 D6 "Local provider" | Checked: `compose.yaml:472-476`, `stack-up.sh:33`, `lib.sh:229`; `node --test infra/scripts/compose-e2e-secrets.test.mjs` passes (2/2, no Docker). A missing folder stops the `e2e` start (fail closed); the fix is to make the folder, never to drop the tmpfs. New rule for later tasks: new key material (LA-E5-22 app ring, LA-E5-21 `*_FILE` secrets) goes into a hidden folder, with a check in the infra test. Residual R-LA-8: the hide is a deny list. |

## 2. Changes for the Lead to route

| # | File | Rule | Task | Lane | Gate |
| --- | --- | --- | --- | --- | --- |
| C1 | `packages/shared/src/migrations.ts` (+ one test in `migrations.test.ts`) | LA-ADR-06 D4 T2: when `fn` returns a thenable, `transaction()` rolls back (ROLLBACK TO + RELEASE in a nested call, else ROLLBACK) and throws a `TypeError`. | LA-E5-02 follow-up (RQ-2) | S1 | Not a merge gate. Until it lands, Reviewer-A checks every `transaction()` and `audit.change` callback in S1 and S2 diffs for rule T2. |
| C2 | `docs/architecture/ltiaas/tasks/LA-E5-01.md` AC-LA-E5-01-06 and the regression line | The "second run" is a second `npm run seed`, and the key file stays unchanged (was: a second `stack:up`). | LA-E5-01 (in progress) | QA-2 (S1 tests) | QA-2 changes the AC-06 check before its QA run. No product change. |
| C3 | `docs/architecture/ltiaas/tasks/LA-E5-05.md` AC-LA-E5-05-08 | Same text change: `npm run seed` twice, not `stack:up` twice. | LA-E5-05 (not started) | S1, QA-2 | None. |
| C4 | `LA-E5-02.md`, `LA-E5-09.md`, `LA-E5-10.md` design notes | Sync rule T2 and one change per request T3. No AC change. | LA-E5-09, LA-E5-10 | S2 (and S1 for LA-E5-02) | None. |
| C5 | `docs/team/ltiaas/deferred.md` (Lead file) | MINOR: rule T5. Run the rollback only while `db.isTransaction` is true, and keep the first error. | — | S1 | Deferred. |

A1 FYI (no A1 file changed): the shared `transaction()` now nests in both services. LA-ADR-03 D7 (job runner) and the app stores get the same rules T0–T4.

## 3. Round 2: LA-E5-10 build (lane S2), 2026-10-22

Question: RQ-1 of Author S2 for LA-E5-10, routed by the Lead (dispatch `ctx_f31ece6b85b5`). Decisions sent to the Lead at once (`msg_080d6d01edde`), so S2 did not wait for these docs.

| Id | Proposed call | Ratified / changed | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-04 | Route API `registerSigningKeyRoutes(app, ctx, { keys: KeyHandle })`, with `publishLeadSeconds` optional for unit tests; S1 mounts it and passes the key handle from `main.ts`. | **Changed (small).** The key handle goes into the operator context: `OperatorDeps.keys` and `OperatorContext.keys` (`KeyHandle`, required). The signature is `registerSigningKeyRoutes(app, ctx, opts: { publishLeadSeconds?: number } = {})`, so `MOUNTS` keeps one type `(app, ctx)`. `opts` is for unit tests only. | LA-ADR-06 D3 row "Key handle"; LA-E5-10 "Needs from S1" and "Route API" | Three operator groups need the handle: LA-E5-10, LA-E5-09 (key-provider routes) and LA-E5-04 (account create makes the first signing key). One context field avoids three wirings. `main.ts` passes the **same** handle as the public app: one key provider per process (one JWK cache, one `ready()` check). |
| BD-A2-05 | `SIGNING_KEY_PUBLISH_LEAD_S` (default 86,400, minimum 600) parsed in the route module, no `config.ts` edit. | **Ratified, with a placement rule.** Not in `config.ts`. The parser goes into the S2 settings module `keys/key-config.ts` (same pattern as `readKeyRing(env)`, injectable env), so LA-E5-20 can reuse it. The route calls it once at registration when `opts` has no value. | LA-ADR-06 D7 row "Publish lead time"; operability §2 row; LA-E5-10 "Files" and "Route API" | A value that is not a whole number ≥ 600 stops the service start with one line (fail closed). The test option gets the same check (no bypass below 600). The unit ACs use 600 s with a controlled clock. |
| BD-A2-06 | Invalid transitions (activate a non-`next` key; retire a `next` or `removed` key) = `400 INVALID_REQUEST`; unknown account or kid = `404 NOT_FOUND`. | **404 ratified; 400 changed.** A state conflict is `409`, like the other signing-key codes: new code `409 SIGNING_KEY_WRONG_STATE` (S2, `http/key-errors.ts`) for `activate` of an `active`, `retired` or `removed` key and for `retire` of a `removed` key. `400 INVALID_REQUEST` is for the body only. **Design addition:** `retire {immediate: true}` on a `next` key is allowed (`next` → `removed`). A kid of another account is `404`. | LA-ADR-06 D7 (diagram, "Terms", "Retire immediate", new row "Transitions and errors"); contract delta §1.3, §3 (two rows and the "Unknown ids" rule); security-delta §2.3; operability §6.1 (new "Compromise of the next key"); LA-E5-10 scope and new AC-LA-E5-10-13 (UNIT) | Without `next` → `removed`, a compromised `next` key stays published (platforms trust it), and at most one `next` key may exist, so the only exit was to activate the compromised key. A `next` key never signed, so its removal breaks no valid JWT. With LA-E5-04, writes on a `closed` account give `409 ACCOUNT_CLOSED` (D2: read and purge only). |

Changes for the Lead to route:

| # | File | Rule | Task | Lane | Gate |
| --- | --- | --- | --- | --- | --- |
| C6 | `services/lti-service/src/http/operator/index.ts`, `services/lti-service/src/main.ts` | BD-A2-04: `keys: KeyHandle` (required) in `OperatorDeps` and `OperatorContext`; `ctx.keys = deps.keys`; mount `registerSigningKeyRoutes` in `MOUNTS`; `main.ts` passes the public app's handle. The S1 tests that build the operator app pass a key handle. | LA-E5-10 RQ-1 | S1 | Needed before the LA-E5-10 merge. |
| C7 | `services/lti-service/src/http/operator/signing-keys.ts`, `keys/key-config.ts`, `http/key-errors.ts` | BD-A2-04 signature (`ctx.keys`, optional `opts`); BD-A2-05 parser in `key-config.ts`; BD-A2-06 code `SIGNING_KEY_WRONG_STATE`, `next` → `removed`, `404` for a kid of another account. | LA-E5-10 | S2 | Part of the task. |
| C8 | `docs/architecture/ltiaas/tasks/LA-E5-10.md` | New AC-LA-E5-10-13 (UNIT, Author test). No K1-SIM AC changed. | LA-E5-10 | S2; QA-2 FYI | None for QA-2: AC-01 to AC-12 do not change. |
| C9 | — (A1 FYI) | `removed` can now also follow `next`. Terms §6 names `next`, `active`, `retired` as states and `removed` as an end mark; the meaning does not change. | — | A1 | None. |

## 4. Round 3: first signing key of a new account (LA-E5-04, lane S1), 2026-10-22

Lead call routed in dispatch `ctx_9ad8b08aec7b`. Decision sent to the Lead at once (`msg_67142d4d72a2`).

| Id | Lead call | Ratified / changed | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-07 | Lane S1 needs the first tool key of a new account inside the one `audit.change` of `POST /operator/v1/accounts`. In `store/tool-keys.ts`, `insertKey` is private, `ensureToolKey` is async and commits by itself, and `createNextToolKey` needs an active key. Lead call (provisional, RQ-2 to S1): export a synchronous `createFirstToolKey(db, prepared, now)`, guarded (the account exists and has no signing key, else throw), that calls `insertKey`. | **Ratified, with exact rules.** (1) No `accountId` parameter: the prepared key is sealed for `prepared.accountId`. It returns the `SigningKeyRecord`, like `createNextToolKey`, and runs in `transaction()`. (2) The guard means **no `tool_key` row in any state**, not only "no active key", so the function never skips the publish lead time of an account that has keys. A failed guard is a caller bug: a plain error (`500`, no `refused` event). (3) Status `active`, with `published_at = activated_at = created_at`. (4) Route order: pre-check the id (`409` before any RSA work); `prepareToolKey` before `audit.change`; one `audit.change` with the account insert and `createFirstToolKey`; one `account.create` event with `details.kid`. | LA-ADR-06 D7 row "First key", D4 T3 (example); contract delta §3 `POST /operator/v1/accounts`; LA-E5-04 scope | The first key needs no lead time, because no platform knows a new account yet. `tool-keys.ts` stays S2's file; the S1 edit is the Lead's RQ-2 grant (process). Unit test in `tool-keys.test.ts`: both guards; the key is `active` and first in the JWKS. Optional NIT: the first-key branch of `ensureToolKey` can call `createFirstToolKey` (only with the stricter guard). |
| BD-A2-08 | Reviewer-A NIT A-LA-E5-02-05: D4 T3 and T5 lag the code. | **Done (text).** T3 is now "exactly one successful `audit.change` on every successful request": a second call throws, and a body with no change gives `500`. T5 is built. The T2 guard (C1) is built. | LA-ADR-06 D4 T2, T3, T5 | C1 and C5 of §2 are built in LA-E5-02 round 2 (Reviewer-A A-LA-E5-02-02 and -03 closed). The Lead removes the C5 entry from `deferred.md`. |

Changes for the Lead to route: none beyond the Lead call itself (S1 builds `createFirstToolKey` under RQ-2; S1 adds `details.kid` to the `account.create` event).

FYI for the LA-E5-10 review (S2), not decisions of this round:
- `removeToolKey` writes the SQL literal `X''`. LA-ADR-06 D13 rule 2 (portability lint) does not allow `X''` literals. Bind an empty `Uint8Array` as a parameter instead.
- `prepareToolKey` uses `generateKeyPairSync`. It blocks the event loop of both listeners for every new key. MINOR candidate: the async `generateKeyPair`.

## 5. Round 4: API key backfill and bridge (LA-E5-07, lane S2), 2026-10-22

These are the Lead's Q2 questions for S2, sent again in dispatch `ctx_eea37ff17a9d`. Decisions went to the Lead at once (`msg_6b30bec81210`). The process items (mounts, the `KEY_ERRORS` spread, the revoke call at close, the test assertions in S1 files) are the Lead's.

| Id | Proposed call | Ratified / changed | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-09 | The migration 011 backfill of existing keys: `prefix` `NULL`, `created_by` `system:bootstrap`, `created_at` from `tool_account`, and `id` = `key_` + 16 random bytes as hex. | **Ratified.** In SQL: `'key_' \|\| lower(hex(randomblob(16)))`, `hash` = `api_key_hash`, label `bootstrap`, both scopes, no expiry, no last use, not revoked. Key ids are opaque (exact match; at most a `key_` + 1–64 `[A-Za-z0-9_-]` check). New keys keep `randomId('key_')`. | LA-ADR-06 D5 row "Backfill values", D13 item 2 (SQLite-adapter item); contract delta §3 `GET …/api-keys` (`prefix` may be `null`); LA-E5-07 scope | A hash cannot give back the prefix. `created_at` is a lower bound, because before LA no rotation time is stored. Test-volume edge: accounts that `POST /operator/v1/accounts` made before migration 011 get a `bootstrap` row with the unusable hash. It counts toward the limit of 2, so revoke it. Pilot volumes never have this case. |
| BD-A2-10 | The bridge in `store/accounts.ts` (S1's file) until LA-E5-05: `ensureAccount` issues a bootstrap row through the new API key store; rotation revokes the old rows in the same transaction; `findAccountByApiKey` delegates to the new lookup; nothing reads the frozen column. | **Ratified, with exact rules.** (1) One lookup in the S2 store. (2) A new account gets the unusable hash in the frozen column and one `bootstrap` row, in one transaction. (3) Rotation first revokes **every** active key of the account (all labels), then issues the new row, so the limit of 2 cannot refuse it. (4) No key change without rotation. (5) Synchronous store calls; `api-keys.ts` does not import `accounts.ts`. (6) No audit event on this path. (7) The `lti:bootstrap` output, the key files and the testkit do not change. | LA-ADR-06 D5 row "Bridge until LA-E5-05"; LA-E5-07 scope | Rule (6) is a deliberate gap. The path never ships alone: LA-E5-05 (same wave) moves `lti:bootstrap` to the audited operator API (AP-06-12). Audit events here would only add rows that existing unit tests count. Who edits `accounts.ts` is the Lead's call. |

Changes for the Lead to route: none that change a Lead call. S2 gives the synchronous store API (issue, revoke all active keys of an account, lookup). The owner of `accounts.ts` applies rules (1)–(7).

## 6. Round 5: channel imports from `@cogniate/shared` (LA-E1-03, lane K), 2026-10-22

Reviewer-A finding A-LA-E1-03-04 (MINOR, a design note for A2), routed in dispatch `ctx_7b122a150da3`. The ruling went to the Lead and A1 at once (`msg_88af4dabcd8f`). A1 owns the LA-ADR-01 D1 text and rules the other LA-E1-03 fence items (dynamic `import()`, files outside the entry kinds, the imports of `app.ts`).

| Id | Question | Ruling | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-11 | LA-ADR-01 D1 lets channel `app/**` import all of `@cogniate/shared`, and that barrel exports `openSqlite`, the key provider, `encrypt`/`decrypt` and `createOutboundClient`. Which exports may channel code import? | **An allow-list sub-path.** Values come only from `@cogniate/shared/channel` (new `packages/shared/src/channel.ts`, re-exports only, plus the package export `./channel`). From the root, channel code may use `import type` only. The first list holds 23 pure helpers (security delta §8). The same fence refuses the globals `fetch`, `WebSocket` and `process` in channel server code. A unit test pins the export names. | security-delta §1 (channel folders row), §8 (new row "Channel import fence"); LA-ADR-07 D1 (Library row) | An allow list does not rot when the barrel grows (the R-LA-8 lesson). The list comes from the code that moves: Moodle `mbz.ts` and `domain/*` use `randomId`, `ApiErrorBase` and `redactPath`, and the types `Knob`, `Logger` and `PublicUrls`. Capabilities (SQL, outbound, sealing, logger, time) come only through `PortContext` (LA-ADR-01 D5). The guardrail is not a sandbox. |

Changes for the Lead to route (lane K): new `packages/shared/src/channel.ts` and its name-pin test; the export `./channel` in `packages/shared/package.json` (the owner is the Lead's call); in `eslint.config.js`, for the channel `app/**` block (and `app.ts` if A1 allows shared values there), a `paths` entry `{ name: '@cogniate/shared', allowTypeImports: true }`, `@cogniate/shared/channel` in `onlyImports`, and `no-restricted-globals` for `fetch`, `WebSocket` and `process`. Lint probes: a value import of a refused name, `import * as` and `export *` from the root fail; `import type` from the root passes; a value import from `/channel` passes; `fetch(...)` fails. A1 refuses every dynamic `import()` and `require()` in channel files (BD-A1-16, A-LA-E1-03-01), so this covers the runtime path too. A1 FYI: LA-ADR-01 D1 line "`app/**` … plus `@cogniate/shared`" should read "plus `@cogniate/shared/channel` (values) and `@cogniate/shared` (types only)".

## 7. Round 6: API key issue on a closed account (LA-E5-07, lane S2), 2026-10-22

S2 asked, routed in dispatch `ctx_bb4b676ef4f8`. Decision sent to the Lead first (`msg_c627b4965ec4`).

| Id | Lead call | Ratified / changed | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-12 | (Provisional; S2's proposal.) `POST …/accounts/:id/api-keys` on a closed account gives `409 ACCOUNT_CLOSED`; GET metadata and idempotent revoke stay available; a suspended account can still get keys; the status check is in one place. | **Ratified, as one rule for every lane.** On a `closed` account, an operator write that adds, enables or changes anything gives `409 ACCOUNT_CLOSED`. A write that only removes access (API key revoke, retire immediate, service-key revoke) stays allowed and idempotent. Reads stay allowed. One accounts-store helper (S1) gives `404 NOT_FOUND` and `409 ACCOUNT_CLOSED`, and is called inside the `audit.change` transaction. Check order: `404`, `409 ACCOUNT_CLOSED`, body `400`, then other `409`s. | LA-ADR-06 D2 (new paragraph "Operator writes on a closed account"), D5 (row "Closed account"); contract delta §1.3 (rows `ACCOUNT_CLOSED` and the missing `ACCOUNT_ALREADY_EXISTS`), §3 (issue and revoke rows); LA-E5-07 scope and new AC-LA-E5-07-13 (UNIT) | LA-E5-07 has no other write: the contract has no label or expiry edit, and a later edit route follows the same rule. Suspended: D2 lets every operator call through, and the keys get `403 TOOL_ACCOUNT_SUSPENDED` on `/api/*`. The check inside the transaction stops a race with a concurrent close. |

Changes for the Lead to route: S1 gives the helper in the accounts store (LA-E5-04). S2 calls it for the API key issue (LA-E5-07; Author unit test AC-13), and later for signing-key create and activate (LA-E5-10 follow-up, not a gate; BD-A2-06 already gives the `409`). No QA K1-SIM criterion changes.

## 8. Round 7: SQL portability and the CLI rotation (LA-E5-10 review, lane S2), 2026-10-22

Reviewer-A findings A-LA-E5-10-01 (MINOR), -02 (NIT) and -03 (NIT), routed in dispatch `ctx_d0fdd6dce8a8`. Decisions sent to the Lead first (`msg_5b13d8f1cbab`).

| Id | Item | Decision | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-13 | A-LA-E5-10-01: `X''` in `removeToolKey` (`store/tool-keys.ts:148`) and in the `signing-key-cleanup` job (`:17`); `unixepoch('subsec')` four times in migration `009`. Also: should F5 `sql-portability` catch these forms? | **`X''`: change the code** (bind `new Uint8Array(0)`); runtime SQL has no adapter exception. **`009`: listed as a SQLite-adapter item**, no file change. **F5: yes for new migration files (Must)**: add `X'…'`, the SQLite date and time functions, `randomblob` and `rowid`, with an explicit allow list of `{file, form}` entries (`009` date function, `011` `randomblob`/`hex`) that cites D13 rule 2. Inline TypeScript SQL: a Should (scan only the text of string and template literals in non-test `services/*/src/**/*.ts`, with a frozen baseline of the two pre-LA app hits `domain/pickers.ts:55` and `domain/retention.ts:17`). | LA-ADR-06 D13 rule 2 (rewritten with the list (a)–(c)); LA-E5-10 design notes | Runtime store SQL is what the async store port (LA-E5-23) carries to LG, so it must be portable. A migration has no clock but the database. `009` is applied on Author and QA volumes, so an edit would trip the checksum stop. LG moves data and does not replay SQLite migrations. An allow list in the rule file, not marker comments, keeps each exception visible in review. |
| — | A-LA-E5-10-02: `generateKeyPairSync` | No design rule. D4 T2 already puts async work before the change. S2 may use the async `generateKeyPair` in the same fix round. | — | — |
| BD-A2-14 | A-LA-E5-10-03: `lti:bootstrap --rotate-signing-key` fails while a `next` key exists | **A design rule:** the CLI rotation always makes a **new** key. It first removes a waiting `next` key (retire immediate; that key never signed), then creates and force-activates, in one transaction. The stdout does not change. | LA-ADR-06 D7 row "CLI"; contract delta §3 "CLI mapping"; operability §6.1; LA-E5-10 design notes; LA-E5-05 scope | The CLI cannot know whether the waiting key is trusted, and in a compromise it may be part of the same leak. An operator who trusts it uses the API (activate the `next` key with `force`). |

Changes for the Lead to route:
- **S2, LA-E5-10 fix round:** the two blob writes become bound empty arrays; `ensureToolKey` rotation removes a waiting `next` key first (one Author unit test); optionally async `generateKeyPair`.
- **Lane P (F5 owner; rule text S1):** the new forms and the `{file, form}` allow list for new migration files (Must); the literal scan of inline TypeScript SQL with its baseline (Should).
- **S1, LA-E5-05:** the CLI mapping retires a waiting `next` key before create and activate.
- **A1 FYI:** the two pre-LA `X''` uses in the app (`domain/pickers.ts`, `domain/retention.ts`) stay legacy; D13 covers new SQL only.

## 9. Round 8: `PLATFORM_RATE_LIMITED` and one `Retry-After` rule (LA-E5-14 lane L, LA-E5-03 lane S1), 2026-10-22

Routed in dispatch `ctx_ee0744d66ee1`. Decisions sent to the Lead first (`msg_bf9cf214e3dd`).

| Id | Lead call | Ratified / changed | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-15 | (L's proposal, C12.) `PLATFORM_RATE_LIMITED` `{status: 429, description: 'The platform asked us to wait before another request.'}`; the error handler sets `Retry-After` from `details.retryAfter` for that code; `details.retryAfter` is an integer 1–3,600; no upstream body or data in the answer; one warn line `platform_rate_limited {platform_id, status, retry_after_s}` for each received response. | **Confirmed**, except the per-code header branch (BD-A2-16 replaces it). 60 s when the platform header is absent or not readable. The token request counts as a received response. `lti_platform_rate_limited_total{platform_id}` counts at the same point when the D10 metrics exist. No automatic retry. | contract delta §1.3 (`PLATFORM_RATE_LIMITED` row); LA-E5-14 scope | The fixed description and no platform data keep platform answers out of tool back ends. |
| BD-A2-16 | (Provisional.) L adds the header line in a separate RQ-2 commit; S1 keeps its header code in one reusable helper. Question: one generic rule instead of a branch per code? Is `retryAfter` in the body part of the contract for both codes? | **Changed to one generic rule.** Every API error whose `details` carry `retryAfter` gets `Retry-After`. One S1 module `http/retry-after.ts` (`retryAfterSeconds`: an integer clamped to 1–3,600, 60 when not finite; `setRetryAfter`). The `app.ts` handler normalizes once and sends the same value in the header and the body, with no branch per code. The limiter's 429 page uses the same helper (header only). **Both** `429` codes carry `details.retryAfter`; for `RATE_LIMITED` this field is new (additive). L's RQ-2 commit becomes exactly the generic line plus this module. Whichever lane lands first writes it (S1 owns both files), and the other reuses it. | contract delta §1.3 (`RATE_LIMITED` row), §1.6 (`Retry-After` row); LA-ADR-06 D1 ("Answer, API" and the new row "`Retry-After` rule"); LA-E5-03 scope and new AC-LA-E5-03-13 (UNIT); LA-E5-14 "Needs" and scope | One rule keeps header and body equal and bounded in one place. A third code (for example `503 NOT_READY` with a wait) needs no handler change. The generic rule needs the body field, so `RATE_LIMITED` carries it too. No K1-SIM criterion changes. |

Changes for the Lead to route:
- **L (LA-E5-14):** the RQ-2 commit is the generic line plus `http/retry-after.ts`, not a branch for `PLATFORM_RATE_LIMITED`. The mapper passes its seconds through `retryAfterSeconds`.
- **S1 (LA-E5-03):** reuse or add the same module; the 429 page path sets the header with `setRetryAfter`; `RATE_LIMITED` errors carry `details.retryAfter`; new unit AC-LA-E5-03-13.
- **QA FYI:** a `RATE_LIMITED` body now also has `details.retryAfter`, equal to the header. No acceptance criterion requires it.

## 10. Round 9: LA-E5-03 interfaces (lane S1, with S2 and L), 2026-10-22

S1's interface requests, routed in dispatch `ctx_3ff422383d8b`. Decisions sent to the Lead first (`msg_e5e28a7265f7`).

| Id | Proposed call | Ratified / changed | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-17 | Request 2 (`http/auth.ts`, S2). The spec said `auth.ts` calls the `auth_failure` function of `http/rate-limit.ts`. S1 proposed a sixth optional argument `onApiKeyFailure: () => void`. | **Changed:** no import and no second callback. The existing `onFail` gets a third argument: `onFail(scheme, code, part: 'api_key' \| 'credential')`. `'api_key'` = every `401` before the API key is proven valid (also a scheme the route does not accept, and a closed account's key); `'credential'` = a `401` after a valid key. `app.ts` logs as today and, for `'api_key'`, calls `recordAuthFailure(limiter, req.ip)`. The `api` and `admin` buckets use `AuthResult.actor.id`. | LA-E5-03 request 2; LA-ADR-06 D1 row `auth_failure`; contract delta §1.4 | `app.ts` holds the limiter and the client address. `auth.ts` stays free of limiter state, with no import cycle. One failure callback cannot drift apart from a second one. Existing two-argument callers still fit. The "before the key is proven" line is exact and easy to test per path. |
| BD-A2-18 | The JSON shape of `registrationSessionsPerAddress`: a top-level `integer \| null` in `PATCH`; `GET` with the integer and `registrationSessionsSource`. | **Ratified, with bounds:** 1–1,000; `null` removes the operator value; an unknown top-level field gives `400`. One `service_setting` row (key `rate_limits`); one `settings.rate_limits` event. | contract delta §3 (`GET` and `PATCH /operator/v1/rate-limits`) | It stays flat because the cap is one global number (no per-account override). |
| BD-A2-19 | `Retry-After` for S1: reuse L's `http/retry-after.ts`, no `applyRetryAfter`. | **Confirmed.** Nothing else changes. `RATE_LIMITED` carries `details.retryAfter` = whole seconds until one token refills (at least 1). The 429 page calls `setRetryAfter`. | LA-E5-03 scope | Follows BD-A2-16. |
| BD-A2-20 | Session-cap storage (asked before S1's own request): `registration_session` has no client address. | **Ruled:** the additive nullable column `registration_session.client_key` (the limiter's address key) and an index `(tool_account_id, client_key, status)`. Open = `status IN ('open','completing') AND expires_at > ?` (`now` bound from code). L (LA-E5-06) checks before the outbound fetch, writes the key with the insert, and clears it at completion. | LA-ADR-06 D1 (cap paragraph); LA-E5-03 scope; security-delta §11 row "Client address" | The count is exact across restarts, and completion and expiry leave the count with no extra code. The client address is a new stored item, so §11 lists it; it is short-lived (cleared at completion, the row deleted after 24 h). A small overshoot under parallel starts is accepted: check and insert cannot be atomic across the platform fetch, and the `registration` bucket bounds it. |

Changes for the Lead to route:
- **S2 (`http/auth.ts`, LA-E5-07 window):** the third `onFail` argument, with one Author unit test per path (`api_key` on each pre-key `401`, `credential` on the ltik and service key `401`).
- **S1 (LA-E5-03):** the `app.ts` callback, the PATCH and GET shape, the session-cap check function and the column migration (the Lead decides the number, or puts it in the LA-E5-03 migration).
- **L (LA-E5-06):** the cap check before the fetch, `client_key` on insert, `NULL` at completion. The owner of `store/registrations.ts` in the current window is the Lead's call.

## 11. Round 10: privacy floor freeze (A1 proposal BD-A1-22; LA-E1-05, lanes K and L), 2026-10-22

Reviewer-A A-LA-E1-05-02 (MINOR). A1 sent a proposal to A2 as the security owner, routed in dispatch `ctx_724e3d439fe0`. The ruling went to the Lead first, for A1 too (`msg_344e33951eab`).

| Id | Proposal | Ratified / changed | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-21 | (A1 BD-A1-22.) (a) `privacyFloor` required, enum `allowlist` \| `none`. (b) Load check 7: `none` only for the profile ids in the frozen list `PRIVACY_FLOOR_NONE_PROFILES = ['standard']` (`legacy-wire.ts`); every other profile is `allowlist`; a new entry needs an ADR revision and a security review; a raise to `allowlist` is always allowed. (c) The launch fails closed: it keeps every claim only when `privacyFloor === 'none'`. | **Ratified**, with two precisions. (1) A raise of `standard` passes the load check, but it changes Moodle launches and needs its own LA-IC (LD-9); the planned Moodle change (LA-IC-08) uses the account claim policy. (2) With the claim policy (LA-E3-10, Should), the two layers compose fail-closed: a claim stays only when both layers allow it explicitly, and an unknown value in either layer minimizes (the documented `null` = `passthrough` default for existing accounts stays). | LA-ADR-07 T18; LA-ADR-05 D7 row "Privacy floor"; security-delta §12 new row "Privacy floor frozen" | Checked on the integration branch and the K and L lane branches: only `standard` is `none`. `canvas`, `canvas-sim`, `blackboard` and `blackboard-sim` are `allowlist`; `lti-generic` and `brightspace` are `allowlist` by LA-ADR-02 D2. So the freeze changes no behaviour today. |

Lanes for the Lead to route: **K** adds the frozen list in `packages/channel-kernel/src/legacy-wire.ts` (or L by RQ-2 if K is busy: the Lead's call). **L** does the load check 7 rule in `services/lti-service/src/profiles/schema.ts`, the launch line `launch.ts:117` (`!== 'none'` → minimize), and unit tests: a new profile with `none` stops the start, `standard` with `none` starts, an unknown floor value minimizes, and Canvas and Blackboard still minimize. **L2 (LA-E3-10, later):** the fail-closed composition with the claim policy.

## 12. Round 11: the legacy `rowid` baseline (LA-E1-04 FU-1, lane P), 2026-10-22

Lane P's question about the BD-A2-13 Should scan, routed in dispatch `ctx_99275aeeead9`. Decision sent to the Lead first (`msg_4a50e9e8263a`).

| Id | Lead call | Ratified / changed | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-22 | (Provisional.) Freeze the nine legacy `rowid` statements that the inline scan found (app `domain/attempts.ts:50`; `bindings.ts:67`, `:276`; `mbz-builds.ts:39`, `:45`, `:57`; `results.ts:33`, `:49`; `score-syncs.ts:147`) as exact-text, one-occurrence baseline entries with the reference "LA-ADR-06 D13 rule 2: legacy pre-LA SQL", in a commit separate from the Must part. Does LG need a migration item? | **Ratified.** All nine exist unchanged at G-BASE `bd368ff`, so they are pre-LA baseline and not D13 exceptions. The baseline never grows. A new `rowid` fails the scan, and so does an edit of a frozen statement. **LG item: yes**, recorded as D13 item 6: an insertion-order column per table, filled from the SQLite `rowid` by the data move, and the nine statements order by it. | LA-ADR-06 D13 rule 2 (baseline sentence) and new item 6 (LG port items (a)–(c)) | Each use is the tie-break after a millisecond timestamp (latest-first or creation-order lists). Postgres `ctid` is not stable, and the random text ids have no order, so the port needs a real sequence. The files are A1's app domain files; LA changes nothing in them (A1 FYI). |

Changes for the Lead to route: **P** commits the nine baseline entries apart from the Must part. **A1 FYI**: D13 item 6 lists the app tables that the LG store port must extend. A1's BD-A1-22 entry can now point to A2 BD-A2-21 (ratified).

## 13. Round 12: signing-key `409` details and "no active key" (LA-E5-10 review B, lane S2), 2026-10-22

Reviewer-B B-LA-E5-10-01 and -02 (MINOR), and -03 (NIT), routed in dispatch `ctx_29f523cca3e5`. Decisions sent to the Lead first (`msg_e5aa2cb12834`).

| Id | Item | Decision | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-23 | B-LA-E5-10-01: a signing-key `409` gives no fact to act on. | **Additive `details`** (public data, ISO 8601 times): `NOT_PUBLISHED_LONG_ENOUGH` `{kid, activatableAt}`; `NEXT_EXISTS` `{kid, publishedAt}` of the waiting key; `WRONG_STATE` `{kid, keyStatus}`; `ACTIVE` `{kid}`. Never `retryAfter`. `KeyError(code, {description?, details?})`. The audit writer does not change. | contract delta §1.3; LA-ADR-06 D7 row "Error details and no active key"; LA-E5-10 scope, AC-LA-E5-10-14 (UNIT) | The name is `keyStatus`, because `status` is the HTTP status at the top of the body. `retryAfter` would add a `Retry-After` header (BD-A2-16), which is for `429` only. |
| BD-A2-24 | B-LA-E5-10-02: `SIGNING_KEY_WRONG_STATE` also means "the account has no active key" (create, and activate of a valid `next`). A separate code, or a clearer text? | **Neither: "no active key" is not an error.** Create on an account with no `active` key makes the new key `active` at once (`201 {status: "active"}`; no lead time). Activate of a `next` key with no active key gives `retired: null`. `WRONG_STATE` keeps one meaning. | contract delta §3 (`POST …/signing-keys`, `…/activate`); LA-ADR-06 D7 (same row); LA-E5-10 scope, AC-14 | With no active key, nothing can sign, so a publish wait protects nothing (the BD-A2-07 reason). Normal paths never reach this state, so it is a recovery path through the API. A new error code would leave the operator with no API fix, and LA-E5-05 would need a direct-write exception. |
| — | B-LA-E5-10-03 (NIT): `retire` without `immediate: true` | Accepted as text: `400 INVALID_REQUEST` (field `immediate`) "retire needs {"immediate": true} (removes the key at once). A key becomes retired when the next key is activated." | contract delta §3 (`…/retire`) | — |

Changes for the Lead to route: **S2 (LA-E5-10 fix round)**: `KeyError` options and the four `details` sets; create and activate with no active key (`requireNextKeySlot` and `checkToolKeyActivation` no longer throw for a missing active key); the retire text; AC-14 unit tests. No QA K1-SIM criterion changes.

## 14. Round 13: bootstrap URLs, `claimPolicy: null`, close, runbook note (LA-E5-04, LA-E5-10), 2026-10-22

Routed in dispatch `ctx_b32d3cd14ee8`. Item 1 went to the Lead first (`msg_88b879ff5997`), because S1 waited on it.

| Id | Item | Decision | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-25 | A-LA-E5-04-02: `lti:bootstrap` (run by `npm run seed`) resets the tool URLs of an existing account. (Provisional, S1's proposal: keep all three stored URLs, update only the supplied name, defaults only for new accounts.) | **Ratified, with one precision:** the name changes only when `--name` is given (the account id default must not overwrite a stored name). Key flags unchanged. No audit event until LA-E5-05, which maps this to `POST` or `PATCH {name}`. | LA-ADR-06 D7 row "Bootstrap of an existing account"; operability §8 (new row for a `PUBLIC_APP_URL` change); LA-E5-04 design notes | Seed no longer heals `cogniate`'s URLs after a `PUBLIC_APP_URL` change on an existing volume. The operator uses `PATCH`. A fresh stack is not affected. The migration number for LA-E5-19 is the Lead's (RQ-5). S1's plan for A-LA-E5-04-03 (one outer transaction around the read and the audited change) needs no contract change. |
| BD-A2-26 | B-LA-E5-04-02: `claimPolicy: null` silently means `passthrough`, and `POST` and `PATCH` accept it. | **`null` is a stored legacy marker, never an input.** `POST` and `PATCH` with `null` give `400 INVALID_REQUEST` (field `claimPolicy`). `POST` without the field stores the new-account default (`allowlist`, every `keep` off). `passthrough` must be written explicitly. `GET` shows a legacy row as `null`. For LA-E3-10, the account layer reads: a valid object gives its mode; `null` gives `passthrough`; anything else gives `allowlist` (fail closed). | LA-ADR-05 D7 new row "`null` rule"; contract delta §1.1 (`claimPolicy` row); LA-E5-04 and LA-E3-10 design notes | The least private mode then needs the word `passthrough`; nobody gets it by "clearing" a field. It keeps BD-A2-21's single exception narrow. |
| BD-A2-27 | Reviewer-B NIT B-LA-E5-04-03: the final close is one field in a general `PATCH`. | **Keep the `PATCH` form** (no contract change, no QA test change). The operability §8 close procedure gets a check step: `GET` the account and confirm the id and the name first, and use the id from that answer. A second-operator confirmation is the LA-H21 follow-up (Could). | operability §8 row "Close a tool account" | The operator API is loopback-only, keyed and audited. A confirm field would change built and tested K1-SIM criteria (LA-E5-04, AC-LA-E5-07-11) for a NIT. |
| BD-A2-28 | LA-E5-10 Reviewer-B NIT: runbook step 7 (operability §6.1) assumes the `signing-key-cleanup` job runs. | **Note added:** until LA-E5-19 registers the job, a retired key leaves the key set by time, but its sealed private part stays. After the 30 days, `retire {immediate: true}` removes it and clears the private part at once. | operability §6.1 step 7 | Lane S2 cannot edit this file; A2 did it. |

Changes for the Lead to route: **S1 (LA-E5-04 fix)** for BD-A2-25 (the `ensureAccount` URL and name rule, with unit tests: an existing account keeps a `PATCH`-ed `launchUrl` after bootstrap; the name stays without `--name`) and BD-A2-26 (refuse `null` in `POST` and `PATCH`; the comment at the default constant). **L2 (LA-E3-10, later)**: the account-layer reading of BD-A2-26. No QA K1-SIM criterion changes.

## 15. Round 14: the audit action chosen inside the change (LA-E5-04 fix, lane S1), 2026-10-22

Provisional Lead call, routed in dispatch `ctx_f7dd36f8b7a5`. Decision sent to the Lead first (`msg_b72345fa58b5`).

| Id | Lead call | Ratified / changed | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-29 | (A-LA-E5-04-03.) An outer transaction cannot wrap the async `ctx.audited`, because `transaction()` refuses thenables. So S1 extends `store/audit.ts`: `describe(result)` may return an optional `action`, and the `ok` event uses `extra.action ?? base.action` in the same transaction. Accounts `PATCH` reads the current status inside `audit.change` and describes `account.status` only for a real transition; `account.update` stays the refusal action. Additive; callers unchanged. | **Ratified**, with two rules. (1) The described action is one of the contract delta §5 actions of that route, never free text. (2) The `refused` event keeps the base action, and its `details` name the request fields. General rule added: a choice that depends on the current state is read inside `audit.change`. | LA-ADR-06 D4 T1; contract delta §5 (accounts row) | It keeps T2 (synchronous `describe`) and T3 (one event), and it closes the race of a read before the transaction. A refused request changed nothing, so the base action is the true record; the fields in `details` keep refused close attempts searchable. |

Changes for the Lead to route: none beyond S1's build. S1's unit tests should show: a `PATCH {status: "suspended"}` on an `active` account gives `account.status`; a `PATCH {status: "active"}` on an `active` account (no transition) gives `account.update`; a refused `PATCH` gives `account.update` with the code and the request fields.

## 16. Round 15: the facts in a `429` and in `rate_limited` (LA-E5-03 review B, lane S1), 2026-10-22

Reviewer-B B-LA-E5-03-02 (NIT), routed in dispatch `ctx_fd30a06b9742`. Decision sent to the Lead first (`msg_2f2955fd23af`).

| Id | Item | Decision | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-30 | A `429 RATE_LIMITED` answer and the `rate_limited` line do not name the budget, the key or the trace. | **Body:** additive `details.limit`, always present: `{ class, ratePerMinute, burst }` for the authenticated classes (`api`, `admin`, `operator`: the caller's own budget, with the operator API names); `{ class }` only for the address classes (`protocol`, `registration`, `keys`, `auth_failure`). Never an address, a key, a key id or an account. The protocol HTML page does not change. **Log:** `rate_limited` adds `key_id` (API key id or operator key id) and `trace_id` (the request that first hit the limit), and `key_kind` takes `address`, `api_key` or `operator_key`. **Also** (B-LA-E5-03-04, NIT): a new log line `trusted_proxy_unresolved {host}` at `warn`. | contract delta §1.3 (`RATE_LIMITED` row), §1.4 (paragraph), §6 (`rate_limited`, new `trusted_proxy_unresolved`); LA-ADR-06 D1 ("Answer, API", "Log"); LA-E5-03 design notes | The class alone answers the reviewer's case (a valid key refused by the address-wide `auth_failure` bucket). Numbers only for authenticated callers, so an unauthenticated sender cannot tune its flood to the exact budget. One trace id per bucket-minute joins the line with a request. |

Changes for the Lead to route: **S1** (a later LA-E5-03 commit): `details.limit`, the two log fields, the `trusted_proxy_unresolved` line, and unit tests (one authenticated and one address class body; the log fields). No K1-SIM criterion changes.

## 17. Round 16: stop timing and start runs of the E5 jobs (LA-E5-19 review A, lane S1), 2026-10-22

Reviewer-A2 A-LA-E5-19-03 and -01 (MINOR), routed in dispatch `ctx_88f302e35966` (A1 BD-A1-10 item 4 left the timing to A2 and S1). Decisions sent to the Lead first (`msg_cb64978ec2eb`).

| Id | Item | Decision | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-31 | A-LA-E5-19-03: the 3 s exit fallback is gone and the shutdown waits up to the 60 s runner grace, but Docker kills after 10 s. | **One order: runner grace (60 s, the longest lease) < service exit fallback (70 s) < container stop grace (75 s).** At `SIGTERM`, `main.ts` arms a 70 s last-resort timer: `service_exit_forced {after_ms}`, exit code 1; the clean path exits 0. `infra/compose.yaml`: `stop_grace_period: 75s` on `lti-service` and `cogniate-app`. | LA-ADR-06 D11 "Start and stop rules"; operability §3 rules; LA-E5-19 design notes | `runner.stop()` returns at once with no run in flight, so a normal stop stays about 1 s. No stack script passes `-t`, so compose applies the value to `stop`, `restart` and `down`. A kill is still safe for the Must jobs (one SQLite transaction each). The rule protects longer runs (`key-rewrap`). |
| BD-A2-32 | A-LA-E5-19-01: `audit-retention` has `runAtStart: false`, and the runner has no catch-up, so a service that restarts daily never deletes expired audit rows. Design line or plain fix? | **A design line** (the D11 table said "daily" with no start run): every E5 interval job runs at start, then on its interval. The D11 table now reads "at start, then …" for `audit-retention` and the Should jobs. | LA-ADR-06 D11 (table and rules); LA-E5-19 design notes | The fix for S1 is `runAtStart: true` and the test pin. The delete uses the `audit_event_ts` index and removes nothing on most days. |

Changes for the Lead to route: **S1** (LA-E5-19 fix): the 70 s exit timer with its log line, `runAtStart: true` for `audit-retention` (and the AC-07 pin in `main.test.ts`), and `stop_grace_period: 75s` on `lti-service`. **The `cogniate-app` compose line** (`stop_grace_period: 75s`): owner is the Lead's call. **A1 FYI**: the app runner has the same 60 s grace (LA-ADR-03 D7), so the app main should arm the same last-resort timer when its runner runs in the web process. No K1-SIM criterion changes.

## 18. Round 17: emergency key rotation, operator key transport, LA-E3-01 AC-06 (lanes S1, S2, L), 2026-10-22

Routed in dispatch `ctx_4bca257e8a8c`. Decisions sent to the Lead first (`msg_3e5fe171dc0f`), because S1 waited.

| Id | Item | Decision | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-33 | LA-E5-05: `--rotate-api-key` must issue and then revoke every other key, but issue refuses when two keys are active. S1 proposed: revoke the oldest, issue, revoke the rest. | **Changed: one atomic API call.** `POST …/api-keys` takes the optional `revokeOthers: true`. One transaction revokes every active key of the account, then issues; the limit counts after the revoke. One `api_key.issue` event with `details.revokedKeyIds`. LA-E5-05 maps `--rotate-api-key` to this one call. | contract delta §3 (issue row, CLI mapping); LA-ADR-06 D5 "Rotation (emergency)"; LA-E5-07 scope; LA-E5-05 scope | A sequence of calls can fail between steps and leave either an account with no key (the oldest key may be the one in the app's key file) or an old key alive after a compromise. The CLI cannot tell which key is in the file (backfilled keys have no prefix). It is the same rule as BD-A2-10 rule 3, and S2's store already has the "revoke all, then issue" path. |
| BD-A2-34 | LA-E5-05: the service mounts only `infra/.secrets/lti`. S1 proposed: the wrapper copies the operator key there atomically (`0600`); `LTI_OPERATOR_KEY_FILE` defaults to `/run/secrets/lti/lti-operator-key`; no compose edit; no secret in argv or env; a missing original makes the wrapper exit 1. Also for direct shared-platform calls. | **Ratified, with three rules:** an atomic write (umask 077, temp file, rename); a missing original makes the wrapper exit 1 **and delete the copy**; `npm run stack:reset` deletes the copy (not the key ring). A rejected copy gives one line that names the file and the wrapper. | LA-ADR-06 D3 "CLIs"; operability §2 (secret files, reset rule); security-delta §10 visibility rule; LA-E5-05 scope | The copy sits in the folder that is already hidden from `e2e` (BD-A2-03). The key provider reads only `LTI_KEYRING_FILE`, so the extra file is safe. A process that runs in the service container already holds the database, so the copy adds no new exposure. |
| BD-A2-35 | LA-E3-01 AC-06: the real auth URL is percent-encoded, so no raw `<`, `>` or U+2028 reaches the JSON block. L proposed: a page-builder unit test for all five escapes, plus a real hostile-login test (`JSON.parse` keeps the exact URL; no request text outside the block); no raw fields added to manufacture escapes. | **Ratified.** The escape runs on the whole JSON text, so future fields are covered. AC-06 is rewritten to the two parts (UNIT). | LA-E3-01 AC-06 | The two tests together prove the A-LAD-09 rule: request values reach the page only inside an escaped JSON block. |

Changes for the Lead to route:
- **S2 (LA-E5-07 window):** `revokeOthers` on the issue route, with its unit test. It is a small addition to a near-done task.
- **S1 (LA-E5-05):** the one-call rotation (wired last, after S2's flag); the atomic copy, the exit-and-delete rule, the `LTI_OPERATOR_KEY_FILE` default; the copy delete in `infra/scripts/stack-reset.sh` (that file's owner is your call); and S1's process requests (`cli/operator-client.ts`, the `multi-lms.test.ts` helper change, `lti-bootstrap.test.mjs`), which you approved.
- **L (LA-E3-01):** the two AC-06 tests.

No QA K1-SIM criterion changes.

## 19. Round 18: the bounded key re-wrap run (LA-E5-09, lane S2) and the LA-E1-07 channel helpers (lane K), 2026-10-22

Routed in dispatch `ctx_0b48c6aaf499`. Decisions sent to the Lead first (`msg_522b4cb8f44b`), because S2 waited.

| Id | Item | Decision | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-36 | LA-E5-09 item 4: the shared runner has a fixed 60 s lease and no renewal. S2 proposed a bounded run (check the live lease in each batch transaction, yield between batches, stop on the signal or the lease deadline, resume at the next operator call). What are the audit result and details of an interrupted or failed run? Does the job-end event also record `legacyBlobs: refused` (two events, no third)? | **Ratified, with rules:** one synchronous transaction per batch with a compare-and-set update; at least 10 s of lease left and `ctx.signal` not aborted at each batch start; `partial` when stopped; no automatic re-run. **Exactly two events:** the request event and one job-end event (`outcome`, counts, `stopReason`, `legacyBlobsRefused`). The setting is stored in the same transaction as the end event. A failed run: earlier batches stay; its end event has `result: failed` and the error class. | LA-ADR-06 D4 (`result` row), D6 ("Re-wrap", "Legacy refusal"); contract delta §5; LA-E5-09 design notes | It fits the BD-A2-31 stop order: batches take milliseconds and never start late, so the 70 s fallback and the 75 s Docker grace never cut one. `failed` is a new value of the audit result for job-end events only (one line in S1's type). Progress is visible in `GET /operator/v1/key-provider`. |
| BD-A2-37 | LA-E1-07 Reviewer-B MAJOR: the channel `app.ts` files copy `TOOL_ACCOUNT`, `toolName`, `toolUrls`, `PRINTABLE_ID`, `GRANT_CODE` and `parseStrictBody`. Move them to `@cogniate/shared/channel`? | **No; none goes on that list.** `TOOL_ACCOUNT` and `toolUrls` are configuration and protocol-URL building with one owner, so the kernel passes them in the port context (no hard-coded `'cogniate'` or `/lti/launch/` in channels). `toolName`, `PRINTABLE_ID`, `GRANT_CODE` and `parseStrictBody` belong to the kernel setup contract (one definition, shared with the kernel admin-value adapter). A1 chooses context or a pure kernel value sub-path (LA-ADR-01 D1); a sub-path follows the BD-A2-11 conditions. | security-delta §8 "Channel import fence" | `@cogniate/shared` also serves the LTI service and the content host, so it must not hold the app's channel contract. The grant-code grammar is a security grammar and must have one definition. |

Changes for the Lead to route:
- **S2 (LA-E5-09):** the bounded run and its tests. **S1 (RQ-1):** the value `failed` in the audit result type, plus your approved settings and wiring requests.
- **A1:** the import form for the kernel helpers (port context, or a kernel value sub-path under the BD-A2-11 conditions).
- **K (LA-E1-07 fix round):** move the six helpers after A1's call.

## 20. Round 19: decrypt metadata, port-context security, the `record_dispatch` order, the login page text, 2026-10-22

Routed in dispatch `ctx_cf668b8b25ae`. Decisions sent to the Lead first (`msg_52355f94de85`), because S2 and R waited.

| Id | Item | Decision | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-38 | LA-E5-09 (S2): a legacy blob whose IV looks like a valid `cgk1` header makes the structural check report the active version, although it opens only through the legacy fallback. S2 proposed `openWithMetadataSync(blob, aad)` (plaintext, authenticated version, `legacyFormat`), with `openSync` and `open` unchanged. | **Ratified**, in its own commit. Re-wrap and the legacy refusal use only authenticated metadata. The `hasBlobHeader` export is dropped. The structural parse stays for counts and readiness, so a version leaves the ring only after a complete re-wrap. | LA-ADR-06 D6 ("Legacy refusal", "Status"); operability §6.3 CAUTION; LA-E5-09 design notes | With a structural check, the refusal could be stored while one legacy blob remains, and that tool key would never open again. One decryption gives both the value and its true form. |
| BD-A2-39 | A1 BD-A1-37 [A2] points: `publicToolKeys()` copies only `kty`, `kid`, `alg`, `use`, `n`, `e` for the call's library; `buildQueue` checks the build id, uses three fixed folders, writes only `requests/` (`0600`, atomic), caps the status size. Anything missing? | **The points stand; four additions.** (1) **Tenant**: a build id is bound to the submitting library; another library's id gives `404`. (2) No symlinks: regular files only, `O_EXCL` temp then rename, folders `0700`. (3) A status file is untrusted: size cap, strict closed schema, values as data only. (4) `download`: fixed extension list, attachment with `nosniff`. Also for keys: string members only, `kty` `RSA`, the published set only, no cache across libraries. | security-delta §8 new row "Channel port context" | The build runner processes untrusted course packages (security §7), so its files are untrusted input. A build id with no library binding would let one library read another library's build status or package. |
| BD-A2-40 | LA-E4-02 (R): the frozen `rowid` statements for results and `latestSyncStatus` must now query `record_dispatch`, and the `014` backfill needs `ORDER BY s.rowid` to keep the creation order. | **`record_dispatch` gets `seq` now** (`INTEGER NOT NULL`, unique, `MAX(seq) + 1` in the write transaction; A1 adds it to the data-model `014` sketch). The two moved statements order by `created_at, seq`, and their baseline entries are **deleted**. The `014` backfill sets `seq` with `ROW_NUMBER() OVER (ORDER BY s.created_at, s.rowid)`: listed SQLite-adapter item (d), with an exact F5 allow entry. `results.ts:33` still orders the legacy `attempt` table, so its entry is **replaced one for one** (no growth). The baseline goes from 9 to 7. | LA-ADR-06 D13 rule 2 (item (d), baseline sentence) and item 6 (a) | New LA SQL has no `rowid` (BD-A2-22). `learning_record` needs no `seq`. LG makes `seq` an identity column. |
| BD-A2-41 | LA-E3-01 Reviewer-B NIT: the platform-storage login page is blank. | **Static text**: visible "Opening the activity. Please wait."; `<noscript>`: "This activity needs JavaScript. Turn on JavaScript in your browser, then open the activity again from your course." No request data in it. | contract delta §2.1 (login page row); LA-E3-01 design notes | A learner with slow or blocked scripts sees a reason and an action. The CSP does not change. |

Changes for the Lead to route:
- **S2 (LA-E5-09):** `openWithMetadataSync` in its own commit, and the collision unit test.
- **K (LA-E1-08):** the BD-A2-39 additions, especially the build-id library binding.
- **A1:** `record_dispatch.seq` in the data-model `014` sketch and the LA-E4-02 spec.
- **R (LA-E4-02):** the `seq` column, its insert, the backfill, and the exact SQL for P.
- **P:** one F5 commit (delete two baseline entries, replace one, add the `014` migration allow entry).
- **L (LA-E3-01):** the static page text.

## 21. Round 20: the failed re-wrap outcome without a schema change (LA-E5-09, lane S2), 2026-10-22

S2's follow-up to BD-A2-36, routed in dispatch `ctx_036efe7bc769`. Decision sent to the Lead first (`msg_03636c06cb23`).

| Id | Item | Decision | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-42 | (1) `audit_event` of migration `007` has `CHECK (result IN ('ok','refused'))`, so the `failed` result of BD-A2-36 needs a table-rebuild migration (keep the `007`/`008` guards, rows and indexes). Or another form? (2) The meaning and shape of `details.remaining`. | **Changes BD-A2-36.** (1) **No schema change:** a job-end event always has `result: ok` and no `code`; the job outcome is `details.outcome` and an exception class is `details.errorClass`. The `failed` audit result value is withdrawn (S1 removes it from the type if it was added); no migration `017`. (2) **Details shape:** `{ outcome, rewrapped, skippedChanged, notReached, unreadable, unreadableVersions?, stopReason?, errorClass?, legacyBlobsRefused? }`. `failed` = an unreadable row (the run goes on) or an exception. The refusal is stored only for `complete`. No per-version counts in the event; `GET /operator/v1/key-provider` gives that view. | LA-ADR-06 D4 (`result` row), D6 ("Re-wrap"); contract delta §5; LA-E5-09 design notes | A rebuild of the append-only audit table means dropping and re-creating its guards and copying every row. That is an integrity risk and a SQLite-only pattern (D13), for a rare event. Per-version counts for rows that the run did not reach would need extra decryption; `notReached` and `unreadable` are exact without it. The `job_run` log line keeps `result: failed` for alerts. |

Changes for the Lead to route: **S2** builds the details shape. **S1** removes `'failed'` from the audit result type if its RQ-1 commit added it; S1 makes no audit migration. Migration number `016` stays with S2.

## 22. Round 21: the legacy refusal check and the storage-check fallback (LA-E5-09 lane S2, LA-E3-01/02 lane L), 2026-10-22

Routed in dispatch `ctx_b723ecea06b7`. Decisions sent to the Lead first (`msg_4ac61631b779`).

| Id | Lead call | Ratified / changed | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-43 | (S2's reading.) The refusal needs "no old-format blob remains after the re-seals", with a final verification only on complete runs; partial and failed runs never decrypt unreached rows. A compare-and-set skip, or an old-format row inserted at the same time and found by the final check, gives `partial` without a `stopReason` and no refusal. | **Ratified, with two precisions.** It corrects my BD-A2-42 words ("none was opened"). (1) The final verification, the setting and the end event are **one synchronous transaction** (the write lock is held, so nothing changes between check and write). A verification that cannot finish in the lease gives `partial`, `stopReason: lease`. (2) The `stopReason` is named `legacy_remains`, not left empty. A compare-and-set skip alone does not change the outcome. There is no retry in the same run. | LA-ADR-06 D6 ("Legacy refusal", "Re-wrap"); LA-E5-09 design notes | One transaction makes "none remains" true at the moment the setting is stored. A named reason tells the operator why to run it again. |
| BD-A2-44 | (L's reading, LA-E3-01 fix round.) LA-ADR-05 D1 rule 8 and AC-LA-E3-02-03: no cookie fallback on `POST …/storage-check`. The launch checks a matching cookie first and reads platform storage only when the cookie is missing. Reviewer-A2's note (a parallel login can overwrite a 16-slot `cog_state_<d>` key) is closed by a collision regression test. | **Confirmed.** Reviewer-A2's "fall back to the cookie" is already met at the launch step (rules 5 and 7). The storage check runs only because the cookie was missing, and it must stay free of ambient credentials (security delta §6). | LA-ADR-05 D1 rule 8; LA-E3-02 design notes | A collision affects only a cookie-less browser with two parallel logins. It fails safe (`storage_mismatch`, no ltik), and the learner opens the activity again. |

Changes for the Lead to route: **S2**: the one-transaction final verification and `legacy_remains`, with the two unit tests. **L**: the two collision regression tests. No K1-SIM criterion changes.

## 23. Round 22: the app audit contract (LA-E5-11 lane S1, LA-E5-12 lane K), 2026-10-22

S1's contract questions, routed in dispatch `ctx_cdabc915700c`. Decisions sent to the Lead first, for A1 too (`msg_e00127bf6ba2`).

| Id | Item | Decision | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-45 | (1) The app `audit_event` has no connection column, but `app:audit --connection` must find grant and binding events. (2) `OPERATORS` and `OPERATORS_FILE` both set. (3) `client_ip` in the app table. S1's seam: `evaluateOperatorPolicy(input, env)` results; `app/audit` with `insertAuditEvent`, `listAuditEvents`, `withAudit` (LTI rules, `libraryId`), a strict 4 KB details limit. | (1) **A column**: `connection_id` (nullable, index `(library_id, connection_id, ts)`); `target` stays the changed object. (2) **Refuse** in every profile (`operators_ambiguous`, exit 1, nothing written). (3) **Confirmed**: nullable, `NULL` for CLIs; a new trace id for each CLI run. Plus: the app table gets the append-only trigger **and** the `INSERT OR REPLACE` guard. **Seam ratified**, with precisions: D5 snake_case detail names; a policy refusal writes no audit event and no row (the name is not proven) and logs `operator_refused`; the details limit is the LTI rule (`{"truncated": true}`, never an error). | LA-ADR-06 D4 rule 4; LA-ADR-07 D4 "Identity in records"; operability §2; LA-E5-11, LA-E5-12 design notes. **A1**: data-model §5 sketch (two columns, the guard) | A column is portable, indexed SQL with no JSON query, and keeps the D4 meaning of `target`. Silent precedence between two operator lists is a security footgun. A truncation never blocks a grant. A shared writer for both services is a later Could (Reviewer-B's call). |

Changes for the Lead to route: **A1**: `connection_id`, `client_ip` and the `INSERT OR REPLACE` guard in the data-model §5 sketch. **S1 (LA-E5-11)**: the table, the writer seam, and `app:audit list --connection`. **K (LA-E5-12)**: `evaluateOperatorPolicy`, the `operators_ambiguous` refusal, and `connectionId` on every grant and binding event. The migration number `015` and S1's RQ-2 (pin `migration-013.test.ts` to a ≤ 013 folder) are your process items.

## 24. Round 23: the moved `mbz_build` statements (LA-E1-08 lane K) and the service-key defaults (LA-E5-15 lane S2), 2026-10-22

Routed in dispatch `ctx_c3aa765d6d56`. Decisions sent to the Lead first (`msg_66c8173ec562`).

| Id | Item | Decision | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-46 | LA-E1-08 (K): the three frozen `mbz_build` `rowid` statements (`domain/mbz-builds.ts:39`, `:45`, `:57`) move to `packages/channels/moodle/app/builds.ts` with named library and version parameters through `ChannelSql`. Move the entries 1:1, or drop `rowid` (a `seq` column)? | **Move 1:1** with the new exact text and the reference "legacy pre-LA SQL (moved, BD-A2-46)". The count stays seven. Rule: a moved statement that still orders a legacy table may keep its entry; a statement on a new LA table may not. Precondition for **A1**: the channel SQL table/column check must accept the `rowid` pseudo-column in exactly these three statements, or the order stays in the kernel. | LA-ADR-06 D13 rule 2 (baseline sentence), item 6 (a) (file list) | The same rule as `results.ts:33` (BD-A2-40). A `seq` on a pre-LA table is a schema change outside LA; LG item 6 (a) already covers `mbz_build`. |
| BD-A2-47 | LA-E5-15 (S2) defaults: unknown platform on revoke = `404 NOT_FOUND`; existing platform with no match = audited `200 {revoked: 0}`; the write-scope lookup uses the guarded AGS GET, propagates its errors, and caches match and no-match results for 10 minutes per credential hash and line item, bounded. | **Ratified, with one change and two bounds.** Change: `404 UNREGISTERED_PLATFORM` (the base contract code for an unknown platform id), also for a platform of another account, on the tenant and operator routes. Bounds: the other body fields are filters (no match gives `revoked: 0`, not `404`); the cache has at most 10,000 entries, least recently used out. The check runs only for SERVICE-AUTH-V1 writes with `resource-link`; the launch `lineitem` URL passes with no GET; a platform error means no write. | LA-ADR-06 D8 ("Revoke", "Write scope"); contract delta §3 and §4.8 (both revoke rows); LA-E5-15 design notes | One code for "unknown platform" across the tenant API. Propagating the platform error is fail-closed: no lookup result means no write. |

Changes for the Lead to route: **K and P**: the one F5 rule-file and test edit (three entries moved one for one); the F1 baseline reduction is your process item. **A1**: the channel SQL check precondition. **S2**: the `UNREGISTERED_PLATFORM` code, the filter rule, and the cache bound. The L and S1 wiring is your process item.

## 25. Round 24: the protocol-URL rule, the resolver interface, the re-wrap start answer (LA-E5-06 lane L, LA-E5-09 lane S2), 2026-10-22

Routed in dispatch `ctx_97ea3865f48b`. Decisions sent to the Lead first (`msg_98750d6b60f4`), because L waited.

| Id | Item | Decision | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-48 | F5 `protocol-urls` scope: `/lti/launch/` literals also exist in channel app files, app launch-rules, picker, kernel setup, and in route declarations and rate-limit patterns. | **The LTI service only**, non-test. It refuses **building** a protocol URL with an account value outside `accounts/resolver.ts`. A route pattern with `/:account` passes (an exemption by pattern, not by file). App and channel occurrences are not a precondition: the kernel port context owns the tool URLs there (A1 BD-A1-40, BD-A2-37). An app-side rule is A1's later option. | LA-ADR-06 D2 (resolver paragraph); LA-E5-06 design notes | A pattern exemption still catches a new construction in `protocol.ts`. |
| BD-A2-49 | The resolver needs a whole account, but the target helpers and their callers pass only `urls` and `accountId`: should L change the callers, or should S1 add a pure URL builder? | **L changes its callers.** They pass the `protocolUrls(account)` object, computed once per request. The `target.ts` helpers take `{ launch, login }`. The storage-check URL and `jwks_uri` derive from that object. S1 adds no `(urls, accountId)` builder. | LA-ADR-06 D2; LA-E5-06 design notes | A builder from an id would bake in path mode; host mode (LG) needs `publicBaseUrl` from the account. |
| BD-A2-50 | Reviewer-B B-LA-E5-09-01: a re-wrap call gives `202` even when no run starts, the `202` trace id leads to no result, and runbook §6.3 does not say how to read the outcome. | `503 NOT_READY` (`job_runner_not_active`, `retryAfter: 30`, no event) when the runner is not active. `409 JOB_RUNNING` (one refused event) when a run holds the lease. Else `202`. The run uses the request's trace id: an additive runner option `runNow(name, { traceId })`, plus a `traceId` filter on `GET /operator/v1/audit`. The runbook §6.3 steps 5–6 now say how to read the outcome and what to do for each value. | LA-ADR-06 D6 ("Re-wrap"); contract delta §1.3 (`NOT_READY`, new `JOB_RUNNING` row), §3 (re-wrap and audit rows); operability §6.3; LA-E5-09 design notes | `503` for "not now, retry", with the `Retry-After` header from the BD-A2-16 rule. `409` reuses the jobs route code. One trace id joins the request, the run, its log lines and its end event. A rare race of two calls at the same time is covered by the runbook. |

Changes for the Lead to route:
- **L (LA-E5-06):** the caller change, the target helpers, and the F5 `protocol-urls` rule file (your process grant).
- **S2 (LA-E5-09):** the `503` and `409` checks before `runNow`, and passing the trace id.
- **A1 / R (shared runner, LA-ADR-03 D7):** the additive `runNow(name, { traceId })` option.
- **S1:** the `traceId` filter of `GET /operator/v1/audit`.

## 26. Round 25: the Idempotency-Key contract (LA-E5-16, lane S1), 2026-10-22

S1's three open contract points, routed in dispatch `ctx_76073ad82b74`. Decision sent to the Lead first (`msg_084a8a3e4f57`).

| Id | Item | Decision | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-51 | (1) Does the route identity include the real `:id` (S1: the decoded platform id plus the route template)? (2) The body hash input: stable JSON key order, `JSON.stringify`, or raw bytes (S1: stable key order)? (3) Which audit event does a cache hit, or a hook-level `409` or `422`, write, since the route's `withAudit` is skipped? | (1) **Ratified, plus:** the key is unique per tool account; the fingerprint is the method, the route template, the decoded path parameters and the body hash; another fingerprint gives `422`. (2) **Ratified:** SHA-256 of canonical JSON of the parsed body (sorted keys, no whitespace, absent body = `null`). (3) **One event per admin request:** a replay mirrors the stored answer (`ok` or `refused`, `details.idempotentReplay: true`, the key); the hook `409`/`422` write one `refused` event with the route's §5 action; `POST /api/lineitems` writes none (an `api`-class route). Plus two safety rules: only `2xx`/`4xx` are stored (a `5xx` frees the key), and a `running` record older than 60 s is replaced. | LA-ADR-06 D9 "Build rules", D4 rule 1; contract delta §4.9; LA-E5-16 design notes | A key bound to the decoded id cannot replay another platform's answer. Canonical JSON avoids false `422`s on reformatting. A mirrored replay event keeps D4 rule 1 exact and shows retries in the trail. Without the stale-record rule, a crash would block a key with `409` for 24 hours. |

Changes for the Lead to route: **S1 (LA-E5-16)**: the fingerprint, the canonical hash, the audit events in the hook, the two safety rules and their unit tests. The migration number and `api-errors.ts` are your process items. The LA-E7-03 hosts point belongs to A1 (README §4b, BD-A1-01).

## 27. Round 26: metrics sources (LA-E5-17 lane S1) and the operator platform list (LA-E5-15), 2026-10-23

Routed in dispatch `ctx_0e78a30b68aa`. Decisions sent to the Lead first (`msg_d1a1caf0fd39`).

| Id | Item | Decision | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-52 | (Provisional, S1.) Metrics from the existing log events, key gauges and an HTTP hook; JWKS and token outcome observers by RQ-1 to L; an S1 rate-limit observer before sampling; audit counts from committed events only; series with no accurate source marked "pending instrumentation", never zero; account labels only for stored account ids. | **Ratified, with exact sources.** Audit: count after the commit of the outermost transaction that holds the insert (and after the autocommit refused insert); never a table count, because retention deletes rows. L adds `onTokenResult({platformId, ok})` and `onJwksFetch({platformId, ok, fetchedAt})` (injected, no-op by default), and the cache age is computed at scrape time. "Pending" means **not exposed**. Labels: only stored account and platform ids; empty for an unknown account. | operability §4.2 (label rules, new "Sources" table); LA-ADR-06 D10 "Metrics"; LA-E5-17 design notes | A rolled-back insert or a sampled-away refusal must not change a counter. A zero series would hide a gap as "no failures". Raw path ids would make the label set unbounded. |
| BD-A2-53 | LA-E5-15 Reviewer-B B-02: the operator API cannot list an account's platforms, so runbook §6.5 has no source for `platformId`. | **A new read route:** `GET /operator/v1/accounts/:id/platforms` gives `{ platforms: [{ id, name, profile, issuer, clientId, active, deploymentIds }] }`, with no secrets and no audit event, and `404` for an unknown account. Runbook §6.5 gets step 0. | contract delta §3; operability §6.5; LA-E5-15 design notes | The tenant API needs the tenant's key, and the audit log has no issuer or client id to match a library's report. A small read route closes the runbook gap. |

Changes for the Lead to route:
- **S1 (LA-E5-17):** the limiter observer, the commit-time audit counter, and the series and label rules; your process grant for the wiring files.
- **L (RQ-1, one commit):** the two injected observers in the token client and the JWKS cache.
- **Owner of the platform list route** (suggested: S2 in the LA-E5-15 fix round, reading L's existing store function).

## 28. Round 27: JWKS observer attribution (LA-E5-17 RQ-1, lane L) and the LA-E5-11 AC-06 text, 2026-10-23

Routed in dispatch `ctx_4f9a4b12cd5a`. Decisions sent to the Lead first (`msg_8b37c4565095`).

| Id | Item | Decision | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-54 | (Provisional, L's proposal.) `verify(token, jwksUrl, traceId, platformId?)`; the third constructor argument `onJwksFetch` (no-op default); one event attributed to the platform that **starts** the fetch; a cache hit and a caller with no `platformId` emit nothing; `fetchedAt` = the completion time. Open point: platforms that share one JWKS URL share one cache entry. | **Changed.** Failures: one event per verify **call that waited** on a fetch (the starter or a single-flight joiner), with its own `platformId` (same signature). Cache age: **not from events**. A read-only getter `lastSuccessAt(jwksUrl)` on the cache, and at scrape time the age is reported for every stored active platform whose stored URL has an entry. | operability §4.2 "Sources"; LA-E5-17 design notes | A shared URL is the normal case: every Canvas cloud platform uses one fixed JWKS URL. Starter-only attribution would leave most of them without an age series, so the 24 h alert would miss them. Per-waiter events count each launch that hit a failure. |
| BD-A2-55 | LA-E5-11 Reviewer-B2: the AC-LA-E5-11-06 text ("above 4 KB is refused") is stale against BD-A2-45. | **The text changes; the code does not.** `app/audit.ts:71-75` already stores `{"truncated": true}` above 4 KB after `redact()`. The AC now says so, and that the write succeeds. | LA-E5-11 AC-06 | — |

Changes for the Lead to route: **L (LA-E5-17 RQ-1):** per-waiter events and the `lastSuccessAt` getter. **S1 (LA-E5-17):** the scrape-time age join over stored platforms. No code change for LA-E5-11.

## 29. Round 28: the idempotency target and non-final answers (LA-E5-16 review A, lane S1), 2026-10-23

Reviewer-A A-LA-E5-16-01 (BLOCKER) and -02 (MAJOR), routed in dispatch `ctx_651cae9b6f98`. Decisions sent to the Lead first (`msg_f1ab529ed702`).

| Id | Item | Decision | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-56 | A-LA-E5-16-01: on `POST /api/lineitems` the fingerprint has no target (the route takes it from the credential), so the same key and body from two courses replay the first course's line item. The replay also runs before the binding checks. | **The fingerprint carries the resolved target**, by scheme: Bearer = the decoded path parameters; LTIK-AUTH-V2 and SERVICE-AUTH-V1 = `{ platformId, deploymentId, contextId, lineItemsUrl }`. **The lookup runs after the read-only target checks** (account status, platform exists and is active, deployment active, binding generation). A failed check gives its normal refusal, never stored or replayed. | LA-ADR-06 D9 "Build rules"; contract delta §4.9; LA-E5-16 design notes | This makes the BD-A2-51 promise true for credential-scoped routes. A replay must never give a stale success after a platform or deployment was switched off. |
| BD-A2-57 | A-LA-E5-16-02: a platform `429` is stored and replayed for 24 h with its old `Retry-After`, so a retry never reaches the platform. | **Final = `2xx`, or `4xx` other than `429`.** Every `5xx`, every `429`, and any answer with `Retry-After` is not final: the claim is abandoned, and the replay `Retry-After` branch goes. Checked: the idempotency `409`/`422` come from the hook; `JOB_RUNNING` is operator-only; `401`/`403`/`404` of the target come before the lookup; `PLATFORM_ALREADY_EXISTS`, `DEPLOYMENT_ALREADY_EXISTS`, `INVALID_REQUEST` and `PLATFORM_REJECTED_REQUEST` are final. | LA-ADR-06 D9; contract delta §4.9; LA-E5-16 design notes | My BD-A2-51 text said "4xx" and missed that `429` asks for a retry. Stored `429` records from `6ae0ebe` exist only on test volumes and expire within 24 h. |

Changes for the Lead to route: **S1 (LA-E5-16 fix round):** the target in the fingerprint, the new lookup order, the non-final rule, removing the replay `Retry-After` branch, and the three unit tests in the design notes.

## 30. Round 29: idempotency refusal texts and the app CLI refusal line (LA-E5-16, LA-E5-11, LA-E5-12), 2026-10-23

Reviewer-B B-LA-E5-16-01 and B-LA-E5-11-01 (MINOR), routed in dispatch `ctx_3e116c8ff5b3`. Decisions sent to the Lead first (`msg_e0def9256a7c`).

| Id | Item | Decision | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-58 | The idempotency `409` and `422` do not say what to do next. (Provisional: Reviewer-B's texts, with the target in the `422` text.) | **Ratified.** `409 IDEMPOTENCY_IN_PROGRESS` gets `details.retryAfter` (seconds until the 60 s claim ends, at least 1), so `Retry-After` is sent, and the description "A request with this Idempotency-Key is still running. Retry after the time in Retry-After." The `422` description names "another route, path id, target (platform, deployment or course) or body" and "Use a new key for a new request." | contract delta §1.3 (both rows); LA-E5-16 design notes | No conflict with BD-A2-57: the hook produces the `409` and never stores it. |
| BD-A2-59 | The app CLI refusal lines give only a code; production with no operator list gives `operator_unknown`, which points at the wrong cause. (Provisional: `{reason, message}`, `operators_not_configured`, LA-E5-12 prints the line as it gets it.) | **Ratified.** The existing line keeps `event` and `reason` and adds `message`: one fixed sentence per code, never echoing input. New code `operators_not_configured` (production; no list, or an empty one). The ten codes and their messages are in LA-ADR-07 D4. `app:audit` uses the same shape. LA-E5-12 prints the line unchanged (stderr, exit 1). | LA-ADR-07 D4 "Refusal line of the app CLIs"; LA-E5-11 and LA-E5-12 design notes | Fixed messages keep the line safe to log and easy to test. Every code now names its own fix. |

Changes for the Lead to route: **S1 (LA-E5-16 and LA-E5-11 fix rounds):** the two descriptions and `retryAfter`; the `message` field, the new code and its unit tests. **K (LA-E5-12):** print the policy line unchanged.

## 31. Round 30: audit counted at commit, and the request path in logs (LA-E5-17 review, lane S1), 2026-10-23

Review findings A-/B-LA-E5-17-01 (MAJOR) and A-LA-E5-17-02 (BLOCKER), routed in dispatch `ctx_6769e4895e4c`. Decisions sent to the Lead first (`msg_0080b75fdb6a`).

| Id | Item | Decision | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-60 | A committed audit insert inside a caller-owned transaction is never counted. My BD-A2-52 accepted that ("no such route today"), but the `key-rewrap` end event does it. (Provisional: a per-transaction buffer, publish after the outermost commit, discard on rollback.) | **Ratified; my BD-A2-52 exception is removed.** A commit hook `afterCommit(db, fn)` in the shared transaction helper (S1 holds `migrations.ts` by RQ-2): per-scope buffers (merge at `RELEASE`; drop at `ROLLBACK TO` and `ROLLBACK`; run once after the outermost `COMMIT`; at once in autocommit); synchronous callbacks that never throw into the commit path. `insertAuditEvent` registers the count at every insert. | LA-ADR-06 D4 T0, D10 "Metrics"; operability §4.2 "Sources"; LA-E5-17 design notes | I was wrong in BD-A2-52: a product path already commits an event in its own transaction. One hook at the insert counts every path the same way. The app shares the helper (A1 FYI); with no callbacks nothing changes. |
| BD-A2-61 | `http_request` logs the raw `req.url` path (after `redactPath`, which masks only long segments), so `/lti/login/alice@example.test` reaches the log. (Provisional: the route template, `<unmatched>` for no match.) | **Ratified.** `path` = the matched route template with no ids filled in; `<unmatched>` when no route matches; no query; the tenant stays in `tool_account_id`. Readers checked: base contract §5 says "path (no query)"; the M1 oracle does not read `path`; T1 H7 matches by trace id (the service sends `x-trace-id`). `redactPath` stays in `packages/shared` for the app. | operability §4.1; LA-ADR-06 D10 "Tenant id in logs"; contract delta §6; LA-E5-17 design notes | A template is bounded and holds no personal data; filled-in ids would add nothing that `tool_account_id` does not already hold. A1 FYI: the app's unmatched requests still log `redactPath(raw url)` (`server.ts:107`, `content-host/server.ts:122`); the same rule is recommended there (app contract, A1's call). |

Changes for the Lead to route: **S1 (LA-E5-17 fix round):** the commit hook and its four tests; the route-template path and its two tests. **A1 FYI:** the shared commit hook; the app's unmatched-path log line.

## 32. Round 31: the `app:audit` refusal line (LA-E5-11 fix round, lane S1), 2026-10-23

Routed in dispatch `ctx_da332f36da02`. The Lead's provisional call is ratified without change, so no status message was needed.

| Id | Lead call | Ratified / changed | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-62 | (Provisional, S1.) `app:audit` keeps the event `audit_list_refused` and `traceId`, and adds `message` = one fixed sentence per code that never echoes input (no bad flag, no `DATA_DIR` path; the usage line and the default path are in the fixed text); a wrong command gives `arguments_invalid` instead of the usage text as the reason; `--help` prints the usage on stdout with exit 0. | **Ratified.** The six codes and their fixed messages are now in LA-ADR-07 D4 (`arguments_invalid`, `connection_invalid`, `action_invalid`, `limit_invalid`, `since_invalid`, `audit_read_failed`). Reviewer-B's wish to name the bad flag is refused by the BD-A2-59 rule "never echoes input". | LA-ADR-07 D4 (`app:audit list` refusals); LA-E5-11 design notes | BD-A2-59's "same shape" means the `reason` and `message` fields. `app:audit` keeps its own event name and `traceId`, because it is a read command, not the operator policy. |

Changes for the Lead to route: none beyond S1's fix round.

## 33. Round 32: evidence for revoke, and refused events of the app CLIs (LA-E5-12 lane K, LA-E5-11 lane S1), 2026-10-23

K's question and three provisional points, routed in dispatch `ctx_8749e4ef993f`. Decisions sent to the Lead first (`msg_a9aa80ad17c2`).

| Id | Item | Decision | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-63 | Q1: `app:grant revoke` takes only `--operator`, but the policy requires evidence for every production command, so a production revoke always fails. (a) A policy input flag (S1), or (b) revoke also takes the evidence flags. (Provisional: (b).) | **Changed to (a).** `OperatorPolicyInput.evidenceRequired?: boolean`, default `true` (fail closed); `false` only for revoke, which skips only the two "missing" checks. Revoke does not parse evidence flags; K drops its interim parse. | LA-ADR-07 D5; LA-E5-11 and LA-E5-12 design notes | D5 lists evidence only for issue, suspend and release. A revoke only removes access (the BD-A2-12 principle), and an emergency revoke must not wait for a ticket reference. |
| BD-A2-64 | (Provisional.) One `refused` event per refusal after the target is resolved, also for a format error on a known target; none for an unknown target, a usage error or an LTI outage. A stable snake_case `code` per refusal, with the CLI line text unchanged. The policy line printed as given and logged with its event and reason. | **Ratified, with one precision:** a policy refusal never writes an event, even after the target was read (BD-A2-45). | LA-ADR-07 D4 "Audit events of refused CLI runs"; LA-E5-12 design notes | The code list belongs in the app API delta §7 table (A1's file); until A1 adds it, the LA-E5-12 notes hold it. |

Changes for the Lead to route: **S1 (LA-E5-11 fix round):** the `evidenceRequired` input and its two unit tests. **K (LA-E5-12):** revoke with `evidenceRequired: false`, dropping the interim evidence flags. **A1:** the refusal-code list in the app API delta §7.

## 34. Round 33: LA-E5-20 spec gaps (lane S1), 2026-10-23

Six questions from S1, routed in dispatch `ctx_a41d37871369` (provisional: "ok to all six"). Decisions sent to the Lead first (`msg_232fe65ebc42`).

| Id | Question | Decision | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-65 | Q1 `autoRotate`: the environment list `SIGNING_KEY_AUTO_ROTATE_ACCOUNTS`, or a stored field? | **Changed to a stored field:** LTI migration `019` `tool_account.auto_rotate` (default `0`); `PATCH /operator/v1/accounts/:id {autoRotate}`; `Account.autoRotate`; an `account.update` event; `409 ACCOUNT_CLOSED` on a closed account. | LA-ADR-06 D2 (column table), D7; contract delta §1.1, §3; operability §2; LA-E5-20 notes | D7 makes it an account setting, like `limits` and `claimPolicy`: changed through the API, audited, no restart. S1 owns the account files in B3. |
| BD-A2-66 | Q2 `closedRetentionDays`: `CLOSED_ACCOUNT_RETENTION_DAYS`? | **Ratified:** default 30, a whole number ≥ 1, a bad value stops the start, counted from `status_changed_at`. | LA-ADR-06 D2; operability §2 | — |
| BD-A2-67 | Q3 the purge scope (delete the tenant rows of ten tables; keep the tombstone and the audit rows; a log line; no audit event). | **Scope ratified; changed: one `account.purge` audit event** per purged account (actor `system:account-purge`, `details` = counts by table), in the same transaction. | LA-ADR-06 D2; contract delta §5; security-delta §8; LA-E5-20 notes | The deletion of a tenant's data is the evidence of the LA-H4 retention promise, and audit rows survive the purge. The account lifecycle lives in LA-ADR-06 D2, not LA-ADR-07. |
| BD-A2-68 | Q4 the rotation job (the route events with actor `system:signing-key-rotation`; `SIGNING_KEY_ROTATE_DAYS` ≥ 8; never forces; respects the lead time). | **Ratified, plus:** it skips accounts that are not `active`. | LA-ADR-06 D7; contract delta §5; operability §2 | Nothing signs for a suspended or closed account. |
| BD-A2-69 | Q5 `POST /operator/v1/jobs/:name/run` answers (as BD-A2-50; `404` for an unknown name; `key-rewrap` allowed; ISO `lastRunAt`). | **Ratified.** | LA-ADR-06 D11 "On-demand runs"; contract delta §3 | — |
| BD-A2-70 | Q6 `api-key-expiry`: `api_key_expiring` warn lines and `job_run` counts `{expiring}`; the gauge stays the scrape query. | **Ratified.** | LA-ADR-06 D11 (job row) | Ids only, never a key. |

Changes for the Lead to route: **S1 (LA-E5-20)**: the stored `autoRotate` field (migration `019`, the account PATCH and view), the `account.purge` event, and skipping accounts that are not active; the rest as S1 planned.

## 35. Round 34: the AGS preflight before the claim, the exact session cap, `trustedAudiences` docs, 2026-10-23

Routed in dispatch `ctx_1ecaed288113`. The item 1 answer went to the Lead first (`msg_4e1ef7efc041`).

| Id | Item | Decision | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-71 | A-LA-E5-16-03 (MAJOR): the idempotency target resolution checks platform and binding but not the AGS permission, so a credential that lost the `lineitem` scope gets an old `201`, and a `403 SERVICE_NOT_AVAILABLE` is stored. (Provisional: L exports one read-only preflight; S1 calls it before the claim.) | **Ratified.** `preflightCreateLineItem(ctx)` in `platform/ags.ts` (L, RQ-1), also used by `createLineItem`. Checks in order: the `lineitems` claim is a string; the base URL exists (both `403 SERVICE_NOT_AVAILABLE`); the URL rule (`400 INVALID_LINE_ITEM_ID`); the scope `lineitem` (`403`). No I/O. It runs after `agsContext` and before the claim; its refusals are never stored. Not the scope in the fingerprint. | LA-ADR-06 D9 "Order"; contract delta §4.9; LA-E5-16 design notes | This is one of the BD-A2-56 read-only target checks. One function for the route and the hook keeps the two from drifting apart. |
| BD-A2-72 | The BD-A2-20 text ("a small overshoot is accepted") is stale: LA-E5-06's fix round re-checks the cap and inserts in one transaction after the last `await`. S1's comment at `http/rate-limit.ts:201` is stale too. | **Text updated: the cap is exact.** S1 changes the comment in its next commit (a NIT). | LA-ADR-06 D1 (cap paragraph); LA-E5-03 and LA-E5-06 design notes | — |
| BD-A2-73 | B-LA-E3-12-01: the check-5 refusal `aud_untrusted` and its repair are not documented for operators or tenant developers. Where does it go? | **Three places.** The contract delta `trustedAudiences` row (A2): exact rules (the client id is always allowed; exact case-sensitive match; with more than one `aud`, `azp` = the client id; `PATCH` replaces the list; `[]` clears it) and a `PATCH` example. Operability §9 (A2): a new symptom row with the steps. The tenant-developer guide `docs/guides/troubleshooting.md` (Docs lane, E8): one entry from these two texts. New bound for L: each entry 1–2,048 characters, at most 20 entries, else `400 INVALID_REQUEST`. | contract delta §4.6 (`trustedAudiences` row); operability §9 | The route accepts any list of strings today (`z.array(z.string())`), so the bound is a small follow-up for L (LA-E3-12), not a gate. |

Changes for the Lead to route:
- **L:** the `preflightCreateLineItem` export (RQ-1 for LA-E5-16); the `trustedAudiences` bound (LA-E3-12 follow-up).
- **S1:** the preflight call before the claim, with the two unit tests; the stale cap comment.
- **Docs:** the troubleshooting guide entry.

## 36. Round 35: raw outer transactions, the no-context fingerprint, revoke by empty context, 2026-10-23

Routed in dispatch `ctx_448b587c3245`. The item 1 answer went to the Lead first (`msg_48ebe238e32a`).

| Id | Item | Decision | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-74 | A-LA-E5-17-03 (MAJOR): the commit hook treats an empty helper scope as autocommit even when `db.isTransaction` is true, so an audit count inside a raw outer transaction publishes at once and survives the outer rollback. | **Rule (a): a loud error.** Transactions open only through `transaction()`. With `db.isTransaction` true and no helper scope, `afterCommit()` and the nested `transaction()` path throw a `TypeError` before any write; both "run now" branches for that case go. Autocommit still runs at once. Four tests for S1. Optional Should: an F5 rule (lane P) against raw transaction statements outside `migrations.ts`. | LA-ADR-06 D4 T0; LA-E5-17 design notes | Checked: no product file opens a raw transaction (only `migrations.ts`; the app hits are comments, and `worker-main.ts` uses the helper). So production does not change, and the app (same helper) is not affected. As with the T2 guard, misuse becomes a failing test, not a silently wrong counter. |
| BD-A2-75 | (Provisional.) The fingerprint target uses `contextId: ""` for a launch without a context, in both schemes. | **Ratified.** | LA-ADR-06 D9; contract delta §4.9; LA-E5-16 design notes | One activity, one fingerprint (LA-ADR-05 D2: no context = `""`). |
| BD-A2-76 | L2 (LA-E3-03): the service-key revoke body has `contextId` `min(1)`, so no revoke by the empty context. Acceptable, or accept `""`? | **Changed (a later small S2 item, not a gate):** `contextId: ""` = only the keys of launches without a context; absent = no context filter. Until then, the workaround is to revoke by `resourceLinkId`. | LA-ADR-06 D8 "Revoke"; contract delta (both revoke rows); LA-E5-15 design notes | `""` is a real context value in the data model, and BD-A2-47 made `contextId` a filter. |

Changes for the Lead to route: **S1** (next LA-E5-17 round): the guard and its four tests; the `""` target (LA-E5-16). **S2** (later): `contextId: ""` in the revoke schema. **P** (optional): the F5 raw-transaction rule.

## 37. Round 36: LA-E5-21 key and secret rules, the job runbook, LA-E5-20 choices (lane S1), 2026-10-23

Routed in dispatch `ctx_e03f42d6f8fe`. Items 1–4 went to the Lead first (`msg_5bc1f924ba16`).

| Id | Item | Decision | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-77 | A-LA-E5-21-02 = B-LA-E5-21-01 (MAJOR): startup always needs the master key, so a production stack with only a complete key-ring file does not start. | **Ring-only start is allowed.** One reader `readStartupKeys(env)` in `keys/key-config.ts` (S1 with RQ-2) gives the ring and the handle. The ring must hold `legacy`; handle = its bytes; a master-key setting next to a ring must equal it; `config.ts` drops the master-key read; `loadKeyProvider` reuses the ring. No ring: the legacy fallback stays. | LA-ADR-06 D6, D12; operability §2; LA-E5-21 notes | Every service key derives with `legacy` (D6), and the store callers use its bytes as the handle, so the ring must hold it. |
| BD-A2-78 | A-LA-E5-21-01 (MAJOR): a secret file of any mode passes. | **No group or world bit** (`mode & 0o077 === 0`; `0600`, `0400` pass), regular file, checked with `fstat` on the opened descriptor, read from the same descriptor; no owner check. `production`: `config_refused {reason: secret_file_mode, setting}`; other profiles: a `secret_file_mode_open {setting}` warning. One shared reader for `*_FILE` and the ring. | LA-ADR-06 D12; operability §2; contract delta §6; LA-E5-21 notes | Checking the descriptor avoids a race. A readable file with no group or world bit belongs to the service user (or root), so an owner check adds nothing. |
| BD-A2-79 | B-LA-E5-21-02: the refusal lines give only a code. | One fixed message per code (seven, with `secret_file_mode`), naming the setting and the change, never a value. | operability §2 "Production refusals"; LA-ADR-06 D12 | Same style as LA-ADR-07 D4. |
| BD-A2-80 | B-LA-E5-21-03: upper- and lower-case hex of one master key count as different values. | **Hex keys compare case-insensitively** (as bytes): `readSecretSetting(..., { hexKey: true })` for every master-key read; other secrets compare exactly. | LA-ADR-06 D12 | One rule in one reader. |
| BD-A2-81 | B-LA-E5-20-01: no general on-demand job procedure. | **Written:** operability §8a (list, run, keep the trace id, read `job_run`, handle `503`/`409`/`404`/`failed`/`skipped_lease`, re-wrap pointer, purge evidence and the tombstone); `JobStale` links to it. | operability §8a, §5 | — |
| BD-A2-82 | S1's choices: `account.purge` `details.counts` as a list `[{table, rows}]` (redaction hides object keys that end in `key`); the log line `job_run_request_failed` when `runNow` rejects. | **Ratified.** | LA-ADR-06 D2, D11; contract delta §5, §6; LA-E5-20 notes | A good catch: an object key `api_key` would be redacted. |

Changes for the Lead to route: **S1** (LA-E5-21 fix round): BD-A2-77 to BD-A2-80 with the unit tests in the notes (RQ-2 for the `keys/key-config.ts` lines). **A1 FYI:** the app's `APP_MASTER_KEY_FILE` (LA-E5-22) goes through the same shared `readSecretFile` and `hexKey` rule.

## 38. Round 37: granted scopes before the claim, reserved-host audience, runbook (LA-E2-01/02 lane L, LA-E5-20), 2026-10-23

Routed in dispatch `ctx_d4fafe0eb0e7`. Items 1 and 2 went to the Lead first (`msg_eaceb1e6109f`).

| Id | Item | Decision | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-83 | A-LA-E2-01-02: with `platform.grantedScopes`, a scope that the platform did not grant gives `403` from the token client after the idempotency claim (so it is stored), and `needScope` can pick a scope that was not granted while a granted one would work. | **Yes, before the claim.** `needScope` picks the first wanted scope that is in the launch claim **and** in `grantedScopes` (null = no limit). The preflight's step 4 checks both; else `403 SERVICE_NOT_AVAILABLE` with a fixed text for the claim or the grant. The token-client filter stays as a backstop. | LA-ADR-06 D9; contract delta §4.9; LA-E2-01 and LA-E5-16 notes | A refusal of the current grant is never stored, and a call never asks for an ungranted scope. |
| BD-A2-84 | A-LA-E2-01-01: a staged admin create accepts `clientAssertionAud` on a reserved host, because the staged exception (A1 BD-A1-82) skips the audience check. | **The reserved-host rule applies to the audience always, staged or active:** rule 2 (https, site rules 2 and 3, not a reserved host), else `400 PLATFORM_URL_NOT_IN_PROFILE`. The staged exception covers only the issuer-origin rule (I-SELF, and "audience = token URL" for active platforms). | LA-ADR-07 A6; security-delta §2.4; contract delta §4.6; LA-E2-01 and LA-E2-02 notes | We sign the client assertion with our key. An audience on a hosted LMS host (for example a Canvas token URL with a client id of ours) would let the holder of a staged platform replay our assertion there; a grant does not make that safe. A1's BD-A1-82 stays as is. |
| BD-A2-85 | Codex Reviewer-B (LA-E5-20 r2): the job runbook keeps a stale `lastResult` fallback. | **Removed.** Step 3 reads only the `job_run` line with the trace id. | operability §8a | — |

Changes for the Lead to route: **L** (next round): the `needScope` and preflight grant check, and the audience rule-2 check before the staged return, with the tests in the LA-E2-01 notes.

## 39. Round 38: the `autoActivate` line of `complete` (A1 BD-A1-93, LA-E2-02), 2026-10-23

Routed in dispatch `ctx_a8c14abba5d2`. No lane waits.

| Id | Item | Decision | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-86 | A1 BD-A1-93 (LA-IC-21) asks for one line in the `complete` table: `autoActivate` applies to a new platform only; an update keeps the stored `active` value; a staged result is inactive. Also check that the table and the base contract agree with it and with BD-A2-83/84 and A1 BD-A1-88/89. | **Added**, as a table row for the base field `autoActivate`. Aligned in the same section: the I-SELF bullet ("an update keeps its stored `active` value"; "created or set inactive"); the stored-values paragraph (BD-A2-83 scope choice, BD-A1-89 one credential set with an omitted `authorization_server` clearing the audience, BD-A1-88 `profile_mismatch`); the reserved-host bullet (BD-A2-84 audience). | contract delta §4.5 | The base contract §3.8 row (`autoActivate` default `true`) stays true for a new platform; the delta row narrows it for updates, as LA-IC-21 lists. Nothing contradicts. |

Changes for the Lead to route: none (contract text only).

## 40. Round 39: L2's LA-E3-05 local choices (Deep Linking completeness), 2026-10-23

Routed in dispatch `ctx_bf9df1eb1c35`. All five are ratified without change, so no status message was needed.

| Id | Lead call | Ratified / changed | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-87 | (Provisional, L2's choices.) (1) `PLACEMENT_NOT_GRADED` = a `/tool/*` error page with status `403`, log `picker_rejected {reason: placement_not_graded}`. (2) The picker GET and POST read `acceptMultiple` and `acceptLineItem` from `GET /api/idtoken`. (3) The POST also refuses with `PLACEMENT_NOT_GRADED`, with no Deep Linking call. (4) A duplicate id in a multi-select POST gives `400 PUBLICATION_NOT_AVAILABLE`. (5) Items go in the picker list order. | **All five ratified.** (1) Matches the other picker refusals. (2) The server reads the shaped token and never trusts a form field. (3) The POST re-checks, never relying on the GET page. (4) The page never sends duplicates, so a duplicate is a broken or forged request, with the same code as 21 ids. (5) Is D3b. | LA-ADR-05 D3 "Build notes"; security-delta §5 (page row); LA-E3-05 notes | Process calls checked: app migration `018` = `picker_pick`, and the retention rule (keep a session with an unmatched `picker_pick` row) matches data model §5b. A1 to note the number `018` in §5b (A1's file). A1 FYI: `picker_rejected` reason `placement_not_graded` joins the app log names. |

Changes for the Lead to route: **A1:** the migration number `018` in data model §5b, and the new `picker_rejected` reason in the app log list. Nothing for L2.

## 41. Round 40: app metrics and readiness (LA-E4-07, lane R), 2026-10-23

Lane R's design calls D1–D4, routed in dispatch `ctx_0289fb00215b`. One call changes, so a status message went first (`msg_c7293864d95e`).

| Id | Item | Decision | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-88 | D1 listener settings (`OPERATOR_HOST`, `OPERATOR_PORT` default 4210, production loopback rule); D2 sources of each app series and the label guards; D3 readiness (database, migrations, and the LTI service through the guarded client); D4 topology (web process only; send and job series only with `APP_JOB_RUNNER=on`). | **D1 ratified**: 4210 is the design port; the LTI listener is 4110, so there is no clash; same fixed refusal message. **D2 ratified, with three precisions**: (a) the send counter counts at commit (`afterCommit`); (b) the redemption count from `binding_attempt` rows is a counter only while no job deletes them; (c) `JobStale` covers interval jobs only, and the outbox is watched by `DispatchBacklog`. **D3 changed**: app readiness checks only the app (database, migrations, key provider when it exists); no LTI check. **D4 ratified**: series absent (not zero) with a standalone worker. | LA-ADR-06 D10 "Readiness"; operability §4.3 "App rules", §4.4, §5 (`JobStale`) | An LTI readiness check inside the app would make one outage show twice and cascade, while the runbooks already check both services. The `record-dispatch` precision prevents a false `JobStale` on an idle outbox. |

Changes for the Lead to route:
- **R (LA-E4-07):** drop the `lti_service` readiness check; count sends at commit; `JobStale` only for interval jobs.
- **A1:** in app API delta §8a, record the listener settings (`OPERATOR_HOST`, `OPERATOR_PORT` 4210, the production loopback refusal), the series list with sources and label guards (unknown channel `''`, reason grammar else `other`), the readiness checks and answer shape (no LTI check), and the topology rule (send and job series only with `APP_JOB_RUNNER=on`; absent, not zero, with a standalone worker). Also the same notes in the LA-E4-07 spec (A1's file).

## 42. Round 41: the Canvas Dynamic Registration origin rule (LA-E3-09, lane L), 2026-10-23

Lane L's question, the Lead's provisional P1, routed in dispatch `ctx_40723308ea61`. One sub-point changes, so a status message went first (`msg_157053e3622d`).

| Id | Lead call | Ratified / changed | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-89 | (Provisional: P1.) The start page gets only `?ref`, and `complete` has no `siteUrl` or `serviceUrl`. P1: derive the values from the configuration, check them with the Canvas site rules, store them on the staged platform, and let the operator grant prove them (no app or contract change). Site origin = the configuration URL origin, "or, for `sso.canvaslms.com`, the issuer". | **P1 ratified, with one change.** The grant's adoption rule (`app/redemption.ts:391-397`) already requires issuer, `siteUrl` and `serviceUrl` to equal the connection's granted values, so a derived value never activates the wrong site. **Change:** a configuration URL on a fixed Canvas host (`sso.canvaslms.com`, beta, test) is refused at `complete` (the AP-05-30 page; nothing stored or sent) until the CANVAS-HOSTED live row. The site origin is never taken from the issuer. | LA-ADR-05 D6 "Configuration URL"; contract delta §4.5; LA-E3-09 notes | For hosted Canvas the issuer is the shared `https://canvas.instructure.com`, not the school's site, so "site = issuer" would stage a platform that can never be adopted. P2's URL parameters are unsigned and add no proof. |

Changes for the Lead to route: **L (LA-E3-09):** one refusal branch for a configuration on a fixed Canvas host, with one unit test. The rest of P1 as built.

## 43. Round 42: the Canvas Dynamic Registration portal path (new task LA-E3-16, lane P), 2026-10-23

Scope gap found by A1 (BD-A1-104), routed in dispatch `ctx_b02542566462`. The answer is not "API only", so no status message was needed.

| Id | Item | Decision | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-90 | Lane P's `CanvasWizard` creates only `manual`, always shows the developer key JSON and an empty binding form, so Canvas Dynamic Registration has no portal path, while LA-ADR-05 D6 promises "no JSON paste and no typed client id". Keep the promise with a P companion task, or say "API only"? | **Keep the promise: new task LA-E3-16** (lane P, Should, B3, size M, cut group F3.6 with LA-E3-09 and LA-E3-15). The scope: a method choice at create (manifest-driven; `manual` default and byte-identical); the registration URL step instead of the JSON for `dynamic` (reuse the shell's registration-URL part); a staged binding form pre-filled from `platform.clientId` and `platform.deploymentIds[0]`. Five ACs: four UNIT, one K1-SIM, plus the M2 Canvas e2e regression. No LD-9 entry. | LA-ADR-05 D6 new row "Portal"; `tasks/LA-E3-16.md`; LA-E3-09 and LA-E3-15 notes | "API only" would lose the D6 promise and leave AP-05-29 without a user path. The operator grant still proves every value, so the pre-fill only saves typing. |

Changes for the Lead to route: **P** builds LA-E3-16. **A1** adds the `epics.md` row: `| LA-E3-16 | Canvas DR in the portal (Canvas wizard) | Should (cut with LA-E3-09, LA-E3-15) | P | B3 | LA-E3-15, LA-E2-04 (K1-SIM also LA-E3-09) | packages/channels/canvas/portal/**; apps/portal/src/sdk/** (export only) | SIM (QA), M2 e2e (QA-E2E) |`, plus the matching lines in the ownership matrix and the F3.6 cut group.

## 44. Round 43: the app key provider (LA-E5-22, lane K) and an audit target type (LA-E5-03), 2026-10-23

Routed in dispatch `ctx_32214d415ccf`. Point 1 changes, so a status message went first (`msg_9d984c765137`).

| Id | Item | Decision | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-91 | K's LA-E5-22 points 1–4 (provisional: accepted as written): (1) settings, `APP_KEYRING_FILE` default `/run/secrets/app/keyring.json`, no production refusal of `APP_MASTER_KEY` in the environment; (2) the AAD rows and the runtime token; (3) bound Buffer handles, no app legacy refusal; (4) re-wrap and status by the CLI `app:keys`. | **2, 3, 4 ratified** (point 4 with the operator policy `evidenceRequired: false` and authenticated metadata, BD-A2-38). **Point 1 changed:** (a) the app key ring lives in a new folder `infra/.secrets/app-keys/`, hidden from `e2e` by its own tmpfs (default `/run/secrets/app-keys/keyring.json`); (b) `production` refuses `APP_MASTER_KEY` as an environment value (`app_master_key_in_env`, a fixed message). | LA-ADR-06 D6 "Scope in LA", D12; operability §2 (new `APP_KEYRING_FILE` row, secret files, refusals), §6.3; security-delta §10; LA-E5-22 notes | (a) `infra/.secrets/app/` is readable by the `e2e` container, and BD-A2-03 names the LA-E5-22 app ring as key material that must be hidden. (b) D12 says every secret has a file form in production; the LTI service already refuses its master key in the environment. A1 FYI: `PortContext.seal(value, column)` changes the LA-ADR-01 D5 sketch. |
| BD-A2-92 | QA-2 (LA-E5-03): `settings.rate_limits` events have target type `service_setting` in the code, but the contract delta §5 says `settings`. | **The code is right**: target type `service_setting`, target id `rate_limits`, which names the stored object like the other target types. **A doc fix** in contract delta §5; no code change. | contract delta §5 | — |

Changes for the Lead to route:
- **K (LA-E5-22):** the default path `/run/secrets/app-keys/keyring.json`, and the `app_master_key_in_env` refusal.
- **The owners of `infra/compose.yaml` (cogniate-app mount, e2e tmpfs), `infra/scripts/stack-up.sh`, `infra/scripts/lib.sh` (`prepare_e2e`) and `infra/scripts/compose-e2e-secrets.test.mjs`:** the `app-keys` folder lines (your process call).
- **A1:** the `seal(value, column)` port sketch in LA-ADR-01 D5.

## 45. Round 44: the pre-fetch rule of Dynamic Registration start (LA-E3-09 AC-05, lane L), 2026-10-23

Codex Reviewer-B's boundary question, routed in dispatch `ctx_4f2f8f46f7ea`. A small code change follows, so a status message went first (`msg_530dc8645c8d`).

| Id | Item | Decision | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-93 | AC-05 and BD-A2-89 say the Canvas site rules run before the fetch, but with the real mixed registry the route fetches every URL for the loosest loaded rule (LA-ADR-02 D5), so a reviewer's probe fetched `https://canvas.instructure.com/api/lti/security/openid-configuration`. Keep the union rule and narrow AC-05, or refuse hosts that every loaded rule excludes? | **Both:** keep the union start rule, plus **one pre-fetch floor for every profile**: a configuration URL that is not https, fails site rules 1–3, or is on a reserved host (a fixed host of any loaded profile) gives `PLATFORM_URL_NOT_IN_PROFILE` before any fetch. AC-05 is rewritten to test this with the real mixed registry. | LA-ADR-05 D6 "Configuration URL"; contract delta §4.5 (start bullet); LA-E3-09 AC-05 and notes | The floor is exact: no loaded profile can complete such a configuration (any-https rules refuse reserved hosts; the Moodle path is on the Moodle site; BD-A2-89 refuses fixed Canvas hosts). So the fetch could only be an outbound request for an unauthenticated caller. |

Changes for the Lead to route: **L (LA-E3-09, before merge):** the floor check in the start route of `registration.ts` before the fetch, and the AC-05 test with the real registry. **A1 FYI:** one line in LA-ADR-02 D5: "start uses the loosest rule of any loaded profile, above the reserved-host floor (BD-A2-93)".

## 46. Round 45: the exact pre-fetch floor (LA-E3-09 fix round 1, lane L), 2026-10-23

The Lead's provisional call (option A) on L's conflict between BD-A2-93 and the frozen Moodle baseline, routed in dispatch `ctx_9a98516847e4`. Ratified without change, so no status message was needed.

| Id | Lead call | Ratified / changed | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-94 | (Provisional: option A.) The BD-A2-93 floor as written would (1) break the frozen T3b AC-T3-05 (it waits for the guarded client's `outbound_blocked` on an http URL and on `169.254.169.254`), and (2) refuse a Moodle on a public IP literal, which completes DR today. Option A: the floor refuses before any fetch only host names that fail site rule 2, own hosts (rule 3) and reserved hosts; http and IP literals go on to the guarded client as today. | **Ratified (option A).** It makes BD-A2-93 exact. Every forbidden target still gets no request: http and private IPs are refused by the guarded client before it connects (`outbound_blocked`, `FETCH_FAILED`), and the reserved and own hosts by the floor (`PLATFORM_URL_NOT_IN_PROFILE`). A public-IP Moodle keeps Dynamic Registration. | LA-ADR-05 D6 "Configuration URL"; contract delta §4.5 start bullet; LA-E3-09 AC-05 and notes | Option B would change a frozen baseline (an LA-IC and a QA change) and drop a working case, for a property (no request to a forbidden target) that option A already keeps. |

Changes for the Lead to route: none beyond L's build of option A (already in progress).

## 47. Round 46: the floor keeps the M1 `ISSUER_RESERVED` start page (LA-E3-09 fix round 1, lane L), 2026-10-23

The Lead's provisional call (option Y), routed in dispatch `ctx_e7307e62e227`. Ratified without change, so no status message was needed.

| Id | Lead call | Ratified / changed | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-95 | (Provisional: option Y.) Every reserved issuer host is a reserved host, so the BD-A2-93 floor would answer `PLATFORM_URL_NOT_IN_PROFILE` first, and the M1 start page `ISSUER_RESERVED` (base contract §9.2, pinned by `lti/codes.test.ts`) could never show again. Y: a reserved **issuer** host gets the M1 `ISSUER_RESERVED` page byte for byte; any other reserved host, an own host or a failing host name gets `PLATFORM_URL_NOT_IN_PROFILE`. The AC-05 example becomes `sso.canvaslms.com` for `PLATFORM_URL_NOT_IN_PROFILE`, and `canvas.instructure.com` shows `ISSUER_RESERVED`. | **Ratified (option Y).** | LA-ADR-05 D6 "Configuration URL"; contract delta §4.5 start bullet; LA-E3-09 AC-05 and notes | Both options refuse before any fetch. Y keeps a frozen M1 page and its action line ("Connect it as Canvas or Blackboard in the Cogniate portal"), which tells the admin the right fix. X would need a contract note and would drop that help. |

Changes for the Lead to route: none beyond L's build of option Y (in progress).

## 48. Round 47: the async store port (LA-E5-23, lane S2), 2026-10-23

The Lead's provisional calls on S2's three questions, routed in dispatch `ctx_4d5054a2f4d8`. Ratified without change (one addition), so no status message was needed.

| Id | Lead call | Ratified / changed | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-96 | (Provisional.) (1) The synchronous SQL stays private to the SQLite adapter; async per-area `LtiStore` methods; each compound audited transaction becomes one atomic store operation (no thenable inside `transaction`/`audit.change`); structural call-site changes are in scope. (2) Production SQL moves verbatim into `store/**`; the boundary probe excludes `*.test.ts` and testkit fixtures. (3) The probe is S2's `store/port-boundary.test.ts`, with no F5 rule change. | **All three ratified, with precisions and one addition.** The audited store method also holds the BD-A2-29 action rule and the `afterCommit` callbacks, and a later `4xx` writes its `refused` event through a store method. The probe has a planted-call negative case. **Addition:** the audit-retention `DELETE` gets its own store module (D4 rule 2 keeps `store/audit.ts` insert and list only), and lane P moves the F5 `audit-event-delete` `ALLOWED` path to it in the same merge; otherwise F5 fails. | LA-ADR-06 D13 item 3 "Build rules"; LA-E5-23 AC-01 (exact text) and notes | Atomicity and the commit-time counters stay inside one synchronous transaction, so D4 T0–T2 hold behind an async port, and an LG Postgres adapter can implement the same methods. |

Changes for the Lead to route: **S2 (LA-E5-23):** as provisionally called, plus the audit-retention module and the planted-call test case. **P:** move `ALLOWED` in `infra/scripts/fitness/rules/audit-event-delete.mjs` from `jobs/audit-retention.ts` to S2's new store module, in the same merge.

## 49. Round 48: a missing key version in the app (LA-E5-22 fix round 1, lane K), 2026-10-23

The Lead's provisional calls on Claude Reviewer-A A-LA-E5-22-02 (MINOR), routed in dispatch `ctx_5c2694ba9004`. Ratified without change, so no status message was needed.

| Id | Lead call | Ratified / changed | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-97 | (Provisional.) (1) A score dispatch with "version missing / ring not bound" maps to `{kind: 'retryable', uncertain: false}`; an authentication failure stays `local_failure`. (2) The connection list and detail degrade only that row (`registrationUrl` and its expiry `null`, the `key_open_failed` line, `200`); an authentication failure stays `500`; no new code. (3) The `app:keys rewrap` output and help: "write the ring, restart the app and check /readyz = 200, then rewrap". | **All three ratified.** | LA-ADR-06 D6 "Scope in LA" (app part); operability §6.3 (the app order); LA-E5-22 notes | A missing version is an operator state that a restart with the right ring fixes, so retrying is right; a failed GCM tag means a moved or damaged blob, which must stay loud. The app `/readyz` (`key_version_missing`, BD-A2-88) shows the cause. The order is the same as the LTI runbook (§6.3 steps 3–5). |

Changes for the Lead to route: none beyond K's fix round.

## 50. Round 49: the connection check's local choices (LA-E6-01, lane P), 2026-10-23

P's five provisional choices, routed in dispatch `ctx_b9f02fbfab80`. Two change, so a status message went first (`msg_e44b3e7910a9`).

| Id | Item | Decision | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-98 | (a) No granted AGS scope: no token request, `token.detail: invalid_scope`. (b) A bad JWKS: `invalid_jwks`, `http_<status>` or the outbound reason. (c) No `deploymentId` = the first active deployment; an unknown or inactive `deploymentId` gives `403 DEPLOYMENT_NOT_ACTIVE`. (d) One "Check connection" panel on the connection page only. (e) Another token failure: "{LMS} did not give Cogniate an access token." with the code. Staged records refused before any call. | **(b), (d), (e) and the staged refusals ratified.** **(a) changed:** `token.detail: no_granted_scope`, with its own portal text. **(c) changed for one case:** an unknown `deploymentId` gives `404 UNKNOWN_DEPLOYMENT`; a known inactive one, or no active deployment, keeps `403 DEPLOYMENT_NOT_ACTIVE`. | LA-ADR-08 D4 ("Work", "Portal"); contract delta §2.6 (detail values, unknown deployment); LA-E6-01 notes | `invalid_scope` is an OAuth answer of the platform; reusing it for our own decision would send an operator to look for a platform refusal that never happened. `UNKNOWN_DEPLOYMENT` is the base code for an unknown id (as for `PATCH …/deployments/:deploymentId`). |

Changes for the Lead to route: **P (LA-E6-01):** the `no_granted_scope` detail and its portal text; `404 UNKNOWN_DEPLOYMENT` for an unknown `deploymentId`. The RQ-2 grants are your process calls.

## 51. Round 50: the log name of the token result (LA-E6-01, lane P), 2026-10-23

The Lead's provisional naming call, routed in dispatch `ctx_3638d89e08e6`. Ratified without change, so no status message was needed.

| Id | Lead call | Ratified / changed | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-99 | (Provisional.) The shared redaction replaces every field named or ending with `token`, so the contract's log field `token` would always read `[redacted]`. The log field becomes `token_result` (LTI `platform_check`, app `connection_check`), and the audit details key `tokenResult`, with the same value `{ ok, scope?, detail? }`. `jwks` keeps its name; the HTTP answers keep `token`. No change to the redaction rule. | **Ratified.** `token_result` and `tokenResult` end in "result", so the redaction (`SECRET_KEYS`, `SECRET_SUFFIXES`) does not touch them; the value holds no secret. | contract delta §6 (`platform_check` row), §5 (`platform.check` details), §2.6 (a naming sentence); LA-ADR-08 D4 "Logs"; LA-E6-01 notes | Widening an exception for `token` in the shared rule would weaken redaction for every other log line. HTTP answers are not redacted, so their field name stays as in the contract. |

Changes for the Lead to route: none beyond P's build.

## 52. Round 51: the connection health view (LA-E6-02, lane P), 2026-10-23

P's seven provisional design points, routed in dispatch `ctx_6cc6b1801618`. Ratified without change, so no status message was needed.

| Id | Item | Decision | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-100 | (a) `nextKid` = `null` (the public JWKS has no status). (b) `artifactKeyCurrent` = `null` when not knowable, else the equality; warn only on `false`. (c) The `check` event code: `ok`, or `jwks:<detail>` and/or `token:<detail>`; `lastCheck` derived from the newest check row. (d) `lastError.code` = the parsed `CODE` of the stored text, else `null`. (e) Events: the kept rows, newest first. (f) No disconnect or suspend events (no call site assigned). (g) A collapsed health section; no `role="alert"`; M2 and T6 selectors unaffected. | **All seven ratified.** Precisions: (c) the order is `jwks` then `token`, with §2.6 detail values; (d) `CODE` must match `[A-Z][A-Z0-9_]*`. **D5 operator use updated:** the operator reads the next kid from `GET /operator/v1/accounts/<id>/signing-keys`, and the Could CLI takes `--next-kid <kid>`. (f) is a deferral. | LA-ADR-08 D5 "Build notes" and "Operator use"; LA-E6-02 notes | D5 assumed that the JWKS order shows the next key, but after a rotation the second key is a retired one. Only ids and codes reach the portal, never free text. |

Changes for the Lead to route: **A1** (A1's files): app API delta §3.7, the health answer rules (`nextKid` null in LA; `artifactKeyCurrent` null rule; `lastError.code` parse rule; the `check` code format); data model §5a, the `connection_event.code` format for `check` rows. **Lead:** a `deferred.md` row for disconnect and suspend events (K call sites, Could). Nothing new for P.

## 53. Round 52: the stale-key help names a real action (LA-E6-02, lane P), 2026-10-23

P's text point, routed in dispatch `ctx_d010bb937f43`. Nobody waited.

| Id | Item | Decision | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-101 | The stale-key help says "Download the JSON again and paste it into {LMS}", but the Canvas portal shows the key JSON only for a pending manual connection, while a stale key happens on a registered one. (a) Change the text to an action that exists, (b) add a key JSON panel for registered Canvas connections, or (c) another rule? | **(b), the smallest honest option.** The route already exists for every status (`packages/channels/canvas/app/configuration.ts`: inline or key URL, and it records the exported kid); only the portal hides it. P reuses `CanvasConfiguration` as a collapsed "Key JSON" panel on registered Canvas connections. New help text: "{LMS} still has an old Cogniate key in its developer key. Open Key JSON on this page. Choose the key URL (it never needs a new paste), or download the JSON again. Then paste it into the Cogniate developer key in {LMS}." Size S, no API change, no LD-9 entry if the M2 and T6 selectors do not change. | LA-ADR-08 D5 "Build notes"; LA-E6-02 notes | A text-only fix (a) would have to name an action that does not exist: there is no operator export path, and "make a new connection" is a heavy and wrong remedy for a key paste. The key URL form ends the problem for that connection. |

Changes for the Lead to route: **P (LA-E6-02, next round, Could):** the collapsed panel on registered Canvas connections, the new `staleKeyHelp` text, and the unit test, with a check that the M2 and T6 selectors do not change.

## 54. Round 53: the BD-A2-101 build (LA-E6-02 fix round 2, lane P), 2026-10-23

Two choices and one limit, routed in dispatch `ctx_1e24611f6bbc`. Code changes (P only), so a status message went first (`msg_e20f53e47f09`).

| Id | Item | Decision | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-102 | P's choices: (1) "registered" means `registered` or `connected`; (2) the stale-key warning is hidden on `pending` and `disabled` connections. The limit: opening Key JSON exports the key URL form at once and clears the recorded kid, so the warning goes away without a paste. | **(1) and (2) ratified.** **The limit is not accepted; the fix is in P only:** in the registered panel, opening or switching the form fetches and records nothing, and only "Download JSON" or "Copy JSON" fetches, and so records, the export. The pending wizard step does not change. | LA-ADR-08 D5 "Build notes"; LA-E6-02 and LA-E6-05 notes | A warning that disappears because someone looked at the page hides a real stale key in the LMS. Download and Copy are explicit acts of taking the artifact, which is what LA-E6-05 records. No K route change is needed. Known limit, kept and documented: the warning reflects the last artifact taken, not what the LMS holds. |

Changes for the Lead to route: **P (LA-E6-02, next round):** fetch only on Download or Copy in the registered panel, and the unit test.

## 55. Round 54 (urgent): the storage-check page CSP blocks its own redirect (LA-E3-02, lane L), 2026-10-23

QA-E2E's live K2 finding P3 (LA-E7-07 Round 2), routed in dispatch `ctx_86012806ad25`. The rule went to the Lead first (`msg_26600a7ab15a`).

| Id | Item | Decision | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-103 | The storage-check page has `form-action 'self'`. Its form posts to our LTI origin, and the answer is a `303` to the tool launch URL on another origin; Chromium blocks that redirect, because CSP3 `form-action` also covers the redirect chain. So the cookieless Platform Storage launch never reaches the tool. | **`form-action 'self' <T>`**, with `<T>` = the origin of the account's tool URL that this check redirects to (`launchUrl` for a resource link, `deepLinkingUrl` for Deep Linking), computed per request from the stored prepared launch; one origin, never a wildcard. The rest stays: the other directives, `frame-ancestors https:`, `Referrer-Policy: same-origin`. No other LTI service page changes (the login page uses `form-action 'none'` and navigates by script; error pages have no form). | LA-ADR-05 D1 rule 7; security-delta §5 (storage-check row); LA-E3-02 notes | The security intent stays: the form posts only to our origin, and the only added origin is the account's own operator-set https tool URL (never our LTI or content host, LA-ADR-06 D2), where the launch goes anyway. A trampoline page would add a script and a step for no extra safety. No LD-9 change: the page is new in LA. |

Changes for the Lead to route: **L (LA-E3-02):** the per-request `<T>` in the storage-check CSP, and a unit test in three cases (resource link, Deep Linking, an account whose `launchUrl` is on another origin). **QA-E2E:** rerun `U4.platform-storage.positive` live (AC-LA-E7-07-05, AC-LA-E3-02-08).

## 56. Round 55: the storage-check origin guard (LA-E3-02, lane L), 2026-10-23

Lane L's local choice in the BD-A2-103 fix (merged `02f5d420`), routed in dispatch `ctx_aab657f2de56`. No code change, so no status message first.

| Id | Item | Decision | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-104 | L: "`URL.origin` keeps characters such as `;`, `,` and `"`", so `formActionSources` adds `<T>` only for a plain https origin (letters, digits, dots, hyphens, an optional port); else `'self'` only (fail closed). Must a refused origin also be refused at account write time, or logged? | **Ratified as built.** The guard is the CSP3 host-source form (`host-char` = letter, digit, `-`; dot-separated; optional port), with the scheme fixed to `https` like the write rule. `URL` lower-cases the host and gives punycode for an IDN, and drops port 443, so normal tool URLs pass. Other origins (an IPv6 literal, which CSP cannot name; `_`; `;`, `,`, `"`, `'`, `*` and similar) give `form-action 'self'` only. **No write-time refusal and no log line in LA.** An operability §9 row gives the diagnosis. | LA-ADR-05 D1 rule 7; security-delta §5 (row and the guard note); operability §9 (new row); LA-E3-02 notes | Checked in Node: `https://a;b,c"d.example` keeps its host in `origin`; `https://a_b.example` and `https://[2001:db8::1]:8443` fail the guard; `https://Tool.Example:443` gives `https://tool.example`. Why not refuse at write time: the only write path is the loopback operator API (`toolUrlSchema`); every LA value passes (`app.cogniate.test`, the QA accounts); a write rule would also stop cookie launches, which work for such hosts today; and the runtime guard must stay in any case, because it is the control on the header and stored rows are not re-checked. Why no log line: no LA value can reach the case, and the server sees a normal `303`. LG option: add the same host rule to `toolUrlSchema` for `launchUrl` and `deepLinkingUrl`, with the `URL_RULE` text and the contract §3 rule. Lane L's guard table test (`;`, `,`, `"`, `http:`, IPv6 literal, not a URL) is enough. |

Changes for the Lead to route: none. No code, contract or test change; QA-E2E's live rerun of `U4.platform-storage.positive` (BD-A2-103) does not change.

## 57. Round 56: operability §6.2 key path and the compose settings (Docs lane LA-E8-04), 2026-10-23

Two points from the Docs lane's operator runbook (merged `b207706d`), routed in dispatch `ctx_d0f85f82a296`. Docs only, so no status message first.

| Id | Item | Decision | Where recorded | Note |
| --- | --- | --- | --- | --- |
| BD-A2-105 | (1) Operability §6.2 step 2 said that the app reads `infra/.secrets/lti-api-key.cogniate`. On the stack the app reads `infra/.secrets/app/lti-api-key`, a copy that `lti-bootstrap.sh` keeps. (2) FYI: `infra/compose.yaml` passes a fixed list of settings, `production` cannot run on the LA stack, and the app worker has no compose service. Does operability need a sentence? | **(1) The stack is the rule.** The host keeps `lti-api-key.<account>` (seed, `lti:bootstrap`, the `compat` runner and the demo scripts read it). The app reads only its copy, `LTI_API_KEY_FILE=/run/secrets/app/lti-api-key` (default in `services/cogniate-app/src/config.ts`), at each use. `lti:bootstrap` keeps the copy equal at each run. §6.2 step 2 is now: write the key file, then run `lti:bootstrap` (an active key exists, so it issues no key), which refreshes the copy. The §2 secret-file table had the same error: it now has a row for each file. **(2) Yes, one note.** §2 now says which table settings do not reach the services on the LA stack, what to use instead (operator API for rate limits; `docker compose exec -e` for app CLI operator settings), that `stack:restart --env` takes test knobs only, that `production` does not run on the stack (a host setup in LG; deferred row "LA-E5-22 note (K)"), and that the worker has no compose service. §3 refers to it. | operability §2 (stack note; secret-file rows), §3 (worker bullet), §6.2 (step 2; emergency line) | Checked: `compose.yaml` has no `env_file`; the LTI service list has `AUDIT_RETENTION_DAYS`, `JOB_INSTANCE_ID`, `TRUSTED_PROXY_CIDRS: proxy`; the app list has none of the job, retention or operator settings; `saved_profile` in `lib.sh` returns only `acceptance` or `default`. I also fixed the npm form in §6.2: the root `package.json` has no `lti:bootstrap`, so the command is `npm run lti:bootstrap -w services/lti-service -- …` (as in the runbook). The short form in LA-ADR-06 AP-06-12 and AC-LA-E5-05-01 means the command run in `services/lti-service`; no change there. No code, compose or test change: the settings gap is the LG host setup, and AC-LA-E4-05-05 stays with its owner. |

Changes for the Lead to route: none. The runbook (LA-E8-04) already gives the stack form in its API key rotation steps and its secret-file table, so the Docs lane has nothing to change.
