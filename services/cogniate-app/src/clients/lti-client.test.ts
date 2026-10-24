import { EventEmitter } from 'node:events';
import type { ClientRequest, IncomingMessage } from 'node:http';
import type { OutboundRequest } from '@cogniate/shared';
import { createLogger, createOutboundClient } from '@cogniate/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeProviders } from '../testkit.ts';
import { createLtiClient } from './lti-client.ts';

afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

it('P1: only registration completion overrides the guarded outbound deadline to 15 seconds', async () => {
  const requests: Array<{ url: string; req: OutboundRequest }> = [];
  const client = createLtiClient({
    ltiUrl: 'https://lti.test', apiKeyFile: 'unused', readKey: () => 'test-key',
    outbound: {
      allowlist: ['lti.test'],
      async request(url, req = {}) {
        requests.push({ url, req });
        const json = url.endsWith('/complete') ? { platformId: 'plt_1', html: '' }
          : url.includes('/registrations/') ? { url: 'https://moodle.test', supportedScopes: [], supportedMessages: [], privacyLevel: 'anonymous', operation: 'new', existingPlatformId: null }
            : { id: 'plt_1', url: 'https://moodle.test', clientId: 'c1', name: 'Cogniate', active: true, deploymentIds: ['1'] };
        const body = Buffer.from(JSON.stringify(json));
        return { status: 200, headers: {}, body, text: () => body.toString(), json: () => json };
      },
    },
  });
  await client.getRegistration('reg_1', 'trace');
  await client.completeRegistration('reg_1', { platformName: 'Cogniate', privacyLevel: 'anonymous', autoActivate: true }, 'trace');
  await client.getPlatform('plt_1', 'trace');
  expect(requests.map(({ req }) => req.timeoutMs)).toEqual([undefined, 15_000, undefined]);
  expect(requests[1]).toMatchObject({ url: 'https://lti.test/api/registrations/reg_1/complete', req: { method: 'POST', traceId: 'trace', headers: { authorization: 'Bearer test-key', 'x-trace-id': 'trace' } } });
});

it('M1 (M3 §3.3): with apiUrl only the /api/* calls go to the transport gate; /lti/* (tool keys) stays on PUBLIC_LTI_URL', async () => {
  const urls: string[] = [];
  const client = createLtiClient({
    ltiUrl: 'https://lti.test', apiUrl: 'https://lti-gate.test', apiKeyFile: 'unused', readKey: () => 'test-key',
    outbound: {
      allowlist: [],
      async request(url) {
        urls.push(url);
        const json = url.includes('/lti/keys/') ? { keys: [{ kty: 'RSA', kid: 'k', alg: 'RS256', use: 'sig', n: 'n', e: 'AQAB' }] } : { profiles: [] };
        const body = Buffer.from(JSON.stringify(json));
        return { status: 200, headers: {}, body, text: () => body.toString(), json: () => json };
      },
    },
  });
  await client.getProviders('t');
  await client.getToolKeys('cogniate', 't');
  await client.findPlatforms({ url: 'https://canvas.sim.test', clientId: 'c' }, 't').catch(() => undefined);
  expect(urls).toEqual(['https://lti-gate.test/api/providers', 'https://lti.test/lti/keys/cogniate', 'https://lti-gate.test/api/platforms?url=https%3A%2F%2Fcanvas.sim.test&clientId=c']);
});

it('AC-LA-E1-01-01: a providers answer with an unknown lms value parses; today\'s answer parses to the same objects', async () => {
  let answer: unknown;
  const client = createLtiClient({
    ltiUrl: 'https://lti.test', apiKeyFile: 'unused', readKey: () => 'test-key',
    outbound: {
      allowlist: ['lti.test'],
      async request() {
        const body = Buffer.from(JSON.stringify(answer));
        return { status: 200, headers: {}, body, text: () => body.toString(), json: () => JSON.parse(body.toString()) };
      },
    },
  });
  // Today's values of lms: null (standard), blackboard and canvas (LTI contract §9.3).
  const today = fakeProviders();
  answer = { profiles: today };
  expect(await client.getProviders('t')).toStrictEqual(today);
  const unknown = { ...today[3]!, id: 'x-new-cloud', lms: 'x-new', label: 'X new cloud' };
  answer = { profiles: [today[0], unknown, ...today.slice(1)] };
  expect(await client.getProviders('t')).toStrictEqual([today[0], unknown, ...today.slice(1)]);
});

