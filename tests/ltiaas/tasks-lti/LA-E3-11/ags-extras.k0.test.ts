// LA-E3-11 K0 / host-only suite (no Docker).
// Sources:
// - docs/architecture/ltiaas/tasks/LA-E3-11.md (AC-LA-E3-11-03, AC-LA-E3-11-05 UNIT; exclusive file rules)
// - docs/architecture/ltiaas/adr/LA-ADR-05-lti-advantage-completeness.md D9
// - docs/architecture/ltiaas/contracts/lti-service-api-delta.md §4.3
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
  'services/lti-service/src/http/routes/services.ts',
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

describe('LA-E3-11 K0: AGS extras (submission times, scoringUserId, URL-keyed members)', () => {
  it('AC-LA-E3-11-03 & AC-LA-E3-11-05 (static check): ags.ts and routes support submission, scoringUserId, and bounded https URL-keyed members', () => {
    const agsSrc = readRepoFile('services/lti-service/src/platform/ags.ts');
    const servicesSrc = readRepoFile('services/lti-service/src/http/routes/services.ts');
    const compatSrc = readRepoFile('services/lti-service/src/http/routes/compat.ts');
    const combined = `${agsSrc}\n${servicesSrc}\n${compatSrc}`;

    expect(combined.includes('submission'), 'supports submission field on score POST').toBe(true);
    expect(combined.includes('startedAt'), 'supports submission.startedAt').toBe(true);
    expect(combined.includes('submittedAt'), 'supports submission.submittedAt').toBe(true);
    expect(combined.includes('scoringUserId'), 'supports scoringUserId on score POST and result GET').toBe(true);
    expect(/https:/i.test(combined), 'checks https: protocol for URL-keyed extension members').toBe(true);
    expect(/4096|4_096|4\s*\*\s*1024/.test(combined), 'enforces 4 KB (4096 UTF-8 bytes) per extension value').toBe(true);
  });

  it('F1 (lms-names) and F5 (rules) checks pass on LA-E3-11 core files with 0 hits', () => {
    for (const relPath of TASK_CORE_FILES) {
      expect(isF1Core(relPath), `${relPath} is an F1 core path`).toBe(true);
      const src = readRepoFile(relPath);
      const f1 = checkF1OnText(relPath, src);
      expect(f1.code, `${relPath} passes F1 check`).toBe(0);
      expect(f1.rawHits, `${relPath} must have 0 F1 hits`).toEqual([]);

      const f5 = checkF5OnText(relPath, src);
      expect(f5.code, `${relPath} passes F5 check`).toBe(0);
    }
  });

  it('AC-LA-E3-11-03 & AC-LA-E3-11-05 (UNIT): Author unit tests in services/lti-service/src/platform and http/routes pass', () => {
    const unitRes = spawnSync(
      'npx',
      [
        '--no-install',
        'vitest',
        'run',
        '--reporter=verbose',
        'services/lti-service/src/platform',
        'services/lti-service/src/http/routes/compat.test.ts',
      ],
      {
        cwd: TARGET_ROOT,
        env: plainEnv(),
        encoding: 'utf8',
        timeout: 90_000,
      },
    );
    expect(unitRes.status, 'platform & compat unit tests exit 0').toBe(0);
  });
});
