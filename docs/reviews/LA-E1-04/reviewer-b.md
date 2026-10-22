Verdict: APPROVE
Round: 1

# LA-E1-04 review, Reviewer-B2 (lens: "Can a human team own it?")

Reviewer: Reviewer-B2, the second lens-B instance (plan LD-22). Diff: `git diff 8ed050e^1 3fe6c13 -- infra/scripts/fitness package.json vitest.config.ts` (round 1 `8ed050e` and the fix round `3fe6c13`; `vitest.config.ts` does not change in this range). Spec: `docs/architecture/ltiaas/tasks/LA-E1-04.md`. Design: README §4 (F1, F2, F5, "F5 rule modules"), BD-A1-02, -07, -09, -15. I did not open any reviewer-a file. I did not run Docker.

Counts: **0 BLOCKER, 0 MAJOR, 2 MINOR, 4 NIT.**

The three tools are small, and each file has one job: `common.mjs` (scope, file set, comment masking), `lms-names.mjs` (F1), `channel-diff.mjs` (F2) and `rules.mjs` (F5). They read the scope from `fitness-scope.json`, so F1, F2 and F3 use one source. F5 is the strongest part for a newcomer. README §4 "F5 rule modules" is a complete contract, and the runner applies every row of it with a clear `rule_invalid <file>: <reason>` line. My findings are about the F1 output: a person who must fix a failing F1 run gets 760 lines and no pointer to the new hit. A probe at a path that F1 does not check also looks like a clean pass.

## How I checked

- Scratch clone of `3fe6c13` in a private `/tmp` folder (`git clone --no-hardlinks`, `node_modules` copied). The shared LA worktree did not change.
- `node --test 'infra/scripts/fitness/*.test.mjs'`: **29 tests, 29 passed**. F1 on the clean tree: exit 0, `F1 PASS: 80 files with hits, 680 hits`, 0.6 s, **761 output lines**. F5: exit 0, `F5 PASS: 2 rules (audit-event-delete, sql-portability), 0 hits`.
- F1 failing run: I added `export const moodleProbe = 1;` to `services/lti-service/src/lti/login.ts`. Result: exit 1 and 762 lines (B-LA-E1-04-01).
- F2: a `--paths-from` list with six paths (own channel, other channel, core, `tests/sim`, `docs`, `package.json`) gave exit 1, `core = 3`, and one class per line. With `--base HEAD` and an uncommitted core edit, it gave `F2 PASS: core = 0, paths = 0` (B-LA-E1-04-03).
- Newcomer F5 rule: a new `rules/no-todo-probe.mjs` with one hit ran with no runner edit (exit 1, `path:1:1  no-todo-probe  probe hit`). With an id that did not equal the file name, it gave exit 2 and `rule_invalid no-todo-probe.mjs: rule id must equal its file name`.

## Checks

| Check | Result |
| --- | --- |
| Files and "Must not edit" | New files only under `infra/scripts/fitness/**`. The root `package.json` lines (`check` chain, three `fitness:*` scripts, the second `test:infra` glob) are the RQ lines that the spec names. No change to `eslint.config.js` or product source. OK. |
| Ownership (epics §5) | Lane P owns `infra/scripts/fitness/**` in B1; the root script lines came by request. OK. |
| No behaviour change outside the spec | `npm run check` now also runs F1 and F5. The fitness scripts change no runtime code. OK. |
| No LMS name in core | `infra/**` is a shared build path, not F1 core. The vendor list in `lms-names.mjs:8` is the README list. OK. |
| UNIT ACs | None: all ten ACs are K0 (QA). The Author tests cover the internals: part splitting, regex literals (BD-A1-15), comment masking, HTML tags, the baseline compare, path classes, rule discovery and refusals, and each SQL statement pattern. |
| Baseline (AC-01) | `f1-baseline.json` has one count for each of the 80 core files with a hit, and the tree passes. `apps/portal/src/App.tsx` is 13, as BD-A1-15 says. OK. |
| F5 docs for a newcomer | README §4 gives the shape, `check`, discovery, file set, result and exit codes. The runner enforces each item (`rules.mjs:11-45`). OK, with the NIT B-LA-E1-04-05. |
| Interim F5 test | `infra/scripts/fitness-audit-event-delete.test.mjs:1-2` still walks the tree "until the F5 runner of LA-E1-04 runs the rules/ folder". The runner now does that, so the rule runs twice in `npm run check`. The test belongs to lane S1: Lead follow-up, not a finding here. |

## Findings

### B-LA-E1-04-01 — MINOR — A failing F1 run prints 760 lines and does not show which hit is new or what to do

