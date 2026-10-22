// @ts-check
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { allowList as defaultAllowList } from './allow-list.mjs';

/** @typedef {'private_key' | 'api_key' | 'master_key' | 'secret_assignment' | 'example_value' | 'unreadable_file'} Rule */
/** @typedef {{file: string, rule: Rule, fingerprint: string, reason: string}} AllowEntry */
/** @typedef {{file: string, line: number, rule: Rule}} Finding */
/** @typedef {{line: number, rule: Rule, fingerprint?: string}} TextFinding */
/** @typedef {{file: string, rule: Rule, note: 'stale_allow_list_entry'}} StaleNote */
/** @typedef {{result: 'pass' | 'fail', findings: Finding[], notes: StaleNote[]} | {result: 'fail', reason: string}} ScanResult */

/** @type {Array<[Rule, RegExp]>} */
const patterns = [
  ['private_key', /-----BEGIN ((?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?)-----(?:[\s\S]*?-----END \1-----)?/g],
  ['api_key', /ltis_[A-Za-z0-9_-]+/g],
  ['master_key', /(?<![a-fA-F0-9])[a-fA-F0-9]{64}(?![a-fA-F0-9])/g],
];
const quotedPattern = /^("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/;

/** Read only names from the secrets section, up to the next section.
 * @param {string} exampleText
 * @returns {string[]}
 */
export function secretKeysOf(exampleText) {
  const secretKeys = [];
  let inSecrets = false;
  for (const line of exampleText.split('\n')) {
    if (/^\s*# --- secrets\b/.test(line)) inSecrets = true;
    else if (/^\s*# ---/.test(line)) inSecrets = false;
    const assignment = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (inSecrets && assignment?.[1]) secretKeys.push(assignment[1]);
  }
  return secretKeys;
}

/** Keep nested placeholders together, both in a bare value and in a shell default.
 * @param {string} text
 * @param {number} start
 */
function expansionEnd(text, start) {
  let depth = 1;
  for (let i = start + 2; i < text.length; i += 1) {
    if (text.startsWith('${', i)) { depth += 1; i += 1; }
    else if (text[i] === '}' && --depth === 0) return i;
  }
  return -1;
}

/** @param {string} text */
function readValue(text) {
  const quoted = text.match(quotedPattern);
  if (quoted) return quoted[0];
  let end = 0;
  while (end < text.length) {
    if (text.startsWith('${', end)) {
      const close = expansionEnd(text, end);
      if (close >= 0) { end = close + 1; continue; }
    }
    if (text[end] === '<') {
      const close = text.indexOf('>', end + 1);
      if (close >= 0) { end = close + 1; continue; }
    }
    if (/[\s,;}\]#"'`]/.test(text.charAt(end))) break;
    end += 1;
  }
  return text.slice(0, end);
}

/** @param {readonly string[]} secretKeys */
function defaultPatternOf(secretKeys) {
  return new RegExp(String.raw`\$\{(${secretKeys.join('|')})(?::[-=]|[-=])`, 'g');
}

/** Return the exact value for its digest; do not evaluate or unescape it.
 * @param {string} value
 * @param {readonly string[]} secretKeys
 * @returns {string | null}
 */
export function literalValue(value, secretKeys) {
  if (value.match(quotedPattern)?.[0] === value) value = value.slice(1, -1);
  if (value === '' || /^(?:\$[A-Za-z_][A-Za-z0-9_]*|<[^<>]*>)$/.test(value)) return null;
  if (value.startsWith('${') && expansionEnd(value, 0) === value.length - 1) {
    if (/^\$\{[A-Za-z_][A-Za-z0-9_]*(?:\}|:?\?)/.test(value)) return null;
    const fallback = [...value.matchAll(defaultPatternOf(secretKeys))][0];
    if (fallback?.index === 0) return literalValue(value.slice(fallback[0].length, -1), secretKeys);
  }
  return value;
}

/** Scan one file without IO. Digests stay inside the scanner; reports omit them.
 * @param {string} file
 * @param {string} text
 * @param {readonly string[]} secretKeys
 * @returns {TextFinding[]}
 */
export function scanText(file, text, secretKeys) {
  /** @type {TextFinding[]} */
  const hits = [];
  /** @param {number} line @param {Rule} rule @param {string} value */
  const finding = (line, rule, value) => hits.push({ line, rule, fingerprint: createHash('sha256').update(value).digest('base64') });
  const codeFile = /\.(?:ts|tsx|mts|cts|js|mjs|cjs)$/.test(file);
  // KEY=v and export KEY=v; KEY: v and "KEY": "v". Values are read separately.
  const name = String.raw`(?<![A-Za-z0-9_])['"]?(${secretKeys.join('|')})['"]?`;
  const separator = String.raw`\s*(?:=(?!=|>)|:(?!:))\s*`;
  const assignmentPattern = new RegExp(name + separator, 'g');
  const defaultPattern = defaultPatternOf(secretKeys);
  for (const [rule, pattern] of patterns) {
    // A1: documentation contains evidence hashes, but still gets every other rule.
    if (rule === 'master_key' && file.startsWith('docs/')) continue;
    for (const match of text.matchAll(pattern)) finding(text.slice(0, match.index).split('\n').length, rule, match[0]);
  }
  text.split('\n').forEach((line, index) => {
    if (file === '.env.example') {
      const assignment = line.match(/^\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=(.*)$/);
      if (assignment && !/^(?:""|''|``)?$/.test((assignment[1] ?? '').trim())) hits.push({ line: index + 1, rule: 'example_value' });
    } else {
      for (const match of line.matchAll(assignmentPattern)) {
        // Shell required-value expressions are not assignments.
        if (line.slice(Math.max(0, match.index - 2), match.index) === '${') continue;
        const token = readValue(line.slice(match.index + match[0].length));
        // BD-A1-13: check only the first quoted token in code, not expressions.
        if (codeFile && (!quotedPattern.test(token) || (token.startsWith('`') && token.includes('${')))) continue;
        const value = literalValue(token, secretKeys);
        if (value !== null) finding(index + 1, 'secret_assignment', value);
      }
    }
    // Defaults of secret names are values in every file, whatever the left key.
    for (const match of line.matchAll(defaultPattern)) {
      const end = expansionEnd(line, match.index);
      if (end < 0) continue;
      const value = literalValue(line.slice(match.index + match[0].length, end), secretKeys);
      if (value !== null) finding(index + 1, 'secret_assignment', value);
    }
  });
  return hits;
}

/** Scan working-tree contents of tracked files, with exact reviewed exceptions.
 * @param {{root?: string, allowList?: readonly AllowEntry[]}} [options]
 * @returns {ScanResult}
 */
export function secretScan({ root = process.cwd(), allowList = defaultAllowList } = {}) {
  const listed = spawnSync('git', ['ls-files', '-z', '--cached'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (listed.status !== 0 || listed.error) return { result: 'fail', reason: 'tracked_files_unavailable' };
  const files = new Set(listed.stdout.split('\0').filter(Boolean));
  let example;
  try {
    const file = path.join(root, '.env.example');
    if (!files.has('.env.example') || !fs.lstatSync(file).isFile()) throw new Error('missing_example');
    example = fs.readFileSync(file, 'utf8');
  } catch { return { result: 'fail', reason: 'secret_names_unavailable' }; }
  const secretKeys = secretKeysOf(example);
  if (secretKeys.length === 0) return { result: 'fail', reason: 'secret_names_unavailable' };
  /** @type {Finding[]} */
  const findings = [];
  const used = new Set();
  for (const file of files) {
    let text;
    try {
      const absolute = path.join(root, file);
      const stat = fs.lstatSync(absolute);
      // Scan link text without following it outside the checkout. Other types fail closed.
      if (stat.isSymbolicLink()) text = fs.readlinkSync(absolute);
      else if (stat.isFile()) text = fs.readFileSync(absolute).toString('utf8');
      else throw new Error('unsupported_file');
    } catch {
      findings.push({ file, line: 1, rule: 'unreadable_file' });
      continue;
    }
    for (const hit of scanText(file, text, secretKeys)) {
      const entry = hit.fingerprint && allowList.find((entry) => entry.file === file && entry.rule === hit.rule && entry.fingerprint === hit.fingerprint && entry.reason);
      if (entry) used.add(entry);
      else if (!findings.some((found) => found.file === file && found.line === hit.line && found.rule === hit.rule)) findings.push({ file, line: hit.line, rule: hit.rule });
    }
  }
  /** @type {StaleNote[]} */
  const notes = allowList.filter((entry) => !used.has(entry)).map(({ file, rule }) => ({ file, rule, note: 'stale_allow_list_entry' }));
  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule));
  return { result: findings.length ? 'fail' : 'pass', findings, notes };
}
