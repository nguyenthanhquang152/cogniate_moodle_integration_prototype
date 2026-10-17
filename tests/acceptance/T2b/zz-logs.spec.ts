// T2b cross-checks over the whole T2b run; runs after the other T2b specs (file name order).
// Source: tasks/T2b.md AC-T2-30; security §2.2 (check → code), §9 (outbound events), §11; local-stack §3.
// The host runner checks the last part ("profile": "default" after npm run test:acceptance ends).
import fs from 'node:fs';
import path from 'node:path';
import { publicUrls } from '../lib/env';
import { httpsRequest } from '../lib/https';
import {
  ACCOUNT,
  apiKey,
  auth,
  capturedErrorPages,
  capturedSecrets,
  CHECK_OF_CODE,
  errorCode,
  eventsSince,
  hostIs,
  ltiApi,
  runStart,
  sinkHitsSince,
  waitForEvent,
} from '../lib/lti';
import { LOGS_DIR } from '../lib/paths';
import { expect, test } from '../lib/pw';
import { QA_ISSUER } from '../lib/qa-platform';

const urls = publicUrls();
const T2B_PAGES = /^AC-T2-(09|1[0-5]|2[0-8])$/;
/** A JWT or JWS part, an API key, a PEM block, or a 43-char random value (ltik, state, nonce). */
const UNSAFE_DETAIL = /eyJ[A-Za-z0-9_-]{8,}|ltis_|-----BEGIN|(^|[^A-Za-z0-9_-])[A-Za-z0-9_-]{43}([^A-Za-z0-9_-]|$)/;

