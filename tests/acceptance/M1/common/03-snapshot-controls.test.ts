import {
  app, assert, expectStatus, m1Test, session, unique, urls,
} from './client';
import { noRequests, snapshotScope, watchAll } from './snapshot';

m1Test('M1-38.common.i5', 'fresh Moodle create remains local with the unchanged capability DTO', async () =>
  snapshotScope('M1-38.common.i5', async () => {
    const s = await session(), name = unique('Moodle snapshot regression'); await watchAll('fail_before');
    const r = await noRequests(() => app(s, 'POST', '/app-api/connections', {
      name, method: 'manual', siteUrl: urls.moodle,
    }));
    expectStatus(r, 201);
    assert.equal(r.json.lms, 'moodle'); assert.equal(r.json.profile, 'standard');
    assert.equal(r.json.serviceUrl, urls.moodle);
    assert.equal(r.json.status, 'pending'); assert.equal(r.json.platform, null);
    assert.equal(r.json.name, name); assert.equal(r.json.siteUrl, urls.moodle); assert.equal(r.json.method, 'manual');
    assert.match(r.json.id, /^con_/); assert.ok(Number.isFinite(Date.parse(r.json.createdAt)));
    for (const field of ['lastLaunchAt', 'lastError', 'webServices', 'registrationUrl', 'registrationUrlExpiresAt']) {
      assert.equal(r.json[field], null, field);
    }
    assert.deepEqual(r.json.capabilities, { dynamicRegistration: true, operatorApproval: false,
      webServices: true, courseShell: true, addDeployment: false, canvasConfiguration: false });
    assert.equal(Object.keys(r.json).some((key) => /target_|snapshot/.test(key)), false);
  }));
