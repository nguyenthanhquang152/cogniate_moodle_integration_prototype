// The player shell status line (T5a): the server renders it first, then the shell script polls every 5 s.

import type { Outcome } from './outcome.ts';
import { isFinal } from './outcome.ts';

export interface PlayStatus {
  outcome: Outcome;
  scoreGiven: number | null;
  scoreMaximum: number | null;
  preview: boolean;
  scoreSync: { status: string | null; scoreGiven: number | null; scoreMaximum: number | null };
}

const number = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ''));
const formatScore = (given: number | null, maximum: number | null): string =>
  given === null ? '' : maximum === null || maximum === 100 ? number(given) : `${number(given)}/${number(maximum)}`;

/** "In progress", "Completed — score 100 sent to Moodle", "Preview — no grade is sent", ... */
export function playStatusText(s: PlayStatus): string {
  if (s.preview) return 'Preview — no grade is sent';
  if (s.outcome === 'not_started') return 'Not started';
  if (!isFinal(s.outcome)) return 'In progress';
  const score = formatScore(s.scoreGiven, s.scoreMaximum);
  const sync = s.scoreSync;
  const different = sync.scoreGiven !== null && sync.scoreMaximum !== null &&
    (s.scoreGiven === null || s.scoreMaximum === null || s.scoreGiven / s.scoreMaximum !== sync.scoreGiven / sync.scoreMaximum);
  const best = formatScore(sync.scoreGiven, sync.scoreMaximum);
  switch (s.scoreSync.status) {
    case 'sent': return different ? `Completed — score ${score}. Moodle keeps your best score: ${best}` : `Completed — score ${score} sent to Moodle`;
    case 'pending': return different ? `Completed — score ${score}. Sending your best score, ${best}, to Moodle` : `Completed — sending score ${score} to Moodle`;
    case 'conflict': return 'Completed — Moodle has a grade with a newer time';
    case 'failed': return different ? `Completed — score ${score}. Your best score, ${best}, was not sent to Moodle` : `Completed — score ${score} not sent to Moodle`;
    default: return score === '' ? 'Completed' : `Completed — score ${score}`;
  }
}
