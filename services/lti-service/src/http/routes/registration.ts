import { storeFor } from '../../store/index.ts';
// Dynamic registration (contract §2.4, §3.8, security §2.4, §2.5, ADR-009):
//   GET  /lti/register/:account               Moodle opens it in the registration frame (HTML errors, 303 to the app)
//   GET  /api/registrations/:id               Bearer: the platform data, operation, existingPlatformId
//   POST /api/registrations/:id/complete      Bearer: send the registration to the platform, store the platform
import type { RegistrationTextKey } from '@cogniate/channel-kernel';
import { REGISTRATION_TEXT_KEYS, STANDARD_PROFILE_ID, familyGuardVerdict, fillText, registrationText } from '@cogniate/channel-kernel';
import { originHost } from '@cogniate/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../../api-errors.ts';
import { createAccountResolver } from '../../accounts/resolver.ts';
import type { ProtocolErrorCode } from '../../lti/codes.ts';
import { lmsNameFor, withLms } from '../../lti/codes.ts';
import { PlatformKeyError } from '../../lti/jwks.ts';
import { statusGate } from '../../lti/account-status.ts';
import { BINDING_REF, checkAudienceHost } from '../../lti/platform-rules.ts';
import type { AnyHttpsRules } from '../../lti/platform-rules.ts';
import type { ConfigurationProblem, ConfigurationRule, IssuerRule, OpenIdConfiguration } from '../../lti/registration.ts';
import {
  PRIVACY_LEVELS, REGISTRATION_CLOSE_HTML, REGISTRATION_SCOPES, buildRegistrationRequest, configurationUrlProblem, endpointsOnIssuerOrigin, fixedRuleOf,
  grantedScopesOf, operationFromToken, parseOpenIdConfiguration, parseRegistrationResponse, registrationView, supportsDeepLinking,
} from '../../lti/registration.ts';
import { outboundFailureError, shortPlatformMessage } from '../../platform/error-mapping.ts';

import type { Platform } from '../../store/platforms.ts';
import type { PrivacyLevel, RegistrationOperation, RegistrationSession, RegistrationTokenKind } from '../../store/registrations.ts';

import type { RouteContext } from '../context.ts';
import { invalid } from '../validation.ts';
import { checkRegistrationSessionCap, rateLimiterFor } from '../rate-limit.ts';
import { isOwnLaunchTarget } from '../../lti/target.ts';
import type { ProviderProfile } from '../../profiles/index.ts';
import { allFixedHosts, channelRegistry, findProfile, listProfiles, lmsNameOf, reservedIssuerOrigins, siteRulesFor } from '../../profiles/index.ts';
import { OutboundError } from '@cogniate/shared';
import { decodeProtectedHeader } from 'jose';

const HEADING = 'The registration did not work';

/**
 * B-T3b-01: the registration frame is read by the ADMIN who pasted the URL, so these pages have their own action line
 * (one data-error-action each), not the launch texts written for learners and teachers. The sentences that name LMS
 * menu paths come from the channel manifest texts.registration (A1 BD-A1-59, BD-A1-68); these core sentences name none.
 */
const CORE_HELP: Partial<Record<ProtocolErrorCode, string>> = {
  FETCH_FAILED: 'Cogniate cannot reach this {LMS} site. The site must be reachable from the internet over https (port 443). Check the firewall, then start the registration again.',
  // M1 (contract §9.2): the start page refuses a hosted LMS issuer and a Canvas or Blackboard platform configuration.
  ISSUER_RESERVED: 'This address belongs to a hosted LMS. Connect it as {LMS} in the Cogniate portal.',
};
const isRegistrationTextKey = (code: string): code is RegistrationTextKey => (REGISTRATION_TEXT_KEYS as readonly string[]).includes(code);
/** A token that does not parse as a JWS needs no JWKS fetch to know that it is not a registration JWT. */
const isJws = (token: string): boolean => {
  try { decodeProtectedHeader(token); return true; } catch { return false; }
};
/** LA-ADR-02 D5 item 5: Cogniate adds content with Deep Linking. No {LMS}: the start page does not know the channel. */
const NO_DEEP_LINKING_HELP = 'The platform does not offer Deep Linking to this tool, and Cogniate needs it to add content. Ask the platform admin to allow Deep Linking for external tools, then start the registration again.';

