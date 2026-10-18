// GET and POST /tool/picker/{pickerId}: the content picker in Moodle's Deep Linking frame (app contract §6, flows §6b).
// The picker id is the capability (no cookies). The POST checks: picker not used and not expired (410), Origin (403),
// the publication belongs to this connection and is available (400, no Deep Linking call). Then it calls
// POST /api/deeplinking with exactly one content item and auto-submits the signed answer to Moodle.
import type { Logger, PublicUrls } from '@cogniate/shared';
import { decrypt } from '@cogniate/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { TOOL_ACCOUNT } from '../app/connections.ts';
import type { ContentItem, LtiClient } from '../clients/lti-client.ts';
import { LtiServiceError, ltiErrorFields } from '../clients/lti-client.ts';
import type { Db } from '../domain/db.ts';
import { publicationOfConnection } from '../domain/launch.ts';
import type { PickerSession } from '../domain/pickers.ts';
import { claimPicker, clearPickerLtik, getPicker, pickablePublications, releasePicker } from '../domain/pickers.ts';
import { httpsOrigin } from './launch-rules.ts';
import { errorPage, escapeHtml, layout, newNonce, toolPageHeaders } from './page.ts';

export interface PickerPageDeps {
  db: Db;
  urls: PublicUrls;
  logger: Logger;
  lti: LtiClient;
  masterKey: Buffer;
  now: () => number;
}

export type PickerErrorCode = 'PICKER_NOT_FOUND' | 'PICKER_USED' | 'PICKER_EXPIRED' | 'ORIGIN_NOT_ALLOWED' | 'PUBLICATION_NOT_AVAILABLE' | 'LTI_SERVICE_ERROR' | 'RETURN_URL_MISMATCH';

const HEADING = 'Cogniate could not add the course';
const AGAIN = 'In Moodle, use Select content again.';

export const PICKER_ERRORS: Record<PickerErrorCode, { status: number; action: string }> = {
  PICKER_NOT_FOUND: { status: 404, action: `This course list does not exist. ${AGAIN}` },
  PICKER_USED: { status: 410, action: `This course list was already used. ${AGAIN}` },
  PICKER_EXPIRED: { status: 410, action: `This course list expired. ${AGAIN}` },
  ORIGIN_NOT_ALLOWED: { status: 403, action: 'Open the course list again from Moodle and choose the course there.' },
  PUBLICATION_NOT_AVAILABLE: { status: 400, action: 'This course is not available for this Moodle site. In Moodle, use Select content again and choose one available course.' },
  LTI_SERVICE_ERROR: { status: 502, action: `Cogniate could not send the course to Moodle. ${AGAIN} If it happens again, give the trace id to your Moodle administrator.` },
  // B-T4b2-01: Moodle's return URL is not on the Moodle site of the launch; a retry of the same answer cannot help.
  RETURN_URL_MISMATCH: { status: 502, action: 'Give the trace id to your Moodle administrator.' },
};

/** picker_rejected reasons (app contract §12; lti_service_error, return_url_mismatch, not_found: B-T4b2-01). */
type PickerReason = 'used' | 'expired' | 'publication_not_available' | 'not_found' | 'lti_service_error' | 'return_url_mismatch';

export const FORMAT_BADGE = { scorm12: 'SCORM 1.2', html: 'HTML' } as const;

const PUBLICATION_ID = /^pub_[A-Za-z0-9_-]{1,64}$/;
/** Grade item name limit (Moodle grade_items.itemname is 255 characters). */
const MAX_TITLE = 255;

type PickerParams = { Params: { pickerId: string } };

/** The Deep Linking content item of a publication (flows §6b: exactly these fields; the LTI service adds none). */
export function contentItemFor(urls: PublicUrls, publication: { id: string; courseTitle: string }): ContentItem {
  const title = publication.courseTitle.slice(0, MAX_TITLE);
  return {
    type: 'ltiResourceLink',
    title,
    url: `${urls.lti}/lti/launch/${TOOL_ACCOUNT}?resource=${publication.id}`,
    lineItem: { scoreMaximum: 100, label: title, resourceId: publication.id, tag: 'cogniate-score' },
  };
}

