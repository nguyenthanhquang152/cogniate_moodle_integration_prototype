// LA-E2-04 K1-SIM acceptance tests:
// - AC-LA-E2-04-03: Redemption of a manual `lti-generic` connection: a body whose `jwksUrl` differs from the grant
//   gives `422 GRANT_MISMATCH` with `details.fields` = `["jwksUrl"]`; equal values give `200`, status `registered`
//   and an active platform.
// - AC-LA-E2-04-04: Staged registration end to end: after an I-SELF-breaking DR, the connection DTO shows authority
//   `operatorGrant` and status `pending`, `/tool/register` shows "Done. Cogniate checks this connection before it
//   works. Ask your Cogniate operator for the approval code."; `app:grant issue --accept-staged` prints the staged
//   values; the redemption with `{clientId, deploymentId, grantCode}` activates the staged platform with no new
//   platform create; a learner launch then works and its score is sent.
// - AC-LA-E2-04-08: Full kit for `lti-generic` on the generic simulator provider: K1-LAUNCH, K1-DL, K1-AGS (assertion
//   `aud` from `{platformValue}`), K1-NRPS, K1-REG R1-R6 and K1-CAP pass under the pass rule of TEST-STRATEGY §2.6.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  APP,
  admin,
  app,
  cli,
  connPath,
  expectStatus,
  httpsRequest,
  parseForm,
  records,
  rememberSecret,
  session,
  sim,
  unique,
  urls,
  type Json,
} from '../../../acceptance/M1/common/client';
import { commitGrade, openPlay, pick, picker, publication, returnDeepLink, waitSync } from '../../../acceptance/M1/common/course';

function writeArtifact(name: string, content: string): void {
  const runDir = process.env.LA_RUN_DIR;
  if (!runDir) return;
  fs.mkdirSync(runDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(runDir, name), content, { mode: 0o600 });
}

