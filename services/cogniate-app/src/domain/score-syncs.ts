// Score sync rows (app contract §10, ADR-010) for the worker. The rows are made by the commit transaction in
// attempts.ts (best-result rule); this repository only reads the due rows and records each send.
import type { SyncRow, SyncStatus } from '@cogniate/tracking';
import { resendDecision, syncResult } from '@cogniate/tracking';
import type { Db } from './db.ts';
import { transaction } from './db.ts';

export interface DueSync {
  id: string;
  resourceLinkId: string;
  userSub: string;
  payload: Record<string, unknown>;
  tries: number;
  createdAt: number;
  /** Start of the 24 h retry window: the resend time of a resent row, else createdAt. */
  retryFrom: number;
  confirmationAfter: number | null;
  /** Moodle's resource link id (for the line item lookup). */
  platformResourceLinkId: string;
  lineItemId: string | null;
  serviceKeyEncrypted: Uint8Array | null;
  /** M1 (app contract §4.7.2): the row belongs to a disabled Canvas or Blackboard connection; nothing is sent. */
  connectionDisabled: boolean;
}

/** A disabled Canvas or Blackboard connection (app contract §4.7.2). Moodle connections are unchanged. */
const DISABLED_PROVIDER = "con.lms IN ('canvas', 'blackboard') AND con.status = 'disabled'";

/** Pending rows whose next try is due, oldest first. */
export function dueSyncs(db: Db, now: number, limit: number): DueSync[] {
  return db.prepare(`SELECT s.id, s.resource_link_id, s.user_sub, s.payload, s.tries, s.created_at, s.resent_at, s.confirmation_after, rl.resource_link_id AS platform_rl, rl.line_item_id,
      rl.service_key_encrypted, CASE WHEN ${DISABLED_PROVIDER} THEN 1 ELSE 0 END AS connection_disabled
    FROM score_sync s JOIN resource_link rl ON rl.id = s.resource_link_id JOIN connection con ON con.id = rl.connection_id
    WHERE s.status = 'pending' AND s.next_try_at <= ? ORDER BY s.next_try_at, s.created_at LIMIT ?`).all(now, limit).map((r) => ({
    id: String(r.id), resourceLinkId: String(r.resource_link_id), userSub: String(r.user_sub), payload: JSON.parse(String(r.payload)) as Record<string, unknown>,
    tries: Number(r.tries), createdAt: Number(r.created_at), retryFrom: r.resent_at === null ? Number(r.created_at) : Number(r.resent_at), platformResourceLinkId: String(r.platform_rl),
    confirmationAfter: r.confirmation_after === null ? null : Number(r.confirmation_after),
    lineItemId: r.line_item_id === null ? null : String(r.line_item_id), serviceKeyEncrypted: r.service_key_encrypted === null ? null : (r.service_key_encrypted as Uint8Array),
    connectionDisabled: Number(r.connection_disabled) === 1,
  }));
}

/**
 * App contract §4.7.2: a due row of a disabled Canvas or Blackboard connection becomes `failed` with lastError
 * CONNECTION_DISABLED, tries unchanged, and no POST. Returns true when the row changed.
 */
export function failDisabledSync(db: Db, id: string, now: number): boolean {
  return db.prepare(`UPDATE score_sync SET status = 'failed', next_try_at = NULL, last_error = 'CONNECTION_DISABLED', updated_at = ?
    WHERE id = ? AND status = 'pending'`).run(now, id).changes > 0;
}

/** True when the connection of a score sync row (or of a publication) is a disabled Canvas or Blackboard connection. */
export function syncConnectionDisabled(db: Db, syncId: string): boolean {
  return db.prepare(`SELECT 1 FROM score_sync s JOIN resource_link rl ON rl.id = s.resource_link_id JOIN connection con ON con.id = rl.connection_id
    WHERE s.id = ? AND ${DISABLED_PROVIDER}`).get(syncId) !== undefined;
}

/** Recheck after every await: a due-row snapshot may already be superseded. */
export function isCurrentSync(db: Db, id: string): boolean {
  return db.prepare(`SELECT s.id FROM score_sync s WHERE s.id = ? AND s.status = 'pending'
    AND NOT EXISTS (SELECT 1 FROM score_sync other WHERE other.resource_link_id = s.resource_link_id AND other.user_sub = s.user_sub
      AND other.status <> 'superseded' AND other.score_given / other.score_maximum > s.score_given / s.score_maximum)
    AND NOT EXISTS (SELECT 1 FROM attempt a WHERE a.resource_link_id = s.resource_link_id AND a.user_sub = s.user_sub AND a.preview = 0
      AND a.outcome IN ('completed', 'passed', 'failed') AND CAST(a.score_given AS REAL) / a.score_maximum > s.score_given / s.score_maximum)`).get(id) !== undefined;
}

/** Uncertainty stays on its source row until an accepted confirmation covers it, even after an ordinary 204.
 * This also transfers the requirement across versions and further supersessions without copying flags between rows.
 */
function needsConfirmation(db: Db, id: string): boolean {
  return db.prepare(`SELECT s.id FROM score_sync s JOIN score_sync old ON old.resource_link_id = s.resource_link_id AND old.user_sub = s.user_sub
    WHERE s.id = ? AND old.delivery_uncertain = 1 AND old.score_given / old.score_maximum < s.score_given / s.score_maximum LIMIT 1`).get(id) !== undefined;
}

/** Durable before the POST: an unresolved marker on startup means delivery is uncertain. */
export function beginSend(db: Db, id: string, now: number): boolean {
  if (!isCurrentSync(db, id)) return false;
  return db.prepare(`UPDATE score_sync SET send_started_at = ?, tries = tries + 1, updated_at = ?
    WHERE id = ? AND status = 'pending' AND send_started_at IS NULL AND next_try_at <= ?
      AND COALESCE(resent_at, created_at) + 86400000 >= ?`).run(now, now, id, now, now).changes > 0;
}

