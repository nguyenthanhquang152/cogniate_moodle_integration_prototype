// LA-E7-01 K0 channel contract suite and canary verification (no Docker).
// Runs inside `npm run check` via `vitest run --config tests/ltiaas/k0/vitest.config.mts`.
// Imports only the public entry points permitted by `docs/architecture/ltiaas/tasks/README.md` §3:
//   1. `@cogniate/channel-kernel` (LA-E1-02)
//   2. `services/lti-service/src/profiles/index.ts` (LA-E1-05)
//   3. `services/cogniate-app/src/kernel/ports.ts` (LA-E1-07, when present)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { isIP } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
  STANDARD_PROFILE_ID,
  TEXT_PLACEHOLDERS,
  buildChannelRegistry,
  capabilityProblem,
  computeCapabilities,
  fillText,
  legacyProjection,
  loadChannelFolders,
  parseChannelManifest,
  type CapabilityId,
  type CapabilitySet,
  type ChannelManifest,
  type ChannelRegistry,
  type LegacyCapabilities,
  type LoadedChannel,
  type ProfileTraits,
} from '@cogniate/channel-kernel';
import {
  allFixedHosts,
  buildProfileRegistry,
  fillTemplate,
  findProfile,
  isSharedProfile,
  isStandardProfile,
  listProfiles,
  profileDefinition,
  profileEndpoints,
  profileFixedHosts,
  profileOfFixedIssuer,
  reservedIssuerOrigins,
  siteRulesFor,
  type ProfileRegistry,
  type ProviderProfile,
} from '../../../services/lti-service/src/profiles/index.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const productRoot = path.join(repoRoot, 'packages/channels');
const canaryRoot = path.join(repoRoot, 'tests/ltiaas/canary');
const appPortsPath = path.join(repoRoot, 'services/cogniate-app/src/kernel/ports.ts');
const adr01Path = path.join(repoRoot, 'docs/architecture/ltiaas/adr/LA-ADR-01-channel-kernel.md');

interface D3ParsedRow {
  capabilityId: string;
  guardCell: string;
  status: number | null;
  code: string | null;
}

function parseAdr01D3Tables(markdown: string): {
  rows: Map<string, D3ParsedRow>;
  legacyByCapability: Map<string, keyof LegacyCapabilities>;
} {
  const rows = new Map<string, D3ParsedRow>();
  const legacyByCapability = new Map<string, keyof LegacyCapabilities>();

  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trim();
    if (!line.startsWith('| `')) continue;
    const cells = line
      .split(/(?<!\\)\|/)
      .slice(1, -1)
      .map((c) => c.trim());

    // D3 capability catalog table: | `<id>` | Type | Source | Replaces | Guard when false or absent |
    if (cells.length === 5) {
      const idMatch = /^`([a-zA-Z0-9_.]+)`$/.exec(cells[0]);
      if (!idMatch) continue;
      const capabilityId = idMatch[1];
      if (!(CAPABILITY_IDS as readonly string[]).includes(capabilityId)) continue;
      const guardCell = cells[4];
      const httpMatch = /\b(4\d\d)\s+([A-Z][A-Z0-9_]+)\b/.exec(guardCell);
      rows.set(capabilityId, {
        capabilityId,
        guardCell,
        status: httpMatch ? Number(httpMatch[1]) : null,
        code: httpMatch ? httpMatch[2] : null,
      });
    }

    // D3 legacy projection table: | `<legacyFlag>` | `<capability expr>` |
    if (cells.length === 2) {
      const flagMatch = /^`(dynamicRegistration|operatorApproval|webServices|courseShell|addDeployment|canvasConfiguration)`$/.exec(
        cells[0],
      );
      if (!flagMatch) continue;
      const legacyFlag = flagMatch[1] as keyof LegacyCapabilities;
      const rhs = cells[1];
      if (rhs.includes('registration.dynamic')) legacyByCapability.set('registration.dynamic', legacyFlag);
      else if (rhs.includes('operatorGrant')) legacyByCapability.set('binding.authority', legacyFlag);
      else if (rhs.includes('siteApi.token')) legacyByCapability.set('siteApi.token', legacyFlag);
      else if (rhs.includes('publish.createCourse')) legacyByCapability.set('publish.createCourse', legacyFlag);
      else if (rhs.includes('deployments.multiple')) legacyByCapability.set('deployments.multiple', legacyFlag);
      else if (rhs.includes('setup.artifacts')) legacyByCapability.set('setup.artifacts', legacyFlag);
    }
  }

  return { rows, legacyByCapability };
}

const adr01D3 = parseAdr01D3Tables(fs.readFileSync(adr01Path, 'utf8'));

// Guard table from LA-ADR-01 D3 (lines 147–180).
// HTTP guards have `kind: 'http'` with status, code and detailsCapability;
// behaviour / CLI guards have `kind: 'behaviour'` with status: null, code: null.
interface CapabilityGuardSpec {
  id: string;
  catalogKey: CapabilityId;
  kind: 'http' | 'behaviour';
  status: number | null;
  code: string | null;
  detailsCapability: string | null;
  legacyFlag?: keyof LegacyCapabilities;
  d3GuardSubstring: string;
  isSupported(caps: CapabilitySet): boolean;
  enableIn(manifest: ChannelManifest, profile: ProfileTraits | undefined): {
    manifest: ChannelManifest;
    profile: ProfileTraits | undefined;
  };
}

