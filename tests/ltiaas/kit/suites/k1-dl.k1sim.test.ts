import { beforeAll, describe, expect, it } from 'vitest';
import { loadSelectedChannelFixtures } from '../lib/fixtures.js';
import {
  APP_URL,
  ensureKitRunInitialized,
  getSimCursor,
  getSimRecords,
  httpRequest,
  isK1SimEnabled,
  ltiApi,
  performSimulatorLaunch,
  recordRedactedEvidence,
  RegisteredChannelContext,
  runKitCase,
  setupActiveChannelConnection,
} from '../lib/runtime.js';

const runSuite = isK1SimEnabled() ? describe : describe.skip;
const fixtures = loadSelectedChannelFixtures();

function extractPickerId(location: string): string {
  const m = location.match(/\/tool\/picker\/([^/?#]+)/);
  return m ? m[1] : '';
}

function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const parts = jwt.split('.');
  if (parts.length !== 3) {
    throw new Error(`Invalid JWT format: expected 3 parts, got ${parts.length}`);
  }
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, unknown>;
}

async function submitPickerSelectionAndPostToSim(
  pickerId: string,
  ltik: string,
  courseIds: string | string[],
): Promise<{
  selectStatus: number;
  selectRawBody: string;
  jwt: string;
  actionUrl: string;
  simReturnStatus: number;
}> {
  const body = Array.isArray(courseIds) ? { courseIds } : { courseId: courseIds };
  const selectRes = await httpRequest(`${APP_URL}/tool/picker/${pickerId}/select?ltik=${ltik}`, {
    method: 'POST',
    headers: { origin: APP_URL },
    body,
  });
  const jwtMatch = selectRes.rawBody.match(/name="JWT"\s+value="([^"]+)"/);
  const actionMatch = selectRes.rawBody.match(/<form[^>]+action="([^"]+)"/);
  const jwt = jwtMatch ? jwtMatch[1] : '';
  const actionUrl = actionMatch ? actionMatch[1] : '';
  let simReturnStatus = 0;
  if (jwt && actionUrl) {
    const simRes = await httpRequest(actionUrl, {
      method: 'POST',
      form: { JWT: jwt },
    });
    simReturnStatus = simRes.status;
  }
  return {
    selectStatus: selectRes.status,
    selectRawBody: selectRes.rawBody,
    jwt,
    actionUrl,
    simReturnStatus,
  };
}

