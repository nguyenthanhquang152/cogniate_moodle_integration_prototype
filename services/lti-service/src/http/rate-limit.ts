// LA-ADR-06 D1: one process, bounded token buckets and explicit proxy trust.
import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { z } from 'zod';
import type { Logger } from '@cogniate/shared';
import type { Db } from '../db/index.ts';
import { ApiError } from '../api-errors.ts';
import type { ToolAccount } from '../store/accounts.ts';
import { RATE_LIMIT_CLASSES } from '../store/accounts.ts';
import type { RateLimit, RateLimitClass, RateLimitSettings } from '../store/settings.ts';
import { RateLimitSettingsSchema, readRateLimitSettings } from '../store/settings.ts';

export const DEFAULT_RATE_LIMITS: Record<RateLimitClass, RateLimit> = {
  protocol: { ratePerMinute: 600, burst: 200 },
  protocol_account: { ratePerMinute: 6000, burst: 1000 },
  registration: { ratePerMinute: 10, burst: 5 },
  registration_account: { ratePerMinute: 1, burst: 20 },
  keys: { ratePerMinute: 300, burst: 100 },
  api: { ratePerMinute: 1200, burst: 300 },
  admin: { ratePerMinute: 600, burst: 200 },
  auth_failure: { ratePerMinute: 120, burst: 120 },
  operator: { ratePerMinute: 120, burst: 60 },
};
const SOFT = new Set<RateLimitClass>(['protocol_account', 'registration_account']);
const ADDRESS = new Set<RateLimitClass>(['protocol', 'registration', 'keys', 'auth_failure']);
const ACCOUNT = new Set<RateLimitClass>(['protocol_account', 'registration_account', 'api', 'admin']);
const MINUTE = 60_000;
export const MAX_BUCKETS = 100_000;

interface Bucket {
  tokens: number;
  at: number;
  ratePerMinute: number;
  burst: number;
  loggedAt?: number;
}

/** Map order is the LRU order. A check touches only its own (class, key). */
export class TokenBuckets {
  private readonly buckets = new Map<string, Bucket>();
  private readonly capacity: number;
  constructor(capacity = MAX_BUCKETS) {
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > MAX_BUCKETS) throw new Error('Invalid bucket capacity');
    this.capacity = capacity;
  }
  get size(): number { return this.buckets.size; }

  take(name: RateLimitClass, key: string, limit: RateLimit, now: number, spend = true): { allowed: boolean; retryAfter: number; log: boolean } {
    const id = `${name}:${key}`;
    let bucket = this.buckets.get(id);
    // Successful credentials check this bucket without creating or spending one.
    if (!bucket && !spend) return { allowed: true, retryAfter: 0, log: false };
    if (!bucket) {
      if (this.buckets.size === this.capacity) this.buckets.delete(this.buckets.keys().next().value!);
      bucket = { tokens: limit.burst, at: now, ...limit };
    } else if (bucket.ratePerMinute !== limit.ratePerMinute || bucket.burst !== limit.burst) {
      // An operator change starts the new budget at once. Keep the log suppression clock.
      Object.assign(bucket, limit, { tokens: limit.burst, at: now });
    }
    this.buckets.delete(id);
    this.buckets.set(id, bucket);
    bucket.tokens = Math.min(limit.burst, bucket.tokens + Math.max(0, now - bucket.at) * limit.ratePerMinute / MINUTE);
    bucket.at = Math.max(now, bucket.at);
    if (bucket.tokens >= 1) {
      if (spend) bucket.tokens -= 1;
      return { allowed: true, retryAfter: 0, log: false };
    }
    const retryAfter = Math.max(1, Math.ceil((1 - bucket.tokens) * 60 / limit.ratePerMinute));
    const log = bucket.loggedAt === undefined || now - bucket.loggedAt >= MINUTE;
    if (log) bucket.loggedAt = now;
    return { allowed: false, retryAfter, log };
  }
}

function ipv6Words(address: string): number[] {
  // URL canonicalization converts an embedded IPv4 suffix to two hexadecimal words.
  const canonical = new URL(`http://[${address}]/`).hostname.slice(1, -1);
  const [left, right] = canonical.split('::');
  const a = left ? left.split(':').map((v) => parseInt(v, 16)) : [];
  const b = right ? right.split(':').map((v) => parseInt(v, 16)) : [];
  return right === undefined ? a : [...a, ...Array<number>(8 - a.length - b.length).fill(0), ...b];
}

