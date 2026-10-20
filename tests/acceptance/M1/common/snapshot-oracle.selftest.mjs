import test from 'node:test';
import assert from 'node:assert/strict';
import { received, onlyV, vBeforeMutation, auditCursor, auditWindow } from './snapshot-oracle.mjs';
const boot = { line: 1, entry: { event: 'service_started', trace_id: 'boot-one' } };
const answer = { status: 409, traceId: 'request-one' };
const completed = { line: 3, entry: { event: 'http_request', trace_id: answer.traceId, method: 'PUT', status: 409 } };
const attempt = { line: 2, entry: { event: 'grant_attempt_started', trace_id: answer.traceId,
  connection_id: 'C', grant_id: 'G', attempt_id: 'A' } };
test('HARNESS ONLY: audit requires same-process FIFO completion and detects hidden attempts', () => {
  const cursor = auditCursor([boot]);
  assert.deepEqual(auditWindow([boot, completed], cursor, answer, 'PUT', 'C', 0), []);
  assert.equal(auditWindow([boot, attempt, completed], cursor, answer, 'PUT', 'C', 1, 'G').length, 1);
  assert.throws(() => auditWindow([boot, attempt, completed], cursor, answer, 'PUT', 'C', 0));
  assert.throws(() => auditWindow([boot, attempt], cursor, answer, 'PUT', 'C', 1), /completion/);
  assert.throws(() => auditWindow([boot, { line: 2, entry: { event: 'service_started', trace_id: 'boot-two' } },
    completed], cursor, answer, 'PUT', 'C', 0), /process changed/);
  assert.throws(() => auditWindow([boot, completed, { ...attempt, line: 4 }], cursor, answer, 'PUT', 'C', 0),
    /precede completion/);
});
test('HARNESS ONLY: gate oracle cannot conceal a provider GET or other HTTP method', () => {
  const event = (seq, method, path) => ({ seq, method, path, phase: 'received' });
  const v = event(1, 'GET', '/api/providers');
  assert.equal(onlyV([v]), v);
  assert.equal(received([event(1, 'GET', '/unexpected')]).length, 1, 'No path filter can conceal a request');
  for (const method of ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'TRACE']) {
    const extra = event(2, method, '/api/platforms');
    assert.equal(received([v, extra]).length, 2);
    assert.throws(() => onlyV([v, extra]));
  }
  vBeforeMutation([v, event(2, 'POST', '/api/platforms/P/deployments'), event(3, 'PATCH', '/api/platforms/P/deployments/D')]);
  assert.throws(() => vBeforeMutation([event(1, 'POST', '/api/platforms/P/deployments'), { ...v, seq: 2 }]));
});
