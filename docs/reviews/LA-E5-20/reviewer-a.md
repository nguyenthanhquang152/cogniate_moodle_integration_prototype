Verdict: CHANGES_REQUESTED
Round: 1

# LA-E5-20 review: Reviewer-A

## Round 1

Reviewer: Codex GPT-6-Astra, xhigh. Lens: “Is it right and is it safe?” Reviewed `95036a9`, `14287ee`, `ce47f03`, `805b897` and `ca75c68` in merge `2a15f5b`, against the task spec, LA-ADR-06 D2/D7/D11, contract delta §3/§5, BD-A2-65–70 and plan §6.1. Blind review; no Reviewer-B file read.

**Verdict: CHANGES_REQUESTED. Open counts: 0 BLOCKER, 2 MAJOR, 0 MINOR, 0 NIT.**

### A-LA-E5-20-01 — MAJOR — publication is backdated to the start of the whole rotation run

- **Where:** `services/lti-service/src/jobs/signing-key-rotation.ts:49`, `:69` and `:75`; the later activation trusts that time at `:55–59`.
- **Problem:** The job captures `now` once before processing any account. It passes that time to `createNextToolKey` after asynchronous RSA generation and sealing, so `published_at` precedes the moment the new key enters the database and JWKS. The difference includes preparation of every earlier account. A subsequent automatic or unforced operator activation can therefore pass the lead-time check before the required publication interval has elapsed. Passing `force: false` does not help because the stored publication time is wrong. This breaks D7 and BD-A2-68's publish-before-activate rule.
- **Evidence:** A private controlled-clock probe starts with a 90-day-old active key and a 600-second lead. Key preparation advances the clock by one second. The new key is stored with `published_at = run start`, although it appears one second later. Another job run 599 seconds after the actual insert activates it (`activated: 1`, status `active`), where it must remain `next`. This requires no clock reversal. Longer preparation or a larger batch widens the missing interval.
- **Suggested fix:** Read the clock at the actual synchronous key write, after preparation, and use that time for publication. Use current per-account time for decisions and activation/retirement timestamps as well. Add a test that advances time during preparation and checks just before and at the real publication deadline. A private control using `ctx.now()` at insertion makes this probe pass.

### A-LA-E5-20-02 — MAJOR — a stale account list can rotate an account after auto-rotation is disabled or the account is suspended

- **Where:** `services/lti-service/src/jobs/signing-key-rotation.ts:70–75`, `:44–49` and `:55–59`.
- **Problem:** Eligibility (`auto_rotate = 1`, `status = 'active'`) is checked only when the whole account list is selected. The loop awaits key preparation and audit calls, so operator changes can occur before a later account is processed. The write guards call `requireWritableAccount`, which refuses a closed account but permits a suspended one and does not check `autoRotate`. A waiting key can thus become active after an acknowledged PATCH disables automatic rotation or suspends the account. This violates the stored opt-in and BD-A2-68's active-account rule; disabling rotation to preserve an inline-key install may still change its active key.
- **Evidence:** Two private probes use accounts `a-first` and `b-second`, both opted in with 90-day-old active keys. The second already has a mature `next` key. During preparation for the first, the probe calls the real account store to set the second to either `autoRotate: false` or `status: 'suspended'`. The job then activates the second account's waiting key in both cases (`activated: 1`, expected `0`). Two further probes change the current account during its own preparation; it still gets a new `next` key.
- **Suggested fix:** Re-read eligibility when processing each account and after asynchronous preparation, with the final eligibility check and key mutation in the same transaction. An ineligible account should be skipped without a signing-key mutation or success event. Add the two-account activation cases, as well as a change during preparation. Private controls that re-check eligibility make all four probes pass.

### Checks that passed

| Area | Evidence |
| --- | --- |
| Purge isolation and retention | The shipped test seeds all ten tenant tables for old-closed, new-closed and active accounts. Only the eligible tenant is removed; tombstone and audit rows stay; counts cover every table; a second run adds no event. A private audit-insert failure rolls back every deletion and emits no success log; retry then succeeds. |
| Manual job runs | Auth, known-name lookup, inactive-runner `503` with no event, unknown-name `404` with a null audit target, held-lease `409`, and accepted trace propagation pass. A private pair of concurrent HTTP requests against a real deferred job produces one `202`, one `409`, one execution and the corresponding audit results. |
| Expiry and cleanup | Controlled-clock tests cover the 13/15-day warning boundary, revoked-key exclusion, and deletion at the 24-hour idempotency cutoff while preserving younger/running records. Logs contain identifiers/counts, not credentials. |
| Normal rotation and settings | Day 82/83/89/90, a late next key, default manual mode, suspended accounts present before the run, configuration validation, migration defaults and audited PATCH all pass. The missing cases are state/time changes during a run, described above. |
| UNIT acceptance criteria | AC-03 through AC-06 have tests. Seven mutation controls are detected: held-lease check removed, expiry window widened, cleanup/purge cutoffs moved, rotation age advanced, lead bypassed, and default opt-in ignored. |
| Ownership and scope | Account-store/migration edits are authorized by BD-A2-65 and the spec's B3 note. No `store/tool-keys.ts`, `store/api-keys.ts`, shared runner, QA `tests/**` or LMS-name branch was changed by these commits. Existing Must jobs remain registered. |

### Verification

- Tests and probes ran in a private `git clone --no-hardlinks` at `c2dd31d`, which contains the reviewed merge. The initial focused run passed 170 tests in 18 files, including the separate LA-E5-16 regression probes. The final combined selection, including the AGS preflight suite and the purge/concurrency probes, has 196 passing tests and the five failing rotation probes in 19 files; all failures are the cases described above.
- LTI-service TypeScript and ESLint on all 22 TypeScript files changed by the two review items and the lane-L preflight export pass. All ten mutation controls across both review items are detected and restored. Temporary rotation controls pass all eight shipped/probe tests and were also restored.
- Probe sources and logs are preserved under `/tmp/la-review-a-e520-16.IVkLrG/`, notably `review-rotation.test.ts`, `additional-probes.log`, `rotation-control-fixes.log` and `mutants-summary.log`.
- Only this review file was edited in the integration worktree for this item. No Docker, stack, host stack runner or commit was used. K1-SIM AC-01/02 and R0 stack evidence remain with QA; the two rotation findings need an author fix and another review.