/** Normalize mapped IPv4 too, so it cannot get a second bucket through an IPv6 socket. */
export function clientAddress(address: string): string {
  const plain = address.split('%')[0]!;
  if (isIP(plain) === 4) return plain;
  if (isIP(plain) !== 6) return 'unknown';
  const words = ipv6Words(plain);
  if (words.slice(0, 5).every((v) => v === 0) && words[5] === 0xffff) {
    return [words[6]! >> 8, words[6]! & 255, words[7]! >> 8, words[7]! & 255].join('.');
  }
  return new URL(`http://[${plain}]/`).hostname.slice(1, -1);
}

/** IPv6 privacy addresses in one /64 share a budget. Logs keep the full client address. */
export function addressKey(address: string): string {
  const normalized = clientAddress(address);
  return isIP(normalized) === 6 ? `${ipv6Words(normalized).slice(0, 4).map((v) => v.toString(16)).join(':')}::/64` : normalized;
}

export class RateLimiter {
  readonly buckets = new TokenBuckets();
  private settings: RateLimitSettings;
  private readonly env: RateLimitSettings;
  private readonly logger: Logger;
  private readonly now: () => number;
  constructor(db: Db, logger: Logger, now: () => number = Date.now, env = process.env.LTI_RATE_LIMITS) {
    this.logger = logger;
    this.now = now;
    try { this.env = env?.trim() ? RateLimitSettingsSchema.parse(JSON.parse(env)) : {}; }
    catch (error) {
      if (error instanceof z.ZodError) {
        const issue = error.issues[0]!;
        const path = [...issue.path, ...(issue.code === 'unrecognized_keys' ? issue.keys : [])].join('.') || '<root>';
        throw new Error(`LTI_RATE_LIMITS: ${path}: ${issue.message}`);
      }
      throw new Error('LTI_RATE_LIMITS: expected valid JSON');
    }
    this.settings = readRateLimitSettings(db);
  }

  replaceSettings(settings: RateLimitSettings): void { this.settings = settings; }

  get registrationSessionLimit(): number {
    return this.settings.registrationSessionsPerAddress ?? this.env.registrationSessionsPerAddress ?? 10;
  }

  view() {
    return {
      classes: Object.fromEntries(RATE_LIMIT_CLASSES.map((name) => [name, {
        ...this.limit(name), source: this.settings.classes?.[name] ? 'operator' : this.env.classes?.[name] ? 'env' : 'default',
      }])),
      registrationSessionsPerAddress: this.registrationSessionLimit,
      registrationSessionsSource: this.settings.registrationSessionsPerAddress !== undefined ? 'operator' : this.env.registrationSessionsPerAddress !== undefined ? 'env' : 'default',
    };
  }

  private limit(name: RateLimitClass, account?: ToolAccount): RateLimit {
    return (ACCOUNT.has(name) ? account?.limits?.[name] : undefined) ?? this.settings.classes?.[name] ?? this.env.classes?.[name] ?? DEFAULT_RATE_LIMITS[name];
  }

  check(name: RateLimitClass, key: string, account?: ToolAccount, spend = true): void {
    const result = this.buckets.take(name, ADDRESS.has(name) ? addressKey(key) : key, this.limit(name, account), this.now(), spend);
    if (result.allowed) return;
    if (result.log) {
      if (SOFT.has(name)) this.logger.warn('rate_limit_soft', { class: name, tool_account_id: key });
      else this.logger.warn('rate_limited', {
        class: name, key_kind: ADDRESS.has(name) ? 'client_address' : name === 'operator' ? 'operator_key' : 'api_key',
        ...(account ? { tool_account_id: account.id } : {}),
        ...(ADDRESS.has(name) ? { client_ip: clientAddress(key) } : {}), retry_after_s: result.retryAfter,
      });
    }
    if (!SOFT.has(name)) throw new ApiError('RATE_LIMITED', `Too many requests. Retry after ${result.retryAfter} s.`, { details: { retryAfter: result.retryAfter } });
  }
}

