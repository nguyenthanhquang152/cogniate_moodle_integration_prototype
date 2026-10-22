// Dynamic registration (contract §2.4, §3.8, security §2.4, §2.5, ADR-009):
//   GET  /lti/register/:account               Moodle opens it in the registration frame (HTML errors, 303 to the app)
//   GET  /api/registrations/:id               Bearer: the platform data, operation, existingPlatformId
//   POST /api/registrations/:id/complete      Bearer: send the registration to the platform, store the platform
import { pendingToolText } from '@cogniate/channel-kernel';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../../api-errors.ts';
import type { ProtocolErrorCode } from '../../lti/codes.ts';
import { withLms } from '../../lti/codes.ts';
import { PlatformKeyError } from '../../lti/jwks.ts';
import type { OpenIdConfiguration } from '../../lti/registration.ts';
import {
  PRIVACY_LEVELS, REGISTRATION_CLOSE_HTML, buildRegistrationRequest, operationFromToken, parseOpenIdConfiguration, parseRegistrationResponse, registrationView,
} from '../../lti/registration.ts';
import { outboundFailureError, shortPlatformMessage } from '../../platform/error-mapping.ts';
import { getAccount } from '../../store/accounts.ts';
import type { Platform } from '../../store/platforms.ts';
import { PlatformExistsError, applyRegistrationUpdate, createPlatform, findPlatformByDeployment, getPlatform, listPlatforms } from '../../store/platforms.ts';
import type { PrivacyLevel, RegistrationOperation, RegistrationSession } from '../../store/registrations.ts';
import {
  claimRegistrationSession, completeRegistrationSession, createRegistrationSession, getRegistrationSession, releaseRegistrationSession,
} from '../../store/registrations.ts';
import type { RouteContext } from '../context.ts';
import { invalid } from '../validation.ts';
import { isOwnLaunchTarget } from '../../lti/target.ts';
import { lmsNameOf, lmsNameOfFamily, reservedIssuerLmsNames, reservedIssuerOrigins } from '../../profiles/index.ts';
import { OutboundError } from '@cogniate/shared';

const HEADING = 'The registration did not work';

/**
 * B-T3b-01: the registration frame is read by the Moodle ADMIN who pasted the URL, so these pages have their own
 * action line (one data-error-action each), not the launch texts written for learners and teachers.
 */
export const REGISTRATION_HELP: Partial<Record<ProtocolErrorCode, string>> = {
  UNKNOWN_TOOL_ACCOUNT: 'This registration URL is not valid. Copy it again in Cogniate (Integrations > {LMS} > Connect) and paste it in {LMS} (Manage tools > Add LTI Advantage).',
  INVALID_REQUEST: 'Start the registration again from {LMS} (Site administration > Plugins > Activity modules > External tool > Manage tools).',
  FETCH_FAILED: 'Cogniate cannot reach this {LMS} site. The site must be reachable from the internet over https (port 443). Check the firewall, then start the registration again.',
  INVALID_OPENID_CONFIGURATION: '{LMS} sent a registration that Cogniate cannot use. Start the registration again from Manage tools. If it happens again, give the trace id to your Cogniate contact.',
  ISSUER_MISMATCH: 'The platform configuration is not from this {LMS} site. Start the registration again from Manage tools on the site itself.',
  // M1 (contract §9.2): the start page refuses a hosted LMS issuer and a Canvas or Blackboard platform configuration.
  ISSUER_RESERVED: 'This address belongs to a hosted LMS. Connect it as {LMS} in the Cogniate portal.',
};

/** M1 (contract §9.2): `This is a {LMS} site. Connect it as {LMS} in the Cogniate portal.` */
const familyHelp = (lms: string) => `This is a ${lms} site. Connect it as ${lms} in the Cogniate portal.`;

/** A-T3b-01: the registration may have reached Moodle, but the result is unknown. No automatic clean-up. */
// The same clean-up text as the app page MOODLE_TOOL_MAY_EXIST (B-T4b1-02), with the tool name that was sent to Moodle.
const toolMayExist = (toolName: string) => new ApiError('PLATFORM_ERROR', pendingToolText(toolName), { details: { reason: 'tool_may_exist' } });
const SESSION_MAX_MS = 3600 * 1000; // contract §2.4: expires with the token, at most 1 h
const CLOCK_SKEW_S = 60;
const RESERVED_QUERY = new Set(['openid_configuration', 'registration_token', 'privacyLevel']);

const Privacy = z.enum(PRIVACY_LEVELS as [PrivacyLevel, ...PrivacyLevel[]]);

const RegisterQuery = z.object({
  openid_configuration: z.string().min(1).max(2048),
  registration_token: z.string().min(1).max(8192).optional(),
  privacyLevel: Privacy.optional(),
}).catchall(z.unknown());

