// T6: sign-in, the Integrations page and its look, no outside requests, signed-out redirects. Source: tasks/T6.md
// AC-T6-01, -02, -03, -10; look: docs/research/ui/dev-portal-integrations.png.
import fs from 'node:fs';
import path from 'node:path';
import { APP, appApi, signIn, THANH } from '../lib/app';
import { loadState } from '../lib/lti';
import { REPO_ROOT } from '../lib/paths';
import { cardGrid, near, PORTAL_ROUTES, portalSignIn, recordRequests, rgb } from '../lib/portal';
import { expect, test } from '../lib/pw';
import { t5 } from '../lib/t5';

const MOODLE_CARD_TEXT = 'Export SCORM packages and sync course content with your Moodle LMS.';
const PILLS = ['All', 'LMS Publishing', 'LLM/AI', 'Creative', 'Knowledge'];

test('AC-T6-01 Thanh → Integrations: title, subtitle, five pills, ≥ 9 cards in 3 columns at 1440 px; the Moodle card text; the card state matches GET /app-api/connections (no connection: enabled "Connect"; else the badge of the newest, "Manage", "Connect another site", no "Connect")', async ({ page }) => {
  await portalSignIn(page, THANH);
  await page.goto(`${APP}${PORTAL_ROUTES.integrations}`);
  await expect(page.getByRole('heading', { name: 'Integrations', exact: true })).toBeVisible();
  await expect(page.getByText('Connect your favorite tools to your course library.', { exact: true })).toBeVisible();
  for (const pill of PILLS) await expect(page.getByText(pill, { exact: true }).first(), `pill ${pill}`).toBeVisible();
  expect(page.viewportSize()?.width).toBe(1440);
  const grid = await cardGrid(page, MOODLE_CARD_TEXT);
  expect(grid, 'the Moodle card is in a card grid').not.toBeNull();
  expect(grid!.count, `cards: ${grid!.cardTexts.join(' | ')}`).toBeGreaterThanOrEqual(9);
  expect(grid!.columns, 'columns in the first row').toBe(3);

  const thanh = await signIn(THANH);
  const list = await appApi<{ connections: { id: string; name: string; status: string; createdAt: string; registrationUrlExpiresAt?: string | null }[] }>('GET', '/app-api/connections', { cookie: thanh.cookie });
  expect(list.status).toBe(200);
  const conns = [...(list.json?.connections ?? [])].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  // The smallest element that holds the card text and a Manage/Connect control.
  const control = page.getByRole('button', { name: /^(Connect|Manage)$/ }).or(page.getByRole('link', { name: /^(Connect|Manage)$/ }));
  const card = page.locator('div, article, section, li', { hasText: MOODLE_CARD_TEXT }).filter({ has: control }).last();
  await expect(card, 'the Moodle card').toBeVisible();
  const exactConnect = card.getByRole('button', { name: 'Connect', exact: true }).or(card.getByRole('link', { name: 'Connect', exact: true }));
  if (conns.length === 0) {
    await expect(exactConnect.first(), 'no connection: "Connect"').toBeVisible();
    await expect(exactConnect.first()).toBeEnabled();
    return;
  }
  const newest = conns[0];
  await expect(card.getByRole('button', { name: 'Manage', exact: true }).or(card.getByRole('link', { name: 'Manage', exact: true })).first(), '"Manage"').toBeVisible();
  await expect(card.getByText('Connect another site', { exact: true }).first(), '"Connect another site"').toBeVisible();
  expect(await exactConnect.count(), 'with a connection: no "Connect"').toBe(0);
  const expired = newest.status === 'pending' && newest.registrationUrlExpiresAt && Date.parse(newest.registrationUrlExpiresAt) < Date.now();
  const label =
    newest.status === 'registered'
      ? 'Registered — activate in Moodle'
      : newest.status === 'connected'
        ? 'Connected'
        : newest.status === 'disabled'
          ? 'Disconnected'
          : newest.status === 'pending'
            ? expired
              ? 'Link expired'
              : 'Waiting for Moodle'
            : null;
  const cardText = (await card.innerText()).replace(/\s+/g, ' ');
  test.info().annotations.push({ type: 'card state', description: `${conns.length} connections; newest "${newest.name}" status ${newest.status}; card text: ${cardText.slice(0, 300)}` });
  if (label) await expect(card.getByText(label, { exact: true }).first(), `badge of the newest connection (${newest.status})`).toBeVisible();
  else throw new Error(`unknown connection status ${newest.status}`);
});

