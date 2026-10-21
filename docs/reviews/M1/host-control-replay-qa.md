# M1 host control: no replay across controller restarts (QA repair, held)

Common QA, 2026-10-21. **Result: the host-control repair is held for the Lead. Host-side controls PASS. No runtime acceptance ran.** This is a bounded QA repair after the full runner at `51a80b5` failed M1-38 h4 in phase `snapshot-upgrade`. It is not an acceptance retry. The failed attempt and its raw evidence stay **FAIL**. No M1 criterion gets credit from this report. No product defect is shown. The separate W4 environment-comparison failure of that attempt (unrelated Docker activity) is not part of this repair and stays open.

## Identity

| Item | Value |
| --- | --- |
| Role and session | Common QA repair owner, independent of the product authors and reviewers. Requested and effective model: Claude Code Opus 5.5 (`claude-opus-5-5`), xhigh effort. Orca session `orca_session_id:cf056ff9-0518-4c40-b52e-6e00dc340d5a`. |
| Task | Run `run_ebe671ad72a9`, task `task_3a4500f57586`, dispatch `ctx_65780150196a`. |
| Base tested candidate | `51a80b51de2c7491466a21a678418ff8178d247d` (tests tree `a47b34cd56bb3d85e4c3ef1cafef0a2b0c3210c0`) |
| Worktree | branch `nguyenthanhquang152/lti-multi-lms`, HEAD `32e713b6fe3231cae387e7c466d8c44fd31c6b6f`. `git diff 51a80b5 HEAD -- tests infra services apps packages package.json package-lock.json` is empty: the later commits change only `docs/`. |
| Owned files | `tests/host/m1-control.mjs`, `tests/host/m1-control.selftest.mjs` and this report. No other repository file changed. No commit, no push, no Docker, no stack, no live LMS call. |

## Failure

Run `qa-multi-r1-51a80b51-2026-10-21T05-55-43-894Z`, phase `snapshot-upgrade`. h2, h3 and h5 passed. h4 failed in `snapshot-oracle.mjs:39` (`auditWindow`): "Scoped committed phase-1 event count 0 !== 1" (`redeemedWithOneAttempt`, seeded iteration).

QA read only these fields of the redacted artifacts: `action`, `script`, `startedAt` and `code` of each `host-actions/*.json` record (not `stdout` or `stderr`), the file names in `cmd/`, and the Canvas QA diagnosis `M1-38.common.h4-diagnosis.json`.

| Time (UTC) | Fact |
| --- | --- |
| 05:56:38.232 | Seed (`011`): `grant_issued`, purpose `add_deployment`, Canvas connection a (`state.add`). |
| 05:57:02.396 to .406 | Seven `m1-cli app:grant` host actions in 10 ms. This is before the upgrade test file started (05:57:13.002). Codes 1, 0, 1, 1, 0, 0, 1. The seed stage had seven CLI calls. |
| 05:57:03.031 | A second `grant_issued` for the same connection and purpose (the replayed issue). |
| 05:57:17.439 | h4: `POST /app-api/connections/:id/deployments` → 403; `grant_rejected` reason `revoked`; no `grant_attempt_started`. |
| after the run | 32 host-action records. None has a seed-stage time: the replay wrote the same `host-actions/<id>.json` names. |

The Common status `msg_1b76a14fcad1` and the Canvas diagnosis `msg_e1c17677ee46` give this cause independently.

## Cause (sources at `51a80b5`)

