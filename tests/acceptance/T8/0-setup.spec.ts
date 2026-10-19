// T8 setup. The main pass runs SETUP-T5a first (QA_TASK=T5a,T8): Thanh's registered connection and the published
// "Cogniate SCORM" course (lib/t5.ts state "T5"). AC-T8-02 builds that SCORM version. The course shell ACs (AC-T8-09,
// -10) use two QA courses with a small blank SCO version, so their shell courses never clash with the restored course
// of AC-T8-05 (same shortname pattern).
import crypto from 'node:crypto';
import { createCourse, signIn, THANH, uploadVersion } from '../lib/app';
import { expect, test } from '../lib/pw';
import { blankScoZip, t5 } from '../lib/t5';
import { saveT8, t8 } from '../lib/t8';

test('SETUP-T8 the SCORM version to build (T5a setup) and two QA courses with a blank SCO version for the course shell', async () => {
  test.setTimeout(180_000);
  if (t8().shellUi) return;
  const st = t5();
  expect(st.connectionId && st.scorm?.courseId && st.scorm?.versionId, 'T5a setup state (run SETUP-T5a first)').toBeTruthy();
  const runId = `${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;
  const thanh = await signIn(THANH);
  const shells: Record<string, { courseId: string; versionId: string }> = {};
  for (const key of ['api', 'ui']) {
    const course = await createCourse(thanh, `QA T8 shell ${key} ${runId}`);
    const up = await uploadVersion(thanh, course.id, blankScoZip());
    expect(up.status, up.body.slice(0, 200)).toBe(201);
    shells[key] = { courseId: course.id, versionId: String((up.json as { id?: string }).id ?? '') };
  }
  saveT8({ runId, courseId: String(st.scorm!.courseId), versionId: String(st.scorm!.versionId), shellApi: shells.api, shellUi: shells.ui });
});