/** M1 (contract §9.2): `This is a {LMS} site. Connect it as {LMS} in the Cogniate portal.` */
const familyHelp = (lms: string) => `This is a ${lms} site. Connect it as ${lms} in the Cogniate portal.`;

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
  scopes: z.array(z.enum(REGISTRATION_SCOPES)).min(1).refine((scopes) => new Set(scopes).size === scopes.length, 'scopes must not repeat').optional(),
  messages: z.array(z.object({
    type: z.string().min(1).max(64),
    placements: z.array(z.string().min(1).max(64)).max(10).optional(),
    label: z.string().min(1).max(255).optional(),
    target_link_uri: z.string().min(1).max(2048).optional(),
  })).max(10).optional(),
  privacyLevel: Privacy.optional(),
  updatePlatformId: z.string().min(1).max(64).optional(),
  // E2 (contract delta §4.5): the profile of the connection's channel (absent = standard) and its binding ref.
  profile: z.string().min(1).max(64).optional(),
  bindingRef: z.string().regex(BINDING_REF, '1 to 64 characters [A-Za-z0-9_-]').optional(),
});

/** A configuration that breaks the exact rule of the chosen profile, as an API error; nothing is sent (D5). */
function profileRuleError(problem: ConfigurationProblem, profileId: string): ApiError {
  if (problem.code === 'ISSUER_RESERVED') return new ApiError('ISSUER_RESERVED');
  if (problem.code === 'PLATFORM_URL_NOT_IN_PROFILE') return new ApiError('PLATFORM_URL_NOT_IN_PROFILE', `The platform configuration breaks the rules of profile ${profileId} (${problem.detail}).`);
  if (problem.detail.startsWith('not_on_issuer_origin=')) return new ApiError('PLATFORM_URL_NOT_ON_ISSUER_ORIGIN', `The platform configuration of profile ${profileId} has ${problem.detail.slice(21)} off the issuer origin.`);
  return new ApiError('INVALID_REQUEST', `Invalid field: profile. The platform configuration does not follow the Dynamic Registration rule of profile ${profileId} (${problem.detail}).`,
    { details: { field: 'profile', reason: problem.detail } });
}

/** Read and check the platform configuration URL (security §2.4) with a rule; a problem is a page code with a safe detail. */
async function fetchConfiguration(ctx: RouteContext, url: string, token: string | undefined, traceId: string, rule: ConfigurationRule)
  : Promise<OpenIdConfiguration | { code: ProtocolErrorCode; detail: string }> {
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
  return parseOpenIdConfiguration(url, body, rule);
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
  const existing = op.typeId ? (await storeFor(ctx.db).platforms.findPlatformByDeployment(accountId, config.issuer, op.typeId)) : null;
  return { operation: op.operation, existingPlatformId: existing?.id ?? null, expiresAt: Math.min(payload.exp * 1000, now + SESSION_MAX_MS) };
}

