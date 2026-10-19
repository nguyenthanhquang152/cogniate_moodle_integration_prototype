import { createServer } from 'node:http';
import { describe, expect, it } from 'vitest';
import { listen, portFromEnv, sendJson } from './http.ts';

describe('listen', () => {
  it('resolves with the bound address (port 0 picks a free port)', async () => {
    const server = createServer((_req, res) => sendJson(res, 200, { ok: true }));
    try {
      const addr = await listen(server, 0, '127.0.0.1');
      expect(addr.port).toBeGreaterThan(0);
      const res = await fetch(`http://127.0.0.1:${addr.port}/`);
      expect([res.status, await res.json()]).toEqual([200, { ok: true }]);
    } finally {
      server.close();
    }
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
