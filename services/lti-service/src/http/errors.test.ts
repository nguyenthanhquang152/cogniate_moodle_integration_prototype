import { describe, expect, it } from 'vitest';
import { apiErrorBody, escapeHtml, renderErrorPage } from './errors.ts';

describe('error output', () => {
  it('has the contract error shape with the HTTP reason phrase', () => {
    expect(apiErrorBody(409, 'PLATFORM_ALREADY_EXISTS', 'x')).toEqual({ status: 409, error: 'Conflict', details: { message: 'PLATFORM_ALREADY_EXISTS', description: 'x' } });
  });
  it('escapes everything on the error page and marks the main element', () => {
    const html = renderErrorPage('PLATFORM_ERROR', 'trace-1', 'Do <this>', '<script>alert(1)</script>');
    expect(html).toContain('<main data-error-code="PLATFORM_ERROR" data-trace-id="trace-1">');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(escapeHtml(`"'&`)).toBe('&quot;&#39;&amp;');
  });
});
