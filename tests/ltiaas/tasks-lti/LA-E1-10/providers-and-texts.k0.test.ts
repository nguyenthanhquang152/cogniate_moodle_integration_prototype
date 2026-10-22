// LA-E1-10 K0 acceptance tests: F1 count 0 for every task file (except names imported from legacy-wire.ts)
// and K0 profile registry channel/wireLms surface check (AC-LA-E1-10-07).
// Source: docs/architecture/ltiaas/tasks/LA-E1-10.md; LA-ADR-01 D6, D12; LA-ADR-04 D1 S3, S7; tasks/README.md §3.
// QA-4 wrote these tests from the spec, contracts and ADRs only (test-first).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BASELINE_LMS,
  BASELINE_PROFILES,
  checkProfiles,
  sameBaselineFields,
} from '../../lib/open-world.mjs';
import { f1Hits, isF1Core, plainEnv } from '../../tasks-core/LA-E1-04/fitness';

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(here, '../../../..');
const TARGET_ROOT = path.resolve(
  process.env.LA_TARGET_ROOT ?? process.env.QA_REPO_ROOT ?? process.env.LA_SCRATCH_CLONE ?? DEFAULT_ROOT,
);

// Core files named in docs/architecture/ltiaas/tasks/LA-E1-10.md §Files ("May edit").
const TASK_CORE_FILES: readonly string[] = [
  'services/lti-service/src/http/routes/platforms.ts',
  'services/lti-service/src/http/service-context.ts',
  'services/lti-service/src/http/error-page.ts',
  'services/lti-service/src/http/context.ts',
  'services/lti-service/src/http/routes/registration.ts',
  'services/lti-service/src/http/routes/protocol.ts',
  'services/lti-service/src/lti/codes.ts',
  'services/lti-service/src/lti/launch.ts',
  'services/lti-service/src/lti/login.ts',
  'services/lti-service/src/lti/registration.ts',
];

const EXPECTED_CHANNEL_BY_PROFILE: Record<string, string> = {
  standard: 'moodle',
  'canvas-cloud-production': 'canvas',
  'canvas-cloud-beta': 'canvas',
  'canvas-cloud-test': 'canvas',
  'canvas-self-hosted': 'canvas',
  blackboard: 'blackboard',
  'blackboard-sim': 'blackboard',
  'canvas-sim-cloud': 'canvas',
};

interface ProfileRecord extends Record<string, unknown> {
  id: string;
  channel?: string;
  lms?: string | null;
  wireLms?: string | null;
  endpoints?: string;
  simulation?: boolean;
}

interface ProfilesModule {
  listProfiles?: (...args: unknown[]) => ProfileRecord[];
  findProfile?: (id: string, ...rest: unknown[]) => ProfileRecord | undefined | null;
  profileDefinition?: (id: string, ...rest: unknown[]) => ProfileRecord | undefined | null;
}

function writeArtifact(name: string, content: string): void {
  const runDir = process.env.LA_RUN_DIR;
  if (!runDir) return;
  fs.mkdirSync(runDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(runDir, name), content, { mode: 0o600 });
}

function walkTsFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkTsFiles(full));
    else if (entry.isFile() && /\.(?:m|c)?ts$/.test(entry.name) && !/\.test\.(?:m|c)?ts$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Extracts identifiers imported from `legacy-wire.ts` or `@cogniate/channel-kernel` in a TypeScript file. */
function legacyWireImportedNames(text: string): Set<string> {
  const names = new Set<string>();
  const importRe = /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(text)) !== null) {
    const spec = m[2];
    if (spec.includes('legacy-wire') || spec === '@cogniate/channel-kernel') {
      for (const part of m[1].split(',')) {
        const cleaned = part.replace(/\btype\b/g, '').trim();
        if (!cleaned) continue;
        const pieces = cleaned.split(/\s+as\s+/).map((s) => s.trim()).filter(Boolean);
        for (const p of pieces) names.add(p);
      }
    }
  }
  return names;
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
  // Probe at an unmasked core path (not in f1-baseline.json) so baseline entries never hide remaining F1 hits.
  const probePath = `services/lti-service/src/zz-f1-probe-${path.basename(asPath)}`;
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

function checkFullF1(): { code: number | null; output: string } {
  const res = spawnSync('npm', ['run', '--silent', 'fitness:lms-names'], {
    cwd: TARGET_ROOT,
    env: plainEnv(),
    encoding: 'utf8',
    timeout: 120_000,
  });
  return { code: res.status, output: `${res.stdout ?? ''}${res.stderr ?? ''}` };
}

