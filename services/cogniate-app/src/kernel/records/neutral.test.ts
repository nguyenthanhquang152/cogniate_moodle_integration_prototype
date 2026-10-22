// B-LA-E4-03-01: the record kernel names no reporter and imports no driver. A reporter id belongs to its driver
// folder and to the one binding of the results view (RESULTS_REPORTER, domain/results.ts). Test files and testkits
// may use the lti-ags driver.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dir = new URL('./', import.meta.url);
const product = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.endsWith('.testkit.ts'));

describe('B-LA-E4-03-01: reporter-neutral record kernel', () => {
  it.each(product)('%s has no reporter id literal and no driver import', (file) => {
    const text = readFileSync(new URL(file, dir), 'utf8');
    expect(text).not.toMatch(/['"`]lti-ags['"`]/);
    expect(text).not.toMatch(/from '[^']*\/drivers\//);
  });
  it('checks every product file of the folder', () => {
    expect(product).toEqual(expect.arrayContaining(['dispatch-store.ts', 'outbox.ts', 'records.ts', 'types.ts']));
  });
});
