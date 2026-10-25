// LA-E6-04 K0 QA suite: Channel capability flags for connection check.
// Uses only the LD-5 public registry entry points:
//   - @cogniate/channel-kernel (packages/channel-kernel/src/index.ts)
//   - services/lti-service/src/profiles/index.ts
// Sources:
//   - docs/architecture/ltiaas/tasks/LA-E6-04.md (AC-LA-E6-04-01..04)
//   - docs/architecture/ltiaas/adr/LA-ADR-08-operability-surface.md D6
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');

interface ChannelManifest {
  id: string;
  registration: readonly { method: string; profiles: readonly string[]; authority: string }[];
  setup: {
    connectionCheck?: boolean;
  };
}

interface LoadedChannel {
  folder: string;
  manifest: ChannelManifest;
}

interface ProfileDef {
  id: string;
  simulation?: boolean;
}

interface ChannelRegistry {
  channels(): readonly ChannelManifest[];
  channel(id: string): ChannelManifest | null;
  capabilities(channelId: string, profile?: ProfileDef): Record<string, unknown>;
}

interface LegacyCapabilities {
  dynamicRegistration: boolean;
  operatorApproval: boolean;
  webServices: boolean;
  courseShell: boolean;
  addDeployment: boolean;
  canvasConfiguration: boolean;
}

interface KernelModule {
  loadChannelFolders(roots: readonly string[], side: 'lti' | 'app'): Promise<LoadedChannel[]>;
  buildChannelRegistry(channels: readonly LoadedChannel[], opts: { simulations: boolean }): ChannelRegistry;
  computeCapabilities(channel: ChannelManifest, profile?: ProfileDef): Record<string, unknown>;
  legacyProjection(caps: Record<string, unknown>): LegacyCapabilities;
}

interface ProfilesModule {
  profileDefinition(id: string): ProfileDef | null;
}

