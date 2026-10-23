// LA-E3-13 K1-SIM acceptance tests (requires SIM Docker stack).
// Sources:
// - docs/architecture/ltiaas/tasks/LA-E3-13.md (AC-LA-E3-13-01 .. AC-LA-E3-13-04)
// - docs/architecture/ltiaas/adr/LA-ADR-05-lti-advantage-completeness.md D3e
// - docs/architecture/ltiaas/contracts/lti-service-api-delta.md §4.2 ("Per type" row)
import { describe, expect, it } from 'vitest';
import {
  ACCOUNT,
  apiKey,
  auth,
  errorCode,
  hasErrorShape,
  ltiApi,
  recordSecret,
} from '../../../acceptance/lib/lti';
import {
  CLOUD,
  PATHS,
  ROLE,
  canvasLaunch,
  canvasPlatform,
  verifyToolJwt,
} from '../../../acceptance/M1/canvas/canvas';
import { DL, LTI, unique } from '../../../acceptance/M1/common/client';

const DL_SETTINGS_CLAIM = `${DL}deep_linking_settings`;
const DL_ITEMS_CLAIM = `${DL}content_items`;

function errorDescription(res: { json: unknown }): string {
  return String((res.json as { details?: { description?: unknown } } | null)?.details?.description ?? '');
}

async function launchDeepLinkingAllTypes(label: string) {
  const target = await canvasPlatform({ name: unique(`QA4 E3-13 ${label}`) });
  const id = unique(`dl-${label}`);
  const returnUrl = `${CLOUD.siteA}${PATHS.dlReturn}?data=${encodeURIComponent(`data-${id}`)}`;
  const settings: Record<string, unknown> = {
    deep_link_return_url: returnUrl,
    accept_types: ['ltiResourceLink', 'link', 'file', 'image', 'html'],
    accept_presentation_document_targets: ['iframe', 'window'],
    accept_multiple: true,
    auto_create: false,
  };

  const launched = await canvasLaunch(target, {
    id,
    roles: [ROLE.instructor],
    messageType: 'LtiDeepLinkingRequest',
    claims: {
      [DL_SETTINGS_CLAIM]: settings,
    },
  });
  expect(launched.response.status).toBe(303);
  return { target, ltik: launched.ltik };
}

describe('LA-E3-13 Deep Linking per-type item fields (K1-SIM)', () => {
  it('[SIM] AC-LA-E3-13-01 & AC-LA-E3-13-02: link/file/image without https url or html without string html returns 400 INVALID_CONTENT_ITEM naming item index {case:LA-E3-13-01}', async () => {
    const key = apiKey(ACCOUNT);
    const { ltik } = await launchDeepLinkingAllTypes('ac01');
    const authz = auth.ltik(key, ltik);

    // AC-LA-E3-13-01 (a): {type: "link"} without url
    const noUrl = await ltiApi('POST', '/api/deeplinking', {
      authorization: authz,
      body: { contentItems: [{ type: 'link', title: 'Missing URL' }] },
    });
    expect(noUrl.status).toBe(400);
    expect(hasErrorShape(noUrl)).toBe(true);
    expect(errorCode(noUrl)).toBe('INVALID_CONTENT_ITEM');
    expect(errorDescription(noUrl).includes('0')).toBe(true);

    // AC-LA-E3-13-01 (b): {type: "link", url: "http://x.test"} at index 1
    const httpUrl = await ltiApi('POST', '/api/deeplinking', {
      authorization: authz,
      body: {
        contentItems: [
          { type: 'link', url: 'https://x.test/ok' },
          { type: 'link', url: 'http://x.test' },
        ],
      },
    });
    expect(httpUrl.status).toBe(400);
    expect(hasErrorShape(httpUrl)).toBe(true);
    expect(errorCode(httpUrl)).toBe('INVALID_CONTENT_ITEM');
    expect(errorDescription(httpUrl).includes('1')).toBe(true);

    // AC-LA-E3-13-02: {type: "html"} without string html
    const badHtml = await ltiApi('POST', '/api/deeplinking', {
      authorization: authz,
      body: { contentItems: [{ type: 'html', title: 'No html field' }] },
    });
    expect(badHtml.status).toBe(400);
    expect(hasErrorShape(badHtml)).toBe(true);
    expect(errorCode(badHtml)).toBe('INVALID_CONTENT_ITEM');
  });

  it('[SIM] AC-LA-E3-13-03 & AC-LA-E3-13-04: valid file item and ltiResourceLink item return 200 with expected content_items in signed JWT {case:LA-E3-13-03}', async () => {
    const key = apiKey(ACCOUNT);
    const { ltik } = await launchDeepLinkingAllTypes('ac03');
    const authz = auth.ltik(key, ltik);

    // AC-LA-E3-13-03: {type: "file", url: "https://x.test/a.pdf"} -> 200
    const fileRes = await ltiApi<{ message?: string }>('POST', '/api/deeplinking', {
      authorization: authz,
      body: { contentItems: [{ type: 'file', url: 'https://x.test/a.pdf' }] },
    });
    expect(fileRes.status).toBe(200);
    const fileJwt = String(fileRes.json?.message ?? '');
    recordSecret('id_token', fileJwt);
    const filePayload = await verifyToolJwt(fileJwt);
    expect(filePayload[`${LTI}message_type`]).toBe('LtiDeepLinkingResponse');
    expect(filePayload[DL_ITEMS_CLAIM]).toEqual([{ type: 'file', url: 'https://x.test/a.pdf' }]);

    // AC-LA-E3-13-04: ltiResourceLink unchanged
    const rlRes = await ltiApi<{ message?: string }>('POST', '/api/deeplinking', {
      authorization: authz,
      body: {
        contentItems: [
          {
            type: 'ltiResourceLink',
            title: 'Cogniate Activity',
            lineItem: { scoreMaximum: 100, label: 'Cogniate Activity', resourceId: 'pub-1' },
          },
        ],
      },
    });
    expect(rlRes.status).toBe(200);
    const rlJwt = String(rlRes.json?.message ?? '');
    recordSecret('id_token', rlJwt);
    const rlPayload = await verifyToolJwt(rlJwt);
    const items = rlPayload[DL_ITEMS_CLAIM] as Array<Record<string, unknown>>;
    expect(Array.isArray(items) && items.length === 1).toBe(true);
    expect(items[0]?.type).toBe('ltiResourceLink');
    expect(items[0]?.title).toBe('Cogniate Activity');
  });
});
