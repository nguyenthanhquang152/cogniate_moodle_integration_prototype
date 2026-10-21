Verdict: APPROVE
Round: 1

# M1-17.canvas.repeat oracle repair — Reviewer-B

Reviewer: dedicated independent Reviewer-B, Claude Code `claude-opus-5-5`, xhigh, retained session `c75b96cd-c1da-42ea-9b53-c5207e508e49`. Task `task_2c91a45a4577`, dispatch `ctx_cb93cc372be0`, run `run_ebe671ad72a9`. Date: 2026-10-21.

This is a bounded review of one QA test-oracle change. It is not a product review. **It gives no runtime acceptance credit.**

## 1. Scope and exact sources

- Candidate: `55c33a3e2d60670b5e759a79144c96bd213fca1f`. Base: `a784522a3cdd9bb67453b03093092cac24e87402`.
- The only code or test change is in `tests/acceptance/M1/canvas/31-canvas-grants.test.ts`: case `M1-17.canvas.repeat`, 8 insertions and 2 deletions.
  - New file SHA-256: `888fd4c2e9814defd9ac8912a330122a2eac0ac596f9c18128081613a4240ed0`.
  - Old file SHA-256: `e2ac98119df268f48aa439c2b36fe1e46c45c907786e92bed5a16603d213e262`.
- The other changes since the base are documents only: `docs/reviews/**` and `docs/team/**`. No path under `services/`, `apps/`, `packages/`, `infra/` or `docs/architecture/` changes.
- **Contract:**
  - AC-M1-17 (`docs/architecture/tasks/M1.md:105`): "The first call repeated (same values) → `200`, same platform, no new `grant_redeemed`."
  - R3.7 (`docs/architecture/review-response-M1.md:652`–`:668`): FIFO log stream; a same-process, same-trace `http_request` line is the positive control; a missing control or incomplete capture is BLOCKED; a fixed sleep proves nothing.
- **Independence:** I did not read any other reviewer's report on this repair.

Line numbers below are at `55c33a3`. "Test file" means `31-canvas-grants.test.ts`.

## 2. What I checked myself, and what is QA evidence only

| Check | Done by | Result |
| --- | --- | --- |
| Read the changed case, and every helper that it calls | me | §3 |
| Read the product points that write the two log lines (read only) | me | §3.2 |
| Ran QA's control script `m1-17-controls.mjs` (SHA-256 `4ebe8d4977da782defcf4ae9cc74621c4e143cdd4a7bd53031c99dbf4a85eee4`), after reading it, on fresh trees taken from git | me | 10 of 10. Outcomes and source and file hashes equal QA's output. |
| My own controls: the **real** old and new case bodies with the **real** helpers, on a product log model (§2.1) | me | 15 of 15, in two runs |
| `node tests/host/run-m1.mjs --harness-only --provider all` in a clean detached clone of `55c33a3` | me | exit 0: 70 of 70 self-tests and typecheck; 392 API + 96 host rows = 488 per round; only `c-host-negative` conditional |
| The same with `--provider canvas` | me | exit 0: 70 of 70; 347 rows per round |
| Canvas manifest and inventory | me | `canvas/manifest.json` is byte-identical (SHA-256 `c497462955a668f3158c593b5c9c821ee7da093ba7c2396d3233a846ffc9c677`): 233 rows, 226 API and 7 browser. The test file has 38 `m1Test(` calls in both versions, and no id or title line changes. |
| The failed run and its diagnosis (`diag/m1-r1-sim/M1-17.canvas.repeat-diagnosis.json`) | QA only | I read it, but I cannot repeat a runtime run |
| QA's harness logs | QA only | QA's repaired `m1-all-harness.log` has no final `exit 0` line, but its frozen log has one. My own harness runs above close this gap. |

No Docker, product runtime, settings or secrets were used. Every synthetic log was in a new `mktemp` folder.

### 2.1 My controls

**The script:** `/tmp/rb-m117-PiA5Cl/rb/rb-controls.mjs` (SHA-256 `592707c7beeeb474570be7f2e21a0acf62f17e50b13998176fe78ab05c87d9b1`). Its last output is `rb-controls-out.json` (SHA-256 `b54822ffc05a3f4dfe60c046666db3d83c13f942d1e0b47557e199366525ce05`).

