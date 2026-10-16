import type { OutboundClient } from '@cogniate/shared';
import type { CompactVerifyResult, JSONWebKeySet } from 'jose';
import { compactVerify, createLocalJWKSet, errors } from 'jose';

const CACHE_MS = 10 * 60 * 1000;
const REFETCH_MIN_MS = 60 * 1000;

/**
 * Platform JWKS (security §2.4, contract §4): fetched with the guarded outbound client, never with the jose
 * remote fetcher; kept 10 min; an unknown kid triggers one refetch, at most once per minute per JWKS URL.
 */
export function createPlatformKeys(outbound: OutboundClient, now: () => number = Date.now) {
  const cache = new Map<string, { jwks: JSONWebKeySet; fetchedAt: number }>();

  async function fetchJwks(url: string, traceId: string): Promise<{ jwks: JSONWebKeySet; fetchedAt: number }> {
    const res = await outbound.request(url, { traceId, headers: { accept: 'application/json' } });
    if (res.status !== 200) throw new Error(`JWKS answered ${res.status}`);
    const body = res.json() as { keys?: unknown };
    if (!body || !Array.isArray(body.keys)) throw new Error('JWKS has no keys array');
    const entry = { jwks: { keys: body.keys } as JSONWebKeySet, fetchedAt: now() };
    cache.set(url, entry);
    return entry;
  }

  /** Verify a compact JWS (RS256 only). Throws on any failure; the caller maps it to INVALID_SIGNATURE. */
  async function verify(token: string, jwksUrl: string, traceId: string): Promise<CompactVerifyResult> {
    let entry = cache.get(jwksUrl);
    if (!entry || now() - entry.fetchedAt > CACHE_MS) entry = await fetchJwks(jwksUrl, traceId);
    try {
      return await compactVerify(token, createLocalJWKSet(entry.jwks), { algorithms: ['RS256'] });
    } catch (err) {
      if (err instanceof errors.JWKSNoMatchingKey && now() - entry.fetchedAt >= REFETCH_MIN_MS) {
        entry = await fetchJwks(jwksUrl, traceId);
        return compactVerify(token, createLocalJWKSet(entry.jwks), { algorithms: ['RS256'] });
      }
      throw err;
    }
  }

  return { verify };
}

export type PlatformKeys = ReturnType<typeof createPlatformKeys>;
