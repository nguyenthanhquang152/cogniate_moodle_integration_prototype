// T7 start (tasks/T7.md AC-T7-13): the stack is clean before Scenario A.
// `npm run test:e2e` runs `e2e:reset` first. This spec checks the result from the suite's side and starts a new run
// state (tests/e2e/artifacts/state.json).
import { courseZipCopy } from '../acceptance/lib/course-fixtures';
import { resetState, writeEvidence } from './lib/e2e';
import { healthOf, knobEvents, ORIGINS } from './lib/health';
import { course101, course102, ltiModules } from './lib/oracle';
import { readSteps } from './lib/steps';
import { expect, test } from './lib/pw';

test('T7-START AC-T7-13 at the start: every /healthz shows "profile": "default" and "knobs": [], no test_knob_active event; no LTI activity yet', async ({}, testInfo) => {
  const state = resetState();
  testInfo.annotations.push({ type: 'run', description: state.runId });
  const health: Record<string, unknown> = {};
  for (const origin of ORIGINS()) {
    const h = await healthOf(origin);
    health[origin] = h;
    expect.soft(h.status, `${origin}/healthz status`).toBe(200);
    expect.soft(h.body.profile, `${origin} profile`).toBe('default');
    expect.soft(h.body.knobs, `${origin} knobs`).toEqual([]);
  }
  writeEvidence('health-start.json', health);
  expect.soft(knobEvents(), 'no test_knob_active event in infra/.logs').toEqual([]);

  // After e2e:reset there is no Cogniate tool and no LTI activity (seed does not run seed:lti-manual; T7 known risks).
  expect.soft(await ltiModules(course101()), 'no LTI activity in COGNIATE-DEV-101').toEqual([]);
  expect.soft(await ltiModules(course102()), 'no LTI activity in COGNIATE-DEV-102').toEqual([]);

  // The course zips are there and have the right SHA-256 (tasks README §5).
  courseZipCopy('scorm');
  courseZipCopy('html');
  writeEvidence('moodle-steps.json', readSteps());
});