/** Startup only. An interrupted confirmation keeps its phase and its original retry window. */
export function recoverInterruptedSends(db: Db, now: number): void {
  transaction(db, () => {
    for (const row of db.prepare('SELECT id, status, tries, created_at, resent_at FROM score_sync WHERE send_started_at IS NOT NULL').all()) {
      db.prepare('UPDATE score_sync SET delivery_uncertain = 1, send_started_at = NULL WHERE id = ?').run(String(row.id));
      if (row.status !== 'pending') continue;
      const result = syncResult({ http: 0 }, Number(row.tries), Number(row.resent_at ?? row.created_at), now);
      db.prepare('UPDATE score_sync SET status = ?, next_try_at = ?, last_error = ?, updated_at = ? WHERE id = ?')
        .run(result.status, result.nextTryAt, 'The score send was interrupted. Moodle may have received it.', now, String(row.id));
    }
  });
}

/** Record the persisted status, including the bounded confirmation policy (ADR-010 rule 5). */
export function recordSend(db: Db, row: DueSync, r: { status: SyncStatus; nextTryAt: number | null; lastError: string | null; uncertain: boolean }, now: number): SyncStatus {
  return transaction(db, () => {
    db.prepare(`UPDATE score_sync SET send_started_at = NULL, delivery_uncertain = MAX(delivery_uncertain, ?) WHERE id = ?`)
      .run(r.uncertain ? 1 : 0, row.id);
    if (!isCurrentSync(db, row.id)) {
      db.prepare("UPDATE score_sync SET status = 'superseded', next_try_at = NULL, updated_at = ? WHERE id = ? AND status = 'pending'").run(now, row.id);
      return db.prepare('SELECT status FROM score_sync WHERE id = ?').get(row.id)!.status as SyncStatus;
    }
    let { status, nextTryAt, lastError } = r;
    if (status === 'sent' && row.confirmationAfter === null && needsConfirmation(db, row.id)) {
      nextTryAt = now + 5000;
      if (nextTryAt > row.retryFrom + 24 * 3_600_000) {
        status = 'failed';
        lastError = 'The score confirmation could not finish within the retry window.';
      } else {
        status = 'pending';
        db.prepare('UPDATE score_sync SET confirmation_after = ? WHERE id = ?').run(nextTryAt, row.id);
      }
    } else if (status === 'sent' && row.confirmationAfter !== null) {
      // Only a successful confirmation consumes uncertainty. An ordinary successful retry cannot do this.
      db.prepare(`UPDATE score_sync SET delivery_uncertain = 0 WHERE resource_link_id = ? AND user_sub = ?
        AND score_given / score_maximum <= (SELECT score_given / score_maximum FROM score_sync WHERE id = ?)`)
        .run(row.resourceLinkId, row.userSub, row.id);
    }
    db.prepare(`UPDATE score_sync SET status = ?, next_try_at = ?, last_error = ?, sent_at = CASE WHEN ? = 'sent' THEN ? ELSE sent_at END,
      updated_at = ? WHERE id = ?`).run(status, status === 'pending' ? nextTryAt : null, status === 'sent' ? null : lastError, status, now, now, row.id);
    return status;
  });
}

/** ADR-010 rule 1: keep the line item found by the lookup for later rows of the same activity. */
export function setLineItem(db: Db, resourceLinkId: string, lineItemId: string): void {
  db.prepare('UPDATE resource_link SET line_item_id = ? WHERE id = ? AND line_item_id IS NULL').run(lineItemId, resourceLinkId);
}

/** The newest row of a learner and activity (the shell status line), or null. */
export function latestSyncStatus(db: Db, resourceLinkId: string, userSub: string): { status: SyncStatus; scoreGiven: number; scoreMaximum: number } | null {
  const r = db.prepare('SELECT status, score_given, score_maximum FROM score_sync WHERE resource_link_id = ? AND user_sub = ? ORDER BY created_at DESC, rowid DESC LIMIT 1').get(resourceLinkId, userSub);
  return r ? { status: r.status as SyncStatus, scoreGiven: Number(r.score_given), scoreMaximum: Number(r.score_maximum) } : null;
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
      AND outcome IN ('completed', 'passed', 'failed') AND score_given IS NOT NULL ORDER BY CAST(score_given AS REAL) / score_maximum DESC LIMIT 1`)
    .get(String(r.resource_link_id), String(r.user_sub));
  const decision = resendDecision(toRow(r), others, best ? { scoreGiven: Number(best.score_given), scoreMaximum: Number(best.score_maximum) } : null);
  if (!decision.ok) {
    const description = decision.reason === 'status' ? 'Only a failed or conflict score sync can be sent again.'
      : decision.reason === 'not_best' ? 'This learner has a better result. Resend the better result instead.'
        : 'An equal result of this learner is already sent or pending.';
    return { ok: false, reason: 'not_resendable', description };
  }
  db.prepare(`UPDATE score_sync SET status = 'pending', tries = 0, next_try_at = ?, last_error = NULL, resent_at = ?, updated_at = ?,
    confirmation_after = NULL WHERE id = ?`).run(now, now, now, syncId);
  return { ok: true };
}

/** True when the score sync row belongs to a connection of this library. */
export function syncRowInLibrary(db: Db, libraryId: string, syncId: string): boolean {
  return db.prepare(`SELECT 1 FROM score_sync s JOIN resource_link rl ON rl.id = s.resource_link_id JOIN connection con ON con.id = rl.connection_id
    WHERE s.id = ? AND con.library_id = ?`).get(syncId, libraryId) !== undefined;
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
