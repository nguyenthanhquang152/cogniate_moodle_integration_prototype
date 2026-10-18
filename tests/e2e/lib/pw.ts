// Playwright test object for the T7 E2E suite.
// - Every browser context that a step makes blocks hosts outside the stack (tasks README §2) and lists the blocked URLs.
//   The config adds a second guard (Chromium cannot resolve names outside *.test).
// - No knob guard here: T7 runs without knobs, and AC-T7-13 checks that.
import type { Browser, BrowserContext } from '@playwright/test';
import { test as base, expect } from '@playwright/test';
import { hostnameOf } from '../../acceptance/lib/env';
import { urls } from './e2e';

const stackHosts = new Set(Object.values(urls).map(hostnameOf));
const blocked: string[] = [];

/** A new browser context for one person (Thanh, admin, cg_teacher, …). Hosts outside the stack are blocked. */
export async function newContext(browser: Browser, { clipboard = false }: { clipboard?: boolean } = {}): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: process.env.QA_IGNORE_HTTPS_ERRORS === '1' });
  await context.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (stackHosts.has(u.hostname) || u.hostname.endsWith('.test')) return route.continue();
    blocked.push(`${u.origin}${u.pathname}`);
    return route.abort('blockedbyclient');
  });
  if (clipboard) await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: urls.app });
  return context;
}

export const test = base.extend<{ blockedRequests: void }>({
  blockedRequests: [
    async ({}, use, testInfo) => {
      blocked.length = 0;
      await use();
      if (blocked.length > 0) {
        await testInfo.attach('blocked-external-requests.txt', { body: [...new Set(blocked)].join('\n'), contentType: 'text/plain' });
      }
    },
    { auto: true },
  ],
});

export { expect };
