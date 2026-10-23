import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { recordConnectionEvent } from '../domain/connection-events.ts';
import { createConnection, getConnection, markRegistered } from '../domain/connections.ts';
import type { Db } from '../domain/db.ts';
import { openDb } from '../domain/db.ts';
import { ensureLibrary } from '../domain/libraries.ts';
import { seedAttempt, seedBase, seedLegacyDispatch, seedLink } from '../kernel/records/records.testkit.ts';
import type { TestApp } from '../testkit.ts';
import { QA_B, TEST_CHANNELS, THANH, testApp, testSetupOf } from '../testkit.ts';
import { TOOL_KEYS_CACHE_MS, dispatchErrorCode, readConnectionHealth } from './connection-health.ts';

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 9, 23, 6, 0, 0);
const iso = (ms: number) => new Date(ms).toISOString();

describe('readConnectionHealth (LA-ADR-08 D5)', () => {
  const dirs: string[] = [];
  const dbs: Db[] = [];
  afterEach(() => {
    for (const db of dbs.splice(0)) db.close();
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });
  function database(): Db {
    const dir = mkdtempSync(join(tmpdir(), 'connection-health-'));
    dirs.push(dir);
    const db = openDb(join(dir, 'app.db'));
    dbs.push(db);
    seedBase(db);
    return db;
  }
  /** One dispatch row of a new attempt on placement `link`, then its status fields. */
  function dispatch(db: Db, id: string, link: string, fields: { status: string; created?: number; updated?: number; sent?: number | null; error?: string | null }) {
    seedAttempt(db, id, link);
    db.prepare('UPDATE attempt SET score_given = 50, score_maximum = 100 WHERE id = ?').run(`att_${id}`);
    seedLegacyDispatch(db, { id, attemptId: `att_${id}`, tries: 1, createdAt: fields.created ?? NOW - HOUR, nextTryAt: NOW });
    db.prepare('UPDATE record_dispatch SET status = ?, updated_at = ?, sent_at = ?, last_error = ? WHERE id = ?')
      .run(fields.status, fields.updated ?? fields.created ?? NOW - HOUR, fields.sent ?? null, fields.error ?? null, id);
  }
  const health = (db: Db, activeKid: string | null = 'kid-active') => readConnectionHealth(db, getConnection(db, 'lib', 'con')!, activeKid, NOW);

  it('summarizes the dispatch rows of the connection placements only (AC-LA-E6-02-05)', () => {
    const db = database();
    seedLink(db, 'rl_1');
    dispatch(db, 'p_old', 'rl_1', { status: 'pending', created: NOW - 3 * HOUR });
    dispatch(db, 'p_new', 'rl_1', { status: 'pending', created: NOW - HOUR });
    dispatch(db, 'sent', 'rl_1', { status: 'sent', created: NOW - 5 * HOUR, sent: NOW - 10 * 60_000 });
    dispatch(db, 'failed', 'rl_1', { status: 'failed', created: NOW - 4 * HOUR, updated: NOW - 2 * HOUR, error: '422 PLATFORM_REJECTED_REQUEST: The platform answered 422.' });
    dispatch(db, 'failed_old', 'rl_1', { status: 'failed', created: NOW - 30 * HOUR, updated: NOW - 25 * HOUR, error: '502 PLATFORM_ERROR' });
    // Another connection's rows do not count.
    db.exec(`INSERT INTO connection (id, library_id, name, site_url, method, status, channel, binding_authority, created_at, updated_at)
      VALUES ('con_b', 'lib', 'Other', 'https://other.test', 'manual', 'connected', 'canvas', 'operatorGrant', 0, 0);
      INSERT INTO publication (id, connection_id, course_id, current_version_id, status, created_at, updated_at) VALUES ('pub_b', 'con_b', 'crs', 'ver', 'available', 0, 0);`);
    seedLink(db, 'rl_b', 'con_b', 'pub_b');
    dispatch(db, 'other', 'rl_b', { status: 'failed', created: NOW - 6 * HOUR, updated: NOW - 60_000, error: '401 UNAUTHORIZED' });
    expect(health(db).dispatch).toEqual({
      pending: 2, oldestPendingAt: iso(NOW - 3 * HOUR), lastSentAt: iso(NOW - 10 * 60_000), failedLast24h: 1,
      lastError: { code: 'PLATFORM_REJECTED_REQUEST', at: iso(NOW - 2 * HOUR) },
    });
  });

  it('gives an empty dispatch state without rows', () => {
    expect(health(database()).dispatch).toEqual({ pending: 0, oldestPendingAt: null, lastSentAt: null, failedLast24h: 0, lastError: null });
  });

  it('reads the code of a reporter error text, never the text', () => {
    expect(dispatchErrorCode('422 PLATFORM_REJECTED_REQUEST: The platform answered 422.')).toBe('PLATFORM_REJECTED_REQUEST');
    expect(dispatchErrorCode('no answer LTI_SERVICE_UNREACHABLE: The LTI service did not answer.')).toBe('LTI_SERVICE_UNREACHABLE');
    expect(dispatchErrorCode('409 PLATFORM_CONFLICT (Canvas has a grade with a newer time)')).toBe('PLATFORM_CONFLICT');
    expect(dispatchErrorCode('Temporary error: the app key ring cannot open the service key yet.')).toBeNull();
    expect(dispatchErrorCode('The score confirmation could not finish within the retry window.')).toBeNull();
  });

  it('shows the newest refusal, the last check and the kept events, newest first (AC-LA-E6-02-01 shape)', () => {
    const db = database();
    const add = (kind: 'launch_refused' | 'deep_link_refused' | 'check', code: string, at: number) => recordConnectionEvent(db, { connectionId: 'con', libraryId: 'lib', kind, code, traceId: 't' }, at);
    add('launch_refused', 'lms_mismatch', NOW - 5 * HOUR);
    add('check', 'token:invalid_client', NOW - 4 * HOUR);
    add('deep_link_refused', 'deployment_not_approved', NOW - 3 * HOUR);
    add('launch_refused', 'site_mismatch', NOW - 2 * HOUR);
    add('check', 'ok', NOW - HOUR);
    const h = health(db);
    expect(h.lastLaunchRefusal).toEqual({ reason: 'site_mismatch', at: iso(NOW - 2 * HOUR) });
    expect(h.lastCheck).toEqual({ at: iso(NOW - HOUR), jwks: true, token: true });
    expect(h.events.map((e) => [e.kind, e.code])).toEqual([
      ['check', 'ok'], ['launch_refused', 'site_mismatch'], ['deep_link_refused', 'deployment_not_approved'], ['check', 'token:invalid_client'], ['launch_refused', 'lms_mismatch'],
    ]);
    expect(h.events[0]).toEqual({ kind: 'check', code: 'ok', at: iso(NOW - HOUR) });
    add('check', 'jwks:http_404 token:timeout', NOW - 10);
    expect(health(db).lastCheck).toEqual({ at: iso(NOW - 10), jwks: false, token: false });
  });

  it('compares the exported artifact key id with the active key id (null when unknown)', () => {
    const db = database();
    expect(health(db).keys).toEqual({ activeKid: 'kid-active', nextKid: null, artifactKeyKid: null, artifactKeyCurrent: null });
    db.prepare("UPDATE connection SET artifact_key_kid = 'kid-active' WHERE id = 'con'").run();
    expect(health(db).keys).toMatchObject({ artifactKeyKid: 'kid-active', artifactKeyCurrent: true });
    db.prepare("UPDATE connection SET artifact_key_kid = 'kid-old' WHERE id = 'con'").run();
    expect(health(db).keys).toMatchObject({ artifactKeyKid: 'kid-old', artifactKeyCurrent: false });
    expect(health(db, null).keys).toEqual({ activeKid: null, nextKid: null, artifactKeyKid: 'kid-old', artifactKeyCurrent: null });
  });

  it('shows the status and the last launch time of the connection', () => {
    const db = database();
    db.prepare("UPDATE connection SET last_launch_at = ? WHERE id = 'con'").run(NOW - 7 * HOUR);
    const h = health(db);
    expect([h.status, h.lastLaunchAt, h.lastLaunchRefusal, h.lastCheck, h.events]).toEqual(['connected', iso(NOW - 7 * HOUR), null, null, []]);
  });
});

