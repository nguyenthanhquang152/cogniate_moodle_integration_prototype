// LA-E5-13 K0 host-only suite: static/contract/fixture verification for two-tenant isolation.
// Runs without Docker (LA_LEVEL=k0). Imports only the public entry point `@cogniate/channel-kernel` permitted by
// `docs/architecture/ltiaas/tasks/README.md` §3. Verifies:
// 1. All 6 frozen isolation ACs (AC-T2-18, AC-T4-16, AC-T4-29, AC-T4-34, AC-T7-08, AC-T7-09) remain intact in their
//    canonical acceptance/e2e suites (AC-LA-E5-13-06 static check).
// 2. Every discovered channel in packages/channels/* obeys the LA-ADR-07 D2 authority invariants (A1-A6:
//    binding.authority values in {'self','operatorGrant'}, shared-platform channels never use 'self', admin-value
//    manual methods use 'operatorGrant').
// 3. The LA-E5-13 K1-SIM suite covers all required ACs (AC-LA-E5-13-01, -02, -03, -05, -06) and documents cut Should/Could
//    routes as N/A per docs/architecture/ltiaas/tasks/LA-E5-13.md Scope.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildChannelRegistry, computeCapabilities, loadChannelFolders } from '@cogniate/channel-kernel';
import {
  assertExpectedConnectionFixtures,
  assertVictimStateUnchanged,
  buildConnectionRouteProbes,
  buildVictimStateSnapshot,
  compareVictimStateBeforeAfter,
  EXPECTED_BUILT_CHANNELS,
  parseLmsProvidersEnvelope,
  type ConnectionFixtureSpec,
} from './oracle';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(
  process.env.LA_TARGET_ROOT ?? process.env.QA_REPO_ROOT ?? process.env.LA_SCRATCH_CLONE ?? path.join(here, '../../../..'),
);

