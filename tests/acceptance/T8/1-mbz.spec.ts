// T8: the native .mbz. Source: tasks/T8.md AC-T8-02, -04, -05, -06; app contract §11 (MbzBuild, download); security
// §10a. AC-T8-05 runs restore_backup.php in the stack Moodle through the host runner (host action moodle-restore,
// tests/host/run-t8.mjs). AC-T8-06 uses Moodle's own SCORM player (not the Cogniate runtime).
import fs from 'node:fs';
import path from 'node:path';
import { signIn, THANH } from '../lib/app';
import { publicUrls } from '../lib/env';
import { CONTROL_DIR } from '../lib/host-control';
import { newStackContext } from '../lib/moodle-launch';
import { moodleLogin } from '../lib/moodle-ui';
import { callWs, gradeItems } from '../lib/moodle-ws';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';
import { backupInfo, downloadMbz, driveInMoodlePlayer, hostJson, readTarGz, saveT8, saveToControl, startMbz, t8, waitMbz } from '../lib/t8';

const urls = publicUrls();
const shortname = () => `cogniate:${t8().courseId}:default:en`;

test.describe.serial('T8 native .mbz', () => {
  test('AC-T8-02 POST …/mbz → 202; within 5 min GET …/mbz → ready; the download is a file > 12 MB', async () => {
    test.setTimeout(420_000);
    const st = t8();
    const s = await signIn(THANH);
    const started = Date.now();
    const post = await startMbz(s, String(st.courseId), String(st.versionId));
    expect(post.status, post.body.slice(0, 300)).toBe(202);
    expect(post.json.status, 'a new build is queued').toBe('queued');
    const build = await waitMbz(s, String(st.courseId), String(st.versionId), (b) => b.buildId === post.json.buildId && (b.status === 'ready' || b.status === 'failed'), 300_000);
    const seconds = Math.round((Date.now() - started) / 1000);
    test.info().annotations.push({ type: 'build', description: `${build?.buildId} ${build?.status} step ${build?.step} after ${seconds} s; bytes ${build?.bytes}; reason ${build?.reason ?? '-'}` });
    expect(build?.status, JSON.stringify(build)).toBe('ready');
    expect(seconds, 'ready within 5 min').toBeLessThanOrEqual(300);
    expect(build?.downloadUrl, 'downloadUrl when ready').toBeTruthy();
    const dl = await downloadMbz(s, String(st.courseId), String(st.versionId));
    expect(dl.status).toBe(200);
    expect(dl.type).toContain('application/vnd.moodle.backup');
    expect(dl.data.length, `download ${dl.data.length} B`).toBeGreaterThan(12_000_000);
    expect(dl.data.length, 'bytes field = file size').toBe(Number(build?.bytes));
    const file = saveToControl(`qa-t8-${st.runId}.mbz`, dl.data);
    saveT8({ buildId: post.json.buildId, mbzFile: file, mbzBytes: dl.data.length });
  });

  test('AC-T8-04 the .mbz (tar.gz) has moodle_backup.xml with a Moodle release 5.2, users = 0, and exactly one scorm activity', async () => {
    const file = String(t8().mbzFile ?? '');
    expect(file, 'AC-T8-02 saved the .mbz').toBeTruthy();
    const entries = readTarGz(fs.readFileSync(path.join(CONTROL_DIR(), file)));
    const xml = entries.find((e) => e.name === 'moodle_backup.xml');
    expect(xml, `entries: ${entries.slice(0, 20).map((e) => e.name).join(', ')}`).toBeDefined();
    const info = backupInfo(xml!.data.toString('utf8'));
    test.info().annotations.push({ type: 'moodle_backup.xml', description: `release ${info.release}; users ${info.usersSetting}; activities ${info.activities.map((a) => `${a.modulename}:${a.title}`).join(', ')}; ${entries.length} entries` });
    expect(info.release, 'moodle_release').toMatch(/^5\.2/);
    expect(info.usersSetting, 'root setting users').toBe('0');
    expect(info.activities.filter((a) => a.modulename === 'scorm'), 'scorm activities').toHaveLength(1);
  });

  test('AC-T8-05 restore_backup.php --file=<mbz> --categoryid=1 makes a hidden course with shortname cogniate:{courseId}:default:en and one SCORM activity', async () => {
    test.setTimeout(900_000);
    const file = String(t8().mbzFile ?? '');
    expect(file, 'AC-T8-02 saved the .mbz').toBeTruthy();
    const restore = await hostJson<{ copy: number; restore: number | null; stdout: string; stderr: string }>('moodle-restore', { mbz: file }, 900_000);
    test.info().annotations.push({ type: 'restore_backup.php', description: `exit ${restore.code}; ${restore.raw.slice(0, 1500)}` });
    expect(restore.code, 'restore_backup.php exit').toBe(0);
    const found = await callWs<{ courses: { id: number; shortname: string; visible: number; idnumber?: string }[] }>(seed().oracleToken, 'core_course_get_courses_by_field', { field: 'shortname', value: shortname() });
    expect(found.courses, `courses with shortname ${shortname()}`).toHaveLength(1);
    const course = found.courses[0]!;
    expect(course.visible, 'hidden').toBe(0);
    const contents = await callWs<{ modules: { id: number; modname: string; name: string }[] }[]>(seed().oracleToken, 'core_course_get_contents', { courseid: course.id });
    const scorms = contents.flatMap((sec) => sec.modules).filter((m) => m.modname === 'scorm');
    test.info().annotations.push({ type: 'restored course', description: `id ${course.id}, idnumber "${course.idnumber ?? ''}", modules ${contents.flatMap((x) => x.modules).map((m) => m.modname).join(', ')}` });
    expect(scorms, 'one SCORM activity').toHaveLength(1);
    saveT8({ restoredCourseId: course.id, restoredCmid: scorms[0]!.id });
  });

  test('AC-T8-06 visible + cg_student enrolled; cg_student completes the SCORM activity in Moodle\'s player with the correct answer → gradebook 100.00 and the SCORM report shows "Passed"', async ({ browser }) => {
    test.setTimeout(420_000);
    const { restoredCourseId: courseId, restoredCmid: cmid } = t8();
    expect(courseId && cmid, 'AC-T8-05 restored the course').toBeTruthy();
    const s = seed();
    const student = s.users.cg_student;
    await callWs(s.oracleToken, 'core_course_update_courses', { courses: [{ id: courseId, visible: 1 }] });
    await callWs(s.productToken, 'enrol_manual_enrol_users', { enrolments: [{ roleid: 5, userid: student.id, courseid: courseId }] });

    const context = await newStackContext(browser);
    try {
      const page = await context.newPage();
      await moodleLogin(page, urls.moodle, student.username, student.password);
      await page.goto(`${urls.moodle}/mod/scorm/view.php?id=${cmid}`);
      const popup = context.waitForEvent('page', { timeout: 10_000 }).catch(() => null);
      await page.getByRole('button', { name: /^Enter$/ }).or(page.locator('input[type="submit"][value="Enter"]')).first().click();
      const player = (await popup) ?? page;
      await driveInMoodlePlayer(player);
      // The package saves through Moodle's SCORM API; leave the player so that LMSFinish runs if the grade waits.
      const grade = async () => (await gradeItems(s.oracleToken, Number(courseId), student.id)).find((i) => i.itemmodule === 'scorm');
      let item = await grade();
      const deadline = Date.now() + 90_000;
      let exited = false;
      while (!(item?.gradeformatted === '100.00') && Date.now() < deadline) {
        if (!exited && Date.now() > deadline - 70_000) {
          const exit = player.getByRole('link', { name: /exit activity/i }).or(player.getByRole('button', { name: /exit activity/i }));
          if (await exit.count()) await exit.first().click().catch(() => undefined);
          exited = true;
        }
        await new Promise((r) => setTimeout(r, 3_000));
        item = await grade();
      }
      test.info().annotations.push({ type: 'gradebook', description: `${item?.itemname}: ${item?.gradeformatted} (raw ${item?.graderaw}); left the player: ${exited}` });
      expect(item?.gradeformatted, 'Moodle gradebook').toBe('100.00');
    } finally {
      await context.close();
    }

    // The SCORM report (admin): the learner's attempt report shows "Passed".
    const admin = await newStackContext(browser);
    try {
      const page = await admin.newPage();
      await moodleLogin(page, urls.moodle, s.users.admin.username, s.users.admin.password);
      await page.goto(`${urls.moodle}/mod/scorm/report/userreport.php?id=${cmid}&user=${student.id}&attempt=1`);
      const text = (await page.locator('#region-main, main').first().innerText()).replace(/\s+/g, ' ');
      await page.screenshot({ path: test.info().outputPath('scorm-userreport.png'), fullPage: true });
      test.info().annotations.push({ type: 'SCORM report', description: text.slice(0, 600) });
      expect(text, 'the SCORM report shows Passed').toMatch(/\bPassed\b/);
    } finally {
      await admin.close();
    }
  });
});