describe('LA-E1-10 S3/S7 LTI service providers channel, endpoints call sites and {LMS} page texts (K0)', () => {
  it('AC-LA-E1-10-07: every file of this task has F1 count 0, except names imported from legacy-wire.ts', async () => {
    // 1. Full F1 check on the target repository exits 0.
    const fullF1 = checkFullF1();
    expect(fullF1.code, `npm run fitness:lms-names exits 0; output:\n${fullF1.output}`).toBe(0);

    // 2. Collect all core files of LA-E1-10: named files plus every core .ts file under services/lti-service/src/profiles/**.
    const profileFiles = walkTsFiles(path.join(TARGET_ROOT, 'services/lti-service/src/profiles')).map((f) =>
      path.relative(TARGET_ROOT, f).split(path.sep).join('/'),
    );
    const taskFiles = Array.from(new Set([...TASK_CORE_FILES, ...profileFiles])).filter(isF1Core).sort();
    expect(taskFiles.length, 'task core file list is non-empty').toBeGreaterThanOrEqual(TASK_CORE_FILES.length);

    // 3. Check f1-baseline.json if present.
    const baselinePath = path.join(TARGET_ROOT, 'infra/scripts/fitness/f1-baseline.json');
    const baselineCounts: Record<string, number> = fs.existsSync(baselinePath)
      ? (JSON.parse(fs.readFileSync(baselinePath, 'utf8')) as Record<string, number>)
      : {};

    const results: Array<{
      file: string;
      totalHits: number;
      nonLegacyWireHits: Array<{ line: number; col: number; token: string; word: string }>;
      baselineCount: number;
    }> = [];

    for (const rel of taskFiles) {
      const abs = path.join(TARGET_ROOT, rel);
      expect(fs.existsSync(abs), `${rel} exists in ${TARGET_ROOT}`).toBe(true);
      const text = fs.readFileSync(abs, 'utf8');
      const importedFromLegacyWire = legacyWireImportedNames(text);
      const f1 = checkF1OnText(rel, text);
      expect(f1.code, `${rel}: passes F1 check; output:\n${f1.output}`).toBe(0);

      const nonLegacyHits = f1.rawHits.filter((h) => !importedFromLegacyWire.has(h.token));
      const baselineCount = baselineCounts[rel] ?? 0;

      results.push({
        file: rel,
        totalHits: f1.rawHits.length,
        nonLegacyWireHits: nonLegacyHits,
        baselineCount,
      });
    }

    const filesWithHits = results.filter((r) => r.nonLegacyWireHits.length > 0);
    expect(
      filesWithHits,
      `Every task file must have 0 F1 hits outside legacy-wire.ts imports, found:\n${JSON.stringify(filesWithHits, null, 2)}`,
    ).toEqual([]);

    if (fs.existsSync(baselinePath)) {
      const filesWithBaselineDebt = results.filter((r) => r.baselineCount > 0);
      expect(
        filesWithBaselineDebt.map((r) => ({ file: r.file, baselineCount: r.baselineCount })),
        'Every task file must have f1-baseline.json count 0 after LA-E1-10',
      ).toEqual([]);
    }

    // 4. Also verify K0 profile registry exposes channel and frozen lms from wireLms for every baseline profile.
    const profilesIndex = path.join(TARGET_ROOT, 'services/lti-service/src/profiles/index.ts');
    const mod = (await import(pathToFileURL(profilesIndex).href)) as ProfilesModule;
    expect(typeof mod.listProfiles, 'listProfiles is exported').toBe('function');
    expect(typeof mod.profileDefinition, 'profileDefinition is exported').toBe('function');

    const prevStack = process.env.STACK_PROFILE;
    const prevSim = process.env.LTI_PROVIDER_SIMULATION;
    let profilesOn: ProfileRecord[] = [];
    try {
      process.env.STACK_PROFILE = 'acceptance';
      process.env.LTI_PROVIDER_SIMULATION = 'on';
      profilesOn = mod.listProfiles!(true);
      const registered = new Set<string>(BASELINE_LMS);
      checkProfiles(profilesOn, BASELINE_PROFILES, { registered, label: 'K0 listProfiles(true)' });
      for (const expected of BASELINE_PROFILES) {
        const actual = profilesOn.find((p) => p.id === expected.id);
        const def = mod.profileDefinition!(expected.id);
        expect(actual, `listProfiles contains ${expected.id}`).toBeDefined();
        expect(def, `profileDefinition('${expected.id}') is defined`).toBeDefined();
        const channel = actual?.channel ?? def?.channel;
        expect(channel, `${expected.id}.channel`).toBe(EXPECTED_CHANNEL_BY_PROFILE[expected.id]);
        sameBaselineFields(actual!, expected, `K0 ${expected.id}`);
      }
    } finally {
      if (prevStack === undefined) delete process.env.STACK_PROFILE;
      else process.env.STACK_PROFILE = prevStack;
      if (prevSim === undefined) delete process.env.LTI_PROVIDER_SIMULATION;
      else process.env.LTI_PROVIDER_SIMULATION = prevSim;
    }

    writeArtifact('e1-10-ac07-f1.json', `${JSON.stringify({ targetRoot: TARGET_ROOT, files: results, profileCount: profilesOn.length }, null, 2)}\n`);
  });
});
