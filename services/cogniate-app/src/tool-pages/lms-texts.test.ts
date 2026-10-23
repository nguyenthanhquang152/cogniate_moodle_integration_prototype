// LA-E1-09 (LA-ADR-01 D12): the tool pages, the runtime page and the connection texts fill `{LMS}` with the manifest
// text name. A test channel "your LMS" gets its own name; the Moodle channel keeps today's text byte for byte.
// Outside src/content-host on purpose: the ADR-008 import fence of that folder also covers its files.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ChannelManifest, ChannelRegistry } from '@cogniate/channel-kernel';
import { buildChannelRegistry, registrationText } from '@cogniate/channel-kernel';
import { makeZip, scormManifest } from '@cogniate/package-inspector/testing';
import { createLogger } from '@cogniate/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildContentApp } from '../content-host/server.ts';
import type { TestApp } from '../testkit.ts';
import { TEST_CHANNELS, TEST_MASTER_KEY, TEST_URLS, THANH, formBody, launchToken, testApp } from '../testkit.ts';
import { runtimeTokenFor } from './launch-rules.ts';
import { escapeHtml } from './page.ts';
import { REGISTER_ERRORS, registerErrorText } from './register-texts.ts';

const TEXT_CHANNEL = 'zz-text';

/** A channel whose text name is `name` (a copy of the Moodle manifest with an operator-grant method). */
const textChannel = (name: string): ChannelManifest => ({
  ...TEST_CHANNELS.channel('moodle')!, id: TEXT_CHANNEL, names: { text: name, label: 'ZZ text' },
  registration: [{ method: 'manual', authority: 'operatorGrant', profiles: ['zz-text-profile'], defaultProfile: 'zz-text-profile' }],
  lti: { guardedFamilies: [], toolConfiguration: 'none' },
});

/** The product channels (with their app adapters) plus the test channel. */
const withTextChannel = (name = 'your LMS'): ChannelRegistry => buildChannelRegistry([...TEST_CHANNELS.channels(), textChannel(name)]
  .map((manifest) => ({ folder: `/test/${manifest.id}`, manifest, appAdapter: TEST_CHANNELS.appAdapter(manifest.id) ?? undefined })), { simulations: true });

/** Only the test channel: no channel owns the standard profile, so a page with no known connection says "your LMS". */
const onlyTextChannel = (): ChannelRegistry => buildChannelRegistry([{ folder: `/test/${TEXT_CHANNEL}`, manifest: textChannel('your LMS') }], { simulations: true });

let t: TestApp;
let content: FastifyInstance | undefined;
afterEach(async () => {
  await content?.close();
  content = undefined;
  await t?.app.close();
});

const json = async (method: string, url: string, cookie: string, payload?: unknown) =>
  t.app.inject({ method: method as 'GET', url, headers: method === 'GET' ? { cookie } : t.writeHeaders(cookie), ...(payload !== undefined ? { payload: payload as object } : {}) });
const get = (url: string) => t.app.inject({ method: 'GET', url });
const actionOf = (body: string) => /<p data-error-action>([^<]*)<\/p>/.exec(body)?.[1];
const toChannel = (connectionId: string, channel: string) => t.db.prepare('UPDATE connection SET channel = ? WHERE id = ?').run(channel, connectionId);

