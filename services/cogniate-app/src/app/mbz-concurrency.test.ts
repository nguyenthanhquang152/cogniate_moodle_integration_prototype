import { mkdirSync, readdirSync, rmdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeZip, scormManifest } from '@cogniate/package-inspector/testing';
import { afterEach, describe, expect, it } from 'vitest';
import type { TestApp } from '../testkit.ts';
import { THANH, formBody, queueDir, testApp } from '../testkit.ts';
// Frozen build queue limits (ADR-007); assertions drive the real HTTP exporter.
const MAX_ACTIVE_BUILDS_PER_LIBRARY = 2;
const STALE_BUILD_MS = 10 * 60_000;

let t: TestApp;
afterEach(async () => {
  await t?.app.close();
});

async function versionUrl(cookie: string, title: string): Promise<string> {
  const course = await t.app.inject({
    method: 'POST', url: '/app-api/courses', headers: t.writeHeaders(cookie), payload: { title },
  });
  expect(course.statusCode).toBe(201);
  const courseId = course.json().id as string;
  const body = await formBody({ package: makeZip([
    { name: 'imsmanifest.xml', data: scormManifest({ mastery: '70' }) },
    { name: 'index.html', data: '<html><body>SCORM course</body></html>' },
  ]) });
  const version = await t.app.inject({
    method: 'POST', url: `/app-api/courses/${courseId}/versions`,
    headers: { ...t.writeHeaders(cookie), ...body.headers }, payload: body.payload,
  });
  expect(version.statusCode).toBe(201);
  return `/app-api/courses/${courseId}/versions/${version.json().id as string}/mbz`;
}

const post = (url: string, cookie: string) => t.app.inject({ method: 'POST', url, headers: t.writeHeaders(cookie) });

describe('C-T8-01: reserve builds before asynchronous queue writes', () => {
  it('parallel requests for one version return the same build and queue only one request', async () => {
    t = await testApp();
    const cookie = await t.login(THANH);
    const url = await versionUrl(cookie, 'One version');
    const answers = await Promise.all([post(url, cookie), post(url, cookie)]);
    expect(answers.map((r) => r.statusCode)).toEqual([202, 202]);
    const ids = answers.map((r) => r.json().buildId as string);
    expect(ids[1]).toBe(ids[0]);
    expect(t.db.prepare('SELECT id FROM mbz_build').all()).toEqual([{ id: ids[0] }]);
    expect(readdirSync(join(queueDir(t.dataDir), 'requests'))).toEqual([`${ids[0]}.json`]);
  });

  it('parallel requests for different versions cannot exceed the library build limit', async () => {
    t = await testApp();
    const cookie = await t.login(THANH);
    const urls: string[] = [];
    for (let i = 0; i <= MAX_ACTIVE_BUILDS_PER_LIBRARY; i++) urls.push(await versionUrl(cookie, `Version ${i}`));
    const answers = await Promise.all(urls.map((url) => post(url, cookie)));
    const accepted = answers.filter((r) => r.statusCode === 202);
    const refused = answers.filter((r) => r.statusCode !== 202);
    expect(accepted).toHaveLength(MAX_ACTIVE_BUILDS_PER_LIBRARY);
    expect(refused.map((r) => [r.statusCode, r.json().details.message])).toEqual([[409, 'MBZ_BUILD_LIMIT']]);
    const active = t.db.prepare("SELECT id FROM mbz_build WHERE status IN ('queued', 'running')").all();
    expect(active).toHaveLength(MAX_ACTIVE_BUILDS_PER_LIBRARY);
    expect(readdirSync(join(queueDir(t.dataDir), 'requests')).sort()).toEqual(
      accepted.map((r) => `${r.json().buildId as string}.json`).sort(),
    );
  });

  it('parallel retries of a stale running build do not fail or duplicate the new reservation', async () => {
    t = await testApp();
    const cookie = await t.login(THANH);
    const url = await versionUrl(cookie, 'Retry stale build');
    const oldId = (await post(url, cookie)).json().buildId as string;
    writeFileSync(join(queueDir(t.dataDir), 'status', `${oldId}.json`), JSON.stringify({
      status: 'running', step: 'backup', updatedAt: new Date(t.clock.now).toISOString(),
    }));
    t.clock.now += STALE_BUILD_MS + 1;
    const answers = await Promise.all([post(url, cookie), post(url, cookie)]);
    expect(answers.map((r) => r.statusCode)).toEqual([202, 202]);
    const newId = answers[0]!.json().buildId as string;
    expect(newId).not.toBe(oldId);
    expect(answers[1]!.json().buildId).toBe(newId);
    expect(t.db.prepare('SELECT id, status FROM mbz_build ORDER BY rowid').all()).toEqual([
      { id: oldId, status: 'failed' }, { id: newId, status: 'queued' },
    ]);
  });

  it('a queue write failure marks the reservation failed and allows an immediate retry', async () => {
    t = await testApp();
    const cookie = await t.login(THANH);
    const url = await versionUrl(cookie, 'Retry after failed write');
    const requestsDir = join(queueDir(t.dataDir), 'requests');
    rmdirSync(requestsDir);
    expect((await post(url, cookie)).statusCode).toBe(500);
    const failed = t.db.prepare('SELECT id, status, reason, finished_at FROM mbz_build').all();
    expect(failed).toEqual([{
      id: expect.stringMatching(/^bld_[0-9a-f]{24}$/), status: 'failed',
      reason: 'The build request could not be written. Build again.', finished_at: t.clock.now,
    }]);
    mkdirSync(requestsDir);
    const retry = await post(url, cookie);
    expect(retry.statusCode).toBe(202);
    expect(retry.json().buildId).not.toBe(failed[0]!.id);
    expect(readdirSync(requestsDir)).toEqual([`${retry.json().buildId as string}.json`]);
    expect(t.db.prepare("SELECT COUNT(*) AS n FROM mbz_build WHERE status IN ('queued', 'running')").get()?.n).toBe(1);
  });
});
