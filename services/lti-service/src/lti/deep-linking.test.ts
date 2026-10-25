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
  const check = (items: unknown, s: Record<string, unknown> = settings) => checkContentItems(items, s, { launch: LAUNCH });

  it('keeps the items as sent; adds only the default url of an ltiResourceLink without url', () => {
    expect(check([item])).toEqual([item]);
    expect(check([{ type: 'ltiResourceLink', title: 'x' }])).toEqual([{ type: 'ltiResourceLink', title: 'x', url: LAUNCH }]);
  });

  it.each([
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

  it('two items when accept_multiple is false -> INVALID_CONTENT_ITEM; zero or one item is fine (AC-03)', () => {
    expect(() => check([item, item], { ...settings, accept_multiple: false })).toThrow(expect.objectContaining({ code: 'INVALID_CONTENT_ITEM' }));
    expect(check([], { ...settings, accept_multiple: false })).toEqual([]);
    expect(check([item], { ...settings, accept_multiple: false })).toHaveLength(1);
  });

  it.each([undefined, true, false])('keeps the twenty-item bound with accept_multiple %s (AC-03)', (accept_multiple) => {
    expect(() => check(Array.from({ length: 21 }, () => item), { ...settings, accept_multiple })).toThrow(expect.objectContaining({ status: 400, code: 'INVALID_CONTENT_ITEM' }));
    if (accept_multiple !== false) expect(check(Array.from({ length: 20 }, () => item), { ...settings, accept_multiple })).toHaveLength(20);
  });

  describe('per-type fields (LA-ADR-05 D3e)', () => {
    const allTypes = { ...settings, accept_types: ['ltiResourceLink', 'link', 'file', 'html', 'image'] };
    const refusal = (items: unknown[], s: Record<string, unknown> = allTypes) => {
      try {
        check(items, s);
      } catch (e) {
        return e as { code: string; status: number; description: string };
      }
      throw new Error('expected INVALID_CONTENT_ITEM');
    };

    it.each([
      ['link without url', { type: 'link' }],
      ['link with an http url', { type: 'link', url: 'http://x.test' }],
      ['link with a null url', { type: 'link', url: null }],
      ['link with a url that is not a string', { type: 'link', url: 7 }],
      ['link with a url that does not parse', { type: 'link', url: 'x.test/page' }],
      ['link with a javascript url', { type: 'link', url: 'javascript:alert(1)' }],
      ['file without url', { type: 'file', title: 'a.pdf' }],
      ['file with an http url', { type: 'file', url: 'http://x.test/a.pdf' }],
      ['image without url', { type: 'image', width: 10, height: 10 }],
      ['image with a data url', { type: 'image', url: 'data:image/png;base64,AAAA' }],
    ])('a %s -> 400 INVALID_CONTENT_ITEM; description names the item index (AC-LA-E3-13-01)', (_n, bad) => {
      // A valid first item proves the index is the index of the bad item, not always 0.
      const e = refusal([item, bad]);
      expect(e).toMatchObject({ code: 'INVALID_CONTENT_ITEM', status: 400 });
      expect(e.description).toBe(`contentItems[1]: type ${String(bad.type)} needs an https url`);
    });

    it.each([
      ['without html', { type: 'html', title: 'x' }],
      ['with a null html', { type: 'html', html: null }],
      ['with an html that is not a string', { type: 'html', html: { p: 'x' } }],
      ['with only a url', { type: 'html', url: 'https://x.test/a.html' }],
    ])('an html item %s -> 400 INVALID_CONTENT_ITEM with the index (AC-LA-E3-13-02)', (_n, bad) => {
      const e = refusal([bad]);
      expect(e).toMatchObject({ code: 'INVALID_CONTENT_ITEM', status: 400 });
      expect(e.description).toBe('contentItems[0]: type html needs a string html');
    });

    it('keeps valid link, file, image and html items exactly as sent (no default url for these types)', () => {
      const items = [
        { type: 'link', url: 'https://x.test/page#part-2', title: 'Page' },
        { type: 'file', url: 'https://x.test/a.pdf' },
        { type: 'image', url: 'https://x.test/a.png', width: 10, height: 10 },
        { type: 'html', html: '<p>Hello</p>' },
        { type: 'html', html: '' },
      ];
      expect(check(items, allTypes)).toEqual(items);
    });

    it('does not change ltiResourceLink items (AC-LA-E3-13-04 at unit level)', () => {
      expect(check([item, { type: 'ltiResourceLink', title: 'x' }], allTypes)).toEqual([item, { type: 'ltiResourceLink', title: 'x', url: LAUNCH }]);
    });

    it('checks accept_types before the per-type fields', () => {
      expect(refusal([{ type: 'file' }], settings).description).toBe('contentItems[0]: the platform does not accept type file');
    });
  });

  it('allows cancellation and rejects line items only when explicitly refused', () => {
    expect(check([])).toEqual([]);
    expect(() => check([item], { ...settings, accept_lineitem: false })).toThrow(expect.objectContaining({ status: 400, code: 'INVALID_CONTENT_ITEM' }));
    expect(check([{ type: 'ltiResourceLink' }], { ...settings, accept_lineitem: false })).toEqual([{ type: 'ltiResourceLink', url: LAUNCH }]);
    for (const accept_lineitem of [undefined, true]) expect(check([item], { ...settings, accept_lineitem })).toEqual([item]);
  });
});

describe('Deep Linking response (security §2.3, AC-T3-08)', () => {
  it('a resource-link launch -> 403 SERVICE_NOT_AVAILABLE', async () => {
    const { launch, platform } = await setup({ messageType: 'LtiResourceLinkRequest', claims: {} });
    expect(() => deepLinkingResponse(launch, platform, { contentItems: [item] }, { launch: LAUNCH })).toThrow(expect.objectContaining({ code: 'SERVICE_NOT_AVAILABLE', status: 403 }));
  });

  it('claims: iss = client id, aud = issuer, nonce, deployment, message type, version, items, data, msg; target = return URL', async () => {
    const { launch, platform } = await setup();
    const { claims, target } = deepLinkingResponse(launch, platform, { contentItems: [item], options: { message: 'Course added', log: '', errMessage: 'x' } }, { launch: LAUNCH });
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
    const { claims } = deepLinkingResponse(launch, platform, { contentItems: [item] }, { launch: LAUNCH });
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