describe('GET /app-api/connections/:id/health', () => {
  let t: TestApp;
  let cookie: string;
  beforeEach(async () => {
    t = await testApp();
    cookie = await t.login(THANH);
  });
  afterEach(async () => { await t?.app.close(); });
  function registered(library = THANH.library) {
    const lib = ensureLibrary(t.db, library, t.clock.now);
    const c = createConnection(t.db, lib.id, { name: 'School', siteUrl: 'https://school-a.canvas.sim.test', method: 'manual', channel: 'canvas', profile: 'canvas-sim-cloud' },
      null, t.clock.now, TEST_CHANNELS, testSetupOf('canvas')!.sharingOf);
    markRegistered(t.db, c.id, { id: `plt_${c.id}`, issuer: 'https://canvas.sim.test', clientId: 'client', deploymentIds: ['d1'], productFamilyCode: 'canvas' }, t.clock.now);
    return c;
  }
  const get = (id: string) => t.app.inject({ method: 'GET', url: `/app-api/connections/${id}/health`, headers: { cookie } });
  const keyReads = () => t.lti.calls.filter((call) => call === 'GET tool keys').length;

  it("answers 404 for another library's connection (AC-LA-E6-02-04)", async () => {
    const other = registered(QA_B.library);
    const res = await get(other.id);
    expect([res.statusCode, res.json().details.message]).toEqual([404, 'NOT_FOUND']);
  });

  it('answers the health with the active key id, and reads the tool JWKS at most once per 60 s', async () => {
    const c = registered();
    const res = await get(c.id);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      status: 'registered', lastLaunchAt: null, lastLaunchRefusal: null,
      dispatch: { pending: 0, oldestPendingAt: null, lastSentAt: null, failedLast24h: 0, lastError: null },
      keys: { activeKid: 'kid-1', nextKid: null, artifactKeyKid: null, artifactKeyCurrent: null }, lastCheck: null, events: [],
    });
    await get(c.id);
    expect(keyReads()).toBe(1);
    t.clock.now += TOOL_KEYS_CACHE_MS;
    await get(c.id);
    expect(keyReads()).toBe(2);
  });

  it('keeps answering when the tool JWKS cannot be read', async () => {
    const c = registered();
    t.db.prepare('UPDATE connection SET artifact_key_kid = ? WHERE id = ?').run('kid-1', c.id);
    t.lti.client.getToolKeys = async () => { throw new Error('down'); };
    const res = await get(c.id);
    expect(res.statusCode).toBe(200);
    expect(res.json().keys).toEqual({ activeKid: null, nextKid: null, artifactKeyKid: 'kid-1', artifactKeyCurrent: null });
    expect(t.logs.some((line) => line.event === 'tool_keys_unavailable')).toBe(true);
  });

  it('shows a stale key after a real inline export and a newer active key; a URL export clears the kid (LA-E6-05 writer)', async () => {
    const c = registered();
    let active = 'kid-a';
    t.lti.client.getToolKeys = async () => [{ kty: 'RSA', kid: active, alg: 'RS256', use: 'sig', n: 'modulus', e: 'AQAB' }];
    const exportJson = (form: 'inline' | 'url') => t.app.inject({ method: 'GET', url: `/app-api/connections/${c.id}/canvas-configuration?jwk=${form}`, headers: { cookie } });
    expect((await exportJson('inline')).statusCode).toBe(200);
    expect((await get(c.id)).json().keys).toEqual({ activeKid: 'kid-a', nextKid: null, artifactKeyKid: 'kid-a', artifactKeyCurrent: true });
    // A signing key activation: after the 60 s cache the active key is kid-b, and the exported JSON still has kid-a.
    active = 'kid-b';
    t.clock.now += TOOL_KEYS_CACHE_MS;
    expect((await get(c.id)).json().keys).toEqual({ activeKid: 'kid-b', nextKid: null, artifactKeyKid: 'kid-a', artifactKeyCurrent: false });
    expect((await exportJson('url')).statusCode).toBe(200);
    expect((await get(c.id)).json().keys).toEqual({ activeKid: 'kid-b', nextKid: null, artifactKeyKid: null, artifactKeyCurrent: null });
  });

  it('shows the last connection check after POST /check (the LA-E6-01 writer call)', async () => {
    const c = registered();
    t.lti.client.checkPlatform = async () => ({ checkedAt: 'x', jwks: { ok: true, keys: 1 }, token: { ok: false, detail: 'invalid_client' }, platform: { active: true, deploymentActive: true }, limits: null });
    const check = await t.app.inject({ method: 'POST', url: `/app-api/connections/${c.id}/check`, headers: t.writeHeaders(cookie) });
    expect(check.statusCode).toBe(200);
    const res = (await get(c.id)).json();
    expect(res.lastCheck).toEqual({ at: iso(t.clock.now), jwks: true, token: false });
    expect(res.events).toEqual([{ kind: 'check', code: 'token:invalid_client', at: iso(t.clock.now) }]);
  });
});