const CompleteBody = z.object({
  platformName: z.string().trim().min(1).max(255).optional(),
  autoActivate: z.boolean().optional(),
  messages: z.array(z.object({
    type: z.string().min(1).max(64),
    placements: z.array(z.string().min(1).max(64)).max(10).optional(),
    label: z.string().min(1).max(255).optional(),
    target_link_uri: z.string().min(1).max(2048).optional(),
  })).max(10).optional(),
  privacyLevel: Privacy.optional(),
  updatePlatformId: z.string().min(1).max(64).optional(),
});

/** Read and check the platform configuration URL (security §2.4); a problem is a page code with a safe detail. */
async function fetchConfiguration(ctx: RouteContext, url: string, token: string | undefined, traceId: string): Promise<OpenIdConfiguration | { code: ProtocolErrorCode; detail: string }> {
  let res;
  try {
    res = await ctx.outbound.request(url, { traceId, headers: { accept: 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) } });
  } catch {
    return { code: 'FETCH_FAILED', detail: 'configuration_not_reached' }; // the outbound_blocked event has the reason
  }
  if (res.status !== 200) return { code: 'FETCH_FAILED', detail: `configuration_status=${res.status}` };
  let body: unknown;
  try {
    body = res.json();
  } catch {
    return { code: 'INVALID_OPENID_CONFIGURATION', detail: 'not_json' };
  }
  return parseOpenIdConfiguration(url, body);
}

/** The operation from the registration token, verified with the platform JWKS (security §2.5). */
async function readToken(ctx: RouteContext, token: string, config: OpenIdConfiguration, accountId: string, traceId: string, now: number)
  : Promise<{ operation: RegistrationOperation; existingPlatformId: string | null; expiresAt: number } | { code: ProtocolErrorCode; detail: string }> {
  let payload: Record<string, unknown>;
  try {
    const { payload: bytes } = await ctx.keys.verify(token, config.jwksUri, traceId);
    payload = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  } catch (err) {
    if (err instanceof PlatformKeyError && (err.detail === 'jwks_unavailable' || err.detail === 'jwks_fetch_failed')) return { code: 'FETCH_FAILED', detail: err.detail };
    return { code: 'INVALID_OPENID_CONFIGURATION', detail: 'registration_token_invalid' };
  }
  if (typeof payload.exp !== 'number' || payload.exp <= now / 1000 - CLOCK_SKEW_S) return { code: 'INVALID_OPENID_CONFIGURATION', detail: 'registration_token_expired' };
  const op = operationFromToken(payload);
  if (!op) return { code: 'INVALID_OPENID_CONFIGURATION', detail: 'registration_token_scope' };
  const existing = op.typeId ? findPlatformByDeployment(ctx.db, accountId, config.issuer, op.typeId) : null;
  return { operation: op.operation, existingPlatformId: existing?.id ?? null, expiresAt: Math.min(payload.exp * 1000, now + SESSION_MAX_MS) };
}

