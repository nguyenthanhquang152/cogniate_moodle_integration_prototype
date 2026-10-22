import type { Logger, PublicUrls } from '@cogniate/shared';
import { safeEqual, sha256Hex } from '@cogniate/shared';
import type { Db } from '../db/index.ts';
import type { LmsName, ProfileOptions } from '../profiles/index.ts';
import { lmsNameOf, lmsNameOfFamily } from '../profiles/index.ts';
import { createAccountResolver } from '../accounts/resolver.ts';
import type { ToolAccount } from '../store/accounts.ts';
import type { Platform } from '../store/platforms.ts';
import { getPlatform, serviceOriginOf, setProductFamilyCode, siteOriginOf } from '../store/platforms.ts';
import { createLaunch } from '../store/launches.ts';
import type { PreparedLaunch } from '../store/storage-checks.ts';
import { consumeStorageCheck, createStorageCheck } from '../store/storage-checks.ts';
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
import { storageCheckPage } from './storage-pages.ts';

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

type AcceptedLaunch = { ok: true; kind: 'redirect'; binding: 'cookie' | 'storage'; location: string; clearCookie: string; platformId: string; messageType: string; /** Names removed by the claim allowlist (§9.8). */ removedClaims: string[] };
export type LaunchResult =
  | AcceptedLaunch
  | { ok: true; kind: 'storage'; page: ReturnType<typeof storageCheckPage>; clearCookie: string }
  | { ok: false; check: string; code: ProtocolErrorCode; detail: string; status?: number; help?: string; oidcError?: string; clearCookie?: string; /** LMS of the page. */ lms: LmsName };

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

/** Protocol status gate, shared with the later protocol call-site task LA-E5-06. */
export function protocolAccountError(account: ToolAccount | null): 'UNKNOWN_TOOL_ACCOUNT' | 'TOOL_ACCOUNT_SUSPENDED' | null {
  if (!account || account.status === 'closed') return 'UNKNOWN_TOOL_ACCOUNT';
  return account.status === 'suspended' ? 'TOOL_ACCOUNT_SUSPENDED' : null;
}

/** Both browser bindings finish through the same launch store and redirect builder. */
function completeLaunch(deps: LaunchDeps, account: ToolAccount, prepared: PreparedLaunch, stateHash: string, binding: 'cookie' | 'storage', now: number): AcceptedLaunch {
  const { removedClaims, ...input } = prepared;
  const { ltik } = createLaunch(deps.db, { ...input, toolAccountId: account.id }, deps.ltikTtlSeconds, now);
  const toolPlatform = prepared.claims[CLAIM.toolPlatform] as { product_family_code?: unknown } | undefined;
  if (toolPlatform && typeof toolPlatform.product_family_code === 'string') setProductFamilyCode(deps.db, prepared.platformId, toolPlatform.product_family_code);
  const toolUrl = prepared.messageType === 'LtiDeepLinkingRequest' ? account.deepLinkingUrl : account.launchUrl;
  return { ok: true, kind: 'redirect', binding, location: toolRedirect(toolUrl, prepared.claims[CLAIM.targetLinkUri] as string, ltik), clearCookie: clearCookieFor(stateHash), platformId: prepared.platformId, messageType: prepared.messageType, removedClaims };
}

/** Check 2s: first the account and request origin, then the atomic consume, then the state hash compare. */
export function handleStorageCheck(deps: LaunchDeps, accountId: string, form: Record<string, unknown>, origin: string | undefined): LaunchResult {
  const profiles = deps.profiles ?? { simulation: false };
  let lms = lmsNameOf(null, profiles);
  const account = createAccountResolver(deps.db, deps.urls.lti).resolveAccount({ params: { account: accountId } });
  const code = protocolAccountError(account);
  if (code) return { ok: false, check: 'storage', code, detail: code === 'TOOL_ACCOUNT_SUSPENDED' ? 'account_suspended' : 'unknown_tool_account', lms };
  const failure = (code: ProtocolErrorCode, detail: string, stateHash?: string, help?: string): LaunchResult => ({
    ok: false, check: 'storage', code, detail, status: 400, lms,
    ...(stateHash ? { clearCookie: clearCookieFor(stateHash) } : {}), ...(help ? { help } : {}),
  });
  if (origin !== new URL(deps.urls.lti).origin) return failure('INVALID_STATE', 'storage_origin');
  const now = deps.now();
  const rec = consumeStorageCheck(deps.db, accountId, typeof form.check === 'string' ? form.check : '', now);
  if (!rec) return failure('INVALID_STATE', 'storage_check_unknown_used_or_expired');
  lms = platformLmsName(getPlatform(deps.db, accountId, rec.prepared.platformId), profiles);
  const value = typeof form.value === 'string' ? form.value : '';
  if (value === '') return failure('STATE_COOKIE_MISSING', 'storage_empty', rec.stateHash, 'Your browser blocked the Cogniate sign-in in this frame. Open the activity in a new window, or allow cookies for this site.');
  if (!safeEqual(sha256Hex(value), rec.stateHash)) return failure('INVALID_STATE', 'storage_mismatch', rec.stateHash);
  return completeLaunch(deps, account!, rec.prepared, rec.stateHash, 'storage', now);
}

