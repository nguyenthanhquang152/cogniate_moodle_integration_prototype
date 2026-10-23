import type { ChannelRegistry } from '@cogniate/channel-kernel';
// GET /tool/launch and GET /tool/deep-link: the launch handoff (app contract §6, §6.1, security §4, flows §6b, §6c).
// The LTI service sends the browser here with a ltik (303). The app uses each ltik once, reads the launch with
// GET /api/idtoken, and takes the publication only from the SIGNED launch.target. Then it sends the browser on with a
// 303 and Referrer-Policy: no-referrer, so the final URL holds no ltik. No cookies.
// M1 (§6.1): routing by approval (Canvas, Blackboard) or lti_platform_id (Moodle), the site check, the LMS check, the
// role sets of ADR-011 §10, the site origin for frames and return links, and the LMS name in every text.
import type { Logger, PublicUrls } from '@cogniate/shared';
import { canSelectContent, encrypt, isGradedLaunch, randomId, sha256Hex } from '@cogniate/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { LtiClient, LtiIdToken } from '../clients/lti-client.ts';
import { LtiServiceError, ltiErrorFields } from '../clients/lti-client.ts';
import { markLaunched } from '../domain/connections.ts';
import type { Db } from '../domain/db.ts';
import { transaction } from '../domain/db.ts';
import { chooseAttempt, createPlaySession } from '../domain/attempts.ts';
import { publicationOfConnection, upsertResourceLink, useHandoff } from '../domain/launch.ts';
import { createPicker, linkPickToResourceLink } from '../domain/pickers.ts';
import { checkLaunchConnection } from '../kernel/launch-router.ts';
import { appMetricsFor } from '../app/metrics.ts';
export { checkLaunchConnection } from '../kernel/launch-router.ts';
export type { ConnectionCheck } from '../kernel/launch-router.ts';
import type { ChannelText } from '../kernel/ports.ts';
import { LTIK, httpsOrigin, publicationFromTarget, runtimeTokenFor, safeReturnUrl } from './launch-rules.ts';
import { errorPage, handoffRedirectHeaders, toolPageHeaders, withLms } from './page.ts';

export interface LaunchPageDeps {
  channels: ChannelRegistry;
  db: Db;
  urls: PublicUrls;
  logger: Logger;
  lti: LtiClient;
  masterKey: Buffer;
  now: () => number;
  /** PICKER_TTL_SECONDS knob (default 3600). */
  pickerTtlSeconds: number;
  /** PLAY_TTL_SECONDS knob (default 86400). */
  playTtlSeconds: number;
}

export type LaunchErrorCode =
  | 'INVALID_LTIK' | 'HANDOFF_USED' | 'UNKNOWN_PLATFORM' | 'PUBLICATION_NOT_IN_CONNECTION' | 'PUBLICATION_WITHDRAWN'
  | 'NOT_DEEP_LINKING' | 'ROLE_NOT_ALLOWED' | 'LTI_SERVICE_ERROR';

const OPEN_FAILED = 'Cogniate could not open this course';
const NOT_AVAILABLE = 'This course is not available';

/**
 * Status, heading and the one action line of each launch and deep-link error page (they speak to the LMS user). One
 * text table with the LMS name as a parameter (`{LMS}`): with Moodle every text is byte for byte the text before M1.
 */
export const LAUNCH_ERRORS: Record<LaunchErrorCode, { status: number; heading: string; action: string }> = {
  INVALID_LTIK: { status: 401, heading: OPEN_FAILED, action: 'This launch is not valid or it expired. Open the activity again in {LMS}.' },
  HANDOFF_USED: { status: 409, heading: OPEN_FAILED, action: 'This launch link was already used. Open the activity again in {LMS}.' },
  UNKNOWN_PLATFORM: { status: 404, heading: NOT_AVAILABLE, action: 'This {LMS} site is not connected to Cogniate. Tell your {LMS} administrator.' },
  PUBLICATION_NOT_IN_CONNECTION: { status: 404, heading: NOT_AVAILABLE, action: 'Ask your teacher to select the course again in the activity settings.' },
  PUBLICATION_WITHDRAWN: { status: 410, heading: 'This course is no longer available', action: 'Cogniate withdrew this course from this {LMS} site. Ask your teacher for help.' },
  NOT_DEEP_LINKING: { status: 403, heading: 'Cogniate could not open the course list', action: 'This launch cannot select content. In {LMS}, use Select content in the activity settings.' },
  ROLE_NOT_ALLOWED: { status: 403, heading: 'Cogniate could not open the course list', action: 'Only a teacher can select a Cogniate course. Ask a teacher of this {LMS} course.' },
  LTI_SERVICE_ERROR: { status: 502, heading: OPEN_FAILED, action: 'Cogniate could not read this launch. Open the activity again in {LMS}. If it happens again, give the trace id to your {LMS} administrator.' },
};

