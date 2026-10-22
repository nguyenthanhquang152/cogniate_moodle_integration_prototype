// Load check 7. Profile data has one closed schema; unknown fields are errors, also inside flags.
import { BASELINE_PROFILE_WIRE_LMS, PRIVACY_FLOOR_NONE_PROFILES, RegistryError } from '@cogniate/channel-kernel';
import { z } from 'zod';
import type { ProfileSource } from '@cogniate/channel-kernel';
import { FRAME_NAME } from './storage.ts';

const storageOrigin = z.string().refine((value) => {
  if (value === 'authOrigin') return true;
  try { const url = new URL(value); return url.protocol === 'https:' && url.origin === value; }
  catch { return false; }
}, 'Expected authOrigin or a canonical https origin without a path.');

export const profileSourceSchema = z.strictObject({
  id: z.string().min(1),
  endpoints: z.enum(['admin', 'fixed']),
  privacyFloor: z.enum(['allowlist', 'none']),
  platformStorage: z.strictObject({
    targetFrame: z.string().regex(FRAME_NAME, 'Expected from-login, _parent or a frame name of 1 to 64 letters, digits, _ or -.'),
    origin: storageOrigin,
  }).nullable().optional(),
  wireLms: z.string().min(1).nullable().optional(),
  listOrder: z.number().int().nonnegative(),
  label: z.string().min(1),
  sharing: z.enum(['exclusive', 'shared']),
  issuer: z.string().min(1).nullable(),
  authenticationEndpoint: z.string().min(1).nullable(),
  accesstokenEndpoint: z.string().min(1).nullable(),
  jwksUrl: z.string().min(1).nullable(),
  siteUrlOn: z.enum(['platform', 'deployment']).nullable(),
  serviceUrl: z.boolean(),
  simulation: z.boolean(),
  productFamily: z.string().min(1).nullable(),
  flags: z.strictObject({
    deepLinkingResponseSub: z.boolean(),
    clientAssertionAudArray: z.boolean(),
    serviceOriginCheck: z.boolean(),
  }),
  refusedHostSuffixes: z.array(z.string().min(1)).optional(),
  sources: z.array(z.string().min(1)),
}).superRefine((profile, ctx) => {
  for (const field of ['issuer', 'authenticationEndpoint', 'accesstokenEndpoint', 'jwksUrl'] as const) {
    if ((profile[field] === null) !== (profile.endpoints === 'admin')) {
      ctx.addIssue({ code: 'custom', path: [field], message: profile.endpoints === 'admin' ? 'Expected null for endpoints "admin".' : 'Expected a fixed value or template for endpoints "fixed".' });
    }
  }
}) satisfies z.ZodType<ProfileSource>;

/** The loader owns channel and lms; neither may appear in the source. */
export function parseProfileSource(value: unknown, channel: string): ProfileSource {
  const parsed = profileSourceSchema.safeParse(value);
  if (!parsed.success) {
    const id = value !== null && typeof value === 'object' && 'id' in value && typeof value.id === 'string' ? value.id : '<unknown>';
    throw new RegistryError(channel, 7, {
      reason: 'profile_schema_invalid',
      detail: `profile "${id}": ${parsed.error.issues.map((issue) => `${issue.path.join('.') || 'profile'}: ${issue.message}`).join('; ')}`,
    });
  }
  const baseline = Object.hasOwn(BASELINE_PROFILE_WIRE_LMS, parsed.data.id);
  const hasWireLms = Object.hasOwn(parsed.data, 'wireLms');
  if (baseline ? !hasWireLms || parsed.data.wireLms !== BASELINE_PROFILE_WIRE_LMS[parsed.data.id] : hasWireLms) {
    const expected = baseline ? `wireLms must be ${JSON.stringify(BASELINE_PROFILE_WIRE_LMS[parsed.data.id])}` : 'must omit wireLms for a new profile';
    throw new RegistryError(channel, 7, { reason: 'profile_wire_lms_invalid', detail: `profile "${parsed.data.id}": ${expected}` });
  }
  if (parsed.data.privacyFloor === 'none' && !PRIVACY_FLOOR_NONE_PROFILES.includes(parsed.data.id)) {
    throw new RegistryError(channel, 7, { reason: 'profile_privacy_floor_invalid', detail: `profile "${parsed.data.id}": privacyFloor must be "allowlist"` });
  }
  return parsed.data;
}
