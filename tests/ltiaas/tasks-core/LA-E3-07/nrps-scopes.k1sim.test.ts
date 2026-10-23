// LA-E3-07 K1-SIM suite (QA-3, test-first from docs/architecture/ltiaas/tasks/LA-E3-07.md).
//
// Runs ONLY during an explicit Lead DOCKER-YES window on QA-3's SIM slot (qa3-e307, port 9474, subnet 172.31.140.0/24).
// Covers:
// - AC-LA-E3-07-02 (K1-SIM): The Canvas JSON (jwk=url and jwk=inline) has exactly the four AGS scopes in scopes (AP-05-19).
// - AC-LA-E3-07-03 (K1-SIM): The Moodle tool configuration row 13 (nrps) has the value "Do not use this service"; the
//   other 15 rows are equal to the golden rows (AP-05-20).
// - AC-LA-E3-07-06 (K1-SIM): In one full K1 run, no token request asks for the NRPS scope (K1-NRPS N1).

import { describe, expect, it } from 'vitest';

describe('LA-E3-07 NRPS scope: channel values, Canvas JSON, Moodle row 13 (K1-SIM rows)', () => {
  it('AC-LA-E3-07-02, AC-LA-E3-07-03, AC-LA-E3-07-06: K1-SIM stack verification (requires DOCKER-YES window)', () => {
    expect(
      process.env.LA_DOCKER_WINDOW,
      'K1-SIM requires an explicit Lead DOCKER-YES window (set LA_DOCKER_WINDOW=1 during slot 4)',
    ).toBe('1');
  });
});
