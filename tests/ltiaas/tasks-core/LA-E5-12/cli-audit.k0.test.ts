// LA-E5-12 K0 and UNIT-row verification (no Docker):
// - Verifies `npm run check` (R0) exits 0 on the clean tree, and F1/F5 pass.
// - Runs the Author UNIT rows (`vitest run -t "AC-LA-E5-12-"`) for:
//   - AC-LA-E5-12-08: When the local change of a command fails inside its transaction, no audit event is stored.
//   - Also checks any Author unit tests for BD-A2-45 (`evaluateOperatorPolicy`, `operators_ambiguous`, `connectionId`
//     on every grant and binding event).
// Source: docs/architecture/ltiaas/tasks/LA-E5-12.md (at f01bfcd); LA-ADR-07 D4, D5; LA-ADR-06 D4 rule 4;
// cogniate-app-api-delta.md §7; build-decisions-A2.md BD-A2-45.
// QA-3 wrote these tests from the spec, contracts and ADRs only (test-first).
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  ROOT,
  artifact,
  npmCheck,
  requireRunDir,
  requireScratchClone,
  run,
  scriptEchoes,
  type RunResult,
} from '../LA-E1-04/fitness';

const CLI_FILES = [
  'services/cogniate-app/src/app/operator.ts',
  'services/cogniate-app/src/cli/grant.ts',
  'services/cogniate-app/src/cli/binding.ts',
  'services/cogniate-app/src/cli/audit.ts',
] as const;

let clean: RunResult;

beforeAll(async () => {
  requireScratchClone();
  requireRunDir();
  clean = await npmCheck('e5-12-check-clean');
});

describe('LA-E5-12 app CLI wiring: --operator, evidence flags, audit events (K0 + UNIT rows)', () => {
  it('R0 & CLI entry points: npm run check exits 0 and all app operator CLI files exist', () => {
    expect(clean.code, `npm run check exits 0 on clean tree:\n${clean.output}`).toBe(0);
    const echoes = scriptEchoes(clean.output);
    expect(echoes.some((s) => /fitness:lms-names|lms-names/.test(s)), 'npm run check ran F1').toBe(true);
    expect(echoes.some((s) => /fitness:rules/.test(s)), 'npm run check ran F5').toBe(true);

    for (const rel of CLI_FILES) {
      expect(fs.existsSync(path.join(ROOT, rel)), `${rel} exists`).toBe(true);
    }
  });

  it('AC-LA-E5-12-08, BD-A1-67, BD-A2-45/59/63/64: Author unit tests for transactional rollback of audit events, operator policy seam, evidenceRequired false on revoke, and stable refused-event codes pass', async () => {
    const unitRes = await run(
      'npx',
      [
        '--no-install',
        'vitest',
        'run',
        '--reporter=verbose',
        'services/cogniate-app/src/app/operator-audit.test.ts',
        'services/cogniate-app/src/app/operator-texts.test.ts',
      ],
      { timeoutMs: 5 * 60_000 },
    );
    artifact('e5-12-unit-rows.log', unitRes.output);
    expect(unitRes.code, `operator-audit and operator-texts unit suites exit 0:\n${unitRes.output}`).toBe(0);
    for (const marker of ['AC-LA-E5-12-08', 'BD-A2-63', 'AP-07-04', 'AP-07-06', 'AP-07-09', 'operators_ambiguous']) {
      expect(unitRes.output, `unit test output cites ${marker}`).toContain(marker);
    }
  });
});
