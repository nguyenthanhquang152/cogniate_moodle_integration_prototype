// Channel manifest (LA-ADR-01 D2): pure data, no functions, no I/O. `packages/channels/<id>/manifest.ts` default-exports
// one manifest. The kernel validates it with ONE schema at load time (registry load check 1); load check 4 validates
// the `capabilities` object against the catalog.
import { z } from 'zod';
import type { BindingAuthority, CheckProblem, ManifestCapabilities, RegistrationMethod } from './capabilities.ts';
import { REGISTRATION_TEXT_KEYS, TEXT_PLACEHOLDERS } from './text.ts';
import type { RegistrationTextKey } from './text.ts';

/** A channel id: also the folder name under `packages/channels/`. */
export const CHANNEL_ID_PATTERN = /^[a-z][a-z0-9-]{1,31}$/;

export interface RegistrationEntry {
  method: RegistrationMethod;
  /** Binding authority of this method (D7). */
  authority: BindingAuthority;
  /** Profile ids of this channel that this method may use. */
  profiles: readonly string[];
  defaultProfile: string;
}

/** A guarded product family (D6): lower case; `launch` only on a channel of `LAUNCH_GUARD_CHANNELS` (load check 8). */
export interface GuardedFamily {
  family: string;
  level: 'launch' | 'registration';
}

/** One form field of the setup steps (D9). */
export interface FieldSpec {
  key: string;
  label: string;
  kind: 'origin' | 'id' | 'grantCode' | 'url' | 'choice';
  required: boolean;
  method?: RegistrationMethod;
  /**
   * E2-K (LA-ADR-01 D2): a pre-filled value; the only placeholder is `{siteUrl}` (the connection site origin). A posted
   * value always replaces it, and it is never trusted alone (Reviewer-B B-LAD-05): the grant binds the value.
   */
  default?: string;
}

export interface ChannelManifest {
  /** Channel id, equal to the folder name. */
  id: string;
  /** `lti13` in LA. The values `catalog-file`, `xapi`, `vendor-api` and `package` are reserved, not accepted. */
  family: 'lti13';
  names: {
    /** Fills `{LMS}` in every text ("Moodle", "your LMS"). */
    text: string;
    /** Provider list label. */
    label: string;
  };
  /** Integrations page card (D9). `order` sorts the channels (then the id). */
  card: { title: string; description: string; mark: string; icon?: 'graduation-cap'; color: string; category: 'LMS Publishing'; order: number };
  /** `simulation-only`: loaded only when simulations are on. */
  availability: 'ga' | 'preview' | 'simulation-only';
  /** Order = portal order. */
  registration: readonly RegistrationEntry[];
  /** D3; absent = false or empty. Only capabilities with source `manifest`. */
  capabilities: ManifestCapabilities;
  lti?: {
    guardedFamilies: readonly GuardedFamily[];
    /** Tool configuration rows from the channel adapter (`channel`), or none. */
    toolConfiguration: 'channel' | 'none';
  };
  /** "Show, collect, verify, enable" (D9). No verify field: the shell takes it from the binding authority. */
  setup: {
    /** `POST /app-api/connections` extras (siteUrl, serviceUrl, profile). */
    createFields: readonly FieldSpec[];
    /** `PUT …/platform` body keys (strict), per method. */
    bindingFields: readonly FieldSpec[];
    /** The "Check connection" panel (A2 LA-ADR-08 D4, Could). */
    connectionCheck?: boolean;
  };
  /** What the channel's `app/` SQL may name (D5 "Tables"). */
  storage?: {
    tables: readonly string[];
    /** `table.column` */
    columns: readonly string[];
  };
  /** Texts with the placeholders `{LMS}`, `{tool}` and `{site}` only. */
  texts: {
    /** Portal error texts that name an LMS (BD-A1-63), with `{LMS}` only. A key without a text gets the generic core text. */
    errors?: Partial<Record<ErrorTextKey, string>>;
    adminSteps: readonly string[];
    teacherSteps: readonly string[];
    disconnect: string;
    notReady: string | null;
    registered?: string;
    /** BD-A1-59: Dynamic Registration help sentences that name LMS menu paths; a missing key gets the core default. */
    registration?: Readonly<Partial<Record<RegistrationTextKey, string>>>;
  };
}

const NAME = /^[a-z_][a-z0-9_]*$/;
const PROFILE_ID = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/, 'a profile id: lower case letters, digits and "-"');
const TEXT = z.string().min(1).refine(
  (t) => [...t.matchAll(/\{([^{}]*)\}/g)].every((m) => (TEXT_PLACEHOLDERS as readonly string[]).includes(m[1]!)),
  `only the placeholders ${TEXT_PLACEHOLDERS.map((p) => `{${p}}`).join(', ')}`,
);
const METHOD = z.enum(['dynamic', 'manual']);
const unique = (values: readonly string[]): boolean => new Set(values).size === values.length;

