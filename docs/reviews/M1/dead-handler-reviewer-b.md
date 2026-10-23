Verdict: APPROVE
Round: 1

# M1 dead-handler repair (C9) and v5 SIM launcher: Reviewer-B (lens B)

Reviewer: Reviewer-B, Claude Code Opus 5.5 (`claude-opus-5-5`), xhigh. Task `task_9f1cca45a161`, dispatch `ctx_ba563ee9afc1`, run `run_ebe671ad72a9`. Finished 2026-10-23, about 02:42 UTC (checked with `date -u`).
Lens B: test quality, no weakening, exact source reach and dependencies, error handling and operational safety.
Blind: I did not open `dead-handler-reviewer-a.md` or any other Reviewer-A text for this task.
This is a static review. It is not a runtime PASS, a conformance claim or a runtime grant.

## 1. Identities that I checked

| Item | Value | Result |
| --- | --- | --- |
| Target C9 | `9eb504f5bff4be7e291570fde12fdf9919a07fa1`, `tests` tree `667e83a9a6a0187d742eb68a17293e4b7302100f` | Matches |
| Baseline C8 | `5561e8f72a83de36a68877c6b26ffc8288ade735`, `tests` tree `65eaefab31ec6800fca06aee50e5e25c95713f8a` | Matches |
| Product C6 | `4008afb92fe983d52db33442e060210b929966c8`. `git diff C6 C9 -- . ':!docs' ':!tests'` and the same for C8→C9 are empty. | Matches |
| Plan | `docs/reviews/M3/t6-09-failure-plan.md` §12 at `5116227` | Read in full |
| v5 launcher | `tools/launch-sim-c6-v5.sh`, 14,586 B, 0700, `9ea9e58d0e734869d4e5fa2d29c187039fb7a835e8d2dfa2c429a550903d5434` | Matches |
| v4→v5 patch | `prep/02-v4-to-v5-launcher-diff.patch`, 13,455 B, 0600, `4364c0d730f47594fe11370145ca695349af3dcaeaa382f237fd2481c7d2e07a`. Its body equals a fresh `diff -u` of the frozen v4 launcher and the v5 launcher. | Matches |
| READY note | `prep/READY-C6-C9-V5.md`, 12,605 B, 0600, `e150be0911f3e09a3bd97eba24de2a4b8bb8d67411809907dae1b5e21f7a84a5` | Matches |
| Prep index | `evidence-index-v5-prep.tsv`, 6,119 B, 0600, `bb1aa2b28dde76aec955f9784099f8a182021c77da8cb9d3e54877d2efc42be6`; 58 rows of 4 fields; its launcher, patch, READY and Stage A rows agree | Matches |
| Stage A index | `evidence-index-v5-stage-a.tsv`, 1,900 B, 0600, `369409c020d72fbcd166d0b32bb18069c9342b30190087b31c040f3087607e44`; header + 13 rows. Its six test-file rows equal the C9 blob sizes and SHA-256 values. | Matches |
| v4 launcher | Frozen v4 root and v5 copy: 12,597 B, `d812874703f2224fe891a67ea104c2a2af39b6c41b19d5316c31485a6220f7b9` | Matches |
| Other v5 tools | `diff -rq` of v4 `tools/` and v5 `tools/`: only `launch-sim-c6-v5.sh` is new; all modes are equal | Matches |
| C9 source clone | `c9-clean-src/source`: HEAD C9, `tests` tree C9, `status --porcelain` empty, no `.env`, push URL `DISABLED-no-push`, 0700 | Matches |

## 2. Findings

No BLOCKER and no MAJOR finding.

