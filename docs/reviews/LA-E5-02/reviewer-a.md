Verdict: APPROVE
Round: 2

# LA-E5-02 review: Reviewer-A (lens "Is it right and is it safe?")

- Diff: `git diff 29cd178 fbec03d` (lane `la-s1`; merged as `0d320c4`). The reviewed files are the same at the integration `HEAD` (`07e1d93`).
- References: `docs/architecture/ltiaas/tasks/LA-E5-02.md`; LA-ADR-06 D4 (rules 1–3) and D1 (client address); contract delta §3 (`GET /operator/v1/audit`, `AuditEvent`) and §5 (actions); LA-ADR-07 D6 T14, T15; security delta §14. Lead-approved RQ-2 edits: `transaction()` with a SAVEPOINT in `packages/shared/src/migrations.ts`, and the F5 rule `infra/scripts/fitness/rules/audit-event-delete.mjs`. Follow-ups in the same diff: the e2e tmpfs (A-LA-E5-08-03), the operator key file in `stack:reset` (A-LA-E5-01-02), and the operator-name hint in `lti-bootstrap.sh`.
- During my review, A2 wrote build ratifications that are not committed yet: `docs/architecture/ltiaas/build-decisions-A2.md` BD-A2-01..03 and the LA-ADR-06 D4 "Transaction rule" T0–T5. I read them after my findings, and I mark the overlaps in each finding.
- I ran the task tests on the host (no Docker): 5 vitest files, 38 tests pass; `compose-e2e-secrets` and `fitness-audit-event-delete`, 5 tests pass. The tree stayed clean.
- Blind review: I did not open the other reviewer's file.
- **Counts: 0 BLOCKER, 0 MAJOR, 2 MINOR, 2 NIT.**

## Checks

