// Score sync rows (app contract §10, ADR-010) for the worker. The rows are made by the commit transaction in
// attempts.ts (best-result rule); this repository only reads the due rows and records each send.
import type { SyncRow, SyncStatus } from '@cogniate/tracking';
import { resendDecision } from '@cogniate/tracking';
import type { Db } from './db.ts';

export interface DueSync {
  id: string;
  resourceLinkId: string;
  userSub: string;
  payload: Record<string, unknown>;
  tries: number;
  createdAt: number;
  /** Start of the 24 h retry window: the resend time of a resent row, else createdAt. */
  retryFrom: number;
  /** Moodle's resource link id (for the line item lookup). */
  platformResourceLinkId: string;
  lineItemId: string | null;
  serviceKeyEncrypted: Uint8Array | null;
}

/** Pending rows whose next try is due, oldest first. */
export function dueSyncs(db: Db, now: number, limit: number): DueSync[] {
  return db.prepare(`SELECT s.id, s.resource_link_id, s.user_sub, s.payload, s.tries, s.created_at, s.resent_at, rl.resource_link_id AS platform_rl, rl.line_item_id,
      rl.service_key_encrypted FROM score_sync s JOIN resource_link rl ON rl.id = s.resource_link_id
    WHERE s.status = 'pending' AND s.next_try_at <= ? ORDER BY s.next_try_at, s.created_at LIMIT ?`).all(now, limit).map((r) => ({
    id: String(r.id), resourceLinkId: String(r.resource_link_id), userSub: String(r.user_sub), payload: JSON.parse(String(r.payload)) as Record<string, unknown>,
    tries: Number(r.tries), createdAt: Number(r.created_at), retryFrom: r.resent_at === null ? Number(r.created_at) : Number(r.resent_at), platformResourceLinkId: String(r.platform_rl),
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

export type ResendResult = { ok: true } | { ok: false; reason: 'not_found' | 'not_resendable'; description: string };

/**
 * Resend (app contract §5, ADR-010 rule 10): only a `failed` or `conflict` row, back to `pending` with tries = 0 and
 * a new 24 h retry window. Only the learner's best result is ever sent (A-T5b-02, tracking resendDecision): refused
 * when another row that is not superseded, or a final attempt of that learner and activity, has a higher score.
 */
export function resendSync(db: Db, libraryId: string, syncId: string, now: number): ResendResult {
  const r = db.prepare(`SELECT s.id, s.status, s.resource_link_id, s.user_sub, s.score_given, s.score_maximum FROM score_sync s
    JOIN resource_link rl ON rl.id = s.resource_link_id JOIN connection con ON con.id = rl.connection_id
    WHERE s.id = ? AND con.library_id = ?`).get(syncId, libraryId);
  if (!r) return { ok: false, reason: 'not_found', description: 'The score sync does not exist in your library.' };
  const toRow = (x: Record<string, unknown>): SyncRow => ({ id: String(x.id), status: x.status as SyncStatus, scoreGiven: Number(x.score_given), scoreMaximum: Number(x.score_maximum) });
  const others = db.prepare('SELECT id, status, score_given, score_maximum FROM score_sync WHERE resource_link_id = ? AND user_sub = ?')
    .all(String(r.resource_link_id), String(r.user_sub)).map(toRow);
  const best = db.prepare(`SELECT score_given, score_maximum FROM attempt WHERE resource_link_id = ? AND user_sub = ? AND preview = 0
      AND outcome IN ('completed', 'passed', 'failed') AND score_given IS NOT NULL ORDER BY score_given / score_maximum DESC LIMIT 1`)
    .get(String(r.resource_link_id), String(r.user_sub));
  const decision = resendDecision(toRow(r), others, best ? { scoreGiven: Number(best.score_given), scoreMaximum: Number(best.score_maximum) } : null);
  if (!decision.ok) {
    const description = decision.reason === 'status' ? 'Only a failed or conflict score sync can be sent again.'
      : decision.reason === 'not_best' ? 'This learner has a better result. Resend the better result instead.'
        : 'An equal result of this learner is already sent or pending.';
    return { ok: false, reason: 'not_resendable', description };
  }
  db.prepare(`UPDATE score_sync SET status = 'pending', tries = 0, next_try_at = ?, last_error = NULL, resent_at = ?, updated_at = ? WHERE id = ?`).run(now, now, now, syncId);
  return { ok: true };
}

/** A score sync row as the results API shows it. */
export function syncRow(db: Db, syncId: string) {
  const s = db.prepare('SELECT * FROM score_sync WHERE id = ?').get(syncId)!;
  const iso = (v: unknown) => (v === null ? null : new Date(Number(v)).toISOString());
  return {
    id: String(s.id), status: String(s.status), tries: Number(s.tries), scoreGiven: Number(s.score_given), scoreMaximum: Number(s.score_maximum),
    createdAt: iso(s.created_at), sentAt: iso(s.sent_at), lastError: s.last_error === null ? null : String(s.last_error),
  };
}

/** Learner + activity pairs of a publication's attempts (not previews), with what a results read needs. */
export function gradebookTargets(db: Db, connectionId: string, courseId: string) {
  return db.prepare(`SELECT DISTINCT rl.id AS rl_id, rl.resource_link_id AS platform_rl, rl.line_item_id, rl.service_key_encrypted, a.user_sub
    FROM attempt a JOIN course_version v ON v.id = a.course_version_id JOIN resource_link rl ON rl.id = a.resource_link_id
    WHERE rl.connection_id = ? AND v.course_id = ? AND a.preview = 0`).all(connectionId, courseId).map((r) => ({
    resourceLinkId: String(r.rl_id), platformResourceLinkId: String(r.platform_rl), lineItemId: r.line_item_id === null ? null : String(r.line_item_id),
    serviceKeyEncrypted: r.service_key_encrypted === null ? null : (r.service_key_encrypted as Uint8Array), userSub: String(r.user_sub),
  }));
}

export function saveGradebookRead(db: Db, resourceLinkId: string, userSub: string, result: { resultScore: number | null; resultMaximum: number | null }, now: number): void {
  db.prepare(`INSERT INTO gradebook_read (resource_link_id, user_sub, result_score, result_maximum, read_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (resource_link_id, user_sub) DO UPDATE SET result_score = excluded.result_score, result_maximum = excluded.result_maximum, read_at = excluded.read_at`)
    .run(resourceLinkId, userSub, result.resultScore, result.resultMaximum, now);
}