| ID | Severity | Where | Problem | Evidence | Suggested action |
| --- | --- | --- | --- | --- | --- |
| B-M1-DH-01 | MINOR | `tests/host/m1-control.selftest.mjs:284-376` (gap); branch `tests/host/m1-control.mjs:55-59` | No self-test proves that `m1-restart` for `cogniate-app` without `mode` still runs exactly one `stack:restart` and no kill. | The C8 and C9 self-tests pin the no-`mode` path only for `lti-service` (`:114`, `:154`). Six unchanged `restartApp()` sites (Canvas `52-canvas-snapshot.test.ts:101,155,158`; Blackboard `52-snapshot.test.ts:106,203,204`) and the reach statement for carried rows use the `cogniate-app` path. Today only code reading proves it: the diff is +21/-0 and the new block needs `'mode' in req` (`m1-control.mjs:34`). | At the next permitted harness change, add one case `{ action: 'm1-restart', service: 'cogniate-app' }` that expects exactly one `npm run stack:restart -- cogniate-app` call. Do not reopen C9 for it. |
| B-M1-DH-02 | NIT | `tests/host/m1-control.mjs:48-53`, `:84-87`; `tests/host/run-m1.mjs:334` | The evidence of a kill action is implicit. | The `host-actions/<id>.json` record has no `mode` field (unchanged lines). The combined success result drops the `timedOut` field of `run()`. A Guard G BLOCKED row gets the fixed host-record text "live 5 s schedule missed its deadline". A failed kill or restart fails K's message-less `assert.equal(code, 0)` as FAIL, as `restartApp()` does. | Judges: find the seven kill actions by the first stdout line `kill: exit <code>, <start>–<end>`. Read the Vitest failure message for the exact Guard G text. No code change now. |
| B-M1-DH-03 | NIT | `canvas/51-canvas-races.test.ts:85-91`, `canvas/52-canvas-snapshot.test.ts:17-23`, `blackboard/52-snapshot.test.ts:14-20` | Helper K has three copies. | The three blocks are byte-identical (SHA-256 `8cae96faba7647c73d6a3e92b86a2e0fbc50767084fb435af34d5f223a6aaf19`). The copies keep `M1/common/*` byte-identical, which E-R6 and the M2/T7 carry need. | Accept now. Move K next to `restartApp()` in `common/snapshot.ts` only in a later reviewed change that no carry depends on. |
| B-M1-DH-04 | NIT | `launch-sim-c6-v5.sh:15`, `:75-78` | The launcher checks only that the three lifecycle values are present, not their form. | A missing or empty value stops the launcher before `mkdir` (`:19`) and W1 (`:61`). A present but wrong value fails only at the gate send, after the read-only W1–W3 checks; the runner then does not start (`blocked`, `:78`). If Orca accepts a settled dispatch ID, the gate message goes to the wrong thread. | No launcher change; it stays frozen. The grant gives the exact three values, and the launch record repeats them. |
| B-M1-DH-05 | NIT | `prep/READY-C6-C9-V5.md` §2 and §4 | Prep note wording. | §4 already states the final carry sentence "M2/T7 actual run C8; equivalent at C9", but M2/T7 C8 results do not exist yet (T7 is ungranted). Its item (2) does not name the `m1-profile` and `m1-cli` branches that the Lead's 02:13 UTC directive requires. §2 says "All 35 files"; `prep/01-v4-tools-verify.txt` has 37 `MATCH` rows (E-R6 also says 37 tools). | Use READY §4 only as a static precondition check. Write the final binding after the actual M2/T7 results, and name both branches. |

## 3. C9 code: what I verified

1. **Exact diff.** `git diff --name-only C8 C9 -- tests` gives exactly the six §12.3 paths. `9eb504f` is the only commit in `C8..C9` that touches `tests/**`.
2. **Controller, pure insertion.** The `m1-control.mjs` diff is +21/-0 at `:34-54`. It is after the compat-marker refusal (`:31-33`) and before the existing restart branch (`:55`). The QA-project guard (`:17`) and the marker refusal run first and did not change. A `mode` other than `'kill'`, or a service other than `cogniate-app`, returns code 2 and runs no command. It never falls through to the graceful branch. The kill is `docker compose -f infra/compose.yaml --env-file .env kill -s SIGKILL cogniate-app` with `cwd: r.CLONE`, `env: r.STACK_ENV` and 30 s. The restart runs only after kill exit 0, with the same argv, env and 180 s timeout as `:56-58`. The `m1-cli` branch (`:18-28`) is before the block. The `m1-profile` branch (`:60-68`) has another action, so the block never handles it. `run()` never rejects (`tests/host/lib.mjs:11-35`). `cogniate-app` has no restart policy and no profile in `infra/compose.yaml`.
3. **Self-tests.** One new test (`:284-376`) uses the injected `runCommand` and no Docker. It pins the exact kill and restart argv, env and timeouts, the `kill:` line form, the stdout and stderr merge and `durationMs`. It also pins: no restart after a failed kill; code 2 and zero calls for `lti-service` with kill and for the modes `graceful`, `''` and `null`; the marker refusal; the non-`qa-` refusal. The five C8 tests are unchanged (pure append).
4. **Kill only at the seven cases.** `mode` is sent at six call sites, which are seven cases: Canvas `d` (`51:144`), `s-dead` (`51:310`), `v4` and `v6` (`52:78`, one loop); Blackboard `d` (`50:105`), `o` (`50:219`), `v5` (`52:64`). `git grep` finds no other `mode` sender in `tests/**`. No M2, T7, storage or other M1 file sends it.
5. **No weakening.** The removed lines are only the replaced restart calls, `await first;` and import lines. In all four files the C8 and C9 counts are equal for `expectStatus(`, `leaseWindow(`, `pause(`, `release(`, `upstream(`, `gatePhase(`, `watchAll(`, `62_000`, `55_000`, `10_000`, `240_000`, the case registrations and `m1Test(`. `assert.` grows only by K and the new Guard G lines: +3, +1, +2 and +2. Titles, case ids and manifests did not change. The unused `restartApp` import stays in `51`, as the plan says.
6. **Guard G can fire.** `fail()` (`services/cogniate-app/src/app/redemption.ts:172-177`) throws `ApiError('LTI_SERVICE_ERROR')`. The error handler (`server.ts:116`) sends `apiErrorBody`, which puts the code in `details.message` (`packages/shared/src/errors.ts`). Each `first` goes through `appApi` (`tests/acceptance/lib/app.ts`). It returns `{ status, json }` and has a 30 s client timeout, so `first` always settles. A reset after SIGKILL gives `null`, and G passes. The assertion module is `node:assert/strict` (`common/client.ts:3`), so the message starts with `BLOCKED:` and `common/coverage.mjs:92` gives BLOCKED.
7. **Helper K** equals `restartApp()` (`common/snapshot.ts:87-93`) plus `mode: 'kill'`, with the same 20 s and 100 ms health poll. K has no top-level side effect, so test collection does not change.
8. **Unchanged shared files.** `M1/common/*`, `canvas/browser.ts`, `canvas/browser-diagnostics.mjs`, `tests/e2e/**`, `tests/acceptance/lib/**` and the type of `host()` are byte-identical C8→C9.
9. **No parallel work during a kill.** `M1/vitest.config.mts:28` sets `fileParallelism: false`.
10. **Residual (no finding).** If the old handler commits `clearLease` and SIGKILL arrives before its 502 is sent, G passes and the 409 assertion fails. This is a false FAIL, never a false PASS. The §12.5 judge check (no `outbound_blocked` or `http_request` of the first trace before the next `service_started`) finds it.

