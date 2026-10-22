Verdict: APPROVE
Round: 1

## Round 1

Reviewer-B: Codex GPT-6-Astra xhigh. Lens: can a human team own it?

Reviewed `8ea9ac6` and the L2 fixture change `a6ea71e`, integrated by `a2dfc04`, against the task, LA-ADR-05 D10, LA-ADR-07 D8 and plan §6.1. Verification used a private `git clone --no-hardlinks` pinned to integration commit `0245e4c`. No other reviewer's report was read.

### Findings

**B-LA-E3-12-01 — MINOR — Document the new audience refusal and its repair.**

- **Location:** `services/lti-service/src/lti/checks.ts:128`; `docs/architecture/ltiaas/contracts/lti-service-api-delta.md:297`; `docs/guides/troubleshooting.md:70`.
- **Problem:** An operator can distinguish the new refusal in the log, but the support guide does not explain how it relates to `trustedAudiences`. A team must read source or the unit tests to learn the exact-match and PATCH replacement rules.
- **Evidence:** Check 5 emits `INVALID_ISSUER_OR_AUDIENCE` with `detail: aud_untrusted`; the protocol route records this in `launch_check_failed`. No guide mentions that detail or `trustedAudiences`. The contract row states the default and purpose, but gives no PATCH example or clearing rule. The API tests prove that PATCH replaces the list, an unrelated patch preserves it, and `[]` clears it.
- **Suggested fix:** A1/Docs should add a short troubleshooting entry and an authenticated platform PATCH example. Connect the trace id and log detail to an extra audience; explain exact string matching, list replacement and clearing. Keep the client id and `azp` requirements explicit. No learner-page change is needed. This is a documentation follow-up, not a blocker for the scoped implementation.

Counts: 0 BLOCKER, 0 MAJOR, 1 MINOR, 0 NIT.

### Review evidence

- Each rule has one clear location: score parsing in `platform/ags.ts`, version negotiation in `platform/nrps.ts`, audience validation in check 5. The storage and platform API follow their existing patterns. No new LMS branch or name was added to core behavior.
- UNIT AC-04 is covered through POST, GET, list and PATCH for standard and fixed profiles; default and invalid list shapes; replacement, preservation and clearing; account isolation; and migration of a real pre-018 database with a historical row, preservation of old fields and persistence after reopen.
- Supporting unit checks cover null versus absent scores with and without a maximum, score zero, NRPS rejection before outbound calls, absent/supported versions, exact trusted extras, required client audience and `azp`, and the existing single-audience path.
- Against the unchanged new tests, restoring only the pre-task rule sources caused 8 expected failures; restoring only the old API source caused 3; restoring only the old store source caused 2. These were behavior assertion failures. All temporary source changes were restored, and the clone was clean.
- `vitest run services/lti-service`: **83 files, 1,070 tests passed**. Root `npm run typecheck` and focused ESLint on the changed TypeScript files passed. F1 passed with only existing baseline-reduction notices; F5 passed all 6 rules with 0 hits, including SQL portability.
- Ownership is respected: lane L product files, migration 018 and colocated author unit tests; the cross-lane `idtoken.test.ts` fixture is the explicitly dispatched L2 RQ-2 change. The named forbidden files and `tests/**` were not edited by these commits.

This is source and unit approval. K1-SIM AC-01/02/03/05, the specified service regression lane, and the QA-owned LA-IC-13 test-change-list approval remain separate gate evidence. No Docker, stack or host stack runner was used.
