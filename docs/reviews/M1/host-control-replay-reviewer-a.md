# M1 host control: no replay across controller restarts — Reviewer-A

Verdict: **APPROVE** (test source only)

Round: 1

| Item | Value |
|---|---|
| Reviewer | Reviewer-A (Claude Code, Opus 5.5 `claude-opus-5-5`, xhigh), dedicated session `orca_session_id:076612d3-a505-4209-96bd-94c416c79e53`. Not Author-2, not the QA author. |
| Date | 2026-10-21 |
| Run / task / dispatch | `run_ebe671ad72a9` / `task_eb1894ae7f06` / `ctx_c0efa63d7f79` |
| Reviewed candidate | `9cdd7687b91169a262648018ec6945efa31217dc` (tests tree `eccd4b50aa9c0ef6a25ce7d95fd383c0f3ad817e`), supplied by the Lead in `msg_c0027cf0088b` |
| Base (frozen failed runtime) | `51a80b51de2c7491466a21a678418ff8178d247d` |
| Held files (worktree = commit) | `tests/host/m1-control.mjs` `21baa87db6198ba0e8628149c49a55490f824ef0ad63ac413d2e2bdaf6a99d06` (base `d4a7ee6e…70aa4`); `tests/host/m1-control.selftest.mjs` `4473c99311bcef97ed010057566e7fee760f6c7e1751a2d24c05f750931aa323` (base `cca7355e…1ef8d`); `docs/reviews/M1/host-control-replay-qa.md` `e052be53e055d412aa75d89ea4a402c515677bf7582c23c701731bb845ec5fd8` |
| Lens | Correctness, command authorization, no duplicate side effects, grant and audit assertions, evidence retention, in-flight lifecycle and safe failure |
| Runtime credit | **None.** No Docker command, stack, runner phase, product command or live LMS call ran. The `51a80b5` attempt stays **FAIL** (h4). Its separate W4 strict-comparison failure stays open; this source repair does not address it. |

## 1. Summary

The repair has two parts in `m1HostControl`. The scan now skips a request that already has an `ack-<id>.json` (`m1-control.mjs:81`). The request id must equal the id in the file name (`m1-control.mjs:57`).

I reproduced the original failure with the real exported controller of `51a80b5`, a fake executor and real request and ack files. A second controller on the same folder ran all 7 seed requests again. One repeated `add_deployment` issue revoked the seeded grant, so the h4-shape redemption got 403 `revoked`. The repeat also overwrote 10 seed control files and wrote a second `host-actions` record for each seed id. The held controller ran each request once, changed no seed file, and the seeded grant redeemed with 200.

The held controller accepts fresh queued requests and new requests. Non-zero, timeout and spawn-error results get an ack and do not run again. Every authorization and request check still refuses before any command, and command construction is byte-identical. The id binding is stricter than the old pattern: it also refuses a mismatched id and an array id, which the base controller ran.

The guarantee is sequential-restart safety, not crash-proof exactly-once execution. A command that runs but gets no ack runs again under the next controller. I confirmed that window and explain in §6 why the M1 runner does not reach it in a passing flow. Harness checks pass 73/73, typecheck passes, and the 488-row inventory (Canvas 233) is byte-identical to the base. No acceptance case, oracle or grant/audit assertion changed.

I found no BLOCKER, MAJOR or MINOR finding. There is one NIT on the QA report wording (§8).

## 2. Inputs and independence

