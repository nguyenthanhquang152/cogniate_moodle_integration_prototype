import ts from 'typescript';
import { APPLIED_MIGRATIONS, isMigration, isUnitFile, maskComments, position } from '../common.mjs';

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

// Freeze one occurrence of each existing query, not every use in its file.
const INLINE_BASELINE = [
  {
    file: 'services/cogniate-app/src/domain/pickers.ts', form: 'blob-literal', ref: 'LA-ADR-06 D13 rule 2',
    text: "UPDATE picker_session SET ltik_encrypted = X'' WHERE id = ?",
  },
  {
    file: 'services/cogniate-app/src/domain/retention.ts', form: 'blob-literal', ref: 'LA-ADR-06 D13 rule 2',
    text: "UPDATE picker_session SET ltik_encrypted = X'' WHERE used_at IS NOT NULL AND length(ltik_encrypted) > 0 AND expires_at < ?",
  },
  {
    file: 'services/lti-service/src/store/tool-keys.ts', form: 'blob-literal', ref: 'S2 LA-E5-10 fix round',
    text: "UPDATE tool_key SET status = 'removed', removed_at = ?, private_jwk_encrypted = X'' WHERE tool_account_id = ? AND kid = ?",
  },
  {
    file: 'services/lti-service/src/jobs/signing-key-cleanup.ts', form: 'blob-literal', ref: 'S2 LA-E5-10 fix round',
    text: "UPDATE tool_key SET private_jwk_encrypted = X'' WHERE status = 'removed' AND length(private_jwk_encrypted) > 0",
  },
  // BD-A2-22: these nine pre-LA statements are frozen; this baseline never grows.
  {
    file: "services/cogniate-app/src/domain/attempts.ts", form: 'rowid', ref: 'LA-ADR-06 D13 rule 2: legacy pre-LA SQL',
    text: "SELECT a.*, v.course_id AS course_id FROM attempt a JOIN course_version v ON v.id = a.course_version_id\n    WHERE a.resource_link_id = ? AND a.user_sub = ? ORDER BY a.created_at DESC, a.rowid DESC LIMIT 1",
  },
  {
    file: "services/cogniate-app/src/domain/bindings.ts", form: 'rowid', ref: 'LA-ADR-06 D13 rule 2: legacy pre-LA SQL',
    text: "SELECT * FROM binding_grant WHERE connection_id = ? ORDER BY created_at, rowid",
  },
  {
    file: "services/cogniate-app/src/domain/bindings.ts", form: 'rowid', ref: 'LA-ADR-06 D13 rule 2: legacy pre-LA SQL',
    text: "SELECT * FROM approved_deployment WHERE connection_id = ? ORDER BY approved_at, rowid",
  },
  {
    file: "packages/channels/moodle/app/builds.ts", form: 'rowid', ref: 'LA-ADR-06 D13 rule 2: legacy pre-LA SQL (moved, BD-A2-46)',
    text: "SELECT * FROM mbz_build WHERE library_id = :library_id AND version_id = :version_id ORDER BY created_at DESC, rowid DESC LIMIT 1",
  },
  {
    file: "packages/channels/moodle/app/builds.ts", form: 'rowid', ref: 'LA-ADR-06 D13 rule 2: legacy pre-LA SQL (moved, BD-A2-46)',
    text: "SELECT * FROM mbz_build WHERE library_id = :library_id AND version_id = :version_id AND status = 'ready' ORDER BY created_at DESC, rowid DESC LIMIT 1",
  },
  {
    file: "packages/channels/moodle/app/builds.ts", form: 'rowid', ref: 'LA-ADR-06 D13 rule 2: legacy pre-LA SQL (moved, BD-A2-46)',
    text: "SELECT * FROM mbz_build WHERE library_id = :library_id AND status IN ('queued', 'running') ORDER BY created_at, rowid",
  },
  {
    file: "services/cogniate-app/src/domain/results.ts", form: 'rowid', ref: 'LA-ADR-06 D13 rule 2: legacy pre-LA SQL',
    text: "SELECT a.id, a.resource_link_id, a.user_sub, a.course_version_id, a.preview, a.outcome, a.score_given, a.score_maximum,\n      a.created_at, a.updated_at, rl.context_title, rl.title, con.site_url, con.channel\n    FROM attempt a JOIN course_version v ON v.id = a.course_version_id JOIN resource_link rl ON rl.id = a.resource_link_id\n    JOIN connection con ON con.id = rl.connection_id\n    WHERE rl.connection_id = ? AND v.course_id = ? ORDER BY a.created_at, a.rowid",
  },
  {
    file: "services/cogniate-app/src/domain/results.ts", form: 'rowid', ref: 'LA-ADR-06 D13 rule 2: legacy pre-LA SQL',
    text: "SELECT * FROM score_sync WHERE attempt_id IN ( ) ORDER BY created_at, rowid",
  },
  {
    file: "services/cogniate-app/src/domain/score-syncs.ts", form: 'rowid', ref: 'LA-ADR-06 D13 rule 2: legacy pre-LA SQL',
    text: "SELECT status, score_given, score_maximum FROM score_sync WHERE resource_link_id = ? AND user_sub = ? ORDER BY created_at DESC, rowid DESC LIMIT 1",
  },
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

function literalPart(node, source) {
  const start = node.getStart(source) + 1;
  const end = node.end - (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) ? 2 : 1);
  const raw = source.text.slice(start, end);
  const offsets = [];
  // TypeScript supplies the cooked value. Map each cooked code unit back to source.
  const units = /\\(?:\r\n|[\r\n\u2028\u2029]|u\{[\da-fA-F]+\}|u[\da-fA-F]{4}|x[\da-fA-F]{2}|[0-7]{1,3}|[\s\S])|\r\n|[\s\S]/g;
  for (const match of raw.matchAll(units)) {
    const unit = match[0];
    if (/^\\[\r\n\u2028\u2029]/.test(unit)) continue;
    const width = unit.startsWith('\\u{') && parseInt(unit.slice(3, -1), 16) > 0xffff ? 2 : 1;
    for (let i = 0; i < width; i++) offsets.push(start + match.index);
  }
  return { text: node.text, offsets };
}

function inlineSql(path, text) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const literals = [];
  function visit(node) {
    if (ts.isTemplateExpression(node)) {
      const combined = literalPart(node.head, source);
      for (const span of node.templateSpans) {
        const part = literalPart(span.literal, source);
        combined.text += ` ${part.text}`;
        combined.offsets.push(span.expression.getStart(source), ...part.offsets);
        visit(span.expression);
      }
      literals.push(combined);
    } else {
      if (ts.isStringLiteralLike(node)) literals.push(literalPart(node, source));
      ts.forEachChild(node, visit);
    }
  }
  visit(source);
  return literals;
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
    } else if ((/^services\/[^/]+\/src\/(?:[^/]+\/)*[^/]+\.ts$/.test(path) || /^packages\/channels\/[^/]+\/app\/.*\.ts$/.test(path)) && !isUnitFile(path)) {
      const used = new Set();
      for (const literal of inlineSql(path, text)) {
        for (const hit of sqlForms(literal.text)) {
          const entry = INLINE_BASELINE.find((entry) => entry.file === path && entry.form === hit.form && entry.text === literal.text && !used.has(entry));
          if (entry) used.add(entry);
          else hits.push({ ...position(text, literal.offsets[hit.offset]), message: hit.message });
        }
      }
    }
    return hits.sort((a, b) => a.line - b.line || a.col - b.col);
  },
};
