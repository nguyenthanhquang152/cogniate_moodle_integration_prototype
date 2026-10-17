// Moodle 5.2.4 UI helpers. Selectors come from Moodle core templates
// (lib/templates/loginform.mustache: form#login, #username, #password, #loginbtn, #loginerrormessage).
import type { Page } from '@playwright/test';

export async function moodleLogin(page: Page, moodleUrl: string, username: string, password: string): Promise<void> {
  await page.goto(`${moodleUrl}/login/index.php`);
  // A context that is already signed in gets "You are already logged in as …, Log out?" instead of the form.
  if ((await page.locator('#username').count()) === 0) {
    const logout = page.getByRole('button', { name: 'Log out' });
    if (await logout.count()) {
      await Promise.all([page.waitForLoadState('load'), logout.first().click()]);
      await page.goto(`${moodleUrl}/login/index.php`);
    }
  }
  // Moodle JS (core/togglesensitive) re-renders the password field after load. A value typed before
  // that is lost. So wait for the wrapper first (Lead hint, round 1).
  await page.locator('.toggle-sensitive-wrapper #password').waitFor({ state: 'visible' });
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
  /** cells: textContent, spaces collapsed. cellLines: innerText split into non-empty lines (keeps line breaks). */
  rows: { cells: string[]; cellLines: string[][]; links: string[] }[];
}

/**
 * All tables on the page, as text. Links are the hrefs inside each row.
 * Rows with no text are dropped: Moodle report tables add empty placeholder rows to fill the page.
 */
export async function readTables(page: Page): Promise<HtmlTable[]> {
  return page.evaluate(() => {
    const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
    return Array.from(document.querySelectorAll('table')).map((table) => {
      const headRow = table.querySelector('thead tr') ?? table.querySelector('tr');
      const headers = headRow ? Array.from(headRow.querySelectorAll('th')).map((th) => clean(th.textContent)) : [];
      const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
      const lines = (el: Element) =>
        ((el as HTMLElement).innerText ?? '').split('\n').map((l) => clean(l)).filter((l) => l !== '');
      return {
        headers,
        rows: bodyRows
          .map((tr) => {
            const cellEls = Array.from(tr.querySelectorAll('td, th'));
            return {
              cells: cellEls.map((td) => clean(td.textContent)),
              cellLines: cellEls.map(lines),
              links: Array.from(tr.querySelectorAll('a[href]')).map((a) => (a as HTMLAnchorElement).href),
            };
          })
          .filter((r) => r.cells.some((c) => c !== '')),
      };
    });
  });
}
