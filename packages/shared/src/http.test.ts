import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import type { HealthServerOptions } from './http.ts';
import { createHealthServer, listen, portFromEnv } from './http.ts';
import { createLogger } from './logger.ts';

let server: Server | undefined;
afterEach(() => {
  server?.close();
  server = undefined;
});

async function start(name: string, options: HealthServerOptions = {}): Promise<string> {
  server = createHealthServer(name, options);
  const addr = await listen(server, 0, '127.0.0.1');
  return `http://127.0.0.1:${addr.port}`;
}

describe('createHealthServer', () => {
  it('answers GET /healthz with status ok, the service name and no knobs', async () => {
    const base = await start('demo-service');
    const res = await fetch(`${base}/healthz`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({ status: 'ok', service: 'demo-service', knobs: [] });
  });

  it('lists active knobs', async () => {
    const base = await start('demo-service', { knobs: [{ name: 'CLOCK_SKEW_S', value: '90' }] });
    const body = (await (await fetch(`${base}/healthz`)).json()) as { knobs: unknown };
    expect(body.knobs).toEqual([{ name: 'CLOCK_SKEW_S', value: '90' }]);
  });

  it('answers other paths and methods with 404 in the error shape', async () => {
    const base = await start('demo-service');
    const res = await fetch(`${base}/nope`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      status: 404,
      error: 'Not Found',
      details: { message: 'NOT_FOUND', description: 'No route for GET /nope' },
    });
    expect((await fetch(`${base}/healthz`, { method: 'POST' })).status).toBe(404);
  });

  it('logs http_request with a redacted path and keeps a valid caller trace id', async () => {
    const lines: string[] = [];
    const logger = createLogger({ service: 'demo-service', write: (l) => lines.push(l), level: 'info' });
    const base = await start('demo-service', { logger });
    const res = await fetch(`${base}/rt/Abc123_def456-ghi789XYZ/x?ltik=secret-value`, { headers: { 'x-trace-id': 'trace-12345678' } });
    expect(res.headers.get('x-trace-id')).toBe('trace-12345678');
    await new Promise((r) => setTimeout(r, 20));
    const row = JSON.parse(lines[0] ?? '{}');
    expect(row).toMatchObject({ service: 'demo-service', event: 'http_request', trace_id: 'trace-12345678', method: 'GET', path: '/rt/:redacted/x', status: 404 });
    expect(typeof row.ms).toBe('number');
    expect(lines.join('')).not.toContain('secret-value');
    expect(lines.join('')).not.toContain('Abc123_def456');
  });

  it('logs /healthz only at debug level (health checks do not fill the logs)', async () => {
    const info: string[] = [];
    const debug: string[] = [];
    server = createHealthServer('demo-service', { logger: createLogger({ service: 'd', write: (l) => info.push(l), level: 'info' }) });
    const a = await listen(server, 0, '127.0.0.1');
    await fetch(`http://127.0.0.1:${a.port}/healthz`);
    server.close();
    server = createHealthServer('demo-service', { logger: createLogger({ service: 'd', write: (l) => debug.push(l), level: 'debug' }) });
    const b = await listen(server, 0, '127.0.0.1');
    await fetch(`http://127.0.0.1:${b.port}/healthz`);
    await new Promise((r) => setTimeout(r, 20));
    expect(info).toEqual([]);
    expect(JSON.parse(debug[0] ?? '{}')).toMatchObject({ level: 'debug', event: 'http_request', path: '/healthz' });
  });

  it('makes a new trace id when the header is not safe', async () => {
    const base = await start('demo-service');
    const res = await fetch(`${base}/healthz`, { headers: { 'x-trace-id': 'bad id!' } });
    expect(res.headers.get('x-trace-id')).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('portFromEnv', () => {
  it('uses the fallback when the variable is not set', () => {
    delete process.env.TEST_PORT_X;
    expect(portFromEnv('TEST_PORT_X', 4100)).toBe(4100);
  });

  it('rejects a value that is not a port', () => {
    process.env.TEST_PORT_X = 'abc';
    expect(() => portFromEnv('TEST_PORT_X', 4100)).toThrow(/must be a port number/);
    delete process.env.TEST_PORT_X;
  });
});