| Check | Result |
| --- | --- |
| Change and event in one transaction (rule 1) | Correct. `audit.change` runs the change, then inserts the `ok` event, inside one `transaction()` (`services/lti-service/src/store/audit.ts:128-137`). The store functions open their own `transaction()`, which now becomes a SAVEPOINT inside the outer one. Both rollback directions have a test: a failure after the insert stores neither row (`store/audit.test.ts`, first AC-08 case). A failed insert rolls the change back (second AC-08 case, with a trigger that refuses the insert). A 4xx inside `change` rolls the change back and writes only the `refused` event. Both AC-08 tests fail on the old code: there is no table, and the old nested `transaction()` threw "cannot start a transaction within a transaction". |
| SAVEPOINT semantics | Correct. Success runs `RELEASE`. An error runs `ROLLBACK TO` and `RELEASE`, then rethrows, so the outer transaction decides (`packages/shared/src/migrations.ts:28-39`). The top-level path is unchanged (`BEGIN IMMEDIATE`, test with a second connection). Each name is unique per process (`nested_<n>`). Node 24.22 (compose image) has `DatabaseSync.isTransaction`. |
| Async risk of the SAVEPOINT change | None today. I read all 35 product callers of `transaction()` in both services. Every callback is synchronous, and each `await` near them (for example `cogniate-app/src/app/connections.ts:329`, `operator.ts:164`) comes after the transaction returns. `DatabaseSync` is synchronous, so no other request can run while a transaction is open. So `isTransaction` is true only for a real nested call in the same call stack. No old path relied on the nested-call error, because such a path would have failed. A latent gap remains: A-LA-E5-02-02. |
| Refused events | Correct. Only an `ApiErrorBase` with a 4xx status writes `refused` with its code. A 5xx error or a bug writes nothing (`store/audit.ts:104-107`). The flag `written` stops a second event when a 4xx comes after a committed change. Every route translates the store errors (`PlatformExistsError` and others) inside the frame, so the stored code is the wire code (for example `PLATFORM_ALREADY_EXISTS`, `UNREGISTERED_PLATFORM`, `UNKNOWN_DEPLOYMENT`, `OPERATOR_KEY_IN_USE`). |
| Authentication before the frame | Yes. `ctx.auth(req, ['bearer'])` runs before `audited(...)` in all five platform routes (`http/routes/platforms.ts:174, 211, 233, 261, 300`). The operator key check runs at `onRequest`. So a `401` writes no event (tests: a tenant Bearer header with an unknown key, and an empty header; operator unknown key). |
| Action names and targets (contract delta §5) | All match: `platform.create`, `platform.update`, `platform.delete`, `deployment.create`, `deployment.update`, `operator_key.issue`, `operator_key.revoke`, `audit.read`, and `init` → `operator_key.issue` with actor `system:bootstrap`. The target types are `platform`, `deployment`, `operator_key` and `audit`. The actor is `api_key:bootstrap-<account>` (B1, A-LAB-07) or `operator:<name>` from the key row. |
| `init` | Correct. The event is inserted inside the `initOperatorKey` transaction (`store/operator-keys.ts:112`). So a failed insert leaves no key, and a key always has its event. `refuse` and `--if-none` write no event. `--replace` writes one event with `revoked: <n>` (test `cli/operator.test.ts`). |
| Append only (rule 2, AC-07) | The trigger refuses `UPDATE` and an `UPSERT … DO UPDATE` (I checked both with `node:sqlite`). The test on a v6 database with rows fails on the old code. A `REPLACE` gap and an F5 spelling gap: A-LA-E5-02-01. |
| No secret in events or logs (AP-06-16) | Yes. Each route chooses its `details`: field names, `profile`, `active`, `platformId`, the operator name, `expiresAt`, and for `audit.read` the filters without the cursor value. No route copies a body value or a header. `redact()` runs on top (`auditDetailsText`), and none of the chosen key names ends in a secret suffix, so nothing useful is lost. `details` is at most 4 KB. The trace id is stored only after the `TRACE_ID` pattern check (`http/app.ts:71-72`). The tests show that the issued operator key and the caller's key are never in a stored event or in a `GET /operator/v1/audit` answer. The new shell hint in `lti-bootstrap.sh` prints the operator name, never the key. |
| `GET /operator/v1/audit` (rule 3, contract §3) | Correct. The filters are `toolAccountId`, `action`, `actorId`, `since` and `until` (ISO with an offset), with `limit` from 1 to 500 (default 100), newest first by `(ts, id)`. The cursor is `ts:id` as base64url and is checked by a strict pattern. A repeated query parameter becomes an array, which fails the schema with `400`, so it cannot widen the filter. AC-06 uses the index `(tool_account_id, ts, id)`. A refused read writes `audit.read` `refused`. |
| Client address (D1) | The socket address. No listener sets `trustProxy`, so a client cannot forge `client_ip` with `X-Forwarded-For`. Behind the proxy, tenant events show the Caddy address until LA-E5-03, as the spec says. |
| e2e secret mount (A-LA-E5-08-03) | **Closed in the configuration.** `infra/compose.yaml:473-476` puts an empty tmpfs on `/repo/infra/.secrets/lti`. That path is deeper than the `..:/repo:ro` and `./.secrets:/repo/infra/.secrets:ro` binds, so Docker mounts it last and it hides the ring. Every e2e start (`e2e-run.sh`, `qa-suite.sh`; `demo-prepare.sh` uses `e2e-run.sh`) calls `prepare_e2e`, which makes the host mount point (`infra/scripts/lib.sh:229`). A read-only parent bind cannot make that folder. Other mounts: no other service mounts the repo root or the whole `.secrets` folder. `lti-service` mounts only `.secrets/lti`, `cogniate-app` only `.secrets/app` (its API-key copy), and `compat` one API-key file. The static test fails on the old compose. The runtime proof (inside `e2e`, `ls -A /repo/infra/.secrets/lti` prints nothing while the host folder holds `keyring.json`) needs Docker, so QA does it when Docker is back. |
| `stack:reset` (A-LA-E5-01-02) | Closed. `infra/scripts/stack-reset.sh` removes `infra/.secrets/lti-operator-key`, and the test checks it. The ring folder `infra/.secrets/lti` stays, as `.env` stays: it holds keys, not stack data. |
| UNIT ACs fail on the old behaviour | Yes: AC-07 and AC-08 (see above). AC-10 (K0) waits for the F5 runner (LA-E1-04). The rule module and its Author test exist, and the AC probe text gives one hit. |
| "Must not edit" and ownership | Respected. `routes/registration.ts`, `lti/**` and the app files are unchanged. The `packages/shared` and F5 files are the Lead-approved RQ-2 edits. The infra files are the follow-ups named in the dispatch. |
| No behaviour change outside the spec | Yes. The route bodies are the same, only wrapped: the same checks, the same order, the same answers and log lines. A `null` from `updatePlatform` or `addDeployment` now throws inside `change`, which gives the same `UNREGISTERED_PLATFORM` answer. |
| No LMS name in core paths | Yes. |

