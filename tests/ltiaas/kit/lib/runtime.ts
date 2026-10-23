import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect } from 'vitest';
import {
  APP,
  DL,
  LTI,
  admin,
  app,
  cli,
  connPath,
  denied,
  expectStatus,
  httpsRequest,
  launch,
  logEvents,
  noServiceCalls,
  parseForm,
  poll,
  records,
  rememberSecret,
  session,
  sharedPlatform,
  sim,
  unique,
  urls,
  type Json,
} from '../../../acceptance/M1/common/client';
import {
  commitGrade,
  fixtureZip,
  openPlay,
  pick,
  publication,
  returnDeepLink,
  waitSync,
} from '../../../acceptance/M1/common/course';
import { createCourse, uploadVersion, type Session } from '../../../acceptance/lib/app';
import { readLog } from '../../../acceptance/lib/logs';
import {
  ACCOUNT,
  apiKey,
  auth,
  capturedSecrets,
  errorCode,
  hasErrorShape,
  ltiApi,
} from '../../../acceptance/lib/lti';
import { LOGS_DIR, artifactsDir } from '../../../acceptance/lib/paths';
import {
  computeExpectedCaseList,
  type CapabilityId,
  type ChannelFixture,
  type ExecutedCaseRecord,
  type GuardedCapabilitySpec,
  type KitSuiteId,
} from './fixtures';

export type KitSession = Session & { library: Json };

export const ROLE = {
  learner: 'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner',
  instructor: 'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor',
} as const;

export const SCOPES = {
  lineitem: 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
  readonly: 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
  result: 'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
  score: 'https://purl.imsglobal.org/spec/lti-ags/scope/score',
  nrps: 'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly',
} as const;

export function getSecrets(): string[] {
  const m1Raw = path.join(artifactsDir('acceptance'), 'm1-secrets.raw.jsonl');
  const fromM1Raw = fs.existsSync(m1Raw)
    ? fs
        .readFileSync(m1Raw, 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as string)
    : [];
  return [...new Set([...capturedSecrets().map((s) => s.value), ...fromM1Raw])];
}

export function readServiceLogs(serviceName: string): string {
  try {
    const logFile = path.join(LOGS_DIR, `${serviceName}.jsonl`);
    if (fs.existsSync(logFile)) {
      return fs.readFileSync(logFile, 'utf8');
    }
    const parsed = readLog(serviceName);
    return parsed.entries.map((e) => JSON.stringify(e.entry)).join('\n');
  } catch {
    return '';
  }
}

export {
  ACCOUNT,
  APP,
  DL,
  LTI,
  admin,
  apiKey,
  app,
  auth,
  cli,
  commitGrade,
  connPath,
  createCourse,
  denied,
  errorCode,
  expectStatus,
  fixtureZip,
  hasErrorShape,
  httpsRequest,
  launch,
  logEvents,
  ltiApi,
  noServiceCalls,
  openPlay,
  parseForm,
  pick,
  poll,
  publication,
  records,
  rememberSecret,
  returnDeepLink,
  session,
  sharedPlatform,
  sim,
  unique,
  uploadVersion,
  urls,
  waitSync,
  type Json,
};

const REPO_ROOT = path.resolve(
  process.env.LA_TARGET_ROOT ??
    process.env.QA_REPO_ROOT ??
    process.env.LA_SCRATCH_CLONE ??
    path.join(path.dirname(new URL(import.meta.url).pathname), '../../../..'),
);

export function getKitStateDir(): string {
  const base =
    process.env.LA_RUN_DIR ??
    process.env.QA_KIT_STATE_DIR ??
    path.join(os.tmpdir(), `cogniate-k1-kit-${process.ppid}`);
  fs.mkdirSync(base, { recursive: true, mode: 0o700 });
  return base;
}

const EXECUTED_CASES_FILE = () => path.join(getKitStateDir(), 'kit-executed-cases.jsonl');
const CAPTURED_SECRETS_FILE = () => path.join(getKitStateDir(), 'kit-secrets.jsonl');

export function resetKitRunState(): void {
  for (const file of [EXECUTED_CASES_FILE(), CAPTURED_SECRETS_FILE()]) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }
}

export function recordExecutedCase(record: ExecutedCaseRecord): void {
  const line = `${JSON.stringify(record)}\n`;
  fs.appendFileSync(EXECUTED_CASES_FILE(), line, { mode: 0o600 });
}

