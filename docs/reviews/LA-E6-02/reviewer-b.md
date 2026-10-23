Verdict: CHANGES_REQUESTED
Round: 3

# LA-E6-02 — Reviewer-B

## Round 1

Reviewed the eight dispatched LA-E6-02 commits in merge **`195930c1`** against the task spec, LA-ADR-08 D5 / BD-A2-100, app API delta §3.7, data model §5a and plan §6.1. Reviewer-B lens: can an admin act on the health view, and can support identify a refusal or dispatch failure? **0 BLOCKER, 0 MAJOR, 2 MINOR, 0 NIT.** Blind review; no Reviewer-A file opened.

## Findings

### B-LA-E6-02-01 — MINOR — The backlog help can ask for an unavailable action and an undisplayed identifier

- **File:** `apps/portal/src/connect/ConnectionHealth.tsx:16` and `:50-52`; related `ConnectionCheck.tsx:42` and `services/cogniate-app/src/app/connection-health.ts:73-80`.
- **Problem:** Every backlog warning says “Use Check connection” and asks for an error trace id. The health panel appears for every channel/status, while the check control requires the manifest capability and a registered/connected connection. The health response itself contains codes and times, not a trace id. This leaves a baseline admin without the advertised next step.
- **Evidence:** A private Testing Library probe rendered both shipped components with a connected Moodle connection and a two-hour backlog. It showed the instruction but no `Check connection` button; the corrective assertion failed. Moodle has no check capability. The same issue applies to a disabled connection. The health view renders only the refusal/error code and time; its event mapping drops the stored `traceId`, as specified by the current contract. A backlog need not have a separate failed API request whose error notice provides a trace id.
- **Suggested fix:** Show the check instruction only when that control is available. Otherwise direct the user to the operator with information the page exposes, such as the connection name/id, last error code and time. If a trace id is required, provide a clear way to obtain it through an agreed contract/UI change. Add a capability/status case to the warning test. This is a non-blocking help-text issue; the backlog warning and diagnostic values remain available.

### B-LA-E6-02-02 — MINOR — The unexpected-response guard does not contain malformed nested values

- **File:** `apps/portal/src/connect/ConnectionHealth.tsx:29-31` and `:72`.
- **Problem:** `isHealth` checks only the top-level containers, then asserts the complete `Health` type. A malformed event passes that guard and throws during rendering instead of reaching the local “not available” fallback added in `1af1bfe8`.
- **Evidence:** With an otherwise valid answer and `events: [null]`, a private component probe reached its enclosing page error boundary; the expected local fallback was absent. A valid-answer control passed. The shipped unexpected-answer test only supplies an object with no health containers, so it misses this case.
- **Suggested fix:** Validate the nested fields that rendering uses, including non-null event objects and their scalar fields, or isolate rendering with a local fallback boundary. Add the null-event case. Safe to defer: the current API emits valid event objects, so this affects resilience to an unexpected response rather than the normal health path.

## Contract, ownership and acceptance checks

The API uses library-scoped connection lookup before reading health or tool keys. It derives refusal/check summaries from the kept events, dispatch counts and the newest stored error from the connection's placements, and exposes only the parsed reporter code. The key comparison implements all three `artifactKeyCurrent` states and keeps `nextKid` null. The public tool-key read is cached for 60 seconds; the view makes no platform check. Check results are written with the required `ok` or ordered `jwks:<detail> token:<detail>` representation.

The migration adds the generic table/column without changing existing connection values. Event insert and 100-row trimming share a transaction; the retention job removes rows older than 30 days. The UI uses manifest text, warns only on a false key comparison or a backlog older than one hour, and keeps the health section collapsed without `role="alert"`. The inspected T6/M2 selectors are not changed by this diff.

