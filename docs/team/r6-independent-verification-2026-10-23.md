# E-R6: independent M2 and T7 verification during the M1 harness repair

Decision: ACCEPTED FOR THE BOUNDED EXECUTION ROUTE by the Lead, 2026-10-23 01:41 UTC.
Each invocation still needs its own explicit grant after the checks below. This document is not a runtime grant or a PASS verdict.

## Basis and scope

The user resumed the integration goal with the existing role assignments.
Claude Architect `ctx_49da070f64c0` supplied interim assessment `msg_3540b7d8c9b5`.
It identifies a test-harness defect in the dead-handler setup, with no product finding.
The Lead accepts that diagnosis and chose one repair batch for all seven affected Canvas and Blackboard cases in `msg_7e411091ca22`.
The final repair plan and reviews remain required. No M1 runtime is authorized by this decision.

M2 and T7 can verify the unchanged product independently while that repair is prepared and reviewed.
The worker is the retained independent Gemini 4 Argon High session, now task `task_3ca468cb75c8`, dispatch `ctx_8449a3df3e54`.
Its first resumed start failed at readiness before task injection (`ctx_24ff9aa4b744`). A direct readiness response confirmed the model and availability; the subsequent supervised retry observed a started turn.
No evidence or source changed during this recovery.

Actual run and test commit C8: `5561e8f72a83de36a68877c6b26ffc8288ade735`.
Product commit C6: `4008afb92fe983d52db33442e060210b929966c8`.
C8 equals C6 outside `docs/**` and `tests/**`. M2/T7 retain their actual C8 identity in every record.
Use the existing reviewed source, 37 qualified tools, runbook and pinned image. Do not change executable tools, tests, assertions or deadlines.

## Dependency conditions

The M1 repair must remain test-only. No product edit is granted.
M2 uses the existing `m1-profile` and `m1-cli` controller branches and the existing Canvas browser, diagnostics and coverage helpers.
T7 uses the existing browser diagnostics helper.
The Architect's proposal adds a separate dead-handler action and changes only its selected test call sites and controller self-tests.
All existing controller branches and shared helper files must remain unchanged.

Before carrying these C8 results to the repaired test commit, the Architect and independent reviewers must verify the final diff and dependency equivalence.
Record both identities and the exact source comparison. Do not relabel a C8 run as a run on the later commit.
Any change that affects M2/T7 execution invalidates this carry condition and requires a new specific decision.
The M1 repair and its own fresh two-round verification remain required regardless of M2/T7 results.

## Host window and resource conditions

LTI released its previous LA hold overnight. No old reservation or grant remains active.
LA reports that it paused new starts and is obtaining its worker's final Docker-down acknowledgment (`msg_e736676078ee`). That acknowledgment is still required before launch.
Savoy has no coordinator or active worker at the current fleet check. This is not retrospective confirmation of its old windows.
The Lead must announce exact new bounds to LA, then return the window after owned cleanup.
No LTI runtime phases may overlap. Host-only repair and review work may continue in parallel.

Before each invocation, the existing qualified preflight must pass with no foreign container.
Compare every one of the 32 full protected volume records with the exact preceding accepted operational W4 record named in the grant.
Preserve other projects' resources, Docker settings and engine identity. No prune, unrelated stop/removal, pull, tunnel or account creation.
Any unexpected difference blocks launch. A documented idle-VM bridge replacement before formal W3 must be reconciled; it does not permit a change after W3.

Every original W1-W4, sampler, lane, runner isolation, cleanup and secret check remains required as written.
Keep the existing observer coverage. Do not add a collector or query Docker event history.
No foreign mutation is permitted during the coordinated window. Unexpected foreign activity blocks acceptance and must be reported; do not silently switch to the former shared-host exception.
Obtain LA's complete-window confirmation after each invocation. Retain the actual chronology and sampler records.
No automatic retry, delayed comparison to obtain a pass, weaker assertion or longer test deadline is authorized.

## Required verification

