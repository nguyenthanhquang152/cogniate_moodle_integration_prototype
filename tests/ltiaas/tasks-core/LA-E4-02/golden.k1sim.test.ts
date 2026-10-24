// LA-E4-02 AC-LA-E4-02-08 (K1-SIM):
// Golden G3 (`results` API rows, `scoreSyncs`, `lastScoreSync`, Resend answers, play status) equals the G-BASE baseline.
// Source: docs/architecture/ltiaas/tasks/LA-E4-02.md (AC-LA-E4-02-08); TEST-STRATEGY.md §4.6 G3.
import { describe, it } from 'vitest';
import { expectGoldenEqual } from '../LA-E1-01/golden-binding';

const G3_DOCUMENTS = [/^G3\b/];

describe('LA-E4-02 K1-SIM', () => {
  it('AC-LA-E4-02-08: golden G3 results API rows, scoreSyncs, lastScoreSync, Resend answers and play status equal the G-BASE baseline', () => {
    expectGoldenEqual('e4-02-ac08', G3_DOCUMENTS, process.env.LA_EXPECTED_DELTA);
  });
});
