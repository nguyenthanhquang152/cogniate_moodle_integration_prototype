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
  let sequence = 0;
  const runtime = {
    publicLtiUrl: publicLtiUrl.replace(/\/$/, ''), fetchJwks, signer, signer2, stranger,
    scenarios, providers, tokens, jtis, lineitems, scores, dlNonces, storage, registrations,
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
          : input.tokenError
            ? [{ status: 400, error: input.tokenError, persistent: true }]
            : input.tokenStatus
              ? [{ status: input.tokenStatus }]
              : [];
      const nrpsAnswers = Array.isArray(input.nrpsAnswers ?? input.membershipsAnswers)
        ? structuredClone(input.nrpsAnswers ?? input.membershipsAnswers)
        : (input.nrpsAnswer ?? input.membershipsAnswer) !== undefined
          ? [structuredClone(input.nrpsAnswer ?? input.membershipsAnswer)]
          : (input.nrpsStatus ?? input.membershipsStatus)
            ? [{ status: input.nrpsStatus ?? input.membershipsStatus }]
            : [];
      const storageTarget = typeof input.storageTarget === 'string' && input.storageTarget
        ? input.storageTarget
        : input.platformStorage === true
          ? 'post_message_forwarding'
          : null;
      const resource = input.resource ?? 'fixture';
      let targetLinkUri = input.targetLinkUri
        ?? `${runtime.publicLtiUrl}/lti/launch/cogniate?resource=${encodeURIComponent(resource)}`;
      if (input.ungradedPlacement === true || input.placement === 'ungraded') {
        const u = new URL(targetLinkUri);
        u.searchParams.set('cogniate_placement', 'ungraded');
        targetLinkUri = u.href;
      }
      const now = Math.floor(Date.now() / 1000);
      const drInput = input.dr ?? {};
      const tokenFormat = drInput.tokenFormat ?? drInput.registrationTokenFormat
        ?? input.registrationTokenFormat ?? input.tokenFormat
        ?? config.dr?.tokenFormat ?? (config.id === 'moodle-sim' ? 'moodle-scope-jwt' : 'opaque-bearer');
      const drOperation = drInput.operation ?? input.drOperation ?? 'new';
      const effectiveIssuer = drInput.issuer ?? input.issuer ?? config.issuer;
      const registrationToken = drInput.registrationToken ?? input.registrationToken
        ?? ((tokenFormat === 'moodle-scope-jwt' || tokenFormat === 'jwt')
          ? signer.sign({
              iss: effectiveIssuer,
              sub: String(drOperation === 'update' ? (drInput.updateId ?? input.deploymentId) : '0'),
              scope: drOperation === 'update' ? 'reg-update' : (drInput.scope ?? 'reg'),
              iat: now,
              exp: now + 3600,
            }, drInput.tokenFault)
          : `regtok-${input.id}-${randomBytes(8).toString('hex')}`);
      runtime.rememberSecret(registrationToken);
      const scenario = {
        messageType: 'LtiResourceLinkRequest', subject: 'learner-1', contextId: 'context-1',
        resourceLinkId: 'resource-link-1', resource: 'fixture', roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
        claims: {}, omit: [], scoreAnswers: [], ...structuredClone(input),
        tokenAnswers, nrpsAnswers, members: structuredClone(input.members ?? input.nrpsMembers ?? []),
        storageTarget, targetLinkUri, registrationToken,
        dr: { ...(config.dr ?? {}), ...structuredClone(drInput), tokenFormat, operation: drOperation, registrationToken },
        pageHost, site, loginHint: input.id, messageHint: `message-${input.id}`,
        data: `data-${input.id}`, scoreIndex: 0, tokenIndex: 0, nrpsIndex: 0,
      };
      scenarios.delete(input.id);
      scenarios.set(input.id, scenario);
      const fields = {
        iss: scenario.issuer ?? config.issuer, client_id: scenario.clientId, lti_deployment_id: scenario.deploymentId,
        login_hint: scenario.loginHint, lti_message_hint: scenario.messageHint,
        target_link_uri: scenario.targetLinkUri,
        ...(storageTarget ? { lti_storage_target: storageTarget } : {}),
      };
      const defaultConfigPath = drInput.configPath ?? config.dr?.configPaths?.[0] ?? '/.well-known/openid-configuration';
      const configHost = drInput.configHost ?? input.siteHost;
      const openidConfiguration = `https://${configHost}${defaultConfigPath}?scenario=${encodeURIComponent(scenario.id)}`;
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
        storage.clear(); registrations.clear();
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
