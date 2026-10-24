// Slot 8 MOODLE-LIVE E2E verification suite (QA-E2E):
// - LA-E7-09 live Moodle K2 (U1 cards + U2 wizards on default profile + U1/U2 continuity across service restarts)
// - LA-E3-05 AC-LA-E3-05-04 (Moodle accept_multiple: true still renders radio list & picks 1 item)
// - LA-E3-05 AC-LA-E3-05-11 (Moodle 5.2.4 picker Cancel button posts content_items: [] + "No course was added.", creates 0 activities)
// - LA-E4-03 AC-LA-E4-03-09 browser part (Moodle 5.2.4 HTML + SCORM 1.2 learner launches, lti-ags score sync 100.00, portal results Sent)
// - LA-E5-22 AC-LA-E5-22-06 / A-LAB-09 (Moodle course shell creation with cgk1-sealed and legacy pre-upgrade ws_token_encrypted blobs)
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { appApi, createCourse, QA_B, signIn, THANH, uploadVersion } from '../../acceptance/lib/app';
import { courseZipCopy } from '../../acceptance/lib/course-fixtures';
import { httpsRequest } from '../../acceptance/lib/https';
import { callWs } from '../../acceptance/lib/moodle-ws';
import { seed } from '../../acceptance/lib/seed';
import { blankScoZip } from '../../acceptance/lib/t5';
import { captureLti } from '../lib/capture';
import {
  CONNECTION_A,
  COURSE_HTML,
  COURSE_SCORM,
  LIBRARY_A,
  loadState,
  markDone,
  need,
  note,
  resetState,
  saveState,
  shot,
  teacherHint,
  timed,
  TOOL_A,
  urls,
  writeEvidence,
} from '../lib/e2e';
import { addCogniateActivity, checkLaunch, learnerRun } from '../lib/flows';
import { healthOf, knobEvents, ORIGINS } from '../lib/health';
import {
  activateTool,
  addActivityFromChooser,
  cancelActivityForm,
  editToolSettings,
  ensureEditMode,
  graderReport,
  login,
  MANAGE_TOOLS,
  moodlePage,
  NEW_WINDOW,
  openSelectContent,
  readToolSettings,
  toolCard,
  USAGE_CHOOSER,
  waitRegistrationClosed,
  waitRegistrationFrame,
} from '../lib/moodle';
import { cmidByName, course101, course102, grade, ltiModules, users } from '../lib/oracle';
import {
  cellUnder,
  clipboard,
  connectionOf,
  createCourseWithZip,
  portalSignIn,
  publicationBlockText,
  publicationOf,
  publishCourse,
  resultsApi,
  resultsRow,
  startConnect,
} from '../lib/portal';
import { expect, newContext, test } from '../lib/pw';
import {
  APP,
  D2L_9_TOOL_ROW_KEYS,
  ERR,
  MOODLE_16_TOOL_ROW_KEYS,
  STANDARD_14_TOOL_ROW_KEYS,
  admin,
  app,
  card,
  clipboardText,
  connectControl,
  connection,
  connections,
  escape,
  fieldMarked,
  fillText,
  integrations,
  loadProductChannelRegistry,
  manageControl,
  next,
  noForbiddenFields,
  ok,
  rememberPrivate,
  selectRegistrationMethod,
  session,
  unique,
  type ChannelManifest,
  type FieldSpec,
  type Json,
} from './lib/k2';

const SLOT8_STATE_FILE = path.join(__dirname, '..', 'artifacts', 'slot8-state.json');

interface Slot8State {
  connectionId?: string;
  typeId?: number;
  htmlCourseId?: string;
  htmlPubId?: string;
  scormCourseId?: string;
  scormPubId?: string;
  htmlCmid?: number;
  scormCmid?: number;
  shellCgk1?: { courseId: string; versionId: string; moodleCourseId?: number };
  shellLegacyU1?: { courseId: string; versionId: string };
  preRestartPickerUrl?: string;
}

function readSlot8State(): Slot8State {
  if (!fs.existsSync(SLOT8_STATE_FILE)) return {};
  return JSON.parse(fs.readFileSync(SLOT8_STATE_FILE, 'utf8')) as Slot8State;
}

function writeSlot8State(patch: Partial<Slot8State>): Slot8State {
  fs.mkdirSync(path.dirname(SLOT8_STATE_FILE), { recursive: true });
  const nextState = { ...readSlot8State(), ...patch };
  fs.writeFileSync(SLOT8_STATE_FILE, JSON.stringify(nextState, null, 2));
  return nextState;
}

async function ensureDefaultSharedBlackboardPlatform(): Promise<string> {
  const providers = await admin('GET', '/api/providers');
  ok(providers, 200, 'GET /api/providers');
  const bbProfile = (providers.json.profiles as Json[]).find((p) => p.id === 'blackboard');
  if (bbProfile?.sharedPlatform) return String((bbProfile.sharedPlatform as Json).id);
  const created = await admin('POST', '/api/platforms', {
    profile: 'blackboard',
    clientId: 'qa-slot8-bb-cloud-client-id',
    name: 'QA Slot 8 Blackboard Cloud',
  });
  ok(created, 201, 'POST /api/platforms (blackboard shared platform)');
  return String(created.json.id);
}

function defaultRealSiteUrl(channelId: string): string {
  switch (channelId) {
    case 'moodle':
      return 'https://moodle-u2.cogniate.test';
    case 'canvas':
      return 'https://school-u2.instructure.com';
    case 'blackboard':
      return 'https://learn-u2.blackboard.cogniate.test';
    case 'lti-generic':
      return 'https://generic-u2.cogniate.test';
    case 'brightspace':
      return 'https://brightspace-u2.cogniate.test';
    default:
      return `https://${channelId}-u2.cogniate.test`;
  }
}

