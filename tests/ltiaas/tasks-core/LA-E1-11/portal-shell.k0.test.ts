// LA-E1-11 K0 acceptance tests:
// - AC-LA-E1-11-07: `npm run build -w apps/portal` passes, and the built CSS contains a utility class used in
//   `packages/channels/moodle/portal/**` (plus a unique probe utility class placed only in
//   `packages/channels/moodle/portal/`).
// - AC-LA-E1-11-08: F3: the clean tree has 0 ESLint errors on `packages/channels/*/portal/**` (no import into portal
//   code outside `apps/portal/src/sdk/`), and the LA-E1-03 probe (5) still fails.
// - AC-LA-E1-11-09: `apps/portal/src/connect/canvas/`, `apps/portal/src/connect/blackboard/`, `MoodleSteps.tsx`,
//   `MoodleBackup.tsx`, `MoodleCourse.tsx` and `WebServices.tsx` no longer exist in core; the Moodle-only ready rule in
//   `apps/portal/src/Integrations.tsx` is gone; and F1 counts of the portal files go down or stay (RQ-3).
// Source: docs/architecture/ltiaas/tasks/LA-E1-11.md; LA-ADR-01 D1, D5, D8; TEST-STRATEGY §3.2, §3.4, §3.5.
// QA-3 wrote these tests from the spec and design only (test-first). Runs inside a prepared clone (README.md).
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  ROOT, artifact, f1Hits, f1Text, git, isF1Core, npmCheck, requireRunDir, requireScratchClone, run, scriptEchoes,
  type RunResult,
} from '../LA-E1-04/fitness';

const BASE_SHA = process.env.LA_BASE_SHA ?? 'HEAD~1';

interface EslintMessage {
  ruleId: string | null;
  severity: number;
  message: string;
}
interface EslintFileResult {
  filePath: string;
  messages: EslintMessage[];
  errorCount: number;
}

let clean: RunResult;

function walkFiles(dir: string, exts: string[]): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full, exts));
    } else if (entry.isFile() && exts.some((e) => entry.name.endsWith(e))) {
      out.push(full);
    }
  }
  return out.sort();
}

function readBuiltCss(): string {
  const assetsDir = path.join(ROOT, 'apps/portal/dist/assets');
  const distDir = path.join(ROOT, 'apps/portal/dist');
  const cssFiles = [
    ...walkFiles(assetsDir, ['.css']),
    ...walkFiles(distDir, ['.css']),
  ];
  const unique = [...new Set(cssFiles)];
  expect(unique.length, 'apps/portal/dist contains at least one built .css file').toBeGreaterThan(0);
  return unique.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
}

