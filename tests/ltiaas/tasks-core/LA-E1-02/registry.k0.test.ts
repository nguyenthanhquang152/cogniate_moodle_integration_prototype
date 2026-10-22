// LA-E1-02 K0 and DOC acceptance tests: kernel package, baseline manifests, app registry, fitness-scope.json,
// K0 script line in `npm run check`, and workspace query (TD-03).
// Source: docs/architecture/ltiaas/tasks/LA-E1-02.md (AC-LA-E1-02-01 to -04, -07, -08, -10);
// LA-ADR-01 D1–D4, D10, D11; docs/architecture/ltiaas/README.md §4; TEST-STRATEGY §2.7, §3.1, §3.5 item 5.
// QA-3 wrote these tests from the spec and the design only (test-first). Runs inside a prepared clone (README.md).
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  ROOT, artifact, npmCheck, requireRunDir, requireScratchClone, run, scriptEchoes, type RunResult,
} from '../LA-E1-04/fitness';

// Public surface of @cogniate/channel-kernel (docs/architecture/ltiaas/tasks/README.md §3; LA-ADR-01 D2–D4).
interface ChannelManifest {
  id: string;
  family: string;
  names: { text: string; label: string };
  card: { title: string; description: string; mark: string; color: string; category: string; order: number };
  availability: 'ga' | 'preview' | 'simulation-only';
  registration: Array<{
    method: 'dynamic' | 'manual';
    authority: 'self' | 'operatorGrant';
    profiles: string[];
    defaultProfile: string;
  }>;
  capabilities: Record<string, unknown>;
  lti?: {
    guardedFamilies: Array<{ family: string; level: 'launch' | 'registration' }>;
    toolConfiguration: 'channel' | 'none';
  };
  setup: { createFields: unknown[]; bindingFields: unknown[]; connectionCheck?: boolean };
  storage?: { tables: string[]; columns: string[] };
  texts: { adminSteps: string[]; teacherSteps: string[]; disconnect: string; notReady: string | null };
}

interface LoadedChannel {
  folder: string;
  manifest: unknown;
  ltiProfiles?: unknown[];
  appAdapter?: unknown;
}

interface LegacyCapabilities {
  dynamicRegistration: boolean;
  operatorApproval: boolean;
  webServices: boolean;
  courseShell: boolean;
  addDeployment: boolean;
  canvasConfiguration: boolean;
}

interface ChannelRegistry {
  channels(): readonly ChannelManifest[];
  channel(id: string): ChannelManifest | null;
  channelOfProfile(profileId: string): string | null;
  ownerOfFamily(family: string): string | null;
  textName(channelId: string | null): string;
  capabilities(channelId: string, profile?: unknown): Record<string, unknown>;
  legacyCapabilities(channelId: string, profile?: unknown): LegacyCapabilities;
}

interface KernelSurface {
  loadChannelFolders(roots: readonly string[], side: 'lti' | 'app'): Promise<LoadedChannel[]>;
  buildChannelRegistry(channels: readonly LoadedChannel[], opts: { simulations: boolean }): ChannelRegistry;
  channelManifestSchema?: { safeParse?: (v: unknown) => { success: boolean }; parse?: (v: unknown) => unknown };
  manifestSchema?: { safeParse?: (v: unknown) => { success: boolean }; parse?: (v: unknown) => unknown };
}

const BASELINE_IDS = ['moodle', 'canvas', 'blackboard'] as const;

const M1_LEGACY_CAPABILITIES: Record<(typeof BASELINE_IDS)[number], LegacyCapabilities> = {
  moodle: {
    dynamicRegistration: true,
    operatorApproval: false,
    webServices: true,
    courseShell: true,
    addDeployment: false,
    canvasConfiguration: false,
  },
  canvas: {
    dynamicRegistration: false,
    operatorApproval: true,
    webServices: false,
    courseShell: false,
    addDeployment: true,
    canvasConfiguration: true,
  },
  blackboard: {
    dynamicRegistration: false,
    operatorApproval: true,
    webServices: false,
    courseShell: false,
    addDeployment: false,
    canvasConfiguration: false,
  },
};

let runDir = '';
let clean: RunResult;
let kernel: KernelSurface;
let loadedBaseline: LoadedChannel[];
let reg: ChannelRegistry;

async function importKernel(): Promise<KernelSurface> {
  const pkgName: string = '@cogniate/channel-kernel';
  return (await import(pkgName)) as KernelSurface;
}

