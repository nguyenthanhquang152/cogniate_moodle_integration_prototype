# M1-17.canvas.repeat oracle repair — Reviewer-A

Verdict: **APPROVE** (test-oracle source only)

Round: 1

| Item | Value |
|---|---|
| Reviewer | Reviewer-A (Claude Code, Opus 5.5 xhigh), retained session `604b28c1-156c-4266-84c3-e0f0089004da` |
| Date | 2026-10-21 |
| Task / dispatch | `task_6f727569298d` / `ctx_783345df22cc` |
| Candidate (product = test) | `55c33a3e2d60670b5e759a79144c96bd213fca1f` |
| Base | `a784522a3cdd9bb67453b03093092cac24e87402` |
| Changed code | `tests/acceptance/M1/canvas/31-canvas-grants.test.ts` only, one case, +8/−2; SHA-256 `888fd4c2e9814defd9ac8912a330122a2eac0ac596f9c18128081613a4240ed0` (base `e2ac9811…e262`) |
| Contract | AC-M1-17 ("The first call repeated (same values) → `200`, same platform, no new `grant_redeemed`"); the R3.7 structured completion and logging rule |
| Lens | Correctness, security, and no false PASS under concurrent logging |
| Runtime credit | **None.** No product, stack or Docker run. |

## 1. Summary

The repair replaces a millisecond time window with line counts behind a completion barrier. The new oracle has no clock comparison, so it cannot count the first redemption again. It still fails a real duplicate, a redemption of another grant of the same connection, and a wrong baseline. I found no weakened assertion and no race that moved to another place.

I have two minor notes and one wider observation. None of them blocks this repair:

