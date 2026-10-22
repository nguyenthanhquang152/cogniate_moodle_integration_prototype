import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfigRefusedError, loadPublicUrls, readSecretSetting } from './config.ts';

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

describe('readSecretSetting and ConfigRefusedError (LA-ADR-06 D12)', () => {
  it('reads NAME_FILE (trimmed) or NAME, refuses two different values, and never puts a value in the error', () => {
    const dir = mkdtempSync(join(tmpdir(), 'secret-setting-'));
    try {
      const file = join(dir, 'secret');
      writeFileSync(file, '  file-value\n', { mode: 0o600 });
      expect(readSecretSetting({}, 'UNIT_SECRET')).toBeUndefined();
      expect(readSecretSetting({ UNIT_SECRET: '' }, 'UNIT_SECRET')).toBeUndefined();
      expect(readSecretSetting({ UNIT_SECRET: 'env-value' }, 'UNIT_SECRET')).toBe('env-value');
      expect(readSecretSetting({ UNIT_SECRET_FILE: file }, 'UNIT_SECRET')).toBe('file-value');
      expect(readSecretSetting({ UNIT_SECRET_FILE: file, UNIT_SECRET: 'file-value' }, 'UNIT_SECRET')).toBe('file-value');
      let message = '';
      try { readSecretSetting({ UNIT_SECRET_FILE: file, UNIT_SECRET: 'env-value' }, 'UNIT_SECRET'); } catch (err) { message = (err as Error).message; }
      expect(message).toBe('UNIT_SECRET and UNIT_SECRET_FILE have different values. Set only one of them.');
      expect(() => readSecretSetting({ UNIT_SECRET_FILE: join(dir, 'missing') }, 'UNIT_SECRET')).toThrow('ENOENT');
    } finally { rmSync(dir, { recursive: true, force: true }); }
    const refused = new ConfigRefusedError('test_knob_active');
    expect([refused.name, refused.reason, refused.message]).toEqual(['ConfigRefusedError', 'test_knob_active', 'config_refused: test_knob_active']);
  });
});