// Exercise the real client and guarded transport. Only the wire boundary is controlled.
function wireClient(answer: 'network_error' | 'silent') {
  const requests: Array<{ path: string; destroy: ReturnType<typeof vi.fn> }> = [];
  const logs: Array<Record<string, unknown>> = [];
  const outbound = createOutboundClient({
    logger: createLogger({ service: 'test', write: (line) => logs.push(JSON.parse(line)) }),
    // Binding reads must use five seconds even when an unrelated caller configured another default.
    timeoutMs: 20_000,
    requestImpl: (options, respond) => {
      const req = Object.assign(new EventEmitter(), {
        write: vi.fn(), destroy: vi.fn(), end: () => {
          if (answer === 'silent') return;
          setTimeout(() => {
            if (requests.length === 1) req.emit('error', Object.assign(new Error('reset'), { code: 'ECONNRESET' }));
            else {
              const res = Object.assign(new EventEmitter(), { statusCode: 200, headers: {}, destroy: vi.fn() });
              respond(res as unknown as IncomingMessage);
              res.emit('data', Buffer.from(JSON.stringify({
                profiles: [], platforms: [], id: 'plt_1', url: 'https://moodle.test', clientId: 'c1',
                name: 'Moodle', active: true, deploymentIds: [],
                supportedScopes: [], supportedMessages: [], privacyLevel: 'anonymous', operation: 'new', existingPlatformId: null,
              })));
              res.emit('end');
            }
          }, 4100);
        },
      });
      requests.push({ path: String(options.path), destroy: req.destroy });
      return req as unknown as ClientRequest;
    },
  });
  return { client: createLtiClient({ outbound, ltiUrl: 'https://lti.test', apiKeyFile: 'unused', readKey: () => 'test-key' }), requests, logs };
}

const bindingReads = {
  V: (client: ReturnType<typeof createLtiClient>) => client.getProviders('binding-trace', { singleAttempt: true }),
  lookup: (client: ReturnType<typeof createLtiClient>) =>
    client.findPlatforms({ url: 'https://canvas.sim.test', clientId: 'c1', profile: 'canvas-sim-cloud' }, 'binding-trace', { singleAttempt: true }),
  platform: (client: ReturnType<typeof createLtiClient>) => client.getPlatform('plt_1', 'binding-trace', { singleAttempt: true }),
};

describe('A-M1-04: binding reads are one five-second wire attempt', () => {
  it.each(Object.entries(bindingReads))('%s ends on a delayed network error without the hidden second request', async (_name, read) => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { client, requests, logs } = wireClient('network_error');
    let settled = false;
    const pending = read(client).catch((err: unknown) => { settled = true; return err; });
    await vi.advanceTimersByTimeAsync(4100);
    expect(requests).toHaveLength(1);
    expect(settled).toBe(true);
    expect(await pending).toMatchObject({ status: 0, code: 'LTI_SERVICE_UNREACHABLE' });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(requests).toHaveLength(1);
    expect(logs.filter((line) => line.event === 'outbound_blocked')).toEqual([
      expect.objectContaining({ reason: 'network_error', trace_id: 'binding-trace' }),
    ]);
  });

  it.each(Object.entries(bindingReads))('%s has exactly a five-second deadline, with no retry after timeout', async (_name, read) => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { client, requests, logs } = wireClient('silent');
    let settled = false;
    const pending = read(client).catch((err: unknown) => { settled = true; return err; });
    await vi.advanceTimersByTimeAsync(4999);
    expect(settled).toBe(false);
    expect(requests[0]!.destroy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
    expect(await pending).toMatchObject({ status: 0, code: 'LTI_SERVICE_UNREACHABLE' });
    expect(requests[0]!.destroy).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(requests).toHaveLength(1);
    expect(logs.filter((line) => line.event === 'outbound_blocked')).toEqual([
      expect.objectContaining({ reason: 'timeout', trace_id: 'binding-trace' }),
    ]);
  });

  it.each(['registration', 'platform'] as const)('ordinary %s GET still retries a network error once', async (kind) => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { client, requests } = wireClient('network_error');
    const pending = kind === 'registration' ? client.getRegistration('reg_1', 'moodle-trace') : client.getPlatform('plt_1', 'moodle-trace');
    await vi.advanceTimersByTimeAsync(4100);
    expect(requests).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(4100);
    await expect(pending).resolves.toBeDefined();
    expect(requests).toHaveLength(2);
  });
});

