Verdict: APPROVE
Round: 2

# LA-E8-04 — Reviewer-A

## Round 1

Reviewer: Codex GPT-6-Astra xhigh, 2026-10-24. Lens: correctness and safety. Reviewed merge `b207706d` (Docs commit `c4efc406`), the 1,073-line runbook, task spec, operability and security design, contracts, relevant build decisions, implementation and cited QA reports. Product baseline: `02f5d420`; private review clone: `63390b8b4d371ffc3b5339b2d493ac15e2c193c9`.

Two findings: **1 BLOCKER, 0 MAJOR, 1 MINOR**.

### A-LA-E8-04-01 — BLOCKER — HTTP helper errors can print the credential

- **File:** `docs/guides/ltiaas/operator-runbook.md:70`; also `:67`, `:83` and `:86`.
- **Problem:** `op` and `tenant` pass an unchecked file value into `Authorization` and leave the rejected `fetch` promise uncaught, so a malformed key file can expose the complete operator or tenant key on stderr.
- **Evidence:** Extracted the exact helpers and exercised them in bash and zsh with synthetic credentials, a local fake HTTP server and a `dc` shim; no Docker or real secret was used. A valid-format key followed by `\nsecond-line` survives `.trim()`. Both helpers exit 1 and Node 24.21.0 prints `TypeError: Headers.append: "OPERATOR-AUTH-V1 [KEY]\nsecond-line" is an invalid header value` (or `Bearer [KEY]`). All four shell/helper cases contained the complete synthetic key in captured output; all made zero requests. This can occur during the manual key-file replacement in §§4 and 6. The intentional one-time display of a newly issued key is not this finding.
- **Suggested fix:** Validate the trimmed credential against its complete expected format before constructing headers. Handle file, request and response-read errors with a fixed safe message and a nonzero exit; do not print the raw exception or its cause. Add a fake-server check that malformed credentials cannot appear in stdout/stderr. A private validation-only variant rejected all four cases without outputting the canary or making a request.

### A-LA-E8-04-02 — MINOR — Some evidence labels cite a different check or overstate its level

- **File:** `docs/guides/ltiaas/operator-runbook.md:989`; also `:990`, `:993`, `:995` and `:405`.
- **Problem:** These labels do not support the stated behavior at the claimed verification level, contrary to the label definition in §0.1.
- **Evidence:** The current `docs/reviews/LA-E6-01/qa.md` Round 2 table assigns invalid-client and unchanged-status checks to **AC-02**, rate limiting to **AC-03**, and log redaction to **AC-08**. The runbook instead cites AC-03 for invalid-client/unchanged status and AC-08 for rate limiting. The QA AC-02 row explicitly identifies the unreachable-JWKS check as a **unit** check, but line 990 labels it SIM. Line 405 likewise calls expired-key rejection SIM, while `tests/ltiaas/tasks-ops/LA-E5-07/api-keys.test.ts:591` tests revoked keys only; the E5-07 spec assigns expiration to a controlled-clock unit check. That task's current QA report also has no explicit AC-12 row.
- **Suggested fix:** Correct the E6-01 numbers and label the unreachable-JWKS assertion UNIT. Split revoked-key and expired-key evidence, citing an actual QA row for each; where the QA report has no matching row, use Pending verification until QA supplies one. Reconcile labels against QA reports and their named tests rather than copying task AC numbers alone.

### Verification and scope

- **DOC AC-02:** Passed. §10.5 requires the LMS administrator's confirmation that the vendor issued the client id for this issuer at that token host before `--confirm-foreign-hosts`.
- **DOC AC-03:** The runbook includes all 20 designed alerts, all 20 LTI metric names, all 8 app metric names and the key log-event groups, with meanings and first actions.
- **DOC AC-05:** Passed. §12.2 gives stop worker → set `APP_JOB_RUNNER=on` → start web, with the production `job_runner_twice` refusal.
- **K1-SIM AC-01:** Pending, as the draft states. Host-only helper probes do not establish container, simulator or production behavior. No UNIT acceptance criterion belongs to this documentation task.
- **Helper probes:** 16 normal/error HTTP cases passed across bash and zsh, checking methods, paths, bodies, authorization schemes, exit codes and absence of credentials in output. Four malformed-file cases reproduced A-01; four private validation variants rejected them safely. Requests were restricted to one loopback fake server. No stack, host stack runner or Docker command ran.
- **Ownership:** The reviewed merge changes only the permitted new runbook. It does not change the base operator guide, architecture, product code, core LMS names or tests. This review changes only this Reviewer-A file; no Reviewer-B file was opened and no commit was made.

