import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const KIT_ROOT = path.resolve(HERE, '..');
export const CHANNELS_DIR = path.join(KIT_ROOT, 'channels');
export const SUITES_DIR = path.join(KIT_ROOT, 'suites');

export const BASELINE_CHANNEL_IDS = ['moodle', 'canvas', 'blackboard'] as const;
export const ALL_KIT_CHANNEL_IDS = ['moodle', 'canvas', 'blackboard', 'lti-generic', 'brightspace'] as const;

export const CAPABILITY_VOCABULARY = [
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

export type CapabilityId = (typeof CAPABILITY_VOCABULARY)[number];

export interface LegacyFlags {
  dynamicRegistration: boolean;
  operatorApproval: boolean;
  webServices: boolean;
  courseShell: boolean;
  addDeployment: boolean;
  canvasConfiguration: boolean;
}

export interface ChannelCapabilities {
  'binding.authority': {
    manual?: 'self' | 'operatorGrant';
    dynamic?: 'self' | 'operatorGrant';
  };
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
  privacyFloor: 'allowlist' | 'none';
  supportsCustomClaims: boolean;
  supportsDynamicRegistrationOnSim: boolean;
  supportsStagedRegistrationOnSim: boolean;
}

export interface ChannelFixture {
  id: string;
  source: string;
  simProvider: string;
  simProfile: string | null;
  capabilities: ChannelCapabilities;
  coveredBy: Partial<Record<CapabilityId, string[]>>;
  notBuilt: Partial<Record<CapabilityId, string>>;
  expect: {
    legacyFlags: LegacyFlags;
    toolConfigurationKeys: string[];
  };
  sim: ChannelSimMetadata;
  sources: Record<string, string>;
}

export interface GuardedCapabilitySpec {
  capability: CapabilityId;
  legacyCapability: string;
  kind: 'deployments' | 'artifacts' | 'siteApi' | 'createCourse' | 'connectionCheck' | 'ungradedPlacement';
}

export const CONNECTION_GUARDED_CAPABILITIES: readonly GuardedCapabilitySpec[] = [
  { capability: 'deployments.multiple', legacyCapability: 'addDeployment', kind: 'deployments' },
  { capability: 'setup.artifacts', legacyCapability: 'canvasConfiguration', kind: 'artifacts' },
  { capability: 'siteApi.token', legacyCapability: 'webServices', kind: 'siteApi' },
  { capability: 'publish.createCourse', legacyCapability: 'courseShell', kind: 'createCourse' },
  { capability: 'setup.connectionCheck', legacyCapability: 'setup.connectionCheck', kind: 'connectionCheck' },
  { capability: 'content.ungraded', legacyCapability: 'content.ungraded', kind: 'ungradedPlacement' },
] as const;

export type KitSuiteId = 'K1-LAUNCH' | 'K1-DL' | 'K1-AGS' | 'K1-NRPS' | 'K1-REG' | 'K1-CAP' | 'K-HYG';

export interface ExpectedCaseSpec {
  id: string;
  suite: KitSuiteId;
  code: string;
  channelId: string;
  status: 'RUN' | 'NA';
  reason?: string;
  coversCapabilities: CapabilityId[];
  guardsCapability?: CapabilityId;
  expectedLegacyCapability?: string;
}

export interface ExecutedCaseRecord {
  id: string;
  suite: KitSuiteId;
  code: string;
  channelId: string;
  outcome: 'PASS' | 'FAIL' | 'NA';
  detail?: string;
}

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

export function isCapabilityPositive(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return false;
}

export function loadChannelFixture(channelId: string, dir = CHANNELS_DIR): ChannelFixture {
  const filePath = path.join(dir, `${channelId}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Channel fixture not found: ${filePath}`);
  }
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as ChannelFixture;
  if (raw.id !== channelId) {
    throw new Error(`Channel fixture id mismatch in ${filePath}: expected ${channelId}, got ${String(raw.id)}`);
  }
  return raw;
}

export function listChannelFixtureIds(dir = CHANNELS_DIR): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .sort();
}

