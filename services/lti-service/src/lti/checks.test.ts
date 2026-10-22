import { describe, expect, it } from 'vitest';
import { sha256Hex } from '@cogniate/shared';
import { openDb } from '../db/index.ts';
import { ensureAccount } from '../store/accounts.ts';
import type { Platform } from '../store/platforms.ts';
import { createPlatform } from '../store/platforms.ts';
import type { StateRecord } from '../store/states.ts';
import { saveState } from '../store/states.ts';
import { CLIENT_ID, ISSUER, LAUNCH, URLS, fakeOutbound, makeKey, moodleClaims, sign } from '../testkit.ts';
import {
  CLAIM, LaunchCheckError, check10Message, check11Claims, check12Target, check1And3State, check2Cookie, check4Token,
  check5IssuerAudience, check6Signature, check7Time, check8Nonce, check9Deployment, readCookie, stateCookieName,
} from './checks.ts';
import { createPlatformKeys } from './jwks.ts';

const platform: Platform = {
  id: 'plt_1', toolAccountId: 'cogniate', issuer: ISSUER, clientId: CLIENT_ID, name: 'M', authEndpoint: `${ISSUER}/a`, tokenEndpoint: `${ISSUER}/t`,
  jwksUrl: `${ISSUER}/mod/lti/certs.php`, productFamilyCode: null, active: true, deploymentIds: ['1'],
  profile: 'standard', siteUrl: null, serviceUrl: null, bindingRef: null, deployments: [{ deploymentId: '1', siteUrl: null, active: true, bindingGeneration: 0, bindingRef: null, createdAt: null }],
};
const state: StateRecord = { stateHash: 'h', toolAccountId: 'cogniate', platformId: 'plt_1', nonce: 'nonce-1', targetLinkUri: `${LAUNCH}?resource=seed`, expiresAt: 0, loginDeploymentId: null, storageTarget: null, storageOrigin: null };

function expectFail(fn: () => unknown, check: string, code: string) {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(LaunchCheckError);
    expect({ check: (err as LaunchCheckError).check, code: (err as LaunchCheckError).code }).toEqual({ check, code });
    return;
  }
  throw new Error('expected a LaunchCheckError');
}

describe('checks 1 and 3: state record (single use, same statement)', () => {
  const setup = () => {
    const db = openDb(':memory:');
    ensureAccount(db, { id: 'cogniate', name: 'C', appUrl: URLS.app });
    ensureAccount(db, { id: 'other', name: 'O', appUrl: URLS.app });
    const p = createPlatform(db, 'cogniate', { issuer: ISSUER, clientId: CLIENT_ID, name: 'M', authEndpoint: `${ISSUER}/a`, tokenEndpoint: `${ISSUER}/t`, jwksUrl: `${ISSUER}/k`, deploymentIds: ['1'], active: true });
    const now = 1_000_000;
    saveState(db, { stateHash: sha256Hex('s1'), toolAccountId: 'cogniate', platformId: p.id, nonce: 'n', targetLinkUri: LAUNCH, expiresAt: now + 600_000, loginDeploymentId: null, storageTarget: null, storageOrigin: null }, now);
    return { db, now };
  };

  it('passes once, then the same state fails (used up)', () => {
    const { db, now } = setup();
    expect(check1And3State(db, 'cogniate', 's1', sha256Hex('s1'), now).nonce).toBe('n');
    expectFail(() => check1And3State(db, 'cogniate', 's1', sha256Hex('s1'), now), '1', 'INVALID_STATE');
  });

  it('fails for a missing, unknown, expired or other-account state', () => {
    const { db, now } = setup();
    expectFail(() => check1And3State(db, 'cogniate', undefined, null, now), '1', 'INVALID_STATE');
    expectFail(() => check1And3State(db, 'cogniate', 'nope', sha256Hex('nope'), now), '1', 'INVALID_STATE');
    expectFail(() => check1And3State(db, 'other', 's1', sha256Hex('s1'), now), '1', 'INVALID_STATE');
    expectFail(() => check1And3State(db, 'cogniate', 's1', sha256Hex('s1'), now + 600_001), '1', 'INVALID_STATE');
  });
});

