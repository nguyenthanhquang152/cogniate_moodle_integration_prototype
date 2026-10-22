import type { Logger, PublicUrls } from '@cogniate/shared';
import { sha256Hex } from '@cogniate/shared';
import type { Db } from '../db/index.ts';
import type { LmsName, ProfileOptions } from '../profiles/index.ts';
import { lmsNameOf, lmsNameOfFamily } from '../profiles/index.ts';
import { getAccount } from '../store/accounts.ts';
import type { Platform } from '../store/platforms.ts';
import { getPlatform, serviceOriginOf, setProductFamilyCode, siteOriginOf } from '../store/platforms.ts';
import { createLaunch } from '../store/launches.ts';
import { platformLmsName, platformProfile } from './binding.ts';
import type { Claims } from './checks.ts';
import {
  CLAIM, LaunchCheckError, safeWord, check10Message, check11Claims, check12Target, check13Origins, check14ProductFamily, check1And3State, check2Cookie,
  check4Token, check5IssuerAudience, check6Signature, check7Time, check8Nonce, check9Deployment, stateCookieName,
} from './checks.ts';
import { minimizeClaims } from './claims.ts';
import type { ProtocolErrorCode } from './codes.ts';
import { cookieHelp } from './codes.ts';
import type { PlatformKeys } from './jwks.ts';

export interface LaunchDeps {
  db: Db;
  urls: PublicUrls;
  keys: PlatformKeys;
  ltikTtlSeconds: number;
  now: () => number;
  logger: Logger;
  /** Provider profile options (simulation profiles on or off). */
  profiles?: ProfileOptions;
}

export type LaunchResult =
  | { ok: true; location: string; clearCookie: string; platformId: string; messageType: string; /** Names removed by the claim allowlist (§9.8). */ removedClaims: string[] }
  | { ok: false; check: string; code: ProtocolErrorCode; detail: string; help?: string; oidcError?: string; clearCookie?: string; /** LMS of the page. */ lms: LmsName };

const clearCookieFor = (stateHash: string) =>
  `${stateCookieName(stateHash)}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=None; Partitioned`;

/** STATE_COOKIE_MISSING: checks 4 and 6 only to choose the help text; the launch never continues. */
async function cookieHelpFor(deps: LaunchDeps, idToken: unknown, platform: Platform | null, traceId: string): Promise<string> {
  const lms = platformLmsName(platform, deps.profiles);
  if (!platform) return cookieHelp('other', lms);
  try {
    const { claims } = check4Token(idToken);
    await check6Signature(deps.keys, idToken as string, platform, traceId);
    const type = claims[CLAIM.messageType];
    if (type === 'LtiResourceLinkRequest') return cookieHelp('resourceLink', lms);
    if (type === 'LtiDeepLinkingRequest') return cookieHelp('deepLinking', lms);
  } catch { /* fall through */ }
  return cookieHelp('other', lms);
}

/** Copy the query of target_link_uri to the tool URL (minus any ltik) and add the new ltik (contract §2.2). */
export function toolRedirect(toolUrl: string, targetLinkUri: string, ltik: string): string {
  const out = new URL(toolUrl);
  for (const [k, v] of new URL(targetLinkUri).searchParams) if (k !== 'ltik') out.searchParams.append(k, v);
  out.searchParams.set('ltik', ltik);
  return out.href;
}

