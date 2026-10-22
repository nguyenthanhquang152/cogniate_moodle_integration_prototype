// Delivery state and best-result policy for the neutral outbox.
import type { SyncRow, SyncStatus } from '@cogniate/tracking';
import { resendDecision } from '@cogniate/tracking';
import type { Db } from '../../domain/db.ts';
import { transaction } from '../../domain/db.ts';
import type { DispatchView } from './types.ts';

export function ownsDispatch(db: Db, id: string, owner: string): boolean {
  return db.prepare('SELECT 1 FROM record_dispatch WHERE id = ? AND lease_owner = ?').get(id, owner) !== undefined;
}

/** Recheck operator-grant authority at each send decision, including after a line-item lookup. */
const DISABLED_PROVIDER = "con.binding_authority = 'operatorGrant' AND con.status = 'disabled'";

/**
 * App contract §4.7.2: a pending row whose connection is NOW a disabled operator-grant connection becomes
 * `failed` with lastError CONNECTION_DISABLED, tries unchanged, and no POST. One statement: the connection state is
 * read when the row changes. Returns true when the row changed (false: not disabled, or the row is not pending).
 */
export function failDisabledSync(db: Db, id: string, now: number, owner: string): boolean {
  return db.prepare(`UPDATE record_dispatch SET status = 'failed', next_try_at = NULL, last_error = 'CONNECTION_DISABLED', updated_at = ?
    WHERE id = ? AND lease_owner = ? AND status = 'pending' AND EXISTS (SELECT 1 FROM resource_link rl JOIN connection con ON con.id = rl.connection_id
      WHERE rl.id = record_dispatch.placement_id AND ${DISABLED_PROVIDER})`).run(now, id, owner).changes > 0;
}

/** True when the connection of a score sync row (or of a publication) is a disabled operator-grant connection. */
export function syncConnectionDisabled(db: Db, syncId: string): boolean {
  return db.prepare(`SELECT 1 FROM record_dispatch s JOIN resource_link rl ON rl.id = s.placement_id JOIN connection con ON con.id = rl.connection_id
    WHERE s.id = ? AND s.reporter = 'lti-ags' AND ${DISABLED_PROVIDER}`).get(syncId) !== undefined;
}

/** Recheck after every await: a due-row snapshot may already be superseded. */
export function isCurrentSync(db: Db, id: string): boolean {
  return db.prepare(`SELECT s.id FROM record_dispatch s WHERE s.id = ? AND s.status = 'pending'
    AND NOT EXISTS (SELECT 1 FROM record_dispatch other WHERE other.placement_id = s.placement_id AND other.learner_subject = s.learner_subject AND other.reporter = s.reporter
      AND other.status <> 'superseded' AND other.score_given / other.score_maximum > s.score_given / s.score_maximum)
    AND NOT EXISTS (SELECT 1 FROM attempt a WHERE a.resource_link_id = s.placement_id AND a.user_sub = s.learner_subject AND a.preview = 0
      AND a.outcome IN ('completed', 'passed', 'failed') AND CAST(a.score_given AS REAL) / a.score_maximum > s.score_given / s.score_maximum)`).get(id) !== undefined;
}

/** Uncertainty stays on its source row until an accepted confirmation covers it, even after an ordinary 204.
 * This also transfers the requirement across versions and further supersessions without copying flags between rows.
 */
function needsConfirmation(db: Db, id: string): boolean {
  return db.prepare(`SELECT s.id FROM record_dispatch s JOIN record_dispatch old ON old.placement_id = s.placement_id AND old.learner_subject = s.learner_subject AND old.reporter = s.reporter
    WHERE s.id = ? AND (old.delivery_uncertain = 1 OR (old.status = 'superseded' AND old.send_started_at IS NOT NULL)) AND old.score_given / old.score_maximum < s.score_given / s.score_maximum LIMIT 1`).get(id) !== undefined;
}

/**
 * SQL condition: the partition of the row `alias` has a running 429 pause (LA-ADR-03 D7 "429"), that is, one of its
 * pending rows has a `not_before` after now (one `?`). Only pending rows carry a pause, so the `record_dispatch_due`
 * index (status, next_try_at, partition_key) serves the check: the plan is "SEARCH paused USING INDEX
 * record_dispatch_due (status=?)", not a scan of every row ever written (rows are never deleted). A new row takes
 * over the pause of its partition when it is created (`writeFinalRecord`), so a superseded row does not end it.
 */