const CAPABILITY_GUARD_TABLE: readonly CapabilityGuardSpec[] = [
  {
    id: 'registration.dynamic',
    catalogKey: 'registration.dynamic',
    kind: 'http',
    status: 422,
    code: 'CAPABILITY_NOT_SUPPORTED',
    detailsCapability: 'dynamicRegistration',
    legacyFlag: 'dynamicRegistration',
    d3GuardSubstring: '422 CAPABILITY_NOT_SUPPORTED',
    isSupported: (caps) => caps['registration.dynamic'] === true,
    enableIn: (manifest, profile) => ({
      manifest: {
        ...manifest,
        registration: [
          ...manifest.registration,
          {
            method: 'dynamic',
            authority: 'self',
            profiles: [manifest.registration[0]?.defaultProfile ?? 'standard'],
            defaultProfile: manifest.registration[0]?.defaultProfile ?? 'standard',
          },
        ],
      },
      profile: { ...profile, sharing: 'exclusive' },
    }),
  },
  {
    id: 'binding.authority',
    catalogKey: 'binding.authority',
    kind: 'behaviour',
    status: null,
    code: null,
    detailsCapability: null,
    legacyFlag: 'operatorApproval',
    d3GuardSubstring: 'grant CLI refuses a connection whose authority is `self`',
    isSupported: (caps) => Object.values(caps['binding.authority'] ?? {}).includes('operatorGrant'),
    enableIn: (manifest, profile) => ({
      manifest: {
        ...manifest,
        registration: manifest.registration.map((r, i) => (i === 0 ? { ...r, authority: 'operatorGrant' } : r)),
      },
      profile,
    }),
  },
  {
    id: 'deployments.multiple',
    catalogKey: 'deployments.multiple',
    kind: 'http',
    status: 409,
    code: 'CAPABILITY_NOT_SUPPORTED',
    detailsCapability: 'addDeployment',
    legacyFlag: 'addDeployment',
    d3GuardSubstring: '409 CAPABILITY_NOT_SUPPORTED',
    isSupported: (caps) => caps['deployments.multiple'] === true,
    enableIn: (manifest, profile) => ({
      manifest: {
        ...manifest,
        capabilities: { ...manifest.capabilities, 'deployments.multiple': true },
      },
      profile,
    }),
  },
  {
    id: 'site.serviceOrigin',
    catalogKey: 'site.serviceOrigin',
    kind: 'http',
    status: 400,
    code: 'INVALID_REQUEST',
    detailsCapability: null,
    d3GuardSubstring: '400 INVALID_REQUEST',
    isSupported: (caps) => caps['site.serviceOrigin'] === true,
    enableIn: (manifest, profile) => ({
      manifest,
      profile: { ...profile, serviceUrl: true },
    }),
  },
  {
    id: 'setup.artifacts',
    catalogKey: 'setup.artifacts',
    kind: 'http',
    status: 409,
    code: 'CAPABILITY_NOT_SUPPORTED',
    detailsCapability: 'canvasConfiguration',
    legacyFlag: 'canvasConfiguration',
    d3GuardSubstring: '409 CAPABILITY_NOT_SUPPORTED',
    isSupported: (caps) => caps['setup.artifacts'].includes(DEVELOPER_KEY_JSON_ARTIFACT),
    enableIn: (manifest, profile) => ({
      manifest: {
        ...manifest,
        capabilities: { ...manifest.capabilities, 'setup.artifacts': [DEVELOPER_KEY_JSON_ARTIFACT] },
      },
      profile,
    }),
  },
  {
    id: 'siteApi.token',
    catalogKey: 'siteApi.token',
    kind: 'http',
    status: 409,
    code: 'CAPABILITY_NOT_SUPPORTED',
    detailsCapability: 'webServices',
    legacyFlag: 'webServices',
    d3GuardSubstring: '409 CAPABILITY_NOT_SUPPORTED',
    isSupported: (caps) => caps['siteApi.token'] === true,
    enableIn: (manifest, profile) => ({
      manifest: {
        ...manifest,
        capabilities: { ...manifest.capabilities, 'siteApi.token': true },
      },
      profile,
    }),
  },
  {
    id: 'publish.createCourse',
    catalogKey: 'publish.createCourse',
    kind: 'http',
    status: 409,
    code: 'CAPABILITY_NOT_SUPPORTED',
    detailsCapability: 'courseShell',
    legacyFlag: 'courseShell',
    d3GuardSubstring: '409 CAPABILITY_NOT_SUPPORTED',
    isSupported: (caps) => caps['publish.createCourse'] === true,
    enableIn: (manifest, profile) => ({
      manifest: {
        ...manifest,
        capabilities: { ...manifest.capabilities, 'siteApi.token': true, 'publish.createCourse': true },
      },
      profile,
    }),
  },
  {
    id: 'export.packages',
    catalogKey: 'export.packages',
    kind: 'behaviour',
    status: null,
    code: null,
    detailsCapability: null,
    d3GuardSubstring: "exporter route of another channel's exporter is not shown",
    isSupported: (caps) => caps['export.packages'].length > 0,
    enableIn: (manifest, profile) => ({
      manifest: {
        ...manifest,
        capabilities: { ...manifest.capabilities, 'export.packages': ['mbz'] },
      },
      profile,
    }),
  },
  {
    id: 'content.multiple',
    catalogKey: 'content.multiple',
    kind: 'behaviour',
    status: null,
    code: null,
    detailsCapability: null,
    d3GuardSubstring: 'the picker stays single select',
    isSupported: (caps) => caps['content.multiple'] === true,
    enableIn: (manifest, profile) => ({
      manifest: {
        ...manifest,
        capabilities: { ...manifest.capabilities, 'content.multiple': true },
      },
      profile,
    }),
  },
  {
    id: 'content.ungraded',
    catalogKey: 'content.ungraded',
    kind: 'behaviour',
    status: null,
    code: null,
    detailsCapability: null,
    d3GuardSubstring: 'ungraded placement is not offered',
    isSupported: (caps) => caps['content.ungraded'] === true,
    enableIn: (manifest, profile) => ({
      manifest: {
        ...manifest,
        capabilities: { ...manifest.capabilities, 'content.ungraded': true },
      },
      profile,
    }),
  },
  {
    id: 'launch.windowHint',
    catalogKey: 'launch.windowHint',
    kind: 'behaviour',
    status: null,
    code: null,
    detailsCapability: null,
    d3GuardSubstring: 'the content item has no `window` member',
    isSupported: (caps) => caps['launch.windowHint'] === true,
    enableIn: (manifest, profile) => ({
      manifest: {
        ...manifest,
        capabilities: { ...manifest.capabilities, 'launch.windowHint': true },
      },
      profile,
    }),
  },
  {
    id: 'launch.topLevelContinue',
    catalogKey: 'launch.topLevelContinue',
    kind: 'behaviour',
    status: null,
    code: null,
    detailsCapability: null,
    d3GuardSubstring: 'the embedded page stays static',
    isSupported: (caps) => caps['launch.topLevelContinue'] === true,
    enableIn: (manifest, profile) => ({
      manifest: {
        ...manifest,
        capabilities: { ...manifest.capabilities, 'launch.topLevelContinue': true },
      },
      profile,
    }),
  },
  {
    id: 'records.reporters',
    catalogKey: 'records.reporters',
    kind: 'behaviour',
    status: null,
    code: null,
    detailsCapability: null,
    d3GuardSubstring: 'no reporter = no dispatch row',
    isSupported: (caps) => caps['records.reporters'].length > 0,
    enableIn: (manifest, profile) => ({
      manifest: {
        ...manifest,
        capabilities: { ...manifest.capabilities, 'records.reporters': ['lti-ags'] },
      },
      profile,
    }),
  },
  {
    id: 'records.readBack',
    catalogKey: 'records.readBack',
    kind: 'http',
    status: 409,
    code: 'CAPABILITY_NOT_SUPPORTED',
    detailsCapability: 'records.readBack',
    d3GuardSubstring: '409 CAPABILITY_NOT_SUPPORTED',
    isSupported: (caps) => caps['records.readBack'] === true,
    enableIn: (manifest, profile) => ({
      manifest: {
        ...manifest,
        capabilities: { ...manifest.capabilities, 'records.readBack': true },
      },
      profile,
    }),
  },
  {
    id: 'setup.connectionCheck',
    catalogKey: 'setup.connectionCheck',
    kind: 'http',
    status: 409,
    code: 'CAPABILITY_NOT_SUPPORTED',
    detailsCapability: 'setup.connectionCheck',
    d3GuardSubstring: '409 CAPABILITY_NOT_SUPPORTED',
    isSupported: (caps) => caps['setup.connectionCheck'] === true,
    enableIn: (manifest, profile) => ({
      manifest: {
        ...manifest,
        setup: { ...manifest.setup, connectionCheck: true },
      },
      profile,
    }),
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

function checkSiteUrlWithProfileRules(
  input: string,
  rules: ReturnType<typeof siteRulesFor>,
): { ok: true; origin: string } | { ok: false; rule: 1 | 2 | 3 | 4 | 5 } {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return { ok: false, rule: 1 };
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    (parsed.pathname !== '/' && parsed.pathname !== '') ||
    parsed.search !== '' ||
    parsed.hash !== ''
  ) {
    return { ok: false, rule: 1 };
  }
  const host = parsed.hostname.toLowerCase();
  if (
    isIP(host) !== 0 ||
    !host.includes('.') ||
    host.endsWith('.') ||
    host === 'localhost' ||
    host.endsWith('.localhost')
  ) {
    return { ok: false, rule: 2 };
  }
  const lower = (list: readonly string[]) => list.map((h) => h.toLowerCase());
  if (lower(rules.ownHosts).includes(host)) return { ok: false, rule: 3 };
  if (lower(rules.profileFixedHosts).includes(host)) return { ok: false, rule: 4 };
  if (rules.selfHosted) {
    if (rules.selfHosted.refusedSuffixes.some((s) => host.endsWith(s.toLowerCase()))) return { ok: false, rule: 5 };
    if (lower(rules.selfHosted.allFixedHosts).includes(host)) return { ok: false, rule: 5 };
  }
  return { ok: true, origin: parsed.origin };
}

interface MergedLoadedChannel extends LoadedChannel {
  manifest: ChannelManifest;
  ltiProfiles: Array<Record<string, unknown>>;
  appAdapter?: Record<string, unknown>;
}

function mergeLoaded(appLoaded: readonly LoadedChannel[], ltiLoaded: readonly LoadedChannel[]): MergedLoadedChannel[] {
  const ltiByFolder = new Map(ltiLoaded.map((c) => [c.folder, (c.ltiProfiles ?? []) as Array<Record<string, unknown>>]));
  return appLoaded.map((c) => ({
    ...c,
    manifest: c.manifest as ChannelManifest,
    ltiProfiles: ltiByFolder.get(c.folder) ?? [],
    appAdapter: c.appAdapter as Record<string, unknown> | undefined,
  }));
}

// Top-level discovery of product channels and canary channels so `describe.each` registers
// one suite per discovered channel with no test edits when a channel folder is added (AC-LA-E7-01-02).
const extraNegativeRoot = process.env.LA_K0_EXTRA_ROOT ? [process.env.LA_K0_EXTRA_ROOT] : [];

const productAppLoaded = await loadChannelFolders([productRoot], 'app');
const productLtiLoaded = await loadChannelFolders([productRoot], 'lti');
const productMerged = mergeLoaded(productAppLoaded, productLtiLoaded);
const productRegistry = buildChannelRegistry(productMerged, { simulations: true });
const productLiveRegistry = buildChannelRegistry(productMerged, { simulations: false });
const productProfileRegistry = buildProfileRegistry(productMerged);

const canaryRoots = [productRoot, canaryRoot, ...extraNegativeRoot];
const combinedAppLoaded = await loadChannelFolders(canaryRoots, 'app');
const combinedLtiLoaded = await loadChannelFolders(canaryRoots, 'lti');
const combinedMerged = mergeLoaded(combinedAppLoaded, combinedLtiLoaded);
const combinedRegistry = buildChannelRegistry(combinedMerged, { simulations: true });
const combinedLiveRegistry = buildChannelRegistry(combinedMerged, { simulations: false });
const combinedProfileRegistry = buildProfileRegistry(combinedMerged);

const productById = new Map(productMerged.map((c) => [c.manifest.id, c]));
const combinedById = new Map(combinedMerged.map((c) => [c.manifest.id, c]));

const productChannelRows = productRegistry.channels().map((m) => [m.id, m] as const);
const canaryChannelRows = combinedRegistry
  .channels()
  .filter((m) => !productById.has(m.id))
  .map((m) => [m.id, m] as const);

if (productChannelRows.length === 0) {
  throw new Error('K0 product channel discovery returned 0 channels');
}
if (canaryChannelRows.length === 0) {
  throw new Error('K0 canary channel discovery returned 0 channels');
}

function defineChannelContractCases(
  channelId: string,
  manifest: ChannelManifest,
  getContext: () => {
    loaded: MergedLoadedChannel;
    reg: ChannelRegistry;
    liveReg: ChannelRegistry;
    profileReg: ProfileRegistry;
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
      const spec = CAPABILITY_CATALOG[key as CapabilityId];
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
      TEXT_PLACEHOLDERS.map((p) => (p.startsWith('{') ? p : `{${p}}`)),
    );
    const sampleFillValues = Object.fromEntries(
      TEXT_PLACEHOLDERS.map((name) => [name, name === 'LMS' ? reg.textName(channelId) : `sample-${name}`]),
    ) as Record<(typeof TEXT_PLACEHOLDERS)[number], string>;

    for (const line of allTexts) {
      const tokens = line.match(/\{[^{}]+\}/g) ?? [];
      for (const token of tokens) {
        expect(allowedTokens.has(token), `${channelId}: placeholder ${token} is in TEXT_PLACEHOLDERS`).toBe(true);
      }
      const filled = fillText(line, sampleFillValues);
      expect(filled, `${channelId}: fillText leaves no unresolved placeholders`).not.toMatch(/\{[^{}]+\}/);
    }
  });

  it(`K-LEGACY.${channelId}: legacyCapabilities projection matches the 6-flag formula across all channel profiles and M1 baseline where applicable`, () => {
    const { loaded, reg } = getContext();
    const profilesToCheck =
      loaded.ltiProfiles.length > 0 ? (loaded.ltiProfiles as unknown as ProfileTraits[]) : [undefined];

    for (const profile of profilesToCheck) {
      const caps = reg.capabilities(channelId, profile);
      const legacy = reg.legacyCapabilities(channelId, profile);

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
      expect(legacy.operatorApproval).toBe(Object.values(caps['binding.authority'] ?? {}).includes('operatorGrant'));
      expect(legacy.webServices).toBe(caps['siteApi.token'] === true);
      expect(legacy.courseShell).toBe(caps['publish.createCourse'] === true);
      expect(legacy.addDeployment).toBe(caps['deployments.multiple'] === true);
      expect(legacy.canvasConfiguration).toBe(caps['setup.artifacts'].includes(DEVELOPER_KEY_JSON_ARTIFACT));

      if (channelId in M1_BASELINE_LEGACY_FLAGS) {
        expect(legacy, `${channelId}: equals M1 six-flag capability object`).toStrictEqual(
          M1_BASELINE_LEGACY_FLAGS[channelId],
        );
      }
    }
  });

  it(`K-CAP.${channelId}.catalog: all 17 catalog capabilities are computed and guard table covers every guarded D3 row`, () => {
    const { loaded, reg } = getContext();
    const defaultProfileId = manifest.registration[0]?.defaultProfile;
    const defaultProfile = loaded.ltiProfiles.find((p) => p.id === defaultProfileId) as ProfileTraits | undefined;
    const caps = reg.capabilities(channelId, defaultProfile);
    const legacy = reg.legacyCapabilities(channelId, defaultProfile);

    for (const capId of CAPABILITY_IDS) {
      expect(Object.prototype.hasOwnProperty.call(caps, capId), `${channelId}: capability ${capId} is computed`).toBe(
        true,
      );
    }

    // Verify that CAPABILITY_GUARD_TABLE covers every D3 capability row whose guard column is not "—".
    const unguardedInD3 = new Set<string>(['registration.scopes', 'platform.sharing']);
    const guardedIdsInTable = new Set<string>(CAPABILITY_GUARD_TABLE.map((g) => g.catalogKey));
    for (const capId of CAPABILITY_IDS) {
      const adrRow = adr01D3.rows.get(capId);
      expect(adrRow, `LA-ADR-01 D3 table contains row for ${capId}`).toBeDefined();
      if (unguardedInD3.has(capId)) {
        expect(adrRow!.guardCell.startsWith('—'), `${capId} has no guard in D3`).toBe(true);
      } else {
        expect(guardedIdsInTable.has(capId), `${capId} is present in CAPABILITY_GUARD_TABLE`).toBe(true);
      }
    }

    for (const guard of CAPABILITY_GUARD_TABLE) {
      if (guard.legacyFlag) {
        expect(legacy[guard.legacyFlag], `${channelId}: legacy flag ${guard.legacyFlag} matches guard`).toBe(
          guard.isSupported(caps),
        );
      }
    }
  });

  // Compute the false/absent guarded capabilities for this channel from the product kernel (`reg.capabilities`)
  // and register one `K-CAP` case per false or absent guarded capability (AC-LA-E7-01-04).
  const initialCtx = getContext();
  const initialDefaultProfileId = manifest.registration[0]?.defaultProfile;
  const initialDefaultProfile = initialCtx.loaded.ltiProfiles.find((p) => p.id === initialDefaultProfileId) as
    | ProfileTraits
    | undefined;
  const initialCaps = initialCtx.reg.capabilities(channelId, initialDefaultProfile);
  const offGuards = CAPABILITY_GUARD_TABLE.filter((g) => !g.isSupported(initialCaps));

  it.each(
    offGuards.map((g) => [
      g.id,
      g.kind === 'http'
        ? `${g.status} ${g.code}${g.detailsCapability ? ` (details.capability=${g.detailsCapability})` : ''}`
        : `behaviour (${g.d3GuardSubstring})`,
      g,
    ] as const),
  )(`K-CAP.${channelId}.%s: false/absent capability -> %s`, (_guardId, _summary, guard) => {
    const { loaded, reg } = getContext();
    const defaultProfileId = manifest.registration[0]?.defaultProfile;
    const defaultProfile = loaded.ltiProfiles.find((p) => p.id === defaultProfileId) as ProfileTraits | undefined;

    // 1. Call product code (`reg.capabilities`, `computeCapabilities`, `reg.legacyCapabilities`, `legacyProjection`)
    //    on the channel's actual manifest + profile (where the capability is false/absent) AND on a copy with the
    //    capability enabled, proving the product kernel computes both states.
    const caps = reg.capabilities(channelId, defaultProfile);
    const directCaps = computeCapabilities(manifest, defaultProfile);
    const legacy = reg.legacyCapabilities(channelId, defaultProfile);
    expect(directCaps).toStrictEqual(caps);
    expect(guard.isSupported(caps), `${channelId}: ${guard.id} is false or absent on channel`).toBe(false);
    if (guard.legacyFlag) {
      expect(legacy[guard.legacyFlag], `${channelId}: legacy flag ${guard.legacyFlag} is false`).toBe(false);
    }

    const enabled = guard.enableIn(manifest, defaultProfile);
    const enabledCaps = computeCapabilities(enabled.manifest, enabled.profile);
    expect(
      guard.isSupported(enabledCaps),
      `${channelId}: product computeCapabilities flips ${guard.id} to supported when enabled`,
    ).toBe(true);
    if (guard.legacyFlag) {
      expect(
        legacyProjection(enabledCaps)[guard.legacyFlag],
        `${channelId}: product legacyProjection flips ${guard.legacyFlag} to true when enabled`,
      ).toBe(true);
    }

    // 2. Compare the guard's status, code, detailsCapability and guard text against the authoritative
    //    LA-ADR-01 D3 markdown table on disk (so any mutation of status, code or detailsCapability fails).
    const adrRow = adr01D3.rows.get(guard.catalogKey);
    expect(adrRow, `LA-ADR-01 D3 row exists for ${guard.catalogKey}`).toBeDefined();
    expect(adrRow!.guardCell, `${guard.id}: D3 guard column matches`).toContain(guard.d3GuardSubstring);
    expect(guard.status, `${guard.id}: status matches LA-ADR-01 D3`).toBe(adrRow!.status);
    expect(guard.code, `${guard.id}: error code matches LA-ADR-01 D3`).toBe(adrRow!.code);

    if (guard.kind === 'http') {
      if (guard.catalogKey === 'site.serviceOrigin') {
        expect(guard.detailsCapability).toBeNull();
      } else {
        // LA-ADR-01 D3 line 180: "A guard that existed in M1 keeps its details.capability value (...). A new guard uses the capability id."
        const expectedDetailsCap = adr01D3.legacyByCapability.get(guard.catalogKey) ?? guard.catalogKey;
        expect(guard.detailsCapability, `${guard.id}: details.capability matches D3 rule`).toBe(expectedDetailsCap);
      }
      if (guard.legacyFlag) {
        expect(adr01D3.legacyByCapability.get(guard.catalogKey)).toBe(guard.legacyFlag);
      }
    } else {
      expect(guard.status).toBeNull();
      expect(guard.code).toBeNull();
      expect(guard.detailsCapability).toBeNull();
    }
  });

  it(`K-PROFILE.${channelId}: LTI profiles satisfy ownership, wireLms, traits, fixed hosts, template fill, site rules 1-5, reserved issuer and simulation gating`, () => {
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

    const reservedOrigins = reservedIssuerOrigins({ simulation: true, registry: profileReg });
    const allHosts = allFixedHosts({ simulation: true, registry: profileReg });

    for (const profileId of declaredProfileIds) {
      expect(reg.channelOfProfile(profileId), `${channelId}: channelOfProfile(${profileId})`).toBe(channelId);
      const rawProfile = loaded.ltiProfiles.find((p) => p.id === profileId);
      expect(rawProfile, `${channelId}: lti-profiles.ts contains ${profileId}`).toBeDefined();

      const def: ProviderProfile | null = profileDefinition(profileId, profileReg);
      expect(def, `profileDefinition(${profileId}) is defined`).not.toBeNull();
      const profile = def!;
      expect(profile.channel).toBe(channelId);

      // Traits and capability projection
      expect(isSharedProfile(profile)).toBe(profile.sharing === 'shared');
      expect(isStandardProfile(profile)).toBe(profile.endpoints === 'admin');
      const profileCaps = reg.capabilities(channelId, profile);
      expect(profileCaps['platform.sharing']).toBe(profile.sharing);
      expect(profileCaps['site.serviceOrigin']).toBe(profile.serviceUrl);
      expect(typeof profile.flags.deepLinkingResponseSub).toBe('boolean');
      expect(typeof profile.flags.clientAssertionAudArray).toBe('boolean');
      expect(typeof profile.flags.serviceOriginCheck).toBe('boolean');

      // Wire LMS (BD-A1-06, load check 7)
      const baselineWireMap = BASELINE_PROFILE_WIRE_LMS as Record<string, string | null>;
      if (Object.prototype.hasOwnProperty.call(baselineWireMap, profileId)) {
        expect(profile.wireLms, `${profileId}: baseline wireLms matches BASELINE_PROFILE_WIRE_LMS`).toBe(
          baselineWireMap[profileId],
        );
        expect(profile.lms).toBe(baselineWireMap[profileId]);
      } else {
        expect(profile.wireLms, `${profileId}: non-baseline profile omits wireLms (BD-A1-06)`).toBeUndefined();
        expect(profile.lms, `${profileId}: non-baseline profile lms equals channel id`).toBe(channelId);
      }

      // Simulation gate
      const allSimOn = listProfiles({ simulation: true, registry: profileReg });
      const allSimOff = listProfiles({ simulation: false, registry: profileReg });
      expect(allSimOn.some((p) => p.id === profileId), `${profileId} in listProfiles(simulation=true)`).toBe(true);
      const foundSimOn = findProfile(profileId, { simulation: true, registry: profileReg });
      expect(foundSimOn?.id, `findProfile(${profileId}, simulation=true)`).toBe(profileId);

      const foundSimOff = findProfile(profileId, { simulation: false, registry: profileReg });
      if (profile.simulation || manifest.availability === 'simulation-only') {
        expect(foundSimOff, `simulation profile ${profileId} is hidden when simulation=false`).toBeNull();
        expect(allSimOff.some((p) => p.id === profileId)).toBe(false);
      } else {
        expect(foundSimOff?.id, `real profile ${profileId} is visible when simulation=false`).toBe(profileId);
        expect(allSimOff.some((p) => p.id === profileId)).toBe(true);
      }

      // Fixed hosts, template fill and reserved issuer
      const fixedHosts = profileFixedHosts(profile);
      for (const host of fixedHosts) {
        expect(allHosts, `${profileId}: fixed host ${host} is in allFixedHosts`).toContain(host);
      }

      if (profile.endpoints === 'admin') {
        expect(profile.issuer).toBeNull();
        expect(profile.authenticationEndpoint).toBeNull();
        expect(profile.accesstokenEndpoint).toBeNull();
        expect(profile.jwksUrl).toBeNull();
        expect(fixedHosts).toEqual([]);
      } else {
        expect(profile.endpoints).toBe('fixed');
        const filledEndpoints = profileEndpoints(profile, {
          siteUrl: 'https://lms.school.example.edu',
          serviceUrl: 'https://service.school.example.edu',
          clientId: 'client-123',
        });
        expect(filledEndpoints, `${profileId}: profileEndpoints returns filled URLs`).not.toBeNull();
        for (const field of ['issuer', 'authenticationEndpoint', 'accesstokenEndpoint', 'jwksUrl'] as const) {
          const template = profile[field];
          expect(typeof template === 'string' && template.length > 0, `${profileId}.${field} is non-empty`).toBe(true);
          const resolved = fillTemplate(template as string, {
            siteUrl: 'https://lms.school.example.edu',
            serviceUrl: 'https://service.school.example.edu',
            clientId: 'client-123',
          });
          expect(() => new URL(resolved), `${profileId}.${field} resolves to a valid URL`).not.toThrow();
          expect(new URL(resolved).protocol).toBe('https:');
          if ((template as string).includes('{siteUrl}')) {
            expect(() => fillTemplate(template as string, {}), `${profileId}.${field} requires {siteUrl}`).toThrow();
          }
          if ((template as string).includes('{clientId}')) {
            expect(
              () => fillTemplate(template as string, { siteUrl: 'https://lms.school.example.edu' }),
              `${profileId}.${field} requires {clientId}`,
            ).toThrow();
          }
        }

        if (profile.issuer && !profile.issuer.startsWith('{') && !isStandardProfile(profile)) {
          const issuerOrigin = new URL(profile.issuer).origin;
          expect(reservedOrigins, `${profileId}: fixed issuer ${issuerOrigin} is reserved`).toContain(issuerOrigin);
          expect(
            profileOfFixedIssuer(issuerOrigin, { simulation: true, registry: profileReg })?.id,
            `${profileId}: profileOfFixedIssuer(${issuerOrigin})`,
          ).toBe(profileId);
        }
      }

      // Site rules 1-5 via siteRulesFor
      const ownOrigins = ['https://app.cogniate.test', 'https://lti.cogniate.test'];
      const rules = siteRulesFor(profile, ownOrigins, { simulation: true, registry: profileReg });
      expect(rules.ownHosts).toEqual(['app.cogniate.test', 'lti.cogniate.test']);
      expect(rules.profileFixedHosts).toEqual(fixedHosts);

      expect(checkSiteUrlWithProfileRules('https://lms.school.example.edu', rules)).toEqual({
        ok: true,
        origin: 'https://lms.school.example.edu',
      });
      expect(checkSiteUrlWithProfileRules('http://lms.school.example.edu', rules)).toEqual({ ok: false, rule: 1 });
      expect(checkSiteUrlWithProfileRules('https://lms.school.example.edu/subpath', rules)).toEqual({
        ok: false,
        rule: 1,
      });
      expect(checkSiteUrlWithProfileRules('https://127.0.0.1', rules)).toEqual({ ok: false, rule: 2 });
      expect(checkSiteUrlWithProfileRules('https://localhost', rules)).toEqual({ ok: false, rule: 2 });
      expect(checkSiteUrlWithProfileRules('https://lti.cogniate.test', rules)).toEqual({ ok: false, rule: 3 });

      for (const fixedHost of fixedHosts) {
        expect(checkSiteUrlWithProfileRules(`https://${fixedHost}`, rules)).toEqual({ ok: false, rule: 4 });
      }
      if (profile.refusedHostSuffixes && profile.refusedHostSuffixes.length > 0) {
        expect(rules.selfHosted).toBeDefined();
        expect(
          checkSiteUrlWithProfileRules(`https://tenant.${profile.refusedHostSuffixes[0]}`, rules),
          `${profileId}: refuses suffix ${profile.refusedHostSuffixes[0]} (rule 5)`,
        ).toEqual({ ok: false, rule: 5 });
      }
    }
  });

  // K-ADAPTER (AC-LA-E7-01-07, LA-ADR-01 D5 `ConnectionSetup` contract surface, BD-A1-20).
  const initialLoaded = initialCtx.loaded;
  const portsExist = fs.existsSync(appPortsPath);
  const needsAdapter =
    manifest.lti?.toolConfiguration === 'channel' ||
    manifest.setup.connectionCheck === true ||
    manifest.capabilities['siteApi.token'] === true ||
    manifest.capabilities['publish.createCourse'] === true ||
    (Array.isArray(manifest.capabilities['setup.artifacts']) && manifest.capabilities['setup.artifacts'].length > 0) ||
    (Array.isArray(manifest.capabilities['export.packages']) && manifest.capabilities['export.packages'].length > 0);

  if (needsAdapter && !portsExist && initialLoaded.appAdapter === undefined) {
    // Pending LA-E1-07 for baseline channels until services/cogniate-app/src/kernel/ports.ts and packages/channels/*/app.ts land.
    it.todo(
      `K-ADAPTER.${channelId}: pending LA-E1-07 (services/cogniate-app/src/kernel/ports.ts and packages/channels/${channelId}/app.ts)`,
    );
  } else {
    it(`K-ADAPTER.${channelId}: D5 ConnectionSetup members, strict parseBindingBody, toolConfiguration array, and throwing db/lti stubs (BD-A1-20)`, () => {
      const { loaded, reg } = getContext();
      expect(Array.isArray(manifest.setup.createFields)).toBe(true);
      expect(Array.isArray(manifest.setup.bindingFields)).toBe(true);
      for (const field of [...manifest.setup.createFields, ...manifest.setup.bindingFields]) {
        expect(typeof field.key === 'string' && field.key.length > 0).toBe(true);
        expect(typeof field.label === 'string' && field.label.length > 0).toBe(true);
      }

      if (!needsAdapter && loaded.appAdapter === undefined) {
        // Admin-value channel without app.ts (e.g. zz-canary-admin, LA-E2-03 AC-05).
        expect(manifest.lti?.toolConfiguration).toBe('none');
        return;
      }

      // Required for every channel with app.ts (or after LA-E1-07): no silent skips (BD-A1-20).
      expect(loaded.appAdapter, `${channelId}: exports app.ts ConnectionSetup adapter`).toBeDefined();
      const adapter = loaded.appAdapter as {
        channel?: unknown;
        checkCreate?: (input: unknown) => { ok: boolean; siteUrl?: string; serviceUrl?: string; field?: string; rule?: number };
        toolConfiguration?: (ctx: unknown) => unknown;
        parseBindingBody?: (body: unknown, ctx: unknown) => { ok: boolean; values?: Record<string, unknown>; fields?: string[] };
        selfCreate?: (values: unknown, ctx: unknown) => Record<string, unknown>;
        initialTarget?: (ctx: unknown) => Record<string, unknown>;
        createRequest?: (target: unknown, ctx: unknown) => Record<string, unknown>;
        extensionRoutes?: readonly unknown[];
        publishHooks?: readonly unknown[];
        packageExporters?: readonly unknown[];
      };

      expect(adapter.channel, `${channelId}: adapter.channel equals manifest.id`).toBe(channelId);
      expect(typeof adapter.checkCreate, `${channelId}: checkCreate is required`).toBe('function');
      expect(typeof adapter.toolConfiguration, `${channelId}: toolConfiguration is required`).toBe('function');
      expect(typeof adapter.parseBindingBody, `${channelId}: parseBindingBody is required`).toBe('function');

      const hasManualSelf = manifest.registration.some((r) => r.method === 'manual' && r.authority === 'self');
      const hasOperatorGrant = manifest.registration.some((r) => r.authority === 'operatorGrant');
      if (hasManualSelf) {
        expect(typeof adapter.selfCreate, `${channelId}: selfCreate is required for manual+self`).toBe('function');
      }
      if (hasOperatorGrant) {
        expect(typeof adapter.initialTarget, `${channelId}: initialTarget is required for operatorGrant`).toBe(
          'function',
        );
        expect(typeof adapter.createRequest, `${channelId}: createRequest is required for operatorGrant`).toBe(
          'function',
        );
      }

      const defaultProfileId = manifest.registration[0]?.defaultProfile;
      const defaultProfile = loaded.ltiProfiles.find((p) => p.id === defaultProfileId) as ProfileTraits | undefined;
      const caps = reg.capabilities(channelId, defaultProfile);

      if (caps['setup.artifacts'].length > 0 || caps['siteApi.token'] === true) {
        expect(
          Array.isArray(adapter.extensionRoutes) && adapter.extensionRoutes.length > 0,
          `${channelId}: extensionRoutes required when setup.artifacts or siteApi.token is enabled`,
        ).toBe(true);
      }
      if (caps['publish.createCourse'] === true) {
        expect(
          Array.isArray(adapter.publishHooks) && adapter.publishHooks.length > 0,
          `${channelId}: publishHooks required when publish.createCourse is enabled`,
        ).toBe(true);
      }
      if (caps['export.packages'].length > 0) {
        expect(
          Array.isArray(adapter.packageExporters) && adapter.packageExporters.length > 0,
          `${channelId}: packageExporters required when export.packages is enabled`,
        ).toBe(true);
      }

      const throwingGuards = {
        db: makeThrowingStub('db'),
        sql: makeThrowingStub('sql'),
        lti: makeThrowingStub('lti'),
        outbound: makeThrowingStub('outbound'),
      };

      // 1. checkCreate(input) -> { ok: true, siteUrl, serviceUrl } | { ok: false, field, rule? }
      const createOk = adapter.checkCreate!({
        siteUrl: 'https://lms.school.example.edu',
        profile: defaultProfile ?? { id: defaultProfileId, serviceUrl: false, sharing: 'exclusive' },
        ...throwingGuards,
      });
      expect(createOk.ok, `${channelId}: checkCreate accepts valid https origin`).toBe(true);
      if (createOk.ok) {
        expect(typeof createOk.siteUrl === 'string' && createOk.siteUrl.length > 0).toBe(true);
        expect(typeof createOk.serviceUrl === 'string' && createOk.serviceUrl.length > 0).toBe(true);
      }

      const createBad = adapter.checkCreate!({
        siteUrl: 'not-a-url',
        profile: defaultProfile ?? { id: defaultProfileId, serviceUrl: false, sharing: 'exclusive' },
        ...throwingGuards,
      });
      expect(createBad.ok, `${channelId}: checkCreate refuses invalid siteUrl with { ok: false }`).toBe(false);
      if (!createBad.ok) {
        expect(typeof createBad.field === 'string' && createBad.field.length > 0).toBe(true);
      }

      // 2. toolConfiguration(ctx) -> ToolRow[] (an array, no .rows wrapper)
      const rows = adapter.toolConfiguration!({
        connectionId: 'conn-1',
        publicAppOrigin: 'https://app.cogniate.test',
        publicLtiOrigin: 'https://lti.cogniate.test',
        siteUrl: 'https://lms.school.example.edu',
        ...throwingGuards,
      });
      expect(Array.isArray(rows) && rows.length > 0, `${channelId}: toolConfiguration returns ToolRow[]`).toBe(true);
      for (const row of rows as Array<{ key?: unknown; label?: unknown; value?: unknown }>) {
        expect(typeof row.key === 'string' && row.key.length > 0).toBe(true);
        expect(typeof row.label === 'string' && row.label.length > 0).toBe(true);
        expect(typeof row.value === 'string' && row.value.length > 0).toBe(true);
      }

      // 3. parseBindingBody(body, ctx) -> { ok: true, values } | { ok: false, fields } (never throws)
      const validBody: Record<string, string> = {};
      for (const f of manifest.setup.bindingFields) {
        if (!f.required) continue;
        validBody[f.key] = f.kind === 'url' || f.kind === 'origin' ? 'https://lms.school.example.edu/lti' : `${f.key}-1`;
      }
      const parsedOk = adapter.parseBindingBody!(validBody, {
        purpose: 'initial_binding',
        ...throwingGuards,
      });
      expect(parsedOk.ok, `${channelId}: parseBindingBody accepts valid required fields`).toBe(true);
      if (parsedOk.ok) {
        expect(parsedOk.values && typeof parsedOk.values === 'object').toBe(true);
      }

      const parsedMissing = adapter.parseBindingBody!({}, { purpose: 'initial_binding', ...throwingGuards });
      expect(parsedMissing.ok, `${channelId}: parseBindingBody returns { ok: false } on empty body`).toBe(false);
      if (!parsedMissing.ok) {
        expect(Array.isArray(parsedMissing.fields) && parsedMissing.fields.length > 0).toBe(true);
      }

      const parsedUnknown = adapter.parseBindingBody!(
        { ...validBody, __unknownExtraField: 'nope' },
        { purpose: 'initial_binding', ...throwingGuards },
      );
      expect(parsedUnknown.ok, `${channelId}: parseBindingBody refuses unknown field with { ok: false }`).toBe(false);
      if (!parsedUnknown.ok) {
        expect(parsedUnknown.fields).toContain('__unknownExtraField');
      }

      // 4. Authority-specific methods with throwing stubs
      if (hasManualSelf && typeof adapter.selfCreate === 'function') {
        const staged = adapter.selfCreate(
          {
            issuer: 'https://lms.school.example.edu',
            authenticationEndpoint: 'https://lms.school.example.edu/auth',
            accessTokenEndpoint: 'https://lms.school.example.edu/token',
            jwksUrl: 'https://lms.school.example.edu/jwks',
            deploymentId: 'dep-1',
          },
          { siteUrl: 'https://lms.school.example.edu', ...throwingGuards },
        );
        expect(staged && typeof staged === 'object').toBe(true);
      }

      if (hasOperatorGrant) {
        const target = adapter.initialTarget!({
          siteUrl: 'https://lms.school.example.edu',
          profileId: defaultProfileId,
          values: parsedOk.ok ? parsedOk.values : validBody,
          ...throwingGuards,
        });
        expect(target && typeof target === 'object').toBe(true);
        const staged = adapter.createRequest!(target, {
          siteUrl: 'https://lms.school.example.edu',
          ...throwingGuards,
        });
        expect(staged && typeof staged === 'object').toBe(true);
      }
    });
  }
}

