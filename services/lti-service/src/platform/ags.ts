// AGS calls that the app needs (contract §3.5 GET rows, §3.6). Order in every call: (1) the line item URL rule
// (no outbound request for a foreign URL), (2) the scope of the launch, (3) the platform token, (4) one AGS request.
// The platform access token goes only to the platform URLs that passed the rule (security §8).
import type { Logger, OutboundClient, OutboundResponse } from '@cogniate/shared';
import { createLogger } from '@cogniate/shared';
import { z } from 'zod';
import { ApiError } from '../api-errors.ts';
import { agsBaseUrl, isAllowedServiceUrl, lineItemSubUrl, withQuery } from '../lti/service-url.ts';
import type { Platform } from '../store/platforms.ts';
import { badPlatformDataError, outboundFailureError, platformResponseError } from './error-mapping.ts';
import type { PagingLinks } from './link-header.ts';
import { parseLinkHeader } from './link-header.ts';
import type { ScoreClock } from './score-clock.ts';
import type { TokenClient } from './token-client.ts';

const SCOPE_BASE = 'https://purl.imsglobal.org/spec/lti-ags/scope/';
export const AGS_SCOPES = {
  lineitem: `${SCOPE_BASE}lineitem`,
  lineitemReadonly: `${SCOPE_BASE}lineitem.readonly`,
  score: `${SCOPE_BASE}score`,
  resultReadonly: `${SCOPE_BASE}result.readonly`,
} as const;

const MEDIA = {
  lineItem: 'application/vnd.ims.lis.v2.lineitem+json',
  lineItemContainer: 'application/vnd.ims.lis.v2.lineitemcontainer+json',
  score: 'application/vnd.ims.lis.v1.score+json',
  resultContainer: 'application/vnd.ims.lis.v2.resultcontainer+json',
} as const;

/** The launch (ltik) or the service key that the call uses. */
export interface AgsContext {
  platform: Platform;
  agsClaim: Record<string, unknown> | null;
  traceId: string;
}

export interface LineItem {
  [key: string]: unknown;
  id: string;
  label?: string;
  scoreMaximum?: number;
  resourceLinkId?: string;
  resourceId?: string;
  tag?: string;
  startDateTime?: string;
  endDateTime?: string;
  gradesReleased?: boolean;
}

export interface LineItemInput {
  [key: string]: unknown;
  label: string;
  scoreMaximum: number;
  resourceLinkId?: string | null;
  resourceId?: string | null;
  tag?: string | null;
  startDateTime?: string | null;
  endDateTime?: string | null;
  gradesReleased?: boolean;
}

export interface ScoreResult {
  [key: string]: unknown;
  id?: string;
  userId?: string;
  scoreOf?: string;
  timestamp?: string;
  resultScore?: number;
  resultMaximum?: number;
  comment?: string;
  scoringUserId?: string;
}

export const ACTIVITY_PROGRESS = ['Initialized', 'Started', 'InProgress', 'Submitted', 'Completed'] as const;
export const GRADING_PROGRESS = ['FullyGraded', 'Pending', 'PendingManual', 'Failed', 'NotReady'] as const;

export interface ScoreInput {
  [key: string]: unknown;
  userId: string;
  activityProgress: (typeof ACTIVITY_PROGRESS)[number];
  gradingProgress: (typeof GRADING_PROGRESS)[number];
  scoreGiven?: number;
  scoreMaximum?: number;
  comment?: string;
  timestamp?: string;
  submission?: { startedAt?: string; submittedAt?: string };
  scoringUserId?: string;
}

const invalid = (field: string, why: string) => new ApiError('INVALID_REQUEST', `Invalid field: ${field} ${why}.`);
const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;
const Submission = z.object({
  startedAt: z.iso.datetime({ offset: true }).optional(),
  submittedAt: z.iso.datetime({ offset: true }).optional(),
});

