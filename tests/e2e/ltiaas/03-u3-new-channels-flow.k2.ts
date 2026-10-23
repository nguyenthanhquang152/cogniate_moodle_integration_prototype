// K2 U3: End-to-end browser journeys for `lti-generic` (dynamic self, staged foreign-host DR, manual grant)
// and `brightspace` (manual D2L flow with foreign token host, custom tokenAudience, and UUID deployment)
// (AC-LA-E7-07-03, AC-LA-E2-05-03).
import {
  APP,
  BRIGHTSPACE_SIM,
  COURSE_ZIP,
  D2L_9_TOOL_ROW_KEYS,
  ERR,
  GENERIC_SIM,
  THANH,
  app,
  assertPortalResultsSent,
  check,
  cli,
  clipboardText,
  codeCleared,
  connection,
  createCourseWithZip,
  createSimScenario,
  escape,
  expect,
  fieldMarked,
  issueOperatorGrantCli,
  k2Case,
  next,
  noForbiddenFields,
  performLearnerCompletion,
  performTeacherDeepLinkPick,
  portalSignIn,
  publishCourseViaDialog,
  rememberPrivate,
   requireCourseZip,
  saveWizardConnection,
  selectRegistrationMethod,
  session,
  shot,
  sim,
  unique,
  urls,
  waitForFrame,
  type Json,
  type Target,
} from './lib/k2';

async function publicationForConnection(s: Json, courseId: string, connectionId: string): Promise<Json> {
  const res = await app(s as any, 'GET', `/app-api/publications?courseId=${encodeURIComponent(courseId)}`);
  const pub = (res.json.publications as Json[] | undefined)?.find((p) => p.connectionId === connectionId);
  check(pub, `Publication of course ${courseId} on connection ${connectionId}`);
  return pub!;
}

k2Case(
  'U3.lti-generic.dynamic-self',
  'lti-generic Dynamic Registration with same-origin endpoints completes without a grant, publishes a course, picks via Deep Linking, and syncs learner score 100',
  async ({ page, context }) => {
    requireCourseZip(COURSE_ZIP.html);
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: urls.app });
    const s = await session('A');
    await portalSignIn(page, THANH);

    const connName = unique('K2-U3-Generic-DR-Self');
    await page.goto(`${APP}/integrations/lti-generic/connect`);
    await page.getByLabel('Connection name').fill(connName);
    await page.getByLabel('LMS site URL', { exact: true }).fill(GENERIC_SIM.siteUrl);
    await selectRegistrationMethod(page, 'dynamic');
    await next(page);
    await page.waitForURL(/\/integrations\/lti-generic\/con_[^/]+$/, { timeout: 25_000 });
    const connectionId = new URL(page.url()).pathname.split('/').pop()!;

    const getRegBtn = page.getByRole('button', { name: /Get registration URL/i });
    if ((await getRegBtn.count()) > 0) {
      await getRegBtn.first().click();
    }
    const copyBtn = page.getByRole('button', { name: /Copy( registration URL)?/i }).first();
    await copyBtn.click();
    const regUrl = await clipboardText(page);
    const refParam = new URL(regUrl).searchParams.get('ref');
    if (refParam) rememberPrivate(refParam);

    const clientId = unique('k2-gen-dr-self');
    const deploymentId = GENERIC_SIM.deployments[0];
    const target: Target = {
      provider: GENERIC_SIM.provider,
      issuer: GENERIC_SIM.issuer,
      clientId,
      deploymentId,
      serviceHost: GENERIC_SIM.siteHost,
      pageHost: GENERIC_SIM.siteHost,
    };
    const drSc = await createSimScenario(target, {
      dr: { secondTokenHost: false },
    });

    const regPage = await context.newPage();
    try {
      const startUrl = `${regUrl}&openid_configuration=${encodeURIComponent(drSc.registration.openidConfiguration)}&registration_token=${encodeURIComponent(drSc.registration.registrationToken)}`;
      await regPage.goto(startUrl);
      await regPage.waitForURL((u) => u.origin === APP && u.pathname.startsWith('/tool/register'), {
        timeout: 25_000,
      });
      await regPage.getByRole('button', { name: 'Connect', exact: true }).click();
      await expect(regPage.getByText(/connected|registered|done/i).first()).toBeVisible({ timeout: 20_000 });
    } finally {
      await regPage.close();
    }

    const afterDr = await connection(s, connectionId);
    expect(afterDr.status).toBe('registered');
    expect(afterDr.bindingAuthority).toBe('self');

    const title = unique('K2-U3 Generic DR HTML');
    const courseId = await createCourseWithZip(page, title, COURSE_ZIP.html, 'HTML');
    await publishCourseViaDialog(page, courseId, connName);
    const pub = await publicationForConnection(s, courseId, connectionId);

    const picked = await performTeacherDeepLinkPick(page, target, GENERIC_SIM.siteUrl, title, 'k2-u3-generic-dr');
    expect(String(picked.items?.[0]?.url)).toContain(`resource=${pub.id}`);

    await performLearnerCompletion(page, target, String(pub.id), 'LMS', 'k2-u3-generic-dr');
    await assertPortalResultsSent(page, String(pub.id), GENERIC_SIM.siteHost);
    expect((await connection(s, connectionId)).status).toBe('connected');
    await shot(page, 'k2-u3-generic-dr-results');
  },
  480_000,
);

