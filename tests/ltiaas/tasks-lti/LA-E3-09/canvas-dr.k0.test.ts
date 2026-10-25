// LA-E3-09 K0 / host-only suite (no Docker).
// Sources:
// - docs/architecture/ltiaas/tasks/LA-E3-09.md (AC-LA-E3-09-05 UNIT + design notes)
// - docs/architecture/ltiaas/adr/LA-ADR-05-lti-advantage-completeness.md D6
// - docs/architecture/ltiaas/adr/LA-ADR-02-generic-lti-channel.md D2, D5 (items 2, 4, 8, 10)
// - docs/architecture/ltiaas/adr/LA-ADR-04-refactor-and-migration.md D8 LA-IC-14
// - docs/architecture/ltiaas/contracts/lti-service-api-delta.md §2.4, §4.5
// - docs/architecture/ltiaas/build-decisions-A1.md (BD-A1-105, BD-A1-106, BD-A1-109)
// - docs/architecture/ltiaas/build-decisions-A2.md (BD-A2-89, BD-A2-92, BD-A2-93, BD-A2-94, BD-A2-95)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { f1Hits, plainEnv } from '../../tasks-core/LA-E1-04/fitness';

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(here, '../../../..');
const TARGET_ROOT = path.resolve(
  process.env.LA_TARGET_ROOT ?? process.env.QA_REPO_ROOT ?? process.env.LA_SCRATCH_CLONE ?? DEFAULT_ROOT,
);

function readQaFile(relPath: string): string {
  const abs = path.join(TARGET_ROOT, relPath);
  expect(fs.existsSync(abs), `Expected QA file to exist: ${relPath}`).toBe(true);
  return fs.readFileSync(abs, 'utf8');
}

