// Shared authorization context for the T3a and T3c service routes, and the M1 binding checks of every API call that
// uses a ltik or a service key (LTI contract §9.14).
import { ApiError } from '../api-errors.ts';
import { deploymentOf, isPlatformUsable } from '../lti/binding.ts';
import { CLAIM } from '../lti/checks.ts';
import { deepLinkingResponse } from '../lti/deep-linking.ts';
import type { ProtocolUrlResolver } from '../lti/target.ts';
import { signToolJwt } from '../lti/tool-jwt.ts';
import type { AgsContext } from '../platform/ags.ts';
import { profileDefinition } from '../profiles/index.ts';
import type { Platform } from '../store/platforms.ts';
import { getPlatform } from '../store/platforms.ts';
import type { AuthResult } from './auth.ts';
import type { RouteContext } from './context.ts';

type Ctx = Pick<RouteContext, 'db' | 'profiles'>;

export function claimObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/**
 * The platform of a ltik or service key, after the binding checks in this order (§9.14, §9.2):
 *  1. the platform exists (else 401 of the scheme);
 *  2. the generation of the ltik or key equals the deployment's generation (else 401 of the scheme);
 *  3. the platform is active and its profile is known now (else 403 PLATFORM_NOT_ACTIVE);
 *  4. the deployment is active (else 403 DEPLOYMENT_NOT_ACTIVE).
 * A deployment row that is gone counts as inactive, except for `standard` platforms (unchanged behaviour).
 */
/** The deployment of the ltik or service key ('' when neither has one). */
export const deploymentIdOf = (caller: AuthResult): string => caller.launch?.deploymentId ?? caller.serviceKey?.deploymentId ?? '';

export function platformOf(ctx: Ctx, caller: AuthResult): Platform {
  const unauthorized = () => new ApiError(caller.launch ? 'INVALID_LTIK_AUTH_AUTHORIZATION_HEADER' : 'INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER');
  const id = caller.launch?.platformId ?? caller.serviceKey?.platformId;
  const platform = id ? getPlatform(ctx.db, caller.account.id, id) : null;
  if (!platform) throw unauthorized();
  const deploymentId = deploymentIdOf(caller);
  const generation = caller.launch?.bindingGeneration ?? caller.serviceKey?.bindingGeneration ?? 0;
  const deployment = deploymentOf(platform, deploymentId);
  if (deployment && deployment.bindingGeneration !== generation) throw unauthorized();
  if (!isPlatformUsable(platform, ctx.profiles)) throw new ApiError('PLATFORM_NOT_ACTIVE');
  const def = profileDefinition(platform.profile, ctx.profiles);
  if (deployment ? !deployment.active : (def !== null && def.endpoints !== 'admin')) throw new ApiError('DEPLOYMENT_NOT_ACTIVE');
  return platform;
}

export function agsContext(ctx: Ctx, caller: AuthResult, traceId: string): AgsContext {
  return {
    platform: platformOf(ctx, caller), traceId, deploymentId: deploymentIdOf(caller),
    agsClaim: caller.launch ? claimObject(caller.launch.claims[CLAIM.ags]) : caller.serviceKey?.agsClaim ?? null,
  };
}

/** The route group gives its resolver. The protocol URLs come from the account of the ltik (LA-ADR-06 D2). */
export async function signedDeepLink(ctx: RouteContext, resolver: ProtocolUrlResolver, caller: AuthResult, body: unknown) {
  const platform = platformOf(ctx, caller);
  const protocolUrls = resolver.protocolUrls(caller.account);
  const { claims, target } = deepLinkingResponse(caller.launch!, platform, claimObject(body) ?? {}, protocolUrls);
  return { message: await signToolJwt(ctx.db, ctx.masterKey, caller.account.id, claims, ctx.now()), target };
}