export const partitionPaused = (alias: string): string => `EXISTS (SELECT 1 FROM record_dispatch paused
  WHERE paused.status = 'pending' AND paused.partition_key = ${alias}.partition_key AND paused.not_before > ?)`;

/** `started`: send the POST now. `skipped`: send nothing (superseded, changed or not due). `connection_disabled`: failed now. */
export type BeginSend = 'started' | 'skipped' | 'connection_disabled';

/**
 * Durable before the POST: an unresolved marker on startup means delivery is uncertain. One BEGIN IMMEDIATE
 * transaction decides the send with the current connection state (§4.7.2, B-M1-01): a suspend that commits before it
 * gets no POST (the row fails with CONNECTION_DISABLED, tries unchanged); a suspend after it meets a POST already sent.
 */
export function beginSend(db: Db, id: string, now: number, owner: string): BeginSend {
  return transaction(db, (): BeginSend => {
    if (!ownsDispatch(db, id, owner) || !isCurrentSync(db, id)) return 'skipped';
    if (failDisabledSync(db, id, now, owner)) return 'connection_disabled';
    return db.prepare(`UPDATE record_dispatch SET send_started_at = ?, tries = tries + 1, updated_at = ?
      WHERE id = ? AND status = 'pending' AND send_started_at IS NULL AND next_try_at <= ?
        AND COALESCE(resent_at, created_at) + 86400000 >= ?
        AND NOT ${partitionPaused('record_dispatch')}`)
      .run(now, now, id, now, now, now).changes > 0 ? 'started' : 'skipped';
  });
}

/** Record the persisted status, including the bounded confirmation policy (ADR-010 rule 5). */
export function recordSend(db: Db, row: Pick<DispatchView, 'id' | 'placementId' | 'learnerSubject' | 'confirmationAfter' | 'retryFrom'>, r: { status: SyncStatus; nextTryAt: number | null; lastError: string | null; uncertain: boolean }, now: number, owner: string): SyncStatus {
  return transaction(db, () => {
    if (!ownsDispatch(db, row.id, owner)) return db.prepare('SELECT status FROM record_dispatch WHERE id = ?').get(row.id)?.status as SyncStatus;
    db.prepare(`UPDATE record_dispatch SET send_started_at = NULL, delivery_uncertain = MAX(delivery_uncertain, ?) WHERE id = ?`)
      .run(r.uncertain ? 1 : 0, row.id);
    if (!isCurrentSync(db, row.id)) {
      db.prepare("UPDATE record_dispatch SET status = 'superseded', next_try_at = NULL, updated_at = ? WHERE id = ? AND status = 'pending'").run(now, row.id);
      return db.prepare('SELECT status FROM record_dispatch WHERE id = ?').get(row.id)!.status as SyncStatus;
    }
    let { status, nextTryAt, lastError } = r;
    if (status === 'sent' && row.confirmationAfter === null && needsConfirmation(db, row.id)) {
      nextTryAt = now + 5000;
      if (nextTryAt > row.retryFrom + 24 * 3_600_000) {
        status = 'failed';
        lastError = 'The score confirmation could not finish within the retry window.';
      } else {
        status = 'pending';
        db.prepare('UPDATE record_dispatch SET confirmation_after = ? WHERE id = ?').run(nextTryAt, row.id);
      }
    } else if (status === 'sent' && row.confirmationAfter !== null) {
      // Only a successful confirmation consumes uncertainty. An ordinary successful retry cannot do this.
      db.prepare(`UPDATE record_dispatch SET delivery_uncertain = 0 WHERE placement_id = ? AND learner_subject = ? AND reporter = (SELECT reporter FROM record_dispatch WHERE id = ?)
        AND score_given / score_maximum <= (SELECT score_given / score_maximum FROM record_dispatch WHERE id = ?)`)
        .run(row.placementId, row.learnerSubject, row.id, row.id);
    }
    db.prepare(`UPDATE record_dispatch SET status = ?, next_try_at = ?, last_error = ?, sent_at = CASE WHEN ? = 'sent' THEN ? ELSE sent_at END,
      updated_at = ? WHERE id = ?`).run(status, status === 'pending' ? nextTryAt : null, status === 'sent' ? null : lastError, status, now, now, row.id);
    return status;
  });
}

