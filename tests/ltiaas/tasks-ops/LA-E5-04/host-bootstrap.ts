// In-container side of QA form (d) (tasks README §2): the test asks the QA-2 host runner (LA-E5-04/run.mjs, action
// "qa2-lti-bootstrap") to run `npm run lti:bootstrap -w services/lti-service -- --account <id> --name <n> [--rotate-api-key]`
// on the host clone. The wrapper writes `infra/.secrets/lti-api-key.<id>` (mounted read-only in e2e), and the host
// runner masks the printed key before writing the control response or log. No secret travels through the control folder.
import fs from 'node:fs';
import path from 'node:path';
import { CONTROL_DIR, hostAction, type HostAction } from '../../../acceptance/lib/host-control';

export interface BootstrapResult {
  account: string;
  cliCode: number;
  keyCount: number;
  keyFileWritten: boolean;
}

export async function ltiBootstrap(
  account: string,
  name: string,
  { rotateApiKey = false }: { rotateApiKey?: boolean } = {},
): Promise<BootstrapResult> {
  const answer = await hostAction('qa2-lti-bootstrap' as HostAction, 180_000, {
    payload: { account, name, rotateApiKey },
    allowFail: true,
  });
  if (!answer.ok || !answer.out) {
    throw new Error(`The host runner did not run qa2-lti-bootstrap (${account}): code ${answer.code}`);
  }
  return JSON.parse(fs.readFileSync(path.join(CONTROL_DIR(), answer.out), 'utf8')) as BootstrapResult;
}
