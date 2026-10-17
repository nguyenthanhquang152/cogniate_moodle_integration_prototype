// Launch data (data-model §2, security §4): the handoff (single use of a ltik), resource links, attempts and play
// sessions. Repository: the only SQL for these tables. A launch finds its connection through the platform id, so these
// functions take the connection id (and through it the library), never a session user.
import type { PackageFormat, PackageReport } from '@cogniate/package-inspector';
import { randomId } from '@cogniate/shared';
import type { Db } from './db.ts';

export type Outcome = 'not_started' | 'in_progress' | 'completed' | 'passed' | 'failed';

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
  const existing = db.prepare('SELECT id, publication_id FROM resource_link WHERE connection_id = ? AND deployment_id = ? AND context_id = ? AND resource_link_id = ?')
    .get(input.connectionId, input.deploymentId, input.contextId, input.resourceLinkId);
  if (!existing) {
    const id = randomId('rl_');
    db.prepare(`INSERT INTO resource_link (id, connection_id, publication_id, deployment_id, context_id, resource_link_id, context_title, title,
      line_item_id, service_key_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, input.connectionId, input.publicationId, input.deploymentId, input.contextId, input.resourceLinkId, input.contextTitle, input.title,
        input.lineItemId, input.serviceKeyEncrypted, now, now);
    return { id, created: true, rebound: null };
  }
  const id = String(existing.id);
  const from = String(existing.publication_id);
  db.prepare(`UPDATE resource_link SET publication_id = ?, context_title = ?, title = ?, line_item_id = COALESCE(?, line_item_id),
    service_key_encrypted = COALESCE(?, service_key_encrypted), updated_at = ? WHERE id = ?`)
    .run(input.publicationId, input.contextTitle, input.title, input.lineItemId, input.serviceKeyEncrypted, now, id);
  return { id, created: false, rebound: from === input.publicationId ? null : { from, to: input.publicationId } };
}

export interface Attempt {
  id: string;
  resourceLinkId: string;
  userSub: string;
  courseVersionId: string;
  preview: boolean;
  outcome: Outcome;
  scoreGiven: number | null;
  scoreMaximum: number | null;
  created: boolean;
}

/**
 * Data-model §2 attempt rule (also after a rebind): continue the newest attempt only if it is in progress AND its
 * course version belongs to the course of the resource link's current publication. Otherwise use the current version.
 */
export function continuesNewest(newest: { outcome: Outcome; courseId: string } | undefined, currentCourseId: string): boolean {
  return newest !== undefined && newest.outcome === 'in_progress' && newest.courseId === currentCourseId;
}

const toAttempt = (r: Record<string, unknown>, created: boolean): Attempt => ({
  id: String(r.id), resourceLinkId: String(r.resource_link_id), userSub: String(r.user_sub), courseVersionId: String(r.course_version_id),
  preview: Number(r.preview) === 1, outcome: r.outcome as Outcome, scoreGiven: r.score_given === null ? null : Number(r.score_given),
  scoreMaximum: r.score_maximum === null ? null : Number(r.score_maximum), created,
});

/** The attempt for this launch: the newest one (rule above), else the row of the current version (new if none). */
export function chooseAttempt(
  db: Db,
  input: { resourceLinkId: string; userSub: string; courseId: string; currentVersionId: string; preview: boolean },
  now: number,
): Attempt {
  const newest = db.prepare(`SELECT a.*, v.course_id AS course_id FROM attempt a JOIN course_version v ON v.id = a.course_version_id
    WHERE a.resource_link_id = ? AND a.user_sub = ? ORDER BY a.created_at DESC, a.rowid DESC LIMIT 1`).get(input.resourceLinkId, input.userSub);
  if (newest && continuesNewest({ outcome: newest.outcome as Outcome, courseId: String(newest.course_id) }, input.courseId)) return toAttempt(newest, false);
  const existing = db.prepare('SELECT * FROM attempt WHERE resource_link_id = ? AND user_sub = ? AND course_version_id = ?')
    .get(input.resourceLinkId, input.userSub, input.currentVersionId);
  if (existing) return toAttempt(existing, false);
  const id = randomId('att_');
  db.prepare(`INSERT INTO attempt (id, resource_link_id, user_sub, course_version_id, preview, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(id, input.resourceLinkId, input.userSub, input.currentVersionId, input.preview ? 1 : 0, now, now);
  return toAttempt(db.prepare('SELECT * FROM attempt WHERE id = ?').get(id)!, true);
}

/** `id` = a new ply_ id from the caller (the runtime token is derived from it). */
export function createPlaySession(
  db: Db,
  input: { id: string; attemptId: string; runtimeTokenHash: string; sessionId: string; roles: string[]; returnUrl: string | null; expiresAt: number },
  now: number,
): string {
  const id = input.id;
  db.prepare(`INSERT INTO play_session (id, attempt_id, runtime_token_hash, session_id, roles, return_url, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, input.attemptId, input.runtimeTokenHash, input.sessionId, JSON.stringify(input.roles), input.returnUrl, now, input.expiresAt);
  return id;
}

/** What the player shell, the embedded page and the status API show. */
export interface PlayView {
  id: string;
  attemptId: string;
  returnUrl: string | null;
  preview: boolean;
  outcome: Outcome;
  scoreGiven: number | null;
  scoreMaximum: number | null;
  courseTitle: string;
  packageTitle: string | null;
  format: PackageFormat;
  activityTitle: string;
  contextTitle: string;
  issuerOrigin: string | null;
}

/** A play session that exists and has not expired (else undefined: 404). */
export function getPlay(db: Db, playId: string, now: number): PlayView | undefined {
  const r = db.prepare(`SELECT ps.id, ps.attempt_id, ps.return_url, a.preview, a.outcome, a.score_given, a.score_maximum, c.title AS course_title,
      v.format, v.validation_report, rl.title AS activity_title, rl.context_title, con.platform_json
    FROM play_session ps JOIN attempt a ON a.id = ps.attempt_id JOIN resource_link rl ON rl.id = a.resource_link_id
    JOIN course_version v ON v.id = a.course_version_id JOIN course c ON c.id = v.course_id JOIN connection con ON con.id = rl.connection_id
    WHERE ps.id = ? AND ps.expires_at > ?`).get(playId, now);
  if (!r) return undefined;
  const report = JSON.parse(String(r.validation_report)) as PackageReport;
  let issuerOrigin: string | null;
  try {
    issuerOrigin = r.platform_json === null ? null : new URL((JSON.parse(String(r.platform_json)) as { issuer: string }).issuer).origin;
  } catch {
    issuerOrigin = null;
  }
  return {
    id: String(r.id), attemptId: String(r.attempt_id), returnUrl: r.return_url === null ? null : String(r.return_url), preview: Number(r.preview) === 1,
    outcome: r.outcome as Outcome, scoreGiven: r.score_given === null ? null : Number(r.score_given),
    scoreMaximum: r.score_maximum === null ? null : Number(r.score_maximum), courseTitle: String(r.course_title),
    packageTitle: report.scorm?.title ?? null, format: String(r.format) as PackageFormat, activityTitle: String(r.activity_title),
    contextTitle: String(r.context_title), issuerOrigin,
  };
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
