# M1 dead-handler harness repair (AC-M1-37), C9 and v5 SIM launcher: Reviewer-A (lens A: is it right and is it safe?)

Verdict: APPROVE
Round: 1

Reviewer: Claude Code Opus 5.5 (`claude-opus-5-5`), xhigh. Task `task_58ee0d75cf41`, dispatch `ctx_de7c7933e455`, run `run_ebe671ad72a9`.
I am not the Architect and not the test editor. Blind review: I read no Reviewer-B file or message.
Scope: the Architect plan `docs/reviews/M3/t6-09-failure-plan.md` §12 at `5116227`, the immutable test commit C9 and the held v5 SIM launcher.
Criteria: AC-M1-37 (`docs/architecture/tasks/M1.md:132-160`), app contract §4.7.1, and ADR-012 §5, §6 and §7.
Time of this report: 2026-10-23, about 02:33–02:45 UTC. Checkpoints sent earlier: `msg_33e87324592d` (02:10 UTC) and `msg_3a38914733d0` (02:12 UTC).

## 0. Bound identities

`V4` = `/Users/quangnguyen/cogniate-qa-runs/qa-common-c6-v4-20261022T1554Z`. `V5` = `/Users/quangnguyen/cogniate-qa-runs/qa-common-c6-v5-20261023T0155Z`.

| Item | Identity | My check |
| --- | --- | --- |
| Product C6 | `4008afb92fe983d52db33442e060210b929966c8` | C9 = C6 outside `docs/**` and `tests/**` (empty diff). |
| Tests C8 | `5561e8f72a83de36a68877c6b26ffc8288ade735` | Base of the repair. |
| Tests C9 | `9eb504f5bff4be7e291570fde12fdf9919a07fa1`, parent `31f5352`, tests tree `667e83a9a6a0187d742eb68a17293e4b7302100f` | C8 → C9 outside `docs/**` = exactly the six planned paths. Branch HEAD `6c6adbb` changes only `docs/team/**` after C9. |
| Six blobs C8 → C9 | `tests/host/m1-control.mjs` `5c9631f6` → `2ed430f0` (+21/−0); `tests/host/m1-control.selftest.mjs` `89ad3ea4` → `7c57dc89` (+94/−0); `canvas/51-canvas-races.test.ts` `30d85cbf` → `8ba7f782` (+17/−3); `canvas/52-canvas-snapshot.test.ts` `85793d51` → `ebe6e711` (+10/−2); `blackboard/50-races.test.ts` `4d2b7b42` → `76c0d4a2` (+10/−4); `blackboard/52-snapshot.test.ts` `0517cafc` → `3feba63d` (+14/−3) | `git rev-parse`, `git diff --numstat`. |
| v5 launcher | `V5/tools/launch-sim-c6-v5.sh`, 14,586 B, mode 0700, SHA-256 `9ea9e58d0e734869d4e5fa2d29c187039fb7a835e8d2dfa2c429a550903d5434` | Equal to Lead `msg_1dc6de8e05b7`. |
| v4 → v5 patch | `V5/prep/02-v4-to-v5-launcher-diff.patch`, 13,455 B, SHA-256 `4364c0d730f47594fe11370145ca695349af3dcaeaa382f237fd2481c7d2e07a` | My own `diff -u` of the two held files is byte-identical to this patch (same size and the same SHA-256). |
| READY | `V5/prep/READY-C6-C9-V5.md`, 12,605 B, SHA-256 `e150be0911f3e09a3bd97eba24de2a4b8bb8d67411809907dae1b5e21f7a84a5` | Read for the held commands and claims. |
| Prep index | `V5/evidence-index-v5-prep.tsv`, 6,119 B, SHA-256 `bb1aa2b28dde76aec955f9784099f8a182021c77da8cb9d3e54877d2efc42be6` | Identity only. |
| v4 base | `V4/tools/launch-canvas-sim-c6-v4.sh`, 12,597 B, SHA-256 `d812874703f2224fe891a67ea104c2a2af39b6c41b19d5316c31485a6220f7b9` | Equal to the approved v4 identity. |
| Clean source | `V5/c9-clean-src/source` | HEAD C9, detached, tests tree `667e83a9`, 0 status lines, no untracked test file, no `.env`, no `tests/host/artifacts`, push URL `DISABLED-no-push`. Its only ignored entry is `tests/node_modules/`. That folder is byte-identical to the V4 qualified copy (`diff -rq` exit 0) and has no group or other bits. `tests/package.json` and `package-lock.json` did not change C8 → C9. |

