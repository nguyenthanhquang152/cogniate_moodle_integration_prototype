// QA-only oracles. No product imports, URL validators, database or network access.
import assert from 'node:assert/strict';

export const METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
export const READINESS_TITLE = 'This LMS setup is not ready in Cogniate.';
export const READINESS_ACTION = 'Ask your Cogniate operator to check the LMS setup for this connection. The operator tells you to try again later, or to make a new connection.';
export const received = (events, cursor = 0) => events.filter((e) =>
  e.seq > cursor && e.phase === 'received');
export function onlyV(events, cursor = 0) {
  const requests = received(events, cursor);
  assert.equal(requests.length, 1, 'Exactly one request, including all GETs and mutations');
  assert.equal(requests[0].method, 'GET');
  assert.equal(requests[0].path, '/api/providers');
  return requests[0];
}
export function vBeforeMutation(events, cursor = 0) {
  const requests = received(events, cursor);
  assert.ok(requests.length >= 3, 'V, staged create and activation are observed');
  assert.equal(requests.filter((e) => e.path === '/api/providers').length, 1);
  assert.equal(requests[0].method, 'GET'); assert.equal(requests[0].path, '/api/providers');
  assert.ok(requests.slice(1).some((e) => e.method === 'POST'));
  assert.ok(requests.slice(1).some((e) => e.method === 'PATCH'));
}
export function auditCursor(entries) {
  const boot = entries.filter((e) => e.entry.event === 'service_started').at(-1);
  assert.ok(boot, 'BLOCKED: capture has no process-start event');
  return { line: entries.at(-1)?.line ?? 0, bootLine: boot.line, bootTrace: boot.entry.trace_id };
}
export function auditWindow(entries, cursor, answer, method, connectionId, count, grantId) {
  const now = auditCursor(entries);
  assert.ok(now.line >= cursor.line && now.bootLine === cursor.bootLine && now.bootTrace === cursor.bootTrace,
    'BLOCKED: log truncated or process changed inside audit window');
  const completion = entries.find((e) => e.line > cursor.line && e.entry.event === 'http_request'
    && e.entry.trace_id === answer.traceId);
  assert.ok(completion, 'BLOCKED: request completion control missing');
  assert.equal(completion.entry.method, method); assert.equal(Number(completion.entry.status), answer.status);
  const attempts = entries.filter((e) => e.line > cursor.line && e.line < completion.line
    && e.entry.event === 'grant_attempt_started' && e.entry.connection_id === connectionId);
  assert.equal(attempts.length, count, 'Scoped committed phase-1 event count');
  for (const { entry } of attempts) {
    assert.equal(entry.trace_id, answer.traceId);
    if (grantId) assert.equal(entry.grant_id, grantId);
    assert.equal(typeof entry.attempt_id, 'string'); assert.ok(entry.attempt_id.length);
  }
  assert.equal(entries.some((e) => e.line >= completion.line && e.entry.event === 'grant_attempt_started'
    && e.entry.trace_id === answer.traceId), false, 'Attempt event must precede completion');
  return attempts.map((e) => e.entry);
}
