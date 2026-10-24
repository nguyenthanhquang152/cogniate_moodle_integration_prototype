import { afterEach, describe, expect, it } from 'vitest';
import { createLocalKeyProvider, legacyKeyRing } from '@cogniate/shared';
import { listAuditEvents } from '../../store/audit.ts';
import { findServiceKey, issueServiceKey } from '../../store/service-keys.ts';
import type { Harness } from '../../testkit.ts';
import { harness, MASTER_KEY } from '../../testkit.ts';

const resources: Harness[] = [];
afterEach(async () => { for (const h of resources.splice(0)) { await h.app.close(); h.db.close(); } });
async function fixture() {
  const h = await harness();
  resources.push(h);
  const keys = createLocalKeyProvider(legacyKeyRing(MASTER_KEY));
  const { serviceKey } = issueServiceKey(h.db, keys, { toolAccountId: 'cogniate', platformId: h.platform.id, deploymentId: '1', contextId: 'c',
    resourceLinkId: 'r', agsClaim: null, nrpsClaim: null }, h.clock.now);
  const post = (payload: unknown, apiKey = h.apiKey) => h.app.inject({ method: 'POST', url: '/api/service-keys/revoke',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' }, payload: JSON.stringify(payload) });
  const events = () => listAuditEvents(h.db, { limit: 100 }).events;
  return { ...h, keys, serviceKey, post, events };
}

describe('tenant service-key revoke boundaries and transaction', () => {
  it.each([undefined, '', 'c'])('distinguishes an absent, empty and named context filter: %j (BD-A2-76)', async (contextId) => {
    const h = await fixture();
    const empty = issueServiceKey(h.db, h.keys, { toolAccountId: 'cogniate', platformId: h.platform.id, deploymentId: '1', contextId: '',
      resourceLinkId: 'r', agsClaim: null, nrpsClaim: null }, h.clock.now);
    const filter = { platformId: h.platform.id, ...(contextId === undefined ? {} : { contextId }) };
    const res = await h.post(filter);
    const revoked = contextId === undefined ? 2 : 1;
    expect([res.statusCode, res.json()]).toEqual([200, { revoked }]);
    for (const [context, key] of [['c', h.serviceKey], ['', empty.serviceKey]]) {
      expect(findServiceKey(h.db, 'cogniate', key!) !== null).toBe(contextId !== undefined && contextId !== context);
    }
    expect(h.events()).toEqual([expect.objectContaining({ action: 'service_key.revoke', result: 'ok', details: { ...filter, revoked } })]);
  });

  it.each([{ typo: 'platform' }, { resourceLinkId: '' }, { contextId: null }, { deploymentId: 1 }])('rejects invalid filters %j without a change', async (extra) => {
    const h = await fixture();
    const before = h.db.prepare('SELECT * FROM service_key').all();
    const res = await h.post({ platformId: h.platform.id, ...extra });
    expect(res.statusCode).toBe(400);
    expect(res.json().details.message).toBe('INVALID_REQUEST');
    expect(h.db.prepare('SELECT * FROM service_key').all()).toEqual(before);
    expect(h.events()).toEqual([expect.objectContaining({ action: 'service_key.revoke', result: 'refused', code: 'INVALID_REQUEST' })]);
  });

  it('uses the same unknown-platform error for absent and foreign platforms', async () => {
    const h = await fixture();
    for (const [platformId, apiKey] of [['absent', h.apiKey], [h.platform.id, h.otherApiKey]]) {
      const res = await h.post({ platformId }, apiKey);
      expect([res.statusCode, res.json().details.message]).toEqual([404, 'UNREGISTERED_PLATFORM']);
    }
    expect(h.db.prepare('SELECT revoked_at FROM service_key').get()?.revoked_at).toBeNull();
    expect(h.events().map((event) => event.code)).toEqual(['UNREGISTERED_PLATFORM', 'UNREGISTERED_PLATFORM']);
  });

  it.each(['deploymentId', 'contextId', 'resourceLinkId'])('treats an unknown %s as an audited no-op filter', async (field) => {
    const h = await fixture();
    const res = await h.post({ platformId: h.platform.id, [field]: 'absent' });
    expect([res.statusCode, res.json()]).toEqual([200, { revoked: 0 }]);
    expect(h.events()).toEqual([expect.objectContaining({ action: 'service_key.revoke', result: 'ok',
      target: { type: 'platform', id: h.platform.id }, details: { platformId: h.platform.id, [field]: 'absent', revoked: 0 } })]);
  });

  it('rolls back revoked_at when the audit insert fails', async () => {
    const h = await fixture();
    const before = h.db.prepare('SELECT * FROM service_key').all();
    h.db.exec("CREATE TRIGGER fail_revoke_audit BEFORE INSERT ON audit_event BEGIN SELECT RAISE(ABORT, 'audit failed'); END");
    const res = await h.post({ platformId: h.platform.id });
    expect(res.statusCode).toBe(500);
    expect(h.db.prepare('SELECT * FROM service_key').all()).toEqual(before);
    expect(h.events()).toEqual([]);
  });
});
