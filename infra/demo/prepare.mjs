// T7 demo:prepare steps that talk HTTPS to the stack (run in the e2e container by infra/scripts/demo-prepare.sh,
// which does the Moodle CLI steps in between). Each step prints ONE JSON line on stdout.
//   connect                     Thanh's dynamic connection "Dev Moodle" -> {connectionId, registrationUrl}
//   register -                  (URL on stdin) the tool side of the registration: GET the URL that Moodle would open (LTI service
//                               -> app confirm page), then "Connect" (POST /tool/register) -> {clientId, platformId}
//   publish <connectionId>      upload both zips and publish them -> {scorm: {courseId, publicationId}, html: {...}}
//   verify <cmid> <cmid>        cg_teacher opens both activities (preview: no learner data) -> {ok, finalUrls}
import { readFileSync } from 'node:fs';

const seed = JSON.parse(readFileSync('/repo/infra/.secrets/seed.json', 'utf8'));
const { app, moodle } = seed.urls;
const [step, ...args] = process.argv.slice(2);
const out = (v) => process.stdout.write(`${JSON.stringify(v)}\n`);
const fail = (msg) => { process.stderr.write(`demo:prepare: ${msg}\n`); process.exit(1); };

async function portal() {
  const u = seed.portal.users['thanh@cogniate.test'];
  const r = await fetch(`${app}/app-api/session`, { method: 'POST', headers: { origin: app, 'content-type': 'application/json' }, body: JSON.stringify({ email: u.email, password: u.password }) });
  if (r.status !== 204) fail(`portal login failed (${r.status})`);
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const api = async (method, path, body) => {
    const res = await fetch(`${app}/app-api${path}`, { method, headers: { cookie, origin: app, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const json = await res.json().catch(() => ({}));
    if (res.status >= 400) fail(`${method} ${path} -> ${res.status} ${json?.details?.message ?? ''}`);
    return json;
  };
  return { cookie, api };
}

if (step === 'connect') {
  const { api } = await portal();
  const existing = (await api('GET', '/connections')).connections.find((x) => x.name === 'Dev Moodle' && x.status !== 'disabled');
  if (existing) fail('Thanh already has the connection "Dev Moodle". For a fresh demo run: npm run e2e:reset (then npm run demo:prepare).');
  const c = await api('POST', '/connections', { name: 'Dev Moodle', siteUrl: moodle, method: 'dynamic' });
  out({ connectionId: c.id, registrationUrl: c.registrationUrl });
} else if (step === 'register') {
  // The URL holds the registration token: "-" reads it from stdin (never on a command line).
  if (args[0] === '-') args[0] = readFileSync(0, 'utf8').trim();
  // 1. Moodle would open this URL in its registration frame: the LTI service reads the configuration and sends the
  //    browser to the app confirm page (redirect: the Location holds registrationId and ref).
  const r1 = await fetch(args[0], { redirect: 'manual' });
  const confirm = r1.headers.get('location');
  if (r1.status < 300 || r1.status >= 400 || !confirm) fail(`the LTI service did not start the registration (${r1.status}): ${(await r1.text()).slice(0, 300)}`);
  const page = await fetch(confirm);
  const html = await page.text();
  if (page.status !== 200 || !html.includes('Learners are anonymous')) fail(`no confirm page (${page.status})`);
  const q = new URL(confirm, app).searchParams;
  // 2. "Connect" on the confirm page (a real form POST from the app origin).
  const done = await fetch(`${app}/tool/register`, { method: 'POST', headers: { origin: app, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ registrationId: q.get('registrationId'), ref: q.get('ref') }).toString() });
  if (done.status !== 200) fail(`Connect failed (${done.status}): ${(await done.text()).replace(/<[^>]+>/g, ' ').slice(0, 300)}`);
  const { api } = await portal();
  const c = (await api('GET', '/connections')).connections.find((x) => x.name === 'Dev Moodle' && x.status === 'registered');
  if (!c) fail('the connection is not registered');
  out({ connectionId: c.id, platformId: c.platform.id, clientId: c.platform.clientId });
} else if (step === 'publish') {
  const { cookie, api } = await portal();
  const upload = async (title, zip) => {
    const course = await api('POST', '/courses', { title });
    const form = new FormData();
    form.append('package', new Blob([readFileSync(zip)]), 'package.zip');
    const r = await fetch(`${app}/app-api/courses/${course.id}/versions`, { method: 'POST', headers: { cookie, origin: app }, body: form });
    if (r.status !== 201) fail(`upload of ${title} -> ${r.status} ${(await r.text()).slice(0, 300)}`);
    const pub = await api('POST', '/publications', { connectionId: args[0], courseId: course.id });
    return { courseId: course.id, publicationId: pub.id };
  };
  out({ scorm: await upload('AI Website Sprint — SCORM', '/repo/.tmp/demo/zips/scorm.zip'), html: await upload('AI Website Sprint — HTML', '/repo/.tmp/demo/zips/html.zip') });
} else if (step === 'verify') {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  const context = await browser.newContext();
  await context.route((url) => !/\.test$/.test(url.hostname), (route) => route.abort('blockedbyclient'));
  const page = await context.newPage();
  await page.goto(`${moodle}/login/index.php`, { waitUntil: 'domcontentloaded' });
  await page.fill('#username', 'cg_teacher');
  await page.fill('#password', seed.moodle.users.cg_teacher.password);
  await Promise.all([page.waitForURL((x) => !x.pathname.startsWith('/login/'), { waitUntil: 'domcontentloaded' }), page.click('#loginbtn')]);
  const finalUrls = [];
  for (const cmid of args) {
    await page.goto(`${moodle}/mod/lti/launch.php?id=${cmid}`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL((x) => x.origin === app && x.pathname.startsWith('/play/'), { timeout: 30000, waitUntil: 'domcontentloaded' });
    finalUrls.push(page.url().replace(/ply_[^/]+/, 'ply_…'));
  }
  await browser.close();
  out({ ok: finalUrls.every((u) => !u.includes('ltik')), finalUrls });
} else {
  fail(`unknown step "${step}" (connect | register <url> | publish <connectionId> | verify <cmid>...)`);
}
