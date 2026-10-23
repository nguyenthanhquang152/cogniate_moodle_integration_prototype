import type { OutboundClient } from '@cogniate/shared';
import { registerRecordReporters } from './kernel/records/records.ts';
import { ltiAgsReporter } from './drivers/lti-ags/index.ts';
import type { ChannelRegistry } from '@cogniate/channel-kernel';
import { setupOf } from './kernel/setup.ts';
// Test helpers for the cogniate-app unit tests (not used at run time).
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Limits } from '@cogniate/package-inspector';
import type { LogLine, PublicUrls } from '@cogniate/shared';
import { createLogger } from '@cogniate/shared';
import type { FastifyInstance } from 'fastify';
import { loadAppChannelRegistry } from './kernel/registry.ts';
import { buildAppApi } from './app/server.ts';
import type { Db } from './domain/db.ts';
import { openDb } from './domain/db.ts';
import { ensureLibrary, upsertUser } from './domain/libraries.ts';
import { randomBytes } from 'node:crypto';
import type { ContentItem, LtiClient, LtiIdToken, LtiPlatform, LtiProviderProfile, LtiRegistration } from './clients/lti-client.ts';
import { LtiServiceError } from './clients/lti-client.ts';
import type { StorePaths } from './domain/package-store.ts';
import { prepareStore } from './domain/package-store.ts';

export const TEST_URLS: PublicUrls & { moodle: string } = {
  moodle: 'https://moodle.test',
  lti: 'https://lti.cogniate.test',
  app: 'https://app.cogniate.test',
  content: 'https://content.cogniate-content.test',
};

export const THANH = { email: 'thanh@cogniate.test', password: 'Pw-thanh-test-1', name: 'Thanh', library: "Thanh's Library" };
export const QA_B = { email: 'qa-b@cogniate.test', password: 'Pw-qab-test-2', name: 'QA B', library: 'QA Library B' };

export const TEST_MASTER_KEY = Buffer.alloc(32, 5);

/** A fault rule of the fake LTI service (unit-test model of the M3 §3.3 transport gate). */
export interface FakeFault {
  /** Operation name: `POST platform`, `PATCH platform`, `DELETE platform`, `POST deployment`, `PATCH deployment`, `GET platform`. */
  op: string;
  /**
   * fail_before: 503 without applying. drop_after: apply, then no answer (status 0). late: no answer now (as a timeout)
   * and the call is applied only when the test runs `lateWrites.shift()()` (a late write). before / after: run `run`
   * before / after applying, then answer (a live schedule inside the 5 s).
   */
  action: 'fail_before' | 'drop_after' | 'late' | 'before' | 'after';
  run?: () => unknown;
  times?: number;
}

/** In-memory stand-in of the LTI service API (registrations, platforms, deployments, refs) for the app tests. */
export interface FakeLti {
  client: LtiClient;
  registrations: Map<string, LtiRegistration & { completed?: boolean }>;
  platforms: Map<string, LtiPlatform>;
  calls: string[];
  /** Make a registration session as GET /lti/register would (operation new or update). */
  addRegistration(over?: Partial<LtiRegistration>): string;
  failNext: { code: string; status: number; reason?: string } | null;
  /** Launches behind ltiks (GET /api/idtoken). */
  launches: Map<string, LtiIdToken>;
  /** Store a launch as POST /lti/launch would and return its ltik. */
  addLaunch(token: LtiIdToken): string;
  /** POST /api/deeplinking calls: the ltik and the content items. */
  deepLinks: Array<{ ltik: string; items: ContentItem[] }>;
  /** POST /api/lineitems/:id/scores calls (SERVICE-AUTH-V1). */
  scores: Array<{ serviceKey: string; lineItemId: string; body: Record<string, unknown> }>;
  /** Line items per Moodle resource link id (GET /api/lineitems?resourceLinkId=). */
  lineItems: Map<string, string[]>;
  /** Moodle gradebook values per "<lineItemId> <userId>" (GET /api/lineitems/:id/scores, AGS results). */
  gradebook: Map<string, { resultScore: number | null; resultMaximum: number }>;
  /** GET /api/providers answer (M1). Tests change it. */
  providers: LtiProviderProfile[];
  /** Fault rules (first match by op). */
  faults: FakeFault[];
  /** Late writes of `late` faults, in order. Each applies the held call and returns its upstream status. */
  lateWrites: Array<() => number>;
  /** Make the shared platform of a shared profile (as `lti:shared-platform`). */
  addSharedPlatform(profile: string, clientId: string): LtiPlatform;
}