describe('check 2: state cookie', () => {
  const hash = sha256Hex('state-x');
  const name = stateCookieName(hash);
  it('uses the __Host- name with 8 chars of the state hash', () => expect(name).toBe(`__Host-lti_state_${hash.slice(0, 8)}`));
  it('passes when the cookie equals the state', () => expect(() => check2Cookie(`a=b; ${name}=state-x`, 'state-x', hash)).not.toThrow());
  it('fails STATE_COOKIE_MISSING without the cookie', () => expectFail(() => check2Cookie('a=b', 'state-x', hash), '2', 'STATE_COOKIE_MISSING'));
  it('fails INVALID_STATE for another value', () => expectFail(() => check2Cookie(`${name}=state-y`, 'state-x', hash), '2', 'INVALID_STATE'));
  it('reads cookies by exact name', () => expect(readCookie(`${name}x=1; ${name}=2`, name)).toBe('2'));
});

describe('check 4: compact JWS, RS256, kid', async () => {
  const key = await makeKey('k1');
  const good = await sign(key, moodleClaims());
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  it('passes for an RS256 token with a kid', () => expect(check4Token(good).header).toMatchObject({ alg: 'RS256', kid: 'k1' }));
  it.each([
    ['not a JWS', 'abc'],
    ['alg none', `${b64({ alg: 'none', kid: 'k1' })}.${b64({ a: 1 })}.x`],
    ['HS256', `${b64({ alg: 'HS256', kid: 'k1' })}.${b64({ a: 1 })}.x`],
    ['no kid', `${b64({ alg: 'RS256' })}.${b64({ a: 1 })}.x`],
    ['payload not an object', `${b64({ alg: 'RS256', kid: 'k1' })}.${b64([1])}.x`],
    ['missing', undefined],
  ])('fails INVALID_ID_TOKEN: %s', (_n, token) => expectFail(() => check4Token(token), '4', 'INVALID_ID_TOKEN'));
});

describe('check 5: issuer and audience', () => {
  it('passes for iss + aud string, and for aud list with azp', () => {
    expect(() => check5IssuerAudience({ iss: ISSUER, aud: CLIENT_ID }, platform)).not.toThrow();
    expect(() => check5IssuerAudience({ iss: ISSUER, aud: [CLIENT_ID, 'x'], azp: CLIENT_ID }, platform)).not.toThrow();
  });
  it.each([
    ['other iss', { iss: 'https://evil.test', aud: CLIENT_ID }],
    ['other aud', { iss: ISSUER, aud: 'other' }],
    ['two aud, no azp', { iss: ISSUER, aud: [CLIENT_ID, 'x'] }],
    ['two aud, wrong azp', { iss: ISSUER, aud: [CLIENT_ID, 'x'], azp: 'x' }],
  ])('fails INVALID_ISSUER_OR_AUDIENCE: %s', (_n, claims) => expectFail(() => check5IssuerAudience(claims, platform), '5', 'INVALID_ISSUER_OR_AUDIENCE'));
});

describe('check 6: signature with the platform JWKS', async () => {
  const key = await makeKey('k1');
  const stranger = await makeKey('k1'); // same kid, other key
  const keys = createPlatformKeys(fakeOutbound(() => [key.publicJwk]));
  it('passes for a token signed by the platform key', async () => {
    await expect(check6Signature(keys, await sign(key, moodleClaims()), platform, 't')).resolves.toBeUndefined();
  });
  it('fails INVALID_SIGNATURE for another key, and for a tampered payload', async () => {
    await expect(check6Signature(keys, await sign(stranger, moodleClaims()), platform, 't')).rejects.toMatchObject({ check: '6', code: 'INVALID_SIGNATURE' });
    const [h, p, s] = (await sign(key, moodleClaims())).split('.');
    const tampered = `${h}.${Buffer.from(JSON.stringify({ ...moodleClaims(), sub: '6' })).toString('base64url')}.${s}`;
    expect(p).not.toBe(tampered.split('.')[1]);
    await expect(check6Signature(keys, tampered, platform, 't')).rejects.toMatchObject({ code: 'INVALID_SIGNATURE' });
  });
});

describe('check 7: exp and iat with 60 s skew', () => {
  const now = 1_700_000_000_000;
  const s = now / 1000;
  it('passes inside the skew', () => {
    expect(() => check7Time({ iat: s, exp: s + 60 }, now)).not.toThrow();
    expect(() => check7Time({ iat: s + 59, exp: s - 59 }, now)).not.toThrow();
  });
  it.each([
    ['expired more than 60 s', { iat: s - 200, exp: s - 60 }],
    ['iat 60 s in the future', { iat: s + 60, exp: s + 120 }],
    ['no exp', { iat: s }],
    ['exp not a number', { iat: s, exp: String(s + 60) }],
  ])('fails TOKEN_EXPIRED: %s', (_n, claims) => expectFail(() => check7Time(claims, now), '7', 'TOKEN_EXPIRED'));
});

