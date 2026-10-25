import { chmodSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfigRefusedError, SECRET_FILE_MODE_MESSAGE, loadPublicUrls, readSecretFile, readSecretSetting } from './config.ts';

const valid = {
  PUBLIC_LTI_URL: 'https://lti.cogniate.test',
  PUBLIC_APP_URL: 'https://app.cogniate.test',
  PUBLIC_CONTENT_URL: 'https://content.cogniate-content.test',
};

describe('loadPublicUrls', () => {
  it('returns the three service origins without a platform URL', () => {
    expect(loadPublicUrls(valid)).toEqual({
      lti: 'https://lti.cogniate.test',
      app: 'https://app.cogniate.test',
      content: 'https://content.cogniate-content.test',
    });
  });

  it('keeps a non-default port', () => {
    expect(loadPublicUrls({ ...valid, PUBLIC_LTI_URL: 'https://lti.cogniate.test:8443' }).lti).toBe('https://lti.cogniate.test:8443');
  });

  it('names the missing variable', () => {
    expect(() => loadPublicUrls({ ...valid, PUBLIC_APP_URL: undefined })).toThrow(/PUBLIC_APP_URL is not set/);
  });

  it.each([
    ['http', 'http://lti.test'],
    ['trailing slash', 'https://lti.test/'],
    ['path', 'https://lti.test/platform'],
    ['not a URL', 'lti.test'],
  ])('rejects %s', (_label, value) => {
    expect(() => loadPublicUrls({ ...valid, PUBLIC_LTI_URL: value })).toThrow(/PUBLIC_LTI_URL/);
  });
});

