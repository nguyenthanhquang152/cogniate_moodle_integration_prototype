import { describe, expect, it } from 'vitest';
import { fakeOutbound, makeKey, moodleClaims, sign } from '../testkit.ts';
import { createPlatformKeys } from './jwks.ts';

describe('platform JWKS cache', () => {
  it('fetches once, keeps 10 min, and refetches an unknown kid at most once per minute', async () => {
    const k1 = await makeKey('k1');
    const k2 = await makeKey('k2');
    let served = [k1.publicJwk];
    const out = fakeOutbound(() => served);
    const clock = { now: 1_000_000 };
    const keys = createPlatformKeys(out, () => clock.now);
    const url = 'https://moodle.test/mod/lti/certs.php';
    await keys.verify(await sign(k1, moodleClaims()), url, 't');
    await keys.verify(await sign(k1, moodleClaims()), url, 't');
    expect(out.calls).toHaveLength(1);
    // Unknown kid less than 60 s after the fetch: no refetch, fails.
    served = [k1.publicJwk, k2.publicJwk];
    clock.now += 30_000;
    await expect(keys.verify(await sign(k2, moodleClaims()), url, 't')).rejects.toThrow();
    expect(out.calls).toHaveLength(1);
    // 61 s after the fetch: one refetch, then it passes.
    clock.now += 31_000;
    await keys.verify(await sign(k2, moodleClaims()), url, 't');
    expect(out.calls).toHaveLength(2);
    // Cache older than 10 min: refetch.
    clock.now += 11 * 60_000;
    await keys.verify(await sign(k1, moodleClaims()), url, 't');
    expect(out.calls).toHaveLength(3);
  });

  it('refuses a non-RS256 token even if the key matches', async () => {
    const k1 = await makeKey('k1');
    const keys = createPlatformKeys(fakeOutbound(() => [k1.publicJwk]));
    const token = await sign(k1, moodleClaims(), { alg: 'RS256' });
    const [, p, s] = token.split('.');
    const forged = `${Buffer.from(JSON.stringify({ alg: 'none', kid: 'k1' })).toString('base64url')}.${p}.${s}`;
    await expect(keys.verify(forged, 'https://moodle.test/k', 't')).rejects.toThrow();
  });
});
