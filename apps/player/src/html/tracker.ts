// HTML runtime tracker (app contract §9, ADR-004 "HTML: option C"). It observes the same-origin package page in the
// runtime's iframe and does not change package bytes. Rules (the same as the SCORM package):
//  - the menu page (when there is more than one page) is seen on visit;
//  - another page is seen after minDwellMs of VISIBLE time and a scroll to the end (24 px slack, or the page is
//    shorter than the window);
//  - a question is answered by the first click or change on an input[data-cog-correct] inside [data-cog-quiz]; the
//    first answer stands;
//  - internal .html links lose `target` and `rel`, so the navigation stays in the frame.
// Question ids come from the package (A-T4a-07): kept in a Map, reported as a null-prototype object.
import type { HtmlProfile, HtmlProgress } from '@cogniate/tracking';

export const SCROLL_SLACK_PX = 24;

/** The part of the HTML tracking profile that the tracker reads (B-T5b-02: the type comes from tracking). */
export type TrackerProfile = Pick<HtmlProfile, 'pages' | 'menuPage' | 'questionIds' | 'minDwellMs'>;

/** Page key: body[data-lesson-id], else the file name without .html. */
export function pageKey(doc: Document, pathname: string): string {
  const id = doc.body?.getAttribute('data-lesson-id');
  if (id) return id;
  return decodeURIComponent(pathname.split('/').pop() ?? '').replace(/\.html?$/i, '');
}

