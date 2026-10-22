// The e2e container must not read the LTI key ring (A-T1-03; LA-ADR-06 D6): compose.yaml puts an empty tmpfs on
// /repo/infra/.secrets/lti, on top of the read-only bind of infra/.secrets (run: npm run test:infra). No Docker: the test
// reads the volume list of the e2e service from the file.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const COMPOSE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'compose.yaml');

/** The volume entries of one service: a string (short form) or an object of the key: value lines (long form). */
function serviceVolumes(text, service) {
  const lines = text.split('\n');
  const start = lines.indexOf(`  ${service}:`);
  assert.notEqual(start, -1, `service ${service} in compose.yaml`);
  const entries = [];
  let inVolumes = false;
  for (const line of lines.slice(start + 1)) {
    if (/^ {2}\S/.test(line) || /^\S/.test(line)) break; // the next service or top-level key
    if (/^ {4}\S/.test(line)) { inVolumes = line.startsWith('    volumes:'); continue; }
    if (!inVolumes || line.trim() === '' || line.trim().startsWith('#')) continue;
    const value = (s) => s.replace(/\s+#.*$/, '').trim();
    const item = /^ {6}- (.*)$/.exec(line);
    if (item) {
      const kv = /^([a-z_]+): (.*)$/.exec(item[1]);
      entries.push(kv ? { [kv[1]]: value(kv[2]) } : value(item[1]));
      continue;
    }
    const kv = /^ {8}([a-z_]+): (.*)$/.exec(line);
    if (kv && typeof entries.at(-1) === 'object') entries.at(-1)[kv[1]] = value(kv[2]);
  }
  return entries;
}

describe('compose.yaml e2e service', () => {
  const volumes = serviceVolumes(fs.readFileSync(COMPOSE, 'utf8'), 'e2e');

  it('mounts infra/.secrets read-only and hides infra/.secrets/lti with an empty tmpfs', () => {
    assert.ok(volumes.includes('./.secrets:/repo/infra/.secrets:ro'), JSON.stringify(volumes));
    const hide = volumes.filter((v) => typeof v === 'object' && v.target === '/repo/infra/.secrets/lti');
    assert.deepEqual(hide.map((v) => v.type), ['tmpfs']);
    assert.ok(!volumes.some((v) => typeof v === 'string' && v.includes('.secrets/lti')), 'no bind of the key ring folder');
  });

  it('the lti-service still mounts the key ring folder (read only)', () => {
    assert.ok(serviceVolumes(fs.readFileSync(COMPOSE, 'utf8'), 'lti-service').includes('./.secrets/lti:/run/secrets/lti:ro'));
  });
});
