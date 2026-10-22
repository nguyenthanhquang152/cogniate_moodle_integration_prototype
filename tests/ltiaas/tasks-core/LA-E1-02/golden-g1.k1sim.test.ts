// LA-E1-02 AC-LA-E1-02-09 (K1-SIM): golden G1 `GET /app-api/lms-providers` and the connection DTOs equal the
// G-BASE baseline. No `LA-IC` expected-delta file applies in LA-E1-02 (the additive DTO and lms-providers fields
// land in LA-E1-06). See golden-binding.ts in ../LA-E1-01/ and README.md in this folder.
import { describe, it } from 'vitest';
import { G1_PROVIDERS_AND_CONNECTIONS, expectGoldenEqual } from '../LA-E1-01/golden-binding';

describe('LA-E1-02 K1-SIM', () => {
  it('AC-LA-E1-02-09: golden G1 lms-providers and connection DTOs equal the G-BASE baseline', () => {
    expectGoldenEqual('e1-02-ac09', G1_PROVIDERS_AND_CONNECTIONS);
  });
});
