# Storage lock command: conformance disposition of Q-R1A-01 and O-1

Status: **proposed Architect recommendation** (2026-10-21). It is not an acceptance, a waiver or a change to a QA verdict. The Lead decides, after independent confirmation. Owner: Architect, task `task_e2539d24287c`, dispatch `ctx_98db334b4b83`.

Scope: only the two pre-existing lock-release observations of the R1-A host QA. No new root-cause audit, no new run, no product or test change.

## 1. Pinned inputs

| Input | Identity | Parts used |
| --- | --- | --- |
| QA report | `docs/reviews/M1/storage-command-qa.md` at `be418479b1f8e5b2c267086e99b0a661b48c531f`, SHA-256 `bdc727ed97a9e4b79f11b40c8275144751a3b1dd6265e7f1c1f1c02049b5dd4a` (Round 1, FAIL) | §1, §6, §7 (Q-R1A-01), §11 (O-1) |
| Target product | `01ce5bc2d2d26e4fb1226c5f4f19528fb9ed576b` | `infra/scripts/storage-oplock.sh` (SHA-256 `90d246792c41d63268411bdfec4e9e04764f89d57d51343a0f60c1b88969ca96`); `storage-oplock.test.mjs` (`e2b2224b257b45e5a249af744762c146bf0be0bf33662f5345c589f8ac7c2131`); `storage-compat.sh` (`65be43f2776d935fc28080312012bc6e6dd0fb227cf21057bf388ad8ce9d8c36`); the `storage_lock_acquire` call lines of the guarded scripts |
| Parent | `4410e85f2054a82c00466b4e19a474416140afea` | `storage-oplock.sh` (`1d2be154e754b9f2c07451384b3c24e8ea483073d16d24f49b276f15d8956753`) |
| ADR-012 | at `4410e85`, SHA-256 `165a78ee975c14b766c53dfd1e5705a46d1fe5d31a0f571532462c19894343aa` | §7 lines 237 (holder `pid`), 254 (A6), 285–290 (release, trap), 301 (scope), 308–317 (events); §12 line 585 (wrapper exit code). At HEAD `95617df`, only the status line, the revision history and §4 differ (revision 3.6). §7 and §12 are unchanged. |
| Charter | `docs/team/charter.md`, SHA-256 `5289f7f72471d15d8fbff41dde898514cee0270d28ea62bcfd006f259cd23054` | §5 (severity) |
| Frozen triage (read only) | `storage-full-round-triage.md` at `2d763fe`, SHA-256 `ade4e8a0f9e54823040828758b7683d5c9b230587747f3ef3c89ef8e99f9a032` | §9 step 6 (freeze of `C`); line 102 (`stack:reset` deleted `infra/.logs`) |
| QA evidence (existing, no new run) | root `/Users/quangnguyen/cogniate-qa-runs/r1a-storage-command-qa-20261021T1305Z`, `MANIFEST.sha256` `57039ac7e02a9880cf9d28ab2293cc189c57994415dfb3ff0bb2a84ae0692d4b` | `evidence/results/T.json` (`20e75321…`): exit codes of N5, N8, S6, S7, D1, D3. `work/T/D1-docker-failclosed/infra/.logs/storage-lock.jsonl` (`81e7faf2…`), `work/T/D3-docker-active/…` (`180188f5…`). All three hashes equal their manifest lines. |

## 2. Result

| Id | Is the supported contract violated? | Severity | Recommended decision |
| --- | --- | --- | --- |
| Q-R1A-01 | **Yes.** The holder contract (ADR-012 §7 release step 1, the trap rule, §12) fails on all three supported lock paths. The text does not refer only to the internal `release` subcommand. | **MAJOR** | Repair before candidate runtime acceptance: before the freeze of candidate `C` (triage §9 step 6). Bash part only. Decide wording W-1 first. |
| O-1 | **Yes,** by the literal text (A6 "release" and release step 3). Only the event log is affected. | **MINOR** | Documented deferral to M4. No ADR change. Do not put it in the Q-R1A-01 repair. |

## 3. Q-R1A-01: exit status after `storage_lock_lost`

### 3.1 Normative text (ADR-012 at `4410e85`)

- Line 285: "**Release.** The holder releases after its last storage container has exited …"
- Line 286, step 1: "Read the record; continue only when it has its own `runId`. Else log `storage_lock_lost` and exit 1; another owner's lock is never removed."
- Line 290: "An `EXIT`, `INT` or `TERM` trap releases the lock in the same way …"
- Line 237: the holder (`pid` of the record) is the guarded command, the §12 wrapper or `storage-oplock.sh run`.
- Line 585 (§12 wrapper): "The exit code is the command's, or 1 when a check fails ("stop now")." Release step 1 is a check of the record.

