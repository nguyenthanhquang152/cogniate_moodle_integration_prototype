import { describe, expect, it } from 'vitest';
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
