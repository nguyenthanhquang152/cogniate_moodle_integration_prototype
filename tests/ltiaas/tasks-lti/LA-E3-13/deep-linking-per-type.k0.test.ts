// LA-E3-13 K0 / host-only suite (no Docker).
// Sources:
// - docs/architecture/ltiaas/tasks/LA-E3-13.md (AC-LA-E3-13-01, AC-LA-E3-13-02 UNIT; exclusive file rules)
// - docs/architecture/ltiaas/adr/LA-ADR-05-lti-advantage-completeness.md D3e
// - docs/architecture/ltiaas/contracts/lti-service-api-delta.md §4.2 ("Per type" row)
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

const TASK_FILE = 'services/lti-service/src/lti/deep-linking.ts';

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

describe('LA-E3-13 K0: Deep Linking per-type item fields (D3e)', () => {
  it('AC-LA-E3-13-01 & AC-LA-E3-13-02 (static check): deep-linking.ts validates https url for link/file/image and string html for html items', () => {
    const dlSrc = readRepoFile(TASK_FILE);

    expect(dlSrc.includes('link'), 'deep-linking.ts checks link type').toBe(true);
    expect(dlSrc.includes('file'), 'deep-linking.ts checks file type').toBe(true);
    expect(dlSrc.includes('image'), 'deep-linking.ts checks image type').toBe(true);
    expect(dlSrc.includes('html'), 'deep-linking.ts checks html type and field').toBe(true);
    expect(/https:/i.test(dlSrc), 'deep-linking.ts validates https: protocol on item url').toBe(true);
    expect(dlSrc.includes('INVALID_CONTENT_ITEM'), 'deep-linking.ts rejects invalid items with INVALID_CONTENT_ITEM').toBe(
      true,
    );
  });

  it('F1 (lms-names) and F5 (rules) checks pass on deep-linking.ts with 0 hits', () => {
    expect(isF1Core(TASK_FILE), `${TASK_FILE} is an F1 core path`).toBe(true);
    const src = readRepoFile(TASK_FILE);
    const f1 = checkF1OnText(TASK_FILE, src);
    expect(f1.code, `${TASK_FILE} passes F1 check`).toBe(0);
    expect(f1.rawHits, `${TASK_FILE} must have 0 F1 hits`).toEqual([]);

    const f5 = checkF5OnText(TASK_FILE, src);
    expect(f5.code, `${TASK_FILE} passes F5 check`).toBe(0);
  });

  it('AC-LA-E3-13-01 & AC-LA-E3-13-02 (UNIT): Author unit tests in services/lti-service/src/lti/deep-linking.test.ts and http/routes/compat.test.ts pass', () => {
    const unitRes = spawnSync(
      'npx',
      [
        '--no-install',
        'vitest',
        'run',
        '--reporter=verbose',
        'services/lti-service/src/lti/deep-linking.test.ts',
        'services/lti-service/src/http/routes/compat.test.ts',
      ],
      {
        cwd: TARGET_ROOT,
        env: plainEnv(),
        encoding: 'utf8',
        timeout: 90_000,
      },
    );
    expect(unitRes.status, 'deep-linking & compat unit tests exit 0').toBe(0);
  });
});
