import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CHANNELS_DIR = path.resolve(__dirname, '../channels');

export const BASELINE_CHANNEL_IDS = [
  'moodle',
  'canvas',
  'blackboard',
  'lti-generic',
  'brightspace',
] as const;

export type BaselineChannelId = (typeof BASELINE_CHANNEL_IDS)[number];

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

export interface ChannelExpectations {
  legacyFlags: LegacyFlags;
  toolConfigurationKeys: string[];
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

export interface BilateralEqualityInput {
  fixture: ChannelFixture;
  manifestCapabilities: Record<string, unknown>;
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
}

export const PROTOCOL_SECURITY_FAULTS = [
  'wrong-issuer',
  'wrong-audience',
  'multi-aud-no-azp',
  'multi-aud-wrong-azp',
  'expired',
  'future-iat',
  'wrong-nonce',
  'unknown-key',
  'tampered',
  'alg-none',
  'state-mismatch',
  'replay-state',
] as const;

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function listChannelFixtureIds(dir: string = CHANNELS_DIR): string[] {
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

export function loadChannelFixture(channelId: string, dir: string = CHANNELS_DIR): ChannelFixture {
  const filePath = path.join(dir, `${channelId}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Channel fixture file not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw) as ChannelFixture;
  return parsed;
}

export function loadAllChannelFixtures(dir: string = CHANNELS_DIR): ChannelFixture[] {
  return listChannelFixtureIds(dir).map((id) => loadChannelFixture(id, dir));
}

export function resolveSelectedChannelIds(
  raw: string | undefined = process.env.QA_KIT_CHANNELS,
  dir: string = CHANNELS_DIR,
): string[] {
  const allAvailable = listChannelFixtureIds(dir);
  if (!raw || raw.trim() === '') {
    return BASELINE_CHANNEL_IDS.filter((id) => allAvailable.includes(id));
  }
  if (raw.trim() === 'all') {
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
  dir: string = CHANNELS_DIR,
): ChannelFixture[] {
  return resolveSelectedChannelIds(raw, dir).map((id) => loadChannelFixture(id, dir));
}

export function buildOperatorGrantCliArgs(
  libraryId: string,
  fixture: ChannelFixture,
  connectionId: string,
  clientId: string,
  deploymentId: string,
  options: OperatorGrantCliOptions = {},
): string[] {
  const args: string[] = [
    'run',
    '-w',
    '@cogniate/app',
    'app:grant',
    '--',
    'issue',
    '--library',
    libraryId,
    '--lms',
    fixture.id,
    '--connection',
    connectionId,
    '--site',
    fixture.sim.siteUrl,
    '--client-id',
    clientId,
    '--deployment-id',
    deploymentId,
  ];
  if (fixture.capabilities['site.serviceOrigin']) {
    args.push('--service-url', fixture.sim.serviceUrl);
  }
  if (options.purpose === 'add_deployment') {
    args.push('--purpose', 'add_deployment');
  }
  if (options.acceptStaged) {
    args.push('--accept-staged', '--confirm-foreign-hosts');
  } else if (
    options.purpose !== 'add_deployment' &&
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
  return args;
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
  const coveredBy = fixture.coveredBy ?? {};

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
    'No token request asks for NRPS scope; Canvas JSON scopes and DR request scopes have the 4 AGS scopes only',
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
      'Dynamic Registration: path-prefix issuer, opaque-bearer or moodle-scope-jwt token, authorization_server stored as token audience, refusal on missing DL or scope, family guard at both levels, granted scopes stored',
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
    'Bilateral capability equality across manifest, fixture, GET /app-api/lms-providers, GET /app-api/connections/:id, legacyFlags, and toolConfigurationKeys',
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

export function evaluateChannelPassRule(input: {
  fixture: ChannelFixture;
  expectedCases?: ExpectedCase[];
  executedRecords: ExecutedCaseRecord[];
  waveEvidence?: WaveEvidenceManifest | null;
  currentWaveId?: string | null;
  expectedRunId?: string | null;
}): PassRuleEvaluation {
  const { fixture } = input;
  const expectedCases = input.expectedCases ?? computeExpectedCaseList(fixture);
  const channelRecords = input.executedRecords.filter((r) => r.channelId === fixture.id);
  const currentWaveId =
    input.currentWaveId !== undefined
      ? input.currentWaveId
      : (input.waveEvidence?.waveId ?? process.env.LA_WAVE_ID ?? null);
  const waveEvidence = input.waveEvidence ?? null;
  const expectedRunId = input.expectedRunId ?? null;

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

  if (!isPlainObject(input.manifestCapabilities)) {
    errors.push('missing or invalid manifestCapabilities object');
  }
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

  for (const key of CAPABILITY_KEYS) {
    const expectedVal = fixture.capabilities[key];
    const manifestVal = input.manifestCapabilities[key];
    if (JSON.stringify(manifestVal) !== JSON.stringify(expectedVal)) {
      errors.push(
        `manifest capability "${key}" mismatch on "${fixture.id}": expected ${JSON.stringify(
          expectedVal,
        )}, got ${JSON.stringify(manifestVal)}`,
      );
    }
    const provVal = input.providerChannelCapabilities[key];
    if (JSON.stringify(provVal) !== JSON.stringify(expectedVal)) {
      errors.push(
        `GET /app-api/lms-providers channelCapabilities["${key}"] mismatch on "${
          fixture.id
        }": expected ${JSON.stringify(expectedVal)}, got ${JSON.stringify(provVal)}`,
      );
    }
    const connVal = input.connectionChannelCapabilities[key];
    if (JSON.stringify(connVal) !== JSON.stringify(expectedVal)) {
      errors.push(
        `GET /app-api/connections/:id channelCapabilities["${key}"] mismatch on "${
          fixture.id
        }": expected ${JSON.stringify(expectedVal)}, got ${JSON.stringify(connVal)}`,
      );
    }
  }

  for (const k of Object.keys(input.manifestCapabilities)) {
    if (!(CAPABILITY_KEYS as readonly string[]).includes(k)) {
      errors.push(`manifest has unknown capability key "${k}" on "${fixture.id}"`);
    }
  }
  for (const k of Object.keys(input.providerChannelCapabilities)) {
    if (!(CAPABILITY_KEYS as readonly string[]).includes(k)) {
      errors.push(
        `GET /app-api/lms-providers has unknown capability key "${k}" on "${fixture.id}"`,
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
