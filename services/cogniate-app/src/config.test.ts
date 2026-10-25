import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigRefusedError } from '@cogniate/shared';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { APP_MASTER_KEY_IN_ENV_MESSAGE, loadConfig } from './config.ts';

const base = {
  PUBLIC_MOODLE_URL: 'https://moodle.test',
  PUBLIC_LTI_URL: 'https://lti.cogniate.test',
  PUBLIC_APP_URL: 'https://app.cogniate.test',
  PUBLIC_CONTENT_URL: 'https://content.cogniate-content.test',
  APP_MASTER_KEY: '0'.repeat(64),
};

describe('loadConfig: LTI_API_URL (M3 §3.3, acceptance only)', () => {
  it.each([
    ['unset, no profile', {}],
    ['unset, default', { STACK_PROFILE: 'default' }],
    ['empty (what compose sets in default), default', { STACK_PROFILE: 'default', LTI_API_URL: '' }],
    ['unset, acceptance', { STACK_PROFILE: 'acceptance' }],
  ])('%s: no override, the /api/* calls go directly to PUBLIC_LTI_URL', (_label, env) => {
    const config = loadConfig({ ...base, ...env });
    expect(config.ltiApiUrl).toBeNull();
    expect(config.urls.lti).toBe('https://lti.cogniate.test');
  });

  it('acceptance: the transport gate origin is used', () => {
    const config = loadConfig({ ...base, STACK_PROFILE: 'acceptance', LTI_API_URL: 'https://lti-gate.test' });
    expect(config.profile).toBe('acceptance');
    expect(config.ltiApiUrl).toBe('https://lti-gate.test');
  });

  it.each([
    ['no profile (default)', undefined],
    ['empty profile (default)', ''],
    ['default', 'default'],
    ['another profile', 'production'],
  ])('%s: a set LTI_API_URL is refused, so the API key never goes to another origin', (_label, profile) => {
    // Production takes the app master key only from a file (BD-A2-91).
    const keys = profile === 'production' ? { APP_MASTER_KEY: undefined, APP_MASTER_KEY_FILE: secretFile('key-prod', '0'.repeat(64)) } : {};
    expect(() => loadConfig({ ...base, ...keys, STACK_PROFILE: profile, LTI_API_URL: 'https://lti-gate.test' }))
      .toThrow(/LTI_API_URL is only for the acceptance profile/);
  });

  it.each([
    ['http', 'http://lti-gate.test'],
    ['trailing slash', 'https://lti-gate.test/'],
    ['path', 'https://lti-gate.test/api'],
    ['not a URL', 'lti-gate.test'],
  ])('acceptance: rejects %s', (_label, value) => {
    expect(() => loadConfig({ ...base, STACK_PROFILE: 'acceptance', LTI_API_URL: value }))
      .toThrow('LTI_API_URL must be an https origin without path or trailing slash.');
  });
});

const dir = mkdtempSync(join(tmpdir(), 'app-config-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
function secretFile(name: string, text: string, mode = 0o600): string {
  const path = join(dir, name);
  writeFileSync(path, text, { mode });
  chmodSync(path, mode);
  return path;
}
const KEY = 'ab'.repeat(32);

describe('loadConfig: the app master key settings (LA-E5-22, LA-ADR-06 D12, A2 BD-A2-91)', () => {
  it('AC-LA-E5-22-05: APP_MASTER_KEY_FILE gives the same key as APP_MASTER_KEY with the same value (hex without case)', () => {
    const fromEnv = loadConfig({ ...base, APP_MASTER_KEY: KEY });
    const fromFile = loadConfig({ ...base, APP_MASTER_KEY: undefined, APP_MASTER_KEY_FILE: secretFile('key-upper', `${KEY.toUpperCase()}\n`) });
    expect(fromFile.masterKey.equals(fromEnv.masterKey)).toBe(true);
    expect(fromEnv.masterKey.toString('hex')).toBe(KEY);
    // No key-ring file: the master key is the one version legacy, active.
    expect([fromFile.keyRing.active, [...fromFile.keyRing.keys.keys()]]).toEqual(['legacy', ['legacy']]);
    // Both set: they must agree.
    expect(loadConfig({ ...base, APP_MASTER_KEY: KEY, APP_MASTER_KEY_FILE: secretFile('key-same', KEY) }).masterKey.toString('hex')).toBe(KEY);
    expect(() => loadConfig({ ...base, APP_MASTER_KEY: KEY, APP_MASTER_KEY_FILE: secretFile('key-other', 'cd'.repeat(32)) })).toThrow(/different values/);
  });

  it('production refuses APP_MASTER_KEY as an environment value (config_refused app_master_key_in_env, fixed text)', () => {
    let err: unknown;
    try { loadConfig({ ...base, STACK_PROFILE: 'production', APP_MASTER_KEY: KEY }); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(ConfigRefusedError);
    expect([(err as ConfigRefusedError).reason, (err as Error).message]).toEqual(['app_master_key_in_env', APP_MASTER_KEY_IN_ENV_MESSAGE]);
    expect(APP_MASTER_KEY_IN_ENV_MESSAGE).not.toContain(KEY);
    expect(loadConfig({ ...base, STACK_PROFILE: 'production', APP_MASTER_KEY: undefined, APP_MASTER_KEY_FILE: secretFile('key-prod-ok', KEY) }).masterKey.toString('hex')).toBe(KEY);
  });

  it('a key file with group or world access: production refuses (secret_file_mode); other profiles log one warning and go on', () => {
    const open = secretFile('key-open', KEY, 0o644);
    let err: unknown;
    try { loadConfig({ ...base, STACK_PROFILE: 'production', APP_MASTER_KEY: undefined, APP_MASTER_KEY_FILE: open }); } catch (e) { err = e; }
    expect([(err as ConfigRefusedError).reason, (err as ConfigRefusedError).setting]).toEqual(['secret_file_mode', 'APP_MASTER_KEY_FILE']);
    const warn = vi.fn();
    expect(loadConfig({ ...base, APP_MASTER_KEY: undefined, APP_MASTER_KEY_FILE: open }, { warn }).masterKey.toString('hex')).toBe(KEY);
    expect(warn).toHaveBeenCalledWith('secret_file_mode_open', { setting: 'APP_MASTER_KEY_FILE' });
  });

  it('no key at all stops the start', () => {
    expect(() => loadConfig({ ...base, APP_MASTER_KEY: undefined })).toThrow(/APP_MASTER_KEY must be 64 hex characters/);
    expect(() => loadConfig({ ...base, APP_MASTER_KEY: 'xyz' })).toThrow(/APP_MASTER_KEY must be 64 hex characters/);
  });
});
