// Moodle REST web services client (T8 course shell, app contract §11). Only these functions:
// core_webservice_get_site_info, core_course_get_courses_by_field, core_course_create_courses.
// The token goes in the POST body (not in the URL), every call goes through the guarded outbound client (security §9),
// and a Moodle exception answer becomes a MoodleWsError with Moodle's errorcode.
import type { OutboundClient } from '@cogniate/shared';

export const REQUIRED_WS_FUNCTIONS = ['core_webservice_get_site_info', 'core_course_get_courses_by_field', 'core_course_create_courses'] as const;

export class MoodleWsError extends Error {
  readonly errorcode: string;
  constructor(errorcode: string, message: string) {
    super(message);
    this.name = 'MoodleWsError';
    this.errorcode = errorcode;
  }
}

export interface MoodleCourse { id: number; idnumber: string; shortname: string; visible: number }

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function createMoodleWsClient(deps: { outbound: OutboundClient }) {
  async function call(siteUrl: string, token: string, fn: string, params: Record<string, string>, traceId: string): Promise<unknown> {
    let res;
    try {
      res = await deps.outbound.request(`${siteUrl}/webservice/rest/server.php`, {
        method: 'POST', traceId,
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body: new URLSearchParams({ wstoken: token, wsfunction: fn, moodlewsrestformat: 'json', ...params }).toString(),
      });
    } catch {
      throw new MoodleWsError('network_error', 'Moodle did not answer.');
    }
    let json: unknown;
    try {
      json = res.json();
    } catch {
      throw new MoodleWsError('bad_answer', `Moodle answered ${res.status} without JSON.`);
    }
    if (isRecord(json) && typeof json.exception === 'string') {
      throw new MoodleWsError(typeof json.errorcode === 'string' ? json.errorcode : 'exception', typeof json.message === 'string' ? json.message.slice(0, 200) : 'Moodle error');
    }
    if (res.status < 200 || res.status >= 300) throw new MoodleWsError('http_error', `Moodle answered ${res.status}.`);
    return json;
  }

  return {
    async siteInfo(siteUrl: string, token: string, traceId: string): Promise<{ siteName: string; release: string; functions: string[] }> {
      const j = await call(siteUrl, token, 'core_webservice_get_site_info', {}, traceId);
      if (!isRecord(j)) throw new MoodleWsError('bad_answer', 'Unexpected site info.');
      const functions = Array.isArray(j.functions) ? j.functions.map((f) => (isRecord(f) ? String(f.name) : '')).filter(Boolean) : [];
      return { siteName: String(j.sitename ?? ''), release: String(j.release ?? ''), functions };
    },
    async courseByIdnumber(siteUrl: string, token: string, idnumber: string, traceId: string): Promise<MoodleCourse | null> {
      const j = await call(siteUrl, token, 'core_course_get_courses_by_field', { field: 'idnumber', value: idnumber }, traceId);
      const list = isRecord(j) && Array.isArray(j.courses) ? j.courses : [];
      const c = list.find((x) => isRecord(x) && x.idnumber === idnumber);
      return isRecord(c) ? { id: Number(c.id), idnumber: String(c.idnumber), shortname: String(c.shortname), visible: Number(c.visible) } : null;
    },
    async createCourse(siteUrl: string, token: string, c: { fullname: string; shortname: string; idnumber: string; categoryId: number }, traceId: string): Promise<number> {
      const j = await call(siteUrl, token, 'core_course_create_courses', {
        'courses[0][fullname]': c.fullname, 'courses[0][shortname]': c.shortname, 'courses[0][idnumber]': c.idnumber,
        'courses[0][categoryid]': String(c.categoryId), 'courses[0][visible]': '0',
      }, traceId);
      const id = Array.isArray(j) && isRecord(j[0]) ? Number(j[0].id) : NaN;
      if (!Number.isInteger(id) || id <= 0) throw new MoodleWsError('bad_answer', 'Moodle did not return the new course id.');
      return id;
    },
  };
}

export type MoodleWsClient = ReturnType<typeof createMoodleWsClient>;
