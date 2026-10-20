// The target of a redemption (app contract §4.7.1 "Target"), resolved from the connection, its provider adapter and the
// provider profiles of the LTI service. The adapters build the target and the S1 body; the engine adds `active: false`
// and the write-ahead ref, and owns every other step.
import { fillTemplateValue } from '../providers/templates.ts';
import type { LtiClient, LtiProviderProfile } from '../clients/lti-client.ts';
import { LtiServiceError } from '../clients/lti-client.ts';
import type { Connection } from '../domain/connections.ts';
import type { Db } from '../domain/db.ts';
import { getLibrary } from '../domain/libraries.ts';
import { providerOf } from '../providers/index.ts';
import type { BindingTarget, GrantPurpose, PlatformBodyValues, SharedPlatformInfo, StagedCreate } from '../providers/types.ts';
import { ApiError } from './api-errors.ts';
import type { RedemptionTarget } from './redemption.ts';

/** GET /api/providers through the app (502 LTI_SERVICE_ERROR on failure, app contract §4.3). */
export async function providerProfiles(lti: LtiClient, traceId: string): Promise<LtiProviderProfile[]> {
  try {
    return await lti.getProviders(traceId);
  } catch (err) {
    if (err instanceof LtiServiceError) throw new ApiError('LTI_SERVICE_ERROR', `The LTI service answered ${err.status || 'nothing'} (${err.code}). Trace id: ${traceId}`);
    throw err;
  }
}

/** The active shared platform of a shared profile, else null. */
export const activeShared = (p: LtiProviderProfile | undefined): SharedPlatformInfo | null =>
  p && p.sharing === 'shared' && p.sharedPlatform && p.sharedPlatform.active ? p.sharedPlatform : null;

export function createTargetResolver(deps: { db: Db; lti: LtiClient }) {
  return async (c: Connection, purpose: GrantPurpose, values: PlatformBodyValues, traceId: string): Promise<RedemptionTarget> => {
    const adapter = providerOf(c.lms);
    if (!adapter || !adapter.initialTarget || !adapter.createRequest) throw new ApiError('CAPABILITY_NOT_SUPPORTED', 'This connection has no operator approval.', { details: { capability: 'operatorApproval' } });
    const profiles = await providerProfiles(deps.lti, traceId);
    const profile = profiles.find((p) => p.id === c.profile);
    if (!profile) throw new ApiError('PROVIDER_NOT_READY');
    const sharedPlatform = activeShared(profile);
    if (profile.sharing === 'shared' && !sharedPlatform) throw new ApiError('PROVIDER_NOT_READY');
    let target: BindingTarget;
    if (purpose === 'add_deployment') {
      if (!c.ltiPlatformId || !c.platform) throw new ApiError('CONNECTION_NOT_READY');
      target = { kind: 'platform_deployment', platformId: c.ltiPlatformId, deploymentId: values.deploymentId };
    } else {
      target = adapter.initialTarget({ connection: c, values, profile, sharedPlatform });
    }
    const libraryName = getLibrary(deps.db, c.libraryId)?.name ?? '';
    const staged: StagedCreate = adapter.createRequest(target, { libraryName });
    const create = async (ref: string): Promise<{ platformId: string }> => {
      if (staged.kind === 'platform') {
        const p = await deps.lti.createProviderPlatform({ ...staged.body, active: false, bindingRef: ref }, traceId);
        return { platformId: p.id };
      }
      await deps.lti.addDeployment(staged.platformId, { ...staged.body, active: false, bindingRef: ref }, traceId);
      return { platformId: staged.platformId };
    };
    const issuer = target.kind === 'exclusive_platform' ? target.issuer
      : target.kind === 'platform_deployment' ? c.platform!.issuer
      : fillTemplateValue(profile.issuer ?? '', { siteUrl: c.siteUrl, serviceUrl: c.serviceUrl, clientId: sharedPlatform?.clientId ?? '' });
    const clientId = target.kind === 'exclusive_platform' ? target.clientId : target.kind === 'platform_deployment' ? c.platform!.clientId : sharedPlatform!.clientId;
    return { target, create, issuer, clientId, productFamilyCode: c.platform?.productFamilyCode ?? null };
  };
}
