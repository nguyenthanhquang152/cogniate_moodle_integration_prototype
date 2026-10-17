/**
 * The launch checks of security §2.2, one small function each (T2a design note). Run order (launch.ts):
 * 1 + 3 (one atomic statement), then 2, then 4 to 12. Each failure is a LaunchCheckError {check, code, detail}; the
 * caller logs launch_check_failed {check, code, detail} and shows the error page. `detail` is a fixed, safe reason
 * (contract §5, B-T2a-03): never a token, a claim value or a key.
 */
import type { PublicUrls } from '@cogniate/shared';
import { readCookie, safeEqual } from '@cogniate/shared';
import type { ProtectedHeaderParameters } from 'jose';
import { decodeProtectedHeader } from 'jose';
import type { Db } from '../db/index.ts';
import type { Platform } from '../store/platforms.ts';
import type { StateRecord } from '../store/states.ts';
import { consumeState } from '../store/states.ts';
import type { ProtocolErrorCode } from './codes.ts';
import type { PlatformKeys } from './jwks.ts';
import { PlatformKeyError } from './jwks.ts';
import { isOwnLaunchTarget } from './target.ts';

export const CLAIM = {
  messageType: 'https://purl.imsglobal.org/spec/lti/claim/message_type',
  version: 'https://purl.imsglobal.org/spec/lti/claim/version',
  deploymentId: 'https://purl.imsglobal.org/spec/lti/claim/deployment_id',
  targetLinkUri: 'https://purl.imsglobal.org/spec/lti/claim/target_link_uri',
  roles: 'https://purl.imsglobal.org/spec/lti/claim/roles',
  resourceLink: 'https://purl.imsglobal.org/spec/lti/claim/resource_link',
  context: 'https://purl.imsglobal.org/spec/lti/claim/context',
  toolPlatform: 'https://purl.imsglobal.org/spec/lti/claim/tool_platform',
  launchPresentation: 'https://purl.imsglobal.org/spec/lti/claim/launch_presentation',
  custom: 'https://purl.imsglobal.org/spec/lti/claim/custom',
  deepLinkingSettings: 'https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings',
  ags: 'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint',
  nrps: 'https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice',
} as const;

export const MESSAGE_TYPES = ['LtiResourceLinkRequest', 'LtiDeepLinkingRequest'] as const;
export const CLOCK_SKEW_S = 60; // security §2.2 "Clock rule"

export type Claims = Record<string, unknown>;

export class LaunchCheckError extends Error {
  readonly check: string;
  readonly code: ProtocolErrorCode;
  /** Safe reason for the log, for example `skew_s=73`, `kid_unknown`, `missing=resource_link`. */
  readonly detail: string;
  constructor(check: string, code: ProtocolErrorCode, detail: string) {
    super(detail);
    this.name = 'LaunchCheckError';
    this.check = check;
    this.code = code;
    this.detail = detail;
  }
}

/** A value from the token, reduced to a short safe word for the log (else "other"). */
export const safeWord = (v: unknown): string => (typeof v === 'string' && /^[A-Za-z0-9_.-]{1,40}$/.test(v) ? v : 'other');

const fail = (check: string, code: ProtocolErrorCode, detail: string): never => {
  throw new LaunchCheckError(check, code, detail);
};

/** Cookie name: __Host-lti_state_{first 8 chars of the state hash} (security §3). */
export function stateCookieName(stateHash: string): string {
  return `__Host-lti_state_${stateHash.slice(0, 8)}`;
}

/** Re-exported for the tests and callers of this module (the helper lives in @cogniate/shared). */
export { readCookie };

/** Checks 1 and 3: the state exists for this account, is unused and not expired; it is marked used at once. */
export function check1And3State(db: Db, accountId: string, state: unknown, stateHash: string | null, now: number): StateRecord {
  if (typeof state !== 'string' || state === '' || stateHash === null) return fail('1', 'INVALID_STATE', 'state_missing');
  const rec = consumeState(db, accountId, stateHash, now);
  return rec ?? fail('1', 'INVALID_STATE', 'state_unknown_used_or_expired');
}

