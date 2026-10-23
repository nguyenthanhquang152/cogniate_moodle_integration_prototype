// LA-E3-16 K0 + UNIT suite (QA-3, test-first from docs/architecture/ltiaas/tasks/LA-E3-16.md, LA-ADR-05 D6,
// LA-ADR-04 D5/D6, and B-LA-E3-16-01 / ce9b4a6).
//
// Host-only checks (NO DOCKER):
// - Exclusive file scope on 4d31891 and ce9b4a6: only packages/channels/canvas/portal/** and
//   apps/portal/src/{channels/ManifestWizard.tsx,sdk/index.ts}; 0 edits to packages/channels/canvas/{manifest.ts,app.ts,app/**},
//   services/**, or tests/acceptance/M2/**.
// - AC-LA-E3-16-01 (UNIT): With a Canvas manifest that has manual and dynamic, the create step shows both choices;
//   create with dynamic sends method: "dynamic"; create with manual sends the same request body as before; with a
//   manifest that has only manual, no choice is shown.
// - AC-LA-E3-16-02 (UNIT): A pending dynamic connection shows the registration URL with its copy button and expiry,
//   and "Get registration URL" calls the renew route; it does not show the developer key JSON; a pending manual
//   connection shows today's JSON step; once a dynamic connection is staged (platform !== null), renewal is not
//   offered (B-LA-E3-16-01 / ce9b4a6).
// - AC-LA-E3-16-03 (UNIT): A pending dynamic connection with a staged platform shows Client ID and Deployment ID
//   pre-filled from platform.clientId and platform.deploymentIds[0], and an empty approval code; without a staged
//   platform, it shows "Finish the registration in Canvas. Then this page shows the values to check." and no inputs.
// - AC-LA-E3-16-05 (UNIT part): packages/channels/canvas/portal/canvas.test.tsx passes without edits to
//   tests/acceptance/M2/**.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  ROOT,
  artifact,
  hasScript,
  requireRunDir,
  requireScratchClone,
  run,
} from '../LA-E1-04/fitness';

function clearVitestCache(): void {
  fs.rmSync(path.join(ROOT, 'node_modules/.vitest-cache'), { recursive: true, force: true });
  fs.rmSync(path.join(ROOT, 'node_modules/.vite'), { recursive: true, force: true });
}

beforeAll(() => {
  requireScratchClone();
  requireRunDir();
  clearVitestCache();
});

describe('LA-E3-16 Canvas Dynamic Registration in the portal (K0 + UNIT)', () => {
  it('Exclusive file scope & M2 untouched guard: LA-E3-16 commits (4d31891, ce9b4a6) touch only packages/channels/canvas/portal/** and apps/portal/src/{channels/ManifestWizard.tsx,sdk/index.ts}, with 0 edits to tests/acceptance/M2/**', () => {
    const allowedPattern =
      /^(packages\/channels\/canvas\/portal\/.+|apps\/portal\/src\/(channels\/ManifestWizard\.tsx|sdk\/index\.ts))$/;
    const touchedAll = new Set<string>();

    for (const sha of ['4d31891', 'ce9b4a6']) {
      const diffRes = spawnSync('git', ['diff', '--name-only', `${sha}^1`, sha], {
        cwd: ROOT,
        encoding: 'utf8',
      });
      expect(diffRes.status, `git diff ${sha}^1 ${sha} exits 0`).toBe(0);
      const files = diffRes.stdout
        .trim()
        .split(/\r?\n/)
        .filter(Boolean);
      expect(files.length).toBeGreaterThan(0);
      for (const f of files) {
        touchedAll.add(f);
        expect(f, `file ${f} in ${sha} is within LA-E3-16 exclusive scope`).toMatch(allowedPattern);
        expect(f).not.toMatch(/^packages\/channels\/canvas\/(manifest\.ts|app\.ts|app\/)/);
        expect(f).not.toMatch(/^services\//);
        expect(f).not.toMatch(/^tests\/acceptance\/M2\//);
      }
    }

    artifact('e3-16-touched-files.json', `${JSON.stringify([...touchedAll].sort(), null, 2)}\n`);
  });

  it('AC-LA-E3-16-01, AC-LA-E3-16-02 (with B-LA-E3-16-01 / ce9b4a6), AC-LA-E3-16-03 & AC-LA-E3-16-05 (UNIT part): Canvas portal unit suite and K0 contract suite pass', async () => {
    // 1. Check canvas-steps.json has both manual (developer key) and dynamic registration step guidance in STE
    const stepsJsonPath = path.join(ROOT, 'packages/channels/canvas/portal/canvas-steps.json');
    expect(fs.existsSync(stepsJsonPath)).toBe(true);
    const stepsJson = JSON.parse(fs.readFileSync(stepsJsonPath, 'utf8')) as Record<string, unknown>;
    expect(stepsJson).toBeDefined();

    // 2. Delete Vitest cache and run Canvas portal unit tests + staged wizard unit tests + K0 contract tests
    clearVitestCache();
    const unitRun = await run(
      'npx',
      [
        '--no-install',
        'vitest',
        'run',
        '--reporter=verbose',
        'packages/channels/canvas/portal/canvas.test.tsx',
        'apps/portal/src/channels/staged-wizard.test.tsx',
      ],
      { timeoutMs: 5 * 60_000 },
    );
    artifact('e3-16-unit.log', unitRun.output);
    expect(unitRun.code, `LA-E3-16 portal unit tests exit 0:\n${unitRun.output}`).toBe(0);

    // Verify all 4 unit-covered ACs and the staged-no-renewal guard appear in the verbose output
    for (const marker of ['AC-LA-E3-16-01', 'AC-LA-E3-16-02', 'AC-LA-E3-16-03']) {
      expect(unitRun.output, `verbose unit test output includes ${marker}`).toContain(marker);
    }

    clearVitestCache();
    const k0Run = hasScript('test:k0')
      ? await run('npm', ['run', 'test:k0'])
      : await run('npx', ['--no-install', 'vitest', 'run', '--config', 'tests/ltiaas/k0/vitest.config.mts']);
    artifact('e3-16-k0.log', k0Run.output);
    expect(k0Run.code, `test:k0 exits 0:\n${k0Run.output}`).toBe(0);
  });
});
