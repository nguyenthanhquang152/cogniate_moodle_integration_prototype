/* global window, document, location */
// T5-spike runner (throwaway). Serves the player shell (app origin), the runtime and the REAL extracted
// packages (content origin) from local files with page.route(), with the planned headers, and records what
// the browser does. No stack and no network: every other host is blocked (S7).
//
// Data (untrusted, extracted into a new empty folder, git-ignored): .tmp/player-spike/pkg-scorm, pkg-html,
// scorm-again/package/dist. See SPIKE-NOTES.md "How to run".
//
//   Playwright Chromium (e2e image): docker run --rm -v "$PWD":/repo -w /repo --ipc=host \
//     mcr.microsoft.com/playwright:v1.56.0-noble node apps/player-spike/spike.mjs
//   Google Chrome on the host (H.264 video): node apps/player-spike/spike.mjs --channel=chrome --only=allow
//   Options: --only=<scenario prefix,...>  --out=<report.json>
import { readFileSync, statSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { chromium } from '@playwright/test';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const DATA = join(REPO, '.tmp/player-spike');
const APP = 'https://app.cogniate.test';
const CONTENT = 'https://content.cogniate-content.test';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? 'true']));
const channel = args.channel;
const only = args.only ? args.only.split(',') : null;
const browserLabel = channel ?? 'playwright-chromium';
const outFile = args.out ?? join(DATA, `report-${browserLabel}.json`);
// --real-commits: /spike/commit/* is NOT intercepted. It goes to the running stack (content host stub), which logs
// each request as http_request in infra/.logs/cogniate-content.jsonl. Needed for window-close tests: requests sent
// while a page closes are not routed by page.route.
const realCommits = args['real-commits'] === 'true';
const STUB_LOG = join(REPO, 'infra/.logs/cogniate-content.jsonl');

const PLANNED = {
  shellSandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals',
  outerAllow: 'autoplay; fullscreen',
  innerAllow: 'autoplay; fullscreen',
  rtFrameAncestors: APP,
  pkgFrameAncestors: `${CONTENT} ${APP}`,
  shellPermissionsPolicy: null,
  externalMode: 'abort', // 'abort' (fail fast) or 'hang' (never answer): S7
};
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.xml': 'application/xml', '.json': 'application/json', '.txt': 'text/plain' };

for (const need of ['pkg-scorm/index.html', 'pkg-html/index.html', 'scorm-again/package/dist/scorm12.min.js']) {
  if (!existsSync(join(DATA, need))) throw new Error(`Missing ${join(DATA, need)}. See SPIKE-NOTES.md "How to run".`);
}

/** Read a file below root. Refuse paths that leave the root (the package is untrusted). */
function safeRead(root, rel) {
  const full = normalize(join(root, rel));
  if (!full.startsWith(root + '/')) return null;
  try { if (!statSync(full).isFile()) return null; } catch { return null; }
  return full;
}

function shellHtml(cfg, rtUrl) {
  const nonce = randomBytes(12).toString('base64');
  const body = `<!doctype html><html><head><meta charset="utf-8"><title>Player shell (spike)</title>
<style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%}</style>
<script nonce="${nonce}">window.addEventListener('message', function (e) {
  console.log('[shell-pm] ' + JSON.stringify({ origin: e.origin, event: e.data && e.data.body && e.data.body.event, seq: e.data && e.data.body && e.data.body.seq }));
});</script></head><body>
<iframe id="rt" ${cfg.shellSandbox === null ? '' : `sandbox="${cfg.shellSandbox}"`} ${cfg.outerAllow === null ? '' : `allow="${cfg.outerAllow}"`} src="${rtUrl}"></iframe>
</body></html>`;
  const headers = {
    'content-type': 'text/html; charset=utf-8',
    'content-security-policy': `frame-ancestors 'none'; frame-src ${CONTENT}; script-src 'nonce-${nonce}'`,
    'referrer-policy': 'same-origin',
  };
  if (cfg.shellPermissionsPolicy) headers['permissions-policy'] = cfg.shellPermissionsPolicy;
  return { body, headers };
}

