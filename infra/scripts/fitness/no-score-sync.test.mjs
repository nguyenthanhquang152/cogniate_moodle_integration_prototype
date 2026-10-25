import assert from 'node:assert/strict';
import { test } from 'node:test';
import rule from './rules/no-score-sync.mjs';

const path = 'services/cogniate-app/src/kernel/records/probe.ts';
const hits = (text, file = path) => rule.check({ path: file, text });

test('A-LA-E4-02-02: rejects split SQL keywords and table names, once per reference', () => {
  for (const text of [
    `db.prepare('SELECT * FROM score_' + 'sync');`,
    `db.prepare(('SEL' + 'ECT * FROM ') + ('score_' + 'sync'));`,
    'db.prepare(`SELECT * FROM ${"score_" + "sync"}`);',
    `db.prepare('SELECT * FROM ' + 'score_sync' + ' WHERE id = ?');`,
  ]) assert.equal(hits(text).length, 1, text);
});

test('reports the source segment that starts the forbidden table name', () => {
  const text = `db.prepare('SELECT * FROM ' +\n  'score_' + 'sync');`;
  assert.equal(hits(text)[0].line, 2);
  assert.equal(hits(text)[0].col, 4);
});

test('ignores log names, SQL string values, SQL comments and allowed neutral tables', () => {
  for (const text of [
    `log.info('score_' + 'sync');`,
    `db.prepare("SELECT 'score_" + "sync' FROM record_dispatch");`,
    `db.prepare('SELECT * FROM record_dispatch -- score_' + 'sync');`,
    `db.prepare('SELECT * FROM record_' + 'dispatch');`,
    `// SELECT * FROM score_sync\nconst name = 'event';`,
  ]) assert.deepEqual(hits(text), [], text);
});

test('keeps the migration and unit-file exemptions and existing dynamic template checks', () => {
  const text = `db.prepare('SELECT * FROM score_' + 'sync');`;
  assert.deepEqual(hits(text, path.replace('.ts', '.test.ts')), []);
  assert.deepEqual(hits(text, 'services/cogniate-app/src/domain/migrations/014_learning_records.sql'), []);
  assert.equal(hits('db.prepare(`SELECT * FROM score_sync WHERE id = ${id}`);').length, 1);
});
