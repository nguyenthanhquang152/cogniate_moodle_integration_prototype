// LA-E5-18 K0 / host-only suite (no Docker).
// Sources:
// - docs/architecture/ltiaas/tasks/LA-E5-18.md (AC-LA-E5-18-04 UNIT, exclusive file rules)
// - docs/architecture/ltiaas/adr/LA-ADR-06-service-operability.md D10 (row "Tenant id in logs")
// - docs/architecture/ltiaas/contracts/lti-service-api-delta.md §6
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
  'services/lti-service/src/lti/login.ts',
  'services/lti-service/src/lti/launch.ts',
  'services/lti-service/src/http/routes/protocol.ts',
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

describe('LA-E5-18 K0: Tenant ids in protocol log lines', () => {
  it('Static check: login.ts, launch.ts and protocol.ts log tool_account_id and platform_id on login_rejected, launch_check_failed, launch_claims_minimized and launch_accepted', () => {
    const loginSrc = readRepoFile('services/lti-service/src/lti/login.ts');
    const launchSrc = readRepoFile('services/lti-service/src/lti/launch.ts');
    const protocolSrc = readRepoFile('services/lti-service/src/http/routes/protocol.ts');
    const combinedLaunchAndProtocol = `${launchSrc}\n${protocolSrc}`;

    expect(loginSrc.includes('login_rejected'), 'login.ts emits login_rejected event').toBe(true);
    expect(
      loginSrc.includes('tool_account_id') || loginSrc.includes('tenantLogIds'),
      'login.ts includes tool_account_id or tenantLogIds helper when account is known',
    ).toBe(true);

    expect(
      combinedLaunchAndProtocol.includes('launch_check_failed'),
      'launch/protocol emits launch_check_failed event',
    ).toBe(true);
    expect(
      combinedLaunchAndProtocol.includes('launch_claims_minimized'),
      'launch/protocol emits launch_claims_minimized event',
    ).toBe(true);
    expect(
      combinedLaunchAndProtocol.includes('launch_accepted'),
      'launch/protocol emits launch_accepted event',
    ).toBe(true);
    expect(launchSrc.includes('tool_account_id'), 'launch.ts includes tool_account_id').toBe(true);
    expect(launchSrc.includes('platform_id'), 'launch.ts includes platform_id').toBe(true);
    expect(
      combinedLaunchAndProtocol.includes('binding'),
      'launch/protocol includes binding on launch_accepted',
    ).toBe(true);
  });

  it('F1 (lms-names) and F5 (rules) checks pass on login.ts and launch.ts', () => {
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

  it('AC-LA-E5-18-04 (UNIT): Author unit tests in services/lti-service/src/lti and http/routes/protocol.test.ts pass', () => {
    const unitRes = spawnSync(
      'npx',
      [
        '--no-install',
        'vitest',
        'run',
        '--reporter=verbose',
        'services/lti-service/src/lti/login.test.ts',
        'services/lti-service/src/lti/launch.test.ts',
        'services/lti-service/src/lti/storage-check.test.ts',
        'services/lti-service/src/http/routes/protocol.test.ts',
      ],
      {
        cwd: TARGET_ROOT,
        env: plainEnv(),
        encoding: 'utf8',
        timeout: 90_000,
      },
    );
    expect(unitRes.status, 'login, storage-check & protocol unit tests exit 0').toBe(0);
  });
});
