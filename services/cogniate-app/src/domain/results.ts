import { LEGACY_LEARNER_HOST, type ChannelRegistry } from '@cogniate/channel-kernel';
// Publication results (app contract §5 ResultRow, T5a; H5) and the outcome stats. One row per learner per activity
// (resource link); preview attempts are rows with preview: true. An attempt shows under the publication of its own
// course (data-model §2: after a rebind, an old attempt stays with its own course's publication).
import type { Outcome, SyncStatus } from '@cogniate/tracking';
import { bestAttempt } from '@cogniate/tracking';
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
  channel: string;
}

function attemptsOfPublication(db: Db, connectionId: string, courseId: string): AttemptRow[] {
  return db.prepare(`SELECT a.id, a.resource_link_id, a.user_sub, a.course_version_id, a.preview, a.outcome, a.score_given, a.score_maximum,
      a.created_at, a.updated_at, rl.context_title, rl.title, con.site_url, con.channel
    FROM attempt a JOIN course_version v ON v.id = a.course_version_id JOIN resource_link rl ON rl.id = a.resource_link_id
    JOIN connection con ON con.id = rl.connection_id
    WHERE rl.connection_id = ? AND v.course_id = ? ORDER BY a.created_at, a.rowid`).all(connectionId, courseId).map((r) => {
    // M1 (app contract §6.1): the learner label host is the connection site URL host (for Moodle the issuer host).
    const issuer = r.site_url === null ? null : String(r.site_url);
    return {
      id: String(r.id), resourceLinkId: String(r.resource_link_id), userSub: String(r.user_sub), versionId: String(r.course_version_id),
      preview: Number(r.preview) === 1, outcome: r.outcome as Outcome, scoreGiven: r.score_given === null ? null : Number(r.score_given),
      scoreMaximum: r.score_maximum === null ? null : Number(r.score_maximum), createdAt: Number(r.created_at), updatedAt: Number(r.updated_at),
      contextTitle: String(r.context_title), title: String(r.title), issuer, channel: String(r.channel),
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
  let host: string = LEGACY_LEARNER_HOST;
  try {
    if (issuer) host = new URL(issuer).host;
  } catch {
    host = LEGACY_LEARNER_HOST;
  }
  return `Learner ${sub} @ ${host}`;
};

/** The last gradebook read of a learner and activity ("Refresh from Moodle", T5b), or null. */
function gradebookOf(db: Db, resourceLinkId: string, userSub: string): { resultScore: number | null; resultMaximum: number | null; readAt: string | null } | null {
  const r = db.prepare('SELECT result_score, result_maximum, read_at FROM gradebook_read WHERE resource_link_id = ? AND user_sub = ?').get(resourceLinkId, userSub);
  if (!r) return null;
  return { resultScore: r.result_score === null ? null : Number(r.result_score), resultMaximum: r.result_maximum === null ? null : Number(r.result_maximum), readAt: iso(Number(r.read_at)) };
}

/**
 * App contract §5: after a refresh, the row has gradebookDiffers: true when Moodle's value differs from the best
 * result while the last sync is `sent` (for example a teacher override, ADR-010 rule 8).
 */
export function gradebookDiffers(gradebook: { resultScore: number | null; resultMaximum: number | null } | null, best: { scoreGiven: number | null; scoreMaximum: number | null },
  lastSyncStatus: SyncStatus | undefined): boolean {
  if (!gradebook || gradebook.resultScore === null || lastSyncStatus !== 'sent' || best.scoreGiven === null || !best.scoreMaximum) return false;
  const moodle = gradebook.resultScore / (gradebook.resultMaximum || 100);
  return Math.abs(moodle - best.scoreGiven / best.scoreMaximum) > 1e-9;
}

/** ResultRows of one publication (the caller checked the library). Oldest activity and learner first. */
export function publicationResults(db: Db, p: { connectionId: string; courseId: string }, _channels: ChannelRegistry) {
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
    const rowSyncs = syncs.filter((s) => ids.has(s.attemptId));
    const gradebook = first.preview ? null : gradebookOf(db, first.resourceLinkId, first.userSub);
    return {
      learner: { sub: first.userSub, label: learnerLabel(first.userSub, first.issuer) },
      activity: { resourceLinkId: first.resourceLinkId, contextTitle: first.contextTitle, title: first.title },
      preview: first.preview,
      best: { attemptId: best.id, outcome: best.outcome, scoreGiven: best.scoreGiven, scoreMaximum: best.scoreMaximum },
      attempts: list.map((a) => ({ attemptId: a.id, versionId: a.versionId, outcome: a.outcome, scoreGiven: a.scoreGiven, scoreMaximum: a.scoreMaximum, updatedAt: iso(a.updatedAt) })),
      scoreSyncs: rowSyncs.map((s) => ({
        id: s.id, status: s.status, tries: s.tries, scoreGiven: s.scoreGiven, scoreMaximum: s.scoreMaximum, createdAt: iso(s.createdAt), sentAt: iso(s.sentAt), lastError: s.lastError,
      })),
      gradebook,
      gradebookDiffers: gradebookDiffers(gradebook, best, rowSyncs.at(-1)?.status),
    };
  });
}

/** Outcome stats of a publication (app contract §5): learners (not previews) by their best outcome, and the last sent sync. */
export function outcomeStats(db: Db, p: { connectionId: string; courseId: string }, channels: ChannelRegistry): { inProgress: number; completed: number; passed: number; failed: number; lastScoreSync: string | null } {
  const rows = publicationResults(db, p, channels).filter((r) => !r.preview);
  const count = (o: Outcome) => rows.filter((r) => r.best.outcome === o).length;
  const sent = rows.flatMap((r) => r.scoreSyncs).map((s) => s.sentAt).filter((s): s is string => s !== null).sort();
  return { inProgress: count('in_progress'), completed: count('completed'), passed: count('passed'), failed: count('failed'), lastScoreSync: sent.at(-1) ?? null };
}