M2 uses `qa-e2e-sim-r6`, port 8643 and subnet `172.27.0.0/16`.
It must pass all 64 cases and 13 criteria with zero skips and retries, plus M2-STACK, M3-07-M2, M3-06-M2, TEARDOWN, lane isolation and secret scan.
Use the unchanged core teardown and the separate bound run-evidence record required by B-TW-02.

T7 follows M2 cleanup under a separate grant, using `qa-e2e-m3-r3`, port 8543 and subnet `172.31.0.0/16`.
The reviewed helper alone creates its fresh clone. B-TW-03 must prove a pristine checkout before READY.
Require three default runs of 17 passing tests, all 15 criteria, only the permitted demo-only skip, a passing demo within 180 seconds and four confirmation/refusal checks.
Keep the exact `--keep` proof, teardown order, trigger mapping, secret scan and separate B-TW-02 run-evidence record.

Every invocation uses an absent runtime clone and unused output paths. Preserve all prior failed and stopped attempts.
Raw traces and stderr remain private. New private directories use 0700, files 0600 and scripts 0700, with the approved runner-specific umask rules retained.

## Acceptance limits

E-R5 remains invalidated. Its C8 Canvas round 1 PASS and round 2 FAIL stay historical and do not provide the repaired M1 verification.
The corrected independent report at `64a1b62` remains accepted as failure evidence.
Legacy results remain accepted under E-R4; no legacy rerun is required by the present test-only diagnosis.
Any new functional failure or changed dependency requires a focused diagnosis and new decision before more runtime.
Final conformance, guide completion, independent Docs QA and two blind final reviews remain required.
All 32 real-LMS rows remain UNVERIFIED. Local Canvas remains DEFERRED. No push or main merge is authorized.

## Invocation and dependency checkpoint — 2026-10-23, 02:13 UTC

Reviewer-A `msg_33e87324592d` corrects the earlier dependency description: M2 also sends `m1-cli` through `canvas/browser.ts`.
Both controller branches are unchanged in C9 and occur outside the new kill-mode block. Final blind review and evidence binding remain required.
C9 is `9eb504f5bff4be7e291570fde12fdf9919a07fa1`; its six test-path repair changes no product file.

The first M2 invocation failed before any Docker call. Zsh passed the lane flags as one argument, then a bare redirection waited on stdin.
The owner preserved the four window files and task log, and stopped only its verified shell and `cat` processes.
Failure index: `notes/m2-window-attempt1-failure-index.json`, 7,506 bytes, SHA-256 `83a98bcb970a48737fb77d8a95698fcf734f228684c3427b5806b8af7dd9aa19` under the C8 preparation root.
This is an invocation failure, not an M2 test result. Grant `msg_4dd81c22cc1a` is closed.

The Lead inspected the explicit Bash replacement and its bounded observer-cleanup correction.
Script: `notes/scripts/run-m2-window-attempt2-v2.sh`, 19,785 bytes, SHA-256 `b234d73851f6051940041098ac1ce74991bb55741dee3bfae6ada15e14c61eb0`.
Replacement grant `msg_b2b4ecd13c67` permits one M2 invocation during 02:12–02:25 UTC, with fresh `m2/window-attempt2` records.
All 37 qualified tools, source, tests, assertions, deadlines, baseline and required checks remain unchanged.
T7 and M1 still need separate grants. No PASS is implied by this checkpoint.

## M2 runtime checkpoint — 2026-10-23, 02:35 UTC

Attempt 2 stopped on SIGHUP during W2 after its parent tool closed. No M2 test ran.
Its preserved failure index is `notes/m2-window-attempt2-failure-index.json`, SHA-256 `7eb5f9cf2a90834d63caa8bca43770c5438d8a377a84fa49fa8942a5c373e22a`.
Grant `msg_b2b4ecd13c67` is closed.

