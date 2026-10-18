// @vitest-environment jsdom
import type { HtmlProgress } from '@cogniate/tracking';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHtmlTracker, isInternalHtmlLink, pageKey, watchFrame } from './tracker.ts';

const Q = '01M2M36Y89M9KPPZENF1ZW4AWJ';
const profile = { pages: ['index', 'lesson-ai-web-sprint'], menuPage: 'index', questionIds: [Q], minDwellMs: 10_000 };
const empty = (): HtmlProgress => ({ seenPages: [], answers: Object.create(null) });

/** A package page in its own document, with a window-like object (location, timers, scroll metrics). */
function pkgPage(key: string, html = '') {
  const doc = document.implementation.createHTMLDocument('p');
  doc.body.setAttribute('data-lesson-id', key);
  doc.body.innerHTML = html;
  const listeners = new Map<string, Array<() => void>>();
  const win = {
    location: { pathname: `/pkg/pkg_x/${key}.html` }, innerHeight: 800, scrollY: 0,
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms), clearTimeout: (t: ReturnType<typeof setTimeout>) => clearTimeout(t),
    addEventListener: (type: string, fn: () => void) => listeners.set(type, [...(listeners.get(type) ?? []), fn]),
    fire: (type: string) => (listeners.get(type) ?? []).forEach((fn) => fn()),
  };
  let height = 800;
  Object.defineProperty(doc.documentElement, 'scrollHeight', { get: () => height });
  let visibility: DocumentVisibilityState = 'visible';
  Object.defineProperty(doc, 'visibilityState', { get: () => visibility });
  return {
    doc, win: win as unknown as Window & typeof win,
    setHeight: (h: number) => { height = h; },
    scrollTo: (y: number) => { win.scrollY = y; win.fire('scroll'); },
    setVisible: (v: boolean) => { visibility = v ? 'visible' : 'hidden'; doc.dispatchEvent(new Event('visibilitychange')); },
  };
}

const QUIZ = `<div data-cog-quiz="${Q}"><input type="radio" data-cog-correct="false" id="w"><input type="radio" data-cog-correct="true" id="c"></div>
  <a href="lesson-ai-web-sprint.html" target="_blank" rel="noopener" id="internal">Next</a><a href="https://example.com/x.html" target="_blank" id="external">Out</a>`;

describe('HTML tracker (ADR-004, app contract §9)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('the menu page is seen on visit; internal links lose target and rel', () => {
    const changes: HtmlProgress[] = [];
    const t = createHtmlTracker({ profile, saved: empty(), onChange: (p) => changes.push(p) });
    const p = pkgPage('index', QUIZ);
    t.attach(p.win, p.doc);
    expect(changes.at(-1)!.seenPages).toEqual(['index']);
    expect(p.doc.getElementById('internal')!.hasAttribute('target')).toBe(false);
    expect(p.doc.getElementById('internal')!.hasAttribute('rel')).toBe(false);
    expect(p.doc.getElementById('external')!.getAttribute('target')).toBe('_blank');
  });

  it('a lesson page is seen after 10 s of visible time AND a scroll to the end (any order)', () => {
    const t = createHtmlTracker({ profile, saved: empty(), onChange: () => undefined });
    const p = pkgPage('lesson-ai-web-sprint');
    p.setHeight(3000);
    t.attach(p.win, p.doc);
    vi.advanceTimersByTime(11_000);
    expect(t.progress().seenPages).toEqual([]); // dwell done, not at the end
    p.scrollTo(2200);
    expect(t.progress().seenPages).toEqual(['lesson-ai-web-sprint']);
    const t2 = createHtmlTracker({ profile, saved: empty(), onChange: () => undefined });
    const q = pkgPage('lesson-ai-web-sprint');
    q.setHeight(3000);
    t2.attach(q.win, q.doc);
    q.scrollTo(2200);
    vi.advanceTimersByTime(9_000);
    expect(t2.progress().seenPages).toEqual([]); // AC-T5-29: at the end, but less than 10 s
    vi.advanceTimersByTime(1_000);
    expect(t2.progress().seenPages).toEqual(['lesson-ai-web-sprint']);
  });

  it('hidden time does not count (visibilitychange pauses the dwell)', () => {
    const t = createHtmlTracker({ profile, saved: empty(), onChange: () => undefined });
    const p = pkgPage('lesson-ai-web-sprint');
    t.attach(p.win, p.doc); // short page: already at the end
    vi.advanceTimersByTime(6_000);
    p.setVisible(false);
    vi.advanceTimersByTime(30_000);
    expect(t.progress().seenPages).toEqual([]);
    p.setVisible(true);
    vi.advanceTimersByTime(4_000);
    expect(t.progress().seenPages).toEqual(['lesson-ai-web-sprint']);
  });

  it('the first answer stands (AC-T5-28); answers of unknown questions are ignored; saved progress comes back', () => {
    const changes: HtmlProgress[] = [];
    const t = createHtmlTracker({ profile, saved: { seenPages: ['index', 'nope'], answers: Object.assign(Object.create(null), { other: '1' }) }, onChange: (p) => changes.push(p) });
    const p = pkgPage('lesson-ai-web-sprint', QUIZ);
    t.attach(p.win, p.doc);
    p.doc.getElementById('w')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    p.doc.getElementById('c')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    p.doc.getElementById('c')!.dispatchEvent(new Event('change', { bubbles: true }));
    expect(changes).toHaveLength(1);
    expect({ ...t.progress().answers }).toEqual({ [Q]: '0' });
    expect(t.progress().seenPages).toEqual(['index']);
    expect(Object.getPrototypeOf(t.progress().answers)).toBeNull();
  });

  it('page keys and internal links', () => {
    const doc = document.implementation.createHTMLDocument('p');
    expect(pageKey(doc, '/pkg/pkg_x/lesson-two.html')).toBe('lesson-two');
    expect(['a.html', 'sub/b.htm#x', 'c.html?x=1'].map(isInternalHtmlLink)).toEqual([true, true, true]);
    expect(['https://x.test/a.html', '//x.test/a.html', 'javascript:a.html', 'a.pdf'].map(isInternalHtmlLink)).toEqual([false, false, false, false]);
  });

  it('watchFrame attaches when the child document is parsed (interactive), without any load event (AC-T5-36)', () => {
    const attached: string[] = [];
    const doc = { readyState: 'loading', URL: 'https://content.test/pkg/pkg_x/index.html', body: {} } as unknown as Document;
    const frame = { contentDocument: doc, contentWindow: {}, addEventListener: () => undefined, removeEventListener: () => undefined } as unknown as HTMLIFrameElement;
    const stop = watchFrame(frame, (_w, d) => attached.push(d.URL));
    vi.advanceTimersByTime(300);
    expect(attached).toEqual([]); // still loading
    (doc as unknown as { readyState: string }).readyState = 'interactive'; // images and fonts may still hang
    vi.advanceTimersByTime(150);
    vi.advanceTimersByTime(600);
    expect(attached).toEqual(['https://content.test/pkg/pkg_x/index.html']); // once per document
    stop();
  });
});