### 3.2 Call and trap semantics at `01ce5bc`

- The JavaScript `release()` logs `storage_lock_lost` and returns false (`storage-oplock.sh:170–176`). The internal `release` subcommand then exits 1 (`:315`).
- The subcommand is internal. Only `storage_lock_release` calls it, through `_storage_oplock_js` (`:388`). The CLI accepts only `run` and `selftest` (`:397–417`). The ADR does not name a release subcommand.
- `storage_lock_release` discards that status with `|| true` (`:388`) and returns 0.
- **`run` path.** The child status goes to `code` (`:408–411`). Then the release (`:412`) and `exit "$code"` (`:413`). The later `EXIT` trap returns at once, because `STORAGE_LOCK_HELD` is 0 (`:385`). Evidence: N5 (lost, child 0) exits 0; N8 (lost, child 7) exits 7.
- **Trap path.** `storage_lock_acquire` sets `trap 'storage_lock_release' EXIT`, `trap 'exit 130' INT` and `trap 'exit 143' TERM` (`:375–377`). Every candidate guarded script releases only by this trap: `stack-up.sh:13`, `stack-restart.sh:14`, `stack-reset.sh:15`, `stack-data.sh:32`, `storage-compat.sh:125` and `:142`. The §12 wrapper does the same (`storage-compat.sh:166`, then `exit "$code"` at `:179`). The handler does not call `exit`, so bash keeps the status that started the exit. Evidence: S6 (sourced, lost) exits 0; S7 (lost + TERM) exits 143.
- So no supported caller can see the exit 1 of the internal subcommand.

### 3.3 Answer

The observation violates the supported contract. The text does not refer only to the internal subcommand:
1. Step 1 is a step of "the holder" (line 285). The holder is the process in the record (line 237). The subcommand is a short-lived `node` child. It is not in the record.
2. The ADR does not define a release subcommand, and the CLI does not expose it.
3. Under the internal-only reading, "exit 1" has no observable effect for any caller. A contract rule binds observable behavior.
4. Line 290 applies the same steps to the trap path. Line 585 gives exit 1 for a failed check of the wrapper.

The text is clear for the main case: a holder that would exit 0 must exit 1. The text does not say what happens when the holder already has a nonzero status (child failure, 130, 143). Wording W-1 (§3.6) closes that gap.

### 3.4 Effect and severity: MAJOR

- **Trigger.** A lost lock needs a change of the lock folder by something other than the holder. Examples: a manual removal of `.tmp/` or of the lock folder during a run (a wrong use of the `operation_lock_invalid` manual exit, or `git clean`), or a lock defect. A takeover cannot move a live holder (A5). So the trigger is rare.
- **Meaning.** When it happens, the holder's work ran without proven exclusion. A second command can hold the lock now and can have run at the same time (N5 shows this state: a foreign record holds the lock). For restore, import, quarantine, backup, QA fixture writes and old-build starts, this is the case that the lock must prevent.
- **Signal.** Exit 0 reports success to every caller that uses the status: `npm` script chains, the internal starts of `test:acceptance`, `e2e:reset` and `demo`, QA harness rows, and the §12 "stop now" rule. The event is on stdout and in `storage-lock.jsonl`, but no supported caller must read it. A later `stack:reset` can delete `infra/.logs` (triage line 102).
- **Self-check.** The Author unit test at `01ce5bc` asserts status 0 for the lost case (`storage-oplock.test.mjs:211`). So the self-check enforces the wrong status.
- **Not BLOCKER:** the lock code stays safe (no foreign record is removed, and the lock code changes no data), the event is logged, and the trigger is rare.
- **Not MINOR:** it is not safe to defer. The rule is false on every supported lock path, at the one moment when exclusion is known to be broken. "Pre-existing" does not change this.

### 3.5 Decision (recommended)

- Repair before candidate runtime acceptance. The repair must be in candidate `C` before triage §9 step 6, so the diagnostic and both full rounds run on it. `C` is not frozen yet. The repair is small and host-only.
- Do not change the contract to allow exit 0 after `storage_lock_lost`. That would remove the only status signal of broken exclusion.
- The frozen R1-A QA verdict (Round 1, FAIL) stays unchanged. The repair gets a new QA round.

### 3.6 Proposed wording W-1 (separate proposal; Lead decision and independent confirmation)

Current §7 release step 1 (line 286):

> 1. Read the record; continue only when it has its own `runId`. Else log `storage_lock_lost` and exit 1; another owner's lock is never removed.

Proposed:

> 1. Read the record; continue only when it has its own `runId`. Else log `storage_lock_lost`; another owner's lock is never removed. Then the holder (the guarded command, the §12 wrapper or `storage-oplock.sh run`) exits 1 when its exit status would otherwise be 0. It keeps a nonzero status that it already has: the command's own failure, 130 after `INT`, or 143 after `TERM`. A trap release follows the same rule.

§12, line 585: after "… or 1 when a check fails ("stop now")", add: "After `storage_lock_lost`, the exit code follows §7 release step 1."

- For the main case, W-1 says the same as the current text.
- W-1 narrows the literal "exit 1" for a holder that already fails. Reason: the caller already sees a failure; 130 and 143 keep their signal meaning; a child failure code keeps its diagnosis; the `storage_lock_lost` event names the lost lock in every case.
- The current code is not the reason for W-1. The code fails the main case with or without W-1.
- If the Lead rejects W-1, the literal text applies: exit 1 in every lost case. Then R-6 and R-7 below expect 1.
- The ADR edit is a separate Architect task. This file does not edit the ADR.

### 3.7 Smallest repair scope (Backend Author; not authorized by this file)

| File | Change |
| --- | --- |
| `infra/scripts/storage-oplock.sh`, bash part only | (a) `storage_lock_release` keeps the status of the release subcommand (no `\|\| true`) and records a lost result. (b) The `EXIT` handler reads the exit status at entry, releases, and calls `exit 1` only when the release was lost and that status is 0. The result must not depend on the caller's `set -e` state (under `set -e`, a failing command in the handler can end the shell with its own status). (c) `run`: a lost release changes `code` 0 to 1; a nonzero `code` stays. A lost release must not end `run` through `set -e` before `exit "$code"`. |
| `infra/compat/storage-compat.sha256` | Only the `storage-oplock.sh` line, in the same commit. |
| `infra/scripts/storage-oplock.test.mjs` | Change the lost assertion at `:211` from status 0 to 1. Add the host cases of §3.8 that the unit suite can run. |

No change: the JavaScript part (acquire, release, events, lock algorithm), the event shape, the R1-A command field, `storage-compat.sh` and the candidate guarded scripts (they get the new handler through `storage_lock_acquire`).

### 3.8 Acceptance cases (host only; Docker stub that fails closed or simulates the listing; no real Docker)

Run each case on the `run` path and on the sourced path. Run the sourced lost cases with and without `set -e`.

| Id | Case | Expected |
| --- | --- | --- |
| R-1 | Normal, child exits 0 | `storage_lock_acquired`, `storage_lock_released` with the own command; exit 0; no lock or `rel-` folder |
| R-2 | Child exits 7, lock not lost | released; exit 7 |
| R-3 | `TERM` or `INT` (to the group and to the pid), lock not lost | released after the child ends; 143 or 130 |
| R-4 | Lost: a valid foreign record F holds the lock; child exits 0 | `storage_lock_lost` (own command, `runId`, `pid`; `owner` = F); no released event; F byte-identical; no `rel-` or `stale-` folder; **exit 1** |
| R-5 | Lost: the lock folder is absent; child exits 0 | lost with `owner` null; no lock created; **exit 1** |
| R-6 | Lost; child exits 7 (or a `set -e` error, status 1) | events and F as R-4; status kept (7, or 1) (W-1) |
| R-7 | Lost; then `TERM` or `INT` | events and F as R-4; 143 or 130 (W-1) |
| R-8 | An explicit `storage_lock_release`, then the `EXIT` trap | exactly one released or lost event; status as R-1, R-4 or R-6 |
| R-9 | Acquisition errors: refusals before the lock (`operation_in_progress`, `operation_lock_reentry`, `operation_lock_invalid`); A6 active container; A6 listing failure; `docker rm` failure | unchanged from `01ce5bc`: exit 1; the same events and stderr text; no `storage_lock_lost`; no new released event (O-1 stays deferred); the own lock is gone; another holder's lock stays |
| R-10 | Nested `run` inside holder A | nested run refused `operation_lock_reentry`, exit 1; A's lock stays A's; A releases normally; A's status unchanged |
| R-11 | §12 copied wrapper `storage-compat.sh run -- npm run stack:up` (old-SHA clone, stubs); lost after a command that exits 0 | exit 1; F kept |
| R-12 | Hash list and old-build route | the new helper hash equals its list line; `enable` copies are byte-identical; hash mutants are refused |
| R-13 | R1-A non-regression | every R1-A command-field check passes; against `01ce5bc`: 0 differences, except the exit status of lost cases whose status was 0 |
| R-14 | `storage-oplock.sh selftest` | exit 0; five scenarios `ok` |