## 4. M2/T7 equivalence from the actual consumers

- **M2.** `tests/e2e/host/run-m2.mjs:24,134` loads `m1HostControl`. M2 specs send `m1-profile` (`02-canvas-wizard.m2.ts:246,254`) and `m1-cli` through `canvas/browser.ts:54-65` (`cli` → `issueGrant`, used by `01-cards`, `04-detail`, `06-keyboard-axe` and `lib/m2.ts`). No M2 payload has `mode` or the action `m1-restart`, so the new block is unreachable. `m1-cli` returns at `:18-28`, before the block. Unchanged lines `:60-68` handle `m1-profile`.
- **T7.** `tests/e2e/host/run-t7.mjs` imports only `../../host/lib.mjs`. `tests/e2e/lib/learner.ts` loads `browser-diagnostics.mjs`. All are unchanged.
- The four §12.6 conditions hold statically: (1) the six paths; (2) +21/-0, reached only by `m1-restart` with `mode`, with the `m1-profile` and `m1-cli` branches unchanged; (3) no M2 or T7 `mode` sender; (4) C9 = C6 outside `docs/**` and `tests/**`. The final carry sentence still waits for actual M2/T7 results (B-M1-DH-05).

## 5. The 94 carried C4 rows

- At C9 the provider manifests give `snapshot-isolated` 6 (5 in `blackboard/02-snapshot-isolated.test.ts`, 1 in `canvas/02-canvas-snapshot-isolated.test.ts`), `snapshot-upgrade` 5 (`common/snapshot-migration.probe.ts`) and `migration` 11 (`host/m1-migration.mjs`). `tests/host/m1-storage-manifest.json` adds 1 `snapshot-upgrade` and 1 `migration` row (`storage-compat-route.mjs`) and 70 `storage` rows (`storage-rows.mjs`). Total 6 + 6 + 12 + 70 = 94.
- None of these files is in the C4→C9 test diff (10 paths). No file imports a changed test file.
- They reach `m1-control.mjs` only through `m1-profile`, `m1-cli` or `m1-restart` without `mode` (for example `canvas/02-canvas-snapshot-isolated.test.ts:14,25`, `common/storage-lock-scope.probe.ts:9`, `storage-rows.mjs:1498`). `m1-control.mjs` is not in the C4→C8 test diff, so C4→C9 for it is only the insertion.
- `m1-migration.mjs:150-154` counts host restarts by `action`; a kill would count as a restart, but the migration phase does not send one.

## 6. v5 launcher: full focused delta

