import { createLocalKeyProvider, legacyKeyRing } from '@cogniate/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import type { Db } from '../../db/index.ts';
import { openDb } from '../../db/index.ts';
import { ensureAccount, updateAccount } from '../../store/accounts.ts';
import { listAuditEvents } from '../../store/audit.ts';
import { issueOperatorKey } from '../../store/operator-keys.ts';
import { createPlatform } from '../../store/platforms.ts';
import { capturingLogger, URLS } from '../../testkit.ts';
import { buildOperatorApp } from './index.ts';

const T0 = Date.parse('2026-10-22T10:00:00Z');
const resources: Array<{ db: Db; app: FastifyInstance }> = [];
afterEach(async () => { for (const { db, app } of resources.splice(0)) { await app.close(); db.close(); } });

async function fixture() {
  const db = openDb(':memory:');
  const keys = createLocalKeyProvider(legacyKeyRing(Buffer.alloc(32, 7)));
  const account = ensureAccount(db, { id: 'unit', name: 'Unit', appUrl: URLS.app });
  ensureAccount(db, { id: 'other', name: 'Other', appUrl: URLS.app });
  ensureAccount(db, { id: 'empty', name: 'Empty', appUrl: URLS.app });
  const input = { issuer: 'https://lms.test', clientId: 'c', name: 'Unit',
    authEndpoint: 'https://lms.test/auth', tokenEndpoint: 'https://lms.test/token', jwksUrl: 'https://lms.test/keys',
    deploymentIds: ['2', '1'], active: true, bindingRef: 'internal-binding-ref' };
  const platform = createPlatform(db, 'unit', input);
  createPlatform(db, 'other', { ...input, name: 'Other account platform' });
  const { logger } = capturingLogger();
  const app = await buildOperatorApp({ db, keys, urls: URLS, logger, now: () => T0 });
  resources.push({ db, app });
  const { operatorKey } = issueOperatorKey(db, { operator: 'unit', expiresAt: T0 + 3600_000 }, T0);
  const get = (id = 'unit', authorization: string | undefined = `OPERATOR-AUTH-V1 ${operatorKey}`) => app.inject({
    method: 'GET', url: `/operator/v1/accounts/${id}/platforms`, headers: authorization ? { authorization } : {},
  });
  const events = () => listAuditEvents(db, { limit: 100 }).events;
  return { db, app, account, platform, get, events };
}

describe('operator platform list', () => {
  it('returns only the account platforms and the exact public fields, without an audit event', async () => {
    const h = await fixture();
    const response = await h.get();
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ platforms: [{ id: h.platform.id, name: 'Unit', profile: 'standard',
      issuer: 'https://lms.test', clientId: 'c', active: true, deploymentIds: ['1', '2'] }] });
    expect(h.events()).toEqual([]);
  });

  it('returns an empty list for an account with no platforms', async () => {
    const h = await fixture();
    const response = await h.get('empty');
    expect([response.statusCode, response.json()]).toEqual([200, { platforms: [] }]);
    expect(h.events()).toEqual([]);
  });

  it('returns NOT_FOUND for an unknown account without an audit event', async () => {
    const h = await fixture();
    const response = await h.get('absent');
    expect([response.statusCode, response.json().details.message]).toEqual([404, 'NOT_FOUND']);
    expect(h.events()).toEqual([]);
  });

  it('keeps a closed account readable without an audit event', async () => {
    const h = await fixture();
    updateAccount(h.db, 'unit', { status: 'closed' }, T0);
    const response = await h.get();
    expect(response.statusCode).toBe(200);
    expect(response.json().platforms).toEqual([expect.objectContaining({ id: h.platform.id })]);
    expect(h.events()).toEqual([]);
  });

  it('requires operator authorization, including for an unknown account', async () => {
    const h = await fixture();
    for (const id of ['unit', 'absent']) {
      for (const authorization of ['', `Bearer ${h.account.apiKey!}`, `OPERATOR-AUTH-V1 ${h.account.apiKey!}`]) {
        const response = await h.get(id, authorization);
        expect([response.statusCode, response.json().details.message]).toEqual([401, 'INVALID_OPERATOR_AUTHORIZATION_HEADER']);
      }
    }
    expect(h.events()).toEqual([]);
  });
});
