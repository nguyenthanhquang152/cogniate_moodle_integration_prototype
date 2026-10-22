Verdict: APPROVE
Round: 2

# LA-E5-09 review, lens A ("Is it right and is it safe?")

Reviewer: Reviewer-A2 (Claude Code Opus 5.5 xhigh, plan LD-22). Date: 2026-10-22.
Spec: `docs/architecture/ltiaas/tasks/LA-E5-09.md`. Design: LA-ADR-06 D6 ("Re-wrap", "Legacy refusal", "Status"), D11; contract delta §3, §5; operability §6.3; BD-A2-36, BD-A2-38, BD-A2-42, BD-A2-43.

Diff: `git diff 09516e0^1 09516e0` (12 files).

Method: a throwaway `git archive 09516e0` copy under `/private/tmp`, with a clone of the integration `node_modules`. I ran the LTI service and shared unit tests (85 files, 1094 passed) and 8 mutants in that copy only. I used no Docker and no network. I did not change the integration worktree, except for this file.

## Summary

| Id | Severity | Topic |
| --- | --- | --- |
| A-LA-E5-09-01 | NIT | The `202` `traceId` is the request's trace id, not the run's, and a `skipped_lease` run still answers `202`. The operator cannot join the answer to the job-end event. |
| A-LA-E5-09-02 | NIT | A malformed `key_provider` setting row makes every `open` throw a parse error |

There is no BLOCKER, no MAJOR and no MINOR finding. The lens-A points pass (see "Checks that pass").

## Findings

### A-LA-E5-09-01 — NIT — the answer's trace id does not lead to the run

- **File:** `services/lti-service/src/http/operator/key-provider.ts` (`void runner.runNow(KEY_REWRAP_JOB)`, then `202 { job, traceId: req.traceId }`).
- **Problem:** the job-end `key_provider.rewrap` event and the `job_run` line carry the run's own trace id (`ctx.traceId`), not `req.traceId`. Also, when a run is already in progress, `runNow` gives `skipped_lease`: the route still answers `202` and writes a request event, but no end event follows for that request. The contract does not fix which trace id to return, so this is not wrong. But the operator procedure (operability §6.3) has to find the end event by action and time.
- **Suggested fix:** pass the request trace id into the run (for example as `details.requestTraceId` of the end event), or answer `409` with the running job's trace id when the lease is taken.

### A-LA-E5-09-02 — NIT — a bad settings row breaks every open

- **File:** `services/lti-service/src/store/settings.ts` (`KeyProviderSettingsSchema.parse(JSON.parse(row.value))`, read on every `open` through `legacyBlobsRefused`).
- **Problem:** only `refuseLegacyBlobs` writes this row. But a hand-edited or damaged value (for example `legacyBlobs: "allowed"` or invalid JSON) makes every `openSync` throw a `ZodError` or `SyntaxError`, not `key_open_failed`. Then every signing operation and every Dynamic Registration completion fails with an unclear error. It fails closed (no legacy open), which is the safe direction, so this is only a NIT.
- **Suggested fix:** read the row once per open with `safeParse`, treat an invalid row as "refused" (fail closed), and log one clear line (`key_provider_setting_invalid`).

## Checks that pass

| Item | Result |
| --- | --- |
| The refusal cannot lock out a needed legacy blob (lens focus) | `git grep` shows exactly two sealed columns in the LTI service: `tool_key.private_jwk_encrypted` (`store/tool-keys.ts:91`, `:228`) and `registration_session.registration_token_encrypted` (`store/registrations.ts:45`, `:63`). Both are in `SEALED_COLUMNS`, and both writers seal through the key provider (header format). The setting is stored only for an `outcome: complete` run: no exception, no unreadable blob, no stop, and a final verification in one `BEGIN IMMEDIATE` transaction, together with the setting and the end event. That verification opened every present sealed blob and found none with `legacyFormat: true`. `legacyFormat` comes from the path whose GCM tag passed (`openWithMetadataSync`, BD-A2-38), so a legacy blob whose IV parses as a `cgk1` header is still re-sealed. Mutants killed: R1 (refuse despite unreadable rows), R2 (no final legacy check), R3 (ignore `legacyFormat` when re-sealing), R7 (refuse on a partial run). |
| The refusal works (AC-07) | After the setting, `open` of a header-less blob throws `key_open_failed {table, reason: "legacy_refused"}`, and a headered blob with a bad tag gets no legacy fallback. The setting is read on each open, so it applies without a restart. Mutant R6 (legacy open after the refusal) is killed. |
| A crash or stop leaves every row openable (lens focus) | Each batch of at most 100 rows is one synchronous transaction with a compare-and-set update (`WHERE key AND account AND blob = old blob`; mutant R5, no compare-and-set, is killed). A crash rolls the batch back, so each row holds either the old blob or a blob of the active version, and both versions are in the ring. The lease (at least 10 s left) and `ctx.signal` are checked before each batch and in the final scan, and the job yields between batches. Mutants R4 (no lease margin) and R8 (no abort check) are killed. A stopped run ends `partial`, and the next call continues (AC-06). |
| No key material in logs or events (lens focus) | The end event `details` hold `outcome`, counts, `unreadableVersions` (version ids), `stopReason`, `errorClass` (a class name only) and `legacyBlobsRefused`. `job_run` has counts. `key_open_failed` has `{table, reason}`. Plaintext buffers are zeroed after each open (`opened.plaintext.fill(0)`). The status answer has version ids and counts only. |
| Two audit events | The request event goes through `ctx.audited` before the run starts (an audit failure starts nothing), and the job-end event has actor `system:key-rewrap`. A failed run keeps `result: ok` with `details.outcome: failed` (BD-A2-42). |
| Operator routes (lens focus: tenant scope) | Both routes are on the operator listener behind operator-key authentication, and both are operator-global by design (the key ring is service-wide). The status answer has no tenant data, only counts per version. `derivedCount` counts `service_key` rows by derivation version, and the re-wrap does not change it (operability §6.3 CAUTION). |
| Ownership | `packages/shared/src/key-provider.ts` (LA-E5-08 file) gets the additive `openWithMetadataSync` and the `legacyBlobsRefused` option that BD-A2-38 asks for. `jobs/index.ts`, `main.ts`, `http/operator/index.ts` and `store/settings.ts` get the RQ-2 lines in S1 files that the dispatch names. |