function runtimeHtml(cfg, kind) {
  const scripts = kind === 'html'
    ? '<script src="/_rt/html-tracker.js"></script>'
    : `${cfg.api === 'again' ? '<script src="/_rt/scorm-again/scorm12.min.js"></script>' : '<script src="/_rt/own-scorm12.js"></script>'}<script src="/_rt/scorm-runtime.js"></script>`;
  const entry = kind === 'html' ? '/spike/pkg/html/index.html' : '/spike/pkg/scorm/index.html';
  return `<!doctype html><html><head><meta charset="utf-8"><title>Runtime (spike)</title>
<style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%}</style>${scripts}</head><body>
<iframe id="pkg" ${cfg.innerAllow === null ? '' : `allow="${cfg.innerAllow}"`} src="${entry}"></iframe></body></html>`;
}

/** Route handler for one scenario. Records commits, blocked hosts and served files. */
function makeRouter(cfg, rec) {
  return async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.origin === APP && url.pathname === '/spike/play') {
      const { body, headers } = shellHtml(cfg, url.searchParams.get('rt'));
      return route.fulfill({ status: 200, headers, body });
    }
    if (url.origin !== CONTENT) {
      rec.blocked.push(url.host);
      if (cfg.externalMode === 'hang') return new Promise(() => {}); // never answered (until the context closes)
      return route.abort('blockedbyclient');
    }
    const p = url.pathname;
    if (p === '/spike/rt/scorm' || p === '/spike/rt/html') {
      return route.fulfill({ status: 200, body: runtimeHtml({ ...cfg, api: url.searchParams.get('api') ?? 'own' }, p.endsWith('html') ? 'html' : 'scorm'), headers: {
        'content-type': 'text/html; charset=utf-8', 'content-security-policy': `frame-ancestors ${cfg.rtFrameAncestors}`, 'referrer-policy': 'same-origin' } });
    }
    if (p.startsWith('/spike/commit') && realCommits) return route.continue();
    if (p.startsWith('/spike/commit')) {
      let body;
      try { body = JSON.parse(req.postData() ?? 'null'); } catch { body = { unparsed: req.postData() }; }
      rec.commits.push({ via: url.searchParams.get('via'), contentType: req.headers()['content-type'] ?? null,
        event: body?.event, seq: body?.seq, t: body?.t, status: body?.cmi?.['cmi.core.lesson_status'] ?? body?.cmi?.core?.lesson_status,
        raw: body?.cmi?.['cmi.core.score.raw'] ?? body?.cmi?.core?.score?.raw, body });
      return route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: '{"accepted":true}' });
    }
    let root = null; let rel = null;
    if (p.startsWith('/_rt/scorm-again/')) { root = join(DATA, 'scorm-again/package/dist'); rel = p.slice('/_rt/scorm-again/'.length); }
    else if (p.startsWith('/_rt/')) { root = join(HERE, 'runtime'); rel = p.slice('/_rt/'.length); }
    else if (p.startsWith('/spike/pkg/scorm/')) { root = join(DATA, 'pkg-scorm'); rel = decodeURIComponent(p.slice('/spike/pkg/scorm/'.length)); }
    else if (p.startsWith('/spike/pkg/html/')) { root = join(DATA, 'pkg-html'); rel = decodeURIComponent(p.slice('/spike/pkg/html/'.length)); }
    const file = root ? safeRead(root, rel) : null;
    if (!file) return route.fulfill({ status: 404, body: 'not found' });
    const isPkg = p.startsWith('/spike/pkg/');
    const headers = { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'x-content-type-options': 'nosniff', 'accept-ranges': 'bytes' };
    if (isPkg) { headers['content-security-policy'] = `frame-ancestors ${cfg.pkgFrameAncestors}`; headers['referrer-policy'] = 'same-origin'; }
    const data = readFileSync(file);
    const range = req.headers().range;
    const m = range && /^bytes=(\d*)-(\d*)$/.exec(range);
    if (m) {
      const start = m[1] === '' ? Math.max(0, data.length - Number(m[2])) : Number(m[1]);
      const end = m[2] === '' || m[1] === '' ? data.length - 1 : Math.min(Number(m[2]), data.length - 1);
      rec.ranges += 1;
      return route.fulfill({ status: 206, headers: { ...headers, 'content-range': `bytes ${start}-${end}/${data.length}` }, body: data.subarray(start, end + 1) });
    }
    return route.fulfill({ status: 200, headers, body: data });
  };
}

