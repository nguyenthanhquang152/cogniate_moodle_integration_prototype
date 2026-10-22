// LA-E1-08 AC-LA-E1-08-01 (K1-SIM; pending: Docker window):
// Golden G1: the Canvas configuration JSON (G1.canvasConfiguration["jwk=url"] and G1.canvasConfiguration["jwk=inline"])
// equals the G-BASE baseline.
// Source: docs/architecture/ltiaas/tasks/LA-E1-08.md (AC-LA-E1-08-01); TEST-STRATEGY §4.6 G1.
import { describe, it } from 'vitest';
import { expectGoldenEqual } from '../LA-E1-01/golden-binding';

const G1_CANVAS_CONFIG_DOCUMENTS = [/^G1[./]canvasConfiguration\b/, /^G1\b/];

describe('LA-E1-08 K1-SIM (pending: Docker window)', () => {
  it('AC-LA-E1-08-01: golden G1 Canvas configuration JSON (jwk=url and jwk=inline) equals the G-BASE baseline', () => {
    expectGoldenEqual('e1-08-ac01', G1_CANVAS_CONFIG_DOCUMENTS, process.env.LA_EXPECTED_DELTA);
  });
});
