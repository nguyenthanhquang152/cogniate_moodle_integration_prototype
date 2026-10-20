import {
  AGS, DL, LTI, NRPS, admin, assert, beginLaunch, denied, deploymentPath, expectStatus,
  formPost, idToken, launch, logEvents, m1Test, noServiceCalls, records, service,
  sharedPlatform, unique, preparedLaunch,
} from '../common/client';

async function platform() {
  const platformId = await sharedPlatform(), deploymentId = unique('protocol');
  expectStatus(await admin('POST', deploymentPath(platformId), { deploymentId, siteUrl: 'https://learn-a.blackboard.sim.test' }), 201);
  return { platformId, deploymentId };
}
const faults: [string, string][] = [
  ['altered-signature', 'INVALID_SIGNATURE'], ['unknown-key', 'INVALID_SIGNATURE'], ['unknown-kid', 'INVALID_SIGNATURE'],
  ['none', 'INVALID_ID_TOKEN'], ['hs256', 'INVALID_ID_TOKEN'],
  ['wrong-issuer', 'INVALID_ISSUER_OR_AUDIENCE'], ['wrong-audience', 'INVALID_ISSUER_OR_AUDIENCE'],
  ['multi-aud-no-azp', 'INVALID_ISSUER_OR_AUDIENCE'], ['multi-aud-wrong-azp', 'INVALID_ISSUER_OR_AUDIENCE'],
  ['expired', 'TOKEN_EXPIRED'], ['future-iat', 'TOKEN_EXPIRED'], ['wrong-nonce', 'INVALID_NONCE'],
];
for (const [fault, code] of faults) {
  m1Test(`M1-34.blackboard.${fault}`, `fresh signed Blackboard login rejects ${fault}`, async () => {
    const p = await platform(), since = Date.now(), cursor = (await records()).cursor;
    const result = await launch({ deploymentId: p.deploymentId, fault });
    assert.ok([400, 401].includes(result.response.status));
    denied(result.response, code, result.response.status); assert.equal(result.ltik, '');
    assert.equal(logEvents('launch_accepted', since, { platform_id: p.platformId }, 'lti-service').length, 0);
    assert.ok(logEvents('launch_check_failed', since, { code }, 'lti-service').length >= 1);
    await noServiceCalls(cursor);
  });
}
m1Test('M1-34.blackboard.no-cookie', 'a valid signature cannot replace the state cookie', async () => {
  const p = await platform(), cursor = (await records()).cursor;
  const result = await launch({ deploymentId: p.deploymentId }, { noCookie: true });
  denied(result.response, 'STATE_COOKIE_MISSING', result.response.status);
  assert.ok([400, 401].includes(result.response.status)); assert.equal(result.ltik, ''); await noServiceCalls(cursor);
});
m1Test('M1-34.blackboard.replay', 'state is single-use after a successful launch', async () => {
  const p = await platform(), first = await launch({ deploymentId: p.deploymentId }); assert.equal(first.response.status, 303);
  const replay = await formPost(first.login.headers.location ? new URL(first.location).searchParams.get('redirect_uri')! : '',
    first.fields, first.cookie);
  assert.ok([400, 401].includes(replay.status)); denied(replay, 'INVALID_STATE', replay.status);
});

