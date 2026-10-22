// BD-A1-62 (app API delta §8, http_request row): both app listeners log `path` as the matched route template, or
// "<unmatched>" when no route matches; never the raw path, an id or a query. Outside src/content-host on purpose: the
// ADR-008 import fence of that folder also covers its files.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LogLine } from '@cogniate/shared';
import { createLogger } from '@cogniate/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, expect, it } from 'vitest';
import { buildContentApp } from './content-host/server.ts';
import type { TestApp } from './testkit.ts';
import { TEST_CHANNELS, TEST_URLS, testApp } from './testkit.ts';

// A personal value in the path, raw and percent-encoded, and in the query.
const PERSONAL = 'nguyen.van.a@school.test';
const UNKNOWN = [`/no-such-path/${PERSONAL}`, `/app-api/${encodeURIComponent(PERSONAL)}?email=${PERSONAL}`, `/%6Eo-such/${encodeURIComponent('Nguyễn Văn A')}`];

let t: TestApp;
let content: FastifyInstance | undefined;
afterEach(async () => {
  await content?.close();
  content = undefined;
  await t?.app.close();
});

const requestLines = (logs: LogLine[]) => logs.filter((l) => l.event === 'http_request');

it('the app listener logs "<unmatched>" for a path with no route, and the template for a matched route', async () => {
  t = await testApp();
  for (const url of UNKNOWN) expect((await t.app.inject({ method: 'GET', url })).statusCode).toBe(404);
  await t.app.inject({ method: 'GET', url: '/play/ply_personal-id/embedded?x=nguyen' });
  const lines = requestLines(t.logs);
  expect(lines.map((l) => [l.path, l.status])).toEqual([...UNKNOWN.map(() => ['<unmatched>', 404]), ['/play/:playId/embedded', 404]]);
  const text = JSON.stringify(lines);
  for (const value of ['nguyen', 'Nguy', 'school.test', '%40', 'ply_personal-id']) expect(text).not.toContain(value);
});

it('the content listener logs "<unmatched>" for a path with no route, and the template for a matched route', async () => {
  t = await testApp();
  const logs: LogLine[] = [];
  const playerDir = join(t.dataDir, 'player');
  mkdirSync(playerDir, { recursive: true });
  writeFileSync(join(playerDir, 'runtime.js'), 'export {};');
  content = await buildContentApp({ channels: TEST_CHANNELS, logger: createLogger({ service: 'cogniate-content', level: 'debug', write: (l) => logs.push(JSON.parse(l) as LogLine) }),
    urls: TEST_URLS, profile: 'default', knobs: [], outboundAllowlist: [], db: t.db, dataDir: t.dataDir, playerDir, now: () => t.clock.now });
  for (const url of UNKNOWN) expect((await content.inject({ method: 'GET', url })).statusCode).toBe(404);
  await content.inject({ method: 'GET', url: `/rt/${'x'.repeat(43)}/state?learner=${PERSONAL}` });
  const lines = requestLines(logs);
  expect(lines.map((l) => [l.path, l.status])).toEqual([...UNKNOWN.map(() => ['<unmatched>', 404]), ['/rt/:token/state', 404]]);
  const text = JSON.stringify(lines);
  for (const value of ['nguyen', 'Nguy', 'school.test', '%40', 'xxxxxxxx']) expect(text).not.toContain(value);
});