export function resolveSelectedChannelIds(): string[] {
  const raw = process.env.QA_KIT_CHANNELS?.trim();
  if (!raw) return [...BASELINE_CHANNEL_IDS];
  if (raw.toLowerCase() === 'all') return [...ALL_KIT_CHANNEL_IDS];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function loadActiveChannelFixtures(dir = CHANNELS_DIR): ChannelFixture[] {
  return resolveSelectedChannelIds().map((id) => loadChannelFixture(id, dir));
}

export function loadAllChannelFixtures(dir = CHANNELS_DIR): ChannelFixture[] {
  return ALL_KIT_CHANNEL_IDS.map((id) => loadChannelFixture(id, dir));
}

export interface SourceAuditResult {
  ok: boolean;
  channelId: string;
  errors: string[];
}

const DESIGN_SOURCE_RE =
  /\b(LA-ADR-0[1-8]|ADR-0\d+|R2|LA-IC-\d+|cogniate-app-api|lti-service-api|TEST-STRATEGY\.md|LA-E\d+-\d+)\b/;
const FORBIDDEN_PRODUCT_PATH_RE = /\b(services\/|packages\/channels\/|packages\/channel-kernel\/|apps\/portal\/)/i;

export function auditFixtureSources(fixture: ChannelFixture): SourceAuditResult {
  const errors: string[] = [];
  if (typeof fixture.source !== 'string' || !DESIGN_SOURCE_RE.test(fixture.source)) {
    errors.push(`Top-level "source" must cite a design document (got: ${String(fixture.source)})`);
  }
  if (typeof fixture.source === 'string' && FORBIDDEN_PRODUCT_PATH_RE.test(fixture.source)) {
    errors.push(`Top-level "source" must not cite product code paths (${fixture.source})`);
  }
  const sources = fixture.sources ?? {};
  const requiredSourceKeys = [
    'id',
    'simProvider',
    'simProfile',
    'coveredBy',
    'notBuilt',
    'expect.legacyFlags',
    'expect.toolConfigurationKeys',
    'sim',
    ...CAPABILITY_VOCABULARY.map((cap) => `capabilities.${cap}`),
  ];
  for (const key of requiredSourceKeys) {
    const val = sources[key];
    if (typeof val !== 'string' || val.trim().length === 0) {
      errors.push(`Missing design source entry sources["${key}"]`);
      continue;
    }
    if (!DESIGN_SOURCE_RE.test(val)) {
      errors.push(`sources["${key}"] does not cite a design source (${val})`);
    }
    if (FORBIDDEN_PRODUCT_PATH_RE.test(val)) {
      errors.push(`sources["${key}"] cites a product source path (${val})`);
    }
  }
  for (const cap of Object.keys(fixture.capabilities)) {
    if (!CAPABILITY_VOCABULARY.includes(cap as CapabilityId)) {
      errors.push(`Unknown capability key in fixture.capabilities: ${cap}`);
    }
  }
  for (const cap of CAPABILITY_VOCABULARY) {
    if (!(cap in fixture.capabilities)) {
      errors.push(`Missing capability key in fixture.capabilities: ${cap}`);
    }
  }
  return {
    ok: errors.length === 0,
    channelId: fixture.id,
    errors,
  };
}

export function computeExpectedCaseList(fixture: ChannelFixture): ExpectedCaseSpec[] {
  const cid = fixture.id;
  const caps = fixture.capabilities;
  const cases: ExpectedCaseSpec[] = [];

  const add = (
    suite: KitSuiteId,
    code: string,
    status: 'RUN' | 'NA',
    options: {
      reason?: string;
      coversCapabilities?: CapabilityId[];
      guardsCapability?: CapabilityId;
      expectedLegacyCapability?: string;
    } = {},
  ) => {
    cases.push({
      id: `${cid}:${suite}:${code}`,
      suite,
      code,
      channelId: cid,
      status,
      reason: options.reason,
      coversCapabilities: options.coversCapabilities ?? [],
      guardsCapability: options.guardsCapability,
      expectedLegacyCapability: options.expectedLegacyCapability,
    });
  };

  // 1. K1-LAUNCH (L1-L10 + L-FAULTS)
  const l1Covers: CapabilityId[] = ['platform.sharing'];
  if (caps['site.serviceOrigin']) l1Covers.push('site.serviceOrigin');
  if (caps['launch.topLevelContinue']) l1Covers.push('launch.topLevelContinue');
  add('K1-LAUNCH', 'L1', 'RUN', { coversCapabilities: l1Covers });
  add('K1-LAUNCH', 'L2', 'RUN');
  add('K1-LAUNCH', 'L3', 'RUN');
  add('K1-LAUNCH', 'L4', 'RUN');
  add('K1-LAUNCH', 'L5', 'RUN');
  add('K1-LAUNCH', 'L6', 'RUN');
  add('K1-LAUNCH', 'L7', 'RUN');
  add('K1-LAUNCH', 'L8', 'RUN');
  add('K1-LAUNCH', 'L9', fixture.sim.supportsCustomClaims ? 'RUN' : 'NA', {
    reason: fixture.sim.supportsCustomClaims ? undefined : 'simulator custom claim substitution off',
  });
  add('K1-LAUNCH', 'L10', 'RUN');
  add('K1-LAUNCH', 'L-FAULTS', 'RUN');

  // 2. K1-DL (D1-D8)
  add('K1-DL', 'D1', 'RUN');
  add('K1-DL', 'D2', 'RUN');
  add('K1-DL', 'D3', 'RUN', {
    coversCapabilities: caps['launch.windowHint'] ? ['launch.windowHint'] : [],
  });
  add('K1-DL', 'D4', 'RUN');
  if (caps['content.multiple']) {
    add('K1-DL', 'D5', 'RUN', { coversCapabilities: ['content.multiple'] });
  } else {
    add('K1-DL', 'D5', 'NA', { reason: 'content.multiple is false' });
  }
  add('K1-DL', 'D5-GUARD', 'RUN');
  add('K1-DL', 'D6', 'RUN');
  if (caps['content.ungraded'] && !fixture.notBuilt['content.ungraded']) {
    add('K1-DL', 'D7', 'RUN', { coversCapabilities: ['content.ungraded'] });
  } else {
    add('K1-DL', 'D7', 'NA', {
      reason: fixture.notBuilt['content.ungraded'] ?? 'content.ungraded is false',
    });
  }
  add('K1-DL', 'D8', 'RUN');

  // 3. K1-AGS (A1-A6)
  add('K1-AGS', 'A1', 'RUN', {
    coversCapabilities: ['records.reporters', 'records.readBack', 'registration.scopes'],
  });
  add('K1-AGS', 'A2', 'RUN');
  add('K1-AGS', 'A3', 'RUN');
  add('K1-AGS', 'A4', 'RUN');
  add('K1-AGS', 'A5', 'RUN');
  add('K1-AGS', 'A6', 'RUN');

  // 4. K1-NRPS (N1 per channel)
  add('K1-NRPS', 'N1', 'RUN', { coversCapabilities: ['registration.scopes'] });

  // 5. K1-REG (R1-R6)
  const authorities = Object.values(caps['binding.authority']);
  if (authorities.includes('self')) {
    add('K1-REG', 'R1', 'RUN', { coversCapabilities: ['binding.authority'] });
  } else {
    add('K1-REG', 'R1', 'NA', { reason: 'binding.authority has no self method' });
  }
  if (authorities.includes('operatorGrant')) {
    add('K1-REG', 'R2', 'RUN', { coversCapabilities: ['binding.authority'] });
  } else {
    add('K1-REG', 'R2', 'NA', { reason: 'binding.authority has no operatorGrant method' });
  }
  if (caps['registration.dynamic'] && fixture.sim.supportsStagedRegistrationOnSim) {
    add('K1-REG', 'R3', 'RUN', { coversCapabilities: ['registration.dynamic', 'binding.authority'] });
  } else {
    add('K1-REG', 'R3', 'NA', {
      reason: !caps['registration.dynamic']
        ? 'registration.dynamic is false'
        : 'channel does not stage Dynamic Registration on simulator',
    });
  }
  if (caps['registration.dynamic']) {
    if (fixture.coveredBy['registration.dynamic'] && !fixture.sim.supportsDynamicRegistrationOnSim) {
      add('K1-REG', 'R4', 'NA', {
        reason: `coveredBy ${fixture.coveredBy['registration.dynamic'].join(', ')}`,
      });
    } else {
      add('K1-REG', 'R4', 'RUN', { coversCapabilities: ['registration.dynamic'] });
    }
  } else {
    add('K1-REG', 'R4', 'NA', { reason: 'registration.dynamic is false' });
    add('K1-REG', 'R4-GUARD', 'RUN');
  }
  if (caps['deployments.multiple']) {
    add('K1-REG', 'R5', 'RUN', { coversCapabilities: ['deployments.multiple'] });
  } else {
    add('K1-REG', 'R5', 'NA', { reason: 'deployments.multiple is false' });
  }
  if (caps['setup.connectionCheck']) {
    add('K1-REG', 'R6', 'RUN', { coversCapabilities: ['setup.connectionCheck'] });
  } else {
    add('K1-REG', 'R6', 'NA', { reason: 'setup.connectionCheck is false' });
  }

  // 6. K1-CAP (C1, C2 per off guarded capability excluding notBuilt, C3)
  const c1Covers: CapabilityId[] = [];
  if (isCapabilityPositive(caps['setup.artifacts'])) {
    c1Covers.push('setup.artifacts');
  }
  add('K1-CAP', 'C1', 'RUN', { coversCapabilities: c1Covers });

  for (const spec of CONNECTION_GUARDED_CAPABILITIES) {
    const capVal = caps[spec.capability];
    const isOff = !isCapabilityPositive(capVal);
    if (!isOff) continue;
    if (fixture.notBuilt[spec.capability]) {
      // Excluded from C2 by the notBuilt rule (AC-LA-E7-06-03, TEST-STRATEGY.md §2.6 rule 2 & §9.2 item 11)
      continue;
    }
    if (fixture.coveredBy[spec.capability]) {
      continue;
    }
    add('K1-CAP', `C2:${spec.capability}`, 'RUN', {
      guardsCapability: spec.capability,
      expectedLegacyCapability: spec.legacyCapability,
    });
  }

  add('K1-CAP', 'C3', 'RUN');

  return cases;
}

export function computeExpectedRunCaseIds(fixture: ChannelFixture): string[] {
  return computeExpectedCaseList(fixture)
    .filter((c) => c.status === 'RUN')
    .map((c) => c.id);
}

export interface CaseComparisonResult {
  ok: boolean;
  missingCases: string[];
  extraCases: string[];
  errors: string[];
}

export function verifyExecutedCases(
  expectedRunIds: readonly string[],
  executedRunIds: readonly string[],
): CaseComparisonResult {
  const expectedSet = new Set(expectedRunIds);
  const executedSet = new Set(executedRunIds);
  const missingCases = expectedRunIds.filter((id) => !executedSet.has(id));
  const extraCases = executedRunIds.filter((id) => !expectedSet.has(id));
  const errors: string[] = [];
  for (const m of missingCases) {
    errors.push(`missing case: ${m}`);
  }
  for (const e of extraCases) {
    errors.push(`extra case: ${e}`);
  }
  return {
    ok: errors.length === 0,
    missingCases,
    extraCases,
    errors,
  };
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableJson(v)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJson(obj[k])}`).join(',')}}`;
}

