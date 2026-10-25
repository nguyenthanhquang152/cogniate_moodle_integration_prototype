Verdict: APPROVE
Round: 2

# LA-E1-04 review: Reviewer-A (lens "Is it right and is it safe?")

- Diff: the lane commit `b6a0a72` (`git diff 1f323bc b6a0a72`; lane `la-p`, merged as `8ed050e`). The dispatch range `65e28dd..b6a0a72` also holds `1f323bc`, a merge of the integration branch into the lane, which brings other tasks' files. The tool files at `HEAD` are the same as at `b6a0a72`.
- References: `docs/architecture/ltiaas/tasks/LA-E1-04.md`; README §4 (N1, scope table, F1, F2, F5, "F5 rule modules"); A1 BD-A1-02, BD-A1-07, BD-A1-09; TEST-STRATEGY §3.1–§3.3. RQ-2: the four root script lines and the second `test:infra` glob.
- I ran on the host (no Docker):
  - `node --test 'infra/scripts/fitness/*.test.mjs'`: 21 of 21 pass.
  - `fitness:lms-names` on the tree: `F1 PASS: 80 files with hits, 677 hits`.
  - `fitness:rules`: `F5 PASS: 2 rules (audit-event-delete, sql-portability), 0 hits`.
  - I also ran `--stdin --as` probes, one read-only AST scan of the core TS files (my own script outside the repo), and three runs through a symlinked folder in `$TMPDIR`. The tree stayed clean.
- Blind review: I did not open the other reviewer's file.
- **Counts: 0 BLOCKER, 1 MAJOR, 1 MINOR, 2 NIT.**

## Checks