test('AC-T6-02 look: body background rgb(11,10,15), active pill rgb(166,103,228), DM Sans, cards 12 px radius; screenshot next to the reference', async ({ page }) => {
  await portalSignIn(page, THANH);
  await page.goto(`${APP}${PORTAL_ROUTES.integrations}`);
  await page.getByText(MOODLE_CARD_TEXT).waitFor();
  const look = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    const all = Array.from(document.querySelectorAll('body *')) as HTMLElement[];
    const pillText = all.find((el) => el.children.length === 0 && (el.textContent ?? '').trim() === 'All');
    const pill = (pillText?.closest('button, [role="tab"], a, [role="button"]') as HTMLElement | null) ?? pillText ?? null;
    let pillBg = pill ? getComputedStyle(pill).backgroundColor : '';
    // The colour may sit on the element or on the first ancestor with a background.
    for (let el: HTMLElement | null = pill; el && /rgba\(0, 0, 0, 0\)|transparent/.test(pillBg); el = el.parentElement) pillBg = getComputedStyle(el).backgroundColor;
    return { bodyBg: body.backgroundColor, font: body.fontFamily, pillBg };
  });
  expect(near(rgb(look.bodyBg), [11, 10, 15]), `body background ${look.bodyBg}`).toBe(true);
  expect(near(rgb(look.pillBg), [166, 103, 228]), `active pill background ${look.pillBg}`).toBe(true);
  expect(look.font.replace(/["']/g, '').startsWith('DM Sans'), `font-family ${look.font}`).toBe(true);
  const grid = await cardGrid(page, MOODLE_CARD_TEXT);
  expect(grid?.radius, 'card border-radius').toBe('12px');
  const shot = test.info().outputPath('integrations-1440.png');
  await page.screenshot({ path: shot, fullPage: true });
  await test.info().attach('portal integrations (QA)', { path: shot, contentType: 'image/png' });
  const reference = path.join(REPO_ROOT, 'docs', 'research', 'ui', 'dev-portal-integrations.png');
  if (fs.existsSync(reference)) await test.info().attach('dev portal reference', { path: reference, contentType: 'image/png' });
});

test('AC-T6-03 no request leaves PUBLIC_APP_URL while the portal loads (sign-in and Integrations)', async ({ page }) => {
  const urls = recordRequests(page);
  await portalSignIn(page, THANH);
  await page.goto(`${APP}${PORTAL_ROUTES.integrations}`);
  await page.waitForLoadState('networkidle');
  const outside = urls.filter((u) => !/^(data|blob):/.test(u) && new URL(u).origin !== APP);
  expect(outside, `requests: ${urls.length}`).toEqual([]);
});

test('AC-T6-10 signed out: every route redirects to /signin; "Logout" clears the session (GET /app-api/me → 401)', async ({ browser }) => {
  const st = t5();
  const t6 = loadState('T6') as { pendingConnectionId?: string };
  const routes = [
    PORTAL_ROUTES.integrations,
    PORTAL_ROUTES.connect,
    PORTAL_ROUTES.connection(String(t6.pendingConnectionId ?? st.connectionId)),
    PORTAL_ROUTES.courses,
    PORTAL_ROUTES.course(String(st.scorm?.courseId)),
    PORTAL_ROUTES.publish(String(st.scorm?.courseId)),
    PORTAL_ROUTES.results(String(st.scormPublicationId)),
  ];
  const context = await browser.newContext({ ignoreHTTPSErrors: process.env.QA_IGNORE_HTTPS_ERRORS === '1' });
  try {
    const page = await context.newPage();
    const problems: string[] = [];
    for (const r of routes) {
      await page.goto(`${APP}${r}`);
      await page.waitForURL((u) => u.pathname.startsWith(PORTAL_ROUTES.signin), { timeout: 10_000 }).catch(() => undefined);
      if (!new URL(page.url()).pathname.startsWith(PORTAL_ROUTES.signin)) problems.push(`${r} → ${page.url()}`);
    }
    expect(problems).toEqual([]);

    await portalSignIn(page, THANH);
    expect((await page.request.get(`${APP}/app-api/me`)).status(), 'signed in').toBe(200);
    await page.getByRole('button', { name: /log ?out/i }).or(page.getByRole('link', { name: /log ?out/i })).first().click();
    await page.waitForURL((u) => u.pathname.startsWith(PORTAL_ROUTES.signin), { timeout: 10_000 }).catch(() => undefined);
    expect((await page.request.get(`${APP}/app-api/me`)).status(), 'after Logout').toBe(401);
  } finally {
    await context.close();
  }
});
