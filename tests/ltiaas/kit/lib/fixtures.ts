import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CHANNELS_DIR = path.resolve(__dirname, '../channels');

export function getChannelsDir(dir?: string): string {
  return dir ?? process.env.QA_KIT_CHANNELS_DIR ?? CHANNELS_DIR;
}

export const BASELINE_CHANNEL_IDS = [
  'moodle',
  'canvas',
  'blackboard',
  'lti-generic',
  'brightspace',
] as const;

export type BaselineChannelId = (typeof BASELINE_CHANNEL_IDS)[number];

export type KitLevel = 'k0' | 'k1sim' | 'all';

export function resolveKitLevel(env: NodeJS.ProcessEnv = process.env): KitLevel {
  const raw = env.LA_LEVEL?.trim().toLowerCase();
  if (!raw) {
    if (
      env.QA_TASK === 'K1' ||
      env.QA_TASK === 'LA-E7-06' ||
      env.QA_KIT_RUN === '1'
    ) {
      return 'k1sim';
    }
    return 'k0';
  }
  if (raw === 'k0') {
    return 'k0';
  }
  if (raw === 'k1sim' || raw === 'k1-sim' || raw === 'k1') {
    return 'k1sim';
  }
  if (raw === 'all') {
    return 'all';
  }
  throw new Error(
    `Unsupported LA_LEVEL=${env.LA_LEVEL}; expected k0, k1sim (or k1-sim), or all`,
  );
}

export function isK1SimLevelEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return resolveKitLevel(env) !== 'k0';
}

export const K1_SIM_SUITES = [
  'K1-REG',
  'K1-CAP',
  'K1-LAUNCH',
  'K1-DL',
  'K1-AGS',
  'K1-NRPS',
  'K-HYG',
] as const;

export const K1_SIM_SUITE_FILES = [
  'suites/k1-reg.k1sim.test.ts',
  'suites/k1-cap.k1sim.test.ts',
  'suites/k1-launch.k1sim.test.ts',
  'suites/k1-dl.k1sim.test.ts',
  'suites/k1-ags.k1sim.test.ts',
  'suites/k1-nrps.k1sim.test.ts',
  'suites/k-hyg.k1sim.test.ts',
] as const;

export function getKitSuiteOrderIndex(filePath: string): number {
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.endsWith('kit.k0.test.ts')) {
    return -1;
  }
  const idx = K1_SIM_SUITE_FILES.findIndex((rel) => normalized.endsWith(rel));
  return idx === -1 ? K1_SIM_SUITE_FILES.length : idx;
}

export function orderKitSuiteSpecs<T>(files: T[], getPath: (item: T) => string): T[] {
  return [...files].sort((a, b) => {
    const idxA = getKitSuiteOrderIndex(getPath(a));
    const idxB = getKitSuiteOrderIndex(getPath(b));
    if (idxA !== idxB) {
      return idxA - idxB;
    }
    return getPath(a).localeCompare(getPath(b));
  });
}

export type KitSuiteName = (typeof K1_SIM_SUITES)[number];

export const CAPABILITY_KEYS = [
  'binding.authority',
  'content.multiple',
  'content.ungraded',
  'deployments.multiple',
  'export.packages',
  'launch.topLevelContinue',
  'launch.windowHint',
  'platform.sharing',
  'publish.createCourse',
  'records.readBack',
  'records.reporters',
  'registration.dynamic',
  'registration.scopes',
  'setup.artifacts',
  'setup.connectionCheck',
  'site.serviceOrigin',
  'siteApi.token',
] as const;

export type CapabilityKey = (typeof CAPABILITY_KEYS)[number];

// Capabilities whose value comes from the selected LTI profile, not from the channel: the rows of the
// LA-ADR-01 D3 catalog whose "Source" is an LTI profile trait (`sharing`, `serviceUrl`). K0 checks this
// list against that table. GET /app-api/lms-providers has no profile, so its `channelCapabilities`
// (channel level, cogniate-app-api-delta.md §2) holds the other keys only; the connection DTO (§1) has a
// selected profile and holds every key.
export const PROFILE_LEVEL_CAPABILITY_KEYS: readonly CapabilityKey[] = [
  'platform.sharing',
  'site.serviceOrigin',
];
export const CHANNEL_LEVEL_CAPABILITY_KEYS: readonly CapabilityKey[] = CAPABILITY_KEYS.filter(
  (key) => !PROFILE_LEVEL_CAPABILITY_KEYS.includes(key),
);

export const CONNECTION_GUARDED_CAPABILITIES: readonly CapabilityKey[] = [
  'registration.dynamic',
  'deployments.multiple',
  'setup.artifacts',
  'siteApi.token',
  'publish.createCourse',
  'setup.connectionCheck',
  'content.ungraded',
] as const;

export const LEGACY_FLAG_KEYS = [
  'dynamicRegistration',
  'operatorApproval',
  'webServices',
  'courseShell',
  'addDeployment',
  'canvasConfiguration',
] as const;

export type LegacyFlagKey = (typeof LEGACY_FLAG_KEYS)[number];

export interface BindingAuthorityCapability {
  dynamic?: 'self' | 'operatorGrant';
  manual: 'self' | 'operatorGrant';
}

export interface ChannelCapabilities {
  'binding.authority': BindingAuthorityCapability;
  'content.multiple': boolean;
  'content.ungraded': boolean;
  'deployments.multiple': boolean;
  'export.packages': string[];
  'launch.topLevelContinue': boolean;
  'launch.windowHint': boolean;
  'platform.sharing': 'exclusive' | 'shared';
  'publish.createCourse': boolean;
  'records.readBack': boolean;
  'records.reporters': string[];
  'registration.dynamic': boolean;
  'registration.scopes': string[];
  'setup.artifacts': string[];
  'setup.connectionCheck': boolean;
  'site.serviceOrigin': boolean;
  'siteApi.token': boolean;
}

export type LegacyFlags = Record<LegacyFlagKey, boolean>;

// One signed product family that the channel guards (LA-ADR-01 D2 `guardedFamilies`, D6 guard levels).
// `family` is lower case, as check 14 compares it.
export interface GuardedFamily {
  family: string;
  level: 'launch' | 'registration';
}

export interface ChannelExpectations {
  legacyFlags: LegacyFlags;
  toolConfigurationKeys: string[];
  guardedFamilies: GuardedFamily[];
}

export interface ChannelPlatformStorageMetadata {
  frameName: string;
  allowedOrigin: string;
}

export interface ChannelSimMetadata {
  siteUrl: string;
  serviceUrl: string;
  siteHost: string;
  pageHost: string;
  issuer: string;
  family: string;
  deployments: string[];
  authEndpoint: string;
  tokenEndpoint: string;
  jwksUrl: string;
  tokenAudience: string | string[];
  tokenAudienceKind: 'string' | 'array' | 'fixed';
  dlDataMode: 'claim' | 'query';
  dlRequiresSub: boolean;
  privacyFloor: 'none' | 'allowlist';
  platformStorage?: ChannelPlatformStorageMetadata | null;
}

export interface ChannelFixture {
  id: string;
  source: string;
  simProvider: string;
  simProfile: string;
  capabilities: ChannelCapabilities;
  coveredBy: Partial<Record<CapabilityKey, string[]>>;
  notBuilt: Partial<Record<CapabilityKey, string>>;
  expect: ChannelExpectations;
  sim: ChannelSimMetadata;
  sources: Record<string, string>;
}

export type ExpectedCaseStatus = 'RUN' | 'NA';

export interface ExpectedCase {
  id: string;
  channelId: string;
  suite: KitSuiteName;
  code: string;
  description: string;
  expectedStatus: ExpectedCaseStatus;
  gatedByCapability?: CapabilityKey;
  coversCapabilities?: CapabilityKey[];
}

export interface ExecutedCaseRecord {
  id: string;
  channelId: string;
  suite: KitSuiteName;
  code: string;
  outcome: 'PASS' | 'FAIL' | 'SKIP';
  runId?: string;
  timestamp?: string;
  detail?: string;
}

export interface WaveSuiteEvidence {
  outcome: 'PASS' | 'FAIL' | 'PENDING';
  waveId: string;
  artifactPath: string;
}

export interface WaveEvidenceManifest {
  waveId: string | null;
  suites: Record<string, WaveSuiteEvidence>;
  error?: string;
}

export interface PassRuleEvaluation {
  channelId: string;
  ok: boolean;
  passed: boolean;
  expectedRunCount: number;
  executedPassCount: number;
  failedCases: string[];
  duplicateOrRetriedCases: string[];
  staleRunCases: string[];
  missingCases: string[];
  extraCases: string[];
  illegalNaCases: string[];
  uncoveredPositiveCapabilities: string[];
  missingNegativeGuards: string[];
  skippedCount: number;
  errors: string[];
}

// C1 operands (AC-LA-E7-06-04): the registry entry of GET /app-api/lms-providers (channel level,
// cogniate-app-api-delta.md §2: the channel-level keys of the fixture) and the connection DTO (§1: every
// key, for its selected profile), each against the fixture in both directions.
export interface BilateralEqualityInput {
  fixture: ChannelFixture;
  providerChannelCapabilities: Record<string, unknown>;
  providerLegacyFlags: Record<string, unknown>;
  connectionChannelCapabilities: Record<string, unknown>;
  connectionLegacyFlags: Record<string, unknown>;
  toolConfigurationKeys: string[];
}

export interface OperatorGrantCliOptions {
  purpose?: 'initial' | 'add_deployment';
  acceptStaged?: boolean;
  issuer?: string;
  authUrl?: string;
  tokenUrl?: string;
  jwksUrl?: string;
  tokenAudience?: string;
  note?: string;
}

