import { APPLIED_MIGRATIONS, isMigration, maskComments, position } from '../common.mjs';

// SQLite-only syntax that a later Postgres migration cannot run as written.
// Applied files are frozen history (ADR-006); do not extend their snapshot for new migrations.
export const STATEMENTS = [
  ['PRAGMA', /\bPRAGMA\b/gi],
  ['INSERT OR REPLACE/IGNORE/ABORT/FAIL/ROLLBACK', /\bINSERT\s+OR\s+(?:REPLACE|IGNORE|ABORT|FAIL|ROLLBACK)\b/gi],
  ['UPDATE OR REPLACE/IGNORE/ABORT/FAIL/ROLLBACK', /\bUPDATE\s+OR\s+(?:REPLACE|IGNORE|ABORT|FAIL|ROLLBACK)\b/gi],
  ['REPLACE INTO', /\bREPLACE\s+INTO\b/gi],
  ['AUTOINCREMENT', /\bAUTOINCREMENT\b/gi],
  ['WITHOUT ROWID', /\bWITHOUT\s+ROWID\b/gi],
  ['STRICT table', /\)\s*(?:,\s*)?STRICT\b/gi],
  ['CREATE VIRTUAL TABLE', /\bCREATE\s+VIRTUAL\s+TABLE\b/gi],
  ['ATTACH/DETACH DATABASE', /\b(?:ATTACH|DETACH)(?:\s+DATABASE)?\b/gi],
];

export default {
  id: 'sql-portability',
  check({ path, text }) {
    if (!isMigration(path) || APPLIED_MIGRATIONS.has(path)) return [];
    const sql = maskComments(text, 'sql', true);
    const hits = [];
    for (const [name, pattern] of STATEMENTS) {
      for (const match of sql.matchAll(pattern)) hits.push({ ...position(text, match.index), message: `${name}: ${match[0].replace(/\s+/g, ' ')} is not portable SQL` });
    }
    return hits.sort((a, b) => a.line - b.line || a.col - b.col);
  },
};