/** POST /lti/launch/{toolAccountId} (security §2.2). Order: 1+3, 2, 4..12, 13 (M1, not standard), 14 (M1, every profile). */
export async function handleLaunch(deps: LaunchDeps, accountId: string, form: Record<string, unknown>, cookieHeader: string | undefined, traceId: string): Promise<LaunchResult> {
  const now = deps.now();
  const profiles = deps.profiles ?? { simulation: false };
  const state = form.state;
  const stateHash = typeof state === 'string' && state !== '' ? sha256Hex(state) : null;
  let lms: LmsName = lmsNameOf(null, profiles);
  try {
    const account = getAccount(deps.db, accountId);
    if (!account) throw new LaunchCheckError('1', 'INVALID_STATE', 'unknown_tool_account');
    // Checks 1 and 3 (state found and used up in one statement).
    const rec = check1And3State(deps.db, accountId, state, stateHash, now);
    const clearCookie = clearCookieFor(rec.stateHash);
    const platform = getPlatform(deps.db, accountId, rec.platformId);
    lms = platformLmsName(platform, profiles);
    // OIDC error answer (Moodle: invalid_scope, unauthorized_client, access_denied ...): the state is used up.
    if (form.id_token === undefined && typeof form.error === 'string') {
      return { ok: false, check: 'oidc_error', code: 'PLATFORM_ERROR', detail: `error=${safeWord(form.error)}`, oidcError: form.error.slice(0, 64), clearCookie, lms };
    }
    // Check 2.
    try {
      check2Cookie(cookieHeader, state as string, rec.stateHash);
    } catch (err) {
      if (err instanceof LaunchCheckError && err.code === 'STATE_COOKIE_MISSING') {
        return { ok: false, check: err.check, code: err.code, detail: err.detail, help: await cookieHelpFor(deps, form.id_token, platform, traceId), lms };
      }
      throw err;
    }
    if (!platform) throw new LaunchCheckError('1', 'INVALID_STATE', 'platform_deleted');
    // A stored profile that is unknown now (a simulation row while simulations are off) is inactive (§9.1).
    const profile = platformProfile(platform, profiles);
    if (!platform.active || !profile) throw new LaunchCheckError('platform_active', 'PLATFORM_NOT_ACTIVE', 'platform_inactive');
    // Checks 4 to 12.
    const { claims } = check4Token(form.id_token);
    check5IssuerAudience(claims, platform);
    await check6Signature(deps.keys, form.id_token as string, platform, traceId);
    check7Time(claims, now);
    check8Nonce(claims, rec);
    const deployment = check9Deployment(claims, platform, rec);
    const messageType = check10Message(claims);
    check11Claims(claims, messageType);
    check12Target(claims, rec, deps.urls, accountId);
    // The site and service origins come from the stored rows, never from a claim (M1 design notes).
    const origins = { site: siteOriginOf(platform, deployment), service: serviceOriginOf(platform, deployment) };
    // Check 13 (profiles other than standard) and check 14 (every profile).
    if (profile.flags.serviceOriginCheck) check13Origins(claims, origins);
    try {
      const family = check14ProductFamily(claims, profile, profiles);
      if (family !== null) deps.logger.info('family_guard_mismatch', { platform_id: platform.id, family });
    } catch (err) {
      // The page names the LMS of the signed product family (contract §9.2).
      if (err instanceof LaunchCheckError) lms = lmsNameOfFamily(err.detail.replace('family=', ''), profiles) ?? lms;
      throw err;
    }

    // All checks passed: the claim allowlist, then store the launch, make the ltik, redirect to the tool.
    const { kept, removed } = profile.privacyFloor === 'none' ? { kept: claims as Claims, removed: [] } : minimizeClaims(claims as Claims);
    const { ltik } = createLaunch(deps.db, {
      toolAccountId: accountId, platformId: platform.id, deploymentId: deployment.deploymentId, messageType, claims: kept,
      siteOrigin: origins.site, serviceOrigin: origins.service, bindingGeneration: deployment.bindingGeneration,
    }, deps.ltikTtlSeconds, now);
    const toolPlatform = kept[CLAIM.toolPlatform] as { product_family_code?: unknown } | undefined;
    if (toolPlatform && typeof toolPlatform.product_family_code === 'string') setProductFamilyCode(deps.db, platform.id, toolPlatform.product_family_code);
    const toolUrl = messageType === 'LtiDeepLinkingRequest' ? account.deepLinkingUrl : account.launchUrl;
    return { ok: true, location: toolRedirect(toolUrl, claims[CLAIM.targetLinkUri] as string, ltik), clearCookie, platformId: platform.id, messageType, removedClaims: removed };
  } catch (err) {
    if (err instanceof LaunchCheckError) {
      return { ok: false, check: err.check, code: err.code, detail: err.detail, ...(stateHash ? { clearCookie: clearCookieFor(stateHash) } : {}), lms };
    }
    throw err;
  }
}
