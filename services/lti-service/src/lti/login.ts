import { randomToken, sha256Hex } from '@cogniate/shared';
import type { Db } from '../db/index.ts';
import type { LmsName, ProfileOptions } from '../profiles/index.ts';
import { lmsNameOf, profileDefinition, profileOfFixedIssuer } from '../profiles/index.ts';
import { storageBindingOf } from '../profiles/storage.ts';
import { findDeployment, findLoginPlatforms } from '../store/platforms.ts';
import type { ToolAccount } from '../store/accounts.ts';
import { STATE_TTL_MS, saveState } from '../store/states.ts';
import { isPlatformUsable, platformLmsName } from './binding.ts';
import { stateCookieName } from './checks.ts';
import type { ProtocolErrorCode } from './codes.ts';
import type { ProtocolUrlResolver } from './target.ts';
import { isOwnLaunchTarget } from './target.ts';
import { storageLoginPage } from './storage-pages.ts';
import type { TenantLogIds } from './launch.ts';
import { tenantLogIds } from './launch.ts';
import { statusGate } from './account-status.ts';

export type LoginResult =
  | { ok: true; location: string; setCookie: string; platformId: string; page?: ReturnType<typeof storageLoginPage> }
  | { ok: false; code: ProtocolErrorCode; /** Safe reason for login_rejected.detail. */ detail: string; /** LMS name of the error page (security §12). */ lms: LmsName; /** Ids for login_rejected. */ logIds: TenantLogIds };

const str = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);

/** Before a platform is known, a login `iss` equal to a fixed profile issuer selects that LMS name (security §12). */
function lmsOfIssuer(iss: string | undefined, profiles: ProfileOptions): LmsName {
  if (!iss) return lmsNameOf(null, profiles);
  try {
    return lmsNameOf(profileOfFixedIssuer(new URL(iss).origin, profiles), profiles);
  } catch {
    return lmsNameOf(null, profiles);
  }
}

/** OIDC login initiation (security §2.1). params = query (GET) or form body (POST). */
export function initiateLogin(db: Db, resolver: ProtocolUrlResolver, resolved: ToolAccount | null, params: Record<string, unknown>, now: number, profiles: ProfileOptions = { simulation: false }): LoginResult {
  const iss = str(params.iss);
  // The ids grow as the login finds the account and the platform (contract delta §6).
  let logIds: TenantLogIds = {};
  const fail = (code: ProtocolErrorCode, detail: string, lms: LmsName = lmsOfIssuer(iss, profiles)): LoginResult => ({ ok: false, code, detail, lms, logIds });
  // The status gate runs before state creation or any platform work (contract delta §1.5).
  logIds = tenantLogIds(resolved);
  const gate = statusGate(resolved);
  if (!gate.ok) return fail(gate.code, gate.detail);
  const { account } = gate;
  const protocolUrls = resolver.protocolUrls(account);
  const loginHint = str(params.login_hint);
  const target = str(params.target_link_uri);
  if (!iss || !loginHint || !target) return fail('INVALID_REQUEST', !iss ? 'missing=iss' : !loginHint ? 'missing=login_hint' : 'missing=target_link_uri');
  const clientId = str(params.client_id);
  const deploymentId = str(params.lti_deployment_id);
  const messageHint = str(params.lti_message_hint);

  // 2. iss + client_id match a platform of this account (without client_id: exactly one platform for iss).
  const candidates = findLoginPlatforms(db, account.id, iss, clientId);
  if (candidates.length === 0) return fail('UNKNOWN_PLATFORM', 'platform_unknown');
  if (candidates.length > 1) return fail('UNKNOWN_PLATFORM', 'client_id_required');
  const platform = candidates[0]!;
  logIds = tenantLogIds(account, platform);
  const lms = platformLmsName(platform, profiles);
  // A stored profile that is unknown now (a simulation row while simulations are off) is inactive (§9.1).
  if (!isPlatformUsable(platform, profiles)) return fail('PLATFORM_NOT_ACTIVE', 'platform_inactive', lms);
  // 3. A given deployment id must be known and (M1) active; the state keeps it for check 9.
  if (deploymentId !== undefined) {
    const d = findDeployment(platform, deploymentId);
    if (!d) return fail('UNKNOWN_DEPLOYMENT', 'deployment_unknown', lms);
    if (!d.active) return fail('DEPLOYMENT_NOT_ACTIVE', 'deployment_inactive', lms);
  }
  // 4. The target is our launch URL for this account.
  if (!isOwnLaunchTarget(target, protocolUrls)) return fail('INVALID_TARGET_LINK_URI', 'target_not_own', lms);

  // 5. State and nonce (32 random bytes each), state record, cookie, redirect to the platform.
  const state = randomToken();
  const nonce = randomToken();
  const stateHash = sha256Hex(state);
  const storage = storageBindingOf(profileDefinition(platform.profile, profiles)?.platformStorage, params, platform.authEndpoint);
  saveState(db, {
    stateHash, toolAccountId: account.id, platformId: platform.id, nonce, targetLinkUri: target, expiresAt: now + STATE_TTL_MS, loginDeploymentId: deploymentId ?? null,
    storageTarget: storage?.target ?? null, storageOrigin: storage?.origin ?? null,
  }, now);
  const auth = new URL(platform.authEndpoint);
  const q: Record<string, string> = {
    scope: 'openid', response_type: 'id_token', response_mode: 'form_post', prompt: 'none',
    client_id: platform.clientId, redirect_uri: protocolUrls.launch, login_hint: loginHint,
    ...(messageHint !== undefined ? { lti_message_hint: messageHint } : {}),
    state, nonce,
  };
  for (const [k, v] of Object.entries(q)) auth.searchParams.set(k, v);
  const setCookie = `${stateCookieName(stateHash)}=${state}; Path=/; Max-Age=${STATE_TTL_MS / 1000}; Secure; HttpOnly; SameSite=None; Partitioned`;
  const page = storage ? storageLoginPage({ authUrl: auth.href, state, ...storage }) : undefined;
  return { ok: true, location: auth.href, setCookie, platformId: platform.id, ...(page ? { page } : {}) };
}