/** The keys of `texts.errors` (BD-A1-63): the portal error texts that may name an LMS. A closed list. */
export const ERROR_TEXT_KEYS = ['SITE_RULE_1', 'SITE_RULE_5', 'PLATFORM_IN_USE', 'DEPLOYMENT_IN_USE', 'DEPLOYMENT_FIXED'] as const;
export type ErrorTextKey = (typeof ERROR_TEXT_KEYS)[number];
/** An error text has `{LMS}` as its only placeholder: the portal error notice knows no tool name and no site. */
const ERROR_TEXT = z.string().min(1).refine((t) => [...t.matchAll(/\{([^{}]*)\}/g)].every((m) => m[1] === 'LMS'), 'only the placeholder {LMS}');

const FIELD_SPEC = z.strictObject({
  key: z.string().regex(/^[A-Za-z][A-Za-z0-9]*$/),
  label: z.string().min(1),
  kind: z.enum(['origin', 'id', 'grantCode', 'url', 'choice']),
  required: z.boolean(),
  method: METHOD.optional(),
  default: z.string().min(1).refine((t) => [...t.matchAll(/\{([^{}]*)\}/g)].every((m) => m[1] === 'siteUrl'), 'only the placeholder {siteUrl}').optional(),
});

const REGISTRATION = z.strictObject({
  method: METHOD,
  authority: z.enum(['self', 'operatorGrant']),
  profiles: z.array(PROFILE_ID).min(1).refine(unique, 'profile ids must be unique'),
  defaultProfile: PROFILE_ID,
}).refine((r) => r.profiles.includes(r.defaultProfile), { message: 'defaultProfile must be one of profiles', path: ['defaultProfile'] });

/** The one manifest schema (load check 1). `capabilities` is only an object here: load check 4 checks its content. */
const MANIFEST = z.strictObject({
  id: z.string().regex(CHANNEL_ID_PATTERN, 'a channel id: ^[a-z][a-z0-9-]{1,31}$'),
  family: z.literal('lti13'),
  names: z.strictObject({ text: z.string().min(1), label: z.string().min(1) }),
  card: z.strictObject({
    title: z.string().min(1), description: z.string().min(1), mark: z.string().min(1), icon: z.enum(['graduation-cap']).optional(), color: z.string().min(1),
    category: z.literal('LMS Publishing'), order: z.number().int().nonnegative(),
  }),
  availability: z.enum(['ga', 'preview', 'simulation-only']),
  registration: z.array(REGISTRATION).min(1).refine((rs) => unique(rs.map((r) => r.method)), 'one entry per method'),
  capabilities: z.record(z.string(), z.unknown()),
  lti: z.strictObject({
    guardedFamilies: z.array(z.strictObject({
      family: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,63}$/, 'a family in lower case'),
      level: z.enum(['launch', 'registration']),
    })).refine((gs) => unique(gs.map((g) => g.family)), 'one entry per family'),
    toolConfiguration: z.enum(['channel', 'none']),
  }).optional(),
  setup: z.strictObject({
    createFields: z.array(FIELD_SPEC),
    bindingFields: z.array(FIELD_SPEC),
    connectionCheck: z.boolean().optional(),
  }),
  storage: z.strictObject({
    tables: z.array(z.string().regex(NAME)),
    columns: z.array(z.string().refine((c) => c.split('.').length === 2 && c.split('.').every((p) => NAME.test(p)), 'table.column')),
  }).optional(),
  texts: z.strictObject({
    errors: z.partialRecord(z.enum(ERROR_TEXT_KEYS), ERROR_TEXT).optional(),
    adminSteps: z.array(TEXT),
    teacherSteps: z.array(TEXT),
    disconnect: TEXT,
    notReady: TEXT.nullable(),
    registered: TEXT.default('Registered'),
    registration: z.strictObject(Object.fromEntries(REGISTRATION_TEXT_KEYS.map((key) => [key, TEXT.optional()])) as Record<RegistrationTextKey, z.ZodOptional<typeof TEXT>>).optional(),
  }),
});

/** A `FieldSpec.default` with `{siteUrl}` filled (LA-ADR-01 D2). The value goes in literally. */
export function fillFieldDefault(template: string, values: { siteUrl: string }): string {
  return template.replace(/\{siteUrl\}/g, () => values.siteUrl);
}

/** Validate one manifest against the schema (the shape part of load check 1). */
export function parseChannelManifest(value: unknown): { ok: true; manifest: ChannelManifest } | { ok: false; problem: CheckProblem } {
  const parsed = MANIFEST.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    return { ok: false, problem: { reason: 'manifest_schema', detail: `${issue.path.join('.') || '(manifest)'}: ${issue.message}` } };
  }
  return { ok: true, manifest: parsed.data as ChannelManifest };
}
