import { describe, expect, it } from 'vitest';
import { createAccountResolver } from '../accounts/resolver.ts';
import { openDb } from '../db/index.ts';
import { ensureAccount } from '../store/accounts.ts';
import { URLS } from '../testkit.ts';
import { isOwnLaunchTarget, launchUri } from './target.ts';

describe('isOwnLaunchTarget', () => {
  const db = openDb(':memory:');
  const { account } = ensureAccount(db, { id: 'cogniate', name: 'Cogniate', appUrl: URLS.app });
  const protocolUrls = createAccountResolver(db, URLS.lti).protocolUrls(account);
  db.close();
  const base = launchUri(protocolUrls);
  it.each([base, `${base}?resource=seed`, `${base}?resource=a&x=1`])('accepts %s', (v) => expect(isOwnLaunchTarget(v, protocolUrls)).toBe(true));
  it.each([
    `${base}-evil`, `${base}/x`, `${base}#f`, 'https://evil.test/lti/launch/cogniate', `${URLS.lti}/lti/launch/qa-second`,
    protocolUrls.login, protocolUrls.keys, protocolUrls.register, account.launchUrl, account.deepLinkingUrl,
    'https://user:pw@lti.cogniate.test/lti/launch/cogniate', 'http://lti.cogniate.test/lti/launch/cogniate', 'not a url', 42,
  ])('refuses %s', (v) => expect(isOwnLaunchTarget(v, protocolUrls)).toBe(false));
});
