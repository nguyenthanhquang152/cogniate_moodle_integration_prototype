// LA-E5-11 acceptance (K1-SIM): App audit writer, operator policy, `app:audit list`.
// Runs in the e2e container on the acceptance profile (QA_TASK=LA-E5-11). One test per K1-SIM AC; each title starts
// with its AC id.
// Source: docs/architecture/ltiaas/tasks/LA-E5-11.md; LA-ADR-06 D4 rule 4; LA-ADR-07 D4, D5; app API delta §7.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, it } from 'vitest';
import { CONTROL_DIR, hostAction, type HostAction } from '../../../acceptance/lib/host-control';
import { readOperatorKey } from '../LA-E5-01/operator';

beforeAll(() => {
  // Fail fast when invoked on the host without a seeded acceptance stack.
  readOperatorKey();
});

type AppAuditListAction = HostAction & {
  action: 'qa2-app-audit-list';
  args?: string[];
};

type AppAuditListResult = {
  args: string[];
  cliCode: number;
  cliLines: string[];
  stdoutLines: string[];
  stderrLines: string[];
};

async function runAppAuditList(args: string[] = []): Promise<AppAuditListResult> {
  const act = await hostAction({
    action: 'qa2-app-audit-list',
    args,
  } as AppAuditListAction);
  assert.equal(act.code, 0, 'host runner refused qa2-app-audit-list');
  assert.ok(act.out, 'host runner returned no output file');
  return JSON.parse(fs.readFileSync(path.join(CONTROL_DIR(), act.out), 'utf8')) as AppAuditListResult;
}

it('AC-LA-E5-11-08: `docker compose exec cogniate-app npm run app:audit -- list` on a fresh stack exits 0 and prints no line', async () => {
  const first = await runAppAuditList();
  assert.equal(first.cliCode, 0, `expected exit 0, got ${first.cliCode}: ${JSON.stringify(first.cliLines)}`);
  assert.deepEqual(first.cliLines, [], 'expected no CLI output lines on a fresh stack');
  assert.deepEqual(first.stdoutLines, [], 'expected no stdout CLI lines on a fresh stack');

  const filtered = await runAppAuditList([
    '--connection',
    'conn_qa2_none',
    '--action',
    'grant.issue',
    '--since',
    '2026-01-01T00:00:00.000Z',
    '--limit',
    '10',
  ]);
  assert.equal(filtered.cliCode, 0, `expected exit 0 with filters, got ${filtered.cliCode}`);
  assert.deepEqual(filtered.cliLines, [], 'expected no CLI output lines with filters on a fresh stack');

  // Verify that `app:audit list` writes no audit event.
  const second = await runAppAuditList();
  assert.equal(second.cliCode, 0);
  assert.deepEqual(second.cliLines, [], 'app:audit list must not write an audit event');
});
