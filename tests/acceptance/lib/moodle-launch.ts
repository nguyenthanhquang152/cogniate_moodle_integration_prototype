// Real Moodle LTI launches in Playwright, with capture of the protocol steps (T2 onward).
// Moodle 5.2.4 mod/lti/view.php: for launch container "New window" it calls window.open(launch.php?id=…) and also
// shows a link with target=_blank. launch.php posts the login form to the tool; auth.php posts id_token + state.
import type { Browser, BrowserContext, Page, Request, Route } from '@playwright/test';
import { hostnameOf, publicUrls } from './env';
import { LAUNCH_URL, LOGIN_URL, recordSecret } from './lti';
import { moodleLogin } from './moodle-ui';
import type { MoodleUser } from './seed';

const urls = publicUrls();
const stackHosts = new Set(Object.values(urls).map(hostnameOf));

export interface LaunchCapture {
  user: string;
  startedAt: number;
  /** Form fields that Moodle sent to the login URL (iss, login_hint, lti_message_hint, ...). */
  loginRequest?: Record<string, string>;
  login?: { status: number; location: string; setCookies: string[] };
  post?: { id_token: string; state: string };
  launch?: { status: number; headers: Record<string, string>; setCookies: string[]; location: string };
  /** Time (ms) when the 303 of the launch arrived. */
  launchAt?: number;
  /** First 4xx/5xx page from the login or launch URL (untilError mode or a failed launch). */
  errorPage?: { endpoint: 'login' | 'launch'; status: number; headers: Record<string, string>; body: string };
  finalUrl?: string;
  ltik?: string | null;
  msToFinal?: number;
  popup?: Page;
}

/** A browser context like the test fixture: same HTTPS setting, hosts outside the stack blocked. */
export async function newStackContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext({ ignoreHTTPSErrors: process.env.QA_IGNORE_HTTPS_ERRORS === '1', viewport: { width: 1440, height: 900 } });
  await context.route('**/*', (route) => {
    const host = new URL(route.request().url()).hostname;
    return stackHosts.has(host) || host.endsWith('.test') ? route.continue() : route.abort('blockedbyclient');
  });
  return context;
}

/**
 * Open an LTI activity as a Moodle user. With `hold: true`, QA keeps the id_token POST: the browser gets a QA page
 * instead, and the state stays unused for later tests.
 */
export async function launchActivity(
  context: BrowserContext,
  user: MoodleUser,
  cmid: number,
  { hold = false, untilError = false, timeoutMs = 10_000 }: { hold?: boolean; untilError?: boolean; timeoutMs?: number } = {},
): Promise<LaunchCapture> {
  const cap: LaunchCapture = { user: user.username, startedAt: 0 };
  const page = await context.newPage();
  await moodleLogin(page, urls.moodle, user.username, user.password);

  const onResponse = async (res: import('@playwright/test').Response) => {
    const req: Request = res.request();
    const url = req.url();
    const status = res.status();
    if (url.startsWith(LOGIN_URL) && status >= 300 && status < 400) {
      const all = await res.headersArray();
      cap.login = { status, location: res.headers().location ?? '', setCookies: all.filter((h) => h.name.toLowerCase() === 'set-cookie').map((h) => h.value) };
    }
    if ((url.startsWith(LOGIN_URL) || url.startsWith(LAUNCH_URL)) && status >= 400 && !cap.errorPage) {
      cap.errorPage = {
        endpoint: url.startsWith(LOGIN_URL) ? 'login' : 'launch',
        status,
        headers: await res.allHeaders(),
        body: await res.text().catch(() => ''),
      };
    }
    if (url.startsWith(LAUNCH_URL) && req.method() === 'POST' && !hold) {
      if (status === 303) cap.launchAt = Date.now();
      const all = await res.headersArray();
      cap.launch = {
        status,
        headers: await res.allHeaders(),
        setCookies: all.filter((h) => h.name.toLowerCase() === 'set-cookie').map((h) => h.value),
        location: res.headers().location ?? '',
      };
    }
  };
  const matcher = (url: URL) => url.href.startsWith(LAUNCH_URL);
  const handler = async (route: Route) => {
    const req = route.request();
    if (req.method() !== 'POST') return route.continue();
    const form = new URLSearchParams(req.postData() ?? '');
    cap.post = { id_token: form.get('id_token') ?? '', state: form.get('state') ?? '' };
    recordSecret('id_token', cap.post.id_token);
    recordSecret('state', cap.post.state);
    if (hold) return route.fulfill({ status: 200, contentType: 'text/html', body: '<p>QA holds this launch.</p>' });
    return route.continue();
  };
  const onRequest = (req: Request) => {
    if (!req.url().startsWith(LOGIN_URL) || cap.loginRequest) return;
    const fields = req.method() === 'POST' ? new URLSearchParams(req.postData() ?? '') : new URL(req.url()).searchParams;
    cap.loginRequest = Object.fromEntries(fields.entries());
  };
  context.on('request', onRequest);
  context.on('response', onResponse);
  await context.route(matcher, handler);
  try {
    const popupPromise = context.waitForEvent('page', { timeout: timeoutMs });
    cap.startedAt = Date.now();
    await page.goto(`${urls.moodle}/mod/lti/view.php?id=${cmid}`);
    let popup = await popupPromise.catch(() => null);
    if (!popup) {
      const second = context.waitForEvent('page', { timeout: timeoutMs });
      await page.locator('a[href*="/mod/lti/launch.php"]').first().click();
      popup = await second;
    }
    cap.popup = popup;
    if (hold) {
      const deadline = Date.now() + timeoutMs;
      while (!cap.post && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
      if (!cap.post) throw new Error(`no id_token POST to ${LAUNCH_URL} within ${timeoutMs} ms`);
    } else if (untilError) {
      const deadline = Date.now() + timeoutMs;
      while (!cap.errorPage && !cap.launchAt && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
      cap.finalUrl = popup.url();
    } else {
      await popup.waitForURL((u) => u.href.startsWith(`${urls.app}/tool/launch`), { timeout: timeoutMs, waitUntil: 'commit' });
      cap.msToFinal = Date.now() - cap.startedAt;
      cap.finalUrl = popup.url();
      cap.ltik = new URL(cap.finalUrl).searchParams.get('ltik');
      recordSecret('ltik', cap.ltik ?? undefined);
    }
  } finally {
    context.off('request', onRequest);
    context.off('response', onResponse);
    await context.unroute(matcher, handler);
    await page.close().catch(() => undefined);
  }
  return cap;
}

export interface FormPostResult {
  status: number;
  headers: Record<string, string>;
  body: string;
  location: string;
  traceId: string;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * POST a form as a real browser navigation from `page` (cookies of the context go with it, like Moodle's auto-submit
 * form). Returns the first response of that POST (no redirect is followed in the result).
 */
export async function postForm(page: Page, url: string, fields: Record<string, string>): Promise<FormPostResult> {
  const inputs = Object.entries(fields).map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('');
  await page.setContent(`<form id="qa" method="post" action="${esc(url)}">${inputs}</form>`);
  const responsePromise = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().startsWith(url), { timeout: 15_000 });
  await page.evaluate(() => (document.getElementById('qa') as HTMLFormElement).submit());
  const res = await responsePromise;
  const headers = await res.allHeaders();
  let body = '';
  try {
    body = await res.text();
  } catch {
    body = ''; // redirect responses have no body in Playwright
  }
  return { status: res.status(), headers, body, location: headers.location ?? '', traceId: headers['x-trace-id'] ?? '' };
}
