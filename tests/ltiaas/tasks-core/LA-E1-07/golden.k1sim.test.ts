// LA-E1-07 AC-LA-E1-07-07 (K1-SIM; pending: Docker window):
// R1 (M1 sim phase + M2) and golden G1, G3 and G4 equal the G-BASE baseline except for the LA-IC-01 fields.
// Source: docs/architecture/ltiaas/tasks/LA-E1-07.md (AC-LA-E1-07-07); LA-ADR-04 D8 (LA-IC-01); TEST-STRATEGY §4.6, §4.7.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';
import { expectGoldenEqual } from '../LA-E1-01/golden-binding';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../../../..');
const G1_G3_G4_DOCUMENTS = [/^G1\b/, /^G3\b/, /^G4\b/];

describe('LA-E1-07 K1-SIM (pending: Docker window)', () => {
  it('AC-LA-E1-07-07: golden G1, G3 and G4 equal the G-BASE baseline except for the LA-IC-01 fields', () => {
    const expectedDelta = process.env.LA_EXPECTED_DELTA ?? path.join(ROOT, 'tests/ltiaas/golden/expected/LA-IC-01.json');
    expectGoldenEqual('e1-07-ac07', G1_G3_G4_DOCUMENTS, expectedDelta);
  });
});
