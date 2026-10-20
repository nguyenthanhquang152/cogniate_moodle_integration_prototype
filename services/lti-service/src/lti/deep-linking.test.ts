import { createLocalJWKSet, jwtVerify } from 'jose';
import { describe, expect, it } from 'vitest';
import { openDb } from '../db/index.ts';
import { ensureAccount } from '../store/accounts.ts';
import { ensureToolKey, publicJwks } from '../store/tool-keys.ts';
import type { LaunchRecord } from '../store/launches.ts';
import { createPlatform } from '../store/platforms.ts';
import { CLIENT_ID, ISSUER, LAUNCH, MASTER_KEY, URLS } from '../testkit.ts';
import { CLAIM } from './checks.ts';
import { DL_CLAIM, checkContentItems, deepLinkingResponse } from './deep-linking.ts';
import { signToolJwt } from './tool-jwt.ts';

const RETURN_URL = `${ISSUER}/mod/lti/contentitem_return.php?course=2&id=1&sesskey=abc`;
const settings = { deep_link_return_url: RETURN_URL, accept_types: ['ltiResourceLink'], accept_multiple: true, data: 'opaque-data' };
const item = { type: 'ltiResourceLink', title: 'QA DL 1', url: `${LAUNCH}?resource=qa-dl`, lineItem: { scoreMaximum: 100, label: 'QA DL 1' } };

async function setup(over: Partial<LaunchRecord> = {}) {
  const db = openDb(':memory:');
  ensureAccount(db, { id: 'cogniate', name: 'Cogniate', appUrl: URLS.app });
  await ensureToolKey(db, MASTER_KEY, 'cogniate');
  const platform = createPlatform(db, 'cogniate', {
    issuer: ISSUER, clientId: CLIENT_ID, name: 'Moodle', authEndpoint: `${ISSUER}/a`, tokenEndpoint: `${ISSUER}/t`, jwksUrl: `${ISSUER}/k`, deploymentIds: ['1'], active: true,
  });
  const launch: LaunchRecord = {
    id: 'lch_1', toolAccountId: 'cogniate', platformId: platform.id, deploymentId: '1', messageType: 'LtiDeepLinkingRequest',
    claims: { [CLAIM.deepLinkingSettings]: settings }, expiresAt: 0, siteOrigin: null, serviceOrigin: null, bindingGeneration: 0, ...over,
  };
  return { db, platform, launch };
}

describe('content items (contract §3.2)', () => {
  const check = (items: unknown, s: Record<string, unknown> = settings) => checkContentItems(items, s, URLS, 'cogniate');

  it('keeps the items as sent; adds only the default url of an ltiResourceLink without url', () => {
    expect(check([item])).toEqual([item]);
    expect(check([{ type: 'ltiResourceLink', title: 'x' }])).toEqual([{ type: 'ltiResourceLink', title: 'x', url: LAUNCH }]);
  });

  it.each([
    ['no items', []],
    ['21 items', Array.from({ length: 21 }, () => item)],
    ['not a list', item],
    ['an item that is not an object', ['x']],
    ['an unknown type', [{ ...item, type: 'video' }]],
    ['a type that the platform does not accept', [{ type: 'link', url: 'https://example.com' }]],
    ['a url on evil.test (AC-T3-10)', [{ ...item, url: 'https://evil.test/lti/launch/cogniate' }]],
    ['a url that only starts like ours', [{ ...item, url: `${LAUNCH}-evil` }]],
    ['scoreMaximum 0', [{ ...item, lineItem: { scoreMaximum: 0 } }]],
    ['a lineItem without scoreMaximum', [{ ...item, lineItem: { label: 'x' } }]],
    ['a custom value that is not a string', [{ ...item, custom: { a: 1 } }]],
  ])('refuses %s with INVALID_CONTENT_ITEM', (_n, items) => {
    expect(() => check(items)).toThrow(expect.objectContaining({ code: 'INVALID_CONTENT_ITEM', status: 400 }));
  });

  it('two items when accept_multiple is false -> INVALID_CONTENT_ITEM; one item is fine', () => {
    expect(() => check([item, item], { ...settings, accept_multiple: false })).toThrow(expect.objectContaining({ code: 'INVALID_CONTENT_ITEM' }));
    expect(check([item], { ...settings, accept_multiple: false })).toHaveLength(1);
  });
});

describe('Deep Linking response (security §2.3, AC-T3-08)', () => {
  it('a resource-link launch -> 403 SERVICE_NOT_AVAILABLE', async () => {
    const { launch, platform } = await setup({ messageType: 'LtiResourceLinkRequest', claims: {} });
    expect(() => deepLinkingResponse(launch, platform, { contentItems: [item] }, URLS)).toThrow(expect.objectContaining({ code: 'SERVICE_NOT_AVAILABLE', status: 403 }));
  });

  it('claims: iss = client id, aud = issuer, nonce, deployment, message type, version, items, data, msg; target = return URL', async () => {
    const { launch, platform } = await setup();
    const { claims, target } = deepLinkingResponse(launch, platform, { contentItems: [item], options: { message: 'Course added', log: '', errMessage: 'x' } }, URLS);
    expect(target).toBe(RETURN_URL);
    expect(claims).toMatchObject({
      iss: CLIENT_ID, aud: ISSUER, [CLAIM.deploymentId]: '1', [CLAIM.messageType]: 'LtiDeepLinkingResponse', [CLAIM.version]: '1.3.0',
      [DL_CLAIM.contentItems]: [item], [DL_CLAIM.data]: 'opaque-data', [DL_CLAIM.msg]: 'Course added', [DL_CLAIM.errormsg]: 'x',
    });
    expect(claims[DL_CLAIM.log]).toBeUndefined(); // empty options are not sent
    expect(String(claims.nonce)).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('fake clock 2 s ahead of Moodle: iat is still in the past for Moodle, exp - iat = 330, signature verifies with the tool JWKS', async () => {
    const { db, launch, platform } = await setup();
    const moodleNow = Date.UTC(2026, 9, 17, 10, 0, 0);
    const toolNow = moodleNow + 2000;
    const { claims } = deepLinkingResponse(launch, platform, { contentItems: [item] }, URLS);
    const jwt = await signToolJwt(db, MASTER_KEY, 'cogniate', claims, toolNow);
    // Moodle verifies with leeway 0 at its own time.
    const { payload, protectedHeader } = await jwtVerify(jwt, createLocalJWKSet({ keys: publicJwks(db, 'cogniate') }), {
      algorithms: ['RS256'], currentDate: new Date(moodleNow), clockTolerance: 0, issuer: CLIENT_ID, audience: ISSUER,
    });
    expect(payload.iat!).toBeLessThan(moodleNow / 1000);
    expect(payload.iat!).toBeLessThanOrEqual(toolNow / 1000 - 25);
    expect(payload.exp! - payload.iat!).toBe(330);
    expect(payload[DL_CLAIM.contentItems]).toEqual([item]);
    expect(protectedHeader).toMatchObject({ alg: 'RS256', kid: publicJwks(db, 'cogniate')[0]!.kid });
  });
});
