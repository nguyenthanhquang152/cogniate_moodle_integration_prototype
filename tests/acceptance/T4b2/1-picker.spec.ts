// T4b2: the content picker in Moodle's "Select content" frame. Source: tasks/T4b2.md AC-T4-15, AC-T4-16;
// contract cogniate-app-api.md §5, §6 (/tool/deep-link, /tool/picker); flows §6b.
import { appApi, QA_B, signIn, THANH } from '../lib/app';
import { saveState } from '../lib/lti';
import { openPicker, pickerOptions, saveActivity, submitPicker } from '../lib/moodle-dl';
import { newStackContext } from '../lib/moodle-launch';
import { gradeItems } from '../lib/moodle-ws';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';
import { t4b } from '../lib/t4b-state';

interface Publication {
  id: string;
  courseTitle: string;
  format: string;
  status: string;
  stats: { activities: number; learners: number };
}

test.describe.serial('T4b2 picker', () => {
  test('AC-T4-15 the picker lists exactly Thanh\'s publications (radios, badges); picking the SCORM course makes an activity with a grade item of 100', async ({ browser }) => {
    test.setTimeout(150_000);
    const st = t4b();
    expect(st.thanhTypeId && st.thanhScorm, 'T4b setup').toBeTruthy();
    const thanh = await signIn(THANH);
    const pubs = await appApi<{ publications: Publication[] }>('GET', `/app-api/publications?connectionId=${st.thanhConnectionId}`, { cookie: thanh.cookie });
    const available = pubs.json.publications.filter((p) => p.status === 'available');
    const context = await newStackContext(browser);
    try {
      const course = seed().courses['COGNIATE-DEV-101'];
      const open = await openPicker(context, seed().users.cg_teacher, course, st.thanhTypeId!);
      expect(open.pickerGet.status).toBe(200);
      const options = await pickerOptions(open.frame);
      expect(options.length, 'one option per available publication').toBe(available.length);
      expect(options.every((o) => o.type === 'radio'), 'radio buttons (single select)').toBe(true);
      expect(options.map((o) => o.value).sort()).toEqual(available.map((p) => p.id).sort());
      const scormOpt = options.find((o) => o.value === st.thanhScormPublicationId);
      const htmlOpt = options.find((o) => o.value === st.thanhHtmlPublicationId);
      expect(scormOpt?.row, 'SCORM badge').toContain('SCORM 1.2');
      expect(htmlOpt?.row, 'HTML badge').toContain('HTML');
      await open.page.screenshot({ path: test.info().outputPath('picker.png') });

      const { pickerPost, nameAfter } = await submitPicker(open, st.thanhScorm!.title);
      expect(pickerPost.status, pickerPost.body.slice(0, 300)).toBe(200);
      expect(nameAfter, 'the form gets the course title').toBe(st.thanhScorm!.title);
      const cmid = await saveActivity(open.page, course);
      const item = (await gradeItems(seed().oracleToken, course, seed().users.cg_student.id)).find((i) => i.itemname === st.thanhScorm!.title);
      expect(Number(item?.grademax), 'grade item maximum').toBe(100);

      const conn = await appApi<{ status: string }>('GET', `/app-api/connections/${st.thanhConnectionId}`, { cookie: thanh.cookie });
      expect(conn.json.status).toBe('connected');
      const pub = await appApi<Publication>('GET', `/app-api/publications/${st.thanhScormPublicationId}`, { cookie: thanh.cookie });
      expect(pub.json.stats.activities).toBe(1);
      saveState('T4b', {
        scormActivityCmid: cmid,
        scormActivityName: st.thanhScorm!.title,
        usedPickerUrl: open.pickerUrl,
        pickerGetHeaders: open.pickerGet.headers,
        pickerPostHeaders: pickerPost.headers,
      });
    } finally {
      await context.close();
    }
  });

  test('AC-T4-16 through "Cogniate (QA Library B)" in COGNIATE-DEV-102 the picker shows only library B\'s publication', async ({ browser }) => {
    test.setTimeout(120_000);
    const st = t4b();
    const b = await signIn(QA_B);
    const pubs = await appApi<{ publications: Publication[] }>('GET', `/app-api/publications?connectionId=${st.bManualConnectionId}`, { cookie: b.cookie });
    const context = await newStackContext(browser);
    try {
      const open = await openPicker(context, seed().users.cg_teacher, seed().courses['COGNIATE-DEV-102'], st.bManualTypeId!);
      const options = await pickerOptions(open.frame);
      expect(options.map((o) => o.value)).toEqual(pubs.json.publications.filter((p) => p.status === 'available').map((p) => p.id));
      expect(options.map((o) => o.value)).toEqual([st.bHtmlPublicationId]);
    } finally {
      await context.close();
    }
  });
});
