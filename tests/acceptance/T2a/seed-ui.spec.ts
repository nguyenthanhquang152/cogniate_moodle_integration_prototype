// T2a: second oracle for AC-T2-31 (seed.json has the right ids): the Moodle course page, as cg_teacher, links to the
// ltiSeed activities. Source: tasks/T2a.md AC-T2-31 and the dev seed scope (activities "Seed activity" in
// COGNIATE-DEV-101 and "Seed activity 102" in COGNIATE-DEV-102).
import { publicUrls } from '../lib/env';
import { ltiSeed } from '../lib/lti';
import { moodleLogin } from '../lib/moodle-ui';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';

const urls = publicUrls();

test('AC-T2-31 the course pages link to the ltiSeed activities ("Seed activity", "Seed activity 102")', async ({ page }) => {
  const s = ltiSeed();
  await moodleLogin(page, urls.moodle, seed().users.cg_teacher.username, seed().users.cg_teacher.password);
  for (const [shortname, name] of [['COGNIATE-DEV-101', 'Seed activity'], ['COGNIATE-DEV-102', 'Seed activity 102']] as const) {
    await page.goto(`${urls.moodle}/course/view.php?id=${seed().courses[shortname]}`);
    const link = page.locator(`a[href*="/mod/lti/view.php?id=${s.cmids[shortname]}"]`).first();
    await expect(link, `${shortname}: link to cmid ${s.cmids[shortname]}`).toBeVisible();
    await expect(link).toContainText(name);
    await page.screenshot({ path: test.info().outputPath(`${shortname}.png`), fullPage: true });
  }
});
