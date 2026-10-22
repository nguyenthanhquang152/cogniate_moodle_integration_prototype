Verdict: APPROVE
Round: 1

## Round 1

Reviewer-B: Codex GPT-6-Astra, xhigh. Date: 2026-10-23. Lens: Can a human team own it?

Reviewed `9625415`, `3612f3a` (merge `392287d`) and the `runNow(name, { traceId })` change in `549c204`. Checked the task spec, LA-ADR-03 D7, operability, plan §6.1 and the file-ownership matrix. Verification used a private `git clone --no-hardlinks` at integration SHA `9c87853`. No other reviewer's file was opened.

### Findings

None. No open BLOCKER, MAJOR, MINOR or NIT finding.

### Review evidence

- `createAppRunner` supplies one reporter, queue and retention assembly to both entries. Importing the worker module from the web entry does not start a worker. A web process with jobs off still configures the record writers.
- The role check runs before an instance wait and inside the same `BEGIN IMMEDIATE` transaction as the claim. The production refusal names `job_runner_twice`, the requested role and instance id. It writes synchronously to stdout and the configured log file before exit 1. Normal starts and non-production warnings also name the role.
- The real-process tests cover every UNIT AC. They use a private database and local HTTP transport, exercise the root `npm run worker` script, and clean up their child process groups.

| AC | Test evidence |
| --- | --- |
| AC-01 | The web process with jobs off serves the health route, API and launch page. Across a queue poll, the score stays pending with zero tries and no job log or web heartbeat row. |
| AC-02 | The npm worker sends the expected score and service authorization while the web runner is off. Shutdown removes its heartbeat. |
| AC-03 | Both role directions refuse fresh conflicting rows, with equal or distinct ids. Further cases cover simultaneous starts, non-production warnings and stale rows. The refusal is checked in both log sinks. |
| AC-04 | Two worker processes share one database and send 20 due rows exactly once. The test checks actual POSTs, tries and released leases. |

The runner trace tests check success, failure, inactive and lease-held results, plus two concurrent calls with distinct trace ids. Ignoring the supplied trace id would fail these assertions.

Ownership is within the R lane plus the dispatched K-file grant for the two worker script lines. The diff changes no `tests/**` or compose file and adds no LMS name to a core path.

### Validation and limits

In `/tmp/la-review-b-6391386c9bb5`, ran:

```sh
./node_modules/.bin/vitest run services/cogniate-app/src/worker-main.test.ts packages/shared/src/jobs.test.ts services/lti-service/src/http/metrics.test.ts services/lti-service/src/lti/jwks.test.ts services/lti-service/src/lti/checks.test.ts services/lti-service/src/platform/token-client.test.ts
```

Result: **136 passed, 6 files, no failures or skips**, 9.06 s. The command covers both review items. Local output: `/tmp/la-review-b-6391386c9bb5/baseline-vitest.log`.

No Docker or stack runner was used. AC-05, the SIM golden regression and the wider QA gates remain with QA; this approval does not claim those results.
