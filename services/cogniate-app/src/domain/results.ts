// Publication results (app contract §5 ResultRow, T5a; H5) and the outcome stats. One row per learner per activity
// (resource link); preview attempts are rows with preview: true. An attempt shows under the publication of its own
// course (data-model §2: after a rebind, an old attempt stays with its own course's publication).
import type { Outcome, SyncStatus } from '@cogniate/tracking';
import { isFinal } from '@cogniate/tracking';
import type { Db } from './db.ts';

const iso = (ms: number | null): string | null => (ms === null ? null : new Date(ms).toISOString());

interface AttemptRow {
  id: string;
  resourceLinkId: string;
  userSub: string;
  versionId: string;
  preview: boolean;
  outcome: Outcome;
  scoreGiven: number | null;
  scoreMaximum: number | null;
  createdAt: number;
  updatedAt: number;
  contextTitle: string;
  title: string;
  issuer: string | null;
}

/** The best attempt: the final one with the highest score; else the newest in progress; else the newest. */
export function bestAttempt<T extends { outcome: Outcome; scoreGiven: number | null; scoreMaximum: number | null; createdAt: number }>(attempts: readonly T[]): T | undefined {
  const ratio = (a: T) => (a.scoreGiven === null || !a.scoreMaximum ? -1 : a.scoreGiven / a.scoreMaximum);
  const newest = (list: T[]) => list.reduce<T | undefined>((m, a) => (m === undefined || a.createdAt >= m.createdAt ? a : m), undefined);
  const finals = attempts.filter((a) => isFinal(a.outcome));
  if (finals.length > 0) return finals.reduce((m, a) => (ratio(a) > ratio(m) ? a : m));
  return newest(attempts.filter((a) => a.outcome === 'in_progress')) ?? newest([...attempts]);
}

function attemptsOfPublication(db: Db, connectionId: string, courseId: string): AttemptRow[] {
  return db.prepare(`SELECT a.id, a.resource_link_id, a.user_sub, a.course_version_id, a.preview, a.outcome, a.score_given, a.score_maximum,
      a.created_at, a.updated_at, rl.context_title, rl.title, con.platform_json
    FROM attempt a JOIN course_version v ON v.id = a.course_version_id JOIN resource_link rl ON rl.id = a.resource_link_id
    JOIN connection con ON con.id = rl.connection_id
    WHERE rl.connection_id = ? AND v.course_id = ? ORDER BY a.created_at, a.rowid`).all(connectionId, courseId).map((r) => {
    let issuer: string | null;
    try {
      issuer = r.platform_json === null ? null : (JSON.parse(String(r.platform_json)) as { issuer: string }).issuer;
    } catch {
      issuer = null;
    }
    return {
      id: String(r.id), resourceLinkId: String(r.resource_link_id), userSub: String(r.user_sub), versionId: String(r.course_version_id),
      preview: Number(r.preview) === 1, outcome: r.outcome as Outcome, scoreGiven: r.score_given === null ? null : Number(r.score_given),
      scoreMaximum: r.score_maximum === null ? null : Number(r.score_maximum), createdAt: Number(r.created_at), updatedAt: Number(r.updated_at),
      contextTitle: String(r.context_title), title: String(r.title), issuer,
    };
  });
}

interface SyncRowView { id: string; attemptId: string; status: SyncStatus; tries: number; scoreGiven: number; scoreMaximum: number; createdAt: number; sentAt: number | null; lastError: string | null }

function syncsOf(db: Db, attemptIds: string[]): SyncRowView[] {
  if (attemptIds.length === 0) return [];
  return db.prepare(`SELECT * FROM score_sync WHERE attempt_id IN (${attemptIds.map(() => '?').join(', ')}) ORDER BY created_at, rowid`).all(...attemptIds).map((r) => ({
    id: String(r.id), attemptId: String(r.attempt_id), status: r.status as SyncStatus, tries: Number(r.tries), scoreGiven: Number(r.score_given),
    scoreMaximum: Number(r.score_maximum), createdAt: Number(r.created_at), sentAt: r.sent_at === null ? null : Number(r.sent_at),
    lastError: r.last_error === null ? null : String(r.last_error),
  }));
}

const learnerLabel = (sub: string, issuer: string | null): string => {
  let host = 'Moodle';
  try {
    if (issuer) host = new URL(issuer).host;
  } catch {
    host = 'Moodle';
  }
  return `Learner ${sub} @ ${host}`;
};

/** ResultRows of one publication (the caller checked the library). Oldest activity and learner first. */
export function publicationResults(db: Db, p: { connectionId: string; courseId: string }) {
  const attempts = attemptsOfPublication(db, p.connectionId, p.courseId);
  const syncs = syncsOf(db, attempts.map((a) => a.id));
  const groups = new Map<string, AttemptRow[]>();
  for (const a of attempts) {
    const key = JSON.stringify([a.resourceLinkId, a.userSub, a.preview]);
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  return [...groups.values()].map((list) => {
    const first = list[0]!;
    const best = bestAttempt(list)!;
    const ids = new Set(list.map((a) => a.id));
    return {
      learner: { sub: first.userSub, label: learnerLabel(first.userSub, first.issuer) },
      activity: { resourceLinkId: first.resourceLinkId, contextTitle: first.contextTitle, title: first.title },
      preview: first.preview,
      best: { attemptId: best.id, outcome: best.outcome, scoreGiven: best.scoreGiven, scoreMaximum: best.scoreMaximum },
      attempts: list.map((a) => ({ attemptId: a.id, versionId: a.versionId, outcome: a.outcome, scoreGiven: a.scoreGiven, scoreMaximum: a.scoreMaximum, updatedAt: iso(a.updatedAt) })),
      scoreSyncs: syncs.filter((s) => ids.has(s.attemptId)).map((s) => ({
        id: s.id, status: s.status, tries: s.tries, scoreGiven: s.scoreGiven, scoreMaximum: s.scoreMaximum, createdAt: iso(s.createdAt), sentAt: iso(s.sentAt), lastError: s.lastError,
      })),
      // T5b fills gradebook after "Refresh from Moodle".
      gradebook: null,
    };
  });
}

/** Outcome stats of a publication (app contract §5): learners (not previews) by their best outcome, and the last sent sync. */
export function outcomeStats(db: Db, p: { connectionId: string; courseId: string }): { inProgress: number; completed: number; passed: number; failed: number; lastScoreSync: string | null } {
  const rows = publicationResults(db, p).filter((r) => !r.preview);
  const count = (o: Outcome) => rows.filter((r) => r.best.outcome === o).length;
  const sent = rows.flatMap((r) => r.scoreSyncs).map((s) => s.sentAt).filter((s): s is string => s !== null).sort();
  return { inProgress: count('in_progress'), completed: count('completed'), passed: count('passed'), failed: count('failed'), lastScoreSync: sent.at(-1) ?? null };
}
