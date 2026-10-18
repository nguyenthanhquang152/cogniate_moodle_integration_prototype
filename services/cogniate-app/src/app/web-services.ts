// T8 course shell (app contract §11): PUT /app-api/connections/:id/web-services {token}.
// The token is checked with core_webservice_get_site_info, it must allow every function that Cogniate uses, and it is
// stored encrypted (APP_MASTER_KEY). The site name, release and function list come back (AC-T8-08).
import { encrypt } from '@cogniate/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { MoodleWsClient } from '../clients/moodle-ws.ts';
import { MoodleWsError, REQUIRED_WS_FUNCTIONS } from '../clients/moodle-ws.ts';
import { getConnection, setWebServices } from '../domain/connections.ts';
import type { Db } from '../domain/db.ts';
import { ApiError } from './api-errors.ts';

export interface WebServiceRouteDeps {
  db: Db;
  masterKey: Buffer;
  moodleWs: MoodleWsClient;
  now: () => number;
}

const Body = z.object({ token: z.string().regex(/^[A-Za-z0-9]{16,128}$/) });
/** Moodle error codes of a token that Moodle does not accept. */
const REJECTED = new Set(['invalidtoken', 'accessexception', 'servicenotavailable', 'webservicesnotenabled', 'invalidtimedtoken']);

export function registerWebServiceRoutes(api: FastifyInstance, deps: WebServiceRouteDeps): void {
  const { db, masterKey, moodleWs, now } = deps;
  api.put<{ Params: { id: string } }>('/connections/:id/web-services', async (req: FastifyRequest<{ Params: { id: string } }>) => {
    const lib = req.auth!.signedIn.library.id;
    const c = getConnection(db, lib, req.params.id);
    if (!c) throw new ApiError('NOT_FOUND', 'The connection does not exist in your library.');
    const body = Body.safeParse(req.body ?? {});
    if (!body.success) throw new ApiError('WS_TOKEN_INVALID', 'The token must be the 32-character web services token from Moodle.');
    let info: { siteName: string; release: string; functions: string[] };
    try {
      info = await moodleWs.siteInfo(c.siteUrl, body.data.token, req.traceId);
    } catch (err) {
      if (err instanceof MoodleWsError && REJECTED.has(err.errorcode)) throw new ApiError('WS_TOKEN_INVALID', `Moodle did not accept the token (${err.errorcode}).`, { details: { errorcode: err.errorcode } });
      if (err instanceof MoodleWsError) throw new ApiError('MOODLE_WS_ERROR', `Moodle web services failed (${err.errorcode}). Trace id: ${req.traceId}`);
      throw err;
    }
    const missing = REQUIRED_WS_FUNCTIONS.filter((f) => !info.functions.includes(f));
    if (missing.length > 0) throw new ApiError('WS_FUNCTIONS_MISSING', `The token cannot use: ${missing.join(', ')}.`, { details: { missing } });
    setWebServices(db, lib, c.id, { tokenEncrypted: encrypt(masterKey, body.data.token), siteName: info.siteName, release: info.release }, now());
    return { siteName: info.siteName, release: info.release, functions: info.functions };
  });
}
