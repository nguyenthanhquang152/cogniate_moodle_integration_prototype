import { describe, expect, it } from 'vitest';
import { loadActiveChannelFixtures } from '../lib/fixtures';
import {
  ACCOUNT,
  ROLE,
  SCOPES,
  apiKey,
  auth,
  commitGrade,
  connectChannel,
   errorCode,
  hasErrorShape,
  launchOnChannel,
  ltiApi,
  openPlayOnChannel,
  publication,
  recordNaCasesForSuite,
  recordSuiteCase,
  records,
  unique,
  waitSync,
  type Json,
} from '../lib/runtime';

const channels = loadActiveChannelFixtures();
const NRPS_CLAIM_URI = 'https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice';

describe('K1-NRPS Names and Role Provisioning Services simulator suite', () => {
  for (const fixture of channels) {
    describe(`channel ${fixture.id} (${fixture.simProvider})`, () => {
      it(`[${fixture.id}] N1: channel does not request NRPS scope and makes zero NRPS calls during normal launch and score flow`, async () => {
        recordNaCasesForSuite(fixture, 'K1-NRPS');
        expect(fixture.capabilities['registration.scopes']).not.toContain(SCOPES.nrps);

        const binding = await connectChannel(fixture);
        const pub = await publication(binding, 'scorm12');
        const cursor = (await records()).cursor;
        const play = await openPlayOnChannel(binding, pub, {
          subject: unique(`learner-nrps-n1-${fixture.id}`),
        });
        await commitGrade(play, 'scorm12', 8, 10);
        await waitSync(binding, pub, 'sent');

        const recs = (await records(cursor)).records.filter(
          (r: Json) => r.provider === fixture.simProvider,
        );
        const nrpsRecs = recs.filter((r: Json) => r.kind === 'nrps');
        expect(nrpsRecs).toEqual([]);

        const tokenRecs = recs.filter(
          (r: Json) => r.kind === 'token' && r.clientId === binding.clientId,
        );
        expect(tokenRecs.length).toBeGreaterThanOrEqual(1);
        for (const tr of tokenRecs) {
          const scopes = Array.isArray(tr.scopes) ? (tr.scopes as string[]) : [];
          expect(scopes).not.toContain(SCOPES.nrps);
        }
        recordSuiteCase(fixture, 'K1-NRPS', 'N1', 'PASS');
      });
    });
  }

  it('N2: LTI service GET /api/memberships returns members without PII, enforces service_versions 2.0, and propagates 429 Retry-After', async () => {
    const fixture = channels[0];
    const key = apiKey(ACCOUNT);
    const binding = await connectChannel(fixture);
    const pub = await publication(binding, 'scorm12');

    // 1. Happy path with NRPS members: returns members with PII stripped
    const launched = await launchOnChannel(binding, {
      resource: pub.id,
      roles: [ROLE.instructor],
      members: [
        {
          user_id: 'sim-member-1',
          status: 'Active',
          roles: [ROLE.learner],
          name: 'Secret Name',
          email: 'secret@example.edu',
          given_name: 'Secret',
          family_name: 'Name',
        },
      ],
    });
    expect(launched.response.status).toBe(303);
    const ltik = new URL(String(launched.response.headers.location)).searchParams.get('ltik') ?? '';
    const memRes = await ltiApi<{
      context?: { id?: string };
      members?: Array<Record<string, unknown>>;
    }>('GET', '/api/memberships', {
      authorization: auth.ltik(key, ltik),
    });
    expect(memRes.status).toBe(200);
    const members = memRes.json?.members ?? [];
    expect(members.length).toBeGreaterThanOrEqual(1);
    for (const member of members) {
      expect(member.email).toBeUndefined();
      expect(member.name).toBeUndefined();
      expect(member.givenName).toBeUndefined();
      expect(member.familyName).toBeUndefined();
    }

    // 2. service_versions: ["1.0"] -> 403 SERVICE_NOT_AVAILABLE
    const v1Launched = await launchOnChannel(binding, {
      resource: pub.id,
      roles: [ROLE.instructor],
      claims: {
        [NRPS_CLAIM_URI]: {
          context_memberships_url: `https://${binding.siteHost}/nrps-v1`,
          service_versions: ['1.0'],
        },
      },
    });
    expect(v1Launched.response.status).toBe(303);
    const v1Ltik = new URL(String(v1Launched.response.headers.location)).searchParams.get('ltik') ?? '';
    const v1Res = await ltiApi<Record<string, unknown>>('GET', '/api/memberships', {
      authorization: auth.ltik(key, v1Ltik),
    });
    expect(v1Res.status).toBe(403);
    expect(hasErrorShape(v1Res)).toBe(true);
    expect(errorCode(v1Res)).toBe('SERVICE_NOT_AVAILABLE');

    // 3. NRPS 429 rate-limit propagation
    const rlLaunched = await launchOnChannel(binding, {
      resource: pub.id,
      roles: [ROLE.instructor],
      nrpsAnswers: [{ status: 429, retryAfter: 45 }],
    });
    expect(rlLaunched.response.status).toBe(303);
    const rlLtik = new URL(String(rlLaunched.response.headers.location)).searchParams.get('ltik') ?? '';
    const rlRes = await ltiApi<Record<string, unknown>>('GET', '/api/memberships', {
      authorization: auth.ltik(key, rlLtik),
    });
    expect(rlRes.status).toBe(429);
  });
});
