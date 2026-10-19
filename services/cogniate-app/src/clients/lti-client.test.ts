import type { OutboundRequest } from '@cogniate/shared';
import { expect, it } from 'vitest';
import { createLtiClient } from './lti-client.ts';

it('P1: only registration completion overrides the guarded outbound deadline to 15 seconds', async () => {
  const requests: Array<{ url: string; req: OutboundRequest }> = [];
  const client = createLtiClient({
    ltiUrl: 'https://lti.test', apiKeyFile: 'unused', readKey: () => 'test-key',
    outbound: {
      allowlist: ['lti.test'],
      async request(url, req = {}) {
        requests.push({ url, req });
        const json = url.endsWith('/complete') ? { platformId: 'plt_1', html: '' }
          : url.includes('/registrations/') ? { url: 'https://moodle.test', supportedScopes: [], supportedMessages: [], privacyLevel: 'anonymous', operation: 'new', existingPlatformId: null }
            : { id: 'plt_1', url: 'https://moodle.test', clientId: 'c1', name: 'Cogniate', active: true, deploymentIds: ['1'] };
        const body = Buffer.from(JSON.stringify(json));
        return { status: 200, headers: {}, body, text: () => body.toString(), json: () => json };
      },
    },
  });
  await client.getRegistration('reg_1', 'trace');
  await client.completeRegistration('reg_1', { platformName: 'Cogniate', privacyLevel: 'anonymous', autoActivate: true }, 'trace');
  await client.getPlatform('plt_1', 'trace');
  expect(requests.map(({ req }) => req.timeoutMs)).toEqual([undefined, 15_000, undefined]);
  expect(requests[1]).toMatchObject({ url: 'https://lti.test/api/registrations/reg_1/complete', req: { method: 'POST', traceId: 'trace', headers: { authorization: 'Bearer test-key', 'x-trace-id': 'trace' } } });
});
