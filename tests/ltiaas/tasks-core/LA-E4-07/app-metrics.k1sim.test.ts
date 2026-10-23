// LA-E4-07 K1-SIM suite (QA-3, test-first from docs/architecture/ltiaas/tasks/LA-E4-07.md,
// docs/architecture/ltiaas/contracts/cogniate-app-api-delta.md §8a, and BD-A2-88 / BD-A1-100).
//
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
//   is stopped (BD-A2-88 D3 / BD-A1-100: no LTI service check).
// - AC-LA-E4-07-06 (K1-SIM): K-HYG scan of one /metrics answer has 0 hits (no library id, user id, learner subject,
//   token or key).
import { describe, expect, it } from 'vitest';
import {
  APP,
  admin,
  bound,
  denied,
  deploymentPath,
  expectStatus,
  host,
  httpsRequest,
  unique,
} from '../../../acceptance/M1/common/client';
import { gradeWorks } from '../../../acceptance/M1/common/course';
import { canvasBound, canvasLaunch } from '../../../acceptance/M1/canvas/canvas';

const OPERATOR_BASE = 'http://cogniate-app:4210';

const EIGHT_FAMILIES = [
  'app_dispatch_rows',
  'app_dispatch_oldest_pending_seconds',
  'app_dispatch_sends',
  'app_launch_refusals',
  'app_grant_redemptions',
  'app_grant_compensation_failures',
  'app_job_runs',
  'app_job_last_success_timestamp_seconds',
] as const;

const EIGHT_SERIES = [
  'app_dispatch_rows',
  'app_dispatch_oldest_pending_seconds',
  'app_dispatch_sends_total',
  'app_launch_refusals_total',
  'app_grant_redemptions_total',
  'app_grant_compensation_failures_total',
  'app_job_runs_total',
  'app_job_last_success_timestamp_seconds',
] as const;

async function fetchMetrics(): Promise<{ status: number; contentType: string; body: string }> {
  const res = await fetch(`${OPERATOR_BASE}/metrics`);
  return {
    status: res.status,
    contentType: res.headers.get('content-type') ?? '',
    body: await res.text(),
  };
}

function readMetricValue(text: string, metricName: string, labels: Record<string, string>): number {
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = /^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{([^}]*)\})?\s+(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)$/.exec(line);
    if (!match) continue;
    const [, name, labelStr, valStr] = match;
    if (name !== metricName && name !== `${metricName}_total`) continue;
    const parsedLabels: Record<string, string> = {};
    if (labelStr) {
      for (const part of labelStr.split(',')) {
        const kv = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*"([^"]*)"\s*$/.exec(part);
        if (kv) parsedLabels[kv[1]!] = kv[2]!;
      }
    }
    if (Object.entries(labels).every(([k, v]) => parsedLabels[k] === v)) {
      return Number(valStr);
    }
  }
  return 0;
}

describe('LA-E4-07 app metrics and readiness listener (K1-SIM rows)', () => {
  it('AC-LA-E4-07-04: after one launch refused with deployment_not_approved, app_launch_refusals_total{reason="deployment_not_approved",channel="canvas"} is 1 higher', async () => {
    const cv = await canvasBound();
    const before = readMetricValue((await fetchMetrics()).body, 'app_launch_refusals_total', {
      reason: 'deployment_not_approved',
      channel: 'canvas',
    });

    const unapprovedDep = unique('unapproved-dep');
    expectStatus(
      await admin('POST', deploymentPath(cv.platformId), {
        deploymentId: unapprovedDep,
      }),
      201,
    );
    const refusedLaunch = await canvasLaunch({ ...cv, deploymentId: unapprovedDep });
    expect(refusedLaunch.response.status).toBe(303);
    const handoffUrl = new URL(String(refusedLaunch.response.headers.location ?? ''), APP).href;
    const handoffRes = await httpsRequest(handoffUrl);
    denied(handoffRes, 'UNKNOWN_PLATFORM', 404);

    const after = readMetricValue((await fetchMetrics()).body, 'app_launch_refusals_total', {
      reason: 'deployment_not_approved',
      channel: 'canvas',
    });
    expect(after).toBe(before + 1);
  });

  it('AC-LA-E4-07-03: after one accepted score, app_dispatch_sends_total{reporter="lti-ags",outcome="accepted"} is 1 higher', async () => {
    const before = readMetricValue((await fetchMetrics()).body, 'app_dispatch_sends_total', {
      reporter: 'lti-ags',
      outcome: 'accepted',
    });

    const bb = await bound();
    await gradeWorks(bb, 'scorm12');

    const after = readMetricValue((await fetchMetrics()).body, 'app_dispatch_sends_total', {
      reporter: 'lti-ags',
      outcome: 'accepted',
    });
    expect(after).toBe(before + 1);
  });

  it('AC-LA-E4-07-02: GET http://cogniate-app:4210/metrics from e2e container gives OpenMetrics text with all 8 series', async () => {
    const res = await fetchMetrics();
    expect(res.status).toBe(200);
    expect(res.contentType).toContain('application/openmetrics-text');
    expect(res.body.trimEnd().endsWith('# EOF')).toBe(true);
    for (const family of EIGHT_FAMILIES) {
      expect(res.body, `metrics includes # TYPE ${family}`).toContain(`# TYPE ${family} `);
    }
    for (const series of EIGHT_SERIES) {
      expect(res.body, `metrics includes ${series}`).toContain(series);
    }
  });

  it('AC-LA-E4-07-06: K-HYG scan of /metrics answer has 0 hits (no library id, user id, learner subject, token or key)', async () => {
    const { body } = await fetchMetrics();
    expect(body).not.toMatch(/\b(?:acc|lib|usr|con|plt|pub|att|grt)_[A-Za-z0-9_-]{6,}\b/);
    expect(body).not.toMatch(/\bltis_[A-Za-z0-9_-]{10,}\b/);
    expect(body).not.toContain('learner-1');
    expect(body).not.toContain('BEGIN PRIVATE KEY');
    expect(body).not.toContain('Thanh');
  });

  it('AC-LA-E4-07-05: GET http://cogniate-app:4210/readyz answers 200 {status:"ready"} both normally and while lti-service is stopped (BD-A2-88 D3 / BD-A1-100)', async () => {
    const readyBefore = await fetch(`${OPERATOR_BASE}/readyz`);
    expect(readyBefore.status).toBe(200);
    expect(await readyBefore.json()).toEqual({ status: 'ready' });

    const stopRes = await host('qa3-lti-stop' as any);
    expect(stopRes.code).toBe(0);
    try {
      const readyStopped = await fetch(`${OPERATOR_BASE}/readyz`);
      expect(readyStopped.status).toBe(200);
      expect(await readyStopped.json()).toEqual({ status: 'ready' });
    } finally {
      const startRes = await host('qa3-lti-start' as any);
      expect(startRes.code).toBe(0);
    }
  });
});