Mutants that must fail: `|| true` kept (R-4, R-5); lost overrides every status (R-6, R-7, when W-1 is accepted); only the `run` path repaired (sourced R-4); only the trap path repaired (`run` R-4); a status that changes with `set -e` (sourced R-4 or R-6); a release that removes or moves F (R-4).

### 3.9 Gates (in order)

1. The Lead decides this disposition and W-1. Reviewer-A and Reviewer-B confirm W-1 (bounded) before the Author brief.
2. Author: §3.7 only; `npm run test:infra` and the root `npm run check`; the hash list in the same commit.
3. Two blind, bounded source reviews of that diff only.
4. Independent host QA, new round. QA freezes its criteria from §3.8 and the confirmed wording, not from code. Target: the repair SHA. Parent: `01ce5bc`. The Round 1 report stays unchanged.
5. The repair is in candidate `C` before triage §9 step 6. If `C` is already frozen, the step 6 rule applies. This file does not change the triage.

## 4. O-1: quiet release after an A6 or cleanup error

### 4.1 Normative text

- A6 (line 254): "an **active** one → refuse `storage_writer_active` and release".
- Release step 3 (line 288): "Log `storage_lock_released`." The release rule has no quiet exception.
- The ADR has no specific rule for a failed listing, a failed `docker rm` or a failed cleanup after the lock is held. The general release rule applies.

### 4.2 Code semantics at `01ce5bc` and evidence

- `acquire()` logs `storage_lock_acquired` (`:142`), then runs A6. An A6 error (active container, failed `docker ps`, failed `docker rm`) calls `release(ctx, { quiet: true })` (`:151`). A cleanup error does the same (`:163`).
- `quiet` suppresses only the released event (`:179`). The own-`runId` check stays, so a foreign lock still gives `storage_lock_lost`.
- The bash trap is not set in these cases: `storage_lock_acquire` exits 1 before `STORAGE_LOCK_HELD=1` (`:370–374`).
- Evidence: the D1 log has only `storage_lock_acquired`. The D3 log has `storage_lock_acquired` and `storage_lock_refused` (`storage_writer_active`). Both exit 1, and the lock folder is gone. The `docker rm` and cleanup cases come from source reading only.

### 4.3 Answer

It is a deviation from the supported event contract, not from an internal subcommand. The events are the observable record of every guarded command (stdout and `storage-lock.jsonl`). Only the log is wrong. The lock state, exit 1, the stderr text and the refusal event are correct.

### 4.4 Effect and severity: MINOR

- **Trigger.** D1 is common: Docker is not running when a guarded command starts. D3, the `docker rm` failure and the cleanup failure are rare.
- **Effect.** The log shows an acquire without a terminal event (D1, `docker rm`, cleanup), or with only a refusal (D3). A log reader can think that the lock is still held. The lock folder decides, and it is gone. The next command acquires normally. stderr names the cause and says "No data was changed".
- No safety, data or exit-status effect. So it is safe to defer.

### 4.5 Decision (recommended)

- Documented MINOR deferral to M4. The Lead records it in the phase plan. Docs records it in `docs/human_review/deferred.md`.
- No ADR change. The requirement stays: every release logs `storage_lock_released`. This file does not change the requirement to fit the code.
- Future repair: each of these releases logs exactly one `storage_lock_released` with the own command, after its `storage_lock_acquired` in the same run. The refusal event and exit 1 stay.
- Do not put O-1 in the Q-R1A-01 repair. O-1 needs a change in the JavaScript part and a decision on the event order. The Q-R1A-01 repair is bash only, so its re-check can show that the JavaScript part and every event sequence are unchanged (R-13).

## 5. Preserved

- The R1-A host QA Round 1 report and its FAIL verdict stay unchanged. This file gives no QA credit.
- The two R1-A source approvals (`7fbf7c8`, `0a97fe9`) stay valid for the `01ce5bc` diff. The repair diff needs its own reviews.
- The frozen triage at `2d763fe` stays unchanged.
- This task changes no product, test, review, team or ADR file. `pnpm-workspace.yaml` is unchanged.

## 6. Uncertainty

- The `EXIT` handler and `set -e` behavior in §3.7 comes from bash semantics and the QA facts S6 and S7, not from a new run. R-4 and R-6 on the sourced path, with and without `set -e`, settle it.
- I did not check whether an AC-M1-41 row oracle or the harness needs a terminal lock event after an A6 refusal. If one does, O-1 can fail a row, and the Lead must rate it again.
- QA did not measure the §12 wrapper with a lost lock. R-11 comes from source reading (`storage-compat.sh:166`, `:179`).
- MAJOR or BLOCKER has no gate effect here: both block "done". I chose MAJOR because the trigger is rare and the lock state stays safe.
