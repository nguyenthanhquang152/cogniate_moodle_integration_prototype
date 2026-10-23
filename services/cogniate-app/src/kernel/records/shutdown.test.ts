import { createServer, type Server } from 'node:http';
import { connect, type AddressInfo, type Socket } from 'node:net';
import { createLogger, type LogLine } from '@cogniate/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShutdownHandler, HTTP_DRAIN_MS, SERVICE_EXIT_AFTER_MS, stopService } from './shutdown.ts';

const open: Server[] = [];
afterEach(() => {
  vi.useRealTimers();
  for (const server of open.splice(0)) { server.closeAllConnections(); server.close(); }
});
function fixture(close: () => Promise<void>) {
  vi.useFakeTimers();
  const lines: LogLine[] = [];
  const loggers = ['cogniate-app', 'cogniate-content'].map((service) => createLogger({ service, write: (line) => lines.push(JSON.parse(line) as LogLine) }));
  const exit = vi.fn();
  return { lines, exit, stop: createShutdownHandler({ close, loggers }, exit) };
}

it('A-LA-E4-02-01: logs stopping for both listeners and forces exit only after 70 seconds', async () => {
  const close = vi.fn(() => new Promise<void>(() => {}));
  const f = fixture(close);
  expect(SERVICE_EXIT_AFTER_MS).toBe(70_000);
  f.stop('SIGTERM');
  await vi.advanceTimersByTimeAsync(60_000);
  expect(f.exit).not.toHaveBeenCalled();
  f.stop('SIGINT');
  expect(close).toHaveBeenCalledOnce();
  expect(f.lines.filter((l) => l.event === 'service_stopping')).toEqual([
    expect.objectContaining({ service: 'cogniate-app', signal: 'SIGTERM', level: 'info' }),
    expect.objectContaining({ service: 'cogniate-content', signal: 'SIGTERM', level: 'info' }),
  ]);
  await vi.advanceTimersByTimeAsync(9999);
  expect(f.exit).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(f.exit).toHaveBeenCalledExactlyOnceWith(1);
  expect(f.lines.filter((l) => l.event === 'service_exit_forced')).toEqual([
    expect.objectContaining({ service: 'cogniate-app', after_ms: 70_000, level: 'error' }),
    expect.objectContaining({ service: 'cogniate-content', after_ms: 70_000, level: 'error' }),
  ]);
});

it('cancels the fallback and exits 0 after a clean close beyond the runner grace', async () => {
  const closing = Promise.withResolvers<void>();
  const f = fixture(() => closing.promise);
  f.stop('SIGINT');
  await vi.advanceTimersByTimeAsync(65_000);
  expect(f.exit).not.toHaveBeenCalled();
  closing.resolve(); await vi.advanceTimersByTimeAsync(0);
  expect(f.exit).toHaveBeenCalledExactlyOnceWith(0);
  await vi.advanceTimersByTimeAsync(10_000);
  expect(f.exit).toHaveBeenCalledTimes(1);
  expect(f.lines.some((l) => l.event === 'service_exit_forced')).toBe(false);
});

it.each(['throw', 'reject'])('cancels the fallback and exits 1 when close fails (%s)', async (mode) => {
  const f = fixture(() => { if (mode === 'throw') throw new Error('close failed'); return Promise.reject(new Error('close failed')); });
  f.stop('SIGTERM');
  await vi.advanceTimersByTimeAsync(70_000);
  expect(f.exit).toHaveBeenCalledExactlyOnceWith(1);
  expect(f.lines.some((l) => l.event === 'service_exit_forced')).toBe(false);
});

/** A real server: /ok answers at once (the connection stays open as keep-alive), /hold never answers. */
async function server() {
  const held: string[] = [];
  const srv = createServer((req, res) => { if (req.url === '/ok') res.end('ok'); else held.push(String(req.url)); });
  open.push(srv);
  await new Promise<void>((resolve) => srv.listen(0, '127.0.0.1', resolve));
  const port = (srv.address() as AddressInfo).port;
  /** One raw HTTP/1.1 request on its own socket. */
  const request = (path: string) => {
    const socket: Socket = connect(port, '127.0.0.1');
    let data = '';
    socket.on('data', (chunk: Buffer) => { data += chunk.toString(); });
    socket.on('error', () => {});
    const closed = new Promise<void>((resolve) => socket.once('close', () => resolve()));
    socket.write(`GET ${path} HTTP/1.1\r\nHost: test\r\n\r\n`);
    return { closed, data: () => data };
  };
  const refused = () => new Promise<string>((resolve) => {
    const socket = connect(port, '127.0.0.1');
    socket.once('connect', () => { socket.destroy(); resolve('connected'); });
    socket.once('error', (err: NodeJS.ErrnoException) => resolve(String(err.code)));
  });
  return { srv, held, request, refused };
}

/** Wait on real I/O; fake timers fake only setTimeout and clearTimeout here. */
const until = async (check: () => boolean) => { while (!check()) await new Promise<void>((resolve) => setImmediate(resolve)); };

describe('stop order (BD-A2-109)', () => {
  it('(a) idle runner and one held request: idle keep-alive closes at once; close resolves at 3 s and cuts the held request without an answer', async () => {
    const s = await server();
    const idle = s.request('/ok');
    await until(() => idle.data().includes('ok'));
    const held = s.request('/hold');
    await until(() => s.held.length === 1);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const stop = vi.fn(async () => {});
    let dbClosed = false;
    let done = false;
    const closing = stopService({ servers: [s.srv], runner: { stop }, closeDb: () => { dbClosed = true; } }).then(() => { done = true; });
    await idle.closed;
    expect(stop).toHaveBeenCalledOnce();
    expect(await s.refused()).toBe('ECONNREFUSED');
    await vi.advanceTimersByTimeAsync(HTTP_DRAIN_MS - 1);
    expect([done, dbClosed]).toEqual([false, false]);
    await vi.advanceTimersByTimeAsync(1);
    await held.closed;
    await closing;
    expect([done, dbClosed, held.data()]).toEqual([true, true, '']);
    expect(HTTP_DRAIN_MS).toBe(3000);
  });

  it('(b) a run in flight and one held request: the request is cut at 3 s, new connections are refused at once, the database closes after the run', async () => {
    const s = await server();
    const held = s.request('/hold');
    await until(() => s.held.length === 1);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const run = Promise.withResolvers<void>();
    const stop = vi.fn(() => run.promise);
    let dbClosed = false;
    const closing = stopService({ servers: [s.srv], runner: { stop }, closeDb: () => { dbClosed = true; } });
    expect(await s.refused()).toBe('ECONNREFUSED');
    expect(stop).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(HTTP_DRAIN_MS);
    await held.closed;
    expect(held.data()).toBe('');
    await vi.advanceTimersByTimeAsync(50_000);
    expect(dbClosed).toBe(false);
    run.resolve();
    await closing;
    expect(dbClosed).toBe(true);
  });

  it('closes the database also when a step fails, then gives the error', async () => {
    const s = await server();
    let dbClosed = false;
    await expect(stopService({ servers: [s.srv], runner: { stop: async () => { throw new Error('stop failed'); } }, closeDb: () => { dbClosed = true; } }))
      .rejects.toThrow('stop failed');
    expect(dbClosed).toBe(true);
  });
});
