// Content picker sessions (app contract §6, data-model §2): made by /tool/deep-link, used once by the picker POST.
// The picker id in the URL is the capability. A-T4b2-03: the table keeps only its SHA-256 (`key`), like every other
// token, so a copy of the database cannot open a picker. The ltik is stored only here, encrypted (T4b2 design note).
// LA-ADR-05 D3, data model §5b: a used picker keeps one picker_pick row per picked publication (multi-select) until
// the first launch of that activity.
import type { PackageFormat, PackageReport } from '@cogniate/package-inspector';
import { randomId, sha256Hex } from '@cogniate/shared';
import type { Db } from './db.ts';
import { transaction } from './db.ts';

export interface PickerSession {
  /** SHA-256 hex of the picker id (the table key). The raw id is only in the URL. */
  key: string;
  connectionId: string;
  ltikEncrypted: Uint8Array;
  issuerOrigin: string;
  /** M1: frame-ancestors and return URL origin (the connection site URL); old rows: the issuer origin. */
  siteOrigin: string;
  deploymentId: string;
  contextId: string;
  contextTitle: string;
  createdAt: number;
  expiresAt: number;
  usedAt: number | null;
}

const toPicker = (r: Record<string, unknown>): PickerSession => ({
  key: String(r.id), connectionId: String(r.connection_id), ltikEncrypted: r.ltik_encrypted as Uint8Array, issuerOrigin: String(r.issuer_origin), siteOrigin: r.site_origin === null || r.site_origin === undefined ? String(r.issuer_origin) : String(r.site_origin),
  deploymentId: String(r.deployment_id), contextId: String(r.context_id), contextTitle: String(r.context_title), createdAt: Number(r.created_at),
  expiresAt: Number(r.expires_at), usedAt: r.used_at === null ? null : Number(r.used_at),
});

export function createPicker(
  db: Db,
  input: {
    connectionId: string;
    /** LA-E5-22: seals the ltik for the stored row key (the hash of the picker id). */
    sealLtik: (rowKey: string) => Uint8Array;
    issuerOrigin: string; siteOrigin?: string; deploymentId: string; contextId: string; contextTitle: string; expiresAt: number;
  },
  now: number,
): string {
  const id = randomId('pck_');
  const key = sha256Hex(id);
  db.prepare(`INSERT INTO picker_session (id, connection_id, ltik_encrypted, issuer_origin, site_origin, deployment_id, context_id, context_title, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(key, input.connectionId, input.sealLtik(key), input.issuerOrigin, input.siteOrigin ?? input.issuerOrigin, input.deploymentId, input.contextId, input.contextTitle, now, input.expiresAt);
  return id;
}

/** By the raw picker id from the URL (looked up by its hash). */
export function getPicker(db: Db, pickerId: string): PickerSession | undefined {
  const r = db.prepare('SELECT * FROM picker_session WHERE id = ?').get(sha256Hex(pickerId));
  return r ? toPicker(r) : undefined;
}

/**
 * Claim the picker (atomic): false if it was used or expired in the meantime. `key` = PickerSession.key. The same
 * transaction writes one picker_pick row per picked publication; a single pick also writes picker_session.publication_id
 * as before; a cancel (no publication) writes no pick.
 */
export function claimPicker(db: Db, key: string, publicationIds: readonly string[], now: number): boolean {
  return transaction(db, () => {
    const single = publicationIds.length === 1 ? publicationIds[0]! : null;
    const claimed = Number(db.prepare('UPDATE picker_session SET used_at = ?, publication_id = ? WHERE id = ? AND used_at IS NULL AND expires_at > ?')
      .run(now, single, key, now).changes) === 1;
    if (!claimed) return false;
    const pick = db.prepare('INSERT INTO picker_pick (picker_id_hash, publication_id) VALUES (?, ?)');
    for (const publicationId of publicationIds) pick.run(key, publicationId);
    return true;
  });
}

/** A-T4b2-04: after a successful pick, drop the encrypted ltik (the column is NOT NULL, so an empty blob). */
export function clearPickerLtik(db: Db, key: string): void {
  db.prepare("UPDATE picker_session SET ltik_encrypted = X'' WHERE id = ?").run(key);
}

/** The Deep Linking call failed after the claim: the teacher may pick again. The picks go with the claim. */
export function releasePicker(db: Db, key: string): void {
  transaction(db, () => {
    db.prepare('DELETE FROM picker_pick WHERE picker_id_hash = ?').run(key);
    db.prepare('UPDATE picker_session SET used_at = NULL, publication_id = NULL WHERE id = ?').run(key);
  });
}

/**
 * A resource link of this publication was made or rebound: the oldest pick of that course in that LMS course
 * (connection, deployment, context) that no launch has seen yet becomes this activity (stats count it once). A single
 * pick also sets picker_session.resource_link_id, so the old columns stay in step (retention reads them).
 */
export function linkPickToResourceLink(db: Db, input: { connectionId: string; deploymentId: string; contextId: string; publicationId: string; resourceLinkId: string }): void {
  transaction(db, () => {
    const pick = db.prepare(`SELECT ps.id AS session FROM picker_pick pp JOIN picker_session ps ON ps.id = pp.picker_id_hash
        WHERE ps.connection_id = ? AND ps.deployment_id = ? AND ps.context_id = ? AND pp.publication_id = ?
          AND ps.used_at IS NOT NULL AND pp.resource_link_id IS NULL ORDER BY ps.used_at, ps.id LIMIT 1`)
      .get(input.connectionId, input.deploymentId, input.contextId, input.publicationId) as { session: string } | undefined;
    if (!pick) return;
    db.prepare('UPDATE picker_pick SET resource_link_id = ? WHERE picker_id_hash = ? AND publication_id = ?').run(input.resourceLinkId, pick.session, input.publicationId);
    db.prepare('UPDATE picker_session SET resource_link_id = ? WHERE id = ? AND publication_id = ? AND resource_link_id IS NULL')
      .run(input.resourceLinkId, pick.session, input.publicationId);
  });
}

/** A row of the picker list. */
export interface PickablePublication {
  id: string;
  courseTitle: string;
  packageTitle: string | null;
  format: PackageFormat;
  version: number;
}

/** The connection's `available` publications (same library as the connection), newest first. */
export function pickablePublications(db: Db, connectionId: string): PickablePublication[] {
  return db.prepare(`SELECT p.id, c.title AS course_title, v.format, v.version, v.validation_report FROM publication p
      JOIN connection con ON con.id = p.connection_id JOIN course c ON c.id = p.course_id JOIN course_version v ON v.id = p.current_version_id
      WHERE p.connection_id = ? AND p.status = 'available' AND c.library_id = con.library_id ORDER BY p.created_at DESC, p.id`)
    .all(connectionId).map((r) => ({
      id: String(r.id), courseTitle: String(r.course_title), format: String(r.format) as PackageFormat, version: Number(r.version),
      packageTitle: (JSON.parse(String(r.validation_report)) as PackageReport).scorm?.title ?? null,
    }));
}
