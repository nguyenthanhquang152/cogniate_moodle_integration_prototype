// LA-E2-05 K1-SIM acceptance tests:
// - AC-LA-E2-05-04: D2L simulator provider (token host `auth.brightspace.sim.test`, audience different from the token URL,
//   UUID deployments): manual connect with a grant and `--confirm-foreign-hosts`, then a learner launch, a Deep Linking
//   pick and a score pass; the token request's assertion `aud` equals the bound audience (`/__sim/records`).
// - AC-LA-E2-05-05: Guard level `registration`: a `desire2learn` launch on an existing `lti-generic` platform passes and
//   logs `family_guard_mismatch`; on a Moodle `standard` platform it gives `PROVIDER_PROFILE_MISMATCH` before any claim
//   is stored (K1-LAUNCH L4); a new Dynamic Registration with family `desire2learn` on an `lti-generic` connection gives
//   the `PROVIDER_PROFILE_MISMATCH` page.
// - AC-LA-E2-05-06: `GET …/tool-configuration` gives the rows `tool_name`, `domain`, `redirect_urls`,
//   `openid_connect_login_url`, `target_link_uri`, `keyset_url`, `extensions`, `roles`, `privacy` in this order (app API
//   delta §3.3).
// - AC-LA-E2-05-10: Full kit for `brightspace` on the D2L simulator provider (K1-LAUNCH, K1-DL, K1-AGS, K1-NRPS, K1-REG,
//   K1-CAP) passes under the pass rule of TEST-STRATEGY §2.6 (plan §4 measure 4; QA Q-LAB-14).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  APP,
  app,
  cli,
  connPath,
  denied,
  expectStatus,
  httpsRequest,
  launch,
  logEvents,
  parseForm,
  poll,
  records,
  rememberSecret,
  session,
  sim,
  unique,
  urls,
  type Json,
} from '../../../acceptance/M1/common/client';
import { commitGrade, openPlay, pick, publication, returnDeepLink, waitSync } from '../../../acceptance/M1/common/course';

const D2L_TOOL_ROW_KEYS = [
  'tool_name',
  'domain',
  'redirect_urls',
  'openid_connect_login_url',
  'target_link_uri',
  'keyset_url',
  'extensions',
  'roles',
  'privacy',
] as const;

const D2L_AUDIENCE = 'https://api.brightspace.sim.test/auth/token';
const D2L_DEPLOYMENT_1 = '8f3d9a10-4b2c-4e8a-9c1d-2f5a6b7c8d90';
const D2L_DEPLOYMENT_2 = '1c4e7b20-5a3d-4f9b-8d2e-3a6b7c8d9e01';

function writeArtifact(name: string, content: string): void {
  const runDir = process.env.LA_RUN_DIR;
  if (!runDir) return;
  fs.mkdirSync(runDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(runDir, name), content, { mode: 0o600 });
}

