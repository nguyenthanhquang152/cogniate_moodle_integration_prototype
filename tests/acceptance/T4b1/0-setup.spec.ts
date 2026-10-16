// T4b setup (shared by T4b1 and T4b2): "T4a state; both fixtures uploaded as Thanh's courses; one HTML course uploaded
// as library B's course" (tasks/T4b1.md, T4b2.md). The ids go to the state file "T4b".
import crypto from 'node:crypto';
import { createCourse, QA_B, signIn, THANH, uploadVersion } from '../lib/app';
import { courseZipCopy } from '../lib/course-fixtures';
import { loadState, saveState } from '../lib/lti';
import { expect, test } from '../lib/pw';

test('SETUP-T4b Thanh has the SCORM and the HTML course, library B has an HTML course (each with version 1)', async () => {
  test.setTimeout(240_000);
  if (loadState('T4b').thanhScorm) return; // made by an earlier file in this run
  const runId = `${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;
  const thanh = await signIn(THANH);
  const b = await signIn(QA_B);
  const make = async (s: Awaited<ReturnType<typeof signIn>>, title: string, kind: 'scorm' | 'html') => {
    const course = await createCourse(s, title);
    const v = await uploadVersion(s, course.id, courseZipCopy(kind));
    expect(v.status, `${title}: ${v.body.slice(0, 200)}`).toBe(201);
    return { courseId: course.id, versionId: String((v.json as { id?: string }).id), title };
  };
  saveState('T4b', {
    runId,
    thanhScorm: await make(thanh, `AI Website Sprint SCORM ${runId}`, 'scorm'),
    thanhHtml: await make(thanh, `AI Website Sprint HTML ${runId}`, 'html'),
    bHtml: await make(b, `QA Library B HTML ${runId}`, 'html'),
  });
});