describe('readSecretSetting, readSecretFile and ConfigRefusedError (LA-ADR-06 D12; BD-A2-78..80)', () => {
  const dirs: string[] = [];
  afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
  const secret = (content: string, mode = 0o600) => {
    const dir = mkdtempSync(join(tmpdir(), 'secret-setting-')); dirs.push(dir);
    const file = join(dir, 'secret');
    writeFileSync(file, content, { mode });
    chmodSync(file, mode);
    return file;
  };
  const warnings = () => {
    const lines: Array<[string, unknown]> = [];
    return { lines, logger: { warn: (event: string, fields?: Record<string, unknown>) => { lines.push([event, fields]); } } };
  };

  it('reads NAME_FILE (trimmed) or NAME, refuses two different values, and never puts a value in the error', () => {
    const file = secret('  file-value\n');
    expect(readSecretSetting({}, 'UNIT_SECRET')).toBeUndefined();
    expect(readSecretSetting({ UNIT_SECRET: '' }, 'UNIT_SECRET')).toBeUndefined();
    expect(readSecretSetting({ UNIT_SECRET: 'env-value' }, 'UNIT_SECRET')).toBe('env-value');
    expect(readSecretSetting({ UNIT_SECRET_FILE: file }, 'UNIT_SECRET')).toBe('file-value');
    expect(readSecretSetting({ UNIT_SECRET_FILE: file, UNIT_SECRET: 'file-value' }, 'UNIT_SECRET')).toBe('file-value');
    // Secrets other than hex keys keep the exact compare.
    expect(() => readSecretSetting({ UNIT_SECRET_FILE: file, UNIT_SECRET: 'FILE-VALUE' }, 'UNIT_SECRET'))
      .toThrow('UNIT_SECRET and UNIT_SECRET_FILE have different values. Set only one of them.');
    expect(() => readSecretSetting({ UNIT_SECRET_FILE: join(dirs[0]!, 'missing') }, 'UNIT_SECRET')).toThrow('ENOENT');
  });

  it('BD-A2-80: a hex key compares without letter case and comes back in lower case; a non-hex value is refused', () => {
    const lower = 'ab'.repeat(32);
    const file = secret(`${lower.toUpperCase()}\n`);
    expect(readSecretSetting({ KEY_FILE: file, KEY: lower }, 'KEY', { hexKey: true })).toBe(lower);
    expect(readSecretSetting({ KEY: lower.toUpperCase() }, 'KEY', { hexKey: true })).toBe(lower);
    expect(() => readSecretSetting({ KEY_FILE: file, KEY: 'cd'.repeat(32) }, 'KEY', { hexKey: true })).toThrow('KEY and KEY_FILE have different values.');
    let message = '';
    try { readSecretSetting({ KEY: 'not-hex-secret' }, 'KEY', { hexKey: true }); } catch (err) { message = (err as Error).message; }
    expect(message).toBe('KEY must be 64 hex characters (npm run gen-env), or the file KEY_FILE must hold them.');
  });

  it.each([0o600, 0o400])('BD-A2-78: mode %o passes in every profile with no warning', (mode) => {
    const file = secret('value', mode);
    for (const profile of ['production', 'default', 'acceptance']) {
      const { lines, logger } = warnings();
      expect(readSecretFile(file, 'UNIT_SECRET_FILE', profile, logger)).toBe('value');
      expect(lines).toEqual([]);
    }
  });

  it.each([0o640, 0o644, 0o604, 0o620])('BD-A2-78: mode %o refuses in production and warns in default and acceptance', (mode) => {
    const file = secret('top-secret-value', mode);
    let refused: unknown;
    try { readSecretFile(file, 'UNIT_SECRET_FILE', 'production'); } catch (err) { refused = err; }
    expect(refused).toBeInstanceOf(ConfigRefusedError);
    expect(refused).toMatchObject({ reason: 'secret_file_mode', setting: 'UNIT_SECRET_FILE', message: SECRET_FILE_MODE_MESSAGE });
    expect(JSON.stringify({ ...(refused as object), message: (refused as Error).message })).not.toContain(file);
    for (const profile of ['default', 'acceptance']) {
      const { lines, logger } = warnings();
      expect(readSecretFile(file, 'UNIT_SECRET_FILE', profile, logger)).toBe('top-secret-value');
      expect(lines).toEqual([['secret_file_mode_open', { setting: 'UNIT_SECRET_FILE' }]]);
    }
    // readSecretSetting takes the profile from STACK_PROFILE.
    expect(() => readSecretSetting({ STACK_PROFILE: 'production', UNIT_SECRET_FILE: file }, 'UNIT_SECRET')).toThrow(ConfigRefusedError);
  });

  it('BD-A2-78: checks the opened file, refuses a directory, and follows a symlink to the real file', () => {
    const file = secret('linked-value');
    const link = join(dirs[0]!, 'link');
    symlinkSync(file, link);
    expect(readSecretFile(link, 'UNIT_SECRET_FILE', 'production')).toBe('linked-value');
    chmodSync(file, 0o644);
    expect(() => readSecretFile(link, 'UNIT_SECRET_FILE', 'production')).toThrow(ConfigRefusedError);
    expect(() => readSecretFile(dirs[0]!, 'UNIT_SECRET_FILE', 'default')).toThrow('UNIT_SECRET_FILE must name a regular file.');
    if (process.getuid?.() !== 0) {
      chmodSync(file, 0o000);
      expect(() => readSecretFile(file, 'UNIT_SECRET_FILE', 'default')).toThrow('EACCES');
    }
  });

  it('ConfigRefusedError carries the reason, the fixed message and an optional setting name', () => {
    const refused = new ConfigRefusedError('secret_file_mode', SECRET_FILE_MODE_MESSAGE, 'LTI_KEYRING_FILE');
    expect([refused.name, refused.reason, refused.message, refused.setting]).toEqual(['ConfigRefusedError', 'secret_file_mode', SECRET_FILE_MODE_MESSAGE, 'LTI_KEYRING_FILE']);
    expect(new ConfigRefusedError('test_knob_active', 'Fixed text.').setting).toBeUndefined();
  });
});
