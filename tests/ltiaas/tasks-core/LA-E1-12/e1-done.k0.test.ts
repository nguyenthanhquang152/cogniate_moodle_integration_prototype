// LA-E1-12 K0 acceptance tests:
// - AC-LA-E1-12-01: infra/scripts/fitness/f1-baseline.json has count 0 for every core file except
//   packages/channel-kernel/src/legacy-wire.ts and the applied migrations, and F1 passes in npm run check.
// - AC-LA-E1-12-02: packages/channel-kernel/fitness-scope.json equals README §4: the exception list has only
//   packages/channel-kernel/src/legacy-wire.ts and the applied migrations (packages/shared/src/config.ts removed).
// - AC-LA-E1-12-03: F4: K0 (npm run test:k0) passes on the QA canary channel (tests/ltiaas/canary/), loaded as the
//   extra root, with no core edit.
// - AC-LA-E1-12-04: F3 (eslint .) has 0 errors and the full F5 run (npm run fitness:rules) has 0 hits on the clean tree.
// - AC-LA-E1-12-05: The commit message of the task names the E1-done SHA, and F2 against it lists 0 core paths for a
//   scratch branch / paths list that adds only packages/channels/zz-probe/**.
// Source: docs/architecture/ltiaas/tasks/LA-E1-12.md; LA-ADR-01 D10 (F1–F5); TEST-STRATEGY §3.1–§3.6.
// QA-3 wrote these tests from the spec and design only (test-first).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  ROOT, artifact, channelDiff, f1Hits, f1Text, git, hasScript, npmCheck, requireRunDir, requireScratchClone, run,
  scriptEchoes, type RunResult,
} from '../LA-E1-04/fitness';

const F1_BASELINE_REL = 'infra/scripts/fitness/f1-baseline.json';
const FITNESS_SCOPE_REL = 'packages/channel-kernel/fitness-scope.json';

interface LoadedChannel {
  folder: string;
  manifest: Record<string, unknown> & { id: string };
  ltiAdapter?: unknown;
  appAdapter?: unknown;
}

interface KernelSurface {
  loadChannelFolders(roots: readonly string[], side: 'lti' | 'app'): Promise<LoadedChannel[]>;
}

let clean: RunResult;
let runDir: string;

