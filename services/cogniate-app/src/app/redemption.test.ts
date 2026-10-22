import { seedLegacyDispatch } from '../kernel/records/records.testkit.ts';
import { TEST_CHANNELS } from '../testkit.ts';
// The common grant redemption and cleanup engine (app contract §4.7 to §4.9, ADR-011 §4a, §4b), unit level: the fake
// LTI service models deployments, binding refs, generations and the M3 §3.3 fault actions (fail_before, drop_after,
// late write, live schedules). Black-box evidence is QA's (AC-M1-28, -29, -37, -38).
import { EventEmitter } from 'node:events';
import type { ClientRequest } from 'node:http';
import { createLogger, createOutboundClient } from '@cogniate/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLtiClient, LtiServiceError } from '../clients/lti-client.ts';
import type { LtiIdToken } from '../clients/lti-client.ts';
import { getGrant, grantsOfConnection, insertGrant, reservationOfConnection } from '../domain/bindings.ts';
import { getConnectionAnyLibrary } from '../domain/connections.ts';
import type { TestApp } from '../testkit.ts';
import { INSTRUCTOR, LEARNER, QA_B, TEST_URLS, THANH, testApp } from '../testkit.ts';
import { createBindingCleanup } from './binding-cleanup.ts';
import { createOperator } from './operator.ts';
import { createRedemptionEngine } from './redemption.ts';

const LEARN_A = 'https://learn-a.blackboard.sim.test';
const LEARN_B = 'https://learn-b.blackboard.sim.test';
const SCHOOL_A = 'https://school-a.canvas.sim.test';
const BB = 'qa-bb-app';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

let t: TestApp;
afterEach(async () => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); await t?.app.close(); });

/** A Moodle web services client that must never be called for another LMS (no outbound call). */
const noWs = { allowlist: [], request: async () => { throw new Error('web services called'); } };

async function setup() {
  t = await testApp({ outbound: noWs });
  const shared = t.lti.addSharedPlatform('blackboard-sim', BB);
  const logger = createLogger({ service: 'cogniate-app', level: 'debug', write: (l) => t.logs.push(JSON.parse(l)) });
  const cleanup = createBindingCleanup({ db: t.db, lti: t.lti.client, logger, now: () => t.clock.now });
  const op = createOperator({ channels: TEST_CHANNELS, db: t.db, lti: t.lti.client, logger, cleanup, now: () => t.clock.now });
  const a = await t.login(THANH);
  const b = await t.login(QA_B);
  const libraryOf = (name: string) => String(t.db.prepare('SELECT id FROM library WHERE name = ?').get(name)!.id);
  return { shared, op, a, b, libA: libraryOf(THANH.library), libB: libraryOf(QA_B.library) };
}

async function call(method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, cookie: string, payload?: unknown, traceId?: string) {
  const headers = { ...(method === 'GET' ? { cookie } : t.writeHeaders(cookie)), ...(traceId ? { 'x-trace-id': traceId } : {}) };
  const res = await t.app.inject({ method, url, headers, ...(payload !== undefined ? { payload: payload as Json } : {}) });
  return { status: res.statusCode, json: (res.body ? res.json() : null) as Json };
}
const code = (r: { json: Json }) => r.json?.details?.message;

async function bbConnection(cookie: string, site = LEARN_A) {
  const r = await call('POST', '/app-api/connections', cookie, { name: 'Learn', siteUrl: site, method: 'manual', lms: 'blackboard', profile: 'blackboard-sim' });
  expect(r.status).toBe(201);
  return r.json;
}

async function canvasConnection(cookie: string, siteUrl = SCHOOL_A, serviceUrl?: string) {
  const r = await call('POST', '/app-api/connections', cookie, { name: 'Canvas', siteUrl, method: 'manual', lms: 'canvas', profile: 'canvas-sim-cloud', ...(serviceUrl ? { serviceUrl } : {}) });
  expect(r.status).toBe(201);
  return r.json;
}

type Op = Awaited<ReturnType<typeof setup>>['op'];
async function grant(op: Op, lib: string, con: Json, deploymentId: string, over: Partial<Parameters<Op['issue']>[0]> = {}) {
  const r = await op.issue({ library: lib, connection: con.id, site: con.siteUrl, clientId: con.lms === 'blackboard' ? BB : 'cA', deploymentId, note: 'ticket-1', traceId: 't', ...over });
  expect(r.exitCode, r.lines.join('\n')).toBe(0);
  const codeLine = r.lines.find((l) => l.startsWith('Approval code'))!;
  return { code: codeLine.split(': ')[1]!, id: r.lines.find((l) => l.startsWith('Grant id'))!.split(': ')[1]!, lines: r.lines };
}

const putBb = (cookie: string, con: Json, deploymentId: string, grantCode: string) => call('PUT', `/app-api/connections/${con.id}/platform`, cookie, { deploymentId, grantCode });
const putCanvas = (cookie: string, con: Json, deploymentId: string, grantCode: string, clientId = 'cA') => call('PUT', `/app-api/connections/${con.id}/platform`, cookie, { clientId, deploymentId, grantCode });
const deployment = (platformId: string, d: string) => t.lti.platforms.get(platformId)!.deployments.find((x) => x.deploymentId === d);
const events = (name: string) => t.logs.filter((l) => l.event === name);

/** A signed launch as GET /api/idtoken answers it (M1 fields), and the /tool/launch answer. */
async function bbLaunch(platformId: string, deploymentId: string, site = LEARN_A, roles = [LEARNER], over: Partial<LtiIdToken['platform']> = {}) {
  const token: LtiIdToken = {
    user: { id: 'u-1', roles },
    platform: { id: platformId, url: 'https://blackboard.sim.test', deploymentId, siteUrl: site, serviceUrl: site, profile: 'blackboard-sim', productFamilyCode: 'BlackboardLearn', ...over },
    launch: { type: 'LtiResourceLinkRequest', target: `${TEST_URLS.lti}/lti/launch/cogniate?resource=pub_x`, context: { id: 'c1', title: 'Course' }, resourceLink: { id: 'rl1', title: 'Item' } },
  };
  return t.app.inject({ method: 'GET', url: `/tool/launch?ltik=${t.lti.addLaunch(token)}` });
}

describe('grants and Blackboard redemption (§4.7.1, §4.8; AC-M1-28, -29 unit level)', () => {
  it('issue prints the bound values once; PUT redeems: reservation, deployment active generation 1, approval, registered; a repeat changes nothing', async () => {
    const { shared, op, a, libA } = await setup();
    const con = await bbConnection(a);
    expect(con).toMatchObject({ lms: 'blackboard', profile: 'blackboard-sim', status: 'pending', method: 'manual', serviceUrl: LEARN_A,
      capabilities: { dynamicRegistration: false, operatorApproval: true, webServices: false, courseShell: false, addDeployment: false, canvasConfiguration: false } });
    const g = await grant(op, libA, con, 'dA');
    expect(g.lines.slice(0, 8)).toEqual([expect.stringContaining("Thanh's Library"), 'Connection: Learn (' + con.id + ')', 'LMS profile: blackboard blackboard-sim',
      'Purpose: initial', `Site URL: ${LEARN_A}`, `Service URL: ${LEARN_A}`, `Client ID: ${BB}`, 'Deployment ID: dA']);
    expect(g.code).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(op.list(con.id).lines[0]).toContain(' issued');
    const r = await putBb(a, con, 'dA', g.code);
    expect([r.status, r.json.status, r.json.platform.deploymentIds, r.json.platform.siteUrl]).toEqual([200, 'registered', ['dA'], LEARN_A]);
    expect(deployment(shared.id, 'dA')).toMatchObject({ active: true, bindingGeneration: 1, siteUrl: LEARN_A });
    expect(events('grant_redeemed')).toHaveLength(1);
    expect(events('grant_redeemed')[0]).toMatchObject({ grant_id: g.id, connection_id: con.id, purpose: 'initial', platform_id: shared.id, deployment_id: 'dA' });
    expect(op.list(con.id).lines[0]).toContain(' redeemed');
    expect(reservationOfConnection(t.db, con.id)).toMatchObject({ platformId: shared.id, deploymentId: 'dA' });
    const again = await putBb(a, con, 'dA', g.code);
    expect([again.status, events('grant_redeemed').length]).toEqual([200, 1]);
    // The code appears in no log line and no API answer after the CLI output.
    expect(JSON.stringify(t.logs)).not.toContain(g.code);
    expect(JSON.stringify(r.json)).not.toContain(g.code);
    // The app never sent PATCH or DELETE to the shared platform (the fake throws if it does).
    expect(t.lti.calls.filter((c) => c.startsWith(`PATCH platform ${shared.id}`) || c.startsWith(`DELETE platform ${shared.id}`))).toEqual([]);
  });

  it('a new grant for the same connection and purpose revokes the older unredeemed one', async () => {
    const { op, a, libA } = await setup();
    const con = await bbConnection(a);
    const g1 = await grant(op, libA, con, 'dA');
    await grant(op, libA, con, 'dA');
    expect(getGrant(t.db, g1.id)).toMatchObject({ revokedReason: 'replaced' });
    expect(op.list(con.id).lines[0]).toContain(' revoked');
    expect([(await putBb(a, con, 'dA', g1.code)).status]).toEqual([403]);
  });

  it('negative cases: strict body, invalid, other library or connection, mismatch, replay, expiry, revoke, in use, fixed', async () => {
    const { shared, op, a, b, libA, libB } = await setup();
    const conA = await bbConnection(a);
    const conB = await bbConnection(b, LEARN_B);
    const g = await grant(op, libA, conA, 'dA');
    const fields = async (body: Json) => (await call('PUT', `/app-api/connections/${conA.id}/platform`, a, body)).json.details;
    expect(await fields({ deploymentId: 'dA' })).toMatchObject({ message: 'INVALID_PLATFORM_VALUES', fields: ['grantCode'] });
    expect((await fields({ deploymentId: 'dA', grantCode: g.code, jwksUrl: 'x' })).fields).toEqual(['jwksUrl']);
    expect((await fields({ deploymentId: 'dA', grantCode: g.code, clientSecret: 'x' })).fields).toEqual(['clientSecret']);
    expect((await fields({ deploymentId: 'dA', grantCode: g.code, clientId: 'other' })).fields).toEqual(['clientId']);
    // (b) squatting: B uses A's code on its own connection -> 403; no LTI record changes.
    expect(code(await putBb(b, conB, 'dA', g.code))).toBe('GRANT_INVALID');
    expect(deployment(shared.id, 'dA')).toBeUndefined();
    // (d) another connection of the same library
    const conA2 = await bbConnection(a, 'https://learn-c.blackboard.sim.test');
    expect(code(await putBb(a, conA2, 'dA', g.code))).toBe('GRANT_INVALID');
    // (e) mismatch keeps the grant usable
    const mm = await putBb(a, conA, 'dZ', g.code);
    expect([mm.status, code(mm), mm.json.details.fields]).toEqual([422, 'GRANT_MISMATCH', ['deploymentId']]);
    expect(getGrant(t.db, g.id)?.redeemedAt).toBeNull();
    expect((await putBb(a, conA, 'dA', g.code)).status).toBe(200);
    // (f) replay on another pending connection of the same library
    expect(code(await putBb(a, conA2, 'dA', g.code))).toBe('GRANT_INVALID');
    // (g) expired: 60 s grant used 63 s later
    const gB = await grant(op, libB, conB, 'dB', { ttlSeconds: 60 });
    t.clock.now += 63_000;
    expect(code(await putBb(b, conB, 'dB', gB.code))).toBe('GRANT_INVALID');
    expect(op.list(conB.id).lines.at(-1)).toContain(' expired');
    // (h) revoked
    const gB2 = await grant(op, libB, conB, 'dB');
    expect((await op.revoke(gB2.id, 't')).exitCode).toBe(0);
    expect(code(await putBb(b, conB, 'dB', gB2.code))).toBe('GRANT_INVALID');
    // (j) a valid grant for a new library-A connection with B's deployment -> 409 DEPLOYMENT_IN_USE, grant stays issued
    const gB3 = await grant(op, libB, conB, 'dB');
    expect((await putBb(b, conB, 'dB', gB3.code)).status).toBe(200);
    const conA3 = await bbConnection(a, LEARN_B);
    const gA3 = await grant(op, libA, conA3, 'dB');
    expect(code(await putBb(a, conA3, 'dB', gA3.code))).toBe('DEPLOYMENT_IN_USE');
    expect(getGrant(t.db, gA3.id)).toMatchObject({ redeemedAt: null, revokedAt: null });
    // (m) precise reasons, never in the answer
    expect(events('grant_rejected').map((l) => l.reason)).toEqual(expect.arrayContaining(['other_connection', 'mismatch', 'redeemed', 'expired', 'revoked']));
    // DEPLOYMENT_FIXED: defensive branch, reachable only with a grant for another id (the CLI refuses to issue it).
    const conA4 = await bbConnection(a, 'https://learn-d.blackboard.sim.test');
    t.lti.faults.push({ op: 'POST deployment', action: 'fail_before' });
    const gA4 = await grant(op, libA, conA4, 'dX');
    expect((await putBb(a, conA4, 'dX', gA4.code)).status).toBe(502);
    const refused = await op.issue({ library: libA, connection: conA4.id, site: conA4.siteUrl, clientId: BB, deploymentId: 'dY', note: 'x', traceId: 't' });
    expect(refused.exitCode).toBe(1);
    insertGrant(t.db, { libraryId: libA, connectionId: conA4.id, channel: 'blackboard', profile: 'blackboard-sim', purpose: 'initial', siteUrl: conA4.siteUrl,
      serviceUrl: conA4.siteUrl, clientId: BB, deploymentId: 'dY', note: 'x', expiresAt: t.clock.now + 60_000 }, (await import('@cogniate/shared')).sha256Hex('Y'.repeat(43)), t.clock.now);
    expect(code(await putBb(a, conA4, 'dY', 'Y'.repeat(43)))).toBe('DEPLOYMENT_FIXED');
  });

  it('CLI refusals (k): library, site, client id, reserved deployment, initial for registered, ttl, Moodle', async () => {
    const { op, a, b, libA, libB } = await setup();
    const con = await bbConnection(a);
    const base = { library: libA, connection: con.id, site: LEARN_A, clientId: BB, deploymentId: 'dA', note: 'n', traceId: 't' };
    for (const over of [{ library: libB }, { site: LEARN_B }, { site: 'HTTPS://Learn-B.Blackboard.Sim.Test:443/' }, { clientId: 'other' }, { ttlSeconds: 30 }, { note: '' }]) {
      expect((await op.issue({ ...base, ...over })).exitCode).toBe(1);
    }
    expect((await op.issue({ ...base, site: 'HTTPS://Learn-A.Blackboard.Sim.Test:443/' })).exitCode).toBe(0);
    const moodle = await call('POST', '/app-api/connections', b, { name: 'M', siteUrl: TEST_URLS.moodle, method: 'manual' });
    expect((await op.issue({ ...base, library: libB, connection: moodle.json.id, site: TEST_URLS.moodle })).exitCode).toBe(1);
    expect(grantsOfConnection(t.db, moodle.json.id)).toEqual([]);
  });
});