k2Case(
  'U3.lti-generic.dynamic-staged-foreign-host',
  'lti-generic Dynamic Registration with a foreign token host stages the platform, switches the wizard to operatorGrant, refuses CLI grant without --confirm-foreign-hosts, and registers with --accept-staged --confirm-foreign-hosts',
  async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: urls.app });
    const s = await session('A');
    await portalSignIn(page, THANH);

    const connName = unique('K2-U3-Generic-Staged-DR');
    await page.goto(`${APP}/integrations/lti-generic/connect`);
    await page.getByLabel('Connection name').fill(connName);
    await page.getByLabel('LMS site URL', { exact: true }).fill(GENERIC_SIM.siteUrl);
    await selectRegistrationMethod(page, 'dynamic');
    await next(page);
    await page.waitForURL(/\/integrations\/lti-generic\/con_[^/]+$/, { timeout: 25_000 });
    const connectionId = new URL(page.url()).pathname.split('/').pop()!;

    const getRegBtn = page.getByRole('button', { name: /Get registration URL/i });
    if ((await getRegBtn.count()) > 0) {
      await getRegBtn.first().click();
    }
    const copyBtn = page.getByRole('button', { name: /Copy( registration URL)?/i }).first();
    await copyBtn.click();
    const regUrl = await clipboardText(page);
    const refParam = new URL(regUrl).searchParams.get('ref');
    if (refParam) rememberPrivate(refParam);

    const clientId = unique('k2-gen-dr-staged');
    const deploymentId = GENERIC_SIM.deployments[1];
    const target: Target = {
      provider: GENERIC_SIM.provider,
      issuer: GENERIC_SIM.issuer,
      clientId,
      deploymentId,
      serviceHost: GENERIC_SIM.siteHost,
      pageHost: GENERIC_SIM.siteHost,
    };
    const drSc = await createSimScenario(target, {
      dr: { secondTokenHost: true },
    });

    const regPage = await context.newPage();
    try {
      const startUrl = `${regUrl}&openid_configuration=${encodeURIComponent(drSc.registration.openidConfiguration)}&registration_token=${encodeURIComponent(drSc.registration.registrationToken)}`;
      await regPage.goto(startUrl);
      await regPage.waitForURL((u) => u.origin === APP && u.pathname.startsWith('/tool/register'), {
        timeout: 25_000,
      });
      await regPage.getByRole('button', { name: 'Connect', exact: true }).click();
      await expect(
        regPage.getByText(
          'Done. Cogniate checks this connection before it works. Ask your Cogniate operator for the approval code.',
        ),
      ).toBeVisible({ timeout: 20_000 });
    } finally {
      await regPage.close();
    }

    const stagedDto = await connection(s, connectionId);
    expect(stagedDto.status).toBe('pending');
    expect(stagedDto.bindingAuthority).toBe('operatorGrant');

    // Reload the portal connection page: it now shows the staged operator-grant form (Client ID, Deployment ID, Approval code)
    await page.goto(`${APP}/integrations/lti-generic/${connectionId}`);
    await expect(page.getByLabel('Client ID', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Deployment ID', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Approval code', { exact: true })).toBeVisible();

    // Negative CLI check: --accept-staged without --confirm-foreign-hosts exits 1 because token host is foreign
    const unconfirmed = await cli('app:grant', [
      'issue',
      '--library',
      String(s.library.id),
      '--connection',
      connectionId,
      '--site',
      GENERIC_SIM.siteUrl,
      '--client-id',
      clientId,
      '--deployment-id',
      deploymentId,
      '--accept-staged',
    ]);
    expect(unconfirmed.code, 'CLI refuses foreign staged token host without --confirm-foreign-hosts').toBe(1);

    // Positive CLI grant with --accept-staged --confirm-foreign-hosts
    const grant = await issueOperatorGrantCli(s, connectionId, GENERIC_SIM.siteUrl, [
      '--client-id',
      clientId,
      '--deployment-id',
      deploymentId,
      '--accept-staged',
      '--confirm-foreign-hosts',
      '--note',
      'K2 U3 staged DR approval',
    ]);

    await page.getByLabel('Client ID', { exact: true }).fill(clientId);
    await page.getByLabel('Deployment ID', { exact: true }).fill(deploymentId);
    await page.getByLabel('Approval code', { exact: true }).fill(grant.code);
    await saveWizardConnection(page).first().click();

    await expect(page.getByText(/Registered/i).first()).toBeVisible({ timeout: 25_000 });
    expect((await connection(s, connectionId)).status).toBe('registered');
    await codeCleared(page, grant.code);
    await noForbiddenFields(page);
    await shot(page, 'k2-u3-generic-staged-dr-registered');
  },
  300_000,
);

