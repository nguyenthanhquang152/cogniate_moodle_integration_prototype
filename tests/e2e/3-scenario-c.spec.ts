// T7 Scenario C: security smoke in the real flow (tasks/T7.md C1, C2; AC-T7-10).
// C1: the learner launch form (id_token + state) captured in A5 is posted again → INVALID_STATE (security §2: check 1,
//     the state record is used up), from a browser page and from Node, both with the state cookie of the first launch.
// C2: every captured ltik, service key, runtime token, id_token and API key is searched in all infra/.logs/*.jsonl.
import fs from 'node:fs';
import path from 'node:path';
import { httpsRequest } from '../acceptance/lib/https';
import { readLog } from '../acceptance/lib/logs';
import { SECRETS_DIR } from '../acceptance/lib/paths';
import { LAUNCH_URL } from './lib/capture';
import { capturedSecrets, loadState, masked, need, recordSecret, type SecretKind, shot, urls, writeEvidence } from './lib/e2e';
import { logFiles } from './lib/health';
import { expect, newContext, test } from './lib/pw';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const errorCode = (html: string) => /data-error-code="([^"]+)"/.exec(html)?.[1] ?? '';

test('C1 AC-T7-10 the captured learner launch form (id_token + state) posted again → INVALID_STATE, no redirect (browser and Node)', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const replay = need(loadState().replay, 'a captured learner launch form (A5)');
  expect(replay.firstStatus, 'the first post of this form launched (303)').toBe(303);
  const startedAt = Date.now();

  // (a) A browser page posts the same form again; the context has the state cookie of the first launch.
  const ctx = await newContext(browser);
  try {
    const cookies = replay.cookie
      .split(';')
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => ({ name: c.slice(0, c.indexOf('=')), value: c.slice(c.indexOf('=') + 1), url: `${urls.lti}/`, secure: true, sameSite: 'None' as const }));
    if (cookies.length) await ctx.addCookies(cookies).catch((e: Error) => testInfo.annotations.push({ type: 'cookie', description: `addCookies: ${e.message}` }));
    const page = await ctx.newPage();
    await page.setContent(
      `<form id="f" method="post" action="${esc(LAUNCH_URL)}"><input type="hidden" name="id_token" value="${esc(replay.id_token)}"><input type="hidden" name="state" value="${esc(replay.state)}"></form>`,
    );
    const resP = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().startsWith(LAUNCH_URL), { timeout: 15_000 });
    await page.evaluate(() => (document.getElementById('f') as HTMLFormElement).submit());
    const res = await resP;
    const body = await res.text().catch(() => '');
    testInfo.annotations.push({ type: 'C1 browser', description: `HTTP ${res.status()}, data-error-code ${errorCode(body)}` });
    expect.soft(res.status(), 'browser replay: not a redirect').not.toBe(303);
    expect.soft(errorCode(body), 'browser replay: error page code').toBe('INVALID_STATE');
    await page.waitForLoadState('load');
    await shot(page, 'C1-browser-replay', testInfo);
  } finally {
    await ctx.close();
  }

  // (b) Node posts the same form with the state cookie.
  const body = new URLSearchParams({ id_token: replay.id_token, state: replay.state }).toString();
  const node = await httpsRequest(LAUNCH_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'content-length': String(Buffer.byteLength(body)), cookie: replay.cookie, origin: urls.moodle, referer: `${urls.moodle}/` },
    body,
  });
  testInfo.annotations.push({ type: 'C1 node', description: `HTTP ${node.status}, data-error-code ${errorCode(node.body)}` });
  expect.soft(node.status, 'Node replay: not a redirect').not.toBe(303);
  expect.soft(errorCode(node.body), 'Node replay: error page code').toBe('INVALID_STATE');

  // Log evidence: launch_check_failed with code INVALID_STATE after the replays.
  const failed = readLog('lti-service').entries.filter((e) => e.entry.event === 'launch_check_failed' && Date.parse(String(e.entry.ts)) >= startedAt - 2_000);
  writeEvidence('C1-replay.json', { browserAndNode: testInfo.annotations.filter((a) => a.type.startsWith('C1')), logLines: failed.map((e) => e.entry) });
  expect.soft(failed.some((e) => e.entry.code === 'INVALID_STATE'), 'lti-service log: launch_check_failed {code: INVALID_STATE}').toBe(true);
});

/** Search strings for one secret: the value and, for a JWT, its payload and its signature part. */
function needles(value: string): string[] {
  const parts = value.split('.');
  const out = [value];
  if (parts.length === 3 && parts.every((p) => /^[A-Za-z0-9_-]+$/.test(p))) out.push(parts[1], parts[2]);
  return out.filter((n) => n.length >= 16);
}

test('C2 AC-T7-10 no captured ltik, service key, runtime token, id_token or API key is in any infra/.logs/*.jsonl', async () => {
  test.setTimeout(120_000);
  // API keys of the tool accounts (infra/.secrets, read-only in the e2e container).
  const keyFiles = fs.existsSync(SECRETS_DIR) ? fs.readdirSync(SECRETS_DIR).filter((f) => f.startsWith('lti-api-key.')) : [];
  for (const f of keyFiles) recordSecret('api_key', fs.readFileSync(path.join(SECRETS_DIR, f), 'utf8').trim(), `infra/.secrets/${f}`);
  // Service keys: GET /api/idtoken with each captured ltik and the cogniate API key gives services.serviceKey.
  const apiKey = keyFiles.includes('lti-api-key.cogniate') ? fs.readFileSync(path.join(SECRETS_DIR, 'lti-api-key.cogniate'), 'utf8').trim() : '';
  for (const s of capturedSecrets().filter((x) => x.kind === 'ltik')) {
    const res = await httpsRequest(`${urls.lti}/api/idtoken`, { headers: { accept: 'application/json', authorization: `LTIK-AUTH-V2 ${apiKey}:${s.value}` } });
    try {
      const key = (JSON.parse(res.body) as { services?: { serviceKey?: string } }).services?.serviceKey;
      recordSecret('service_key', key, `GET /api/idtoken for the ltik of ${s.where}`);
    } catch {
      // not JSON: no service key from this ltik
    }
  }

  const logs = logFiles().map((f) => ({ name: path.basename(f), text: fs.readFileSync(f, 'utf8') }));
  const asked: SecretKind[] = ['ltik', 'service_key', 'runtime_token', 'id_token', 'api_key'];
  const report = capturedSecrets().map((s) => {
    const hits = logs.filter((l) => needles(s.value).some((n) => l.text.includes(n))).map((l) => l.name);
    return { kind: s.kind, secret: masked(s.value), where: s.where, hits };
  });
  const counts = Object.fromEntries(asked.map((k) => [k, report.filter((r) => r.kind === k).length]));
  writeEvidence('C2-secret-grep.json', { logFiles: logs.map((l) => `${l.name} (${l.text.length} bytes)`), counts, report });
  for (const k of asked) expect.soft(counts[k], `captured at least one ${k} (else the grep proves nothing)`).toBeGreaterThan(0);
  expect(report.filter((r) => asked.includes(r.kind) && r.hits.length > 0), 'captured secrets found in the logs').toEqual([]);
  // state values and the registration ref are not in the AC list; a hit is still listed in qa.md.
  const extra = report.filter((r) => !asked.includes(r.kind) && r.hits.length > 0);
  if (extra.length) test.info().annotations.push({ type: 'info', description: `other values in the logs: ${JSON.stringify(extra)}` });
});
