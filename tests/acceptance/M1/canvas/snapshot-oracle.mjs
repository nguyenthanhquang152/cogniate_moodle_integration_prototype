// Canvas-specific contract expectations; shared capture rules stay in common.
import assert from 'node:assert/strict';
import { received } from '../common/snapshot-oracle.mjs';

export function initialCalls(events, cursor, platformId) {
  const expected = [['POST', '/api/platforms']];
  if (platformId) expected.push(['PATCH', `/api/platforms/${platformId}`]);
  assert.deepEqual(received(events, cursor).map((e) => [e.method, e.path]), expected,
    'Fresh Canvas initial starts with S1, without any provider read or other request');
}
export function leaseWindow(started, now = Date.now(), completion = false) {
  const elapsed = now - started;
  assert.ok(elapsed >= 0 && elapsed < (completion ? 60_000 : 55_000),
    `BLOCKED: dead-handler lease window missed (${elapsed} ms)`);
  return elapsed;
}