k2Case(
  'U3.lti-generic.manual-grant',
  'lti-generic manual wizard refuses a mismatched jwksUrl with GRANT_MISMATCH, registers with matching bound values, and completes publish, Deep Linking, and learner score sync',
  async ({ page }) => {
    requireCourseZip(COURSE_ZIP.html);
    const s = await session('A');
    await portalSignIn(page, THANH);

    const connName = unique('K2-U3-Generic-Manual');
    await page.goto(`${APP}/integrations/lti-generic/connect`);
    await page.getByLabel('Connection name').fill(connName);
    await page.getByLabel('LMS site URL', { exact: true }).fill(GENERIC_SIM.siteUrl);
    await selectRegistrationMethod(page, 'manual');
    await next(page);
    await page.waitForURL(/\/integrations\/lti-generic\/con_[^/]+$/, { timeout: 25_000 });
    const connectionId = new URL(page.url()).pathname.split('/').pop()!;

    const clientId = unique('k2-gen-manual');
    const deploymentId = GENERIC_SIM.deployments[2];
    const grant = await issueOperatorGrantCli(s, connectionId, GENERIC_SIM.siteUrl, [
      '--client-id',
      clientId,
      '--deployment-id',
      deploymentId,
      '--issuer',
      GENERIC_SIM.issuer,
      '--auth-url',
      GENERIC_SIM.authUrl,
      '--token-url',
      GENERIC_SIM.foreignHostTokenUrl,
      '--jwks-url',
      GENERIC_SIM.jwksUrl,
      '--confirm-foreign-hosts',
      '--note',
      'K2 U3 manual generic approval',
    ]);

    // 1. Negative check: differing Public keyset URL -> GRANT_MISMATCH, marks Public keyset URL, clears code
    await page.getByLabel('Platform ID (issuer)', { exact: true }).fill(GENERIC_SIM.issuer);
    await page.getByLabel('Client ID', { exact: true }).fill(clientId);
    await page.getByLabel('Deployment ID', { exact: true }).fill(deploymentId);
    await page.getByLabel('Authentication request URL', { exact: true }).fill(GENERIC_SIM.authUrl);
    await page.getByLabel('Access token URL', { exact: true }).fill(GENERIC_SIM.foreignHostTokenUrl);
    await page.getByLabel('Public keyset URL', { exact: true }).fill('https://generic.sim.test/lti/wrong-jwks.json');
    await page.getByLabel('Approval code', { exact: true }).fill(grant.code);
    await saveWizardConnection(page).first().click();

    await expect(page.getByText(ERR.grantMismatch, { exact: true })).toBeVisible();
    await fieldMarked(page, 'Public keyset URL');
    expect((await connection(s, connectionId)).status).toBe('pending');
    await codeCleared(page, grant.code);

    // 2. Positive check: matching bound values -> registered
    await page.getByLabel('Public keyset URL', { exact: true }).fill(GENERIC_SIM.jwksUrl);
    await page.getByLabel('Approval code', { exact: true }).fill(grant.code);
    await saveWizardConnection(page).first().click();

    await expect(page.getByText(/Registered/i).first()).toBeVisible({ timeout: 25_000 });
    expect((await connection(s, connectionId)).status).toBe('registered');
    await codeCleared(page, grant.code);

    const title = unique('K2-U3 Generic Manual HTML 1');
    const courseId = await createCourseWithZip(page, title, COURSE_ZIP.html, 'HTML');
    await publishCourseViaDialog(page, courseId, connName);
    const pub = await publicationForConnection(s, courseId, connectionId);

    const title2 = unique('K2-U3 Generic Manual HTML 2');
    const courseId2 = await createCourseWithZip(page, title2, COURSE_ZIP.html, 'HTML');
    await publishCourseViaDialog(page, courseId2, connName);
    const pub2 = await publicationForConnection(s, courseId2, connectionId);

    const target: Target = {
      provider: GENERIC_SIM.provider,
      issuer: GENERIC_SIM.issuer,
      clientId,
      deploymentId,
      serviceHost: GENERIC_SIM.siteHost,
      pageHost: GENERIC_SIM.siteHost,
    };

    // 3a. Deep Linking picker Cancel on lti-generic (LA-E3-05 D3a: content_items=[], msg="No course was added.")
    const cancelSc = await createSimScenario(target, {
      messageType: 'LtiDeepLinkingRequest',
      roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
      dlAllowCancel: true,
    });
    await page.goto(`${GENERIC_SIM.siteUrl}/__frame?url=${encodeURIComponent(cancelSc.loginUrl)}`);
    const cancelPicker = await waitForFrame(page, (u) => u.origin === APP && u.pathname.startsWith('/tool/picker/'));
    await cancelPicker.getByRole('button', { name: 'Cancel', exact: true }).click();
    let cancelRecord: Json | undefined;
    for (let i = 0; i < 80; i++) {
      const recs = ((await sim('/records?since=0')).json?.records ?? []) as Json[];
      cancelRecord = recs.find((r) => r.kind === 'deep-link' && r.scenario === cancelSc.id);
      if (cancelRecord) break;
      await page.waitForTimeout(250);
    }
    expect(cancelRecord, 'Deep Linking Cancel return recorded in simulator').toBeDefined();
    expect(cancelRecord!.cancelled).toBe(true);
    expect(cancelRecord!.itemCount).toBe(0);
    expect(cancelRecord!.msg).toBe('No course was added.');

    // 3b. Deep Linking picker multi-select checkboxes on lti-generic (content.multiple=true & acceptMultiple=true)
    const multiSc = await createSimScenario(target, {
      messageType: 'LtiDeepLinkingRequest',
      roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
      acceptMultiple: true,
    });
    await page.goto(`${GENERIC_SIM.siteUrl}/__frame?url=${encodeURIComponent(multiSc.loginUrl)}`);
    const multiPicker = await waitForFrame(page, (u) => u.origin === APP && u.pathname.startsWith('/tool/picker/'));
    await multiPicker.getByRole('checkbox', { name: new RegExp(escape(title)) }).check();
    await multiPicker.getByRole('checkbox', { name: new RegExp(escape(title2)) }).check();
    await shot(page, 'k2-u3-generic-manual-multipick');
    await multiPicker
      .getByRole('button', { name: /Select|Add|Insert|Confirm|Continue/i })
      .or(multiPicker.locator('button[type="submit"]'))
      .first()
      .click();
    let multiRecord: Json | undefined;
    for (let i = 0; i < 80; i++) {
      const recs = ((await sim('/records?since=0')).json?.records ?? []) as Json[];
      multiRecord = recs.find((r) => r.kind === 'deep-link' && r.scenario === multiSc.id);
      if (multiRecord) break;
      await page.waitForTimeout(250);
    }
    expect(multiRecord, 'Multi-select Deep Linking return recorded in simulator').toBeDefined();
    expect(multiRecord!.itemCount).toBe(2);
    const returnedUrls = (multiRecord!.items as Json[]).map((it) => String(it.url));
    expect(returnedUrls.some((u) => u.includes(`resource=${pub.id}`))).toBe(true);
    expect(returnedUrls.some((u) => u.includes(`resource=${pub2.id}`))).toBe(true);

    await performLearnerCompletion(page, target, String(pub.id), 'LMS', 'k2-u3-generic-manual');
    await assertPortalResultsSent(page, String(pub.id), GENERIC_SIM.siteHost);
    expect((await connection(s, connectionId)).status).toBe('connected');
    await shot(page, 'k2-u3-generic-manual-results');
  },
  480_000,
);

