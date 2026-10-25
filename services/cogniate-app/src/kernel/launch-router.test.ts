import { buildChannelRegistry } from '@cogniate/channel-kernel';
import type { ChannelManifest } from '@cogniate/channel-kernel';
import { createLogger } from '@cogniate/shared';
import { afterEach, expect, it } from 'vitest';
import type { LtiIdToken } from '../clients/lti-client.ts';
import { createConnection, markRegistered } from '../domain/connections.ts';
import { openDb } from '../domain/db.ts';
import type { Db } from '../domain/db.ts';
import { TEST_CHANNELS } from '../testkit.ts';
import { checkLaunchConnection } from './launch-router.ts';

const custom = (id: string, guarded: boolean): ChannelManifest => ({
  ...TEST_CHANNELS.channel('moodle')!, id,
  registration: [{ method: 'manual', authority: 'operatorGrant', profiles: [`${id}-profile`], defaultProfile: `${id}-profile` }],
  lti: { guardedFamilies: guarded ? [{ family: 'zz-family', level: 'registration' }] : [], toolConfiguration: 'none' },
});
const channels = buildChannelRegistry([...TEST_CHANNELS.channels(), custom('zz-test', false), custom('zz-guard', true)]
  .map((manifest) => ({ folder: `/test/${manifest.id}`, manifest })), { simulations: true });
let db: Db;
afterEach(() => { db?.close(); });

it.each([
  ['zz-test', 'canvas-cloud-production', undefined, false, false],
  ['moodle', 'standard', 'CaNvAs', false, false],
  ['moodle', 'standard', 'ZZ-FAMILY', false, false],
  ['zz-test', 'zz-test-profile', 'ZZ-FAMILY', true, true],
  ['zz-guard', 'zz-guard-profile', 'ZZ-FAMILY', true, false],
  ['moodle', 'standard', 'unclaimed', true, false],
  ['moodle', 'standard', undefined, true, false],
] as const)('AC-06: channel %s, profile %s, family %s: allowed=%s info=%s', (channel, profile, family, allowed, info) => {
  db = openDb(':memory:');
  db.exec("INSERT INTO library VALUES ('lib', 'Library', 0)");
  const c = createConnection(db, 'lib', { name: 'School', siteUrl: 'https://school.test', channel: 'moodle', method: 'manual' }, null, 1, channels, () => 'exclusive');
  // Stored self authority makes routing independent of the channel used for this guard table.
  db.prepare('UPDATE connection SET channel = ?, lti_profile = ? WHERE id = ?').run(channel, profile, c.id);
  markRegistered(db, c.id, { id: 'platform', issuer: c.siteUrl, clientId: 'client', deploymentIds: ['d'], productFamilyCode: null }, 2);
  const token: LtiIdToken = {
    user: { id: 'u', roles: [] },
    platform: { id: 'platform', url: c.siteUrl, deploymentId: 'd', siteUrl: c.siteUrl, serviceUrl: c.siteUrl, profile, ...(family ? { productFamilyCode: family } : {}) },
    launch: { type: 'LtiResourceLinkRequest', target: 'https://lti.test/lti/launch/cogniate' },
  };
  const lines: Array<Record<string, unknown>> = [];
  const logger = createLogger({ service: 'test', write: (line) => lines.push(JSON.parse(line) as Record<string, unknown>) });
  const result = checkLaunchConnection(db, token, channels, logger, 'trace');
  expect(result.ok).toBe(allowed);
  if (!allowed) expect(result).toMatchObject({ code: 'UNKNOWN_PLATFORM', reason: 'lms_mismatch', fields: { connection_lms: channel } });
  expect(lines.filter((line) => line.event === 'family_guard_mismatch')).toEqual(info ? [expect.objectContaining({ level: 'info', trace_id: 'trace', platform_id: 'platform', family: 'zz-family' })] : []);
});
