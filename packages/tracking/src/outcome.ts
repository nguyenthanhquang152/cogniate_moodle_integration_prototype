// Outcome, Moodle's LMSFinish rule and the AGS mapping (ADR-010, app contract §7, §10). Pure functions.

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
