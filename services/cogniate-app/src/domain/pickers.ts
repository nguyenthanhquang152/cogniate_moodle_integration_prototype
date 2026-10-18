// Content picker sessions (app contract §6, data-model §2): made by /tool/deep-link, used once by the picker POST.
// The picker id in the URL is the capability. A-T4b2-03: the table keeps only its SHA-256 (`key`), like every other
// token, so a copy of the database cannot open a picker. The ltik is stored only here, encrypted (T4b2 design note).
import type { PackageFormat, PackageReport } from '@cogniate/package-inspector';
import { randomId, sha256Hex } from '@cogniate/shared';
import type { Db } from './db.ts';

export interface PickerSession {
  /** SHA-256 hex of the picker id (the table key). The raw id is only in the URL. */
  key: string;
  connectionId: string;
  ltikEncrypted: Uint8Array;
  issuerOrigin: string;
  deploymentId: string;
  contextId: string;
  contextTitle: string;
  createdAt: number;
  expiresAt: number;
  usedAt: number | null;
}

const toPicker = (r: Record<string, unknown>): PickerSession => ({
  key: String(r.id), connectionId: String(r.connection_id), ltikEncrypted: r.ltik_encrypted as Uint8Array, issuerOrigin: String(r.issuer_origin),
  deploymentId: String(r.deployment_id), contextId: String(r.context_id), contextTitle: String(r.context_title), createdAt: Number(r.created_at),
  expiresAt: Number(r.expires_at), usedAt: r.used_at === null ? null : Number(r.used_at),
});

export function createPicker(
  db: Db,
  input: { connectionId: string; ltikEncrypted: Uint8Array; issuerOrigin: string; deploymentId: string; contextId: string; contextTitle: string; expiresAt: number },
  now: number,
): string {
  const id = randomId('pck_');
  db.prepare(`INSERT INTO picker_session (id, connection_id, ltik_encrypted, issuer_origin, deployment_id, context_id, context_title, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(sha256Hex(id), input.connectionId, input.ltikEncrypted, input.issuerOrigin, input.deploymentId, input.contextId, input.contextTitle, now, input.expiresAt);
  return id;
}

/** By the raw picker id from the URL (looked up by its hash). */
export function getPicker(db: Db, pickerId: string): PickerSession | undefined {
  const r = db.prepare('SELECT * FROM picker_session WHERE id = ?').get(sha256Hex(pickerId));
  return r ? toPicker(r) : undefined;
}

/** Claim the picker for one pick (atomic): false if it was used or expired in the meantime. `key` = PickerSession.key. */
export function claimPicker(db: Db, key: string, publicationId: string, now: number): boolean {
  return Number(db.prepare('UPDATE picker_session SET used_at = ?, publication_id = ? WHERE id = ? AND used_at IS NULL AND expires_at > ?')
    .run(now, publicationId, key, now).changes) === 1;
}

/** The Deep Linking call failed after the claim: the teacher may pick again. */
export function releasePicker(db: Db, key: string): void {
  db.prepare('UPDATE picker_session SET used_at = NULL, publication_id = NULL WHERE id = ?').run(key);
}

/**
 * A resource link of this publication was made or rebound: the oldest pick of that course in that Moodle course
 * (connection, deployment, context) that no launch has seen yet becomes this activity (stats count it once).
 */
export function linkPickToResourceLink(db: Db, input: { connectionId: string; deploymentId: string; contextId: string; publicationId: string; resourceLinkId: string }): void {
  db.prepare(`UPDATE picker_session SET resource_link_id = ? WHERE id = (
      SELECT id FROM picker_session WHERE connection_id = ? AND deployment_id = ? AND context_id = ? AND publication_id = ?
        AND used_at IS NOT NULL AND resource_link_id IS NULL ORDER BY used_at, id LIMIT 1)`)
    .run(input.resourceLinkId, input.connectionId, input.deploymentId, input.contextId, input.publicationId);
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
