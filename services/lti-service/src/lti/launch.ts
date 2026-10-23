import { storeFor } from '../store/index.ts';
import type { Logger, PublicUrls } from '@cogniate/shared';
import { safeEqual, sha256Hex } from '@cogniate/shared';
import type { StoreSource as Db } from '../store/index.ts';
import type { LmsName, ProfileOptions } from '../profiles/index.ts';
import { lmsNameOf, lmsNameOfFamily } from '../profiles/index.ts';
import type { ToolAccount } from '../store/accounts.ts';
import type { Platform } from '../store/platforms.ts';
import { serviceOriginOf, siteOriginOf } from '../store/platforms.ts';
import type { PreparedLaunch } from '../store/storage-checks.ts';
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
import type { ProtocolUrlResolver } from './target.ts';
import { statusGate } from './account-status.ts';
import { storageCheckPage } from './storage-pages.ts';

export interface LaunchDeps {
  db: Db;
  urls: PublicUrls;
  /** The resolver of the route group; the route resolves the account once per request (LA-ADR-06 D2). */
  resolver: ProtocolUrlResolver;
  keys: PlatformKeys;
  ltikTtlSeconds: number;
  now: () => number;
  logger: Logger;
  /** Provider profile options (simulation profiles on or off). */
  profiles?: ProfileOptions;
}

/** Tenant ids of a protocol log line (contract delta §6). Each id only when it is known; never an empty string. */
export interface TenantLogIds {
  tool_account_id?: string;
  platform_id?: string;
}

/**
 * Known = a stored row (BD-A2-52, the same rule as http_request): the account for every status, and a platform of
 * that account. A path value that is not a stored account gives no field, so the line does not change.
 */
export function tenantLogIds(account: ToolAccount | null, platform: Platform | null = null): TenantLogIds {
  if (!account) return {};
  return platform ? { tool_account_id: account.id, platform_id: platform.id } : { tool_account_id: account.id };
}

type AcceptedLaunch = { ok: true; kind: 'redirect'; binding: 'cookie' | 'storage'; location: string; clearCookie: string; toolAccountId: string; platformId: string; messageType: string; /** Names removed by the claim allowlist (§9.8). */ removedClaims: string[] };
export type LaunchResult =
  | AcceptedLaunch
  | { ok: true; kind: 'storage'; page: ReturnType<typeof storageCheckPage>; clearCookie: string }
  | { ok: false; check: string; code: ProtocolErrorCode; detail: string; status?: number; help?: string; oidcError?: string; clearCookie?: string; /** LMS of the page. */ lms: LmsName; /** Ids for launch_check_failed. */ logIds: TenantLogIds };

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

/** Both browser bindings finish through the same launch store and redirect builder. */
async function completeLaunch(deps: LaunchDeps, account: ToolAccount, prepared: PreparedLaunch, stateHash: string, binding: 'cookie' | 'storage', now: number): Promise<AcceptedLaunch> {
  const { removedClaims, ...input } = prepared;
  const { ltik } = (await storeFor(deps.db).launches.createLaunch({ ...input, toolAccountId: account.id }, deps.ltikTtlSeconds, now));
  const toolPlatform = prepared.claims[CLAIM.toolPlatform] as { product_family_code?: unknown } | undefined;
  if (toolPlatform && typeof toolPlatform.product_family_code === 'string') (await storeFor(deps.db).platforms.setProductFamilyCode(prepared.platformId, toolPlatform.product_family_code));
  const toolUrl = prepared.messageType === 'LtiDeepLinkingRequest' ? account.deepLinkingUrl : account.launchUrl;
  return { ok: true, kind: 'redirect', binding, location: toolRedirect(toolUrl, prepared.claims[CLAIM.targetLinkUri] as string, ltik), clearCookie: clearCookieFor(stateHash), toolAccountId: account.id, platformId: prepared.platformId, messageType: prepared.messageType, removedClaims };
}

