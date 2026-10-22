import { toolContext } from './setup/common.ts';
import { TEST_URLS } from '../testkit.ts';
import { buildChannelRegistry } from '@cogniate/channel-kernel';
import type { ChannelManifest } from '@cogniate/channel-kernel';
import { createLogger } from '@cogniate/shared';
import { afterEach, expect, it } from 'vitest';
import { TEST_CHANNELS, THANH, testApp } from '../testkit.ts';
import type { TestApp } from '../testkit.ts';
import { createBindingCleanup } from '../app/binding-cleanup.ts';
import { createOperator } from '../app/operator.ts';
import type { ConnectionSetup } from './ports.ts';

const manifest: ChannelManifest = {
  id: 'zz-test', family: 'lti13', names: { text: 'Test LMS', label: 'Test LMS' }, availability: 'ga',
  card: { title: 'Test LMS', description: 'Unit fixture', mark: 'Z', color: 'gray', category: 'LMS Publishing', order: 90 },
  registration: [{ method: 'manual', authority: 'operatorGrant', profiles: ['zz-profile'], defaultProfile: 'zz-profile' }],
  capabilities: {}, setup: { createFields: [], bindingFields: [] },
  texts: { adminSteps: [], teacherSteps: [], disconnect: 'Stop.', notReady: null },
};
const adapter: ConnectionSetup = {
  channel: 'zz-test', profiles: { 'zz-profile': { sharing: 'exclusive', serviceUrl: false, label: 'Fixture' } },
  sharingOf: (id) => id === 'zz-profile' ? 'exclusive' : null,
  checkCreate: ({ siteUrl }) => ({ ok: true, siteUrl, serviceUrl: siteUrl }),
  toolConfiguration: () => [],
  parseBindingBody: (body) => {
    const v = body as { clientId: string; deploymentId: string; grantCode?: string; issuer?: string };
    return { ok: true, values: { clientId: v.clientId, deploymentId: v.deploymentId, grantCode: v.grantCode ?? '',
      ...(v.issuer ? { adminValues: { issuer: v.issuer, authenticationEndpoint: `${v.issuer}/auth`, accessTokenEndpoint: `${v.issuer}/token`, jwksUrl: `${v.issuer}/keys` } } : {}) } };
  },
  initialTarget: ({ connection, values, profile }) => ({ kind: 'exclusive_platform', profile: connection.profile, issuer: profile.issuer!,
    clientId: values.clientId, deploymentId: values.deploymentId, siteUrl: connection.siteUrl, serviceUrl: connection.serviceUrl, platformId: null }),
  createRequest: (target, ctx) => {
    expect(ctx).toMatchObject(toolContext(TEST_URLS));
    if (target.kind !== 'exclusive_platform') throw new Error('fixture needs an exclusive target');
    return { kind: 'platform', body: { profile: target.profile, url: target.issuer, clientId: target.clientId, name: 'Fixture', siteUrl: target.siteUrl, deploymentIds: [target.deploymentId] } };
  },
  selfCreate: (v, ctx) => {
    expect(ctx).toMatchObject(toolContext(TEST_URLS));
    return { kind: 'platform', body: { url: v.issuer, clientId: v.clientId, name: 'Fixture', authenticationEndpoint: v.authenticationEndpoint,
    accesstokenEndpoint: v.accessTokenEndpoint, authConfig: { method: 'JWK_SET', key: v.jwksUrl }, deploymentIds: [v.deploymentId] } };
  },
};
const channels = buildChannelRegistry([
  ...TEST_CHANNELS.channels().map((m) => ({ folder: `/test/${m.id}`, manifest: m, appAdapter: TEST_CHANNELS.appAdapter(m.id) })),
  { folder: '/test/zz-test', manifest, appAdapter: adapter },
], { simulations: true });
let t: TestApp;
afterEach(async () => { await t?.app.close(); });

