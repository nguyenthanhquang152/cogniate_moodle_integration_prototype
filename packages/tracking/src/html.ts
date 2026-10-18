// HTML course progress rules (app contract §7 value rules, ADR-004 "HTML: option C"). The runtime reports raw
// progress (seen pages, first answers); the server checks it against the tracking profile of the attempt's version
// and derives the outcome. Question ids come from the package (A-T4a-07): only Map keys or null-prototype objects.
import type { Outcome } from './outcome.ts';

export interface HtmlProfile {
  pages: readonly string[];
  menuPage: string | null;
  questionIds: readonly string[];
  masteryScore: number | null;
  minDwellMs: number;
}

/** Progress as JSON (RuntimeState, commit body, stored attempt). `answers` is a null-prototype object. */
export interface HtmlProgress {
  seenPages: string[];
  answers: Record<string, '1' | '0'>;
}

export type ProgressCheck = { ok: true; progress: HtmlProgress } | { ok: false; field: string };

/** The default mastery score of the HTML export (ADR-004: 70, or the value given at upload). */
export const DEFAULT_MASTERY = 70;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function emptyProgress(): HtmlProgress {
  return { seenPages: [], answers: Object.create(null) as Record<string, '1' | '0'> };
}

/**
 * Value rules: seenPages is a subset of the profile pages; answer keys are profile question ids and values "1" or
 * "0"; a saved answer never changes. Returns the merged progress (saved + new; it only grows).
 */
export function checkHtmlProgress(input: unknown, profile: HtmlProfile, saved: HtmlProgress | null): ProgressCheck {
  if (!isRecord(input)) return { ok: false, field: 'progress' };
  const pages = new Set(profile.pages);
  const questions = new Set(profile.questionIds);
  const seen = input.seenPages ?? [];
  if (!Array.isArray(seen) || seen.length > profile.pages.length * 2) return { ok: false, field: 'progress.seenPages' };
  for (const p of seen) if (typeof p !== 'string' || !pages.has(p)) return { ok: false, field: 'progress.seenPages' };
  const answers = input.answers ?? {};
  if (!isRecord(answers)) return { ok: false, field: 'progress.answers' };
  const before = new Map(Object.entries(saved?.answers ?? {}));
  const merged = new Map(before);
  for (const key of Object.keys(answers)) {
    const value = answers[key];
    if (!questions.has(key)) return { ok: false, field: 'progress.answers' };
    if (value !== '1' && value !== '0') return { ok: false, field: `progress.answers.${key}` };
    if (before.has(key) && before.get(key) !== value) return { ok: false, field: `progress.answers.${key}` }; // the first answer stands
    merged.set(key, value);
  }
  const seenSet = new Set([...(saved?.seenPages ?? []), ...(seen as string[])]);
  const out = emptyProgress();
  out.seenPages = profile.pages.filter((p) => seenSet.has(p));
  for (const id of profile.questionIds) {
    const v = merged.get(id);
    if (v !== undefined) out.answers[id] = v as '1' | '0';
  }
  return { ok: true, progress: out };
}

/**
 * Outcome of HTML progress (ADR-004, ADR-010): complete = all pages seen and all questions answered.
 * Score = round(correct / total * 100); passed if score >= mastery, else failed. No questions: completed.
 * `raw` is the score as a SCORM-like string ("" when there is none), for agsScore().
 */
export function htmlOutcome(progress: HtmlProgress, profile: HtmlProfile): { outcome: Outcome; raw: string } {
  const answers = new Map(Object.entries(progress.answers));
  const complete = profile.pages.every((p) => progress.seenPages.includes(p)) && profile.questionIds.every((id) => answers.has(id));
  if (!complete) return { outcome: 'in_progress', raw: '' };
  if (profile.questionIds.length === 0) return { outcome: 'completed', raw: '' };
  const correct = profile.questionIds.filter((id) => answers.get(id) === '1').length;
  const score = Math.round((correct / profile.questionIds.length) * 100);
  return { outcome: score >= (profile.masteryScore ?? DEFAULT_MASTERY) ? 'passed' : 'failed', raw: String(score) };
}
