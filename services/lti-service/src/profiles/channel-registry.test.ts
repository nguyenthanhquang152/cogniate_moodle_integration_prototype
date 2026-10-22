import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ChannelManifest, LoadedChannel } from '@cogniate/channel-kernel';
import { loadChannelFolders } from '@cogniate/channel-kernel';
import { describe, expect, it } from 'vitest';
import { CLAIM, check14ProductFamily } from '../lti/checks.ts';
import { createPlatformKeys } from '../lti/jwks.ts';
import { handleLaunch } from '../lti/launch.ts';
import { createPlatform } from '../store/platforms.ts';
import { CLIENT_ID, ISSUER, URLS, capturingLogger, doLogin, harness, moodleClaims, sign } from '../testkit.ts';
import { CHANNEL_ROOT, buildProfileRegistry, findProfile, listProfiles, lmsNameOf, lmsNameOfFamily, loadProfileRegistry, profileEndpoints } from './index.ts';

const baseline = await loadChannelFolders([CHANNEL_ROOT], 'lti');
const baselineCopy = () => structuredClone(baseline);
const manifestOf = (entry: LoadedChannel) => entry.manifest as ChannelManifest;
const standardEntry = (entries: LoadedChannel[]) => entries.find((entry) => manifestOf(entry).registration.some((method) => method.profiles.includes('standard')))!;
const firstProfile = (entry: LoadedChannel) => entry.ltiProfiles![0] as Record<string, unknown>;

function extraChannel(id: string): LoadedChannel {
  const entry = standardEntry(baselineCopy());
  const profile = { ...firstProfile(entry), id: `${id}-platform` };
  delete (profile as Record<string, unknown>).wireLms;
  return {
    folder: `/unit/${id}`,
    manifest: {
      ...manifestOf(entry), id, names: { text: id.toUpperCase(), label: id.toUpperCase() },
      registration: [{ method: 'manual', authority: 'operatorGrant', profiles: [profile.id], defaultProfile: profile.id }],
      lti: { guardedFamilies: [{ family: id, level: 'registration' }], toolConfiguration: 'none' },
    },
    ltiProfiles: [profile],
  };
}

