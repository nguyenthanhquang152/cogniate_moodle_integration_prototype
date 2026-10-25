// LA-E3-05 K1-SIM suite: Deep Linking completeness — picker multi-select, cancel and acceptLineItem.
// Sources:
// - docs/architecture/ltiaas/tasks/LA-E3-05.md (AC-LA-E3-05-01..03, 05..08, 12)
// - docs/architecture/ltiaas/adr/LA-ADR-05-lti-advantage-completeness.md D3 (AP-05-12..AP-05-18, BD-A2-87)
// - docs/architecture/ltiaas/data-model.md §5b (picker_pick)
import { beforeAll, describe, expect, it } from 'vitest';
import {
  APP,
  DL,
  app,
  connPath,
  expectStatus,
  httpsRequest,
  issueGrant,
  launch,
  parseForm,
  session,
  unique,
  type Json,
} from '../../../acceptance/M1/common/client';
import { publication } from '../../../acceptance/M1/common/course';
import { ROLE, verifyToolJwt } from '../../../acceptance/M1/canvas/canvas';

const DL_SETTINGS_CLAIM = `${DL}deep_linking_settings`;
const DL_ITEMS_CLAIM = `${DL}content_items`;
const DL_MSG_CLAIM = `${DL}msg`;
const GENERIC_SITE = 'https://moodle.sim.test';

interface GenericBinding {
  s: any;
  connection: Json;
  clientId: string;
  deploymentId: string;
}

async function genericBound(library: 'A' | 'B' = 'A'): Promise<GenericBinding> {
  const s = await session(library);
  const clientId = unique('qa4-e305-gen');
  const deploymentId = unique('dep');
  const created = await app(s, 'POST', '/app-api/connections', {
    name: unique('QA4 E3-05 Generic'),
    siteUrl: GENERIC_SITE,
    method: 'manual',
    lms: 'lti-generic',
  });
  expectStatus(created, 201);
  const connection = created.json;

  const grant = await issueGrant(s, connection, deploymentId, {
    'client-id': clientId,
    issuer: GENERIC_SITE,
    'auth-url': `${GENERIC_SITE}/mod/lti/auth.php`,
    'token-url': `${GENERIC_SITE}/mod/lti/token.php`,
    'jwks-url': `${GENERIC_SITE}/mod/lti/certs.php`,
  });

  const bound = await app(s, 'PUT', `${connPath(connection.id)}/platform`, {
    issuer: GENERIC_SITE,
    clientId,
    deploymentId,
    authenticationEndpoint: `${GENERIC_SITE}/mod/lti/auth.php`,
    accessTokenEndpoint: `${GENERIC_SITE}/mod/lti/token.php`,
    jwksUrl: `${GENERIC_SITE}/mod/lti/certs.php`,
    grantCode: grant.code,
  });
  expectStatus(bound, 200);
  return { s, connection: bound.json, clientId, deploymentId };
}

async function openPickerForSettings(
  b: GenericBinding,
  settingsPatch: Record<string, unknown> = {},
): Promise<{ pickerUrl: string; page: { status: number; headers: any; body: string } }> {
  const id = unique('e305-dl');
  const result = await launch({
    id,
    provider: 'moodle-sim',
    clientId: b.clientId,
    deploymentId: b.deploymentId,
    siteHost: 'moodle.sim.test',
    roles: [ROLE.instructor],
    messageType: 'LtiDeepLinkingRequest',
    claims: {
      [DL_SETTINGS_CLAIM]: {
        deep_link_return_url: `${GENERIC_SITE}/mod/lti/contentitem_return.php?id=${encodeURIComponent(id)}`,
        accept_types: ['ltiResourceLink'],
        accept_presentation_document_targets: ['iframe', 'window'],
        auto_create: false,
        accept_multiple: true,
        ...settingsPatch,
      },
    },
  });
  expect(result.response.status).toBe(303);
  const handoff = await httpsRequest(String(result.response.headers.location));
  expect(handoff.status).toBe(303);
  const pickerUrl = new URL(String(handoff.headers.location), APP).href;
  const page = await httpsRequest(pickerUrl);
  return { pickerUrl, page };
}

