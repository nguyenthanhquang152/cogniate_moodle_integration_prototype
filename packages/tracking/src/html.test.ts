import { describe, expect, it } from 'vitest';
import { agsScore, checkHtmlProgress, htmlOutcome } from './index.ts';
import type { HtmlProgress } from './index.ts';

const profile = { pages: ['index', 'lesson-ai-web-sprint'], menuPage: 'index', questionIds: ['01M2M36Y89M9KPPZENF1ZW4AWJ'], masteryScore: 70, minDwellMs: 10000 };
const Q = '01M2M36Y89M9KPPZENF1ZW4AWJ';

describe('HTML progress rules (app contract §7, ADR-004)', () => {
  it('seenPages must be profile pages; answers keyed by profile questions with "1"/"0"', () => {
    expect(checkHtmlProgress({ seenPages: ['index', 'other'] }, profile, null)).toEqual({ ok: false, field: 'progress.seenPages' });
    expect(checkHtmlProgress({ answers: { toString: '1' } }, profile, null)).toEqual({ ok: false, field: 'progress.answers' });
    expect(checkHtmlProgress(JSON.parse('{"answers":{"__proto__":"1"}}'), profile, null)).toEqual({ ok: false, field: 'progress.answers' });
    expect(checkHtmlProgress({ answers: { [Q]: 'yes' } }, profile, null)).toEqual({ ok: false, field: `progress.answers.${Q}` });
    expect(checkHtmlProgress('x', profile, null)).toEqual({ ok: false, field: 'progress' });
  });
  it('the first answer stands: a saved answer never changes', () => {
    const saved = checkHtmlProgress({ seenPages: ['index'], answers: { [Q]: '0' } }, profile, null);
    expect(saved.ok).toBe(true);
    const first = (saved as { progress: HtmlProgress }).progress;
    expect(checkHtmlProgress({ answers: { [Q]: '1' } }, profile, first)).toEqual({ ok: false, field: `progress.answers.${Q}` });
    const again = checkHtmlProgress({ seenPages: ['lesson-ai-web-sprint'], answers: { [Q]: '0' } }, profile, first);
    expect(again.ok && again.progress.seenPages).toEqual(['index', 'lesson-ai-web-sprint']); // merged, profile order
    expect(again.ok && Object.getPrototypeOf(again.progress.answers)).toBeNull();
  });
  it('outcome: complete = all pages and all questions; score >= mastery passes; no questions -> completed', () => {
    const p = (seen: string[], a: Record<string, '1' | '0'>) => ({ seenPages: seen, answers: a });
    expect(htmlOutcome(p(['index'], {}), profile)).toEqual({ outcome: 'in_progress', raw: '' });
    expect(htmlOutcome(p(['index', 'lesson-ai-web-sprint'], {}), profile)).toEqual({ outcome: 'in_progress', raw: '' }); // dwell done, no answer
    expect(htmlOutcome(p(['index'], { [Q]: '1' }), profile)).toEqual({ outcome: 'in_progress', raw: '' }); // AC-T5-29: answered, page not seen
    expect(htmlOutcome(p(['index', 'lesson-ai-web-sprint'], { [Q]: '1' }), profile)).toEqual({ outcome: 'passed', raw: '100' });
    expect(htmlOutcome(p(['index', 'lesson-ai-web-sprint'], { [Q]: '0' }), profile)).toEqual({ outcome: 'failed', raw: '0' });
    expect(htmlOutcome(p(['index'], {}), { ...profile, pages: ['index'], questionIds: [] })).toEqual({ outcome: 'completed', raw: '' });
    expect(agsScore('failed', '0', '100')).toEqual({ scoreGiven: 0, scoreMaximum: 100 });
  });
});
