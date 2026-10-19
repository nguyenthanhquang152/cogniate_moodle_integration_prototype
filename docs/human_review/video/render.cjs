// Renders every slide of script.json to a 1280x720 PNG (runs in the Playwright 1.56.0 image, see build.sh).
// Usage: node render.cjs <lang> <outDir>
const fs = require('fs');
const path = require('path');
const { chromium } = require('/repo/node_modules/playwright-core');

(async () => {
  const [lang, outDir] = process.argv.slice(2);
  const script = JSON.parse(fs.readFileSync('/repo/docs/human_review/video/script.json', 'utf8'));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, offline: true });
  await ctx.addInitScript((data) => { window.SCRIPT = data; }, script);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { console.error('page error:', String(e)); process.exitCode = 1; });
  for (let i = 0; i < script.slides.length; i++) {
    await page.goto(`file:///repo/docs/human_review/video/slides.html?i=${i}&lang=${lang}`);
    await page.waitForFunction(() => window.READY === true, null, { timeout: 10000 });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(outDir, `slide-${String(i + 1).padStart(2, '0')}.png`) });
  }
  await browser.close();
  console.log(`rendered ${script.slides.length} slides (${lang})`);
})().catch((e) => { console.error(e); process.exit(1); });
