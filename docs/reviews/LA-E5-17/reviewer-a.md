Verdict: APPROVE
Round: 3

## Round 1

Reviewer-A: Codex GPT-6-Astra, xhigh. Date: 2026-10-23 (+07).

Reviewed `282cce5` (merge `880f5d6`) and L's observers in `0270b39` and `c521136` (merge `f4530b9`). Test snapshot: `9c87853dead8814435d538b0c4d85bfbafc1c0a8`.

Basis: LA-E5-17; LA-ADR-06 D10; operability §4.2 and §4.4; BD-A2-52 and BD-A2-54; plan §6.1; ownership matrix §5. No earlier Reviewer-A file existed. Review was blind. The next S1 scrape-time JWKS join is outside this dispatch; its absence is not a finding.

### A-LA-E5-17-01 — MAJOR — Committed audit events can disappear from the counter

**Location:** `services/lti-service/src/store/audit.ts:75` and `:156`; affected product caller: `services/lti-service/src/jobs/key-rewrap.ts:132`.

**Problem:** An insert inside a transaction is not observed, and there is no notification when that outer transaction commits. The special notification after `withAudit().change()` covers only its own outermost call. It misses direct transactional inserts and a successful caller-owned outer transaction. This violates the exact commit-time source in BD-A2-52 and operability §4.2.

**Evidence:** Two independent probes failed in the private clone:

1. Commit one nested `withAudit` change, then roll back a second outer transaction. The database contains exactly one `account.update` event. The scrape has no `lti_audit_events_total{action="account.update",result="ok"}` sample; the expected count is 1.
2. Run the real `keyRewrapJob` with a valid lease and the configured key provider. It returns `ok` and commits one `key_provider.rewrap` completion event. The scrape has no sample for that action; the expected count is 1.

The second case is an existing product path, not a hypothetical caller. `metrics.test.ts:165` also commits an outer transaction, but line 173 asserts that its event is absent. That assertion accepts the defect. Rollback suppression alone does not prove committed counts are exact.

**Suggested fix:** Buffer observer events per transaction/savepoint. Publish each event exactly once after the outermost commit, and discard events from rolled-back scopes. Keep autocommit observation and avoid table counts. Route any shared transaction-helper change through its owner. Change the test to require the committed event, and cover the real rewrap completion plus outer rollback.

### A-LA-E5-17-02 — BLOCKER — HTTP logs retain untrusted personal path values

**Location:** `services/lti-service/src/http/app.ts:87` through `:90`; helper: `packages/shared/src/logger.ts:118`.

**Problem:** The changed HTTP log hook still takes `path` from `req.url`. `redactPath` only masks long URL-safe segments, so an unknown account value can put an e-mail or other personal value into a persistent `http_request` log. The new tenant lookup protects `tool_account_id` and metric labels, but does not protect the path field. AC-07 and the dispatch's log privacy requirement remain unmet.

**Evidence:** An independent request to `/lti/login/alice@example.test` returned 404 and emitted:

```json
{"event":"http_request","method":"GET","path":"/lti/login/alice@example.test","status":404}
```

The probe asserting that HTTP logs exclude `alice@example.test` failed. No account with that id was stored. This path-formatting behaviour predates the diff; it is an inherited gap in this task's privacy requirement, not a new disclosure introduced by the tenant field.

**Suggested fix:** Log a route template or a path built from fixed segments and verified stored ids. Use a fixed value for an unknown route. Do not copy an unknown account, encoded path segment or raw API path parameter into logs. Keep the resolved tenant in `tool_account_id`. Add log assertions for unknown and encoded personal path values, alongside the existing metric-label test.

### Checks and evidence

The combined targeted run documented in [LA-E4-05 Reviewer-A](../LA-E4-05/reviewer-a.md) passed **153 tests in 8 files, with no failures or skips**. It includes the metrics, JWKS, signature-check, token-client and rewrap suites. Log: `/tmp/la-review-a-87370f28405e-baseline.log`.

Extra probes were added only to the private clone's colocated unit files. Command:

```sh
cd /tmp/la-review-a-87370f28405e
./node_modules/.bin/vitest run \
  services/lti-service/src/http/metrics.test.ts \
  services/cogniate-app/src/worker-main.test.ts -t 'Reviewer-A'
```

Result: **3 expected-assertion failures for the two findings above; 1 web-conflict probe passed**. The name filter left 22 existing tests unselected. Probe source remains in that private clone; log: `/tmp/la-review-a-87370f28405e-probes.log`.

Other reviewed behaviour:

- UNIT AC-04 and AC-05 have focused tests. Missing referenced key versions give 503 on both listeners; public readiness hides reasons. Closed databases and altered/missing migration records also fail readiness. Production health has exactly the two required fields; default and acceptance shapes stay intact.
- Both listeners share one metrics registry. The operator metrics route is outside operator authentication; the public route is absent. Request tenant labels come from stored ids, with isolated request contexts even when trace ids match.
- The limiter observer runs before sampling. The tests demonstrate three hard refusals and three soft excesses despite one warning of each type.
- Token observers report one outcome per shared token request, with no cache-hit event. JWKS observers report each waiting verification call with its own platform id and the shared completion time. Cache hits and legacy callers emit none. Failed refreshes preserve `lastSuccessAt`; reading it does not fetch. Throwing observers do not change token or verification results.
- No source was replaced with a retention-sensitive table count. No secret or arbitrary request field is copied into the new metric labels in the inspected call paths.

