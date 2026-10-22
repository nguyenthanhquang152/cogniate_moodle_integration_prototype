import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDb } from '../db/index.ts';
import { ensureAccount, getAccount, updateAccount } from '../store/accounts.ts';
import { capturingLogger, URLS } from '../testkit.ts';
import { RateLimiter, TokenBuckets, addressKey, clientAddress, createTrustedProxy, recordAuthFailure } from './rate-limit.ts';

const RATE = { ratePerMinute: 60, burst: 2 };
afterEach(() => vi.useRealTimers());

describe('token buckets', () => {
  it('spends, refills per second, caps the burst, and gives whole Retry-After seconds', () => {
    const buckets = new TokenBuckets();
    expect(buckets.take('api', 'a', RATE, 0).allowed).toBe(true);
    expect(buckets.take('api', 'a', RATE, 0).allowed).toBe(true);
    expect(buckets.take('api', 'a', RATE, 1)).toMatchObject({ allowed: false, retryAfter: 1 });
    expect(buckets.take('api', 'a', RATE, 999).allowed).toBe(false);
    expect(buckets.take('api', 'a', RATE, 1000).allowed).toBe(true);
    expect(buckets.take('api', 'a', RATE, 100_000).allowed).toBe(true);
    expect(buckets.take('api', 'a', RATE, 100_000).allowed).toBe(true);
    expect(buckets.take('api', 'a', RATE, 100_000).allowed).toBe(false);
  });

  it('evicts the least recently used key, separates classes, and enforces the 100,000 bound', () => {
    const buckets = new TokenBuckets(2);
    const limit = { ratePerMinute: 1, burst: 1 };
    buckets.take('api', 'a', limit, 0);
    buckets.take('api', 'b', limit, 0);
    expect(buckets.take('api', 'a', limit, 0).allowed).toBe(false); // touch a
    expect(buckets.take('admin', 'a', limit, 0).allowed).toBe(true); // evict b, not a
    expect(buckets.take('api', 'a', limit, 0).allowed).toBe(false);
    expect(buckets.take('api', 'b', limit, 0).allowed).toBe(true);
    expect(buckets.size).toBe(2);
    expect(() => new TokenBuckets(100_001)).toThrow();
    const full = new TokenBuckets();
    for (let i = 0; i <= 100_000; i++) full.take('keys', String(i), limit, 0);
    expect(full.size).toBe(100_000);
    expect(full.take('keys', '0', limit, 0).allowed).toBe(true);
  });

  it('does not create or spend a bucket for a successful credential precheck', () => {
    const buckets = new TokenBuckets();
    expect(buckets.take('auth_failure', 'a', RATE, 0, false).allowed).toBe(true);
    expect(buckets.size).toBe(0);
    buckets.take('auth_failure', 'a', RATE, 0);
    for (let i = 0; i < 200; i++) expect(buckets.take('auth_failure', 'a', RATE, 0, false).allowed).toBe(true);
    buckets.take('auth_failure', 'a', RATE, 0);
    expect(buckets.take('auth_failure', 'a', RATE, 0, false).allowed).toBe(false);
    expect(buckets.take('auth_failure', 'a', RATE, 1000, false).allowed).toBe(true);
  });

  it('does not refill when the clock moves backward and suppresses repeated logs for a minute', () => {
    const buckets = new TokenBuckets();
    const limit = { ratePerMinute: 1, burst: 1 };
    buckets.take('api', 'a', limit, 1000);
    expect(buckets.take('api', 'a', limit, 0)).toEqual({ allowed: false, retryAfter: 60, log: true });
    expect(buckets.take('api', 'a', limit, 999)).toMatchObject({ allowed: false, log: false });
    expect(buckets.take('api', 'a', limit, 60_000)).toMatchObject({ allowed: false, log: true });
  });
});

function fixture(env?: string) {
  const db = openDb(':memory:');
  const { logger, lines } = capturingLogger();
  const clock = { now: 0 };
  const limiter = new RateLimiter(db, logger, () => clock.now, env ?? '');
  return { db, limiter, lines, clock };
}

