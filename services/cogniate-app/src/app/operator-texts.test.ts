// LA-E1-12 (LA-ADR-01 D10, D12): the operator and redemption texts take LMS names from the registry. The baseline
// channels keep the M1 bytes; a new channel that offers the feature joins the name list.
import type { ChannelManifest, ChannelRegistry } from '@cogniate/channel-kernel';
import { buildChannelRegistry } from '@cogniate/channel-kernel';
import { createLogger } from '@cogniate/shared';
import { afterEach, expect, it } from 'vitest';
import type { TestApp } from '../testkit.ts';
import { TEST_CHANNELS, TEST_URLS, THANH, testApp } from '../testkit.ts';
import { createBindingCleanup } from './binding-cleanup.ts';
import { createOperator } from './operator.ts';
import type { IssueInput } from './operator.ts';

const LEARN_A = 'https://learn-a.blackboard.sim.test';

/** A channel with an operator-grant method, named `ZZ LMS`, after the baseline channels in registry order. */
const zzChannel: ChannelManifest = {
  ...TEST_CHANNELS.channel('canvas')!, id: 'zz-grant', names: { text: 'ZZ LMS', label: 'ZZ LMS' },
  card: { ...TEST_CHANNELS.channel('canvas')!.card, order: 99 },
  registration: [{ method: 'manual', authority: 'operatorGrant', profiles: ['zz-grant-profile'], defaultProfile: 'zz-grant-profile' }],
  lti: { guardedFamilies: [], toolConfiguration: 'none' },
};
const withZz = buildChannelRegistry([...TEST_CHANNELS.channels(), zzChannel]
  .map((manifest) => ({ folder: `/test/${manifest.id}`, manifest, appAdapter: TEST_CHANNELS.appAdapter(manifest.id) ?? undefined })), { simulations: true });

let t: TestApp;
afterEach(async () => { await t?.app.close(); });

async function setup(channels: ChannelRegistry) {
  t = await testApp({ channels });
  t.lti.addSharedPlatform('blackboard-sim', 'qa-bb-app');
  const logger = createLogger({ service: 'cogniate-app', write: (l) => t.logs.push(JSON.parse(l)) });
  const cleanup = createBindingCleanup({ db: t.db, lti: t.lti.client, logger, now: () => t.clock.now });
  const op = createOperator({ channels, db: t.db, lti: t.lti.client, logger, cleanup, now: () => t.clock.now, env: {} });
  const cookie = await t.login(THANH);
  const create = async (payload: Record<string, unknown>) => {
    const r = await t.app.inject({ method: 'POST', url: '/app-api/connections', headers: t.writeHeaders(cookie), payload });
    expect(r.statusCode).toBe(201);
    return r.json() as { id: string; siteUrl: string };
  };
  const library = String(t.db.prepare('SELECT id FROM library WHERE name = ?').get(THANH.library)!.id);
  const input = (c: { id: string; siteUrl: string }, over: Partial<IssueInput> = {}): IssueInput =>
    ({ library, connection: c.id, site: c.siteUrl, clientId: 'qa-bb-app', deploymentId: 'dA', note: 'ticket', traceId: 't', ...over });
  return { op, create, input };
}

it('the issue refusals keep the M1 lines with the baseline registry', async () => {
  const { op, create, input } = await setup(TEST_CHANNELS);
  const moodle = await create({ name: 'Moodle', siteUrl: TEST_URLS.moodle, method: 'manual' });
  const bb = await create({ name: 'Learn', siteUrl: LEARN_A, method: 'manual', lms: 'blackboard', profile: 'blackboard-sim' });
  expect((await op.issue(input(moodle))).lines).toEqual(['Approval grants are only for Canvas and Blackboard connections.']);
  expect((await op.issue(input(bb, { purpose: 'add_deployment' }))).lines).toEqual(['An add_deployment grant needs a registered or connected Canvas connection.']);
  expect((await op.issue(input(bb, { serviceUrl: 'https://other.blackboard.sim.test' }))).lines).toEqual(['--service-url is only for Canvas connections.']);
  expect((await op.issue(input(bb, { clientId: 'another-app' }))).lines).toEqual(['--client-id is not the Blackboard Application ID of the shared platform.']);
  expect((await op.suspend(bb.id, 'cleanup', 't')).lines).toContain('Binding: Blackboard: no reservation');
});

it('a new channel with an operator-grant method joins the name list in registry order', async () => {
  const { op, create, input } = await setup(withZz);
  const moodle = await create({ name: 'Moodle', siteUrl: TEST_URLS.moodle, method: 'manual' });
  expect((await op.issue(input(moodle))).lines).toEqual(['Approval grants are only for Canvas, Blackboard and ZZ LMS connections.']);
});
