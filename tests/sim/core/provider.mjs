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
  const providerScenarios = () => [...runtime.scenarios.values()].reverse().filter((s) => s.provider === config.id);
  const publicKeys = () => {
    const active = providerScenarios();
    if (active.some((s) => s.jwksKeys === 'second-only')) return { keys: [runtime.signer2.jwk] };
    if (active.some((s) => s.secondKey || s.useSecondKey || s.signingKey === 'second' || s.jwksKeys === 'both')) {
      return { keys: [runtime.signer.jwk, runtime.signer2.jwk] };
    }
    return { keys: [runtime.signer.jwk] };
  };
  const toolKeys = () => runtime.fetchJwks(`${runtime.publicLtiUrl}/lti/keys/cogniate`);
  const byClient = (clientId) => providerScenarios().find((s) => s.clientId === clientId);

  function effectiveTargetLinkUri(scenario) {
    let uri = scenario.targetLinkUri
      ?? `${runtime.publicLtiUrl}/lti/launch/cogniate?resource=${encodeURIComponent(scenario.resource)}`;
    if (scenario.ungradedPlacement === true || scenario.placement === 'ungraded') {
      const u = new URL(uri);
      u.searchParams.set('cogniate_placement', 'ungraded');
      uri = u.href;
    }
    return uri;
  }

  function claimsFor(scenario, params) {
    const now = Math.floor(Date.now() / 1000);
    const dlData = scenario.dlData ?? config.dlData;
    const family = scenario.family ?? config.family;
    const documentTarget = scenario.documentTarget ?? config.documentTarget ?? 'window';
    const lineitems = `https://${scenario.siteHost}${scenario.site.lineitems}`;
    const lineitem = `${lineitems}/${encodeURIComponent(scenario.resource)}`;
    const dlUrl = new URL(`https://${scenario.pageHost}${scenario.site.dlReturn}`);
    if (dlData === 'query') dlUrl.searchParams.set('data', scenario.data);
    let roles = [...(scenario.roles ?? ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'])];
    if (scenario.institutionAdmin === true || scenario.adminRole === 'institution') {
      const adminUri = 'http://purl.imsglobal.org/vocab/lis/v2/institution/person#Administrator';
      if (!roles.includes(adminUri)) {
        roles = [adminUri, ...roles.filter((r) => r !== 'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner')];
      }
    }
    if (scenario.systemAdmin === true || scenario.adminRole === 'system') {
      const sysAdminUri = 'http://purl.imsglobal.org/vocab/lis/v2/system/person#Administrator';
      if (!roles.includes(sysAdminUri)) {
        roles = [sysAdminUri, ...roles.filter((r) => r !== 'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner')];
      }
    }
    const claims = {
      iss: scenario.issuer ?? config.issuer, aud: scenario.clientId, sub: scenario.subject, iat: now, exp: now + 60,
      nonce: params.get('nonce'), [LTI + 'message_type']: scenario.messageType,
      [LTI + 'version']: '1.3.0', [LTI + 'deployment_id']: scenario.deploymentId,
      [LTI + 'target_link_uri']: effectiveTargetLinkUri(scenario),
      [LTI + 'roles']: roles,
      [LTI + 'context']: { id: scenario.contextId, title: 'QA course', label: 'QA' },
      [LTI + 'resource_link']: { id: scenario.resourceLinkId, title: 'QA resource' },
      [LTI + 'tool_platform']: { product_family_code: family },
      [LTI + 'launch_presentation']: { document_target: documentTarget, return_url: `https://${scenario.pageHost}/` },
      [AGS]: { lineitems, lineitem, scope: Object.values(SCOPES).filter((s) => s !== SCOPES.nrps) },
      [NRPS]: { context_memberships_url: `https://${scenario.siteHost}${scenario.site.nrps}`, service_versions: ['2.0'] },
    };
    if (scenario.extraAud !== undefined || scenario.extraAudiences !== undefined) {
      const extras = [scenario.extraAud ?? scenario.extraAudiences].flat().filter((v) => typeof v === 'string' && v.length > 0);
      claims.aud = [scenario.clientId, ...extras];
      if (scenario.azp !== null) claims.azp = scenario.azp ?? scenario.clientId;
    }
    if (scenario.messageType === 'LtiDeepLinkingRequest') {
      delete claims[LTI + 'resource_link'];
      const dlSettings = {
        deep_link_return_url: dlUrl.href,
        accept_types: scenario.acceptTypes ?? ['ltiResourceLink'],
        accept_presentation_document_targets: scenario.acceptPresentationDocumentTargets ?? ['window'],
        accept_multiple: Boolean(scenario.acceptMultiple ?? false),
        auto_create: Boolean(scenario.autoCreate ?? false),
        ...(dlData === 'claim' ? { data: scenario.data } : {}),
        ...structuredClone(scenario.dlSettings ?? scenario.deepLinkingSettings ?? {}),
      };
      if (scenario.acceptMultiple !== undefined) dlSettings.accept_multiple = Boolean(scenario.acceptMultiple);
      if (scenario.acceptLineitem !== undefined || scenario.acceptLineItem !== undefined) {
        dlSettings.accept_lineitem = Boolean(scenario.acceptLineitem ?? scenario.acceptLineItem);
      }
      if (scenario.acceptMediaTypes !== undefined) {
        dlSettings.accept_media_types = scenario.acceptMediaTypes;
      }
      claims[DL + 'deep_linking_settings'] = dlSettings;
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
    const signer = scenario.fault === 'unknown-key'
      ? runtime.stranger
      : (scenario.useSecondKey || scenario.signingKey === 'second')
        ? runtime.signer2
        : runtime.signer;
    const token = signer.sign(claims, scenario.fault);
    runtime.rememberSecret(token);
    runtime.record('auth', { provider: config.id, host: request.host, method: request.method,
      path: request.url.pathname, scenario: scenario.id, clientId: scenario.clientId, deploymentId: scenario.deploymentId,
      kid: signer.jwk.kid });
    return postForm(params.get('redirect_uri'), { id_token: token, state: params.get('state') });
  }

  async function token(request) {
    const params = form(request);
    runtime.rememberSecret(params.get('client_assertion'));
    required(params.get('grant_type') === 'client_credentials', 'Grant type');
    required(params.get('client_assertion_type') === 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer', 'Assertion type');
    const claims = verifyJwt(params.get('client_assertion'), await toolKeys());
    const clientScenario = byClient(claims.iss);
    const endpoint = `https://${request.host}${request.url.pathname}`;
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
    const rawAnswer = clientScenario?.tokenAnswers?.[clientScenario.tokenIndex];
    if (rawAnswer !== undefined) {
      if (!(typeof rawAnswer === 'object' && rawAnswer?.persistent)) clientScenario.tokenIndex++;
      if (rawAnswer === 'invalid_client' || (typeof rawAnswer === 'object' && rawAnswer?.error === 'invalid_client')) {
        const status = typeof rawAnswer === 'object' && rawAnswer?.status ? rawAnswer.status : 400;
        runtime.record('token', { provider: config.id, host: request.host, method: request.method, path: request.url.pathname,
          clientId: claims.iss, audience: claims.aud, scopes, status, error: 'invalid_client' });
        return json(status, {
          error: 'invalid_client',
          error_description: (typeof rawAnswer === 'object' ? rawAnswer.message : undefined) ?? 'Client authentication failed',
        });
      }
      const status = typeof rawAnswer === 'number' ? rawAnswer : (rawAnswer.status ?? 200);
      if (status < 200 || status >= 300) {
        const retryAfter = typeof rawAnswer === 'object' && rawAnswer !== null
          ? (rawAnswer.retryAfter ?? rawAnswer.headers?.['Retry-After'] ?? rawAnswer.headers?.['retry-after'] ?? null)
          : null;
        const extraHeaders = typeof rawAnswer === 'object' && rawAnswer !== null
          ? { ...(rawAnswer.headers ?? {}), ...(rawAnswer.retryAfter !== undefined ? { 'Retry-After': String(rawAnswer.retryAfter) } : {}) }
          : {};
        runtime.record('token', { provider: config.id, host: request.host, method: request.method, path: request.url.pathname,
          clientId: claims.iss, audience: claims.aud, scopes, status, ...(retryAfter !== null ? { retryAfter } : {}) });
        return json(status, {
          error: (typeof rawAnswer === 'object' ? rawAnswer.error : undefined) ?? 'rate_limit_exceeded',
          message: (typeof rawAnswer === 'object' ? (rawAnswer.message ?? rawAnswer.body) : undefined) ?? 'Too Many Requests',
        }, extraHeaders);
      }
    }
    const value = randomBytes(32).toString('base64url');
    runtime.rememberSecret(value);
    runtime.tokens.set(value, { provider: config.id, clientId: claims.iss, scopes, expires: Date.now() + 3600_000,
      host: config.sites.some((s) => s.host === request.host) ? request.host : null });
    runtime.record('token', { provider: config.id, host: request.host, method: request.method, path: request.url.pathname,
      clientId: claims.iss, audience: claims.aud, scopes, status: 200, tokenRef: runtime.tokenRef(value) });
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
      const scenario = providerScenarios().find((s) => s.clientId === access.clientId && s.siteHost === request.host);
      const rawAnswer = scenario?.nrpsAnswers?.[scenario.nrpsIndex++];
      if (rawAnswer !== undefined) {
        const status = typeof rawAnswer === 'number' ? rawAnswer : (rawAnswer.status ?? 200);
        if (status < 200 || status >= 300) {
          const retryAfter = typeof rawAnswer === 'object' && rawAnswer !== null
            ? (rawAnswer.retryAfter ?? rawAnswer.headers?.['Retry-After'] ?? rawAnswer.headers?.['retry-after'] ?? null)
            : null;
          const extraHeaders = typeof rawAnswer === 'object' && rawAnswer !== null
            ? { ...(rawAnswer.headers ?? {}), ...(rawAnswer.retryAfter !== undefined ? { 'Retry-After': String(rawAnswer.retryAfter) } : {}) }
            : {};
          runtime.record('nrps', { provider: config.id, host: request.host, method: request.method, path,
            tokenRef: access.tokenRef, status, ...(retryAfter !== null ? { retryAfter } : {}) });
          return json(status, {
            message: (typeof rawAnswer === 'object' ? (rawAnswer.message ?? rawAnswer.body) : undefined) ?? 'Too Many Requests',
          }, extraHeaders);
        }
      }
      const members = structuredClone(scenario?.members ?? scenario?.nrpsMembers ?? []);
      runtime.record('nrps', { provider: config.id, host: request.host, method: request.method, path,
        tokenRef: access.tokenRef, status: 200, memberCount: members.length });
      return json(200, { id: request.url.href, context: { id: scenario?.contextId ?? 'context-1' }, members },
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
    const scenario = providerScenarios().find((s) =>
      s.clientId === access.clientId && s.siteHost === request.host && s.resource === resource);
    const itemUrl = `https://${request.host}${site.lineitems}/${encodeURIComponent(resource)}`;
    let body;
    if (request.body) body = JSON.parse(request.body);
    const record = { provider: config.id, host: request.host, method: request.method, path, resource,
      tokenRef: access.tokenRef, contentType: request.headers['content-type'], body };
    if (scorePost) {
      required(scenario, 'Unknown score resource');
      required(request.headers['content-type']?.split(';')[0] === 'application/vnd.ims.lis.v1.score+json', 'Score content type');
      required(body.userId === scenario.subject, 'Score user');
      if (body.scoreGiven === undefined && scenario.allowNullScore) {
        required(!Object.hasOwn(body, 'scoreGiven'), 'Score numbers');
      } else {
        required(Number.isFinite(body.scoreGiven) && Number.isFinite(body.scoreMaximum) && body.scoreMaximum > 0, 'Score numbers');
      }
      required(body.activityProgress === 'Completed' && body.gradingProgress === 'FullyGraded', 'Score progress');
      required(Number.isFinite(Date.parse(body.timestamp)), 'Score timestamp');
      const answer = scenario.scoreAnswers[scenario.scoreIndex++] ?? { status: 204 };
      const status = typeof answer === 'number' ? answer : (answer.status ?? 204);
      const retryAfter = typeof answer === 'object' && answer !== null
        ? (answer.retryAfter ?? answer.headers?.['Retry-After'] ?? answer.headers?.['retry-after'] ?? null)
        : null;
      const extraHeaders = typeof answer === 'object' && answer !== null
        ? { ...(answer.headers ?? {}), ...(answer.retryAfter !== undefined ? { 'Retry-After': String(answer.retryAfter) } : {}) }
        : {};
      runtime.record('score', { ...record, status, ...(retryAfter !== null ? { retryAfter } : {}) });
      if (status >= 200 && status < 300) {
        runtime.scores.set(`${itemUrl}:${body.userId}`, { userId: body.userId,
          resultScore: body.scoreGiven, resultMaximum: body.scoreMaximum, scoreOf: itemUrl,
          ...(body.submission ? { submission: body.submission } : {}),
          ...(body.scoringUserId ? { scoringUserId: body.scoringUserId } : {}) });
      }
      const msg = (typeof answer === 'object' && answer !== null ? (answer.message ?? answer.body) : undefined) ?? 'Simulator score rejection';
      return status === 204 ? { status, headers: extraHeaders, body: '' }
        : json(status, { message: msg, ...(typeof answer === 'object' && answer?.error ? { error: answer.error } : {}) }, extraHeaders);
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
    required(Array.isArray(items), 'DL content_items array');
    const dlSettings = scenario.claims?.[DL + 'deep_linking_settings']
      ?? {
        ...(scenario.dlSettings ?? scenario.deepLinkingSettings ?? {}),
      };
    const allowMultiple = Boolean(scenario.acceptMultiple ?? dlSettings.accept_multiple ?? scenario.dlMultiple);
    const allowCancel = Boolean(
      scenario.dlAllowCancel ?? scenario.allowCancel ?? scenario.allowEmptyDl ?? dlSettings.allow_cancel ?? false,
    );
    const lineitemDisabled = scenario.acceptLineitem === false || scenario.acceptLineItem === false
      || dlSettings.accept_lineitem === false || scenario.ungradedPlacement === true
      || scenario.placement === 'ungraded' || scenario.dlUngraded === true;
    if (items.length === 0) {
      required(allowCancel, 'DL item count');
    } else if (allowMultiple) {
      required(items.length >= 1 && items.length <= 20, 'DL item count');
    } else {
      required(items.length === 1, 'DL item count');
    }
    for (const item of items) {
      required(item && item.type === 'ltiResourceLink', 'DL item');
      if (lineitemDisabled) {
        required(!Object.hasOwn(item, 'lineItem'), 'DL ungraded item must omit lineItem');
      } else {
        required(item.lineItem?.scoreMaximum === 100, 'DL item');
      }
      required(item.url?.startsWith(`${runtime.publicLtiUrl}/lti/launch/cogniate?resource=pub_`), 'DL resource URL');
      if (dlWindowHint) required(item.window?.targetName === '_blank', 'DL new window');
      else required(!Object.hasOwn(item, 'window'), 'DL window hint must be omitted');
    }
    runtime.dlNonces.add(claims.nonce);
    runtime.record('deep-link', { provider: config.id, host: request.host, method: request.method,
      path: request.url.pathname, scenario: scenario.id, clientId: claims.iss, audience: claims.aud,
      deploymentId: claims[LTI + 'deployment_id'], sub: claims.sub, dataMode: dlData, items,
      itemCount: items.length, cancelled: items.length === 0,
      ...(claims[DL + 'msg'] !== undefined ? { msg: claims[DL + 'msg'] } : {}) });
    return json(200, { accepted: true, items });
  }

  function findDrScenario(request) {
    const queryId = request.url.searchParams.get('scenario');
    if (queryId && runtime.scenarios.get(queryId)?.provider === config.id) return runtime.scenarios.get(queryId);
    const active = providerScenarios();
    const byPrefix = active.find((s) => {
      const iss = s.dr?.issuer ?? s.issuer;
      if (!iss) return false;
      const prefix = new URL(iss).pathname.replace(/\/$/, '');
      return prefix && request.url.pathname.startsWith(prefix + '/');
    });
    if (byPrefix) return byPrefix;
    return active.find((s) => s.siteHost === request.host || s.pageHost === request.host) ?? active[0] ?? null;
  }

  function matchesDrPath(path, basePaths, customField) {
    if (!config.dr) return false;
    if ((basePaths ?? []).includes(path)) return true;
    for (const s of providerScenarios()) {
      if (s.dr?.[customField] === path || s[customField] === path) return true;
      const iss = s.dr?.issuer ?? s.issuer;
      if (iss) {
        const prefix = new URL(iss).pathname.replace(/\/$/, '');
        if (prefix && (basePaths ?? []).some((bp) => path === `${prefix}${bp}`)) return true;
      }
    }
    return false;
  }

  function openidConfiguration(request) {
    const scenario = findDrScenario(request);
    const drOpts = { ...(config.dr ?? {}), ...(scenario?.dr ?? {}) };
    const effectiveIssuer = drOpts.issuer ?? scenario?.issuer ?? config.issuer;
    const issuerUrl = new URL(effectiveIssuer);
    const issuerPrefix = issuerUrl.pathname.replace(/\/$/, '');
    const defaultPrefix = new URL(config.issuer).pathname.replace(/\/$/, '');
    const customPrefix = issuerPrefix !== defaultPrefix ? issuerPrefix : '';

    const authEndpoint = drOpts.authorizationEndpoint ?? scenario?.authorizationEndpoint
      ?? `https://${config.auth.host}${customPrefix}${config.auth.path}`;
    const jwksUri = drOpts.jwksUri ?? scenario?.jwksUri
      ?? `https://${config.jwks.host}${customPrefix}${config.jwks.path}`;
    const useSecondTokenHost = Boolean(
      drOpts.secondTokenHost === true || scenario?.secondTokenHost === true
      || drOpts.foreignTokenHost === true || scenario?.foreignTokenHost === true
      || request.url.searchParams.get('second_token_host') === '1',
    );
    const tokenHost = drOpts.tokenHost ?? scenario?.tokenHost ?? request.url.searchParams.get('token_host')
      ?? (useSecondTokenHost
        ? (config.dr?.secondTokenHost ?? config.token.hosts[0])
        : (config.dr?.defaultTokenHost ?? (config.sites.some((s) => s.host === request.host) && config.token.hosts.includes(request.host) ? request.host : config.token.hosts[0])));
    const tokenEndpoint = drOpts.tokenEndpoint ?? scenario?.tokenEndpoint
      ?? `https://${tokenHost}${customPrefix}${config.token.path}`;
    const regPath = drOpts.registrationPath ?? scenario?.registrationPath
      ?? `${customPrefix}${config.dr.registrationPaths[0]}`;
    const registrationEndpoint = drOpts.registrationEndpoint ?? scenario?.registrationEndpoint
      ?? `https://${request.host}${regPath}${scenario ? `?scenario=${encodeURIComponent(scenario.id)}` : ''}`;
    const authorizationServer = drOpts.authorizationServer !== undefined
      ? drOpts.authorizationServer
      : (scenario?.authorizationServer !== undefined
        ? scenario.authorizationServer
        : (request.url.searchParams.get('authorization_server') ?? config.dr?.authorizationServer ?? null));
    const scopesSupported = drOpts.scopesSupported ?? scenario?.scopesSupported
      ?? ['openid', ...Object.values(SCOPES)];
    const messagesSupported = drOpts.messagesSupported ?? scenario?.messagesSupported
      ?? [
        { type: 'LtiResourceLinkRequest' },
        { type: 'LtiDeepLinkingRequest', placements: ['ContentArea'] },
      ];
    const family = drOpts.productFamilyCode ?? scenario?.family ?? config.family;
    const doc = {
      issuer: effectiveIssuer,
      authorization_endpoint: authEndpoint,
      token_endpoint: tokenEndpoint,
      token_endpoint_auth_methods_supported: ['private_key_jwt'],
      token_endpoint_auth_signing_alg_values_supported: ['RS256'],
      jwks_uri: jwksUri,
      registration_endpoint: registrationEndpoint,
      scopes_supported: scopesSupported,
      response_types_supported: ['id_token'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      claims_supported: ['iss', 'sub', 'name', 'given_name', 'family_name', 'email'],
      ...(authorizationServer ? { authorization_server: authorizationServer } : {}),
      'https://purl.imsglobal.org/spec/lti-platform-configuration': {
        product_family_code: family,
        version: '1.3.0',
        messages_supported: messagesSupported,
        variables: [],
      },
    };
    runtime.record('openid-configuration', {
      provider: config.id,
      host: request.host,
      method: request.method,
      path: request.url.pathname,
      scenario: scenario?.id ?? null,
      issuer: effectiveIssuer,
      tokenEndpoint,
      registrationEndpoint,
      authorizationServer: authorizationServer ?? null,
    });
    return json(200, doc);
  }

  function registerTool(request) {
    const authHeader = String(request.headers.authorization ?? '');
    const match = /^Bearer\s+(\S+)$/i.exec(authHeader);
    required(Boolean(match), 'DR registration Bearer token required');
    const bearerToken = match[1];
    runtime.rememberSecret(bearerToken);

    const byToken = providerScenarios().find((s) => s.registrationToken === bearerToken);
    const scenario = byToken ?? findDrScenario(request);
    const expectedFormat = scenario?.dr?.tokenFormat ?? scenario?.registrationTokenFormat ?? config.dr?.tokenFormat ?? 'opaque-bearer';
    const isJwt = bearerToken.split('.').length === 3;
    let tokenScope = null;
    let tokenSub = null;
    if (expectedFormat === 'moodle-scope-jwt' || expectedFormat === 'jwt') {
      required(isJwt, 'DR JWT registration token required');
      const claims = verifyJwt(bearerToken, { keys: [runtime.signer.jwk, runtime.signer2.jwk] });
      required(['reg', 'reg-create', 'reg-update'].includes(claims.scope), 'DR JWT scope must be reg, reg-create or reg-update');
      tokenScope = claims.scope;
      tokenSub = claims.sub ?? null;
    } else {
      if (scenario?.dr?.strictOpaque || scenario?.strictTokenFormat) {
        required(!isJwt, 'DR opaque bearer token required');
      }
      required(bearerToken !== 'invalid' && bearerToken !== 'bad-token', 'DR invalid bearer token');
      if (scenario?.registrationToken && (scenario?.dr?.enforceToken || scenario?.enforceRegistrationToken)) {
        required(bearerToken === scenario.registrationToken, 'DR bearer token mismatch');
      }
    }

    const body = JSON.parse(request.body || '{}');
    required(body.application_type === 'web', 'DR application_type');
    required(Array.isArray(body.response_types) && body.response_types.includes('id_token'), 'DR response_types');
    required(Array.isArray(body.grant_types) && body.grant_types.includes('client_credentials'), 'DR grant_types');
    required(typeof body.initiate_login_uri === 'string' && body.initiate_login_uri.startsWith('https://'), 'DR initiate_login_uri');
    required(Array.isArray(body.redirect_uris) && body.redirect_uris.length > 0
      && body.redirect_uris.every((u) => typeof u === 'string' && u.startsWith('https://')), 'DR redirect_uris');
    required(typeof body.jwks_uri === 'string' && body.jwks_uri.startsWith('https://'), 'DR jwks_uri');
    required(body.token_endpoint_auth_method === 'private_key_jwt', 'DR token_endpoint_auth_method');
    const toolConfig = body['https://purl.imsglobal.org/spec/lti-tool-configuration'];
    required(toolConfig && typeof toolConfig === 'object' && typeof toolConfig.domain === 'string', 'DR lti-tool-configuration');

    const scope = typeof body.scope === 'string' ? body.scope : '';
    const scopes = scope.split(/\s+/).filter(Boolean);
    const messages = Array.isArray(toolConfig.messages) ? toolConfig.messages : [];
    const claims = Array.isArray(toolConfig.claims) ? toolConfig.claims : [];
    const clientId = scenario?.clientId ?? `dr-client-${config.id}-${randomBytes(4).toString('hex')}`;
    const deploymentId = scenario?.deploymentId ?? config.deployments?.[0]
      ?? (config.deploymentFormat === 'uuid' ? '8f3d9a10-4b2c-4e8a-9c1d-2f5a6b7c8d90' : '1');
    const grantedScope = scenario?.dr?.grantedScope ?? scenario?.grantedScope ?? scope;

    if (!scenario) {
      const siteHost = config.sites.some((s) => s.host === request.host) ? request.host : config.sites[0].host;
      runtime.scenario({
        id: `auto-dr-${randomBytes(4).toString('hex')}`,
        provider: config.id,
        clientId,
        deploymentId,
        siteHost,
      });
    }

    runtime.record('registration', {
      provider: config.id,
      host: request.host,
      method: request.method,
      path: request.url.pathname,
      scenario: scenario?.id ?? null,
      tokenFormat: isJwt ? 'moodle-scope-jwt' : 'opaque-bearer',
      tokenScope,
      tokenSub,
      clientId,
      deploymentId,
      scope,
      scopes,
      grantedScope,
      messages,
      claims,
      redirectUris: body.redirect_uris,
      initiateLoginUri: body.initiate_login_uri,
      jwksUri: body.jwks_uri,
      clientName: body.client_name ?? null,
      toolConfiguration: toolConfig,
      body,
    });

    return json(200, {
      client_id: clientId,
      response_types: body.response_types,
      jwks_uri: body.jwks_uri,
      initiate_login_uri: body.initiate_login_uri,
      grant_types: body.grant_types,
      redirect_uris: body.redirect_uris,
      application_type: body.application_type,
      token_endpoint_auth_method: body.token_endpoint_auth_method,
      client_name: body.client_name ?? 'Cogniate',
      ...(body.logo_uri ? { logo_uri: body.logo_uri } : {}),
      scope: grantedScope,
      'https://purl.imsglobal.org/spec/lti-tool-configuration': {
        ...toolConfig,
        deployment_id: deploymentId,
      },
    });
  }

  function storageScript() {
    return `<script>
(function() {
  const localStore = new Map();
  window.addEventListener('message', async function(event) {
    if (!event.origin || !event.origin.startsWith('https://') || !event.source) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.subject !== 'lti.put_data' && data.subject !== 'lti.get_data') return;
    if (typeof data.message_id !== 'string' || !data.message_id || typeof data.key !== 'string' || !data.key) return;
    try {
      const res = await fetch('/__storage', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-storage-origin': event.origin },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const payload = await res.json();
        event.source.postMessage(payload.response, payload.targetOrigin);
        return;
      }
    } catch {}
    let originMap = localStore.get(event.origin);
    if (!originMap) { originMap = new Map(); localStore.set(event.origin, originMap); }
    if (data.subject === 'lti.put_data' && typeof data.value === 'string') {
      originMap.set(data.key, data.value);
      event.source.postMessage({ subject: 'lti.put_data.response', message_id: data.message_id }, event.origin);
    } else if (data.subject === 'lti.get_data') {
      const value = originMap.get(data.key);
      event.source.postMessage({
        subject: 'lti.get_data.response',
        message_id: data.message_id,
        ...(value !== undefined ? { value } : {}),
      }, event.origin);
    }
  });
})();
</script>`;
  }

  function storageFrame() {
    return {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
      body: `<!doctype html><meta charset="utf-8"><title>QA LMS storage frame</title>${storageScript()}`,
    };
  }

  function storageMessage(request) {
    const senderOrigin = String(request.headers['x-storage-origin'] ?? request.headers.origin ?? '');
    required(
      senderOrigin.startsWith('https://')
        && senderOrigin !== 'https://*'
        && senderOrigin !== `https://${request.host}`,
      'Storage sender origin',
    );
    const data = JSON.parse(request.body || '{}');
    required(data && typeof data === 'object', 'Storage message object');
    required(data.subject === 'lti.put_data' || data.subject === 'lti.get_data', 'Storage message subject');
    required(typeof data.message_id === 'string' && data.message_id.length > 0, 'Storage message_id');
    required(typeof data.key === 'string' && data.key.length > 0, 'Storage key');

    const partitionKey = `${config.id}::${senderOrigin}`;
    let originStore = runtime.storage.get(partitionKey);
    if (!originStore) {
      originStore = new Map();
      runtime.storage.set(partitionKey, originStore);
    }

    if (data.subject === 'lti.put_data') {
      required(typeof data.value === 'string', 'Storage value');
      originStore.set(data.key, data.value);
      const response = { subject: 'lti.put_data.response', message_id: data.message_id };
      runtime.record('storage', {
        provider: config.id,
        host: request.host,
        op: 'lti.put_data',
        origin: senderOrigin,
        messageId: data.message_id,
        key: data.key,
      });
      return json(200, { targetOrigin: senderOrigin, response, ...response });
    }

    const value = originStore.get(data.key);
    const response = {
      subject: 'lti.get_data.response',
      message_id: data.message_id,
      ...(value !== undefined ? { value } : {}),
    };
    runtime.record('storage', {
      provider: config.id,
      host: request.host,
      op: 'lti.get_data',
      origin: senderOrigin,
      messageId: data.message_id,
      key: data.key,
      hit: value !== undefined,
    });
    return json(200, { targetOrigin: senderOrigin, response, ...response });
  }

  return {
    id: config.id, hosts,
    async handle(request) {
      if (!hosts.includes(request.host)) return null;
      try {
        const path = request.url.pathname;
        if (request.host === config.jwks.host
          && (pathMatches(config.jwks.path, path) || (typeof config.jwks.path === 'string' && path.endsWith(config.jwks.path)))
          && request.method === 'GET') {
          runtime.record('jwks', { provider: config.id, host: request.host, method: request.method, path });
          return json(200, publicKeys());
        }
        if (request.host === config.auth.host && (path === '/__storage' || path === '/post_message_forwarding')) {
          if (request.method === 'GET') return storageFrame();
          if (request.method === 'POST') return storageMessage(request);
        }
        if (request.host === config.auth.host && (path === config.auth.path || path.endsWith(config.auth.path))
          && config.auth.methods.includes(request.method)) {
          return await auth(request);
        }
        if (config.token.hosts.includes(request.host) && (path === config.token.path || path.endsWith(config.token.path))
          && request.method === 'POST') {
          return await token(request);
        }
        if (config.dr && (config.dr.hosts ?? hosts).includes(request.host)) {
          if (request.method === 'GET' && matchesDrPath(path, config.dr.configPaths, 'configPath')) {
            return openidConfiguration(request);
          }
          if (request.method === 'POST' && matchesDrPath(path, config.dr.registrationPaths, 'registrationPath')) {
            return registerTool(request);
          }
        }
        const site = config.sites.find((s) => s.host === request.host);
        const pageHost = Boolean(site) || (config.pageHosts ?? []).includes(request.host);
        if ((pageHost || request.host === config.auth.host) && path === '/__frame' && request.method === 'GET') {
          const target = new URL(request.url.searchParams.get('url'));
          required(target.protocol === 'https:' && target.hostname.endsWith('.test'), 'Frame target');
          const activeStorage = request.url.searchParams.get('storage')
            ?? providerScenarios().find((s) => s.storageTarget)?.storageTarget
            ?? null;
          if (!activeStorage) {
            return { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
              body: `<!doctype html><title>QA LMS frame</title><iframe title="LTI tool" src="${htmlEscape(target.href)}" style="width:100%;height:90vh"></iframe>` };
          }
          const siblingFrame = activeStorage === '_parent'
            ? ''
            : `<iframe name="${htmlEscape(activeStorage)}" src="https://${htmlEscape(config.auth.host)}/__storage" style="display:none"></iframe>`;
          return { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
            body: `<!doctype html><title>QA LMS frame</title>${siblingFrame}<iframe title="LTI tool" src="${htmlEscape(target.href)}" style="width:100%;height:90vh"></iframe>${storageScript()}` };
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
