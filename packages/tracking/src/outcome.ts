// Grade policy (ADR-010) — the ONE place for it (B-T5a-01). Pure functions; the server and the worker call them.
//   finishStatus      Moodle's LMSFinish rule (rule 3)
//   outcomeFromStatus SCORM status -> outcome (htmlOutcome in html.ts for HTML courses)
//   agsScore          outcome -> AGS score (rule 4: the mapping)
//   improves          the attempt keeps its best outcome (never lower)
//   bestAttempt       the best attempt of a learner and activity (results)
//   syncDecision      when a score sync row is made; lower pending rows are superseded (rule 5)
//   syncResult        a send answer -> row status and the next try (rules 8, 9)
// "Latest result instead of best" (ADR-010 consequence) changes improves, bestAttempt and syncDecision only.

export type Outcome = 'not_started' | 'in_progress' | 'completed' | 'passed' | 'failed';
export type Credit = 'credit' | 'no-credit';

const FINAL: ReadonlySet<Outcome> = new Set<Outcome>(['completed', 'passed', 'failed']);
export const isFinal = (o: Outcome): boolean => FINAL.has(o);

/**
 * Moodle's LMSFinish rule (mod/scorm/datamodels/scorm_12.js StoreData with storetotaltime, default masteryoverride):
 * `not attempted` becomes `completed`; then, in normal mode with credit, a mastery score and a set raw score decide
 * `passed` (raw >= mastery) or `failed`, whatever the status was before. Applied only on `finish`.
 */
export function finishStatus(status: string, raw: string, masteryScore: number | null, credit: Credit): string {
  let s = status === 'not attempted' || status === '' ? 'completed' : status;
  if (credit === 'credit' && masteryScore !== null && raw !== '') s = Number(raw) >= masteryScore ? 'passed' : 'failed';
  return s;
}

/** SCORM lesson_status -> outcome after a commit: passed, failed, completed are final; anything else is in progress. */
export function outcomeFromStatus(status: string): Outcome {
  if (status === 'passed' || status === 'failed' || status === 'completed') return status;
  return 'in_progress';
}

export interface AgsScore { scoreGiven: number; scoreMaximum: number }

/**
 * ADR-010 rule 4 (mapping). completed: raw/max if raw exists, else 100/100. passed: raw/max (max default 100),
 * 100/100 if no raw. failed: raw/max, 0/100 if no raw. Not final: null (nothing is sent).
 */
export function agsScore(outcome: Outcome, raw: string, max: string): AgsScore | null {
  if (!isFinal(outcome)) return null;
  const maximum = max !== '' && Number(max) > 0 ? Number(max) : 100;
  if (raw === '') return { scoreGiven: outcome === 'failed' ? 0 : 100, scoreMaximum: 100 };
  return { scoreGiven: Math.min(Number(raw), maximum), scoreMaximum: maximum };
}

/** The AGS score body (app contract §10). The LTI service sets the timestamp (ADR-010 rule 7). */
export function agsScoreBody(userId: string, score: AgsScore) {
  return { userId, activityProgress: 'Completed', gradingProgress: 'FullyGraded', scoreGiven: score.scoreGiven, scoreMaximum: score.scoreMaximum } as const;
}

export const ratio = (s: AgsScore): number => s.scoreGiven / s.scoreMaximum;

/**
 * "The attempt keeps its best outcome" (data-model §3): a final result replaces a non-final one; a final result
 * replaces another final one only with a higher score. A commit never lowers the attempt (app contract §7).
 */
export function improves(current: { outcome: Outcome; score: AgsScore | null }, next: { outcome: Outcome; score: AgsScore | null }): boolean {
  if (!isFinal(next.outcome)) return current.outcome === 'not_started' && next.outcome === 'in_progress';
  if (!isFinal(current.outcome) || current.score === null) return true;
  return next.score !== null && ratio(next.score) > ratio(current.score);
}

export type SyncStatus = 'pending' | 'sent' | 'conflict' | 'failed' | 'superseded';
export interface SyncRow { id: string; status: SyncStatus; scoreGiven: number; scoreMaximum: number }

/**
 * ADR-010 rule 5 "best result wins, never lower": make a row only if the new score is higher than every `pending`,
 * `sent` or `conflict` row of that learner and activity (the first final result always makes one). The new row marks
 * older `pending` rows with a lower value as `superseded`.
 */
export function syncDecision(score: AgsScore, rows: readonly SyncRow[]): { create: boolean; supersede: string[] } {
  const live = rows.filter((r) => r.status === 'pending' || r.status === 'sent' || r.status === 'conflict');
  const best = live.reduce((m, r) => Math.max(m, ratio(r)), -1);
  if (ratio(score) <= best) return { create: false, supersede: [] };
  return { create: true, supersede: rows.filter((r) => r.status === 'pending' && ratio(r) < ratio(score)).map((r) => r.id) };
}

/** Retry times of a failed send (ADR-010 rule 9): 5 s, 30 s, 2 min, 10 min, 30 min, then every hour; null after 24 h. */
export function nextRetryAt(createdAt: number, tries: number, now: number): number | null {
  const steps = [5_000, 30_000, 120_000, 600_000, 1_800_000];
  const next = now + (steps[tries - 1] ?? 3_600_000);
  return next > createdAt + 24 * 3_600_000 ? null : next;
}

/** The best attempt: the final one with the highest score; else the newest in progress; else the newest. */
export function bestAttempt<T extends { outcome: Outcome; scoreGiven: number | null; scoreMaximum: number | null; createdAt: number }>(attempts: readonly T[]): T | undefined {
  const r = (a: T) => (a.scoreGiven === null || !a.scoreMaximum ? -1 : a.scoreGiven / a.scoreMaximum);
  const newest = (list: readonly T[]) => list.reduce<T | undefined>((m, a) => (m === undefined || a.createdAt >= m.createdAt ? a : m), undefined);
  const finals = attempts.filter((a) => isFinal(a.outcome));
  if (finals.length > 0) return finals.reduce((m, a) => (r(a) > r(m) ? a : m));
  return newest(attempts.filter((a) => a.outcome === 'in_progress')) ?? newest(attempts);
}

/** What happened to one send: an HTTP status of the LTI service (0 = no answer), or a local reason. */
export type SendAnswer = { http: number } | { local: 'no_gradebook_column' | 'internal_error' };

/**
 * ADR-010 rules 8 and 9, app contract §10: 2xx -> sent; 409 -> conflict (no retry); 400, 403, 404, no gradebook
 * column or a local error -> failed at once (a human can Resend); 401, 5xx, no answer -> retry at 5 s, 30 s,
 * 2 min, 10 min, 30 min, then hourly, until 24 h after `retryFrom` (created or resent), then failed.
 */
export function syncResult(answer: SendAnswer, tries: number, retryFrom: number, now: number): { status: SyncStatus; nextTryAt: number | null } {
  if ('local' in answer) return { status: 'failed', nextTryAt: null };
  const h = answer.http;
  if (h >= 200 && h < 300) return { status: 'sent', nextTryAt: null };
  if (h === 409) return { status: 'conflict', nextTryAt: null };
  if (h === 400 || h === 403 || h === 404) return { status: 'failed', nextTryAt: null };
  const next = nextRetryAt(retryFrom, tries, now);
  return next === null ? { status: 'failed', nextTryAt: null } : { status: 'pending', nextTryAt: next };
}
