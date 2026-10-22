Verdict: CHANGES_REQUESTED
Round: 1

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
