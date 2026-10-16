// Moodle REST web services client. The token goes in the POST body only. Errors never contain the token.
import { publicUrls } from './env';
import { httpsRequest } from './https';

export class MoodleWsError extends Error {
  constructor(
    readonly wsFunction: string,
    readonly errorcode: string,
    message: string,
  ) {
    super(`${wsFunction}: ${errorcode}: ${message}`);
    this.name = 'MoodleWsError';
  }
}

export type WsParams = Record<string, unknown>;

/** { values: ['a'] } → values[0]=a ; { courses: [{ fullname: 'x' }] } → courses[0][fullname]=x */
export function flattenParams(params: WsParams, prefix = '', out: [string, string][] = []): [string, string][] {
  for (const [key, value] of Object.entries(params)) {
    const name = prefix ? `${prefix}[${key}]` : key;
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item !== null && typeof item === 'object') flattenParams(item as WsParams, `${name}[${i}]`, out);
        else out.push([`${name}[${i}]`, String(item)]);
      });
    } else if (typeof value === 'object') {
      flattenParams(value as WsParams, name, out);
    } else {
      out.push([name, String(value)]);
    }
  }
  return out;
}

export async function callWs<T = unknown>(
  token: string,
  wsfunction: string,
  params: WsParams = {},
  moodleUrl = publicUrls().moodle,
): Promise<T> {
  const body = new URLSearchParams([
    ['wstoken', token],
    ['wsfunction', wsfunction],
    ['moodlewsrestformat', 'json'],
    ...flattenParams(params),
  ]).toString();
  const res = await httpsRequest(`${moodleUrl}/webservice/rest/server.php`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'content-length': String(Buffer.byteLength(body)) },
    body,
  });
  if (res.status !== 200) throw new Error(`${wsfunction}: HTTP ${res.status}`);
  let data: unknown;
  try {
    data = JSON.parse(res.body);
  } catch {
    throw new Error(`${wsfunction}: the response is not JSON: ${res.body.slice(0, 200)}`);
  }
  if (data !== null && typeof data === 'object' && 'exception' in data) {
    const e = data as { errorcode?: string; message?: string };
    throw new MoodleWsError(wsfunction, e.errorcode ?? 'unknown', e.message ?? '');
  }
  return data as T;
}

export interface SiteInfo {
  sitename: string;
  username: string;
  fullname: string;
  userid: number;
  release: string;
  siteurl: string;
  functions: { name: string; version: string }[];
}

export interface WsCourse {
  id: number;
  shortname: string;
  fullname: string;
  format: string;
  visible: number;
  enablecompletion: number;
}

export interface EnrolledUser {
  id: number;
  username?: string;
  fullname: string;
  roles?: { roleid: number; shortname: string; name: string }[];
}

/** The 9 functions of the product service (spike §3, AC-T1-06). */
export const PRODUCT_WS_FUNCTIONS = [
  'core_webservice_get_site_info',
  'core_course_create_courses',
  'core_course_get_courses_by_field',
  'core_course_get_contents',
  'core_course_get_categories',
  'core_course_create_categories',
  'enrol_manual_enrol_users',
  'core_user_create_users',
  'core_user_get_users_by_field',
] as const;

/** Functions of the QA-only oracle service (hook H4). */
export const ORACLE_WS_FUNCTIONS = [
  'gradereport_user_get_grade_items',
  'core_completion_get_activities_completion_status',
  'core_enrol_get_enrolled_users',
  'core_course_get_contents',
  'core_course_update_courses',
  'core_course_get_courses_by_field',
] as const;

/** Oracle functions that must NOT be in the product service (the product service must not grow). */
export const ORACLE_ONLY_FUNCTIONS = ORACLE_WS_FUNCTIONS.filter(
  (f) => !(PRODUCT_WS_FUNCTIONS as readonly string[]).includes(f),
);

export interface GradeItem {
  id: number;
  itemname: string | null;
  itemtype: string;
  itemmodule: string | null;
  cmid?: number;
  graderaw: number | null;
  grademax: number;
}

/** Grade items of one user in one course (QA oracle `gradereport_user_get_grade_items`). */
export async function gradeItems(oracleToken: string, courseId: number, userId: number): Promise<GradeItem[]> {
  const res = await callWs<{ usergrades: { userid: number; gradeitems: GradeItem[] }[] }>(oracleToken, 'gradereport_user_get_grade_items', {
    courseid: courseId,
    userid: userId,
  });
  return res.usergrades.find((u) => u.userid === userId)?.gradeitems ?? [];
}
