// Our own SCORM 1.2 API subset (app contract §8, ADR-004, T5-spike decision). One runtime page load = one session.
// After LMSFinish every call answers 101, and LMSInitialize is not allowed again in the same page load.
// Element values are kept in a Map: element names come from the package (A-T4a-07: never plain-object keys).

export type ApiState = 'not_initialized' | 'running' | 'terminated';

export const ERROR_STRINGS: ReadonlyMap<number, string> = new Map([
  [0, 'No error'], [101, 'General exception'], [201, 'Invalid argument error'], [202, 'Element cannot have children'],
  [203, 'Element not an array - cannot have count'], [301, 'Not initialized'], [401, 'Not implemented error'],
  [402, 'Invalid set value, element is a keyword'], [403, 'Element is read only'], [404, 'Element is write only'], [405, 'Incorrect data type'],
]);

const STATUS = ['passed', 'completed', 'failed', 'incomplete', 'browsed', 'not attempted'];
const EXIT = ['time-out', 'suspend', 'logout', ''];
const INTERACTION_TYPES = ['true-false', 'choice', 'fill-in', 'matching', 'performance', 'sequencing', 'likert', 'numeric'];
const RESULTS = ['correct', 'wrong', 'unanticipated', 'neutral'];
const DECIMAL = /^-?\d+(\.\d+)?$/;
const TIMESPAN = /^\d{2,4}:[0-5]\d:[0-5]\d(\.\d{1,2})?$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{1,2})?$/;

type Check = (v: string) => boolean;
const maxLen = (n: number): Check => (v) => v.length <= n;
const oneOf = (list: readonly string[]): Check => (v) => list.includes(v);
const score: Check = (v) => v === '' || (DECIMAL.test(v) && Number(v) >= 0 && Number(v) <= 100);

interface Element {
  mode: 'r' | 'w' | 'rw';
  /** _children and _count: read only, a write gives 402. */
  keyword?: boolean;
  /** Fixed value (_children lists). */
  value?: string;
  /** _count of an array: the array prefix comes from the element name. */
  count?: boolean;
  check?: Check;
}

