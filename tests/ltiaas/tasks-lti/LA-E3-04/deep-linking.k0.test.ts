// LA-E3-04 K0 acceptance tests: F1 count 0 for all 4 task files (RQ-3),
// contract delta §4.1/§4.2 Deep Linking service completeness surface (D3a, D3c, D3d),
// and Author unit test suite execution for AC-LA-E3-04-03, AC-LA-E3-04-06, AC-LA-E3-04-07.
// Source: docs/architecture/ltiaas/tasks/LA-E3-04.md (at 4c11521); LA-ADR-05 D3; contract delta §4.1, §4.2; LA-ADR-04 D8 LA-IC-12.
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
  'services/lti-service/src/lti/deep-linking.ts',
  'services/lti-service/src/lti/idtoken.ts',
  'services/lti-service/src/http/routes/services.ts',
  'services/lti-service/src/http/routes/compat.ts',
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

describe('LA-E3-04 Deep Linking completeness: service part (K0)', () => {
  it('AC-LA-E3-04-03, AC-LA-E3-04-06, AC-LA-E3-04-07 (K0 + F1): task files have F1 count 0, expose acceptLineItem/acceptMediaTypes and accept_lineitem enforcement, and pass unit tests', () => {
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

    // D3d: idtoken.ts maps accept_lineitem -> acceptLineItem and accept_media_types -> acceptMediaTypes.
    const idtokenText = fs.readFileSync(path.join(TARGET_ROOT, 'services/lti-service/src/lti/idtoken.ts'), 'utf8');
    expect(
      idtokenText.includes('acceptLineItem'),
      'idtoken.ts maps acceptLineItem (D3d, AC-LA-E3-04-05/06)',
    ).toBe(true);
    expect(
      idtokenText.includes('acceptMediaTypes'),
      'idtoken.ts maps acceptMediaTypes (D3d, AC-LA-E3-04-05/06)',
    ).toBe(true);

    // D3c: deep-linking.ts checks accept_lineitem and rejects lineItem when accept_lineitem === false.
    const dlText = fs.readFileSync(path.join(TARGET_ROOT, 'services/lti-service/src/lti/deep-linking.ts'), 'utf8');
    expect(dlText.includes('accept_lineitem'), 'deep-linking.ts checks accept_lineitem (D3c, AC-LA-E3-04-04)').toBe(
      true,
    );
    expect(dlText.includes('INVALID_CONTENT_ITEM'), 'deep-linking.ts rejects with INVALID_CONTENT_ITEM').toBe(true);

    // Run Author unit tests under services/lti-service/src/lti and services/lti-service/src/http/routes.
    const unitRes = spawnSync(
      'npx',
      [
        '--no-install',
        'vitest',
        'run',
        '--reporter=verbose',
        'services/lti-service/src/lti',
        'services/lti-service/src/http/routes',
      ],
      {
        cwd: TARGET_ROOT,
        env: plainEnv(),
        encoding: 'utf8',
        timeout: 120_000,
      },
    );
    const unitOutput = `${unitRes.stdout ?? ''}${unitRes.stderr ?? ''}`;
    expect(unitRes.status, `Deep Linking & idtoken unit tests exit 0; output:\n${unitOutput}`).toBe(0);

    writeArtifact(
      'e3-04-k0.json',
      `${JSON.stringify({ targetRoot: TARGET_ROOT, f1Report, unitStatus: unitRes.status }, null, 2)}\n`,
    );
    writeArtifact('e3-04-unit.log', unitOutput);
  });
});
