// LA-E1-01 AC-LA-E1-01-03 (K1-SIM): golden G1 `GET /app-api/lms-providers` and the connection DTOs equal the
// G-BASE baseline. No `LA-IC` expected-delta file applies: E1-01 adds no wire field (the new fields come with
// LA-E1-02, LA-E1-06 and LA-E1-10). The binding and its run order are in golden-binding.ts.
import { describe, it } from 'vitest';
import { G1_PROVIDERS_AND_CONNECTIONS, expectGoldenEqual } from './golden-binding';

describe('LA-E1-01 K1-SIM', () => {
  it('AC-LA-E1-01-03: golden G1 lms-providers and connection DTOs equal the G-BASE baseline', () => {
    expectGoldenEqual('e1-01-ac03', G1_PROVIDERS_AND_CONNECTIONS);
  });
});
