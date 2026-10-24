# E-R4: accept disclosed C8 legacy evidence and finish verification

Decision: ACCEPTED by the Lead for the disclosed legacy evidence and remaining verification route at 2026-10-22 18:04 UTC.
Product C6 and tests C8 stay frozen. E-R3 remains VOID as a historical grant.
This decision does not describe its window as exclusive.

## Basis

Claude Architect proposed P1 in section 10 of the [failure plan](../reviews/M3/t6-09-failure-plan.md), committed at `a8354f27a3b1b0955b19528d489f2f6173abf5ef`.
AC-M3-06 and AC-M3-07 passed. The failed control was the stronger exclusive-host grant condition.
P1 accepts this legacy evidence after whole-window attribution and QA disclosure.

- Savoy confirmed the full 16:38:27–17:23:59 UTC window in `msg_779552416a56`.
  Its Docker mutations occurred only from 17:20:16 to 17:22:57. It also made read-only Docker calls.
  It confirmed no prune, no stop or removal of other projects' resources, no network connect or disconnect, and no engine restart or settings change.
- LA confirmation: `msg_25fb37c37283` confirms that the host-only hold stayed in force throughout this window. The LA Lead issued no Docker commands. All worker briefs banned Docker, and every report in that period stated no Docker use. LA reports no contrary action.
- Common QA's exposure ledger, corrections and disposition are committed at `e8a1947ec9c9a564dd7db2a61b3b30e57933ff47`.
  M3/qa.md is 96,561 bytes, SHA-256 `cb52d3ec3220550ef1b50292bf7e96b3c489f6e39ef06cc2fa672d18880d6b85`.
  M1/qa.md is 347,925 bytes, SHA-256 `9c9516317a793157b9e018fb88e8716c34a83204ca13c9e869a1757191808404`.
  Both original prefixes are unchanged.
- The independent C8 and launcher reviews remain valid at `aaf95ed` and `27c4ed7`.
  No source, test, criterion, assertion, timeout, launcher or contract changed.

## Accepted legacy evidence

The invocation ran from 16:38:27 to 17:23:51 UTC at `V4/legacy-c6`, with gate `msg_46936ef706b8`.
V4 is `/Users/quangnguyen/cogniate-qa-runs/qa-common-c6-v4-20261022T1554Z`.
All twelve groups passed, with 304 raw PASS entries.
The sum of unique summary IDs within each subrun is 251; this is not a global distinct-case count.
T5b passed 24 tests and T6 passed 18, with no skips or flaky results.
AC-T5-36 took 12.435 seconds, AC-T6-07 took 0.420 seconds, and AC-T6-09 took 4.685 seconds. All had retry 0.

**Functional PASS; exclusive-host condition FAIL; window NOT exclusive.**
The functional and criterion results are accepted under P1. The historical scheduling failure remains recorded.

All 32 full volume records and all network records match between start and end.
W4 was captured at 17:23:59.855 UTC, SHA-256 `26751ef27a7fee096c3a38247941fd9a3c05c47cc54ab72c8ec4b525e660e1d3`.
The strict comparison and secret scan passed. The sampler records external activity.
Endpoint equality alone does not establish an absence of temporary overlap.

The Lead verified all 74 indexed file sizes, modes and hashes against the restored original index:
- Index `evidence-index-legacy-c6.tsv`: `7b7f63eb1696cafaeb2442e85960f58411262be0936e007b05a449524537af63`.
- Ledger `CLOSURE-LEDGER-LEGACY-C6-C8.json`: `12791f3567e1816c80ae7d8f45a65a74a7bb1e5e2f49948ca80a8fa5a8dc1480`.
- Report `REPORT-LEGACY-C6-C8-PASS.md`: `ee2ba4db1c235e30de0f1edad5b7237b1d1a3be5c708fd3895b3164cd88991c6`.

Two derived files and their index entries were temporarily revised, then restored byte-identical.
All 72 underlying entries remained unchanged. QA's appended disclosure retains both sets of bindings.
The restored report's 258-count error is corrected by the appendix; the six summaries and ledger give 251.
The local empty or timed-out event queries establish no general Docker history-retention policy.

## Remaining requirements

Product C6 is `4008afb92fe983d52db33442e060210b929966c8`.
Tests C8 are `5561e8f72a83de36a68877c6b26ffc8288ade735`, tree `65eaefab31ec6800fca06aee50e5e25c95713f8a`.

Keep the [E-R3 row-reuse limits](r3-evidence-decision-2026-10-22.md):
1. Two fresh Canvas SIM rounds of 258 rows each: 251 non-browser plus 7 browser, or 26 common plus 232 Canvas.
2. Independent judgments of 232 fresh Canvas rows in each round and exact round equality.
3. At most 230 non-selected C4 full2 rows carried under a per-row ledger. Keep the one carried Canvas snapshot separate.
4. M2 at actual C8: 64 cases and 13 criteria, with no skips or retries.
5. T7 at actual C8: three runs of 17 passing tests, all 15 criteria, the sole permitted demo-only skip, demo at most 180 seconds, and four confirmations.

Every repeated row uses its fresh result. Do not call 258 rows a fresh 488-row run or 232 rows a fresh 233-row judgment.
Each runtime phase needs a separate explicit grant, preflight, protected-record checks, cleanup, W4, scan and observer continuity.

P1 applies only to this disclosed legacy invocation. It does not authorize unexpected future overlap.
Resolve host scheduling and confirm both project holds before each later runtime window.
Any new functional failure, unequal required rounds or product change invalidates this route. There is no automatic retry.

Final architecture conformance, necessary guide edits, independent Docs QA and two blind final reviews remain required.
All 32 real-LMS rows remain UNVERIFIED. Local Canvas remains DEFERRED.
No certification or enterprise-readiness claim is accepted. No push or main merge is authorized.
