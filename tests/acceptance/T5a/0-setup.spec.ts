// T5a setup. tasks/T5a.md: "T4b2 state; activities 'Cogniate SCORM' (SCORM course) and 'Cogniate HTML' (HTML course) in
// COGNIATE-DEV-101, deep-linked, completion 'Receive a grade'". QA makes this state itself on a fresh stack, with the
// same steps as T4b1/T4b2 (contract §2–§6, flows §6a-1, §6b, §6e):
// 1. Thanh's courses: the SCORM and the HTML fixture, and the AC-T5-05 "blank SCO" (a QA package).
// 2. Thanh's dynamic connection, registered in Moodle (real "Connect" click), the tool activated, "Show in activity
//    chooser" and "New window".
// 3. The three courses published to the connection.
// 4. Deep-linked activities with completion "Receive a grade": the two AC names, plus QA's own activities (lib/t5.ts
//    ACT): "QA Blank SCO" (AC-T5-05, -06, -21, -15, -16), "QA Blank SCO 2" (AC-T5-22) and "Cogniate SCORM rebind"
//    (AC-T5-37, so that the rebind does not change "Cogniate SCORM", which later ACs and T5b use).
import crypto from 'node:crypto';
import { appApi, createCourse, signIn, THANH, uploadVersion } from '../lib/app';
import { courseZipCopy } from '../lib/course-fixtures';
import { publicUrls } from '../lib/env';
import { newStackContext } from '../lib/moodle-launch';
import { activateTool, openManageTools, setToolOptions, startRegistration, toolTypeIds, waitForDialogClosed } from '../lib/moodle-reg';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';
import { ACT, addPickedActivity, blankScoZip, completionState, type CourseRef, course101, saveT5, t5 } from '../lib/t5';

const urls = publicUrls();
const THANH_TOOL = "Cogniate (Thanh's Library)";

test('SETUP-T5a Thanh connected; SCORM, HTML and blank SCO courses published; activities with completion "Receive a grade" in COGNIATE-DEV-101', async ({ browser }) => {
  test.setTimeout(900_000);
  if (t5().cmids?.[ACT.scorm]) return; // made by an earlier pass of this run
  const runId = `${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;
  const thanh = await signIn(THANH);

  // 1. Courses.
  const make = async (title: string, file: string): Promise<CourseRef> => {
    const course = await createCourse(thanh, title);
    const up = await uploadVersion(thanh, course.id, file);
    expect(up.status, `${title}: ${up.body.slice(0, 300)}`).toBe(201);
    const v = up.json as { id?: string; packageId?: string };
    expect(v.packageId, `${title}: packageId in the CourseVersion`).toBeTruthy();
    return { courseId: course.id, versionId: String(v.id), packageId: String(v.packageId), title };
  };
  const scorm = await make(`AI Website Sprint SCORM ${runId}`, courseZipCopy('scorm'));
  const html = await make(`AI Website Sprint HTML ${runId}`, courseZipCopy('html'));
  const blank = await make(`QA Blank SCO ${runId}`, blankScoZip());

  // 2. Dynamic connection, registered in Moodle.
  const conn = await appApi<{ id: string; registrationUrl: string }>('POST', '/app-api/connections', {
    cookie: thanh.cookie,
    body: { name: 'Dev Moodle', siteUrl: urls.moodle, method: 'dynamic' },
  });
  expect(conn.status, conn.body).toBe(201);
  const context = await newStackContext(browser);
  let typeId = 0;
  const cmids: Record<string, number> = {};
  try {
    const page = await context.newPage();
    await openManageTools(page, seed().users.admin);
    const held = await startRegistration(context, page, conn.json.registrationUrl, 'new', 45_000, { hold: false });
    expect(held.response?.status, held.response?.body.slice(0, 300)).toBe(200);
    await held.frame.getByRole('button', { name: 'Connect' }).click();
    expect(await waitForDialogClosed(page), 'the registration dialog closes').toBe(true);
    await held.release();
    const ids = await toolTypeIds(page, THANH_TOOL);
    expect(ids, `one Moodle tool "${THANH_TOOL}"`).toHaveLength(1);
    typeId = ids[0];
    await activateTool(page, typeId);
    await setToolOptions(page, typeId, { coursevisible: '2', launchcontainer: '4' });
    await page.close();

    // 3. Publish.
    const publish = async (courseId: string) => {
      const r = await appApi<{ id: string; status: string }>('POST', '/app-api/publications', { cookie: thanh.cookie, body: { connectionId: conn.json.id, courseId } });
      expect([200, 201], r.body).toContain(r.status);
      expect(r.json.status).toBe('available');
      return r.json.id;
    };
    const scormPublicationId = await publish(scorm.courseId);
    const htmlPublicationId = await publish(html.courseId);
    const blankPublicationId = await publish(blank.courseId);
    saveT5({ runId, connectionId: conn.json.id, typeId, scorm, html, blank, scormPublicationId, htmlPublicationId, blankPublicationId });

    // 4. Activities (cg_teacher, real picker), completion "Receive a grade".
    const teacher = seed().users.cg_teacher;
    for (const [name, title] of [
      [ACT.scorm, scorm.title],
      [ACT.html, html.title],
      [ACT.blankA, blank.title],
      [ACT.blankB, blank.title],
      [ACT.rebind, scorm.title],
    ] as const) {
      cmids[name] = await addPickedActivity(context, teacher, course101(), typeId, title, name);
      saveT5({ cmids: { ...(t5().cmids ?? {}), [name]: cmids[name] } });
    }
  } finally {
    await context.close();
  }

  // The activities have automatic completion (the oracle lists them for a learner, state 0 = not complete).
  for (const [name, cmid] of Object.entries(cmids)) {
    expect(await completionState(course101(), seed().users.cg_student, cmid), `${name}: completion tracking on`).toBe(0);
  }
});
