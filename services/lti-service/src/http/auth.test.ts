import { describe, expect, it } from 'vitest';
import { openDb } from '../db/index.ts';
import { ensureAccount, updateAccount } from '../store/accounts.ts';
import { createPlatform } from '../store/platforms.ts';
import { createLaunch } from '../store/launches.ts';
import { issueServiceKey, findServiceKey } from '../store/service-keys.ts';
import { authenticate, parseAuthorization } from './auth.ts';

describe('parseAuthorization (contract §1.2)', () => {
  it('reads the three schemes case-insensitively and splits at the FIRST colon', () => {
    expect(parseAuthorization('LTIK-AUTH-V2 ltis_key:abc:def')).toEqual({ scheme: 'ltik', apiKey: 'ltis_key', credential: 'abc:def' });
    expect(parseAuthorization('service-auth-v1 k:s')).toEqual({ scheme: 'service', apiKey: 'k', credential: 's' });
    expect(parseAuthorization('BEARER k')).toEqual({ scheme: 'bearer', apiKey: 'k', credential: null });
  });

  it('gives the contract code for a missing header, an unknown scheme and a missing colon', () => {
    expect(parseAuthorization(undefined)).toMatchObject({ error: 'INVALID_AUTHORIZATION_HEADER' });
    expect(parseAuthorization('Basic abc')).toMatchObject({ error: 'INVALID_AUTHORIZATION_HEADER' });
    expect(parseAuthorization('Bearer')).toMatchObject({ error: 'INVALID_AUTHORIZATION_HEADER' });
    expect(parseAuthorization('LTIK-AUTH-V2 ltis_key')).toMatchObject({ error: 'INVALID_LTIK_AUTH_AUTHORIZATION_HEADER', scheme: 'ltik' });
    expect(parseAuthorization('SERVICE-AUTH-V1 ltis_key')).toMatchObject({ error: 'INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER', scheme: 'service' });
  });
});

describe('authenticate audit actor', () => {
  it('supplies the bootstrap actor for the account of each Bearer key', () => {
    const db = openDb(':memory:');
    try {
      for (const id of ['cogniate', 'qa-second']) {
        const { apiKey } = ensureAccount(db, { id, name: id, appUrl: 'https://app.cogniate.test' });
        const result = authenticate(db, `Bearer ${apiKey}`, ['bearer'], Date.now(), () => { throw new Error('authentication failed'); });
        expect(result.account.id).toBe(id);
        expect(result.actor).toEqual({ type: 'api_key', id: `bootstrap-${id}` });
      }
    } finally { db.close(); }
  });
});

it('checks status after the whole credential, isolates tenants, and revokes all tenant keys atomically on close', () => {
  const db = openDb(':memory:');
  try {
    const fixtures = ['one', 'two'].map((id) => {
      const { apiKey } = ensureAccount(db, { id, name: id, appUrl: 'https://tool.test' });
      const platform = createPlatform(db, id, { issuer: 'https://moodle.test', clientId: id, name: id,
        authEndpoint: 'https://moodle.test/a', tokenEndpoint: 'https://moodle.test/t', jwksUrl: 'https://moodle.test/k', deploymentIds: ['d'], active: true });
      const { ltik } = createLaunch(db, { toolAccountId: id, platformId: platform.id, deploymentId: 'd', messageType: 'LtiResourceLinkRequest', claims: {} }, 3600, 1000);
      const key = issueServiceKey(db, Buffer.alloc(32, 7), { toolAccountId: id, platformId: platform.id, deploymentId: 'd', contextId: 'c', resourceLinkId: 'r', agsClaim: null, nrpsClaim: null }, 1000);
      if (!('serviceKey' in key)) throw new Error('fixture');
      return { id, apiKey, ltik, serviceKey: key.serviceKey };
    });
    const a = fixtures[0]!;
    const b = fixtures[1]!;
    const auth = (header: string) => authenticate(db, header, ['bearer', 'ltik', 'service'], 2000, () => {});
    const headers = (f: typeof a) => [`Bearer ${f.apiKey}`, `LTIK-AUTH-V2 ${f.apiKey}:${f.ltik}`, `SERVICE-AUTH-V1 ${f.apiKey}:${f.serviceKey}`];
    updateAccount(db, a.id, { status: 'suspended' }, 2000);
    for (const header of headers(a)) expect(() => auth(header)).toThrow('TOOL_ACCOUNT_SUSPENDED');
    expect(() => auth(`LTIK-AUTH-V2 ${a.apiKey}:bad`)).toThrow('INVALID_LTIK_AUTH_AUTHORIZATION_HEADER');
    expect(() => auth(`SERVICE-AUTH-V1 ${a.apiKey}:bad`)).toThrow('INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER');
    for (const header of headers(b)) expect(auth(header).account.id).toBe(b.id);
    updateAccount(db, a.id, { status: 'active' }, 2001);
    for (const header of headers(a)) expect(auth(header).account.id).toBe(a.id);
    // LA-E5-07's table is not installed yet. Its known revoke columns use the same close transaction.
    db.exec('CREATE TABLE api_key (tool_account_id TEXT, revoked_at INTEGER)');
    db.prepare('INSERT INTO api_key VALUES (?, NULL)').run(a.id);
    db.prepare('INSERT INTO api_key VALUES (?, NULL)').run(b.id);
    db.exec("CREATE TRIGGER fail_close BEFORE UPDATE ON service_key BEGIN SELECT RAISE(ABORT, 'close failed'); END");
    expect(() => updateAccount(db, a.id, { status: 'closed' }, 2002)).toThrow('close failed');
    for (const header of headers(a)) expect(auth(header).account.id).toBe(a.id);
    expect(db.prepare('SELECT revoked_at FROM api_key WHERE tool_account_id = ?').get(a.id)?.revoked_at).toBeNull();
    db.exec('DROP TRIGGER fail_close');
    updateAccount(db, a.id, { status: 'closed' }, 2003);
    for (const header of headers(a)) expect(() => auth(header)).toThrow(/INVALID_.*AUTHORIZATION_HEADER/);
    expect(findServiceKey(db, a.id, a.serviceKey)).toBeNull();
    expect(db.prepare('SELECT revoked_at FROM api_key WHERE tool_account_id = ?').get(a.id)?.revoked_at).toBe(2003);
    expect(db.prepare('SELECT revoked_at FROM api_key WHERE tool_account_id = ?').get(b.id)?.revoked_at).toBeNull();
    for (const header of headers(b)) expect(auth(header).account.id).toBe(b.id);
  } finally { db.close(); }
});