/** Check 2: the state cookie exists and equals the state (constant-time compare). */
export function check2Cookie(cookieHeader: string | undefined, state: string, stateHash: string): void {
  const value = readCookie(cookieHeader, stateCookieName(stateHash));
  if (value === undefined || value === '') fail('2', 'STATE_COOKIE_MISSING', 'cookie_missing');
  if (!safeEqual(value!, state)) fail('2', 'INVALID_STATE', 'cookie_mismatch');
}

/**
 * Check 4: a compact JWS with header alg = RS256 and a kid, and a JSON object payload. The header is read first,
 * so `alg=none` (empty signature) and `alg=HS256` are logged as such.
 */
export function check4Token(idToken: unknown): { header: ProtectedHeaderParameters; claims: Claims } {
  if (idToken === undefined || idToken === '') return fail('4', 'INVALID_ID_TOKEN', 'id_token_missing');
  const parts = typeof idToken === 'string' ? idToken.split('.') : [];
  if (parts.length !== 3 || !parts.every((p) => /^[A-Za-z0-9_-]*$/.test(p)) || parts[0] === '') {
    return fail('4', 'INVALID_ID_TOKEN', 'not_compact_jws');
  }
  let header: ProtectedHeaderParameters;
  try {
    header = decodeProtectedHeader(idToken as string);
  } catch {
    return fail('4', 'INVALID_ID_TOKEN', 'header_not_json');
  }
  if (header.alg !== 'RS256') fail('4', 'INVALID_ID_TOKEN', `alg=${safeWord(header.alg)}`);
  if (typeof header.kid !== 'string' || header.kid === '') fail('4', 'INVALID_ID_TOKEN', 'kid_missing');
  if (parts[1] === '' || parts[2] === '') fail('4', 'INVALID_ID_TOKEN', 'not_compact_jws');
  let claims: unknown;
  try {
    claims = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8'));
  } catch {
    return fail('4', 'INVALID_ID_TOKEN', 'payload_not_json');
  }
  if (claims === null || typeof claims !== 'object' || Array.isArray(claims)) fail('4', 'INVALID_ID_TOKEN', 'payload_not_object');
  return { header, claims: claims as Claims };
}

/**
 * Check 5: iss = the platform issuer; aud contains its client_id; with more than one aud, azp is required; an azp
 * that is present must equal client_id (Security Framework §5.1.3, A-T2a-03).
 */
export function check5IssuerAudience(claims: Claims, platform: Platform): void {
  if (claims.iss !== platform.issuer) fail('5', 'INVALID_ISSUER_OR_AUDIENCE', 'iss_mismatch');
  const aud = claims.aud;
  const list = typeof aud === 'string' ? [aud] : Array.isArray(aud) && aud.every((a) => typeof a === 'string') ? (aud as string[]) : null;
  if (!list || !list.includes(platform.clientId)) fail('5', 'INVALID_ISSUER_OR_AUDIENCE', 'aud_mismatch');
  if (list!.length > 1 && claims.azp === undefined) fail('5', 'INVALID_ISSUER_OR_AUDIENCE', 'azp_missing');
  if (claims.azp !== undefined && claims.azp !== platform.clientId) fail('5', 'INVALID_ISSUER_OR_AUDIENCE', 'azp_mismatch');
}

/** Check 6: the signature is valid with a key of the platform JWKS (refresh, fallback and refetch rules in jwks.ts). */
export async function check6Signature(keys: PlatformKeys, idToken: string, platform: Platform, traceId: string): Promise<void> {
  try {
    await keys.verify(idToken, platform.jwksUrl, traceId);
  } catch (err) {
    fail('6', 'INVALID_SIGNATURE', err instanceof PlatformKeyError ? err.detail : 'bad_signature');
  }
}