Attempt 3 used a host-validated detached launcher under `msg_4cbe1bd687af`.
Run ID: `qa-e2e-sim-r6-5561e8f7-2026-10-23T02-20-19-399Z`.
All 64 cases and PRE, CLONE, H1, M2-STACK, M3-07-M2, M3-06-M2 and TEARDOWN passed; no skips or retries.
Runner summary SHA-256: `a8f31c5525be4d767f426a9a88255b6e4eb80943bcb7929a3fb43fcc9467a47a`.
The separate lane monitor exited 1 with one poll `StorageBlocked`; its `isolationPass` is false.
QA's teardown network-disappearance diagnosis is under assessment. Overall M2 is NOT ACCEPTED. No gate is waived.

Formal W3 was at 02:20:15.492 UTC and W4 at 02:23:50.839 UTC. Strict comparison ended at 02:23:54.494 UTC.
W4, sampler and anonymous-volume checks passed. All 32 complete volume records are unchanged; no lane resources remain.
W4 SHA-256: `f9ce5dbea80e359926e0baa4bc64f6e60ecc6b91553d8403b3b2d6bf878af62c`.
The Lead permits only host-side scan and evidence capture in `msg_1431eb6e25d4`, preserving the wrapper exit 1 and every original file.
The two original inline binder schema mistakes were not reached. Their separate correction is evidence capture, not a runtime PASS.
The grant is closed. The LA window is returned in `msg_25d757ac168b`; its complete-window confirmation remains pending.
T7 remains ungranted. The next runtime decision waits for Claude's assessment of the monitor finding.

## Monitor repair decision — 2026-10-23, 03:02 UTC

The Lead accepts Claude's §13 plan at `5c8f2dc`: attempt 3 stays monitor FAIL and M2 NOT ACCEPTED.
Its 64 functional results remain supporting history. One fresh M2 run is required after the private monitor repair and focused independent review.
Independent Gemini `ctx_8449a3df3e54` owns the repair in the new `tools/lane-watch-r4` directory under `msg_71a79a38b36b`.
The old 37 tools, 84-entry manifest and failed runtime files remain untouched. C8, C9, product code and `storage-docker.mjs` stay unchanged.
T7 uses the repaired private monitor too. M1 and legacy have no dependency on it.

Claude reviewer `ctx_6d532ec82e2c` found LW-R-01 in the proposed error classification (`msg_0e6a8d7219bb`).
The Lead accepts its bounded amendment in `msg_30bbc088a7ab` and `msg_8ba7ddcd0876`:
before a final network-inspect failure, permit the preceding container bulk failure and only its single-container `no such` failures that `listLane` already tolerates.
All other failures remain closed. The known-owned ledger condition and exactly one successful confirmatory listing with the id absent still apply.
The new tests cover that sequence, identical one-network bulk/single argv, and failed bulk stdout with a planted environment value.
Error evidence keeps argv, exit and stderr privately; it never retains stdout. No general retry loop or public stderr is permitted.

The M2 rerun needs unused paths for every output, observer, stop file, clone and artifact selection. It cannot reuse attempt 3's files.
The repaired files, mock self-test results and exact invocation changes need the focused review before any grant.
All other E-R6 controls stay in force. No runtime is authorized by this repair decision.

The corrected failed-run closure is `notes/m2-attempt3-capture-and-closure-report-v2.json`, 34,569 bytes, SHA-256 `b6042aca77df856e56daa8aa6a4c7393fbc8b4b9d50a1a6faa02f8084901051a`.
The Lead verified all 59 nested file bindings. It discloses overwritten intermediate derived reports, the corrected metadata and the inferred cause.
The original runtime files are unchanged. No reconstructed report is called an original.

## Repaired monitor approval and invocation amendment — 2026-10-23, 03:27 UTC

The Lead accepts the focused Claude review at `b84b53e`, `docs/reviews/M3/lane-monitor-review.md`.
The review approves the bounded repair and invocation scripts, with no open BLOCKER or MAJOR. LW-R-01 is resolved.
It is the private-tool review gate only. M2 attempt 3 remains NOT ACCEPTED; T7 has not run.

Frozen files under the C8 preparation root:

