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
      // Combine only statically known text. Never evaluate identifiers or calls.
      function literalParts(node) {
        if (ts.isParenthesizedExpression(node)) return literalParts(node.expression);
        if (ts.isStringLiteralLike(node)) return [{ sql: node.text, offset: node.getStart(source) + 1 }];
        if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
          const left = literalParts(node.left);
          const right = literalParts(node.right);
          return left && right ? [...left, ...right] : null;
        }
        if (ts.isTemplateExpression(node)) {
          const chunks = [{ sql: node.head.text, offset: node.head.getStart(source) + 1 }];
          for (const span of node.templateSpans) {
            const value = literalParts(span.expression);
            if (!value) return null;
            chunks.push(...value, { sql: span.literal.text, offset: span.literal.getStart(source) + 1 });
          }
          return chunks;
        }
        return null;
      }
      function visit(node) {
        const chunks = literalParts(node);
        if (chunks) { parts.push(chunks); return; }
        if (ts.isTemplateExpression(node)) {
          parts.push([{ sql: text.slice(node.getStart(source) + 1, node.end - 1), offset: node.getStart(source) + 1 }]);
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
    if (!parts.length) parts.push([{ sql: text, offset: 0 }]);
    const hits = [];
    for (const chunks of parts) {
      const sql = chunks.map((part) => part.sql).join('');
      const sourceOffset = (index) => {
        for (const chunk of chunks) {
          if (index < chunk.sql.length) return chunk.offset + index;
          index -= chunk.sql.length;
        }
        return chunks.at(-1).offset;
      };
      const masked = sql.replace(/--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'/g, (m) => m.replace(/[^\n]/g, ' '));
      // Log event names and comments are not SQL. Quoted table identifiers still count.
      if (!/\b(?:SELECT|INSERT|UPDATE|DELETE|JOIN|FROM|TABLE)\b/i.test(masked)) continue;
      for (const match of masked.matchAll(/\bscore_sync\b/gi)) hits.push({ ...position(text, sourceOffset(match.index)),
        message: 'score_sync is frozen after migration 014; use record_dispatch (LA-ADR-04 D5).' });
    }
    return hits;
  },
};
