// Host side: per-AC rows from the Vitest JSON report of one in-container pass of a QA-2 suite.
// tests/host/lib.mjs readTestReports knows only the older id forms, so the QA-2 runners map their ids here.
// Later QA-2 runners import this file; they do not copy it.
import fs from 'node:fs';
import path from 'node:path';

export const QA2_ID = /^(AC-LA-E\d+-\d+-\d+|LA-E\d+-\d+-[A-Z0-9]+)\b/;

export function vitestRows(dir) {
  const file = path.join(dir, 'vitest-results.json');
  if (!fs.existsSync(file)) return [];
  const rows = [];
  for (const f of JSON.parse(fs.readFileSync(file, 'utf8')).testResults ?? []) {
    for (const t of f.assertionResults ?? []) {
      rows.push({
        id: QA2_ID.exec(t.title)?.[1] ?? 'UNMAPPED',
        title: t.title,
        status: t.status === 'passed' ? 'PASS' : t.status === 'failed' ? 'FAIL' : 'SKIP',
        ms: t.duration ?? null,
        failure: (t.failureMessages ?? []).join('\n'),
      });
    }
  }
  return rows;
}

/**
 * One runner row per test that ran, plus a FAIL row for each expected id that did not run (a skip is "not run").
 * Skipped tests (for example the tests of the other U1 phase) get one INFO line, not a row: in the core summary a
 * SKIP row would hide the PASS of the same id in another pass.
 */
export function recordRows(r, label, dir, expected) {
  const rows = vitestRows(dir);
  const evidence = [path.relative(r.QA_TESTS_DIR, dir)];
  for (const row of rows.filter((x) => x.status !== 'SKIP')) {
    const notes = [`${row.ms ?? '?'} ms`, ...(row.status === 'FAIL' ? [row.failure.split('\n')[0]] : [])];
    r.record(row.id, `[${label}] ${row.title}`, row.status, notes, evidence);
  }
  const skipped = rows.filter((x) => x.status === 'SKIP').map((x) => x.id);
  if (skipped.length) r.record('INFO', `[${label}] skipped in this pass: ${skipped.join(', ')}`, 'INFO');
  const ran = new Set(rows.filter((row) => row.status !== 'SKIP').map((row) => row.id));
  for (const id of expected.filter((x) => !ran.has(x))) r.record(id, `[${label}] expected to run but did not run`, 'FAIL', [], evidence);
  return rows;
}
