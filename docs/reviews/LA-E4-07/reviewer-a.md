Verdict: CHANGES_REQUESTED
Round: 1

# LA-E4-07 review: Reviewer-A

## Round 1

Reviewer: Codex GPT-6-Astra xhigh, lens "Is it right and is it safe?" Date: 2026-10-23. **Counts: 1 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**

Reviewed `0ad8858`, `bb648ff`, `018abeb` and `f7841a1` (merge `be7698d`) against the task, app API delta §8a, LA-ADR-06 D10, operability §4.3, BD-A2-88 and plan §6.1. The updated task and §8a text were read in the integration worktree. Tests ran at committed snapshot `5ddf81af51caa1e20a96ac1b9f6cee2aef37b3a8` in fresh private clone `/tmp/la-review-a-c756b65b4bc9`, with its own `npm ci`; its Vitest cache was deleted before every run.

### A-LA-E4-07-01 — BLOCKER — The refusal label guard accepts a value that AC-07 requires it to collapse

**Where:** `services/cogniate-app/src/app/metrics.ts:88` and `:130`.

**Problem:** `launchRefused` reuses the job-name pattern `[a-z][a-z0-9_-]{0,63}`, which permits hyphens. AC-LA-E4-07-07, §8a and BD-A2-88 require refusal reasons outside `[a-z][a-z0-9_]{0,63}` to become `other`. A hyphenated value therefore creates its own series instead of the required fallback. Severity follows charter §5 because an explicit UNIT acceptance criterion fails; this does not establish a current HTTP-route secret leak, since the inspected launch callers supply fixed reasons.

**Evidence:** A private test calls `launchRefused('learner-42', 'unknown-channel')`. The scrape contains `app_launch_refusals_total{reason="learner-42",channel=""} 1`, whereas the contract requires `reason="other"`. The committed label test uses spaces and uppercase characters, so it misses this boundary. Changing only the reason check to the specified pattern makes all **19/19** committed metric tests and private probes pass; the diagnostic edit was then restored.

**Suggested fix:** Give refusal reasons their own strict pattern and add a hyphenated boundary case to the unit test. Keep hyphens valid for job names such as `record-dispatch`.

### Acceptance, safety and verification

- **UNIT AC-01:** default configuration and actual loopback binding pass. A real production child with `OPERATOR_HOST=0.0.0.0` exits 1 with one refusal line and no service start. Removing the bind guard makes its unit assertion fail.
- **UNIT AC-05:** readiness passes for a migrated database and returns 503 with fixed reasons for a changed or missing migration and a closed database. No LTI request is part of the check. Disabling the migration comparison makes the committed test fail.
- **UNIT AC-07:** unknown channels collapse to empty; the real web-process tests cover runner on/off send-series behavior. The off path starts no jobs, and the worker has no operator listener. The reason-pattern failure is finding -01.
- **Counters:** all six delivery outcomes count exactly once after commit. Lease loss and an injected failed commit add no accepted-send count. Moving observation before commit makes the committed test fail. Grant counts select ended states only; terminal attempts do not transition again and no deletion job was found. Compensation and job counts observe events before log-level filtering.
- **Launch and data boundary:** the real deployment-not-approved route adds one refusal under the loaded channel id. A deep-link handoff refusal adds no course-launch count. The probes expose no learner subject, platform partition, trace id, ltik or error text in metric samples. Reporter ids come from registered drivers; statuses and outcomes are fixed values.
- **Results:** **88/88 committed tests in five suites**, app typecheck, and **9/10 private probes** pass; the one private failure is -01. After all product mutations were restored, the affected metrics, process-entry and outbox suites pass **44/44** again. The three negative controls above fail at their intended assertions.

Ownership matches the dispatched R work and named L2/S RQ-2 edits. No QA-owned test, migration, redemption product file or unrelated infrastructure line changed, and no LMS dispatch branch was added. Only this review file was written in the integration worktree. No Docker, stack, stack-starting runner or commit was used, and no other reviewer's file was opened. K1-SIM and K-HYG remain QA gates.

Private evidence: `reviewer-a-focused.log`, `reviewer-a-probes.log`, `reviewer-a-*-mutant.log`, `reviewer-a-reason-fix.log`, `reviewer-a-restored.log`, `reviewer-a-typecheck.log`, and the saved `metrics.reviewer-a.test.ts` in the clone. Its tracked product files are restored.
