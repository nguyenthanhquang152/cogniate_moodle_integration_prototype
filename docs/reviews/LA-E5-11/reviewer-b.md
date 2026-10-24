Verdict: APPROVE
Round: 3

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

## Round 2

Reviewer-B: Codex GPT-6-Astra xhigh, same lens B. Verdict: **APPROVE**. Reviewed `75f50c3`, `060c24d`, `f6738ee` and `b93993f` against the task, LA-ADR-07 D4/D5 and BD-A2-59/62/63. Verification used a private `git clone --no-hardlinks` at `c2426eb`. No other reviewer's report was read; no Docker or stack was run.

Counts this round: **0 BLOCKER, 0 MAJOR, 1 MINOR (new), 0 NIT.**

| Prior finding | Result |
| --- | --- |
| B-LA-E5-11-01 (MINOR) — refusal lines give no useful next step | **Closed in substance.** Every policy/audit refusal now carries a fixed recovery message. Production with an absent or empty list gives `operators_not_configured`; help exits 0 on stdout without opening a database. Date, limit and database-read errors now give usable instructions. I accept A2's BD-A2-59/62 decision to omit the bad flag and configured path rather than echo input. The five wording differences from the ratified table are recorded separately below. |
| B-LA-E5-11-02 (NIT) — secret-key regex is hard to maintain | **Closed.** `isAppSecretKey` names the rule; its comment lists the note/code families and says that even an error-valued `details.code` is hidden. It directs maintainers to the event's `code` column. Tests demonstrate that behavior, nested redaction and preservation of `note_present`/`evidence_ref`. |

### B-LA-E5-11-03 — MINOR — The fixed audit refusal texts differ from the ratified table

- **File:** `services/cogniate-app/src/cli/audit.ts:23`; `docs/architecture/ltiaas/adr/LA-ADR-07-security-and-tenancy.md:142`.
- **Problem:** BD-A2-62 and the task specify the six fixed D4 messages, but five code/test messages use different text. A maintainer now has two conflicting sources for an intentionally fixed interface.
- **Evidence:** At the same pinned commit, `arguments_invalid`, `action_invalid`, `limit_invalid`, `since_invalid` and `audit_read_failed` differ; only `connection_invalid` agrees. For example, the D4 limit message includes `(default 100)`, but the CLI omits it. D4's read failure starts `The app database could not be opened read-only.`, while the CLI uses a different diagnosis and recovery paragraph. The literal rows in `cli/audit.test.ts` pin the implementation variants, so passing tests do not detect the drift. The codes, safety rule and useful recovery behavior are intact; this is safe to defer.
- **Suggested fix:** Align the five constants and their literal test expectations with the ratified D4 table, or have A2 explicitly revise that table if the implementation wording is preferred. Keep the no-input-echo rule and the existing event/reason/message/traceId shape.

### Verification and scope

- The focused six-file run across this dispatch passed **109 unit tests**, including all three task suites: audit migration/writer, operator policy and read-only audit CLI. These retain UNIT AC-01 through AC-07 coverage. Root type checking and ESLint on all 13 changed TypeScript files passed.
- Private mutants removed refusal messages/help, restored the narrower redaction predicate and required evidence even for the new revoke mode. The task suites produced **51 expected assertion failures and 21 passes**; all source mutations were restored. The new literal policy-message rows also guard against echoing operator, evidence, note or file input.
- BD-A2-63 is narrowly implemented: `evidenceRequired` defaults to true, and false skips only the two missing-evidence checks. Tests retain operator/config checks, validation of supplied evidence, and the default issue behavior. The policy's comment identifies revoke as the sole intended caller.
- The changes remain in S1's three modules and colocated tests. No forbidden K-owned operator/CLI/domain file, LTI service file, QA-owned test or LMS branch was changed by these four commits. K1-SIM AC-08 and the task's migration/regression gate remain separate QA evidence.

## Round 3

Reviewer-B: Codex GPT-6-Astra, xhigh. Date: 2026-10-23. Verdict: **APPROVE**. Reviewed `19844f2` against BD-A2-62 and the fixed LA-ADR-07 D4 table. Verification used a private `git clone --no-hardlinks` at `d8cb6af`. No other reviewer's file was opened.

**B-LA-E5-11-03 — CLOSED.** The five changed refusal messages now match the ratified table exactly. An independent comparison of all six exported constants against the Markdown table passed. The help text uses the same argument names and time example. The event, reason, message and trace id shape is unchanged; the texts still contain no input values.

The audit CLI suite passed **26 tests**, including its process, read-only, help and fixed-message checks. It was part of a five-file dispatch run with **65 passing tests**. Restoring the pre-`19844f2` CLI in the private clone made exactly the five corrected literal-message rows fail; the unchanged connection row passed. After restoration, the CLI and LTI config suites passed all **36 tests**. Both service type checks and F1/F5 passed.

This is a text-only change in the S1 audit CLI and its colocated test. No protected file, behavior outside the task, or LMS name in core paths was changed. UNIT AC-01–07 coverage and the earlier review conclusions remain intact. K1-SIM AC-08 and wider QA gates remain separate evidence; no Docker or stack runner was used.

Evidence: `/tmp/la-review-b-34de19be90b5/reviewer-b-focused.log`, `reviewer-b-old-audit-text.log` and `reviewer-b-restored.log`. Open findings: **0**.