export function registerPickerPages(app: FastifyInstance, deps: PickerPageDeps): void {
  const { db, urls, logger: log, lti, masterKey, now } = deps;

  const fail = (req: FastifyRequest, reply: FastifyReply, code: PickerErrorCode, reason?: PickerReason, err?: unknown) => {
    if (reason) log.warn('picker_rejected', { trace_id: req.traceId, reason, ...ltiErrorFields(err) });
    const e = PICKER_ERRORS[code];
    return reply.code(e.status).headers(toolPageHeaders('error')).send(errorPage(HEADING, code, req.traceId, e.action));
  };

  /** The picker if it exists, is not used and has not expired; else the error page is sent. */
  const openPicker = (req: FastifyRequest<PickerParams>, reply: FastifyReply): PickerSession | FastifyReply => {
    const picker = getPicker(db, req.params.pickerId);
    if (!picker) return fail(req, reply, 'PICKER_NOT_FOUND', 'not_found');
    if (picker.usedAt !== null) return fail(req, reply, 'PICKER_USED', 'used');
    if (picker.expiresAt <= now()) return fail(req, reply, 'PICKER_EXPIRED', 'expired');
    return picker;
  };
  const isPicker = (v: PickerSession | FastifyReply): v is PickerSession => 'ltikEncrypted' in v;

  // ---------------------------------------------------------------- GET: radio list (single select)
  app.get<PickerParams>('/tool/picker/:pickerId', async (req, reply) => {
    const picker = openPicker(req, reply);
    if (!isPicker(picker)) return picker;
    const rows = pickablePublications(db, picker.connectionId);
    const list = rows.length === 0
      ? '<p data-empty>No course is published to this Moodle site yet. Publish a course in Cogniate, then use Select content again.</p>'
      : `<fieldset>
    <legend>Choose one course</legend>
${rows.map((p) => `    <label class="option" data-publication-id="${escapeHtml(p.id)}">
      <input type="radio" name="publicationId" value="${escapeHtml(p.id)}" required>
      <span class="option-text">
        <span class="title" data-course-title>${escapeHtml(p.courseTitle)}</span>
        <span class="meta"><span class="badge" data-format="${p.format}">${FORMAT_BADGE[p.format]}</span> Version ${p.version}${p.packageTitle !== null
          ? ` · Package: <span data-package-title>${escapeHtml(p.packageTitle)}</span>` : ''}</span>
      </span>
    </label>`).join('\n')}
  </fieldset>
  <button type="submit">Add to Moodle</button>`;
    const body = `<main data-page="picker">
  <h1>Select a Cogniate course</h1>
  ${picker.contextTitle ? `<p class="muted">Moodle course: <span data-context-title>${escapeHtml(picker.contextTitle)}</span></p>` : ''}
  <form method="post" action="/tool/picker/${escapeHtml(req.params.pickerId)}">
  ${list}
  </form>
</main>`;
    return reply.code(200).headers(toolPageHeaders('picker', { issuer: picker.issuerOrigin })).send(layout('Select a Cogniate course', body));
  });

  // ---------------------------------------------------------------- POST: one pick -> signed Deep Linking answer
  app.post<PickerParams & { Body: { publicationId?: unknown } }>('/tool/picker/:pickerId', async (req, reply) => {
    const picker = openPicker(req, reply);
    if (!isPicker(picker)) return picker;
    // Security §6: Origin must be PUBLIC_APP_URL (the picker page itself). Other values, null or none: 403, nothing changes.
    const origin = req.headers.origin;
    if (origin !== urls.app) {
      log.warn('csrf_rejected', { trace_id: req.traceId, origin: typeof origin === 'string' ? origin.slice(0, 200) : null });
      return fail(req, reply, 'ORIGIN_NOT_ALLOWED');
    }
    // Security §4 "picker POST": check again that the publication belongs to this connection and is available.
    const id = (req.body ?? {}).publicationId;
    const publication = typeof id === 'string' && PUBLICATION_ID.test(id) ? publicationOfConnection(db, picker.connectionId, id) : undefined;
    if (!publication || publication.status !== 'available') return fail(req, reply, 'PUBLICATION_NOT_AVAILABLE', 'publication_not_available');
    if (!claimPicker(db, picker.key, publication.id, now())) return fail(req, reply, 'PICKER_USED', 'used');
    let answer: { message: string; target: string };
    try {
      answer = await lti.deepLinking(decrypt(masterKey, picker.ltikEncrypted), [contentItemFor(urls, publication)], req.traceId);
    } catch (err) {
      releasePicker(db, picker.key); // nothing went to Moodle: the teacher may try again
      if (err instanceof LtiServiceError) return fail(req, reply, 'LTI_SERVICE_ERROR', 'lti_service_error', err);
      throw err;
    }
    // The return URL is Moodle's (deep_link_return_url): https on the platform origin, else we do not post the JWT there.
    const returnOrigin = httpsOrigin(answer.target);
    if (returnOrigin !== picker.issuerOrigin) {
      releasePicker(db, picker.key);
      return fail(req, reply, 'RETURN_URL_MISMATCH', 'return_url_mismatch');
    }
    // A-T4b2-04: the pick is done; the encrypted ltik is not needed any more (the release path above keeps it).
    clearPickerLtik(db, picker.key);
    const nonce = newNonce();
    const body = `<main data-page="picker-submit">
  <h1>Adding the course to Moodle</h1>
  <p>Course: <span data-course-title>${escapeHtml(publication.courseTitle)}</span></p>
  <form id="cogniate-dl" method="post" action="${escapeHtml(answer.target)}">
    <input type="hidden" name="JWT" value="${escapeHtml(answer.message)}">
    <button type="submit">Continue</button>
  </form>
</main>`;
    const js = "document.getElementById('cogniate-dl').submit();";
    return reply.code(200).headers(toolPageHeaders('picker-submit', { issuer: picker.issuerOrigin, returnOrigin, nonce }))
      .send(layout('Adding the course to Moodle', body, { nonce, js }));
  });
}
