// LA-E2-04 (LA-ADR-02 D6): app:grant issue binds the admin values of an admin-value connection; a staged registration
// binds the values of its staged platform; app:grant list prints them. Unit level with the fake LTI service.
import { createLogger } from '@cogniate/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { grantsOfConnection } from '../domain/bindings.ts';
import { stageRegistration } from '../domain/connections.ts';
import type { TestApp } from '../testkit.ts';
import { TEST_CHANNELS, THANH, ltiPlatform, testApp } from '../testkit.ts';
import { listAuditEvents } from './audit.ts';
import { createBindingCleanup } from './binding-cleanup.ts';
import type { IssueInput } from './operator.ts';
import { createOperator } from './operator.ts';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const SITE = 'https://lms.school.edu';
const SCHOOL_A = 'https://school-a.canvas.sim.test';
const VALUES = { issuer: `${SITE}/sakai`, authenticationEndpoint: `${SITE}/auth`, accessTokenEndpoint: `${SITE}/token`, jwksUrl: `${SITE}/jwks` };

let t: TestApp;
afterEach(async () => { await t?.app.close(); });

async function setup() {
  t = await testApp();
  const logger = createLogger({ service: 'cogniate-app', level: 'debug', write: (l) => t.logs.push(JSON.parse(l)) });
  const cleanup = createBindingCleanup({ db: t.db, lti: t.lti.client, logger, now: () => t.clock.now });
  const op = createOperator({ channels: TEST_CHANNELS, db: t.db, lti: t.lti.client, logger, cleanup, now: () => t.clock.now, env: {} });
  const cookie = await t.login(THANH);
  const create = async (payload: Json) => {
    const r = await t.app.inject({ method: 'POST', url: '/app-api/connections', headers: t.writeHeaders(cookie), payload: { name: 'School', ...payload } });
    expect(r.statusCode, r.body).toBe(201);
    return r.json() as { id: string; siteUrl: string };
  };
  const library = String(t.db.prepare('SELECT id FROM library WHERE name = ?').get(THANH.library)!.id);
  const input = (c: { id: string; siteUrl: string }, over: Partial<IssueInput> = {}): IssueInput =>
    ({ library, connection: c.id, site: c.siteUrl, clientId: 'client-1', deploymentId: 'dep-1', note: 'ticket', traceId: 't', ...over });
  const refusedCodes = () => listAuditEvents(t.db, { limit: 500 }).events.filter((e) => e.result === 'refused').map((e) => e.code).sort();
  return { op, create, input, refusedCodes };
}

describe('AC-LA-E2-04-01: the bound-value flags', () => {
  it('AC-LA-E2-04-01: an admin-value connection without a staged platform needs --issuer, --auth-url, --token-url and --jwks-url', async () => {
    const { op, create, input, refusedCodes } = await setup();
    const c = await create({ siteUrl: SITE, method: 'manual', lms: 'lti-generic' });
    expect(await op.issue(input(c))).toEqual({ exitCode: 1, lines: ['This connection binds its admin values. Add --issuer, --auth-url, --token-url, --jwks-url.'] });
    expect(await op.issue(input(c, { boundValues: { issuer: VALUES.issuer, jwksUrl: VALUES.jwksUrl } }))).toEqual({ exitCode: 1, lines: ['This connection binds its admin values. Add --auth-url, --token-url.'] });
    expect(grantsOfConnection(t.db, c.id)).toEqual([]);
    expect(refusedCodes()).toEqual(['bound_values_missing', 'bound_values_missing']);
  });

  it('AC-LA-E2-04-01: the same flags on a fixed-endpoint (Canvas) connection exit 1 and store nothing', async () => {
    const { op, create, input, refusedCodes } = await setup();
    const c = await create({ siteUrl: SCHOOL_A, method: 'manual', lms: 'canvas', profile: 'canvas-sim-cloud' });
    expect(await op.issue(input(c, { clientId: 'cA', boundValues: { issuer: 'https://canvas.sim.test' } }))).toEqual({ exitCode: 1,
      lines: ['--issuer, --auth-url, --token-url, --jwks-url and --token-audience are only for an initial grant of a connection with admin values.'] });
    expect(grantsOfConnection(t.db, c.id)).toEqual([]);
    expect(refusedCodes()).toEqual(['bound_values_not_allowed']);
  });

  it('refuses a value that is not an https URL, and an issuer off the connection site', async () => {
    const { op, create, input } = await setup();
    const c = await create({ siteUrl: SITE, method: 'manual', lms: 'lti-generic' });
    expect((await op.issue(input(c, { boundValues: { ...VALUES, jwksUrl: 'http://lms.school.edu/jwks' } }))).lines).toEqual(['--jwks-url must be an https URL.']);
    expect((await op.issue(input(c, { boundValues: { ...VALUES, issuer: 'https://other.school.edu/sakai' } }))).lines).toEqual(['--issuer must be on the site URL of this connection.']);
    expect(grantsOfConnection(t.db, c.id)).toEqual([]);
  });
});

