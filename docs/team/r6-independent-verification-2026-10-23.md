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
