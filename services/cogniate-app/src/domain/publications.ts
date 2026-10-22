// Publications (app contract §5, data-model §2): one per (connection, course). Every lookup takes the library id
// (through the connection and the course).
import type { PackageFormat } from '@cogniate/package-inspector';
import { randomId } from '@cogniate/shared';
import type { Db } from './db.ts';
import { transaction } from './db.ts';

export interface Publication {
  id: string;
  connectionId: string;
  courseId: string;
  courseTitle: string;
  versionId: string;
  version: number;
  format: PackageFormat;
  status: 'available' | 'withdrawn';
  createdAt: number;
  updatedAt: number;
  /** T8 course shell (createMoodleCourse on publish). */
  siteUrl: string;
  courseVariant: string;
  courseLang: string;
  moodleCourseId: number | null;
  moodleCourseIdnumber: string | null;
  shellStatus: 'created' | 'exists' | 'failed' | null;
  shellError: string | null;
  /** M1 (app contract §5.1): the connection's LMS type and name. */
  channel: string;
  connectionName: string;
}

const SELECT = `SELECT p.*, c.title AS course_title, c.variant AS course_variant, c.lang AS course_lang, con.site_url AS site_url, con.channel AS connection_channel, con.name AS connection_name, v.version AS version, v.format AS format FROM publication p
  JOIN connection con ON con.id = p.connection_id JOIN course c ON c.id = p.course_id JOIN course_version v ON v.id = p.current_version_id`;

const toPublication = (r: Record<string, unknown>): Publication => ({
  id: String(r.id), connectionId: String(r.connection_id), courseId: String(r.course_id), courseTitle: String(r.course_title),
  versionId: String(r.current_version_id), version: Number(r.version), format: String(r.format) as PackageFormat,
  status: r.status as Publication['status'], createdAt: Number(r.created_at), updatedAt: Number(r.updated_at),
  siteUrl: String(r.site_url), courseVariant: String(r.course_variant ?? 'default'), courseLang: String(r.course_lang ?? 'en'),
  moodleCourseId: r.moodle_course_id === null || r.moodle_course_id === undefined ? null : Number(r.moodle_course_id),
  moodleCourseIdnumber: r.moodle_course_idnumber === null || r.moodle_course_idnumber === undefined ? null : String(r.moodle_course_idnumber),
  shellStatus: (r.shell_status ?? null) as Publication['shellStatus'], shellError: r.shell_error === null || r.shell_error === undefined ? null : String(r.shell_error),
  channel: String(r.connection_channel), connectionName: String(r.connection_name ?? ''),
});

export function getPublication(db: Db, libraryId: string, id: string): Publication | undefined {
  const row = db.prepare(`${SELECT} WHERE p.id = ? AND con.library_id = ? AND c.library_id = ?`).get(id, libraryId, libraryId);
  return row ? toPublication(row) : undefined;
}

export function listPublications(db: Db, libraryId: string, filter: { connectionId?: string; courseId?: string } = {}): Publication[] {
  const where = ['con.library_id = ?', 'c.library_id = ?'];
  const args: string[] = [libraryId, libraryId];
  if (filter.connectionId !== undefined) { where.push('p.connection_id = ?'); args.push(filter.connectionId); }
  if (filter.courseId !== undefined) { where.push('p.course_id = ?'); args.push(filter.courseId); }
  return db.prepare(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY p.created_at DESC, p.id`).all(...args).map(toPublication);
}

/**
 * Publish (app contract §5): one publication per connection + course. Existing: the version is updated and a
 * withdrawn publication becomes available again (created = false). The caller checked the library of every id.
 */
export function upsertPublication(db: Db, libraryId: string, input: { connectionId: string; courseId: string; versionId: string }, now: number): { publication: Publication; created: boolean } {
  return transaction(db, () => {
    const existing = db.prepare('SELECT id FROM publication WHERE connection_id = ? AND course_id = ?').get(input.connectionId, input.courseId);
    if (existing) {
      db.prepare("UPDATE publication SET current_version_id = ?, status = 'available', updated_at = ? WHERE id = ?").run(input.versionId, now, String(existing.id));
      return { publication: getPublication(db, libraryId, String(existing.id))!, created: false };
    }
    const id = randomId('pub_');
    db.prepare(`INSERT INTO publication (id, connection_id, course_id, current_version_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'available', ?, ?)`)
      .run(id, input.connectionId, input.courseId, input.versionId, now, now);
    return { publication: getPublication(db, libraryId, id)!, created: true };
  });
}

export function withdrawPublication(db: Db, libraryId: string, id: string, now: number): Publication | undefined {
  if (!getPublication(db, libraryId, id)) return undefined;
  db.prepare("UPDATE publication SET status = 'withdrawn', updated_at = ? WHERE id = ?").run(now, id);
  return getPublication(db, libraryId, id);
}

/** T8: record the Moodle course shell of a publication. */
export function setShell(db: Db, id: string, shell: { moodleCourseId: number | null; idnumber: string; status: 'created' | 'exists' | 'failed'; error: string | null }, now: number): void {
  db.prepare('UPDATE publication SET moodle_course_id = ?, moodle_course_idnumber = ?, shell_status = ?, shell_error = ?, updated_at = ? WHERE id = ?')
    .run(shell.moodleCourseId, shell.idnumber, shell.status, shell.error, now, id);
}
