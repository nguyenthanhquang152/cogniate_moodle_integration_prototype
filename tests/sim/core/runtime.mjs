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
  const signer = makeSigner(), stranger = makeSigner();
  const scenarios = new Map(), providers = new Map(), records = [], tokens = new Map(), jtis = new Set(), secrets = new Set();
  const lineitems = new Map(), scores = new Map(), dlNonces = new Set();
  let sequence = 0;
  const runtime = {
    publicLtiUrl: publicLtiUrl.replace(/\/$/, ''), fetchJwks, signer, stranger,
    scenarios, providers, tokens, jtis, lineitems, scores, dlNonces,
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
      if (typeof input.clientId !== 'string' || !input.clientId || typeof input.deploymentId !== 'string') throw new Error('Scenario client and deployment required');
      const site = config.sites.find((s) => s.host === input.siteHost);
      if (!site) throw new Error('Unknown simulator service host');
      const pageHost = input.pageHost ?? input.siteHost;
      if (![...config.sites.map((s) => s.host), ...(config.pageHosts ?? [])].includes(pageHost)) throw new Error('Unknown simulator page host');
      const scenario = {
        messageType: 'LtiResourceLinkRequest', subject: 'learner-1', contextId: 'context-1',
        resourceLinkId: 'resource-link-1', resource: 'fixture', roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
        claims: {}, omit: [], scoreAnswers: [], ...structuredClone(input),
        pageHost, site, loginHint: input.id, messageHint: `message-${input.id}`,
        data: `data-${input.id}`, scoreIndex: 0,
      };
      scenarios.set(input.id, scenario);
      const fields = {
        iss: config.issuer, client_id: scenario.clientId, lti_deployment_id: scenario.deploymentId,
        login_hint: scenario.loginHint, lti_message_hint: scenario.messageHint,
        target_link_uri: `${runtime.publicLtiUrl}/lti/launch/cogniate?resource=${encodeURIComponent(scenario.resource)}`,
      };
      return { id: scenario.id, login: fields };
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
