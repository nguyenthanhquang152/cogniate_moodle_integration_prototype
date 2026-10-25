Verdict: APPROVE
Round: 1

# LD-9 Addendum R3 — Reviewer-B

Reviewed QA-3 `be7e9176`, integrated by `12563635`, against `la-gate-test-3` (`e46bb27c9487d332f40fcefd4dd880304d1d31f1`) and `la-gate-test-4` (`6ce8ffafb9da767aa73dbcd5fb38e9844c543ff1`). Lens: can a human team own the change and its evidence? Blind review; no Reviewer-A file read.

**Result: 0 BLOCKER, 0 MAJOR, 1 MINOR, 0 NIT.** The six-file test-change list is approved. This approves the proposed changes, not a completed Moodle re-gate. The §5 rows still need live evidence on the resulting gate test SHA.

## Hunk decisions

| Addendum hunk | Decision and boundary | Required re-gate coverage |
| --- | --- | --- |
| 1: `tests/e2e/lib/steps.ts` | APPROVE, `LA-IC-23` / `BD-A1-115`. Reads the two named channel data sources; `classify()` is byte-identical to the frozen version. The composed data equals the baseline file. | The listed T7 start, A, B, C and end rows, in one authorized Moodle run. |
| 2: `tests/acceptance/lib/portal.ts` | APPROVE, `LA-IC-23`. Both method readers reproduce the old data. No product runtime import or test dependency is added; the manifest evaluation is limited to the named data file. | `AC-T6-12`, including both methods. |
| 3: `tests/acceptance/T6/2-connect.spec.ts` | APPROVE, `LA-IC-23`. Keeps the independent `specMoodleSteps()` equality oracle and every subsequent screen, order, optional-step and label check. | `AC-T6-12` must PASS. |
| 4: `tests/acceptance/T6/3-courses.spec.ts` | APPROVE, M2 label approval / `AC-M3-02(b)`, not an LA change. Only the opener locator changes; “Available in Moodle” and teacher instructions remain. | `AC-T6-07` must PASS. |
| 5: `tests/acceptance/T6/5-xss-a11y.spec.ts` | APPROVE under the same M2 approval. All three opener locators change; XSS, accessibility and keyboard-focus assertions remain. | `AC-T6-09` and `AC-T6-13` must PASS. |
| 6: `tests/acceptance/T8/2-shell.spec.ts` | APPROVE under the same M2 approval. Button, select and option prefix match M2's published labels. The Moodle-only course checkbox remains. | `AC-T8-10`, `AC-T8-08` and `AC-T8-09` must PASS, including the serial dependants. |

The types, reasons and post-approval rows cover every patch hunk. The list agrees with LA-ADR-04 D8 and M2's “Intentional label changes” table. It changes no product file, assertion threshold, timeout, retry or skip. The two gate bases differ only in the Canvas login test, outside these six files.

## Finding

### B-LA-E7-08-LD9-05 — MINOR — The cited Slot 8 QA section is absent

- **File:** `docs/reviews/LA-E7-08/ld9-addendum-r3.md:15-16`.
- **Problem:** The addendum names `docs/reviews/LA-E7-08/qa.md` §7 as evidence and an input, but that section does not exist at the reviewed integration commit.
- **Evidence:** `git show 12563635:docs/reviews/LA-E7-08/qa.md` ends with §6, Slot 3C. The Slot 8 artifacts themselves exist: `qalead-la-30` `run1/tests.json` records the missing steps file; `qalead-la-34` `cmd/30-test-acceptance-T6.log:118` records the same `ENOENT`, and lines 151/181/211 record the old publish locator; `qalead-la-35` `cmd/13-test-acceptance-T8.log:107` records the old publish locator. These are under `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT8/artifacts/`, in the timestamped run folders named by the addendum.
- **Suggested fix:** Cite those exact artifact files now, or cite the commit that actually adds the Slot 8 report and merge it before relying on §7. This is safe to defer because the evidence can be independently located and agrees with the proposed patch.

## Independent host checks

- Extracted the single diff block from `12563635:docs/reviews/LA-E7-08/ld9-addendum-r3.md`. `git apply --check` passed on both frozen bases; both remained clean.
- Applied it only in `/tmp/review-b-ld9-r3-moodle-9sk0c_js`, cloned with `git clone --no-hardlinks` and detached at `6ce8ffaf`. Exactly the six proposed files changed; `git diff --check` passed.
- Installed the standalone test project's dependencies only in that private clone. `npm --prefix tests run typecheck` passed.
- Executed the actual patched helpers through an in-memory TypeScript loader: **15/15 checks passed**. Both full readers and both method readers equal `1b17261:apps/portal/src/connect/moodle-steps.json`; that fixture equals the T6 specification. Dynamic/manual action classifications remain correct. The old path fails with `ENOENT`. Seven mutations of IDs, order, optional flags, labels, menu paths, manual text and manifest dynamic text are rejected by the equality oracle. Temporary data mutations were restored.
- Evidence: `/tmp/reviewer-b-ld9-r3-moodle-checks.json`, `/tmp/reviewer-b-ld9-r3-moodle-typecheck.log`, `/tmp/reviewer-b-ld9-r3-moodle-probe.cjs`, and `/tmp/reviewer-b-ld9-r3-moodle-probe.json`.

No Docker, stack, host stack runner, browser or live test was run. No commit was made. Only this review file was written in the integration worktree.
