// LA-E5-19 acceptance (K1-SIM): retention jobs on the job runner (startup run, signing-key-cleanup registration,
// clean stack:restart without job_instance_conflict).
// Runs in the e2e container on the acceptance profile (QA_TASK=LA-E5-19). One test per K1-SIM AC; each title starts
// with its AC id. AC-02, AC-03, AC-05, AC-06, AC-07 and AC-09 are Author UNIT tests.
// Source: docs/architecture/ltiaas/tasks/LA-E5-19.md; LA-ADR-03 D7; LA-ADR-06 D11 (AP-06-44..49).
//
// Secret rule: no API key, operator key, ltik, or service key is ever put into an assertion message.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { it } from 'vitest';
import { publicUrls } from '../../../acceptance/lib/env';
import { hostAction } from '../../../acceptance/lib/host-control';
import { httpsRequest } from '../../../acceptance/lib/https';
import { LOGS_DIR } from '../../../acceptance/lib/paths';

const urls = publicUrls();
const LTI_LOG_FILE = path.join(LOGS_DIR, 'lti-service.jsonl');

const RETENTION_COUNT_KEYS = [
  'platform_nonce_deleted',
  'oidc_state_deleted',
  'lti_session_deleted',
  'refresh_token_deleted',
  'id_token_cache_deleted',
  'audit_log_deleted',
  'score_outbox_deleted',
] as const;

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
      // Ignore non-JSON lines if any.
    }
  }
  return out;
}

function isJobRun(line: ServiceLogLine, jobName: string): boolean {
  const isEvent = line.msg === 'job_run' || line.event === 'job_run';
  return isEvent && line.job === jobName;
}

function isJobInstanceConflict(line: ServiceLogLine): boolean {
  return line.msg === 'job_instance_conflict' || line.event === 'job_instance_conflict';
}

function findJobRuns(jobName: string, sinceLineIndex = 0): ServiceLogLine[] {
  return readLtiLogLines()
    .slice(sinceLineIndex)
    .filter((line) => isJobRun(line, jobName));
}

function findJobInstanceConflicts(sinceLineIndex = 0): ServiceLogLine[] {
  return readLtiLogLines()
    .slice(sinceLineIndex)
    .filter(isJobInstanceConflict);
}

async function pollFor<T>(
  label: string,
  fn: () => T | null,
  { timeoutMs = 10_000, intervalMs = 250 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = fn();
    if (found !== null) return found;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  const finalFound = fn();
  if (finalFound !== null) return finalFound;
  assert.fail(`Timed out after ${timeoutMs} ms waiting for ${label} in ${LTI_LOG_FILE}`);
}

it('AC-LA-E5-19-01 after a service start, the LTI service log has one job_run {job: "retention", result: "ok"} line', async () => {
  const entry = await pollFor(
    'job_run {job: "retention", result: "ok"}',
    () => {
      const runs = findJobRuns('retention');
      return runs.find((r) => r.result === 'ok') ?? null;
    },
    { timeoutMs: Number(process.env.QA_POLL_TIMEOUT_MS ?? 10_000), intervalMs: 250 },
  );

  assert.equal(entry.job, 'retention', 'job_run job is retention');
  assert.equal(entry.result, 'ok', 'job_run result is ok');
  assert.equal(typeof entry.ms, 'number', 'job_run ms is a number');
  assert.ok(Number(entry.ms) >= 0, 'job_run ms >= 0');
  const traceId = String(entry.trace_id ?? entry.traceId ?? '');
  assert.ok(traceId.length > 0, 'job_run has a non-empty trace_id');

  assert.ok(entry.counts && typeof entry.counts === 'object', 'job_run retention line includes counts object');
  const counts = entry.counts as Record<string, unknown>;
  for (const key of RETENTION_COUNT_KEYS) {
    const val: unknown = counts[key];
    assert.equal(typeof val, 'number', `counts.${key} is a number`);
    assert.ok(Number(val) >= 0, `counts.${key} >= 0`);
  }
});

it('AC-LA-E5-19-04 after a service start, the LTI service log has one job_run {job: "signing-key-cleanup"} line (LA-E5-10 module registered)', async () => {
  const entry = await pollFor(
    'job_run {job: "signing-key-cleanup"}',
    () => {
      const runs = findJobRuns('signing-key-cleanup');
      return runs[runs.length - 1] ?? null;
    },
    { timeoutMs: Number(process.env.QA_POLL_TIMEOUT_MS ?? 10_000), intervalMs: 250 },
  );

  assert.equal(entry.job, 'signing-key-cleanup', 'job_run job is signing-key-cleanup');
  assert.equal(entry.result, 'ok', 'job_run result is ok');
  assert.equal(typeof entry.ms, 'number', 'job_run ms is a number');
  assert.ok(Number(entry.ms) >= 0, 'job_run ms >= 0');
  const traceId = String(entry.trace_id ?? entry.traceId ?? '');
  assert.ok(traceId.length > 0, 'job_run has a non-empty trace_id');
});

it('AC-LA-E5-19-08 npm run stack:restart -- lti-service on QA stack: service is ready quickly, new start logs a new job_run {job: "retention"} line, and no job_instance_conflict line appears', async () => {
  // Pre-check that the initial startup already logged job_run {job: "retention"} so pre-task trees fail closed
  // before writing a host-control request file.
  const initialRuns = await pollFor(
    'initial job_run {job: "retention", result: "ok"} before stack:restart',
    () => {
      const runs = findJobRuns('retention');
      return runs.some((r) => r.result === 'ok') ? runs : null;
    },
    { timeoutMs: Number(process.env.QA_POLL_TIMEOUT_MS ?? 5_000), intervalMs: 250 },
  );
  const beforeLineCount = readLtiLogLines().length;
  const beforeRetentionCount = initialRuns.length;

  const ack = await hostAction('lti-restart', 180_000);
  assert.equal(ack.ok, true, 'hostAction lti-restart ok');
  assert.equal(ack.code, 0, 'hostAction lti-restart exit 0');

  const health = await httpsRequest(`${urls.lti}/healthz`);
  assert.equal(health.status, 200, 'GET /healthz returns 200 immediately after stack:restart -- lti-service');

  const newRun = await pollFor(
    'new job_run {job: "retention", result: "ok"} after stack:restart -- lti-service',
    () => {
      const allRuns = findJobRuns('retention');
      if (allRuns.length <= beforeRetentionCount) return null;
      const latest = allRuns[allRuns.length - 1];
      return latest && latest.result === 'ok' ? latest : null;
    },
    { timeoutMs: 15_000, intervalMs: 250 },
  );

  assert.equal(newRun.job, 'retention', 'new job_run after restart is retention');
  assert.equal(newRun.result, 'ok', 'new job_run after restart has result ok');
  assert.equal(typeof newRun.ms, 'number', 'new job_run after restart has numeric ms');
  assert.ok(
    String(newRun.trace_id ?? newRun.traceId ?? '').length > 0,
    'new job_run after restart has a non-empty trace_id',
  );

  const conflictsAfter = findJobInstanceConflicts(beforeLineCount);
  assert.equal(conflictsAfter.length, 0, 'no job_instance_conflict line appeared during or after stack:restart');
  const allConflicts = findJobInstanceConflicts(0);
  assert.equal(allConflicts.length, 0, 'no job_instance_conflict line exists in lti-service.jsonl');
});
