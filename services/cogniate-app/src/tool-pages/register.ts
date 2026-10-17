// GET and POST /tool/register (app contract §6, security §2.5, §5, §6, flows §6a-1). Moodle shows these pages in its
// registration frame (cross-site iframe): no cookies; the `ref` token is the authorization. The confirm page needs a
// real click on "Connect"; the POST then completes the registration in the LTI service and closes Moodle's dialog.
import type { Logger, PublicUrls } from '@cogniate/shared';
import { sha256Hex } from '@cogniate/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { platformInfo, toolName } from '../app/connections.ts';
import type { Connection } from '../domain/connections.ts';
import { PlatformTakenError, findByRefHash, markRegistered, refreshPlatform } from '../domain/connections.ts';
import type { Db } from '../domain/db.ts';
import type { LtiClient, LtiRegistration } from '../domain/lti-client.ts';
import { LtiServiceError } from '../domain/lti-client.ts';
import { errorPage, escapeHtml, layout, newNonce, toolPageHeaders } from './page.ts';

export interface RegisterPageDeps {
  db: Db;
  urls: PublicUrls;
  logger: Logger;
  lti: LtiClient;
  masterKey: Buffer;
  now: () => number;
}

export type RegisterErrorCode = 'REF_INVALID' | 'REF_EXPIRED' | 'SITE_MISMATCH' | 'UPDATE_NOT_ALLOWED' | 'ORIGIN_NOT_ALLOWED' | 'REGISTRATION_FAILED' | 'MOODLE_TOOL_MAY_EXIST';

/** Status and the one action line of each page (they speak to the Moodle admin who sees the frame). */
export const REGISTER_ERRORS: Record<RegisterErrorCode, { status: number; action: string }> = {
  REF_INVALID: { status: 400, action: 'This registration link is not valid or was already used. In Cogniate, open the connection and copy a new registration URL.' },
  REF_EXPIRED: { status: 400, action: 'This registration link expired. In Cogniate, open the connection and make a new registration URL.' },
  SITE_MISMATCH: { status: 400, action: 'This registration link is for another Moodle site. Use the link on the Moodle site that the Cogniate connection names.' },
  UPDATE_NOT_ALLOWED: { status: 409, action: 'Go back in Moodle and choose Register as a new tool.' },
  ORIGIN_NOT_ALLOWED: { status: 403, action: 'Open the registration again from Moodle and press Connect on the Cogniate page.' },
  REGISTRATION_FAILED: { status: 502, action: 'The registration did not finish. Start it again from Moodle. If it happens again, give the trace id to your Cogniate admin.' },
  // A-T3b-01: the LTI service does not know if Moodle saved the tool. No automatic clean-up.
  MOODLE_TOOL_MAY_EXIST: { status: 502, action: 'Moodle may have created a Pending Cogniate tool. Delete it in Site administration > Plugins > Activity modules > External tool > Manage tools, then start Connect again.' },
};

/** Security §2.5 / ADR-009: an "update" is allowed only for this connection's own platform (a re-connect). */
export function isUpdateAllowed(registration: Pick<LtiRegistration, 'operation' | 'existingPlatformId'>, connection: Pick<Connection, 'ltiPlatformId'>): boolean {
  if (registration.operation !== 'update') return true;
  return registration.existingPlatformId !== null && registration.existingPlatformId === connection.ltiPlatformId;
}

const HEADING = 'Cogniate could not connect this Moodle site';
const REF = /^[A-Za-z0-9_-]{43}$/;

type Form = { registrationId?: unknown; ref?: unknown };

