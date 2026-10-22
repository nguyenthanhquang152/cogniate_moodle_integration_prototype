// LA-E3-03 K0 / host-only suite (no Docker).
// Sources:
// - docs/architecture/ltiaas/tasks/LA-E3-03.md (AC-LA-E3-03-07 UNIT, AC-LA-E3-03-08 UNIT, exclusive file rules)
// - docs/architecture/ltiaas/adr/LA-ADR-05-lti-advantage-completeness.md D2
// - docs/architecture/ltiaas/adr/LA-ADR-03-learning-record-core.md D2
// - docs/architecture/ltiaas/contracts/lti-service-api-delta.md §4.1
// Boolean assertions only; never prints product source.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { f1Hits, isF1Core, plainEnv } from '../../tasks-core/LA-E1-04/fitness';

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(here, '../../../..');
const TARGET_ROOT = path.resolve(
  process.env.LA_TARGET_ROOT ?? process.env.QA_REPO_ROOT ?? process.env.LA_SCRATCH_CLONE ?? DEFAULT_ROOT,
);

const TASK_CORE_FILES: readonly string[] = [
  'services/lti-service/src/lti/service-keys.ts',
  'services/cogniate-app/src/tool-pages/launch.ts',
];

function readRepoFile(relPath: string): string {
  const abs = path.join(TARGET_ROOT, relPath);
  expect(fs.existsSync(abs), `Expected file to exist: ${relPath}`).toBe(true);
  return fs.readFileSync(abs, 'utf8');
}

function checkF1OnText(
  asPath: string,
  text: string,
): { code: number | null; output: string; rawHits: ReturnType<typeof f1Hits> } {
  const realRes = spawnSync('npm', ['run', '--silent', 'fitness:lms-names', '--', '--stdin', '--as', asPath], {
    cwd: TARGET_ROOT,
    env: plainEnv(),
    input: text,
    encoding: 'utf8',
    timeout: 60_000,
  });
  const probePath = `services/lti-service/src/lti/zz-f1-probe-${path.basename(asPath)}`;
  const probeRes = spawnSync('npm', ['run', '--silent', 'fitness:lms-names', '--', '--stdin', '--as', probePath], {
    cwd: TARGET_ROOT,
    env: plainEnv(),
    input: text,
    encoding: 'utf8',
    timeout: 60_000,
  });
  const realOutput = `${realRes.stdout ?? ''}${realRes.stderr ?? ''}`;
  const probeOutput = `${probeRes.stdout ?? ''}${probeRes.stderr ?? ''}`;
  const rawHits = f1Hits(probeOutput).filter((h) => h.path === probePath);
  return { code: realRes.status, output: `${realOutput}\n${probeOutput}`.trim(), rawHits };
}

function checkF5OnText(asPath: string, text: string): { code: number | null; output: string } {
  const res = spawnSync('npm', ['run', '--silent', 'fitness:rules', '--', '--stdin', '--as', asPath], {
    cwd: TARGET_ROOT,
    env: plainEnv(),
    input: text,
    encoding: 'utf8',
    timeout: 60_000,
  });
  return { code: res.status, output: `${res.stdout ?? ''}${res.stderr ?? ''}`.trim() };
}

describe('LA-E3-03 K0: Launch without context (D2)', () => {
  it('Static check: service-keys.ts and tool-pages/launch.ts support launch without context using empty context id and title', () => {
    const serviceKeysSrc = readRepoFile('services/lti-service/src/lti/service-keys.ts');
    const appLaunchSrc = readRepoFile('services/cogniate-app/src/tool-pages/launch.ts');

    expect(
      serviceKeysSrc.includes('serviceKeyForLaunch'),
      'service-keys.ts defines serviceKeyForLaunch',
    ).toBe(true);
    expect(
      serviceKeysSrc.includes("''") || serviceKeysSrc.includes('""'),
      'service-keys.ts defaults missing context id to empty string',
    ).toBe(true);

    expect(
      appLaunchSrc.includes('not_resource_link'),
      'tool-pages/launch.ts keeps not_resource_link check for non-resource-link launches',
    ).toBe(true);
    expect(
      appLaunchSrc.includes("''") || appLaunchSrc.includes('""'),
      'tool-pages/launch.ts defaults missing context id/title to empty string',
    ).toBe(true);
  });

  it('F1 (lms-names) and F5 (rules) checks pass on LA-E3-03 core files', () => {
    const baselinePath = path.join(TARGET_ROOT, 'infra/scripts/fitness/f1-baseline.json');
    const parsedBaseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8')) as
      | { counts?: Record<string, number> }
      | Record<string, number>;
    const counts: Record<string, number> =
      typeof parsedBaseline.counts === 'object' && parsedBaseline.counts !== null
        ? parsedBaseline.counts
        : (parsedBaseline as Record<string, number>);

    for (const relPath of TASK_CORE_FILES) {
      expect(isF1Core(relPath), `${relPath} is an F1 core path`).toBe(true);
      const src = readRepoFile(relPath);
      const f1 = checkF1OnText(relPath, src);
      expect(f1.code, `${relPath} passes F1 check`).toBe(0);
      const maxAllowed = counts[relPath] ?? 0;
      expect(
        f1.rawHits.length <= maxAllowed,
        `${relPath} F1 hits must not exceed f1-baseline.json count`,
      ).toBe(true);

      const f5 = checkF5OnText(relPath, src);
      expect(f5.code, `${relPath} passes F5 check`).toBe(0);
    }
  });

  it('AC-LA-E3-03-07 & AC-LA-E3-03-08 (UNIT): Author unit tests in services/lti-service/src/lti/service-keys.test.ts and services/cogniate-app/src/tool-pages/launch.test.ts pass', () => {
    const unitRes = spawnSync(
      'npx',
      [
        '--no-install',
        'vitest',
        'run',
        '--reporter=verbose',
        'services/lti-service/src/lti/service-keys.test.ts',
        'services/lti-service/src/http/routes/services.test.ts',
        'services/cogniate-app/src/tool-pages/launch.test.ts',
      ],
      {
        cwd: TARGET_ROOT,
        env: plainEnv(),
        encoding: 'utf8',
        timeout: 120_000,
      },
    );
    expect(unitRes.status, 'service-keys and tool-pages/launch unit tests exit 0').toBe(0);
  });
});
