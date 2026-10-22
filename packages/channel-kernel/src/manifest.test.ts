import { expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { loadChannelFolders } from './registry.ts';
import { parseChannelManifest } from './manifest.ts';

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
