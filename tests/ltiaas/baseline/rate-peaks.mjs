#!/usr/bin/env node
// Request-rate peaks of one suite run (LA-E0-02 AC-05, AC-06, AC-07), no Docker. It reads the `http_request` lines
// of the service logs of the run clone (infra/.logs/cogniate-app.jsonl, lti-service.jsonl) inside one time window.
//   node tests/ltiaas/baseline/rate-peaks.mjs --logs <clone>/infra/.logs --from <ISO> --to <ISO> --suite <name>
// Output (JSON): the peak count in any 60 s window and in any 10 s window, per app route (/tool/launch,
// /tool/deep-link) and per LTI rate-limit class of LA-ADR-06 D1, and the peak open registration starts.
// Limits of the method (stated in the output): the logs name no client address and no API key. In a QA stack every
// browser and HTTP call comes from the one `e2e` container, and the app calls the LTI service from one address, so
// a class peak is the sum over its keys: an upper bound of the peak per key. `auth_failure` counts every 401 of an
// API route: an upper bound too (a 401 for an ltik or a service key under a valid API key spends no bucket).
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

const { values: opt } = parseArgs({ options: { logs: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' },
  suite: { type: 'string', default: '' } } });
if (!opt.logs) { console.error('--logs <infra/.logs folder> is required'); process.exit(2); }
const from = opt.from ? Date.parse(opt.from) : -Infinity, to = opt.to ? Date.parse(opt.to) : Infinity;

/** LA-ADR-06 D1 default limits (per minute, burst) and the route rule of each class. */
export const CLASSES = {
  protocol: { limit: 600, burst: 200, key: 'client address', match: (m, p) => /^\/lti\/login\/[^/]+$/.test(p) || (m === 'POST' && /^\/lti\/launch\/[^/]+(?:\/storage-check)?$/.test(p)) },
  protocol_account: { limit: 6000, burst: 1000, key: 'tool account (soft)', match: (m, p) => CLASSES.protocol.match(m, p) },
  registration: { limit: 10, burst: 5, key: 'client address', match: (m, p) => m === 'GET' && /^\/lti\/register\/[^/]+$/.test(p) },
  registration_account: { limit: 1, burst: 20, key: 'tool account (soft)', match: (m, p) => CLASSES.registration.match(m, p) },
  keys: { limit: 300, burst: 100, key: 'client address', match: (m, p) => m === 'GET' && /^\/lti\/keys\/[^/]+$/.test(p) },
  api: { limit: 1200, burst: 300, key: 'API key id', match: (m, p, s) => s !== 401 && /^\/api\/(?:idtoken|deeplinking|lineitems|memberships)(?:\/|$)/.test(p) },
  admin: { limit: 1200, burst: 600, key: 'API key id', match: (m, p, s) => s !== 401 && /^\/api\/(?:platforms|registrations|providers)(?:\/|$)/.test(p) },
  auth_failure: { limit: 120, burst: 120, key: 'client address', match: (m, p, s) => s === 401 && /^\/api\//.test(p) },
};
/** The account of a protocol, registration or keys path (`/lti/<kind>/<account>`). */
const accountOf = (p) => p.match(/^\/lti\/(?:login|launch|register|keys)\/([^/?]+)/)?.[1] ?? null;

function readRequests(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).flatMap((line) => {
    try { const e = JSON.parse(line); return e.event === 'http_request' ? [e] : []; } catch { return []; }
  }).map((e) => ({ t: Date.parse(e.ts), method: e.method, path: String(e.path ?? '').split('?')[0], status: e.status }))
    .filter((e) => e.t >= from && e.t <= to);
}
/** The largest number of times in any window of `ms` (times sorted). */
export function peak(times, ms) {
  let best = 0;
  for (let i = 0, j = 0; j < times.length; j++) { while (times[j] - times[i] >= ms) i++; best = Math.max(best, j - i + 1); }
  return best;
}
const stats = (list) => { const times = list.map((e) => e.t).sort((a, b) => a - b); return { total: times.length, perMinute: peak(times, 60_000), per10s: peak(times, 10_000) }; };

const app = readRequests(path.join(opt.logs, 'cogniate-app.jsonl'));
const lti = readRequests(path.join(opt.logs, 'lti-service.jsonl'));
const out = { suite: opt.suite, window: { from: opt.from ?? null, to: opt.to ?? null }, requests: { app: app.length, lti: lti.length },
  appRoutes: {}, ltiClasses: {}, notes: [
    'No client address and no API key in the logs: a class peak is the sum over its keys (an upper bound of the peak per key).',
    'auth_failure counts every 401 of an /api/ route (an upper bound).',
  ] };
for (const route of ['/tool/launch', '/tool/deep-link']) {
  out.appRoutes[route] = { ...stats(app.filter((e) => e.method === 'GET' && e.path === route)), limit: 600, burst: 200 };
}
for (const [name, c] of Object.entries(CLASSES)) {
  const hits = lti.filter((e) => c.match(e.method, e.path, e.status));
  const entry = { ...stats(hits), limit: c.limit, burst: c.burst, key: c.key };
  if (name.endsWith('_account')) {
    entry.perAccount = Object.fromEntries([...new Set(hits.map((e) => accountOf(e.path)))].map((a) => [a, stats(hits.filter((e) => accountOf(e.path) === a))]));
  }
  entry.overDefault = entry.perMinute > c.limit || entry.per10s > c.burst;
  out.ltiClasses[name] = entry;
}
// Open registration sessions per (address, account): every start opens one; a start is GET /lti/register/<account>.
// The peak number of starts in any 10 min window bounds the open sessions from above.
const starts = lti.filter((e) => CLASSES.registration.match(e.method, e.path));
out.registrationStarts = Object.fromEntries([...new Set(starts.map((e) => accountOf(e.path)))].map((a) => {
  const times = starts.filter((e) => accountOf(e.path) === a).map((e) => e.t).sort((x, y) => x - y);
  return [a, { total: times.length, per10min: peak(times, 600_000) }];
}));
out.appOverDefault = Object.entries(out.appRoutes).filter(([, v]) => v.perMinute > 600 || v.per10s > 200).map(([k]) => k);
console.log(JSON.stringify(out, null, 2));
