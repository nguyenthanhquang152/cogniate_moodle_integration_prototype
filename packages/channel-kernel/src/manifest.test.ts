import { expect, it } from 'vitest';
import manifest from '../../channels/moodle/manifest.ts';
import { parseChannelManifest } from './manifest.ts';

it('defaults registered text and preserves the frozen activation text', () => {
  const parsed = parseChannelManifest(manifest);
  expect(parsed.ok && parsed.manifest.texts.registered).toBe('Registered — activate in {LMS}');
  const texts = { ...manifest.texts };
  delete texts.registered;
  const without = parseChannelManifest({ ...manifest, texts });
  expect(without.ok && without.manifest.texts.registered).toBe('Registered');
  expect(parseChannelManifest({ ...manifest, texts: { ...texts, registered: '{unknown}' } }).ok).toBe(false);
});
