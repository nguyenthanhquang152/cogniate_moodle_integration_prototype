import { buildChannelRegistry } from '@cogniate/channel-kernel';
import type { ChannelManifest } from '@cogniate/channel-kernel';
import { afterEach, describe, expect, it } from 'vitest';
import { TEST_CHANNELS } from '../testkit.ts';
import { createConnection, disableConnection, getConnectionAnyLibrary, markRegistered, replaceRef, routeLaunch } from './connections.ts';
import { insertGrant, writeApproval } from './bindings.ts';
import type { Db } from './db.ts';
import { openDb } from './db.ts';

const custom: ChannelManifest = {
  id: 'zz-test', family: 'lti13', names: { text: 'Test LMS', label: 'Test LMS' }, availability: 'ga',
  card: { title: 'Test LMS', description: 'Unit fixture', mark: 'Z', color: 'gray', category: 'LMS Publishing', order: 90 },
  registration: [
    { method: 'dynamic', authority: 'self', profiles: ['zz-self'], defaultProfile: 'zz-self' },
    { method: 'manual', authority: 'operatorGrant', profiles: ['zz-exclusive', 'zz-shared'], defaultProfile: 'zz-exclusive' },
  ],
  capabilities: {}, setup: { createFields: [], bindingFields: [] },
  texts: { adminSteps: [], teacherSteps: [], disconnect: 'Stop.', notReady: null },
};
const channels = buildChannelRegistry([...TEST_CHANNELS.channels(), custom].map((manifest) => ({ folder: `/test/${manifest.id}`, manifest })), { simulations: true });
const databases: Db[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); });
function database() {
  const db = openDb(':memory:');
  databases.push(db);
  db.exec("INSERT INTO library VALUES ('lib', 'Library', 0)");
  return db;
}

describe('AC-LA-E1-06-03: channel writer and immutable identity', () => {
  it.each([
    ['moodle', 'manual', 'standard', 'exclusive', 'self', 'moodle'],
    ['canvas', 'manual', 'canvas-cloud-production', 'exclusive', 'operatorGrant', 'canvas'],
    ['blackboard', 'manual', 'blackboard', 'shared', 'operatorGrant', 'blackboard'],
    ['zz-test', 'dynamic', 'zz-self', 'exclusive', 'self', 'moodle'],
    ['zz-test', 'manual', 'zz-exclusive', 'exclusive', 'operatorGrant', 'canvas'],
    ['zz-test', 'manual', 'zz-shared', 'shared', 'operatorGrant', 'blackboard'],
  ] as const)('%s / %s / %s writes the frozen class', (channel, method, profile, sharing, authority, legacy) => {
    const db = database();
    const c = createConnection(db, 'lib', { name: 'School', siteUrl: 'https://school.test', channel, method, profile }, null, 1, channels, () => sharing);
    expect(c).toMatchObject({ channel, bindingAuthority: authority });
    expect(c).not.toHaveProperty('lms');
    expect(db.prepare('SELECT lms, channel, binding_authority FROM connection WHERE id = ?').get(c.id))
      .toEqual({ lms: legacy, channel, binding_authority: authority });
    replaceRef(db, 'lib', c.id, { hash: c.id, encrypted: Buffer.from('x'), expiresAt: 100 }, 2);
    markRegistered(db, c.id, { id: 'platform', issuer: c.siteUrl, clientId: 'client', deploymentIds: ['d'], productFamilyCode: null }, 3);
    disableConnection(db, 'lib', c.id, 4);
    expect(getConnectionAnyLibrary(db, c.id)).toMatchObject({ channel, bindingAuthority: authority, status: 'disabled' });
  });

  it('stores the channel id and optional bound values on new grants', () => {
    const db = database();
    const c = createConnection(db, 'lib', { name: 'School', siteUrl: 'https://school.test', channel: 'zz-test', method: 'manual' }, null, 1, channels, () => 'exclusive');
    const id = insertGrant(db, { connectionId: c.id, libraryId: 'lib', channel: c.channel, profile: c.profile, purpose: 'initial', siteUrl: c.siteUrl,
      serviceUrl: c.serviceUrl, clientId: 'client', deploymentId: 'd', note: 'fixture', expiresAt: 100, boundValues: { clientId: 'client' } }, 'hash', 1);
    expect(db.prepare('SELECT lms, bound_values FROM binding_grant WHERE id = ?').get(id)).toEqual({ lms: 'zz-test', bound_values: '{"clientId":"client"}' });
  });
});

it('AC-LA-E1-06-06: the same test channel routes self and grant connections by their stored authority', () => {
  const db = database();
  for (const [method, profile, sharing] of [['dynamic', 'zz-self', 'exclusive'], ['manual', 'zz-shared', 'shared']] as const) {
    const c = createConnection(db, 'lib', { name: method, siteUrl: 'https://school.test', channel: 'zz-test', method, profile }, null, 1, channels, () => sharing);
    markRegistered(db, c.id, { id: method, issuer: c.siteUrl, clientId: 'client', deploymentIds: ['approved'], productFamilyCode: null }, 2);
    db.prepare('UPDATE connection SET lms = ? WHERE id = ?').run(method === 'manual' ? 'moodle' : 'canvas', c.id);
    if (method === 'manual') {
      expect(routeLaunch(db, method, 'approved')).toEqual({ ok: false, reason: 'deployment_not_approved' });
      const grantId = insertGrant(db, { connectionId: c.id, libraryId: 'lib', channel: c.channel, profile, purpose: 'initial', siteUrl: c.siteUrl,
        serviceUrl: c.serviceUrl, clientId: 'client', deploymentId: 'approved', note: 'fixture', expiresAt: 100 }, 'hash', 1);
      writeApproval(db, { platformId: method, deploymentId: 'approved', connectionId: c.id, libraryId: 'lib', bindingRef: 'ref', grantId, approvedAt: 2 });
      expect(routeLaunch(db, method, 'unapproved')).toEqual({ ok: false, reason: 'deployment_not_approved' });
    } else expect(routeLaunch(db, method, 'unapproved')).toMatchObject({ ok: true, connection: { id: c.id } });
    expect(routeLaunch(db, method, 'approved')).toMatchObject({ ok: true, connection: { id: c.id, channel: 'zz-test' } });
    disableConnection(db, 'lib', c.id, 3);
    expect(routeLaunch(db, method, 'approved').ok).toBe(false);
  }
});


it('derives sharing from the resolved default profile and refuses missing profile data before writing', () => {
  const db = database();
  const input = { name: 'School', siteUrl: 'https://school.test', channel: 'zz-test', method: 'manual' as const };
  const seen: string[] = [];
  const c = createConnection(db, 'lib', input, null, 1, channels, (profile) => {
    seen.push(profile);
    return profile === 'zz-exclusive' ? 'exclusive' : 'shared';
  });
  expect(seen).toEqual(['zz-exclusive']);
  expect(db.prepare('SELECT lms FROM connection WHERE id = ?').get(c.id)?.lms).toBe('canvas');
  expect(() => createConnection(db, 'lib', { ...input, profile: 'zz-shared' }, null, 1, channels, () => null))
    .toThrow('createConnection: channel "zz-test" has no sharing data for profile "zz-shared"');
  expect(db.prepare('SELECT COUNT(*) AS count FROM connection').get()?.count).toBe(1);
});
