Verdict: PASS
Round: 1

# LA-E5-11 App audit writer, operator policy, `app:audit list`: QA verification

Tester: QA-2 (Orca task `task_756d65316a50`, dispatch `ctx_eb2462bb36b5`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E5-11.md` (with `BD-A2-29`, `BD-A2-45`). Suite: `tests/ltiaas/tasks-ops/LA-E5-11/` (QA-2 test-first, committed in `c908cd0`).

Independence: QA-2 did not read product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files to write `tests/ltiaas/tasks-ops/LA-E5-11/` or during this host-only run on `d40826d`. QA-2 verified all host-only UNIT, K0 and suite checks in an isolated `--no-hardlinks` clone of `d40826d`.

| Item | Value |
| --- | --- |
| SHA | `d40826d765649b5ece01e23d26e53ccd2df7a14b` (integration `d40826d`; holds `LA-E5-11` merge `586bd01` and QA-2 suite `c908cd0`) |
| Lane and slot | lane S1 (with RQ-2 `app:audit` script line in `services/cogniate-app/package.json`); no Docker (`HOST-ONLY`; `K1-SIM` row marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/qa2-r5-d40826d/clone`: `git clone --no-hardlinks --no-checkout`, detached at `d40826d765649b5ece01e23d26e53ccd2df7a14b`, push URL `DISABLED`, `npm ci` at root and `tests/` |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/qa2-r5-d40826d/logs/` (umask 077): `npm-ci.log`, `check.log`, `e5-11-unit.log`, `e5-11-qa-host.log`, `task-merges-stat.txt`, `rev.txt`, `remotes.txt`, `status-after.txt` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E5-11-01 | PASS (UNIT) | `services/cogniate-app/src/app/audit.test.ts > migration 015 (AC-LA-E5-11-01, BD-A2-45) > keeps old connection rows unchanged, adds an empty audit table, and guards updates and replacements` + `services/cogniate-app/src/domain/domain.test.ts > migrations (ADR-006) > the real migrations apply to an empty database` | `npx --no-install vitest run --reporter=verbose services/cogniate-app/src/app/audit.test.ts services/cogniate-app/src/app/operator-policy.test.ts services/cogniate-app/src/cli/audit.test.ts services/cogniate-app/src/domain/domain.test.ts` | App migration `015_audit_event.sql` leaves existing `connection` rows unchanged, adds `audit_event` with `connection_id` and `client_ip` (`BD-A2-45`), and rejects `UPDATE`, `DELETE` and `INSERT OR REPLACE` with `audit_event is append-only`. F5 rule `audit-event-delete` also passes (`0` hits). `e5-11-unit.log`, `check.log` |
| AC-LA-E5-11-02 | PASS (UNIT) | `services/cogniate-app/src/app/operator-policy.test.ts > operator policy (LA-E5-11 AC-02..05, BD-A2-45) > requires an explicit production operator even with OPERATOR_NAME` + `refuses an invalid profile or an empty explicit operator` | as AC-01 | With `STACK_PROFILE=production` and no `--operator` (even when `OPERATOR_NAME` is set), the policy refuses with one line (`AP-07-04`). `e5-11-unit.log` |
| AC-LA-E5-11-03 | PASS (UNIT) | `services/cogniate-app/src/app/operator-policy.test.ts > operator policy (LA-E5-11 AC-02..05, BD-A2-45) > refuses an unknown operator and allows a listed operator with evidence` + `loads the JSON operator list on each evaluation and fails closed on invalid or missing files` + `refuses both operator sources in production without reading the file` | as AC-01 | With `STACK_PROFILE=production` and `OPERATORS=qa-op`, `--operator other` is refused while `--operator qa-op` with valid evidence channel and ref is allowed; setting both `OPERATORS` and `OPERATORS_FILE` is refused as ambiguous (`AP-07-04`, `AP-07-09`). `e5-11-unit.log` |
| AC-LA-E5-11-04 | PASS (UNIT) | `services/cogniate-app/src/app/operator-policy.test.ts > operator policy (LA-E5-11 AC-02..05, BD-A2-45) > refuses invalid or missing production evidence` (7 cases: missing channel, missing ref, `verified-admin-launch`, `unknown` channel, 201-char ref, empty ref, whitespace ref) + `allows channel institution-email / support-call / lms-admin-ticket / other and boundary reference lengths` (4 cases) | as AC-01 | In `production`, missing `--evidence-channel` or `--evidence-ref`, `--evidence-channel verified-admin-launch`, unknown channels, and `--evidence-ref` of 0 or 201 characters are all refused (`AP-07-09`). `e5-11-unit.log` |
| AC-LA-E5-11-05 | PASS (UNIT) | `services/cogniate-app/src/app/operator-policy.test.ts > operator policy (LA-E5-11 AC-02..05, BD-A2-45) > uses optional operator/evidence in profile acceptance` + `in profile default` + `in profile undefined` | as AC-01 | With `STACK_PROFILE=acceptance` (and `default`) and no flags, the policy allows with actor `unknown`, or `ops1` when `OPERATOR_NAME=ops1` (`AP-07-05`). `e5-11-unit.log` |
| AC-LA-E5-11-06 | PASS (UNIT) | `services/cogniate-app/src/app/audit.test.ts > app audit insert and list (AC-LA-E5-11-06) > round-trips the event with its connection separate from its grant target and redacts app secrets at any depth` + `measures UTF-8 bytes after redaction and truncates above 4096 without blocking a change (BD-A2-45)` + `withAudit transaction rules T0–T5 and described actions` (8 cases) | as AC-01 | The writer stores `details.evidence_channel`, `details.evidence_ref` and `details.note_present: true` without storing note text or secrets, enforces synchronous `withAudit` rules T0–T5, and replaces `details` above 4,096 UTF-8 bytes after `redact()` with `{"truncated": true}` (`BD-A2-45`). `e5-11-unit.log` |
| AC-LA-E5-11-07 | PASS (UNIT) | `services/cogniate-app/src/cli/audit.test.ts > app:audit list (AC-LA-E5-11-07) > prints only the newest two events of a connection and leaves the database bytes and ledger unchanged` + `combines action and ISO since filters inclusively` + `returns no lines for an initialized empty database, including through a symlinked entry path` + `refuses invalid arguments ... before creating or opening a database` (15 cases) + `never creates a missing database` + `does not migrate an old database during a read` | as AC-01 | `app:audit list --connection <id> --limit 2` prints at most 2 JSON lines for that connection, newest first, and writes no audit event or database modification. `e5-11-unit.log` |
| AC-LA-E5-11-08 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-11/app-audit.test.ts > AC-LA-E5-11-08` | `npx --prefix tests tsc --noEmit -p tests/ltiaas/tasks-ops/LA-E5-11/tsconfig.json && npx --prefix tests vitest list --config tests/ltiaas/tasks-ops/LA-E5-11/vitest.config.mts` | Waits for a SIM Docker window (`docker compose exec cogniate-app npm run app:audit -- list` on a fresh stack exits 0 and prints no line). Empty-database CLI execution passes now in `services/cogniate-app/src/cli/audit.test.ts > returns no lines for an initialized empty database, including through a symlinked entry path` (`e5-11-unit.log`, `e5-11-qa-host.log`). |

### R0 `npm run check` counts at `d40826d` (`check.log`)

| Suite | LA-E0-01 (`1b17261`) | At `d40826d` |
| --- | --- | --- |
| Vitest (`test:unit`) | 97 files; 1,351 passed, 5 skipped | 155 files; 2,498 passed, 5 skipped |
| Infra (`test:infra`, `node --test`) | 197 pass, 0 fail | 243 pass, 0 fail (23 suites) |
| K0 (`test:k0`) | — | 3 files; 121 passed |
| F1 (`fitness:lms-names`) | — | `F1 PASS: 20 files with hits, 74 hits` |
| F5 (`fitness:rules`) | — | `F5 PASS: 6 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability), 0 hits` |

## Other checks

- **File scope (`586bd01`):** Touches `services/cogniate-app/src/domain/migrations/015_audit_event.sql`, `services/cogniate-app/src/app/{audit,audit.test,operator-policy,operator-policy.test}.ts`, `services/cogniate-app/src/cli/{audit,audit.test}.ts`, `services/cogniate-app/src/domain/domain.test.ts`, and the RQ-2 script line in `services/cogniate-app/package.json` (`task-merges-stat.txt`). Does not touch `operator.ts`, `cli/grant.ts`, `cli/binding.ts`, or any LTI service file.
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/qa2-r5-d40826d/clone` is empty after the run (`status-after.txt`, 0 bytes).

## Regression and time

R0 (`npm run check` on the clean clone): PASS (`48.35 s` unit, `0.70 s` K0). Focused 4-file unit run (`e5-11-unit.log`, 57 tests): `1.09 s`. QA-2 host-only suite checks (`tsc --noEmit`, `vitest list` 1 `K1-SIM` case, `node --check run.mjs`): PASS (`1.6 s`). `AC-LA-E5-11-08` (`K1-SIM`) and SIM area regressions are `pending: Docker window`.
