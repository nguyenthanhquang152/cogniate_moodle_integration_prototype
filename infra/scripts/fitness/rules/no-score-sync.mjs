import ts from 'typescript';
import { APPLIED_MIGRATIONS, isUnitFile, position } from '../common.mjs';

// LA-ADR-04 D5 is the only new reader: it copies the frozen delivery state once.
const BACKFILL = 'services/cogniate-app/src/domain/migrations/014_learning_records.sql';

export default {
  id: 'no-score-sync',
  check({ path, text }) {
    if (!/^(services|packages|apps)\//.test(path) || isUnitFile(path) || APPLIED_MIGRATIONS.has(path) || path === BACKFILL) return [];
    const parts = [];
    if (/\.[cm]?[jt]sx?$/.test(path)) {
      const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
      function visit(node) {
        if (ts.isStringLiteralLike(node) || ts.isTemplateExpression(node)) {
          parts.push({ sql: text.slice(node.getStart(source) + 1, node.end - 1), offset: node.getStart(source) + 1 });
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
    if (!parts.length) parts.push({ sql: text, offset: 0 });
    const hits = [];
    for (const { sql, offset } of parts) {
      const masked = sql.replace(/--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'/g, (m) => m.replace(/[^\n]/g, ' '));
      // Log event names and comments are not SQL. Quoted table identifiers still count.
      if (!/\b(?:SELECT|INSERT|UPDATE|DELETE|JOIN|FROM|TABLE)\b/i.test(masked)) continue;
      for (const match of masked.matchAll(/\bscore_sync\b/gi)) hits.push({ ...position(text, offset + match.index),
        message: 'score_sync is frozen after migration 014; use record_dispatch (LA-ADR-04 D5).' });
    }
    return hits;
  },
};
