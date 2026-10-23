import { afterEach, describe, expect, it } from 'vitest';
import type { Harness } from '../../testkit.ts';
import { harness } from '../../testkit.ts';
import { isKeyList } from './platform-check-keys.ts';

const rsa = { kty: 'RSA', kid: 'k1', alg: 'RS256', use: 'sig', n: 'n', e: 'AQAB' };
const ec = { kty: 'EC', kid: 'k2', crv: 'P-256', x: 'x', y: 'y' };

describe('the JWKS key list rule of the connection check (LA-E6-01 r1 BLOCKER)', () => {
  it.each([
    [[rsa]], [[rsa, ec]], [[{ kty: 'oct' }]],
  ])('accepts a list of key objects %j', (keys) => {
    expect(isKeyList(keys)).toBe(true);
  });

  it.each([
    ['null', [null]],
    ['a string', ['not a key']],
    ['an array', [[]]],
    ['an empty object', [{}]],
    ['an empty kty', [{ kty: '' }]],
    ['a non-string kty', [{ kty: 1 }]],
    ['a mix with one valid key', [rsa, null]],
    ['a mix with a keyless object', [rsa, { kid: 'k3' }]],
    ['an empty list', []],
    ['an object instead of a list', { kty: 'RSA' }],
    ['no list', undefined],
    ['null instead of a list', null],
  ])('refuses %s', (_name, keys) => {
    expect(isKeyList(keys)).toBe(false);
  });
});

describe('POST /api/platforms/:id/check uses the key list rule', () => {
  const resources: Harness[] = [];
  afterEach(async () => { for (const h of resources.splice(0)) { await h.app.close(); h.db.close(); } });
  it.each([[[null]], [['not a key']], [[[]]], [[{}]]])('answers invalid_jwks for the JWKS entries %j', async (keys) => {
    const h = await harness({ outbound: (_url, init) => init.method === 'POST'
      ? { status: 200, body: { access_token: 'a', expires_in: 3600 } } : { status: 200, body: { keys } } });
    resources.push(h);
    const res = await h.app.inject({ method: 'POST', url: `/api/platforms/${h.platform.id}/check`,
      headers: { authorization: `Bearer ${h.apiKey}`, 'content-type': 'application/json' }, payload: '{}' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ jwks: { ok: false, detail: 'invalid_jwks' }, token: { ok: true } });
  });
});