describe('redemption faults and races (§4.7.1 outcome table; AC-M1-37 unit level)', () => {
  it('(a) S1 fails before it writes: 502, reservation kept; the same grant then works (one deployment, generation 1)', async () => {
    const { shared, op, a, libA } = await setup();
    const con = await bbConnection(a);
    const g = await grant(op, libA, con, 'dA');
    t.lti.faults.push({ op: 'POST deployment', action: 'fail_before' });
    expect(code(await putBb(a, con, 'dA', g.code))).toBe('LTI_SERVICE_ERROR');
    expect([getConnectionAnyLibrary(t.db, con.id)?.status, reservationOfConnection(t.db, con.id)?.deploymentId]).toEqual(['pending', 'dA']);
    expect((await putBb(a, con, 'dA', g.code)).status).toBe(200);
    expect(t.lti.platforms.get(shared.id)!.deployments.map((d) => [d.deploymentId, d.active, d.bindingGeneration])).toEqual([['dA', true, 1]]);
  });

  it('(b) S1 answer lost: the inactive deployment (generation 0) is adopted by the retry (A2), generation 1', async () => {
    const { shared, op, a, libA } = await setup();
    const con = await bbConnection(a);
    const g = await grant(op, libA, con, 'dA');
    t.lti.faults.push({ op: 'POST deployment', action: 'drop_after' });
    expect((await putBb(a, con, 'dA', g.code)).status).toBe(502);
    expect(deployment(shared.id, 'dA')).toMatchObject({ active: false, bindingGeneration: 0 });
    expect((await putBb(a, con, 'dA', g.code)).status).toBe(200);
    expect(t.lti.platforms.get(shared.id)!.deployments).toHaveLength(1);
    expect(deployment(shared.id, 'dA')).toMatchObject({ active: true, bindingGeneration: 1 });
  });

  it('(c2)/(i) an active record without approval has no authority; the same grant then commits (generation + 1)', async () => {
    const { shared, op, a, libA } = await setup();
    const con = await bbConnection(a);
    const g = await grant(op, libA, con, 'dA');
    t.lti.faults.push({ op: 'PATCH deployment', action: 'late' });
    expect((await putBb(a, con, 'dA', g.code)).status).toBe(502);
    expect(t.lti.lateWrites.shift()!()).toBe(200); // the late S3 activates: nothing changed the record
    expect(deployment(shared.id, 'dA')).toMatchObject({ active: true, bindingGeneration: 1 });
    const launch = await bbLaunch(shared.id, 'dA');
    expect(launch.body).toContain('data-error-code="UNKNOWN_PLATFORM"');
    expect(events('launch_rejected').at(-1)).toMatchObject({ reason: 'deployment_not_approved', platform_id: shared.id, deployment_id: 'dA' });
    expect((await putBb(a, con, 'dA', g.code)).status).toBe(200);
    expect(deployment(shared.id, 'dA')?.bindingGeneration).toBe(2);
  });

  it('(d) a live lease of a dead handler: 409 GRANT_IN_USE before 60 s, then the old attempt is abandoned and the retry works', async () => {
    const { op, a, libA } = await setup();
    const con = await bbConnection(a);
    const g = await grant(op, libA, con, 'dA');
    t.db.prepare("INSERT INTO binding_attempt (attempt_id, seq, connection_id, grant_id, purpose, lti_profile, issuer, client_id, deployment_id, history_floor, state, started_at) VALUES ('att_dead', 99, ?, ?, 'initial', 'blackboard-sim', 'x', ?, 'dA', 0, 'open', ?)")
      .run(con.id, g.id, BB, t.clock.now);
    t.db.prepare('UPDATE connection SET redeeming_attempt = ?, redeeming_since = ? WHERE id = ?').run('att_dead', t.clock.now, con.id);
    expect(code(await putBb(a, con, 'dA', g.code))).toBe('GRANT_IN_USE');
    t.clock.now += 59_999;
    expect(code(await putBb(a, con, 'dA', g.code))).toBe('GRANT_IN_USE');
    t.clock.now += 1;
    expect((await putBb(a, con, 'dA', g.code)).status).toBe(200);
    expect(t.db.prepare("SELECT state FROM binding_attempt WHERE attempt_id = 'att_dead'").get()?.state).toBe('abandoned');
  });

  it('(e) revoke during a live call: 403, the record is switched off with a new ref, the grant is revoked; a new grant works', async () => {
    const { shared, op, a, libA } = await setup();
    const con = await bbConnection(a);
    const g = await grant(op, libA, con, 'dA');
    let revokeLines: string[] = [];
    t.lti.faults.push({ op: 'PATCH deployment', action: 'after', run: async () => { revokeLines = (await op.revoke(g.id, 't')).lines; } });
    expect(code(await putBb(a, con, 'dA', g.code))).toBe('GRANT_INVALID');
    expect(revokeLines.join(' ')).toContain('a running redemption will cancel');
    expect(events('grant_redemption_cancelled').at(-1)).toMatchObject({ reason: 'revoked' });
    expect(deployment(shared.id, 'dA')?.active).toBe(false);
    expect(op.list(con.id).lines[0]).toContain(' revoked');
    const g2 = await grant(op, libA, con, 'dA');
    expect((await putBb(a, con, 'dA', g2.code)).status).toBe(200);
  });

  it('(f) replacement during a live call: the replacement first gets 409 GRANT_IN_USE, the old request 403 (replaced), then the replacement works', async () => {
    const { shared, op, a, libA } = await setup();
    const con = await bbConnection(a);
    const g = await grant(op, libA, con, 'dA');
    let during: number | undefined;
    t.lti.faults.push({ op: 'PATCH deployment', action: 'after', run: async () => {
      const g2 = await grant(op, libA, con, 'dA');
      during = (await putBb(a, con, 'dA', g2.code)).status;
      (globalThis as Json).replacement = g2.code;
    } });
    expect(code(await putBb(a, con, 'dA', g.code))).toBe('GRANT_INVALID');
    expect(during).toBe(409);
    expect(events('grant_redemption_cancelled').at(-1)).toMatchObject({ reason: 'replaced' });
    expect((await putBb(a, con, 'dA', (globalThis as Json).replacement)).status).toBe(200);
    expect(t.lti.platforms.get(shared.id)!.deployments).toHaveLength(1);
  });

  it('(g) DELETE during a live call: 204 and the record is inactive; the request answers 409 CONNECTION_NOT_PENDING; the grant is revoked', async () => {
    const { shared, op, a, libA } = await setup();
    const con = await bbConnection(a);
    const g = await grant(op, libA, con, 'dA');
    let deleted = 0;
    t.lti.faults.push({ op: 'PATCH deployment', action: 'after', run: async () => { deleted = (await call('DELETE', `/app-api/connections/${con.id}`, a)).status; } });
    expect(code(await putBb(a, con, 'dA', g.code))).toBe('CONNECTION_NOT_PENDING');
    expect(deleted).toBe(204);
    expect(deployment(shared.id, 'dA')?.active).toBe(false);
    expect(getGrant(t.db, g.id)?.revokedReason).toBe('disconnect');
  });

  it('(j) two parallel PUTs with the same grant: one record and one grant_redeemed', async () => {
    const { shared, op, a, libA } = await setup();
    const con = await bbConnection(a);
    const g = await grant(op, libA, con, 'dA');
    const answers = await Promise.all([putBb(a, con, 'dA', g.code), putBb(a, con, 'dA', g.code)]);
    // The other answer is 409 GRANT_IN_USE, or 200 when it ran as a repeat after the first finished (§4.7.1 (j)).
    expect([[200, 200], [200, 409]]).toContainEqual(answers.map((r) => r.status).sort());
    expect(events('grant_redeemed')).toHaveLength(1);
    expect(t.lti.platforms.get(shared.id)!.deployments).toHaveLength(1);
  });

  it('(k) cancel a pending connection after S1 failed (absent) and after a lost S1 answer (fenced); grants revoked', async () => {
    const { shared, op, a, libA } = await setup();
    const c1 = await bbConnection(a);
    const g1 = await grant(op, libA, c1, 'dA');
    t.lti.faults.push({ op: 'POST deployment', action: 'fail_before' });
    await putBb(a, c1, 'dA', g1.code);
    expect((await call('DELETE', `/app-api/connections/${c1.id}`, a)).status).toBe(204);
    expect(events('binding_fenced').at(-1)).toMatchObject({ result: 'absent' });
    const c2 = await bbConnection(a, LEARN_B);
    const g2 = await grant(op, libA, c2, 'dB');
    t.lti.faults.push({ op: 'POST deployment', action: 'drop_after' });
    await putBb(a, c2, 'dB', g2.code);
    const before = deployment(shared.id, 'dB')!.bindingRef;
    expect((await call('DELETE', `/app-api/connections/${c2.id}`, a)).status).toBe(204);
    expect(events('binding_fenced').at(-1)).toMatchObject({ result: 'fenced' });
    expect(deployment(shared.id, 'dB')).toMatchObject({ active: false });
    expect(deployment(shared.id, 'dB')!.bindingRef).not.toBe(before);
    expect(getGrant(t.db, g2.id)?.revokedReason).toBe('disconnect');
  });

  it('(m) compensation failure: grant_compensation_failed, active without approval; revoke again fences it', async () => {
    const { shared, op, a, libA } = await setup();
    const con = await bbConnection(a);
    const g = await grant(op, libA, con, 'dA');
    t.lti.faults.push({ op: 'PATCH deployment', action: 'after', run: () => op.revoke(g.id, 't') });
    t.lti.faults.push({ op: 'PATCH deployment', action: 'fail_before' });
    // The first rule matches S3; the second (fail_before) matches the compensation.
    t.lti.faults.sort((x) => (x.action === 'after' ? -1 : 1));
    expect(code(await putBb(a, con, 'dA', g.code))).toBe('GRANT_INVALID');
    expect(events('grant_compensation_failed')).toHaveLength(1);
    expect(deployment(shared.id, 'dA')?.active).toBe(true);
    expect((await bbLaunch(shared.id, 'dA')).body).toContain('UNKNOWN_PLATFORM');
    const again = await op.revoke(g.id, 't');
    expect([again.exitCode, again.lines.at(-1)]).toEqual([0, `fenced platform=${shared.id} deployment=dA`]);
    expect(deployment(shared.id, 'dA')?.active).toBe(false);
  });

  it('(n) a stale compensation never switches off the replacement binding', async () => {
    const { shared, op, a, libA } = await setup();
    const con = await bbConnection(a);
    const g = await grant(op, libA, con, 'dA');
    let replacement = '';
    t.lti.faults.push({ op: 'PATCH deployment', action: 'after', run: async () => { replacement = (await grant(op, libA, con, 'dA')).code; } });
    t.lti.faults.push({ op: 'PATCH deployment', action: 'late' });
    expect(code(await putBb(a, con, 'dA', g.code))).toBe('GRANT_INVALID');
    expect(events('grant_compensation_failed')).toHaveLength(1);
    expect((await putBb(a, con, 'dA', replacement)).status).toBe(200);
    const ref = deployment(shared.id, 'dA')!.bindingRef;
    expect(t.lti.lateWrites.shift()!()).toBe(409); // the held compensation meets the new ref
    expect(deployment(shared.id, 'dA')).toMatchObject({ active: true, bindingRef: ref });
  });

  it('(q) replacement redeemed before the old create is delivered: the late create gets 409 and changes nothing', async () => {
    const { shared, op, a, libA } = await setup();
    const con = await bbConnection(a);
    const g = await grant(op, libA, con, 'dA');
    t.lti.faults.push({ op: 'POST deployment', action: 'late' });
    expect((await putBb(a, con, 'dA', g.code)).status).toBe(502);
    const g2 = await grant(op, libA, con, 'dA');
    expect((await putBb(a, con, 'dA', g2.code)).status).toBe(200);
    const ref = deployment(shared.id, 'dA')!.bindingRef;
    expect(t.lti.lateWrites.shift()!()).toBe(409);
    expect(deployment(shared.id, 'dA')).toMatchObject({ active: true, bindingRef: ref });
  });

  it('(t) Canvas: a foreign active record is not adoptable; after DELETE of its owner (fenced) the other connection adopts it (A3)', async () => {
    const { op, a, libA } = await setup();
    const k1 = await canvasConnection(a);
    const k2 = await canvasConnection(a);
    const g1 = await grant(op, libA, k1, 'dA');
    const g2 = await grant(op, libA, k2, 'dA');
    t.lti.faults.push({ op: 'PATCH platform', action: 'drop_after' });
    expect((await putCanvas(a, k1, 'dA', g1.code)).status).toBe(502);
    const platform = [...t.lti.platforms.values()].find((p) => p.profile === 'canvas-sim-cloud')!;
    expect(platform.active).toBe(true);
    const inUse = await putCanvas(a, k2, 'dA', g2.code);
    // LA-E1-12: the channel text name fills the M1 Canvas text byte for byte.
    expect([code(inUse), inUse.json.details.description]).toEqual(['PLATFORM_IN_USE',
      'This Canvas developer key is already connected to Cogniate. Make a new developer key for this library, or ask your Cogniate operator.']);
    expect((await call('DELETE', `/app-api/connections/${k1.id}`, a)).status).toBe(204);
    expect(events('binding_fenced').at(-1)).toMatchObject({ result: 'fenced' });
    const ok = await putCanvas(a, k2, 'dA', g2.code);
    expect([ok.status, ok.json.platform.id, ok.json.platform.issuer]).toEqual([200, platform.id, 'https://canvas.sim.test']);
    expect([...t.lti.platforms.values()].filter((p) => p.profile === 'canvas-sim-cloud')).toHaveLength(1);
  });

  it('(c) Canvas initial: a lost S1 answer leaves an inactive platform (DTO platform null); the retry adopts it (A2)', async () => {
    const { op, a, libA } = await setup();
    const k = await canvasConnection(a);
    const g = await grant(op, libA, k, 'dA');
    t.lti.faults.push({ op: 'POST platform', action: 'drop_after' });
    expect((await putCanvas(a, k, 'dA', g.code)).status).toBe(502);
    expect((await call('GET', `/app-api/connections/${k.id}`, a)).json.platform).toBeNull();
    const r = await putCanvas(a, k, 'dA', g.code);
    expect([r.status, r.json.platform.deploymentIds, r.json.platform.siteUrl, r.json.platform.serviceUrl]).toEqual([200, ['dA'], SCHOOL_A, SCHOOL_A]);
  });
});