export function registerRegistrationRoutes(app: FastifyInstance, ctx: RouteContext): void {
  const log = ctx.logger;
  const lms = lmsNameOf(null, ctx.profiles);

  // ---------------------------------------------------------------- GET /lti/register/:account (contract §2.4)
  app.get<{ Params: { account: string } }>('/lti/register/:account', async (req: FastifyRequest<{ Params: { account: string } }>, reply: FastifyReply) => {
    const now = ctx.now();
    const page = (code: ProtocolErrorCode, detail: string) => {
      log.warn('registration_rejected', { trace_id: req.traceId, code, detail });
      const template = REGISTRATION_HELP[code];
      const help = template ? withLms(template, code === 'ISSUER_RESERVED' ? reservedIssuerLmsNames(ctx.profiles) : lms) : undefined;
      return ctx.errorPage(reply, req, code, { heading: HEADING, lms, ...(help ? { help } : {}) });
    };
    const account = getAccount(ctx.db, req.params.account);
    if (!account) return page('UNKNOWN_TOOL_ACCOUNT', 'unknown_tool_account');
    const q = RegisterQuery.safeParse(req.query ?? {});
    if (!q.success) return page('INVALID_REQUEST', `query=${q.error.issues[0]?.path.join('.') || 'query'}`);
    const token = q.data.registration_token;
    const config = await fetchConfiguration(ctx, q.data.openid_configuration, token, req.traceId);
    if ('code' in config) return page(config.code, config.detail);
    // M1: a reserved issuer or a Canvas or Blackboard product family; nothing is stored and no session starts.
    if (reservedIssuerOrigins(ctx.profiles).includes(new URL(config.issuer).origin)) return page('ISSUER_RESERVED', 'issuer_reserved');
    const family = lmsNameOfFamily(config.productFamilyCode, ctx.profiles);
    if (family) {
      log.warn('registration_rejected', { trace_id: req.traceId, code: 'PROVIDER_PROFILE_MISMATCH', detail: `family=${config.productFamilyCode.toLowerCase()}` });
      return ctx.errorPage(reply, req, 'PROVIDER_PROFILE_MISMATCH', { heading: HEADING, help: familyHelp(family), lms: family });
    }

    let operation: RegistrationOperation = 'new';
    let existingPlatformId: string | null = null;
    let expiresAt = now + SESSION_MAX_MS;
    if (token) {
      const t = await readToken(ctx, token, config, account.id, req.traceId, now);
      if ('code' in t) return page(t.code, t.detail);
      ({ operation, existingPlatformId, expiresAt } = t);
    }
    // Pass-through parameters (for example ref): strings only, never the token or the configuration URL.
    const passthrough = Object.fromEntries(Object.entries(q.data)
      .filter(([k, v]) => !RESERVED_QUERY.has(k) && typeof v === 'string' && k.length <= 64 && v.length <= 512).slice(0, 20)) as Record<string, string>;
    const session = createRegistrationSession(ctx.db, ctx.masterKey, {
      toolAccountId: account.id, openidConfigurationUrl: q.data.openid_configuration, registrationToken: token ?? null,
      platformConfiguration: config.raw, operation, existingPlatformId, privacyLevel: q.data.privacyLevel ?? 'anonymous', passthrough, expiresAt,
    }, now);
    log.info('registration_started', { trace_id: req.traceId, registration_id: session.id, operation });
    const location = new URL(account.registrationUrl);
    location.searchParams.set('registrationId', session.id);
    for (const [k, v] of Object.entries(passthrough)) location.searchParams.set(k, v);
    return reply.code(303).headers({ location: location.href, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' }).send();
  });

  const sessionOf = (accountId: string, id: string): RegistrationSession => {
    const session = getRegistrationSession(ctx.db, ctx.masterKey, accountId, id, ctx.now());
    if (!session) throw new ApiError('REGISTRATION_NOT_FOUND');
    return session;
  };
  const configOf = (session: RegistrationSession): OpenIdConfiguration => {
    const config = parseOpenIdConfiguration(session.openidConfigurationUrl, session.platformConfiguration);
    if ('code' in config) throw new ApiError('REGISTRATION_NOT_FOUND'); // checked at start; cannot happen
    return config;
  };

  // ---------------------------------------------------------------- GET /api/registrations/:id (contract §3.8)
  app.get<{ Params: { id: string }; Querystring: { raw?: string } }>('/api/registrations/:id', async (req) => {
    const { account } = ctx.auth(req, ['bearer']);
    const session = sessionOf(account.id, req.params.id);
    return registrationView(configOf(session), session, req.query.raw === 'true');
  });

  // ---------------------------------------------------------------- POST /api/registrations/:id/complete (contract §3.8)
  app.post<{ Params: { id: string } }>('/api/registrations/:id/complete', async (req) => {
    const { account } = ctx.auth(req, ['bearer']);
    const body = CompleteBody.safeParse(req.body ?? {});
    if (!body.success) throw invalid(body.error);
    const session = sessionOf(account.id, req.params.id);
    if (session.status !== 'open') throw new ApiError('REGISTRATION_ALREADY_COMPLETED');
    // Same fields as the page side (B-T3b-03): code and a safe detail.
    const reject = (err: ApiError): never => {
      log.warn('registration_rejected', { trace_id: req.traceId, code: err.code, detail: String(err.details.reason ?? err.code.toLowerCase()) });
      throw err;
    };
    // Security §2.5: an update only of this account's platform, named by the caller. Nothing is sent to Moodle otherwise.
    if (session.operation === 'update') {
      const allowed = session.existingPlatformId !== null && body.data.updatePlatformId === session.existingPlatformId
        && getPlatform(ctx.db, account.id, session.existingPlatformId) !== null;
      if (!allowed) reject(new ApiError('REGISTRATION_UPDATE_NOT_ALLOWED', withLms('This registration updates a tool that is not this connection. Choose "Register as a new external tool" in {LMS}.', lms)));
    }
    // A-T3b-03: a message target must be our own launch URL for this account (Moodle only checks the domain).
    for (const m of body.data.messages ?? []) {
      if (m.target_link_uri !== undefined && !isOwnLaunchTarget(m.target_link_uri, ctx.urls, account.id)) {
        throw new ApiError('INVALID_REQUEST', 'Invalid field: messages.target_link_uri must be the launch URL of this tool account.');
      }
    }
    // M1 (§9.2): a standard platform cannot use a reserved issuer; nothing is sent to the platform.
    if (reservedIssuerOrigins(ctx.profiles).includes(new URL(configOf(session).issuer).origin)) reject(new ApiError('ISSUER_RESERVED'));
    if (!claimRegistrationSession(ctx.db, account.id, session.id)) throw new ApiError('REGISTRATION_ALREADY_COMPLETED');
    try {
      const config = configOf(session);
      const clientName = body.data.platformName ?? `${config.productFamilyCode || 'platform'} ${new URL(config.issuer).host}`;
      const request = buildRegistrationRequest({
        urls: ctx.urls, accountId: account.id, clientName, privacyLevel: body.data.privacyLevel ?? session.privacyLevel, ...(body.data.messages ? { messages: body.data.messages } : {}),
      });
      let res;
      try {
        res = await ctx.outbound.request(config.registrationEndpoint, {
          method: 'POST', traceId: req.traceId, body: JSON.stringify(request),
          headers: { 'content-type': 'application/json', accept: 'application/json', ...(session.registrationToken ? { authorization: `Bearer ${session.registrationToken}` } : {}) },
        });
      } catch (err) {
        // A timeout or a network error after the request left: Moodle may have created the tool (A-T3b-01).
        if (err instanceof OutboundError && (err.reason === 'timeout' || err.reason === 'network_error')) throw toolMayExist(clientName);
        throw outboundFailureError(err);
      }
      // A retry after such a failure: Moodle refuses the used token (401 token_already_used). A 5xx can come after the tool was saved.
      if ((res.status === 401 && res.text().includes('token_already_used')) || res.status >= 500) throw toolMayExist(clientName);
      // Contract §3.8: a platform refusal is 502 PLATFORM_ERROR with its code (Moodle: for example domain_targetlinkuri_mismatch).
      if (res.status < 200 || res.status >= 300) throw new ApiError('PLATFORM_ERROR', `The platform rejected the registration (${res.status}): ${shortPlatformMessage(res.body)}`);
      let answer: unknown;
      try {
        answer = res.json();
      } catch {
        throw toolMayExist(clientName); // 2xx: Moodle saved something, but we cannot read what
      }
      const reg = parseRegistrationResponse(answer);
      if (!reg) throw toolMayExist(clientName);
      const values = {
        clientId: reg.clientId, name: clientName, authEndpoint: config.authorizationEndpoint, tokenEndpoint: config.tokenEndpoint, jwksUrl: config.jwksUri,
        active: body.data.autoActivate ?? true, productFamilyCode: config.productFamilyCode || null, deploymentId: reg.deploymentId,
      };
      let platform: Platform | null;
      let operation: RegistrationOperation = session.operation;
      if (session.operation === 'update') {
        platform = applyRegistrationUpdate(ctx.db, account.id, session.existingPlatformId!, values);
      } else {
        try {
          platform = createPlatform(ctx.db, account.id, {
            issuer: config.issuer, clientId: values.clientId, name: values.name, authEndpoint: values.authEndpoint, tokenEndpoint: values.tokenEndpoint,
            jwksUrl: values.jwksUrl, deploymentIds: [values.deploymentId], active: values.active, productFamilyCode: values.productFamilyCode,
          });
        } catch (err) {
          if (!(err instanceof PlatformExistsError)) throw err;
          // B-T3b-02 (Lead decision): a "new" registration answered with a client id that this account already has for
          // this issuer is the SAME Moodle tool (Moodle issues a new client id for every new tool, so only a re-sent or
          // re-used registration gets here). The platform belongs to this account (security §2.5), so we update it and
          // log operation "update".
          // A-T4b1-03: keep the stored `active` value. A platform that was switched off (for example an orphan that the
          // app deactivated) is never switched on again by this path.
          const same = listPlatforms(ctx.db, account.id, { url: config.issuer, clientId: values.clientId })[0]!;
          platform = applyRegistrationUpdate(ctx.db, account.id, same.id, { ...values, active: same.active });
          operation = 'update';
        }
      }
      if (!platform) throw new ApiError('INTERNAL_ERROR', `Internal error. Trace id: ${req.traceId}`);
      completeRegistrationSession(ctx.db, account.id, session.id, platform.id, ctx.now());
      log.info('registration_completed', { trace_id: req.traceId, platform_id: platform.id, operation });
      return { html: REGISTRATION_CLOSE_HTML, platformId: platform.id };
    } catch (err) {
      releaseRegistrationSession(ctx.db, account.id, session.id);
      if (err instanceof ApiError) reject(err);
      throw err;
    }
  });
}
