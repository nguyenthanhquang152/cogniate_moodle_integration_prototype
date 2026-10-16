// T1 in-container browser: no duplicate web service tokens or services after repeated seeds.
// Source: T1.md AC-T1-12 (the host runner runs `npm run seed` again before this suite).
// Oracle (Moodle 5.2.4 core): Manage tokens = /admin/webservice/tokens.php (report with a "User" link and a
// "Service" column); External services = /admin/settings.php?section=externalservices.
// No names are guessed, and the QA oracle token is not used here (its service has no get_site_info, H4):
// the product token user comes from core_webservice_get_site_info; services come from the token rows.
import { publicUrls } from '../lib/env';
import { callWs, type SiteInfo } from '../lib/moodle-ws';
import { moodleLogin, readTables } from '../lib/moodle-ui';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';

const urls = publicUrls();

function userIdOf(links: string[]): number | null {
  for (const href of links) {
    const m = /\/user\/(?:profile|view)\.php\?id=(\d+)/.exec(href);
    if (m) return Number(m[1]);
  }
  return null;
}

test('AC-T1-12 no duplicate WS tokens (user + service) and each external service exists once', async ({ page }, testInfo) => {
  const s = seed();
  const product = await callWs<SiteInfo>(s.productToken, 'core_webservice_get_site_info');

  await moodleLogin(page, urls.moodle, s.users.admin.username, s.users.admin.password);
  await page.goto(`${urls.moodle}/admin/webservice/tokens.php`);
  await page.screenshot({ path: testInfo.outputPath('manage-tokens.png'), fullPage: true });
  const tokenTable = (await readTables(page)).find((t) => t.headers.some((h) => /service/i.test(h)));
  expect(tokenTable, 'Manage tokens table with a "Service" column').toBeDefined();
  const serviceCol = tokenTable!.headers.findIndex((h) => /service/i.test(h));

  // The Service cell shows the service name, then its shortname on a second line.
  const rows = tokenTable!.rows.map((r) => ({ userId: userIdOf(r.links), service: r.cellLines[serviceCol]?.[0] ?? '' }));
  testInfo.annotations.push({ type: 'token rows', description: rows.map((r) => `user ${r.userId} / ${r.service}`).join('; ') });
  expect(rows.every((r) => r.userId !== null && r.service !== ''), 'every token row has a user link and a service').toBe(true);

  const pairs = rows.map((r) => `${r.userId}|${r.service}`);
  expect(new Set(pairs).size, `duplicate (user, service) token rows: ${pairs.join(', ')}`).toBe(pairs.length);
  expect(rows.filter((r) => r.userId === product.userid), 'token rows of the product WS user').toHaveLength(1);
  const services = [...new Set(rows.map((r) => r.service))];
  expect(services.length, 'product and QA oracle services have tokens').toBeGreaterThanOrEqual(2);

  await page.goto(`${urls.moodle}/admin/settings.php?section=externalservices`);
  await page.screenshot({ path: testInfo.outputPath('external-services.png'), fullPage: true });
  // Moodle 5.2.4 adminlib.php admin_setting_manageexternalservices: the first cell is the service name.
  const serviceRows = (await readTables(page)).flatMap((t) => t.rows);
  for (const name of services) {
    const count = serviceRows.filter((r) => r.cells[0] === name).length;
    expect(count, `external service "${name}"`).toBe(1);
  }
});
