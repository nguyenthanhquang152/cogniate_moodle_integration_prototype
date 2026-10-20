// HARNESS ONLY. Run the actual gate handler with in-memory network/file edges.
// No product validator, listening socket, certificate, Docker stack or vendor DNS.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { armCapture } from './gate-capture.mjs';
import { received, onlyV, vBeforeMutation } from './snapshot-oracle.mjs';

const methods = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
function gateBoundary() {
  // Substitute only the four Node import declarations. The request matcher,
  // controls, forwarding, ordering and event production run without alteration.
  const sourceUrl = new URL('../../../../infra/lti-gate/gate.mjs', import.meta.url);
  const source = readFileSync(sourceUrl, 'utf8');
  const imports = [];
  const executable = source.replace(/^import .* from 'node:(crypto|fs|http|https)';$/gm,
    (line, module) => { imports.push(module); return ''; });
  assert.deepEqual(imports, ['crypto', 'fs', 'http', 'https']);
  const upstream = [], timers = new Set(), logs = [];
  let handler;
  const server = (callback) => ({ listen(_port, ready) { callback?.(); ready?.(); return this; } });
  vm.runInNewContext(executable, {
    Buffer, URL, randomBytes,
    process: { env: {}, stdout: { write: (line) => logs.push(line) } },
    appendFileSync() {},
    readFileSync: () => Buffer.from('in-memory TLS edge; never used by a TLS socket'),
    createHttpServer: () => server(),
    createHttpsServer: (_tls, callback) => { handler = callback; return server(); },
    httpsRequest: (options, callback) => {
      const req = new EventEmitter();
      req.write = () => {};
      req.end = () => queueMicrotask(() => {
        upstream.push([options.method, options.path]);
        const res = new EventEmitter();
        res.statusCode = 200; res.headers = {};
        callback(res); res.emit('data', Buffer.from('{}')); res.emit('end');
      });
      return req;
    },
    setTimeout: (callback) => { const token = { callback }; timers.add(token); return token; },
    clearTimeout: (token) => timers.delete(token),
  }, { filename: sourceUrl.pathname });
  assert.equal(typeof handler, 'function');
  function send(method, url, body) {
    return new Promise((resolve, reject) => {
      const req = new EventEmitter(), res = new EventEmitter();
      req.method = method; req.url = url; req.headers = {};
      res.writableEnded = false;
      res.writeHead = (status) => { res.status = status; };
      res.end = (value) => {
        res.writableEnded = true;
        const text = value?.toString() ?? '';
        resolve({ status: res.status, body: text, json: text ? JSON.parse(text) : undefined });
      };
      res.socket = { destroy: () => { res.emit('close'); resolve({ status: 0 }); } };
      try { handler(req, res); } catch (error) { reject(error); }
      queueMicrotask(() => {
        if (body !== undefined) req.emit('data', Buffer.from(JSON.stringify(body)));
        req.emit('end');
      });
    });
  }
  async function control(path, method = 'GET', body) {
    const answer = await send(method, '/__gate' + path, body);
    assert.equal(answer.status, 200);
    return answer.json;
  }
  const controls = {
    setRules: async (rules) => { await control('/rules', 'POST', rules); },
    readEvents: async () => (await control('/events')).events,
  };
  return {
    send, controls, upstream, timers,
    reset: () => control('/reset', 'POST'),
    release: (requestId) => control('/release', 'POST', { requestId, then: 'deliver' }),
  };
}
const vFault = { id: 'specific-v', method: 'GET', pathRegex: '^/api/providers$', action: 'hold_before', times: 1 };

test('HARNESS ONLY: actual gate exposes the narrow-rule blind spot and reset removes capture', async () => {
  const gate = gateBoundary();
  await gate.controls.setRules([{ ...vFault, action: 'pass' }]);
  for (const [method, path] of [['GET', '/api/providers'], ['POST', '/api/platforms/P/deployments'],
    ['PATCH', '/api/platforms/P/deployments/D']]) await gate.send(method, path);
  assert.equal(gate.upstream.length, 3);
  const narrowEvents = await gate.controls.readEvents();
  assert.deepEqual(received(narrowEvents).map((e) => e.method), ['GET']);
  assert.throws(() => vBeforeMutation(narrowEvents), /observed/);
  const mark = (await gate.controls.readEvents()).at(-1).seq;
  await gate.reset();
  await gate.send('GET', '/api/providers');
  assert.deepEqual(received(await gate.controls.readEvents(), mark), []);
});

test('HARNESS ONLY: helper arms all methods before cursor and keeps specific faults first', async () => {
  const gate = gateBoundary(), order = [];
  const cursor = await armCapture({
    setRules: async (rules) => { order.push('rules'); await gate.controls.setRules(rules); },
    readEvents: async () => { order.push('cursor'); return gate.controls.readEvents(); },
  }, { faults: [vFault] });
  assert.deepEqual(order, ['rules', 'cursor']);
  const heldAnswer = gate.send('GET', '/api/providers');
  const held = (await gate.controls.readEvents()).find((e) => e.phase === 'held_before');
  assert.ok(held, 'The specific fault wins over the GET catch-all');
  assert.equal(held.rule_id, 'specific-v');
  assert.equal(gate.upstream.length, 0);
  await gate.release(held.request_id);
  assert.equal((await heldAnswer).status, 200);
  for (const [method, path] of [['POST', '/api/platforms/P/deployments'],
    ['PATCH', '/api/platforms/P/deployments/D']]) await gate.send(method, path);
  vBeforeMutation(await gate.controls.readEvents(), cursor);
  for (const method of methods) await gate.send(method, `/unexpected/${method}`);
  const calls = received(await gate.controls.readEvents(), cursor);
  assert.deepEqual(calls.slice(3).map((e) => e.method), methods);
  assert.deepEqual(calls.map((e) => [e.method, e.path]), gate.upstream);
  assert.equal(gate.timers.size, 0);
  // A provider GET after the one-shot fault must still be captured.
  await gate.send('GET', '/api/providers');
  assert.equal(received(await gate.controls.readEvents(), cursor).at(-1).rule_id, 'capture-GET');
});

test('HARNESS ONLY: reset/re-arm preserves separate negative and positive fault windows', async () => {
  const gate = gateBoundary();
  await gate.reset();
  const negative = await armCapture(gate.controls, { action: 'fail_before' });
  assert.deepEqual(received(await gate.controls.readEvents(), negative), []);
  const positive = (await gate.controls.readEvents()).at(-1)?.seq ?? 0;
  assert.equal((await gate.send('GET', '/api/providers')).status, 503);
  onlyV(await gate.controls.readEvents(), positive);
  // A positive observation cannot retroactively serve as a zero-call window.
  const mixedWindow = received(await gate.controls.readEvents(), negative);
  assert.throws(() => assert.deepEqual(mixedWindow, []));
  for (const method of methods) assert.equal((await gate.send(method, '/unexpected')).status, 503);
  assert.equal(gate.upstream.length, 0);
  assert.deepEqual(received(await gate.controls.readEvents(), positive).slice(1).map((e) => e.method), methods);
  await gate.reset();
  const retry = await armCapture(gate.controls);
  for (const [method, path] of [['GET', '/api/providers'], ['POST', '/api/platforms/P/deployments'],
    ['PATCH', '/api/platforms/P/deployments/D']]) await gate.send(method, path);
  vBeforeMutation(await gate.controls.readEvents(), retry);
  assert.equal(gate.upstream.length, 3);
});