describe('profile load checks (AC-05 and load check 5)', () => {
  const failures: Array<[string, number, string, (entries: LoadedChannel[]) => void]> = [
    ['unknown trait', 7, 'profile_schema_invalid', (entries) => { firstProfile(standardEntry(entries)).unknownTrait = true; }],
    ['unknown flag', 7, 'profile_schema_invalid', (entries) => { (firstProfile(standardEntry(entries)).flags as Record<string, unknown>).unknownFlag = true; }],
    ['source-supplied owner', 7, 'profile_schema_invalid', (entries) => { firstProfile(standardEntry(entries)).channel = 'zz'; }],
    ['missing baseline wire value', 7, 'profile_wire_lms_invalid', (entries) => { delete firstProfile(standardEntry(entries)).wireLms; }],
    ['changed baseline wire value', 7, 'profile_wire_lms_invalid', (entries) => { firstProfile(standardEntry(entries)).wireLms = 'changed'; }],
    ['wire value on a new profile', 7, 'profile_wire_lms_invalid', (entries) => {
      const extra = extraChannel('zz'); firstProfile(extra).wireLms = null; entries.push(extra);
    }],
    ['duplicate id in two folders', 2, 'profile_in_two_channels', (entries) => {
      const extra = extraChannel('zz'); extra.ltiProfiles!.push(firstProfile(standardEntry(entries))); entries.push(extra);
    }],
    ['missing registration profile', 5, 'profile_not_in_lti_profiles', (entries) => { standardEntry(entries).ltiProfiles = []; }],
  ];

  it.each(failures)('stops loading and logs one error: %s', async (_name, check, reason, change) => {
    const entries = baselineCopy();
    change(entries);
    const root = mkdtempSync(join(tmpdir(), 'lti-profile-load-'));
    const { logger, lines } = capturingLogger();
    try {
      for (const entry of entries) {
        const folder = join(root, manifestOf(entry).id);
        mkdirSync(folder);
        writeFileSync(join(folder, 'manifest.ts'), `export default ${JSON.stringify(entry.manifest)};\n`);
        writeFileSync(join(folder, 'lti-profiles.ts'), `export default ${JSON.stringify(entry.ltiProfiles)};\n`);
      }
      await expect(loadProfileRegistry([root], logger)).rejects.toMatchObject({ name: 'RegistryError', check, reason });
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatchObject({ level: 'error', event: 'channel_registry_invalid', check, reason });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('loads a new profile without a wire override and takes its owner from the folder', () => {
    const registry = buildProfileRegistry([...baselineCopy(), extraChannel('zz')]);
    expect(findProfile('zz-platform', { registry, simulation: false })).toMatchObject({ channel: 'zz', lms: 'zz' });
  });
});

describe('manifest family guards (AC-03 and AC-04)', () => {
  it('preserves the refused set for every baseline profile, including case folding', () => {
    const profiles = { simulation: true };
    for (const profile of listProfiles(profiles)) {
      for (const family of ['canvas', 'CaNvAs', 'blackboardlearn', 'BlackboardLearn', 'moodle', 'unknown', undefined]) {
        const claims = family === undefined ? {} : { [CLAIM.toolPlatform]: { product_family_code: family } };
        const guardedLms = family?.toLowerCase() === 'canvas' ? 'canvas' : family?.toLowerCase() === 'blackboardlearn' ? 'blackboard' : null;
        const check = () => check14ProductFamily(claims, profile, profiles);
        if (guardedLms !== null && profile.lms !== guardedLms) {
          expect(check).toThrow(expect.objectContaining({ check: '14', code: 'PROVIDER_PROFILE_MISMATCH', detail: `family=${family!.toLowerCase()}` }));
        } else {
          expect(check()).toBeNull();
        }
      }
    }
  });

  it.each([false, true])('checks a registration guard before storage (other profile: %s)', async (otherProfile) => {
    const registry = buildProfileRegistry([...baselineCopy(), extraChannel('zz')]);
    const h = await harness({ simulationProfiles: true });
    const { logger, lines } = capturingLogger();
    try {
      let platform = h.platform;
      if (otherProfile) {
        const profile = findProfile('canvas-sim-cloud', { simulation: true })!;
        const values = profileEndpoints(profile, { siteUrl: 'https://school.example.test', clientId: CLIENT_ID });
        platform = createPlatform(h.db, 'cogniate', {
          issuer: values.issuer, authEndpoint: values.authenticationEndpoint, tokenEndpoint: values.accesstokenEndpoint, jwksUrl: values.jwksUrl,
          clientId: CLIENT_ID, name: 'Unit platform', active: true, deploymentIds: ['1'], profile: profile.id, siteUrl: 'https://school.example.test',
        });
      }
      const login = await doLogin(h, { iss: otherProfile ? platform.issuer : ISSUER });
      const claims = moodleClaims({ iss: platform.issuer, nonce: login.nonce, [CLAIM.toolPlatform]: { product_family_code: 'ZZ' } }, Math.floor(h.clock.now / 1000));
      const result = await handleLaunch({
        db: h.db, urls: URLS, keys: createPlatformKeys(h.outbound), ltikTtlSeconds: 86400, now: () => h.clock.now,
        profiles: { simulation: true, registry }, logger,
      }, 'cogniate', { state: login.state, id_token: await sign(h.key, claims) }, login.cookie, 'guard-unit');
      const stored = h.db.prepare('SELECT claims FROM launch').all();
      if (otherProfile) {
        expect(result.ok).toBe(true);
        expect(stored).toHaveLength(1);
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatchObject({ level: 'info', event: 'family_guard_mismatch', platform_id: platform.id, family: 'zz' });
      } else {
        expect(result).toMatchObject({ ok: false, code: 'PROVIDER_PROFILE_MISMATCH', check: '14', detail: 'family=zz', lms: 'ZZ' });
        expect(stored).toHaveLength(0);
        expect(lines).toHaveLength(0);
      }
    } finally {
      await h.app.close();
      h.db.close();
    }
  });

  it('passes a registration guard on its owning channel', () => {
    const registry = buildProfileRegistry([...baselineCopy(), extraChannel('zz')]);
    const opts = { registry, simulation: false };
    expect(check14ProductFamily({ [CLAIM.toolPlatform]: { product_family_code: 'zz' } }, findProfile('zz-platform', opts)!, opts)).toBeNull();
  });
});

it('preserves text names for every baseline profile and family (AC-06)', () => {
  const names = { standard: 'Moodle', 'canvas-cloud-production': 'Canvas', 'canvas-cloud-beta': 'Canvas', 'canvas-cloud-test': 'Canvas',
    'canvas-self-hosted': 'Canvas', 'canvas-sim-cloud': 'Canvas', blackboard: 'Blackboard', 'blackboard-sim': 'Blackboard' };
  for (const [id, name] of Object.entries(names)) expect(lmsNameOf(findProfile(id, { simulation: true }))).toBe(name);
  expect(lmsNameOf(null)).toBe('Moodle');
  for (const family of ['canvas', 'Canvas']) expect(lmsNameOfFamily(family)).toBe('Canvas');
  for (const family of ['blackboardlearn', 'BlackboardLearn']) expect(lmsNameOfFamily(family)).toBe('Blackboard');
  for (const family of ['moodle', 'unknown', '']) expect(lmsNameOfFamily(family)).toBeNull();
});
