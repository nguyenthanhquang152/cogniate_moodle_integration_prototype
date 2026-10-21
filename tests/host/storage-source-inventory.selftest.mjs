// HARNESS ONLY: the source inventory of the storage repair (triage revision 4 §7.2, V4-9). A text check: the token
// count of each runtime module equals the named exceptions X1–X8 exactly, and no runtime module imports a self-test.
// The check lives only in this file, which is outside its own scope. Limit (A-SRR-08): a text inventory cannot see an
// aliased or computed call; the runtime modules use none, and the source reviews check that.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = path.dirname(fileURLToPath(import.meta.url));
const TOKEN = /\b(copyFileSync|copyFile|cpSync|cp|mkdtempSync|mkdtemp|tmpdir)\s*\(/g;
/** X1–X8: the only token matches in the scope after the repair. */
const EXCEPTIONS = {
  'storage-lane.mjs': { copyFileSync: 1 }, // X1 boot(): the fixture script into bin/
  'storage-rows.mjs': { cpSync: 1 }, // X2 e-old-schema: the course package folders
  'storage-compat-route.mjs': { mkdtempSync: 1, tmpdir: 1 }, // X3 treeRule: a git index of tests/
  'run-m1.mjs': { mkdtempSync: 1, tmpdir: 1 }, // X4 the full branch: the accounting scratch
  'storage-fixture-script.mjs': { mkdtempSync: 1, tmpdir: 1 }, // X5 logicalRead scratch; X6 main(): the container's own temporary folder
  'm1-migration.mjs': { mkdtempSync: 2 }, // X7 qa-m1-private-backup-*, X8 qa-m1-snapshot-private-*
};
/** The runtime modules: every storage-*.mjs that is not a self-test, plus m1-migration.mjs and run-m1.mjs. */
const scope = (dir) => fs.readdirSync(dir).filter((n) => (/^storage-.*\.mjs$/.test(n) && !n.endsWith('.selftest.mjs')) || n === 'm1-migration.mjs' || n === 'run-m1.mjs').sort();
function problems(dir) {
  const out = [];
  for (const name of scope(dir)) {
    const text = fs.readFileSync(path.join(dir, name), 'utf8'), counts = {};
    for (const m of text.matchAll(TOKEN)) counts[m[1]] = (counts[m[1]] ?? 0) + 1;
    const want = EXCEPTIONS[name] ?? {};
    for (const token of new Set([...Object.keys(counts), ...Object.keys(want)])) if ((counts[token] ?? 0) !== (want[token] ?? 0)) out.push(`${name}: ${token} ${counts[token] ?? 0}, expected ${want[token] ?? 0}`);
    if (/\b(?:from|import)\s*(?:\(\s*)?['"][^'"]*\.selftest\.mjs['"]/.test(text)) out.push(`${name}: imports a self-test file`);
  }
  return out;
}
/** A temporary copy of the scope (and the self-tests, which stay outside it). */
function copyScope(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-inventory-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const n of fs.readdirSync(HOST).filter((x) => x.endsWith('.mjs'))) fs.writeFileSync(path.join(dir, n), fs.readFileSync(path.join(HOST, n)));
  return dir;
}
const insertBefore = (dir, file, anchor, line) => {
  const p = path.join(dir, file), text = fs.readFileSync(p, 'utf8');
  assert.equal(text.split(anchor).length, 2, `One anchor in ${file}: ${anchor}`);
  fs.writeFileSync(p, text.replace(anchor, line + '\n' + anchor));
};
/** One anchor at each copy or write site #1–#16 (§7.2). */
const SITES = [
  ['#1', 'storage-fixture-script.mjs', 'const held = privateCopy(from, to, { hook });'],
  ['#2', 'storage-fixture-script.mjs', 'const back = intoVolumeWrite(to, bytes,'],
  ['#3', 'storage-fixture-script.mjs', 'const held = privateCopy(from, path.join(target, name), { hook });'],
  ['#4', 'storage-fixture-script.mjs', 'privateCopy(file, path.join(scratch, db + suffix), { hook });'],
  ['#5', 'storage-fixture-script.mjs', 'intoVolumeWrite(file, bytes, op.mode ?'],
  ['#6', 'storage-fixture-script.mjs', "intoVolumeWrite(file, Buffer.from(op.base64 ?? '', 'base64')"],
  ['#7', 'storage-fixture-script.mjs', 'if (negative) privateCopy(file, separate, { hook });'],
  ['#8', 'storage-oracle.mjs', 'privateCopy(sourceFile, target, { hook });'],
  ['#9', 'storage-rows.mjs', 'privateReplace(target, readRegular(path.join(fromClone, rel)).bytes, { hook });'],
  ['#10', 'storage-lane.mjs', "privateCopy(path.join(src, db + suffix), path.join(scratch, db + suffix), { hook });"],
  ['#11', 'storage-rows.mjs', "privateCopy(path.join(appFolder, 'cogniate.db' + s), path.join(scratch, 'cogniate.db' + s), { hook });"],
  ['#12', 'storage-rows.mjs', 'privateCopyTree(state.B, copy, { hook: lane.copyHook });'],
  ['#13', 'm1-migration.mjs', 'privateCopyTree(backup, copy, { hook: copyHook });'],
  ['#14', 'storage-compat-route.mjs', 'const ids = { [argsFile]: privateEmptyFile(argsFile'],
  ['#15', 'storage-rows.mjs', "fs.writeFileSync(file, text, { mode: 0o600, flag: 'wx' });"],
  ['#16', 'm1-migration.mjs', 'privateWrite(file, Buffer.from(JSON.stringify({ m123Backup'],
];

test('HARNESS ONLY: V4-9 the runtime modules have exactly the X1–X8 token matches and import no self-test', () => {
  assert.deepEqual(scope(HOST), ['m1-migration.mjs', 'run-m1.mjs', 'storage-compat-route.mjs', 'storage-diagnostic.mjs', 'storage-docker.mjs', 'storage-fixture-script.mjs',
    'storage-handoff.mjs', 'storage-inventory.mjs', 'storage-lane.mjs', 'storage-oracle.mjs', 'storage-private-scan.mjs', 'storage-rows.mjs'], 'The scope finds the new storage-*.mjs modules');
  assert.deepEqual(problems(HOST), []);
  assert.ok(!scope(HOST).includes('storage-source-inventory.selftest.mjs'), 'The check is outside its own scope');
});

test('HARNESS ONLY: V4-9 mutations on a temporary copy: a token at any site #1–#16, a new module, a default scratchBase, a self-test import', (t) => {
  for (const [site, file, anchor] of SITES) {
    const dir = copyScope(t);
    insertBefore(dir, file, anchor, '    fs.copyFileSync(String(site), String(site));');
    assert.deepEqual(problems(dir), [`${file}: copyFileSync ${(EXCEPTIONS[file]?.copyFileSync ?? 0) + 1}, expected ${EXCEPTIONS[file]?.copyFileSync ?? 0}`], `Site ${site} is bound`);
  }
  const added = copyScope(t);
  fs.writeFileSync(path.join(added, 'storage-x.mjs'), "import os from 'node:os';\nexport const scratch = () => os.tmpdir();\n");
  assert.deepEqual(problems(added), ['storage-x.mjs: tmpdir 1, expected 0'], 'A new runtime module is in the scope');
  const selftest = copyScope(t);
  fs.writeFileSync(path.join(selftest, 'storage-x.selftest.mjs'), "import os from 'node:os';\nexport const scratch = () => os.tmpdir();\n");
  assert.deepEqual(problems(selftest), [], 'A self-test is outside the scope');
  const fallback = copyScope(t);
  const p = path.join(fallback, 'storage-fixture-script.mjs');
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('integrity = false, scratchBase, hook } = {}', 'integrity = false, scratchBase = os.tmpdir(), hook } = {}'));
  assert.deepEqual(problems(fallback), ['storage-fixture-script.mjs: tmpdir 2, expected 1'], 'A default scratchBase in logicalRead');
  const imports = copyScope(t);
  insertBefore(imports, 'storage-lane.mjs', "import { httpsLoopback, run } from './lib.mjs';", "import { NEEDS } from './storage-rows.selftest.mjs';");
  assert.deepEqual(problems(imports), ['storage-lane.mjs: imports a self-test file']);
  // R2-04 (A-SH-04): a bare side-effect import of a self-test in each quote form, and again the existing forms.
  for (const line of ["import './storage-x.selftest.mjs';", 'import "./storage-x.selftest.mjs"', "import'./storage-x.selftest.mjs';",
    "import * as x from './storage-x.selftest.mjs';", 'import x from "./storage-x.selftest.mjs";', "export { a } from './storage-x.selftest.mjs';",
    "export * from './storage-x.selftest.mjs';", "const x = await import('./storage-x.selftest.mjs');"]) {
    const dir = copyScope(t);
    insertBefore(dir, 'storage-lane.mjs', "import { httpsLoopback, run } from './lib.mjs';", line);
    assert.deepEqual(problems(dir), ['storage-lane.mjs: imports a self-test file'], line);
  }
  const bare = copyScope(t);
  insertBefore(bare, 'storage-rows.mjs', "import { m1HostControl } from './m1-control.mjs';", "import './storage-docker.mjs';");
  assert.deepEqual(problems(bare), [], 'A bare import of a runtime module is allowed');
  const comment = copyScope(t);
  insertBefore(comment, 'storage-handoff.mjs', 'export const WINDOW_FORM', '// a comment that says mkdtemp(');
  assert.deepEqual(problems(comment), ['storage-handoff.mjs: mkdtemp 1, expected 0'], 'A match in a comment also counts');
});
