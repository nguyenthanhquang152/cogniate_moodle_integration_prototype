import { runInNewContext } from 'node:vm';
import { sha256Hex } from '@cogniate/shared';
import { describe, expect, it, vi } from 'vitest';
import { storageCheckPage, storageLoginPage } from './storage-pages.ts';

const input = { authUrl: 'https://auth.example.edu/login?state=state&nonce=nonce', state: 'state', target: 'forwarding', origin: 'https://auth.example.edu' };
const dataBlock = (html: string) => html.match(/<script id="lti-storage-data" type="application\/json">([^]*?)<\/script>/)![1]!;

function browser(targetName = 'forwarding', topLevel = false, missing = false) {
  const page = storageLoginPage({ ...input, target: targetName });
  const data = JSON.parse(dataBlock(page.html)) as typeof input & { messageId: string; key: string };
  let receive: ((event: { origin: string; data: unknown }) => void) | undefined;
  let timeout: (() => void) | undefined;
  const postMessage = vi.fn();
  const setTimeout = vi.fn((callback: () => void, _ms: number) => { timeout = callback; return 1; });
  const clearTimeout = vi.fn();
  const window = {
    parent: {} as unknown,
    location: { replace: vi.fn() },
    addEventListener: vi.fn((_type: string, callback: typeof receive) => { receive = callback; }),
    removeEventListener: vi.fn(),
  };
  window.parent = topLevel ? window : { postMessage, frames: missing ? {} : { [targetName]: { postMessage } } };
  const script = page.html.match(/<script nonce="[^"]+">([^]*?)<\/script>/)![1]!;
  runInNewContext(script, { window, document: { getElementById: () => ({ textContent: dataBlock(page.html) }) }, setTimeout, clearTimeout });
  return { data, window, postMessage, setTimeout, clearTimeout, expire: () => timeout!(), reply: (value: unknown, origin = data.origin) => receive!({ origin, data: value }) };
}

describe('storage login page (LA-ADR-05 D1 rules 2, 3, 9)', () => {
  it('shows the static waiting text and JavaScript help (BD-A2-41)', () => {
    const page = storageLoginPage(input);
    expect(page.html).toContain('<p>Opening the activity. Please wait.</p>');
    expect(page.html).toContain('<noscript>This activity needs JavaScript. Turn on JavaScript in your browser, then open the activity again from your course.</noscript>');
  });
  it('escapes all five JSON characters and keeps request data out of script text (AC-06 builder)', () => {
    const hostile = '</script><script>alert(1)</script>&\u2028\u2029';
    const page = storageLoginPage({ ...input, authUrl: hostile });
    const json = dataBlock(page.html);
    for (const escape of ['\\u003c', '\\u003e', '\\u0026', '\\u2028', '\\u2029']) expect(json).toContain(escape);
    expect(JSON.parse(json).authUrl).toBe(hostile);
    expect(page.html).not.toContain(hostile);
    expect(page.html.match(/<script\b/g)).toHaveLength(2);
    expect(page.html.replace(json, '')).not.toContain('alert(1)');
    expect(page.html).not.toMatch(/<form|<button/);
  });

  it('uses a fresh matching CSP nonce for each page', () => {
    const a = storageLoginPage(input);
    const b = storageLoginPage(input);
    const nonce = a.html.match(/<script nonce="([^"]+)">/)![1];
    expect(a.headers['content-security-policy']).toBe(`default-src 'none'; script-src 'nonce-${nonce}'; frame-ancestors https:; form-action 'none'; base-uri 'none'`);
    expect(a.headers['content-security-policy']).not.toBe(b.headers['content-security-policy']);
  });

  it.each(['forwarding', '_parent'])('posts to %s and only the storage origin, with the bounded state key (AC-07)', (target) => {
    const b = browser(target);
    expect(b.postMessage).toHaveBeenCalledExactlyOnceWith({ subject: 'lti.put_data', message_id: b.data.messageId, key: `cog_state_${sha256Hex(input.state)[0]}`, value: input.state }, input.origin);
    expect(b.setTimeout).toHaveBeenCalledWith(expect.any(Function), 1500);
    expect(b.window.location.replace).not.toHaveBeenCalled();
    b.reply({ subject: 'lti.put_data.response', message_id: b.data.messageId });
    expect(b.window.location.replace).toHaveBeenCalledExactlyOnceWith(input.authUrl);
    expect(b.clearTimeout).toHaveBeenCalledWith(1);
    b.expire();
    expect(b.window.location.replace).toHaveBeenCalledTimes(1);
  });

  it('ignores wrong origins, subjects, message ids, malformed data and error replies until timeout', () => {
    const b = browser();
    const valid = { subject: 'lti.put_data.response', message_id: b.data.messageId };
    b.reply(valid, 'https://other.example.edu');
    for (const reply of [null, 'text', {}, { ...valid, subject: 'lti.get_data.response' }, { ...valid, message_id: 'wrong' }, { ...valid, error: null }]) b.reply(reply);
    expect(b.window.location.replace).not.toHaveBeenCalled();
    b.expire();
    expect(b.window.location.replace).toHaveBeenCalledExactlyOnceWith(input.authUrl);
    expect(b.window.removeEventListener).toHaveBeenCalledWith('message', expect.any(Function));
  });

  it('skips storage at once in a top-level page', () => {
    const b = browser('forwarding', true);
    expect(b.postMessage).not.toHaveBeenCalled();
    expect(b.setTimeout).not.toHaveBeenCalled();
    expect(b.window.location.replace).toHaveBeenCalledExactlyOnceWith(input.authUrl);
  });

  it('continues with the cookie when the named frame is absent', () => {
    const b = browser('forwarding', false, true);
    expect(b.postMessage).not.toHaveBeenCalled();
    expect(b.window.location.replace).toHaveBeenCalledExactlyOnceWith(input.authUrl);
  });
});

