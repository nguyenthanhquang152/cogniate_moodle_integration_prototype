import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import { sendJson } from './http.ts';
import { startService } from './service.ts';

describe('startService', () => {
  it('logs service_started and test_knob_active for its own active knobs only, and serves them', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cg-svc-'));
    const env = {
      PUBLIC_MOODLE_URL: 'https://moodle.test', PUBLIC_LTI_URL: 'https://lti.cogniate.test',
      PUBLIC_APP_URL: 'https://app.cogniate.test', PUBLIC_CONTENT_URL: 'https://content.cogniate-content.test',
      LOG_DIR: dir, LTIK_TTL_SECONDS: '5', REF_TTL_SECONDS: '9', STACK_PROFILE: 'acceptance',
      OUTBOUND_PRIVATE_HOST_ALLOWLIST: 'moodle.test,qa-platform.test,evil.test',
    };
    const [server] = await startService('lti-service',
      [{ name: 'demo', port: 0, publicUrl: (u) => u.lti,
        build: (deps) => createServer((_req, res) => sendJson(res, 200, { knobs: deps.knobs, profile: deps.profile, outbound_allowlist: deps.outboundAllowlist })) }],
      { env, handleSignals: false, write: () => undefined });
    try {
      const addr = server?.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      const body = (await (await fetch(`http://127.0.0.1:${port}/healthz`)).json()) as Record<string, unknown>;
      expect(body.knobs).toEqual([{ name: 'LTIK_TTL_SECONDS', value: '5' }]);
      // T2b: the profile and the active allowlist in /healthz and service_started.
      expect(body.profile).toBe('acceptance');
      expect(body.outbound_allowlist).toEqual(['moodle.test', 'qa-platform.test', 'evil.test']);
      await new Promise((r) => setTimeout(r, 50));
      const events = readFileSync(join(dir, 'demo.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
      expect(events[0]).toMatchObject({ level: 'warn', event: 'test_knob_active', name: 'LTIK_TTL_SECONDS', value: '5' });
      expect(events[1]).toMatchObject({
        event: 'service_started', public_url: 'https://lti.cogniate.test', profile: 'acceptance', outbound_allowlist: ['moodle.test', 'qa-platform.test', 'evil.test'],
      });
    } finally {
      server?.close();
    }
  });

  it('refuses to start without the public URLs', async () => {
    await expect(startService('lti-service', [], { env: {}, handleSignals: false })).rejects.toThrow(/PUBLIC_MOODLE_URL is not set/);
  });

  it('refuses to start with a bad knob value', async () => {
    const env = { PUBLIC_MOODLE_URL: 'https://moodle.test', PUBLIC_LTI_URL: 'https://lti.cogniate.test',
      PUBLIC_APP_URL: 'https://app.cogniate.test', PUBLIC_CONTENT_URL: 'https://content.cogniate-content.test', LTIK_TTL_SECONDS: 'soon' };
    await expect(startService('lti-service', [], { env, handleSignals: false })).rejects.toThrow(/LTIK_TTL_SECONDS must be a whole number/);
  });
});