**What it compiles from the two git trees:** the old and new case bodies, plus `readLog`, `waitForLog`, `completed`, `redeemedLines`, `eventsSince` and `logEvents`.

**How the product model writes the log** (as the product does):
- one FIFO append stream;
- the handler's lines before the answer;
- `http_request` after the answer;
- each line written 60 ms after the one before it, so an answer can arrive before its own lines are in the file.

**How the model sets the timing:**
- All lines use the observed millisecond `02:23:45.215Z`. The old body reads that same millisecond as `since`.
- The `noRemoteCall` stub waits 400 ms before the body (where its real gate calls go) and nothing after the body. So no extra delay hides a missing barrier.

| # | Body | Scenario | Result | Meaning |
| --- | --- | --- | --- | --- |
| 1 | old | the observed sequence, correct product | FAIL `1 !== 0` | reproduces the `a784522` failure exactly |
| 2 | new | the observed sequence, correct product | PASS | the repair passes a correct product |
| 3 | old | first redemption in an earlier ms | PASS | the defect is the same-millisecond window |
| 4 | new | first redemption in an earlier ms | PASS | the new oracle does not use timestamps |
| 5 | old | real duplicate, same grant | FAIL `1 !== 0` | it fails, but it counts the first line: the duplicate is not yet in the file |
| 6 | new | real duplicate, same grant | FAIL `2 !== 1` | a real duplicate fails |
| 7 | old | first redemption in an earlier ms; the repeat redeems another grant of the same connection | **PASS** | the old `grant_id` filter missed this |
| 8 | new | the repeat redeems another grant of the same connection | FAIL `2 !== 1` | the connection scope catches it |
| 9 | new | a parallel redemption of another connection | PASS | another test cannot cause a failure |
| 10 | new | a malformed complete line after the baseline | BLOCKED | incomplete capture blocks |
| 11 | old | no log file | **PASS** | the old window passed with no evidence (`eventsSince` returns `[]` on a read error) |
| 12 | new | no log file | BLOCKED after 15 s | the completion control is missing |
| 13 | new without `completed(again, 'PUT')` | real duplicate, same grant | PASS | ablation: the repeat barrier is necessary |
| 14 | new without the GET barrier | correct product | FAIL | ablation: the GET barrier is necessary |
| 15 | new | a redemption logged 1 s **after** its own `http_request` line | PASS | the limit of the oracle; R3.7 and the product order exclude this |

## 3. Assessment

### 3.1 The old failure is reproduced

- `eventsSince` keeps a line when `Date.parse(ts) >= since` (`tests/acceptance/lib/lti.ts:207`–`:213`). The old case set `since = Date.now()` after the first answer and filtered by `grant_id` (old test file `:90`, `:95`).
- QA's diagnosis shows `grant_redeemed` and the first PUT's `http_request` both at `.215Z`. It shows only an `http_request` line for the repeat (`.226Z`), and no `grant_*` line.
- So `since` fell in the same millisecond as the first redemption's line. The old oracle counted it: `1 !== 0` at `:95`.
- Control 1 reproduces this exact message with the real old body. Control 3 shows that the old body passes when the millisecond differs. **The fault is in the oracle, not the product.**

### 3.2 The completed barrier proves the order (source facts)

**What the product does:**
- `grant_redeemed` is written in the handler, before `return outcome.connection` (`services/cogniate-app/src/app/redemption.ts:308`–`:309`).
- `http_request` is written in the `onResponse` hook, after the answer (`services/cogniate-app/src/app/server.ts:107`–`:113`).
- Both lines go through one append stream per process, in call order (`packages/shared/src/logger.ts:133`, `:144`–`:145`).
- A finalized repeat returns before any attempt, and writes no line (`redemption.ts:143`).

**What the test does:**
- The barrier GET is sent only after the first PUT answer arrives (test file `:93`). So the GET's `http_request` line is queued after the first redemption's lines.
- `completed` waits until the line with the same trace id is in the file (`tests/acceptance/M1/common/snapshot.ts:27`–`:33`; `waitForLog`, `tests/acceptance/lib/logs.ts:48`–`:62`, 15 s). It also checks the method and status. **So the baseline at `:94` sees every earlier line of the connection.**
- In the same way, `completed(again, 'PUT')` (`:99`) waits for the repeat's own `http_request` line, and any `grant_redeemed` of the repeat comes before it.

