// Load check 7. Profile data has one closed schema; unknown fields are errors, also inside flags.
import { BASELINE_PROFILE_WIRE_LMS, PRIVACY_FLOOR_NONE_PROFILES, RegistryError } from '@cogniate/channel-kernel';
import { z } from 'zod';
import type { ProfileSource } from './types.ts';

export const profileSourceSchema = z.strictObject({
  id: z.string().min(1),
  endpoints: z.enum(['admin', 'fixed']),
  privacyFloor: z.enum(['allowlist', 'none']),
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
      ctx.addIssue({ code: 'custom', path: [field], message: 'Endpoint value does not match the endpoints trait.' });
    }
  }
}) satisfies z.ZodType<ProfileSource>;

/** The loader owns channel and lms; neither may appear in the source. */
export function parseProfileSource(value: unknown, channel: string): ProfileSource {
  const parsed = profileSourceSchema.safeParse(value);
  if (!parsed.success) {
    throw new RegistryError(channel, 7, {
      reason: 'profile_schema_invalid',
      detail: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'profile'}: ${issue.message}`).join('; '),
    });
  }
  const baseline = Object.hasOwn(BASELINE_PROFILE_WIRE_LMS, parsed.data.id);
  const hasWireLms = Object.hasOwn(parsed.data, 'wireLms');
  if (baseline ? !hasWireLms || parsed.data.wireLms !== BASELINE_PROFILE_WIRE_LMS[parsed.data.id] : hasWireLms) {
    throw new RegistryError(channel, 7, { reason: 'profile_wire_lms_invalid', detail: `profile "${parsed.data.id}" must keep its baseline wire value, or omit wireLms for a new profile` });
  }
  if (parsed.data.privacyFloor === 'none' && !PRIVACY_FLOOR_NONE_PROFILES.includes(parsed.data.id)) {
    throw new RegistryError(channel, 7, { reason: 'profile_privacy_floor_invalid', detail: `profile "${parsed.data.id}": privacyFloor must be "allowlist"` });
  }
  return parsed.data;
}
