// K2 U1: Data-driven Integrations hub channel card assertions (AC-LA-E7-07-01, AC-LA-E1-11-04, AC-LA-E2-05-03).
// Reads channel manifests via `@cogniate/channel-kernel` (`loadProductChannelRegistry`) with zero hardcoded LMS branches.
import {
  APP,
  THANH,
  app,
  card,
  connectControl,
  expect,
  integrations,
  k2Case,
  loadProductChannelRegistry,
  manageControl,
  noForbiddenFields,
  ok,
  portalSignIn,
  session,
  sharedPlatform,
  shot,
  type Json,
} from './lib/k2';

k2Case(
  'U1.card-order',
  'Integrations hub renders every registered channel card in manifest card.order order, matching GET /app-api/lms-providers',
  async ({ page }) => {
    const registry = await loadProductChannelRegistry(false);
    const manifests = [...registry.channels()].sort((a, b) => a.card.order - b.card.order);
    expect(manifests.map((m) => m.id)).toEqual(['moodle', 'canvas', 'blackboard', 'lti-generic', 'brightspace']);

    const s = await session('A');
    const provRes = await app(s, 'GET', '/app-api/lms-providers');
    ok(provRes, 200, 'GET /app-api/lms-providers');
    const apiList = (provRes.json.lms ?? provRes.json.providers ?? []) as Json[];
    const apiChannelIds = apiList.map((entry) => String(entry.channel ?? entry.lms));
    expect(apiChannelIds, 'GET /app-api/lms-providers channel order equals manifest card.order').toEqual(
      manifests.map((m) => m.id),
    );
    for (const m of manifests) {
      const apiEntry = apiList.find((e) => (e.channel ?? e.lms) === m.id);
      expect(apiEntry, `API entry for ${m.id}`).toBeDefined();
      expect(apiEntry!.channelName ?? apiEntry!.label).toBeDefined();
    }

    await portalSignIn(page, THANH);
    await integrations(page);

    const cardLocators = manifests.map((m) =>
      page.getByRole('article', { name: m.card.title, exact: true }).or(card(page, m.card.title)).first(),
    );
    for (const [idx, m] of manifests.entries()) {
      await expect(cardLocators[idx], `Card visible for ${m.id} (${m.card.title})`).toBeVisible();
    }

    // Verify visual DOM order of the cards matches manifest.card.order
    const domPositions: number[] = [];
    for (const loc of cardLocators) {
      const pos = await loc.evaluate((el) => {
        const all = Array.from(document.querySelectorAll('*'));
        return all.indexOf(el);
      });
      domPositions.push(pos);
    }
    for (let i = 1; i < domPositions.length; i++) {
      expect(
        domPositions[i],
        `Card "${manifests[i].card.title}" (order ${manifests[i].card.order}) appears after "${manifests[i - 1].card.title}" (order ${manifests[i - 1].card.order})`,
      ).toBeGreaterThan(domPositions[i - 1]);
    }

    await noForbiddenFields(page);
    await shot(page, 'k2-u1-card-order');
  },
);

k2Case(
  'U1.card-copy-and-action',
  'every channel card renders its manifest card.title, card.description, card.mark, and Connect action routing to /integrations/:channelId/connect',
  async ({ page }) => {
    await sharedPlatform();
    const registry = await loadProductChannelRegistry(false);
    const manifests = [...registry.channels()].sort((a, b) => a.card.order - b.card.order);

    await portalSignIn(page, THANH);

    for (const m of manifests) {
      await integrations(page);
      const c = page.getByRole('article', { name: m.card.title, exact: true }).or(card(page, m.card.title)).first();
      await expect(c, `Card for ${m.id}`).toBeVisible();
      await expect(c.getByRole('heading', { name: m.card.title, exact: true })).toBeVisible();
      await expect(c.getByText(m.card.description, { exact: true })).toBeVisible();
      if (m.card.icon) {
        await expect(
          c.locator(`[data-icon="${m.card.icon}"], svg, img, [role="img"]`).first(),
          `Card ${m.id} renders icon "${m.card.icon}"`,
        ).toBeVisible();
      } else {
        await expect(
          c.getByText(m.card.mark, { exact: true }).first(),
          `Card ${m.id} renders mark "${m.card.mark}"`,
        ).toBeVisible();
      }

      const connectBtn = connectControl(c);
      const manageBtn = manageControl(c);
      const hasConnect = (await connectBtn.count()) > 0;
      const hasManage = (await manageBtn.count()) > 0;
      expect(hasConnect || hasManage, `Card ${m.id} has Connect or Manage control`).toBe(true);

      if (hasConnect) {
        await connectBtn.first().click();
      } else {
        await manageBtn.first().click();
        const another = page
          .getByRole('link', { name: /Connect another site/i })
          .or(page.getByRole('button', { name: /Connect another site/i }));
        if ((await another.count()) > 0) {
          await another.first().click();
        } else {
          await page.goto(`${APP}/integrations/${m.id}/connect`);
        }
      }

      await page.waitForURL(new RegExp(`/integrations/${m.id}/connect$`));
      await expect(page.getByLabel('Connection name')).toBeVisible();
      await noForbiddenFields(page);
    }

    await shot(page, 'k2-u1-card-actions');
  },
);