- **One controller per suite, one folder.** `run-m1.mjs:277` `suite()` calls `m1HostControl(r)` for each stage. `snapshotMigrationRun` calls the seed probe (`m1-migration.mjs:287`) and the upgrade probe (`:307`) on the same clone. So both controllers read `<clone>/tests/acceptance/artifacts/control`.
- **The folder stays.** `tests/.gitignore` ignores `acceptance/artifacts/`. `git checkout --force` and `installTests()` (`git archive` + `tar`) do not remove it. No caller deletes control files.
- **Answered names are only in memory.** `m1-control.mjs:13` `done = new Set()` is local to one controller. The scan (`:73-81`) takes each `req-m1-*.json` that is not in this set. The server never removes a request file. So a new controller takes every earlier request again.
- **Product behaviour is correct.** App contract §4.8: a new grant for the same connection and purpose revokes older unredeemed grants. Phase 1 refuses a revoked grant with 403 `GRANT_INVALID` before `grant_attempt_started`. So the replayed `add_deployment` issue revoked the seeded grant, and h4 correctly failed.
- **Evidence was overwritten.** The repeated `answer()` wrote `out-<id>.raw.json`, `host-actions/<id>.json` and `ack-<id>.json` again (`:61-68`).

The same bug class was fixed earlier in `run-t5.mjs:144-146` ("Later passes keep this folder. Never replay an action already acknowledged by an earlier pass."). That fix skips a request that has an ack.

## Callers (read only)

| Caller | Controllers on one folder | Exposure before the repair |
| --- | --- | --- |
| `run-m1.mjs:277` `suite()`, phase `snapshot-upgrade` | 2: `snapshot-seed`, then `snapshot-upgrade` | **The h4 failure.** Seven seed requests ran again; one revoked the seeded grant. |
| `suite()`, phase `migration` | 4: `baseline`, `upgrade`, `postwrite`, `rollback` | Same mechanism. `migration.probe.ts` sends no host request, so no request was there to repeat. |
| `suite()`, phases `sim` and `snapshot-isolated` | 1 each | None in one phase. |
| `storage-rows.mjs:416` `a-lock-scope` (real executor), then `:1256` `hostControlRefusesWithMarker` (fake executor), same lane clone | 2 | The marker check would answer the `a-lock-scope` `m1-restart` again. The marker refuses it (code 2, no command), but the answer overwrites the `a-lock-scope` ack, output and `host-actions` record. |
| `run-m2.mjs:134` | 1 | None in one run. |
| `m1-control.selftest.mjs` | 1 per test before this repair | None. |

The repair is in `m1HostControl` itself, so every caller above gets it. No caller changed.

## Change

`tests/host/m1-control.mjs` (+5 −1):

```diff
       req = JSON.parse(fs.readFileSync(file, 'utf8'));
-      if (!/^m1-[a-f0-9]+$/.test(req.id)) throw new Error('Request id');
+      // The scan finds the ack by the file name, so the id must be the same: a different id could overwrite another answer.
+      if (req.id !== path.basename(file).slice('req-'.length, -'.json'.length)) throw new Error('Request id');
@@
       if (done.has(name)) continue;
       done.add(name);
+      // Each suite starts a new controller on the same folder, and request files stay. An ack means that an
+      // earlier controller answered the request; a second run can repeat a once-only command (M1-38 h4).
+      if (fs.existsSync(path.join(dir, 'ack-' + name.slice('req-'.length)))) continue;
```

1. **Skip answered requests (line 81).** The `ack-<id>.json` file is the durable "answered" record of the existing protocol. The controller writes it last, with an atomic rename, after the output and the `host-actions` record (`:62-69`). A request with an ack is not run again. It is not read again, and its files are not written again.
2. **Bind the id to the file name (line 57).** The ack check uses the file name. The answer uses `req.id`. Before, a file `req-m1-aa.json` with id `m1-bb` would run, write the answer of `m1-bb`, and run again under every later controller. Now it is refused before any command. The scan filter already requires `^req-m1-[a-f0-9]+\.json$`, so the old id pattern still holds. All real clients write the same id in the name and the content: `common/client.ts:95-97`, `canvas/browser.ts:56`, `storage-rows.mjs:1258` and the self-tests.

Unchanged: the protocol and its file names, the 25 ms scan, the `done` set, `stop()`, the QA project guard, the CLI whitelist, the marker refusal, command construction, redaction, evidence fields, all callers and all product files.

### Request lifecycle after the repair

