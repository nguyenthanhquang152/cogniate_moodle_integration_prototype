import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { RequestOptions } from 'node:https';
import { createServer, request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createLogger } from './logger.ts';
import type { OutboundOptions, Resolver } from './outbound.ts';
import { OutboundError, createOutboundClient, isBlockedAddress, parseAllowlist } from './outbound.ts';

// The client always builds https requests. The tests swap the transport for plain http to a local server, but keep
// the guarded lookup: the connection goes to whatever address the guarded lookup returned.
let server: Server | undefined;
let hits: string[] = [];
afterEach(() => { server?.close(); server = undefined; hits = []; });

async function startServer(handler: (req: IncomingMessage, res: ServerResponse) => void): Promise<number> {
  server = createServer((req, res) => { hits.push(req.url ?? ''); handler(req, res); });
  await new Promise<void>((r) => server!.listen(0, '127.0.0.1', () => r()));
  return (server.address() as AddressInfo).port;
}

function client(port: number, extra: Partial<OutboundOptions> = {}) {
  const lines: Array<Record<string, unknown>> = [];
  const logger = createLogger({ service: 'test', write: (l) => lines.push(JSON.parse(l) as Record<string, unknown>), level: 'debug' });
  const viaHttp = (opts: RequestOptions, cb: (res: IncomingMessage) => void) =>
    httpRequest({ ...opts, protocol: 'http:', port }, cb);
  const c = createOutboundClient({ logger, requestImpl: viaHttp, timeoutMs: 1000, ...extra });
  return { c, lines, events: () => lines.filter((l) => String(l.event).startsWith('outbound_')) };
}

const resolveTo = (...addresses: string[]): Resolver => async () => addresses.map((a) => ({ address: a, family: a.includes(':') ? 6 : 4 }));

describe('isBlockedAddress', () => {
  it.each([
    '0.1.2.3', '10.1.2.3', '100.64.0.1', '100.127.255.255', '127.0.0.1', '169.254.169.254', '172.16.0.1', '172.31.255.255',
    '192.0.0.8', '192.168.1.1', '198.18.0.1', '198.19.255.255', '224.0.0.1', '239.1.1.1', '240.0.0.1', '255.255.255.255',
    '::', '::1', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1', '64:ff9b::1.2.3.4', '::ffff:127.0.0.1', '::ffff:10.0.0.1', '::ffff:a9fe:a9fe',
    // A-T2a-04 (defence in depth): IPv4-compatible, 6to4, old site-local.
    '::127.0.0.1', '::7f00:1', '::8.8.8.8', '2002:7f00:1::1', 'fec0::1',
  ])('blocks %s', (ip) => expect(isBlockedAddress(ip)).toBe(true));

  it.each(['8.8.8.8', '1.1.1.1', '100.63.255.255', '172.15.255.255', '172.32.0.1', '198.20.0.1', '2001:4860:4860::8888', '::ffff:8.8.8.8'])(
    'allows %s', (ip) => expect(isBlockedAddress(ip)).toBe(false));

  it('blocks text that is not an IP address', () => expect(isBlockedAddress('moodle.test')).toBe(true));
});

