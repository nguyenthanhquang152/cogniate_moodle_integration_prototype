// Test knob guard (tasks README §3; Q-T0-37 workaround).
// Tests in the e2e container cannot restart services. So the host runner restarts a service with a knob and runs
// the suite again, and each test decides from /healthz:
// - a test whose title has "[knob NAME=value]" runs only when that knob has that value;
// - every other test skips when any knob is active.
import { publicUrls } from './env';
import { httpsRequest } from './https';

export interface Knob {
  name: string;
  value: string;
}

let cached: Promise<Knob[]> | undefined;

async function knobsOf(url: string): Promise<Knob[]> {
  try {
    const res = await httpsRequest(`${url}/healthz`, { timeoutMs: 5_000 });
    const body = JSON.parse(res.body) as { knobs?: unknown };
    return (Array.isArray(body.knobs) ? body.knobs : []).map((k) =>
      typeof k === 'string' ? { name: k, value: '' } : { name: String((k as Knob).name), value: String((k as Knob).value ?? '') },
    );
  } catch {
    return []; // stack not reachable: the tests fail on their own
  }
}

/** Active knobs of the LTI service and the app (one read per process). */
export function activeKnobs(): Promise<Knob[]> {
  const urls = publicUrls();
  cached ??= Promise.all([knobsOf(urls.lti), knobsOf(urls.app)]).then((lists) => lists.flat());
  return cached;
}

export function knobMarker(title: string): Knob | null {
  const m = /\[knob ([A-Z0-9_]+)=([^\]\s]+)\]/.exec(title);
  return m ? { name: m[1], value: m[2] } : null;
}

/** null = run the test; a string = skip it with this reason. */
export function knobSkipReason(title: string, knobs: Knob[]): string | null {
  const marker = knobMarker(title);
  if (marker) {
    const on = knobs.some((k) => k.name === marker.name && (k.value === '' || k.value === marker.value));
    return on ? null : `needs knob ${marker.name}=${marker.value} (host runner knob pass)`;
  }
  if (knobs.length > 0) return `a test knob is active (${knobs.map((k) => `${k.name}=${k.value}`).join(', ')})`;
  return null;
}