describe('suspend and release (§4.9; AC-M1-38 unit level)', () => {
  it('suspend without a session fences out; release keeps the Blackboard deployment inactive and frees the reservation; another library binds with generation + 1', async () => {
    const { shared, op, a, b, libA, libB } = await setup();
    const conA = await bbConnection(a);
    expect((await putBb(a, conA, 'dA', (await grant(op, libA, conA, 'dA')).code)).status).toBe(200);
    expect((await op.release(conA.id, 'n', 't')).lines[0]).toBe('binding still active; run suspend first');
    const s = await op.suspend(conA.id, 'n', 't');
    expect([s.exitCode, s.lines.at(-1)]).toEqual([0, `fenced platform=${shared.id} deployment=dA`]);
    expect(getConnectionAnyLibrary(t.db, conA.id)?.status).toBe('disabled');
    expect((await op.suspend(conA.id, 'n', 't')).lines.at(-1)).toMatch(/^fenced/);
    expect((await bbLaunch(shared.id, 'dA')).statusCode).toBe(404);
    const rel = await op.release(conA.id, 'n', 't');
    expect([rel.exitCode, rel.lines]).toEqual([0, [`kept_inactive platform=${shared.id} deployment=dA`]]);
    expect(reservationOfConnection(t.db, conA.id)).toBeUndefined();
    expect((await op.release(conA.id, 'n', 't')).exitCode).toBe(0);
    const conB = await bbConnection(b);
    expect((await putBb(b, conB, 'dA', (await grant(op, libB, conB, 'dA')).code)).status).toBe(200);
    expect(deployment(shared.id, 'dA')).toMatchObject({ active: true, bindingGeneration: 2 });
    const again = await op.release(conA.id, 'n', 't');
    expect([again.exitCode, again.lines]).toEqual([0, [`not_owned platform=${shared.id} deployment=dA`]]);
    expect(reservationOfConnection(t.db, conB.id)).toMatchObject({ deploymentId: 'dA' });
  });

  it('release waits for a live lease; a late create after suspend is found and fenced by the next suspend', async () => {
    const { shared, op, a, libA } = await setup();
    const con = await bbConnection(a);
    const g = await grant(op, libA, con, 'dA');
    t.lti.faults.push({ op: 'POST deployment', action: 'late' });
    expect((await putBb(a, con, 'dA', g.code)).status).toBe(502);
    expect((await op.suspend(con.id, 'n', 't')).lines.at(-1)).toMatch(/^absent/);
    t.lti.lateWrites.shift()!();
    expect(deployment(shared.id, 'dA')).toMatchObject({ active: false, bindingGeneration: 0 });
    expect((await op.suspend(con.id, 'n', 't')).lines.at(-1)).toMatch(/^fenced/);
    // A live lease blocks release.
    t.db.prepare('UPDATE connection SET redeeming_attempt = ?, redeeming_since = ? WHERE id = ?').run('att_x', t.clock.now, con.id);
    expect((await op.release(con.id, 'n', 't')).lines[0]).toMatch(/^a redemption may still run; retry after \d+ s$/);
  });

  it('Canvas: release deletes the owned inactive platform with a conditional delete; a new connection binds the same client id again', async () => {
    const { op, a, libA } = await setup();
    const k = await canvasConnection(a);
    expect((await putCanvas(a, k, 'dA', (await grant(op, libA, k, 'dA')).code)).status).toBe(200);
    const pid = getConnectionAnyLibrary(t.db, k.id)!.ltiPlatformId!;
    await op.suspend(k.id, 'n', 't');
    const rel = await op.release(k.id, 'n', 't');
    expect(rel.lines).toEqual([`deleted platform=${pid} deployment=-`]);
    expect(t.lti.platforms.has(pid)).toBe(false);
    expect(t.lti.calls.some((c) => c.startsWith(`DELETE platform ${pid} if `))).toBe(true);
    const k2 = await canvasConnection(a);
    expect((await putCanvas(a, k2, 'dA', (await grant(op, libA, k2, 'dA')).code)).status).toBe(200);
  });
});

describe('routing, site and LMS checks, disabled score rules and guards (§4.7.2, §6.1)', () => {
  it('an approved Blackboard deployment routes; a site mismatch and an LMS mismatch give UNKNOWN_PLATFORM with the log fields', async () => {
    const { shared, op, a, libA } = await setup();
    const con = await bbConnection(a);
    expect((await putBb(a, con, 'dA', (await grant(op, libA, con, 'dA')).code)).status).toBe(200);
    expect((await bbLaunch(shared.id, 'dA')).body).toContain('PUBLICATION_NOT_IN_CONNECTION');
    await bbLaunch(shared.id, 'dA', LEARN_B);
    expect(events('launch_rejected').at(-1)).toMatchObject({ reason: 'site_mismatch', expected_site: LEARN_A, launch_site: LEARN_B, expected_service: LEARN_A, launch_service: LEARN_B });
    const wrong = await bbLaunch(shared.id, 'dA', LEARN_A, [LEARNER], { productFamilyCode: 'canvas' });
    expect(wrong.body).toContain('data-error-code="UNKNOWN_PLATFORM"');
    expect(wrong.body).toContain('This Blackboard site is not connected to Cogniate. Tell your Blackboard administrator.');
    expect(events('launch_rejected').at(-1)).toMatchObject({ reason: 'lms_mismatch', connection_lms: 'blackboard', family: 'canvas' });
    await bbLaunch(shared.id, 'dB');
    expect(events('launch_rejected').at(-1)).toMatchObject({ reason: 'unknown_platform' });
  });

  it('Deep Linking needs a context staff or admin role (ADR-011 §10)', async () => {
    const { shared, op, a, libA } = await setup();
    const con = await bbConnection(a);
    expect((await putBb(a, con, 'dA', (await grant(op, libA, con, 'dA')).code)).status).toBe(200);
    const dl = (roles: string[]) => {
      const token: LtiIdToken = {
        user: { id: 'u', roles }, platform: { id: shared.id, url: 'https://blackboard.sim.test', deploymentId: 'dA', siteUrl: LEARN_A, serviceUrl: LEARN_A, profile: 'blackboard-sim' },
        launch: { type: 'LtiDeepLinkingRequest', target: `${TEST_URLS.lti}/lti/launch/cogniate`, context: { id: 'c1' } },
      };
      return t.app.inject({ method: 'GET', url: `/tool/deep-link?ltik=${t.lti.addLaunch(token)}` });
    };
    expect((await dl([LEARNER, 'http://purl.imsglobal.org/vocab/lis/v2/institution/person#Instructor'])).body).toContain('ROLE_NOT_ALLOWED');
    const ok = await dl(['http://purl.imsglobal.org/vocab/lis/v2/membership/Instructor#TeachingAssistant']);
    expect(ok.statusCode).toBe(303);
    const picker = await t.app.inject({ method: 'GET', url: String(ok.headers.location).replace(TEST_URLS.app, '') });
    expect(picker.headers['content-security-policy']).toContain(`frame-ancestors ${LEARN_A};`);
    expect(picker.body).toContain('No course is published to this Blackboard site yet.');
    expect((await dl([INSTRUCTOR])).statusCode).toBe(303);
  });

  it('a disabled Blackboard connection: a due score row fails with CONNECTION_DISABLED and no POST; Resend and Refresh answer 409', async () => {
    const { op, a, libA } = await setup();
    const con = await bbConnection(a);
    expect((await putBb(a, con, 'dA', (await grant(op, libA, con, 'dA')).code)).status).toBe(200);
    expect((await call('DELETE', `/app-api/connections/${con.id}`, a)).status).toBe(204);
    // A score row of this connection (the fixture rows that a graded launch makes).
    const lib = libA;
    t.db.prepare("INSERT INTO course (id, library_id, title, summary, variant, lang, created_at) VALUES ('crs_s', ?, 'C', '', 'default', 'en', 0)").run(lib);
    t.db.prepare("INSERT INTO package (id, library_id, sha256, total_bytes, file_count, storage_path, created_at) VALUES ('pkg_s', ?, 'x', 1, 1, 'p', 0)").run(lib);
    t.db.prepare("INSERT INTO course_version (id, course_id, version, format, package_id, validation_report, tracking_profile, created_at) VALUES ('ver_s', 'crs_s', 1, 'html', 'pkg_s', '{}', '{}', 0)").run();
    t.db.prepare("INSERT INTO publication (id, connection_id, course_id, current_version_id, status, created_at, updated_at) VALUES ('pub_s', ?, 'crs_s', 'ver_s', 'available', 0, 0)").run(con.id);
    t.db.prepare("INSERT INTO resource_link (id, connection_id, publication_id, deployment_id, context_id, resource_link_id, context_title, title, created_at, updated_at) VALUES ('rl_s', ?, 'pub_s', 'dA', 'c', 'r', 'C', 'T', 0, 0)").run(con.id);
    t.db.prepare("INSERT INTO attempt (id, resource_link_id, user_sub, course_version_id, preview, outcome, score_given, score_maximum, created_at, updated_at) VALUES ('att_s', 'rl_s', 'u', 'ver_s', 0, 'completed', 7, 10, 0, 0)").run();
    seedLegacyDispatch(t.db, { id: 'sync_s', attemptId: 'att_s', tries: 2, createdAt: 0, nextTryAt: t.clock.now + 30_000 });
    const { createDispatchHarness } = await import('../kernel/records/dispatch.testkit.ts');
    const worker = createDispatchHarness({ channels: TEST_CHANNELS, db: t.db, lti: t.lti.client, logger: createLogger({ service: 'x', write: (l) => t.logs.push(JSON.parse(l)) }), masterKey: Buffer.alloc(32, 5), now: () => t.clock.now });
    await worker.kick();
    expect(t.db.prepare("SELECT status FROM record_dispatch WHERE id = 'sync_s'").get()?.status).toBe('pending');
    t.clock.now += 30_000;
    await worker.kick();
    expect(t.db.prepare("SELECT status, tries, last_error FROM record_dispatch WHERE id = 'sync_s'").get()).toEqual({ status: 'failed', tries: 2, last_error: 'CONNECTION_DISABLED' });
    expect(t.lti.scores).toEqual([]);
    expect(code(await call('POST', '/app-api/score-syncs/sync_s/resend', a))).toBe('CONNECTION_NOT_READY');
    expect(code(await call('POST', '/app-api/publications/pub_s/results/refresh', a))).toBe('CONNECTION_NOT_READY');
  });

  it('capability guards and create rules for Blackboard connections', async () => {
    const { op, a } = await setup();
    const con = await bbConnection(a);
    void op;
    const ws = await call('PUT', `/app-api/connections/${con.id}/web-services`, a, { token: 'a'.repeat(32) });
    expect([ws.status, code(ws), ws.json.details.capability]).toEqual([409, 'CAPABILITY_NOT_SUPPORTED', 'webServices']);
    expect(code(await call('POST', `/app-api/connections/${con.id}/registration-url`, a))).toBe('CONNECTION_NOT_PENDING');
    const dyn = await call('POST', '/app-api/connections', a, { name: 'x', siteUrl: LEARN_A, method: 'dynamic', lms: 'blackboard', profile: 'blackboard-sim' });
    expect([dyn.status, code(dyn), dyn.json.details.capability]).toEqual([422, 'CAPABILITY_NOT_SUPPORTED', 'dynamicRegistration']);
    expect((await call('POST', '/app-api/connections', a, { name: 'x', siteUrl: LEARN_A, method: 'manual', lms: 'blackboard', profile: 'blackboard-sim', serviceUrl: LEARN_A })).json.details.field).toBe('serviceUrl');
    const notReady = await call('POST', '/app-api/connections', a, { name: 'x', siteUrl: LEARN_A, method: 'manual', lms: 'blackboard' });
    expect(code(notReady)).toBe('PROVIDER_NOT_READY');
    const rule = await call('POST', '/app-api/connections', a, { name: 'x', siteUrl: 'https://developer.blackboard.sim.test', method: 'manual', lms: 'blackboard', profile: 'blackboard-sim' });
    expect([rule.status, code(rule), rule.json.details]).toEqual([422, 'INVALID_SITE_URL', expect.objectContaining({ rule: 4, field: 'siteUrl' })]);
    expect((await call('POST', '/app-api/connections', a, { name: 'x', siteUrl: LEARN_A, method: 'manual', lms: 'nope' })).json.details.field).toBe('lms');
    expect((await call('POST', '/app-api/connections', a, { name: 'x', siteUrl: LEARN_A, method: 'manual', lms: 'canvas', profile: 'blackboard-sim' })).json.details.field).toBe('profile');
    const canon = await call('POST', '/app-api/connections', a, { name: 'x', siteUrl: 'HTTPS://Learn-A.Blackboard.Sim.Test:443/', method: 'manual', lms: 'blackboard', profile: 'blackboard-sim' });
    expect(canon.json.siteUrl).toBe(LEARN_A);
    const rows = await call('GET', `/app-api/connections/${con.id}/tool-configuration`, a);
    expect(rows.json.map((r: Json) => r.key)).toEqual(['client_id', 'login_initiation_url', 'tool_redirect_url', 'tool_jwks_url', 'tool_status', 'user_fields', 'grade_service', 'membership_service', 'placement']);
    expect(rows.json[0].value).toBe(BB);
    const providers = (await call('GET', '/app-api/lms-providers', a)).json.lms;
    expect(providers.map((p: Json) => p.lms)).toEqual(['moodle', 'canvas', 'blackboard']);
    expect(providers[2].profiles).toEqual([
      { id: 'blackboard', label: 'Blackboard Learn', simulation: false, ready: false, clientId: null },
      { id: 'blackboard-sim', label: 'Blackboard Learn (simulation)', simulation: true, ready: true, clientId: BB },
    ]);
  });
});

