import { describe, expect, it } from 'vitest';
import { createAccountResolver } from '../accounts/resolver.ts';
import { openDb } from '../db/index.ts';
import { cookieHelp, protocolAction } from '../lti/codes.ts';
import { initiateLogin } from '../lti/login.ts';
import { ensureAccount, getAccount } from '../store/accounts.ts';
import { createPlatform } from '../store/platforms.ts';
import { URLS, testProfileRegistry } from '../testkit.ts';
import { escapeHtml, renderErrorPage } from './error-page.ts';

describe('error pages (security §2.2)', () => {
  it('escapes everything and marks the main element and the action sentence', () => {
    const html = renderErrorPage('PLATFORM_ERROR', 'trace-1', 'Do <this>', '<script>alert(1)</script>');
    expect(html).toContain('<main data-error-code="PLATFORM_ERROR" data-trace-id="trace-1">');
    expect(html).toContain('<p data-error-action>Do &lt;this&gt;</p>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(escapeHtml(`"'&`)).toBe('&quot;&#39;&amp;');
  });
});

it('uses a new channel text name in a login error page (AC-LA-E1-10-05)', async () => {
  const profiles = { registry: await testProfileRegistry(), simulation: false };
  const db = openDb(':memory:');
  try {
    ensureAccount(db, { id: 'unit', name: 'Unit', appUrl: URLS.app });
    createPlatform(db, 'unit', {
      profile: 'zz-admin', issuer: 'https://admin.example.edu', clientId: 'unit-client', name: 'Unit', active: false,
      authEndpoint: 'https://admin.example.edu/auth', tokenEndpoint: 'https://admin.example.edu/token', jwksUrl: 'https://admin.example.edu/jwks', deploymentIds: ['1'],
    });
    const result = (await initiateLogin(db, createAccountResolver(db, URLS.lti), getAccount(db, 'unit'), {
      iss: 'https://admin.example.edu', client_id: 'unit-client', login_hint: 'learner', target_link_uri: `${URLS.lti}/lti/launch/unit`,
    }, Date.now(), profiles));
    expect(result).toMatchObject({ ok: false, code: 'PLATFORM_NOT_ACTIVE', lms: 'your LMS' });
    if (result.ok) throw new Error('Expected a login refusal.');
    const html = renderErrorPage(result.code, 'unit-trace', protocolAction(result.code, result.lms), 'platform detail', undefined, result.lms);
    const baseline = renderErrorPage(result.code, 'unit-trace', protocolAction(result.code), 'platform detail');
    expect(html).toBe(baseline.replaceAll('Moodle', 'your LMS'));
    expect(html).toContain('<p>your LMS said: <code>platform detail</code></p>');
  } finally { db.close(); }
});

it('fills all LMS occurrences literally and escapes the name at HTML output', () => {
  const name = '<your $& LMS>';
  const action = protocolAction('INVALID_OPENID_CONFIGURATION', name);
  expect(action).toBe(`${name} sent a registration that Cogniate cannot use. Start the registration again from ${name}. If it happens again, give the trace id to your Cogniate admin.`);
  expect(renderErrorPage('INVALID_OPENID_CONFIGURATION', 'trace', action, 'detail', undefined, name)).toContain('&lt;your $&amp; LMS&gt; said:');
  expect(cookieHelp('other', name)).toBe(`Start again from ${name}.`);
});
