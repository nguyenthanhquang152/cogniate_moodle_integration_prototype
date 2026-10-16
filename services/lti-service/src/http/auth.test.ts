import { describe, expect, it } from 'vitest';
import { parseAuthorization } from './auth.ts';

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