/** A connected Moodle connection with one SCORM publication and one learner launch: the play id. */
async function played(clientId = 'c1'): Promise<{ connectionId: string; playId: string }> {
  const cookie = await t.login(THANH);
  const c = (await json('POST', '/app-api/connections', cookie, { name: 'Dev Moodle', siteUrl: TEST_URLS.moodle, method: 'manual' })).json();
  const platformId = (await json('PUT', `/app-api/connections/${c.id}/platform`, cookie, {
    issuer: TEST_URLS.moodle, clientId, deploymentId: '1', authenticationEndpoint: `${TEST_URLS.moodle}/a`, accessTokenEndpoint: `${TEST_URLS.moodle}/t`, jwksUrl: `${TEST_URLS.moodle}/k`,
  })).json().platform.id as string;
  const courseId = (await json('POST', '/app-api/courses', cookie, { title: 'Course' })).json().id as string;
  const body = await formBody({ package: makeZip([{ name: 'imsmanifest.xml', data: scormManifest() }, { name: 'index.html', data: '<html><body>sco</body></html>' }]) });
  expect((await t.app.inject({ method: 'POST', url: `/app-api/courses/${courseId}/versions`, headers: { ...t.writeHeaders(cookie), ...body.headers }, payload: body.payload })).statusCode).toBe(201);
  const pub = (await json('POST', '/app-api/publications', cookie, { connectionId: c.id, courseId })).json().id as string;
  const ltik = t.lti.addLaunch(launchToken({ platformId, target: `${TEST_URLS.lti}/lti/launch/cogniate?resource=${pub}` }));
  const res = await get(`/tool/launch?resource=${pub}&ltik=${ltik}`);
  expect(res.statusCode).toBe(303);
  return { connectionId: c.id as string, playId: /\/play\/(ply_[A-Za-z0-9_-]+)/.exec(String(res.headers.location))![1]! };
}

async function contentApp(channels: ChannelRegistry): Promise<FastifyInstance> {
  const playerDir = join(t.dataDir, 'player');
  mkdirSync(playerDir, { recursive: true });
  writeFileSync(join(playerDir, 'runtime.js'), 'export {};');
  content = await buildContentApp({ channels, logger: createLogger({ service: 'cogniate-content', write: () => {} }), urls: TEST_URLS, profile: 'default',
    knobs: [], outboundAllowlist: [], db: t.db, dataDir: t.dataDir, playerDir, now: () => t.clock.now });
  return content;
}

describe('AC-LA-E1-09-02: player shell and play pages', () => {
  it('the shell of a test channel connection names "your LMS"; a Moodle connection keeps today\'s bytes', async () => {
    t = await testApp({ channels: withTextChannel() });
    const { connectionId, playId } = await played();
    const moodle = await get(`/play/${playId}`);
    expect(moodle.body).toContain('<div data-page="play" data-format="scorm12" data-lms-name="Moodle">');
    expect(moodle.body).toContain(`<a href="${TEST_URLS.moodle}/mod/lti/return.php?course=2&amp;launch_container=4" rel="noopener noreferrer" data-back-to-moodle>Back to Moodle</a>`);
    toChannel(connectionId, TEXT_CHANNEL);
    const shell = await get(`/play/${playId}`);
    expect(shell.statusCode).toBe(200);
    expect(shell.body).toContain('<div data-page="play" data-format="scorm12" data-lms-name="your LMS">');
    expect(shell.body).toContain(`<a href="${TEST_URLS.moodle}/mod/lti/return.php?course=2&amp;launch_container=4" rel="noopener noreferrer" data-back-to-moodle>Back to your LMS</a>`);
    expect(shell.body).toContain('Status: <strong data-play-status>Not started</strong>');
    expect(shell.body).not.toContain('Moodle<');
  });

  it('PLAY_NOT_FOUND names the standard profile\'s channel: Moodle today, "your LMS" when no channel owns it', async () => {
    t = await testApp();
    expect(actionOf((await get('/play/ply_unknown')).body)).toBe('This course session does not exist or it expired. Open the activity again in Moodle.');
    await t.app.close();
    t = await testApp({ channels: onlyTextChannel() });
    const page = await get('/play/ply_unknown');
    expect([page.statusCode, actionOf(page.body)]).toEqual([404, 'This course session does not exist or it expired. Open the activity again in your LMS.']);
  });
});

