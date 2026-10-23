Verdict: APPROVE
Round: 2

## Round 1

Reviewer-B: Codex GPT-6-Astra, xhigh. Date: 2026-10-23. Lens: Can a human team own it?

Reviewed `282cce5`, `0270b39` and `c521136` against the task spec, operability §4.2–§6, LA-ADR-06 D10, BD-A2-52/54, plan §6.1 and the ownership matrix. Verification used a private `git clone --no-hardlinks` at integration SHA `9c87853`. No other reviewer's file was opened.

### B-LA-E5-17-01 — MAJOR — Count audit events after their outer transaction commits

**Files:** `services/lti-service/src/store/audit.ts:75` and `:156`; incorrect test expectation at `services/lti-service/src/http/metrics.test.ts:173`.

**Problem:** `lti_audit_events_total` permanently omits committed audit inserts made inside a caller-owned transaction, so an operator cannot rely on it to count admin activity.

**Evidence:** `insertAuditEvent` only notifies the observer when `db.isTransaction` is false. `withAudit.change` compensates for its own transaction, but skips notification when an outer transaction still exists. Nothing notifies the observer when that outer transaction later commits. This contradicts the commit-time source rule in BD-A2-52 and operability §4.2.

This also affects an existing service path: `jobs/key-rewrap.ts:123` commits its completion event through `insertAuditEvent` inside `transaction()`, without `withAudit`. Two focused probes in the private clone failed:

1. Commit a caller-owned transaction containing `withAudit(... audit.change(...))`. The audit table contains one event, but the expected `lti_audit_events_total{action="account.update",result="ok"} 1` sample is absent.
2. Run the real `keyRewrapJob` with its lease. The job returns `ok` and stores one completion event, but the expected `lti_audit_events_total{action="key_provider.rewrap",result="ok"} 1` sample is absent.

The supplied metrics test commits an outer transaction at line 165 and then expects its event to be absent from the metric. It protects the omission instead of the specified contract.

**Suggested fix:** Notify once after the outermost successful commit for every audit-writer path. Preserve pending notifications through successful savepoints and discard them on rollback. Keep autocommit inserts counted once, and do not replace the counter with a table count because retention deletes rows. Replace the incorrect expectation and cover a committed outer transaction, an outer rollback, and the real re-wrap completion path.

### Other review checks

- Both UNIT ACs have direct tests: a missing stored key version produces operator readiness reasons and a redacted public answer (AC-04); production health has exactly the two required fields (AC-05).
- Both listeners use one metrics registry. Counter and histogram names, labels and seconds conversions agree with the operator signal table. The fixed metric maps and shared renderer keep an added series small. Tenant and platform labels resolve stored ids; arbitrary path values and personal fields do not become labels.
- The limiter observer counts before warning sampling. Tests distinguish three refused requests from one sampled warning. The logger wrapper observes before log-level filtering and avoids double wrapping.
- L's observers preserve protocol results if a consumer throws. Tests cover token single-flight requests, cache hits, JWKS waiters with different platform ids, failed refreshes, and the read-only last-success time after key expiry.
- The Lead confirmed that the `lti/service-keys.ts` one-line cleanup had an RQ-2 handover from L2 to L. It preserves behavior. The remaining edits follow the dispatched ownership grants, with no `tests/**` edit or new LMS name in core paths.
- Scope confirmed by the Lead: token-failure and JWKS-failure metric consumers, and the scrape-time JWKS age join, are all pending S1 work for the next review. Their absence is not a finding here.

### Validation and limits

The combined focused command recorded in `../LA-E4-05/reviewer-b.md` passed **136 tests in 6 files**, with no failures or skips. Local output: `/tmp/la-review-b-6391386c9bb5/baseline-vitest.log`.

The two additional commit-boundary probes failed as described above. Reproduction command, from the private clone:

```sh
./node_modules/.bin/vitest run services/lti-service/src/http/reviewer-b-metrics.test.ts
```

Probe source and output remain at `/tmp/la-review-b-6391386c9bb5/services/lti-service/src/http/reviewer-b-metrics.test.ts` and `/tmp/la-review-b-6391386c9bb5/reviewer-b-repro.log`. No product or test file was changed in the integration worktree.

No Docker or stack runner was used. K1-SIM, proxy isolation, the acceptance golden and the wider QA gates remain with QA. Open findings: **1 MAJOR**.

## Round 2

Reviewer-B: Codex GPT-6-Astra, xhigh. Date: 2026-10-23. Lens: Can a human team own it?

