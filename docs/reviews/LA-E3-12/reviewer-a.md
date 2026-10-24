Verdict: APPROVE
Round: 1

# LA-E3-12 — Reviewer-A

## Round 1

Reviewed `8ea9ac6` and the L2 fixture change `a6ea71e` against the task spec, LA-ADR-05 D10, LA-ADR-07 D8, contract delta §4.3/4.4/4.6, LA-IC-13 and plan §6.1. Lens: correctness, tenant isolation and data integrity. Blind review; no Reviewer-B file read.

### Findings

None. Counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.

### Checks

- Check 5 uses exact string membership in the stored platform list. It still requires the client id and the existing `azp` rules. A trusted extra cannot replace the client id or authorize another extra; URL normalization does not widen trust.
- Create and PATCH validate a list of strings. The API uses the authenticated account, and writes keep the existing admin-scope, account and binding-ref checks. Clearing the list takes effect on the next launch. Read and write responses include the field for both endpoint-plan paths.
- Migration `018` supplies `[]` for old rows. The store test migrates a real pre-018 database, compares all old columns, then checks persistence after reopening it.
- `scoreGiven: null` follows the absent-field path; zero and `scoreMaximum` validation stay intact. An unsupported present NRPS version is refused before token retrieval or an outbound request; an absent version and a list containing string `2.0` still work. These changes match LA-IC-13.
- UNIT AC-04 has API and migration tests. Restoring the old store/API implementation makes five relevant tests fail. The diff respects lane L ownership; `a6ea71e` is the dispatched L2 fixture change. No forbidden production file, QA-owned test or new LMS-name branch was changed.

### Verification

Tests ran in a private clone at `84d5679`, which contains both task merges. The shared focused run for LA-E3-12/13 passed **368 tests in 19 files** (checks, Deep Linking, shaped tokens, platform clients, platform store, routes, auth, app and database). LTI-service TypeScript, ESLint on all 13 changed TypeScript files, F1 and F5 passed; F1 reported existing baseline-lowering notices.

Four additional private HTTP probes passed: cross-account/scope/binding-ref refusals; signed launches with exact, removed and invalid audiences; byte-equal upstream score requests for null and absent scores; and NRPS refusal with no outbound work. Separate reversions of the audience guard, null-score handling and NRPS guard caused **1, 1 and 6** shipped tests to fail respectively. Mutations were restored; no product or test file was changed in the integration worktree.

K1-SIM AC-01/02/03/05 and QA's LD-9 test-change list remain QA evidence. These in-process probes do not replace those runs or approve an unseen test-change list. No Docker, stack or host stack runner was used.