/** The SCORM 1.2 data model of contract §8. `n` stands for an array index. */
const MODEL: ReadonlyMap<string, Element> = new Map<string, Element>([
  ['cmi.core._children', { mode: 'r', keyword: true, value: 'student_id,student_name,lesson_location,credit,lesson_status,entry,score,total_time,lesson_mode,exit,session_time' }],
  ['cmi.core.score._children', { mode: 'r', keyword: true, value: 'raw,min,max' }],
  ['cmi.core.student_id', { mode: 'r' }],
  ['cmi.core.student_name', { mode: 'r' }],
  ['cmi.core.lesson_location', { mode: 'rw', check: maxLen(255) }],
  ['cmi.core.credit', { mode: 'r' }],
  // Setting "not attempted" gives 405 (contract §8).
  ['cmi.core.lesson_status', { mode: 'rw', check: (v) => STATUS.includes(v) && v !== 'not attempted' }],
  ['cmi.core.entry', { mode: 'r' }],
  ['cmi.core.score.raw', { mode: 'rw', check: score }],
  ['cmi.core.score.min', { mode: 'rw', check: score }],
  ['cmi.core.score.max', { mode: 'rw', check: score }],
  ['cmi.core.total_time', { mode: 'r' }],
  ['cmi.core.lesson_mode', { mode: 'r' }],
  ['cmi.core.exit', { mode: 'w', check: oneOf(EXIT) }],
  ['cmi.core.session_time', { mode: 'w', check: (v) => TIMESPAN.test(v) }],
  ['cmi.suspend_data', { mode: 'rw', check: maxLen(4096) }],
  ['cmi.launch_data', { mode: 'r' }],
  ['cmi.comments', { mode: 'rw', check: maxLen(4096) }],
  ['cmi.comments_from_lms', { mode: 'r' }],
  ['cmi.student_data._children', { mode: 'r', keyword: true, value: 'mastery_score,max_time_allowed,time_limit_action' }],
  ['cmi.student_data.mastery_score', { mode: 'r' }],
  ['cmi.student_data.max_time_allowed', { mode: 'r' }],
  ['cmi.student_data.time_limit_action', { mode: 'r' }],
  ['cmi.objectives._children', { mode: 'r', keyword: true, value: 'id,score,status' }],
  ['cmi.objectives._count', { mode: 'r', keyword: true, count: true }],
  ['cmi.objectives.n.id', { mode: 'rw', check: maxLen(255) }],
  ['cmi.objectives.n.score._children', { mode: 'r', keyword: true, value: 'raw,min,max' }],
  ['cmi.objectives.n.score.raw', { mode: 'rw', check: score }],
  ['cmi.objectives.n.score.min', { mode: 'rw', check: score }],
  ['cmi.objectives.n.score.max', { mode: 'rw', check: score }],
  ['cmi.objectives.n.status', { mode: 'rw', check: oneOf(STATUS) }],
  ['cmi.interactions._children', { mode: 'r', keyword: true, value: 'id,objectives,time,type,correct_responses,weighting,student_response,result,latency' }],
  ['cmi.interactions._count', { mode: 'r', keyword: true, count: true }],
  ['cmi.interactions.n.id', { mode: 'w', check: maxLen(255) }],
  ['cmi.interactions.n.objectives._count', { mode: 'r', keyword: true, count: true }],
  ['cmi.interactions.n.objectives.n.id', { mode: 'w', check: maxLen(255) }],
  ['cmi.interactions.n.time', { mode: 'w', check: (v) => TIME.test(v) }],
  ['cmi.interactions.n.type', { mode: 'w', check: oneOf(INTERACTION_TYPES) }],
  ['cmi.interactions.n.correct_responses._count', { mode: 'r', keyword: true, count: true }],
  ['cmi.interactions.n.correct_responses.n.pattern', { mode: 'w', check: maxLen(255) }],
  ['cmi.interactions.n.weighting', { mode: 'w', check: (v) => v === '' || DECIMAL.test(v) }],
  ['cmi.interactions.n.student_response', { mode: 'w', check: maxLen(255) }],
  ['cmi.interactions.n.result', { mode: 'w', check: (v) => RESULTS.includes(v) || DECIMAL.test(v) }],
  ['cmi.interactions.n.latency', { mode: 'w', check: (v) => TIMESPAN.test(v) }],
]);

/** Read-only values of the session (RuntimeState). */
export interface ReadOnlyValues {
  studentId: string;
  studentName: string;
  credit: 'credit' | 'no-credit';
  entry: string;
  totalTime: string;
  masteryScore: string;
  launchData: string;
}

export interface Scorm12Options {
  /** Saved values of the attempt (flat element names, for example "cmi.suspend_data"). */
  saved: ReadonlyMap<string, string>;
  readOnly: ReadOnlyValues;
  onCommit: (values: ReadonlyMap<string, string>) => void;
  onFinish: (values: ReadonlyMap<string, string>) => void;
}

/** The eight SCORM 1.2 functions (what the package finds as window.API). */
export interface Scorm12Api {
  LMSInitialize(param?: unknown): string;
  LMSFinish(param?: unknown): string;
  LMSGetValue(element?: unknown): string;
  LMSSetValue(element?: unknown, value?: unknown): string;
  LMSCommit(param?: unknown): string;
  LMSGetLastError(): string;
  LMSGetErrorString(code?: unknown): string;
  LMSGetDiagnostic(code?: unknown): string;
}

/** "cmi.interactions.3.objectives.0.id" -> pattern "cmi.interactions.n.objectives.n.id" and the indexes [3, 0]. */
function normalise(element: string): { pattern: string; indexes: number[] } {
  const indexes: number[] = [];
  const pattern = element.replace(/\.(\d+)(?=\.|$)/g, (_m, n: string) => {
    indexes.push(Number(n));
    return '.n';
  });
  return { pattern, indexes };
}

const arg = (v: unknown): string => (v === undefined || v === null ? '' : String(v));