const EXPECTED_LEGACY_FLAGS: Readonly<Record<string, LegacyCapabilities>> = {
  moodle: {
    dynamicRegistration: true,
    operatorApproval: false,
    webServices: true,
    courseShell: true,
    addDeployment: false,
    canvasConfiguration: false,
  },
  canvas: {
    dynamicRegistration: true,
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
  'lti-generic': {
    dynamicRegistration: true,
    operatorApproval: true,
    webServices: false,
    courseShell: false,
    addDeployment: true,
    canvasConfiguration: false,
  },
  brightspace: {
    dynamicRegistration: true,
    operatorApproval: true,
    webServices: false,
    courseShell: false,
    addDeployment: true,
    canvasConfiguration: false,
  },
};

let kernel: KernelModule;
let profilesMod: ProfilesModule;
let appRegistrySim: ChannelRegistry;
let appRegistryProd: ChannelRegistry;
let ltiRegistrySim: ChannelRegistry;

beforeAll(async () => {
  const kernelUrl = pathToFileURL(path.join(ROOT, 'packages/channel-kernel/src/index.ts')).href;
  const profilesUrl = pathToFileURL(path.join(ROOT, 'services/lti-service/src/profiles/index.ts')).href;
  kernel = (await import(kernelUrl)) as KernelModule;
  profilesMod = (await import(profilesUrl)) as ProfilesModule;

  const channelsRoot = path.join(ROOT, 'packages/channels');
  const appLoaded = await kernel.loadChannelFolders([channelsRoot], 'app');
  const ltiLoaded = await kernel.loadChannelFolders([channelsRoot], 'lti');
  appRegistrySim = kernel.buildChannelRegistry(appLoaded, { simulations: true });
  appRegistryProd = kernel.buildChannelRegistry(appLoaded, { simulations: false });
  ltiRegistrySim = kernel.buildChannelRegistry(ltiLoaded, { simulations: true });
});

describe('LA-E6-04 K0: Channel capability flags for connection check (LD-5 public entry points)', () => {
  it('AC-LA-E6-04-01: the registry gives setup.connectionCheck: true for canvas across manifest and all profiles', () => {
    for (const reg of [appRegistrySim, appRegistryProd, ltiRegistrySim]) {
      const ch = reg.channel('canvas');
      expect(ch, 'canvas channel is registered').not.toBeNull();
      expect(ch!.setup.connectionCheck).toBe(true);
      expect(reg.capabilities('canvas')['setup.connectionCheck']).toBe(true);
    }

    const canvas = appRegistrySim.channel('canvas')!;
    const profileIds = new Set(canvas.registration.flatMap((r) => r.profiles));
    expect(profileIds.size).toBeGreaterThan(0);
    for (const pid of profileIds) {
      const prof = profilesMod.profileDefinition(pid) ?? undefined;
      expect(appRegistrySim.capabilities('canvas', prof)['setup.connectionCheck'], `canvas profile ${pid}`).toBe(true);
      expect(kernel.computeCapabilities(canvas, prof)['setup.connectionCheck'], `computeCapabilities canvas ${pid}`).toBe(
        true,
      );
    }
  });

  it('AC-LA-E6-04-02: the registry gives setup.connectionCheck: true for lti-generic across manifest and all profiles', () => {
    for (const reg of [appRegistrySim, appRegistryProd, ltiRegistrySim]) {
      const ch = reg.channel('lti-generic');
      expect(ch, 'lti-generic channel is registered').not.toBeNull();
      expect(ch!.setup.connectionCheck).toBe(true);
      expect(reg.capabilities('lti-generic')['setup.connectionCheck']).toBe(true);
    }

    const generic = appRegistrySim.channel('lti-generic')!;
    const profileIds = new Set(generic.registration.flatMap((r) => r.profiles));
    expect(profileIds.size).toBeGreaterThan(0);
    for (const pid of profileIds) {
      const prof = profilesMod.profileDefinition(pid) ?? undefined;
      expect(
        appRegistrySim.capabilities('lti-generic', prof)['setup.connectionCheck'],
        `lti-generic profile ${pid}`,
      ).toBe(true);
      expect(
        kernel.computeCapabilities(generic, prof)['setup.connectionCheck'],
        `computeCapabilities lti-generic ${pid}`,
      ).toBe(true);
    }
  });

  it('AC-LA-E6-04-03: moodle, blackboard, and brightspace have no setup.connectionCheck in manifest and compute setup.connectionCheck: false', () => {
    for (const channelId of ['moodle', 'blackboard', 'brightspace'] as const) {
      for (const reg of [appRegistrySim, appRegistryProd, ltiRegistrySim]) {
        const ch = reg.channel(channelId);
        expect(ch, `${channelId} channel is registered`).not.toBeNull();
        expect(
          ch!.setup.connectionCheck,
          `${channelId} manifest setup.connectionCheck must be absent/undefined`,
        ).toBeUndefined();
        expect(
           'connectionCheck' in ch!.setup,
          `${channelId} manifest.setup must not define connectionCheck`,
        ).toBe(false);
        expect(
          reg.capabilities(channelId)['setup.connectionCheck'],
          `${channelId} registry capability setup.connectionCheck`,
        ).toBe(false);
      }

      const ch = appRegistrySim.channel(channelId)!;
      const profileIds = new Set(ch.registration.flatMap((r) => r.profiles));
      expect(profileIds.size).toBeGreaterThan(0);
      for (const pid of profileIds) {
        const prof = profilesMod.profileDefinition(pid) ?? undefined;
        expect(
          appRegistrySim.capabilities(channelId, prof)['setup.connectionCheck'],
          `${channelId} profile ${pid}`,
        ).toBe(false);
      }
    }
  });

  it('AC-LA-E6-04-04: the six legacy capability flags of every channel (moodle, canvas, blackboard, lti-generic, brightspace) are unchanged', () => {
    const registeredIds = appRegistrySim
      .channels()
      .map((c) => c.id)
      .sort();
    expect(registeredIds).toEqual(['blackboard', 'brightspace', 'canvas', 'lti-generic', 'moodle']);

    for (const [channelId, expectedLegacy] of Object.entries(EXPECTED_LEGACY_FLAGS)) {
      const ch = appRegistrySim.channel(channelId)!;
      expect(kernel.legacyProjection(appRegistrySim.capabilities(channelId)), `${channelId} default legacyProjection`).toEqual(
        expectedLegacy,
      );

      const profileIds = new Set(ch.registration.flatMap((r) => r.profiles));
      for (const pid of profileIds) {
        const prof = profilesMod.profileDefinition(pid) ?? undefined;
        const caps = kernel.computeCapabilities(ch, prof);
        expect(kernel.legacyProjection(caps), `${channelId} (${pid}) legacyProjection`).toEqual(expectedLegacy);
      }
    }
  });
});
