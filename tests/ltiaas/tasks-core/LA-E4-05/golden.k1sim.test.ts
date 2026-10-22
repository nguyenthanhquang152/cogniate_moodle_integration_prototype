// LA-E4-05 AC-LA-E4-05-05 (K1-SIM; pending: Docker window):
// On the SIM lane with the default settings (runner in the web process), the score rows of the golden script equal
// the golden G3.
// Source: docs/architecture/ltiaas/tasks/LA-E4-05.md (AC-LA-E4-05-05); TEST-STRATEGY.md §4.6 G3.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cliBinding } from '../../golden/lib/compare.mjs';
import { spawnSync } from 'node:child_process';

const G3_DOCUMENTS = [/^G3\b/];

describe('LA-E4-05 K1-SIM (pending: Docker window)', () => {
  it('AC-LA-E4-05-05: on the SIM lane with default settings (runner in web process), golden G3 score rows equal the baseline', () => {
    const capture = process.env.LA_GOLDEN_CAPTURE ?? '';
    const baseline = process.env.LA_GOLDEN_BASELINE ?? '';
    const runDir = process.env.LA_RUN_DIR ?? '';
    const expectedDelta = process.env.LA_EXPECTED_DELTA;

    for (const [name, p] of [
      ['LA_GOLDEN_CAPTURE', capture],
      ['LA_GOLDEN_BASELINE', baseline],
      ['LA_RUN_DIR', runDir],
    ]) {
      expect(p !== '' && fs.existsSync(p), `${name} names an existing folder`).toBe(true);
    }

    for (const dir of [baseline, capture]) {
      const docs = cliBinding.documents(dir);
      for (const re of G3_DOCUMENTS) {
        expect(docs.some((d) => re.test(d)), `${dir} holds a document matching ${re}`).toBe(true);
      }
    }

    const { cmd, args } = cliBinding.compare(baseline, capture, expectedDelta);
    const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const reportText = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    fs.writeFileSync(path.join(runDir, 'e4-05-ac05-golden-report.txt'), reportText, { mode: 0o600, flag: 'wx' });

    const diffs = cliBinding.differingPaths(reportText);
    const g3Diffs = diffs.filter((p) => G3_DOCUMENTS.some((re) => re.test(p)));
    fs.writeFileSync(
      path.join(runDir, 'e4-05-ac05-golden-diff-paths.json'),
      `${JSON.stringify({ g3Diffs, otherDiffs: diffs.filter((p) => !g3Diffs.includes(p)) }, null, 2)}\n`,
      { mode: 0o600, flag: 'wx' },
    );
    expect(g3Diffs, 'unexplained differing fields in G3').toEqual([]);
  });
});
