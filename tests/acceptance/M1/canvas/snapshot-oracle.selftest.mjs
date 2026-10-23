import assert from 'node:assert/strict';
import test from 'node:test';
import { initialCalls, leaseWindow } from './snapshot-oracle.mjs';

const request = (seq, method, path) => ({ seq, method, path, phase: 'received' });
test('fresh Canvas control refuses a provider GET on either side of S1', () => {
  const valid = [request(2, 'POST', '/api/platforms'), request(3, 'PATCH', '/api/platforms/p1')];
  initialCalls([request(1, 'GET', '/api/providers'), ...valid], 1, 'p1');
  assert.throws(() => initialCalls(valid.slice(0, 1), 1, 'p1'));
  assert.throws(() => initialCalls(valid.slice(1), 1, 'p1'));
  assert.throws(() => initialCalls(valid, 1, 'another-platform'));
  for (const method of ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    assert.throws(() => initialCalls([request(2, method, '/api/providers'), ...valid], 1, 'p1'));
    assert.throws(() => initialCalls([...valid, request(4, method, '/api/providers')], 1, 'p1'));
  }
});
test('readiness control allows only S1, never an activation or a hidden lookup', () => {
  const create = request(1, 'POST', '/api/platforms');
  initialCalls([create], 0);
  assert.throws(() => initialCalls([], 0));
  assert.throws(() => initialCalls([create, request(2, 'PATCH', '/api/platforms/p1')], 0));
  assert.throws(() => initialCalls([request(1, 'GET', '/api/platforms?clientId=x'), create], 0));
});
test('missed lease windows fail as BLOCKED, including a response outside the lease', () => {
  assert.equal(leaseWindow(1000, 55_999), 54_999);
  assert.throws(() => leaseWindow(1000, 56_000), /BLOCKED:/);
  assert.equal(leaseWindow(1000, 60_999, true), 59_999);
  assert.throws(() => leaseWindow(1000, 61_000, true), /BLOCKED:/);
});