// 12 protocol security faults matching tests/acceptance/M1/blackboard/20-protocol.test.ts
// and tests/sim/core/crypto.mjs (AC-LA-E7-06-08).
export const PROTOCOL_SECURITY_FAULTS: ReadonlyArray<readonly [string, string]> = [
  ['altered-signature', 'INVALID_SIGNATURE'],
  ['unknown-key', 'INVALID_SIGNATURE'],
  ['unknown-kid', 'INVALID_SIGNATURE'],
  ['none', 'INVALID_ID_TOKEN'],
  ['hs256', 'INVALID_ID_TOKEN'],
  ['wrong-issuer', 'INVALID_ISSUER_OR_AUDIENCE'],
  ['wrong-audience', 'INVALID_ISSUER_OR_AUDIENCE'],
  ['multi-aud-no-azp', 'INVALID_ISSUER_OR_AUDIENCE'],
  ['multi-aud-wrong-azp', 'INVALID_ISSUER_OR_AUDIENCE'],
  ['expired', 'TOKEN_EXPIRED'],
  ['future-iat', 'TOKEN_EXPIRED'],
  ['wrong-nonce', 'INVALID_NONCE'],
] as const;

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function listChannelFixtureIds(dir: string = getChannelsDir()): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const files = fs
    .readdirSync(dir)
    .filter((entry) => entry.endsWith('.json'))
    .map((entry) => entry.replace(/\.json$/, ''));
  const baselineOrder = BASELINE_CHANNEL_IDS.filter((id) => files.includes(id));
  const extra = files
    .filter((id) => !(BASELINE_CHANNEL_IDS as readonly string[]).includes(id))
    .sort();
  return [...baselineOrder, ...extra];
}

export function loadChannelFixture(
  channelId: string,
  dir: string = getChannelsDir(),
): ChannelFixture {
  const filePath = path.join(dir, `${channelId}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Channel fixture file not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw) as ChannelFixture;
  return parsed;
}

// Selects the single generic-sim protocol-control fixture for once-per-run suites
// (`GLOBAL:K1-LAUNCH:L-FAULTS` and `GLOBAL:K1-NRPS:N2` per TEST-STRATEGY.md §2.4, §2.7).
// Never falls back to `fixtures[0]`; throws if 0 or >1 canonical generic-sim fixtures match.
export function selectProtocolControlFixture(
  fixtures: ChannelFixture[] = loadAllChannelFixtures(),
): ChannelFixture {
  const matches = fixtures.filter(
    (f) =>
      Boolean(f) &&
      f.id === 'lti-generic' &&
      f.simProfile === 'lti-generic' &&
      f.simProvider === 'generic-sim' &&
      f.capabilities?.['registration.dynamic'] === true &&
      f.capabilities?.['binding.authority']?.manual === 'operatorGrant' &&
      f.capabilities?.['content.multiple'] === true &&
      f.capabilities?.['setup.connectionCheck'] === true,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly 1 generic-sim protocol-control fixture (simProfile="lti-generic"), found ${matches.length}`,
    );
  }
  return matches[0];
}

// The channel's profile takes admin endpoints in POST /api/platforms (`endpoints: admin`: the manual `self`
// profile and the admin-value operatorGrant profiles); fixed profiles take none (LA-ADR-02 D2 trait table).
export function takesAdminEndpoints(fixture: ChannelFixture): boolean {
  const caps = fixture.capabilities;
  return (
    caps['binding.authority'].manual === 'self' ||
    (!caps['site.serviceOrigin'] && caps['platform.sharing'] !== 'shared')
  );
}

// The channel's profile has `endpointOrigins: any-https` (admin values with an operator grant; LA-ADR-02 D2):
// the profiles of the I-SELF origin-binding rules (TEST-STRATEGY §2.4 R6) and of the generic reserved-issuer path.
export function isAnyHttpsChannel(fixture: ChannelFixture): boolean {
  return takesAdminEndpoints(fixture) && fixture.capabilities['binding.authority'].manual !== 'self';
}

export function loadAllChannelFixtures(dir: string = getChannelsDir()): ChannelFixture[] {
  return listChannelFixtureIds(dir).map((id) => loadChannelFixture(id, dir));
}

export function resolveSelectedChannelIds(
  raw: string | undefined = process.env.QA_KIT_CHANNELS,
  dir: string = getChannelsDir(),
): string[] {
  const allAvailable = listChannelFixtureIds(dir);
  if (!raw || raw.trim() === '' || raw.trim() === 'all') {
    return allAvailable;
  }
  const requested = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (requested.length === 0) {
    throw new Error(`QA_KIT_CHANNELS is empty after parsing: "${raw}"`);
  }
  for (const id of requested) {
    if (!allAvailable.includes(id)) {
      throw new Error(
        `Unknown channel "${id}" in QA_KIT_CHANNELS. Available channels: ${allAvailable.join(', ')}`,
      );
    }
  }
  return requested;
}

export function loadSelectedChannelFixtures(
  raw?: string,
  dir: string = getChannelsDir(),
): ChannelFixture[] {
  return resolveSelectedChannelIds(raw, dir).map((id) => loadChannelFixture(id, dir));
}

// Builds CLI arguments for `app:grant` per tests/acceptance/M1/common/client.ts:106-114
// and docs/architecture/ltiaas/contracts/cogniate-app-api-delta.md §4.
export function buildOperatorGrantCliArgs(
  libraryId: string,
  fixture: ChannelFixture,
  connectionId: string,
  clientId: string,
  deploymentId: string,
  options: OperatorGrantCliOptions = {},
): string[] {
  const purpose = options.purpose ?? 'initial';
  const args: string[] = [
    'issue',
    '--library',
    libraryId,
    '--connection',
    connectionId,
    '--site',
    fixture.sim.siteUrl,
  ];
  if (fixture.capabilities['site.serviceOrigin']) {
    args.push('--service-url', fixture.sim.serviceUrl);
  }
  args.push('--client-id', clientId, '--deployment-id', deploymentId, '--purpose', purpose);

  if (options.acceptStaged) {
    args.push('--accept-staged', '--confirm-foreign-hosts');
  } else if (
    purpose !== 'add_deployment' &&
    !fixture.capabilities['site.serviceOrigin'] &&
    fixture.capabilities['platform.sharing'] !== 'shared' &&
    fixture.capabilities['binding.authority'].manual === 'operatorGrant'
  ) {
    const issuer = options.issuer ?? fixture.sim.issuer;
    const authUrl = options.authUrl ?? fixture.sim.authEndpoint;
    const tokenUrl = options.tokenUrl ?? fixture.sim.tokenEndpoint;
    const jwksUrl = options.jwksUrl ?? fixture.sim.jwksUrl;
    args.push(
      '--issuer',
      issuer,
      '--auth-url',
      authUrl,
      '--token-url',
      tokenUrl,
      '--jwks-url',
      jwksUrl,
      '--confirm-foreign-hosts',
    );
    if (fixture.sim.tokenAudienceKind === 'fixed') {
      const aud =
        options.tokenAudience ??
        (Array.isArray(fixture.sim.tokenAudience)
          ? fixture.sim.tokenAudience[0]
          : fixture.sim.tokenAudience);
      args.push('--token-audience', aud);
    }
  }
  args.push('--note', options.note ?? `K1 kit ${fixture.id}`);
  return args;
}

// Full npm invocation per docs/architecture/ltiaas/tasks/README.md §2 form (f):
// `npm --workspace @cogniate/cogniate-app run app:grant -- issue ...`
export function buildOperatorGrantNpmArgs(
  libraryId: string,
  fixture: ChannelFixture,
  connectionId: string,
  clientId: string,
  deploymentId: string,
  options: OperatorGrantCliOptions = {},
): string[] {
  return [
    '--workspace',
    '@cogniate/cogniate-app',
    'run',
    'app:grant',
    '--',
    ...buildOperatorGrantCliArgs(
      libraryId,
      fixture,
      connectionId,
      clientId,
      deploymentId,
      options,
    ),
  ];
}

// Parses `app:grant issue` stdout per tests/acceptance/M1/common/client.ts:115-121
// and docs/architecture/ltiaas/contracts/cogniate-app-api.md §4.8.
export function parseOperatorGrantOutput(stdout: string): { id: string; code: string } {
  const text = String(stdout ?? '');
  const idMatch = text.match(/\bgrt_[A-Za-z0-9_-]+\b/);
  const labeledMatch = text.match(
    /Approval code(?:\s*\(shown once\))?\s*:\s*([A-Za-z0-9_-]{43})(?![\w-])/i,
  );
  const codes = [...new Set(text.match(/(?<![\w-])[A-Za-z0-9_-]{43}(?![\w-])/g) ?? [])];
  const code = labeledMatch?.[1] ?? (codes.length === 1 ? codes[0] : '');
  if (!code || !idMatch) {
    throw new Error(`Expected one approval code and grant id from app:grant; got: ${text}`);
  }
  return { id: idMatch[0], code };
}

export function deriveLegacyFlagsFromCapabilities(
  channelId: string,
  capabilities: ChannelCapabilities,
): LegacyFlags {
  const authority = capabilities['binding.authority'];
  const operatorApproval =
    authority.manual === 'operatorGrant' || authority.dynamic === 'operatorGrant';
  return {
    dynamicRegistration: Boolean(capabilities['registration.dynamic']),
    operatorApproval,
    webServices: Boolean(capabilities['siteApi.token']),
    courseShell: Boolean(capabilities['publish.createCourse']),
    addDeployment: Boolean(capabilities['deployments.multiple']),
    canvasConfiguration:
      channelId === 'canvas' || capabilities['setup.artifacts'].includes('developer-key-json'),
  };
}

