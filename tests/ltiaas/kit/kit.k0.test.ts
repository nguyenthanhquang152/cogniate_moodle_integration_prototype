import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { parseForm } from '../../acceptance/M1/common/client.js';
import {
  followPickerHandoff,
  HttpResultLike,
  launchRefused,
  PlatformStorageCaseIo,
  readStorageCheckToken,
  readStoragePageJson,
  findStorageAuthUrl,
  runFamilyGuardCase,
  runPlatformStorageCase,
  STORAGE_HELP_TEXT,
  waitForLearnerSync,
  waitForThrottledDispatch,
} from './lib/cases.js';
import {
  auditFixtureSources,
  BASELINE_CHANNEL_IDS,
  BilateralEqualityInput,
  buildFamilyGuardMap,
  buildOperatorGrantCliArgs,
  buildOperatorGrantNpmArgs,
  buildPickerSelectionForm,
  CAPABILITY_KEYS,
  ChannelFixture,
  collectContextlessPlacementObservation,
  computeExpectedCaseList,
  computeExpectedGlobalCaseList,
  contentItemPublicationIds,
  deriveExpectedFamilyGuardOutcome,
  deriveLegacyFlagsFromCapabilities,
  evaluateChannelPassRule,
  ExecutedCaseRecord,
  getChannelsDir,
  isK1SimLevelEnabled,
  K1_SIM_SUITE_FILES,
  listChannelFixtureIds,
  loadAllChannelFixtures,
  loadChannelFixture,
  orderByPickerList,
  orderKitSuiteSpecs,
  parseOperatorGrantOutput,
  PICKER_SELECTION_FIELD,
  PROTOCOL_SECURITY_FAULTS,
  resolveKitLevel,
  resolveSelectedChannelIds,
  selectFamilyGuardProbes,
  selectProtocolControlFixture,
  validateFamilyGuardLaunchObservation,
  verifyBilateralCapabilities,
  verifyContextlessSharedPlacement,
  WaveEvidenceManifest,
} from './lib/fixtures.js';
import {
  deriveCurrentWaveIdFromRun,
  evaluateKitRunPassRule,
  initKitRunLedger,
  isK1SimEnabled,
  issueOperatorGrantForChannel,
  loadWaveEvidenceFromRun,
  LTI,
  readAllExecutedCases,
  recordRedactedEvidence,
  recordSecret,
  recordSkippedCase,
  runKitCase,
  scanAllLogsAndArtifactsForSecrets,
  writeKitRunSummaryArtifacts,
  writeWaveEvidenceToRun,
} from './lib/runtime.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SUITES_DIR = path.join(__dirname, 'suites');
const REPO_ROOT = path.resolve(__dirname, '../../..');

const VALID_WAVE_ID = 'wave-B4-test';
const VALID_WAVE_EVIDENCE: WaveEvidenceManifest = {
  waveId: VALID_WAVE_ID,
  suites: {
    T3b: {
      outcome: 'PASS',
      waveId: VALID_WAVE_ID,
      artifactPath: 'artifacts/T3b/summary.json',
    },
    T7: {
      outcome: 'PASS',
      waveId: VALID_WAVE_ID,
      artifactPath: 'artifacts/T7/summary.json',
    },
    T8: {
      outcome: 'PASS',
      waveId: VALID_WAVE_ID,
      artifactPath: 'artifacts/T8/summary.json',
    },
  },
};

function buildPassingRecordsForChannel(
  fixture: ChannelFixture,
  runId = 'run-k0-1',
): ExecutedCaseRecord[] {
  return computeExpectedCaseList(fixture)
    .filter((c) => c.expectedStatus === 'RUN')
    .map((c) => ({
      id: c.id,
      channelId: fixture.id,
      suite: c.suite,
      code: c.code,
      outcome: 'PASS' as const,
      runId,
    }));
}

export function runShippedChannelsAudit(dir: string = getChannelsDir()): ChannelFixture[] {
  const ids = listChannelFixtureIds(dir);
  expect(ids.slice(0, BASELINE_CHANNEL_IDS.length)).toEqual([...BASELINE_CHANNEL_IDS]);
  const fixtures = loadAllChannelFixtures(dir);
  expect(fixtures.length).toBeGreaterThanOrEqual(BASELINE_CHANNEL_IDS.length);

  for (const fixture of fixtures) {
    expect(Object.keys(fixture.capabilities).sort()).toEqual([...CAPABILITY_KEYS].sort());
    const audit = auditFixtureSources(fixture);
    expect(audit.errors).toEqual([]);
    expect(audit.ok).toBe(true);
    const cases = computeExpectedCaseList(fixture);
    expect(cases.length).toBeGreaterThan(0);
  }
  return fixtures;
}

// ---------------------------------------------------------------------------------------------
// Contract-shaped host fakes for the case bodies of lib/cases.ts (K0 only, no network).
// ---------------------------------------------------------------------------------------------

// LA-ADR-01 D6 baseline guard table, frozen from the design text (not read from the fixtures):
// Canvas guards `canvas` and Blackboard guards `blackboardlearn` at the `launch` level; brightspace
// guards `desire2learn` at the `registration` level (LA-ADR-02 D1/D4); Moodle and lti-generic guard
// nothing (LA-ADR-02 D3). MANUAL_SELF_LEGACY_CHANNELS has one entry, the Moodle channel (load check 6).
const DESIGN_FAMILY_GUARDS: Record<string, { channel: string; level: 'launch' | 'registration' }> = {
  canvas: { channel: 'canvas', level: 'launch' },
  blackboardlearn: { channel: 'blackboard', level: 'launch' },
  desire2learn: { channel: 'brightspace', level: 'registration' },
};
const DESIGN_MANUAL_SELF_LEGACY = ['moodle'];

function fakeClock() {
  let t = 1_700_000_000_000;
  return {
    now: () => t,
    sleep: async (ms: number) => {
      t += ms;
    },
    tick: (ms = 1) => {
      t += ms;
      return t;
    },
  };
}

function fakeErrorPage(code: string, action = 'Open the activity again.'): HttpResultLike {
  return {
    status: 400,
    headers: { 'content-type': 'text/html' },
    body: `<main data-error-code="${code}" data-trace-id="tr_k0"><p data-error-action>${action}</p></main>`,
  };
}

function fakeLogReader(logs: Array<Record<string, unknown>>) {
  return (service: string, event: string, since: number, fields: Record<string, unknown> = {}) =>
    logs.filter(
      (l) =>
        l.service === service &&
        l.event === event &&
        Number(l.tsMs) >= since &&
        Object.entries(fields).every(([k, v]) => l[k] === v),
    );
}

type Check14Mutant = 'refuseRegistration' | 'appLogOnly' | 'noLog' | 'passLaunchGuard' | 'guardMoodle';

// LTI check 14 and its log as LA-ADR-01 D6 states them, on one platform of `platformChannel`.
function makeCheck14Fake(platformChannel: string, platformId: string, mutant?: Check14Mutant) {
  const clock = fakeClock();
  const logs: Array<Record<string, unknown>> = [];
  const launched: string[] = [];
  const io = {
    now: clock.now,
    sleep: clock.sleep,
    logEvents: fakeLogReader(logs),
    launch: async (patch: Record<string, unknown>) => {
      const ts = clock.tick(3);
      const claims = patch.claims as Record<string, { product_family_code?: string }>;
      const family = String(claims[`${LTI}tool_platform`]?.product_family_code ?? '').toLowerCase();
      launched.push(family);
      const guard =
        mutant === 'guardMoodle' && family === 'moodle'
          ? { channel: 'zz-other', level: 'registration' as const }
          : DESIGN_FAMILY_GUARDS[family];
      const pass = {
        response: {
          status: 303,
          headers: { location: 'https://app.cogniate.test/tool/launch?ltik=k0' },
          body: '',
        } as HttpResultLike,
      };
      if (!guard || guard.channel === platformChannel) return pass;
      if (guard.level === 'launch') {
        return mutant === 'passLaunchGuard' ? pass : { response: fakeErrorPage('PROVIDER_PROFILE_MISMATCH') };
      }
      if (DESIGN_MANUAL_SELF_LEGACY.includes(platformChannel) || mutant === 'refuseRegistration') {
        return { response: fakeErrorPage('PROVIDER_PROFILE_MISMATCH') };
      }
      if (mutant !== 'noLog') {
        logs.push({
          service: mutant === 'appLogOnly' ? 'cogniate-app' : 'lti-service',
          event: 'family_guard_mismatch',
          tsMs: ts,
          platform_id: platformId,
          family,
        });
      }
      return pass;
    },
  };
  return { io, logs, launched };
}

type StorageMutant = 'replayAccepted' | 'wrongValueAccepted' | 'noCheckLog' | 'ignoreTarget';