type LtikQuery = { Querystring: { ltik?: unknown } };

/** The LMS name of a launch before the connection is known: from `platform.profile` (§6.1 "LMS name in texts"). */
const lmsOfToken = (token: LtiIdToken | null, channels: ChannelRegistry): string => channels.textName(token ? channels.channelOfProfile(token.platform.profile ?? 'standard') ?? 'unknown' : null);

export function registerLaunchPages(app: FastifyInstance, deps: LaunchPageDeps): void {
  const { db, urls, logger: log, lti, masterKey, now, channels } = deps;

  const page = (req: FastifyRequest, reply: FastifyReply, code: LaunchErrorCode, lms: ChannelText = channels.textName(null)) => {
    const e = LAUNCH_ERRORS[code];
    return reply.code(e.status).headers(toolPageHeaders('error')).send(errorPage(e.heading, code, req.traceId, withLms(e.action, lms)));
  };

  /**
   * Steps 1 and 2 of both handoffs: single use, then the launch from the LTI service. `event` is the caller's
   * rejection event (launch_rejected or deep_link_rejected); an LTI service failure keeps its status and code in the
   * log (B-T4b2-01). Returns the token, or the reply already sent.
   */
  async function handoff(req: FastifyRequest<LtikQuery>, reply: FastifyReply, event: 'launch_rejected' | 'deep_link_rejected'): Promise<{ ltik: string; token: LtiIdToken } | { sent: FastifyReply }> {
    const ltik = req.query.ltik;
    // A malformed ltik was never used before, so it fails at step 2 (invalid_ltik) without a handoff row.
    if (typeof ltik !== 'string' || !LTIK.test(ltik)) {
      log.warn(event, { trace_id: req.traceId, reason: 'invalid_ltik' });
      if (event === 'launch_rejected') appMetricsFor(db).launchRefused('invalid_ltik', '');
      return { sent: page(req, reply, 'INVALID_LTIK') };
    }
    if (!useHandoff(db, sha256Hex(ltik), now())) {
      log.warn('handoff_rejected', { trace_id: req.traceId, code: 'HANDOFF_USED' });
      return { sent: page(req, reply, 'HANDOFF_USED') };
    }
    try {
      return { ltik, token: await lti.getIdToken(ltik, req.traceId) };
    } catch (err) {
      if (err instanceof LtiServiceError && err.status === 401) {
        log.warn(event, { trace_id: req.traceId, reason: 'invalid_ltik', ...ltiErrorFields(err) });
        if (event === 'launch_rejected') appMetricsFor(db).launchRefused('invalid_ltik', '');
        return { sent: page(req, reply, 'INVALID_LTIK') };
      }
      if (err instanceof LtiServiceError) {
        log.warn(event, { trace_id: req.traceId, reason: 'lti_service_error', ...ltiErrorFields(err) });
        if (event === 'launch_rejected') appMetricsFor(db).launchRefused('lti_service_error', '');
        return { sent: page(req, reply, 'LTI_SERVICE_ERROR') };
      }
      throw err;
    }
  }

  // ---------------------------------------------------------------- resource launch (flows §6c)
  app.get<LtikQuery>('/tool/launch', async (req, reply) => {
    const traceId = req.traceId;
    const h = await handoff(req, reply, 'launch_rejected');
    if ('sent' in h) return h.sent;
    const { token } = h;
    let lms = lmsOfToken(token, channels);
    let channel = channels.channelOfProfile(token.platform.profile ?? 'standard') ?? '';
    const reject = (code: LaunchErrorCode, reason: string, fields: Record<string, unknown> = {}) => {
      appMetricsFor(db).launchRefused(reason, channel);
      log.warn('launch_rejected', { trace_id: traceId, reason, ...fields });
      return page(req, reply, code, lms);
    };
    const { resourceLink, context } = token.launch;
    // A valid deep-linking ltik (or a launch without a resource link) cannot start a course: same page as a bad ltik
    // ("Open the activity again in {LMS}"), but its own log reason (B-T4b2-03). A launch without a context is valid
    // (LA-ADR-05 D2): its placement key uses context id "", as a deep-linking pick without a context does.
    if (token.launch.type !== 'LtiResourceLinkRequest' || !resourceLink) return reject('INVALID_LTIK', 'not_resource_link');
    const contextId = context?.id ?? '';
    // Security §8 / app contract §6.1: approval or Moodle platform -> connection -> library; site and LMS checks.
    const checked = checkLaunchConnection(db, token, channels, log, req.traceId);
    if (!checked.ok) return reject(checked.code, checked.reason, checked.fields);
    const { connection, site } = checked;
    lms = channels.textName(connection.channel);
    channel = connection.channel;
    // Security §4: the publication comes from the signed target only.
    const publicationId = publicationFromTarget(token.launch.target, urls.lti);
    const publication = publicationId ? publicationOfConnection(db, connection.id, publicationId) : undefined;
    if (!publication) return reject('PUBLICATION_NOT_IN_CONNECTION', 'publication_not_in_connection');
    if (publication.status !== 'available') return reject('PUBLICATION_WITHDRAWN', 'publication_withdrawn');

    // ADR-011 §10: graded only with a context learner role and no context staff role; any other launch is a preview.
    const preview = !isGradedLaunch(token.user.roles);
    const serviceKey = token.services?.serviceKey;
    const playId = randomId('ply_');
    const t = now();
    const done = transaction(db, () => {
      const link = upsertResourceLink(db, {
        connectionId: connection.id, publicationId: publication.id, deploymentId: token.platform.deploymentId, contextId,
        resourceLinkId: resourceLink.id, contextTitle: context?.title ?? context?.label ?? '', title: resourceLink.title ?? '',
        lineItemId: token.services?.assignmentAndGrades?.lineItemId ?? null, serviceKeyEncrypted: serviceKey ? encrypt(masterKey, serviceKey) : null,
      }, t);
      if (link.created || link.rebound) {
        linkPickToResourceLink(db, { connectionId: connection.id, deploymentId: token.platform.deploymentId, contextId, publicationId: publication.id, resourceLinkId: link.id });
      }
      const attempt = chooseAttempt(db, { resourceLinkId: link.id, userSub: token.user.id, courseId: publication.courseId, currentVersionId: publication.currentVersionId, preview }, t);
      createPlaySession(db, {
        id: playId, attemptId: attempt.id, runtimeTokenHash: sha256Hex(runtimeTokenFor(masterKey, playId)), sessionId: randomId('ses_'),
        // §6.1 "Return link": kept only when https on {site}; else "Back to …" goes to {site}/.
        roles: token.user.roles, returnUrl: safeReturnUrl(token.launch.presentation?.returnUrl, site), expiresAt: t + deps.playTtlSeconds * 1000,
      }, t);
      markLaunched(db, connection.id, t);
      return { link, attempt };
    });
    if (done.link.rebound) {
      log.info('resource_link_rebound', { trace_id: traceId, resource_link_id: done.link.id, from_publication: done.link.rebound.from, to_publication: done.link.rebound.to });
    }
    log.info('launch_accepted', { trace_id: traceId, attempt_id: done.attempt.id, preview });
    // Security §4 "embedded launch": iframe -> the embedded page; frame (Existing window) and window open the player.
    const embedded = token.launch.presentation?.documentTarget === 'iframe';
    return reply.code(303).headers(handoffRedirectHeaders(`${urls.app}/play/${playId}${embedded ? '/embedded' : ''}`)).send();
  });

  // ---------------------------------------------------------------- deep linking (flows §6b)
  // Check order (app contract §6): single use -> ltik -> message type -> role -> connection (routing, site, LMS).
  app.get<LtikQuery>('/tool/deep-link', async (req, reply) => {
    const traceId = req.traceId;
    const h = await handoff(req, reply, 'deep_link_rejected');
    if ('sent' in h) return h.sent;
    const { ltik, token } = h;
    const lms = lmsOfToken(token, channels);
    const reject = (code: LaunchErrorCode, reason: string, fields: Record<string, unknown> = {}) => {
      log.warn('deep_link_rejected', { trace_id: traceId, reason, ...fields });
      return page(req, reply, code, lms);
    };
    if (token.launch.type !== 'LtiDeepLinkingRequest') return reject('NOT_DEEP_LINKING', 'not_deep_linking');
    // ADR-011 §10: a context staff role or an admin role.
    if (!canSelectContent(token.user.roles)) return reject('ROLE_NOT_ALLOWED', 'role_not_allowed');
    const checked = checkLaunchConnection(db, token, channels, log, req.traceId);
    if (!checked.ok) return reject(checked.code, checked.reason, checked.fields);
    const { connection, site } = checked;
    const issuerOrigin = httpsOrigin(token.platform.url) ?? site;
    const t = now();
    const context = token.launch.context;
    const pickerId = transaction(db, () => {
      const id = createPicker(db, {
        connectionId: connection.id, ltikEncrypted: encrypt(masterKey, ltik), issuerOrigin, siteOrigin: site, deploymentId: token.platform.deploymentId,
        contextId: context?.id ?? '', contextTitle: context?.title ?? context?.label ?? '', expiresAt: t + deps.pickerTtlSeconds * 1000,
      }, t);
      markLaunched(db, connection.id, t);
      return id;
    });
    return reply.code(303).headers(handoffRedirectHeaders(`${urls.app}/tool/picker/${pickerId}`)).send();
  });
}
