# E-R3: bounded evidence route after the C8 keyboard test repair

Decision: ACCEPTED FOR EXECUTION by the Lead, 2026-10-22 16:33 UTC.
This accepts the route and frozen identities. It does not accept runtime results.
Each Docker invocation still requires its own explicit Lead window.

## Candidate and approvals

Product C6 is `4008afb92fe983d52db33442e060210b929966c8`.
Tests C8 are `5561e8f72a83de36a68877c6b26ffc8288ade735`, tree `65eaefab31ec6800fca06aee50e5e25c95713f8a`.
C8 equals C6 outside docs and tests. C7 to C8 adds 33 lines in two test files and deletes none.

Both independent Claude Opus 5.5 xhigh reviewers approved the plan, C8 and the held v4 launchers:
- [Reviewer A](../reviews/M3/t6-09-reviewer-a.md): 30,327 bytes, SHA-256 `752472f72ef4de6708ec3e7152e88a3da2c844ed3a0abd03ab294b8a5eebfe48`; completion `msg_38ff4b2ecf91`.
- [Reviewer B](../reviews/M3/t6-09-reviewer-b.md): 22,142 bytes, SHA-256 `55bb84600eb85bca484d98532b68e70351414662990b36a6b27a557f22bf121a`; completion `msg_df229c776729`.

Neither reviewer found a BLOCKER or MAJOR. Both approvals exclude runtime acceptance.
Their quota-stopped predecessors gave no final approval. Both successful review workers are released.

## Correct scope of reuse

No producer of a carried M1 SIM, migration, snapshot or storage row loads either R3 test file.
M1 Vitest collects `acceptance/M1/{owner}/**/*.test.ts`; M1 Playwright matches `M1/**/*.spec.ts`.
The M1 legacy phase runs the changed T6 spec through `run-t5.mjs`.
The full runner also calls legacy at its end. Therefore, every legacy group must run fresh.
This scopes plan condition (b) and closes A-T609-01 / B-M3-T609-02 for this decision.

The accepted V1/V2 reach evidence and complete C4 asset mapping remain unchanged.
C6 to C8 changes no product code or input to a carried-row producer.
The earlier source and unit checks need no repeat solely because of this test repair.

Required fresh evidence:
1. All 12 legacy groups on C6 product with C8 tests.
2. Two Canvas SIM rounds, each with 258 rows: 251 non-browser and 7 browser, or 26 common and 232 Canvas.
3. Independent judgment of the 232 fresh Canvas rows in each round, with exact round equality.
4. All 64 M2 cases and 13 criteria at actual C8.
5. Three T7 runs of 17 passing tests, the sole permitted demo-only skip, all 15 criteria, the demo and four confirmation checks at actual C8.

At most 230 non-selected C4 full2 rows may carry. Final QA must list each carried row and its original run.
Every repeated row uses its fresh result. The one carried Canvas snapshot row remains separate from the 232 fresh Canvas rows.
A 258-row run is not a fresh 488-row run. A 232-row Canvas judgment is not a fresh 233-row judgment.

Any fresh test failure, unequal rounds or product change voids E-R3. No automatic retry is permitted.
The Lead must then record a new decision. The strict route needs its own reviewed full launcher; none is held now.

## Frozen launchers and execution owners

V4 root: `/Users/quangnguyen/cogniate-qa-runs/qa-common-c6-v4-20261022T1554Z`.
Future runtime source: `V4/c8-clean-src/source`. It is clean, detached at C8, and has no environment or host artifacts.
The old `c8-src/source` belongs to the accidental attempt and is not the clean runtime source.

- Legacy launcher: 12,455 bytes, SHA-256 `9d03a98ec2569bd86a20dc366268716a20aba1f32b7e964f7683b3db8d6ef9e7`.
- Canvas SIM launcher: 12,597 bytes, SHA-256 `d812874703f2224fe891a67ea104c2a2af39b6c41b19d5316c31485a6220f7b9`.
- Prep index: 90 entries, SHA-256 `dd1b040f6865033181b886e6f6ed86fd0fdf99f40811c2ce13958e1b4be0aa37`.
- Clarification index: 2 entries, SHA-256 `c6a52076be05b6148f4297994863d61973047a09b523ca8d2e2ba8cc470807ad`.

Common Gemini QA owns task_0b7729855fc5 / ctx_72afbef88d8c.
Independent Gemini Canvas/M2/T7 QA owns task_3ca468cb75c8 / ctx_806443ba13cd.
The same retained Codex session owns all product repairs and final guide edits.
A separate Claude Architect supplies final conformance. Maximum: three active workers plus Lead.

Each grant must quote the exact held command with `umask 077 && test ! -e <new root> &&`.
Use the qualified process-group wrapper. Never invoke a real launcher as a guard probe.
Preserve observers through final W4 and keep the full 32-record baseline.
No pruning, reuse of stopped roots, hidden retries or timeout increase is authorized.
Only a gate message in a later explicitly granted fresh root can bind an accepted invocation.

## History and findings

E-T5R remains VOID. The C6/C7 attempt remains FAILED.
Its ten passing groups fill no required fresh group in E-R3.
The 15:58:56 guard-control run remains UNAUTHORIZED/STOPPED, with no test credit.
Its gate message `msg_2f257a8675cf` is VOID.
Cleanup was accepted: all 32 original full volume records match, owned resources/processes are gone, and the strict comparison and scan passed.
QA's private clarification distinguishes manual closure records from launcher output. It preserves every held file.

Accepted non-blocking dispositions:
- QA appends final C8/v2 bindings to the tracked R3 report before its runtime report; do not rewrite the initial R3 record.
- Product late-focus findings AR-M3-T609-01/02, A-T609-02 and B-M3-T609-06 are MINOR and deferred. Input before route focus settles can be lost. No product repair is authorized in this round.
- Preserve the recovered trace facts: the actual URL included port 8443, all 24 characters were lost, and the exact callback remains inferred.
- Keep failure trace locations private. The run-t5 passes clear the shared Playwright output directory; only the final executed pass retains those browser artifacts. Per-pass output directories are deferred.
- Accept the duplicate helpers, frame dependency and future safe-poll comment as NITs. Any future product focus change must update the two helpers in the same round.
- The launchers have no internal grant check. Explicit grants, absent-root prefixes and the prohibition on guard probes remain required.

Final architecture conformance, guides, independent Docs QA and two final blind reviews remain required.
All 32 real-LMS rows stay UNVERIFIED. Local Canvas stays DEFERRED.
No push or main merge is authorized in this phase.