test('AC-T2-30 profile, sink, error-page events, JWKS hit count and secrets over the T2b run', async () => {
  test.setTimeout(120_000);
  const start = runStart('T2b');
  const problems: string[] = [];

  // 1. Profile during the run.
  for (const [name, url] of Object.entries({ lti: urls.lti, app: urls.app })) {
    const body = JSON.parse((await httpsRequest(`${url}/healthz`)).body) as { profile?: string };
    if (body.profile !== 'acceptance') problems.push(`${name} /healthz profile = ${body.profile ?? 'missing'}, want acceptance`);
  }

  // 2. AC-T2-29 repeated with the sink: the rule refuses evil.test before any request.
  const since29 = Date.now() - 1_000;
  const key = apiKey(ACCOUNT);
  const base = {
    url: urls.moodle,
    name: 'QA AC-T2-29 repeat',
    authenticationEndpoint: `${urls.moodle}/mod/lti/auth.php`,
    accesstokenEndpoint: `${urls.moodle}/mod/lti/token.php`,
    authConfig: { method: 'JWK_SET', key: `${urls.moodle}/mod/lti/certs.php` },
    deploymentIds: ['1'],
  };
  for (const [label, over] of [
    ['jwks', { authConfig: { method: 'JWK_SET', key: 'https://evil.test/jwks' } }],
    ['token', { accesstokenEndpoint: 'https://evil.test/token' }],
    ['auth', { authenticationEndpoint: 'https://evil.test/auth' }],
  ] as const) {
    const res = await ltiApi('POST', '/api/platforms', { authorization: auth.bearer(key), body: { ...base, clientId: `qa-t2b-29-${label}-${start}`, ...over } });
    if (res.status !== 400 || errorCode(res) !== 'PLATFORM_URL_NOT_ON_ISSUER_ORIGIN') problems.push(`AC-T2-29 repeat ${label}: ${res.status} ${errorCode(res)}`);
  }
  await new Promise((r) => setTimeout(r, 2_000));
  const sink = sinkHitsSince(since29);
  if (sink.length) problems.push(`sink_hit after the AC-T2-29 repeat: ${sink.length}`);
  const evilEvents = eventsSince('lti-service', since29, (e) => /^outbound_/.test(String(e.event)) && hostIs(e, 'evil.test'));
  if (evilEvents.length) problems.push(`outbound_* events for evil.test: ${evilEvents.length}`);

  // 3. Every error page of AC-T2-09 to AC-T2-28: markers, and an event with the right check and code.
  const pages = capturedErrorPages().filter((p) => T2B_PAGES.test(p.test));
  const secretValues = capturedSecrets().map((x) => x.value).filter((v) => v && v.length >= 8);
  if (pages.length === 0) problems.push('no error pages were recorded (the T2b checks did not run)');
  for (const p of pages) {
    if (!p.code || !p.traceId || !p.pageShowsTraceId) problems.push(`${p.test} ${p.code || '?'}: data-error-code or data-trace-id missing`);
    // 2254792: the next-action sentence is one non-empty data-error-action element (security §2.2).
    if (p.actionCount !== 1 || !p.actionText) problems.push(`${p.test} ${p.code || '?'}: ${p.actionCount ?? 0} data-error-action elements (text "${p.actionText ?? ''}"), want one non-empty`);
    const event = await waitForEvent(
      'lti-service',
      (e) => e.trace_id === p.traceId && (e.event === 'launch_check_failed' || e.event === 'login_rejected'),
      3_000,
    );
    if (!event) {
      problems.push(`${p.test} ${p.code}: no launch_check_failed or login_rejected event with trace id ${p.traceId}`);
      continue;
    }
    if (event.code !== p.code) problems.push(`${p.test}: event code ${String(event.code)}, page code ${p.code}`);
    if (event.event === 'launch_check_failed' && CHECK_OF_CODE[p.code] && !CHECK_OF_CODE[p.code].includes(String(event.check))) {
      problems.push(`${p.test} ${p.code}: check ${String(event.check)}, want ${CHECK_OF_CODE[p.code].join(' or ')}`);
    }
    // B-T2a-03 (c3746bb): launch_check_failed has a non-empty, safe `detail` (contract §5 lists it for this event only).
    if (event.event === 'launch_check_failed') {
      const detail = String(event.detail ?? '');
      if (!detail) problems.push(`${p.test} ${p.code}: launch_check_failed has no detail`);
      else if (UNSAFE_DETAIL.test(detail) || secretValues.some((v) => detail.includes(v))) problems.push(`${p.test} ${p.code}: detail contains a token or key`);
    }
    if (p.endpoint === 'login' && event.event !== 'login_rejected') problems.push(`${p.test}: login page but event ${String(event.event)}`);
  }

  // 4. JWKS fetches of the QA platform: hits on the JWKS paths = outbound_request events to qa-platform.test.
  const qaHost = new URL(QA_ISSUER).hostname;
  const hits = eventsSince('qa-platform', start, (e) => e.event === 'qa_platform_hit' && /\/jwks-[^/]+\.json$/.test(String(e.path)));
  const fetches = eventsSince('lti-service', start, (e) => e.event === 'outbound_request' && hostIs(e, qaHost));
  if (hits.length !== fetches.length) problems.push(`qa_platform_hit on JWKS paths = ${hits.length}, outbound_request to ${qaHost} = ${fetches.length}`);
  if (hits.length === 0) problems.push('no JWKS fetch of the QA platform in this run (the count proves nothing)');

  // 5. No captured secret of this run in any log file.
  const secrets = capturedSecrets().filter((s) => s.kind !== 'nonce');
  for (const f of fs.readdirSync(LOGS_DIR).filter((n) => n.endsWith('.jsonl'))) {
    const text = fs.readFileSync(path.join(LOGS_DIR, f), 'utf8');
    for (const s of secrets) if (text.includes(s.value)) problems.push(`${f} contains a captured ${s.kind} (${s.value.slice(0, 6)}…, ${s.value.length} chars)`);
  }

  test.info().annotations.push({ type: 'counts', description: `error pages ${pages.length}; JWKS hits ${hits.length}; QA fetches ${fetches.length}; secrets ${secrets.length}` });
  expect(problems).toEqual([]);
});
