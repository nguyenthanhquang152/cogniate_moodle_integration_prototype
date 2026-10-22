import type { ApiErrorCode } from '../api-errors.ts';
import { ApiError } from '../api-errors.ts';
import type { Db } from '../db/index.ts';
import type { ToolAccount } from '../store/accounts.ts';
import { findAccountByApiKey } from '../store/accounts.ts';
import type { AuditActor } from '../store/audit.ts';
import type { LaunchRecord } from '../store/launches.ts';
import { findLaunchByLtik } from '../store/launches.ts';
import type { ServiceKeyRecord } from '../store/service-keys.ts';
import { findServiceKey } from '../store/service-keys.ts';

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
  /** B1: one API key per account, named bootstrap-<account>. LA-E5-07 supplies the key id here. */
  actor: AuditActor;
  /** LTIK-AUTH-V2: the launch of the ltik. */
  launch: LaunchRecord | null;
  /** SERVICE-AUTH-V1 (T3a): the service key record. */
  serviceKey: ServiceKeyRecord | null;
}

/**
 * Resolve the header for an endpoint that accepts `accepted` schemes. Throws ApiError 401 with the contract code.
 * onFail logs api_auth_failed {scheme, code}.
 */
export function authenticate(db: Db, header: string | undefined, accepted: Scheme[], now: number, onFail: (scheme: string, code: string) => void): AuthResult {
  const reject = (scheme: string, code: Extract<ApiErrorCode, `INVALID_${string}AUTHORIZATION_HEADER`>, description?: string): never => {
    onFail(scheme, code);
    throw new ApiError(code, description);
  };
  const parsed = parseAuthorization(header);
  if ('error' in parsed) {
    // A known scheme that this endpoint does not accept is INVALID_AUTHORIZATION_HEADER, also when it is malformed.
    if (parsed.scheme === 'ltik' || parsed.scheme === 'service') {
      if (!accepted.includes(parsed.scheme)) return reject(parsed.scheme, 'INVALID_AUTHORIZATION_HEADER');
    }
    return reject(parsed.scheme, parsed.error);
  }
  if (!accepted.includes(parsed.scheme)) return reject(parsed.scheme, 'INVALID_AUTHORIZATION_HEADER');
  const account = findAccountByApiKey(db, parsed.apiKey);
  if (!account) {
    // ADR-003: a bad API key on Bearer endpoints uses the LTIK error code.
    return reject(parsed.scheme, parsed.scheme === 'service' ? 'INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER' : 'INVALID_LTIK_AUTH_AUTHORIZATION_HEADER',
      parsed.scheme === 'bearer' ? 'Invalid API key.' : undefined);
  }
  const actor: AuditActor = { type: 'api_key', id: `bootstrap-${account.id}` };
  if (parsed.scheme === 'bearer') {
    return { scheme: 'bearer', account, actor, launch: null, serviceKey: null };
  }
  if (parsed.scheme === 'service') {
    // T3a: the service key must belong to the account of the API key and must not be revoked (security §8).
    const serviceKey = findServiceKey(db, account.id, parsed.credential ?? '');
    return serviceKey ? { scheme: 'service', account, actor, launch: null, serviceKey } : reject('service', 'INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER');
  }
  const launch = findLaunchByLtik(db, account.id, parsed.credential ?? '', now);
  return launch ? { scheme: 'ltik', account, actor, launch, serviceKey: null } : reject('ltik', 'INVALID_LTIK_AUTH_AUTHORIZATION_HEADER');
}