## 1. Method and limits

- I read committed blobs with `git show` and `git diff`. I read the held V4 and V5 files directly.
- I ran no Docker, test, build, install or runtime command. I did not run the self-test, the typecheck or the harness-only inventory. QA reports them (184/184 self-tests, typecheck exit 0, 416 + 72 = 488 rows, `PHASE_TOTALS` 394/6/6/12/70). I did not reproduce them.
- My only executions were read-only `git`, `diff`, `shasum`, `stat`, `find`, `grep`, `ls`, `cat`, `sed` and `awk`, one `python3 -I` script that compares the launcher guard literals with `git` output, and `bash -n` (parse only) on the v5 launcher.
- I did not read the primary round-1 or round-2 logs. I checked that the Architect's log times agree with the source timeouts (§4).
- My statements about Docker engine behavior (§3.4) come from documented engine rules, not from a measurement.

## 2. Exact diff C8 → C9

- **Controller.** `m1-control.mjs` gets a pure insertion of 21 lines at `:34-54`. It comes after the QA-project and `h1Verified` guard (`:17`), the `m1-cli` branch (`:18-28`) and the storage-compat refusal (`:31-33`). The old restart branch (`:55-59`) and the profile branch are byte-identical.
- **Seven case sites, exactly.** Canvas `d` (`canvas/51:144`), `s-dead` (`canvas/51:310`), `v4` and `v6` (`canvas/52:78`, one loop), Blackboard `d` (`blackboard/50:105`), `o` (`blackboard/50:219`) and `v5` (`blackboard/52:64`).
- **Send sites.** The kill request text is at five places: `blackboard/50:105`, `:219`, and the three copies of helper K (`canvas/51:87`, `canvas/52:19`, `blackboard/52:16`). The three helper copies have the same bytes. No other test or host file sends `mode` in an M1 host request.
- **Removed lines.** Only 12 lines leave. Eight are case lines: four `restartApp()` lines, the two Blackboard `host('m1-restart', { service })` lines, and the two Blackboard `caller_gone`/`await first` lines. Four are import lines that grow. Each replacement keeps the old wait (`caller_gone` or the health poll) and adds guard G.
- **Kept.** No title, case id, deadline, retry, `pause`, `leaseWindow`, late-write control (`release`, `upstream`) or assertion is removed. `M1/common/**`, `restartApp()`, the type of `host()`, `canvas/browser.ts` and all manifests are unchanged. The unused `restartApp` import in `canvas/51` stays; the tests config has no `noUnusedLocals`.

## 3. Fault model (lens A)

### 3.1 SIGKILL makes the dead handler

- `cogniate-app` uses the node-service anchor: `init: true` and `restart: unless-stopped` (`infra/compose.yaml:17,19,155`). Its command is `node --watch src/main.ts`. So PID 1 is `docker-init`.
- `docker compose kill -s SIGKILL` sends SIGKILL to PID 1 of the container. When PID 1 of a PID namespace ends, the kernel kills every other process in that namespace. So the watch parent and the app end at once.
- No signal handler runs. `closeOnSignal` (`packages/shared/src/http.ts:47-56`) does not run, and the old process writes no `service_stopping`.
- The kernel closes the app's outbound socket, so the gate shows `caller_gone`. The old process can no longer reach its 5 s timeout (`packages/shared/src/outbound.ts:148`) or `fail()` (`services/cogniate-app/src/app/redemption.ts:172-177`).
- This is the state of the contract row "App stops during a call": "none (the handler is dead)". The guarded restart after the kill is unchanged.
- Before C9, the dead state needed SIGTERM less than about 3 s after the held call started (5 s timeout − 2 s drain). The kill removes the drain and the preflight time from that budget. I agree with the Architect's diagnosis AR-M3-SD-01.

### 3.2 The phase-1 lease survives the kill