/** An internal link: a relative .html href (no scheme, not protocol-relative). */
export const isInternalHtmlLink = (href: string): boolean => /\.html?(?:[?#].*)?$/i.test(href) && !/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(href);

export function createHtmlTracker(opts: { profile: TrackerProfile; saved: HtmlProgress; onChange: (p: HtmlProgress) => void }) {
  const { profile } = opts;
  const pages = new Set(profile.pages);
  const questions = new Set(profile.questionIds);
  const seen = new Set(opts.saved.seenPages.filter((p) => pages.has(p)));
  const answers = new Map<string, '1' | '0'>(Object.entries(opts.saved.answers ?? {}).filter(([k, v]) => questions.has(k) && (v === '1' || v === '0')) as Array<[string, '1' | '0']>);

  const progress = (): HtmlProgress => {
    const out = Object.create(null) as Record<string, '1' | '0'>;
    for (const id of profile.questionIds) {
      const v = answers.get(id);
      if (v !== undefined) out[id] = v;
    }
    return { seenPages: profile.pages.filter((p) => seen.has(p)), answers: out };
  };
  const see = (page: string) => {
    if (!pages.has(page) || seen.has(page)) return;
    seen.add(page);
    opts.onChange(progress());
  };

  /** Attach to one child document (as soon as it is parsed). */
  function attach(win: Window, doc: Document): void {
    const key = pageKey(doc, win.location.pathname);
    for (const a of Array.from(doc.querySelectorAll('a[href]'))) {
      if (isInternalHtmlLink(a.getAttribute('href') ?? '')) {
        a.removeAttribute('target');
        a.removeAttribute('rel');
      }
    }
    // Answers: delegated listeners (capture), so inputs that the page adds later count too.
    const onAnswer = (ev: Event) => {
      const input = (ev.target as Element | null)?.closest?.('input[data-cog-correct]');
      const id = input?.closest('[data-cog-quiz]')?.getAttribute('data-cog-quiz');
      if (!input || !id || !questions.has(id) || answers.has(id)) return; // the first answer stands
      answers.set(id, input.getAttribute('data-cog-correct') === 'true' ? '1' : '0');
      opts.onChange(progress());
    };
    doc.addEventListener('click', onAnswer, true);
    doc.addEventListener('change', onAnswer, true);

    if (profile.pages.length > 1 && key === profile.menuPage) return see(key);
    if (!pages.has(key) || seen.has(key)) return;
    // Dwell (visible time only) and scroll to the end; both are needed, in any order.
    let remaining = profile.minDwellMs;
    let since: number | null = null;
    let timer: ReturnType<Window['setTimeout']> | null = null;
    let dwellDone = false;
    let atEnd = false;
    const check = () => {
      if (dwellDone && atEnd) see(key);
    };
    const reachedEnd = (): boolean => {
      const full = Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0);
      const view = win.innerHeight;
      return full <= view + SCROLL_SLACK_PX || win.scrollY + view >= full - SCROLL_SLACK_PX;
    };
    const onScroll = () => {
      if (!atEnd && reachedEnd()) {
        atEnd = true;
        check();
      }
    };
    const resume = () => {
      if (dwellDone || timer !== null || doc.visibilityState === 'hidden') return;
      since = Date.now();
      timer = win.setTimeout(() => {
        timer = null;
        dwellDone = true;
        check();
      }, Math.max(0, remaining));
    };
    const pause = () => {
      if (timer !== null) win.clearTimeout(timer);
      timer = null;
      if (since !== null) remaining -= Date.now() - since;
      since = null;
    };
    win.addEventListener('scroll', onScroll, true);
    win.addEventListener('resize', onScroll);
    doc.addEventListener('visibilitychange', () => (doc.visibilityState === 'hidden' ? pause() : resume()));
    win.addEventListener('pagehide', pause);
    onScroll();
    resume();
  }

  return { attach, progress };
}

/**
 * Attach to an observed package document as soon as it is parsed. Watch DOMContentLoaded even while loading;
 * briefly check more often around navigation to find the next document. Keep the 150 ms poll and `load` fallback:
 * a hanging external host (S3 images, Google fonts) can block `load` forever (T5-spike, AC-T5-36).
 */
export function watchFrame(frame: HTMLIFrameElement, attach: (win: Window, doc: Document) => void, pollMs = 150): () => void {
  const runtimeWin = frame.ownerDocument.defaultView!;
  const done = new WeakSet<Document>();
  const watched = new Map<Document, { tryAttach: () => void; stop: () => void }>();
  let currentDoc: Document | null = null;
  let stopped = false;
  let fastTimer: number | null = null;
  let fastDeadline: number | null = null;
  const stopFastCheck = () => {
    if (fastTimer !== null) runtimeWin.clearInterval(fastTimer);
    if (fastDeadline !== null) runtimeWin.clearTimeout(fastDeadline);
    fastTimer = null;
    fastDeadline = null;
  };
  const startFastCheck = () => {
    if (stopped) return;
    stopFastCheck();
    // Runtime timers survive navigation of the child window.
    fastTimer = runtimeWin.setInterval(check, 10);
    fastDeadline = runtimeWin.setTimeout(stopFastCheck, 5000);
  };
  function check() {
    if (stopped) return;
    let doc: Document | null;
    let win: Window | null;
    try {
      doc = frame.contentDocument;
      win = frame.contentWindow;
      if (!doc || !win || doc.URL === 'about:blank') return;
    } catch {
      return; // not same-origin (should not happen)
    }
    if (doc !== currentDoc) {
      currentDoc = doc;
      stopFastCheck();
    }
    let hooks = watched.get(doc);
    if (!hooks) {
      const tryAttach = () => {
        if (stopped || done.has(doc) || doc.readyState === 'loading' || !doc.body) return;
        done.add(doc);
        doc.removeEventListener('DOMContentLoaded', tryAttach);
        attach(win, doc);
      };
      // Register pagehide at first sight, including a document that is still loading.
      win.addEventListener('pagehide', startFastCheck);
      if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', tryAttach);
      hooks = {
        tryAttach,
        stop: () => {
          doc.removeEventListener('DOMContentLoaded', tryAttach);
          win.removeEventListener('pagehide', startFastCheck);
        },
      };
      watched.set(doc, hooks);
    }
    hooks.tryAttach();
  }
  frame.addEventListener('load', check);
  const timer = runtimeWin.setInterval(check, pollMs);
  startFastCheck();
  check();
  return () => {
    stopped = true;
    stopFastCheck();
    runtimeWin.clearInterval(timer);
    frame.removeEventListener('load', check);
    for (const hooks of watched.values()) hooks.stop();
    watched.clear();
  };
}
