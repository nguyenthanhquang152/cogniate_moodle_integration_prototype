import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../db/index.ts';
import { openDb } from '../db/index.ts';
import { ensureAccount, updateAccount } from '../store/accounts.ts';
import { issueApiKey, listApiKeys, revokeApiKey } from '../store/api-keys.ts';
import type { Scheme } from './auth.ts';
import { authenticate } from './auth.ts';

const T0 = Date.parse('2026-10-22T10:00:00Z');
const HOUR = 3600_000;
const schemes: Scheme[] = ['bearer', 'ltik', 'service'];
const codeFor = (scheme: Scheme) => scheme === 'service' ? 'INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER' : 'INVALID_LTIK_AUTH_AUTHORIZATION_HEADER';
const headerFor = (scheme: Scheme, key: string, credential = 'invalid') => scheme === 'bearer' ? `Bearer ${key}`
  : `${scheme === 'ltik' ? 'LTIK-AUTH-V2' : 'SERVICE-AUTH-V1'} ${key}:${credential}`;
let db: Db;
let apiKey: string;
beforeEach(() => {
  db = openDb(':memory:');
  apiKey = ensureAccount(db, { id: 'cogniate', name: 'Cogniate', appUrl: 'https://app.test' }).apiKey!;
});
afterEach(() => db.close());

describe('authentication failure part (LA-E5-03 request 2, BD-A2-17)', () => {
  it.each([
    ['no header', undefined, ['bearer'], 'none', 'INVALID_AUTHORIZATION_HEADER'],
    ['blank header', '  ', ['bearer'], 'none', 'INVALID_AUTHORIZATION_HEADER'],
    ['malformed header', 'Bearer', ['bearer'], 'unknown', 'INVALID_AUTHORIZATION_HEADER'],
    ['unknown scheme', 'Basic {key}', ['bearer'], 'unknown', 'INVALID_AUTHORIZATION_HEADER'],
    ['malformed LTIK header', 'LTIK-AUTH-V2 {key}', ['ltik'], 'ltik', 'INVALID_LTIK_AUTH_AUTHORIZATION_HEADER'],
    ['malformed service header', 'SERVICE-AUTH-V1 {key}', ['service'], 'service', 'INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER'],
    ['unaccepted malformed LTIK scheme', 'LTIK-AUTH-V2 {key}', ['bearer'], 'ltik', 'INVALID_AUTHORIZATION_HEADER'],
    ['unaccepted malformed service scheme', 'SERVICE-AUTH-V1 {key}', ['bearer'], 'service', 'INVALID_AUTHORIZATION_HEADER'],
    ['unaccepted LTIK scheme', 'LTIK-AUTH-V2 {key}:invalid', ['bearer'], 'ltik', 'INVALID_AUTHORIZATION_HEADER'],
    ['unaccepted service scheme', 'SERVICE-AUTH-V1 {key}:invalid', ['bearer'], 'service', 'INVALID_AUTHORIZATION_HEADER'],
    ['unaccepted Bearer scheme', 'Bearer {key}', ['ltik'], 'bearer', 'INVALID_AUTHORIZATION_HEADER'],
    ['wrong API key format', 'Bearer invalid', ['bearer'], 'bearer', 'INVALID_LTIK_AUTH_AUTHORIZATION_HEADER'],
  ] as const)('%s is an api_key failure before lookup', (_name, header, accepted, scheme, code) => {
    const onFail = vi.fn();
    expect(() => authenticate(db, header?.replace('{key}', apiKey), [...accepted], T0, onFail))
      .toThrow(expect.objectContaining({ status: 401, code }));
    expect(onFail.mock.calls).toEqual([[scheme, code, 'api_key']]);
  });

  it.each(schemes.flatMap((scheme) => ['unknown', 'expired', 'revoked', 'closed'].map((state) => ({ scheme, state }))))(
    '$scheme with an $state API key is an api_key failure', ({ scheme, state }) => {
      const issued = issueApiKey(db, 'cogniate', { label: 'unit', scopes: ['launch', 'admin'], createdBy: 'operator:unit', expiresAt: T0 + HOUR }, T0);
      const key = state === 'unknown' ? `ltis_${'A'.repeat(43)}` : issued.apiKey;
      if (state === 'revoked') revokeApiKey(db, 'cogniate', issued.record.id, T0);
      // Keep the key row active to exercise the closed-account guard separately from the revoke lookup.
      if (state === 'closed') db.prepare("UPDATE tool_account SET status = 'closed' WHERE id = 'cogniate'").run();
      const onFail = vi.fn();
      expect(() => authenticate(db, headerFor(scheme, key), [scheme], state === 'expired' ? T0 + HOUR : T0, onFail))
        .toThrow(expect.objectContaining({ status: 401, code: codeFor(scheme) }));
      expect(onFail.mock.calls).toEqual([[scheme, codeFor(scheme), 'api_key']]);
    },
  );

  it.each((['ltik', 'service'] as const).flatMap((scheme) => ['invalid', ''].map((credential) => ({ scheme, credential }))))(
    '$scheme with credential "$credential" and a valid API key is a credential failure', ({ scheme, credential }) => {
      const onFail = vi.fn();
      expect(() => authenticate(db, headerFor(scheme, apiKey, credential), [scheme], T0, onFail))
        .toThrow(expect.objectContaining({ status: 401, code: codeFor(scheme) }));
      expect(onFail.mock.calls).toEqual([[scheme, codeFor(scheme), 'credential']]);
    },
  );

  it('success keeps the real key id and does not call onFail', () => {
    const onFail = vi.fn();
    const result = authenticate(db, headerFor('bearer', apiKey), ['bearer'], T0, onFail);
    expect(result.actor).toEqual({ type: 'api_key', id: listApiKeys(db, 'cogniate')[0]!.id });
    expect(onFail).not.toHaveBeenCalled();
  });

  it.each(['scope', 'suspended'] as const)('a %s 403 is not an authentication failure', (reason) => {
    let key = apiKey;
    if (reason === 'scope') key = issueApiKey(db, 'cogniate', { label: 'launch', scopes: ['launch'], createdBy: 'operator:unit' }, T0).apiKey;
    else updateAccount(db, 'cogniate', { status: 'suspended' }, T0);
    const onFail = vi.fn();
    expect(() => authenticate(db, headerFor('bearer', key), ['bearer'], T0, onFail))
      .toThrow(expect.objectContaining({ status: 403, code: reason === 'scope' ? 'API_KEY_SCOPE_MISSING' : 'TOOL_ACCOUNT_SUSPENDED' }));
    expect(onFail).not.toHaveBeenCalled();
  });
});
