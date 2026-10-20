// AC-M2-12: portal-only SIM scenario per provider. The portal makes and registers the connection and publishes the real
// HTML course; the QA simulator plays the LMS: a framed teacher Deep Linking pick and a learner launch that completes it.
import type { Page } from '@playwright/test';
import { THANH } from '../../acceptance/lib/app';
import {
  APP, BLACKBOARD, CLOUD, app, canvasClientId, canvasDeploymentId, check, deepLinkPatch, pause, playPath, scenario, session,
  sharedPlatform, sim, unique, waitForFrame, type Json, type Target,
} from '../../acceptance/M1/canvas/browser';
import { doCourse } from '../lib/learner';
import { createCourseWithZip } from '../lib/portal';
import {
  COURSE_ZIP, TEXT, blackboardGrantFor, blackboardToStep3, button, canvasGrantFor, canvasToStep3, connection, expect,
  fillBlackboardStep3, fillCanvasStep3, m2Case, portalSignIn, requireCourseZip, save, shot,
} from './lib/m2';

const escapeRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
async function publishVia(page: Page, courseId: string, connectionName: string) {
  await page.goto(`${APP}/libraries/courses/${courseId}`);
  await button(page, TEXT.publishTitle).first().click();
  const dialog = page.getByRole('dialog');
  const select = dialog.getByLabel(TEXT.publishSelect, { exact: true });
  const label = await select.evaluate((el, n) => Array.from((el as HTMLSelectElement).options).find((o) => o.text.startsWith(`${n} (`))?.text ?? '', connectionName);
  check(label, `Publish dialog lists ${connectionName}`);
  await select.selectOption({ label });
  await dialog.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });
}
async function teacherPick(page: Page, target: Target, siteOrigin: string, courseTitle: string) {
  const sc = await scenario(target, deepLinkPatch());
  await page.goto(`${siteOrigin}/__frame?url=${encodeURIComponent(sc.loginUrl)}`);
  const picker = await waitForFrame(page, (u) => u.origin === APP && u.pathname.startsWith('/tool/picker/'));
  await picker.getByRole('radio', { name: new RegExp(escapeRe(courseTitle)) }).check();
  await shot(page, `m2-12-${target.provider}-teacher-picker`);
  await picker.getByRole('button').first().click();
  for (let i = 0; i < 120; i++) {
    const records = (await sim('/records?since=0')).json?.records as Json[] | undefined;
    const done = records?.find((r) => r.kind === 'deep-link' && r.scenario === sc.id);
    if (done) return done;
    await pause(250);
  }
  throw new Error('The simulator did not accept a Deep Linking response');
}
async function learnerCompletes(page: Page, target: Target, publicationId: string, lmsName: string) {
  const sc = await scenario(target, { resource: publicationId, resourceLinkId: unique('rl') });
  await page.goto(sc.loginUrl);
  await page.waitForURL((u) => u.origin === APP && playPath.test(u.pathname), { timeout: 30_000 });
  await doCourse(page, 'correct');
  await expect(page.getByText(`Completed — score 100 sent to ${lmsName}`).first()).toBeVisible({ timeout: 120_000 });
  await shot(page, `m2-12-${target.provider}-learner-done`);
}
async function publicationOf(s: Json, courseId: string, connectionId: string) {
  const r = await app(s as any, 'GET', `/app-api/publications?courseId=${courseId}`);
  const pub = (r.json.publications as Json[]).find((p) => p.connectionId === connectionId);
  check(pub, 'Publication of this connection'); return pub!;
}
async function resultsSent(page: Page, publicationId: string, siteHost: string) {
  await page.goto(`${APP}/publications/${publicationId}/results`);
  const row = page.locator('tr, [role="row"]').filter({ hasText: `Learner learner-1 @ ${siteHost}` }).first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await expect(row).toContainText('Sent');
  await expect(row).toContainText('100');
}

m2Case('M2-12.canvas', 'portal Canvas connection, publish, simulated teacher pick and learner completion end with sync Sent', async ({ page }) => {
  requireCourseZip(COURSE_ZIP.html);
  const s = await session('A'); await portalSignIn(page, THANH);
  const c = await canvasToStep3(page, s), clientId = canvasClientId(), deploymentId = canvasDeploymentId();
  const grant = await canvasGrantFor(s, c, clientId, deploymentId);
  await fillCanvasStep3(page, { clientId, deploymentId, code: grant.code }); await save(page);
  await expect(page.getByRole('heading', { name: TEXT.canvasStep4 })).toBeVisible({ timeout: 30_000 });
  const title = unique('M2-12 Canvas HTML');
  const courseId = await createCourseWithZip(page, title, COURSE_ZIP.html, 'HTML');
  await publishVia(page, courseId, c.name);
  const pub = await publicationOf(s, courseId, c.id);
  const target: Target = { provider: CLOUD.provider, clientId, deploymentId, serviceHost: 'school-a.canvas.sim.test', pageHost: 'school-a.canvas.sim.test' };
  const picked = await teacherPick(page, target, CLOUD.siteA, title);
  expect(String(picked.items?.[0]?.url)).toContain(`resource=${pub.id}`);
  await learnerCompletes(page, target, pub.id, 'Canvas');
  await resultsSent(page, pub.id, 'school-a.canvas.sim.test');
  await shot(page, 'm2-12-canvas-results');
  expect((await connection(s, c.id)).status).toBe('connected');
}, 480_000);

m2Case('M2-12.blackboard', 'portal Blackboard connection, publish, simulated teacher pick and learner completion end with sync Sent', async ({ page }) => {
  requireCourseZip(COURSE_ZIP.html);
  await sharedPlatform();
  const s = await session('A'); await portalSignIn(page, THANH);
  const c = await blackboardToStep3(page, s), deploymentId = unique('bb-m2-12');
  const grant = await blackboardGrantFor(s, c, deploymentId);
  await fillBlackboardStep3(page, { deploymentId, code: grant.code }); await save(page);
  await expect(page.getByRole('heading', { name: TEXT.blackboardStep4 })).toBeVisible({ timeout: 30_000 });
  const title = unique('M2-12 Blackboard HTML');
  const courseId = await createCourseWithZip(page, title, COURSE_ZIP.html, 'HTML');
  await publishVia(page, courseId, c.name);
  const pub = await publicationOf(s, courseId, c.id);
  const target: Target = { provider: BLACKBOARD.provider, clientId: BLACKBOARD.clientId, deploymentId,
    serviceHost: 'learn-a.blackboard.sim.test', pageHost: 'learn-a.blackboard.sim.test' };
  const picked = await teacherPick(page, target, BLACKBOARD.siteA, title);
  expect(String(picked.items?.[0]?.url)).toContain(`resource=${pub.id}`);
  await learnerCompletes(page, target, pub.id, 'Blackboard');
  await resultsSent(page, pub.id, 'learn-a.blackboard.sim.test');
  await shot(page, 'm2-12-blackboard-results');
  expect((await connection(s, c.id)).status).toBe('connected');
}, 480_000);
