// LA-E4-05 K0 and UNIT-row verification (no Docker):
// - Verifies `npm run check` (R0) exits 0 on the clean tree, `services/cogniate-app/src/worker-main.ts` exists,
//   and `services/cogniate-app/package.json` defines the `worker` script.
// - Runs the Author UNIT rows (`vitest run -t "AC-LA-E4-05-"`) for:
//   - AC-LA-E4-05-01: With `APP_JOB_RUNNER=off`, the web process serves pages and API and logs no `job_run` line; a
//     score stays `pending`.
//   - AC-LA-E4-05-02: `npm run worker` alone (with the web process off) sends the pending score; the row becomes `sent`.
//   - AC-LA-E4-05-03: In the `production` profile, a worker start while a live `web` runner row exists (and a web start
//     while a live `worker` row exists) exits 1 with `config_refused {reason: "job_runner_twice"}`.
//   - AC-LA-E4-05-04: Two runner processes with distinct instance ids on one database send each due row once (no
//     duplicate score POST in the test LTI client).
// Source: docs/architecture/ltiaas/tasks/LA-E4-05.md (at f01bfcd); LA-ADR-03 D7; operability.md; data-model.md §3.
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

const WORKER_MAIN_REL = 'services/cogniate-app/src/worker-main.ts';
const APP_PKG_REL = 'services/cogniate-app/package.json';

let clean: RunResult;

beforeAll(async () => {
  requireScratchClone();
  requireRunDir();
  clean = await npmCheck('e4-05-check-clean');
});

describe('LA-E4-05 worker process mode and production refusal (K0 + UNIT rows)', () => {
  it('R0 & worker entry point: npm run check exits 0, worker-main.ts exists, and cogniate-app package.json defines the worker script', () => {
    expect(clean.code, `npm run check exits 0 on clean tree:\n${clean.output}`).toBe(0);
    const echoes = scriptEchoes(clean.output);
    expect(echoes.some((s) => /fitness:lms-names|lms-names/.test(s)), 'npm run check ran F1').toBe(true);
    expect(echoes.some((s) => /fitness:rules/.test(s)), 'npm run check ran F5').toBe(true);

    expect(fs.existsSync(path.join(ROOT, WORKER_MAIN_REL)), `${WORKER_MAIN_REL} exists`).toBe(true);
    const appPkg = JSON.parse(fs.readFileSync(path.join(ROOT, APP_PKG_REL), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    expect(typeof appPkg.scripts?.worker, `${APP_PKG_REL} defines scripts.worker`).toBe('string');
    expect(appPkg.scripts!.worker).toContain('worker-main');
  });

  it('AC-LA-E4-05-01, AC-LA-E4-05-02, AC-LA-E4-05-03, AC-LA-E4-05-04: Author unit tests for each UNIT AC pass', async () => {
    const unitRes = await run(
      'npx',
      ['--no-install', 'vitest', 'run', '--reporter=verbose', '-t', 'AC-LA-E4-05-'],
      { timeoutMs: 5 * 60_000 },
    );
    artifact('e4-05-unit-rows.log', unitRes.output);
    expect(unitRes.code, `vitest run -t "AC-LA-E4-05-" exits 0:\n${unitRes.output}`).toBe(0);

    for (const acId of ['AC-LA-E4-05-01', 'AC-LA-E4-05-02', 'AC-LA-E4-05-03', 'AC-LA-E4-05-04']) {
      expect(unitRes.output, `unit test output cites ${acId}`).toContain(acId);
    }
  });
});
