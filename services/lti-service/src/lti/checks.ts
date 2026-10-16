/**
 * The launch checks of security §2.2, one small function each (T2a design note). Run order (launch.ts):
 * 1 + 3 (one atomic statement), then 2, then 4 to 12. Each failure is a LaunchCheckError {check, code}; the caller
 * logs launch_check_failed {check, code} and shows the error page.
 */
import type { PublicUrls } from '@cogniate/shared';
import type { ProtectedHeaderParameters } from 'jose';
import { decodeProtectedHeader } from 'jose';
import { safeEqual } from '../crypto.ts';
import type { Db } from '../db/index.ts';
import type { Platform } from '../store/platforms.ts';
import type { StateRecord } from '../store/states.ts';
import { consumeState } from '../store/states.ts';
import type { ProtocolErrorCode } from './codes.ts';
import type { PlatformKeys } from './jwks.ts';
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
  constructor(check: string, code: ProtocolErrorCode, detail: string) {
    super(detail);
    this.name = 'LaunchCheckError';
    this.check = check;
    this.code = code;
  }
}

const fail = (check: string, code: ProtocolErrorCode, detail: string): never => {
  throw new LaunchCheckError(check, code, detail);
};

/** Cookie name: __Host-lti_state_{first 8 chars of the state hash} (security §3). */
export function stateCookieName(stateHash: string): string {
  return `__Host-lti_state_${stateHash.slice(0, 8)}`;
}

export function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return undefined;
}

/** Checks 1 and 3: the state exists for this account, is unused and not expired; it is marked used at once. */
export function check1And3State(db: Db, accountId: string, state: unknown, stateHash: string | null, now: number): StateRecord {
  if (typeof state !== 'string' || state === '' || stateHash === null) return fail('1', 'INVALID_STATE', 'no state');
  const rec = consumeState(db, accountId, stateHash, now);
  return rec ?? fail('1', 'INVALID_STATE', 'unknown, used or expired state');
}

/** Check 2: the state cookie exists and equals the state (constant-time compare). */
export function check2Cookie(cookieHeader: string | undefined, state: string, stateHash: string): void {
  const value = readCookie(cookieHeader, stateCookieName(stateHash));
  if (value === undefined || value === '') fail('2', 'STATE_COOKIE_MISSING', 'no state cookie');
  if (!safeEqual(value!, state)) fail('2', 'INVALID_STATE', 'cookie does not match the state');
}

/** Check 4: a compact JWS with header alg = RS256 and a kid, and a JSON object payload. */
export function check4Token(idToken: unknown): { header: ProtectedHeaderParameters; claims: Claims } {
  if (typeof idToken !== 'string' || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(idToken)) {
    return fail('4', 'INVALID_ID_TOKEN', 'not a compact JWS');
  }
  let header: ProtectedHeaderParameters;
  let claims: unknown;
  try {
    header = decodeProtectedHeader(idToken);
    claims = JSON.parse(Buffer.from(idToken.split('.')[1]!, 'base64url').toString('utf8'));
  } catch {
    return fail('4', 'INVALID_ID_TOKEN', 'header or payload is not JSON');
  }
  if (header.alg !== 'RS256') fail('4', 'INVALID_ID_TOKEN', `alg ${String(header.alg)} is not RS256`);
  if (typeof header.kid !== 'string' || header.kid === '') fail('4', 'INVALID_ID_TOKEN', 'no kid');
  if (claims === null || typeof claims !== 'object' || Array.isArray(claims)) fail('4', 'INVALID_ID_TOKEN', 'payload is not an object');
  return { header, claims: claims as Claims };
}

/** Check 5: iss = the platform issuer; aud contains its client_id; with more than one aud, azp = client_id. */
export function check5IssuerAudience(claims: Claims, platform: Platform): void {
  if (claims.iss !== platform.issuer) fail('5', 'INVALID_ISSUER_OR_AUDIENCE', 'iss does not match');
  const aud = claims.aud;
  const list = typeof aud === 'string' ? [aud] : Array.isArray(aud) && aud.every((a) => typeof a === 'string') ? (aud as string[]) : null;
  if (!list || !list.includes(platform.clientId)) fail('5', 'INVALID_ISSUER_OR_AUDIENCE', 'aud does not contain the client id');
  if (list!.length > 1 && claims.azp !== platform.clientId) fail('5', 'INVALID_ISSUER_OR_AUDIENCE', 'azp does not match');
}

