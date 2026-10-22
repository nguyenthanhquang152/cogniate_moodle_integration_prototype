import { expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { loadChannelFolders } from './registry.ts';
import { ERROR_TEXT_KEYS, parseChannelManifest } from './manifest.ts';
import { fillText } from './text.ts';

it('defaults registered text and preserves the frozen activation text', async () => {
  const loaded = await loadChannelFolders([fileURLToPath(new URL('../../channels/', import.meta.url))], 'app');
  const parsed = parseChannelManifest(loaded.find((c) => c.folder.endsWith('/moodle'))!.manifest);
  if (!parsed.ok) throw new Error('The product manifest must be valid');
  const manifest = parsed.manifest;
  expect(parsed.ok && parsed.manifest.texts.registered).toBe('Registered — activate in {LMS}');
  const texts = { ...manifest.texts };
  delete texts.registered;
  const without = parseChannelManifest({ ...manifest, texts });
  expect(without.ok && without.manifest.texts.registered).toBe('Registered');
  expect(parseChannelManifest({ ...manifest, texts: { ...texts, registered: '{unknown}' } }).ok).toBe(false);
});

it('holds the baseline texts.errors values, closed keys and {LMS} as the only placeholder (BD-A1-63)', async () => {
  const loaded = await loadChannelFolders([fileURLToPath(new URL('../../channels/', import.meta.url))], 'app');
  const manifest = (id: string) => {
    const parsed = parseChannelManifest(loaded.find((c) => c.folder.endsWith(`/${id}`))!.manifest);
    if (!parsed.ok) throw new Error('The product manifest must be valid');
    return parsed.manifest;
  };
  // The filled texts equal the M1 portal texts byte for byte.
  const filled = (id: string) => {
    const m = manifest(id);
    return Object.fromEntries(Object.entries(m.texts.errors ?? {}).map(([key, text]) => [key, fillText(text, { LMS: m.names.text })]));
  };
  const rule1 = 'Enter only the address, for example https://school.instructure.com. No path.';
  expect(filled('moodle')).toEqual({ SITE_RULE_1: rule1 });
  expect(filled('canvas')).toEqual({
    SITE_RULE_1: rule1,
    SITE_RULE_5: 'This is an Instructure-hosted address. Choose an Instructure-hosted Canvas type.',
    PLATFORM_IN_USE: 'This Canvas developer key is already connected to Cogniate. Make a new developer key for this library.',
  });
  expect(filled('blackboard')).toEqual({
    SITE_RULE_1: rule1,
    DEPLOYMENT_IN_USE: 'This Blackboard site is already connected to Cogniate.',
    DEPLOYMENT_FIXED: 'This connection already reserved another Blackboard deployment. Disconnect it, then make a new connection.',
  });

  const moodle = manifest('moodle');
  const texts = { ...moodle.texts };
  delete texts.errors;
  expect(parseChannelManifest({ ...moodle, texts }).ok).toBe(true);
  expect(ERROR_TEXT_KEYS).toEqual(['SITE_RULE_1', 'SITE_RULE_5', 'PLATFORM_IN_USE', 'DEPLOYMENT_IN_USE', 'DEPLOYMENT_FIXED']);
  const problem = (errors: unknown) => {
    const parsed = parseChannelManifest({ ...moodle, texts: { ...texts, errors } });
    return parsed.ok ? null : parsed.problem;
  };
  expect(problem({ GRANT_INVALID: 'This code is not valid.' })).toMatchObject({ reason: 'manifest_schema', detail: expect.stringContaining('texts.errors') });
  expect(problem({ SITE_RULE_1: 'Open {tool} on {site}.' })).toEqual({ reason: 'manifest_schema', detail: 'texts.errors.SITE_RULE_1: only the placeholder {LMS}' });
  expect(problem({ PLATFORM_IN_USE: '' })?.detail).toMatch(/^texts\.errors\.PLATFORM_IN_USE: /);
  expect(problem({ DEPLOYMENT_FIXED: 'This {LMS} deployment is reserved.' })).toBeNull();
});