| Input | Bytes | SHA-256 |
| --- | --- | --- |
| `tools/lane-watch-r4/lane-watch-core.mjs` | 24,297 | `d7b962b6e6ebefc5eb6f2ac9212f0368c556c233cff56cbf7174937414847561` |
| `tools/lane-watch-r4/lane-watch-selftest.mjs` | 45,940 | `e7064c25ad7e54557eb5c11377ca20982fa08b7cd699da3509c04f09a88dc40d` |
| `notes/lane-watch-r4-selftest.stdout.json` | 9,143 | `031681396f997f0df695223724df5c8e2a64749ca13a3127921ddc4439d425af` |
| `notes/scripts/run-m2-window-attempt4-v5.sh` | 21,280 | `b8bda7964aad3e9aa7f1a130036238b0a396f3ca12cb034a8049dd77fc509689` |
| `notes/scripts/run-t7-window-v2.sh` | 20,605 | `1c884fdfec60a849c6f57410f7b62b28bdd37fc0d29c89510c40e4910e73d48f` |
| `notes/MANIFEST-lane-watch-r4-v2.sha256` | 1,071 | `1b6be474b5a972b5b028e064985486ea6a2f5e43767ce48f2ac63a676af27fef` |

The selftest records 39 passing checks across 54 scenarios. The reviewer checked the source and recorded result; it did not rerun the tests.
The original 37 tools, 84-entry manifest, product, C8/C9 and `storage-docker.mjs` remain unchanged.

For the one future M2 invocation, replace lane `qa-e2e-sim-r6` with unused `qa-e2e-sim-r7` everywhere.
Port 8643 and subnet `172.27.0.0/16` stay unchanged. Use fresh `m2/window-attempt4`, `m2/attempt4/*`, `m2-stack-attempt4`, observer/stop files and the unique r7 artifact selection.
The grant must set `PREV_W4` to the immediately preceding accepted operational W4, and set an absent `BASE32` file with a matching provenance name.
T7 keeps lane `qa-e2e-m3-r3`, port 8543 and subnet `172.31.0.0/16`, with its own fresh paths and separate grant.
Before either launch, QA rechecks the six-entry repaired-tool manifest and the original 84-entry manifest, confirms `PREV_W4` exists and `BASE32` is absent, and records the actual grant message and delivery IDs.
These are launch conditions; this amendment itself grants no runtime.

Nonblocking review dispositions: N1's missing selftest hash binding is disclosed; N2's three synthetic scratch folders are retained and disclosed; N3's possible short private JSON-error excerpt is disclosed.
N4 is covered by the explicit grant-time path checks. N5 is covered by the matching `BASE32` name.
N6's new r7 E2E image tag is recorded as an owned host footprint. No image cleanup or other-project mutation is added.
For N7, if any `listing_vanish` occurs, QA binds the private error file's bytes and SHA-256 without publishing its content, checks every condition (a)–(d), and records the destroy event as corroboration.
Do not reopen passing code for these NITs. Final QA retains the disclosed pre-freeze intermediate-file history.

All operational checks, no-retry rules, role boundaries, final conformance and review gates remain in force.
All 32 real-LMS rows stay UNVERIFIED; local Canvas stays DEFERRED. No push or main merge is authorized.

## M2 accepted; T7 scheduling hold — 2026-10-23, 04:38 UTC

The Lead accepts QA `msg_92b67a4ab1c8` for run `qa-e2e-sim-r7-5561e8f7-2026-10-23T04-25-46-176Z`.
Actual source/tests are C8 and product is C6. The C8-to-C9 dependency equivalence remains a separate static claim.
All 64 cases, 13 criteria and seven gates passed, with zero skips or retries. The gates are PRE, CLONE, H1, M2-STACK, M3-07-M2, M3-06-M2 and TEARDOWN.
QA's status message incorrectly listed summary exit in place of H1; the raw summary is authoritative.
The repaired monitor has `isolationPass: true`, zero ownership errors and no `listing_vanish`. The scan, sampler and operational closure passed; all owned processes exited.

