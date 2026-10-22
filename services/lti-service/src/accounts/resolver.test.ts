import { expect, it } from 'vitest';
import { openDb } from '../db/index.ts';
import { ensureAccount } from '../store/accounts.ts';
import { URLS } from '../testkit.ts';
import { createAccountResolver } from './resolver.ts';

it('AC-LA-E5-04-10: path-mode URLs match the existing cogniate URLs byte for byte', () => {
  const db = openDb(':memory:');
  try {
    const { account } = ensureAccount(db, { id: 'cogniate', name: 'Cogniate', appUrl: URLS.app });
    const resolver = createAccountResolver(db, URLS.lti);
    expect(resolver.protocolUrls(account)).toEqual({ login: 'https://lti.cogniate.test/lti/login/cogniate',
      launch: 'https://lti.cogniate.test/lti/launch/cogniate', keys: 'https://lti.cogniate.test/lti/keys/cogniate',
      register: 'https://lti.cogniate.test/lti/register/cogniate' });
    expect(resolver.resolveAccount({ params: { account: 'cogniate' } })).toEqual(account);
    for (const params of [null, {}, { account: 'other' }, { account: 3 }, { account: '../cogniate' }]) {
      expect(resolver.resolveAccount({ params })).toBeNull();
    }
    expect(createAccountResolver(db, 'https://lti.test:8443').protocolUrls(account).login).toBe('https://lti.test:8443/lti/login/cogniate');
    expect(() => resolver.protocolUrls({ ...account, publicBaseUrl: 'https://tenant.test' })).toThrow('Host mode');
  } finally { db.close(); }
});
