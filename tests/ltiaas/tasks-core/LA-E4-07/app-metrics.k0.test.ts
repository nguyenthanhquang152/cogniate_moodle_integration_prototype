// LA-E4-07 K0 + UNIT suite (QA-3, test-first from docs/architecture/ltiaas/tasks/LA-E4-07.md,
// docs/architecture/ltiaas/contracts/cogniate-app-api-delta.md §8a, docs/architecture/ltiaas/operability.md §4.3/§4.4,
// and build-decisions-A2.md §41 BD-A2-88 / build-decisions-A1.md BD-A1-100).
//
// Host-only checks (NO DOCKER):
// - R0: npm run check exits 0; F1 has 0 hits; F5 passes all 6 rules with 0 hits.
// - K0 static topology & proxy isolation: infra/compose.yaml exposes OPERATOR_HOST / OPERATOR_PORT (4210) on
//   cogniate-app in the acceptance profile, and the proxy configuration does not route :4210.
// - AC-LA-E4-07-01 (UNIT): default settings bind 127.0.0.1:4210 only; STACK_PROFILE=production with a non-loopback
//   OPERATOR_HOST refuses to start with config_refused reason operator_bind_not_loopback and the fixed message.
// - AC-LA-E4-07-05 (UNIT part): GET /readyz gives 200 {status:"ready"} when app DB and migrations pass (with no LTI
//   service check, BD-A2-88 D3), and 503 {status:"not_ready", reasons:[...]} when the DB does not answer or an app
//   migration is not applied.
// - AC-LA-E4-07-07 (UNIT): label guards (unknown channel -> channel="", invalid reason outside [a-z][a-z0-9_]{0,63}
//   -> reason="other") and topology (with APP_JOB_RUNNER=off, app_dispatch_sends_total and job series are absent,
//   while store-based series remain).
// - Unit coverage of AC-LA-E4-07-02 (all 8 §8a series names), AC-LA-E4-07-03 (afterCommit send counter), AC-LA-E4-07-04
//   (launch refusal counter), and AC-LA-E4-07-06 (no library id, user id, learner subject, token or key in /metrics).

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

function requireEnv(name: string): string {
  const val = process.env[name]?.trim();
  if (!val) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return val;
}

function writeArtifact(name: string, content: string): void {
  const runDir = requireEnv('LA_RUN_DIR');
  fs.mkdirSync(runDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(runDir, name), content, { mode: 0o600 });
}

describe('LA-E4-07 app metrics and readiness listener (K0 + UNIT rows)', () => {
  let cloneDir = '';

  beforeAll(() => {
    process.umask(0o077);
    cloneDir = requireEnv('LA_SCRATCH_CLONE');
    requireEnv('LA_RUN_DIR');
  });

  it('R0 & K0 static topology: npm run check exits 0, F1/F5 have 0 hits, compose acceptance profile sets cogniate-app operator listener (4210), and proxy never routes :4210', () => {
    const res = spawnSync('npm', ['run', 'check'], {
      cwd: cloneDir,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env },
    });
    const combined = `${res.stdout ?? ''}\n${res.stderr ?? ''}`;
    writeArtifact('e4-07-check-clean.log', combined);

    expect(res.status, 'npm run check must exit 0').toBe(0);
    expect(combined).toContain('F1 PASS: 0 files with hits, 0 hits');
    expect(combined).toContain('F5 PASS: 6 rules');

    // K0 static check of infra/compose.yaml and proxy config:
    const composePath = path.join(cloneDir, 'infra/compose.yaml');
    const composeText = fs.readFileSync(composePath, 'utf8');
    expect(composeText, 'compose.yaml binds cogniate-app operator listener in acceptance profile').toMatch(/4210/);
    expect(composeText, 'compose.yaml sets OPERATOR_HOST for acceptance').toMatch(/OPERATOR_HOST/);

    const caddyDir = path.join(cloneDir, 'infra');
    const infraFiles = fs.readdirSync(caddyDir).filter((f) => f.includes('Caddy') || f.endsWith('.caddy'));
    for (const file of infraFiles) {
      const content = fs.readFileSync(path.join(caddyDir, file), 'utf8');
      expect(content, `${file} must never route the app operator listener :4210`).not.toContain('4210');
    }
  });

  it('AC-LA-E4-07-01, AC-LA-E4-07-05 (UNIT), AC-LA-E4-07-07 (UNIT), and §8a series/commit/hygiene unit suite pass with fresh vitest cache', () => {
    // Delete vitest cache before running the unit suite per dispatch rule.
    fs.rmSync(path.join(cloneDir, 'node_modules/.vitest-cache'), { recursive: true, force: true });
    fs.rmSync(path.join(cloneDir, 'node_modules/.vite'), { recursive: true, force: true });

    const res = spawnSync(
      'npx',
      [
        '--no-install',
        'vitest',
        'run',
        'services/cogniate-app/src/app/metrics.test.ts',
        'services/cogniate-app/src/worker-main.test.ts',
        '--reporter=verbose',
      ],
      {
        cwd: cloneDir,
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
        env: { ...process.env },
      },
    );
    const combined = `${res.stdout ?? ''}\n${res.stderr ?? ''}`;
    writeArtifact('e4-07-unit-by-ac.log', combined);

    expect(res.status, 'metrics.test.ts must exit 0').toBe(0);
    expect(combined).toMatch(/AC-LA-E4-07-01|127\.0\.0\.1|4210|operator_bind_not_loopback/);
    expect(combined).toMatch(/AC-LA-E4-07-05|readyz|not_ready/);
    expect(combined).toMatch(/AC-LA-E4-07-07|APP_JOB_RUNNER|other/);
  });
});
