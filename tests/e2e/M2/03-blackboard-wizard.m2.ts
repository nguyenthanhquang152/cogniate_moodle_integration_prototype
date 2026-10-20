// AC-M2-06: Blackboard wizard success, deployment conflict, retry after an LTI failure, fixed reservation, no endpoint input.
import { THANH } from '../../acceptance/lib/app';
import { BLACKBOARD, app, blackboardBinding, escape, ok, session, sharedPlatform, unique, type Json } from '../../acceptance/M1/canvas/browser';
import {
  ERR, TEACHER, TEXT, blackboardGrantFor, blackboardStep1, blackboardToStep3, codeCleared, connection, expect, fieldMarked,
  fillBlackboardStep3, gateClear, gateFailNext, m2Case, newestByName, next, noForbiddenFields, portalSignIn, save, shot,
} from './lib/m2';

const BB_ROWS = ['client_id', 'login_initiation_url', 'tool_redirect_url', 'tool_jwks_url', 'tool_status', 'user_fields',
  'grade_service', 'membership_service', 'placement'];

m2Case('M2-06.success', 'Blackboard steps 1 to 4 with a matching approval code register; step 4 shows Ultra and Original steps', async ({ page }) => {
  await sharedPlatform();
  const s = await session('A'); await portalSignIn(page, THANH);
  const name = unique('Blackboard M2-06');
  await blackboardStep1(page, { name, site: BLACKBOARD.siteA }); await noForbiddenFields(page); await shot(page, 'm2-06-blackboard-step1');
  await next(page);
  await expect(page.getByRole('heading', { name: TEXT.blackboardStep2 })).toBeVisible();
  const c = await newestByName(s, name, 'blackboard');
  const rows = await app(s, 'GET', `/app-api/connections/${c.id}/tool-configuration`); ok(rows, 200, 'rows');
  expect((rows.json as Json[]).map((r) => r.key)).toEqual(BB_ROWS);
  for (const row of rows.json as Json[]) {
    await expect(page.locator('div, li, tr, section', { hasText: row.label }).filter({ hasText: row.value }).last(), `Row ${row.key}`).toBeVisible();
  }
  await noForbiddenFields(page); await shot(page, 'm2-06-blackboard-step2');
  await next(page);
  await expect(page.getByText(TEXT.blackboardOperator, { exact: true })).toBeVisible();
  const deploymentId = unique('bb-dep'), grant = await blackboardGrantFor(s, c, deploymentId);
  await fillBlackboardStep3(page, { deploymentId, code: grant.code }); await noForbiddenFields(page); await shot(page, 'm2-06-blackboard-step3');
  await save(page);
  await expect(page.getByRole('heading', { name: TEXT.blackboardStep4 })).toBeVisible({ timeout: 30_000 });
  for (const label of [...TEACHER.blackboardUltra, ...TEACHER.blackboardOriginal]) await expect(page.getByText(label).first(), label).toBeVisible();
  await expect(page.getByText(/Ultra/).first()).toBeVisible(); await expect(page.getByText(/Original/).first()).toBeVisible();
  await shot(page, 'm2-06-blackboard-step4');
  expect((await connection(s, c.id)).status).toBe('registered');
  expect(page.url().includes(grant.code)).toBe(false);
});
m2Case('M2-06.deployment-in-use', 'a deployment that another library holds shows DEPLOYMENT_IN_USE; the connection stays pending', async ({ page }) => {
  const holder = await blackboardBinding('B', BLACKBOARD.siteB);
  const s = await session('A'); await portalSignIn(page, THANH);
  const c = await blackboardToStep3(page, s, { site: BLACKBOARD.siteB });
  const grant = await blackboardGrantFor(s, c, holder.deploymentId);
  await fillBlackboardStep3(page, { deploymentId: holder.deploymentId, code: grant.code });
  await save(page);
  await expect(page.getByText(ERR.deploymentInUse, { exact: true })).toBeVisible();
  expect((await connection(s, c.id)).status).toBe('pending');
  await codeCleared(page, grant.code);
});
m2Case('M2-06.retry-after-error', 'after an LTI_SERVICE_ERROR, a second Save with the same code registers', async ({ page }) => {
  const shared = await sharedPlatform(), s = await session('A'); await portalSignIn(page, THANH);
  const c = await blackboardToStep3(page, s), deploymentId = unique('bb-retry'), grant = await blackboardGrantFor(s, c, deploymentId);
  try {
    await gateFailNext('POST', `^/api/platforms/${escape(shared)}/deployments$`);
    await fillBlackboardStep3(page, { deploymentId, code: grant.code });
    await save(page);
    await expect(page.getByText(ERR.ltiServiceError).first()).toBeVisible();
    expect((await connection(s, c.id)).status).toBe('pending');
    await codeCleared(page, grant.code);
    await gateClear();
    await fillBlackboardStep3(page, { deploymentId, code: grant.code });
    await save(page);
    await expect(page.getByRole('heading', { name: TEXT.blackboardStep4 })).toBeVisible({ timeout: 30_000 });
    expect((await connection(s, c.id)).status).toBe('registered');
  } finally { await gateClear(); }
});
m2Case('M2-06.second-deployment', 'the same code with a second deployment id shows GRANT_MISMATCH; the reservation is kept', async ({ page }) => {
  const shared = await sharedPlatform(), s = await session('A'); await portalSignIn(page, THANH);
  const c = await blackboardToStep3(page, s), deploymentId = unique('bb-first'), grant = await blackboardGrantFor(s, c, deploymentId);
  try {
    // A failed first Save (gate) reserves the first deployment for this pending connection (app contract §4.7.1).
    await gateFailNext('POST', `^/api/platforms/${escape(shared)}/deployments$`);
    await fillBlackboardStep3(page, { deploymentId, code: grant.code }); await save(page);
    await expect(page.getByText(ERR.ltiServiceError).first()).toBeVisible();
    await gateClear();
    await fillBlackboardStep3(page, { deploymentId: unique('bb-second'), code: grant.code }); await save(page);
    await expect(page.getByText(ERR.grantMismatch, { exact: true })).toBeVisible();
    await fieldMarked(page, 'Deployment ID');
    expect((await connection(s, c.id)).status).toBe('pending');
    await codeCleared(page, grant.code);
    // The reservation is still this connection's: another library cannot take that deployment.
    const other = await session('B');
    const otherConnection = await app(other, 'POST', '/app-api/connections', { name: unique('other'), siteUrl: BLACKBOARD.siteA,
      method: 'manual', lms: 'blackboard', profile: BLACKBOARD.profile });
    ok(otherConnection, 201, 'other connection');
    const otherGrant = await blackboardGrantFor(other, otherConnection.json, deploymentId);
    const taken = await app(other, 'PUT', `/app-api/connections/${otherConnection.json.id}/platform`, { deploymentId, grantCode: otherGrant.code });
    expect([taken.status, taken.json?.details?.message]).toEqual([409, 'DEPLOYMENT_IN_USE']);
    await fillBlackboardStep3(page, { deploymentId, code: grant.code }); await save(page);
    await expect(page.getByRole('heading', { name: TEXT.blackboardStep4 })).toBeVisible({ timeout: 30_000 });
  } finally { await gateClear(); }
});