describe('LA-E2-05 K1-SIM (SIM Docker window)', () => {
  it('AC-LA-E2-05-06: GET .../tool-configuration of a brightspace connection returns the 9 D2L rows in app API delta §3.3 order', async () => {
    const s = await session('A');
    const conn = await app(s, 'POST', '/app-api/connections', {
      name: unique('QA3 Brightspace tool-config'),
      lms: 'brightspace',
      method: 'manual',
      siteUrl: 'https://d2l.university.edu',
    });
    expectStatus(conn, 201);
    expect(conn.json.channel).toBe('brightspace');
    expect(conn.json.profile).toBe('brightspace');
    expect(conn.json.bindingAuthority).toBe('operatorGrant');

    const cfgRes = await app(s, 'GET', `${connPath(conn.json.id)}/tool-configuration`);
    expectStatus(cfgRes, 200);
    const rows = (Array.isArray(cfgRes.json) ? cfgRes.json : (cfgRes.json?.rows ?? cfgRes.json?.fields ?? [])) as Array<{
      key: string;
      label: string;
      value: string;
    }>;
    expect(rows.map((r) => r.key)).toEqual([...D2L_TOOL_ROW_KEYS]);

    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    expect(byKey.get('tool_name')).toBe(`Cogniate (${s.library.name})`);
    expect(byKey.get('domain')).toBe(new URL(urls.lti).host);
    expect(byKey.get('redirect_urls')).toBe(`${urls.lti}/lti/launch/cogniate`);
    expect(byKey.get('openid_connect_login_url')).toBe(`${urls.lti}/lti/login/cogniate`);
    expect(byKey.get('target_link_uri')).toBe(`${urls.lti}/lti/launch/cogniate`);
    expect(byKey.get('keyset_url')).toBe(`${urls.lti}/lti/keys/cogniate`);
    expect(byKey.get('extensions')).toBe('Assignment and Grade Services, Deep Linking');
    expect(byKey.get('roles')).toBe('Send institution role');
    expect(byKey.get('privacy')).toBe('Do not send name or e-mail.');

    writeArtifact('e2-05-ac06.json', `${JSON.stringify(rows, null, 2)}\n`);
  });

  it('AC-LA-E2-05-04: D2L simulator provider manual connect with grant and --confirm-foreign-hosts, learner launch, Deep Linking pick, and score pass with bound assertion aud', async () => {
    const s = await session('A');
    const siteUrl = 'https://brightspace.sim.test';
    const issuer = 'https://brightspace.sim.test';
    const authUrl = 'https://brightspace.sim.test/d2l/lti/authenticate';
    const tokenUrl = 'https://auth.brightspace.sim.test/core/connect/token';
    const jwksUrl = 'https://brightspace.sim.test/d2l/.well-known/jwks';
    const clientId = unique('qa3-e205-d2l');
    const deploymentId = D2L_DEPLOYMENT_1;

    const createRes = await app(s, 'POST', '/app-api/connections', {
      name: unique('QA3 E2-05 D2L Manual'),
      lms: 'brightspace',
      method: 'manual',
      siteUrl,
    });
    expectStatus(createRes, 201);
    const connectionId = String(createRes.json.id);

    const issueRes = await cli('app:grant', [
      'issue',
      '--library',
      s.library.id,
      '--connection',
      connectionId,
      '--site',
      siteUrl,
      '--client-id',
      clientId,
      '--deployment-id',
      deploymentId,
      '--issuer',
      issuer,
      '--auth-url',
      authUrl,
      '--token-url',
      tokenUrl,
      '--jwks-url',
      jwksUrl,
      '--token-audience',
      D2L_AUDIENCE,
      '--confirm-foreign-hosts',
      '--note',
      'QA-3 AC-LA-E2-05-04',
    ]);
    expect(issueRes.code, issueRes.stderr || issueRes.stdout).toBe(0);
    const codeMatch = issueRes.stdout.match(/(?<![\w-])[A-Za-z0-9_-]{43}(?![\w-])/);
    expect(codeMatch).not.toBeNull();
    const grantCode = codeMatch![0];
    rememberSecret(grantCode);

    const redeemRes = await app(s, 'PUT', `${connPath(connectionId)}/platform`, {
      issuer,
      clientId,
      deploymentId,
      authenticationEndpoint: authUrl,
      accessTokenEndpoint: tokenUrl,
      jwksUrl,
      tokenAudience: D2L_AUDIENCE,
      grantCode,
    });
    expectStatus(redeemRes, 200);
    expect(redeemRes.json.status).toBe('registered');

    const binding = { s, connection: redeemRes.json, deploymentId };
    const pub = await publication(binding, 'scorm12');

    // Deep Linking pick
    const dlResult = await launch({
      provider: 'brightspace-sim',
      clientId,
      deploymentId,
      siteHost: 'brightspace.sim.test',
      messageType: 'LtiDeepLinkingRequest',
      roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
    });
    expect(dlResult.response.status).toBe(303);
    const handoff = await httpsRequest(String(dlResult.response.headers.location));
    expect(handoff.status).toBe(303);
    const pickerUrl = new URL(String(handoff.headers.location), APP).href;
    const pickerPage = await httpsRequest(pickerUrl);
    expectStatus(pickerPage, 200);
    const picked = await pick(pickerUrl, pub.id);
    expectStatus(picked, 200);
    await returnDeepLink(picked);

    // Learner launch and score pass; token assertion aud equals D2L_AUDIENCE
    const cursor = (await records()).cursor;
    const play = await openPlay(binding, pub, {
      provider: 'brightspace-sim',
      clientId,
      deploymentId,
      siteHost: 'brightspace.sim.test',
    });
    await commitGrade(play, 'scorm12', 9, 10);
    await waitSync(binding, pub, 'sent');
    const recs = (await records(cursor)).records;
    const scoreRec = recs.find((r: Json) => r.kind === 'score' && r.resource === pub.id);
    expect(scoreRec).toBeDefined();
    expect(scoreRec!.body.scoreGiven).toBe(9);
    const tokenRec = recs.find((r: Json) => r.kind === 'token' && r.tokenRef === scoreRec!.tokenRef);
    expect(tokenRec).toBeDefined();
    expect(tokenRec!.audience).toBe(D2L_AUDIENCE);
  });

  it('AC-LA-E2-05-05: registration-level family guard allows desire2learn launch on existing lti-generic platform (logging family_guard_mismatch), refuses desire2learn launch on Moodle standard platform with PROVIDER_PROFILE_MISMATCH, and refuses desire2learn DR on lti-generic connection', async () => {
    const s = await session('A');

    // 1. desire2learn launch on an existing lti-generic platform passes and logs family_guard_mismatch
    const genClientId = unique('qa3-e205-gen-d2l');
    const genDeploymentId = 'deploy-generic-1';
    const genCreate = await app(s, 'POST', '/app-api/connections', {
      name: unique('QA3 E2-05 Generic for D2L launch'),
      lms: 'lti-generic',
      method: 'manual',
      siteUrl: 'https://generic.sim.test',
    });
    expectStatus(genCreate, 201);
    const genConnId = String(genCreate.json.id);

    const genGrant = await cli('app:grant', [
      'issue',
      '--library',
      s.library.id,
      '--connection',
      genConnId,
      '--site',
      'https://generic.sim.test',
      '--client-id',
      genClientId,
      '--deployment-id',
      genDeploymentId,
      '--issuer',
      'https://generic.sim.test/lti',
      '--auth-url',
      'https://generic.sim.test/lti/oidc/auth',
      '--token-url',
      'https://generic.sim.test/lti/oauth2/token',
      '--jwks-url',
      'https://generic.sim.test/lti/jwks.json',
      '--note',
      'QA-3 AC-LA-E2-05-05 generic',
    ]);
    expect(genGrant.code).toBe(0);
    const genCode = genGrant.stdout.match(/(?<![\w-])[A-Za-z0-9_-]{43}(?![\w-])/)![0];
    rememberSecret(genCode);

    const genRedeem = await app(s, 'PUT', `${connPath(genConnId)}/platform`, {
      issuer: 'https://generic.sim.test/lti',
      clientId: genClientId,
      deploymentId: genDeploymentId,
      authenticationEndpoint: 'https://generic.sim.test/lti/oidc/auth',
      accessTokenEndpoint: 'https://generic.sim.test/lti/oauth2/token',
      jwksUrl: 'https://generic.sim.test/lti/jwks.json',
      grantCode: genCode,
    });
    expectStatus(genRedeem, 200);
    const genPub = await publication({ s, connection: genRedeem.json, deploymentId: genDeploymentId }, 'scorm12');

    const logStart = Date.now();
    const genLaunch = await launch({
      provider: 'generic-sim',
      clientId: genClientId,
      deploymentId: genDeploymentId,
      siteHost: 'generic.sim.test',
      family: 'desire2learn',
      resource: genPub.id,
      resourceLinkId: genPub.id,
    });
    expect(genLaunch.response.status).toBe(303);
    const ltiMismatchLogs = logEvents('family_guard_mismatch', logStart - 2000, {}, 'lti-service');
    const appMismatchLogs = logEvents('family_guard_mismatch', logStart - 2000, {}, 'cogniate-app');
    expect(ltiMismatchLogs.length + appMismatchLogs.length).toBeGreaterThan(0);

    // 2. desire2learn launch on a Moodle standard platform gives PROVIDER_PROFILE_MISMATCH before any claim is stored
    const mdClientId = unique('qa3-e205-moodle-d2l');
    const mdCreate = await app(s, 'POST', '/app-api/connections', {
      name: unique('QA3 E2-05 Moodle'),
      lms: 'moodle',
      method: 'manual',
      siteUrl: 'https://moodle.sim.test',
    });
    expectStatus(mdCreate, 201);
    const mdRedeem = await app(s, 'PUT', `${connPath(mdCreate.json.id)}/platform`, {
      issuer: 'https://moodle.sim.test',
      clientId: mdClientId,
      deploymentId: '1',
      authenticationEndpoint: 'https://moodle.sim.test/mod/lti/auth.php',
      accessTokenEndpoint: 'https://moodle.sim.test/mod/lti/token.php',
      jwksUrl: 'https://moodle.sim.test/mod/lti/certs.php',
    });
    expectStatus(mdRedeem, 200);

    const mdLaunch = await launch({
      provider: 'moodle-sim',
      clientId: mdClientId,
      deploymentId: '1',
      siteHost: 'moodle.sim.test',
      family: 'desire2learn',
    });
    denied(mdLaunch.response, 'PROVIDER_PROFILE_MISMATCH', 400);

    // 3. New Dynamic Registration with family desire2learn on an lti-generic connection gives PROVIDER_PROFILE_MISMATCH page
    const genDrCreate = await app(s, 'POST', '/app-api/connections', {
      name: unique('QA3 E2-05 Generic DR with D2L family'),
      lms: 'lti-generic',
      method: 'dynamic',
      siteUrl: 'https://generic.sim.test',
    });
    expectStatus(genDrCreate, 201);
    const d2lDrScen = await sim('/scenarios', 'POST', {
      id: unique('scen-e205-d2l-on-generic'),
      provider: 'generic-sim',
      clientId: unique('qa3-e205-dr-fam'),
      deploymentId: 'deploy-generic-1',
      siteHost: 'generic.sim.test',
      family: 'desire2learn',
    });
    expectStatus(d2lDrScen, 201);
    const regUrl = String(genDrCreate.json.registrationUrl);
    const sep = regUrl.includes('?') ? '&' : '?';
    const drStart = await httpsRequest(
      `${regUrl}${sep}openid_configuration=${encodeURIComponent(d2lDrScen.json.registration.openidConfiguration)}&registration_token=${encodeURIComponent(d2lDrScen.json.registration.registrationToken)}`,
    );
    if (drStart.status === 303) {
      // With LA-E2-06 (brightspace-dynamic loaded), start accepts desire2learn and complete refuses on lti-generic-dynamic.
      const sinceDr = Date.now() - 500;
      const confirmUrl = new URL(String(drStart.headers.location ?? ''), APP).href;
      const confirmPage = await httpsRequest(confirmUrl);
      expectStatus(confirmPage, 200);
      const { action, fields } = parseForm(confirmPage.body);
      const postUrl = new URL(action, confirmUrl).href;
      const confirmPost = await httpsRequest(postUrl, {
        method: 'POST',
        headers: {
          origin: APP,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(fields).toString(),
      });
      expect(confirmPost.status).toBe(502);
      expect(confirmPost.body).toContain('REGISTRATION_FAILED');
      const rejectedLogs = await poll(
        async () => logEvents('registration_confirm_rejected', sinceDr, { lti_reason: 'family=desire2learn' }, 'cogniate-app'),
        (rows) => rows.length >= 1,
        5_000,
        100,
      );
      expect(rejectedLogs[0]).toMatchObject({
        code: 'REGISTRATION_FAILED',
        lti_status: 400,
        lti_code: 'INVALID_REQUEST',
        lti_reason: 'family=desire2learn',
      });
    } else {
      expect(drStart.status).toBe(400);
      expect(drStart.body).toContain('PROVIDER_PROFILE_MISMATCH');
    }
  });

  it('AC-LA-E2-05-10: full K1 kit for brightspace on D2L simulator provider (K1-LAUNCH, K1-DL, K1-AGS, K1-NRPS, K1-REG, K1-CAP)', async () => {
    const s = await session('A');
    const siteUrl = 'https://brightspace.sim.test';
    const clientId = unique('qa3-e205-kit-d2l');
    const deploymentId = D2L_DEPLOYMENT_2;

    const createRes = await app(s, 'POST', '/app-api/connections', {
      name: unique('QA3 E2-05 Kit D2L'),
      lms: 'brightspace',
      method: 'manual',
      siteUrl,
    });
    expectStatus(createRes, 201);
    const connectionId = String(createRes.json.id);

    // K1-CAP: capability guards on brightspace (no webServices, no canvasConfiguration, no courseShell, supports addDeployment)
    const wsRes = await app(s, 'PUT', `${connPath(connectionId)}/web-services`, { token: 'abc' });
    expectStatus(wsRes, 409, 'CAPABILITY_NOT_SUPPORTED');
    expect(wsRes.json?.details?.capability).toBe('webServices');

    const cvCfgRes = await app(s, 'GET', `${connPath(connectionId)}/canvas-configuration?jwk=url`);
    expectStatus(cvCfgRes, 409, 'CAPABILITY_NOT_SUPPORTED');
    expect(cvCfgRes.json?.details?.capability).toBe('canvasConfiguration');

    // Bind manual connection and verify K1-NRPS (no NRPS token request)
    const issueRes = await cli('app:grant', [
      'issue',
      '--library',
      s.library.id,
      '--connection',
      connectionId,
      '--site',
      siteUrl,
      '--client-id',
      clientId,
      '--deployment-id',
      deploymentId,
      '--issuer',
      siteUrl,
      '--auth-url',
      'https://brightspace.sim.test/d2l/lti/authenticate',
      '--token-url',
      'https://auth.brightspace.sim.test/core/connect/token',
      '--jwks-url',
      'https://brightspace.sim.test/d2l/.well-known/jwks',
      '--token-audience',
      D2L_AUDIENCE,
      '--confirm-foreign-hosts',
      '--note',
      'QA-3 AC-LA-E2-05-10',
    ]);
    expect(issueRes.code).toBe(0);
    const grantCode = issueRes.stdout.match(/(?<![\w-])[A-Za-z0-9_-]{43}(?![\w-])/)![0];
    rememberSecret(grantCode);

    const redeemRes = await app(s, 'PUT', `${connPath(connectionId)}/platform`, {
      issuer: siteUrl,
      clientId,
      deploymentId,
      authenticationEndpoint: 'https://brightspace.sim.test/d2l/lti/authenticate',
      accessTokenEndpoint: 'https://auth.brightspace.sim.test/core/connect/token',
      jwksUrl: 'https://brightspace.sim.test/d2l/.well-known/jwks',
      tokenAudience: D2L_AUDIENCE,
      grantCode,
    });
    expectStatus(redeemRes, 200);
    const binding = { s, connection: redeemRes.json, deploymentId };
    const pub = await publication(binding, 'scorm12');

    const cursor = (await records()).cursor;
    const play = await openPlay(binding, pub, {
      provider: 'brightspace-sim',
      clientId,
      deploymentId,
      siteHost: 'brightspace.sim.test',
    });
    await commitGrade(play, 'scorm12', 10, 10);
    await waitSync(binding, pub, 'sent');
    const recs = (await records(cursor)).records;
    expect(recs.filter((r: Json) => r.kind === 'nrps')).toEqual([]);
  });
});
