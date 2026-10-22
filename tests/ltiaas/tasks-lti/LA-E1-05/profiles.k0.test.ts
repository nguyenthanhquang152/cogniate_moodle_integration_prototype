// LA-E1-05 K0 acceptance tests: LTI profile registry traits and simulation gating (AC-LA-E1-05-02),
// and F1 count 0 for packages/shared/src/config.ts plus monotone non-increasing F1 counts across task files (AC-LA-E1-05-11).
// Source: docs/architecture/ltiaas/tasks/LA-E1-05.md; LA-ADR-01 D4, D6; LA-ADR-04 D1 S3; tasks/README.md §3, §4 RQ-3.
// QA-4 wrote these tests from the spec, contracts and ADRs only (test-first).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BASELINE_LMS,
  BASELINE_PROFILES,
  BASELINE_REAL_PROFILES,
  BASELINE_SIMULATION_PROFILES,
  checkProfiles,
  checkSimulationProfiles,
  sameBaselineFields,
} from '../../lib/open-world.mjs';
import { f1Hits, isF1Core, plainEnv } from '../../tasks-core/LA-E1-04/fitness';

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(here, '../../../..');
const TARGET_ROOT = path.resolve(process.env.QA_REPO_ROOT ?? process.env.LA_SCRATCH_CLONE ?? DEFAULT_ROOT);
const BASE_SHA = process.env.LA_BASE_SHA ?? 'HEAD~1';

interface ProfileRecord extends Record<string, unknown> {
  id: string;
  lms?: string | null;
  wireLms?: string | null;
  endpoints?: string;
  privacyFloor?: string;
  simulation?: boolean;
}

interface ProfilesModule {
  listProfiles?: (...args: unknown[]) => ProfileRecord[];
  findProfile?: (id: string, ...rest: unknown[]) => ProfileRecord | undefined | null;
  profileDefinition?: (id: string, ...rest: unknown[]) => ProfileRecord | undefined | null;
}

// Baseline F1 counts at G-BASE (1b17261be97c4701b928fa9dc2fa74c6d23028f6) for the non-channel files of LA-E1-05.
const GBASE_F1_COUNTS: Record<string, number> = {
  'packages/shared/src/config.ts': 1,
  'services/lti-service/src/profiles/blackboard.ts': 4,
  'services/lti-service/src/profiles/canvas.ts': 11,
  'services/lti-service/src/profiles/index.ts': 3,
  'services/lti-service/src/profiles/standard.ts': 2,
  'services/lti-service/src/profiles/types.ts': 2,
  'services/lti-service/src/lti/checks.ts': 4,
  'services/lti-service/src/lti/claims.ts': 2,
  'services/lti-service/src/lti/launch.ts': 1,
  'services/lti-service/src/lti/login.ts': 2,
  'services/lti-service/src/lti/registration.ts': 1,
  'services/lti-service/src/lti/target.ts': 2,
  'services/lti-service/src/http/service-context.ts': 0,
  'services/lti-service/src/http/routes/protocol.ts': 0,
  'services/lti-service/src/http/routes/registration.ts': 2,
  'services/lti-service/src/testkit.ts': 2,
  'services/lti-service/src/main.ts': 0,
  'services/cogniate-app/src/testkit.ts': 0,
};

function writeArtifact(name: string, content: string): void {
  const runDir = process.env.LA_RUN_DIR;
  if (!runDir) return;
  fs.mkdirSync(runDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(runDir, name), content, { mode: 0o600 });
}

function withSimEnv<T>(simulationsOn: boolean, fn: () => T): T {
  const prevStack = process.env.STACK_PROFILE;
  const prevSim = process.env.LTI_PROVIDER_SIMULATION;
  try {
    process.env.STACK_PROFILE = simulationsOn ? 'acceptance' : 'default';
    process.env.LTI_PROVIDER_SIMULATION = simulationsOn ? 'on' : '';
    return fn();
  } finally {
    if (prevStack === undefined) delete process.env.STACK_PROFILE;
    else process.env.STACK_PROFILE = prevStack;
    if (prevSim === undefined) delete process.env.LTI_PROVIDER_SIMULATION;
    else process.env.LTI_PROVIDER_SIMULATION = prevSim;
  }
}