| Request state when a controller starts or scans | Behaviour |
| --- | --- |
| Answered by an earlier controller (ack exists), success or non-zero code | Skipped. The command does not run again. Its ack, output and `host-actions` record stay as they are. |
| In flight when `stop()` is called | `stop()` waits for it (`await Promise.all(active)`). The ack exists when `stop()` returns, so the next controller skips it. |
| Queued, no ack (a fresh folder, or written after the last scan of the previous controller) | Answered once, as before. The controller cannot tell a legitimate queued request from a late orphan. |
| Refused before execution (file type, size, JSON, id) | Unchanged: a `HOST-CONTROL` FAIL record and no ack. A later controller refuses it again and records another FAIL. No command runs. |
| Taken, then the controller process ends or a write throws before the ack | No ack, so a later controller takes it again. The command can run a second time (see Limitations). |

## Controls (actually run, no Docker)

Private root `/Users/quangnguyen/cogniate-qa-runs/host-control-replay-qa-20261021T0609Z` (mode 0700). Child processes use umask 022 inside it. Source trees come from `git archive`: `frozen` = `51a80b5` `tests/host`, `infra/compose.yaml` and `infra/scripts/stack-restart.sh`; `clone-base` = all of `51a80b5`; `clone-held` = all of HEAD `32e713b` plus the two held files. `diff -rq clone-base clone-held` outside `docs/` shows only the two held files. All data are synthetic. No raw secret or private backup was opened.

**C1. Reproduction of the replay, before and after.** `harness/replay-repro.mjs` imports the real exported `m1HostControl` of one tree. The executor is a fake with a synthetic grant store (App contract §4.8: an issue revokes older unredeemed grants of the same connection and purpose; an initial issue exits 1 for a bound connection, and on `012` for an old pending connection). Redeem is a local function on the same store. The script runs the h1 shape (5 issues, 2 lists, all exit 0) under controller 1. It stops controller 1, then starts controller 2 on the same folder and the same runner object. Then it sends an h2-shape request, waits 150 ms, and runs the h4 shape (redeem the seeded grant, then issue and redeem a fresh one).

| Measure | Frozen `51a80b5` | Held |
| --- | --- | --- |
| Seed requests run again by controller 2 | **7 of 7** (14 runs in total) | 0 (7 runs in total) |
| Codes of the repeated runs | 1, 1, 0, 1, 0, 1, 0 (the same mix as the real 05:57:02 records) | none |
| Seeded `add_deployment` grant at h4 | **403 `GRANT_INVALID`, reason `revoked`**; events `grant_issued`, `grant_revoked`, `grant_rejected:revoked`, no `grant_attempt_started` | 200; events `grant_issued`, `grant_attempt_started`, `grant_redeemed` |
| Who revoked it | the repeated seed request `m1-0003a` | nobody |
| New h2 request (exit 1) and fresh h4 issue (exit 0) | 1 run each | 1 run each |
| Seed control files changed by controller 2 | 9 | 0 |
| Seed `host-actions` records changed / saves per id | 7 / 2 | 0 / 1 |

The frozen row is the original failure: the same order, the same codes, the same rejection reason and the same missing attempt event.

**C2. Self-test against each tree** (`node --test --test-timeout=30000 tests/host/m1-control.selftest.mjs`).

| Tree | Result |
| --- | --- |
| held tests, held control | **5 of 5 PASS** |
| old tests (3), held control | 3 of 3 PASS: the CLI root and arguments, the AC-M1-35 profile commands and refusals, and the marker refusal are unchanged. |
| held tests, frozen control | tests 1-3 PASS. Test 4 FAIL: "No repeated issue revoked the seeded grant", actual `'revoked'` (the h4 failure). Test 5 FAIL: "The mismatched request is refused" (the mismatched id ran). |

**C3. Mutants of the held control, with the held tests.** Each mutant fails.

| Mutant | First failing case |
| --- | --- |
| no ack skip (line 81 removed) | test 4 "No repeated issue revoked the seeded grant" (`revoked`); test 5 the second controller ran `m1-e1` and `m1-e2` again |
| old id pattern (no binding) | test 5 "The mismatched request is refused" |
| discard every file present at start (in place of the ack skip) | test 4 "Host control answered m1-b7" (the queued request); test 5 "Both queued requests are answered" |
| `stop()` does not wait for running commands | test 4 "stop() waits for the running command" |

