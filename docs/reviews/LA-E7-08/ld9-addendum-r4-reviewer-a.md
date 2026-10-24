Verdict: APPROVE
Round: 1

## Round 1

Reviewer-A: Codex GPT-6-Astra xhigh. Reviewed QA commit `313c75f81373b2fb018a251a19289b603aceea5e`, unchanged at integration `589d4f85`, against BD-A1-116, BD-A1-117, plan §6.1 LD-9, AC-T5-36, AC-T6-07 and the runtime-state contract. **0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**

- **WE-F10 — approved.** The proposed `tests/acceptance/T5b/1-html.spec.ts:59` polls the current player's persisted runtime state for the exact `index` array member before `driveCourse`. It does not write progress or manufacture completion. The 20-second poll is bounded; `runtimeState` also uses a 15-second HTTP timeout. The existing 60-second result deadline still starts after `driveCourse`, and every grade, outcome and hanging-request assertion remains unchanged.
- **WE-F11 — approved.** The proposed `tests/acceptance/T6/3-courses.spec.ts:132` uses the exact wait from BD-A1-117, after dialog visibility and before the text snapshot. At the gate SHA, `PublishDialog.tsx:87` renders `Loading…` while connection data and a load error are both absent; the options derive from that same data. Thus this observes the connection-list load, not unrelated page text. A load error or empty/wrong list still fails the preserved `Dev Moodle` assertion or subsequent selection. The wait uses the configured 15-second expectation timeout.
- Complete-file comparison confirms exactly **two waits and one import**, across the two authorized frozen specs. Every original line remains unchanged, including the pending-connection exclusion, publication result and teacher text. No product file, shared helper or core path changes; these are the two approved test races, with no new LA-IC.

### Verification and boundary

In `/tmp/la-review-a-f175a37a74dd`, a fresh `git clone --no-hardlinks` at `la-gate-test-5` / `0700b3962ec063c4c2c3f36cf0ca27a25c97e82e`:

- The exact fenced patch passes `git apply --check --verbose`; its applied diff passes `git diff --check` and the complete-file scope comparison.
- Three host probes execute the extracted T5b wait with real Playwright `expect.poll` and stubbed state responses: success only after `index` appears; no-index/`index-copy` responses fail with the expected value and 20,000 ms timeout (19,902 ms elapsed); an unresolved state callback also times out (20,002 ms). All pass.
- `npm --prefix tests run typecheck` passes using QA's existing dependency installation through a private symlink; no install. Evidence: `reviewer-addendum-r4.patch`, `review-probe.cjs` and `review-probe.log` in the private clone.

The original gate remains clean at its stated HEAD/tag. No Docker, stack, browser/live test or commit was run. Only this review file changed in integration; no other reviewer's file or probe was opened. Approval covers these three added lines; the authorized Moodle live re-gate remains pending.
