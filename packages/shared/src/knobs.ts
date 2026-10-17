/**
 * Test knobs: the ONE registry (QA hook H3). Later tasks add knobs here, nowhere else.
 *
 * A knob is an env variable of one compose service with a production default. Tests change it with
 *   npm run stack:restart -- <service> --env NAME=VALUE
 * and restore the default with the same command without --env. A knob is "active" when its env value is
 * set and differs from the default. The service then logs test_knob_active {name, value} at start, and
 * GET /healthz lists it in "knobs": [{name, value}] (value = the env string). By default "knobs" is [].
 */
export interface KnobSpec {
  /** Compose service that reads the knob. */
  service: 'lti-service' | 'cogniate-app';
  default: number;
  min: number;
  max: number;
  description: string;
}

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
    description: 'Registration URL ref token lifetime in seconds. Contract: 24 h (cogniate-app-api, T4). AC-T4-09 uses 5.',
  },
} as const satisfies Record<string, KnobSpec>;

export type KnobName = keyof typeof KNOB_REGISTRY;

export interface Knob {
  name: string;
  value: string;
}

export interface ServiceKnobs {
  /** Effective value of every knob of the service (default when not set). */
  values: Partial<Record<KnobName, number>>;
  /** Knobs with a non-default value, for logs and /healthz. */
  active: Knob[];
}

function parse(name: KnobName, raw: string): number {
  const spec = KNOB_REGISTRY[name];
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be a whole number, got "${raw}"`);
  const value = Number(raw);
  if (value < spec.min || value > spec.max) throw new Error(`${name} must be between ${spec.min} and ${spec.max}, got ${value}`);
  return value;
}

/** Read the knobs of one service. A bad value stops the service (fail fast, clear message). */
export function readServiceKnobs(service: KnobSpec['service'], env: Record<string, string | undefined> = process.env): ServiceKnobs {
  const values: Partial<Record<KnobName, number>> = {};
  const active: Knob[] = [];
  for (const name of Object.keys(KNOB_REGISTRY) as KnobName[]) {
    const spec = KNOB_REGISTRY[name];
    if (spec.service !== service) continue;
    const raw = env[name];
    if (raw === undefined || raw === '') {
      values[name] = spec.default;
      continue;
    }
    const value = parse(name, raw);
    values[name] = value;
    if (value !== spec.default) active.push({ name, value: raw });
  }
  return { values, active };
}

/** Effective value of one knob (for the code that uses it, for example the ltik TTL). */
export function knobValue(name: KnobName, env: Record<string, string | undefined> = process.env): number {
  const raw = env[name];
  return raw === undefined || raw === '' ? KNOB_REGISTRY[name].default : parse(name, raw);
}