| Acceptance criteria | Review evidence/status |
| --- | --- |
| AC-06: 100 events and 30-day retention | Temporary-database tests cover per-connection trimming, the cutoff boundary and the actual retention job; both corresponding mutants fail. |
| AC-07: migration compatibility | The test opens a pre-016 database, adds 016, compares every old column and verifies null `artifact_key_kid`; removing the column addition fails it. |
| AC-08: portal warnings | Testing Library verifies both rendered warnings, channel-name substitution and absence when neither applies; suppressing warnings fails it. |
| AC-04 / AC-05 | Host unit tests verify foreign-library 404 and dispatch aggregation/error-code mapping; K1-SIM remains QA's verification tier. |
| AC-01 / AC-02 / AC-03 | Read-side shapes and key-state transitions are unit-tested; actual refusal writer/export flows remain **pending LA-E6-06 / LA-E6-05** under LD-16. |

The changes in K's server/table-list files, R's retention file and S1's migration test are the named RQ-2 changes in the dispatch and commit messages. The check writer is the requested cross-task call. No frozen test, outbox implementation, launch writer or Canvas export writer was changed by these eight commits; no LMS-specific production branch was added. The separate LA-E6-01 JWKS-validation commits bundled in the merge are outside this review item.

## Verification

Fresh private `git clone --no-hardlinks` at `195930c1`, own `npm ci`, and Vitest cache removed before each run. **68/68 focused tests across seven files passed**, covering health, events, connection checks, portal checks, migration and audit compatibility. Four private mutations each failed the intended acceptance test: 101-event limit, omitted retention-job deletion, omitted artifact column and suppressed rendered warnings. After restoration, the three new health/event/UI suites passed **21/21** again.

The independent UI probes produced two expected failures for the MINOR findings and one valid-answer control pass. Evidence is in `/tmp/reviewer-b-e602r1-{author,restored,ui-probes,mutant-limit,mutant-retention,mutant-migration,mutant-warnings}.log`; probe source is `/tmp/reviewer-b-e602r1-ui-probes.test.tsx`. No Docker, stack, host stack runner, live browser acceptance or commit. The private clone was restored, checked clean and deleted; only this report was edited in integration. QA's SIM/regression runs and the companion task evidence remain separate from this approval.

## Round 2

**Verdict: APPROVE.** Reviewed `f9e7961b` (merged by `52a89e2d`) against the same task/design and plan §6.1. **0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT open; both round-1 findings closed.** Blind review; no Reviewer-A file opened.

- **B-LA-E6-02-01 — closed.** `ConnectionHealth.tsx:78` uses the same manifest capability and registered/connected status rule as `ConnectionCheck`. Backlog help names that action only when available, then supplies the connection name and, when present, the displayed last grade error code/time. It no longer asks for an unavailable trace id. Tests cover connected Canvas, Moodle, Blackboard, disabled Canvas and pending Canvas. The original private probe also renders both components together and now passes.
- **B-LA-E6-02-02 — closed.** `ConnectionHealth.tsx:43–60` checks the nested scalar values and event objects before rendering. Eleven malformed-answer cases reach the local unavailable state without warnings. The original null-event probe now stays out of the enclosing error boundary; the valid-answer control still passes.

AC-06 tests now pin the design's literal 100-row limit and 30-day interval, including the cutoff boundary and retention job. The existing AC-07 migration and AC-08 warning tests remain green. The added export test exercises the real inline/URL export routes and the health key comparison through a simulated active-key change; this is host unit evidence, not the K1-SIM activation scenario. QA acceptance/regression evidence and the remaining companion-task verification stay separate.

Only the health component and its adjacent tests, plus the existing health-route/event tests, change. No forbidden file, frozen assertion, production LMS branch, API contract or retention implementation changes.

Verification: fresh private `git clone --no-hardlinks` pinned to `f9e7961b`, own `npm ci`, Vitest cache removed before every run. **42/42 tests passed** (39 shipped tests and three original independent probes). Restoring the parent UI made the two original probes fail while the valid-answer control passed. Separate 31-day and 50-row mutants each failed the intended test. After restoration, **39/39 shipped tests passed**. Logs: `/tmp/reviewer-b-e602r2-{focused,old-ui,mutant-ttl,mutant-limit,restored}.log`. The clone was restored, checked clean and deleted. No Docker, stack, host stack runner or commit; only this review file changed in integration.