async function createPendingInDefaultProfile(
  page: Page,
  m: ChannelManifest,
  method: 'dynamic' | 'manual',
): Promise<{ connectionId: string; name: string; siteUrl: string }> {
  const name = unique(`S8-U2-${m.id}-${method}`);
  const siteUrl = defaultRealSiteUrl(m.id);
  const siteField = (m.setup.createFields as FieldSpec[]).find((f) => f.key === 'siteUrl')!;

  await page.goto(`${APP}/integrations/${m.id}/connect`);
  await page.getByLabel('Connection name').fill(name);
  await page.getByLabel(siteField.label, { exact: true }).fill(siteUrl);

  if (m.registration.length > 1) {
    await selectRegistrationMethod(page, method);
  }

  await next(page);
  await page.waitForURL(new RegExp(`/integrations/${escape(m.id)}/con_[^/]+$`), { timeout: 25_000 });
  await expect(page.getByText('Loading…')).toHaveCount(0, { timeout: 15_000 });
  const connectionId = new URL(page.url()).pathname.split('/').pop()!;
  return { connectionId, name, siteUrl };
}

function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const parts = jwt.split('.');
  if (parts.length !== 3) return {};
  try {
    return JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

const idnumberFor = (courseId: string) => `cogniate:${courseId}:default:en`;

async function coursesByIdnumber(value: string) {
  return (
    await callWs<{ courses: { id: number; idnumber: string; visible: number; shortname: string }[] }>(
      seed().oracleToken,
      'core_course_get_courses_by_field',
      { field: 'idnumber', value },
    )
  ).courses;
}

const PHASE = process.env.QA_SLOT8_PHASE ?? 'pass1';

test.describe.serial(`Slot 8 MOODLE-LIVE (${PHASE})`, () => {
  if (PHASE === 'pass1') {
    test('S8-01 [LA-E7-09 / AC-LA-E7-09-03 / AC-LA-E7-09-04] K2.MOODLE.U1-cards: default profile /healthz is clean and Integrations hub renders all 5 channels in manifest card.order', async ({
      browser,
    }, testInfo) => {
      test.setTimeout(180_000);
      resetState();
      await ensureDefaultSharedBlackboardPlatform();

      const health: Record<string, unknown> = {};
      for (const origin of ORIGINS()) {
        const h = await healthOf(origin);
        health[origin] = h;
        expect(h.status, `${origin}/healthz status`).toBe(200);
        expect(h.body.profile, `${origin} profile`).toBe('default');
        expect(h.body.knobs, `${origin} knobs`).toEqual([]);
      }
      writeEvidence('s8-01-health-start.json', health);
      expect(knobEvents(), 'no test_knob_active event in infra/.logs').toEqual([]);

      const registry = await loadProductChannelRegistry(false);
      const manifests = [...registry.channels()].sort((a, b) => a.card.order - b.card.order);
      expect(manifests.map((m) => m.id)).toEqual(['moodle', 'canvas', 'blackboard', 'lti-generic', 'brightspace']);

      const s = await session('A');
      const provRes = await app(s, 'GET', '/app-api/lms-providers');
      ok(provRes, 200, 'GET /app-api/lms-providers');
      const apiList = (provRes.json.lms ?? provRes.json.providers ?? []) as Json[];
      expect(apiList.map((e) => String(e.channel ?? e.lms))).toEqual(manifests.map((m) => m.id));

      const ctx = await newContext(browser);
      try {
        const page = await ctx.newPage();
        await portalSignIn(page, THANH);
        await integrations(page);

        const cardLocators = manifests.map((m) =>
          page.getByRole('article', { name: m.card.title, exact: true }).or(card(page, m.card.title)).first(),
        );
        for (const [idx, m] of manifests.entries()) {
          await expect(cardLocators[idx]!, `Card visible for ${m.id}`).toBeVisible();
        }

        const domPositions: number[] = [];
        for (const loc of cardLocators) {
          const pos = await loc.evaluate((el) => Array.from(document.querySelectorAll('*')).indexOf(el));
          domPositions.push(pos);
        }
        for (let i = 1; i < domPositions.length; i++) {
          expect(domPositions[i]!).toBeGreaterThan(domPositions[i - 1]!);
        }

        for (const m of manifests) {
          await integrations(page);
          const c = page.getByRole('article', { name: m.card.title, exact: true }).or(card(page, m.card.title)).first();
          await expect(c.getByRole('heading', { name: m.card.title, exact: true })).toBeVisible();
          await expect(c.getByText(m.card.description, { exact: true })).toBeVisible();
          if (m.card.icon) {
            await expect(c.locator(`[data-icon="${m.card.icon}"], svg, img, [role="img"]`).first()).toBeVisible();
          } else {
            await expect(c.getByText(m.card.mark, { exact: true }).first()).toBeVisible();
          }
          const connectBtn = connectControl(c);
          const manageBtn = manageControl(c);
          if ((await connectBtn.count()) > 0) {
            await connectBtn.first().click();
          } else {
            await manageBtn.first().click();
            const another = page
              .getByRole('link', { name: /Connect another site/i })
              .or(page.getByRole('button', { name: /Connect another site/i }));
            if ((await another.count()) > 0) await another.first().click();
            else await page.goto(`${APP}/integrations/${m.id}/connect`);
          }
          await page.waitForURL(new RegExp(`/integrations/${m.id}/connect$`));
          await expect(page.getByLabel('Connection name')).toBeVisible();
          await noForbiddenFields(page);
        }
        await shot(page, 's8-01-k2-u1-cards', testInfo);
      } finally {
        await ctx.close();
      }
    });

    test('S8-02 [LA-E7-09 / AC-LA-E7-09-04 / LA-E3-07 AC-03] K2.MOODLE.U2-wizards: Step 1 createFields + Rule 1, Step 2 artifacts + 16 Moodle tool rows (row 13 "Do not use this service"), Step 3 bindingFields + defaults + adminSteps across all 5 channels on default profile', async ({
      browser,
    }, testInfo) => {
      test.setTimeout(300_000);
      await ensureDefaultSharedBlackboardPlatform();
      const registry = await loadProductChannelRegistry(false);
      const manifests = [...registry.channels()].sort((a, b) => a.card.order - b.card.order);
      const s = await session('B');

      const ctx = await newContext(browser, { clipboard: true });
      try {
        const page = await ctx.newPage();
        await portalSignIn(page, QA_B);

        for (const m of manifests) {
          const caps = registry.capabilities(m.id);
          await page.goto(`${APP}/integrations/${m.id}/connect`);
          await expect(page.getByLabel('Connection name')).toBeVisible();

          const createFields = m.setup.createFields as FieldSpec[];
          for (const field of createFields) {
            if (
              m.id === 'blackboard' &&
              field.key === 'profile' &&
              (await page.getByLabel(field.label, { exact: true }).count()) === 0
            ) {
              continue;
            }
            await expect(page.getByLabel(field.label, { exact: true }), `${m.id}: ${field.label}`).toBeVisible();
          }

          // Rule 1 origin validation
          const siteField = createFields.find((f) => f.key === 'siteUrl')!;
          const beforeCount = (await connections(s)).length;
          const step1Text = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
          await page.getByLabel('Connection name').fill(unique(`Rule1-${m.id}`));
          await page.getByLabel(siteField.label, { exact: true }).fill(`${defaultRealSiteUrl(m.id)}/not-an-origin`);
          await next(page);
          await expect(
            page.getByText(ERR.rule[1], { exact: true }).or(page.getByText(/Do not add a path\.|No path\./i)).first(),
          ).toBeVisible();
          if (['moodle', 'canvas', 'blackboard'].includes(m.id)) {
            await fieldMarked(page, siteField.label);
          }
          expect((await connections(s)).length).toBe(beforeCount);

          let dynText = '';
          let manualText = '';

          // Dynamic registration Step 2 check
          const dynEntry = m.registration.find((r) => r.method === 'dynamic');
          if (dynEntry) {
            const { connectionId } = await createPendingInDefaultProfile(page, m, 'dynamic');
            const copyBtn = page.getByRole('button', { name: /^Copy registration URL$/i }).first();
            if ((await copyBtn.count()) === 0) {
              const getRegBtn = page.getByRole('button', { name: /Get registration URL/i });
              if ((await getRegBtn.count()) > 0) await getRegBtn.first().click();
            }
            await expect(copyBtn).toBeVisible();
            await copyBtn.click();
            const copiedUrl = await clipboardText(page);
            expect(copiedUrl).toMatch(new RegExp(`^${escape(urls.lti)}/lti/register/cogniate\\?ref=`));
            const refParam = new URL(copiedUrl).searchParams.get('ref');
            if (refParam) rememberPrivate(refParam);
            const dto = await connection(s, connectionId);
            expect(dto.status).toBe('pending');
            expect(dto.bindingAuthority).toBe(dynEntry.authority);
            dynText = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
          }

          // Manual registration Step 2 & Step 3 checks
          if (m.registration.some((r) => r.method === 'manual')) {
            const { connectionId, siteUrl } = await createPendingInDefaultProfile(page, m, 'manual');
            const hasDevKeyArtifact = caps['setup.artifacts'].includes('developer-key-json');
            if (hasDevKeyArtifact) {
              await expect(page.getByRole('button', { name: 'Copy JSON', exact: true })).toBeVisible();
              await expect(page.getByRole('button', { name: 'Download JSON', exact: true })).toBeVisible();
            } else {
              await expect(page.getByRole('button', { name: 'Copy JSON', exact: true })).toHaveCount(0);
              await expect(page.getByRole('button', { name: 'Download JSON', exact: true })).toHaveCount(0);
            }

            if (!hasDevKeyArtifact && m.id !== 'blackboard') {
              const cfgRes = await app(s, 'GET', `/app-api/connections/${connectionId}/tool-configuration`);
              ok(cfgRes, 200, `${m.id}: GET /tool-configuration`);
              const apiRows = (
                Array.isArray(cfgRes.json) ? cfgRes.json : (cfgRes.json.rows ?? cfgRes.json.fields ?? [])
              ) as Array<{ key: string; label: string; value: string }>;
              const expectedKeys =
                m.setup.toolRows && m.setup.toolRows.length > 0
                  ? m.setup.toolRows.map((r) => r.key)
                  : m.id === 'moodle'
                    ? [...MOODLE_16_TOOL_ROW_KEYS]
                    : m.id === 'brightspace'
                      ? [...D2L_9_TOOL_ROW_KEYS]
                      : m.id === 'lti-generic'
                        ? [
                            'tool_name',
                            'login_url',
                            'redirect_uri',
                            'target_link_uri',
                            'jwks_url',
                            'deep_linking_url',
                            'scopes',
                            'privacy',
                          ]
                        : [...STANDARD_14_TOOL_ROW_KEYS];
              expect(apiRows.map((r) => r.key)).toEqual(expectedKeys);
              if (m.id === 'moodle') {
                // LA-E3-07 AC-LA-E3-07-03 / LA-IC-04: row 13 (nrps) is "Do not use this service"
                const nrpsRow = apiRows[12]!;
                expect(nrpsRow.key).toBe('nrps');
                expect(nrpsRow.value).toBe('Do not use this service');
              }
            }

            const manualFields = (m.setup.bindingFields as FieldSpec[]).filter(
              (f) => !f.method || f.method === 'manual',
            );
            for (const field of manualFields) {
              if (m.id === 'blackboard' && field.key === 'clientId') {
                await expect(page.getByText('Client ID').first()).toBeVisible();
                continue;
              }
              const input = page.getByLabel(field.label, { exact: true });
              await expect(input, `${m.id}: bindingField ${field.label}`).toBeVisible();
              if (field.default !== undefined) {
                await expect(input).toHaveValue(field.default.replaceAll('{siteUrl}', siteUrl));
              }
            }

            const manualAuthority = caps['binding.authority'].manual;
            if (manualAuthority === 'operatorGrant') {
              await expect(page.getByLabel('Approval code')).toBeVisible();
            } else {
              await expect(page.getByLabel('Approval code')).toHaveCount(0);
            }
            manualText = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
          }

          const bodyText = `${step1Text} ${dynText} ${manualText}`;
          const expectedTool = `Cogniate (${s.library.name})`;
          for (const stepTemplate of m.texts.adminSteps) {
            const filled = fillText(stepTemplate, {
              LMS: m.names.text,
              tool: expectedTool,
              site: defaultRealSiteUrl(m.id),
            });
            expect(bodyText, `${m.id}: adminStep "${filled}" rendered`).toContain(filled);
          }
          expect(bodyText).not.toMatch(/\{(LMS|tool|site)\}/);
          expect(bodyText.toLowerCase()).not.toContain('your your lms');
        }
        await shot(page, 's8-02-k2-u2-wizards', testInfo);
      } finally {
        await ctx.close();
      }
    });

    test('S8-03 [LA-E7-09 / LA-E2-02 AC-08 / LA-E3-07 AC-03 / LA-E5-22 AC-06] K2.MOODLE.connect-and-publish: live Moodle 5.2.4 Dynamic Registration, Web Services token sealing, course shell creation, and HTML + SCORM 1.2 publish', async ({
      browser,
    }, testInfo) => {
      test.setTimeout(300_000);
      const thanhCtx = await newContext(browser, { clipboard: true });
      const adminCtx = await newContext(browser);
      try {
        const portal = await thanhCtx.newPage();
        const regUrl = await timed('S8-A1', async () => {
          await portalSignIn(portal, THANH);
          const connectionId = await startConnect(portal, CONNECTION_A, 'dynamic');
          saveState({ connectionA: connectionId });
          writeSlot8State({ connectionId });
          await portal.getByRole('button', { name: /^Copy/ }).first().click();
          return clipboard(portal);
        });
        expect(regUrl).toMatch(new RegExp(`^${escape(urls.lti)}/lti/register/cogniate\\?ref=`));
        const refParam = new URL(regUrl).searchParams.get('ref');
        if (refParam) rememberPrivate(refParam);

        const moodleAdmin = await moodlePage(adminCtx);
        await login(moodleAdmin, users().admin);
        await moodleAdmin.goto(MANAGE_TOOLS());
        await moodleAdmin.locator('#tool-url').fill(regUrl);
        await moodleAdmin.getByRole('button', { name: 'Add LTI Advantage', exact: true }).click();
        let frame = await waitRegistrationFrame(moodleAdmin);
        if (frame.kind === 'choice') {
          const btn = frame.frame.getByRole('button', { name: 'Register as a new external tool', exact: true });
          if (await btn.count()) await btn.click();
          else await frame.frame.locator('button[data-href$="&type=0"]').first().click();
          frame = await waitRegistrationFrame(moodleAdmin, { skipChoice: true });
        }
        expect(frame.kind).toBe('confirm');
        expect(frame.text).toContain(LIBRARY_A);
        expect(frame.text).toContain(urls.moodle);
        await frame.frame.getByRole('button', { name: 'Connect', exact: true }).click();
        await waitRegistrationClosed(moodleAdmin, TOOL_A);
        await activateTool(moodleAdmin, TOOL_A);
        await editToolSettings(moodleAdmin, TOOL_A, []);

        const settings = await readToolSettings(moodleAdmin, TOOL_A, (p, n) => shot(p, n, testInfo), 's8-03-tool-A');
        const typeId = Number(await toolCard(moodleAdmin, TOOL_A).getAttribute('data-type-id'));
        saveState({ typeIdA: typeId, done: { A2: true } });
        writeSlot8State({ typeId });
        expect(settings.badge).toBe('Active');
        expect(settings.usage).toBe(USAGE_CHOOSER);
        expect(settings.container).toBe(NEW_WINDOW);

        const connectionId = need(readSlot8State().connectionId, 'connectionId');
        await portal.reload();
        await expect(portal.getByText('Registered — activate in Moodle').first()).toBeVisible({ timeout: 15_000 });
        expect((await connectionOf(THANH, connectionId)).status).toBe('registered');

        // Configure Moodle Web Services token (seals connection.ws_token_encrypted with "cgk1")
        const thanhSession = await signIn(THANH);
        const wsToken = seed().productToken;
        rememberPrivate(wsToken);
        const wsRes = await appApi<{ siteName?: string; release?: string; functions?: string[] }>(
          'PUT',
          `/app-api/connections/${encodeURIComponent(connectionId)}/web-services`,
          { cookie: thanhSession.cookie, body: { token: wsToken } },
        );
        expect(wsRes.status, wsRes.body.slice(0, 300)).toBe(200);
        expect(String(wsRes.json.release)).toMatch(/^5\.2/);

        // Create two blank-SCO courses for AC-LA-E5-22-06 course shell checks (one now with cgk1, one in Pass 2 after legacy U1 blob + restart)
        const runSuffix = `${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;
        const cgk1Course = await createCourse(thanhSession, `QA S8 Shell cgk1 ${runSuffix}`);
        const cgk1Up = await uploadVersion(thanhSession, cgk1Course.id, blankScoZip());
        expect(cgk1Up.status).toBe(201);
        const cgk1VerId = String((cgk1Up.json as { id?: string }).id ?? '');

        const legacyCourse = await createCourse(thanhSession, `QA S8 Shell legacyU1 ${runSuffix}`);
        const legacyUp = await uploadVersion(thanhSession, legacyCourse.id, blankScoZip());
        expect(legacyUp.status).toBe(201);
        const legacyVerId = String((legacyUp.json as { id?: string }).id ?? '');

        const shellPub = await appApi<{
          shellStatus?: string;
          shellError?: string | null;
          moodleCourse?: { id: number; idnumber: string; url: string };
        }>('POST', '/app-api/publications', {
          cookie: thanhSession.cookie,
          body: { connectionId, courseId: cgk1Course.id, versionId: cgk1VerId, createMoodleCourse: {} },
        });
        expect([200, 201], shellPub.body.slice(0, 300)).toContain(shellPub.status);
        expect(shellPub.json.shellStatus, `shellError: ${shellPub.json.shellError}`).toBe('created');
        expect(shellPub.json.moodleCourse?.idnumber).toBe(idnumberFor(cgk1Course.id));
        const shellCourses = await coursesByIdnumber(idnumberFor(cgk1Course.id));
        expect(shellCourses).toHaveLength(1);
        expect(shellCourses[0]!.visible).toBe(0);

        writeSlot8State({
          shellCgk1: { courseId: cgk1Course.id, versionId: cgk1VerId, moodleCourseId: shellCourses[0]!.id },
          shellLegacyU1: { courseId: legacyCourse.id, versionId: legacyVerId },
        });

        // Upload & publish SCORM 1.2 and HTML courses via the portal UI
        for (const c of [
          { key: 'scorm' as const, title: COURSE_SCORM, format: 'SCORM 1.2' as const },
          { key: 'html' as const, title: COURSE_HTML, format: 'HTML' as const },
        ]) {
          const courseId = await createCourseWithZip(portal, c.title, courseZipCopy(c.key), c.format);
          saveState({ courses: { [c.key]: courseId } });
          await publishCourse(portal, CONNECTION_A);
          await expect(portal.getByText(teacherHint(TOOL_A)).first()).toBeVisible();
          const pub = await publicationOf(THANH, courseId);
          saveState({ publications: { [c.key]: pub.id } });
          if (c.key === 'html') writeSlot8State({ htmlCourseId: courseId, htmlPubId: pub.id });
          if (c.key === 'scorm') writeSlot8State({ scormCourseId: courseId, scormPubId: pub.id });
        }
        markDone('A3');
        await shot(portal, 's8-03-published-courses', testInfo);
      } finally {
        await thanhCtx.close();
        await adminCtx.close();
      }
    });

    test('S8-04 [LA-E3-05 AC-LA-E3-05-04 & AC-LA-E3-05-11] Moodle 5.2.4 Deep Linking picker: sends accept_multiple: true yet renders single-select radios; Cancel posts content_items: [] ("No course was added."), closes modal without creating an activity, and consumes the session; picking adds SCORM & HTML activities', async ({
      browser,
    }, testInfo) => {
      test.setTimeout(300_000);
      const st = readSlot8State();
      const htmlPubId = need(st.htmlPubId, 'htmlPubId');
      const scormPubId = need(st.scormPubId, 'scormPubId');

      const ctx = await newContext(browser);
      try {
        const cap = await captureLti(ctx, 'S8-04 teacher deep linking & cancel');
        const page = await moodlePage(ctx);
        await login(page, users().cg_teacher);

        let dlLaunchIdToken = '';
        let cancelPostStatus = 0;
        let cancelPostBody = '';
        page.context().on('request', (req) => {
          if (req.method() === 'POST' && req.url().startsWith(`${urls.lti}/lti/launch/cogniate`)) {
            const params = new URLSearchParams(req.postData() ?? '');
            const tok = params.get('id_token');
            if (tok && !dlLaunchIdToken) dlLaunchIdToken = tok;
          }
        });
        page.context().on('response', async (res) => {
          if (res.request().method() === 'POST' && /\/tool\/picker\/[^/?#]+\/cancel$/.test(res.url())) {
            cancelPostStatus = res.status();
            cancelPostBody = await res.text().catch(() => '');
          }
        });

        const modsBefore = await ltiModules(course101());
        expect(modsBefore).toEqual([]);

        await ensureEditMode(page, course101());
        await addActivityFromChooser(page, TOOL_A);
        const picker = await openSelectContent(page);
        const pickerUrl = picker.frame.url();

        // Verify Moodle 5.2.4 sent accept_multiple: true in deep_linking_settings
        const dlClaims = decodeJwtPayload(dlLaunchIdToken);
        const dlSettings = (dlClaims['https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings'] ?? {}) as Record<
          string,
          unknown
        >;
        expect(dlSettings.accept_multiple, 'Moodle 5.2.4 sends accept_multiple: true in LtiDeepLinkingRequest').toBe(true);

        // AC-LA-E3-05-04: Moodle channel (content.multiple: false) renders radio buttons, not checkboxes
        const radioCount = await picker.frame.locator('input[type="radio"][name="publicationId"]').count();
        const checkboxCount = await picker.frame.locator('input[type="checkbox"][name="publicationId"]').count();
        expect(radioCount, 'AC-LA-E3-05-04: radio inputs rendered for available publications').toBe(3);
        expect(checkboxCount, 'AC-LA-E3-05-04: zero checkbox inputs on Moodle picker').toBe(0);
        expect(picker.titles).toEqual(expect.arrayContaining([COURSE_HTML, COURSE_SCORM]));

        const cancelBtn = picker.frame.locator('button[data-cancel]').or(picker.frame.getByRole('button', { name: 'Cancel', exact: true })).first();
        await expect(cancelBtn, 'Cancel button visible on Moodle picker').toBeVisible();
        await shot(page, 's8-04-picker-before-cancel', testInfo);

        // AC-LA-E3-05-11: Click Cancel in the Cogniate picker inside Moodle 5.2.4's Select content dialog
        await cancelBtn.click();

        // Wait for POST /tool/picker/:pickerId/cancel and for Moodle's dialog to process contentitem_return.php
        const deadline = Date.now() + 20_000;
        let modalVisibleAfterCancel = true;
        while (Date.now() < deadline) {
          modalVisibleAfterCancel = (await page.locator('.modal.show').count()) > 0;
          if (cancelPostStatus > 0 && !modalVisibleAfterCancel) break;
          await page.waitForTimeout(250);
        }

        expect(cancelPostStatus, 'POST /tool/picker/:id/cancel HTTP status').toBe(200);
        const jwtMatch = /name="JWT"\s+value="([^"]+)"/.exec(cancelPostBody);
        expect(jwtMatch, 'Cancel auto-submit form contains signed JWT').toBeTruthy();
        const cancelJwtPayload = decodeJwtPayload(jwtMatch![1]!);
        expect(cancelJwtPayload['https://purl.imsglobal.org/spec/lti-dl/claim/content_items']).toEqual([]);
        expect(cancelJwtPayload['https://purl.imsglobal.org/spec/lti-dl/claim/msg']).toBe('No course was added.');

        const nameAfterCancel = await page.locator('#id_name').inputValue().catch(() => '');
        expect(nameAfterCancel, 'AC-LA-E3-05-11: Moodle activity name input stays empty after Cancel').toBe('');

        // Check whether Moodle closed the modal dialog or displayed a message inside the dialog
        const returnFrame = page.frames().find((f) => /contentitem_return\.php/.test(f.url()));
        const returnFrameText = returnFrame ? (await returnFrame.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').trim() : '';
        expect(!modalVisibleAfterCancel || returnFrameText.length > 0, 'AC-LA-E3-05-11: Moodle closes the dialog or shows a message').toBe(true);
        await shot(page, 's8-04-after-picker-cancel', testInfo);

        // Second GET to the cancelled picker URL returns 410 PICKER_USED
        const replayGet = await httpsRequest(pickerUrl);
        expect(replayGet.status, 'Cancelled picker session is consumed (410 PICKER_USED)').toBe(410);

        // Leave the unsaved Moodle activity form and verify 0 activities were created in Moodle and stats.activities === 0
        await cancelActivityForm(page);
        expect(await ltiModules(course101()), 'AC-LA-E3-05-11: no Moodle activity created after Cancel').toEqual([]);
        const htmlPubBeforePick = await publicationOf(THANH, need(st.htmlCourseId, 'htmlCourseId'));
        const scormPubBeforePick = await publicationOf(THANH, need(st.scormCourseId, 'scormCourseId'));
        expect(htmlPubBeforePick.stats.activities, 'HTML activities stat unchanged after Cancel').toBe(0);
        expect(scormPubBeforePick.stats.activities, 'SCORM activities stat unchanged after Cancel').toBe(0);

        writeEvidence('s8-04-moodle-picker-cancel.json', {
          moodleAcceptMultipleClaim: dlSettings.accept_multiple,
          radioCount,
          checkboxCount,
          cancelPostStatus,
          cancelJwtContentItems: cancelJwtPayload['https://purl.imsglobal.org/spec/lti-dl/claim/content_items'],
          cancelJwtMsg: cancelJwtPayload['https://purl.imsglobal.org/spec/lti-dl/claim/msg'],
          modalClosedAutomatically: !modalVisibleAfterCancel,
          returnFrameUrl: returnFrame?.url() ?? null,
          returnFrameText,
          nameAfterCancel,
          secondGetStatus: replayGet.status,
          activitiesInCourseAfterCancel: 0,
        });
        note(
          testInfo,
          'AC-LA-E3-05-11 Moodle 5.2.4 Cancel behavior',
          `modalClosedAutomatically=${!modalVisibleAfterCancel}; returnFrameText="${returnFrameText}"; nameAfterCancel="${nameAfterCancel}"; secondGetStatus=${replayGet.status}`,
        );

        // AC-LA-E3-05-04: Now pick both courses (1 item per Deep Linking pick) in COGNIATE-DEV-101
        for (const c of [
          { key: 'scorm' as const, title: COURSE_SCORM },
          { key: 'html' as const, title: COURSE_HTML },
        ]) {
          const cmid = await addCogniateActivity(page, course101(), TOOL_A, c.title, `A4-${c.key}`, testInfo);
          saveState({ activities: { [c.key]: { name: c.title, cmid, courseId: course101() } } });
          if (c.key === 'html') writeSlot8State({ htmlCmid: cmid });
          if (c.key === 'scorm') writeSlot8State({ scormCmid: cmid });
          const g = await grade(course101(), users().cg_student, { name: c.title, cmid });
          expect(g?.max, `${c.title}: grade item maximum`).toBe(100);
        }

        // Also open Select content once more without submitting to leave an open, unused picker_session row for Pass 2 U1/U2 continuity
        await ensureEditMode(page, course101());
        await addActivityFromChooser(page, TOOL_A);
        const openForContinuity = await openSelectContent(page);
        writeSlot8State({ preRestartPickerUrl: openForContinuity.frame.url() });
        await cancelActivityForm(page);

        await cap.stop();
        markDone('A4');
      } finally {
        await ctx.close();
      }

      const htmlPubAfter = await publicationOf(THANH, need(st.htmlCourseId, 'htmlCourseId'));
      const scormPubAfter = await publicationOf(THANH, need(st.scormCourseId, 'scormCourseId'));
      expect(htmlPubAfter.stats.activities).toBe(1);
      expect(scormPubAfter.stats.activities).toBe(1);
      expect((await connectionOf(THANH, need(st.connectionId, 'connectionId'))).status).toBe('connected');
      void htmlPubId;
      void scormPubId;
    });

    test('S8-05 [LA-E4-03 AC-LA-E4-03-09] Browser grade delivery on live Moodle 5.2.4: cg_student completes SCORM 1.2 and HTML activities (100.00 in Moodle gradebook & grader report, Sent in portal results)', async ({
      browser,
    }, testInfo) => {
      test.setTimeout(360_000);
      const st = readSlot8State();
      const htmlPubId = need(st.htmlPubId, 'htmlPubId');
      const scormPubId = need(st.scormPubId, 'scormPubId');

      const studentCtx = await newContext(browser);
      try {
        for (const key of ['scorm', 'html'] as const) {
          const r = await timed(`S8-student1-${key}`, () => learnerRun(studentCtx, 'cg_student', key, 'correct', testInfo));
          note(testInfo, `cg_student ${key}`, `shell "${r.shell.slice(0, 140)}", grade ${r.grade}, latency ${r.latency} s`);
          checkLaunch(r.launch);
          expect(r.grade, `cg_student ${key} Moodle grade`).toBe(100);
        }
      } finally {
        await studentCtx.close();
      }

      const u = users();
      for (const [key, title, cmid] of [
        ['scorm', COURSE_SCORM, need(st.scormCmid, 'scormCmid')] as const,
        ['html', COURSE_HTML, need(st.htmlCmid, 'htmlCmid')] as const,
      ]) {
        const g = await grade(course101(), u.cg_student, { name: title, cmid });
        expect(g?.shown, `${key}: Moodle gradebook formatted grade`).toBe('100.00');
      }

      const teacherCtx = await newContext(browser);
      try {
        const page = await moodlePage(teacherCtx);
        await login(page, u.cg_teacher);
        const report = await graderReport(page, course101());
        writeEvidence('s8-05-grader-report-101.json', report);
        await shot(page, 's8-05-grader-report-101', testInfo);
      } finally {
        await teacherCtx.close();
      }

      const portalCtx = await newContext(browser);
      try {
        const page = await portalCtx.newPage();
        await portalSignIn(page, THANH);
        for (const [key, pubId, title] of [
          ['scorm', scormPubId, COURSE_SCORM] as const,
          ['html', htmlPubId, COURSE_HTML] as const,
        ]) {
          await page.goto(`${urls.app}/publications/${pubId}/results`);
          const row = resultsRow(page, u.cg_student.id, title).first();
          await expect(row).toBeVisible({ timeout: 30_000 });
          await expect
            .poll(() => cellUnder(row, /best outcome/i), { timeout: 15_000, message: `${key} cg_student: best outcome cell` })
            .toMatch(/^Passed\s*100(\D|$)/i);
          await expect
            .poll(() => cellUnder(row, /moodle sync|lms sync|grade sync/i), {
              timeout: 15_000,
              message: `${key} cg_student: Moodle sync cell`,
            })
            .toMatch(/^Sent\b/i);
          await shot(page, `s8-05-portal-results-${key}`, testInfo);

          const apiRows = await resultsApi(THANH, pubId);
          const studentRow = apiRows.find((r) => r.learner.sub === String(u.cg_student.id));
          expect(studentRow?.best?.outcome).toBe('passed');
          expect(studentRow?.best?.scoreGiven).toBe(100);
          expect(studentRow?.scoreSyncs.some((s) => s.status === 'sent')).toBe(true);
        }
        const blockText = await publicationBlockText(page, need(st.htmlCourseId, 'htmlCourseId'), CONNECTION_A);
        expect(blockText).toMatch(/Selected in Moodle\s*:?\s*[1-9]/);
      } finally {
        await portalCtx.close();
      }
    });
  }

  if (PHASE === 'pass2') {
    test('S8-06 [LA-E7-09 MOODLE U1/U2 continuity & LA-E5-22 AC-LA-E5-22-06 / A-LAB-09 & AC-LA-E7-09-03] After lti-service + cogniate-app restart and legacy ws_token_encrypted U1 fixture: Moodle course shell creation succeeds, pre-restart open picker session unseals, new Deep Linking pick in COGNIATE-DEV-102 succeeds, cg_student2 launch + score sync on pre-restart activity reaches 100.00, and /healthz is default/no-knobs', async ({
      browser,
    }, testInfo) => {
      test.setTimeout(360_000);
      const st = readSlot8State();
      const connectionId = need(st.connectionId, 'connectionId');
      const htmlPubId = need(st.htmlPubId, 'htmlPubId');
      const htmlCmid = need(st.htmlCmid, 'htmlCmid');
      const shellLegacyU1 = need(st.shellLegacyU1, 'shellLegacyU1');
      const preRestartPickerUrl = need(st.preRestartPickerUrl, 'preRestartPickerUrl');

      // 1. AC-LA-E5-22-06 / A-LAB-09: Moodle course shell call with the pre-upgrade legacy ws_token_encrypted blob succeeds after restart
      const thanhSession = await signIn(THANH);
      const shellRes = await appApi<{
        shellStatus?: string;
        shellError?: string | null;
        moodleCourse?: { id: number; idnumber: string; url: string };
      }>('POST', '/app-api/publications', {
        cookie: thanhSession.cookie,
        body: {
          connectionId,
          courseId: shellLegacyU1.courseId,
          versionId: shellLegacyU1.versionId,
          createMoodleCourse: {},
        },
      });
      expect([200, 201], shellRes.body.slice(0, 300)).toContain(shellRes.status);
      expect(shellRes.json.shellStatus, `AC-LA-E5-22-06 legacy ws_token_encrypted course shell: ${shellRes.json.shellError}`).toBe(
        'created',
      );
      expect(shellRes.json.moodleCourse?.idnumber).toBe(idnumberFor(shellLegacyU1.courseId));
      const createdShells = await coursesByIdnumber(idnumberFor(shellLegacyU1.courseId));
      expect(createdShells, 'Moodle 5.2.4 created course shell from legacy ws_token_encrypted blob').toHaveLength(1);
      expect(createdShells[0]!.visible).toBe(0);

      // Re-seal ws_token_encrypted with "cgk1" via PUT /web-services
      const resealRes = await appApi('PUT', `/app-api/connections/${encodeURIComponent(connectionId)}/web-services`, {
        cookie: thanhSession.cookie,
        body: { token: seed().productToken },
      });
      expect(resealRes.status).toBe(200);

      // 2. Pre-restart open picker_session continuity: GET + POST /cancel unseals picker_session.ltik_encrypted across service restarts
      const prePickerGet = await httpsRequest(preRestartPickerUrl);
      expect(prePickerGet.status, 'Pre-restart open picker session still loads after restart').toBe(200);
      const prePickerCancel = await httpsRequest(`${preRestartPickerUrl.split('?')[0]}/cancel`, {
        method: 'POST',
        headers: { origin: urls.app, referer: preRestartPickerUrl },
      });
      expect(prePickerCancel.status, 'Pre-restart open picker session unseals ltik_encrypted and cancels cleanly').toBe(200);
      expect(prePickerCancel.body).toContain('name="JWT"');

      // 3. Post-restart teacher Deep Linking pick in COGNIATE-DEV-102
      const teacherCtx = await newContext(browser);
      try {
        const page = await moodlePage(teacherCtx);
        await login(page, users().cg_teacher);
        const cmid102 = await addCogniateActivity(page, course102(), TOOL_A, COURSE_HTML, 'S8-post-restart-102', testInfo);
        expect(cmid102).toBeGreaterThan(0);
        const htmlPubAfter = await publicationOf(THANH, need(st.htmlCourseId, 'htmlCourseId'));
        expect(htmlPubAfter.stats.activities, 'HTML publication activities stat grew to 2 after post-restart pick').toBe(2);
      } finally {
        await teacherCtx.close();
      }

      // 4. Post-restart learner launch & score sync on pre-restart activity in COGNIATE-DEV-101 (unseals resource_link.service_key_encrypted)
      saveState({
        activities: {
          html: { name: COURSE_HTML, cmid: htmlCmid, courseId: course101() },
        },
      });
      const student2Ctx = await newContext(browser);
      try {
        const r2 = await timed('S8-student2-html-post-restart', () =>
          learnerRun(student2Ctx, 'cg_student2', 'html', 'correct', testInfo),
        );
        checkLaunch(r2.launch);
        expect(r2.grade, 'cg_student2 post-restart Moodle grade on pre-restart activity').toBe(100);
      } finally {
        await student2Ctx.close();
      }

      const g2 = await grade(course101(), users().cg_student2, { name: COURSE_HTML, cmid: htmlCmid });
      expect(g2?.shown).toBe('100.00');
      const apiRows = await resultsApi(THANH, htmlPubId);
      const s2Row = apiRows.find((r) => r.learner.sub === String(users().cg_student2.id));
      expect(s2Row?.best?.scoreGiven).toBe(100);
      expect(s2Row?.scoreSyncs.some((s) => s.status === 'sent')).toBe(true);

      // 5. AC-LA-E7-09-03: /healthz of all services shows "profile": "default" and "knobs": []
      const healthEnd: Record<string, unknown> = {};
      for (const origin of ORIGINS()) {
        const h = await healthOf(origin);
        healthEnd[origin] = h;
        expect(h.status, `${origin}/healthz status at end`).toBe(200);
        expect(h.body.profile, `${origin} profile at end`).toBe('default');
        expect(h.body.knobs, `${origin} knobs at end`).toEqual([]);
      }
      writeEvidence('s8-06-health-end.json', healthEnd);
      expect(knobEvents(), 'no test_knob_active event in infra/.logs at end').toEqual([]);
      await cmidByName(course101(), COURSE_HTML);
    });
  }
});
