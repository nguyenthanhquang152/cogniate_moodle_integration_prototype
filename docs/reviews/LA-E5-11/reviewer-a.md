Verdict: APPROVE
Round: 3

# LA-E5-11 review, lens A ("Is it right and is it safe?")

## Round 1 (historical)

Reviewer: Reviewer-A2 (Claude Code Opus 5.5 xhigh, plan LD-22). Date: 2026-10-23.
Spec: `docs/architecture/ltiaas/tasks/LA-E5-11.md`. Design: LA-ADR-06 D4; LA-ADR-07 D4, D5; data model §5; BD-A2-45.

Diff: `git diff 586bd01^1 586bd01` (9 files: the S1 commit `ad2bbee`, plus the RQ-2 commits `7ad1c11` (`package.json` script line) and `8e5e527` (the table list in `domain/domain.test.ts`), both in K files).

Method: a throwaway `git archive 586bd01` copy under `/private/tmp`, with a clone of the integration `node_modules`. I ran the Cogniate app tests (30 files, 454 passed, 2 skipped), 12 mutants and one small writer probe in that copy only. I used no Docker and no network. I did not change the integration worktree, except for this file.

## Summary

| Id | Severity | Topic |
| --- | --- | --- |
| A-LA-E5-11-01 | NIT | The writer's extra app redaction matches exact key names only. `note` is hidden, but `notes`, `operatorNote` and `grant_note` are stored as given. |

There is no BLOCKER, MAJOR or MINOR finding. The lens-A points pass (see "Checks that pass").

## Findings

### A-LA-E5-11-01 — NIT — the note and code key list is exact-match only

- **File:** `services/cogniate-app/src/app/audit.ts` (`hideAppSecrets`: `/^(note|notetext|code|grantcode|approvalcode)$/` on the key without `_` and `-`, in lower case).
- **Problem:** the data model §5 says that `details` never holds "the note text, a code, a key or a token". The shared `redact()` covers keys, tokens and secret suffixes. The app list adds five exact names. My probe stored `{"note":"[redacted]","notes":"n2","operatorNote":"n3","grant_note":"n4","approval":"c1","approvalCodeShown":"c2"}`. Today this is safe: the M1 field is `note`, and LA-E5-12 passes `note_present` from the policy decision. But if a later caller uses another key name, a note can reach the table and `app:audit list`.
- **Suggested fix:** also hide a key that ends with `note` or `notes`, and a key that starts with `approvalcode` or `grantcode`, the same as the `SECRET_SUFFIXES` rule in `packages/shared/src/logger.ts`. Add these names to the AC-06 test.

## Checks that pass

| Item | Result |
| --- | --- |
| Append-only holds (lens focus, AC-01) | Migration 015 matches the data model §5 sketch, and it adds a `CHECK` on `actor_type`. `BEFORE UPDATE` aborts with `audit_event is append-only`. The `BEFORE INSERT … WHEN EXISTS` guard stops `INSERT OR REPLACE` and `REPLACE` with an existing id (tested with `recursive_triggers = OFF`). An upsert also meets the insert guard first. The table has no foreign keys, so a deleted target does not remove history. `DELETE FROM audit_event` in app product code fails the F5 rule `audit-event-delete`: its product pattern includes `services/`, and its allow list holds only the LTI retention job. The migration test shows that old `connection` rows do not change, and it checks the `(library_id, connection_id, ts)` index. Mutants A1 (no replace guard) and A2 (no update trigger) are each killed. |
| No secret or note text (lens focus, AC-06) | `auditDetailsText` runs `redact()` (secret keys and suffixes, token patterns in values, depth limit), then the app list (see -01). Then it measures UTF-8 bytes: 4096 is kept, and above that the result is `{"truncated":true}`, never an error (BD-A2-45). The test checks nested and mixed-case names and the stored text. `evidence_ref` is kept, because `evidenceref` is not the secret key `ref` and has no secret suffix. The policy decision gives only `evidence_channel`, `evidence_ref` and `note_present`, never the note. Mutants A3 (no `note`), A9 (boundary) and A11 (no `redact()`) are each killed. |
| Policy cannot be bypassed by environment tricks (lens focus, AC-02 to AC-05) | Both `OPERATORS` and `OPERATORS_FILE` set (also as empty strings) gives `config_refused` `operators_ambiguous` in every profile, before the file is read. An unknown `STACK_PROFILE` value (for example `prod`, `Production`, ` production`) is refused, so a typo fails closed. Production needs an explicit `--operator`; `OPERATOR_NAME` does not count. The name must be in the list. With no list, or an empty list, every name is refused. A bad or missing `OPERATORS_FILE` is refused. Both evidence fields are required. An empty or blank `--evidence-ref`, more than 200 characters, an unknown channel and `verified-admin-launch` are refused in every profile. An empty `--operator` is refused in every profile. A refusal is one JSON line with no note text, and the policy writes nothing. Mutants A4, A5, A6 and A12 are each killed. An empty `STACK_PROFILE` counts as `default`, the same as compose (`${ACTIVE_STACK_PROFILE:-default}`). LA-ADR-07 D4 makes the CLI read its own process environment, and it records the self-asserted operator name as the residual R-LA-2. So `-e STACK_PROFILE=default` is a known, accepted path, not a defect of this task. |
| Writer and `withAudit` (LA-ADR-06 D4 T0–T5, BD-A2-29) | One `change` per call. The change and its `ok` event are in one transaction. A thenable from `change` or `describe` is refused, and everything rolls back. A failed `describe` or audit insert rolls back the change. Only a 4xx `ApiErrorBase` writes a `refused` event, after the rollback. A 5xx or a bug writes none, and no refusal is added after a committed `ok` (mutant A10 is killed). Ids are `aud_` plus 22 characters. `listAuditEvents` uses bound parameters only (an injection string returns `[]`), a limit from 1 to 500, newest first with an id tie-break, and a cursor. |
| `app:audit list` is read-only (AC-07) | The arguments are checked before any open, with `strict` options, one `list` positional, limit 1–500, and a real ISO date with offset. The database opens with `readOnly: true` at the app's own path (`DATA_DIR`, else `/data`, then `cogniate.db`, as `config.ts`). It does not create a missing file and does not migrate an old file. The test compares the file bytes and the row count before and after. A new trace id is made for each run. The output is one JSON line per event, newest first. Mutants A7 (not read-only) and A8 (oldest first) are each killed. |
| Ownership | Only the S1 files of the spec and migration `015` change. `app/operator.ts`, `cli/grant.ts`, `cli/binding.ts` and the LTI service are untouched. The two K-file lines are separate RQ-2 commits. No LMS name is added to core. |

