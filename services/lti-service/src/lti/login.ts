import type { PublicUrls } from '@cogniate/shared';
import { randomToken, sha256Hex } from '@cogniate/shared';
import type { Db } from '../db/index.ts';
import { getAccount } from '../store/accounts.ts';
import { findLoginPlatforms } from '../store/platforms.ts';
import { STATE_TTL_MS, saveState } from '../store/states.ts';
import { stateCookieName } from './checks.ts';
import type { ProtocolErrorCode } from './codes.ts';
import { isOwnLaunchTarget, launchUri } from './target.ts';

export type LoginResult =
  | { ok: true; location: string; setCookie: string; platformId: string }
  | { ok: false; code: ProtocolErrorCode; /** Safe reason for login_rejected.detail. */ detail: string };

const str = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);

/** OIDC login initiation (security §2.1). params = query (GET) or form body (POST). */
export function initiateLogin(db: Db, urls: PublicUrls, accountId: string, params: Record<string, unknown>, now: number): LoginResult {
  // 1. The tool account in the path exists.
  if (!getAccount(db, accountId)) return { ok: false, code: 'UNKNOWN_TOOL_ACCOUNT', detail: 'unknown_tool_account' };
  const iss = str(params.iss);
  const loginHint = str(params.login_hint);
  const target = str(params.target_link_uri);
  if (!iss || !loginHint || !target) return { ok: false, code: 'INVALID_REQUEST', detail: !iss ? 'missing=iss' : !loginHint ? 'missing=login_hint' : 'missing=target_link_uri' };
  const clientId = str(params.client_id);
  const deploymentId = str(params.lti_deployment_id);
  const messageHint = str(params.lti_message_hint);

  // 2. iss + client_id match a platform of this account (without client_id: exactly one platform for iss).
  const candidates = findLoginPlatforms(db, accountId, iss, clientId);
  if (candidates.length === 0) return { ok: false, code: 'UNKNOWN_PLATFORM', detail: 'platform_unknown' };
  if (candidates.length > 1) return { ok: false, code: 'UNKNOWN_PLATFORM', detail: 'client_id_required' };
  const platform = candidates[0]!;
  if (!platform.active) return { ok: false, code: 'PLATFORM_NOT_ACTIVE', detail: 'platform_inactive' };
  // 3. A given deployment id must be known.
  if (deploymentId !== undefined && !platform.deploymentIds.includes(deploymentId)) {
    return { ok: false, code: 'UNKNOWN_DEPLOYMENT', detail: 'deployment_unknown' };
  }
  // 4. The target is our launch URL for this account.
  if (!isOwnLaunchTarget(target, urls, accountId)) return { ok: false, code: 'INVALID_TARGET_LINK_URI', detail: 'target_not_own' };

  // 5. State and nonce (32 random bytes each), state record, cookie, redirect to the platform.
  const state = randomToken();
  const nonce = randomToken();
  const stateHash = sha256Hex(state);
  saveState(db, { stateHash, toolAccountId: accountId, platformId: platform.id, nonce, targetLinkUri: target, expiresAt: now + STATE_TTL_MS }, now);
  const auth = new URL(platform.authEndpoint);
  const q: Record<string, string> = {
    scope: 'openid', response_type: 'id_token', response_mode: 'form_post', prompt: 'none',
    client_id: platform.clientId, redirect_uri: launchUri(urls, accountId), login_hint: loginHint,
    ...(messageHint !== undefined ? { lti_message_hint: messageHint } : {}),
    state, nonce,
  };
  for (const [k, v] of Object.entries(q)) auth.searchParams.set(k, v);
  const setCookie = `${stateCookieName(stateHash)}=${state}; Path=/; Max-Age=${STATE_TTL_MS / 1000}; Secure; HttpOnly; SameSite=None; Partitioned`;
  return { ok: true, location: auth.href, setCookie, platformId: platform.id };
}
