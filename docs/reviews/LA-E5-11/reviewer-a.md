Verdict: APPROVE
Round: 1

# LA-E5-11 review, lens A ("Is it right and is it safe?")

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