| Evidence under the C8 preparation root | SHA-256 |
| --- | --- |
| r7 phase `summary.json` | `9354bc5157e70642f2002ac54b0030c120bcdd094e142b43a68b66a10f8057b7` |
| r7 phase `m2-case-results.json` | `4baa028143f06b39b5f8c7dd1565bf94fd101dde3f93e76c27850c8e759d4aef` |
| `m2/window-attempt4/w4-end.json` | `544142a119dedc4c77279e5c0078ceac7c53dd7c520558aeb156a768c13638fd` |
| `m2/window-attempt4/w4-compare.json` | `9978db7b6a3dd1553919eab0983781674dadc3aebb77d5102ab979f42331476f` |
| `m2/attempt4/lane/summary.json` | `0ae9320a3519098e0de10aa256eda439e90a65730e5602226971fde4e5ce2353` |
| `scan/m2-attempt4-scan.json` | `de83f4b80b93de9eb23c4ac782c88b0efb1c9bac5c2aabc37997d47d594629e3` |
| `m2/attempt4/run-evidence.json` | `cac0f6f45d55be26e0eacffab8d39ce66f7b01cc4e383cdc6f7836aaeeba9282` |
| `m2/attempt4/pre-w3-bridge-reconciliation-v2.json` | `f75f96176d5e4d58f97d04b60fe6743a989293a6ae6c6d1d3c5083c30d69771a` |

The Lead verified all 173 B-TW-02 bindings and full equality of the 32 volume records and network records from W3 to W4.
W3 was 04:25:41.655 UTC, W4 was 04:29:31.320 UTC, and scan closure was 04:29:38 UTC. Grant `msg_1d96a40f0530` is closed.

**Procedural deviation:** the required prelaunch hold was missed. The default bridge changed from `ea3da34c…` to `7dac5c96…` at 04:25:27.452 UTC, before formal W3, following W1 wake.
The Lead reconciled the immutable pre-run records late, at 04:28 UTC (`msg_dea51c9addc1`). All other boundary invariants were unchanged.
Architect `msg_847a71904bb4` found no repeat necessary if strict W3-to-W4 comparison, pinned predecessor/W3 records, LA whole-window confirmation with sampler evidence, and an explicit disclosure all remained required.
The Lead accepts those conditions as satisfied. The v2 record binds the difference; the partial v1 output remains preserved. No check was waived.
LA `msg_45142bff415a` confirms no mutation during 04:20:15.304–04:30:00 UTC.
It also corrects its earlier M1 Round 2 event-history statement: Docker returned only the last 256 events, not full-window history. Its confirmation rests on its no-grant/no-mutation report and current inventory; LTI's captured sampler and strict boundaries remain primary evidence.

T7 grant `msg_d04d641ae347` required a runner start by 04:33 UTC and final host return by 04:45 UTC.
The worker received the delivery at 04:33:55 UTC and finished external preflight at 04:35:27 UTC. It held before launch, as required.
No T7 runtime root or clone was created. T7 stays PENDING; the unused grant is closed in `msg_1713b21b2f5b` and `msg_c60a642ef29f`.
External preflight `w3-start.json` is 19,920 bytes, SHA-256 `8cbb2e04c9fea2bdd0be4d2ba68a3bb6cf3bafe234b89872154cfbfee04964d0` at 04:35:26.915 UTC.
It has zero containers, no problems and all 32 complete volume records identical to M2 W4. A new default bridge was created during wake at 04:35:11; no test ran on it.

Final host return: 04:38:30 UTC, `msg_4037ceaece2a`. All LTI stacks are down. No LTI Docker command or new window request is allowed through 07:45 UTC.
The next T7 attempt needs a fresh confirmed window and grant. Preserve the unused T7 output paths and frozen v2 script; use a new external preflight directory.
Final conformance, ADR status closure, guide evidence updates, Docs QA and two final reviews remain pending. This scheduling hold requires no M1, M2 or legacy repeat.

LA acknowledged the 04:38:30 return in `msg_b7f76ead5610` and confirmed no LA mutation through that time. Its correction `msg_3eafe1d524b8` identifies the seven 04:35:12 watcher events as the qualified wake container lifecycle, not bridge events.
Architect checkpoint `b0fcebf` records source conformance APPROVE with no BLOCKER or MAJOR; AC-M4-06 remains PENDING. Its attempt settled as externally blocked by unexecuted T7, not a conformance test failure. The same Claude session is retained.