/** A full platform answer from a partial one (M1 fields default to the `standard` values). */
export function ltiPlatform(p: Partial<LtiPlatform> & Pick<LtiPlatform, 'id' | 'url' | 'clientId'>): LtiPlatform {
  const deploymentIds = p.deploymentIds ?? [];
  return {
    name: 'Platform', active: true, productFamilyCode: null, profile: 'standard', siteUrl: null, serviceUrl: null, bindingRef: null,
    deployments: p.deployments ?? deploymentIds.map((d) => ({ deploymentId: d, siteUrl: new URL(p.url).origin, active: true, bindingGeneration: 0, bindingRef: null })),
    ...p, deploymentIds,
  };
}

/** Provider profiles of the fake (contract §9.3 shape): standard, blackboard (no shared platform) and blackboard-sim. */
export function fakeProviders(): LtiProviderProfile[] {
  const bb = (id: string, host: string, simulation: boolean): LtiProviderProfile => ({
    id, lms: 'blackboard', label: id, sharing: 'shared', issuer: `https://${host}`,
    authenticationEndpoint: `https://developer.${host}/api/v1/gateway/oidcauth`, accesstokenEndpoint: `https://developer.${host}/api/v1/gateway/oauth2/jwttoken`,
    jwksUrl: `https://developer.${host}/api/v1/management/applications/{clientId}/jwks.json`, siteUrlOn: 'deployment', serviceUrl: false, simulation, sharedPlatform: null,
  });
  return [
    { id: 'standard', lms: null, label: 'Standard LTI 1.3 platform', sharing: 'exclusive', issuer: null, authenticationEndpoint: null,
      accesstokenEndpoint: null, jwksUrl: null, siteUrlOn: null, serviceUrl: false, simulation: false, sharedPlatform: null },
    bb('blackboard', 'blackboard.com', false),
    // LA-E2-03: the admin-value profile of the lti-generic channel (wire lms = the channel id for a new profile).
    { id: 'lti-generic', lms: 'lti-generic', label: 'Other LTI 1.3 platform', sharing: 'exclusive', issuer: null, authenticationEndpoint: null,
      accesstokenEndpoint: null, jwksUrl: null, siteUrlOn: null, serviceUrl: false, simulation: false, sharedPlatform: null },
    bb('blackboard-sim', 'blackboard.sim.test', true),
    { id: 'canvas-sim-cloud', lms: 'canvas', label: 'Canvas cloud (simulation)', sharing: 'exclusive', issuer: 'https://canvas.sim.test',
      authenticationEndpoint: 'https://sso.canvas.sim.test/api/lti/authorize_redirect', accesstokenEndpoint: '{serviceUrl}/login/oauth2/token',
      jwksUrl: 'https://sso.canvas.sim.test/api/lti/security/jwks', siteUrlOn: 'platform', serviceUrl: true, simulation: true, sharedPlatform: null },
  ];
}

export const LEARNER = 'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner';
export const INSTRUCTOR = 'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor';
export const DL_RETURN = `${TEST_URLS.moodle}/mod/lti/contentitem_return.php?course=2&id=1&sesskey=s`;

/** An idtoken answer like the LTI service gives for Moodle (contract lti-service-api §3.1). */
export function launchToken(o: {
  platformId: string; type?: 'LtiResourceLinkRequest' | 'LtiDeepLinkingRequest'; target?: string; roles?: string[]; sub?: string;
  contextId?: string; contextTitle?: string; resourceLinkId?: string; resourceLinkTitle?: string; documentTarget?: string; returnUrl?: string; deploymentId?: string;
}): LtiIdToken {
  const deepLinking = o.type === 'LtiDeepLinkingRequest';
  return {
    user: { id: o.sub ?? '5', roles: o.roles ?? [deepLinking ? INSTRUCTOR : LEARNER] },
    platform: { id: o.platformId, url: TEST_URLS.moodle, deploymentId: o.deploymentId ?? '1' },
    launch: {
      type: o.type ?? 'LtiResourceLinkRequest',
      target: o.target ?? `${TEST_URLS.lti}/lti/launch/cogniate`,
      context: { id: o.contextId ?? '2', label: 'COGNIATE-DEV-101', title: o.contextTitle ?? 'Cogniate Dev 101' },
      ...(deepLinking ? {} : { resourceLink: { id: o.resourceLinkId ?? '3', title: o.resourceLinkTitle ?? 'Cogniate SCORM' } }),
      presentation: { documentTarget: o.documentTarget ?? 'window', returnUrl: o.returnUrl ?? `${TEST_URLS.moodle}/mod/lti/return.php?course=2&launch_container=4` },
    },
    services: deepLinking ? {} : { assignmentAndGrades: { available: true, lineItemId: `${TEST_URLS.moodle}/mod/lti/services.php/2/lineitems/7/lineitem?type_id=1` }, serviceKey: 's'.repeat(43) },
  };
}

