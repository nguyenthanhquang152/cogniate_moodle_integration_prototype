import { describe, expect, it } from 'vitest';
import { escapeHtml, renderErrorPage } from './errors.ts';

describe('error pages (security §2.2)', () => {
  it('escapes everything and marks the main element and the action sentence', () => {
    const html = renderErrorPage('PLATFORM_ERROR', 'trace-1', 'Do <this>', '<script>alert(1)</script>');
    expect(html).toContain('<main data-error-code="PLATFORM_ERROR" data-trace-id="trace-1">');
    expect(html).toContain('<p data-error-action>Do &lt;this&gt;</p>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(escapeHtml(`"'&`)).toBe('&quot;&#39;&amp;');
  });
});
