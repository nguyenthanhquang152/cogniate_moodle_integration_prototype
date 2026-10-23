// HARNESS ONLY: synthetic capabilities, no browser or product calls.
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { captureBrowserSecrets, diagnosticUrl } from '../../acceptance/M1/canvas/browser-diagnostics.mjs';

test('HARNESS ONLY: timeout URL shapes omit full capabilities even when capture never ran', () => {
  const secret = 'synthetic-private-value';
  for (const route of ['rt', 'play', 'tool/picker']) {
    for (const token of [secret, encodeURIComponent(secret + '/encoded')]) {
      const raw = `https://user:${secret}@content.test/${route}/${token}/state?ltik=${secret}#${secret}`;
      const safe = diagnosticUrl(raw);
      assert.equal(safe.includes(secret), false);
      assert.equal(safe.includes(token), false);
      assert.equal(safe.includes('user:'), false);
      assert.match(safe, /\/\[(runtime_token|play_id|picker_id)\]\/state$/);
      // Negative control: the former query-only stripping leaks the capability.
      assert.equal(raw.split('?')[0].includes(secret), true);
    }
  }
  assert.equal(diagnosticUrl('about:blank'), 'about:blank');
  assert.equal(diagnosticUrl(`data:text/plain,${secret}`), '[non-HTTP URL]');
  assert.equal(diagnosticUrl(`not-a-url-${secret}`), '[invalid URL]');
  assert.equal(diagnosticUrl('https://content.test/pkg/version/index.html?ignored=value'), 'https://content.test/pkg/version/index.html');
});

test('HARNESS ONLY: request-time capture retains capabilities before any frame wait succeeds', () => {
  const context = new EventEmitter(), captured = [];
  const stop = captureBrowserSecrets(context, (kind, value) => captured.push({ kind, value }));
  const request = (url, body = null) => context.emit('request', {
    url: () => url, postData: () => body, headers: () => body ? { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' } : {},
  });
  request('https://app.test/play/synthetic-play');
  request('https://app.test/tool/picker/synthetic-picker?ltik=synthetic-ltik');
  request('https://content.test/rt/synthetic-runtime');
  request('https://lti.test/launch', 'id_token=synthetic-jwt&state=synthetic-state&nonce=synthetic-nonce');
  assert.deepEqual(captured, [
    { kind: 'play_id', value: 'synthetic-play' },
    { kind: 'ltik', value: 'synthetic-ltik' },
    { kind: 'picker_id', value: 'synthetic-picker' },
    { kind: 'runtime_token', value: 'synthetic-runtime' },
    { kind: 'id_token', value: 'synthetic-jwt' },
    { kind: 'state', value: 'synthetic-state' },
    { kind: 'nonce', value: 'synthetic-nonce' },
  ]);
  // No successful frame/navigation callback is involved; every value is already captured.
  const sharedFailure = ['https://app.test/play/synthetic-play', 'https://content.test/rt/synthetic-runtime', 'about:blank']
    .map(diagnosticUrl).join(' | ');
  for (const { value } of captured) assert.equal(sharedFailure.includes(value), false);
  stop(); request('https://content.test/rt/after-stop');
  assert.equal(captured.length, 7);
});

test('HARNESS ONLY: the signed Deep Linking response (form field JWT) is captured as id_token, so the scan detects its leak', () => {
  const context = new EventEmitter(), captured = [];
  const stop = captureBrowserSecrets(context, (kind, value) => captured.push({ kind, value }));
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const jwt = [b64({ alg: 'RS256', typ: 'JWT', kid: 'synthetic-kid' }),
    b64({ iss: 'synthetic-client', aud: 'https://canvas.sim.test', 'https://purl.imsglobal.org/spec/lti/claim/message_type': 'LtiDeepLinkingResponse' }),
    'synthetic-response-signature'].join('.');
  // The tool's auto-submitted form posts the response to the platform's Deep Linking return URL.
  context.emit('request', {
    url: () => 'https://school-a.canvas.sim.test/courses/course-1/deep_linking_response',
    postData: () => new URLSearchParams({ JWT: jwt }).toString(), headers: () => ({ 'content-type': 'application/x-www-form-urlencoded' }),
  });
  stop();
  assert.deepEqual(captured, [{ kind: 'id_token', value: jwt }]);
  // The leak scan uses the captured values: shared failure text that holds the response JWT is a hit.
  const evidence = `POST /courses/course-1/deep_linking_response failed; body JWT=${jwt}`;
  const hits = (values) => values.filter((value) => evidence.includes(value)).length;
  assert.equal(hits(captured.map((c) => c.value)), 1);
  // Negative control: the capture before this repair recorded nothing for this request, so the same leak gave zero hits.
  assert.equal(hits([]), 0);
});

test('HARNESS ONLY: both real frame-wait failure branches emit only redacted URL shapes', async () => {
  const urls = [
    'https://app.test/play/synthetic-private-play',
    'https://content.test/rt/synthetic-private-runtime',
    'https://app.test/tool/picker/synthetic-private-picker?ltik=synthetic-private-ltik',
    'about:blank',
  ];
  for (const file of ['../../acceptance/M1/canvas/browser.ts', '../lib/learner.ts']) {
    // Compile the actual timeout function, supplying only its two pure dependencies.
    // This never imports suite setup, starts a browser or calls a product service.
    const source = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
    const fn = source.match(/export async function waitForFrame\([\s\S]*?\n\}/)?.[0];
    assert.ok(fn, `Frame wait exported by ${file}`);
    const code = ts.transpileModule(fn.replace(/^export /, ''), {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const wait = vm.runInNewContext(`${code}\nwaitForFrame`, {
      URL, diagnosticUrl, check: (ok, message) => { if (!ok) throw new Error(message); },
    });
    const page = { frames: () => urls.map((url) => ({ url: () => url })), waitForTimeout: () => assert.fail('Timeout must fail immediately') };
    await assert.rejects(wait(page, () => false, -1), (error) => {
      assert.match(error.message, /frame matched within/);
      assert.equal(error.message.includes('synthetic-private'), false);
      for (const shape of ['[runtime_token]', '[play_id]', '[picker_id]', 'about:blank']) assert.ok(error.message.includes(shape));
      return true;
    });
  }
});
