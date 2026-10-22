// LA-E3-12 K0 / host-only suite (no Docker).
// Sources:
// - docs/architecture/ltiaas/tasks/LA-E3-12.md (AC-LA-E3-12-04 UNIT, exclusive file rules)
// - docs/architecture/ltiaas/adr/LA-ADR-05-lti-advantage-completeness.md D10
// - docs/architecture/ltiaas/adr/LA-ADR-07-security-and-tenancy.md D8
// - docs/architecture/ltiaas/contracts/lti-service-api-delta.md §4.3, §4.4, §4.6
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
  'services/lti-service/src/platform/ags.ts',
  'services/lti-service/src/platform/nrps.ts',
  'services/lti-service/src/lti/checks.ts',
  'services/lti-service/src/store/platforms.ts',
  'services/lti-service/src/http/routes/platforms.ts',
];

function readRepoFile(relPath: string): string {
  const abs = path.join(TARGET_ROOT, relPath);
  expect(fs.existsSync(abs), `Expected file to exist: ${relPath}`).toBe(true);
  return fs.readFileSync(abs, 'utf8');
}

function findTrustedAudiencesMigration(): { relPath: string; content: string } | null {
  const migDir = path.join(TARGET_ROOT, 'services/lti-service/src/db/migrations');
  if (!fs.existsSync(migDir)) return null;
  const files = fs
    .readdirSync(migDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const f of files) {
    const relPath = `services/lti-service/src/db/migrations/${f}`;
    const content = fs.readFileSync(path.join(migDir, f), 'utf8');
    if (content.includes('trusted_audiences')) {
      return { relPath, content };
    }
  }
  return null;
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

describe('LA-E3-12 K0: Small spec gaps (scoreGiven: null, NRPS service_versions, trustedAudiences)', () => {
  it('Static check: nrps.ts checks service_versions for 2.0, and checks.ts / platforms.ts / migration add trustedAudiences', () => {
    const nrpsSrc = readRepoFile('services/lti-service/src/platform/nrps.ts');
    const checksSrc = readRepoFile('services/lti-service/src/lti/checks.ts');
    const storePlatformsSrc = readRepoFile('services/lti-service/src/store/platforms.ts');
    const routePlatformsSrc = readRepoFile('services/lti-service/src/http/routes/platforms.ts');

    // NR-01: NRPS service_versions check for '2.0'
    const combinedNrps = `${nrpsSrc}\n${readRepoFile('services/lti-service/src/http/routes/services.ts')}\n${readRepoFile('services/lti-service/src/http/routes/compat.ts')}`;
    expect(combinedNrps.includes('service_versions'), 'checks NRPS service_versions').toBe(true);
    expect(combinedNrps.includes('2.0'), 'checks for NRPS version 2.0').toBe(true);
    expect(combinedNrps.includes('SERVICE_NOT_AVAILABLE'), 'returns SERVICE_NOT_AVAILABLE when 2.0 is absent').toBe(true);

    // S-08: trustedAudiences in checks.ts, store/platforms.ts, http/routes/platforms.ts, and migration
    expect(checksSrc.includes('trustedAudiences'), 'checks.ts checks trustedAudiences in check 5').toBe(true);
    expect(storePlatformsSrc.includes('trusted_audiences'), 'store/platforms.ts stores trusted_audiences').toBe(true);
    expect(storePlatformsSrc.includes('trustedAudiences'), 'store/platforms.ts maps trustedAudiences').toBe(true);
    expect(routePlatformsSrc.includes('trustedAudiences'), 'http/routes/platforms.ts accepts trustedAudiences').toBe(true);

    const mig = findTrustedAudiencesMigration();
    expect(Boolean(mig), 'LTI migration adding trusted_audiences to platform exists').toBe(true);
    expect(/platform/i.test(mig!.content), 'migration alters platform table').toBe(true);
    expect(/trusted_audiences/i.test(mig!.content), 'migration adds trusted_audiences column').toBe(true);
  });

  it('F1 (lms-names) and F5 (rules) checks pass on LA-E3-12 core files and migration', () => {
    const mig = findTrustedAudiencesMigration();
    expect(Boolean(mig), 'trusted_audiences migration must exist').toBe(true);

    const baselinePath = path.join(TARGET_ROOT, 'infra/scripts/fitness/f1-baseline.json');
    const parsedBaseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8')) as
      | { counts?: Record<string, number> }
      | Record<string, number>;
    const counts: Record<string, number> =
      typeof parsedBaseline.counts === 'object' && parsedBaseline.counts !== null
        ? parsedBaseline.counts
        : (parsedBaseline as Record<string, number>);

    for (const relPath of [...TASK_CORE_FILES, mig!.relPath]) {
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

  it('AC-LA-E3-12-04 (UNIT): Author unit tests for platforms, checks, ags and nrps pass', () => {
    const unitRes = spawnSync(
      'npx',
      [
        '--no-install',
        'vitest',
        'run',
        '--reporter=verbose',
        'services/lti-service/src/platform',
        'services/lti-service/src/lti/checks.test.ts',
        'services/lti-service/src/store/platforms.test.ts',
        'services/lti-service/src/http/routes/platforms.test.ts',
        'services/lti-service/src/http/routes/compat.test.ts',
      ],
      {
        cwd: TARGET_ROOT,
        env: plainEnv(),
        encoding: 'utf8',
        timeout: 90_000,
      },
    );
    expect(unitRes.status, 'platforms, checks, ags, nrps & compat unit tests exit 0').toBe(0);
  });
});