describe('signed product family path (AC-M1-39 unit level)', () => {
  it('a Moodle platform with the self-hosted Canvas issuer and client id blocks the Canvas redemption (409 PLATFORM_IN_USE) until release', async () => {
    const { op, a, b, libA } = await setup();
    t.lti.providers.push({ id: 'canvas-self-hosted', lms: 'canvas', label: 'Self-hosted Canvas', sharing: 'exclusive', issuer: '{siteUrl}',
      authenticationEndpoint: '{siteUrl}/api/lti/authorize_redirect', accesstokenEndpoint: '{serviceUrl}/login/oauth2/token', jwksUrl: '{siteUrl}/api/lti/security/jwks',
      siteUrlOn: 'platform', serviceUrl: true, simulation: false, sharedPlatform: null });
    const self = 'https://canvas-self.sim.test';
    const moodle = (await call('POST', '/app-api/connections', b, { name: 'M', siteUrl: self, method: 'manual' })).json;
    const m = await call('PUT', `/app-api/connections/${moodle.id}/platform`, b, { issuer: self, clientId: 'cS', deploymentId: 'dS',
      authenticationEndpoint: `${self}/api/lti/authorize_redirect`, accessTokenEndpoint: `${self}/login/oauth2/token`, jwksUrl: `${self}/api/lti/security/jwks` });
    expect(m.status).toBe(200);
    const canvas = (await call('POST', '/app-api/connections', a, { name: 'C', siteUrl: self, method: 'manual', lms: 'canvas', profile: 'canvas-self-hosted' })).json;
    const g = await grant(op, libA, canvas, 'dS', { clientId: 'cS' });
    const originalPlatform = structuredClone(t.lti.platforms.get(m.json.platform.id));
    const read = vi.spyOn(t.lti.client, 'findPlatforms');
    t.lti.calls.length = 0;
    expect(code(await putCanvas(a, canvas, 'dS', g.code, 'cS'))).toBe('PLATFORM_IN_USE');
    expect(read).toHaveBeenCalledExactlyOnceWith({ url: self, clientId: 'cS', profile: 'canvas-self-hosted' }, expect.any(String), { singleAttempt: true });
    expect(t.lti.calls).toHaveLength(2); // S1 conflict and one qualified S2; no standard lookup or activation.
    expect(t.lti.platforms.get(m.json.platform.id)).toEqual(originalPlatform);
    expect(getConnectionAnyLibrary(t.db, canvas.id)?.redeemingAttempt).toBeNull();
    read.mockRestore();
    expect(getGrant(t.db, g.id)?.redeemedAt).toBeNull();
    expect((await op.suspend(moodle.id, 'n', 't')).exitCode).toBe(0);
    expect((await op.release(moodle.id, 'n', 't')).lines[0]).toMatch(/^deleted/);
    expect((await putCanvas(a, canvas, 'dS', g.code, 'cS')).status).toBe(200);
  });
});

describe('player, embedded page and LMS check per LMS (§6.1 unit level)', () => {
  /** A course, version and publication of library A's connection (raw rows: no upload needed). */
  function publish(connectionId: string, lib: string) {
    t.db.prepare("INSERT INTO course (id, library_id, title, summary, variant, lang, created_at) VALUES ('crs_p', ?, 'Course P', '', 'default', 'en', 0)").run(lib);
    t.db.prepare("INSERT INTO package (id, library_id, sha256, total_bytes, file_count, storage_path, created_at) VALUES ('pkg_p', ?, 'x', 1, 1, 'p', 0)").run(lib);
    t.db.prepare(`INSERT INTO course_version (id, course_id, version, format, package_id, validation_report, tracking_profile, created_at)
      VALUES ('ver_p', 'crs_p', 1, 'html', 'pkg_p', '{"scorm":null}', '{}', 0)`).run();
    t.db.prepare("INSERT INTO publication (id, connection_id, course_id, current_version_id, status, created_at, updated_at) VALUES ('pub_x', ?, 'crs_p', 'ver_p', 'available', 0, 0)").run(connectionId);
  }

  it('Blackboard: the shell has data-lms-name, "Back to Blackboard" to {site}/ when the return URL is on another host; status text names Blackboard', async () => {
    const { shared, op, a, libA } = await setup();
    const con = await bbConnection(a);
    expect((await putBb(a, con, 'dA', (await grant(op, libA, con, 'dA')).code)).status).toBe(200);
    publish(con.id, libA);
    const token: LtiIdToken = {
      user: { id: 'u-1', roles: [LEARNER] },
      platform: { id: shared.id, url: 'https://blackboard.sim.test', deploymentId: 'dA', siteUrl: LEARN_A, serviceUrl: LEARN_A, profile: 'blackboard-sim', productFamilyCode: 'BlackboardLearn' },
      launch: { type: 'LtiResourceLinkRequest', target: `${TEST_URLS.lti}/lti/launch/cogniate?resource=pub_x`, context: { id: 'c1', title: 'Course' }, resourceLink: { id: 'rl1', title: 'Item' },
        presentation: { documentTarget: 'iframe', returnUrl: 'https://other.example.edu/back' } },
    };
    const launch = await t.app.inject({ method: 'GET', url: `/tool/launch?ltik=${t.lti.addLaunch(token)}` });
    expect(launch.statusCode).toBe(303);
    const embeddedUrl = String(launch.headers.location).replace(TEST_URLS.app, '');
    expect(embeddedUrl).toMatch(/\/play\/ply_[^/]+\/embedded$/);
    const embedded = await t.app.inject({ method: 'GET', url: embeddedUrl });
    expect(embedded.headers['content-security-policy']).toContain(`frame-ancestors ${LEARN_A};`);
    expect(embedded.headers['content-security-policy']).not.toContain('script-src');
    expect(embedded.body).not.toContain('<script');
    const shell = await t.app.inject({ method: 'GET', url: embeddedUrl.replace(/\/embedded$/, '') });
    expect(shell.body).toContain('data-lms-name="Blackboard"');
    expect(shell.body).toContain(`href="${LEARN_A}/"`);
    expect(shell.body).toContain('Back to Blackboard');
  });

  it('Canvas: the embedded page runs the continuation script with a nonce and frame-ancestors {site}', async () => {
    const { op, a, libA } = await setup();
    const k = await canvasConnection(a);
    expect((await putCanvas(a, k, 'dA', (await grant(op, libA, k, 'dA')).code)).status).toBe(200);
    publish(k.id, libA);
    const pid = getConnectionAnyLibrary(t.db, k.id)!.ltiPlatformId!;
    const token: LtiIdToken = {
      user: { id: 'u-1', roles: [LEARNER] },
      platform: { id: pid, url: 'https://canvas.sim.test', deploymentId: 'dA', siteUrl: SCHOOL_A, serviceUrl: SCHOOL_A, profile: 'canvas-sim-cloud', productFamilyCode: 'canvas' },
      launch: { type: 'LtiResourceLinkRequest', target: `${TEST_URLS.lti}/lti/launch/cogniate?resource=pub_x`, context: { id: 'c1' }, resourceLink: { id: 'rl1' }, presentation: { documentTarget: 'iframe' } },
    };
    const launch = await t.app.inject({ method: 'GET', url: `/tool/launch?ltik=${t.lti.addLaunch(token)}` });
    const embedded = await t.app.inject({ method: 'GET', url: String(launch.headers.location).replace(TEST_URLS.app, '') });
    const csp = String(embedded.headers['content-security-policy']);
    const nonce = /script-src 'nonce-([^']+)'/.exec(csp)?.[1];
    expect(nonce).toBeTruthy();
    expect(csp).toContain(`frame-ancestors ${SCHOOL_A};`);
    expect(embedded.body).toContain(`<script nonce="${nonce}">`);
    expect(embedded.body).toContain('window.location.replace(');
    // A launch with the right site but a Blackboard-signed family on this Canvas connection: lms_mismatch.
    const wrong = await t.app.inject({ method: 'GET', url: `/tool/launch?ltik=${t.lti.addLaunch({ ...token, platform: { ...token.platform, productFamilyCode: 'BlackboardLearn' } })}` });
    expect(wrong.body).toContain('This Canvas site is not connected to Cogniate. Tell your Canvas administrator.');
    expect(events('launch_rejected').at(-1)).toMatchObject({ reason: 'lms_mismatch', connection_lms: 'canvas', family: 'BlackboardLearn' });
    // A profile of another LMS on the same route: lms_mismatch too (a case that black-box tests cannot reach).
    await t.app.inject({ method: 'GET', url: `/tool/launch?ltik=${t.lti.addLaunch({ ...token, platform: { ...token.platform, profile: 'standard', productFamilyCode: 'other' } })}` });
    expect(events('launch_rejected').at(-1)).toMatchObject({ reason: 'lms_mismatch', connection_lms: 'canvas' });
    // A missing family passes the LMS check.
    expect((await t.app.inject({ method: 'GET', url: `/tool/launch?ltik=${t.lti.addLaunch({ ...token, platform: { ...token.platform, productFamilyCode: undefined } })}` })).statusCode).toBe(303);
  });
});

describe('app text tables (§6.1): Moodle texts byte for byte', () => {
  it('launch and picker actions with Moodle equal the texts before M1', async () => {
    const { LAUNCH_ERRORS } = await import('../tool-pages/launch.ts');
    const { PICKER_ERRORS } = await import('../tool-pages/picker.ts');
    const { withLms } = await import('../tool-pages/page.ts');
    const m = (s: string) => withLms(s, 'Moodle');
    expect(m(LAUNCH_ERRORS.UNKNOWN_PLATFORM.action)).toBe('This Moodle site is not connected to Cogniate. Tell your Moodle administrator.');
    expect(m(LAUNCH_ERRORS.ROLE_NOT_ALLOWED.action)).toBe('Only a teacher can select a Cogniate course. Ask a teacher of this Moodle course.');
    expect(m(LAUNCH_ERRORS.LTI_SERVICE_ERROR.action)).toBe('Cogniate could not read this launch. Open the activity again in Moodle. If it happens again, give the trace id to your Moodle administrator.');
    expect(m(PICKER_ERRORS.PUBLICATION_NOT_AVAILABLE.action)).toBe('This course is not available for this Moodle site. In Moodle, use Select content again and choose one available course.');
    expect(m(PICKER_ERRORS.LTI_SERVICE_ERROR.action)).toBe('Cogniate could not send the course to Moodle. In Moodle, use Select content again. If it happens again, give the trace id to your Moodle administrator.');
    expect(withLms(LAUNCH_ERRORS.UNKNOWN_PLATFORM.action, 'Canvas')).toBe('This Canvas site is not connected to Cogniate. Tell your Canvas administrator.');
  });
});