describe('check 8: nonce', () => {
  it('passes for the state nonce', () => expect(() => check8Nonce({ nonce: 'nonce-1' }, state)).not.toThrow());
  it('fails INVALID_NONCE for another or no nonce', () => {
    expectFail(() => check8Nonce({ nonce: 'nonce-2' }, state), '8', 'INVALID_NONCE');
    expectFail(() => check8Nonce({}, state), '8', 'INVALID_NONCE');
  });
});

describe('check 9: deployment', () => {
  it('passes for a known deployment', () => expect(check9Deployment({ [CLAIM.deploymentId]: '1' }, platform).deploymentId).toBe('1'));
  it('fails UNKNOWN_DEPLOYMENT', () => {
    expectFail(() => check9Deployment({ [CLAIM.deploymentId]: '999' }, platform), '9', 'UNKNOWN_DEPLOYMENT');
    expectFail(() => check9Deployment({}, platform), '9', 'UNKNOWN_DEPLOYMENT');
  });
});

describe('check 10: version and message type', () => {
  it('passes for 1.3.0 resource link and deep linking', () => {
    expect(check10Message({ [CLAIM.version]: '1.3.0', [CLAIM.messageType]: 'LtiResourceLinkRequest' })).toBe('LtiResourceLinkRequest');
    expect(check10Message({ [CLAIM.version]: '1.3.0', [CLAIM.messageType]: 'LtiDeepLinkingRequest' })).toBe('LtiDeepLinkingRequest');
  });
  it('fails UNSUPPORTED_MESSAGE_TYPE', () => {
    expectFail(() => check10Message({ [CLAIM.version]: '1.1', [CLAIM.messageType]: 'LtiResourceLinkRequest' }), '10', 'UNSUPPORTED_MESSAGE_TYPE');
    expectFail(() => check10Message({ [CLAIM.version]: '1.3.0', [CLAIM.messageType]: 'LtiSubmissionReviewRequest' }), '10', 'UNSUPPORTED_MESSAGE_TYPE');
  });
});

describe('check 11: required claims', () => {
  it('passes for full resource-link and deep-linking claims', () => {
    expect(() => check11Claims(moodleClaims(), 'LtiResourceLinkRequest')).not.toThrow();
    const dl = { ...moodleClaims(), [CLAIM.deepLinkingSettings]: { deep_link_return_url: `${ISSUER}/mod/lti/contentitem_return.php` } };
    expect(() => check11Claims(dl, 'LtiDeepLinkingRequest')).not.toThrow();
  });
  it.each([
    ['no sub', { sub: undefined }], ['no roles', { [CLAIM.roles]: undefined }], ['roles not strings', { [CLAIM.roles]: [1] }],
    ['no target_link_uri', { [CLAIM.targetLinkUri]: '' }], ['no resource_link', { [CLAIM.resourceLink]: undefined }],
    ['resource_link without id', { [CLAIM.resourceLink]: { title: 'x' } }],
  ])('fails MISSING_CLAIM: %s', (_n, over) => expectFail(() => check11Claims(moodleClaims(over), 'LtiResourceLinkRequest'), '11', 'MISSING_CLAIM'));
  it('fails MISSING_CLAIM for deep linking without deep_link_return_url', () =>
    expectFail(() => check11Claims(moodleClaims(), 'LtiDeepLinkingRequest'), '11', 'MISSING_CLAIM'));
});

describe('check 12: target_link_uri', () => {
  it('passes for the value of the state record', () => expect(() => check12Target(moodleClaims(), state, { launch: LAUNCH })).not.toThrow());
  it.each([
    ['other value than at login', `${LAUNCH}?resource=other`],
    ['other host', 'https://evil.test/lti/launch/cogniate?resource=seed'],
  ])('fails INVALID_TARGET_LINK_URI: %s', (_n, target) =>
    expectFail(() => check12Target(moodleClaims({ [CLAIM.targetLinkUri]: target }), state, { launch: LAUNCH }), '12', 'INVALID_TARGET_LINK_URI'));
  it('fails when the state record itself holds a foreign target', () =>
    expectFail(() => check12Target(moodleClaims({ [CLAIM.targetLinkUri]: `${LAUNCH}x` }), { ...state, targetLinkUri: `${LAUNCH}x` }, { launch: LAUNCH }), '12', 'INVALID_TARGET_LINK_URI'));
});