Reviewed `cd77d8f`, `c1ef4bb`, `7f77534`, `88e9ca2` and `2477abb` against the updated task, BD-A2-60/61/54, LA-ADR-06 D4 T0, operability §4.2 and the runbook metric actions. Verification used a private `git clone --no-hardlinks` at integration SHA `fa7bf0a`. No other reviewer's file was opened.

### Prior finding

**B-LA-E5-17-01 — CLOSED.** The audit writer registers the observer at each insert. The shared helper waits for the outer managed transaction to commit, moves successful savepoint callbacks to their parent and discards callbacks on rollback. The supplied tests now cover the committed outer change, outer rollback and real re-wrap completion. Both original Round 1 probes pass unchanged: the outer `withAudit` change and the real `keyRewrapJob` each store and count exactly one event. The observer failure test also preserves the committed row and checks `metrics_observer_failed`.

### B-LA-E5-17-02 — MINOR — State and enforce the managed-transaction boundary

**Files:** `packages/shared/src/migrations.ts:35`, `:41` and `:105`.

**Problem:** The new hook guarantees commit ordering only when every enclosing transaction uses `transaction()`, but the public design describes the guarantee for an open transaction without that restriction.

**Evidence:** The code comment explicitly permits immediate callbacks inside a transaction that the helper did not open. A private probe ran `db.exec('BEGIN')`, inserted a row, registered `afterCommit`, then rolled back. The callback ran with `db.isTransaction === true`, although the final table was empty. Wrapping the insert in `transaction()` inside that raw outer transaction produced the same result at savepoint release. LA-ADR-06 D4 T0 and operability §4.2 say that callbacks wait for the outermost commit and rolled-back inserts never count. A maintainer who follows that contract could add a false audit count.

**Suggested fix:** Make the requirement to use the shared helper for every enclosing transaction explicit in the public contract and API documentation. Detect an unmanaged outer transaction and reject or clearly report unsupported hook registration instead of calling a function named `afterCommit` before commit. Add a small regression test for this boundary. No current product caller opens a raw transaction outside the helper, so this is safe to defer and does not reopen B-LA-E5-17-01.

### Other review checks

- A new counter needs one metadata entry and a small event observer. Audit notification has one owner at the insert point; the managed transaction and savepoint buffers are small and have direct tests for commit failure, rollback, callback failure and callback order.
- Token and JWKS failure counters use stored platform ids. The JWKS HELP text states that failures count waiting verifications, so a shared fetch with two waiters does not masquerade as two outbound fetches.
- The age gauge joins active stored platforms to `lastSuccessAt(jwksUrl)` on every scrape, converts milliseconds to seconds, omits unfetched entries and handles platforms sharing a URL. Names, labels and units match the operator table and its registration, outbound/JWKS and stale-cache actions. The start-level test verifies that the real token observer and cache source are attached.
- HTTP logs use a route template or `<unmatched>`. Tests cover unknown and encoded personal path values and query strings. Raw account text is not used as the tenant label.
- UNIT AC-04 and AC-05 remain covered by direct readiness and production health assertions. Those assertions reject the old missing/readiness and unredacted health behavior. Round 1's additional audit probes failed before this fix and pass now.
- Edits follow S1 and the dispatched RQ grants for the shared helper/export and observer wiring. Protected protocol and HTTP route files were not edited. No `tests/**` change or new LMS name in core paths was found; F1 and F5 pass.

### Validation and limits

**78 tests in 5 files passed**, then both original audit probes passed:

```sh
./node_modules/.bin/vitest run packages/shared/src/migrations.test.ts services/lti-service/src/http/metrics.test.ts services/lti-service/src/main.test.ts services/lti-service/src/store/audit.test.ts services/lti-service/src/jobs/key-rewrap.test.ts --maxWorkers 2
./node_modules/.bin/vitest run services/lti-service/src/http/reviewer-b-metrics.test.ts --maxWorkers 2
./node_modules/.bin/tsc --noEmit -p services/lti-service/tsconfig.json
```

Both service type checks passed, and the app's 61-test focused set also passed with the shared helper. The two original probes were copied only into the private clone. The unmanaged transaction probe and its output are `/tmp/la-review-b-5571a303f6ee/reviewer-b-transaction-probe.mjs` and `reviewer-b-transaction-probe.log`.

Only this review file was changed for this item. No Docker or stack runner was used. K1-SIM, proxy isolation and the acceptance health golden remain QA gates. Open findings: **1 new MINOR; 0 BLOCKER or MAJOR**.