- **A-CR-01 (NIT):** the oracle compares counts, not line identities, and it has no truncation or process-change guard.
- **A-CR-02 (limit):** the oracle depends on the R3.7 order (a redemption line comes before its own request's completion line). The product source meets this order.
- **A-CR-03 (observation, outside this delta):** other absence checks that use `since = Date.now()` against container timestamps can give a false PASS when the container clock lags.

## 2. Inputs and independence

- I reviewed the exact candidate in a fresh detached clone (`/tmp/rva-55c33a3`, `HEAD` = `55c33a3…`). The base is a separate clean clone (`/tmp/rva-a784522`).
- `git diff a784522 55c33a3` outside `docs/` changes only the one test file. `tests/acceptance/M1/canvas/manifest.json`, `tests/host/**`, `services/`, `apps/`, `packages/`, `infra/` and all `package*.json` files have no change.
- I read the case, the helpers that it calls (`completed`, `waitForLog`, `readLog`, `redeemedLines`, `canvasBound`, `canvasRedeem`, `noRemoteCall`, `app`/`appApi`, `logEvents`/`eventsSince`), and the product log path (`redemption.ts`, `server.ts`, the shared logger).
- I read QA's diagnosis in `docs/reviews/M1/qa-canvas.md` §14 and the held evidence in `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-a784522-wgLHNZc0/repair-m1-17/`.
- I did not read another reviewer's report for this task.
- I ran no product, stack, Docker or network command. I changed only this file.

## 3. What the repair does

`tests/acceptance/M1/canvas/31-canvas-grants.test.ts:89-102`:

1. `canvasBound()` registers the connection with one `PUT …/platform` (`canvas.ts:48-55`).
2. **Barrier 1** (`:93`): `completed(await app(b.s, 'GET', connPath(…)), 'GET')`. It waits until the GET's own `http_request` line (same trace id, method and status) is in `cogniate-app.jsonl` (`snapshot.ts:27-33`).
3. **Baseline** (`:94-95`): `redeemedLines(connection)` must be exactly `[b.grant.id]`. This check is new and stricter.
4. **Repeat** inside the unchanged `noRemoteCall` (`:96-100`): `200`, the same platform id, then **barrier 2** `completed(again, 'PUT')`.
5. **Result** (`:101`): the connection's `grant_redeemed` count is unchanged.

The removed line was `assert.equal(logEvents('grant_redeemed', since, { grant_id }).length, 0)` with `since = Date.now()` taken after `canvasBound()`.

## 4. Why the barrier proves the order (source facts)

- `redemption.ts:308` writes `grant_redeemed` inside the handler, before `return outcome.connection` (`:309`). So it comes before the response is sent.
- `server.ts:107-112` writes `http_request` in the `onResponse` hook, after the response.
- `packages/shared/src/logger.ts` (`createLogger`) writes every line of the service to one `createWriteStream(…, { flags: 'a' })`. A single stream writes its chunks in FIFO order. So a later line that is complete in the file proves that every earlier line of that process is in the file.
- The test sends the barrier GET only after it receives the first PUT's response. So the first redemption line is earlier in the stream than the GET's completion line. After barrier 1, the baseline read sees it.
- The repeat PUT would write any redemption line before its own completion line. So after barrier 2, the final read sees it.
- `readLog` (`logs.ts:28-46`) ignores only a partial last line. Any other line that is not a JSON object makes `redeemedLines` fail with "BLOCKED: incomplete capture". A partial last line cannot hide a counted line, because the barrier line comes after it and is complete.
- If the app process restarts and loses unwritten lines before barrier 1, the baseline is `[]`, and the case fails closed.

## 5. Evidence

### 5.1 QA evidence that I ran myself

| Check | Result |
|---|---|
| `m1-17-controls.mjs` (QA, SHA-256 `4ebe8d49…eee4`) against my two clean clones | 10 of 10 controls as expected. The outcomes, source hashes and file hashes are identical to QA's `m1-17-controls-output.json` (`e3410920…46d9`). |
| `node tests/host/run-m1.mjs --harness-only --provider canvas` (candidate) | exit 0: 70 of 70 self-checks, typecheck, 251 API + 96 host rows |
| `… --provider all` at the candidate **and** at the base | both: 392 API + 96 host = **488** rows per round, phases `sim` 394, `migration` 12, `snapshot-upgrade` 6, `snapshot-isolated` 6, `storage` 70; only `c-host-negative` is conditional. They are identical. |
| Case id, title and manifest | 38 `m1Test` ids in the file, the same before and after; `manifest.json` unchanged (233 Canvas entries); same title |

QA's controls compile the real `readLog`, `redeemedLines` and `eventsSince`, but they re-state the case's assertions. They do not run the case or the barrier.

### 5.2 My own controls (synthetic, host only)

`/tmp/rva-m117/case-controls.mjs` extracts and transpiles the **actual** old and new case bodies. It runs them with the real `readLog`, `waitForLog`, `completed`, `redeemedLines`, `eventsSince` and `logEvents` on a synthetic `cogniate-app.jsonl` in a fresh `mkdtemp` folder. Only the network calls are fakes (`canvasBound`, `app`, `canvasRedeem`, `noRemoteCall`), and they append the lines that the product would write, in the product's order.

| Scenario | Old case (`a784522`) | New case (`55c33a3`) |
|---|---|---|
| The observed sequence; container clock 1 ms ahead of the host | **FAIL** (reproduces the run) | PASS |
| A real duplicate redemption on the repeat; container clock 50 ms behind | **PASS** (the old oracle misses it) | FAIL |
| A duplicate redemption of the same grant | — | FAIL |
| The repeat redeems another grant of the same connection | — | FAIL |
| Another connection redeems in the same window | — | PASS |
| The barrier line has another method | — | FAIL (fail closed) |
| The log is truncated (first line removed) and one new redemption is added | — | **PASS** (A-CR-01) |
| The product writes the redemption 600 ms after its own completion (R3.7 broken) | — | PASS (A-CR-02) |

So the exact old failure is reproduced, and an actual duplicate fails. The old oracle also had a false-PASS mode, which the repair removes.

## 6. Findings

| ID | Severity | File:line | Finding | Suggested action |
|---|---|---|---|---|
| A-CR-01 | NIT | `31-canvas-grants.test.ts:101` | The final check compares only the count. It also has no truncation or process-change guard, which the accepted R3.7 audit oracle has (`snapshot-oracle.mjs` `auditWindow`: the same `service_started` line and trace, and a cursor that does not go back). Control: when the log loses a line and gains a new redemption, the case passes. I found no harness step that truncates `cogniate-app.jsonl` inside a test, so this is not a likely case. | Optional: compare identities, for example `assert.deepEqual(redeemedLines(id).map((e) => [e.line, e.trace_id]), first.map((e) => [e.line, e.trace_id]))`, or reuse `auditCursor` around the case. |
| A-CR-02 | Limit (no action) | `redemption.ts:308`, `server.ts:107-112`, `logger.ts` `createLogger` | The oracle is only as strong as R3.7: one process, one FIFO stream, and the redemption line before its own completion line. The product source meets this. A redemption that is written after the completion would be missed, but the old oracle had the same blind spot, so this is no regression. | None. Keep the R3.7 bounded-use note. |
| A-CR-03 | Observation, outside this delta | e.g. `21-canvas-protocol.test.ts:198`, `:199`, `:258`; `61-canvas-containment.test.ts:167`; `canvas.ts:173` (`sinkHitsSince(since)` in `noRemoteCall`) | About 9 Canvas absence checks compare a host `Date.now()` with container log timestamps (`lti.ts:209`, `>=`). Also, `eventsSince` returns `[]` when the read fails. When the container clock lags the host, or when the log cannot be read, a real event can be missed, which gives a false PASS. My control shows this for the old repeat oracle. QA's §14.2 cursor review looked only at the inclusive-window false FAIL, not at this direction. | Lead decision: a separate, bounded audit of the time-window absence oracles. This repair does not need it. |

## 7. Limits

- This review gives **no runtime acceptance credit**. The repaired case needs a Lead commit, a reviewed freeze and new complete M1 rounds (and the other runs that the Lead names) at that SHA.
- The barrier argument is a source fact plus synthetic controls. The real file system, the Docker bind mount of `infra/.logs` and the container clock are not measured.
- Existing source approvals stay source-only.

## 8. Verdict

**APPROVE** at `55c33a3e2d60670b5e759a79144c96bd213fca1f`, for the test-oracle source.

- No BLOCKER, MAJOR or MINOR finding.
- AC-M1-17 is not weakened: the `200`, same-platform and `noRemoteCall` checks are unchanged, the count now covers every grant of the connection, and the baseline-is-one check is new.
- The case id, title, manifest and the 233 Canvas / 488 total inventory are unchanged.
- A-CR-01 is an optional NIT. A-CR-03 is for a separate Lead decision.