/** Check 6: the signature is valid with a key of the platform JWKS (refetch rule in jwks.ts). */
export async function check6Signature(keys: PlatformKeys, idToken: string, platform: Platform, traceId: string): Promise<void> {
  try {
    await keys.verify(idToken, platform.jwksUrl, traceId);
  } catch {
    fail('6', 'INVALID_SIGNATURE', 'signature not valid with the platform keys');
  }
}

/** Check 7: exp > now - 60 s and iat < now + 60 s. */
export function check7Time(claims: Claims, nowMs: number): void {
  const now = nowMs / 1000;
  if (typeof claims.exp !== 'number' || typeof claims.iat !== 'number') fail('7', 'TOKEN_EXPIRED', 'exp or iat missing');
  if ((claims.exp as number) <= now - CLOCK_SKEW_S) fail('7', 'TOKEN_EXPIRED', 'expired');
  if ((claims.iat as number) >= now + CLOCK_SKEW_S) fail('7', 'TOKEN_EXPIRED', 'issued in the future');
}

/** Check 8: nonce = the nonce of the state record. */
export function check8Nonce(claims: Claims, state: StateRecord): void {
  if (typeof claims.nonce !== 'string' || !safeEqual(claims.nonce, state.nonce)) fail('8', 'INVALID_NONCE', 'nonce does not match');
}

/** Check 9: deployment_id is a known deployment of the platform. */
export function check9Deployment(claims: Claims, platform: Platform): string {
  const d = claims[CLAIM.deploymentId];
  if (typeof d !== 'string' || !platform.deploymentIds.includes(d)) fail('9', 'UNKNOWN_DEPLOYMENT', 'unknown deployment');
  return d as string;
}

/** Check 10: version = 1.3.0 and a supported message type. */
export function check10Message(claims: Claims): (typeof MESSAGE_TYPES)[number] {
  if (claims[CLAIM.version] !== '1.3.0') fail('10', 'UNSUPPORTED_MESSAGE_TYPE', 'version is not 1.3.0');
  const type = claims[CLAIM.messageType];
  if (!MESSAGE_TYPES.includes(type as (typeof MESSAGE_TYPES)[number])) fail('10', 'UNSUPPORTED_MESSAGE_TYPE', 'unsupported message type');
  return type as (typeof MESSAGE_TYPES)[number];
}

const nonEmptyString = (v: unknown): v is string => typeof v === 'string' && v !== '';

/** Check 11: sub, roles, target_link_uri; resource_link.id (resource link) or deep_link_return_url (deep linking). */
export function check11Claims(claims: Claims, messageType: (typeof MESSAGE_TYPES)[number]): void {
  if (!nonEmptyString(claims.sub)) fail('11', 'MISSING_CLAIM', 'sub');
  const roles = claims[CLAIM.roles];
  if (!Array.isArray(roles) || !roles.every((r) => typeof r === 'string')) fail('11', 'MISSING_CLAIM', 'roles');
  if (!nonEmptyString(claims[CLAIM.targetLinkUri])) fail('11', 'MISSING_CLAIM', 'target_link_uri');
  if (messageType === 'LtiResourceLinkRequest') {
    const rl = claims[CLAIM.resourceLink] as { id?: unknown } | undefined;
    if (!rl || typeof rl !== 'object' || !nonEmptyString(rl.id)) fail('11', 'MISSING_CLAIM', 'resource_link.id');
  } else {
    const dl = claims[CLAIM.deepLinkingSettings] as { deep_link_return_url?: unknown } | undefined;
    if (!dl || typeof dl !== 'object' || !nonEmptyString(dl.deep_link_return_url)) fail('11', 'MISSING_CLAIM', 'deep_link_return_url');
  }
}

/** Check 12: target_link_uri = the value in the state record, and it is our launch URL for this account. */
export function check12Target(claims: Claims, state: StateRecord, urls: PublicUrls, accountId: string): void {
  const target = claims[CLAIM.targetLinkUri];
  if (target !== state.targetLinkUri || !isOwnLaunchTarget(target, urls, accountId)) fail('12', 'INVALID_TARGET_LINK_URI', 'target_link_uri does not match');
}
