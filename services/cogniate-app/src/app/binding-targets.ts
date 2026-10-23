import type { PublicUrls } from '@cogniate/shared';
import { toolContext } from '../kernel/setup/common.ts';
// Provider data of a binding (app contract §4.7.1 "Target", §4.7.3; accepted B-M1-03 design). The provider snapshot is
// taken ONCE, at create, from that request's one GET /api/providers answer. Phase 1 of a redemption builds the target
// from local rows only (the snapshot, or the persisted platform for `add_deployment`) and makes no LTI call; the S1 call
// is built from the committed target after the commit. The adapters build the target and the S1 body; the engine adds
// `active: false` and the write-ahead ref, and owns every other step.
import { fillTemplateValue } from '../kernel/setup/templates.ts';
import type { LtiClient, LtiProviderProfile } from '../clients/lti-client.ts';
import { LtiServiceError } from '../clients/lti-client.ts';
import type { CompleteSnapshot, Connection, ProviderSnapshot } from '../domain/connections.ts';
import type { Db } from '../domain/db.ts';
import { getLibrary } from '../domain/libraries.ts';
import type { BindingTarget, GrantPurpose, PlatformBodyValues, ConnectionSetup, SharedPlatformInfo, StagedCreate } from '../kernel/ports.ts';
import { ApiError } from './api-errors.ts';

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

/** `provider_not_ready` causes (app contract §4.7.3, §12). Operator diagnosis only; never in an answer. */
export type ReadinessCause = 'no_snapshot' | 'platform_inactive' | 'platform_changed' | 'issuer_changed' | 'profile_missing';

/** The canonical issuer of a profile row for one connection: the row issuer, `{siteUrl}` filled with the canonical site. */
const filledIssuer = (row: LtiProviderProfile, c: { siteUrl: string; serviceUrl: string }, clientId: string): string | null =>
  row.issuer === null ? null : fillTemplateValue(row.issuer, { siteUrl: c.siteUrl, serviceUrl: c.serviceUrl, clientId });

/**
 * The snapshot of a new Canvas or Blackboard connection (app contract §4.7.3) from the one providers row that the create
 * handler read: `target_issuer` (Canvas: the row issuer, `{siteUrl}` filled; Blackboard: the row issuer); Blackboard
 * also the active shared platform id and client id.
 */
export function snapshotOf(row: LtiProviderProfile, site: { siteUrl: string; serviceUrl: string }): ProviderSnapshot {
  const shared = activeShared(row);
  return row.sharing === 'shared'
    ? { issuer: row.issuer, platformId: shared?.id ?? null, clientId: shared?.clientId ?? null }
    : { issuer: filledIssuer(row, site, ''), platformId: null, clientId: null };
}

/**
 * Blackboard readiness of a providers answer against the pinned snapshot (V, app contract §4.7.1 row 5; also
 * `app:grant issue`, §4.8): the FIRST matching cause of §4.7.3, in this order, or null when it matches. Another id or
 * client id comes before an inactive platform, so a replaced platform is `platform_changed` also when it is inactive.
 */
export function sharedReadiness(row: LtiProviderProfile | undefined, snap: CompleteSnapshot): Exclude<ReadinessCause, 'no_snapshot'> | null {
  if (!row) return 'profile_missing';
  if (row.sharing !== 'shared') return 'platform_changed';
  if (!row.sharedPlatform) return 'platform_inactive';
  if (row.sharedPlatform.id !== snap.platformId || row.sharedPlatform.clientId !== snap.clientId) return 'platform_changed';
  if (row.issuer !== snap.issuer) return 'issuer_changed';
  if (!row.sharedPlatform.active) return 'platform_inactive';
  return null;
}

/** `app:grant issue` of an exclusive platform (§4.8): the profile row still has the saved issuer (`{siteUrl}` filled). */
export const exclusiveIssuerMatches = (row: LtiProviderProfile | undefined, c: { siteUrl: string; serviceUrl: string }, snap: CompleteSnapshot): boolean =>
  row !== undefined && filledIssuer(row, c, '') === snap.issuer;