export function createScorm12Api(options: Scorm12Options): { api: Scorm12Api; values: () => Map<string, string>; state: () => ApiState } {
  const ro = options.readOnly;
  const values = new Map(options.saved);
  if (!values.get('cmi.core.lesson_status')) values.set('cmi.core.lesson_status', 'not attempted');
  const fixed = new Map<string, string>([
    ['cmi.core.student_id', ro.studentId], ['cmi.core.student_name', ro.studentName], ['cmi.core.credit', ro.credit],
    ['cmi.core.entry', ro.entry], ['cmi.core.total_time', ro.totalTime], ['cmi.core.lesson_mode', 'normal'],
    ['cmi.launch_data', ro.launchData], ['cmi.comments_from_lms', ''], ['cmi.student_data.mastery_score', ro.masteryScore],
    ['cmi.student_data.max_time_allowed', ''], ['cmi.student_data.time_limit_action', ''],
  ]);
  let state: ApiState = 'not_initialized';
  let lastError = 0;

  /** Number of items of an array prefix ("cmi.interactions", "cmi.interactions.3.objectives"). */
  const count = (prefix: string): number => {
    let max = -1;
    for (const key of values.keys()) {
      if (!key.startsWith(`${prefix}.`)) continue;
      const n = Number(key.slice(prefix.length + 1).split('.')[0]);
      if (Number.isInteger(n) && n > max) max = n;
    }
    return max + 1;
  };
  /** The session is not open: 301 before LMSInitialize, 101 after LMSFinish. */
  const closed = (): number => (state === 'not_initialized' ? 301 : 101);
  const fail = (code: number, ret: string): string => {
    lastError = code;
    return ret;
  };
  const control = (param: unknown, run: () => void): string => {
    if (state !== 'running') return fail(closed(), 'false');
    if (arg(param) !== '') return fail(201, 'false');
    lastError = 0;
    run();
    return 'true';
  };

  const api: Scorm12Api = {
    LMSInitialize(param) {
      if (state !== 'not_initialized') return fail(101, 'false');
      if (arg(param) !== '') return fail(201, 'false');
      state = 'running';
      lastError = 0;
      return 'true';
    },
    LMSFinish(param) {
      return control(param, () => {
        state = 'terminated';
        options.onFinish(new Map(values));
      });
    },
    LMSCommit(param) {
      return control(param, () => options.onCommit(new Map(values)));
    },
    LMSGetValue(el) {
      if (state !== 'running') return fail(closed(), '');
      const element = arg(el);
      if (element.startsWith('cmi.student_preference')) return fail(401, '');
      const { pattern } = normalise(element);
      const def = MODEL.get(pattern);
      if (!def) return fail(element.endsWith('._children') ? 202 : element.endsWith('._count') ? 203 : 201, '');
      if (def.mode === 'w') return fail(404, '');
      lastError = 0;
      if (def.value !== undefined) return def.value;
      if (def.count) return String(count(element.slice(0, -'._count'.length)));
      return fixed.get(element) ?? values.get(element) ?? '';
    },
    LMSSetValue(el, v) {
      if (state !== 'running') return fail(closed(), 'false');
      const element = arg(el);
      const value = arg(v);
      if (element.startsWith('cmi.student_preference')) return fail(401, 'false');
      const { pattern, indexes } = normalise(element);
      const def = MODEL.get(pattern);
      if (!def) return fail(201, 'false');
      if (def.keyword) return fail(402, 'false');
      if (def.mode === 'r') return fail(403, 'false');
      // A new array item must be the next index at each level (SCORM 1.2: n <= _count).
      let prefix = '';
      let rest = element;
      for (const n of indexes) {
        const at = rest.indexOf(`.${n}`);
        prefix += rest.slice(0, at);
        if (n > count(prefix)) return fail(201, 'false');
        prefix += `.${n}`;
        rest = rest.slice(at + `.${n}`.length);
      }
      if (def.check && !def.check(value)) return fail(405, 'false');
      values.set(element, value);
      lastError = 0;
      return 'true';
    },
    LMSGetLastError: () => String(lastError),
    LMSGetErrorString: (code) => ERROR_STRINGS.get(Number(code)) ?? '',
    LMSGetDiagnostic: (code) => ERROR_STRINGS.get(arg(code) === '' ? lastError : Number(code)) ?? '',
  };
  return { api, values: () => new Map(values), state: () => state };
}