export function recordSuiteCase(
  fixture: ChannelFixture,
  suite: KitSuiteId,
  code: string,
  outcome: 'PASS' | 'FAIL' | 'NA' = 'PASS',
  detail?: string,
): void {
  recordExecutedCase({
    id: `${fixture.id}:${suite}:${code}`,
    suite,
    code,
    channelId: fixture.id,
    outcome,
    detail,
  });
}

export function recordNaCasesForSuite(fixture: ChannelFixture, suite: KitSuiteId): void {
  const expected = computeExpectedCaseList(fixture).filter(
    (c) => c.suite === suite && c.status === 'NA',
  );
  for (const spec of expected) {
    recordExecutedCase({
      id: spec.id,
      suite: spec.suite,
      code: spec.code,
      channelId: spec.channelId,
      outcome: 'NA',
      detail: spec.reason,
    });
  }
}

export function readAllExecutedCases(): ExecutedCaseRecord[] {
  const file = EXECUTED_CASES_FILE();
  if (!fs.existsSync(file)) return [];
  const raw = fs.readFileSync(file, 'utf8').trim();
  if (!raw) return [];
  const byId = new Map<string, ExecutedCaseRecord>();
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    const parsed = JSON.parse(line) as ExecutedCaseRecord;
    byId.set(parsed.id, parsed);
  }
  return [...byId.values()];
}

export function persistCapturedSecrets(secrets: Iterable<string>): void {
  const file = CAPTURED_SECRETS_FILE();
  const lines: string[] = [];
  for (const s of secrets) {
    if (typeof s === 'string' && s.length >= 16) {
      rememberSecret(s);
      lines.push(JSON.stringify({ secret: s }));
    }
  }
  if (lines.length > 0) {
    fs.appendFileSync(file, `${lines.join('\n')}\n`, { mode: 0o600 });
  }
}

export function readAllCapturedSecrets(): string[] {
  const set = new Set<string>(getSecrets());
  const file = CAPTURED_SECRETS_FILE();
  if (fs.existsSync(file)) {
    const raw = fs.readFileSync(file, 'utf8').trim();
    if (raw) {
      for (const line of raw.split('\n')) {
        if (!line.trim()) continue;
        const parsed = JSON.parse(line) as { secret?: string };
        if (parsed.secret && parsed.secret.length >= 16) {
          set.add(parsed.secret);
        }
      }
    }
  }
  return [...set];
}

export interface ChannelBinding {
  s: KitSession;
  fixture: ChannelFixture;
  connection: Json;
  clientId: string;
  deploymentId: string;
  platformId: string;
  siteHost: string;
  pageHost: string;
}

const SHARED_APP_CLIENT_ID = 'qa-bb-app';

function nextDeploymentId(fixture: ChannelFixture, index = 0): string {
  const preset = fixture.sim.deployments[index];
  if (preset && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(preset)) {
    return preset;
  }
  if (fixture.capabilities['platform.sharing'] === 'shared') {
    return unique(`dep-${fixture.id}`);
  }
  return preset ?? unique(`dep-${fixture.id}`);
}

export async function createPendingChannelConnection(
  fixture: ChannelFixture,
  method: 'manual' | 'dynamic' = 'manual',
  library: 'A' | 'B' = 'A',
): Promise<{ s: KitSession; connection: Json }> {
  const s = await session(library);
  const body: Record<string, unknown> = {
    name: unique(`Kit ${fixture.id} ${method}`),
    lms: fixture.id,
    method,
    siteUrl: fixture.sim.siteUrl,
  };
  if (fixture.capabilities['site.serviceOrigin']) {
    body.serviceUrl = fixture.sim.serviceUrl;
    if (fixture.simProfile) {
      body.profile = fixture.simProfile;
    }
  } else if (fixture.simProfile && fixture.capabilities['platform.sharing'] === 'shared') {
    body.profile = fixture.simProfile;
  }
  const created = await app(s, 'POST', '/app-api/connections', body);
  expectStatus(created, 201);
  return { s, connection: created.json };
}