describe('class policy', () => {
  it('AC-LA-E5-03-10: IPv6 addresses share a /64 bucket, but not two prefixes', () => {
    const h = fixture();
    try {
      h.limiter.replaceSettings({ classes: { keys: { ratePerMinute: 1, burst: 1 } } });
      h.limiter.check('keys', '2001:db8:1234:5678::1');
      expect(() => h.limiter.check('keys', '2001:0db8:1234:5678:abcd:ffff:1:9999')).toThrow('RATE_LIMITED');
      expect(() => h.limiter.check('keys', '2001:db8:1234:5679::1')).not.toThrow();
      expect(addressKey('::ffff:192.0.2.1')).toBe(addressKey('192.0.2.1'));
      expect(addressKey('2001:db8::192.0.2.1')).toBe('2001:db8:0:0::/64');
      expect(clientAddress('FE80::1%en0')).toBe('fe80::1');
      expect(h.lines[0]).toMatchObject({ event: 'rate_limited', client_ip: '2001:db8:1234:5678:abcd:ffff:1:9999' });
    } finally { h.db.close(); }
  });

  it('soft account classes never refuse and log at most once per minute per bucket', () => {
    const h = fixture();
    try {
      h.limiter.replaceSettings({ classes: { protocol_account: { ratePerMinute: 1, burst: 1 } } });
      for (let i = 0; i < 10; i++) h.limiter.check('protocol_account', 'one');
      expect(h.lines.filter((l) => l.event === 'rate_limit_soft')).toHaveLength(1);
      expect(h.lines[0]).toMatchObject({ class: 'protocol_account', tool_account_id: 'one' });
      h.clock.now = 60_000;
      h.limiter.check('protocol_account', 'one');
      h.limiter.check('protocol_account', 'one');
      expect(h.lines.filter((l) => l.event === 'rate_limit_soft')).toHaveLength(2);
    } finally { h.db.close(); }
  });

  it('account overrides beat operator/env/default, but cannot change address budgets', () => {
    const h = fixture(JSON.stringify({ classes: { api: { ratePerMinute: 5, burst: 5 }, admin: RATE } }));
    try {
      ensureAccount(h.db, { id: 'one', name: 'One', appUrl: URLS.app });
      const account = updateAccount(h.db, 'one', { limits: { api: { ratePerMinute: 1, burst: 1 }, keys: { ratePerMinute: 999, burst: 999 } } }, 0);
      h.limiter.replaceSettings({ classes: { api: RATE, keys: { ratePerMinute: 1, burst: 1 } } });
      expect(h.limiter.view().classes).toMatchObject({ api: { ...RATE, source: 'operator' }, admin: { ...RATE, source: 'env' }, operator: { source: 'default' } });
      h.limiter.check('api', 'key-one', account);
      expect(() => h.limiter.check('api', 'key-one', account)).toThrow('RATE_LIMITED');
      expect(() => h.limiter.check('api', 'key-two', getAccount(h.db, 'one')!)).not.toThrow();
      expect(() => h.limiter.check('admin', 'key-one', account)).not.toThrow();
      h.limiter.check('keys', '192.0.2.1', account);
      expect(() => h.limiter.check('keys', '192.0.2.1', account)).toThrow('RATE_LIMITED');
      h.limiter.replaceSettings({});
      expect(h.limiter.view().classes.api).toEqual({ ratePerMinute: 5, burst: 5, source: 'env' });
    } finally { h.db.close(); }
  });

  it('only key failures spend the failure bucket; a depleted address waits for refill', () => {
    const h = fixture();
    try {
      h.limiter.replaceSettings({ classes: { auth_failure: { ratePerMinute: 60, burst: 1 } } });
      recordAuthFailure(h.limiter, '192.0.2.1');
      expect(() => h.limiter.check('auth_failure', '192.0.2.1', undefined, false)).toThrow('RATE_LIMITED');
      expect(() => h.limiter.check('auth_failure', '192.0.2.2', undefined, false)).not.toThrow();
      h.clock.now = 1000;
      expect(() => h.limiter.check('auth_failure', '192.0.2.1', undefined, false)).not.toThrow();
      expect(() => recordAuthFailure(h.limiter, '192.0.2.1')).not.toThrow();
    } finally { h.db.close(); }
  });

  it.each(['{', '{"classes":{"unknown":{"ratePerMinute":1,"burst":1}}}', '{"classes":{"api":{"ratePerMinute":0,"burst":1}}}'])(
    'refuses invalid environment settings at start: %s', (env) => {
      const db = openDb(':memory:');
      try { expect(() => new RateLimiter(db, capturingLogger().logger, Date.now, env)).toThrow('LTI_RATE_LIMITS'); }
      finally { db.close(); }
    },
  );
});

describe('trusted proxy addresses', () => {
  it('trusts CIDRs only, uses the closest untrusted forwarded hop, and groups its IPv6 prefix', async () => {
    const proxy = await createTrustedProxy('10.0.0.0/8, 2001:db8:1::/48');
    const app = Fastify({ trustProxy: proxy.trust });
    app.get('/', (req) => ({ ip: req.ip }));
    try {
      const request = (remoteAddress: string, forwarded: string) => app.inject({ url: '/', remoteAddress, headers: { 'x-forwarded-for': forwarded } });
      expect((await request('192.0.2.1', '198.51.100.1')).json().ip).toBe('192.0.2.1');
      expect((await request('10.0.0.2', '198.51.100.1')).json().ip).toBe('198.51.100.1');
      expect((await request('10.0.0.2', '198.51.100.99, 192.0.2.1')).json().ip).toBe('192.0.2.1');
      expect(proxy.trust('::ffff:10.0.0.2')).toBe(true);
      expect(proxy.trust('2001:db8:1:ffff::1')).toBe(true);
      expect(proxy.trust('2001:db8:2::1')).toBe(false);
    } finally { proxy.close(); await app.close(); }
  });

  it('resolves hosts at startup and each 60 seconds, replaces old answers, and fails closed', async () => {
    vi.useFakeTimers();
    const resolve = vi.fn().mockResolvedValueOnce([{ address: '192.0.2.1' }]).mockResolvedValueOnce([{ address: '192.0.2.2' }]).mockRejectedValueOnce(new Error('DNS unavailable'));
    const proxy = await createTrustedProxy('proxy', resolve);
    try {
      expect(proxy.trust('192.0.2.1')).toBe(true);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(resolve).toHaveBeenCalledTimes(2);
      expect(proxy.trust('192.0.2.1')).toBe(false);
      expect(proxy.trust('192.0.2.2')).toBe(true);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(proxy.trust('192.0.2.2')).toBe(false);
      proxy.close();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(resolve).toHaveBeenCalledTimes(3);
    } finally { proxy.close(); }
  });

  it('an empty list trusts no forwarded address; bad CIDRs stop startup', async () => {
    const proxy = await createTrustedProxy('');
    expect(proxy.trust('127.0.0.1')).toBe(false);
    proxy.close();
    await expect(createTrustedProxy('10.0.0.0/33')).rejects.toThrow('TRUSTED_PROXY_CIDRS');
    await expect(createTrustedProxy('::/129')).rejects.toThrow('TRUSTED_PROXY_CIDRS');
  });
});
