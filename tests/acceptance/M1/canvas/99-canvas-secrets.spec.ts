// Last Canvas browser row: the private leak scan after the final browser token activity (AC-M1-24, Canvas part).
// The API scan (common M1-24) ran before the browser pass. Raw values stay in the private run folder only.
import fs from 'node:fs';
import path from 'node:path';
import { capturedSecrets } from '../../lib/lti';
import { artifactsDir, LOGS_DIR } from '../../lib/paths';
import { expect, test } from '../../lib/pw';
import { check, rememberPrivate, requireShas, sim } from './browser';

function files(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}

test('[SIM] AC-M1-24 browser tokens, assertions and approval codes never reach service, simulator or gate logs {case:M1-24.canvas.browser-secrets}', async () => {
  requireShas();
  const capture = await sim('/secrets'); expect(capture.status).toBe(200);
  check(Array.isArray(capture.json?.values), 'Simulator secret capture');
  for (const value of capture.json.values) rememberPrivate(value);
  const raw = path.join(artifactsDir('acceptance'), 'm1-secrets.raw.jsonl');
  const values = new Set([...capturedSecrets().map((s) => s.value),
    ...(fs.existsSync(raw) ? fs.readFileSync(raw, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as string) : [])]
    .filter((v) => typeof v === 'string' && v.length >= 8));
  check(values.size > 0, 'The scan has real captured values');
  const logs = files(LOGS_DIR).filter((f) => f.endsWith('.jsonl'));
  check(logs.some((f) => f.endsWith('lms-sim.jsonl')), 'Simulator log present');
  check(logs.some((f) => f.endsWith('lti-gate.jsonl')), 'Gate log present');
  let hits = 0;
  for (const file of logs) {
    const content = fs.readFileSync(file, 'utf8');
    for (const value of values) if (content.includes(value)) hits++;
  }
  fs.writeFileSync(path.join(artifactsDir('acceptance'), 'm1-canvas-browser-leak-scan.json'),
    JSON.stringify({ checkedValues: values.size, checkedLogs: logs.map((f) => path.basename(f)), hits }));
  expect(hits, 'Captured secrets found in logs').toBe(0);
});
