// T4b1: connect Moodle (dynamic and manual) with the real app pages inside Moodle's registration frame.
// Source: tasks/T4b1.md AC-T4-07, -08, -10, -30; contract cogniate-app-api.md §4, §4.1 (tool-configuration rows), §6 (/tool/register); ADR-009;
// security §2.5. Order matters (serial): -08 registers Thanh's tool, -30 tries to "update" it from library B.
import type { BrowserContext, Page } from '@playwright/test';
import { appApi, QA_B, type Session, signIn, THANH } from '../lib/app';
import { publicUrls } from '../lib/env';
import { ACCOUNT, saveState } from '../lib/lti';
import { createManualTool } from '../lib/moodle-dl';
import { newStackContext } from '../lib/moodle-launch';
import {
  frameErrorProblems,
  openManageTools,
  startRegistration,
  toolDetails,
  toolSettings,
  toolTypeIds,
  waitForDialogClosed,
} from '../lib/moodle-reg';
import { callWs, type SiteInfo } from '../lib/moodle-ws';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';

const urls = publicUrls();
const THANH_TOOL = "Cogniate (Thanh's Library)";
const B_TOOL = 'Cogniate (QA Library B)';
const PRIVACY = 'Learners are anonymous: Moodle does not send names or emails.';
const UPDATE_TEXT = 'Go back in Moodle and choose Register as a new external tool';

