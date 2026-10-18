// GET /tool/launch and GET /tool/deep-link: the launch handoff (app contract §6, security §4, flows §6b, §6c).
// The LTI service sends the browser here with a ltik (303). The app uses each ltik once, reads the launch with
// GET /api/idtoken, and takes the publication only from the SIGNED launch.target. Then it sends the browser on with a
// 303 and Referrer-Policy: no-referrer, so the final URL holds no ltik. No cookies.
import type { Logger, PublicUrls } from '@cogniate/shared';
import { encrypt, randomId, sha256Hex } from '@cogniate/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { LtiClient, LtiIdToken } from '../clients/lti-client.ts';
import { LtiServiceError } from '../clients/lti-client.ts';
import { findLaunchConnection, markLaunched } from '../domain/connections.ts';
import type { Db } from '../domain/db.ts';
import { transaction } from '../domain/db.ts';
import { chooseAttempt, createPlaySession } from '../domain/attempts.ts';
import { publicationOfConnection, upsertResourceLink, useHandoff } from '../domain/launch.ts';
import { createPicker, linkPickToResourceLink } from '../domain/pickers.ts';
import { LTIK, hasStaffRole, httpsOrigin, publicationFromTarget, runtimeTokenFor, safeReturnUrl } from './launch-rules.ts';
import { errorPage, handoffRedirectHeaders, toolPageHeaders } from './page.ts';

export interface LaunchPageDeps {
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

/** Status, heading and the one action line of each launch and deep-link error page (they speak to the Moodle user). */
export const LAUNCH_ERRORS: Record<LaunchErrorCode, { status: number; heading: string; action: string }> = {
  INVALID_LTIK: { status: 401, heading: OPEN_FAILED, action: 'This launch is not valid or it expired. Open the activity again in Moodle.' },
  HANDOFF_USED: { status: 409, heading: OPEN_FAILED, action: 'This launch link was already used. Open the activity again in Moodle.' },
  UNKNOWN_PLATFORM: { status: 404, heading: NOT_AVAILABLE, action: 'This Moodle site is not connected to Cogniate. Tell your Moodle administrator.' },
  PUBLICATION_NOT_IN_CONNECTION: { status: 404, heading: NOT_AVAILABLE, action: 'Ask your teacher to select the course again in the activity settings.' },
  PUBLICATION_WITHDRAWN: { status: 410, heading: 'This course is no longer available', action: 'Cogniate withdrew this course from this Moodle site. Ask your teacher for help.' },
  NOT_DEEP_LINKING: { status: 403, heading: 'Cogniate could not open the course list', action: 'This launch cannot select content. In Moodle, use Select content in the activity settings.' },
  ROLE_NOT_ALLOWED: { status: 403, heading: 'Cogniate could not open the course list', action: 'Only a teacher can select a Cogniate course. Ask a teacher of this Moodle course.' },
  LTI_SERVICE_ERROR: { status: 502, heading: OPEN_FAILED, action: 'Cogniate cannot reach its LTI service now. Try again in a minute. If it happens again, give the trace id to your Moodle administrator.' },
};

type LtikQuery = { Querystring: { ltik?: unknown } };

export function registerLaunchPages(app: FastifyInstance, deps: LaunchPageDeps): void {
  const { db, urls, logger: log, lti, masterKey, now } = deps;

  const page = (req: FastifyRequest, reply: FastifyReply, code: LaunchErrorCode) => {
    const e = LAUNCH_ERRORS[code];
    return reply.code(e.status).headers(toolPageHeaders('error')).send(errorPage(e.heading, code, req.traceId, e.action));
  };

  /**
   * Steps 1 and 2 of both handoffs: single use, then the launch from the LTI service. `onInvalid` logs the
   * invalid_ltik reason of the caller's event. Returns the token, or the reply already sent.
   */
  async function handoff(req: FastifyRequest<LtikQuery>, reply: FastifyReply, onInvalid: () => void): Promise<{ ltik: string; token: LtiIdToken } | { sent: FastifyReply }> {
    const ltik = req.query.ltik;
    // A malformed ltik was never used before, so it fails at step 2 (invalid_ltik) without a handoff row.
    if (typeof ltik !== 'string' || !LTIK.test(ltik)) {
      onInvalid();
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
        onInvalid();
        return { sent: page(req, reply, 'INVALID_LTIK') };
      }
      if (err instanceof LtiServiceError) return { sent: page(req, reply, 'LTI_SERVICE_ERROR') };
      throw err;
    }
  }

