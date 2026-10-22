Verdict: APPROVE
Round: 1

# LA-E7-04 review, Reviewer-B2 (lens: "Can a human team own it?")

Reviewer: Reviewer-B2, the second lens-B instance (plan LD-22). Diff: `git diff 098cec2^ 098cec2` (lead QA commit: `tests/ltiaas/fitness/{README.md,fitness-probes.test.ts,vitest.config.mts}` and `docs/reviews/LA-E7-04/qa.md`). Spec: `docs/architecture/ltiaas/tasks/LA-E7-04.md`. Design: README §4; TEST-STRATEGY §3.1–§3.6; the BD rulings that the suite cites. I did not open any reviewer-a file. I did not run Docker, and I did not run the suite (it needs a prepared scratch clone and runs `npm run check`).

Counts: **0 BLOCKER, 0 MAJOR, 1 MINOR, 2 NIT.**

The suite is easy to read and keep:
- It writes no second scanner. Every probe calls the Author's tool (`fitness:lms-names`, `fitness:channel-diff`, `eslint --stdin`, `fitness:rules`) through the shared helpers of `tasks-core/LA-E1-04`.
- Each AC is one table of probes, in rows of label, path, text and expected result, followed by one loop. A new probe is one new row.
- Each failure message names the probe label, the path and the tool output.
- Each probe has a matching passing control (comments, `<canvas>`, the Web API names, the applied migration, the allow list).
- The rules that do not exist yet are explicit `it.runIf` cases with their task ids, and qa.md marks them `pending: <task>`.
- Scratch folders are removed in `finally` blocks, and the F2 rename probe restores the clone and asserts that `git status` is clean.

My MINOR is about the evidence when a probe fails.

## How I checked

- I read the test file, the README and qa.md against the ACs, and I read the `artifact` helper in `tests/ltiaas/tasks-core/LA-E1-04/fitness.ts`.

## Checks

| Check | Result |
| --- | --- |
| Files and "Must not edit" | Only `tests/ltiaas/fitness/**` and the task's qa.md. No product code and no `infra/scripts/fitness/**`. OK. |
| Ownership | Lead QA (kit and fitness owner, plan LD-13). OK. |
| Each AC has its proof | AC-01: clean `npm run check` with the F1, F3 and F5 steps. AC-02: 22 failing and 6 passing F1 probes, the BD-A1-19 and N6 exceptions, the ratchet, dynamic discovery. AC-03: 27 F3 probes and 4 controls, plus the root-test typecheck probe. AC-04: F2 lists and the rename branch. AC-05: the three landed rules, plus three `runIf` pending probes. AC-06: see B-LA-E7-04-02. AC-07: the mechanism, with the suites still pending. OK. |
| Can a human read and keep the probes? | Yes. A label table per AC, BD references in the labels, a README map from AC to test name, and the run command. |

## Findings

### B-LA-E7-04-01 — MINOR — A failing probe stops its AC loop, and the AC's evidence log is then never written

- **File:** `tests/ltiaas/fitness/fitness-probes.test.ts:155-160`, `:254` (the same shape at `:327-339` / `:354`, `:378-389` / `:409`, `:432-437` / `:529`); the helper `tests/ltiaas/tasks-core/LA-E1-04/fitness.ts:39-44`.
- **Problem:** Each AC test collects a `log` for every probe, but it writes the artifact (`artifact('e7-04-ac0N-….log', …)`) only after the last line of the test. The probes use hard `expect` calls inside the loop. So when one probe fails, the loop stops: the rest of that AC's probes do not run, and the artifact with the outputs of all earlier probes is not written. A tool change that breaks five F1 probes shows one failure per run, with no log file. In a FAIL round, the reader of qa.md gets the least evidence. Also, `artifact` writes with `flag: 'wx'`, so a second run into the same `LA_RUN_DIR` throws `EEXIST` instead of running.
- **Evidence:** `artifact` is called once per AC, at `:254`, `:354`, `:409`, `:529`, `:610` and `:634`, each after the loops. Nothing writes the log in a `finally` block.
- **Suggested fix:** Write each AC's log in a `finally` block. Use `expect.soft` in the probe loops, or split each table into `it.each` rows, so one run reports every broken probe. For reruns, make `artifact` fail with a clear message ("LA_RUN_DIR already holds <file>; use a new run folder"), or give each run its own subfolder.

### B-LA-E7-04-02 — NIT — AC-06 says "equal", but the test only checks that each glob appears somewhere in the two documents

- **File:** `tests/ltiaas/fitness/fitness-probes.test.ts:569-611`; qa.md row AC-LA-E7-04-06 ("match").
- **Problem:** The test compares `fitness-scope.json` with lists written in the test (an exact check). For README §4 and TEST-STRATEGY §3.1, it only asserts that each of six globs occurs anywhere in a long document (`toContain`). An extra core glob that A1 adds to README §4, or a glob left over in another section, does not fail the test, although the AC and qa.md say "equal".
- **Suggested fix:** Parse the scope table of README §4 (the rows of the class table) and compare it with the JSON. Or reword the AC-06 evidence in qa.md to what the test proves ("every JSON glob appears in README §4 and TEST-STRATEGY §3.1").

### B-LA-E7-04-03 — NIT — The tools' output wording is pinned in many places, and one pending rule is found by reading its source

- **File:** `tests/ltiaas/fitness/fitness-probes.test.ts:218`, `:223-224` (the exact ratchet lines), `:493` (`/connection-lms.*Do not name connection\.lms/`), `:84-92` (`findLaunchLiteralRuleId` greps the rule files for `/lti/launch/`).
- **Problem:** The F1 ratchet lines and the rule messages are the tools' output, and they can improve (for example B-LA-E1-04-01 proposes "RAISED" lines for F1). Each such change breaks assertions spread over the file. The pending A2 rule is found by text search in the rule sources, so any rule that mentions the path (a comment, a test fixture) also matches.
- **Suggested fix:** Put the expected output fragments in one commented block at the top ("tool output contract; update with the tool"). Replace `findLaunchLiteralRuleId` with the rule id once LA-E5-06 names it, and until then add a comment that says why the search exists.

## Not checked

- I did not run the suite. qa.md records a PASS run at `d1dead9`.
- Lens-A items: whether the probe set covers every rule row of TEST-STRATEGY §3.4 and §3.6 beyond the list in the README.