async function newScenario(browser, cfgOverrides = {}) {
  const cfg = { ...PLANNED, ...cfgOverrides };
  const rec = { cfg, calls: [], commits: [], blocked: [], console: [], dialogs: [], popups: 0, shellMessages: [], html: [], ranges: 0 };
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.route('**/*', makeRouter(cfg, rec));
  const page = await context.newPage();
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.startsWith('[scorm-call] ')) rec.calls.push(JSON.parse(text.slice(13)));
    else if (text.startsWith('[shell-pm] ')) rec.shellMessages.push(JSON.parse(text.slice(11)));
    else if (text.startsWith('[html-progress] ')) { try { rec.html.push(JSON.parse(text.slice(16))); } catch { rec.html.push(text); } }
    else if (msg.type() === 'error' || msg.type() === 'warning' || /Refused|sandbox|Ignored call/.test(text)) rec.console.push(`${msg.type()}: ${text.slice(0, 300)}`);
  });
  page.on('dialog', async (d) => { rec.dialogs.push(`${d.type()}: ${d.message().slice(0, 60)}`); await d.dismiss(); });
  page.on('popup', () => { rec.popups += 1; });
  return { cfg, rec, context, page };
}

function playUrl(kind, query = {}) {
  const rt = new URL(`${CONTENT}/spike/rt/${kind}`);
  rt.searchParams.set('shell', APP);
  for (const [k, v] of Object.entries(query)) rt.searchParams.set(k, v);
  return `${APP}/spike/play?rt=${encodeURIComponent(rt.href)}`;
}