### Scope and remaining gates

S1 wiring and L observers match the dispatch and ownership matrix. The one-line `lti/service-keys.ts` change in `c521136` has an explicit Lead RQ-2 record in `docs/team/ltiaas/board.md:175`. The named diffs do not edit `tests/**`, frozen acceptance assertions, the protected login/launch files or route files. They add no LMS name to core logic.

Open findings: **1 BLOCKER, 1 MAJOR**. Fix and retest both. The later observer-to-metrics wiring and scrape-time join need their own review. K1-SIM AC-01/02/03/06/07 and full regressions remain with QA; host injection tests do not close those gates.

No Docker, stack or host stack runner was used. Only this review file was written for this item; no product file, integration test, commit or push was made.

## Round 2

Reviewer-A: Codex GPT-6-Astra, xhigh. Date: 2026-10-23 (+07).

Reviewed `cd77d8f`, `c1ef4bb`, `7f77534` and `88e9ca2` (merge `d866441`), plus the observer wiring and scrape-time JWKS join in `2477abb` (merge `836d579`). Test snapshot: `fa7bf0a26ca37bf634c5abbdf0d4dec662a64b2a`, private clone `/tmp/la-review-a-d46b4a25d056`. Basis: the Round 1 sources, BD-A2-60/61 and LA-ADR-06 D4 T0–T5. Review was blind.

### Previous findings

- **A-LA-E5-17-01: closed for the reported product paths.** Every insert now registers an `afterCommit` callback. A nested audited change and the real key-rewrap completion count once after their helper-managed outer transaction commits. Released inner scopes are discarded on outer rollback. The old test that accepted a missing count is corrected. The new helper has a separate boundary defect below.
- **A-LA-E5-17-02: closed.** Both listeners log the matched route template, or `<unmatched>`. Tests cover unknown and encoded personal path values, query text, an unmatched route and an operator route. No raw path value reaches `http_request.path` in these cases.

### A-LA-E5-17-03 — MAJOR — An outer transaction opened outside the helper publishes rolled-back events

**Location:** `packages/shared/src/migrations.ts:41`–`:44` and `:100`–`:106`; observer registration: `services/lti-service/src/store/audit.ts:78` (`insertAuditEvent`).

**Problem:** The commit hook treats an empty helper-scope stack as autocommit, even when `db.isTransaction` is true. A direct audit insert therefore publishes at once. Wrapping that insert in `transaction()` also publishes too early: the helper releases its savepoint, finds no parent buffer and runs the callback while the caller's outer transaction is still open. A later outer rollback cannot undo the counter.

LA-ADR-06 D4 T0 distinguishes an open database transaction from autocommit and requires callbacks to wait for the outermost commit. BD-A2-60 removes the exception for caller-owned transactions. The new code comments instead permit immediate publication for a transaction the helper did not open; that exception is not in the design. The probe opens and rolls back the outer transaction outside `fn`, so it does not violate T4's rule against transaction SQL inside `fn`.

**Evidence:** Independent probes reproduced both direct and nested-helper cases:

```text
db.exec('BEGIN IMMEDIATE')
insertAuditEvent(...)                  // also tested inside transaction(db, ...)
db.exec('ROLLBACK')
listAuditEvents(...).events            -> []
GET /metrics                          -> lti_audit_events_total{action="account.update",result="ok"} 1
```

Two shared-helper probes also observed the callback running with `db.isTransaction === true`, before the rollback. The metric probes fail their no-count assertions for the same reason. Existing product call sites use the shared helper for outer transactions, so this is a new defect in the supported transaction boundary, not a claim that the repaired key-rewrap path still fails.

**Suggested fix:** Distinguish true autocommit from an open transaction without a tracked outer scope. Support the outer transaction's commit/rollback lifecycle, or enforce a documented helper-owned transaction requirement and refuse unsupported registration before publishing anything. Do not treat `RELEASE` of an inner savepoint as a commit. Add direct-insert and nested-helper tests under an externally opened outer transaction, including rollback and successful commit. Route any contract restriction through A2.

### Checks and evidence

The unchanged focused suites passed **96 tests in 7 files**:

```sh
NODE_NO_WARNINGS=1 npx vitest run \
  packages/shared/src/migrations.test.ts \
  services/lti-service/src/http/metrics.test.ts \
  services/lti-service/src/store/audit.test.ts \
  services/lti-service/src/jobs/key-rewrap.test.ts \
  services/lti-service/src/main.test.ts \
  services/lti-service/src/lti/jwks.test.ts \
  services/lti-service/src/platform/token-client.test.ts
```

