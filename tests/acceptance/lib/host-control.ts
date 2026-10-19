// Host actions that an AC names, asked for from the e2e container (T5b: AC-T5-14, -30 "docker compose stop/start
// moodle", AC-T5-31 "npm run stack:restart -- lti-service"; T3c: AC-T3-27 "npm run test:compat", AC-T3-19
// "npm run seed:lti-manual"). Tests in the container cannot run docker. So a test
// writes a request file into the shared artifacts folder, and the host runner (tests/host/run-t5.mjs) runs only these
// whitelisted commands for the QA project, then writes an answer file. Without the host runner the request times out.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { publicUrls } from './env';
import { httpsRequest } from './https';
import { artifactsDir } from './paths';

export type HostAction =
  | 'moodle-stop'
  | 'moodle-start'
  | 'lti-restart'
  | 'compat-run'
  | 'seed-lti-manual'
  // T8 (tests/host/run-t8.mjs): AC-T8-03, -05, -07
  | 'build-inspect'
  | 'build-release'
  | 'build-leftovers'
  | 'moodle-restore'
  // C-T8-02 (Lead): stop the stack's Build Runner, then start two at the same moment
  | 'runner-stop'
  | 'runner-race'
  // P1, P2 (Lead decision): docker compose pause/unpause moodle, own QA project only; the runner always unpauses
  | 'moodle-pause'
  | 'moodle-unpause'
  // T5b final P5: exact higher failed row only, in the fresh QA clone (bounded spec exception).
  | 'p5-remove-failed-sync';

export interface HostAnswer {
  action: HostAction;
  ok: boolean;
  code: number;
  startedAt: number;
  endedAt: number;
  /** compat-run: the output file name in the control folder (stdout and stderr, redacted by the runner). */
  out?: string;
  fixture?: { deletedSyncId: string; deletedCount: number };
}

export const CONTROL_DIR = () => path.join(artifactsDir('acceptance'), 'control');

/**
 * `payload` goes into the request file (compat-run: `{ input: <file name in the control folder> }`). With
 * `allowFail`, a non-zero exit is returned, not thrown (compat-run exits 1 when a check fails).
 */
export async function hostAction(action: HostAction, timeoutMs = 240_000, { payload = {}, allowFail = false }: { payload?: Record<string, unknown>; allowFail?: boolean } = {}): Promise<HostAnswer> {
  const dir = CONTROL_DIR();
  fs.mkdirSync(dir, { recursive: true });
  const id = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  fs.writeFileSync(path.join(dir, `req-${id}.json.tmp`), JSON.stringify({ id, action, at: Date.now(), ...payload }));
  fs.renameSync(path.join(dir, `req-${id}.json.tmp`), path.join(dir, `req-${id}.json`));
  const answerFile = path.join(dir, `ack-${id}.json`);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fs.existsSync(answerFile)) {
      const answer = JSON.parse(fs.readFileSync(answerFile, 'utf8')) as HostAnswer;
      if (!answer.ok && !allowFail) throw new Error(`host action ${action} failed (exit ${answer.code})`);
      if (action === 'moodle-start' || action === 'moodle-unpause') await waitMoodleReady();
      return answer;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no answer from the host runner for "${action}" within ${timeoutMs} ms (run the suite with tests/host/run-t5.mjs or run-t3c.mjs)`);
}

/**
 * `docker compose start moodle` returns when the container runs, not when Moodle answers (the proxy gives 502 for a
 * while). Polls the Moodle login page until it is 200 with the login form.
 */
export async function waitMoodleReady(timeoutMs = 240_000): Promise<number> {
  const started = Date.now();
  const url = `${publicUrls().moodle}/login/index.php`;
  let last = '';
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await httpsRequest(url, { timeoutMs: 10_000 });
      if (res.status === 200 && res.body.includes('loginbtn')) return Date.now() - started;
      last = `HTTP ${res.status}`;
    } catch (err) {
      last = String((err as NodeJS.ErrnoException).code ?? err);
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }
  throw new Error(`Moodle not ready ${timeoutMs} ms after start (last: ${last})`);
}