it('LA-E2-04: complete sends profile, scopes and bindingRef and reads active; platforms and providers carry the E2 fields', async () => {
  const sent: Array<{ url: string; body: unknown }> = [];
  const answers: Record<string, unknown> = {
    complete: { platformId: 'plt_1', html: '', active: false },
    platform: { id: 'plt_1', url: 'https://lms.school.edu/sakai', clientId: 'c1', name: 'Cogniate', active: false, deploymentIds: ['d1'], profile: 'lti-generic',
      authenticationEndpoint: 'https://lms.school.edu/auth', accesstokenEndpoint: 'https://token.provider.test/token', authConfig: { method: 'JWK_SET', key: 'https://lms.school.edu/jwks' },
      clientAssertionAud: 'https://token.provider.test/aud', bindingRef: 'ref_1' },
    providers: { profiles: [{ ...fakeProviders().find((p) => p.id === 'lti-generic'), endpoints: 'admin' }, { ...fakeProviders()[0] }] },
  };
  const client = createLtiClient({
    ltiUrl: 'https://lti.test', apiKeyFile: 'unused', readKey: () => 'test-key',
    outbound: {
      allowlist: ['lti.test'],
      async request(url, req = {}) {
        sent.push({ url, body: req.body === undefined ? undefined : JSON.parse(String(req.body)) });
        const json = url.endsWith('/complete') ? answers.complete : url.endsWith('/api/providers') ? answers.providers : answers.platform;
        const body = Buffer.from(JSON.stringify(json));
        return { status: 200, headers: {}, body, text: () => body.toString(), json: () => json };
      },
    },
  });
  const scopes = ['https://purl.imsglobal.org/spec/lti-ags/scope/score'];
  expect(await client.completeRegistration('reg_1', { platformName: 'Cogniate', privacyLevel: 'anonymous', autoActivate: true, profile: 'lti-generic', scopes, bindingRef: 'ref_1' }, 'trace'))
    .toEqual({ platformId: 'plt_1', html: '', active: false });
  expect(sent[0]!.body).toEqual({ platformName: 'Cogniate', privacyLevel: 'anonymous', autoActivate: true, profile: 'lti-generic', scopes, bindingRef: 'ref_1' });
  expect(await client.getPlatform('plt_1', 'trace')).toMatchObject({
    authenticationEndpoint: 'https://lms.school.edu/auth', accesstokenEndpoint: 'https://token.provider.test/token', authConfig: { method: 'JWK_SET', key: 'https://lms.school.edu/jwks' },
    clientAssertionAud: 'https://token.provider.test/aud', bindingRef: 'ref_1',
  });
  const admin = { profile: 'lti-generic', url: 'https://lms.school.edu/sakai', clientId: 'c1', name: 'Cogniate', authenticationEndpoint: 'https://lms.school.edu/auth',
    accesstokenEndpoint: 'https://token.provider.test/token', authConfig: { method: 'JWK_SET' as const, key: 'https://lms.school.edu/jwks' }, deploymentIds: ['d1'], active: false, bindingRef: 'ref_2' };
  await client.createAdminProfilePlatform(admin, 'trace');
  expect(sent.at(-1)).toEqual({ url: 'https://lti.test/api/platforms', body: admin });
  const rows = await client.getProviders('trace');
  expect(rows.map((r) => [r.id, r.endpoints])).toEqual([['lti-generic', 'admin'], ['standard', undefined]]);
});
