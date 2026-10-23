// LA-E3-06 K1-SIM suite: NRPS scope complete.scopes and the registration.complete audit event.
// Sources:
// - docs/architecture/ltiaas/tasks/LA-E3-06.md (AC-LA-E3-06-01 .. AC-LA-E3-06-06)
// - docs/architecture/ltiaas/adr/LA-ADR-05-lti-advantage-completeness.md D4 (AP-05-21, AP-05-22)
// - docs/architecture/ltiaas/contracts/lti-service-api-delta.md §4.5, §5 (registration.complete)
// - docs/architecture/ltiaas/adr/LA-ADR-06-service-operability.md D4 (AP-06-14)
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { publicUrls } from '../../../acceptance/lib/env';
import { httpsRequest, type HttpResult } from '../../../acceptance/lib/https';
import {
  ACCOUNT,
  apiKey,
  auth,
  errorCode,
  eventsSince,
  hasErrorShape,
  LAUNCH_URL,
  LOGIN_URL,
  ltiApi,
  recordSecret,
} from '../../../acceptance/lib/lti';
import { QA_FIXTURE_DIR, QA_ISSUER } from '../../../acceptance/lib/qa-platform';
import { seed } from '../../../acceptance/lib/seed';
import { OPERATOR_KEY_RE, readOperatorKey } from '../../tasks-ops/LA-E5-01/operator';
import { actorTag, listAudit } from '../../tasks-ops/LA-E5-02/audit-client';

const urls = publicUrls();
const runId = `${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;

const FOUR_AGS_SCOPES = [
  'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
  'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
  'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
  'https://purl.imsglobal.org/spec/lti-ags/scope/score',
] as const;

const NRPS_SCOPE = 'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly';

const FIVE_ADR009_SCOPES = [...FOUR_AGS_SCOPES, NRPS_SCOPE] as const;

const tenantActorRe = (account: string) =>
  new RegExp(`^api_key:(bootstrap-${account}|key_[A-Za-z0-9_-]+)$`);

interface SimRecord {
  seq: number;
  ts: string;
  kind: string;
  provider?: string;
  host?: string;
  method?: string;
  path?: string;
  scope?: string;
  scopes?: string[];
  body?: Record<string, unknown>;
  [k: string]: unknown;
}

async function simJson<T = Record<string, unknown>>(
  pathname: string,
  method = 'GET',
  body?: unknown,
): Promise<{ status: number; json: T }> {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  const res = await httpsRequest(`https://lms-sim.test${pathname}`, {
    method,
    headers: payload
      ? { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(payload)) }
      : undefined,
    body: payload,
  });
  return { status: res.status, json: (res.body ? JSON.parse(res.body) : {}) as T };
}

/** Plain-HTTPS Moodle admin session (no browser). */
async function moodleAdminSession() {
  const jar = new Map<string, string>();
  const request = async (
    url: string,
    method = 'GET',
    fields?: Record<string, string>,
  ): Promise<HttpResult> => {
    expect(new URL(url).origin).toBe(urls.moodle);
    const res = await httpsRequest(url, {
      method,
      headers: {
        cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
        ...(fields ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
      },
      body: fields ? new URLSearchParams(fields).toString() : undefined,
    });
    for (const raw of [res.headers['set-cookie'] ?? []].flat()) {
      const pair = raw.split(';')[0];
      const at = pair.indexOf('=');
      if (/Max-Age=0/i.test(raw)) jar.delete(pair.slice(0, at));
      else jar.set(pair.slice(0, at), pair.slice(at + 1));
    }
    return res;
  };
  const admin = seed().users.admin;
  const page = await request(`${urls.moodle}/login/index.php`);
  const logintoken = /name="logintoken" value="([^"]+)"/.exec(page.body)?.[1];
  expect(logintoken, `Moodle login page has logintoken (HTTP ${page.status})`).toBeTruthy();
  const login = await request(`${urls.moodle}/login/index.php`, 'POST', {
    username: admin.username,
    password: admin.password,
    logintoken: logintoken!,
    anchor: '',
  });
  expect([301, 302, 303]).toContain(login.status);
  await request(new URL(String(login.headers.location), urls.moodle).href);
  const tools = await request(`${urls.moodle}/mod/lti/toolconfigure.php`);
  expect(tools.status).toBe(200);
  const sesskey = /"sesskey":"([^"]+)"/.exec(tools.body)?.[1];
  expect(sesskey, 'Manage tools page has sesskey').toBeTruthy();
  return { request, sesskey: sesskey! };
}