// B-M1-03 (app contract §4.7.1: phase 1 runs its local checks and takes the lease BEFORE any LTI service call).
// These six held regressions failed before the accepted snapshot repair.
describe('B-M1-03: a phase-1 refusal makes no LTI call (§4.7.1)', () => {
  const UNKNOWN_CODE = 'x'.repeat(43);
  const connectionOf = (lms: 'blackboard' | 'canvas', cookie: string) => (lms === 'blackboard' ? bbConnection(cookie) : canvasConnection(cookie));
  const put = (lms: 'blackboard' | 'canvas', cookie: string, con: Json, grantCode: string) =>
    (lms === 'blackboard' ? putBb(cookie, con, 'dA', grantCode) : putCanvas(cookie, con, 'dA', grantCode));

  it.each([
    ['blackboard', false], ['blackboard', true], ['canvas', false], ['canvas', true],
  ] as const)('%s: an unknown code answers 403 GRANT_INVALID with zero outbound calls (provider outage: %s)', async (lms, outage) => {
    const { a } = await setup();
    const con = await connectionOf(lms, a);
    t.lti.calls.length = 0;
    if (outage) t.lti.failNext = { code: 'UNAVAILABLE', status: 503 };
    const r = await put(lms, a, con, UNKNOWN_CODE);
    expect([r.status, code(r), t.lti.calls]).toEqual([403, 'GRANT_INVALID', []]);
    t.lti.failNext = null;
    expect(getConnectionAnyLibrary(t.db, con.id)).toMatchObject({ status: 'pending', redeemingAttempt: null });
  });

  it.each(['blackboard', 'canvas'] as const)('%s: a valid grant while another attempt holds the live lease answers 409 GRANT_IN_USE with zero outbound calls', async (lms) => {
    const { op, a, libA } = await setup();
    const con = await connectionOf(lms, a);
    const g = await grant(op, libA, con, 'dA');
    t.db.prepare('UPDATE connection SET redeeming_attempt = ?, redeeming_since = ? WHERE id = ?').run('att_live', t.clock.now, con.id);
    t.lti.calls.length = 0;
    const r = await put(lms, a, con, g.code);
    expect([r.status, code(r), t.lti.calls]).toEqual([409, 'GRANT_IN_USE', []]);
    // Nothing changed: the grant is still open and the lease still holds the other attempt.
    expect(getGrant(t.db, g.id)).toMatchObject({ redeemedAt: null, revokedAt: null });
    expect(getConnectionAnyLibrary(t.db, con.id)).toMatchObject({ status: 'pending', redeemingAttempt: 'att_live' });
    expect(reservationOfConnection(t.db, con.id)).toBeUndefined();
  });
});

const UNKNOWN_CODE = 'x'.repeat(43);
const NULL_SNAPSHOT = { issuer: null, platformId: null, clientId: null };
const eraseSnapshot = (id: string) => t.db.prepare('UPDATE connection SET target_issuer = NULL, target_platform_id = NULL, target_client_id = NULL WHERE id = ?').run(id);
const attempts = (id: string) => t.db.prepare('SELECT * FROM binding_attempt WHERE connection_id = ? ORDER BY seq').all(id);
const assertNeutral = (r: Awaited<ReturnType<typeof call>>) => {
  expect([r.status, code(r), r.json.details.description, r.json.details.action]).toEqual([
    409, 'PROVIDER_NOT_READY', 'This LMS setup is not ready in Cogniate.',
    'Ask your Cogniate operator to check the LMS setup for this connection. The operator tells you to try again later, or to make a new connection.',
  ]);
  expect(r.json.details).not.toHaveProperty('cause');
  expect(r.json.details).not.toHaveProperty('reason');
};

type Endpoint = 'blackboard' | 'canvas' | 'add_deployment';
async function endpoint(kind: Endpoint) {
  const base = await setup();
  const con = kind === 'blackboard' ? await bbConnection(base.a) : await canvasConnection(base.a);
  const initial = await grant(base.op, base.libA, con, 'dA');
  if (kind === 'add_deployment') expect((await putCanvas(base.a, con, 'dA', initial.code)).status).toBe(200);
  const g = kind === 'add_deployment' ? await grant(base.op, base.libA, con, 'dB', { purpose: 'add_deployment' }) : initial;
  const deploymentId = kind === 'add_deployment' ? 'dB' : 'dA';
  const submit = (body: Json = {}, traceId?: string) => call(kind === 'add_deployment' ? 'POST' : 'PUT',
    `/app-api/connections/${con.id}/${kind === 'add_deployment' ? 'deployments' : 'platform'}`, base.a,
    { ...(kind === 'canvas' ? { clientId: 'cA' } : {}), deploymentId, grantCode: g.code, ...body }, traceId);
  t.lti.calls.length = 0;
  t.logs.length = 0;
  return { ...base, con, g, submit, deploymentId };
}

describe('snapshot create, local configuration and operator reads (§4.2, §4.5, §4.8)', () => {
  it('captures one authenticated response, hides the snapshot, ignores public snapshot fields and leaves Moodle local', async () => {
    const { a, shared } = await setup();
    t.lti.calls.length = 0;
    const bb = await bbConnection(a);
    expect(t.lti.calls).toEqual(['GET providers']);
    expect(getConnectionAnyLibrary(t.db, bb.id)?.snapshot).toEqual({ issuer: 'https://blackboard.sim.test', platformId: shared.id, clientId: BB });
    expect(bb).not.toHaveProperty('snapshot');
    expect(JSON.stringify(bb)).not.toContain('target_');
    t.lti.calls.length = 0;
    const canvas = await call('POST', '/app-api/connections', a, {
      name: 'Canvas', lms: 'canvas', profile: 'canvas-sim-cloud', method: 'manual', siteUrl: SCHOOL_A,
      target_issuer: 'https://untrusted.test', snapshot: { issuer: 'https://untrusted.test' },
    });
    expect(canvas.status).toBe(201);
    expect(t.lti.calls).toEqual(['GET providers']);
    expect(getConnectionAnyLibrary(t.db, canvas.json.id)?.snapshot).toEqual({ issuer: 'https://canvas.sim.test', platformId: null, clientId: null });
    t.lti.calls.length = 0;
    const moodle = await call('POST', '/app-api/connections', a, { name: 'Moodle', siteUrl: TEST_URLS.moodle, method: 'manual' });
    expect(moodle.status).toBe(201);
    expect(t.lti.calls).toEqual([]);
    expect(getConnectionAnyLibrary(t.db, moodle.json.id)?.snapshot).toEqual(NULL_SNAPSHOT);
    expect(moodle.json).not.toHaveProperty('snapshot');
  });

  it('uses the canonical site for a self-hosted snapshot', async () => {
    const { a } = await setup();
    const canvas = t.lti.providers.find((p) => p.id === 'canvas-sim-cloud')!;
    t.lti.providers.push({ ...canvas, id: 'canvas-self-hosted', issuer: '{siteUrl}', authenticationEndpoint: '{siteUrl}/api/lti/authorize_redirect', jwksUrl: '{siteUrl}/api/lti/security/jwks' });
    const r = await call('POST', '/app-api/connections', a, { name: 'Self', siteUrl: 'HTTPS://Canvas.School.EDU:443/', serviceUrl: 'https://root.school.edu', method: 'manual', lms: 'canvas', profile: 'canvas-self-hosted' });
    expect(r.status).toBe(201);
    expect(getConnectionAnyLibrary(t.db, r.json.id)?.snapshot.issuer).toBe('https://canvas.school.edu');
  });

  it('logs create-time readiness with connection_id null and the neutral text', async () => {
    const { a, shared } = await setup();
    shared.active = false;
    const before = t.db.prepare('SELECT COUNT(*) AS n FROM connection').get();
    const r = await call('POST', '/app-api/connections', a, { name: 'Learn', siteUrl: LEARN_A, method: 'manual', lms: 'blackboard', profile: 'blackboard-sim' });
    assertNeutral(r);
    expect(events('provider_not_ready')).toHaveLength(1);
    expect(events('provider_not_ready')[0]).toMatchObject({ connection_id: null, profile: 'blackboard-sim', cause: 'platform_inactive' });
    expect(t.db.prepare('SELECT COUNT(*) AS n FROM connection').get()).toEqual(before);
  });

  it('Blackboard configuration and optional clientId use snapshot then old persisted platform, never provider data', async () => {
    const { a, op, libA, shared } = await setup();
    const con = await bbConnection(a);
    const g = await grant(op, libA, con, 'dA');
    expect((await putBb(a, con, 'dA', g.code)).status).toBe(200);
    shared.clientId = 'changed'; shared.active = false;
    t.lti.calls.length = 0;
    const rows = await call('GET', `/app-api/connections/${con.id}/tool-configuration`, a);
    expect(rows.json[0]).toMatchObject({ key: 'client_id', value: BB });
    const repeat = { deploymentId: 'dA', grantCode: UNKNOWN_CODE, clientId: BB };
    expect((await call('PUT', `/app-api/connections/${con.id}/platform`, a, repeat)).status).toBe(200);
    expect(code(await call('PUT', `/app-api/connections/${con.id}/platform`, a, { ...repeat, clientId: 'changed' }))).toBe('INVALID_PLATFORM_VALUES');
    eraseSnapshot(con.id);
    expect((await call('GET', `/app-api/connections/${con.id}/tool-configuration`, a)).json[0].value).toBe(BB);
    expect((await call('PUT', `/app-api/connections/${con.id}/platform`, a, repeat)).status).toBe(200);
    expect(t.lti.calls).toEqual([]);
  });

  it.each(['blackboard', 'canvas'] as const)('%s initial issue reads once, fails closed on drift/outage, and never replaces a grant on failure', async (kind) => {
    const { con, g, op, libA, shared } = await endpoint(kind);
    const input = { library: libA, connection: con.id, site: con.siteUrl, clientId: kind === 'blackboard' ? BB : 'cA', deploymentId: 'dA', note: 'ticket', traceId: 'issue' };
    const before = grantsOfConnection(t.db, con.id);
    t.lti.failNext = { status: 503, code: 'UNAVAILABLE' };
    expect((await op.issue(input)).exitCode).toBe(1);
    expect(t.lti.calls).toEqual(['GET providers']);
    t.lti.calls.length = 0;
    if (kind === 'blackboard') { shared.clientId = 'other'; shared.active = false; }
    else t.lti.providers.find((p) => p.id === con.profile)!.issuer = 'https://changed.test';
    const refused = await op.issue(input);
    expect(refused.exitCode).toBe(1);
    expect(refused.lines[0]).toContain('changed after this connection was made');
    expect(t.lti.calls).toEqual(['GET providers']);
    expect(grantsOfConnection(t.db, con.id)).toEqual(before);
    expect(getGrant(t.db, g.id)?.revokedAt).toBeNull();
    t.lti.calls.length = 0;
    eraseSnapshot(con.id);
    expect(await op.issue(input)).toEqual({ exitCode: 1, lines: ['This connection has no provider snapshot. Make a new connection.'] });
    expect(t.lti.calls).toEqual([]);
    expect(grantsOfConnection(t.db, con.id)).toEqual(before);
  });
});

describe('all three endpoints: local ordering, committed target and audit (§4.7.1)', () => {
  it.each(['blackboard', 'canvas', 'add_deployment'] as const)('%s refuses strict body, grant, mismatch and lease locally even during a provider outage', async (kind) => {
    const { con, g, submit } = await endpoint(kind);
    const prior = attempts(con.id);
    t.lti.failNext = { status: 503, code: 'UNAVAILABLE' };
    expect(code(await submit({ endpoint: 'untrusted', grantCode: UNKNOWN_CODE }))).toBe('INVALID_PLATFORM_VALUES');
    expect(code(await submit({ grantCode: UNKNOWN_CODE }))).toBe('GRANT_INVALID');
    expect(code(await submit({ deploymentId: 'wrong' }))).toBe('GRANT_MISMATCH');
    t.db.prepare('UPDATE connection SET redeeming_attempt = ?, redeeming_since = ? WHERE id = ?').run('att_other', t.clock.now, con.id);
    expect(code(await submit())).toBe('GRANT_IN_USE');
    expect(t.lti.calls).toEqual([]);
    expect(attempts(con.id)).toEqual(prior);
    expect(events('grant_attempt_started')).toEqual([]);
    expect(getGrant(t.db, g.id)).toMatchObject({ revokedAt: null, redeemedAt: null });
  });

  it.each(['blackboard', 'canvas', 'add_deployment'] as const)('%s commits its target and bounded event before the first outbound request', async (kind) => {
    const { con, g, submit, deploymentId } = await endpoint(kind);
    const first = kind === 'blackboard' ? 'GET providers' : kind === 'canvas' ? 'POST platform' : 'POST deployment';
    let observed = false;
    const logTransactions: boolean[] = [];
    const push = t.logs.push.bind(t.logs);
    const observer = vi.spyOn(t.logs, 'push').mockImplementation((...lines) => {
      for (const line of lines) if (line.event === 'grant_attempt_started') logTransactions.push(t.db.isTransaction);
      return push(...lines);
    });
    t.lti.faults.push({ op: first, action: 'before', run: () => {
      observed = true;
      expect(t.db.isTransaction).toBe(false);
      const row = attempts(con.id).at(-1)!;
      const current = getConnectionAnyLibrary(t.db, con.id)!;
      expect(row).toMatchObject({ grant_id: g.id, purpose: kind === 'add_deployment' ? kind : 'initial',
        issuer: kind === 'blackboard' ? 'https://blackboard.sim.test' : 'https://canvas.sim.test',
        client_id: kind === 'blackboard' ? BB : 'cA', deployment_id: deploymentId, state: 'open' });
      expect(current.redeemingAttempt).toBe(row.attempt_id);
      expect(events('grant_attempt_started')).toHaveLength(1);
      expect(events('grant_attempt_started')[0]).toMatchObject({ grant_id: g.id, connection_id: con.id, attempt_id: row.attempt_id, purpose: row.purpose });
      expect(Object.keys(events('grant_attempt_started')[0]!).sort()).toEqual(['attempt_id', 'connection_id', 'event', 'grant_id', 'level', 'purpose', 'service', 'trace_id', 'ts']);
    } });
    expect((await submit()).status).toBe(200);
    observer.mockRestore();
    expect(observed).toBe(true);
    expect(logTransactions).toEqual([false]);
    expect(t.lti.calls.filter((s) => s === 'GET providers')).toHaveLength(kind === 'blackboard' ? 1 : 0);
    expect(getGrant(t.db, g.id)?.redeemedAt).not.toBeNull();
  });

  it('a rolled-back phase 1 emits no start event and leaves no attempt, lease or reservation', async () => {
    const { con, submit, g } = await endpoint('blackboard');
    t.db.exec("CREATE TRIGGER reject_reservation BEFORE INSERT ON connection_deployment BEGIN SELECT RAISE(ABORT, 'injected rollback'); END");
    expect((await submit()).status).toBe(500);
    expect(events('grant_attempt_started')).toEqual([]);
    expect(attempts(con.id)).toEqual([]);
    expect(getConnectionAnyLibrary(t.db, con.id)?.redeemingAttempt).toBeNull();
    expect(reservationOfConnection(t.db, con.id)).toBeUndefined();
    expect(t.lti.calls).toEqual([]);
    expect(getGrant(t.db, g.id)?.redeemedAt).toBeNull();
  });

  it.each(['blackboard', 'canvas'] as const)('%s old pending row: grant errors precede check 4a; no attempt is started', async (kind) => {
    const { con, g, submit, a } = await endpoint(kind);
    eraseSnapshot(con.id);
    expect(code(await submit({ grantCode: UNKNOWN_CODE }))).toBe('GRANT_INVALID');
    assertNeutral(await submit({ deploymentId: 'other' })); // check 4a precedes mismatch
    expect(events('provider_not_ready').at(-1)).toMatchObject({ connection_id: con.id, cause: 'no_snapshot' });
    if (kind === 'blackboard') {
      assertNeutral(await call('GET', `/app-api/connections/${con.id}/tool-configuration`, a));
      expect(code(await submit({ clientId: 'valid-form' }))).toBe('PROVIDER_NOT_READY');
      expect(code(await submit({ clientId: 'has space' }))).toBe('INVALID_PLATFORM_VALUES');
    }
    expect(attempts(con.id)).toEqual([]);
    expect(t.lti.calls).toEqual([]);
    expect(events('grant_attempt_started')).toEqual([]);
    expect(getGrant(t.db, g.id)).toMatchObject({ redeemedAt: null, revokedAt: null });
  });

  it.each(['blackboard', 'canvas'] as const)('%s old registered row repeats locally and applies grant errors before snapshot checks', async (kind) => {
    const { con, g, submit } = await endpoint(kind);
    expect((await submit()).status).toBe(200);
    eraseSnapshot(con.id);
    t.lti.calls.length = 0;
    expect((await submit({ grantCode: UNKNOWN_CODE })).status).toBe(200);
    expect(code(await submit({ grantCode: UNKNOWN_CODE, deploymentId: 'other' }))).toBe('GRANT_INVALID');
    expect(events('grant_rejected').at(-1)?.reason).toBe('not_found');
    expect(code(await submit({ grantCode: g.code, deploymentId: 'other' }))).toBe('GRANT_INVALID');
    expect(events('grant_rejected').at(-1)?.reason).toBe('redeemed');
    expect(t.lti.calls).toEqual([]);
  });

  it('old registered Canvas can issue, add and repeat without snapshots or provider reads; existing approval survives', async () => {
    const { con, op, libA, a, submit } = await endpoint('canvas');
    expect((await submit()).status).toBe(200);
    eraseSnapshot(con.id);
    const before = t.db.prepare('SELECT * FROM approved_deployment WHERE connection_id = ?').all(con.id);
    t.lti.calls.length = 0;
    t.lti.providers.length = 0;
    const g = await grant(op, libA, con, 'dB', { purpose: 'add_deployment' });
    expect(t.lti.calls).toEqual([]);
    const add = () => call('POST', `/app-api/connections/${con.id}/deployments`, a, { deploymentId: 'dB', grantCode: g.code });
    expect((await add()).status).toBe(200);
    expect(t.lti.calls.some((s) => s === 'GET providers')).toBe(false);
    t.lti.calls.length = 0;
    expect((await add()).status).toBe(200);
    expect(t.lti.calls).toEqual([]);
    expect(t.db.prepare('SELECT * FROM approved_deployment WHERE connection_id = ? AND deployment_id = ?').all(con.id, 'dA')).toEqual(before);
    expect(getConnectionAnyLibrary(t.db, con.id)?.snapshot).toEqual(NULL_SNAPSHOT);
  });
});

