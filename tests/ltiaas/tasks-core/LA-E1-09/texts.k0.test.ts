// LA-E1-09 K0 acceptance tests:
// - AC-LA-E1-09-06: The F1 counts of every file of this task (tool-pages/**, content-host/server.ts, app/portal.ts,
//   app/api-errors.ts, app/reject-info.ts, tracking/src/status-text.ts, tracking/src/html.ts, shared/src/html.ts,
//   apps/player/src/**) are 0; services/cogniate-app/src/tool-pages/canvas-embedded.ts no longer exists under that
//   LMS-named path (renamed to embedded-session-help.ts); no closed 3-LMS name union remains in these files; and F1
//   counts of every core file changed by this task go down or stay (RQ-3).
// Source: docs/architecture/ltiaas/tasks/LA-E1-09.md; LA-ADR-01 D2, D5; LA-ADR-04 D2, D3; TEST-STRATEGY §3.2.
// QA-3 wrote these tests from the spec and design only (test-first).
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  ROOT, artifact, f1Hits, f1Text, git, isF1Core, npmCheck, requireRunDir, requireScratchClone, run, scriptEchoes,
  type RunResult,
} from '../LA-E1-04/fitness';

const BASE_SHA = process.env.LA_BASE_SHA ?? 'HEAD~1';
const REMOVED_CANVAS_EMBEDDED = 'services/cogniate-app/src/tool-pages/canvas-embedded.ts';
const EMBEDDED_SESSION_HELP = 'services/cogniate-app/src/tool-pages/embedded-session-help.ts';

const EXPLICIT_TASK_FILES = [
  'services/cogniate-app/src/tool-pages/embedded-session-help.ts',
  'services/cogniate-app/src/tool-pages/error-page.ts',
  'services/cogniate-app/src/tool-pages/session-restore.ts',
  'services/cogniate-app/src/content-host/server.ts',
  'services/cogniate-app/src/app/portal.ts',
  'services/cogniate-app/src/app/api-errors.ts',
  'services/cogniate-app/src/app/reject-info.ts',
  'packages/tracking/src/status-text.ts',
  'packages/tracking/src/html.ts',
  'packages/shared/src/html.ts',
  'apps/player/src/main.ts',
  'apps/player/src/runtime.ts',
] as const;

let clean: RunResult;

function readBaselineCounts(ref: string): Record<string, number> | null {
  try {
    const text = git(['show', `${ref}:infra/scripts/fitness/f1-baseline.json`]);
    const raw = JSON.parse(text) as Record<string, unknown>;
    const isCounts = (o: unknown): o is Record<string, number> =>
      typeof o === 'object' && o !== null && !Array.isArray(o) && Object.values(o).every((v) => typeof v === 'number');
    if (isCounts(raw)) return raw;
    return Object.values(raw).find(isCounts) ?? null;
  } catch {
    return null;
  }
}

function fileExistsAt(ref: string, relPath: string): boolean {
  try {
    git(['cat-file', '-e', `${ref}:${relPath}`]);
    return true;
  } catch {
    return false;
  }
}

function listTaskScopeFiles(): string[] {
  const tracked = git([
    'ls-files',
    'services/cogniate-app/src/tool-pages/',
    'apps/player/src/',
    ...EXPLICIT_TASK_FILES,
  ])
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from(new Set([...EXPLICIT_TASK_FILES, ...tracked])).filter(isF1Core);
}

beforeAll(async () => {
  requireScratchClone();
  requireRunDir();
  clean = await npmCheck('e1-09-check-clean');
});