## Round 2

Reviewer: Codex GPT-6-Astra, xhigh. Reviewed `75f50c3`, `060c24d`, `f6738ee` and `b93993f` in merge `836d579` against the task spec, LA-ADR-07 D4/D5 and BD-A2-59/62/63. Blind review; no Reviewer-B file read.

**Verdict: APPROVE. Open counts: 0 BLOCKER, 0 MAJOR, 1 MINOR, 0 NIT.**

### Earlier finding

**A-LA-E5-11-01 is closed.** The writer now hides keys ending in `note`/`notes` and keys starting with `grantcode`/`approvalcode`, after case and separator normalization, at nested levels too. It keeps `note_present` and `evidence_ref`. The AC-06 test covers the earlier counterexamples and checks the stored text; restoring exact-name-only matching makes that test fail. The comment also makes the intentional redaction of every `code` field explicit.

### A-LA-E5-11-02 — MINOR — five audit refusal messages differ from the ratified text

- **Where:** `services/cogniate-app/src/cli/audit.ts:23` (`AUDIT_REFUSALS`) and `services/cogniate-app/src/cli/audit.test.ts:97` (the fixed-message table).
- **Problem:** BD-A2-62 and LA-ADR-07 D4 fix six messages, but the code and its tests still use the provisional wording for five of them. These are safe, useful messages, so this does not block approval; it leaves two competing definitions of the CLI output.
- **Evidence:** a private test of the six current ADR strings passes only `connection_invalid`. `arguments_invalid`, `action_invalid`, `limit_invalid`, `since_invalid` and `audit_read_failed` differ. For example, the ADR specifies `Give --limit a whole number from 1 to 500 (default 100).`; the code omits `(default 100)`. The other differences include `Use:` versus `Usage:` and the database-read guidance. All six cases still emit one fixed JSON line without input values.
- **Suggested fix:** align the five constants and their literal test expectations with the ratified D4 table, or have A2 update that table through a recorded decision. Keep the tests independent of the exported constants for this contract check.

### Checks and verification

- `evidenceRequired: false` skips only the two missing-evidence checks. The explicit listed operator, config checks, and validation of supplied evidence all remain. The default and every value other than literal `false` fail closed; private probes included malformed runtime flag values. Restoring an optional-by-default guard causes five shipped tests to fail.
- Policy refusals use the ten fixed BD-A2-59 messages. Private probes confirmed that hostile operator, evidence, flag and file-path values never appear in the refusal line. `app:audit` retains its event and trace id, prints help on stdout, and opens databases read-only. Append-only, redaction, size-limit and CLI ordering tests remain green.
- Private clone at `836d579`: the shared LA-E5-16/11 focused run passed **187 tests in 10 files**. Both service typechecks and ESLint on all 11 changed TypeScript files passed. The extra policy/audit probe suite passed **4** tests and failed the **5** message comparisons described in -02. Both app mutation controls were detected and restored.
- The UNIT criteria retain the writer/migration, policy and CLI tests; the new default and redaction checks fail under the old behavior. The diff stays in S1's three implementation files and adjacent unit tests, with no forbidden file or new LMS-name branch. Only this review file was edited for this item in the integration worktree. No Docker, stack or host stack runner was used; K1-SIM AC-08 remains with QA.

## Round 3

Reviewer: Codex GPT-6-Astra, xhigh. Date: 2026-10-23 (+07). Reviewed `19844f2` against LA-ADR-07 D4 and BD-A2-62. Test snapshot: `d8cb6af6958afae2c12381700faf180e7ad99609`, private clone `/tmp/la-review-a-d7ce4dfe99d4`. Blind review.

**Verdict: APPROVE. Open counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**

**A-LA-E5-11-02 is closed.** All six refusal constants now match the ratified D4 text exactly. The five changed messages have independent literal expectations in the CLI test. The help text uses the same argument names and time example. The change preserves fixed output without user-supplied values, the event/reason/trace-id shape, exit status and read-only database path.

The CLI suite passed **26 tests**, within the 65-test focused run documented in [LA-E5-21 Reviewer-A](../LA-E5-21/reviewer-a.md). As a control, restoring only `cli/audit.ts` from `19844f2^` made exactly the **five corrected message tests fail**, with 21 still passing. The implementation was restored after the control. Log: `/tmp/la-review-a-d7ce4dfe99d4-audit-old-control.log`. The app typecheck passed.

No new finding. The diff changes only S1's audit CLI text and adjacent unit assertions; no protected file, wire behaviour or LMS branch changes. Earlier approvals remain in place. K1-SIM AC-08 and full regression gates remain with QA. Only this review file was edited for this item in the integration worktree; no Docker, stack, host stack runner, commit or push was used.
