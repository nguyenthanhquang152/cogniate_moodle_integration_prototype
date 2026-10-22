Verdict: APPROVE
Round: 2

# LA-E5-10 review: Reviewer-A (lens "Is it right and is it safe?")

- Diff: `git diff f1f9de8^1 f1f9de8` (what the merge added; lane `la-s2` head `984b74a`). These files at `HEAD` are the same as at `f1f9de8`.
- References: `docs/architecture/ltiaas/tasks/LA-E5-10.md`; LA-ADR-06 D7, D4 (T0–T5), D13; contract delta §2.3 and §3; A2 BD-A2-04 to BD-A2-08. RQ-2 lines: `keys` in `http/operator/index.ts` and the handle in `main.ts`.
- A2's two context points (the `X''` literal and `generateKeyPairSync`): I checked both myself; see A-LA-E5-10-01 and -02.
- I ran the tests on the host (no Docker): 5 vitest files, 23 tests pass (`signing-keys`, `signing-key-cleanup`, `tool-keys-lifecycle`, `key-config`, `tool-keys`).
- Blind review: I did not open the other reviewer's file.
- **Counts: 0 BLOCKER, 0 MAJOR, 1 MINOR, 2 NIT.**

## Checks

| Check | Result |
| --- | --- |
| Audit atomicity (D4 T2, T3) | Correct. Each route has one `withAudit` frame and one synchronous `audit.change` (`http/operator/signing-keys.ts:39`, `:54`, `:67`). The key pair and the async `seal` run before it (`prepareToolKey`, D4 T2). Each refusal is checked before the change, so the refusal writes its `refused` event with nothing to roll back (`:35`, `:53`, `:66`). The store repeats the check inside its transaction, so a second request in the `await` window, or a second activation at the same time, fails there and rolls back. The test "an audit failure rolls back create, activation and removal" shows that a failed `ok` insert leaves no key change. AC-13: each refusal writes one `refused` event (test). |
| State rules | Correct. Two partial unique indexes enforce one `active` and at most one `next` per account (migration `009`). `activate` needs `next` and an active key: it retires the old key with `retired_at = now` before it activates the new one, in one transaction (`store/tool-keys.ts:114-122`). `retire {immediate: true}` works only on `retired` or `next` (`SIGNING_KEY_ACTIVE` for the active key, `SIGNING_KEY_WRONG_STATE` for `removed`), and it empties the private blob at once. Any `kid` lookup is scoped by account, so a kid of another account is `404 NOT_FOUND` and changes nothing (tests). |
| Publish lead time | Cannot be bypassed except by `force`. The route reads `SIGNING_KEY_PUBLISH_LEAD_S` once at registration (`keys/key-config.ts`). The value must be a safe integer ≥ 600, and the unit option gets the same check. A bad value (also an empty string, which becomes 0) throws in `buildOperatorApp`, so the start fails. The check is `now − published_at < lead` → `409`, so 599 s refuses and 600 s passes (AC-05). Only a boolean `force` skips it, and the event then has `details.forced: true` and the retired kid. |
| JWKS (AC-07, AC-08, AC-13) | Correct. The order is `active`, then `next`, then `retired` while `retired_at > now − 30 days` (`store/tool-keys.ts:174-180`). A `removed` row, and a `retired` row with no `retired_at`, are never selected. The active key stays first, so the Canvas inline export and `activePublicKeyPem` still read the active key. Retention now counts from `retired_at` (the J-2 defect is gone; the 40-day test). |
| Signing after activation | Correct. `activePrivateJwk` reads the `active` row at each call, and the cache is keyed by kid, so the first signature after the commit uses the new key. A `next` key never signs, because only `status = 'active'` is read. |
| Migration `009` (AC-10) | Correct. Every row gets `published_at = activated_at = created_at`. A `retired` row younger than 30 days gets `retired_at` = migration time. An older one (the 30-day boundary included, as today's `< 30 days`) becomes `removed`. All SET expressions read the old row, and `'now'` is one value per statement. The test runs the real migration file with a stubbed SQL clock and shows the same public set before and after. Portability: A-LA-E5-10-01. |
| Cleanup job (AC-11, AC-12) | Correct. In one transaction it moves `retired` rows with `retired_at <= now − 30 days` to `removed`, and empties the private blob of every `removed` row that still has one (also the rows that `009` marked). Repeat runs change nothing. Until LA-E5-19 registers it, an expired `retired` key leaves the JWKS by time, but keeps its sealed private part. |
| No key material in logs, errors or answers | Yes. `signing_key_changed` logs only `tool_account_id`, `kid` and `status`. Error texts are fixed (`http/key-errors.ts`, `validatePublishLeadSeconds`). The list answer has metadata only (no JWK). The audit details hold `forced` and the retired kid. `toolKeyVersions` counts only non-empty blobs, so an emptied blob does not keep a ring version in use. |
| Wiring (BD-A2-04) | `OperatorDeps.keys` and `OperatorContext.keys` are required. `main.ts` passes `config.masterKey`, the same bound handle as the public app (one provider, one cache). |
| UNIT ACs fail on the old behaviour | Yes. AC-05, -07, -10, -11, -12 and -13 need the new columns, routes or job. AC-07 fails on the old `created_at` retention. |
| "Must not edit" and ownership | Respected. `routes/protocol.ts`, `lti/**`, `platform/token-client.ts` and `canvas-configuration.ts` are unchanged. The `index.ts` and `main.ts` lines are RQ-2. The one-line comment in `packages/shared/src/key-provider.ts` is in S2's module. |

## Findings

- **A-LA-E5-10-01 (MINOR): new SQL breaks the D13 rule-2 portability lint in three places.**
  - Where:
    - `services/lti-service/src/store/tool-keys.ts:148` (`private_jwk_encrypted = X''`)
    - `services/lti-service/src/jobs/signing-key-cleanup.ts:17` (the same literal)
    - `services/lti-service/src/db/migrations/009_signing_key_lifecycle.sql:10-17` (four uses of the SQLite date function `unixepoch('subsec')`)
  - Problem:
    - LA-ADR-06 D13 rule 2 says new LA SQL has "no `X''` literals, no SQLite date functions". Its only exceptions are the audit trigger and the `api_key` backfill, which it lists as part of the SQLite adapter.
    - The LTI service store is the planned async port (D13 rule 3; LA-E5-23), so these statements would have to be found again in LG.
    - F5 `sql-portability` (LA-E1-04) does not list either form, so `009` passes `npm run check`.
  - Suggested fix:
    - In both blob writes, bind an empty byte array (`private_jwk_encrypted = ?` with `new Uint8Array(0)`).
    - A migration has no other clock than the database. So A2 adds the `009` time expression to the D13 rule-2 list of SQLite adapter items, like the audit trigger (no file change).
    - Optional for lane P: add `X'` and the SQLite date functions to the F5 portability list for new migrations.
- **A-LA-E5-10-02 (NIT): `prepareToolKey` makes the RSA key pair synchronously.**
  - Where: `services/lti-service/src/store/tool-keys.ts:83` (`generateKeyPairSync`).
  - Problem: the call blocks the event loop of both listeners (public LTI and operator) for each new key: `POST …/signing-keys`, account create (BD-A2-07) and `lti:bootstrap --rotate-signing-key`. On a slow host, an RSA-2048 prime search can take hundreds of milliseconds. Launches wait during that time. This is not new (the old `ensureToolKey` did the same), and the calls are rare operator actions.
  - Suggested fix: the function is already async, so use `await promisify(generateKeyPair)('rsa', …)` (same options).
- **A-LA-E5-10-03 (NIT): `lti:bootstrap --rotate-signing-key` fails when a `next` key exists.**
  - Where: `services/lti-service/src/store/tool-keys.ts:155-170` (`ensureToolKey` with `rotate` calls `createNextToolKey`, which refuses `SIGNING_KEY_NEXT_EXISTS`).
  - Problem: D7 calls the CLI rotation the emergency path ("create + activate with `force`"). It worked before this task, but fails while a key made through the API waits in `next`. The failure is loud, not silent, and the API path (`activate {force: true}` on the `next` key, or retire it first) still works.
  - Suggested fix: in the rotate path, activate an existing `next` key with `force`, or print the API command. Or record it for LA-E5-05, which moves the CLI to the operator API.

## Notes (no finding)

- The cleanup job writes no audit event (only `job_run` counts and `signing_key_changed` lines). D4 rule 1 covers requests, and D11 jobs log `job_run`, so this follows the design.
- AC-01 to AC-04, AC-06, AC-08 and AC-09 are K1-SIM and wait for QA-2's Docker window. The unit tests above cover their logic.

## Round 2

- Diff: `git diff 36032f3^1 36032f3` (lane `la-s2`: `c0a1f64`, `c60cda4`, `6ef9075`, `3b13658`, `56bad6b`). These files at `HEAD` are the same as at `36032f3`.
- References: my round-1 findings above; A2 BD-A2-13, BD-A2-14, BD-A2-23 and BD-A2-24; LA-ADR-06 D7 (row "Error details and no active key") and D13 rule 2.
- I ran 5 vitest files on the host: 31 tests pass (`signing-keys`, `tool-keys-lifecycle`, `signing-key-cleanup`, `tool-keys`, `cli/bootstrap`).
- Blind review as before.
- **Verdict (round 2): APPROVE.** All three round-1 findings are closed, and the two new A2 rules are right. New: **0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**

### Round-1 findings

| Id | Status | Evidence |
| --- | --- | --- |
| A-LA-E5-10-01 (MINOR) | closed | Both runtime blob writes now bind an empty byte array (`store/tool-keys.ts:168`; `jobs/signing-key-cleanup.ts`, `.run(new Uint8Array(0))`). `length(…) = 0` still marks a cleared blob, so `toolKeyVersions` keeps ignoring it. `git grep "X''"` over non-test `services/*/src` code finds only the two pre-LA app lines (`domain/pickers.ts:55`, `domain/retention.ts:17`), which BD-A2-13 freezes as the baseline of the planned F5 TypeScript scan. BD-A2-13 lists the `009` date expression as a SQLite-adapter item, so the applied migration stays unedited (its checksum is unchanged). The F5 rule widening (`X'…'`, date functions, `randomblob`, `rowid` for new migrations) is lane P's follow-up. |
| A-LA-E5-10-02 (NIT) | closed | `prepareToolKey` now awaits `promisify(generateKeyPair)` (`:86`), so RSA generation no longer blocks either listener. It still runs before `audit.change` (D4 T2). A second create that runs during the `await` fails in the transaction's slot check (test "rechecks the active key after async preparation"). |
| A-LA-E5-10-03 (NIT) | closed by BD-A2-14 | With `rotate`, `ensureToolKey` first removes a waiting `next` key with `removeToolKey`, which also empties its private blob. In the same transaction it then creates and force-activates the new key (`:183-192`). An activation failure rolls back the removal too (test). The stdout line does not change. |

### New behaviour (A2 rulings), checked

- BD-A2-23, `409` details:
  - `SIGNING_KEY_NEXT_EXISTS` gives `{kid, publishedAt}` of the waiting key.
  - `SIGNING_KEY_NOT_PUBLISHED_LONG_ENOUGH` gives `{kid, activatableAt}`.
  - `SIGNING_KEY_WRONG_STATE` gives `{kid, keyStatus}`.
  - `SIGNING_KEY_ACTIVE` gives `{kid}`.

  All of it is public data on the authenticated operator listener, and every `kid` lookup is still scoped by account, so another tenant's kid stays `404`. There is no `retryAfter`, so no `Retry-After` header (the AC-14 test checks both). The audit row still stores only the code.
- BD-A2-24, "no active key" is not an error. `createNextToolKey` inserts `active` when the account has no active key (`:117`), and the check runs inside the write transaction. The publish lead time then protects nothing, because nothing signs. The normal API cannot reach this state: retire immediate refuses the active key, and activate always leaves one active key. So this is a repair path, not a way around the lead time. Activate of a `next` key with no active key returns `retired: null` and writes no `retired` log line. The `signing_key.create` event now has `details.status`, so the log shows whether a create skipped the wait.
- `retire` without `{immediate: true}` gives `400 INVALID_REQUEST` with `details.field: "immediate"` and a text that names the right path.
