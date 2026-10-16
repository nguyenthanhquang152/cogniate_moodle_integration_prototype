// Playwright test object for QA specs.
// Auto fixture: every request to a host outside the stack is aborted and listed (test plan §5.4, Q-T0-27).
import { test as base, expect } from '@playwright/test';
import { hostnameOf, publicUrls } from './env';
import { activeKnobs, knobSkipReason } from './knobs';

const stackHosts = new Set(Object.values(publicUrls()).map(hostnameOf));

function isStackHost(hostname: string): boolean {
  return stackHosts.has(hostname) || hostname.endsWith('.test');
}

export const test = base.extend<{ knobGuard: void; externalRequests: string[] }>({
  // Knob guard (lib/knobs.ts): runs before every test.
  knobGuard: [
    async ({}, use, testInfo) => {
      const reason = knobSkipReason(testInfo.title, await activeKnobs());
      testInfo.skip(reason !== null, reason ?? '');
      await use();
    },
    { auto: true },
  ],
  externalRequests: [
    async ({ context }, use, testInfo) => {
      const blocked: string[] = [];
      await context.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (isStackHost(url.hostname)) return route.continue();
        blocked.push(`${url.origin}${url.pathname}`);
        return route.abort('blockedbyclient');
      });
      await use(blocked);
      if (blocked.length > 0) {
        await testInfo.attach('blocked-external-requests.txt', {
          body: [...new Set(blocked)].join('\n'),
          contentType: 'text/plain',
        });
      }
    },
    { auto: true },
  ],
});

export { expect };
