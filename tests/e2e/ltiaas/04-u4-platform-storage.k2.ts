// K2 U4: 3P-cookie-blocked Chromium platform storage (`lti.put_data` / `lti.get_data`) positive and negative flows
// (AC-LA-E7-07-04, AC-LA-E7-07-05, AC-LA-E3-02-08, AC-LA-E3-02-09).
// Uses `installStateCookieStripper(context)` to strip `__Host-lti_state_*` from `POST /lti/launch/cogniate`
// while leaving `/lti/launch/cogniate/storage-check` and all other cookies untouched (LA-E7-07 Design notes).
import {
  APP,
  CANVAS_SSO_ORIGIN,
  CLOUD,
  canvasBinding,
  check,
  embeddedPath,
  expect,
  installStateCookieStripper,
  k2Case,
  playPath,
  publicationFor,
  scenario,
  shot,
  sim,
  unique,
  urls,
  waitForFrame,
  type Json,
} from './lib/k2';

const STORAGE_HELP_TEXT =
  'Your browser blocked the Cogniate sign-in in this frame. Open the activity in a new window, or allow cookies for this site.';

k2Case(
  'U4.platform-storage.positive',
  'framed Canvas Cloud launch with __Host-lti_state_* stripped from POST /lti/launch/cogniate recovers state via lti.put_data and lti.get_data on https://sso.canvas.sim.test and opens the player',
  async ({ page, context }) => {
    const b = await canvasBinding('A');
    const pub = await publicationFor(b, 'html');
    const { strippedUrls, removedCookies } = await installStateCookieStripper(context);

    const statusByPath: Record<string, number[]> = {
      login: [],
      launch: [],
      storageCheck: [],
    };
    page.on('response', (res) => {
      try {
        const u = new URL(res.url());
        if (u.origin !== new URL(urls.lti).origin) return;
        if (u.pathname === '/lti/login/cogniate') statusByPath.login.push(res.status());
        else if (u.pathname === '/lti/launch/cogniate') statusByPath.launch.push(res.status());
        else if (u.pathname === '/lti/launch/cogniate/storage-check') statusByPath.storageCheck.push(res.status());
      } catch {
        // ignore non-URL responses
      }
    });

    const cursorBefore = Number((await sim('/records?since=0')).json?.cursor ?? 0);
    const sc = await scenario(b, {
      resource: pub.id,
      resourceLinkId: unique('rl-u4-pos'),
      storageTarget: 'post_message_forwarding',
    });

    const frameUrl = `${CLOUD.siteA}/__frame?url=${encodeURIComponent(sc.loginUrl)}`;
    await page.goto(frameUrl);

    const toolFrame = await waitForFrame(
      page,
      (u) => u.origin === APP && (embeddedPath.test(u.pathname) || playPath.test(u.pathname)),
      10_000,
    );
    await expect(toolFrame.getByText('Open in a new window').first()).toBeVisible({ timeout: 15_000 });

    // Verify the route rule stripped the __Host-lti_state_* cookie from POST /lti/launch/cogniate
    expect(strippedUrls.length, 'Route rule intercepted POST /lti/launch/cogniate').toBeGreaterThan(0);
    expect(removedCookies.length, 'Route rule stripped __Host-lti_state_* cookie').toBeGreaterThan(0);
    expect(removedCookies[0]).toMatch(/^__Host-lti_state_[0-9a-f]{8}$/);

    // Verify protocol responses: 200 login page -> 200 storage-check page -> 303 storage-check redemption
    expect(statusByPath.login).toContain(200);
    expect(statusByPath.launch).toContain(200);
    expect(statusByPath.storageCheck).toContain(303);

    // Verify simulator recorded both lti.put_data and lti.get_data on https://sso.canvas.sim.test
    const records = ((await sim(`/records?since=${cursorBefore}`)).json?.records ?? []) as Json[];
    const putRec = records.find(
      (r) => r.kind === 'storage' && r.op === 'lti.put_data' && r.host === 'sso.canvas.sim.test',
    );
    const getRec = records.find(
      (r) => r.kind === 'storage' && r.op === 'lti.get_data' && r.host === 'sso.canvas.sim.test',
    );
    expect(putRec, 'lti.put_data recorded on sso.canvas.sim.test').toBeDefined();
    expect(getRec, 'lti.get_data recorded on sso.canvas.sim.test').toBeDefined();
    expect(String(putRec!.key)).toMatch(/^cog_state_[0-9a-f]$/);
    expect(getRec!.key).toBe(putRec!.key);
    expect(getRec!.hit).toBe(true);
    expect(putRec!.origin).toBe(new URL(urls.lti).origin);
    expect(getRec!.origin).toBe(new URL(urls.lti).origin);

    // Verify clicking "Open in a new window" opens the top-level player with the runtime frame
    const openLink = toolFrame.getByRole('link', { name: 'Open in a new window' }).first();
    const playHref = await openLink.getAttribute('href');
    check(playHref, 'Embedded player frame has Open in a new window href');
    const playerPage = await context.newPage();
    try {
      await playerPage.goto(new URL(playHref!, APP).href);
      await playerPage.waitForURL((u) => u.origin === APP && playPath.test(u.pathname), { timeout: 30_000 });
      await waitForFrame(playerPage, (u) => u.origin === urls.content && u.pathname.startsWith('/rt/'));
    } finally {
      await playerPage.close();
    }

    await shot(page, 'k2-u4-platform-storage-positive');
  },
);

