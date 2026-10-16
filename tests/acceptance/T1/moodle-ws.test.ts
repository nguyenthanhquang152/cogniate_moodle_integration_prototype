// T1 in-container: Moodle web services, seed data, courses and enrolments.
// Source: T1.md AC-T1-06, AC-T1-08, AC-T1-10 (course set), AC-T1-12 (no duplicates); hooks H2 (seed.json), H4 (oracle).
import { describe, expect, it } from 'vitest';
import { publicUrls } from '../lib/env';
import {
  callWs,
  type EnrolledUser,
  MoodleWsError,
  ORACLE_ONLY_FUNCTIONS,
  ORACLE_WS_FUNCTIONS,
  PRODUCT_WS_FUNCTIONS,
  type SiteInfo,
  type WsCourse,
} from '../lib/moodle-ws';
import { COURSE_SHORTNAMES, MOODLE_USERNAMES, seed } from '../lib/seed';

const urls = publicUrls();

async function coursesByShortname(shortname: string): Promise<WsCourse[]> {
  const res = await callWs<{ courses: WsCourse[] }>(seed().oracleToken, 'core_course_get_courses_by_field', {
    field: 'shortname',
    value: shortname,
  });
  return res.courses;
}

async function enrolled(courseId: number): Promise<EnrolledUser[]> {
  return callWs<EnrolledUser[]>(seed().oracleToken, 'core_enrol_get_enrolled_users', { courseid: courseId });
}

const roleNames = (u: EnrolledUser | undefined) => (u?.roles ?? []).map((r) => r.shortname).sort();

describe('T1 seed data (H2)', () => {
  it('H2 seed.json lists the four Moodle users, both course ids and two different WS tokens', () => {
    const s = seed();
    for (const name of MOODLE_USERNAMES) {
      expect(s.users[name].password.length, `${name} password`).toBeGreaterThan(0);
      expect(s.users[name].id, `${name} id`).toBeGreaterThan(0);
    }
    expect(new Set(MOODLE_USERNAMES.map((n) => s.users[n].id)).size).toBe(MOODLE_USERNAMES.length);
    expect(s.courses['COGNIATE-DEV-101']).not.toBe(s.courses['COGNIATE-DEV-102']);
    expect(s.productToken).not.toBe(s.oracleToken);
  });

  it('H2 seed.json user ids of cg_teacher, cg_student and cg_student2 match Moodle', async () => {
    const s = seed();
    const names = MOODLE_USERNAMES.filter((n) => n !== 'admin'); // admin id: checked by the host runner login (testsession)
    const users = await callWs<{ id: number; username: string }[]>(s.productToken, 'core_user_get_users_by_field', {
      field: 'username',
      values: names,
    });
    for (const name of names) {
      expect(users.find((u) => u.username === name)?.id, name).toBe(s.users[name].id);
    }
  });
});

describe('T1 web services', () => {
  it('AC-T1-06 core_webservice_get_site_info with the product token: release 5.2, siteurl = Moodle URL, the 9 functions', async () => {
    const info = await callWs<SiteInfo>(seed().productToken, 'core_webservice_get_site_info');
    expect(info.release).toMatch(/^5\.2/);
    expect(info.siteurl.replace(/\/+$/, '')).toBe(urls.moodle);
    const names = info.functions.map((f) => f.name);
    for (const fn of PRODUCT_WS_FUNCTIONS) expect(names, fn).toContain(fn);
    // The product service must not get the QA oracle functions (Q-T0-04).
    for (const fn of ORACLE_ONLY_FUNCTIONS) expect(names, `${fn} must not be in the product service`).not.toContain(fn);
    const extra = names.filter((n) => !(PRODUCT_WS_FUNCTIONS as readonly string[]).includes(n));
    if (extra.length > 0) console.info(`AC-T1-06 note: product service has extra functions: ${extra.join(', ')}`);
  });

  it('AC-T1-06 an unknown token gets errorcode invalidtoken', async () => {
    const fake = Array.from({ length: 32 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
    const err = await callWs(fake, 'core_webservice_get_site_info').then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(MoodleWsError);
    expect((err as MoodleWsError).errorcode).toBe('invalidtoken');
  });

  // The approved oracle service has no core_webservice_get_site_info, so this test does not use it.
  // Moodle checks "function in the token's service" before it checks parameters: a call with no parameters
  // gives accessexception if the function is not in the service, and invalidparameter (or a result) if it is.
  // No call below writes data: core_course_update_courses without `courses` fails parameter validation.
  it('H4 the QA oracle token can call every oracle function; the product token cannot call the oracle-only ones', async () => {
    const s = seed();
    const errorOf = (token: string, fn: string) =>
      callWs(token, fn, {}).then(
        () => null,
        (e: unknown) => e,
      );
    for (const fn of ORACLE_WS_FUNCTIONS) {
      const err = await errorOf(s.oracleToken, fn);
      if (err !== null) {
        expect(err, fn).toBeInstanceOf(MoodleWsError);
        expect((err as MoodleWsError).errorcode, `${fn} must be in the oracle service`).not.toBe('accessexception');
      }
    }
    for (const fn of ORACLE_ONLY_FUNCTIONS) {
      const err = await errorOf(s.productToken, fn);
      expect(err, fn).toBeInstanceOf(MoodleWsError);
      expect((err as MoodleWsError).errorcode, `${fn} must not be in the product service`).toBe('accessexception');
    }
  });
});

describe('T1 courses and enrolments', () => {
  for (const shortname of COURSE_SHORTNAMES) {
    it(`AC-T1-08 ${shortname} exists once, has the seed.json id, and completion tracking is on`, async () => {
      const courses = await coursesByShortname(shortname);
      expect(courses).toHaveLength(1);
      expect(courses[0].id).toBe(seed().courses[shortname]);
      expect(courses[0].enablecompletion).toBe(1);
    });

    it(`AC-T1-08 ${shortname}: cg_teacher is editingteacher; cg_student and cg_student2 are students`, async () => {
      const s = seed();
      const users = await enrolled(s.courses[shortname]);
      const byId = (name: (typeof MOODLE_USERNAMES)[number]) => users.find((u) => u.id === s.users[name].id);
      expect(roleNames(byId('cg_teacher'))).toContain('editingteacher');
      for (const name of ['cg_student', 'cg_student2'] as const) {
        expect(roleNames(byId(name)), name).toContain('student');
        expect(roleNames(byId(name)), name).not.toContain('editingteacher');
      }
    });

    it(`AC-T1-12 ${shortname}: each seeded user is enrolled once and has each role once`, async () => {
      const s = seed();
      const users = await enrolled(s.courses[shortname]);
      for (const name of ['cg_teacher', 'cg_student', 'cg_student2'] as const) {
        const rows = users.filter((u) => u.id === s.users[name].id);
        expect(rows, name).toHaveLength(1);
        const roles = roleNames(rows[0]);
        expect(new Set(roles).size, `${name} roles ${roles.join(',')}`).toBe(roles.length);
      }
    });
  }

  it('AC-T1-10 the site has only the site course, COGNIATE-DEV-101 and COGNIATE-DEV-102', async () => {
    const res = await callWs<{ courses: WsCourse[] }>(seed().oracleToken, 'core_course_get_courses_by_field');
    const site = res.courses.filter((c) => c.format === 'site');
    const others = res.courses.filter((c) => c.format !== 'site').map((c) => c.shortname).sort();
    expect(site.length).toBeLessThanOrEqual(1);
    expect(others).toEqual([...COURSE_SHORTNAMES].sort());
  });
});