// LTI login, simulator authorize, launch and storage check as lti-service-api-delta.md §2.1/§2.2 and
// LA-ADR-05 D1 rules 1, 3, 6-8 state them. Page JSON keys are free (the contract names none); the
// JSON escapes `<`, `>`, `&` as `\u` sequences; the storage-check page builds its form in script.
function makeStorageContractFake(opts: {
  storageProfile: boolean;
  authEndpoint: string;
  mutant?: StorageMutant;
}) {
  const clock = fakeClock();
  const ltiUrl = 'https://lti.cogniate.test';
  const ltiOrigin = new URL(ltiUrl).origin;
  const launchUrl = `${ltiUrl}/lti/launch/cogniate`;
  const checkUrl = `${ltiUrl}/lti/launch/cogniate/storage-check`;
  const sha = (v: string) => crypto.createHash('sha256').update(v).digest('hex');
  const rnd = () => crypto.randomBytes(24).toString('base64url');
  const escapeJson = (v: unknown) =>
    JSON.stringify(v).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  const cookieName = (state: string) => `__Host-lti_state_${sha(state).slice(0, 8)}`;
  const logins = new Map<string, { target: string | null; fault?: string; used: boolean }>();
  const checks = new Map<string, { stateHash: string; used: boolean }>();
  const logs: Array<Record<string, unknown>> = [];
  const checkRequests: Array<{ fields: string[]; origin?: string; status: number }> = [];
  const pages: string[] = [];
  const checkLog = (detail: string) => {
    if (opts.mutant !== 'noCheckLog') {
      logs.push({
        service: 'lti-service',
        event: 'launch_check_failed',
        tsMs: clock.tick(),
        check: 'storage',
        code: 'INVALID_STATE',
        detail,
      });
    }
  };
  const io: PlatformStorageCaseIo = {
    now: clock.now,
    sleep: clock.sleep,
    logEvents: fakeLogReader(logs),
    rememberSecret: () => undefined,
    beginLaunch: async (patch, loginPatch = {}) => {
      const state = rnd();
      const target = (loginPatch.lti_storage_target ?? patch.storageTarget ?? null) as string | null;
      const authUrl = `${opts.authEndpoint}?${new URLSearchParams({
        scope: 'openid',
        response_type: 'id_token',
        response_mode: 'form_post',
        prompt: 'none',
        client_id: String(patch.clientId ?? ''),
        redirect_uri: launchUrl,
        login_hint: 'scenario-k0',
        lti_message_hint: 'message-scenario-k0',
        state,
        nonce: rnd(),
      })}`;
      const storage = opts.storageProfile && Boolean(target) && opts.mutant !== 'ignoreTarget';
      logins.set(state, { target: storage ? target : null, fault: patch.fault as string | undefined, used: false });
      const cookie = `${cookieName(state)}=${state}`;
      const setCookie = [`${cookie}; Path=/; Max-Age=600; Secure; HttpOnly; SameSite=None; Partitioned`];
      if (storage) {
        const body = `<!doctype html><html><head><meta charset="utf-8"><script type="application/json" id="k0-login">${escapeJson({
          redirectTo: authUrl,
          key: `cog_state_${sha(state)[0]}`,
          value: state,
          frame: target,
          origin: new URL(opts.authEndpoint).origin,
        })}</script><script nonce="k0">/* lti.put_data, then location.replace(authUrl) */</script></head><body></body></html>`;
        pages.push(body);
        return {
          login: { status: 200, headers: { 'set-cookie': setCookie, 'content-type': 'text/html' }, body },
          location: '',
          cookie,
        };
      }
      return {
        login: { status: 302, headers: { location: authUrl, 'set-cookie': setCookie }, body: '' },
        location: authUrl,
        cookie,
      };
    },
    request: async (url, req = {}) => {
      const method = req.method ?? 'GET';
      if (method === 'GET' && url.startsWith(`${opts.authEndpoint}?`)) {
        const u = new URL(url);
        const state = u.searchParams.get('state') ?? '';
        const login = logins.get(state);
        if (!login || u.searchParams.get('redirect_uri') !== launchUrl) {
          return { status: 400, headers: {}, body: 'Simulator authorize refused' };
        }
        const token = `idt.${login.fault ? 'bad' : 'ok'}.${state}`;
        return {
          status: 200,
          headers: { 'content-type': 'text/html' },
          body: `<form method="post" action="${launchUrl}"><input type="hidden" name="id_token" value="${token}"><input type="hidden" name="state" value="${state}"></form>`,
        };
      }
      if (method === 'POST' && url === checkUrl) {
        const fields = new URLSearchParams(req.body ?? '');
        const origin = req.headers?.origin;
        const answer = (() => {
          if (origin !== ltiOrigin) return fakeErrorPage('INVALID_STATE');
          const row = checks.get(fields.get('check') ?? '');
          if (!row || row.used) {
            checkLog('storage_check_unknown_used_or_expired');
            return fakeErrorPage('INVALID_STATE');
          }
          if (opts.mutant !== 'replayAccepted') row.used = true;
          const value = fields.get('value') ?? '';
          if (value === '') return fakeErrorPage('STATE_COOKIE_MISSING', STORAGE_HELP_TEXT);
          if (sha(value) !== row.stateHash && opts.mutant !== 'wrongValueAccepted') {
            checkLog('storage_mismatch');
            return fakeErrorPage('INVALID_STATE');
          }
          return {
            status: 303,
            headers: { location: `https://app.cogniate.test/tool/launch?ltik=${rnd()}` },
            body: '',
          } as HttpResultLike;
        })();
        checkRequests.push({ fields: [...fields.keys()], origin, status: answer.status });
        return answer;
      }
      return { status: 404, headers: {}, body: 'not found' };
    },
    formPost: async (url, fields, cookie) => {
      if (url !== launchUrl) return { status: 404, headers: {}, body: 'not found' };
      const state = fields.state ?? '';
      const login = logins.get(state);
      if (!login || login.used) return fakeErrorPage('INVALID_STATE');
      login.used = true;
      const badSignature = !String(fields.id_token ?? '').startsWith('idt.ok.');
      if (cookie === `${cookieName(state)}=${state}`) {
        return badSignature
          ? fakeErrorPage('INVALID_SIGNATURE')
          : { status: 303, headers: { location: `https://app.cogniate.test/tool/launch?ltik=${rnd()}` }, body: '' };
      }
      if (!login.target) return fakeErrorPage('STATE_COOKIE_MISSING');
      if (badSignature) return fakeErrorPage('INVALID_SIGNATURE');
      const check = rnd();
      checks.set(check, { stateHash: sha(state), used: false });
      const body = `<!doctype html><html><head><script type="application/json" id="k0-check">${escapeJson({
        check,
        postUrl: checkUrl,
        key: `cog_state_${sha(state)[0]}`,
        origin: new URL(opts.authEndpoint).origin,
      })}</script><script nonce="k0">/* lti.get_data, then builds and posts the form */</script></head><body></body></html>`;
      pages.push(body);
      return { status: 200, headers: { 'content-type': 'text/html', 'referrer-policy': 'same-origin' }, body };
    },
  };
  return { io, ltiUrl, ltiOrigin, checkRequests, pages };
}

function storageCaseCtx(fixture: ChannelFixture, ltiUrl: string) {
  return {
    fixture,
    launchPatch: {
      provider: fixture.simProvider,
      clientId: 'client-k0',
      deploymentId: fixture.sim.deployments[0],
      siteHost: fixture.sim.siteHost,
      pageHost: fixture.sim.pageHost,
      resource: 'pub_k0',
    },
    ltiUrl,
    account: 'cogniate',
  };
}

// L7 answers shaped from the contracts: ResultRow (cogniate-app-api.md §5; `activity.resourceLinkId`
// is the placement id `rl_...`), the publication DTO with `stats`, two /api/idtoken bodies
// (lti-service-api.md §3.1) and simulator score records (tests/sim/core/provider.mjs).
function contractL7Raw() {
  const lineItem = 'https://generic.sim.test/lti/courses/course-1/lineitems/pub_k0';
  const row = (sub: string) => ({
    learner: { sub, label: `Learner ${sub}` },
    activity: { resourceLinkId: 'rl_9f2c41', contextTitle: '', title: 'QA resource' },
    preview: false,
    best: { attemptId: `att_${sub}`, outcome: 'passed', scoreGiven: 8, scoreMaximum: 10 },
    attempts: [],
    scoreSyncs: [{ id: `sync_${sub}`, status: 'sent', tries: 1, lastError: null }],
    gradebook: null,
  });
  const score = (sub: string) => ({
    kind: 'score',
    provider: 'generic-sim',
    host: 'generic.sim.test',
    method: 'POST',
    path: '/lti/courses/course-1/lineitems/pub_k0/scores',
    resource: 'pub_k0',
    body: { userId: sub, scoreGiven: 8, scoreMaximum: 10 },
  });
  return {
    rows: [row('u1'), row('u2')] as Array<Record<string, any>>,
    publication: { id: 'pub_k0', stats: { activities: 1, learners: 2 } } as Record<string, any>,
    idToken1: { services: { assignmentAndGrades: { available: true, lineItemId: lineItem } } },
    idToken2: { services: { assignmentAndGrades: { available: true, lineItemId: lineItem } } },
    simRecords: [{ kind: 'token', host: 'generic.sim.test' }, score('u1'), score('u2')] as Array<
      Record<string, any>
    >,
    learner1: 'u1',
    learner2: 'u2',
    publicationId: 'pub_k0',
  };
}

