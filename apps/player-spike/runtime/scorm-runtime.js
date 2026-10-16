/* global window, document, location */
// SPIKE (throwaway). SCORM 1.2 runtime page script (content origin). Loaded in <head>, so window.API exists
// before the package iframe loads. Query parameters (set by the spike runner):
//   api=own|again        own subset (own-scorm12.js) or scorm-again Scorm12API
//   afterFinish=contract|moodle   (own API only) behaviour after LMSFinish
//   saved=<base64 JSON>  flat CMI of the last session; entry=<cmi.core.entry>
//   shell=<origin>       target origin for postMessage
// Every API call is logged as "[scorm-call] {json}". Commits go to /spike/commit:
//   LMSCommit -> event "commit", LMSFinish -> event "finish" (fetch keepalive, JSON)
//   pagehide  -> event "unload" three times, one per transport: beacon (text/plain), fetch keepalive, postMessage
(function () {
  'use strict';

  var q = new URLSearchParams(location.search);
  var apiKind = q.get('api') || 'own';
  var shellOrigin = q.get('shell') || '';
  var saved = q.get('saved') ? JSON.parse(atob(q.get('saved'))) : {};
  var entry = q.has('entry') ? q.get('entry') : 'ab-initio';
  var sessionId = 'ses_spike_' + Math.random().toString(36).slice(2, 8);
  var seq = 0;
  var t0 = Date.now();

  function packagePage() {
    try {
      var f = document.getElementById('pkg');
      return f && f.contentWindow ? f.contentWindow.location.pathname.split('/').pop() : '';
    } catch (e) { return 'cross-origin:' + e.name; }
  }

  function send(event, cmi, via) {
    seq += 1;
    var body = { kind: 'scorm12', event: event, sessionId: sessionId, seq: seq, via: via, t: Date.now() - t0, cmi: cmi };
    var text = JSON.stringify(body);
    var url = '/spike/commit/' + via + '/' + event + '/' + seq + '?via=' + via; // path carries via/event/seq for the stub log
    if (via === 'beacon') return navigator.sendBeacon(url, text);
    if (via === 'postMessage') { window.parent.postMessage({ type: 'cogniate-commit', body: body }, shellOrigin); return true; }
    fetch(url, { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body: text })
      .catch(function () { /* logged by the runner as missing */ });
    return true;
  }

  var api;
  var readCmi;
  var mastery = q.get('mastery') || '70';
  if (apiKind === 'again') {
    api = new window.Scorm12API({ autocommit: false, lmsCommitUrl: false, logLevel: 5 });
    var load = { 'cmi.core.student_id': '5', 'cmi.core.student_name': '', 'cmi.core.entry': entry,
      'cmi.core.credit': 'credit', 'cmi.student_data.mastery_score': mastery };
    Object.keys(saved).forEach(function (k) { load[k] = saved[k]; });
    try { api.loadFromFlattenedJSON(load); } catch (e) { window.console.log('[runtime] loadFromFlattenedJSON failed: ' + e.message); }
    readCmi = function () { return api.renderCMIToJSONObject(); };
    api.on('LMSCommit', function () { send('commit', readCmi(), 'fetch'); });
    api.on('LMSFinish', function () { send('finish', readCmi(), 'fetch'); });
  } else {
    var own = window.CogniateOwnScorm12.create({
      initial: saved,
      readOnly: { student_id: '5', student_name: '', entry: entry, credit: 'credit', mastery_score: mastery },
      afterFinish: q.get('afterFinish') || 'contract',
      onCommit: function (flat) { send('commit', flat, 'fetch'); },
      onFinish: function (flat) { send('finish', flat, 'fetch'); },
    });
    api = own;
    readCmi = function () { return own._flat(); };
  }

  // Log every call with its result and error code. GetLastError/GetErrorString/GetDiagnostic are counted only.
  var quiet = { LMSGetLastError: 0, LMSGetErrorString: 0, LMSGetDiagnostic: 0 };
  var wrapped = {};
  ['LMSInitialize', 'LMSFinish', 'LMSGetValue', 'LMSSetValue', 'LMSCommit', 'LMSGetLastError', 'LMSGetErrorString', 'LMSGetDiagnostic']
    .forEach(function (fn) {
      wrapped[fn] = function () {
        var args = Array.prototype.slice.call(arguments);
        var ret = api[fn].apply(api, args);
        if (Object.prototype.hasOwnProperty.call(quiet, fn)) { quiet[fn] += 1; return ret; }
        var err = String(api.LMSGetLastError());
        window.console.log('[scorm-call] ' + JSON.stringify({ t: Date.now() - t0, page: packagePage(), fn: fn, args: args, ret: String(ret), err: err }));
        return ret;
      };
    });
  wrapped.__quietCounts = quiet;
  window.API = wrapped;
  window.__spike = { apiKind: apiKind, readCmi: readCmi, sessionId: sessionId };

  window.addEventListener('pagehide', function () {
    var cmi = readCmi();
    send('unload', cmi, 'beacon');
    send('unload', cmi, 'fetch');
    send('unload', cmi, 'postMessage');
  });
})();
