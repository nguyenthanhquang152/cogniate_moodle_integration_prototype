import type { ChannelManifest, LoadedChannel } from '@cogniate/channel-kernel';
import { RegistryError, loadChannelFolders } from '@cogniate/channel-kernel';
import { describe, expect, it } from 'vitest';
import { CHANNEL_ROOT, buildProfileRegistry, profileDefinition } from './index.ts';

const baseline = await loadChannelFolders([CHANNEL_ROOT], 'lti');
const copy = () => structuredClone(baseline);
const profilesOf = (entries: LoadedChannel[], channel: string) =>
  entries.find((e) => (e.manifest as ChannelManifest).id === channel)!.ltiProfiles as Array<Record<string, unknown>>;
const TOKEN_STRING = { value: '{tokenEndpoint}', form: 'string' };
/** LA-ADR-05 D6 (LA-E3-09): the Canvas rule; the extension members are checked in canvas.test.ts. */
const CANVAS_DR = { issuerRule: 'profile', registrationToken: 'opaque-bearer' };

describe('E2 profile traits (LA-ADR-02 D2, AC-LA-E2-01-01)', () => {
  it('gives every baseline profile its D2 values', () => {
    expect(profileDefinition('standard')).toMatchObject({
      endpoints: 'admin', issuerKind: 'per-tenant', endpointOrigins: 'issuer', clientAssertionAud: TOKEN_STRING, assertionDeploymentId: false,
      dynamicRegistration: { issuerRule: 'path-prefix', configurationPath: '/mod/lti/openid-configuration.php', registrationToken: 'scope-jwt' },
    });
    for (const id of ['canvas-cloud-production', 'canvas-cloud-beta', 'canvas-cloud-test', 'canvas-sim-cloud']) {
      expect(profileDefinition(id), id).toMatchObject({
        endpoints: 'fixed', issuerKind: 'fixed', endpointOrigins: null, clientAssertionAud: TOKEN_STRING, assertionDeploymentId: false, dynamicRegistration: CANVAS_DR,
      });
    }
    expect(profileDefinition('canvas-self-hosted')).toMatchObject({
      endpoints: 'fixed', issuerKind: 'per-tenant', endpointOrigins: null, clientAssertionAud: TOKEN_STRING, assertionDeploymentId: false, dynamicRegistration: CANVAS_DR,
    });
    for (const id of ['blackboard', 'blackboard-sim']) {
      expect(profileDefinition(id), id).toMatchObject({
        endpoints: 'fixed', issuerKind: 'fixed', endpointOrigins: null, clientAssertionAud: { value: '{tokenEndpoint}', form: 'array' },
        assertionDeploymentId: false, dynamicRegistration: null,
      });
    }
  });

  it('supplies the defaults for a profile file without the traits', () => {
    const entries = copy();
    const [standard] = profilesOf(entries, 'moodle');
    const [cloud] = profilesOf(entries, 'canvas');
    for (const trait of ['issuerKind', 'endpointOrigins', 'clientAssertionAud', 'assertionDeploymentId', 'dynamicRegistration']) {
      delete standard![trait];
      delete cloud![trait];
    }
    const registry = buildProfileRegistry(entries);
    const byId = (id: string) => registry.listProfiles(true).find((p) => p.id === id)!;
    expect(byId('standard')).toMatchObject({ issuerKind: 'per-tenant', endpointOrigins: 'issuer', clientAssertionAud: TOKEN_STRING, assertionDeploymentId: false, dynamicRegistration: null });
    expect(byId('canvas-cloud-production')).toMatchObject({ issuerKind: 'fixed', endpointOrigins: null, clientAssertionAud: TOKEN_STRING, assertionDeploymentId: false, dynamicRegistration: null });
    expect(Object.isFrozen(byId('standard').clientAssertionAud)).toBe(true);
  });

  it('BD-A1-75: the aud form comes only from clientAssertionAud; without it, the token URL as a string', () => {
    const entries = copy();
    const [blackboard] = profilesOf(entries, 'blackboard');
    delete blackboard!.clientAssertionAud;
    const registry = buildProfileRegistry(entries);
    expect(registry.listProfiles(true).find((p) => p.id === 'blackboard')!.clientAssertionAud).toEqual(TOKEN_STRING);
  });
});

