Verdict: APPROVE
Round: 1

# LA-E8-03 admin guides — Reviewer-A

## Round 1

Reviewer: Codex GPT-6-Astra xhigh, lens A: "Is it right and is it safe?" Reviewed merge **`985f8f6f`**, the three guides, product source at **`02f5d420`**, the task spec, app API delta, channel manifests/READMEs, plan §6.1 and the cited QA reports. Blind review; no Reviewer-B file read.

**Findings: 0 BLOCKER, 0 MAJOR, 2 MINOR, 1 NIT.** The setup and approval paths are supported. The findings below can be deferred under charter §5; approval does not close the guide-specific QA comparisons still marked pending.

## Verification and scope

- Compared all **8 generic and 9 Brightspace tool rows**, including keys, order, labels and values, with the kernel admin-value adapter and Brightspace manifest. They match. Generic scopes are the four AGS scopes in the implemented order. Brightspace domain uses the public LTI URL's host, including a non-default port.
- All **five** Brightspace wizard defaults match the manifest and the K2 E7-07-02/03 evidence: issuer plus four D2L defaults. The spec's wording "four" does not justify removing the issuer default. The D2L fact statuses and live-test limits agree with the channel README.
- The staged result text matches `tool-pages/register.ts:186-188`. Manual and staged generic/Brightspace bindings use the correct fields and approval path. Canvas remains staged with `operatorGrant`; a normal fixed-endpoint grant is required, and `--accept-staged` is refused. The hosted configuration-URL warning agrees with the pre-fetch floor and E3-09-05 evidence.
- The baseline file preserves the M1 guides and maps the listed LA changes to QA evidence. It distinguishes simulator, unit and pending real-Moodle checks. E7-07 round 3 supports the new-channel browser flows and frame-storage claims. The guides require private delivery of approval codes and do not ask an admin to disclose a private key, access token or client assertion.
- Checked all **25 distinct local link targets** at the merge; each exists. This was a source and evidence review, not a new stack or browser run. No UNIT acceptance criterion belongs to E8-03; AC-01 and AC-05 still need the stated QA comparison at the wave-end SHA.
- The merge changes only the three permitted guide files. No base guide, product source, test or core LMS-name path changed. STE is suitable overall. No Docker, install, host stack runner or commit was used.

## Findings

### A-LA-E8-03-01 — MINOR: some troubleshooting rows quote an API or earlier-path message as the current page text

- **Where:** `docs/guides/ltiaas/lti-generic-admin.md:30,174,176`; `docs/guides/ltiaas/brightspace-admin.md:168`.
- **Problem:** an administrator can receive a different error from the one the guide tells them to recognize.
- **Evidence:** with Brightspace Dynamic Registration loaded, a `desire2learn` registration can pass start and fail generic completion. The cited E2-05-05 test explicitly checks the resulting **502 `REGISTRATION_FAILED`** page (`tests/ltiaas/tasks-core/LA-E2-05/brightspace.k1sim.test.ts:324-351`); `tool-pages/register.ts:172-182` maps the failed completion to that app code. The provider-mismatch page is the earlier start-refusal branch, not a guaranteed result for the documented current flow. Separately, ordinary `PLATFORM_IN_USE` in the generic/Brightspace wizard uses `apps/portal/src/connect/provider-errors.tsx:13,46-51,85-89`: "This LMS tool registration is already connected to Cogniate. Make a new tool registration for this library." The guides instead quote the longer API description ending "or ask your Cogniate operator." The staged-gone description is correctly preserved because it has `details.reason`.
- **Suggested fix:** distinguish start refusal from the current completion-page failure, keep the instruction to use the Brightspace card, and quote the actual portal collision text. Keep asking the operator as separate recovery advice. Do not change product error handling for this documentation fix.

### A-LA-E8-03-02 — MINOR: the new approval-request lists omit the intended library and connection

- **Where:** `docs/guides/ltiaas/lti-generic-admin.md:125-131`; `docs/guides/ltiaas/brightspace-admin.md:110-116`.
- **Problem:** the listed LMS values alone do not tell an operator which pending Cogniate connection the institution is approving.
- **Evidence:** the existing Canvas request includes the Cogniate library and connection name (`docs/guides/canvas-admin.md:78-81`). The operator check matches both before issuing a grant (`docs/guides/operator.md:49-53`), and the CLI requires `--library` and `--connection`; `app/operator.ts:149-158` resolves that exact connection and checks its library. The new guides list only the LMS site and registration values. An operator serving several libraries must ask for the missing context before issuing.
- **Suggested fix:** add the Cogniate library and connection name, and a connection identifier or portal link if available, to both methods' request lists. Ask the library user to supply these details. Preserve the private approval-code delivery rule.

### A-LA-E8-03-03 — NIT: evidence labels are not attached consistently to the steps they support

- **Where:** `docs/guides/ltiaas/lti-generic-admin.md:64-66,140-150,166`; `docs/guides/ltiaas/brightspace-admin.md:58-60,125-145`; `docs/guides/ltiaas/baseline-admin-changes.md:53-56,87-89`.
- **Evidence:** several create, field-entry and Save steps lack their own QA label or an explicit range-level label, although the cited K2/SIM reports support those flows. In addition, generic line 166 cites **E6-01-03** for unchanged connection status; that criterion tests the 60-second rate limit. **E6-01-02** checks unchanged status, and **E6-01-09** covers panel visibility.
- **Suggested fix:** put the existing supporting labels on each step or state explicitly which step range they cover; mark unverified LMS-side steps pending. Correct the health-panel citations. No new test harness is needed.

Only this review file was written in the integration worktree. AC-LA-E8-03-01 and -05 remain pending QA comparisons; no real-LMS verification is claimed.
