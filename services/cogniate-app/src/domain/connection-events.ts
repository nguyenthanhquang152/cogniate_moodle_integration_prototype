// Connection events (A2 LA-ADR-08 D5, LA data model §5a): one row per launch or Deep Linking refusal that names a
// connection, per connection check, and per disconnect or suspend. Codes and ids only: never learner data or a token.
// At most CONNECTION_EVENT_LIMIT rows per connection (the writer trims) and CONNECTION_EVENT_TTL_MS (the retention job).
import { randomId } from '@cogniate/shared';
import type { RetentionResult } from '@cogniate/shared';
import type { Db } from './db.ts';
import { transaction } from './db.ts';

export type ConnectionEventKind = 'launch_refused' | 'deep_link_refused' | 'check' | 'disconnect' | 'suspend';
export const CONNECTION_EVENT_LIMIT = 100;
export const CONNECTION_EVENT_TTL_MS = 30 * 86_400_000;

export interface ConnectionEvent {
  kind: ConnectionEventKind;
  code: string | null;
  traceId: string | null;
  at: number;
}

/** Record one event and keep the newest CONNECTION_EVENT_LIMIT rows of the connection, in one transaction. */
export function recordConnectionEvent(
  db: Db, event: { connectionId: string; libraryId: string; kind: ConnectionEventKind; code?: string | null; traceId?: string | null }, now: number,
): void {
  transaction(db, () => {
    db.prepare('INSERT INTO connection_event (id, connection_id, library_id, kind, code, trace_id, at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(randomId('cev_'), event.connectionId, event.libraryId, event.kind, event.code ?? null, event.traceId ?? null, now);
    db.prepare(`DELETE FROM connection_event WHERE connection_id = ? AND id NOT IN (
      SELECT id FROM connection_event WHERE connection_id = ? ORDER BY at DESC, id DESC LIMIT ?)`).run(event.connectionId, event.connectionId, CONNECTION_EVENT_LIMIT);
  });
}

/** The kept events of a connection of this library, newest first. */
export function listConnectionEvents(db: Db, libraryId: string, connectionId: string): ConnectionEvent[] {
  return db.prepare('SELECT kind, code, trace_id, at FROM connection_event WHERE library_id = ? AND connection_id = ? ORDER BY at DESC, id DESC LIMIT ?')
    .all(libraryId, connectionId, CONNECTION_EVENT_LIMIT)
    .map((r) => ({ kind: String(r.kind) as ConnectionEventKind, code: r.code === null ? null : String(r.code), traceId: r.trace_id === null ? null : String(r.trace_id), at: Number(r.at) }));
}

/** The 30-day rule (LA-H4), run by the app retention job. */
export function deleteExpiredConnectionEvents(db: Db, now: number): RetentionResult {
  return { table: 'connection_event', deleted: Number(db.prepare('DELETE FROM connection_event WHERE at < ?').run(now - CONNECTION_EVENT_TTL_MS).changes) };
}

/**
 * The code of a connection check event (BD-A2-98 values): "ok", or the failed parts "jwks:<detail>" and
 * "token:<detail>" joined by a space.
 */
export function checkEventCode(check: { jwks: { ok: boolean; detail?: string }; token: { ok: boolean; detail?: string } }): string {
  const parts = [
    ...(check.jwks.ok ? [] : [`jwks:${check.jwks.detail ?? 'failed'}`]),
    ...(check.token.ok ? [] : [`token:${check.token.detail ?? 'failed'}`]),
  ];
  return parts.length === 0 ? 'ok' : parts.join(' ');
}

/** The parts of a check event code: true when that part did not fail. */
export function checkEventParts(code: string | null): { jwks: boolean; token: boolean } {
  const parts = (code ?? '').split(' ');
  return { jwks: !parts.some((part) => part.startsWith('jwks:')), token: !parts.some((part) => part.startsWith('token:')) };
}
