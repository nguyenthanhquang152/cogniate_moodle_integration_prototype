// Canvas login, Deep Linking and launch checks: AC-M1-08, -12, -13, -14, -25, -34, -36, -39 (family), -40 (a).
import { sinkHitsSince } from '../../lib/lti';
import {
  AGS, DL, LTI, NRPS, admin, assert, deploymentPath, expectStatus, formPost, host, httpsRequest, idToken,
  logEvents, m1Test, noServiceCalls, parseForm, preparedLaunch, records, rememberSecret, service, unique, urls, type Json,
} from '../common/client';
import { pick, publication } from '../common/course';
import {
  CLOUD, PATHS, ROLE, SELF, canvasBound, canvasDeepLink, canvasDeploymentId, canvasLaunch, canvasPicker,
  canvasPlatform, refused, scenarioOf, verifyToolJwt,
} from './canvas';

const SCOPE = ['https://purl.imsglobal.org/spec/lti-ags/scope/lineitem', 'https://purl.imsglobal.org/spec/lti-ags/scope/score'];

// ---------------------------------------------------------------- AC-M1-08 login and Deep Linking
m1Test('M1-08.canvas.login-redirect', 'Canvas login goes to the fixed SSO authorize URL with unchanged hints', async () => {
  const p = await canvasPlatform();
  const started = await canvasLaunch(p, {}, { login: { lti_storage_target: 'post_message_forwarding' } });
  assert.equal(started.login.status, 200);
  assert.equal(started.login.headers.location, undefined);
  assert.equal(started.login.headers['cache-control'], 'no-store');
  assert.equal(started.login.headers['referrer-policy'], 'no-referrer');
  assert.match(String(started.login.headers['content-security-policy'] ?? ''),
    /^default-src 'none'; script-src 'nonce-[^']+'; frame-ancestors https:; form-action 'none'; base-uri 'none'$/);
  const block = started.login.body.match(/<script id="lti-storage-data" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(block, 'lti-storage-data JSON block');
  const data = JSON.parse(block) as { authUrl: string; target: string; origin: string; key: string; state: string };
  assert.equal(data.target, 'post_message_forwarding');
  assert.equal(data.origin, new URL(CLOUD.auth).origin);
  assert.match(data.key, /^cog_state_[0-9a-f]$/);
  const location = new URL(data.authUrl);
  assert.equal(`${location.origin}${location.pathname}`, CLOUD.auth);
  const q = location.searchParams;
  assert.equal(data.state, q.get('state'));
  assert.equal(q.get('client_id'), p.clientId);
  assert.equal(q.get('redirect_uri'), `${urls.lti}/lti/launch/cogniate`);
  assert.equal(q.get('login_hint'), (started.scenario as Json).id, 'login_hint unchanged');
  assert.equal(q.get('lti_message_hint'), `message-${(started.scenario as Json).id}`, 'lti_message_hint unchanged');
  for (const [name, value] of [['scope', 'openid'], ['response_type', 'id_token'], ['response_mode', 'form_post'], ['prompt', 'none']]) {
    assert.equal(q.get(name), value, `${name} (contract §2.1; Canvas requires it to be present)`);
  }
  assert.ok((q.get('state') ?? '').length >= 32); assert.ok((q.get('nonce') ?? '').length >= 32);
  assert.ok(started.cookie.startsWith('__Host-lti_state_'), 'State cookie set');
  const authorize = await httpsRequest(data.authUrl); expectStatus(authorize, 200);
  const { action, fields } = parseForm(authorize.body);
  rememberSecret(fields.id_token); rememberSecret(fields.state);
  const response = await formPost(action, fields, started.cookie);
  rememberSecret(response.headers.location ? new URL(String(response.headers.location)).searchParams.get('ltik') ?? '' : '');
  assert.equal(response.status, 303, 'The full Canvas launch with Canvas login extras succeeds');
  const oidc = (await records()).records.filter((r) => r.kind === 'canvas-oidc').at(-1)!;
  assert.deepEqual(oidc.missing, []);
});
m1Test('M1-08.canvas.deep-link', 'Canvas Deep Linking posts a verified response to the exact return URL with query data only', async () => {
  const b = await canvasBound(), pub = await publication(b, 'html');
  assert.equal((await host('m1-restart', { service: 'lti-service' })).code, 0, 'Cold JWKS cache');
  const cursor = (await records()).cursor;
  const picker = await canvasPicker(b);
  assert.ok(picker.page.body.includes(pub.id), 'Picker lists the library publication');
  assert.deepEqual(picker.settings.accept_presentation_document_targets, ['iframe', 'window']);
  assert.equal(Object.hasOwn(picker.settings, 'data'), false, 'Canvas request has no data claim');
  const selected = await pick(picker.url, pub.id); expectStatus(selected, 200);
  const form = parseForm(selected.body), jwt = form.fields.JWT;
  assert.equal(form.action, picker.settings.deep_link_return_url, 'Form action equals the claim byte for byte, query included');
  assert.ok(jwt, 'Response JWT field'); rememberSecret(jwt);
  const returned = await formPost(form.action, { JWT: jwt }); expectStatus(returned, 200);
  const claims = await verifyToolJwt(jwt);
  assert.equal(claims.iss, b.clientId);
  assert.equal(claims.aud, CLOUD.issuer, 'aud is the Canvas issuer as a string');
  assert.equal(claims[LTI + 'deployment_id'], b.deploymentId);
  assert.equal(claims[LTI + 'message_type'], 'LtiDeepLinkingResponse');
  assert.equal(Object.hasOwn(claims, DL + 'data'), false); assert.equal(Object.hasOwn(claims, 'sub'), false);
  const items = claims[DL + 'content_items'];
  assert.equal(items.length, 1);
  assert.equal(items[0].type, 'ltiResourceLink');
  assert.equal(items[0].url, `${urls.lti}/lti/launch/cogniate?resource=${pub.id}`);
  assert.equal(items[0].lineItem?.scoreMaximum, 100);
  assert.deepEqual(items[0].window, { targetName: '_blank' });
  const entries = (await records(cursor)).records;
  assert.ok(entries.some((r) => r.kind === 'jwks' && r.host === 'sso.canvas.sim.test' && r.path === '/api/lti/security/jwks'),
    'The LTI service fetched the Canvas JWKS from the SSO host');
  const dl = entries.filter((r) => r.kind === 'deep-link').at(-1)!;
  assert.equal(dl.host, 'school-a.canvas.sim.test'); assert.equal(dl.dataMode, 'query');
});

// ---------------------------------------------------------------- AC-M1-12 check 13
const foreign = CLOUD.siteB + '/api/lti/courses/course-9/line_items';
const claimCases: [string, string, string, Json, boolean][] = [
  ['ags-lineitems', 'ags_lineitems', CLOUD.siteB, { [AGS]: { lineitems: foreign, scope: SCOPE } }, false],
  ['ags-lineitem-evil', 'ags_lineitem', 'https://evil.test', { [AGS]: { lineitem: 'https://evil.test/lineitem', scope: SCOPE } }, false],
  ['nrps', 'nrps', CLOUD.siteB, { [NRPS]: { context_memberships_url: CLOUD.siteB + PATHS.nrps, service_versions: ['2.0'] } }, false],
  ['dl-return', 'dl_return', CLOUD.siteB, {}, true],
];
for (const [variant, claim, origin, claims, deepLink] of claimCases) {
  m1Test(`M1-12.canvas.${variant}`, `signed Canvas ${claim} outside the service or site origin is refused (check 13)`, async () => {
    const p = await canvasPlatform(), since = Date.now(), cursor = (await records()).cursor;
    const result = deepLink
      ? await canvasDeepLink(p, { pageHost: 'school-b.canvas.sim.test' })
      : await canvasLaunch(p, { claims });
    refused(result.response, 'SERVICE_ORIGIN_MISMATCH', [400]); assert.equal(result.ltik, '');
    const entries = logEvents('launch_check_failed', since, { check: '13', code: 'SERVICE_ORIGIN_MISMATCH' }, 'lti-service');
    assert.ok(entries.some((e) => e.detail === `claim=${claim} host=${origin}`), `detail claim=${claim} host=${origin}`);
    await noServiceCalls(cursor);
    assert.equal((await records(cursor)).records.some((r) => r.host === 'school-b.canvas.sim.test'), false);
    assert.deepEqual(sinkHitsSince(since), [], 'Zero evil.test sink hits');
  });
}

// ---------------------------------------------------------------- AC-M1-13 routing and deployment state
m1Test('M1-13.canvas.no-client-id', 'two Canvas platforms with one issuer need client_id at login', async () => {
  const a = await canvasPlatform(); await canvasPlatform();
  const login = await canvasLaunch(a, {}, { login: { client_id: null } });
  refused(login.login, 'UNKNOWN_PLATFORM', [400, 404]);
});
for (const kind of ['resource', 'deep-link'] as const) {
  m1Test(`M1-13.canvas.unknown-${kind}`, `an unknown Canvas deployment fails at login and at the ${kind} launch`, async () => {
    const p = await canvasPlatform(), missing = canvasDeploymentId();
    const messageType = kind === 'resource' ? 'LtiResourceLinkRequest' : 'LtiDeepLinkingRequest';
    const roles = [kind === 'resource' ? ROLE.learner : ROLE.instructor];
    const login = await canvasLaunch({ ...p, deploymentId: missing }, { messageType, roles });
    refused(login.login, 'UNKNOWN_DEPLOYMENT', [400, 403, 404]);
    const result = kind === 'resource'
      ? await canvasLaunch(p, { claims: { [LTI + 'deployment_id']: missing } })
      : await canvasDeepLink(p, { claims: { [LTI + 'deployment_id']: missing } });
    refused(result.response, 'UNKNOWN_DEPLOYMENT'); assert.equal(result.ltik, '');
  });
}
m1Test('M1-13.canvas.login-token-deployment', 'the signed Canvas deployment must equal the login deployment', async () => {
  const p = await canvasPlatform(), other = canvasDeploymentId(), since = Date.now();
  expectStatus(await admin('POST', deploymentPath(p.platformId), { deploymentId: other }), 201);
  const result = await canvasLaunch(p, {}, { login: { lti_deployment_id: other } });
  refused(result.response, 'UNKNOWN_DEPLOYMENT');
  assert.ok(logEvents('launch_check_failed', since, { code: 'UNKNOWN_DEPLOYMENT' }, 'lti-service')
    .some((e) => String(e.detail).includes('deployment_differs_from_login')));
});
m1Test('M1-13.canvas.inactive-deployment', 'an inactive Canvas deployment refuses login, launch, its ltik and its service key', async () => {
  const p = await canvasPlatform(), other = canvasDeploymentId();
  expectStatus(await admin('POST', deploymentPath(p.platformId), { deploymentId: other }), 201);
  const first = await canvasLaunch(p); assert.equal(first.response.status, 303);
  const token = await idToken(first.ltik); expectStatus(token, 200);
  const prepared = await preparedLaunch(scenarioOf(p));
  expectStatus(await admin('PATCH', deploymentPath(p.platformId, p.deploymentId), { active: false }), 200);
  refused((await canvasLaunch(p)).login, 'DEPLOYMENT_NOT_ACTIVE', [403]);
  refused(await prepared.submit(), 'DEPLOYMENT_NOT_ACTIVE', [403]);
  expectStatus(await idToken(first.ltik), 403, 'DEPLOYMENT_NOT_ACTIVE');
  expectStatus(await service(token.json.services.serviceKey, 'GET', '/api/lineitems'), 403, 'DEPLOYMENT_NOT_ACTIVE');
  assert.equal((await canvasLaunch({ ...p, deploymentId: other })).response.status, 303, 'Another deployment still works');
});

// ---------------------------------------------------------------- AC-M1-14 claim allowlist (API part)
m1Test('M1-14.canvas.claims', 'Canvas personal, custom, vendor and nested claims are removed before storage', async () => {
  const p = await canvasPlatform(), marker = unique('PII'), since = Date.now();
  const stripped: Json = { name: marker, given_name: marker, family_name: marker, email: marker, picture: marker, locale: marker,
    [LTI + 'lis']: { person_sourcedid: marker }, [LTI + 'lti1p1']: { user_id: marker }, [LTI + 'custom']: { canvas_user_login_id: marker },
    [LTI + 'lti11_legacy_user_id']: marker, 'https://www.instructure.com/placement': 'assignment_selection',
    'https://purl.imsglobal.org/spec/lti/claim/role_scope_mentor': [marker] };
  const result = await canvasLaunch(p, { claims: { ...stripped,
    [LTI + 'context']: { id: 'context-1', label: 'kept', title: 'Course', type: ['http://purl.imsglobal.org/vocab/lis/v2/course#CourseOffering'], extra: marker },
    [LTI + 'resource_link']: { id: 'resource-1', title: 'kept', description: 'kept', extra: marker },
    [LTI + 'tool_platform']: { guid: 'guid-1', name: 'Canvas', version: 'cloud', product_family_code: 'canvas', contact_email: marker, extra: marker },
    [LTI + 'launch_presentation']: { document_target: 'iframe', return_url: CLOUD.siteA + '/courses/1', locale: 'en', extra: marker },
  } });
  assert.equal(result.response.status, 303);
  const raw = await idToken(result.ltik, true); expectStatus(raw, 200);
  assert.equal(JSON.stringify(raw.json).includes(marker), false, 'No removed value is stored');
  const kept = ['iss', 'sub', 'aud', 'iat', 'exp', 'nonce',
    ...['message_type', 'version', 'deployment_id', 'target_link_uri', 'roles',
      'context', 'resource_link', 'tool_platform', 'launch_presentation'].map((key) => LTI + key), AGS, NRPS];
  assert.deepEqual(Object.keys(raw.json).sort(), kept.sort());
  assert.deepEqual(raw.json[LTI + 'context'], { id: 'context-1', label: 'kept', title: 'Course', type: ['http://purl.imsglobal.org/vocab/lis/v2/course#CourseOffering'] });
  assert.deepEqual(raw.json[LTI + 'resource_link'], { id: 'resource-1', title: 'kept', description: 'kept' });
  assert.deepEqual(raw.json[LTI + 'tool_platform'], { guid: 'guid-1', name: 'Canvas', version: 'cloud', product_family_code: 'canvas' });
  assert.deepEqual(raw.json[LTI + 'launch_presentation'], { document_target: 'iframe', return_url: CLOUD.siteA + '/courses/1', locale: 'en' });
  const normalized = await idToken(result.ltik); expectStatus(normalized, 200);
  assert.equal(normalized.json.user?.name, undefined); assert.equal(normalized.json.user?.email, undefined);
  assert.deepEqual(normalized.json.launch.custom, {});
  const entries = logEvents('launch_claims_minimized', since, { platform_id: p.platformId }, 'lti-service');
  assert.equal(entries.length, 1); assert.equal(JSON.stringify(entries).includes(marker), false);
  assert.deepEqual(entries[0].claims, [...Object.keys(stripped), LTI + 'context#extra', LTI + 'resource_link#extra',
    LTI + 'tool_platform#contact_email', LTI + 'tool_platform#extra', LTI + 'launch_presentation#extra'].sort());
});

// ---------------------------------------------------------------- AC-M1-25 site metadata
m1Test('M1-25.canvas.site-metadata', 'idtoken shows the Canvas site, service URL and profile', async () => {
  const p = await canvasPlatform(), result = await canvasLaunch(p); assert.equal(result.response.status, 303);
  const token = await idToken(result.ltik); expectStatus(token, 200);
  assert.deepEqual([token.json.platform.siteUrl, token.json.platform.serviceUrl, token.json.platform.profile],
    [CLOUD.siteA, CLOUD.siteA, CLOUD.profile]);
});
m1Test('M1-25.canvas.self-hosted-metadata', 'idtoken shows the self-hosted site and its separate service URL', async () => {
  const p = await canvasPlatform({ profile: SELF.profile, siteUrl: SELF.site, serviceUrl: SELF.service });
  const result = await canvasLaunch(p); assert.equal(result.response.status, 303);
  const token = await idToken(result.ltik); expectStatus(token, 200);
  assert.deepEqual([token.json.platform.siteUrl, token.json.platform.serviceUrl, token.json.platform.profile],
    [SELF.site, SELF.service, SELF.profile]);
});

// ---------------------------------------------------------------- AC-M1-34 signature and session checks
const faults: [string, string][] = [
  ['altered-signature', 'INVALID_SIGNATURE'], ['unknown-key', 'INVALID_SIGNATURE'], ['unknown-kid', 'INVALID_SIGNATURE'],
  ['none', 'INVALID_ID_TOKEN'], ['hs256', 'INVALID_ID_TOKEN'],
  ['wrong-issuer', 'INVALID_ISSUER_OR_AUDIENCE'], ['wrong-audience', 'INVALID_ISSUER_OR_AUDIENCE'],
  ['multi-aud-no-azp', 'INVALID_ISSUER_OR_AUDIENCE'], ['multi-aud-wrong-azp', 'INVALID_ISSUER_OR_AUDIENCE'],
  ['expired', 'TOKEN_EXPIRED'], ['future-iat', 'TOKEN_EXPIRED'], ['wrong-nonce', 'INVALID_NONCE'],
];
const profiles = [
  ['cloud', () => canvasPlatform()],
  ['self', () => canvasPlatform({ profile: SELF.profile, siteUrl: SELF.site, serviceUrl: SELF.service })],
] as const;
for (const [label, make] of profiles) {
  for (const [fault, code] of faults) {
    m1Test(`M1-34.canvas.${label}-${fault}`, `fresh signed ${label} Canvas login rejects ${fault}`, async () => {
      const p = await make(), since = Date.now(), cursor = (await records()).cursor;
      const result = await canvasLaunch(p, { fault });
      refused(result.response, code); assert.equal(result.ltik, '');
      assert.equal(logEvents('launch_accepted', since, { platform_id: p.platformId }, 'lti-service').length, 0, 'No stored launch');
      assert.equal(logEvents('launch_claims_minimized', since, { platform_id: p.platformId }, 'lti-service').length, 0);
      assert.ok(logEvents('launch_check_failed', since, { code }, 'lti-service').length >= 1);
      await noServiceCalls(cursor);
    });
  }
  m1Test(`M1-34.canvas.${label}-no-cookie`, `a valid ${label} Canvas signature cannot replace the state cookie`, async () => {
    const p = await make(), cursor = (await records()).cursor;
    const result = await canvasLaunch(p, {}, { noCookie: true });
    refused(result.response, 'STATE_COOKIE_MISSING'); assert.equal(result.ltik, ''); await noServiceCalls(cursor);
  });
  m1Test(`M1-34.canvas.${label}-replay`, `the ${label} Canvas state is single use`, async () => {
    const p = await make(), first = await canvasLaunch(p); assert.equal(first.response.status, 303);
    const replay = await formPost(`${urls.lti}/lti/launch/cogniate`, first.fields, first.cookie);
    refused(replay, 'INVALID_STATE');
    assert.equal(replay.headers.location, undefined);
  });
}

// ---------------------------------------------------------------- AC-M1-36 service key isolation
const base = `${CLOUD.siteA}${PATHS.lineitems}`;
for (const [variant, makeUrl] of [
  ['origin', (u: string) => u.replace('school-a.', 'school-b.')],
  ['path', (u: string) => new URL('/outside', u).href],
  ['encoded-dot', (u: string) => u + '/%2e%2e/private'],
  ['encoded-slash', (u: string) => u + '/%2f..%2fprivate'],
] as const) {
  m1Test(`M1-36.canvas.${variant}`, `a Canvas service key refuses a ${variant} escape without an outbound call`, async () => {
    const p = await canvasPlatform(), result = await canvasLaunch(p);
    const token = await idToken(result.ltik); expectStatus(token, 200);
    const key = token.json.services.serviceKey;
    expectStatus(await service(key, 'GET', '/api/lineitems?url=' + encodeURIComponent(base)), 200);
    const cursor = (await records()).cursor;
    expectStatus(await service(key, 'GET', '/api/lineitems?url=' + encodeURIComponent(makeUrl(base))), 400, 'INVALID_URL_PARAMETER');
    expectStatus(await service(key, 'GET', '/api/lineitems/' + encodeURIComponent(makeUrl(base))), 400, 'INVALID_LINE_ITEM_ID');
    await noServiceCalls(cursor);
  });
}
// "A changed claim query parameter" (API contract §3.4 rule 3) needs a claim URL that has a parameter. The default Canvas
// claim has none, and an added parameter keeps every claim parameter, so such a URL is valid there.
m1Test('M1-36.canvas.query', 'a Canvas service key refuses a query escape without an outbound call', async () => {
  const claimUrl = `${base}?scope_tag=qa-a`;
  const p = await canvasPlatform(), result = await canvasLaunch(p, { claims: { [AGS]: { lineitems: claimUrl, scope: SCOPE } } });
  const token = await idToken(result.ltik); expectStatus(token, 200);
  const key = token.json.services.serviceKey;
  expectStatus(await service(key, 'GET', '/api/lineitems?url=' + encodeURIComponent(claimUrl)), 200);
  const cursor = (await records()).cursor;
  for (const changed of [`${base}?scope_tag=qa-b`, base]) { // changed claim parameter value; claim parameter missing
    expectStatus(await service(key, 'GET', '/api/lineitems?url=' + encodeURIComponent(changed)), 400, 'INVALID_URL_PARAMETER');
    expectStatus(await service(key, 'GET', '/api/lineitems/' + encodeURIComponent(changed)), 400, 'INVALID_LINE_ITEM_ID');
  }
  await noServiceCalls(cursor);
});

// ---------------------------------------------------------------- AC-M1-39 signed family on a Canvas profile
m1Test('M1-39.canvas.blackboard-family-on-canvas', 'a BlackboardLearn-signed launch on canvas-sim-cloud is refused before storage', async () => {
  const p = await canvasPlatform(), since = Date.now(), cursor = (await records()).cursor;
  const result = await canvasLaunch(p, { claims: { [LTI + 'tool_platform']: { product_family_code: 'BlackboardLearn' } } });
  refused(result.response, 'PROVIDER_PROFILE_MISMATCH', [400]); assert.equal(result.ltik, '');
  assert.ok(logEvents('launch_check_failed', since, { check: '14' }, 'lti-service').some((e) => e.detail === 'family=blackboardlearn'));
  assert.equal(logEvents('launch_claims_minimized', since, { platform_id: p.platformId }, 'lti-service').length, 0);
  assert.ok(result.response.body.includes('Blackboard'), 'Action text names the signed LMS');
  await noServiceCalls(cursor);
});
m1Test('M1-39.canvas.upper-case-family', 'family CANVAS on a Canvas profile passes check 14', async () => {
  const p = await canvasPlatform();
  const result = await canvasLaunch(p, { claims: { [LTI + 'tool_platform']: { product_family_code: 'CANVAS' } } });
  assert.equal(result.response.status, 303); assert.ok(result.ltik);
});

// ---------------------------------------------------------------- AC-M1-40 (a) third page host
m1Test('M1-40.canvas.a-dl-third-host', 'Deep Linking whose return URL is on a third Canvas page host is refused', async () => {
  const p = await canvasPlatform(), since = Date.now(), cursor = (await records()).cursor;
  const result = await canvasDeepLink(p, { pageHost: 'canvas.school-a.sim.test' });
  refused(result.response, 'SERVICE_ORIGIN_MISMATCH', [400]);
  assert.ok(logEvents('launch_check_failed', since, { check: '13' }, 'lti-service')
    .some((e) => e.detail === 'claim=dl_return host=https://canvas.school-a.sim.test'));
  await noServiceCalls(cursor);
});
