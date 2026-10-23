// LA-E1-08 K1-SIM capability guards acceptance test (AC-LA-E1-08-02):
// Guards with M1 values:
// 1. Blackboard PUT .../web-services -> 409 CAPABILITY_NOT_SUPPORTED (details.capability = "webServices")
// 2. Blackboard GET .../canvas-configuration -> 409 CAPABILITY_NOT_SUPPORTED (details.capability = "canvasConfiguration")
// 3. Moodle POST .../deployments -> 409 CAPABILITY_NOT_SUPPORTED (details.capability = "addDeployment")
// 4. Canvas POST /app-api/publications with createMoodleCourse -> 409 CAPABILITY_NOT_SUPPORTED (details.capability = "courseShell")
// Each verified with no simulator service calls (network oracle).
import { describe, expect, it } from 'vitest';
import {
  app,
  bound,
  connPath,
  expectStatus,
  noServiceCalls,
  records,
  session,
  unique,
} from '../../../acceptance/M1/common/client';
import { canvasBound } from '../../../acceptance/M1/canvas/canvas';
import { fixtureZip } from '../../../acceptance/M1/common/course';
import { createCourse, uploadVersion } from '../../../acceptance/lib/app';

describe('LA-E1-08 K1-SIM capability guards (AC-LA-E1-08-02)', () => {
  it('AC-LA-E1-08-02: Blackboard web-services and canvas-configuration, Moodle deployments, and Canvas createMoodleCourse return 409 CAPABILITY_NOT_SUPPORTED with details.capability and zero simulator calls', async () => {
    const bb = await bound();
    const cv = await canvasBound();
    const s = await session('A');

    // 1. Blackboard PUT .../web-services -> 409 CAPABILITY_NOT_SUPPORTED (webServices)
    const cursor1 = (await records()).cursor;
    const wsRes = await app(bb.s, 'PUT', `${connPath(bb.connection.id)}/web-services`, {
      token: 'bb-ws-token-12345',
    });
    expectStatus(wsRes, 409, 'CAPABILITY_NOT_SUPPORTED');
    expect(wsRes.json?.details?.capability).toBe('webServices');
    await noServiceCalls(cursor1);

    // 2. Blackboard GET .../canvas-configuration -> 409 CAPABILITY_NOT_SUPPORTED (canvasConfiguration)
    const cursor2 = (await records()).cursor;
    const cvCfgRes = await app(bb.s, 'GET', `${connPath(bb.connection.id)}/canvas-configuration?jwk=url`);
    expectStatus(cvCfgRes, 409, 'CAPABILITY_NOT_SUPPORTED');
    expect(cvCfgRes.json?.details?.capability).toBe('canvasConfiguration');
    await noServiceCalls(cursor2);

    // 3. Moodle POST .../deployments -> 409 CAPABILITY_NOT_SUPPORTED (addDeployment)
    const mdCreate = await app(s, 'POST', '/app-api/connections', {
      name: unique('QA3 E1-08 Moodle Cap Guard'),
      lms: 'moodle',
      method: 'dynamic',
      siteUrl: 'https://moodle.sim.test',
    });
    expectStatus(mdCreate, 201);
    const cursor3 = (await records()).cursor;
    const mdDepRes = await app(s, 'POST', `${connPath(mdCreate.json.id)}/deployments`, {
      deploymentId: 'dep-moodle-guard',
    });
    expectStatus(mdDepRes, 409, 'CAPABILITY_NOT_SUPPORTED');
    expect(mdDepRes.json?.details?.capability).toBe('addDeployment');
    await noServiceCalls(cursor3);

    // 4. Canvas POST /app-api/publications with createMoodleCourse -> 409 CAPABILITY_NOT_SUPPORTED (courseShell)
    const course = await createCourse(cv.s, unique('QA3 E1-08 Course'));
    const upload = await uploadVersion(cv.s, course.id, fixtureZip('scorm12'));
    expectStatus(upload, 201);
    const cursor4 = (await records()).cursor;
    const pubRes = await app(cv.s, 'POST', '/app-api/publications', {
      connectionId: cv.connection.id,
      courseId: course.id,
      createMoodleCourse: {
        categoryId: 1,
        fullname: 'Canvas Shell Guard',
        shortname: unique('csg'),
      },
    });
    expectStatus(pubRes, 409, 'CAPABILITY_NOT_SUPPORTED');
    expect(pubRes.json?.details?.capability).toBe('courseShell');
    await noServiceCalls(cursor4);
  });
});