- Phase 1 commits (`BEGIN IMMEDIATE`) before any LTI call (contract §4.7.1). Blackboard `v5` asserts `grant_attempt_started` before the kill (`blackboard/52:61-63`).
- The app database uses WAL (`packages/shared/src/migrations.ts:77`). A committed transaction is in the `-wal` file in the kernel page cache. A process kill does not lose it. `fsync` matters only for a host or VM crash, and the kill does not stop the VM.
- No transaction is open during an LTI call (contract), so no partial lease write can exist. The next process reads the committed WAL frames when it opens the database.
- Only handler paths clear a lease (`redemption.ts:174,187,209,297,312,383`; `domain/bindings.ts:200`). No shutdown or start hook clears one. An old attempt becomes `abandoned` only when a new attempt takes an expired lease (`bindings.ts:193-195`).

### 3.3 Storage preflight after the kill (ADR-012 §5 and §6), from source

I confirmed the Architect's inference in `infra/scripts/sqlite-lock-probe.mjs` at C6:

- `check` reads each volume root with `lstat` only: name, type, uid, gid, mode and size (`readFolder`, `:73-91`). It reads the identity and journal JSON. It sets `hasDb` from the presence of the main database file (`:87`).
- `allowedType` (`:47-57`) accepts `cogniate.db-wal` and `cogniate.db-shm` as regular files. Row 4 (`:145`) checks only name and type. Row 6 (`:162`) checks only the owner. No row reads `-wal` or `-shm` content or size, and no step opens `cogniate.db`.
- The lock probe opens only its own `.lock-probe-<runId>.db` scratch (`:361-381`). Step 5 deletes only probe scratch and `.tmp` files (`:432-445`). `prepareFolder` (`:249-277`) changes only the root folder and the two mountpoints.
- The preflight container has `network_mode: none` and makes no Docker or process query. The operation lock lists only containers with the label `org.cogniate.storage` (`infra/scripts/storage-oplock.sh:79-83`). `stack-restart.sh` (`:11-37`) has no running-state check; it does not call `require_running`.
- A killed app leaves the same allowed entries as a graceful stop. `closeOnSignal` calls `process.exit` without a database close, so `-wal` and `-shm` stay in both cases. Their owner is `HOST_UID:HOST_GID` (`compose.yaml:18`). So the pair is row 17 `OK`, as after a graceful stop.
- ADR-012 §7 already states that the preflight is safe while services run. After a kill no service holds `appdb`, which is the simpler case.
- `up -d --no-deps --force-recreate --wait` (`stack-restart.sh:74`) removes the exited container and creates a new one. This is the same start path as before C9.

### 3.4 Docker restart policy (assumption, not measured)

- `restart: unless-stopped` applies to `cogniate-app`. Docker treats `docker kill` as a manual stop and does not apply the restart policy. ADR-012 §7 (`:337`) also states that dockerd restarts only containers that were running.
- If Docker did restart the container, the effect is one extra `service_started` before the guarded preflight. The preflight then runs with a live app, as before C9. The lease stays. No safety rule breaks.
- The judge can confirm one new `service_started` after each `kill:` line.

### 3.5 Controller block

- **Reach.** Only `req.action === 'm1-restart' && 'mode' in req` (`:34`). `JSON.parse` makes own properties only, so request text cannot add `mode` through the prototype.
- **Validation.** `mode` must be `'kill'` and `service` must be `'cogniate-app'`. Otherwise the answer is `code: 2`, `Unknown M1 host action`, and no command runs (`:35-37`).
- **Kill.** `runCommand('docker', [compose…, 'kill', '-s', 'SIGKILL', 'cogniate-app'], { cwd: r.CLONE, env: r.STACK_ENV, timeoutMs: 30_000 })` (`:39-40`). These are the compose arguments that `m1-cli` `exec` already uses (`:14`). The project comes from `STACK_ENV.COMPOSE_PROJECT_NAME`, which equals `PROJECT` (`tests/host/core.mjs:97`). The guard at `:17` requires that `PROJECT` starts with `qa-`. `run()` uses no shell (`tests/host/lib.mjs:12-34`), and the service name is a literal.
- **Failed kill.** A code other than 0 (also −1 after a timeout or spawn error) returns the kill result with the `kill:` line first. No restart runs (`:42-44`). The test helper then fails its `code === 0` assertion as a plain FAIL, as a failed `restartApp()` does today. Nothing hides the failure. The app can stay down, so later rows can also fail. The round then fails, and cleanup is not affected.
- **Restart.** It is the same `npm run stack:restart -- cogniate-app` with the same cwd, env (`STACK_PROFILE: 'acceptance'`) and 180 s timeout as the old branch (`:45-47` against `:55-58`).
- **Result and logging.** The code is the restart code. Stdout is `kill: exit <code>, <start ISO>–<end ISO>`, then the kill stdout, then the restart stdout. Stderr holds both. `durationMs` is the sum (`:48-53`). The kill interval uses the host clock. 30 s + 180 s, plus a 10 s kill escalation for each step, stays below the 240 s `host()` wait (`common/client.ts:93`).
- The `host-actions` record (C9 `:84-87`, the unchanged C8 `:63-66`) has no `mode` field. The `kill:` line in its stdout identifies a kill.

