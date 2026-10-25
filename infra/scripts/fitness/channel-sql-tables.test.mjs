import assert from 'node:assert/strict';
import { it } from 'node:test';
import rule from './rules/channel-sql-tables.mjs';

for (const path of ['packages/channels/moodle/app/probe.ts', 'packages/channels/moodle/app.ts']) {
  for (const sql of [
    'SELECT id FROM attempt WHERE library_id = :library_id',
    'REPLACE INTO attempt (id, library_id) VALUES (:id, :library_id)',
    'VALUES ((SELECT id FROM attempt WHERE library_id = :library_id))',
  ]) {
    it(`refuses undeclared storage in ${path}: ${sql.split(' ')[0]}`, () => {
      const hits = rule.check({ path, text: `ctx.sql.get('${sql}')` });
      assert.equal(hits.length, 1);
      assert.match(hits[0].message, /outside the moodle manifest/);
    });
  }
  it(`accepts declared storage in ${path}`, () => {
    for (const sql of [
      'SELECT id FROM mbz_build WHERE library_id = :library_id',
      'REPLACE INTO mbz_build (id, library_id) VALUES (:id, :library_id)',
      'VALUES ((SELECT id FROM mbz_build WHERE library_id = :library_id))',
    ]) assert.deepEqual(rule.check({ path, text: `ctx.sql.get('${sql}')` }), []);
  });
}

it('does not inspect unit fixture SQL as channel implementation', () => {
  const text = "ctx.sql.get('SELECT * FROM attempt')";
  assert.deepEqual(rule.check({ path: 'packages/channels/moodle/app.test.ts', text }), []);
  assert.deepEqual(rule.check({ path: 'packages/channels/moodle/app/probe.test.ts', text }), []);
});