function callListProfiles(mod: ProfilesModule, simulationsOn: boolean): ProfileRecord[] {
  expect(typeof mod.listProfiles, 'listProfiles is exported as a function').toBe('function');
  return withSimEnv(simulationsOn, () => {
    const first = mod.listProfiles!(simulationsOn);
    if (simulationsOn && Array.isArray(first) && !first.some((p) => p.simulation === true)) {
      const alt = mod.listProfiles!({ simulation: true, includeSimulations: true });
      if (Array.isArray(alt) && alt.some((p) => p.simulation === true)) return alt;
    }
    return first;
  });
}

function callFindProfile(mod: ProfilesModule, id: string, simulationsOn: boolean): ProfileRecord | undefined | null {
  expect(typeof mod.findProfile, 'findProfile is exported as a function').toBe('function');
  return withSimEnv(simulationsOn, () => {
    const first = mod.findProfile!(id, simulationsOn);
    if (simulationsOn && !first) {
      return mod.findProfile!(id, { simulation: true, includeSimulations: true });
    }
    return first;
  });
}

function callProfileDefinition(mod: ProfilesModule, id: string, simulationsOn = true): ProfileRecord | undefined | null {
  expect(typeof mod.profileDefinition, 'profileDefinition is exported as a function').toBe('function');
  return withSimEnv(simulationsOn, () => {
    const first = mod.profileDefinition!(id, simulationsOn);
    if (simulationsOn && !first) {
      return mod.profileDefinition!(id, { simulation: true, includeSimulations: true });
    }
    return first;
  });
}

