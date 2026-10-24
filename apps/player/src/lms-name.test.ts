// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { lmsName } from './lms-name.ts';
import { startRuntime } from './runtime/main.ts';
import { POLL_MS, startShell } from './shell/main.ts';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete document.body.dataset.lmsName;
});

it.each([['Canvas', 'Canvas'], ['Blackboard', 'Blackboard'], ['Moodle', 'Moodle'], ['your LMS', 'your LMS'], ['  D2L ', 'D2L'], ['', 'your LMS'], ['   ', 'your LMS']])('AC-LA-E1-09-02: takes the server text name %j', (value, expected) => {
  document.body.dataset.lmsName = value;
  expect(lmsName(document.body)).toBe(expected);
});

it('AC-LA-E1-09-02: a page without data-lms-name gets the generic text name', () => {
  expect(lmsName(document.body)).toBe('your LMS');
  expect(lmsName(null)).toBe('your LMS');
});

it('shows a markup-like name as text only', async () => {
  vi.useFakeTimers();
  document.body.innerHTML = '<main data-page="play" data-lms-name="&lt;img src=x&gt;"><strong data-play-status>In progress</strong></main>';
  window.history.replaceState(null, '', '/play/ply_test');
  vi.spyOn(window, 'fetch').mockResolvedValue(new Response(JSON.stringify({
    outcome: 'completed', scoreGiven: 100, scoreMaximum: 100, preview: false, scoreSync: { status: 'sent', scoreGiven: 100, scoreMaximum: 100 },
  })));
  startShell(window);
  await vi.advanceTimersByTimeAsync(POLL_MS);
  const status = document.querySelector('[data-play-status]')!;
  expect(status.textContent).toBe('Completed — score 100 sent to <img src=x>');
  expect(status.children).toHaveLength(0);
});

it.each(['Moodle', 'Canvas', 'Blackboard', 'your LMS'] as const)('AC-LA-E1-09-02: polls a %s shell without changing the status wire format', async (name) => {
  vi.useFakeTimers();
  document.body.innerHTML = `<main data-page="play" data-lms-name="${name}"><strong data-play-status>In progress</strong></main>`;
  window.history.replaceState(null, '', '/play/ply_test');
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({
    outcome: 'completed', scoreGiven: 100, scoreMaximum: 100, preview: false,
    scoreSync: { status: 'sent', scoreGiven: 100, scoreMaximum: 100 },
  })));
  vi.spyOn(window, 'fetch').mockImplementation(fetchMock);
  startShell(window);
  await vi.advanceTimersByTimeAsync(POLL_MS);
  expect(document.querySelector('[data-play-status]')?.textContent).toBe(`Completed — score 100 sent to ${name}`);
  expect(fetchMock).toHaveBeenCalledWith('/app-api/play/ply_test/status', { cache: 'no-store', credentials: 'omit' });
});

it.each([[410, 'Canvas'], [404, 'Canvas'], [410, 'your LMS'], [404, 'Moodle']])('AC-LA-E1-09-02: reads the runtime body before a %s state response (%s)', async (status, name) => {
  document.body.innerHTML = '<p id="cogniate-runtime-message" hidden></p>';
  document.body.dataset.lmsName = name;
  window.history.replaceState(null, '', '/rt/token');
  vi.spyOn(window, 'fetch').mockResolvedValue(new Response('{}', { status }));
  await startRuntime(window);
  expect(document.getElementById('cogniate-runtime-message')?.textContent).toBe(
    `This course session ${status === 410 ? 'expired' : 'does not exist'}. Open the activity again in ${name}.`,
  );
});
