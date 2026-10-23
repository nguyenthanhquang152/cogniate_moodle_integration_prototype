// LA-E2-03 K0 and UNIT-row acceptance tests (no Docker):
// - AC-LA-E2-03-01: The `lti-generic` manifest passes the schema; its capability set equals the LA-ADR-02 D3 table
//   plus the E3 values of AC-09 and AC-10; its legacy flags are `dynamicRegistration` true, `operatorApproval` true,
//   `addDeployment` true, `webServices`, `courseShell` and `canvasConfiguration` false.
// - AC-LA-E2-03-02: E2-K exit check (LA-ADR-02 D8): a canary folder with an admin-value profile and no `app.ts`
//   (`tests/ltiaas/canary/zz-canary-admin`) passes K0.
// - AC-LA-E2-03-06 & AC-LA-E2-03-08: Author unit tests (`vitest run -t "AC-LA-E2-03-"`) pass, and load check 6 refuses
//   an `lti-generic` manifest variant with `manual` -> `self`.
// - AC-LA-E2-03-09: `capabilities('lti-generic')` has `content.multiple: true`.
// - AC-LA-E2-03-10: `capabilities('lti-generic')` has `registration.scopes` equal to the four AGS scopes `lineitem`,
//   `lineitem.readonly`, `result.readonly`, `score`, and no NRPS scope.
// - AC-LA-E2-03-11: The `lti-generic` profile has `platformStorage = { targetFrame: 'from-login', origin: 'authOrigin' }`
//   (A2 LA-ADR-05 D1 rule 1a).
// Source: docs/architecture/ltiaas/tasks/LA-E2-03.md (at f01bfcd); LA-ADR-01 D2, D3, D4, D5; LA-ADR-02 D2, D3, D8;
// LA-ADR-05 D1 rule 1a, D3b, D4; cogniate-app-api-delta.md §1–§3.
// QA-3 wrote these tests from the spec, contracts and ADRs only (test-first).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  ROOT,
  artifact,
  hasScript,
  npmCheck,
  requireRunDir,
  requireScratchClone,
  run,
  scriptEchoes,
  type RunResult,
} from '../LA-E1-04/fitness';

const FOUR_AGS_SCOPES = [
  'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
  'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
  'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
  'https://purl.imsglobal.org/spec/lti-ags/scope/score',
] as const;

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
}

interface ProfileSourceLike {
  id: string;
  listOrder: number;
  endpoints: 'admin' | 'fixed';
  issuerKind?: 'per-tenant' | 'fixed';
  endpointOrigins?: 'issuer' | 'any-https' | null;
  clientAssertionAud?: unknown;
  dynamicRegistration?: {
    issuerRule: string;
    configurationPath?: string;
    registrationToken: string;
  } | null;
  privacyFloor: 'allowlist' | 'none';
  platformStorage?: { targetFrame: string; origin: string } | null;
  simulation?: boolean;
}

interface LoadedChannel {
  folder: string;
  manifest: ChannelManifest;
  ltiProfiles?: ProfileSourceLike[];
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
  capabilities(channelId: string, profile?: unknown): Record<string, unknown>;
  legacyCapabilities(channelId: string, profile?: unknown): LegacyCapabilities;
}

interface KernelSurface {
  loadChannelFolders(roots: readonly string[], side: 'lti' | 'app'): Promise<LoadedChannel[]>;
  buildChannelRegistry(channels: readonly LoadedChannel[], opts: { simulations: boolean }): ChannelRegistry;
  parseManifest?: (raw: unknown) => ChannelManifest;
}

let clean: RunResult;
let kernel: KernelSurface;
let ltiLoaded: LoadedChannel[];
let appLoaded: LoadedChannel[];
let reg: ChannelRegistry;

