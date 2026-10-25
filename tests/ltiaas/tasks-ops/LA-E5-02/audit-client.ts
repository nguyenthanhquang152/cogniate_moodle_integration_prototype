// Audit API helpers for the QA-2 task suites (LA-E5-02 onward).
// Facts: contract delta §3 (GET /operator/v1/audit query and AuditEvent shape), §5 (audit action table), LA-ADR-06 D4.
// Later QA-2 suites (LA-E5-04, LA-E5-10) import this file; they do not copy it.
import type { ApiResult } from '../../../acceptance/lib/lti';
import { operatorApi, operatorAuth } from '../LA-E5-01/operator';

export interface AuditActor {
  type: string;
  id: string;
}

export interface AuditTarget {
  type: string;
  id: string | null;
}

export interface AuditEvent {
  id: string;
  ts: number | string;
  actor: AuditActor;
  toolAccountId: string | null;
  action: string;
  target: AuditTarget;
  result: 'ok' | 'refused';
  code: string | null;
  traceId: string;
  clientIp: string;
  details: Record<string, unknown> | null;
  [field: string]: unknown;
}

export interface AuditQuery {
  toolAccountId?: string;
  action?: string;
  actorId?: string;
  traceId?: string;
  since?: string | number;
  until?: string | number;
  cursor?: string;
  limit?: number;
}

export interface AuditListResponse {
  events?: AuditEvent[];
  next?: string | null;
}

/** Actor tag in the `<type>:<id>` form of the task specs (for example `api_key:bootstrap-cogniate`, `operator:qa`, `system:bootstrap`). */
export function actorTag(e: AuditEvent): string {
  if (typeof (e as { actor?: unknown }).actor === 'string') return String((e as { actor?: unknown }).actor);
  return `${e.actor?.type ?? ''}:${e.actor?.id ?? ''}`;
}

export function buildAuditPath(query: AuditQuery = {}): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined) params.set(k, String(v));
  }
  const qs = params.toString();
  return `/operator/v1/audit${qs ? `?${qs}` : ''}`;
}

export async function listAudit(
  operatorKey: string,
  query: AuditQuery = {},
  onBody?: (body: string) => void,
): Promise<{ res: ApiResult<AuditListResponse>; events: AuditEvent[]; next: string | null }> {
  const res = await operatorApi<AuditListResponse>('GET', buildAuditPath(query), {
    authorization: operatorAuth(operatorKey),
  });
  onBody?.(res.body);
  const events = Array.isArray(res.json?.events) ? res.json.events : [];
  const next = typeof res.json?.next === 'string' && res.json.next.length > 0 ? res.json.next : null;
  return { res, events, next };
}

/** Reads every page of `GET /operator/v1/audit` for `query` (up to `maxPages`). */
export async function listAllAudit(
  operatorKey: string,
  query: AuditQuery = {},
  { maxPages = 20, onBody }: { maxPages?: number; onBody?: (body: string) => void } = {},
): Promise<{ pages: number; events: AuditEvent[] }> {
  const all: AuditEvent[] = [];
  let cursor = query.cursor;
  let pages = 0;
  for (; pages < maxPages; ) {
    const page = await listAudit(operatorKey, { ...query, cursor }, onBody);
    pages += 1;
    all.push(...page.events);
    if (page.res.status !== 200 || !page.next) break;
    cursor = page.next;
  }
  return { pages, events: all };
}
