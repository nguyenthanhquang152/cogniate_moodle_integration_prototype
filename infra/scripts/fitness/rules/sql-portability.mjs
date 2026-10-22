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

// LA-ADR-06 D13 rule 2: each new adapter exception needs an ADR and rule review.
const ADAPTER_ALLOW_LIST = [
  { file: 'services/lti-service/src/db/migrations/009_signing_key_lifecycle.sql', form: 'date-function', ref: 'LA-ADR-06 D13 rule 2' },
  { file: 'services/lti-service/src/db/migrations/011_api_key.sql', form: 'randomblob', ref: 'LA-ADR-06 D13 rule 2' },
];

const DATE_FUNCTIONS = new Set(['unixepoch', 'julianday', 'strftime', 'datetime', 'date', 'time', 'timediff']);

function sqlForms(text) {
  // Keep SQL identifiers distinct from string values and comments. Preserve offsets.
  const pattern = /--[^\r\n]*|\/\*[\s\S]*?(?:\*\/|$)|[xX]'(?:''|[^'])*'|'(?:''|[^'])*'|"(?:""|[^"])*"|`(?:``|[^`])*`|\[[^\]]*\]|[A-Za-z_\u0080-\uffff][\w$\u0080-\uffff]*|[^\s]/g;
  const tokens = [];
  for (const match of text.matchAll(pattern)) {
    const raw = match[0];
    if (raw.startsWith('--') || raw.startsWith('/*')) continue;
    const quotedIdentifier = ['"', '`', '['].includes(raw[0]);
    tokens.push({ raw, offset: match.index, name: (quotedIdentifier ? raw.slice(1, -1) : raw).toLowerCase(), quotedIdentifier });
  }
  const hits = [];
  for (const [index, token] of tokens.entries()) {
    let form;
    if (/^[xX]'/.test(token.raw)) form = 'blob-literal';
    else if (token.name === 'rowid' && (tokens[index - 1]?.name !== 'without' || tokens[index - 1].quotedIdentifier)) form = 'rowid';
    else if (tokens[index + 1]?.raw === '(') {
      if (DATE_FUNCTIONS.has(token.name)) form = 'date-function';
      else if (token.name === 'randomblob') form = 'randomblob';
    }
    if (form) hits.push({ offset: token.offset, form, message: `${form}: ${token.raw.replace(/\s+/g, ' ')} is not portable SQL` });
  }
  return hits;
}

export default {
  id: 'sql-portability',
  check({ path, text }) {
    const hits = [];
    if (isMigration(path) || /^services\/[^/]+\/src\/db\/migrations\/[^/]+\.sql$/.test(path)) {
      if (APPLIED_MIGRATIONS.has(path)) return [];
      const sql = maskComments(text, 'sql', true);
      for (const [name, pattern] of STATEMENTS) {
        for (const match of sql.matchAll(pattern)) hits.push({ ...position(text, match.index), message: `${name}: ${match[0].replace(/\s+/g, ' ')} is not portable SQL` });
      }
      for (const hit of sqlForms(text)) {
        if (!ADAPTER_ALLOW_LIST.some((entry) => entry.file === path && entry.form === hit.form)) hits.push({ ...position(text, hit.offset), message: hit.message });
      }
    }
    return hits.sort((a, b) => a.line - b.line || a.col - b.col);
  },
};
