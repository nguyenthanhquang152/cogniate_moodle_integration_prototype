Verdict: APPROVE
Round: 1

## Round 1

Reviewer: Codex GPT-6-Astra, xhigh. Lens B: can a human team own it? Reviewed on 2026-10-23.

Scope: `6d7e86d`, `8d967bb`, `042073c`, `7c417c3`, and `7f46339` (merge `176e823`), tested at integration `053e5c7a042e4fd72c1e3c462aafcd376eea8643`. Read the task spec, LA-ADR-05 D3, data model §5b, security delta §§4–6, ownership matrix §5, and plan §6.1. BD-A2-87 now ratifies the five local choices named in the dispatch. Blind review: no Reviewer-A file was opened.

No BLOCKER or MAJOR findings. One MINOR test finding.

### B-LA-E3-05-01 — MINOR — The pick retry test fails before the claim it says it releases

**File:** `services/cogniate-app/src/tool-pages/picker.test.ts:215` (also the existing single-pick checks in `tool-pages/launch.test.ts:376` and `:446`).

**Problem:** `t.lti.failNext` now fails `getIdToken`, so the multi-pick test does not prove cleanup after a failed Deep Linking call. The newly unconditional token lookup in `tool-pages/picker.ts:231` consumes that fault (`testkit.ts:325`) before `sendToLms` creates any pick rows. The assertions that no picks remain and the picker is unused therefore pass without exercising release.

**Evidence:** In the private clone, I changed the catch at `tool-pages/picker.ts:138` to release only Cancel requests. Failed single and multiple picks would then remain used, but all **63** tests in `picker.test.ts` and `launch.test.ts` still passed. Two private probes instead failed `lti.client.deepLinking` after asserting that the claim and its one or two pick rows existed. Both probes passed on the submitted code and failed on that mutant. The production release logic works; the test does not protect it.

**Suggested fix:** Make the new retry test reject `deepLinking` specifically, assert that it was called, and verify that the claim and pick rows existed when it failed. Keep the cleanup, retry, and identical-items assertions. Preserve a separate token-lookup failure case if needed. The legacy single-pick tests can use the same targeted fault when their owner grants the edit.

### Ownership and operability

- Cancel has its own form, also on the empty list, so required radio inputs do not block it. Its return page says “No course was added.” and retains the manual Continue fallback and the existing auto-submit headers.
- The multi-select legend gives the 20-course limit. The server reads trusted launch settings, checks each publication, refuses duplicates, and sends items in the displayed list order. The not-graded page gives the specified next action and logs `picker_rejected` with `placement_not_graded` and the page trace id.
- `sendToLms` keeps claim, release, return-URL validation, and response construction in one path for picks and Cancel. The SQL migration explains its backfill. The hashed picker key and publication id connect each pick to the resource link on first launch; single picks keep the legacy columns in step.
- The diff respects the task paths and the explicit migration/RQ-2 grants. It changes only `launchStats` in domain `launch.ts`; it does not change tool-page `launch.ts`, app server mounts, channel manifests, LTI service files, or QA tests. F1 and F5 passed with zero hits.

### Verification

All execution was in `/tmp/la-review-b-254af149c220`, made with `git clone --no-hardlinks` and its own `npm ci`. Removed that clone's `node_modules/.vitest-cache` before every Vitest run. No Docker, stack, or stack-starting runner was used; no integration product file was changed.

- **87 tests passed** across app `tool-pages/{picker,launch}.test.ts`, `domain/{pickers,retention,domain}.test.ts`, and `clients/lti-client.test.ts`.
- The app typecheck and ESLint on all nine changed TypeScript files passed. F1: zero hits; F5: six rules, zero hits.
- **UNIT AC-09:** tests check three picks before launch, one increment per publication, matching on first launch without double counting, and the legacy single-pick column. Restoring the old session-based stats query caused three test failures.
- **UNIT AC-10:** the migration test copies a pre-018 database seeded with old SQL, compares every fixture publication's old activity count, checks the backfill rows, reopens the migrated database, and matches an old pick on first launch. Removing the backfill caused two test failures.
- Removing the unmatched multi-pick retention exception caused its test to fail. A further private probe confirmed that a failed later insert rolls back both the claim and the earlier pick. Together with the two targeted retry probes above, **three private probes passed** on the submitted code. All product mutations were restored.

K1-SIM and MOODLE-LIVE acceptance, including Moodle's visible response to Cancel and the LA-IC-12 frozen-assertion list, remain with independent QA. This review does not claim those runs.
