# M1 host control: no replay across controller restarts (Reviewer-B)

Verdict: APPROVE
Round: 1

Reviewer-B, 2026-10-21. Lens: regression quality and maintainability. This is a focused source review of the host-only repair. **It gives no runtime credit.** No M1 row changes status because of this report. The failed attempt at `51a80b5` stays FAIL: h4 failed, and W4 separately failed because of unrelated Docker activity. This repair does not address W4.

I reproduced the old replay with the real exported controller from `51a80b5`. The candidate controller stops that replay. It keeps the ack, the output and the `host-actions` evidence. It still answers legitimate queued and new requests. The new self-tests fail against the old controller and against eleven independent mutants. No BLOCKER, MAJOR or MINOR finding is open. There are two optional NITs.

## Identity

| Item | Value |
| --- | --- |
| Role | Reviewer-B, independent of the QA author, Author-2 and Reviewer-A. Claude Code Opus 5.5 (`claude-opus-5-5`), xhigh. Orca session `orca_session_id:a54f10e6-b8e5-49ce-94c6-6c0d6f9f2bb2`. |
| Task | Run `run_ebe671ad72a9`, task `task_9c9a2274c917`, dispatch `ctx_394aae19ddba`. Candidate message `msg_bb4352e3ef03`. |
| Candidate | `9cdd7687b91169a262648018ec6945efa31217dc`, tests tree `eccd4b50aa9c0ef6a25ce7d95fd383c0f3ad817e`. |
| Base (frozen failed runtime) | `51a80b51de2c7491466a21a678418ff8178d247d` |
| Held hashes (verified) | `tests/host/m1-control.mjs` `21baa87db6198ba0e8628149c49a55490f824ef0ad63ac413d2e2bdaf6a99d06`; `tests/host/m1-control.selftest.mjs` `4473c99311bcef97ed010057566e7fee760f6c7e1751a2d24c05f750931aa323`; `docs/reviews/M1/host-control-replay-qa.md` `e052be53e055d412aa75d89ea4a402c515677bf7582c23c701731bb845ec5fd8`. All three match the Lead's values. |
| Later commit | During the review, the Lead committed `fa2589c` (`docs/team/board.md` and `docs/team/multi-lms-plan.md` only). `HEAD:tests` is still `eccd4b5`. The three held hashes are unchanged. |
| Commit scope | `9cdd768` changes three files: `m1-control.mjs` (+5 −1), the self-test (+126) and the QA report (new). No historical record changed. |
| Product | `git diff a784522 9cdd768 -- services apps packages infra package.json package-lock.json` is empty. |
| Blind review | I did not read any Reviewer-A file for this repair. |

## What I read

- `AGENTS.md`, the charter, the current checkpoint in `docs/team/multi-lms-plan.md` (06:08 UTC) and the board row.
- The candidate diff, the full `tests/host/m1-control.mjs` and the new self-tests.
- Callers: `run-m1.mjs:272-306` (`suite()`), `m1-migration.mjs:271-322` (`snapshotMigrationRun`), `storage-rows.mjs:411-439` (`a-lock-scope`) and `:1253-1267` (`hostControlRefusesWithMarker`), plus the storage `SEQUENCE` (`:26-31`).
- Clients: `acceptance/M1/common/client.ts:93-105` (`host`) and `acceptance/M1/canvas/browser.ts:54-64` (`hostAction`). Both write `req-m1-<12 hex>.json` with the same id inside, through a `.tmp` file and a rename. They never delete request or ack files. `storage-rows.mjs:1259` writes `req-m1-<16 hex>.json` with the same id. `acceptance/lib/host-control.ts:56` uses `<time>-<hex>` ids, which the M1 scan filter ignores.
- `lib.mjs:11-35`: `run()` never rejects. A spawn error or a timeout resolves with code `-1`, so the controller still writes an ack.
- App contract §4.8 (`cogniate-app-api.md:593`) and ADR-011 (`:144`): a new grant for the same connection and purpose revokes older unredeemed grants. Contract `:397`: a revoked grant gets `grant_rejected` with reason `revoked` and no `grant_attempt_started`.

I did not open the private runtime artifacts or the QA diagnosis messages of the failed attempt. For the runtime timeline, I rely on the QA report and the Lead checkpoint, which records both independent QA diagnoses.

## Method