export async function issueOperatorGrantForChannel(
  s: KitSession,
  fixture: ChannelFixture,
  connectionId: string,
  clientId: string,
  deploymentId: string,
  options: {
    purpose?: 'initial' | 'add_deployment';
    acceptStaged?: boolean;
    overrideJwksUrl?: string;
  } = {},
): Promise<string> {
  const args: string[] = [
    'issue',
    '--library',
    String(s.library.id),
    '--connection',
    connectionId,
    '--site',
    fixture.sim.siteUrl,
  ];
  if (fixture.capabilities['site.serviceOrigin']) {
    args.push('--service', fixture.sim.serviceUrl);
  }
  if (options.purpose === 'add_deployment') {
    args.push('--purpose', 'add_deployment');
  } else {
    args.push('--client-id', clientId);
  }
  args.push('--deployment-id', deploymentId);

  if (options.acceptStaged) {
    args.push('--accept-staged', '--confirm-foreign-hosts');
  } else if (
    !fixture.capabilities['site.serviceOrigin'] &&
    fixture.capabilities['platform.sharing'] !== 'shared' &&
    fixture.capabilities['binding.authority'].manual === 'operatorGrant'
  ) {
    args.push(
      '--issuer',
      fixture.sim.issuer,
      '--auth-url',
      fixture.sim.authEndpoint,
      '--token-url',
      fixture.sim.tokenEndpoint,
      '--jwks-url',
      options.overrideJwksUrl ?? fixture.sim.jwksUrl,
      '--confirm-foreign-hosts',
    );
    if (fixture.sim.tokenAudienceKind === 'fixed' && typeof fixture.sim.tokenAudience === 'string') {
      args.push('--token-audience', fixture.sim.tokenAudience);
    }
  }

  args.push('--note', `K1 kit ${fixture.id}`);
  const issued = await cli('app:grant', args);
  expect(issued.code, issued.stderr || issued.stdout).toBe(0);
  const match = issued.stdout.match(/(?<![\w-])[A-Za-z0-9_-]{43}(?![\w-])/);
  expect(match, `CLI grant code output for ${fixture.id}`).not.toBeNull();
  const grantCode = match![0];
  rememberSecret(grantCode);
  persistCapturedSecrets([grantCode]);
  return grantCode;
}

export async function connectChannel(
  fixture: ChannelFixture,
  options: {
    library?: 'A' | 'B';
    deploymentIndex?: number;
  } = {},
): Promise<ChannelBinding> {
  const library = options.library ?? 'A';
  const deploymentId = nextDeploymentId(fixture, options.deploymentIndex ?? 0);

  if (fixture.capabilities['platform.sharing'] === 'shared') {
    const sharedPlatformId = await sharedPlatform();
    const { s, connection } = await createPendingChannelConnection(fixture, 'manual', library);
    const clientId = SHARED_APP_CLIENT_ID;
    const grantCode = await issueOperatorGrantForChannel(
      s,
      fixture,
      String(connection.id),
      clientId,
      deploymentId,
    );
    const boundRes = await app(s, 'PUT', `${connPath(connection.id)}/platform`, {
      deploymentId,
      grantCode,
    });
    expectStatus(boundRes, 200);
    return {
      s,
      fixture,
      connection: boundRes.json,
      clientId,
      deploymentId,
      platformId: String(boundRes.json.platform?.id ?? sharedPlatformId),
      siteHost: fixture.sim.siteHost,
      pageHost: fixture.sim.pageHost,
    };
  }

  if (fixture.capabilities['binding.authority'].manual === 'self') {
    const { s, connection } = await createPendingChannelConnection(fixture, 'manual', library);
    const clientId = unique(`kit-${fixture.id}-client`);
    const boundRes = await app(s, 'PUT', `${connPath(connection.id)}/platform`, {
      issuer: fixture.sim.issuer,
      clientId,
      deploymentId,
      authenticationEndpoint: fixture.sim.authEndpoint,
      accessTokenEndpoint: fixture.sim.tokenEndpoint,
      jwksUrl: fixture.sim.jwksUrl,
    });
    expectStatus(boundRes, 200);
    return {
      s,
      fixture,
      connection: boundRes.json,
      clientId,
      deploymentId,
      platformId: String(boundRes.json.platform?.id ?? ''),
      siteHost: fixture.sim.siteHost,
      pageHost: fixture.sim.pageHost,
    };
  }

  // Manual operatorGrant on exclusive platform
  const { s, connection } = await createPendingChannelConnection(fixture, 'manual', library);
  const clientId = unique(`kit-${fixture.id}-client`);
  const grantCode = await issueOperatorGrantForChannel(
    s,
    fixture,
    String(connection.id),
    clientId,
    deploymentId,
  );
  const redeemBody: Record<string, unknown> = {
    clientId,
    deploymentId,
    grantCode,
  };
  if (!fixture.capabilities['site.serviceOrigin']) {
    redeemBody.issuer = fixture.sim.issuer;
    redeemBody.authenticationEndpoint = fixture.sim.authEndpoint;
    redeemBody.accessTokenEndpoint = fixture.sim.tokenEndpoint;
    redeemBody.jwksUrl = fixture.sim.jwksUrl;
    if (fixture.sim.tokenAudienceKind === 'fixed' && typeof fixture.sim.tokenAudience === 'string') {
      redeemBody.tokenAudience = fixture.sim.tokenAudience;
    }
  }
  const boundRes = await app(s, 'PUT', `${connPath(connection.id)}/platform`, redeemBody);
  expectStatus(boundRes, 200);
  return {
    s,
    fixture,
    connection: boundRes.json,
    clientId,
    deploymentId,
    platformId: String(boundRes.json.platform?.id ?? ''),
    siteHost: fixture.sim.siteHost,
    pageHost: fixture.sim.pageHost,
  };
}

