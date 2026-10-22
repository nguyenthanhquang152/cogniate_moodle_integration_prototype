import { sha256Hex } from '@cogniate/shared';
import type { ApiErrorCode } from '../api-errors.ts';
import { ApiError } from '../api-errors.ts';
import type { Db } from '../db/index.ts';
import type { ToolAccount } from '../store/accounts.ts';
import { getAccount } from '../store/accounts.ts';
import { useApiKey } from '../store/api-keys.ts';
import type { AuditActor } from '../store/audit.ts';
import type { LaunchRecord } from '../store/launches.ts';
import { findLaunchByLtik } from '../store/launches.ts';
import type { ServiceKeyRecord } from '../store/service-keys.ts';
import { findServiceKey } from '../store/service-keys.ts';
import { agsBaseUrl, isAllowedServiceUrl } from '../lti/service-url.ts';
import type { AgsClient, AgsContext } from '../platform/ags.ts';

export type Scheme = 'ltik' | 'service' | 'bearer';

export type ParsedAuth =
  | { scheme: Scheme; apiKey: string; credential: string | null }
  | { error: 'INVALID_AUTHORIZATION_HEADER' | 'INVALID_LTIK_AUTH_AUTHORIZATION_HEADER' | 'INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER'; scheme: Scheme | 'none' | 'unknown' };

const SCHEMES: Record<string, Scheme> = { 'ltik-auth-v2': 'ltik', 'service-auth-v1': 'service', bearer: 'bearer' };

/**
 * Authorization header grammar (contract §1.2). Scheme names are case-insensitive; the credential is split at the
 * FIRST ":" into API key and ltik / service key.
 */
export function parseAuthorization(header: string | undefined): ParsedAuth {
  if (!header || header.trim() === '') return { error: 'INVALID_AUTHORIZATION_HEADER', scheme: 'none' };
  const m = /^\s*(\S+)\s+(\S.*?)\s*$/.exec(header);
  const scheme = m ? SCHEMES[m[1]!.toLowerCase()] : undefined;
  if (!m || !scheme) return { error: 'INVALID_AUTHORIZATION_HEADER', scheme: 'unknown' };
  const value = m[2]!;
  if (scheme === 'bearer') return { scheme, apiKey: value, credential: null };
  const i = value.indexOf(':');
  if (i < 0) {
    return { error: scheme === 'ltik' ? 'INVALID_LTIK_AUTH_AUTHORIZATION_HEADER' : 'INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER', scheme };
  }
  return { scheme, apiKey: value.slice(0, i), credential: value.slice(i + 1) };
}

export interface AuthResult {
  scheme: Scheme;
  account: ToolAccount;
  /** The actual API key id, including for migrated bootstrap keys. */
  actor: AuditActor;
  /** LTIK-AUTH-V2: the launch of the ltik. */
  launch: LaunchRecord | null;
  /** SERVICE-AUTH-V1 (T3a): the service key record. */
  serviceKey: ServiceKeyRecord | null;
  /** Internal cache identity. The service credential itself is never kept in the write-scope cache. */
  serviceKeyHash?: string;
}

/**
 * Resolve the header for an endpoint that accepts `accepted` schemes. Invalid credentials give 401; status and scope refusals give 403.
 * onFail identifies whether the 401 happened before API key validation or in the later credential check (BD-A2-17).
 */