- I read `AGENTS.md`, the charter, the current checkpoint in `docs/team/multi-lms-plan.md` (06:08 UTC) and the M1 board row. I also read App contract §4.7.1 phase 1 (check 2: a revoked grant gets `403 GRANT_INVALID` and `grant_rejected {reason}`, and no `grant_attempt_started`) and §4.8 Issue output (`cogniate-app-api.md:593`: a new grant for the same connection and purpose revokes older unredeemed grants).
- I read the QA report as evidence to check, not as proof. I did not read another reviewer's report. No `host-control-replay-reviewer-b.md` was in the worktree when I started.
- `git diff --stat 51a80b5 9cdd768 -- tests` shows only the two held test files. `git diff a784522 HEAD -- services apps packages infra package.json package-lock.json` (and the root config files) is empty. The candidate commit `9cdd768` changes only the three held files and deletes no historical line. The failure records in `ce09703` and `0596431` are unchanged.
- I ran all controls in a new private root, `/Users/quangnguyen/cogniate-qa-runs/host-control-replay-reviewer-a-20261021` (mode 0700), with umask 022. Trees come from `git archive` of `51a80b5` and `9cdd768`. All data is synthetic. I did not open any private log or artifact of the failed run.
- I changed only this report.

## 3. Source facts

| Fact | Source |
|---|---|
| Each `suite()` starts its own controller and awaits `stop()` in `finally`. | `run-m1.mjs:277`, `:286` |
| The snapshot-upgrade phase calls `suite()` for the seed stage, then the upgrade stage, in one runner process and on one clone. | `run-m1.mjs:333-340`, `m1-migration.mjs:287`, `:307` |
| `installTests()` extracts the frozen tests tree with `tar`. It does not remove `tests/acceptance/artifacts/control` (ignored by `tests/.gitignore`). | `run-m1.mjs:196-209` |
| The controller writes the output, then the `host-actions` record, then the ack (temporary file and rename). So an ack always means that the command ended and its evidence was written. | `m1-control.mjs:61-69` |
| `stop()` sets `stopped`, clears the timer and awaits every active answer. The scan is synchronous, so a scan cannot start after `stop()` runs. | `m1-control.mjs:74-86` |
| `run()` never rejects. Spawn errors and timeouts resolve with a result. | `lib.mjs:11-35` |
| Both real clients make the id from 6 random bytes (`m1-` + 12 hex), put the same id in the name and the body, write a temporary file and rename it, then wait for the ack. | `common/client.ts:19`, `:93-104`; `canvas/browser.ts:54-63` |
| Old-build stages also use the frozen tests tree, so no older client writes requests. | `run-m1.mjs:196-209`, `m1-migration.mjs:284` |
| M1 refuses `--checkout`. Every run uses a new clone, and the runner fails if the clone folder exists. So no request or ack from an earlier runner process can be in the folder. | `run-m1.mjs:116-117`, `core.mjs:227-231` |
| `shareEvidence` skips `control/`. The `host-actions/<id>.json` record is the published evidence of each host action. | `run-m1.mjs:222-229` |
| The storage harness check `hostControlRefusesWithMarker` (fake executor) runs on the same lane clone after `a-lock-scope` (real executor). | `storage-rows.mjs:411-437`, `:452-460`, `:1253-1266` |
| `run-t5.mjs` already uses the same "skip a request with an ack" rule. | `run-t5.mjs:144-146` |

The id check is strictly stronger than before. The scan filter `^req-m1-[a-f0-9]+\.json$` already fixes the file-name form, so an id equal to the name also matches the old `^m1-[a-f0-9]+$` pattern. The new `!==` check also refuses a non-string id. The old `RegExp.test` changed an array `['m1-…']` to a string and accepted it.

## 4. Reproduction of the h4 replay (C1)

Script `harness/ra-repro.mjs` imports the real `m1HostControl` of one tree. The fake executor uses a synthetic grant store that follows App contract §4.8. An issue revokes older unredeemed grants of the same connection and purpose. `initial` for a bound connection exits 1. `add_deployment` for a connection that is not bound exits 1. Redemption is a local function on the same store. Each run prints a different output, so an overwritten file is visible.

Seed stage (controller 1, 7 CLI requests, codes 1, 0, 0, 0, 0, 1, 0): an `add_deployment` issue before binding, two `initial` issues (the second replaces the first), a `list`, then redemption of the second `initial` grant (200). Then the seeded `add_deployment` grant (`grt_3`), an `initial` issue for the bound connection, and a `list`. The script awaits `stop()`, starts controller 2 on the same folder with the same runner object and waits 400 ms (16 scans). Then it runs the h4 shape: redeem the seeded grant, then issue and redeem a fresh `add_deployment` grant.

