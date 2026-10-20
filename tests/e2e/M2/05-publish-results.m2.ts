// AC-M2-10: generic publish dialog (ready connections only, name/LMS/site host) and Canvas results texts.
import { createCourse, THANH, uploadVersion } from '../../acceptance/lib/app';
import { httpsRequest } from '../../acceptance/lib/https';
import {
  APP, app, blackboardBinding, canvasBinding, canvasPending, check, completeHtml, escape, fixtureZip, ok, publicationFor, serverLaunch,
  unique, type Bound,
} from '../../acceptance/M1/canvas/browser';
import { TEXT, button, expect, m2Case, portalSignIn, shot } from './lib/m2';

m2Case('M2-10.publish-dialog', 'Publish to an LMS lists every ready connection as name (LMS, site host) and no pending or disabled one', async ({ page }) => {
  const canvas = await canvasBinding('A'), bb = await blackboardBinding('A');
  const pending = (await canvasPending('A')).connection;
  const disabled = await canvasBinding('A');
  ok(await app(disabled.s, 'DELETE', `/app-api/connections/${disabled.connection.id}`), 204, 'disconnect');
  const course = await createCourse(canvas.s, unique('M2-10 course'));
  ok(await uploadVersion(canvas.s, course.id, fixtureZip('html')), 201, 'upload');
  await portalSignIn(page, THANH); await page.goto(`${APP}/libraries/courses/${course.id}`);
  await button(page, TEXT.publishTitle).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: TEXT.publishTitle })).toBeVisible();
  const select = dialog.getByLabel(TEXT.publishSelect, { exact: true });
  // Retrying readiness: the list loads after the dialog opens. The snapshot below (and its absence checks) needs a loaded list.
  for (const text of [`${canvas.connection.name} (Canvas, school-a.canvas.sim.test)`, `${bb.connection.name} (Blackboard, learn-a.blackboard.sim.test)`]) {
    await expect(select.locator('option').filter({ hasText: new RegExp(`^\\s*${escape(text)}\\s*$`) })).toHaveCount(1);
  }
  const options = (await select.locator('option').allTextContents()).map((o) => o.trim());
  expect(options).toContain(`${canvas.connection.name} (Canvas, school-a.canvas.sim.test)`);
  expect(options).toContain(`${bb.connection.name} (Blackboard, learn-a.blackboard.sim.test)`);
  for (const absent of [pending.name, disabled.connection.name]) expect(options.some((o) => o.startsWith(absent + ' ('))).toBe(false);
  for (const o of options.filter((x) => x.includes('('))) expect(o).toMatch(/^.+ \((Moodle|Canvas|Blackboard), [a-z0-9.-]+\)$/);
  await shot(page, 'm2-10-publish-dialog');
});

async function gradedCanvas(b: Bound) {
  const pub = await publicationFor(b, 'html');
  const l = await serverLaunch(b, { resource: pub.id, resourceLinkId: unique('rl') });
  check(l.response.status === 303, `launch ${l.response.status}`);
  const handoff = await httpsRequest(String(l.response.headers.location)); check(handoff.status === 303, 'handoff');
  const playId = new URL(String(handoff.headers.location), APP).pathname.split('/')[2];
  const shell = await httpsRequest(`${APP}/play/${playId}`);
  const runtime = shell.body.match(/src="https:[^"]+\/rt\/([^"/?]+)/)?.[1]; check(runtime, 'runtime token');
  await completeHtml(runtime, 7);
  for (let i = 0; i < 80; i++) {
    const rows = (await app(b.s, 'GET', `/app-api/publications/${pub.id}/results`)).json.rows;
    if (rows?.some((r: { scoreSyncs: { status: string }[] }) => r.scoreSyncs.some((s) => s.status === 'sent'))) return pub;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Canvas score was not sent');
}
m2Case('M2-10.canvas-results', 'Canvas results show the Canvas learner label and Canvas texts', async ({ page }) => {
  const b = await canvasBinding('A'), pub = await gradedCanvas(b);
  await portalSignIn(page, THANH); await page.goto(`${APP}/publications/${pub.id}/results`);
  await expect(page.getByText('Learner learner-1 @ school-a.canvas.sim.test').first()).toBeVisible();
  const text = await page.locator('main').or(page.locator('body')).first().innerText();
  expect(text).toContain('Canvas'); expect(text).not.toMatch(/Moodle/);
  await shot(page, 'm2-10-canvas-results');
});
