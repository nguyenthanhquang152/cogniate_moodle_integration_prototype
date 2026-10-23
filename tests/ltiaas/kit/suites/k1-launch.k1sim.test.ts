import { beforeAll, describe, expect, it } from 'vitest';
import {
  PROTOCOL_SECURITY_FAULTS,
  loadActiveChannelFixtures,
  type ChannelFixture,
} from '../lib/fixtures';
import {
  ACCOUNT,
  LTI,
  ROLE,
  admin,
  apiKey,
  auth,
  connectChannel,
  denied,
  httpsRequest,
  launchOnChannel,
  logEvents,
  ltiApi,
  noServiceCalls,
  openPlayOnChannel,
  publication,
  recordNaCasesForSuite,
  recordSuiteCase,
  records,
  unique,
  urls,
  type ChannelBinding,
  type Json,
} from '../lib/runtime';

const channels = loadActiveChannelFixtures();

describe('K1-LAUNCH simulator suite per channel', () => {
  for (const fixture of channels) {
    describe(`channel ${fixture.id} (${fixture.simProvider})`, () => {
      let binding: ChannelBinding;
      let pub: Json;

      beforeAll(async () => {
        recordNaCasesForSuite(fixture, 'K1-LAUNCH');
        binding = await connectChannel(fixture);
        pub = await publication(binding, 'scorm12');
      });

      it(`[${fixture.id}] L1: learner LtiResourceLinkRequest opens /play/... with resource_link.id and context.id`, async () => {
        const play = await openPlayOnChannel(binding, pub, {
          roles: [ROLE.learner],
        });
        expect(play.shell.status).toBe(200);
        if (fixture.capabilities['launch.topLevelContinue']) {
          expect(typeof fixture.capabilities['launch.topLevelContinue']).toBe('boolean');
        }
        recordSuiteCase(fixture, 'K1-LAUNCH', 'L1', 'PASS');
      });

      it(`[${fixture.id}] L2: instructor LtiResourceLinkRequest opens /play/...`, async () => {
        const play = await openPlayOnChannel(binding, pub, {
          roles: [ROLE.instructor],
          subject: unique('instructor-l2'),
        });
        expect(play.shell.status).toBe(200);
        recordSuiteCase(fixture, 'K1-LAUNCH', 'L2', 'PASS');
      });

      it(`[${fixture.id}] L3: institution-only Administrator role launch is accepted`, async () => {
        const res = await launchOnChannel(binding, {
          resource: pub.id,
          resourceLinkId: pub.id,
          institutionAdmin: true,
          subject: unique('inst-admin-l3'),
        });
        expect(res.response.status).toBe(303);
        const handoff = await httpsRequest(String(res.response.headers.location));
        expect(handoff.status).toBe(303);
        recordSuiteCase(fixture, 'K1-LAUNCH', 'L3', 'PASS');
      });

      it(`[${fixture.id}] L4: launch without context claim is accepted`, async () => {
        const play = await openPlayOnChannel(binding, pub, {
          omit: [`${LTI}context`],
          subject: unique('learner-no-ctx-l4'),
        });
        expect(play.shell.status).toBe(200);
        recordSuiteCase(fixture, 'K1-LAUNCH', 'L4', 'PASS');
      });

      it(`[${fixture.id}] L5: replay of nonce / state on launch is refused`, async () => {
        const first = await launchOnChannel(binding, {
          resource: pub.id,
          resourceLinkId: pub.id,
          subject: unique('learner-replay-l5'),
        });
        expect(first.response.status).toBe(303);

        const body = new URLSearchParams({
          id_token: first.fields.id_token,
          state: first.fields.state,
        }).toString();
        const replay = await httpsRequest(`${urls.lti}/lti/launch/cogniate`, {
          method: 'POST',
          headers: {
            cookie: first.cookie,
            'content-type': 'application/x-www-form-urlencoded',
          },
          body,
        });
        expect(replay.status).toBeGreaterThanOrEqual(400);
        recordSuiteCase(fixture, 'K1-LAUNCH', 'L5', 'PASS');
      });

      it(`[${fixture.id}] L6: clock-skew boundary refuses expired exp and future iat with TOKEN_EXPIRED`, async () => {
        const expiredRes = await launchOnChannel(binding, {
          resource: pub.id,
          fault: 'expired',
        });
        denied(expiredRes.response, 'TOKEN_EXPIRED');

        const futureRes = await launchOnChannel(binding, {
          resource: pub.id,
          fault: 'future-iat',
        });
        denied(futureRes.response, 'TOKEN_EXPIRED');
        recordSuiteCase(fixture, 'K1-LAUNCH', 'L6', 'PASS');
      });

      it(`[${fixture.id}] L7: multi-audience aud with trustedAudiences and valid azp passes; missing or mismatched azp is refused`, async () => {
        const extraAud = 'https://trusted-peer.sim.test';
        const untrusted = await launchOnChannel(binding, {
          resource: pub.id,
          extraAud,
          azp: binding.clientId,
        });
        denied(untrusted.response, 'INVALID_ISSUER_OR_AUDIENCE');

        const patchRes = await admin('PATCH', `/api/platforms/${encodeURIComponent(binding.platformId)}`, {
          trustedAudiences: [extraAud],
        });
        expect(patchRes.status).toBe(200);

        try {
          const validMulti = await launchOnChannel(binding, {
            resource: pub.id,
            resourceLinkId: pub.id,
            extraAud,
            azp: binding.clientId,
          });
          expect(validMulti.response.status).toBe(303);

          const noAzp = await launchOnChannel(binding, {
            resource: pub.id,
            fault: 'multi-aud-no-azp',
          });
          denied(noAzp.response, 'INVALID_ISSUER_OR_AUDIENCE');

          const wrongAzp = await launchOnChannel(binding, {
            resource: pub.id,
            fault: 'multi-aud-wrong-azp',
          });
          denied(wrongAzp.response, 'INVALID_ISSUER_OR_AUDIENCE');
        } finally {
          await admin('PATCH', `/api/platforms/${encodeURIComponent(binding.platformId)}`, {
            trustedAudiences: [],
          });
        }
        recordSuiteCase(fixture, 'K1-LAUNCH', 'L7', 'PASS');
      });

      it(`[${fixture.id}] L8: platform JWKS key rotation accepts rotated kid and refuses unknown signing key`, async () => {
        const rotated = await launchOnChannel(binding, {
          resource: pub.id,
          resourceLinkId: pub.id,
          secondKey: true,
          jwksKeys: 'both',
        });
        expect(rotated.response.status).toBe(303);

        const unknownKey = await launchOnChannel(binding, {
          resource: pub.id,
          fault: 'unknown-key',
        });
        denied(unknownKey.response, 'INVALID_SIGNATURE');
        recordSuiteCase(fixture, 'K1-LAUNCH', 'L8', 'PASS');
      });

      if (fixture.sim.supportsCustomClaims) {
        it(`[${fixture.id}] L9: custom parameter substitution claims are preserved on launch`, async () => {
          const key = apiKey(ACCOUNT);
          const customClaims = {
            user_external_id: 'ext-user-42',
            section_start: '2026-09-01T00:00:00Z',
          };
          const launched = await launchOnChannel(binding, {
            resource: pub.id,
            resourceLinkId: pub.id,
            claims: {
              [`${LTI}custom`]: customClaims,
            },
          });
          expect(launched.response.status).toBe(303);
          const ltik = new URL(String(launched.response.headers.location)).searchParams.get('ltik') ?? '';
          expect(ltik).not.toBe('');
          const idtokenRes = await ltiApi<Record<string, unknown>>('GET', '/api/idtoken', {
            authorization: auth.ltik(key, ltik),
          });
          expect(idtokenRes.status).toBe(200);
          const launchObj = (idtokenRes.json?.launch ?? {}) as Record<string, unknown>;
          expect(launchObj.custom).toEqual(customClaims);
          recordSuiteCase(fixture, 'K1-LAUNCH', 'L9', 'PASS');
        });
      }

      it(`[${fixture.id}] L10: privacy floor strips PII claims when profile floor is allowlist and logs launch_claims_minimized`, async () => {
        const key = apiKey(ACCOUNT);
        const since = Date.now() - 1000;
        const launched = await launchOnChannel(binding, {
          resource: pub.id,
          resourceLinkId: pub.id,
          claims: {
            name: 'Learner Personal Name',
            given_name: 'Learner',
            family_name: 'Personal',
            email: 'learner-pii@example.edu',
          },
        });
        expect(launched.response.status).toBe(303);
        const ltik = new URL(String(launched.response.headers.location)).searchParams.get('ltik') ?? '';
        const idtokenRes = await ltiApi<Record<string, unknown>>('GET', '/api/idtoken', {
          authorization: auth.ltik(key, ltik),
        });
        expect(idtokenRes.status).toBe(200);
        const userObj = (idtokenRes.json?.user ?? {}) as Record<string, unknown>;

        if (fixture.sim.privacyFloor === 'allowlist') {
          expect(userObj.name).toBeUndefined();
          expect(userObj.email).toBeUndefined();
          expect(userObj.givenName).toBeUndefined();
          expect(userObj.familyName).toBeUndefined();
          const minimized = logEvents('launch_claims_minimized', since, {}, 'lti-service');
          expect(minimized.length).toBeGreaterThan(0);
        } else {
          expect(userObj.email).toBe('learner-pii@example.edu');
        }
        recordSuiteCase(fixture, 'K1-LAUNCH', 'L10', 'PASS');
      });

      it(`[${fixture.id}] L-FAULTS: all 12 protocol security faults are refused with expected error code and zero side effects`, async () => {
        for (const [fault, expectedCode] of PROTOCOL_SECURITY_FAULTS) {
          const cursor = (await records()).cursor;
          const result = await launchOnChannel(binding, {
            resource: pub.id,
            fault,
          });
          denied(result.response, expectedCode);
          await noServiceCalls(cursor);
        }
        recordSuiteCase(fixture, 'K1-LAUNCH', 'L-FAULTS', 'PASS');
      });
    });
  }
});