### 3.6 Guard G and no suppression

- G asserts that the first answer is not the app's own `502 LTI_SERVICE_ERROR`. Its message starts with `BLOCKED:`, so `common/coverage.mjs:91-92` reports `BLOCKED`. `run-m1.mjs:333-336` records `BLOCKED` as FAIL, and `verifyResults` needs PASS. So G can stop a round, but it can never make a PASS.
- In all seven cases a PASS needs a live lease after the kill: `409 GRANT_IN_USE` (`d`, `s-dead`, `v4`, `v5`, `v6`) or `release` exit 1 "a redemption may still run" (`o`). `fail()` clears the lease on a timeout. So a PASS by itself shows that the old handler did not time out before the kill.
- Residual 1: the kill can land after `fail()` commits the lease clear and before the `502` leaves the process. That window is a few milliseconds, about 5 s after the held call started. G then passes, and the `409` or exit-1 assertion fails as FAIL, not BLOCKED. This can only cause a false FAIL.
- Residual 2: G also reports BLOCKED if a product defect answers `502` early. That row still fails, and its evidence stays.

### 3.7 Self-tests

- The appended test checks the exact kill and restart argv, cwd, env and timeouts, the `kill:` line form, the `durationMs` sum and the stderr join.
- It checks that a failed kill runs no restart. It checks code 2 and no call for `lti-service` with `kill`, and for the modes `'graceful'`, `''` and `null`. It checks the storage-compat refusal and the non-`qa-` project refusal.
- The existing tests are unchanged. Two small gaps are in A-DH-04.

## 4. Product no-change diagnosis

I agree: there is no product defect, and no product change is needed.

- With SIGTERM, `closeOnSignal` keeps the process for at most 2 s and does not stop in-flight work. A held call that reaches its 5 s timeout in that time follows the contract "LTI failure" rule: no more calls, lease cleared, attempt failed, `502`. The retry then redeems once (`200`), as in `s-retry`.
- The Architect's round-2 times agree with the source. S3 started at about 19:34:23.24. The timeout line is at 28.246, which is the start + 5.0 s. SIGTERM came at 27.024, so the latest exit was 29.024. The handler was therefore alive at its timeout. In round 1, SIGTERM came at 50.210, so the latest exit was 52.210, before a timeout at about 52.55. I did not re-read the logs.
- Graceful shutdown has no lease side effect (§3.2). So the kill hides no product path that the SIGTERM variant tested. Other rows, for example `s-retry` and `q`, still cover the live-timeout path.

## 5. Ledger, carried rows, M2 and T7

- `PHASE_TOTALS` at C9: `sim` 394, `snapshot-isolated` 6, `snapshot-upgrade` 6, `migration` 12, `storage` 70 (`tests/host/storage-inventory.mjs:33`). 394 + 94 = 488.
- **94 carried C4 rows.** Their producers do not load a changed file with any effect:
  - `snapshot-isolated` rows are in `blackboard/02-snapshot-isolated.test.ts` and `canvas/02-canvas-snapshot-isolated.test.ts`. Both are unchanged C4 → C9.
  - `snapshot-upgrade` and `migration` runs include only `common/migration.probe.ts` (`M1/vitest.config.mts:25-26`).
  - `storage` rows use `tests/host/storage-rows.mjs`. Its host requests have no `mode` (`storage-rows.mjs:560`, `:1496-1498`; `common/storage-lock-scope.probe.ts:9`).
  - A run that collects a changed file only adds a function definition (helper K).
  - These rows stay C4 results with their own full2 runs. They make no C9 claim.
