// The runtime page script (content origin, /_rt/assets/runtime.js). It reads /rt/{token}/state, defines window.API
// (SCORM 1.2), then sets the package iframe src (T5a design note). The package frame is same-origin with this page,
// so the SCO finds parent.API. For an HTML attempt it tracks the package pages (src/html/tracker.ts, T5b).
import type { HtmlProgress, RuntimeState, ScormCmi } from '@cogniate/tracking';
import { createHtmlTracker, watchFrame } from '../html/tracker.ts';
import type { Scorm12Api } from '../scorm12/api.ts';
import { createScorm12Api } from '../scorm12/api.ts';
import { flattenSaved, toCommitCmi } from '../scorm12/cmi-shape.ts';
import { commitBody, createTransport, progressBody } from './transport.ts';

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

  const transportDeps = {
    url: `${base}/commit`, sessionId: state.sessionId, lastSeq: state.lastSeq,
    fetch: (url: string, init: RequestInit) => win.fetch(url, init), sendBeacon: (url: string, data: string) => win.navigator.sendBeacon(url, data),
  };
  const frame = doc.getElementById('cogniate-package') as HTMLIFrameElement | null;
  if (state.format === 'scorm12' && state.scorm) {
    const scorm = state.scorm;
    const transport = createTransport<ScormCmi>(transportDeps, (event, seq, cmi) => commitBody(event, state.sessionId, seq, cmi));
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

  if (state.format === 'html' && state.html && frame) {
    const transport = createTransport<HtmlProgress>(transportDeps, (event, seq, p) => progressBody(event, state.sessionId, seq, p));
    const tracker = createHtmlTracker({ profile: state.html.profile, saved: state.html.progress, onChange: (p) => transport.send('progress', p) });
    watchFrame(frame, (w, d) => tracker.attach(w, d));
    win.addEventListener('pagehide', () => transport.unload(tracker.progress()));
  }
  if (frame) frame.src = `${state.packageBaseUrl}${state.launchPath.split('/').map(encodeURIComponent).join('/')}`;
}

if (typeof window !== 'undefined' && window.location.pathname.startsWith('/rt/')) void startRuntime(window);
