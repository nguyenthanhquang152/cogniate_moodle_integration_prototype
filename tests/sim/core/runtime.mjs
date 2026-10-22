import { createHash, randomBytes } from 'node:crypto';
import { makeSigner } from './crypto.mjs';

export const LTI = 'https://purl.imsglobal.org/spec/lti/claim/';
export const DL = 'https://purl.imsglobal.org/spec/lti-dl/claim/';
export const AGS = 'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint';
export const NRPS = 'https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice';
export const SCOPES = {
  lineitem: 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
  readonly: 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
  score: 'https://purl.imsglobal.org/spec/lti-ags/scope/score',
  result: 'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
  nrps: 'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly',
};

export const SCENARIO_OPTIONS = Object.freeze([
  'id',
  'provider',
  'clientId',
  'deploymentId',
  'siteHost',
  'pageHost',
  'messageType',
  'subject',
  'contextId',
  'resourceLinkId',
  'resource',
  'roles',
  'claims',
  'omit',
  'fault',
  'scoreAnswers',
  'issuer',
  'family',
  'documentTarget',
  'dlData',
  'dlSubject',
  'dlWindowHint',
  'tokenAudience',
  'allowNonUuidDeployment',
  'dr',
  'tokenAnswers',
  'nrpsAnswers',
  'acceptMultiple',
  'acceptLineitem',
  'acceptMediaTypes',
  'dlSettings',
  'dlAllowCancel',
  'members',
  'storageTarget',
  'secondKey',
  'jwksKeys',
  'institutionAdmin',
  'extraAud',
  'azp',
  'ungradedPlacement',
  'allowNullScore',
]);

// Legacy aliases kept solely for tests/ltiaas/tasks-lti/LA-E5-14/throttling.k1sim.test.ts.
export const LEGACY_SCENARIO_ALIASES = Object.freeze({
  tokenAnswer: 'tokenAnswers',
  tokenStatus: 'tokenAnswers',
  nrpsAnswer: 'nrpsAnswers',
  membershipsAnswers: 'nrpsAnswers',
  membershipsAnswer: 'nrpsAnswers',
  nrpsStatus: 'nrpsAnswers',
  membershipsStatus: 'nrpsAnswers',
});

export const DR_OPTIONS = Object.freeze([
  'issuer',
  'secondTokenHost',
  'tokenHost',
  'tokenEndpoint',
  'authorizationServer',
  'tokenFormat',
  'operation',
  'updateId',
  'registrationToken',
  'strictOpaque',
  'enforceToken',
  'scopesSupported',
  'messagesSupported',
  'grantedScope',
]);

const KNOWN_SCENARIO_KEYS = new Set([...SCENARIO_OPTIONS, ...Object.keys(LEGACY_SCENARIO_ALIASES)]);
const KNOWN_DR_KEYS = new Set(DR_OPTIONS);

function editDistance(a, b) {
  const s = a.toLowerCase();
  const t = b.toLowerCase();
  const dp = Array.from({ length: s.length + 1 }, (_, i) => i);
  for (let j = 1; j <= t.length; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= s.length; i++) {
      const temp = dp[i];
      dp[i] = s[i - 1] === t[j - 1] ? prev : 1 + Math.min(prev, dp[i], dp[i - 1]);
      prev = temp;
    }
  }
  return dp[s.length];
}

function closestOption(key, candidates) {
  let best = null;
  let bestDist = Infinity;
  for (const candidate of candidates) {
    const dist = editDistance(key, candidate);
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }
  return bestDist <= Math.max(4, Math.ceil(key.length / 2)) ? best : null;
}

