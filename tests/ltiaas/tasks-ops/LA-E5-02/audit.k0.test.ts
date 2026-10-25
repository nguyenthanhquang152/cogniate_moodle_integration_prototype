// LA-E5-02 K0 acceptance test (no Docker): AC-LA-E5-02-10.
// Source: docs/architecture/ltiaas/tasks/LA-E5-02.md (AC-LA-E5-02-10); LA-ADR-06 D4 rule 2; TEST-STRATEGY §3.5.
// Uses the shared F5 check-one-text helper of tasks-core/LA-E1-04/fitness.ts (no file writes in the repo).
import assert from 'node:assert/strict';
import { it } from 'vitest';
import { artifact, f5Text, hasScript } from '../../tasks-core/LA-E1-04/fitness';

const RETENTION_JOB = 'services/lti-service/src/store/audit-retention.ts';
const FORBIDDEN_PATHS = [
  'services/lti-service/src/store/audit.ts',
  'services/lti-service/src/http/operator/audit.ts',
  'services/lti-service/src/http/routes/platforms.ts',
  'services/cogniate-app/src/domain/zz-qa2-audit-probe.ts',
];

it('AC-LA-E5-02-10 Fitness F5: DELETE FROM audit_event at a product path outside the audit-retention job fails in check-one-text mode', async () => {
  assert.equal(hasScript('fitness:rules'), true, 'root package.json defines the fitness:rules script (F5 runner)');

  const log: string[] = [];
  for (const asPath of FORBIDDEN_PATHS) {
    for (const stmt of [
      'export const purge = "DELETE FROM audit_event WHERE ts < ?";\n',
      'export const clear = `delete from audit_event`;\n',
    ]) {
      const r = await f5Text(asPath, stmt);
      log.push(`## forbidden ${asPath}\n${stmt}-> exit ${r.code}\n${r.output}`);
      assert.notEqual(r.code, 0, `${asPath} with DELETE FROM audit_event must fail F5 (got exit 0):\n${r.output}`);
      assert.match(r.output, /audit_event/i, `${asPath}: F5 failure output names audit_event:\n${r.output}`);
    }
  }

  // Positive controls: the retention job path is allowed to delete expired audit_event rows, and a read/insert
  // query at store/audit.ts passes, so the failures above come from the F5 DELETE FROM audit_event rule.
  const retention = await f5Text(RETENTION_JOB, 'export const prune = "DELETE FROM audit_event WHERE ts < ?";\n');
  log.push(`## allowed ${RETENTION_JOB}\n-> exit ${retention.code}\n${retention.output}`);
  assert.equal(retention.code, 0, `${RETENTION_JOB} is allowed to delete expired audit_event rows:\n${retention.output}`);

  const selectOnly = await f5Text(
    'services/lti-service/src/store/audit.ts',
    'export const listSql = "SELECT id, ts, action FROM audit_event ORDER BY ts DESC";\n',
  );
  log.push(`## control select at store/audit.ts\n-> exit ${selectOnly.code}\n${selectOnly.output}`);
  assert.equal(selectOnly.code, 0, `SELECT FROM audit_event at store/audit.ts passes:\n${selectOnly.output}`);

  artifact('e5-02-ac10-f5.log', log.join('\n'));
});