/** POST /lti/launch/{toolAccountId} (security §2.2). Order: 1+3, 2, 4..12, 13 (M1, not standard), 14 (M1, every profile). */
export async function handleLaunch(deps: LaunchDeps, accountId: string, form: Record<string, unknown>, cookieHeader: string | undefined, traceId: string): Promise<LaunchResult> {
  const now = deps.now();
  const profiles = deps.profiles ?? { simulation: false };
  const state = form.state;
  const stateHash = typeof state === 'string' && state !== '' ? sha256Hex(state) : null;
  let lms: LmsName = lmsNameOf(null, profiles);
  try {
    const resolver = createAccountResolver(deps.db, deps.urls.lti);
    const account = resolver.resolveAccount({ params: { account: accountId } });
    const accountError = protocolAccountError(account);
    if (!account || accountError) return { ok: false, check: '1', code: accountError ?? 'UNKNOWN_TOOL_ACCOUNT', detail: accountError === 'TOOL_ACCOUNT_SUSPENDED' ? 'account_suspended' : 'unknown_tool_account', lms };
    const protocolUrls = resolver.protocolUrls(account);
    // Checks 1 and 3 (state found and used up in one statement).
    const rec = check1And3State(deps.db, accountId, state, stateHash, now);
    const clearCookie = clearCookieFor(rec.stateHash);
    const platform = getPlatform(deps.db, accountId, rec.platformId);
    lms = platformLmsName(platform, profiles);
    // OIDC error answer (Moodle: invalid_scope, unauthorized_client, access_denied ...): the state is used up.
    if (form.id_token === undefined && typeof form.error === 'string') {
      return { ok: false, check: 'oidc_error', code: 'PLATFORM_ERROR', detail: `error=${safeWord(form.error)}`, oidcError: form.error.slice(0, 64), clearCookie, lms };
    }
    // Check 2. Only a missing cookie can fall back to the stored target; a mismatch still fails.
    let useStorage = false;
    try {
      check2Cookie(cookieHeader, state as string, rec.stateHash);
    } catch (err) {
      if (err instanceof LaunchCheckError && err.code === 'STATE_COOKIE_MISSING') {
        if (rec.storageTarget && rec.storageOrigin) useStorage = true;
        else return { ok: false, check: err.check, code: err.code, detail: err.detail, help: await cookieHelpFor(deps, form.id_token, platform, traceId), lms };
      } else throw err;
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
    check12Target(claims, rec, protocolUrls);
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

    // All token checks passed. Apply the claim policy before either store receives the launch data.
    const { kept, removed } = profile.privacyFloor === 'none' ? { kept: claims as Claims, removed: [] } : minimizeClaims(claims as Claims);
    const prepared: PreparedLaunch = {
      platformId: platform.id, deploymentId: deployment.deploymentId, messageType, claims: kept,
      siteOrigin: origins.site, serviceOrigin: origins.service, bindingGeneration: deployment.bindingGeneration, removedClaims: removed,
    };
    if (useStorage) {
      const check = createStorageCheck(deps.db, accountId, { stateHash: rec.stateHash, prepared }, now);
      const page = storageCheckPage({ postUrl: `${protocolUrls.launch}/storage-check`, check, stateHash: rec.stateHash, target: rec.storageTarget!, origin: rec.storageOrigin! });
      return { ok: true, kind: 'storage', page, clearCookie };
    }
    return completeLaunch(deps, account, prepared, rec.stateHash, 'cookie', now);
  } catch (err) {
    if (err instanceof LaunchCheckError) {
      return { ok: false, check: err.check, code: err.code, detail: err.detail, ...(stateHash ? { clearCookie: clearCookieFor(stateHash) } : {}), lms };
    }
    throw err;
  }
}