describe('LA-E7-06 K0: Channel Certification Kit Self-Tests', () => {
  it('AC-LA-E7-06-01 / F1: zero LMS-name or lti-generic tokens in tests/ltiaas/kit/suites/**', () => {
    const bannedRegex =
      /(moodle|canvas|blackboard|brightspace|sakai|schoology|d2l|instructure|anthology|lti-generic)/i;
    const files = fs.readdirSync(SUITES_DIR).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBe(7);

    const hits: string[] = [];
    for (const file of files) {
      const fullPath = path.join(SUITES_DIR, file);
      const lines = fs.readFileSync(fullPath, 'utf8').split('\n');
      lines.forEach((line, idx) => {
        const m = line.match(bannedRegex);
        if (m) {
          hits.push(`${file}:${idx + 1}: matched "${m[0]}" in \`${line.trim()}\``);
        }
      });
    }
    expect(hits).toEqual([]);
  });

  it('AC-LA-E7-06-03 / TB-12: all discovered channel fixtures have complete 17-key capabilities and verified source citations', () => {
    const fixtures = runShippedChannelsAudit();

    // Negative probe: missing source citation fails auditFixtureSources
    const broken = structuredClone(fixtures[0]);
    delete broken.sources['capabilities.site.serviceOrigin'];
    const brokenAudit = auditFixtureSources(broken);
    expect(brokenAudit.ok).toBe(false);
    expect(brokenAudit.errors.some((e) => e.includes('capabilities.site.serviceOrigin'))).toBe(
      true,
    );

    // Negative probe: legacyFlags mismatch against LA-ADR-01 §D11 derivation fails auditFixtureSources
    const badLegacy = structuredClone(fixtures[0]);
    badLegacy.expect.legacyFlags.dynamicRegistration =
      !badLegacy.expect.legacyFlags.dynamicRegistration;
    const badLegacyAudit = auditFixtureSources(badLegacy);
    expect(badLegacyAudit.ok).toBe(false);
    expect(badLegacyAudit.errors.some((e) => e.includes('dynamicRegistration'))).toBe(true);

    // Negative probes: L4 guard data must be declared, lower case, with a known level and a citation
    const noGuards = structuredClone(fixtures[0]) as unknown as { expect: Record<string, unknown> };
    delete noGuards.expect.guardedFamilies;
    expect(auditFixtureSources(noGuards as unknown as ChannelFixture).errors.join('\n')).toContain(
      '"expect.guardedFamilies" must be an array',
    );
    const badGuard = structuredClone(fixtures[0]);
    badGuard.expect.guardedFamilies = [
      { family: 'BlackboardLearn', level: 'launch' },
      { family: 'x', level: 'site' as 'launch' },
    ];
    const badGuardErrors = auditFixtureSources(badGuard).errors.join('\n');
    expect(badGuardErrors).toContain('non-empty lower-case family');
    expect(badGuardErrors).toContain('level must be "launch" or "registration"');
    const noGuardSource = structuredClone(fixtures[0]);
    delete noGuardSource.sources['expect.guardedFamilies'];
    expect(auditFixtureSources(noGuardSource).errors.join('\n')).toContain(
      'source citation for "expect.guardedFamilies"',
    );
  });

  it('B-LA-E7-06-06 / LA-E8-01: open-world channel discovery onboards a new <id>.json fixture and passes runShippedChannelsAudit with zero shared-list edits', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-canary-channels-'));
    try {
      const beforeIds = listChannelFixtureIds();
      for (const id of beforeIds) {
        const src = path.join(__dirname, 'channels', `${id}.json`);
        fs.copyFileSync(src, path.join(tmpDir, `${id}.json`));
      }
      const baseGeneric = loadChannelFixture('lti-generic', tmpDir);
      const canaryFixture: ChannelFixture = {
        ...structuredClone(baseGeneric),
        id: 'canary-lms',
        simProvider: 'canary-sim',
        simProfile: 'canary-lms',
      };
      canaryFixture.capabilities['content.multiple'] = false;
      canaryFixture.capabilities['setup.connectionCheck'] = false;
      canaryFixture.expect.legacyFlags = deriveLegacyFlagsFromCapabilities(
        'canary-lms',
        canaryFixture.capabilities,
      );
      fs.writeFileSync(
        path.join(tmpDir, 'canary-lms.json'),
        JSON.stringify(canaryFixture, null, 2),
        'utf8',
      );

      const expectedExtra = Array.from(
        new Set([
          ...beforeIds.filter(
            (id) =>
              !BASELINE_CHANNEL_IDS.includes(
                id as (typeof BASELINE_CHANNEL_IDS)[number],
              ),
          ),
          'canary-lms',
        ]),
      ).sort();
      const expectedIds = [...BASELINE_CHANNEL_IDS, ...expectedExtra];

      // Run the shipped audit function against the directory with the new fixture
      const audited = runShippedChannelsAudit(tmpDir);
      expect(audited.length).toBe(expectedIds.length);
      expect(audited.map((f) => f.id)).toEqual(expectedIds);

      // Default selection and 'all' selection both include the onboarded fixture automatically
      expect(resolveSelectedChannelIds(undefined, tmpDir)).toEqual(expectedIds);
      expect(resolveSelectedChannelIds('all', tmpDir)).toEqual(expectedIds);
      expect(resolveSelectedChannelIds('canary-lms', tmpDir)).toEqual(['canary-lms']);

      const expectedCases = computeExpectedCaseList(canaryFixture);
      expect(
        expectedCases.some((c) => c.id === 'canary-lms:K1-CAP:C2:setup.connectionCheck'),
      ).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('AC-LA-E7-06-04 / A-LA-E7-06-02 / B-LA-E7-06-03: C1 bilateral equality rejects missing, null, or array API capability maps and detects mismatches', () => {
    const canvas = loadChannelFixture('canvas');
    const validInput: BilateralEqualityInput = {
      fixture: canvas,
      providerChannelCapabilities: structuredClone(canvas.capabilities) as unknown as Record<
        string,
        unknown
      >,
      providerLegacyFlags: structuredClone(canvas.expect.legacyFlags) as unknown as Record<
        string,
        unknown
      >,
      connectionChannelCapabilities: structuredClone(canvas.capabilities) as unknown as Record<
        string,
        unknown
      >,
      connectionLegacyFlags: structuredClone(canvas.expect.legacyFlags) as unknown as Record<
        string,
        unknown
      >,
      toolConfigurationKeys: [...canvas.expect.toolConfigurationKeys],
    };

    expect(verifyBilateralCapabilities(validInput)).toEqual({ ok: true, errors: [] });

    const objectFields = [
      'providerChannelCapabilities',
      'providerLegacyFlags',
      'connectionChannelCapabilities',
      'connectionLegacyFlags',
    ] as const;

    for (const field of objectFields) {
      for (const badValue of [undefined, null, []]) {
        const res = verifyBilateralCapabilities({
          ...validInput,
          [field]: badValue as unknown as Record<string, unknown>,
        });
        expect(res.ok).toBe(false);
        expect(res.errors.some((e) => e.includes(`missing or invalid ${field} object`))).toBe(
          true,
        );
      }
    }

    for (const badKeys of [undefined, null, {}, [123]]) {
      const res = verifyBilateralCapabilities({
        ...validInput,
        toolConfigurationKeys: badKeys as unknown as string[],
      });
      expect(res.ok).toBe(false);
      expect(
        res.errors.some((e) => e.includes('missing or invalid toolConfigurationKeys array')),
      ).toBe(true);
    }

    const flippedCap = structuredClone(validInput);
    flippedCap.providerChannelCapabilities['site.serviceOrigin'] = false;
    const flippedRes = verifyBilateralCapabilities(flippedCap);
    expect(flippedRes.ok).toBe(false);
    expect(flippedRes.errors[0]).toContain('site.serviceOrigin');

    const reorderedKeys = structuredClone(validInput);
    reorderedKeys.toolConfigurationKeys.reverse();
    const reorderedRes = verifyBilateralCapabilities(reorderedKeys);
    expect(reorderedRes.ok).toBe(false);
    expect(reorderedRes.errors[0]).toContain('tool-configuration keys mismatch');
  });

  it('AC-LA-E7-06-05 / A-LA-E7-06-01 / B-LA-E7-06-01: coveredBy never falls back to waveEvidence.waveId and verifies referenced suite artifact files on disk', () => {
    const moodle = loadChannelFixture('moodle');
    const runId = 'run-wave-test';
    const records = buildPassingRecordsForChannel(moodle, runId);

    const waveDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-wave-verify-'));
    const prevWaveEnv = process.env.LA_WAVE_ID;
    try {
      delete process.env.LA_WAVE_ID;

      // 1. Calling evaluateChannelPassRule with no waveEvidence MUST fail
      const noWaveRes = evaluateChannelPassRule({
        fixture: moodle,
        executedRecords: records,
        expectedRunId: runId,
        currentWaveId: VALID_WAVE_ID,
        waveEvidence: null,
        runDir: waveDir,
      });
      expect(noWaveRes.ok).toBe(false);
      expect(noWaveRes.errors.some((e) => e.includes('missing wave evidence'))).toBe(true);

      // 2. Omitted currentWaveId (and LA_WAVE_ID unset) with a self-consistent old wave-evidence.json MUST FAIL (never fall back to waveEvidence.waveId!)
      writeWaveEvidenceToRun(
        {
          waveId: 'wave-B1-old',
          suites: {
            T3b: {
              outcome: 'PASS',
              waveId: 'wave-B1-old',
              artifactPath: 'artifacts/T3b/summary.json',
            },
            T7: {
              outcome: 'PASS',
              waveId: 'wave-B1-old',
              artifactPath: 'artifacts/T7/summary.json',
            },
            T8: {
              outcome: 'PASS',
              waveId: 'wave-B1-old',
              artifactPath: 'artifacts/T8/summary.json',
            },
          },
        },
        waveDir,
      );
      const oldManifest = loadWaveEvidenceFromRun({ stateDir: waveDir });
      expect(deriveCurrentWaveIdFromRun({ env: {} as NodeJS.ProcessEnv })).toBeNull();

      const omittedCurrentWaveRes = evaluateChannelPassRule({
        fixture: moodle,
        executedRecords: records,
        expectedRunId: runId,
        waveEvidence: oldManifest,
        runDir: waveDir,
      });
      expect(omittedCurrentWaveRes.ok).toBe(false);
      expect(
        omittedCurrentWaveRes.errors.some((e) => e.includes('requires currentWaveId')),
      ).toBe(true);

      // Full-run evaluator also fails when currentWaveId is omitted and LA_WAVE_ID is unset
      const omittedKitRunRes = evaluateKitRunPassRule({
        fixtures: [moodle],
        executedRecords: [
          ...records,
          ...computeExpectedGlobalCaseList().map((g) => ({
            id: g.id,
            channelId: 'GLOBAL',
            suite: g.suite,
            code: g.code,
            outcome: 'PASS' as const,
            runId,
          })),
        ],
        waveEvidence: oldManifest,
        expectedRunId: runId,
        runDir: waveDir,
      });
      expect(omittedKitRunRes.ok).toBe(false);

      // 3. Stale waveId on manifest vs currentWaveId MUST fail
      const staleRes = evaluateChannelPassRule({
        fixture: moodle,
        executedRecords: records,
        expectedRunId: runId,
        currentWaveId: VALID_WAVE_ID,
        waveEvidence: oldManifest,
        runDir: waveDir,
      });
      expect(staleRes.ok).toBe(false);
      expect(staleRes.errors.some((e) => e.includes('stale wave evidence'))).toBe(true);

      // 4. artifactPath pointing to a missing file on disk MUST fail
      const missingArtifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-wave-no-art-'));
      try {
        writeWaveEvidenceToRun(VALID_WAVE_EVIDENCE, missingArtifactDir, {
          skipArtifactFiles: true,
        });
        const manifestWithoutFiles = loadWaveEvidenceFromRun({
          stateDir: missingArtifactDir,
          currentWaveId: VALID_WAVE_ID,
        });
        const missingFileRes = evaluateChannelPassRule({
          fixture: moodle,
          executedRecords: records,
          expectedRunId: runId,
          currentWaveId: VALID_WAVE_ID,
          waveEvidence: manifestWithoutFiles,
          runDir: missingArtifactDir,
        });
        expect(missingFileRes.ok).toBe(false);
        expect(
          missingFileRes.errors.some((e) => e.includes('does not exist')),
        ).toBe(true);
      } finally {
        fs.rmSync(missingArtifactDir, { recursive: true, force: true });
      }

      // 5. artifactPath resolving outside the current run folder MUST fail
      const outsideRes = evaluateChannelPassRule({
        fixture: moodle,
        executedRecords: records,
        expectedRunId: runId,
        currentWaveId: VALID_WAVE_ID,
        waveEvidence: {
          waveId: VALID_WAVE_ID,
          suites: {
            ...VALID_WAVE_EVIDENCE.suites,
            T8: {
              outcome: 'PASS',
              waveId: VALID_WAVE_ID,
              artifactPath: '../outside-run-folder.json',
            },
          },
        },
        runDir: waveDir,
      });
      expect(outsideRes.ok).toBe(false);
      expect(
        outsideRes.errors.some((e) => e.includes('resolves outside current run folder')),
      ).toBe(true);

      // 6. artifactPath whose file content reports FAIL or wrong waveId while wave-evidence.json says PASS MUST fail
      const validDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-wave-valid-'));
      try {
        writeWaveEvidenceToRun(VALID_WAVE_EVIDENCE, validDir);
        // Corrupt T8 artifact file to report outcome: FAIL
        const t8ArtifactPath = path.join(validDir, 'artifacts/T8/summary.json');
        fs.writeFileSync(
          t8ArtifactPath,
          JSON.stringify({ suite: 'T8', waveId: VALID_WAVE_ID, outcome: 'FAIL' }),
          'utf8',
        );
        const loadedContradictory = loadWaveEvidenceFromRun({
          stateDir: validDir,
          currentWaveId: VALID_WAVE_ID,
        });
        const contradictoryRes = evaluateChannelPassRule({
          fixture: moodle,
          executedRecords: records,
          expectedRunId: runId,
          currentWaveId: VALID_WAVE_ID,
          waveEvidence: loadedContradictory,
          runDir: validDir,
        });
        expect(contradictoryRes.ok).toBe(false);
        expect(
          contradictoryRes.errors.some((e) =>
            e.includes('has outcome="FAIL" !== "PASS"'),
          ),
        ).toBe(true);

        // Restore valid T8 artifact file -> PASSES
        fs.writeFileSync(
          t8ArtifactPath,
          JSON.stringify({ suite: 'T8', waveId: VALID_WAVE_ID, outcome: 'PASS' }),
          'utf8',
        );
        const validRes = evaluateChannelPassRule({
          fixture: moodle,
          executedRecords: records,
          expectedRunId: runId,
          currentWaveId: VALID_WAVE_ID,
          waveEvidence: loadedContradictory,
          runDir: validDir,
        });
        expect(validRes.errors).toEqual([]);
        expect(validRes.ok).toBe(true);

        const globalPassRecords: ExecutedCaseRecord[] =
          computeExpectedGlobalCaseList().map((g) => ({
            id: g.id,
            channelId: 'GLOBAL',
            suite: g.suite,
            code: g.code,
            outcome: 'PASS' as const,
            runId,
          }));

        // Positive control on evaluateKitRunPassRule: three per-suite files with matching suite, waveId, and outcome: PASS
        const validKitRunRes = evaluateKitRunPassRule({
          fixtures: [moodle],
          executedRecords: [...records, ...globalPassRecords],
          expectedRunId: runId,
          currentWaveId: VALID_WAVE_ID,
          waveEvidence: loadedContradictory,
          runDir: validDir,
        });
        expect(validKitRunRes.ok).toBe(true);

        // 7. Negative 1 (A-LA-E7-06-01 / B-LA-E7-06-01): an artifact file with NO `suite` field referenced for T3b, T7, T8 MUST fail both evaluateChannelPassRule and evaluateKitRunPassRule
        const anonArtifactRel = 'artifacts/anonymous-ok.json';
        fs.writeFileSync(
          path.join(validDir, anonArtifactRel),
          JSON.stringify({ waveId: VALID_WAVE_ID, outcome: 'PASS' }),
          'utf8',
        );
        const anonManifest: WaveEvidenceManifest = {
          waveId: VALID_WAVE_ID,
          suites: {
            T3b: {
              outcome: 'PASS',
              waveId: VALID_WAVE_ID,
              artifactPath: anonArtifactRel,
            },
            T7: {
              outcome: 'PASS',
              waveId: VALID_WAVE_ID,
              artifactPath: anonArtifactRel,
            },
            T8: {
              outcome: 'PASS',
              waveId: VALID_WAVE_ID,
              artifactPath: anonArtifactRel,
            },
          },
        };
        const anonChannelRes = evaluateChannelPassRule({
          fixture: moodle,
          executedRecords: records,
          expectedRunId: runId,
          currentWaveId: VALID_WAVE_ID,
          waveEvidence: anonManifest,
          runDir: validDir,
        });
        expect(anonChannelRes.ok).toBe(false);
        expect(anonChannelRes.passed).toBe(false);
        expect(
          anonChannelRes.errors.some((e) =>
            e.includes('suite="undefined" !== expected "T3b"'),
          ),
        ).toBe(true);

        const anonKitRunRes = evaluateKitRunPassRule({
          fixtures: [moodle],
          executedRecords: [...records, ...globalPassRecords],
          expectedRunId: runId,
          currentWaveId: VALID_WAVE_ID,
          waveEvidence: anonManifest,
          runDir: validDir,
        });
        expect(anonKitRunRes.ok).toBe(false);
        expect(anonKitRunRes.passed).toBe(false);

        // 8. Negative 2 (A-LA-E7-06-01 / B-LA-E7-06-01): a T3b artifact file reused for T3b, T7, and T8 MUST fail both evaluateChannelPassRule and evaluateKitRunPassRule
        const reusedT3bRel = 'artifacts/T3b/summary.json';
        const reusedManifest: WaveEvidenceManifest = {
          waveId: VALID_WAVE_ID,
          suites: {
            T3b: {
              outcome: 'PASS',
              waveId: VALID_WAVE_ID,
              artifactPath: reusedT3bRel,
            },
            T7: {
              outcome: 'PASS',
              waveId: VALID_WAVE_ID,
              artifactPath: reusedT3bRel,
            },
            T8: {
              outcome: 'PASS',
              waveId: VALID_WAVE_ID,
              artifactPath: reusedT3bRel,
            },
          },
        };
        const reusedChannelRes = evaluateChannelPassRule({
          fixture: moodle,
          executedRecords: records,
          expectedRunId: runId,
          currentWaveId: VALID_WAVE_ID,
          waveEvidence: reusedManifest,
          runDir: validDir,
        });
        expect(reusedChannelRes.ok).toBe(false);
        expect(reusedChannelRes.passed).toBe(false);
        expect(
          reusedChannelRes.errors.some((e) =>
            e.includes('suite="T3b" !== expected "T7"'),
          ),
        ).toBe(true);
        expect(
          reusedChannelRes.errors.some((e) =>
            e.includes('suite="T3b" !== expected "T8"'),
          ),
        ).toBe(true);

        const reusedKitRunRes = evaluateKitRunPassRule({
          fixtures: [moodle],
          executedRecords: [...records, ...globalPassRecords],
          expectedRunId: runId,
          currentWaveId: VALID_WAVE_ID,
          waveEvidence: reusedManifest,
          runDir: validDir,
        });
        expect(reusedKitRunRes.ok).toBe(false);
        expect(reusedKitRunRes.passed).toBe(false);
      } finally {
        fs.rmSync(validDir, { recursive: true, force: true });
      }
    } finally {
      if (prevWaveEnv === undefined) {
        delete process.env.LA_WAVE_ID;
      } else {
        process.env.LA_WAVE_ID = prevWaveEnv;
      }
      fs.rmSync(waveDir, { recursive: true, force: true });
    }
  });

  it('AC-LA-E7-06-02 / A-LA-E7-06-04 / B-LA-E7-06-04: ledger records FAIL before rethrow, preserves duplicate/retried records, counts SKIPs, rejects stale runId, and rejects unselected/unknown channel records', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-ledger-test-'));
    try {
      const runId = 'run-ledger-active';
      initKitRunLedger({ stateDir: tmpDir, runId, channels: ['canvas'] });
      const canvas = loadChannelFixture('canvas');

      // 1. runKitCase records FAIL when the test body throws
      await expect(
        runKitCase(
          'canvas',
          'K1-LAUNCH',
          'L1',
          async () => {
            throw new Error('simulated L1 assertion failure');
          },
          { stateDir: tmpDir, runId },
        ),
      ).rejects.toThrow('simulated L1 assertion failure');

      // 2. A subsequent PASS on the same case ID does NOT overwrite the earlier FAIL
      await runKitCase(
        'canvas',
        'K1-LAUNCH',
        'L1',
        async () => {
          // passes on retry
        },
        { stateDir: tmpDir, runId },
      );

      const allRecs = readAllExecutedCases({ stateDir: tmpDir });
      const l1Recs = allRecs.filter((r) => r.id === 'canvas:K1-LAUNCH:L1');
      expect(l1Recs.map((r) => r.outcome)).toEqual(['FAIL', 'PASS']);

      const rest = buildPassingRecordsForChannel(canvas, runId).filter(
        (r) => r.id !== 'canvas:K1-LAUNCH:L1',
      );
      const evalWithRetry = evaluateChannelPassRule({
        fixture: canvas,
        executedRecords: [...l1Recs, ...rest],
        expectedRunId: runId,
      });
      expect(evalWithRetry.ok).toBe(false);
      expect(evalWithRetry.failedCases).toContain('canvas:K1-LAUNCH:L1');
      expect(evalWithRetry.duplicateOrRetriedCases).toContain('canvas:K1-LAUNCH:L1');

      // 3. Skipped case is counted in skippedCount and fails
      recordSkippedCase('canvas', 'K1-DL', 'D1', 'skipped in test', {
        stateDir: tmpDir,
        runId,
      });
      const withSkip = [
        ...buildPassingRecordsForChannel(canvas, runId).filter(
          (r) => r.id !== 'canvas:K1-DL:D1',
        ),
        ...readAllExecutedCases({ stateDir: tmpDir }).filter(
          (r) => r.id === 'canvas:K1-DL:D1',
        ),
      ];
      const evalSkip = evaluateChannelPassRule({
        fixture: canvas,
        executedRecords: withSkip,
        expectedRunId: runId,
      });
      expect(evalSkip.ok).toBe(false);
      expect(evalSkip.skippedCount).toBe(1);

      // 4. Stale runId record is rejected
      const staleRecords = buildPassingRecordsForChannel(canvas, 'run-old-stale');
      const evalStale = evaluateChannelPassRule({
        fixture: canvas,
        executedRecords: staleRecords,
        expectedRunId: runId,
      });
      expect(evalStale.ok).toBe(false);
      expect(evalStale.staleRunCases.length).toBeGreaterThan(0);

      // 5. Full-run evaluation: passing baseline
      const globalPass: ExecutedCaseRecord[] = computeExpectedGlobalCaseList().map((g) => ({
        id: g.id,
        channelId: 'GLOBAL',
        suite: g.suite,
        code: g.code,
        outcome: 'PASS',
        runId,
      }));
      const fullReport = evaluateKitRunPassRule({
        fixtures: [canvas],
        executedRecords: [...buildPassingRecordsForChannel(canvas, runId), ...globalPass],
        expectedRunId: runId,
        requireH1: true,
      });
      expect(fullReport.ok).toBe(true);

      // 6. Full-run evaluation MUST reject any record with an unselected or unknown channelId (A-LA-E7-06-04 / B-LA-E7-06-04)
      const withUnexpectedFail = evaluateKitRunPassRule({
        fixtures: [canvas],
        executedRecords: [
          ...buildPassingRecordsForChannel(canvas, runId),
          ...globalPass,
          {
            id: 'unexpected:K1-REG:R99',
            channelId: 'unexpected',
            suite: 'K1-REG',
            code: 'R99',
            outcome: 'FAIL',
            runId,
          },
        ],
        expectedRunId: runId,
        requireH1: true,
      });
      expect(withUnexpectedFail.ok).toBe(false);
      expect(withUnexpectedFail.totalFailed).toBe(1);
      expect(
        withUnexpectedFail.globalErrors.some((e) =>
          e.includes('unexpected channel record: unexpected:K1-REG:R99'),
        ),
      ).toBe(true);

      const withUnselectedChannelPass = evaluateKitRunPassRule({
        fixtures: [canvas],
        executedRecords: [
          ...buildPassingRecordsForChannel(canvas, runId),
          ...globalPass,
          {
            id: 'brightspace:K1-LAUNCH:L1',
            channelId: 'brightspace',
            suite: 'K1-LAUNCH',
            code: 'L1',
            outcome: 'PASS',
            runId,
          },
        ],
        expectedRunId: runId,
        requireH1: true,
      });
      expect(withUnselectedChannelPass.ok).toBe(false);
      expect(
        withUnselectedChannelPass.globalErrors.some((e) =>
          e.includes('unexpected channel record: brightspace:K1-LAUNCH:L1'),
        ),
      ).toBe(true);

      const { mdPath, jsonPath } = writeKitRunSummaryArtifacts(fullReport, {
        stateDir: tmpDir,
      });
      expect(fs.existsSync(mdPath)).toBe(true);
      expect(fs.existsSync(jsonPath)).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('A-LA-E7-06-04 / B-LA-E7-06-04: KitSuiteSequencer deterministically orders k-hyg.k1sim.test.ts strictly last', () => {
    const shuffled = [
      '/repo/tests/ltiaas/kit/suites/k-hyg.k1sim.test.ts',
      '/repo/tests/ltiaas/kit/suites/k1-nrps.k1sim.test.ts',
      '/repo/tests/ltiaas/kit/suites/k1-dl.k1sim.test.ts',
      '/repo/tests/ltiaas/kit/suites/k1-reg.k1sim.test.ts',
      '/repo/tests/ltiaas/kit/suites/k1-ags.k1sim.test.ts',
      '/repo/tests/ltiaas/kit/suites/k1-launch.k1sim.test.ts',
      '/repo/tests/ltiaas/kit/suites/k1-cap.k1sim.test.ts',
    ];
    const ordered = orderKitSuiteSpecs(shuffled, (p) => p);
    expect(ordered.map((p) => path.basename(p))).toEqual(
      K1_SIM_SUITE_FILES.map((p) => path.basename(p)),
    );
    expect(path.basename(ordered[ordered.length - 1])).toBe('k-hyg.k1sim.test.ts');
  });

  it('A-LA-E7-06-05: buildOperatorGrantCliArgs, buildOperatorGrantNpmArgs, and parseOperatorGrantOutput match the app:grant contract (cogniate-app-api.md §4.8; cogniate-app-api-delta.md §4)', async () => {
    const canvas = loadChannelFixture('canvas');
    const blackboard = loadChannelFixture('blackboard');
    const generic = loadChannelFixture('lti-generic');
    const brightspace = loadChannelFixture('brightspace');

    // 1. Full npm command uses workspace @cogniate/cogniate-app (README §2 form (f))
    const npmArgs = buildOperatorGrantNpmArgs(
      'lib-1',
      canvas,
      'conn-1',
      'client-canvas-1',
      'dep-1',
    );
    expect(npmArgs.slice(0, 5)).toEqual([
      '--workspace',
      '@cogniate/cogniate-app',
      'run',
      'app:grant',
      '--',
    ]);

    // 2. Canvas initial grant: --service-url, --client-id, --deployment-id, --purpose initial, --note; NEVER --lms
    const canvasInit = buildOperatorGrantCliArgs(
      'lib-1',
      canvas,
      'conn-1',
      'client-canvas-1',
      'dep-1',
    );
    expect(canvasInit).not.toContain('--lms');
    expect(canvasInit).toContain('--service-url');
    expect(canvasInit[canvasInit.indexOf('--service-url') + 1]).toBe(canvas.sim.serviceUrl);
    expect(canvasInit).toContain('--client-id');
    expect(canvasInit[canvasInit.indexOf('--client-id') + 1]).toBe('client-canvas-1');
    expect(canvasInit).toContain('--purpose');
    expect(canvasInit[canvasInit.indexOf('--purpose') + 1]).toBe('initial');
    expect(canvasInit).toContain('--note');

    // 3. Canvas add_deployment: --client-id, --service-url, --purpose add_deployment, --note; NEVER --lms
    const canvasAddDep = buildOperatorGrantCliArgs(
      'lib-1',
      canvas,
      'conn-1',
      'client-canvas-1',
      'dep-2',
      { purpose: 'add_deployment' },
    );
    expect(canvasAddDep).not.toContain('--lms');
    expect(canvasAddDep).toContain('--client-id');
    expect(canvasAddDep).toContain('--service-url');
    expect(canvasAddDep[canvasAddDep.indexOf('--purpose') + 1]).toBe('add_deployment');
    expect(canvasAddDep).toContain('--note');

    // 4. Blackboard initial grant: --client-id, --note, no --service-url, no --issuer, no --lms
    const bbInit = buildOperatorGrantCliArgs(
      'lib-1',
      blackboard,
      'conn-bb',
      'client-bb',
      'dep-bb',
    );
    expect(bbInit).not.toContain('--lms');
    expect(bbInit).toContain('--client-id');
    expect(bbInit).toContain('--note');
    expect(bbInit).not.toContain('--service-url');
    expect(bbInit).not.toContain('--issuer');

    // 5. lti-generic initial manual grant: admin-bound endpoints + --confirm-foreign-hosts + --note
    const genInit = buildOperatorGrantCliArgs(
      'lib-1',
      generic,
      'conn-gen',
      'client-gen',
      'dep-gen-1',
    );
    expect(genInit).not.toContain('--lms');
    expect(genInit).toContain('--client-id');
    expect(genInit).toContain('--issuer');
    expect(genInit).toContain('--auth-url');
    expect(genInit).toContain('--token-url');
    expect(genInit).toContain('--jwks-url');
    expect(genInit).toContain('--confirm-foreign-hosts');
    expect(genInit).toContain('--note');

    // 6. lti-generic acceptStaged: --accept-staged, --confirm-foreign-hosts, --note
    const genStaged = buildOperatorGrantCliArgs(
      'lib-1',
      generic,
      'conn-gen',
      'client-gen',
      'dep-gen-1',
      { acceptStaged: true },
    );
    expect(genStaged).toContain('--accept-staged');
    expect(genStaged).toContain('--confirm-foreign-hosts');
    expect(genStaged).toContain('--note');
    expect(genStaged).not.toContain('--issuer');

    // 7. brightspace initial manual grant: includes --token-audience and --note
    const bsInit = buildOperatorGrantCliArgs(
      'lib-1',
      brightspace,
      'conn-bs',
      'client-bs',
      brightspace.sim.deployments[0],
    );
    expect(bsInit).toContain('--token-audience');
    expect(bsInit[bsInit.indexOf('--token-audience') + 1]).toBe(
      brightspace.sim.tokenAudience,
    );
    expect(bsInit).toContain('--note');

    // 8. Parse documented operator CLI output (cogniate-app-api.md §4.8: 43-char base64url approval code + grt_ id)
    const sample43Code = 'k7Qp9mXz2vL4nR8tY1wB5cF3hJ6kM0pQ9rS2uV4xZ1a';
    expect(sample43Code.length).toBe(43);
    const sampleCliStdout = [
      'Grant id:        grt_01JABCDEF123456789',
      'Library:         lib-1',
      'Connection:      conn-1',
      'Purpose:         initial',
      'Site URL:        https://canvas.sim.test',
      'Client ID:       client-canvas-1',
      'Deployment ID:   dep-1',
      'Expires at:      2026-04-12T10:15:00Z',
      '',
      'Approval code (shown once):',
      `  ${sample43Code}`,
    ].join('\n');

    const parsed = parseOperatorGrantOutput(sampleCliStdout);
    expect(parsed).toEqual({
      id: 'grt_01JABCDEF123456789',
      code: sample43Code,
    });

    // Also test issueOperatorGrantForChannel with an injected runner
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-grant-runner-'));
    const prevRunDir = process.env.LA_RUN_DIR;
    try {
      process.env.LA_RUN_DIR = tmpDir;
      const issued = await issueOperatorGrantForChannel(
        'lib-1',
        canvas,
        'conn-1',
        'client-canvas-1',
        'dep-1',
        { purpose: 'initial' },
        async (_cmd, passedArgs) => {
          expect(passedArgs).not.toContain('--lms');
          expect(passedArgs).toContain('--note');
          return { exitCode: 0, stdout: sampleCliStdout, stderr: '' };
        },
      );
      expect(issued.id).toBe('grt_01JABCDEF123456789');
      expect(issued.code).toBe(sample43Code);
    } finally {
      if (prevRunDir === undefined) {
        delete process.env.LA_RUN_DIR;
      } else {
        process.env.LA_RUN_DIR = prevRunDir;
      }
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    // Negative probe: output without a 43-char base64url token throws
    expect(() => parseOperatorGrantOutput('Grant id: grt_01J123\ncgg_short')).toThrow(
      /Expected one approval code/,
    );
  });

  it('AC-LA-E7-06-08 / A-LA-E7-06-09: PROTOCOL_SECURITY_FAULTS matches all 12 simulator faults and expected error codes from 20-protocol.test.ts', () => {
    expect(PROTOCOL_SECURITY_FAULTS.length).toBe(12);
    expect(PROTOCOL_SECURITY_FAULTS).toEqual([
      ['altered-signature', 'INVALID_SIGNATURE'],
      ['unknown-key', 'INVALID_SIGNATURE'],
      ['unknown-kid', 'INVALID_SIGNATURE'],
      ['none', 'INVALID_ID_TOKEN'],
      ['hs256', 'INVALID_ID_TOKEN'],
      ['wrong-issuer', 'INVALID_ISSUER_OR_AUDIENCE'],
      ['wrong-audience', 'INVALID_ISSUER_OR_AUDIENCE'],
      ['multi-aud-no-azp', 'INVALID_ISSUER_OR_AUDIENCE'],
      ['multi-aud-wrong-azp', 'INVALID_ISSUER_OR_AUDIENCE'],
      ['expired', 'TOKEN_EXPIRED'],
      ['future-iat', 'TOKEN_EXPIRED'],
      ['wrong-nonce', 'INVALID_NONCE'],
    ]);

    // Cross-check against tests/acceptance/M1/blackboard/20-protocol.test.ts and tests/sim/core/crypto.mjs
    const m1ProtoFile = fs.readFileSync(
      path.join(REPO_ROOT, 'tests/acceptance/M1/blackboard/20-protocol.test.ts'),
      'utf8',
    );
    const simCryptoFile = fs.readFileSync(
      path.join(REPO_ROOT, 'tests/sim/core/crypto.mjs'),
      'utf8',
    );
    const simProviderFile = fs.readFileSync(
      path.join(REPO_ROOT, 'tests/sim/core/provider.mjs'),
      'utf8',
    );
    for (const [fault, expectedCode] of PROTOCOL_SECURITY_FAULTS) {
      expect(m1ProtoFile).toContain(`['${fault}', '${expectedCode}']`);
      expect(
        simCryptoFile.includes(`'${fault}'`) || simProviderFile.includes(`'${fault}'`),
      ).toBe(true);
    }
  });

  it('A-LA-E7-06-10 / B-LA-E7-06-08: resolveKitLevel and isK1SimEnabled accept k0, k1sim, k1-sim, and all consistently across vitest.config.mts and runtime.ts', () => {
    expect(resolveKitLevel({ LA_LEVEL: 'k0' } as unknown as NodeJS.ProcessEnv)).toBe('k0');
    expect(resolveKitLevel({ LA_LEVEL: 'k1sim' } as unknown as NodeJS.ProcessEnv)).toBe(
      'k1sim',
    );
    expect(resolveKitLevel({ LA_LEVEL: 'k1-sim' } as unknown as NodeJS.ProcessEnv)).toBe(
      'k1sim',
    );
    expect(resolveKitLevel({ LA_LEVEL: 'all' } as unknown as NodeJS.ProcessEnv)).toBe(
      'all',
    );
    expect(resolveKitLevel({ QA_TASK: 'K1' } as unknown as NodeJS.ProcessEnv)).toBe(
      'k1sim',
    );
    expect(resolveKitLevel({ QA_TASK: 'LA-E7-06' } as unknown as NodeJS.ProcessEnv)).toBe(
      'k1sim',
    );
    expect(resolveKitLevel({} as unknown as NodeJS.ProcessEnv)).toBe('k0');

    expect(isK1SimLevelEnabled({ LA_LEVEL: 'k0' } as unknown as NodeJS.ProcessEnv)).toBe(
      false,
    );
    expect(
      isK1SimLevelEnabled({ LA_LEVEL: 'k1sim' } as unknown as NodeJS.ProcessEnv),
    ).toBe(true);
    expect(
      isK1SimLevelEnabled({ LA_LEVEL: 'k1-sim' } as unknown as NodeJS.ProcessEnv),
    ).toBe(true);
    expect(isK1SimLevelEnabled({ LA_LEVEL: 'all' } as unknown as NodeJS.ProcessEnv)).toBe(
      true,
    );
    expect(isK1SimEnabled({ LA_LEVEL: 'k1sim' } as unknown as NodeJS.ProcessEnv)).toBe(
      true,
    );
    expect(isK1SimEnabled({ LA_LEVEL: 'all' } as unknown as NodeJS.ProcessEnv)).toBe(
      true,
    );

    expect(() =>
      resolveKitLevel({ LA_LEVEL: 'bogus' } as unknown as NodeJS.ProcessEnv),
    ).toThrow(/Unsupported LA_LEVEL=bogus/);
  });

  it('A-LA-E7-06-06 / A-LA-E7-06-07 / B-LA-E7-06-02: case catalog has L1..L10 per channel, L-FAULTS and N2 once per run, and D5/D6 on every channel', () => {
    const globals = computeExpectedGlobalCaseList();
    expect(globals.map((g) => g.id)).toEqual([
      'GLOBAL:K1-LAUNCH:L-FAULTS',
      'GLOBAL:K1-NRPS:N2',
      'GLOBAL:K-HYG:H1',
    ]);

    for (const fixture of loadAllChannelFixtures()) {
      const cases = computeExpectedCaseList(fixture);
      const codes = cases.map((c) => c.code);
      for (let i = 1; i <= 10; i += 1) {
        expect(codes).toContain(`L${i}`);
      }
      expect(codes).not.toContain('L-FAULTS');

      for (const dCode of ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8']) {
        const dCase = cases.find((c) => c.code === dCode);
        expect(dCase?.expectedStatus).toBe('RUN');
      }

      for (let i = 1; i <= 6; i += 1) {
        expect(cases.find((c) => c.code === `A${i}`)?.expectedStatus).toBe('RUN');
      }

      expect(cases.find((c) => c.code === 'N1')?.expectedStatus).toBe('RUN');
      expect(codes).not.toContain('N2');
    }
  });

  it('A-LA-E7-06-07 / A-LA-E7-06-08 / B-LA-E7-06-02 / B-LA-E7-06-07: suites call the tested case bodies; no fixture self-comparison, external placement comparison, plural picker field or fabricated picker status', () => {
    const runtimeSrc = fs.readFileSync(path.join(__dirname, 'lib/runtime.ts'), 'utf8');
    // Frozen M1 helpers are imported, not copied
    expect(runtimeSrc).toContain("from '../../../acceptance/M1/common/client.js'");
    expect(runtimeSrc).toContain("from '../../../acceptance/M1/common/course.js'");
    expect(runtimeSrc).toContain("from '../../../acceptance/lib/paths.js'");
    expect(runtimeSrc).not.toContain('cogniate_staff_session');
    expect(runtimeSrc).not.toContain('x-service-api-key');
    // C2 keeps both no-network oracles
    expect(runtimeSrc).toContain('await noServiceCalls(cursor)');
    expect(runtimeSrc).toContain("logEvents('outbound_request'");
    // The picker wrapper keeps the observed status (no 303 -> 200 rewrite)
    expect(runtimeSrc).toContain('followPickerHandoff(');
    expect(runtimeSrc).not.toMatch(/===\s*pickerUrl\s*\?\s*200/);

    const launchSrc = fs.readFileSync(path.join(SUITES_DIR, 'k1-launch.k1sim.test.ts'), 'utf8');
    expect(launchSrc).toContain('runFamilyGuardCase(');
    expect(launchSrc).toContain('runPlatformStorageCase(');
    expect(launchSrc).toContain('verifyContextlessSharedPlacement(');
    expect(launchSrc).toContain('collectContextlessPlacementObservation(');
    // The external resource_link.id is used only in the launch patches, never in a comparison
    const sharedRlUses = launchSrc.split('\n').filter((line) => line.includes('sharedRlId'));
    expect(sharedRlUses.every((line) => /const sharedRlId =|resourceLinkId: sharedRlId,/.test(line))).toBe(true);
    expect(launchSrc).not.toMatch(/toBe\(sharedRlId\)/);
    expect(launchSrc).toContain("'No gradebook column: the activity has no AGS line item.'");
    expect(launchSrc).toContain('expect(bA.library).not.toBe(bB.library)');
    expect(launchSrc).toContain('selectProtocolControlFixture(allFixtures)');
    expect(launchSrc).not.toContain('pendingId');

    const dlSrc = fs.readFileSync(path.join(SUITES_DIR, 'k1-dl.k1sim.test.ts'), 'utf8');
    expect(dlSrc).toContain('buildPickerSelectionForm(');
    expect(dlSrc).not.toContain("'publicationIds'");

    const agsSrc = fs.readFileSync(path.join(SUITES_DIR, 'k1-ags.k1sim.test.ts'), 'utf8');
    expect(agsSrc).toContain('for (const errStatus of [400, 404, 422])');
    expect(agsSrc).toContain("'has a grade with a newer time'");
    expect(agsSrc).toContain('waitForLearnerSync(');
    expect(agsSrc).toContain('waitForThrottledDispatch(');
    expect(agsSrc).toContain("logEvents('dispatch_throttled'");
    expect(agsSrc).not.toContain("waitSync(binding, pub503, 'pending')");

    const capSrc = fs.readFileSync(path.join(SUITES_DIR, 'k1-cap.k1sim.test.ts'), 'utf8');
    expect(capSrc).not.toMatch(/loadChannelManifestCapabilities|manifestCapabilities/);
    expect(capSrc).not.toContain('toolCfgRes.json.fields');

    const regSrc = fs.readFileSync(path.join(SUITES_DIR, 'k1-reg.k1sim.test.ts'), 'utf8');
    expect(regSrc).toContain('expect(previewRes.json.endpointsOnIssuerOrigin).toBe(false)');
    expect(regSrc).toContain('expect(completeRes.json.active).toBe(false)');
    expect(regSrc).toContain("denied(unapprovedLaunch.response, 'PLATFORM_NOT_ACTIVE', 403)");
    expect(regSrc).toContain('PLATFORM_URL_NOT_ON_ISSUER_ORIGIN');
    expect(regSrc).toContain('PLATFORM_URL_NOT_IN_PROFILE');
  });

  it('A-LA-E7-06-08 (C1 operand): C1 compares the registry entry and the connection DTO with the fixture, so a registry capability that differs from the fixture fails', () => {
    for (const fixture of loadAllChannelFixtures()) {
      // Registry answer (GET /app-api/lms-providers entry, cogniate-app-api-delta.md §2) and connection
      // DTO (§1) shaped from the documented example; one registry value differs from the fixture.
      const registry = structuredClone(fixture.capabilities) as unknown as Record<string, unknown>;
      registry['launch.windowHint'] = !fixture.capabilities['launch.windowHint'];
      const input: BilateralEqualityInput = {
        fixture,
        providerChannelCapabilities: registry,
        providerLegacyFlags: { ...fixture.expect.legacyFlags },
        connectionChannelCapabilities: structuredClone(fixture.capabilities) as unknown as Record<
          string,
          unknown
        >,
        connectionLegacyFlags: { ...fixture.expect.legacyFlags },
        toolConfigurationKeys: [...fixture.expect.toolConfigurationKeys],
      };
      const res = verifyBilateralCapabilities(input);
      expect(res.ok).toBe(false);
      expect(res.errors).toEqual([
        expect.stringContaining('GET /app-api/lms-providers channelCapabilities["launch.windowHint"]'),
      ]);
      // An extra registry key fails the other direction
      const extra = verifyBilateralCapabilities({
        ...input,
        providerChannelCapabilities: { ...structuredClone(fixture.capabilities), 'zz.extra': true },
      });
      expect(extra.errors).toEqual([expect.stringContaining('unknown capability key "zz.extra"')]);
    }
  });

  it('A-LA-E7-06-09: selectProtocolControlFixture selects lti-generic (generic-sim) and throws when missing or duplicated', () => {
    const all = loadAllChannelFixtures();
    const control = selectProtocolControlFixture(all);
    expect(control.id).toBe('lti-generic');
    expect(control.simProvider).toBe('generic-sim');
    expect(control.simProfile).toBe('lti-generic');

    // Never falls back to fixtures[0] (moodle) when lti-generic is absent
    const withoutGeneric = all.filter((f) => f.id !== 'lti-generic');
    expect(() => selectProtocolControlFixture(withoutGeneric)).toThrow(
      /Expected exactly 1 generic-sim protocol-control fixture/,
    );

    // Refuses ambiguous duplicate matches
    expect(() => selectProtocolControlFixture([...all, structuredClone(control)])).toThrow(
      /Expected exactly 1 generic-sim protocol-control fixture/,
    );
  });

  it('A-LA-E7-06-07 / B-LA-E7-06-02 (L4): fixture guard data equals LA-ADR-01 D6, and the L4 selector picks probes from the declared guard levels for every target', () => {
    const all = loadAllChannelFixtures();
    // Fixture guard declarations of the baseline channels equal the frozen design table
    for (const fixture of all.filter((f) =>
      (BASELINE_CHANNEL_IDS as readonly string[]).includes(f.id),
    )) {
      const designed = Object.entries(DESIGN_FAMILY_GUARDS)
        .filter(([, g]) => g.channel === fixture.id)
        .map(([family, g]) => ({ family, level: g.level }));
      expect(fixture.expect.guardedFamilies).toEqual(designed);
      expect(fixture.capabilities['binding.authority'].manual === 'self').toBe(
        DESIGN_MANUAL_SELF_LEGACY.includes(fixture.id),
      );
    }

    const table = (id: string) =>
      selectFamilyGuardProbes(loadChannelFixture(id), all).probes.map(
        (p) => `${p.foreignFamily}:${p.foreignFamilyCategory}:${p.expectedOutcome}`,
      );
    // Round 4 counterexamples: Blackboard gets a launch-guarded probe (no undefined), Canvas gets
    // desire2learn (not moodle) as its registration-guarded probe, and moodle is unguarded.
    expect(table('moodle')).toEqual([
      'canvas:launch_guarded:refuse',
      'desire2learn:registration_guarded:refuse',
      'generic:unguarded:pass',
    ]);
    expect(table('canvas')).toEqual([
      'blackboardlearn:launch_guarded:refuse',
      'desire2learn:registration_guarded:warn_passthrough',
      'moodle:unguarded:pass',
    ]);
    expect(table('blackboard')).toEqual([
      'canvas:launch_guarded:refuse',
      'desire2learn:registration_guarded:warn_passthrough',
      'moodle:unguarded:pass',
    ]);
    expect(table('lti-generic')).toEqual([
      'canvas:launch_guarded:refuse',
      'desire2learn:registration_guarded:warn_passthrough',
      'moodle:unguarded:pass',
    ]);
    expect(table('brightspace')).toEqual(['canvas:launch_guarded:refuse', 'moodle:unguarded:pass']);
    expect(selectFamilyGuardProbes(loadChannelFixture('brightspace'), all).notes[0]).toContain(
      'no family that another channel guards at the registration level',
    );
    expect(deriveExpectedFamilyGuardOutcome(loadChannelFixture('canvas'), 'moodle', all).expectedOutcome).toBe('pass');

    // Every discovered fixture (open world) gets a launch-guarded probe
    for (const fixture of all) {
      expect(selectFamilyGuardProbes(fixture, all).probes[0].foreignFamilyCategory).toBe('launch_guarded');
    }
    // Missing launch-guard fixtures give an explicit diagnostic, not a crash on undefined
    const noLaunchGuards = all.filter((f) => !f.expect.guardedFamilies.some((g) => g.level === 'launch'));
    expect(() => selectFamilyGuardProbes(loadChannelFixture('moodle'), noLaunchGuards)).toThrow(
      /no family that another channel guards at the launch level/,
    );
    // A family guarded at two levels is a fixture error
    const conflicting = structuredClone(all);
    conflicting.find((f) => f.id === 'lti-generic')!.expect.guardedFamilies = [
      { family: 'canvas', level: 'registration' },
    ];
    expect(() => buildFamilyGuardMap(conflicting)).toThrow(/guarded at two levels/);

    // Observation oracle: exact error page, LTI log presence and absence
    const refuse = deriveExpectedFamilyGuardOutcome(loadChannelFixture('moodle'), 'canvas', all);
    expect(validateFamilyGuardLaunchObservation(refuse, { status: 400, body: 'PROVIDER_PROFILE_MISMATCH' }).ok).toBe(false);
    expect(
      validateFamilyGuardLaunchObservation(refuse, {
        status: 400,
        body: '<main data-error-code="PROVIDER_PROFILE_MISMATCH">',
      }).ok,
    ).toBe(true);
  });

  it('A-LA-E7-06-07 / B-LA-E7-06-02 (L4): the L4 case body passes on a check-14 fake for every shipped target and fails on wrong product behaviour', async () => {
    const all = loadAllChannelFixtures();
    for (const fixture of all.filter((f) =>
      (BASELINE_CHANNEL_IDS as readonly string[]).includes(f.id),
    )) {
      const fake = makeCheck14Fake(fixture.id, `plt_${fixture.id}`);
      const report = await runFamilyGuardCase(
        { target: fixture, allFixtures: all, platformId: `plt_${fixture.id}`, resourceId: 'pub_k0' },
        fake.io,
      );
      expect(report.probes.map((p) => p.expected.foreignFamily)).toEqual(fake.launched);
    }

    const canvas = loadChannelFixture('canvas');
    const moodle = loadChannelFixture('moodle');
    const run = (target: ChannelFixture, mutant: Check14Mutant) =>
      runFamilyGuardCase(
        { target, allFixtures: all, platformId: `plt_${target.id}`, resourceId: 'pub_k0' },
        makeCheck14Fake(target.id, `plt_${target.id}`, mutant).io,
      );
    // A registration-level family refused on a non-legacy platform
    await expect(run(canvas, 'refuseRegistration')).rejects.toThrow(/expected 303/);
    // The warning only in the app log: L4 reads the LTI service log with the platform filter
    await expect(run(canvas, 'appLogOnly')).rejects.toThrow(/expected an LTI log family_guard_mismatch/);
    await expect(run(canvas, 'noLog')).rejects.toThrow(/expected an LTI log family_guard_mismatch/);
    // A launch-level family that passes on a foreign platform
    await expect(run(moodle, 'passLaunchGuard')).rejects.toThrow(/expected 400 refusal/);
    // An unguarded family that the product treats as guarded
    await expect(run(canvas, 'guardMoodle')).rejects.toThrow(/expected no family_guard_mismatch log/);
  });

  it('A-LA-E7-06-07 / B-LA-E7-06-02 (L7): the L7 verdict accepts contract-shaped answers with an internal placement id and rejects the round 4 counterexamples', () => {
    const ok = verifyContextlessSharedPlacement(collectContextlessPlacementObservation(contractL7Raw()));
    expect(ok.errors).toEqual([]);
    expect(ok.ok).toBe(true);
    // The placement id is the internal `rl_...` value; the launch resource_link.id is not an input
    expect(ok.placementId).toBe('rl_9f2c41');

    const verdict = (mutate: (raw: ReturnType<typeof contractL7Raw>) => void) => {
      const raw = contractL7Raw();
      mutate(raw);
      return verifyContextlessSharedPlacement(collectContextlessPlacementObservation(raw));
    };
    // B: a second result row for the same learner and placement
    const dupRow = verdict((raw) => raw.rows.push(structuredClone(raw.rows[0])));
    expect(dupRow.ok).toBe(false);
    expect(dupRow.errors.join('\n')).toContain('duplicate result rows for learner1');
    // B: both score calls go to another line item of the same publication
    const otherLineItem = verdict((raw) => {
      for (const rec of raw.simRecords.filter((r) => r.kind === 'score')) {
        rec.path = '/lti/courses/course-1/lineitems/other-item/scores';
      }
    });
    expect(otherLineItem.ok).toBe(false);
    expect(otherLineItem.errors.filter((e) => e.includes('expected the launch line item')).length).toBe(2);
    // Two placements for the same launch resource link: two internal ids ...
    const twoIds = verdict((raw) => {
      raw.rows[1].activity.resourceLinkId = 'rl_77aa01';
    });
    expect(twoIds.errors.join('\n')).toContain('name 2 placements');
    // ... or one shared id with two placements counted on the publication
    const twoCounted = verdict((raw) => {
      raw.publication.stats.activities = 2;
    });
    expect(twoCounted.errors.join('\n')).toContain('stats.activities is 2');
    // A learner without a sent sync, or without a score call
    const unsent = verdict((raw) => {
      raw.rows[1].scoreSyncs = [{ id: 'sync_u2', status: 'failed', tries: 1 }];
    });
    expect(unsent.errors.join('\n')).toContain('learner2 ("u2") has no scoreSyncs entry with status="sent"');
    const noCall = verdict((raw) => {
      raw.simRecords = raw.simRecords.filter((r) => r.body?.userId !== 'u2');
    });
    expect(noCall.errors.join('\n')).toContain('missing simulator score call for learner2');
    // A launch without a line item
    const noLineItem = verdict((raw) => {
      raw.idToken2 = { services: { assignmentAndGrades: { available: false } } } as never;
    });
    expect(noLineItem.errors.join('\n')).toContain('learner2 launch has no valid services.assignmentAndGrades.lineItemId');
  });

  it('A-LA-E7-06-08 / B-LA-E7-06-07 (L10): the L10 case body completes on a contract-shaped storage fake and sends {check, value} with the LTI Origin', async () => {
    for (const id of ['canvas', 'lti-generic']) {
      const fixture = loadChannelFixture(id);
      expect(fixture.sim.platformStorage).toBeTruthy();
      const fake = makeStorageContractFake({ storageProfile: true, authEndpoint: fixture.sim.authEndpoint });
      const report = await runPlatformStorageCase(storageCaseCtx(fixture, fake.ltiUrl), fake.io);
      expect(report.storagePath).toBe(true);
      expect(report.steps.length).toBe(9);
      // Every storage-check request has exactly the documented fields; the accepted one has our Origin
      expect(fake.checkRequests.every((r) => JSON.stringify(r.fields) === '["check","value"]')).toBe(true);
      expect(fake.checkRequests.filter((r) => r.status === 303)).toEqual([
        { fields: ['check', 'value'], origin: fake.ltiOrigin, status: 303 },
      ]);
    }
    for (const id of ['moodle', 'blackboard', 'brightspace']) {
      const fixture = loadChannelFixture(id);
      expect(fixture.sim.platformStorage).toBeNull();
      const fake = makeStorageContractFake({ storageProfile: false, authEndpoint: fixture.sim.authEndpoint });
      const report = await runPlatformStorageCase(storageCaseCtx(fixture, fake.ltiUrl), fake.io);
      expect(report.storagePath).toBe(false);
    }
  });

  it('A-LA-E7-06-08 / B-LA-E7-06-07 (L10): escaped JSON pages, script-built check form, and wrong storage behaviour', async () => {
    const canvas = loadChannelFixture('canvas');
    const fake = makeStorageContractFake({ storageProfile: true, authEndpoint: canvas.sim.authEndpoint });
    const plain = await fake.io.beginLaunch({ clientId: 'c1' });
    const login = await fake.io.beginLaunch({ clientId: 'c1', storageTarget: 'post_message_forwarding' });
    // Round 4 counterexample: a regex over the raw HTML keeps `&` and loses the state parameter
    expect(login.login.body).not.toContain('&state=');
    const legacy = login.login.body.match(/https:\/\/[^\s"'<>]+authorize[^\s"'<>]*/)![0];
    expect(new URL(legacy).searchParams.get('state')).toBeNull();
    // Parsing the one JSON block gives the auth URL on the 302 Location's endpoint, with its state
    const authUrl = findStorageAuthUrl(readStoragePageJson(login.login.body), plain.location);
    expect(new URL(authUrl).searchParams.get('state')).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    // Round 4 counterexample: the storage-check page has no static form for the frozen parseForm
    const authorized = parseForm((await fake.io.request(authUrl)).body);
    const checkPage = await fake.io.formPost(authorized.action, authorized.fields);
    expect(() => parseForm(checkPage.body)).toThrow(/HTML form action present/);
    expect(readStorageCheckToken(checkPage.body)).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    expect(() => readStoragePageJson('<html><body>no block</body></html>')).toThrow(/exactly one/);
    // Launch check failures: an error page with status 400 or 401 and no redirect (security.md §2.2)
    const page = (status: number, headers: Record<string, unknown> = {}) => ({
      status,
      headers,
      body: '<main data-error-code="INVALID_SIGNATURE" data-trace-id="tr_k0"></main>',
    });
    expect(() => launchRefused(page(400), 'INVALID_SIGNATURE')).not.toThrow();
    expect(() => launchRefused(page(401), 'INVALID_SIGNATURE')).not.toThrow();
    expect(() => launchRefused(page(403), 'INVALID_SIGNATURE')).toThrow(/expected 400 or 401/);
    expect(() => launchRefused(page(400, { location: 'https://app.cogniate.test/' }), 'INVALID_SIGNATURE')).toThrow();
    expect(() => launchRefused(page(400), 'INVALID_STATE')).toThrow();

    // Wrong product behaviour fails the case body
    const run = (fixture: ChannelFixture, storageProfile: boolean, mutant?: StorageMutant) => {
      const f = makeStorageContractFake({ storageProfile, authEndpoint: fixture.sim.authEndpoint, mutant });
      return runPlatformStorageCase(storageCaseCtx(fixture, f.ltiUrl), f.io);
    };
    await expect(run(canvas, true, 'replayAccepted')).rejects.toThrow();
    await expect(run(canvas, true, 'wrongValueAccepted')).rejects.toThrow();
    await expect(run(canvas, true, 'noCheckLog')).rejects.toThrow(/no LTI log launch_check_failed/);
    await expect(run(canvas, true, 'ignoreTarget')).rejects.toThrow(/expected the 200 login page/);
    await expect(run(canvas, false)).rejects.toThrow(/expected the 200 login page/);
    await expect(run(loadChannelFixture('moodle'), true)).rejects.toThrow(/platformStorage-null profile answered 200/);
  });

  it('A-LA-E7-06-08 / B-LA-E7-06-07 (picker): the picker handoff keeps the observed status; a redirect loop stays 303', async () => {
    const launch: HttpResultLike = {
      status: 303,
      headers: { location: 'https://app.cogniate.test/tool/deep-link?ltik=k0' },
      body: '',
    };
    const app = 'https://app.cogniate.test';
    const serve = (pages: Record<string, HttpResultLike>) => async (url: string) => {
      const u = new URL(url);
      return pages[`${u.pathname}${u.search}`] ?? { status: 404, headers: {}, body: '' };
    };
    const handoff: HttpResultLike = { status: 303, headers: { location: '/tool/picker/pck_k0' }, body: '' };

    const normal = await followPickerHandoff(
      launch,
      serve({
        '/tool/deep-link?ltik=k0': handoff,
        '/tool/picker/pck_k0': { status: 200, headers: {}, body: '<input type="radio" value="pub_1">' },
      }),
      app,
    );
    expect(normal.status).toBe(200);
    expect(normal.pickerUrl).toBe(`${app}/tool/picker/pck_k0`);

    const loop = await followPickerHandoff(
      launch,
      serve({
        '/tool/deep-link?ltik=k0': handoff,
        '/tool/picker/pck_k0': { status: 303, headers: { location: '/tool/picker/pck_k0' }, body: '' },
      }),
      app,
    );
    expect(loop.status).toBe(303);
    expect(loop.page.status).toBe(303);
    expect(loop.html).toBe('');

    const refused = await followPickerHandoff(
      launch,
      serve({
        '/tool/deep-link?ltik=k0': { ...fakeErrorPage('ROLE_NOT_ALLOWED'), status: 403 },
      }),
      app,
    );
    expect(refused.status).toBe(403);
    expect(refused.html).toContain('ROLE_NOT_ALLOWED');
  });

  it('A-LA-E7-06-08 (D3): picker selection uses the repeated publicationId field and keeps the picker list order', () => {
    expect(PICKER_SELECTION_FIELD).toBe('publicationId');
    const form = buildPickerSelectionForm(['pub_c', 'pub_a', 'pub_b']);
    const body = new URLSearchParams(form).toString();
    // The picker route reads repeated `publicationId` (cogniate-app-api.md §6; LA-ADR-05 D3b)
    expect(new URLSearchParams(body).getAll('publicationId')).toEqual(['pub_c', 'pub_a', 'pub_b']);
    // Round 4 counterexample: the plural field gives the route zero ids
    const plural = new URLSearchParams([['publicationIds', 'pub_a'], ['publicationIds', 'pub_b']]).toString();
    expect(new URLSearchParams(plural).getAll('publicationId')).toEqual([]);

    const picker =
      '<label><input type="checkbox" name="publicationId" value="pub_c">C</label>' +
      '<label><input type="checkbox" name="publicationId" value="pub_a">A</label>' +
      '<label><input type="checkbox" name="publicationId" value="pub_b">B</label>';
    expect(orderByPickerList(picker, ['pub_a', 'pub_b', 'pub_c'])).toEqual(['pub_c', 'pub_a', 'pub_b']);
    expect(() => orderByPickerList(picker, ['pub_x'])).toThrow(/not listed/);
    expect(
      contentItemPublicationIds([
        { type: 'ltiResourceLink', url: 'https://lti.cogniate.test/lti/launch/cogniate?resource=pub_c' },
        { type: 'ltiResourceLink', url: 'https://lti.cogniate.test/lti/launch/cogniate?resource=pub_a' },
      ]),
    ).toEqual(['pub_c', 'pub_a']);
  });

  it('B-LA-E7-06-02 (A3): the A3 waits return only after a tried send', async () => {
    const clock = fakeClock();
    const row = (tries: number, status = 'pending') => [
      { learner: { sub: 'u503' }, scoreSyncs: [{ id: 'sync_1', status, tries }] },
    ];
    // Round 4 counterexample: a new row is `pending` with tries 0 before its first send
    const sequence = [[], row(0), row(0), row(1)];
    let reads = 0;
    const tried = await waitForLearnerSync(
      { readRows: async () => sequence[Math.min(reads++, sequence.length - 1)], now: clock.now, sleep: clock.sleep },
      'u503',
      (sync) => Number(sync.tries ?? 0) >= 1,
      'a tried send (tries >= 1)',
    );
    expect(sequence[1][0].scoreSyncs[0]).toMatchObject({ status: 'pending', tries: 0 });
    expect(tried.sync).toMatchObject({ status: 'pending', tries: 1 });
    expect(tried.reads).toBe(4);
    await expect(
      waitForLearnerSync(
        { readRows: async () => row(0), now: clock.now, sleep: clock.sleep },
        'u503',
        (sync) => Number(sync.tries ?? 0) >= 1,
        'a tried send (tries >= 1)',
      ),
    ).rejects.toThrow(/no score sync of learner "u503" shows a tried send/);

    // 429: the row is pending with tries 0 before and after the send; wait for the score call and event
    let step = 0;
    const throttled = await waitForThrottledDispatch(
      {
        readRows: async () => [{ learner: { sub: 'u429' }, scoreSyncs: [{ status: 'pending', tries: 0 }] }],
        readScoreCalls: async () => (step >= 2 ? [{ kind: 'score', body: { userId: 'u429' } }] : []),
        throttleEvents: () => (step++ >= 2 ? [{ event: 'dispatch_throttled' }] : []),
        now: clock.now,
        sleep: clock.sleep,
      },
      'u429',
    );
    expect(throttled.reads).toBe(3);
    expect(throttled.scoreCalls.length).toBe(1);
    expect(throttled.sync).toMatchObject({ status: 'pending', tries: 0 });
    await expect(
      waitForThrottledDispatch(
        {
          readRows: async () => [{ learner: { sub: 'u429' }, scoreSyncs: [{ status: 'pending', tries: 0 }] }],
          readScoreCalls: async () => [],
          throttleEvents: () => [],
          now: clock.now,
          sleep: clock.sleep,
        },
        'u429',
      ),
    ).rejects.toThrow(/no throttled send seen/);
  });

  it('AC-LA-E7-06-06 / A-LA-E7-06-03 / B-LA-E7-06-05: K-HYG secret scanner fails on missing inputs and catches leaks in logs, /__sim/records, and nested artifacts', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-hyg-scan-'));
    try {
      const plantedSecret = 'super-secret-bearer-token-xyz987654321';
      recordSecret(plantedSecret, { stateDir: tmpDir });
      recordRedactedEvidence('nested/sub/clean-evidence', { ok: true }, { stateDir: tmpDir });

      const cleanFetch = async (url: string) => {
        if (url.endsWith('/__sim/secrets')) {
          return { status: 200, json: { values: [plantedSecret] } };
        }
        if (url.includes('/__sim/records')) {
          return { status: 200, json: { cursor: 1, records: [{ kind: 'auth', ok: true }] } };
        }
        return { status: 404, json: null };
      };
      const cleanLogs = () => 'INFO: service started cleanly with redacted logs';

      // 1. All inputs present and clean -> PASS
      const cleanScan = await scanAllLogsAndArtifactsForSecrets({
        artifactRoot: tmpDir,
        fetchImpl: cleanFetch,
        readServiceLogImpl: cleanLogs,
      });
      expect(cleanScan.missingInputs).toEqual([]);
      expect(cleanScan.hits).toEqual([]);
      expect(cleanScan.ok).toBe(true);

      // 2. Missing service log -> FAIL
      const missingLogScan = await scanAllLogsAndArtifactsForSecrets({
        artifactRoot: tmpDir,
        fetchImpl: cleanFetch,
        readServiceLogImpl: (svc) => (svc === 'lti-service' ? '' : 'INFO: ok'),
      });
      expect(missingLogScan.ok).toBe(false);
      expect(missingLogScan.missingInputs).toContain('service:lti-service');

      // 3. Missing /__sim/records -> FAIL
      const missingRecordsScan = await scanAllLogsAndArtifactsForSecrets({
        artifactRoot: tmpDir,
        fetchImpl: async (url) =>
          url.endsWith('/__sim/secrets')
            ? { status: 200, json: { values: [plantedSecret] } }
            : { status: 500, json: null },
        readServiceLogImpl: cleanLogs,
      });
      expect(missingRecordsScan.ok).toBe(false);
      expect(missingRecordsScan.missingInputs).toContain('sim:records');

      // 4. Missing /__sim/secrets -> FAIL
      const missingSecretsScan = await scanAllLogsAndArtifactsForSecrets({
        artifactRoot: tmpDir,
        fetchImpl: async (url) =>
          url.includes('/__sim/records')
            ? { status: 200, json: { cursor: 1, records: [{ kind: 'auth' }] } }
            : { status: 500, json: null },
        readServiceLogImpl: cleanLogs,
      });
      expect(missingSecretsScan.ok).toBe(false);
      expect(missingSecretsScan.missingInputs).toContain('sim:secrets');

      // 5. Missing redacted evidence tree -> FAIL
      const emptyArtifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-hyg-empty-'));
      try {
        const missingEvidenceScan = await scanAllLogsAndArtifactsForSecrets({
          artifactRoot: emptyArtifactDir,
          fetchImpl: cleanFetch,
          readServiceLogImpl: cleanLogs,
        });
        expect(missingEvidenceScan.ok).toBe(false);
        expect(missingEvidenceScan.missingInputs).toContain('artifact:redacted-evidence');
      } finally {
        fs.rmSync(emptyArtifactDir, { recursive: true, force: true });
      }

      // 6. Planted leak in service log -> FAIL with hit in service:cogniate-app
      const leakInLogScan = await scanAllLogsAndArtifactsForSecrets({
        artifactRoot: tmpDir,
        fetchImpl: cleanFetch,
        readServiceLogImpl: (svc) =>
          svc === 'cogniate-app' ? `WARN leaked ${plantedSecret} in log` : 'INFO: clean',
      });
      expect(leakInLogScan.ok).toBe(false);
      expect(leakInLogScan.hits).toEqual([
        { source: 'service:cogniate-app', secretPrefix: `${plantedSecret.slice(0, 6)}...` },
      ]);

      // 7. Planted leak in /__sim/records -> FAIL with hit in sim:records
      const leakInSimRecordsScan = await scanAllLogsAndArtifactsForSecrets({
        artifactRoot: tmpDir,
        fetchImpl: async (url) =>
          url.endsWith('/__sim/secrets')
            ? { status: 200, json: { values: [plantedSecret] } }
            : {
                status: 200,
                json: { cursor: 1, records: [{ kind: 'debug', raw: plantedSecret }] },
              },
        readServiceLogImpl: cleanLogs,
      });
      expect(leakInSimRecordsScan.ok).toBe(false);
      expect(leakInSimRecordsScan.hits).toEqual([
        { source: 'sim:records', secretPrefix: `${plantedSecret.slice(0, 6)}...` },
      ]);

      // 8. Planted leak in nested subdirectory evidence/deep/redacted.json -> FAIL with hit in artifact
      const nestedDir = path.join(tmpDir, 'evidence', 'deep');
      fs.mkdirSync(nestedDir, { recursive: true });
      fs.writeFileSync(
        path.join(nestedDir, 'redacted.json'),
        JSON.stringify({ note: `accidental leak ${plantedSecret}` }),
        'utf8',
      );
      const leakInArtifactScan = await scanAllLogsAndArtifactsForSecrets({
        artifactRoot: tmpDir,
        fetchImpl: cleanFetch,
        readServiceLogImpl: cleanLogs,
      });
      expect(leakInArtifactScan.ok).toBe(false);
      expect(
        leakInArtifactScan.hits.some((h) => h.source.includes('evidence/deep/redacted.json')),
      ).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