describe('K0 product channel discovery (AC-LA-E7-01-01, AC-LA-E7-01-02)', () => {
  it('discovers every channel folder under packages/channels/ and includes moodle, canvas and blackboard', () => {
    const folderIds = fs
      .readdirSync(productRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
      .map((d) => d.name)
      .sort();
    const discoveredIds = productChannelRows.map(([id]) => id).slice().sort();
    expect(discoveredIds).toEqual(folderIds);
    expect(discoveredIds).toEqual(expect.arrayContaining(['moodle', 'canvas', 'blackboard']));
  });
});

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

  it('AC-LA-E7-01-06: negative control — a canary copy with a manifest schema error makes K0 fail and name the canary channel and the broken field', async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'la-e7-01-neg-'));
    const badCanaryDir = path.join(tmpRoot, 'zz-canary-bad');
    try {
      fs.mkdirSync(badCanaryDir, { recursive: true, mode: 0o700 });
      fs.writeFileSync(
        path.join(badCanaryDir, 'package.json'),
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

      // 1. Direct kernel check: buildChannelRegistry throws RegistryError naming the canary and field.
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

      // 2. Subprocess K0 run: running K0 with the broken canary root fails with non-zero exit and names both.
      const vitestCli = path.join(repoRoot, 'node_modules/vitest/vitest.mjs');
      const k0Run = spawnSync(
        process.execPath,
        [vitestCli, 'run', '--config', 'tests/ltiaas/k0/vitest.config.mts', 'tests/ltiaas/k0/contract.test.ts'],
        {
          cwd: repoRoot,
          env: { ...process.env, LA_K0_EXTRA_ROOT: tmpRoot },
          encoding: 'utf8',
          timeout: 30_000,
        },
      );
      const combinedOut = `${k0Run.stdout}\n${k0Run.stderr}`;
      expect(k0Run.status, 'K0 run exits non-zero when broken canary is loaded').not.toBe(0);
      expect(combinedOut, 'K0 failure output names zz-canary-bad').toContain('zz-canary-bad');
      expect(combinedOut, 'K0 failure output names names.label').toContain('names.label');
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