export function registerRegisterPages(app: FastifyInstance, deps: RegisterPageDeps): void {
  const { db, urls, logger: log, lti, now } = deps;

  const fail = (req: FastifyRequest, reply: FastifyReply, code: RegisterErrorCode) => {
    log.warn('registration_confirm_rejected', { trace_id: req.traceId, code });
    return reply.code(REGISTER_ERRORS[code].status).headers(toolPageHeaders('error')).send(errorPage(HEADING, code, req.traceId, REGISTER_ERRORS[code].action));
  };

  /** ref -> pending connection that has not expired; registration -> same site; the update rule. */
  async function check(req: FastifyRequest, registrationId: unknown, ref: unknown):
    Promise<{ ok: true; connection: Connection & { libraryName: string }; registration: LtiRegistration } | { ok: false; code: RegisterErrorCode }> {
    if (typeof ref !== 'string' || !REF.test(ref) || typeof registrationId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(registrationId)) return { ok: false, code: 'REF_INVALID' };
    const connection = findByRefHash(db, sha256Hex(ref));
    if (!connection || connection.status !== 'pending' || connection.method !== 'dynamic') return { ok: false, code: 'REF_INVALID' };
    if (connection.refExpiresAt === null || connection.refExpiresAt <= now()) return { ok: false, code: 'REF_EXPIRED' };
    let registration: LtiRegistration;
    try {
      registration = await lti.getRegistration(registrationId, req.traceId);
    } catch (err) {
      return { ok: false, code: err instanceof LtiServiceError && err.status === 404 ? 'REF_INVALID' : 'REGISTRATION_FAILED' };
    }
    let site: string;
    try {
      site = new URL(registration.url).origin;
    } catch {
      return { ok: false, code: 'SITE_MISMATCH' };
    }
    if (site !== connection.siteUrl) return { ok: false, code: 'SITE_MISMATCH' };
    if (!isUpdateAllowed(registration, connection)) return { ok: false, code: 'UPDATE_NOT_ALLOWED' };
    return { ok: true, connection, registration };
  }

  // ---------------------------------------------------------------- GET: the confirm page
  app.get<{ Querystring: Form }>('/tool/register', async (req, reply) => {
    const r = await check(req, req.query.registrationId, req.query.ref);
    if (!r.ok) return fail(req, reply, r.code);
    const nonce = newNonce();
    const { connection, registration } = r;
    const body = `<main data-page="register-confirm">
  <h1>Connect this Moodle site to Cogniate</h1>
  <dl>
    <dt>Moodle site</dt><dd>${escapeHtml(connection.siteUrl)}</dd>
    <dt>Moodle version</dt><dd>${escapeHtml(registration.version || 'unknown')}</dd>
    <dt>Cogniate library</dt><dd>${escapeHtml(connection.libraryName)}</dd>
    <dt>Tool name</dt><dd>${escapeHtml(toolName(connection.libraryName))}</dd>
  </dl>
  <p>Learners are anonymous: Moodle does not send names or emails.</p>
  <form method="post" action="/tool/register">
    <input type="hidden" name="registrationId" value="${escapeHtml(String(req.query.registrationId))}">
    <input type="hidden" name="ref" value="${escapeHtml(String(req.query.ref))}">
    <button type="submit">Connect</button>
  </form>
</main>`;
    return reply.code(200).headers(toolPageHeaders('register-form', { site: connection.siteUrl, nonce })).send(layout('Connect to Cogniate', body));
  });

  // ---------------------------------------------------------------- POST: complete the registration
  app.post<{ Body: Form }>('/tool/register', async (req, reply) => {
    // Security §6: Origin must be PUBLIC_APP_URL (a real click on the confirm page). Other values, null or none: 403.
    const origin = req.headers.origin;
    if (origin !== urls.app) {
      log.warn('csrf_rejected', { trace_id: req.traceId, origin: typeof origin === 'string' ? origin.slice(0, 200) : null });
      return fail(req, reply, 'ORIGIN_NOT_ALLOWED');
    }
    const form = (req.body ?? {}) as Form;
    const r = await check(req, form.registrationId, form.ref);
    if (!r.ok) return fail(req, reply, r.code);
    const { connection, registration } = r;
    const update = registration.operation === 'update';
    try {
      const done = await lti.completeRegistration(String(form.registrationId), {
        platformName: toolName(connection.libraryName), privacyLevel: 'anonymous', autoActivate: true,
        ...(update ? { updatePlatformId: registration.existingPlatformId! } : {}),
      }, req.traceId);
      const platform = platformInfo(await lti.getPlatform(done.platformId, req.traceId));
      if (update) refreshPlatform(db, connection.id, platform, now());
      else markRegistered(db, connection.id, platform, now());
    } catch (err) {
      if (err instanceof LtiServiceError && err.reason === 'tool_may_exist') return fail(req, reply, 'MOODLE_TOOL_MAY_EXIST');
      if (err instanceof LtiServiceError || err instanceof PlatformTakenError) return fail(req, reply, 'REGISTRATION_FAILED');
      throw err;
    }
    const nonce = newNonce();
    const body = `<main data-page="register-done" data-connection-status="registered">
  <h1>Done</h1>
  <p>Done. Go back to Moodle and activate the tool.</p>
</main>`;
    const js = "(window.opener || window.parent).postMessage({subject:'org.imsglobal.lti.close'}, '*');";
    return reply.code(200).headers(toolPageHeaders('register-result', { site: connection.siteUrl, nonce })).send(layout('Connected to Cogniate', body, { nonce, js }));
  });
}
