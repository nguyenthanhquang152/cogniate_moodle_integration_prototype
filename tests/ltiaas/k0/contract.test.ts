// LA-E7-01 K0 channel contract suite and canary verification (no Docker).
// Runs inside `npm run check` via `vitest run --config tests/ltiaas/k0/vitest.config.mts`.
// Imports only the public entry points permitted by `docs/architecture/ltiaas/tasks/README.md` §3:
//   1. `@cogniate/channel-kernel` (LA-E1-02)
//   2. `services/lti-service/src/profiles/index.ts` (LA-E1-05)
//   3. `services/cogniate-app/src/kernel/ports.ts` (LA-E1-07, when present)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BASELINE_PROFILE_WIRE_LMS,
  CAPABILITY_CATALOG,
  CAPABILITY_IDS,
  CHANNEL_ID_PATTERN,
  DEVELOPER_KEY_JSON_ARTIFACT,
  LAUNCH_GUARD_CHANNELS,
  MANUAL_SELF_LEGACY_CHANNELS,
  RegistryError,
  TEXT_PLACEHOLDERS,
  buildChannelRegistry,
  capabilityProblem,
  computeCapabilities,
  fillText,
  legacyProjection,
  loadChannelFolders,
  parseChannelManifest,
} from '@cogniate/channel-kernel';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const productRoot = path.join(repoRoot, 'packages/channels');
const canaryRoot = path.join(repoRoot, 'tests/ltiaas/canary');
const appPortsPath = path.join(repoRoot, 'services/cogniate-app/src/kernel/ports.ts');
const ltiProfilesIndexPath = path.join(repoRoot, 'services/lti-service/src/profiles/index.ts');

interface ChannelManifest {
  id: string;
  family: string;
  names: { text: string; label: string };
  card: {
    title: string;
    description: string;
    mark: string;
    color: string;
    category: string;
    order: number;
  };
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
  setup: {
    createFields: Array<{ key: string; label: string; kind: string; required: boolean }>;
    bindingFields: Array<{ key: string; label: string; kind: string; required: boolean; method?: string }>;
    connectionCheck?: boolean;
  };
  storage?: { tables: string[]; columns: string[] };
  texts: {
    adminSteps: string[];
    teacherSteps: string[];
    disconnect: string;
    notReady: string | null;
  };
}