1. **Delta.** The changes are: header comments (`:2`, `:9`); lifecycle values (`:15`); test pin and tree pin (`:26`, `:28`); C9 product-guard label (`:34`); test-path guards (`:35-41`); selection (`:70`); gate subject and body (`:76-77`); two log texts (`:94`, `:102`). All other lines equal v4.
2. **Lifecycle values.** `:15` uses `${QA_M1_FROM:?…}`, `${QA_M1_TASK:?…}` and `${QA_M1_DISPATCH:?…}` before `mkdir` (`:19`) and W1 (`:61`). In a separate `bash -c` snippet (not the launcher), an unset or empty value exited non-zero and did not reach the next line. No run root is created, so the same absent root stays usable. The send (`:75`) quotes `"$FROM"`, `"$TASK"` and `"$DISPATCH"`. No other line uses them, and no old `term_…`, `task_0b7729855fc5` or `ctx_72afbef88d8c` value remains. No code in `tests/**`, `infra/**`, product or the held tools reads these three names (the code reads 8 other `QA_M1_*` names). `qa_env_args` (`infra/scripts/lib.sh:235-240`) forwards each exported `QA_*` variable into the test container. This is harmless: nothing reads them and they are not secrets.
3. **Pins.** Product C6, tests C9, `HEAD == TEST_SHA`, tests tree `667e83a9…`, clean, `tests` equal to C9, no untracked tests and no `.env`. The product guards did not change: C4→C6 four paths, two product paths, README binding to `958ee5c`, and C6 = C9 outside docs and tests.
4. **Diff guards.** I ran each `git diff --name-only` pair again. Each output equals the expected string, in git's order: C8→C9 6, C7→C8 2 (now with fixed SHAs), C7→C9 8, C5→C9 10, C6→C9 10, C4→C5 3, C4→C9 10.
5. **Selection.** `--phase sim --provider all` uses all three owners (`run-m1.mjs:48`). `run-m1.mjs:355-359` runs the `api` and `browser` rows of `phaseRows(expected, 'sim')` in one suite and checks all of them with `verifyResults`. Manifest counts at C9: common 26 (25 `api` + the host row `M1-02.common.default-profile`), Blackboard 136, Canvas 232 with 7 browser rows (6 in `70-canvas-browser.spec.ts`, 1 in `99-canvas-secrets.spec.ts`). Total 394 = 387 non-browser + 7 browser. This is the code path of the full2 `sim` child.
6. **Claims.** The launcher and gate body say "single 394-case invocation … 94 C4 rows carried". Neither the launcher nor READY claims "fresh 488" or "fresh 233 Canvas".
7. **Two rounds.** One launcher call is one invocation. Round equality is outside the launcher, as in v4. READY §3 gives two separate commands with `test ! -e` on two different roots. Each needs its own grant.
8. **Unchanged safety.** The launcher runs under `umask 077`; only the runner subshell uses `umask 022` (`:98`). Observers run in their own process groups (`:83-92`). W1–W3 run before the gate message. W4 capture runs before the observers stop, then the strict W4 compare with the sampler, the owned-clone list and the secret scan. The launcher returns the runner exit code. `bash -n` passes, and the new `$'…'` strings quote correctly.
9. **Operational note (not a finding).** This round has 136 more rows than the 258-row v4 round (runner 18:54:44–19:11:23 UTC) and three more 62 s lease waits. Size each host window for that, not for v4.

## 7. Limits

- Static review only. I ran no Docker, test, typecheck, build or install, and made no commit or push. I did not run the 184 self-tests, the typecheck or the inventory again. For those I rely on the Lead's host-only results, and I read the code that produces the 394 and 488 numbers.
- Commands that I ran: read-only `git` (`show`, `diff`, `grep`, `rev-parse`, `ls-tree`; `GIT_OPTIONAL_LOCKS=0` in the held clone), `shasum`, `stat`, `diff`, `jq`, `bash -n` on the launcher, and one `bash -c` snippet for the `:?` behaviour. I did not run the launcher. I wrote no private notes.
- Lens A items stay with Reviewer-A: SIGKILL as the AC-M1-37 fault model, lease survival, and the ADR-012 storage preflight after a kill. I saw only that `-wal` and `-shm` are allowed volume entries (`infra/scripts/sqlite-lock-probe.mjs:49`).
- Not verified: the Docker CLI exit code of `compose kill` for a stopped service, and Orca behaviour for a settled dispatch ID.
- Status: E-R6 authorizes only M2/T7. The M1 route and each invocation are still pending Lead decisions. No E-R5 shared-host exception is adopted. This review grants nothing. The 32 real-LMS rows stay UNVERIFIED and local Canvas stays DEFERRED. I did not change `pnpm-workspace.yaml` or any other file.
