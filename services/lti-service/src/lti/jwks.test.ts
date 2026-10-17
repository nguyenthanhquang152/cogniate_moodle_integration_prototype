import type { OutboundClient } from '@cogniate/shared';
import { OutboundError } from '@cogniate/shared';
import { describe, expect, it } from 'vitest';
import { fakeOutbound, makeKey, moodleClaims, sign } from '../testkit.ts';
import { PlatformKeyError, createPlatformKeys } from './jwks.ts';

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

describe('JWKS refresh failure and the 24 h maximum age (security §2.4, AC-T2-32)', () => {
  const url = 'https://qa-platform.test/jwks.json';
  type Mode = 'ok' | 'not_found' | 'network';
  async function setup() {
    const k1 = await makeKey('k1');
    const k2 = await makeKey('k2');
    const state = { mode: 'ok' as Mode, calls: 0 };
    const out: OutboundClient = {
      allowlist: [],
      async request() {
        state.calls += 1;
        if (state.mode === 'network') throw new OutboundError('network_error', 'qa-platform.test', 'refused');
        const body = Buffer.from(state.mode === 'ok' ? JSON.stringify({ keys: [k1.publicJwk] }) : 'not found');
        return { status: state.mode === 'ok' ? 200 : 404, headers: {}, body, text: () => body.toString(), json: () => JSON.parse(body.toString()) as unknown };
      },
    };
    const clock = { now: 5_000_000 };
    const keys = createPlatformKeys(out, () => clock.now);
    const fails = async (token: string) => {
      const err = await keys.verify(token, url, 't').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(PlatformKeyError);
      return (err as PlatformKeyError).detail;
    };
    return { k1, k2, state, clock, keys, fails };
  }

  it('unknown kid when the refetch fails: jwks_fetch_failed with one attempt; then a cached-key token is accepted', async () => {
    const { k1, k2, state, clock, keys, fails } = await setup();
    await keys.verify(await sign(k1, moodleClaims()), url, 't');
    clock.now += 61_000;
    state.mode = 'not_found';
    expect(await fails(await sign(k2, moodleClaims()))).toBe('jwks_fetch_failed');
    expect(state.calls).toBe(2);
    await keys.verify(await sign(k1, moodleClaims()), url, 't'); // the cached key still works
    expect(state.calls).toBe(2);
  });

  it('a refresh after 10 min fails: the cached keys are used, attempts at most once per minute', async () => {
    const { k1, k2, state, clock, keys, fails } = await setup();
    await keys.verify(await sign(k1, moodleClaims()), url, 't');
    clock.now += 11 * 60_000;
    state.mode = 'network';
    await keys.verify(await sign(k1, moodleClaims()), url, 't');
    expect(state.calls).toBe(2);
    clock.now += 30_000;
    await keys.verify(await sign(k1, moodleClaims()), url, 't');
    expect(state.calls).toBe(2); // no new attempt within a minute
    expect(await fails(await sign(k2, moodleClaims()))).toBe('jwks_fetch_failed'); // last attempt failed, no refetch
    expect(state.calls).toBe(2);
    clock.now += 31_000;
    await keys.verify(await sign(k1, moodleClaims()), url, 't');
    expect(state.calls).toBe(3);
    state.mode = 'ok';
    clock.now += 61_000;
    await keys.verify(await sign(k1, moodleClaims()), url, 't'); // a good refresh again
    expect(state.calls).toBe(4);
  });

  it('after 24 h without a good fetch the cache is dropped: jwks_unavailable', async () => {
    const { k1, state, clock, keys, fails } = await setup();
    await keys.verify(await sign(k1, moodleClaims()), url, 't');
    state.mode = 'not_found';
    clock.now += 24 * 60 * 60_000 - 1;
    await keys.verify(await sign(k1, moodleClaims()), url, 't'); // just under 24 h: still usable
    clock.now += 61_000;
    expect(await fails(await sign(k1, moodleClaims()))).toBe('jwks_unavailable');
  });

  it('first fetch fails: jwks_unavailable; unknown kid after a good refetch: kid_unknown; bad signature: bad_signature', async () => {
    const { k1, k2, state, clock, fails } = await setup();
    state.mode = 'network';
    expect(await fails(await sign(k1, moodleClaims()))).toBe('jwks_unavailable');
    state.mode = 'ok';
    clock.now += 61_000;
    const token = await sign(k1, moodleClaims());
    const [h, p] = token.split('.');
    const otherSig = (await sign(k1, moodleClaims({ sub: 'other' }))).split('.')[2];
    expect(await fails(`${h}.${p}.${otherSig}`)).toBe('bad_signature');
    clock.now += 61_000;
    expect(await fails(await sign(k2, moodleClaims()))).toBe('kid_unknown');
  });
});

describe('single-flight JWKS fetch (A-T2b-01)', () => {
  it('5 parallel launches on an empty cache: one fetch, all verify; a parallel unknown kid waits too', async () => {
    const k1 = await makeKey('k1');
    let fetches = 0;
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const out: OutboundClient = {
      allowlist: [],
      async request() {
        fetches += 1;
        await gate; // the fetch is slow: the other launches arrive while it runs
        const body = Buffer.from(JSON.stringify({ keys: [k1.publicJwk] }));
        return { status: 200, headers: {}, body, text: () => body.toString(), json: () => JSON.parse(body.toString()) as unknown };
      },
    };
    const keys = createPlatformKeys(out, () => 7_000_000);
    const url = 'https://qa-platform.test/jwks.json';
    const tokens = await Promise.all(Array.from({ length: 5 }, () => sign(k1, moodleClaims())));
    const runs = tokens.map((t, i) => keys.verify(t, url, `trace-${i}`));
    release();
    await expect(Promise.all(runs)).resolves.toHaveLength(5);
    expect(fetches).toBe(1);
  });

  it('a failing in-flight fetch: every waiting launch gets jwks_unavailable, still one fetch', async () => {
    const k1 = await makeKey('k1');
    let fetches = 0;
    const out: OutboundClient = {
      allowlist: [],
      async request() {
        fetches += 1;
        await new Promise((r) => setTimeout(r, 20));
        throw new OutboundError('timeout', 'qa-platform.test', 'slow');
      },
    };
    const keys = createPlatformKeys(out, () => 7_000_000);
    const results = await Promise.all(Array.from({ length: 3 }, async () => keys.verify(await sign(k1, moodleClaims()), 'https://qa-platform.test/j', 't').catch((e: PlatformKeyError) => e.detail)));
    expect(results).toEqual(['jwks_unavailable', 'jwks_unavailable', 'jwks_unavailable']);
    expect(fetches).toBe(1);
  });
});
