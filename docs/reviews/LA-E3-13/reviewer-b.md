Verdict: APPROVE
Round: 1

## Round 1

Reviewer-B: Codex GPT-6-Astra xhigh. Lens: can a human team own it?

Reviewed `ea10149`, integrated by `84d5679`, against the task, LA-ADR-05 D3e, contract delta §4.2 and plan §6.1. Verification used a private `git clone --no-hardlinks` pinned to integration commit `0245e4c`. No other reviewer's report was read.

### Findings

None. Counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.

### Review evidence

- One short helper enforces the required fields after the existing type allowlist and `accept_types` checks. Its comment names the rules and design source. The dedicated HTTPS check explains why fragments are valid here. The `ltiResourceLink` path and its default URL remain separate and unchanged.
- Refusals use the existing `400 INVALID_CONTENT_ITEM` error and name the zero-based item index, item type and missing or invalid field. A second-item failure is tested, so the index cannot silently become a constant zero. The message gives a tool developer enough information to repair the request.
- UNIT AC-01 has missing, HTTP, null, non-string, malformed and wrong-scheme URL cases, with file and image cases too. UNIT AC-02 has missing, null and non-string HTML cases. Positive tests preserve all four item types, including an HTTPS fragment and an empty HTML string; existing resource-link behavior and validation order are checked.
- Restoring only the pre-task `deep-linking.ts` while keeping the new tests produced **14 expected failures and 21 passes**: all 10 URL refusal cases and all 4 HTML refusal cases failed because the old code accepted the items. The source was restored and the clone was clean.
- `vitest run services/lti-service`: **83 files, 1,070 tests passed**. Root `npm run typecheck`, focused ESLint, F1 and all 6 F5 rules passed. F1 emitted existing baseline-reduction notices only.
- The diff is limited to the lane L2 file and its colocated author unit tests. No other product file, QA-owned test, LMS-specific branch or behavior outside the task was added.

This is source and unit approval. K1-SIM AC-03/04 and the specified T3a/T3c regression evidence remain QA work; the unit checks do not replace those runs. No Docker, stack or host stack runner was used.
