// LA-E6-05 K1-SIM suite (QA-3, test-first from docs/architecture/ltiaas/tasks/LA-E6-05.md, LA-ADR-08 D5,
// and app contract §4.6).
//
// Covers:
// - AC-LA-E6-05-03 (K1-SIM): The Canvas JSON answers (jwk=url and jwk=inline) equal the golden JSON of LA-E3-07 and
//   LA-E3-14 (no new member).
// - AC-LA-E6-05-04 (K1-SIM): An export of another library's connection gives 404 and writes nothing.
import { describe, expect, it } from 'vitest';
import {
  app,
  connPath,
  expectStatus,
  httpsRequest,
  session,
  unique,
  urls,
  type Json,
} from '../../../acceptance/M1/common/client';
import { CLOUD } from '../../../acceptance/M1/canvas/canvas';

const FOUR_AGS_SCOPES = [
  'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
  'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
  'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
  'https://purl.imsglobal.org/spec/lti-ags/scope/score',
];

function expectedDomain(publicLtiUrl = urls.lti): string {
  const url = new URL(publicLtiUrl);
  const port = url.port && url.port !== '443' ? `:${url.port}` : '';
  return url.hostname.toLowerCase() + port;
}

function expectedCanvasJson(libraryName: string, domain: string, key?: Json) {
  return {
    title: `Cogniate (${libraryName})`,
    description: 'Cogniate courses (SCORM 1.2 and HTML) with grade return.',
    oidc_initiation_url: `${urls.lti}/lti/login/cogniate`,
    target_link_uri: `${urls.lti}/lti/launch/cogniate`,
    scopes: FOUR_AGS_SCOPES,
    extensions: [
      {
        domain,
        tool_id: 'cogniate',
        platform: 'canvas.instructure.com',
        privacy_level: 'anonymous',
        settings: {
          text: 'Cogniate',
          placements: [
            {
              placement: 'assignment_selection',
              message_type: 'LtiDeepLinkingRequest',
              target_link_uri: `${urls.lti}/lti/launch/cogniate`,
              text: 'Cogniate',
            },
          ],
        },
      },
    ],
    ...(key ? { public_jwk: key } : { public_jwk_url: `${urls.lti}/lti/keys/cogniate` }),
    custom_fields: {},
  };
}

describe('LA-E6-05 Record the key of an inline-key setup artifact (K1-SIM rows)', () => {
  it('AC-LA-E6-05-03: The Canvas JSON answers (jwk=url and jwk=inline) equal the golden JSON of LA-E3-07 and LA-E3-14 (no new member)', async () => {
    const sA = await session('A');
    const createRes = await app(sA, 'POST', '/app-api/connections', {
      name: unique('QA3 E6-05 Canvas JSON'),
      lms: 'canvas',
      method: 'manual',
      profile: CLOUD.profile,
      siteUrl: CLOUD.siteA,
    });
    expectStatus(createRes, 201);
    const connId = String(createRes.json.id);
    const domain = expectedDomain();

    const urlRes = await app(sA, 'GET', `${connPath(connId)}/canvas-configuration?jwk=url`);
    expectStatus(urlRes, 200);
    expect(urlRes.json).toEqual(expectedCanvasJson(sA.library.name, domain));
    expect(urlRes.headers['x-cogniate-key-id']).toBeUndefined();

    const inlineRes = await app(sA, 'GET', `${connPath(connId)}/canvas-configuration?jwk=inline`);
    expectStatus(inlineRes, 200);
    const jwksRes = await httpsRequest(`${urls.lti}/lti/keys/cogniate`);
    expectStatus(jwksRes, 200);
    const firstKey = JSON.parse(jwksRes.body).keys[0] as Json;
    expect(inlineRes.json).toEqual(expectedCanvasJson(sA.library.name, domain, firstKey));
    expect(inlineRes.headers['x-cogniate-key-id']).toBe(firstKey.kid);
  });

  it('AC-LA-E6-05-04: An export of another library connection gives 404 and writes nothing', async () => {
    const sA = await session('A');
    const sB = await session('B');
    const createRes = await app(sA, 'POST', '/app-api/connections', {
      name: unique('QA3 E6-05 Foreign'),
      lms: 'canvas',
      method: 'manual',
      profile: CLOUD.profile,
      siteUrl: CLOUD.siteA,
    });
    expectStatus(createRes, 201);
    const connId = String(createRes.json.id);

    const otherInline = await app(sB, 'GET', `${connPath(connId)}/canvas-configuration?jwk=inline`);
    expectStatus(otherInline, 404);
    const otherUrl = await app(sB, 'GET', `${connPath(connId)}/canvas-configuration?jwk=url`);
    expectStatus(otherUrl, 404);

    // Owner health confirms artifactKeyKid remained null
    const healthRes = await app(sA, 'GET', `${connPath(connId)}/health`);
    expectStatus(healthRes, 200);
    expect(healthRes.json.keys.artifactKeyKid).toBeNull();
    expect(healthRes.json.keys.artifactKeyCurrent).toBeNull();
  });
});