- **File:** `infra/scripts/fitness/lms-names.mjs:124-137`.
- **Problem:** A full run prints every hit of every core file (680 lines), then one count line for every baselined file (80 lines), then the summary. This happens on PASS too, so each `npm run check` prints this block. On FAIL, the only signal is one `delta +1` line among 79 `delta +0` lines. Nothing marks which of that file's hits is new. Nothing tells the developer the rule: remove the LMS word from core, or move the code into a channel folder. Do not raise `f1-baseline.json`: tasks README RQ-3 (`tasks/README.md:89`) says "No lane raises a count", and a lane lowers a count in the commit that removes the hits.
- **Evidence:** In my failing run, the line `services/lti-service/src/lti/login.ts: count 3, baseline 2, delta +1` is line 761 of 762. The file's three hit lines are 679–681, mixed with the 678 other hits. The stale-baseline case is clear (`lower f1-baseline.json for <path> to <n>`, `:133`). The raised case has no such line.
- **Suggested fix:** Default output: print only the files whose count changed. For each raised file, print its hit lines and one line `RAISED <path> +<n>: remove the LMS word from core or move the code into packages/channels/<id>/; do not raise the baseline (RQ-3)`. For a stale entry, print a matching line that says to lower the count in this commit. Keep the summary line (AC-01 needs the totals). Add `--all` for today's full listing. `--stdin` mode keeps printing every hit (AC-02).

### B-LA-E1-04-02 — MINOR — A probe at a path outside the F1 scope reports a clean PASS

- **File:** `infra/scripts/fitness/lms-names.mjs:61`, `:121`, `:136`.
- **Problem:** `checkText` returns no hits for a channel file, a unit test, `testkit.ts`, an applied migration and `legacy-wire.ts`. In `--stdin --as` mode, the result is `F1 PASS: 0 files with hits, 0 hits`, the same line as for a clean core text. A person who probes at a wrong path cannot tell "not checked" from "clean". AC-03 is a "probe passes" AC, so a probe at the wrong path gives a false proof.
- **Evidence:** `--stdin --as packages/channels/canvas/x.ts` and `--stdin --as services/x/src/a.test.ts`, each with `export const moodle = 1;`, both print `F1 PASS: 0 files with hits, 0 hits` and exit 0.
- **Suggested fix:** In `--stdin` mode, when `isF1Path(path)` is false or the path is `legacy-wire.ts`, print `F1 SKIP: <path> is not checked (<class>)` with the reason (channel folder, unit file, applied migration, file exception). For a channel path or a unit file, exit 2. For `legacy-wire.ts`, keep exit 0, because AC-06 needs a pass there.

### B-LA-E1-04-03 — NIT — F2 output does not say what it compared or why a channel path is core

- **File:** `infra/scripts/fitness/channel-diff.mjs:8`, `:25-33`, `:36`, `:47`.
- **Problem:** (a) `--base` compares committed changes only (`merge-base..HEAD`), so a developer who runs F2 before a commit gets `F2 PASS: core = 0, paths = 0`. (b) A path in another channel folder prints `core	packages/channels/canvas/manifest.ts`, and the reader may ask why a channel file is "core". (c) The script accepts `--no-renames` but does not read it: `git diff` always gets `--no-renames`.
- **Suggested fix:** Print the range first (`F2 compares <merge-base>..HEAD (committed changes)`). Print `core (another channel)` for that case. Write in a comment that renames are always split and that `--no-renames` is accepted for the documented command line.

### B-LA-E1-04-04 — NIT — The `lti-generic` exception in `bannedWords` has no reason in the code

- **File:** `infra/scripts/fitness/lms-names.mjs:41`.
- **Problem:** The code skips the manifest names of the folder `lti-generic`. The reason is the README phrase "names of every named channel": the generic channel's display texts ("your LMS") are not LMS names. The comment at `:7` speaks only about the reserved id, so a reader of `:41` does not know why one channel id is in the code.
- **Suggested fix:** Add a comment: "`lti-generic` is not a named channel (README §4 F1): its display texts are generic, so only its id is banned."

### B-LA-E1-04-05 — NIT — Nothing in the fitness folder points to the F5 contract

- **File:** `infra/scripts/fitness/rules.mjs:32`; folder `infra/scripts/fitness/rules/`.
- **Problem:** The rule-module contract is in `docs/architecture/ltiaas/README.md` §4 "F5 rule modules". A developer who opens `rules/` or `rules.mjs` finds no link to it.
- **Suggested fix:** Put one header comment in `rules.mjs`: "Rule contract: docs/architecture/ltiaas/README.md §4 'F5 rule modules'. Add a rule: one file rules/<id>.mjs; tests outside rules/."

### B-LA-E1-04-06 — NIT — The test file does not follow the repository style

- **File:** `infra/scripts/fitness/fitness.test.mjs` (whole file).
- **Problem:** It uses 4-space indents and `for` loops without braces on two lines. The sibling scripts (`lms-names.mjs`, `rules.mjs`) and the other `infra/scripts/*.test.mjs` files use 2 spaces. The file looks like compiler output, and it is harder to change by hand.
- **Suggested fix:** Reformat it to the repository style the next time a lane edits it.

## Not checked

- The ten K0 ACs (QA). The QA K0 suites for this task are not in this diff.
- Lens-A items: if the token rule misses an LMS word in a construct that the tests do not cover, and if `maskComments` is correct for every SQL quote form.
