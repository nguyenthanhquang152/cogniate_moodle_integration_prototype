import type { OutboundClient } from '@cogniate/shared';
import type { CompactVerifyResult, JSONWebKeySet } from 'jose';
import { compactVerify, createLocalJWKSet, errors } from 'jose';

/** Refresh age: after 10 min the keys are fetched again (security §2.4). */
export const JWKS_REFRESH_MS = 10 * 60 * 1000;
/** On failed refreshes, cached keys stay usable up to 24 h after the last good fetch (security §2.4, AC-T2-32). */
export const JWKS_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** At most one fetch attempt per minute per JWKS URL (unknown kid, or a refresh after a failure). */
export const JWKS_ATTEMPT_MIN_MS = 60 * 1000;

/** Safe reason for launch_check_failed.detail (contract §5). Never a token, claim value or key. */
export type KeyFailure = 'kid_unknown' | 'jwks_fetch_failed' | 'jwks_unavailable' | 'jwks_invalid' | 'bad_signature';

export class PlatformKeyError extends Error {
  readonly detail: KeyFailure;
  constructor(detail: KeyFailure) {
    super(detail);
    this.name = 'PlatformKeyError';
    this.detail = detail;
  }
}

interface CacheEntry {
  jwks: JSONWebKeySet | null;
  /** Time of the last good fetch. */
  goodAt: number | null;
  /** Time of the last fetch attempt (good or failed). */
  attemptAt: number;
  lastFailed: boolean;
}

/**
 * Platform JWKS (security §2.4, contract §4): fetched with the guarded outbound client, never with the jose remote
 * fetcher. Rules:
 *  - Refresh when the keys are older than 10 min, at most one attempt per minute.
 *  - A failed refresh keeps the cached keys, up to 24 h after the last good fetch; then they are dropped.
 *  - An unknown kid causes one refetch, at most one attempt per minute per JWKS URL.
 * Every attempt logs one outbound event (outbound client); a failed attempt is logged there.
 */
export function createPlatformKeys(outbound: OutboundClient, now: () => number = Date.now) {
  const cache = new Map<string, CacheEntry>();

  /** One fetch attempt. True if the entry now holds new keys. */
  async function attempt(url: string, entry: CacheEntry, traceId: string): Promise<boolean> {
    entry.attemptAt = now();
    try {
      const res = await outbound.request(url, { traceId, headers: { accept: 'application/json' } });
      if (res.status !== 200) throw new Error(`JWKS answered ${res.status}`);
      const body = res.json() as { keys?: unknown };
      if (!body || !Array.isArray(body.keys) || !body.keys.every((k) => k !== null && typeof k === 'object' && !Array.isArray(k))) {
        throw new Error('JWKS has no keys array');
      }
      entry.jwks = { keys: body.keys } as JSONWebKeySet;
      entry.goodAt = now();
      entry.lastFailed = false;
      return true;
    } catch {
      entry.lastFailed = true;
      return false;
    }
  }

  const canAttempt = (entry: CacheEntry) => now() - entry.attemptAt >= JWKS_ATTEMPT_MIN_MS;

  async function check(token: string, jwks: JSONWebKeySet): Promise<CompactVerifyResult> {
    return compactVerify(token, createLocalJWKSet(jwks), { algorithms: ['RS256'] });
  }

  const classify = (err: unknown): KeyFailure => {
    if (err instanceof errors.JWSSignatureVerificationFailed) return 'bad_signature';
    if (err instanceof errors.JWKSInvalid || err instanceof errors.JWKInvalid || err instanceof errors.JOSENotSupported) return 'jwks_invalid';
    return 'bad_signature';
  };

  /** Verify a compact JWS (RS256 only). Throws PlatformKeyError with a safe reason. */
  async function verify(token: string, jwksUrl: string, traceId: string): Promise<CompactVerifyResult> {
    let entry = cache.get(jwksUrl);
    if (!entry) {
      entry = { jwks: null, goodAt: null, attemptAt: Number.NEGATIVE_INFINITY, lastFailed: false };
      cache.set(jwksUrl, entry);
    }
    if (entry.goodAt !== null && now() - entry.goodAt > JWKS_MAX_AGE_MS) {
      entry.jwks = null; // 24 h without a good fetch: drop the cache
      entry.goodAt = null;
    }
    const due = entry.goodAt === null || now() - entry.goodAt > JWKS_REFRESH_MS;
    if (due && canAttempt(entry)) await attempt(jwksUrl, entry, traceId);
    if (!entry.jwks) throw new PlatformKeyError('jwks_unavailable');

    try {
      return await check(token, entry.jwks);
    } catch (err) {
      if (!(err instanceof errors.JWKSNoMatchingKey)) throw new PlatformKeyError(classify(err));
    }
    // Unknown kid: one refetch, at most one attempt per minute.
    if (canAttempt(entry)) {
      if (!(await attempt(jwksUrl, entry, traceId))) throw new PlatformKeyError('jwks_fetch_failed');
      try {
        return await check(token, entry.jwks!);
      } catch (err) {
        throw new PlatformKeyError(err instanceof errors.JWKSNoMatchingKey ? 'kid_unknown' : classify(err));
      }
    }
    throw new PlatformKeyError(entry.lastFailed ? 'jwks_fetch_failed' : 'kid_unknown');
  }

  return { verify };
}

export type PlatformKeys = ReturnType<typeof createPlatformKeys>;