Note (no finding): the final verification decrypts every present sealed blob in one write transaction. At LTI sizes (signing keys per account, and registration sessions kept 24 h) this is short. A much larger table would need the same batching as the re-seal.

## Round 2

- Diff: `git diff 3b14a84^1 3b14a84` (lane S2, fix round 1; 15 files). The files at `HEAD` are the same as at `3b14a84`. Reviewer: Reviewer-A (same lens A).
- References: my round-1 NITs above; A2 BD-A2-50 (`503 NOT_READY`, `409 JOB_RUNNING`, `202`); LA-ADR-06 D6.
- I ran on the host (no Docker): Vitest on `http/operator/key-provider`, `jobs/**`, `keys/**` and `api-errors`: 9 files, 62 tests pass.
- Blind review as before.
- **Verdict (round 2): APPROVE.** Both round-1 NITs are closed, and the fix adds no new risk. New: **0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**

### Round-1 findings

| Id | Status | Evidence |
| --- | --- | --- |
| A-LA-E5-09-01 (NIT) | closed | A held lease now gives `409 JOB_RUNNING` before any start. The check runs once before the audit frame and again inside `audit.change`, so the refused event and the decision come from one read. The `202 { traceId }` call passes `{ traceId: req.traceId }` to `runNow` (test: `toHaveBeenCalledWith('key-rewrap', { traceId })`). The runner side of the trace join is S2's next round, as the dispatch says. Two calls at the same moment can both pass the check, and the second `runNow` then gives `skipped_lease`. BD-A2-50 accepts this race and leaves it to the runbook. |
| A-LA-E5-09-02 (NIT) | closed | `loadKeyProvider` reads the `key_provider` setting once at start. A damaged row stops the start with `key_provider_setting_invalid`, and the error does not hold the row value (test in `key-config.test.ts`). A row damaged by hand while the service runs still makes each open throw, which is fail-closed. That case is a hand edit of a running database, so I leave it as is. |

### New code, checked

- `503 NOT_READY` (BD-A2-50): when the runner is absent or in any state other than `active` (`idle`, `waiting`, `stopping`, `off`), the route answers `503` with `reasons: ['job_runner_not_active']`, `retryAfter: 30` and the `Retry-After` header. It writes **no** event and calls no `runNow` (five-case test). `409 JOB_RUNNING` writes exactly one refused event and starts no second run, for a lease of this runner or of another one (test).
- The `run()` split keeps the round-1 safety exactly:
  - each batch is still one synchronous transaction that checks the stop reason first;
  - each row is updated by compare-and-set on the old blob, and the plaintext is zeroed in `finally`;
  - the cursor and the counts move only after a committed batch;
  - the final verification and the refusal flag share one transaction with the end event.

  So a stop never leaves a half re-sealed blob: a row has either its old blob or a blob of the active version. Only a `complete` outcome sets `legacyBlobsRefused`. An unreadable blob found in the final scan makes the run `failed`, and nothing is refused.
- `SEALED_COLUMNS` (one inventory): `tool_key.private_jwk_encrypted` (present = `length > 0`) and `registration_session.registration_token_encrypted` (present = `IS NOT NULL`). These are the same predicates as before. The AAD builders give the same `associatedData('lti', table, column, accountId, rowId)` input as the old local functions, so every existing blob still opens. Readiness (`keyVersionsInUse`), the status counts and the re-wrap now read the same list, so a new sealed column cannot be missed by one of them. `createLtiJobRunner` now needs `keys`, so every LTI runner registers `key-rewrap`.
