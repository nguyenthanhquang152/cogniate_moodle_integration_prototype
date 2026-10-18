// The player shell status line (T5a): the server renders it first, then the shell script polls every 5 s.

import type { Outcome } from './outcome.ts';
import { isFinal } from './outcome.ts';

export interface PlayStatus {
  outcome: Outcome;
  scoreGiven: number | null;
  scoreMaximum: number | null;
  preview: boolean;
  scoreSync: { status: string | null };
}

const number = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ''));

/** "In progress", "Completed — score 100 sent to Moodle", "Preview — no grade is sent", ... */
export function playStatusText(s: PlayStatus): string {
  if (s.preview) return 'Preview — no grade is sent';
  if (s.outcome === 'not_started') return 'Not started';
  if (!isFinal(s.outcome)) return 'In progress';
  const score = s.scoreGiven === null ? '' : s.scoreMaximum === null || s.scoreMaximum === 100 ? number(s.scoreGiven) : `${number(s.scoreGiven)}/${number(s.scoreMaximum)}`;
  switch (s.scoreSync.status) {
    case 'sent': return `Completed — score ${score} sent to Moodle`;
    case 'pending': return `Completed — sending score ${score} to Moodle`;
    case 'conflict': return 'Completed — Moodle has a grade with a newer time';
    case 'failed': return `Completed — score ${score} not sent to Moodle`;
    default: return score === '' ? 'Completed' : `Completed — score ${score}`;
  }
}