export async function registerRegistrationRoutes(app: FastifyInstance, ctx: RouteContext): Promise<void> {
  const log = ctx.logger;
  const lms = lmsNameOf(null, ctx.profiles);
  const resolver = createAccountResolver(ctx.db, ctx.urls.lti);
  const limiter = (await rateLimiterFor(ctx.db, log, ctx.now));
  const channels = channelRegistry(ctx.profiles);
  // The start page does not know the connection's channel: the no-context channel's sentences apply (BD-A1-59).
  const noContextChannel = channels.channel(channels.channelOfProfile(STANDARD_PROFILE_ID) ?? '');
  const helpOf = (code: ProtocolErrorCode, channel: typeof noContextChannel): string | undefined =>
    (isRegistrationTextKey(code) ? registrationText(channel, code) : CORE_HELP[code]);
  // LA-ADR-02 D5: the profiles that a channel offers for Dynamic Registration (trait and manifest, as the app capability).
  const dynamicProfiles = listProfiles(ctx.profiles).filter((p) => p.dynamicRegistration !== null && channels.capabilities(p.channel, p)['registration.dynamic']);
  const ownOrigins = [ctx.urls.lti, ctx.urls.app, ctx.urls.content];
  const hosts: AnyHttpsRules = {
    ownHosts: ownOrigins.map(originHost), reservedHosts: allFixedHosts(ctx.profiles), reservedIssuerOrigins: reservedIssuerOrigins(ctx.profiles),
  };
  /** LA-ADR-05 D6: a fixed-endpoint profile keeps its own rule (issuerRule profile; load check 7 keeps the two together). */
  const isFixedRule = (p: ProviderProfile) => p.dynamicRegistration!.issuerRule === 'profile';
  const ruleOf = (profiles: readonly ProviderProfile[]): ConfigurationRule => {
    const admin = profiles.filter((p) => !isFixedRule(p));
    return {
      issuerRules: admin.map((p): IssuerRule => {
        const { issuerRule, configurationPath } = p.dynamicRegistration!;
        return { issuerRule: issuerRule as IssuerRule['issuerRule'], ...(configurationPath !== undefined ? { configurationPath } : {}) };
      }),
      endpointOrigins: admin.some((p) => p.endpointOrigins === 'any-https') ? 'any-https' : 'issuer',
      hosts,
      fixedRules: profiles.filter(isFixedRule).map((p) => fixedRuleOf(p, siteRulesFor(p, ownOrigins, ctx.profiles), hosts.reservedHosts)),
    };
  };
  // The start page applies the loosest rule of every DR profile; complete applies the exact rule of the chosen one.
  const startRule = ruleOf(dynamicProfiles);
  const adminChannels = dynamicProfiles.filter((p) => !isFixedRule(p)).map((p) => p.channel);
  /** The channels whose rule the configuration passed: the family guard of the start page asks only them. */
  const passedChannels = (config: OpenIdConfiguration): Array<string | null> => {
    const fixedChannel = config.fixed ? dynamicProfiles.find((p) => p.id === config.fixed!.profile)!.channel : null;
    const passed = [...(fixedChannel !== null ? [fixedChannel] : []), ...(config.adminRule ? adminChannels : [])];
    return passed.length ? passed : [null];
  };
  const acceptsOpaqueToken = dynamicProfiles.some((p) => p.dynamicRegistration!.registrationToken === 'opaque-bearer');
  /** Registration-phase family guard (BD-A1-54, BD-A1-55): refuse when no allowed channel may own the family. */
  const familyRefusal = (family: string, profileChannels: ReadonlyArray<string | null>) => {
    const verdicts = profileChannels.map((channel) => familyGuardVerdict(channels, family, channel, 'registration'));
    const first = verdicts[0];
    return first?.kind === 'refuse' && verdicts.every((v) => v.kind === 'refuse') ? first : null;
  };

  // ---------------------------------------------------------------- GET /lti/register/:account (contract §2.4)
  app.get<{ Params: { account: string } }>('/lti/register/:account', async (req: FastifyRequest<{ Params: { account: string } }>, reply: FastifyReply) => {
    const now = ctx.now();
    const page = (code: ProtocolErrorCode, detail: string, sentence = helpOf(code, noContextChannel)) => {
      log.warn('registration_rejected', { trace_id: req.traceId, code, detail });
      const help = sentence ? withLms(sentence, lmsNameFor(code, lms, ctx.profiles)) : undefined;
      return ctx.errorPage(reply, req, code, { heading: HEADING, lms, ...(help ? { help } : {}) });
    };
    const gate = statusGate((await resolver.resolveAccount(req)));
    if (!gate.ok) return page(gate.code, gate.detail);
    const { account } = gate;
    const q = RegisterQuery.safeParse(req.query ?? {});
    if (!q.success) return page('INVALID_REQUEST', `query=${q.error.issues[0]?.path.join('.') || 'query'}`);
    // First check: no outbound fetch when the address is already at the cap (LA-ADR-06 D1).
    const cap = (await checkRegistrationSessionCap(ctx.db, limiter, req.ip, account.id, now));
    if (!cap.allowed) return page('REGISTRATION_SESSION_LIMIT', 'registration_session_limit');
    const token = q.data.registration_token;
    // BD-A2-93: the floor for every loaded profile. No loaded profile could complete such a configuration, so it is
    // not fetched; every other URL is fetched and read with the loosest rule of the loaded profiles.
    const floor = configurationUrlProblem(q.data.openid_configuration, hosts);
    if (floor) return page(floor.code, floor.detail);
    const config = await fetchConfiguration(ctx, q.data.openid_configuration, token, req.traceId, startRule);
    if ('code' in config) return page(config.code, config.detail);
    // M1: a reserved issuer (except the own issuer of the profile rule it passed) or a guarded product family; nothing
    // is stored and no session starts.
    if (!config.fixed && reservedIssuerOrigins(ctx.profiles).includes(new URL(config.issuer).origin)) return page('ISSUER_RESERVED', 'issuer_reserved');
    const guard = familyRefusal(config.productFamilyCode, passedChannels(config));
    if (guard) {
      const family = channels.textName(guard.guardChannel);
      log.warn('registration_rejected', { trace_id: req.traceId, code: 'PROVIDER_PROFILE_MISMATCH', detail: `family=${guard.family}` });
      return ctx.errorPage(reply, req, 'PROVIDER_PROFILE_MISMATCH', { heading: HEADING, help: familyHelp(family), lms: family });
    }
    if (!supportsDeepLinking(config)) return page('INVALID_OPENID_CONFIGURATION', 'deep_linking_not_supported', NO_DEEP_LINKING_HELP);

    let operation: RegistrationOperation = 'new';
    let existingPlatformId: string | null = null;
    let expiresAt = now + SESSION_MAX_MS;
    let tokenKind: RegistrationTokenKind | null = null;
    if (token && acceptsOpaqueToken && !isJws(token)) {
      tokenKind = 'opaque-bearer'; // D5 item 3: only sent back as the Bearer token; operation new
    } else if (token) {
      // A-LA-E2-02-05, BD-A1-84: a JWT-shaped token is never an opaque token; it keeps its verification failure.
      const t = await readToken(ctx, token, config, account.id, req.traceId, now);
      if ('code' in t) return page(t.code, t.detail);
      ({ operation, existingPlatformId, expiresAt } = t);
      tokenKind = 'scope-jwt';
    }
    // Pass-through parameters (for example ref): strings only, never the token or the configuration URL.
    const passthrough = Object.fromEntries(Object.entries(q.data)
      .filter(([k, v]) => !RESERVED_QUERY.has(k) && typeof v === 'string' && k.length <= 64 && v.length <= 512).slice(0, 20)) as Record<string, string>;
    // A-LA-E5-06-01: parallel starts from one address all pass the first check while they wait for their fetch.
    // Count again and insert in one transaction, with no await between them, so the cap holds.
    const session = (await storeFor(ctx.db).registrations.createCappedRegistrationSession(ctx.masterKey, {
        toolAccountId: account.id, clientKey: cap.clientKey, openidConfigurationUrl: q.data.openid_configuration, registrationToken: token ?? null,
        platformConfiguration: config.raw, operation, existingPlatformId, privacyLevel: q.data.privacyLevel ?? 'anonymous', passthrough, expiresAt, tokenKind,
      }, now, limiter.registrationSessionLimit, ctx.now()));
    if (!session) return page('REGISTRATION_SESSION_LIMIT', 'registration_session_limit');
    log.info('registration_started', { trace_id: req.traceId, registration_id: session.id, operation });
    const location = new URL(account.registrationUrl);
    location.searchParams.set('registrationId', session.id);
    for (const [k, v] of Object.entries(passthrough)) location.searchParams.set(k, v);
    return reply.code(303).headers({ location: location.href, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' }).send();
  });

  const sessionOf = async (accountId: string, id: string): Promise<RegistrationSession> => {
    const session = (await storeFor(ctx.db).registrations.getRegistrationSession(ctx.masterKey, accountId, id, ctx.now()));
    if (!session) throw new ApiError('REGISTRATION_NOT_FOUND');
    return session;
  };
  /** The stored configuration, read with the start rule that accepted it. */
  const configOf = (session: RegistrationSession): OpenIdConfiguration => {
    const rule = { ...startRule, issuerRules: [...startRule.issuerRules, { issuerRule: 'origin' as const }], hosts: undefined };
    const config = parseOpenIdConfiguration(session.openidConfigurationUrl, session.platformConfiguration, rule);
    if ('code' in config) throw new ApiError('REGISTRATION_NOT_FOUND'); // checked at start; cannot happen
    return config;
  };

  // ---------------------------------------------------------------- GET /api/registrations/:id (contract §3.8)
  app.get<{ Params: { id: string }; Querystring: { raw?: string } }>('/api/registrations/:id', async (req) => {
    const { account } = (await ctx.auth(req, ['bearer']));
    const session = (await sessionOf(account.id, req.params.id));
    return registrationView(configOf(session), session, req.query.raw === 'true');
  });

  // ---------------------------------------------------------------- POST /api/registrations/:id/complete (contract §3.8)
  app.post<{ Params: { id: string } }>('/api/registrations/:id/complete', async (req) => {
    const caller = (await ctx.auth(req, ['bearer']));
    const { account } = caller;
    const protocolUrls = resolver.protocolUrls(account);
    return (await storeFor(ctx.db).audit.request(ctx.now, {
      actor: caller.actor, toolAccountId: account.id, traceId: req.traceId, clientIp: req.ip,
      action: 'registration.complete', target: { type: 'registration', id: req.params.id },
    }, async (audit) => {
      const body = CompleteBody.safeParse(req.body ?? {});
      if (!body.success) throw invalid(body.error);
      const session = (await sessionOf(account.id, req.params.id));
      if (session.status !== 'open') throw new ApiError('REGISTRATION_ALREADY_COMPLETED');
      // Same fields as the page side (B-T3b-03): code and a safe detail.
      const reject = (err: ApiError): never => {
        log.warn('registration_rejected', { trace_id: req.traceId, code: err.code, detail: String(err.details.reason ?? err.code.toLowerCase()) });
        throw err;
      };
      // D5 item 6: the profile of the connection; complete applies its exact rules before it sends anything.
      const profile = findProfile(body.data.profile ?? STANDARD_PROFILE_ID, ctx.profiles);
      if (!profile) throw new ApiError('UNKNOWN_PROFILE', `Unknown provider profile: ${body.data.profile}.`);
      if (!dynamicProfiles.includes(profile)) throw new ApiError('INVALID_REQUEST', 'Invalid field: profile. This profile has no Dynamic Registration.', { details: { field: 'profile' } });
      const rule = profile.dynamicRegistration!;
      const profileChannel = channels.channel(profile.channel);
      const profileLms = channels.textName(profile.channel);
      /**
       * A-T3b-01: the registration may have reached the platform, but the result is unknown; no automatic clean-up.
       * BD-A1-87: the channel's recovery sentence (Moodle: today's text, the same as the app page MOODLE_TOOL_MAY_EXIST)
       * with the tool name that was sent; the code and reason do not change.
       */
      const toolMayExist = (toolName: string) => new ApiError('PLATFORM_ERROR',
        fillText(registrationText(profileChannel, 'TOOL_MAY_EXIST'), { LMS: profileLms, tool: toolName }), { details: { reason: 'tool_may_exist' } });
      // D5 item 3: an opaque token is only sent back, so the operation is always "new".
      const operation0: RegistrationOperation = rule.registrationToken === 'opaque-bearer' ? 'new' : session.operation;
      const updateNotAllowed = (reason?: string) => new ApiError('REGISTRATION_UPDATE_NOT_ALLOWED',
        withLms(registrationText(profileChannel, 'REGISTRATION_UPDATE_NOT_ALLOWED'), profileLms), reason ? { details: { reason } } : {});
      /**
       * The update of an existing platform (the explicit update, or the duplicate client of B-T3b-02). BD-A1-88: the
       * platform keeps its profile, so the chosen profile must be the stored one. A-LA-E2-02-04 (BD-A1-84): a platform
       * that another connection holds (another non-null binding ref) is never changed. Nothing is written on a refusal.
       */
      const updateProblem = (existing: Platform): ApiError | null => {
        if (existing.profile !== profile.id) return updateNotAllowed('profile_mismatch');
        if (body.data.bindingRef !== undefined && existing.bindingRef !== null && existing.bindingRef !== body.data.bindingRef) {
          return new ApiError('BINDING_REF_MISMATCH', 'This platform belongs to another connection (another binding ref). Nothing changed.',
            { details: { reason: 'platform_of_other_connection' } });
        }
        return null;
      };
      // Security §2.5: an update only of this account's platform, named by the caller. Nothing is sent to the platform otherwise.
      if (operation0 === 'update') {
        const target = session.existingPlatformId === null ? null : (await storeFor(ctx.db).platforms.getPlatform(account.id, session.existingPlatformId));
        if (target === null || body.data.updatePlatformId !== session.existingPlatformId) reject(updateNotAllowed());
        const problem = updateProblem(target!);
        if (problem) reject(problem);
      }
      // A-T3b-03: a message target must be our own launch URL for this account (Moodle only checks the domain).
      for (const m of body.data.messages ?? []) {
        if (m.target_link_uri !== undefined && !isOwnLaunchTarget(m.target_link_uri, protocolUrls)) {
          throw new ApiError('INVALID_REQUEST', 'Invalid field: messages.target_link_uri must be the launch URL of this tool account.');
        }
      }
      const config = configOf(session);
      const exact = parseOpenIdConfiguration(session.openidConfigurationUrl, session.platformConfiguration, ruleOf([profile]));
      if ('code' in exact) reject(profileRuleError(exact, profile.id));
      // LA-ADR-05 D6 (BD-A2-89): the site and service origins that a profile rule derived from the configuration.
      const fixed = 'code' in exact ? null : exact.fixed;
      // A configuration URL on a fixed endpoint host proves no site, so nothing is stored or sent (until a live row).
      if (fixed?.siteUrl === null) {
        reject(new ApiError('INVALID_REQUEST', `Invalid field: profile. The site cannot be proven from this platform configuration: its address is a fixed host of profile ${profile.id}.`,
          { details: { field: 'profile', reason: 'configuration_on_fixed_host' } }));
      }
      // A token that the start page did not verify as a registration JWT does not fit a scope-jwt profile. NULL with a
      // token is a session from before LTI migration 021 (verified then). Any other stored kind is refused (fail closed).
      const tokenKind: string | null = session.registrationToken === null ? null : session.tokenKind ?? 'scope-jwt';
      const allowedKinds: ReadonlyArray<string | null> = rule.registrationToken === 'scope-jwt' ? [null, 'scope-jwt'] : [null, 'scope-jwt', 'opaque-bearer'];
      if (!allowedKinds.includes(tokenKind)) {
        reject(new ApiError('INVALID_REQUEST', `Invalid field: profile. The registration token does not have the form that profile ${profile.id} needs.`,
          { details: { field: 'profile', reason: 'registration_token_kind' } }));
      }
      // D5 item 5: a family that another channel guards (BD-A1-54: phase registration, the only call site, BD-A1-55).
      const guard = familyRefusal(config.productFamilyCode, [profile.channel]);
      if (guard) {
        const name = channels.textName(guard.guardChannel);
        reject(new ApiError('INVALID_REQUEST', `Invalid field: profile. ${familyHelp(name)}`, { details: { field: 'profile', reason: `family=${guard.family}` } }));
      }
      // An absent list keeps the legacy five-scope request; only an explicit list checks platform support.
      const scopes = body.data.scopes ?? REGISTRATION_SCOPES;
      const unsupported = body.data.scopes?.filter((scope) => !config.scopesSupported.includes(scope)) ?? [];
      if (unsupported.length) {
        throw new ApiError('INVALID_REQUEST', `Invalid field: scopes. The platform does not support: ${unsupported.join(', ')}.`, {
          details: { field: 'scopes', unsupported },
        });
      }
      // M1 (§9.2): a standard platform cannot use a reserved issuer; nothing is sent to the platform. A profile rule
      // passed only with the profile's own issuer.
      if (!fixed && reservedIssuerOrigins(ctx.profiles).includes(new URL(config.issuer).origin)) reject(new ApiError('ISSUER_RESERVED'));
      // D5 items 4 and 10 (I-SELF, D2a): only a {platformValue} profile stores authorization_server as its audience. When
      // a value is off the issuer origin, the platform is staged: inactive, with the connection's binding ref.
      const platformAud = profile.clientAssertionAud.value === '{platformValue}' ? config.authorizationServer : null;
      // BD-A2-84 (A-LA-E2-02-08): the audience that a staged or active registration stores obeys rule 2, before anything is sent.
      if (platformAud !== null) {
        try { checkAudienceHost(platformAud, hosts, 'authorization_server'); } catch (err) { if (err instanceof ApiError) reject(err); throw err; }
      }
      // LA-ADR-05 D6: a fixed-endpoint profile is always staged; the operator grant proves the derived site.
      const staged = fixed !== null || !endpointsOnIssuerOrigin({ ...config, authorizationServer: platformAud });
      if ((profile.endpointOrigins === 'any-https' || fixed !== null) && body.data.bindingRef === undefined) {
        throw new ApiError('INVALID_REQUEST', 'Invalid field: bindingRef (required for this profile).', { details: { field: 'bindingRef' } });
      }
      if (!(await storeFor(ctx.db).registrations.claimRegistrationSession(account.id, session.id))) throw new ApiError('REGISTRATION_ALREADY_COMPLETED');
      try {
        const clientName = body.data.platformName ?? `${config.productFamilyCode || 'platform'} ${new URL(fixed?.siteUrl ?? config.issuer).host}`;
        const request = buildRegistrationRequest({
          protocolUrls, clientName, scopes, privacyLevel: body.data.privacyLevel ?? session.privacyLevel, ...(body.data.messages ? { messages: body.data.messages } : {}),
          ...(rule.toolConfigurationExtensions ? { extensions: rule.toolConfigurationExtensions } : {}),
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
        const bindingRef = staged ? body.data.bindingRef ?? null : null;
        // BD-A1-89: every credential value of the configuration is written as one set (an omitted authorization_server
        // clears the stored audience), so I-SELF above was decided on exactly the values that are stored.
        const values = {
          clientId: reg.clientId, name: clientName, authEndpoint: config.authorizationEndpoint, tokenEndpoint: config.tokenEndpoint, jwksUrl: config.jwksUri,
          active: staged ? false : body.data.autoActivate ?? true, productFamilyCode: config.productFamilyCode || null, deploymentId: reg.deploymentId,
          grantedScopes: grantedScopesOf(answer), clientAssertionAud: platformAud, bindingRef, siteUrl: fixed?.siteUrl ?? null, serviceUrl: fixed?.serviceUrl ?? null,
        };
        /**
         * The update of an existing platform, checked again in the write transaction (the record can change meanwhile).
         * A1 BD-A1-93 (LA-IC-21): it sets active = false when it stages, else it keeps the stored value, so no registration
         * switches on a platform that an operator or the app switched off. autoActivate applies only to a new platform.
         */

        // The remote request is complete; keep all local writes and the ok event in one synchronous transaction.
        const { platform, operation } = (await audit.completeRegistration(account.id, session.id, session.existingPlatformId, operation0, {
          issuer: config.issuer, clientId: values.clientId, name: values.name, authEndpoint: values.authEndpoint, tokenEndpoint: values.tokenEndpoint,
          jwksUrl: values.jwksUrl, deploymentIds: [values.deploymentId], active: values.active, productFamilyCode: values.productFamilyCode,
          profile: profile.id, bindingRef, clientAssertionAud: platformAud, grantedScopes: values.grantedScopes, siteUrl: values.siteUrl, serviceUrl: values.serviceUrl,
        }, values, staged, updateProblem, req.traceId, ctx.now()));
        log.info('registration_completed', { trace_id: req.traceId, platform_id: platform.id, operation, ...(staged ? { staged: true } : {}) });
        return { html: REGISTRATION_CLOSE_HTML, platformId: platform.id, active: platform.active };
      } catch (err) {
        (await storeFor(ctx.db).registrations.releaseRegistrationSession(account.id, session.id));
        if (err instanceof ApiError) reject(err);
        throw err;
      }
    }));
  });
}
