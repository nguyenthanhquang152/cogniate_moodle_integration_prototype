/**
 * Test knobs: the ONE registry (QA hook H3). Later tasks add knobs here, nowhere else.
 *
 * A knob is an env variable of one compose service with a production default. Tests change it with
 *   npm run stack:restart -- <service> --env NAME=VALUE
 * and restore the default with the same command without --env. A knob is "active" when its env value is
 * set and differs from the default. The service then logs test_knob_active {name, value} at start, and
 * GET /healthz lists it in "knobs": [{name, value}] (value = the env string). By default "knobs" is [].
 */
export interface NumberKnobSpec {
  /** Compose service that reads the knob. */
  service: 'lti-service' | 'cogniate-app';
  kind?: 'number';
  default: number;
  min: number;
  max: number;
  description: string;
}

/** A string knob (T8, tasks README §3: BUILD_RUNNER_FAIL_AT): only the listed values are valid. */
export interface StringKnobSpec {
  service: 'lti-service' | 'cogniate-app';
  kind: 'string';
  default: string;
  allowed: readonly string[];
  description: string;
}

export type KnobSpec = NumberKnobSpec | StringKnobSpec;

/** The steps of a Build Runner build (T8), in order; BUILD_RUNNER_FAIL_AT names one of them. */
export const BUILD_STEPS = ['start', 'course', 'scorm', 'backup', 'copy'] as const;

export const KNOB_REGISTRY = {
  LTIK_TTL_SECONDS: {
    service: 'lti-service',
    default: 86_400,
    min: 1,
    max: 30 * 86_400,
    description: 'ltik lifetime in seconds. Contract: 24 h (lti-service-api, T2). AC-T2-07 uses 20.',
  },
  REF_TTL_SECONDS: {
    service: 'cogniate-app',
    default: 86_400,
    min: 1,
    max: 30 * 86_400,
    description: 'Registration URL ref token lifetime in seconds. Contract: 24 h (cogniate-app-api, T4). AC-T4-09 uses 20.',
  },
  BUILD_RUNNER_HOLD: {
    service: 'cogniate-app',
    default: 0,
    min: 0,
    max: 1,
    description: 'T8 Build Runner: 1 = the build waits before teardown until its hold file is removed (AC-T8-03).',
  },
  BUILD_RUNNER_FAIL_AT: {
    service: 'cogniate-app',
    kind: 'string',
    default: '',
    allowed: ['', ...BUILD_STEPS],
    description: 'T8 Build Runner: the build fails at this step (start, course, scorm, backup, copy). AC-T8-07 uses backup.',
  },
  PICKER_TTL_SECONDS: {
    service: 'cogniate-app',
    default: 3_600,
    min: 1,
    max: 86_400,
    description: 'Content picker session lifetime in seconds. Contract: 1 h (cogniate-app-api §6, T4b2). AC-T4-20 uses 20.',
  },
  PLAY_TTL_SECONDS: {
    service: 'cogniate-app',
    default: 86_400,
    min: 1,
    max: 30 * 86_400,
    description: 'Play session (player shell and runtime token) lifetime in seconds. Contract: 24 h (cogniate-app-api §6). AC-T5-15 uses 20.',
  },
} as const satisfies Record<string, KnobSpec>;

export type KnobName = keyof typeof KNOB_REGISTRY;
type Registry = typeof KNOB_REGISTRY;
/** Knobs with a whole-number value / with a string value. */
export type NumberKnobName = { [K in KnobName]: Registry[K] extends { kind: 'string' } ? never : K }[KnobName];
export type StringKnobName = Exclude<KnobName, NumberKnobName>;

export interface Knob {
  name: string;
  value: string;
}

export interface ServiceKnobs {
  /** Effective value of every number knob of the service (default when not set). */
  values: Partial<Record<NumberKnobName, number>>;
  /** Effective value of every string knob of the service (default when not set). */
  strings: Partial<Record<StringKnobName, string>>;
  /** Knobs with a non-default value, for logs and /healthz. */
  active: Knob[];
}

function parseNumber(name: KnobName, spec: NumberKnobSpec, raw: string): number {
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be a whole number, got "${raw}"`);
  const value = Number(raw);
  if (value < spec.min || value > spec.max) throw new Error(`${name} must be between ${spec.min} and ${spec.max}, got ${value}`);
  return value;
}

function parseString(name: KnobName, spec: StringKnobSpec, raw: string): string {
  if (!spec.allowed.includes(raw)) throw new Error(`${name} must be one of ${spec.allowed.filter(Boolean).join(', ')} (or empty), got "${raw}"`);
  return raw;
}

/** Read the knobs of one service. A bad value stops the service (fail fast, clear message). */
export function readServiceKnobs(service: KnobSpec['service'], env: Record<string, string | undefined> = process.env): ServiceKnobs {
  const values: ServiceKnobs['values'] = {};
  const strings: ServiceKnobs['strings'] = {};
  const active: Knob[] = [];
  for (const name of Object.keys(KNOB_REGISTRY) as KnobName[]) {
    const spec: KnobSpec = KNOB_REGISTRY[name];
    if (spec.service !== service) continue;
    const raw = env[name];
    if (spec.kind === 'string') {
      const value = raw === undefined ? spec.default : parseString(name, spec, raw);
      strings[name as StringKnobName] = value;
      if (raw !== undefined && value !== spec.default) active.push({ name, value: raw });
      continue;
    }
    if (raw === undefined || raw === '') {
      values[name as NumberKnobName] = spec.default;
      continue;
    }
    const value = parseNumber(name, spec, raw);
    values[name as NumberKnobName] = value;
    if (value !== spec.default) active.push({ name, value: raw });
  }
  return { values, strings, active };
}

/** Effective value of one knob (for the code that uses it, for example the ltik TTL). */
export function knobValue(name: NumberKnobName, env: Record<string, string | undefined> = process.env): number {
  const spec = KNOB_REGISTRY[name] as NumberKnobSpec;
  const raw = env[name];
  return raw === undefined || raw === '' ? spec.default : parseNumber(name, spec, raw);
}

/** Effective value of one string knob. */
export function knobString(name: StringKnobName, env: Record<string, string | undefined> = process.env): string {
  const spec = KNOB_REGISTRY[name] as StringKnobSpec;
  const raw = env[name];
  return raw === undefined ? spec.default : parseString(name, spec, raw);
}
