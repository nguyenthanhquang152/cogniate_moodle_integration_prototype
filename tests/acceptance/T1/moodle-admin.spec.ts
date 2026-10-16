// T1 in-container browser: no duplicate web service tokens or services after repeated seeds.
// Source: T1.md AC-T1-12 (the host runner runs `npm run seed` again before this suite).
// Oracle (Moodle 5.2.4 core): Manage tokens = /admin/webservice/tokens.php (report with "User" link and "Service"
// columns); External services = /admin/settings.php?section=externalservices. No names are guessed: the token
// user comes from core_webservice_get_site_info, and the service name comes from that user's token row.
import { publicUrls } from '../lib/env';
import { callWs, type SiteInfo } from '../lib/moodle-ws';
import { type HtmlTable, moodleLogin, readTables } from '../lib/moodle-ui';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';

const urls = publicUrls();

function rowsOfUser(tables: HtmlTable[], userId: number) {
  const profile = new RegExp(`/user/(profile|view)\\.php\\?id=${userId}(&|$)`);
  return tables.flatMap((t) =>
    t.rows.filter((r) => r.links.some((href) => profile.test(href))).map((r) => ({ table: t, row: r })),
  );
}

test('AC-T1-12 one token per WS user and one external service each (product and QA oracle)', async ({ page }, testInfo) => {
  const s = seed();
  const product = await callWs<SiteInfo>(s.productToken, 'core_webservice_get_site_info');
  const oracle = await callWs<SiteInfo>(s.oracleToken, 'core_webservice_get_site_info');

  await moodleLogin(page, urls.moodle, s.users.admin.username, s.users.admin.password);
  await page.goto(`${urls.moodle}/admin/webservice/tokens.php`);
  await page.screenshot({ path: testInfo.outputPath('manage-tokens.png'), fullPage: true });
  const tokenTables = await readTables(page);

  const serviceNames: string[] = [];
  for (const user of [product, oracle]) {
    const rows = rowsOfUser(tokenTables, user.userid);
    expect(rows, `token rows for WS user id ${user.userid}`).toHaveLength(1);
    const { table, row } = rows[0];
    const col = table.headers.findIndex((h) => /^service$/i.test(h));
    expect(col, `"Service" column in ${table.headers.join(' | ')}`).toBeGreaterThanOrEqual(0);
    serviceNames.push(row.cells[col]);
  }
  expect(new Set(serviceNames).size, 'product and oracle tokens use different services').toBe(2);

  await page.goto(`${urls.moodle}/admin/settings.php?section=externalservices`);
  await page.screenshot({ path: testInfo.outputPath('external-services.png'), fullPage: true });
  const serviceTables = await readTables(page);
  for (const name of serviceNames) {
    const count = serviceTables.flatMap((t) => t.rows).filter((r) => r.cells.some((c) => c === name)).length;
    expect(count, `external service "${name}"`).toBe(1);
  }
});