/** Check 7: exp > now - 60 s and iat < now + 60 s. */
export function check7Time(claims: Claims, nowMs: number): void {
  const now = nowMs / 1000;
  if (typeof claims.exp !== 'number' || typeof claims.iat !== 'number') fail('7', 'TOKEN_EXPIRED', 'exp_iat_missing');
  // skew_s = seconds since exp (the 60 s clock rule is already included in the test).
  if ((claims.exp as number) <= now - CLOCK_SKEW_S) fail('7', 'TOKEN_EXPIRED', `skew_s=${Math.round(now - (claims.exp as number))}`);
  if ((claims.iat as number) >= now + CLOCK_SKEW_S) fail('7', 'TOKEN_EXPIRED', `iat_future_s=${Math.round((claims.iat as number) - now)}`);
}

/** Check 8: nonce = the nonce of the state record. */
export function check8Nonce(claims: Claims, state: StateRecord): void {
  if (typeof claims.nonce !== 'string' || claims.nonce === '') fail('8', 'INVALID_NONCE', 'nonce_missing');
  if (!safeEqual(claims.nonce as string, state.nonce)) fail('8', 'INVALID_NONCE', 'nonce_mismatch');
}

/** Check 9: deployment_id is a known deployment of the platform. */
export function check9Deployment(claims: Claims, platform: Platform): string {
  const d = claims[CLAIM.deploymentId];
  if (typeof d !== 'string' || d === '') fail('9', 'UNKNOWN_DEPLOYMENT', 'deployment_missing');
  if (!platform.deploymentIds.includes(d as string)) fail('9', 'UNKNOWN_DEPLOYMENT', 'deployment_unknown');
  return d as string;
}

/** Check 10: version = 1.3.0 and a supported message type. */
export function check10Message(claims: Claims): (typeof MESSAGE_TYPES)[number] {
  if (claims[CLAIM.version] !== '1.3.0') fail('10', 'UNSUPPORTED_MESSAGE_TYPE', `version=${safeWord(claims[CLAIM.version])}`);
  const type = claims[CLAIM.messageType];
  if (!MESSAGE_TYPES.includes(type as (typeof MESSAGE_TYPES)[number])) fail('10', 'UNSUPPORTED_MESSAGE_TYPE', `message_type=${safeWord(type)}`);
  return type as (typeof MESSAGE_TYPES)[number];
}

const nonEmptyString = (v: unknown): v is string => typeof v === 'string' && v !== '';

/** Check 11: sub, roles, target_link_uri; resource_link.id (resource link) or deep_link_return_url (deep linking). */
export function check11Claims(claims: Claims, messageType: (typeof MESSAGE_TYPES)[number]): void {
  if (!nonEmptyString(claims.sub)) fail('11', 'MISSING_CLAIM', 'missing=sub');
  const roles = claims[CLAIM.roles];
  if (!Array.isArray(roles) || !roles.every((r) => typeof r === 'string')) fail('11', 'MISSING_CLAIM', 'missing=roles');
  if (!nonEmptyString(claims[CLAIM.targetLinkUri])) fail('11', 'MISSING_CLAIM', 'missing=target_link_uri');
  if (messageType === 'LtiResourceLinkRequest') {
    const rl = claims[CLAIM.resourceLink] as { id?: unknown } | undefined;
    if (!rl || typeof rl !== 'object' || !nonEmptyString(rl.id)) fail('11', 'MISSING_CLAIM', 'missing=resource_link');
  } else {
    const dl = claims[CLAIM.deepLinkingSettings] as { deep_link_return_url?: unknown } | undefined;
    if (!dl || typeof dl !== 'object' || !nonEmptyString(dl.deep_link_return_url)) fail('11', 'MISSING_CLAIM', 'missing=deep_link_return_url');
  }
}

/** Check 12: target_link_uri = the value in the state record, and it is our launch URL for this account. */
export function check12Target(claims: Claims, state: StateRecord, urls: PublicUrls, accountId: string): void {
  const target = claims[CLAIM.targetLinkUri];
  if (target !== state.targetLinkUri) fail('12', 'INVALID_TARGET_LINK_URI', 'target_differs_from_login');
  if (!isOwnLaunchTarget(target, urls, accountId)) fail('12', 'INVALID_TARGET_LINK_URI', 'target_not_own');
}