The app's related suites passed a further 48 tests in 3 files, documented in [LA-E5-12 Reviewer-A](../LA-E5-12/reviewer-a.md). TypeScript checks passed for both services and the shared package.

Private additional probes:

- `npx vitest run packages/shared/src/reviewer-a-commit-probe.test.ts`: **2 failed**, for premature callbacks under an external outer transaction; **1 passed**, for separate database scopes and a callback starting a new transaction.
- `npx vitest run services/lti-service/src/http/metrics.test.ts -t 'Reviewer-A'`: **2 failed**, for the rolled-back events counted above; 17 existing tests unselected. Log: `/tmp/la-review-a-d46b4a25d056-metric-probes.log`.

The managed-scope tests verify successful commit, nested release, inner/outer rollback and failed commit. Callback failures do not change the committed result or prevent the next callback; the metrics observer logs its failure. Tests of the real rewrap completion and both HTTP listeners cover the old findings.

The new JWKS join reads `lastSuccessAt` at scrape time for stored active platforms. A shared URL produces one age series for each eligible stored platform; a missing cache entry produces no series. Reading the timestamp does not fetch. Real token/JWKS observer tests check failures, successful requests, both waiting callers, and unknown/missing ids. Runtime wiring is tested through `main.ts`. No raw URL, token, personal path or unregistered platform id becomes a new label.

### Scope and remaining gates

The shared helper and one-line S2 export are covered by the dispatch's RQ-2 scope. The named diffs do not edit `tests/**`, frozen acceptance assertions or protected protocol routes, and add no LMS-specific core logic. UNIT AC-04/05 remain covered by dependency-failure and production-health tests. The scrape-time join is now present and reviewed.

Open findings: **1 MAJOR (A-LA-E5-17-03)**; no open BLOCKER. Fix or resolve the transaction contract with A2, then retest the failing probes. K1-SIM and full regression gates remain with QA. No Docker, stack or host stack runner was used; only this review file was changed for this item in the integration worktree, with no commit or push.

## Round 3

Reviewer-A: Codex GPT-6-Astra, xhigh. Date: 2026-10-23 (+07). Reviewed `ccaed3a` (merge `19d6dc4`) against BD-A2-74, LA-ADR-06 D4 T0/T4, the task spec and plan §6.1. Test snapshot: `911ed4f3c9f8cc57f5d4dda5d81f7a696fd04817`, private clone `/tmp/la-review-a-23196a32859a`. Review was blind.

**Verdict: APPROVE. Open counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**

**A-LA-E5-17-03 is closed.** A2 has ratified the narrower contract: all enclosing transactions must be opened through `transaction()`. Both entry points now throw `TypeError("transaction opened outside transaction()")` when SQLite has an open transaction and that database has no helper scope. The guard runs before a savepoint, work callback or commit callback. The two premature-publication branches are gone.

`insertAuditEvent` now wraps its insert and callback registration in one helper scope. This is necessary: checking only `afterCommit` would throw after the row was already written. The revised writer refuses before insertion, even when the caller catches the error and commits its raw outer transaction. Autocommit, nested helper transactions, outer rollback and the real key-rewrap completion retain the intended counts. Throwing observers still cannot change the commit result.

The earlier Round 2 probes were rerun with the explicit-refusal expectation required by BD-A2-74. **All 5 independent probes passed**: direct and nested helper entry, direct and nested audit insertion, and isolation between two database connections. They check both raw outer commit and rollback, no row before the outer transaction ends, no counter afterward, and recovery to a normal helper-managed transaction. A raw savepoint on the second connection is also refused while the first connection has a valid helper scope. The probes live only in the private clone's `packages/shared/src/reviewer-a-commit-probe.test.ts` and appended rows of `http/metrics.test.ts`.

Focused regression: **103 tests passed in 7 files**, covering the shared migration/transaction helper, LTI metrics, LTI audit, key rewrap, service startup, app audit and app operator audit. This includes the unchanged UNIT AC-04/05 tests and the prior path-redaction and committed-count regressions. TypeScript checks passed for the shared package and both services.

As a control, restoring only the two implementation files from `ccaed3a^` made **both new BD-A2-74 tests fail**. The source was restored and compared with the reviewed snapshot afterward. Evidence logs:

- `/tmp/la-review-a-23196a32859a-baseline.log` — 103 passed.
- `/tmp/la-review-a-23196a32859a-probes.log` — 5 passed; 18 existing tests unselected by the `Reviewer-A` filter.
- `/tmp/la-review-a-23196a32859a-old-control.log` — 2 expected control failures; 43 tests unselected by the `BD-A2-74` filter.

No new finding. A product-source scan found raw transaction statements only in the shared helper; the app matches are comments. The guard therefore does not break an existing product caller. The fix stays within the dispatched shared-helper and S1 audit scope and adjacent unit tests. It does not edit protected protocol files, `tests/**` or frozen assertions, and adds no LMS-specific core branch. Findings -01 and -02 remain closed.

Only this review file was changed in the integration worktree. No Docker, stack, host stack runner, commit or push was used. No Reviewer-A fix remains; QA and the Lead own final regression closeout.