/** The newest row of a learner and activity (the shell status line), or null. */
export function latestSyncStatus(db: Db, resourceLinkId: string, userSub: string): { status: SyncStatus; scoreGiven: number; scoreMaximum: number } | null {
  const r = db.prepare("SELECT status, score_given, score_maximum FROM record_dispatch WHERE placement_id = ? AND learner_subject = ? AND reporter = 'lti-ags' ORDER BY created_at DESC, seq DESC LIMIT 1").get(resourceLinkId, userSub);
  return r ? { status: r.status as SyncStatus, scoreGiven: Number(r.score_given), scoreMaximum: Number(r.score_maximum) } : null;
}

export type ResendResult = { ok: true } | { ok: false; reason: 'not_found' | 'not_resendable'; description: string };

/**
 * Resend (app contract §5, ADR-010 rule 10): only a `failed` or `conflict` row, back to `pending` with tries = 0 and
 * a new 24 h retry window. Only the learner's best result is ever sent (A-T5b-02, tracking resendDecision): refused
 * when another row that is not superseded, or a final attempt of that learner and activity, has a higher score.
 */
export function resendSync(db: Db, libraryId: string, syncId: string, now: number): ResendResult {
  return transaction(db, (): ResendResult => {
    const r = db.prepare(`SELECT s.id, s.status, s.placement_id, s.learner_subject, s.score_given, s.score_maximum FROM record_dispatch s
      JOIN resource_link rl ON rl.id = s.placement_id JOIN connection con ON con.id = rl.connection_id
      WHERE s.id = ? AND s.reporter = 'lti-ags' AND con.library_id = ?`).get(syncId, libraryId);
    if (!r) return { ok: false, reason: 'not_found', description: 'The score sync does not exist in your library.' };
    const toRow = (x: Record<string, unknown>): SyncRow => ({ id: String(x.id), status: x.status as SyncStatus, scoreGiven: Number(x.score_given), scoreMaximum: Number(x.score_maximum) });
    const others = db.prepare("SELECT id, status, score_given, score_maximum FROM record_dispatch WHERE placement_id = ? AND learner_subject = ? AND reporter = 'lti-ags'")
      .all(String(r.placement_id), String(r.learner_subject)).map(toRow);
    const best = db.prepare(`SELECT score_given, score_maximum FROM attempt WHERE resource_link_id = ? AND user_sub = ? AND preview = 0
        AND outcome IN ('completed', 'passed', 'failed') AND score_given IS NOT NULL ORDER BY CAST(score_given AS REAL) / score_maximum DESC LIMIT 1`)
      .get(String(r.placement_id), String(r.learner_subject));
    const decision = resendDecision(toRow(r), others, best ? { scoreGiven: Number(best.score_given), scoreMaximum: Number(best.score_maximum) } : null);
    if (!decision.ok) {
      const description = decision.reason === 'status' ? 'Only a failed or conflict score sync can be sent again.'
        : decision.reason === 'not_best' ? 'This learner has a better result. Resend the better result instead.'
          : 'An equal result of this learner is already sent or pending.';
      return { ok: false, reason: 'not_resendable', description };
    }
    db.prepare(`UPDATE record_dispatch SET status = 'pending', tries = 0, next_try_at = ?, last_error = NULL, resent_at = ?, updated_at = ?,
      confirmation_after = NULL WHERE id = ?`).run(now, now, now, syncId);
    return { ok: true };
  });
}

/** True when the score sync row belongs to a connection of this library. */
export function syncRowInLibrary(db: Db, libraryId: string, syncId: string): boolean {
  return db.prepare(`SELECT 1 FROM record_dispatch s JOIN resource_link rl ON rl.id = s.placement_id JOIN connection con ON con.id = rl.connection_id
    WHERE s.id = ? AND s.reporter = 'lti-ags' AND con.library_id = ?`).get(syncId, libraryId) !== undefined;
}

/** A score sync row as the results API shows it. */
export function syncRow(db: Db, syncId: string) {
  const s = db.prepare("SELECT * FROM record_dispatch WHERE id = ? AND reporter = 'lti-ags'").get(syncId)!;
  const iso = (v: unknown) => (v === null ? null : new Date(Number(v)).toISOString());
  return {
    id: String(s.id), status: String(s.status), tries: Number(s.tries), scoreGiven: Number(s.score_given), scoreMaximum: Number(s.score_maximum),
    createdAt: iso(s.created_at), sentAt: iso(s.sent_at), lastError: s.last_error === null ? null : String(s.last_error),
  };
}
