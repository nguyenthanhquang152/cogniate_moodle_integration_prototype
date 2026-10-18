// SCORM 1.2 commit values (app contract §7 "value rules"). The commit body carries the full CMI of the session as
// nested JSON. checkScormCmi() validates it and returns a normalized copy with only the known elements, or the
// first element that breaks a rule (details.field of 400 INVALID_CMI). Values are strings, as in SCORM 1.2.

export const LESSON_STATUS = ['passed', 'completed', 'failed', 'incomplete', 'browsed', 'not attempted'] as const;
export const EXIT_VALUES = ['time-out', 'suspend', 'logout', ''] as const;
export const INTERACTION_TYPES = ['true-false', 'choice', 'fill-in', 'matching', 'performance', 'sequencing', 'likert', 'numeric'] as const;
export const INTERACTION_RESULTS = ['correct', 'wrong', 'unanticipated', 'neutral'] as const;
export const MAX_INTERACTIONS = 250;
export const MAX_OBJECTIVES = 250;

/** Length limits of contract §7 (also the player's LMSSetValue checks, B-T5a-02). */
export const MAX_LOCATION = 255;
export const MAX_SUSPEND_DATA = 4096;
export const MAX_IDENTIFIER = 255;

const DECIMAL = /^-?\d{1,10}(\.\d{1,10})?$/;
const TIMESPAN = /^\d{2,4}:[0-5]\d:[0-5]\d(\.\d{1,2})?$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{1,2})?$/;

/** CMIDecimal, CMITimespan (`HH[HH]:MM:SS[.S[S]]`) and CMITime (`HH:MM:SS[.S[S]]`) of SCORM 1.2. */
export const isDecimal = (v: string): boolean => DECIMAL.test(v);
export const isTimespan = (v: string): boolean => TIMESPAN.test(v);
export const isTime = (v: string): boolean => TIME.test(v);

export interface ScormScore { raw: string; min: string; max: string }

export interface ScormInteraction {
  id: string;
  objectives: Array<{ id: string }>;
  time: string;
  type: string;
  correct_responses: Array<{ pattern: string }>;
  weighting: string;
  student_response: string;
  result: string;
  latency: string;
}

export interface ScormObjective { id: string; score: ScormScore; status: string }

export interface ScormCmi {
  core: { lesson_status: string; lesson_location: string; score: ScormScore; session_time: string; exit: string };
  suspend_data: string;
  comments: string;
  interactions: ScormInteraction[];
  objectives: ScormObjective[];
}

export type CmiCheck = { ok: true; cmi: ScormCmi } | { ok: false; field: string };

/** A score value: "" or a decimal from 0 to 100. */
export const isScore = (v: string): boolean => v === '' || (DECIMAL.test(v) && Number(v) >= 0 && Number(v) <= 100);

class Bad extends Error {
  readonly field: string;
  constructor(field: string) {
    super(field);
    this.field = field;
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** An optional string element: absent -> "". */
function text(obj: Record<string, unknown>, key: string, field: string, rule: (v: string) => boolean = () => true): string {
  const v = obj[key];
  if (v === undefined) return '';
  if (typeof v !== 'string' || !rule(v)) throw new Bad(field);
  return v;
}

const maxLen = (n: number) => (v: string) => v.length <= n;
const oneOf = (list: readonly string[]) => (v: string) => list.includes(v);

function score(obj: Record<string, unknown>, key: string, field: string): ScormScore {
  const s = obj[key];
  if (s === undefined) return { raw: '', min: '', max: '' };
  if (!isRecord(s)) throw new Bad(field);
  return { raw: text(s, 'raw', `${field}.raw`, isScore), min: text(s, 'min', `${field}.min`, isScore), max: text(s, 'max', `${field}.max`, isScore) };
}

function list(obj: Record<string, unknown>, key: string, field: string, max: number): unknown[] {
  const v = obj[key];
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.length > max) throw new Bad(field);
  return v;
}

function interaction(v: unknown, field: string): ScormInteraction {
  if (!isRecord(v)) throw new Bad(field);
  const ids = (name: string, sub: string) => list(v, name, `${field}.${name}`, MAX_INTERACTIONS).map((o, i) => {
    if (!isRecord(o)) throw new Bad(`${field}.${name}.${i}`);
    return text(o, sub, `${field}.${name}.${i}.${sub}`, maxLen(MAX_IDENTIFIER));
  });
  return {
    id: text(v, 'id', `${field}.id`, maxLen(MAX_IDENTIFIER)),
    objectives: ids('objectives', 'id').map((id) => ({ id })),
    time: text(v, 'time', `${field}.time`, (t) => t === '' || TIME.test(t)),
    type: text(v, 'type', `${field}.type`, (t) => t === '' || oneOf(INTERACTION_TYPES)(t)),
    correct_responses: ids('correct_responses', 'pattern').map((pattern) => ({ pattern })),
    weighting: text(v, 'weighting', `${field}.weighting`, (t) => t === '' || DECIMAL.test(t)),
    student_response: text(v, 'student_response', `${field}.student_response`, maxLen(MAX_IDENTIFIER)),
    result: text(v, 'result', `${field}.result`, (t) => t === '' || oneOf(INTERACTION_RESULTS)(t) || DECIMAL.test(t)),
    latency: text(v, 'latency', `${field}.latency`, (t) => t === '' || TIMESPAN.test(t)),
  };
}

function objective(v: unknown, field: string): ScormObjective {
  if (!isRecord(v)) throw new Bad(field);
  return {
    id: text(v, 'id', `${field}.id`, maxLen(MAX_IDENTIFIER)),
    score: score(v, 'score', `${field}.score`),
    status: text(v, 'status', `${field}.status`, (t) => t === '' || oneOf(LESSON_STATUS)(t)),
  };
}

/** App contract §7 value rules for a SCORM 1.2 commit. */
export function checkScormCmi(input: unknown): CmiCheck {
  try {
    if (!isRecord(input)) throw new Bad('cmi');
    const core = input.core === undefined ? {} : input.core;
    if (!isRecord(core)) throw new Bad('cmi.core');
    const cmi: ScormCmi = {
      core: {
        lesson_status: text(core, 'lesson_status', 'cmi.core.lesson_status', (v) => v === '' || oneOf(LESSON_STATUS)(v)),
        lesson_location: text(core, 'lesson_location', 'cmi.core.lesson_location', maxLen(MAX_LOCATION)),
        score: score(core, 'score', 'cmi.core.score'),
        session_time: text(core, 'session_time', 'cmi.core.session_time', (v) => v === '' || TIMESPAN.test(v)),
        exit: text(core, 'exit', 'cmi.core.exit', oneOf(EXIT_VALUES)),
      },
      suspend_data: text(input, 'suspend_data', 'cmi.suspend_data', maxLen(MAX_SUSPEND_DATA)),
      comments: text(input, 'comments', 'cmi.comments', maxLen(MAX_SUSPEND_DATA)),
      interactions: list(input, 'interactions', 'cmi.interactions', MAX_INTERACTIONS).map((v, i) => interaction(v, `cmi.interactions.${i}`)),
      objectives: list(input, 'objectives', 'cmi.objectives', MAX_OBJECTIVES).map((v, i) => objective(v, `cmi.objectives.${i}`)),
    };
    return { ok: true, cmi };
  } catch (err) {
    if (err instanceof Bad) return { ok: false, field: err.field };
    throw err;
  }
}
