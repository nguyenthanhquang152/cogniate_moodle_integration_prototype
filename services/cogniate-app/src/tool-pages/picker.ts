import type { ChannelRegistry } from '@cogniate/channel-kernel';
// GET and POST /tool/picker/{pickerId}: the content picker in the LMS Deep Linking frame (app contract §6, §6.1, flows §6b).
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
import { errorPage, escapeHtml, layout, newNonce, toolPageHeaders, withLms } from './page.ts';
import { getConnectionAnyLibrary } from '../domain/connections.ts';
import type { LmsName } from '../providers/index.ts';

export interface PickerPageDeps {
  channels: ChannelRegistry;
  db: Db;
  urls: PublicUrls;
  logger: Logger;
  lti: LtiClient;
  masterKey: Buffer;
  now: () => number;
}

export type PickerErrorCode = 'PICKER_NOT_FOUND' | 'PICKER_USED' | 'PICKER_EXPIRED' | 'ORIGIN_NOT_ALLOWED' | 'PUBLICATION_NOT_AVAILABLE' | 'LTI_SERVICE_ERROR' | 'RETURN_URL_MISMATCH';

const HEADING = 'Cogniate could not add the course';
const AGAIN = 'In {LMS}, use Select content again.';

/** One text table with the LMS name as a parameter (`{LMS}`); with Moodle the texts are byte for byte as before M1. */
export const PICKER_ERRORS: Record<PickerErrorCode, { status: number; action: string }> = {
  PICKER_NOT_FOUND: { status: 404, action: `This course list does not exist. ${AGAIN}` },
  PICKER_USED: { status: 410, action: `This course list was already used. ${AGAIN}` },
  PICKER_EXPIRED: { status: 410, action: `This course list expired. ${AGAIN}` },
  ORIGIN_NOT_ALLOWED: { status: 403, action: 'Open the course list again from {LMS} and choose the course there.' },
  PUBLICATION_NOT_AVAILABLE: { status: 400, action: 'This course is not available for this {LMS} site. In {LMS}, use Select content again and choose one available course.' },
  LTI_SERVICE_ERROR: { status: 502, action: `Cogniate could not send the course to {LMS}. ${AGAIN} If it happens again, give the trace id to your {LMS} administrator.` },
  // B-T4b2-01: the LMS return URL is not on the LMS site of the launch; a retry of the same answer cannot help.
  RETURN_URL_MISMATCH: { status: 502, action: 'Give the trace id to your {LMS} administrator.' },
};

/** picker_rejected reasons (app contract §12; lti_service_error, return_url_mismatch, not_found: B-T4b2-01). */
type PickerReason = 'used' | 'expired' | 'publication_not_available' | 'not_found' | 'lti_service_error' | 'return_url_mismatch';

export const FORMAT_BADGE = { scorm12: 'SCORM 1.2', html: 'HTML' } as const;

const PUBLICATION_ID = /^pub_[A-Za-z0-9_-]{1,64}$/;
/** Grade item name limit (Moodle grade_items.itemname is 255 characters). */
const MAX_TITLE = 255;

type PickerParams = { Params: { pickerId: string } };

/**
 * The Deep Linking content item of a publication (flows §6b: exactly these fields; the LTI service adds none). M1
 * (§6.1 "Content item"): for Canvas and Blackboard, `window` when the platform accepts the `window` target.
 */
export function contentItemFor(urls: PublicUrls, publication: { id: string; courseTitle: string }, opts: { window?: boolean } = {}): ContentItem {
  const title = publication.courseTitle.slice(0, MAX_TITLE);
  return {
    type: 'ltiResourceLink',
    title,
    url: `${urls.lti}/lti/launch/${TOOL_ACCOUNT}?resource=${publication.id}`,
    lineItem: { scoreMaximum: 100, label: title, resourceId: publication.id, tag: 'cogniate-score' },
    ...(opts.window ? { window: { targetName: '_blank' as const } } : {}),
  };
}

