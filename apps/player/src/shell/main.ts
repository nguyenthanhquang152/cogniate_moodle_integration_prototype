// The player shell script (app origin, /_player/shell.js): polls GET /app-api/play/{playId}/status every 5 s and
// shows the status text ("In progress", "Completed — score 100 sent to Moodle", "Preview — no grade is sent").
import type { PlayStatus } from '@cogniate/tracking';
import { playStatusText } from '@cogniate/tracking';
import { lmsName } from '../lms-name.ts';

export const POLL_MS = 5000;

/** One poll: the new text, or null (no change on an error). */
export async function pollOnce(fetchFn: typeof fetch, playId: string, name: 'Moodle' | 'Canvas' | 'Blackboard' = 'Moodle'): Promise<string | null> {
  try {
    const res = await fetchFn(`/app-api/play/${encodeURIComponent(playId)}/status`, { cache: 'no-store', credentials: 'omit' });
    if (!res.ok) return null;
    return playStatusText((await res.json()) as PlayStatus, name);
  } catch {
    return null;
  }
}

export function startShell(win: Window): void {
  const el = win.document.querySelector('[data-play-status]');
  const name = lmsName(win.document.querySelector('[data-page="play"]'));
  const playId = win.location.pathname.split('/')[2] ?? '';
  if (!el || !playId) return;
  win.setInterval(() => {
    void pollOnce((url, init) => win.fetch(url, init), playId, name).then((text) => {
      if (text !== null) el.textContent = text;
    });
  }, POLL_MS);
}

if (typeof window !== 'undefined' && window.location.pathname.startsWith('/play/')) startShell(window);
