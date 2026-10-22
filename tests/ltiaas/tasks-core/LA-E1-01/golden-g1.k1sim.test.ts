// LA-E1-01 AC-LA-E1-01-03 (K1-SIM): golden G1 `GET /app-api/lms-providers` and the connection DTOs equal the
// G-BASE baseline. No `LA-IC` expected-delta file applies: E1-01 adds no wire field (the new fields come with
// LA-E1-02, LA-E1-06 and LA-E1-10).
//
// Thin binding to the lead QA's golden tool (LA-E0-03, tests/ltiaas/golden/**; TEST-STRATEGY §4.6). Lead answer
// "A" (2026-10-22): bind now, and set the BINDING below when LA-E0-03 publishes its CLI and report format.
// Run order (README.md in this folder):
//   1. Booked SIM slot: the LA-E0-03 capture at the task SHA on project qa3-la-sim-r<n> (TEST-STRATEGY §5.2)
//      writes a capture folder. Then the stack goes down.
//   2. No Docker: this test compares that capture with the G-BASE capture.
// Input (environment): LA_GOLDEN_CAPTURE (capture folder of the task SHA), LA_GOLDEN_BASELINE (G-BASE capture
// folder, tests/ltiaas/golden/<baseline-sha>/), LA_RUN_DIR (private folder for the report; must exist).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

process.umask(0o077);

interface Binding {
  /** The compare command of LA-E0-03 for two capture folders, with no expected-delta folder. */
  compare?: (baseline: string, capture: string) => { cmd: string; args: string[] };
  /** The field paths that the compare report prints as different (AC-LA-E0-03-06). */
  differingPaths?: (report: string) => string[];
  /** The document ids inside one capture folder, so that a missing document never passes as "no difference". */
  documents?: (captureDir: string) => string[];
}

// BINDING: fill from tests/ltiaas/golden/README.md when LA-E0-03 lands. Until then this test fails on purpose.
const BINDING: Binding = {};

// The G1 documents of this AC (TEST-STRATEGY §4.6 G1). Adjust only the spelling to the capture layout of LA-E0-03.
const AC_DOCUMENTS = [/^G1[./]app-api[./]lms-providers\b/, /^G1[./]connections?\b/];

describe('LA-E1-01 K1-SIM', () => {
  it('AC-LA-E1-01-03: golden G1 lms-providers and connection DTOs equal the G-BASE baseline', () => {
    expect(BINDING.compare && BINDING.differingPaths && BINDING.documents, 'binding pending: LA-E0-03 golden tool (tests/ltiaas/golden/README.md)').toBeTruthy();
    const capture = process.env.LA_GOLDEN_CAPTURE ?? '';
    const baseline = process.env.LA_GOLDEN_BASELINE ?? '';
    const runDir = process.env.LA_RUN_DIR ?? '';
    for (const [name, dir] of [['LA_GOLDEN_CAPTURE', capture], ['LA_GOLDEN_BASELINE', baseline], ['LA_RUN_DIR', runDir]]) {
      expect(dir !== '' && fs.existsSync(dir), `${name} names an existing folder`).toBe(true);
    }
    for (const dir of [baseline, capture]) {
      const docs = BINDING.documents!(dir);
      for (const re of AC_DOCUMENTS) expect(docs.some((d) => re.test(d)), `${dir} holds a document that matches ${re}`).toBe(true);
    }
    const { cmd, args } = BINDING.compare!(baseline, capture);
    const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const report = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    fs.writeFileSync(path.join(runDir, 'golden-compare-report.txt'), report, { mode: 0o600, flag: 'wx' });
    const diffs = BINDING.differingPaths!(report);
    const acDiffs = diffs.filter((p) => AC_DOCUMENTS.some((re) => re.test(p)));
    // Other G1–G4 differences are the step's regression information; qa.md lists them, this AC does not judge them.
    fs.writeFileSync(path.join(runDir, 'golden-diff-paths.json'), `${JSON.stringify({ acDiffs, otherDiffs: diffs.filter((p) => !acDiffs.includes(p)) }, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    expect(acDiffs, 'differing fields in G1 lms-providers or the connection DTOs').toEqual([]);
    if (diffs.length === 0) expect(r.status, 'compare exit code with no difference').toBe(0);
  });
});