interface LoadedChannel {
  folder: string;
  manifest: ChannelManifest;
  ltiProfiles?: Array<Record<string, unknown>>;
  appAdapter?: Record<string, unknown>;
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

interface ProfileRecord extends Record<string, unknown> {
  id: string;
  channel: string;
  lms: string | null;
  wireLms?: string | null;
  endpoints: 'fixed' | 'admin';
  privacyFloor: 'allowlist' | 'none';
  sharing: 'exclusive' | 'shared';
  issuer: string | null;
  authenticationEndpoint: string | null;
  accesstokenEndpoint: string | null;
  jwksUrl: string | null;
  siteUrlOn: 'platform' | 'deployment' | null;
  serviceUrl: boolean;
  simulation: boolean;
  productFamily: string | null;
  flags: {
    deepLinkingResponseSub: boolean;
    clientAssertionAudArray: boolean;
    serviceOriginCheck: boolean;
  };
  sources: string[];
}

interface ProfileRegistry {
  channels(simulation: boolean): ChannelRegistry;
  listProfiles(simulation: boolean): readonly ProfileRecord[];
}

interface LtiProfilesModule {
  buildProfileRegistry(loaded: readonly LoadedChannel[]): ProfileRegistry;
  listProfiles(opts: { simulation: boolean; registry?: ProfileRegistry }): readonly ProfileRecord[];
  findProfile(id: string, opts: { simulation: boolean; registry?: ProfileRegistry }): ProfileRecord | null;
  profileDefinition(id: string, source?: ProfileRegistry): ProfileRecord | null;
}

// Guard table from LA-ADR-01 D3 (capability catalog and guards).
export interface CapabilityGuardSpec {
  id: string;
  catalogKey: string;
  status: number;
  code: 'DYNAMIC_REGISTRATION_NOT_SUPPORTED' | 'CAPABILITY_NOT_SUPPORTED' | 'PLACEMENT_NOT_GRADED';
  detailsCapability: string;
  legacyFlag?: keyof LegacyCapabilities;
  isSupported(caps: Record<string, unknown>): boolean;
}

export const CAPABILITY_GUARD_TABLE: readonly CapabilityGuardSpec[] = [
  {
    id: 'registration.dynamic',
    catalogKey: 'registration.dynamic',
    status: 409,
    code: 'DYNAMIC_REGISTRATION_NOT_SUPPORTED',
    detailsCapability: 'dynamicRegistration',
    legacyFlag: 'dynamicRegistration',
    isSupported: (caps) => caps['registration.dynamic'] === true,
  },
  {
    id: 'binding.authority.operatorGrant',
    catalogKey: 'binding.authority',
    status: 409,
    code: 'CAPABILITY_NOT_SUPPORTED',
    detailsCapability: 'operatorApproval',
    legacyFlag: 'operatorApproval',
    isSupported: (caps) => {
      const auth = caps['binding.authority'];
      if (!auth || typeof auth !== 'object') return false;
      return Object.values(auth as Record<string, unknown>).includes('operatorGrant');
    },
  },
  {
    id: 'deployments.multiple',
    catalogKey: 'deployments.multiple',
    status: 409,
    code: 'CAPABILITY_NOT_SUPPORTED',
    detailsCapability: 'addDeployment',
    legacyFlag: 'addDeployment',
    isSupported: (caps) => caps['deployments.multiple'] === true,
  },
  {
    id: 'setup.artifacts.developer-key-json',
    catalogKey: 'setup.artifacts',
    status: 409,
    code: 'CAPABILITY_NOT_SUPPORTED',
    detailsCapability: 'canvasConfiguration',
    legacyFlag: 'canvasConfiguration',
    isSupported: (caps) =>
      Array.isArray(caps['setup.artifacts']) &&
      (caps['setup.artifacts'] as unknown[]).includes(DEVELOPER_KEY_JSON_ARTIFACT),
  },
  {
    id: 'siteApi.token',
    catalogKey: 'siteApi.token',
    status: 409,
    code: 'CAPABILITY_NOT_SUPPORTED',
    detailsCapability: 'webServices',
    legacyFlag: 'webServices',
    isSupported: (caps) => caps['siteApi.token'] === true,
  },
  {
    id: 'publish.createCourse',
    catalogKey: 'publish.createCourse',
    status: 409,
    code: 'CAPABILITY_NOT_SUPPORTED',
    detailsCapability: 'courseShell',
    legacyFlag: 'courseShell',
    isSupported: (caps) => caps['publish.createCourse'] === true,
  },
  {
    id: 'export.packages.mbz',
    catalogKey: 'export.packages',
    status: 409,
    code: 'CAPABILITY_NOT_SUPPORTED',
    detailsCapability: 'export.packages',
    isSupported: (caps) =>
      Array.isArray(caps['export.packages']) && (caps['export.packages'] as unknown[]).includes('mbz'),
  },
  {
    id: 'export.packages.common-cartridge-1.3',
    catalogKey: 'export.packages',
    status: 409,
    code: 'CAPABILITY_NOT_SUPPORTED',
    detailsCapability: 'export.packages',
    isSupported: (caps) =>
      Array.isArray(caps['export.packages']) &&
      (caps['export.packages'] as unknown[]).includes('common-cartridge-1.3'),
  },
  {
    id: 'content.ungraded',
    catalogKey: 'content.ungraded',
    status: 400,
    code: 'PLACEMENT_NOT_GRADED',
    detailsCapability: 'content.ungraded',
    isSupported: (caps) => caps['content.ungraded'] === true,
  },
  {
    id: 'records.readBack',
    catalogKey: 'records.readBack',
    status: 409,
    code: 'CAPABILITY_NOT_SUPPORTED',
    detailsCapability: 'records.readBack',
    isSupported: (caps) => caps['records.readBack'] === true,
  },
  {
    id: 'setup.connectionCheck',
    catalogKey: 'setup.connectionCheck',
    status: 409,
    code: 'CAPABILITY_NOT_SUPPORTED',
    detailsCapability: 'setup.connectionCheck',
    isSupported: (caps) => caps['setup.connectionCheck'] === true,
  },
];

const M1_BASELINE_LEGACY_FLAGS: Record<string, LegacyCapabilities> = {
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

function makeThrowingStub(label: string): unknown {
  const fail = (prop: string | symbol) => {
    throw new Error(`K-ADAPTER forbidden ${label} access: ${String(prop)}`);
  };
  return new Proxy(function () {}, {
    get(_target, prop) {
      if (prop === 'then') return undefined;
      return fail(prop);
    },
    apply() {
      return fail('apply');
    },
  });
}

function mergeLoaded(appLoaded: readonly LoadedChannel[], ltiLoaded: readonly LoadedChannel[]): LoadedChannel[] {
  const ltiByFolder = new Map(ltiLoaded.map((c) => [c.folder, c.ltiProfiles ?? []]));
  return appLoaded.map((c) => ({
    ...c,
    ltiProfiles: ltiByFolder.get(c.folder) ?? [],
  }));
}

// Top-level discovery of product channels and canary channels so `describe.each` registers
// one suite per discovered channel with no test edits when a channel folder is added (AC-LA-E7-01-02).
const ltiProfilesMod = fs.existsSync(ltiProfilesIndexPath)
  ? ((await import(pathToFileURL(ltiProfilesIndexPath).href)) as LtiProfilesModule)
  : null;

const productAppLoaded = (await loadChannelFolders([productRoot], 'app')) as LoadedChannel[];
const productLtiLoaded = (await loadChannelFolders([productRoot], 'lti')) as LoadedChannel[];
const productMerged = mergeLoaded(productAppLoaded, productLtiLoaded);
const productRegistry = buildChannelRegistry(productMerged, { simulations: true }) as ChannelRegistry;
const productLiveRegistry = buildChannelRegistry(productMerged, { simulations: false }) as ChannelRegistry;
const productProfileRegistry = ltiProfilesMod ? ltiProfilesMod.buildProfileRegistry(productMerged) : null;

const combinedAppLoaded = (await loadChannelFolders([productRoot, canaryRoot], 'app')) as LoadedChannel[];
const combinedLtiLoaded = (await loadChannelFolders([productRoot, canaryRoot], 'lti')) as LoadedChannel[];
const combinedMerged = mergeLoaded(combinedAppLoaded, combinedLtiLoaded);
const combinedRegistry = buildChannelRegistry(combinedMerged, { simulations: true }) as ChannelRegistry;
const combinedLiveRegistry = buildChannelRegistry(combinedMerged, { simulations: false }) as ChannelRegistry;
const combinedProfileRegistry = ltiProfilesMod ? ltiProfilesMod.buildProfileRegistry(combinedMerged) : null;

const productById = new Map(productMerged.map((c) => [c.manifest.id, c]));
const combinedById = new Map(combinedMerged.map((c) => [c.manifest.id, c]));

const productChannelRows = productRegistry.channels().map((m) => [m.id, m] as const);
const canaryChannelRows = combinedRegistry
  .channels()
  .filter((m) => !productById.has(m.id))
  .map((m) => [m.id, m] as const);

function defineChannelContractCases(
  channelId: string,
  manifest: ChannelManifest,
  getContext: () => {
    loaded: LoadedChannel;
    reg: ChannelRegistry;
    liveReg: ChannelRegistry;
    profileReg: ProfileRegistry | null;
  },
): void {
  it(`K-MANIFEST.${channelId}: manifest passes schema, id matches folder, texts use allowed placeholders, and capabilities match catalog`, () => {
    const { loaded, reg, liveReg } = getContext();
    expect(path.basename(loaded.folder), 'folder name equals manifest.id').toBe(channelId);
    expect(CHANNEL_ID_PATTERN.test(channelId), 'channelId matches CHANNEL_ID_PATTERN').toBe(true);

    const parsed = parseChannelManifest(loaded.manifest);
    expect(parsed.ok, `parseChannelManifest(${channelId}) succeeds`).toBe(true);
    expect(capabilityProblem(manifest.capabilities), `capabilityProblem(${channelId}) is null`).toBeNull();

    for (const key of Object.keys(manifest.capabilities)) {
      expect(CAPABILITY_IDS, `capability ${key} is in CAPABILITY_IDS`).toContain(key);
      const spec = (CAPABILITY_CATALOG as Record<string, { kind: string; source: string }>)[key];
      expect(spec?.source, `manifest capability ${key} has source "manifest"`).toBe('manifest');
    }

    expect(reg.channel(channelId), 'simulation registry returns channel').toEqual(manifest);
    expect(reg.textName(channelId), 'textName returns manifest.names.text').toBe(manifest.names.text);
    if (manifest.availability === 'simulation-only') {
      expect(liveReg.channel(channelId), 'simulation-only channel is omitted when simulations=false').toBeNull();
    } else {
      expect(liveReg.channel(channelId)?.id, 'non-simulation channel is present when simulations=false').toBe(
        channelId,
      );
    }

    const allTexts = [
      ...manifest.texts.adminSteps,
      ...manifest.texts.teacherSteps,
      manifest.texts.disconnect,
      ...(manifest.texts.notReady ? [manifest.texts.notReady] : []),
    ];
    const allowedTokens = new Set<string>(
      (TEXT_PLACEHOLDERS as readonly string[]).map((p) => (p.startsWith('{') ? p : `{${p}}`)),
    );
    for (const line of allTexts) {
      const tokens = line.match(/\{[^{}]+\}/g) ?? [];
      for (const token of tokens) {
        expect(allowedTokens.has(token), `${channelId}: placeholder ${token} is in TEXT_PLACEHOLDERS`).toBe(true);
      }
      const filled = fillText(line, {
        LMS: reg.textName(channelId),
        tool: 'Cogniate',
        platform: 'https://lms.example.edu',
      });
      expect(filled, `${channelId}: fillText leaves no unresolved placeholders`).not.toMatch(/\{[^{}]+\}/);
    }
  });

  it(`K-LEGACY.${channelId}: legacyCapabilities projection matches the 6-flag formula and M1 baseline where applicable`, () => {
    const { loaded, reg } = getContext();
    const defaultProfileId = manifest.registration[0]?.defaultProfile;
    const defaultProfile = loaded.ltiProfiles?.find((p) => p.id === defaultProfileId);
    const caps = reg.capabilities(channelId, defaultProfile);
    const legacy = reg.legacyCapabilities(channelId, defaultProfile);

    expect(legacy, 'legacyCapabilities equals legacyProjection(capabilities)').toStrictEqual(legacyProjection(caps));
    expect(Object.keys(legacy).sort(), 'legacyCapabilities has the exact 6 frozen keys').toEqual([
      'addDeployment',
      'canvasConfiguration',
      'courseShell',
      'dynamicRegistration',
      'operatorApproval',
      'webServices',
    ]);

    expect(legacy.dynamicRegistration).toBe(caps['registration.dynamic'] === true);
    expect(legacy.operatorApproval).toBe(
      Object.values((caps['binding.authority'] as Record<string, unknown>) ?? {}).includes('operatorGrant'),
    );
    expect(legacy.webServices).toBe(caps['siteApi.token'] === true);
    expect(legacy.courseShell).toBe(caps['publish.createCourse'] === true);
    expect(legacy.addDeployment).toBe(caps['deployments.multiple'] === true);
    expect(legacy.canvasConfiguration).toBe(
      Array.isArray(caps['setup.artifacts']) &&
        (caps['setup.artifacts'] as unknown[]).includes(DEVELOPER_KEY_JSON_ARTIFACT),
    );

    if (channelId in M1_BASELINE_LEGACY_FLAGS) {
      expect(legacy, `${channelId}: equals M1 six-flag capability object`).toStrictEqual(
        M1_BASELINE_LEGACY_FLAGS[channelId],
      );
    }
  });

  it(`K-CAP.${channelId}.catalog: all 17 catalog capabilities are computed and legacy flags match supported guards`, () => {
    const { loaded, reg } = getContext();
    const defaultProfileId = manifest.registration[0]?.defaultProfile;
    const defaultProfile = loaded.ltiProfiles?.find((p) => p.id === defaultProfileId);
    const caps = reg.capabilities(channelId, defaultProfile);
    const legacy = reg.legacyCapabilities(channelId, defaultProfile);

    for (const capId of CAPABILITY_IDS as readonly string[]) {
      expect(Object.prototype.hasOwnProperty.call(caps, capId), `${channelId}: capability ${capId} is computed`).toBe(
        true,
      );
    }

    for (const guard of CAPABILITY_GUARD_TABLE) {
      expect(CAPABILITY_IDS, `guard catalogKey ${guard.catalogKey} is in CAPABILITY_CATALOG`).toContain(
        guard.catalogKey,
      );
      if (guard.legacyFlag) {
        expect(legacy[guard.legacyFlag], `${channelId}: legacy flag ${guard.legacyFlag} matches guard`).toBe(
          guard.isSupported(caps),
        );
      }
    }
  });

  // Compute the false/absent guarded capabilities for this channel from the catalog and guard table
  // so Vitest registers one `K-CAP` case per false or absent guarded capability (AC-LA-E7-01-04).
  const initialCtx = getContext();
  const initialDefaultProfileId = manifest.registration[0]?.defaultProfile;
  const initialDefaultProfile = initialCtx.loaded.ltiProfiles?.find((p) => p.id === initialDefaultProfileId);
  const initialCaps = initialCtx.reg.capabilities(channelId, initialDefaultProfile);
  const offGuards = CAPABILITY_GUARD_TABLE.filter((g) => !g.isSupported(initialCaps));

  it.each(offGuards.map((g) => [g.id, g.status, g.code, g.detailsCapability, g] as const))(
    `K-CAP.${channelId}.%s: false/absent capability guards with %i %s (details.capability=%s)`,
    (_guardId, status, code, detailsCapability, guard) => {
      const { loaded, reg } = getContext();
      const defaultProfileId = manifest.registration[0]?.defaultProfile;
      const defaultProfile = loaded.ltiProfiles?.find((p) => p.id === defaultProfileId);
      const caps = reg.capabilities(channelId, defaultProfile);
      const legacy = reg.legacyCapabilities(channelId, defaultProfile);

      expect(CAPABILITY_CATALOG, `catalog contains ${guard.catalogKey}`).toHaveProperty([guard.catalogKey]);
      expect(guard.isSupported(caps), `${channelId}: ${guard.id} is false or absent`).toBe(false);
      if (guard.legacyFlag) {
        expect(legacy[guard.legacyFlag], `${channelId}: legacy flag ${guard.legacyFlag} is false`).toBe(false);
      }
      const guardContract = {
        status,
        code,
        details: { capability: detailsCapability },
      };
      expect(guardContract).toEqual({
        status: guard.status,
        code: guard.code,
        details: { capability: guard.detailsCapability },
      });
    },
  );

  it(`K-PROFILE.${channelId}: LTI profiles satisfy ownership, wireLms, endpoint templates, family guards and simulation gating`, () => {
    const { loaded, reg, profileReg } = getContext();
    const declaredProfileIds = Array.from(new Set(manifest.registration.flatMap((r) => r.profiles)));
    expect(declaredProfileIds.length, `${channelId}: declares at least one registration profile`).toBeGreaterThan(0);

    for (const regEntry of manifest.registration) {
      expect(regEntry.profiles, `${channelId}: defaultProfile is in profiles`).toContain(regEntry.defaultProfile);
      if (regEntry.method === 'manual' && regEntry.authority === 'self') {
        expect(
          MANUAL_SELF_LEGACY_CHANNELS,
          `${channelId}: manual+self is restricted to MANUAL_SELF_LEGACY_CHANNELS`,
        ).toContain(channelId);
      }
    }

    for (const guard of manifest.lti?.guardedFamilies ?? []) {
      expect(reg.ownerOfFamily(guard.family), `${channelId}: owns guarded family ${guard.family}`).toBe(channelId);
      if (guard.level === 'launch') {
        expect(
          LAUNCH_GUARD_CHANNELS,
          `${channelId}: launch-level family guard is restricted to LAUNCH_GUARD_CHANNELS`,
        ).toContain(channelId);
      }
    }

    for (const profileId of declaredProfileIds) {
      expect(reg.channelOfProfile(profileId), `${channelId}: channelOfProfile(${profileId})`).toBe(channelId);
      const rawProfile = loaded.ltiProfiles?.find((p) => p.id === profileId);
      expect(rawProfile, `${channelId}: lti-profiles.ts contains ${profileId}`).toBeDefined();

      if (ltiProfilesMod && profileReg) {
        const def = ltiProfilesMod.profileDefinition(profileId, profileReg);
        expect(def, `profileDefinition(${profileId}) is defined`).not.toBeNull();
        expect(def!.channel).toBe(channelId);

        const baselineWireMap = BASELINE_PROFILE_WIRE_LMS as Record<string, string | null>;
        if (Object.prototype.hasOwnProperty.call(baselineWireMap, profileId)) {
          expect(def!.wireLms, `${profileId}: baseline wireLms matches BASELINE_PROFILE_WIRE_LMS`).toBe(
            baselineWireMap[profileId],
          );
          expect(def!.lms).toBe(baselineWireMap[profileId]);
        } else {
          expect(def!.wireLms, `${profileId}: non-baseline profile omits wireLms (BD-A1-06)`).toBeUndefined();
          expect(def!.lms, `${profileId}: non-baseline profile lms equals channel id`).toBe(channelId);
        }

        const foundSimOn = ltiProfilesMod.findProfile(profileId, { simulation: true, registry: profileReg });
        expect(foundSimOn?.id, `findProfile(${profileId}, simulation=true)`).toBe(profileId);

        const foundSimOff = ltiProfilesMod.findProfile(profileId, { simulation: false, registry: profileReg });
        if (def!.simulation || manifest.availability === 'simulation-only') {
          expect(foundSimOff, `simulation profile ${profileId} is hidden when simulation=false`).toBeNull();
        } else {
          expect(foundSimOff?.id, `real profile ${profileId} is visible when simulation=false`).toBe(profileId);
        }

        if (def!.endpoints === 'admin') {
          expect(def!.issuer).toBeNull();
          expect(def!.authenticationEndpoint).toBeNull();
          expect(def!.accesstokenEndpoint).toBeNull();
          expect(def!.jwksUrl).toBeNull();
        } else {
          expect(def!.endpoints).toBe('fixed');
          for (const field of ['issuer', 'authenticationEndpoint', 'accesstokenEndpoint', 'jwksUrl'] as const) {
            const template = def![field];
            expect(typeof template === 'string' && template.length > 0, `${profileId}.${field} is non-empty`).toBe(
              true,
            );
            const filled = (template as string)
              .replaceAll('{siteUrl}', 'https://lms.school.example.edu')
              .replaceAll('{serviceUrl}', 'https://service.school.example.edu')
              .replaceAll('{clientId}', 'client-123');
            expect(() => new URL(filled), `${profileId}.${field} resolves to a valid URL`).not.toThrow();
            expect(new URL(filled).protocol).toBe('https:');
          }
        }
      }
    }
  });

  it(`K-ADAPTER.${channelId}: setup fields and channel app adapter (when present) enforce strict body and run with throwing db/lti stubs`, () => {
    const { loaded } = getContext();
    expect(Array.isArray(manifest.setup.createFields)).toBe(true);
    expect(Array.isArray(manifest.setup.bindingFields)).toBe(true);
    for (const field of [...manifest.setup.createFields, ...manifest.setup.bindingFields]) {
      expect(typeof field.key === 'string' && field.key.length > 0).toBe(true);
      expect(typeof field.label === 'string' && field.label.length > 0).toBe(true);
    }

    const portsExist = fs.existsSync(appPortsPath);
    const needsAdapter =
      manifest.lti?.toolConfiguration === 'channel' ||
      manifest.setup.connectionCheck === true ||
      manifest.capabilities['siteApi.token'] === true ||
      manifest.capabilities['publish.createCourse'] === true;

    if (portsExist && needsAdapter) {
      expect(loaded.appAdapter, `${channelId}: exports app.ts adapter after LA-E1-07`).toBeDefined();
    }
    if (!needsAdapter) {
      // Admin-value channel without adapter requirements (e.g. zz-canary-admin, LA-E2-03 AC-05).
      expect(manifest.lti?.toolConfiguration).toBe('none');
    }

    if (loaded.appAdapter) {
      const adapter = loaded.appAdapter as {
        toolConfiguration?: (input: unknown) => { rows: Array<{ key: string; label: string; value: string }> };
        stageCreate?: (body: unknown, ctx?: unknown) => Record<string, unknown>;
        bindingTarget?: (body: unknown, staged?: unknown, ctx?: unknown) => Record<string, unknown>;
      };
      const throwingCtx = {
        db: makeThrowingStub('db'),
        lti: makeThrowingStub('lti'),
      };

      if (typeof adapter.toolConfiguration === 'function') {
        const config = adapter.toolConfiguration({
          connectionId: 'conn-1',
          publicAppOrigin: 'https://app.cogniate.test',
          publicLtiOrigin: 'https://lti.cogniate.test',
          siteUrl: 'https://canary.sim.test',
          ...throwingCtx,
        });
        expect(Array.isArray(config.rows) && config.rows.length > 0, `${channelId}: toolConfiguration rows`).toBe(true);
        for (const row of config.rows) {
          expect(typeof row.key === 'string' && row.key.length > 0).toBe(true);
          expect(typeof row.label === 'string' && row.label.length > 0).toBe(true);
          expect(typeof row.value === 'string' && row.value.length > 0).toBe(true);
        }
      }

      if (typeof adapter.stageCreate === 'function') {
        const staged = adapter.stageCreate({ siteUrl: 'https://canary.sim.test' }, throwingCtx);
        expect(staged.siteUrl).toBe('https://canary.sim.test');
        expect(() => adapter.stageCreate!({}, throwingCtx), 'missing required field is refused').toThrow();
        expect(
          () => adapter.stageCreate!({ siteUrl: 'https://canary.sim.test', unknownExtra: 1 }, throwingCtx),
          'unknown field is refused (strict body)',
        ).toThrow();
      }

      if (typeof adapter.bindingTarget === 'function') {
        const target = adapter.bindingTarget(
          {
            clientId: 'client-canary-1',
            deploymentId: 'dep-canary-1',
            grantCode: 'grant-canary-1',
          },
          { siteUrl: 'https://canary.sim.test' },
          throwingCtx,
        );
        expect(target.clientId).toBe('client-canary-1');
        expect(target.deploymentId).toBe('dep-canary-1');
        expect(() => adapter.bindingTarget!({}, {}, throwingCtx), 'missing binding fields refused').toThrow();
        expect(
          () =>
            adapter.bindingTarget!(
              {
                clientId: 'client-canary-1',
                deploymentId: 'dep-canary-1',
                grantCode: 'grant-canary-1',
                extraField: 'nope',
              },
              {},
              throwingCtx,
            ),
          'unknown binding field refused (strict body)',
        ).toThrow();
      }
    }
  });
}

describe.each(productChannelRows)('K0 product channel contract: %s', (channelId, manifest) => {
  defineChannelContractCases(channelId, manifest, () => ({
    loaded: productById.get(channelId)!,
    reg: productRegistry,
    liveReg: productLiveRegistry,
    profileReg: productProfileRegistry,
  }));
});

describe.each(canaryChannelRows)('K0 canary channel contract: %s', (channelId, manifest) => {
  defineChannelContractCases(channelId, manifest, () => ({
    loaded: combinedById.get(channelId)!,
    reg: combinedRegistry,
    liveReg: combinedLiveRegistry,
    profileReg: combinedProfileRegistry,
  }));
});

describe('K0 canary isolation and negative control (AC-LA-E7-01-05, AC-LA-E7-01-06)', () => {
  it('AC-LA-E7-01-05: the product registry loaded with one root does not list the canary channels; loading the canary root as the second root adds both zz-canary (with app.ts) and zz-canary-admin (without app.ts)', () => {
    const productIds = productRegistry.channels().map((c) => c.id);
    expect(productIds).not.toContain('zz-canary');
    expect(productIds).not.toContain('zz-canary-admin');

    const combinedIds = combinedRegistry.channels().map((c) => c.id);
    expect(combinedIds).toContain('zz-canary');
    expect(combinedIds).toContain('zz-canary-admin');

    const canaryEntry = combinedById.get('zz-canary')!;
    expect(canaryEntry.appAdapter, 'zz-canary has app.ts').toBeDefined();

    const adminCanaryEntry = combinedById.get('zz-canary-admin')!;
    expect(adminCanaryEntry.appAdapter, 'zz-canary-admin has no app.ts (LA-E2-03 variant)').toBeUndefined();
    expect(adminCanaryEntry.manifest.lti?.toolConfiguration).toBe('none');
  });

  it('AC-LA-E7-01-06: negative control — a canary copy with a manifest schema error fails K0 and names the canary channel and the broken field', async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'la-e7-01-neg-'));
    const badCanaryDir = path.join(tmpRoot, 'zz-canary-bad');
    try {
      fs.mkdirSync(badCanaryDir, { recursive: true, mode: 0o700 });
      fs.writeFileSync(
        path.join(badCanaryDir, ' package.json'.trim()),
        JSON.stringify({ type: 'module', private: true }),
        { mode: 0o600 },
      );
      const validCanary = combinedById.get('zz-canary')!.manifest;
      const brokenManifest = {
        ...validCanary,
        id: 'zz-canary-bad',
        names: {
          text: 'Broken Canary',
          // Broken field: `names.label` is empty string (violates non-empty string schema rule)
          label: '',
        },
      };
      fs.writeFileSync(
        path.join(badCanaryDir, 'manifest.ts'),
        `export default ${JSON.stringify(brokenManifest, null, 2)};\n`,
        { mode: 0o600 },
      );

      const loadedWithBad = await loadChannelFolders([productRoot, tmpRoot], 'app');
      let caught: unknown;
      try {
        buildChannelRegistry(loadedWithBad, { simulations: true });
      } catch (err) {
        caught = err;
      }

      expect(caught, 'buildChannelRegistry throws on broken canary manifest').toBeInstanceOf(RegistryError);
      const regErr = caught as RegistryError & {
        channel: string | null;
        check: number;
        reason: string;
        detail: string;
      };
      expect(regErr.channel, 'error names the broken canary channel').toBe('zz-canary-bad');
      expect(regErr.check, 'error is check 1 (manifest schema)').toBe(1);
      expect(regErr.detail, 'error detail names the broken field names.label').toContain('names.label');
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