export function auditFixtureSources(fixture: ChannelFixture): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!fixture || typeof fixture !== 'object') {
    return { ok: false, errors: ['Fixture must be a non-null object'] };
  }
  if (typeof fixture.id !== 'string' || !fixture.id.trim()) {
    errors.push('Fixture id must be a non-empty string');
  }
  if (typeof fixture.source !== 'string' || !fixture.source.trim()) {
    errors.push(`Fixture ${fixture.id}: top-level "source" must be a non-empty string`);
  }
  if (typeof fixture.simProvider !== 'string' || !fixture.simProvider.trim()) {
    errors.push(`Fixture ${fixture.id}: "simProvider" must be a non-empty string`);
  }
  if (typeof fixture.simProfile !== 'string' || !fixture.simProfile.trim()) {
    errors.push(`Fixture ${fixture.id}: "simProfile" must be a non-empty string`);
  }
  if (!isPlainObject(fixture.capabilities)) {
    errors.push(`Fixture ${fixture.id}: "capabilities" must be an object`);
  } else {
    const capKeys = Object.keys(fixture.capabilities);
    for (const reqKey of CAPABILITY_KEYS) {
      if (!(reqKey in fixture.capabilities)) {
        errors.push(`Fixture ${fixture.id}: missing capability key "${reqKey}"`);
      }
    }
    for (const k of capKeys) {
      if (!(CAPABILITY_KEYS as readonly string[]).includes(k)) {
        errors.push(`Fixture ${fixture.id}: unknown capability key "${k}"`);
      }
    }
  }

  if (!isPlainObject(fixture.expect)) {
    errors.push(`Fixture ${fixture.id}: "expect" must be an object`);
  } else {
    if (!isPlainObject(fixture.expect.legacyFlags)) {
      errors.push(`Fixture ${fixture.id}: "expect.legacyFlags" must be an object`);
    } else {
      for (const flagKey of LEGACY_FLAG_KEYS) {
        if (typeof fixture.expect.legacyFlags[flagKey] !== 'boolean') {
          errors.push(`Fixture ${fixture.id}: "expect.legacyFlags.${flagKey}" must be a boolean`);
        }
      }
      if (isPlainObject(fixture.capabilities)) {
        const derived = deriveLegacyFlagsFromCapabilities(fixture.id, fixture.capabilities);
        for (const flagKey of LEGACY_FLAG_KEYS) {
          if (fixture.expect.legacyFlags[flagKey] !== derived[flagKey]) {
            errors.push(
              `Fixture ${fixture.id}: legacyFlag "${flagKey}" (${String(
                fixture.expect.legacyFlags[flagKey],
              )}) does not match LA-ADR-01 §D11 derivation (${String(derived[flagKey])})`,
            );
          }
        }
      }
    }
    if (
      !Array.isArray(fixture.expect.toolConfigurationKeys) ||
      fixture.expect.toolConfigurationKeys.length === 0 ||
      fixture.expect.toolConfigurationKeys.some((k) => typeof k !== 'string' || !k.trim())
    ) {
      errors.push(
        `Fixture ${fixture.id}: "expect.toolConfigurationKeys" must be a non-empty string[]`,
      );
    }
    if (!Array.isArray(fixture.expect.guardedFamilies)) {
      errors.push(
        `Fixture ${fixture.id}: "expect.guardedFamilies" must be an array of { family, level } (empty when the channel guards no family)`,
      );
    } else {
      for (const entry of fixture.expect.guardedFamilies) {
        const family = (entry as Partial<GuardedFamily> | undefined)?.family;
        const level = (entry as Partial<GuardedFamily> | undefined)?.level;
        if (typeof family !== 'string' || !family.trim() || family !== family.toLowerCase()) {
          errors.push(
            `Fixture ${fixture.id}: "expect.guardedFamilies" entry needs a non-empty lower-case family (LA-ADR-01 D2)`,
          );
        }
        if (level !== 'launch' && level !== 'registration') {
          errors.push(
            `Fixture ${fixture.id}: "expect.guardedFamilies" entry level must be "launch" or "registration" (LA-ADR-01 D6)`,
          );
        }
      }
    }
  }

  if (!isPlainObject(fixture.coveredBy)) {
    errors.push(`Fixture ${fixture.id}: "coveredBy" must be an object`);
  } else {
    for (const [k, v] of Object.entries(fixture.coveredBy)) {
      if (!(CAPABILITY_KEYS as readonly string[]).includes(k)) {
        errors.push(`Fixture ${fixture.id}: coveredBy key "${k}" is not a valid capability key`);
      }
      if (!Array.isArray(v) || v.length === 0 || v.some((s) => typeof s !== 'string' || !s.trim())) {
        errors.push(`Fixture ${fixture.id}: coveredBy["${k}"] must be a non-empty string[]`);
      }
    }
  }

  if (!isPlainObject(fixture.notBuilt)) {
    errors.push(`Fixture ${fixture.id}: "notBuilt" must be an object`);
  } else {
    for (const [k, v] of Object.entries(fixture.notBuilt)) {
      if (!(CAPABILITY_KEYS as readonly string[]).includes(k)) {
        errors.push(`Fixture ${fixture.id}: notBuilt key "${k}" is not a valid capability key`);
      }
      if (typeof v !== 'string' || !v.trim()) {
        errors.push(
          `Fixture ${fixture.id}: notBuilt["${k}"] must name an open architecture item or task`,
        );
      }
    }
  }

  if (!isPlainObject(fixture.sources)) {
    errors.push(`Fixture ${fixture.id}: "sources" must be an object mapping fields to citations`);
  } else {
    const requiredSourceKeys = [
      'id',
      'simProvider',
      'simProfile',
      ...CAPABILITY_KEYS.map((k) => `capabilities.${k}`),
      'coveredBy',
      'notBuilt',
      'expect.legacyFlags',
      'expect.toolConfigurationKeys',
      'expect.guardedFamilies',
      'sim',
    ];
    for (const reqSourceKey of requiredSourceKeys) {
      const citation = fixture.sources[reqSourceKey];
      if (typeof citation !== 'string' || !citation.trim()) {
        errors.push(
          `Fixture ${fixture.id}: missing or empty source citation for "${reqSourceKey}"`,
        );
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

export function isCapabilityPositive(key: CapabilityKey, value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value === true;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (key === 'binding.authority' && isPlainObject(value)) {
    return typeof value.manual === 'string';
  }
  if (key === 'platform.sharing') {
    return value === 'exclusive' || value === 'shared';
  }
  return false;
}

export function isConnectionGuardedOff(key: CapabilityKey, value: unknown): boolean {
  if (!CONNECTION_GUARDED_CAPABILITIES.includes(key)) {
    return false;
  }
  if (typeof value === 'boolean') {
    return value === false;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return false;
}

export function computeExpectedGlobalCaseList(): ExpectedCase[] {
  return [
    {
      id: 'GLOBAL:K1-LAUNCH:L-FAULTS',
      channelId: 'GLOBAL',
      suite: 'K1-LAUNCH',
      code: 'L-FAULTS',
      description: '12 protocol security faults run once per kit run on generic-sim',
      expectedStatus: 'RUN',
    },
    {
      id: 'GLOBAL:K1-NRPS:N2',
      channelId: 'GLOBAL',
      suite: 'K1-NRPS',
      code: 'N2',
      description:
        'GET /api/memberships answers for NRPS launch without personal fields, refuses 1.0, and propagates 429 Retry-After',
      expectedStatus: 'RUN',
    },
    {
      id: 'GLOBAL:K-HYG:H1',
      channelId: 'GLOBAL',
      suite: 'K-HYG',
      code: 'H1',
      description:
        'Secret scan across service logs, /__sim/records, and recursive redacted evidence tree finds 0 leaks',
      expectedStatus: 'RUN',
    },
  ];
}

export function computeExpectedCaseList(fixture: ChannelFixture): ExpectedCase[] {
  const cases: ExpectedCase[] = [];
  const caps = fixture.capabilities;
  const notBuilt = fixture.notBuilt ?? {};

  const add = (
    suite: KitSuiteName,
    code: string,
    description: string,
    expectedStatus: ExpectedCaseStatus,
    opts?: { gatedByCapability?: CapabilityKey; coversCapabilities?: CapabilityKey[] },
  ) => {
    cases.push({
      id: `${fixture.id}:${suite}:${code}`,
      channelId: fixture.id,
      suite,
      code,
      description,
      expectedStatus,
      ...(opts?.gatedByCapability ? { gatedByCapability: opts.gatedByCapability } : {}),
      ...(opts?.coversCapabilities ? { coversCapabilities: opts.coversCapabilities } : {}),
    });
  };

  // 1. K1-LAUNCH (L1..L10 per channel; L-FAULTS is global once per kit run)
  const l1Covers: CapabilityKey[] = ['platform.sharing'];
  if (caps['site.serviceOrigin']) {
    l1Covers.push('site.serviceOrigin');
  }
  add(
    'K1-LAUNCH',
    'L1',
    'Valid resource-link launch -> ltik -> /api/idtoken fields and site/service origins',
    'RUN',
    { coversCapabilities: l1Covers },
  );
  add(
    'K1-LAUNCH',
    'L2',
    'Profile-dependent faults unknown-key and wrong-issuer, plus rotated signing key',
    'RUN',
  );
  add(
    'K1-LAUNCH',
    'L3',
    'Unknown deployment code refused with DEPLOYMENT_NOT_REGISTERED and inactive deployment refused with DEPLOYMENT_NOT_ACTIVE',
    'RUN',
  );
  add(
    'K1-LAUNCH',
    'L4',
    'Signed product family of another channel: launch-guarded family refused (400 PROVIDER_PROFILE_MISMATCH); registration-guarded family refused on standard or logged as family_guard_mismatch',
    'RUN',
  );
  add(
    'K1-LAUNCH',
    'L5',
    'Claim policy: name, given_name, family_name, email, custom, and lis kept or dropped by privacyFloor; launch_claims_minimized logged',
    'RUN',
  );
  add(
    'K1-LAUNCH',
    'L6',
    'Document target: iframe -> /play/:playId/embedded (auto-continues only when launch.topLevelContinue is true); window -> /play/:playId',
    'RUN',
    {
      coversCapabilities: caps['launch.topLevelContinue'] ? ['launch.topLevelContinue'] : [],
    },
  );
  add(
    'K1-LAUNCH',
    'L7',
    'Launch without context (AP-05-08..11): player opens, AGS lineitem dispatches score, without AGS has no serviceKey and fails dispatch with clear message, same resourceLinkId shares placement, no sub -> 400 MISSING_CLAIM',
    'RUN',
  );
  add(
    'K1-LAUNCH',
    'L8',
    'Roles: learner launch is graded; staff launch is preview; Deep Linking is only for staff',
    'RUN',
  );
  add(
    'K1-LAUNCH',
    'L9',
    'Two libraries on the same channel stay isolated across courses, launches, and pickers',
    'RUN',
  );
  add(
    'K1-LAUNCH',
    'L10',
    'Platform storage HTTP level (AP-05-01..07): login without lti_storage_target -> 302, with lti_storage_target -> 200 login page or 302 by profile, and storage-check refusals',
    'RUN',
  );

  // 2. K1-DL (D1..D8 + capability-gated D5-UNGRADED)
  add(
    'K1-DL',
    'D1',
    'Deep Linking response JWT (iss, aud, nonce, deployment_id, message_type, version, sub rule, data mode, exact return URL, window hint)',
    'RUN',
    {
      coversCapabilities: caps['launch.windowHint'] ? ['launch.windowHint'] : [],
    },
  );
  add('K1-DL', 'D2', 'One graded item has scoreMaximum: 100', 'RUN');
  add(
    'K1-DL',
    'D3',
    'accept_multiple: true returns N items in list order when content.multiple is true and stays single-select when false; accept_multiple: false refuses >1 items and >20 items',
    'RUN',
    {
      coversCapabilities: caps['content.multiple'] ? ['content.multiple'] : [],
    },
  );
  add(
    'K1-DL',
    'D4',
    'Cancel posts content_items: [] to return URL; cancel with foreign Origin returns 403 ORIGIN_NOT_ALLOWED without consuming session',
    'RUN',
  );
  add(
    'K1-DL',
    'D5',
    'accept_lineitem: false: service refuses item with lineItem (400 INVALID_CONTENT_ITEM) and accepts item without lineItem; picker returns 403 PLACEMENT_NOT_GRADED with zero DL calls when content.ungraded is false',
    'RUN',
  );
  if (caps['content.ungraded'] && !notBuilt['content.ungraded']) {
    add(
      'K1-DL',
      'D5-UNGRADED',
      'Ungraded picker flow when content.ungraded is true',
      'RUN',
      { coversCapabilities: ['content.ungraded'] },
    );
  } else {
    add(
      'K1-DL',
      'D5-UNGRADED',
      'Ungraded picker flow gated by content.ungraded',
      'NA',
      { gatedByCapability: 'content.ungraded' },
    );
  }
  add(
    'K1-DL',
    'D6',
    '/api/idtoken shows acceptLineItem and acceptMediaTypes when present and omits them when absent',
    'RUN',
  );
  add('K1-DL', 'D7', 'Learner Deep Linking launch is refused with zero DL return calls', 'RUN');
  add('K1-DL', 'D8', 'Two Deep Linking responses have distinct nonce claims', 'RUN');

  // 3. K1-AGS (A1..A6)
  const a1Covers: CapabilityKey[] = ['records.reporters', 'registration.scopes'];
  if (caps['records.readBack']) {
    a1Covers.push('records.readBack');
  }
  add(
    'K1-AGS',
    'A1',
    'Token request assertion aud by profile trait (string, array, or platformValue), iss = sub, unique jti, one scope per call, and records.readBack refresh',
    'RUN',
    { coversCapabilities: a1Covers },
  );
  add(
    'K1-AGS',
    'A2',
    'Score body by ADR-010 mapping (scoreGiven, scoreMaximum, activityProgress, gradingProgress, submission.submittedAt, scoringUserId, https extension kept, non-https key dropped)',
    'RUN',
  );
  add(
    'K1-AGS',
    'A3',
    'AGS status mapping: 204 -> sent, 400/404/422 -> failed, 409 -> conflict with channel message, 503 -> retry, 429 Retry-After -> throttled with tries=0',
    'RUN',
  );
  add('K1-AGS', 'A4', 'Staff preview sends no score (scoreSyncs empty, 0 simulator score calls)', 'RUN');
  add(
    'K1-AGS',
    'A5',
    'Disabled connection sends no score (pending outbox row marked CONNECTION_DISABLED, 0 simulator score calls)',
    'RUN',
  );
  add(
    'K1-AGS',
    'A6',
    'Service URLs off the service origin refused at score and result endpoints (400 SERVICE_ORIGIN_MISMATCH / INVALID_AGS_ENDPOINT)',
    'RUN',
  );

  // 4. K1-NRPS (N1 per channel; N2 is global once per kit run)
  add(
    'K1-NRPS',
    'N1',
    'No token request asks for NRPS scope; setup artifact JSON scopes and DR request scopes have the 4 AGS scopes only',
    'RUN',
  );

  // 5. K1-REG (R1..R6 + capability-gated R1-DEPLOYMENTS and R-CHECK)
  const r1Covers: CapabilityKey[] = ['binding.authority'];
  if (caps['setup.artifacts'].length > 0) {
    r1Covers.push('setup.artifacts');
  }
  add(
    'K1-REG',
    'R1',
    'Manual setup with manifest required fields; strict body refuses unknown or missing field; POST /app-api/connections refuses IP literal, localhost, and own host (422 INVALID_SITE_URL)',
    'RUN',
    { coversCapabilities: r1Covers },
  );
  if (caps['deployments.multiple']) {
    add(
      'K1-REG',
      'R1-DEPLOYMENTS',
      'Adding a second deployment on one registration succeeds when deployments.multiple is true',
      'RUN',
      { coversCapabilities: ['deployments.multiple'] },
    );
  } else {
    add(
      'K1-REG',
      'R1-DEPLOYMENTS',
      'Adding a second deployment gated by deployments.multiple',
      'NA',
      { gatedByCapability: 'deployments.multiple' },
    );
  }
  add(
    'K1-REG',
    'R2',
    'Authority: operatorGrant happy path + 422 GRANT_INVALID + 422 GRANT_MISMATCH (details.fields), or self-only refusal on app:grant issue',
    'RUN',
    { coversCapabilities: ['binding.authority'] },
  );
  if (caps['registration.dynamic']) {
    add(
      'K1-REG',
      'R3',
      'Dynamic Registration: path-prefix issuer, opaque-bearer or scope-jwt token, authorization_server stored as token audience, refusal on missing DL or scope, family guard at both levels, granted scopes stored',
      'RUN',
      { coversCapabilities: ['registration.dynamic'] },
    );
  } else {
    add(
      'K1-REG',
      'R3',
      'Dynamic Registration gated by registration.dynamic',
      'NA',
      { gatedByCapability: 'registration.dynamic' },
    );
  }
  add('K1-REG', 'R4', 'Reserved issuer refused with 400 ISSUER_RESERVED', 'RUN');
  add(
    'K1-REG',
    'R5',
    'GET /app-api/connections/:id/tool-configuration row keys match fixture.expect.toolConfigurationKeys in order',
    'RUN',
  );
  add(
    'K1-REG',
    'R6',
    'Origin binding I-SELF negative case (AP-07-11): off-origin DR stages registration (endpointsOnIssuerOrigin: false, active: false, operatorGrant, 403 PLATFORM_NOT_ACTIVE); active POST /api/platforms refuses off-origin (400 PLATFORM_URL_NOT_ON_ISSUER_ORIGIN) and cross-profile host (400 PLATFORM_URL_NOT_IN_PROFILE)',
    'RUN',
  );
  if (caps['setup.connectionCheck']) {
    add(
      'K1-REG',
      'R-CHECK',
      'Connection check POST /app-api/connections/:id/check returns ok on valid credentials and failed on invalid_client',
      'RUN',
      { coversCapabilities: ['setup.connectionCheck'] },
    );
  } else {
    add(
      'K1-REG',
      'R-CHECK',
      'Connection check gated by setup.connectionCheck',
      'NA',
      { gatedByCapability: 'setup.connectionCheck' },
    );
  }

  // 6. K1-CAP (C1, C2:<cap>, C3)
  add(
    'K1-CAP',
    'C1',
    'channel-level channelCapabilities of the registry entry (GET /app-api/lms-providers) and the full set of the connection DTO equal the fixture in both directions; six legacy flags; tool configuration keys',
    'RUN',
  );
  for (const cap of CONNECTION_GUARDED_CAPABILITIES) {
    if (notBuilt[cap]) {
      continue;
    }
    if (isConnectionGuardedOff(cap, caps[cap])) {
      add(
        'K1-CAP',
        `C2:${cap}`,
        `Negative capability guard for ${cap}: route/UI refuses action when capability is false/empty`,
        'RUN',
      );
    }
  }
  add(
    'K1-CAP',
    'C3',
    'Disconnect disables connection or deployment (PLATFORM_NOT_ACTIVE / DEPLOYMENT_NOT_ACTIVE) while leaving other connections on the channel working',
    'RUN',
  );

  // 7. K-HYG (H2 per channel; H1 is global once per kit run)
  add(
    'K-HYG',
    'H2',
    'Pass rule & N/A rule verification: executed cases === expected RUN cases, 0 skips, 0 retries, wave evidence verified',
    'RUN',
  );

  return cases;
}

// Verifies that a coveredBy suite's artifactPath resolves inside the current run folder,
// exists on disk, is non-empty JSON, and records a PASS outcome for that suite in currentWaveId.
export function verifyWaveSuiteArtifact(
  runDir: string | null | undefined,
  suiteName: string,
  entry: WaveSuiteEvidence,
  currentWaveId: string,
): { ok: boolean; error?: string } {
  if (typeof entry.artifactPath !== 'string' || !entry.artifactPath.trim()) {
    return {
      ok: false,
      error: `frozen suite "${suiteName}" has empty artifactPath`,
    };
  }
  if (!runDir || !runDir.trim()) {
    return {
      ok: false,
      error: `missing runDir to verify artifactPath "${entry.artifactPath}" for suite "${suiteName}"`,
    };
  }
  const resolvedRunDir = path.resolve(runDir);
  const resolvedArtifact = path.resolve(resolvedRunDir, entry.artifactPath);
  const rel = path.relative(resolvedRunDir, resolvedArtifact);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return {
      ok: false,
      error: `artifactPath "${entry.artifactPath}" for suite "${suiteName}" resolves outside current run folder "${resolvedRunDir}"`,
    };
  }
  if (!fs.existsSync(resolvedArtifact)) {
    return {
      ok: false,
      error: `artifact file for suite "${suiteName}" does not exist at "${resolvedArtifact}"`,
    };
  }
  let stat: fs.Stats;
  try {
    stat = fs.statSync(resolvedArtifact);
  } catch (err) {
    return {
      ok: false,
      error: `cannot stat artifact file for suite "${suiteName}": ${(err as Error).message}`,
    };
  }
  if (!stat.isFile() || stat.size === 0) {
    return {
      ok: false,
      error: `artifact file for suite "${suiteName}" at "${resolvedArtifact}" is empty or not a regular file`,
    };
  }
  try {
    const raw = fs.readFileSync(resolvedArtifact, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!isPlainObject(parsed)) {
      return {
        ok: false,
        error: `artifact file for suite "${suiteName}" at "${resolvedArtifact}" is not a JSON object`,
      };
    }
    if (typeof parsed.suite !== 'string' || parsed.suite !== suiteName) {
      return {
        ok: false,
        error: `artifact file "${entry.artifactPath}" suite="${String(parsed.suite)}" !== expected "${suiteName}"`,
      };
    }
    if (parsed.waveId !== currentWaveId) {
      return {
        ok: false,
        error: `artifact file "${entry.artifactPath}" for suite "${suiteName}" has waveId="${String(parsed.waveId)}" !== currentWaveId="${currentWaveId}"`,
      };
    }
    if (parsed.outcome !== 'PASS') {
      return {
        ok: false,
        error: `artifact file "${entry.artifactPath}" for suite "${suiteName}" has outcome="${String(parsed.outcome)}" !== "PASS"`,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: `invalid JSON in artifact file "${entry.artifactPath}" for suite "${suiteName}": ${(err as Error).message}`,
    };
  }
}

export function evaluateChannelPassRule(input: {
  fixture: ChannelFixture;
  expectedCases?: ExpectedCase[];
  executedRecords: ExecutedCaseRecord[];
  waveEvidence?: WaveEvidenceManifest | null;
  currentWaveId?: string | null;
  expectedRunId?: string | null;
  runDir?: string | null;
}): PassRuleEvaluation {
  const { fixture } = input;
  const expectedCases = input.expectedCases ?? computeExpectedCaseList(fixture);
  const channelRecords = input.executedRecords.filter((r) => r.channelId === fixture.id);
  // Derive currentWaveId ONLY from the run input or LA_WAVE_ID env (NEVER from waveEvidence.waveId).
  const currentWaveId =
    input.currentWaveId !== undefined
      ? input.currentWaveId
      : (process.env.LA_WAVE_ID?.trim() || null);
  const waveEvidence = input.waveEvidence ?? null;
  const expectedRunId = input.expectedRunId ?? null;
  const runDir = input.runDir !== undefined ? input.runDir : (process.env.LA_RUN_DIR ?? null);

  const errors: string[] = [];
  const failedCases: string[] = [];
  const duplicateOrRetriedCases: string[] = [];
  const staleRunCases: string[] = [];
  const missingCases: string[] = [];
  const extraCases: string[] = [];
  const illegalNaCases: string[] = [];
  const uncoveredPositiveCapabilities: string[] = [];
  const missingNegativeGuards: string[] = [];

  const expectedById = new Map<string, ExpectedCase>();
  for (const c of expectedCases) {
    expectedById.set(c.id, c);
  }

  let skippedCount = 0;
  const recordsById = new Map<string, ExecutedCaseRecord[]>();
  for (const rec of channelRecords) {
    if (expectedRunId && rec.runId && rec.runId !== expectedRunId) {
      staleRunCases.push(rec.id);
      errors.push(
        `stale run record: ${rec.id} (record runId="${rec.runId}" !== active runId="${expectedRunId}")`,
      );
    } else if (expectedRunId && !rec.runId) {
      staleRunCases.push(rec.id);
      errors.push(`stale run record: ${rec.id} (missing runId; active runId="${expectedRunId}")`);
    }
    if (rec.outcome === 'SKIP') {
      skippedCount += 1;
      errors.push(`skipped case: ${rec.id}${rec.detail ? ` (${rec.detail})` : ''}`);
    }
    if (rec.outcome === 'FAIL') {
      failedCases.push(rec.id);
      errors.push(`failed case: ${rec.id}${rec.detail ? ` (${rec.detail})` : ''}`);
    }
    const list = recordsById.get(rec.id) ?? [];
    list.push(rec);
    recordsById.set(rec.id, list);
  }

  const passedIds = new Set<string>();
  for (const [id, recs] of recordsById.entries()) {
    const exp = expectedById.get(id);
    if (!exp || exp.expectedStatus !== 'RUN') {
      extraCases.push(id);
      errors.push(`extra case: ${id}`);
    }
    if (recs.length > 1) {
      duplicateOrRetriedCases.push(id);
      errors.push(
        `duplicate/retried case: ${id} (recorded ${recs.length} times: ${recs
          .map((r) => r.outcome)
          .join(' -> ')})`,
      );
    }
    const allPass =
      recs.length === 1 &&
      recs[0].outcome === 'PASS' &&
      (!expectedRunId || recs[0].runId === expectedRunId);
    if (allPass) {
      passedIds.add(id);
    }
  }

  const expectedRunCases = expectedCases.filter((c) => c.expectedStatus === 'RUN');
  for (const exp of expectedRunCases) {
    const recs = recordsById.get(exp.id);
    if (!recs || recs.length === 0) {
      missingCases.push(exp.id);
      errors.push(`missing case: ${exp.id}`);
    }
  }

  // N/A rule: every NA case must have gatedByCapability set to a false/empty capability in fixture.capabilities
  // AND that capability must either be in notBuilt or have a passing C2:<capability> guard case
  const expectedNaCases = expectedCases.filter((c) => c.expectedStatus === 'NA');
  for (const naCase of expectedNaCases) {
    const cap = naCase.gatedByCapability;
    if (!cap) {
      illegalNaCases.push(`${naCase.id} (missing gatedByCapability)`);
      errors.push(`illegal N/A: ${naCase.id} has no gatedByCapability`);
      continue;
    }
    const val = fixture.capabilities[cap];
    if (isCapabilityPositive(cap, val)) {
      illegalNaCases.push(`${naCase.id} (capability ${cap} is positive)`);
      errors.push(`illegal N/A: ${naCase.id} is marked NA but capability "${cap}" is true/non-empty`);
      continue;
    }
    if (!fixture.notBuilt?.[cap]) {
      const c2Id = `${fixture.id}:K1-CAP:C2:${cap}`;
      if (!passedIds.has(c2Id)) {
        illegalNaCases.push(`${naCase.id} (missing passing ${c2Id})`);
        errors.push(`illegal N/A: ${naCase.id} requires passing negative guard "${c2Id}"`);
      }
    }
  }

  // Rule 1: Positive capability coverage + coveredBy current-wave evidence
  for (const cap of CAPABILITY_KEYS) {
    if (fixture.notBuilt?.[cap]) {
      continue;
    }
    const val = fixture.capabilities[cap];
    if (!isCapabilityPositive(cap, val)) {
      continue;
    }
    const coveredSuites = fixture.coveredBy?.[cap];
    if (coveredSuites && coveredSuites.length > 0) {
      if (!currentWaveId || !currentWaveId.trim()) {
        uncoveredPositiveCapabilities.push(`${cap} (missing currentWaveId for coveredBy)`);
        errors.push(
          `missing wave evidence: capability "${cap}" on "${fixture.id}" requires currentWaveId (LA_WAVE_ID)`,
        );
        continue;
      }
      if (!waveEvidence || waveEvidence.error) {
        uncoveredPositiveCapabilities.push(
          `${cap} (missing wave evidence manifest${
            waveEvidence?.error ? `: ${waveEvidence.error}` : ''
          })`,
        );
        errors.push(
          `missing wave evidence: capability "${cap}" on "${fixture.id}" requires wave-evidence.json (${
            waveEvidence?.error ?? 'manifest not provided'
          })`,
        );
        continue;
      }
      if (waveEvidence.waveId !== currentWaveId) {
        uncoveredPositiveCapabilities.push(
          `${cap} (stale wave evidence manifest waveId=${String(
            waveEvidence.waveId,
          )} !== ${currentWaveId})`,
        );
        errors.push(
          `stale wave evidence: manifest waveId "${String(
            waveEvidence.waveId,
          )}" !== current wave "${currentWaveId}" for capability "${cap}"`,
        );
        continue;
      }
      for (const suiteName of coveredSuites) {
        const entry = waveEvidence.suites?.[suiteName];
        if (!entry) {
          uncoveredPositiveCapabilities.push(
            `${cap} (coveredBy ${suiteName}=MISSING in wave ${currentWaveId})`,
          );
          errors.push(
            `missing wave evidence: capability "${cap}" on "${fixture.id}" requires frozen suite "${suiteName}" in wave "${currentWaveId}"`,
          );
          continue;
        }
        if (entry.waveId !== currentWaveId) {
          uncoveredPositiveCapabilities.push(
            `${cap} (coveredBy ${suiteName} stale waveId=${String(entry.waveId)} !== ${currentWaveId})`,
          );
          errors.push(
            `stale wave evidence: frozen suite "${suiteName}" for "${cap}" has waveId "${String(
              entry.waveId,
            )}" !== "${currentWaveId}"`,
          );
          continue;
        }
        if (typeof entry.artifactPath !== 'string' || !entry.artifactPath.trim()) {
          uncoveredPositiveCapabilities.push(
            `${cap} (coveredBy ${suiteName} missing artifactPath)`,
          );
          errors.push(
            `missing wave evidence artifactPath: frozen suite "${suiteName}" for "${cap}" has empty artifactPath`,
          );
          continue;
        }
        if (entry.outcome === 'PENDING') {
          uncoveredPositiveCapabilities.push(
            `${cap} (coveredBy ${suiteName}=PENDING in wave ${currentWaveId})`,
          );
          errors.push(
            `pending wave suite: capability "${cap}" on "${fixture.id}" coveredBy "${suiteName}" is PENDING`,
          );
          continue;
        }
        if (entry.outcome !== 'PASS') {
          uncoveredPositiveCapabilities.push(
            `${cap} (coveredBy ${suiteName}=${String(entry.outcome)})`,
          );
          errors.push(
            `failed wave suite: capability "${cap}" on "${fixture.id}" coveredBy "${suiteName}" has outcome "${String(
              entry.outcome,
            )}"`,
          );
          continue;
        }
        const artifactCheck = verifyWaveSuiteArtifact(runDir, suiteName, entry, currentWaveId);
        if (!artifactCheck.ok) {
          uncoveredPositiveCapabilities.push(
            `${cap} (coveredBy ${suiteName} invalid artifact: ${artifactCheck.error})`,
          );
          errors.push(
            `invalid wave evidence artifact: capability "${cap}" on "${fixture.id}" coveredBy "${suiteName}": ${artifactCheck.error}`,
          );
          continue;
        }
      }
      // If the capability ALSO has expected RUN cases in the kit (e.g., registration.dynamic -> R3),
      // verify those kit cases passed as well.
      const coveringKitCases = expectedRunCases.filter((c) =>
        c.coversCapabilities?.includes(cap),
      );
      if (coveringKitCases.length > 0 && !coveringKitCases.some((c) => passedIds.has(c.id))) {
        uncoveredPositiveCapabilities.push(cap);
        errors.push(
          `uncovered positive capability: "${cap}" on "${fixture.id}" has no passing kit case`,
        );
      }
      continue;
    }

    const coveringCases = expectedRunCases.filter((c) => c.coversCapabilities?.includes(cap));
    const hasPassingCase = coveringCases.some((c) => passedIds.has(c.id));
    if (!hasPassingCase) {
      uncoveredPositiveCapabilities.push(cap);
      errors.push(
        `uncovered positive capability: "${cap}" on "${fixture.id}" has no passing kit case`,
      );
    }
  }

  // Rule 2: Negative capability guard coverage
  for (const cap of CONNECTION_GUARDED_CAPABILITIES) {
    if (fixture.notBuilt?.[cap]) {
      continue;
    }
    if (isConnectionGuardedOff(cap, fixture.capabilities[cap])) {
      const c2Id = `${fixture.id}:K1-CAP:C2:${cap}`;
      if (!passedIds.has(c2Id)) {
        missingNegativeGuards.push(cap);
        errors.push(`missing C2 guard for false/empty capability "${cap}" (${c2Id})`);
      }
    }
  }

  const ok =
    errors.length === 0 &&
    failedCases.length === 0 &&
    duplicateOrRetriedCases.length === 0 &&
    staleRunCases.length === 0 &&
    missingCases.length === 0 &&
    extraCases.length === 0 &&
    illegalNaCases.length === 0 &&
    uncoveredPositiveCapabilities.length === 0 &&
    missingNegativeGuards.length === 0 &&
    skippedCount === 0 &&
    passedIds.size === expectedRunCases.length;

  return {
    channelId: fixture.id,
    ok,
    passed: ok,
    expectedRunCount: expectedRunCases.length,
    executedPassCount: passedIds.size,
    failedCases,
    duplicateOrRetriedCases,
    staleRunCases,
    missingCases,
    extraCases,
    illegalNaCases,
    uncoveredPositiveCapabilities,
    missingNegativeGuards,
    skippedCount,
    errors,
  };
}

export function verifyBilateralCapabilities(input: BilateralEqualityInput): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!input || !input.fixture) {
    return { ok: false, errors: ['missing fixture in verifyBilateralCapabilities'] };
  }
  const { fixture } = input;

  if (!isPlainObject(input.providerChannelCapabilities)) {
    errors.push('missing or invalid providerChannelCapabilities object');
  }
  if (!isPlainObject(input.providerLegacyFlags)) {
    errors.push('missing or invalid providerLegacyFlags object');
  }
  if (!isPlainObject(input.connectionChannelCapabilities)) {
    errors.push('missing or invalid connectionChannelCapabilities object');
  }
  if (!isPlainObject(input.connectionLegacyFlags)) {
    errors.push('missing or invalid connectionLegacyFlags object');
  }
  if (
    !Array.isArray(input.toolConfigurationKeys) ||
    input.toolConfigurationKeys.some((k) => typeof k !== 'string')
  ) {
    errors.push('missing or invalid toolConfigurationKeys array');
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // Channel level: the registry entry holds exactly the channel-level keys, with the fixture values.
  for (const key of CHANNEL_LEVEL_CAPABILITY_KEYS) {
    const expectedVal = fixture.capabilities[key];
    const provVal = input.providerChannelCapabilities[key];
    if (JSON.stringify(provVal) !== JSON.stringify(expectedVal)) {
      errors.push(
        `GET /app-api/lms-providers channelCapabilities["${key}"] mismatch on "${
          fixture.id
        }": expected ${JSON.stringify(expectedVal)}, got ${JSON.stringify(provVal)}`,
      );
    }
  }
  for (const k of Object.keys(input.providerChannelCapabilities)) {
    if ((PROFILE_LEVEL_CAPABILITY_KEYS as readonly string[]).includes(k)) {
      errors.push(
        `GET /app-api/lms-providers channelCapabilities carries the profile-level key "${k}" on "${fixture.id}" (channel-level map; LA-ADR-01 D3)`,
      );
    } else if (!(CAPABILITY_KEYS as readonly string[]).includes(k)) {
      errors.push(
        `GET /app-api/lms-providers has unknown capability key "${k}" on "${fixture.id}"`,
      );
    }
  }

  // Selected profile: the connection DTO holds every key, with the fixture values.
  for (const key of CAPABILITY_KEYS) {
    const expectedVal = fixture.capabilities[key];
    const connVal = input.connectionChannelCapabilities[key];
    if (JSON.stringify(connVal) !== JSON.stringify(expectedVal)) {
      errors.push(
        `GET /app-api/connections/:id channelCapabilities["${key}"] mismatch on "${
          fixture.id
        }": expected ${JSON.stringify(expectedVal)}, got ${JSON.stringify(connVal)}`,
      );
    }
  }
  for (const k of Object.keys(input.connectionChannelCapabilities)) {
    if (!(CAPABILITY_KEYS as readonly string[]).includes(k)) {
      errors.push(
        `GET /app-api/connections/:id has unknown capability key "${k}" on "${fixture.id}"`,
      );
    }
  }

  for (const flag of LEGACY_FLAG_KEYS) {
    const expectedFlag = fixture.expect.legacyFlags[flag];
    const provFlag = input.providerLegacyFlags[flag];
    if (provFlag !== expectedFlag) {
      errors.push(
        `GET /app-api/lms-providers legacy flag "${flag}" mismatch on "${
          fixture.id
        }": expected ${String(expectedFlag)}, got ${String(provFlag)}`,
      );
    }
    const connFlag = input.connectionLegacyFlags[flag];
    if (connFlag !== expectedFlag) {
      errors.push(
        `GET /app-api/connections/:id legacy flag "${flag}" mismatch on "${
          fixture.id
        }": expected ${String(expectedFlag)}, got ${String(connFlag)}`,
      );
    }
  }

  if (
    JSON.stringify(input.toolConfigurationKeys) !==
    JSON.stringify(fixture.expect.toolConfigurationKeys)
  ) {
    errors.push(
      `GET /app-api/connections/:id/tool-configuration keys mismatch on "${
        fixture.id
      }": expected ${JSON.stringify(
        fixture.expect.toolConfigurationKeys,
      )}, got ${JSON.stringify(input.toolConfigurationKeys)}`,
    );
  }

  return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------------------------
// K1-LAUNCH L4: signed product family of another channel (TEST-STRATEGY §2.4 L4).
// Design data: LA-ADR-01 D6 (generic check 14 and the two guard levels), cogniate-app-api-delta.md §5
// (LMS check), LA-ADR-02 D1/D4 (brightspace guards desire2learn at the registration level).
// The guard levels come from each fixture's `expect.guardedFamilies`; nothing here names a channel.
// ---------------------------------------------------------------------------------------------

export type FamilyGuardKind = 'launch_guarded' | 'registration_guarded' | 'unguarded';

export interface FamilyGuardExpectation {
  targetChannelId: string;
  targetProductFamilyCode: string;
  foreignFamily: string;
  foreignFamilyCategory: FamilyGuardKind;
  guardedBy?: string;
  // refuse: 400 page PROVIDER_PROFILE_MISMATCH. warn_passthrough: 303 and an LTI log
  // `family_guard_mismatch {platform_id, family}`. pass: 303 and no such log line.
  expectedOutcome: 'refuse' | 'warn_passthrough' | 'pass';
  expectedStatus: 400 | 303;
  expectedCode?: 'PROVIDER_PROFILE_MISMATCH';
  expectedLogEvent?: 'family_guard_mismatch';
}

export interface FamilyGuardOwner {
  family: string;
  level: 'launch' | 'registration';
  channelId: string;
}

// Collects the guard declarations of all fixtures. One family has one guard level; a family that
// two fixtures guard at different levels is a fixture error.
export function buildFamilyGuardMap(fixtures: ChannelFixture[]): Map<string, FamilyGuardOwner[]> {
  const map = new Map<string, FamilyGuardOwner[]>();
  for (const fixture of fixtures) {
    const declared = fixture?.expect?.guardedFamilies;
    if (!Array.isArray(declared)) {
      throw new Error(
        `L4: fixture "${fixture?.id ?? ''}" has no expect.guardedFamilies array (LA-ADR-01 D2/D6)`,
      );
    }
    for (const entry of declared) {
      const family = String(entry.family ?? '').toLowerCase();
      const owners = map.get(family) ?? [];
      owners.push({ family, level: entry.level, channelId: fixture.id });
      map.set(family, owners);
    }
  }
  for (const [family, owners] of map) {
    if (new Set(owners.map((o) => o.level)).size > 1) {
      throw new Error(
        `L4: family "${family}" is guarded at two levels (${owners
          .map((o) => `${o.channelId}:${o.level}`)
          .join(', ')})`,
      );
    }
  }
  return map;
}

function familyOwnerFor(
  target: ChannelFixture,
  family: string,
  map: Map<string, FamilyGuardOwner[]>,
): FamilyGuardOwner | undefined {
  return (map.get(family.toLowerCase()) ?? []).find((o) => o.channelId !== target.id);
}

function ownFamiliesOf(target: ChannelFixture): Set<string> {
  const own = new Set<string>([String(target.sim?.family ?? '').toLowerCase()]);
  for (const entry of target.expect?.guardedFamilies ?? []) {
    own.add(String(entry.family).toLowerCase());
  }
  return own;
}

// Derives the expected L4 outcome BEFORE the launch, from the declared guard levels only:
// - a family that another channel guards at the `launch` level: 400 PROVIDER_PROFILE_MISMATCH;
// - a family that another channel guards at the `registration` level: 400 on a platform of a
//   MANUAL_SELF_LEGACY_CHANNELS channel (load check 6: the only channels whose manual method keeps
//   authority `self`), else 303 and an LTI log `family_guard_mismatch`;
// - a family that no channel guards: 303 and no `family_guard_mismatch` log ("an F that no channel
//   guards, passes").
export function deriveExpectedFamilyGuardOutcome(
  targetFixture: ChannelFixture,
  foreignFamily: string,
  allFixtures: ChannelFixture[],
): FamilyGuardExpectation {
  if (!targetFixture || !targetFixture.sim) {
    throw new Error('deriveExpectedFamilyGuardOutcome requires a valid targetFixture');
  }
  if (!foreignFamily || typeof foreignFamily !== 'string') {
    throw new Error('deriveExpectedFamilyGuardOutcome requires a non-empty foreignFamily');
  }
  const ownFamily = String(targetFixture.sim.family ?? '');
  if (ownFamiliesOf(targetFixture).has(foreignFamily.toLowerCase())) {
    throw new Error(
      `foreignFamily "${foreignFamily}" is the own or a guarded family of target channel "${targetFixture.id}"`,
    );
  }
  const owner = familyOwnerFor(targetFixture, foreignFamily, buildFamilyGuardMap(allFixtures));
  const base = {
    targetChannelId: targetFixture.id,
    targetProductFamilyCode: ownFamily,
    foreignFamily,
  };
  if (!owner) {
    return {
      ...base,
      foreignFamilyCategory: 'unguarded',
      expectedOutcome: 'pass',
      expectedStatus: 303,
    };
  }
  if (owner.level === 'launch') {
    return {
      ...base,
      foreignFamilyCategory: 'launch_guarded',
      guardedBy: owner.channelId,
      expectedOutcome: 'refuse',
      expectedStatus: 400,
      expectedCode: 'PROVIDER_PROFILE_MISMATCH',
    };
  }
  if (targetFixture.capabilities?.['binding.authority']?.manual === 'self') {
    return {
      ...base,
      foreignFamilyCategory: 'registration_guarded',
      guardedBy: owner.channelId,
      expectedOutcome: 'refuse',
      expectedStatus: 400,
      expectedCode: 'PROVIDER_PROFILE_MISMATCH',
    };
  }
  return {
    ...base,
    foreignFamilyCategory: 'registration_guarded',
    guardedBy: owner.channelId,
    expectedOutcome: 'warn_passthrough',
    expectedStatus: 303,
    expectedLogEvent: 'family_guard_mismatch',
  };
}

export interface FamilyGuardSelection {
  probes: FamilyGuardExpectation[];
  notes: string[];
}

// Selects the L4 probes for one target channel from all fixtures (discovery order):
// 1. required: one family that another channel guards at the `launch` level;
// 2. when one exists: one family that another channel guards at the `registration` level;
// 3. control: one family that no fixture guards (a fixture `sim.family`, else a fixed test value).
export function selectFamilyGuardProbes(
  target: ChannelFixture,
  allFixtures: ChannelFixture[],
): FamilyGuardSelection {
  const map = buildFamilyGuardMap(allFixtures);
  const own = ownFamiliesOf(target);
  const foreignAt = (level: 'launch' | 'registration') => {
    for (const fixture of allFixtures) {
      if (fixture.id === target.id) continue;
      for (const entry of fixture.expect.guardedFamilies) {
        const family = entry.family.toLowerCase();
        if (entry.level === level && !own.has(family)) {
          return family;
        }
      }
    }
    return undefined;
  };

  const notes: string[] = [];
  const launchFamily = foreignAt('launch');
  if (!launchFamily) {
    throw new Error(
      `L4: no family that another channel guards at the launch level for target "${target.id}" (LA-ADR-01 D6; check expect.guardedFamilies in the fixtures)`,
    );
  }
  const probes = [deriveExpectedFamilyGuardOutcome(target, launchFamily, allFixtures)];

  const registrationFamily = foreignAt('registration');
  if (registrationFamily) {
    probes.push(deriveExpectedFamilyGuardOutcome(target, registrationFamily, allFixtures));
  } else {
    notes.push(
      `L4: no family that another channel guards at the registration level for target "${target.id}"; the registration-level probe has no input`,
    );
  }

  const unguarded =
    allFixtures
      .map((f) => String(f.sim?.family ?? '').toLowerCase())
      .find((family) => family && !own.has(family) && !map.has(family)) ??
    'kit-unguarded-family';
  probes.push(deriveExpectedFamilyGuardOutcome(target, unguarded, allFixtures));
  return { probes, notes };
}

// Where a Dynamic Registration with a guarded foreign family is refused (R3 part 5). Contract: the start or the
// confirm step gives the PROVIDER_PROFILE_MISMATCH page (cogniate-app-api-delta.md §5; AC-LA-E2-05-05). Recorded
// deviation at the final SHA a8bbac53 (Architect A1 ruling BD-A1-121; fix planned for LG): when the family is guarded
// at the `registration` level and the DR start rule also lets the owner channel pass the configuration, the start
// (303) and the confirm page (200) pass, and `complete` refuses (400 INVALID_REQUEST, reason `family=<family>`), so
// the app page is REGISTRATION_FAILED (502). The start lets the owner pass when the owner takes `any-https` admin
// endpoints and the target's configuration is not bound to a fixed or issuer-bound profile (the target takes admin
// endpoints). Else no loaded channel lets the configuration pass, and the start keeps the PROVIDER_PROFILE_MISMATCH
// page.
export function drFamilyGuardRefusedAtComplete(
  target: ChannelFixture,
  probe: Pick<FamilyGuardExpectation, 'foreignFamily' | 'foreignFamilyCategory'>,
  allFixtures: ChannelFixture[],
): boolean {
  if (probe.foreignFamilyCategory !== 'registration_guarded') return false;
  const family = probe.foreignFamily.toLowerCase();
  const owner = allFixtures.find(
    (f) => f.id !== target.id && f.expect.guardedFamilies.some((g) => g.family.toLowerCase() === family),
  );
  return Boolean(owner && isAnyHttpsChannel(owner) && takesAdminEndpoints(target));
}

export function validateFamilyGuardLaunchObservation(
  expected: FamilyGuardExpectation,
  observation: {
    status: number;
    body?: string;
    location?: string;
    warnLogCount?: number;
  },
): { ok: boolean; error?: string } {
  const label = `foreignFamily="${expected.foreignFamily}" (${expected.foreignFamilyCategory}) on "${expected.targetChannelId}"`;
  if (expected.expectedOutcome === 'refuse') {
    if (observation.status !== 400) {
      return { ok: false, error: `expected 400 refusal for ${label}, got status=${observation.status}` };
    }
    if (!String(observation.body ?? '').includes('data-error-code="PROVIDER_PROFILE_MISMATCH"')) {
      return { ok: false, error: `expected the PROVIDER_PROFILE_MISMATCH error page for ${label}` };
    }
    if (observation.location) {
      return { ok: false, error: `expected no Location on the refusal for ${label}` };
    }
    return { ok: true };
  }

  if (observation.status !== 303) {
    return { ok: false, error: `expected 303 for ${label}, got status=${observation.status}` };
  }
  const logs = observation.warnLogCount ?? 0;
  if (expected.expectedOutcome === 'warn_passthrough' && logs <= 0) {
    return {
      ok: false,
      error: `expected an LTI log family_guard_mismatch for ${label}, got ${logs}`,
    };
  }
  if (expected.expectedOutcome === 'pass' && logs !== 0) {
    return {
      ok: false,
      error: `expected no family_guard_mismatch log for unguarded ${label}, got ${logs}`,
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------
// K1-LAUNCH L7: launch without context (AP-05-08..11; LA-ADR-05 D2).
// Contract facts: ResultRow is "one per learner per activity", `activity.resourceLinkId` is the
// placement id (`rl_...`, cogniate-app-api.md §5; cogniate-app-api-delta.md §6), not the launch
// `resource_link.id`; `stats.activities` counts the resource links of the publication (§5); the
// score goes to the launch line item: `services.assignmentAndGrades.lineItemId` of /api/idtoken
// (lti-service-api.md §3.1), path + `/scores` (AGS).
// ---------------------------------------------------------------------------------------------

export interface ContextlessResultRowLike {
  learner?: { sub?: string };
  activity?: { resourceLinkId?: string };
  scoreSyncs?: Array<{ status?: string }>;
}

export interface ContextlessScoreRecordLike {
  userId?: string;
  host?: string;
  path?: string;
  resource?: string;
}

export interface ContextlessPlacementObservation {
  rows: ContextlessResultRowLike[];
  learner1: string;
  learner2: string;
  placementCount: unknown;
  launchLineItems: { learner1: unknown; learner2: unknown };
  scoreRecords: ContextlessScoreRecordLike[];
  expectedResourceId: string;
}

// Maps the raw contract answers to the L7 observation: results rows, the publication DTO,
// the two /api/idtoken bodies and the simulator records since the case start.
export function collectContextlessPlacementObservation(raw: {
  rows: unknown;
  publication: unknown;
  idToken1: unknown;
  idToken2: unknown;
  simRecords: unknown;
  learner1: string;
  learner2: string;
  publicationId: string;
}): ContextlessPlacementObservation {
  const lineItemOf = (token: unknown) =>
    (token as { services?: { assignmentAndGrades?: { lineItemId?: unknown } } } | undefined)
      ?.services?.assignmentAndGrades?.lineItemId;
  const records = Array.isArray(raw.simRecords) ? (raw.simRecords as Array<Record<string, unknown>>) : [];
  return {
    rows: Array.isArray(raw.rows) ? (raw.rows as ContextlessResultRowLike[]) : [],
    learner1: raw.learner1,
    learner2: raw.learner2,
    placementCount: (raw.publication as { stats?: { activities?: unknown } } | undefined)?.stats
      ?.activities,
    launchLineItems: { learner1: lineItemOf(raw.idToken1), learner2: lineItemOf(raw.idToken2) },
    scoreRecords: records
      .filter((r) => r.kind === 'score')
      .map((r) => ({
        userId: String((r.body as Record<string, unknown> | undefined)?.userId ?? ''),
        host: String(r.host ?? ''),
        path: String(r.path ?? ''),
        resource: String(r.resource ?? ''),
      })),
    expectedResourceId: raw.publicationId,
  };
}

// The L7 verdict. It never compares the placement id with the launch resource link id.
// 1. Each learner has exactly one result row (one row per learner per activity).
// 2. Both rows name the same non-empty placement (`activity.resourceLinkId`).
// 3. The publication has exactly one placement (`stats.activities === 1`): one placement per
//    resource link id and deployment.
// 4. Each row has a sync with status `sent`.
// 5. Each learner has at least one simulator score call, and every score call of that learner goes
//    to `<launch line item path>/scores` on the line item host, for this publication.
export function verifyContextlessSharedPlacement(input: ContextlessPlacementObservation): {
  ok: boolean;
  placementId?: string;
  errors: string[];
} {
  const errors: string[] = [];
  const rows = Array.isArray(input.rows) ? input.rows : [];
  const learners = [
    ['learner1', input.learner1, input.launchLineItems?.learner1],
    ['learner2', input.learner2, input.launchLineItems?.learner2],
  ] as const;

  const placementIds = new Set<string>();
  for (const [label, sub] of learners) {
    const own = rows.filter((r) => r?.learner?.sub === sub);
    if (own.length === 0) {
      errors.push(`missing result row for ${label}="${sub}"`);
      continue;
    }
    if (own.length > 1) {
      errors.push(
        `duplicate result rows for ${label}="${sub}": ${own.length} rows (one row per learner per activity)`,
      );
    }
    for (const row of own) {
      const id = row?.activity?.resourceLinkId;
      if (typeof id === 'string' && id.trim()) {
        placementIds.add(id);
      } else {
        errors.push(`result row for ${label}="${sub}" has no activity.resourceLinkId`);
      }
      if (!(Array.isArray(row.scoreSyncs) && row.scoreSyncs.some((s) => s?.status === 'sent'))) {
        errors.push(`${label} ("${sub}") has no scoreSyncs entry with status="sent"`);
      }
    }
  }
  if (placementIds.size !== 1) {
    errors.push(
      `contextless one-placement invariant violated: the learners' rows name ${placementIds.size} placements (${[
        ...placementIds,
      ].join(', ')})`,
    );
  }
  if (input.placementCount !== 1) {
    errors.push(
      `contextless one-placement invariant violated: publication stats.activities is ${JSON.stringify(
        input.placementCount,
      )}, expected 1`,
    );
  }

  const records = Array.isArray(input.scoreRecords) ? input.scoreRecords : [];
  for (const [label, sub, lineItem] of learners) {
    let target: URL | undefined;
    try {
      target = new URL(String(lineItem ?? ''));
    } catch {
      errors.push(`${label} launch has no valid services.assignmentAndGrades.lineItemId (${String(lineItem)})`);
    }
    const calls = records.filter((r) => r?.userId === sub);
    if (calls.length === 0) {
      errors.push(`missing simulator score call for ${label} ("${sub}")`);
      continue;
    }
    if (!target) continue;
    const expectedPath = `${target.pathname.replace(/\/$/, '')}/scores`;
    for (const call of calls) {
      const host = String(call.host ?? '').replace(/:\d+$/, '');
      if (host !== target.hostname || call.path !== expectedPath) {
        errors.push(
          `${label} score call went to https://${call.host}${call.path}, expected the launch line item https://${target.hostname}${expectedPath}`,
        );
      }
      if (call.resource !== input.expectedResourceId) {
        errors.push(
          `${label} score call is for resource "${call.resource}", expected "${input.expectedResourceId}"`,
        );
      }
    }
  }

  return {
    ok: errors.length === 0,
    placementId: placementIds.size === 1 ? [...placementIds][0] : undefined,
    errors,
  };
}

// ---------------------------------------------------------------------------------------------
// K1-DL D3: picker selection (cogniate-app-api.md §6 `POST /tool/picker/{pickerId}` form
// `publicationId`; LA-ADR-05 D3b: the POST takes 1 to 20 publication ids, items keep the list order;
// cogniate-app-api-delta.md §0 rule 1: request fields are never renamed, so the field stays
// `publicationId`, repeated).
// ---------------------------------------------------------------------------------------------

export const PICKER_SELECTION_FIELD = 'publicationId';

export function buildPickerSelectionForm(publicationIds: string[]): Array<[string, string]> {
  return publicationIds.map((id) => [PICKER_SELECTION_FIELD, id]);
}

// Orders publication ids as the picker page lists them (first appearance in the page).
export function orderByPickerList(html: string, publicationIds: string[]): string[] {
  const positions = publicationIds.map((id) => {
    const at = String(html ?? '').indexOf(id);
    if (at < 0) {
      throw new Error(`publication "${id}" is not listed on the picker page`);
    }
    return { id, at };
  });
  return positions.sort((a, b) => a.at - b.at).map((p) => p.id);
}

// Reads the publication id of each Deep Linking content item from its launch URL
// (`…/lti/launch/cogniate?resource=<publicationId>`).
export function contentItemPublicationIds(items: unknown): string[] {
  if (!Array.isArray(items)) {
    throw new Error('content_items is not an array');
  }
  return items.map((item) => {
    const url = String((item as { url?: unknown } | undefined)?.url ?? '');
    try {
      return new URL(url).searchParams.get('resource') ?? '';
    } catch {
      return '';
    }
  });
}
