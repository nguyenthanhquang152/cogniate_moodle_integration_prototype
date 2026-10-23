// Platform access tokens (contract §4, security §2.3): OAuth 2 client credentials with a signed client assertion.
// Cached IN MEMORY per (platform, scope set) until 60 s before expiry (ADR-006: a restart only loses the cache).
// Each use logs platform_token {platform_id, cache: "hit" | "miss"}; a miss is one outbound request.
import { randomToken } from '@cogniate/shared';
import type { Logger, OutboundClient } from '@cogniate/shared';
import type { Db } from '../db/index.ts';
import { CLAIM } from '../lti/checks.ts';
import { signToolJwt } from '../lti/tool-jwt.ts';
import type { ProfileOptions } from '../profiles/index.ts';
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
  /** The profile registry for the E2 traits of a stored platform; product code uses the discovered registry. */
  profiles?: ProfileOptions;
}

export interface TokenRequestOptions {
  /** The deployment of the launch or service key: the `deployment_id` claim when the profile asks for it (R1 C-18). */
  deploymentId?: string;
}

export interface TokenClient {
  getToken(platform: Platform, scopes: string[], traceId: string, options?: TokenRequestOptions): Promise<string>;
}

const TOKEN_URL_STRING = { value: '{tokenEndpoint}', form: 'string' } as const;

export function createTokenClient(deps: TokenClientDeps): TokenClient {
  const now = deps.now ?? Date.now;
  const onTokenResult = deps.onTokenResult ?? (() => {});
  const cache = new Map<string, { token: string; expiresAt: number }>();
  const inFlight = new Map<string, Promise<string>>();

  function observe(platformId: string, ok: boolean): void {
    try { onTokenResult({ platformId, ok }); } catch { /* An observer must not change the token result. */ }
  }

  const profileOf = (platform: Platform) => profileDefinition(platform.profile, deps.profiles);

  /**
   * LA-ADR-02 D2 trait clientAssertionAud: the token URL, or the stored platform value ({platformValue}; default the
   * token URL), as a string or as a one-item array (Blackboard, F-BB-5).
   */
  function audienceOf(platform: Platform): string | string[] {
    const rule = profileOf(platform)?.clientAssertionAud ?? TOKEN_URL_STRING;
    const value = rule.value === '{platformValue}' ? platform.clientAssertionAud ?? platform.tokenEndpoint : platform.tokenEndpoint;
    return rule.form === 'array' ? [value] : value;
  }

  async function fetchToken(platform: Platform, scopes: string[], key: string, traceId: string, deploymentId: string | undefined, aud: string | string[]): Promise<string> {
    const claims = { iss: platform.clientId, sub: platform.clientId, aud, jti: randomToken(), ...(deploymentId !== undefined ? { [CLAIM.deploymentId]: deploymentId } : {}) };
    const assertion = await signToolJwt(deps.db, deps.masterKey, platform.toolAccountId, claims, now());
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
    async getToken(platform, scopes, traceId, options = {}) {
      // AC-LA-E2-01-07: a platform with granted scopes (Dynamic Registration) is asked only for those scopes.
      const granted = platform.grantedScopes;
      const sorted = [...new Set(scopes)].filter((scope) => granted === null || granted.includes(scope)).sort();
      if (sorted.length === 0) throw new ApiError('SERVICE_NOT_AVAILABLE', 'The platform did not grant the scope for this call.');
      // The trait assertionDeploymentId (default off) adds the deployment claim, so the token is per deployment.
      const deploymentId = profileOf(platform)?.assertionDeploymentId && options.deploymentId ? options.deploymentId : undefined;
      // A-LA-E2-02-03: a token belongs to the exact credential set that asked for it. A registration update that changes
      // the token URL, the client id or the audience gets a new entry; a request in flight for the old set fills only
      // the old entry, so it never serves the new set.
      const aud = audienceOf(platform);
      const key = JSON.stringify([platform.id, platform.tokenEndpoint, platform.clientId, aud, sorted, ...(deploymentId === undefined ? [] : [deploymentId])]);
      const hit = cache.get(key);
      if (hit && hit.expiresAt - TOKEN_EARLY_EXPIRY_MS > now()) {
        deps.logger.info('platform_token', { trace_id: traceId, platform_id: platform.id, cache: 'hit' });
        return hit.token;
      }
      // One request per key at a time: parallel callers share it.
      let pending = inFlight.get(key);
      if (!pending) {
        pending = fetchToken(platform, sorted, key, traceId, deploymentId, aud).then(
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