| Measure | Base `51a80b5` | Held `9cdd768` |
|---|---|---|
| Seed requests run again by controller 2 | **7 of 7** | 0 |
| Grants issued by the restart alone | 2 | 0 |
| h4: redeem the seeded grant | **403, `revoked`, revoked by the repeated `m1-0001`** | 200 |
| Fresh `add_deployment` issue and redemption | exit 0, 200 | exit 0, 200 |
| Final grant states | `grt_3` revoked by `m1-0001`, `grt_4` by `m1-0005`, `grt_5` by `m1-00a8` | `grt_3` and `grt_4` redeemed; no unexpected revocation |
| Seed control files changed after the restart | **10** (3 acks, 7 outputs) | 0 |
| `host-actions` records per seed id | **2** | 1 |
| New once-only codes added to redaction by the restart | 2 | 0 |

The base row has the same mechanism as the runtime failure. The first repeated request is an `add_deployment` issue that now exits 0 because the connection is bound. It revokes the seeded grant, and the h4 redemption then gets `revoked`. The upgrade-stage request ran once in both trees.

## 5. Lifecycle, failure and authorization controls

All rows use the real exported controller of each tree and real files.

| Control | Base | Held | Expected |
|---|---|---|---|
| S2 two requests written before the first controller | answered | answered | answered once |
| S2 request written while no controller runs | not run while stopped; run by the next controller | the same | run once by the next controller |
| S2 runs per id over three controllers (b001, b002 queued first; b003 between; b004 new) | 3, 3, 2, 2 | **1, 1, 1, 1** | 1 each |
| S3 command exits 3 / timeout (`-1`, `timedOut`) / spawn error | acked; run 2 times each | **acked; run once each** | acked, no replay |
| S3 executor rejects (cannot occur with `run()`) | no ack, FAIL record; run 2 times | the same | documented limit |
| S3 `saveText` throws after the command | output left, no ack, FAIL record; run 2 times | the same | documented limit (crash window) |
| S4 ten refusals with an ack (script not in the whitelist, NUL argument, 41 arguments, non-array and non-string arguments, `app:grant;rm`, unknown action, wrong restart service, wrong profile values) | code 2, correct message | the same | code 2, no command |
| S4 refusals without an ack (symlink, 9 KB file, bad JSON, `null`, a directory, missing id, upper-case id) | FAIL record, no command | the same | no command |
| S4 file `req-m1-e004.json` with the id of an answered request (`m1-d001`) | **ran a command and overwrote `ack-m1-d001` (code 2 → 0)** | refused (`Request id`); `ack-m1-d001` unchanged | refused |
| S4 file `req-m1-e005.json` with an array id `['m1-e005']` | **ran a command and wrote an ack** | refused (`Request id`) | refused |
| S4 commands run in total (two controllers) | 4 | **0** | 0 |
| S4 a second controller on the same folder | repeats every refusal and both commands | skips the acked refusals; records the unacked refusals again, with no command | no command |
| S4 file names outside the filter (`req-x1.json`, `req-m1-ABC.json`) | not read | not read | not read |
| S4 guards: project not `qa-`, `h1Verified` false, storage-compat marker for `m1-restart` and `m1-profile` | code 2 | code 2 | code 2, no command |
| S5 allowed commands: three CLI scripts, two restarts, two profile requests (program, arguments, cwd, `STACK_PROFILE`, timeout) | — | identical to base | unchanged |
| S6 `stop()` while a command runs, then the next controller | `stop()` waits; ack exists; command run **2** times | `stop()` waits; ack exists; **run once** | once |
| S6 a second controller started before `stop()` returns (no caller does this) | run 2 times | run 2 times | unsupported |
| S6 an ack left only as `ack-….json.tmp` (process ended before the rename) | run again | run again | documented limit |
| S6 an old ack with the id of a new request (id reuse) | run again; the client reads the new answer | skipped; the client reads the old answer | ids are random (48 bits) |

