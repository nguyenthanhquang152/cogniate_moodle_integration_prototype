import { describe, expect, it } from 'vitest';
import { loadPublicUrls } from './config.ts';

const valid = {
  PUBLIC_LTI_URL: 'https://lti.cogniate.test',
  PUBLIC_APP_URL: 'https://app.cogniate.test',
  PUBLIC_CONTENT_URL: 'https://content.cogniate-content.test',
};

describe('loadPublicUrls', () => {
  it('returns the three service origins without a platform URL', () => {
    expect(loadPublicUrls(valid)).toEqual({
      lti: 'https://lti.cogniate.test',
      app: 'https://app.cogniate.test',
      content: 'https://content.cogniate-content.test',
    });
  });

  it('keeps a non-default port', () => {
    expect(loadPublicUrls({ ...valid, PUBLIC_LTI_URL: 'https://lti.cogniate.test:8443' }).lti).toBe('https://lti.cogniate.test:8443');
  });

  it('names the missing variable', () => {
    expect(() => loadPublicUrls({ ...valid, PUBLIC_APP_URL: undefined })).toThrow(/PUBLIC_APP_URL is not set/);
  });

  it.each([
    ['http', 'http://lti.test'],
    ['trailing slash', 'https://lti.test/'],
    ['path', 'https://lti.test/platform'],
    ['not a URL', 'lti.test'],
  ])('rejects %s', (_label, value) => {
    expect(() => loadPublicUrls({ ...valid, PUBLIC_LTI_URL: value })).toThrow(/PUBLIC_LTI_URL/);
  });
});
