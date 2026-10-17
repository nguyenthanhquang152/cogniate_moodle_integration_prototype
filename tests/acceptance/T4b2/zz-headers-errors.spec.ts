// T4b2: page headers of the tool pages and the error page markers, over the pages that the earlier T4b specs met.
// Source: tasks/T4b2.md AC-T4-21, AC-T4-32; security §5 (page headers); contract cogniate-app-api.md §6, §12.
// Runs after the other T4b2 specs (file name order); the host runner runs it with AC-T4-18 in its second pass.
import { publicUrls } from '../lib/env';
import { capturedErrorPages, waitForEvent } from '../lib/lti';
import { expect, test } from '../lib/pw';
import { t4b } from '../lib/t4b-state';

const urls = publicUrls();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TOOL_EVENTS = new Set(['launch_rejected', 'picker_rejected', 'handoff_rejected', 'registration_confirm_rejected']);

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

test('AC-T4-32 every tool page error has data-error-code and data-trace-id, and its trace id is in the matching log event', async () => {
  const pages = capturedErrorPages().filter((p) => p.endpoint === 'tool');
  expect(pages.length, 'tool error pages recorded by the T4b specs').toBeGreaterThan(0);
  const problems: string[] = [];
  for (const p of pages) {
    if (!p.code || !p.traceId) {
      problems.push(`${p.test}: code ${p.code || 'missing'}, trace id ${p.traceId || 'missing'}`);
      continue;
    }
    const ev = await waitForEvent('cogniate-app', (e) => e.trace_id === p.traceId && TOOL_EVENTS.has(String(e.event)), 3_000);
    if (!ev) problems.push(`${p.test} ${p.code}: no ${[...TOOL_EVENTS].join('/')} event with trace id ${p.traceId}`);
  }
  test.info().annotations.push({ type: 'pages', description: pages.map((p) => `${p.test}:${p.code}`).join(', ') });
  expect(problems).toEqual([]);
});
