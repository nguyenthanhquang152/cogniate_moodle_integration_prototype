// Protocol error pages (security §2.2). API errors (JSON) use ApiError and the typed code list in @cogniate/shared.
import { escapeHtml } from '@cogniate/shared';

export { escapeHtml };

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

/**
 * Error page (security §2.2): the code, the trace id and one action line. <main data-error-code data-trace-id>,
 * and the next-action sentence is in <p data-error-action>.
 */
export function renderErrorPage(code: string, traceId: string, action: string, detail?: string, heading = 'The launch did not work'): string {
  const c = escapeHtml(code);
  const t = escapeHtml(traceId);
  const extra = detail ? `\n    <p>Moodle said: <code>${escapeHtml(detail)}</code></p>` : '';
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Cogniate LTI: ${c}</title></head>
<body>
  <main data-error-code="${c}" data-trace-id="${t}">
    <h1>${escapeHtml(heading)}</h1>
    <p>Error code: <code>${c}</code></p>${extra}
    <p data-error-action>${escapeHtml(action)}</p>
    <p>Trace id: <code>${t}</code></p>
  </main>
</body>
</html>
`;
}
