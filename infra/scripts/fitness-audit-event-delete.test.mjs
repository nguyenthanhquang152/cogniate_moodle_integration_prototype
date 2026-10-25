// F5 rule audit-event-delete (LA-ADR-06 D4 rule 2) inside `npm run check` (run: npm run test:infra), until the F5
// runner of LA-E1-04 runs the rules/ folder. The clean tree has 0 hits; probe texts show what the rule refuses.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import rule, { ALLOWED } from './fitness/rules/audit-event-delete.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SKIP = new Set(['node_modules', 'dist', '.data', '.tmp']);

/** Every file under services/, packages/ and apps/, as a path relative to the repository root with "/". */
function productFiles() {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      if (SKIP.has(entry.name)) continue;
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(rel);
      else if (entry.isFile() && /\.(ts|tsx|mts|js|mjs|cjs|sql)$/.test(entry.name)) out.push(rel);
    }
  };
  for (const top of ['services', 'packages', 'apps']) if (fs.existsSync(path.join(ROOT, top))) walk(top);
  return out;
}

describe('F5 rule audit-event-delete', () => {
  it('the tree has no hit', () => {
    const files = productFiles();
    assert.ok(files.some((f) => f.startsWith('services/lti-service/src/')), 'the walk finds the LTI service source');
    const hits = files.flatMap((f) => rule.check({ path: f, text: fs.readFileSync(path.join(ROOT, f), 'utf8') }).map((h) => `${f}:${h.line}:${h.col} ${h.message}`));
    assert.deepEqual(hits, []);
  });

  it('a probe at a product path fails with line and column; spellings with case, quotes, schema and line breaks too', () => {
    const at = 'services/lti-service/src/store/probe.ts';
    assert.deepEqual(rule.check({ path: at, text: "const x = 1;\ndb.exec('DELETE FROM audit_event WHERE ts < 1');" }).map((h) => [h.line, h.col]), [[2, 10]]);
    for (const text of ['delete from audit_event', 'DELETE\n  FROM "audit_event"', 'DELETE FROM main.audit_event', 'Delete From `audit_event`',
      "DELETE FROM 'audit_event'", 'DELETE FROM [audit_event]', 'DELETE FROM "main"."audit_event"', "DELETE FROM 'main'.'audit_event'"]) {
      assert.equal(rule.check({ path: 'packages/shared/src/probe.ts', text }).length, 1, text);
      assert.equal(rule.check({ path: 'services/cogniate-app/src/domain/migrations/999_probe.sql', text }).length, 1, text);
    }
  });

  it('refuses replacement forms and quoted table names, also in the retention job', () => {
    for (const command of ['REPLACE INTO', 'insert or replace into']) {
      for (const table of ['audit_event', "'audit_event'", '"audit_event"', '`audit_event`', '[audit_event]', 'main.audit_event', '"main"."audit_event"']) {
        const text = `${command} ${table} (id) VALUES ('existing')`;
        for (const at of ['services/lti-service/src/store/probe.ts', ...ALLOWED]) {
          const hits = rule.check({ path: at, text });
          assert.equal(hits.length, 1, text);
          assert.match(hits[0].message, /must not be replaced/);
        }
      }
    }
  });

  it('passes the retention job, test files, non-product paths and other tables', () => {
    const text = 'DELETE FROM audit_event WHERE ts < ?';
    for (const p of [...ALLOWED, 'services/lti-service/src/store/audit.test.ts', 'tests/ltiaas/x.test.ts', 'docs/x.md', 'infra/scripts/x.mjs']) {
      assert.deepEqual(rule.check({ path: p, text }), [], p);
    }
    assert.deepEqual(rule.check({ path: 'services/lti-service/src/store/x.ts', text: 'DELETE FROM audit_event_archive; SELECT * FROM audit_event' }), []);
    for (const text of ["DELETE FROM 'audit_event_archive'", 'REPLACE INTO "audit_event archive"', 'INSERT OR REPLACE INTO audit_event_archive',
      'REPLACE INTO [audit_event_archive]']) {
      assert.deepEqual(rule.check({ path: 'services/lti-service/src/store/x.ts', text }), [], text);
    }
    assert.equal(rule.id, 'audit-event-delete');
  });
});