- **Blackboard.** The 136 Blackboard `sim` rows no longer carry, because two Blackboard files change. They run fresh. The correct claim is "394 fresh `sim` rows plus 94 carried C4 rows", not "fresh 488" and not "fresh 233 Canvas".
- **M2 and T7: actual run C8, equivalent at C9.**
  1. C8 → C9 is exactly the six paths.
  2. The controller diff is a pure insertion that only `m1-restart` with `mode` reaches.
  3. M2 sends `m1-cli` (`canvas/browser.ts:65,70`, through `issueGrant`) and `m1-profile` (`M2/02-canvas-wizard.m2.ts:246,254`). It never sends `m1-restart` or `mode`. T7 does not load `m1-control.mjs`. No module imports a changed test file.
  4. C9 = C6 outside `docs/**` and `tests/**`.
  The `m1-cli` branch comes before the insertion and is unchanged. So "M2/T7 actual run C8; equivalent at C9 for M2/T7; product C6" holds, with the reach text of A-DH-02.

## 6. v5 launcher

### 6.1 Diff v4 → v5

15 lines leave and 17 lines come in. My diff equals QA's patch.

| v5 line | Change | Assessment |
| --- | --- | --- |
| 2, 9 | Header and usage text | Label only. |
| 15 | `FROM`, `TASK`, `DISPATCH` come from `QA_M1_FROM`, `QA_M1_TASK`, `QA_M1_DISPATCH` with `${…:?}` | Lead `msg_4b6cd622ed5e`. A missing or empty value stops bash before `mkdir` (`:19`) and before any Docker command. The values are used only, quoted, in the `orca` send argv (`:75`), not in the body or `command.txt`. No routing id is embedded; only historical `msg_` ids stay in comments. See A-DH-05. |
| 26, 28 | `TEST_SHA` = C9; tests tree `667e83a9…` | Correct. |
| 34 | Message label C8 → C9; same command | Label only. |
| 35 (new) | C8 → C9 tests = the six paths | New strict guard. |
| 36 | C7 → C8 = the two R3 paths (end pinned to C8) | History guard; correct. |
| 37 (new) | C7 → C9 = eight paths | Correct. |
| 38, 39, 41 | C5, C6 and C4 → C9 = ten paths | Correct. |
| 40 | C4 → C5 = three paths | Unchanged. |
| 70 | `--provider canvas` → `--provider all` | Correct selection. It is the `sim` phase of full2 alone: same `PROJECT=qa-multi-r1`, port 8443, subnet `172.29.0.0/16` and `STACK_PROFILE=default` as `V4/tools/launch-full-c4.sh`. |
| 76–77 | Subject and body labels: C9, `all`, "394-case: 26 + 136 + 232 = 387 + 7; 94 C4 rows carried" | Label only (word diff). |
| 94, 102 | Log labels | Label only. |

All other lines are byte-identical to v4: `set -uo pipefail`, `umask 077`, the course hash check, the tool hash record, the ancestor boundary, W1, W2, W3 with `ORIG`, the gate message and its stop on failure, the three observers in their own process groups, the `umask 022` runner child only, W4 capture, the observer stop, the W4 strict compare, the accounting copy, the owned-clone list and the secret scan. There is no retry or repeat loop. `bash -n` passes.

### 6.2 Inherited tools

`diff -rq V4/tools V5/tools` shows only the new `launch-sim-c6-v5.sh`. A SHA-256 list of every file agrees. All 37 inherited files are byte-identical: 27 top-level files, 4 in `controls/` and 6 in `ledger/`. QA's `prep/01-v4-tools-verify.txt` has 37 `MATCH` lines. No file in `V5/tools` has a group or other permission bit. The launcher contains no secret value.

### 6.3 Guards on the held source

A `python3 -I` script took each name-list literal from the launcher and ran the same `git diff` on `V5/c9-clean-src/source`. All 9 were equal (lines 31, 32 and 35–41). The exit-code guards at `:30`, `:33` and `:34` return 0. HEAD, the tests tree, the clean status, no untracked test file and no `.env` also hold.

### 6.4 Held commands and roots

The two held commands (READY §3) start with `umask 077 && test ! -e <root> &&`. They set the three `QA_M1_*` values and pass C6, C9, the clean source and two different roots, `sim-c6-c9-r1` and `sim-c6-c9-r2`. Both roots were absent at 02:32 UTC. The launcher still makes its root with `mkdir -p` and has no grant check, as in v4. So A-T609-05 stays a process rule: each grant quotes the exact held command.