export function registerPickerPages(app: FastifyInstance, deps: PickerPageDeps): void {
  const { db, urls, logger: log, lti, masterKey, now } = deps;

  const fail = (req: FastifyRequest, reply: FastifyReply, code: PickerErrorCode, reason?: PickerReason, err?: unknown, lms: LmsName = deps.channels.textName(null)) => {
    if (reason) log.warn('picker_rejected', { trace_id: req.traceId, reason, ...ltiErrorFields(err) });
    const e = PICKER_ERRORS[code];
    return reply.code(e.status).headers(toolPageHeaders('error')).send(errorPage(HEADING, code, req.traceId, withLms(e.action, lms)));
  };
  /** The LMS type and name of a picker's connection. */
  const lmsOfPicker = (p: PickerSession): { channel: string | null; name: string } => {
    const channel = getConnectionAnyLibrary(db, p.connectionId)?.channel ?? null;
    return { channel, name: deps.channels.textName(channel) };
  };

  /** The picker if it exists, is not used and has not expired; else the error page is sent. */
  const openPicker = (req: FastifyRequest<PickerParams>, reply: FastifyReply): PickerSession | FastifyReply => {
    const picker = getPicker(db, req.params.pickerId);
    if (!picker) return fail(req, reply, 'PICKER_NOT_FOUND', 'not_found');
    const { name } = lmsOfPicker(picker);
    if (picker.usedAt !== null) return fail(req, reply, 'PICKER_USED', 'used', undefined, name);
    if (picker.expiresAt <= now()) return fail(req, reply, 'PICKER_EXPIRED', 'expired', undefined, name);
    return picker;
  };
  const isPicker = (v: PickerSession | FastifyReply): v is PickerSession => 'ltikEncrypted' in v;

  // ---------------------------------------------------------------- GET: radio list (single select)
  app.get<PickerParams>('/tool/picker/:pickerId', async (req, reply) => {
    const picker = openPicker(req, reply);
    if (!isPicker(picker)) return picker;
    const rows = pickablePublications(db, picker.connectionId);
    const { name: lmsName } = lmsOfPicker(picker);
    const list = rows.length === 0
      ? `<p data-empty>No course is published to this ${escapeHtml(lmsName)} site yet. Publish a course in Cogniate, then use Select content again.</p>`
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
  <button type="submit">Add to ${escapeHtml(lmsName)}</button>`;
    const body = `<main data-page="picker">
  <h1>Select a Cogniate course</h1>
  ${picker.contextTitle ? `<p class="muted">${escapeHtml(lmsName)} course: <span data-context-title>${escapeHtml(picker.contextTitle)}</span></p>` : ''}
  <form method="post" action="/tool/picker/${escapeHtml(req.params.pickerId)}">
  ${list}
  </form>
</main>`;
    return reply.code(200).headers(toolPageHeaders('picker', { issuer: picker.siteOrigin })).send(layout('Select a Cogniate course', body));
  });

  // ---------------------------------------------------------------- POST: one pick -> signed Deep Linking answer
  app.post<PickerParams & { Body: { publicationId?: unknown } }>('/tool/picker/:pickerId', async (req, reply) => {
    const picker = openPicker(req, reply);
    if (!isPicker(picker)) return picker;
    const { channel, name: lmsName } = lmsOfPicker(picker);
    // Security §6: Origin must be PUBLIC_APP_URL (the picker page itself). Other values, null or none: 403, nothing changes.
    const origin = req.headers.origin;
    if (origin !== urls.app) {
      log.warn('csrf_rejected', { trace_id: req.traceId, origin: typeof origin === 'string' ? origin.slice(0, 200) : null });
      return fail(req, reply, 'ORIGIN_NOT_ALLOWED', undefined, undefined, lmsName);
    }
    // Security §4 "picker POST": check again that the publication belongs to this connection and is available.
    const id = (req.body ?? {}).publicationId;
    const publication = typeof id === 'string' && PUBLICATION_ID.test(id) ? publicationOfConnection(db, picker.connectionId, id) : undefined;
    if (!publication || publication.status !== 'available') return fail(req, reply, 'PUBLICATION_NOT_AVAILABLE', 'publication_not_available', undefined, lmsName);
    if (!claimPicker(db, picker.key, publication.id, now())) return fail(req, reply, 'PICKER_USED', 'used', undefined, lmsName);
    let answer: { message: string; target: string };
    try {
      const ltik = decrypt(masterKey, picker.ltikEncrypted);
      // M1 (§6.1 "Content item"): Canvas and Blackboard get `window` when the platform accepts the window target.
      const window = channel !== null && deps.channels.capabilities(channel)['launch.windowHint']
        && ((await lti.getIdToken(ltik, req.traceId)).launch.deepLinkingSettings?.acceptPresentationDocumentTargets ?? []).includes('window');
      answer = await lti.deepLinking(ltik, [contentItemFor(urls, publication, { window })], req.traceId);
    } catch (err) {
      releasePicker(db, picker.key); // nothing went to the LMS: the teacher may try again
      if (err instanceof LtiServiceError) return fail(req, reply, 'LTI_SERVICE_ERROR', 'lti_service_error', err, lmsName);
      throw err;
    }
    // The return URL (deep_link_return_url) must be https on the SITE origin (§6.1), else we do not post the JWT there.
    const returnOrigin = httpsOrigin(answer.target);
    if (returnOrigin !== picker.siteOrigin) {
      releasePicker(db, picker.key);
      return fail(req, reply, 'RETURN_URL_MISMATCH', 'return_url_mismatch', undefined, lmsName);
    }
    // A-T4b2-04: the pick is done; the encrypted ltik is not needed any more (the release path above keeps it).
    clearPickerLtik(db, picker.key);
    const nonce = newNonce();
    const body = `<main data-page="picker-submit">
  <h1>Adding the course to ${escapeHtml(lmsName)}</h1>
  <p>Course: <span data-course-title>${escapeHtml(publication.courseTitle)}</span></p>
  <form id="cogniate-dl" method="post" action="${escapeHtml(answer.target)}">
    <input type="hidden" name="JWT" value="${escapeHtml(answer.message)}">
    <button type="submit">Continue</button>
  </form>
</main>`;
    const js = "document.getElementById('cogniate-dl').submit();";
    return reply.code(200).headers(toolPageHeaders('picker-submit', { issuer: picker.siteOrigin, returnOrigin, nonce }))
      .send(layout(`Adding the course to ${lmsName}`, body, { nonce, js }));
  });
}
