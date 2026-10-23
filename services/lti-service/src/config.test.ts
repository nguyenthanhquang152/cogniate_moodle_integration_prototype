import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigRefusedError } from '@cogniate/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { hostPort, isLoopbackHost, loadConfig } from './config.ts';
import { readStartupKeys } from './keys/key-config.ts';

const ENV = {
  LTI_MASTER_KEY: '0'.repeat(64),
  PUBLIC_MOODLE_URL: 'https://moodle.test', PUBLIC_LTI_URL: 'https://lti.cogniate.test',
  PUBLIC_APP_URL: 'https://app.cogniate.test', PUBLIC_CONTENT_URL: 'https://content.cogniate-content.test',
};

describe('operator listener settings (LA-ADR-06 D3)', () => {
  it('binds 127.0.0.1:4110 by default; OPERATOR_HOST changes the host (acceptance compose: 0.0.0.0)', () => {
    expect(loadConfig(ENV)).toMatchObject({ operatorHost: '127.0.0.1', operatorPort: 4110 });
    expect(loadConfig({ ...ENV, OPERATOR_HOST: '' }).operatorHost).toBe('127.0.0.1');
    expect(loadConfig({ ...ENV, OPERATOR_HOST: '0.0.0.0' }).operatorHost).toBe('0.0.0.0');
  });

  it('formats operator_bind as host:port, with brackets for IPv6', () => {
    expect(hostPort('127.0.0.1', 4110)).toBe('127.0.0.1:4110');
    expect(hostPort('::1', 4110)).toBe('[::1]:4110');
  });
});

describe('production profile refusals (LA-E5-21, LA-ADR-06 D12)', () => {
  const dirs: string[] = [];
  afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
  /** A safe production environment: the master key comes from a file, a trusted proxy is set, the operator bind is loopback. */
  function production(): Record<string, string | undefined> {
    const dir = mkdtempSync(join(tmpdir(), 'lti-production-')); dirs.push(dir);
    const file = join(dir, 'master-key');
    writeFileSync(file, `${'ab'.repeat(32)}\n`, { mode: 0o600 });
    return { ...ENV, LTI_MASTER_KEY: undefined, STACK_PROFILE: 'production', LTI_MASTER_KEY_FILE: file, TRUSTED_PROXY_CIDRS: '10.0.0.0/8' };
  }
  const reason = (env: Record<string, string | undefined>): string | null => {
    try { loadConfig(env); return null; } catch (err) { if (err instanceof ConfigRefusedError) return err.reason; throw err; }
  };

  it('AC-LA-E5-21-04: the key from LTI_MASTER_KEY_FILE starts; the same key in LTI_MASTER_KEY is refused', () => {
    const env = { ...production(), LTI_KEYRING_FILE: join(dirs[0]!, 'no-keyring.json') };
    expect(loadConfig(env)).toMatchObject({ profile: 'production', operatorHost: '127.0.0.1' });
    expect(readStartupKeys(env).handle).toEqual(Buffer.from('ab'.repeat(32), 'hex'));
    expect(reason({ ...env, LTI_MASTER_KEY: 'ab'.repeat(32) })).toBe('master_key_in_env');
  });

  it.each([
    ['AC-LA-E5-21-02', { LTI_PROVIDER_SIMULATION: 'on' }, 'simulation_on'],
    ['AC-LA-E5-21-03', { OUTBOUND_PRIVATE_HOST_ALLOWLIST: 'moodle.test' }, 'private_host_allowlist'],
    ['AC-LA-E5-21-05', { TRUSTED_PROXY_CIDRS: ' ' }, 'no_trusted_proxy'],
    ['AC-LA-E5-21-06', { OPERATOR_HOST: '0.0.0.0' }, 'operator_bind_not_loopback'],
    ['AC-LA-E5-21-01 (unit part)', { LTIK_TTL_SECONDS: '20' }, 'test_knob_active'],
  ])('%s: production with %j is refused as %s', (_id, change, expected) => {
    expect(reason({ ...production(), ...change })).toBe(expected);
  });

  it('refuses with the first rule in the D12 order, and the other profiles keep today\'s values', () => {
    const unsafe = { LTIK_TTL_SECONDS: '20', LTI_PROVIDER_SIMULATION: 'on', OUTBOUND_PRIVATE_HOST_ALLOWLIST: 'moodle.test', LTI_MASTER_KEY: '0'.repeat(64),
      TRUSTED_PROXY_CIDRS: '', OPERATOR_HOST: '0.0.0.0' };
    const env = { ...production(), ...unsafe };
    expect(reason(env)).toBe('test_knob_active');
    expect(reason({ ...env, LTIK_TTL_SECONDS: undefined })).toBe('simulation_on');
    expect(reason({ ...env, LTIK_TTL_SECONDS: undefined, LTI_PROVIDER_SIMULATION: undefined })).toBe('private_host_allowlist');
    for (const STACK_PROFILE of [undefined, 'default', 'acceptance']) {
      expect(loadConfig({ ...ENV, ...unsafe, STACK_PROFILE })).toMatchObject({ operatorHost: '0.0.0.0', outboundAllowlist: ['moodle.test'] });
    }
  });

  // BD-A2-79: one row per refusal with the exact A2 text; the message never holds a setting value.
  it.each([
    ['test_knob_active', { LTIK_TTL_SECONDS: '20' }, 'Production does not allow test knobs. Remove every test knob setting, then start the service again.'],
    ['simulation_on', { LTI_PROVIDER_SIMULATION: 'on' }, 'Production does not allow simulation profiles. Remove LTI_PROVIDER_SIMULATION or set it to off, then start the service again.'],
    ['private_host_allowlist', { OUTBOUND_PRIVATE_HOST_ALLOWLIST: 'private-host.test' }, 'Production does not allow private outbound hosts. Remove OUTBOUND_PRIVATE_HOST_ALLOWLIST, then start the service again.'],
    ['master_key_in_env', { LTI_MASTER_KEY: 'ab'.repeat(32) }, 'Production does not allow the master key as an environment value. Remove LTI_MASTER_KEY and use LTI_MASTER_KEY_FILE or the key-ring file.'],
    ['no_trusted_proxy', { TRUSTED_PROXY_CIDRS: '' }, 'Production needs TRUSTED_PROXY_CIDRS. Set it to the address or host name of the proxy, then start the service again.'],
    ['operator_bind_not_loopback', { OPERATOR_HOST: '10.9.8.7' }, 'Production allows the operator listener on loopback only. Set OPERATOR_HOST to 127.0.0.1 or ::1, then start the service again.'],
  ])('gives %s with its fixed message', (expected, change, message) => {
    let refused: unknown;
    try { loadConfig({ ...production(), ...change }); } catch (err) { refused = err; }
    expect(refused).toMatchObject({ reason: expected, message, setting: undefined });
    for (const value of Object.values(change)) if (value.length > 3) expect(message).not.toContain(value);
  });

  it('accepts only loopback operator binds', () => {
    for (const host of ['127.0.0.1', '127.0.0.53', '::1', '[::1]', 'localhost', 'LOCALHOST']) expect(isLoopbackHost(host), host).toBe(true);
    for (const host of ['0.0.0.0', '::', '10.0.0.1', '128.0.0.1', 'lti-service', '127.0.0.1.example.test']) expect(isLoopbackHost(host), host).toBe(false);
  });
});