/**
 * S1 answers that mean "the provider is not ready" (app contract §4.7.1 S1 row): Canvas `initial` 400 UNKNOWN_PROFILE
 * or 400 PLATFORM_URL_NOT_IN_PROFILE; Blackboard 404 UNREGISTERED_PLATFORM (the pinned platform is gone: ids are never
 * reused). Null for any other answer (the normal LTI-failure mapping).
 */
export function s1ReadinessCause(target: BindingTarget, purpose: GrantPurpose, err: unknown): Exclude<ReadinessCause, 'no_snapshot' | 'platform_inactive'> | null {
  if (!(err instanceof LtiServiceError)) return null;
  if (target.kind === 'exclusive_platform' && purpose === 'initial' && err.status === 400) {
    if (err.code === 'UNKNOWN_PROFILE') return 'profile_missing';
    if (err.code === 'PLATFORM_URL_NOT_IN_PROFILE') return 'issuer_changed';
  }
  if (target.kind === 'shared_deployment' && err.status === 404 && err.code === 'UNREGISTERED_PLATFORM') return 'platform_changed';
  return null;
}

/** The target of a redemption, built from LOCAL rows inside phase 1 (app contract §4.7.1 "Target"). */
export interface LocalTarget {
  target: BindingTarget;
  /** Canonical issuer of the target platform (snapshot `target_issuer`; `add_deployment`: the persisted platform issuer). */
  issuer: string;
  /** Client id of the target (Canvas `initial`: the request; `add_deployment`: the persisted platform; Blackboard: the snapshot). */
  clientId: string;
  /** Product family stored in the connection's platform view (null until the first launch tells it). */
  productFamilyCode: string | null;
}

/**
 * Build the target from local data only (no LTI call). `initial` needs the complete snapshot (phase-1 check 4a has
 * passed); `add_deployment` needs the committed platform. Throws the contract ApiError.
 */
export function localTarget(c: Connection, purpose: GrantPurpose, values: PlatformBodyValues, snapshot: CompleteSnapshot | null, adapter: ConnectionSetup | null): LocalTarget {
  if (c.bindingAuthority !== 'operatorGrant' || !adapter || !adapter.initialTarget || !adapter.createRequest) throw new ApiError('CAPABILITY_NOT_SUPPORTED', 'This connection has no operator approval.', { details: { capability: 'operatorApproval' } });
  const productFamilyCode = c.platform?.productFamilyCode ?? null;
  if (purpose === 'add_deployment') {
    if (!c.ltiPlatformId || !c.platform) throw new ApiError('CONNECTION_NOT_READY');
    return { target: { kind: 'platform_deployment', platformId: c.ltiPlatformId, deploymentId: values.deploymentId }, issuer: c.platform.issuer, clientId: c.platform.clientId, productFamilyCode };
  }
  if (!snapshot) throw new Error('an initial target needs the complete provider snapshot (check 4a)');
  const target = adapter.initialTarget({
    connection: c, values, profile: { id: c.profile, lms: c.channel, issuer: snapshot.issuer },
    sharedPlatform: adapter.sharingOf(c.profile) === 'shared' ? { id: snapshot.platformId!, clientId: snapshot.clientId! } : null,
  });
  const clientId = target.kind === 'shared_deployment' ? snapshot.clientId! : values.clientId;
  return { target, issuer: snapshot.issuer, clientId, productFamilyCode };
}

/** The S1 call of a committed target, built after the phase-1 commit (the engine adds `active: false` and the ref). */
export function stagedCall(deps: { db: Db; lti: LtiClient; urls: PublicUrls }, c: Connection, target: BindingTarget, traceId: string, adapter: ConnectionSetup): (ref: string) => Promise<{ platformId: string }> {
  const staged: StagedCreate = adapter.createRequest!(target, { ...toolContext(deps.urls), libraryName: getLibrary(deps.db, c.libraryId)?.name ?? '' });
  return async (ref) => {
    if (staged.kind === 'platform') {
      if (!('profile' in staged.body)) throw new Error('operator grant create requires a profile');
      const p = await deps.lti.createProviderPlatform({ ...staged.body, active: false, bindingRef: ref }, traceId);
      return { platformId: p.id };
    }
    await deps.lti.addDeployment(staged.platformId, { ...staged.body, active: false, bindingRef: ref }, traceId);
    return { platformId: staged.platformId };
  };
}
