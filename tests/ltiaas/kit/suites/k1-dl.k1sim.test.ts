import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runSingleSelectRefusal } from '../lib/cases.js';
import {
  buildPickerSelectionForm,
  contentItemPublicationIds,
  loadSelectedChannelFixtures,
  orderByPickerList,
} from '../lib/fixtures.js';
import {
  ACCOUNT,
  apiKey,
  APP_ORIGIN,
  appRequest,
  auth,
  ChannelBinding,
  decodeJwt,
  DL,
  endConnection,
  ensureKitRunInitialized,
  expectStatus,
  formPost,
  idToken,
  launchOnChannel,
  LTI,
  ltiApi,
  noServiceCalls,
  openPickerOnChannel,
  parseForm,
  pick,
  publication,
  PublicationRef,
  records,
  returnDeepLink,
  ROLE_LEARNER,
  runKitCase,
  setupChannelBinding,
} from '../lib/runtime.js';

const fixtures = loadSelectedChannelFixtures();

describe('K1-DL — Port 3 Content Selection / Deep Linking across selected channels', () => {
  beforeAll(() => {
    ensureKitRunInitialized({ channels: fixtures.map((f) => f.id) });
  });

  for (const fixture of fixtures) {
    describe(`channel: ${fixture.id}`, () => {
      let binding: ChannelBinding;
      let pub1: PublicationRef;
      let pub2: PublicationRef;
      let pub3: PublicationRef;

      beforeAll(async () => {
        binding = await setupChannelBinding(fixture);
        pub1 = await publication(binding, 'scorm12', { title: `DL1-${fixture.id}` });
        pub2 = await publication(binding, 'scorm12', { title: `DL2-${fixture.id}` });
        pub3 = await publication(binding, 'scorm12', { title: `DL3-${fixture.id}` });
      });

      afterAll(async () => {
        if (binding) {
          await endConnection(binding.session, binding.connection.id);
        }
      });

      it(`${fixture.id}:K1-DL:D1 — Deep Linking response JWT (iss, aud, nonce, deployment_id, message_type, version, sub rule, data mode, exact return URL, window hint)`, async () => {
        await runKitCase(fixture.id, 'K1-DL', 'D1', async () => {
          const dlData = `dl-data-${fixture.id}`;
          // GET /tool/picker/:pickerId -> POST /tool/picker/:pickerId -> returnDeepLink (M1/common/course.ts:88-112; cogniate-app-api-delta.md §5)
          const picker = await openPickerOnChannel(binding, {
            dlData,
          });
          expect(picker.status).toBe(200);

          const picked = await pick(picker.pickerUrl, pub1.id);
          expect(picked.action).toContain('deep-link/return');
          expect(picked.jwt).toBeTruthy();

          const ret = await returnDeepLink(picked);
          expect(ret.status).toBe(200);

          const simRecs = await records();
          // Simulator Deep Linking return records use kind === 'deep-link' (tests/sim/core/provider.mjs:343)
          const dlRec = [...simRecs.records]
            .reverse()
            .find((r: Record<string, unknown>) => r.kind === 'deep-link');
          expect(dlRec).toBeDefined();
          expect(dlRec!.signatureOk).toBe(true);

          const decoded = decodeJwt(picked.jwt);
          const payload = decoded.payload as Record<string, unknown>;

          expect(payload.iss).toBe(binding.clientId);
          expect(payload.aud).toBe(binding.issuer);
          expect(payload[`${LTI}deployment_id`]).toBe(binding.deploymentId);
          expect(payload[`${LTI}message_type`]).toBe('LtiDeepLinkingResponse');
          expect(payload[`${LTI}version`]).toBe('1.3.0');
          expect(typeof payload.nonce).toBe('string');

          // sub rule: dlRequiresSub -> payload.sub === payload.iss, else omitted
          if (fixture.sim.dlRequiresSub) {
            expect(payload.sub).toBe(binding.clientId);
          } else {
            expect(payload.sub).toBeUndefined();
          }

          // data mode: claim vs query
          if (fixture.sim.dlDataMode === 'claim') {
            expect(payload[`${DL}data`]).toBe(dlData);
          } else {
            expect(picked.action).toContain(`data=${encodeURIComponent(dlData)}`);
          }

          // window hint: window.targetName when launch.windowHint is true
          const items = payload[`${DL}content_items`] as Array<Record<string, unknown>>;
          expect(Array.isArray(items)).toBe(true);
          expect(items.length).toBe(1);
          if (fixture.capabilities['launch.windowHint']) {
            expect(
              (items[0].window as Record<string, unknown> | undefined)?.targetName,
            ).toBeTruthy();
          } else {
            expect(items[0].window).toBeUndefined();
          }
        });
      });

      it(`${fixture.id}:K1-DL:D2 — One graded item has scoreMaximum: 100`, async () => {
        await runKitCase(fixture.id, 'K1-DL', 'D2', async () => {
          const picker = await openPickerOnChannel(binding);
          expect(picker.status).toBe(200);
          const picked = await pick(picker.pickerUrl, pub1.id);
          const decoded = decodeJwt(picked.jwt);
          const items = decoded.payload[`${DL}content_items`] as Array<
            Record<string, unknown>
          >;
          expect(items.length).toBe(1);
          expect(items[0].type).toBe('ltiResourceLink');
          expect(
            (items[0].lineItem as Record<string, unknown> | undefined)?.scoreMaximum,
          ).toBe(100);
        });
      });

      it(`${fixture.id}:K1-DL:D3 — accept_multiple: true returns N items in list order when content.multiple is true and stays single-select when false; accept_multiple: false refuses >1 items and >20 items`, async () => {
        await runKitCase(fixture.id, 'K1-DL', 'D3', async () => {
          // 1. acceptMultiple: true. The picker POST field is `publicationId`, repeated
          // (cogniate-app-api.md §6; LA-ADR-05 D3b: 1 to 20 ids, items keep the list order).
          const multiPicker = await openPickerOnChannel(binding, {
            acceptMultiple: true,
          });
          expect(multiPicker.status).toBe(200);
          const listed = orderByPickerList(multiPicker.html, [pub1.id, pub2.id, pub3.id]);
          const pickerPath = (url: string) => {
            const u = new URL(url);
            return `${u.pathname}${u.search}`;
          };

          if (fixture.capabilities['content.multiple']) {
            expect(multiPicker.html).toContain('type="checkbox"');
            const postRes = await appRequest('POST', pickerPath(multiPicker.pickerUrl), {
              headers: {
                accept: 'text/html',
                origin: APP_ORIGIN,
              },
              form: buildPickerSelectionForm(listed),
            });
            expect(postRes.status).toBe(200);
            const form = parseForm(postRes.text);
            const decoded = decodeJwt(form.fields.JWT);
            const items = decoded.payload[`${DL}content_items`] as Array<
              Record<string, unknown>
            >;
            expect(items.length).toBe(3);
            expect(contentItemPublicationIds(items)).toEqual(listed);
          } else {
            // Single select stays when content.multiple is false (ruling A1 BD-A1-120): two ids give
            // the 400 page PUBLICATION_NOT_AVAILABLE with no JWT; the picker stays unused, so one id on
            // the same picker then gives exactly that item (lib/cases.ts runSingleSelectRefusal).
            expect(multiPicker.html).toContain('type="radio"');
            expect(multiPicker.html).not.toContain('type="checkbox"');
            const cursorRefusal = (await records()).cursor;
            const refusal = await runSingleSelectRefusal(
              { pickerUrl: multiPicker.pickerUrl, publicationIds: [listed[0], listed[1]] },
              {
                postSelection: (url, form) =>
                  appRequest('POST', pickerPath(url), {
                    headers: {
                      accept: 'text/html',
                      origin: APP_ORIGIN,
                    },
                    form,
                  }),
              },
            );
            expect(refusal.controlIds).toEqual([listed[0]]);
            // No Deep Linking return reached the platform simulator
            expect(
              (await records(cursorRefusal)).records.filter((r) => r.kind === 'deep-link'),
            ).toEqual([]);
          }

          // 2. Service-level POST /api/deeplinking with LTIK-AUTH-V2 (lti-service-api.md §3.2; lti-service-api-delta.md §4.2):
          // acceptMultiple: false refuses >1 items and >20 items
          const singlePicker = await openPickerOnChannel(binding, {
            acceptMultiple: false,
          });
          const twoItemsRes = await ltiApi('POST', '/api/deeplinking', {
            authorization: auth.ltik(apiKey(ACCOUNT), singlePicker.ltik),
            body: {
              contentItems: [
                {
                  type: 'ltiResourceLink',
                  title: 'Item 1',
                  url: `${APP_ORIGIN}/tool/launch/${pub1.id}`,
                },
                {
                  type: 'ltiResourceLink',
                  title: 'Item 2',
                  url: `${APP_ORIGIN}/tool/launch/${pub2.id}`,
                },
              ],
            },
          });
          expectStatus(twoItemsRes, 400, 'INVALID_CONTENT_ITEM');

          const multiPicker2 = await openPickerOnChannel(binding, {
            acceptMultiple: true,
          });
          const twentyOneItems = Array.from({ length: 21 }, (_, idx) => ({
            type: 'ltiResourceLink',
            title: `Item ${idx + 1}`,
            url: `${APP_ORIGIN}/tool/launch/${pub1.id}`,
          }));
          const tooManyRes = await ltiApi('POST', '/api/deeplinking', {
            authorization: auth.ltik(apiKey(ACCOUNT), multiPicker2.ltik),
            body: {
              contentItems: twentyOneItems,
            },
          });
          expectStatus(tooManyRes, 400, 'INVALID_CONTENT_ITEM');
        });
      });

      it(`${fixture.id}:K1-DL:D4 — Cancel posts content_items: [] to return URL; cancel with foreign Origin returns 403 ORIGIN_NOT_ALLOWED without consuming session`, async () => {
        await runKitCase(fixture.id, 'K1-DL', 'D4', async () => {
          const picker = await openPickerOnChannel(binding);
          expect(picker.status).toBe(200);
          const u = new URL(picker.pickerUrl);
          const cancelPath = `${u.pathname}/cancel${u.search}`;

          // 1. Foreign Origin on POST /tool/picker/:pickerId/cancel -> 403 ORIGIN_NOT_ALLOWED without consuming session (cogniate-app-api-delta.md §5)
          const badOriginRes = await appRequest('POST', cancelPath, {
            headers: {
              accept: 'text/html',
              origin: 'https://evil-attacker.sim.test',
            },
            form: {},
          });
          expect(badOriginRes.status).toBe(403);
          expect(badOriginRes.text).toContain('data-error-code="ORIGIN_NOT_ALLOWED"');

          // 2. Valid Origin on POST /tool/picker/:pickerId/cancel -> posts content_items: [] to return URL
          const okCancelRes = await appRequest('POST', cancelPath, {
            headers: {
              accept: 'text/html',
              origin: APP_ORIGIN,
            },
            form: {},
          });
          expect(okCancelRes.status).toBe(200);
          const cancelForm = parseForm(okCancelRes.text);
          expect(cancelForm.fields.JWT).toBeTruthy();

          const ret = await formPost(cancelForm.action, { JWT: cancelForm.fields.JWT });
          expect(ret.status).toBe(200);

          const decoded = decodeJwt(cancelForm.fields.JWT);
          expect(decoded.payload[`${DL}content_items`]).toEqual([]);
        });
      });

      it(`${fixture.id}:K1-DL:D5 — accept_lineitem: false: service refuses item with lineItem (400 INVALID_CONTENT_ITEM) and accepts item without lineItem; picker returns 403 PLACEMENT_NOT_GRADED with zero DL calls when content.ungraded is false`, async () => {
        await runKitCase(fixture.id, 'K1-DL', 'D5', async () => {
          // 1. Service-level POST /api/deeplinking with acceptLineitem: false (lti-service-api-delta.md §6)
          const launched1 = await launchOnChannel(binding, {
            messageType: 'LtiDeepLinkingRequest',
            roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
            acceptLineitem: false,
          });
          expect(launched1.response.status).toBe(303);

          const withLineItemRes = await ltiApi('POST', '/api/deeplinking', {
            authorization: auth.ltik(apiKey(ACCOUNT), launched1.ltik!),
            body: {
              contentItems: [
                {
                  type: 'ltiResourceLink',
                  title: 'Should Refuse LineItem',
                  url: `${APP_ORIGIN}/tool/launch/${pub1.id}`,
                  lineItem: { scoreMaximum: 100 },
                },
              ],
            },
          });
          expectStatus(withLineItemRes, 400, 'INVALID_CONTENT_ITEM');

          const launched2 = await launchOnChannel(binding, {
            messageType: 'LtiDeepLinkingRequest',
            roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
            acceptLineitem: false,
          });
          const withoutLineItemRes = await ltiApi('POST', '/api/deeplinking', {
            authorization: auth.ltik(apiKey(ACCOUNT), launched2.ltik!),
            body: {
              contentItems: [
                {
                  type: 'ltiResourceLink',
                  title: 'Ungraded Item Allowed At Service Layer',
                  url: `${APP_ORIGIN}/tool/launch/${pub1.id}`,
                },
              ],
            },
          });
          expectStatus(withoutLineItemRes, 200);
          const dlResJson = withoutLineItemRes.json as
            | { message?: string; jwt?: string }
            | undefined;
          expect(dlResJson?.message ?? dlResJson?.jwt).toBeTruthy();

          // 2. App-level picker behaviour when content.ungraded is false -> 403 PLACEMENT_NOT_GRADED with zero DL calls
          if (!fixture.capabilities['content.ungraded']) {
            const launched3 = await launchOnChannel(binding, {
              messageType: 'LtiDeepLinkingRequest',
              roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
              acceptLineitem: false,
            });
            const cursor = (await records()).cursor;
            const handoff = await appRequest('GET', launched3.location, {
              headers: { accept: 'text/html' },
            });
            const pickerPage =
              handoff.status === 303 && handoff.headers?.location
                ? await appRequest('GET', String(handoff.headers.location), {
                    headers: { accept: 'text/html' },
                  })
                : handoff;
            expect(pickerPage.status).toBe(403);
            expect(pickerPage.text).toContain('data-error-code="PLACEMENT_NOT_GRADED"');
            await noServiceCalls(cursor);
          }
        });
      });

      if (
        fixture.capabilities['content.ungraded'] &&
        !fixture.notBuilt?.['content.ungraded']
      ) {
        it(`${fixture.id}:K1-DL:D5-UNGRADED — Ungraded picker flow when content.ungraded is true`, async () => {
          await runKitCase(fixture.id, 'K1-DL', 'D5-UNGRADED', async () => {
            const picker = await openPickerOnChannel(binding, {
              acceptLineitem: false,
            });
            expect(picker.status).toBe(200);
            const picked = await pick(picker.pickerUrl, pub1.id);
            const decoded = decodeJwt(picked.jwt);
            const items = decoded.payload[`${DL}content_items`] as Array<
              Record<string, unknown>
            >;
            expect(items.length).toBe(1);
            expect(items[0].lineItem).toBeUndefined();
          });
        });
      }

      it(`${fixture.id}:K1-DL:D6 — /api/idtoken shows acceptLineItem and acceptMediaTypes when present and omits them when absent`, async () => {
        await runKitCase(fixture.id, 'K1-DL', 'D6', async () => {
          // 1. Present in Deep Linking settings (lti-service-api.md §3.1; lti-service-api-delta.md §4.1)
          const withFields = await launchOnChannel(binding, {
            messageType: 'LtiDeepLinkingRequest',
            roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
            acceptLineitem: true,
            acceptMediaTypes: 'text/html,application/json',
          });
          expect(withFields.response.status).toBe(303);
          const tok1 = await idToken(withFields.ltik!);
          expectStatus(tok1, 200);
          const dl1 =
            tok1.json.launch?.deepLinkingSettings ?? tok1.json.deepLinking;
          expect(dl1?.acceptLineItem).toBe(true);
          expect(dl1?.acceptMediaTypes).toBe('text/html,application/json');

          // 2. Omitted from Deep Linking settings
          const withoutFields = await launchOnChannel(binding, {
            messageType: 'LtiDeepLinkingRequest',
            roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
            deepLinkingSettings: {
              accept_lineitem: null,
              accept_media_types: null,
            },
          });
          expect(withoutFields.response.status).toBe(303);
          const tok2 = await idToken(withoutFields.ltik!);
          expectStatus(tok2, 200);
          const dl2 =
            tok2.json.launch?.deepLinkingSettings ?? tok2.json.deepLinking;
          expect(dl2?.acceptLineItem).toBeUndefined();
          expect(dl2?.acceptMediaTypes).toBeUndefined();
        });
      });

      it(`${fixture.id}:K1-DL:D7 — Learner Deep Linking launch is refused with zero DL return calls`, async () => {
        await runKitCase(fixture.id, 'K1-DL', 'D7', async () => {
          const launched = await launchOnChannel(binding, {
            messageType: 'LtiDeepLinkingRequest',
            roles: [ROLE_LEARNER],
          });
          expect(launched.response.status).toBe(303);
          const cursor = (await records()).cursor;
          const handoff = await appRequest('GET', launched.location, {
            headers: { accept: 'text/html' },
          });
          const page =
            handoff.status === 303 && handoff.headers?.location
              ? await appRequest('GET', String(handoff.headers.location), {
                  headers: { accept: 'text/html' },
                })
              : handoff;
          expect(page.status).toBe(403);
          await noServiceCalls(cursor);
        });
      });

      it(`${fixture.id}:K1-DL:D8 — Two Deep Linking responses have distinct nonce claims`, async () => {
        await runKitCase(fixture.id, 'K1-DL', 'D8', async () => {
          const p1 = await openPickerOnChannel(binding);
          const picked1 = await pick(p1.pickerUrl, pub1.id);
          await returnDeepLink(picked1);

          const p2 = await openPickerOnChannel(binding);
          const picked2 = await pick(p2.pickerUrl, pub1.id);
          await returnDeepLink(picked2);

          const jwt1 = decodeJwt(picked1.jwt);
          const jwt2 = decodeJwt(picked2.jwt);
          expect(typeof jwt1.payload.nonce).toBe('string');
          expect(typeof jwt2.payload.nonce).toBe('string');
          expect(jwt1.payload.nonce).not.toBe(jwt2.payload.nonce);
        });
      });
    });
  }
});
