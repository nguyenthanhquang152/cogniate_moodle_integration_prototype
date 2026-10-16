/* global window */
// SPIKE (throwaway). A minimal SCORM 1.2 API: the subset in docs/architecture/contracts/cogniate-app-api.md §8.
// It measures the size and the behaviour of "our own subset" against the real Cogniate package.
// window.CogniateOwnScorm12.create(options) returns an object with the eight LMS* functions.
//   options.initial      flat CMI values from the last session, for example {"cmi.suspend_data": "..."}
//   options.readOnly     {student_id, student_name, credit, entry, total_time, lesson_mode, mastery_score, launch_data}
//   options.afterFinish  "contract" (every call -> 101) or "moodle" (Moodle scorm_12.js: like not initialized, 301,
//                        and LMSInitialize opens the session again)
//   options.onCommit(flatCmi), options.onFinish(flatCmi)
(function () {
  'use strict';

  var ERRORS = {
    0: 'No error', 101: 'General exception', 201: 'Invalid argument error', 202: 'Element cannot have children',
    203: 'Element not an array - cannot have count', 301: 'Not initialized', 401: 'Not implemented error',
    402: 'Invalid set value, element is a keyword', 403: 'Element is read only', 404: 'Element is write only',
    405: 'Incorrect data type',
  };
  var STATUS = ['passed', 'completed', 'failed', 'incomplete', 'browsed', 'not attempted'];
  var EXIT = ['time-out', 'suspend', 'logout', ''];
  var INTERACTION_TYPES = ['true-false', 'choice', 'fill-in', 'matching', 'performance', 'sequencing', 'likert', 'numeric'];
  var RESULTS = ['correct', 'wrong', 'unanticipated', 'neutral'];
  var DECIMAL = /^-?\d+(\.\d+)?$/;
  var TIMESPAN = /^\d{2,4}:\d{2}:\d{2}(\.\d{1,2})?$/;
  var TIME = /^\d{2}:\d{2}:\d{2}(\.\d{1,2})?$/;

  function str(max) { return function (v) { return v.length <= max; }; }
  function oneOf(list) { return function (v) { return list.indexOf(v) !== -1; }; }
  function score(v) { return v === '' || (DECIMAL.test(v) && Number(v) >= 0 && Number(v) <= 100); }
  function decimalOrEmpty(v) { return v === '' || DECIMAL.test(v); }
  function status(v) { return STATUS.indexOf(v) !== -1 && v !== 'not attempted'; } // contract: "not attempted" -> 405

  // mode: r, w or rw. keyword: _children / _count (write -> 402). "n" is an array index.
  var MODEL = {
    'cmi.core._children': { mode: 'r', keyword: true, value: 'student_id,student_name,lesson_location,credit,lesson_status,entry,score,total_time,lesson_mode,exit,session_time' },
    'cmi.core.score._children': { mode: 'r', keyword: true, value: 'raw,min,max' },
    'cmi.core.student_id': { mode: 'r' },
    'cmi.core.student_name': { mode: 'r' },
    'cmi.core.lesson_location': { mode: 'rw', check: str(255) },
    'cmi.core.credit': { mode: 'r' },
    'cmi.core.lesson_status': { mode: 'rw', check: status },
    'cmi.core.entry': { mode: 'r' },
    'cmi.core.score.raw': { mode: 'rw', check: score },
    'cmi.core.score.min': { mode: 'rw', check: score },
    'cmi.core.score.max': { mode: 'rw', check: score },
    'cmi.core.total_time': { mode: 'r' },
    'cmi.core.lesson_mode': { mode: 'r' },
    'cmi.core.exit': { mode: 'w', check: oneOf(EXIT) },
    'cmi.core.session_time': { mode: 'w', check: function (v) { return TIMESPAN.test(v); } },
    'cmi.suspend_data': { mode: 'rw', check: str(4096) },
    'cmi.launch_data': { mode: 'r' },
    'cmi.comments': { mode: 'rw', check: str(4096) },
    'cmi.comments_from_lms': { mode: 'r' },
    'cmi.student_data._children': { mode: 'r', keyword: true, value: 'mastery_score,max_time_allowed,time_limit_action' },
    'cmi.student_data.mastery_score': { mode: 'r' },
    'cmi.student_data.max_time_allowed': { mode: 'r' },
    'cmi.student_data.time_limit_action': { mode: 'r' },
    'cmi.objectives._children': { mode: 'r', keyword: true, value: 'id,score,status' },
    'cmi.objectives._count': { mode: 'r', keyword: true, count: 'cmi.objectives' },
    'cmi.objectives.n.id': { mode: 'rw', check: str(255) },
    'cmi.objectives.n.score._children': { mode: 'r', keyword: true, value: 'raw,min,max' },
    'cmi.objectives.n.score.raw': { mode: 'rw', check: score },
    'cmi.objectives.n.score.min': { mode: 'rw', check: score },
    'cmi.objectives.n.score.max': { mode: 'rw', check: score },
    'cmi.objectives.n.status': { mode: 'rw', check: oneOf(STATUS) },
    'cmi.interactions._children': { mode: 'r', keyword: true, value: 'id,objectives,time,type,correct_responses,weighting,student_response,result,latency' },
    'cmi.interactions._count': { mode: 'r', keyword: true, count: 'cmi.interactions' },
    'cmi.interactions.n.id': { mode: 'w', check: str(255) },
    'cmi.interactions.n.objectives._count': { mode: 'r', keyword: true, count: 'objectives' },
    'cmi.interactions.n.objectives.n.id': { mode: 'w', check: str(255) },
    'cmi.interactions.n.time': { mode: 'w', check: function (v) { return TIME.test(v); } },
    'cmi.interactions.n.type': { mode: 'w', check: oneOf(INTERACTION_TYPES) },
    'cmi.interactions.n.correct_responses._count': { mode: 'r', keyword: true, count: 'correct_responses' },
    'cmi.interactions.n.correct_responses.n.pattern': { mode: 'w', check: str(255) },
    'cmi.interactions.n.weighting': { mode: 'w', check: decimalOrEmpty },
    'cmi.interactions.n.student_response': { mode: 'w', check: str(255) },
    'cmi.interactions.n.result': { mode: 'w', check: function (v) { return RESULTS.indexOf(v) !== -1 || DECIMAL.test(v); } },
    'cmi.interactions.n.latency': { mode: 'w', check: function (v) { return TIMESPAN.test(v); } },
  };

  // "cmi.interactions.3.objectives.0.id" -> { pattern: "cmi.interactions.n.objectives.n.id", indexes: [3, 0] }
  function normalise(element) {
    var indexes = [];
    var pattern = element.replace(/\.(\d+)(?=\.|$)/g, function (_m, n) { indexes.push(Number(n)); return '.n'; });
    return { pattern: pattern, indexes: indexes };
  }

  function create(options) {
    options = options || {};
    var ro = options.readOnly || {};
    var values = {};
    var initial = options.initial || {};
    Object.keys(initial).forEach(function (k) { values[k] = String(initial[k]); });
    var fixed = {
      'cmi.core.student_id': ro.student_id || '', 'cmi.core.student_name': ro.student_name || '',
      'cmi.core.credit': ro.credit || 'credit', 'cmi.core.entry': ro.entry === undefined ? 'ab-initio' : ro.entry,
      'cmi.core.total_time': ro.total_time || '0000:00:00.00', 'cmi.core.lesson_mode': ro.lesson_mode || 'normal',
      'cmi.launch_data': ro.launch_data || '', 'cmi.comments_from_lms': '',
      'cmi.student_data.mastery_score': ro.mastery_score === undefined ? '' : String(ro.mastery_score),
      'cmi.student_data.max_time_allowed': '', 'cmi.student_data.time_limit_action': '',
    };
    if (values['cmi.core.lesson_status'] === undefined) values['cmi.core.lesson_status'] = 'not attempted';
    var state = 'not_initialized'; // running, terminated
    var lastError = 0;
    var afterFinishMoodle = options.afterFinish === 'moodle';

    function count(prefix) {
      var max = -1;
      Object.keys(values).forEach(function (k) {
        if (k.indexOf(prefix + '.') !== 0) return;
        var n = Number(k.slice(prefix.length + 1).split('.')[0]);
        if (!isNaN(n) && n > max) max = n;
      });
      return max + 1;
    }
    function countPrefix(def, norm, element) {
      if (def.count === 'cmi.objectives' || def.count === 'cmi.interactions') return def.count;
      return element.replace(/\._count$/, ''); // nested: cmi.interactions.3.objectives
    }
    function open() { return state === 'running'; }
    function notOpenError() {
      if (state === 'not_initialized' || afterFinishMoodle) return 301;
      return 101;
    }
    function flat() {
      var out = {};
      Object.keys(values).forEach(function (k) { out[k] = values[k]; });
      return out;
    }

    return {
      LMSInitialize: function (param) {
        if (param !== '') { lastError = 201; return 'false'; }
        if (state === 'running' || (state === 'terminated' && !afterFinishMoodle)) { lastError = 101; return 'false'; }
        state = 'running'; lastError = 0; return 'true';
      },
      LMSFinish: function (param) {
        if (param !== '') { lastError = 201; return 'false'; }
        if (!open()) { lastError = notOpenError(); return 'false'; }
        state = 'terminated'; lastError = 0;
        if (options.onFinish) options.onFinish(flat());
        return 'true';
      },
      LMSCommit: function (param) {
        if (param !== '') { lastError = 201; return 'false'; }
        if (!open()) { lastError = notOpenError(); return 'false'; }
        lastError = 0;
        if (options.onCommit) options.onCommit(flat());
        return 'true';
      },
      LMSGetValue: function (element) {
        element = String(element);
        if (!open()) { lastError = notOpenError(); return ''; }
        if (element.indexOf('cmi.student_preference') === 0) { lastError = 401; return ''; }
        var norm = normalise(element);
        var def = MODEL[norm.pattern];
        if (!def) {
          lastError = /\._children$/.test(element) ? 202 : /\._count$/.test(element) ? 203 : 201;
          return '';
        }
        if (def.mode === 'w') { lastError = 404; return ''; }
        lastError = 0;
        if (def.value !== undefined) return def.value;
        if (def.count) return String(count(countPrefix(def, norm, element)));
        if (Object.prototype.hasOwnProperty.call(fixed, element)) return fixed[element];
        return values[element] === undefined ? '' : values[element];
      },
      LMSSetValue: function (element, value) {
        element = String(element); value = String(value);
        if (!open()) { lastError = notOpenError(); return 'false'; }
        if (element.indexOf('cmi.student_preference') === 0) { lastError = 401; return 'false'; }
        var norm = normalise(element);
        var def = MODEL[norm.pattern];
        if (!def) { lastError = 201; return 'false'; }
        if (def.keyword) { lastError = 402; return 'false'; }
        if (def.mode === 'r') { lastError = 403; return 'false'; }
        // A new array item must be the next index (SCORM 1.2: n <= _count).
        if (norm.indexes.length > 0) {
          var prefix = element.slice(0, element.indexOf('.' + norm.indexes[0] + '.'));
          if (norm.indexes[0] > count(prefix)) { lastError = 201; return 'false'; }
        }
        if (def.check && !def.check(value)) { lastError = 405; return 'false'; }
        values[element] = value; lastError = 0; return 'true';
      },
      LMSGetLastError: function () { return String(lastError); },
      LMSGetErrorString: function (code) { return ERRORS[Number(code)] || ''; },
      LMSGetDiagnostic: function (code) { return ERRORS[Number(code === '' || code === undefined ? lastError : code)] || ''; },
      // Not part of SCORM: for the runtime.
      _flat: flat,
      _state: function () { return state; },
    };
  }

  window.CogniateOwnScorm12 = { create: create };
})();
