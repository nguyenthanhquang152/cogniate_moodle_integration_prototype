Verdict: APPROVE
Round: 1

# LA-E5-11 review, Reviewer-B2 (lens: "Can a human team own it?")

Reviewer: Reviewer-B2, the second lens-B instance (plan LD-22). Diff: `git diff 586bd01^1 586bd01` (the merge of lane S1 for LA-E5-11). Spec: `docs/architecture/ltiaas/tasks/LA-E5-11.md`. Design: LA-ADR-06 D4 rule 4; LA-ADR-07 D4, D5; data model §5; app API delta §7; BD-A2-29, BD-A2-45. I did not open any reviewer-a file. I did not run Docker.

Counts: **0 BLOCKER, 0 MAJOR, 1 MINOR, 1 NIT.**

The three new modules are small, and they have clear edges:
- **Migration 015:** 28 lines, with the table, the two indexes, the append-only trigger and the replace guard, and a comment on why there are no foreign keys.
- **Operator policy:** 64 lines. It is one function with the checks in the order of LA-ADR-07 D4. It returns one decision, and it says "evaluate before opening a write transaction".
- **`app:audit list`:** 47 lines. It is read-only, opens the database with `readOnly: true`, never migrates and never writes, and makes a new trace id each run.
- **Audit writer:** it follows the LTI writer rules (T0–T5, BD-A2-29), so a maintainer who knows one knows the other. BD-A2-45 accepts the two copies, with a shared writer as a later Could.

The tests are good, and a human can keep them:
- the migration test proves the old `connection` rows are unchanged, and that both guards work;
- the writer tests cover redaction at any depth, the 4 KB byte limit after redaction, and each filter, with paging on equal timestamps;
- the transaction tests cover nested writes, a refusal after rollback, a 5xx with no event, a thenable refused, and exactly one `change`;
- the policy tests cover each profile, both operator sources, and the file read on each call;
- the CLI tests prove "no write" by comparing the database bytes, and they show that a missing database is not created.

My MINOR is about the refusal lines. They are short codes, so a human operator often cannot see the next step.

## How I checked

- Scratch clone of `586bd01` (private `/tmp` folder, `--no-hardlinks`, `node_modules` copied; deleted after the run).
  - The four task test files: **57 tests passed**. `vitest run services/cogniate-app/src`: **454 passed, 2 skipped**.
  - `F5 PASS: 4 rules …, 0 hits` (migration `015` passes `sql-portability`).
- Mutations (reverted after each):
  - remove the replace guard: the AC-01 migration test fails;
  - remove the operator-list check: 2 policy tests fail.
- CLI probes on an empty data folder: `--help`, a misspelt flag, a date without time, `--limit 0` and `--limit 501`, an unknown command, and a run with no `DATA_DIR` (as on the host).
- Policy probes: production without an operator list, production without `--operator`, both lists set, and the channel `verified-admin-launch`.

## Checks

| Check | Result |
| --- | --- |
| Files and "Must not edit" | New `app/audit.ts`, `app/operator-policy.ts`, `cli/audit.ts` and migration `015`. `package.json` gets the `app:audit` script line (K, RQ-2 commit `7ad1c11`). `domain/domain.test.ts` gets one expected table (RQ-2 commit `8e5e527`). No change to `app/operator.ts`, `cli/grant.ts`, `cli/binding.ts` or LTI service files. OK. |
| Ownership | Lane S1, B2, plus the two RQ-2 lines. OK. |
| No behaviour change outside the spec | The new table is empty, and no existing command writes to it yet (LA-E5-12). OK. |
| No LMS name in core | None added. |
| UNIT ACs | AC-01 (migration test), AC-02..05 (policy tests), AC-06 (writer test), AC-07 (CLI test). AC-06 says "a details value above 4 KB is refused". The code and the test store `{"truncated": true}` as BD-A2-45 rules ("never an error"), so the AC text is stale. The Lead or A2 can align it. None of these modules exists in the old tree, so each test fails there. OK. |
| Can an operator find events per connection? | Yes: `app:audit list --connection <id>` uses the new `connection_id` column and index, newest first. The CLI has no paging (no `--until`, and `next` is not printed). The spec defines the flags, and grant and binding events are few, so I note it only here. |

## Findings

### B-LA-E5-11-01 — MINOR — The refusal lines give a code but not the next step, and some codes point at the wrong cause

- **File:** `services/cogniate-app/src/cli/audit.ts:14-16` (`refuse(reason)`), `:24-29`, `:33` (`arguments_invalid`), `:39` (`audit_read_failed`); `services/cogniate-app/src/app/operator-policy.ts:20-22` (`refuse`), `:45` (`operator_unknown`).
- **Problem:** The probes gave these lines:
  - `app:audit --help` → `{"reason":"arguments_invalid"}`. There is no help, and the usage line appears only for a wrong command word.
  - `app:audit list --conection c1` (a typo) → `arguments_invalid`. The bad flag is not named, because the `parseArgs` message is dropped.
  - `--since 2026-10-22` → `since_invalid`. The required form (ISO date-time with an offset) is not named. `--limit 0` → `limit_invalid`, with no range.
  - A run on the host without `DATA_DIR` → `audit_read_failed`. The path (`/data/cogniate.db`) and the cause (no file, no permission) are not named. The operator cannot tell "wrong place" from "broken database".
  - The policy, in `production` with neither `OPERATORS` nor `OPERATORS_FILE` set, refuses with `operator_unknown`. The real cause is "no operator list is configured", but the operator thinks the name is wrong. `operator_missing` and `evidence_ref_missing` do not name the flag to add.

  The policy lines are the ones that LA-E5-12 prints for `app:grant` and `app:binding`. So these texts will reach operators in production.
- **Suggested fix:**
  - Keep the JSON line and the code, and add a `message` with the fix. Examples:
    - "Add --operator <name>. It must be listed in OPERATORS or OPERATORS_FILE."
    - "Set only one of OPERATORS and OPERATORS_FILE."
    - "Unknown option --conection. Use: app:audit list [--connection <id>] …"
    - "--since must be an ISO date-time with an offset, for example 2026-10-22T00:00:00Z."
    - "Cannot read <path>: ENOENT. Run the command in the cogniate-app container, or set DATA_DIR."
  - Add a separate code `operators_not_configured` for production with no list.
  - Let `--help` print the usage with exit 0.
  - Add one unit row per message, so the texts stay as written.

### B-LA-E5-11-02 — NIT — The writer's secret-key rule is a regex that a reader must decode

- **File:** `services/cogniate-app/src/app/audit.ts:55-62` (`hideAppSecrets`: `/^(note|notetext|code|grantcode|approvalcode)$/` after removing `_` and `-` and lowering the case).
- **Problem:** The rule is correct and tested at any depth. But it hides any field named `code` (for example a later `details.code` that is an error code, not a secret), and the comment does not list the original names that it covers (`note`, `note_text`, `grant_code`, `approval-code` …). A maintainer who adds an app detail named `code` loses it silently.
- **Suggested fix:** List the covered field names in the comment, and say that every `code` field is hidden on purpose. Or match `code` only inside known secret objects. Add one test row that shows a `code` detail is hidden, so the behaviour is visible.

## Not checked

- K1-SIM AC-08 (QA, through `docker compose exec`). The M1 migration phase with app migration `015` (QA).
- Lens-A items: the redaction rules beyond the unit rows, and whether the policy must also check the operator name format.
