// QA-3 binding to the lead QA's golden tool (LA-E0-03, tests/ltiaas/golden/**; TEST-STRATEGY §4.6). One copy, imported
// by the golden ACs of LA-E1-01 (AC-03), LA-E1-02 (AC-09) and LA-E1-06 (AC-05). Lead answer "A" (2026-10-22): bind
// now, and set BINDING when LA-E0-03 publishes its CLI and report format. Until then every caller fails on purpose.
//
// Run order (README.md of each caller): (1) booked SIM slot: the LA-E0-03 capture at the task SHA on project
// qa3-la-sim-r<n> (TEST-STRATEGY §5.2) writes a capture folder, then the stack goes down; (2) no Docker: the caller
// compares that capture with the G-BASE capture.
// Input (environment): LA_GOLDEN_CAPTURE (capture folder of the task SHA), LA_GOLDEN_BASELINE (G-BASE capture folder,
// tests/ltiaas/golden/<baseline-sha>/), LA_RUN_DIR (private folder for the report; must exist).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { expect } from 'vitest';

export interface Binding {
  /** The compare command of LA-E0-03 for two capture folders and an optional expected-delta file. */
  compare?: (baseline: string, capture: string, expectedDelta?: string) => { cmd: string; args: string[] };
  /** The field paths that the compare report prints as different and not explained by the expected delta (AC-LA-E0-03-06, -08). */
  differingPaths?: (report: string) => string[];
  /** The document ids inside one capture folder, so that a missing document never passes as "no difference". */
  documents?: (captureDir: string) => string[];
}

// BINDING: fill from tests/ltiaas/golden/README.md when LA-E0-03 lands.
export const BINDING: Binding = {};

/** G1 `GET /app-api/lms-providers` and the connection DTOs (TEST-STRATEGY §4.6 G1). Adjust only the spelling to the capture layout. */
export const G1_PROVIDERS_AND_CONNECTIONS = [/^G1[./]app-api[./]lms-providers\b/, /^G1[./]connections?\b/];

/**
 * Compares the capture of the task SHA with the G-BASE capture. With `expectedDelta` (an `LA-IC` expected-delta file),
 * only differences named in that file pass, and a named change that is missing fails (AC-LA-E0-03-08).
 * Fails on any unexplained difference inside `acDocuments`; other differences go to the artifact for the regression row.
 */
export function expectGoldenEqual(label: string, acDocuments: RegExp[], expectedDelta?: string): void {
  expect(BINDING.compare && BINDING.differingPaths && BINDING.documents, 'binding pending: LA-E0-03 golden tool (tests/ltiaas/golden/README.md)').toBeTruthy();
  const capture = process.env.LA_GOLDEN_CAPTURE ?? '';
  const baseline = process.env.LA_GOLDEN_BASELINE ?? '';
  const runDir = process.env.LA_RUN_DIR ?? '';
  for (const [name, p] of [['LA_GOLDEN_CAPTURE', capture], ['LA_GOLDEN_BASELINE', baseline], ['LA_RUN_DIR', runDir]]) {
    expect(p !== '' && fs.existsSync(p), `${name} names an existing folder`).toBe(true);
  }
  if (expectedDelta !== undefined) expect(fs.existsSync(expectedDelta), `expected-delta file ${expectedDelta} exists`).toBe(true);
  for (const dir of [baseline, capture]) {
    const docs = BINDING.documents!(dir);
    for (const re of acDocuments) expect(docs.some((d) => re.test(d)), `${dir} holds a document that matches ${re}`).toBe(true);
  }
  const { cmd, args } = BINDING.compare!(baseline, capture, expectedDelta);
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const report = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  fs.writeFileSync(path.join(runDir, `${label}-golden-report.txt`), report, { mode: 0o600, flag: 'wx' });
  const diffs = BINDING.differingPaths!(report);
  const acDiffs = diffs.filter((p) => acDocuments.some((re) => re.test(p)));
  // Other G1–G4 differences are the step's regression information; qa.md lists them, the AC does not judge them.
  fs.writeFileSync(path.join(runDir, `${label}-golden-diff-paths.json`),
    `${JSON.stringify({ acDiffs, otherDiffs: diffs.filter((p) => !acDiffs.includes(p)) }, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  expect(acDiffs, `unexplained differing fields in ${acDocuments.join(', ')}`).toEqual([]);
  if (diffs.length === 0) expect(r.status, 'compare exit code with no difference').toBe(0);
}
