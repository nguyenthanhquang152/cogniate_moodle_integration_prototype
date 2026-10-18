// T7 end (tasks/T7.md AC-T7-13, AC-T7-12): the stack is still clean after the scenarios, and the run summary for qa.md.
import { loadState, writeEvidence } from './lib/e2e';
import { healthOf, knobEvents, ORIGINS } from './lib/health';
import { expect, test } from './lib/pw';

test('T7-END AC-T7-13 at the end: every /healthz shows "profile": "default" and "knobs": []; no test_knob_active event in the run\'s logs', async () => {
  const health: Record<string, unknown> = {};
  for (const origin of ORIGINS()) {
    const h = await healthOf(origin);
    health[origin] = h;
    expect.soft(h.status, `${origin}/healthz status`).toBe(200);
    expect.soft(h.body.profile, `${origin} profile`).toBe('default');
    expect.soft(h.body.knobs, `${origin} knobs`).toEqual([]);
  }
  writeEvidence('health-end.json', health);
  expect.soft(knobEvents(), 'no test_knob_active event in infra/.logs').toEqual([]);
  // Summary for qa.md (no secret values in it).
  const st = loadState();
  writeEvidence('summary.json', {
    runId: st.runId,
    startedAt: st.startedAt,
    endedAt: new Date().toISOString(),
    timings: st.timings,
    connectionStatus: st.connectionStatus,
    pickers: st.pickers,
    activities: st.activities,
    gradeLatency: st.gradeLatency,
    launches: (st.launches ?? []).map((l) => ({ ...l, finalUrl: l.finalUrl.replace(/\/play\/[^/?#]+/, '/play/<id>') })),
    labelDiffs: st.labelDiffs,
    findings: st.findings,
    done: st.done,
  });
});
