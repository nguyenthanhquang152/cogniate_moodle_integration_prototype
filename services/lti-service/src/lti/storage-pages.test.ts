import { runInNewContext } from 'node:vm';
import { sha256Hex } from '@cogniate/shared';
import { describe, expect, it, vi } from 'vitest';
import { storageLoginPage } from './storage-pages.ts';

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
