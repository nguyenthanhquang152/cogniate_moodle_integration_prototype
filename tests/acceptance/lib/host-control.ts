// Host actions that an AC names, asked for from the e2e container (T5b: AC-T5-14, -30 "docker compose stop/start
// moodle", AC-T5-31 "npm run stack:restart -- lti-service"). Tests in the container cannot run docker. So a test
// writes a request file into the shared artifacts folder, and the host runner (tests/host/run-t5.mjs) runs only these
// whitelisted commands for the QA project, then writes an answer file. Without the host runner the request times out.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { artifactsDir } from './paths';

export type HostAction = 'moodle-stop' | 'moodle-start' | 'lti-restart';

export interface HostAnswer {
  action: HostAction;
  ok: boolean;
  code: number;
  startedAt: number;
  endedAt: number;
}

export const CONTROL_DIR = () => path.join(artifactsDir('acceptance'), 'control');

export async function hostAction(action: HostAction, timeoutMs = 240_000): Promise<HostAnswer> {
  const dir = CONTROL_DIR();
  fs.mkdirSync(dir, { recursive: true });
  const id = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  fs.writeFileSync(path.join(dir, `req-${id}.json.tmp`), JSON.stringify({ id, action, at: Date.now() }));
  fs.renameSync(path.join(dir, `req-${id}.json.tmp`), path.join(dir, `req-${id}.json`));
  const answerFile = path.join(dir, `ack-${id}.json`);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fs.existsSync(answerFile)) {
      const answer = JSON.parse(fs.readFileSync(answerFile, 'utf8')) as HostAnswer;
      if (!answer.ok) throw new Error(`host action ${action} failed (exit ${answer.code})`);
      return answer;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no answer from the host runner for "${action}" within ${timeoutMs} ms (run the suite with tests/host/run-t5.mjs)`);
}