  // ---------------------------------------------------------------- resource launch (flows §6c)
  app.get<LtikQuery>('/tool/launch', async (req, reply) => {
    const traceId = req.traceId;
    const reject = (code: LaunchErrorCode, reason: string) => {
      log.warn('launch_rejected', { trace_id: traceId, reason });
      return page(req, reply, code);
    };
    const h = await handoff(req, reply, () => log.warn('launch_rejected', { trace_id: traceId, reason: 'invalid_ltik' }));
    if ('sent' in h) return h.sent;
    const { token } = h;
    const { resourceLink, context } = token.launch;
    // A deep-linking ltik (or a launch without a resource link) cannot start a course.
    if (token.launch.type !== 'LtiResourceLinkRequest' || !resourceLink || !context) return reject('INVALID_LTIK', 'invalid_ltik');
    // Security §8: platform.id -> connection -> library.
    const connection = findLaunchConnection(db, token.platform.id);
    const issuerOrigin = httpsOrigin(token.platform.url);
    if (!connection || !issuerOrigin) return reject('UNKNOWN_PLATFORM', 'unknown_platform');
    // Security §4: the publication comes from the signed target only.
    const publicationId = publicationFromTarget(token.launch.target, urls.lti);
    const publication = publicationId ? publicationOfConnection(db, connection.id, publicationId) : undefined;
    if (!publication) return reject('PUBLICATION_NOT_IN_CONNECTION', 'publication_not_in_connection');
    if (publication.status !== 'available') return reject('PUBLICATION_WITHDRAWN', 'publication_withdrawn');

    const preview = hasStaffRole(token.user.roles);
    const serviceKey = token.services?.serviceKey;
    const playId = randomId('ply_');
    const t = now();
    const done = transaction(db, () => {
      const link = upsertResourceLink(db, {
        connectionId: connection.id, publicationId: publication.id, deploymentId: token.platform.deploymentId, contextId: context.id,
        resourceLinkId: resourceLink.id, contextTitle: context.title ?? context.label ?? '', title: resourceLink.title ?? '',
        lineItemId: token.services?.assignmentAndGrades?.lineItemId ?? null, serviceKeyEncrypted: serviceKey ? encrypt(masterKey, serviceKey) : null,
      }, t);
      if (link.created || link.rebound) {
        linkPickToResourceLink(db, { connectionId: connection.id, deploymentId: token.platform.deploymentId, contextId: context.id, publicationId: publication.id, resourceLinkId: link.id });
      }
      const attempt = chooseAttempt(db, { resourceLinkId: link.id, userSub: token.user.id, courseId: publication.courseId, currentVersionId: publication.currentVersionId, preview }, t);
      createPlaySession(db, {
        id: playId, attemptId: attempt.id, runtimeTokenHash: sha256Hex(runtimeTokenFor(masterKey, playId)), sessionId: randomId('ses_'),
        roles: token.user.roles, returnUrl: safeReturnUrl(token.launch.presentation?.returnUrl, issuerOrigin), expiresAt: t + deps.playTtlSeconds * 1000,
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
  // Check order (app contract §6): single use -> ltik -> message type -> role.
  app.get<LtikQuery>('/tool/deep-link', async (req, reply) => {
    const traceId = req.traceId;
    const reject = (code: LaunchErrorCode, reason: string) => {
      log.warn('deep_link_rejected', { trace_id: traceId, reason });
      return page(req, reply, code);
    };
    const h = await handoff(req, reply, () => log.warn('deep_link_rejected', { trace_id: traceId, reason: 'invalid_ltik' }));
    if ('sent' in h) return h.sent;
    const { ltik, token } = h;
    if (token.launch.type !== 'LtiDeepLinkingRequest') return reject('NOT_DEEP_LINKING', 'not_deep_linking');
    if (!hasStaffRole(token.user.roles)) return reject('ROLE_NOT_ALLOWED', 'role_not_allowed');
    const connection = findLaunchConnection(db, token.platform.id);
    const issuerOrigin = httpsOrigin(token.platform.url);
    if (!connection || !issuerOrigin) return reject('UNKNOWN_PLATFORM', 'unknown_platform');
    const t = now();
    const context = token.launch.context;
    const pickerId = transaction(db, () => {
      const id = createPicker(db, {
        connectionId: connection.id, ltikEncrypted: encrypt(masterKey, ltik), issuerOrigin, deploymentId: token.platform.deploymentId,
        contextId: context?.id ?? '', contextTitle: context?.title ?? context?.label ?? '', expiresAt: t + deps.pickerTtlSeconds * 1000,
      }, t);
      markLaunched(db, connection.id, t);
      return id;
    });
    return reply.code(303).headers(handoffRedirectHeaders(`${urls.app}/tool/picker/${pickerId}`)).send();
  });
}
