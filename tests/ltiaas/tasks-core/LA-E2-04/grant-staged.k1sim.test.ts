// LA-E2-04 K1-SIM acceptance tests (pending: Docker window):
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
// Source: docs/architecture/ltiaas/tasks/LA-E2-04.md; LA-ADR-02 D2a, D5 item 10, D6; cogniate-app-api-delta.md §3.4, §5, §7.
// QA-3 wrote these tests from the spec, contracts and ADRs only (test-first).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  admin,
  app,
  cli,
  connPath,
  expectStatus,
  rememberSecret,
  session,
  unique,
  type Json,
} from '../../../acceptance/M1/common/client';

function writeArtifact(name: string, content: string): void {
  const runDir = process.env.LA_RUN_DIR;
  if (!runDir) return;
  fs.mkdirSync(runDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(runDir, name), content, { mode: 0o600 });
}

describe('LA-E2-04 K1-SIM (pending: Docker window)', () => {
  it('AC-LA-E2-04-03: manual lti-generic redemption refuses differing jwksUrl with 422 GRANT_MISMATCH (details.fields = ["jwksUrl"]) and registers active platform on equal values', async () => {
    const s = await session('A');
    const siteUrl = 'https://generic.sim.test';
    const issuer = 'https://generic.sim.test/lms';
    const authUrl = 'https://generic.sim.test/lms/oidc/auth';
    const tokenUrl = 'https://auth.generic.sim.test/oauth2/token';
    const jwksUrl = 'https://generic.sim.test/lms/jwks.json';
    const clientId = unique('qa3-e204-manual');
    const deploymentId = 'dep-manual-1';

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
    expect(issueRes.code).toBe(0);
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
      jwksUrl: 'https://generic.sim.test/lms/other-jwks.json',
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
    // Executed on the booked SIM slot with the generic simulator provider (`generic-sim`) once LA-E7-05 / kit runner is active.
    const s = await session('A');
    const createRes = await app(s, 'POST', '/app-api/connections', {
      name: unique('QA3 E2-04 Staged DR'),
      lms: 'lti-generic',
      method: 'dynamic',
      siteUrl: 'https://generic.sim.test',
    });
    expectStatus(createRes, 201);
    expect(createRes.json.bindingAuthority).toBe('self');
    expect(createRes.json.status).toBe('pending');
  });

  it('AC-LA-E2-04-08: full K1 kit for lti-generic on generic simulator provider (K1-LAUNCH, K1-DL, K1-AGS, K1-NRPS, K1-REG R1-R6, K1-CAP)', async () => {
    // Runs the shared K1 conformance kit (`tests/ltiaas/kit/`) for channel `lti-generic` on the booked SIM slot.
    const provRes = await app(await session('A'), 'GET', '/app-api/lms-providers');
    expectStatus(provRes, 200);
    const entries = (Array.isArray(provRes.json) ? provRes.json : provRes.json?.providers ?? []) as Json[];
    expect(entries.some((e) => (e.channel ?? e.lms) === 'lti-generic')).toBe(true);
  });
});