/** Check 2s: first the account and request origin, then the atomic consume, then the state hash compare. */
export async function handleStorageCheck(deps: LaunchDeps, resolved: ToolAccount | null, form: Record<string, unknown>, origin: string | undefined): Promise<LaunchResult> {
  const profiles = deps.profiles ?? { simulation: false };
  let lms = lmsNameOf(null, profiles);
  let logIds = tenantLogIds(resolved);
  const gate = statusGate(resolved);
  if (!gate.ok) return { ok: false, check: 'storage', code: gate.code, detail: gate.detail, lms, logIds };
  const { account } = gate;
  const failure = (code: ProtocolErrorCode, detail: string, stateHash?: string, help?: string): LaunchResult => ({
    ok: false, check: 'storage', code, detail, status: 400, lms, logIds,
    ...(stateHash ? { clearCookie: clearCookieFor(stateHash) } : {}), ...(help ? { help } : {}),
  });
  if (origin !== new URL(deps.urls.lti).origin) return failure('INVALID_STATE', 'storage_origin');
  const now = deps.now();
  const rec = (await storeFor(deps.db).storageChecks.consumeStorageCheck(account.id, typeof form.check === 'string' ? form.check : '', now));
  if (!rec) return failure('INVALID_STATE', 'storage_check_unknown_used_or_expired');
  const platform = (await storeFor(deps.db).platforms.getPlatform(account.id, rec.prepared.platformId));
  lms = platformLmsName(platform, profiles);
  logIds = tenantLogIds(account, platform);
  const value = typeof form.value === 'string' ? form.value : '';
  if (value === '') return failure('STATE_COOKIE_MISSING', 'storage_empty', rec.stateHash, 'Your browser blocked the Cogniate sign-in in this frame. Open the activity in a new window, or allow cookies for this site.');
  if (!safeEqual(sha256Hex(value), rec.stateHash)) return failure('INVALID_STATE', 'storage_mismatch', rec.stateHash);
  return (await completeLaunch(deps, account, rec.prepared, rec.stateHash, 'storage', now));
}

/** POST /lti/launch/{toolAccountId} (security §2.2). Order: 1+3, 2, 4..12, 13 (M1, not standard), 14 (M1, every profile). */
export async function handleLaunch(deps: LaunchDeps, resolved: ToolAccount | null, form: Record<string, unknown>, cookieHeader: string | undefined, traceId: string): Promise<LaunchResult> {
  const now = deps.now();
  const profiles = deps.profiles ?? { simulation: false };
  const state = form.state;
  const stateHash = typeof state === 'string' && state !== '' ? sha256Hex(state) : null;
  let lms: LmsName = lmsNameOf(null, profiles);
  let logIds: TenantLogIds = {};
  try {
    logIds = tenantLogIds(resolved);
    const gate = statusGate(resolved);
    if (!gate.ok) return { ok: false, check: '1', code: gate.code, detail: gate.detail, lms, logIds };
    const { account } = gate;
    const protocolUrls = deps.resolver.protocolUrls(account);
    // Checks 1 and 3 (state found and used up in one statement).
    const rec = (await check1And3State(deps.db, account.id, state, stateHash, now));
    const clearCookie = clearCookieFor(rec.stateHash);
    const platform = (await storeFor(deps.db).platforms.getPlatform(account.id, rec.platformId));
    lms = platformLmsName(platform, profiles);
    logIds = tenantLogIds(account, platform);
    // OIDC error answer (Moodle: invalid_scope, unauthorized_client, access_denied ...): the state is used up.
    if (form.id_token === undefined && typeof form.error === 'string') {
      return { ok: false, check: 'oidc_error', code: 'PLATFORM_ERROR', detail: `error=${safeWord(form.error)}`, oidcError: form.error.slice(0, 64), clearCookie, lms, logIds };
    }
    // Check 2. Only a missing cookie can fall back to the stored target; a mismatch still fails.
    let useStorage = false;
    try {
      check2Cookie(cookieHeader, state as string, rec.stateHash);
    } catch (err) {
      if (err instanceof LaunchCheckError && err.code === 'STATE_COOKIE_MISSING') {
        if (rec.storageTarget && rec.storageOrigin) useStorage = true;
        else return { ok: false, check: err.check, code: err.code, detail: err.detail, help: await cookieHelpFor(deps, form.id_token, platform, traceId), lms, logIds };
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
      if (family !== null) deps.logger.info('family_guard_mismatch', { tool_account_id: account.id, platform_id: platform.id, family });
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
      const check = (await storeFor(deps.db).storageChecks.createStorageCheck(account.id, { stateHash: rec.stateHash, prepared }, now));
      const page = storageCheckPage({ postUrl: `${protocolUrls.launch}/storage-check`, check, stateHash: rec.stateHash, target: rec.storageTarget!, origin: rec.storageOrigin! });
      return { ok: true, kind: 'storage', page, clearCookie };
    }
    return (await completeLaunch(deps, account, prepared, rec.stateHash, 'cookie', now));
  } catch (err) {
    if (err instanceof LaunchCheckError) {
      return { ok: false, check: err.check, code: err.code, detail: err.detail, ...(stateHash ? { clearCookie: clearCookieFor(stateHash) } : {}), lms, logIds };
    }
    throw err;
  }
}
