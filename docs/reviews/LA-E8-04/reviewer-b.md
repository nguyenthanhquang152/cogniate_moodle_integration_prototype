Verdict: APPROVE
Round: 2

## Round 1

Reviewer-B: Can a human team own it? Reviewed `c4efc406`, merged as `b207706d`, against LA-E8-04, operability, the API contracts, security delta, build decisions and the cited QA evidence. The guide identifies product baseline `02f5d420` and clearly leaves its command-by-command SIM check pending.

### B-LA-E8-04-01 — MAJOR — Give busy and skipped jobs a usable completion path

**File:** `docs/guides/ltiaas/operator-runbook.md:511`, also lines 513 and 762–766.

**Problem:** Both procedures send an operator who receives `409 JOB_RUNNING` to a completion lookup that requires the running job's trace id, which the refused request does not supply; the re-wrap procedure also has no action when an accepted request has no completion event.

**Evidence:** `store/audited-operations.ts:90–99` rejects a held lease before starting work. The key-provider and jobs routes return `{job, traceId}` only for `202`; a refused request has its own trace, which cannot identify the existing run. The passing `key-provider.test.ts` and `jobs.test.ts` cases confirm one refused audit event and no call to `runNow` for that request. Following §8.1 step 7 with this trace therefore cannot produce the required `system:key-rewrap` completion, and §12.1 has the same problem for `job_run`. In addition, operability §6.3 explicitly says to retry the POST if no system completion exists one minute after `202` because concurrent calls can skip a run; the runbook drops that branch. Its general job procedure also omits the `job_run_request_failed` branch from operability §8a, although the signal table at line 972 has the correct action. These are normal contention/start-failure cases in maintenance and incident recovery, not malformed requests.

**Suggested fix:** Distinguish an accepted run's trace from a refused request's trace. On `409`, give a concrete route back to a new accepted request after the wait, or an explicit way to find the existing run by job and time without assuming its trace is known. Restore the one-minute/no-completion re-wrap retry and add or link the `job_run_request_failed` action in §12.1. Keep the requirement for a complete re-wrap and zero relevant counts before removing any old key. Operability also has the ambiguous `409` transition; flag that shared wording to A2 while making the runbook procedure usable. Walk both branches with route fixtures or QA evidence; no product-code change is needed for this finding.

### B-LA-E8-04-02 — MINOR — Limit old-key revocation to replacement

**File:** `docs/guides/ltiaas/operator-runbook.md:274–282`.

**Problem:** The combined procedure for giving a second operator a key and replacing one's own key makes revoking an old key unconditional.

**Evidence:** Only step 3 is conditional on replacing one's own key. Step 5 always says to revoke the old key, and the following paragraph always says to use the new key for that revoke. When adding another operator, the original operator's key should stay active; following the default helper with it instead produces the documented self-revocation refusal. The product guard makes this safe to defer, but the runbook gives the new operator an unnecessary failure and an unclear branch.

**Suggested fix:** Say that issuing a second operator's key ends after safe delivery and a successful authenticated check. Mark the file replacement and old-key revocation steps as the replacement-only path, performed with the new key.

### B-LA-E8-04-03 — MINOR — Separate SIM and UNIT evidence for expired API keys

**File:** `docs/guides/ltiaas/operator-runbook.md:405`.

**Problem:** The single SIM label claims a stack check for both revoked and expired keys, although expiry is checked with a controlled clock in unit tests.

**Evidence:** AC-LA-E5-07-12 explicitly separates the revoked-key SIM case from the expired-key UNIT case; AC-LA-E5-07-06 also covers the Bearer expiry boundary with a controlled clock. The QA batch log `qa2-sim-4209dcb/logs/batch-2-r2.log` records AC-12's revoked-key check across the three schemes. This is a label correction, not a claim that expiry is untested.

**Suggested fix:** Split the sentence, or attach `[SIM E5-07-12]` to revocation and `[UNIT E5-07-12]` / `[UNIT E5-07-06]` to expiry.

### Verification and scope

