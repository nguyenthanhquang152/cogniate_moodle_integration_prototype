// Retention cleanup of the Cogniate app (data-model §2.1, A-T4b2-02). Deletes rows that can never be used again:
//   handoff         expires_at (= used_at + 24 h, the ltik life) more than 24 h ago
//   picker_session  expires_at more than 24 h ago, except a used pick that no launch has taken yet: it still counts
//                   as an activity in the stats (its ltik is cleared)
//   play_session    expires_at more than 24 h ago; its counted session time moves to the attempt first
// Attempts, resource links, score syncs, publications and connections are the record of results: never deleted.
import type { RetentionResult } from '@cogniate/shared';
import type { Db } from './db.ts';
import { transaction } from './db.ts';

export const DAY_MS = 86_400_000;

export function cleanupExpired(db: Db, now: number): RetentionResult[] {
  const cut = now - DAY_MS;
  return transaction(db, () => {
    const handoff = Number(db.prepare('DELETE FROM handoff WHERE used_at + ? < ?').run(DAY_MS, cut).changes);
    db.prepare("UPDATE picker_session SET ltik_encrypted = X'' WHERE used_at IS NOT NULL AND length(ltik_encrypted) > 0 AND expires_at < ?").run(now);
    const pickers = Number(db.prepare(`DELETE FROM picker_session WHERE expires_at < ?
      AND NOT (used_at IS NOT NULL AND publication_id IS NOT NULL AND resource_link_id IS NULL)`).run(cut).changes);
    db.prepare(`UPDATE attempt SET archived_session_time_cs = archived_session_time_cs
        + (SELECT COALESCE(SUM(ps.max_session_time_cs), 0) FROM play_session ps WHERE ps.attempt_id = attempt.id AND ps.expires_at < ?)
      WHERE id IN (SELECT attempt_id FROM play_session WHERE expires_at < ?)`).run(cut, cut);
    const plays = Number(db.prepare('DELETE FROM play_session WHERE expires_at < ?').run(cut).changes);
    return [{ table: 'handoff', deleted: handoff }, { table: 'picker_session', deleted: pickers }, { table: 'play_session', deleted: plays }];
  });
}