function checkBrowser(target = 'forwarding', topLevel = false) {
  const page = storageCheckPage({ postUrl: 'https://tool.test/lti/launch/unit/storage-check', check: 'check-token', stateHash: sha256Hex('secret-state'), target, origin: input.origin });
  const data = JSON.parse(dataBlock(page.html)) as { check: string; key: string; messageId: string; origin: string; postUrl: string };
  let receive: ((event: { origin: string; data: unknown }) => void) | undefined;
  let timeout: (() => void) | undefined;
  const postMessage = vi.fn();
  const form = {
    method: '', action: '', hidden: false, submit: vi.fn(), children: [] as Array<{ type: string; name: string; value: string }>,
    appendChild(child: { type: string; name: string; value: string }) { this.children.push(child); },
  };
  const document = {
    getElementById: () => ({ textContent: dataBlock(page.html) }),
    createElement: (name: string) => name === 'form' ? form : { type: '', name: '', value: '' },
    body: { appendChild: vi.fn() },
  };
  const window = { parent: {} as unknown, addEventListener: vi.fn((_type: string, fn: typeof receive) => { receive = fn; }), removeEventListener: vi.fn() };
  window.parent = topLevel ? window : { postMessage, frames: { [target]: { postMessage } } };
  const setTimeout = vi.fn((fn: () => void, _ms: number) => { timeout = fn; return 1; });
  const script = page.html.match(/<script nonce="[^"]+">([^]*?)<\/script>/)![1]!;
  runInNewContext(script, { window, document, setTimeout, clearTimeout: vi.fn() });
  return { page, data, postMessage, form, document, setTimeout, expire: () => timeout!(), reply: (reply: unknown, origin = input.origin) => receive!({ data: reply, origin }) };
}

describe('storage check page', () => {
  it.each(['forwarding', '_parent'])('gets the bounded key from %s and submits only the check and matching value once', (target) => {
    const b = checkBrowser(target);
    expect(b.postMessage).toHaveBeenCalledExactlyOnceWith({ subject: 'lti.get_data', key: `cog_state_${sha256Hex('secret-state')[0]}`, message_id: b.data.messageId }, input.origin);
    expect(b.page.html).not.toContain('secret-state');
    expect(b.page.html).not.toContain(sha256Hex('secret-state'));
    expect(b.form.submit).not.toHaveBeenCalled();
    b.reply({ subject: 'lti.get_data.response', message_id: b.data.messageId, value: 'stored-state' });
    expect(b.form).toMatchObject({ method: 'POST', action: b.data.postUrl, hidden: true, children: [
      { type: 'hidden', name: 'check', value: b.data.check }, { type: 'hidden', name: 'value', value: 'stored-state' },
    ] });
    expect(b.document.body.appendChild).toHaveBeenCalledExactlyOnceWith(b.form);
    b.expire();
    expect(b.form.submit).toHaveBeenCalledTimes(1);
  });

  it('ignores invalid replies and submits an empty value at 1500 ms', () => {
    const b = checkBrowser();
    const valid = { subject: 'lti.get_data.response', message_id: b.data.messageId, value: 'state' };
    b.reply(valid, 'https://evil.test');
    for (const value of [null, [], {}, { ...valid, message_id: 'other' }, { ...valid, subject: 'lti.put_data.response' }, { ...valid, error: false }, { ...valid, value: 4 }]) b.reply(value);
    expect(b.form.submit).not.toHaveBeenCalled();
    expect(b.setTimeout).toHaveBeenCalledWith(expect.any(Function), 1500);
    b.expire();
    expect(b.form.children[1]).toMatchObject({ name: 'value', value: '' });
    expect(b.form.submit).toHaveBeenCalledTimes(1);
  });

  it('uses the self-only form CSP and same-origin referrer, with escaped data and a fresh nonce', () => {
    const data = { postUrl: 'https://tool.test/</script>&\u2028\u2029', check: 'check', stateHash: sha256Hex('state'), target: '_parent', origin: input.origin };
    const page = storageCheckPage(data);
    const nonce = page.html.match(/<script nonce="([^"]+)">/)![1];
    expect(page.headers).toMatchObject({ 'cache-control': 'no-store', 'referrer-policy': 'same-origin', 'content-security-policy': `default-src 'none'; script-src 'nonce-${nonce}'; frame-ancestors https:; form-action 'self'; base-uri 'none'` });
    expect(storageCheckPage(data).headers['content-security-policy']).not.toBe(page.headers['content-security-policy']);
    expect(JSON.parse(dataBlock(page.html)).postUrl).toBe(data.postUrl);
    for (const escaped of ['\\u003c', '\\u003e', '\\u0026', '\\u2028', '\\u2029']) expect(dataBlock(page.html)).toContain(escaped);
    expect(page.html.replace(dataBlock(page.html), '')).not.toContain(data.postUrl);
  });

  it('posts an empty value at once outside a frame', () => {
    const b = checkBrowser('_parent', true);
    expect(b.postMessage).not.toHaveBeenCalled();
    expect(b.setTimeout).not.toHaveBeenCalled();
    expect(b.form.children[1]).toMatchObject({ name: 'value', value: '' });
    expect(b.form.submit).toHaveBeenCalledTimes(1);
  });
});
