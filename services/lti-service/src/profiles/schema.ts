// Load check 7. Profile data has one closed schema; unknown fields are errors, also inside flags.
import { BASELINE_PROFILE_WIRE_LMS, PRIVACY_FLOOR_NONE_PROFILES, RegistryError } from '@cogniate/channel-kernel';
import { z } from 'zod';
import type { ProfileSource } from '@cogniate/channel-kernel';
import { FRAME_NAME } from './storage.ts';

/**
 * LA-ADR-02 D2: the issuer kind that the issuer value gives. A fixed URL is `fixed`; a `{siteUrl}` template or an
 * admin value (null) is `per-tenant`. The same rule as the reserved issuers (index.ts).
 */
export const issuerKindOf = (issuer: string | null): 'per-tenant' | 'fixed' => (issuer !== null && !issuer.startsWith('{') ? 'fixed' : 'per-tenant');

const storageOrigin = z.string().refine((value) => {
  if (value === 'authOrigin') return true;
  try { const url = new URL(value); return url.protocol === 'https:' && url.origin === value; }
  catch { return false; }
}, 'Expected authOrigin or a canonical https origin without a path.');

/** A member name of the tool configuration claim that cannot meet a member of the LTI specs: an absolute https URL. */
const isExtensionKey = (value: string): boolean => {
  try { const url = new URL(value); return url.protocol === 'https:' && url.username === '' && url.password === '' && url.href === value && !/[?#]/.test(value); }
  catch { return false; }
};

export const profileSourceSchema = z.strictObject({
  id: z.string().min(1),
  endpoints: z.enum(['admin', 'fixed']),
  privacyFloor: z.enum(['allowlist', 'none']),
  platformStorage: z.strictObject({
    targetFrame: z.string().regex(FRAME_NAME, 'Expected from-login, _parent or a frame name of 1 to 64 letters, digits, _ or -.'),
    origin: storageOrigin,
  }).nullable().optional(),
  // E2 traits (LA-ADR-02 D2). Optional in a profile file: the registry supplies the default (registry.ts).
  issuerKind: z.enum(['per-tenant', 'fixed']).optional(),
  endpointOrigins: z.enum(['issuer', 'any-https']).nullable().optional(),
  clientAssertionAud: z.strictObject({ value: z.enum(['{tokenEndpoint}', '{platformValue}']), form: z.enum(['string', 'array']) }).optional(),
  assertionDeploymentId: z.boolean().optional(),
  dynamicRegistration: z.strictObject({
    issuerRule: z.enum(['origin', 'path-prefix', 'profile']),
    configurationPath: z.string().regex(/^\/[^?#\s]*$/, 'Expected a path that starts with "/", with no query or fragment.').optional(),
    registrationToken: z.enum(['scope-jwt', 'opaque-bearer']),
    // LA-ADR-05 D6 (RQ-2, A1 to ratify): channel data for the tool configuration claim of the registration request.
    toolConfigurationExtensions: z.record(z.string().refine(isExtensionKey, 'Expected an absolute https URL as the member name.'), z.string().min(1))
      .refine((members) => Object.keys(members).length <= 8, 'Expected at most 8 members.').optional(),
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
  // LA-ADR-02 D2 (Reviewer-B B-LAD-14): a given trait must agree with the profile values. The issuer kind is checked
  // only when the issuer itself fits the endpoints value, so that one wrong issuer gives one message.
  const issuerFits = (profile.issuer === null) === (profile.endpoints === 'admin');
  if (issuerFits && profile.issuerKind !== undefined && profile.issuerKind !== issuerKindOf(profile.issuer)) {
    ctx.addIssue({ code: 'custom', path: ['issuerKind'], message: `Expected "${issuerKindOf(profile.issuer)}" for this issuer value.` });
  }
  if (profile.endpointOrigins !== undefined && (profile.endpointOrigins === null) !== (profile.endpoints === 'fixed')) {
    ctx.addIssue({ code: 'custom', path: ['endpointOrigins'], message: profile.endpoints === 'fixed' ? 'Expected null for endpoints "fixed".' : 'Expected "issuer" or "any-https" for endpoints "admin".' });
  }
  // A-LA-E2-01-04: a stored audience is an admin value; a fixed profile has no such value (LA-ADR-02 D2).
  if (profile.clientAssertionAud?.value === '{platformValue}' && profile.endpoints === 'fixed') {
    ctx.addIssue({ code: 'custom', path: ['clientAssertionAud', 'value'], message: 'Expected "{tokenEndpoint}" for endpoints "fixed".' });
  }
  if (profile.dynamicRegistration?.configurationPath !== undefined && profile.dynamicRegistration.issuerRule !== 'path-prefix') {
    ctx.addIssue({ code: 'custom', path: ['dynamicRegistration', 'configurationPath'], message: 'Expected a configurationPath only with issuerRule "path-prefix".' });
  }
  // LA-ADR-05 D6, contract delta §4.5: fixed-endpoint profiles keep their own rule (the profile values); admin values
  // follow an issuer rule.
  if (profile.dynamicRegistration && (profile.dynamicRegistration.issuerRule === 'profile') !== (profile.endpoints === 'fixed')) {
    ctx.addIssue({ code: 'custom', path: ['dynamicRegistration', 'issuerRule'], message: profile.endpoints === 'fixed' ? 'Expected "profile" for endpoints "fixed".' : 'Expected "origin" or "path-prefix" for endpoints "admin".' });
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
