Verdict: CHANGES_REQUESTED
Round: 1

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
