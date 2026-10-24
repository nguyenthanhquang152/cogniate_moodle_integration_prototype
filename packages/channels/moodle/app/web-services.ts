import type { ExtensionRoute } from '../../../../services/cogniate-app/src/kernel/ports.ts';
import { createMoodleWsClient, MoodleWsError, REQUIRED_WS_FUNCTIONS } from './web-service-client.ts';

const REJECTED = new Set(['invalidtoken', 'accessexception', 'servicenotavailable', 'webservicesnotenabled', 'invalidtimedtoken']);

export const webServicesRoute: ExtensionRoute = {
  method: 'PUT', path: 'web-services', capability: 'siteApi.token', legacyCapabilityName: 'webServices',
  async handle(input, ctx) {
    const body = input.body as { token?: unknown } | null;
    if (!body || typeof body.token !== 'string' || !/^[A-Za-z0-9]{16,128}$/.test(body.token)) {
      return { error: { status: 422, code: 'WS_TOKEN_INVALID', message: 'The token must be the 32-character web services token from Moodle.' } };
    }
    const connection = ctx.sql.get<{ site_url: string }>('SELECT site_url FROM connection WHERE library_id = :library_id AND id = :connection_id');
    if (!connection) return { error: { status: 404, code: 'NOT_FOUND', message: 'The connection does not exist in your library.' } };
    let info;
    try {
      info = await createMoodleWsClient({ outbound: ctx.outbound }).siteInfo(connection.site_url, body.token, ctx.traceId);
    } catch (err) {
      if (err instanceof MoodleWsError && REJECTED.has(err.errorcode)) {
        return { error: { status: 422, code: 'WS_TOKEN_INVALID', message: `Moodle did not accept the token (${err.errorcode}).`, details: { errorcode: err.errorcode } } };
      }
      if (err instanceof MoodleWsError) return { error: { status: 502, code: 'MOODLE_WS_ERROR', message: `Moodle web services failed (${err.errorcode}). Trace id: ${ctx.traceId}` } };
      throw err;
    }
    const missing = REQUIRED_WS_FUNCTIONS.filter((f) => !info.functions.includes(f));
    if (missing.length) return { error: { status: 422, code: 'WS_FUNCTIONS_MISSING', message: `The token cannot use: ${missing.join(', ')}.`, details: { missing } } };
    ctx.sql.run(`UPDATE connection SET ws_token_encrypted = :token, ws_site_name = :site_name, ws_release = :release, updated_at = :now
      WHERE id = :connection_id AND library_id = :library_id`, {
      token: await ctx.seal(body.token, 'ws_token_encrypted'), site_name: info.siteName, release: info.release, now: ctx.now(),
    });
    return { status: 200, body: info };
  },
};
