// Shared authorization context for the T3a and T3c service routes.
import { ApiError } from '../api-errors.ts';
import type { Db } from '../db/index.ts';
import { CLAIM } from '../lti/checks.ts';
import { deepLinkingResponse } from '../lti/deep-linking.ts';
import { signToolJwt } from '../lti/tool-jwt.ts';
import type { AgsContext } from '../platform/ags.ts';
import { getPlatform } from '../store/platforms.ts';
import type { AuthResult } from './auth.ts';
import type { RouteContext } from './context.ts';

export function claimObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function platformOf(db: Db, caller: AuthResult) {
  const id = caller.launch?.platformId ?? caller.serviceKey?.platformId;
  const platform = id ? getPlatform(db, caller.account.id, id) : null;
  if (!platform) throw new ApiError(caller.launch ? 'INVALID_LTIK_AUTH_AUTHORIZATION_HEADER' : 'INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER');
  if (!platform.active) throw new ApiError('PLATFORM_NOT_ACTIVE');
  return platform;
}

export function agsContext(db: Db, caller: AuthResult, traceId: string): AgsContext {
  return {
    platform: platformOf(db, caller), traceId,
    agsClaim: caller.launch ? claimObject(caller.launch.claims[CLAIM.ags]) : caller.serviceKey?.agsClaim ?? null,
  };
}

export async function signedDeepLink(ctx: RouteContext, caller: AuthResult, body: unknown) {
  const platform = platformOf(ctx.db, caller);
  const { claims, target } = deepLinkingResponse(caller.launch!, platform, claimObject(body) ?? {}, ctx.urls);
  return { message: await signToolJwt(ctx.db, ctx.masterKey, caller.account.id, claims, ctx.now()), target };
}
