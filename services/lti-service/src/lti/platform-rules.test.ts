import { describe, expect, it } from 'vitest';
import { checkPlatformUrls } from './platform-rules.ts';

const ok = { url: 'https://moodle.test', authenticationEndpoint: 'https://moodle.test/mod/lti/auth.php', accesstokenEndpoint: 'https://moodle.test/mod/lti/token.php', jwksUrl: 'https://moodle.test/mod/lti/certs.php' };

describe('platform URL rules (security §2.4)', () => {
  it('accepts Moodle URLs on the issuer origin', () => expect(() => checkPlatformUrls(ok)).not.toThrow());
  it.each([
    ['http issuer', { ...ok, url: 'http://moodle.test' }, 'INVALID_REQUEST'],
    ['user info', { ...ok, jwksUrl: 'https://a:b@moodle.test/k' }, 'INVALID_REQUEST'],
    ['a fragment', { ...ok, authenticationEndpoint: 'https://moodle.test/a#x' }, 'INVALID_REQUEST'],
    ['token endpoint on another host', { ...ok, accesstokenEndpoint: 'https://evil.test/token' }, 'PLATFORM_URL_NOT_ON_ISSUER_ORIGIN'],
    ['JWKS on another port', { ...ok, jwksUrl: 'https://moodle.test:8443/k' }, 'PLATFORM_URL_NOT_ON_ISSUER_ORIGIN'],
  ])('refuses %s', (_n, urls, code) => expect(() => checkPlatformUrls(urls)).toThrow(expect.objectContaining({ code })));
  it('names the request field', () => {
    expect(() => checkPlatformUrls({ ...ok, jwksUrl: 'https://evil.test/k' }, { url: 'url', authenticationEndpoint: 'a', accesstokenEndpoint: 't', jwksUrl: 'authConfig.key' }))
      .toThrow(expect.objectContaining({ description: 'authConfig.key is not on the issuer origin.' }));
  });
});