**Why both barriers are necessary:** controls 13 and 14 remove each barrier in turn. Without a barrier, the result depends on the timing of the log stream.

**Precedent:** this is the R3.7 rule 3 pattern. It is also the form of the authorized `M1-20.canvas.repeat` repair (test file `:219`–`:235`).

### 3.3 The count scope

- `redeemedLines` (test file `:46`–`:51`) keeps every `grant_redeemed` line of the connection, for any grant.
  - A duplicate of the same grant fails (control 6), and so does another grant of the same connection (control 8). Another connection does not count (control 9).
- **The old scope was a subset of the new one.** The old filter matched one grant on any connection. But a grant redeems only for its own connection (`redemption.ts:97`, `other_connection`), and the line carries that connection's id (`:148`, `:308`).
- The new baseline check at `:95` is stricter than before: the first call wrote exactly one line, for its own grant. QA's controls show that 0 lines, 2 lines and a wrong grant each fail.

### 3.4 Malformed and partial logs

- `redeemedLines` asserts `badLines` is empty, with a `BLOCKED` message. QA's control and my control 10 confirm this.
- `readLog` does not count a partial last line, and does not report it as bad (`lib/logs.ts:42`).
  - This tolerance is safe here. Each count follows a barrier, so the lines that it must count come before the barrier line and are complete.
- With no log file, the new case is BLOCKED (control 12). The old case passed with no evidence (control 11).

### 3.5 No weaker acceptance, and no race moved elsewhere

**What stays the same:**
- `expectStatus(again, 200)` and the same-platform check do not change.
- `noRemoteCall` does not change (`canvas/canvas.ts:163`–`:175`). Its gate check now runs after the repeat is complete.

**What is new:** no sleep, slack or retry is added. The only new waits are two bounded completion controls; a timeout gives BLOCKED.

**Other time windows:** I checked the other zero-count time windows in the Canvas files (test file `:284`; `21-canvas-protocol.test.ts:198`–`:199`, `:258`; `61-canvas-containment.test.ts:167`). Each one counts after a new platform, or after requests that cannot write that event. This agrees with QA's diagnosis.

### 3.6 Inventory

- The id, title, manifest row and AC (`AC-M1-17`, `SIM`) of `M1-17.canvas.repeat` do not change.
- The inventory stays 233 Canvas rows and 488 rows per round (416 + 72).

## 4. Findings

There is no BLOCKER, MAJOR or MINOR finding.

**CR-B-01 — NIT (diagnostics) — The final assertion shows only counts.**
- At test file `:101`, a failure says only `2 !== 1`, so the operator must search the log for the extra line.
- **Fix:** compare the new lines themselves, for example `assert.deepEqual(redeemedLines(id).slice(first.length).map(({ grant_id, trace_id }) => ({ grant_id, trace_id })), [], '…')`. Then a failure names the grant and the trace.
- `M1-20.canvas.repeat` has the same form. The fix is optional, and needs no new round.

**Observations (no action):**
- **O-1:** `M1-20.canvas.repeat` also counts `grant_attempt_started` lines. AC-M1-17 does not ask for this, and the old case did not check it. So nothing is weaker.
- **O-2:** control 15 shows the limit of the oracle: it cannot see a redemption logged after its own `http_request` line. R3.7 and the product order (§3.2) exclude this.

## 5. Not measured

- **Docker Desktop file sharing of `infra/.logs`:** when a host read sees a later appended line, it also sees the earlier lines. R3.7 and `M1-20.canvas.repeat` depend on the same assumption.
- **The R3.7 bounds:** one healthy process, with no restart and no rotation or truncation of the log during the case.
- **Real timing:** each barrier can wait up to 15 s.

## 6. Verdict

**APPROVE**, for the test-oracle source only.
- The repair removes the same-millisecond defect, keeps or strengthens every assertion, and adds no sleep.
- It reproduces the old failure, and it fails a real duplicate.

**No runtime acceptance is given:**
- The case counts only in the next full M1 rounds, at the exact product and test SHAs.
- Earlier source approvals stay source-only.
- All 32 live LMS rows stay UNVERIFIED.