Private root `/Users/quangnguyen/cogniate-qa-runs/host-control-replay-rb-20261021T0622Z`. I created it with mode 0700 (umask 077). All child commands ran with umask 022 and `TMPDIR=<root>/tmp`. Trees come from `git archive`: `trees/frozen` = `51a80b5` and `trees/cand` = `9cdd768`. Each tree has a symbolic link to the worktree's `tests/node_modules`. Outside `docs/`, `diff -rq` shows only the two held test files. All data are synthetic. There was no Docker, no stack, no product call and no live LMS call.

Commands, in summary:

```sh
node harness/rb-repro.mjs trees/frozen tmp   # and trees/cand
node harness/rb-mutants.mjs <root>           # cross trees and mutants, node --test on the self-test
cd trees/cand   && node tests/host/run-m1.mjs --harness-only --provider all     # and --provider canvas
cd trees/frozen && node tests/host/run-m1.mjs --harness-only --provider all     # and --provider canvas
# In the worktree (the candidate bytes):
node --test tests/host/m1-control.selftest.mjs   # 1 + 5 repeated runs
npm --prefix tests run typecheck
```

## Independent reproduction (real controller, fake executor, real files)

`harness/rb-repro.mjs` imports `m1HostControl` from one tree. Its fake executor holds a synthetic grant store with the §4.8 rules. It also returns code `1` for a failed command and code `-1` for a `run()`-style timeout. Redeem is a local function on the same store. Requests, acks and outputs are real files in a temporary control folder. Scenario S1 has the M1-38 shape. Controller 1 answers seven seed requests: an initial issue (0), the seeded `add_deployment` issue (0), an initial issue on the bound connection (1), a timeout (−1), a whitelist refusal (2), an `m1-restart` (0) and a failure (1). Then `stop()` returns, and controller 2 starts on the same folder with the same runner object.

| Measure | Frozen `51a80b5` | Candidate `9cdd768` |
| --- | --- | --- |
| S1: stage-1 commands run again by controller 2 | **6 of 6** (two issues, the bound issue, the timeout, the restart, the failure) | 0 |
| S1: seeded grant at h4 | **`403 revoked`**; events `grant_revoked:grt_2:replaced-by-m1-a02`, then `grant_rejected:grt_2:revoked`, no attempt | `200`; `grant_attempt_started`, `grant_redeemed` |
| S1: new stage-2 request; fresh `add_deployment` issue and redeem | 0; 200 | 0; 200 |
| S1: stage-1 control files changed (bytes or mtime) | **14** (7 acks, 7 outputs) | 0 |
| S1: `host-actions` saves for each stage-1 id | **2** | 1 |
| S2: `stop()` while a command runs | waits; ack after return; then **runs it again** under controller 2 | waits; ack after return; runs once |
| S3: request queued before controller 1, and one queued between controllers; three controllers | run **3** and **2** times | each runs once |
| S4: runner rejects (not possible with real `run()`) | no ack; runs under every controller (3) | the same (3): limit |
| S4: `saveText` throws once after the command | no ack; runs 2 times | the same (2): limit |
| S4: only `ack-<id>.json.tmp` left (crash between write and rename) | runs | runs once: the request has no ack |
| S5: guard, whitelist, marker, unknown action, size, symbolic link, JSON, non-string id, `../` id | same refusals; the same command lines | same refusals; the same command lines |
| S5: `req-m1-f14.json` with id `m1-f01` | **runs** and rewrites `out-m1-f01` | refused (`Request id`), no command |
| S5: controller started later with the marker present | **runs 5 earlier commands again**, including two that the QA project guard had refused | runs 0 |

The frozen S1 row is the h4 failure shape: the repeated issue revoked the seeded grant, the product rule refused it, and no attempt event exists. S5 shows one more old effect. A request that the QA project guard refused was run later, after the guard passed. The candidate acks that refusal (code 2), so it never runs.

## Regression quality: do the tests prove the claim?

`harness/rb-mutants.mjs` copies the candidate `tests/host` and the two infra files that the self-test reads. It applies one exact edit (the script requires exactly one match), then runs `node --test` on the self-test.