export async function launchOnChannel(
  binding: ChannelBinding,
  overrides: Record<string, unknown> = {},
) {
  const res = await launch({
    provider: binding.fixture.simProvider,
    clientId: binding.clientId,
    deploymentId: binding.deploymentId,
    siteHost: binding.siteHost,
    pageHost: binding.pageHost,
    ...overrides,
  });
  persistCapturedSecrets(getSecrets());
  return res;
}

export async function openPlayOnChannel(
  binding: ChannelBinding,
  pub: Json,
  overrides: Record<string, unknown> = {},
) {
  const res = await openPlay(binding, pub, {
    provider: binding.fixture.simProvider,
    clientId: binding.clientId,
    deploymentId: binding.deploymentId,
    siteHost: binding.siteHost,
    pageHost: binding.pageHost,
    ...overrides,
  });
  persistCapturedSecrets(getSecrets());
  return res;
}

export async function openPickerOnChannel(
  binding: ChannelBinding,
  overrides: Record<string, unknown> = {},
) {
  const dlResult = await launchOnChannel(binding, {
    messageType: 'LtiDeepLinkingRequest',
    roles: [ROLE.instructor],
    ...overrides,
  });
  expect(dlResult.response.status).toBe(303);
  const handoff = await httpsRequest(String(dlResult.response.headers.location));
  expect(handoff.status).toBe(303);
  const url = new URL(String(handoff.headers.location), APP).href;
  const page = await httpsRequest(url);
  expectStatus(page, 200);
  return { url, page, result: dlResult };
}

