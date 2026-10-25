import {
  admin, app, assert, denied, deploymentPath, expectStatus, host, httpsRequest, idToken, launch,
  m1Test, service, session, sharedPlatform, unique, urls, preparedLaunch,
} from './client';
import { BASELINE_REAL_PROFILES, checkProfiles, registeredChannels } from '../../lib/open-world.mjs';

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
      // LD-1 open world (LA-E0-04, row 8): the 6 baseline real profiles keep their values and order; each extra
      // profile is a real profile of a registered channel; no simulation profile.
      const s = await session(), providers = await app(s, 'GET', '/app-api/lms-providers'); expectStatus(providers, 200);
      checkProfiles(profiles.json.profiles, BASELINE_REAL_PROFILES, { registered: registeredChannels(providers.json), realOnly: true });
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