describe('LA-E5-13 K0 (host-only static & contract invariants)', () => {
  it('AC-LA-E5-13-06 (static): all six frozen isolation ACs (AC-T2-18, AC-T4-16, AC-T4-29, AC-T4-34, AC-T7-08, AC-T7-09) are present and unskipped in tests/', () => {
    const frozenChecks: { ac: string; relPath: string; needle: string }[] = [
      {
        ac: 'AC-T2-18',
        relPath: 'tests/acceptance/T2a/launch.spec.ts',
        needle: 'AC-T2-18 qa-second may register the same issuer + client id; a Moodle launch still belongs to cogniate',
      },
      {
        ac: 'AC-T4-16',
        relPath: 'tests/acceptance/T4b2/1-picker.spec.ts',
        needle: 'AC-T4-16 through "Cogniate (QA Library B)" in COGNIATE-DEV-102 the picker shows only library B',
      },
      {
        ac: 'AC-T4-29',
        relPath: 'tests/acceptance/T4b2/5-negative.spec.ts',
        needle: 'AC-T4-29 an unknown playId → 404; library B gets 404 for Thanh',
      },
      {
        ac: 'AC-T4-34',
        relPath: 'tests/acceptance/T4b1/3-security.spec.ts',
        needle: "AC-T4-34 tenant matrix: library B gets 404 for Thanh's connection, publication and course version endpoints",
      },
      {
        ac: 'AC-T7-08',
        relPath: 'tests/e2e/2-scenario-b.spec.ts',
        needle: 'B4 AC-T7-08',
      },
      {
        ac: 'AC-T7-09',
        relPath: 'tests/e2e/2-scenario-b.spec.ts',
        needle: 'B6 AC-T7-09',
      },
    ];

    for (const item of frozenChecks) {
      const fullPath = path.join(repoRoot, item.relPath);
      expect(fs.existsSync(fullPath), `${item.ac} file exists at ${item.relPath}`).toBe(true);
      const text = fs.readFileSync(fullPath, 'utf8');
      expect(text, `${item.ac} test title present in ${item.relPath}`).toContain(item.needle);
      expect(text, `${item.ac} is not skipped`).not.toMatch(new RegExp(`test\\.(?:skip|fixme)\\([^\\n]*${item.ac}`));
    }
  });

  it('LA-ADR-07 D2 authority invariants: every channel loaded via @cogniate/channel-kernel uses only kernel binding.authority strategies and binds admin-value manual methods with operatorGrant', async () => {
    const channelsDir = path.join(repoRoot, 'packages/channels');
    const loaded = await loadChannelFolders([channelsDir], 'app');
    const registry = buildChannelRegistry(loaded, { simulations: true });
    const manifests = registry.channels();
    expect(manifests.length).toBeGreaterThanOrEqual(4);

    for (const manifest of manifests) {
      const caps = computeCapabilities(manifest);
      const authorityMap = caps['binding.authority'];
      const entries = Object.entries(authorityMap);
      expect(entries.length, `${manifest.id} declares at least one registration method`).toBeGreaterThanOrEqual(1);
      for (const [method, auth] of entries) {
        expect(['self', 'operatorGrant'], `${manifest.id} ${method} authority ${auth}`).toContain(auth);
      }
      // Shared-platform channel (blackboard) must never use 'self' (LA-ADR-07 A4).
      if (caps['platform.sharing'] === 'shared') {
        expect(Object.values(authorityMap)).toEqual(['operatorGrant']);
      }
      // Non-Moodle channels with manual registration must use 'operatorGrant' on manual (LA-ADR-07 A3).
      if (manifest.id !== 'moodle' && authorityMap.manual) {
        expect(authorityMap.manual, `${manifest.id} manual authority`).toBe('operatorGrant');
      }
    }
  });

  it('LA-E5-13 K1-SIM suite completeness: two-tenant-isolation.k1sim.test.ts defines tests for AC-LA-E5-13-01, -02, -03, -05, and -06', () => {
    const k1File = path.join(here, 'two-tenant-isolation.k1sim.test.ts');
    expect(fs.existsSync(k1File)).toBe(true);
    const content = fs.readFileSync(k1File, 'utf8');
    for (const ac of [
      'AC-LA-E5-13-01',
      'AC-LA-E5-13-02',
      'AC-LA-E5-13-03',
      'AC-LA-E5-13-05',
      'AC-LA-E5-13-06',
    ]) {
      expect(content, `K1-SIM suite contains ${ac}`).toContain(ac);
    }
    expect(content).toContain('/tool-configuration');
    expect(content).toContain('/registration-url');
    expect(content).toContain('/platform');
    expect(content).toContain('/deployments');
    expect(content).toContain('/tool/picker/');
    expect(content).toContain('/cancel');
    expect(content).toContain('/lti/launch/qa-second/storage-check');
    expect(content).toContain('storage_check_unknown_used_or_expired');
    expect(content).toContain('/api/service-keys/revoke');
    // Ensure K1-SIM never falls back to `provRes.json?.providers` and enforces `.lms` + before/after victim comparison
    expect(content).not.toContain('provRes.json?.providers');
    expect(content).toContain('parseLmsProvidersEnvelope');
    expect(content).toContain('assertExpectedConnectionFixtures');
    expect(content).toContain('assertVictimStateUnchanged');
  });

  it('B-LA-E5-13-01 & A-LA-E5-13-01 regression + negative counterexamples: parseLmsProvidersEnvelope reads contracted .lms array, requires all 5 built channels (including brightspace), and rejects .providers-only or partial payloads', () => {
    const contractedEnvelope = {
      lms: [
        { lms: 'moodle', channel: 'moodle', channelName: 'Moodle', methods: ['dynamic', 'manual'] },
        { lms: 'canvas', channel: 'canvas', channelName: 'Canvas', methods: ['manual', 'dynamic'] },
        { lms: 'blackboard', channel: 'blackboard', channelName: 'Blackboard Ultra', methods: ['manual'] },
        { lms: 'lti-generic', channel: 'lti-generic', channelName: 'Other LMS (LTI 1.3)', methods: ['dynamic', 'manual'] },
        { lms: 'brightspace', channel: 'brightspace', channelName: 'D2L Brightspace', methods: ['dynamic', 'manual'] },
      ],
    };

    const parsed = parseLmsProvidersEnvelope(contractedEnvelope);
    expect(parsed.channelIds).toEqual(['blackboard', 'brightspace', 'canvas', 'lti-generic', 'moodle']);
    expect(parsed.channelMethods).toEqual([
      'blackboard:manual',
      'brightspace:dynamic',
      'brightspace:manual',
      'canvas:dynamic',
      'canvas:manual',
      'lti-generic:dynamic',
      'lti-generic:manual',
      'moodle:dynamic',
      'moodle:manual',
    ]);

    // Negative counterexample 1: uncontracted `{ providers: [...] }` envelope without `.lms` must fail
    expect(() =>
      parseLmsProvidersEnvelope({
        providers: contractedEnvelope.lms,
      }),
    ).toThrow(/missing contracted \.lms array/);

    // Negative counterexample 2: empty `.lms: []` array must fail
    expect(() => parseLmsProvidersEnvelope({ lms: [] })).toThrow(/empty \.lms array/);

    // Negative counterexample 3: `.lms` missing `brightspace` must fail
    expect(() =>
      parseLmsProvidersEnvelope({
        lms: contractedEnvelope.lms.filter((p) => p.channel !== 'brightspace'),
      }),
    ).toThrow(/missing expected built channel "brightspace"/);

    // Negative counterexample 4: `.lms` channel missing a contracted method must fail
    expect(() =>
      parseLmsProvidersEnvelope({
        lms: contractedEnvelope.lms.map((p) => (p.channel === 'brightspace' ? { ...p, methods: ['manual'] } : p)),
      }),
    ).toThrow(/channel "brightspace" is missing expected registration method "dynamic"/);
  });

  it('B-LA-E5-13-01 & A-LA-E5-13-01 fixture & probe counterexample: assertExpectedConnectionFixtures and buildConnectionRouteProbes require all 5 built channels (91 probes including 26 brightspace probes) and catch a Brightspace 200 leak', () => {
    const completeFixtures: ConnectionFixtureSpec[] = [
      { label: 'moodle-manual', channel: 'moodle', method: 'manual', id: 'con_moodle_man' },
      { label: 'blackboard', channel: 'blackboard', method: 'manual', id: 'con_bb_man' },
      { label: 'canvas', channel: 'canvas', method: 'manual', id: 'con_cv_man' },
      { label: 'lti-generic-dynamic', channel: 'lti-generic', method: 'dynamic', id: 'con_gen_dyn' },
      { label: 'lti-generic-manual', channel: 'lti-generic', method: 'manual', id: 'con_gen_man' },
      { label: 'brightspace-dynamic', channel: 'brightspace', method: 'dynamic', id: 'con_bs_dyn' },
      { label: 'brightspace-manual', channel: 'brightspace', method: 'manual', id: 'con_bs_man' },
    ];

    const summary = assertExpectedConnectionFixtures(completeFixtures);
    expect(summary.exercisedChannels).toEqual([...EXPECTED_BUILT_CHANNELS].sort());
    expect(summary.exercisedMethods).toEqual(['dynamic', 'manual']);
    expect(summary.exercisedChannelMethods).toEqual([
      'blackboard:manual',
      'brightspace:dynamic',
      'brightspace:manual',
      'canvas:manual',
      'lti-generic:dynamic',
      'lti-generic:manual',
      'moodle:manual',
    ]);

    // Negative counterexample 1: Round 1 partial fixture list (missing brightspace & moodle) must fail loudly
    const round1PartialFixtures: ConnectionFixtureSpec[] = completeFixtures.filter(
      (f) => f.channel !== 'brightspace' && f.channel !== 'moodle',
    );
    expect(() => assertExpectedConnectionFixtures(round1PartialFixtures)).toThrow(
      /Expected connection fixture for channel "moodle" is missing/,
    );
    expect(() =>
      assertExpectedConnectionFixtures(completeFixtures.filter((f) => f.channel !== 'brightspace')),
    ).toThrow(/Expected connection fixture for channel "brightspace" is missing/);

    // Negative counterexample 2: missing brightspace:dynamic variant must fail
    expect(() =>
      assertExpectedConnectionFixtures(completeFixtures.filter((f) => f.label !== 'brightspace-dynamic')),
    ).toThrow(/Expected connection fixture for "brightspace:dynamic" is missing/);

    // Verify 91 route probes (7 fixtures * 13 routes), including 26 Brightspace probes
    const probes = buildConnectionRouteProbes(completeFixtures, 'crs_a_1');
    expect(probes).toHaveLength(91);
    const brightspaceProbes = probes.filter((p) => p.channel === 'brightspace');
    expect(brightspaceProbes).toHaveLength(26);

    // Negative counterexample 3 (Reviewer-B B-LA-E5-13-01):
    // A fake server that returns `{ lms: [...] }` on `/app-api/lms-providers` and leaks HTTP 200 on
    // `GET /app-api/connections/con_bs_man/tool-configuration` for a Brightspace connection is now probed and fails.
    const fakeLeakyResponses = probes.map((probe) => ({
      probe,
      status:
        probe.channel === 'brightspace' && probe.path === '/app-api/connections/con_bs_man/tool-configuration'
          ? 200
          : 404,
    }));
    const failures = fakeLeakyResponses
      .filter((r) => r.status !== 404)
      .map((r) => `${r.probe.label} -> HTTP ${r.status} (expected 404)`);
    expect(failures).toEqual([
      'brightspace-manual: GET /app-api/connections/:id/tool-configuration -> HTTP 200 (expected 404)',
    ]);
  });

  it('B-LA-E5-13-02 regression + negative counterexamples: compareVictimStateBeforeAfter and assertVictimStateUnchanged verify all persisted Library B connection and publication DTO fields and reject any cross-tenant mutation even when foreign calls return 404', () => {
    const bConnectionsBefore: Record<string, Record<string, unknown>> = {
      blackboard: {
        id: 'con_b_bb',
        name: 'E5-13 B Blackboard',
        lms: 'blackboard',
        channel: 'blackboard',
        channelName: 'Blackboard Ultra',
        method: 'manual',
        status: 'registered',
        bindingAuthority: 'operatorGrant',
        siteUrl: 'https://learn-b.blackboard.sim.test',
        serviceUrl: 'https://learn-b.blackboard.sim.test',
        profile: {
          issuer: 'https://developer.blackboard.com',
          authorizationEndpoint: 'https://developer.blackboard.com/api/v1/gateway/oidcauth',
          tokenEndpoint: 'https://developer.blackboard.com/api/v1/gateway/oauth2/jwttoken',
          jwksUrl: 'https://developer.blackboard.com/api/v1/management/applications/sim-bb-client-id/jwks.json',
        },
        platform: {
          id: 'plt_b_bb',
          issuer: 'https://developer.blackboard.com',
          clientId: 'sim-bb-client-id',
          deploymentIds: ['dep-b-bb-1'],
          siteUrl: 'https://learn-b.blackboard.sim.test',
          serviceUrl: 'https://learn-b.blackboard.sim.test',
          productFamilyCode: 'BlackboardLearn',
        },
        registrationUrl: null,
        registrationUrlExpiresAt: null,
        webServices: null,
        capabilities: {
          supportsDynamicRegistration: false,
          supportsManualRegistration: true,
          requiresDeploymentId: true,
          requiresSiteUrl: true,
        },
        channelCapabilities: {
          'binding.authority': { manual: 'operatorGrant' },
          'platform.sharing': 'shared',
        },
        lastError: null,
        lastLaunchAt: null,
        createdAt: '2026-04-20T07:50:19.167Z',
      },
      'brightspace-manual': {
        id: 'con_b_bs_man',
        name: 'E5-13 B Brightspace Manual',
        lms: 'brightspace',
        channel: 'brightspace',
        channelName: 'D2L Brightspace',
        method: 'manual',
        status: 'pending',
        bindingAuthority: 'operatorGrant',
        siteUrl: 'https://brightspace.sim.test',
        serviceUrl: null,
        profile: null,
        platform: null,
        registrationUrl: null,
        registrationUrlExpiresAt: null,
        webServices: null,
        capabilities: {
          supportsDynamicRegistration: true,
          supportsManualRegistration: true,
        },
        channelCapabilities: {
          'binding.authority': { dynamic: 'self', manual: 'operatorGrant' },
          'platform.sharing': 'perIssuerClient',
        },
        lastError: null,
        lastLaunchAt: null,
        createdAt: '2026-04-20T07:50:20.000Z',
      },
    };

    const bPublicationsBefore: Record<string, Record<string, unknown>> = {
      'blackboard-pub': {
        id: 'pub_b_bb',
        courseId: 'crs_b_1',
        versionId: 'ver_b_1',
        connectionId: 'con_b_bb',
        connectionName: 'E5-13 B Blackboard',
        lms: 'blackboard',
        status: 'available',
        activities: 2,
        learners: 1,
        createdAt: '2026-04-20T07:50:21.000Z',
        updatedAt: '2026-04-20T07:50:21.000Z',
      },
    };

    const beforeSnap = buildVictimStateSnapshot(bConnectionsBefore, bPublicationsBefore);
    const identicalAfterSnap = buildVictimStateSnapshot(
      structuredClone(bConnectionsBefore),
      structuredClone(bPublicationsBefore),
    );

    // Positive control: identical before & after snapshots pass
    expect(compareVictimStateBeforeAfter(beforeSnap, identicalAfterSnap)).toEqual({ ok: true, diffs: [] });
    expect(() => assertVictimStateUnchanged(beforeSnap, identicalAfterSnap)).not.toThrow();

    // Negative counterexample 1 (Reviewer-B exact B-LA-E5-13-02 counterexample):
    // Foreign PUT /app-api/connections/:bId/platform returns 404, and GET /app-api/connections/:bId in B's session
    // returns 200 with `status: 'pending'` (still !== 'disabled') and a mutated `siteUrl`.
    const afterStatusAndSiteUrlMutated = buildVictimStateSnapshot(
      {
        ...structuredClone(bConnectionsBefore),
        blackboard: {
          ...structuredClone(bConnectionsBefore.blackboard!),
          status: 'pending',
          siteUrl: 'https://attacker-overwritten.sim.test',
        },
      },
      structuredClone(bPublicationsBefore),
    );
    const res1 = compareVictimStateBeforeAfter(beforeSnap, afterStatusAndSiteUrlMutated);
    expect(res1.ok).toBe(false);
    expect(res1.diffs).toEqual(
      expect.arrayContaining([
        expect.stringContaining('connection[blackboard].status changed: before="registered" after="pending"'),
        expect.stringContaining(
          'connection[blackboard].siteUrl changed: before="https://learn-b.blackboard.sim.test" after="https://attacker-overwritten.sim.test"',
        ),
      ]),
    );
    expect(() => assertVictimStateUnchanged(beforeSnap, afterStatusAndSiteUrlMutated)).toThrow(
      /Victim Library B state changed after foreign-tenant calls/,
    );

    // Negative counterexample 2: platform binding (`platform.clientId` or `platform.deploymentIds`) mutated while `status` stays 'registered'
    const afterPlatformMutated = buildVictimStateSnapshot(
      {
        ...structuredClone(bConnectionsBefore),
        blackboard: {
          ...structuredClone(bConnectionsBefore.blackboard!),
          platform: {
            ...(structuredClone(bConnectionsBefore.blackboard!.platform) as Record<string, unknown>),
            clientId: 'cross-tenant-client',
            deploymentIds: ['dep-b-bb-1', 'dep-cross-2'],
          },
        },
      },
      structuredClone(bPublicationsBefore),
    );
    expect(() => assertVictimStateUnchanged(beforeSnap, afterPlatformMutated)).toThrow(
      /connection\[blackboard\]\.platform changed/,
    );

    // Negative counterexample 3: publication `activities` or `learners` count mutated while `status` stays 'available'
    const afterPublicationActivitiesMutated = buildVictimStateSnapshot(
      structuredClone(bConnectionsBefore),
      {
        'blackboard-pub': {
          ...structuredClone(bPublicationsBefore['blackboard-pub']!),
          activities: 3,
        },
      },
    );
    expect(() => assertVictimStateUnchanged(beforeSnap, afterPublicationActivitiesMutated)).toThrow(
      /publication\[blackboard-pub\]\.activities changed: before=2 after=3/,
    );
  });
});
