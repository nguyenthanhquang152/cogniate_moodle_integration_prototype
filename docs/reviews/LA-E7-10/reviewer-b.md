Verdict: APPROVE
Round: 1

# LA-E7-10 review, Reviewer-B (lens: "Can a human team own it?")

Diff: `git diff dba6dd2 ecd9af7` (lane `la-r`, commit `ecd9af7`, merged as `a8b5517`): new `infra/scripts/ci-local.sh` and `infra/scripts/ci-local.test.mjs`, the `ci:local` script line and `"version": "0.0.0"` in the root `package.json` and `package-lock.json` (RQ-2). Spec: `docs/architecture/ltiaas/tasks/LA-E7-10.md`. Design: README §4a, row "Step 5 rules" (BD-A1-05). I reviewed round 1 only. The later lane commits for BD-A1-13 (`c51a386`, `1294b50`, `a207399`, `46fbd99`) and the BD-A1-13 rules themselves are outside this round. I did not open the other reviewer's file. I did not run Docker.

Counts: **0 BLOCKER, 0 MAJOR, 3 MINOR, 3 NIT.**

The script does what README §4a asks, and it fails safe:
- One JSON line per step and exit 0/1/2 as designed.
- No child output (so no credential) in the summary.
- `npm_config_offline=true` for the steps that must not use the network.
- A stale SBOM is removed before the run.
- A missing `# --- secrets` section, an unreadable tracked file or a bad audit or SBOM document all fail.

The tests are good: a fake `npm` in a temp git repo, and no network. My findings are about the person who must act on a failure: a failed step shows no detail, the allow list has no "how to add an entry", and the scanner is hard to change safely.

## How I checked

- Scratch clone in a private `/tmp` folder (removed after the run). The shared LA worktree did not change.
- Step 5 on the real tracked tree, with a fake `npm` (exit 0, valid audit and SBOM JSON) and a failing fake `docker` on `PATH`, so no network and no stack:
  - At `ecd9af7`: all five steps pass, exit 0, 0 findings, 0 stale notes (AC-05 holds at its own commit).
  - At today's integration HEAD (`c4ecc34`, which also has the four later LA-E7-10 commits): step 5 **fails** with exit 1. One finding: `docs/reviews/LA-E7-10/qa.md:34`, rule `api_key` (QA's own evidence table quotes a fake key). There are also **21 `stale_allow_list_entry` notes** (18 for `tests/host/storage-rows.selftest.mjs`). I use this only as evidence for B-LA-E7-10-02; the later commits are not part of this review.
- `ci-local.test.mjs` runs inside `npm run test:infra`. I read every case. I did not run the real `npm ci` or `npm audit`, because they use the network.

## Checks

