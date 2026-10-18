// Watches the real LTI flow in one browser context and records the protocol values that Scenario C needs:
// the id_token + state form that Moodle posts to the tool, the state cookie that the tool login set, the ltik in the
// 303 Location of the launch, and the Deep Linking response JWT that the picker posts back to Moodle.
// QA does not change the flow: the route only reads the form and continues the request.
// (Playwright routes see only the first request of a redirect chain; the id_token POST is a new form navigation, so a
// route sees it. Redirect responses are read from the "response" events.)
import type { BrowserContext, Request, Response, Route } from '@playwright/test';
import { recordSecret, urls } from './e2e';

export const ACCOUNT = 'cogniate';
export const LAUNCH_URL = `${urls.lti}/lti/launch/${ACCOUNT}`;
export const LOGIN_URL = `${urls.lti}/lti/login/${ACCOUNT}`;

export interface LaunchForm {
  id_token: string;
  state: string;
  at: number;
}

export interface Capture {
  forms: LaunchForm[];
  stateCookies: string[];
  ltiks: string[];
  launchStatuses: number[];
  stop: () => Promise<void>;
}

/** `name=value` of the tool's state cookies (from Set-Cookie headers), for a Cookie header. */
export function stateCookieHeader(setCookies: string[]): string {
  return setCookies
    .filter((c) => c.startsWith('__Host-lti_state_') && !/max-age=0/i.test(c))
    .map((c) => c.split(';')[0])
    .join('; ');
}

export async function captureLti(context: BrowserContext, where: string): Promise<Capture> {
  const cap: Capture = { forms: [], stateCookies: [], ltiks: [], launchStatuses: [], stop: async () => undefined };
  const matcher = (u: URL) => u.href.startsWith(LAUNCH_URL);
  const handler = async (route: Route) => {
    const req = route.request();
    if (req.method() === 'POST') {
      const form = new URLSearchParams(req.postData() ?? '');
      const f = { id_token: form.get('id_token') ?? '', state: form.get('state') ?? '', at: Date.now() };
      cap.forms.push(f);
      recordSecret('id_token', f.id_token, `${where}: launch POST`);
      recordSecret('state', f.state, `${where}: launch POST`);
    }
    return route.continue();
  };
  const onRequest = (req: Request) => {
    const u = req.url();
    if (req.method() === 'POST' && u.startsWith(`${urls.moodle}/mod/lti/contentitem_return.php`)) {
      const jwt = new URLSearchParams(req.postData() ?? '').get('JWT');
      recordSecret('id_token', jwt, `${where}: Deep Linking response JWT`);
    }
    if (req.method() === 'GET' && (u.startsWith(`${urls.app}/tool/launch`) || u.startsWith(`${urls.app}/tool/deep-link`))) {
      const ltik = new URL(u).searchParams.get('ltik');
      if (ltik && !cap.ltiks.includes(ltik)) cap.ltiks.push(ltik);
      recordSecret('ltik', ltik, `${where}: ${new URL(u).pathname}`);
    }
  };
  const onResponse = async (res: Response) => {
    const u = res.url();
    if (u.startsWith(LOGIN_URL) && res.status() >= 300 && res.status() < 400) {
      for (const h of await res.headersArray()) if (h.name.toLowerCase() === 'set-cookie') cap.stateCookies.push(h.value);
    }
    if (u.startsWith(LAUNCH_URL) && res.request().method() === 'POST') {
      cap.launchStatuses.push(res.status());
      const loc = res.headers().location ?? '';
      if (loc) {
        const ltik = new URL(loc, u).searchParams.get('ltik');
        if (ltik && !cap.ltiks.includes(ltik)) cap.ltiks.push(ltik);
        recordSecret('ltik', ltik, `${where}: launch 303 Location`);
      }
    }
  };
  await context.route(matcher, handler);
  context.on('request', onRequest);
  context.on('response', onResponse);
  cap.stop = async () => {
    context.off('request', onRequest);
    context.off('response', onResponse);
    await context.unroute(matcher, handler).catch(() => undefined);
  };
  return cap;
}