| Variant | Result | First failure |
| --- | --- | --- |
| Candidate | 5/5 PASS | — |
| Held tests + frozen controller | 3 pass, **2 fail** | test 4 "No repeated issue revoked the seeded grant"; test 5 "The mismatched request is refused" |
| Old tests (3) + candidate controller | 3/3 PASS | — (CLI, profile and marker behaviour unchanged) |
| M1 remove the ack skip | 2 fail | test 4 grant revoked; test 5 "Each queued request ran once" |
| M2 skip only when the ack has `ok: true` (replay non-zero) | 1 fail | test 4 "m1-b3 ran once" |
| M3 skip only when the ack has `ok: false` (replay success) | 2 fail | test 4 grant revoked; test 5 |
| M4 wrong ack name (`'ack-' + name`) | 2 fail | test 4 grant revoked; test 5 |
| M5 `stop()` does not stop the scan | fail | test 4 "No controller runs between the stages" |
| M6 `stop()` does not wait for running commands | 1 fail | test 4 "stop() waits for the running command" |
| M7 no id check | 1 fail | test 5 "The mismatched request is refused" |
| M8 old id pattern (no name binding) | 1 fail | test 5 "The mismatched request is refused" |
| M9 skip files present at controller start | 2 fail | test 4 "Host control answered m1-b7" (queued request) |
| M10 skip all requests when any ack exists | 5 fail | new requests are not answered |
| M11 write an ack for a refused request | 1 fail | test 5 "The next controller refuses it again" (see B-HCR-01) |

So the tests detect success replay, non-zero replay, a wrong ack key, loss of queued or new requests, stop and in-flight errors, and the id binding. The candidate self-test passed 6 of 6 repeated runs in the worktree. Its negative checks use `delay(100)` after a 25 ms scan interval. A slow host can only make them pass late; it cannot make a correct controller fail.

Maintainability: the code change is small and local. Both new comments state why the check exists and name M1-38 h4. The new self-tests are dense, but they match the style of the file. They name each assertion and use no container or product. Test 4 checks the grant states, one run per executed id, no command for refused ids, byte-identical stage-1 files and one `host-actions` record per id.

## Harness, typecheck and inventory

| Check | Result |
| --- | --- |
| `run-m1.mjs --harness-only --provider all`, candidate tree | exit 0. **73/73** self-tests. Typecheck PASS. "392 API cases, 96 host rows (72 AC-M1-41); **488** mandatory rows per round; phases sim 394, migration 12, snapshot-upgrade 6, snapshot-isolated 6, storage 70". |
| `--provider canvas`, candidate tree | exit 0. 73/73. 347 rows. |
| The same two commands, frozen tree | exit 0. 71/71. 488 and 347 rows, the same phase counts. |
| Canvas manifest `tests/acceptance/M1/canvas/manifest.json` | **233** rows: 225 API `sim`, 7 browser `sim`, 1 API `snapshot-isolated`. |
| `tests/acceptance`, `tests/sim`, `tests/e2e` trees | Identical at both SHAs (`a3b78e2d…`, `ee7ecc5c…`, `cb09a034…`). The h4 grant and audit assertions (`common/snapshot-oracle.mjs`, `redeemedWithOneAttempt`) are unchanged. |
| Worktree: `node --test tests/host/m1-control.selftest.mjs` | 5/5 PASS |
| Worktree: `npm --prefix tests run typecheck` | exit 0 |
| `git diff --check 51a80b5 HEAD -- tests` | exit 0 |
| `git status --short` after all runs | only the untracked `pnpm-workspace.yaml` (not mine, untouched) |

`tests/package.json` has no `test:harness` script. I used the runner entry, as the Lead instructed.

## Lifecycle analysis

| Request state | Candidate behaviour | Evidence |
| --- | --- | --- |
| Answered by an earlier controller (any code, including refusals inside `execute`) | Skipped. It is not read, and no file is written. | S1, S5, test 4 |
| Taken when `stop()` is called | The scan callback is synchronous. A taken request is in `active` before the callback ends. `stop()` sets `stopped`, clears the timer, then awaits `active`. The ack exists when `stop()` returns. | S2, M6, test 4 |
| Written but not yet scanned when `stop()` runs (25 ms or less) | It stays queued. The next controller runs it once. A controller cannot tell it from a legitimate queued request. In `run-m1`, `suite()` stops the controller only after `npm run test:acceptance` exits, so this needs an abnormal end of the test process. That end also fails the stage, and `snapshotMigrationRun` then stops before the next controller. | S3, code reading |
| Refused in `answer()` (file, size, JSON, id) | No ack. Each later controller records another `HOST-CONTROL` FAIL. No command runs. | S5, test 5 |
| Taken, then no ack (process ends, a rejecting runner, a write that throws) | The next controller runs the command again. | S4 |