| Check | Result |
| --- | --- |
| F1 matching (BD-A1-09) | Correct for the kinds it checks. `parts()` splits at case changes (also an acronym before a word), digits and every non-letter character. A hit needs all parts of a banned word as consecutive whole parts (`lms-names.mjs:12-15`, `:52-58`). One rule covers identifiers (also private names, property names and JSX tag and attribute names), string-like literals, template parts, JSX text, import sources, JSON, CSS, HTML and SQL. Escapes are read as cooked text (`"canvas"` hits). `"canvases"` and `generic` pass; `ltiGeneric`, `"lti-generic"` and `d2l` forms hit. Comments are masked, also inside SQL, CSS, JSON and HTML, without hiding a `--` or `/*` inside a quoted value. Gap: regular-expression literals, A-LA-E1-04-01. |
| Banned words | Correct and fail closed. The list is the vendor list plus `lti-generic` (BD-A1-07), every folder name under `packages/channels/`, and each manifest's `names.text` and `names.label`. The manifest is read as syntax with the TS compiler, never executed. A manifest whose two names are not literals stops F1 with exit 2 (test). A missing `packages/channels/` folder also stops it (exit 2). |
| Exceptions | Within the closed list. `legacy-wire.ts` is the only file exception. `config.ts` exempts only the exact tokens `moodle` and `PUBLIC_MOODLE_URL`. The HTML `canvas` exception applies only to a lower-case JSX or HTML tag name. The Web API exception applies only to nine exact identifier names. Applied migrations come from a fixed path list at the landing SHA (`applied-migrations.json`), with no number threshold, so a late file with an old number is checked (test). |
| Ratchet | It cannot be raised by the tool: there is no write or update mode. A count above its file's baseline exits 1 and prints the delta. A new file, or a renamed file with hits, has a baseline of 0 and fails. A bad baseline value is exit 2. Raising a count needs a visible edit of `f1-baseline.json`, a tracked `infra/**` file that F2 classes as core. Slack after a lowered count: A-LA-E1-04-03. |
| F2 | No bypass found. Every path that is not in this channel's folder, `tests/sim/`, `tests/` or `docs/` is `core`, including root files and every `infra/**` path (BD-A1-07). A path into another channel folder is `core`. `repoPath` normalizes `..`, and refuses absolute, backslash and NUL paths. `--base` is checked with `rev-parse --verify --end-of-options` and passed as an argument array. The diff is `merge-base..HEAD` with `--no-renames` and `-z`, so a rename shows its old core path. If the branch merges newer integration commits, the diff grows (a false failure, never a false pass). One flag weakens it: A-LA-E1-04-04. |
| F5 runner (BD-A1-02) | As designed. It discovers `*.mjs` files in `rules/` in name order. It needs a default `{ id, check }` with a kebab-case `id` equal to the file name, refuses duplicates, and needs at least one rule. A `check` that throws, a result that is not an array (an async `check` too), or a bad finding gives `rule_invalid …` and exit 2. The file set is `git ls-files --cached --others --exclude-standard -- services packages apps`, without NUL-byte files. It runs S1's `audit-event-delete` with no edit, so AC-LA-E5-02-10 can close. |
| SQL portability rule | It checks every migration that is not on the landing list, and strings and comments are masked. 9 statement kinds, each with a test. The LTI service migrations `008` and `009` (after the landing SHA) are checked and pass. |
| AC coverage | AC-02, AC-03, AC-05, AC-06, AC-09 and AC-10 have Author tests or probes. All ACs are K0 (QA's suite under `tests/ltiaas/tasks-core/LA-E1-04/`). |
| "Must not edit", ownership, no LMS name | Respected. `eslint.config.js` and product source are unchanged. The root `package.json` lines are the RQ-2 edit. The vendor list in the F1 script is the tool's data (infra, not core). |

## Findings

- **A-LA-E1-04-01 (MAJOR): F1 does not check regular-expression literals, so a real LMS branch in core is invisible to the ratchet.**
  - Where: `infra/scripts/fitness/lms-names.mjs:72-81`. The visitor takes identifiers and string-like, template and JSX-text nodes, but no `RegularExpressionLiteral`. The Author's test pins this: `fitness.test.mjs:30-33` expects `/canvas/` to pass.
  - Evidence:
    - The probe `/\.instructure\.com$/` at a core path gives `F1 PASS: 0 hits`. The same word in an identifier fails.
    - My AST scan of the 218 core TS files found one such literal today: `apps/portal/src/App.tsx:255:25`, `focusId?.match(/^(moodle|canvas|blackboard)-/)`. It is core code that branches on three channel ids.
    - F1 reports nothing on that line. The baseline of `App.tsx` (10) does not count these 3 hits.
  - Problem:
    - N1 says core has no channel id or LMS name "in code tokens", and a regular expression is a code token.
    - The E1 exit rule is "every core count 0 at E1 done (step S9)". F1 would then report 0 for `App.tsx` while this branch is still there.
    - The same blind spot lets new branches in, for example a host test like `/\.instructure\.com$/` in a site rule.
    - The design's token list (README §4 F1 "Matching", BD-A1-09) does not name regular expressions. So the Author followed the list, and the gap is in the list as well.
  - Suggested fix:
    - A1 adds "regular-expression literals (the pattern text)" to the token list of README §4 F1.
    - P adds `ts.isRegularExpressionLiteral(node)` to the visitor, with `node.text` and the same part rule. The `|`, `^` and `\.` characters already split the parts.
    - Change the test at `fitness.test.mjs:30-33` so that `/canvas/` hits, and add one probe for the host form.
    - Re-count `App.tsx` (10 → 13). The Lead approves this one raise as an undercount fix.
- **A-LA-E1-04-02 (MINOR): through a symlinked script path, F1, F2 and F5 print nothing and exit 0.**
  - Where: `infra/scripts/fitness/common.mjs:48-50`. `isMain` compares `pathToFileURL(resolve(argv[1]))` with `import.meta.url`. Node resolves symlinks for `import.meta.url` but not for `argv[1]`. Users: `lms-names.mjs:137`, `channel-diff.mjs:51`, `rules.mjs:72`.
  - Evidence: I made a symlink in `$TMPDIR` to `infra/scripts/fitness` and ran two probes.
    - `printf 'export const moodleX = 1;' | node <link>/lms-names.mjs --stdin --as services/lti-service/src/x.ts` printed nothing and exited 0. Run directly, the same probe gives `F1 FAIL: 1 files with hits`.
    - The same happened for F5 with a `PRAGMA` probe at a new migration path.
  - Problem: this is the fail-open form of the B-LA-E5-08-03 bug. It is triggered by an absolute path through a symlink, for example a clone under macOS `/tmp` or `$TMPDIR` (links to `/private/…`), where QA clones often live. A harness that checks only the exit code then records a pass for a gate that never ran. `npm run fitness:*` from the repository root is safe today, because the path is relative to a real working folder.
  - Suggested fix: use `import.meta.main` (Node ≥ 24.2; root `engines` ≥ 24.11), as the services now do. Add one test that runs each tool through a symlinked folder and expects its result line.
- **A-LA-E1-04-03 (NIT): after a file's count goes down, new hits up to the old count pass without notice.**
  - Where: `lms-names.mjs:105-112`, `:128-134` (only `delta > 0` fails).
  - Problem: AC-05 requires that a lower count passes. But until someone lowers `f1-baseline.json`, the slack lets a later change add LMS names back to that file. This is a silent re-raise of the ratchet.
  - Suggested fix: keep AC-05. For each negative delta, print one line `lower f1-baseline.json for <path> to <count>`. The Lead's merge check then requires no negative delta on the lane's own files (the RQ-3 rule).
- **A-LA-E1-04-04 (NIT): small fail-open edges.**
  - Where:
    - `common.mjs:7` (`TEXT_EXTENSIONS`)
    - `rules.mjs:12` (`entry.isFile()`)
    - `channel-diff.mjs:36`, `:48` (`--report-only`)
  - Problem:
    - `.jsx`, `.cjs` and `.cts` files in core are not checked. There are none today.
    - A symlink in `rules/` is skipped without a line, although README §4 says "The runner never skips a rule silently".
    - `--report-only` is not in the spec, and makes F2 exit 0 with core paths.
    - `--no-renames`, which the spec's scope line lists as an F2 option, is refused with exit 2. That is fail closed, but it surprises a user of the documented command.
  - Suggested fix:
    - Add the three extensions.
    - Give a symlinked or non-file `*.mjs` entry in `rules/` a `rule_invalid` exit 2.
    - Drop `--report-only` (`--paths-from` already gives a report).
    - Accept `--no-renames` as a no-op.

## Notes (no finding)

- The SQL portability list does not name SQLite trigger bodies (`BEGIN … SELECT RAISE(ABORT, …); END`). The append-only triggers of LTI migrations `007` and `008` (LA-ADR-06 D4) need such a body, and Postgres cannot run them as written. Flagging them now would fail F5 on a required design. A1 may record "SQLite triggers are rewritten in LG" next to the list instead.
- F1 skips unit tests and `testkit.ts` files, as TEST-STRATEGY §3.1 says. The pattern also skips `<name>.testkit.ts` (for example `packages/shared/src/jobs.testkit.ts`, the job store-contract suite), which is test code too.

## Round 2

- Diff: `git diff 3fe6c13^1 3fe6c13` (what the merge added; lane `la-p` commits `cf4de62`, `cd6317e`, `99de816`, plus two merges of integration and of the A1 ruling). These tool files at `HEAD` are the same as at `3fe6c13`.
- References: my round-1 findings above; A1 BD-A1-15 (regex pattern text; an escape is a separator; `App.tsx` 10 → 13 as the landing count, not an RQ-3 raise); README §4 F1.
- I ran on the host (no Docker):
  - `node --test 'infra/scripts/fitness/*.test.mjs'`: 29 of 29 pass.
  - `fitness:lms-names`: `F1 PASS: 80 files with hits, 680 hits` (677 + the 3 hits at `App.tsx:255`).
  - `fitness:rules`: `F5 PASS: 2 rules, 0 hits`.
  - My round-1 probes again, run directly and through a symlinked folder in `$TMPDIR`.
- Blind review as before.
- **Verdict (round 2): APPROVE.** All four round-1 findings are closed. New: **0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**

### Round-1 findings

| Id | Status | Evidence |
| --- | --- | --- |
| A-LA-E1-04-01 (MAJOR) | closed | The visitor now takes every `RegularExpressionLiteral`. It checks the pattern text between the slashes, without the flags. Each backslash with its next character becomes a separator before the part rule (BD-A1-15). My probes now fail: `/\.instructure\.com$/` gives `instructure`, `/\bcanvas\b/i` gives `canvas`, and `/^(moodle\|canvas\|blackboard)-/` gives three hits, at the pattern position. The tree run counts the real line `apps/portal/src/App.tsx:255`, and `f1-baseline.json` has `App.tsx: 13` at the landing SHA. The old test that pinned `/canvas/` as a pass is now a hit test, plus an escape test. |
| A-LA-E1-04-02 (MINOR) | closed | `isMain` is gone. `lms-names.mjs`, `rules.mjs` and `channel-diff.mjs` use `import.meta.main`. Through a symlinked folder, the F1 probe gives `F1 FAIL`, the F5 `PRAGMA` probe gives `F5 FAIL`, and an F2 core path gives `F2 FAIL` (round 1: nothing, exit 0). A new test runs each tool through a symlinked folder. |
| A-LA-E1-04-03 (NIT) | closed | A negative delta now prints `lower f1-baseline.json for <path> to <count>` and still passes (AC-05). The baseline in this diff also drops the entries of files that LA-E1-05 moved out of core (`profiles/*.ts`, `lti/checks.ts`, `lti/launch.ts`), so their slack is gone. |
| A-LA-E1-04-04 (NIT) | closed | `.cts`, `.jsx` and `.cjs` are checked (my `.jsx` probe now fails). A `*.mjs` entry in `rules/` that is a symlink or a folder gives `rule_invalid`. `--report-only` is gone, and a test shows that it is now refused. `--no-renames` is accepted, and the diff always uses `--no-renames`. The expired `config.ts` exception is removed: the scope file no longer lists it, the file has no LMS token today, and a test checks it as normal core. |

### Note (no finding)

- A character class can still spell a word in parts that the rule does not join (for example `[Mm]oodle` gives the parts `mm` and `oodle`). That is an evasive form, not a normal spelling: a case-insensitive pattern such as `/moodle/i` hits, and review covers the rest.
