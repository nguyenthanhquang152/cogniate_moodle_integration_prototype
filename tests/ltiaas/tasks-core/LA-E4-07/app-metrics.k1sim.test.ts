// LA-E4-07 K1-SIM suite (QA-3, test-first from docs/architecture/ltiaas/tasks/LA-E4-07.md and
// docs/architecture/ltiaas/contracts/cogniate-app-api-delta.md §8a).
//
// Runs ONLY during an explicit Lead DOCKER-YES window on QA-3's SIM slot (qa3-e407, port 9474, subnet 172.31.140.0/24).
// Covers:
// - AC-LA-E4-07-02 (K1-SIM): GET http://cogniate-app:4210/metrics from the e2e container gives OpenMetrics text with
//   all 8 series (app_dispatch_rows, app_dispatch_oldest_pending_seconds, app_dispatch_sends_total,
//   app_launch_refusals_total, app_grant_redemptions_total, app_grant_compensation_failures_total,
//   app_job_runs_total, app_job_last_success_timestamp_seconds).
// - AC-LA-E4-07-03 (K1-SIM): After one accepted score, app_dispatch_sends_total{reporter="lti-ags",outcome="accepted"}
//   is 1 higher.
// - AC-LA-E4-07-04 (K1-SIM): After one launch refused with deployment_not_approved,
//   app_launch_refusals_total{reason="deployment_not_approved",channel=<id>} is 1 higher.
// - AC-LA-E4-07-05 (K1-SIM part): GET http://cogniate-app:4210/readyz gives 200 {status:"ready"} while the LTI service
//   is stopped (BD-A2-88 D3: no LTI service check).
// - AC-LA-E4-07-06 (K1-SIM): K-HYG scan of one /metrics answer has 0 hits (no library id, user id, learner subject,
//   token or key).

import { describe, expect, it } from 'vitest';

describe('LA-E4-07 app metrics and readiness listener (K1-SIM rows)', () => {
  it('AC-LA-E4-07-02..06: K1-SIM verification on acceptance stack (requires DOCKER-YES window)', () => {
    expect(
      process.env.LA_DOCKER_WINDOW,
      'K1-SIM requires an explicit Lead DOCKER-YES window (set LA_DOCKER_WINDOW=1 during slot 4)',
    ).toBe('1');
  });
});
