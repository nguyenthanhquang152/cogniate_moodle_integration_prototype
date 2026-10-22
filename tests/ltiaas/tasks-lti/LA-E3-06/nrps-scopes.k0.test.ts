// LA-E3-06 K0 / host-only suite (no Docker).
// Sources:
// - docs/architecture/ltiaas/tasks/LA-E3-06.md (AC-LA-E3-06-04 UNIT, exclusive file rules)
// - docs/architecture/ltiaas/adr/LA-ADR-05-lti-advantage-completeness.md D4
// - docs/architecture/ltiaas/contracts/lti-service-api-delta.md §4.5, §5 (registration.complete)
// - docs/architecture/ltiaas/adr/LA-ADR-06-service-operability.md D4
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
  'services/lti-service/src/lti/registration.ts',
  'services/lti-service/src/http/routes/registration.ts',
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

describe('LA-E3-06 K0: NRPS scope complete.scopes and registration.complete audit event', () => {
  it('AC-LA-E3-06-04 (static check): registration.ts and http/routes/registration.ts support complete.scopes and registration.complete audit', () => {
    const regSrc = readRepoFile('services/lti-service/src/lti/registration.ts');
    const routeSrc = readRepoFile('services/lti-service/src/http/routes/registration.ts');
    const combined = `${regSrc}\n${routeSrc}`;

    // 1. Optional scopes field on complete and validation against the 5 ADR-009 scopes and scopes_supported.
    expect(/\bscopes\b/.test(combined), 'complete supports optional scopes field').toBe(true);
    expect(combined.includes('INVALID_REQUEST'), 'complete rejects invalid scopes with INVALID_REQUEST').toBe(true);
    expect(
      combined.includes('https://purl.imsglobal.org/spec/lti-ags/scope/lineitem'),
      'recognises AGS lineitem scope',
    ).toBe(true);
    expect(
      combined.includes('https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly'),
      'recognises AGS lineitem.readonly scope',
    ).toBe(true);
    expect(
      combined.includes('https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly'),
      'recognises AGS result.readonly scope',
    ).toBe(true);
    expect(
      combined.includes('https://purl.imsglobal.org/spec/lti-ags/scope/score'),
      'recognises AGS score scope',
    ).toBe(true);
    expect(
      combined.includes('https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly'),
      'recognises NRPS contextmembership.readonly scope',
    ).toBe(true);

    // 2. Audit action registration.complete on target type registration (contract delta §5).
    expect(
      routeSrc.includes('registration.complete'),
      'http/routes/registration.ts writes audit action registration.complete',
    ).toBe(true);
    expect(
      /['"]registration['"]/.test(routeSrc),
      'http/routes/registration.ts uses target type registration',
    ).toBe(true);
  });

  it('F1 (lms-names) check: registration.ts and http/routes/registration.ts pass fitness:lms-names and do not exceed f1-baseline.json counts', () => {
    const baselinePath = path.join(TARGET_ROOT, 'infra/scripts/fitness/f1-baseline.json');
    expect(fs.existsSync(baselinePath), 'infra/scripts/fitness/f1-baseline.json must exist').toBe(true);

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
      expect(f1.code, `${relPath} passes F1 check; output:\n${f1.output}`).toBe(0);
      const maxAllowed = counts[relPath] ?? 0;
      expect(
        f1.rawHits.length,
        `F1 hits in ${relPath} (${f1.rawHits.length}) must not exceed baseline (${maxAllowed})`,
      ).toBeLessThanOrEqual(maxAllowed);
    }
  });

  it('AC-LA-E3-06-04 (UNIT): Author unit tests in services/lti-service pass', () => {
    const unitRes = spawnSync(
      'npx',
      [
        '--no-install',
        'vitest',
        'run',
        '--reporter=verbose',
        'services/lti-service/src/lti',
        'services/lti-service/src/http',
      ],
      {
        cwd: TARGET_ROOT,
        env: plainEnv(),
        encoding: 'utf8',
        timeout: 90_000,
      },
    );
    const unitOutput = `${unitRes.stdout ?? ''}${unitRes.stderr ?? ''}`;
    expect(unitRes.status, `lti & http unit tests exit 0; output:\n${unitOutput}`).toBe(0);
  });
});
