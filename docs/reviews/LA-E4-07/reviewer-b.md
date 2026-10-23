Verdict: APPROVE
Round: 2

## Round 1

Reviewer-B: Codex GPT-6-Astra xhigh. Lens: can a human team own it? Reviewed `0ad8858`, `bb648ff`, `018abeb` and `f7841a1` from merge `be7698d`, with code pinned at `5ddf81af51caa1e20a96ac1b9f6cee2aef37b3a8`. Design basis: the task spec, app API delta §8a, LA-ADR-06 D10, operability §4.3, BD-A2-88 and its BD-A1-100 recording (`579a754`), plus plan §6.1 and the charters. Blind review; no other reviewer's report opened.

One BLOCKER, no MAJOR, MINOR or NIT findings. The implementation and operator guidance are otherwise clear: metric sources, seconds units, readiness reasons, commit timing and the standalone-worker limitation have explicit homes.

### B-LA-E4-07-01 — BLOCKER — Launch reasons accept a character that AC-07 excludes

- **File:** `services/cogniate-app/src/app/metrics.ts:88`, used by `launchRefused` at line 130; coverage in `services/cogniate-app/src/app/metrics.test.ts:140`.
- **Problem:** The shared `CODE_VALUE` pattern permits hyphens in launch-reason labels, while app API delta §8a and AC-LA-E4-07-07 require `[a-z][a-z0-9_]{0,63}` and map every other reason to `other`.
- **Evidence:** In the private clone, calling `launchRefused('bad-reason', registeredChannel)` emitted `app_launch_refusals_total{reason="bad-reason",channel=…} 1`. A private Vitest probe expecting the `reason="other"` sample failed (expected `1`, received `undefined`). The shipped test rejects a value with spaces and `@`, so it passes despite this gap. Current launch callers use underscore codes; this is a narrow contract failure, not evidence of present tenant-data exposure. Severity follows charter §5: an acceptance criterion fails.
- **Suggested fix:** Give launch reasons a separate validator with the specified grammar. Keep hyphens valid for job names such as `record-dispatch`. Add the hyphen case and length-boundary cases to the label tests, while retaining coverage for the valid job name.

### Checks and evidence

- A fresh `git clone --no-hardlinks` under `/tmp` used its own `npm ci --no-audit --no-fund`. The Vitest cache was removed before every run. The restored focused suite passed **302 tests in 15 files**: metrics, real web/worker entry points, records, tool pages and redemption paths. Typecheck, full ESLint, F1 (zero hits) and F5 (six rules, zero hits) passed.
- UNIT AC-01 has default-settings, bound-address and real production-refusal checks. UNIT AC-05 exercises ready, migration mismatch and unavailable database answers. UNIT AC-07 exercises unknown channels, malformed reasons and real `APP_JOB_RUNNER` on/off topology, but lacks the failing reason case above. Thus the green suite does not establish all of AC-07.
- Five private negative controls each produced the intended failure: disable the production bind guard, bypass readiness checks, notify send observers before commit, remove the channel guard, and publish send series unconditionally with the runner off. All mutations were restored. The additional AC-07 probe failed against unmodified production code. Logs: `/tmp/reviewer-b-e407-restored.log`, `/tmp/reviewer-b-e407-mutant-{bind,readiness,commit,channel,topology}.log`, `/tmp/reviewer-b-e407-reason-ac07.log`.
- The task diff respects the declared production-file boundary and the two named RQ-2 exceptions for `tool-pages/launch.ts` and `infra/compose.yaml`. No redemption implementation, QA-owned `tests/**`, unrelated infrastructure or LMS-specific core branch was added. The web/worker test changes cover listener startup and topology.
- No Docker, stack or stack-starting runner was used. K1-SIM ACs, including the LTI-outage scenario and K-HYG scrape, remain for QA; this review does not claim those gates. Only this review file was changed in the integration worktree. No commit was made.

Lane R should fix B-LA-E4-07-01 and request round 2. No other Reviewer-B change is requested.

## Round 2

**APPROVE — no open or new findings.** Reviewed and tested `5b89f4238fd9a9572a08fbdb9bfa563aa952cb46` against the same task and BD-A1-100 rules. B-LA-E4-07-01 is closed.

`app/metrics.ts:89–91` now names separate job and launch-reason patterns. The reason pattern matches AC-07; the job pattern still accepts `record-dispatch`. The boundary table in `app/metrics.test.ts:157` checks the hyphen case, 64/65-character boundary, invalid initial characters, case and empty input, with an unknown channel mapped to `''`. The real web-entry test also checks that runner-off omits send/job samples while store samples remain. AC-01 and the UNIT part of AC-05 retain the tests verified in round 1.

Verification used a fresh private `git clone --no-hardlinks` with its own `npm ci`; the Vitest cache was deleted before each run. The focused metrics and web/worker suite passed **30 tests in two files**. Typecheck, ESLint for all three changed files, F1 and F5 passed. Two negative controls each failed at the intended assertion: restoring the previous production module failed the new hyphen-reason case, and applying the reason pattern to job names failed the existing `record-dispatch` assertion. After restoring the module, all **17 metrics tests** passed. Logs: `/tmp/reviewer-b-e407r2-{focused,old-reason,job-name,restored}.log`.

The three-file diff stays within the existing implementation and colocated test ownership. No forbidden production file, QA-owned test or LMS-specific core branch changed. No Docker, stack or stack-starting runner was used; K1-SIM and K-HYG remain QA gates. The private mutations were restored and the clean clone removed. Only this report changed in integration; no commit was made.
