import { expect, it } from 'vitest';
import * as setup from '@cogniate/channel-kernel/setup';

it('pins the channel-safe setup value exports (BD-A1-40; changes require Reviewer-A review)', () => {
  expect(Object.keys(setup).sort()).toEqual(['GRANT_CODE', 'PRINTABLE_ID', 'parseStrictBody', 'toolName']);
});

it('keeps the ASCII tool-name and security grammar rules', () => {
  expect(setup.toolName('  École   学校 ')).toBe('Cogniate (Ecole)');
  expect(setup.toolName('学校')).toBe('Cogniate (Library)');
  expect(setup.PRINTABLE_ID.test('x'.repeat(255))).toBe(true);
  for (const value of ['', 'has space', 'x'.repeat(256), 'é']) expect(setup.PRINTABLE_ID.test(value)).toBe(false);
  expect(setup.GRANT_CODE.test('a_-'.repeat(14) + 'z')).toBe(true);
  for (const value of ['g'.repeat(42), 'g'.repeat(44), '+'.repeat(43)]) expect(setup.GRANT_CODE.test(value)).toBe(false);
});

it('refuses unknown, missing and malformed fields in body order, then missing-key order', () => {
  const spec = { required: ['clientId', 'deploymentId', 'grantCode'], optional: ['label'] };
  expect(setup.parseStrictBody({ extra: 'x', grantCode: 'bad', label: 'two words' }, spec))
    .toEqual({ ok: false, fields: ['extra', 'grantCode', 'label', 'clientId', 'deploymentId'] });
  expect(setup.parseStrictBody({ clientId: ' c ', deploymentId: ' d ', grantCode: 'g'.repeat(43) }, spec))
    .toEqual({ ok: true, values: { clientId: 'c', deploymentId: 'd', grantCode: 'g'.repeat(43) } });
  for (const body of [null, [], 1]) expect(setup.parseStrictBody(body, spec))
    .toEqual({ ok: false, fields: spec.required });
});
