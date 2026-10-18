// The runtime page script (content origin, /_rt/assets/runtime.js). It reads /rt/{token}/state, defines window.API
// (SCORM 1.2), then sets the package iframe src (T5a design note). The package frame is same-origin with this page,
// so the SCO finds parent.API. The HTML runtime comes with T5b: for an HTML attempt this page only loads the package.
import type { Scorm12Api } from '../scorm12/api.ts';
import { createScorm12Api } from '../scorm12/api.ts';
import { flattenSaved, toCommitCmi } from '../scorm12/cmi-shape.ts';
import { createTransport } from './transport.ts';

interface RuntimeState {
  format: 'scorm12' | 'html';
  packageBaseUrl: string;
  launchPath: string;
  preview: boolean;
  learner: { id: string; name: string };
  sessionId: string;
  lastSeq: number;
  scorm: { cmi: Record<string, unknown> & { core?: { total_time?: string } }; entry: string; masteryScore: number | null; launchData: string; credit: 'credit' | 'no-credit' } | null;
}

declare global {
  interface Window {
    API?: Readonly<Scorm12Api>;
  }
}

/** Start the runtime in `win` (the runtime page). Returns when the package frame src is set. */
export async function startRuntime(win: Window): Promise<void> {
  const doc = win.document;
  const token = win.location.pathname.split('/')[2] ?? '';
  const base = `/rt/${encodeURIComponent(token)}`;
  const message = (text: string) => {
    const el = doc.getElementById('cogniate-runtime-message');
    if (el) {
      el.textContent = text;
      el.hidden = false;
    }
  };
  let state: RuntimeState;
  try {
    const res = await win.fetch(`${base}/state`, { credentials: 'omit', cache: 'no-store' });
    if (res.status === 410) return message('This course session expired. Open the activity again in Moodle.');
    if (!res.ok) return message('This course session does not exist. Open the activity again in Moodle.');
    state = (await res.json()) as RuntimeState;
  } catch {
    return message('Cogniate cannot load this course now. Try again in a minute.');
  }

  if (state.format === 'scorm12' && state.scorm) {
    const scorm = state.scorm;
    const transport = createTransport({
      url: `${base}/commit`, sessionId: state.sessionId, lastSeq: state.lastSeq,
      fetch: (url, init) => win.fetch(url, init), sendBeacon: (url, data) => win.navigator.sendBeacon(url, data),
    });
    const runtime = createScorm12Api({
      saved: flattenSaved(scorm.cmi),
      readOnly: {
        studentId: state.learner.id, studentName: state.learner.name, credit: scorm.credit, entry: scorm.entry,
        totalTime: scorm.cmi.core?.total_time ?? '0000:00:00.00', masteryScore: scorm.masteryScore === null ? '' : String(scorm.masteryScore), launchData: scorm.launchData,
      },
      onCommit: (values) => transport.send('commit', toCommitCmi(values)),
      onFinish: (values) => transport.send('finish', toCommitCmi(values)),
    });
    win.API = Object.freeze({ ...runtime.api });
    // One beacon when the page goes away (window close, navigation), also after LMSFinish (AC-T5-22, AC-T5-35).
    win.addEventListener('pagehide', () => transport.unload(toCommitCmi(runtime.values())));
  }

  const frame = doc.getElementById('cogniate-package') as HTMLIFrameElement | null;
  if (frame) frame.src = `${state.packageBaseUrl}${state.launchPath.split('/').map(encodeURIComponent).join('/')}`;
}

if (typeof window !== 'undefined' && window.location.pathname.startsWith('/rt/')) void startRuntime(window);