### 6.5 Shared host and route (assumptions flagged, nothing granted)

- v5 keeps the strict W4 compare against the 32 protected records. It adds no foreign-activity exception.
- Plan §12.5 (`t6-09-failure-plan.md:460`) states "E-R5 §11.6 rules carry into E-R6". The Lead has not adopted that for M1. E-R6 (`docs/team/r6-independent-verification-2026-10-23.md:52`) states that unexpected foreign activity blocks acceptance.
- I grant nothing here. If the Lead adopts an exception for M1, the extra Blackboard score reconciliation of §12.5 must go into the judge record. The launcher does not need to change for that.
- The M1 runtime route, each invocation grant and the judge of the 162 common and Blackboard rows stay Lead decisions.

### 6.6 Evidence for the seven repaired cases

Each round keeps what the judge needs for each repaired case:
- the gate events with phase and `ts` in the case evidence file (`canvas/51` `scope` → `saveEvidence`, `blackboard/50` `scope`, and `snapshotScope`);
- the host action record with the `kill:` line (`m1-control.mjs:84-87`);
- `service-logs/cogniate-app.jsonl` (`core.mjs:375`).
The `kill:` line uses the host clock. The gate and app lines use container clocks. Compare across clocks with care.

## 7. Findings

| Id | Severity | File:line | Problem | Evidence | Suggested fix |
| --- | --- | --- | --- | --- | --- |
| A-DH-01 | MINOR (spec trace; tests stay as they are) | `docs/architecture/tasks/M1.md:136,147,151,158-160`; `docs/architecture/contracts/cogniate-app-api.md:461`; `docs/architecture/adr/ADR-012-sqlite-volume-storage.md:332,335` | The criterion, the contract row and the ADR-012 guarded-path table name only `stack:restart -- cogniate-app` (and QA `compose stop` and `start`). C9 sends SIGKILL before that restart. | `m1-control.mjs:38-47`. The outcomes do not change. The kill makes no container and changes no mount, and the start stays guarded. | The Architect appends one clarification: the dead handler is "SIGKILL of `cogniate-app`, then the unchanged guarded `stack:restart -- cogniate-app`". ADR-012 §7 lists `docker compose kill` next to the QA `stop` and `start` row. No test or product change. |
| A-DH-02 | MINOR (binding text) | `docs/reviews/M3/t6-09-failure-plan.md:479` | "it sends only `m1-profile`" is false. M2 also sends `m1-cli`. | `canvas/browser.ts:65,70`; `M2/01-cards.m2.ts:45`; `M2/04-detail.m2.ts:45`. E-R6 is already corrected at `6c6adbb` (`:27`). | The final M2/T7 binding names both branches. The Architect corrects or annotates §12.6. The conclusion does not change. |
| A-DH-03 | NIT (documented evidence limit; not a gate) | `packages/shared/src/logger.ts:133,144-145` (comment `:88-90`); `tests/acceptance/lib/logs.ts`; `common/99-logs.test.ts:36`; `common/snapshot.ts:24` | The app log file sink is an async stream. After SIGKILL it can lose queued lines and, in theory, tear one line. | The product comment states the loss at exit. The tests and the evidence read only this sink. | No change. The negative log check is corroboration only, because a PASS needs the live lease (§3.6). A torn line can only make a false FAIL or BLOCKED. Optional, never a pass rule: the judge also records gate `caller_gone` minus `received` (one clock). |
| A-DH-04 | NIT (test coverage) | `tests/host/m1-control.selftest.mjs:284-376` | No case shows that `m1-restart` of `cogniate-app` without `mode` still runs exactly one `npm run stack:restart` and no `docker kill`. No case covers a failed restart after a good kill. | The existing no-mode case covers `lti-service` only (`:114-115`). | Add these two short cases in a later test round. |
| A-DH-05 | NIT (process) | `V5/tools/launch-sim-c6-v5.sh:15,75` | The three lifecycle values are checked only for presence, not for form. A wrong but valid id sends the gate message to another dispatch, and the run continues. | `${…:?}` checks presence only. | Each grant quotes the exact values, and the Lead confirms that the gate message arrived. Pattern checks are optional later. No change now. |
| A-DH-06 | NIT (text) | `V5/prep/READY-C6-C9-V5.md` §2, "Inherited Tools Verification" | It says "All 35 files from `V4/tools`". The count is 37. | `prep/01-v4-tools-verify.txt` has 37 `MATCH` lines; my own compare also finds 37. | Correct it in a disclosed append. |
| A-DH-07 | NIT | `tests/host/m1-control.mjs:48-53` | The combined success result drops `restart.timedOut`; the old branch returns it. | A timed-out restart still returns code −1, so the row fails. | None needed. |