function diffCapabilityMaps(
  leftLabel: string,
  left: Record<string, unknown>,
  rightLabel: string,
  right: Record<string, unknown>,
): string[] {
  const errors: string[] = [];
  const leftKeys = new Set(Object.keys(left));
  const rightKeys = new Set(Object.keys(right));
  for (const k of leftKeys) {
    if (!rightKeys.has(k)) {
      errors.push(`Capability key "${k}" present in ${leftLabel} but missing in ${rightLabel}`);
    }
  }
  for (const k of rightKeys) {
    if (!leftKeys.has(k)) {
      errors.push(`Capability key "${k}" present in ${rightLabel} but missing in ${leftLabel}`);
    }
  }
  for (const k of [...leftKeys].filter((key) => rightKeys.has(key)).sort()) {
    const lv = stableJson(left[k]);
    const rv = stableJson(right[k]);
    if (lv !== rv) {
      errors.push(`Capability "${k}" differs between ${leftLabel} (${lv}) and ${rightLabel} (${rv})`);
    }
  }
  return errors;
}

export interface BilateralEqualityInput {
  fixture: ChannelFixture;
  manifestCapabilities: Record<string, unknown>;
  providerChannelCapabilities?: Record<string, unknown>;
  providerLegacyFlags?: Record<string, unknown>;
  connectionChannelCapabilities?: Record<string, unknown>;
  connectionLegacyFlags?: Record<string, unknown>;
  toolConfigurationKeys?: readonly string[];
}

