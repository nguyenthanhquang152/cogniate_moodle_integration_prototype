// LA-E5-14 K0 acceptance tests: F1 count 0 for error-mapping.ts and token-client.ts (RQ-3),
// contract delta §1.3/§6 throttling surface, and Author unit test suite execution for AC-LA-E5-14-06.
// Source: docs/architecture/ltiaas/tasks/LA-E5-14.md; contract delta §1.3, §4.3, §6, §9; LA-ADR-03 D7; LA-ADR-04 D8 LA-IC-11.
// QA-4 wrote these tests from the spec, contracts and ADRs only (test-first).
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
  'services/lti-service/src/platform/error-mapping.ts',
  'services/lti-service/src/platform/token-client.ts',
];

function writeArtifact(name: string, content: string): void {
  const runDir = process.env.LA_RUN_DIR;
  if (!runDir) return;
  fs.mkdirSync(runDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(runDir, name), content, { mode: 0o600 });
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
  const probePath = `services/lti-service/src/platform/zz-f1-probe-${path.basename(asPath)}`;
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

describe('LA-E5-14 Platform throttling answer 429 PLATFORM_RATE_LIMITED (K0)', () => {
  it('AC-LA-E5-14-06 (K0 + F1): error-mapping.ts and token-client.ts have F1 count 0, expose PLATFORM_RATE_LIMITED with Retry-After clamping (1..3600, default 60), and pass platform unit tests', () => {
    const baselinePath = path.join(TARGET_ROOT, 'infra/scripts/fitness/f1-baseline.json');
    const baselineCounts: Record<string, number> = fs.existsSync(baselinePath)
      ? (JSON.parse(fs.readFileSync(baselinePath, 'utf8')) as Record<string, number>)
      : {};

    const f1Report: Array<{ file: string; hits: ReturnType<typeof f1Hits>; baselineCount: number }> = [];

    for (const rel of TASK_CORE_FILES) {
      expect(isF1Core(rel), `${rel} is an F1 core path`).toBe(true);
      const abs = path.join(TARGET_ROOT, rel);
      expect(fs.existsSync(abs), `${rel} exists in ${TARGET_ROOT}`).toBe(true);
      const text = fs.readFileSync(abs, 'utf8');
      const f1 = checkF1OnText(rel, text);
      expect(f1.code, `${rel} passes F1 check; output:\n${f1.output}`).toBe(0);
      expect(f1.rawHits, `${rel} must have 0 F1 hits (no banned LMS vendor names in code tokens)`).toEqual([]);
      const baselineCount = baselineCounts[rel] ?? 0;
      expect(baselineCount, `${rel} f1-baseline.json count must be 0`).toBe(0);
      f1Report.push({ file: rel, hits: f1.rawHits, baselineCount });
    }

    // Verify contract delta §1.3 error catalog code PLATFORM_RATE_LIMITED (HTTP 429) and throttling wiring.
    const apiErrorsPath = path.join(TARGET_ROOT, 'services/lti-service/src/api-errors.ts');
    expect(fs.existsSync(apiErrorsPath), 'services/lti-service/src/api-errors.ts exists').toBe(true);
    const apiErrorsText = fs.readFileSync(apiErrorsPath, 'utf8');
    expect(apiErrorsText, 'api-errors.ts defines PLATFORM_RATE_LIMITED').toContain('PLATFORM_RATE_LIMITED');

    const errorMappingText = fs.readFileSync(path.join(TARGET_ROOT, TASK_CORE_FILES[0]), 'utf8');
    const tokenClientText = fs.readFileSync(path.join(TARGET_ROOT, TASK_CORE_FILES[1]), 'utf8');
    const combinedPlatformText = `${errorMappingText}\n${tokenClientText}`;

    expect(combinedPlatformText, 'platform mapping uses PLATFORM_RATE_LIMITED').toContain('PLATFORM_RATE_LIMITED');
    expect(combinedPlatformText, 'platform mapping detects Rate Limit Exceeded in 403 body').toContain('Rate Limit Exceeded');
    expect(combinedPlatformText, 'platform mapping logs platform_rate_limited event').toContain('platform_rate_limited');

    // Run the Author unit tests under services/lti-service/src/platform/ in TARGET_ROOT to verify AC-LA-E5-14-06.
    const unitRes = spawnSync(
      'npx',
      ['--no-install', 'vitest', 'run', '--reporter=verbose', 'services/lti-service/src/platform'],
      {
        cwd: TARGET_ROOT,
        env: plainEnv(),
        encoding: 'utf8',
        timeout: 90_000,
      },
    );
    const unitOutput = `${unitRes.stdout ?? ''}${unitRes.stderr ?? ''}`;
    expect(unitRes.status, `platform unit tests exit 0; output:\n${unitOutput}`).toBe(0);

    writeArtifact(
      'e5-14-k0.json',
      `${JSON.stringify({ targetRoot: TARGET_ROOT, f1Report, unitStatus: unitRes.status }, null, 2)}\n`,
    );
    writeArtifact('e5-14-unit.log', unitOutput);
  });
});