| Check | Result |
| --- | --- |
| Files and "Must not edit" | New script and test. Root `package.json`: the `ci:local` line as the last `scripts` entry, by RQ-2 (epics §5 adjustment 12), and `"version": "0.0.0"`; `package-lock.json` gets the same version field. The dispatch names both as RQ-2. No change in `infra/compose.yaml` or `lib.sh`. |
| Ownership | Lane R owns the new files (other `infra/**` rows name S1; this task's file list gives these two new files to R). OK. |
| No behaviour change outside the spec | `npm run check` does not run the script, and nothing else calls it. The version field changes no script output that a test reads. |
| No LMS name in core | `infra/**` is not core for F1. |
| README §4a | Steps 1–5 in order, each with its command and flags. Steps 1 and 3 run online, steps 2 and 4 offline. A registry error exits 2 with `network_unavailable` and skips the later steps. One line per step with `name`, `result`, `seconds`. Findings name the file, line and rule, never the value or its hash. Allow-list entries hold file, rule, SHA-256 (base64) and reason; an unused entry is a note. `docs/**` is out of the 64-hex rule only. |
| Tests against the ACs (all K0) | AC-02: "scans tracked text, binary data and unusual names" plants `ltis_…`, a key header and 64 hex in a tracked file and asserts file, line and rule with no value in the output. AC-03: a registry error in each of the three online calls, exit 2, the later steps skipped, no stale SBOM. AC-04: the `run()` helper asserts five lines, step numbers and `seconds` in every case, and exit 0 only on all-pass. AC-01 and AC-05 need a real clean clone (QA K0); my fake-npm run above covers the step-5 half of AC-05 at `ecd9af7`. |

## Findings

### B-LA-E7-10-01 — MINOR — A failed step shows no detail, so the developer must rerun each command by hand

- **File:** `infra/scripts/ci-local.sh:103-111` (`commandResult`), `:233` (step `check`), `:251` (the output line).
- **Problem:** When `npm run check` fails, the only output is `{"step":2,"name":"check","result":"fail","reason":"command_failed","seconds":…}`. Nothing says whether lint, typecheck, a unit test or an infra test failed, or which file. The same holds for `npm ci` (only an npm `code`, when there is one) and for `npm sbom`. The developer must know the command behind each step name (README §4a) and run it again. Step 2 alone takes minutes.
- **Evidence:** "Never print raw child output: an error can contain a credential or a URL" (`:105`). The rule is right for the summary on stdout. But the output is dropped completely; it is not kept anywhere.
- **Suggested fix:** Write each step's child output to `.tmp/ci/<step>.log` (mode 0600, under the git-ignored `.tmp/`; the SBOM already goes to `.tmp/ci/`). Add `"log": ".tmp/ci/check.log"` to the step line when the step does not pass. Stdout keeps one line per step with no child text. A developer then opens one file, which holds the same text they would see if they ran the command themselves. Add one test row: the `check` failure line names the log, and stdout still has no child text.

### B-LA-E7-10-02 — MINOR — There is no stated way to add an allow-list entry, and the list goes stale within a day

- **File:** `infra/scripts/ci-local.sh:21-23` (the allow-list comment), `:24-89` (64 entries), `:163-168` (`finding`), `:185-189` (`literal`).
- **Problem:** A finding gives `{file, line, rule}`. To accept a known fake, a developer must:
  - find the exact matched text (for `secret_assignment`, the value after `literal()` removes the quotes);
  - compute `base64(sha256(text))` by hand, because the output never shows the hash (BD-A1-05);
  - add a JSON row to a lane-R script.

  None of this is written down. The hits also come from every lane's files (`tests/**`, `docs/reviews/**`, `infra/**`), so each new fake also needs an RQ-1 request to lane R. And `ci:local` is not in `npm run check`, so the lane that adds a hit does not see it.
- **Evidence:** My HEAD run above: within hours of the merge, step 5 fails on QA's `docs/reviews/LA-E7-10/qa.md:34` and lists 21 stale entries. Nobody saw it, because no routine command runs step 5.
- **Suggested fix:**
  - (a) Add a local helper mode, for example `bash infra/scripts/ci-local.sh --allow-entry <file> <line> <rule>`, that prints the ready JSON row for that hit (rule id, base64 SHA-256 of the exact value, a `reason` placeholder). It is an explicit local request, and the row is committed into the script anyway, so it does not break "the output never shows the hash". If A1 does not want a helper, write the one-line `node -e` command and the "which text is hashed" rule into the comment at `:21`.
  - (b) Ask A1 and the Lead whether step 5 alone should run in `npm run check` (it needs no network). Then the lane that adds a hit sees it at once.
  - (c) Ask whether the allow list should move to a data file with a stated owner rule.

### B-LA-E7-10-03 — MINOR — The scanner is a 250-line JavaScript program inside a bash heredoc

- **File:** `infra/scripts/ci-local.sh:5-254` (`exec node --input-type=module <<'NODE'`); the secret-assignment regex at `:184`.
- **Problem:**
  - ESLint lints `infra/scripts/*.mjs` (`eslint.config.js` ignores only `docs/**`, `tests/**` and git-ignored paths), but it does not see code inside a `.sh` heredoc. The type checker does not see it either.
  - You can test the rules only by spawning `bash` in a temp git repo with a fake `npm`, which gives slow and indirect tests.
  - The key rule is one regex of about 300 characters with `String.raw`, `\x60` and look-behinds, and you cannot read it line by line.
  - This is the code that changes most: BD-A1-13 changed it in four commits within one day. A lint or logic slip in a security check then reaches the release gate without a static check.
- **Suggested fix:** Move the program to `infra/scripts/ci-local.mjs`, and keep `ci-local.sh` as a 3-line wrapper (`cd` and `exec node infra/scripts/ci-local.mjs "$@"`), so the README §4a name stays. Export pure functions (`secretKeysOf(exampleText)`, `scanText(file, text, secretKeys)`, `literalValue(token)`), so the rule rows can test them directly. Build the assignment pattern from named parts with one comment per form (`KEY=v`, `export KEY=v`, `KEY: v`, `"KEY": "v"`). I raised the same point as a NIT on LA-E7-03 (`lib.sh`); here it is MINOR because of the size and the change rate.

### B-LA-E7-10-04 — NIT — The reason texts do not say what each value is

- **File:** `infra/scripts/ci-local.sh:25-88`.
- **Problem:** 31 of the 64 entries say "Public fixture or build integrity digest." and 23 say "Fixed fake credential or assertion in a unit test." So a reviewer cannot tell, from the entry, which digest it is, or check that it really is public.
- **Suggested fix:** Name the value's role, for example `"SHA-256 of docs/raw/data/courses/<file>.zip (course fixture pin)"`, `"digest of the node:24 base image pin"`, `"fake LTI_MASTER_KEY of the storage-rows self-test"`.

### B-LA-E7-10-05 — NIT — Two tests depend on real allow-list rows

- **File:** `infra/scripts/ci-local.test.mjs:190-202` (uses the `packages/shared/src/logger.test.ts` `api_key` row, `ci-local.sh:37`), `:204-214` (uses the `tests/acceptance/M1/common/99-logs.test.ts` rows, `:42-43`).
- **Problem:** If someone removes or changes those rows (for example after a cleanup of stale entries), these logic tests fail for a reason that has nothing to do with the logic.
- **Suggested fix:** Add one comment line above each of the two real rows ("also used by `ci-local.test.mjs`; keep it"), or choose rows that the tests own once the scanner is a module (B-LA-E7-10-03) and the tests can pass their own allow list.

### B-LA-E7-10-06 — NIT — Stale-entry notes crowd the step line

- **File:** `infra/scripts/ci-local.sh:223`, `:225`, `:251`.
- **Problem:** Every stale entry goes as an object into the one `secrets` step line. At HEAD that is 21 objects, so the line becomes very long, and a real finding is hard to see in it.
- **Suggested fix:** Put `"staleEntries": <count>` in the step line, and write the stale list into the step-5 log of B-LA-E7-10-01 (`.tmp/ci/secrets.log`).

## Not checked

- A real `npm ci`, `npm audit` and `npm sbom` run (network). QA K0 owns AC-01 to AC-05 on a clean clone.
- The BD-A1-13 rules (code-file values, whole placeholders, defaults, the PGP form) and their four lane commits; they come after this round.
