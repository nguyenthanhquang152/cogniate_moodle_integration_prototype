// F5: channel SQL names only manifest-owned tables or explicitly listed shared columns (LA-ADR-01 D5).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { constants, DatabaseSync } from 'node:sqlite';
import ts from 'typescript';
import { ROOT } from '../common.mjs';

// BD-A1-52: allow one occurrence of each exact statement, only at its new path.
const LEGACY_ORDER_REASON = 'pre-LA statement moved 1:1, A2 BD-A2-46 / LA-ADR-06 D13 item 6 (a); LG adds an insertion-order column';
const LEGACY_ORDER = [
  "SELECT * FROM mbz_build WHERE library_id = :library_id AND version_id = :version_id ORDER BY created_at DESC, rowid DESC LIMIT 1",
  "SELECT * FROM mbz_build WHERE library_id = :library_id AND version_id = :version_id AND status = 'ready' ORDER BY created_at DESC, rowid DESC LIMIT 1",
  "SELECT * FROM mbz_build WHERE library_id = :library_id AND status IN ('queued', 'running') ORDER BY created_at, rowid"
].map((text) => ({ file: 'packages/channels/moodle/app/builds.ts', text, reason: LEGACY_ORDER_REASON }));

function storageOf(channel) {
  const file = resolve(ROOT, 'packages/channels', channel, 'manifest.ts');
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const storage = { tables: new Set(), columns: new Set() };
  function visit(node) {
    if (ts.isPropertyAssignment(node) && node.name.getText(source) === 'storage' && ts.isObjectLiteralExpression(node.initializer)) {
      for (const field of node.initializer.properties) {
        if (!ts.isPropertyAssignment(field)) continue;
        const name = field.name.getText(source);
        if (!(name in storage) || !ts.isArrayLiteralExpression(field.initializer)) continue;
        for (const item of field.initializer.elements) if (ts.isStringLiteral(item)) storage[name].add(item.text.toLowerCase());
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return storage;
}

function startsSql(text) {
  const withoutPrefix = text.replace(/^(?:\s+|--[^\r\n]*(?:\r?\n|$)|\/\*[\s\S]*?\*\/)*/, '');
  return /^(SELECT|UPDATE|INSERT|REPLACE|DELETE|WITH|VALUES)\b/i.test(withoutPrefix);
}

function fragments(path, text) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const found = [];
  function visit(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
      const sql = ts.isTemplateExpression(node) ? node.head.text : node.text;
      if (startsSql(sql)) found.push({ sql, offset: node.getStart(source) + 1, dynamic: ts.isTemplateExpression(node) });
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!found.length && startsSql(text)) found.push({ sql: text, offset: 0, dynamic: false });
  return found;
}

export default {
  id: 'channel-sql-tables',
  description: 'Channel SQL uses only manifest storage tables and columns (LA-ADR-01 D5).',
  check({ path, text }) {
    const channel = /^packages\/channels\/([^/]+)\/app(?:\/.*)?\.[cm]?[jt]s$/.exec(path)?.[1];
    if (!channel || /\.test\.[cm]?[jt]s$/.test(path)) return [];
    const storage = storageOf(channel);
    const hits = [];
    const usedOrders = new Set();
    const report = (offset, message) => {
      const before = text.slice(0, offset);
      hits.push({ line: before.split('\n').length, col: offset - before.lastIndexOf('\n'), message });
    };
    for (const fragment of fragments(path, text)) {
      if (fragment.dynamic) {
        report(fragment.offset, 'Channel SQL must be a complete literal so its storage names can be checked.');
        continue;
      }
      const sql = fragment.sql.replace(/--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|[:@$][A-Za-z_][A-Za-z0-9_]*/g, (s) => s.replace(/[^\n]/g, ' '))
        .replace(/["`[\]]/g, ' ');
      if (/\b(?:rowid|_rowid_|oid)\b/i.test(sql)) {
        if (!LEGACY_ORDER.some((entry) => entry.file === path && entry.text === fragment.sql) || usedOrders.has(fragment.sql)) {
          report(fragment.offset, 'rowid is allowed only in the three exact moved legacy statements (BD-A2-46).');
          continue;
        }
        usedOrders.add(fragment.sql);
      }
      // Compile against a synthetic schema containing only declared storage. SQLite resolves aliases,
      // comma joins, nested queries, quoted identifiers and write columns; token matching cannot do that safely.
      // Whole-table entries allow every column name. Shared tables get only their explicit columns.
      if (sql.trim().replace(/;$/, '').includes(';')) {
        report(fragment.offset, 'Channel SQL must contain one statement.');
        continue;
      }
      const columns = new Map();
      const words = new Set([...sql.matchAll(/\b[a-z_][a-z0-9_]*\b/gi)].map((m) => m[0].toLowerCase()));
      for (const table of storage.tables) columns.set(table, new Set([...words, '_storage_placeholder']));
      for (const entry of storage.columns) {
        const [table, column] = entry.split('.');
        if (!columns.has(table)) columns.set(table, new Set(['__undeclared_storage__']));
        columns.get(table).add(column);
      }
      const quote = (name) => `"${name.replaceAll('"', '""')}"`;
      const db = new DatabaseSync(':memory:');
      try {
        for (const [table, names] of columns) {
          db.exec(`CREATE TABLE ${quote(table)} (${[...names].map((name) => `${quote(name)} BLOB`).join(', ')})`);
        }
        db.setAuthorizer((action, table, column) => {
          if ([constants.SQLITE_READ, constants.SQLITE_UPDATE, constants.SQLITE_INSERT, constants.SQLITE_DELETE].includes(action)) {
            if (!columns.has(table)) return constants.SQLITE_DENY;
            if (storage.tables.has(table)) return constants.SQLITE_OK;
            if (column && !storage.columns.has(`${table}.${column.toLowerCase()}`)) return constants.SQLITE_DENY;
          }
          return constants.SQLITE_OK;
        });
        // A shared table has an undeclared sentinel column: SELECT * also fails authorization.
        // Prepare only. Never run channel SQL during a fitness check.
        db.prepare(fragment.sql);
      } catch (error) {
        report(fragment.offset, `SQL names storage outside the ${channel} manifest or cannot be checked: ${error.message.replace(/[\r\n]/g, ' ')}`);
      } finally { db.close(); }

    }
    return hits;
  },
};
