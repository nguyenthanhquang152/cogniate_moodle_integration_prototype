// LA-E3-04 K1-SIM acceptance tests: Deep Linking completeness: service part
// (AC-LA-E3-04-01, AC-LA-E3-04-02, AC-LA-E3-04-04, AC-LA-E3-04-05, plus HTTP-level checks for AC-LA-E3-04-03, AC-LA-E3-04-06, AC-LA-E3-04-07).
// Source: docs/architecture/ltiaas/tasks/LA-E3-04.md (at 4c11521); LA-ADR-05 D3; contract delta §4.1, §4.2; LA-ADR-04 D8 LA-IC-12.
// QA-4 wrote these tests from the spec, contracts and ADRs only (test-first).
import fs from 'node:fs';
import path from 'node:path';
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
  DL,
  LTI,
  expectStatus,
  idToken,
  unique,
  urls,
  type Json,
} from '../../../acceptance/M1/common/client';
import {
  CLOUD,
  PATHS,
  ROLE,
  canvasLaunch,
  canvasPlatform,
  verifyToolJwt,
} from '../../../acceptance/M1/canvas/canvas';

const DL_SETTINGS_CLAIM = `${DL}deep_linking_settings`;
const DL_ITEMS_CLAIM = `${DL}content_items`;

function writeArtifact(name: string, content: string): void {
  const runDir = process.env.LA_RUN_DIR;
  if (!runDir) return;
  fs.mkdirSync(runDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(runDir, name), content, { mode: 0o600 });
}

function unescapeHtml(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function extractFormJwt(formHtml: string): string {
  const input = formHtml.match(/<input\b[^>]*\bname="JWT"[^>]*>/i)?.[0] ?? '';
  const val = input.match(/\bvalue="([^"]*)"/i)?.[1] ?? '';
  return unescapeHtml(val);
}

/**
 * Registers a fresh Canvas simulator platform and performs an instructor Deep Linking launch
 * with the specified `deep_linking_settings` overrides.
 */
async function launchDeepLinking(label: string, settingsPatch: Record<string, unknown> = {}) {
  const target = await canvasPlatform({ name: unique(`QA4 E3-04 ${label}`) });
  const id = unique(`dl-${label}`);
  const returnUrl = `${CLOUD.siteA}${PATHS.dlReturn}?data=${encodeURIComponent(`data-${id}`)}`;
  const settings: Record<string, unknown> = {
    deep_link_return_url: returnUrl,
    accept_types: ['ltiResourceLink'],
    accept_presentation_document_targets: ['iframe', 'window'],
    accept_multiple: false,
    auto_create: false,
    ...settingsPatch,
  };

  const launched = await canvasLaunch(target, {
    id,
    roles: [ROLE.instructor],
    messageType: 'LtiDeepLinkingRequest',
    claims: {
      [DL_SETTINGS_CLAIM]: settings,
    },
  });
  expect(launched.response.status, `Deep Linking launch (${label}) status`).toBe(303);
  expect(launched.ltik, `Deep Linking launch (${label}) returned ltik`).toBeTruthy();

  return {
    target,
    ltik: launched.ltik,
    returnUrl,
    settings,
  };
}

