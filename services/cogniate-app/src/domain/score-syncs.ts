// Score sync rows (app contract §10, ADR-010) for the worker. The rows are made by the commit transaction in
// attempts.ts (best-result rule); this repository only reads the due rows and records each send.
import type { SyncStatus } from '@cogniate/tracking';
import type { Db } from './db.ts';

export interface DueSync {
  id: string;
  resourceLinkId: string;
  userSub: string;
  payload: Record<string, unknown>;
  tries: number;
  createdAt: number;
  /** Moodle's resource link id (for the line item lookup). */
  platformResourceLinkId: string;
  lineItemId: string | null;
  serviceKeyEncrypted: Uint8Array | null;
}

/** Pending rows whose next try is due, oldest first. */
export function dueSyncs(db: Db, now: number, limit: number): DueSync[] {
  return db.prepare(`SELECT s.id, s.resource_link_id, s.user_sub, s.payload, s.tries, s.created_at, rl.resource_link_id AS platform_rl, rl.line_item_id,
      rl.service_key_encrypted FROM score_sync s JOIN resource_link rl ON rl.id = s.resource_link_id
    WHERE s.status = 'pending' AND s.next_try_at <= ? ORDER BY s.next_try_at, s.created_at LIMIT ?`).all(now, limit).map((r) => ({
    id: String(r.id), resourceLinkId: String(r.resource_link_id), userSub: String(r.user_sub), payload: JSON.parse(String(r.payload)) as Record<string, unknown>,
    tries: Number(r.tries), createdAt: Number(r.created_at), platformResourceLinkId: String(r.platform_rl),
    lineItemId: r.line_item_id === null ? null : String(r.line_item_id), serviceKeyEncrypted: r.service_key_encrypted === null ? null : (r.service_key_encrypted as Uint8Array),
  }));
}

/** Record one send. `nextTryAt` only for a row that stays pending. lastError is short and safe (no token, no key). */
export function recordSend(db: Db, id: string, r: { status: SyncStatus; tries: number; nextTryAt: number | null; lastError: string | null }, now: number): void {
  db.prepare(`UPDATE score_sync SET status = ?, tries = ?, next_try_at = ?, last_error = ?, sent_at = CASE WHEN ? = 'sent' THEN ? ELSE sent_at END,
    updated_at = ? WHERE id = ?`).run(r.status, r.tries, r.status === 'pending' ? r.nextTryAt : null, r.lastError, r.status, now, now, id);
}

/** ADR-010 rule 1: keep the line item found by the lookup for later rows of the same activity. */
export function setLineItem(db: Db, resourceLinkId: string, lineItemId: string): void {
  db.prepare('UPDATE resource_link SET line_item_id = ? WHERE id = ? AND line_item_id IS NULL').run(lineItemId, resourceLinkId);
}

/** The newest row of a learner and activity (the shell status line), or null. */
export function latestSyncStatus(db: Db, resourceLinkId: string, userSub: string): SyncStatus | null {
  const r = db.prepare('SELECT status FROM score_sync WHERE resource_link_id = ? AND user_sub = ? ORDER BY created_at DESC, rowid DESC LIMIT 1').get(resourceLinkId, userSub);
  return r ? (r.status as SyncStatus) : null;
}