describe('AC-LA-E1-09-02: runtime page (content origin)', () => {
  it('the runtime page and the 410 text name the session\'s channel (LA-IC-19); a Moodle session keeps today\'s bytes', async () => {
    const channels = withTextChannel();
    t = await testApp({ channels });
    const moodle = await played();
    const other = await played('c2');
    toChannel(other.connectionId, TEXT_CHANNEL);
    const app = await contentApp(channels);
    const token = (playId: string) => runtimeTokenFor(TEST_MASTER_KEY, playId);
    expect((await app.inject({ method: 'GET', url: `/rt/${token(moodle.playId)}` })).body).toContain('<body data-lms-name="Moodle">');
    expect((await app.inject({ method: 'GET', url: `/rt/${token(other.playId)}` })).body).toContain('<body data-lms-name="your LMS">');
    t.clock.now += 2 * 86_400_000;
    const state = async (playId: string) => {
      const r = await app.inject({ method: 'GET', url: `/rt/${token(playId)}/state` });
      return [r.statusCode, r.json().details.message, r.json().details.description];
    };
    expect(await state(moodle.playId)).toEqual([410, 'RUNTIME_EXPIRED', 'The runtime session expired. Open the activity again in Moodle.']);
    expect(await state(other.playId)).toEqual([410, 'RUNTIME_EXPIRED', 'The runtime session expired. Open the activity again in your LMS.']);
    const commit = await app.inject({ method: 'POST', url: `/rt/${token(other.playId)}/commit`, payload: {} });
    expect([commit.statusCode, commit.json().details.description]).toEqual([410, 'The runtime session expired. Open the activity again in your LMS.']);
    // An unknown token stays 404 on every runtime route.
    expect((await app.inject({ method: 'GET', url: `/rt/${'x'.repeat(43)}/state` })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: `/rt/${token(other.playId)}` })).statusCode).toBe(404);
  });
});

