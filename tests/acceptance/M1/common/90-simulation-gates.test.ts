import {
  admin, assert, denied, deploymentPath, expectStatus, host, httpsRequest, idToken, launch,
  m1Test, service, sharedPlatform, unique, urls, preparedLaunch,
} from './client';

for (const [profile, simulation] of [['default', 'off'], ['default', 'on'], ['acceptance', 'off']] as const) {
  m1Test(`M1-35.common.${profile}-${simulation}`, `simulation gate requires both settings: ${profile}/${simulation}`, async () => {
    const id = await sharedPlatform(), deploymentId = unique('gate');
    expectStatus(await admin('POST', deploymentPath(id), { deploymentId, siteUrl: 'https://learn-a.blackboard.sim.test' }), 201);
    const first = await launch({ deploymentId }); assert.equal(first.response.status, 303);
    const token = await idToken(first.ltik); expectStatus(token, 200);
    const prepared = await preparedLaunch({ deploymentId });
    try {
      assert.equal((await host('m1-profile', { profile, simulation })).code, 0);
      const health = await httpsRequest(urls.lti + '/healthz'); expectStatus(health, 200);
      const body = JSON.parse(health.body);
      assert.equal(body.profile, profile); assert.deepEqual(body.simulation_profiles, []); assert.deepEqual(body.knobs, []);
      const profiles = await admin('GET', '/api/providers'); expectStatus(profiles, 200);
      assert.equal(profiles.json.profiles.length, 6);
      for (const rejected of ['blackboard-sim', 'canvas-sim-cloud']) {
        expectStatus(await admin('POST', '/api/platforms', { profile: rejected, name: 'gate', clientId: unique('gate'),
          ...(rejected.startsWith('canvas') ? { deploymentIds: ['gate'], siteUrl: 'https://school-a.canvas.sim.test' } : {}),
        }), 400, 'UNKNOWN_PROFILE');
      }
      expectStatus(await admin('GET', '/api/platforms/' + id), 200);
      const stopped = await launch({ deploymentId }); denied(stopped.response, 'PLATFORM_NOT_ACTIVE', 403);
      denied(await prepared.submit(), 'PLATFORM_NOT_ACTIVE', 403);
      expectStatus(await idToken(first.ltik), 403, 'PLATFORM_NOT_ACTIVE');
      expectStatus(await service(token.json.services.serviceKey, 'GET', '/api/lineitems'), 403, 'PLATFORM_NOT_ACTIVE');
    } finally {
      assert.equal((await host('m1-profile', { profile: 'acceptance', simulation: 'on' })).code, 0);
    }
  });
}
