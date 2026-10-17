// T5b setup. tasks/T5b.md: "Setup: T5a state" (the T5a pass of the same run made it: lib/t5.ts state "T5").
// Attempts and the best-result rule are per learner and activity (ADR-010 rule 5, data-model §2), and there are two
// Moodle learners. So QA adds its own activities, one per T5b scenario that needs a fresh attempt (lib/t5.ts ACT):
// "QA HTML hang" (AC-T5-36), "QA HTML first answer" (AC-T5-28), "QA HTML dwell" (AC-T5-29), "QA HTML retry" (AC-T5-14),
// "QA HTML conflict" (AC-T5-31), "QA SCORM outage" (AC-T5-30), "QA SCORM override" (AC-T5-33). "Cogniate HTML 102" is
// made by AC-T5-32 itself. Each activity has completion "Receive a grade", like the T5a activities.
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
