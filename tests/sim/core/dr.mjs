import { randomBytes } from 'node:crypto';
import { verifyJwt } from './crypto.mjs';
import { SCOPES, json } from './runtime.mjs';

function required(condition, message) {
  if (!condition) throw new Error(message);
}

export function createDrHandlers(runtime, config, providerScenarios) {
  function findDrScenario(request) {
    const queryId = request.url.searchParams.get('scenario');
    if (queryId && runtime.scenarios.get(queryId)?.provider === config.id) {
      return runtime.scenarios.get(queryId);
    }
    const active = providerScenarios();
    const byPrefix = active.find((s) => {
      const iss = s.dr?.issuer ?? s.issuer;
      if (!iss) return false;
      const prefix = new URL(iss).pathname.replace(/\/$/, '');
      return prefix && request.url.pathname.startsWith(`${prefix}/`);
    });
    if (byPrefix) return byPrefix;
    return active.find((s) => s.siteHost === request.host || s.pageHost === request.host) ?? active[0] ?? null;
  }

  function matchesDrPath(path, basePaths) {
    if (!config.dr) return false;
    if ((basePaths ?? []).includes(path)) return true;
    for (const s of providerScenarios()) {
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

    const authEndpoint = `https://${config.auth.host}${customPrefix}${config.auth.path}`;
    const jwksUri = `https://${config.jwks.host}${customPrefix}${config.jwks.path}`;
    const useSecondTokenHost = Boolean(
      drOpts.secondTokenHost === true || request.url.searchParams.get('second_token_host') === '1',
    );
    const tokenHost = drOpts.tokenHost ?? request.url.searchParams.get('token_host')
      ?? (useSecondTokenHost
        ? (config.dr?.secondTokenHost ?? config.token.hosts[0])
        : (config.dr?.defaultTokenHost
          ?? (config.sites.some((s) => s.host === request.host) && config.token.hosts.includes(request.host)
            ? request.host
            : config.token.hosts[0])));
    const tokenEndpoint = drOpts.tokenEndpoint ?? `https://${tokenHost}${customPrefix}${config.token.path}`;
    const regPath = `${customPrefix}${config.dr.registrationPaths[0]}`;
    const registrationEndpoint = `https://${request.host}${regPath}${scenario ? `?scenario=${encodeURIComponent(scenario.id)}` : ''}`;
    const authorizationServer = drOpts.authorizationServer !== undefined
      ? drOpts.authorizationServer
      : (request.url.searchParams.get('authorization_server') ?? config.dr?.authorizationServer ?? null);
    const scopesSupported = drOpts.scopesSupported ?? ['openid', ...Object.values(SCOPES)];
    const messagesSupported = drOpts.messagesSupported ?? [
      { type: 'LtiResourceLinkRequest' },
      { type: 'LtiDeepLinkingRequest', placements: ['ContentArea'] },
    ];
    const family = scenario?.family ?? config.family;
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
    required(Boolean(match), 'DR registration Authorization header must be "Bearer <token>"');
    const bearerToken = match[1];
    runtime.rememberSecret(bearerToken);

    const byToken = providerScenarios().find((s) => s.registrationToken === bearerToken);
    const scenario = byToken ?? findDrScenario(request);
    const expectedFormat = scenario?.dr?.tokenFormat ?? config.dr?.tokenFormat ?? 'opaque-bearer';
    const isJwt = bearerToken.split('.').length === 3;
    let tokenScope = null;
    let tokenSub = null;
    if (expectedFormat === 'moodle-scope-jwt') {
      required(isJwt, 'DR JWT registration token required (expected 3-part JWS)');
      const claims = verifyJwt(bearerToken, { keys: [runtime.signer.jwk, runtime.signer2.jwk] });
      required(
        ['reg', 'reg-create', 'reg-update'].includes(claims.scope),
        'DR JWT scope must be "reg", "reg-create" or "reg-update"',
      );
      tokenScope = claims.scope;
      tokenSub = claims.sub ?? null;
    } else {
      if (scenario?.dr?.strictOpaque) {
        required(!isJwt, 'DR opaque bearer token required (received 3-part JWT)');
      }
      required(bearerToken !== 'invalid' && bearerToken !== 'bad-token', 'DR bearer token must not be "invalid" or "bad-token"');
      if (scenario?.registrationToken && scenario?.dr?.enforceToken) {
        required(bearerToken === scenario.registrationToken, 'DR bearer token must equal scenario.registration.registrationToken');
      }
    }

    const body = JSON.parse(request.body || '{}');
    required(body.application_type === 'web', 'DR application_type must be "web"');
    required(Array.isArray(body.response_types) && body.response_types.includes('id_token'), 'DR response_types must include "id_token"');
    required(Array.isArray(body.grant_types) && body.grant_types.includes('client_credentials'), 'DR grant_types must include "client_credentials"');
    required(typeof body.initiate_login_uri === 'string' && body.initiate_login_uri.startsWith('https://'), 'DR initiate_login_uri must be an https:// URL');
    required(
      Array.isArray(body.redirect_uris) && body.redirect_uris.length > 0
        && body.redirect_uris.every((u) => typeof u === 'string' && u.startsWith('https://')),
      'DR redirect_uris must be a non-empty array of https:// URLs',
    );
    required(typeof body.jwks_uri === 'string' && body.jwks_uri.startsWith('https://'), 'DR jwks_uri must be an https:// URL');
    required(body.token_endpoint_auth_method === 'private_key_jwt', 'DR token_endpoint_auth_method must be "private_key_jwt"');
    const toolConfig = body['https://purl.imsglobal.org/spec/lti-tool-configuration'];
    required(
      toolConfig && typeof toolConfig === 'object' && typeof toolConfig.domain === 'string',
      'DR https://purl.imsglobal.org/spec/lti-tool-configuration must be an object with a domain string',
    );

    const scope = typeof body.scope === 'string' ? body.scope : '';
    const scopes = scope.split(/\s+/).filter(Boolean);
    const messages = Array.isArray(toolConfig.messages) ? toolConfig.messages : [];
    const claims = Array.isArray(toolConfig.claims) ? toolConfig.claims : [];
    const clientId = scenario?.clientId ?? `dr-client-${config.id}-${randomBytes(4).toString('hex')}`;
    const deploymentId = scenario?.deploymentId ?? config.deployments?.[0]
      ?? (config.deploymentFormat === 'uuid' ? '8f3d9a10-4b2c-4e8a-9c1d-2f5a6b7c8d90' : '1');
    const grantedScope = scenario?.dr?.grantedScope ?? scope;

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

  return { matchesDrPath, openidConfiguration, registerTool };
}