async function startMoodleDrSession(registrationUrl: string): Promise<{
  registrationId: string;
  readToolServices: (deploymentId: string) => Promise<{ gradeSync: string; memberships: string }>;
}> {
  const { request, sesskey } = await moodleAdminSession();
  const start = `${urls.moodle}/mod/lti/startltiadvregistration.php?url=${encodeURIComponent(registrationUrl)}&sesskey=${encodeURIComponent(sesskey)}`;
  let res = await request(start);
  if (res.status === 200 && /startltiadvregistration\.php[^"']*type=0/.test(res.body)) {
    res = await request(`${start}&type=0`);
  }
  const toTool = String(res.headers.location ?? '');
  expect([302, 303]).toContain(res.status);
  expect(toTool.startsWith(registrationUrl)).toBe(true);
  const register = await httpsRequest(toTool);
  expect(register.status, register.body.slice(0, 300)).toBe(303);
  const toApp = String(register.headers.location ?? '');
  const registrationId = new URL(toApp).searchParams.get('registrationId') ?? '';
  expect(registrationId).not.toBe('');

  const readToolServices = async (deploymentId: string) => {
    const edit = await request(
      `${urls.moodle}/mod/lti/typessettings.php?action=update&id=${encodeURIComponent(deploymentId)}&sesskey=${encodeURIComponent(sesskey)}`,
    );
    expect(edit.status).toBe(200);
    const selectedOption = (selectName: string): string => {
      const selMatch = new RegExp(
        `<select[^>]*name="${selectName}"[^>]*>([\\s\\S]*?)<\\/select>`,
        'i',
      ).exec(edit.body);
      if (!selMatch) return '';
      const optMatch =
        /<option[^>]*value="([^"]*)"[^>]*selected/i.exec(selMatch[1]) ??
        /<option[^>]*selected[^>]*value="([^"]*)"/i.exec(selMatch[1]);
      return optMatch?.[1] ?? '';
    };
    return {
      gradeSync: selectedOption('ltiservice_gradesynchronization'),
      memberships: selectedOption('ltiservice_memberships'),
    };
  };

  return { registrationId, readToolServices };
}

/**
 * Starts a registration session against a static OpenID Configuration on qa-platform.test
 * with a custom `scopes_supported` list (for AC-LA-E3-06-03 and AC-LA-E3-06-04, which fail
 * with 400 INVALID_REQUEST before any registration POST is sent).
 */
async function startQaPlatformRegistration(
  label: string,
  scopesSupported: string[],
): Promise<{ registrationId: string; cleanup: () => void }> {
  const id = `${label}-${runId}-${crypto.randomBytes(2).toString('hex')}`;
  const kid = `qa-reg-${id}`;
  const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true });
  const publicJwk = { ...(await exportJWK(publicKey)), kid, alg: 'RS256', use: 'sig' };
  const issuer = `${QA_ISSUER}/${id}`;
  const configDir = path.join(QA_FIXTURE_DIR, id, 'mod', 'lti');
  fs.mkdirSync(configDir, { recursive: true });
  const jwksFile = `jwks-${id}.json`;
  const configFile = path.join(configDir, 'openid-configuration.php');
  fs.writeFileSync(path.join(QA_FIXTURE_DIR, jwksFile), JSON.stringify({ keys: [publicJwk] }));
  fs.writeFileSync(
    configFile,
    JSON.stringify({
      issuer,
      authorization_endpoint: `${QA_ISSUER}/auth`,
      token_endpoint: `${QA_ISSUER}/token`,
      jwks_uri: `${QA_ISSUER}/${jwksFile}`,
      registration_endpoint: `${QA_ISSUER}/register`,
      scopes_supported: scopesSupported,
      response_types_supported: ['id_token'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      claims_supported: ['iss', 'sub'],
      'https://purl.imsglobal.org/spec/lti-platform-configuration': {
        product_family_code: 'moodle',
        version: '5.2.4',
        messages_supported: [
          { type: 'LtiResourceLinkRequest' },
          { type: 'LtiDeepLinkingRequest', placements: ['ContentArea'] },
        ],
      },
    }),
  );

  const now = Math.floor(Date.now() / 1000);
  const regToken = await new SignJWT({ sub: '0', scope: 'reg', iat: now, exp: now + 600 })
    .setProtectedHeader({ alg: 'RS256', kid, typ: 'JWT' })
    .sign(privateKey);
  recordSecret('id_token', regToken);

  const configUrl = `${issuer}/mod/lti/openid-configuration.php`;
  const startUrl = `${urls.lti}/lti/register/${ACCOUNT}?openid_configuration=${encodeURIComponent(configUrl)}&registration_token=${encodeURIComponent(regToken)}`;
  const startRes = await httpsRequest(startUrl);
  expect(startRes.status, startRes.body.slice(0, 300)).toBe(303);
  const loc = String(startRes.headers.location ?? '');
  const registrationId = new URL(loc).searchParams.get('registrationId') ?? '';
  expect(registrationId).not.toBe('');

  return {
    registrationId,
    cleanup: () => {
      fs.rmSync(path.join(QA_FIXTURE_DIR, jwksFile), { force: true });
      fs.rmSync(path.join(QA_FIXTURE_DIR, id), { recursive: true, force: true });
    },
  };
}

