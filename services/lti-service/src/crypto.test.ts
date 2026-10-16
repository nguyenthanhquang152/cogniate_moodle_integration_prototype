import { describe, expect, it } from 'vitest';
import { decrypt, encrypt, newApiKey, randomToken, safeEqual, sha256Hex } from './crypto.ts';

describe('crypto helpers', () => {
  it('makes 43-character tokens and ltis_ API keys', () => {
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newApiKey()).toMatch(/^ltis_[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(randomToken());
  });
  it('encrypts with AES-256-GCM and detects tampering', () => {
    const key = Buffer.alloc(32, 1);
    const blob = encrypt(key, 'secret');
    expect(decrypt(key, blob)).toBe('secret');
    blob[blob.length - 1] = blob[blob.length - 1]! ^ 1;
    expect(() => decrypt(key, blob)).toThrow();
  });
  it('compares in constant time and hashes', () => {
    expect(safeEqual('a', 'a')).toBe(true);
    expect(safeEqual('a', 'ab')).toBe(false);
    expect(sha256Hex('x')).toMatch(/^[0-9a-f]{64}$/);
  });
});