const foreign = 'https://learn-b.blackboard.sim.test';
const claimCases: [string, string, (url: string) => Record<string, unknown>][] = [
  ['ags-lineitems', 'ags_lineitems', (url) => ({ [AGS]: { lineitems: url, scope: [] } })],
  ['ags-lineitem', 'ags_lineitem', (url) => ({ [AGS]: { lineitem: url, scope: [] } })],
  ['nrps', 'nrps', (url) => ({ [NRPS]: { context_memberships_url: url, service_versions: ['2.0'] } })],
  ['dl-return', 'dl_return', (url) => ({ [DL + 'deep_linking_settings']: { deep_link_return_url: url, accept_types: ['ltiResourceLink'] } })],
];
for (const [variant, claim, fields] of claimCases) {
  m1Test(`M1-12.blackboard.${variant}`, `signed ${claim} cannot address another Learn site`, async () => {
    const p = await platform(), since = Date.now(), cursor = (await records()).cursor;
    const result = await launch({ deploymentId: p.deploymentId,
      ...(variant === 'dl-return' ? { messageType: 'LtiDeepLinkingRequest' } : {}), claims: fields(foreign + '/foreign') });
    denied(result.response, 'SERVICE_ORIGIN_MISMATCH');
    const entries = logEvents('launch_check_failed', since, { check: '13', code: 'SERVICE_ORIGIN_MISMATCH' }, 'lti-service');
    assert.ok(entries.some((e) => e.detail === `claim=${claim} host=${foreign}`)); await noServiceCalls(cursor);
  });
}
m1Test('M1-13.blackboard.login-token-deployment', 'signed deployment must equal the login deployment', async () => {
  const p = await platform(), other = await platform();
  const result = await launch({ deploymentId: p.deploymentId }, { login: { lti_deployment_id: other.deploymentId } });
  denied(result.response, 'UNKNOWN_DEPLOYMENT');
});
for (const kind of ['resource', 'deep-link']) {
  m1Test(`M1-13.blackboard.unknown-${kind}`, `unknown deployment fails at login and ${kind} launch`, async () => {
    const p = await platform(), missing = unique('unknown');
    const messageType = kind === 'resource' ? 'LtiResourceLinkRequest' : 'LtiDeepLinkingRequest';
    const login = await beginLaunch({ deploymentId: missing, messageType });
    denied(login.login, 'UNKNOWN_DEPLOYMENT');
    const result = await launch({ deploymentId: p.deploymentId, messageType, claims: { [LTI + 'deployment_id']: missing } });
    denied(result.response, 'UNKNOWN_DEPLOYMENT');
  });
}
m1Test('M1-13.blackboard.inactive', 'inactive deployment refuses login, launch, existing ltik and service key', async () => {
  const p = await platform(), other = await platform();
  const first = await launch({ deploymentId: p.deploymentId }); assert.equal(first.response.status, 303);
  const token = await idToken(first.ltik); expectStatus(token, 200);
  const prepared = await preparedLaunch({ deploymentId: p.deploymentId });
  expectStatus(await admin('PATCH', deploymentPath(p.platformId, p.deploymentId), { active: false }), 200);
  const stopped = await launch({ deploymentId: p.deploymentId }); denied(stopped.response, 'DEPLOYMENT_NOT_ACTIVE', 403);
  denied(await prepared.submit(), 'DEPLOYMENT_NOT_ACTIVE', 403);
  expectStatus(await idToken(first.ltik), 403, 'DEPLOYMENT_NOT_ACTIVE');
  expectStatus(await service(token.json.services.serviceKey, 'GET', '/api/lineitems'), 403, 'DEPLOYMENT_NOT_ACTIVE');
  assert.equal((await launch({ deploymentId: other.deploymentId })).response.status, 303);
});
m1Test('M1-25.blackboard.site-metadata', 'idtoken exposes the deployment site and provider profile', async () => {
  const p = await platform(), result = await launch({ deploymentId: p.deploymentId }); assert.equal(result.response.status, 303);
  const token = await idToken(result.ltik); expectStatus(token, 200);
  assert.equal(token.json.platform.siteUrl, 'https://learn-a.blackboard.sim.test');
  assert.equal(token.json.platform.serviceUrl, 'https://learn-a.blackboard.sim.test');
  assert.equal(token.json.platform.profile, 'blackboard-sim');
});

