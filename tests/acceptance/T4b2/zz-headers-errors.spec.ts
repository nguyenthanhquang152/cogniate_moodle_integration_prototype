// T4b2: page headers of the tool pages and the error page markers, over the pages that the earlier T4b specs met.
// Source: tasks/T4b2.md AC-T4-21, AC-T4-32; security §5 (page headers); contract cogniate-app-api.md §6, §12.
// Runs after the other T4b2 specs (file name order). The host runner runs it in pass 2, after the AC-T4-18 setup
// (T4b2.md setup order), with fresh: false, so the pages of pass 1 and the knob passes are still recorded.
import { publicUrls } from '../lib/env';
import { capturedErrorPages, waitForEvent } from '../lib/lti';
import { expect, test } from '../lib/pw';
import { t4b } from '../lib/t4b-state';

const urls = publicUrls();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** AC-T4-32 (c3746bb): the log event of each tool error page, by the AC that made the page. */
function expectedEvent(p: { test: string; status: number }): { event: string; reason?: string } | undefined {
  switch (p.test) {
    case 'AC-T4-18':
    case 'AC-T4-27':
      return { event: 'launch_rejected' };
    case 'AC-T4-24':
      return { event: 'handoff_rejected' };
    case 'AC-T4-26':
      return { event: 'picker_rejected' };
    case 'AC-T4-20':
      return p.status === 403 ? { event: 'deep_link_rejected', reason: 'role_not_allowed' } : { event: 'picker_rejected' };
    default:
      return undefined;
  }
}
/** Pages of other ACs (not in the AC-T4-32 list): any tool rejection event is accepted. */
const OTHER_TOOL_EVENTS = new Set(['launch_rejected', 'picker_rejected', 'handoff_rejected', 'deep_link_rejected', 'csrf_rejected', 'registration_confirm_rejected']);
/** Pages that AC-T4-32 names. Each must have been met in this run. */
const NAMED = ['AC-T4-18', 'AC-T4-27', 'AC-T4-24', 'AC-T4-26', 'AC-T4-20'];

function headerProblems(label: string, h: Record<string, string> | undefined, want: { csp: RegExp[]; framed: boolean }): string[] {
  if (!h || Object.keys(h).length === 0) return [`${label}: no headers recorded (the flow did not run)`];
  const p: string[] = [];
  const csp = h['content-security-policy'] ?? '';
  for (const re of want.csp) if (!re.test(csp)) p.push(`${label}: CSP does not match ${re} (${csp || 'no CSP'})`);
  if (h['referrer-policy'] !== 'same-origin') p.push(`${label}: Referrer-Policy ${h['referrer-policy'] ?? 'missing'}`);
  if (want.framed && 'x-frame-options' in h) p.push(`${label}: X-Frame-Options on a framed page`);
  if ('set-cookie' in h) p.push(`${label}: Set-Cookie`);
  return p;
}

test('AC-T4-21 headers of the picker, the picker POST result, /play, /play/…/embedded and the error pages', () => {
  const st = t4b();
  const moodle = esc(urls.moodle);
  const nonce = /script-src[^;]*'nonce-[^']+'/;
  const problems = [
    ...headerProblems('picker GET', st.pickerGetHeaders, { csp: [new RegExp(`frame-ancestors\\s+${moodle}(\\s*;|\\s*$)`), /form-action\s+'self'/], framed: true }),
    ...headerProblems('picker POST result', st.pickerPostHeaders, { csp: [new RegExp(`form-action\\s+${moodle}(\\s*;|\\s*$)`), nonce], framed: true }),
    ...headerProblems('/play/<id>', st.playHeaders, { csp: [/frame-ancestors\s+'none'/, nonce], framed: false }),
    ...headerProblems('/play/<id>/embedded', st.embeddedHeaders, { csp: [new RegExp(`frame-ancestors\\s+${moodle}(\\s*;|\\s*$)`)], framed: true }),
    ...headerProblems('error page (AC-T4-18)', st.errorPageHeaders, { csp: [/frame-ancestors\s+https:/, /form-action\s+'none'/], framed: true }),
  ];
  expect(problems).toEqual([]);
});

test('AC-T4-32 every tool page error shows its code and trace id (data-error-code, data-trace-id) and has no form; its trace id is in the matching log event', async () => {
  const pages = capturedErrorPages().filter((p) => p.endpoint === 'tool' && p.test.startsWith('AC-T4-'));
  const problems: string[] = [];
  for (const id of NAMED) if (!pages.some((p) => p.test === id)) problems.push(`${id}: no tool error page recorded (the AC did not run or failed early)`);
  if (!pages.some((p) => p.test === 'AC-T4-20' && p.status === 403)) problems.push('AC-T4-20: the 403 /tool/deep-link page was not recorded');
  for (const p of pages) {
    const label = `${p.test} ${p.status} ${p.code || '?'}`;
    if (!p.code || !p.traceId) {
      problems.push(`${label}: data-error-code ${p.code || 'missing'}, data-trace-id ${p.traceId || 'missing'}`);
      continue;
    }
    if (!p.pageShowsCode) problems.push(`${label}: the code is not in the visible text`);
    if (!p.pageShowsTraceId) problems.push(`${label}: the trace id is not in the visible text`);
    if (p.hasForm) problems.push(`${label}: the error page has a form`);
    const want = expectedEvent(p);
    const ev = await waitForEvent(
      'cogniate-app',
      (e) => e.trace_id === p.traceId && (want ? e.event === want.event : OTHER_TOOL_EVENTS.has(String(e.event))),
      3_000,
    );
    if (!ev) problems.push(`${label}: no ${want?.event ?? [...OTHER_TOOL_EVENTS].join('/')} event with trace id ${p.traceId}`);
    else if (want?.reason && ev.reason !== want.reason) problems.push(`${label}: ${want.event} reason ${String(ev.reason)}, want ${want.reason}`);
  }
  test.info().annotations.push({ type: 'pages', description: pages.map((p) => `${p.test}:${p.status}:${p.code}`).join(', ') });
  test.info().annotations.push({ type: 'not checked', description: '"one action line": the contracts give no marker for it (spec note to the Architect)' });
  expect(problems).toEqual([]);
});
