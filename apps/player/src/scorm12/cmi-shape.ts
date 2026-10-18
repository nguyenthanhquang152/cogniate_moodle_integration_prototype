// Flat SCORM element names (the API) <-> the nested CMI of RuntimeState and of the commit body (app contract §7).
import type { ScormCmi } from '@cogniate/tracking';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

/** Saved values of RuntimeState.scorm.cmi -> flat values for the API (exit and session_time are never carried over). */
export function flattenSaved(saved: unknown): Map<string, string> {
  const out = new Map<string, string>();
  if (!isRecord(saved)) return out;
  const put = (key: string, v: unknown) => {
    const s = str(v);
    if (s !== undefined && s !== '') out.set(key, s);
  };
  const core = isRecord(saved.core) ? saved.core : {};
  put('cmi.core.lesson_status', core.lesson_status);
  put('cmi.core.lesson_location', core.lesson_location);
  const sc = isRecord(core.score) ? core.score : {};
  for (const k of ['raw', 'min', 'max']) put(`cmi.core.score.${k}`, sc[k]);
  put('cmi.suspend_data', saved.suspend_data);
  put('cmi.comments', saved.comments);
  (Array.isArray(saved.interactions) ? saved.interactions : []).forEach((it, i) => {
    if (!isRecord(it)) return;
    const p = `cmi.interactions.${i}`;
    for (const k of ['id', 'time', 'type', 'weighting', 'student_response', 'result', 'latency']) put(`${p}.${k}`, it[k]);
    (Array.isArray(it.objectives) ? it.objectives : []).forEach((o, j) => put(`${p}.objectives.${j}.id`, isRecord(o) ? o.id : undefined));
    (Array.isArray(it.correct_responses) ? it.correct_responses : []).forEach((o, j) => put(`${p}.correct_responses.${j}.pattern`, isRecord(o) ? o.pattern : undefined));
  });
  (Array.isArray(saved.objectives) ? saved.objectives : []).forEach((ob, i) => {
    if (!isRecord(ob)) return;
    const p = `cmi.objectives.${i}`;
    put(`${p}.id`, ob.id);
    put(`${p}.status`, ob.status);
    const os = isRecord(ob.score) ? ob.score : {};
    for (const k of ['raw', 'min', 'max']) put(`${p}.score.${k}`, os[k]);
  });
  return out;
}

/** Items of an array prefix, in index order. */
function items(values: ReadonlyMap<string, string>, prefix: string): number[] {
  const found = new Set<number>();
  for (const key of values.keys()) {
    if (!key.startsWith(`${prefix}.`)) continue;
    const n = Number(key.slice(prefix.length + 1).split('.')[0]);
    if (Number.isInteger(n)) found.add(n);
  }
  return [...found].sort((a, b) => a - b);
}

/** Flat API values -> the nested `cmi` of a commit body. */
export function toCommitCmi(values: ReadonlyMap<string, string>): ScormCmi {
  const g = (key: string) => values.get(key) ?? '';
  return {
    core: {
      lesson_status: g('cmi.core.lesson_status'), lesson_location: g('cmi.core.lesson_location'),
      score: { raw: g('cmi.core.score.raw'), min: g('cmi.core.score.min'), max: g('cmi.core.score.max') },
      session_time: g('cmi.core.session_time'), exit: g('cmi.core.exit'),
    },
    suspend_data: g('cmi.suspend_data'),
    comments: g('cmi.comments'),
    interactions: items(values, 'cmi.interactions').map((i) => {
      const p = `cmi.interactions.${i}`;
      return {
        id: g(`${p}.id`), time: g(`${p}.time`), type: g(`${p}.type`), weighting: g(`${p}.weighting`), student_response: g(`${p}.student_response`),
        result: g(`${p}.result`), latency: g(`${p}.latency`),
        objectives: items(values, `${p}.objectives`).map((j) => ({ id: g(`${p}.objectives.${j}.id`) })),
        correct_responses: items(values, `${p}.correct_responses`).map((j) => ({ pattern: g(`${p}.correct_responses.${j}.pattern`) })),
      };
    }),
    objectives: items(values, 'cmi.objectives').map((i) => {
      const p = `cmi.objectives.${i}`;
      return { id: g(`${p}.id`), status: g(`${p}.status`), score: { raw: g(`${p}.score.raw`), min: g(`${p}.score.min`), max: g(`${p}.score.max`) } };
    }),
  };
}
