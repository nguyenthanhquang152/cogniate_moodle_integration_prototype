// The lti-ags fairness key (LA-ADR-03 D5, D7 "Fairness"): the LTI platform of the placement, because the platform
// sets the rate limit. A shared platform (one Learn host for many schools) uses platform id + ':' + deployment id,
// so one slow school does not hold the others. Migration 014 gives the copied rows the same values.
import type { Db } from '../../domain/db.ts';

/** Total even after a shared connection was released (LA-ADR-04 D5): the last fallback is the connection id. */
export function platformPartition(db: Db, placementId: string): string {
  return String(db.prepare(`SELECT COALESCE(c.lti_platform_id,
    (SELECT ad.lti_platform_id || ':' || ad.deployment_id FROM connection_deployment ad
      WHERE ad.connection_id = c.id),
    c.target_platform_id || ':' || rl.deployment_id, c.id) AS partition_key
    FROM placement p JOIN connection c ON c.id = p.connection_id JOIN resource_link rl ON rl.id = p.id WHERE p.id = ?`).get(placementId)!.partition_key);
}
