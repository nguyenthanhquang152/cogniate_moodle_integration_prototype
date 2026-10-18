// HTML runtime tracker (app contract §9, ADR-004 "HTML: option C"). It observes the same-origin package page in the
// runtime's iframe and does not change package bytes. Rules (the same as the SCORM package):
//  - the menu page (when there is more than one page) is seen on visit;
//  - another page is seen after minDwellMs of VISIBLE time and a scroll to the end (24 px slack, or the page is
//    shorter than the window);
//  - a question is answered by the first click or change on an input[data-cog-correct] inside [data-cog-quiz]; the
//    first answer stands;
//  - internal .html links lose `target` and `rel`, so the navigation stays in the frame.
// Question ids come from the package (A-T4a-07): kept in a Map, reported as a null-prototype object.
import type { HtmlProgress } from '@cogniate/tracking';

export const SCROLL_SLACK_PX = 24;

export interface TrackerProfile {
  pages: readonly string[];
  menuPage: string | null;
  questionIds: readonly string[];
  minDwellMs: number;
}

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
    let timer: ReturnType<typeof setTimeout> | null = null;
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
 * Attach to every new document of the package frame as soon as it is parsed (readyState interactive or complete):
 * poll every 150 ms and also listen for `load`. Never wait only for `load`: a hanging external host (S3 images,
 * Google fonts) blocks it forever (T5-spike, AC-T5-36).
 */
export function watchFrame(frame: HTMLIFrameElement, attach: (win: Window, doc: Document) => void, pollMs = 150): () => void {
  const done = new WeakSet<Document>();
  const tryAttach = () => {
    let doc: Document | null;
    try {
      doc = frame.contentDocument;
    } catch {
      return; // not same-origin (should not happen)
    }
    const win = frame.contentWindow;
    if (!doc || !win || done.has(doc) || doc.readyState === 'loading' || doc.URL === 'about:blank' || !doc.body) return;
    done.add(doc);
    attach(win, doc);
  };
  frame.addEventListener('load', tryAttach);
  const timer = setInterval(tryAttach, pollMs);
  tryAttach();
  return () => {
    clearInterval(timer);
    frame.removeEventListener('load', tryAttach);
  };
}