/** Finds a canary root folder in tests/ltiaas/canary if present, else creates one in LA_RUN_DIR (outside the clone). */
function prepareCanaryRoot(loaded: readonly LoadedChannel[]): { root: string; id: string } {
  const repoCanary = path.join(ROOT, 'tests/ltiaas/canary');
  if (fs.existsSync(repoCanary)) {
    const subdirs = fs.readdirSync(repoCanary, { withFileTypes: true }).filter((d) => d.isDirectory());
    const found = subdirs.find((d) => fs.existsSync(path.join(repoCanary, d.name, 'manifest.ts')));
    if (found) return { root: repoCanary, id: found.name };
  }
  const canvasEntry = loaded.find((c) => path.basename(c.folder) === 'canvas');
  expect(canvasEntry, 'baseline canvas manifest is loaded').toBeDefined();
  const base = JSON.parse(JSON.stringify(canvasEntry!.manifest)) as ChannelManifest;
  const canaryId = 'zz-canary';
  const canaryManifest: ChannelManifest = {
    ...base,
    id: canaryId,
    names: { text: 'Canary LMS', label: 'Canary LMS' },
    card: { ...base.card, title: 'Canary LMS', order: 999 },
    availability: 'simulation-only',
    registration: [
      {
        method: 'manual',
        authority: 'operatorGrant',
        profiles: ['zz-canary-sim'],
        defaultProfile: 'zz-canary-sim',
      },
    ],
    lti: {
      toolConfiguration: 'none',
      guardedFamilies: [{ family: 'zz-canary-lms', level: 'registration' }],
    },
  };
  delete canaryManifest.storage;
  const canaryRoot = path.join(runDir, 'canary-root');
  const canaryDir = path.join(canaryRoot, canaryId);
  fs.mkdirSync(canaryDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(
    path.join(canaryDir, 'manifest.ts'),
    `export default ${JSON.stringify(canaryManifest, null, 2)} as const;\n`,
    { mode: 0o600 },
  );
  return { root: canaryRoot, id: canaryId };
}

beforeAll(async () => {
  requireScratchClone();
  runDir = requireRunDir();
  kernel = await importKernel();
  const productRoot = path.join(ROOT, 'packages/channels');
  loadedBaseline = await kernel.loadChannelFolders([productRoot], 'app');
  reg = kernel.buildChannelRegistry(loadedBaseline, { simulations: false });
  clean = await npmCheck('e1-02-check-clean');
});

describe('LA-E1-02 kernel package, baseline manifests and app registry (K0 + DOC)', () => {
  it('AC-LA-E1-02-01: each baseline manifest passes the schema, its id equals its folder name, and channels() returns moodle, canvas, blackboard in order', () => {
    const schema = kernel.channelManifestSchema ?? kernel.manifestSchema;
    for (const id of BASELINE_IDS) {
      const entry = loadedBaseline.find((c) => path.basename(c.folder) === id);
      expect(entry, `packages/channels/${id} is loaded`).toBeDefined();
      const manifest = entry!.manifest as ChannelManifest;
      expect(manifest.id, `manifest.id equals folder name ${id}`).toBe(id);
      if (schema?.safeParse) {
        expect(schema.safeParse(manifest).success, `${id} manifest passes the exported schema`).toBe(true);
      } else if (schema?.parse) {
        expect(() => schema.parse!(manifest)).not.toThrow();
      }
      expect(reg.channel(id)?.id, `registry has channel ${id}`).toBe(id);
    }
    expect(reg.channels().map((c) => c.id), 'channels() order').toEqual(['moodle', 'canvas', 'blackboard']);
    artifact('e1-02-ac01-channels.json', `${JSON.stringify(reg.channels(), null, 2)}\n`);
  });

  it('AC-LA-E1-02-02: the legacy projection of each baseline channel equals its M1 capability object byte for byte', () => {
    const g1Path = path.join(ROOT, 'tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6/G1.json');
    const g1ByLms: Record<string, unknown> = {};
    if (fs.existsSync(g1Path)) {
      const g1 = JSON.parse(fs.readFileSync(g1Path, 'utf8')) as {
        acceptance?: { lmsProviders?: { lms?: Array<{ lms: string; capabilities: unknown }> } };
      };
      for (const row of g1.acceptance?.lmsProviders?.lms ?? []) g1ByLms[row.lms] = row.capabilities;
    }
    const report: Record<string, LegacyCapabilities> = {};
    for (const id of BASELINE_IDS) {
      const actual = reg.legacyCapabilities(id);
      report[id] = actual;
      expect(actual, `${id}: legacyCapabilities equals M1 six-flag object`).toStrictEqual(M1_LEGACY_CAPABILITIES[id]);
      expect(Object.keys(actual).sort(), `${id}: exact 6 legacy flag keys`).toEqual(
        Object.keys(M1_LEGACY_CAPABILITIES[id]).sort(),
      );
      if (g1ByLms[id] !== undefined) {
        expect(actual, `${id}: matches G-BASE G1.json capabilities`).toStrictEqual(g1ByLms[id]);
      }
    }
    artifact('e1-02-ac02-legacy-capabilities.json', `${JSON.stringify(report, null, 2)}\n`);
  });

  it('AC-LA-E1-02-03: ownerOfFamily and textName return the baseline values', () => {
    expect(reg.ownerOfFamily('canvas')).toBe('canvas');
    expect(reg.ownerOfFamily('blackboardlearn')).toBe('blackboard');
    expect(reg.ownerOfFamily('moodle')).toBeNull();
    expect(reg.textName(null)).toBe('Moodle');
    expect(reg.textName('canvas')).toBe('Canvas');
    expect(reg.textName('moodle')).toBe('Moodle');
  });

  it('AC-LA-E1-02-04: loadChannelFolders([<product root>, <QA canary root>], "app") plus buildChannelRegistry loads the canary channel next to the three baseline channels', async () => {
    const productRoot = path.join(ROOT, 'packages/channels');
    const { root: canaryRoot, id: canaryId } = prepareCanaryRoot(loadedBaseline);
    const loaded = await kernel.loadChannelFolders([productRoot, canaryRoot], 'app');
    const withCanary = kernel.buildChannelRegistry(loaded, { simulations: true });
    const ids = withCanary.channels().map((c) => c.id);
    artifact('e1-02-ac04-canary.json', `${JSON.stringify({ canaryRoot, canaryId, ids }, null, 2)}\n`);
    expect(ids.slice(0, 3), 'baseline channels keep their order').toEqual(['moodle', 'canvas', 'blackboard']);
    expect(ids, 'canary channel is loaded next to the baseline channels').toContain(canaryId);
    expect(withCanary.channel(canaryId)?.id).toBe(canaryId);
  });

  it('AC-LA-E1-02-07 (DOC): packages/channel-kernel/fitness-scope.json lists the same classes and globs as README §4', () => {
    const scopePath = path.join(ROOT, 'packages/channel-kernel/fitness-scope.json');
    const readmePath = path.join(ROOT, 'docs/architecture/ltiaas/README.md');
    expect(fs.existsSync(scopePath), 'packages/channel-kernel/fitness-scope.json exists').toBe(true);
    const scopeRaw = fs.readFileSync(scopePath, 'utf8');
    const scope = JSON.parse(scopeRaw) as Record<string, unknown>;
    const readme = fs.readFileSync(readmePath, 'utf8');
    artifact('e1-02-ac07-fitness-scope.json', scopeRaw);

    // Every glob/path from the authoritative table in docs/architecture/ltiaas/README.md §4 (lines 104-110).
    const requiredTokens = [
      'packages/channels/',
      'services/*/src/**',
      'packages/*/src/**',
      'apps/*/src/**',
      'packages/channel-kernel/src/legacy-wire.ts',
      'packages/shared/src/config.ts',
      'package.json',
      'package-lock.json',
      'eslint.config.js',
      'vitest.config.ts',
      'tests/**',
      'docs/**',
    ];
    for (const token of requiredTokens) {
      expect(readme, `README §4 contains ${token}`).toContain(token);
      expect(scopeRaw, `fitness-scope.json contains ${token}`).toContain(token);
    }
    expect(typeof scope === 'object' && scope !== null).toBe(true);
  });

  it('AC-LA-E1-02-08: npm run check runs the K0 suite through the new root script line, and passes', () => {
    expect(clean.code, 'npm run check exits 0 (see e1-02-check-clean.log)').toBe(0);
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const scriptsText = JSON.stringify(pkg.scripts ?? {});
    expect(scriptsText, 'root package.json scripts reference the K0 suite').toMatch(/tests\/ltiaas\/k0|test:k0/);
    const echoes = scriptEchoes(clean.output).join('\n');
    expect(
      /tests\/ltiaas\/k0|test:k0/.test(echoes) || /tests\/ltiaas\/k0/.test(clean.output),
      'npm run check output shows the K0 suite run',
    ).toBe(true);
  });

  it('AC-LA-E1-02-10: npm query .workspace lists packages/channel-kernel and no path under packages/channels/ (TD-03)', async () => {
    const r = await run('npm', ['query', '.workspace']);
    artifact('e1-02-ac10-workspaces.json', r.stdout);
    expect(r.code, `npm query .workspace exits 0; stderr:\n${r.stderr}`).toBe(0);
    const workspaces = JSON.parse(r.stdout) as Array<{ name?: string; location?: string; path?: string }>;
    const locations = workspaces.map((w) => w.location ?? (w.path ? path.relative(ROOT, w.path) : ''));
    expect(locations, 'packages/channel-kernel is an npm workspace').toContain('packages/channel-kernel');
    for (const loc of locations) {
      expect(
        loc === 'packages/channels' || loc.startsWith('packages/channels/'),
        `no workspace under packages/channels/: ${loc}`,
      ).toBe(false);
    }
  });
});
