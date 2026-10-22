import { createLocalKeyProvider, legacyKeyRing } from '@cogniate/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api-errors.ts';
import type { Db } from '../db/index.ts';
import { openDb } from '../db/index.ts';
import type { AgsContext, LineItem } from '../platform/ags.ts';
import { ensureAccount, updateAccount } from '../store/accounts.ts';
import { createPlatform } from '../store/platforms.ts';
import { issueServiceKey, revokeServiceKeys } from '../store/service-keys.ts';
import { authenticate, checkServiceKeyWriteScope } from './auth.ts';

const dbs: Db[] = [];
afterEach(() => { for (const db of dbs.splice(0)) db.close(); });
const base = 'https://lms.test/lineitems';
const own = `${base}/own`;
function fixture() {
  const db = openDb(':memory:');
  dbs.push(db);
  const keys = createLocalKeyProvider(legacyKeyRing(Buffer.alloc(32, 7)));
  const { apiKey } = ensureAccount(db, { id: 'unit', name: 'Unit', appUrl: 'https://app.test' });
  updateAccount(db, 'unit', { serviceKeyWriteScope: 'resource-link' }, 1);
  const platform = createPlatform(db, 'unit', { issuer: 'https://lms.test', clientId: 'c', name: 'Unit',
    authEndpoint: 'https://lms.test/auth', tokenEndpoint: 'https://lms.test/token', jwksUrl: 'https://lms.test/keys', deploymentIds: ['d'], active: true });
  const input = { toolAccountId: 'unit', platformId: platform.id, deploymentId: 'd', contextId: 'c', resourceLinkId: 'r',
    agsClaim: { lineitems: base, lineitem: own }, nrpsClaim: null };
  const issue = () => authenticate(db, `SERVICE-AUTH-V1 ${apiKey}:${issueServiceKey(db, keys, input, 1).serviceKey}`, ['service'], 1, () => {});
  const caller = issue();
  const clock = { now: 1000 };
  const getLineItem = vi.fn(async (_ctx: AgsContext, url: string): Promise<LineItem> => ({ id: url, resourceLinkId: 'r' }));
  const ctx = { ags: { getLineItem }, now: () => clock.now };
  const ags: AgsContext = { platform, agsClaim: input.agsClaim, traceId: 'scope-unit' };
  const check = (url: string) => checkServiceKeyWriteScope(ctx, caller, ags, url);
  return { db, platform, issue, caller, clock, getLineItem, ctx, ags, check };
}

describe('service-key write scope and cache (BD-A2-47)', () => {
  it('accepts the claimed lineitem without a GET and leaves other auth/account modes unchanged', async () => {
    const h = fixture();
    await h.check(own);
    await checkServiceKeyWriteScope(h.ctx, { ...h.caller, scheme: 'ltik', serviceKey: null }, h.ags, `${base}/other`);
    await checkServiceKeyWriteScope(h.ctx, { ...h.caller, account: { ...h.caller.account, serviceKeyWriteScope: 'context' } }, h.ags, `${base}/other`);
    expect(h.getLineItem).not.toHaveBeenCalled();
  });

  it.each([true, false])('caches a %s ownership result for exactly ten minutes', async (match) => {
    const h = fixture();
    const url = `${base}/found`;
    h.getLineItem.mockResolvedValue({ id: url, resourceLinkId: match ? 'r' : 'other' });
    const call = async () => {
      if (match) await expect(h.check(url)).resolves.toBeUndefined();
      else await expect(h.check(url)).rejects.toMatchObject({ status: 403, code: 'SERVICE_KEY_SCOPE' });
    };
    await call();
    h.clock.now += 600_000 - 1;
    await call();
    expect(h.getLineItem).toHaveBeenCalledTimes(1);
    h.clock.now += 1;
    await call();
    expect(h.getLineItem).toHaveBeenCalledTimes(2);
  });

  it('isolates line items and re-issued credentials and shares an in-flight GET', async () => {
    const h = fixture();
    const url = `${base}/found`;
    await Promise.all([h.check(url), h.check(url)]);
    expect(h.getLineItem).toHaveBeenCalledTimes(1);
    await h.check(`${base}/second`);
    revokeServiceKeys(h.db, h.platform.id, 2);
    const next = h.issue();
    expect(next.serviceKeyHash).not.toBe(h.caller.serviceKeyHash);
    await checkServiceKeyWriteScope(h.ctx, next, h.ags, url);
    expect(h.getLineItem).toHaveBeenCalledTimes(3);
  });

  it.each(['PLATFORM_ERROR', 'PLATFORM_RATE_LIMITED'] as const)('propagates %s and retries the GET on the next request', async (code) => {
    const h = fixture();
    const error = new ApiError(code);
    h.getLineItem.mockRejectedValueOnce(error);
    await expect(h.check(`${base}/found`)).rejects.toBe(error);
    await h.check(`${base}/found`);
    expect(h.getLineItem).toHaveBeenCalledTimes(2);
  });

  it('refuses a missing resourceLinkId and checks the current URL boundary before any cached result', async () => {
    const h = fixture();
    const url = `${base}/found`;
    h.getLineItem.mockResolvedValueOnce({ id: url });
    await expect(h.check(url)).rejects.toMatchObject({ code: 'SERVICE_KEY_SCOPE' });
    await expect(h.check('https://foreign.test/lineitems/1')).rejects.toMatchObject({ code: 'INVALID_LINE_ITEM_ID' });
    await expect(checkServiceKeyWriteScope(h.ctx, h.caller, { ...h.ags, agsClaim: { lineitems: 'https://lms.test/new-base' } }, url))
      .rejects.toMatchObject({ code: 'INVALID_LINE_ITEM_ID' });
    expect(h.getLineItem).toHaveBeenCalledTimes(1);
  });

  it('evicts the least recently used entry at the 10,000-entry bound without extending the TTL', async () => {
    const h = fixture();
    for (let i = 0; i < 10_000; i++) await h.check(`${base}/${i}`);
    await h.check(`${base}/0`);
    await h.check(`${base}/10000`);
    await h.check(`${base}/0`);
    expect(h.getLineItem).toHaveBeenCalledTimes(10_001);
    await h.check(`${base}/1`);
    expect(h.getLineItem).toHaveBeenCalledTimes(10_002);
    h.clock.now += 600_000;
    await h.check(`${base}/0`);
    expect(h.getLineItem).toHaveBeenCalledTimes(10_003);
  });
});