k2Case(
  'U3.brightspace.manual-flow',
  'brightspace manual wizard shows the 9 D2L tool rows and 5 D2L defaults, registers with foreign token host + custom tokenAudience + UUID deployment, and completes Deep Linking and score sync with custom assertion aud',
  async ({ page }) => {
    requireCourseZip(COURSE_ZIP.html);
    const s = await session('A');
    await portalSignIn(page, THANH);

    const connName = unique('K2-U3-Brightspace');
    await page.goto(`${APP}/integrations/brightspace/connect`);
    await page.getByLabel('Connection name').fill(connName);
    await page.getByLabel('Brightspace URL', { exact: true }).fill(BRIGHTSPACE_SIM.siteUrl);
    await selectRegistrationMethod(page, 'manual');
    await next(page);
    await page.waitForURL(/\/integrations\/brightspace\/con_[^/]+$/, { timeout: 25_000 });
    const connectionId = new URL(page.url()).pathname.split('/').pop()!;

    // Verify all 9 D2L tool-configuration rows are rendered in order
    for (const key of D2L_9_TOOL_ROW_KEYS) {
      await expect(page.locator(`[data-key="${key}"]`).first(), `Brightspace row ${key}`).toBeVisible();
    }

    // Verify the 5 D2L defaults are pre-filled
    await expect(page.getByLabel('Issuer', { exact: true })).toHaveValue(BRIGHTSPACE_SIM.siteUrl);
    await expect(page.getByLabel('OpenID Connect authentication endpoint', { exact: true })).toHaveValue(
      `${BRIGHTSPACE_SIM.siteUrl}/d2l/lti/authenticate`,
    );
    await expect(page.getByLabel('Brightspace keyset URL', { exact: true })).toHaveValue(
      `${BRIGHTSPACE_SIM.siteUrl}/d2l/.well-known/jwks`,
    );
    await expect(page.getByLabel('Brightspace OAuth2 access token URL', { exact: true })).toHaveValue(
      'https://auth.brightspace.com/core/connect/token',
    );
    await expect(page.getByLabel('OAuth2 audience', { exact: true })).toHaveValue(
      'https://api.brightspace.com/auth/token',
    );

    const clientId = unique('k2-bspace-client');
    const deploymentId = BRIGHTSPACE_SIM.deployments[0];
    const grant = await issueOperatorGrantCli(s, connectionId, BRIGHTSPACE_SIM.siteUrl, [
      '--client-id',
      clientId,
      '--deployment-id',
      deploymentId,
      '--issuer',
      BRIGHTSPACE_SIM.issuer,
      '--auth-url',
      BRIGHTSPACE_SIM.authUrl,
      '--token-url',
      BRIGHTSPACE_SIM.tokenUrl,
      '--jwks-url',
      BRIGHTSPACE_SIM.jwksUrl,
      '--token-audience',
      BRIGHTSPACE_SIM.tokenAudience,
      '--confirm-foreign-hosts',
      '--note',
      'K2 U3 Brightspace approval',
    ]);

    await page.getByLabel('Client ID', { exact: true }).fill(clientId);
    await page.getByLabel('Deployment ID', { exact: true }).fill(deploymentId);
    await page.getByLabel('Brightspace OAuth2 access token URL', { exact: true }).fill(BRIGHTSPACE_SIM.tokenUrl);
    await page.getByLabel('OAuth2 audience', { exact: true }).fill(BRIGHTSPACE_SIM.tokenAudience);
    await page.getByLabel('Approval code', { exact: true }).fill(grant.code);
    await saveWizardConnection(page).first().click();

    await expect(page.getByText(/Registered/i).first()).toBeVisible({ timeout: 25_000 });
    expect((await connection(s, connectionId)).status).toBe('registered');
    await codeCleared(page, grant.code);

    const title = unique('K2-U3 Brightspace HTML');
    const courseId = await createCourseWithZip(page, title, COURSE_ZIP.html, 'HTML');
    await publishCourseViaDialog(page, courseId, connName);
    const pub = await publicationForConnection(s, courseId, connectionId);

    const target: Target = {
      provider: BRIGHTSPACE_SIM.provider,
      issuer: BRIGHTSPACE_SIM.issuer,
      clientId,
      deploymentId,
      serviceHost: BRIGHTSPACE_SIM.siteHost,
      pageHost: BRIGHTSPACE_SIM.siteHost,
    };
    const picked = await performTeacherDeepLinkPick(page, target, BRIGHTSPACE_SIM.siteUrl, title, 'k2-u3-brightspace');
    expect(String(picked.items?.[0]?.url)).toContain(`resource=${pub.id}`);

    await performLearnerCompletion(page, target, String(pub.id), 'Brightspace', 'k2-u3-brightspace');

    // Verify in /__sim/records that the token assertion audience equals BRIGHTSPACE_SIM.tokenAudience
    const records = ((await sim('/records?since=0')).json?.records ?? []) as Json[];
    const tokenRecord = records.find(
      (r) => r.kind === 'token' && r.provider === BRIGHTSPACE_SIM.provider && r.clientId === clientId,
    );
    expect(tokenRecord, 'Brightspace token record in /__sim/records').toBeDefined();
    expect(tokenRecord!.audience).toBe(BRIGHTSPACE_SIM.tokenAudience);

    await assertPortalResultsSent(page, String(pub.id), BRIGHTSPACE_SIM.siteHost);
    expect((await connection(s, connectionId)).status).toBe('connected');
    await shot(page, 'k2-u3-brightspace-results');
  },
  480_000,
);
