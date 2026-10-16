/* global window, document, location */
// SPIKE (throwaway). HTML runtime: observes the same-origin package frame (ADR-004 option C). No package byte changes.
// Rule (same as the SCORM adapter): menu page seen on visit; other pages seen after minDwellMs visible time
// and a scroll to the end (24 px slack); a question is answered by the first click/change on an input with
// data-cog-correct inside [data-cog-quiz]. Complete = all pages seen and all questions answered.
// Logs "[html-progress] {json}" on each change and POSTs {event:"progress"} to /spike/commit (fetch keepalive).
(function () {
  'use strict';

  var q = new URLSearchParams(location.search);
  var profile = {
    pages: ['index', 'lesson-ai-web-sprint'],
    menuPage: 'index',
    questions: ['01M2M36Y89M9KPPZENF1ZW4AWJ'],
    minDwellMs: Number(q.get('dwell') || 10000),
    mastery: 70,
  };
  var SLACK = 24;
  var progress = { seenPages: [], answers: {} };
  var sessionId = 'ses_spike_html';
  var seq = 0;
  var t0 = Date.now();
  var pageLoads = [];

  function outcome() {
    var seen = profile.pages.filter(function (p) { return progress.seenPages.indexOf(p) !== -1; }).length;
    var answered = profile.questions.filter(function (id) { return progress.answers[id] !== undefined; });
    var correct = answered.filter(function (id) { return progress.answers[id] === '1'; }).length;
    var complete = seen === profile.pages.length && answered.length === profile.questions.length;
    var score = profile.questions.length ? Math.round((correct / profile.questions.length) * 100) : null;
    return { complete: complete, score: score, passed: complete && score !== null ? score >= profile.mastery : null };
  }

  function report(reason, via) {
    seq += 1;
    var body = { kind: 'html', event: reason === 'unload' ? 'unload' : 'progress', reason: reason, sessionId: sessionId, seq: seq,
      t: Date.now() - t0, progress: progress, localOutcome: outcome() };
    window.console.log('[html-progress] ' + JSON.stringify(body));
    var text = JSON.stringify(body);
    var url = '/spike/commit/' + via + '/' + body.event + '/' + seq + '?via=' + via;
    if (via === 'beacon') { navigator.sendBeacon(url, text); return; }
    fetch(url, { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body: text })
      .catch(function () {});
  }

  function see(page, why) {
    if (!page || progress.seenPages.indexOf(page) !== -1 || profile.pages.indexOf(page) === -1) return;
    progress.seenPages.push(page);
    report('seen:' + page + ':' + why, 'fetch');
  }

  function attach(win, doc) {
    var page = doc.body ? doc.body.getAttribute('data-lesson-id') : null;
    pageLoads.push({ t: Date.now() - t0, page: page, path: win.location.pathname });
    // Keep navigation inside the frame (the HTML export may carry target/rel on lesson links).
    var links = doc.querySelectorAll('a[href$=".html"]');
    for (var i = 0; i < links.length; i++) {
      if (/^(https?:)?\/\//.test(links[i].getAttribute('href') || '')) continue;
      links[i].removeAttribute('target');
      links[i].removeAttribute('rel');
    }
    if (page === profile.menuPage && profile.pages.length > 1) {
      see(page, 'menu-visit');
    } else {
      var dwellDone = false;
      var reachedEnd = false;
      var remaining = profile.minDwellMs;
      var since = null;
      var timer = null;
      var check = function () { if (dwellDone && reachedEnd) see(page, 'dwell+scroll'); };
      var atEnd = function () {
        var full = Math.max(doc.documentElement.scrollHeight, doc.body ? doc.body.scrollHeight : 0);
        var view = win.innerHeight;
        return full <= view + SLACK || win.scrollY + view >= full - SLACK;
      };
      var onScroll = function () { if (!reachedEnd && atEnd()) { reachedEnd = true; check(); } };
      var resume = function () {
        if (dwellDone || timer !== null || doc.visibilityState === 'hidden') return;
        since = Date.now();
        timer = window.setTimeout(function () { timer = null; dwellDone = true; check(); }, Math.max(0, remaining));
      };
      var pause = function () {
        if (timer !== null) { window.clearTimeout(timer); timer = null; }
        if (since !== null) { remaining -= Date.now() - since; since = null; }
      };
      win.addEventListener('scroll', onScroll, true);
      win.addEventListener('resize', onScroll);
      doc.addEventListener('visibilitychange', function () { if (doc.visibilityState === 'hidden') pause(); else resume(); });
      win.addEventListener('pagehide', pause);
      onScroll();
      resume();
    }
    var onAnswer = function (ev) {
      var input = ev.target && ev.target.closest ? ev.target.closest('input[data-cog-correct]') : null;
      if (!input) return;
      var box = input.closest('[data-cog-quiz]');
      var id = box ? box.getAttribute('data-cog-quiz') : null;
      if (!id || profile.questions.indexOf(id) === -1 || progress.answers[id] !== undefined) return; // first answer stands
      progress.answers[id] = input.getAttribute('data-cog-correct') === 'true' ? '1' : '0';
      report('answer:' + id, 'fetch');
    };
    doc.addEventListener('click', onAnswer, true);
    doc.addEventListener('change', onAnswer, true);
  }

  window.__htmlState = function () { return { progress: progress, outcome: outcome(), pageLoads: pageLoads, profile: profile }; };

  // Attach once per package document, as soon as it is parsed (readyState "interactive"). Do NOT wait for the
  // iframe "load" event: it never fires while an external host (S3 images, Google fonts) does not answer (S7).
  var attached = new WeakSet();
  function tryAttach(frame) {
    var doc;
    try { doc = frame.contentDocument; } catch { return; }
    if (!doc || attached.has(doc) || doc.readyState === 'loading' || doc.URL === 'about:blank' || !doc.body) return;
    attached.add(doc);
    try { attach(frame.contentWindow, doc); } catch (e) { window.console.log('[html-progress] attach failed: ' + e.name + ' ' + e.message); }
  }
  document.addEventListener('DOMContentLoaded', function () {
    var frame = document.getElementById('pkg');
    frame.addEventListener('load', function () { tryAttach(frame); });
    window.setInterval(function () { tryAttach(frame); }, 150);
  });
  window.addEventListener('pagehide', function () { report('unload', 'beacon'); });
})();