export function answerOf(raw, { okStatus = 200, defaultMessage = 'Too Many Requests', defaultError = null } = {}) {
  if (raw === 'invalid_client' || (typeof raw === 'object' && raw !== null && raw.error === 'invalid_client')) {
    const status = typeof raw === 'object' && raw?.status ? raw.status : 400;
    const description = (typeof raw === 'object' ? raw.message : undefined) ?? 'Client authentication failed';
    return {
      status,
      headers: {},
      body: { error: 'invalid_client', error_description: description },
      recordFields: { status, error: 'invalid_client' },
    };
  }
  const status = typeof raw === 'number' ? raw : (raw?.status ?? okStatus);
  const retryAfter = typeof raw === 'object' && raw !== null
    ? (raw.retryAfter ?? raw.headers?.['Retry-After'] ?? raw.headers?.['retry-after'] ?? null)
    : null;
  const headers = typeof raw === 'object' && raw !== null
    ? { ...(raw.headers ?? {}), ...(raw.retryAfter !== undefined ? { 'Retry-After': String(raw.retryAfter) } : {}) }
    : {};
  const message = (typeof raw === 'object' && raw !== null ? (raw.message ?? raw.body) : undefined) ?? defaultMessage;
  const error = typeof raw === 'object' && raw !== null ? raw.error : undefined;
  const effectiveError = error ?? defaultError;
  return {
    status,
    headers,
    body: { ...(effectiveError ? { error: effectiveError } : {}), message },
    recordFields: {
      status,
      ...(retryAfter !== null ? { retryAfter } : {}),
      ...(error ? { error } : {}),
    },
  };
}

export function nextAnswer(scenario, listKey, indexKey, options = {}) {
  const list = scenario?.[listKey];
  if (!Array.isArray(list) || scenario[indexKey] >= list.length) return null;
  const raw = list[scenario[indexKey]];
  if (raw === undefined) return null;
  if (!(typeof raw === 'object' && raw !== null && raw.persistent === true)) {
    scenario[indexKey]++;
  }
  return answerOf(raw, options);
}

export const json = (status, value, headers = {}) => ({
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
  body: JSON.stringify(value),
});
export const htmlEscape = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export function postForm(action, fields) {
  const inputs = Object.entries(fields).map(([k, v]) =>
    `<input type="hidden" name="${htmlEscape(k)}" value="${htmlEscape(v)}">`).join('');
  return { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    body: `<!doctype html><meta charset="utf-8"><form method="post" action="${htmlEscape(action)}">${inputs}<button>Continue</button></form><script>document.forms[0].submit()</script>` };
}

