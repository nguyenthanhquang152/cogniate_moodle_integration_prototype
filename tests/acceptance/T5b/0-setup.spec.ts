// T5b setup. tasks/T5b.md: "Setup: T5a state" (the T5a pass of the same run made it: lib/t5.ts state "T5").
// "Fresh activity per AC" (tasks README §2, d7a88ec): the ACs that need a learner with no earlier state use their own
// activity `Cogniate <SCORM|HTML> <AC id>` (the same publication deep-linked again): AC-T5-36, -28, -29, -14, -31 (HTML),
// AC-T5-30, -33 (SCORM). "Cogniate HTML 102" is made by AC-T5-32 itself. Each activity has completion "Receive a grade".
import { newStackContext } from '../lib/moodle-launch';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';
import { ACT, addPickedActivity, course101, saveT5, t5 } from '../lib/t5';

test('SETUP-T5b QA activities for the T5b scenarios (HTML and SCORM, completion "Receive a grade") in COGNIATE-DEV-101', async ({ browser }) => {
  test.setTimeout(900_000);
  const st = t5();
  expect(st.typeId && st.html?.title && st.scorm?.title, 'T5a state (run the T5a pass first)').toBeTruthy();
  const wanted = [
    [ACT.htmlHang, st.html!.title],
    [ACT.htmlFirst, st.html!.title],
    [ACT.htmlDwell, st.html!.title],
    [ACT.htmlRetry, st.html!.title],
    [ACT.htmlConflict, st.html!.title],
    [ACT.scormOutage, st.scorm!.title],
    [ACT.scormOverride, st.scorm!.title],
  ] as const;
  const context = await newStackContext(browser);
  try {
    for (const [name, title] of wanted) {
      if (t5().cmids?.[name]) continue;
      const cmid = await addPickedActivity(context, seed().users.cg_teacher, course101(), Number(st.typeId), title, name);
      saveT5({ cmids: { ...(t5().cmids ?? {}), [name]: cmid } });
    }
  } finally {
    await context.close();
  }
  for (const [name] of wanted) expect(t5().cmids?.[name], name).toBeTruthy();
});
