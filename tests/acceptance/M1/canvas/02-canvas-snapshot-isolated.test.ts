import {
  assert, expectStatus, gateEvents, host, httpsRequest, m1Test, urls,
} from '../common/client';
import { gateMark, readiness, snapshotScope, watchAll } from '../common/snapshot';
import { CLOUD, connectionOf, grantState, platformsFor } from './canvas';
import { freshCanvasSuccess, oneCanvasAttempt, snapshotCanvas } from './snapshot-fixture';
import { initialCalls } from './snapshot-oracle.mjs';

m1Test('M1-37.canvas.aa', 'Canvas S1 profile refusal uses neutral readiness text and leaves the grant issued', async () =>
  snapshotScope('M1-37.canvas.aa', async () => {
    assert.equal(process.env.QA_M1_ISOLATED, '1', 'BLOCKED: profile restart needs the separate isolated host phase');
    const p = await snapshotCanvas();
    try {
      assert.equal((await host('m1-profile', { profile: 'acceptance', simulation: 'off' })).code, 0);
      const health = await httpsRequest(urls.lti + '/healthz'); expectStatus(health, 200);
      assert.deepEqual(JSON.parse(health.body).simulation_profiles, []);
      await watchAll(); const mark = await gateMark(), answer = await oneCanvasAttempt(p);
      await readiness(answer, p.connection.id, 'profile_missing');
      initialCalls(await gateEvents(0), mark);
      assert.deepEqual(await platformsFor(p.clientId, CLOUD.issuer), []);
      assert.equal((await connectionOf(p)).status, 'pending');
      assert.equal((await connectionOf(p)).platform, null);
      await grantState(p.grant, p.connection.id, 'issued');
    } finally {
      assert.equal((await host('m1-profile', { profile: 'acceptance', simulation: 'on' })).code, 0);
    }
    await watchAll(); await freshCanvasSuccess(p, CLOUD.issuer);
  }));
