// LA-E5-20 acceptance (K1-SIM): Should jobs and the jobs endpoints.
// Runs in the e2e container on the acceptance profile (QA_TASK=LA-E5-20). One test per K1-SIM AC; each title starts
// with its AC id. AC-03..AC-06 are Author UNIT tests.
// Source: docs/architecture/ltiaas/tasks/LA-E5-20.md; LA-ADR-06 D2, D7, D11; contract delta §3, §5; BD-A2-65..70.
//
// Secret rule: no API key, operator key, ltik, or service key is ever put into an assertion message.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, it } from 'vitest';
import { ACCOUNT, errorCode, hasErrorShape } from '../../../acceptance/lib/lti';
import { LOGS_DIR } from '../../../acceptance/lib/paths';
import { OPERATOR_KEY_RE, operatorApi, operatorAuth, readOperatorKey } from '../LA-E5-01/operator';
import { listAudit } from '../LA-E5-02/audit-client';

const LTI_LOG_FILE = path.join(LOGS_DIR, 'lti-service.jsonl');

const EXPECTED_JOBS: ReadonlyArray<{ name: string; everyMs: number | null }> = [
  { name: 'retention', everyMs: 600_000 },
  { name: 'audit-retention', everyMs: 86_400_000 },
  { name: 'signing-key-cleanup', everyMs: 86_400_000 },
  { name: 'key-rewrap', everyMs: null },
  { name: 'api-key-expiry', everyMs: 3_600_000 },
  { name: 'idempotency-cleanup', everyMs: 3_600_000 },
  { name: 'signing-key-rotation', everyMs: 86_400_000 },
  { name: 'account-purge', everyMs: 86_400_000 },
];

interface JobRow {
  name: string;
  everyMs: number | null;
  lastRunAt: string | null;
  lastResult: 'ok' | 'failed' | 'skipped_lease' | null;
}

interface ServiceLogLine {
  msg?: string;
  event?: string;
  job?: string;
  result?: string;
  ms?: number;
  counts?: Record<string, unknown>;
  trace_id?: string;
  traceId?: string;
  [field: string]: unknown;
}

let operatorKey = '';

function readLtiLogLines(): ServiceLogLine[] {
  if (!fs.existsSync(LTI_LOG_FILE)) return [];
  const raw = fs.readFileSync(LTI_LOG_FILE, 'utf8');
  const out: ServiceLogLine[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') out.push(parsed as ServiceLogLine);
    } catch {
      // ignore non-JSON lines
    }
  }
  return out;
}