export function authenticate(
  db: Db, header: string | undefined, accepted: Scheme[], now: number,
  onFail: (scheme: string, code: string, part: 'api_key' | 'credential') => void,
): AuthResult {
  const reject = (
    scheme: string, code: Extract<ApiErrorCode, `INVALID_${string}AUTHORIZATION_HEADER`>, part: 'api_key' | 'credential', description?: string,
  ): never => {
    onFail(scheme, code, part);
    throw new ApiError(code, description);
  };
  const parsed = parseAuthorization(header);
  if ('error' in parsed) {
    // A known scheme that this endpoint does not accept is INVALID_AUTHORIZATION_HEADER, also when it is malformed.
    if (parsed.scheme === 'ltik' || parsed.scheme === 'service') {
      if (!accepted.includes(parsed.scheme)) return reject(parsed.scheme, 'INVALID_AUTHORIZATION_HEADER', 'api_key');
    }
    return reject(parsed.scheme, parsed.error, 'api_key');
  }
  if (!accepted.includes(parsed.scheme)) return reject(parsed.scheme, 'INVALID_AUTHORIZATION_HEADER', 'api_key');
  const key = useApiKey(db, parsed.apiKey, now);
  const account = key ? getAccount(db, key.toolAccountId) : null;
  if (!key || !account || account.status === 'closed') {
    // ADR-003: a bad API key on Bearer endpoints uses the LTIK error code.
    return reject(parsed.scheme, parsed.scheme === 'service' ? 'INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER' : 'INVALID_LTIK_AUTH_AUTHORIZATION_HEADER',
      'api_key', parsed.scheme === 'bearer' ? 'Invalid API key.' : undefined);
  }
  const actor: AuditActor = { type: 'api_key', id: key.id };
  const statusGate = (result: AuthResult): AuthResult => {
    if (account.status === 'suspended') throw new ApiError('TOOL_ACCOUNT_SUSPENDED');
    const needed = parsed.scheme === 'bearer' ? 'admin' : 'launch';
    if (!key.scopes.includes(needed)) throw new ApiError('API_KEY_SCOPE_MISSING', `The API key needs the ${needed} scope.`);
    return result;
  };
  if (parsed.scheme === 'bearer') {
    return statusGate({ scheme: 'bearer', account, actor, launch: null, serviceKey: null });
  }
  if (parsed.scheme === 'service') {
    // T3a: the service key must belong to the account of the API key and must not be revoked (security §8).
    const serviceKey = findServiceKey(db, account.id, parsed.credential ?? '');
    return serviceKey ? statusGate({ scheme: 'service', account, actor, launch: null, serviceKey, serviceKeyHash: sha256Hex(parsed.credential!) })
      : reject('service', 'INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER', 'credential');
  }
  const launch = findLaunchByLtik(db, account.id, parsed.credential ?? '', now);
  return launch ? statusGate({ scheme: 'ltik', account, actor, launch, serviceKey: null }) : reject('ltik', 'INVALID_LTIK_AUTH_AUTHORIZATION_HEADER', 'credential');
}

const WRITE_SCOPE_TTL_MS = 10 * 60_000;
const WRITE_SCOPE_CACHE_LIMIT = 10_000;
interface ScopeLookup { expiresAt: number; allowed: Promise<boolean> }
// One cache per AGS client (and thus per application), never across tenants' service instances.
const writeScopeCaches = new WeakMap<Pick<AgsClient, 'getLineItem'>, Map<string, ScopeLookup>>();

/** LA-ADR-06 D8: called after platform/deployment checks, for score POST and line item PUT/DELETE only. */
export async function checkServiceKeyWriteScope(
  ctx: { ags: Pick<AgsClient, 'getLineItem'>; now: () => number }, caller: AuthResult, ags: AgsContext, lineItemId: string,
): Promise<void> {
  if (caller.scheme !== 'service' || caller.account.serviceKeyWriteScope !== 'resource-link') return;
  const key = caller.serviceKey;
  if (!key) throw new ApiError('INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER');
  // Apply the existing URL guard even on cache hits; a later launch may narrow the AGS claim.
  const base = agsBaseUrl(ags.agsClaim);
  if (!base) throw new ApiError('SERVICE_NOT_AVAILABLE', 'The launch has no AGS claim.');
  if (!isAllowedServiceUrl(lineItemId, base)) throw new ApiError('INVALID_LINE_ITEM_ID');
  if (lineItemId === key.agsClaim?.lineitem) return;

  let cache = writeScopeCaches.get(ctx.ags);
  if (!cache) { cache = new Map(); writeScopeCaches.set(ctx.ags, cache); }
  const cacheId = caller.serviceKeyHash ? JSON.stringify([caller.serviceKeyHash, lineItemId]) : undefined;
  const now = ctx.now();
  let lookup = cacheId === undefined ? undefined : cache.get(cacheId);
  if (lookup && lookup.expiresAt <= now) { cache.delete(cacheId!); lookup = undefined; }
  if (lookup && cacheId !== undefined) { cache.delete(cacheId); cache.set(cacheId, lookup); }
  if (!lookup) {
    lookup = { expiresAt: now + WRITE_SCOPE_TTL_MS,
      allowed: ctx.ags.getLineItem(ags, lineItemId).then((item) => item.resourceLinkId === key.resourceLinkId) };
    if (cacheId !== undefined) {
      if (cache.size >= WRITE_SCOPE_CACHE_LIMIT) cache.delete(cache.keys().next().value!);
      cache.set(cacheId, lookup);
    }
  }
  let allowed: boolean;
  try {
    allowed = await lookup.allowed;
  } catch (err) {
    // Failed GETs do not establish scope. Keep the existing guarded client's error and permit a later retry.
    if (cacheId !== undefined && cache.get(cacheId) === lookup) cache.delete(cacheId);
    throw err;
  }
  if (!allowed) throw new ApiError('SERVICE_KEY_SCOPE');
}