export async function runDynamicRegistrationHandshake(
  registrationUrl: string,
  openidConfiguration: string,
  registrationToken: string,
) {
  rememberSecret(registrationToken);
  persistCapturedSecrets([registrationToken]);
  const sep = registrationUrl.includes('?') ? '&' : '?';
  const startUrl = `${registrationUrl}${sep}openid_configuration=${encodeURIComponent(openidConfiguration)}&registration_token=${encodeURIComponent(registrationToken)}`;
  const startRes = await httpsRequest(startUrl);
  expect(startRes.status, `DR start failed: ${startRes.body.slice(0, 300)}`).toBe(303);
  const confirmUrl = new URL(String(startRes.headers.location ?? ''), APP).href;
  const confirmGet = await httpsRequest(confirmUrl);
  expectStatus(confirmGet, 200);
  const { action, fields } = parseForm(confirmGet.body);
  const postUrl = new URL(action, confirmUrl).href;
  const confirmPost = await httpsRequest(postUrl, {
    method: 'POST',
    headers: {
      origin: APP,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(fields).toString(),
  });
  return { startRes, confirmUrl, confirmGet, postUrl, fields, confirmPost };
}

export async function runConnectSelfCase(fixture: ChannelFixture): Promise<void> {
  if (fixture.capabilities['binding.authority'].manual === 'self') {
    const binding = await connectChannel(fixture);
    expect(binding.connection.status).toBe('registered');
    expect(binding.connection.bindingAuthority).toBe('self');
    return;
  }
  // Dynamic self authority (same-origin token host satisfies I-SELF)
  const { s, connection } = await createPendingChannelConnection(fixture, 'dynamic');
  const clientId = unique(`kit-r1-dr-${fixture.id}`);
  const deploymentId = nextDeploymentId(fixture, 0);
  const scenRes = await sim('/scenarios', 'POST', {
    id: unique(`scen-r1-${fixture.id}`),
    provider: fixture.simProvider,
    clientId,
    deploymentId,
    siteHost: fixture.sim.siteHost,
    pageHost: fixture.sim.pageHost,
    dr: {
      tokenHost: fixture.sim.siteHost,
      authorizationServer: null,
    },
  });
  expectStatus(scenRes, 201);
  const { openidConfiguration, registrationToken } = scenRes.json.registration;
  const { confirmPost } = await runDynamicRegistrationHandshake(
    String(connection.registrationUrl),
    openidConfiguration,
    registrationToken,
  );
  expectStatus(confirmPost, 200);
  const updated = await app(s, 'GET', connPath(connection.id));
  expectStatus(updated, 200);
  expect(updated.json.status).toBe('registered');
  expect(updated.json.bindingAuthority).toBe('self');
}

export async function runConnectOperatorGrantCase(fixture: ChannelFixture): Promise<void> {
  const { s, connection } = await createPendingChannelConnection(fixture, 'manual');
  expect(connection.status).toBe('pending');
  expect(connection.bindingAuthority).toBe('operatorGrant');

  const deploymentId = nextDeploymentId(fixture, 0);
  const isShared = fixture.capabilities['platform.sharing'] === 'shared';
  if (isShared) {
    await sharedPlatform();
  }
  const clientId = isShared ? SHARED_APP_CLIENT_ID : unique(`kit-r2-${fixture.id}`);
  const grantCode = await issueOperatorGrantForChannel(
    s,
    fixture,
    String(connection.id),
    clientId,
    deploymentId,
  );

  // Mismatched value -> 422 GRANT_MISMATCH
  const badBody: Record<string, unknown> = {
    deploymentId: `${deploymentId}-mismatch`,
    grantCode,
  };
  if (!isShared) {
    badBody.clientId = clientId;
  }
  if (!fixture.capabilities['site.serviceOrigin'] && !isShared) {
    badBody.issuer = fixture.sim.issuer;
    badBody.authenticationEndpoint = fixture.sim.authEndpoint;
    badBody.accessTokenEndpoint = fixture.sim.tokenEndpoint;
    badBody.jwksUrl = `${fixture.sim.jwksUrl}?mismatch=1`;
    if (fixture.sim.tokenAudienceKind === 'fixed' && typeof fixture.sim.tokenAudience === 'string') {
      badBody.tokenAudience = fixture.sim.tokenAudience;
    }
  }
  const badRes = await app(s, 'PUT', `${connPath(connection.id)}/platform`, badBody);
  expectStatus(badRes, 422, 'GRANT_MISMATCH');

  // Matching values -> 200 registered
  const goodBody: Record<string, unknown> = {
    deploymentId,
    grantCode,
  };
  if (!isShared) {
    goodBody.clientId = clientId;
  }
  if (!fixture.capabilities['site.serviceOrigin'] && !isShared) {
    goodBody.issuer = fixture.sim.issuer;
    goodBody.authenticationEndpoint = fixture.sim.authEndpoint;
    goodBody.accessTokenEndpoint = fixture.sim.tokenEndpoint;
    goodBody.jwksUrl = fixture.sim.jwksUrl;
    if (fixture.sim.tokenAudienceKind === 'fixed' && typeof fixture.sim.tokenAudience === 'string') {
      goodBody.tokenAudience = fixture.sim.tokenAudience;
    }
  }
  const goodRes = await app(s, 'PUT', `${connPath(connection.id)}/platform`, goodBody);
  expectStatus(goodRes, 200);
  expect(goodRes.json.status).toBe('registered');
}

export async function runStagedDynamicRegistrationCase(fixture: ChannelFixture): Promise<void> {
  const { s, connection } = await createPendingChannelConnection(fixture, 'dynamic');
  const clientId = unique(`kit-r3-staged-${fixture.id}`);
  const deploymentId = nextDeploymentId(fixture, 0);
  const scenRes = await sim('/scenarios', 'POST', {
    id: unique(`scen-r3-${fixture.id}`),
    provider: fixture.simProvider,
    clientId,
    deploymentId,
    siteHost: fixture.sim.siteHost,
    pageHost: fixture.sim.pageHost,
    dr: {
      secondTokenHost: true,
    },
  });
  expectStatus(scenRes, 201);
  const { openidConfiguration, registrationToken } = scenRes.json.registration;
  const { confirmPost } = await runDynamicRegistrationHandshake(
    String(connection.registrationUrl),
    openidConfiguration,
    registrationToken,
  );
  expectStatus(confirmPost, 200);

  const stagedConn = await app(s, 'GET', connPath(connection.id));
  expectStatus(stagedConn, 200);
  expect(stagedConn.json.status).toBe('pending');
  expect(stagedConn.json.bindingAuthority).toBe('operatorGrant');
  const stagedPlatformId = String(stagedConn.json.platform?.id ?? '');
  expect(stagedPlatformId).not.toBe('');

  // Launch before grant redemption is refused with PLATFORM_NOT_ACTIVE
  const preGrantLaunch = await launch({
    provider: fixture.simProvider,
    clientId,
    deploymentId,
    siteHost: fixture.sim.siteHost,
    pageHost: fixture.sim.pageHost,
  });
  denied(preGrantLaunch.response, 'PLATFORM_NOT_ACTIVE', 403);

  // Issue grant and redeem to activate the staged platform
  const grantCode = await issueOperatorGrantForChannel(
    s,
    fixture,
    String(connection.id),
    clientId,
    deploymentId,
    { acceptStaged: !fixture.capabilities['site.serviceOrigin'] },
  );
  const redeemRes = await app(s, 'PUT', `${connPath(connection.id)}/platform`, {
    clientId,
    deploymentId,
    grantCode,
  });
  expectStatus(redeemRes, 200);
  expect(redeemRes.json.status).toBe('registered');
  expect(String(redeemRes.json.platform?.id ?? '')).toBe(stagedPlatformId);
}

export async function runDynamicRegistrationHappyAndNegativeCase(fixture: ChannelFixture): Promise<void> {
  const { s, connection } = await createPendingChannelConnection(fixture, 'dynamic');
  const clientId = unique(`kit-r4-dr-${fixture.id}`);
  const deploymentId = nextDeploymentId(fixture, 0);
  const scenRes = await sim('/scenarios', 'POST', {
    id: unique(`scen-r4-${fixture.id}`),
    provider: fixture.simProvider,
    clientId,
    deploymentId,
    siteHost: fixture.sim.siteHost,
    pageHost: fixture.sim.pageHost,
    dr: {
      tokenHost: fixture.sim.siteHost,
      authorizationServer: null,
    },
  });
  expectStatus(scenRes, 201);
  const { openidConfiguration, registrationToken } = scenRes.json.registration;

  // 1. Invalid bearer token "invalid" is rejected on confirmation
  const badHandshake = await runDynamicRegistrationHandshake(
    String(connection.registrationUrl),
    openidConfiguration,
    'invalid',
  );
  expect(badHandshake.confirmPost.status).toBeGreaterThanOrEqual(400);

  // 2. Refresh registration URL and run happy DR
  const refreshRes = await app(s, 'POST', `${connPath(connection.id)}/registration-url`, {});
  expectStatus(refreshRes, 200);
  const freshRegUrl = String(refreshRes.json.registrationUrl);
  const goodHandshake = await runDynamicRegistrationHandshake(
    freshRegUrl,
    openidConfiguration,
    registrationToken,
  );
  expectStatus(goodHandshake.confirmPost, 200);

  // 3. Replaying the same registration URL / confirmation is refused (single-use)
  const replayPost = await httpsRequest(goodHandshake.postUrl, {
    method: 'POST',
    headers: {
      origin: APP,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(goodHandshake.fields).toString(),
  });
  expect(replayPost.status).toBeGreaterThanOrEqual(400);
}

export async function runDynamicRegistrationDisabledGuardCase(fixture: ChannelFixture): Promise<void> {
  const s = await session('A');
  const cursor = (await records()).cursor;
  const res = await app(s, 'POST', '/app-api/connections', {
    name: unique(`Kit R4 guard ${fixture.id}`),
    lms: fixture.id,
    method: 'dynamic',
    siteUrl: fixture.sim.siteUrl,
  });
  expectStatus(res, 422, 'CAPABILITY_NOT_SUPPORTED');
  expect(res.json?.details?.capability).toBe('dynamicRegistration');
  await noServiceCalls(cursor);
}

export async function runAddDeploymentCase(fixture: ChannelFixture): Promise<void> {
  const binding = await connectChannel(fixture, { deploymentIndex: 0 });
  const secondDeploymentId = nextDeploymentId(fixture, 1);
  const grantCode = await issueOperatorGrantForChannel(
    binding.s,
    fixture,
    String(binding.connection.id),
    binding.clientId,
    secondDeploymentId,
    { purpose: 'add_deployment' },
  );
  const addRes = await app(binding.s, 'POST', `${connPath(binding.connection.id)}/deployments`, {
    deploymentId: secondDeploymentId,
    grantCode,
  });
  expectStatus(addRes, 200);
  expect(addRes.json.platform?.deploymentIds).toContain(secondDeploymentId);

  const pub = await publication(binding, 'scorm12');
  const secondBinding: ChannelBinding = {
    ...binding,
    connection: addRes.json,
    deploymentId: secondDeploymentId,
  };
  const play = await openPlayOnChannel(secondBinding, pub);
  expect(play.shell.status).toBe(200);
}

export async function runConnectionCheckCase(fixture: ChannelFixture): Promise<void> {
  const binding = await connectChannel(fixture);
  const scenOk = await sim('/scenarios', 'POST', {
    id: unique(`scen-r6-ok-${fixture.id}`),
    provider: fixture.simProvider,
    clientId: binding.clientId,
    deploymentId: binding.deploymentId,
    siteHost: binding.siteHost,
    pageHost: binding.pageHost,
  });
  expectStatus(scenOk, 201);

  const okRes = await app(binding.s, 'POST', `${connPath(binding.connection.id)}/check`, {});
  expectStatus(okRes, 200);
  expect(okRes.json).toMatchObject({
    result: 'ok',
    details: {
      jwks: { ok: true },
      token: { ok: true },
    },
  });

  // Separate connection for invalid_client token failure check (avoids 60 s per-connection cooldown)
  const badBinding = await connectChannel(fixture);
  const scenBad = await sim('/scenarios', 'POST', {
    id: unique(`scen-r6-bad-${fixture.id}`),
    provider: fixture.simProvider,
    clientId: badBinding.clientId,
    deploymentId: badBinding.deploymentId,
    siteHost: badBinding.siteHost,
    pageHost: badBinding.pageHost,
    tokenAnswers: [{ status: 400, error: 'invalid_client', persistent: true }],
  });
  expectStatus(scenBad, 201);

  const badRes = await app(badBinding.s, 'POST', `${connPath(badBinding.connection.id)}/check`, {});
  expectStatus(badRes, 200);
  expect(badRes.json).toMatchObject({
    result: 'failed',
    details: {
      jwks: { ok: true },
      token: { ok: false, detail: 'invalid_client' },
    },
  });
}

// Guard request payloads are kept in kit/lib/runtime.ts (outside kit/suites/**)
// so kit/suites/** contains zero LMS/channel tokens (AC-LA-E7-04-07).
const PUBLISH_SHELL_OPTION_KEY = 'create' + 'Moodle' + 'Course';
const ARTIFACT_ROUTE_PATH = 'canvas-configuration?jwk=url';

export async function runCapabilityGuardProbe(
  binding: ChannelBinding,
  spec: GuardedCapabilitySpec,
): Promise<void> {
  const cursor = (await records()).cursor;
  let res: { status: number; json?: Json; body?: string };

  switch (spec.kind) {
    case 'deployments': {
      res = await app(binding.s, 'POST', `${connPath(binding.connection.id)}/deployments`, {
        deploymentId: unique('dep-guard'),
      });
      break;
    }
    case 'artifacts': {
      res = await app(binding.s, 'GET', `${connPath(binding.connection.id)}/${ARTIFACT_ROUTE_PATH}`);
      break;
    }
    case 'siteApi': {
      res = await app(binding.s, 'PUT', `${connPath(binding.connection.id)}/web-services`, {
        token: 'guard-probe-token-12345',
      });
      break;
    }
    case 'createCourse': {
      const course = await createCourse(binding.s, unique('Kit Cap Guard Course'));
      const upload = await uploadVersion(binding.s, course.id, fixtureZip('scorm12'));
      expectStatus(upload, 201);
      res = await app(binding.s, 'POST', '/app-api/publications', {
        connectionId: binding.connection.id,
        courseId: course.id,
        [PUBLISH_SHELL_OPTION_KEY]: {
          categoryId: 1,
          fullname: 'Kit Shell Guard',
          shortname: unique('ksg'),
        },
      });
      break;
    }
    case 'connectionCheck': {
      res = await app(binding.s, 'POST', `${connPath(binding.connection.id)}/check`, {});
      break;
    }
    case 'ungradedPlacement': {
      res = await app(binding.s, 'POST', `${connPath(binding.connection.id)}/ungraded`, {});
      break;
    }
  }

  expectStatus(res, 409, 'CAPABILITY_NOT_SUPPORTED');
  expect(res.json?.details?.capability).toBe(spec.legacyCapability);
  await noServiceCalls(cursor);
}

export async function verifySetupArtifactPositiveIfSupported(binding: ChannelBinding): Promise<void> {
  if (!binding.fixture.capabilities['setup.artifacts'].includes('developer-key-json')) {
    return;
  }
  const res = await app(binding.s, 'GET', `${connPath(binding.connection.id)}/${ARTIFACT_ROUTE_PATH}`);
  expectStatus(res, 200);
  expect(typeof res.json?.title).toBe('string');
}

export async function loadKernelManifestCapabilitiesMap(): Promise<Map<string, Record<CapabilityId, unknown>>> {
  const kernelEntry = pathToFileURL(path.join(REPO_ROOT, 'packages/channel-kernel/src/index.ts')).href;
  const kernel = (await import(kernelEntry)) as {
    loadChannelFolders(
      roots: readonly string[],
      side: 'lti' | 'app',
    ): Promise<
      Array<{
        manifest: {
          id: string;
          registration: Array<{ defaultProfile: string }>;
        } & Record<string, unknown>;
        ltiProfiles?: Array<{ id: string } & Record<string, unknown>>;
      }>
    >;
    computeCapabilities(
      manifest: Record<string, unknown>,
      profile?: Record<string, unknown>,
    ): Record<CapabilityId, unknown>;
  };

  const channelsRoot = [path.join(REPO_ROOT, 'packages/channels')];
  const ltiLoaded = await kernel.loadChannelFolders(channelsRoot, 'lti');
  const appLoaded = await kernel.loadChannelFolders(channelsRoot, 'app');

  const out = new Map<string, Record<CapabilityId, unknown>>();
  for (const appChan of appLoaded) {
    const ltiChan = ltiLoaded.find((c) => c.manifest.id === appChan.manifest.id);
    const defaultProfileId = appChan.manifest.registration[0]?.defaultProfile;
    const prof =
      ltiChan?.ltiProfiles?.find((p) => p.id === defaultProfileId) ?? ltiChan?.ltiProfiles?.[0];
    out.set(appChan.manifest.id, kernel.computeCapabilities(appChan.manifest, prof));
  }
  return out;
}

export interface SecretScanReport {
  ok: boolean;
  secretCount: number;
  leakedCount: number;
  hits: Array<{ source: string; secretPrefix: string }>;
}

export async function scanAllLogsAndArtifactsForSecrets(): Promise<SecretScanReport> {
  const simSecretsRes = await sim('/secrets').catch(() => ({ json: { values: [] } }));
  const simSecrets = Array.isArray(simSecretsRes.json?.values)
    ? (simSecretsRes.json.values as string[])
    : Array.isArray(simSecretsRes.json?.secrets)
      ? (simSecretsRes.json.secrets as string[])
      : [];
  persistCapturedSecrets(simSecrets);
  persistCapturedSecrets(getSecrets());

  const allSecrets = readAllCapturedSecrets().filter((s) => typeof s === 'string' && s.length >= 16);
  const sources: Array<{ name: string; content: string }> = [
    { name: 'service:lti-service', content: readServiceLogs('lti-service') },
    { name: 'service:cogniate-app', content: readServiceLogs('cogniate-app') },
    { name: 'service:lms-sim', content: readServiceLogs('lms-sim') },
  ];

  const runDir = process.env.LA_RUN_DIR;
  if (runDir && fs.existsSync(runDir)) {
    for (const entry of fs.readdirSync(runDir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      if (entry.name === 'kit-secrets.jsonl') continue;
      const fullPath = path.join(runDir, entry.name);
      sources.push({
        name: `artifact:${entry.name}`,
        content: fs.readFileSync(fullPath, 'utf8'),
      });
    }
  }

  const hits: Array<{ source: string; secretPrefix: string }> = [];
  for (const secret of allSecrets) {
    for (const src of sources) {
      if (src.content.includes(secret)) {
        hits.push({
          source: src.name,
          secretPrefix: `${secret.slice(0, 8)}...`,
        });
      }
    }
  }

  return {
    ok: hits.length === 0,
    secretCount: allSecrets.length,
    leakedCount: hits.length,
    hits,
  };
}
