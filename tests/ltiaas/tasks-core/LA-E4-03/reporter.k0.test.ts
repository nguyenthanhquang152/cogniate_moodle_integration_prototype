// LA-E4-03 K0 and UNIT-row verification (no Docker):
// - Verifies `npm run check` (R0) exits 0 on the clean tree, `services/cogniate-app/src/drivers/lti-ags/` exists,
//   `services/cogniate-app/src/worker/` is removed, and F1/F5 pass.
// - Runs the Author UNIT rows (`vitest run -t "AC-LA-E4-03-"`) for AC-LA-E4-03-01 (including LA-IC-15 / BD-A1-27
//   per-channel 409 conflict text "{LMS} has a grade with a newer time"), AC-LA-E4-03-06 (read-back guard
//   `records.readBack`), AC-LA-E4-03-07 (disabled `operatorGrant` connection -> `CONNECTION_DISABLED`, Resend/refresh ->
//   `409 CONNECTION_NOT_READY`), and AC-LA-E4-03-08 (outbox refuses reporter policy other than `bestResult`).
// Source: docs/architecture/ltiaas/tasks/LA-E4-03.md (at f01bfcd); LA-ADR-03 D5, D6, D7, D8, D9; LA-ADR-04 D8
// LA-IC-11, LA-IC-15; cogniate-app-api-delta.md §6, §8; build-decisions-A1.md BD-A1-27.
// QA-3 wrote these tests from the spec, contracts and ADRs only (test-first).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  ROOT,
  artifact,
  git,
  npmCheck,
  requireRunDir,
  requireScratchClone,
  run,
  scriptEchoes,
  type RunResult,
} from '../LA-E1-04/fitness';

const DRIVER_DIR_REL = 'services/cogniate-app/src/drivers/lti-ags';
const REMOVED_WORKER_DIR_REL = 'services/cogniate-app/src/worker';

interface LoadedChannel {
  folder: string;
  manifest: {
    id: string;
    names: { text: string; label: string };
    capabilities?: Record<string, unknown>;
  };
}

interface KernelSurface {
  loadChannelFolders(roots: readonly string[], side: 'lti' | 'app'): Promise<LoadedChannel[]>;
}

let clean: RunResult;
let loadedById: Map<string, LoadedChannel>;

beforeAll(async () => {
  requireScratchClone();
  requireRunDir();
  clean = await npmCheck('e4-03-check-clean');
  const kernelEntry = pathToFileURL(path.join(ROOT, 'packages/channel-kernel/src/index.ts')).href;
  const kernel = (await import(kernelEntry)) as KernelSurface;
  const loaded = await kernel.loadChannelFolders([path.join(ROOT, 'packages/channels')], 'app');
  loadedById = new Map(loaded.map((c) => [c.manifest.id, c]));
});

describe('LA-E4-03 lti-ags record reporter, throttling, and read-back guard (K0 + UNIT rows)', () => {
  it('R0 & file layout: npm run check exits 0, drivers/lti-ags exists, worker/ is removed, and baseline channels declare lti-ags + readBack + LA-IC-15 names.text', () => {
    expect(clean.code, `npm run check exits 0 on clean tree:\n${clean.output}`).toBe(0);
    const echoes = scriptEchoes(clean.output);
    expect(echoes.some((s) => /fitness:lms-names|lms-names/.test(s)), 'npm run check ran F1').toBe(true);
    expect(echoes.some((s) => /fitness:rules/.test(s)), 'npm run check ran F5').toBe(true);

    // `services/cogniate-app/src/drivers/lti-ags/` exists.
    const driverAbs = path.join(ROOT, DRIVER_DIR_REL);
    expect(fs.existsSync(driverAbs) && fs.statSync(driverAbs).isDirectory(), `${DRIVER_DIR_REL} directory exists`).toBe(
      true,
    );

    // `services/cogniate-app/src/worker/` is removed on disk and in git.
    const workerAbs = path.join(ROOT, REMOVED_WORKER_DIR_REL);
    const workerTracked = git(['ls-files', REMOVED_WORKER_DIR_REL]).trim();
    expect(workerTracked, `${REMOVED_WORKER_DIR_REL} has no tracked files in git`).toBe('');
    expect(fs.existsSync(workerAbs), `${REMOVED_WORKER_DIR_REL} does not exist on disk`).toBe(false);

    // Baseline channels declare `records.reporters: ['lti-ags']`, `records.readBack: true`, and `names.text` for LA-IC-15 (BD-A1-27).
    const expectedTexts: Record<string, string> = {
      moodle: 'Moodle has a grade with a newer time',
      canvas: 'Canvas has a grade with a newer time',
      blackboard: 'Blackboard has a grade with a newer time',
    };
    for (const [channelId, expectedConflictText] of Object.entries(expectedTexts)) {
      const ch = loadedById.get(channelId);
      expect(ch, `baseline channel ${channelId} is loaded`).toBeDefined();
      expect(`${ch!.manifest.names.text} has a grade with a newer time`).toBe(expectedConflictText);
      expect(ch!.manifest.capabilities?.['records.reporters']).toEqual(['lti-ags']);
      expect(ch!.manifest.capabilities?.['records.readBack']).toBe(true);
    }
  });

  it('AC-LA-E4-03-01, AC-LA-E4-03-06, AC-LA-E4-03-07, AC-LA-E4-03-08: Author unit tests for each UNIT AC pass', async () => {
    const unitRes = await run(
      'npx',
      ['--no-install', 'vitest', 'run', '--reporter=verbose', '-t', 'AC-LA-E4-03-'],
      { timeoutMs: 5 * 60_000 },
    );
    artifact('e4-03-unit-rows.log', unitRes.output);
    expect(unitRes.code, `vitest run -t "AC-LA-E4-03-" exits 0:\n${unitRes.output}`).toBe(0);

    for (const acId of ['AC-LA-E4-03-01', 'AC-LA-E4-03-06', 'AC-LA-E4-03-07', 'AC-LA-E4-03-08']) {
      expect(unitRes.output, `unit test output cites ${acId}`).toContain(acId);
    }
  });
});
