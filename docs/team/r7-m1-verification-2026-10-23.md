# E-R7: C9 M1 verification with the v5 launcher

Decision: ACCEPTED FOR THE BOUNDED EXECUTION ROUTE by the Lead, 2026-10-23 02:51 UTC.
Each invocation still needs a separate grant. This decision is not a runtime PASS.

## Basis and frozen inputs

Claude Architect's plan is `docs/reviews/M3/t6-09-failure-plan.md` §12.
C9 `9eb504f5bff4be7e291570fde12fdf9919a07fa1` contains the six test-only dead-handler repairs.
Its tests tree is `667e83a9a6a0187d742eb68a17293e4b7302100f`.
Product C6 remains `4008afb92fe983d52db33442e060210b929966c8`.
The 184 host self-tests, TypeScript check and unchanged 488-row inventory passed.
The two blind Claude reviews approve C9 and v5 with no BLOCKER or MAJOR: A at `e81fb2b`, B at `4b571d9`.
Nonblocking self-test and metadata-form improvements are deferred; do not reopen C9 for them.

Frozen root: `/Users/quangnguyen/cogniate-qa-runs/qa-common-c6-v5-20261023T0155Z`.
Source: `c9-clean-src/source`, clean detached C9.
Launcher: `tools/launch-sim-c6-v5.sh`, 14,586 bytes, mode 0700, SHA-256 `9ea9e58d0e734869d4e5fa2d29c187039fb7a835e8d2dfa2c429a550903d5434`.
Prep index: `evidence-index-v5-prep.tsv`, SHA-256 `bb1aa2b28dde76aec955f9784099f8a182021c77da8cb9d3e54877d2efc42be6`, 58 checked entries.
All 37 inherited tools remain unchanged. READY's count of 35 is a text error; preserve it with a separate correction.

## Required coverage and evidence

Run two serial invocations of `run-m1 --phase sim --provider all --sha C6 --test-sha C9` through the frozen launcher.
Each covers 394 rows: 26 common, 136 Blackboard and 232 Canvas; 387 non-browser and seven browser rows.
Keep the 94 previously accepted C4 rows separate: six snapshot-isolated, six upgrade, 12 migration and 70 storage rows.
This is not a new full 488-row run. Old C8 SIM results remain history and do not fill fresh C9 rows.
The independent Gemini session judges all 394 fresh rows, round equality and the seven dead-handler cases.
For those cases, bind the held call, kill action, unchanged guarded restart and lease assertions.
The app's asynchronous log sink may lose its final lines after SIGKILL. Trace absence corroborates the lease result; it does not replace it.
No assertion, deadline, lease, pause, late-write control, retry rule or test selection may change.

## Operational conditions

Common Gemini task `task_57fe3129b0f8`, dispatch `ctx_45c8bf2cadf6`, owns execution.
The runtime grant names exact `QA_M1_FROM`, `QA_M1_TASK` and `QA_M1_DISPATCH` values. The Lead checks receipt of the launch gate message.
Use fresh absent output roots and a detached invocation. Do not modify the reviewed launcher to alter process submission.
Private directories use 0700, files 0600 and scripts 0700. The existing runner-child umask 022 and clone guard remain unchanged.

LA must confirm its stack is down and hold starts for exact agreed bounds. No LTI runtime phases overlap.
Before each invocation, compare all 32 complete protected volume records with the preceding operational W4 named in its grant.
Preserve all other projects' resources, Docker settings and engine identity. No prune, foreign mutation, pull, tunnel or account creation.
Retain every existing W1-W4, sampler, observer, runner isolation, cleanup and secret-scan check.
Obtain LA's complete-window confirmation after each invocation. Return the host after verified owned cleanup.
Any failure stops further grants pending assessment. There is no automatic retry or E-R5 shared-host exception.

## Other work and limits