describe('LA-E3-05 K1-SIM: Deep Linking completeness — picker multi-select, cancel and acceptLineItem', () => {
  let b: GenericBinding;
  let otherB: GenericBinding;
  let pubs: Json[] = [];
  let otherPub: Json;

  beforeAll(async () => {
    b = await genericBound('A');
    const p1 = await publication(b, 'scorm12');
    const p2 = await publication(b, 'html');
    const p3 = await publication(b, 'scorm12');
    pubs = [p1, p2, p3];

    otherB = await genericBound('A');
    otherPub = await publication(otherB, 'scorm12');
  });

  it('[SIM] AC-LA-E3-05-01 & AC-LA-E3-05-02: with acceptMultiple: true and channel content.multiple: true, GET /tool/picker/:pickerId renders checkboxes and Cancel button; submitting 3 courses returns 3 ltiResourceLink items in list order with distinct lineItem.resourceId {case:LA-E3-05-01}', async () => {
    const { pickerUrl, page } = await openPickerForSettings(b, { accept_multiple: true });
    expectStatus(page, 200);
    expect(page.body).toContain('type="checkbox" name="publicationId"');
    expect(page.body).toContain('Choose one or more courses (at most 20)');
    expect(page.body).toContain('data-cancel>Cancel</button>');

    // Extract the order of publications as rendered in the picker list
    const renderedIds = [...page.body.matchAll(/data-publication-id="(pub_[^"]+)"/g)].map((m) => m[1]);
    expect(renderedIds.length).toBeGreaterThanOrEqual(3);
    const threeInListOrder = renderedIds.slice(0, 3);

    // Submit in reversed form order to prove response preserves picker list order (newest first)
    const formBody = new URLSearchParams();
    for (const id of [...threeInListOrder].reverse()) {
      formBody.append('publicationId', id);
    }

    const postRes = await httpsRequest(pickerUrl, {
      method: 'POST',
      headers: {
        origin: APP,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: formBody.toString(),
    });
    expectStatus(postRes, 200);
    expect(postRes.body).toContain('Adding the courses to LMS');

    const { fields } = parseForm(postRes.body);
    expect(fields.JWT).toBeTruthy();
    const payload = await verifyToolJwt(fields.JWT);
    const items = payload[DL_ITEMS_CLAIM] as Array<Record<string, any>>;
    expect(Array.isArray(items)).toBe(true);
    expect(items).toHaveLength(3);
    for (const item of items) {
      expect(item.type).toBe('ltiResourceLink');
    }
    const resourceIds = items.map((item) => item.lineItem?.resourceId);
    expect(resourceIds).toEqual(threeInListOrder);
    expect(new Set(resourceIds).size).toBe(3);
  });

  it('[SIM] AC-LA-E3-05-03 & AC-LA-E3-05-12: submitting 21 course ids, a duplicate id, an id from another connection, or 2 ids when acceptMultiple: false returns 400 PUBLICATION_NOT_AVAILABLE {case:LA-E3-05-03}', async () => {
    const { pickerUrl } = await openPickerForSettings(b, { accept_multiple: true });

    // 1. 21 course ids
    const twentyOne = new URLSearchParams();
    for (let i = 0; i < 21; i++) {
      twentyOne.append('publicationId', `pub_fake_${i}`);
    }
    const res21 = await httpsRequest(pickerUrl, {
      method: 'POST',
      headers: { origin: APP, 'content-type': 'application/x-www-form-urlencoded' },
      body: twentyOne.toString(),
    });
    expect(res21.status).toBe(400);
    expect(res21.body).toContain('data-error-code="PUBLICATION_NOT_AVAILABLE"');

    // 2. Duplicate id
    const dupForm = new URLSearchParams();
    dupForm.append('publicationId', String(pubs[0].id));
    dupForm.append('publicationId', String(pubs[0].id));
    const resDup = await httpsRequest(pickerUrl, {
      method: 'POST',
      headers: { origin: APP, 'content-type': 'application/x-www-form-urlencoded' },
      body: dupForm.toString(),
    });
    expect(resDup.status).toBe(400);
    expect(resDup.body).toContain('data-error-code="PUBLICATION_NOT_AVAILABLE"');

    // 3. Publication id from another connection
    const otherForm = new URLSearchParams({ publicationId: String(otherPub.id) });
    const resOther = await httpsRequest(pickerUrl, {
      method: 'POST',
      headers: { origin: APP, 'content-type': 'application/x-www-form-urlencoded' },
      body: otherForm.toString(),
    });
    expect(resOther.status).toBe(400);
    expect(resOther.body).toContain('data-error-code="PUBLICATION_NOT_AVAILABLE"');

    // 4. 2 ids when accept_multiple: false
    const singlePicker = await openPickerForSettings(b, { accept_multiple: false });
    expectStatus(singlePicker.page, 200);
    expect(singlePicker.page.body).toContain('type="radio" name="publicationId"');
    const twoForm = new URLSearchParams();
    twoForm.append('publicationId', String(pubs[0].id));
    twoForm.append('publicationId', String(pubs[1].id));
    const resTwoOnSingle = await httpsRequest(singlePicker.pickerUrl, {
      method: 'POST',
      headers: { origin: APP, 'content-type': 'application/x-www-form-urlencoded' },
      body: twoForm.toString(),
    });
    expect(resTwoOnSingle.status).toBe(400);
    expect(resTwoOnSingle.body).toContain('data-error-code="PUBLICATION_NOT_AVAILABLE"');
  });

  it('[SIM] AC-LA-E3-05-05, AC-LA-E3-05-06 & AC-LA-E3-05-07: POST /tool/picker/:pickerId/cancel with wrong Origin returns 403 without consuming session; valid Origin returns auto-submit form with content_items: [] and "No course was added."; empty connection page has Cancel button {case:LA-E3-05-05}', async () => {
    // Empty connection page has Cancel button
    const emptyB = await genericBound('A');
    const emptyPicker = await openPickerForSettings(emptyB, { accept_multiple: true });
    expectStatus(emptyPicker.page, 200);
    expect(emptyPicker.page.body).toContain('data-empty');
    expect(emptyPicker.page.body).toContain('data-cancel>Cancel</button>');

    // Wrong Origin on /cancel returns 403 ORIGIN_NOT_ALLOWED without consuming session
    const wrongOriginRes = await httpsRequest(`${emptyPicker.pickerUrl}/cancel`, {
      method: 'POST',
      headers: { origin: 'https://evil.example.test' },
    });
    expect(wrongOriginRes.status).toBe(403);
    expect(wrongOriginRes.body).toContain('data-error-code="ORIGIN_NOT_ALLOWED"');

    // Valid Origin on /cancel consumes session and returns empty Deep Linking response with "No course was added."
    const cancelRes = await httpsRequest(`${emptyPicker.pickerUrl}/cancel`, {
      method: 'POST',
      headers: { origin: APP },
    });
    expectStatus(cancelRes, 200);
    expect(cancelRes.body).toContain('<p>No course was added.</p>');
    const { fields } = parseForm(cancelRes.body);
    expect(fields.JWT).toBeTruthy();
    const payload = await verifyToolJwt(fields.JWT);
    expect(payload[DL_ITEMS_CLAIM]).toEqual([]);
    expect(payload[DL_MSG_CLAIM]).toBe('No course was added.');

    // Subsequent GET on consumed picker returns 410 PICKER_USED
    const afterCancelGet = await httpsRequest(emptyPicker.pickerUrl);
    expect(afterCancelGet.status).toBe(410);
    expect(afterCancelGet.body).toContain('data-error-code="PICKER_USED"');
  });

  it('[SIM] AC-LA-E3-05-08: with acceptLineItem: false, GET and POST /tool/picker/:pickerId return 403 PLACEMENT_NOT_GRADED and make no Deep Linking call {case:LA-E3-05-08}', async () => {
    const { pickerUrl, page } = await openPickerForSettings(b, { accept_lineitem: false });
    expect(page.status).toBe(403);
    expect(page.body).toContain('data-error-code="PLACEMENT_NOT_GRADED"');

    const postRes = await httpsRequest(pickerUrl, {
      method: 'POST',
      headers: {
        origin: APP,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ publicationId: String(pubs[0].id) }).toString(),
    });
    expect(postRes.status).toBe(403);
    expect(postRes.body).toContain('data-error-code="PLACEMENT_NOT_GRADED"');
  });
});
