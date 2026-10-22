Verdict: CHANGES_REQUESTED
Round: 1

# LA-E7-10 review: Reviewer-A (lens "Is it right and is it safe?")

- Diff: `git diff dba6dd2 ecd9af7` (lane `la-r`, one commit; merged as `a8b5517`).
- References: `docs/architecture/ltiaas/tasks/LA-E7-10.md`; README §4a, including "Step 5 rules" (BD-A1-05). Lead-approved RQ-2 edits: the `ci:local` script line and `version: 0.0.0` in the root `package.json`, and the root version in `package-lock.json`.
- I ran the tests on the host:
  - `node --test infra/scripts/ci-local.test.mjs`: 15 of 15 pass. These use a fake `npm` with no network.
  - I also ran only the step-5 function of the script, read-only, on clean clones of `ecd9af7` and `a8b5517`, and in a temporary repository with probe files. I ran no `npm` command, and the tree stayed clean apart from my review files.
- Blind review: I did not open the other reviewer's file.
- **Counts: 1 BLOCKER, 0 MAJOR, 1 MINOR, 2 NIT.**

## Checks

| Check | Result |
| --- | --- |
| No secret value in the output | Correct. A finding prints only `{file, line, rule}`, and a note only `{file, rule, note}`; never the value or its hash (`infra/scripts/ci-local.sh:163-168`, `:223`). Child output is never printed. A failed command shows at most the npm error code (`[A-Z][A-Z0-9_]+`, `:109`). The audit step shows only advisory ids. The tests plant an `ltis_` key in child stderr, in an audit title and in tracked files, and prove that it never reaches stdout. The SBOM is written with mode `0600`. |
| Fail-closed parsing | Yes. Each of these fails the step: no `.env.example`, a `.env.example` that is not a regular file, or no `# --- secrets` section with a key (`:170-182`); a failed `git ls-files`; a tracked file that cannot be read, or that is not a file or a link (finding `unreadable_file`); an audit report that is not JSON, has `error`, or has no counts; and an SBOM that is not CycloneDX. A stale SBOM is deleted before the run, and a deletion error fails step 4. |
| Network rule (AC-03) | Correct. Only `install` and `audit` run with `npm_config_offline=false`. A registry error code makes the result `network_unavailable`. Every later step is then `skip`, and the exit code is 2, even when an earlier step failed. A `skip` counts as not passed, so exit 0 needs five passes (AC-04). `update_notifier`, `fund` and `audit` are off for each call, so no other registry request is made. |
| Allow list (BD-A1-05) | As designed. An entry needs the exact file, the rule id, the SHA-256 (base64) of the matched value and a reason, with no line numbers. The base64 form keeps the list itself out of the 64-hex rule. An unused entry gives a note, not a failure. A full private-key block cannot use the entry for the header search string, because the match covers the whole block (test). A copy of an allowed fake in another file fails (test). |
| Scope rules | Correct. Rules 1–3 run on every tracked file. The 64-hex rule skips only `docs/**` (test). Rule 4 reads its keys from the secrets section at run time, and `.env.example` itself must have empty values only. A link is scanned as its target text and is not followed. |
| AC-02 negative control | Yes. A planted `ltis_` key in a tracked file (also with a binary byte and a newline in the file name) gives exit 1 and `{file, line, rule}` only. An untracked file is not scanned. |
| AC-05 (clean tree) | **Fails on the merged tree**: A-LA-E7-10-01. |
| "Must not edit" and ownership | `infra/compose.yaml` and `infra/scripts/lib.sh` are unchanged. The `package.json` and `package-lock.json` lines are the Lead's RQ-2 approval. No stack command runs (the test puts a failing `docker` first in `PATH`). |

## Findings

