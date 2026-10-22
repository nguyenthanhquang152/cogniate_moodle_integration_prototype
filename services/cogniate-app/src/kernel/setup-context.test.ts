import { buildChannelRegistry, loadChannelFolders } from '@cogniate/channel-kernel';
import { expect, it } from 'vitest';
import type { PortContext } from './ports.ts';
import { CHANNEL_ROOT } from './registry.ts';
import { setupOf } from './setup.ts';
import { toolContext } from './setup/common.ts';

it('builds all account URLs in the kernel from the public LTI base', () => {
  expect(toolContext({ lti: 'https://lti.test', app: 'https://app.test', content: 'https://content.test' })).toEqual({
    toolAccountId: 'cogniate', toolUrls: {
      login: 'https://lti.test/lti/login/cogniate', launch: 'https://lti.test/lti/launch/cogniate',
      keys: 'https://lti.test/lti/keys/cogniate', register: 'https://lti.test/lti/register/cogniate', ltiOrigin: 'https://lti.test',
    },
  });
});

it('uses injected URLs in discovered setup rows and configuration artifacts', async () => {
  const channels = buildChannelRegistry(await loadChannelFolders([CHANNEL_ROOT], 'app'), { simulations: true });
  const toolUrls = { login: 'https://login.test/start', launch: 'https://launch.test/start', keys: 'https://keys.test/public', register: 'https://register.test/start', ltiOrigin: 'https://selected.test' };
  const ctx = { toolAccountId: 'selected-account', toolUrls, urls: { lti: 'https://unused.test', app: 'https://app.test', content: 'https://content.test' }, libraryName: 'Library A', sharedClientId: 'shared' };
  for (const channel of channels.channels()) {
    const adapter = setupOf(channels, channel.id);
    if (!adapter) continue;
    const rows = adapter.toolConfiguration(ctx);
    expect(JSON.stringify(rows), channel.id).toContain(toolUrls.launch);
    expect(JSON.stringify(rows), channel.id).not.toContain(ctx.urls.lti);
    for (const route of adapter.extensionRoutes ?? []) {
      if (route.capability !== 'setup.artifacts') continue;
      const response = await route.handle({ body: null, query: {} }, ctx as unknown as PortContext);
      expect(response).toMatchObject({ status: 200, body: {
        oidc_initiation_url: toolUrls.login, target_link_uri: toolUrls.launch, public_jwk_url: toolUrls.keys,
        extensions: [expect.objectContaining({ domain: 'selected.test', tool_id: 'selected-account' })],
      } });
    }
  }
});