## 6. What the repair guarantees

- **Guaranteed.** Each caller awaits `stop()` before it starts the next controller. With that order, a request that has an ack does not run again and its ack, output and `host-actions` record stay as they are. A command result of any code, including a timeout or spawn error, gets an ack. So command failures do not run again.
- **Not guaranteed (crash-proof exactly-once).** A command that ran but got no ack runs again under the next controller. This happens if the process ends during the command or before the rename, or if writing the output or the `host-actions` record throws. Two controllers that run at the same time on one folder can both run one request (S6). The QA report states these limits (`host-control-replay-qa.md:183-186`).
- **Why the M1 flow does not reach the window.** A runner process cannot take over an older folder, because M1 refuses `--checkout` and needs a new clone. In one process, a request without an ack means that its client waited until its timeout and failed the test. Then `suite()` fails (`verifyResults` and the exit-code check), the phase stops, and no later controller starts. A refused request also records a `HOST-CONTROL` FAIL. In `storagePhase`, a later check that uses the fake executor only, such as `hostControlRefusesWithMarker`, cannot make a real side effect. So the remaining replay paths can only follow a failure that is already recorded.
- **Unfinished requests.** A request written after the last scan stays queued and runs once under the next controller (S6 late). The QA report correctly states that the controller cannot tell it from a legitimate queued request. In practice the scan runs every 25 ms while the suite runs, and an unanswered client fails its stage first.

## 7. Self-tests, harness, typecheck and inventory

| Check | Result |
|---|---|
| Held self-test, held controller (`node --test`, tree with `infra/` from the held clone) | 5/5 PASS |
| Base self-test (3 tests), held controller | 3/3 PASS: CLI construction, AC-M1-35 profile commands and the marker refusal are unchanged |
| Held self-test, base controller | 3 PASS, 2 FAIL: test 4 "No repeated issue revoked the seeded grant" (`revoked`); test 5 "The mismatched request is refused" |
| Mutant: no ack skip | test 4 (`revoked`) and test 5 (second controller ran `m1-e1`, `m1-e2` again) FAIL |
| Mutant: old id pattern | test 5 "The mismatched request is refused" FAIL |
| Mutant: skip only acks with `ok: true` (my own; a plausible wrong fix) | test 4 "m1-b3 ran once" FAIL |
| `node tests/host/run-m1.mjs --harness-only --provider all`, held clone | exit 0; **73/73**; typecheck PASS; 392 API cases, 96 host rows; **488** rows per round; phases sim 394, migration 12, snapshot-upgrade 6, snapshot-isolated 6, storage 70 |
| The same with `--provider canvas`, held clone | exit 0; 73/73; 347 rows |
| The same with `--provider all`, base clone | exit 0; 71/71; 488 rows; the same phase counts |
| Per-owner inventory (`readManifests`, `joinInventory`) in base and held | common 42 (+72 storage), Blackboard 141, **Canvas 233** (225 API sim, 7 browser sim, 1 API snapshot-isolated); joined 488; SHA-256 of the joined inventory `7aeec6d0034a…` in both |
| Worktree: `node --test tests/host/m1-control.selftest.mjs`; `npm --prefix tests run typecheck` (umask 022) | 5/5 PASS; exit 0 |

Grant and audit assertions: the h4 oracle (`snapshot-oracle.mjs:29` `auditWindow`, `snapshot.ts:46` `redeemedWithOneAttempt`) and every file under `tests/acceptance`, `tests/e2e` and `tests/sim` are byte-identical to `51a80b5`. The repair does not relax the committed-event or grant checks. It removes only the harness side effect that broke them.