describe('createOutboundClient', () => {
  it('refuses http and logs one outbound_blocked event, without a request', async () => {
    const port = await startServer((_q, s) => s.end('x'));
    const { c, events } = client(port);
    await expect(c.request('http://example.test/x')).rejects.toMatchObject({ reason: 'not_https' });
    expect(hits).toEqual([]);
    expect(events()).toEqual([expect.objectContaining({ event: 'outbound_blocked', host: 'example.test', reason: 'not_https' })]);
  });

  it('blocks a host that resolves to a private address (no connection)', async () => {
    const port = await startServer((_q, s) => s.end('x'));
    const { c, events } = client(port, { resolver: resolveTo('127.0.0.1') });
    await expect(c.request('https://jwks.example/keys')).rejects.toMatchObject({ reason: 'private_ip' });
    expect(hits).toEqual([]);
    expect(events()).toHaveLength(1);
  });

  it('blocks when ANY address of the answer is private: public first, private second (DNS rebinding)', async () => {
    const port = await startServer((_q, s) => s.end('x'));
    const { c } = client(port, { resolver: resolveTo('8.8.8.8', '127.0.0.1') });
    await expect(c.request('https://rebind.example/keys')).rejects.toMatchObject({ reason: 'private_ip' });
    expect(hits).toEqual([]);
  });

  it('lets an allowlisted host resolve to a private address, uses that address for the connection, and logs outbound_request', async () => {
    const port = await startServer((_q, s) => { s.setHeader('content-type', 'application/json'); s.end('{"keys":[]}'); });
    const { c, events } = client(port, { resolver: resolveTo('127.0.0.1'), allowlist: parseAllowlist(' Moodle.Test , other.test') });
    const res = await c.request('https://moodle.test/mod/lti/certs.php', { traceId: 'trace-0123456789abcdef' });
    expect(res.status).toBe(200);
    expect(res.json()).toEqual({ keys: [] });
    expect(hits).toEqual(['/mod/lti/certs.php']);
    expect(events()).toEqual([expect.objectContaining({ event: 'outbound_request', host: 'moodle.test', method: 'GET', status: 200, trace_id: 'trace-0123456789abcdef' })]);
  });

  it('blocks a private IP literal without a DNS lookup', async () => {
    let asked = 0;
    const { c } = client(1, { resolver: async () => { asked += 1; return []; } });
    await expect(c.request('https://169.254.169.254/latest/meta-data')).rejects.toMatchObject({ reason: 'private_ip' });
    await expect(c.request('https://[::1]/x')).rejects.toMatchObject({ reason: 'private_ip' });
    expect(asked).toBe(0);
  });

  it('does not follow a redirect', async () => {
    const port = await startServer((q, s) => { if (q.url === '/start') { s.statusCode = 302; s.setHeader('location', '/target'); } s.end(); });
    const { c, events } = client(port, { resolver: resolveTo('127.0.0.1'), allowlist: ['moodle.test'] });
    await expect(c.request('https://moodle.test/start')).rejects.toMatchObject({ reason: 'redirect' });
    expect(hits).toEqual(['/start']);
    expect(events()).toEqual([expect.objectContaining({ event: 'outbound_blocked', reason: 'redirect' })]);
  });

  it('stops a response over the size limit', async () => {
    const port = await startServer((_q, s) => s.end('x'.repeat(5000)));
    const { c } = client(port, { resolver: resolveTo('127.0.0.1'), allowlist: ['moodle.test'], maxBytes: 1024 });
    await expect(c.request('https://moodle.test/big')).rejects.toMatchObject({ reason: 'too_large' });
  });

  it('times out', async () => {
    const port = await startServer(() => { /* never answers */ });
    const { c, events } = client(port, { resolver: resolveTo('127.0.0.1'), allowlist: ['moodle.test'], timeoutMs: 150 });
    await expect(c.request('https://moodle.test/slow')).rejects.toMatchObject({ reason: 'timeout' });
    expect(events()).toHaveLength(1);
  });

  it('P1: a request timeout override permits a slow response and leaves the next request at the default', async () => {
    const port = await startServer((_q, s) => { setTimeout(() => s.end('done'), 100); });
    const { c, events } = client(port, { resolver: resolveTo('127.0.0.1'), allowlist: ['moodle.test'], timeoutMs: 30 });
    expect((await c.request('https://moodle.test/complete', { method: 'POST', timeoutMs: 1000 })).text()).toBe('done');
    await expect(c.request('https://moodle.test/ordinary')).rejects.toMatchObject({ reason: 'timeout', message: 'no answer in 30 ms' });
    expect(events().map((e) => [e.event, e.reason ?? null])).toEqual([['outbound_request', null], ['outbound_blocked', 'timeout']]);
  });

  // A-T2a-01: one event per attempt. The attempt must not log a second, false event (timeout or network_error)
  // after it ended with a refused redirect or an oversize answer. Wait longer than the timeout to see it.
  const settle = () => new Promise((r) => setTimeout(r, 350));
  it.each([
    ['redirect', (_q: IncomingMessage, s: ServerResponse) => { s.statusCode = 302; s.setHeader('location', '/x'); s.end(); }],
    ['too_large (declared length)', (_q: IncomingMessage, s: ServerResponse) => { s.setHeader('content-length', '5000'); s.end('x'.repeat(5000)); }],
    ['too_large (streamed body)', (_q: IncomingMessage, s: ServerResponse) => { s.write('x'.repeat(3000)); setTimeout(() => s.end('y'), 1000); }],
  ])('exactly one event after %s, also after the timeout has passed', async (label, handler) => {
    const port = await startServer(handler);
    const { c, events } = client(port, { resolver: resolveTo('127.0.0.1'), allowlist: ['moodle.test'], maxBytes: 1024, timeoutMs: 150 });
    await expect(c.request('https://moodle.test/x')).rejects.toBeInstanceOf(OutboundError);
    await settle();
    expect(events().map((e) => `${String(e.event)}:${String(e.reason)}`), label).toEqual([`outbound_blocked:${label.split(' ')[0]}`]);
  });

  it('exactly one event after a timeout and after a success', async () => {
    const slow = await startServer(() => { /* never answers */ });
    const a = client(slow, { resolver: resolveTo('127.0.0.1'), allowlist: ['moodle.test'], timeoutMs: 100 });
    await expect(a.c.request('https://moodle.test/slow')).rejects.toMatchObject({ reason: 'timeout' });
    await settle();
    expect(a.events()).toHaveLength(1);
    server?.close();
    const ok = await startServer((_q, s) => s.end('ok'));
    const b = client(ok, { resolver: resolveTo('127.0.0.1'), allowlist: ['moodle.test'], timeoutMs: 100 });
    await b.c.request('https://moodle.test/ok');
    await settle();
    expect(b.events().map((e) => e.event)).toEqual(['outbound_request']);
  });

  it('reports a DNS error', async () => {
    const { c } = client(1, { resolver: async () => { throw new Error('NXDOMAIN'); } });
    const err = await c.request('https://nowhere.example/x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OutboundError);
    expect((err as OutboundError).reason).toBe('dns_error');
  });

  it('retries a GET once on a network error, never a POST', async () => {
    const { c, events } = client(9, { resolver: resolveTo('127.0.0.1'), allowlist: ['moodle.test'] }); // port 9: nothing listens
    await expect(c.request('https://moodle.test/x')).rejects.toMatchObject({ reason: 'network_error' });
    expect(events()).toHaveLength(2);
    const post = client(9, { resolver: resolveTo('127.0.0.1'), allowlist: ['moodle.test'] });
    await expect(post.c.request('https://moodle.test/x', { method: 'POST', body: 'a=1' })).rejects.toMatchObject({ reason: 'network_error' });
    expect(post.events()).toHaveLength(1);
  });
});