// Both listeners share buckets and committed settings. Weak keys keep test databases isolated.
const limiters = new WeakMap<Db, RateLimiter>();
export function rateLimiterFor(db: Db, logger: Logger, now: () => number = Date.now): RateLimiter {
  let limiter = limiters.get(db);
  if (!limiter) { limiter = new RateLimiter(db, logger, now); limiters.set(db, limiter); }
  return limiter;
}

/** Called only when the API key or operator key fails, never for a bad secondary credential. */
export function recordAuthFailure(limiter: RateLimiter, address: string): void {
  limiter.check('auth_failure', address);
}

/**
 * BD-A2-20: call before registration's outbound fetch; store clientKey with the new session.
 * Concurrent starts may pass together; the hard registration bucket bounds that overlap.
 * Completion clears client_key. Old rows without a key and expired rows do not count.
 */
export function checkRegistrationSessionCap(db: Db, limiter: RateLimiter, address: string, accountId: string, now: number) {
  const clientKey = addressKey(address);
  const { count } = db.prepare(`SELECT count(*) AS count FROM registration_session
    WHERE tool_account_id = ? AND client_key = ? AND status IN ('open', 'completing') AND expires_at > ?`)
    .get(accountId, clientKey, now) as { count: number };
  return { allowed: count < limiter.registrationSessionLimit, clientKey, open: count, limit: limiter.registrationSessionLimit };
}

export type ProxyResolver = (host: string) => Promise<Array<{ address: string }>>;

/** DNS failures remove trust until the next refresh; they never widen the trusted set. */
export async function createTrustedProxy(value = process.env.TRUSTED_PROXY_CIDRS ?? '', resolve: ProxyResolver = (host) => lookup(host, { all: true }), logger?: Logger) {
  const fixed = new BlockList();
  const hosts: string[] = [];
  for (const entry of value.split(/[\s,]+/).filter(Boolean)) {
    const [address, prefix, extra] = entry.split('/');
    const family = isIP(address!);
    if (family) {
      const type = family === 4 ? 'ipv4' : 'ipv6';
      if (prefix === undefined) fixed.addAddress(address!, type);
      else if (extra === undefined && /^\d+$/.test(prefix) && Number(prefix) <= (family === 4 ? 32 : 128)) fixed.addSubnet(address!, Number(prefix), type);
      else throw new Error(`TRUSTED_PROXY_CIDRS: ${JSON.stringify(entry)} is not a valid CIDR`);
    } else if (prefix === undefined && /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(entry)) { if (!hosts.includes(entry)) hosts.push(entry); }
    else throw new Error(`TRUSTED_PROXY_CIDRS: ${JSON.stringify(entry)} is not a valid address or host name`);
  }
  let resolved = new BlockList();
  let closed = false;
  let refreshing: Promise<void> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let unresolved = false;
  const refresh = (): Promise<void> => {
    refreshing ??= (async () => {
      const next = new BlockList();
      const results = await Promise.allSettled(hosts.map((host) => resolve(host)));
      unresolved = false;
      for (const [index, result] of results.entries()) {
        const addresses = result.status === 'fulfilled' ? result.value.filter(({ address }) => isIP(address)) : [];
        if (addresses.length === 0) {
          unresolved = true;
          logger?.warn('trusted_proxy_unresolved', { host: hosts[index] });
        }
        for (const { address } of addresses) next.addAddress(address, isIP(address) === 4 ? 'ipv4' : 'ipv6');
      }
      if (!closed) resolved = next;
    })().finally(() => {
      refreshing = undefined;
      clearTimeout(timer);
      if (!closed && hosts.length) {
        // Retry failed lookups promptly while keeping the trusted set closed.
        timer = setTimeout(() => { void refresh(); }, unresolved ? 5_000 : MINUTE);
        timer.unref();
      }
    });
    return refreshing;
  };
  await refresh();
  return {
    trust: (address: string): boolean => {
      const ip = clientAddress(address);
      const family = isIP(ip);
      return family !== 0 && (fixed.check(ip, family === 4 ? 'ipv4' : 'ipv6') || resolved.check(ip, family === 4 ? 'ipv4' : 'ipv6'));
    },
    refresh,
    close: () => { closed = true; clearTimeout(timer); },
  };
}
