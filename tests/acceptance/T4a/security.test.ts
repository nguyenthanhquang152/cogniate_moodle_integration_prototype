// T4a security: the Origin rule on portal writes and library isolation. Source: tasks/T4a.md AC-T4-02, AC-T4-06;
// contract cogniate-app-api.md §1 (Origin rule, 404 NOT_FOUND for another library); security §6.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP, appApi, createCourse, QA_B, signIn, THANH, uploadVersion } from '../lib/app';
import { publicUrls } from '../lib/env';
import { zipBuffer } from '../lib/zip';

const urls = publicUrls();
const runId = `${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;

function tinyHtmlZip(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-tiny-'));
  const file = path.join(dir, 'tiny-html.zip');
  fs.writeFileSync(file, zipBuffer([{ name: 'index.html', data: '<!doctype html><html><body data-lesson-id="index"><p>QA</p></body></html>' }]));
  return file;
}

describe('T4a security', () => {
  it('AC-T4-02 POST /app-api/courses with the cookie and Origin = content URL, Origin: null, or no Origin → 403; no course is made', async () => {
    const s = await signIn(THANH);
    const cases: [string, string | null][] = [
      ['Origin = PUBLIC_CONTENT_URL', urls.content],
      ['Origin: null', 'null'],
      ['no Origin', null],
    ];
    for (const [label, origin] of cases) {
      const title = `QA origin ${label} ${runId}`;
      const res = await appApi<{ details?: { message?: string } }>('POST', '/app-api/courses', { cookie: s.cookie, origin, body: { title } });
      expect(res.status, label).toBe(403);
      if (origin !== null) expect(res.json?.details?.message, label).toBe('ORIGIN_NOT_ALLOWED');
      const list = await appApi<{ courses: { title: string }[] }>('GET', '/app-api/courses', { cookie: s.cookie });
      expect(list.json.courses.map((c) => c.title), `${label}: no course made`).not.toContain(title);
    }
    expect(APP).toBe(urls.app);
  });

  it("AC-T4-06 the QA Library B user gets 404 for Thanh's course, its version and an upload to it, and does not list it", async () => {
    const thanh = await signIn(THANH);
    const course = await createCourse(thanh, `QA isolation ${runId}`);
    const up = await uploadVersion(thanh, course.id, tinyHtmlZip());
    expect(up.status, up.body.slice(0, 300)).toBe(201);
    const versionId = String((up.json as { id?: string }).id);

    const b = await signIn(QA_B);
    const getCourse = await appApi<{ details?: { message?: string } }>('GET', `/app-api/courses/${course.id}`, { cookie: b.cookie });
    expect(getCourse.status).toBe(404);
    expect(getCourse.json?.details?.message).toBe('NOT_FOUND');
    const getVersion = await appApi('GET', `/app-api/courses/${course.id}/versions/${versionId}`, { cookie: b.cookie });
    expect(getVersion.status).toBe(404);
    const postVersion = await uploadVersion(b, course.id, tinyHtmlZip());
    expect(postVersion.status).toBe(404);
    const list = await appApi<{ courses: { id: string }[] }>('GET', '/app-api/courses', { cookie: b.cookie });
    expect(list.status).toBe(200);
    expect(list.json.courses.map((c) => c.id)).not.toContain(course.id);

    // Thanh's course still has exactly the one version (B's upload changed nothing).
    const mine = await appApi<{ versions?: unknown[] }>('GET', `/app-api/courses/${course.id}`, { cookie: thanh.cookie });
    expect(mine.json.versions ?? []).toHaveLength(1);
  });
});
