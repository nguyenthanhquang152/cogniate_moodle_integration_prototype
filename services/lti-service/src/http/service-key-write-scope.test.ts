import { afterEach, describe, expect, it } from 'vitest';
import { AGS_SCOPES } from '../platform/ags.ts';
import { updateAccount } from '../store/accounts.ts';
import { issueServiceKey } from '../store/service-keys.ts';
import type { Harness } from '../testkit.ts';
import { harness, MASTER_KEY, URLS } from '../testkit.ts';

const base = `${URLS.moodle}/lineitems`;
const own = `${base}/a`;
const other = `${base}/b`;
const score = { userId: 'user', activityProgress: 'Completed', gradingProgress: 'FullyGraded', scoreGiven: 1, scoreMaximum: 1 };
const item = { label: 'Activity', scoreMaximum: 1 };
const writes = [
  { method: 'POST', suffix: '/scores', payload: score, status: 204 },
  { method: 'PUT', suffix: '', payload: item, status: 201 },
  { method: 'DELETE', suffix: '', payload: undefined, status: 204 },
] as const;
const resources: Harness[] = [];
afterEach(async () => { for (const h of resources.splice(0)) { await h.app.close(); h.db.close(); } });

async function fixture() {
  const h = await harness({ outbound: (url, init) => {
    if (url.endsWith('/token.php')) return { status: 200, body: { access_token: 'unit-ags-token', expires_in: 3600 } };
    if (url.startsWith(base)) {
      if ((init.method ?? 'GET') === 'GET') return { status: 200, body: { ...item, id: url, resourceLinkId: url === own ? 'a' : 'b' } };
      if (init.method === 'PUT') return { status: 200, body: { ...item, id: url } };
      return { status: 204, body: '' };
    }
    return undefined;
  } });
  resources.push(h);
  updateAccount(h.db, 'cogniate', { serviceKeyWriteScope: 'resource-link' }, h.clock.now);
  const { serviceKey } = issueServiceKey(h.db, MASTER_KEY, {
    toolAccountId: 'cogniate', platformId: h.platform.id, deploymentId: '1', contextId: 'course', resourceLinkId: 'a',
    agsClaim: { lineitems: base, lineitem: own, scope: Object.values(AGS_SCOPES) }, nrpsClaim: null,
  }, h.clock.now);
  const headers = { authorization: `SERVICE-AUTH-V1 ${h.apiKey}:${serviceKey}` };
  const agsRequests = () => h.outbound.requests.filter((request) => request.url.startsWith(base));
  const agsWrites = () => agsRequests().filter((request) => request.method !== 'GET');
  return { ...h, headers, agsRequests, agsWrites };
}

describe('resource-link service-key write guards on mounted routes', () => {
  it.each(writes)('$method refuses another resource link before any AGS write', async ({ method, suffix, payload }) => {
    const h = await fixture();
    const response = await h.app.inject({ method, url: `/api/lineitems/${encodeURIComponent(other)}${suffix}`, headers: h.headers, payload });
    expect(h.agsWrites()).toEqual([]);
    expect(response.statusCode).toBe(403);
    expect(response.json().details.message).toBe('SERVICE_KEY_SCOPE');
    expect(h.agsRequests()).toEqual([expect.objectContaining({ method: 'GET', url: other })]);
  });

  it.each(writes)('$method accepts the key resource link without an ownership GET', async ({ method, suffix, payload, status }) => {
    const h = await fixture();
    const response = await h.app.inject({ method, url: `/api/lineitems/${encodeURIComponent(own)}${suffix}`, headers: h.headers, payload });
    expect(response.statusCode).toBe(status);
    expect(h.agsRequests()).toEqual([expect.objectContaining({ method, url: `${own}${suffix}` })]);
  });

  it('keeps GET of another resource link readable', async () => {
    const h = await fixture();
    const response = await h.app.inject({ method: 'GET', url: `/api/lineitems/${encodeURIComponent(other)}`, headers: h.headers });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: other, resourceLinkId: 'b' });
    expect(h.agsRequests()).toEqual([expect.objectContaining({ method: 'GET', url: other })]);
    expect(h.agsWrites()).toEqual([]);
  });
});
