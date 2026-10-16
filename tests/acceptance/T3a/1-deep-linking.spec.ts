// T3a: Deep Linking through the LTI service with a real Moodle "Select content". QA stands in for the app page.
// Source: tasks/T3a.md AC-T3-06, -07, -08; contract §3.1 (deepLinkingSettings), §3.2; security §2.3.
// The activity "QA DL <runId>" that this file makes is used by 2-scores.spec.ts and 3-negative.spec.ts (state file).
import crypto from 'node:crypto';
import { createLocalJWKSet, jwtVerify } from 'jose';
import { publicUrls } from '../lib/env';
import { httpsRequest } from '../lib/https';
import { ACCOUNT, DL_CLAIM, LTI_CLAIM, ltiSeed, saveState } from '../lib/lti';
import { cmidByName, type DeepLinkRun, deepLinkActivity } from '../lib/moodle-dl';
import { gradeItems } from '../lib/moodle-ws';
import { newStackContext } from '../lib/moodle-launch';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';

const urls = publicUrls();
const runId = `${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;
const TITLE = `QA DL ${runId}`;
const ITEM = {
  type: 'ltiResourceLink',
  title: TITLE,
  url: `${urls.lti}/lti/launch/${ACCOUNT}?resource=qa-dl`,
  lineItem: { scoreMaximum: 100, label: TITLE },
};

test.describe.serial('T3a Deep Linking (cg_teacher, Cogniate (seed), COGNIATE-DEV-101)', () => {
  let run: DeepLinkRun;
  let cmid: number | undefined;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(150_000);
    const context = await newStackContext(browser);
    try {
      run = await deepLinkActivity(context, seed().users.cg_teacher, seed().courses['COGNIATE-DEV-101'], ltiSeed().typeId, [ITEM]);
      cmid = run.saved ? await cmidByName(seed().courses['COGNIATE-DEV-101'], TITLE) : undefined;
      saveState('T3a', { runId, title: TITLE, cmid, item: ITEM });
    } finally {
      await context.close();
    }
  });

  test('AC-T3-06 Select content reaches {app}/tool/deep-link?ltik=… and the ID token is a deep-linking launch', async () => {
    const at = new URL(run.toolUrl);
    expect(`${at.origin}${at.pathname}`).toBe(`${urls.app}/tool/deep-link`);
    expect(run.ltik).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(run.idtoken.status, run.idtoken.body).toBe(200);
    const t = run.idtoken.json as {
      launch: { type: string; deepLinkingSettings?: { acceptTypes?: string[] }; resourceLink?: unknown };
      services: { deepLinking: { available: boolean } };
    };
    expect(t.launch.type).toBe('LtiDeepLinkingRequest');
    expect(t.services.deepLinking.available).toBe(true);
    expect(t.launch.deepLinkingSettings?.acceptTypes ?? []).toContain('ltiResourceLink');
    expect(t.launch).not.toHaveProperty('resourceLink');
  });

  test('AC-T3-07 POST /api/deeplinking → 200 {message, target}; Moodle fills the form, saves the activity, makes a grade item of 100', async () => {
    expect(run.dl.status, run.dl.body).toBe(200);
    expect(String(run.dl.json.target)).toMatch(new RegExp(`^${urls.moodle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/mod/lti/contentitem_return\\.php`));
    expect(run.nameAfter, 'the activity form got the name').toBe(TITLE);
    expect(run.saved, 'the form was saved').toBe(true);
    expect(cmid, 'the course has the activity').toBeDefined();
    const items = await gradeItems(seed().oracleToken, seed().courses['COGNIATE-DEV-101'], seed().users.cg_student.id);
    const item = items.find((i) => i.itemname === TITLE);
    expect(item, `grade item "${TITLE}"`).toBeDefined();
    expect(Number(item!.grademax)).toBe(100);
  });

  test('AC-T3-08 the Deep Linking JWT verifies with /lti/keys/cogniate and has the required claims and times', async () => {
    const jwks = JSON.parse((await httpsRequest(`${urls.lti}/lti/keys/${ACCOUNT}`)).body) as Parameters<typeof createLocalJWKSet>[0];
    const s = ltiSeed();
    const { payload, protectedHeader } = await jwtVerify(String(run.dl.json.message), createLocalJWKSet(jwks), { algorithms: ['RS256'] });
    expect(protectedHeader.kid, 'kid').toBeTruthy();
    expect(payload.iss).toBe(s.clientId);
    expect([payload.aud].flat()).toContain(urls.moodle);
    expect(payload[`${LTI_CLAIM}message_type`]).toBe('LtiDeepLinkingResponse');
    expect(payload[`${LTI_CLAIM}version`]).toBe('1.3.0');
    expect(String(payload[`${LTI_CLAIM}deployment_id`])).toBe(String(s.deploymentId));
    expect(typeof payload.nonce === 'string' && payload.nonce !== '', 'nonce').toBe(true);
    expect(payload[`${DL_CLAIM}content_items`]).toEqual([ITEM]);
    const iat = Number(payload.iat);
    const exp = Number(payload.exp);
    expect(Math.abs(exp - iat - 330), `exp - iat = ${exp - iat}`).toBeLessThanOrEqual(1);
    expect(iat, 'iat <= response time - 25 s').toBeLessThanOrEqual(Math.floor(run.dlAt / 1000) - 25);
  });
});