export interface BilateralEqualityResult {
  ok: boolean;
  errors: string[];
}

export function verifyBilateralCapabilities(input: BilateralEqualityInput): BilateralEqualityResult {
  const errors: string[] = [];
  const fixtureCaps = input.fixture.capabilities as unknown as Record<string, unknown>;
  const fixtureLegacy = input.fixture.expect.legacyFlags as unknown as Record<string, unknown>;

  errors.push(
    ...diffCapabilityMaps(
      `fixture(${input.fixture.id}).capabilities`,
      fixtureCaps,
      `manifest(${input.fixture.id}).capabilities`,
      input.manifestCapabilities,
    ),
  );

  if (input.providerChannelCapabilities) {
    errors.push(
      ...diffCapabilityMaps(
        `fixture(${input.fixture.id}).capabilities`,
        fixtureCaps,
        `GET /app-api/lms-providers(${input.fixture.id}).channelCapabilities`,
        input.providerChannelCapabilities,
      ),
    );
  }

  if (input.connectionChannelCapabilities) {
    errors.push(
      ...diffCapabilityMaps(
        `fixture(${input.fixture.id}).capabilities`,
        fixtureCaps,
        `GET /app-api/connections/:id(${input.fixture.id}).channelCapabilities`,
        input.connectionChannelCapabilities,
      ),
    );
  }

  if (input.providerLegacyFlags) {
    errors.push(
      ...diffCapabilityMaps(
        `fixture(${input.fixture.id}).expect.legacyFlags`,
        fixtureLegacy,
        `GET /app-api/lms-providers(${input.fixture.id}).capabilities`,
        input.providerLegacyFlags,
      ),
    );
  }

  if (input.connectionLegacyFlags) {
    errors.push(
      ...diffCapabilityMaps(
        `fixture(${input.fixture.id}).expect.legacyFlags`,
        fixtureLegacy,
        `GET /app-api/connections/:id(${input.fixture.id}).capabilities`,
        input.connectionLegacyFlags,
      ),
    );
  }

  if (input.toolConfigurationKeys) {
    const expectedKeys = input.fixture.expect.toolConfigurationKeys;
    const actualKeys = [...input.toolConfigurationKeys];
    if (stableJson(expectedKeys) !== stableJson(actualKeys)) {
      errors.push(
        `toolConfigurationKeys mismatch for ${input.fixture.id}: expected ${JSON.stringify(expectedKeys)}, got ${JSON.stringify(actualKeys)}`,
      );
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export interface PassRuleInput {
  fixture: ChannelFixture;
  executedCases: readonly ExecutedCaseRecord[];
  skippedCount?: number;
  leakedSecretCount?: number;
  wavePassResults?: Record<string, 'PASS' | 'FAIL' | 'PENDING'>;
}

export interface PassRuleResult {
  ok: boolean;
  channelId: string;
  expectedRunCount: number;
  executedPassCount: number;
  naCount: number;
  errors: string[];
}

export const DEFAULT_WAVE_PASS_RESULTS: Readonly<Record<string, 'PASS' | 'FAIL' | 'PENDING'>> = {
  T3b: 'PASS',
  T7: 'PASS',
  T8: 'PASS',
};

export function evaluateChannelPassRule(input: PassRuleInput): PassRuleResult {
  const { fixture, executedCases } = input;
  const skippedCount = input.skippedCount ?? 0;
  const leakedSecretCount = input.leakedSecretCount ?? 0;
  const wavePass = input.wavePassResults ?? DEFAULT_WAVE_PASS_RESULTS;
  const errors: string[] = [];

  const expectedSpecs = computeExpectedCaseList(fixture);
  const expectedRunSpecs = expectedSpecs.filter((s) => s.status === 'RUN');
  const expectedNaSpecs = expectedSpecs.filter((s) => s.status === 'NA');

  const executedRunRecords = executedCases.filter((c) => c.outcome !== 'NA');
  const executedPassIds = new Set(
    executedCases.filter((c) => c.outcome === 'PASS').map((c) => c.id),
  );
  const failedRecords = executedCases.filter((c) => c.outcome === 'FAIL');
  for (const failed of failedRecords) {
    errors.push(`failed case: ${failed.id}${failed.detail ? ` (${failed.detail})` : ''}`);
  }

  // Rule 5: compare executed RUN case list against expected RUN case list
  const comparison = verifyExecutedCases(
    expectedRunSpecs.map((s) => s.id),
    executedRunRecords.map((r) => r.id),
  );
  errors.push(...comparison.errors);

  // Rule 1: every positive capability has >=1 passing case or a coveredBy wave-pass entry
  for (const capId of CAPABILITY_VOCABULARY) {
    const val = fixture.capabilities[capId];
    if (!isCapabilityPositive(val)) continue;

    const coveringPassed = expectedRunSpecs.some(
      (spec) => spec.coversCapabilities.includes(capId) && executedPassIds.has(spec.id),
    );
    const coveredBySuites = fixture.coveredBy[capId];
    const coveredByGreen =
      Array.isArray(coveredBySuites) &&
      coveredBySuites.length > 0 &&
      coveredBySuites.every((suiteName) => wavePass[suiteName] === 'PASS');

    if (!coveringPassed && !coveredByGreen) {
      if (Array.isArray(coveredBySuites) && coveredBySuites.length > 0) {
        errors.push(
          `positive capability "${capId}" on ${fixture.id} requires wave-pass suites ${JSON.stringify(coveredBySuites)} to be PASS`,
        );
      } else {
        errors.push(
          `positive capability "${capId}" on ${fixture.id} has no passing functional case and no coveredBy entry`,
        );
      }
    }
  }

  // Rule 2: every off guarded capability (not in notBuilt or coveredBy) has a passing C2 guard test,
  // and off capabilities mark their gated functional cases NA (never RUN)
  for (const spec of CONNECTION_GUARDED_CAPABILITIES) {
    const val = fixture.capabilities[spec.capability];
    if (isCapabilityPositive(val)) continue;
    if (fixture.notBuilt[spec.capability] || fixture.coveredBy[spec.capability]) continue;
    const guardCaseId = `${fixture.id}:K1-CAP:C2:${spec.capability}`;
    if (!executedPassIds.has(guardCaseId)) {
      errors.push(`off capability "${spec.capability}" on ${fixture.id} is missing passing C2 guard case ${guardCaseId}`);
    }
  }

  // Rule 3: zero skipped tests
  if (skippedCount > 0) {
    errors.push(`skipped tests not allowed: ${skippedCount} skipped`);
  }

  // Rule 4: zero leaked secrets
  if (leakedSecretCount > 0) {
    errors.push(`leaked secrets detected: ${leakedSecretCount}`);
  }

  return {
    ok: errors.length === 0,
    channelId: fixture.id,
    expectedRunCount: expectedRunSpecs.length,
    executedPassCount: executedPassIds.size,
    naCount: expectedNaSpecs.length,
    errors,
  };
}

export function formatKitSummaryMarkdown(
  fixtures: readonly ChannelFixture[],
  recordsByChannel: ReadonlyMap<string, readonly ExecutedCaseRecord[]>,
  passResults: ReadonlyMap<string, PassRuleResult>,
): string {
  const suites: KitSuiteId[] = ['K1-LAUNCH', 'K1-DL', 'K1-AGS', 'K1-NRPS', 'K1-REG', 'K1-CAP'];
  const lines: string[] = [
    '# LTI 1.3 Channel Certification Kit (`K1`) Summary',
    '',
    '| Channel | Simulator Provider | `K1-LAUNCH` | `K1-DL` | `K1-AGS` | `K1-NRPS` | `K1-REG` | `K1-CAP` | Expected `RUN` | `PASS` | `N/A` | Verdict |',
    '| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |',
  ];

  for (const fixture of fixtures) {
    const recs = recordsByChannel.get(fixture.id) ?? [];
    const expected = computeExpectedCaseList(fixture);
    const pr = passResults.get(fixture.id);
    const cellFor = (suite: KitSuiteId) => {
      const suiteExpected = expected.filter((e) => e.suite === suite);
      const runSpecs = suiteExpected.filter((e) => e.status === 'RUN');
      const naSpecs = suiteExpected.filter((e) => e.status === 'NA');
      const passed = recs.filter((r) => r.suite === suite && r.outcome === 'PASS').length;
      return `${passed}/${runSpecs.length} (${naSpecs.length} N/A)`;
    };
    lines.push(
      `| \`${fixture.id}\` | \`${fixture.simProvider}\` | ${cellFor('K1-LAUNCH')} | ${cellFor('K1-DL')} | ${cellFor('K1-AGS')} | ${cellFor('K1-NRPS')} | ${cellFor('K1-REG')} | ${cellFor('K1-CAP')} | ${pr?.expectedRunCount ?? 0} | ${pr?.executedPassCount ?? 0} | ${pr?.naCount ?? 0} | **${pr?.ok ? 'PASS' : 'FAIL'}** |`,
    );
  }
  lines.push('');
  return lines.join('\n');
}
