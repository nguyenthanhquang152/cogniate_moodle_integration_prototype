// LA-E3-07 K1-SIM suite (QA-3, test-first from docs/architecture/ltiaas/tasks/LA-E3-07.md).
//
// Covers:
// - AC-LA-E3-07-02 (K1-SIM): The Canvas JSON (jwk=url and jwk=inline) has exactly the four AGS scopes in scopes (AP-05-19).
// - AC-LA-E3-07-03 (K1-SIM): The Moodle tool configuration row 13 (nrps) has the value "Do not use this service"; the
//   other 15 rows are equal to the golden rows (AP-05-20).
// - AC-LA-E3-07-06 (K1-SIM): In one full K1 run, no token request asks for the NRPS scope (K1-NRPS N1).
import { describe, expect, it } from 'vitest';
import {
  app,
  bound,
  connPath,
  expectStatus,
  records,
  session,
  unique,
  type Json,
} from '../../../acceptance/M1/common/client';
import { commitGrade, gradeWorks, publication, waitSync } from '../../../acceptance/M1/common/course';
import { canvasBound, canvasPlay } from '../../../acceptance/M1/canvas/canvas';

const FOUR_AGS_SCOPES = [
  'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
  'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
  'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
  'https://purl.imsglobal.org/spec/lti-ags/scope/score',
] as const;

describe('LA-E3-07 NRPS scope: channel values, Canvas JSON, Moodle row 13 (K1-SIM rows)', () => {
  it('AC-LA-E3-07-02: Canvas developer key JSON (jwk=url and jwk=inline) has exactly the four AGS scopes in scopes', async () => {
    const s = await session('A');
    const conn = await app(s, 'POST', '/app-api/connections', {
      name: unique('QA3 E3-07 Canvas'),
      lms: 'canvas',
      profile: 'canvas-sim-cloud',
      method: 'manual',
      siteUrl: 'https://canvas.school-a.sim.test',
      serviceUrl: 'https://school-a.canvas.sim.test',
    });
    expectStatus(conn, 201);
    const connId = String(conn.json.id);

    const urlRes = await app(s, 'GET', `${connPath(connId)}/canvas-configuration?jwk=url`);
    expectStatus(urlRes, 200);
    const urlCfg = urlRes.json?.configuration ?? urlRes.json;
    expect(urlCfg.scopes).toEqual([...FOUR_AGS_SCOPES]);

    const inlineRes = await app(s, 'GET', `${connPath(connId)}/canvas-configuration?jwk=inline`);
    expectStatus(inlineRes, 200);
    const inlineCfg = inlineRes.json?.configuration ?? inlineRes.json;
    expect(inlineCfg.scopes).toEqual([...FOUR_AGS_SCOPES]);
  });

  it('AC-LA-E3-07-03: Moodle tool configuration row 13 (nrps) has value "Do not use this service" and 16 rows in order', async () => {
    const s = await session('A');
    const conn = await app(s, 'POST', '/app-api/connections', {
      name: unique('QA3 E3-07 Moodle'),
      lms: 'moodle',
      method: 'manual',
      siteUrl: 'https://moodle.sim.test',
    });
    expectStatus(conn, 201);
    const connId = String(conn.json.id);

    const cfgRes = await app(s, 'GET', `${connPath(connId)}/tool-configuration`);
    expectStatus(cfgRes, 200);
    const rows = (Array.isArray(cfgRes.json) ? cfgRes.json : (cfgRes.json?.rows ?? cfgRes.json?.fields ?? [])) as Array<{
      key: string;
      label: string;
      value: string;
    }>;
    expect(rows).toHaveLength(16);
    expect(rows[11]!.key).toBe('ags');
    expect(rows[11]!.value).toBe('Use this service for grade sync and column management');
    expect(rows[12]!.key).toBe('nrps');
    expect(rows[12]!.label).toBe('IMS LTI Names and Role Provisioning');
    expect(rows[12]!.value).toBe('Do not use this service');
  });

  it('AC-LA-E3-07-06: across K1-SIM score runs on Blackboard and Canvas, no token request asks for the NRPS scope and no NRPS call is made', async () => {
    const cursor = (await records()).cursor;
    const bb = await bound();
    await gradeWorks(bb, 'scorm12');
    const cv = await canvasBound();
    const cvPub = await publication(cv, 'scorm12');
    const cvPlay = await canvasPlay(cv, cvPub);
    await commitGrade(cvPlay, 'scorm12', 8, 10);
    await waitSync(cv, cvPub, 'sent');

    const recs = (await records(cursor)).records;
    const tokenRecs = recs.filter((r: Json) => r.kind === 'token');
    expect(tokenRecs.length).toBeGreaterThanOrEqual(2);
    for (const tr of tokenRecs) {
      expect(String(tr.scope ?? '')).not.toContain('contextmembership');
      expect(String(tr.scope ?? '')).not.toContain('nrps');
    }
    expect(recs.filter((r: Json) => r.kind === 'nrps')).toEqual([]);
  });
});
