import type { Db } from '../../domain/db.ts';

/** LTI natural key. JSON.stringify uses the same string escaping as SQLite json_array. */
export function externalKey(deploymentId: string, contextId: string, resourceLinkId: string): string {
  return JSON.stringify([deploymentId, contextId, resourceLinkId]);
}

/** Called in the launch transaction, after the resource link write. Always upsert on the stable id. */
export function upsertPlacement(db: Db, id: string): void {
  const row = db.prepare('SELECT * FROM resource_link WHERE id = ?').get(id)!;
  db.prepare(`INSERT INTO placement (id, connection_id, publication_id, external_key, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET publication_id = excluded.publication_id,
      external_key = excluded.external_key, updated_at = excluded.updated_at`)
    .run(id, String(row.connection_id), String(row.publication_id),
      externalKey(String(row.deployment_id), String(row.context_id), String(row.resource_link_id)), Number(row.created_at), Number(row.updated_at));
}

/** Total even after a shared connection was released (LA-ADR-04 D5). */
export function placementPartition(db: Db, id: string): string {
  return String(db.prepare(`SELECT COALESCE(c.lti_platform_id,
    (SELECT ad.lti_platform_id || ':' || ad.deployment_id FROM connection_deployment ad
      WHERE ad.connection_id = c.id),
    c.target_platform_id || ':' || rl.deployment_id, c.id) AS partition_key
    FROM placement p JOIN connection c ON c.id = p.connection_id JOIN resource_link rl ON rl.id = p.id WHERE p.id = ?`).get(id)!.partition_key);
}
