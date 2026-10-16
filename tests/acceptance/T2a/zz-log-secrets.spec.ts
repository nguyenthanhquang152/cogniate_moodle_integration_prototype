// T2a log check, runs after the other T2a specs (file name order). Source: tasks/T2a.md AC-T2-16; security §11.
// The other tests record every ltik, id_token, state and API key that they see (lib/lti.ts recordSecret).
import fs from 'node:fs';
import path from 'node:path';
import { capturedSecrets } from '../lib/lti';
import { logFile } from '../lib/logs';
import { LOGS_DIR } from '../lib/paths';
import { expect, test } from '../lib/pw';

const KINDS = new Set(['ltik', 'id_token', 'state', 'api_key']);

test('AC-T2-16 infra/.logs/lti-service.jsonl contains none of the captured ltiks, id_tokens, states or API keys', async () => {
  const secrets = capturedSecrets().filter((s) => KINDS.has(s.kind));
  const kinds = [...new Set(secrets.map((s) => s.kind))].sort();
  expect(kinds, 'the run captured every kind (else this test proves nothing)').toEqual([...KINDS].sort());
  const text = fs.readFileSync(logFile('lti-service'), 'utf8');
  const found = secrets.filter((s) => text.includes(s.value)).map((s) => `${s.kind} ${s.value.slice(0, 6)}… (${s.value.length} chars)`);
  expect(found, 'captured secrets found in lti-service.jsonl').toEqual([]);

  // Information only: the other service log files (not part of AC-T2-16).
  const others = fs.readdirSync(LOGS_DIR).filter((f) => f.endsWith('.jsonl') && f !== path.basename(logFile('lti-service')));
  const elsewhere = others.flatMap((f) => {
    const t = fs.readFileSync(path.join(LOGS_DIR, f), 'utf8');
    return secrets.filter((s) => t.includes(s.value)).map((s) => `${f}: ${s.kind} ${s.value.slice(0, 6)}…`);
  });
  test.info().annotations.push({ type: 'other log files', description: elsewhere.length ? elsewhere.join('; ') : 'no captured secret found' });
});