m1Test('M1-14.blackboard.claims', 'privacy allowlist removes personal, custom and nested data before storage', async () => {
  const p = await platform(), marker = unique('PII'), since = Date.now();
  const stripped = { name: marker, given_name: marker, family_name: marker, email: marker, picture: marker, locale: marker,
    [LTI + 'lis']: { person_sourcedid: marker }, [LTI + 'lti1p1']: { user_id: marker },
    [LTI + 'custom']: { secret: marker }, 'https://blackboard.com/lti/claim/one_time_session_token': marker };
  const result = await launch({ deploymentId: p.deploymentId, claims: { ...stripped,
    [LTI + 'context']: { id: 'context-1', label: 'kept', extra: marker },
    [LTI + 'resource_link']: { id: 'resource-1', title: 'kept', extra: marker },
    [LTI + 'tool_platform']: { product_family_code: 'BlackboardLearn', contact_email: marker, extra: marker },
    [LTI + 'launch_presentation']: { document_target: 'window', extra: marker },
  } });
  assert.equal(result.response.status, 303);
  const raw = await idToken(result.ltik, true); expectStatus(raw, 200);
  assert.equal(JSON.stringify(raw.json).includes(marker), false);
  const kept = ['iss', 'sub', 'aud', 'iat', 'exp', 'nonce',
    ...['message_type', 'version', 'deployment_id', 'target_link_uri', 'roles',
      'context', 'resource_link', 'tool_platform', 'launch_presentation'].map((key) => LTI + key), AGS, NRPS];
  assert.deepEqual(Object.keys(raw.json).sort(), kept.sort());
  assert.deepEqual(raw.json[LTI + 'context'], { id: 'context-1', label: 'kept' });
  assert.deepEqual(raw.json[LTI + 'resource_link'], { id: 'resource-1', title: 'kept' });
  assert.deepEqual(raw.json[LTI + 'tool_platform'], { product_family_code: 'BlackboardLearn' });
  assert.deepEqual(raw.json[LTI + 'launch_presentation'], { document_target: 'window' });
  const normalized = await idToken(result.ltik); expectStatus(normalized, 200);
  assert.equal(normalized.json.user.name, undefined); assert.equal(normalized.json.user.email, undefined);
  assert.deepEqual(normalized.json.launch.custom, {});
  const entries = logEvents('launch_claims_minimized', since, { platform_id: p.platformId }, 'lti-service');
  assert.equal(entries.length, 1); assert.equal(JSON.stringify(entries).includes(marker), false);
  assert.deepEqual(entries[0].claims, [...Object.keys(stripped),
    LTI + 'context#extra', LTI + 'resource_link#extra', LTI + 'tool_platform#contact_email',
    LTI + 'tool_platform#extra', LTI + 'launch_presentation#extra'].sort());
});

for (const [variant, makeUrl] of [
  ['origin', (base: string) => base.replace('learn-a.', 'learn-b.')],
  ['path', (base: string) => new URL('/outside', base).href],
  ['query', (base: string) => base + '?injected=1'],
  ['encoded-dot', (base: string) => base + '/%2e%2e/private'],
  ['encoded-slash', (base: string) => base + '/%2f..%2fprivate'],
] as const) {
  m1Test(`M1-36.blackboard.${variant}`, `service key rejects ${variant} escape without outbound calls`, async () => {
    const p = await platform(), launchResult = await launch({ deploymentId: p.deploymentId });
    const token = await idToken(launchResult.ltik); expectStatus(token, 200);
    const key = token.json.services.serviceKey;
    const base = 'https://learn-a.blackboard.sim.test/learn/api/v1/lti/courses/course-1/lineItems';
    expectStatus(await service(key, 'GET', '/api/lineitems?url=' + encodeURIComponent(base)), 200);
    const cursor = (await records()).cursor;
    expectStatus(await service(key, 'GET', '/api/lineitems?url=' + encodeURIComponent(makeUrl(base))), 400, 'INVALID_URL_PARAMETER');
    expectStatus(await service(key, 'GET', '/api/lineitems/' + encodeURIComponent(makeUrl(base))), 400, 'INVALID_LINE_ITEM_ID');
    await noServiceCalls(cursor);
  });
}