describe('AC-LA-E1-09-02: register pages and the connection error texts', () => {
  const refOf = (registrationUrl: string) => new URL(registrationUrl).searchParams.get('ref')!;
  async function pending(cookie: string, siteUrl = TEST_URLS.moodle): Promise<{ id: string; ref: string }> {
    const c = (await json('POST', '/app-api/connections', cookie, { name: 'Dev Moodle', siteUrl, method: 'dynamic' })).json();
    return { id: c.id as string, ref: refOf(c.registrationUrl) };
  }
  const register = (registrationId: string, ref: string) => get(`/tool/register?registrationId=${registrationId}&ref=${ref}`);

  it('the confirm and done pages name the connection\'s channel', async () => {
    t = await testApp({ channels: withTextChannel() });
    const cookie = await t.login(THANH);
    const moodle = await pending(cookie);
    const moodlePage = (await register(t.lti.addRegistration(), moodle.ref)).body;
    for (const text of ['<h1>Connect this Moodle site to Cogniate</h1>', '<dt>Moodle site</dt>', '<dt>Moodle version</dt>', '<p>Learners are anonymous: Moodle does not send names or emails.</p>',
      "textContent = 'Connecting to Moodle. This can take up to 15 seconds. Do not close this window.';"]) expect(moodlePage).toContain(text);
    const other = await pending(cookie);
    toChannel(other.id, TEXT_CHANNEL);
    const reg = t.lti.addRegistration();
    const page = (await register(reg, other.ref)).body;
    for (const text of ['<h1>Connect this your LMS site to Cogniate</h1>', '<dt>your LMS site</dt>', '<dt>your LMS version</dt>', '<p>Learners are anonymous: your LMS does not send names or emails.</p>',
      "textContent = 'Connecting to your LMS. This can take up to 15 seconds. Do not close this window.';"]) expect(page).toContain(text);
    const done = await t.app.inject({ method: 'POST', url: '/tool/register', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: TEST_URLS.app }, payload: new URLSearchParams({ registrationId: reg, ref: other.ref }).toString() });
    expect(done.body).toContain('<p>Done. Go back to your LMS and activate the tool.</p>');
  });

  it('a name with quote or markup characters stays text in the page and in its script', async () => {
    t = await testApp({ channels: withTextChannel("O'Brien <LMS>") });
    const cookie = await t.login(THANH);
    const p = await pending(cookie);
    toChannel(p.id, TEXT_CHANNEL);
    const page = (await register(t.lti.addRegistration(), p.ref)).body;
    expect(page).toContain('<h1>Connect this O&#39;Brien &lt;LMS&gt; site to Cogniate</h1>');
    expect(page).toContain("textContent = 'Connecting to O\\u0027Brien \\u003cLMS\\u003e. This can take up to 15 seconds. Do not close this window.';");
  });

  it.each(['A$&B', 'A$$B', "A$'B", 'A<tool>B'])('B-LA-E1-09-01, -02: the name %s goes literally into the error page and the stored lastError', async (name) => {
    t = await testApp({ channels: withTextChannel(name) });
    const cookie = await t.login(THANH);
    const p = await pending(cookie, 'https://other.test');
    toChannel(p.id, TEXT_CHANNEL);
    const action = `This registration link is for another ${name} site. Use the link on the ${name} site that the Cogniate connection names.`;
    const page = (await register(t.lti.addRegistration(), p.ref)).body;
    expect(actionOf(page)).toBe(escapeHtml(action));
    expect(page).toContain(`Cogniate could not connect this ${escapeHtml(name)} site`);
    expect((await json('GET', `/app-api/connections/${p.id}`, cookie)).json().lastError).toMatchObject({ title: `Cogniate could not connect this ${name} site`, action });
  });

  it('BD-A1-59: the Moodle manifest sentence of UPDATE_NOT_ALLOWED is the register page text of today (LA-E2-04 moves the page to it)', () => {
    expect(registrationText(TEST_CHANNELS.channel('moodle'), 'UPDATE_NOT_ALLOWED')).toBe(REGISTER_ERRORS.UPDATE_NOT_ALLOWED.action);
  });

  it('B-LA-E1-09-01, -02: a tool name with $ sequences or {LMS} goes literally into the tool-may-exist text', () => {
    const named = withTextChannel('A<tool>B');
    // The test channel copies the Moodle manifest, so it has the Moodle sentence with its own {LMS} (BD-A1-87).
    expect(registerErrorText('MOODLE_TOOL_MAY_EXIST', 'Cogniate (Lib $& $$ {LMS})', named, TEXT_CHANNEL)!.action)
      .toBe("A<tool>B may have saved a Pending tool. In Manage tools, delete the Pending tool 'Cogniate (Lib $& $$ {LMS})', then connect again.");
    expect(registerErrorText('SITE_MISMATCH', 'Cogniate (Lib)', named, TEXT_CHANNEL)!.action)
      .toBe('This registration link is for another A<tool>B site. Use the link on the A<tool>B site that the Cogniate connection names.');
  });

  it('error pages and the stored lastError texts fill {LMS}; a page with no connection uses the no-context name', async () => {
    t = await testApp({ channels: withTextChannel() });
    const cookie = await t.login(THANH);
    const p = await pending(cookie, 'https://other.test');
    toChannel(p.id, TEXT_CHANNEL);
    const mismatch = (await register(t.lti.addRegistration(), p.ref)).body;
    expect(mismatch).toContain('Cogniate could not connect this your LMS site');
    expect(actionOf(mismatch)).toBe('This registration link is for another your LMS site. Use the link on the your LMS site that the Cogniate connection names.');
    expect((await json('GET', `/app-api/connections/${p.id}`, cookie)).json().lastError).toMatchObject({
      code: 'SITE_MISMATCH', title: 'Cogniate could not connect this your LMS site',
      action: 'This registration link is for another your LMS site. Use the link on the your LMS site that the Cogniate connection names.',
    });
    const moodle = await pending(cookie, 'https://other-moodle.test');
    await register(t.lti.addRegistration(), moodle.ref);
    expect((await json('GET', `/app-api/connections/${moodle.id}`, cookie)).json().lastError).toMatchObject({
      code: 'SITE_MISMATCH', title: 'Cogniate could not connect this Moodle site',
      action: 'This registration link is for another Moodle site. Use the link on the Moodle site that the Cogniate connection names.',
    });
    const unknown = (await register(t.lti.addRegistration(), 'x'.repeat(43))).body;
    expect(unknown).toContain('Cogniate could not connect this Moodle site');
    expect(actionOf(unknown)).toBe('This registration link is not valid or was already used. In Cogniate, open the connection and copy a new registration URL.');
  });
});
