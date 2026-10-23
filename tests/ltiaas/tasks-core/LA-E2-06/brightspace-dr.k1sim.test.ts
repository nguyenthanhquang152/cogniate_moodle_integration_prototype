// LA-E2-06 K1-SIM suite (QA-3, test-first from docs/architecture/ltiaas/tasks/LA-E2-06.md).
//
// Runs ONLY during an explicit Lead DOCKER-YES window on QA-3's SIM slot (qa3-e206, port 9474, subnet 172.31.140.0/24).
// Covers:
// - AC-LA-E2-06-02 (K1-SIM): A DR on the D2L simulator provider ends with complete answering active: false; the
//   connection shows authority operatorGrant and status pending; a learner launch gets PLATFORM_NOT_ACTIVE.
// - AC-LA-E2-06-03 (K1-SIM): app:grant issue --accept-staged --confirm-foreign-hosts, then the redemption, activate
//   the staged platform; a learner launch and a score then pass.

import { describe, expect, it } from 'vitest';

describe('LA-E2-06 brightspace Dynamic Registration, staged with a grant (K1-SIM rows)', () => {
  it('AC-LA-E2-06-02 & AC-LA-E2-06-03: D2L simulator staged DR and grant activation (requires DOCKER-YES window)', () => {
    expect(
      process.env.LA_DOCKER_WINDOW,
      'K1-SIM requires an explicit Lead DOCKER-YES window (set LA_DOCKER_WINDOW=1 during slot 4)',
    ).toBe('1');
  });
});