describe('load check 7 for the E2 traits (AC-LA-E2-01-02)', () => {
  const refusal = (edit: (entries: LoadedChannel[]) => void) => {
    const entries = copy();
    edit(entries);
    try {
      buildProfileRegistry(entries);
    } catch (err) {
      return err;
    }
    return null;
  };

  it.each([
    ['a fixed issuer URL with per-tenant', 'canvas', 0, { issuerKind: 'per-tenant' }, 'issuerKind'],
    ['a {siteUrl} issuer template with fixed', 'canvas', 3, { issuerKind: 'fixed' }, 'issuerKind'],
    ['an admin issuer with fixed', 'moodle', 0, { issuerKind: 'fixed' }, 'issuerKind'],
    ['fixed endpoints with an endpoint origin rule', 'blackboard', 0, { endpointOrigins: 'issuer' }, 'endpointOrigins'],
    ['admin endpoints without an endpoint origin rule', 'moodle', 0, { endpointOrigins: null }, 'endpointOrigins'],
    ['a configuration path without path-prefix', 'moodle', 0, { dynamicRegistration: { issuerRule: 'origin', configurationPath: '/x', registrationToken: 'opaque-bearer' } }, 'configurationPath'],
    ['an unknown aud value', 'moodle', 0, { clientAssertionAud: { value: '{issuer}', form: 'string' } }, 'clientAssertionAud'],
    ['a stored audience on fixed endpoints (A-LA-E2-01-04)', 'canvas', 0, { clientAssertionAud: { value: '{platformValue}', form: 'string' } }, 'clientAssertionAud.value'],
    ['the removed flag clientAssertionAudArray (BD-A1-75)', 'moodle', 0, { flags: { deepLinkingResponseSub: false, clientAssertionAudArray: false, serviceOriginCheck: false } }, 'flags'],
    // LA-ADR-05 D6 (LA-E3-09): the profile rule only with fixed endpoints, and fixed endpoints only with it.
    ['the profile rule with admin endpoints', 'moodle', 0, { dynamicRegistration: { issuerRule: 'profile', registrationToken: 'opaque-bearer' } }, 'dynamicRegistration.issuerRule'],
    ['an admin issuer rule with fixed endpoints', 'canvas', 0, { dynamicRegistration: { issuerRule: 'origin', registrationToken: 'opaque-bearer' } }, 'dynamicRegistration.issuerRule'],
    ...([
      ['a member name that is not a URL', { tool_id: 'x' }], ['an http member name', { 'http://lms.example/lti/tool_id': 'x' }],
      ['a member name with a query', { 'https://lms.example/lti?x=1': 'x' }], ['an empty member value', { 'https://lms.example/lti/tool_id': '' }],
      ['nine members', Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`https://lms.example/lti/m${i}`, 'x']))],
    ] satisfies Array<[string, Record<string, string>]>).map(([what, members]): [string, string, number, Record<string, unknown>, string] => [`${what} in toolConfigurationExtensions`, 'canvas', 0,
      { dynamicRegistration: { issuerRule: 'profile', registrationToken: 'opaque-bearer', toolConfigurationExtensions: members } }, 'toolConfigurationExtensions']),
  ] as Array<[string, string, number, Record<string, unknown>, string]>)('stops the start for %s', (_, channel, index, change, field) => {
    const err = refusal((entries) => Object.assign(profilesOf(entries, channel)[index]!, change));
    expect(err).toBeInstanceOf(RegistryError);
    expect(err).toMatchObject({ check: 7, reason: 'profile_schema_invalid' });
    expect((err as RegistryError).detail).toContain(field);
  });

  it('accepts a per-tenant issuer template and an admin profile with any-https', () => {
    expect(refusal((entries) => {
      Object.assign(profilesOf(entries, 'canvas')[3]!, { issuerKind: 'per-tenant' });
      Object.assign(profilesOf(entries, 'moodle')[0]!, { endpointOrigins: 'any-https' });
    })).toBeNull();
  });

  it('LA-E3-09: accepts eight extension members and freezes them', () => {
    const entries = copy();
    const members = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`https://lms.example/lti/m${i}`, 'x']));
    Object.assign(profilesOf(entries, 'canvas')[0]!, { dynamicRegistration: { issuerRule: 'profile', registrationToken: 'opaque-bearer', toolConfigurationExtensions: members } });
    const profile = buildProfileRegistry(entries).listProfiles(true).find((p) => p.id === 'canvas-cloud-production')!;
    expect(profile.dynamicRegistration!.toolConfigurationExtensions).toEqual(members);
    expect(Object.isFrozen(profile.dynamicRegistration!.toolConfigurationExtensions)).toBe(true);
  });
});
