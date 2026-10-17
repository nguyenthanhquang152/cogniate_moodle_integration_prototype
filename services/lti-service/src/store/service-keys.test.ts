import { describe, expect, it } from 'vitest';
import { openDb } from '../db/index.ts';
import { MASTER_KEY, URLS } from '../testkit.ts';
import { ensureAccount } from './accounts.ts';
import { createPlatform } from './platforms.ts';
import { deriveServiceKey, findServiceKey, issueServiceKey, revokeServiceKeys } from './service-keys.ts';

function setup() {
  const db = openDb(':memory:');
  ensureAccount(db, { id: 'cogniate', name: 'Cogniate', appUrl: URLS.app });
  ensureAccount(db, { id: 'qa-second', name: 'QA second', appUrl: URLS.app });
  const p = createPlatform(db, 'cogniate', { issuer: 'https://moodle.test', clientId: 'c', name: 'M', authEndpoint: 'https://moodle.test/a', tokenEndpoint: 'https://moodle.test/t', jwksUrl: 'https://moodle.test/k', deploymentIds: ['1'], active: true });
  return { db, p };
}
const scope = (platformId: string, resourceLinkId = 'rl-3') => ({ toolAccountId: 'cogniate', platformId, deploymentId: '1', contextId: '2', resourceLinkId });

describe('service keys (contract §3.3)', () => {
  it('the same activity gives the same key for any user; the claims are refreshed; only the hash is stored', () => {
    const { db, p } = setup();
    const a = issueServiceKey(db, MASTER_KEY, { ...scope(p.id), agsClaim: { lineitem: 'v1' }, nrpsClaim: null }, 1);
    const b = issueServiceKey(db, MASTER_KEY, { ...scope(p.id), agsClaim: { lineitem: 'v2' }, nrpsClaim: { url: 'n' } }, 2);
    expect('serviceKey' in a && a.serviceKey).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(b).toEqual(a);
    const key = (a as { serviceKey: string }).serviceKey;
    expect(findServiceKey(db, 'cogniate', key)).toMatchObject({ resourceLinkId: 'rl-3', agsClaim: { lineitem: 'v2' }, nrpsClaim: { url: 'n' } });
    expect(JSON.stringify(db.prepare('SELECT * FROM service_key').all())).not.toContain(key);
  });

  it('another activity, another key; another account cannot use the key (security §8)', () => {
    const { db, p } = setup();
    const a = issueServiceKey(db, MASTER_KEY, { ...scope(p.id), agsClaim: null, nrpsClaim: null }, 1) as { serviceKey: string };
    const b = issueServiceKey(db, MASTER_KEY, { ...scope(p.id, 'rl-4'), agsClaim: null, nrpsClaim: null }, 1) as { serviceKey: string };
    expect(a.serviceKey).not.toBe(b.serviceKey);
    expect(findServiceKey(db, 'qa-second', a.serviceKey)).toBeNull();
    expect(findServiceKey(db, 'cogniate', 'x'.repeat(43))).toBeNull();
    expect(findServiceKey(db, 'cogniate', 'short')).toBeNull();
  });

  it('a revoked key stops working and is not issued again', () => {
    const { db, p } = setup();
    const a = issueServiceKey(db, MASTER_KEY, { ...scope(p.id), agsClaim: null, nrpsClaim: null }, 1) as { serviceKey: string };
    expect(revokeServiceKeys(db, p.id, 5)).toBe(1);
    expect(findServiceKey(db, 'cogniate', a.serviceKey)).toBeNull();
    expect(issueServiceKey(db, MASTER_KEY, { ...scope(p.id), agsClaim: null, nrpsClaim: null }, 6)).toEqual({ revoked: true });
  });

  it('the key depends on the master key and on every scope field (no ambiguous joins)', () => {
    const k = deriveServiceKey(MASTER_KEY, scope('plt_1'));
    expect(deriveServiceKey(Buffer.alloc(32, 9), scope('plt_1'))).not.toBe(k);
    expect(deriveServiceKey(MASTER_KEY, { ...scope('plt_1'), contextId: '2|1', deploymentId: '' })).not.toBe(deriveServiceKey(MASTER_KEY, { ...scope('plt_1'), contextId: '2', deploymentId: '|1' }));
  });
});