### New self-test coverage

Test 4, "a new controller on the same folder never repeats an answered request (M1-38 seed, then upgrade)". It uses one folder, one runner object and a synthetic grant store:

- Stage 1: an initial issue (exit 0) and redeem; the seeded `add_deployment` issue (exit 0, not redeemed); an initial issue for the bound connection (exit 1); a CLI-whitelist refusal; an unknown action. Then a `list` that is still running when `stop()` is called: `stop()` must not return before the command ends, and the ack must exist after it returns. Then a request written while no controller runs.
- Stage 2: a new controller answers the queued request and a new request. The seeded grant must still redeem (the h4 shape). A fresh `add_deployment` grant is issued and redeemed.
- End state: each executed request ran exactly once (7 of 7). The two refused requests ran no command. The grant states are `redeemed, redeemed, issued, redeemed` (no `revoked`). Every stage-1 control file is byte-identical. Each of the nine ids has exactly one `host-actions` record.

Test 5, "requests queued before the first controller run once; a request id must equal its file name":

- Two requests written before the controller starts are answered.
- `req-m1-e3.json` with id `m1-e1` is refused (`Request id`) and runs no command. The ack of `m1-e1` stays byte-identical. No `ack-m1-e3.json` exists.
- A second controller on the same folder runs neither queued request again. It refuses the mismatched file again, with no command (the documented limit).

## Harness-only checks, typecheck and inventory

