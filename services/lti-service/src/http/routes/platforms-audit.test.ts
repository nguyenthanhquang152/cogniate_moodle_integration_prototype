// Audit events of the tenant admin routes (LA-ADR-06 D4 rule 1; contract delta §5). QA proves the same through
// GET /operator/v1/audit on the SIM lane; these unit tests read the writer directly.
import { describe, expect, it, vi } from 'vitest';
import { listAuditEvents } from '../../store/audit.ts';
import type { Harness } from '../../testkit.ts';
import { harness } from '../../testkit.ts';
import * as auth from '../auth.ts';

// One millisecond later per call, so the events of one test sort in call order (newest first: ts, then id).
const call = (h: Harness, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: unknown, auth = `Bearer ${h.apiKey}`) => {
  h.clock.now += 1;
  return h.app.inject({ method, url, headers: { authorization: auth, ...(payload !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}) });
};
const events = (h: Harness) => listAuditEvents(h.db, { limit: 100 }).events.reverse(); // oldest first

const body = (over: Record<string, unknown> = {}) => ({
  url: 'https://moodle2.test', clientId: 'c2', name: 'Moodle 2', authenticationEndpoint: 'https://moodle2.test/mod/lti/auth.php',
  accesstokenEndpoint: 'https://moodle2.test/mod/lti/token.php', authConfig: { method: 'JWK_SET', key: 'https://moodle2.test/mod/lti/certs.php' },
  deploymentIds: ['7'], ...over,
});