interface Connection {
  id: string;
  status: string;
  registrationUrl?: string;
  platform: { id: string; clientId: string } | null;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test.describe.serial('T4b1 connect', () => {
  let context: BrowserContext;
  let page: Page;
  let thanh: Session;
  let b: Session;
  let thanhConn: Connection;
  let thanhTypeId = 0;
  let bManualTypeId = 0;

  test.beforeAll(async ({ browser }) => {
    context = await newStackContext(browser);
    page = await context.newPage();
    thanh = await signIn(THANH);
    b = await signIn(QA_B);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('AC-T4-07 POST /app-api/connections (dynamic) → 201 pending with a registration URL of the LTI service and a 43-char ref', async () => {
    const res = await appApi<Connection>('POST', '/app-api/connections', { cookie: thanh.cookie, body: { name: 'Dev Moodle', siteUrl: urls.moodle, method: 'dynamic' } });
    expect(res.status, res.body).toBe(201);
    expect(res.json.status).toBe('pending');
    expect(res.json.registrationUrl ?? '').toMatch(new RegExp(`^${escapeRe(urls.lti)}/lti/register/${ACCOUNT}\\?ref=[A-Za-z0-9_-]{43}$`));
    thanhConn = res.json;
    saveState('T4b', { thanhConnectionId: thanhConn.id, thanhRegistrationUrl: thanhConn.registrationUrl });
  });

  test('AC-T4-08 the confirm page in Moodle\'s frame; a real click on "Connect" closes the dialog and registers a Pending tool', async () => {
    test.setTimeout(120_000);
    await openManageTools(page, seed().users.admin);
    const held = await startRegistration(context, page, String(thanhConn.registrationUrl), 'new', 45_000, { hold: false });
    expect(held.response?.status, held.response?.body.slice(0, 300)).toBe(200);
    saveState('T4b', { registerPageHeaders: held.response?.headers });
    const text = (await held.frame.locator('body').innerText()).replace(/\s+/g, ' ');
    const release = (await callWs<SiteInfo>(seed().productToken, 'core_webservice_get_site_info')).release.split(' ')[0];
    expect(text).toContain(urls.moodle);
    expect(text, 'Moodle version').toContain(release);
    expect(text).toContain("Thanh's Library");
    expect(text).toContain(PRIVACY);
    await page.screenshot({ path: test.info().outputPath('confirm-page.png') });

    await held.frame.getByRole('button', { name: 'Connect' }).click();
    expect(await waitForDialogClosed(page), 'the dialog closes by itself').toBe(true);
    await held.release();

    const ids = await toolTypeIds(page, THANH_TOOL);
    expect(ids, `one Moodle tool "${THANH_TOOL}"`).toHaveLength(1);
    thanhTypeId = ids[0];
    const settings = await toolSettings(page, thanhTypeId);
    expect(settings.pending, 'the tool is Pending').toBe(true);
    const conn = await appApi<Connection>('GET', `/app-api/connections/${thanhConn.id}`, { cookie: thanh.cookie });
    expect(conn.json.status).toBe('registered');
    expect(conn.json.platform?.clientId).toBe(settings.clientId);
    saveState('T4b', { thanhTypeId, thanhClientId: settings.clientId, thanhPlatformId: conn.json.platform?.id, thanhToolSettings: settings });
  });

  test('AC-T4-10 manual connection of library B: ADR-009 values, a manual Moodle tool, the six values back; jwks on evil.test → 422', async () => {
    test.setTimeout(150_000);
    const created = await appApi<Connection>('POST', '/app-api/connections', { cookie: b.cookie, body: { name: 'Dev Moodle B', siteUrl: urls.moodle, method: 'manual' } });
    expect(created.status, created.body).toBe(201);
    const id = created.json.id;
    const cfg = await appApi<{ key: string; label: string; value: string }[]>('GET', `/app-api/connections/${id}/tool-configuration`, { cookie: b.cookie });
    expect(cfg.status, cfg.body).toBe(200);
    const lti = urls.lti;
    // App contract §4.1: exactly these 16 rows, in this order.
    const expected = [
      ['tool_name', 'Tool name', B_TOOL],
      ['tool_url', 'Tool URL', `${lti}/lti/launch/${ACCOUNT}`],
      ['lti_version', 'LTI version', 'LTI 1.3'],
      ['public_key_type', 'Public key type', 'Keyset URL'],
      ['public_keyset_url', 'Public keyset', `${lti}/lti/keys/${ACCOUNT}`],
      ['initiate_login_url', 'Initiate login URL', `${lti}/lti/login/${ACCOUNT}`],
      ['redirection_uris', 'Redirection URI(s)', `${lti}/lti/launch/${ACCOUNT}`],
      ['deep_linking', 'Supports Deep Linking (Content-Item Message)', 'Yes'],
      ['content_selection_url', 'Content Selection URL', `${lti}/lti/launch/${ACCOUNT}`],
      ['tool_configuration_usage', 'Tool configuration usage', 'Show in activity chooser and as a preconfigured tool'],
      ['launch_container', 'Default launch container', 'New window'],
      ['ags', 'IMS LTI Assignment and Grade Services', 'Use this service for grade sync and column management'],
      ['nrps', 'IMS LTI Names and Role Provisioning', "Use this service to retrieve members' information as per privacy settings"],
      ['share_name', "Share launcher's name with tool", 'Never'],
      ['share_email', "Share launcher's email with tool", 'Never'],
      ['accept_grades', 'Accept grades from the tool', 'As specified in Deep Linking definition or Delegate to teacher'],
    ].map(([key, label, value]) => ({ key, label, value }));
    expect(cfg.json.map((r) => ({ key: r.key, label: r.label, value: r.value }))).toEqual(expected);

    const tool = await createManualTool(page, seed().users.admin, B_TOOL, { deepLinking: true, acceptGrades: '2', memberships: true });
    bManualTypeId = tool.typeId;
    const d = await toolDetails(page, tool.typeId);
    const six = { issuer: d.platformId, clientId: d.clientId, deploymentId: d.deploymentId, authenticationEndpoint: d.authRequestUrl, accessTokenEndpoint: d.accessTokenUrl, jwksUrl: d.publicKeysetUrl };

    const evil = await appApi<{ details?: { message?: string } }>('PUT', `/app-api/connections/${id}/platform`, { cookie: b.cookie, body: { ...six, jwksUrl: 'https://evil.test/jwks' } });
    expect(evil.status, evil.body).toBe(422);
    expect(evil.json?.details?.message).toBe('INVALID_PLATFORM_VALUES');

    const ok = await appApi<Connection>('PUT', `/app-api/connections/${id}/platform`, { cookie: b.cookie, body: six });
    expect(ok.status, ok.body).toBe(200);
    expect(ok.json.status).toBe('registered');
    saveState('T4b', { bManualConnectionId: id, bManualTypeId, bManualClientId: d.clientId });
  });

  test('AC-T4-30 library B chooses "update" of Thanh\'s tool → UPDATE_NOT_ALLOWED, nothing changes; "register as new" → its own tool', async () => {
    test.setTimeout(180_000);
    const created = await appApi<Connection>('POST', '/app-api/connections', { cookie: b.cookie, body: { name: 'Dev Moodle B dynamic', siteUrl: urls.moodle, method: 'dynamic' } });
    expect(created.status, created.body).toBe(201);
    const bUrl = String(created.json.registrationUrl);
    const thanhBefore = await toolSettings(page, thanhTypeId);
    const thanhConnBefore = await appApi<Connection>('GET', `/app-api/connections/${thanhConn.id}`, { cookie: thanh.cookie });

    await openManageTools(page, seed().users.admin);
    const refused = await startRegistration(context, page, bUrl, { updateTypeId: thanhTypeId }, 45_000, { hold: false });
    expect(refused.sawChoice, 'Moodle showed the choice page').toBe(true);
    expect(await frameErrorProblems(refused, 'UPDATE_NOT_ALLOWED', 'AC-T4-30')).toEqual([]);
    expect((await refused.frame.locator('body').innerText()).replace(/\s+/g, ' ')).toContain(UPDATE_TEXT);
    await page.screenshot({ path: test.info().outputPath('update-not-allowed.png') });
    await refused.release();

    const thanhAfter = await toolSettings(page, thanhTypeId);
    expect({ name: thanhAfter.name, toolUrl: thanhAfter.toolUrl, keysetUrl: thanhAfter.keysetUrl, loginUrl: thanhAfter.loginUrl, clientId: thanhAfter.clientId }).toEqual({
      name: thanhBefore.name, toolUrl: thanhBefore.toolUrl, keysetUrl: thanhBefore.keysetUrl, loginUrl: thanhBefore.loginUrl, clientId: thanhBefore.clientId,
    });
    const thanhConnAfter = await appApi<Connection>('GET', `/app-api/connections/${thanhConn.id}`, { cookie: thanh.cookie });
    expect(thanhConnAfter.json.platform?.id, "Thanh's connection keeps its platform").toBe(thanhConnBefore.json.platform?.id);

    await openManageTools(page, seed().users.admin);
    const fresh = await startRegistration(context, page, bUrl, 'new', 45_000, { hold: false });
    expect(fresh.response?.status, fresh.response?.body.slice(0, 300)).toBe(200);
    await fresh.frame.getByRole('button', { name: 'Connect' }).click();
    expect(await waitForDialogClosed(page)).toBe(true);
    await fresh.release();
    const bTools = (await toolTypeIds(page, B_TOOL)).filter((t) => t !== bManualTypeId && t !== thanhTypeId);
    expect(bTools, 'library B has its own new tool').toHaveLength(1);
    const bSettings = await toolSettings(page, bTools[0]);
    const bConn = await appApi<Connection>('GET', `/app-api/connections/${created.json.id}`, { cookie: b.cookie });
    expect(bConn.json.status).toBe('registered');
    expect(bConn.json.platform?.clientId).toBe(bSettings.clientId);
    expect(bSettings.clientId).not.toBe(thanhBefore.clientId);
    saveState('T4b', { bDynamicConnectionId: created.json.id, bDynamicTypeId: bTools[0] });
  });
});