describe('LA-E3-04 Deep Linking completeness: service part (K1-SIM)', () => {
  it('[SIM] AC-LA-E3-04-01: POST /api/deeplinking {contentItems: []} on a Deep Linking launch gives 200 and the signed JWT has content_items: [] (and /message + /form match, AC-07) {case:LA-E3-04-01}', async () => {
    const key = apiKey(ACCOUNT);
    const dl = await launchDeepLinking('ac01', { accept_multiple: true });
    const authz = auth.ltik(key, dl.ltik);

    const res = await ltiApi<{ message?: string; target?: string }>('POST', '/api/deeplinking', {
      authorization: authz,
      body: { contentItems: [] },
    });
    expect(res.status, `POST /api/deeplinking {contentItems: []} status; body=${res.body}`).toBe(200);
    const jwt = String(res.json?.message ?? '');
    expect(jwt, 'response has signed message JWT').toBeTruthy();
    recordSecret('id_token', jwt);

    const payload = await verifyToolJwt(jwt);
    expect(payload[`${LTI}message_type`], 'JWT message_type').toBe('LtiDeepLinkingResponse');
    expect(payload[DL_ITEMS_CLAIM], 'JWT content_items is []').toEqual([]);

    // AC-LA-E3-04-07 parity on /api/deeplinking/message and /api/deeplinking/form for empty contentItems.
    const msgRes = await ltiApi<{ message?: string; target?: string }>('POST', '/api/deeplinking/message', {
      authorization: authz,
      body: { contentItems: [] },
    });
    expect(msgRes.status, 'POST /api/deeplinking/message {contentItems: []} status').toBe(200);
    const msgPayload = await verifyToolJwt(String(msgRes.json?.message ?? ''));
    expect(msgPayload[DL_ITEMS_CLAIM], '/message JWT content_items is []').toEqual([]);

    const formRes = await ltiApi<{ form?: string }>('POST', '/api/deeplinking/form', {
      authorization: authz,
      body: { contentItems: [] },
    });
    expect(formRes.status, 'POST /api/deeplinking/form {contentItems: []} status').toBe(200);
    const formJwt = extractFormJwt(String(formRes.json?.form ?? ''));
    expect(formJwt, '/form hidden JWT present').toBeTruthy();
    const formPayload = await verifyToolJwt(formJwt);
    expect(formPayload[DL_ITEMS_CLAIM], '/form JWT content_items is []').toEqual([]);

    writeArtifact(
      'e3-04-ac01.json',
      `${JSON.stringify({ status: res.status, contentItemsClaim: payload[DL_ITEMS_CLAIM] }, null, 2)}\n`,
    );
  });

  it('[SIM] AC-LA-E3-04-02: POST /api/deeplinking {contentItems: []} on a launch with accept_multiple: false gives 200 (and 2 or 21 items give 400 INVALID_CONTENT_ITEM, AC-03) {case:LA-E3-04-02}', async () => {
    const key = apiKey(ACCOUNT);
    const dl = await launchDeepLinking('ac02', { accept_multiple: false });
    const authz = auth.ltik(key, dl.ltik);

    const emptyRes = await ltiApi<{ message?: string }>('POST', '/api/deeplinking', {
      authorization: authz,
      body: { contentItems: [] },
    });
    expect(emptyRes.status, `empty contentItems with accept_multiple: false; body=${emptyRes.body}`).toBe(200);
    const payload = await verifyToolJwt(String(emptyRes.json?.message ?? ''));
    expect(payload[DL_ITEMS_CLAIM], 'JWT content_items is []').toEqual([]);

    // AC-LA-E3-04-03 check: with accept_multiple: false, 2 items -> 400 INVALID_CONTENT_ITEM; 21 items -> 400 INVALID_CONTENT_ITEM.
    const makeItem = (i: number) => ({
      type: 'ltiResourceLink',
      title: `QA4 Item ${i}`,
      url: `${urls.lti}/lti/launch/${ACCOUNT}?resource=item-${i}`,
    });

    const twoRes = await ltiApi('POST', '/api/deeplinking', {
      authorization: authz,
      body: { contentItems: [makeItem(1), makeItem(2)] },
    });
    expect(twoRes.status, '2 items with accept_multiple: false -> 400').toBe(400);
    expect(errorCode(twoRes)).toBe('INVALID_CONTENT_ITEM');
    expect(hasErrorShape(twoRes)).toBe(true);

    const dlMulti = await launchDeepLinking('ac02-multi', { accept_multiple: true });
    const twentyOneRes = await ltiApi('POST', '/api/deeplinking', {
      authorization: auth.ltik(key, dlMulti.ltik),
      body: { contentItems: Array.from({ length: 21 }, (_, i) => makeItem(i + 1)) },
    });
    expect(twentyOneRes.status, '21 items -> 400').toBe(400);
    expect(errorCode(twentyOneRes)).toBe('INVALID_CONTENT_ITEM');
    expect(hasErrorShape(twentyOneRes)).toBe(true);

    writeArtifact(
      'e3-04-ac02.json',
      `${JSON.stringify(
        {
          emptyStatus: emptyRes.status,
          twoItemsStatus: twoRes.status,
          twoItemsCode: errorCode(twoRes),
          twentyOneItemsStatus: twentyOneRes.status,
          twentyOneItemsCode: errorCode(twentyOneRes),
        },
        null,
        2,
      )}\n`,
    );
  });

  it('[SIM] AC-LA-E3-04-04: with accept_lineitem: false, an item with lineItem gives 400 INVALID_CONTENT_ITEM and the same item without lineItem gives 200 (and /message + /form match, AC-07) {case:LA-E3-04-04}', async () => {
    const key = apiKey(ACCOUNT);
    const dl = await launchDeepLinking('ac04', { accept_lineitem: false });
    const authz = auth.ltik(key, dl.ltik);

    const itemWithoutLineItem = {
      type: 'ltiResourceLink',
      title: 'QA4 Ungraded Resource',
      url: `${urls.lti}/lti/launch/${ACCOUNT}?resource=qa4-ungraded`,
    };
    const itemWithLineItem = {
      ...itemWithoutLineItem,
      lineItem: { scoreMaximum: 100, label: 'QA4 Graded Column' },
    };

    for (const endpoint of ['/api/deeplinking', '/api/deeplinking/message', '/api/deeplinking/form']) {
      const denied = await ltiApi('POST', endpoint, {
        authorization: authz,
        body: { contentItems: [itemWithLineItem] },
      });
      expect(denied.status, `${endpoint} with lineItem when accept_lineitem: false -> 400; body=${denied.body}`).toBe(400);
      expect(errorCode(denied), `${endpoint} error code`).toBe('INVALID_CONTENT_ITEM');
      expect(hasErrorShape(denied), `${endpoint} error shape`).toBe(true);

      const allowed = await ltiApi<Json>('POST', endpoint, {
        authorization: authz,
        body: { contentItems: [itemWithoutLineItem] },
      });
      expect(allowed.status, `${endpoint} without lineItem when accept_lineitem: false -> 200; body=${allowed.body}`).toBe(200);
      const jwt = endpoint.endsWith('/form')
        ? extractFormJwt(String(allowed.json?.form ?? ''))
        : String(allowed.json?.message ?? '');
      const payload = await verifyToolJwt(jwt);
      const items = payload[DL_ITEMS_CLAIM] as Array<Record<string, unknown>>;
      expect(Array.isArray(items) && items.length === 1, `${endpoint} signed 1 item`).toBe(true);
      expect('lineItem' in items[0], `${endpoint} signed item has no lineItem`).toBe(false);
    }

    writeArtifact('e3-04-ac04.json', `${JSON.stringify({ verifiedEndpoints: ['/api/deeplinking', '/api/deeplinking/message', '/api/deeplinking/form'] }, null, 2)}\n`);
  });

  it('[SIM] AC-LA-E3-04-05: GET /api/idtoken of a Deep Linking launch with accept_lineitem and accept_media_types shows acceptLineItem and acceptMediaTypes with the same values, and omits them when absent (AC-06) {case:LA-E3-04-05}', async () => {
    // 1. Launch WITH accept_lineitem and accept_media_types present.
    const withSettings = await launchDeepLinking('ac05-present', {
      accept_lineitem: false,
      accept_media_types: 'text/html,application/pdf',
    });
    const tokPresent = await idToken(withSettings.ltik);
    expectStatus(tokPresent, 200);
    const dlPresent = tokPresent.json?.launch?.deepLinkingSettings as Record<string, unknown> | undefined;
    expect(dlPresent, 'launch.deepLinkingSettings present').toBeDefined();
    expect(dlPresent?.acceptLineItem, 'acceptLineItem equals accept_lineitem').toBe(false);
    expect(dlPresent?.acceptMediaTypes, 'acceptMediaTypes equals accept_media_types').toBe('text/html,application/pdf');

    // 2. Launch with accept_lineitem: true and accept_media_types: '*/*'.
    const withTrue = await launchDeepLinking('ac05-true', {
      accept_lineitem: true,
      accept_media_types: '*/*',
    });
    const tokTrue = await idToken(withTrue.ltik);
    expectStatus(tokTrue, 200);
    const dlTrue = tokTrue.json?.launch?.deepLinkingSettings as Record<string, unknown> | undefined;
    expect(dlTrue?.acceptLineItem, 'acceptLineItem === true').toBe(true);
    expect(dlTrue?.acceptMediaTypes, 'acceptMediaTypes === */*').toBe('*/*');

    // 3. AC-LA-E3-04-06: Launch WITHOUT accept_lineitem and accept_media_types omits both members.
    const withoutSettings = await launchDeepLinking('ac05-absent', {});
    const tokAbsent = await idToken(withoutSettings.ltik);
    expectStatus(tokAbsent, 200);
    const dlAbsent = tokAbsent.json?.launch?.deepLinkingSettings as Record<string, unknown> | undefined;
    expect(dlAbsent, 'launch.deepLinkingSettings present').toBeDefined();
    expect(Object.prototype.hasOwnProperty.call(dlAbsent, 'acceptLineItem'), 'no acceptLineItem when absent').toBe(false);
    expect(Object.prototype.hasOwnProperty.call(dlAbsent, 'acceptMediaTypes'), 'no acceptMediaTypes when absent').toBe(false);

    writeArtifact(
      'e3-04-ac05.json',
      `${JSON.stringify({ present: dlPresent, presentTrue: dlTrue, absent: dlAbsent }, null, 2)}\n`,
    );
  });
});
