// HARNESS ONLY. Run the actual gate handler with in-memory network/file edges.
// No product validator, listening socket, certificate, Docker stack or vendor DNS.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
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

function loadCaller(name, gate, overrides = {}) {
  // Execute the owned test caller unchanged. Product responses are inert stubs
  // only to reach its observation assertion; this is not a product oracle.
  const file = new URL('../blackboard/' + name, import.meta.url);
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const cases = new Map();
  let cursor = 0, serial = 0, deployment = 'D';
  const client = {
    assert, APP: 'https://app.test', urls: { moodle: 'https://moodle.test' },
    unique: (label) => label + '-' + ++serial,
    m1Test: (id, _title, body) => cases.set(id, body),
    gateRules: gate.controls.setRules,
    gateReset: async () => { await gate.reset(); cursor = (await gate.controls.readEvents()).at(-1)?.seq ?? 0; },
    gateEvents: async (since = cursor, requestId) => (await gate.controls.readEvents())
      .filter((event) => event.seq > since && (!requestId || event.request_id === requestId)),
    gatePhase: async (ruleId, phase) => client.poll(() => client.gateEvents(),
      (events) => events.some((event) => event.rule_id === ruleId && event.phase === phase))
      .then((events) => events.find((event) => event.rule_id === ruleId && event.phase === phase)),
    poll: async (read, accept) => {
      for (let step = 0; step < 100; step++) { const value = await read(); if (accept(value)) return value; }
      assert.fail('In-memory gate did not reach its requested phase');
    },
    release: gate.release, records: async () => ({ cursor: 0, records: [] }),
    noServiceCalls: async () => {},
    sharedPlatform: async () => 'P', session: async () => ({ library: { id: 'L' } }),
    connPath: (id) => '/app-api/connections/' + id,
    createConnection: async () => ({ id: 'C', siteUrl: 'https://learn.test' }),
    issueGrant: async (_s, _connection, id) => { deployment = id; return { id: 'G-' + ++serial }; },
    remote: async () => ({ active: true }),
    app: async () => ({ status: 200, json: { status: 'registered', platform: { id: 'P', deploymentIds: [deployment] } } }),
    admin: async () => ({ status: 200, json: { deployments: [{ deploymentId: deployment }] } }),
    logEvents: (event) => event === 'grant_redemption_cancelled' ? [{ reason: 'replaced' }] : [],
    expectStatus: (answer, status, code) => {
      assert.equal(answer.status, status);
      if (code) assert.equal(answer.json.details.message, code);
    },
    ...overrides,
  };
  const modules = {
    'node:fs': { writeFileSync() {} }, 'node:path': path,
    '../../lib/paths': { artifactsDir: () => '/in-memory-evidence' },
    '../common/client': client, '../common/course': {},
    '../common/snapshot': {
      gateMark: async () => (await gate.controls.readEvents()).at(-1)?.seq ?? 0,
      watchAll: (action = 'pass', faults = []) => armCapture(gate.controls, { action, faults }),
    },
  };
  const execute = vm.runInThisContext('(function(require, exports) {\n' + code
    + '\nreturn typeof noMutation === "function" ? { noMutation } : {};\n})', { filename: file.pathname });
  const exported = execute((specifier) => {
    assert.ok(Object.hasOwn(modules, specifier), 'Unexpected caller dependency: ' + specifier);
    return modules[specifier];
  }, {});
  return { ...exported, cases };
}

test('HARNESS ONLY: actual grant noMutation caller detects every method and a non-api path', async () => {
  const pending = { platformId: 'P', deploymentId: 'D' };
  await loadCaller('30-grants.test.ts', gateBoundary()).noMutation(pending, async () => {});
  for (const [method, route] of [...methods.map((method) => [method, '/api/unexpected']), ['GET', '/outside-api']]) {
    // An earlier captured method must not make a later blind method look caught.
    const gate = gateBoundary(), { noMutation } = loadCaller('30-grants.test.ts', gate);
    await assert.rejects(noMutation(pending, () => gate.send(method, route)),
      (error) => error.code === 'ERR_ASSERTION' && /Grant rejection makes no LTI call/.test(error.message));
  }
});

test('HARNESS ONLY: actual replacement-race caller detects injected calls while its one-shot hold remains active', async () => {
  for (const injected of [null, ...methods]) {
    const gate = gateBoundary();
    let calls = 0;
    const { cases } = loadCaller('50-races.test.ts', gate, {
      redeem: async (_s, _connection, deploymentId) => {
        const route = '/api/platforms/P/deployments/' + deploymentId;
        if (++calls === 1) {
          await gate.send('PATCH', route);
          return { status: 403, json: { details: { message: 'GRANT_INVALID' } } };
        }
        if (calls === 2) {
          assert.equal(gate.timers.size, 1, 'The original hold is still active during the negative window');
          if (injected) await gate.send(injected, injected === 'GET' ? '/api/providers' : route);
          return { status: 409, json: { details: { message: 'GRANT_IN_USE' } } };
        }
        return { status: 200 };
      },
    });
    const run = cases.get('M1-37.blackboard.f');
    assert.equal(typeof run, 'function');
    if (injected) await assert.rejects(run(),
      (error) => error.code === 'ERR_ASSERTION' && error.expected === 0 && error.actual > 0);
    else await run(); // The original cancellation/recovery continuation still runs.
    assert.equal(gate.timers.size, 0, 'The caller resets its hold on success and failure');
  }
});
