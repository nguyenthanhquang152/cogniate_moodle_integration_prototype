// Protocol fixtures from the accepted provider sources, not production code.
import { randomBytes } from 'node:crypto';
import { verifyJwt } from './crypto.mjs';
import { AGS, DL, LTI, NRPS, SCOPES, htmlEscape, json, postForm } from './runtime.mjs';

function form(request) { return request.method === 'GET' ? request.url.searchParams : new URLSearchParams(request.body); }
function pathMatches(pattern, path) { return typeof pattern === 'string' ? path === pattern : Boolean(path.match(pattern)); }
function required(condition, message) { if (!condition) throw new Error(message); }

export function createProvider(runtime, config) {
  runtime.register(config);
  const hosts = [...new Set([config.auth.host, config.jwks.host, ...config.token.hosts,
    ...config.sites.map((s) => s.host), ...(config.pageHosts ?? [])])];
  const publicKeys = () => ({ keys: [runtime.signer.jwk] });
  const toolKeys = () => runtime.fetchJwks(`${runtime.publicLtiUrl}/lti/keys/cogniate`);
  const byClient = (clientId) => [...runtime.scenarios.values()].reverse().find((s) => s.provider === config.id && s.clientId === clientId);

  function claimsFor(scenario, params) {
    const now = Math.floor(Date.now() / 1000);
    const dlData = scenario.dlData ?? config.dlData;
    const family = scenario.family ?? config.family;
    const documentTarget = scenario.documentTarget ?? config.documentTarget ?? 'window';
    const lineitems = `https://${scenario.siteHost}${scenario.site.lineitems}`;
    const lineitem = `${lineitems}/${encodeURIComponent(scenario.resource)}`;
    const dlUrl = new URL(`https://${scenario.pageHost}${scenario.site.dlReturn}`);
    if (dlData === 'query') dlUrl.searchParams.set('data', scenario.data);
    const claims = {
      iss: scenario.issuer ?? config.issuer, aud: scenario.clientId, sub: scenario.subject, iat: now, exp: now + 60,
      nonce: params.get('nonce'), [LTI + 'message_type']: scenario.messageType,
      [LTI + 'version']: '1.3.0', [LTI + 'deployment_id']: scenario.deploymentId,
      [LTI + 'target_link_uri']: `${runtime.publicLtiUrl}/lti/launch/cogniate?resource=${encodeURIComponent(scenario.resource)}`,
      [LTI + 'roles']: scenario.roles,
      [LTI + 'context']: { id: scenario.contextId, title: 'QA course', label: 'QA' },
      [LTI + 'resource_link']: { id: scenario.resourceLinkId, title: 'QA resource' },
      [LTI + 'tool_platform']: { product_family_code: family },
      [LTI + 'launch_presentation']: { document_target: documentTarget, return_url: `https://${scenario.pageHost}/` },
      [AGS]: { lineitems, lineitem, scope: Object.values(SCOPES).filter((s) => s !== SCOPES.nrps) },
      [NRPS]: { context_memberships_url: `https://${scenario.siteHost}${scenario.site.nrps}`, service_versions: ['2.0'] },
    };
    if (scenario.messageType === 'LtiDeepLinkingRequest') {
      delete claims[LTI + 'resource_link'];
      claims[DL + 'deep_linking_settings'] = {
        deep_link_return_url: dlUrl.href, accept_types: ['ltiResourceLink'],
        accept_presentation_document_targets: ['window'], accept_multiple: false, auto_create: false,
        ...(dlData === 'claim' ? { data: scenario.data } : {}),
      };
    }
    Object.assign(claims, structuredClone(scenario.claims));
    for (const field of scenario.omit) delete claims[field];
    switch (scenario.fault) {
      case 'wrong-issuer': claims.iss = 'https://wrong-issuer.sim.test'; break;
      case 'wrong-audience': claims.aud = 'wrong-client'; break;
      case 'multi-aud-no-azp': claims.aud = [scenario.clientId, 'another-client']; delete claims.azp; break;
      case 'multi-aud-wrong-azp': claims.aud = [scenario.clientId, 'another-client']; claims.azp = 'wrong-client'; break;
      case 'expired': claims.iat = now - 600; claims.exp = now - 300; break;
      case 'future-iat': claims.iat = now + 600; claims.exp = now + 900; break;
      case 'wrong-nonce': claims.nonce = 'wrong-nonce'; break;
    }
    return claims;
  }

  async function auth(request) {
    const params = form(request), scenario = runtime.scenarios.get(params.get('login_hint'));
    required(scenario?.provider === config.id, 'Unknown login hint');
    required(params.get('client_id') === scenario.clientId, 'Client id');
    required(params.get('lti_message_hint') === scenario.messageHint, 'Message hint');
    required(params.get('redirect_uri') === `${runtime.publicLtiUrl}/lti/launch/cogniate`, 'Redirect URI');
    required(params.get('response_type') === 'id_token' && params.get('scope') === 'openid', 'OIDC parameters');
    required(Boolean(params.get('nonce')) && Boolean(params.get('state')), 'State and nonce');
    const claims = claimsFor(scenario, params);
    const signer = scenario.fault === 'unknown-key' ? runtime.stranger : runtime.signer;
    const token = signer.sign(claims, scenario.fault);
    runtime.rememberSecret(token);
    runtime.record('auth', { provider: config.id, host: request.host, method: request.method,
      path: request.url.pathname, scenario: scenario.id, clientId: scenario.clientId, deploymentId: scenario.deploymentId });
    return postForm(params.get('redirect_uri'), { id_token: token, state: params.get('state') });
  }

  async function token(request) {
    const params = form(request);
    runtime.rememberSecret(params.get('client_assertion'));
    required(params.get('grant_type') === 'client_credentials', 'Grant type');
    required(params.get('client_assertion_type') === 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer', 'Assertion type');
    const claims = verifyJwt(params.get('client_assertion'), await toolKeys());
    const clientScenario = byClient(claims.iss);
    const endpoint = `https://${request.host}${config.token.path}`;
    const audienceMode = clientScenario?.tokenAudience ?? config.token.audience;
    const aud = audienceMode === 'array'
      ? [endpoint]
      : (!audienceMode || audienceMode === 'string' || audienceMode === 'token')
        ? endpoint
        : audienceMode;
    required(JSON.stringify(claims.aud) === JSON.stringify(aud), 'JWT audience');
    required(claims.iss === claims.sub && Boolean(clientScenario), 'Assertion client');
    required(typeof claims.jti === 'string' && claims.jti && !runtime.jtis.has(claims.jti), 'Assertion jti');
    const scopes = (params.get('scope') ?? '').split(' ').filter(Boolean);
    required(scopes.length > 0 && scopes.every((s) => Object.values(SCOPES).includes(s)), 'Scopes');
    runtime.jtis.add(claims.jti);
    const value = randomBytes(32).toString('base64url');
    runtime.rememberSecret(value);
    runtime.tokens.set(value, { provider: config.id, clientId: claims.iss, scopes, expires: Date.now() + 3600_000,
      host: config.sites.some((s) => s.host === request.host) ? request.host : null });
    runtime.record('token', { provider: config.id, host: request.host, method: request.method, path: request.url.pathname,
      clientId: claims.iss, audience: claims.aud, scopes, tokenRef: runtime.tokenRef(value) });
    return json(200, { access_token: value, token_type: 'Bearer', expires_in: 3600, scope: scopes.join(' ') });
  }

  function bearer(request, scope) {
    const header = request.headers.authorization ?? '';
    const value = header.startsWith('Bearer ') ? header.slice(7) : '';
    const auth = runtime.tokens.get(value);
    required(auth && auth.provider === config.id && auth.expires > Date.now(), 'Bearer token');
    required(!auth.host || auth.host === request.host, 'Bearer host');
    required(auth.scopes.includes(scope) || (scope === SCOPES.readonly && auth.scopes.includes(SCOPES.lineitem)), 'Bearer scope');
    return { ...auth, tokenRef: runtime.tokenRef(value) };
  }

  function services(request, site) {
    const path = request.url.pathname;
    if (path === site.nrps && request.method === 'GET') {
      const access = bearer(request, SCOPES.nrps);
      runtime.record('nrps', { provider: config.id, host: request.host, method: request.method, path, tokenRef: access.tokenRef });
      return json(200, { id: request.url.href, context: { id: 'context-1' }, members: [] },
        { 'content-type': 'application/vnd.ims.lti-nrps.v2.membershipcontainer+json' });
    }
    if (path !== site.lineitems && !path.startsWith(site.lineitems + '/')) return null;
    const suffix = path.slice(site.lineitems.length);
    required(/^\/?[^/]*(?:\/(?:scores|results))?$/.test(suffix), 'AGS path');
    const scorePost = suffix.endsWith('/scores') && request.method === 'POST';
    const resultGet = suffix.endsWith('/results') && request.method === 'GET';
    const scope = scorePost ? SCOPES.score : resultGet ? SCOPES.result : request.method === 'GET' ? SCOPES.readonly : SCOPES.lineitem;
    const access = bearer(request, scope);
    const resource = decodeURIComponent(suffix.split('/')[1] ?? '');
    const scenario = [...runtime.scenarios.values()].reverse().find((s) =>
      s.provider === config.id && s.clientId === access.clientId && s.siteHost === request.host && s.resource === resource);
    const itemUrl = `https://${request.host}${site.lineitems}/${encodeURIComponent(resource)}`;
    let body;
    if (request.body) body = JSON.parse(request.body);
    const record = { provider: config.id, host: request.host, method: request.method, path, resource,
      tokenRef: access.tokenRef, contentType: request.headers['content-type'], body };
    if (scorePost) {
      required(scenario, 'Unknown score resource');
      required(request.headers['content-type']?.split(';')[0] === 'application/vnd.ims.lis.v1.score+json', 'Score content type');
      required(body.userId === scenario.subject, 'Score user');
      required(Number.isFinite(body.scoreGiven) && Number.isFinite(body.scoreMaximum) && body.scoreMaximum > 0, 'Score numbers');
      required(body.activityProgress === 'Completed' && body.gradingProgress === 'FullyGraded', 'Score progress');
      required(Number.isFinite(Date.parse(body.timestamp)), 'Score timestamp');
      const answer = scenario.scoreAnswers[scenario.scoreIndex++] ?? { status: 204 };
      const status = typeof answer === 'number' ? answer : answer.status;
      runtime.record('score', { ...record, status });
      if (status >= 200 && status < 300) {
        runtime.scores.set(`${itemUrl}:${body.userId}`, { userId: body.userId,
          resultScore: body.scoreGiven, resultMaximum: body.scoreMaximum, scoreOf: itemUrl });
      }
      return status === 204 ? { status, headers: {}, body: '' }
        : json(status, { message: answer.message ?? 'Simulator score rejection' });
    }
    runtime.record('ags', record);
    if (resultGet) return json(200, [...runtime.scores].filter(([key]) => key.startsWith(itemUrl + ':')).map(([, v]) => v));
    if (request.method === 'GET' && suffix === '') {
      return json(200, [...runtime.lineitems.values()].filter((item) => item.id.startsWith(`https://${request.host}${site.lineitems}/`)));
    }
    if (request.method === 'GET') return json(200, runtime.lineitems.get(itemUrl) ?? { id: itemUrl, label: 'QA line item', scoreMaximum: 100, resourceId: resource });
    if (request.method === 'POST' && suffix === '') {
      const id = `https://${request.host}${site.lineitems}/${encodeURIComponent(body.resourceId ?? randomBytes(8).toString('hex'))}`;
      const item = { ...body, id }; runtime.lineitems.set(id, item);
      return json(201, item);
    }
    if (request.method === 'PUT' && resource) { const item = { ...body, id: itemUrl }; runtime.lineitems.set(itemUrl, item); return json(200, item); }
    if (request.method === 'DELETE' && resource) { runtime.lineitems.delete(itemUrl); return { status: 204, headers: {}, body: '' }; }
    return json(405, { error: 'AGS method' });
  }

  async function deepLinkReturn(request) {
    const params = form(request);
    runtime.rememberSecret(params.get('JWT'));
    const claims = verifyJwt(params.get('JWT'), await toolKeys(), { requireNonce: true });
    const scenario = [...runtime.scenarios.values()].find((s) =>
      s.provider === config.id && s.clientId === claims.iss && s.deploymentId === claims[LTI + 'deployment_id']
      && s.pageHost === request.host && s.messageType === 'LtiDeepLinkingRequest'
      && ((s.dlData ?? config.dlData) === 'query' ? request.url.searchParams.get('data') === s.data : claims[DL + 'data'] === s.data));
    const expectedAudience = scenario?.issuer ?? config.issuer;
    required(JSON.stringify(claims.aud) === JSON.stringify(expectedAudience), 'JWT audience');
    required(scenario, 'DL return scenario and data');
    const dlData = scenario.dlData ?? config.dlData;
    const dlSubject = scenario.dlSubject ?? config.dlSubject;
    const dlWindowHint = scenario.dlWindowHint ?? config.dlWindowHint ?? true;
    required(claims[LTI + 'message_type'] === 'LtiDeepLinkingResponse' && claims[LTI + 'version'] === '1.3.0', 'DL protocol');
    required(dlSubject ? claims.sub === scenario.clientId : !Object.hasOwn(claims, 'sub'), 'DL subject');
    if (dlData === 'query') required(!Object.hasOwn(claims, DL + 'data'), 'Canvas DL data must be query only');
    required(!runtime.dlNonces.has(claims.nonce), 'DL replay');
    const items = claims[DL + 'content_items'];
    required(Array.isArray(items) && items.length === 1, 'DL item count');
    required(items[0].type === 'ltiResourceLink' && items[0].lineItem?.scoreMaximum === 100, 'DL item');
    required(items[0].url?.startsWith(`${runtime.publicLtiUrl}/lti/launch/cogniate?resource=pub_`), 'DL resource URL');
    if (dlWindowHint) required(items[0].window?.targetName === '_blank', 'DL new window');
    else required(!Object.hasOwn(items[0], 'window'), 'DL window hint must be omitted');
    runtime.dlNonces.add(claims.nonce);
    runtime.record('deep-link', { provider: config.id, host: request.host, method: request.method,
      path: request.url.pathname, scenario: scenario.id, clientId: claims.iss, audience: claims.aud,
      deploymentId: claims[LTI + 'deployment_id'], sub: claims.sub, dataMode: dlData, items });
    return json(200, { accepted: true, items });
  }

  return {
    id: config.id, hosts,
    async handle(request) {
      if (!hosts.includes(request.host)) return null;
      try {
        const path = request.url.pathname;
        if (request.host === config.jwks.host && pathMatches(config.jwks.path, path) && request.method === 'GET') {
          runtime.record('jwks', { provider: config.id, host: request.host, method: request.method, path });
          return json(200, publicKeys());
        }
        if (request.host === config.auth.host && path === config.auth.path && config.auth.methods.includes(request.method)) return await auth(request);
        if (config.token.hosts.includes(request.host) && path === config.token.path && request.method === 'POST') return await token(request);
        const site = config.sites.find((s) => s.host === request.host);
        const pageHost = Boolean(site) || (config.pageHosts ?? []).includes(request.host);
        if (pageHost && path === '/__frame' && request.method === 'GET') {
          const target = new URL(request.url.searchParams.get('url'));
          required(target.protocol === 'https:' && target.hostname.endsWith('.test'), 'Frame target');
          return { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
            body: `<!doctype html><title>QA LMS frame</title><iframe title="LTI tool" src="${htmlEscape(target.href)}" style="width:100%;height:90vh"></iframe>` };
        }
        if (pageHost && config.sites.some((s) => s.dlReturn === path) && request.method === 'POST') return await deepLinkReturn(request);
        if (site) return services(request, site);
        return null;
      } catch (e) {
        runtime.record('rejected', { provider: config.id, host: request.host, method: request.method,
          path: request.url.pathname, reason: e.message });
        return json(400, { error: e.message });
      }
    },
  };
}