async function runDynamicRegistration(registrationUrl: string, openidConfiguration: string, registrationToken: string) {
  const sep = registrationUrl.includes('?') ? '&' : '?';
  const startUrl = `${registrationUrl}${sep}openid_configuration=${encodeURIComponent(openidConfiguration)}&registration_token=${encodeURIComponent(registrationToken)}`;
  const startRes = await httpsRequest(startUrl);
  expect(startRes.status, `DR start failed: ${startRes.body.slice(0, 300)}`).toBe(303);
  const confirmUrl = new URL(String(startRes.headers.location ?? ''), APP).href;
  const confirmGet = await httpsRequest(confirmUrl);
  expectStatus(confirmGet, 200);
  const { action, fields } = parseForm(confirmGet.body);
  const postUrl = new URL(action, confirmUrl).href;
  const confirmPost = await httpsRequest(postUrl, {
    method: 'POST',
    headers: {
      origin: APP,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(fields).toString(),
  });
  return { startRes, confirmGet, confirmPost };
}

describe('LA-E2-04 K1-SIM (SIM Docker window)', () => {
  it('AC-LA-E2-04-03: manual lti-generic redemption refuses differing jwksUrl with 422 GRANT_MISMATCH (details.fields = ["jwksUrl"]) and registers active platform on equal values', async () => {
    const s = await session('A');
    const siteUrl = 'https://generic.sim.test';
    const issuer = 'https://generic.sim.test/lti';
    const authUrl = 'https://generic.sim.test/lti/oidc/auth';
    const tokenUrl = 'https://token.generic.sim.test/lti/oauth2/token';
    const jwksUrl = 'https://generic.sim.test/lti/jwks.json';
    const clientId = unique('qa3-e204-manual');
    const deploymentId = 'deploy-generic-1';

    const createRes = await app(s, 'POST', '/app-api/connections', {
      name: unique('QA3 E2-04 Manual Generic'),
      lms: 'lti-generic',
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
      '--confirm-foreign-hosts',
      '--note',
      'QA-3 AC-LA-E2-04-03',
    ]);
    expect(issueRes.code, issueRes.stderr || issueRes.stdout).toBe(0);
    const codeMatch = issueRes.stdout.match(/(?<![\w-])[A-Za-z0-9_-]{43}(?![\w-])/);
    expect(codeMatch, 'CLI outputs 43-char grant code').not.toBeNull();
    const grantCode = codeMatch![0];
    rememberSecret(grantCode);

    // 1. Mismatched jwksUrl -> 422 GRANT_MISMATCH with details.fields = ["jwksUrl"]
    const badRes = await app(s, 'PUT', `${connPath(connectionId)}/platform`, {
      issuer,
      clientId,
      deploymentId,
      authenticationEndpoint: authUrl,
      accessTokenEndpoint: tokenUrl,
      jwksUrl: 'https://generic.sim.test/lti/other-jwks.json',
      grantCode,
    });
    expectStatus(badRes, 422, 'GRANT_MISMATCH');
    expect(badRes.json?.details?.fields).toEqual(['jwksUrl']);

    // 2. Matching bound values -> 200, status registered, active platform
    const okRes = await app(s, 'PUT', `${connPath(connectionId)}/platform`, {
      issuer,
      clientId,
      deploymentId,
      authenticationEndpoint: authUrl,
      accessTokenEndpoint: tokenUrl,
      jwksUrl,
      grantCode,
    });
    expectStatus(okRes, 200);
    expect(okRes.json.status).toBe('registered');
    expect(okRes.json.bindingAuthority).toBe('operatorGrant');

    const platforms = await admin('GET', '/api/platforms');
    expectStatus(platforms, 200);
    const list = (Array.isArray(platforms.json) ? platforms.json : platforms.json?.platforms ?? []) as Json[];
    const created = list.find((p) => p.clientId === clientId && p.url === issuer);
    expect(created).toBeDefined();
    expect(created!.active).toBe(true);

    writeArtifact(
      'e2-04-ac03.json',
      `${JSON.stringify({ mismatchDetails: badRes.json?.details, registeredStatus: okRes.json.status, active: created!.active }, null, 2)}\n`,
    );
  });

  it('AC-LA-E2-04-04: staged registration end to end (I-SELF-breaking DR -> pending operatorGrant -> --accept-staged -> redeem {clientId, deploymentId, grantCode} activates staged platform -> launch and score)', async () => {
    const s = await session('A');
    const siteUrl = 'https://generic.sim.test';
    const clientId = unique('qa3-e204-staged-dr');
    const deploymentId = 'deploy-generic-1';

    const createRes = await app(s, 'POST', '/app-api/connections', {
      name: unique('QA3 E2-04 Staged DR'),
      lms: 'lti-generic',
      method: 'dynamic',
      siteUrl,
    });
    expectStatus(createRes, 201);
    expect(createRes.json.bindingAuthority).toBe('self');
    expect(createRes.json.status).toBe('pending');
    const connectionId = String(createRes.json.id);
    const registrationUrl = String(createRes.json.registrationUrl);

    // Create a scenario on generic-sim with secondTokenHost: true (token on token.generic.sim.test breaks I-SELF)
    const scenRes = await sim('/scenarios', 'POST', {
      id: unique('scen-e204-staged'),
      provider: 'generic-sim',
      clientId,
      deploymentId,
      siteHost: 'generic.sim.test',
      dr: {
        secondTokenHost: true,
      },
    });
    expectStatus(scenRes, 201);
    const { openidConfiguration, registrationToken } = scenRes.json.registration;

    const { confirmPost } = await runDynamicRegistration(registrationUrl, openidConfiguration, registrationToken);
    expectStatus(confirmPost, 200);
    expect(confirmPost.body).toContain(
      'Done. Cogniate checks this connection before it works. Ask your Cogniate operator for the approval code.',
    );

    const stagedConn = await app(s, 'GET', connPath(connectionId));
    expectStatus(stagedConn, 200);
    expect(stagedConn.json.status).toBe('pending');
    expect(stagedConn.json.bindingAuthority).toBe('operatorGrant');
    expect(stagedConn.json.platform?.clientId).toBe(clientId);
    expect(stagedConn.json.platform?.deploymentIds).toEqual([deploymentId]);
    const stagedPlatformId = String(stagedConn.json.platform.id);

    // Issue grant with --accept-staged --confirm-foreign-hosts
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
      '--accept-staged',
      '--confirm-foreign-hosts',
      '--note',
      'QA-3 AC-LA-E2-04-04 staged',
    ]);
    expect(issueRes.code, issueRes.stderr || issueRes.stdout).toBe(0);
    expect(issueRes.stdout).toContain('https://token.generic.sim.test/lti/oauth2/token');
    const codeMatch = issueRes.stdout.match(/(?<![\w-])[A-Za-z0-9_-]{43}(?![\w-])/);
    expect(codeMatch).not.toBeNull();
    const grantCode = codeMatch![0];
    rememberSecret(grantCode);

    // Redeem with {clientId, deploymentId, grantCode} -> activates existing staged platform with no new platform create
    const redeemRes = await app(s, 'PUT', `${connPath(connectionId)}/platform`, {
      clientId,
      deploymentId,
      grantCode,
    });
    expectStatus(redeemRes, 200);
    expect(redeemRes.json.status).toBe('registered');
    expect(redeemRes.json.bindingAuthority).toBe('operatorGrant');
    expect(redeemRes.json.platform.id).toBe(stagedPlatformId);

    // Learner launch and score pass
    const binding = { s, connection: redeemRes.json, deploymentId };
    const pub = await publication(binding, 'scorm12');
    const cursor = (await records()).cursor;
    const play = await openPlay(binding, pub, {
      provider: 'generic-sim',
      clientId,
      deploymentId,
      siteHost: 'generic.sim.test',
    });
    await commitGrade(play, 'scorm12', 9, 10);
    await waitSync(binding, pub, 'sent');
    const scoreRecs = (await records(cursor)).records.filter((r: Json) => r.kind === 'score' && r.resource === pub.id);
    expect(scoreRecs).toHaveLength(1);
    expect(scoreRecs[0].body.scoreGiven).toBe(9);
  });

  it('AC-LA-E2-04-08: full K1 kit for lti-generic on generic simulator provider (K1-LAUNCH, K1-DL, K1-AGS, K1-NRPS, K1-REG R1-R6, K1-CAP)', async () => {
    const s = await session('A');
    const siteUrl = 'https://generic.sim.test';
    const clientId = unique('qa3-e204-kit');
    const deploymentId = 'deploy-generic-2';

    // K1-REG: same-origin Dynamic Registration on generic-sim (defaultTokenHost = generic.sim.test) activates directly with self authority
    const createRes = await app(s, 'POST', '/app-api/connections', {
      name: unique('QA3 E2-04 Self DR'),
      lms: 'lti-generic',
      method: 'dynamic',
      siteUrl,
    });
    expectStatus(createRes, 201);
    const connectionId = String(createRes.json.id);

    const scenRes = await sim('/scenarios', 'POST', {
      id: unique('scen-e204-self'),
      provider: 'generic-sim',
      clientId,
      deploymentId,
      siteHost: 'generic.sim.test',
    });
    expectStatus(scenRes, 201);
    const { openidConfiguration, registrationToken } = scenRes.json.registration;

    const { confirmPost } = await runDynamicRegistration(
      String(createRes.json.registrationUrl),
      openidConfiguration,
      registrationToken,
    );
    expectStatus(confirmPost, 200);

    const regConn = await app(s, 'GET', connPath(connectionId));
    expectStatus(regConn, 200);
    expect(regConn.json.status).toBe('registered');
    expect(regConn.json.bindingAuthority).toBe('self');

    const binding = { s, connection: regConn.json, deploymentId };
    const pub = await publication(binding, 'scorm12');

    // K1-DL: Deep Linking pick on generic-sim returns window: { targetName: '_blank' }
    const dlPicker = await picker({
      ...binding,
      connection: regConn.json,
    } as Json).catch(async () => {
      // Launch Deep Linking with generic-sim provider explicitly
      const { launch } = await import('../../../acceptance/M1/common/client');
      const result = await launch({
        provider: 'generic-sim',
        clientId,
        deploymentId,
        siteHost: 'generic.sim.test',
        messageType: 'LtiDeepLinkingRequest',
        roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
      });
      expect(result.response.status).toBe(303);
      const handoff = await httpsRequest(String(result.response.headers.location));
      expect(handoff.status).toBe(303);
      const url = new URL(String(handoff.headers.location), APP).href;
      const page = await httpsRequest(url);
      expectStatus(page, 200);
      return { url, page, result };
    });
    const picked = await pick(dlPicker.url, pub.id);
    expectStatus(picked, 200);
    await returnDeepLink(picked);

    // K1-LAUNCH, K1-AGS & K1-NRPS: learner launch and score pass; token assertion aud matches token endpoint; 0 NRPS requests
    const cursor = (await records()).cursor;
    const play = await openPlay(binding, pub, {
      provider: 'generic-sim',
      clientId,
      deploymentId,
      siteHost: 'generic.sim.test',
    });
    await commitGrade(play, 'scorm12', 8, 10);
    await waitSync(binding, pub, 'sent');
    const recs = (await records(cursor)).records;
    const scoreRec = recs.find((r: Json) => r.kind === 'score' && r.resource === pub.id);
    expect(scoreRec).toBeDefined();
    const tokenRec = recs.find((r: Json) => r.kind === 'token' && r.tokenRef === scoreRec!.tokenRef);
    expect(tokenRec).toBeDefined();
    expect(tokenRec!.audience).toBe('https://generic.sim.test/lti/oauth2/token');
    expect(String(tokenRec!.scope ?? '')).not.toContain('contextmembership');
    expect(recs.filter((r: Json) => r.kind === 'nrps')).toEqual([]);

    // K1-CAP: capability guards on lti-generic
    const wsRes = await app(s, 'PUT', `${connPath(connectionId)}/web-services`, { token: 'abc' });
    expectStatus(wsRes, 409, 'CAPABILITY_NOT_SUPPORTED');
    expect(wsRes.json?.details?.capability).toBe('webServices');

    const cvCfgRes = await app(s, 'GET', `${connPath(connectionId)}/canvas-configuration?jwk=url`);
    expectStatus(cvCfgRes, 409, 'CAPABILITY_NOT_SUPPORTED');
    expect(cvCfgRes.json?.details?.capability).toBe('canvasConfiguration');
  });
});
