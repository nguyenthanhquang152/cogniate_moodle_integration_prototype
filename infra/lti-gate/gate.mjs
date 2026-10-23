// App-to-LTI transport gate (M3 §3.3), `acceptance` compose profile ONLY. Test infrastructure, not product code.
// In acceptance the app sends its LTI service API calls (/api/*) to https://lti-gate.test (LTI_API_URL); the gate
// forwards them to the real LTI service (UPSTREAM_URL = PUBLIC_LTI_URL). QA owns the scenarios (rules) and assertions.
//
//   POST /__gate/rules    {rules: [{id, method, pathRegex, action, times}]} (or the bare list): replaces the rule list;
//                         held requests stay held. Actions: pass | fail_before | hold_before | hold_after | drop_after.
//   POST /__gate/release  {requestId, then: "deliver" | "drop"}
//   GET  /__gate/events?since=<seq>&requestId=<id>
//   POST /__gate/reset    drops every held request WITHOUT forwarding, clears the rules, keeps the event log.
//   /__gate/* is never forwarded. Plain HTTP GET /healthz on :8080 (not logged).
//
// The gate delays network traffic only: it never aborts an upstream call because the caller left (a held request
// whose caller is gone can still be delivered: the "late write"), and it changes no URL check of either service.
// Events and log lines hold no header, body, query or secret. No dependencies (plain Node, read-only mount).
import { randomBytes } from 'node:crypto';
import { appendFileSync, readFileSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer, request as httpsRequest } from 'node:https';

const HOLD_LIMIT_MS = 600_000;
const LOG_FILE = `${process.env.LOG_DIR ?? '/logs'}/lti-gate.jsonl`;
const UPSTREAM = new URL(process.env.UPSTREAM_URL ?? 'https://lti.cogniate.test');
const BOOT = `boot-${randomBytes(6).toString('hex')}`;
const ACTIONS = new Set(['pass', 'fail_before', 'hold_before', 'hold_after', 'drop_after']);

let rules = [];
let seq = 0;
let requestSeq = 0;
const events = [];
/** requestId -> { phase: 'held_before' | 'held_after', ... } */
const held = new Map();

function log(level, event, fields = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, service: 'lti-gate', event, trace_id: BOOT, ...fields });
  try { appendFileSync(LOG_FILE, `${line}\n`); } catch { /* a missing log folder must not stop the gate */ }
  process.stdout.write(`${line}\n`);
}

/** One gate event (no header, body, query or secret). */
function emit(r, phase, extra = {}) {
  const e = { seq: ++seq, ts: new Date().toISOString(), request_id: r.id, rule_id: r.ruleId, method: r.method, path: r.path, phase, ...extra };
  events.push(e);
  log('info', 'gate_event', e);
  return e;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** Forward one request to the LTI service; resolves with the upstream answer (the caller may be gone). */
function forward(r) {
  return new Promise((resolve) => {
    const headers = { ...r.headers, host: UPSTREAM.host };
    delete headers.connection;
    const up = httpsRequest({ protocol: 'https:', hostname: UPSTREAM.hostname, port: UPSTREAM.port || 443, method: r.method, path: r.rawPath, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 502, headers: res.headers, body: Buffer.concat(chunks) }));
      res.on('error', () => resolve({ status: 502, headers: {}, body: Buffer.alloc(0) }));
    });
    up.on('error', () => resolve({ status: 502, headers: {}, body: Buffer.alloc(0) }));
    if (r.body.length > 0) up.write(r.body);
    up.end();
  });
}

function respond(r, answer) {
  if (r.callerGone || r.res.writableEnded) return false;
  const headers = { ...answer.headers };
  delete headers['transfer-encoding'];
  delete headers.connection;
  headers['content-length'] = String(answer.body.length);
  r.res.writeHead(answer.status, headers);
  r.res.end(answer.body);
  return true;
}

/** Close the caller's connection without an answer. */
function closeCaller(r) {
  if (r.callerGone || r.res.writableEnded) return;
  r.gateClosed = true; // the gate closes: this is `dropped`, not `caller_gone`
  r.res.socket?.destroy();
}

async function forwardAndFinish(r) {
  emit(r, 'forwarded');
  const answer = await forward(r);
  emit(r, 'upstream_completed', { status: answer.status });
  return answer;
}

async function handleMatched(r, rule) {
  emit(r, 'received');
  switch (rule.action) {
    case 'fail_before': {
      emit(r, 'failed_before', { status: 503 });
      respond(r, { status: 503, headers: { 'content-type': 'application/json' }, body: Buffer.from('{"error":"gate fail_before"}') });
      return;
    }
    case 'hold_before': {
      emit(r, 'held_before');
      held.set(r.id, { r, phase: 'held_before', timer: setTimeout(() => dropHeld(r.id, 'hold_limit'), HOLD_LIMIT_MS) });
      return;
    }
    case 'hold_after': {
      const answer = await forwardAndFinish(r);
      emit(r, 'held_after', { status: answer.status });
      held.set(r.id, { r, phase: 'held_after', answer, timer: setTimeout(() => dropHeld(r.id, 'hold_limit'), HOLD_LIMIT_MS) });
      return;
    }
    case 'drop_after': {
      await forwardAndFinish(r);
      closeCaller(r);
      emit(r, 'dropped');
      return;
    }
    default: {
      const answer = await forwardAndFinish(r);
      if (respond(r, answer)) emit(r, 'delivered', { status: answer.status });
    }
  }
}

