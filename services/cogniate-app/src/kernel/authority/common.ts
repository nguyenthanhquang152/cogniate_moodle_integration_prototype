import type { Logger } from '@cogniate/shared';
import type { LtiClient, LtiPlatform } from '../../clients/lti-client.ts';
import { LtiServiceError, ltiErrorFields } from '../../clients/lti-client.ts';
import type { PlatformInfo } from '../../domain/connections.ts';
import { platformOwner } from '../../domain/connections.ts';
import type { Db } from '../../domain/db.ts';
import { ApiError } from '../../app/api-errors.ts';

export function ltiFailure(err: unknown, traceId: string): never {
  if (err instanceof LtiServiceError) throw new ApiError('LTI_SERVICE_ERROR', `The LTI service answered ${err.status || 'nothing'} (${err.code}). Trace id: ${traceId}`);
  throw err;
}

export const platformInfo = (p: LtiPlatform): PlatformInfo => ({ id: p.id, issuer: p.url, clientId: p.clientId, deploymentIds: p.deploymentIds, productFamilyCode: p.productFamilyCode ?? null });

/**
 * Security §2.6 "orphans are switched off": the app got this platform id from the LTI service (registration complete
 * or manual create) and could not bind it to the requesting connection. If no connection owns it, set it inactive at
 * once and log platform_orphan_deactivated. A platform that a connection owns is never touched.
 */
export async function deactivateOrphan(deps: { db: Db; lti: LtiClient; logger: Logger }, platformId: string, traceId: string): Promise<void> {
  if (platformOwner(deps.db, platformId) !== undefined) return;
  try {
    await deps.lti.patchPlatform(platformId, { active: false }, traceId);
    deps.logger.warn('platform_orphan_deactivated', { trace_id: traceId, platform_id: platformId });
  } catch (err) {
    // The platform stays active but is bound to no connection, so a launch from it only gets the "not available" page.
    deps.logger.warn('platform_orphan_deactivate_failed', { trace_id: traceId, platform_id: platformId, ...ltiErrorFields(err) });
  }
}