M2 attempt 3 remains NOT ACCEPTED: its 64 functional cases passed, but its separate lane monitor failed.
Claude's §13 assessment identifies a tool-only repair and requires one M2 rerun, followed by T7 with the repaired monitor.
M1 is independent: its sequential listing runs after each command, and v5's tools do not use that concurrent `listLane` path.
The M2/T7 monitor repair may proceed host-only while M1 runs. It cannot alter C8, C9, product code or M1 tools.
Legacy evidence stays accepted under E-R4. The static C8-to-C9 M2/T7 dependency comparison is not a runtime result.
Final conformance, guide completion, independent Docs QA and two final reviews remain required.
All 32 real-LMS rows remain UNVERIFIED. Local Canvas remains DEFERRED. No push or main merge is authorized.

## Round 1 accepted; Round 2 granted — 2026-10-23, 03:50 UTC

The Lead accepts Round 1 from Common QA `msg_baec14162a3e` and independent Gemini `msg_3f4b264cdb01`.
Run `qa-multi-r1-4008afb9-2026-10-23T03-12-17-293Z` ran 03:12:17–03:36:59 UTC; final closure was 03:37:16 UTC.
All 394 unique cases passed, with no failures, skips or raw retries. The summary has 400 PASS entries including six gates.
Both QA sessions bound all seven dead-handler preconditions. The independent sink and shared browser-artifact scans passed.
The 94 carried C4 rows remain separate; a second fresh round and equality judgment remain required.

Round 1 evidence under the frozen V5 root:

| Evidence | SHA-256 |
| --- | --- |
| Phase `summary.json` | `63b28caebcdf8b6abbb5e5558b27b64ee6591d3997f935a23a5c4f08b1987516` |
| Phase `m1-case-results.json` | `71ca7f8127244db870d768d8d99ef47e965deefd2b2427680a5130975fc1791b` |
| `m1-sim-c6-c9-r1/public/w4-end.json` | `6b7e7e846f5349c1ecb0371746c3799af9f4c592f7dc9b5a5c078af3d0a9d55a` |
| `m1-sim-c6-c9-r1/public/w4-compare.json` | `41dc4ecfdc0558121cf4b441f553c75cb59e858e9171f43a916e07715243cb25` |
| Latest `evidence-index-m1-sim-c6-c9-r1.tsv` | `065520ffc64a245e479e72c1c7a835dff23903bc6fc80e0837b30b9f384133af` |

The Lead verified all 707 latest index entries, all 32 complete volume records, empty final containers and the exit of the known supervisor, launcher and observer PIDs.
LA confirmed no starts or mutations during 03:09:14–03:37:16 UTC in `msg_503d50563cba`.
Independent evidence under the C8 preparation root is `judge/round1-c9-v5/sim394-judge.json`, SHA-256 `6a144eff3deddd5b9d7dcacc16c9145fef75eab349f440bdc15621c9e2eba253`.
Its 17 primary input bindings passed. The seven-case v2 judgment is `a48da55f8af8972620f21242609625ac08b4b4d5b8fab38c8b521dc753be1c6c`; the final reconciliation is `80553cfb5f638545c08e10b4eac34cffd0dc8f0827eebb7e3988401905c9da54`.

Preserve the initial failed private postprocessor output. Its v2 corrects case-time selection, the required `held_after` case and parameterized log routes; it changes no runtime assertion.
The original private binder source was updated in place and its earlier bytes were not retained. Common QA also replaced three derived closure/index files to add the LA receipt after first reporting them.
These metadata changes are disclosed; raw runtime files are unchanged. The latest published files are frozen, and later additions require new filenames.
Some status-message row names, log lines and times are incorrect. The sealed raw files and corrected JSON are authoritative; final reports must use them.

Round 1 grant `msg_01cc4a7ce777` is closed. Round 2 grant `msg_d0ead4f3d22c` permits one invocation through 04:20 UTC with the same frozen C6/C9/v5 inputs and fresh r2 paths.
Its full 32-record preflight compares against the accepted Round 1 W4 above; any pre-formal-start bridge replacement requires explicit reconciliation before launch.
LA extended the exclusive host hold through 04:35 UTC in `msg_29fd0b045101`. After LTI returns the host, no new LTI Docker phase is planned through 07:35 UTC; conformance, Docs and reviews are host-only.
M2 and T7 still require separate grants. No runtime or final completion is implied by the Round 2 grant.
