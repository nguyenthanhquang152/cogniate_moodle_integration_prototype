Verdict: APPROVE
Round: 1

# LA-E5-02 review, Reviewer-B (lens: "Can a human team own it?")

Diff: `git diff 29cd178 fbec03d` (merged as `0d320c4`). The task commits are `cb23769` (nested `transaction()`), `07b5f7f` (audit log) and `fbec03d` (F5 rule). Spec: `docs/architecture/ltiaas/tasks/LA-E5-02.md`. Design: LA-ADR-06 D4 with the Transaction rule T0–T5 (BD-A2-01), contract delta §3 and §5, README §4 "F5 rule modules" (BD-A1-02). I did not open the other reviewer's file. I did not run Docker.

Counts: **0 BLOCKER, 0 MAJOR, 2 MINOR, 4 NIT.**

The design is easy to follow. One writer module (`store/audit.ts`) is the only path to the table. One wrapper (`withAudit`) gives every route the same "ok in the change transaction, refused after a 4xx" rule. The shared `transaction()` change is 13 lines with three clear tests. The F5 rule is a small pure module with probe tests. My two MINOR findings are about rules that the code enforces by convention only (T3), and an actor rule that sits in a file the next owner cannot edit.

## How I checked

- Scratch clone of `fbec03d` in a private `/tmp` folder (`--no-hardlinks`, `node_modules` copied). The shared LA worktree did not change.
- `vitest run` on `packages/shared/src/migrations.test.ts`, `services/lti-service/src/store/audit.test.ts`, `services/lti-service/src/http/**` and `services/lti-service/src/cli/**`: **15 files, 277 tests passed**.
- `node --test infra/scripts/fitness-audit-event-delete.test.mjs`: 3 of 3 passed.
- `eslint` on the changed folders: 0 problems. `tsc --noEmit` on `services/lti-service` and `packages/shared`: exit 0.

## Checks

| Check | Result |
| --- | --- |
| Files and "Must not edit" | No change in `http/routes/registration.ts`, `lti/**` or app files. The changes outside the "May edit" column are S1 files that the scope needs. `packages/shared/src/migrations.ts` is the RQ-2 edit of BD-A2-01. `http/operator/{index,operator-keys}.ts`, `store/operator-keys.ts` and `cli/operator.test.ts` are LA-E5-01 files (events of the LA-E5-01 routes and of `init`). `infra/scripts/fitness/rules/audit-event-delete.mjs` and its interim test are covered by BD-A1-02. |
| Ownership (epics §5) | S1 owns every changed file in B1: `migrations.ts` (row adjustment 12), `http/operator/**`, `store/{operator-keys,audit}.ts`, `cli/**`, `http/routes/platforms.ts` (B1 only), other `infra/**`. OK. |
| No behaviour change outside the spec | The platform routes keep their answers. The validation and lookups moved into the `withAudit` body unchanged. The two "not found after the store call" paths moved into `audit.change`, so the empty change rolls back and the answer stays `UNREGISTERED_PLATFORM`. The one shared change is that a nested `transaction()` no longer throws "cannot start a transaction within a transaction". A2 checked that no caller used that error. |
| No LMS name in core | The new non-test files have none. The `moodle2.test` hosts are in unit tests (not in F1 scope, TEST-STRATEGY §3.1). |
| Transaction rules | T0: matches the code (`migrations.ts:27-40`). T1: `withAudit` and `change` match. T2: no async callback in this diff; the guard is the follow-up C1. T3: see B-LA-E5-02-01. T4: savepoint names are unique per process (`savepoints` counter). |
| UNIT ACs fail on the old behaviour | AC-07: the old tree has no migration `007`, so the upgrade test fails. AC-08: with the old `transaction()`, the nested `createPlatform` throws "cannot start a transaction within a transaction", so `toThrow('a later step fails')` fails. The second AC-08 test needs `withAudit`, which did not exist. |
| Test quality | Good. Each route test reads the stored events in call order (a 1 ms clock step) and checks the action, actor, target, result, code and details. The refused paths, the unauthenticated paths, two tenants, paging and the secret scan each have a case. The migration test upgrades a v6 database with rows. |
| K1-SIM and K0 ACs | AC-01 to AC-06 and AC-09 are QA SIM-lane checks. AC-10 waits for the F5 runner of LA-E1-04 (Lead decision). The Author unit tests already cover the same rows. |

## Findings

### B-LA-E5-02-01 — MINOR — Rule T3 ("`change` at most once") has no guard, so a second call writes a second `ok` event

- **File:** `services/lti-service/src/store/audit.ts:126-144`.
- **Problem:** Rule 1 says "exactly one event per request". `audit.change` can run twice in one body, which stores two `ok` events. A 4xx thrown after `change` committed stores no `refused` event (`written` is true), so the client sees a 4xx while the log says `ok`. Both mistakes are easy to make in a later route (LA-E5-03, -04, -07, -09, -10 all call this writer), and no test fails.
- **Evidence:** `change(fn, describe) { const result = transaction(…); written = true; return result; }` does not check `written` first. T3 is written in LA-ADR-06 D4, but only T2 got a code guard (follow-up C1). A guard for T3 is one line and turns the mistake into a failed unit test, the same aim as C1.
- **Suggested fix:** In `change`, throw `new Error('audit.change runs at most once per request (LA-ADR-06 D4 T3)')` when `written` is already true. Add one unit test. The S1 follow-up commit for C1 is a good place. Optional: in the `catch`, when `written && refusalCode(err) !== null`, wrap the error as a programming error (500). The `ok` event is then not contradicted by a 4xx answer.

