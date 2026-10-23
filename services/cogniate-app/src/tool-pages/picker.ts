import type { ChannelRegistry } from '@cogniate/channel-kernel';
// GET and POST /tool/picker/{pickerId}: the content picker in the LMS Deep Linking frame (app contract §6, §6.1, flows §6b).
// The picker id is the capability (no cookies). The POST checks: picker not used and not expired (410), Origin (403),
// each publication belongs to this connection and is available (400, no Deep Linking call). Then it calls
// POST /api/deeplinking with the content items and auto-submits the signed answer to the LMS.
// LA-ADR-05 D3: several items only when the channel has content.multiple and the launch has acceptMultiple (D3b);
// POST /tool/picker/{pickerId}/cancel sends an empty answer (D3a); a placement that takes no graded items gets the
// page PLACEMENT_NOT_GRADED and no Deep Linking call (D3c).
import type { Logger, PublicUrls } from '@cogniate/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { TOOL_ACCOUNT } from '../kernel/setup/common.ts';
import type { ContentItem, LtiClient } from '../clients/lti-client.ts';
import { LtiServiceError, ltiErrorFields } from '../clients/lti-client.ts';
import type { Db } from '../domain/db.ts';
import { publicationOfConnection } from '../domain/launch.ts';
import type { PickerSession } from '../domain/pickers.ts';
import { claimPicker, clearPickerLtik, getPicker, pickablePublications, releasePicker } from '../domain/pickers.ts';
import { httpsOrigin } from './launch-rules.ts';
import { errorPage, escapeHtml, layout, newNonce, toolPageHeaders, withLms } from './page.ts';
import { getConnectionAnyLibrary } from '../domain/connections.ts';
import { PICKER_LTIK_COLUMN, appAad, openText } from '../app/sealing.ts';
import type { ChannelText } from '../kernel/ports.ts';

export interface PickerPageDeps {
  channels: ChannelRegistry;
  db: Db;
  urls: PublicUrls;
  logger: Logger;
  lti: LtiClient;
  masterKey: Buffer;
  now: () => number;
}

export type PickerErrorCode = 'PICKER_NOT_FOUND' | 'PICKER_USED' | 'PICKER_EXPIRED' | 'ORIGIN_NOT_ALLOWED' | 'PUBLICATION_NOT_AVAILABLE' | 'LTI_SERVICE_ERROR' | 'RETURN_URL_MISMATCH'
  | 'PLACEMENT_NOT_GRADED';

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
  // LA-ADR-05 D3c: the launch has acceptLineItem false and the channel cannot send ungraded items.
  PLACEMENT_NOT_GRADED: { status: 403, action: "This {LMS} placement does not take graded items. Use {LMS}'s graded placement to add a Cogniate course." },
};

/** picker_rejected reasons (app contract §12; lti_service_error, return_url_mismatch, not_found: B-T4b2-01). */
type PickerReason = 'used' | 'expired' | 'publication_not_available' | 'not_found' | 'lti_service_error' | 'return_url_mismatch' | 'placement_not_graded';

export const FORMAT_BADGE = { scorm12: 'SCORM 1.2', html: 'HTML' } as const;