## Findings

- **A-LA-E5-02-01 (MINOR): two append-only gaps. `REPLACE` edits a row without firing the trigger, and F5 misses a single-quoted table name.**
  - Where: `services/lti-service/src/db/migrations/007_audit_event.sql:21-24` (an `UPDATE` trigger only); `infra/scripts/fitness/rules/audit-event-delete.mjs:12` (`["`[]?` before `audit_event`).
  - Problem:
    - `REPLACE INTO audit_event …` or `INSERT OR REPLACE INTO audit_event …` with an existing `id` deletes the old row and inserts a new one. SQLite fires delete triggers for a `REPLACE` only when `recursive_triggers` is on. So the `UPDATE` trigger does not stop this edit (threat T14 "rows are edited").
    - SQLite accepts `'audit_event'` (single quotes) as a table name. So `DELETE FROM 'audit_event'` deletes rows and the F5 pattern does not see it. The Author test claims "spellings with … quotes", but it covers `"`, `` ` `` and `[` only.
  - Evidence (`node:sqlite`, Node 24): with the trigger of `007`, `UPDATE` and `UPSERT … DO UPDATE` fail with `audit_event is append-only`. `REPLACE INTO audit_event VALUES ('aud_1','replaced')` succeeds and changes the row. `DELETE FROM 'audit_event' WHERE …` runs.
  - Why not higher: no AC fails (AC-07 is about `UPDATE`, and the AC-10 probe text gives a hit). The only writer uses plain `INSERT` with random ids. Rule 2 is literally met: the trigger refuses every `UPDATE` statement. A static rule can never be complete (a table name built at run time passes any pattern).
  - Suggested fix:
    - In the next LTI migration (`007` may already be applied in a QA clone; never edit an applied file), add `CREATE TRIGGER audit_event_no_replace BEFORE INSERT ON audit_event WHEN EXISTS (SELECT 1 FROM audit_event WHERE id = NEW.id) BEGIN SELECT RAISE(ABORT, 'audit_event is append-only'); END;`. I checked it: both `REPLACE` forms then fail, and a new `INSERT` passes. Add one assertion next to AC-07.
    - In the F5 pattern, allow `'` as a quote. Also refuse `REPLACE INTO audit_event` and `INSERT OR REPLACE INTO audit_event` (and, if A2 agrees, `DROP TABLE audit_event`). Add one probe for each.
- **A-LA-E5-02-02 (MINOR): `withAudit` does not enforce "exactly one event". A success with no `change` writes none, a second `change` writes two, and `transaction()` accepts an async callback.**
  - Where: `services/lti-service/src/store/audit.ts:126-145`; `packages/shared/src/migrations.ts:27-49`.
  - Problem:
    - Rule 1 says "exactly one event". The frame makes it right only when each success path calls `change` exactly once. All current routes do. But the frame is the shared path for later lanes (LA-E3-06, LA-E5-03, -04, -07, -09, -10).
    - A known next case: `POST …/shared-platforms` answers `200` with no change for the same client id (contract delta §3). An early `return` before `change` then writes no event, and no test or type error shows it.
    - `change(async () => …)` type-checks (`T` = a Promise). `transaction()` then commits at once, and `describe` gets a Promise. The change then runs outside the transaction of its event. The SAVEPOINT nesting makes this case quieter: before, a nested call failed loudly, and now it joins the outer transaction.
    - The async LTI storage port (LA-E5-23; LA-H5) must not keep the `isTransaction` test on a shared connection. With an async callback, a concurrent request would join another request's transaction as a SAVEPOINT.
  - Suggested fix:
    - In `withAudit`: when the body succeeds and `written` is still false, insert the `ok` event (a call with no change). Let `change` throw on a second call.
    - In `transaction()` (both paths): if the result is a thenable, roll back and throw `transaction callback must be synchronous`. Add one unit test for each rule.
    - Note the shared-connection rule in the LA-E5-23 spec.
  - Overlap with A2's ratification: the thenable guard is now D4 rule T2 and follow-up C1 (lane S1, not a merge gate), so that part is covered. D4 rule T3 says the body calls `audit.change` "at most once". That still allows a success with **no** event, which conflicts with rule 1 ("exactly one"). The open part of this finding: A2 states T3 as "exactly once on every success (a call with no change too)", and `withAudit` enforces it as above.
- **A-LA-E5-02-03 (NIT): the SAVEPOINT error path can hide the real error.**
  - Where: `packages/shared/src/migrations.ts:35-38` (the top-level path at `:46-48` has the same pattern; it is older).
  - Problem: after some errors, SQLite rolls back the whole transaction by itself (for example `SQLITE_FULL`, `SQLITE_IOERR`, `SQLITE_NOMEM`). Then `ROLLBACK TO nested_<n>` throws "no such savepoint" and replaces the real error. The outer `ROLLBACK` then throws "cannot rollback - no transaction is active". The operator sees the wrong cause in `internal_error`.
  - Suggested fix: in each `catch`, run the rollback only when `db.isTransaction` is true, inside its own `try`, and always rethrow the first error.
  - Overlap: this is A2's D4 rule T5 (recorded there as deferred). The data stays consistent; only the error text is wrong. One entry in `deferred.md` covers both.
- **A-LA-E5-02-04 (NIT): an authenticated operator call that Fastify refuses before the handler writes no event.**
  - Where: `services/lti-service/src/http/operator/index.ts` (auth at `onRequest`; `audited` runs only inside a route handler).
  - Problem: rule 1 says that every operator call writes one event, `refused` after a `4xx`. An authenticated call with a JSON body that does not parse (`400`), a body above the limit (`413`), another content type (`415`) or an unknown path (`404`) writes nothing. No change happens, so this causes no repudiation risk.
  - Suggested fix: A2 adds one line to D4, for example "a request that no route handler accepts writes no event". Or the listener writes a `refused` event with action `request.refused` from `onError` after a successful auth. The first is enough.

## Notes (no finding)

- BD-A2-02 aligns D3 with the code ("`npm run seed` makes the operator key"), so my design-text NIT A-LA-E5-01-01 is closed when A2's edits are committed. BD-A2-03 ratifies the e2e tmpfs that I checked above.
- The scope is correct: `cli/shared-platform.ts` and `cli/bootstrap.ts` still write without an event. Those writes move to the operator API with their own events in later tasks (`platform.create_shared`, AP-06-12).
- My LA-E5-01 note ("an operator can issue a key under another operator's name") is now covered. `operator_key.issue` records the issuing actor (`operator:alice`) and the new key's name (`details.operator: "bob"`).
- Until LA-E5-03 adds the `admin` and `operator` limits, a caller with a valid key can write any number of `refused` rows (for example `400` answers). The retention job (LA-E5-19) and the limits bound this later.
- The F5 `ALLOWED` list names only the LTI retention job. The app audit table (LA-E5-11) and its retention job will need their own entry.
- The K1-SIM ACs (AC-01 to AC-06, AC-09) wait for QA-2's Docker window. The unit tests above cover their logic.

## Round 2

- Diff: the five fix commits `git diff 6d201e2 48d1499` (`066083e`, `fd523ce`, `ac0a702`, `fd5ada9`, `48d1499`; merged as `8371c07`). The dispatch range `fbec03d..48d1499` also holds the LA-E7-03 and B-LA-E5-08-03 commits, which I reviewed under LA-E7-03. These files at `HEAD` are the same as at `48d1499`.
- References: my round-1 findings above; LA-ADR-06 D4 "Transaction rule" T0–T5 and A2's follow-ups C1 and C5 (`build-decisions-A2.md`).
- I ran the tests on the host (no Docker): 6 vitest files, 57 tests pass (`migrations`, `store/audit`, `http/auth`, `platforms-audit`, `services`, `operator/audit`); the F5 rule test passes 4 of 4.
- Blind review as before.
- **Verdict (round 2): APPROVE.** The two round-1 MINORs and NIT 03 are closed. NIT 04 stays open (design text). New: **0 BLOCKER, 0 MAJOR, 0 MINOR, 1 NIT.**

### Round-1 findings

| Id | Status | Evidence |
| --- | --- | --- |
| A-LA-E5-02-01 (MINOR) | closed | The new migration `008_audit_event_replace_guard.sql` adds a `BEFORE INSERT` trigger that refuses an insert whose `id` exists. `007` is not edited. The test upgrades a v7 database with a row, sets `recursive_triggers = OFF`, and shows that `REPLACE INTO` and `INSERT OR REPLACE INTO` both fail with `audit_event is append-only`. The old row is unchanged, and a new insert still works. The F5 pattern (`infra/scripts/fitness/rules/audit-event-delete.mjs:12`) now also matches single quotes, brackets, quoted `main`, `REPLACE INTO` and `INSERT OR REPLACE INTO`. A replacement is refused even in the retention job, where only `DELETE` is allowed. `audit_event_archive` in each quote form still passes. The tree has no hit. |
| A-LA-E5-02-02 (MINOR) | closed in code | (1) `transaction()` throws `TypeError` when the callback returns a thenable (a Promise, or an object or function with `then`), on both paths, after the rollback (`packages/shared/src/migrations.ts:22-27`, A2 C1). Tests show that the outer data is gone, the nested part alone is rolled back, and `then` is never called. (2) `withAudit` refuses a second `audit.change()` before its callback runs, also a reentrant call from inside the first change, which then rolls back with no event (`store/audit.ts:130-131`). (3) A body that ends without a successful `change` now fails (`:144`): a sync or async body like that gives an error and writes no row. So a missed event is a loud `500` that a unit test catches, not a silent gap. Every current route calls `change` on each success path, so no answer changes. The design text still says "at most once": A-LA-E5-02-05. |
| A-LA-E5-02-03 (NIT) | closed | Both rollback paths run only while `db.isTransaction` is true, inside their own `try`, and always rethrow the first error (`migrations.ts:45-51`, `:61-64`; A2 C5). Tests: an `INSERT OR ROLLBACK` conflict (SQLite ends the transaction itself) keeps `UNIQUE constraint failed`, nested and not nested. A failing `ROLLBACK`, `ROLLBACK TO` or `RELEASE` keeps the exact first error object. |
| A-LA-E5-02-04 (NIT) | open | No change (design text). A request that Fastify refuses before the handler (bad JSON, `413`, `415`, unknown path) still writes no event. Safe to defer. |

### New change: the actor comes from authentication (B-LA-E5-02-02)

- `authenticate()` now returns `actor` (`services/lti-service/src/http/auth.ts:73`), and the platform frame uses `caller.actor` and `caller.account.id`. LA-E5-07 then changes the actor in one place.
- Same wire behaviour. I compared the old and new branches. For each scheme (`bearer`, `service`, `ltik`), an unknown API key gives the same code and the same description as before (`:68-72`: Bearer keeps "Invalid API key."). A valid key goes on to the same service-key or ltik lookup. No lookup is added for an unknown key.
- Tests: `auth.test.ts` checks the actor for two accounts. `platforms-audit.test.ts` replaces the actor through `authenticate`, and shows that both the `ok` and the `refused` event use it.

### New finding

- **A-LA-E5-02-05 (NIT): LA-ADR-06 D4 rules T3 and T5 lag the code.**
  - Where: `docs/architecture/ltiaas/adr/LA-ADR-06-service-operability.md:219` (T3: "calls `audit.change` at most once") and `:221` (T5: "MINOR, deferred"). Also `build-decisions-A2.md` C5 and the Lead's `deferred.md` entry.
  - Problem: the code now requires exactly one successful `change` on every success, and T5 is built. A developer who reads T3 can write a success path with no `change`, which now fails with a `500` at run time.
  - Suggested fix (A2): T3 says "exactly once on every successful request; a request with no change still calls `audit.change`". T5 says "built in LA-E5-02 round 2". The Lead removes the C5 item from `deferred.md`.

### Note (no finding)

- The thenable guard throws without waiting for the Promise. If an async callback later rejects, nobody handles that rejection, and Node's default would end the process. This is a programming error that the `TypeError` already shows in a unit test, so it is acceptable.
- Editorial change to round 1 (no change of meaning): the "Authentication before the frame" row quoted a test's fake key text. The new secret scan of `npm run ci:local` (LA-E7-10, rule `api_key`) flags such text in `docs/**`, so I now describe it in words ("a tenant Bearer header with an unknown key").
