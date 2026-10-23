Verdict: APPROVE
Round: 1

# LA-E3-07 review: Reviewer-A

## Round 1

Reviewer: Codex GPT-6-Astra xhigh, lens "Is it right and is it safe?" Date: 2026-10-23. **Counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**

Reviewed `a390edb` (merge `dc98c43`) against the task, LA-ADR-05 D4/§5, LA-ADR-04 D8 LA-IC-04 and plan §6.1. No findings.

- **Scope requests:** the three baseline manifests contain exactly the four AGS URLs in the required order. A private probe loads the real app registry and confirms the same for all five current channels, then passes each list through the LTI registration-request builder: the resulting `scope` contains those four URLs and no NRPS. The existing app route passes the selected channel's capability through `completeRegistration`; the changed route test checks its actual complete-call body. No app or channel product code calls memberships or retains the NRPS scope URL. The LTI service's five-scope default for callers that omit `scopes` remains as D4 requires, and its NRPS endpoint is untouched.
- **LA-IC-04 boundary:** compared the serialized generated responses with the parent commit using identical inputs. For both Canvas JWK forms, removing only NRPS from the old `scopes` makes the full response identical, including headers and key fields. For Moodle, replacing only row 13's value makes all 16 serialized rows identical. The three manifest diffs change only `registration.scopes` and comments.
- **Tests detect the change:** restoring the five pre-change product files causes exactly five committed tests to fail: both Canvas JWK forms, the pinned Canvas export, Moodle row 13 and the Moodle complete-call scopes. Restoring the implementation returns all **53/53** affected tests to green. The additional registration-builder suite and four private probes pass **23/23**. App and channel-node type checks pass; **F1 passes with 0 files with hits and 0 hits**.
- **Ownership:** the Canvas JSON lives in the dispatched `app/configuration.ts` implementation rather than the task's older `app.ts` path. Other edits stay in the named K files and adjacent unit tests. No LTI-service product file, LTI profile, portal file, QA-owned test or unrelated core branch changed.

The task has no UNIT-tagged acceptance criterion; the adjacent tests and private probes support the K0/SIM criteria without claiming live verification. QA still owns the LD-9 LA-IC-04 expected-delta record and reviewed frozen-test list, K1-NRPS/token-request observation, Moodle option-label and tool-record checks, and the listed regression runs.

Verification used fresh private clone `/tmp/la-review-a-641e702fbeae` at `79f5d17b150613d5bc37ff71976ed0a913c8b596`, with its own `npm ci` and a deleted Vitest cache before every run. Evidence: `reviewer-a-focused.log`, `reviewer-a-byte-probes.log`, `reviewer-a-old-values.log`, `reviewer-a-restored.log`, `reviewer-a-typecheck.log`, `reviewer-a-f1.log` and `reviewer-a-probes/`. All tracked mutations were restored. Only this review file was written in the integration worktree; no Docker, stack, stack-starting runner, commit or other reviewer's file was used.