const PUBLICATION_ID = /^pub_[A-Za-z0-9_-]{1,64}$/;
/** Grade item name limit (Moodle grade_items.itemname is 255 characters). */
const MAX_TITLE = 255;
/** Multi-select limit: the LTI service accepts at most 20 content items (contract §3.2). */
const MAX_PICKS = 20;
/** options.message of the empty Deep Linking answer (LA-ADR-05 D3a). */
const CANCEL_MESSAGE = 'No course was added.';

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

  const fail = (req: FastifyRequest, reply: FastifyReply, code: PickerErrorCode, reason?: PickerReason, err?: unknown, lms: ChannelText = deps.channels.textName(null)) => {
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
  /** LA-E5-22: the ltik of the picker, bound to its row (the stored key and the library of its connection). */
  const ltikOf = (picker: PickerSession): string =>
    openText(masterKey, picker.ltikEncrypted, appAad(PICKER_LTIK_COLUMN, getConnectionAnyLibrary(db, picker.connectionId)?.libraryId ?? '?', picker.key));

  /** The picker rules from the Deep Linking settings of the picker's launch (LA-ADR-05 D3b, D3c; M1 §6.1 window). */
  const rulesOf = async (picker: PickerSession, channel: string | null, traceId: string) => {
    const ltik = ltikOf(picker);
    const settings = (await lti.getIdToken(ltik, traceId)).launch.deepLinkingSettings;
    const capabilities = channel !== null ? deps.channels.capabilities(channel) : null;
    return {
      ltik,
      /** Checkboxes and 1 to 20 items: only with content.multiple and acceptMultiple true (Moodle: content.multiple false). */
      multiple: capabilities?.['content.multiple'] === true && settings?.acceptMultiple === true,
      /** The placement takes no graded item, and this channel cannot send an item without a lineItem (LA-E3-08). */
      notGraded: settings?.acceptLineItem === false && capabilities?.['content.ungraded'] !== true,
      // M1 (§6.1 "Content item"): Canvas and Blackboard get `window` when the platform accepts the window target.
      window: capabilities?.['launch.windowHint'] === true && (settings?.acceptPresentationDocumentTargets ?? []).includes('window'),
    };
  };

  /**
   * Claim the picker, call POST /api/deeplinking and auto-submit the signed answer to the return URL. A failure before
   * the LMS gets the answer releases the claim (and its picks), so the teacher may try again.
   */
  const sendToLms = async (
    req: FastifyRequest<PickerParams>, reply: FastifyReply, picker: PickerSession, lmsName: string, ltik: string,
    picks: { ids: string[]; items: ContentItem[]; options?: { message: string } }, page: { title: string; html: string },
  ) => {
    if (!claimPicker(db, picker.key, picks.ids, now())) return fail(req, reply, 'PICKER_USED', 'used', undefined, lmsName);
    let answer: { message: string; target: string };
    try {
      answer = await lti.deepLinking(ltik, picks.items, req.traceId, picks.options);
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
  <h1>${escapeHtml(page.title)}</h1>
  ${page.html}
  <form id="cogniate-dl" method="post" action="${escapeHtml(answer.target)}">
    <input type="hidden" name="JWT" value="${escapeHtml(answer.message)}">
    <button type="submit">Continue</button>
  </form>
</main>`;
    const js = "document.getElementById('cogniate-dl').submit();";
    return reply.code(200).headers(toolPageHeaders('picker-submit', { issuer: picker.siteOrigin, returnOrigin, nonce }))
      .send(layout(page.title, body, { nonce, js }));
  };

  /** Security §6: Origin must be PUBLIC_APP_URL (the picker page itself). Other values, null or none: 403, nothing changes. */
  const originRefused = (req: FastifyRequest<PickerParams>, reply: FastifyReply, lmsName: string): FastifyReply | null => {
    const origin = req.headers.origin;
    if (origin === urls.app) return null;
    log.warn('csrf_rejected', { trace_id: req.traceId, origin: typeof origin === 'string' ? origin.slice(0, 200) : null });
    return fail(req, reply, 'ORIGIN_NOT_ALLOWED', undefined, undefined, lmsName);
  };

  // ---------------------------------------------------------------- GET: radio list, or checkboxes (multi-select)
  app.get<PickerParams>('/tool/picker/:pickerId', async (req, reply) => {
    const picker = openPicker(req, reply);
    if (!isPicker(picker)) return picker;
    const { channel, name: lmsName } = lmsOfPicker(picker);
    let rules: Awaited<ReturnType<typeof rulesOf>>;
    try {
      rules = await rulesOf(picker, channel, req.traceId);
    } catch (err) {
      if (err instanceof LtiServiceError) return fail(req, reply, 'LTI_SERVICE_ERROR', 'lti_service_error', err, lmsName);
      throw err;
    }
    if (rules.notGraded) return fail(req, reply, 'PLACEMENT_NOT_GRADED', 'placement_not_graded', undefined, lmsName);
    const rows = pickablePublications(db, picker.connectionId);
    const input = rules.multiple ? 'type="checkbox" name="publicationId"' : 'type="radio" name="publicationId"';
    const list = rows.length === 0
      ? `<p data-empty>No course is published to this ${escapeHtml(lmsName)} site yet. Publish a course in Cogniate, then use Select content again.</p>`
      : `<fieldset>
    <legend>${rules.multiple ? `Choose one or more courses (at most ${MAX_PICKS})` : 'Choose one course'}</legend>
${rows.map((p) => `    <label class="option" data-publication-id="${escapeHtml(p.id)}">
      <input ${input} value="${escapeHtml(p.id)}"${rules.multiple ? '' : ' required'}>
      <span class="option-text">
        <span class="title" data-course-title>${escapeHtml(p.courseTitle)}</span>
        <span class="meta"><span class="badge" data-format="${p.format}">${FORMAT_BADGE[p.format]}</span> Version ${p.version}${p.packageTitle !== null
          ? ` · Package: <span data-package-title>${escapeHtml(p.packageTitle)}</span>` : ''}</span>
      </span>
    </label>`).join('\n')}
  </fieldset>
  <button type="submit">Add to ${escapeHtml(lmsName)}</button>`;
    // LA-ADR-05 D3a: Cancel on the list and on the "No course is published" page; its own form (forms do not nest).
    const body = `<main data-page="picker">
  <h1>Select a Cogniate course</h1>
  ${picker.contextTitle ? `<p class="muted">${escapeHtml(lmsName)} course: <span data-context-title>${escapeHtml(picker.contextTitle)}</span></p>` : ''}
  <form method="post" action="/tool/picker/${escapeHtml(req.params.pickerId)}">
  ${list}
  </form>
  <form method="post" action="/tool/picker/${escapeHtml(req.params.pickerId)}/cancel">
  <button type="submit" data-cancel>Cancel</button>
  </form>
</main>`;
    return reply.code(200).headers(toolPageHeaders('picker', { issuer: picker.siteOrigin })).send(layout('Select a Cogniate course', body));
  });

  // ---------------------------------------------------------------- POST: one pick (or 1 to 20) -> signed Deep Linking answer
  app.post<PickerParams & { Body: { publicationId?: unknown } }>('/tool/picker/:pickerId', async (req, reply) => {
    const picker = openPicker(req, reply);
    if (!isPicker(picker)) return picker;
    const { channel, name: lmsName } = lmsOfPicker(picker);
    const refused = originRefused(req, reply, lmsName);
    if (refused) return refused;
    // Security §4 "picker POST": check again that each publication belongs to this connection and is available.
    const raw = (req.body ?? {}).publicationId;
    const ids = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
    const publications = ids.map((id) => (typeof id === 'string' && PUBLICATION_ID.test(id) ? publicationOfConnection(db, picker.connectionId, id) : undefined));
    const valid = publications.length >= 1 && publications.length <= MAX_PICKS && new Set(ids).size === ids.length
      && publications.every((p) => p !== undefined && p.status === 'available');
    if (!valid) return fail(req, reply, 'PUBLICATION_NOT_AVAILABLE', 'publication_not_available', undefined, lmsName);
    let rules: Awaited<ReturnType<typeof rulesOf>>;
    try {
      rules = await rulesOf(picker, channel, req.traceId);
    } catch (err) {
      if (err instanceof LtiServiceError) return fail(req, reply, 'LTI_SERVICE_ERROR', 'lti_service_error', err, lmsName);
      throw err;
    }
    // A-LAB-04: without multi-select exactly one id (Moodle hides the grade settings for several items, A-T0-11).
    if (ids.length > 1 && !rules.multiple) return fail(req, reply, 'PUBLICATION_NOT_AVAILABLE', 'publication_not_available', undefined, lmsName);
    if (rules.notGraded) return fail(req, reply, 'PLACEMENT_NOT_GRADED', 'placement_not_graded', undefined, lmsName);
    // Items in the order of the picker list (newest first), whatever the order of the form fields. An available
    // publication of this connection is always in that list.
    const order = new Map(pickablePublications(db, picker.connectionId).map((p, i) => [p.id, i]));
    const picked = publications.filter((p) => p !== undefined).sort((x, y) => (order.get(x.id) ?? 0) - (order.get(y.id) ?? 0));
    const title = picked.length === 1 ? 'Adding the course to' : 'Adding the courses to';
    const names = picked.map((p) => `<span data-course-title>${escapeHtml(p.courseTitle)}</span>`).join(', ');
    return sendToLms(req, reply, picker, lmsName, rules.ltik, {
      ids: picked.map((p) => p.id), items: picked.map((p) => contentItemFor(urls, p, { window: rules.window })),
    }, { title: `${title} ${lmsName}`, html: `<p>${picked.length === 1 ? 'Course' : 'Courses'}: ${names}</p>` });
  });

  // ---------------------------------------------------------------- POST cancel: empty signed answer (LA-ADR-05 D3a)
  app.post<PickerParams>('/tool/picker/:pickerId/cancel', async (req, reply) => {
    const picker = openPicker(req, reply);
    if (!isPicker(picker)) return picker;
    const { name: lmsName } = lmsOfPicker(picker);
    const refused = originRefused(req, reply, lmsName);
    if (refused) return refused;
    // No pick row and no publication: the claim only marks the picker used.
    return sendToLms(req, reply, picker, lmsName, ltikOf(picker), { ids: [], items: [], options: { message: CANCEL_MESSAGE } },
      { title: `Returning to ${lmsName}`, html: `<p>${CANCEL_MESSAGE}</p>` });
  });
}