runSuite('K1-DL: LTI Deep Linking 2.0 Suite (all selected channels)', () => {
  beforeAll(() => {
    ensureKitRunInitialized({ channels: fixtures.map((f) => f.id) });
  });

  for (const fixture of fixtures) {
    describe(`channel: ${fixture.id}`, () => {
      let ctx: RegisteredChannelContext;

      beforeAll(async () => {
        ctx = await setupActiveChannelConnection(fixture, 'dl');
      });

      it(`[${fixture.id}:K1-DL:D1] Deep Linking response JWT (iss, aud, nonce, deployment_id, message_type, version, sub rule, data mode, exact return URL, window hint)`, async () => {
        await runKitCase(fixture.id, 'K1-DL', 'D1', async () => {
          const cursor = await getSimCursor();
          const dlLaunch = await performSimulatorLaunch(ctx, {
            messageType: 'LtiDeepLinkingRequest',
            roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
          });
          expect([302, 303]).toContain(dlLaunch.launchRes.status);
          const pickerId = extractPickerId(dlLaunch.redirectLocation);
          expect(pickerId).toBeTruthy();

          const sub = await submitPickerSelectionAndPostToSim(
            pickerId,
            dlLaunch.ltik,
            ctx.courseId,
          );
          expect(sub.selectStatus).toBe(200);
          expect(sub.jwt.split('.').length).toBe(3);
          expect(sub.simReturnStatus).toBe(200);

          const payload = decodeJwtPayload(sub.jwt);
          expect(payload.iss).toBe(ctx.clientId);
          const aud = Array.isArray(payload.aud) ? payload.aud[0] : payload.aud;
          expect(aud).toBe(fixture.sim.issuer);
          expect(typeof payload.nonce).toBe('string');
          expect(
            payload['https://purl.imsglobal.org/spec/lti/claim/deployment_id'],
          ).toBe(ctx.deploymentId);
          expect(
            payload['https://purl.imsglobal.org/spec/lti/claim/message_type'],
          ).toBe('LtiDeepLinkingResponse');
          expect(payload['https://purl.imsglobal.org/spec/lti/claim/version']).toBe('1.3.0');

          if (fixture.sim.dlRequiresSub) {
            expect(payload.sub).toBe(ctx.clientId);
          }
          if (fixture.sim.dlDataMode === 'claim') {
            expect(
              typeof payload['https://purl.imsglobal.org/spec/lti-dl/claim/data'],
            ).toBe('string');
          } else {
            expect(sub.actionUrl).toContain('data=');
          }

          const items = payload[
            'https://purl.imsglobal.org/spec/lti-dl/claim/content_items'
          ] as Array<Record<string, unknown>>;
          expect(Array.isArray(items)).toBe(true);
          expect(items.length).toBe(1);
          if (fixture.capabilities['launch.windowHint']) {
            expect(items[0].window).toEqual({ targetName: '_blank' });
          } else {
            expect(items[0].window).toBeUndefined();
          }

          const { records } = await getSimRecords(cursor);
          const dlRec = records.find((r) => r.kind === 'dl');
          expect(dlRec).toBeDefined();

          recordRedactedEvidence(`dl-d1-${fixture.id}`, {
            channelId: fixture.id,
            itemCount: items.length,
            hasWindowHint: Boolean(items[0].window),
            redacted: true,
          });
        });
      });

      it(`[${fixture.id}:K1-DL:D2] one graded item has scoreMaximum: 100`, async () => {
        await runKitCase(fixture.id, 'K1-DL', 'D2', async () => {
          const dlLaunch = await performSimulatorLaunch(ctx, {
            messageType: 'LtiDeepLinkingRequest',
            roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
          });
          const pickerId = extractPickerId(dlLaunch.redirectLocation);
          const sub = await submitPickerSelectionAndPostToSim(
            pickerId,
            dlLaunch.ltik,
            ctx.courseId,
          );
          expect(sub.selectStatus).toBe(200);
          const payload = decodeJwtPayload(sub.jwt);
          const items = payload[
            'https://purl.imsglobal.org/spec/lti-dl/claim/content_items'
          ] as Array<{ lineItem?: { scoreMaximum?: number } }>;
          expect(items.length).toBe(1);
          expect(items[0].lineItem?.scoreMaximum).toBe(100);
        });
      });

      it(`[${fixture.id}:K1-DL:D3] accept_multiple: true vs false and content.multiple capability enforcement`, async () => {
        await runKitCase(fixture.id, 'K1-DL', 'D3', async () => {
          const dlMulti = await performSimulatorLaunch(ctx, {
            messageType: 'LtiDeepLinkingRequest',
            roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
            acceptMultiple: true,
          });
          const pickerIdMulti = extractPickerId(dlMulti.redirectLocation);
          const pickerHtml = dlMulti.playOrPickerRes?.rawBody ?? '';

          if (fixture.capabilities['content.multiple']) {
            expect(pickerHtml).toContain('type="checkbox"');
            const subMulti = await submitPickerSelectionAndPostToSim(
              pickerIdMulti,
              dlMulti.ltik,
              [ctx.courseId, ctx.secondCourseId],
            );
            expect(subMulti.selectStatus).toBe(200);
            expect(subMulti.simReturnStatus).toBe(200);
            const payload = decodeJwtPayload(subMulti.jwt);
            const items = payload[
              'https://purl.imsglobal.org/spec/lti-dl/claim/content_items'
            ] as Array<{ url?: string }>;
            expect(items.length).toBe(2);
            expect(items[0].url).toContain(ctx.resourceSlug);
            expect(items[1].url).toContain(ctx.secondResourceSlug);
          } else {
            expect(pickerHtml).toContain('type="radio"');
            const cursor = await getSimCursor();
            const subRefused = await submitPickerSelectionAndPostToSim(
              pickerIdMulti,
              dlMulti.ltik,
              [ctx.courseId, ctx.secondCourseId],
            );
            expect(subRefused.selectStatus).toBe(400);
            expect(subRefused.selectRawBody).toContain('PUBLICATION_NOT_AVAILABLE');
            const { records } = await getSimRecords(cursor);
            expect(records.filter((r) => r.kind === 'dl').length).toBe(0);
          }

          // accept_multiple: false refuses >1 items at picker and >1 / >20 items at /api/deeplinking
          const dlSingle = await performSimulatorLaunch(ctx, {
            messageType: 'LtiDeepLinkingRequest',
            roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
            acceptMultiple: false,
          });
          const pickerIdSingle = extractPickerId(dlSingle.redirectLocation);
          const twoOnSingle = await submitPickerSelectionAndPostToSim(
            pickerIdSingle,
            dlSingle.ltik,
            [ctx.courseId, ctx.secondCourseId],
          );
          expect(twoOnSingle.selectStatus).toBe(400);
          expect(twoOnSingle.selectRawBody).toContain('PUBLICATION_NOT_AVAILABLE');

          const twentyOneItems = Array.from({ length: 21 }, (_, idx) => ({
            type: 'ltiResourceLink',
            title: `Item ${idx + 1}`,
            url: `${APP_URL}/lti/launch?resource=${ctx.resourceSlug}`,
          }));
          const rawDl21 = await ltiApi('/api/deeplinking', {
            method: 'POST',
            headers: { authorization: `Bearer ${dlSingle.ltik}` },
            body: { contentItems: twentyOneItems },
          });
          expect(rawDl21.status).toBe(400);
          expect(rawDl21.rawBody).toContain('INVALID_CONTENT_ITEM');
        });
      });

      it(`[${fixture.id}:K1-DL:D4] Cancel posts content_items: [] to return URL and refuses foreign Origin`, async () => {
        await runKitCase(fixture.id, 'K1-DL', 'D4', async () => {
          const dlLaunch = await performSimulatorLaunch(ctx, {
            messageType: 'LtiDeepLinkingRequest',
            roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
            dlAllowCancel: true,
          });
          const pickerId = extractPickerId(dlLaunch.redirectLocation);

          const badOriginRes = await httpRequest(
            `${APP_URL}/tool/picker/${pickerId}/cancel?ltik=${dlLaunch.ltik}`,
            {
              method: 'POST',
              headers: { origin: 'https://evil.example' },
            },
          );
          expect(badOriginRes.status).toBe(403);
          expect(badOriginRes.rawBody).toContain('ORIGIN_NOT_ALLOWED');

          const cursor = await getSimCursor();
          const cancelRes = await httpRequest(
            `${APP_URL}/tool/picker/${pickerId}/cancel?ltik=${dlLaunch.ltik}`,
            {
              method: 'POST',
              headers: { origin: APP_URL },
            },
          );
          expect(cancelRes.status).toBe(200);
          expect(cancelRes.rawBody).toContain('No course was added.');

          const jwtMatch = cancelRes.rawBody.match(/name="JWT"\s+value="([^"]+)"/);
          const actionMatch = cancelRes.rawBody.match(/<form[^>]+action="([^"]+)"/);
          expect(jwtMatch).toBeTruthy();
          expect(actionMatch).toBeTruthy();

          const payload = decodeJwtPayload(jwtMatch![1]);
          expect(
            payload['https://purl.imsglobal.org/spec/lti-dl/claim/content_items'],
          ).toEqual([]);

          const simRes = await httpRequest(actionMatch![1], {
            method: 'POST',
            form: { JWT: jwtMatch![1] },
          });
          expect(simRes.status).toBe(200);
          const { records } = await getSimRecords(cursor);
          const dlRec = records.find((r) => r.kind === 'dl');
          expect(dlRec).toBeDefined();
          expect(dlRec?.cancelled).toBe(true);
          expect(dlRec?.itemCount).toBe(0);
        });
      });

      it(`[${fixture.id}:K1-DL:D5] accept_lineitem: false refuses lineItem at service and returns 403 PLACEMENT_NOT_GRADED at picker when content.ungraded is false`, async () => {
        await runKitCase(fixture.id, 'K1-DL', 'D5', async () => {
          const cursor = await getSimCursor();
          const dlNoLineItem = await performSimulatorLaunch(ctx, {
            messageType: 'LtiDeepLinkingRequest',
            roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
            acceptLineitem: false,
          });
          expect([302, 303]).toContain(dlNoLineItem.launchRes.status);

          if (!fixture.capabilities['content.ungraded']) {
            expect(dlNoLineItem.playOrPickerRes?.status).toBe(403);
            expect(dlNoLineItem.playOrPickerRes?.rawBody).toContain(
              'data-error-code="PLACEMENT_NOT_GRADED"',
            );
            expect(dlNoLineItem.playOrPickerRes?.rawBody).toContain(
              'This placement does not take grades. Pick an assignment or graded placement in your LMS.',
            );
            const { records } = await getSimRecords(cursor);
            expect(records.filter((r) => r.kind === 'dl').length).toBe(0);
          }

          // Service-level check: /api/deeplinking refuses item with lineItem (400 INVALID_CONTENT_ITEM) and accepts item without lineItem
          const withLineItemRes = await ltiApi('/api/deeplinking', {
            method: 'POST',
            headers: { authorization: `Bearer ${dlNoLineItem.ltik}` },
            body: {
              contentItems: [
                {
                  type: 'ltiResourceLink',
                  title: 'Graded on ungraded placement',
                  url: `${APP_URL}/lti/launch?resource=${ctx.resourceSlug}`,
                  lineItem: { scoreMaximum: 100, label: 'Graded' },
                },
              ],
            },
          });
          expect(withLineItemRes.status).toBe(400);
          expect(withLineItemRes.rawBody).toContain('INVALID_CONTENT_ITEM');

          const withoutLineItemRes = await ltiApi('/api/deeplinking', {
            method: 'POST',
            headers: { authorization: `Bearer ${dlNoLineItem.ltik}` },
            body: {
              contentItems: [
                {
                  type: 'ltiResourceLink',
                  title: 'Ungraded item',
                  url: `${APP_URL}/lti/launch?resource=${ctx.resourceSlug}`,
                },
              ],
            },
          });
          expect(withoutLineItemRes.status).toBe(200);
        });
      });

      if (fixture.capabilities['content.ungraded'] && !fixture.notBuilt?.['content.ungraded']) {
        it(`[${fixture.id}:K1-DL:D5-UNGRADED] ungraded picker flow when content.ungraded is true`, async () => {
          await runKitCase(fixture.id, 'K1-DL', 'D5-UNGRADED', async () => {
            const dlUngraded = await performSimulatorLaunch(ctx, {
              messageType: 'LtiDeepLinkingRequest',
              roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
              acceptLineitem: false,
            });
            expect(dlUngraded.playOrPickerRes?.status).toBe(200);
            const pickerId = extractPickerId(dlUngraded.redirectLocation);
            const sub = await submitPickerSelectionAndPostToSim(
              pickerId,
              dlUngraded.ltik,
              ctx.courseId,
            );
            expect(sub.selectStatus).toBe(200);
            const payload = decodeJwtPayload(sub.jwt);
            const items = payload[
              'https://purl.imsglobal.org/spec/lti-dl/claim/content_items'
            ] as Array<{ lineItem?: unknown }>;
            expect(items[0].lineItem).toBeUndefined();
          });
        });
      }

      it(`[${fixture.id}:K1-DL:D6] /api/idtoken shows acceptLineItem and acceptMediaTypes when present and omits them when absent`, async () => {
        await runKitCase(fixture.id, 'K1-DL', 'D6', async () => {
          const withBoth = await performSimulatorLaunch(ctx, {
            messageType: 'LtiDeepLinkingRequest',
            roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
            acceptLineitem: false,
            acceptMediaTypes: 'application/vnd.ims.lti.v1.ltiresourcelink,text/html',
          });
          const idTokenWith = await ltiApi('/api/idtoken', {
            method: 'GET',
            headers: { authorization: `Bearer ${withBoth.ltik}` },
          });
          expect(idTokenWith.status).toBe(200);
          const dlSettingsWith = (
            idTokenWith.json as {
              deepLinking?: { acceptLineItem?: boolean; acceptMediaTypes?: string };
            }
          ).deepLinking;
          expect(dlSettingsWith?.acceptLineItem).toBe(false);
          expect(dlSettingsWith?.acceptMediaTypes).toBe(
            'application/vnd.ims.lti.v1.ltiresourcelink,text/html',
          );

          const withoutBoth = await performSimulatorLaunch(ctx, {
            messageType: 'LtiDeepLinkingRequest',
            roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
          });
          const idTokenWithout = await ltiApi('/api/idtoken', {
            method: 'GET',
            headers: { authorization: `Bearer ${withoutBoth.ltik}` },
          });
          expect(idTokenWithout.status).toBe(200);
          const dlSettingsWithout = (
            idTokenWithout.json as {
              deepLinking?: { acceptLineItem?: boolean; acceptMediaTypes?: string };
            }
          ).deepLinking;
          expect(dlSettingsWithout?.acceptLineItem).toBeUndefined();
          expect(dlSettingsWithout?.acceptMediaTypes).toBeUndefined();
        });
      });

      it(`[${fixture.id}:K1-DL:D7] learner Deep Linking launch is refused with zero DL return calls`, async () => {
        await runKitCase(fixture.id, 'K1-DL', 'D7', async () => {
          const cursor = await getSimCursor();
          const learnerDl = await performSimulatorLaunch(ctx, {
            messageType: 'LtiDeepLinkingRequest',
            roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
          });
          const finalStatus =
            learnerDl.playOrPickerRes?.status ?? learnerDl.launchRes.status;
          expect(finalStatus).toBeGreaterThanOrEqual(400);
          const { records } = await getSimRecords(cursor);
          expect(records.filter((r) => r.kind === 'dl').length).toBe(0);
        });
      });

      it(`[${fixture.id}:K1-DL:D8] two Deep Linking responses have distinct nonce claims`, async () => {
        await runKitCase(fixture.id, 'K1-DL', 'D8', async () => {
          const dl1 = await performSimulatorLaunch(ctx, {
            messageType: 'LtiDeepLinkingRequest',
            roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
          });
          const sub1 = await submitPickerSelectionAndPostToSim(
            extractPickerId(dl1.redirectLocation),
            dl1.ltik,
            ctx.courseId,
          );
          const dl2 = await performSimulatorLaunch(ctx, {
            messageType: 'LtiDeepLinkingRequest',
            roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
          });
          const sub2 = await submitPickerSelectionAndPostToSim(
            extractPickerId(dl2.redirectLocation),
            dl2.ltik,
            ctx.courseId,
          );
          const p1 = decodeJwtPayload(sub1.jwt);
          const p2 = decodeJwtPayload(sub2.jwt);
          expect(typeof p1.nonce).toBe('string');
          expect(typeof p2.nonce).toBe('string');
          expect(p1.nonce).not.toBe(p2.nonce);
        });
      });
    });
  }
});
