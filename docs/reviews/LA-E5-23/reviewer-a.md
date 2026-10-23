Verdict: APPROVE
Round: 2

# LA-E5-23 review: Reviewer-A (lens "Is it right and is it safe?")

## Round 1

- Reviewer: Claude Code Opus 5.5 xhigh (Reviewer-A, same session).
- Diff: `git diff 81d3a8f4^1 81d3a8f4` (lane S2; 95 files). It holds:
  - `24d380fd`, `094507f5`, `7ac78243`, `f6dde164`, `8a10cabb`, `3fb2eac6`;
  - the RQ-2 P commits `b08ee870` (F5 allowed path) and `13c20ad0` (platform-check route).
- References: `docs/architecture/ltiaas/tasks/LA-E5-23.md` (AC-01 as A2 rewrote it); LA-ADR-06 D13 item 3 "Build rules", D4 rules 1–2 and T0–T3; A2 BD-A2-96.
- I ran these in a private clone at `81d3a8f4`. I deleted the Vitest cache before each run. No Docker, no stack.
  - `npm run test:unit`: 200 files, 3220 tests pass, 5 skipped.
  - `npm run test:k0`: 145 tests pass. `npm run test:infra`: exit 0.
  - F1 PASS; F5 PASS (6 rules, with `audit-event-delete` at the new path); `npm run typecheck`: exit 0; ESLint on `services/lti-service` and `infra/scripts/fitness`: clean.
  - Probes: an independent boundary grep; two planted files outside `store/**`; a type-aware scan for promises used as booleans or left floating (TypeScript checker over `services/lti-service/tsconfig.json`); a comparison of the moved job code.
- Blind review: I did not open the other reviewer's file.
- **Counts: 0 BLOCKER, 0 MAJOR, 1 MINOR, 0 NIT.**

### Checks (the lens A focus of the brief)

