Verdict: APPROVE
Round: 1

## Round 1

Reviewer-B: Codex GPT-6-Astra, xhigh. Date: 2026-10-23. Lens: Can a human team own it?

Reviewed `5bdf79d`, `cc6d2f1`, `dc92a78` and `f45e528` against LA-E5-12, LA-ADR-07 D4–D5, LA-ADR-06 D4, app API delta §7, plan §6.1 and the ownership matrix. Tests and probes ran in a private `git clone --no-hardlinks` at integration SHA `fa7bf0a`. No other reviewer's file was opened.

### B-LA-E5-12-01 — MINOR — Reject unsupported evidence flags on revoke

**Files:** `services/cogniate-app/src/cli/grant.ts:18` and `:38`.

**Problem:** Revoke accepts the evidence flags in the common argument parser, then silently drops their values. An operator can leave the command believing that a ticket reference was recorded.

**Evidence:** BD-A2-63 and the task design notes say that revoke does not parse these flags. A real Node process in the private clone, with production policy and a stored grant, accepted `revoke --grant <id> --operator qa-op --evidence-channel invalid-channel --evidence-ref CASE-123`. It exited 0 with `revoked`; its one audit event had only `details: {note_present:false}`. The parser therefore accepts even an invalid evidence channel without a warning. The policy itself correctly allows revoke with only an operator.

**Suggested fix:** Select argument options by command, or return a usage error when revoke receives either evidence flag. Keep operator-only revoke valid. Add a process test that unsupported flags cannot be silently discarded. This is safe to defer: the documented operator-only command works and the access removal and its audit event remain correct.

### Review checks

- The policy runs before each mutation. The supplied refusal line passes through unchanged. A private real-process probe without `--operator` exited 1, wrote exactly one JSON line to stderr, wrote nothing to stdout, and stored no audit event.
- Audit writes for issue, revoke, suspend and release share the local transaction. The small optional callback in the authority interface makes the transaction boundary clear without teaching the authority layer about CLI audit fields.
- Each event carries the connection id, operator, target, result and `note_present`. Full notes and grant codes stay out of event details. Known-target refusals use the app API §7 codes; unknown targets, policy failures and LTI lookup failures do not invent audit events. Remote cleanup follows the documented local-commit boundary.
- UNIT AC-08 has SQL-trigger tests for failed local writes across all four commands and for an audit-insert failure. Replacing only `operator.ts` with its pre-`cc6d2f1` version made both AC-08 tests fail. Restoring the reviewed version made both pass. The tests therefore detect the old behavior.
- Changes follow lane K and its dispatched authority/cleanup grant. The task's protected audit writer, policy, audit CLI and migration files were not edited. No `tests/**` edit or new LMS name in core paths was found. F1 and F5 pass; F1 reports existing baseline reductions.

### Validation and limits

The focused app command passed **61 tests in 4 files**:

```sh
./node_modules/.bin/vitest run services/cogniate-app/src/app/operator-audit.test.ts services/cogniate-app/src/app/operator.test.ts services/cogniate-app/src/app/operator-policy.test.ts services/cogniate-app/src/app/binding-cleanup.test.ts services/cogniate-app/src/app/audit.test.ts services/cogniate-app/src/kernel/authority --maxWorkers 2
./node_modules/.bin/tsc --noEmit -p services/cogniate-app/tsconfig.json
```

Vitest selected the operator-audit, operator-policy, audit and kernel authority suites. Type checking passed. Probe and mutation evidence is in `/tmp/la-review-b-5571a303f6ee/reviewer-b-cli-probe.mjs`, `reviewer-b-cli-probe.log`, `reviewer-b-old-operator.log` and `reviewer-b-restored-operator.log`.

Only this review file was changed for this item. No Docker or stack runner was used. K1-SIM and the M1 binding regression remain QA gates. Open findings: **1 MINOR; 0 BLOCKER or MAJOR**.
