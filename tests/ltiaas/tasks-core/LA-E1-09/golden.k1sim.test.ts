// LA-E1-09 AC-LA-E1-09-01 (K1-SIM; pending: Docker window):
// Golden G4: every app tool error page per baseline channel, learner labels and player status texts equal the G-BASE
// baseline byte for byte.
// Source: docs/architecture/ltiaas/tasks/LA-E1-09.md (AC-LA-E1-09-01); TEST-STRATEGY §4.6 G4.
import { describe, it } from 'vitest';
import { expectGoldenEqual } from '../LA-E1-01/golden-binding';

const G4_DOCUMENTS = [/^G4\b/];

describe('LA-E1-09 K1-SIM (pending: Docker window)', () => {
  it('AC-LA-E1-09-01: golden G4 app tool error pages, learner labels and player status texts equal the G-BASE baseline byte for byte', () => {
    expectGoldenEqual('e1-09-ac01', G4_DOCUMENTS, process.env.LA_EXPECTED_DELTA);
  });
});
