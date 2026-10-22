// Service key of a launch (contract §3.3): a domain rule, used by GET /api/idtoken (B-T3a-01: not in a route file).
import type { Db } from '../db/index.ts';
import type { LaunchRecord } from '../store/launches.ts';
import { issueServiceKey } from '../store/service-keys.ts';
import { CLAIM } from './checks.ts';

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null);

/**
 * The service key of a launch when AGS or NRPS is available and the launch has a context and a resource link (a
 * deep-linking launch has none: no key). The same activity gives the same key; re-issuing refreshes the stored claims.
 */
export function serviceKeyForLaunch(db: Db, masterKey: Buffer, launch: LaunchRecord, now: number): string | undefined {
  const ags = obj(launch.claims[CLAIM.ags]);
  const nrps = obj(launch.claims[CLAIM.nrps]);
  const contextId = obj(launch.claims[CLAIM.context])?.id;
  const resourceLinkId = obj(launch.claims[CLAIM.resourceLink])?.id;
  if ((!ags && !nrps) || typeof contextId !== 'string' || typeof resourceLinkId !== 'string') return undefined;
  const issued = issueServiceKey(db, masterKey, {
    toolAccountId: launch.toolAccountId, platformId: launch.platformId, deploymentId: launch.deploymentId, contextId, resourceLinkId,
    agsClaim: ags, nrpsClaim: nrps, bindingGeneration: launch.bindingGeneration,
  }, now);
  return issued.serviceKey;
}