describe('Blackboard V and cancellation-first readiness decisions (§4.7.1, A-D-09)', () => {
  it.each([
    ['missing', 'profile_missing'], ['sharing', 'platform_changed'], ['absent', 'platform_inactive'],
    ['replaced_inactive', 'platform_changed'], ['client_inactive', 'platform_changed'],
    ['issuer_inactive', 'issuer_changed'], ['inactive', 'platform_inactive'],
  ] as const)('V %s: exact diagnostic %s, pinned failed attempt, no remote write', async (change, cause) => {
    const { con, g, shared, submit } = await endpoint('blackboard');
    const profile = t.lti.providers.find((p) => p.id === con.profile)!;
    if (change === 'missing') t.lti.providers.splice(t.lti.providers.indexOf(profile), 1);
    if (change === 'sharing') profile.sharing = 'exclusive';
    if (change === 'absent' || change === 'replaced_inactive') t.lti.platforms.delete(shared.id);
    if (change === 'replaced_inactive') t.lti.addSharedPlatform(con.profile, BB).active = false;
    if (change === 'client_inactive') { shared.clientId = 'another'; shared.active = false; }
    if (change === 'issuer_inactive') { profile.issuer = 'https://changed.test'; shared.active = false; }
    if (change === 'inactive') shared.active = false;
    assertNeutral(await submit());
    expect(t.lti.calls).toEqual(['GET providers']);
    expect(events('provider_not_ready').at(-1)).toMatchObject({ connection_id: con.id, profile: con.profile, cause });
    expect(events('grant_attempt_started')).toHaveLength(1);
    expect(events('grant_redemption_cancelled')).toEqual([]);
    expect(attempts(con.id)).toEqual([expect.objectContaining({ state: 'failed', lti_platform_id: shared.id, client_id: BB })]);
    expect(getConnectionAnyLibrary(t.db, con.id)?.redeemingAttempt).toBeNull();
    expect(getGrant(t.db, g.id)).toMatchObject({ revokedAt: null, redeemedAt: null });
    expect(reservationOfConnection(t.db, con.id)).toMatchObject({ platformId: shared.id, deploymentId: 'dA' });
    expect(t.db.prepare('SELECT * FROM binding_ref_history WHERE connection_id = ?').all(con.id)).toEqual([]);
  });

  it.each([0, 400, 503])('V error status %s maps to 502 and keeps the grant retryable', async (status) => {
    const { con, g, submit } = await endpoint('blackboard');
    t.lti.failNext = { status, code: status === 400 ? 'INVALID_SITE_URL' : 'UNAVAILABLE' };
    const r = await submit();
    expect([r.status, code(r)]).toEqual([502, 'LTI_SERVICE_ERROR']);
    expect(events('http_request').at(-1)).toMatchObject({ status: 502 });
    expect(events('provider_not_ready')).toEqual([]);
    expect(events('grant_redemption_cancelled')).toEqual([]);
    expect(attempts(con.id).at(-1)?.state).toBe('failed');
    expect(t.lti.calls).toEqual(['GET providers']);
    expect(getGrant(t.db, g.id)).toMatchObject({ redeemedAt: null, revokedAt: null });
    expect((await submit()).status).toBe(200);
  });

  it.each(['revoke', 'replace', 'suspend', 'delete', 'takeover', 'lease_cleared'] as const)('cancellation %s wins over every V result and preserves the lease owner', async (cancel) => {
    // Each outcome runs in a fresh app. Assertions use the returned response, so the hook cannot pass silently.
    for (const result of ['matched', 'mismatch', 'failed'] as const) {
      const { con, g, op, libA, a, shared, submit } = await endpoint('blackboard');
      let callsAtEnd = 0;
      t.lti.faults.push({ op: 'GET providers', action: 'before', run: async () => {
        if (cancel === 'revoke') expect((await op.revoke(g.id, 'cancel')).exitCode).toBe(0);
        if (cancel === 'replace') await grant(op, libA, con, 'dA');
        if (cancel === 'suspend') expect((await op.suspend(con.id, 'ticket', 'cancel')).exitCode).toBe(0);
        if (cancel === 'delete') expect((await call('DELETE', `/app-api/connections/${con.id}`, a)).status).toBe(204);
        if (cancel === 'takeover' || cancel === 'lease_cleared') {
          t.db.prepare('UPDATE connection SET redeeming_attempt = ?, redeeming_since = ? WHERE id = ?').run(cancel === 'takeover' ? 'att_new_owner' : null, t.clock.now, con.id);
        }
        if (result === 'mismatch') shared.active = false;
        callsAtEnd = t.lti.calls.length;
        if (result === 'failed') throw new LtiServiceError(0, 'UNAVAILABLE', '');
      } });
      const r = await submit();
      const changed = cancel === 'suspend' || cancel === 'delete';
      const takenOver = cancel === 'takeover' || cancel === 'lease_cleared';
      expect([r.status, code(r)]).toEqual(changed ? [409, 'CONNECTION_NOT_PENDING'] : [403, 'GRANT_INVALID']);
      expect(t.lti.calls).toHaveLength(callsAtEnd);
      expect(events('provider_not_ready')).toEqual([]);
      expect(events('grant_redemption_cancelled').at(-1)?.reason).toBe(changed ? 'connection_changed' : takenOver ? 'taken_over' : cancel === 'replace' ? 'replaced' : 'revoked');
      expect(attempts(con.id).at(-1)?.state).toBe('cancelled');
      expect(getConnectionAnyLibrary(t.db, con.id)?.redeemingAttempt).toBe(cancel === 'takeover' ? 'att_new_owner' : null);
      expect(reservationOfConnection(t.db, con.id)).toMatchObject({ platformId: shared.id, deploymentId: 'dA' });
      expect(getGrant(t.db, g.id)?.redeemedAt).toBeNull();
      if (!takenOver) expect(getGrant(t.db, g.id)?.revokedAt).not.toBeNull();
      expect(deployment(shared.id, 'dA')).toBeUndefined();
      await t.app.close();
    }
  });

  it('S0 after a matched V enforces the six-second minimum without making S1', async () => {
    const { con, submit } = await endpoint('blackboard');
    t.lti.faults.push({ op: 'GET providers', action: 'after', run: () => { t.clock.now += 54_001; } });
    expect(code(await submit())).toBe('LTI_SERVICE_ERROR');
    expect(t.lti.calls).toEqual(['GET providers']);
    expect(attempts(con.id).at(-1)?.state).toBe('failed');
    expect(getConnectionAnyLibrary(t.db, con.id)?.redeemingAttempt).toBeNull();
  });

  it('deactivation after V still binds to the pinned parent without re-resolving it', async () => {
    const { shared, submit } = await endpoint('blackboard');
    t.lti.faults.push({ op: 'GET providers', action: 'after', run: () => { shared.active = false; } });
    expect((await submit()).status).toBe(200);
    expect(shared.active).toBe(false);
    expect(deployment(shared.id, 'dA')).toMatchObject({ active: true, bindingGeneration: 1 });
    expect(t.lti.calls.filter((s) => s === 'GET providers')).toHaveLength(1);
    expect(t.lti.calls[1]).toContain(`POST deployment ${shared.id}`);
  });
});

describe('exact S1 readiness mappings and preserved later-step failures', () => {
  it.each([
    ['blackboard', 404, 'UNREGISTERED_PLATFORM', 'platform_changed'],
    ['canvas', 400, 'UNKNOWN_PROFILE', 'profile_missing'],
    ['canvas', 400, 'PLATFORM_URL_NOT_IN_PROFILE', 'issuer_changed'],
  ] as const)('%s S1 %s %s is neutral readiness; cancellation wins over the same answer', async (kind, status, error, cause) => {
    for (const cancel of [false, true]) {
      const { con, submit, g, op } = await endpoint(kind);
      t.lti.faults.push({ op: kind === 'canvas' ? 'POST platform' : 'POST deployment', action: 'before', run: async () => {
        if (cancel) await op.revoke(g.id, 'cancel');
        throw new LtiServiceError(status, error, '');
      } });
      const r = await submit();
      if (cancel) {
        expect([r.status, code(r)]).toEqual([403, 'GRANT_INVALID']);
        expect(events('provider_not_ready')).toEqual([]);
        expect(events('grant_redemption_cancelled').at(-1)?.reason).toBe('revoked');
      } else {
        assertNeutral(r);
        expect(events('provider_not_ready').at(-1)?.cause).toBe(cause);
        expect(getGrant(t.db, g.id)?.revokedAt).toBeNull();
      }
      expect(attempts(con.id).at(-1)?.state).toBe(cancel ? 'cancelled' : 'failed');
      expect(t.lti.calls.some((s) => s.startsWith('PATCH'))).toBe(false);
      expect(getConnectionAnyLibrary(t.db, con.id)?.redeemingAttempt).toBeNull();
      await t.app.close();
    }
  });

  it('Blackboard deletion and same-client recreation after V never writes to the new platform', async () => {
    const { con, shared, submit } = await endpoint('blackboard');
    let replacement = '';
    t.lti.faults.push({ op: 'GET providers', action: 'after', run: () => {
      t.lti.platforms.delete(shared.id);
      replacement = t.lti.addSharedPlatform(con.profile, BB).id;
    } });
    assertNeutral(await submit());
    expect(t.lti.calls[1]).toContain(`POST deployment ${shared.id}`);
    expect(t.lti.platforms.get(replacement)?.deployments).toEqual([]);
    expect(attempts(con.id).at(-1)?.lti_platform_id).toBe(shared.id);
  });

  it('Canvas issuer drift is refused by the S1 URL pin with no provider pre-read', async () => {
    const { con, submit } = await endpoint('canvas');
    t.lti.providers.find((p) => p.id === con.profile)!.issuer = 'https://changed.test';
    assertNeutral(await submit());
    expect(events('provider_not_ready').at(-1)?.cause).toBe('issuer_changed');
    expect(t.lti.calls).toHaveLength(1);
    expect(t.lti.calls[0]).toContain('"url":"https://canvas.sim.test"');
    expect(attempts(con.id).at(-1)?.issuer).toBe('https://canvas.sim.test');
  });

  it.each([
    ['canvas', 404, 'UNKNOWN_PROFILE', 502, 'LTI_SERVICE_ERROR'],
    ['blackboard', 400, 'UNREGISTERED_PLATFORM', 502, 'LTI_SERVICE_ERROR'],
    ['add_deployment', 404, 'UNREGISTERED_PLATFORM', 502, 'LTI_SERVICE_ERROR'],
    ['canvas', 503, 'UNKNOWN_PROFILE', 502, 'LTI_SERVICE_ERROR'],
    ['canvas', 400, 'INVALID_SITE_URL', 422, 'INVALID_SITE_URL'],
  ] as const)('%s S1 %s %s keeps the normal error mapping', async (kind, status, error, wantStatus, wantCode) => {
    const { submit } = await endpoint(kind);
    t.lti.faults.push({ op: kind === 'canvas' ? 'POST platform' : 'POST deployment', action: 'before', run: () => { throw new LtiServiceError(status, error, ''); } });
    const r = await submit();
    expect([r.status, code(r)]).toEqual([wantStatus, wantCode]);
    expect(events('provider_not_ready')).toEqual([]);
  });

  it.each(['S2', 'S3'] as const)('Blackboard %s 404 remains 502, not a readiness refusal', async (step) => {
    const { shared, submit } = await endpoint('blackboard');
    if (step === 'S2') {
      shared.deployments.push({ deploymentId: 'dA', siteUrl: LEARN_A, active: false, bindingRef: null, bindingGeneration: 0 });
      const read = t.lti.client.getPlatform;
      t.lti.client.getPlatform = async (...args) => { t.lti.platforms.delete(shared.id); return read(...args); };
    } else {
      t.lti.faults.push({ op: 'PATCH deployment', action: 'before', run: () => { t.lti.platforms.delete(shared.id); } });
    }
    const r = await submit();
    expect([r.status, code(r)]).toEqual([502, 'LTI_SERVICE_ERROR']);
    expect(events('provider_not_ready')).toEqual([]);
  });
});