describe('LA-E1-09 {LMS} texts in app, player and tracking, and portal route allowlist (K0)', () => {
  it('AC-LA-E1-09-06: F1 counts of every file of this task are 0, canvas-embedded.ts is renamed to embedded-session-help.ts, no closed 3-LMS union remains, and RQ-3 holds', async () => {
    expect(clean.code, 'npm run check exits 0 on the clean tree').toBe(0);
    const echoes = scriptEchoes(clean.output);
    expect(echoes.some((s) => /fitness:lms-names|lms-names/.test(s)), 'npm run check ran F1').toBe(true);

    // 1. canvas-embedded.ts no longer exists; embedded-session-help.ts exists.
    expect(fs.existsSync(path.join(ROOT, REMOVED_CANVAS_EMBEDDED)), `${REMOVED_CANVAS_EMBEDDED} is removed`).toBe(false);
    expect(git(['ls-files', REMOVED_CANVAS_EMBEDDED]).trim(), `${REMOVED_CANVAS_EMBEDDED} not tracked`).toBe('');
    expect(fs.existsSync(path.join(ROOT, EMBEDDED_SESSION_HELP)), `${EMBEDDED_SESSION_HELP} exists`).toBe(true);

    // 2. Every file in LA-E1-09 scope has 0 F1 hits and no closed 3-LMS name union.
    const scopeFiles = listTaskScopeFiles();
    expect(scopeFiles.length, 'LA-E1-09 scope files found').toBeGreaterThan(0);

    const headBaseline = readBaselineCounts('HEAD');
    expect(headBaseline !== null, 'f1-baseline.json exists at HEAD').toBe(true);
    expect(headBaseline![REMOVED_CANVAS_EMBEDDED] ?? 0, `${REMOVED_CANVAS_EMBEDDED} is 0 or absent in f1-baseline.json`).toBe(0);

    const closedUnionRe =
      /(['"]Moodle['"]\s*\|\s*['"]Canvas['"]\s*\|\s*['"]Blackboard['"])|(['"]moodle['"]\s*\|\s*['"]canvas['"]\s*\|\s*['"]blackboard['"])/;

    const fileReports: Array<{ file: string; hits: number; baselineEntry: number }> = [];
    for (const rel of scopeFiles) {
      const abs = path.join(ROOT, rel);
      if (!fs.existsSync(abs)) continue;
      const content = fs.readFileSync(abs, 'utf8');
      const res = await f1Text(rel, content);
      expect(res.code, `${rel}: passes F1 check; output:\n${res.output}`).toBe(0);
      const hits = f1Hits(res.output).filter((h) => h.path === rel);
      expect(hits, `${rel}: 0 F1 hits`).toEqual([]);

      const baselineEntry = headBaseline![rel] ?? 0;
      expect(baselineEntry, `${rel}: f1-baseline.json count is 0`).toBe(0);
      expect(closedUnionRe.test(content), `${rel}: contains no closed 3-LMS union`).toBe(false);
      fileReports.push({ file: rel, hits: hits.length, baselineEntry });
    }

    // 3. RQ-3: F1 counts of every core file changed between BASE_SHA and HEAD go down or stay.
    const baseSha = git(['rev-parse', BASE_SHA]);
    const headSha = git(['rev-parse', 'HEAD']);
    const changedCore = git(['diff', '--name-only', baseSha, headSha]).split('\n').filter(Boolean).filter(isF1Core);
    const deltas: Array<{ file: string; baseHits: number | null; headHits: number }> = [];

    for (const rel of changedCore) {
      if (!fileExistsAt(headSha, rel)) {
        deltas.push({ file: rel, baseHits: null, headHits: 0 });
        continue;
      }
      const headRes = await f1Text(rel, git(['show', `${headSha}:${rel}`]));
      expect(headRes.code, `${rel}: passes F1 ratchet at HEAD`).toBe(0);
      const headHits = f1Hits(headRes.output).filter((h) => h.path === rel).length;

      let baseHits: number | null = null;
      if (fileExistsAt(baseSha, rel)) {
        const baseRes = await f1Text(rel, git(['show', `${baseSha}:${rel}`]));
        baseHits = f1Hits(baseRes.output).filter((h) => h.path === rel).length;
        expect(
          headHits,
          `${rel}: F1 hit count at HEAD (${headHits}) <= at ${baseSha.slice(0, 7)} (${baseHits})`,
        ).toBeLessThanOrEqual(baseHits);
      } else {
        expect(headHits, `new core file ${rel} has 0 F1 hits`).toBe(0);
      }
      deltas.push({ file: rel, baseHits, headHits });
    }

    const baseBaseline = readBaselineCounts(baseSha);
    if (baseBaseline && headBaseline) {
      for (const [file, headCount] of Object.entries(headBaseline)) {
        const prev = baseBaseline[file] ?? 0;
        expect(headCount, `f1-baseline.json ${file}: ${headCount} <= ${prev} (RQ-3)`).toBeLessThanOrEqual(prev);
      }
    }

    artifact(
      'e1-09-ac06-f1-zero.json',
      `${JSON.stringify({ baseSha, headSha, fileReports, deltas }, null, 2)}\n`,
    );
  });

  it('BD-A1-56, BD-A1-57 (LA-IC-19), AC-LA-E1-09-02..04: app error table removes 5 Moodle-only codes, LA-IC-19 410 RUNTIME_EXPIRED scan finds 0 affected frozen tests, and UNIT rows pass', async () => {
    // 1. BD-A1-56: the 5 Moodle-only error codes (`MOODLE_WS_ERROR`, `MBZ_NOT_SUPPORTED`, `WS_TOKEN_INVALID`,
    //    `WS_FUNCTIONS_MISSING`, `MBZ_BUILD_LIMIT`) are removed from `services/cogniate-app/src/app/api-errors.ts`.
    const apiErrorsSrc = fs.readFileSync(
      path.join(ROOT, 'services/cogniate-app/src/app/api-errors.ts'),
      'utf8',
    );
    for (const removedCode of [
      'MOODLE_WS_ERROR',
      'MBZ_NOT_SUPPORTED',
      'WS_TOKEN_INVALID',
      'WS_FUNCTIONS_MISSING',
      'MBZ_BUILD_LIMIT',
    ]) {
      expect(apiErrorsSrc, `api-errors.ts does not hold ${removedCode} (BD-A1-56)`).not.toContain(removedCode);
    }

    // 2. BD-A1-57 / LA-IC-19: scan frozen tests (`tests/acceptance/**`, `tests/e2e/**`, `tests/ltiaas/golden/capture.golden.ts`)
    //    for `RUNTIME_EXPIRED`; only `tests/acceptance/T5a/6-negative.spec.ts` (Moodle live, where Moodle bytes are
    //    unchanged and only `status === 410` + `code === 'RUNTIME_EXPIRED'` are asserted) references it.
    const frozenHits = git([
      'grep',
      '-n',
      'RUNTIME_EXPIRED',
      '--',
      'tests/acceptance',
      'tests/e2e',
      'tests/ltiaas/golden/capture.golden.ts',
    ])
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    expect(frozenHits.length).toBeGreaterThan(0);
    for (const line of frozenHits) {
      expect(
        line.startsWith('tests/acceptance/T5a/6-negative.spec.ts:'),
        `only T5a/6-negative.spec.ts (Moodle) references RUNTIME_EXPIRED: ${line}`,
      ).toBe(true);
    }

    // 3. Author UNIT rows for AC-LA-E1-09-02 (including LA-IC-19, B-LA-E1-09-01, BD-A1-59), AC-LA-E1-09-03,
    //    AC-LA-E1-09-04, BD-A1-56, and BD-A1-62 (http_request path = route template or <unmatched>) pass.
    const unitRes = await run(
      'npx',
      [
        '--no-install',
        'vitest',
        'run',
        '--reporter=verbose',
        'apps/player/src/lms-name.test.ts',
        'packages/channel-kernel/src/legacy-wire.test.ts',
        'packages/channel-kernel/src/manifest.test.ts',
        'packages/tracking/src/status-text.test.ts',
        'services/cogniate-app/src/app/portal.test.ts',
        'services/cogniate-app/src/http-request-log.test.ts',
        'services/cogniate-app/src/tool-pages/embedded-session-help.test.ts',
        'services/cogniate-app/src/tool-pages/lms-texts.test.ts',
      ],
      { timeoutMs: 3 * 60_000 },
    );
    artifact('e1-09-unit-rows.log', unitRes.output);
    expect(unitRes.code, `LA-E1-09 unit suites exit 0:\n${unitRes.output}`).toBe(0);
    for (const marker of [
      'AC-LA-E1-09-02',
      'AC-LA-E1-09-03',
      'AC-LA-E1-09-04',
      'LA-IC-19',
      'BD-A1-30',
      'B-LA-E1-09-01',
      'BD-A1-59',
      '<unmatched>',
    ]) {
      expect(unitRes.output, `unit test output cites ${marker}`).toContain(marker);
    }
  });
});
