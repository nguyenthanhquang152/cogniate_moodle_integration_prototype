import { describe, expect, it } from 'vitest';
import { listen } from '@cogniate/shared';
import { buildAppServer, buildContentServer } from './servers.ts';

describe('cogniate-app placeholder', () => {
  it('serves two listeners with different service names', async () => {
    const app = buildAppServer();
    const content = buildContentServer();
    const a = await listen(app, 0, '127.0.0.1');
    const c = await listen(content, 0, '127.0.0.1');
    try {
      expect(await (await fetch(`http://127.0.0.1:${a.port}/healthz`)).json()).toEqual({ status: 'ok', service: 'cogniate-app', profile: 'default', knobs: [] });
      expect(await (await fetch(`http://127.0.0.1:${c.port}/healthz`)).json()).toEqual({ status: 'ok', service: 'cogniate-content', profile: 'default', knobs: [] });
    } finally {
      app.close();
      content.close();
    }
  });
});