describe('supplemental snapshot boundaries and retained cleanup history', () => {
  it.each(['target_issuer', 'target_platform_id', 'target_client_id'])('a partial Blackboard snapshot missing %s stops at 4a and prevents issue', async (column) => {
    const { con, submit, op, libA } = await endpoint('blackboard');
    t.db.prepare(`UPDATE connection SET ${column} = NULL WHERE id = ?`).run(con.id);
    assertNeutral(await submit());
    expect(events('provider_not_ready').at(-1)?.cause).toBe('no_snapshot');
    expect((await op.issue({ library: libA, connection: con.id, site: con.siteUrl, clientId: BB, deploymentId: 'dA', note: 'ticket', traceId: 't' })).exitCode).toBe(1);
    expect(t.lti.calls).toEqual([]);
    expect(attempts(con.id)).toEqual([]);
  });

  it.each(['id', 'client', 'issuer', 'inactive', 'missing', 'sharing', 'absent'] as const)('the isolated Blackboard %s comparator refuses V and issue without replacing its grant or snapshot', async (field) => {
    const { con, submit, op, libA, shared } = await endpoint('blackboard');
    const snapshot = getConnectionAnyLibrary(t.db, con.id)!.snapshot;
    const before = grantsOfConnection(t.db, con.id);
    const row = t.lti.providers.find((p) => p.id === con.profile)!;
    if (field === 'id') { t.lti.platforms.delete(shared.id); t.lti.addSharedPlatform(con.profile, BB); }
    if (field === 'client') shared.clientId = 'another';
    if (field === 'issuer') row.issuer = 'https://new-issuer.test';
    if (field === 'inactive') shared.active = false;
    if (field === 'missing') t.lti.providers.splice(t.lti.providers.indexOf(row), 1);
    if (field === 'sharing') row.sharing = 'exclusive';
    if (field === 'absent') t.lti.platforms.delete(shared.id);
    assertNeutral(await submit());
    const result = await op.issue({ library: libA, connection: con.id, site: con.siteUrl, clientId: BB, deploymentId: 'dA', note: 'ticket', traceId: 't' });
    expect(result).toEqual({ exitCode: 1, lines: [field === 'inactive' || field === 'absent'
      ? 'The Blackboard shared platform is not active.'
      : 'The Blackboard shared platform changed after this connection was made. Make a new connection.'] });
    expect(t.lti.calls).toEqual(['GET providers', 'GET providers']);
    expect(grantsOfConnection(t.db, con.id)).toEqual(before);
    expect(getConnectionAnyLibrary(t.db, con.id)?.snapshot).toEqual(snapshot);
  });

  it('self-hosted Canvas issue matches the canonical saved issuer and rejects later profile drift or removal', async () => {
    const { a, op, libA } = await setup();
    t.lti.providers.push({ ...t.lti.providers.find((p) => p.lms === 'canvas')!, id: 'canvas-self-hosted', issuer: '{siteUrl}' });
    const r = await call('POST', '/app-api/connections', a, { name: 'Self', siteUrl: 'HTTPS://Canvas.School.EDU:443/', method: 'manual', lms: 'canvas', profile: 'canvas-self-hosted' });
    expect(r.status).toBe(201);
    t.lti.calls.length = 0;
    await grant(op, libA, r.json, 'dA');
    expect(t.lti.calls).toEqual(['GET providers']);
    const before = grantsOfConnection(t.db, r.json.id);
    const input = { library: libA, connection: r.json.id, site: 'HTTPS://CANVAS.SCHOOL.EDU:443/', clientId: 'cA', deploymentId: 'dA', note: 'ticket', traceId: 't' };
    t.lti.providers.find((p) => p.id === 'canvas-self-hosted')!.issuer = 'https://another.school.edu';
    expect((await op.issue(input)).lines).toEqual(['The Canvas profile changed after this connection was made. Make a new connection.']);
    t.lti.providers.splice(t.lti.providers.findIndex((p) => p.id === 'canvas-self-hosted'), 1);
    expect((await op.issue(input)).lines).toEqual(['The Canvas profile changed after this connection was made. Make a new connection.']);
    expect(grantsOfConnection(t.db, r.json.id)).toEqual(before);
    expect(getConnectionAnyLibrary(t.db, r.json.id)?.snapshot.issuer).toBe('https://canvas.school.edu');
  });

  it('an unavailable adapter is refused before parsing and before any provider request', async () => {
    const { submit } = await endpoint('blackboard');
    const lookup = vi.spyOn(TEST_CHANNELS, 'appAdapter').mockReturnValue(null);
    try {
      expect(code(await submit({ grantCode: '', unexpected: true }))).toBe('CAPABILITY_NOT_SUPPORTED');
      expect(t.lti.calls).toEqual([]);
      expect(events('grant_attempt_started')).toEqual([]);
    } finally {
      lookup.mockRestore();
    }
  });

  it('defensive check 4 precedes check 4a on a registered row with an injected unredeemed initial grant', async () => {
    const { con, submit, libA } = await endpoint('canvas');
    expect((await submit()).status).toBe(200);
    eraseSnapshot(con.id);
    insertGrant(t.db, { libraryId: libA, connectionId: con.id, channel: 'canvas', profile: con.profile, purpose: 'initial', siteUrl: con.siteUrl, serviceUrl: con.serviceUrl,
      clientId: 'cA', deploymentId: 'other', note: 'unreachable CLI fixture', expiresAt: t.clock.now + 60_000 }, (await import('@cogniate/shared')).sha256Hex(UNKNOWN_CODE), t.clock.now);
    t.lti.calls.length = 0;
    expect(code(await submit({ grantCode: UNKNOWN_CODE, deploymentId: 'other' }))).toBe('CONNECTION_NOT_PENDING');
    expect(events('provider_not_ready')).toEqual([]);
    expect(t.lti.calls).toEqual([]);
  });

  it('V failure after a lost older activation retains its target for suspend; unrelated approval and ref stay unchanged', async () => {
    const { con, submit, op, libA, a, shared } = await endpoint('blackboard');
    const other = await bbConnection(a, LEARN_B);
    const otherGrant = await grant(op, libA, other, 'dB');
    expect((await putBb(a, other, 'dB', otherGrant.code)).status).toBe(200);
    const otherRemote = structuredClone(deployment(shared.id, 'dB'));
    const otherApproval = t.db.prepare('SELECT * FROM approved_deployment WHERE connection_id = ?').all(other.id);
    t.lti.faults.push({ op: 'PATCH deployment', action: 'drop_after' });
    expect((await submit()).status).toBe(502);
    const older = structuredClone(deployment(shared.id, 'dA'));
    expect(older?.active).toBe(true);
    shared.active = false;
    assertNeutral(await submit());
    expect(deployment(shared.id, 'dA')).toEqual(older);
    expect(attempts(con.id)).toHaveLength(2);
    // Recovery works entirely from historical targets even when a connection has no snapshot.
    eraseSnapshot(con.id);
    const result = await op.suspend(con.id, 'cleanup', 't');
    expect(result.exitCode).toBe(0);
    expect(result.lines.some((line) => line.startsWith('fenced'))).toBe(true);
    expect(deployment(shared.id, 'dA')?.active).toBe(false);
    expect(deployment(shared.id, 'dB')).toEqual(otherRemote);
    expect(t.db.prepare('SELECT * FROM approved_deployment WHERE connection_id = ?').all(other.id)).toEqual(otherApproval);
    expect(attempts(con.id)).toHaveLength(2);
    expect(t.db.prepare('SELECT * FROM binding_ref_history WHERE connection_id = ?').all(con.id)).toHaveLength(3);
    expect((await op.release(con.id, 'release', 't')).exitCode).toBe(0);
    expect(reservationOfConnection(t.db, con.id)).toBeUndefined();
    expect(deployment(shared.id, 'dB')).toEqual(otherRemote);
  });
});