- **A-LA-E7-10-01 (BLOCKER): step 5 fails on the merged tree, so AC-05 fails at `a8b5517`.**
  - Where: the allow list in `infra/scripts/ci-local.sh:24-89`, built on the lane base `dba6dd2`.
  - Evidence: the step-5 function alone, on clean clones:
    - `ecd9af7` (lane commit): `pass`, 0 findings, 0 notes.
    - `a8b5517` (the merge): `fail`, 13 findings. Twelve are in S1 and S2 test files that were on the integration branch before the merge:
      - `cli/bootstrap.test.ts:28`
      - `config.test.ts:5`
      - `platforms-audit.test.ts:84`
      - `keys/key-config.test.ts` ×7
      - `main.test.ts:49`
      - `store/audit.test.ts:53`
    - One is my own LA-E5-02 review, which quoted a test's fake key. I reworded that line in this round, so it is gone once the Lead commits my file.
    - All twelve are fakes, not secrets.
  - Problem:
    - AC-05 says: "The clean tree passes step 5 with the allow list." At the merge SHA that QA verifies, `npm run ci:local` exits 1.
    - Most of the `secret_assignment` hits are not literal values. They are JS identifiers or calls assigned to a secret key name, for example the LTI master-key name set to the constant `LEGACY`, or to the call `hex(LEGACY)`, in a test env object. The bare-token form of rule 4 reads them as a value.
    - So each new test that builds an env object breaks the gate until lane R adds an entry.
  - Suggested fix:
    - Lane R takes the integration `HEAD`, reviews each hit, and adds one entry per hit (file, rule, digest, reason).
    - To stop the churn, A1 decides one rule-4 detail: in code files (`.ts`, `.js`, `.mjs`), only a quoted string counts as a literal, and a bare identifier or call is not a value. This removes most of the hits above. Bare tokens stay literals in `.env`, shell and YAML files.
    - The Lead adds "step 5 passes at the merge SHA" to the merge check of every lane until the full `ci:local` runs per merge.
- **A-LA-E7-10-02 (MINOR): a secret written as a shell default passes rule 4.**
  - Where: `infra/scripts/ci-local.sh:216` (every match right after `${` is skipped) and `:187` (`^\$\{.*\}$` counts as "not a value").
  - Problem:
    - The skip is there for the required form `${KEY:?message}`, which the tree uses.
    - But it also skips the default forms `${KEY:-value}` and `${KEY:=value}`. As a value, `"${KEY:-value}"` and `"${A}value${B}"` also count as placeholders.
    - A default is a common way to write a dev password in compose or shell files.
  - Evidence: in a temporary repository with `DB_PASS` and `APP_MASTER_KEY` in the secrets section, the scan found only the plain line (the database password key set to a plain word). These lines all passed. They are written here in the form that passes the scan, which is the point of this finding:
    - `POSTGRES_PASSWORD: ${DB_PASS:-hunter2-dev-password}`
    - `OTHER: ${DB_PASS:=also-a-value}`
    - `APP_MASTER_KEY="${APP_MASTER_KEY:-not-hex-but-secret}"`
    - `DB_PASS="${A}real-secret${B}"`
  - Why MINOR: rules 1–3 still catch the high-value forms (`ltis_` keys, 64-hex keys, private keys), and the current tree uses only `${KEY:?…}`. README §4a lists "`${…}`" as not a value, so A1 should make the text exact as well.
  - Suggested fix:
    - Not a value: exactly one whole placeholder, `^\$\{[A-Za-z_][A-Za-z0-9_]*(?::?\?[^}]*)?\}$`, `$NAME` or `<…>`.
    - For `${KEY:-v}`, `${KEY-v}`, `${KEY:=v}` and `${KEY=v}` with a secret key, check `v` as a literal.
    - Add these four probe lines to the test.
- **A-LA-E7-10-03 (NIT): the scan reads the working tree, not the committed content.**
  - Where: `infra/scripts/ci-local.sh:190-201` (`fs.readFileSync` of each `git ls-files` path).
  - Problem: the script assumes a clean clone but does not check it. In a working copy, a secret that is committed but changed locally (not committed) gives a step-5 pass, while the secret is still in `HEAD`.
  - Suggested fix: before step 5, fail with `worktree_not_clean` when `git status --porcelain --untracked-files=no` is not empty. Or read the index content (`git cat-file --batch` of the `git ls-files -s` blobs).
- **A-LA-E7-10-04 (NIT): a PGP private key block is not matched.**
  - Where: `infra/scripts/ci-local.sh:16`.
  - Problem: `-----BEGIN PGP PRIVATE KEY BLOCK-----` has ` BLOCK` before the closing dashes, so the pattern misses it. README §4a says "private key blocks".
  - Suggested fix: allow an optional ` BLOCK` (`PRIVATE KEY(?: BLOCK)?-----`), and add one probe.

## Notes (no finding)

- The tests prove the npm arguments and the offline flags only with a fake `npm`. QA's real K0 run (AC-01) should confirm that `npm audit` with `npm_config_audit=false` still asks the registry and returns real counts. An empty report would be a false pass for step 3.
- A review or doc that quotes a fake key now fails step 5 (rule 2 covers `docs/**`). Authors of review and QA files must describe such values in words.
