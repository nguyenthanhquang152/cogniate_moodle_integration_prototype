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
    removeEventListener: (type: string, fn: () => void) => listeners.set(type, (listeners.get(type) ?? []).filter((listener) => listener !== fn)),
    listenerCount: (type: string) => (listeners.get(type) ?? []).length,
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

/** Control parsing and navigation without firing the iframe's load event. */
function watchedPage(key: string, state: DocumentReadyState = 'loading', html = '') {
  const page = pkgPage(key, html);
  Object.defineProperty(page.doc, 'URL', { configurable: true, value: `https://content.test/pkg/pkg_x/${key}.html` });
  Object.defineProperty(page.doc, 'readyState', { get: () => state });
  return {
    ...page,
    setReadyState: (next: DocumentReadyState) => { state = next; },
    parsed: () => { state = 'interactive'; page.doc.dispatchEvent(new Event('DOMContentLoaded')); },
  };
}

function packageFrame(page: ReturnType<typeof watchedPage> | null) {
  const frame = document.createElement('iframe');
  const readDocument = vi.fn(() => page?.doc ?? null);
  Object.defineProperty(frame, 'contentDocument', { get: readDocument });
  Object.defineProperty(frame, 'contentWindow', { get: () => page?.win ?? null });
  return { frame, readDocument, navigate: (next: ReturnType<typeof watchedPage>) => { page = next; } };
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
    const page = watchedPage('index');
    const { frame } = packageFrame(page);
    const stop = watchFrame(frame, (_w, d) => attached.push(d.URL));
    vi.advanceTimersByTime(300);
    expect(attached).toEqual([]); // still loading
    page.setReadyState('interactive'); // images and fonts may still hang
    vi.advanceTimersByTime(150);
    vi.advanceTimersByTime(600);
    expect(attached).toEqual(['https://content.test/pkg/pkg_x/index.html']); // once per document
    stop();
  });

  it('U1: records a parsed menu before its replacement within one 150 ms poll, without load', () => {
    const tracker = createHtmlTracker({ profile, saved: empty(), onChange: () => undefined });
    const a = watchedPage('index');
    const b = watchedPage('lesson-ai-web-sprint', 'interactive');
    const { frame, navigate } = packageFrame(a);
    const attach = vi.fn((win: Window, doc: Document) => tracker.attach(win, doc));
    const stop = watchFrame(frame, attach);
    a.parsed();
    a.win.fire('pagehide');
    navigate(b);
    vi.advanceTimersByTime(10);
    expect(attach.mock.calls.map(([, doc]) => doc)).toEqual([a.doc, b.doc]);
    expect(tracker.progress().seenPages).toEqual(['index']);
    b.win.fire('pagehide'); // pause the tracker's separate dwell timer
    stop();
  });

  it('U2: records the correct answer immediately after DOMContentLoaded, with no timer advance', () => {
    const tracker = createHtmlTracker({ profile, saved: empty(), onChange: () => undefined });
    const b = watchedPage('lesson-ai-web-sprint', 'loading', QUIZ);
    const { frame } = packageFrame(b);
    const stop = watchFrame(frame, tracker.attach);
    b.parsed();
    b.doc.getElementById('c')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(tracker.progress().answers[Q]).toBe('1');
    b.win.fire('pagehide');
    stop();
  });

  it('U3: hooks pagehide while loading and sees the next loading document within 20 ms', () => {
    const a = watchedPage('index');
    const b = watchedPage('lesson-ai-web-sprint');
    const onB = vi.spyOn(b.doc, 'addEventListener');
    const { frame, navigate } = packageFrame(a);
    const attach = vi.fn();
    const stop = watchFrame(frame, attach);
    expect(a.win.listenerCount('pagehide')).toBe(1);
    a.win.fire('pagehide');
    navigate(b);
    vi.advanceTimersByTime(19);
    expect(onB.mock.calls.filter(([type]) => type === 'DOMContentLoaded')).toHaveLength(1);
    expect(b.win.listenerCount('pagehide')).toBe(1);
    expect(attach).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1); // the new document ends the fast check
    b.parsed();
    expect(attach).toHaveBeenCalledExactlyOnceWith(b.win, b.doc);
    stop();
  });

  it('U4: installs one parsing listener and attaches once across parsing, polls and load', () => {
    const page = watchedPage('index');
    const onDocument = vi.spyOn(page.doc, 'addEventListener');
    const { frame } = packageFrame(page);
    const attach = vi.fn();
    const stop = watchFrame(frame, attach);
    vi.advanceTimersByTime(450);
    expect(onDocument.mock.calls.filter(([type]) => type === 'DOMContentLoaded')).toHaveLength(1);
    expect(page.win.listenerCount('pagehide')).toBe(1);
    page.parsed();
    page.parsed();
    frame.dispatchEvent(new Event('load'));
    vi.advanceTimersByTime(300);
    expect(attach).toHaveBeenCalledExactlyOnceWith(page.win, page.doc);
    stop();
    expect(page.win.listenerCount('pagehide')).toBe(0);
  });

  it('U5: bounds the initial fast check to 5 s and stop clears every timer', () => {
    const { frame, readDocument } = packageFrame(null);
    const stop = watchFrame(frame, vi.fn());
    vi.advanceTimersByTime(4999);
    expect(vi.getTimerCount()).toBe(3); // fallback, fast interval, fast deadline
    vi.advanceTimersByTime(1);
    expect(vi.getTimerCount()).toBe(1);
    const reads = readDocument.mock.calls.length;
    vi.advanceTimersByTime(99);
    expect(readDocument).toHaveBeenCalledTimes(reads);
    vi.advanceTimersByTime(1);
    expect(readDocument).toHaveBeenCalledTimes(reads + 1); // 150 ms fallback at 5100 ms
    stop();
    stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('U5: bounds a navigation fast check and removes all document, pagehide and load hooks on stop', () => {
    const a = watchedPage('index', 'interactive');
    const b = watchedPage('lesson-ai-web-sprint');
    const removeB = vi.spyOn(b.doc, 'removeEventListener');
    const { frame, readDocument, navigate } = packageFrame(a);
    const attach = vi.fn();
    const stop = watchFrame(frame, attach);
    a.win.fire('pagehide');
    navigate(b);
    vi.advanceTimersByTime(10);
    b.win.fire('pagehide');
    vi.advanceTimersByTime(5000);
    expect(vi.getTimerCount()).toBe(1);
    stop();
    expect(removeB.mock.calls.filter(([type]) => type === 'DOMContentLoaded')).toHaveLength(1);
    expect(a.win.listenerCount('pagehide')).toBe(0);
    expect(b.win.listenerCount('pagehide')).toBe(0);
    const reads = readDocument.mock.calls.length;
    b.parsed();
    a.win.fire('pagehide');
    b.win.fire('pagehide');
    frame.dispatchEvent(new Event('load'));
    vi.advanceTimersByTime(600);
    expect(attach).toHaveBeenCalledExactlyOnceWith(a.win, a.doc);
    expect(readDocument).toHaveBeenCalledTimes(reads);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('excludes about:blank and uses the initial fast check to find the package document', () => {
    const blank = watchedPage('blank', 'complete');
    Object.defineProperty(blank.doc, 'URL', { value: 'about:blank' });
    const page = watchedPage('index');
    const { frame, navigate } = packageFrame(blank);
    const attach = vi.fn();
    const stop = watchFrame(frame, attach);
    frame.dispatchEvent(new Event('load'));
    expect(attach).not.toHaveBeenCalled();
    expect(blank.win.listenerCount('pagehide')).toBe(0);
    navigate(page);
    vi.advanceTimersByTime(10);
    page.parsed();
    expect(attach).toHaveBeenCalledExactlyOnceWith(page.win, page.doc);
    stop();
  });

  it('keeps polling after a same-origin access failure', () => {
    const page = watchedPage('index', 'interactive');
    const { frame, readDocument } = packageFrame(page);
    readDocument.mockImplementationOnce(() => { throw new DOMException('Cross-origin', 'SecurityError'); });
    const attach = vi.fn();
    const stop = watchFrame(frame, attach);
    expect(attach).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10);
    expect(attach).toHaveBeenCalledExactlyOnceWith(page.win, page.doc);
    stop();
  });
});