function extractClassLiterals(files: string[]): string[] {
  const classes = new Set<string>();
  const classAttrRe = /className\s*=\s*["'`]([^"'`$]+)["'`]/g;
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    let m: RegExpExecArray | null;
    while ((m = classAttrRe.exec(text)) !== null) {
      for (const token of m[1].split(/\s+/)) {
        if (/^[a-z][a-z0-9-]*$/.test(token)) {
          classes.add(token);
        }
      }
    }
  }
  return [...classes];
}

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

beforeAll(async () => {
  requireScratchClone();
  requireRunDir();
  clean = await npmCheck('e1-11-check-clean');
});

describe('LA-E1-11 portal shell, portal SDK and channel portal modules (K0)', () => {
  it('AC-LA-E1-11-07: npm run build -w apps/portal passes, and the built CSS contains a utility class used in packages/channels/moodle/portal/**', async () => {
    const moodlePortalDir = path.join(ROOT, 'packages/channels/moodle/portal');
    const moodlePortalFiles = walkFiles(moodlePortalDir, ['.ts', '.tsx']);
    expect(moodlePortalFiles.length, 'packages/channels/moodle/portal/** has .ts/.tsx files').toBeGreaterThan(0);

    // 1. Clean portal build passes and its CSS contains utility classes used in packages/channels/moodle/portal/**.
    const cleanBuild = await run('npm', ['run', 'build', '-w', 'apps/portal']);
    artifact('e1-11-ac07-portal-build.log', cleanBuild.output);
    expect(cleanBuild.code, `npm run build -w apps/portal exits 0; output:\n${cleanBuild.output}`).toBe(0);

    const cleanCss = readBuiltCss();
    const moodleClasses = extractClassLiterals(moodlePortalFiles);
    expect(moodleClasses.length, 'packages/channels/moodle/portal/** uses Tailwind utility classes').toBeGreaterThan(0);
    const matchedClasses = moodleClasses.filter((cls) => cleanCss.includes(`.${cls}`));
    expect(
      matchedClasses.length,
      `built CSS contains utility classes from packages/channels/moodle/portal/** (checked ${moodleClasses.slice(0, 15).join(', ')})`,
    ).toBeGreaterThan(0);

    // 2. Probe control: a unique arbitrary utility class placed only in packages/channels/moodle/portal/ is scanned by
    // apps/portal/tailwind.config.js and emitted into the built CSS.
    const probeFile = path.join(moodlePortalDir, 'zz-qa-tailwind-probe.tsx');
    try {
      fs.writeFileSync(
        probeFile,
        'export const ZzQaTailwindProbe = () => <div className="z-[4711]">probe</div>;\n',
        { mode: 0o600 },
      );
      const probeBuild = await run('npm', ['run', 'build', '-w', 'apps/portal']);
      expect(probeBuild.code, 'portal build with probe class in packages/channels/moodle/portal/ exits 0').toBe(0);
      const probeCss = readBuiltCss();
      expect(probeCss, 'built CSS contains the unique utility class from packages/channels/moodle/portal/').toMatch(
        /z-\\\[4711\\\]|z-index:\s*4711/,
      );
    } finally {
      fs.rmSync(probeFile, { force: true });
      await run('npm', ['run', 'build', '-w', 'apps/portal']);
      fs.rmSync(path.join(ROOT, 'apps/portal/dist'), { recursive: true, force: true });
    }
  });

  it('AC-LA-E1-11-08: F3: the clean tree has 0 ESLint errors on packages/channels/*/portal/**, and the LA-E1-03 probe (5) still fails', async () => {
    expect(clean.code, 'npm run check exits 0 on the clean tree').toBe(0);

    // 1. Direct ESLint run on packages/channels/*/portal/** reports 0 errors.
    const lintPortal = await run('npx', [
      '--no-install',
      'eslint',
      '--format',
      'json',
      'packages/channels/moodle/portal',
      'packages/channels/canvas/portal',
      'packages/channels/blackboard/portal',
    ]);
    artifact('e1-11-ac08-eslint-portal.json', lintPortal.output);
    expect(lintPortal.code, `eslint on packages/channels/*/portal exits 0; output:\n${lintPortal.output}`).toBe(0);
    const results = JSON.parse(lintPortal.output) as EslintFileResult[];
    expect(results.length, 'eslint checked channel portal files').toBeGreaterThan(0);
    const totalErrors = results.reduce((sum, r) => sum + r.errorCount, 0);
    expect(totalErrors, '0 ESLint errors on packages/channels/*/portal/**').toBe(0);

    // 2. LA-E1-03 probe (5): packages/channels/canvas/portal/index.tsx importing apps/portal/src/Integrations fails.
    const probe5 = await run(
      'npx',
      [
        '--no-install',
        'eslint',
        '--no-ignore',
        '--stdin',
        '--stdin-filename',
        'packages/channels/canvas/portal/index.tsx',
        '--format',
        'json',
      ],
      {
        input: "import { Integrations } from '../../../../apps/portal/src/Integrations';\nexport const v = Integrations;\n",
      },
    );
    artifact('e1-11-ac08-probe5.json', probe5.output);
    expect(probe5.code, 'LA-E1-03 probe (5) exits non-zero').toBe(1);
    const [probe5Result] = JSON.parse(probe5.output) as EslintFileResult[];
    expect(
      probe5Result.messages.filter((m) => m.severity === 2).length,
      'LA-E1-03 probe (5) reports a severity-2 error',
    ).toBeGreaterThan(0);
  });

  it('AC-LA-E1-11-09: legacy portal LMS files no longer exist in core, the Moodle-only ready rule in Integrations.tsx is gone, and F1 counts of portal files go down or stay (RQ-3)', async () => {
    expect(clean.code, 'npm run check exits 0 on the clean tree').toBe(0);
    const echoes = scriptEchoes(clean.output);
    expect(echoes.some((s) => /fitness:lms-names|lms-names/.test(s)), 'npm run check ran F1').toBe(true);

    // 1. Removed portal files and folders no longer exist in core (neither on disk nor tracked in git).
    const removedPaths = [
      'apps/portal/src/connect/canvas',
      'apps/portal/src/connect/blackboard',
      'apps/portal/src/MoodleSteps.tsx',
      'apps/portal/src/connect/MoodleSteps.tsx',
      'apps/portal/src/MoodleBackup.tsx',
      'apps/portal/src/courses/MoodleBackup.tsx',
      'apps/portal/src/MoodleCourse.tsx',
      'apps/portal/src/courses/MoodleCourse.tsx',
      'apps/portal/src/WebServices.tsx',
      'apps/portal/src/connect/WebServices.tsx',
    ];
    for (const rel of removedPaths) {
      expect(fs.existsSync(path.join(ROOT, rel)), `${rel} does not exist on disk`).toBe(false);
      const tracked = git(['ls-files', rel]).split('\n').filter(Boolean);
      expect(tracked, `${rel} is not tracked in git`).toEqual([]);
    }

    // 2. The Moodle-only ready rule in apps/portal/src/Integrations.tsx is gone (0 F1 hits and no 'moodle' branch).
    const integrationsRel = 'apps/portal/src/Integrations.tsx';
    const integrationsText = fs.readFileSync(path.join(ROOT, integrationsRel), 'utf8');
    const integrationsF1 = await f1Text(integrationsRel, integrationsText);
    expect(
      integrationsF1.code,
      `${integrationsRel} passes F1; output:\n${integrationsF1.output}`,
    ).toBe(0);
    const integrationsHits = f1Hits(integrationsF1.output).filter((h) => h.path === integrationsRel);
    expect(integrationsHits, `${integrationsRel} has 0 F1 hits (Moodle-only ready rule removed)`).toEqual([]);

    // 3. F1 counts of every portal file (and every core file changed by this task) go down or stay (RQ-3).
    const baseSha = git(['rev-parse', BASE_SHA]);
    const headSha = git(['rev-parse', 'HEAD']);
    const changedFiles = git(['diff', '--name-only', baseSha, headSha]).split('\n').filter(Boolean);
    const changedCore = changedFiles.filter(isF1Core);
    expect(changedCore.length, `changed core files between ${baseSha} and ${headSha}`).toBeGreaterThan(0);

    const deltas: Array<{ file: string; baseHits: number | null; headHits: number }> = [];
    for (const rel of changedCore) {
      if (!fileExistsAt(headSha, rel)) {
        deltas.push({ file: rel, baseHits: null, headHits: 0 });
        continue;
      }
      const headRes = await f1Text(rel, git(['show', `${headSha}:${rel}`]));
      expect(headRes.code, `${rel}: passes F1 ratchet at HEAD; output:\n${headRes.output}`).toBe(0);
      const headHits = f1Hits(headRes.output).filter((h) => h.path === rel).length;

      let baseHits: number | null = null;
      if (fileExistsAt(baseSha, rel)) {
        const baseRes = await f1Text(rel, git(['show', `${baseSha}:${rel}`]));
        baseHits = f1Hits(baseRes.output).filter((h) => h.path === rel).length;
        expect(headHits, `${rel}: F1 hit count at HEAD (${headHits}) <= at ${baseSha.slice(0, 7)} (${baseHits})`).toBeLessThanOrEqual(baseHits);
      } else {
        expect(headHits, `new core file ${rel} has 0 F1 hits`).toBe(0);
      }
      deltas.push({ file: rel, baseHits, headHits });
    }

    const baseBaseline = readBaselineCounts(baseSha);
    const headBaseline = readBaselineCounts(headSha);
    expect(headBaseline, 'f1-baseline.json exists at HEAD').not.toBeNull();
    if (baseBaseline && headBaseline) {
      for (const [file, headCount] of Object.entries(headBaseline)) {
        const prev = baseBaseline[file] ?? 0;
        expect(headCount, `f1-baseline.json ${file}: ${headCount} <= ${prev} (RQ-3)`).toBeLessThanOrEqual(prev);
      }
    }

    artifact('e1-11-ac09-f1-deltas.json', `${JSON.stringify({ baseSha, headSha, deltas }, null, 2)}\n`);
  });
});
