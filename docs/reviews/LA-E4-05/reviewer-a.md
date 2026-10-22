Verdict: APPROVE
Round: 1

## Round 1

Reviewer-A: Codex GPT-6-Astra, xhigh. Date: 2026-10-23 (+07).

Reviewed `9625415`, the K-file scripts in `3612f3a` (merge `392287d`), and the `runNow` option in `549c204` (merge `c8ad467`). Test snapshot: `9c87853dead8814435d538b0c4d85bfbafc1c0a8`.

Basis: LA-E4-05; LA-ADR-03 D7; BD-A1-10; BD-A2-31 and BD-A2-50; plan §6.1; ownership matrix §5. No earlier Reviewer-A file existed. Review was blind.

### Findings

None. No open BLOCKER, MAJOR, MINOR or NIT.

### Checks and evidence

- Both entries use `createAppRunner`. The web entry starts it only when `APP_JOB_RUNNER=on`; the worker starts it even when that variable is `off`. An idle runner cannot dispatch through `kick`.
- The role check runs before the same-instance wait and inside the `BEGIN IMMEDIATE` claim transaction. A production refusal happens before recovery, polling or interval jobs. The refusal is written synchronously to stdout and the configured file before exit 1. Default-profile overlap warns.
- The process tests cover UNIT AC-01 through AC-04: web off, root `npm run worker`, both refusal directions with equal and distinct ids, simultaneous starts, stale rows, and two workers sending 20 due rows once. They check pending/sent state, POST counts, leases, exit codes and refusal logs.
- Shutdown awaits `runner.stop()` before database close. The existing runner tests cover drain and lease handling; the shutdown tests cover clean close and the 70-second fallback. Compose retains the 75-second grace. The order is 60 seconds < 70 seconds < 75 seconds.
- `runNow(name, { traceId })` preserves the trace in context and success, failure and skipped logs. A concurrent skipped call keeps its own trace. Existing one-argument calls still pass and generate their own trace.
- An added private-clone probe confirmed that a fresh same-role heartbeat conflict leaves the web listener serving, with its runner waiting and the score still pending. The shared runner invokes `onConflict` only for a worker.

Tests ran in `/tmp/la-review-a-87370f28405e`, made with `git clone --no-hardlinks`, after `npm ci --ignore-scripts --no-audit --no-fund`:

```sh
./node_modules/.bin/vitest run \
  packages/shared/src/jobs.test.ts \
  services/cogniate-app/src/worker-main.test.ts \
  services/cogniate-app/src/kernel/records/shutdown.test.ts \
  services/lti-service/src/http/metrics.test.ts \
  services/lti-service/src/lti/jwks.test.ts \
  services/lti-service/src/lti/checks.test.ts \
  services/lti-service/src/platform/token-client.test.ts \
  services/lti-service/src/jobs/key-rewrap.test.ts
```

Result: **153 passed, 8 files, no failures or skips**. This is the combined targeted run for both dispatched items. Log: `/tmp/la-review-a-87370f28405e-baseline.log`.

Old-behaviour check: replacing only the private clone's `jobs.ts` with `549c204^` makes both `BD-A2-50` tests fail on the trace assertions. Restoring the candidate returns that file to the tested snapshot. Log: `/tmp/la-review-a-87370f28405e-trace-before.log`. The extra web-conflict probe passed; its log is `/tmp/la-review-a-87370f28405e-probes.log`.

### Scope and remaining gate

The package script changes have the dispatch's K-file RQ grant. The job assembly and shared runner changes stay in R-owned paths. No `tests/**`, frozen acceptance assertion, compose service or core LMS-name branch changed in these diffs.

No Docker, stack or host stack runner was used. AC-05 and the golden SIM result remain for QA. This source approval does not close that runtime gate. Only this review file was written for this item; no commit or push was made.