- Private clean clone at `/tmp/la-e8-04-r1-review-b-xh0ln0vs/repo`, pinned to `b207706d358713bee7c4af44f15cbc8895928b35`, with its own `npm ci`. No Docker, stack or stack-starting runner ran.
- Exact `op`, `probe` and `tenant` helper bodies: **30/30 local fake-server cases passed** across bash and zsh, HTTP 200/204/401/429/503. Checked method, query path, JSON body, content type, authentication, printed status/body, failure exit status and absence of key values in output. `dc` was replaced by a local process shim; all keys were synthetic and HTTP was restricted to the owned loopback server. This does not verify Compose, mounted files or the task's SIM AC-01.
- Focused existing route tests: **19/19 passed in two files** (`http/operator/jobs.test.ts`, `http/operator/key-provider.test.ts`), with the private Vitest cache cleared before the run. Evidence: `/tmp/la-e8-04-r1-review-b-xh0ln0vs/job-routes.log`; helper evidence: `helper-probe.log`, `helper-results.json` and `helper-probe.py` in the same parent folder.
- All relative file links resolve. The alert and metric names from operability are present. Foreign-host verification and the stop-worker → enable-web-runner → start-web order satisfy the DOC checks in AC-02 and AC-05. AC-01 remains explicitly pending QA, as the draft states; there are no UNIT ACs in this documentation task and no product behavior to mutation-test.
- The author diff changes only the permitted new guide. No core paths, LMS-specific code, base operator guide or architecture file changed. Ownership is respected. This review changes only this Reviewer-B file; no other reviewer's file was opened.

Open findings: **0 BLOCKER, 1 MAJOR, 2 MINOR**. Approval waits for B-LA-E8-04-01.

## Round 2

Verdict: **APPROVE**. Reviewed `ce9b0b22`, merged as `c2326c9b`. **No open Reviewer-B findings.**

| Finding | Status | Evidence in `docs/guides/ltiaas/operator-runbook.md` |
| --- | --- | --- |
| B-LA-E8-04-01 (MAJOR) | Closed | Lines 567–599 and 833–855: `409` starts no run and returns to the POST after a wait. Only a `202` supplies the trace used for completion. Both procedures now cover a skipped lease, failure to start and missing completion output, with a retry path. Re-wrap completion still requires the system event and zero old sealed counts; removing a key also requires zero derived counts. The new log commands match the logger's JSON-lines output and the Compose log mount. |
| B-LA-E8-04-02 (MINOR) | Closed | Lines 323–343 split giving another operator a key from replacing one's own key. The first path retains the original key; the second checks the new key before revoking the old one and explains the self-revocation refusal. |
| B-LA-E8-04-03 (MINOR) | Closed | Lines 466–467 separate revocation from expiry and label expiry as UNIT with a controlled clock. The guide conservatively leaves other revocation schemes pending reconciliation of the QA report; the SIM log evidence noted in Round 1 remains available. |

Verification:

- Fresh private `git clone --no-hardlinks` at `/tmp/la-e8-04-r2-review-b-_d4hq8qo/repo`, pinned to `c2326c9b3c6412d2d07754df7ed5e4eb97b711c7`. Used only the host shell, Node built-ins and an owned loopback fake server. No dependencies were installed, and no Docker or stack ran.
- **144/144 helper cases passed** in bash and zsh using the exact revised helper bodies and a local `dc` shim. Coverage includes 13 damaged-key forms, missing files and directories used as files; valid keys with surrounding whitespace; HTTP success/error responses; retained error codes, fields, reasons and retry delay; non-JSON errors and echoed request keys; connection loss, interrupted bodies and thrown request errors; tenant URL fallback; and the intentional once-only output of a newly issued key. Bad key files send no request. Tested failures print fixed diagnostics without request-key values or fragments.
- The same embedded-newline checks against the pre-fix helpers fail in **all four cases** (two authenticated helpers × two shells), showing that the checks detect the old behavior. Evidence: `helper-review.py`, `helper-review.log`, `helper-summary.json` and `helper-results.json` in the private clone's parent folder.
- Both new log commands pass with isolated JSON-lines fixtures in both shells (**4/4**). All relative file links and local heading links resolve. Reviewed the changed labels against task/QA evidence and the BD-A2-105 notes against Compose, bootstrap/reset behavior and operability.
- The change remains confined to the permitted new guide. No product code, architecture, base guide or core LMS paths changed. There are no UNIT ACs for this documentation task. The task's command-by-command SIM verification remains QA work, explicitly pending in the guide; these local checks do not replace it.

Round 1 is preserved above. This round changes only this Reviewer-B report; no other reviewer's file was opened. Open findings: **0 BLOCKER, 0 MAJOR, 0 MINOR**.