/** Extension keys are identifiers, not request targets. Keep the original key and value. */
export function urlKeyedMembers(body: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(body).filter(([key]) => {
    if (!/^https:\/\/[^/?#]/i.test(key) || /[\s\\]/.test(key)) return false;
    try { return new URL(key).protocol === 'https:'; } catch { return false; }
  }));
}

function scoreExtensions(body: Record<string, unknown>): Record<string, unknown> {
  const members = urlKeyedMembers(body);
  if (Object.keys(members).length > 8) throw invalid('extensions', 'must have at most 8 URL-keyed members');
  for (const [key, value] of Object.entries(members)) {
    const json = JSON.stringify(value);
    if (json === undefined || Buffer.byteLength(json, 'utf8') > 4096) throw invalid(key, 'must serialize to at most 4096 UTF-8 bytes of JSON, including quotes and escapes');
  }
  return members;
}

/** Contract §3.6 (AC-T3-30): a client timestamp may be at most now + 15 min (later scores get 409 until then). */
export const MAX_SCORE_TIMESTAMP_AHEAD_MS = 15 * 60_000;

/** Score body rules (contract §3.6). `Initiated` is accepted as an alias of `Initialized`. */
export function parseScore(body: unknown, nowMs: number = Date.now()): ScoreInput {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new ApiError('INVALID_REQUEST', 'The body must be a JSON object.');
  const b = body as Record<string, unknown>;
  if (typeof b.userId !== 'string' || b.userId === '' || b.userId.length > 255) throw invalid('userId', 'is required');
  const activity = b.activityProgress === 'Initiated' ? 'Initialized' : b.activityProgress;
  if (!ACTIVITY_PROGRESS.includes(activity as ScoreInput['activityProgress'])) throw invalid('activityProgress', `must be one of ${ACTIVITY_PROGRESS.join(', ')}`);
  if (!GRADING_PROGRESS.includes(b.gradingProgress as ScoreInput['gradingProgress'])) throw invalid('gradingProgress', `must be one of ${GRADING_PROGRESS.join(', ')}`);
  const out: ScoreInput = { userId: b.userId, activityProgress: activity as ScoreInput['activityProgress'], gradingProgress: b.gradingProgress as ScoreInput['gradingProgress'] };
  if (b.scoreMaximum !== undefined) {
    if (typeof b.scoreMaximum !== 'number' || !Number.isFinite(b.scoreMaximum) || b.scoreMaximum <= 0) throw invalid('scoreMaximum', 'must be a number > 0');
    out.scoreMaximum = b.scoreMaximum;
  }
  if (b.scoreGiven !== undefined && b.scoreGiven !== null) {
    if (typeof b.scoreGiven !== 'number' || !Number.isFinite(b.scoreGiven) || b.scoreGiven < 0) throw invalid('scoreGiven', 'must be a number >= 0');
    if (out.scoreMaximum === undefined) throw invalid('scoreMaximum', 'is required with scoreGiven');
    out.scoreGiven = b.scoreGiven;
  }
  // ltiaas-0.0.4 tolerance (contract §8 D14): omit a null score comment from the Moodle request.
  if (b.comment !== undefined && b.comment !== null) {
    if (typeof b.comment !== 'string' || b.comment.length > 4000) throw invalid('comment', 'must be a string');
    out.comment = b.comment;
  }
  if (b.timestamp !== undefined) {
    if (typeof b.timestamp !== 'string' || !ISO_8601.test(b.timestamp) || !Number.isFinite(Date.parse(b.timestamp))) throw invalid('timestamp', 'must be ISO 8601');
    if (Date.parse(b.timestamp) > nowMs + MAX_SCORE_TIMESTAMP_AHEAD_MS) throw invalid('timestamp', 'must not be more than 15 min in the future');
    out.timestamp = b.timestamp;
  }
  if (b.submission !== undefined) {
    const parsed = Submission.safeParse(b.submission);
    if (!parsed.success) throw invalid('submission', 'must contain ISO 8601 startedAt and submittedAt values when present');
    out.submission = parsed.data;
  }
  if (b.scoringUserId !== undefined) {
    if (typeof b.scoringUserId !== 'string') throw invalid('scoringUserId', 'must be a string');
    out.scoringUserId = b.scoringUserId;
  }
  return { ...out, ...scoreExtensions(b) };
}

const scopesOf = (ctx: AgsContext): string[] => (Array.isArray(ctx.agsClaim?.scope) ? (ctx.agsClaim!.scope as unknown[]).filter((s): s is string => typeof s === 'string') : []);

/** The first scope of `wanted` that the launch has, else 403 SERVICE_NOT_AVAILABLE. */
function needScope(ctx: AgsContext, ...wanted: string[]): string {
  const have = scopesOf(ctx);
  const scope = wanted.find((w) => have.includes(w));
  if (!scope) throw new ApiError('SERVICE_NOT_AVAILABLE', 'The launch has no AGS scope for this call.');
  return scope;
}

/** The base URL (AGS claim) and the URL rule for a line item id or a `url` parameter (contract §3.4). */
function checkedUrl(ctx: AgsContext, url: string, code: 'INVALID_LINE_ITEM_ID' | 'INVALID_URL_PARAMETER'): string {
  const base = agsBaseUrl(ctx.agsClaim);
  if (!base) throw new ApiError('SERVICE_NOT_AVAILABLE', 'The launch has no AGS claim.');
  if (!isAllowedServiceUrl(url, base)) throw new ApiError(code);
  return url;
}

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const compact = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

function toLineItem(v: unknown): LineItem {
  if (v === null || typeof v !== 'object' || typeof (v as { id?: unknown }).id !== 'string') throw badPlatformDataError('line item without id');
  const o = v as Record<string, unknown>;
  return compact({
    id: o.id as string, label: str(o.label), scoreMaximum: num(o.scoreMaximum), resourceLinkId: str(o.resourceLinkId), resourceId: str(o.resourceId),
    tag: str(o.tag), startDateTime: str(o.startDateTime), endDateTime: str(o.endDateTime),
    gradesReleased: typeof o.gradesReleased === 'boolean' ? o.gradesReleased : undefined,
    ...urlKeyedMembers(o),
  });
}

function toResult(v: unknown): ScoreResult {
  if (v === null || typeof v !== 'object') throw badPlatformDataError('result is not an object');
  const o = v as Record<string, unknown>;
  return compact({
    id: str(o.id), userId: str(o.userId), scoreOf: str(o.scoreOf), timestamp: str(o.timestamp),
    resultScore: num(o.resultScore), resultMaximum: num(o.resultMaximum), comment: str(o.comment),
    scoringUserId: str(o.scoringUserId), ...urlKeyedMembers(o),
  });
}

function jsonOf(res: OutboundResponse): unknown {
  try {
    return res.json();
  } catch {
    throw badPlatformDataError('answer is not JSON');
  }
}

export interface AgsClientDeps {
  outbound: OutboundClient;
  tokens: TokenClient;
  clock: ScoreClock;
  logger?: Logger;
}

export function createAgsClient(deps: AgsClientDeps) {
  const logger = deps.logger ?? createLogger({ service: 'lti-service' });
  async function call(ctx: AgsContext, scope: string, url: string, init: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; accept: string; contentType?: string; body?: string }): Promise<OutboundResponse> {
    const token = await deps.tokens.getToken(ctx.platform, [scope], ctx.traceId);
    let res: OutboundResponse;
    try {
      res = await deps.outbound.request(url, {
        method: init.method ?? 'GET', traceId: ctx.traceId, ...(init.body !== undefined ? { body: init.body } : {}),
        headers: { authorization: `Bearer ${token}`, accept: init.accept, ...(init.contentType ? { 'content-type': init.contentType } : {}) },
      });
    } catch (err) {
      throw outboundFailureError(err);
    }
    if (res.status < 200 || res.status >= 300) throw platformResponseError(res, { context: { logger, platformId: ctx.platform.id, traceId: ctx.traceId } });
    return res;
  }

  return {
    /** GET /api/lineitems (contract §3.5). `url` replaces every other parameter (platform paging links). */
    async listLineItems(ctx: AgsContext, q: { resourceLinkId?: string; resourceId?: string; tag?: string; limit?: number; url?: string }): Promise<{ lineItems: LineItem[] } & PagingLinks> {
      const base = agsBaseUrl(ctx.agsClaim);
      if (!base || typeof ctx.agsClaim?.lineitems !== 'string') throw new ApiError('SERVICE_NOT_AVAILABLE', 'The launch has no AGS line items URL.');
      const url = q.url !== undefined
        ? checkedUrl(ctx, q.url, 'INVALID_URL_PARAMETER')
        : withQuery(ctx.agsClaim.lineitems, { resource_link_id: q.resourceLinkId, resource_id: q.resourceId, tag: q.tag, limit: q.limit });
      const scope = needScope(ctx, AGS_SCOPES.lineitemReadonly, AGS_SCOPES.lineitem);
      const res = await call(ctx, scope, url, { accept: MEDIA.lineItemContainer });
      const data = jsonOf(res);
      if (!Array.isArray(data)) throw badPlatformDataError('line items are not a list');
      return { lineItems: data.map(toLineItem), ...parseLinkHeader(res.headers.link) };
    },

    /** GET /api/lineitems/:lineItemId. */
    async getLineItem(ctx: AgsContext, lineItemId: string): Promise<LineItem> {
      const url = checkedUrl(ctx, lineItemId, 'INVALID_LINE_ITEM_ID');
      const scope = needScope(ctx, AGS_SCOPES.lineitemReadonly, AGS_SCOPES.lineitem);
      return toLineItem(jsonOf(await call(ctx, scope, url, { accept: MEDIA.lineItem })));
    },

    /** T3c: writes require lineitem, never lineitem.readonly (AGS §3.2). */
    async createLineItem(ctx: AgsContext, item: LineItemInput): Promise<LineItem> {
      if (typeof ctx.agsClaim?.lineitems !== 'string') throw new ApiError('SERVICE_NOT_AVAILABLE', 'The launch has no AGS line items URL.');
      const url = checkedUrl(ctx, ctx.agsClaim.lineitems, 'INVALID_LINE_ITEM_ID');
      const scope = needScope(ctx, AGS_SCOPES.lineitem);
      return toLineItem(jsonOf(await call(ctx, scope, url, { method: 'POST', accept: MEDIA.lineItem, contentType: MEDIA.lineItem, body: JSON.stringify(item) })));
    },

    async updateLineItem(ctx: AgsContext, lineItemId: string, item: LineItemInput): Promise<LineItem> {
      const url = checkedUrl(ctx, lineItemId, 'INVALID_LINE_ITEM_ID');
      const scope = needScope(ctx, AGS_SCOPES.lineitem);
      return toLineItem(jsonOf(await call(ctx, scope, url, { method: 'PUT', accept: MEDIA.lineItem, contentType: MEDIA.lineItem, body: JSON.stringify(item) })));
    },

    async deleteLineItem(ctx: AgsContext, lineItemId: string): Promise<void> {
      const url = checkedUrl(ctx, lineItemId, 'INVALID_LINE_ITEM_ID');
      const scope = needScope(ctx, AGS_SCOPES.lineitem);
      await call(ctx, scope, url, { method: 'DELETE', accept: MEDIA.lineItem });
    },

    /** POST /api/lineitems/:lineItemId/scores. The timestamp comes from the score clock unless the request has one. */
    async postScore(ctx: AgsContext, lineItemId: string, score: ScoreInput): Promise<void> {
      const url = checkedUrl(ctx, lineItemId, 'INVALID_LINE_ITEM_ID');
      const scope = needScope(ctx, AGS_SCOPES.score);
      const timestamp = deps.clock.next(ctx.platform.id, url, score.userId, score.timestamp);
      const body = JSON.stringify(compact({
        userId: score.userId, activityProgress: score.activityProgress, gradingProgress: score.gradingProgress,
        scoreGiven: score.scoreGiven, scoreMaximum: score.scoreMaximum, comment: score.comment, timestamp,
        submission: score.submission, scoringUserId: score.scoringUserId, ...urlKeyedMembers(score),
      }));
      await call(ctx, scope, lineItemSubUrl(url, 'scores'), { method: 'POST', accept: 'application/json', contentType: MEDIA.score, body });
    },

    /** GET /api/lineitems/:lineItemId/scores = AGS results. `url` (a platform paging link) replaces the other parameters. */
    async getScores(ctx: AgsContext, lineItemId: string, q: { userId?: string; limit?: number; url?: string }): Promise<{ scores: ScoreResult[] } & PagingLinks> {
      const item = checkedUrl(ctx, lineItemId, 'INVALID_LINE_ITEM_ID');
      const url = q.url !== undefined ? checkedUrl(ctx, q.url, 'INVALID_URL_PARAMETER') : withQuery(lineItemSubUrl(item, 'results'), { user_id: q.userId, limit: q.limit });
      const scope = needScope(ctx, AGS_SCOPES.resultReadonly);
      const res = await call(ctx, scope, url, { accept: MEDIA.resultContainer });
      const data = jsonOf(res);
      if (!Array.isArray(data)) throw badPlatformDataError('results are not a list');
      return { scores: data.map(toResult), ...parseLinkHeader(res.headers.link) };
    },
  };
}

export type AgsClient = ReturnType<typeof createAgsClient>;
