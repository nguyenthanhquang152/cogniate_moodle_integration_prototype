import { createLocalKeyProvider, legacyKeyRing } from '@cogniate/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import type { Db } from '../../db/index.ts';
import { openDb } from '../../db/index.ts';
import { ensureAccount, updateAccount } from '../../store/accounts.ts';
import { listAuditEvents } from '../../store/audit.ts';
import { issueOperatorKey } from '../../store/operator-keys.ts';
import { createPlatform } from '../../store/platforms.ts';
import { findServiceKey, issueServiceKey } from '../../store/service-keys.ts';
import { capturingLogger, URLS } from '../../testkit.ts';
import { buildOperatorApp } from './index.ts';

const T0 = Date.parse('2026-10-22T10:00:00Z');
const resources: Array<{ db: Db; app: FastifyInstance }> = [];
afterEach(async () => { for (const { db, app } of resources.splice(0)) { await app.close(); db.close(); } });
async function fixture() {
  const db = openDb(':memory:');
  const keys = createLocalKeyProvider(legacyKeyRing(Buffer.alloc(32, 7)));
  ensureAccount(db, { id: 'unit', name: 'Unit', appUrl: URLS.app });
  const platform = createPlatform(db, 'unit', { issuer: 'https://lms.test', clientId: 'c', name: 'Unit',
    authEndpoint: 'https://lms.test/a', tokenEndpoint: 'https://lms.test/t', jwksUrl: 'https://lms.test/k', deploymentIds: ['1'], active: true });
  const { serviceKey } = issueServiceKey(db, keys, { toolAccountId: 'unit', platformId: platform.id, deploymentId: '1', contextId: 'c',
    resourceLinkId: 'r', agsClaim: null, nrpsClaim: null }, T0);
  const { logger } = capturingLogger();
  const app = await buildOperatorApp({ db, keys, urls: URLS, logger, now: () => T0 });
  resources.push({ db, app });
  const { operatorKey } = issueOperatorKey(db, { operator: 'unit', expiresAt: T0 + 3600_000 }, T0);
  const post = (accountId = 'unit', filter: { contextId?: string } = {}) => app.inject({ method: 'POST', url: `/operator/v1/accounts/${accountId}/service-keys/revoke`,
    headers: { authorization: `OPERATOR-AUTH-V1 ${operatorKey}`, 'content-type': 'application/json' }, payload: JSON.stringify({ platformId: platform.id, ...filter }) });
  const events = () => listAuditEvents(db, { limit: 100 }).events;
  return { db, keys, serviceKey, platform, post, events };
}

describe('operator service-key revoke guards', () => {
  it.each([undefined, '', 'c'])('distinguishes an absent, empty and named context filter: %j (BD-A2-76)', async (contextId) => {
    const h = await fixture();
    const empty = issueServiceKey(h.db, h.keys, { toolAccountId: 'unit', platformId: h.platform.id, deploymentId: '1', contextId: '',
      resourceLinkId: 'r', agsClaim: null, nrpsClaim: null }, T0);
    const filter = contextId === undefined ? {} : { contextId };
    const res = await h.post('unit', filter);
    const revoked = contextId === undefined ? 2 : 1;
    expect([res.statusCode, res.json()]).toEqual([200, { revoked }]);
    for (const [context, key] of [['c', h.serviceKey], ['', empty.serviceKey]]) {
      expect(findServiceKey(h.db, 'unit', key!) !== null).toBe(contextId !== undefined && contextId !== context);
    }
    expect(h.events()).toEqual([expect.objectContaining({ action: 'service_key.revoke', result: 'ok',
      toolAccountId: 'unit', details: { platformId: h.platform.id, ...filter, revoked } })]);
  });

  it.each(['suspended', 'closed'] as const)('permits access removal for a %s account (BD-A2-12)', async (status) => {
    const h = await fixture();
    updateAccount(h.db, 'unit', { status }, T0 - 1);
    const res = await h.post();
    expect([res.statusCode, res.json()]).toEqual([200, { revoked: status === 'closed' ? 0 : 1 }]);
    expect(h.events()).toEqual([expect.objectContaining({ action: 'service_key.revoke', result: 'ok', actor: { type: 'operator', id: 'unit' },
      toolAccountId: 'unit', target: { type: 'platform', id: h.platform.id } })]);
  });

  it('audits an unknown account refusal without revoking another account', async () => {
    const h = await fixture();
    const res = await h.post('absent');
    expect([res.statusCode, res.json().details.message]).toEqual([404, 'NOT_FOUND']);
    expect(h.db.prepare('SELECT revoked_at FROM service_key').get()?.revoked_at).toBeNull();
    expect(h.events()).toEqual([expect.objectContaining({ action: 'service_key.revoke', result: 'refused', code: 'NOT_FOUND', toolAccountId: 'absent' })]);
  });
});