beforeAll(async () => {
  requireScratchClone();
  requireRunDir();
  clean = await npmCheck('e2-03-check-clean');
  const kernelEntry = pathToFileURL(path.join(ROOT, 'packages/channel-kernel/src/index.ts')).href;
  kernel = (await import(kernelEntry)) as KernelSurface;
  const channelsRoot = path.join(ROOT, 'packages/channels');
  ltiLoaded = await kernel.loadChannelFolders([channelsRoot], 'lti');
  appLoaded = await kernel.loadChannelFolders([channelsRoot], 'app');
  reg = kernel.buildChannelRegistry(appLoaded, { simulations: true });
});

describe('LA-E2-03 kernel admin-value setup adapter and lti-generic channel (K0 + UNIT rows)', () => {
  it('AC-LA-E2-03-01, AC-LA-E2-03-09, AC-LA-E2-03-10: lti-generic manifest passes schema, has LA-ADR-02 D3 + E3 capabilities (content.multiple: true, 4 AGS scopes, no NRPS), and expected legacy flags', () => {
    expect(clean.code, `npm run check exits 0 on clean tree:\n${clean.output}`).toBe(0);
    const echoes = scriptEchoes(clean.output);
    expect(echoes.some((s) => /fitness:lms-names|lms-names/.test(s)), 'npm run check ran F1').toBe(true);

    // 1. Folder layout: manifest.ts, lti-profiles.ts, README.md exist; no app.ts (uses kernel admin-value adapter).
    const genericDir = path.join(ROOT, 'packages/channels/lti-generic');
    expect(fs.existsSync(path.join(genericDir, 'manifest.ts')), 'lti-generic/manifest.ts exists').toBe(true);
    expect(fs.existsSync(path.join(genericDir, 'lti-profiles.ts')), 'lti-generic/lti-profiles.ts exists').toBe(true);
    expect(fs.existsSync(path.join(genericDir, 'README.md')), 'lti-generic/README.md exists').toBe(true);
    expect(fs.existsSync(path.join(genericDir, 'app.ts')), 'lti-generic has no app.ts (kernel admin-value adapter)').toBe(
      false,
    );

    const manifest = reg.channel('lti-generic');
    expect(manifest, 'lti-generic is registered in ChannelRegistry').not.toBeNull();
    if (typeof kernel.parseManifest === 'function') {
      expect(() => kernel.parseManifest!(manifest)).not.toThrow();
    }

    expect(manifest!.names).toEqual({ text: 'your LMS', label: 'Other LTI 1.3 platform' });
    expect(manifest!.registration).toEqual([
      { method: 'dynamic', authority: 'self', profiles: ['lti-generic'], defaultProfile: 'lti-generic' },
      { method: 'manual', authority: 'operatorGrant', profiles: ['lti-generic'], defaultProfile: 'lti-generic' },
    ]);

    const caps = reg.capabilities('lti-generic');
    expect(caps['registration.dynamic']).toBe(true);
    expect(caps['binding.authority']).toEqual({ dynamic: 'self', manual: 'operatorGrant' });
    expect(caps['deployments.multiple']).toBe(true);
    expect(caps['records.reporters']).toEqual(['lti-ags']);
    expect(caps['records.readBack']).toBe(true);
    expect(caps['launch.windowHint']).toBe(true);
    expect(caps['siteApi.token']).toBe(false);
    expect(caps['publish.createCourse']).toBe(false);
    expect(caps['setup.artifacts']).toEqual([]);
    expect(caps['export.packages']).toEqual([]);

    // AC-LA-E2-03-09: content.multiple is true.
    expect(caps['content.multiple'], 'AC-LA-E2-03-09: content.multiple is true').toBe(true);

    // AC-LA-E2-03-10: registration.scopes equals the four AGS scopes and no NRPS scope.
    expect(caps['registration.scopes'], 'AC-LA-E2-03-10: four AGS scopes and no NRPS').toEqual([...FOUR_AGS_SCOPES]);
    expect(
      (caps['registration.scopes'] as string[]).some((s) => s.includes('nrps') || s.includes('contextmembership')),
      'no NRPS scope in lti-generic registration.scopes',
    ).toBe(false);

    // AC-LA-E2-03-01: legacy capability flags.
    const legacy = reg.legacyCapabilities('lti-generic');
    expect(legacy).toEqual({
      dynamicRegistration: true,
      operatorApproval: true,
      addDeployment: true,
      webServices: false,
      courseShell: false,
      canvasConfiguration: false,
    });

    artifact('e2-03-ac01-09-10-manifest.json', `${JSON.stringify({ manifest, caps, legacy }, null, 2)}\n`);
  });

  it('AC-LA-E2-03-11: lti-generic profile has platformStorage = { targetFrame: "from-login", origin: "authOrigin" } and E2 traits', () => {
    const genericLti = ltiLoaded.find((c) => c.manifest.id === 'lti-generic');
    expect(genericLti, 'lti-generic loaded on lti side').toBeDefined();
    const profile = genericLti!.ltiProfiles?.find((p) => p.id === 'lti-generic');
    expect(profile, 'lti-generic profile exists').toBeDefined();

    expect(profile!.endpoints).toBe('admin');
    expect(profile!.issuerKind).toBe('per-tenant');
    expect(profile!.endpointOrigins).toBe('any-https');
    expect(profile!.privacyFloor).toBe('allowlist');
    expect(profile!.dynamicRegistration).toEqual({
      issuerRule: 'path-prefix',
      registrationToken: 'opaque-bearer',
    });
    expect(profile!.platformStorage, 'AC-LA-E2-03-11: platformStorage rule 1a').toEqual({
      targetFrame: 'from-login',
      origin: 'authOrigin',
    });

    // Load check 7 (BD-A1-23): non-baseline profile listOrder is > the largest baseline listOrder (70, simulations included),
    // and sorted provider order places real channels before simulations (so lti-generic is after baseline real profiles and before simulation profiles).
    const allProfiles = ltiLoaded.flatMap((c) => c.ltiProfiles ?? []);
    const baselineMaxOrder = Math.max(
      ...allProfiles
        .filter((p) =>
          [
            'standard',
            'canvas-cloud-production',
            'canvas-cloud-beta',
            'canvas-cloud-test',
            'canvas-self-hosted',
            'blackboard',
            'blackboard-sim',
            'canvas-sim-cloud',
            'canvas-sim-self',
          ].includes(p.id),
        )
        .map((p) => p.listOrder),
    );
    expect(
      profile!.listOrder,
      `lti-generic listOrder (${profile!.listOrder}) > baseline max (${baselineMaxOrder}) per BD-A1-23`,
    ).toBeGreaterThan(baselineMaxOrder);

    const sortedProfiles = [...allProfiles].sort((a, b) => {
      const aSim = Boolean(a.simulation);
      const bSim = Boolean(b.simulation);
      if (aSim !== bSim) return aSim ? 1 : -1;
      if (a.listOrder !== b.listOrder) return a.listOrder - b.listOrder;
      return a.id.localeCompare(b.id);
    });
    const genericIdx = sortedProfiles.findIndex((p) => p.id === 'lti-generic');
    expect(genericIdx, 'lti-generic present in sorted provider order').toBeGreaterThanOrEqual(0);
    for (const bpId of [
      'standard',
      'canvas-cloud-production',
      'canvas-cloud-beta',
      'canvas-cloud-test',
      'canvas-self-hosted',
      'blackboard',
    ]) {
      const bpIdx = sortedProfiles.findIndex((p) => p.id === bpId);
      expect(genericIdx, `lti-generic index (${genericIdx}) > baseline real ${bpId} (${bpIdx})`).toBeGreaterThan(bpIdx);
    }
    for (const sp of sortedProfiles.filter((p) => p.simulation)) {
      const spIdx = sortedProfiles.findIndex((p) => p.id === sp.id);
      expect(genericIdx, `lti-generic index (${genericIdx}) < simulation ${sp.id} (${spIdx})`).toBeLessThan(spIdx);
    }

    artifact('e2-03-ac11-profile.json', `${JSON.stringify(profile, null, 2)}\n`);
  });

  it('AC-LA-E2-03-02: E2-K exit check (LA-ADR-02 D8): canary folder with an admin-value profile and no app.ts (zz-canary-admin) passes K0', async () => {
    const canaryRoot = path.join(ROOT, 'tests/ltiaas/canary');
    const adminCanaryDir = path.join(canaryRoot, 'zz-canary-admin');
    expect(fs.existsSync(path.join(adminCanaryDir, 'manifest.ts')), 'zz-canary-admin/manifest.ts exists').toBe(true);
    expect(fs.existsSync(path.join(adminCanaryDir, 'lti-profiles.ts')), 'zz-canary-admin/lti-profiles.ts exists').toBe(
      true,
    );
    expect(fs.existsSync(path.join(adminCanaryDir, 'app.ts')), 'zz-canary-admin has no app.ts').toBe(false);

    const roots = [path.join(ROOT, 'packages/channels'), canaryRoot];
    const ltiWithCanary = await kernel.loadChannelFolders(roots, 'lti');
    const appWithCanary = await kernel.loadChannelFolders(roots, 'app');
    const regWithCanary = kernel.buildChannelRegistry(appWithCanary, { simulations: true });
    expect(regWithCanary.channel('zz-canary-admin'), 'zz-canary-admin registered in ChannelRegistry').not.toBeNull();
    expect(
      ltiWithCanary.find((c) => c.manifest.id === 'zz-canary-admin')?.ltiProfiles?.[0]?.endpoints,
      'zz-canary-admin profile has endpoints: admin',
    ).toBe('admin');

    const k0Run = hasScript('test:k0')
      ? await run('npm', ['run', 'test:k0'])
      : await run('npx', ['--no-install', 'vitest', 'run', '--config', 'tests/ltiaas/k0/vitest.config.mts']);
    artifact('e2-03-ac02-k0-canary.log', k0Run.output);
    expect(k0Run.code, `test:k0 exits 0 with admin-value canary:\n${k0Run.output}`).toBe(0);
  });

  it('AC-LA-E2-03-06 & AC-LA-E2-03-08: Author unit tests pass, and load check 6 refuses an lti-generic manifest variant with manual -> self', async () => {
    // Direct check of Load check 6 (AC-LA-E2-03-08): lti-generic with manual -> self throws at registry build.
    const genericLoaded = appLoaded.find((c) => c.manifest.id === 'lti-generic');
    expect(genericLoaded, 'lti-generic loaded').toBeDefined();
    const badVariant: LoadedChannel = {
      ...genericLoaded!,
      manifest: {
        ...genericLoaded!.manifest,
        registration: genericLoaded!.manifest.registration.map((r) =>
          r.method === 'manual' ? { ...r, authority: 'self' as const } : r,
        ),
      },
    };
    const mutatedList = appLoaded.map((c) => (c.manifest.id === 'lti-generic' ? badVariant : c));
    expect(
      () => kernel.buildChannelRegistry(mutatedList, { simulations: true }),
      'Load check 6 refuses lti-generic with manual -> self',
    ).toThrow();

    // Run Author unit tests citing AC-LA-E2-03-06 and AC-LA-E2-03-08.
    const unitRes = await run(
      'npx',
      ['--no-install', 'vitest', 'run', '--reporter=verbose', '-t', 'AC-LA-E2-03-'],
      { timeoutMs: 5 * 60_000 },
    );
    artifact('e2-03-unit-rows.log', unitRes.output);
    expect(unitRes.code, `vitest run -t "AC-LA-E2-03-" exits 0:\n${unitRes.output}`).toBe(0);
    for (const acId of ['AC-LA-E2-03-06', 'AC-LA-E2-03-08']) {
      expect(unitRes.output, `unit test output cites ${acId}`).toContain(acId);
    }
  });
});