Independent Gemini settled in `msg_c3e76256fd81`: M1/M2 accepted, T7 PENDING. The Lead retains the same session for the later T7 retry.
The report's fourth changed file is `docs/reviews/T7/qa.md`, rather than the original brief's tracker-repair report. The Lead reviewed and accepts this bounded QA-owned pending-status appendix; its complete committed prefix is unchanged. The tracker-repair report needs no duplicate update.

## T7 preparation and pending host handoff — 2026-10-23, 07:50 UTC

LA confirmed a planned 07:45–08:05 UTC exclusive window in `msg_7dcc7a1394ef`. The one-time preparation reminder fired at 07:41:03 and disabled itself (`msg_08e1ce513667`).
The normal same-terminal retry `ctx_e685b12752a8` failed at `agent_readiness` with `timeout`, before prompt injection. It created no owned resource and is not a test failure.
The retained Gemini terminal was live at its prompt. The dispatch recovery receipt permitted a new Task; the Lead created the bounded T7 task `task_0f19008c5331` and context-only Dispatch `ctx_992d5721e156` for that same terminal.
The exact returned preamble was accepted under terminal request `f5d35537-8806-4f72-8b66-06d00ce60414`. This low-level dispatch does not own the terminal process. QA's new task receipt and live agent status confirm that work resumed; no duplicate agent was started.

QA `msg_fd0120ef3415` reports READY FOR PREFLIGHT: Gemini 4 Argon High, all 84 original and six repaired-tool bindings pass, C8 and the frozen T7 v2 script match, and every T7 output path remains absent. No Docker command ran.
The complete committed prefixes of `docs/reviews/T7/qa.md` and `docs/reviews/M3/qa-e2e.md` remain preserved. The new task may append only those two QA reports and new private T7 evidence.
Use unused `t7-external-preflight-0745` for external preflight after the actual host handoff and a fresh Lead grant. Keep the earlier preflight intact.

The actual LA handoff is still pending at this checkpoint. Lead message `msg_7ddf9c0d59c9` keeps QA on hold. T7 has not run.
Lead `msg_4b7fbafa4e58` requests a full 20-minute window from the actual handoff if it is delayed beyond 07:49. No extension is assumed; the confirmed return deadline remains 08:05 until LA explicitly changes it.

## T7 attempt settled on external handoff block — 2026-10-23, 08:04 UTC

No actual LA handoff arrived and LTI made zero Docker calls. At about 07:58, the authoritative inbox showed the handoff requests unread. The cause of the coordinator's lack of response is unknown.
The Lead directed closure in `msg_c785cb571983` at 07:59:23 and notified LA in `msg_95e0396cb18f`. LTI never took the host; it created no stack or runtime process for this attempt.
QA settled `task_0f19008c5331` / `ctx_992d5721e156` as failed in `msg_85f57a3c0b6b`, solely because the runtime task remains externally blocked. T7 is NOT RUN/PENDING, not a failed T7 test.

The same Gemini session completed the host-only precision follow-up `task_1943471c8497` / `ctx_00abe98b28d2` in `msg_e9d44f927eae`. Normal `worker-start --terminal` succeeded for this follow-up with observed turn start.
The correction limits the unread-message observation to the actual cutoff, limits C8/C9 equivalence to the verified T7/M2 dependencies, and identifies `5def6e4b` as the preparation checkout rather than the earlier report commit.
Final `docs/reviews/T7/qa.md`: 55,995 bytes, SHA-256 `2d6fcf7e219d58d1f1a52ce383ad4dae8693da9fdedae3f30549bb108a3517e7`. The Lead verified the complete 51,252-byte committed prefix and 54,700-byte first-appendix prefix unchanged. M3's QA report is unchanged.
The Lead retained `ctx_00abe98b28d2` with no process action. Await a newly confirmed 20-minute window and actual handoff; then reuse the same QA session with a new authoritative runtime Dispatch. No preflight path, T7 runtime path or BASE32 file was created.
