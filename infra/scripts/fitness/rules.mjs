import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { ROOT, repoPath, trackedFiles } from './common.mjs';

function invalid(file, reason) {
  return new Error(`rule_invalid ${file}: ${String(reason).replace(/[\r\n]+/g, ' ')}`);
}

export async function loadRules(folder = new URL('./rules/', import.meta.url)) {
  const files = readdirSync(folder, { withFileTypes: true }).filter((entry) => entry.name.endsWith('.mjs')).map((entry) => {
    if (!entry.isFile()) throw invalid(entry.name, 'rule module must be a regular file, not a symlink or directory');
    return entry.name;
  }).sort();
  const rules = [];
  for (const name of files) {
    const url = folder instanceof URL ? new URL(name, folder) : pathToFileURL(resolve(folder, name));
    let rule;
    try { rule = (await import(url.href)).default; }
    catch (error) { throw invalid(name, error.message); }
    if (!rule || typeof rule.id !== 'string' || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(rule.id) || typeof rule.check !== 'function') throw invalid(name, 'expected default { id, check({ path, text }) }');
    if (rules.some((item) => item.id === rule.id)) throw invalid(name, `duplicate rule id ${rule.id}`);
    if (rule.id !== name.slice(0, -4)) throw invalid(name, 'rule id must equal its file name');
    if (rule.description !== undefined && (typeof rule.description !== 'string' || /[\r\n]/.test(rule.description))) throw invalid(name, 'description must be one line');
    rules.push({ ...rule, file: name });
  }
  if (!rules.length) throw invalid('rules/', 'No F5 rule files found.');
  return rules;
}

// One adapter for the shared F5 interface. A broken rule must fail the check.
export function runRules(file, rules) {
  return rules.flatMap((rule) => {
    const name = rule.file ?? `${rule.id}.mjs`;
    let hits;
    try { hits = rule.check(file); }
    catch (error) { throw invalid(name, error.message); }
    if (!Array.isArray(hits)) throw invalid(name, 'check must return an array');
    return hits.map((hit) => {
      if (!hit || !Number.isSafeInteger(hit.line) || hit.line < 1 || !Number.isSafeInteger(hit.col) || hit.col < 1 || typeof hit.message !== 'string' || !hit.message || /[\r\n]/.test(hit.message)) throw invalid(name, 'invalid finding');
      return { ...hit, rule: rule.id };
    });
  });
}

export function productTextFiles(root = ROOT) {
  return trackedFiles(root, ['services', 'packages', 'apps']).flatMap((path) => {
    const bytes = readFileSync(resolve(root, path));
    return bytes.includes(0) ? [] : [{ path, text: bytes.toString('utf8') }];
  });
}

export async function main() {
  const { values } = parseArgs({ options: { stdin: { type: 'boolean' }, as: { type: 'string' }, rule: { type: 'string' } } });
  if (Boolean(values.stdin) !== Boolean(values.as)) throw new Error('Use --stdin with --as <repo path>.');
  let rules = await loadRules();
  if (values.rule) {
    rules = rules.filter((rule) => rule.id === values.rule);
    if (!rules.length) throw new Error(`Unknown F5 rule: ${values.rule}`);
  }
  const files = values.stdin ? [{ path: repoPath(values.as), text: readFileSync(0, 'utf8') }]
    : productTextFiles();
  let count = 0;
  for (const file of files) {
    for (const hit of runRules(file, rules)) {
      console.log(`${file.path}:${hit.line}:${hit.col}  ${hit.rule}  ${hit.message}`);
      count++;
    }
  }
  console.log(`F5 ${count ? 'FAIL' : 'PASS'}: ${rules.length} rules (${rules.map((rule) => rule.id).join(', ')}), ${count} hits`);
  process.exitCode = count ? 1 : 0;
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error.message.startsWith('rule_invalid ') ? error.message : invalid('rules.mjs', error.message).message);
    process.exitCode = 2;
  });
}