const pkgFrame = (page) => page.frames().find((f) => f.url().includes('/spike/pkg/'));
const rtFrame = (page) => page.frames().find((f) => f.url().includes('/spike/rt/'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitPkg(page, file, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const f = pkgFrame(page);
    if (f && f.url().endsWith(file)) {
      // domcontentloaded, not load: with hanging external hosts (S7) the load event never fires.
      try { await f.waitForLoadState('domcontentloaded', { timeout: 2000 }); return f; } catch { /* retry */ }
    }
    await sleep(100);
  }
  return null;
}

/** What the package frame can do: script ran, API, storage, media, permissions. */
async function probePkg(page) {
  const frames = page.frames().map((f) => f.url().replace(CONTENT, 'C').replace(APP, 'A').slice(0, 80));
  const f = pkgFrame(page);
  if (!f) return { frames, pkgFrame: 'missing' };
  try {
    return { frames, ...(await f.evaluate(async () => {
      const out = { url: location.pathname };
      out.scriptRan = typeof window.CogniateSCORM !== 'undefined' || !!document.body;
      out.cogniateScormAvailable = !!(window.CogniateSCORM && window.CogniateSCORM.available);
      try { out.parentApi = !!window.parent.API; } catch (e) { out.parentApi = `error ${e.name}`; }
      try { window.localStorage.setItem('spike', '1'); out.localStorage = 'ok'; } catch (e) { out.localStorage = e.name; }
      try { window.sessionStorage.setItem('spike', '1'); out.sessionStorage = 'ok'; } catch (e) { out.sessionStorage = e.name; }
      out.origin = location.origin === 'null' ? 'opaque (null)' : location.origin;
      out.lessonId = document.body ? document.body.getAttribute('data-lesson-id') : null;
      out.fullscreenEnabled = document.fullscreenEnabled;
      const fp = document.featurePolicy || document.permissionsPolicy;
      out.allowsAutoplay = fp ? fp.allowsFeature('autoplay') : 'n/a';
      out.allowsFullscreen = fp ? fp.allowsFeature('fullscreen') : 'n/a';
      out.autoplayPolicy = navigator.getAutoplayPolicy ? navigator.getAutoplayPolicy('mediaelement') : 'n/a';
      // The package has no <video> at load: the "Ask Lyra" info card builds it (innerHTML) when opened.
      if (!document.querySelector('video')) {
        const opener = document.querySelector('[data-action="open-lyra"]');
        out.lyraOpener = !!opener;
        if (opener) { opener.click(); await new Promise((r) => setTimeout(r, 1500)); }
      }
      const v = document.querySelector('video');
      out.videoInDom = !!v;
      if (v) {
        await new Promise((r) => setTimeout(r, 2500));
        out.video = { paused: v.paused, readyState: v.readyState, currentTime: Math.round(v.currentTime * 10) / 10,
          error: v.error ? v.error.code : null, canPlayH264: v.canPlayType('video/mp4; codecs="avc1.42E01E"') };
      }
      return out;
    })) };
  } catch (e) {
    return { frames, pkgFrame: f.url().slice(0, 80), evaluateError: e.message.split('\n')[0] };
  }
}

async function tryModalsAndPopups(page, rec) {
  const f = pkgFrame(page);
  if (!f) return {};
  const before = rec.dialogs.length;
  const alertCall = await f.evaluate(() => { window.alert('spike-alert'); return 'returned'; }).catch((e) => `error ${e.message.split('\n')[0]}`);
  const popup = await f.evaluate(() => { const w = window.open('about:blank'); const ok = !!w; if (w) w.close(); return ok; }).catch(() => 'error');
  return { alertCall, dialogShown: rec.dialogs.length > before, windowOpen: popup };
}

async function tryFullscreen(page) {
  const f = pkgFrame(page);
  if (!f) return 'no frame';
  await f.locator('video').first().click({ force: true, timeout: 3000 }).catch(() => {});
  return f.evaluate(() => (document.querySelector('video') || document.documentElement).requestFullscreen()
    .then(() => { const ok = !!document.fullscreenElement; return document.exitFullscreen().then(() => (ok ? 'entered' : 'no element')); })
    .catch((e) => `rejected: ${e.name}`)).catch((e) => `error ${e.message.split('\n')[0]}`);
}

/** Learner path: menu, lesson (scroll to end, 11 s dwell), answer. */
async function learnerPath(page, { answer = 'correct', dwellMs = 11000 } = {}) {
  const steps = [];
  const menu = await waitPkg(page, 'index.html');
  steps.push({ step: 'menu loaded', ok: !!menu });
  await sleep(1500);
  // DOM click on the lesson link. A pointer click is not reliable: in the HTML export the link copies are
  // hidden or covered by an overlay (Playwright waits for "actionable" until the timeout).
  await menu.evaluate(() => document.querySelector('a[href="lesson-ai-web-sprint.html"]').click());
  const lesson = await waitPkg(page, 'lesson-ai-web-sprint.html');
  steps.push({ step: 'lesson loaded', ok: !!lesson });
  const scroll = () => lesson.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await scroll();
  await sleep(dwellMs / 2); await scroll(); await sleep(dwellMs / 2); await scroll();
  const sel = answer === 'correct' ? 'input[data-cog-correct="true"]' : 'input[data-cog-correct="false"]';
  await lesson.locator(sel).first().check({ force: true });
  steps.push({ step: `answered ${answer}` });
  await sleep(2000);
  return steps;
}

function summariseCalls(calls) {
  return calls.map((c) => `${c.t}ms ${c.page} ${c.fn}(${c.args.map((a) => JSON.stringify(a).slice(0, 60)).join(', ')}) -> ${JSON.stringify(c.ret).slice(0, 50)} [${c.err}]`);
}
const commitView = (rec) => rec.commits.map((c) => `${c.via} ${c.event} seq=${c.seq} t=${c.t} status=${c.status ?? '-'} raw=${c.raw ?? '-'} ct=${c.contentType}`);

const scenarios = {
  // S1: CSP frame-ancestors on package files.
  async 'csp-planned'(b) { const s = await newScenario(b); await s.page.goto(playUrl('scorm')); await waitPkg(s.page, 'index.html'); await sleep(1500); return { probe: await probePkg(s.page), console: s.rec.console, close: s }; },
  async 'csp-content-only'(b) { const s = await newScenario(b, { pkgFrameAncestors: CONTENT }); await s.page.goto(playUrl('scorm')); await sleep(4000); return { probe: await probePkg(s.page), console: s.rec.console, close: s }; },
  async 'csp-runtime-content-only'(b) { const s = await newScenario(b, { rtFrameAncestors: CONTENT }); await s.page.goto(playUrl('scorm')); await sleep(4000); return { probe: await probePkg(s.page), console: s.rec.console, close: s }; },
  // Sandbox variants on the runtime iframe (the package frame inherits them).
  async 'sandbox-planned'(b) { const s = await newScenario(b); await s.page.goto(playUrl('scorm')); await waitPkg(s.page, 'index.html'); await sleep(1000); return { probe: await probePkg(s.page), modals: await tryModalsAndPopups(s.page, s.rec), popups: s.rec.popups, console: s.rec.console, close: s }; },
  async 'sandbox-no-same-origin'(b) { const s = await newScenario(b, { shellSandbox: 'allow-scripts allow-forms allow-popups allow-modals' }); await s.page.goto(playUrl('scorm')); await sleep(4000); return { probe: await probePkg(s.page), calls: s.rec.calls.length, console: s.rec.console, close: s }; },
  async 'sandbox-no-modals'(b) { const s = await newScenario(b, { shellSandbox: 'allow-scripts allow-same-origin allow-forms allow-popups' }); await s.page.goto(playUrl('scorm')); await waitPkg(s.page, 'index.html'); await sleep(1000); return { modals: await tryModalsAndPopups(s.page, s.rec), console: s.rec.console, close: s }; },
  async 'sandbox-no-popups'(b) { const s = await newScenario(b, { shellSandbox: 'allow-scripts allow-same-origin allow-forms allow-modals' }); await s.page.goto(playUrl('scorm')); await waitPkg(s.page, 'index.html'); await sleep(1000); return { modals: await tryModalsAndPopups(s.page, s.rec), popups: s.rec.popups, console: s.rec.console, close: s }; },
  async 'sandbox-minimal-scripts-same-origin'(b) { const s = await newScenario(b, { shellSandbox: 'allow-scripts allow-same-origin' }); await s.page.goto(playUrl('scorm')); await waitPkg(s.page, 'index.html'); await sleep(1000); return { probe: await probePkg(s.page), modals: await tryModalsAndPopups(s.page, s.rec), close: s }; },
  // S6: allow attributes and Permissions-Policy.
  async 'allow-both'(b) { const s = await newScenario(b); await s.page.goto(playUrl('scorm')); await waitPkg(s.page, 'index.html'); return { probe: await probePkg(s.page), fullscreen: await tryFullscreen(s.page), ranges: s.rec.ranges, close: s }; },
  async 'allow-outer-only'(b) { const s = await newScenario(b, { innerAllow: null }); await s.page.goto(playUrl('scorm')); await waitPkg(s.page, 'index.html'); return { probe: await probePkg(s.page), fullscreen: await tryFullscreen(s.page), close: s }; },
  async 'allow-none'(b) { const s = await newScenario(b, { innerAllow: null, outerAllow: null }); await s.page.goto(playUrl('scorm')); await waitPkg(s.page, 'index.html'); return { probe: await probePkg(s.page), fullscreen: await tryFullscreen(s.page), close: s }; },
  async 'allow-shell-pp-self'(b) { const s = await newScenario(b, { shellPermissionsPolicy: 'fullscreen=(self), autoplay=(self)' }); await s.page.goto(playUrl('scorm')); await waitPkg(s.page, 'index.html'); return { probe: await probePkg(s.page), fullscreen: await tryFullscreen(s.page), close: s }; },
  async 'allow-shell-pp-content'(b) { const s = await newScenario(b, { shellPermissionsPolicy: `fullscreen=(self "${CONTENT}"), autoplay=(self "${CONTENT}")` }); await s.page.goto(playUrl('scorm')); await waitPkg(s.page, 'index.html'); return { probe: await probePkg(s.page), fullscreen: await tryFullscreen(s.page), close: s }; },
  // S2: API behaviour without the package (direct calls on window.API in the runtime frame).
  async 'api-contract-own'(b) { return apiContract(b, 'own'); },
  async 'api-contract-again'(b) { return apiContract(b, 'again'); },
  // S4 / Q2: the full course with each API.
  async 'run-own-pass'(b) { return fullRun(b, { api: 'own' }); },
  async 'run-again-pass'(b) { return fullRun(b, { api: 'again' }); },
  async 'run-own-fail'(b) { return fullRun(b, { api: 'own', answer: 'wrong', browseAfter: false }); },
  async 'run-own-moodle-after-finish'(b) { return fullRun(b, { api: 'own', afterFinish: 'moodle' }); },
  async 'run-own-external-hang'(b) { return fullRun(b, { api: 'own', browseAfter: false, cfg: { externalMode: 'hang' } }); },
  // S5 / Q3: close the window before the end.
  async 'close-mid-course'(b) {
    const s = await newScenario(b); await s.page.goto(playUrl('scorm')); await waitPkg(s.page, 'index.html'); await sleep(2000);
    const before = s.rec.commits.length;
    await s.page.close({ runBeforeUnload: true }); await sleep(2500);
    return { commitsBeforeClose: before, commits: commitView(s.rec), shellMessages: s.rec.shellMessages, lastCalls: summariseCalls(s.rec.calls.slice(-8)), close: s };
  },
  async 'navigate-away-mid-course'(b) {
    const s = await newScenario(b); await s.page.goto(playUrl('scorm')); await waitPkg(s.page, 'index.html'); await sleep(2000);
    await s.page.goto('https://app.cogniate.test/spike/play?rt=about:blank').catch(() => {}); await sleep(2500);
    return { commits: commitView(s.rec), shellMessages: s.rec.shellMessages, lastCalls: summariseCalls(s.rec.calls.slice(-8)), close: s };
  },
  // Second session of a finished course (resume from the saved CMI).
  async 'second-session-finished'(b) {
    const first = await fullRun(b, { api: 'own', browseAfter: false, keepRec: true });
    const fin = first.rec.commits.find((c) => c.event === 'finish');
    const keep = ['cmi.core.lesson_status', 'cmi.core.lesson_location', 'cmi.core.score.raw', 'cmi.core.score.min', 'cmi.core.score.max', 'cmi.suspend_data'];
    const saved = Object.fromEntries(Object.entries(fin?.body?.cmi ?? {}).filter(([k]) => keep.includes(k)));
    const exit = fin?.body?.cmi?.['cmi.core.exit'] ?? '';
    await first.close.context.close().catch(() => {});
    const s = await newScenario(b);
    await s.page.goto(playUrl('scorm', { api: 'own', saved: Buffer.from(JSON.stringify(saved)).toString('base64'), entry: exit === 'suspend' ? 'resume' : '' }));
    await waitPkg(s.page, 'index.html'); await sleep(3000);
    return { saved, entry: exit === 'suspend' ? 'resume' : '', calls: summariseCalls(s.rec.calls), commits: commitView(s.rec), close: s };
  },
  async 'html-debug'(b) {
    const s = await newScenario(b); await s.page.goto(playUrl('html'));
    const menu = await waitPkg(s.page, 'index.html'); await sleep(1500);
    const link = await menu.evaluate(() => { const a = document.querySelector('a[href="lesson-ai-web-sprint.html"]'); return a ? a.outerHTML.slice(0, 300) : null; });
    await menu.locator('a[href="lesson-ai-web-sprint.html"]').first().click({ force: true }).catch((e) => e.message);
    await sleep(3000);
    return { link, frames: s.page.frames().map((f) => f.url().slice(0, 90)), popups: s.rec.popups, console: s.rec.console.slice(0, 8), html: s.rec.html.slice(0, 5), close: s };
  },
  async 'video-debug'(b) {
    const s = await newScenario(b); await s.page.goto(playUrl('scorm')); const f = await waitPkg(s.page, 'index.html'); await sleep(1500);
    const before = await f.evaluate(() => { const o = [...document.querySelectorAll('[data-action="open-lyra"]')]; return o.map((e) => ({ tag: e.tagName, cls: (e.className || '').toString().slice(0, 80), text: (e.textContent || '').trim().slice(0, 60), visible: !!(e.offsetWidth || e.offsetHeight) })); });
    const opener = f.locator('[data-action="open-lyra"]').first();
    const clicked = await opener.click({ timeout: 3000 }).then(() => 'pointer click').catch(async () => { await f.evaluate(() => document.querySelector('[data-action="open-lyra"]').click()); return 'dom click'; });
    await sleep(2500);
    const after = await f.evaluate(() => { const v = document.querySelector('video'); return { videos: document.querySelectorAll('video').length, src: v && v.currentSrc, paused: v && v.paused, readyState: v && v.readyState, error: v && v.error && v.error.code, canPlayH264: v && v.canPlayType('video/mp4; codecs="avc1.42E01E"'), card: !!document.querySelector('.js-lyra-video-container') }; });
    return { before, clicked, after, ranges: s.rec.ranges, console: s.rec.console.filter((c) => /lyra|Lyra|video|media/i.test(c)).slice(0, 5), close: s };
  },
  // S5 / Q3 with real delivery (--real-commits, on the stack network): what reaches the server when the window closes.
  async 'close-real-mid-course'(b) { return realExit(b, { finish: false, how: 'close' }); },
  async 'close-real-after-finish'(b) { return realExit(b, { finish: true, how: 'close' }); },
  async 'navigate-real-mid-course'(b) { return realExit(b, { finish: false, how: 'navigate' }); },
  // Q4: HTML package with the observer tracker.
  async 'html-run-pass'(b) { return htmlRun(b, 'correct'); },
  async 'html-run-fail'(b) { return htmlRun(b, 'wrong'); },
  async 'html-run-external-hang'(b) { return htmlRun(b, 'correct', { externalMode: 'hang' }); },
};

async function apiContract(b, api) {
  const s = await newScenario(b);
  await s.page.goto(playUrl('scorm', { api }));
  await waitPkg(s.page, 'index.html');
  const rt = rtFrame(s.page);
  // A fresh API object in the runtime frame, so the package's own session does not interfere.
  const result = await rt.evaluate((kind) => {
    const fresh = kind === 'again'
      ? new window.Scorm12API({ autocommit: false, lmsCommitUrl: false, logLevel: 5 })
      : window.CogniateOwnScorm12.create({ readOnly: { student_id: '5', mastery_score: '70' } });
    const events = [];
    if (kind === 'again') { fresh.on('LMSCommit', () => events.push('commit-hook')); fresh.on('LMSFinish', () => events.push('finish-hook')); }
    const r = [];
    const call = (fn, ...a) => { const ret = fresh[fn](...a); r.push(`${fn}(${a.map((x) => JSON.stringify(x)).join(',')}) -> ${JSON.stringify(String(ret))} [${fresh.LMSGetLastError()}]`); };
    call('LMSGetValue', 'cmi.core.lesson_status');
    call('LMSSetValue', 'cmi.core.lesson_status', 'incomplete');
    call('LMSCommit', '');
    call('LMSInitialize', 'x');
    call('LMSInitialize', '');
    call('LMSInitialize', '');
    call('LMSGetValue', 'cmi.core.lesson_status');
    call('LMSGetValue', 'cmi.foo');
    call('LMSSetValue', 'cmi.foo', 'x');
    call('LMSGetValue', 'cmi.core.session_time');
    call('LMSSetValue', 'cmi.core.student_id', 'x');
    call('LMSSetValue', 'cmi.core._children', 'x');
    call('LMSSetValue', 'cmi.core.lesson_status', 'not attempted');
    call('LMSSetValue', 'cmi.core.lesson_status', 'bogus');
    call('LMSSetValue', 'cmi.core.score.raw', '101');
    call('LMSSetValue', 'cmi.core.session_time', '0000:00:05.00');
    call('LMSGetValue', 'cmi.student_preference.audio');
    call('LMSGetValue', 'cmi.student_data.mastery_score');
    call('LMSSetValue', 'cmi.interactions.1.id', 'skip');
    call('LMSSetValue', 'cmi.interactions.0.id', 'q1');
    call('LMSGetValue', 'cmi.interactions._count');
    call('LMSCommit', 'x');
    call('LMSCommit', '');
    call('LMSFinish', '');
    call('LMSGetValue', 'cmi.core.lesson_status');
    call('LMSSetValue', 'cmi.core.lesson_status', 'passed');
    call('LMSCommit', '');
    call('LMSFinish', '');
    call('LMSInitialize', '');
    const cmi = kind === 'again' ? fresh.renderCMIToJSONObject() : fresh._flat();
    return { calls: r, events, cmiSample: JSON.stringify(cmi).slice(0, 400) };
  }, api);
  return { ...result, close: s };
}

async function fullRun(b, { api, answer = 'correct', afterFinish = 'contract', browseAfter = true, keepRec = false, cfg = {} }) {
  const s = await newScenario(b, cfg);
  const started = Date.now();
  // domcontentloaded: with hanging external hosts (S7) the top page load event never fires.
  await s.page.goto(playUrl('scorm', { api, afterFinish }), { waitUntil: 'domcontentloaded' });
  const steps = await learnerPath(s.page, { answer });
  const finishAt = s.rec.commits.find((c) => c.event === 'finish');
  let after = null;
  if (browseAfter) {
    const callsBefore = s.rec.calls.length;
    const lesson = pkgFrame(s.page);
    await lesson.evaluate(() => document.querySelector('a[href="index.html"]').click()).catch(() => {});
    await waitPkg(s.page, 'index.html'); await sleep(2500);
    after = { callsAfterFinishNavigation: summariseCalls(s.rec.calls.slice(callsBefore)).slice(0, 14) };
  }
  const commitsBeforeClose = s.rec.commits.length;
  await s.page.close({ runBeforeUnload: true });
  await sleep(2500);
  const out = {
    seconds: Math.round((Date.now() - started) / 1000), steps,
    callCount: s.rec.calls.length,
    calls: summariseCalls(s.rec.calls),
    commits: commitView(s.rec),
    commitsAfterClose: commitView({ commits: s.rec.commits.slice(commitsBeforeClose) }),
    finish: finishAt ? { seq: finishAt.seq, status: finishAt.status, raw: finishAt.raw } : null,
    finalCmi: finishAt?.body?.cmi ?? null,
    after, blockedHosts: [...new Set(s.rec.blocked)], blockedCount: s.rec.blocked.length,
    console: s.rec.console.slice(0, 10),
    close: s,
  };
  if (keepRec) out.rec = s.rec;
  return out;
}

function readStub(sinceIso) {
  if (!existsSync(STUB_LOG)) return [];
  return readFileSync(STUB_LOG, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter((r) => r && r.event === 'http_request' && typeof r.path === 'string' && r.path.startsWith('/spike/commit/') && r.ts >= sinceIso);
}

async function realExit(b, { finish, how }) {
  if (!realCommits) throw new Error('run with --real-commits on the stack network (see SPIKE-NOTES.md)');
  const since = new Date().toISOString();
  const s = await newScenario(b);
  await s.page.goto(playUrl('scorm'));
  if (finish) await learnerPath(s.page); else { await waitPkg(s.page, 'index.html'); await sleep(2000); }
  const mark = new Date().toISOString();
  const callsBefore = s.rec.calls.length;
  if (how === 'close') await s.page.close({ runBeforeUnload: true });
  else await s.page.goto(`${APP}/spike/play?rt=about:blank`).catch(() => {});
  await sleep(3000);
  const fmt = (r) => `${r.ts.slice(17, 23)} ${r.path.replace('/spike/commit/', '')} -> ${r.status}`;
  const lines = readStub(since);
  return { how, finish, beforeExit: lines.filter((r) => r.ts < mark).map(fmt), onExit: lines.filter((r) => r.ts >= mark).map(fmt),
    callsOnExit: summariseCalls(s.rec.calls.slice(callsBefore)), close: s };
}

async function htmlRun(b, answer, cfg = {}) {
  const s = await newScenario(b, cfg);
  const started = Date.now();
  await s.page.goto(playUrl('html'), { waitUntil: 'domcontentloaded' });
  const steps = await learnerPath(s.page, { answer });
  const rt = rtFrame(s.page);
  const state = await rt.evaluate(() => window.__htmlState());
  await s.page.close({ runBeforeUnload: true }); await sleep(2000);
  return { seconds: Math.round((Date.now() - started) / 1000), steps, state, progressEvents: s.rec.html.map((h) => (typeof h === 'string' ? h : `${h.t}ms ${h.reason} -> ${JSON.stringify(h.localOutcome)}`)),
    commits: s.rec.commits.map((c) => `${c.via} ${c.event} seq=${c.seq}`), blockedHosts: [...new Set(s.rec.blocked)], console: s.rec.console.slice(0, 5), close: s };
}

const browser = await chromium.launch({ ...(channel ? { channel } : {}), headless: true });
const report = { browser: `${browserLabel} ${browser.version()}`, startedAt: new Date().toISOString(), results: {} };
for (const [name, fn] of Object.entries(scenarios)) {
  if (only && !only.some((p) => name.startsWith(p))) continue;
  process.stdout.write(`- ${name} ... `);
  const t = Date.now();
  try {
    const res = await fn(browser);
    const { close, ...rest } = res;
    if (close) await close.context.close().catch(() => {});
    if (rest.rec) delete rest.rec;
    report.results[name] = rest;
    console.log(`done (${Math.round((Date.now() - t) / 1000)} s)`);
  } catch (e) {
    report.results[name] = { error: e.message.split('\n').slice(0, 3).join(' | ') };
    console.log(`ERROR ${e.message.split('\n')[0]}`);
  }
}
await browser.close();
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`);
console.log(`report: ${outFile.replace(REPO + '/', '')} (${report.browser})`);
