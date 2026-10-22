// In-container side of QA form (c) (tasks README §2): the test asks the QA-2 host runner (run.mjs, action
// "qa2-operator-init") to run `docker compose exec lti-service npm run lti:operator -- init … --name qa` once.
// The host answers with a redacted result file: the CLI lines with every operator key replaced, and the key count.
// For `--replace`, the host also writes the new key to infra/.secrets/lti-operator-key (operability §6.4 step 2),
// so the test reads the new key from the read-only secrets mount. No key travels through the control folder.
import fs from 'node:fs';
import path from 'node:path';
import { CONTROL_DIR, hostAction, type HostAction } from '../../../acceptance/lib/host-control';

export type InitMode = 'plain' | 'if-none' | 'replace';

export interface InitResult {
  mode: InitMode;
  /** Exit code of `docker compose exec … npm run lti:operator -- init …`. */
  cliCode: number;
  /** Output lines of the CLI itself: npm banner and npm error lines and Node runtime warnings removed; keys replaced. */
  cliLines: string[];
  /** Distinct operator keys (`ltio_` + 43) printed on stdout or stderr. */
  keyCount: number;
  /** `--replace` only: the host wrote the one new key to the key file. */
  keyFileWritten: boolean;
}

export async function operatorInit(mode: InitMode): Promise<InitResult> {
  const answer = await hostAction('qa2-operator-init' as HostAction, 180_000, { payload: { mode }, allowFail: true });
  if (!answer.ok || !answer.out) throw new Error(`The host runner did not run qa2-operator-init (${mode}): code ${answer.code}`);
  return JSON.parse(fs.readFileSync(path.join(CONTROL_DIR(), answer.out), 'utf8')) as InitResult;
}
