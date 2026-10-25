import { storeFor } from '../store/index.ts';
// Service key of a launch (contract §3.3): a domain rule, used by GET /api/idtoken (B-T3a-01: not in a route file).
import type { StoreSource as Db } from '../store/index.ts';
import type { LaunchRecord } from '../store/launches.ts';
import { CLAIM } from './checks.ts';

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null);

/**
 * The service key of a launch when AGS or NRPS is available and the launch has a resource link (a deep-linking launch
 * has none: no key). The same activity gives the same key; re-issuing refreshes the stored claims.
 * LA-ADR-05 D2: a launch without a context uses context id "" in the scope. A resource link id is unique in its
 * deployment (LTI Core §5.3.5), so the scope still names one activity. "No context" is the same rule as
 * GET /api/idtoken: the claim is not an object, so launch.context is absent there too. A context object without a
 * string id still gives no key.
 */
export async function serviceKeyForLaunch(db: Db, masterKey: Buffer, launch: LaunchRecord, now: number): Promise<string | undefined> {
  const ags = obj(launch.claims[CLAIM.ags]);
  const nrps = obj(launch.claims[CLAIM.nrps]);
  const context = obj(launch.claims[CLAIM.context]);
  const contextId = context ? context.id : '';
  const resourceLinkId = obj(launch.claims[CLAIM.resourceLink])?.id;
  if ((!ags && !nrps) || typeof contextId !== 'string' || typeof resourceLinkId !== 'string') return undefined;
  const issued = (await storeFor(db).serviceKeys.issueServiceKey(masterKey, {
    toolAccountId: launch.toolAccountId, platformId: launch.platformId, deploymentId: launch.deploymentId, contextId, resourceLinkId,
    agsClaim: ags, nrpsClaim: nrps, bindingGeneration: launch.bindingGeneration,
  }, now));
  return issued.serviceKey;
}
