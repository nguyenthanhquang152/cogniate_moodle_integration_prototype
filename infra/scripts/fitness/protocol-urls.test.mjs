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

test('A-LA-E5-06-02: a literal that ends at the endpoint and the relative form fail', () => {
  for (const endpoint of ['launch', 'login', 'keys', 'register']) {
    for (const text of [
      'const url = `${base}/lti/' + endpoint + '` + "/" + id;',
      `const url = base + '/lti/${endpoint}' + '/' + id;`,
      'const url = new URL(`lti/' + endpoint + '/${id}`, base + "/");',
      `const url = new URL('lti/${endpoint}/' + id, base);`,
      `const url = new URL('./lti/${endpoint}/' + id, base);`,
    ]) assert.equal(rule.check({ path, text }).length, 1, text);
  }
  const [hit] = rule.check({ path, text: 'const url = new URL(`lti/launch/${id}`, base);' });
  assert.deepEqual({ line: hit.line, col: hit.col }, { line: 1, col: 22 });
});

test('A-LA-E5-06-02: module paths and longer names pass; the segment join is a known limit', () => {
  for (const text of [
    "import { handleLaunch } from '../../lti/launch.ts';",
    "import { buildRegistrationRequest } from '../../lti/registration.ts';",
    "const url = '/lti/launches/' + id;",
    "const url = 'xlti/launch/' + id;",
    "const url = 'tool.lti/launch/' + id;",
    'const url = [base, "lti", "launch", id].join("/");',
  ]) assert.deepEqual(rule.check({ path, text }), [], text);
  assert.match(rule.description, /\[base, "lti", "launch", id\]\.join\("\/"\)/);
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