export function createRuntime({ publicLtiUrl, fetchJwks, log = () => {} }) {
  if (!publicLtiUrl?.startsWith('https://') || typeof fetchJwks !== 'function') throw new Error('Simulator options required');
  const signer = makeSigner(), signer2 = makeSigner(), stranger = makeSigner();
  const scenarios = new Map(), providers = new Map(), records = [], tokens = new Map(), jtis = new Set(), secrets = new Set();
  const lineitems = new Map(), scores = new Map(), dlNonces = new Set(), storage = new Map(), registrations = new Map();
  const activeByProvider = new Map();
  let sequence = 0;
  const runtime = {
    publicLtiUrl: publicLtiUrl.replace(/\/$/, ''), fetchJwks, signer, signer2, stranger,
    scenarios, providers, tokens, jtis, lineitems, scores, dlNonces, storage, registrations, activeByProvider,
    rememberSecret(value) { if (typeof value === 'string' && value) secrets.add(value); },
    record(kind, fields) {
      const record = { seq: ++sequence, ts: new Date().toISOString(), kind, ...structuredClone(fields) };
      records.push(record);
      return record;
    },
    tokenRef(value) { return createHash('sha256').update(value).digest('hex').slice(0, 16); },
    register(config) {
      if (providers.has(config.id)) throw new Error(`Duplicate simulator provider ${config.id}`);
      providers.set(config.id, config);
    },
    scenario(input) {
      if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new Error('Scenario body must be a JSON object');
      }
      for (const key of Object.keys(input)) {
        if (!KNOWN_SCENARIO_KEYS.has(key)) {
          const suggestion = closestOption(key, SCENARIO_OPTIONS);
          throw new Error(`Unknown scenario option "${key}"${suggestion ? ` (did you mean "${suggestion}"?)` : ''}`);
        }
      }
      if (input.dr !== undefined) {
        if (!input.dr || typeof input.dr !== 'object' || Array.isArray(input.dr)) {
          throw new Error('Scenario option "dr" must be an object');
        }
        for (const drKey of Object.keys(input.dr)) {
          if (!KNOWN_DR_KEYS.has(drKey)) {
            const suggestion = closestOption(drKey, DR_OPTIONS);
            throw new Error(`Unknown scenario dr option "dr.${drKey}"${suggestion ? ` (did you mean "dr.${suggestion}"?)` : ''}`);
          }
        }
      }
      const config = providers.get(input.provider);
      if (!config) throw new Error('Unknown simulator provider');
      if (!/^[A-Za-z0-9._:-]{1,120}$/.test(input.id ?? '')) throw new Error('Scenario id required');
      if (typeof input.clientId !== 'string' || !input.clientId || typeof input.deploymentId !== 'string' || !input.deploymentId) throw new Error('Scenario client and deployment required');
      if (config.deploymentFormat === 'uuid' && !input.allowNonUuidDeployment
        && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.deploymentId)) {
        throw new Error('UUID deployment id required');
      }
      const site = config.sites.find((s) => s.host === input.siteHost);
      if (!site) throw new Error('Unknown simulator service host');
      const pageHost = input.pageHost ?? input.siteHost;
      if (![...config.sites.map((s) => s.host), ...(config.pageHosts ?? [])].includes(pageHost)) throw new Error('Unknown simulator page host');
      const tokenAnswers = Array.isArray(input.tokenAnswers)
        ? structuredClone(input.tokenAnswers)
        : input.tokenAnswer !== undefined
          ? [structuredClone(input.tokenAnswer)]
          : input.tokenStatus !== undefined
            ? [{ status: input.tokenStatus }]
            : [];
      const nrpsAnswers = Array.isArray(input.nrpsAnswers ?? input.membershipsAnswers)
        ? structuredClone(input.nrpsAnswers ?? input.membershipsAnswers)
        : (input.nrpsAnswer ?? input.membershipsAnswer) !== undefined
          ? [structuredClone(input.nrpsAnswer ?? input.membershipsAnswer)]
          : (input.nrpsStatus ?? input.membershipsStatus) !== undefined
            ? [{ status: input.nrpsStatus ?? input.membershipsStatus }]
            : [];
      const storageTarget = typeof input.storageTarget === 'string' && input.storageTarget
        ? input.storageTarget
        : null;
      const resource = input.resource ?? 'fixture';
      let targetLinkUri = `${runtime.publicLtiUrl}/lti/launch/cogniate?resource=${encodeURIComponent(resource)}`;
      if (input.ungradedPlacement === true) {
        const u = new URL(targetLinkUri);
        u.searchParams.set('cogniate_placement', 'ungraded');
        targetLinkUri = u.href;
      }
      const now = Math.floor(Date.now() / 1000);
      const drInput = input.dr ?? {};
      const tokenFormat = drInput.tokenFormat ?? config.dr?.tokenFormat
        ?? (config.id === 'moodle-sim' ? 'moodle-scope-jwt' : 'opaque-bearer');
      const drOperation = drInput.operation ?? 'new';
      const effectiveIssuer = drInput.issuer ?? input.issuer ?? config.issuer;
      const registrationToken = drInput.registrationToken
        ?? (tokenFormat === 'moodle-scope-jwt'
          ? signer.sign({
              iss: effectiveIssuer,
              sub: String(drOperation === 'update' ? (drInput.updateId ?? input.deploymentId) : '0'),
              scope: drOperation === 'update' ? 'reg-update' : 'reg',
              iat: now,
              exp: now + 3600,
            })
          : `regtok-${input.id}-${randomBytes(8).toString('hex')}`);
      if (input.dr !== undefined) {
        runtime.rememberSecret(registrationToken);
      }
      const hasCustomDlOptions = Boolean(
        input.dlAllowCancel === true
          || input.acceptMultiple !== undefined
          || input.acceptLineitem !== undefined
          || input.acceptMediaTypes !== undefined
          || input.dlSettings !== undefined,
      );
      const scenario = {
        messageType: 'LtiResourceLinkRequest', subject: 'learner-1', contextId: 'context-1',
        resourceLinkId: 'resource-link-1', resource: 'fixture', roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
        claims: {}, omit: [], scoreAnswers: [], ...structuredClone(input),
        tokenAnswers, nrpsAnswers,
        hasCustomMembers: input.members !== undefined,
        hasCustomDlOptions,
        members: structuredClone(input.members ?? []),
        storageTarget, targetLinkUri, registrationToken,
        dr: { ...(config.dr ?? {}), ...structuredClone(drInput), tokenFormat, operation: drOperation, registrationToken },
        pageHost, site, loginHint: input.id, messageHint: `message-${input.id}`,
        data: `data-${input.id}`, scoreIndex: 0, tokenIndex: 0, nrpsIndex: 0,
      };
      scenarios.delete(input.id);
      scenarios.set(input.id, scenario);
      activeByProvider.set(config.id, scenario);
      const fields = {
        iss: scenario.issuer ?? config.issuer, client_id: scenario.clientId, lti_deployment_id: scenario.deploymentId,
        login_hint: scenario.loginHint, lti_message_hint: scenario.messageHint,
        target_link_uri: scenario.targetLinkUri,
        ...(storageTarget ? { lti_storage_target: storageTarget } : {}),
      };
      const defaultConfigPath = config.dr?.configPaths?.[0] ?? '/.well-known/openid-configuration';
      const openidConfiguration = `https://${input.siteHost}${defaultConfigPath}?scenario=${encodeURIComponent(scenario.id)}`;
      return {
        id: scenario.id,
        login: fields,
        registration: {
          openidConfiguration,
          registrationToken,
          tokenFormat,
          startUrl: `${runtime.publicLtiUrl}/lti/register/cogniate?openid_configuration=${encodeURIComponent(openidConfiguration)}&registration_token=${encodeURIComponent(registrationToken)}`,
        },
      };
    },
    async control(request) {
      const { url, method } = request;
      if (url.pathname === '/__sim/ready' && method === 'GET') return json(200, { ready: true, providers: [...providers.keys()] });
      if (url.pathname === '/__sim/scenarios' && method === 'POST') {
        try { return json(201, runtime.scenario(JSON.parse(request.body))); }
        catch (e) { return json(400, { error: e.message }); }
      }
      if (url.pathname === '/__sim/records' && method === 'GET') {
        const since = Number(url.searchParams.get('since') ?? 0);
        if (!Number.isSafeInteger(since) || since < 0) return json(400, { error: 'Invalid cursor' });
        return json(200, { cursor: sequence, records: records.filter((r) => r.seq > since) });
      }
      // Test-only raw capture. It never contains private keys and is never a log record.
      // Consumers keep this response in their private run folder and publish only redacted evidence.
      if (url.pathname === '/__sim/secrets' && method === 'GET') return json(200, { values: [...secrets] });
      if (url.pathname === '/__sim/reset' && method === 'POST') {
        scenarios.clear(); tokens.clear(); jtis.clear(); lineitems.clear(); scores.clear(); dlNonces.clear();
        storage.clear(); registrations.clear(); activeByProvider.clear();
        records.length = 0; // Cursor remains monotonic, so a stale cursor cannot reuse another run's records.
        // Keep captured secrets until process exit so a reset cannot defeat the end-of-run leak scan.
        return json(200, { cursor: sequence });
      }
      return json(404, { error: 'Unknown control route' });
    },
    logHit(request, response) {
      log({ ts: new Date().toISOString(), level: 'info', service: 'lms-sim', event: 'sim_hit',
        trace_id: String(request.headers['x-trace-id'] ?? randomBytes(8).toString('hex')),
        host: request.host, method: request.method, path: request.url.pathname, status: response.status });
    },
  };
  return runtime;
}
