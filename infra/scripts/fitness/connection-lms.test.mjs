import assert from 'node:assert/strict';
import { it } from 'node:test';
import rule from './rules/connection-lms.mjs';

it('finds frozen connection.lms through a comma join without flagging grant.lms', () => {
  const path = 'services/cogniate-app/src/app/probe.ts';
  for (const table of ['connection con', 'main.connection AS con']) {
    const text = `SELECT con.lms FROM resource_link rl, ${table} WHERE rl.connection_id = con.id`;
    assert.equal(rule.check({ path, text }).length, 1);
  }
  assert.equal(rule.check({ path, text: 'SELECT g.lms FROM binding_grant g, connection con WHERE g.connection_id = con.id' }).length, 0);
});