describe('AC-LA-E2-04-02: bound values before the code, and foreign hosts', () => {
  it('AC-LA-E2-04-02: prints the bound values before the code; the grant row has bound_values; list prints them', async () => {
    const { op, create, input } = await setup();
    const c = await create({ siteUrl: SITE, method: 'manual', lms: 'lti-generic' });
    const r = await op.issue(input(c, { boundValues: { ...VALUES, issuer: 'HTTPS://LMS.School.Edu:443' } }));
    expect(r.exitCode, r.lines.join('\n')).toBe(0);
    const at = (prefix: string) => r.lines.findIndex((l) => l.startsWith(prefix));
    expect(r.lines.slice(at('Issuer:'), at('Grant id:'))).toEqual([
      `Issuer: ${SITE}`, `Authentication URL: ${VALUES.authenticationEndpoint}`, `Token URL: ${VALUES.accessTokenEndpoint}`, `JWKS URL: ${VALUES.jwksUrl}`,
    ]);
    expect(at('Deployment ID:')).toBeLessThan(at('Issuer:'));
    expect(at('Approval code')).toBeGreaterThan(at('Grant id:'));
    const [grant] = grantsOfConnection(t.db, c.id);
    expect(grant!.boundValues).toEqual({ issuer: SITE, authenticationEndpoint: VALUES.authenticationEndpoint, accessTokenEndpoint: VALUES.accessTokenEndpoint, jwksUrl: VALUES.jwksUrl });
    expect(op.list(c.id).lines[0]).toContain(`issuer=${SITE} authenticationEndpoint=${VALUES.authenticationEndpoint} accessTokenEndpoint=${VALUES.accessTokenEndpoint} jwksUrl=${VALUES.jwksUrl}`);
  });

  it('AC-LA-E2-04-02: marks each value whose host is not the issuer host; without --confirm-foreign-hosts it exits 1 and stores nothing', async () => {
    const { op, create, input, refusedCodes } = await setup();
    const c = await create({ siteUrl: SITE, method: 'manual', lms: 'lti-generic' });
    const foreign = { ...VALUES, accessTokenEndpoint: 'https://auth.provider.test/token', tokenAudience: 'https://auth.provider.test/aud' };
    const refused = await op.issue(input(c, { boundValues: foreign }));
    expect(refused.exitCode).toBe(1);
    expect(refused.lines.slice(-6)).toEqual([
      `Issuer: ${VALUES.issuer}`, `Authentication URL: ${VALUES.authenticationEndpoint}`, 'Token URL: https://auth.provider.test/token [not on the issuer host]',
      `JWKS URL: ${VALUES.jwksUrl}`, 'Token audience: https://auth.provider.test/aud [not on the issuer host]',
      'A value is not on the issuer host. Check with the LMS administrator that the vendor issued this client id for this issuer at that host, then add --confirm-foreign-hosts.',
    ]);
    expect(refused.lines.some((l) => l.startsWith('Approval code'))).toBe(false);
    expect([grantsOfConnection(t.db, c.id), refusedCodes()]).toEqual([[], ['foreign_hosts_unconfirmed']]);
    const ok = await op.issue(input(c, { boundValues: foreign, confirmForeignHosts: true }));
    expect(ok.exitCode).toBe(0);
    expect(grantsOfConnection(t.db, c.id)[0]!.boundValues).toEqual(foreign);
  });
});

