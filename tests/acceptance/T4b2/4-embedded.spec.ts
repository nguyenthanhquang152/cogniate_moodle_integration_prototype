// T4b2: embedded and existing-window launches. Source: tasks/T4b2.md AC-T4-31; security §4 (embedded launch);
// contract cogniate-app-api.md §6 (/play/{playId}/embedded). Moodle 5.2.4 launch containers: 3 = "Embed, without
// blocks", 4 = "New window", 5 = "Existing window" (spike §5a).
import { APP } from '../lib/app';
import { publicUrls } from '../lib/env';
import { saveState } from '../lib/lti';
import { newStackContext } from '../lib/moodle-launch';
import { moodleLogin } from '../lib/moodle-ui';
import { openManageTools, setToolOptions } from '../lib/moodle-reg';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';
import { t4b } from '../lib/t4b-state';

const urls = publicUrls();

test('AC-T4-31 "Embed, without blocks" shows /play/<id>/embedded with "Open in a new window"; "Existing window" opens the player directly', async ({ browser }) => {
  test.setTimeout(240_000);
  const st = t4b();
  const admin = await newStackContext(browser);
  const adminPage = await admin.newPage();
  await openManageTools(adminPage, seed().users.admin);
  try {
    // 1. Embed, without blocks → documentTarget iframe → the embedded page in Moodle's frame.
    await setToolOptions(adminPage, st.thanhTypeId!, { launchcontainer: '3' });
    const learner = await newStackContext(browser);
    try {
      const page = await learner.newPage();
      await moodleLogin(page, urls.moodle, seed().users.cg_student.username, seed().users.cg_student.password);
      let embeddedHeaders: Record<string, string> | undefined;
      learner.on('response', async (r) => {
        if (!embeddedHeaders && /\/play\/[^/]+\/embedded/.test(r.url()) && r.request().method() === 'GET') embeddedHeaders = await r.allHeaders();
      });
      await page.goto(`${urls.moodle}/mod/lti/view.php?id=${st.scormActivityCmid}`);
      let frame = page.frames().find((f) => /\/play\/[^/]+\/embedded/.test(f.url()));
      for (let i = 0; !frame && i < 120; i++) {
        await page.waitForTimeout(250);
        frame = page.frames().find((f) => /\/play\/[^/]+\/embedded/.test(f.url()));
      }
      expect(frame, 'Moodle\'s frame shows /play/<id>/embedded').toBeDefined();
      await frame!.waitForLoadState('load');
      const button = frame!.getByRole('link', { name: 'Open in a new window' }).or(frame!.getByRole('button', { name: 'Open in a new window' }));
      await expect(button).toBeVisible();
      await page.screenshot({ path: test.info().outputPath('embedded.png') });
      const popupPromise = learner.waitForEvent('page');
      await button.click();
      const popup = await popupPromise;
      await popup.waitForLoadState('load');
      expect(popup.url()).toMatch(new RegExp(`^${APP.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/play/[^/?#]+$`));
      expect((await popup.locator('body').innerText()).replace(/\s+/g, ' '), 'the player works').toContain('Back to Moodle');
      saveState('T4b', { embeddedHeaders: embeddedHeaders ?? {} });

      // 2. Existing window → documentTarget frame → the player opens directly (no embedded page).
      await setToolOptions(adminPage, st.thanhTypeId!, { launchcontainer: '5' });
      const top = await learner.newPage();
      await top.goto(`${urls.moodle}/mod/lti/view.php?id=${st.scormActivityCmid}`);
      await top.waitForURL((u) => u.href.startsWith(`${APP}/play/`), { timeout: 30_000 });
      expect(top.url(), 'no embedded page').not.toMatch(/\/embedded/);
    } finally {
      await learner.close();
    }
  } finally {
    await setToolOptions(adminPage, st.thanhTypeId!, { launchcontainer: '4' });
    await admin.close();
  }
});