Private evidence: `/tmp/la-reviewer-a-ctx-b5946b98f099-probes/` (`helper-probe.py`, `helper-hook.cjs`, `helper-results.json`); citation inventory: `/tmp/la-reviewer-a-ctx-b5946b98f099-evidence.json`. The isolated `--no-hardlinks` clone used its own `npm ci`; no Vitest run was needed for this documentation change.

## Round 2

Reviewer: Codex GPT-6-Astra xhigh, 2026-10-24. Reviewed fix `ce9b0b224aff17c4f54dba03e7a6b292ea5b35a2`, the revised commands and job recovery steps against the implementation, and the evidence-label changes. **APPROVE: 0 BLOCKER, 0 MAJOR, 1 MINOR open.**

### Round 1 dispositions

- **A-LA-E8-04-01 — closed.** Both authenticated helpers validate the full key format before creating headers, suppress raw file/request/answer exceptions, and filter error responses. The exact original newline case now fails safely in both shells for both helpers. All **98 current-revision checks passed**, with zero credential leaks; **4 prior-revision probes** reproduced the original leak. Checks covered 11 malformed-key forms, unreadable files, a valid trailing newline, normal and accepted responses, busy/not-ready/validation errors, echoed credentials, malformed JSON, a dropped response and request failure. Successful key-issuance output remains an explicit one-time exception.
- **A-LA-E8-04-02 — closed.** The E6-01 labels now match the QA cases; unreachable JWKS is UNIT. Revoked Bearer-key evidence is separate from expiration's controlled-clock unit evidence, and the missing multi-scheme QA row is marked pending. The revision also clarifies mixed QA ranges and marks unverified metric claims pending.

### A-LA-E8-04-03 — MINOR — Re-wrap recovery omits a failed job with no end event

- **File:** `docs/guides/ltiaas/operator-runbook.md:581`.
- **Problem:** When no `system:key-rewrap` event exists, the recovery table has no action for a `job_run` line with `result: failed`.
- **Evidence:** `services/lti-service/src/jobs/key-rewrap.test.ts:217` verifies that a failed final audit insert leaves no end event and throws. `packages/shared/src/jobs.ts:497` catches that job exception, emits `job_run` with `result: failed`, and resolves the run result. Thus the route's rejected-promise handler does not emit `key_rewrap_failed`. The new table covers only `skipped_lease`, `key_rewrap_failed`, and no line. The general job section already covers failed runs, but directs re-wrap users back to these steps.
- **Suggested fix:** Add a failed-job row, or link it to §12.1's failed-run action: keep the key versions, inspect the trace, retry once, and start an incident if it fails again. This is nonblocking because the explicit completion and key-removal conditions still prevent removal without a successful end event and zero remaining counts.

### Verification and limits

- Revised `409` paths correctly start nothing and return to the request step; subsequent checks use the caller's accepted trace. Re-wrap completion requires both its system end event and zero old sealed counts. Operator-key issuance and replacement are separate, with self-revocation protection retained. BD-A2-105 settings and file-copy notes match the compose configuration and wrapper.
- **42/42 focused unit tests passed:** `services/lti-service/src/jobs/key-rewrap.test.ts` and `packages/shared/src/jobs.test.ts`, including the audit-write failure and runner error behavior. The private clone was `c3099f899e44b055d63220c76898bca057a8db2d`, made with `--no-hardlinks` and its own `npm ci`; the Vitest cache was removed before the run. Its tracked tree is clean.
- The helper probes used only synthetic credentials and one loopback fake server. No Docker, stack or host stack runner ran. **AC-LA-E8-04-01 remains pending QA's simulator command check.** The DOC requirements and ownership checks from Round 1 remain satisfied; the fix changes only the permitted runbook. No Reviewer-B file was opened and no commit was made.

Evidence: `/tmp/la-reviewer-a-ctx-280decd20681-probes/` (`check.py`, `hook.cjs`, `results.json`, `summary.json`) and `/tmp/la-reviewer-a-ctx-280decd20681-focused-unit.log`.