describe('A-M1-03/04: bounded calls and cancellation at S2', () => {
  it.each(['empty', 'revoke', 'replace', 'connection', 'takeover', 'lease_cleared', 'lease_short'] as const)(
    'Canvas empty qualified lookup after %s never sends a fallback or activation', async (change) => {
      const { con, g, submit } = await endpoint('canvas');
      vi.spyOn(t.lti.client, 'createProviderPlatform').mockRejectedValue(new LtiServiceError(409, 'PLATFORM_ALREADY_EXISTS', ''));
      const read = vi.spyOn(t.lti.client, 'findPlatforms').mockImplementation(async () => {
        if (change === 'revoke' || change === 'replace') t.db.prepare('UPDATE binding_grant SET revoked_at = ?, revoked_reason = ? WHERE id = ?')
          .run(t.clock.now, change === 'replace' ? 'replaced' : 'operator', g.id);
        if (change === 'connection') t.db.prepare("UPDATE connection SET status = 'disabled' WHERE id = ?").run(con.id);
        if (change === 'takeover') t.db.prepare('UPDATE connection SET redeeming_attempt = ?, redeeming_since = ? WHERE id = ?').run('att_newer', t.clock.now, con.id);
        if (change === 'lease_cleared') t.db.prepare('UPDATE connection SET redeeming_attempt = NULL, redeeming_since = NULL WHERE id = ?').run(con.id);
        if (change === 'lease_short') t.clock.now += 54_001;
        return [];
      });
      const result = await submit();
      expect(read).toHaveBeenCalledTimes(1);
      expect(read.mock.calls[0]![0]).toEqual({ url: 'https://canvas.sim.test', clientId: 'cA', profile: 'canvas-sim-cloud' });
      const expected = change === 'empty' ? 'PLATFORM_IN_USE' : change === 'connection' ? 'CONNECTION_NOT_PENDING'
        : change === 'lease_short' || change === 'lease_cleared' ? 'LTI_SERVICE_ERROR' : 'GRANT_INVALID';
      expect(code(result)).toBe(expected);
      expect(t.lti.calls).toEqual([]); // Both controlled wire boundaries above are spies; no later call reached the fake.
      expect(getGrant(t.db, g.id)?.redeemedAt).toBeNull();
      expect(getConnectionAnyLibrary(t.db, con.id)?.redeemingAttempt).toBe(change === 'takeover' ? 'att_newer' : null);
      expect(attempts(con.id).at(-1)?.state).toBe(change === 'lease_short' || change === 'lease_cleared' ? 'failed' : 'cancelled');
      expect(t.db.prepare('SELECT 1 FROM approved_deployment WHERE connection_id = ?').get(con.id)).toBeUndefined();
      if (['revoke', 'replace', 'connection', 'takeover'].includes(change)) expect(events('grant_redemption_cancelled').at(-1)?.reason)
        .toBe(change === 'connection' ? 'connection_changed' : change === 'takeover' ? 'taken_over' : change === 'replace' ? 'replaced' : 'revoked');
    });

  it('Canvas removal during the qualified lookup is a non-adoptable result, with no unqualified lookup', async () => {
    const { con, g, submit } = await endpoint('canvas');
    t.lti.faults.push({ op: 'POST platform', action: 'drop_after' });
    expect((await submit()).status).toBe(502);
    const original = t.lti.client.findPlatforms;
    const read = vi.spyOn(t.lti.client, 'findPlatforms').mockImplementation(async (...args) => {
      for (const [id, p] of t.lti.platforms) if (p.profile === 'canvas-sim-cloud') t.lti.platforms.delete(id);
      return original(...args);
    });
    t.lti.calls.length = 0;
    expect(code(await submit())).toBe('PLATFORM_IN_USE');
    expect(read).toHaveBeenCalledTimes(1);
    expect(t.lti.calls).toHaveLength(2); // S1 conflict, one S2 lookup.
    expect(attempts(con.id).at(-1)?.state).toBe('cancelled');
    expect(getGrant(t.db, g.id)?.redeemedAt).toBeNull();
  });

  it.each(['blackboard', 'canvas', 'add_deployment'] as const)('%s stays within its call bound through both S2/S3 rounds', async (kind) => {
    const { con, submit, deploymentId } = await endpoint(kind);
    const platformTarget = kind === 'canvas';
    t.lti.faults.push({ op: platformTarget ? 'POST platform' : 'POST deployment', action: 'drop_after' });
    expect((await submit()).status).toBe(502);
    const p = [...t.lti.platforms.values()].find((row) => row.profile === (kind === 'blackboard' ? 'blackboard-sim' : 'canvas-sim-cloud'))!;
    t.lti.faults.push({ op: platformTarget ? 'PATCH platform' : 'PATCH deployment', action: 'before', run: () => {
      if (platformTarget) p.bindingRef = 'foreign-after-S2';
      else p.deployments.find((row) => row.deploymentId === deploymentId)!.bindingRef = 'foreign-after-S2';
    } });
    t.lti.calls.length = 0;
    expect((await submit()).status).toBe(200);
    expect(t.lti.calls).toHaveLength(kind === 'blackboard' ? 6 : 5);
    expect(t.lti.calls.filter((line) => line.startsWith('PATCH '))).toHaveLength(2);
    expect(attempts(con.id).at(-1)?.state).toBe('committed');
  });

  it.each(['canvas', 'add_deployment'] as const)('%s S2 GET-by-id 404 stays an LTI failure', async (kind) => {
    const { con, g, submit } = await endpoint(kind);
    if (kind === 'canvas') {
      t.lti.faults.push({ op: 'PATCH platform', action: 'before', run: () => { throw new LtiServiceError(409, 'BINDING_REF_MISMATCH', ''); } });
    } else {
      vi.spyOn(t.lti.client, 'addDeployment').mockRejectedValue(new LtiServiceError(409, 'DEPLOYMENT_ALREADY_EXISTS', ''));
    }
    const read = vi.spyOn(t.lti.client, 'getPlatform').mockRejectedValue(new LtiServiceError(404, 'UNREGISTERED_PLATFORM', ''));
    expect(code(await submit())).toBe('LTI_SERVICE_ERROR');
    expect(read).toHaveBeenCalledTimes(1);
    expect(attempts(con.id).at(-1)?.state).toBe('failed');
    expect(getGrant(t.db, g.id)?.redeemedAt).toBeNull();
    expect(getConnectionAnyLibrary(t.db, con.id)?.redeemingAttempt).toBeNull();
    expect(events('grant_redeemed')).toEqual([]);
  });

  it.each([54_000, 54_001])('S2 still requires six seconds of the unchanged 60-second lease (elapsed %s ms)', async (elapsed) => {
    const { con, submit } = await endpoint('canvas');
    t.lti.faults.push({ op: 'POST platform', action: 'drop_after' });
    expect((await submit()).status).toBe(502);
    const original = t.lti.client.findPlatforms;
    vi.spyOn(t.lti.client, 'findPlatforms').mockImplementation(async (...args) => {
      const result = await original(...args);
      t.clock.now += elapsed;
      return result;
    });
    t.lti.calls.length = 0;
    const result = await submit();
    expect(result.status).toBe(elapsed === 54_000 ? 200 : 502);
    expect(t.lti.calls.filter((line) => line.startsWith('PATCH '))).toHaveLength(elapsed === 54_000 ? 1 : 0);
    expect(getConnectionAnyLibrary(t.db, con.id)?.redeemingAttempt).toBeNull();
  });

  it.each(['blackboard', 'canvas', 'add_deployment'] as const)('%s makes no retry wire call when a grant is revoked before a delayed read error', async (kind) => {
    const { con, g, libA, deploymentId } = await endpoint(kind);
    const logger = createLogger({ service: 'cogniate-app', write: (line) => t.logs.push(JSON.parse(line)) });
    let wireCount = 0;
    const outbound = createOutboundClient({ logger, requestImpl: () => {
      wireCount += 1;
      const req = Object.assign(new EventEmitter(), { write: vi.fn(), destroy: vi.fn(), end: () => {
        setTimeout(() => req.emit('error', Object.assign(new Error('reset'), { code: 'ECONNRESET' })), 4100);
      } });
      return req as unknown as ClientRequest;
    } });
    const remote = createLtiClient({ outbound, ltiUrl: 'https://lti.test', apiKeyFile: 'unused', readKey: () => 'test-key' });
    const lti = { ...t.lti.client, getProviders: remote.getProviders, getPlatform: remote.getPlatform, findPlatforms: remote.findPlatforms };
    if (kind === 'canvas') lti.createProviderPlatform = async () => { throw new LtiServiceError(409, 'PLATFORM_ALREADY_EXISTS', ''); };
    if (kind === 'add_deployment') lti.addDeployment = async () => { throw new LtiServiceError(409, 'DEPLOYMENT_ALREADY_EXISTS', ''); };
    const engine = createRedemptionEngine({ urls: TEST_URLS, channels: TEST_CHANNELS, db: t.db, lti, logger, now: () => t.clock.now });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let settled = false;
    const pending = engine.redeem({ connectionId: con.id, libraryId: libA, purpose: kind === 'add_deployment' ? kind : 'initial',
      values: { clientId: kind === 'blackboard' ? BB : 'cA', deploymentId, grantCode: g.code }, traceId: 'wire-cancel-trace' })
      .catch((err: unknown) => { settled = true; return err; });
    await vi.advanceTimersByTimeAsync(4000);
    expect(wireCount).toBe(1);
    t.db.prepare("UPDATE binding_grant SET revoked_at = ?, revoked_reason = 'operator' WHERE id = ?").run(t.clock.now, g.id);
    await vi.advanceTimersByTimeAsync(100);
    expect(wireCount).toBe(1);
    expect(settled).toBe(true);
    expect(await pending).toMatchObject({ code: kind === 'blackboard' ? 'GRANT_INVALID' : 'LTI_SERVICE_ERROR' });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(wireCount).toBe(1);
    expect(t.lti.calls).toEqual([]);
    expect(getGrant(t.db, g.id)?.redeemedAt).toBeNull();
    expect(getConnectionAnyLibrary(t.db, con.id)?.redeemingAttempt).toBeNull();
  });
});

describe('A-M1-05/06: HTTP-correlated refusals and committed success audit', () => {
  it.each(['blackboard', 'canvas', 'add_deployment'] as const)('%s logs the HTTP trace and precise reason for every phase-1 rejection', async (kind) => {
    const { con, g, submit, a } = await endpoint(kind);
    const original = getGrant(t.db, g.id)!;
    const traceId = `round3-rejection-${kind.replace('_', '-')}`;
    const checks = [
      { reason: 'not_found', body: { grantCode: UNKNOWN_CODE } },
      { reason: 'revoked', sql: "UPDATE binding_grant SET revoked_at = 1 WHERE id = ?" },
      { reason: 'redeemed', sql: "UPDATE binding_grant SET redeemed_at = 1 WHERE id = ?" },
      { reason: 'expired', sql: "UPDATE binding_grant SET expires_at = 1 WHERE id = ?" },
      { reason: 'other_library', sql: "UPDATE binding_grant SET library_id = (SELECT id FROM library WHERE id != binding_grant.library_id LIMIT 1) WHERE id = ?" },
      { reason: 'other_connection', sql: "UPDATE binding_grant SET connection_id = ? WHERE id = ?" },
      { reason: 'purpose', sql: "UPDATE binding_grant SET purpose = CASE purpose WHEN 'initial' THEN 'add_deployment' ELSE 'initial' END WHERE id = ?" },
      { reason: 'mismatch', sql: "UPDATE binding_grant SET site_url = 'https://different.test' WHERE id = ?" },
      { reason: 'mismatch', body: { deploymentId: 'different-deployment' } },
    ];
    // A real second connection keeps the foreign-key constraints enabled for the other_connection refusal.
    const other = await bbConnection(a);
    const codeHash = String(t.db.prepare('SELECT code_hash FROM binding_grant WHERE id = ?').get(g.id)!.code_hash);
    t.lti.calls.length = 0;
    for (const check of checks) {
      t.db.prepare('UPDATE binding_grant SET revoked_at = NULL, redeemed_at = NULL, expires_at = ?, library_id = ?, connection_id = ?, purpose = ?, site_url = ? WHERE id = ?')
        .run(original.expiresAt, original.libraryId, original.connectionId, original.purpose, original.siteUrl, g.id);
      if (check.sql) t.db.prepare(check.sql).run(...(check.reason === 'other_connection' ? [other.id, g.id] : [g.id]));
      const before = events('grant_rejected').length;
      const result = await submit(check.body ?? {}, traceId);
      expect(result.status, check.reason).toBe(check.reason === 'mismatch' ? 422 : 403);
      expect(events('grant_rejected')).toHaveLength(before + 1);
      const event = events('grant_rejected').at(-1)!;
      expect(event).toMatchObject({ trace_id: traceId, reason: check.reason, connection_id: con.id });
      expect(Object.keys(event).sort()).toEqual(['connection_id', 'event', 'level', 'reason', 'service', 'trace_id', 'ts']);
      expect(JSON.stringify(event)).not.toContain(g.code);
      expect(JSON.stringify(event)).not.toContain(codeHash);
    }
    expect(t.lti.calls).toEqual([]);
    expect(events('grant_attempt_started')).toEqual([]);
  });

  it.each(['blackboard', 'canvas', 'add_deployment'] as const)('%s emits grant_redeemed only after the approval commit', async (kind) => {
    const { con, g, submit } = await endpoint(kind);
    const observed: boolean[] = [];
    const push = t.logs.push.bind(t.logs);
    vi.spyOn(t.logs, 'push').mockImplementation((...lines) => {
      for (const line of lines) if (line.event === 'grant_redeemed') {
        observed.push(t.db.isTransaction);
        expect(getGrant(t.db, g.id)?.redeemedAt).not.toBeNull();
        expect(attempts(con.id).at(-1)?.state).toBe('committed');
      }
      return push(...lines);
    });
    expect((await submit({}, 'round3-success-trace')).status).toBe(200);
    expect(observed).toEqual([false]);
    expect(events('grant_redeemed')).toEqual([expect.objectContaining({ trace_id: 'round3-success-trace', grant_id: g.id, connection_id: con.id })]);
  });

  it.each(['blackboard', 'canvas', 'add_deployment'] as const)('%s phase-2 COMMIT failure rolls back without a false grant_redeemed event', async (kind) => {
    const { con, g, submit } = await endpoint(kind);
    const prior = getConnectionAnyLibrary(t.db, con.id)!;
    const approvals = t.db.prepare('SELECT * FROM approved_deployment WHERE connection_id = ?').all(con.id);
    // Disposable database only: all statements succeed, then SQLite refuses the deferred constraint at COMMIT.
    t.db.exec(`CREATE TABLE fail_phase2_commit (connection_id TEXT REFERENCES connection(id) DEFERRABLE INITIALLY DEFERRED);
      CREATE TRIGGER reject_phase2_commit AFTER INSERT ON approved_deployment BEGIN
        INSERT INTO fail_phase2_commit VALUES ('missing-connection');
      END;`);
    expect((await submit()).status).toBe(500);
    expect(t.db.isTransaction).toBe(false);
    expect(events('grant_redeemed')).toEqual([]);
    expect(events('grant_attempt_started')).toHaveLength(1);
    expect(getGrant(t.db, g.id)?.redeemedAt).toBeNull();
    expect(getConnectionAnyLibrary(t.db, con.id)).toMatchObject({ status: prior.status, platform: prior.platform });
    expect(t.db.prepare('SELECT * FROM approved_deployment WHERE connection_id = ?').all(con.id)).toEqual(approvals);
    expect(t.db.prepare('SELECT * FROM fail_phase2_commit').all()).toEqual([]);
    expect(attempts(con.id).at(-1)?.state).toBe('open');
  });
});


describe('LA-E1-06 cleanup target kinds', () => {
  it('suspend of an initial and an add-deployment attempt fences one exclusive platform', async () => {
    const { con, op, submit } = await endpoint('add_deployment');
    expect((await submit()).status).toBe(200);
    const platformId = getConnectionAnyLibrary(t.db, con.id)!.ltiPlatformId!;
    t.lti.calls.length = 0;
    const result = await op.suspend(con.id, 'cleanup', 't');
    expect(result.exitCode).toBe(0);
    expect(t.lti.calls.filter((c) => c.startsWith('PATCH'))).toEqual([expect.stringContaining(`PATCH platform ${platformId} `)]);
    expect(t.lti.platforms.get(platformId)?.active).toBe(false);
  });

  it('revoke of an unapproved add-deployment grant switches off only its deployment', async () => {
    const { con, op, g, submit } = await endpoint('add_deployment');
    t.lti.faults.push({ op: 'PATCH deployment', action: 'fail_before' });
    expect((await submit()).status).toBe(502);
    const platformId = getConnectionAnyLibrary(t.db, con.id)!.ltiPlatformId!;
    const added = deployment(platformId, 'dB')!;
    // Model a remote activation with no local approval, as after a lost activation answer.
    added.active = true;
    t.lti.calls.length = 0;
    expect((await op.revoke(g.id, 't')).exitCode).toBe(0);
    expect(t.lti.calls.filter((c) => c.startsWith('PATCH'))).toEqual([expect.stringContaining(`PATCH deployment ${platformId} dB `)]);
    expect(added.active).toBe(false);
    expect(t.lti.platforms.get(platformId)?.active).toBe(true);
    expect(deployment(platformId, 'dA')?.active).toBe(true);
  });

  it('a pending shared connection with no attempt keeps the frozen no-reservation line', async () => {
    const { op, a } = await setup();
    const con = await bbConnection(a);
    expect((await op.suspend(con.id, 'cleanup', 't')).lines).toContain('Binding: Blackboard: no reservation');
  });
});
