Verdict: APPROVE
Round: 2

## Round 1

Reviewer: Codex GPT-6-Astra, xhigh, 2026-10-23. Lens B: can a human team own it? Scope: `90d1207`, `f7e0e9c`, `b0fed78`, `e58cf6e`, `f4545c7`, and `06cf4ca` (merge `c62b373`), tested at `148d6cc79d65b1a67fa053273075a6a58dcffd2b`. Read the task spec, LA-ADR-06 D6/D12, operability §2/§6.3, security delta §10, BD-A2-91, LA-ADR-01 D5, ownership matrix §5, and plan §6.1. No Reviewer-A file was opened.

One MINOR finding. No blocking findings.

### B-LA-E5-22-01 — MINOR — Add the required app rewrap collision regression

**File:** `services/cogniate-app/src/app/sealing-start.test.ts:52` (related implementation: `services/cogniate-app/src/app/sealing.ts:189`).

**Problem:** The task's design notes require a test that rewraps a legacy blob whose bytes resemble a version header, but the app rewrap tests use ordinary legacy blobs only. The shared provider tests prove that such a blob opens; they do not prove that the app rewrap loop processes it instead of skipping it as already current.

**Evidence:** In the private clone, I inserted an early skip when `blobKeyVersion(row.blob) === active`. All **17 existing tests** in `sealing.test.ts`, `sealing-start.test.ts`, and `cli/keys.test.ts` still passed. A private fixture with a valid legacy GCM blob whose IV looks like a `cgk1` header for active version `k2` passed against the submitted code and failed against that mutation: the blob remained in legacy format. The submitted use of `openWithMetadataSync` is correct; this is a regression-test gap, safe to defer.

**Suggested fix:** Add that fixture to the app rewrap suite. Check the changed blob with authenticated metadata (`version: k2`, `legacyFormat: false`), unchanged plaintext, and the rewrapped count. Restore the early-skip mutation once to confirm the new test fails.

### Checks and scope

The operator path is understandable. The settings name the hidden key folder and mode, require the retained `legacy` key, and refuse a mismatched master key or a production environment key. The CLI distinguishes a missing version from a changed row, reports counts and a trace, and gives the retry action. Its audit event records the operator, active version, outcome, counts, and trace without secret values. Status includes versions still referenced by short-lived picker rows. The runbook identifies the ring and commands; the app's continued legacy support is explicitly in scope.

The implementation keeps the key-provider integration in one module and lists the four sealed columns with their row keys. The ref uses its hash; service keys and picker ltiks use their stored row identifiers; the extension port gets its library and connection from the bound context. The runtime MAC deliberately retains `legacy`. The web, worker, and CLI bind the provider at start, and readiness reports `key_version_missing`.

UNIT coverage addresses AC-02 (versioned and legacy values), AC-03 (another library, row, or column cannot open a new blob), AC-04 (the old runtime-token golden), and AC-05 (file/environment equivalence and refusal rules). The header, row-binding, and file-setting assertions distinguish the old behavior; the golden deliberately preserves it. A second private probe confirmed that making `k2` active leaves the runtime-token golden unchanged.

Verification used `/tmp/la-review-b-7a77b4a24ab3`, a fresh `git clone --no-hardlinks` with its own `npm ci`; the Vitest cache was removed before every run. **218 tests passed across 16 files**, including sealing, config, CLI, readiness, ports, connections, launch/picker, AGS, and real web/worker process tests. App and channel Node typechecks, ESLint on the 29 changed source/test files, F1, and all **three** static compose-secret tests passed. Both private probes passed. Four actual CLI processes using synthetic production key files passed the status, rewrap, missing-operator refusal, and usage checks; none printed key bytes. The collision mutation was restored; no product mutation remains.

The B4 app edits and named RQ-2 infrastructure/driver/readiness edits respect the dispatch. No protected shared key-provider or LTI-service file changed, and no production core LMS name was added. Upgrade route U1, the Moodle course-shell call, full R0, and the required stack regressions remain with QA. No Docker, stack, or commit was used. Only this review file changed in integration.

## Round 2

Reviewer: Codex GPT-6-Astra, xhigh, 2026-10-23. Lens B: can a human team own it? Scope: `051ae4c8` (merge `760b4e77`), tested at `cc984ad7251d5ee2a2d887e73ea2f8ff89ca6377`. Reviewed against the task spec, BD-A2-97, LA-ADR-06 D6, operability §6.3, ownership matrix §5, and plan §6.1. No Reviewer-A file was opened.

**APPROVE. No new findings; B-LA-E5-22-01 is closed.**

The new collision fixture in `services/cogniate-app/src/app/sealing-start.test.ts:67` checks the structural header, authenticated legacy metadata, rewrapped count, final version and format, unchanged plaintext, and a second no-op run. Restoring the early skip from Round 1 makes this test fail: `rewrapped` is 0 instead of 1. This closes the regression gap with a test of the actual app rewrap loop.

The missing-version rule is small and shared in `app/sealing.ts:83`. Both callers use the same classification. The AGS branch returns `retryable` with `uncertain: false` before any send; the message says that Cogniate will retry and supplies the trace for the administrator. The connection DTO removes only the affected row's URL and expiry, and renewal makes a usable ref with the running ring. Tests cover the missing version, an unbound handle, an unrelated error, and authentication failures. Authentication failures retain the hard-failure path.

The CLI header, usage answer, and successful or failed rewrap output state the same order as the runbook: write the ring, restart the app, check `/readyz = 200`, then rewrap. The runbook explains the retry and absent-URL symptoms if that order is reversed. The error classification and recovery instructions are clear enough for an operator to act on.

Verification used fresh private clone `/tmp/la-review-b-81576a3bf90e` with its own `npm ci`; the Vitest cache was removed before every run. **87 tests passed across seven files**, covering sealing, connections, CLI, AGS, connection state, and readiness/metrics. App typecheck, ESLint on all eight changed files, and F1 passed. Restoring the three prior connection, AGS, and CLI implementations produced **eight expected assertion failures**; the collision mutation produced one. All temporary changes were restored, and the clone is clean.

The existing UNIT AC coverage remains intact. Changes respect the B4 ownership window and BD-A2-97; no protected shared-provider or LTI-service file changed, and no production core LMS name was added. Stack acceptance and regression evidence remain with QA. No Docker, stack, or commit was used; only this review file changed in integration.