describe('LA-E3-06 K1-SIM: NRPS scope complete.scopes and registration.complete audit event', () => {
  let key = '';
  let operatorKey = '';
  const createdPlatformIds: string[] = [];
  const cleanups: Array<() => void> = [];
  let completedRegIdForAudit = '';
  let completedPlatformIdForAudit = '';
  let completedTraceIdForAudit = '';

  beforeAll(() => {
    key = apiKey(ACCOUNT);
    operatorKey = readOperatorKey();
    expect(OPERATOR_KEY_RE.test(operatorKey)).toBe(true);
  });

  afterAll(async () => {
    for (const fn of cleanups.splice(0)) {
      try {
        fn();
      } catch {
        // ignore cleanup error
      }
    }
    for (const id of createdPlatformIds.splice(0)) {
      await ltiApi('DELETE', `/api/platforms/${encodeURIComponent(id)}`, {
        authorization: auth.bearer(key),
      }).catch(() => undefined);
    }
  });

  it('AC-LA-E3-06-01: a complete with scopes = the four AGS scopes sends a registration request whose scope has exactly those four (AP-05-21)', async () => {
    const { cursor: simBefore } = (await simJson<{ cursor: number }>('/__sim/records')).json;
    const regUrl = `${urls.lti}/lti/register/${ACCOUNT}?ref=qa4-e306-ac01`;
    const { registrationId, readToolServices } = await startMoodleDrSession(regUrl);

    const completeRes = await ltiApi<{ platformId?: string; html?: string }>(
      'POST',
      `/api/registrations/${encodeURIComponent(registrationId)}/complete`,
      {
        authorization: auth.bearer(key),
        body: {
          platformName: `QA4 E3-06 4-scopes ${runId}`,
          scopes: [...FOUR_AGS_SCOPES],
        },
      },
    );
    expect(completeRes.status, completeRes.body.slice(0, 300)).toBe(200);
    const platformId = String(completeRes.json?.platformId ?? '');
    expect(platformId).toMatch(/^plt_/);
    createdPlatformIds.push(platformId);

    completedRegIdForAudit = registrationId;
    completedPlatformIdForAudit = platformId;
    completedTraceIdForAudit = completeRes.traceId;

    const platRes = await ltiApi<{
      id: string;
      deploymentIds: string[];
      grantedScopes?: string[] | string | null;
    }>('GET', `/api/platforms/${encodeURIComponent(platformId)}`, {
      authorization: auth.bearer(key),
    });
    expect(platRes.status, platRes.body.slice(0, 300)).toBe(200);
    const deploymentId = String(platRes.json.deploymentIds?.[0] ?? '');
    expect(deploymentId).not.toBe('');

    // Verify in the platform record that AGS is enabled ('2') and NRPS is NOT enabled ('0' = Do not use this service).
    const services = await readToolServices(deploymentId);
    expect(services.gradeSync, 'AGS grade sync is enabled (2)').toBe('2');
    expect(services.memberships, 'NRPS memberships is disabled (0) when only the 4 AGS scopes are sent').toBe('0');

    // If simulator DR records exist (LA-E7-05), verify the simulator DR record scope string directly.
    const simAfter = (
      await simJson<{ records: SimRecord[] }>(`/__sim/records?since=${simBefore}`)
    ).json.records;
    const drRecords = simAfter.filter((r) => r.kind === 'registration' || r.kind === 'dr');
    if (drRecords.length > 0) {
      const last = drRecords[drRecords.length - 1];
      const recordedScope =
        typeof last.scope === 'string'
          ? last.scope
          : typeof last.body?.scope === 'string'
            ? last.body.scope
            : Array.isArray(last.scopes)
              ? last.scopes.join(' ')
              : '';
      expect(recordedScope).toBe(FOUR_AGS_SCOPES.join(' '));
    }
  });

  it('AC-LA-E3-06-02: a complete without scopes sends the five scopes, as before LA (AP-05-21)', async () => {
    const { cursor: simBefore } = (await simJson<{ cursor: number }>('/__sim/records')).json;
    const regUrl = `${urls.lti}/lti/register/${ACCOUNT}?ref=qa4-e306-ac02`;
    const { registrationId, readToolServices } = await startMoodleDrSession(regUrl);

    const completeRes = await ltiApi<{ platformId?: string; html?: string }>(
      'POST',
      `/api/registrations/${encodeURIComponent(registrationId)}/complete`,
      {
        authorization: auth.bearer(key),
        body: {
          platformName: `QA4 E3-06 default-5-scopes ${runId}`,
        },
      },
    );
    expect(completeRes.status, completeRes.body.slice(0, 300)).toBe(200);
    const platformId = String(completeRes.json?.platformId ?? '');
    expect(platformId).toMatch(/^plt_/);
    createdPlatformIds.push(platformId);

    const platRes = await ltiApi<{ id: string; deploymentIds: string[] }>(
      'GET',
      `/api/platforms/${encodeURIComponent(platformId)}`,
      { authorization: auth.bearer(key) },
    );
    expect(platRes.status, platRes.body.slice(0, 300)).toBe(200);
    const deploymentId = String(platRes.json.deploymentIds?.[0] ?? '');
    expect(deploymentId).not.toBe('');

    // Verify in the platform record that both AGS ('2') and NRPS ('1') are enabled when scopes is omitted.
    const services = await readToolServices(deploymentId);
    expect(services.gradeSync, 'AGS grade sync is enabled (2)').toBe('2');
    expect(services.memberships, 'NRPS memberships is enabled (1) when scopes is omitted (all 5 scopes sent)').toBe('1');

    const simAfter = (
      await simJson<{ records: SimRecord[] }>(`/__sim/records?since=${simBefore}`)
    ).json.records;
    const drRecords = simAfter.filter((r) => r.kind === 'registration' || r.kind === 'dr');
    if (drRecords.length > 0) {
      const last = drRecords[drRecords.length - 1];
      const recordedScope =
        typeof last.scope === 'string'
          ? last.scope
          : typeof last.body?.scope === 'string'
            ? last.body.scope
            : Array.isArray(last.scopes)
              ? last.scopes.join(' ')
              : '';
      expect(recordedScope).toBe(FIVE_ADR009_SCOPES.join(' '));
    }
  });

  it('AC-LA-E3-06-03 & AC-LA-E3-06-04: complete with a scope not in scopes_supported, outside the 5 of ADR-009, or scopes: [] gives 400 INVALID_REQUEST (field scopes) and sends no registration request', async () => {
    // Configure qa-platform.test with scopes_supported = openid + the 4 AGS scopes (omitting NRPS_SCOPE).
    const session = await startQaPlatformRegistration('ac03', ['openid', ...FOUR_AGS_SCOPES]);
    cleanups.push(session.cleanup);

    const { cursor: simBefore } = (await simJson<{ cursor: number }>('/__sim/records')).json;
    const since = Date.now() - 500;

    // 1. AC-LA-E3-06-03: NRPS_SCOPE is in the 5 ADR-009 scopes, but NOT in this configuration's scopes_supported.
    const unsupportedRes = await ltiApi<{ details?: { field?: string; description?: string } }>(
      'POST',
      `/api/registrations/${encodeURIComponent(session.registrationId)}/complete`,
      {
        authorization: auth.bearer(key),
        body: {
          platformName: `QA4 E3-06 unsupported ${runId}`,
          scopes: [...FOUR_AGS_SCOPES, NRPS_SCOPE],
        },
      },
    );
    expect(unsupportedRes.status, unsupportedRes.body.slice(0, 300)).toBe(400);
    expect(errorCode(unsupportedRes)).toBe('INVALID_REQUEST');
    expect(hasErrorShape(unsupportedRes)).toBe(true);
    const unsupportedField = String(unsupportedRes.json?.details?.field ?? '');
    const unsupportedDesc = String(unsupportedRes.json?.details?.description ?? '');
    expect(
      unsupportedField === 'scopes' || /\bscopes\b/i.test(unsupportedDesc),
      `Expected details.field="scopes" or description naming scopes, got: ${unsupportedRes.body}`,
    ).toBe(true);

    // 2. AC-LA-E3-06-04: scopes: [] -> 400 INVALID_REQUEST (field scopes).
    const emptyRes = await ltiApi<{ details?: { field?: string; description?: string } }>(
      'POST',
      `/api/registrations/${encodeURIComponent(session.registrationId)}/complete`,
      {
        authorization: auth.bearer(key),
        body: {
          platformName: `QA4 E3-06 empty ${runId}`,
          scopes: [],
        },
      },
    );
    expect(emptyRes.status, emptyRes.body.slice(0, 300)).toBe(400);
    expect(errorCode(emptyRes)).toBe('INVALID_REQUEST');
    expect(hasErrorShape(emptyRes)).toBe(true);
    const emptyField = String(emptyRes.json?.details?.field ?? '');
    const emptyDesc = String(emptyRes.json?.details?.description ?? '');
    expect(
      emptyField === 'scopes' || /\bscopes\b/i.test(emptyDesc),
      `Expected details.field="scopes" or description naming scopes for [], got: ${emptyRes.body}`,
    ).toBe(true);

    // 3. AC-LA-E3-06-04: a scope outside the 5 of ADR-009 -> 400 INVALID_REQUEST (field scopes).
    const unknownScopeRes = await ltiApi<{ details?: { field?: string; description?: string } }>(
      'POST',
      `/api/registrations/${encodeURIComponent(session.registrationId)}/complete`,
      {
        authorization: auth.bearer(key),
        body: {
          platformName: `QA4 E3-06 unknown-scope ${runId}`,
          scopes: ['https://purl.imsglobal.org/spec/lti/scope/unknown'],
        },
      },
    );
    expect(unknownScopeRes.status, unknownScopeRes.body.slice(0, 300)).toBe(400);
    expect(errorCode(unknownScopeRes)).toBe('INVALID_REQUEST');
    expect(hasErrorShape(unknownScopeRes)).toBe(true);
    const unknownField = String(unknownScopeRes.json?.details?.field ?? '');
    const unknownDesc = String(unknownScopeRes.json?.details?.description ?? '');
    expect(
      unknownField === 'scopes' || /\bscopes\b/i.test(unknownDesc),
      `Expected details.field="scopes" or description naming scopes for unknown scope, got: ${unknownScopeRes.body}`,
    ).toBe(true);

    // Verify no outbound registration POST request was made by any of the three refused complete calls.
    const simAfter = (
      await simJson<{ records: SimRecord[] }>(`/__sim/records?since=${simBefore}`)
    ).json.records;
    expect(
      simAfter.filter((r) => r.kind === 'registration' || r.kind === 'dr'),
      'simulator recorded no registration request',
    ).toEqual([]);

    const traceIds = new Set([
      unsupportedRes.traceId,
      emptyRes.traceId,
      unknownScopeRes.traceId,
    ]);
    const outboundPosts = eventsSince(
      'lti-service',
      since,
      (e) =>
        (e.event === 'outbound_request' || e.event === 'outbound_blocked') &&
        traceIds.has(String(e.trace_id ?? '')),
    );
    expect(outboundPosts, 'no outbound request sent on 400 INVALID_REQUEST').toEqual([]);
  });

  it('AC-LA-E3-06-05: a successful complete writes one audit event registration.complete with result: ok; a second complete of the same registration (409 REGISTRATION_ALREADY_COMPLETED) writes one event with result: refused and that code (AP-06-14)', async () => {
    expect(completedRegIdForAudit, 'AC-01 completed a registration').not.toBe('');

    // Second complete of the same registration -> 409 REGISTRATION_ALREADY_COMPLETED.
    const secondRes = await ltiApi(
      'POST',
      `/api/registrations/${encodeURIComponent(completedRegIdForAudit)}/complete`,
      {
        authorization: auth.bearer(key),
        body: {
          platformName: `QA4 E3-06 again ${runId}`,
          scopes: [...FOUR_AGS_SCOPES],
        },
      },
    );
    expect(secondRes.status, secondRes.body.slice(0, 300)).toBe(409);
    expect(errorCode(secondRes)).toBe('REGISTRATION_ALREADY_COMPLETED');
    expect(hasErrorShape(secondRes)).toBe(true);

    const audit = await listAudit(operatorKey, { action: 'registration.complete', limit: 200 });
    expect(audit.res.status, audit.res.body.slice(0, 300)).toBe(200);

    // 1. Event for the successful complete:
    const okEvents = audit.events.filter((e) => e.traceId === completedTraceIdForAudit);
    expect(
      okEvents.length,
      `Expected 1 registration.complete ok event for trace ${completedTraceIdForAudit}`,
    ).toBe(1);
    const okEv = okEvents[0];
    expect(okEv.action).toBe('registration.complete');
    expect(actorTag(okEv)).toMatch(tenantActorRe(ACCOUNT));
    expect(okEv.toolAccountId).toBe(ACCOUNT);
    expect(okEv.target?.type).toBe('registration');
    expect(
      okEv.target?.id === completedRegIdForAudit || okEv.target?.id === completedPlatformIdForAudit,
      `Expected target.id to be registrationId (${completedRegIdForAudit}), got ${String(okEv.target?.id)}`,
    ).toBe(true);
    expect(okEv.result).toBe('ok');
    expect(okEv.code).toBeNull();

    // 2. Event for the refused second complete (409 REGISTRATION_ALREADY_COMPLETED):
    const refusedEvents = audit.events.filter((e) => e.traceId === secondRes.traceId);
    expect(
      refusedEvents.length,
      `Expected 1 registration.complete refused event for trace ${secondRes.traceId}`,
    ).toBe(1);
    const refEv = refusedEvents[0];
    expect(refEv.action).toBe('registration.complete');
    expect(actorTag(refEv)).toMatch(tenantActorRe(ACCOUNT));
    expect(refEv.toolAccountId).toBe(ACCOUNT);
    expect(refEv.target?.type).toBe('registration');
    expect(refEv.target?.id).toBe(completedRegIdForAudit);
    expect(refEv.result).toBe('refused');
    expect(refEv.code).toBe('REGISTRATION_ALREADY_COMPLETED');
  });

  it('AC-LA-E3-06-06: GET /api/memberships still answers for a launch with an NRPS claim, without personal fields (AP-05-22, AC-T3-27)', async () => {
    const clientId = `qa4-e306-nrps-${runId}`;
    const deploymentId = `dep-e306-${runId}`;
    const createRes = await ltiApi<{ id?: string }>('POST', '/api/platforms', {
      authorization: auth.bearer(key),
      body: {
        profile: 'canvas-self-hosted',
        siteUrl: 'https://canvas-self.sim.test',
        serviceUrl: 'https://api.canvas-self.sim.test',
        clientId,
        name: `QA4 E3-06 NRPS ${runId}`,
        deploymentIds: [deploymentId],
      },
    });
    expect(createRes.status, createRes.body.slice(0, 300)).toBe(201);
    const platformId = String(createRes.json?.id ?? '');
    createdPlatformIds.push(platformId);

    const scenarioId = `scn-e306-nrps-${runId}`;
    const scnRes = await simJson<{ id: string; login: Record<string, string> }>(
      '/__sim/scenarios',
      'POST',
      {
        id: scenarioId,
        provider: 'canvas-sim-self',
        clientId,
        deploymentId,
        siteHost: 'api.canvas-self.sim.test',
        pageHost: 'canvas-self.sim.test',
        resource: `res-e306-${runId}`,
        members: [
          {
            user_id: 'sim-learner-1',
            status: 'Active',
            roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
            name: 'Alice Learner',
            email: 'alice@example.edu',
            given_name: 'Alice',
            family_name: 'Learner',
            picture: 'https://canvas-self.sim.test/alice.png',
          },
          {
            user_id: 'sim-instructor-1',
            status: 'Active',
            roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
            name: 'Bob Instructor',
            email: 'bob@example.edu',
            given_name: 'Bob',
            family_name: 'Instructor',
          },
        ],
      },
    );
    expect(scnRes.status).toBe(201);

    const loginBody = new URLSearchParams(scnRes.json.login).toString();
    const loginRes = await httpsRequest(LOGIN_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'content-length': String(Buffer.byteLength(loginBody)),
      },
      body: loginBody,
    });
    expect(loginRes.status, loginRes.body.slice(0, 200)).toBe(302);
    const stateCookie =
      [loginRes.headers['set-cookie'] ?? []]
        .flat()
        .map((c) => c.split(';')[0])
        .find((c) => c.startsWith('__Host-lti_state_')) ?? '';
    expect(stateCookie).not.toBe('');

    const authRes = await httpsRequest(String(loginRes.headers.location ?? ''));
    expect(authRes.status, authRes.body.slice(0, 200)).toBe(200);
    const idTokenMatch = /name="id_token"\s+value="([^"]+)"/.exec(authRes.body);
    const stateMatch = /name="state"\s+value="([^"]+)"/.exec(authRes.body);
    expect(idTokenMatch?.[1]).toBeTruthy();
    expect(stateMatch?.[1]).toBeTruthy();
    recordSecret('id_token', idTokenMatch![1]);
    recordSecret('state', stateMatch![1]);

    const launchForm = new URLSearchParams({
      id_token: idTokenMatch![1],
      state: stateMatch![1],
    }).toString();
    const launchRes = await httpsRequest(LAUNCH_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'content-length': String(Buffer.byteLength(launchForm)),
        cookie: stateCookie,
      },
      body: launchForm,
    });
    expect(launchRes.status, launchRes.body.slice(0, 200)).toBe(303);
    const ltik = new URL(String(launchRes.headers.location ?? '')).searchParams.get('ltik') ?? '';
    expect(ltik).not.toBe('');
    recordSecret('ltik', ltik);

    const idtokenRes = await ltiApi<{
      services?: { namesAndRoles?: { available?: boolean }; serviceKey?: string };
    }>('GET', '/api/idtoken', {
      authorization: auth.ltik(key, ltik),
    });
    expect(idtokenRes.status, idtokenRes.body.slice(0, 200)).toBe(200);
    expect(idtokenRes.json.services?.namesAndRoles?.available).toBe(true);
    const serviceKey = String(idtokenRes.json.services?.serviceKey ?? '');
    expect(serviceKey).toMatch(/^[A-Za-z0-9_-]{43}$/);
    recordSecret('service_key', serviceKey);

    const { cursor: simBefore } = (await simJson<{ cursor: number }>('/__sim/records')).json;

    // Call GET /api/memberships with LTIK-AUTH-V2 and SERVICE-AUTH-V1.
    for (const authz of [auth.ltik(key, ltik), auth.service(key, serviceKey)]) {
      const memRes = await ltiApi<{
        id?: string;
        context?: { id?: string };
        members?: Array<Record<string, unknown>>;
      }>('GET', '/api/memberships', { authorization: authz });
      expect(memRes.status, memRes.body.slice(0, 300)).toBe(200);
      expect(memRes.json.context?.id).toBe('context-1');
      expect(Array.isArray(memRes.json.members)).toBe(true);
      const members = memRes.json.members ?? [];
      for (const m of members) {
        expect(typeof m.userId).toBe('string');
        expect(Array.isArray(m.roles)).toBe(true);
        for (const personalKey of [
          'email',
          'name',
          'givenName',
          'familyName',
          'picture',
          'given_name',
          'family_name',
        ]) {
          expect(personalKey in m, `member must not carry personal field ${personalKey}`).toBe(false);
        }
      }
    }

    const simAfter = (
      await simJson<{ records: SimRecord[] }>(`/__sim/records?since=${simBefore}`)
    ).json.records;
    expect(
      simAfter.filter((r) => r.kind === 'nrps' && r.host === 'api.canvas-self.sim.test').length,
      'simulator recorded the NRPS requests',
    ).toBeGreaterThanOrEqual(2);
  });
});