| Check | Result |
| --- | --- |
| `npm --prefix tests run test:harness` | exit 1, `Missing script: "test:harness"`. `tests/package.json` has no such script at `51a80b5` or HEAD. QA did not add one (outside the owned paths). The runner entry below is the harness check that earlier QA reports used. |
| `node tests/host/run-m1.mjs --harness-only --provider all`, `clone-held`, umask 022 | exit 0. Self-tests **73 of 73** PASS (71 before; +2 are tests 4 and 5). Typecheck PASS. "392 API cases, 96 host rows (72 AC-M1-41); **488** mandatory rows per round; phases sim 394, migration 12, snapshot-upgrade 6, snapshot-isolated 6, storage 70". |
| `--harness-only --provider canvas`, `clone-held` | exit 0. 73 of 73. 347 rows (common and Canvas). |
| The same two commands, `clone-base` (`51a80b5`) | exit 0. 71 of 71. 488 and 347 rows, the same phase counts. |
| Joined inventory by owner (`readManifests` and `joinInventory`, `harness/inventory.mjs`) | common 114, Blackboard 141, **Canvas 233** (225 API `sim`, 7 browser `sim`, 1 API `snapshot-isolated`); total 488. Canvas run 347. The JSON for base and held is byte-identical (SHA-256 `9aa87f054dc0…`), with the same row hash and the same SHA-256 of all 28 case files. |
| All files under `tests/acceptance`, `tests/e2e` and `tests/sim` | The same SHA-256 list in base and held. No case, manifest or assertion changed. |
| `npm run typecheck` in `tests/` of the worktree, umask 022 | exit 0 |
| `node --test tests/host/m1-control.selftest.mjs` in the worktree | 5 of 5 PASS |
| `git diff --check` on the two held test files | exit 0 |
| `git status --short` | only the two held test files and this report. `pnpm-workspace.yaml` (untracked, not QA's) is untouched. |

Root product checks did not run again: the product is unchanged.

## Evidence (private, mode 0700)

Root: `/Users/quangnguyen/cogniate-qa-runs/host-control-replay-qa-20261021T0609Z`. The files hold only synthetic ids, counts, codes and test names. A scan for 43-character tokens found none.

| File | SHA-256 (first 12) |
| --- | --- |
| `harness/replay-repro.mjs` | `28e86a7b4606` |
| `harness/cross.py` (builds the cross and mutant trees) | `99e04937fc0c` |
| `harness/inventory.mjs` | `c8030bdce45e` |
| `evidence/repro-frozen-51a80b5.json` | `b066b41a1338` |
| `evidence/repro-held.json` | `ee973a376b10` |
| `evidence/selftest-held.tap` | `2ed4fc735445` |
| `evidence/selftest-cross-old-tests-new-code.tap` | `816a8e91ecb0` |
| `evidence/selftest-cross-new-tests-old-code.tap` | `60530d84b869` |
| `evidence/selftest-m1-no-ack-skip.tap` … `m4-stop-no-wait.tap` | `2a346e2bcc40`, `452c23631521`, `b5db76aa302d`, `bc4921527aea` |
| `evidence/harness-only-held-all.txt`, `-held-canvas.txt` | `0da17d4bbef0`, `c57f565997a8` |
| `evidence/harness-only-base-all.txt`, `-base-canvas.txt` | `993a0e19885b`, `6409fa090848` |
| `evidence/inventory-base.json` = `inventory-held.json` | `9aa87f054dc0` |
| `evidence/npm-test-harness-held.txt` | `acb48fb8b5cf` |
| `evidence/typecheck-worktree.txt`, `selftest-worktree.txt` | `5c2ed9445e8a`, `1e8fcdba8aff` |

## Held files

| File | SHA-256 before (`51a80b5` = HEAD) | SHA-256 after |
| --- | --- | --- |
| `tests/host/m1-control.mjs` | `d4a7ee6e35439bde712410dcedeaddb3e2373eab26ed8fdee93eab9839070aa4` | `21baa87db6198ba0e8628149c49a55490f824ef0ad63ac413d2e2bdaf6a99d06` |
| `tests/host/m1-control.selftest.mjs` | `cca7355e8a66fff0bde42a43bd968de46130c35da20421caf06e8bc6dd61ef8d` | `4473c99311bcef97ed010057566e7fee760f6c7e1751a2d24c05f750931aa323` |
| `docs/reviews/M1/host-control-replay-qa.md` | new file | given in the completion message (a file cannot contain its own hash) |

## Limitations

- **Not exactly-once after a crash.** The guarantee covers normal sequential restarts: `stop()` returns, then the next controller starts. A request that a controller took but did not acknowledge has no ack. This occurs if the host process ends during the command, or if writing the output or the `host-actions` record throws. A later controller then runs the command again. `run()` (`lib.mjs:12-35`) resolves on spawn errors and timeouts, so an ordinary command failure still gets an ack.
- **Unacknowledged requests stay queued.** A request without an ack is run by the next controller. A late orphan looks the same as a legitimate queued request. A controller scans every 25 ms during the whole suite, so an orphan needs a client that wrote its request less than 25 ms before `stop()`, for example when the 2-hour suite timeout stops the test process.
- **A refused request is recorded again** by each later controller in the same folder (`HOST-CONTROL` FAIL), with no command. The first FAIL already fails the run.
- **Two controllers at the same time on one folder are not supported** (unchanged). Both could take a new request in the same interval. Every caller awaits `stop()` before it starts the next controller.
- **The skip depends on ack files.** If something removed an ack but kept its request, the request would run again. No caller removes control files today.
- **Not run:** Docker, the runner phases, the real `suite()`, `snapshotMigrationRun`, `storagePhase`, `run-m2.mjs`, the real CLIs and the product. C1 and tests 4-5 call the real exported `m1HostControl` in a host process with a fake executor and a synthetic grant store. They do not show the product rules; the product rules come from App contract §4.8 and the failed run's logs.
- **h4 and the rest of the snapshot-upgrade route have no new evidence.** The repair removes the harness cause. It does not show that h4, the Round 1 to Round 2 sequence, legacy, M2 or T7 will pass.
- The W4 strict environment comparison of the failed attempt failed because of unrelated Docker activity. This repair does not address that failure.

## Next

1. The Lead commits the three held files by exact path.
2. Two reviewers review the repair independently.
3. The Lead freezes a new candidate SHA.
4. A new Docker window runs the full acceptance again from a fresh clone.

Until then, all M1 rows keep their current status.