export function fakeLti(): FakeLti {
  const registrations = new Map<string, LtiRegistration & { completed?: boolean }>();
  const platforms = new Map<string, LtiPlatform>();
  const providers = fakeProviders();
  const faults: FakeFault[] = [];
  const lateWrites: Array<() => number> = [];
  const calls: string[] = [];
  const launches = new Map<string, LtiIdToken>();
  const deepLinks: Array<{ ltik: string; items: ContentItem[] }> = [];
  const scores: FakeLti['scores'] = [];
  const lineItems = new Map<string, string[]>();
  const gradebook: FakeLti['gradebook'] = new Map();
  let seq = 0;
  const state: { failNext: FakeLti['failNext'] } = { failNext: null };
  const failIfAsked = () => {
    if (state.failNext) { const f = state.failNext; state.failNext = null; throw new LtiServiceError(f.status, f.code, '', f.reason ?? null); }
  };
  const clone = (p: LtiPlatform): LtiPlatform => JSON.parse(JSON.stringify(p)) as LtiPlatform;
  /** Apply a fault rule of `op` (first match), then the operation. */
  const guarded = async <T>(op: string, apply: () => T): Promise<T> => {
    failIfAsked();
    const i = faults.findIndex((f) => f.op === op);
    const rule = i >= 0 ? faults[i]! : null;
    if (rule) {
      rule.times = (rule.times ?? 1) - 1;
      if (rule.times <= 0) faults.splice(i, 1);
    }
    switch (rule?.action) {
      case 'fail_before': throw new LtiServiceError(503, 'HTTP_503', '');
      case 'late':
        lateWrites.push(() => { try { apply(); return 200; } catch (err) { return err instanceof LtiServiceError ? err.status : 500; } });
        throw new LtiServiceError(0, 'LTI_SERVICE_UNREACHABLE', 'The LTI service did not answer.');
      case 'drop_after': apply(); throw new LtiServiceError(0, 'LTI_SERVICE_UNREACHABLE', 'The LTI service did not answer.');
      case 'before': await rule.run?.(); return apply();
      case 'after': { const out = apply(); await rule.run?.(); return out; }
      default: return apply();
    }
  };
  const client: LtiClient = {
    async getRegistration(id) {
      calls.push(`GET registration ${id}`); failIfAsked();
      const r = registrations.get(id);
      if (!r) throw new LtiServiceError(404, 'REGISTRATION_NOT_FOUND', '');
      return r;
    },
    async completeRegistration(id, body) {
      calls.push(`POST complete ${id} ${JSON.stringify(body)}`); failIfAsked();
      const r = registrations.get(id);
      if (!r) throw new LtiServiceError(404, 'REGISTRATION_NOT_FOUND', '');
      if (r.completed) throw new LtiServiceError(409, 'REGISTRATION_ALREADY_COMPLETED', '');
      // The app never sends updatePlatformId (security §2.5), so the LTI service refuses every update.
      if (r.operation === 'update') throw new LtiServiceError(409, 'REGISTRATION_UPDATE_NOT_ALLOWED', '');
      r.completed = true;
      const id2 = `plt_${++seq}`;
      platforms.set(id2, ltiPlatform({ id: id2, url: r.url, clientId: `client-${seq}`, name: body.platformName, active: true, deploymentIds: [String(seq)], productFamilyCode: 'moodle' }));
      return { platformId: id2, html: '<script>close</script>' };
    },
    async createPlatform(body) {
      calls.push(`POST platform ${JSON.stringify(body)}`); failIfAsked();
      const exists = [...platforms.values()].find((p) => p.url === body.url && p.clientId === body.clientId);
      if (exists) throw new LtiServiceError(409, 'PLATFORM_ALREADY_EXISTS', '');
      const id = `plt_${++seq}`;
      const p = ltiPlatform({ id, url: String(body.url), clientId: String(body.clientId), name: String(body.name), active: true, deploymentIds: body.deploymentIds as string[] });
      platforms.set(id, p);
      return clone(p);
    },
    async getPlatform(id) {
      calls.push(`GET platform ${id}`);
      return guarded('GET platform', () => {
        const p = platforms.get(id);
        if (!p) throw new LtiServiceError(404, 'UNREGISTERED_PLATFORM', '');
        return clone(p);
      });
    },
    async patchPlatform(id, body) {
      calls.push(`PATCH platform ${id} ${JSON.stringify(body)}`);
      return guarded('PATCH platform', () => {
        const p = platforms.get(id);
        if (!p) throw new LtiServiceError(404, 'UNREGISTERED_PLATFORM', '');
        // ADR-011 §4 rule 5: the app never changes a shared platform (a test fails loudly if it tries).
        if (p.profile.startsWith('blackboard')) throw new Error('the app must never PATCH a shared platform');
        if (body.ifBindingRef !== undefined && p.bindingRef !== body.ifBindingRef) throw new LtiServiceError(409, 'BINDING_REF_MISMATCH', '');
        if (body.active !== undefined) p.active = body.active;
        if (body.name !== undefined) p.name = body.name;
        if (body.bindingRef !== undefined) p.bindingRef = body.bindingRef;
        return clone(p);
      });
    },
    async createProviderPlatform(body) {
      calls.push(`POST platform ${JSON.stringify(body)}`);
      return guarded('POST platform', () => {
        const prof = providers.find((x) => x.id === body.profile);
        if (!prof) throw new LtiServiceError(400, 'UNKNOWN_PROFILE', '');
        const url = (prof.issuer ?? '').replace('{siteUrl}', body.siteUrl);
        if (body.url !== undefined && body.url !== url) throw new LtiServiceError(400, 'PLATFORM_URL_NOT_IN_PROFILE', '');
        if ([...platforms.values()].some((p) => p.url === url && p.clientId === body.clientId)) throw new LtiServiceError(409, 'PLATFORM_ALREADY_EXISTS', '');
        const id = `plt_${++seq}`;
        const p = ltiPlatform({
          id, url, clientId: body.clientId, name: body.name, active: body.active, profile: body.profile, siteUrl: body.siteUrl, serviceUrl: body.serviceUrl ?? body.siteUrl,
          bindingRef: body.bindingRef, deploymentIds: body.deploymentIds,
          deployments: body.deploymentIds.map((d) => ({ deploymentId: d, siteUrl: body.siteUrl, active: true, bindingGeneration: 0, bindingRef: null })),
        });
        platforms.set(id, p);
        return clone(p);
      });
    },
    async findPlatforms(q) {
      calls.push(`GET platforms ${q.url} ${q.clientId}`);
      return [...platforms.values()].filter((p) => p.url === q.url && p.clientId === q.clientId && (q.profile === undefined || p.profile === q.profile)).map(clone);
    },
    async deletePlatform(id, ifBindingRef) {
      calls.push(`DELETE platform ${id}${ifBindingRef !== null ? ` if ${ifBindingRef}` : ''}`);
      return guarded('DELETE platform', () => {
        const p = platforms.get(id);
        if (!p) throw new LtiServiceError(404, 'UNREGISTERED_PLATFORM', '');
        if (ifBindingRef !== null && p.bindingRef !== ifBindingRef) throw new LtiServiceError(409, 'BINDING_REF_MISMATCH', '');
        if (p.profile.startsWith('blackboard')) throw new Error('the app must never delete a shared platform');
        platforms.delete(id);
        return undefined;
      });
    },
    async addDeployment(platformId, body) {
      calls.push(`POST deployment ${platformId} ${JSON.stringify(body)}`);
      return guarded('POST deployment', () => {
        const p = platforms.get(platformId);
        if (!p) throw new LtiServiceError(404, 'UNREGISTERED_PLATFORM', '');
        if (p.deployments.some((d) => d.deploymentId === body.deploymentId)) throw new LtiServiceError(409, 'DEPLOYMENT_ALREADY_EXISTS', '');
        const shared = p.profile.startsWith('blackboard');
        const d = { deploymentId: body.deploymentId, siteUrl: body.siteUrl ?? p.siteUrl ?? new URL(p.url).origin, active: body.active,
          bindingGeneration: shared && body.active ? 1 : 0, bindingRef: body.bindingRef };
        p.deployments.push(d);
        p.deploymentIds = p.deployments.filter((x) => x.active).map((x) => x.deploymentId);
        return { ...d };
      });
    },
    async patchDeployment(platformId, deploymentId, body) {
      calls.push(`PATCH deployment ${platformId} ${deploymentId} ${JSON.stringify(body)}`);
      return guarded('PATCH deployment', () => {
        const p = platforms.get(platformId);
        if (!p) throw new LtiServiceError(404, 'UNREGISTERED_PLATFORM', '');
        const d = p.deployments.find((x) => x.deploymentId === deploymentId);
        if (!d) throw new LtiServiceError(404, 'UNKNOWN_DEPLOYMENT', '');
        if (body.ifBindingRef !== undefined && d.bindingRef !== body.ifBindingRef) throw new LtiServiceError(409, 'BINDING_REF_MISMATCH', '');
        const shared = p.profile.startsWith('blackboard');
        const newBinding = shared && body.active && (!d.active || body.bindingRef !== d.bindingRef);
        if (body.active === false) d.active = false;
        else if (newBinding) { d.active = true; d.bindingGeneration += 1; if (body.siteUrl) d.siteUrl = body.siteUrl; }
        else if (body.active) d.active = true;
        d.bindingRef = body.bindingRef;
        p.deploymentIds = p.deployments.filter((x) => x.active).map((x) => x.deploymentId);
        return { ...d };
      });
    },
    async getProviders() {
      calls.push('GET providers');
      return guarded('GET providers', () => providers.map((p) => {
        const shared = p.sharing === 'shared' ? [...platforms.values()].find((x) => x.profile === p.id) : undefined;
        return { ...p, sharedPlatform: shared ? { id: shared.id, clientId: shared.clientId, active: shared.active } : null };
      }));
    },
    async getToolKeys() { calls.push('GET tool keys'); return [{ kty: 'RSA', kid: 'kid-1', alg: 'RS256', use: 'sig', n: 'n-value', e: 'AQAB' }]; },
    async getIdToken(ltik) {
      calls.push('GET idtoken'); failIfAsked();
      const token = launches.get(ltik);
      if (!token) throw new LtiServiceError(401, 'INVALID_LTIK_AUTH_AUTHORIZATION_HEADER', 'Invalid or expired ltik.');
      return token;
    },
    async deepLinking(ltik, items) {
      calls.push(`POST deeplinking ${JSON.stringify(items)}`); failIfAsked();
      const token = launches.get(ltik);
      if (!token) throw new LtiServiceError(401, 'INVALID_LTIK_AUTH_AUTHORIZATION_HEADER', '');
      if (token.launch.type !== 'LtiDeepLinkingRequest') throw new LtiServiceError(403, 'SERVICE_NOT_AVAILABLE', '');
      deepLinks.push({ ltik, items });
      return { message: `header.${Buffer.from(JSON.stringify(items)).toString('base64url')}.sig`, target: DL_RETURN };
    },
    async postScore(serviceKey, lineItemId, body) {
      calls.push(`POST score ${lineItemId} ${JSON.stringify(body)}`); failIfAsked();
      scores.push({ serviceKey, lineItemId, body: body as Record<string, unknown> });
      return undefined;
    },
    async getResults(_serviceKey, lineItemId, userId) {
      calls.push(`GET results ${lineItemId} ${userId}`); failIfAsked();
      const g = gradebook.get(`${lineItemId} ${userId}`);
      return g ? [{ userId, resultScore: g.resultScore, resultMaximum: g.resultMaximum }] : [];
    },
    async findLineItems(_serviceKey, resourceLinkId) {
      calls.push(`GET lineitems ${resourceLinkId}`); failIfAsked();
      return (lineItems.get(resourceLinkId) ?? []).map((id) => ({ id, resourceLinkId }));
    },
  };
  return {
    client, registrations, platforms, calls, launches, deepLinks, scores, lineItems, gradebook, providers, faults, lateWrites,
    addSharedPlatform(profile, clientId) {
      const prof = providers.find((p) => p.id === profile)!;
      const id = `plt_${++seq}`;
      const p = ltiPlatform({ id, url: prof.issuer!, clientId, name: 'Cogniate', profile, deploymentIds: [], deployments: [] });
      platforms.set(id, p);
      return p;
    },
    addLaunch(token) {
      const ltik = randomBytes(32).toString('base64url');
      launches.set(ltik, token);
      return ltik;
    },
    addRegistration(over = {}) {
      const id = `reg_${++seq}`;
      registrations.set(id, { url: TEST_URLS.moodle, familyCode: 'moodle', version: '5.2.4 (Build: 20261005)', supportedScopes: [], supportedMessages: [], privacyLevel: 'anonymous', operation: 'new', existingPlatformId: null, ...over });
      return id;
    },
    get failNext() { return state.failNext; },
    set failNext(v) { state.failNext = v; },
  };
}

