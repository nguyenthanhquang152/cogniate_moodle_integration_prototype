import type { PublicUrls } from '@cogniate/shared';
import { sha256Hex } from '../crypto.ts';
import type { Db } from '../db/index.ts';
import { getAccount } from '../store/accounts.ts';
import type { Platform } from '../store/platforms.ts';
import { getPlatform, setProductFamilyCode } from '../store/platforms.ts';
import { createLaunch } from '../store/launches.ts';
import type { Claims } from './checks.ts';
import {
  CLAIM, LaunchCheckError, check10Message, check11Claims, check12Target, check1And3State, check2Cookie, check4Token,
  check5IssuerAudience, check6Signature, check7Time, check8Nonce, check9Deployment, stateCookieName,
} from './checks.ts';
import type { ProtocolErrorCode } from './codes.ts';
import { COOKIE_HELP } from './codes.ts';
import type { PlatformKeys } from './jwks.ts';

export interface LaunchDeps {
  db: Db;
  urls: PublicUrls;
  keys: PlatformKeys;
  ltikTtlSeconds: number;
  now: () => number;
}

export type LaunchResult =
  | { ok: true; location: string; clearCookie: string; platformId: string; messageType: string }
  | { ok: false; check: string; code: ProtocolErrorCode; detail: string; help?: string; oidcError?: string; clearCookie?: string };

const clearCookieFor = (stateHash: string) =>
  `${stateCookieName(stateHash)}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=None; Partitioned`;

/** STATE_COOKIE_MISSING: checks 4 and 6 only to choose the help text; the launch never continues. */
async function cookieHelp(deps: LaunchDeps, idToken: unknown, platform: Platform | null, traceId: string): Promise<string> {
  if (!platform) return COOKIE_HELP.other;
  try {
    const { claims } = check4Token(idToken);
    await check6Signature(deps.keys, idToken as string, platform, traceId);
    const type = claims[CLAIM.messageType];
    if (type === 'LtiResourceLinkRequest') return COOKIE_HELP.resourceLink;
    if (type === 'LtiDeepLinkingRequest') return COOKIE_HELP.deepLinking;
  } catch { /* fall through */ }
  return COOKIE_HELP.other;
}

/** Copy the query of target_link_uri to the tool URL (minus any ltik) and add the new ltik (contract §2.2). */
export function toolRedirect(toolUrl: string, targetLinkUri: string, ltik: string): string {
  const out = new URL(toolUrl);
  for (const [k, v] of new URL(targetLinkUri).searchParams) if (k !== 'ltik') out.searchParams.append(k, v);
  out.searchParams.set('ltik', ltik);
  return out.href;
}

/** POST /lti/launch/{toolAccountId} (security §2.2). Order: 1+3, 2, 4..12. */
export async function handleLaunch(deps: LaunchDeps, accountId: string, form: Record<string, unknown>, cookieHeader: string | undefined, traceId: string): Promise<LaunchResult> {
  const now = deps.now();
  const state = form.state;
  const stateHash = typeof state === 'string' && state !== '' ? sha256Hex(state) : null;
  try {
    const account = getAccount(deps.db, accountId);
    if (!account) throw new LaunchCheckError('1', 'INVALID_STATE', 'unknown tool account');
    // Checks 1 and 3 (state found and used up in one statement).
    const rec = check1And3State(deps.db, accountId, state, stateHash, now);
    const clearCookie = clearCookieFor(rec.stateHash);
    // OIDC error answer (Moodle: invalid_scope, unauthorized_client, access_denied ...): the state is used up.
    if (form.id_token === undefined && typeof form.error === 'string') {
      return { ok: false, check: 'oidc_error', code: 'PLATFORM_ERROR', detail: 'platform sent an OIDC error', oidcError: form.error.slice(0, 64), clearCookie };
    }
    const platform = getPlatform(deps.db, accountId, rec.platformId);
    // Check 2.
    try {
      check2Cookie(cookieHeader, state as string, rec.stateHash);
    } catch (err) {
      if (err instanceof LaunchCheckError && err.code === 'STATE_COOKIE_MISSING') {
        return { ok: false, check: err.check, code: err.code, detail: err.message, help: await cookieHelp(deps, form.id_token, platform, traceId) };
      }
      throw err;
    }
    if (!platform) throw new LaunchCheckError('1', 'INVALID_STATE', 'platform of the state is gone');
    if (!platform.active) throw new LaunchCheckError('platform_active', 'PLATFORM_NOT_ACTIVE', 'platform is not active');
    // Checks 4 to 12.
    const { claims } = check4Token(form.id_token);
    check5IssuerAudience(claims, platform);
    await check6Signature(deps.keys, form.id_token as string, platform, traceId);
    check7Time(claims, now);
    check8Nonce(claims, rec);
    const deploymentId = check9Deployment(claims, platform);
    const messageType = check10Message(claims);
    check11Claims(claims, messageType);
    check12Target(claims, rec, deps.urls, accountId);

    // All checks passed: store the launch, make the ltik, redirect to the tool.
    const { ltik } = createLaunch(deps.db, { toolAccountId: accountId, platformId: platform.id, deploymentId, messageType, claims: claims as Claims }, deps.ltikTtlSeconds, now);
    const toolPlatform = claims[CLAIM.toolPlatform] as { product_family_code?: unknown } | undefined;
    if (toolPlatform && typeof toolPlatform.product_family_code === 'string') setProductFamilyCode(deps.db, platform.id, toolPlatform.product_family_code);
    const toolUrl = messageType === 'LtiDeepLinkingRequest' ? account.deepLinkingUrl : account.launchUrl;
    return { ok: true, location: toolRedirect(toolUrl, claims[CLAIM.targetLinkUri] as string, ltik), clearCookie, platformId: platform.id, messageType };
  } catch (err) {
    if (err instanceof LaunchCheckError) {
      return { ok: false, check: err.check, code: err.code, detail: err.message, ...(stateHash ? { clearCookie: clearCookieFor(stateHash) } : {}) };
    }
    throw err;
  }
}