The new tests prove the claim. Test 4 has the seed-then-upgrade order, a revocation store, an in-flight `stop()`, a queued request and byte checks of every stage-1 control file. Test 5 has requests queued before start and the id-binding refusal. Each of my three mutants and the base controller fails at least one specific assertion.

## 8. Findings

| ID | Severity | File:line | Problem | Evidence | Suggested fix |
|---|---|---|---|---|---|
| A-HCR-01 | NIT | `docs/reviews/M1/host-control-replay-qa.md:186` | The limit for two controllers at the same time says only that both "could take a new request in the same interval". A second controller also runs again any request that the first one is still running, because that request has no ack yet. | S6 "second controller before `stop()` returns": the held controller ran the in-flight command 2 times. No caller does this. Every caller awaits `stop()` (`run-m1.mjs:286`, `storage-rows.mjs:423`, `:1264`, `run-m2.mjs:139`). | Optional wording: "Both could run one request: a new one in the same interval, or one that the first controller is still running." No code change. |

No BLOCKER, MAJOR or MINOR finding. The NIT does not block, and it does not need a new round.

Outside this repair (no finding): `storage-rows.mjs:1259` writes its harness request without a temporary file and rename. A scan could read a partial file and record `Request file` or a JSON error. This exists in the base too, it uses the fake executor, and replay does not change it.

## 9. Evidence (private, mode 0700)

Root: `/Users/quangnguyen/cogniate-qa-runs/host-control-replay-reviewer-a-20261021`. The files hold only synthetic ids, counts, codes and test names. A scan of the repro JSON files for 43-character tokens found none.

| File | SHA-256 (first 12) |
|---|---|
| `harness/ra-repro.mjs` | `186fd6881350` |
| `harness/ra-inventory.mjs` | `f923e3cc24ba` |
| `evidence/ra-repro-frozen.json` / `ra-repro-held.json` (stderr files empty) | `239cb8332c6f` / `4dab9f3f97ff` |
| `evidence/selftest-held.tap`, `selftest-oldtests-held.tap` | `69cf5d2073eb`, `d8935708cc0b` |
| `evidence/selftest-mut-cross.tap`, `-mut-noskip.tap`, `-mut-oldid.tap`, `-mut-okonly.tap` | `8deb27deb33a`, `3a84874720d3`, `bf8b1e83680e`, `c52958bf6266` |
| `evidence/harness-held-all.txt`, `harness-held-canvas.txt`, `harness-base-all.txt` | `1b14c5eb214c`, `cb9696fec378`, `a4864df38486` |
| `evidence/ra-inventory.txt` | `1102b90b9651` |

Main commands (from the private root, umask 022):

```sh
git archive 51a80b5 tests/host | tar -x -C trees/frozen; git archive 9cdd768 tests/host | tar -x -C trees/held
git archive <sha> | tar -x -C clone-<base|held>; cp -R <worktree>/tests/node_modules clone-<…>/tests/
node harness/ra-repro.mjs trees/<frozen|held> scratch-<…> evidence/ra-repro-<…>.json
node --test --test-timeout=30000 trees/<tree>/tests/host/m1-control.selftest.mjs
(cd clone-held && node tests/host/run-m1.mjs --harness-only --provider all)   # also --provider canvas; clone-base all
node harness/ra-inventory.mjs clone-<base|held>
```

## 10. Limitations

- Not run: Docker, any stack, the real `suite()`, `snapshotMigrationRun`, `storagePhase`, `run-m2.mjs`, the real CLIs and the product. The grant store is a synthetic model of App contract §4.8, not the product. The product rule comes from the contract and from the committed QA failure reports.
- The repair removes the harness cause of the h4 failure. It does not show that h4, the rest of snapshot-upgrade, migration, storage, round 2, legacy, M2 or T7 will pass. Two complete matching runtime rounds are still required.
- The W4 strict environment-comparison failure of the `51a80b5` attempt is separate and stays open.
- All M1 rows keep their current status. This report gives no runtime credit.
