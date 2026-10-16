// Playwright test object for QA specs.
// Auto fixture: every request to a host outside the stack is aborted and listed (test plan §5.4, Q-T0-27).
import { test as base, expect } from '@playwright/test';
import { hostnameOf, publicUrls } from './env';

const stackHosts = new Set(Object.values(publicUrls()).map(hostnameOf));

function isStackHost(hostname: string): boolean {
  return stackHosts.has(hostname) || hostname.endsWith('.test');
}

export const test = base.extend<{ externalRequests: string[] }>({
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
