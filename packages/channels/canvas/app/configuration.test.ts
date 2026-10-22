import { describe, expect, it } from 'vitest';
import type { PortContext } from '../../../../services/cogniate-app/src/kernel/ports.ts';
import { configurationRoute } from './configuration.ts';

describe.each(['url', 'inline'])('developer key title with jwk=%s', (jwk) => {
  it.each([
    ['  Thư \t viện   A  ', 'Cogniate (Thu vien A)'],
    ['图书馆', 'Cogniate (Library)'],
    ["Thanh's Library", "Cogniate (Thanh's Library)"],
  ])('keeps the frozen ASCII tool name for %s', async (libraryName, title) => {
    const ctx = {
      libraryName, toolAccountId: 'account',
      toolUrls: { login: 'https://lti.test/login', launch: 'https://lti.test/launch', keys: 'https://lti.test/keys', register: 'https://lti.test/register', ltiOrigin: 'https://lti.test' },
      publicToolKeys: async () => ({ ok: true, keys: [{ kty: 'RSA', kid: 'key', alg: 'RS256', use: 'sig', n: 'abc', e: 'AQAB' }] }),
    } as PortContext;
    expect(await configurationRoute.handle({ body: null, query: { jwk } }, ctx)).toMatchObject({ status: 200, body: { title } });
  });
});
