# C8 legacy run: functional pass and external Docker overlap

Lead decision, 2026-10-22 17:33 UTC: **E-R3 is VOID. No new runtime is authorized.**
This supersedes the execution acceptance in `r3-evidence-decision-2026-10-22.md`.
It does not change source C6, tests C8, historical evidence or the raw tool results.

## Closed run facts

- Product: C6 `4008afb92fe983d52db33442e060210b929966c8`.
- Tests: C8 `5561e8f72a83de36a68877c6b26ffc8288ade735`.
- Runtime: `qa-common-c6-v4-20261022T1554Z/legacy-c6`, dispatch `ctx_72afbef88d8c`.
- Runner start: 16:38:27 UTC. Runner exit: 17:23:51 UTC, code 0.
- All twelve functional groups passed. The final QA closure bundle is pending.
- Raw T5b results: 24 passed, zero skips or flaky results. AC-T5-36 passed in 12.435 seconds, retry 0.
- Raw T6 results: 18 passed, zero skips or flaky results. AC-T6-07 passed in 0.420 seconds; AC-T6-09 in 4.685 seconds, retry 0.
- Final snapshot: 17:23:59.855 UTC, SHA-256 `26751ef27a7fee096c3a38247941fd9a3c05c47cc54ab72c8ec4b525e660e1d3`.
- The Lead compared all 32 full volume records and all network records with the starting snapshot. They are identical. No container remains; the port is free.
- The strict comparison tool returned 0. The secret scan returned 0. Preserve both results as written.

## Confirmed external activity

Savoy acknowledged a Docker hold through 18:45 UTC in `msg_221ac4615822` at 17:00:23 UTC.
It superseded that hold at 17:20:10 UTC in `msg_06940e42e12b`, citing a machine-owner instruction.
Its later chronology, `msg_be9de4c8842a` at 17:31:47 UTC, confirms actual work during the LTI run:

| UTC time | Reported Savoy action |
| --- | --- |
| 17:20:16 to about 17:20:22 | Temporary PostgreSQL container, then removal with its volume. |
| About 17:20:29 to 17:20:47 | Local image build. |
| About 17:20:50 to 17:21:19 | Four temporary runs of that image. |
| About 17:21:20 to 17:21:30 | Temporary local PostgreSQL container, then removal. |
| About 17:22:45 to 17:22:57 | Another temporary integration-test container, then removal. |

Savoy states that it did not use the LTI containers, networks or volumes.
Its times come from container epochs, logs and file timestamps, with a few seconds of precision.
The end snapshot cannot by itself rule out temporary activity between snapshots.
Therefore the raw comparison PASS does not establish compliance with the grant's exclusive-host condition.

## Disposition

- Functional results: PASS, preserved. Protected resource equality and raw scan results: PASS, preserved.
- Exclusive-host condition: FAIL. The attempt is not accepted as the complete runtime proof.
- No product regression is established by this scheduling conflict.
- Common QA closes the evidence and records the distinction. It must not rewrite successful tool outputs as failures.
- Claude Architect assesses the smallest justified remediation against the actual criteria and contracts. The proposal must state any allowed evidence reuse.
- No automatic full retry, test change, weaker assertion, longer test deadline or product change is authorized.
- The shared user has been asked to resolve the remaining Docker schedule. Host-only work may continue.
- All 32 real-LMS rows remain UNVERIFIED. Local Canvas remains DEFERRED. No push or main merge is authorized.
