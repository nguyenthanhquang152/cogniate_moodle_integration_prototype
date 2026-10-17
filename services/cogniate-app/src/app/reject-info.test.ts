import { REJECT_CODES } from '@cogniate/package-inspector';
import { describe, expect, it } from 'vitest';
import { REJECT_INFO } from './reject-info.ts';

describe('reject info (B-T4a-02)', () => {
  it('every reject code of the inspector has a title and an action sentence', () => {
    expect(Object.keys(REJECT_INFO).sort()).toEqual([...REJECT_CODES].sort());
    for (const code of REJECT_CODES) {
      expect(REJECT_INFO[code].title.length, code).toBeGreaterThan(5);
      expect(REJECT_INFO[code].action, code).toMatch(/^[A-Z].*\.$/);
    }
  });
});