/** Runs F1 in check-one-text mode (`npm run --silent fitness:lms-names -- --stdin --as <asPath>`) in TARGET_ROOT. */
function checkF1OnText(asPath: string, text: string): { code: number | null; output: string; hitsCount: number } {
  const res = spawnSync('npm', ['run', '--silent', 'fitness:lms-names', '--', '--stdin', '--as', asPath], {
    cwd: TARGET_ROOT,
    env: plainEnv(),
    input: text,
    encoding: 'utf8',
    timeout: 60_000,
  });
  const output = `${res.stdout ?? ''}${res.stderr ?? ''}`;
  const hitsCount = f1Hits(output).filter((h) => h.path === asPath).length;
  return { code: res.status, output, hitsCount };
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

describe('LA-E1-05 LTI profiles in channel folders (K0)', () => {
  it('AC-LA-E1-05-02: profile registry API exposes baseline endpoints, privacyFloor and wireLms traits, and gates simulation profiles', async () => {
    const profilesIndex = path.join(TARGET_ROOT, 'services/lti-service/src/profiles/index.ts');
    expect(fs.existsSync(profilesIndex), `services/lti-service/src/profiles/index.ts exists in ${TARGET_ROOT}`).toBe(true);

    const mod = (await import(pathToFileURL(profilesIndex).href)) as ProfilesModule;
    expect(typeof mod.listProfiles, 'listProfiles is exported').toBe('function');
    expect(typeof mod.findProfile, 'findProfile is exported').toBe('function');
    expect(typeof mod.profileDefinition, 'profileDefinition is exported').toBe('function');

    // 1. Check each baseline profile's traits via profileDefinition and findProfile (with simulations on).
    const traitSummary: Array<Record<string, unknown>> = [];
    for (const expected of BASELINE_PROFILES) {
      const def = callProfileDefinition(mod, expected.id, true);
      const found = callFindProfile(mod, expected.id, true);
      expect(def, `profileDefinition('${expected.id}') is defined`).toBeDefined();
      expect(found, `findProfile('${expected.id}') with simulations on is defined`).toBeDefined();

      const record = { ...found, ...def };
      const wantEndpoints = expected.id === 'standard' ? 'admin' : 'fixed';
      const wantPrivacyFloor = expected.id === 'standard' ? 'none' : 'allowlist';
      const wantWireLms = expected.lms;

      expect(record.endpoints, `${expected.id}.endpoints`).toBe(wantEndpoints);
      expect(record.privacyFloor, `${expected.id}.privacyFloor`).toBe(wantPrivacyFloor);
      expect(record.wireLms, `${expected.id}.wireLms`).toBe(wantWireLms);
      expect(record.simulation, `${expected.id}.simulation`).toBe(expected.simulation);

      traitSummary.push({
        id: expected.id,
        endpoints: record.endpoints,
        privacyFloor: record.privacyFloor,
        wireLms: record.wireLms,
        simulation: record.simulation,
      });
    }

    // 2. Simulations ON: all 8 baseline profiles in exact baseline order and values.
    const registered = new Set<string>(BASELINE_LMS);
    const listOn = callListProfiles(mod, true);
    checkProfiles(listOn, BASELINE_PROFILES, { registered, label: 'listProfiles(simulations=on)' });
    const simIdsOn = listOn.filter((p) => p.simulation === true).map((p) => p.id);
    checkSimulationProfiles(simIdsOn, BASELINE_SIMULATION_PROFILES, {
      profiles: listOn,
      registered,
      label: 'listProfiles(simulations=on) simulation_profiles',
    });
    expect(
      listOn.slice(0, BASELINE_PROFILES.length).map((p) => p.id),
      'simulations on: baseline profile ids and order',
    ).toEqual(BASELINE_PROFILES.map((p) => p.id));
    for (let i = 0; i < BASELINE_PROFILES.length; i++) {
      sameBaselineFields(listOn[i], BASELINE_PROFILES[i], `simulations on: ${BASELINE_PROFILES[i].id}`);
    }

    // 3. Simulations OFF: only the 6 real profiles; simulation profiles do not exist in listProfiles or findProfile.
    const listOff = callListProfiles(mod, false);
    checkProfiles(listOff, BASELINE_REAL_PROFILES, { registered, realOnly: true, label: 'listProfiles(simulations=off)' });
    const simIdsOff = listOff.filter((p) => p.simulation === true).map((p) => p.id);
    checkSimulationProfiles(simIdsOff, [], {
      profiles: listOff,
      registered,
      label: 'listProfiles(simulations=off) simulation_profiles',
    });
    expect(
      listOff.slice(0, BASELINE_REAL_PROFILES.length).map((p) => p.id),
      'simulations off: baseline real profile ids and order',
    ).toEqual(BASELINE_REAL_PROFILES.map((p) => p.id));

    for (const simId of BASELINE_SIMULATION_PROFILES) {
      expect(listOff.find((p) => p.id === simId), `simulations off: listProfiles omits ${simId}`).toBeUndefined();
      const foundSimOff = callFindProfile(mod, simId, false);
      expect(foundSimOff ?? undefined, `simulations off: findProfile('${simId}') is undefined`).toBeUndefined();
    }
    for (const realProfile of BASELINE_REAL_PROFILES) {
      const foundRealOff = callFindProfile(mod, realProfile.id, false);
      expect(foundRealOff, `simulations off: findProfile('${realProfile.id}') is defined`).toBeDefined();
    }

    writeArtifact('e1-05-ac02-traits.json', `${JSON.stringify({ traits: traitSummary, countOn: listOn.length, countOff: listOff.length }, null, 2)}\n`);
  });

  it('AC-LA-E1-05-11: packages/shared/src/config.ts has F1 count 0, and F1 counts of every task file go down or stay (RQ-3)', () => {
    // 1. Full F1 check (`npm run fitness:lms-names`) on the target repository passes.
    const fullF1 = checkFullF1();
    expect(fullF1.code, `npm run fitness:lms-names exits 0; output:\n${fullF1.output}`).toBe(0);

    // 2. Live F1 scan of packages/shared/src/config.ts has 0 hits.
    const sharedConfigRel = 'packages/shared/src/config.ts';
    const sharedConfigAbs = path.join(TARGET_ROOT, sharedConfigRel);
    expect(fs.existsSync(sharedConfigAbs), `${sharedConfigRel} exists`).toBe(true);
    const sharedConfigText = fs.readFileSync(sharedConfigAbs, 'utf8');
    const sharedConfigF1 = checkF1OnText(sharedConfigRel, sharedConfigText);
    expect(sharedConfigF1.code, `${sharedConfigRel} passes F1; output:\n${sharedConfigF1.output}`).toBe(0);
    expect(sharedConfigF1.hitsCount, `${sharedConfigRel} has F1 count 0`).toBe(0);

    // 3. If packages/channel-kernel/fitness-scope.json exists (RQ-1), packages/shared/src/config.ts is not in f1Exceptions.
    const scopeFile = path.join(TARGET_ROOT, 'packages/channel-kernel/fitness-scope.json');
    if (fs.existsSync(scopeFile)) {
      const scopeDoc = JSON.parse(fs.readFileSync(scopeFile, 'utf8')) as {
        f1Exceptions?: Array<string | { path?: string }>;
      };
      const exceptions = (scopeDoc.f1Exceptions ?? []).map((e) => (typeof e === 'string' ? e : e.path ?? ''));
      expect(exceptions, 'packages/shared/src/config.ts removed from f1Exceptions').not.toContain(sharedConfigRel);
    }

    // 4. If f1-baseline.json exists, packages/shared/src/config.ts has count 0 and no task file exceeds G-BASE.
    const baselineFile = path.join(TARGET_ROOT, 'infra/scripts/fitness/f1-baseline.json');
    let baselineFiles: Record<string, number> = {};
    if (fs.existsSync(baselineFile)) {
      const baselineDoc = JSON.parse(fs.readFileSync(baselineFile, 'utf8')) as { files?: Record<string, number> } & Record<string, unknown>;
      baselineFiles =
        baselineDoc.files && typeof baselineDoc.files === 'object'
          ? baselineDoc.files
          : (baselineDoc as unknown as Record<string, number>);
      expect(baselineFiles[sharedConfigRel] ?? 0, `f1-baseline.json count for ${sharedConfigRel}`).toBe(0);
    }

    // 5. Collect all non-channel files of LA-E1-05 (fixed list + any file under services/lti-service/src/profiles/**).
    const profileFiles = walkTsFiles(path.join(TARGET_ROOT, 'services/lti-service/src/profiles')).map((f) =>
      path.relative(TARGET_ROOT, f).split(path.sep).join('/'),
    );
    const taskFiles = Array.from(new Set([...Object.keys(GBASE_F1_COUNTS), ...profileFiles])).sort();

    const deltas: Array<{ file: string; gbaseCount: number; baselineJsonCount: number; liveHits: number }> = [];
    for (const rel of taskFiles) {
      const gbaseCount = GBASE_F1_COUNTS[rel] ?? 0;
      const baselineJsonCount = baselineFiles[rel] ?? 0;
      if (fs.existsSync(baselineFile)) {
        expect(
          baselineJsonCount,
          `${rel}: f1-baseline.json count (${baselineJsonCount}) <= G-BASE (${gbaseCount})`,
        ).toBeLessThanOrEqual(gbaseCount);
      }

      const abs = path.join(TARGET_ROOT, rel);
      if (!fs.existsSync(abs) || !isF1Core(rel)) {
        deltas.push({ file: rel, gbaseCount, baselineJsonCount, liveHits: 0 });
        continue;
      }
      const text = fs.readFileSync(abs, 'utf8');
      const res = checkF1OnText(rel, text);
      expect(res.code, `${rel}: passes F1 check; output:\n${res.output}`).toBe(0);
      expect(res.hitsCount, `${rel}: live F1 hit count (${res.hitsCount}) <= G-BASE (${gbaseCount})`).toBeLessThanOrEqual(gbaseCount);
      deltas.push({ file: rel, gbaseCount, baselineJsonCount, liveHits: res.hitsCount });
    }

    // 6. Also check every core file changed between BASE_SHA and HEAD.
    const baseShaRes = spawnSync('git', ['rev-parse', BASE_SHA], { cwd: TARGET_ROOT, encoding: 'utf8' });
    if (baseShaRes.status === 0) {
      const baseSha = baseShaRes.stdout.trim();
      const diffRes = spawnSync('git', ['diff', '--name-only', baseSha, 'HEAD'], { cwd: TARGET_ROOT, encoding: 'utf8' });
      const changedCore = (diffRes.stdout ?? '').split('\n').map((s) => s.trim()).filter(isF1Core);
      for (const rel of changedCore) {
        const abs = path.join(TARGET_ROOT, rel);
        if (!fs.existsSync(abs)) continue;
        const headRes = checkF1OnText(rel, fs.readFileSync(abs, 'utf8'));
        expect(headRes.code, `${rel}: passes F1 ratchet at HEAD; output:\n${headRes.output}`).toBe(0);
        const showBase = spawnSync('git', ['show', `${baseSha}:${rel}`], { cwd: TARGET_ROOT, encoding: 'utf8' });
        if (showBase.status === 0) {
          const baseRes = checkF1OnText(rel, showBase.stdout);
          expect(
            headRes.hitsCount,
            `${rel}: F1 hits at HEAD (${headRes.hitsCount}) <= at ${baseSha.slice(0, 7)} (${baseRes.hitsCount})`,
          ).toBeLessThanOrEqual(baseRes.hitsCount);
        } else {
          expect(headRes.hitsCount, `new core file ${rel}: 0 F1 hits`).toBe(0);
        }
      }
    }

    writeArtifact('e1-05-ac11-f1-deltas.json', `${JSON.stringify({ targetRoot: TARGET_ROOT, deltas }, null, 2)}\n`);
  });
});
