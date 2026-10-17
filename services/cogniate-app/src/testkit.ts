// Test helpers for the cogniate-app unit tests (not used at run time).
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Limits } from '@cogniate/package-inspector';
import type { LogLine, PublicUrls } from '@cogniate/shared';
import { createLogger } from '@cogniate/shared';
import type { FastifyInstance } from 'fastify';
import { buildAppApi } from './app/server.ts';
import type { Db } from './domain/db.ts';
import { openDb } from './domain/db.ts';
import { ensureLibrary, upsertUser } from './domain/libraries.ts';
import type { LtiClient, LtiPlatform, LtiRegistration } from './clients/lti-client.ts';
import { LtiServiceError } from './clients/lti-client.ts';
import type { StorePaths } from './domain/package-store.ts';
import { prepareStore } from './domain/package-store.ts';

export const TEST_URLS: PublicUrls = {
  moodle: 'https://moodle.test',
  lti: 'https://lti.cogniate.test',
  app: 'https://app.cogniate.test',
  content: 'https://content.cogniate-content.test',
};

export const THANH = { email: 'thanh@cogniate.test', password: 'Pw-thanh-test-1', name: 'Thanh', library: "Thanh's Library" };
export const QA_B = { email: 'qa-b@cogniate.test', password: 'Pw-qab-test-2', name: 'QA B', library: 'QA Library B' };

export const TEST_MASTER_KEY = Buffer.alloc(32, 5);

/** In-memory stand-in of the LTI service API (registrations and platforms) for the app tests. */
export interface FakeLti {
  client: LtiClient;
  registrations: Map<string, LtiRegistration & { completed?: boolean }>;
  platforms: Map<string, LtiPlatform>;
  calls: string[];
  /** Make a registration session as GET /lti/register would (operation new or update). */
  addRegistration(over?: Partial<LtiRegistration>): string;
  failNext: { code: string; status: number; reason?: string } | null;
}

export function fakeLti(): FakeLti {
  const registrations = new Map<string, LtiRegistration & { completed?: boolean }>();
  const platforms = new Map<string, LtiPlatform>();
  const calls: string[] = [];
  let seq = 0;
  const state: { failNext: FakeLti['failNext'] } = { failNext: null };
  const failIfAsked = () => {
    if (state.failNext) { const f = state.failNext; state.failNext = null; throw new LtiServiceError(f.status, f.code, '', f.reason ?? null); }
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
      platforms.set(id2, { id: id2, url: r.url, clientId: `client-${seq}`, name: body.platformName, active: true, deploymentIds: [String(seq)], productFamilyCode: 'moodle' });
      return { platformId: id2, html: '<script>close</script>' };
    },
    async createPlatform(body) {
      calls.push(`POST platform ${JSON.stringify(body)}`); failIfAsked();
      const exists = [...platforms.values()].find((p) => p.url === body.url && p.clientId === body.clientId);
      if (exists) throw new LtiServiceError(409, 'PLATFORM_ALREADY_EXISTS', '');
      const id = `plt_${++seq}`;
      const p: LtiPlatform = { id, url: String(body.url), clientId: String(body.clientId), name: String(body.name), active: true, deploymentIds: body.deploymentIds as string[], productFamilyCode: null };
      platforms.set(id, p);
      return p;
    },
    async getPlatform(id) { calls.push(`GET platform ${id}`); const p = platforms.get(id); if (!p) throw new LtiServiceError(404, 'UNREGISTERED_PLATFORM', ''); return p; },
    async patchPlatform(id, body) { calls.push(`PATCH platform ${id} ${JSON.stringify(body)}`); const p = platforms.get(id)!; Object.assign(p, body); return p; },
  };
  return {
    client, registrations, platforms, calls,
    addRegistration(over = {}) {
      const id = `reg_${++seq}`;
      registrations.set(id, { url: TEST_URLS.moodle, familyCode: 'moodle', version: '5.2.4 (Build: 20261005)', supportedScopes: [], supportedMessages: [], privacyLevel: 'anonymous', operation: 'new', existingPlatformId: null, ...over });
      return id;
    },
    get failNext() { return state.failNext; },
    set failNext(v) { state.failNext = v; },
  };
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

export async function testApp(opts: { limits?: Partial<Limits>; refTtlSeconds?: number } = {}): Promise<TestApp> {
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
  const app = await buildAppApi({
    db, urls: TEST_URLS, logger, store, profile: 'default', knobs: [], now: () => clock.now, ...(opts.limits ? { limits: opts.limits } : {}),
    masterKey: TEST_MASTER_KEY, lti: lti.client, refTtlSeconds: opts.refTtlSeconds ?? 86400,
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
