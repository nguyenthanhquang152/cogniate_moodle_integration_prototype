import type { ChannelManifest, LoadedChannel } from '@cogniate/channel-kernel';
import { RegistryError, loadChannelFolders } from '@cogniate/channel-kernel';
import { describe, expect, it } from 'vitest';
import { CHANNEL_ROOT, buildProfileRegistry, profileDefinition } from './index.ts';

const baseline = await loadChannelFolders([CHANNEL_ROOT], 'lti');
const copy = () => structuredClone(baseline);
const profilesOf = (entries: LoadedChannel[], channel: string) =>
  entries.find((e) => (e.manifest as ChannelManifest).id === channel)!.ltiProfiles as Array<Record<string, unknown>>;
const TOKEN_STRING = { value: '{tokenEndpoint}', form: 'string' };

describe('E2 profile traits (LA-ADR-02 D2, AC-LA-E2-01-01)', () => {
  it('gives every baseline profile its D2 values', () => {
    expect(profileDefinition('standard')).toMatchObject({
      endpoints: 'admin', issuerKind: 'per-tenant', endpointOrigins: 'issuer', clientAssertionAud: TOKEN_STRING, assertionDeploymentId: false,
      dynamicRegistration: { issuerRule: 'path-prefix', configurationPath: '/mod/lti/openid-configuration.php', registrationToken: 'moodle-scope-jwt' },
    });
    for (const id of ['canvas-cloud-production', 'canvas-cloud-beta', 'canvas-cloud-test', 'canvas-sim-cloud']) {
      expect(profileDefinition(id), id).toMatchObject({
        endpoints: 'fixed', issuerKind: 'fixed', endpointOrigins: null, clientAssertionAud: TOKEN_STRING, assertionDeploymentId: false, dynamicRegistration: null,
      });
    }
    expect(profileDefinition('canvas-self-hosted')).toMatchObject({
      endpoints: 'fixed', issuerKind: 'per-tenant', endpointOrigins: null, clientAssertionAud: TOKEN_STRING, assertionDeploymentId: false, dynamicRegistration: null,
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
  ])('stops the start for %s', (_, channel, index, change, field) => {
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
});
