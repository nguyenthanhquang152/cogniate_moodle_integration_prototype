// T4a: mock session and the two real course packages. Source: tasks/T4a.md AC-T4-01, AC-T4-03, AC-T4-04;
// contract cogniate-app-api.md §2, §3 (report rules), §3.1.
import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { appApi, createCourse, portalUser, SESSION_COOKIE, signIn, THANH, uploadVersion } from '../lib/app';
import { courseZipCopy } from '../lib/course-fixtures';

const runId = `${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;
const S3 = 'cogniate-prod-ai-course-creation.s3.ap-southeast-1.amazonaws.com';
const QUESTION = '01M2M36Y89M9KPPZENF1ZW4AWJ';

interface Version {
  format: string;
  report: {
    entryPath: string;
    fileCount: number;
    totalBytes: number;
    externalHosts: string[];
    scorm: { schemaVersion: string; masteryScore: number; scoCount: number } | null;
    html: { pages: string[]; menuPage: string; questionIds: string[] } | null;
  };
  trackingProfile: { questionIds: string[]; masteryScore: number | null };
}

describe('T4a session', () => {
  it("AC-T4-01 Thanh signs in (204 + __Host-cog_session: Secure, HttpOnly, SameSite=Lax, Path=/); wrong password → 401; /me without cookie → 401", async () => {
    const s = await signIn(THANH);
    const attrs = s.setCookie.split(';').map((a) => a.trim().toLowerCase());
    expect(s.setCookie.startsWith(`${SESSION_COOKIE}=`)).toBe(true);
    for (const a of ['secure', 'httponly', 'samesite=lax', 'path=/']) expect(attrs, `cookie attribute ${a}`).toContain(a);
    const me = await appApi<{ user: { email: string }; library: { name: string } }>('GET', '/app-api/me', { cookie: s.cookie });
    expect(me.status).toBe(200);
    expect(me.json.user.email).toBe(THANH);
    expect(me.json.library.name).toBe("Thanh's Library");

    const wrong = await appApi<{ details?: { message?: string } }>('POST', '/app-api/session', { body: { email: THANH, password: `${portalUser(THANH).password}-wrong` } });
    expect(wrong.status).toBe(401);
    expect(wrong.json?.details?.message).toBe('INVALID_CREDENTIALS');

    const anon = await appApi<{ details?: { message?: string } }>('GET', '/app-api/me');
    expect(anon.status).toBe(401);
    expect(anon.json?.details?.message).toBe('NOT_SIGNED_IN');
  });
});

describe('T4a uploads of the real packages', () => {
  it('AC-T4-03 the SCORM zip → 201 with the exact report values', { timeout: 120_000 }, async () => {
    const s = await signIn(THANH);
    const course = await createCourse(s, `QA SCORM ${runId}`);
    const res = await uploadVersion(s, course.id, courseZipCopy('scorm'));
    expect(res.status, res.body.slice(0, 300)).toBe(201);
    const v = res.json as unknown as Version;
    expect(v.format).toBe('scorm12');
    expect(v.report.entryPath).toBe('index.html');
    expect(v.report.fileCount).toBe(7);
    expect(v.report.totalBytes).toBe(12723159);
    expect(v.report.scorm?.schemaVersion).toBe('1.2');
    expect(v.report.scorm?.masteryScore).toBe(70);
    expect(v.report.scorm?.scoCount).toBe(1);
    expect(v.report.externalHosts).toEqual([S3]);
    expect(v.trackingProfile.questionIds).toEqual([QUESTION]);
  });

  it('AC-T4-04 the HTML zip → 201 with the exact report values', { timeout: 120_000 }, async () => {
    const s = await signIn(THANH);
    const course = await createCourse(s, `QA HTML ${runId}`);
    const res = await uploadVersion(s, course.id, courseZipCopy('html'));
    expect(res.status, res.body.slice(0, 300)).toBe(201);
    const v = res.json as unknown as Version;
    expect(v.format).toBe('html');
    expect(v.report.fileCount).toBe(7);
    expect(v.report.totalBytes).toBe(12103306);
    expect(v.report.html?.pages).toEqual(['index', 'lesson-ai-web-sprint']);
    expect(v.report.html?.menuPage).toBe('index');
    expect(v.report.html?.questionIds).toEqual([QUESTION]);
    expect(v.trackingProfile.masteryScore).toBe(70);
    expect([...v.report.externalHosts].sort()).toEqual([S3, 'fonts.gstatic.com'].sort());
  });
});
