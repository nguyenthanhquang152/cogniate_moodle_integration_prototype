import { beforeAll, describe, expect, it } from 'vitest';
import { loadActiveChannelFixtures } from '../lib/fixtures';
import {
  APP,
   connectChannel,
  expectStatus,
  httpsRequest,
  openPickerOnChannel,
  parseForm,
  pick,
  publication,
  recordNaCasesForSuite,
  recordSuiteCase,
  records,
  returnDeepLink,
  type ChannelBinding,
  type Json,
} from '../lib/runtime';

const channels = loadActiveChannelFixtures();

describe('K1-DL Deep Linking simulator suite per channel', () => {
  for (const fixture of channels) {
    describe(`channel ${fixture.id} (${fixture.simProvider})`, () => {
      let binding: ChannelBinding;
      let pub1: Json;
      let pub2: Json;
      let lastDlRecord: Json | undefined;

      beforeAll(async () => {
        recordNaCasesForSuite(fixture, 'K1-DL');
        binding = await connectChannel(fixture);
        pub1 = await publication(binding, 'scorm12');
        pub2 = await publication(binding, 'scorm12');
      });

      it(`[${fixture.id}] D1: single ltiResourceLink pick echoes data and deployment_id`, async () => {
        const cursor = (await records()).cursor;
        const p = await openPickerOnChannel(binding);
        const picked = await pick(p.url, pub1.id);
        expectStatus(picked, 200);
        await returnDeepLink(picked);

        const dlRecs = (await records(cursor)).records.filter(
          (r: Json) => r.kind === 'deep-link' && r.provider === fixture.simProvider,
        );
        expect(dlRecs.length).toBeGreaterThanOrEqual(1);
        lastDlRecord = dlRecs[dlRecs.length - 1];
        expect(lastDlRecord.deploymentId).toBe(binding.deploymentId);
        expect(lastDlRecord.dataMode).toBe(fixture.sim.dlDataMode);
        expect(Array.isArray(lastDlRecord.items)).toBe(true);
        expect(lastDlRecord.items).toHaveLength(1);
        expect(lastDlRecord.items[0].type).toBe('ltiResourceLink');
        recordSuiteCase(fixture, 'K1-DL', 'D1', 'PASS');
      });

      it(`[${fixture.id}] D2: Deep Linking response JWT sub claim rule matches channel profile`, async () => {
        expect(lastDlRecord).toBeDefined();
        if (fixture.sim.dlRequiresSub) {
          expect(lastDlRecord!.sub).toBe(binding.clientId);
        } else {
          expect(lastDlRecord!.sub).toBeUndefined();
        }
        recordSuiteCase(fixture, 'K1-DL', 'D2', 'PASS');
      });

      it(`[${fixture.id}] D3: Deep Linking item window hint matches launch.windowHint capability`, async () => {
        expect(lastDlRecord).toBeDefined();
        const item = lastDlRecord!.items[0];
        if (fixture.capabilities['launch.windowHint']) {
          expect(item.window).toEqual({ targetName: '_blank' });
        } else {
          expect(item.window).toBeUndefined();
        }
        recordSuiteCase(fixture, 'K1-DL', 'D3', 'PASS');
      });

      it(`[${fixture.id}] D4: Deep Linking item includes lineItem with scoreMaximum 100 by default`, async () => {
        expect(lastDlRecord).toBeDefined();
        const item = lastDlRecord!.items[0];
        expect(item.lineItem).toBeDefined();
        expect(item.lineItem.scoreMaximum).toBe(100);
        recordSuiteCase(fixture, 'K1-DL', 'D4', 'PASS');
      });

      if (fixture.capabilities['content.multiple']) {
        it(`[${fixture.id}] D5: accept_multiple: true multi-item pick returns multiple items with distinct resourceIds`, async () => {
          const cursor = (await records()).cursor;
          const p = await openPickerOnChannel(binding, {
            acceptMultiple: true,
          });
          const { action, fields } = parseForm(p.page.body);
          const params = new URLSearchParams();
          for (const [k, v] of Object.entries(fields)) {
            if (k !== 'publicationId' && k !== 'publicationIds') {
              params.set(k, v);
            }
          }
          params.append('publicationIds', pub1.id);
          params.append('publicationIds', pub2.id);

          const postUrl = new URL(action, p.url).href;
          const picked = await httpsRequest(postUrl, {
            method: 'POST',
            headers: {
              origin: APP,
              'content-type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
          });
          expectStatus(picked, 200);
          await returnDeepLink(picked);

          const dlRecs = (await records(cursor)).records.filter(
            (r: Json) => r.kind === 'deep-link' && r.provider === fixture.simProvider,
          );
          expect(dlRecs.length).toBeGreaterThanOrEqual(1);
          const multiRec = dlRecs[dlRecs.length - 1];
          expect(multiRec.items).toHaveLength(2);
          recordSuiteCase(fixture, 'K1-DL', 'D5', 'PASS');
        });
      }

      it(`[${fixture.id}] D5-GUARD: accept_multiple: false refuses multi-item selection`, async () => {
        const p = await openPickerOnChannel(binding, {
          acceptMultiple: false,
        });
        const { action, fields } = parseForm(p.page.body);
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(fields)) {
          if (k !== 'publicationId' && k !== 'publicationIds') {
            params.set(k, v);
          }
        }
        params.append('publicationIds', pub1.id);
        params.append('publicationIds', pub2.id);

        const postUrl = new URL(action, p.url).href;
        const refused = await httpsRequest(postUrl, {
          method: 'POST',
          headers: {
            origin: APP,
            'content-type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        });
        expect(refused.status).toBe(400);
        expect(refused.body).toContain('PUBLICATION_NOT_AVAILABLE');
        recordSuiteCase(fixture, 'K1-DL', 'D5-GUARD', 'PASS');
      });

      it(`[${fixture.id}] D6: accept_lineitem: false returns item without lineItem`, async () => {
        const cursor = (await records()).cursor;
        const p = await openPickerOnChannel(binding, {
          acceptLineitem: false,
        });
        const picked = await pick(p.url, pub1.id);
        expectStatus(picked, 200);
        await returnDeepLink(picked);

        const dlRecs = (await records(cursor)).records.filter(
          (r: Json) => r.kind === 'deep-link' && r.provider === fixture.simProvider,
        );
        expect(dlRecs.length).toBeGreaterThanOrEqual(1);
        const rec = dlRecs[dlRecs.length - 1];
        expect(rec.items).toHaveLength(1);
        expect(rec.items[0].lineItem).toBeUndefined();
        recordSuiteCase(fixture, 'K1-DL', 'D6', 'PASS');
      });

      if (fixture.capabilities['content.ungraded'] && !fixture.notBuilt['content.ungraded']) {
        it(`[${fixture.id}] D7: ungraded placement choice omits lineItem`, async () => {
          const cursor = (await records()).cursor;
          const p = await openPickerOnChannel(binding, {
            ungradedPlacement: true,
          });
          const picked = await pick(p.url, pub1.id);
          expectStatus(picked, 200);
          await returnDeepLink(picked);
          const dlRecs = (await records(cursor)).records.filter(
            (r: Json) => r.kind === 'deep-link' && r.provider === fixture.simProvider,
          );
          expect(dlRecs.length).toBeGreaterThanOrEqual(1);
          expect(dlRecs[dlRecs.length - 1].items[0].lineItem).toBeUndefined();
          recordSuiteCase(fixture, 'K1-DL', 'D7', 'PASS');
        });
      }

      it(`[${fixture.id}] D8: picker cancel returns signed Deep Linking JWT with empty content_items array`, async () => {
        const cursor = (await records()).cursor;
        const p = await openPickerOnChannel(binding, {
          dlAllowCancel: true,
        });
        const cancelUrl = `${new URL(p.url).origin}${new URL(p.url).pathname}/cancel`;
        const cancelled = await httpsRequest(cancelUrl, {
          method: 'POST',
          headers: {
            origin: APP,
            'content-type': 'application/x-www-form-urlencoded',
          },
          body: '',
        });
        expectStatus(cancelled, 200);
        await returnDeepLink(cancelled);

        const dlRecs = (await records(cursor)).records.filter(
          (r: Json) => r.kind === 'deep-link' && r.provider === fixture.simProvider,
        );
        expect(dlRecs.length).toBeGreaterThanOrEqual(1);
        const rec = dlRecs[dlRecs.length - 1];
        expect(rec.items).toEqual([]);
        expect(rec.cancelled).toBe(true);
        recordSuiteCase(fixture, 'K1-DL', 'D8', 'PASS');
      });
    });
  }
});