async function pollFor<T>(
  label: string,
  fn: () => Promise<T | null> | T | null,
  { timeoutMs = 15_000, intervalMs = 200 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = await fn();
    if (found !== null) return found;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  const finalFound = await fn();
  if (finalFound !== null) return finalFound;
  assert.fail(`Timed out after ${timeoutMs} ms waiting for ${label}`);
}

beforeAll(() => {
  operatorKey = readOperatorKey();
  assert.ok(OPERATOR_KEY_RE.test(operatorKey), 'operator key format');
});

it('AC-LA-E5-20-01 GET /operator/v1/jobs lists every registered job with name, everyMs, lastRunAt and lastResult', async () => {
  const noAuth = await operatorApi('GET', '/operator/v1/jobs');
  assert.equal(noAuth.status, 401, 'GET /operator/v1/jobs without operator auth returns 401');
  assert.equal(errorCode(noAuth), 'INVALID_OPERATOR_AUTHORIZATION_HEADER');
  assert.equal(hasErrorShape(noAuth), true);

  const res = await operatorApi<{ jobs?: JobRow[] }>('GET', '/operator/v1/jobs', {
    authorization: operatorAuth(operatorKey),
  });
  assert.equal(res.status, 200, 'GET /operator/v1/jobs status is 200');
  assert.ok(res.json && Array.isArray(res.json.jobs), 'GET /operator/v1/jobs returns jobs array');

  const jobs = res.json.jobs;
  for (const row of jobs) {
    assert.deepEqual(
      Object.keys(row).sort(),
      ['everyMs', 'lastResult', 'lastRunAt', 'name'],
      `job ${row.name} has exact keys name, everyMs, lastRunAt, lastResult`,
    );
    assert.equal(typeof row.name, 'string');
    assert.ok(row.everyMs === null || (typeof row.everyMs === 'number' && row.everyMs > 0), `job ${row.name} everyMs`);
    if (row.lastRunAt !== null) {
      assert.equal(typeof row.lastRunAt, 'string', `job ${row.name} lastRunAt is ISO string or null (BD-A2-69)`);
      assert.equal(Number.isNaN(Date.parse(row.lastRunAt)), false, `job ${row.name} lastRunAt parses as ISO 8601`);
    }
    if (row.lastResult !== null) {
      assert.ok(
        ['ok', 'failed', 'skipped_lease'].includes(row.lastResult),
        `job ${row.name} lastResult is valid`,
      );
    }
  }

  const byName = new Map(jobs.map((j) => [j.name, j]));
  for (const expected of EXPECTED_JOBS) {
    const found = byName.get(expected.name);
    assert.ok(found, `registered job ${expected.name} is listed in GET /operator/v1/jobs`);
    assert.equal(found.everyMs, expected.everyMs, `job ${expected.name} everyMs matches contract`);
    // Interval jobs run at start (BD-A2-32), so after startup their lastRunAt and lastResult are populated.
    if (expected.everyMs !== null) {
      assert.ok(found.lastRunAt !== null, `interval job ${expected.name} ran at start (lastRunAt non-null)`);
      assert.equal(found.lastResult, 'ok', `interval job ${expected.name} lastResult is ok`);
    }
  }

  // BD-A2-65: Account has autoRotate (default false) and PATCH /operator/v1/accounts/:id { autoRotate } updates it.
  const acctRes = await operatorApi<{ id?: string; autoRotate?: boolean }>(
    'GET',
    `/operator/v1/accounts/${encodeURIComponent(ACCOUNT)}`,
    { authorization: operatorAuth(operatorKey) },
  );
  assert.equal(acctRes.status, 200, 'GET /operator/v1/accounts/cogniate status 200');
  assert.equal(typeof acctRes.json?.autoRotate, 'boolean', 'Account exposes boolean autoRotate (BD-A2-65)');
});

it('AC-LA-E5-20-02 POST /operator/v1/jobs/retention/run gives 202 { job, traceId }, one job_run line with that trace id, and one job.run audit event', async () => {
  const logCountBefore = readLtiLogLines().length;

  const runRes = await operatorApi<{ job?: string; traceId?: string }>('POST', '/operator/v1/jobs/retention/run', {
    authorization: operatorAuth(operatorKey),
  });
  assert.equal(runRes.status, 202, 'POST /operator/v1/jobs/retention/run status is 202');
  assert.equal(runRes.json?.job, 'retention', '202 body has job: "retention"');
  const traceId = String(runRes.json?.traceId ?? '');
  assert.ok(traceId.length > 0, '202 body has non-empty traceId');

  // Verify one job.run audit event with that traceId.
  const auditByTrace = await listAudit(operatorKey, {
    action: 'job.run',
    traceId,
    limit: 10,
  });
  assert.equal(auditByTrace.res.status, 200, 'GET /operator/v1/audit?action=job.run&traceId=... status 200');
  assert.equal(auditByTrace.events.length, 1, 'POST /operator/v1/jobs/retention/run wrote one job.run audit event');
  const ev = auditByTrace.events[0];
  assert.equal(ev.action, 'job.run');
  assert.equal(ev.target.type, 'job');
  assert.equal(ev.target.id, 'retention');
  assert.equal(ev.result, 'ok');
  assert.equal(ev.traceId, traceId);

  // Verify one job_run log line with that trace_id.
  const matchingLogs = await pollFor(
    'job_run {job: "retention"} log line with matching trace_id',
    () => {
      const lines = readLtiLogLines()
        .slice(logCountBefore)
        .filter(
          (line) =>
            (line.msg === 'job_run' || line.event === 'job_run') &&
            line.job === 'retention' &&
            (line.trace_id === traceId || line.traceId === traceId),
        );
      return lines.length >= 1 ? lines : null;
    },
    { timeoutMs: 10_000, intervalMs: 200 },
  );
  assert.equal(matchingLogs.length, 1, 'exactly one job_run log line emitted for that on-demand retention run');
  assert.equal(matchingLogs[0].result, 'ok', 'job_run result is ok');
  assert.equal(typeof matchingLogs[0].ms, 'number', 'job_run has numeric ms');

  // BD-A2-69: unknown job name returns 404 NOT_FOUND and writes one refused job.run audit event.
  const unknownRes = await operatorApi('POST', '/operator/v1/jobs/no-such-job/run', {
    authorization: operatorAuth(operatorKey),
  });
  assert.equal(unknownRes.status, 404, 'POST /operator/v1/jobs/:name/run for unknown job returns 404 (BD-A2-69)');
  assert.equal(errorCode(unknownRes), 'NOT_FOUND');
  assert.equal(hasErrorShape(unknownRes), true);
  if (unknownRes.traceId) {
    const refusedAudit = await listAudit(operatorKey, {
      action: 'job.run',
      traceId: unknownRes.traceId,
      limit: 10,
    });
    assert.equal(refusedAudit.res.status, 200);
    assert.equal(refusedAudit.events.length, 1, 'unknown job run wrote one refused job.run audit event');
    assert.equal(refusedAudit.events[0].result, 'refused');
    assert.equal(refusedAudit.events[0].code, 'NOT_FOUND');
  }
});
