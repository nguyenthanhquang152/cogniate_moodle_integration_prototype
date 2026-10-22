import { expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { loadChannelFolders } from './registry.ts';
import { parseChannelManifest } from './manifest.ts';
import { DEFAULT_REGISTRATION_TEXTS, REGISTRATION_TEXT_KEYS, fillText, registrationText } from './text.ts';
import type { RegistrationTextKey } from './text.ts';

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

it('BD-A1-59: the Moodle registration sentences fill to the LA-E1-10 and app register texts byte for byte', async () => {
  const loaded = await loadChannelFolders([fileURLToPath(new URL('../../channels/', import.meta.url))], 'app');
  const parsed = parseChannelManifest(loaded.find((c) => c.folder.endsWith('/moodle'))!.manifest);
  if (!parsed.ok) throw new Error('The product manifest must be valid');
  const moodle = (key: RegistrationTextKey) => fillText(registrationText(parsed.manifest, key), { LMS: 'Moodle' });
  expect(Object.fromEntries(REGISTRATION_TEXT_KEYS.map((key) => [key, moodle(key)]))).toEqual({
    UNKNOWN_TOOL_ACCOUNT: 'This registration URL is not valid. Copy it again in Cogniate (Integrations > Moodle > Connect) and paste it in Moodle (Manage tools > Add LTI Advantage).',
    INVALID_REQUEST: 'Start the registration again from Moodle (Site administration > Plugins > Activity modules > External tool > Manage tools).',
    ISSUER_MISMATCH: 'The platform configuration is not from this Moodle site. Start the registration again from Manage tools on the site itself.',
    REGISTRATION_UPDATE_NOT_ALLOWED: 'This registration updates a tool that is not this connection. Choose "Register as a new external tool" in Moodle.',
    UPDATE_NOT_ALLOWED: 'Go back in Moodle and choose Register as a new external tool.',
  });
});

it('BD-A1-59: texts.registration is optional, closed to the five keys and to the text placeholders', async () => {
  const loaded = await loadChannelFolders([fileURLToPath(new URL('../../channels/', import.meta.url))], 'app');
  const parsed = parseChannelManifest(loaded.find((c) => c.folder.endsWith('/moodle'))!.manifest);
  if (!parsed.ok) throw new Error('The product manifest must be valid');
  const { registration, ...texts } = parsed.manifest.texts;
  expect(registration).toBeDefined();
  const without = parseChannelManifest({ ...parsed.manifest, texts });
  expect(without.ok && without.manifest.texts.registration).toBeUndefined();
  expect(parseChannelManifest({ ...parsed.manifest, texts: { ...texts, registration: { INVALID_REQUEST: 'Start again in {LMS}.' } } }).ok).toBe(true);
  expect(parseChannelManifest({ ...parsed.manifest, texts: { ...texts, registration: { FETCH_FAILED: 'Not a key.' } } }).ok).toBe(false);
  expect(parseChannelManifest({ ...parsed.manifest, texts: { ...texts, registration: { INVALID_REQUEST: 'Open {menu} in {LMS}.' } } }).ok).toBe(false);
  expect(parseChannelManifest({ ...parsed.manifest, texts: { ...texts, registration: { INVALID_REQUEST: '' } } }).ok).toBe(false);
});

it('BD-A1-59: a channel without its own sentence gets the core default, which names no menu path', () => {
  const own = { texts: { registration: { INVALID_REQUEST: 'Start again from the {LMS} admin page.' } } };
  expect(registrationText(own, 'INVALID_REQUEST')).toBe('Start again from the {LMS} admin page.');
  for (const key of REGISTRATION_TEXT_KEYS) {
    if (key !== 'INVALID_REQUEST') expect(registrationText(own, key)).toBe(DEFAULT_REGISTRATION_TEXTS[key]);
    expect(registrationText({ texts: {} }, key)).toBe(DEFAULT_REGISTRATION_TEXTS[key]);
    expect(registrationText(null, key)).toBe(DEFAULT_REGISTRATION_TEXTS[key]);
    expect(DEFAULT_REGISTRATION_TEXTS[key]).toContain('{LMS}');
    expect(DEFAULT_REGISTRATION_TEXTS[key]).not.toMatch(/>|Manage tools|Site administration|Register as a new external tool/);
  }
});
