import assert from 'node:assert/strict';
import { test } from 'node:test';
import rule from './rules/protocol-urls.mjs';

const path = 'services/lti-service/src/http/routes/protocol.ts';

test('protocol URL literals and template parts fail outside the resolver', () => {
  for (const endpoint of ['launch', 'login', 'keys', 'register']) {
    for (const text of [
      `const url = '/lti/${endpoint}/cogniate';`,
      'const url = `${base}/lti/' + endpoint + '/${id}`;',
      `const url = '/lti/${endpoint}/' + id;`,
    ]) assert.equal(rule.check({ path, text }).length, 1, text);
  }
  assert.equal(rule.check({ path, text: "const url = '\\x2flti/launch/cogniate';" }).length, 1);
  assert.equal(rule.check({ path, text: "const url = '/lti/launch/:accountant';" }).length, 1);
});

test('route patterns, comments, tests, testkits, the resolver and app code pass', () => {
  for (const text of [
    "app.post('/lti/launch/:account', handler);",
    "const map = { '/lti/launch/:account/storage-check': 'protocol' };",
    "// '/lti/launch/cogniate'\nconst url = protocolUrls.launch;",
  ]) assert.deepEqual(rule.check({ path, text }), []);
  for (const exempt of [
    'services/lti-service/src/accounts/resolver.ts',
    'services/lti-service/src/lti/target.test.ts',
    'services/lti-service/src/testkit.ts',
    'services/cogniate-app/src/kernel/setup/common.ts',
    'packages/channels/moodle/app.ts',
  ]) assert.deepEqual(rule.check({ path: exempt, text: "const url = '/lti/launch/cogniate';" }), []);
});