No BLOCKER and no MAJOR is open.

## 8. Verdict and limits

**Final verdict: APPROVE.**

| Scope | Result |
| --- | --- |
| Plan §12 (`5116227`) | APPROVE as implemented. Text corrections A-DH-01 and A-DH-02 only. |
| C9 `9eb504f5` (tests tree `667e83a9`) | APPROVE. Exactly six paths. The controller change is a pure, guarded insertion. Seven kill sites with guard G. No assertion, title, case, deadline, retry or late-write control is weakened. Common helpers and product are unchanged. |
| Fault model | SIGKILL before the unchanged guarded restart makes the AC-M1-37 dead handler. The committed phase-1 lease survives. The ADR-012 preflight reads only entries, identities, journals and database presence, so the kill changes no refusal row. No failure is suppressed. |
| Product | I concur with the no-change diagnosis. |
| Ledger and M2/T7 | "394 fresh `sim` rows plus 94 carried C4 rows" is correct. "M2/T7 actual run C8; equivalent at C9 for M2/T7; product C6" holds with the A-DH-02 wording. |
| v5 `9ea9e58d` | APPROVE for the two held commands. Pins, path guards, `--provider all`, lifecycle variables and labels change; nothing else does. All 37 inherited tools are byte-identical. No retry. W1–W4, sampler, scans, cleanup and isolation are unchanged. The roots are absent. |
| Runtime | Not reviewed. No C9 run exists. |

Not claimed: no runtime PASS, and no AC-M4-06 completion. AC-M4-06 stays PENDING. The M1 runtime route and each invocation need explicit Lead decisions. The E-R5 shared-host exceptions are not adopted by this review. All 32 real-LMS rows stay UNVERIFIED. Local Canvas stays DEFERRED. The untracked `pnpm-workspace.yaml` stays as it is.

Limits:
- I did not run any test, so the self-test, typecheck and inventory results are QA's.
- I did not measure Docker kill, restart-policy or log-sink behavior (§3.4, A-DH-03).
- I did not re-read the primary logs of the failed round (§4).
- A static source review cannot prove that the held redemption is the only in-flight app work at each kill. The kill also ends any other work at once, not after the 2 s drain. That can only cause a false FAIL, for example through the global `noServiceCalls` check (`canvas/51:77`), never a false PASS.
- Each SIGKILL adds a small chance of a torn line in `cogniate-app.jsonl`. That would fail `M1-24.common.event-shapes` (`common/99-logs.test.ts:36`), never pass a row.

## 9. Private evidence

Root: `/Users/quangnguyen/cogniate-review-runs/dead-handler-reviewer-a-task_58ee0d75cf41-20261023T0156Z` (0700). Files are 0600. The script folder and script are 0700.

- `notes-c9-source.md`: my source notes (identities, blobs, line facts).
- `checkpoint-1.txt`, `checkpoint-2.txt`: the bodies of `msg_33e87324592d` and `msg_3a38914733d0`.
- `v4-to-v5-launcher.diff`: my `diff -u` of v4 → v5 (§6.1).
- `v5-guard-eval.txt`, `v5-guard-literals.txt`: the guard outputs on the held source (§6.3).
- `node-modules-rq.txt`: the empty `diff -rq` of the V4 and V5 `tests/node_modules` folders.
- `scripts/guard-literal-check.py`: the read-only guard comparer, run with `python3 -I`.
- `MANIFEST.sha256` (8 entries, 724 B, SHA-256 `faa9a1431c054fa2b124b4e9ebf4b995aa57c724e3b43d564eec6524366a2add`): path, size and SHA-256 of every file above. It does not list itself. I built it outside the root and then moved it in.

Disclosure: one comparison command wrote two temporary hash lists to `/tmp` without `umask 077`. They held only SHA-256 values of the tool files, no secret, and the same command removed them.
