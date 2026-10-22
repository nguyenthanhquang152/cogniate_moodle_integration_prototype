// Platform access tokens (contract §4, security §2.3): OAuth 2 client credentials with a signed client assertion.
// Cached IN MEMORY per (platform, scope set) until 60 s before expiry (ADR-006: a restart only loses the cache).
// Each use logs platform_token {platform_id, cache: "hit" | "miss"}; a miss is one outbound request.
import { randomToken } from '@cogniate/shared';
import type { Logger, OutboundClient } from '@cogniate/shared';
import type { Db } from '../db/index.ts';
import { signToolJwt } from '../lti/tool-jwt.ts';
import { profileDefinition } from '../profiles/index.ts';
import type { Platform } from '../store/platforms.ts';
import { ApiError } from '../api-errors.ts';
import { badPlatformDataError, outboundFailureError, platformRateLimitError } from './error-mapping.ts';

export const TOKEN_EARLY_EXPIRY_MS = 60_000;
/** A token is cached at most 1 h, whatever expires_in the platform sends. */
export const TOKEN_MAX_CACHE_S = 3600;
const ASSERTION_TYPE = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';

/** One result per token request, including failures; cache hits do not emit a result. */
export type TokenResultObserver = (result: { platformId: string; ok: boolean }) => void;

export interface TokenClientDeps {
  db: Db;
  masterKey: Buffer;
  outbound: OutboundClient;
  logger: Logger;
  now?: () => number;
  onTokenResult?: TokenResultObserver;
}

export interface TokenClient {
  getToken(platform: Platform, scopes: string[], traceId: string): Promise<string>;
}

export function createTokenClient(deps: TokenClientDeps): TokenClient {
  const now = deps.now ?? Date.now;
  const onTokenResult = deps.onTokenResult ?? (() => {});
  const cache = new Map<string, { token: string; expiresAt: number }>();
  const inFlight = new Map<string, Promise<string>>();

  function observe(platformId: string, ok: boolean): void {
    try { onTokenResult({ platformId, ok }); } catch { /* An observer must not change the token result. */ }
  }

  async function fetchToken(platform: Platform, scopes: string[], key: string, traceId: string): Promise<string> {
    // Profiles with clientAssertionAudArray (Blackboard, F-BB-5): aud = [token endpoint].
    const aud = profileDefinition(platform.profile)?.flags.clientAssertionAudArray ? [platform.tokenEndpoint] : platform.tokenEndpoint;
    const assertion = await signToolJwt(deps.db, deps.masterKey, platform.toolAccountId,
      { iss: platform.clientId, sub: platform.clientId, aud, jti: randomToken() }, now());
    const body = new URLSearchParams({ grant_type: 'client_credentials', client_assertion_type: ASSERTION_TYPE, client_assertion: assertion, scope: scopes.join(' ') }).toString();
    let res;
    try {
      res = await deps.outbound.request(platform.tokenEndpoint, {
        method: 'POST', body, traceId, headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      });
    } catch (err) {
      throw outboundFailureError(err);
    }
    const throttled = platformRateLimitError(res, { logger: deps.logger, platformId: platform.id, traceId }, now());
    if (throttled) throw throttled;
    // Other token failures cannot be fixed by changing the app request: keep PLATFORM_ERROR.
    if (res.status !== 200) throw new ApiError('PLATFORM_ERROR', `The platform token endpoint answered ${res.status}.`);
    let data: { access_token?: unknown; expires_in?: unknown };
    try {
      data = res.json() as typeof data;
    } catch {
      throw badPlatformDataError('token response is not JSON');
    }
    if (typeof data.access_token !== 'string' || data.access_token === '') throw badPlatformDataError('no access_token');
    const lifeS = Math.min(typeof data.expires_in === 'number' && data.expires_in > 0 ? data.expires_in : 3600, TOKEN_MAX_CACHE_S);
    cache.set(key, { token: data.access_token, expiresAt: now() + lifeS * 1000 });
    deps.logger.info('platform_token', { trace_id: traceId, platform_id: platform.id, cache: 'miss' });
    return data.access_token;
  }

  return {
    async getToken(platform, scopes, traceId) {
      const sorted = [...new Set(scopes)].sort();
      const key = JSON.stringify([platform.id, sorted]);
      const hit = cache.get(key);
      if (hit && hit.expiresAt - TOKEN_EARLY_EXPIRY_MS > now()) {
        deps.logger.info('platform_token', { trace_id: traceId, platform_id: platform.id, cache: 'hit' });
        return hit.token;
      }
      // One request per key at a time: parallel callers share it.
      let pending = inFlight.get(key);
      if (!pending) {
        pending = fetchToken(platform, sorted, key, traceId).then(
          (token) => { observe(platform.id, true); return token; },
          (error: unknown) => { observe(platform.id, false); throw error; },
        ).finally(() => inFlight.delete(key));
        inFlight.set(key, pending);
      } else {
        deps.logger.info('platform_token', { trace_id: traceId, platform_id: platform.id, cache: 'hit' });
      }
      return pending;
    },
  };
}
