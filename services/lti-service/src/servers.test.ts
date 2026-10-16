import { describe, expect, it } from 'vitest';
import { listen } from '@cogniate/shared';
import { buildServer } from './servers.ts';

describe('lti-service placeholder', () => {
  it('reports its service name on /healthz', async () => {
    const server = buildServer();
    const { port } = await listen(server, 0, '127.0.0.1');
    try {
      const res = await fetch(`http://127.0.0.1:${port}/healthz`);
      expect(await res.json()).toEqual({ status: 'ok', service: 'lti-service', knobs: [] });
    } finally {
      server.close();
    }
  });
});