This is safe for ordinary sequential restarts. It is **not** crash-proof exactly-once execution. The ack is the only durable record, and the controller writes it after the command. The QA report says this correctly (Limitations, first two items). The code comments make no exactly-once claim. Two controllers on one folder at the same time are still not supported. Every caller awaits `stop()` before the next controller starts (`run-m1.mjs:286`, `storage-rows.mjs:423` and `:1264`).

The id binding (`m1-control.mjs:57`) belongs to this repair. The skip finds the ack by the file name, and `answer()` writes the ack by `req.id`. Without the binding, a mismatched file would run under each new controller and overwrite another id's answer (S5 frozen). With the scan filter (`:76`), the binding still limits ids to `m1-<hex>`. So the output, ack and `host-actions/<id>.json` paths stay safe.

## QA report check

I checked these statements against the source and my own runs. They are correct: the cause (§Cause), the caller table, `run-t5.mjs:144-146` as the earlier precedent, the lifecycle table, the limitations, the C2 cross results, the 73/71 counts, and the 488/233 inventory. My own versions of the four C3 mutants (M1, M6, M8, M9) also fail. M9 fails test 5 at a later step than QA's version, because my mutant compares file times. The runtime timeline (lines 17-29) comes from private artifacts that I did not open. B-HCR-02 is a wording NIT only.

## Findings

| Id | Severity | File:line | Problem | Evidence | Suggested fix |
| --- | --- | --- | --- | --- | --- |
| B-HCR-01 | NIT | `tests/host/m1-control.selftest.mjs:276` | Test 5 requires that a second controller records a second FAIL for the refused file. This is a documented limit, not a wanted property. | Mutant M11 writes an ack for a refused request. It still runs no command and keeps `ack-m1-e1` unchanged, but test 5 fails at "The next controller refuses it again". The assertion also tells the test when controller 2 has scanned the file. The comment at `:274` states the limit. | Optional, not for this repair. If refusals get an ack later, change this step to wait for the scan and assert only "no command and `ack-m1-e1` unchanged". |
| B-HCR-02 | NIT | `docs/reviews/M1/host-control-replay-qa.md:102` | "the same order, the same codes" can be read as the same code order. The codes at `:95` (1, 1, 0, 1, 0, 1, 0) are a different order from the real records at `:24` (1, 0, 1, 1, 0, 0, 1). Line 95 correctly says "the same mix". | Compare lines 24, 95 and 102. | Optional: write "the same event order and the same mix of codes". |

No BLOCKER, MAJOR or MINOR finding. Neither NIT expands the repair. I did not change any repository file except this report.

## Limits of this review

- **No runtime credit.** I did not run Docker, the runner phases, the real `suite()`, `snapshotMigrationRun`, `storagePhase`, `run-m2.mjs`, the real CLIs or the product. The reproduction uses a fake executor and a synthetic grant store. These show the controller's file lifecycle, not the product rules.
- This review does not show that h4, the rest of snapshot-upgrade, Round 2, legacy, M2 or T7 will pass. A new frozen candidate and a full run in a Docker window are still necessary.
- The W4 failure of the `51a80b5` attempt stays open and separate. This source repair cannot fix it.
- Accepted deferral B-BM-01 is unchanged. All 32 real-LMS rows remain UNVERIFIED.

## Evidence (private, mode 0700)

Root: `/Users/quangnguyen/cogniate-qa-runs/host-control-replay-rb-20261021T0622Z`. The files hold only synthetic ids, counts, codes and test output. A scan for 43-character tokens in `evidence/` found none. The temporary control folders were removed.

| File | SHA-256 (first 12) |
| --- | --- |
| `harness/rb-repro.mjs` | `3abd05820410` |
| `harness/rb-mutants.mjs` | `28c15bd925a1` |
| `evidence/repro-frozen.json`, `repro-cand.json` | `bf3cabe25120`, `6c338db46912` |
| `evidence/mutants-summary.json` (+ one `selftest-<variant>.tap` each) | `f9c8f1dae0a0` |
| `evidence/harness-cand-all.txt`, `harness-cand-canvas.txt` | `f45d66ba1816`, `4cccf460ab32` |
| `evidence/harness-frozen-all.txt`, `harness-frozen-canvas.txt` | `97ef69eac112`, `5aa6719fbaa4` |
| `evidence/selftest-worktree.txt`, `typecheck-worktree.txt` | `37d3d9ced22f`, `5c2ed9445e8a` |
