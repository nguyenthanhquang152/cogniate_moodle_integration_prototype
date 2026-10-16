import { describe, expect, it } from 'vitest';
import { URLS } from '../testkit.ts';
import { isOwnLaunchTarget, launchUri } from './target.ts';

describe('isOwnLaunchTarget', () => {
  const base = launchUri(URLS, 'cogniate');
  it.each([base, `${base}?resource=seed`, `${base}?resource=a&x=1`])('accepts %s', (v) => expect(isOwnLaunchTarget(v, URLS, 'cogniate')).toBe(true));
  it.each([
    `${base}-evil`, `${base}/x`, `${base}#f`, 'https://evil.test/lti/launch/cogniate', `${URLS.lti}/lti/launch/qa-second`,
    'https://user:pw@lti.cogniate.test/lti/launch/cogniate', 'http://lti.cogniate.test/lti/launch/cogniate', 'not a url', 42,
  ])('refuses %s', (v) => expect(isOwnLaunchTarget(v, URLS, 'cogniate')).toBe(false));
});
