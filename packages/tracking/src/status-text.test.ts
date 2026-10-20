import { expect, it } from 'vitest';
import { playStatusText } from './status-text.ts';
import type { PlayStatus } from './status-text.ts';

const base: PlayStatus = {
  outcome: 'completed', scoreGiven: 60, scoreMaximum: 100, preview: false,
  scoreSync: { status: 'sent', scoreGiven: 80, scoreMaximum: 100 },
};
it.each(['Canvas', 'Blackboard'] as const)('uses %s for each sync state and preserves the best-score policy', (name) => {
  const expected = {
    sent: `Completed — score 60. ${name} keeps your best score: 80`,
    pending: `Completed — score 60. Sending your best score, 80, to ${name}`,
    conflict: `Completed — ${name} has a grade with a newer time`,
    failed: `Completed — score 60. Your best score, 80, was not sent to ${name}`,
  };
  for (const [status, text] of Object.entries(expected)) {
    expect(playStatusText({ ...base, scoreSync: { ...base.scoreSync, status } }, name)).toBe(text);
    expect(playStatusText({ ...base, scoreSync: { ...base.scoreSync, status } })).toBe(text.replaceAll(name, 'Moodle'));
  }
  expect(playStatusText({ ...base, scoreGiven: 80 }, name)).toBe(`Completed — score 80 sent to ${name}`);
  expect(playStatusText({ ...base, preview: true }, name)).toBe('Preview — no grade is sent');
  expect(playStatusText({ ...base, outcome: 'in_progress' }, name)).toBe('In progress');
});