/** The Build Runner queue of a test app (requests/, status/, out/). */
export function queueDir(dataDir: string): string {
  const dir = join(dataDir, 'build-queue');
  for (const sub of ['requests', 'status', 'out']) mkdirSync(join(dir, sub), { recursive: true, mode: 0o700 });
  return dir;
}

export interface TestApp {
  app: FastifyInstance;
  db: Db;
  store: StorePaths;
  dataDir: string;
  logs: LogLine[];
  clock: { now: number };
  lti: FakeLti;
  /** Sign in and return the Cookie header value. */
  login: (user: { email: string; password: string }) => Promise<string>;
  /** Headers of a write from the app origin, with the session cookie. */
  writeHeaders: (cookie: string) => Record<string, string>;
}

export async function testApp(opts: { channels?: ChannelRegistry; limits?: Partial<Limits>; refTtlSeconds?: number; pickerTtlSeconds?: number; playTtlSeconds?: number; buildKnobs?: { hold: boolean; failAt: string }; outbound?: OutboundClient } = {}): Promise<TestApp> {
  const dataDir = mkdtempSync(join(tmpdir(), 'cogniate-app-'));
  const db = openDb(':memory:');
  const store = await prepareStore(dataDir);
  const logs: LogLine[] = [];
  const logger = createLogger({ service: 'cogniate-app', level: 'debug', write: (line) => logs.push(JSON.parse(line) as LogLine) });
  const clock = { now: Date.UTC(2026, 9, 17, 8, 0, 0) };
  for (const u of [THANH, QA_B]) {
    const lib = ensureLibrary(db, u.library, clock.now);
    await upsertUser(db, { email: u.email, name: u.name, role: 'owner', libraryId: lib.id, password: u.password }, clock.now);
  }
  const lti = fakeLti();
  registerRecordReporters(db, [ltiAgsReporter({ db, lti: lti.client, masterKey: TEST_MASTER_KEY, channels: opts.channels ?? TEST_CHANNELS })]);
  const app = await buildAppApi({
    channels: opts.channels ?? TEST_CHANNELS,
    db, urls: TEST_URLS, logger, store, profile: 'default', knobs: [], now: () => clock.now, ...(opts.limits ? { limits: opts.limits } : {}),
    masterKey: TEST_MASTER_KEY, lti: lti.client, refTtlSeconds: opts.refTtlSeconds ?? 86400,
    pickerTtlSeconds: opts.pickerTtlSeconds ?? 3600, playTtlSeconds: opts.playTtlSeconds ?? 86400, playerDir: join(dataDir, 'player'),
    buildQueueDir: queueDir(dataDir), buildKnobs: opts.buildKnobs ?? { hold: false, failAt: '' }, outbound: opts.outbound ?? { allowlist: [], request: async () => { throw new Error('Unexpected extension network request'); } },
  });
  const login = async (user: { email: string; password: string }): Promise<string> => {
    const res = await app.inject({ method: 'POST', url: '/app-api/session', headers: { origin: TEST_URLS.app }, payload: { email: user.email, password: user.password } });
    if (res.statusCode !== 204) throw new Error(`login failed: ${res.statusCode}`);
    return String(res.headers['set-cookie']).split(';')[0]!;
  };
  return { app, db, store, dataDir, logs, clock, lti, login, writeHeaders: (cookie) => ({ cookie, origin: TEST_URLS.app }) };
}

/** A multipart/form-data body for app.inject. A Buffer value is a file part. */
export async function formBody(fields: Record<string, string | Buffer>): Promise<{ payload: Buffer; headers: Record<string, string> }> {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    if (typeof value === 'string') form.append(name, value);
    else form.append(name, new Blob([new Uint8Array(value)]), 'package.zip');
  }
  const req = new Request('http://local.invalid/', { method: 'POST', body: form });
  return { payload: Buffer.from(await req.arrayBuffer()), headers: { 'content-type': req.headers.get('content-type')! } };
}

/** One product registry for unit fixtures; tests can inject another registry. */
export const TEST_CHANNELS = await loadAppChannelRegistry(createLogger({ service: 'test', write: () => {} }));

export const testSetupOf = (channel: string) => setupOf(TEST_CHANNELS, channel);
