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

export interface TestApp {
  app: FastifyInstance;
  db: Db;
  store: StorePaths;
  dataDir: string;
  logs: LogLine[];
  clock: { now: number };
  /** Sign in and return the Cookie header value. */
  login: (user: { email: string; password: string }) => Promise<string>;
  /** Headers of a write from the app origin, with the session cookie. */
  writeHeaders: (cookie: string) => Record<string, string>;
}

export async function testApp(opts: { limits?: Partial<Limits> } = {}): Promise<TestApp> {
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
  const app = await buildAppApi({
    db, urls: TEST_URLS, logger, store, profile: 'default', knobs: [], now: () => clock.now, ...(opts.limits ? { limits: opts.limits } : {}),
  });
  const login = async (user: { email: string; password: string }): Promise<string> => {
    const res = await app.inject({ method: 'POST', url: '/app-api/session', headers: { origin: TEST_URLS.app }, payload: { email: user.email, password: user.password } });
    if (res.statusCode !== 204) throw new Error(`login failed: ${res.statusCode}`);
    return String(res.headers['set-cookie']).split(';')[0]!;
  };
  return { app, db, store, dataDir, logs, clock, login, writeHeaders: (cookie) => ({ cookie, origin: TEST_URLS.app }) };
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
