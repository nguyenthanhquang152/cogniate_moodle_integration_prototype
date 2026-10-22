#!/usr/bin/env node
// Golden compare, no Docker (LA-E0-03 AC-06; TEST-STRATEGY §4.6).
//   node tests/ltiaas/golden/compare.mjs --base tests/ltiaas/golden/<baseline sha> --candidate <capture folder>
//        [--expected LA-IC-01,LA-IC-04] [--expected-dir tests/ltiaas/golden/expected]
// Reads G1.json … G4.json of both folders (normalized captures), prints each difference by path with the old and new
// value, and each expected change that is missing. Exit 0 only when every difference is explained by a named
// expected-delta file and no named change is missing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { compareCaptures, report } from './lib/compare.mjs';

const started = process.hrtime.bigint();
const here = path.dirname(fileURLToPath(import.meta.url));
const { values: opt } = parseArgs({ options: {
  base: { type: 'string' }, candidate: { type: 'string' }, expected: { type: 'string', default: '' },
  'expected-dir': { type: 'string', default: path.join(here, 'expected') },
} });
if (!opt.base || !opt.candidate) { console.error('Usage: compare.mjs --base <dir> --candidate <dir> [--expected <LA-IC ids>]'); process.exit(2); }
const FILES = ['G1', 'G2', 'G3', 'G4'];
const load = (dir) => Object.fromEntries(FILES.map((f) => {
  const file = path.join(dir, `${f}.json`);
  if (!fs.existsSync(file)) { console.error(`Missing ${file}`); process.exit(2); }
  return [f, JSON.parse(fs.readFileSync(file, 'utf8'))];
}));
const expected = opt.expected.split(',').map((s) => s.trim()).filter(Boolean).map((id) => {
  const file = path.join(opt['expected-dir'], `${id}.json`);
  if (!fs.existsSync(file)) { console.error(`Missing expected-delta file ${file}`); process.exit(2); }
  const delta = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (delta.id !== id || !Array.isArray(delta.changes)) { console.error(`Bad expected-delta file ${file}`); process.exit(2); }
  return delta;
});
const result = compareCaptures(load(opt.base), load(opt.candidate), expected);
for (const line of report(result)) console.log(line);
const ms = Number(process.hrtime.bigint() - started) / 1e6;
const unexplained = result.differences.filter((d) => !d.explainedBy).length;
console.log(`${result.ok ? 'EQUAL' : 'DIFFERENT'}: ${result.differences.length} differences (${unexplained} not explained), `
  + `${result.missing.length} expected changes missing; expected-delta files: ${expected.map((d) => d.id).join(', ') || 'none'}; ${ms.toFixed(0)} ms`);
process.exit(result.ok ? 0 : 1);
