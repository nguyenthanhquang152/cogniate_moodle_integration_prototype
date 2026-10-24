# E-R5: attributed shared-host verification with unchanged checks

Decision: ACCEPTED FOR EXECUTION by the Lead, 2026-10-22 18:48 UTC.
This amends only E-R4's requirement for both projects to reserve Docker before each remaining invocation.
It does not change source, tests, assertions, deadlines, tools, launchers or acceptance criteria.
E-R4's accepted legacy results remain accepted with their non-exclusive window disclosed. Historical E-R3 remains VOID.

## Authority and evidence

The user authorized completion of the LTI integrations and their verification.
The Lead may coordinate LTI work within its own resource boundary.
This decision reserves no host time, delays no Savoy work and does not override Savoy's immediate-access instruction.
It does not infer an answer to the user's pending scheduling question. A future request to prioritize an exclusive reservation still needs coordination.

Claude Architect's proposal and final clarification: docs/reviews/M3/t6-09-failure-plan.md section 11 as corrected by 11.6, committed at 3872c0616e296241e2204dfa6df568f2e7ebdd52; 45,418 bytes, SHA-256 30482dc238068868f3948647270dc1e46b6422f9eadf06f8be1032a4338b4ae0.
Independent Gemini availability assessment: msg_54dcc78e93bf.
Savoy prospective boundaries: msg_962e480b30de and msg_b58be38c7de1.
Conservative block chronology assessment: msg_32c9129a2fda.
LA remains under its acknowledged host-only hold, msg_25fb37c37283.

Product C6: 4008afb92fe983d52db33442e060210b929966c8.
Tests C8: 5561e8f72a83de36a68877c6b26ffc8288ade735; tests tree 65eaefab31ec6800fca06aee50e5e25c95713f8a.
C8 equals product C6 outside docs/tests.
All reviewed v4 launchers, qualified QA tools, source and pinned image identities stay unchanged.

## Required boundaries

Each invocation has its own explicit Lead grant and new absent root.
Start only when the existing qualified preflight passes with no foreign container.
Preserve all 32 full baseline volume records, built-in networks, engine/settings identities and other protected resources.
Any unexpected preflight difference requires a hold before launch.

Savoy uses only its own sto-* containers, their anonymous volumes, and savoy-transaction-orchestrator:local image/build.
Its ports are loopback only and exclude 8443, 8543 and 8643.
It does not prune or stop, remove, attach to or modify LTI or other-project resources.
It does not restart or reconfigure the engine or change the 32 pre-existing volume records.
It currently uses the default bridge. Any new Savoy network must be removed within its block and must avoid 172.27.0.0/16, 172.29.0.0/16 and 172.31.0.0/16.
Builds use BuildKit; all test containers have explicit sto-* names and Ryuk is disabled.
An unexpected helper or other unexplained container blocks acceptance.

Every Savoy block must have a conservative start and end time to the second, enclosing all mutations and final removals/build completion.
It must list every container name and image build.
After each LTI invocation, Savoy must confirm that its reported blocks cover the complete W1-start through W4-end interval.
Match every non-lane sampler name against the reported names. Unknown activity blocks acceptance.
The sampler may miss sub-15-second containers; the completeness statement and conservative intervals remain necessary.
No Docker event-history assumption or new collector is accepted.

## Verification and acceptance

All original W1–W4, sampler, lane, runner isolation, cleanup and secret checks must pass as written.
Foreign activity spanning a snapshot can make these checks fail. Keep that failure.
Do not suppress, patch, repeat, delay to obtain a different result, or relabel a failed check.
No automatic retry is authorized. Any new functional failure, unequal required rounds or product change invalidates this route.

If any reported block overlaps W1 start through W4 end, independent QA must provide the final Architect's additional evidence for every identified negative-check row in that invocation.
If no block overlaps and the sampler shows no unexplained non-lane activity, the extra row evidence is not required.
For overlapping Canvas SIM invocations, reconcile whole-invocation lms-sim, lti-service and cogniate-app logs through teardown. Every score POST must map to an expected positive step, with no unmapped POST or score-sync event. Best-score publications have exactly two POSTs (80 and 90); M1-33 publications have two (initial failure and manual Resend); preview and no-score publications have none. The two browser negative rows require retained trace/log evidence that their page or control-frame work completed before the fixed wait ended. No new raw simulator dump is required.

For overlapping M2, the whole-invocation app log must show exactly one GET for M2-13's Canvas connection (the page load), plus the Blackboard transition GET and a Blackboard poll before the final check. Combined with unchanged useApi cleanup, this establishes cancellation; it does not claim that a late Canvas answer arrived. A second Canvas GET leaves that overlapped M2 invocation unaccepted and requires a window without foreign work for M2. It does not block SIM or T7; no automatic M2 rerun is granted.

For overlapping T7, each confirm-no PTY log must show the question before the echoed no and the stop message. Missing required evidence blocks acceptance.

Each accepted record must say the window was not reserved exclusively and must list any attributed foreign intervals.
Passing a shared-host invocation does not establish exclusive-host compliance or enterprise performance.

## Remaining work and scope

Two Canvas SIM rounds must each pass 258 rows: 251 non-browser plus seven browser, or 26 common plus 232 Canvas.
Independent QA judges 232 fresh Canvas rows per round and exact round equality.
Only the 230 non-selected C4 rows may carry, with an exact per-row source ledger. Keep the one carried Canvas snapshot separate.
Every repeated row uses its fresh result. No fresh 488-row or fresh 233-row claim is permitted.

M2 runs at actual C8: 64 cases and 13 criteria, zero skips or retries.
T7 runs at actual C8: three runs of 17 passing tests, all 15 criteria, the single permitted demo-only skip, demo <=180 seconds and four confirmation/refusal checks.
Final architecture conformance, necessary guide updates, independent Docs QA and two blind final reviews remain required.
The same retained Codex executor owns any approved product repair and final Docs.
All 32 real-LMS rows remain UNVERIFIED. Local Canvas remains DEFERRED. No push or main merge is authorized.
