// T3b: line item URL encoding and the score timestamp limit. Source: tasks/T3b.md AC-T3-29 (A-T3a-01), AC-T3-30;
// contract lti-service-api.md §3.4 (line item URL rule), §3.6 (scores); security §8, §9.
// Uses the T3a state of the same run (T3a runs before T3b): the "QA DL" line item URL, its service key, a student
// ltik (tests/acceptance/T3a/2-scores.spec.ts, AC-T3-11).
import { ACCOUNT, apiKey, auth, errorCode, eventsSince, hostIs, loadState, ltiApi, sinkHitsSince } from '../lib/lti';
import { publicUrls } from '../lib/env';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';

const urls = publicUrls();
const MOODLE_HOST = new URL(urls.moodle).hostname;

function t3a(): { lineItemId: string; serviceKey: string; studentLtik: string } {
  const st = loadState('T3a') as { lineItemId?: string; serviceKey?: string; studentLtik?: string };
  return { lineItemId: String(st.lineItemId ?? ''), serviceKey: String(st.serviceKey ?? ''), studentLtik: String(st.studentLtik ?? '') };
}

/**
 * Variants of the real line item URL: the origin, the path prefix and the query (type_id) stay; only the part before
 * the last "/lineitem" segment changes. Built as strings (a URL parser would normalise them).
 */
function variants(real: string): [string, string][] {
  const q = real.indexOf('?');
  const pathPart = q >= 0 ? real.slice(0, q) : real;
  const query = q >= 0 ? real.slice(q) : '';
  const cut = pathPart.lastIndexOf('/lineitem');
  if (cut < 0) throw new Error(`line item URL without "/lineitem": ${real}`);
  const base = pathPart.slice(0, cut); // …/lineitems/<id>
  const id = base.slice(base.lastIndexOf('/') + 1);
  const tail = pathPart.slice(cut); // /lineitem
  return [
    ['%2F', `${base}%2F..%2F${id}${tail}${query}`],
    ['%2f', `${base}%2f..%2f${id}${tail}${query}`],
    ['%5C', `${base}%5C..%5C${id}${tail}${query}`],
    ['%5c', `${base}%5c..%5c${id}${tail}${query}`],
    ['%252F', `${base}%252F..%252F${id}${tail}${query}`],
    ['%2E%2E', `${base}/%2E%2E/${id}${tail}${query}`],
    ['backslash', `${base}\\..\\${id}${tail}${query}`],
    ['/../', `${base}/../${id}${tail}${query}`],
    ['/./', `${base}/.${tail}${query}`],
  ];
}

const score = (userId: string, timestamp?: string) => ({
  userId,
  activityProgress: 'Completed',
  gradingProgress: 'FullyGraded',
  scoreGiven: 50,
  scoreMaximum: 100,
  ...(timestamp ? { timestamp } : {}),
});

test('AC-T3-29 line item ids with encoded or raw separators, double encoding, encoded dots, ../ or ./ → 400 INVALID_LINE_ITEM_ID (POST and GET scores), no outbound_* to Moodle, no sink_hit', async () => {
  test.setTimeout(180_000);
  const st = t3a();
  expect(st.lineItemId && st.serviceKey && st.studentLtik, 'T3a state: line item, service key, student ltik (run T3a first)').toBeTruthy();
  const key = apiKey(ACCOUNT);
  const sub = String(seed().users.cg_student.id);
  const since = Date.now() - 1_000;
  const problems: string[] = [];
  const traces: string[] = [];
  for (const [label, url] of variants(st.lineItemId)) {
    const enc = encodeURIComponent(url);
    const post = await ltiApi('POST', `/api/lineitems/${enc}/scores`, { authorization: auth.service(key, st.serviceKey), body: score(sub) });
    const get = await ltiApi('GET', `/api/lineitems/${enc}/scores?userId=${encodeURIComponent(sub)}`, { authorization: auth.ltik(key, st.studentLtik) });
    for (const [verb, res] of [['POST', post], ['GET', get]] as const) {
      if (res.status !== 400 || errorCode(res) !== 'INVALID_LINE_ITEM_ID') problems.push(`${label} ${verb}: HTTP ${res.status} ${errorCode(res) ?? ''} (want 400 INVALID_LINE_ITEM_ID)`);
      if (res.traceId) traces.push(res.traceId);
    }
  }
  await new Promise((r) => setTimeout(r, 2_000)); // log lines arrive
  const outbound = eventsSince('lti-service', since, (e) => /^outbound_/.test(String(e.event)) && hostIs(e, MOODLE_HOST) && traces.includes(String(e.trace_id)));
  if (outbound.length) problems.push(`outbound_* events to ${MOODLE_HOST} for these responses: ${outbound.length}`);
  const sink = sinkHitsSince(since);
  if (sink.length) problems.push(`sink_hit lines: ${sink.length}`);
  expect(problems).toEqual([]);
});

test('AC-T3-30 score timestamp limit: now + 10 min → accepted (204 or 409 PLATFORM_CONFLICT); now + 16 min → 400 INVALID_REQUEST naming timestamp, no outbound request', async () => {
  test.setTimeout(120_000);
  const st = t3a();
  expect(st.lineItemId && st.serviceKey, 'T3a state (run T3a first)').toBeTruthy();
  const key = apiKey(ACCOUNT);
  // cg_student2: a future grade time must not block later score posts for cg_student.
  const sub = String(seed().users.cg_student2.id);
  const enc = encodeURIComponent(st.lineItemId);
  const ok = await ltiApi('POST', `/api/lineitems/${enc}/scores`, { authorization: auth.service(key, st.serviceKey), body: score(sub, new Date(Date.now() + 10 * 60_000).toISOString()) });
  expect([204, 409], `now + 10 min: HTTP ${ok.status} ${ok.body.slice(0, 200)}`).toContain(ok.status);
  if (ok.status === 409) expect(errorCode(ok)).toBe('PLATFORM_CONFLICT');

  const since = Date.now() - 500;
  const late = await ltiApi('POST', `/api/lineitems/${enc}/scores`, { authorization: auth.service(key, st.serviceKey), body: score(sub, new Date(Date.now() + 16 * 60_000).toISOString()) });
  expect(late.status, late.body.slice(0, 200)).toBe(400);
  expect(errorCode(late)).toBe('INVALID_REQUEST');
  expect(late.body, 'the error names "timestamp"').toContain('timestamp');
  await new Promise((r) => setTimeout(r, 1_500));
  expect(eventsSince('lti-service', since, (e) => /^outbound_/.test(String(e.event)) && e.trace_id === late.traceId), 'no outbound request for the 400').toEqual([]);
});
