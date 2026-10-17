import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decrypt, encrypt, randomId, randomToken, safeEqual, sha256Hex } from './crypto.ts';

describe('crypto', () => {
  it('randomToken is 43 base64url characters; randomId has the prefix and 128 bits', () => {
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomId('crs_')).toMatch(/^crs_[A-Za-z0-9_-]{22}$/);
    expect(randomId('pkg_')).not.toBe(randomId('pkg_'));
  });

  it('sha256Hex and safeEqual', () => {
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(safeEqual('a', 'a')).toBe(true);
    expect(safeEqual('a', 'b')).toBe(false);
    expect(safeEqual('a', 'aa')).toBe(false);
  });

  it('encrypt and decrypt round trip; a changed byte fails', () => {
    const key = randomBytes(32);
    const blob = encrypt(key, 'secret value');
    expect(decrypt(key, blob)).toBe('secret value');
    blob[blob.length - 1]! ^= 1;
    expect(() => decrypt(key, blob)).toThrow();
  });
});
