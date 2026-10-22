import { expect, it } from 'vitest';
import { playStatusText } from './status-text.ts';
import type { PlayStatus } from './status-text.ts';

const base: PlayStatus = {
  outcome: 'completed', scoreGiven: 60, scoreMaximum: 100, preview: false,
  scoreSync: { status: 'sent', scoreGiven: 80, scoreMaximum: 100 },
};

// Today's strings of every sync state, with {LMS} as the only variable part.
const TEXTS = {
  sent: 'Completed — score 60. {LMS} keeps your best score: 80',
  pending: 'Completed — score 60. Sending your best score, 80, to {LMS}',
  conflict: 'Completed — {LMS} has a grade with a newer time',
  failed: 'Completed — score 60. Your best score, 80, was not sent to {LMS}',
};

it.each(['Moodle', 'Canvas', 'Blackboard', 'your LMS', 'Brightspace'])('AC-LA-E1-09-03: the status texts fill {LMS} with the text name %s', (name) => {
  for (const [status, text] of Object.entries(TEXTS)) {
    expect(playStatusText({ ...base, scoreSync: { ...base.scoreSync, status } }, name)).toBe(text.replace('{LMS}', name));
  }
  expect(playStatusText({ ...base, scoreGiven: 80 }, name)).toBe(`Completed — score 80 sent to ${name}`);
  expect(playStatusText({ ...base, scoreGiven: 80, scoreSync: { ...base.scoreSync, status: 'pending' } }, name)).toBe(`Completed — sending score 80 to ${name}`);
  expect(playStatusText({ ...base, preview: true }, name)).toBe('Preview — no grade is sent');
  expect(playStatusText({ ...base, outcome: 'in_progress' }, name)).toBe('In progress');
});

it('AC-LA-E1-09-03: the Moodle texts are the T5a strings byte for byte', () => {
  expect(playStatusText({ ...base, scoreGiven: 100, scoreSync: { status: 'sent', scoreGiven: 100, scoreMaximum: 100 } }, 'Moodle'))
    .toBe('Completed — score 100 sent to Moodle');
  expect(playStatusText({ ...base, scoreSync: { ...base.scoreSync, status: 'conflict' } }, 'Moodle')).toBe('Completed — Moodle has a grade with a newer time');
});