describe('audit events of /api/platforms*', () => {
  it('uses the actor from authentication for successful and refused changes', async () => {
    const h = await harness();
    const caller = auth.authenticate(h.db, `Bearer ${h.apiKey}`, ['bearer'], h.clock.now, () => { throw new Error('authentication failed'); });
    const actor = { type: 'api_key' as const, id: 'key-id-from-auth' };
    const spy = vi.spyOn(auth, 'authenticate').mockReturnValue({ ...caller, actor });
    try {
      expect((await call(h, 'POST', '/api/platforms', body())).statusCode).toBe(201);
      expect((await call(h, 'POST', '/api/platforms', body())).statusCode).toBe(409);
      expect(events(h).map((e) => [e.result, e.actor])).toEqual([['ok', actor], ['refused', actor]]);
    } finally { spy.mockRestore(); await h.app.close(); h.db.close(); }
  });

  it('AC-LA-E5-02-01: one POST /api/platforms makes one platform.create event (actor api_key:bootstrap-<account>, tenant, ok)', async () => {
    const h = await harness();
    const res = await call(h, 'POST', '/api/platforms', body());
    expect(res.statusCode).toBe(201);
    const id = (res.json() as { id: string }).id;
    const list = events(h);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      actor: { type: 'api_key', id: 'bootstrap-cogniate' }, toolAccountId: 'cogniate', action: 'platform.create', target: { type: 'platform', id },
      result: 'ok', code: null, traceId: res.headers['x-trace-id'], clientIp: '127.0.0.1', details: { profile: 'standard', active: true },
    });
  });

  it('AC-LA-E5-02-02: a 409 PLATFORM_ALREADY_EXISTS makes one refused event with the code; a 400 too', async () => {
    const h = await harness();
    await call(h, 'POST', '/api/platforms', body());
    expect((await call(h, 'POST', '/api/platforms', body())).statusCode).toBe(409);
    expect((await call(h, 'POST', '/api/platforms', body({ url: 'not a url' }))).statusCode).toBe(400);
    expect(events(h).map((e) => [e.action, e.result, e.code, e.target.id])).toEqual([
      ['platform.create', 'ok', null, expect.stringMatching(/^plt_/)],
      ['platform.create', 'refused', 'PLATFORM_ALREADY_EXISTS', null],
      ['platform.create', 'refused', 'INVALID_REQUEST', null],
    ]);
  });

  it('AC-LA-E5-02-03: PATCH, DELETE, POST deployments and PATCH deployment each make one event with the contract action', async () => {
    const h = await harness();
    const id = ((await call(h, 'POST', '/api/platforms', body())).json() as { id: string }).id;
    expect((await call(h, 'PATCH', `/api/platforms/${id}`, { name: 'Renamed', active: false })).statusCode).toBe(200);
    expect((await call(h, 'POST', `/api/platforms/${id}/deployments`, { deploymentId: '8' })).statusCode).toBe(201);
    expect((await call(h, 'PATCH', `/api/platforms/${id}/deployments/8`, { active: false })).statusCode).toBe(200);
    expect((await call(h, 'DELETE', `/api/platforms/${id}`)).statusCode).toBe(204);
    expect(events(h).map((e) => [e.action, e.result, e.target, e.details])).toEqual([
      ['platform.create', 'ok', { type: 'platform', id }, { profile: 'standard', active: true }],
      ['platform.update', 'ok', { type: 'platform', id }, { fields: ['name', 'active'], active: false }],
      ['deployment.create', 'ok', { type: 'deployment', id: '8' }, { platformId: id, active: true }],
      ['deployment.update', 'ok', { type: 'deployment', id: '8' }, { platformId: id, fields: ['active'], active: false }],
      ['platform.delete', 'ok', { type: 'platform', id }, { profile: 'standard' }],
    ]);
    expect(events(h).every((e) => e.toolAccountId === 'cogniate' && e.actor.id === 'bootstrap-cogniate')).toBe(true);
  });

  it('a refused PATCH, DELETE or deployment call makes one refused event with the target of the URL', async () => {
    const h = await harness();
    for (const [method, url, payload] of [
      ['PATCH', '/api/platforms/plt_unknown', { name: 'x' }], ['DELETE', '/api/platforms/plt_unknown', undefined],
      ['POST', '/api/platforms/plt_unknown/deployments', { deploymentId: '9' }], ['PATCH', `/api/platforms/${h.platform.id}/deployments/nope`, { active: false }],
    ] as const) {
      expect((await call(h, method, url, payload)).statusCode).toBeGreaterThanOrEqual(400);
    }
    expect(events(h).map((e) => [e.action, e.result, e.code, e.target.id])).toEqual([
      ['platform.update', 'refused', 'UNREGISTERED_PLATFORM', 'plt_unknown'],
      ['platform.delete', 'refused', 'UNREGISTERED_PLATFORM', 'plt_unknown'],
      ['deployment.create', 'refused', 'UNREGISTERED_PLATFORM', null],
      ['deployment.update', 'refused', 'UNKNOWN_DEPLOYMENT', 'nope'],
    ]);
  });

  it('AC-LA-E5-02-05 (tenant part): GET /api/platforms writes no event; an unauthenticated change writes none', async () => {
    const h = await harness();
    expect((await call(h, 'GET', '/api/platforms')).statusCode).toBe(200);
    expect((await call(h, 'GET', '/api/providers')).statusCode).toBe(200);
    expect((await call(h, 'POST', '/api/platforms', body(), 'Bearer ltis_wrong')).statusCode).toBe(401);
    expect((await call(h, 'DELETE', `/api/platforms/${h.platform.id}`, undefined, '')).statusCode).toBe(401);
    expect(events(h)).toEqual([]);
  });

  it('each tenant event has its own account (two tool accounts)', async () => {
    const h = await harness();
    await call(h, 'POST', '/api/platforms', body());
    await call(h, 'POST', '/api/platforms', body({ url: 'https://moodle3.test', authenticationEndpoint: 'https://moodle3.test/a', accesstokenEndpoint: 'https://moodle3.test/t', authConfig: { method: 'JWK_SET', key: 'https://moodle3.test/k' } }), `Bearer ${h.otherApiKey}`);
    expect(listAuditEvents(h.db, { limit: 10, toolAccountId: 'qa-second' }).events.map((e) => [e.toolAccountId, e.actor.id])).toEqual([['qa-second', 'bootstrap-qa-second']]);
    expect(listAuditEvents(h.db, { limit: 10, toolAccountId: 'cogniate' }).events.map((e) => e.toolAccountId)).toEqual(['cogniate']);
  });
});