describe('the staged registration (AC-LA-E2-04-06; --accept-staged)', () => {
  async function stagedConnection(ctx: Awaited<ReturnType<typeof setup>>) {
    const c = await ctx.create({ siteUrl: SITE, method: 'dynamic', lms: 'lti-generic' });
    const platform = ltiPlatform({ id: 'plt_staged', url: `${SITE}/sakai`, clientId: 'client-1', active: false, deploymentIds: ['dep-1'], profile: 'lti-generic', bindingRef: 'ref-staged',
      authenticationEndpoint: `${SITE}/auth`, accesstokenEndpoint: 'https://auth.provider.test/token', authConfig: { method: 'JWK_SET', key: `${SITE}/jwks` }, clientAssertionAud: 'https://auth.provider.test/aud' });
    t.lti.platforms.set(platform.id, platform);
    expect(stageRegistration(t.db, c.id, 'lti-generic', { id: platform.id, issuer: platform.url, clientId: platform.clientId, deploymentIds: platform.deploymentIds, productFamilyCode: null }, t.clock.now)).toBe(true);
    return { c, platform };
  }

  it('AC-LA-E2-04-06: --accept-staged on a connection without a staged platform exits 1 and stores nothing', async () => {
    const ctx = await setup();
    const manual = await ctx.create({ siteUrl: SITE, method: 'manual', lms: 'lti-generic' });
    const canvas = await ctx.create({ siteUrl: SCHOOL_A, method: 'manual', lms: 'canvas', profile: 'canvas-sim-cloud' });
    for (const c of [manual, canvas]) {
      expect(await ctx.op.issue(ctx.input(c, { acceptStaged: true, clientId: c === canvas ? 'cA' : 'client-1' }))).toEqual({ exitCode: 1, lines: ['--accept-staged needs a connection with a staged registration.'] });
      expect(grantsOfConnection(t.db, c.id)).toEqual([]);
    }
    expect(ctx.refusedCodes()).toEqual(['not_staged', 'not_staged']);
  });

  it('--accept-staged prints the staged values, needs the foreign-host confirmation, and binds them', async () => {
    const ctx = await setup();
    const { c, platform } = await stagedConnection(ctx);
    expect((await ctx.op.issue(ctx.input(c))).lines).toEqual(['This connection has a staged registration. Add --accept-staged to bind its values.']);
    expect((await ctx.op.issue(ctx.input(c, { boundValues: VALUES }))).lines).toEqual(['A staged registration takes its values from the staged platform. Use --accept-staged.']);
    expect((await ctx.op.issue(ctx.input(c, { acceptStaged: true, clientId: 'other' }))).lines).toEqual(['--client-id is not the client id of the staged platform.']);
    expect((await ctx.op.issue(ctx.input(c, { acceptStaged: true, deploymentId: 'dep-9' }))).lines).toEqual(['--deployment-id is not a deployment of the staged platform.']);
    const unconfirmed = await ctx.op.issue(ctx.input(c, { acceptStaged: true }));
    expect(unconfirmed.exitCode).toBe(1);
    expect(unconfirmed.lines).toContain('Token URL: https://auth.provider.test/token [not on the issuer host]');
    expect(grantsOfConnection(t.db, c.id)).toEqual([]);
    const ok = await ctx.op.issue(ctx.input(c, { acceptStaged: true, confirmForeignHosts: true }));
    expect(ok.exitCode, ok.lines.join('\n')).toBe(0);
    expect(ok.lines).toContain(`Issuer: ${SITE}/sakai`);
    expect(grantsOfConnection(t.db, c.id)[0]!.boundValues).toEqual({ issuer: `${SITE}/sakai`, authenticationEndpoint: `${SITE}/auth`,
      accessTokenEndpoint: 'https://auth.provider.test/token', jwksUrl: `${SITE}/jwks`, tokenAudience: 'https://auth.provider.test/aud' });
    // A staged platform that changed (here: switched on) is refused.
    t.lti.platforms.get(platform.id)!.active = true;
    expect((await ctx.op.issue(ctx.input(c, { acceptStaged: true, confirmForeignHosts: true }))).lines).toEqual(['The staged platform changed after the registration. Make a new connection.']);
    expect(ctx.refusedCodes()).toEqual(['bound_values_missing', 'bound_values_not_allowed', 'client_id_mismatch', 'deployment_mismatch', 'foreign_hosts_unconfirmed', 'staged_values_changed']);
  });
});
