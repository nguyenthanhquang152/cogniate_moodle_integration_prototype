// GET and POST /tool/register (app contract §6, security §2.5, §5, §6, flows §6a-1). Moodle shows these pages in its
// registration frame (cross-site iframe): no cookies; the `ref` token is the authorization. The confirm page needs a
// real click on "Connect"; the POST then completes the registration in the LTI service and closes Moodle's dialog.
import type { Logger, PublicUrls } from '@cogniate/shared';
import { sha256Hex } from '@cogniate/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { deactivateOrphan, platformInfo, toolName } from '../app/connections.ts';
import type { LtiClient, LtiRegistration } from '../clients/lti-client.ts';
import { LtiServiceError, ltiErrorFields } from '../clients/lti-client.ts';
import type { Connection } from '../domain/connections.ts';
import { PlatformTakenError, findByRefHash, markRegistered, recordConnectError } from '../domain/connections.ts';
import type { Db } from '../domain/db.ts';
import { errorPage, escapeHtml, layout, newNonce, toolPageHeaders } from './page.ts';
import type { RegisterErrorCode } from './register-texts.ts';
import { REGISTER_ERRORS, REGISTER_HEADING, registerErrorText } from './register-texts.ts';

export interface RegisterPageDeps {
  db: Db;
  urls: PublicUrls;
  logger: Logger;
  lti: LtiClient;
  masterKey: Buffer;
  now: () => number;
}

export { REGISTER_ERRORS, REGISTER_HEADING } from './register-texts.ts';
export type { RegisterErrorCode } from './register-texts.ts';

/** Codes that are stored as the connection's lastError (the connection is known; B-T4b1-01). */
const STORED_CODES = new Set<RegisterErrorCode>(['SITE_MISMATCH', 'UPDATE_NOT_ALLOWED', 'REGISTRATION_FAILED', 'MOODLE_TOOL_MAY_EXIST']);

type Found = Connection & { libraryName: string };
type Failure = { ok: false; code: RegisterErrorCode; connection?: Found; err?: unknown };

const REF = /^[A-Za-z0-9_-]{43}$/;

type Form = { registrationId?: unknown; ref?: unknown };

export function registerRegisterPages(app: FastifyInstance, deps: RegisterPageDeps): void {
  const { db, urls, logger: log, lti, now } = deps;

  /** The error page. B-T4b1-01: the log has the LTI status and code (codes only), and a known connection keeps lastError. */
  const fail = (req: FastifyRequest, reply: FastifyReply, f: Omit<Failure, 'ok'>) => {
    const { code, connection, err } = f;
    log.warn('registration_confirm_rejected', { trace_id: req.traceId, code, ...ltiErrorFields(err) });
    if (connection && STORED_CODES.has(code)) {
      recordConnectError(db, connection.id, { code, ltiCode: err instanceof LtiServiceError ? err.code : null, traceId: req.traceId, at: now() });
    }
    const action = registerErrorText(code, connection ? toolName(connection.libraryName) : 'Cogniate')?.action ?? REGISTER_ERRORS[code].action;
    return reply.code(REGISTER_ERRORS[code].status).headers(toolPageHeaders('error')).send(errorPage(REGISTER_HEADING, code, req.traceId, action));
  };

  /** ref -> pending connection that has not expired; registration -> same site; never an update (security §2.5). */
  async function check(req: FastifyRequest, registrationId: unknown, ref: unknown):
    Promise<{ ok: true; connection: Found; registration: LtiRegistration } | Failure> {
    if (typeof ref !== 'string' || !REF.test(ref) || typeof registrationId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(registrationId)) return { ok: false, code: 'REF_INVALID' };
    const connection = findByRefHash(db, sha256Hex(ref));
    if (!connection || connection.status !== 'pending' || connection.method !== 'dynamic') return { ok: false, code: 'REF_INVALID' };
    if (connection.refExpiresAt === null || connection.refExpiresAt <= now()) return { ok: false, code: 'REF_EXPIRED', connection };
    let registration: LtiRegistration;
    try {
      registration = await lti.getRegistration(registrationId, req.traceId);
    } catch (err) {
      return { ok: false, code: err instanceof LtiServiceError && err.status === 404 ? 'REF_INVALID' : 'REGISTRATION_FAILED', connection, err };
    }
    let site: string;
    try {
      site = new URL(registration.url).origin;
    } catch {
      return { ok: false, code: 'SITE_MISMATCH', connection };
    }
    if (site !== connection.siteUrl) return { ok: false, code: 'SITE_MISMATCH', connection };
    // Security §2.5 (A-T4b1-02): the app never allows an update. Re-connect = delete the Moodle tool, disconnect, connect again.
    if (registration.operation === 'update') return { ok: false, code: 'UPDATE_NOT_ALLOWED', connection };
    return { ok: true, connection, registration };
  }

  // ---------------------------------------------------------------- GET: the confirm page
  app.get<{ Querystring: Form }>('/tool/register', async (req, reply) => {
    const r = await check(req, req.query.registrationId, req.query.ref);
    if (!r.ok) return fail(req, reply, r);
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
      return fail(req, reply, { code: 'ORIGIN_NOT_ALLOWED' });
    }
    const form = (req.body ?? {}) as Form;
    const r = await check(req, form.registrationId, form.ref);
    if (!r.ok) return fail(req, reply, r);
    const { connection } = r;
    let platformId: string | null = null;
    try {
      const done = await lti.completeRegistration(String(form.registrationId), {
        platformName: toolName(connection.libraryName), privacyLevel: 'anonymous', autoActivate: true,
      }, req.traceId);
      platformId = done.platformId;
      const platform = await lti.getPlatform(done.platformId, req.traceId);
      // A-T4b1-03: an inactive platform is an existing one that was switched off (for example a deactivated orphan,
      // returned by the LTI service's "known client id" path). Never bind it, and leave it as it is.
      if (!platform.active) {
        platformId = null;
        return fail(req, reply, { code: 'REGISTRATION_FAILED', connection, err: new LtiServiceError(200, 'PLATFORM_NOT_ACTIVE', '') });
      }
      markRegistered(db, connection.id, platformInfo(platform), now());
    } catch (err) {
      if (err instanceof LtiServiceError && err.reason === 'tool_may_exist') return fail(req, reply, { code: 'MOODLE_TOOL_MAY_EXIST', connection, err });
      if (!(err instanceof LtiServiceError) && !(err instanceof PlatformTakenError)) throw err;
      // The LTI service made or returned a platform that this connection cannot take: if no connection owns it, it is
      // an orphan and is switched off at once (security §2.6). The platform of another connection is not touched, and
      // neither connection changes (app contract §6).
      if (platformId !== null) await deactivateOrphan({ db, lti, logger: log }, platformId, req.traceId);
      return fail(req, reply, { code: 'REGISTRATION_FAILED', connection, err });
    }
    const nonce = newNonce();
    const body = `<main data-page="register-done" data-connection-status="registered">
  <h1>Connected</h1>
  <p>Done. Go back to Moodle and activate the tool.</p>
</main>`;
    const js = "(window.opener || window.parent).postMessage({subject:'org.imsglobal.lti.close'}, '*');";
    return reply.code(200).headers(toolPageHeaders('register-result', { site: connection.siteUrl, nonce })).send(layout('Connected to Cogniate', body, { nonce, js }));
  });
}
