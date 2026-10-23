import type { PlatformBodyResult } from '../ports.ts';
import type { Logger } from '@cogniate/shared';
import type { LtiClient, LtiPlatform } from '../../clients/lti-client.ts';
import { LtiServiceError, ltiErrorFields } from '../../clients/lti-client.ts';
import type { Connection, PlatformInfo } from '../../domain/connections.ts';
import { disableConnection, getConnection, platformOwner } from '../../domain/connections.ts';
import type { Db } from '../../domain/db.ts';
import { transaction } from '../../domain/db.ts';
import { revokeOpenGrants } from '../../domain/bindings.ts';
import type { AuthorityDeps } from './types.ts';
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


/** BD-A1-35: core owns the descriptions (the two frozen ones and the issuer one); a channel supplies only a closed reason. */
export function invalidBindingBody(result: Extract<PlatformBodyResult, { ok: false }>, channelName: string): never {
  throw new ApiError('INVALID_PLATFORM_VALUES', result.reason === 'origin'
    ? `The URLs must be https and on the ${channelName} site of this connection.`
    : result.reason === 'issuerOrigin'
      ? 'The issuer must have the same https origin as the site URL of this connection.'
      : 'Some values are missing or not valid.', { details: { fields: result.fields } });
}

/**
 * Both authorities suspend atomically and fence the reloaded, disabled connection. `record` runs inside the same
 * transaction (the audit event of the command).
 */
export async function suspendBinding(deps: AuthorityDeps, c: Connection, traceId: string, record?: () => void) {
  const { db, now, logger } = deps;
  transaction(db, () => { disableConnection(db, c.libraryId, c.id, now()); revokeOpenGrants(db, c.id, 'suspend', now()); record?.(); });
  logger.warn('binding_suspended', { trace_id: traceId, connection_id: c.id, note_present: true });
  return deps.cleanup?.fenceOut(getConnection(db, c.libraryId, c.id)!, traceId) ?? [];
}