k2Case(
  'U4.platform-storage.negative',
  'in the same cookie-stripped framed Canvas Cloud launch, lti.get_data.response from another origin or with another message_id is ignored and the frame shows STATE_COOKIE_MISSING after 1.5 s',
  async ({ page, context }) => {
    const b = await canvasBinding('A');
    const pub = await publicationFor(b, 'html');
    const { strippedUrls, removedCookies } = await installStateCookieStripper(context);

    let capturedStateValue = '';
    let wrongMessageIdSent = false;
    let wrongOriginSent = false;

    // Intercept POST https://sso.canvas.sim.test/__storage to capture put_data and tamper with get_data
    await context.route(`${CANVAS_SSO_ORIGIN}/__storage`, async (route, request) => {
      if (request.method() !== 'POST') {
        await route.continue();
        return;
      }
      const body = JSON.parse(request.postData() ?? '{}') as {
        subject?: string;
        message_id?: string;
        key?: string;
        value?: string;
      };
      if (body.subject === 'lti.put_data' && typeof body.value === 'string') {
        capturedStateValue = body.value;
        await route.continue();
        return;
      }
      if (body.subject === 'lti.get_data' && typeof body.message_id === 'string') {
        const senderOrigin = request.headers()['x-storage-origin'] ?? new URL(urls.lti).origin;
        const realMessageId = body.message_id;

        // 1. Send a spoofed response with the EXACT message_id and value from ANOTHER origin (school-a.canvas.sim.test)
        await page
          .evaluate(
            ({ msgId, val }) => {
              const frames = Array.from(document.querySelectorAll('iframe'));
              for (const iframe of frames) {
                try {
                  iframe.contentWindow?.postMessage(
                    { subject: 'lti.get_data.response', message_id: msgId, value: val },
                    '*',
                  );
                } catch {
                  // ignore
                }
              }
            },
            { msgId: realMessageId, val: capturedStateValue },
          )
          .then(() => {
            wrongOriginSent = true;
          })
          .catch(() => undefined);

        // 2. Return a response from the REAL origin (sso.canvas.sim.test) with a WRONG message_id
        wrongMessageIdSent = true;
        const wrongResponse = {
          subject: 'lti.get_data.response',
          message_id: `${realMessageId}-wrong-id`,
          value: capturedStateValue,
        };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            targetOrigin: senderOrigin,
            response: wrongResponse,
            ...wrongResponse,
          }),
        });
        return;
      }
      await route.continue();
    });

    const sc = await scenario(b, {
      resource: pub.id,
      resourceLinkId: unique('rl-u4-neg'),
      storageTarget: 'post_message_forwarding',
    });

    const t0 = Date.now();
    const frameUrl = `${CLOUD.siteA}/__frame?url=${encodeURIComponent(sc.loginUrl)}`;
    await page.goto(frameUrl);

    const errorFrame = await waitForFrame(
      page,
      (u) => u.origin === new URL(urls.lti).origin && u.pathname === '/lti/launch/cogniate/storage-check',
      30_000,
    );
    await expect(errorFrame.locator('[data-error-code="STATE_COOKIE_MISSING"]')).toBeVisible({ timeout: 15_000 });
    const elapsedMs = Date.now() - t0;

    // Verify the storage-check page waited at least ~1.4 s before submitting the empty fallback
    expect(elapsedMs, 'Storage-check page waited ~1.5 s before timing out').toBeGreaterThanOrEqual(1400);
    expect(strippedUrls.length, 'Route rule stripped cookie on POST /lti/launch/cogniate').toBeGreaterThan(0);
    expect(removedCookies.length).toBeGreaterThan(0);
    expect(wrongOriginSent, 'Wrong-origin postMessage was dispatched').toBe(true);
    expect(wrongMessageIdSent, 'Wrong-message_id response from sso.canvas.sim.test was dispatched').toBe(true);

    const frameText = (await errorFrame.locator('body').innerText()).replace(/\s+/g, ' ');
    expect(frameText).toContain('STATE_COOKIE_MISSING');
    expect(frameText).toContain(STORAGE_HELP_TEXT);

    await shot(page, 'k2-u4-platform-storage-negative');
  },
);
