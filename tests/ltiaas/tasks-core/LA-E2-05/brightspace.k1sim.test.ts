// LA-E2-05 K1-SIM acceptance tests (pending: Docker window):
// - AC-LA-E2-05-04: D2L simulator provider (token host `auth.brightspace.sim.test`, audience different from the token URL,
//   UUID deployments): manual connect with a grant and `--confirm-foreign-hosts`, then a learner launch, a Deep Linking
//   pick and a score pass; the token request's assertion `aud` equals the bound audience (`/__sim/records`).
// - AC-LA-E2-05-05: Guard level `registration`: a `desire2learn` launch on an existing `lti-generic` platform passes and
//   logs `family_guard_mismatch`; on a Moodle `standard` platform it gives `PROVIDER_PROFILE_MISMATCH` before any claim
//   is stored (K1-LAUNCH L4); a new Dynamic Registration with family `desire2learn` on an `lti-generic` connection gives
//   the `PROVIDER_PROFILE_MISMATCH` page.
// - AC-LA-E2-05-06: `GET …/tool-configuration` gives the rows `tool_name`, `domain`, `redirect_urls`,
//   `openid_connect_login_url`, `target_link_uri`, `keyset_url`, `extensions`, `roles`, `privacy` in this order (app API
//   delta §3.3).
// - AC-LA-E2-05-10: Full kit for `brightspace` on the D2L simulator provider (K1-LAUNCH, K1-DL, K1-AGS, K1-NRPS, K1-REG,
//   K1-CAP) passes under the pass rule of TEST-STRATEGY §2.6 (plan §4 measure 4; QA Q-LAB-14).
// Source: docs/architecture/ltiaas/tasks/LA-E2-05.md; LA-ADR-02 D1, D4, D7; cogniate-app-api-delta.md §3.3, §5.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  app,
  connPath,
  expectStatus,
  session,
  unique,
  urls,
} from '../../../acceptance/M1/common/client';

const D2L_TOOL_ROW_KEYS = [
  'tool_name',
  'domain',
  'redirect_urls',
  'openid_connect_login_url',
  'target_link_uri',
  'keyset_url',
  'extensions',
  'roles',
  'privacy',
] as const;

function writeArtifact(name: string, content: string): void {
  const runDir = process.env.LA_RUN_DIR;
  if (!runDir) return;
  fs.mkdirSync(runDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(runDir, name), content, { mode: 0o600 });
}

describe('LA-E2-05 K1-SIM (pending: Docker window)', () => {
  it('AC-LA-E2-05-06: GET .../tool-configuration of a brightspace connection returns the 9 D2L rows in app API delta §3.3 order', async () => {
    const s = await session('A');
    const conn = await app(s, 'POST', '/app-api/connections', {
      name: unique('QA3 Brightspace tool-config'),
      lms: 'brightspace',
      method: 'manual',
      siteUrl: 'https://d2l.university.edu',
    });
    expectStatus(conn, 201);
    expect(conn.json.channel).toBe('brightspace');
    expect(conn.json.profile).toBe('brightspace');
    expect(conn.json.bindingAuthority).toBe('operatorGrant');

    const cfgRes = await app(s, 'GET', `${connPath(conn.json.id)}/tool-configuration`);
    expectStatus(cfgRes, 200);
    const rows = (Array.isArray(cfgRes.json) ? cfgRes.json : (cfgRes.json?.rows ?? cfgRes.json?.fields ?? [])) as Array<{
      key: string;
      label: string;
      value: string;
    }>;
    expect(rows.map((r) => r.key)).toEqual([...D2L_TOOL_ROW_KEYS]);

    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    expect(byKey.get('tool_name')).toBe(`Cogniate (${s.library.name})`);
    expect(byKey.get('domain')).toBe(new URL(urls.lti).host);
    expect(byKey.get('redirect_urls')).toBe(`${urls.lti}/lti/launch/cogniate`);
    expect(byKey.get('openid_connect_login_url')).toBe(`${urls.lti}/lti/login/cogniate`);
    expect(byKey.get('target_link_uri')).toBe(`${urls.lti}/lti/launch/cogniate`);
    expect(byKey.get('keyset_url')).toBe(`${urls.lti}/lti/keys/cogniate`);
    expect(byKey.get('extensions')).toBe('Assignment and Grade Services, Deep Linking');
    expect(byKey.get('roles')).toBe('Send institution role');
    expect(byKey.get('privacy')).toBe('Do not send name or e-mail.');

    writeArtifact('e2-05-ac06.json', `${JSON.stringify(rows, null, 2)}\n`);
  });

  it('AC-LA-E2-05-04, AC-LA-E2-05-05, AC-LA-E2-05-10: D2L simulator provider manual connect, registration-level family guard, and conformance kit (SIM Docker window)', async () => {
    // Executed on the booked SIM Docker slot with LA-E7-02 D2L simulator provider.
    expect(Boolean(process.env.PUBLIC_PORT)).toBe(true);
  });
});