function dropHeld(requestId, reason) {
  const h = held.get(requestId);
  if (!h) return false;
  clearTimeout(h.timer);
  held.delete(requestId);
  closeCaller(h.r);
  emit(h.r, 'dropped', reason ? { reason } : {});
  return true;
}

async function release(requestId, then) {
  const h = held.get(requestId);
  if (!h) return { ok: false, error: 'not held' };
  if (then === 'drop') {
    dropHeld(requestId);
    return { ok: true };
  }
  clearTimeout(h.timer);
  held.delete(requestId);
  if (h.phase === 'held_before') {
    // A late write when the caller is gone: forward anyway, discard the answer.
    const answer = await forwardAndFinish(h.r);
    if (respond(h.r, answer)) emit(h.r, 'delivered', { status: answer.status });
    return { ok: true, status: answer.status };
  }
  if (respond(h.r, h.answer)) emit(h.r, 'delivered', { status: h.answer.status });
  return { ok: true, status: h.answer.status };
}

function json(res, status, body) {
  const b = Buffer.from(JSON.stringify(body));
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': String(b.length) });
  res.end(b);
}

async function control(req, res, url, body) {
  const parse = () => { try { return JSON.parse(body.toString('utf8') || 'null'); } catch { return undefined; } };
  if (req.method === 'POST' && url.pathname === '/__gate/rules') {
    const v = parse();
    const list = Array.isArray(v) ? v : v?.rules;
    if (!Array.isArray(list) || !list.every((x) => x && typeof x.id === 'string' && typeof x.method === 'string' && typeof x.pathRegex === 'string' && ACTIONS.has(x.action))) {
      return json(res, 400, { error: 'rules: [{id, method, pathRegex, action, times}]' });
    }
    try {
      rules = list.map((x) => ({ id: x.id, method: x.method.toUpperCase(), regex: new RegExp(x.pathRegex), action: x.action, times: Number.isInteger(x.times) ? x.times : 1 }));
    } catch {
      return json(res, 400, { error: 'bad pathRegex' });
    }
    return json(res, 200, { rules: rules.length });
  }
  if (req.method === 'POST' && url.pathname === '/__gate/release') {
    const v = parse();
    if (!v || typeof v.requestId !== 'string' || (v.then !== 'deliver' && v.then !== 'drop')) return json(res, 400, { error: '{requestId, then: deliver|drop}' });
    const r = await release(v.requestId, v.then);
    return json(res, r.ok ? 200 : 404, r);
  }
  if (req.method === 'GET' && url.pathname === '/__gate/events') {
    const since = Number(url.searchParams.get('since') ?? '0') || 0;
    const id = url.searchParams.get('requestId');
    return json(res, 200, { events: events.filter((e) => e.seq > since && (!id || e.request_id === id)), held: [...held.keys()] });
  }
  if (req.method === 'POST' && url.pathname === '/__gate/reset') {
    for (const id of [...held.keys()]) dropHeld(id, 'reset');
    rules = [];
    return json(res, 200, { reset: true });
  }
  return json(res, 404, { error: 'unknown control path' });
}

async function onRequest(req, res) {
  const url = new URL(req.url ?? '/', 'https://lti-gate.test');
  const body = await readBody(req);
  if (url.pathname.startsWith('/__gate/')) return control(req, res, url, body);
  const method = (req.method ?? 'GET').toUpperCase();
  const rule = rules.find((x) => x.method === method && x.times > 0 && x.regex.test(url.pathname));
  const r = { id: null, ruleId: null, method, path: url.pathname, rawPath: `${url.pathname}${url.search}`, headers: req.headers, body, res, callerGone: false, gateClosed: false };
  res.on('close', () => {
    if (!res.writableEnded && !r.gateClosed) {
      r.callerGone = true;
      if (r.id) emit(r, 'caller_gone');
    }
  });
  if (!rule) {
    // No rule: pass without an id (and without events).
    const answer = await forward(r);
    respond(r, answer);
    return;
  }
  rule.times -= 1;
  r.id = `g-${++requestSeq}`;
  r.ruleId = rule.id;
  await handleMatched(r, rule);
}

const tls = { cert: readFileSync(process.env.CERT_FILE ?? '/certs/qa.crt'), key: readFileSync(process.env.KEY_FILE ?? '/certs/qa.key') };
createHttpsServer(tls, (req, res) => { onRequest(req, res).catch(() => { if (!res.writableEnded) json(res, 500, { error: 'gate error' }); }); }).listen(443, () => log('info', 'gate_started', { upstream: UPSTREAM.origin }));
createHttpServer((req, res) => {
  if (req.url === '/healthz') return json(res, 200, { status: 'ok', service: 'lti-gate' });
  return json(res, 404, {});
}).listen(8080);
