// Attempts and play sessions (data-model §2, §3; app contract §6, §7). The ADR-008 import fence lets the untrusted
// content host import only domain/attempts*, so the attempt model and its rules live here (B-T4b2-02).
// Repository: the only SQL for the attempt and play_session tables.
import type { PackageFormat, PackageReport, TrackingProfile } from '@cogniate/package-inspector';
import { randomId, sha256Hex } from '@cogniate/shared';
import type { AgsScore, Credit, Outcome, ScormCmi } from '@cogniate/tracking';
import { agsScore, agsScoreBody, checkScormCmi, finishStatus, improves, isFinal, outcomeFromStatus, sessionMax, syncDecision, totalTime } from '@cogniate/tracking';
import type { Db } from './db.ts';
import { transaction } from './db.ts';

export type { Outcome } from '@cogniate/tracking';
/** Re-exported for the content host (the ADR-008 fence lets it import only domain/attempts*). */
export type { Db } from './db.ts';

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

/**
 * `id` = a new ply_ id from the caller (the runtime token is derived from it). A-T4b2-03: the table keeps only the
 * SHA-256 of the play id, like every other token; the raw id is only in the /play URL.
 */
export function createPlaySession(
  db: Db,
  input: { id: string; attemptId: string; runtimeTokenHash: string; sessionId: string; roles: string[]; returnUrl: string | null; expiresAt: number },
  now: number,
): string {
  const id = input.id;
  const key = sha256Hex(id);
  db.prepare(`INSERT INTO play_session (id, attempt_id, runtime_token_hash, session_id, roles, return_url, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(key, input.attemptId, input.runtimeTokenHash, input.sessionId, JSON.stringify(input.roles), input.returnUrl, now, input.expiresAt);
  return id;
}

/** What the player shell, the embedded page and the status API show. */
export interface PlayView {
  attemptId: string;
  resourceLinkId: string;
  userSub: string;
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

/** By the raw play id from the URL (looked up by its hash): a play session that exists and has not expired. */
export function getPlay(db: Db, playId: string, now: number): PlayView | undefined {
  const r = db.prepare(`SELECT ps.attempt_id, ps.return_url, a.resource_link_id, a.user_sub, a.preview, a.outcome, a.score_given, a.score_maximum, c.title AS course_title,
      v.format, v.validation_report, rl.title AS activity_title, rl.context_title, con.platform_json
    FROM play_session ps JOIN attempt a ON a.id = ps.attempt_id JOIN resource_link rl ON rl.id = a.resource_link_id
    JOIN course_version v ON v.id = a.course_version_id JOIN course c ON c.id = v.course_id JOIN connection con ON con.id = rl.connection_id
    WHERE ps.id = ? AND ps.expires_at > ?`).get(sha256Hex(playId), now);
  if (!r) return undefined;
  const report = JSON.parse(String(r.validation_report)) as PackageReport;
  let issuerOrigin: string | null;
  try {
    issuerOrigin = r.platform_json === null ? null : new URL((JSON.parse(String(r.platform_json)) as { issuer: string }).issuer).origin;
  } catch {
    issuerOrigin = null;
  }
  return {
    attemptId: String(r.attempt_id), resourceLinkId: String(r.resource_link_id), userSub: String(r.user_sub), returnUrl: r.return_url === null ? null : String(r.return_url), preview: Number(r.preview) === 1,
    outcome: r.outcome as Outcome, scoreGiven: r.score_given === null ? null : Number(r.score_given),
    scoreMaximum: r.score_maximum === null ? null : Number(r.score_maximum), courseTitle: String(r.course_title),
    packageTitle: report.scorm?.title ?? null, format: String(r.format) as PackageFormat, activityTitle: String(r.activity_title),
    contextTitle: String(r.context_title), issuerOrigin,
  };
}

// ---------------------------------------------------------------- runtime sessions (content host, app contract §7)

/** A play session as the content host sees it (looked up by the hash of the runtime token in the path). */
export interface RuntimeSession {
  /** SHA-256 hex of the play id (the play_session key). */
  playKey: string;
  sessionId: string;
  lastSeq: number;
  maxSessionTimeCs: number;
  /** Counted time of the attempt's deleted sessions (retention, migration 006). */
  archivedTimeCs: number;
  entry: string | null;
  finishedAt: number | null;
  expiresAt: number;
  attemptId: string;
  resourceLinkId: string;
  userSub: string;
  preview: boolean;
  outcome: Outcome;
  scoreGiven: number | null;
  scoreMaximum: number | null;
  saved: unknown;
  format: PackageFormat;
  packageId: string;
  profile: TrackingProfile;
}

/** By token hash, expired or not (the caller answers 404 or 410). */
export function findRuntimeSession(db: Db, runtimeTokenHash: string): RuntimeSession | undefined {
  const r = db.prepare(`SELECT ps.id AS play_id, ps.session_id, ps.last_seq, ps.max_session_time_cs, ps.entry, ps.finished_at, ps.expires_at,
      a.id AS attempt_id, a.resource_link_id, a.user_sub, a.preview, a.outcome, a.score_given, a.score_maximum, a.cmi_or_progress, a.archived_session_time_cs,
      v.format, v.package_id, v.tracking_profile
    FROM play_session ps JOIN attempt a ON a.id = ps.attempt_id JOIN course_version v ON v.id = a.course_version_id
    WHERE ps.runtime_token_hash = ?`).get(runtimeTokenHash);
  if (!r) return undefined;
  return {
    playKey: String(r.play_id), sessionId: String(r.session_id), lastSeq: Number(r.last_seq), maxSessionTimeCs: Number(r.max_session_time_cs), archivedTimeCs: Number(r.archived_session_time_cs),
    entry: r.entry === null ? null : String(r.entry), finishedAt: r.finished_at === null ? null : Number(r.finished_at), expiresAt: Number(r.expires_at),
    attemptId: String(r.attempt_id), resourceLinkId: String(r.resource_link_id), userSub: String(r.user_sub), preview: Number(r.preview) === 1,
    outcome: r.outcome as Outcome, scoreGiven: r.score_given === null ? null : Number(r.score_given), scoreMaximum: r.score_maximum === null ? null : Number(r.score_maximum),
    saved: r.cmi_or_progress === null ? null : JSON.parse(String(r.cmi_or_progress)), format: String(r.format) as PackageFormat,
    packageId: String(r.package_id), profile: JSON.parse(String(r.tracking_profile)) as TrackingProfile,
  };
}

/** The packages folder name of a package id (the content host checks the path itself), or undefined. */
export function packageStoragePath(db: Db, packageId: string): string | undefined {
  const r = db.prepare('SELECT storage_path FROM package WHERE id = ?').get(packageId);
  return r ? String(r.storage_path) : undefined;
}

const credit = (preview: boolean): Credit => (preview ? 'no-credit' : 'credit');

/**
 * RuntimeState (app contract §7). `entry` is fixed at the first state read of the session: ab-initio for the first
 * session of the attempt, `resume` if the last exit was `suspend`, else "". total_time = the counted time of the
 * attempt's other sessions. Write-only values of the last session (exit, session_time) are not given back.
 */
export function runtimeState(db: Db, s: RuntimeSession) {
  const saved = s.format === 'scorm12' ? (s.saved as ScormCmi | null) : null;
  let entry = s.entry;
  if (entry === null) {
    entry = saved === null ? 'ab-initio' : saved.core.exit === 'suspend' ? 'resume' : '';
    db.prepare('UPDATE play_session SET entry = ? WHERE id = ? AND entry IS NULL').run(entry, s.playKey);
  }
  const others = db.prepare('SELECT max_session_time_cs AS cs FROM play_session WHERE attempt_id = ? AND id <> ?').all(s.attemptId, s.playKey).map((r) => Number(r.cs));
  const base = { format: s.format, packageBaseUrl: `/pkg/${s.packageId}/`, launchPath: s.profile.launchPath, preview: s.preview, learner: { id: s.userSub, name: '' }, sessionId: s.sessionId, lastSeq: s.lastSeq };
  if (s.format !== 'scorm12') return { ...base, scorm: null, html: { profile: s.profile, progress: s.saved ?? { seenPages: [], answers: {} } } };
  const cmi = saved === null ? null : { ...saved, core: { ...saved.core, exit: '', session_time: '' } };
  return {
    ...base,
    scorm: { cmi: { ...(cmi ?? {}), core: { ...(cmi?.core ?? {}), total_time: totalTime([s.archivedTimeCs, ...others]) } }, entry, masteryScore: s.profile.masteryScore, launchData: '', credit: credit(s.preview) },
    html: null,
  };
}

export type CommitEvent = 'commit' | 'finish' | 'unload';
export type CommitResult =
  | { ok: true; event: CommitEvent; seq: number; outcome: Outcome; scoreGiven: number | null; scoreMaximum: number | null; syncId: string | null }
  | { ok: false; status: 400 | 409; code: 'INVALID_REQUEST' | 'STALE_SEQUENCE' | 'INVALID_CMI'; field: string };

const EVENTS: ReadonlySet<string> = new Set(['commit', 'finish', 'unload']);
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * A SCORM 1.2 commit (app contract §7), checks in this order after the token: (2) the session id of this play
 * session, (3) seq > last accepted seq (409 STALE_SEQUENCE), (4) value rules (400 INVALID_CMI, details.field),
 * (5) store, derive the outcome and maybe make a score sync row, all in one transaction (T5a design note).
 * After a `finish` in this session the LMSFinish rule also applies to later commits, so a late `unload` does not
 * turn the stored status back to "not attempted". The attempt keeps its best outcome (never lower).
 */
export function applyScormCommit(db: Db, s: RuntimeSession, body: unknown, now: number): CommitResult {
  if (!isRecord(body)) return { ok: false, status: 400, code: 'INVALID_REQUEST', field: 'body' };
  if (body.kind !== 'scorm12' || s.format !== 'scorm12') return { ok: false, status: 400, code: 'INVALID_REQUEST', field: 'kind' };
  if (typeof body.event !== 'string' || !EVENTS.has(body.event)) return { ok: false, status: 400, code: 'INVALID_REQUEST', field: 'event' };
  if (body.sessionId !== s.sessionId) return { ok: false, status: 400, code: 'INVALID_REQUEST', field: 'sessionId' };
  const seq = body.seq;
  if (typeof seq !== 'number' || !Number.isInteger(seq) || seq < 1) return { ok: false, status: 400, code: 'INVALID_REQUEST', field: 'seq' };
  const event = body.event as CommitEvent;
  return transaction(db, (): CommitResult => {
    const current = db.prepare('SELECT last_seq, max_session_time_cs, finished_at FROM play_session WHERE id = ?').get(s.playKey)!;
    if (seq <= Number(current.last_seq)) return { ok: false, status: 409, code: 'STALE_SEQUENCE', field: 'seq' };
    const checked = checkScormCmi(body.cmi);
    if (!checked.ok) return { ok: false, status: 400, code: 'INVALID_CMI', field: checked.field };
    const cmi = checked.cmi;
    const finished = event === 'finish' || current.finished_at !== null;
    let status = cmi.core.lesson_status === '' ? 'not attempted' : cmi.core.lesson_status;
    if (finished) status = finishStatus(status, cmi.core.score.raw, s.profile.masteryScore, credit(s.preview));
    cmi.core.lesson_status = status;
    const outcome = outcomeFromStatus(status);
    const score = agsScore(outcome, cmi.core.score.raw, cmi.core.score.max);

    db.prepare(`UPDATE play_session SET last_seq = ?, max_session_time_cs = ?, finished_at = COALESCE(finished_at, ?) WHERE id = ?`)
      .run(seq, sessionMax(Number(current.max_session_time_cs), cmi.core.session_time || undefined), event === 'finish' ? now : null, s.playKey);
    const a = db.prepare('SELECT outcome, score_given, score_maximum FROM attempt WHERE id = ?').get(s.attemptId)!;
    const before = { outcome: a.outcome as Outcome, score: a.score_given === null ? null : { scoreGiven: Number(a.score_given), scoreMaximum: Number(a.score_maximum) } };
    const better = improves(before, { outcome, score });
    const best = better ? { outcome, score } : before;
    db.prepare(`UPDATE attempt SET cmi_or_progress = ?, last_seq = ?, outcome = ?, score_given = ?, score_maximum = ?, updated_at = ? WHERE id = ?`)
      .run(JSON.stringify(cmi), seq, best.outcome, best.score?.scoreGiven ?? null, best.score?.scoreMaximum ?? null, now, s.attemptId);

    const syncId = !s.preview && isFinal(outcome) && score ? maybeCreateSync(db, s, score, now) : null;
    return { ok: true, event, seq, outcome: best.outcome, scoreGiven: best.score?.scoreGiven ?? null, scoreMaximum: best.score?.scoreMaximum ?? null, syncId };
  });
}

/** ADR-010 rule 5: a pending row only for a better result of this learner and activity; supersede lower pending rows. */
function maybeCreateSync(db: Db, s: RuntimeSession, score: AgsScore, now: number): string | null {
  const rows = db.prepare('SELECT id, status, score_given, score_maximum FROM score_sync WHERE resource_link_id = ? AND user_sub = ?')
    .all(s.resourceLinkId, s.userSub)
    .map((r) => ({ id: String(r.id), status: r.status as 'pending', scoreGiven: Number(r.score_given), scoreMaximum: Number(r.score_maximum) }));
  const decision = syncDecision(score, rows);
  if (!decision.create) return null;
  for (const id of decision.supersede) db.prepare("UPDATE score_sync SET status = 'superseded', next_try_at = NULL, updated_at = ? WHERE id = ?").run(now, id);
  const id = randomId('sync_');
  db.prepare(`INSERT INTO score_sync (id, attempt_id, resource_link_id, user_sub, payload, score_given, score_maximum, status, tries, created_at, next_try_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?)`)
    .run(id, s.attemptId, s.resourceLinkId, s.userSub, JSON.stringify(agsScoreBody(s.userSub, score)), score.scoreGiven, score.scoreMaximum, now, now, now);
  return id;
}
