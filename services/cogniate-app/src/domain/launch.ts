// Launch data (data-model §2, security §4): the handoff (single use of a ltik) and resource links. Attempts and play
// sessions are in attempts.ts (the content host may import only domain/attempts*, ADR-008). Repository: the only SQL
// for these tables. A launch finds its connection through the platform id, so these functions take the connection id
// (and through it the library), never a session user.
import { randomId } from '@cogniate/shared';
import type { Db } from './db.ts';
import { transaction } from './db.ts';
import { upsertPlacement } from '../kernel/records/placements.ts';

/** Security §4 "single use": true for the first use of this ltik hash, false for every later one. */
export function useHandoff(db: Db, ltikHash: string, now: number): boolean {
  return Number(db.prepare('INSERT OR IGNORE INTO handoff (ltik_hash, used_at) VALUES (?, ?)').run(ltikHash, now).changes) === 1;
}

/** A publication as a launch sees it: of this connection (any status), with its course and current version. */
export interface LaunchPublication {
  id: string;
  connectionId: string;
  courseId: string;
  courseTitle: string;
  currentVersionId: string;
  status: 'available' | 'withdrawn';
}

/** The publication only if it belongs to this connection (and both are in the same library). */
export function publicationOfConnection(db: Db, connectionId: string, publicationId: string): LaunchPublication | undefined {
  const r = db.prepare(`SELECT p.id, p.connection_id, p.course_id, p.current_version_id, p.status, c.title AS course_title
    FROM publication p JOIN connection con ON con.id = p.connection_id JOIN course c ON c.id = p.course_id
    WHERE p.id = ? AND p.connection_id = ? AND c.library_id = con.library_id`).get(publicationId, connectionId);
  if (!r) return undefined;
  return {
    id: String(r.id), connectionId: String(r.connection_id), courseId: String(r.course_id), courseTitle: String(r.course_title),
    currentVersionId: String(r.current_version_id), status: r.status as LaunchPublication['status'],
  };
}

export interface ResourceLinkInput {
  connectionId: string;
  publicationId: string;
  deploymentId: string;
  contextId: string;
  resourceLinkId: string;
  contextTitle: string;
  title: string;
  lineItemId: string | null;
  serviceKeyEncrypted: Uint8Array | null;
}

export interface ResourceLinkResult {
  id: string;
  created: boolean;
  /** Set when a later signed target named another publication of the same connection (resource_link_rebound). */
  rebound: { from: string; to: string } | null;
}

/**
 * Upsert by the resource link key (connection, deployment, context, resource link). The publication always comes from
 * the signed target: another publication of the same connection rebinds the row (the teacher selected new content).
 * Titles, line item and service key are refreshed on every launch.
 */
export function upsertResourceLink(db: Db, input: ResourceLinkInput, now: number): ResourceLinkResult {
  return transaction(db, () => {
    const existing = db.prepare('SELECT id, publication_id FROM resource_link WHERE connection_id = ? AND deployment_id = ? AND context_id = ? AND resource_link_id = ?')
      .get(input.connectionId, input.deploymentId, input.contextId, input.resourceLinkId);
    if (!existing) {
      const id = randomId('rl_');
      db.prepare(`INSERT INTO resource_link (id, connection_id, publication_id, deployment_id, context_id, resource_link_id, context_title, title,
        line_item_id, service_key_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, input.connectionId, input.publicationId, input.deploymentId, input.contextId, input.resourceLinkId, input.contextTitle, input.title,
          input.lineItemId, input.serviceKeyEncrypted, now, now);
      upsertPlacement(db, id);
      return { id, created: true, rebound: null };
    }
    const id = String(existing.id);
    const from = String(existing.publication_id);
    db.prepare(`UPDATE resource_link SET publication_id = ?, context_title = ?, title = ?, line_item_id = COALESCE(?, line_item_id),
      service_key_encrypted = COALESCE(?, service_key_encrypted), updated_at = ? WHERE id = ?`)
      .run(input.publicationId, input.contextTitle, input.title, input.lineItemId, input.serviceKeyEncrypted, now, id);
    upsertPlacement(db, id);
    return { id, created: false, rebound: from === input.publicationId ? null : { from, to: input.publicationId } };
  });
}

/**
 * Publication stats that T4b2 can count (app contract §5): activities = resource links bound to the publication plus
 * picks not yet seen in a launch; learners = distinct non-preview users with an attempt on this course through this
 * connection. Outcome counts and lastScoreSync come with T5a.
 */
export function launchStats(db: Db, p: { id: string; connectionId: string; courseId: string }): { activities: number; learners: number } {
  const links = Number(db.prepare('SELECT COUNT(*) AS n FROM resource_link WHERE publication_id = ?').get(p.id)?.n ?? 0);
  const picks = Number(db.prepare('SELECT COUNT(*) AS n FROM picker_session WHERE publication_id = ? AND used_at IS NOT NULL AND resource_link_id IS NULL').get(p.id)?.n ?? 0);
  const learners = Number(db.prepare(`SELECT COUNT(DISTINCT a.user_sub) AS n FROM attempt a JOIN course_version v ON v.id = a.course_version_id
    JOIN resource_link rl ON rl.id = a.resource_link_id WHERE rl.connection_id = ? AND v.course_id = ? AND a.preview = 0`).get(p.connectionId, p.courseId)?.n ?? 0);
  return { activities: links + picks, learners };
}
