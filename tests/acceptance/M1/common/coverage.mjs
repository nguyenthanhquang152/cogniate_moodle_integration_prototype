import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

export const LABELS = ['SIM', 'MOODLE-LIVE', 'CANVAS-LOCAL', 'CANVAS-HOSTED', 'BLACKBOARD-LIVE', 'DOC'];
// AC-level allocation is independent of test discovery. Named races below are
// mandatory rows, so a one-test-per-AC enum implementation cannot satisfy it.
export const REQUIRED = {
  common: [1, 2, 3, 7, 12, 14, 15, 19, 21, 23, 24, 25, 30, 35, 39],
  blackboard: [1, 4, 5, 6, 7, 10, 11, 12, 13, 14, 15, 18, 19, 21, 22, 27, 28, 29, 31, 33, 34, 36, 37, 38],
  canvas: [4, 5, 7, 8, 9, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 25, 26, 29, 31, 32, 33, 34, 36, 37, 38, 39, 40],
};
export const RACES = {
  blackboard: {
    37: ['a', 'b', 'd', 'e', 'f', 'g', 'i', 'j', 'k-after-a', 'k-after-b', 'l', 'm', 'n', 'o', 'q', 'r'],
    38: ['a', 'b', 'c', 'e', 'g-existing', 'g-absent'],
  },
  canvas: {
    37: ['c', 'c2', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'm', 'n',
      'p-create', 'p-activate', 'q', 'r', 's-retry', 's-dead', 's-compensation',
      't', 'u-after-c', 'u-after-c2'],
    38: ['a', 'b', 'd', 'e', 'f', 'f-held-delete', 'g-late-create'],
  },
};
export function readManifests(testsDir, owners = ['common', 'blackboard', 'canvas']) {
  const rows = [], ids = new Set();
  for (const owner of owners) {
    const file = path.join(testsDir, 'acceptance', 'M1', owner, 'manifest.json');
    assert.ok(fs.existsSync(file), `Required ${owner} manifest is missing: ${file}`);
    const entries = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.ok(Array.isArray(entries) && entries.length > 0, `Required ${owner} suite is empty`);
    for (const entry of entries) {
      assert.match(entry.id, new RegExp(`^M1-\\d{2}\\.${owner}\\.[a-z0-9-]+$`));
      assert.equal(entry.ac, 'AC-' + entry.id.split('.')[0], `AC mismatch: ${entry.id}`);
      assert.ok(!ids.has(entry.id), `Duplicate case: ${entry.id}`); ids.add(entry.id);
      assert.ok(LABELS.includes(entry.environment), `Evidence label missing: ${entry.id}`);
      assert.ok(['api', 'host', 'browser'].includes(entry.kind), `Case kind missing: ${entry.id}`);
      assert.ok(typeof entry.title === 'string' && entry.title.trim(), `Case title missing: ${entry.id}`);
      assert.ok(typeof entry.file === 'string' && !path.isAbsolute(entry.file)
        && !entry.file.split(/[\\/]/).includes('..'), `Unsafe file: ${entry.id}`);
      assert.ok(fs.existsSync(path.join(testsDir, entry.file)), `Case file missing: ${entry.id}`);
      rows.push(entry);
    }
    for (const number of REQUIRED[owner]) {
      const ac = 'AC-M1-' + String(number).padStart(2, '0');
      assert.ok(entries.some((e) => e.ac === ac), `Required ${owner} criterion missing: ${ac}`);
    }
    for (const [number, variants] of Object.entries(RACES[owner] ?? {})) {
      for (const variant of variants) assert.ok(entries.some((e) =>
        e.id === `M1-${number}.${owner}.${variant}` || e.ac === `AC-M1-${number}` && e.subcase === variant),
      `Required ${owner} race variant missing: M1-${number} ${variant}`);
    }
  }
  return rows;
}
export function verifyResults(expected, actual, { productSha, testSha } = {}) {
  assert.ok(expected.length > 0, 'Empty expected selection');
  assert.match(productSha ?? '', /^[0-9a-f]{40}$/, 'Product SHA required');
  assert.match(testSha ?? '', /^[0-9a-f]{40}$/, 'Test SHA required');
  const seen = new Map();
  for (const row of actual) {
    assert.ok(!seen.has(row.id), `Duplicate result ${row.id}`);
    assert.equal(row.productSha, productSha, `Mixed product SHA: ${row.id}`);
    assert.equal(row.testSha, testSha, `Mixed test SHA: ${row.id}`);
    seen.set(row.id, row);
  }
  for (const row of expected) {
    const result = seen.get(row.id);
    assert.ok(result, `Missing result: ${row.id}`);
    assert.equal(result.environment, row.environment, `Mixed evidence label: ${row.id}`);
    assert.equal(result.status, 'PASS', `Required case is not PASS: ${row.id} (${result.status})`);
  }
  return true;
}
export function vitestResults(report, expected, identity, { partial = false } = {}) {
  const byId = new Map(expected.map((e) => [e.id, e]));
  return report.testResults.flatMap((file) => file.assertionResults.flatMap((test) => {
    const id = test.fullName.match(/\{case:([^}]+)\}/)?.[1];
    // A shared bootstrap file can contain another provider's cases. Only an
    // explicitly partial selection may omit those, and only when not executed.
    if (partial && id && !byId.has(id) && ['pending', 'skipped', 'todo'].includes(test.status)) return [];
    assert.ok(id && byId.has(id), `Unmanifested test: ${test.fullName}`);
    return { id, environment: byId.get(id).environment, ...identity,
      status: test.status === 'passed' ? 'PASS' : test.status === 'failed'
        ? (test.failureMessages ?? []).some((s) => /BLOCKED:/.test(s)) ? 'BLOCKED' : 'FAIL' : 'SKIP',
      title: test.fullName, duration: test.duration };
  }));
}
export function playwrightResults(report, expected, identity, { partial = false } = {}) {
  const byId = new Map(expected.map((row) => [row.id, row]));
  const rows = [];
  const visit = (suite) => {
    for (const spec of suite.specs ?? []) for (const result of spec.tests ?? []) {
      const id = spec.title.match(/\{case:([^}]+)\}/)?.[1];
      if (partial && id && !byId.has(id) && result.status === 'skipped') continue;
      assert.ok(id && byId.has(id), 'Unmanifested browser case: ' + spec.title);
      rows.push({ id, environment: byId.get(id).environment, ...identity, title: spec.title,
        status: result.status === 'expected' && result.expectedStatus === 'passed'
          && result.results?.length === 1 && result.results[0].status === 'passed'
          ? 'PASS' : result.status === 'skipped' ? 'SKIP' : 'FAIL' });
    }
    for (const child of suite.suites ?? []) visit(child);
  };
  for (const suite of report.suites ?? []) visit(suite);
  return rows;
}