### B-LA-E5-02-02 — MINOR — The tenant actor rule sits in a route file that the task assigned to switch it cannot edit

- **File:** `services/lti-service/src/http/routes/platforms.ts:79-87` (the `audited` helper, actor `` `bootstrap-${accountId}` ``); `services/lti-service/src/http/auth.ts:37-44` (`AuthResult`).
- **Problem:** AC-LA-E5-02-01 says that "LA-E5-07 switches it to the key id". LA-E5-07 is lane S2 in B2. Its file list owns `http/auth.ts` and puts `http/routes/**` under "Must not edit". The matrix gives `http/routes/platforms.ts` to L in B2 and B3. So the planned switch needs a cross-lane edit. LA-E5-07 has no AC for the tenant actor (its only audit AC, AC-LA-E5-07-08, is about `operator:<name>` events). The switch is therefore likely to be missed: after two keys per account exist, tenant events still name `bootstrap-<account>`, and the audit cannot tell which key acted.
- **Evidence:** `AuthResult` has `scheme`, `account`, `launch` and `serviceKey`, but no key id or actor. Only `platforms.ts` builds the API-key actor, inside a closure. Every later tenant route that audits (LA-E3-06 `registration.complete`, Should LA-E5-15, Could LA-E6-*) would copy the rule.
- **Suggested fix:** Pick one before LA-E5-07 starts. (a) Preferred: in the S1 follow-up commit (S1 owns `http/auth.ts` in B1), add an audit actor to `AuthResult`, for example `apiKeyActor: { type: 'api_key', id: 'bootstrap-<account>' } | null` for the Bearer scheme. `platforms.ts` then reads it from `ctx.auth(...)`, and LA-E5-07 changes only `http/auth.ts`. (b) The Lead adds to LA-E5-07 an AC "tenant events carry `api_key:<key id>`" and an RQ-1 line for L in `platforms.ts`.

### B-LA-E5-02-03 — NIT — Two `audited` helpers with two shapes; `change` also records a read

- **File:** `services/lti-service/src/http/routes/platforms.ts:84-87` (six positional parameters, most calls pass `null`); `services/lti-service/src/http/operator/index.ts:40`, `:91` (`(req, event, body)`); `services/lti-service/src/http/operator/audit.ts:52`.
- **Problem:** The operator helper takes one `event` object; the tenant helper takes `action, target, details` by position. A reader must learn both. `GET /operator/v1/audit` records its `audit.read` event through `audit.change(() => listAuditEvents(...))`, so "change" also means "the step whose event we store".
- **Suggested fix:** Give the tenant helper the operator shape: `audited(req, account, { action, target, details? }, body)`. A one-line comment at `audit.ts:52` ("`change` also wraps a read: the event is stored with it") is enough for the name; or add a `record` alias in `AuditedRequest`.

### B-LA-E5-02-04 — NIT — `details.fields` lists the condition `ifBindingRef` as a changed field

- **File:** `services/lti-service/src/http/routes/platforms.ts:327` (`deployment.update`), and the `platform.update` `describe` (`fields: Object.keys(patch)`; `PlatformPatch` has `ifBindingRef` at `:55`).
- **Problem:** D4 says that `details` "names changed fields". `ifBindingRef` is a precondition, not a changed field. An operator who reads `fields: ["active", "ifBindingRef"]` may think that the binding ref changed.
- **Suggested fix:** Leave out `ifBindingRef` from `fields`. If the condition is useful, store it as `conditional: true`.

### B-LA-E5-02-05 — NIT — An event without a target type reads back as `type: ""`

- **File:** `services/lti-service/src/store/audit.ts:10`, `:70`; migration `007_audit_event.sql:11` (`target_type TEXT`, nullable).
- **Problem:** The column is nullable, but `AuditTarget.type` is `string`. `toEvent` maps `NULL` to `''`, so the API shows an empty string that no writer stored. Every action of contract delta §5 has a target type, so the case is unlikely, but the mapping hides a writer mistake.
- **Suggested fix:** Type `target.type` as `string | null` and return `null`. Do not edit the applied migration (ADR-006 checksum rule).

### B-LA-E5-02-06 — NIT — The default page size (100) is not in the contract

- **File:** `services/lti-service/src/http/operator/audit.ts:21` (`AUDIT_PAGE_DEFAULT = 100`); `docs/architecture/ltiaas/contracts/lti-service-api-delta.md:209` ("`limit` (≤ 500)").
- **Problem:** An operator, QA or Docs reads only the maximum. A call without `limit` returns 100 events and a `next` cursor. Someone who expects "all" may miss the cursor.
- **Suggested fix:** The Lead asks A2 to add "default 100" to the contract delta §3 row (no code change).

## Follow-up commits in the range (not LA-E5-02)

The range also has three S1 follow-ups. `f2c2f31` and `2725853` fix my earlier findings B-LA-E5-01-02 (`stack:reset` now deletes `infra/.secrets/lti-operator-key`, header updated, test updated) and B-LA-E5-01-03 (`lti-bootstrap.sh` names the source of the operator name and the `OPERATOR_NAME=alice npm run seed` fix on exit 2). Both look correct. I did not review `d1f7d42` (LA-E5-08 e2e tmpfs); that is Reviewer-A's finding.

## Not checked

- K1-SIM and K0 runs; the in-progress S1 follow-up (C1, T5, Reviewer-A MINORs).
- Lens-A depth: the redaction patterns of `redact()` beyond the unit cases, and the client-address rule after LA-E5-03.