async function setup() {
  t = await testApp({ channels });
  t.lti.providers.push({ id: 'zz-profile', lms: 'zz-test', label: 'Fixture', sharing: 'exclusive', issuer: 'https://issuer.test',
    authenticationEndpoint: 'https://issuer.test/auth', accesstokenEndpoint: 'https://issuer.test/token', jwksUrl: 'https://issuer.test/keys',
    siteUrlOn: 'platform', serviceUrl: false, simulation: false, sharedPlatform: null });
  const cookie = await t.login(THANH);
  const created = await t.app.inject({ method: 'POST', url: '/app-api/connections', headers: t.writeHeaders(cookie),
    payload: { name: 'Test', channel: 'zz-test', siteUrl: 'https://school.test', method: 'manual' } });
  expect(created.statusCode).toBe(201);
  const c = created.json<{ id: string }>();
  const library = String(t.db.prepare('SELECT library_id FROM connection WHERE id = ?').get(c.id)!.library_id);
  const logger = createLogger({ service: 'test', write: () => {} });
  const cleanup = createBindingCleanup({ db: t.db, lti: t.lti.client, logger, now: () => t.clock.now });
  const op = createOperator({ channels, db: t.db, lti: t.lti.client, logger, cleanup, now: () => t.clock.now });
  const input = { library, connection: c.id, site: 'https://school.test', clientId: 'client', deploymentId: 'd', note: 'test', traceId: 'trace' };
  const bind = (payload: object) => t.app.inject({ method: 'PUT', url: `/app-api/connections/${c.id}/platform`, headers: t.writeHeaders(cookie), payload });
  const disconnect = () => t.app.inject({ method: 'DELETE', url: `/app-api/connections/${c.id}`, headers: t.writeHeaders(cookie) });
  return { c, op, input, bind, disconnect };
}

it('AC-04/05: zz-test operator authority issues a grant, commits two phases, and fences its binding', async () => {
  const { c, op, input, bind, disconnect } = await setup();
  const issued = await op.issue(input);
  expect(issued.exitCode, issued.lines.join('\n')).toBe(0);
  const grantCode = issued.lines.find((line) => line.startsWith('Approval code'))!.split(': ')[1]!;
  const answer = await bind({ clientId: 'client', deploymentId: 'd', grantCode });
  expect(answer.statusCode).toBe(200);
  expect(t.db.prepare('SELECT COUNT(*) AS n FROM approved_deployment WHERE connection_id = ?').get(c.id)?.n).toBe(1);
  expect(t.db.prepare('SELECT target_kind FROM binding_attempt WHERE connection_id = ?').get(c.id)?.target_kind).toBe('exclusive_platform');
  expect(t.lti.calls.some((line) => line.startsWith('POST platform ') && line.includes('"active":false'))).toBe(true);
  expect(t.lti.calls.some((line) => line.startsWith('PATCH platform ') && line.includes('"active":true') && line.includes('ifBindingRef'))).toBe(true);
  expect((await op.issue({ ...input, purpose: 'add_deployment', deploymentId: 'd2' })).exitCode).toBe(1);
  expect(t.db.prepare('SELECT COUNT(*) AS n FROM binding_grant WHERE connection_id = ?').get(c.id)?.n).toBe(1);
  t.lti.calls.length = 0;
  expect((await disconnect()).statusCode).toBe(204);
  expect(t.lti.calls.filter((line) => line.startsWith('PATCH platform '))).toEqual([expect.stringContaining('"ifBindingRef":')]);
});

it('AC-04/05: zz-test stored self authority binds without a grant and disconnects unconditionally', async () => {
  const { c, op, input, bind, disconnect } = await setup();
  // Deliberately differs from this channel's manifest default: the stored authority must win.
  t.db.prepare("UPDATE connection SET binding_authority = 'self' WHERE id = ?").run(c.id);
  expect((await op.issue(input)).exitCode).toBe(1);
  expect(t.db.prepare('SELECT COUNT(*) AS n FROM binding_grant WHERE connection_id = ?').get(c.id)?.n).toBe(0);
  expect((await bind({ issuer: 'https://school.test', clientId: 'client', deploymentId: 'd' })).statusCode).toBe(200);
  expect(t.db.prepare('SELECT COUNT(*) AS n FROM binding_attempt WHERE connection_id = ?').get(c.id)?.n).toBe(0);
  expect(t.db.prepare('SELECT COUNT(*) AS n FROM approved_deployment WHERE connection_id = ?').get(c.id)?.n).toBe(0);
  t.lti.calls.length = 0;
  expect((await disconnect()).statusCode).toBe(204);
  expect(t.lti.calls).toHaveLength(1);
  expect(t.lti.calls[0]).toMatch(/^PATCH platform \S+ \{"active":false\}$/);
});