## Round 3

**Verdict: CHANGES_REQUESTED.** Reviewed `ea47dc56`, merged by `e40a6d41`, against the task spec, LA-ADR-08 D5, BD-A2-101/102 and plan §6.1. Per the Lead's follow-up, this round assesses the dispatched code against BD-A2-102; the next fix will be reviewed separately. **1 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT open.** B-LA-E6-02-01 and -02 remain closed. Blind review; no Reviewer-A file opened.

### B-LA-E6-02-03 — BLOCKER — Inspecting Key JSON changes the recorded artifact and hides a real stale-key warning

- **File:** `packages/channels/canvas/portal/CanvasKeyJson.tsx:14`; reused effect at `packages/channels/canvas/portal/CanvasConfiguration.tsx:17-25`.
- **Problem:** Opening the section mounts `CanvasConfiguration`, which immediately fetches a URL-form export. Switching its checkbox fetches another export. The existing route records these as artifacts taken, although the admin has neither copied nor downloaded anything. A later health refresh loses the stale-key warning. This is a wrong support result and violates the explicit BD-A2-102 rule that opening and form switching must not fetch or record an export.
- **Evidence:** Two private probes through the real portal route, one registered and one connected, start with a stale-key warning and no export. Opening sends `/canvas-configuration`; refreshing health then removes the warning; selecting inline sends `/canvas-configuration?jwk=inline`. All six corrective assertions fail. These probes use a stateful API stub with the export writer's rule; the separately passing real-route test in `connection-health.test.ts:163` verifies that URL export actually clears `artifactKeyKid` and changes `artifactKeyCurrent` from false to null. The shipped new panel test instead expects the request on open, so it protects the rejected behavior.
- **Suggested fix:** In the registered/connected panel, fetch only from explicit Copy JSON or Download JSON actions. Opening, closing and changing the selected form must leave the artifact record alone. Preserve the pending wizard behavior. Replace the on-open expectation with regressions for no export on open/switch, the warning remaining after a health refresh, and an explicit successful Copy/Download recording the selected artifact. The accepted limit remains: the record shows the artifact taken, not proof that the LMS received it.

The other choices pass review: both registered and connected connections have a closed Key JSON section; pending and disabled connections have neither that section nor the stale-key warning. The help text matches A2 and names available controls. The six changed files are P's portal/module files and adjacent tests; no task-prohibited backend file, API, frozen QA assertion or production LMS branch in core changes. F1 and F5 pass. The manual create/pending DOM hashes pass unchanged; the inspected M2/T6 selectors retain their targets because the new Copy/Download controls are absent until the section opens. This is static/unit evidence, not a browser acceptance run.

Verification used a fresh private clone at **`e40a6d4153f611e7d9005e2e261234676b874d1f`**, its own `npm ci`, and a cleared `node_modules/.vitest-cache` before each run. **116/116 focused tests across seven files passed**, including the AC-06 retention, AC-07 migration and AC-08 warning coverage. Restoring the pre-change module registration and health component made **five shipped tests fail** for the new panel, status rule and help text. After restoration, the three UI suites plus audit compatibility passed **105/105**. Lint and typecheck pass. The two private BD-A2-102 probes fail as described above; there are no other findings.

Evidence: `/tmp/la-e6-02-r3-review-b-2y3v3rct/{focused,old-behavior,restored-and-audit,ui-probe,lint,typecheck,fitness-names,fitness-rules}.log`, with probe source in `ui-probe.txt`. The private clone is restored and clean. No Docker, stack, host stack runner or commit; only this review file changed in integration. The BD-A2-102 fix and QA's SIM/browser acceptance remain.
