// LA-E3-05 K0 / host-only suite (no Docker).
// Sources:
// - docs/architecture/ltiaas/tasks/LA-E3-05.md (AC-LA-E3-05-09 UNIT, AC-LA-E3-05-10 UNIT, design notes)
// - docs/architecture/ltiaas/adr/LA-ADR-05-lti-advantage-completeness.md D3 (AP-05-12..AP-05-18, BD-A2-87)
// - docs/architecture/ltiaas/data-model.md §5b (picker_pick table, app migration 018)
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
  'services/cogniate-app/src/tool-pages/picker.ts',
  'services/cogniate-app/src/domain/pickers.ts',
  'services/cogniate-app/src/domain/launch.ts',
  'services/cogniate-app/src/domain/retention.ts',
  'services/cogniate-app/src/clients/lti-client.ts',
];

function readRepoFile(relPath: string): string {
  const abs = path.join(TARGET_ROOT, relPath);
  expect(fs.existsSync(abs), `Expected file to exist: ${relPath}`).toBe(true);
  return fs.readFileSync(abs, 'utf8');
}

function findPickerPickMigration(): { relPath: string; content: string } | null {
  for (const dirRel of [
    'services/cogniate-app/src/domain/migrations',
    'services/cogniate-app/src/db/migrations',
  ]) {
    const migDir = path.join(TARGET_ROOT, dirRel);
    if (!fs.existsSync(migDir)) continue;
    const files = fs
      .readdirSync(migDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const f of files) {
      const relPath = `${dirRel}/${f}`;
      const content = fs.readFileSync(path.join(migDir, f), 'utf8');
      if (content.includes('picker_pick')) {
        return { relPath, content };
      }
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
  const probePath = `services/cogniate-app/src/zz-f1-probe-${path.basename(asPath)}`;
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

describe('LA-E3-05 K0: Deep Linking completeness — picker multi-select, cancel and acceptLineItem (D3)', () => {
  it('Static & schema checks: app migration 018 (picker_pick with backfill), cancel route, PLACEMENT_NOT_GRADED, multi-select 1..20, and picker_pick stats/retention', () => {
    const pickerPageSrc = readRepoFile('services/cogniate-app/src/tool-pages/picker.ts');
    const pickersDomainSrc = readRepoFile('services/cogniate-app/src/domain/pickers.ts');
    const launchDomainSrc = readRepoFile('services/cogniate-app/src/domain/launch.ts');
    const retentionDomainSrc = readRepoFile('services/cogniate-app/src/domain/retention.ts');

    // 1. App migration 018: picker_pick table and backfill from picker_session (data-model.md §5b, AC-LA-E3-05-10)
    const mig = findPickerPickMigration();
    expect(Boolean(mig), 'App migration 018 creating picker_pick must exist').toBe(true);
    expect(mig!.relPath.includes('018'), `migration file is numbered 018 (${mig!.relPath})`).toBe(true);
    expect(/CREATE\s+TABLE\s+picker_pick/i.test(mig!.content), 'migration 018 creates table picker_pick').toBe(true);
    expect(
      mig!.content.includes('picker_id_hash') &&
        mig!.content.includes('publication_id') &&
        mig!.content.includes('resource_link_id'),
      'picker_pick has picker_id_hash, publication_id, and resource_link_id columns',
    ).toBe(true);
    expect(
      /PRIMARY\s+KEY\s*\(\s*picker_id_hash\s*,\s*publication_id\s*\)/i.test(mig!.content),
      'picker_pick has PRIMARY KEY (picker_id_hash, publication_id)',
    ).toBe(true);
    expect(
      /INSERT\s+INTO\s+picker_pick/i.test(mig!.content) && mig!.content.includes('picker_session'),
      'migration 018 backfills picker_pick from existing picker_session rows',
    ).toBe(true);

    // 2. D3a Cancel route & "No course was added." message (AC-LA-E3-05-05, AC-LA-E3-05-06, AC-LA-E3-05-07)
    expect(
      pickerPageSrc.includes('/cancel'),
      'tool-pages/picker.ts defines POST /tool/picker/:pickerId/cancel route',
    ).toBe(true);
    expect(
      pickerPageSrc.includes('No course was added.'),
      'cancel path passes options.message = "No course was added."',
    ).toBe(true);

    // 3. D3c PLACEMENT_NOT_GRADED on GET and POST when acceptLineItem === false and !content.ungraded (AC-LA-E3-05-08, BD-A2-87)
    expect(
      pickerPageSrc.includes('PLACEMENT_NOT_GRADED'),
      'tool-pages/picker.ts renders PLACEMENT_NOT_GRADED error page',
    ).toBe(true);
    expect(
      pickerPageSrc.includes('placement_not_graded') && pickerPageSrc.includes('picker_rejected'),
      'tool-pages/picker.ts logs picker_rejected with reason placement_not_graded (BD-A2-87)',
    ).toBe(true);
    expect(
      pickerPageSrc.includes('acceptLineItem'),
      'tool-pages/picker.ts checks acceptLineItem from /api/idtoken (BD-A2-87)',
    ).toBe(true);

    // 4. D3b Multi-select (acceptMultiple && content.multiple, 1..20 distinct items, PUBLICATION_NOT_AVAILABLE) (AC-LA-E3-05-01..04, 12, BD-A2-87)
    expect(
      pickerPageSrc.includes('acceptMultiple'),
      'tool-pages/picker.ts checks acceptMultiple from /api/idtoken (BD-A2-87)',
    ).toBe(true);
    expect(
      pickerPageSrc.includes('checkbox') && pickerPageSrc.includes('radio'),
      'tool-pages/picker.ts renders checkbox list for multi-select and radio list for single-select',
    ).toBe(true);
    expect(
      pickerPageSrc.includes('PUBLICATION_NOT_AVAILABLE'),
      'tool-pages/picker.ts refuses invalid/duplicate/excess publication ids with PUBLICATION_NOT_AVAILABLE',
    ).toBe(true);

    // 5. picker_pick usage in domain/pickers.ts, domain/launch.ts, and domain/retention.ts (AC-LA-E3-05-09, retention)
    expect(
      pickersDomainSrc.includes('picker_pick'),
      'domain/pickers.ts writes picker_pick rows',
    ).toBe(true);
    expect(
      launchDomainSrc.includes('picker_pick'),
      'domain/launch.ts launchStats counts activities from picker_pick',
    ).toBe(true);
    expect(
      retentionDomainSrc.includes('picker_pick') || pickersDomainSrc.includes('picker_pick'),
      'picker retention keeps sessions with unmatched picker_pick rows',
    ).toBe(true);
  });

  it('F1 (lms-names) and F5 (rules) checks pass on LA-E3-05 core files and app migration 018', () => {
    const mig = findPickerPickMigration();
    expect(Boolean(mig), 'App migration 018 must exist').toBe(true);

    const baselinePath = path.join(TARGET_ROOT, 'infra/scripts/fitness/f1-baseline.json');
    const parsedBaseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8')) as
      | { counts?: Record<string, number> }
      | Record<string, number>;
    const counts: Record<string, number> =
      typeof parsedBaseline.counts === 'object' && parsedBaseline.counts !== null
        ? parsedBaseline.counts
        : (parsedBaseline as Record<string, number>);

    const coreTargets = [...TASK_CORE_FILES, mig!.relPath];
    for (const relPath of coreTargets) {
      expect(isF1Core(relPath), `${relPath} is an F1 core path`).toBe(true);
      const src = readRepoFile(relPath);
      const f1 = checkF1OnText(relPath, src);
      expect(f1.code, `${relPath} passes F1 check; output:\n${f1.output}`).toBe(0);
      const maxAllowed = counts[relPath] ?? 0;
      expect(
        f1.rawHits.length <= maxAllowed,
        `${relPath} F1 hits (${f1.rawHits.length}) must not exceed f1-baseline.json count (${maxAllowed})`,
      ).toBe(true);

      const f5 = checkF5OnText(relPath, src);
      expect(f5.code, `${relPath} passes F5 check; output:\n${f5.output}`).toBe(0);
    }
  });

  it('AC-LA-E3-05-09 & AC-LA-E3-05-10 (UNIT): picker_pick multi-select/single-select activities stats, migration 018 backfill, retention, cancel, and PLACEMENT_NOT_GRADED unit tests pass', () => {
    const mig = findPickerPickMigration();
    expect(Boolean(mig), 'App migration 018 must exist before running unit suite').toBe(true);

    fs.rmSync(path.join(TARGET_ROOT, 'node_modules/.vitest-cache'), { recursive: true, force: true });
    fs.rmSync(path.join(TARGET_ROOT, 'node_modules/.vite'), { recursive: true, force: true });

    const unitRes = spawnSync(
      'npx',
      [
        '--no-install',
        'vitest',
        'run',
        '--reporter=verbose',
        'services/cogniate-app/src/tool-pages',
        'services/cogniate-app/src/domain',
      ],
      {
        cwd: TARGET_ROOT,
        env: plainEnv(),
        encoding: 'utf8',
        timeout: 120_000,
      },
    );
    const unitOutput = `${unitRes.stdout ?? ''}${unitRes.stderr ?? ''}`;
    expect(unitRes.status, `LA-E3-05 cogniate-app unit & migration tests exit 0; output:\n${unitOutput}`).toBe(0);
  });
});
