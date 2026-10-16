// Moodle 5.2.4 UI helpers. Selectors come from Moodle core templates
// (lib/templates/loginform.mustache: form#login, #username, #password, #loginbtn, #loginerrormessage).
import type { Page } from '@playwright/test';

export async function moodleLogin(page: Page, moodleUrl: string, username: string, password: string): Promise<void> {
  await page.goto(`${moodleUrl}/login/index.php`);
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await Promise.all([page.waitForLoadState('load'), page.locator('#loginbtn').click()]);
}

/** The user menu has the logout link only for a signed-in user (user/lib.php). */
export async function isSignedIn(page: Page): Promise<boolean> {
  return (await page.locator('a[href*="/login/logout.php"]').count()) > 0;
}

export interface HtmlTable {
  headers: string[];
  rows: { cells: string[]; links: string[] }[];
}

/** All tables on the page, as text. Links are the hrefs inside each row. */
export async function readTables(page: Page): Promise<HtmlTable[]> {
  return page.evaluate(() => {
    const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
    return Array.from(document.querySelectorAll('table')).map((table) => {
      const headRow = table.querySelector('thead tr') ?? table.querySelector('tr');
      const headers = headRow ? Array.from(headRow.querySelectorAll('th')).map((th) => clean(th.textContent)) : [];
      const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
      return {
        headers,
        rows: bodyRows.map((tr) => ({
          cells: Array.from(tr.querySelectorAll('td, th')).map((td) => clean(td.textContent)),
          links: Array.from(tr.querySelectorAll('a[href]')).map((a) => (a as HTMLAnchorElement).href),
        })),
      };
    });
  });
}