describe('safe detail reasons (contract §5, B-T2a-03)', () => {
  const now = 1_700_000_000_000;
  const s = now / 1000;
  const detailOf = (fn: () => unknown): string => {
    try {
      fn();
    } catch (err) {
      expect(err).toBeInstanceOf(LaunchCheckError);
      return (err as LaunchCheckError).detail;
    }
    throw new Error('expected a LaunchCheckError');
  };
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const payload = b64(moodleClaims());

  it.each<[string, () => unknown, string]>([
    ['alg=none (empty signature)', () => check4Token(`${b64({ alg: 'none', kid: 'k1' })}.${payload}.`), 'alg=none'],
    ['alg=HS256', () => check4Token(`${b64({ alg: 'HS256', kid: 'k1' })}.${payload}.c2ln`), 'alg=HS256'],
    ['a strange alg value is not echoed', () => check4Token(`${b64({ alg: '<script>alert(1)</script>', kid: 'k' })}.${payload}.c2ln`), 'alg=other'],
    ['no kid', () => check4Token(`${b64({ alg: 'RS256' })}.${payload}.c2ln`), 'kid_missing'],
    ['not a JWS', () => check4Token('abc'), 'not_compact_jws'],
    ['no id_token', () => check4Token(undefined), 'id_token_missing'],
    ['iss', () => check5IssuerAudience(moodleClaims({ iss: 'https://evil.test' }), platform), 'iss_mismatch'],
    ['aud', () => check5IssuerAudience(moodleClaims({ aud: 'other' }), platform), 'aud_mismatch'],
    ['two aud, no azp', () => check5IssuerAudience(moodleClaims({ aud: [CLIENT_ID, 'other'], azp: undefined }), platform), 'azp_missing'],
    ['one aud, other azp (A-T2a-03)', () => check5IssuerAudience(moodleClaims({ aud: CLIENT_ID, azp: 'other' }), platform), 'azp_mismatch'],
    ['expired 73 s', () => check7Time({ iat: s - 200, exp: s - 73 }, now), 'skew_s=73'],
    ['iat in the future', () => check7Time({ iat: s + 90, exp: s + 200 }, now), 'iat_future_s=90'],
    ['no exp', () => check7Time({ iat: s }, now), 'exp_iat_missing'],
    ['nonce', () => check8Nonce({ nonce: 'x' }, state), 'nonce_mismatch'],
    ['deployment', () => check9Deployment({ [CLAIM.deploymentId]: '999' }, platform), 'deployment_unknown'],
    ['version', () => check10Message({ [CLAIM.version]: '1.1', [CLAIM.messageType]: 'LtiResourceLinkRequest' }), 'version=1.1'],
    ['message type', () => check10Message({ [CLAIM.version]: '1.3.0', [CLAIM.messageType]: 'LtiSubmissionReviewRequest' }), 'message_type=LtiSubmissionReviewRequest'],
    ['no resource_link', () => check11Claims(moodleClaims({ [CLAIM.resourceLink]: undefined }), 'LtiResourceLinkRequest'), 'missing=resource_link'],
    ['no sub', () => check11Claims(moodleClaims({ sub: undefined }), 'LtiResourceLinkRequest'), 'missing=sub'],
    ['target differs from login', () => check12Target(moodleClaims({ [CLAIM.targetLinkUri]: `${LAUNCH}?resource=other` }), state, { launch: LAUNCH }), 'target_differs_from_login'],
    ['cookie missing', () => check2Cookie(undefined, 'st', 'abcdef0123'), 'cookie_missing'],
  ])('%s → %s', (_n, fn, detail) => {
    const d = detailOf(fn);
    expect(d).toBe(detail);
    expect(d).toMatch(/^[a-z_]+(=[A-Za-z0-9_.-]{1,40})?$/);
  });

  it('check 6 maps a key failure to its reason', async () => {
    const key = await makeKey('k1');
    const other = await makeKey('k2');
    const keys = createPlatformKeys(fakeOutbound(() => [key.publicJwk]));
    const err = await check6Signature(keys, await sign(other, moodleClaims()), platform, 't').catch((e: unknown) => e);
    expect(err).toMatchObject({ check: '6', code: 'INVALID_SIGNATURE', detail: 'kid_unknown' });
  });
});
