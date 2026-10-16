// Author smoke check for T2a (not a QA test). Run in the e2e container after seed + seed:lti-manual:
//   infra/scripts/e2e-run.sh node infra/e2e/lti-launch-smoke.mjs [cg_student] [--via=view|launch]
// A real Moodle launch of "Seed activity": Moodle -> /lti/login -> auth.php -> /lti/launch -> 303 -> app with ltik,
// then GET /api/idtoken with the cogniate API key. Prints a short JSON report (no secret values).
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const seed = JSON.parse(readFileSync('/repo/infra/.secrets/seed.json', 'utf8'));
const apiKey = readFileSync(`/repo/${seed.lti.apiKeyFiles.cogniate}`, 'utf8').trim();
const username = process.argv.find((a) => /^cg_/.test(a)) ?? 'cg_student';
const via = (process.argv.find((a) => a.startsWith('--via=')) ?? '--via=view').slice(6);
const { moodle, lti, app } = seed.urls;
const cmid = seed.ltiSeed.cmids['COGNIATE-DEV-101'];
const short = (v) => (typeof v === 'string' ? `${v.slice(0, 6)}…(${v.length})` : v);

const browser = await chromium.launch();
const report = { username, via };
try {
  const context = await browser.newContext();
  // Only *.test hosts (QA rule): block S3, Google and anything else.
  await context.route((url) => !/\.test$/.test(url.hostname), (route) => route.abort('blockedbyclient'));
  const page = await context.newPage();
  await page.goto(`${moodle}/login/index.php`);
  await page.locator('.toggle-sensitive-wrapper #password').waitFor({ timeout: 5000 }).catch(() => undefined);
  await page.fill('#username', username);
  await page.fill('#password', seed.moodle.users[username].password);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/login/'), { waitUntil: 'domcontentloaded' }), page.click('#loginbtn')]);

  const hops = [];
  context.on('response', async (res) => {
    const u = new URL(res.url());
    if (u.origin !== lti) return;
    const h = await res.allHeaders(); // headers() hides Set-Cookie
    const loc = h.location ? new URL(h.location) : null;
    hops.push({ method: res.request().method(), path: u.pathname, status: res.status(), location: loc ? `${loc.origin}${loc.pathname}` : undefined,
      setCookie: h['set-cookie']?.replace(/=[^;]*/, '=<value>'), referrerPolicy: h['referrer-policy'], cacheControl: h['cache-control'] });
  });
  const started = Date.now();
  let target = page;
  if (via === 'view') {
    // Moodle "New window": the view page opens the launch in a new window.
    await page.goto(`${moodle}/mod/lti/view.php?id=${cmid}`);
    const popupPromise = context.waitForEvent('page', { timeout: 10000 });
    const opener = page.locator('a[href*="launch.php"], button:has-text("Launch"), input[type="submit"]').first();
    if (await opener.count()) await opener.click({ timeout: 5000 }).catch(() => undefined);
    target = await popupPromise.catch(() => page);
  } else {
    await page.goto(`${moodle}/mod/lti/launch.php?id=${cmid}`);
  }
  await target.waitForURL((u) => u.href.startsWith(`${app}/tool/launch`), { timeout: 10000, waitUntil: 'commit' });
  const final = new URL(target.url());
  const ltik = final.searchParams.get('ltik');
  report.seconds = (Date.now() - started) / 1000;
  report.newWindow = target !== page;
  report.final = `${final.origin}${final.pathname}?resource=${final.searchParams.get('resource')}&ltik=${short(ltik)}`;
  report.hops = hops;

  const idtoken = await fetch(`${lti}/api/idtoken`, { headers: { authorization: `LTIK-AUTH-V2 ${apiKey}:${ltik}` } });
  const t = await idtoken.json();
  report.idtoken = {
    status: idtoken.status, user: t.user, platform: { url: t.platform?.url, clientId: t.platform?.clientId === seed.ltiSeed.clientId,
      deploymentId: t.platform?.deploymentId, productFamilyCode: t.platform?.productFamilyCode },
    launch: { type: t.launch?.type, target: t.launch?.target, contextId: t.launch?.context?.id, courseId101: seed.moodle.courses['COGNIATE-DEV-101'],
      resourceLinkId: t.launch?.resourceLink?.id, documentTarget: t.launch?.presentation?.documentTarget, document_target: t.launch?.presentation?.document_target },
    services: t.services,
  };
  report.userIdIsSeedId = t.user?.id === String(seed.moodle.users[username].id);
  const raw = await (await fetch(`${lti}/api/idtoken?raw=true`, { headers: { authorization: `LTIK-AUTH-V2 ${apiKey}:${ltik}` } })).json();
  report.rawKeys = ['iss', 'aud', 'sub', 'https://purl.imsglobal.org/spec/lti/claim/message_type', 'https://purl.imsglobal.org/spec/lti/claim/deployment_id'].filter((k) => k in raw);
  const second = readFileSync(`/repo/${seed.lti.apiKeyFiles['qa-second']}`, 'utf8').trim();
  report.otherAccountKey = (await fetch(`${lti}/api/idtoken`, { headers: { authorization: `LTIK-AUTH-V2 ${second}:${ltik}` } })).status;
  report.ltikForLogScan = ltik; // used by the caller to scan the logs; not printed
} finally {
  await browser.close();
}
const { ltikForLogScan, ...printable } = report;
console.log(JSON.stringify(printable, null, 1));
if (process.env.QA_SMOKE_LTIK_OUT) console.error(`LTIK=${ltikForLogScan}`);
