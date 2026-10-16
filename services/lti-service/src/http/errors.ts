import { STATUS_CODES } from 'node:http';
import type { ErrorBody } from '@cogniate/shared';

/** An API error with a stable code (contract §1.3). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly description: string;
  constructor(status: number, code: string, description: string) {
    super(code);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.description = description;
  }
}

/** { status, error: <HTTP reason phrase>, details: { message: <code>, description } }. Never a token or a stack. */
export function apiErrorBody(status: number, code: string, description: string): ErrorBody {
  return { status, error: STATUS_CODES[status] ?? 'Error', details: { message: code, description } };
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

/**
 * Headers of every protocol error page (security §5): no form and no action, so any https origin may frame it
 * (it stays visible inside Moodle's frames before a platform is known).
 */
export const ERROR_PAGE_HEADERS: Record<string, string> = {
  'content-type': 'text/html; charset=utf-8',
  'content-security-policy': "default-src 'none'; style-src 'self'; frame-ancestors https:; form-action 'none'",
  'referrer-policy': 'same-origin',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};

/** Error page: the code, the trace id and one action line; <main data-error-code data-trace-id> (security §2.2). */
export function renderErrorPage(code: string, traceId: string, action: string, detail?: string): string {
  const c = escapeHtml(code);
  const t = escapeHtml(traceId);
  const extra = detail ? `\n    <p>Moodle said: <code>${escapeHtml(detail)}</code></p>` : '';
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Cogniate LTI: ${c}</title></head>
<body>
  <main data-error-code="${c}" data-trace-id="${t}">
    <h1>The launch did not work</h1>
    <p>Error code: <code>${c}</code></p>${extra}
    <p>${escapeHtml(action)}</p>
    <p>Trace id: <code>${t}</code></p>
  </main>
</body>
</html>
`;
}
