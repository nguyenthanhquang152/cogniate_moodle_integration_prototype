import { describe, expect, it } from 'vitest';
import { newApiKey } from './crypto.ts';

// The shared helpers (random tokens, AES-256-GCM, SHA-256, safeEqual) are tested in packages/shared/src/crypto.test.ts.
describe('LTI service API key', () => {
  it('has the format ltis_ + 43 base64url characters and is random', () => {
    expect(newApiKey()).toMatch(/^ltis_[A-Za-z0-9_-]{43}$/);
    expect(newApiKey()).not.toBe(newApiKey());
  });
});
