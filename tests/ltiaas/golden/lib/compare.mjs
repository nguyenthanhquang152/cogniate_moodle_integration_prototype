// Golden compare and expected deltas (LA-E0-03 AC-06, AC-07, AC-08; TEST-STRATEGY §4.6, §4.7). Pure functions.
//
// A difference is { file, path, kind: changed | added | removed, old, new }. The path names object keys with dots
// and array elements with [n], for example `lmsProviders.lms[0].channel`.
//
// Expected-delta file (tests/ltiaas/golden/expected/<LA-IC id>.json), one per intended change (plan LD-9):
//   { "id": "LA-IC-01", "approval": "<qa.md link of both reviewer approvals>",
//     "changes": [ { "file": "G1", "path": "lmsProviders.lms[*].channel", "value": "moodle" | <any JSON>,
//                    "rule": "present" | "removed" | "string" | "boolean" | "number" | "object" | "array" } ] }
// One entry per field path: `value` (the new value) or `rule` (a value rule). `*` in a path matches one key or one
// array index. An entry explains each difference whose file and path match and whose new value passes. A difference
// that no entry explains fails. An entry that explains no difference fails as "expected change missing".
import { isDeepStrictEqual } from 'node:util';

const keyPart = (key) => (/^[A-Za-z_$][A-Za-z0-9_$-]*$/.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`);
const join = (base, part) => (base === '' && part.startsWith('.') ? part.slice(1) : base + part);

/** All differences between two normalized JSON values. */
export function diff(oldValue, newValue, path = '', out = []) {
  if (isDeepStrictEqual(oldValue, newValue)) return out;
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  if (Array.isArray(oldValue) && Array.isArray(newValue)) {
    for (let i = 0; i < Math.max(oldValue.length, newValue.length); i++) {
      const p = `${path}[${i}]`;
      if (i >= oldValue.length) out.push({ path: p, kind: 'added', old: undefined, new: newValue[i] });
      else if (i >= newValue.length) out.push({ path: p, kind: 'removed', old: oldValue[i], new: undefined });
      else diff(oldValue[i], newValue[i], p, out);
    }
    return out;
  }
  if (isObj(oldValue) && isObj(newValue)) {
    for (const key of [...new Set([...Object.keys(oldValue), ...Object.keys(newValue)])].sort()) {
      const p = join(path, keyPart(key));
      if (!Object.hasOwn(newValue, key)) out.push({ path: p, kind: 'removed', old: oldValue[key], new: undefined });
      else if (!Object.hasOwn(oldValue, key)) out.push({ path: p, kind: 'added', old: undefined, new: newValue[key] });
      else diff(oldValue[key], newValue[key], p, out);
    }
    return out;
  }
  out.push({ path, kind: 'changed', old: oldValue, new: newValue });
  return out;
}

/** Splits a path into segments: keys and [n] indexes. */
function segments(path) {
  const out = [];
  const re = /\.?([A-Za-z_$*][A-Za-z0-9_$*-]*)|\[(\d+|\*)\]|\["((?:[^"\\]|\\.)*)"\]/g;
  let m;
  while ((m = re.exec(path))) out.push(m[1] ?? m[2] ?? JSON.parse(`"${m[3]}"`));
  return out;
}
export function pathMatches(pattern, path) {
  const a = segments(pattern), b = segments(path);
  return a.length === b.length && a.every((s, i) => s === '*' || s === b[i]);
}
const RULES = {
  present: (d) => d.new !== undefined,
  removed: (d) => d.kind === 'removed',
  string: (d) => typeof d.new === 'string',
  boolean: (d) => typeof d.new === 'boolean',
  number: (d) => typeof d.new === 'number',
  object: (d) => d.new !== null && typeof d.new === 'object' && !Array.isArray(d.new),
  array: (d) => Array.isArray(d.new),
};
function accepts(entry, d) {
  if (Object.hasOwn(entry, 'value')) return isDeepStrictEqual(entry.value, d.new);
  const rule = RULES[entry.rule];
  if (!rule) throw new Error(`Unknown expected-delta rule ${JSON.stringify(entry.rule)}`);
  return rule(d);
}

/**
 * Compares two golden captures: `{ G1: data, G2: data, … }` each. `expected` is a list of expected-delta files.
 * Returns { ok, differences (each with `explainedBy` or null), missing (entries that explained nothing) }.
 */
export function compareCaptures(base, candidate, expected = []) {
  const files = [...new Set([...Object.keys(base), ...Object.keys(candidate)])].sort();
  const differences = files.flatMap((file) => diff(base[file], candidate[file]).map((d) => ({ file, ...d, explainedBy: null })));
  const entries = expected.flatMap((delta) => delta.changes.map((entry) => ({ ...entry, id: delta.id, used: 0 })));
  for (const d of differences) {
    const entry = entries.find((e) => e.file === d.file && pathMatches(e.path, d.path) && accepts(e, d));
    if (entry) { entry.used++; d.explainedBy = entry.id; }
  }
  const missing = entries.filter((e) => e.used === 0).map(({ used, ...e }) => e);
  return { ok: differences.every((d) => d.explainedBy) && missing.length === 0, differences, missing };
}

const show = (v) => (v === undefined ? '(absent)' : JSON.stringify(v));
/** The report lines: each difference by path with the old and new value, then each missing expected change. */
export function report({ differences, missing }) {
  const lines = [];
  for (const d of differences) {
    lines.push(`${d.explainedBy ? 'EXPECTED' : 'DIFF'} ${d.file} ${d.path} (${d.kind}): ${show(d.old)} -> ${show(d.new)}${d.explainedBy ? ` [${d.explainedBy}]` : ''}`);
  }
  for (const e of missing) lines.push(`MISSING ${e.file} ${e.path}: expected change missing [${e.id}] (${Object.hasOwn(e, 'value') ? 'value ' + show(e.value) : 'rule ' + e.rule})`);
  return lines;
}