describe('LA-E3-09 K0: Canvas Dynamic Registration in LTI service (profile rule + staged)', () => {
  it('LA-IC-14 & LA-IC-04 contract and golden expected-delta verification', () => {
    const k0ContractSrc = readQaFile('tests/ltiaas/k0/contract.test.ts');
    const laIc14Raw = readQaFile('tests/ltiaas/golden/expected/LA-IC-14.json');
    const laIc04Raw = readQaFile('tests/ltiaas/golden/expected/LA-IC-04.json');

    expect(
      /canvas:\s*\{[\s\S]*?dynamicRegistration:\s*true\b/.test(k0ContractSrc),
      'tests/ltiaas/k0/contract.test.ts sets M1_BASELINE_LEGACY_FLAGS.canvas.dynamicRegistration: true (LA-IC-14)',
    ).toBe(true);

    const laIc14 = JSON.parse(laIc14Raw) as {
      id: string;
      ld9: { goldenFields: string[]; frozenTestsTouched: string[] };
      changes: Array<{ doc: string; path: string }>;
    };
    expect(laIc14.id).toBe('LA-IC-14');
    expect(laIc14.ld9.goldenFields).toHaveLength(13);
    expect(laIc14.changes).toHaveLength(13);
    expect(laIc14.ld9.frozenTestsTouched.length).toBeGreaterThanOrEqual(3);

    const laIc04 = JSON.parse(laIc04Raw) as {
      id: string;
      ld9: { goldenFields: string[]; frozenTestsTouched: string[] };
      changes: Array<{ doc: string; path: string }>;
    };
    expect(laIc04.id).toBe('LA-IC-04');
    expect(laIc04.ld9.goldenFields).toHaveLength(3);
    expect(laIc04.changes).toHaveLength(3);

    const goldenRes = spawnSync('node', ['--test', 'tests/ltiaas/golden/golden.k0.test.mjs'], {
      cwd: TARGET_ROOT,
      env: plainEnv(),
      encoding: 'utf8',
      timeout: 60_000,
    });
    const goldenOutput = `${goldenRes.stdout ?? ''}${goldenRes.stderr ?? ''}`;
    expect(goldenRes.status, `golden.k0.test.mjs exits 0; output:\n${goldenOutput}`).toBe(0);
  });

  it('F1 (lms-names) and F5 (rules) fitness checks pass across the repository with negative-control probes', () => {
    const f1Repo = spawnSync('npm', ['run', '--silent', 'fitness:lms-names'], {
      cwd: TARGET_ROOT,
      env: plainEnv(),
      encoding: 'utf8',
      timeout: 60_000,
    });
    const f1RepoOut = `${f1Repo.stdout ?? ''}${f1Repo.stderr ?? ''}`;
    expect(f1Repo.status, `fitness:lms-names exits 0; output:\n${f1RepoOut}`).toBe(0);

    // Negative control: an LMS vendor name in a core LTI registration path must trigger F1
    const probePath = 'services/lti-service/src/lti/registration.ts';
    const f1Probe = spawnSync(
      'npm',
      ['run', '--silent', 'fitness:lms-names', '--', '--stdin', '--as', probePath],
      {
        cwd: TARGET_ROOT,
        env: plainEnv(),
        input: "export const badVendor = 'https://canvas.instructure.com/lti/vendor';\n",
        encoding: 'utf8',
        timeout: 60_000,
      },
    );
    const f1ProbeOut = `${f1Probe.stdout ?? ''}${f1Probe.stderr ?? ''}`;
    expect(f1Probe.status, 'F1 negative-control probe on core LTI file must exit non-zero').not.toBe(0);
    expect(f1Hits(f1ProbeOut).some((h) => h.path === probePath)).toBe(true);

    const f5Repo = spawnSync('npm', ['run', '--silent', 'fitness:rules'], {
      cwd: TARGET_ROOT,
      env: plainEnv(),
      encoding: 'utf8',
      timeout: 60_000,
    });
    const f5RepoOut = `${f5Repo.stdout ?? ''}${f5Repo.stderr ?? ''}`;
    expect(f5Repo.status, `fitness:rules exits 0; output:\n${f5RepoOut}`).toBe(0);
  });

  it('AC-LA-E3-09-05 (UNIT) + Author unit suites (profiles/canvas, profiles/traits, lti/registration, http/routes/registration, channel-kernel/profiles) and K0 contract suite pass', () => {
    fs.rmSync(path.join(TARGET_ROOT, 'node_modules/.vitest-cache'), { recursive: true, force: true });
    fs.rmSync(path.join(TARGET_ROOT, 'node_modules/.vite'), { recursive: true, force: true });
    fs.rmSync(path.join(TARGET_ROOT, 'node_modules/.vite-temp'), { recursive: true, force: true });

    const unitRes = spawnSync(
      'npx',
      [
        '--no-install',
        'vitest',
        'run',
        '--reporter=verbose',
        'services/lti-service/src/profiles/canvas.test.ts',
        'services/lti-service/src/profiles/traits.test.ts',
        'services/lti-service/src/lti/registration.test.ts',
        'services/lti-service/src/http/routes/registration.test.ts',
        'packages/channel-kernel/src/profiles.test.ts',
      ],
      {
        cwd: TARGET_ROOT,
        env: plainEnv(),
        encoding: 'utf8',
        timeout: 120_000,
      },
    );
    const unitOutput = `${unitRes.stdout ?? ''}${unitRes.stderr ?? ''}`;
    expect(unitRes.status, `LA-E3-09 unit tests exit 0; output:\n${unitOutput}`).toBe(0);
    expect(
      unitOutput.includes('AC-LA-E3-09-05'),
      'http/routes/registration.test.ts executes AC-LA-E3-09-05 mixed-registry pre-fetch floor test',
    ).toBe(true);
    expect(
      unitOutput.includes('toolConfigurationExtensions'),
      'unit suites verify toolConfigurationExtensions (BD-A1-105, BD-A1-109)',
    ).toBe(true);

    fs.rmSync(path.join(TARGET_ROOT, 'node_modules/.vitest-cache'), { recursive: true, force: true });
    fs.rmSync(path.join(TARGET_ROOT, 'node_modules/.vite'), { recursive: true, force: true });

    const k0Res = spawnSync('npm', ['run', '--silent', 'test:k0'], {
      cwd: TARGET_ROOT,
      env: plainEnv(),
      encoding: 'utf8',
      timeout: 120_000,
    });
    const k0Output = `${k0Res.stdout ?? ''}${k0Res.stderr ?? ''}`;
    expect(k0Res.status, `npm run test:k0 exits 0; output:\n${k0Output}`).toBe(0);
  });
});