| Check | Result |
| --- | --- |
| No `await` inside a transaction or `audit.change` | Holds. Every audited write is a method of `store/audited-operations.ts`. Each method is `async`, but its body is one synchronous `audit.change(() => …)`. `withAudit` runs that inside `transaction()`, and `transaction()` calls `assertSynchronous` on the result, so a thenable would throw and roll back. No callback passed to `transaction(` or `.change(` is `async`. The few `await`s in `store/**` (`yieldToLoop` between re-wrap batches, `prepareToolKey`, the rotation job's `withAudit` calls) are outside any transaction; they moved verbatim from `jobs/**`. |
| Every audited write stays atomic (change + `ok` event + `afterCommit`) | Holds. Each operation does the change, the event (with the BD-A2-29 action rule, for example `account.status` versus `account.update`) and the commit-time counters in one transaction. Rechecks run under the writer lock: `requireWritableAccount`, the deployment checks, `revokeServiceKeys` scope, `acceptJob`. The `once per withAudit` guard still holds, because each operation calls `audit.change` once. A `4xx` after the body writes its `refused` event in `withAudit` (store code). Test `store/port.test.ts`: a failing audit rolls back the account and its first key, and a successful commit is observed once. |
| Rollback on a thrown error | Holds. A throw inside an operation rolls back the change and the event together (D4 T5). Every route keeps its store-error mapping inside the audited body, for example `PlatformExistsError` → `PLATFORM_ALREADY_EXISTS`, `BindingRefMismatchError`, `DeploymentExistsError`, `UnknownDeploymentError`. So `withAudit` still sees the `ApiError` and writes the same `refused` code. The platform-audit and operator route tests pass unchanged. |
| Job-lease preflight before `audit.change` | Holds. `acceptJob` runs `requireFreeLease()` before `audit.change(requireFreeLease)`, which reads the lease and the clock again inside the transaction (D4 T3; test "checks a job lease before the audit change and reads the clock again under its transaction"). `NOT_READY` (`503`) and an unknown job (`404`) are still refused before the change. The shared runner already awaits every `JobStore` method (`packages/shared/src/jobs.ts:332-559`), so `createLtiJobStore = storeFor(db).jobs` (async) keeps lease exclusion intact. |
| No SQL left outside `store/**` in production code | Holds for `prepare`, `exec` and `transaction`. My own grep outside `store/` and `db/` (no tests, no testkit) finds only `RegExp.exec`. A planted `db.prepare` in a scratch file makes the boundary test fail. The remaining value imports from `store/*.ts` outside the store are pure helpers and constants (`findDeployment`, `siteOriginOf`, `prepareToolKey`, `validateApiKeyIssue`, schemas, error classes). The test refuses an import of a synchronous adapter function (any function whose first parameter is `Db`). Gap: A-LA-E5-23-01. |
| No behaviour change on errors and status codes | Holds as far as unit tests reach. All 3220 tests pass, including route, audit, idempotency, rate-limit and protocol tests. The job code moved verbatim: a diff of each old `jobs/*.ts` against its new `store/*.ts`, without imports and comments, is empty. The registration cap keeps its double check (preflight, then `createCappedRegistrationSession` counts and inserts in one transaction, with the same `client_key` query). The type-aware scan finds no floating promise and no promise used as a condition, except intentional presence checks of cached promises. Six already existed (`jwks.ts` `inFlight`, `token-client.ts` `pending`, `auth.ts` `lookup`), and `rate-limit.ts:191` is the new promise map of the shared limiter. Interleaving: the SQLite adapter resolves on the microtask queue, so a chain of store awaits finishes before the next I/O event. Read-then-write sequences in a route therefore interleave with other requests only at real I/O, as before. |
| Audit-retention `DELETE` and F5 | `DELETE FROM audit_event` is only in `store/audit-retention.ts`. `store/audit.ts` has insert and list only (D4 rule 2). The F5 `audit-event-delete` `ALLOWED` path moved to it in the same merge, and F5 passes. |
| AC-02, AC-03 | AC-02: F5 `sql-portability` passes. AC-03: the store index names the four in-memory states, and a test checks them. AC-04 (T2a–T3c, G1–G4) is QA's K1-SIM at the wave end. |
| Must-not-edit list | `db/migrations/**` and `packages/shared/src/migrations.ts` are not touched. The P files are RQ-2 commits. |

### Finding

- **A-LA-E5-23-01 (MINOR): the boundary test does not detect `afterCommit` calls, but AC-01 names them.**
  - Where: `services/lti-service/src/store/port-boundary.test.ts:13-40`. `databaseCalls` flags `prepare`, `exec`, `transaction` and imported `transaction` aliases only.
  - Problem: AC-01 says no production file outside `store/**` and `db/**` calls the database handle, "(`prepare`, `exec`, `transaction`, `afterCommit`)". Probe: a scratch file `src/ra-planted.ts` with `afterCommit(db, () => undefined)` leaves the test green (4 passed). The same file with `db.prepare('SELECT 1')` makes it fail. Today no production `afterCommit` exists outside `store/**`, so this is a gap in the check, not a live violation.
  - Suggested fix: treat a call of `afterCommit` (also through an import alias, like `transaction`) as a hit. Add one line to the negative control.

### Verdict

APPROVE for lens A. Every audited write is one synchronous transaction with its event and commit callbacks, and errors still map to the same codes inside the audited body. The job-lease preflight is kept, the job code moved verbatim, and no SQL is left outside `store/**`. The one MINOR finding is a gap in the boundary test.

## Round 2

- Reviewer: Claude Code Opus 5.5 xhigh (same session as round 1).
- Diff: `git show 7c84167b` (merge `28be2a8a`). It changes one file, `services/lti-service/src/store/port-boundary.test.ts`. No product code changed.
- I ran these in the private clone at `28be2a8a`. I deleted the Vitest cache before each run. No Docker.
  - Vitest on `services/lti-service`: 96 files, 1322 tests pass. The boundary file has 20 tests.
  - `npm run typecheck`: exit 0; ESLint on `store/`: clean.
  - My round 1 planted files, re-run in the real source tree (below).
- Blind review: I did not open the other reviewer's file.
- **Counts (open after round 2): 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**

| Finding | Status | Evidence at `28be2a8a` |
| --- | --- | --- |
| A-LA-E5-23-01 (MINOR): `afterCommit` not detected | **Closed** | `databaseCalls` now treats as hits: a bare `afterCommit(`, an `afterCommit` import alias (value imports only; a type-only import is skipped), and a member or computed `.afterCommit(`. `sqliteImports` now also refuses a value namespace import of a store module that has synchronous `Db`-first functions. Production and the planted controls run through the same `enforceBoundary` file walk, in a scratch root, so nothing is planted in the real tree. I put a scratch file `src/ra-planted.ts` in the real tree, one form at a time. The real-tree test then fails with exactly that hit for each form:<br>- `afterCommit(db, …)` → `ra-planted.ts: afterCommit`;<br>- `import { afterCommit as later }` → `afterCommit`;<br>- `db.prepare(…)` → `prepare`;<br>- `import * as accounts from './store/accounts.ts'` → `accounts.*`.<br>Without the file, the test is green (20 passed). The allowed forms (regex `exec`, type imports, pure helpers, the public `store/index.ts`, SQL in strings) and the exclusions (`store/`, `db/`, tests, testkit) have their own controls. A violation beside excluded files is still reported. |

### Verdict (round 2)

APPROVE for lens A. The boundary check now covers every call form that AC-01 names, and the namespace-import bypass too. Every planted form fails it, and the production scan stays green. No lens A finding is open.
