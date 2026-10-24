// F5 (LA-ADR-04 D4): channel identity and authority replace reads of the frozen connection.lms column.
// The connection repository writes its legacy behaviour class. Historical migrations keep their original SQL.
import ts from 'typescript';

const PRODUCT = /^(services|packages|apps)\//;
const EXCLUDED = /(^|\/)(node_modules|dist|\.data|\.tmp)\/|\.test\.[cm]?[jt]sx?$|\/migrations\/\d+[^/]*\.sql$/;
const REPOSITORY = 'services/cogniate-app/src/domain/connections.ts';
const SQL_WORDS = new Set(['where', 'set', 'join', 'left', 'right', 'inner', 'outer', 'cross', 'on', 'order', 'group', 'limit', 'values', 'returning']);

function fragments(path, text) {
  if (!/\.[cm]?[jt]sx?$/.test(path)) return [{ sql: text, offset: 0 }];
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const found = [];
  function visit(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      found.push({ sql: text.slice(node.getStart(source) + 1, node.end - 1), offset: node.getStart(source) + 1 });
    } else if (ts.isTemplateExpression(node)) {
      // Preserve offsets through interpolation; static SQL on either side still belongs to one statement.
      let sql = text.slice(node.getStart(source) + 1, node.end - 1);
      for (const span of node.templateSpans) {
        const start = span.expression.getFullStart() - node.getStart(source) - 1;
        const end = span.expression.end - node.getStart(source) - 1;
        sql = sql.slice(0, start) + sql.slice(start, end).replace(/[^\n]/g, ' ') + sql.slice(end);
      }
      found.push({ sql, offset: node.getStart(source) + 1 });
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  // --stdin probes may contain SQL directly with a product source path.
  if (found.length === 0 && /^\s*(SELECT|UPDATE|INSERT|DELETE|WITH)\b/i.test(text)) return [{ sql: text, offset: 0 }];
  return found;
}

export default {
  id: 'connection-lms',
  description: 'Use channel and binding_authority; connection.lms is a frozen behaviour class (LA-ADR-04 D4).',
  check({ path, text }) {
    if (!PRODUCT.test(path) || EXCLUDED.test(path) || path === REPOSITORY) return [];
    const hits = [];
    for (const { sql, offset } of fragments(path, text)) {
      // Blank comments and SQL string values; normalize quoted identifiers without moving their offsets.
      const normalized = sql.replace(/--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'/g, (m) => m.replace(/[^\n]/g, ' '))
        .replace(/["`[\]]/g, ' ');
      const tables = [...normalized.matchAll(/(?:\b(?:FROM|JOIN|UPDATE|INTO)\s+|,\s*)(?:main\s*\.\s*)?connection\b(?:\s+(?:AS\s+)?([a-z_][a-z0-9_]*))?/gi)];
      if (tables.length === 0) continue;
      const aliases = new Set(['connection']);
      for (const table of tables) if (table[1] && !SQL_WORDS.has(table[1].toLowerCase())) aliases.add(table[1].toLowerCase());
      for (const match of normalized.matchAll(/\b(?:([a-z_][a-z0-9_]*)\s*\.\s*)?lms\b/gi)) {
        if (match[1] && !aliases.has(match[1].toLowerCase())) continue;
        const position = offset + match.index;
        const before = text.slice(0, position);
        hits.push({ line: before.split('\n').length, col: position - before.lastIndexOf('\n'), message: 'Do not name connection.lms outside its repository; use channel or binding_authority (LA-ADR-04 D4).' });
      }
    }
    return hits;
  },
};
