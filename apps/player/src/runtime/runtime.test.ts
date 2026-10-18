// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pollOnce } from '../shell/main.ts';
import { startRuntime } from './main.ts';
import { MAX_BODY_CHARS, commitBody } from './transport.ts';

const TOKEN = 't'.repeat(43);

function state(over: Record<string, unknown> = {}) {
  return {
    format: 'scorm12', packageBaseUrl: '/pkg/pkg_x/', launchPath: 'index.html', preview: false, learner: { id: '5', name: '' }, sessionId: 'ses_1', lastSeq: 4,
    scorm: { cmi: { core: { lesson_status: 'incomplete', total_time: '0000:00:30.00' }, suspend_data: 'qa-resume' }, entry: 'resume', masteryScore: 70, launchData: '', credit: 'credit' },
    html: null, ...over,
  };
}

// One runtime per page load in a browser; here all tests share one window, so remove the listeners of earlier tests.
const listeners: Array<[string, EventListenerOrEventListenerObject]> = [];
const addListener = window.addEventListener.bind(window);
window.addEventListener = ((type: string, fn: EventListenerOrEventListenerObject) => {
  listeners.push([type, fn]);
  addListener(type, fn);
}) as typeof window.addEventListener;

function page(stateBody: unknown, status = 200) {
  for (const [type, fn] of listeners.splice(0)) window.removeEventListener(type, fn);
  document.body.innerHTML = '<p id="cogniate-runtime-message" hidden></p><iframe id="cogniate-package"></iframe>';
  window.history.replaceState(null, '', `/rt/${TOKEN}`);
  const posts: Array<{ url: string; init: RequestInit }> = [];
  const beacons: Array<{ url: string; data: string }> = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/state')) return new Response(JSON.stringify(stateBody), { status });
    posts.push({ url, init: init! });
    return new Response('{}');
  });
  Object.defineProperty(window, 'fetch', { value: fetchMock, configurable: true });
  Object.defineProperty(window.navigator, 'sendBeacon', { value: (url: string, data: string) => { beacons.push({ url, data }); return true; }, configurable: true });
  delete window.API;
  return { posts, beacons, fetchMock };
}

describe('runtime page (T5a design note, app contract §7)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('reads the state, defines window.API with the eight functions, then sets the package frame src', async () => {
    const { fetchMock } = page(state());
    await startRuntime(window);
    expect(fetchMock.mock.calls[0]![0]).toBe(`/rt/${TOKEN}/state`);
    expect(Object.keys(window.API!).sort()).toEqual(['LMSCommit', 'LMSFinish', 'LMSGetDiagnostic', 'LMSGetErrorString', 'LMSGetLastError', 'LMSGetValue', 'LMSInitialize', 'LMSSetValue']);
    expect(Object.isFrozen(window.API)).toBe(true);
    expect((document.getElementById('cogniate-package') as HTMLIFrameElement).getAttribute('src')).toBe('/pkg/pkg_x/index.html');
    window.API!.LMSInitialize('');
    expect(window.API!.LMSGetValue('cmi.core.entry')).toBe('resume');
    expect(window.API!.LMSGetValue('cmi.suspend_data')).toBe('qa-resume');
    expect(window.API!.LMSGetValue('cmi.core.total_time')).toBe('0000:00:30.00');
  });

  it('LMSCommit and LMSFinish use fetch keepalive JSON with seq after lastSeq; pagehide sends ONE beacon (text) with unload', async () => {
    const { posts, beacons } = page(state());
    await startRuntime(window);
    const api = window.API!;
    api.LMSInitialize('');
    api.LMSSetValue('cmi.core.session_time', '0000:00:30.00');
    api.LMSCommit('');
    api.LMSFinish('');
    expect(posts.map((p) => [p.url, p.init.keepalive, (p.init.headers as Record<string, string>)['content-type'], JSON.parse(String(p.init.body)).event, JSON.parse(String(p.init.body)).seq]))
      .toEqual([[`/rt/${TOKEN}/commit`, true, 'application/json', 'commit', 5], [`/rt/${TOKEN}/commit`, true, 'application/json', 'finish', 6]]);
    expect(JSON.parse(String(posts[0]!.init.body))).toMatchObject({ kind: 'scorm12', sessionId: 'ses_1', cmi: { core: { session_time: '0000:00:30.00' }, suspend_data: 'qa-resume' } });
    window.dispatchEvent(new Event('pagehide'));
    window.dispatchEvent(new Event('pagehide'));
    expect(beacons).toHaveLength(1);
    expect(JSON.parse(beacons[0]!.data)).toMatchObject({ event: 'unload', seq: 7, sessionId: 'ses_1' });
    expect(posts).toHaveLength(2); // no extra fetch on pagehide
  });

  it('an expired session shows a message and defines no API', async () => {
    page({}, 410);
    await startRuntime(window);
    expect(document.getElementById('cogniate-runtime-message')!.textContent).toContain('expired');
    expect(window.API).toBeUndefined();
  });

  it('an HTML attempt only loads the package (the HTML runtime is T5b)', async () => {
    page(state({ format: 'html', scorm: null }));
    await startRuntime(window);
    expect(window.API).toBeUndefined();
    expect((document.getElementById('cogniate-package') as HTMLIFrameElement).getAttribute('src')).toBe('/pkg/pkg_x/index.html');
  });

  it('bodies stay under 60 KB: the oldest interactions are left out', () => {
    const interactions = Array.from({ length: 250 }, (_v, i) => ({ id: `q${i}`, type: 'choice', result: 'correct', time: '', weighting: '', student_response: 'x'.repeat(250), latency: '', objectives: [], correct_responses: [] }));
    const cmi = { core: { lesson_status: 'incomplete', lesson_location: '', score: { raw: '', min: '', max: '' }, session_time: '', exit: '' }, suspend_data: 'x'.repeat(4096), comments: '', interactions, objectives: [] };
    const text = commitBody('commit', 'ses_1', 1, cmi);
    expect(text.length).toBeLessThanOrEqual(MAX_BODY_CHARS);
    expect(JSON.parse(text).cmi.interactions.at(-1).id).toBe('q249');
  });

  it('the shell poll shows the status text of the status API', async () => {
    const f = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ outcome: 'passed', scoreGiven: 100, scoreMaximum: 100, preview: false, scoreSync: { status: 'sent' } })));
    expect(await pollOnce(f as unknown as typeof fetch, 'ply_x')).toBe('Completed — score 100 sent to Moodle');
    expect(f.mock.calls[0]![0]).toBe('/app-api/play/ply_x/status');
    expect(await pollOnce((async () => new Response('', { status: 404 })) as unknown as typeof fetch, 'ply_x')).toBeNull();
  });
});