function isAllowedD10Exception(relPath: string): boolean {
  if (relPath === 'packages/channel-kernel/src/legacy-wire.ts') return true;
  if (/^services\/[^/]+\/src\/migrations\//.test(relPath)) return true;
  if (/^services\/[^/]+\/migrations\//.test(relPath)) return true;
  if (/migrations\/0\d\d[_-]/.test(relPath)) return true;
  return false;
}

function readBaselineCounts(): Record<string, number> {
  const abs = path.join(ROOT, F1_BASELINE_REL);
  expect(fs.existsSync(abs), `${F1_BASELINE_REL} exists`).toBe(true);
  const raw = JSON.parse(fs.readFileSync(abs, 'utf8')) as Record<string, unknown>;
  const isCounts = (o: unknown): o is Record<string, number> =>
    typeof o === 'object' && o !== null && !Array.isArray(o) && Object.values(o).every((v) => typeof v === 'number');
  if (isCounts(raw)) return raw;
  const nested = Object.values(raw).find(isCounts);
  expect(nested, `${F1_BASELINE_REL} contains a file->count map`).toBeDefined();
  return nested!;
}

beforeAll(async () => {
  requireScratchClone();
  runDir = requireRunDir();
  clean = await npmCheck('e1-12-check-clean');
});

describe('LA-E1-12 F1 ratchet at zero, F2 report mode and E1 fitness verification (K0)', () => {
  it('AC-LA-E1-12-01: infra/scripts/fitness/f1-baseline.json has count 0 for every core file except legacy-wire.ts and the applied migrations, and F1 passes in npm run check', async () => {
    expect(clean.code, `npm run check exits 0:\n${clean.output}`).toBe(0);
    const echoes = scriptEchoes(clean.output);
    expect(echoes.some((s) => /fitness:lms-names|lms-names/.test(s)), 'npm run check ran F1').toBe(true);

    // 1. Direct F1 run on the clean tree exits 0 with 0 hits.
    const f1Run = await run('npm', ['run', '--silent', 'fitness:lms-names']);
    artifact('e1-12-ac01-f1.log', f1Run.output);
    expect(f1Run.code, `fitness:lms-names exits 0:\n${f1Run.output}`).toBe(0);
    expect(f1Hits(f1Run.output), '0 F1 hits on the clean tree').toEqual([]);

    // 2. Every entry in f1-baseline.json is 0 (or is an allowed D10 exception).
    const counts = readBaselineCounts();
    const positiveNonExceptions = Object.entries(counts).filter(
      ([file, count]) => count > 0 && !isAllowedD10Exception(file),
    );
    expect(
      positiveNonExceptions,
      'f1-baseline.json has no positive count outside legacy-wire.ts and applied migrations',
    ).toEqual([]);

    // 3. A single banned word in a formerly ratcheted core file (e.g. packages/shared/src/config.ts) now fails F1.
    const configRel = 'packages/shared/src/config.ts';
    const configText = fs.readFileSync(path.join(ROOT, configRel), 'utf8');
    const probeRes = await f1Text(configRel, `${configText}\nexport const zzMoodleLeak = 'moodle';\n`);
    expect(probeRes.code !== 0, 'adding a banned LMS name to packages/shared/src/config.ts fails F1').toBe(true);
    expect(f1Hits(probeRes.output).length, 'F1 reports the probe hit in packages/shared/src/config.ts').toBeGreaterThan(0);

    artifact(
      'e1-12-ac01-baseline-summary.json',
      `${JSON.stringify({ totalEntries: Object.keys(counts).length, positiveNonExceptions }, null, 2)}\n`,
    );
  });

  it('AC-LA-E1-12-02: packages/channel-kernel/fitness-scope.json exception list has only legacy-wire.ts and the applied migrations', () => {
    const scopeAbs = path.join(ROOT, FITNESS_SCOPE_REL);
    expect(fs.existsSync(scopeAbs), `${FITNESS_SCOPE_REL} exists`).toBe(true);
    const scope = JSON.parse(fs.readFileSync(scopeAbs, 'utf8')) as Record<string, unknown>;

    // Find the exception list in fitness-scope.json (whether top-level `exceptions`, `f1.exceptions`, or `allowlist`).
    const candidates: string[][] = [];
    if (Array.isArray(scope.exceptions)) candidates.push(scope.exceptions as string[]);
    if (scope.f1 && typeof scope.f1 === 'object' && Array.isArray((scope.f1 as Record<string, unknown>).exceptions)) {
      candidates.push((scope.f1 as Record<string, unknown>).exceptions as string[]);
    }
    expect(candidates.length, `${FITNESS_SCOPE_REL} defines an exceptions array`).toBeGreaterThan(0);

    for (const list of candidates) {
      expect(
        list.some((entry) => entry.includes('packages/shared/src/config.ts')),
        'packages/shared/src/config.ts is no longer in the exception list',
      ).toBe(false);
      expect(
        list.some((entry) => entry.includes('packages/channel-kernel/src/legacy-wire.ts')),
        'packages/channel-kernel/src/legacy-wire.ts is in the exception list',
      ).toBe(true);
      const unexpected = list.filter((entry) => !isAllowedD10Exception(entry));
      expect(unexpected, 'exception list contains only legacy-wire.ts and applied migrations').toEqual([]);
    }

    artifact('e1-12-ac02-fitness-scope.json', `${JSON.stringify(scope, null, 2)}\n`);
  });

  it('AC-LA-E1-12-03: F4: K0 passes on the QA canary channel (tests/ltiaas/canary/) loaded as the extra root, with no core edit', async () => {
    const canaryDir = path.join(ROOT, 'tests/ltiaas/canary');
    expect(fs.existsSync(canaryDir), 'tests/ltiaas/canary exists').toBe(true);

    // 1. Load baseline + canary channels via packages/channel-kernel on both 'lti' and 'app' sides.
    const kernelEntry = pathToFileURL(path.join(ROOT, 'packages/channel-kernel/src/index.ts')).href;
    const kernel = (await import(kernelEntry)) as KernelSurface;
    const roots = [path.join(ROOT, 'packages/channels'), canaryDir];
    const ltiLoaded = await kernel.loadChannelFolders(roots, 'lti');
    const appLoaded = await kernel.loadChannelFolders(roots, 'app');
    const ltiIds = ltiLoaded.map((c) => c.manifest.id);
    const appIds = appLoaded.map((c) => c.manifest.id);
    expect(ltiIds, 'lti load includes zz-canary and zz-canary-admin').toEqual(
      expect.arrayContaining(['moodle', 'canvas', 'blackboard', 'zz-canary', 'zz-canary-admin']),
    );
    expect(appIds, 'app load includes zz-canary and zz-canary-admin').toEqual(
      expect.arrayContaining(['moodle', 'canvas', 'blackboard', 'zz-canary', 'zz-canary-admin']),
    );

    // 2. Run K0 contract suite (`npm run test:k0` or `vitest run --config tests/ltiaas/k0/vitest.config.mts`).
    const k0Run = hasScript('test:k0')
      ? await run('npm', ['run', 'test:k0'])
      : await run('npx', ['--no-install', 'vitest', 'run', '--config', 'tests/ltiaas/k0/vitest.config.mts']);
    artifact('e1-12-ac03-k0-canary.log', k0Run.output);
    expect(k0Run.code, `K0 contract suite passes with canary channel:\n${k0Run.output}`).toBe(0);

    // 3. No core edit: git status is clean.
    expect(git(['status', '--porcelain']), 'git working tree has no core edit').toBe('');
  });

  it('AC-LA-E1-12-04: F3 (eslint .) has 0 errors and the full F5 run (npm run fitness:rules) has 0 hits on the clean tree', async () => {
    const f3Run = hasScript('lint')
      ? await run('npm', ['run', '--silent', 'lint'])
      : await run('npx', ['--no-install', 'eslint', '.']);
    artifact('e1-12-ac04-f3-eslint.log', f3Run.output);
    expect(f3Run.code, `F3 eslint exits 0 on the clean tree:\n${f3Run.output}`).toBe(0);

    const f5Run = await run('npm', ['run', '--silent', 'fitness:rules']);
    artifact('e1-12-ac04-f5-rules.log', f5Run.output);
    expect(f5Run.code, `F5 fitness:rules exits 0 on the clean tree:\n${f5Run.output}`).toBe(0);
  });

  it('AC-LA-E1-12-05: commit message names the E1-done SHA (or LA_E1_DONE_SHA is set) and F2 against it lists 0 core paths for a scratch channel packages/channels/zz-probe/**', async () => {
    // 1. Check that the recent commit log or LA_E1_DONE_SHA identifies the E1-done SHA, and resolve the base ref.
    const logText = git(['log', '-n', '5', '--format=%H %s%n%b']);
    const envSha = process.env.LA_E1_DONE_SHA;
    const shaMatch = /\b([0-9a-f]{7,40})\b/i.exec(envSha ?? logText);
    expect(shaMatch !== null, 'E1-done SHA is present in git log or LA_E1_DONE_SHA').toBe(true);
    const baseSha = git(['rev-parse', envSha ?? 'HEAD']);

    // 2. Test F2 with --paths-from for a pure channel addition `packages/channels/zz-probe/**` (0 core paths -> exit 0).
    const purePathsFile = path.join(runDir, 'e1-12-ac05-zz-probe-pure.txt');
    fs.writeFileSync(
      purePathsFile,
      [
        'packages/channels/zz-probe/manifest.json',
        'packages/channels/zz-probe/lti.ts',
        'packages/channels/zz-probe/app.ts',
        'tests/ltiaas/k0/zz-probe.test.ts',
        '',
      ].join('\n'),
      { mode: 0o600 },
    );
    const pureF2 = await channelDiff(['--channel', 'zz-probe', '--paths-from', purePathsFile]);
    artifact('e1-12-ac05-f2-pure.log', pureF2.output);
    expect(pureF2.code, `F2 pure channel addition exits 0:\n${pureF2.output}`).toBe(0);
    expect(pureF2.output, 'F2 reports core = 0').toMatch(/core\s*=\s*0/);

    // 3. Test F2 against `--base <baseSha> --channel zz-probe` on the clean tree (0 core paths -> exit 0).
    const baseF2 = await channelDiff(['--base', baseSha, '--channel', 'zz-probe']);
    artifact('e1-12-ac05-f2-base.log', baseF2.output);
    expect(baseF2.code, `F2 --base ${baseSha} --channel zz-probe exits 0:\n${baseF2.output}`).toBe(0);
    expect(baseF2.output, 'F2 --base reports core = 0').toMatch(/core\s*=\s*0/);

    // 4. Negative check: if a core file is also touched alongside packages/channels/zz-probe/**, F2 fails (core > 0, exit 1).
    const leakyPathsFile = path.join(runDir, 'e1-12-ac05-zz-probe-leaky.txt');
    fs.writeFileSync(
      leakyPathsFile,
      [
        'packages/channels/zz-probe/manifest.json',
        'services/cogniate-app/src/app/connections.ts',
        '',
      ].join('\n'),
      { mode: 0o600 },
    );
    const leakyF2 = await channelDiff(['--channel', 'zz-probe', '--paths-from', leakyPathsFile]);
    artifact('e1-12-ac05-f2-leaky.log', leakyF2.output);
    expect(leakyF2.code !== 0, `F2 leaky channel addition exits non-zero:\n${leakyF2.output}`).toBe(true);
    expect(leakyF2.output, 'F2 leaky output names services/cogniate-app/src/app/connections.ts').toContain(
      'services/cogniate-app/src/app/connections.ts',
    );
  });
});
